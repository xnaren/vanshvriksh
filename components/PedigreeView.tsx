// Top-down pedigree: each family unit (person + pair-able spouse) renders
// as a couple block; children hang below joined by CSS pedigree lines.
//
// The unit plan is computed purely by buildFamilyUnits (no shared mutable
// state during React rendering) so server and client always agree — see
// tree-graph.ts for why this matters for hydration.
"use client";

import { useMemo } from "react";
import type { Person } from "@/lib/types";
import { buildFamilyUnits, type FamilyUnit } from "./tree-graph";
import MemberCard, { displayName } from "./MemberCard";

export interface ViewCallbacks {
  canEdit: boolean;
  zoom: number;
  onEdit: (p: Person) => void;
  onDelete: (p: Person) => void;
  onAdd: (p: Person) => void;
}

function FamilyUnitView({
  unit,
  isRoot,
  cb,
}: {
  unit: FamilyUnit;
  isRoot: boolean;
  cb: ViewCallbacks;
}) {
  const { main: p, pair: pairWith, spouseNote: spouse, children } = unit;
  return (
    <li
      className={isRoot ? "flex flex-col items-center shrink-0" : "vv-family"}
    >
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <MemberCard
            p={p}
            canEdit={cb.canEdit}
            zoom={cb.zoom}
            onEdit={cb.onEdit}
            onDelete={cb.onDelete}
            onAdd={cb.onAdd}
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
              <MemberCard
                p={pairWith}
                canEdit={cb.canEdit}
                zoom={cb.zoom}
                onEdit={cb.onEdit}
                onDelete={cb.onDelete}
                onAdd={cb.onAdd}
              />
            </>
          )}
        </div>
        {spouse && (
          <div className="text-xs text-stone-500 mt-1">
            ⚭ {displayName(spouse)}
          </div>
        )}
      </div>
      {children.length > 0 && (
        <ul className="vv-children">
          {children.map((c) => (
            <FamilyUnitView
              key={c.main.id}
              unit={c}
              isRoot={false}
              cb={cb}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PedigreeView({
  persons,
  spouses,
  cb,
}: {
  persons: Person[];
  spouses: import("@/lib/types").SpouseLink[];
  cb: ViewCallbacks;
}) {
  const units = useMemo(
    () => buildFamilyUnits(persons, spouses),
    [persons, spouses]
  );
  return (
    <>
      {units.map((u) => (
        <FamilyUnitView key={u.main.id} unit={u} isRoot={true} cb={cb} />
      ))}
    </>
  );
}
