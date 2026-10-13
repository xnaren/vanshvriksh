// Form for adding a person to a tree — either the first (root) person, or
// a relative of an existing person chosen from the eight relation kinds.
// The server action wires father_id / mother_id / spouses automatically.
"use client";

import { useState } from "react";
import { RELATIONS, type Person, type Relation } from "@/lib/types";
import { addRelative, addRootPerson } from "@/app/trees/[id]/actions";

export default function AddRelativeForm({
  treeId,
  persons,
}: {
  treeId: string;
  persons: Pick<Person, "id" | "given_name" | "family_name">[];
}) {
  const isFirst = persons.length === 0;
  const [relativeToId, setRelativeToId] = useState(persons[0]?.id ?? "");
  const [relation, setRelation] = useState<Relation>("father");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const formData = new FormData(e.currentTarget);
      if (isFirst) {
        await addRootPerson(treeId, formData);
      } else {
        await addRelative(treeId, formData);
      }
      (e.target as HTMLFormElement).reset();
      setMsg("Added ✓");
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h3 className="font-semibold">
        {isFirst ? "Add the first person" : "Add a relative"}
      </h3>

      {!isFirst && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">
              Relative of
            </label>
            <select
              name="relativeToId"
              value={relativeToId}
              onChange={(e) => setRelativeToId(e.target.value)}
              required
            >
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.given_name}
                  {p.family_name ? ` ${p.family_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Relation</label>
            <select
              name="relation"
              value={relation}
              onChange={(e) => setRelation(e.target.value as Relation)}
            >
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Given name *</label>
          <input name="given_name" placeholder="e.g. Ramesh" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Family name</label>
          <input name="family_name" placeholder="e.g. Sharma" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Gotra</label>
          <input name="gotra" placeholder="e.g. Kashyap" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <select name="gender" defaultValue="">
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Date of birth
          </label>
          <input name="dob" type="date" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Native place
          </label>
          <input name="native_place" placeholder="e.g. Varanasi" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea name="notes" rows={2} placeholder="Anything worth remembering…" />
      </div>

      <button type="submit" disabled={busy}>
        {busy ? "Adding…" : isFirst ? "Add first person" : "Add relative"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
