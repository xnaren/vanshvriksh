// Server actions for the admin console. Every action re-checks the
// admin session first — the console is NOT protected by Supabase
// auth, so no action may trust the caller beyond that session.
// All data access uses the service-role client (RLS bypass), which
// is why the session check is the only gate and must never be skipped.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  changeAdminCredentials,
  clearAdminSession,
  createAdminSession,
  requireAdmin,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { generateTempPassword } from "@/lib/admin-crypto";

/* ---------- session ---------- */

export async function adminLogin(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const otp = String(formData.get("otp") ?? "");
  const res = await verifyAdminCredentials(username, password, otp);
  if (!res.ok) {
    redirect(`/admin/login?error=${encodeURIComponent(res.error ?? "Invalid admin credentials.")}`);
  }
  createAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  clearAdminSession();
  redirect("/admin/login");
}

/* ---------- helpers ---------- */

async function cleanupTreeAvatars(treeId: string) {
  try {
    const bucket = createAdminClient().storage.from("avatars");
    const { data: files } = await bucket.list(treeId, { limit: 100 });
    const paths = (files ?? []).map((f) => `${treeId}/${f.name}`);
    if (paths.length > 0) await bucket.remove(paths);
  } catch {
    /* avatar cleanup is best-effort */
  }
}

async function deleteTreeRow(treeId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("trees").delete().eq("id", treeId);
  if (error) throw new Error(error.message);
  await cleanupTreeAvatars(treeId);
}

/* ---------- users ---------- */

/**
 * Deletes a user AND the trees they created (persons, spouses,
 * memberships and invites in those trees cascade in the database),
 * then removes the account itself. Memberships in other people's
 * trees disappear when the profile row is deleted (cascade).
 * Returns the number of trees deleted with the user.
 */
export async function adminDeleteUser(userId: string): Promise<{
  ok: boolean;
  treesDeleted?: number;
  error?: string;
}> {
  requireAdmin();
  try {
    const admin = createAdminClient();
    const { data: owned } = await admin
      .from("trees")
      .select("id")
      .eq("created_by", userId);
    let treesDeleted = 0;
    for (const t of owned ?? []) {
      await deleteTreeRow(t.id as string);
      treesDeleted++;
    }
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr && !/not found|does not exist/i.test(authErr.message)) {
      throw new Error(authErr.message);
    }
    // If the auth user was already gone, the profile row may remain.
    await admin.from("profiles").delete().eq("id", userId);
    revalidatePath("/admin");
    return { ok: true, treesDeleted };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Sets a new temporary password on a user's Supabase account and
 * returns it ONCE, for the admin to pass to the user. It is never
 * stored anywhere. Note: regular sign-in here is email OTP, so this
 * password is for password-based sign-in / account recovery — it
 * does not change the user's OTP login.
 */
export async function adminResetUserPassword(userId: string): Promise<{
  ok: boolean;
  tempPassword?: string;
  error?: string;
}> {
  requireAdmin();
  try {
    const admin = createAdminClient();
    const tempPassword = generateTempPassword();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ---------- trees ---------- */

export async function adminDeleteTree(treeId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  requireAdmin();
  try {
    await deleteTreeRow(treeId);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ---------- admin's own credentials ---------- */

export async function adminChangeCredentials(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  requireAdmin();
  return changeAdminCredentials(
    String(formData.get("currentPassword") ?? ""),
    String(formData.get("currentOtp") ?? ""),
    String(formData.get("newPassword") ?? ""),
    String(formData.get("newOtp") ?? "")
  );
}
