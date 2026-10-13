// Baseline tree renderer: groups people by generation (BFS from roots) and
// renders a nested pedigree list with spouse annotations.
//
// NOTE (future work): Indian joint families with intermarriages are graphs,
// not trees — a strict pedigree layout will mis-draw cousin-marriage loops.
// When that matters, swap this for a graph layout engine (e.g. d3-dag) that
// can render shared ancestors and multiple marriage edges. The data model
// (father_id / mother_id + spouses) already supports it.
"use client";

import type { Person, SpouseLink } from "@/lib/types";

function label(p: Person, spouseName?: string): string {
  const name = `${p.given_name}${p.family_name ? " " + p.family_name : ""}`;
  const extra = [
    p.gotra ? `gotra: ${p.gotra}` : null,
    spouseName ? `⚭ ${spouseName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return extra ? `${name} (${extra})` : name;
}

export default function TreeView({
  persons,
  spouses,
}: {
  persons: Person[];
  spouses: SpouseLink[];
}) {
  if (persons.length === 0) {
    return (
      <p className="text-stone-500 text-sm">
        No members yet — add the first person to begin the tree.
      </p>
    );
  }

  const byId = new Map(persons.map((p) => [p.id, p]));
  const childrenOf = new Map<string, Person[]>();
  for (const p of persons) {
    for (const parentId of [p.father_id, p.mother_id]) {
      if (parentId && byId.has(parentId)) {
        const list = childrenOf.get(parentId) ?? [];
        list.push(p);
        childrenOf.set(parentId, list);
      }
    }
  }

  const partnerOf = new Map<string, string>();
  for (const s of spouses) {
    partnerOf.set(s.person_a, s.person_b);
    partnerOf.set(s.person_b, s.person_a);
  }

  // Roots: nobody in this tree lists them as a child.
  const hasParents = new Set(
    persons.filter((p) => p.father_id || p.mother_id).map((p) => p.id)
  );
  const roots = persons.filter((p) => !hasParents.has(p.id));
  const shown = new Set<string>();

  function renderNode(p: Person): React.ReactNode {
    if (shown.has(p.id)) return null; // guard against cycles
    shown.add(p.id);
    const spouseId = partnerOf.get(p.id);
    const spouse = spouseId ? byId.get(spouseId) : undefined;
    const kids = childrenOf.get(p.id) ?? [];
    return (
      <li key={p.id} className="mt-1">
        <span className="inline-block bg-white border border-stone-200 rounded px-2 py-0.5 text-sm">
          {label(
            p,
            spouse ? `${spouse.given_name}${spouse.family_name ? " " + spouse.family_name : ""}` : undefined
          )}
        </span>
        {kids.length > 0 && (
          <ul className="ml-6 border-l-2 border-emerald-200 pl-3">
            {kids.map(renderNode)}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="card">
      <ul>{roots.map(renderNode)}</ul>
    </div>
  );
}
