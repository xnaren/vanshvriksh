// Modal wrapping the add-relative form, pre-set to a specific person.
// Opened by the "+" icon on a member card.
"use client";

import AddRelativeForm from "./AddRelativeForm";
import type { Person } from "@/lib/types";

export default function AddRelativeModal({
  treeId,
  persons,
  relativeTo,
  onClose,
}: {
  treeId: string;
  persons: Pick<Person, "id" | "given_name" | "family_name">[];
  relativeTo: Pick<Person, "id" | "given_name" | "family_name">;
  onClose: () => void;
}) {
  const name = `${relativeTo.given_name}${
    relativeTo.family_name ? " " + relativeTo.family_name : ""
  }`;

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
          <h3 className="text-lg font-bold">Add a relative of {name}</h3>
          <button
            type="button"
            className="text-stone-400 hover:text-stone-700 text-xl leading-none px-2"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <AddRelativeForm
          treeId={treeId}
          persons={persons}
          initialRelativeToId={relativeTo.id}
          onDone={onClose}
          bare
        />
      </div>
    </div>
  );
}
