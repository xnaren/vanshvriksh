// Tree canvas orchestrator: zoomable/pannable viewport with a toolbar
// (zoom controls + pedigree/ancestor-chart/outline view toggle),
// hosting the single-tree pedigree, the horizontal ancestor chart, or
// the folder-style outline view, plus the edit/add modals.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { deletePerson } from "@/app/trees/[id]/actions";
import EditPersonModal from "./EditPersonModal";
import AddRelativeModal from "./AddRelativeModal";
import PedigreeView, { type ViewCallbacks } from "./PedigreeView";
import CircleView from "./CircleView";
import TreeListView from "./TreeListView";
import AncestorChartView from "./AncestorChartView";
import FanChartView from "./FanChartView";
import HourglassView from "./HourglassView";
import DescendantChartView from "./DescendantChartView";
import TimelineView from "./TimelineView";
import MapView from "./MapView";
import { displayName } from "./MemberCard";
import { layoutSingleTree, defaultAncestorFocus, defaultDescendantFocus } from "./tree-graph";

type View = "pedigree" | "circles" | "list" | "chart" | "fan" | "hourglass" | "descendant" | "timeline" | "map";

function PedigreeGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="4.5" r="2.5" />
      <circle cx="5.5" cy="19.5" r="2.5" />
      <circle cx="18.5" cy="19.5" r="2.5" />
      <path d="M12 7v4.5M12 11.5 5.5 17M12 11.5l6.5 5.5" />
    </svg>
  );
}

function CircleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="7" cy="12" r="4" />
      <circle cx="17" cy="12" r="4" />
      <path d="M11 12h2" />
    </svg>
  );
}

function ChartGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="5.5" r="2.5" />
      <circle cx="19" cy="18.5" r="2.5" />
      <path d="M7.5 12h3M10.5 12l6-4.5M10.5 12l6 4.5" />
    </svg>
  );
}

function ListGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <polyline points="4 5 5 6 7 4" />
      <polyline points="4 11 5 12 7 10" />
      <polyline points="4 17 5 18 7 16" />
    </svg>
  );
}

function FanGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10V3M13.8 10.8 19 6M10.2 10.8 5 6M14 12h7M10 12H3" />
    </svg>
  );
}

function HourglassGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 3h12M6 21h12M7 3c0 5 10 7 10 9s-10 4-10 9M17 3c0 5-10 7-10 9s10 4 10 9" />
    </svg>
  );
}

function DescendantGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="8" cy="4.5" r="2.5" />
      <circle cx="16" cy="4.5" r="2.5" />
      <path d="M10.5 4.5h3M12 7v4.5M12 11.5 5.5 17M12 11.5l6.5 5.5" />
      <circle cx="5.5" cy="19.5" r="2.5" />
      <circle cx="18.5" cy="19.5" r="2.5" />
    </svg>
  );
}

function TimelineGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="20" x2="21" y2="20" />
      <line x1="5" y1="8" x2="14" y2="8" />
      <line x1="9" y1="14" x2="20" y2="14" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="9" cy="14" r="1.4" />
    </svg>
  );
}

function MapGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 21s-6.5-5.3-6.5-10.4A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.6C18.5 15.7 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </svg>
  );
}

export default function TreeView({
  persons,
  spouses,
  treeId,
  canEdit,
}: {
  persons: Person[];
  spouses: SpouseLink[];
  treeId: string;
  canEdit: boolean;
}) {
  const [view, setView] = useState<View>("pedigree");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const [editing, setEditing] = useState<Person | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<Person | null>(null);

  /* ----- zoom & pan ----- */
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(
    null
  );
  const [panning, setPanning] = useState(false);

  const clampZoom = (z: number) =>
    Math.min(2.5, Math.max(0.3, Math.round(z * 100) / 100));

  /** Set zoom; when (cx, cy) is given, keep the content under that point stable. */
  function applyZoom(newZoom: number, cx?: number, cy?: number) {
    const c = containerRef.current;
    newZoom = clampZoom(newZoom);
    if (!c || newZoom === zoomRef.current) return;
    const oldZoom = zoomRef.current;
    if (cx !== undefined && cy !== undefined) {
      const rect = c.getBoundingClientRect();
      const mx = cx - rect.left;
      const my = cy - rect.top;
      const contentX = (c.scrollLeft + mx) / oldZoom;
      const contentY = (c.scrollTop + my) / oldZoom;
      zoomRef.current = newZoom;
      setZoom(newZoom);
      requestAnimationFrame(() => {
        c.scrollLeft = contentX * newZoom - mx;
        c.scrollTop = contentY * newZoom - my;
      });
    } else {
      zoomRef.current = newZoom;
      setZoom(newZoom);
    }
  }

  function zoomStep(delta: number) {
    const c = containerRef.current;
    if (!c) {
      applyZoom(zoomRef.current + delta);
      return;
    }
    const rect = c.getBoundingClientRect();
    applyZoom(
      zoomRef.current + delta,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }

  function fitToView() {
    const c = containerRef.current;
    const t = (view === "list"
      ? listRef.current
      : treeRef.current) as HTMLElement | null;
    if (!c || !t) return;
    // CSS `zoom` scales layout, so divide back out to get the natural size.
    const naturalW = t.offsetWidth / zoomRef.current;
    const naturalH = t.offsetHeight / zoomRef.current;
    if (!naturalW || !naturalH) return;
    const rect = c.getBoundingClientRect();
    applyZoom(
      Math.min(c.clientWidth / naturalW, c.clientHeight / naturalH, 1),
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }

  // Mouse wheel zooms the pedigree and ancestor chart, centered on the
  // cursor. In outline view the wheel scrolls the list naturally.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || view === "list" || view === "timeline" || view === "map") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(
        zoomRef.current - Math.sign(e.deltaY) * 0.12,
        e.clientX,
        e.clientY
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view]);

  /** Drag the canvas background to pan. Drags starting on a card or
   *  button are ignored so clicks keep working normally. */
  function onPanStart(e: React.MouseEvent) {
    if (view === "map" || view === "timeline") return;
    if ((e.target as HTMLElement).closest("button, .vv-card")) return;
    const c = containerRef.current;
    if (!c) return;
    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      sl: c.scrollLeft,
      st: c.scrollTop,
    };
  }
  function onPanMove(e: React.MouseEvent) {
    const p = panRef.current;
    const c = containerRef.current;
    if (!p || !c) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!panning && Math.abs(dx) + Math.abs(dy) > 4) setPanning(true);
    e.preventDefault();
    c.scrollLeft = p.sl - dx;
    c.scrollTop = p.st - dy;
  }
  function onPanEnd() {
    panRef.current = null;
    setPanning(false);
  }

  /* ----- member actions ----- */

  /** Center an element in the canvas with a pulse. */
  function centerOn(el: HTMLElement) {
    const c = containerRef.current;
    if (!c) return;
    // Screen-pixel math — zoom-independent.
    const cRect = c.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    c.scrollTo({
      left:
        c.scrollLeft + (r.left - cRect.left) - c.clientWidth / 2 + r.width / 2,
      top:
        c.scrollTop + (r.top - cRect.top) - c.clientHeight / 2 + r.height / 2,
      behavior: "smooth",
    });
    el.classList.add("vv-flash");
    window.setTimeout(() => el.classList.remove("vv-flash"), 2300);
  }

  /** Jump the canvas to a family unit (birth-family caption). */
  function jumpToUnit(unitKey: string) {
    const c = containerRef.current;
    const el = c?.querySelector(
      `[data-unit-key="${CSS.escape(unitKey)}"]`
    ) as HTMLElement | null;
    if (el) centerOn(el);
  }

  /** Jump to one person's card (header search picks). */
  function jumpToPerson(personId: string) {
    const c = containerRef.current;
    const card = c?.querySelector(
      `[data-person-id="${CSS.escape(personId)}"]`
    ) as HTMLElement | null;
    if (card) {
      centerOn(card);
      return;
    }
    // Fallback: center the person's family unit.
    const unit = layoutSingleTree(persons, spouses).units.find(
      (u) => u.main.id === personId || u.pair?.id === personId
    );
    if (unit) jumpToUnit(unit.key);
  }

  // Header search dispatches "vv:focus-person"; answer by making that
  // person the ancestor chart's focus, or by switching to the pedigree
  // view (if needed) and centering the person's card.
  useEffect(() => {
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ personId?: string }>).detail?.personId;
      if (!id) return;
      if (view === "chart" || view === "fan" || view === "hourglass" || view === "descendant") {
        setFocusId(id);
        return;
      }
      if (view === "timeline" || view === "map") {
        setHighlightId(id);
        return;
      }
      if (view === "list") {
        setView("pedigree");
        window.setTimeout(() => jumpToPerson(id), 350);
      } else {
        jumpToPerson(id);
      }
    };
    window.addEventListener("vv:focus-person", onFocus);
    return () => window.removeEventListener("vv:focus-person", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons, spouses, view]);

  async function handleDelete(p: Person) {
    if (
      !confirm(
        `Delete ${displayName(p)} from this tree? Their links to relatives will be removed.`
      )
    )
      return;
    setDeletingId(p.id);
    try {
      await deletePerson(treeId, p.id);
    } catch (err) {
      alert((err as Error).message);
    }
    setDeletingId(null);
  }

  /* ----- ancestor chart ----- */
  const defaultFocus = useMemo(
    () => defaultAncestorFocus(persons),
    [persons]
  );
  const descendantDefault = useMemo(
    () => defaultDescendantFocus(persons, spouses),
    [persons, spouses]
  );
  const effectiveFocusId =
    focusId && persons.some((p) => p.id === focusId)
      ? focusId
      : view === "descendant"
        ? (descendantDefault?.id ?? defaultFocus?.id ?? persons[0]?.id)
        : (defaultFocus?.id ?? persons[0]?.id);
  const toggleCollapse = (id: string) =>
    setCollapsedIds((cur) => {
      const next = new Set<string>(Array.from(cur));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (persons.length === 0) {
    return (
      <p className="text-stone-500 text-sm">
        No members yet — add the first person to begin the tree.
      </p>
    );
  }

  const cb: ViewCallbacks = {
    canEdit,
    zoom,
    onEdit: setEditing,
    onDelete: handleDelete,
    onAdd: setAddingFor,
    onJumpBirthFamily: jumpToUnit,
  };

  const viewButton = (v: View, title: string, glyph: React.ReactNode) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => setView(v)}
      className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
        view === v
          ? "bg-emerald-700 text-white"
          : "text-stone-500 hover:bg-stone-100"
      }`}
    >
      {glyph}
    </button>
  );

  return (
    <div
      ref={containerRef}
      className="vv-canvas card overflow-auto relative h-[calc(100dvh_-_5rem)] min-h-[440px] flex"
      style={{ cursor: panning ? "grabbing" : undefined }}
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
    >
      {/* toolbar: zoom + view toggle */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/95 border border-stone-200 rounded-full shadow-sm px-1.5 py-1">
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => zoomStep(-0.15)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 text-lg leading-none"
        >
          −
        </button>
        <button
          type="button"
          title="Reset zoom to 100%"
          aria-label="Reset zoom"
          onClick={() => applyZoom(1)}
          className="min-w-[3rem] h-7 px-1 text-xs text-stone-600 hover:bg-stone-100 rounded-full tabular-nums"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => zoomStep(0.15)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 text-lg leading-none"
        >
          +
        </button>
        <button
          type="button"
          title="Fit tree to view"
          aria-label="Fit tree to view"
          onClick={fitToView}
          className="h-7 px-2 text-xs text-stone-600 hover:bg-stone-100 rounded-full"
        >
          Fit
        </button>
        <span className="w-px h-5 bg-stone-200 mx-0.5" aria-hidden />
        {viewButton("pedigree", "Pedigree view", <PedigreeGlyph />)}
        {viewButton("circles", "Circular nodes view", <CircleGlyph />)}
        {viewButton("chart", "Ancestor chart (horizontal)", <ChartGlyph />)}
        {viewButton("fan", "Fan chart (radial)", <FanGlyph />)}
        {viewButton("hourglass", "Hourglass view", <HourglassGlyph />)}
        {viewButton("descendant", "Descendant chart (sample style)", <DescendantGlyph />)}
        {viewButton("timeline", "Timeline view", <TimelineGlyph />)}
        {viewButton("map", "Map view", <MapGlyph />)}
        {viewButton("list", "Outline view", <ListGlyph />)}
      </div>

      {/* ancestor-chart focus picker */}
      {(view === "chart" || view === "fan" || view === "hourglass" || view === "descendant") && effectiveFocusId && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/95 border border-stone-200 rounded-full shadow-sm pl-3 pr-1.5 py-1">
          <label htmlFor="vv-focus" className="text-xs text-stone-500">
            Focus
          </label>
          <div className="w-44">
            <select
              id="vv-focus"
              value={effectiveFocusId}
              onChange={(e) => setFocusId(e.target.value)}
              className="!rounded-full !py-1 text-sm"
            >
              {[...persons]
                .sort((a, b) => displayName(a).localeCompare(displayName(b)))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {deletingId && (
        <p className="text-xs text-stone-500 mb-2">Deleting…</p>
      )}

      {view === "pedigree" ? (
        /* m-auto centers the tree when it fits, and keeps it reachable
           by scroll when it overflows (the "safe center" pattern). */
        <div className="m-auto p-3">
          <div ref={treeRef} style={{ zoom }} className="relative">
            <PedigreeView persons={persons} spouses={spouses} cb={cb} />
          </div>
        </div>
      ) : view === "circles" ? (
        <div className="m-auto p-3">
          <div ref={treeRef} style={{ zoom }} className="relative">
            <CircleView persons={persons} spouses={spouses} cb={cb} />
          </div>
        </div>
      ) : view === "chart" ? (
        <div className="m-auto p-3">
          <div ref={treeRef} style={{ zoom }} className="relative">
            <AncestorChartView
              persons={persons}
              focusId={effectiveFocusId ?? ""}
              collapsed={collapsedIds}
              onToggleCollapse={toggleCollapse}
              cb={cb}
            />
          </div>
        </div>
      ) : view === "fan" ? (
        <div className="m-auto p-3">
          <div ref={treeRef} style={{ zoom }} className="relative">
            <FanChartView
              persons={persons}
              focusId={effectiveFocusId ?? ""}
              onFocus={setFocusId}
            />
          </div>
        </div>
      ) : view === "hourglass" ? (
        <div className="m-auto p-3">
          <div ref={treeRef} style={{ zoom }} className="relative">
            <HourglassView
              persons={persons}
              spouses={spouses}
              focusId={effectiveFocusId ?? ""}
              cb={cb}
            />
          </div>
        </div>
      ) : view === "descendant" ? (
        <div className="m-auto p-3">
          <div ref={treeRef} style={{ zoom }} className="relative">
            <DescendantChartView
              persons={persons}
              spouses={spouses}
              focusId={effectiveFocusId ?? ""}
              cb={cb}
            />
          </div>
        </div>
      ) : view === "timeline" ? (
        <TimelineView persons={persons} highlightId={highlightId} />
      ) : view === "map" ? (
        <MapView persons={persons} highlightId={highlightId} />
      ) : (
        <div
          ref={listRef}
          style={{ zoom }}
          className="w-full max-w-4xl mx-auto p-4 self-start"
        >
          <TreeListView persons={persons} spouses={spouses} cb={cb} />
        </div>
      )}

      {editing && (
        <EditPersonModal
          treeId={treeId}
          person={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {addingFor && (
        <AddRelativeModal
          treeId={treeId}
          persons={persons}
          relativeTo={addingFor}
          onClose={() => setAddingFor(null)}
        />
      )}
    </div>
  );
}
