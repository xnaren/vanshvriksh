// Top-down pedigree: each family unit (person + pair-able spouse) renders
// as a couple block; children hang below joined by CSS pedigree lines.
//
// The unit plan is computed purely by buildFamilyUnits (no shared mutable
// state during React rendering) so server and client always agree — see
// tree-graph.ts for why this matters for hydration.
//
// A paired-away partner whose parents are also in the tree (e.g. a wife
// shown with her husband's family) gets a small "d/o · s/o" caption under
// her card; clicking it jumps the canvas to her birth family. No connector
// geometry to maintain, and it scales to any number of such links.
"use client";

import { useMemo } from "react";
import type { Person } from "@/lib/types";
import { inLawCaptions, type FamilyUnit } from "./tree-graph";
import MemberCard, { displayName } from "./MemberCard";

export interface ViewCallbacks {
  canEdit: boolean;
  zoom: number;
  onEdit: (p: Person) => void;
  onDelete: (p: Person) => void;
  onAdd: (p: Person) => void;
  onJumpBirthFamily: (unitKey: string) => void;
}

type CaptionInfo = { unitKey: string; label: string };

/** "d/o X & Y" — jumps the canvas to the person's birth family. */
function BirthCaption({
  person,
  captions,
  onJump,
}: {
  person: Person;
  captions: Map<string, CaptionInfo>;
  onJump: (unitKey: string) => void;
}) {
  const info = captions.get(person.id);
  if (!info) return null;
  const kin =
    person.gender === "female"
      ? "d/o"
      : person.gender === "male"
        ? "s/o"
        : "child of";
  return (
    <button
      type="button"
      onClick={() => onJump(info.unitKey)}
      title="Jump to birth family"
      className="mt-1 text-[11px] leading-tight text-stone-500 hover:text-emerald-700 underline decoration-dotted underline-offset-2"
    >
      {kin} {info.label}
    </button>
  );
}

function FamilyUnitView({
  unit,
  isRoot,
  cb,
  captions,
}: {
  unit: FamilyUnit;
  isRoot: boolean;
  cb: ViewCallbacks;
  captions: Map<string, CaptionInfo>;
}) {
  const { main: p, pair: pairWith, spouseNote: spouse, children } = unit;
  // `ref` children (paired-away partners with parents in the tree) are not
  // rendered as cards here — the d/o·s/o caption links them instead.
  const visibleChildren = children.filter((c) => !c.ref);
  // Reserve the caption row when either card in the couple has one, so the
  // marriage node stays vertically centered on the cards.
  const reserveCaptionRow =
    captions.has(p.id) || (pairWith ? captions.has(pairWith.id) : false);
  const card = (person: Person) => (
    <div className="flex flex-col items-center">
      <MemberCard
        p={person}
        canEdit={cb.canEdit}
        zoom={cb.zoom}
        onEdit={cb.onEdit}
        onDelete={cb.onDelete}
        onAdd={cb.onAdd}
      />
      {reserveCaptionRow && (
        <div className="mt-1 text-[11px] leading-tight min-h-[15px]">
          <BirthCaption
            person={person}
            captions={captions}
            onJump={cb.onJumpBirthFamily}
          />
        </div>
      )}
    </div>
  );
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
          {card(p)}
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
              {card(pairWith)}
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
              captions={captions}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PedigreeView({
  units,
  cb,
}: {
  units: FamilyUnit[];
  cb: ViewCallbacks;
}) {
  const captions = useMemo(() => inLawCaptions(units), [units]);
  return (
    <>
      {units.map((u) => (
        <FamilyUnitView
          key={u.main.id}
          unit={u}
          isRoot={true}
          cb={cb}
          captions={captions}
        />
      ))}
    </>
  );
}
