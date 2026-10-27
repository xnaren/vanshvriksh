// Admin console: search users and trees, delete a user (with the
// trees they created) or a single tree, reset a user's password,
// and change the admin's own credentials. Gated by the admin
// session (requireAdmin) — this page never uses Supabase auth.
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminLogout } from "./actions";
import AdminCredentialsForm from "@/components/AdminCredentialsForm";
import { TreeRowActions, UserRowActions } from "@/components/AdminRowActions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { q?: string; tq?: string };
}) {
  requireAdmin();
  const admin = createAdminClient();
  const q = (searchParams.q ?? "").trim();
  const tq = (searchParams.tq ?? "").trim();

  // Users (profiles). Empty query = most recent 50.
  let usersQuery = admin
    .from("profiles")
    .select("id, username, email, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) {
    usersQuery = usersQuery.or(
      `username.ilike.%${q}%,email.ilike.%${q}%`
    );
  }
  const { data: users } = await usersQuery;
  const userList = (users ?? []) as {
    id: string;
    username: string;
    email: string;
    created_at: string;
  }[];

  // Trees created per user + trees each user belongs to.
  const userIds = userList.map((u) => u.id);
  const createdCount = new Map<string, number>();
  const memberCount = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: created } = await admin
      .from("trees")
      .select("created_by")
      .in("created_by", userIds);
    for (const t of created ?? []) {
      const id = t.created_by as string | null;
      if (id) createdCount.set(id, (createdCount.get(id) ?? 0) + 1);
    }
    const { data: memberships } = await admin
      .from("tree_members")
      .select("user_id")
      .in("user_id", userIds);
    for (const m of memberships ?? []) {
      const id = m.user_id as string;
      memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
    }
  }

  // Trees. Empty query = most recent 50.
  let treesQuery = admin
    .from("trees")
    .select("id, name, created_by, visibility, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (tq) treesQuery = treesQuery.ilike("name", `%${tq}%`);
  const { data: trees } = await treesQuery;
  const treeList = (trees ?? []) as {
    id: string;
    name: string;
    created_by: string | null;
    visibility: string;
    created_at: string;
  }[];
  const ownerIds = Array.from(new Set(treeList.map((t) => t.created_by).filter(Boolean) as string[]));
  const ownerNames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: owners } = await admin
      .from("profiles")
      .select("id, username")
      .in("id", ownerIds);
    for (const o of owners ?? []) {
      ownerNames.set(o.id as string, o.username as string);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Admin console</h1>
          <p className="text-stone-600 text-sm">
            Search users and trees, delete accounts and trees, reset a
            user&apos;s password, or change the admin credentials below.
          </p>
        </div>
        <form action={adminLogout}>
          <button type="submit" className="btn-secondary whitespace-nowrap">
            Sign out
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Users</h2>
        <form action="/admin" method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by username or email…"
            className="flex-1"
          />
          {tq && <input type="hidden" name="tq" value={tq} />}
          <button type="submit" className="btn-secondary">Search</button>
        </form>
        {userList.length === 0 ? (
          <div className="card text-sm text-stone-600">No users found.</div>
        ) : (
          <div className="space-y-2">
            {userList.map((u) => (
              <div key={u.id} className="card flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium break-all">{u.username}</div>
                  <div className="text-xs text-stone-500 break-all">{u.email}</div>
                  <div className="text-xs text-stone-500">
                    {createdCount.get(u.id) ?? 0} tree(s) created · member of{" "}
                    {memberCount.get(u.id) ?? 0} · joined{" "}
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                <UserRowActions userId={u.id} username={u.username} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Trees</h2>
        <form action="/admin" method="get" className="flex gap-2">
          <input
            name="tq"
            defaultValue={tq}
            placeholder="Search trees by name…"
            className="flex-1"
          />
          {q && <input type="hidden" name="q" value={q} />}
          <button type="submit" className="btn-secondary">Search</button>
        </form>
        {treeList.length === 0 ? (
          <div className="card text-sm text-stone-600">No trees found.</div>
        ) : (
          <div className="space-y-2">
            {treeList.map((t) => (
              <div key={t.id} className="card flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/trees/${t.id}`}
                    className="font-medium text-emerald-700 underline break-all"
                  >
                    {t.name}
                  </Link>
                  <div className="text-xs text-stone-500">
                    Owner: {t.created_by ? (ownerNames.get(t.created_by) ?? "—") : "—"}
                    {" · "}visibility: {t.visibility}
                    {" · "}created {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
                <TreeRowActions treeId={t.id} treeName={t.name} />
              </div>
            ))}
          </div>
        )}
      </section>

      <AdminCredentialsForm />
    </div>
  );
}
