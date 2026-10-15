// Outline ("folder") view of the tree: collapsible rows like a file
// explorer. Each family unit is a person row (plus a spouse row when the
// spouse pairs up), with children nested and indented beneath it.
"use client";

import { useState } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import {
  buildTreeGraph,
  pairSpouse,
  unpairedSpouse,
  unitChildren,
  type TreeGraph,
} from "./tree-graph";
import MemberCard, { displayName } from "./MemberCard";
import type { ViewCallbacks } from "./PedigreeView";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(90deg)" : undefined }}
      className="transition-transform"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function UnitRows({
  p,
  graph,
  shown,
  cb,
  collapsed,
  toggle,
}: {
  p: Person;
  graph: TreeGraph;
  shown: Set<string>;
  cb: ViewCallbacks;
  collapsed: Set<string>;
  toggle: (id: string) => void;
}) {
  if (shown.has(p.id)) return null; // guard against cycles
  shown.add(p.id);

  const pairWith = pairSpouse(graph, p, shown);
  const spouse = unpairedSpouse(graph, p, pairWith, shown);
  const children = unitChildren(graph, p, pairWith);
  const isCollapsed = collapsed.has(p.id);

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
    <div>
      <div className="flex items-center gap-1 py-1">
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => toggle(p.id)}
            className="w-6 h-6 flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 shrink-0"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            <Chevron open={!isCollapsed} />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        {card(p)}
        {spouse && (
          <span className="text-xs text-stone-500 ml-2 shrink-0">
            ⚭ {displayName(spouse)}
          </span>
        )}
      </div>
      {pairWith && (
        <div className="flex items-center gap-1 py-1 ml-7">
          <span
            className="w-6 text-center text-rose-400 text-xs shrink-0"
            aria-hidden
          >
            ⚭
          </span>
          {card(pairWith)}
        </div>
      )}
      {!isCollapsed && children.length > 0 && (
        <div className="ml-[18px] border-l-2 border-emerald-200 pl-4">
          {children.map((c) => (
            <UnitRows
              key={c.id}
              p={c}
              graph={graph}
              shown={shown}
              cb={cb}
              collapsed={collapsed}
              toggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TreeListView({
  persons,
  spouses,
  cb,
}: {
  persons: Person[];
  spouses: SpouseLink[];
  cb: ViewCallbacks;
}) {
  const graph = buildTreeGraph(persons, spouses);
  const shown = new Set<string>();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-1">
      {graph.roots.map((p) => (
        <UnitRows
          key={p.id}
          p={p}
          graph={graph}
          shown={shown}
          cb={cb}
          collapsed={collapsed}
          toggle={toggle}
        />
      ))}
    </div>
  );
}
