// Server actions for signup (passwordless):
//   1. requestSignupOtp(username, email, captchaToken)
//        → verifies Turnstile → checks username availability (admin client) →
//          sends a 6-digit OTP email via Supabase Auth (creates the user).
//   2. verifySignupOtp(username, email, otp)
//        → verifies the OTP → creates the profiles row (username ↔ user).
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export interface SignupResult {
  ok: boolean;
  error?: string;
}

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export async function requestSignupOtp(
  username: string,
  email: string,
  captchaToken: string
): Promise<SignupResult> {
  const clean = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  if (!USERNAME_RE.test(clean)) {
    return {
      ok: false,
      error: "Username must be 3–30 characters: letters, numbers, underscore.",
    };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  // 1. Bot check FIRST.
  const headerStore = headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip");
  let captchaOk = false;
  try {
    captchaOk = await verifyTurnstile(captchaToken, ip);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!captchaOk) {
    return { ok: false, error: "Bot check failed — please try again." };
  }

  // 2. Username availability (admin client bypasses RLS for the lookup).
  try {
    const admin = createAdminClient();
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", clean)
      .maybeSingle();
    if (taken) {
      return { ok: false, error: "That username is taken — try another." };
    }

    // Also block usernames whose email is already registered.
    const { data: users } = await admin.auth.admin.listUsers();
    const emailTaken = users.users.some(
      (u) => u.email?.toLowerCase() === cleanEmail
    );
    if (emailTaken) {
      return {
        ok: false,
        error: "That email is already registered — try logging in instead.",
      };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // 3. Send the OTP (creates the auth user on first verify).
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: true,
      data: { username: clean },
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifySignupOtp(
  username: string,
  email: string,
  otp: string
): Promise<SignupResult> {
  const clean = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  const code = otp.trim();
  if (!clean || !cleanEmail || !code) {
    return { ok: false, error: "Enter the 6-digit code." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: code,
    type: "email",
  });
  if (error || !data.user) {
    return { ok: false, error: "Incorrect or expired code — try again." };
  }

  // Claim the username with a profiles row (service role: reliable RLS bypass).
  try {
    const admin = createAdminClient();
    const { error: upsertError } = await admin.from("profiles").upsert(
      { id: data.user.id, username: clean, email: cleanEmail },
      { onConflict: "id" }
    );
    if (upsertError) throw upsertError;
  } catch (e) {
    return { ok: false, error: `Signed in, but profile setup failed: ${(e as Error).message}` };
  }

  return { ok: true };
}
