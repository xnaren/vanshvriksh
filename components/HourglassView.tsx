// Hourglass view: the focus couple at the center row, ancestors of
// the focus person rising above, descendants flowing below. Cards
// and fork lines reuse the pedigree view's rendering exactly.
"use client";

import { useMemo } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { layoutHourglass, type LineSide } from "./tree-graph";
import MemberCard from "./MemberCard";
import type { ViewCallbacks } from "./PedigreeView";

const SIDE_COLOR: Record<LineSide, string> = {
  husband: "#4a9eda",
  wife: "#ef8a2a",
  shared: "#7db8a4",
};

export default function HourglassView({
  persons,
  spouses,
  focusId,
  cb,
}: {
  persons: Person[];
  spouses: SpouseLink[];
  focusId: string;
  cb: ViewCallbacks;
}) {
  const layout = useMemo(
    () => layoutHourglass(persons, spouses, focusId),
    [persons, spouses, focusId]
  );
  if (!layout) return null;
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
        {layout.forks.map((f, i) => (
          <g
            key={`${f.parentKey}-${i}`}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={
              f.style === "dash" ? "7 5" : f.style === "dot" ? "0.5 5" : undefined
            }
          >
            <g stroke={SIDE_COLOR[f.side]}>
              <line x1={f.stemX} y1={f.stemTop} x2={f.stemX} y2={f.barY} />
              <line x1={f.barX0} y1={f.barY} x2={f.barX1} y2={f.barY} />
            </g>
            {f.drops.map((dr) => (
              <line
                key={dr.personId}
                stroke={SIDE_COLOR[dr.side]}
                x1={dr.x}
                y1={f.barY}
                x2={dr.x}
                y2={dr.top}
              />
            ))}
          </g>
        ))}
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
          {u.key === layout.focusKey && (
            <div className="text-[10px] font-semibold tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 mt-1">
              FOCUS
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
