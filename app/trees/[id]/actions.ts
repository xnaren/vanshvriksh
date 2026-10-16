// Server actions for a single tree: adding people by relation, invites.
"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getTreeRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Relation } from "@/lib/types";
import type { GedcomIndividual, GedcomFamily } from "@/lib/gedcom";

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

/** Shared person detail fields pulled from a submitted form. */
function personDetails(formData: FormData) {
  return {
    family_name: String(formData.get("family_name") ?? "").trim() || null,
    nickname: String(formData.get("nickname") ?? "").trim() || null,
    gotra: String(formData.get("gotra") ?? "").trim() || null,
    gender: (String(formData.get("gender") ?? "") || null) as Gender,
    dob: String(formData.get("dob") ?? "") || null,
    birth_place: String(formData.get("birth_place") ?? "").trim() || null,
    native_place: String(formData.get("native_place") ?? "").trim() || null,
    current_location:
      String(formData.get("current_location") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
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
    ...personDetails(formData),
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
      ...personDetails(formData),
      gender, // relation-implied gender wins over the form default
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
      // Child of the target, optionally with an explicitly chosen other
      // parent (e.g. a child of a specific couple, or of another marriage).
      // Without an explicit pick, the other parent is the target's spouse of
      // the opposite gender, when one is recorded.
      const explicitOtherId =
        String(formData.get("otherParentId") ?? "") || null;

      let otherId: string | null = null;
      let otherGender: Gender = null;
      if (explicitOtherId) {
        if (explicitOtherId === target.id)
          throw new Error("The other parent can't be the same person.");
        const { data: other, error: otherError } = await supabase
          .from("persons")
          .select("id, gender")
          .eq("id", explicitOtherId)
          .eq("tree_id", treeId)
          .single();
        if (otherError || !other)
          throw new Error("Other parent not found in this tree.");
        otherId = other.id as string;
        otherGender = other.gender as Gender;
      } else {
        const { data: links } = await supabase
          .from("spouses")
          .select("person_a, person_b")
          .eq("tree_id", treeId)
          .or(`person_a.eq.${target.id},person_b.eq.${target.id}`);

        for (const link of links ?? []) {
          const otherLinkId =
            link.person_a === target.id ? link.person_b : link.person_a;
          const { data: other } = await supabase
            .from("persons")
            .select("id, gender")
            .eq("id", otherLinkId)
            .single();
          if (other && other.gender && other.gender !== target.gender) {
            otherId = other.id as string;
            otherGender = other.gender as Gender;
            break;
          }
        }
      }

      // Assign father/mother slots by gender; unknown genders take the free slot.
      const targetCol =
        target.gender === "female" ? "mother_id" : "father_id";
      let otherCol: "father_id" | "mother_id" | null = null;
      if (otherId) {
        otherCol =
          otherGender === "male"
            ? "father_id"
            : otherGender === "female"
              ? "mother_id"
              : targetCol === "father_id"
                ? "mother_id"
                : "father_id";
        if (otherCol === targetCol) {
          throw new Error(
            "Both chosen parents would fill the same slot — pick parents of different genders, or leave the other parent empty."
          );
        }
      }

      await setParent(targetCol, target.id as string);
      if (otherId && otherCol) await setParent(otherCol, otherId);
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

/** Update a person's details (owners and editors). Also handles the member
 *  photo: `photo` is an optional uploaded image (≤ 2 MB, jpeg/png/webp/gif),
 *  stored in the `avatars` bucket under `<tree_id>/<person_id>.<ext>` with
 *  upsert so each person keeps exactly one avatar; `remove_photo=on` deletes
 *  it. Uploads run through the service-role admin client inside this action,
 *  so members never need direct storage access. */
export async function updatePerson(
  treeId: string,
  personId: string,
  formData: FormData
) {
  const { supabase } = await requireUser();
  await assertCanEdit(treeId);

  const given_name = String(formData.get("given_name") ?? "").trim();
  if (!given_name) throw new Error("Name is required.");

  const photo_url = await handleAvatar(treeId, personId, formData);

  const update: Record<string, string | boolean | null> = {
    given_name,
    ...personDetails(formData),
    dod: String(formData.get("dod") ?? "") || null,
    is_living: formData.get("is_living") === "on",
  };
  // undefined = photo untouched; null = removed; string = new upload.
  if (photo_url !== undefined) update.photo_url = photo_url;

  const { error } = await supabase
    .from("persons")
    .update(update)
    .eq("id", personId)
    .eq("tree_id", treeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/trees/${treeId}`);
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Returns the new photo_url, null if removed, or undefined if untouched. */
async function handleAvatar(
  treeId: string,
  personId: string,
  formData: FormData
): Promise<string | null | undefined> {
  const admin = createAdminClient();
  const bucket = admin.storage.from("avatars");
  const prefix = `${treeId}/${personId}`;

  if (formData.get("remove_photo") === "on") {
    // Best-effort cleanup of whatever file is stored for this person.
    const { data: files } = await bucket.list(treeId, {
      search: personId,
      limit: 10,
    });
    const paths = (files ?? [])
      .filter((f) => f.name.startsWith(`${personId}.`))
      .map((f) => `${treeId}/${f.name}`);
    if (paths.length > 0) await bucket.remove(paths);
    return null;
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return undefined;

  const ext = AVATAR_MIME_TO_EXT[file.type];
  if (!ext) throw new Error("Photo must be a JPEG, PNG, WebP or GIF.");
  if (file.size > AVATAR_MAX_BYTES)
    throw new Error("Photo must be 2 MB or smaller.");

  const path = `${prefix}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await bucket.upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Delete a person's details (owners and editors). Children's parent links are set to
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

  // Best-effort avatar cleanup; the person row is already gone, so a
  // storage failure here must not block the delete.
  try {
    const bucket = createAdminClient().storage.from("avatars");
    const { data: files } = await bucket.list(treeId, {
      search: personId,
      limit: 10,
    });
    const paths = (files ?? [])
      .filter((f) => f.name.startsWith(`${personId}.`))
      .map((f) => `${treeId}/${f.name}`);
    if (paths.length > 0) await bucket.remove(paths);
  } catch {
    /* avatar cleanup is best-effort */
  }
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
      // Unknown gender fills the father slot, matching addRelative.
      const col = target.gender === "female" ? "mother_id" : "father_id";
      if (existing[col] && (existing[col] as string) !== target.id) {
        throw new Error(
          `They already have a recorded ${col === "father_id" ? "father" : "mother"}. Edit the person to change it.`
        );
      }
      updates[col] = target.id as string;
      const { error } = await supabase
        .from("persons")
        .update(updates)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
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

/**
 * Bulk-import people from a parsed GEDCOM file. Creates all individuals,
 * then spouse links, then parent links. Adds new people only — nothing
 * already in the tree is changed.
 */
export async function importGedcom(
  treeId: string,
  data: { individuals: GedcomIndividual[]; families: GedcomFamily[] }
) {
  const { supabase, user } = await requireUser();
  await assertCanEdit(treeId);

  const inds = data.individuals ?? [];
  if (inds.length === 0) throw new Error("No people found in the file.");
  if (inds.length > 2000)
    throw new Error("Too many people in this file (limit 2000 per import).");

  const { data: created, error } = await supabase
    .from("persons")
    .insert(
      inds.map((i) => ({
        tree_id: treeId,
        given_name: (i.given_name || "Unknown").slice(0, 60),
        family_name: i.family_name,
        nickname: i.nickname,
        gender: i.gender,
        dob: i.dob,
        birth_place: i.birth_place,
        dod: i.dod,
        is_living: i.is_living,
        notes: i.notes,
        gotra: i.gotra,
        native_place: i.native_place,
        current_location: i.current_location,
        created_by: user.id,
      }))
    )
    .select("id");
  if (error) throw new Error(error.message);
  const ids = (created ?? []).map((r: { id: string }) => r.id);
  if (ids.length !== inds.length)
    throw new Error("Import partially failed; please try again.");

  // Spouse links (dedupe pairs).
  const seen = new Set<string>();
  const spouseRows: Array<{
    tree_id: string;
    person_a: string;
    person_b: string;
    married_on: string | null;
  }> = [];
  for (const f of data.families ?? []) {
    if (f.husb == null || f.wife == null) continue;
    const a = ids[f.husb];
    const b = ids[f.wife];
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    spouseRows.push({
      tree_id: treeId,
      person_a: a,
      person_b: b,
      married_on: f.marrDate,
    });
  }
  if (spouseRows.length > 0) {
    const { error: se } = await supabase.from("spouses").insert(spouseRows);
    if (se) throw new Error(se.message);
  }

  // Parent links.
  for (const f of data.families ?? []) {
    const father = f.husb != null ? ids[f.husb] : null;
    const mother = f.wife != null ? ids[f.wife] : null;
    if (!father && !mother) continue;
    for (const ci of f.chil ?? []) {
      const cid = ids[ci];
      if (!cid || cid === father || cid === mother) continue;
      const patch: Record<string, string> = {};
      if (father) patch.father_id = father;
      if (mother) patch.mother_id = mother;
      const { error: ue } = await supabase
        .from("persons")
        .update(patch)
        .eq("id", cid);
      if (ue) throw new Error(ue.message);
    }
  }

  revalidatePath(`/trees/${treeId}`);
  return { persons: ids.length, families: (data.families ?? []).length };
}
