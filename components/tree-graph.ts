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
 *  couple renders at the anchor's position. Each root unit is its own
 *  forest on the canvas; forests are never merged, so every connector
 *  line means exactly what it says. */
export interface FamilyUnit {
  main: Person;
  pair?: Person;
  spouseNote?: Person;
  children: FamilyUnit[];
  ref?: boolean;
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
  spouses: SpouseLink[]
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
  return units;
}

/* ======================================================================
 * Single-tree graph layout (pedigree view).
 *
 * The nested-list renderer could never draw one connected tree truthfully:
 * a couple nests inside exactly one family's box, so a second family's
 * lines either duplicated a card or landed on the wrong person. This
 * layout instead computes a position for every family unit (one box per
 * person, nobody duplicated) and returns each parent->child link as
 * independent line geometry the view draws in SVG. Lines may cross; they
 * never join falsely and never land on the wrong card.
 *
 * Method: lay out the biggest descendant tree (the backbone) with the
 * classic bottom-up subtree-width algorithm, then graft the remaining
 * units in waves — parent units of placed people go one generation up,
 * centered over the child they connect to (shifted sideways only until
 * their box clears its generation row); leftover children of placed
 * units (e.g. a wife's brother) are placed beside their sibling's unit.
 * Wholly separate families, if any, are laid out to the right.
 * ==================================================================== */

export const CARD_W = 192; // MemberCard is w-48
export const CARD_H = 58;
export const JUNCTION_W = 30; // gap between a couple's two cards
export const ROW_H = 150; // generation row: card + connector band
const H_GAP = 40; // min horizontal gap between unit boxes in a row
const FOREST_GAP = 90; // gap between disconnected families

export type LineSide = "husband" | "wife" | "shared";

export interface PlacedUnit {
  key: string;
  main: Person;
  pair?: Person;
  /** Spouse who ended up paired into another unit (annotation only). */
  spouseNote?: Person;
  x: number;
  y: number;
  gen: number;
}

export interface ForkLine {
  parentKey: string;
  /** Side of the focal couple this descent belongs to (line color). */
  side: LineSide;
  stemX: number;
  stemTop: number;
  barY: number;
  barX0: number;
  barX1: number;
  drops: { personId: string; x: number; top: number }[];
}

export interface TreeLayout {
  units: PlacedUnit[];
  forks: ForkLine[];
  width: number;
  height: number;
}

const unitW = (pair?: Person) => (pair ? CARD_W * 2 + JUNCTION_W : CARD_W);

export function layoutSingleTree(
  persons: Person[],
  spouses: SpouseLink[]
): TreeLayout {
  const graph = buildTreeGraph(persons, spouses);

  // Pairing — identical rule to buildFamilyUnits: the partner with
  // parents in the tree anchors the couple; ties go to first in order.
  const pairOf = new Map<string, string>();
  const paired = new Set<string>();
  for (const p of persons) {
    if (paired.has(p.id)) continue;
    const sId = graph.partnerOf.get(p.id);
    if (!sId || paired.has(sId)) continue;
    const s = graph.byId.get(sId);
    if (!s) continue;
    const anchor =
      graph.hasParents.has(s.id) && !graph.hasParents.has(p.id) ? s : p;
    const other = anchor === p ? s : p;
    pairOf.set(anchor.id, other.id);
    paired.add(p.id);
    paired.add(s.id);
  }

  interface U {
    main: Person;
    pair?: Person;
    spouseNote?: Person;
  }
  const unitOf = new Map<string, U>();
  const unitOfPerson = new Map<string, string>();
  pairOf.forEach((otherId, anchorId) => {
    const main = graph.byId.get(anchorId)!;
    const pair = graph.byId.get(otherId)!;
    unitOf.set(anchorId, { main, pair });
    unitOfPerson.set(anchorId, anchorId);
    unitOfPerson.set(otherId, anchorId);
  });
  for (const p of persons) {
    if (unitOfPerson.has(p.id)) continue;
    const u: U = { main: p };
    const sId = graph.partnerOf.get(p.id);
    if (sId && graph.byId.has(sId)) u.spouseNote = graph.byId.get(sId);
    unitOf.set(p.id, u);
    unitOfPerson.set(p.id, p.id);
  }

  const membersOf = (key: string): Person[] => {
    const u = unitOf.get(key)!;
    return u.pair ? [u.main, u.pair] : [u.main];
  };

  /** Persons whose father or mother is a member of this unit. */
  const childPersonsOf = (key: string): Person[] => {
    const out: Person[] = [];
    for (const m of membersOf(key)) {
      for (const c of graph.childrenOf.get(m.id) ?? []) {
        if (!out.some((o) => o.id === c.id)) out.push(c);
      }
    }
    return out;
  };

  /** Child units hosted here: the child anchors their own unit. */
  const hostedChildUnits = (key: string): string[] =>
    childPersonsOf(key)
      .filter((c) => unitOfPerson.get(c.id) === c.id)
      .map((c) => c.id);

  /** The unit a person's descent line comes from: father's unit first. */
  const parentUnitOf = (p: Person): string | null => {
    for (const par of [p.father_id, p.mother_id]) {
      if (par && graph.byId.has(par)) return unitOfPerson.get(par)!;
    }
    return null;
  };

  const descendantCount = (key: string, seen = new Set<string>()): number => {
    if (seen.has(key)) return 0;
    seen.add(key);
    let n = 0;
    for (const cu of hostedChildUnits(key)) n += 1 + descendantCount(cu, seen);
    return n;
  };

  // ---- placement state -------------------------------------------------
  const genOf = new Map<string, number>();
  const xOf = new Map<string, number>();
  const rows = new Map<number, [number, number][]>();
  const occupy = (g: number, x0: number, x1: number) => {
    const r = rows.get(g) ?? [];
    r.push([x0, x1]);
    rows.set(g, r);
  };
  const fits = (g: number, x0: number, x1: number) =>
    (rows.get(g) ?? []).every(([a, b]) => x1 + 12 <= a || x0 >= b + 12);
  const shiftToFit = (g: number, desiredCenter: number, w: number) => {
    const base = desiredCenter - w / 2;
    if (fits(g, base, base + w)) return base;
    for (let d = 16; d < 6000; d += 16) {
      for (const cand of [base + d, base - d]) {
        if (cand >= 0 && fits(g, cand, cand + w)) return cand;
      }
    }
    return Math.max(0, base);
  };
  const cardCenterX = (pid: string): number => {
    const key = unitOfPerson.get(pid)!;
    const u = unitOf.get(key)!;
    const x = xOf.get(key)!;
    return u.pair && u.main.id !== pid
      ? x + CARD_W + JUNCTION_W + CARD_W / 2
      : x + CARD_W / 2;
  };
  const placedPersons = new Set<string>();
  const markPlaced = (key: string) => {
    for (const m of membersOf(key)) placedPersons.add(m.id);
  };

  // ---- backbone measurement ---------------------------------------------
  const spanOf = new Map<string, number>();
  const measure = (key: string, seen = new Set<string>()): number => {
    if (spanOf.has(key)) return spanOf.get(key)!;
    if (seen.has(key)) return unitW(unitOf.get(key)!.pair);
    seen.add(key);
    const kids = hostedChildUnits(key);
    let w = unitW(unitOf.get(key)!.pair);
    if (kids.length > 0) {
      w = Math.max(
        w,
        kids.reduce((s, k) => s + measure(k, seen), 0) +
          H_GAP * (kids.length - 1)
      );
    }
    spanOf.set(key, w);
    return w;
  };
  const placeBackbone = (key: string, left: number, g: number) => {
    genOf.set(key, g);
    const w = unitW(unitOf.get(key)!.pair);
    const boxLeft = left + (measure(key) - w) / 2;
    xOf.set(key, boxLeft);
    occupy(g, boxLeft, boxLeft + w);
    markPlaced(key);
    let x = left;
    for (const cu of hostedChildUnits(key)) {
      placeBackbone(cu, x, g + 1);
      x += measure(cu) + H_GAP;
    }
  };

  const isRootUnit = (key: string) =>
    membersOf(key).every((m) => !graph.hasParents.has(m.id));

  const placeForest = (rootKey: string, xBase: number) => {
    placeBackbone(rootKey, xBase, 0);
    // Graft waves: parents of placed people above them, leftover
    // children of placed units beside the family they belong to.
    let changed = true;
    while (changed) {
      changed = false;
      for (const pid of Array.from(placedPersons)) {
        const p = graph.byId.get(pid)!;
        const pu = parentUnitOf(p);
        if (pu && !xOf.has(pu)) {
          const g = genOf.get(unitOfPerson.get(pid)!)! - 1;
          const w = unitW(unitOf.get(pu)!.pair);
          const left = shiftToFit(g, cardCenterX(pid), w);
          xOf.set(pu, left);
          genOf.set(pu, g);
          occupy(g, left, left + w);
          markPlaced(pu);
          changed = true;
        }
      }
      for (const key of Array.from(xOf.keys())) {
        for (const c of childPersonsOf(key)) {
          if (placedPersons.has(c.id)) continue;
          const cu = unitOfPerson.get(c.id)!;
          if (xOf.has(cu)) continue;
          const g = genOf.get(key)! + 1;
          const parent =
            c.father_id && membersOf(key).some((m) => m.id === c.father_id)
              ? c.father_id
              : c.mother_id!;
          const left = shiftToFit(
            g,
            cardCenterX(parent) + CARD_W + 140,
            measure(cu)
          );
          placeBackbone(cu, left, g);
          changed = true;
        }
      }
    }
  };

  // Backbone first: the root unit with the largest descendant tree.
  const roots = Array.from(unitOf.keys()).filter(isRootUnit);
  const bySize = [...roots].sort(
    (a, b) => descendantCount(b) - descendantCount(a)
  );
  let cursorX = 0;
  for (const r of bySize) {
    if (xOf.has(r)) continue;
    placeForest(r, cursorX);
    const placedWidth = Math.max(
      ...Array.from(xOf.entries()).map(
        ([k, x]) => x + unitW(unitOf.get(k)!.pair)
      ),
      0
    );
    cursorX = placedWidth + FOREST_GAP;
  }
  // Defensive: anything still unplaced (shouldn't happen) goes right.
  Array.from(unitOf.keys()).forEach((key) => {
    if (!xOf.has(key)) {
      placeForest(key, cursorX);
      cursorX += measure(key) + FOREST_GAP;
    }
  });

  // ---- focal couple + line sides -----------------------------------------
  const ancestorsOf = (pid: string): Set<string> => {
    const out = new Set<string>();
    const stack = [pid];
    while (stack.length > 0) {
      const cur = graph.byId.get(stack.pop()!)!;
      for (const par of [cur.father_id, cur.mother_id]) {
        if (par && graph.byId.has(par) && !out.has(par)) {
          out.add(par);
          stack.push(par);
        }
      }
    }
    return out;
  };
  const findFocal = (): { husband: Person; wife: Person } | null => {
    let best: { husband: Person; wife: Person } | null = null;
    let bestGen = -1;
    unitOf.forEach((u, key) => {
      if (!u.pair) return;
      if (!graph.hasParents.has(u.main.id) || !graph.hasParents.has(u.pair.id))
        return;
      const g = genOf.get(key) ?? 0;
      if (g > bestGen) {
        bestGen = g;
        const husband =
          u.main.gender === "male" && u.pair.gender !== "male"
            ? u.main
            : u.pair.gender === "male" && u.main.gender !== "male"
              ? u.pair
              : u.main;
        best = { husband, wife: husband === u.main ? u.pair : u.main };
      }
    });
    return best;
  };
  const focal = findFocal();
  const husbandSide = new Set<string>();
  const wifeSide = new Set<string>();
  if (focal) {
    husbandSide.add(focal.husband.id);
    ancestorsOf(focal.husband.id).forEach((id) => husbandSide.add(id));
    wifeSide.add(focal.wife.id);
    ancestorsOf(focal.wife.id).forEach((id) => wifeSide.add(id));
  }
  const sideOfUnit = (key: string): LineSide => {
    const ms = membersOf(key);
    if (ms.every((m) => husbandSide.has(m.id))) return "husband";
    if (ms.every((m) => wifeSide.has(m.id))) return "wife";
    return "shared";
  };

  // ---- forks ---------------------------------------------------------------
  const forks: ForkLine[] = [];
  const byParent = new Map<string, Person[]>();
  for (const p of persons) {
    if (!xOf.has(unitOfPerson.get(p.id)!)) continue;
    const pu = parentUnitOf(p);
    if (!pu || !xOf.has(pu)) continue;
    const list = byParent.get(pu) ?? [];
    list.push(p);
    byParent.set(pu, list);
  }
  byParent.forEach((kids, pu) => {
    const g = genOf.get(pu)!;
    const bandTop = (g + 1) * ROW_H - (ROW_H - CARD_H);
    const stemX =
      xOf.get(pu)! +
      (unitOf.get(pu)!.pair ? CARD_W + JUNCTION_W / 2 : CARD_W / 2);
    const drops = kids.map((c) => ({
      personId: c.id,
      x: cardCenterX(c.id),
      top: (g + 1) * ROW_H,
    }));
    const xs = [stemX, ...drops.map((dr) => dr.x)];
    forks.push({
      parentKey: pu,
      side: sideOfUnit(pu),
      stemX,
      stemTop: g * ROW_H + CARD_H,
      barY: bandTop + 12, // lane adjusted below
      barX0: Math.min(...xs),
      barX1: Math.max(...xs),
      drops,
    });
  });
  // Lane staggering within each band: overlapping bars get separate lanes
  // so two families' lines read as parallel tracks, never one merged line.
  const bands = new Map<number, ForkLine[]>();
  for (const f of forks) {
    const g = genOf.get(f.parentKey)!;
    const list = bands.get(g) ?? [];
    list.push(f);
    bands.set(g, list);
  }
  bands.forEach((list, g) => {
    const bandTop = (g + 1) * ROW_H - (ROW_H - CARD_H);
    const lanes: [number, number, number][] = [];
    for (const f of [...list].sort((a, b) => a.barX0 - b.barX0)) {
      const used = new Set(
        lanes
          .filter(([, a, b]) => !(f.barX1 < a || f.barX0 > b))
          .map(([li]) => li)
      );
      let li = 0;
      while (used.has(li)) li++;
      lanes.push([li, f.barX0, f.barX1]);
      f.barY = bandTop + 12 + li * 10;
    }
  });

  const units: PlacedUnit[] = Array.from(unitOf.entries()).map(([key, u]) => ({
    key,
    main: u.main,
    pair: u.pair,
    spouseNote: u.spouseNote,
    x: xOf.get(key) ?? 0,
    y: (genOf.get(key) ?? 0) * ROW_H,
    gen: genOf.get(key) ?? 0,
  }));
  const width =
    Math.max(...units.map((u) => u.x + unitW(u.pair)), 0) + 8;
  const height = (Math.max(...units.map((u) => u.gen), 0) + 1) * ROW_H + 8;
  return { units, forks, width, height };
}
