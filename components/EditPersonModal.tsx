// Modal for editing a person's details. Submits to the updatePerson
// server action, then closes. Rendered by TreeView when a card's Edit
// button is clicked.
"use client";

import { useState } from "react";
import type { Person } from "@/lib/types";
import { updatePerson } from "@/app/trees/[id]/actions";

function fullName(p: Person) {
  return `${p.given_name}${p.family_name ? " " + p.family_name : ""}`;
}

function initials(p: Person) {
  const a = p.given_name.trim().charAt(0);
  const b = (p.family_name ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

export default function EditPersonModal({
  treeId,
  person,
  onClose,
}: {
  treeId: string;
  person: Person;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updatePerson(treeId, person.id, new FormData(e.currentTarget));
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Edit {fullName(person)}</h3>
          <button
            type="button"
            className="text-stone-400 hover:text-stone-700 text-xl leading-none px-2"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center gap-4">
            {person.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.photo_url}
                alt={fullName(person)}
                className="w-16 h-16 rounded-full object-cover border border-stone-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-semibold text-lg">
                {initials(person)}
              </div>
            )}
            <div className="text-sm">
              <label className="block font-medium mb-1">
                Photo
                <input
                  type="file"
                  name="photo"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block mt-1 text-xs"
                />
              </label>
              <p className="text-xs text-stone-500">
                JPEG/PNG/WebP/GIF, up to 2&nbsp;MB.
              </p>
              {person.photo_url && (
                <label className="flex items-center gap-1.5 text-xs mt-1">
                  <input
                    type="checkbox"
                    name="remove_photo"
                    className="w-3.5 h-3.5"
                  />
                  Remove current photo
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Given name *</label>
              <input name="given_name" defaultValue={person.given_name} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Family name</label>
              <input name="family_name" defaultValue={person.family_name ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nickname</label>
              <input name="nickname" defaultValue={person.nickname ?? ""} placeholder="e.g. Chintu" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gotra</label>
              <input name="gotra" defaultValue={person.gotra ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <select name="gender" defaultValue={person.gender ?? ""}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date of birth</label>
              <input name="dob" type="date" defaultValue={person.dob ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Place of birth</label>
              <input name="birth_place" defaultValue={person.birth_place ?? ""} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date of passing</label>
              <input name="dod" type="date" defaultValue={person.dod ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Native place</label>
              <input name="native_place" defaultValue={person.native_place ?? ""} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Current location</label>
              <input name="current_location" defaultValue={person.current_location ?? ""} placeholder="e.g. Hyderabad" />
            </div>
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_living"
                defaultChecked={person.is_living}
                className="w-4 h-4"
              />
              Living
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_public"
                defaultChecked={person.is_public ?? true}
                className="w-4 h-4"
              />
              Visible to public viewers
            </label>
            <p className="text-xs text-stone-500 mt-1">
              Uncheck to hide this person from anyone who is not a member,
              when this tree is public. Members always see everyone.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={person.notes ?? ""} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={busy} className="flex-1">
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
