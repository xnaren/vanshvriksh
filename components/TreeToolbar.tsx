// Top-right tree control strip: add-member, tree-members popover, member
// search (placeholder), invite popover, settings popover, owner-only
// delete-tree icon — plus the role pill. The member count lives on the
// "+" tooltip to keep the bar minimal.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTree } from "@/app/trees/[id]/actions";
import type { Person, RosterEntry, SpouseLink } from "@/lib/types";
import { buildGedcom } from "@/lib/gedcom";
import AddRelativeModal from "./AddRelativeModal";
import GedcomImportModal from "./GedcomImportModal";
import InvitePanel from "./InvitePanel";
import TreeSettings from "./TreeSettings";

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

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

function InviteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ToolButton({
  title,
  onClick,
  danger,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded-full border shadow-sm transition-colors ${
        disabled
          ? "text-stone-300 border-stone-200 bg-white cursor-not-allowed"
          : active
            ? "text-emerald-700 border-emerald-300 bg-emerald-50"
            : danger
              ? "text-stone-500 border-stone-200 bg-white hover:text-red-600 hover:border-red-200 hover:bg-red-50"
              : "text-stone-500 border-stone-200 bg-white hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50"
      }`}
    >
      {children}
    </button>
  );
}

type Panel = "members" | "invite" | "settings" | null;

export default function TreeToolbar({
  treeId,
  treeName,
  memberCount,
  role,
  canEdit,
  isOwner,
  persons,
  roster,
  fullPersons,
  spouses,
}: {
  treeId: string;
  treeName: string;
  memberCount: number;
  role: string;
  canEdit: boolean;
  isOwner: boolean;
  persons: Pick<Person, "id" | "given_name" | "family_name">[];
  roster: RosterEntry[];
  fullPersons: Person[];
  spouses: SpouseLink[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = (p: Exclude<Panel, null>) =>
    setPanel((cur) => (cur === p ? null : p));

  function onExportGedcom() {
    const ged = buildGedcom(fullPersons, spouses, treeName);
    const blob = new Blob([ged], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = treeName
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);
    a.download = `${safe || "family-tree"}.ged`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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

  const countLabel = `${memberCount} ${memberCount === 1 ? "member" : "members"}`;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-stone-500 bg-stone-100 rounded px-2 py-1 mr-1">
        your role: {role}
      </span>

      {canEdit && (
        <ToolButton
          title={`Add member · ${countLabel} in tree`}
          onClick={() => setAdding(true)}
        >
          <PlusIcon />
        </ToolButton>
      )}

      <div className="relative">
        <ToolButton
          title={`Tree members · ${countLabel}`}
          active={panel === "members"}
          onClick={() => toggle("members")}
        >
          <UsersIcon />
        </ToolButton>
        {panel === "members" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPanel(null)} />
            <div className="absolute right-0 top-full mt-2 z-50 w-60 bg-white border border-stone-200 rounded-lg shadow-lg p-3">
              <h4 className="text-sm font-semibold mb-2">
                Tree members · {memberCount}
              </h4>
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

      <ToolButton title="Export tree as GEDCOM (.ged)" onClick={onExportGedcom}>
        <DownloadIcon />
      </ToolButton>

      {canEdit && (
        <ToolButton title="Import GEDCOM (.ged) file" onClick={() => setImporting(true)}>
          <UploadIcon />
        </ToolButton>
      )}

      {canEdit && (
        <div className="relative">
          <ToolButton
            title="Invite family"
            active={panel === "invite"}
            onClick={() => toggle("invite")}
          >
            <InviteIcon />
          </ToolButton>
          {panel === "invite" && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPanel(null)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white border border-stone-200 rounded-lg shadow-lg p-4">
                <h4 className="text-sm font-semibold mb-3">Invite family</h4>
                <InvitePanel treeId={treeId} bare />
              </div>
            </>
          )}
        </div>
      )}

      {isOwner && (
        <div className="relative">
          <ToolButton
            title="Tree settings"
            active={panel === "settings"}
            onClick={() => toggle("settings")}
          >
            <GearIcon />
          </ToolButton>
          {panel === "settings" && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPanel(null)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white border border-stone-200 rounded-lg shadow-lg p-4">
                <h4 className="text-sm font-semibold mb-3">Tree settings</h4>
                <TreeSettings treeId={treeId} currentName={treeName} bare />
              </div>
            </>
          )}
        </div>
      )}

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

      {adding && (
        <AddRelativeModal
          treeId={treeId}
          persons={persons}
          onClose={() => setAdding(false)}
        />
      )}

      {importing && (
        <GedcomImportModal treeId={treeId} onClose={() => setImporting(false)} />
      )}
    </div>
  );
}
