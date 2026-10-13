// Server actions for the dashboard.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function createTree(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give your tree a name.");

  const { data, error } = await supabase
    .from("trees")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // The handle_new_tree trigger adds the creator as owner in tree_members.
  revalidatePath("/dashboard");
  redirect(`/trees/${data.id}`);
}
