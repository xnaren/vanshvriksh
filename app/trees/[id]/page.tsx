// Tree detail page: pedigree view, relation-based adding, invites, roster.
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTreeRole } from "@/lib/auth";
import AddRelativeForm from "@/components/AddRelativeForm";
import TreeView from "@/components/TreeView";
import InvitePanel from "@/components/InvitePanel";
import type { Person, SpouseLink } from "@/lib/types";

export default async function TreePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const treeId = params.id;

  const { data: tree } = await supabase
    .from("trees")
    .select("id, name")
    .eq("id", treeId)
    .single();
  if (!tree) notFound();

  const role = await getTreeRole(treeId, user.id);
  if (!role) notFound(); // not a member — RLS would block reads anyway
  const canEdit = role === "owner" || role === "editor";

  const { data: persons } = await supabase
    .from("persons")
    .select("*")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: true });

  const { data: spouses } = await supabase
    .from("spouses")
    .select("*")
    .eq("tree_id", treeId);

  const { data: roster } = await supabase
    .from("tree_members")
    .select("role, profiles (username)")
    .eq("tree_id", treeId);

  const personList = (persons ?? []) as Person[];
  const spouseList = (spouses ?? []) as SpouseLink[];

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🌳 {tree.name}</h1>
        <span className="text-xs text-stone-500 bg-stone-100 rounded px-2 py-1">
          your role: {role}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-semibold mb-3">Family tree</h2>
          <TreeView persons={personList} spouses={spouseList} />
        </div>

        <div className="space-y-6">
          {canEdit && (
            <AddRelativeForm
              treeId={treeId}
              persons={personList.map((p) => ({
                id: p.id,
                given_name: p.given_name,
                family_name: p.family_name,
              }))}
            />
          )}
          {canEdit && <InvitePanel treeId={treeId} />}

          <div className="card">
            <h3 className="font-semibold mb-2">Members</h3>
            <ul className="text-sm space-y-1">
              {(roster ?? []).map((m: { role: string; profiles: { username: string } | null }, i: number) => (
                <li key={i} className="flex justify-between">
                  <span>{m.profiles?.username ?? "—"}</span>
                  <span className="text-stone-500">{m.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
