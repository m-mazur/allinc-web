// Display helpers, safe on server and client.

export type Price = { amount: number; currency: string };

export function money(p: Price, opts: { sign?: boolean } = {}): string {
  const s = new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: p.currency === "EUR" ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(Math.abs(p.amount));
  if (!opts.sign) return p.amount < 0 ? `−${s}` : s;
  return p.amount === 0 ? "±0 kr" : `${p.amount > 0 ? "+" : "−"}${s}`;
}

export function dateLong(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(iso.slice(0, 10) + "T00:00:00Z"),
  );
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-12-13T19:05:00" (local time at the airport) -> "19:05" */
export const clock = (local: string) => local.slice(11, 16);

/** ISO-8601 duration "PT3H40M" -> "3 h 40 min" */
export function duration(iso: string | null | undefined): string {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso ?? "");
  if (!m) return "";
  const h = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0);
  const min = Number(m[3] ?? 0);
  return [h ? `${h} h` : "", min ? `${min} min` : ""].filter(Boolean).join(" ");
}

export function party(adults: number, children: number): string {
  const a = `${adults} ${adults === 1 ? "vuxen" : "vuxna"}`;
  return children ? `${a}, ${children} ${children === 1 ? "barn" : "barn"}` : a;
}

export const nightsLabel = (n: number) => `${n} ${n === 1 ? "natt" : "nätter"}`;
