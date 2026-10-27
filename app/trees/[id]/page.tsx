// Tree detail page: full-bleed pedigree canvas. The tree name and its
// icon controls (TreeToolbar) render into the app header's slot, so
// this page is just the canvas.
//
// Access: members see everything (RLS enforces their role); a public
// tree is also viewable without signing in and without membership —
// read-only, with no roster, and with private persons/spouses already
// filtered out by the public RLS policies. Private/invite trees still
// 404 for non-members.
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTreeRole } from "@/lib/auth";
import TreeView from "@/components/TreeView";
import TreeToolbar from "@/components/TreeToolbar";
import type { Person, RosterEntry, SpouseLink } from "@/lib/types";

export default async function TreePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treeId = params.id;

  const { data: tree } = await supabase
    .from("trees")
    .select("id, name, visibility")
    .eq("id", treeId)
    .single();
  if (!tree) notFound();

  const role = user ? await getTreeRole(treeId, user.id) : null;
  if (!role && tree.visibility !== "public") {
    // Not a member of a non-public tree: members-only, as before.
    if (!user) redirect("/login");
    notFound();
  }
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

  // The account roster is members-only even on a public tree.
  let roster: RosterEntry[] = [];
  if (role) {
    const { data: rosterData } = await supabase
      .from("tree_members")
      .select("role, profiles (username)")
      .eq("tree_id", treeId);
    // supabase-js (untyped client) infers the embedded `profiles` as an
    // array; at runtime PostgREST returns this many-to-one join as a
    // single object (or null), so cast explicitly like Person[]/SpouseLink[].
    roster = (rosterData ?? []) as unknown as RosterEntry[];
  }

  const personList = (persons ?? []) as Person[];
  const spouseList = (spouses ?? []) as SpouseLink[];

  return (
    <div className="px-3 pt-3 pb-2">
      <TreeToolbar
        treeId={treeId}
        treeName={tree.name}
        treeVisibility={tree.visibility as "invite" | "private" | "public"}
        memberCount={personList.length}
        role={role ?? "public viewer"}
        canEdit={canEdit}
        isOwner={role === "owner"}
        persons={personList.map((p) => ({
          id: p.id,
          given_name: p.given_name,
          family_name: p.family_name,
        }))}
        roster={roster}
        fullPersons={personList}
        spouses={spouseList}
      />

      <TreeView
        persons={personList}
        spouses={spouseList}
        treeId={treeId}
        canEdit={canEdit}
      />
    </div>
  );
}
