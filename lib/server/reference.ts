import "server-only";
import { connection } from "next/server";
import { api } from "./api";

// What the search form offers: our destinations and departure airports. Reference data changes
// rarely, so it is kept in memory for an hour. Read at request time (not at build), so the image
// builds without the API running.

export type ReferenceData = {
  origins: { code: string; label: string }[];
  destinations: { id: string; label: string; country: string }[];
};

const COUNTRY_SV: Record<string, string> = { ES: "Spanien", GR: "Grekland", PT: "Portugal", TR: "Turkiet", CY: "Cypern", IT: "Italien", HR: "Kroatien", FR: "Frankrike" };
const CITY_SV: Record<string, string> = { Copenhagen: "Köpenhamn" };

let memo: { at: number; data: Promise<ReferenceData> } | null = null;

async function load(): Promise<ReferenceData> {
  const [dest, air] = await Promise.all([api.destinations(), api.airports()]);
  const grouped = new Set(air.groups.flatMap((g) => g.members));
  const origins = [
    ...air.groups.map((g) => ({ code: g.code, label: `${g.name.replace(/\s*\(all airports\)/i, "")} (alla flygplatser)` })),
    ...air.origins.map((o) => ({
      code: o.iata,
      label: `${CITY_SV[o.city] ?? o.city}${grouped.has(o.iata) ? ` ${o.name.replace(o.city, "").trim()}` : ""}`,
    })),
  ];
  const destinations = dest
    .map((d) => ({ id: d.id, label: d.nameSv || d.name, country: COUNTRY_SV[d.countryCode] ?? d.countryCode }))
    .sort((a, b) => a.country.localeCompare(b.country, "sv") || a.label.localeCompare(b.label, "sv"));
  return { origins, destinations };
}

export async function getReference(): Promise<ReferenceData> {
  await connection();
  if (!memo || Date.now() - memo.at > 3600_000) {
    const data = load();
    memo = { at: Date.now(), data };
    data.catch(() => (memo = null));
  }
  return memo.data;
}
