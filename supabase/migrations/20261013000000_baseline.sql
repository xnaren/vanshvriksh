-- ============================================================================
-- VanshVriksh — baseline schema
-- Apply via: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  visibility text not null default 'invite' check (visibility in ('invite', 'private')),
  created_at timestamptz not null default now()
);

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  given_name text not null,
  family_name text,
  gotra text,
  gender text check (gender in ('male', 'female', 'other')),
  dob date,
  dod date,
  native_place text,
  photo_url text,
  notes text,
  is_living boolean not null default true,
  father_id uuid references public.persons(id) on delete set null,
  mother_id uuid references public.persons(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists persons_tree_idx on public.persons(tree_id);
create index if not exists persons_father_idx on public.persons(father_id);
create index if not exists persons_mother_idx on public.persons(mother_id);

create table if not exists public.spouses (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  person_a uuid not null references public.persons(id) on delete cascade,
  person_b uuid not null references public.persons(id) on delete cascade,
  married_on date,
  unique (person_a, person_b),
  check (person_a <> person_b)
);
create index if not exists spouses_tree_idx on public.spouses(tree_id);

create table if not exists public.tree_members (
  tree_id uuid not null references public.trees(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  linked_person_id uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tree_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '30 days',
  used_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies can use them safely)
-- ----------------------------------------------------------------------------

-- Is the current user a member of this tree?
create or replace function public.is_tree_member(p_tree_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tree_members
    where tree_id = p_tree_id and user_id = auth.uid()
  );
$$;

-- The current user's role in this tree (null if not a member).
create or replace function public.tree_role(p_tree_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.tree_members
  where tree_id = p_tree_id and user_id = auth.uid()
  limit 1;
$$;

-- Masked email hint for the passwordless login flow.
-- Called AFTER the Turnstile captcha passes. Never returns the full email.
-- Example: 'r***@gmail.com'
create or replace function public.username_email_hint(p_username text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email
  from public.profiles
  where lower(username) = lower(trim(p_username))
  limit 1;

  if v_email is null then
    return null;
  end if;

  return substring(v_email from 1 for 1)
      || '***'
      || substring(v_email from position('@' in v_email));
end;
$$;

-- Invite details for the /invite/[token] page. Works for non-members.
create or replace function public.get_invite_info(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  r record;
begin
  select i.role, i.expires_at, i.used_by, t.name
    into r
  from public.invites i
  join public.trees t on t.id = i.tree_id
  where i.token = p_token;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  if r.used_by is not null or r.expires_at < now() then
    return jsonb_build_object('valid', false);
  end if;

  return jsonb_build_object('valid', true, 'tree_name', r.name, 'role', r.role);
end;
$$;

-- Accept an invite: adds the caller to the tree. Validates expiry server-side.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_tree_id uuid;
  v_role text;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select i.tree_id, i.role into v_tree_id, v_role
  from public.invites i
  where i.token = p_token
    and i.used_by is null
    and i.expires_at > now();

  if not found then
    raise exception 'invite is invalid or expired';
  end if;

  insert into public.tree_members (tree_id, user_id, role)
  values (v_tree_id, v_uid, v_role)
  on conflict (tree_id, user_id) do update set role = excluded.role;

  update public.invites set used_by = v_uid
  where token = p_token and used_by is null;

  return v_tree_id;
end;
$$;

-- Auto-add the tree creator as owner.
create or replace function public.handle_new_tree()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.tree_members (tree_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_trees_add_owner on public.trees;
create trigger trg_trees_add_owner
  after insert on public.trees
  for each row execute function public.handle_new_tree();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.trees enable row level security;
alter table public.persons enable row level security;
alter table public.spouses enable row level security;
alter table public.tree_members enable row level security;
alter table public.invites enable row level security;

-- profiles: users manage their own row. (Admin lookups use the service role,
-- which bypasses RLS.)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- trees: members can read; creator inserts; owners update/delete.
drop policy if exists trees_select_member on public.trees;
create policy trees_select_member on public.trees
  for select using (public.is_tree_member(id) or created_by = auth.uid());
drop policy if exists trees_insert on public.trees;
create policy trees_insert on public.trees
  for insert with check (created_by = auth.uid());
drop policy if exists trees_update_owner on public.trees;
create policy trees_update_owner on public.trees
  for update using (public.tree_role(id) = 'owner');
drop policy if exists trees_delete_owner on public.trees;
create policy trees_delete_owner on public.trees
  for delete using (public.tree_role(id) = 'owner');

-- persons: members read; editors and owners write.
drop policy if exists persons_select_member on public.persons;
create policy persons_select_member on public.persons
  for select using (public.is_tree_member(tree_id));
drop policy if exists persons_insert_editor on public.persons;
create policy persons_insert_editor on public.persons
  for insert with check (public.tree_role(tree_id) in ('owner', 'editor'));
drop policy if exists persons_update_editor on public.persons;
create policy persons_update_editor on public.persons
  for update using (public.tree_role(tree_id) in ('owner', 'editor'));
drop policy if exists persons_delete_editor on public.persons;
create policy persons_delete_editor on public.persons
  for delete using (public.tree_role(tree_id) in ('owner', 'editor'));

-- spouses: same as persons.
drop policy if exists spouses_select_member on public.spouses;
create policy spouses_select_member on public.spouses
  for select using (public.is_tree_member(tree_id));
drop policy if exists spouses_insert_editor on public.spouses;
create policy spouses_insert_editor on public.spouses
  for insert with check (public.tree_role(tree_id) in ('owner', 'editor'));
drop policy if exists spouses_update_editor on public.spouses;
create policy spouses_update_editor on public.spouses
  for update using (public.tree_role(tree_id) in ('owner', 'editor'));
drop policy if exists spouses_delete_editor on public.spouses;
create policy spouses_delete_editor on public.spouses
  for delete using (public.tree_role(tree_id) in ('owner', 'editor'));

-- tree_members: members can list the roster; owners manage it.
-- (Row creation for new trees / invite acceptance happens via
-- SECURITY DEFINER functions, which bypass these policies.)
drop policy if exists members_select on public.tree_members;
create policy members_select on public.tree_members
  for select using (user_id = auth.uid() or public.is_tree_member(tree_id));
drop policy if exists members_manage_owner on public.tree_members;
create policy members_manage_owner on public.tree_members
  for all using (public.tree_role(tree_id) = 'owner')
  with check (public.tree_role(tree_id) = 'owner');

-- invites: owners and editors can create/list; owners can delete.
drop policy if exists invites_select_editor on public.invites;
create policy invites_select_editor on public.invites
  for select using (public.tree_role(tree_id) in ('owner', 'editor'));
drop policy if exists invites_insert_editor on public.invites;
create policy invites_insert_editor on public.invites
  for insert with check (public.tree_role(tree_id) in ('owner', 'editor'));
drop policy if exists invites_delete_owner on public.invites;
create policy invites_delete_owner on public.invites
  for delete using (public.tree_role(tree_id) = 'owner');

-- ----------------------------------------------------------------------------
-- Email OTP settings (manual step — see supabase/README.md)
-- ----------------------------------------------------------------------------
-- In the Supabase Dashboard → Authentication → Sign In / Up, enable the
-- "Email" provider. OTP emails work out of the box; for production, set a
-- custom SMTP sender under Authentication → Settings.
