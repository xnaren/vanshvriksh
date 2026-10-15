// Top-down pedigree renderer with CSS-drawn connectors.
//
// Each family unit (a person + their spouse, if the spouse is also a root)
// renders as one "couple" block; children hang below it joined by the
// classic pedigree lines: a vertical drop from the marriage node, a
// horizontal sibship line, and a drop to each child. Separate roots render
// as separate trees side by side (horizontally scrollable).
//
// Cards carry a photo/initials avatar and icon buttons (add relative,
// edit, delete) instead of text. The "+" button tells the add form (a
// sibling component) to pre-select that person via a window event.
//
// NOTE (future work): Indian joint families with intermarriages are graphs,
// not trees — cousin-marriage loops will render a person twice (once per
// birth family) rather than as a joined graph. A graph layout engine
// (e.g. d3-dag) is the eventual answer; the data model already supports it.
"use client";

import { useEffect, useRef, useState } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { deletePerson } from "@/app/trees/[id]/actions";
import EditPersonModal from "./EditPersonModal";
import AddRelativeModal from "./AddRelativeModal";

/* ---------- tiny inline icons (no emoji) ---------- */

function IconBase({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      {children}
    </svg>
  );
}

const PlusIcon = ({ title }: { title: string }) => (
  <IconBase title={title}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </IconBase>
);

const PencilIcon = ({ title }: { title: string }) => (
  <IconBase title={title}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </IconBase>
);

const TrashIcon = ({ title }: { title: string }) => (
  <IconBase title={title}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </IconBase>
);

function IconButton({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`p-1 rounded transition-colors ${
        danger
          ? "text-stone-300 hover:text-red-600 hover:bg-red-50"
          : "text-stone-300 hover:text-emerald-700 hover:bg-emerald-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- helpers ---------- */

function displayName(p: Person) {
  return `${p.given_name}${p.family_name ? " " + p.family_name : ""}`;
}

function initials(p: Person) {
  const a = p.given_name.trim().charAt(0);
  const b = (p.family_name ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function year(d: string | null): string | null {
  return d ? d.slice(0, 4) : null;
}

function detailsLine(p: Person): string {
  const bits: string[] = [];
  if (p.gotra) bits.push(p.gotra);
  const birth = year(p.dob);
  const death = year(p.dod);
  if (birth && death) bits.push(`${birth}–${death}`);
  else if (birth) bits.push(p.is_living ? `b. ${birth}` : `${birth}–?`);
  else if (death) bits.push(`d. ${death}`);
  else if (!p.is_living) bits.push("†");
  if (p.native_place) bits.push(p.native_place);
  return bits.join(" · ");
}

/* ---------- person card ---------- */

function PersonCard({
  p,
  canEdit,
  onEdit,
  onDelete,
  onAdd,
}: {
  p: Person;
  canEdit: boolean;
  onEdit: (p: Person) => void;
  onDelete: (p: Person) => void;
  onAdd: (p: Person) => void;
}) {
  const name = displayName(p);
  const details = detailsLine(p);
  return (
    <div className="vv-card relative bg-white border border-stone-200 rounded-xl pl-2.5 pr-2 py-2 shadow-sm w-48 shrink-0">
      <div className="flex items-center gap-2.5">
        {/* avatar: uploaded photo when set, initials otherwise */}
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photo_url}
            alt={name}
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-stone-200"
            title={details || name}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-semibold text-sm shrink-0"
            title={details || name}
          >
            {initials(p)}
          </div>
        )}
        <div className="min-w-0 pr-1">
          <div className="font-medium text-sm leading-tight truncate" title={name}>
            {name}
          </div>
          {details && (
            <div className="text-xs text-stone-500 truncate" title={details}>
              {details}
            </div>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="absolute top-1 right-1 flex">
          <IconButton title={`Add a relative of ${name}`} onClick={() => onAdd(p)}>
            <PlusIcon title="Add relative" />
          </IconButton>
          <IconButton title={`Edit ${name}`} onClick={() => onEdit(p)}>
            <PencilIcon title="Edit" />
          </IconButton>
          <IconButton title={`Delete ${name}`} danger onClick={() => onDelete(p)}>
            <TrashIcon title="Delete" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

/* ---------- tree ---------- */

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
  const [editing, setEditing] = useState<Person | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<Person | null>(null);

  /* ----- zoom & pan ----- */
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLUListElement>(null);
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
    const t = treeRef.current;
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

  // Mouse wheel zooms the canvas, centered on the cursor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
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
  }, []);

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
  const shown = new Set<string>();

  /** Render one family unit: person + spouse (if pair-able) + their children. */
  function renderFamily(p: Person, isRoot: boolean): React.ReactNode {
    if (shown.has(p.id)) return null; // guard against cycles
    shown.add(p.id);

    // Pair up spouses only when both are roots — otherwise the spouse
    // renders in their own birth family and we annotate the link.
    const spouseId = partnerOf.get(p.id);
    const spouse =
      spouseId && !shown.has(spouseId) ? byId.get(spouseId) : undefined;
    const pairWith = spouse && !hasParents.has(spouse.id) ? spouse : undefined;
    if (pairWith) shown.add(pairWith.id);

    const kids = new Map<string, Person>();
    for (const parent of [p, pairWith].filter(Boolean) as Person[]) {
      for (const c of childrenOf.get(parent.id) ?? []) kids.set(c.id, c);
    }
    const children = Array.from(kids.values());

    return (
      <li key={p.id} className={isRoot ? "flex flex-col items-center shrink-0" : "vv-family"}>
        <div className="flex flex-col items-center">
          <div className="flex items-center">
            <PersonCard
              p={p}
              canEdit={canEdit}
              onEdit={setEditing}
              onDelete={handleDelete}
              onAdd={setAddingFor}
            />
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
                <PersonCard
                  p={pairWith}
                  canEdit={canEdit}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onAdd={setAddingFor}
                />
              </>
            )}
          </div>
          {!pairWith && spouse && (
            <div className="text-xs text-stone-500 mt-1">
              ⚭ {displayName(spouse)}
            </div>
          )}
        </div>
        {children.length > 0 && (
          <ul className="vv-children">
            {children.map((c) => renderFamily(c, false))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div
      ref={containerRef}
      className="vv-canvas card overflow-auto relative h-[calc(100vh-12rem)] min-h-[440px] flex"
      style={{ cursor: panning ? "grabbing" : undefined }}
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
    >
      {/* zoom toolbar */}
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
      </div>

      {deletingId && (
        <p className="text-xs text-stone-500 mb-2">Deleting…</p>
      )}
      {/* m-auto centers the tree when it fits, and keeps it reachable
          by scroll when it overflows (the "safe center" pattern). */}
      <div className="m-auto p-3">
        <ul
          ref={treeRef}
          style={{ zoom }}
          className="vv-tree flex gap-14 items-start justify-center min-w-max"
        >
          {roots.map((p) => renderFamily(p, true))}
        </ul>
      </div>
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
