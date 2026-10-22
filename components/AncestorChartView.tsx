// Horizontal ancestor chart (Gramps-style): the focus person at the
// left, ancestors unfolding right — father above mother at every step.
// Cards are the shared MemberCard; a chevron on a card's right edge
// collapses/expands that person's ancestors. Edge color follows the
// parent (blue to a father, orange to a mother — the pedigree role
// colors); edge style cycles solid/dash/dot by distance from focus.
"use client";

import { useMemo } from "react";
import type { Person } from "@/lib/types";
import { layoutAncestorChart, type LineStyle } from "./tree-graph";
import MemberCard from "./MemberCard";
import type { ViewCallbacks } from "./PedigreeView";

const ROLE_COLOR = { father: "#4a9eda", mother: "#ef8a2a" } as const;

function dashOf(style: LineStyle): string | undefined {
  return style === "dash" ? "7 5" : style === "dot" ? "0.5 5" : undefined;
}

export default function AncestorChartView({
  persons,
  focusId,
  collapsed,
  onToggleCollapse,
  cb,
}: {
  persons: Person[];
  focusId: string;
  collapsed: ReadonlySet<string>;
  onToggleCollapse: (personId: string) => void;
  cb: ViewCallbacks;
}) {
  const layout = useMemo(
    () => layoutAncestorChart(persons, focusId, collapsed),
    [persons, focusId, collapsed]
  );

  if (layout.nodes.length === 0) {
    return <p className="text-stone-500 text-sm p-4">No focus person.</p>;
  }

  return (
    <div
      className="relative"
      style={{ width: layout.width, height: layout.height }}
    >
      <svg
        className="absolute inset-0"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {layout.edges.map((e) => (
          <path
            key={`${e.childId}->${e.parentId}`}
            d={`M ${e.x1} ${e.y1} H ${e.midX} V ${e.y2} H ${e.x2}`}
            fill="none"
            stroke={ROLE_COLOR[e.role]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={dashOf(e.style)}
          />
        ))}
      </svg>
      {layout.nodes.map((n) => (
        <div
          key={`${n.person.id}@${n.depth}:${n.x},${n.y}`}
          className="absolute"
          style={{ left: n.x, top: n.y }}
        >
          <MemberCard
            p={n.person}
            canEdit={cb.canEdit}
            zoom={cb.zoom}
            onEdit={cb.onEdit}
            onDelete={cb.onDelete}
            onAdd={cb.onAdd}
          />
          {n.hasParents && (
            <button
              type="button"
              title={
                n.collapsed
                  ? "Show this person's ancestors"
                  : "Hide this person's ancestors"
              }
              aria-label={
                n.collapsed ? "Expand ancestors" : "Collapse ancestors"
              }
              onClick={() => onToggleCollapse(n.person.id)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-stone-300 shadow-sm text-stone-600 hover:text-emerald-700 hover:border-emerald-300 flex items-center justify-center text-sm leading-none"
            >
              {n.collapsed ? "›" : "‹"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
