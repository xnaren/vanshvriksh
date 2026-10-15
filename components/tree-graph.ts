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

/** One renderable family unit: a person, their paired spouse (couple
 *  block), an unpaired-spouse annotation, and nested child units. */
export interface FamilyUnit {
  main: Person;
  pair?: Person;
  spouseNote?: Person;
  children: FamilyUnit[];
}

/**
 * Build the full unit plan in ONE pure pass.
 *
 * IMPORTANT: the `shown` set below is local to this function and never
 * escapes into React rendering. An earlier version threaded a shared
 * `shown` set through the components and mutated it during render
 * (pairing decisions for later subtrees depended on it). In React 18's
 * concurrent mode a render pass can be discarded and restarted, so
 * components could close over different `shown` sets — the client then
 * paired spouses differently than the server did, producing hydration
 * mismatches ("did not expect server HTML to contain a <li> in <ul>").
 * Computing the plan purely here makes every render self-consistent.
 */
export function buildFamilyUnits(
  persons: Person[],
  spouses: SpouseLink[]
): FamilyUnit[] {
  const graph = buildTreeGraph(persons, spouses);
  const shown = new Set<string>();

  function unitFor(p: Person): FamilyUnit | null {
    if (shown.has(p.id)) return null; // guard against cycles
    shown.add(p.id);
    const pairWith = pairSpouse(graph, p, shown);
    const spouseNote = unpairedSpouse(graph, p, pairWith, shown);
    const children: FamilyUnit[] = [];
    for (const c of unitChildren(graph, p, pairWith)) {
      const u = unitFor(c);
      if (u) children.push(u);
    }
    return { main: p, pair: pairWith, spouseNote, children };
  }

  const units: FamilyUnit[] = [];
  for (const r of graph.roots) {
    const u = unitFor(r);
    if (u) units.push(u);
  }
  return units;
}
