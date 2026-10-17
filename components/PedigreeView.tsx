// Top-down pedigree: each family unit (person + pair-able spouse) renders
// as a couple block; children hang below joined by CSS pedigree lines.
//
// The unit plan is computed purely by buildFamilyUnits (no shared mutable
// state during React rendering) so server and client always agree — see
// tree-graph.ts for why this matters for hydration.
//
// Birth links for paired-away partners (e.g. a wife whose parents are also
// in the tree) are drawn as SVG connector arcs from her card to her
// parents' couple block, so the whole pedigree reads as one tree instead
// of two disconnected ones. The arcs live inside the zoomed <ul> in its
// own coordinate space, so they stick to the cards through pan and zoom.
"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";
import {
  buildFamilyUnits,
  collectInLawArcs,
  type FamilyUnit,
} from "./tree-graph";
import MemberCard, { displayName } from "./MemberCard";

export interface ViewCallbacks {
  canEdit: boolean;
  zoom: number;
  onEdit: (p: Person) => void;
  onDelete: (p: Person) => void;
  onAdd: (p: Person) => void;
}

function FamilyUnitView({
  unit,
  isRoot,
  cb,
}: {
  unit: FamilyUnit;
  isRoot: boolean;
  cb: ViewCallbacks;
}) {
  const { main: p, pair: pairWith, spouseNote: spouse, children } = unit;
  // `ref` children (paired-away partners with parents in the tree) are not
  // rendered as cards here — an in-law arc connects them instead.
  const visibleChildren = children.filter((c) => !c.ref);
  return (
    <li
      className={
        isRoot
          ? "relative flex flex-col items-center shrink-0"
          : "vv-family"
      }
    >
      <div className="flex flex-col items-center" data-unit-key={p.id}>
        <div className="flex items-center">
          <div data-card-for={p.id}>
            <MemberCard
              p={p}
              canEdit={cb.canEdit}
              zoom={cb.zoom}
              onEdit={cb.onEdit}
              onDelete={cb.onDelete}
              onAdd={cb.onAdd}
            />
          </div>
          {pairWith && (
            <>
              {/* marriage node */}
              <div className="flex items-center px-0.5" aria-hidden>
                <div className="w-7 h-0.5 bg-rose-300 relative flex items-center justify-center">
                  <span className="bg-white border border-rose-300 text-rose-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] leading-none">
                    ⚭
                  </span>
                </div>
              </div>
              <div data-card-for={pairWith.id}>
                <MemberCard
                  p={pairWith}
                  canEdit={cb.canEdit}
                  zoom={cb.zoom}
                  onEdit={cb.onEdit}
                  onDelete={cb.onDelete}
                  onAdd={cb.onAdd}
                />
              </div>
            </>
          )}
        </div>
        {spouse && (
          <div className="text-xs text-stone-500 mt-1">
            ⚭ {displayName(spouse)}
          </div>
        )}
      </div>
      {visibleChildren.length > 0 && (
        <ul className="vv-children">
          {visibleChildren.map((c) => (
            <FamilyUnitView
              key={c.main.id}
              unit={c}
              isRoot={false}
              cb={cb}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** SVG overlay drawing in-law birth arcs. Rendered as the first child of
 *  the pedigree <ul> (which is position:relative); absolutely positioned
 *  to cover it, pointer-transparent, painted under the cards by DOM order.
 *  Positions are measured in the <ul>'s own coordinate space, so CSS-zoom
 *  and scroll-pan move the arcs together with the cards — remeasuring only
 *  on data/layout changes via ResizeObserver. */
function InLawArcs({ units }: { units: FamilyUnit[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const specs = useMemo(() => collectInLawArcs(units), [units]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const ul = svg?.parentElement;
    if (!svg || !ul || specs.length === 0) {
      setPaths([]);
      return;
    }
    const measure = () => {
      const ulRect = ul.getBoundingClientRect();
      const ds: string[] = [];
      for (const s of specs) {
        const fromEl = ul.querySelector(
          `[data-card-for="${CSS.escape(s.fromId)}"]`
        );
        const toEl = ul.querySelector(
          `[data-unit-key="${CSS.escape(s.toUnitKey)}"]`
        );
        if (!(fromEl instanceof HTMLElement) || !(toEl instanceof HTMLElement))
          continue;
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const x1 = fr.left + fr.width / 2 - ulRect.left;
        const y1 = fr.top - ulRect.top;
        const x2 = tr.left + tr.width / 2 - ulRect.left;
        const y2 = tr.top + tr.height - ulRect.top;
        // Arc over the top when the parents sit above the card, else below.
        const dir = y2 <= y1 ? -1 : 1;
        const lift = 90;
        ds.push(
          `M ${x1} ${y1} C ${x1} ${y1 + dir * lift}, ${x2} ${y2 + dir * lift}, ${x2} ${y2}`
        );
      }
      setPaths(ds);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [specs]);

  if (specs.length === 0) return null;
  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#a8a29e"
          strokeWidth={2}
          strokeDasharray="7 5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export default function PedigreeView({
  persons,
  spouses,
  cb,
}: {
  persons: Person[];
  spouses: import("@/lib/types").SpouseLink[];
  cb: ViewCallbacks;
}) {
  const units = useMemo(
    () => buildFamilyUnits(persons, spouses),
    [persons, spouses]
  );
  return (
    <>
      <InLawArcs units={units} />
      {units.map((u) => (
        <FamilyUnitView key={u.main.id} unit={u} isRoot={true} cb={cb} />
      ))}
    </>
  );
}
