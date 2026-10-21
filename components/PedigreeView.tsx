// Single-tree pedigree: every person appears exactly once, positioned by
// the graph layout in tree-graph.ts (layoutSingleTree), with parent->child
// lines drawn as independent SVG edges. Ancestor couples converge on the
// couple below them, so both spouses show their own parents in ONE
// connected tree — no duplicate cards, no captions, no jump links, and no
// line ever lands on the wrong person (lines may cross; they never join
// falsely).
//
// Line colors follow the focal couple (the deepest couple where both
// partners have parents in the tree): blue = husband's side, orange =
// wife's side, teal = shared (the couple's own descendants) or other.
"use client";

import { useMemo } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { layoutSingleTree, type LineSide } from "./tree-graph";
import MemberCard, { displayName } from "./MemberCard";

export interface ViewCallbacks {
  canEdit: boolean;
  zoom: number;
  onEdit: (p: Person) => void;
  onDelete: (p: Person) => void;
  onAdd: (p: Person) => void;
  onJumpBirthFamily: (unitKey: string) => void;
}

const SIDE_COLOR: Record<LineSide, string> = {
  husband: "#4a9eda",
  wife: "#ef8a2a",
  shared: "#7db8a4",
};

export default function PedigreeView({
  persons,
  spouses,
  cb,
}: {
  persons: Person[];
  spouses: SpouseLink[];
  cb: ViewCallbacks;
}) {
  const layout = useMemo(
    () => layoutSingleTree(persons, spouses),
    [persons, spouses]
  );
  const card = (person: Person) => (
    <MemberCard
      p={person}
      canEdit={cb.canEdit}
      zoom={cb.zoom}
      onEdit={cb.onEdit}
      onDelete={cb.onDelete}
      onAdd={cb.onAdd}
    />
  );
  return (
    <div
      className="relative"
      style={{ width: layout.width, height: layout.height }}
    >
      <svg
        className="absolute left-0 top-0"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {layout.forks.map((f) => {
          const color = SIDE_COLOR[f.side];
          return (
            <g key={f.parentKey} stroke={color} strokeWidth={2} fill="none">
              <line x1={f.stemX} y1={f.stemTop} x2={f.stemX} y2={f.barY} />
              <line x1={f.barX0} y1={f.barY} x2={f.barX1} y2={f.barY} />
              {f.drops.map((dr) => (
                <line
                  key={dr.personId}
                  x1={dr.x}
                  y1={f.barY}
                  x2={dr.x}
                  y2={dr.top}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {layout.units.map((u) => (
        <div
          key={u.key}
          className="absolute flex flex-col items-center"
          style={{ left: u.x, top: u.y }}
          data-unit-key={u.main.id}
        >
          <div className="flex items-center">
            {card(u.main)}
            {u.pair && (
              <>
                {/* marriage node — exactly JUNCTION_W wide so the pair
                    card lands where the layout computed it */}
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 30 }}
                  aria-hidden
                >
                  <div className="w-full h-0.5 bg-rose-300 relative flex items-center justify-center">
                    <span className="bg-white border border-rose-300 text-rose-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] leading-none">
                      ⚭
                    </span>
                  </div>
                </div>
                {card(u.pair)}
              </>
            )}
          </div>
          {u.spouseNote && (
            <div className="text-xs text-stone-500 mt-1">
              ⚭ {displayName(u.spouseNote)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
