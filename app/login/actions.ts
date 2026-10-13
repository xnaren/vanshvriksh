// Server actions for the passwordless login flow:
//   1. requestLoginOtp(username, captchaToken)
//        → verifies Turnstile → looks up the email for the username (admin
//          client, never exposed to the browser) → sends a 6-digit OTP email.
//        Returns only a MASKED email hint (e.g. "r***@gmail.com").
//   2. verifyLoginOtp(username, otp)
//        → re-resolves the email server-side → verifies the OTP → session set.
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export interface OtpRequestResult {
  ok: boolean;
  hint?: string;
  error?: string;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return email.slice(0, 1) + "***" + email.slice(at);
}

export async function requestLoginOtp(
  username: string,
  captchaToken: string
): Promise<OtpRequestResult> {
  const clean = username.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Enter your username." };

  // 1. Bot check FIRST — before any OTP is sent (protects email quota).
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

  // 2. Resolve username → email (admin client; email never leaves the server).
  let email: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("email")
      .ilike("username", clean)
      .single();
    email = (data?.email as string | undefined) ?? null;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!email) {
    // Deliberately vague: don't confirm whether a username exists.
    return { ok: false, error: "If that username exists, a code was sent." };
  }

  // 3. Send the OTP email.
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, hint: maskEmail(email) };
}

export async function verifyLoginOtp(
  username: string,
  otp: string
): Promise<OtpRequestResult> {
  const clean = username.trim().toLowerCase();
  const code = otp.trim();
  if (!clean || !code) return { ok: false, error: "Enter the 6-digit code." };

  // Re-resolve the email server-side — the client never sees it.
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .ilike("username", clean)
    .single();
  const email = data?.email as string | undefined;
  if (!email) return { ok: false, error: "Code expired — please try again." };

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    return { ok: false, error: "Incorrect or expired code — try again." };
  }
  return { ok: true };
}
