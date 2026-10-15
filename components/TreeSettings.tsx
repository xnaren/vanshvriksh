// Tree settings: rename. Rendered on the tree page for owners only —
// the server action enforces it too. (Delete lives in the top toolbar.)
"use client";

import { useState } from "react";
import { updateTreeName } from "@/app/trees/[id]/actions";

export default function TreeSettings({
  treeId,
  currentName,
}: {
  treeId: string;
  currentName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold">Tree settings</h3>
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
    </div>
  );
}
