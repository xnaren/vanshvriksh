// Timeline view: every dated person as a lifespan bar on a year
// axis, grouped into generation bands. Who was alive at the same
// time — and date mistakes — become visible at a glance.
"use client";

import { useMemo, useRef, useEffect } from "react";
import type { Person } from "@/lib/types";
import { layoutTimeline } from "./tree-graph";
import { displayName } from "./MemberCard";

const ROW_H = 26;
const LABEL_W = 168;
const PX_PER_YEAR = 7;
const PAD_YEARS = 4;

export default function TimelineView({
  persons,
  highlightId,
}: {
  persons: Person[];
  highlightId?: string | null;
}) {
  const now = new Date().getFullYear();
  const layout = useMemo(() => layoutTimeline(persons, now), [persons, now]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightId || !rootRef.current) return;
    const el = rootRef.current.querySelector(
      `[data-person-id="${CSS.escape(highlightId)}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      el.classList.add("vv-flash");
      window.setTimeout(() => el.classList.remove("vv-flash"), 2300);
    }
  }, [highlightId]);

  if (layout.entries.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 text-sm text-stone-500 self-start">
        Nobody in this tree has a birth date recorded yet. Add dates of
        birth (the edit form has a field for it) and this view will draw
        everyone's lifespans on one axis.
      </div>
    );
  }

  const minY = layout.minYear - PAD_YEARS;
  const maxY = layout.maxYear + PAD_YEARS;
  const plotW = Math.max(560, (maxY - minY) * PX_PER_YEAR);
  const x = (year: number) => LABEL_W + (year - minY) * PX_PER_YEAR;
  const height = layout.entries.length * ROW_H + 34;

  // Decade gridlines
  const decades: number[] = [];
  for (let y = Math.ceil(minY / 10) * 10; y <= maxY; y += 10) decades.push(y);

  // Generation band spans (rows are sorted by gen)
  const bands: { gen: number; fromRow: number; toRow: number }[] = [];
  for (const e of layout.entries) {
    const last = bands[bands.length - 1];
    if (last && last.gen === e.gen) last.toRow = e.row;
    else bands.push({ gen: e.gen, fromRow: e.row, toRow: e.row });
  }

  return (
    <div ref={rootRef} className="self-start p-4">
      <div className="relative" style={{ width: LABEL_W + plotW, height }}>
        {/* generation bands */}
        {bands.map((b) => (
          <div
            key={b.gen}
            className="absolute left-0 right-0 rounded"
            style={{
              top: b.fromRow * ROW_H + 22,
              height: (b.toRow - b.fromRow + 1) * ROW_H,
              background: b.gen % 2 === 0 ? "rgba(16,185,129,0.05)" : "rgba(245,158,11,0.05)",
            }}
          >
            <span className="absolute right-1 top-0.5 text-[10px] font-medium text-stone-400">
              Gen {b.gen + 1}
            </span>
          </div>
        ))}
        {/* decade gridlines + labels */}
        {decades.map((y) => (
          <div key={y}>
            <div
              className="absolute top-[22px] bottom-0 w-px bg-stone-200"
              style={{ left: x(y) }}
            />
            <div
              className="absolute text-[10px] text-stone-400"
              style={{ left: x(y) + 3, top: 4 }}
            >
              {y}
            </div>
          </div>
        ))}
        {/* today marker */}
        <div
          className="absolute top-[22px] bottom-0 w-px bg-emerald-400"
          style={{ left: x(now) }}
          aria-hidden
        />
        {/* bars */}
        {layout.entries.map((e) => {
          const end = e.endYear ?? e.birthYear + 1;
          const bx = x(e.birthYear);
          const bw = Math.max(6, (end - e.birthYear) * PX_PER_YEAR);
          const male = e.person.gender === "male";
          const female = e.person.gender === "female";
          return (
            <div
              key={e.person.id}
              className="absolute flex items-center"
              style={{ top: e.row * ROW_H + 22, height: ROW_H }}
              data-person-id={e.person.id}
            >
              <div
                className="text-xs text-stone-600 truncate text-right pr-2"
                style={{ width: LABEL_W }}
                title={displayName(e.person)}
              >
                {displayName(e.person)}
              </div>
              <div
                className="relative h-[13px] rounded-full"
                style={{
                  left: 0,
                  marginLeft: bx - LABEL_W,
                  width: bw,
                  background: male
                    ? "linear-gradient(90deg,#4a9eda,#2f6db3)"
                    : female
                      ? "linear-gradient(90deg,#f6a95c,#ef8a2a)"
                      : "#a8a29e",
                  opacity: e.endYear === null ? 0.55 : 1,
                  borderRight: e.endYear === null ? "3px dashed #78716c" : undefined,
                }}
                title={`${displayName(e.person)}: ${e.birthYear} – ${e.living ? "present" : (e.endYear ?? "?")}`}
              />
              <span className="text-[10px] text-stone-400 pl-1.5 whitespace-nowrap">
                {e.birthYear}–{e.living ? "…" : (e.endYear ?? "?")}
              </span>
            </div>
          );
        })}
      </div>
      {layout.undated.length > 0 && (
        <p className="text-xs text-stone-500 mt-3 max-w-2xl">
          No birth date recorded yet:{" "}
          {layout.undated.map((p) => displayName(p)).join(", ")} — add a
          date of birth to place them on the timeline.
        </p>
      )}
    </div>
  );
}
