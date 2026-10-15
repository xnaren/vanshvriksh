// Top-right tree toolbar: member count, role badge, tree-members popover,
// member search (placeholder for now), and owner-only delete-tree icon.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTree } from "@/app/trees/[id]/actions";
import type { RosterEntry } from "@/lib/types";

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ToolButton({
  title,
  onClick,
  danger,
  disabled,
  children,
}: {
  title: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm transition-colors ${
        disabled
          ? "text-stone-300 cursor-not-allowed"
          : danger
            ? "text-stone-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            : "text-stone-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function TreeToolbar({
  treeId,
  treeName,
  memberCount,
  role,
  isOwner,
  roster,
}: {
  treeId: string;
  treeName: string;
  memberCount: number;
  role: string;
  isOwner: boolean;
  roster: RosterEntry[];
}) {
  const router = useRouter();
  const [showRoster, setShowRoster] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onDeleteTree() {
    if (
      !confirm(
        `Delete the tree "${treeName}" and everyone in it? This can't be undone.`
      )
    )
      return;
    if (
      !confirm("Really delete it? All members, links and invites go with it.")
    )
      return;
    setBusy(true);
    try {
      await deleteTree(treeId);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-stone-500">
        {memberCount} {memberCount === 1 ? "member" : "members"}
      </span>
      <span className="text-xs text-stone-500 bg-stone-100 rounded px-2 py-1">
        your role: {role}
      </span>

      <div className="relative">
        <ToolButton
          title="Tree members (app users)"
          onClick={() => setShowRoster((v) => !v)}
        >
          <UsersIcon />
        </ToolButton>
        {showRoster && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowRoster(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-50 w-60 bg-white border border-stone-200 rounded-lg shadow-lg p-3">
              <h4 className="text-sm font-semibold mb-2">Tree members</h4>
              {roster.length === 0 ? (
                <p className="text-xs text-stone-500">No members yet.</p>
              ) : (
                <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
                  {roster.map((m, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{m.profiles?.username ?? "—"}</span>
                      <span className="text-stone-500 shrink-0">{m.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <ToolButton title="Search members — coming soon" disabled>
        <SearchIcon />
      </ToolButton>

      {isOwner && (
        <ToolButton
          title="Delete this tree"
          danger
          disabled={busy}
          onClick={onDeleteTree}
        >
          <TrashIcon />
        </ToolButton>
      )}
    </div>
  );
}
