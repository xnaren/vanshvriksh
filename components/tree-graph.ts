// Shared family-graph structure built from persons + spouse links.
// Used by both the pedigree view and the outline (folder) view.
import type { Person, SpouseLink } from "@/lib/types";

export interface TreeGraph {
  byId: Map<string, Person>;
  childrenOf: Map<string, Person[]>;
  partnerOf: Map<string, string>;
  hasParents: Set<string>;
  roots: Person[];
}

/** Children of a family unit: union of both partners' children, deduped. */
export function unitChildren(graph: TreeGraph, p: Person, pairWith?: Person) {
  const kids = new Map<string, Person>();
  for (const parent of [p, pairWith].filter(Boolean) as Person[]) {
    for (const c of graph.childrenOf.get(parent.id) ?? []) kids.set(c.id, c);
  }
  return Array.from(kids.values());
}

export function buildTreeGraph(
  persons: Person[],
  spouses: SpouseLink[]
): TreeGraph {
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

  const hasParents = new Set(
    persons.filter((p) => p.father_id || p.mother_id).map((p) => p.id)
  );
  const roots = persons.filter((p) => !hasParents.has(p.id));
  return { byId, childrenOf, partnerOf, hasParents, roots };
}

/** Pair up spouses only when both are roots — otherwise the spouse renders
 *  in their own birth family and the link is shown as an annotation. */
export function pairSpouse(
  graph: TreeGraph,
  p: Person,
  shown: Set<string>
): Person | undefined {
  const spouseId = graph.partnerOf.get(p.id);
  const spouse =
    spouseId && !shown.has(spouseId) ? graph.byId.get(spouseId) : undefined;
  const pairWith =
    spouse && !graph.hasParents.has(spouse.id) ? spouse : undefined;
  if (pairWith) shown.add(pairWith.id);
  return pairWith;
}

/** The spouse when they can't be paired (renders elsewhere). */
export function unpairedSpouse(
  graph: TreeGraph,
  p: Person,
  pairWith: Person | undefined,
  shown: Set<string>
): Person | undefined {
  const spouseId = graph.partnerOf.get(p.id);
  if (!spouseId || pairWith) return undefined;
  const spouse = graph.byId.get(spouseId);
  if (!spouse || shown.has(spouse.id)) return undefined;
  return spouse;
}
