// Auth helpers for server components and server actions.
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Returns the logged-in user, or redirects to /login. */
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Returns the caller's profile row (null if they haven't completed signup). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return (data as Profile | null) ?? null;
}

/** Returns the caller's role in a tree (null if not a member). */
export async function getTreeRole(
  treeId: string,
  userId: string
): Promise<"owner" | "editor" | "viewer" | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tree_members")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();
  return (data?.role as "owner" | "editor" | "viewer" | undefined) ?? null;
}
