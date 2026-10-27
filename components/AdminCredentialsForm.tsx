// Change the admin's own credentials from inside the console.
// The current password/code must match first; the new values are
// stored only as scrypt hashes (see lib/admin-auth.ts) — never as
// plaintext, and never in a committed file.
"use client";

import { useState } from "react";
import { adminChangeCredentials } from "@/app/admin/actions";

export default function AdminCredentialsForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await adminChangeCredentials(new FormData(e.currentTarget));
    setBusy(false);
    setMsg(
      res.ok
        ? "Admin credentials updated. Use the new password and code next time you sign in."
        : `Error: ${res.error}`
    );
    if (res.ok) e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="font-semibold">Change admin credentials</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Current password</label>
          <input name="currentPassword" type="password" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Current code</label>
          <input name="currentOtp" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            New password (min 8 characters)
          </label>
          <input name="newPassword" type="password" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            New code (min 6 characters)
          </label>
          <input name="newOtp" required />
        </div>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Update admin credentials"}
      </button>
      {msg && <p className="text-sm text-stone-600">{msg}</p>}
    </form>
  );
}
