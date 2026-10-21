// Name search over a tree's members: case-insensitive, token-based
// (every query word must appear somewhere in the name/nickname), with
// prefix matches ranked first. Used by the header search box.

export interface SearchablePerson {
  given_name: string;
  family_name: string | null;
  nickname: string | null;
}

export function searchPersons<T extends SearchablePerson>(
  persons: T[],
  query: string,
  limit = 8
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const scored: { p: T; score: number }[] = [];
  for (const p of persons) {
    const full = `${p.given_name} ${p.family_name ?? ""}`.trim().toLowerCase();
    const nick = (p.nickname ?? "").toLowerCase();
    const hay = `${full} ${nick}`;
    if (!tokens.every((t) => hay.includes(t))) continue;
    let score = 2;
    if (full.startsWith(q) || (nick !== "" && nick.startsWith(q))) score = 0;
    else if (p.given_name.toLowerCase().startsWith(tokens[0])) score = 1;
    scored.push({ p, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.p);
}
