// Tree settings: rename + visibility. Rendered on the tree page for
// owners only — the server actions enforce it too. (Delete lives in
// the top toolbar.)
"use client";

import { useState } from "react";
import { updateTreeName, updateTreeVisibility } from "@/app/trees/[id]/actions";

export default function TreeSettings({
  treeId,
  currentName,
  currentVisibility,
  bare,
}: {
  treeId: string;
  currentName: string;
  currentVisibility: "invite" | "private" | "public";
  bare?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [visBusy, setVisBusy] = useState(false);
  const [visMsg, setVisMsg] = useState("");

  async function onRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await updateTreeName(treeId, new FormData(e.currentTarget));
      setMsg("Renamed ✓");
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    }
    setBusy(false);
  }

  async function onVisibility(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVisBusy(true);
    setVisMsg("");
    try {
      await updateTreeVisibility(treeId, new FormData(e.currentTarget));
      setVisMsg("Visibility saved ✓");
    } catch (err) {
      setVisMsg(`Error: ${(err as Error).message}`);
    }
    setVisBusy(false);
  }

  return (
    <div className={bare ? "space-y-4" : "card space-y-4"}>
      {!bare && <h3 className="font-semibold">Tree settings</h3>}
      <form onSubmit={onRename} className="space-y-2">
        <label className="block text-sm font-medium">Tree name</label>
        <div className="flex gap-2">
          <input
            name="name"
            defaultValue={currentName}
            required
            maxLength={80}
            className="flex-1"
          />
          <button type="submit" disabled={busy} className="btn-secondary whitespace-nowrap">
            {busy ? "Saving…" : "Rename"}
          </button>
        </div>
      </form>
      {msg && <p className="text-sm">{msg}</p>}
      <form onSubmit={onVisibility} className="space-y-2">
        <label className="block text-sm font-medium">Who can view this tree</label>
        <select name="visibility" defaultValue={currentVisibility}>
          <option value="private">Private — members only</option>
          <option value="invite">Invite-only — members only</option>
          <option value="public">Public — anyone can view (members still edit)</option>
        </select>
        <p className="text-xs text-stone-500">
          In a public tree, members marked private in their edit form are
          hidden from public viewers.
        </p>
        <button type="submit" disabled={visBusy} className="btn-secondary">
          {visBusy ? "Saving…" : "Save visibility"}
        </button>
      </form>
      {visMsg && <p className="text-sm">{visMsg}</p>}
    </div>
  );
}
