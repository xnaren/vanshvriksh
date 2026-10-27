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

export type LineStyle = "solid" | "dash" | "dot";

export interface ForkLine {
  parentKey: string;
  /** Color of the stem + bar: the drops' color when they agree, else
   *  "shared". Each drop carries its own side color. */
  side: LineSide;
  /** Stroke pattern by generation band, cycling solid -> dash -> dot
   *  with distance from the focal (current) generation, so overlapping
   *  lines from different generations stay distinguishable. */
  style: LineStyle;
  stemX: number;
  stemTop: number;
  barY: number;
  barX0: number;
  barX1: number;
  drops: { personId: string; x: number; top: number; side: LineSide }[];
}

export interface TreeLayout {
  units: PlacedUnit[];
  forks: ForkLine[];
  width: number;
  height: number;
}

const unitW = (pair?: Person) => (pair ? CARD_W * 2 + JUNCTION_W : CARD_W);

export interface SingleTreeOptions {
  cardW?: number;
  cardH?: number;
  junctionW?: number;
  rowH?: number;
  hGap?: number;
}

export function layoutSingleTree(
  persons: Person[],
  spouses: SpouseLink[],
  options: SingleTreeOptions = {}
): TreeLayout {
  const cw = options.cardW ?? CARD_W;
  const ch = options.cardH ?? CARD_H;
  const junctionW = options.junctionW ?? JUNCTION_W;
  const rowH = options.rowH ?? ROW_H;
  const hGap = options.hGap ?? H_GAP;
  const unitWLocal = (pair?: Person) =>
    pair ? cw * 2 + junctionW : cw;
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

  // Couple card order: the husband's card goes on the left, the
  // wife's on the right — the anchor (whose birth family hosts the
  // couple) is unchanged, only the two cards swap slots. Sibling
  // order (sisters left of brothers) is applied in childPersonsOf.
  unitOf.forEach((u) => {
    if (!u.pair) return;
    const husband =
      u.main.gender === "male" && u.pair.gender !== "male"
        ? u.main
        : u.pair.gender === "male" && u.main.gender !== "male"
          ? u.pair
          : null;
    if (husband && husband === u.pair) {
      const t = u.main;
      u.main = u.pair;
      u.pair = t;
    }
  });

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
    // Sisters to the left of brothers (stable within each group, so
    // birth/tree order is kept among sisters and among brothers).
    const rank = (p: Person) =>
      p.gender === "female" ? 0 : p.gender === "male" ? 2 : 1;
    out.sort((a, b) => rank(a) - rank(b));
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
      ? x + cw + junctionW + cw / 2
      : x + cw / 2;
  };
  const placedPersons = new Set<string>();
  const markPlaced = (key: string) => {
    for (const m of membersOf(key)) placedPersons.add(m.id);
  };

  // ---- backbone measurement ---------------------------------------------
  const spanOf = new Map<string, number>();
  const measure = (key: string, seen = new Set<string>()): number => {
    if (spanOf.has(key)) return spanOf.get(key)!;
    if (seen.has(key)) return unitWLocal(unitOf.get(key)!.pair);
    seen.add(key);
    const kids = hostedChildUnits(key);
    let w = unitWLocal(unitOf.get(key)!.pair);
    if (kids.length > 0) {
      w = Math.max(
        w,
        kids.reduce((s, k) => s + measure(k, seen), 0) +
          hGap * (kids.length - 1)
      );
    }
    spanOf.set(key, w);
    return w;
  };
  const placeBackbone = (key: string, left: number, g: number) => {
    genOf.set(key, g);
    const w = unitWLocal(unitOf.get(key)!.pair);
    const boxLeft = left + (measure(key) - w) / 2;
    xOf.set(key, boxLeft);
    occupy(g, boxLeft, boxLeft + w);
    markPlaced(key);
    let x = left;
    for (const cu of hostedChildUnits(key)) {
      placeBackbone(cu, x, g + 1);
      x += measure(cu) + hGap;
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
          const w = unitWLocal(unitOf.get(pu)!.pair);
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
            cardCenterX(parent) + cw + 140,
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
        ([k, x]) => x + unitWLocal(unitOf.get(k)!.pair)
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
  /** The husband of a couple unit: the male partner when exactly one
   *  partner is male, otherwise the anchor (main). */
  const husbandOf = (key: string): Person => {
    const u = unitOf.get(key)!;
    if (!u.pair) return u.main;
    if (u.main.gender === "male" && u.pair.gender !== "male") return u.main;
    if (u.pair.gender === "male" && u.main.gender !== "male") return u.pair;
    return u.main;
  };

  const findFocal = (): { husband: Person; wife: Person; gen: number } | null => {
    let best: { husband: Person; wife: Person; gen: number } | null = null;
    let bestGen = -1;
    unitOf.forEach((u, key) => {
      if (!u.pair) return;
      if (!graph.hasParents.has(u.main.id) || !graph.hasParents.has(u.pair.id))
        return;
      const g = genOf.get(key) ?? 0;
      if (g > bestGen) {
        bestGen = g;
        const husband = husbandOf(key);
        best = { husband, wife: husband === u.main ? u.pair : u.main, gen: g };
      }
    });
    return best;
  };
  const focal = findFocal();

  // Anchor generation for line styles: the focal (current) couple's
  // generation; without a focal couple, the deepest couple's.
  let anchorGen = 0;
  if (focal) {
    anchorGen = focal.gen;
  } else {
    unitOf.forEach((u, key) => {
      if (u.pair) anchorGen = Math.max(anchorGen, genOf.get(key) ?? 0);
    });
  }
  const husbandSide = new Set<string>();
  const wifeSide = new Set<string>();
  if (focal) {
    husbandSide.add(focal.husband.id);
    ancestorsOf(focal.husband.id).forEach((id) => husbandSide.add(id));
    wifeSide.add(focal.wife.id);
    ancestorsOf(focal.wife.id).forEach((id) => wifeSide.add(id));
  }
  /** A person's role in their own couple, if they have one in the
   *  tree: "husband" (blue line) or "wife" (orange line). */
  const roleInCouple = (pid: string): LineSide | null => {
    const key = unitOfPerson.get(pid)!;
    if (!unitOf.get(key)!.pair) return null;
    return husbandOf(key).id === pid ? "husband" : "wife";
  };

  /** Color of the line dropping TO a person from their parents: their
   *  role in their own couple. A person with no couple inherits a
   *  coupled sibling's role (a brother stands in his sister's family
   *  color); failing that, the focal couple's side sets decide;
   *  anything else is shared. */
  const dropSide = (p: Person): LineSide => {
    const own = roleInCouple(p.id);
    if (own) return own;
    for (const sib of persons) {
      if (sib.id === p.id) continue;
      const sharesParent =
        (p.father_id !== null && sib.father_id === p.father_id) ||
        (p.mother_id !== null && sib.mother_id === p.mother_id) ||
        (p.father_id !== null && sib.mother_id === p.father_id) ||
        (p.mother_id !== null && sib.father_id === p.mother_id);
      if (!sharesParent) continue;
      const sibRole = roleInCouple(sib.id);
      if (sibRole) return sibRole;
    }
    if (husbandSide.has(p.id)) return "husband";
    if (wifeSide.has(p.id)) return "wife";
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
    const bandTop = (g + 1) * rowH - (rowH - ch);
    const stemX =
      xOf.get(pu)! +
      (unitOf.get(pu)!.pair ? cw + junctionW / 2 : cw / 2);
    const drops = kids.map((c) => ({
      personId: c.id,
      x: cardCenterX(c.id),
      top: (g + 1) * rowH,
      side: dropSide(c),
    }));
    drops.sort((a, b) => a.x - b.x); // canonical: left to right
    const xs = [stemX, ...drops.map((dr) => dr.x)];
    const forkSide: LineSide =
      drops.length > 0 && drops.every((dr) => dr.side === drops[0].side)
        ? drops[0].side
        : "shared";
    // Generation band style: bands touching the current generation are
    // solid; each band further out (up or down) steps dash, dot, then
    // the cycle repeats.
    const childGen = g + 1;
    const dist =
      childGen <= anchorGen
        ? anchorGen - childGen
        : childGen - anchorGen - 1;
    const style: LineStyle = (["solid", "dash", "dot"] as const)[dist % 3];
    forks.push({
      parentKey: pu,
      side: forkSide,
      style,
      stemX,
      stemTop: g * rowH + ch,
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
    const bandTop = (g + 1) * rowH - (rowH - ch);
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
    y: (genOf.get(key) ?? 0) * rowH,
    gen: genOf.get(key) ?? 0,
  }));
  const width =
    Math.max(...units.map((u) => u.x + unitWLocal(u.pair)), 0) + 8;
  const height = (Math.max(...units.map((u) => u.gen), 0) + 1) * rowH + 8;
  return { units, forks, width, height };
}

/* ---------- Horizontal ancestor chart (Gramps-style) ----------
 * One focus person at the left; ancestors unfold to the right —
 * father above mother at every step. A collapsed node hides its
 * ancestors (chevron toggle in the view). The same ancestor reached
 * by two paths is drawn twice (a tree unfolding, like Gramps).
 * Edge color follows the parent: blue to a father, orange to a
 * mother — the same role colors as the pedigree drops. Edge style
 * cycles solid -> dash -> dot by distance from the focus person. */

export const ANCESTOR_ROW_H = 84; // vertical slot per leaf line
export const ANCESTOR_COL_W = CARD_W + 56; // depth step: card + elbow gap

export interface AncestorNode {
  person: Person;
  depth: number; // 0 = focus person
  x: number;
  y: number;
  hasParents: boolean;
  collapsed: boolean;
}

export interface AncestorEdge {
  childId: string;
  parentId: string;
  role: "father" | "mother";
  style: LineStyle;
  x1: number;
  y1: number;
  midX: number;
  x2: number;
  y2: number;
}

export interface AncestorChartLayout {
  nodes: AncestorNode[];
  edges: AncestorEdge[];
  width: number;
  height: number;
}

export function layoutAncestorChart(
  persons: Person[],
  focusId: string,
  collapsed: ReadonlySet<string>
): AncestorChartLayout {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const focus = byId.get(focusId);
  const nodes: AncestorNode[] = [];
  const edges: AncestorEdge[] = [];
  if (!focus) return { nodes, edges, width: 0, height: 0 };

  const parentOf = (
    p: Person,
    role: "father" | "mother"
  ): Person | undefined => {
    const id = role === "father" ? p.father_id : p.mother_id;
    return id ? byId.get(id) : undefined;
  };

  const STYLES: LineStyle[] = ["solid", "dash", "dot"];
  let cursor = 0; // next free leaf row

  const place = (p: Person, depth: number, seen: Set<string>): AncestorNode => {
    const father = parentOf(p, "father");
    const mother = parentOf(p, "mother");
    const hasParents = Boolean(father || mother);
    const isCollapsed = collapsed.has(p.id);
    const node: AncestorNode = {
      person: p,
      depth,
      x: depth * ANCESTOR_COL_W,
      y: 0,
      hasParents,
      collapsed: isCollapsed,
    };
    nodes.push(node);
    if (!hasParents || isCollapsed || seen.has(p.id)) {
      node.y = cursor * ANCESTOR_ROW_H;
      cursor += 1;
      return node;
    }
    const nextSeen = new Set<string>(Array.from(seen));
    nextSeen.add(p.id);
    const placed: AncestorNode[] = [];
    const roles: ("father" | "mother")[] = ["father", "mother"];
    for (const role of roles) {
      const parent = role === "father" ? father : mother;
      if (!parent) continue;
      placed.push(place(parent, depth + 1, nextSeen));
      edges.push({
        childId: p.id,
        parentId: parent.id,
        role,
        style: STYLES[depth % 3],
        x1: 0,
        y1: 0,
        midX: 0,
        x2: 0,
        y2: 0,
      });
    }
    node.y = (placed[0].y + placed[placed.length - 1].y) / 2;
    return node;
  };

  place(focus, 0, new Set<string>());

  const nodeOf = new Map(nodes.map((n) => [n.person.id, n]));
  for (const e of edges) {
    const c = nodeOf.get(e.childId)!;
    const par = nodeOf.get(e.parentId)!;
    e.x1 = c.x + CARD_W;
    e.y1 = c.y + CARD_H / 2;
    e.x2 = par.x;
    e.y2 = par.y + CARD_H / 2;
    e.midX = c.x + CARD_W + (ANCESTOR_COL_W - CARD_W) / 2;
  }

  const width = Math.max(...nodes.map((n) => n.x + CARD_W), 0) + 8;
  const height = cursor * ANCESTOR_ROW_H + 8;
  return { nodes, edges, width, height };
}

/** The person with the most recorded ancestors (ties: first in tree
 *  order) — the natural default focus for the ancestor chart. */
export function defaultAncestorFocus(persons: Person[]): Person | null {
  if (persons.length === 0) return null;
  const byId = new Map(persons.map((p) => [p.id, p]));
  const countAncestors = (p: Person): number => {
    const seen = new Set<string>();
    const stack: Person[] = [p];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const parents = [cur.father_id, cur.mother_id];
      for (const pid of parents) {
        const par = pid ? byId.get(pid) : undefined;
        if (par && !seen.has(par.id)) {
          seen.add(par.id);
          stack.push(par);
        }
      }
    }
    return seen.size;
  };
  let best = persons[0];
  let bestCount = -1;
  for (const p of persons) {
    const c = countAncestors(p);
    if (c > bestCount) {
      best = p;
      bestCount = c;
    }
  }
  return best;
}

/* ======================================================================
 * Fan chart layout (radial view).
 *
 * The focus person sits at the center; ancestors occupy annular
 * segments in rings around them — parents in ring 1, grandparents in
 * ring 2, and so on. The father's half of the circle is the left half,
 * the mother's the right half; within any person's span, their father's
 * sub-span is always the half nearer the top (north), their mother's
 * the half nearer the bottom. Angles are degrees in screen coords
 * (0 = east, increasing clockwise, so 90 = south, 270 = north).
 * Missing ancestors simply leave their arc empty — geometry stays
 * truthful. Ancestors only: no spouses, siblings, or descendants.
 * ==================================================================== */

export interface FanSegment {
  person: Person;
  depth: number; // 1 = parents' ring
  startAngle: number;
  endAngle: number;
  side: "father" | "mother";
}

export interface FanLayout {
  focus: Person;
  segments: FanSegment[];
  maxDepth: number; // deepest ring that has anyone in it
}

export function layoutFanChart(
  persons: Person[],
  focusId: string,
  maxDepth = 5
): FanLayout | null {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const focus = byId.get(focusId);
  if (!focus) return null;
  const segments: FanSegment[] = [];
  let deepest = 0;

  // Angular distance from an angle to north (270).
  const northDist = (a: number) => {
    const d = Math.abs(((a - 270) % 360 + 360) % 360);
    return Math.min(d, 360 - d);
  };

  const walk = (
    p: Person,
    depth: number,
    a0: number,
    a1: number,
    side: "father" | "mother"
  ) => {
    if (depth > maxDepth) return;
    const mid = (a0 + a1) / 2;
    // Father takes the half nearer north; mother the other half.
    const fatherSpan: [number, number] =
      northDist((a0 + mid) / 2) <= northDist((mid + a1) / 2)
        ? [a0, mid]
        : [mid, a1];
    const motherSpan: [number, number] =
      fatherSpan[0] === a0 && fatherSpan[1] === mid ? [mid, a1] : [a0, mid];
    const father = p.father_id ? byId.get(p.father_id) : undefined;
    const mother = p.mother_id ? byId.get(p.mother_id) : undefined;
    if (father) {
      segments.push({
        person: father,
        depth,
        startAngle: fatherSpan[0],
        endAngle: fatherSpan[1],
        side,
      });
      deepest = Math.max(deepest, depth);
      walk(father, depth + 1, fatherSpan[0], fatherSpan[1], side);
    }
    if (mother) {
      segments.push({
        person: mother,
        depth,
        startAngle: motherSpan[0],
        endAngle: motherSpan[1],
        side,
      });
      deepest = Math.max(deepest, depth);
      walk(mother, depth + 1, motherSpan[0], motherSpan[1], side);
    }
  };

  // Father's branch: the left half [90, 270]; mother's: [270, 450].
  if (focus.father_id && byId.has(focus.father_id)) {
    const f = byId.get(focus.father_id)!;
    segments.push({ person: f, depth: 1, startAngle: 90, endAngle: 270, side: "father" });
    deepest = 1;
    walk(f, 2, 90, 270, "father");
  }
  if (focus.mother_id && byId.has(focus.mother_id)) {
    const m = byId.get(focus.mother_id)!;
    segments.push({ person: m, depth: 1, startAngle: 270, endAngle: 450, side: "mother" });
    deepest = Math.max(deepest, 1);
    walk(m, 2, 270, 450, "mother");
  }
  return { focus, segments, maxDepth: deepest };
}

/* ======================================================================
 * Hourglass layout.
 *
 * Focus couple at generation 0. Ancestors of the focus person rise
 * above (each parent couple centered over the child it connects to,
 * father's side left, mother's side right); descendants fall below
 * (classic tidy descendant tree of the focus couple). Cards and fork
 * geometry reuse the pedigree view's shapes, so MemberCard and the
 * fork renderer work unchanged.
 * ==================================================================== */

export interface HourglassLayout {
  units: PlacedUnit[];
  forks: ForkLine[];
  width: number;
  height: number;
  focusKey: string;
}

export function layoutHourglass(
  persons: Person[],
  spouses: SpouseLink[],
  focusId: string,
  maxUp = 4,
  maxDown = 4
): HourglassLayout | null {
  const graph = buildTreeGraph(persons, spouses);
  const focus = graph.byId.get(focusId);
  if (!focus) return null;

  interface HU {
    key: string;
    main: Person;
    pair?: Person;
  }
  const units = new Map<string, HU>();
  const addCouple = (a: Person, b?: Person): string => {
    // Husband-left ordering, as in the pedigree view.
    let main = a;
    let pair = b;
    if (pair && pair.gender === "male" && main.gender !== "male") {
      main = pair;
      pair = a;
    }
    const key = main.id;
    if (!units.has(key)) units.set(key, { key, main, pair });
    return key;
  };
  const spouseOf = (p: Person): Person | undefined => {
    const sId = graph.partnerOf.get(p.id);
    return sId ? graph.byId.get(sId) : undefined;
  };

  // ---- descendants ------------------------------------------------------
  const downChildren = (u: HU): Person[] => {
    // Children hosted here come through a member of this couple; a
    // child with both parents recorded belongs to the couple matching
    // both, otherwise to the recorded parent's couple. Dedupe by id,
    // sisters first (the pedigree sibling rule).
    const memberIds = new Set([u.main.id, u.pair?.id].filter(Boolean) as string[]);
    const out: Person[] = [];
    for (const m of [u.main, u.pair]) {
      if (!m) continue;
      for (const c of graph.childrenOf.get(m.id) ?? []) {
        if (out.some((o) => o.id === c.id)) continue;
        const otherParent =
          c.father_id === m.id ? c.mother_id : c.father_id;
        if (otherParent && graph.byId.has(otherParent) && !memberIds.has(otherParent)) {
          // The child's other parent is someone else — the child
          // belongs to this couple only if that other parent is not
          // part of any couple in this hourglass' bloodline path;
          // simplest truthful rule: host here only when the other
          // parent is this member's recorded partner or unrecorded.
          const partner = spouseOf(m);
          if (partner && partner.id !== otherParent) continue;
        }
        out.push(c);
      }
    }
    const rank = (p: Person) =>
      p.gender === "female" ? 0 : p.gender === "male" ? 2 : 1;
    out.sort((a, b) => rank(a) - rank(b));
    return out;
  };
  const downUnitOf = (child: Person): string =>
    addCouple(child, spouseOf(child));

  const downSpan = new Map<string, number>();
  const measureDown = (key: string, depth: number, seen: Set<string>): number => {
    if (downSpan.has(key)) return downSpan.get(key)!;
    if (seen.has(key) || depth > maxDown) return unitW(units.get(key)!.pair);
    seen.add(key);
    const u = units.get(key)!;
    let w = unitW(u.pair);
    if (depth < maxDown) {
      const kidUnits = downChildren(u).map((c) => downUnitOf(c));
      if (kidUnits.length > 0) {
        w = Math.max(
          w,
          kidUnits.reduce((s, k) => s + measureDown(k, depth + 1, seen), 0) +
            H_GAP * (kidUnits.length - 1)
        );
      }
    }
    downSpan.set(key, w);
    return w;
  };

  const pos = new Map<string, { x: number; gen: number }>();
  const placeDown = (key: string, left: number, gen: number, seen: Set<string>) => {
    if (seen.has(key)) return;
    seen.add(key);
    const u = units.get(key)!;
    const w = unitW(u.pair);
    pos.set(key, { x: left + (measureDown(key, gen, new Set()) - w) / 2, gen });
    if (gen >= maxDown) return;
    let x = left;
    for (const c of downChildren(u)) {
      const ck = downUnitOf(c);
      placeDown(ck, x, gen + 1, seen);
      x += measureDown(ck, gen + 1, new Set()) + H_GAP;
    }
  };

  // ---- ancestors ----------------------------------------------------------
  interface UpNode {
    father?: Person;
    mother?: Person;
    key: string; // couple key (husband-left main id, or the solo parent's id)
  }
  const upCoupleOf = (p: Person): UpNode | null => {
    const father = p.father_id ? graph.byId.get(p.father_id) : undefined;
    const mother = p.mother_id ? graph.byId.get(p.mother_id) : undefined;
    if (!father && !mother) return null;
    const key = addCouple(father ?? mother!, father && mother ? mother : undefined);
    return { father, mother, key };
  };
  const upSpan = new Map<string, number>();
  const measureUp = (p: Person, depth: number, seen: Set<string>): number => {
    const node = upCoupleOf(p);
    if (!node) return 0;
    if (upSpan.has(node.key)) return upSpan.get(node.key)!;
    if (seen.has(node.key) || depth > maxUp) return unitW(units.get(node.key)!.pair);
    seen.add(node.key);
    let w = unitW(units.get(node.key)!.pair);
    if (depth < maxUp) {
      const fs = node.father ? measureUp(node.father, depth + 1, seen) : 0;
      const ms = node.mother ? measureUp(node.mother, depth + 1, seen) : 0;
      if (fs + ms > 0) w = Math.max(w, fs + ms + (fs > 0 && ms > 0 ? H_GAP : 0));
    }
    upSpan.set(node.key, w);
    return w;
  };
  const placeUp = (p: Person, centerX: number, gen: number, depth: number, seen: Set<string>) => {
    const node = upCoupleOf(p);
    if (!node || seen.has(node.key) || depth > maxUp) return;
    seen.add(node.key);
    const u = units.get(node.key)!;
    pos.set(node.key, { x: centerX - unitW(u.pair) / 2, gen });
    if (depth >= maxUp) return;
    const fs = node.father ? measureUp(node.father, depth + 1, new Set()) : 0;
    const ms = node.mother ? measureUp(node.mother, depth + 1, new Set()) : 0;
    const total = fs + ms + (fs > 0 && ms > 0 ? H_GAP : 0);
    let cursor = centerX - total / 2;
    if (node.father && fs > 0) {
      placeUp(node.father, cursor + fs / 2, gen - 1, depth + 1, seen);
      cursor += fs + H_GAP;
    }
    if (node.mother && ms > 0) {
      placeUp(node.mother, cursor + ms / 2, gen - 1, depth + 1, seen);
    }
  };

  // ---- assemble -------------------------------------------------------------
  const focusKey = addCouple(focus, spouseOf(focus));
  measureDown(focusKey, 0, new Set());
  placeDown(focusKey, 0, 0, new Set());
  // Center the ancestor tower over the focus person's own card.
  const focusPos = pos.get(focusKey)!;
  const fu = units.get(focusKey)!;
  const focusCardCX =
    focusPos.x + (fu.main.id === focus.id ? CARD_W / 2 : CARD_W + JUNCTION_W + CARD_W / 2);
  placeUp(focus, focusCardCX, -1, 1, new Set());

  // Normalize x to start at 0.
  let minX = Infinity;
  let maxX = -Infinity;
  let minGen = 0;
  let maxGen = 0;
  pos.forEach(({ x, gen }, key) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + unitW(units.get(key)!.pair));
    minGen = Math.min(minGen, gen);
    maxGen = Math.max(maxGen, gen);
  });
  const shift = -minX;
  const yOf = (gen: number) => (gen - minGen) * ROW_H;

  const placed: PlacedUnit[] = [];
  const unitByKey = new Map<string, PlacedUnit>();
  pos.forEach(({ x, gen }, key) => {
    const u = units.get(key)!;
    const pu: PlacedUnit = {
      key,
      main: u.main,
      pair: u.pair,
      x: x + shift,
      y: yOf(gen),
      gen,
    };
    placed.push(pu);
    unitByKey.set(key, pu);
  });
  const cardCX = (pu: PlacedUnit, pid: string) =>
    pu.main.id === pid
      ? pu.x + CARD_W / 2
      : pu.x + CARD_W + JUNCTION_W + CARD_W / 2;
  const junctionCX = (pu: PlacedUnit) =>
    pu.x + (pu.pair ? CARD_W + JUNCTION_W / 2 : CARD_W / 2);

  const styleFor = (genDist: number): LineStyle =>
    (["solid", "dash", "dot"] as const)[Math.abs(genDist) % 3];
  const roleSide = (p: Person): LineSide =>
    p.gender === "male" ? "husband" : p.gender === "female" ? "wife" : "shared";

  const forks: ForkLine[] = [];
  // Down forks: couple -> its hosted children.
  pos.forEach(({ gen }, key) => {
    if (gen >= maxDown) return;
    const u = units.get(key)!;
    const kids = downChildren(u);
    if (kids.length === 0) return;
    const pu = unitByKey.get(key)!;
    const bandTop = (gen - minGen + 1) * ROW_H - (ROW_H - CARD_H);
    const drops = kids
      .map((c) => {
        const ck = downUnitOf(c);
        const cu = unitByKey.get(ck);
        if (!cu) return null;
        return {
          personId: c.id,
          x: cardCX(cu, c.id),
          top: cu.y,
          side: roleSide(c),
        };
      })
      .filter(Boolean) as ForkLine["drops"];
    if (drops.length === 0) return;
    drops.sort((a, b) => a.x - b.x);
    const stemX = junctionCX(pu);
    const xs = [stemX, ...drops.map((d) => d.x)];
    forks.push({
      parentKey: key,
      side:
        drops.every((d) => d.side === drops[0].side) ? drops[0].side : "shared",
      style: styleFor(gen),
      stemX,
      stemTop: pu.y + CARD_H,
      barY: bandTop + 12,
      barX0: Math.min(...xs),
      barX1: Math.max(...xs),
      drops,
    });
  });
  // Up forks: each parent couple -> the child it connects to below.
  const childUnitKeyOf = new Map<string, string>();
  pos.forEach((_, key) => {
    const u = units.get(key)!;
    childUnitKeyOf.set(u.main.id, key);
    if (u.pair) childUnitKeyOf.set(u.pair.id, key);
  });
  const walkUpForks = (p: Person, depth: number, seen: Set<string>) => {
    const node = upCoupleOf(p);
    if (!node || seen.has(node.key) || depth > maxUp) return;
    seen.add(node.key);
    const pu = unitByKey.get(node.key);
    const childKey = childUnitKeyOf.get(p.id);
    const cu = childKey ? unitByKey.get(childKey) : undefined;
    if (pu && cu) {
      const fromFather = node.father?.id === p.father_id;
      const side: LineSide = fromFather ? "husband" : "wife";
      const bandTop = cu.y - (ROW_H - CARD_H);
      forks.push({
        parentKey: node.key,
        side,
        style: styleFor(cu.gen),
        stemX: junctionCX(pu),
        stemTop: pu.y + CARD_H,
        barY: bandTop + 12,
        barX0: Math.min(junctionCX(pu), cardCX(cu, p.id)),
        barX1: Math.max(junctionCX(pu), cardCX(cu, p.id)),
        drops: [{ personId: p.id, x: cardCX(cu, p.id), top: cu.y, side }],
      });
    }
    if (node.father) walkUpForks(node.father, depth + 1, seen);
    if (node.mother) walkUpForks(node.mother, depth + 1, seen);
  };
  walkUpForks(focus, 1, new Set());

  return {
    units: placed,
    forks,
    width: maxX - minX,
    height: (maxGen - minGen + 1) * ROW_H - (ROW_H - CARD_H),
    focusKey,
  };
}

/* ======================================================================
 * Timeline layout.
 *
 * Everyone with a recorded birth date gets a lifespan bar on a year
 * axis, grouped into generation bands (generation = longest parent
 * chain from a root). People without a birth date are returned
 * separately so the view can list them honestly instead of guessing.
 * ==================================================================== */

export interface TimelineEntry {
  person: Person;
  birthYear: number;
  /** Null when the person is not living but no death date is recorded:
   *  the view draws an open-ended bar rather than inventing a year. */
  endYear: number | null;
  living: boolean;
  gen: number;
  row: number; // row index within the whole chart (bands stack)
}

export interface TimelineLayout {
  entries: TimelineEntry[];
  undated: Person[];
  minYear: number;
  maxYear: number;
  bandCount: number;
}

const yearOf = (d: string | null): number | null => {
  if (!d) return null;
  const y = parseInt(d.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
};

export function layoutTimeline(
  persons: Person[],
  currentYear: number
): TimelineLayout {
  const graph = buildTreeGraph(persons, []);
  const genMemo = new Map<string, number>();
  const genOf = (p: Person, seen: Set<string>): number => {
    if (genMemo.has(p.id)) return genMemo.get(p.id)!;
    if (seen.has(p.id)) return 0;
    seen.add(p.id);
    let g = 0;
    for (const par of [p.father_id, p.mother_id]) {
      if (par && graph.byId.has(par)) {
        g = Math.max(g, genOf(graph.byId.get(par)!, seen) + 1);
      }
    }
    genMemo.set(p.id, g);
    return g;
  };

  const entries: TimelineEntry[] = [];
  const undated: Person[] = [];
  for (const p of persons) {
    const b = yearOf(p.dob);
    if (b === null) {
      undated.push(p);
      continue;
    }
    const d = yearOf(p.dod);
    entries.push({
      person: p,
      birthYear: b,
      endYear: p.is_living ? currentYear : d,
      living: p.is_living,
      gen: genOf(p, new Set()),
      row: 0,
    });
  }
  entries.sort(
    (a, b) =>
      a.gen - b.gen ||
      a.birthYear - b.birthYear ||
      a.person.given_name.localeCompare(b.person.given_name)
  );
  entries.forEach((e, i) => (e.row = i));
  undated.sort((a, b) => a.given_name.localeCompare(b.given_name));

  const years = entries.flatMap((e) => [e.birthYear, e.endYear ?? e.birthYear]);
  return {
    entries,
    undated,
    minYear: years.length ? Math.min(...years) : currentYear,
    maxYear: years.length ? Math.max(...years) : currentYear,
    bandCount: entries.length ? Math.max(...entries.map((e) => e.gen)) + 1 : 0,
  };
}
