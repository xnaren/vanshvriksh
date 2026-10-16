// Member card shared by the pedigree and outline views: photo/initials
// avatar, current location in the details line (gotra lives in the hover
// card), icon buttons instead of text, and a hover tooltip with the full
// member details.
"use client";

import { useEffect, useRef, useState } from "react";
import type { Person } from "@/lib/types";

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

export const PlusIcon = ({ title }: { title: string }) => (
  <IconBase title={title}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </IconBase>
);

export const PencilIcon = ({ title }: { title: string }) => (
  <IconBase title={title}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </IconBase>
);

export const TrashIcon = ({ title }: { title: string }) => (
  <IconBase title={title}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </IconBase>
);

export function IconButton({
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

export function displayName(p: Person) {
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

function lifespan(p: Person): string | null {
  const birth = year(p.dob);
  const death = year(p.dod);
  if (birth && death) return `${birth}–${death}`;
  if (birth) return p.is_living ? `b. ${birth}` : `${birth}–?`;
  if (death) return `d. ${death}`;
  if (!p.is_living) return "†";
  return null;
}

/** Card line: current location first, then dates, then native place. */
export function detailsLine(p: Person): string {
  const bits: string[] = [];
  if (p.current_location) bits.push(p.current_location);
  const life = lifespan(p);
  if (life) bits.push(life);
  if (p.native_place) bits.push(p.native_place);
  return bits.join(" · ");
}

/* ---------- hover tooltip ---------- */

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-stone-400 w-24 shrink-0">{label}</span>
      <span className="text-stone-700">{value}</span>
    </div>
  );
}

function MemberTooltip({ p }: { p: Person }) {
  const life = lifespan(p);
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-xl p-3 w-64 space-y-1">
      <div className="font-semibold text-sm">
        {displayName(p)}
        {p.nickname && (
          <span className="font-normal text-stone-500"> · “{p.nickname}”</span>
        )}
      </div>
      <div className="pt-1 space-y-1">
        <DetailRow label="Gotra" value={p.gotra} />
        <DetailRow
          label="Gender"
          value={
            p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : null
          }
        />
        <DetailRow
          label="Born"
          value={[p.dob, p.birth_place].filter(Boolean).join(" · ") || life}
        />
        <DetailRow label="Passed away" value={p.dod} />
        <DetailRow label="Native place" value={p.native_place} />
        <DetailRow label="Lives in" value={p.current_location} />
        <DetailRow label="Status" value={p.is_living ? "Living" : undefined} />
        {p.notes && (
          <div className="text-xs text-stone-600 pt-1 border-t border-stone-100 mt-1">
            {p.notes}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- card ---------- */

export default function MemberCard({
  p,
  canEdit,
  zoom,
  onEdit,
  onDelete,
  onAdd,
}: {
  p: Person;
  canEdit: boolean;
  /** Hides the tooltip when the canvas zoom changes (position would go stale). */
  zoom: number;
  onEdit: (p: Person) => void;
  onDelete: (p: Person) => void;
  onAdd: (p: Person) => void;
}) {
  const name = displayName(p);
  const details = detailsLine(p);
  // Gender coding: tinted avatar (or ring on photos) + a small glyph, so
  // gender reads at a glance. Blue = male, rose = female, neutral = other.
  const genderTone =
    p.gender === "male"
      ? { bg: "bg-sky-100 text-sky-800", ring: "ring-sky-300" }
      : p.gender === "female"
        ? { bg: "bg-rose-100 text-rose-800", ring: "ring-rose-300" }
        : { bg: "bg-stone-100 text-stone-600", ring: "ring-stone-200" };
  const genderGlyph =
    p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : null;
  const cardRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<{ x: number; above: boolean } | null>(null);

  const hideTip = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    rectRef.current = null;
    setTip(null);
  };

  // Stale position guard: zooming or scrolling the canvas moves the card.
  useEffect(() => hideTip, [zoom]);
  useEffect(() => {
    window.addEventListener("scroll", hideTip, true);
    return () => window.removeEventListener("scroll", hideTip, true);
  }, []);

  function onEnter() {
    timer.current = setTimeout(() => {
      const el = cardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      rectRef.current = r;
      const w = 264; // tooltip width (w-64 + padding)
      const x = Math.min(
        Math.max(8, r.left + r.width / 2 - w / 2),
        Math.max(8, window.innerWidth - w - 8)
      );
      setTip({ x, above: r.top > 300 });
    }, 350);
  }

  // Position vertically once the tooltip has measured itself.
  useEffect(() => {
    const tipEl = tipRef.current;
    const r = rectRef.current;
    if (!tip || !tipEl || !r) return;
    const h = tipEl.offsetHeight;
    tipEl.style.top = tip.above
      ? `${Math.max(8, r.top - h - 8)}px`
      : `${r.bottom + 8}px`;
  }, [tip]);

  return (
    <div
      ref={cardRef}
      className="vv-card group relative bg-white border border-stone-200 rounded-xl pl-2.5 pr-2 py-2 shadow-sm w-48 shrink-0"
      onMouseEnter={onEnter}
      onMouseLeave={hideTip}
    >
      <div className="flex items-center gap-2.5">
        {/* avatar: uploaded photo when set, initials otherwise */}
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photo_url}
            alt={name}
            className={`w-10 h-10 rounded-full object-cover shrink-0 border border-stone-200 ring-2 ${genderTone.ring}`}
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full ${genderTone.bg} flex items-center justify-center font-semibold text-sm shrink-0`}
          >
            {initials(p)}
          </div>
        )}
        <div className="min-w-0 pr-1">
          <div
            className="font-medium text-sm leading-tight truncate"
            title={name}
          >
            {name}
            {p.nickname && (
              <span className="font-normal text-stone-400"> · {p.nickname}</span>
            )}
            {genderGlyph && (
              <span
                className={`ml-1 text-xs ${p.gender === "male" ? "text-sky-500" : "text-rose-500"}`}
                aria-label={p.gender ?? undefined}
              >
                {genderGlyph}
              </span>
            )}
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
          <IconButton
            title={`Add a relative of ${name}`}
            onClick={() => onAdd(p)}
          >
            <PlusIcon title="Add relative" />
          </IconButton>
          <IconButton title={`Edit ${name}`} onClick={() => onEdit(p)}>
            <PencilIcon title="Edit" />
          </IconButton>
          <IconButton
            title={`Delete ${name}`}
            danger
            onClick={() => onDelete(p)}
          >
            <TrashIcon title="Delete" />
          </IconButton>
        </div>
      )}
      {tip && (
        <div
          ref={tipRef}
          className="fixed z-50"
          style={{ left: tip.x, top: -9999 }}
        >
          <MemberTooltip p={p} />
        </div>
      )}
    </div>
  );
}
