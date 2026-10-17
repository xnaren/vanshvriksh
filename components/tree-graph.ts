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

/** One renderable family unit: a person, their paired spouse (couple
 *  block), an unpaired-spouse annotation, and nested child units.
 *  `ref` marks a leaf reference card: a paired-away partner shown in
 *  their birth family (annotated with their spouse), while the full
 *  couple renders at the anchor's position.
 *  `inLaw` docks the pair's parents' unit above the couple, so both
 *  spouses show their own parents (husband's above him via nesting,
 *  wife's docked above her) in a single connected tree. */
export interface FamilyUnit {
  main: Person;
  pair?: Person;
  spouseNote?: Person;
  children: FamilyUnit[];
  ref?: boolean;
  inLaw?: FamilyUnit;
}

/**
 * Build the full unit plan in ONE pure pass.
 *
 * Pairing is decided globally before rendering (never during): the anchor
 * partner hosts the couple unit and the other partner never renders alone.
 * Who anchors: the partner who has parents in the tree — so a married
 * couple draws together in the anchored partner's birth position (e.g. a
 * wife joins her husband's line) instead of one spouse rendering solo with
 * a "⚭ name" annotation. If both/neither have parents, whoever comes first
 * anchors. This keeps married couples visually linked, which is the whole
 * point of the tree.
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
  spouses: SpouseLink[],
  opts?: { dockInLaws?: boolean }
): FamilyUnit[] {
  const graph = buildTreeGraph(persons, spouses);

  // Directional pairing: anchorId -> partnerId.
  const pairOf = new Map<string, string>();
  const paired = new Set<string>();
  for (const p of persons) {
    if (paired.has(p.id)) continue;
    const sId = graph.partnerOf.get(p.id);
    if (!sId || paired.has(sId)) continue;
    const s = graph.byId.get(sId);
    if (!s) continue;
    const pHasParents = graph.hasParents.has(p.id);
    const sHasParents = graph.hasParents.has(s.id);
    // The partner with parents anchors the couple; otherwise first one wins.
    const anchor = sHasParents && !pHasParents ? s : p;
    const other = anchor === p ? s : p;
    pairOf.set(anchor.id, other.id);
    paired.add(p.id);
    paired.add(s.id);
  }
  const pairedOther = new Set(pairOf.values());

  // A paired-away partner who has parents in the tree also renders as a
  // leaf reference card in their birth family (annotated with their
  // spouse), so both families visibly show the link. Without this, linking
  // e.g. a wife to her parents would silently drop her from their family
  // view, since the couple is anchored at one side only.
  const birthRef = new Set(
    Array.from(pairedOther).filter((id) => graph.hasParents.has(id))
  );

  const shown = new Set<string>();
  const refShown = new Set<string>();
  function unitFor(p: Person, asRef = false): FamilyUnit | null {
    if (asRef) {
      // Birth-family reference: exactly once, a leaf, never nests children.
      // Uses its own set so render order can't suppress it.
      if (refShown.has(p.id)) return null;
      refShown.add(p.id);
      const sId = graph.partnerOf.get(p.id);
      const spouseNote = sId ? graph.byId.get(sId) : undefined;
      return { main: p, spouseNote, children: [], ref: true };
    }
    if (shown.has(p.id) || pairedOther.has(p.id)) return null; // cycles / paired-away
    shown.add(p.id);
    const otherId = pairOf.get(p.id);
    const pair = otherId ? graph.byId.get(otherId) : undefined;
    if (pair) shown.add(pair.id);
    // Unpaired-spouse annotation: linked spouse who ended up paired elsewhere.
    let spouseNote: Person | undefined;
    const sId = graph.partnerOf.get(p.id);
    if (!pair && sId && !shown.has(sId)) {
      const s = graph.byId.get(sId);
      if (s) spouseNote = s;
    }
    const children: FamilyUnit[] = [];
    for (const c of unitChildren(graph, p, pair)) {
      const u = birthRef.has(c.id) ? unitFor(c, true) : unitFor(c);
      if (u) children.push(u);
    }
    return { main: p, pair, spouseNote, children };
  }

  const units: FamilyUnit[] = [];
  for (const r of graph.roots) {
    if (pairedOther.has(r.id)) continue; // rendered via anchor or birth family
    const u = unitFor(r);
    if (u) units.push(u);
  }

  if (opts?.dockInLaws) dockInLawParents(units, birthRef);
  return units;
}

/** Detach a unit from the top-level roots or from a nested parent. */
function detachUnit(roots: FamilyUnit[], target: FamilyUnit): boolean {
  const ri = roots.indexOf(target);
  if (ri >= 0) {
    roots.splice(ri, 1);
    return true;
  }
  const stack = [...roots];
  while (stack.length > 0) {
    const u = stack.pop()!;
    const ci = u.children.indexOf(target);
    if (ci >= 0) {
      u.children.splice(ci, 1);
      return true;
    }
    stack.push(...u.children);
  }
  return false;
}

function containsPerson(root: FamilyUnit, id: string): boolean {
  return (
    root.main.id === id ||
    root.pair?.id === id ||
    root.children.some((c) => containsPerson(c, id))
  );
}

/**
 * Dock in-law parents above the couple: for a couple whose pair has parents
 * in the tree, the pair's parents' unit is removed from its own position
 * and attached as `inLaw`, rendered directly above the couple (right-
 * aligned over the pair's card). Only when unambiguous — the parents' unit
 * must be a top-level root with exactly one ref child — otherwise the d/o·
 * s/o caption fallback covers it. Pure w.r.t. React rendering (runs inside
 * buildFamilyUnits' single pass).
 */
function dockInLawParents(units: FamilyUnit[], birthRef: Set<string>) {
  const all: FamilyUnit[] = [];
  const walkAll = (u: FamilyUnit) => {
    all.push(u);
    u.children.forEach(walkAll);
  };
  units.forEach(walkAll);

  const docked = new Set<FamilyUnit>();
  for (const u of all) {
    if (!u.pair || !birthRef.has(u.pair.id) || u.inLaw) continue;
    // The parents' unit: the one holding this pair as a ref child.
    const P = all.find(
      (p) =>
        p !== u && p.children.some((c) => c.ref && c.main.id === u.pair!.id)
    );
    if (!P || docked.has(P)) continue;
    if (!units.includes(P)) continue; // top-level roots only
    if (P.children.filter((c) => c.ref).length !== 1) continue;
    if (containsPerson(P, u.main.id)) continue; // cycle guard
    u.inLaw = P;
    docked.add(P);
    detachUnit(units, P);
    // The ref card is superseded by the docked unit — drop it here. (The
    // outline view builds a separate plan without docking, unaffected.)
    P.children = P.children.filter((c) => !c.ref);
  }
}

/** Birth-family jump info for paired-away partners: personId -> their
 *  parents' unit key + display label. Powers the "d/o · s/o" caption under
 *  the card that jumps the canvas to the birth family. Pure. */
export function inLawCaptions(
  units: FamilyUnit[]
): Map<string, { unitKey: string; label: string }> {
  const out = new Map<string, { unitKey: string; label: string }>();
  const name = (p: Person) =>
    `${p.given_name}${p.family_name ? " " + p.family_name : ""}`;
  const walk = (u: FamilyUnit) => {
    if (u.inLaw) walk(u.inLaw);
    for (const c of u.children) {
      if (c.ref) {
        const parents = [u.main, u.pair].filter(Boolean) as Person[];
        out.set(c.main.id, {
          unitKey: u.main.id,
          label: parents.map(name).join(" & "),
        });
      }
      walk(c);
    }
  };
  units.forEach(walk);
  return out;
}
