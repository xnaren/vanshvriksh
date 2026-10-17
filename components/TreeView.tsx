// Tree canvas orchestrator: zoomable/pannable viewport with a toolbar
// (zoom controls + pedigree/outline view toggle), hosting either the
// pedigree view or the folder-style outline view, plus the edit/add
// modals.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { deletePerson } from "@/app/trees/[id]/actions";
import EditPersonModal from "./EditPersonModal";
import AddRelativeModal from "./AddRelativeModal";
import PedigreeView, { type ViewCallbacks } from "./PedigreeView";
import TreeListView from "./TreeListView";
import { buildFamilyUnits } from "./tree-graph";
import { displayName } from "./MemberCard";

type View = "pedigree" | "list";

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
  const [editing, setEditing] = useState<Person | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<Person | null>(null);

  /* ----- zoom & pan ----- */
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLUListElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(
    null
  );
  const [panning, setPanning] = useState(false);

  // The pedigree unit plan, shared by the pedigree view (pure derivation
  // of persons/spouses). In-law parents dock above the couple here; the
  // outline view builds its own undocked plan.
  const units = useMemo(
    () => buildFamilyUnits(persons, spouses, { dockInLaws: true }),
    [persons, spouses]
  );

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
    const t = (view === "pedigree"
      ? treeRef.current
      : listRef.current) as HTMLElement | null;
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

  // Mouse wheel zooms the pedigree, centered on the cursor. In outline
  // view the wheel scrolls the list naturally.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || view !== "pedigree") return;
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

  /** Jump the canvas to a family unit (birth-family caption) with a pulse. */
  function jumpToUnit(unitKey: string) {
    const c = containerRef.current;
    const el = c?.querySelector(
      `[data-unit-key="${CSS.escape(unitKey)}"]`
    ) as HTMLElement | null;
    if (!c || !el) return;
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
      className="vv-canvas card overflow-auto relative h-[calc(100vh_-_12rem)] min-h-[440px] flex"
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
        {viewButton("list", "Outline view", <ListGlyph />)}
      </div>

      {deletingId && (
        <p className="text-xs text-stone-500 mb-2">Deleting…</p>
      )}

      {view === "pedigree" ? (
        /* m-auto centers the tree when it fits, and keeps it reachable
           by scroll when it overflows (the "safe center" pattern). */
        <div className="m-auto p-3">
          <ul
            ref={treeRef}
            style={{ zoom }}
            className="vv-tree flex gap-14 items-start justify-center min-w-max"
          >
            <PedigreeView units={units} cb={cb} />
          </ul>
        </div>
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
