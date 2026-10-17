// Overlay drawing in-law birth arcs (paired-away partner's card -> their
// parents' couple block) so the pedigree reads as one connected tree.
//
// Robustness note: the pedigree <ul> uses CSS `zoom`, and zoom interacts
// subtly with SVG user units vs getBoundingClientRect, which made arcs land
// in the wrong place at some zoom levels. This overlay therefore lives
// OUTSIDE the zoomed layer — as a sibling sized to the scrollable canvas —
// and measures everything in screen pixels relative to the canvas box:
// (elRect - canvasRect + scroll). Screen pixels stay consistent no matter
// the zoom, so the arcs always stick to their cards. It scrolls with the
// content and remeasures on layout changes via ResizeObserver.
"use client";

import { useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { collectInLawArcs, type FamilyUnit } from "./tree-graph";

export default function InLawArcs({
  units,
  containerRef,
}: {
  units: FamilyUnit[];
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const specs = useMemo(() => collectInLawArcs(units), [units]);

  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c || specs.length === 0) {
      setPaths([]);
      setSize(null);
      return;
    }
    const measure = () => {
      const cRect = c.getBoundingClientRect();
      const ds: string[] = [];
      for (const s of specs) {
        const fromEl = c.querySelector(
          `[data-card-for="${CSS.escape(s.fromId)}"]`
        );
        const toEl = c.querySelector(
          `[data-unit-key="${CSS.escape(s.toUnitKey)}"]`
        );
        if (!(fromEl instanceof HTMLElement) || !(toEl instanceof HTMLElement))
          continue;
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const x1 = fr.left + fr.width / 2 - cRect.left + c.scrollLeft;
        const y1 = fr.top - cRect.top + c.scrollTop;
        const x2 = tr.left + tr.width / 2 - cRect.left + c.scrollLeft;
        const y2 = tr.top + tr.height - cRect.top + c.scrollTop;
        // Arc over the top when the parents sit above the card, else below.
        const dir = y2 <= y1 ? -1 : 1;
        const lift = 90;
        ds.push(
          `M ${x1} ${y1} C ${x1} ${y1 + dir * lift}, ${x2} ${y2 + dir * lift}, ${x2} ${y2}`
        );
      }
      setPaths(ds);
      setSize({ w: c.scrollWidth, h: c.scrollHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    return () => ro.disconnect();
  }, [specs, containerRef]);

  if (!size || specs.length === 0) return null;
  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={size.w}
      height={size.h}
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#a8a29e"
          strokeWidth={2}
          strokeDasharray="7 5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
