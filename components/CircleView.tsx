// Circular-node view: the same single-tree layout as the pedigree
// view (every person exactly once, same fork geometry and line
// colors/styles), but each person renders as a circle instead of a
// rounded-rectangle card.
//
// Geometry: the layout is parameterized so the circle fills its slot
// exactly (124px node in a 124px slot), which means the fork lines
// already meet the circle's top and bottom edges with no adjustment:
// stemTop is the parent circle's bottom, a drop's top is the child
// circle's top. Rows are 176px, so the parent->child gap is 52px.
// Names, photos, gender tints and the add/edit/delete actions all
// live inside (or on) the circle — nothing spills into the connector
// band, so no line ever crosses a label.
"use client";

import { useMemo } from "react";
import type { Person, SpouseLink } from "@/lib/types";
import { layoutSingleTree, type LineSide } from "./tree-graph";
import {
  displayName,
  IconButton,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from "./MemberCard";
import type { ViewCallbacks } from "./PedigreeView";

const NODE_D = 124;
const JUNCTION_W = 36;
const ROW_H = 176;

const SIDE_COLOR: Record<LineSide, string> = {
  husband: "#4a9eda",
  wife: "#ef8a2a",
  shared: "#7db8a4",
};

function initials(p: Person) {
  const a = p.given_name.trim().charAt(0);
  const b = (p.family_name ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function CircleNode({
  p,
  cb,
}: {
  p: Person;
  cb: ViewCallbacks;
}) {
  const name = displayName(p);
  const genderTone =
    p.gender === "male"
      ? "bg-sky-100 border-sky-300 text-sky-900"
      : p.gender === "female"
        ? "bg-rose-100 border-rose-300 text-rose-900"
        : "bg-stone-100 border-stone-300 text-stone-700";
  const genderGlyph =
    p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : null;
  return (
    <div
      data-person-id={p.id}
      title={name}
      className={`vv-card group relative shrink-0 rounded-full border-2 shadow-sm ${genderTone} flex flex-col items-center justify-center text-center overflow-hidden`}
      style={{ width: NODE_D, height: NODE_D }}
    >
      {p.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.photo_url}
          alt={name}
          className="w-10 h-10 rounded-full object-cover border border-white/70 shrink-0"
        />
      ) : (
        <div className="font-bold text-lg leading-none shrink-0">
          {initials(p)}
        </div>
      )}
      <div className="mt-1 px-3 w-full">
        <div className="font-medium text-xs leading-tight truncate">
          {p.given_name}
          {genderGlyph && <span className="ml-1">{genderGlyph}</span>}
        </div>
        {p.family_name && (
          <div className="text-[11px] leading-tight truncate opacity-80">
            {p.family_name}
          </div>
        )}
        {p.dob && (
          <div className="text-[10px] leading-tight opacity-60">
            b. {p.dob.slice(0, 4)}
          </div>
        )}
      </div>
      {cb.canEdit && (
        <div className="absolute top-1 right-1 flex bg-white/90 rounded-full shadow-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <IconButton
            title={`Add a relative of ${name}`}
            onClick={() => cb.onAdd(p)}
          >
            <PlusIcon title="Add relative" />
          </IconButton>
          <IconButton title={`Edit ${name}`} onClick={() => cb.onEdit(p)}>
            <PencilIcon title="Edit" />
          </IconButton>
          <IconButton
            title={`Delete ${name}`}
            danger
            onClick={() => cb.onDelete(p)}
          >
            <TrashIcon title="Delete" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

export default function CircleView({
  persons,
  spouses,
  cb,
}: {
  persons: Person[];
  spouses: SpouseLink[];
  cb: ViewCallbacks;
}) {
  const layout = useMemo(
    () =>
      layoutSingleTree(persons, spouses, {
        cardW: NODE_D,
        cardH: NODE_D,
        junctionW: JUNCTION_W,
        rowH: ROW_H,
        hGap: 36,
      }),
    [persons, spouses]
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
        {layout.forks.map((f) => (
          <g
            key={f.parentKey}
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
            <CircleNode p={u.main} cb={cb} />
            {u.pair && (
              <>
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: JUNCTION_W }}
                  aria-hidden
                >
                  <div className="w-full h-0.5 bg-rose-300 relative flex items-center justify-center">
                    <span className="bg-white border border-rose-300 text-rose-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] leading-none">
                      ⚭
                    </span>
                  </div>
                </div>
                <CircleNode p={u.pair} cb={cb} />
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
