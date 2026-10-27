-- VanshVriksh: admin console + public/private visibility.
-- Apply AFTER the three earlier migrations, in order.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS throughout.
-- NOTE: no admin credentials live here, in code, or in any committed
-- file. The first admin login checks ADMIN_USERNAME / ADMIN_PASSWORD /
-- ADMIN_OTP_CODE from the environment; changing them in the console
-- stores only scrypt hashes in admin_settings (see lib/admin-auth.ts).

-- Admin credentials (hashed only) — one row, id = 1. Empty until the
-- first admin login seeds it from the environment, or the admin
-- changes credentials in the console.
create table if not exists public.admin_settings (
  id int primary key check (id = 1),
  password_hash text not null,
  otp_hash text not null,
  updated_at timestamptz not null default now()
);

-- Trees: add 'public' to the visibility options. Existing values
-- ('invite', 'private') keep their meaning; 'public' means anyone
-- can view the tree (members still edit as before).
alter table public.trees drop constraint if exists trees_visibility_check;
alter table public.trees
  add constraint trees_visibility_check
  check (visibility in ('invite', 'private', 'public'));

-- Persons: per-person visibility inside a public tree. A private
-- person is hidden from non-member viewers of a public tree, but
-- still fully visible to the tree's members. Default public, so
-- existing trees behave as before.
alter table public.persons
  add column if not exists is_public boolean not null default true;

-- Public reads (permissive policies add to, never replace, the
-- member policies in the baseline migration).
drop policy if exists trees_select_public on public.trees;
create policy trees_select_public on public.trees
  for select using (visibility = 'public');

drop policy if exists persons_select_public on public.persons;
create policy persons_select_public on public.persons
  for select using (
    is_public
    and exists (
      select 1 from public.trees t
      where t.id = tree_id and t.visibility = 'public'
    )
  );

drop policy if exists spouses_select_public on public.spouses;
create policy spouses_select_public on public.spouses
  for select using (
    exists (
      select 1 from public.trees t
      where t.id = spouses.tree_id and t.visibility = 'public'
    )
    and exists (
      select 1 from public.persons pa
      where pa.id = spouses.person_a and pa.is_public
    )
    and exists (
      select 1 from public.persons pb
      where pb.id = spouses.person_b and pb.is_public
    )
  );
