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

/** Rename a tree (owners only). */
export async function updateTreeName(treeId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const role = await getTreeRole(treeId, user.id);
  if (role !== "owner") throw new Error("Only the tree owner can rename it.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give your tree a name.");

  const { error } = await supabase
    .from("trees")
    .update({ name: name.slice(0, 80) })
    .eq("id", treeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/trees/${treeId}`);
  revalidatePath("/dashboard");
}

/** Delete a tree and everything in it (owners only). DB cascades handle
 *  persons, spouses, memberships and invites. */
export async function deleteTree(treeId: string) {
  const { supabase, user } = await requireUser();
  const role = await getTreeRole(treeId, user.id);
  if (role !== "owner") throw new Error("Only the tree owner can delete it.");

  const { error } = await supabase.from("trees").delete().eq("id", treeId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

/** Update a person's details (owners and editors). */
export async function updatePerson(
  treeId: string,
  personId: string,
  formData: FormData
) {
  const { supabase } = await requireUser();
  await assertCanEdit(treeId);

  const given_name = String(formData.get("given_name") ?? "").trim();
  if (!given_name) throw new Error("Name is required.");

  const { error } = await supabase
    .from("persons")
    .update({
      given_name,
      family_name: String(formData.get("family_name") ?? "").trim() || null,
      gotra: String(formData.get("gotra") ?? "").trim() || null,
      gender: (String(formData.get("gender") ?? "") || null) as Gender,
      dob: String(formData.get("dob") ?? "") || null,
      dod: String(formData.get("dod") ?? "") || null,
      native_place: String(formData.get("native_place") ?? "").trim() || null,
      is_living: formData.get("is_living") === "on",
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", personId)
    .eq("tree_id", treeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/trees/${treeId}`);
}

/** Delete a person (owners and editors). Children's parent links are set to
 *  null and spouse links are removed by the database automatically. */
export async function deletePerson(treeId: string, personId: string) {
  const { supabase } = await requireUser();
  await assertCanEdit(treeId);

  const { error } = await supabase
    .from("persons")
    .delete()
    .eq("id", personId)
    .eq("tree_id", treeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/trees/${treeId}`);
}

/** Is `ancestorId` an ancestor of `personId`? Walks up both parent chains.
 *  Used to refuse links that would create a cycle. */
async function isAncestor(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  treeId: string,
  ancestorId: string,
  personId: string
): Promise<boolean> {
  const seen = new Set<string>();
  const stack: string[] = [personId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === ancestorId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const { data } = await supabase
      .from("persons")
      .select("father_id, mother_id")
      .eq("id", current)
      .eq("tree_id", treeId)
      .single();
    if (!data) continue;
    if (data.father_id) stack.push(data.father_id as string);
    if (data.mother_id) stack.push(data.mother_id as string);
  }
  return false;
}

async function spouseLinkExists(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  treeId: string,
  a: string,
  b: string
): Promise<boolean> {
  const { data } = await supabase
    .from("spouses")
    .select("id")
    .eq("tree_id", treeId)
    .or(
      `and(person_a.eq.${a},person_b.eq.${b}),and(person_a.eq.${b},person_b.eq.${a})`
    )
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Link an EXISTING member as a relative of another member — no new person
 * is created. Same eight relations as addRelative, same primitives
 * (parent links / spouse links / shared parents), plus guards:
 *  - nobody can be linked to themselves
 *  - parent/child links that would create a cycle are refused
 *  - already-filled parent slots are never overwritten (edit the person instead)
 */
export async function linkRelative(treeId: string, formData: FormData) {
  const { supabase } = await requireUser();
  await assertCanEdit(treeId);

  const relation = String(formData.get("relation")) as Relation;
  const relativeToId = String(formData.get("relativeToId") ?? "");
  const existingId = String(formData.get("existingId") ?? "");
  if (!relativeToId || !existingId) {
    throw new Error("Choose both people for the link.");
  }
  if (relativeToId === existingId) {
    throw new Error("A person can't be linked to themselves.");
  }

  const getPerson = async (id: string) => {
    const { data, error } = await supabase
      .from("persons")
      .select("id, gender, father_id, mother_id")
      .eq("id", id)
      .eq("tree_id", treeId)
      .single();
    if (error || !data) throw new Error("Person not found in this tree.");
    return data;
  };
  const target = await getPerson(relativeToId);
  const existing = await getPerson(existingId);

  switch (relation) {
    case "father":
    case "mother": {
      // existing becomes the target's parent.
      if (await isAncestor(supabase, treeId, relativeToId, existingId)) {
        throw new Error("That would create a loop — they're already related that way.");
      }
      const column = relation === "father" ? "father_id" : "mother_id";
      if (target[column]) {
        throw new Error(
          `They already have a recorded ${relation}. Edit the person to change it.`
        );
      }
      const { error } = await supabase
        .from("persons")
        .update({ [column]: existingId })
        .eq("id", target.id);
      if (error) throw new Error(error.message);
      break;
    }

    case "husband":
    case "wife": {
      if (await spouseLinkExists(supabase, treeId, target.id as string, existingId)) {
        throw new Error("They're already linked as spouses.");
      }
      const { error } = await supabase.from("spouses").insert({
        tree_id: treeId,
        person_a: target.id,
        person_b: existingId,
      });
      if (error) throw new Error(error.message);
      break;
    }

    case "son":
    case "daughter": {
      // existing becomes the target's child — fills only empty parent slots.
      if (await isAncestor(supabase, treeId, existingId, relativeToId)) {
        throw new Error("That would create a loop — they're already related that way.");
      }
      const updates: Record<string, string> = {};
      if (target.gender !== "female") {
        if (existing.father_id && (existing.father_id as string) !== target.id) {
          throw new Error("They already have a recorded father. Edit the person to change it.");
        }
        updates.father_id = target.id as string;
      }
      if (target.gender !== "male") {
        if (existing.mother_id && (existing.mother_id as string) !== target.id) {
          throw new Error("They already have a recorded mother. Edit the person to change it.");
        }
        updates.mother_id = target.id as string;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("persons")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
      break;
    }

    case "brother":
    case "sister": {
      // Siblings share parents — fills only empty parent slots on `existing`.
      const updates: Record<string, string> = {};
      for (const col of ["father_id", "mother_id"] as const) {
        const targetParent = target[col] as string | null;
        const existingParent = existing[col] as string | null;
        if (!targetParent) continue;
        if (existingParent && existingParent !== targetParent) {
          throw new Error(
            "They already have a different recorded parent. Edit the person to change it."
          );
        }
        if (!existingParent) updates[col] = targetParent;
      }
      if (Object.keys(updates).length === 0) {
        throw new Error("They already share the same parents — nothing to link.");
      }
      const { error } = await supabase
        .from("persons")
        .update(updates)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      break;
    }
  }

  revalidatePath(`/trees/${treeId}`);
  return { ok: true };
}
