// Illustrative example tree: the Nehru family, four generations.
// This is NOT a user's tree — it exists only so the landing page can
// show what a VanshVriksh tree looks like. The same component renders
// faint as the hero background and at full strength in the showcase
// section (see app/page.tsx). Coordinates are hand-laid-out: couples
// sit side by side, children drop from the couple's midpoint.
interface ExampleNode {
  id: string;
  name: string;
  dates: string;
  cx: number;
  cy: number;
}

const NODES: ExampleNode[] = [
  { id: "motilal", name: "Motilal Nehru", dates: "1861 – 1931", cx: 425, cy: 60 },
  { id: "swarup", name: "Swarup Rani", dates: "1868 – 1954", cx: 575, cy: 60 },
  { id: "jawaharlal", name: "Jawaharlal Nehru", dates: "1889 – 1964", cx: 260, cy: 210 },
  { id: "kamala", name: "Kamala Nehru", dates: "1899 – 1936", cx: 410, cy: 210 },
  { id: "vijaya", name: "Vijaya Lakshmi Pandit", dates: "1900 – 1990", cx: 580, cy: 210 },
  { id: "krishna", name: "Krishna Hutheesing", dates: "1907 – 1967", cx: 740, cy: 210 },
  { id: "indira", name: "Indira Gandhi", dates: "1917 – 1984", cx: 260, cy: 360 },
  { id: "feroze", name: "Feroze Gandhi", dates: "1913 – 1960", cx: 410, cy: 360 },
  { id: "rajiv", name: "Rajiv Gandhi", dates: "1944 – 1991", cx: 190, cy: 510 },
  { id: "sonia", name: "Sonia Gandhi", dates: "b. 1946", cx: 350, cy: 510 },
  { id: "sanjay", name: "Sanjay Gandhi", dates: "1946 – 1980", cx: 550, cy: 510 },
  { id: "maneka", name: "Maneka Gandhi", dates: "b. 1956", cx: 710, cy: 510 },
];

const COUPLES: [string, string][] = [
  ["motilal", "swarup"],
  ["jawaharlal", "kamala"],
  ["indira", "feroze"],
  ["rajiv", "sonia"],
  ["sanjay", "maneka"],
];

// A parent group drops from a couple's midpoint down to a bar, then
// to each child (or child couple's midpoint) below.
const GROUPS: { parents: [string, string]; children: string[] }[] = [
  { parents: ["motilal", "swarup"], children: ["jawaharlal", "vijaya", "krishna"] },
  { parents: ["jawaharlal", "kamala"], children: ["indira"] },
  { parents: ["indira", "feroze"], children: ["rajiv", "sanjay"] },
];

const NODE_W = 150;
const NODE_H = 54;

function byId(id: string): ExampleNode {
  return NODES.find((n) => n.id === id)!;
}

/** Midpoint of a person, or of their couple if they are married here. */
function childMid(id: string): number {
  for (const [a, b] of COUPLES) {
    if (a === id || b === id) return (byId(a).cx + byId(b).cx) / 2;
  }
  return byId(id).cx;
}

export default function ExampleTree({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 590"
      className={className}
      role="img"
      aria-label="Illustrative example family tree: the Nehru family, from Motilal Nehru down to Rajiv and Sanjay Gandhi"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Parent → child drops */}
      {GROUPS.map((g, i) => {
        const parentMid =
          (byId(g.parents[0]).cx + byId(g.parents[1]).cx) / 2;
        const parentBottom = byId(g.parents[0]).cy + NODE_H / 2;
        const childTop = byId(g.children[0]).cy - NODE_H / 2;
        const barY = (parentBottom + childTop) / 2;
        const mids = g.children.map(childMid);
        const min = Math.min(...mids);
        const max = Math.max(...mids);
        return (
          <g key={i} stroke="#a7d7c5" strokeWidth="2" fill="none">
            <line x1={parentMid} y1={parentBottom} x2={parentMid} y2={barY} />
            {min !== max && <line x1={min} y1={barY} x2={max} y2={barY} />}
            {mids.map((m, j) => (
              <line key={j} x1={m} y1={barY} x2={m} y2={childTop} />
            ))}
          </g>
        );
      })}
      {/* Couple links */}
      {COUPLES.map(([a, b], i) => {
        const na = byId(a);
        const nb = byId(b);
        const mid = (na.cx + nb.cx) / 2;
        return (
          <g key={i}>
            <line
              x1={na.cx + NODE_W / 2}
              y1={na.cy}
              x2={nb.cx - NODE_W / 2}
              y2={nb.cy}
              stroke="#a7d7c5"
              strokeWidth="2"
            />
            <circle cx={mid} cy={na.cy} r="4" fill="#fff" stroke="#a7d7c5" strokeWidth="2" />
          </g>
        );
      })}
      {/* People */}
      {NODES.map((n) => (
        <g key={n.id}>
          <rect
            x={n.cx - NODE_W / 2}
            y={n.cy - NODE_H / 2}
            width={NODE_W}
            height={NODE_H}
            rx="12"
            fill="#ffffff"
            stroke="#a7d7c5"
            strokeWidth="1.5"
          />
          <text
            x={n.cx}
            y={n.cy - 2}
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            fill="#1c1917"
          >
            {n.name}
          </text>
          <text
            x={n.cx}
            y={n.cy + 16}
            textAnchor="middle"
            fontSize="11"
            fill="#78716c"
          >
            {n.dates}
          </text>
        </g>
      ))}
    </svg>
  );
}
