// Tree settings: rename and delete. Rendered on the tree page for owners
// only — the server actions enforce it too.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTreeName, deleteTree } from "@/app/trees/[id]/actions";

export default function TreeSettings({
  treeId,
  currentName,
}: {
  treeId: string;
  currentName: string;
}) {
  const router = useRouter();
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

  async function onDelete() {
    if (
      !confirm(
        `Delete the tree "${currentName}" and everyone in it? This can't be undone.`
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
      setMsg(`Error: ${(err as Error).message}`);
      setBusy(false);
    }
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
      <div className="border-t border-stone-200 pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="text-sm text-red-600 hover:underline"
        >
          Delete this tree…
        </button>
        <p className="text-xs text-stone-500 mt-1">
          Removes the tree, all members, links and invites. Only the owner sees
          this.
        </p>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
