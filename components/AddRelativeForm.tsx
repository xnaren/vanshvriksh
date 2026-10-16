// Form for adding a person to a tree — either the first (root) person, or
// a relative of an existing person chosen from the eight relation kinds.
// Two modes: "create" makes a brand-new person; "link" attaches an
// already-existing member as the relative (no duplicates). The server
// actions wire father_id / mother_id / spouses automatically.
"use client";

import { useEffect, useState } from "react";
import { RELATIONS, type Person, type Relation } from "@/lib/types";
import { addRelative, addRootPerson, linkRelative } from "@/app/trees/[id]/actions";

export default function AddRelativeForm({
  treeId,
  persons,
  initialRelativeToId,
  onDone,
  bare,
}: {
  treeId: string;
  persons: Pick<Person, "id" | "given_name" | "family_name">[];
  /** Pre-select "relative of" — used by the card quick-add modal. */
  initialRelativeToId?: string;
  /** Called shortly after a successful add — lets a modal close itself. */
  onDone?: () => void;
  /** Render without the outer card chrome (for embedding in a modal). */
  bare?: boolean;
}) {
  const isFirst = persons.length === 0;
  const [mode, setMode] = useState<"create" | "link">("create");
  const [relativeToId, setRelativeToId] = useState(
    initialRelativeToId ?? persons[0]?.id ?? ""
  );
  const [relation, setRelation] = useState<Relation>("father");
  const [existingId, setExistingId] = useState("");
  const [givenName, setGivenName] = useState("");
  const [otherParentId, setOtherParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // The "+" icon on a tree card dispatches this to pre-select that person.
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.personId as string | undefined;
      if (id && persons.some((p) => p.id === id)) {
        setRelativeToId(id);
        setMode("create");
        setMsg("");
      }
    };
    window.addEventListener("vv-select-relative", handler);
    return () => window.removeEventListener("vv-select-relative", handler);
  }, [persons]);

  const linkMode = !isFirst && mode === "link";
  const linkCandidates = persons.filter((p) => p.id !== relativeToId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const formData = new FormData(e.currentTarget);
      if (isFirst) {
        await addRootPerson(treeId, formData);
      } else if (linkMode) {
        await linkRelative(treeId, formData);
      } else {
        await addRelative(treeId, formData);
      }
      (e.target as HTMLFormElement).reset();
      setExistingId("");
      setGivenName("");
      setOtherParentId("");
      setMsg(linkMode ? "Linked ✓" : "Added ✓");
      if (onDone) setTimeout(onDone, 700);
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    }
    setBusy(false);
  }

  return (
    <form
      id={bare ? undefined : "add-member-form"}
      onSubmit={onSubmit}
      className={bare ? "space-y-3" : "card space-y-3 scroll-mt-4"}
    >
      <h3 className="font-semibold">
        {isFirst ? "Add the first person" : "Add a relative"}
      </h3>

      {!isFirst && (
        <>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className={mode === "create" ? "btn-secondary" : "text-stone-500 hover:underline"}
              onClick={() => setMode("create")}
            >
              Create new person
            </button>
            <button
              type="button"
              className={mode === "link" ? "btn-secondary" : "text-stone-500 hover:underline"}
              onClick={() => setMode("link")}
            >
              Link existing member
            </button>
          </div>
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
          {/* Live preview so a wrong relation choice is obvious before submit. */}
          <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Will add <b>{givenName.trim() || "a new person"}</b> as{" "}
            <b>{RELATIONS.find((r) => r.value === relation)?.label}</b> of{" "}
            <b>
              {(() => {
                const t = persons.find((p) => p.id === relativeToId);
                return t
                  ? `${t.given_name}${t.family_name ? " " + t.family_name : ""}`
                  : "…";
              })()}
            </b>
            {(relation === "son" || relation === "daughter") &&
              otherParentId && (
                <>
                  {" "}with{" "}
                  <b>
                    {(() => {
                      const t = persons.find((p) => p.id === otherParentId);
                      return t
                        ? `${t.given_name}${t.family_name ? " " + t.family_name : ""}`
                        : "…";
                    })()}
                  </b>{" "}
                  as the other parent
                </>
              )}
            .
          </p>
          {!linkMode && (relation === "son" || relation === "daughter") && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Other parent <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <select
                name="otherParentId"
                value={otherParentId}
                onChange={(e) => setOtherParentId(e.target.value)}
              >
                <option value="">Auto — the other spouse, if recorded</option>
                {persons
                  .filter((p) => p.id !== relativeToId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.given_name}
                      {p.family_name ? ` ${p.family_name}` : ""}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-stone-500 mt-1">
                Pick this to add the child to a specific couple — e.g. a child
                of Vikram <i>and</i> Priya, or a child from another marriage.
              </p>
            </div>
          )}
        </>
      )}

      {linkMode ? (
        <div>
          <label className="block text-sm font-medium mb-1">
            Existing member to link
          </label>
          <select
            name="existingId"
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            required
          >
            <option value="">Choose a member…</option>
            {linkCandidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.given_name}
                {p.family_name ? ` ${p.family_name}` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-stone-500 mt-1">
            No new person is created — the chosen member is recorded as the{" "}
            {relation} of the person above.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Given name *</label>
              <input
                name="given_name"
                placeholder="e.g. Ramesh"
                required
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Family name</label>
              <input name="family_name" placeholder="e.g. Sharma" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nickname</label>
              <input name="nickname" placeholder="e.g. Chintu" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gotra</label>
              <input name="gotra" placeholder="e.g. Kashyap" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <select name="gender" defaultValue="">
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Date of birth
              </label>
              <input name="dob" type="date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Place of birth
              </label>
              <input name="birth_place" placeholder="e.g. Repalle" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Native place
              </label>
              <input name="native_place" placeholder="e.g. Varanasi" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Current location
            </label>
            <input name="current_location" placeholder="e.g. Hyderabad" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea name="notes" rows={2} placeholder="Anything worth remembering…" />
          </div>
        </>
      )}

      <button type="submit" disabled={busy}>
        {busy
          ? linkMode
            ? "Linking…"
            : "Adding…"
          : isFirst
            ? "Add first person"
            : linkMode
              ? "Link relative"
              : "Add relative"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
