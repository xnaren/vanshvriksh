// GEDCOM import modal: pick a .ged file, preview what will be imported,
// confirm to bulk-create people, spouse links and parent links.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseGedcom, type ParsedGedcom } from "@/lib/gedcom";
import { importGedcom } from "@/app/trees/[id]/actions";

export default function GedcomImportModal({
  treeId,
  onClose,
}: {
  treeId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedGedcom | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setParsed(null);
    try {
      const text = await file.text();
      const p = parseGedcom(text);
      if (p.individuals.length === 0)
        throw new Error("No people found in this file — is it a GEDCOM (.ged) file?");
      if (p.individuals.length > 2000)
        throw new Error("Too many people in this file (limit 2000 per import).");
      setParsed(p);
      setFileName(file.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      await importGedcom(treeId, parsed);
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <h3 className="text-base font-semibold mb-1">Import GEDCOM</h3>
        <p className="text-xs text-stone-500 mb-4">
          Adds everyone from the file as new people. Nothing already in the
          tree is changed.
        </p>

        <label className="block border-2 border-dashed border-stone-200 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
          <span className="text-sm text-stone-600">
            {fileName || "Choose a .ged file"}
          </span>
          <input
            type="file"
            accept=".ged,.gedcom,text/plain"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>

        {parsed && (
          <div className="mt-4 text-sm bg-stone-50 border border-stone-200 rounded-lg p-3">
            <p className="font-medium">
              {parsed.individuals.length}{" "}
              {parsed.individuals.length === 1 ? "person" : "people"}
              {" · "}
              {parsed.families.length}{" "}
              {parsed.families.length === 1 ? "family" : "families"}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              First few:{" "}
              {parsed.individuals
                .slice(0, 5)
                .map(
                  (p) =>
                    `${p.given_name}${p.family_name ? " " + p.family_name : ""}`
                )
                .join(", ")}
              {parsed.individuals.length > 5 && "…"}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={!parsed || busy}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
