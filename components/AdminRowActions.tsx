// Admin row actions (client): delete + password reset for a user,
// delete for a tree. Every action re-verifies the admin session
// server-side. Destructive actions ask for confirmation first, and
// a reset password is shown once, in this component's state only —
// it is never written to the database or the page.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminDeleteTree,
  adminDeleteUser,
  adminResetUserPassword,
} from "@/app/admin/actions";

export function UserRowActions({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  async function onDelete() {
    if (
      !confirm(
        `Delete user ${username}? This also deletes every tree they created (and everyone in those trees), then the account itself. This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    setMsg("");
    const res = await adminDeleteUser(userId);
    setBusy(false);
    if (!res.ok) {
      setMsg(`Error: ${res.error}`);
      return;
    }
    setMsg(`Deleted ${username} (${res.treesDeleted ?? 0} tree(s) deleted with them).`);
    router.refresh();
  }

  async function onReset() {
    if (
      !confirm(
        `Reset the password for ${username}? A new temporary password will be shown once below — pass it to the user yourself.`
      )
    )
      return;
    setBusy(true);
    setMsg("");
    setTempPassword("");
    const res = await adminResetUserPassword(userId);
    setBusy(false);
    if (!res.ok) {
      setMsg(`Error: ${res.error}`);
      return;
    }
    setTempPassword(res.tempPassword ?? "");
    setMsg("Password reset — temporary password below (shown once).");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary !py-1 text-xs"
          disabled={busy}
          onClick={onReset}
        >
          Reset password
        </button>
        <button
          type="button"
          className="btn-secondary !py-1 text-xs !text-red-700"
          disabled={busy}
          onClick={onDelete}
        >
          {busy ? "Working…" : "Delete user"}
        </button>
      </div>
      {msg && <p className="text-xs text-stone-600 text-right">{msg}</p>}
      {tempPassword && (
        <p className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1 break-all">
          Temporary password: <strong>{tempPassword}</strong>
        </p>
      )}
    </div>
  );
}

export function TreeRowActions({
  treeId,
  treeName,
}: {
  treeId: string;
  treeName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onDelete() {
    if (
      !confirm(
        `Delete tree "${treeName}"? This deletes every person, spouse link, membership and invite in it. This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    const res = await adminDeleteTree(treeId);
    setBusy(false);
    if (!res.ok) {
      setMsg(`Error: ${res.error}`);
      return;
    }
    setMsg("Deleted.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn-secondary !py-1 text-xs !text-red-700"
        disabled={busy}
        onClick={onDelete}
      >
        {busy ? "Working…" : "Delete tree"}
      </button>
      {msg && <p className="text-xs text-stone-600">{msg}</p>}
    </div>
  );
}
