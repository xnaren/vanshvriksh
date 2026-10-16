// GEDCOM 5.5.1 import/export — the standard genealogy exchange format.
// Export builds a .ged file from our persons + spouse links; the parser
// reads a .ged file back into plain structs the import action consumes.
//
// VanshVriksh-specific fields (gotra, nickname, native/current places) go
// in underscore-prefixed custom tags, which other apps safely ignore.
import type { Person, SpouseLink } from "./types";

export interface GedcomIndividual {
  given_name: string;
  family_name: string | null;
  nickname: string | null;
  gender: "male" | "female" | "other" | null;
  dob: string | null; // YYYY-MM-DD
  birth_place: string | null;
  dod: string | null; // YYYY-MM-DD
  is_living: boolean;
  notes: string | null;
  gotra: string | null;
  native_place: string | null;
  current_location: string | null;
}

export interface GedcomFamily {
  husb: number | null; // index into individuals
  wife: number | null;
  chil: number[];
  marrDate: string | null; // YYYY-MM-DD
}

export interface ParsedGedcom {
  individuals: GedcomIndividual[];
  families: GedcomFamily[];
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** One line of GEDCOM, max ~255 chars per the spec. */
function clean(v: string | null | undefined, max = 200): string | null {
  if (v == null) return null;
  const s = v.replace(/[\r\n\t@]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/** YYYY-MM-DD -> "1 JAN 1945" */
function toGedcomDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10);
  if (mi < 1 || mi > 12) return null;
  return `${parseInt(d, 10)} ${MONTHS[mi - 1]} ${y}`;
}

/** "1 JAN 1945" / "JAN 1945" / "1945" (ABT/BEF/AFT/EST tolerated) -> YYYY-MM-DD */
function fromGedcomDate(ged: string | null): string | null {
  if (!ged) return null;
  const t = ged.toUpperCase().replace(/^(ABT|BEF|AFT|EST|CAL)\s+/, "").trim();
  let m = t.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[2]);
    if (mi < 0) return null;
    return `${m[3].padStart(4, "0")}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^([A-Z]{3})\s+(\d{3,4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[1]);
    if (mi < 0) return null;
    return `${m[2].padStart(4, "0")}-${String(mi + 1).padStart(2, "0")}-01`;
  }
  m = t.match(/^(\d{3,4})$/);
  if (m) return `${m[1].padStart(4, "0")}-01-01`;
  return null;
}

function sexOf(gender: string | null): string {
  return gender === "male" ? "M" : gender === "female" ? "F" : "U";
}

function genderOf(sex: string | null): GedcomIndividual["gender"] {
  return sex === "M" ? "male" : sex === "F" ? "female" : null;
}

/* ------------------------------- export ------------------------------- */

interface FamDraft {
  husb?: string;
  wife?: string;
  chil: string[];
  marr?: string | null;
}

export function buildGedcom(
  persons: Person[],
  spouses: SpouseLink[],
  treeName: string
): string {
  const L: string[] = [];
  const name = clean(treeName, 90) ?? "Family Tree";
  L.push("0 HEAD");
  L.push("1 SOUR VanshVriksh");
  L.push("2 NAME VanshVriksh Family Tree");
  L.push("1 GEDC");
  L.push("2 VERS 5.5.1");
  L.push("2 FORM LINEAGE-LINKED");
  L.push(`1 DATE ${toGedcomDate(new Date().toISOString().slice(0, 10))}`);
  L.push("1 CHAR UTF-8");
  L.push(`1 NOTE Exported from ${name}`);

  // Person ids -> @I{n}@
  const gid = new Map<string, string>();
  persons.forEach((p, i) => gid.set(p.id, `@I${i + 1}@`));

  // Families: first group children by parent pair, then fold in spouse links.
  const fams: FamDraft[] = [];
  const famByKey = new Map<string, FamDraft>();
  for (const p of persons) {
    if (!p.father_id && !p.mother_id) continue;
    const key = `${p.father_id ?? ""}|${p.mother_id ?? ""}`;
    let f = famByKey.get(key);
    if (!f) {
      f = { chil: [] };
      famByKey.set(key, f);
      fams.push(f);
    }
    if (p.father_id) f.husb ??= p.father_id;
    if (p.mother_id) f.wife ??= p.mother_id;
    f.chil.push(p.id);
  }
  for (const s of spouses) {
    const a = persons.find((p) => p.id === s.person_a);
    const b = persons.find((p) => p.id === s.person_b);
    if (!a || !b) continue;
    let f = fams.find(
      (f) =>
        (f.husb === s.person_a && f.wife === s.person_b) ||
        (f.husb === s.person_b && f.wife === s.person_a)
    );
    if (!f) {
      f = { chil: [], marr: s.married_on };
      fams.push(f);
    } else if (!f.marr) {
      f.marr = s.married_on;
    }
    // Assign HUSB/WIFE by gender; fall back to link order.
    const pair: Array<[Person, "husb" | "wife"]> = [
      [a, a.gender === "female" ? "wife" : "husb"],
      [b, b.gender === "female" ? "wife" : a.gender === "female" ? "husb" : "wife"],
    ];
    for (const [pp, slot] of pair) {
      if (slot === "husb" && !f.husb) f.husb = pp.id;
      else if (slot === "wife" && !f.wife) f.wife = pp.id;
    }
    if (!f.husb) f.husb = s.person_a;
    if (!f.wife && s.person_b !== f.husb) f.wife = s.person_b;
  }
  const fgid = new Map<FamDraft, string>();
  fams.forEach((f, i) => fgid.set(f, `@F${i + 1}@`));

  const famcOf = new Map<string, string>();
  const famsOf = new Map<string, string[]>();
  for (const f of fams) {
    const id = fgid.get(f)!;
    for (const c of f.chil) if (!famcOf.has(c)) famcOf.set(c, id);
    for (const pid of [f.husb, f.wife]) {
      if (!pid) continue;
      const list = famsOf.get(pid) ?? [];
      list.push(id);
      famsOf.set(pid, list);
    }
  }

  for (const p of persons) {
    L.push(`0 ${gid.get(p.id)} INDI`);
    const given = clean(p.given_name, 60) ?? "Unknown";
    const fam = clean(p.family_name, 60);
    L.push(`1 NAME ${given}${fam ? ` /${fam}/` : ""}`);
    const nick = clean(p.nickname, 40);
    if (nick) L.push(`2 NICK ${nick}`);
    L.push(`1 SEX ${sexOf(p.gender)}`);
    if (p.dob) {
      const d = toGedcomDate(p.dob);
      if (d) {
        L.push("1 BIRT");
        L.push(`2 DATE ${d}`);
        const pl = clean(p.birth_place, 120);
        if (pl) L.push(`2 PLAC ${pl}`);
      }
    }
    if (p.dod) {
      const d = toGedcomDate(p.dod);
      if (d) {
        L.push("1 DEAT");
        L.push(`2 DATE ${d}`);
      }
    } else if (!p.is_living) {
      L.push("1 DEAT Y");
    }
    const gotra = clean(p.gotra, 60);
    if (gotra) L.push(`1 _GOTRA ${gotra}`);
    const nat = clean(p.native_place, 120);
    if (nat) L.push(`1 _NATIVE_PLACE ${nat}`);
    const cur = clean(p.current_location, 120);
    if (cur) L.push(`1 _CURRENT_LOCATION ${cur}`);
    const note = clean(p.notes, 500);
    if (note) L.push(`1 NOTE ${note}`);
    const famc = famcOf.get(p.id);
    if (famc) L.push(`1 FAMC ${famc}`);
    for (const fs of famsOf.get(p.id) ?? []) L.push(`1 FAMS ${fs}`);
  }

  for (const f of fams) {
    const id = fgid.get(f)!;
    L.push(`0 ${id} FAM`);
    if (f.husb && gid.has(f.husb)) L.push(`1 HUSB ${gid.get(f.husb)}`);
    if (f.wife && gid.has(f.wife)) L.push(`1 WIFE ${gid.get(f.wife)}`);
    if (f.marr) {
      const d = toGedcomDate(f.marr);
      L.push("1 MARR");
      if (d) L.push(`2 DATE ${d}`);
    }
    for (const c of f.chil) {
      if (gid.has(c)) L.push(`1 CHIL ${gid.get(c)}`);
    }
  }

  L.push("0 TRLR");
  return L.join("\n") + "\n";
}

/* ------------------------------- parse -------------------------------- */

interface RawLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
}

function parseLine(raw: string): RawLine | null {
  const m = raw.match(/^(\d+)\s+(?:(@[^@\s]+@)\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/);
  if (!m) return null;
  return {
    level: parseInt(m[1], 10),
    xref: m[2] ?? null,
    tag: m[3].toUpperCase(),
    value: (m[4] ?? "").trim(),
  };
}

function splitName(value: string): { given: string; family: string | null } {
  const m = value.match(/^(.*?)\s*\/([^/]*)\/\s*$/);
  if (m) {
    return {
      given: m[1].trim() || "Unknown",
      family: m[2].trim() || null,
    };
  }
  const v = value.replace(/\//g, "").trim();
  return { given: v || "Unknown", family: null };
}

export function parseGedcom(text: string): ParsedGedcom {
  const individuals: GedcomIndividual[] = [];
  const families: GedcomFamily[] = [];
  const indiByXref = new Map<string, number>();
  const famByXref = new Map<string, number>();

  interface Ctx {
    kind: "INDI" | "FAM";
    idx: number;
    sub: string | null; // BIRT / DEAT / MARR / NAME context
  }
  let ctx: Ctx | null = null;

  const blank = (): GedcomIndividual => ({
    given_name: "Unknown",
    family_name: null,
    nickname: null,
    gender: null,
    dob: null,
    birth_place: null,
    dod: null,
    is_living: true,
    notes: null,
    gotra: null,
    native_place: null,
    current_location: null,
  });

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const line = parseLine(raw);
    if (!line) continue;

    if (line.level === 0) {
      ctx = null;
      if (line.xref && line.tag === "INDI") {
        indiByXref.set(line.xref, individuals.length);
        individuals.push(blank());
        ctx = { kind: "INDI", idx: individuals.length - 1, sub: null };
      } else if (line.xref && line.tag === "FAM") {
        famByXref.set(line.xref, families.length);
        families.push({ husb: null, wife: null, chil: [], marrDate: null });
        ctx = { kind: "FAM", idx: families.length - 1, sub: null };
      }
      continue;
    }
    if (!ctx) continue;

    if (line.level === 1) {
      ctx.sub = null;
      const ind = () => individuals[ctx!.idx];
      const fam = () => families[ctx!.idx];
      switch (line.tag) {
        case "NAME": {
          const { given, family } = splitName(line.value);
          ind().given_name = given;
          ind().family_name = family;
          ctx.sub = "NAME";
          break;
        }
        case "SEX":
          ind().gender = genderOf(line.value.toUpperCase());
          break;
        case "BIRT":
          ctx.sub = "BIRT";
          break;
        case "DEAT":
          ctx.sub = "DEAT";
          if (line.value.toUpperCase() === "Y") ind().is_living = false;
          break;
        case "MARR":
          ctx.sub = "MARR";
          break;
        case "NICK":
          ind().nickname = clean(line.value, 40);
          break;
        case "_GOTRA":
          ind().gotra = clean(line.value, 60);
          break;
        case "_NATIVE_PLACE":
          ind().native_place = clean(line.value, 120);
          break;
        case "_CURRENT_LOCATION":
          ind().current_location = clean(line.value, 120);
          break;
        case "FAMC":
          // resolved after parse via xref maps
          (ind() as unknown as { _famc?: string })._famc = line.value;
          break;
        case "FAMS":
          ((ind() as unknown as { _fams?: string[] })._fams ??= []).push(line.value);
          break;
        case "HUSB": {
          const i = indiByXref.get(line.value);
          if (i != null) fam().husb = i;
          break;
        }
        case "WIFE": {
          const i = indiByXref.get(line.value);
          if (i != null) fam().wife = i;
          break;
        }
        case "CHIL": {
          const i = indiByXref.get(line.value);
          if (i != null) fam().chil.push(i);
          break;
        }
      }
    } else if (line.level === 2 && ctx) {
      const ind = () => individuals[ctx!.idx];
      const fam = () => families[ctx!.idx];
      if (line.tag === "DATE") {
        const d = fromGedcomDate(line.value);
        if (ctx.sub === "BIRT" && ctx.kind === "INDI") {
          ind().dob = d;
        } else if (ctx.sub === "DEAT" && ctx.kind === "INDI") {
          ind().dod = d;
          if (d) ind().is_living = false;
        } else if (ctx.sub === "MARR" && ctx.kind === "FAM") {
          fam().marrDate = d;
        }
      } else if (line.tag === "PLAC" && ctx.sub === "BIRT" && ctx.kind === "INDI") {
        ind().birth_place = clean(line.value, 120);
      } else if (line.tag === "NICK" && ctx.sub === "NAME" && ctx.kind === "INDI") {
        ind().nickname = clean(line.value, 40);
      }
    }
  }

  // Attach notes: replay the text once more, collecting NOTE/CONT/CONC per record.
  const noteByIndi = new Map<number, string[]>();
  const noteByFam = new Map<number, string[]>();
  let nctx: { kind: "INDI" | "FAM"; idx: number } | null = null;
  let pending: string[] | null = null;
  const flush = () => {
    if (pending && pending.length && nctx) {
      const txt = pending.join("").replace(/^\n+/, "");
      if (txt.trim()) {
        const map = nctx.kind === "INDI" ? noteByIndi : noteByFam;
        const arr = map.get(nctx.idx) ?? [];
        arr.push(txt.trim());
        map.set(nctx.idx, arr);
      }
    }
    pending = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const line = parseLine(raw);
    if (!line) continue;
    if (line.level === 0) {
      flush();
      nctx = null;
      if (line.xref && line.tag === "INDI" && indiByXref.has(line.xref))
        nctx = { kind: "INDI", idx: indiByXref.get(line.xref)! };
      else if (line.xref && line.tag === "FAM" && famByXref.has(line.xref))
        nctx = { kind: "FAM", idx: famByXref.get(line.xref)! };
      continue;
    }
    if (!nctx) continue;
    if (line.level === 1 && line.tag === "NOTE") {
      flush();
      pending = [line.value];
    } else if (pending && (line.tag === "CONT" || line.tag === "CONC")) {
      pending.push(line.tag === "CONT" ? "\n" + line.value : line.value);
    } else if (line.level === 1) {
      flush();
    }
  }
  flush();
  noteByIndi.forEach((parts, i) => {
    const cur = individuals[i].notes;
    const add = parts.join("\n");
    individuals[i].notes = cur ? `${cur}\n${add}` : add;
  });

  // Resolve FAMC links: ensure every child appears in its family's chil list.
  for (let i = 0; i < individuals.length; i++) {
    const famc = (individuals[i] as unknown as { _famc?: string })._famc;
    if (famc) {
      const fi = famByXref.get(famc);
      if (fi != null && !families[fi].chil.includes(i)) families[fi].chil.push(i);
    }
    delete (individuals[i] as unknown as { _famc?: string })._famc;
    delete (individuals[i] as unknown as { _fams?: string })._fams;
  }

  // Drop empty families (no members at all).
  const kept = families.filter(
    (f) => f.husb != null || f.wife != null || f.chil.length > 0
  );
  return { individuals, families: kept };
}
