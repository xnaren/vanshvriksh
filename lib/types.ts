// Shared TypeScript types mirroring supabase/schema.sql.

export type Role = "owner" | "editor" | "viewer";
export type Gender = "male" | "female" | "other";

export interface Profile {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface Tree {
  id: string;
  name: string;
  created_by: string | null;
  visibility: "invite" | "private";
  created_at: string;
}

export interface Person {
  id: string;
  tree_id: string;
  given_name: string;
  family_name: string | null;
  gotra: string | null;
  gender: Gender | null;
  dob: string | null;
  dod: string | null;
  native_place: string | null;
  photo_url: string | null;
  notes: string | null;
  is_living: boolean;
  father_id: string | null;
  mother_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SpouseLink {
  id: string;
  tree_id: string;
  person_a: string;
  person_b: string;
  married_on: string | null;
}

export interface TreeMember {
  tree_id: string;
  user_id: string;
  role: Role;
  linked_person_id: string | null;
  created_at: string;
}

// Roster row for the tree members list: role + joined profile username.
// NOTE: without generated Database types, supabase-js infers embedded
// resources as arrays; at runtime PostgREST returns this many-to-one join
// as a single object (or null), so cast explicitly like Person[]/SpouseLink[].
export interface RosterEntry {
  role: string;
  profiles: { username: string } | null;
}

export type Relation =
  | "father"
  | "mother"
  | "husband"
  | "wife"
  | "son"
  | "daughter"
  | "brother"
  | "sister";

export const RELATIONS: { value: Relation; label: string }[] = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "husband", label: "Husband" },
  { value: "wife", label: "Wife" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
];
