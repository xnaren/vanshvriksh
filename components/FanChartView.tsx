// Radial fan chart: focus person at the center, ancestors in rings
// around them (father's half left in blues, mother's half right in
// oranges). Clicking any arc re-centers the fan on that person.
"use client";

import { useMemo } from "react";
import type { Person } from "@/lib/types";
import { layoutFanChart, type FanSegment } from "./tree-graph";
import { displayName } from "./MemberCard";

const CENTER_R = 84;
const RING_W = [0, 96, 82, 70, 60, 52]; // by depth (index 0 unused)
const FATHER_FILL = ["", "#2f6db3", "#4a9eda", "#7db8e0", "#a9d0ef", "#d2e7f8"];
const MOTHER_FILL = ["", "#d96f16", "#ef8a2a", "#f6a95c", "#fac490", "#fde3c2"];

const radiusAt = (depth: number) => {
  let r = CENTER_R;
  for (let d = 1; d <= depth; d++) r += RING_W[d] ?? 48;
  return r;
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};

/** Annular sector path with small gaps so segments read as tiles. */
function sectorPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  a0: number,
  a1: number
): string {
  const gap = Math.min(1.2, (a1 - a0) / 4);
  const s = a0 + gap / 2;
  const e = a1 - gap / 2;
  const [x0, y0] = polar(cx, cy, rOut, s);
  const [x1, y1] = polar(cx, cy, rOut, e);
  const [x2, y2] = polar(cx, cy, rIn + 2, e);
  const [x3, y3] = polar(cx, cy, rIn + 2, s);
  const large = e - s > 180 ? 1 : 0;
  return [
    `M ${x0.toFixed(1)} ${y0.toFixed(1)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`,
    `L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    `A ${rIn + 2} ${rIn + 2} 0 ${large} 0 ${x3.toFixed(1)} ${y3.toFixed(1)}`,
    "Z",
  ].join(" ");
}

function Segment({
  seg,
  cx,
  cy,
  onFocus,
}: {
  seg: FanSegment;
  cx: number;
  cy: number;
  onFocus: (id: string) => void;
}) {
  const rIn = radiusAt(seg.depth - 1);
  const rOut = radiusAt(seg.depth);
  const rMid = (rIn + rOut) / 2;
  const mid = (seg.startAngle + seg.endAngle) / 2;
  const [tx, ty] = polar(cx, cy, rMid, mid);
  // Radial label: readable from outside everywhere (flip on left half).
  const flip = mid > 90 && mid < 270;
  const rot = flip ? mid + 180 : mid;
  const arcLen = ((seg.endAngle - seg.startAngle) * Math.PI) / 180 * rMid;
  const name = displayName(seg.person);
  const label =
    arcLen > 120 ? name : arcLen > 52 ? seg.person.given_name : arcLen > 30 ? seg.person.given_name.slice(0, 1) : "";
  const fill = (seg.side === "father" ? FATHER_FILL : MOTHER_FILL)[seg.depth] ?? "#d6d3d1";
  const dark = seg.depth >= 4;
  return (
    <g
      className="cursor-pointer"
      onClick={() => onFocus(seg.person.id)}
      role="button"
      aria-label={`Center fan on ${name}`}
    >
      <title>{`${name}${seg.person.dob ? ` (b. ${seg.person.dob.slice(0, 4)})` : ""} — click to center`}</title>
      <path
        d={sectorPath(cx, cy, rIn, rOut, seg.startAngle, seg.endAngle)}
        fill={fill}
        stroke="white"
        strokeWidth={1.5}
        className="hover:opacity-80 transition-opacity"
      />
      {label && (
        <text
          x={tx}
          y={ty}
          transform={`rotate(${rot} ${tx} ${ty})`}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={seg.depth === 1 ? 13 : seg.depth === 2 ? 12 : 11}
          fontWeight={seg.depth <= 2 ? 600 : 500}
          fill={dark ? "#44403c" : "white"}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export default function FanChartView({
  persons,
  focusId,
  onFocus,
}: {
  persons: Person[];
  focusId: string;
  onFocus: (id: string) => void;
}) {
  const layout = useMemo(
    () => layoutFanChart(persons, focusId),
    [persons, focusId]
  );
  if (!layout) return null;
  const size = radiusAt(Math.max(layout.maxDepth, 1)) + 10;
  const c = size;
  const focus = layout.focus;
  return (
    <div className="flex flex-col items-center">
      <svg width={size * 2} height={size * 2} role="img" aria-label={`Fan chart for ${displayName(focus)}`}>
        {/* faint ring guides so empty arcs read as "not recorded" */}
        {Array.from({ length: Math.max(layout.maxDepth, 1) }, (_, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={radiusAt(i + 1)}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth={1}
          />
        ))}
        {layout.segments.map((s) => (
          <Segment
            key={`${s.person.id}-${s.depth}`}
            seg={s}
            cx={c}
            cy={c}
            onFocus={onFocus}
          />
        ))}
        {/* center: the focus person */}
        <circle cx={c} cy={c} r={CENTER_R} fill="#065f46" />
        <circle cx={c} cy={c} r={CENTER_R} fill="none" stroke="white" strokeWidth={2} />
        <text
          x={c}
          y={c - 8}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill="white"
          style={{ pointerEvents: "none" }}
        >
          {focus.given_name}
        </text>
        <text
          x={c}
          y={c + 12}
          textAnchor="middle"
          fontSize={11}
          fill="#a7f3d0"
          style={{ pointerEvents: "none" }}
        >
          {focus.family_name ?? ""}
        </text>
        {focus.dob && (
          <text
            x={c}
            y={c + 30}
            textAnchor="middle"
            fontSize={10}
            fill="#a7f3d0"
            style={{ pointerEvents: "none" }}
          >
            b. {focus.dob.slice(0, 4)}
          </text>
        )}
      </svg>
      {layout.segments.length === 0 ? (
        <p className="text-sm text-stone-500 mt-2">
          No ancestors recorded yet for {displayName(focus)} — add a father
          or mother to start the fan.
        </p>
      ) : (
        <p className="text-xs text-stone-400 mt-2">
          Father's side left (blue) · Mother's side right (orange) · click
          any name to center the fan on them
        </p>
      )}
    </div>
  );
}
