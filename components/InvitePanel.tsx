// Invite-link generator for a tree (owners and editors).
"use client";

import { useState } from "react";
import { createInvite } from "@/app/trees/[id]/actions";

export default function InvitePanel({ treeId }: { treeId: string }) {
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const token = await createInvite(treeId, role);
      setLink(`${window.location.origin}/invite/${token}`);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Invite family</h3>
      <div className="flex gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
          className="!w-auto"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button type="button" className="btn-secondary" onClick={generate} disabled={busy}>
          {busy ? "Creating…" : "Create invite link"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {link && (
        <div className="text-sm">
          <p className="break-all bg-stone-100 rounded p-2 font-mono text-xs">
            {link}
          </p>
          <button type="button" className="btn-secondary mt-2 text-sm" onClick={copy}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <p className="text-xs text-stone-500 mt-1">
            Links expire after 30 days and are single-use.
          </p>
        </div>
      )}
    </div>
  );
}
