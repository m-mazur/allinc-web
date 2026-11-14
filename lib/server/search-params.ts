import "server-only";
import type { SearchFilters, SearchQuery } from "./api";

// The search lives in the URL (/sok?from=STO&to=es.barcelona&depart=2026-12-13&nights=7&adults=2&children=7,4)
// so results can be shared, bookmarked and crawled. Everything is validated here; nothing raw is forwarded.

export type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const clampInt = (v: string, min: number, max: number, dflt: number) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export const BOARDS = ["RoomOnly", "SelfCatering", "BedAndBreakfast", "HalfBoard", "FullBoard", "AllInclusive"] as const;

export function defaultDepart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function parseSearch(sp: SP, defaultOrigin: string): { query: SearchQuery; filters: SearchFilters; valid: boolean } {
  const from = one(sp.from).toUpperCase();
  const to = one(sp.to).toLowerCase();
  const depart = one(sp.depart);
  const childAges = one(sp.children)
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 17)
    .slice(0, 6);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(depart) && !Number.isNaN(Date.parse(depart)) && depart > new Date().toISOString().slice(0, 10);

  const query: SearchQuery = {
    from: /^[A-Z]{3}$/.test(from) ? from : defaultOrigin,
    to: /^[a-z]{2}\.[a-z0-9-]{2,40}$/.test(to) ? to : "",
    depart: validDate ? depart : defaultDepart(),
    nights: clampInt(one(sp.nights), 1, 21, 7),
    adults: clampInt(one(sp.adults), 1, 8, 2),
    childAges,
  };

  const board = one(sp.board);
  const sort = one(sp.sort);
  const bags = one(sp.bags);
  const minStars = Number.parseInt(one(sp.stars), 10);
  const filters: SearchFilters = {
    board: (BOARDS as readonly string[]).includes(board) ? board : undefined,
    minStars: minStars >= 2 && minStars <= 5 ? minStars : undefined,
    direct: one(sp.direct) === "1" || undefined,
    refundable: one(sp.refundable) === "1" || undefined,
    bags: bags === "checked" || bags === "cabin" ? bags : undefined,
    sort: sort === "starsDesc" ? "starsDesc" : undefined,
    limit: clampInt(one(sp.limit), 10, 100, 20),
  };
  return { query, filters, valid: Boolean(query.to) };
}

/** Back to URL params, for links that keep the search (filters, "show more"). */
export function toParams(q: SearchQuery, f: SearchFilters, change: Record<string, string | undefined> = {}): string {
  const u = new URLSearchParams({
    from: q.from,
    to: q.to,
    depart: q.depart,
    nights: String(q.nights),
    adults: String(q.adults),
  });
  if (q.childAges.length) u.set("children", q.childAges.join(","));
  if (f.board) u.set("board", f.board);
  if (f.minStars) u.set("stars", String(f.minStars));
  if (f.direct) u.set("direct", "1");
  if (f.refundable) u.set("refundable", "1");
  if (f.bags) u.set("bags", f.bags);
  if (f.sort) u.set("sort", f.sort);
  if (f.limit && f.limit !== 20) u.set("limit", String(f.limit));
  for (const [k, v] of Object.entries(change)) {
    if (v === undefined) u.delete(k);
    else u.set(k, v);
  }
  return u.toString();
}
