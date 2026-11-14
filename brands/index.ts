// Brand registry. One build serves every brand; the request's host picks one (see proxy.ts).
// A brand is config only: name, logo, market, contact, hosts. Colours live in brands/<id>/theme.css.
// This file is imported by proxy.ts too, so it must stay plain data (no server-only imports).

export type Brand = {
  id: string;
  name: string;
  /** Hosts that serve this brand (without port). */
  hosts: string[];
  /** Market sent to the API: decides currency and prices. */
  market: "SE" | "NO" | "DK" | "FI";
  locale: string;
  logo: { src: string; width: number; height: number; alt: string };
  /** A one-colour logo for dark backgrounds, if the brand has one. */
  logoOnDark?: { src: string; width: number; height: number };
  tagline: string;
  heroImage?: string;
  contact: { phone?: string; email?: string };
  /** Default departure airport or group in the search form. */
  defaultOrigin: string;
};

import { allinc } from "./allinc/brand";
import { solkusten } from "./solkusten/brand";

export const brands: Record<string, Brand> = { [allinc.id]: allinc, [solkusten.id]: solkusten };

export const defaultBrandId = allinc.id;

/** The brand for a Host header. Unknown hosts get the default brand. */
export function brandIdForHost(host: string | null | undefined): string {
  const h = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  for (const b of Object.values(brands)) if (b.hosts.includes(h)) return b.id;
  return defaultBrandId;
}

export function getBrand(id: string): Brand | undefined {
  return Object.hasOwn(brands, id) ? brands[id] : undefined;
}
