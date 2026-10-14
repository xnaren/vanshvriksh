// ─────────────────────────────────────────────────────────────
// DEV-ONLY — remove before going live.
// One-click sign-in for local development. On first use it creates a
// fixed dev user (username "dev"); afterwards it just signs that user in
// with a password grant, skipping username + bot-check + email OTP.
//
// Double-gated so it can never run in production, even if you forget to
// delete it:
//   1. This action throws unless NODE_ENV != "production".
//   2. The button that calls it is not rendered in production builds
//      (Next.js inlines NODE_ENV at build time in app/login/page.tsx).
//
// To remove: delete this file AND the dev button block in
// app/login/page.tsx (search for "DEV-ONLY").
// ─────────────────────────────────────────────────────────────
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEV_EMAIL = "dev@vanshvriksh.local";
const DEV_USERNAME = "dev";

function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev sign-in is disabled in production.");
  }
}

export async function devSignIn() {
  assertDev();
  const password = process.env.DEV_LOGIN_PASSWORD || "vanshvriksh-dev";

  const admin = createAdminClient();

  // Get-or-create the dev auth user.
  let userId: string;
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: DEV_EMAIL,
      password,
      email_confirm: true,
    });
  if (createErr) {
    if (!/already|exists|registered/i.test(createErr.message)) {
      throw createErr;
    }
    const { data: listed, error: listErr } =
      await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const found = listed.users.find((u) => u.email === DEV_EMAIL);
    if (!found) throw new Error("Dev user exists but could not be found.");
    userId = found.id;
    // Reset the password in case it was changed between sessions.
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (pwErr) throw pwErr;
  } else {
    userId = created.user!.id;
  }

  // Ensure the matching profiles row (username "dev").
  const { error: profileErr } = await admin.from("profiles").upsert(
    { id: userId, username: DEV_USERNAME, email: DEV_EMAIL },
    { onConflict: "id" }
  );
  if (profileErr) throw profileErr;

  // Sign in with the cookie-aware client → session cookies get set.
  const supabase = createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password,
  });
  if (signInErr) throw signInErr;

  redirect("/dashboard");
}
