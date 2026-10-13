// Server actions for a single tree: adding people by relation, invites.
"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getTreeRole } from "@/lib/auth";
import type { Relation } from "@/lib/types";

type Gender = "male" | "female" | "other" | null;

const GENDER_BY_RELATION: Record<Relation, Exclude<Gender, null>> = {
  father: "male",
  mother: "female",
  husband: "male",
  wife: "female",
  son: "male",
  daughter: "female",
  brother: "male",
  sister: "female",
};

async function assertCanEdit(treeId: string) {
  const { user } = await requireUser();
  const role = await getTreeRole(treeId, user.id);
  if (role !== "owner" && role !== "editor") {
    throw new Error("You need editor access to change this tree.");
  }
  return user;
}

/** Add the very first person (a root) to an empty tree. */
export async function addRootPerson(treeId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  await assertCanEdit(treeId);

  const given_name = String(formData.get("given_name") ?? "").trim();
  if (!given_name) throw new Error("Name is required.");

  const { error } = await supabase.from("persons").insert({
    tree_id: treeId,
    given_name,
    family_name: String(formData.get("family_name") ?? "").trim() || null,
    gotra: String(formData.get("gotra") ?? "").trim() || null,
    gender: (String(formData.get("gender") ?? "") || null) as Gender,
    dob: String(formData.get("dob") ?? "") || null,
    native_place: String(formData.get("native_place") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/trees/${treeId}`);
}

/**
 * Add a relative to an existing person. The eight relations collapse onto
 * three primitives: parent links (father_id / mother_id), spouse links
 * (spouses table), and sibling links (shared parents).
 */
export async function addRelative(treeId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  await assertCanEdit(treeId);

  const relation = String(formData.get("relation")) as Relation;
  const relativeToId = String(formData.get("relativeToId") ?? "");
  const given_name = String(formData.get("given_name") ?? "").trim();
  if (!given_name) throw new Error("Name is required.");
  if (!relativeToId) throw new Error("Choose who this person is related to.");

  const explicitGender = String(formData.get("gender") ?? "") || null;
  const gender: Gender =
    (explicitGender as Gender) ?? GENDER_BY_RELATION[relation] ?? null;

  // The person we're attaching to (must be in this tree — RLS enforces).
  const { data: target, error: targetError } = await supabase
    .from("persons")
    .select("id, gender, father_id, mother_id")
    .eq("id", relativeToId)
    .eq("tree_id", treeId)
    .single();
  if (targetError || !target) throw new Error("Person not found in this tree.");

  // Create the new person first, then wire the link.
  const { data: created, error: createError } = await supabase
    .from("persons")
    .insert({
      tree_id: treeId,
      given_name,
      family_name: String(formData.get("family_name") ?? "").trim() || null,
      gotra: String(formData.get("gotra") ?? "").trim() || null,
      gender,
      dob: String(formData.get("dob") ?? "") || null,
      native_place: String(formData.get("native_place") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (createError || !created) {
    throw new Error(createError?.message ?? "Could not create person.");
  }
  const newId = created.id as string;

  const setParent = async (column: "father_id" | "mother_id", parentId: string | null) => {
    if (!parentId) return;
    const { error } = await supabase
      .from("persons")
      .update({ [column]: parentId })
      .eq("id", newId);
    if (error) throw new Error(error.message);
  };

  switch (relation) {
    case "father":
    case "mother": {
      const column = relation === "father" ? "father_id" : "mother_id";
      const { error } = await supabase
        .from("persons")
        .update({ [column]: newId })
        .eq("id", target.id);
      if (error) throw new Error(error.message);
      break;
    }

    case "husband":
    case "wife": {
      const { error } = await supabase.from("spouses").insert({
        tree_id: treeId,
        person_a: target.id,
        person_b: newId,
      });
      if (error) throw new Error(error.message);
      break;
    }

    case "son":
    case "daughter": {
      // Child of the target. The other parent is the target's spouse of the
      // opposite gender, when one is recorded.
      const { data: links } = await supabase
        .from("spouses")
        .select("person_a, person_b")
        .eq("tree_id", treeId)
        .or(`person_a.eq.${target.id},person_b.eq.${target.id}`);

      let otherParent: string | null = null;
      for (const link of links ?? []) {
        const otherId =
          link.person_a === target.id ? link.person_b : link.person_a;
        const { data: other } = await supabase
          .from("persons")
          .select("id, gender")
          .eq("id", otherId)
          .single();
        if (other && other.gender && other.gender !== target.gender) {
          otherParent = other.id as string;
          break;
        }
      }

      if (target.gender === "female") {
        await setParent("mother_id", target.id as string);
        await setParent("father_id", otherParent);
      } else {
        await setParent("father_id", target.id as string);
        await setParent("mother_id", otherParent);
      }
      break;
    }

    case "brother":
    case "sister": {
      // Siblings share parents.
      await setParent("father_id", target.father_id as string | null);
      await setParent("mother_id", target.mother_id as string | null);
      break;
    }
  }

  revalidatePath(`/trees/${treeId}`);
  return { ok: true };
}

/** Create an invite link for a tree (owners and editors). */
export async function createInvite(
  treeId: string,
  role: "editor" | "viewer"
): Promise<string> {
  const { supabase, user } = await requireUser();
  const treeRole = await getTreeRole(treeId, user.id);
  if (treeRole !== "owner" && treeRole !== "editor") {
    throw new Error("Only owners and editors can invite.");
  }

  const { data, error } = await supabase
    .from("invites")
    .insert({ tree_id: treeId, role, created_by: user.id })
    .select("token")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create invite.");
  return data.token as string;
}
