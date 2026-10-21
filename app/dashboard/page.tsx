// Dashboard — the trees the logged-in user belongs to, plus create-tree.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { createTree } from "./actions";
import type { Tree } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);

  // Trees where I'm a member (RLS on tree_members lets me see my own rows;
  // the join to trees is allowed by the trees_select_member policy).
  const { data: memberships } = await supabase
    .from("tree_members")
    .select("role, trees (id, name, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const trees = (memberships ?? [])
    .map((m) => ({
      ...(m.trees as unknown as Tree),
      role: m.role as string,
    }))
    .filter((t) => t.id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">
        Namaste{profile ? `, ${profile.username}` : ""} 🙏
      </h1>
      <p className="text-stone-600 text-sm mb-8">
        Your family trees live here. Create one, or open an invite link from a
        relative to join theirs.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-3">My trees</h2>
          {trees.length === 0 ? (
            <div className="card text-sm text-stone-600">
              No trees yet — create your first one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {trees.map((t) => (
                <Link
                  key={t.id}
                  href={`/trees/${t.id}`}
                  className="card block hover:border-emerald-400"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">🌳 {t.name}</span>
                    <span className="text-xs text-stone-500 bg-stone-100 rounded px-2 py-0.5">
                      {t.role}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-3">Start a new tree</h2>
          <form action={createTree} className="card space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Family / tree name
              </label>
              <input
                name="name"
                placeholder="e.g. Sharma parivaar"
                required
                maxLength={80}
              />
            </div>
            <button type="submit">Create tree</button>
            <p className="text-xs text-stone-500">
              You&apos;ll become the owner. Add yourself as the first person,
              then invite relatives.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
