// Card-based pedigree renderer: roots at top, children nested below with
// connector lines. Spouses who are both roots render as a couple card.
// Each card carries Edit / Delete actions (editors only).
//
// NOTE (future work): Indian joint families with intermarriages are graphs,
// not trees — a strict pedigree layout will mis-draw cousin-marriage loops.
// When that matters, swap this for a graph layout engine (e.g. d3-dag).
// The data model (father_id / mother_id + spouses) already supports it.
"use client";

import { useState } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { deletePerson } from "@/app/trees/[id]/actions";
import EditPersonModal from "./EditPersonModal";

function displayName(p: Person) {
  return `${p.given_name}${p.family_name ? " " + p.family_name : ""}`;
}

function year(d: string | null): string | null {
  return d ? d.slice(0, 4) : null;
}

function detailsLine(p: Person): string {
  const bits: string[] = [];
  if (p.gotra) bits.push(p.gotra);
  const birth = year(p.dob);
  const death = year(p.dod);
  if (birth && death) bits.push(`${birth}–${death}`);
  else if (birth) bits.push(p.is_living ? `b. ${birth}` : `${birth}–?`);
  else if (death) bits.push(`d. ${death}`);
  else if (!p.is_living) bits.push("†");
  if (p.native_place) bits.push(p.native_place);
  return bits.join(" · ");
}

function PersonCard({
  p,
  canEdit,
  onEdit,
  onDelete,
}: {
  p: Person;
  canEdit: boolean;
  onEdit: (p: Person) => void;
  onDelete: (p: Person) => void;
}) {
  const details = detailsLine(p);
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-sm min-w-[10rem] max-w-[14rem]">
      <div className="font-medium text-sm leading-tight">{displayName(p)}</div>
      {details && <div className="text-xs text-stone-500 mt-0.5">{details}</div>}
      {canEdit && (
        <div className="flex gap-3 mt-1.5 text-xs">
          <button
            type="button"
            className="text-emerald-700 hover:underline"
            onClick={() => onEdit(p)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-red-600 hover:underline"
            onClick={() => onDelete(p)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function TreeView({
  persons,
  spouses,
  treeId,
  canEdit,
}: {
  persons: Person[];
  spouses: SpouseLink[];
  treeId: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Person | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(p: Person) {
    if (
      !confirm(
        `Delete ${displayName(p)} from this tree? Their links to relatives will be removed.`
      )
    )
      return;
    setDeletingId(p.id);
    try {
      await deletePerson(treeId, p.id);
    } catch (err) {
      alert((err as Error).message);
    }
    setDeletingId(null);
  }

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
        if (!list.some((c) => c.id === p.id)) list.push(p);
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

    // Pair up spouses only when both are roots — otherwise the spouse
    // renders in their own birth family with an annotation.
    const spouseId = partnerOf.get(p.id);
    const spouse =
      spouseId && !shown.has(spouseId) ? byId.get(spouseId) : undefined;
    const pairWith =
      spouse && !hasParents.has(spouse.id) ? spouse : undefined;
    if (pairWith) shown.add(pairWith.id);

    const kids = new Map<string, Person>();
    for (const parent of [p, pairWith].filter(Boolean) as Person[]) {
      for (const c of childrenOf.get(parent.id) ?? []) kids.set(c.id, c);
    }
    const children = Array.from(kids.values());

    return (
      <li key={p.id} className="mt-2 first:mt-0">
        <div className="flex items-center gap-2 flex-wrap">
          <PersonCard
            p={p}
            canEdit={canEdit}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
          {pairWith && (
            <>
              <span className="text-rose-400 text-lg" title="married">
                ⚭
              </span>
              <PersonCard
                p={pairWith}
                canEdit={canEdit}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            </>
          )}
          {!pairWith && spouse && (
            <span className="text-xs text-stone-500">
              ⚭ {displayName(spouse)}
            </span>
          )}
        </div>
        {children.length > 0 && (
          <ul className="ml-5 mt-1 border-l-2 border-emerald-200 pl-4">
            {children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="card overflow-x-auto">
      {deletingId && (
        <p className="text-xs text-stone-500 mb-2">Deleting…</p>
      )}
      <ul>{roots.map(renderNode)}</ul>
      {editing && (
        <EditPersonModal
          treeId={treeId}
          person={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
