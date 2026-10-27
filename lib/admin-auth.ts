// Admin-console authentication. Server-side only (uses the service
// role client and cookies) — never import from client components.
//
// How admin credentials work, and where they live:
//   - The admin is NOT a Supabase user and does NOT use the email-OTP
//     flow. The console has its own username + password + OTP code.
//   - The initial credentials come ONLY from environment variables
//     (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_OTP_CODE). They are
//     never written into code, a migration, or a committed file.
//   - On the first successful login, the hashes of those credentials
//     are stored in public.admin_settings (one row, id = 1). From
//     then on, the stored hashes are authoritative, so the admin can
//     change the password/OTP from inside the console without a
//     redeploy. Only scrypt hashes are stored — never plaintext.
//   - The session is an HMAC-signed cookie (see lib/admin-crypto.ts),
//     signed with ADMIN_SESSION_SECRET (or the service-role key as a
//     local-dev fallback). It lasts 12 hours and is scoped to /admin.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "./supabase/admin";
import {
  createSessionToken,
  hashSecret,
  secretsEqual,
  verifyHashedSecret,
  verifySessionToken,
} from "./admin-crypto";

const COOKIE_NAME = "vv_admin_session";

export function adminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

function sessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Admin sessions are not configured — set ADMIN_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return secret;
}

interface AdminSettingsRow {
  password_hash: string;
  otp_hash: string;
}

async function getAdminSettings(): Promise<AdminSettingsRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("admin_settings")
      .select("password_hash, otp_hash")
      .eq("id", 1)
      .maybeSingle();
    return (data as AdminSettingsRow | null) ?? null;
  } catch {
    // Table not migrated yet — fall through to environment credentials.
    return null;
  }
}

async function seedAdminSettings(
  password: string,
  otp: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("admin_settings").upsert(
      {
        id: 1,
        password_hash: hashSecret(password),
        otp_hash: hashSecret(otp),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // Seeding is best-effort: login still succeeds on env credentials,
    // and the next login retries the seed. Changing credentials from
    // the console will surface the real error if the table is missing.
  }
}

export async function verifyAdminCredentials(
  username: string,
  password: string,
  otp: string
): Promise<{ ok: boolean; error?: string }> {
  const generic = "Invalid admin credentials.";
  if (username.trim() !== adminUsername()) return { ok: false, error: generic };

  const row = await getAdminSettings();
  if (row) {
    const ok =
      verifyHashedSecret(password, row.password_hash) &&
      verifyHashedSecret(otp, row.otp_hash);
    return ok ? { ok: true } : { ok: false, error: generic };
  }

  // No stored credentials yet — check the environment, and seed the
  // hashed row on success so later changes persist.
  const envPassword = process.env.ADMIN_PASSWORD;
  const envOtp = process.env.ADMIN_OTP_CODE;
  if (!envPassword || !envOtp) {
    return {
      ok: false,
      error:
        "Admin credentials are not configured — set ADMIN_PASSWORD and ADMIN_OTP_CODE in the environment.",
    };
  }
  const ok = secretsEqual(password, envPassword) && secretsEqual(otp, envOtp);
  if (!ok) return { ok: false, error: generic };
  await seedAdminSettings(password, otp);
  return { ok: true };
}

export function createAdminSession() {
  const token = createSessionToken(sessionSecret());
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 12 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearAdminSession() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
  });
}

export function isAdminSession(): boolean {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return false;
    return verifySessionToken(sessionSecret(), token);
  } catch {
    return false;
  }
}

/** Redirects to /admin/login unless the admin session is valid. */
export function requireAdmin() {
  if (!isAdminSession()) redirect("/admin/login");
}

export async function changeAdminCredentials(
  currentPassword: string,
  currentOtp: string,
  newPassword: string,
  newOtp: string
): Promise<{ ok: boolean; error?: string }> {
  const check = await verifyAdminCredentials(
    adminUsername(),
    currentPassword,
    currentOtp
  );
  if (!check.ok) {
    return { ok: false, error: "Current password or code is incorrect." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (newOtp.trim().length < 6) {
    return { ok: false, error: "New code must be at least 6 characters." };
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("admin_settings").upsert(
      {
        id: 1,
        password_hash: hashSecret(newPassword),
        otp_hash: hashSecret(newOtp.trim()),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) throw error;
  } catch (e) {
    return {
      ok: false,
      error: `Could not save new credentials (is the admin migration applied?): ${(e as Error).message}`,
    };
  }
  return { ok: true };
}
