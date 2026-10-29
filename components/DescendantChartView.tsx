// Descendant chart view: the Nehru sample chart, for a real tree.
// Focus couple at the top, descendants flowing below, generation by
// generation. Couples sit side by side joined by a marriage link
// (line + circle, as in the sample); children drop from the couple's
// midpoint down to a bar, then to each child couple's midpoint.
// Unlike pedigree, this shows descendants only — a child's spouse
// appears beside them, but the spouse's own parents do not.
"use client";

import { useMemo } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { layoutDescendantChart } from "./tree-graph";
import MemberCard from "./MemberCard";
import type { ViewCallbacks } from "./PedigreeView";

// Sample chart's line color.
const LINE = "#a7d7c5";

export default function DescendantChartView({
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
    () => layoutDescendantChart(persons, spouses, focusId),
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
          <g key={`${f.parentKey}-${i}`} stroke={LINE} strokeWidth="2" fill="none">
            <line x1={f.stemX} y1={f.stemTop} x2={f.stemX} y2={f.barY} />
            {f.barX0 !== f.barX1 && (
              <line x1={f.barX0} y1={f.barY} x2={f.barX1} y2={f.barY} />
            )}
            {f.drops.map((dr) => (
              <line key={dr.personId} x1={dr.x} y1={f.barY} x2={dr.x} y2={dr.top} />
            ))}
          </g>
        ))}
        {layout.couples.map((c, i) => (
          <g key={i} stroke={LINE} strokeWidth="2">
            <line x1={c.x0} y1={c.y} x2={c.x1} y2={c.y} />
            <circle
              cx={(c.x0 + c.x1) / 2}
              cy={c.y}
              r="4"
              fill="#fff"
              stroke={LINE}
              strokeWidth="2"
            />
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
                  className="shrink-0"
                  style={{ width: 30 }}
                  aria-hidden
                />
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
