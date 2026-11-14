import "server-only";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

// Typed client for allinc-api. One function per PUBLIC route, nothing else: the site never calls
// /ops, /hotels/search, /flights/* or any other internal route. Raw responses carry fields the
// browser must not see (provider traces, FX source, booking tokens), so they never leave lib/server:
// pages use the public view models from ./view.ts.

export type Money = { amount: number; currency: string };
export type CodeName = { code: string; name: string | null };

export type SearchQuery = {
  from: string;
  to: string;
  depart: string; // yyyy-mm-dd
  nights: number;
  adults: number;
  childAges: number[];
};
export type SearchFilters = {
  bags?: "any" | "cabin" | "checked";
  direct?: boolean;
  refundable?: boolean;
  minStars?: number;
  board?: string;
  maxPrice?: number;
  sort?: "price" | "starsDesc";
  offset?: number;
  limit?: number;
};

export type RawDestination = { id: string; name: string; nameSv: string; countryCode: string; airports: string[] };
export type RawAirports = {
  origins: { iata: string; name: string; city: string; countryCode: string }[];
  groups: { code: string; name: string; members: string[] }[];
};

export type RawPackage = {
  id: string;
  price: Money;
  payAtHotel: Money | null;
  payAtHotelInMarketCurrency: Money | null;
  flightToken: string;
  hotelKey: string;
  stars: number | null;
  roomOptionId: string;
  roomName: string;
  board: CodeName;
  boardType: string | null;
  hotelRefundable: boolean;
  freeCancellationUntil: string | null;
  bagsIncluded: string;
  direct: boolean;
  roomUpgrades: { label: string; optionId: string; roomName: string; delta: Money }[];
};
export type RawPlace = { code: string; name: string; city: string; timeZone: string };
export type RawSegment = {
  flightNumber: string;
  marketingCarrier: CodeName;
  origin: RawPlace;
  destination: RawPlace;
  departsLocal: string;
  arrivesLocal: string;
  duration: string;
};
export type RawFlight = {
  airline: CodeName;
  price: Money;
  journeys: { origin: RawPlace; destination: RawPlace; duration: string; stops: number; segments: RawSegment[] }[];
};
export type RawHotel = {
  name: string;
  stars: number | null;
  category: CodeName;
  zone: CodeName | null;
  destination: CodeName;
  location: { lat: number; lng: number } | null;
};
export type RawSearch = {
  pricing: { market: string; currency: string };
  destination: RawDestination;
  flightsLiveMode: boolean;
  packagesAvailable: number;
  packagesReturned: number;
  packages: RawPackage[];
  flights: Record<string, RawFlight>;
  hotels: Record<string, RawHotel>;
};
export type RawContent = {
  hotels: Record<
    string,
    {
      description: string | null;
      address: { line: string | null; postalCode: string | null; city: string | null } | null;
      images: { url: string; largeUrl: string | null; typeLabel: string | null; order: number }[];
      interestPoints: { name: string; distance: string | null }[] | null;
      terminals: { code: string; distanceKm: number | null }[] | null;
    }
  >;
};
export type RawRoomOption = {
  optionId: string;
  roomName: string;
  board: CodeName;
  boardType: string | null;
  refundable: boolean;
  freeCancellationUntil: string | null;
  bookable: boolean;
  hotelPrice: Money;
  delta: Money;
  matchesFilters: boolean;
  isWinning: boolean;
  isSelected: boolean;
};
export type RawFlightOption = {
  flightToken: string;
  airline: CodeName;
  outbound: string;
  return: string;
  stops: number;
  bagsIncluded: string;
  duration: string | null;
  price: Money;
  delta: Money;
  matchesFilters: boolean;
  isWinning: boolean;
  isSelected: boolean;
};
export type RawOffer = {
  pricing: { market: string; currency: string };
  destination: RawDestination;
  flightsLiveMode: boolean;
  hotel: RawHotel;
  winning: RawPackage;
  selected: RawPackage;
  selectedDelta: Money;
  roomOptions: RawRoomOption[];
  flightOptions: RawFlightOption[];
  flightOptionsAvailable: number;
  flights: Record<string, RawFlight>;
};
export type RawTransferChoice = {
  optionId: string;
  type: string;
  vehicle: string;
  category: string | null;
  maxPax: number;
  luggage: number | null;
  journeyMinutes: number | null;
  maxWaitMinutes: number | null;
  price: Money;
  delta: Money;
  roundTrip: boolean;
  refundable: boolean;
  freeCancellationUntil: string | null;
  imageUrl: string | null;
  isRecommended: boolean;
};
export type RawTransfers = {
  trip: { arrivalAirport: string; arrivalLocal: string; departureAirport: string | null; departureFlightLocal: string | null; travellers: number; note: string | null };
  recommended: RawTransferChoice | null;
  reason: string;
  options: RawTransferChoice[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public kind: "NotFound" | "SourcesFailed" | "BadRequest" | "Unavailable",
  ) {
    super(`allinc-api ${status} ${kind}`);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

function queryString(p: Params): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "" && v !== false) u.set(k, String(v));
  return u.toString();
}

function searchParams(q: SearchQuery, market: string): Params {
  return {
    from: q.from,
    to: q.to,
    depart: q.depart,
    nights: q.nights,
    adults: q.adults,
    childAges: q.childAges.length ? q.childAges.join(",") : undefined,
    market,
  };
}

// ---- record / replay (dev): spend no supplier quota while building pages ----

function fixtureFile(route: string, p: Params): string {
  const hotel = typeof p.hotel === "string" ? p.hotel.replace(/[^a-z0-9]+/gi, "_") : null;
  switch (route) {
    case "/packages/offer":
      return `offers/${hotel}.json`;
    case "/packages/offer/transfers":
      return `transfers/${hotel}.json`;
    default:
      return route.replace(/^\//, "").replace(/\//g, "-") + ".json";
  }
}

async function replay(route: string, p: Params): Promise<unknown> {
  const dir = env.fixturesDir;
  const file = path.join(dir, fixtureFile(route, p));
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // Offers and transfers: fall back to any recorded hotel so every page still renders offline.
    const sub = path.dirname(fixtureFile(route, p));
    if (sub === ".") throw new ApiError(404, "NotFound");
    const files = (await readdir(path.join(dir, sub))).filter((f) => f.endsWith(".json")).sort();
    if (!files.length) throw new ApiError(404, "NotFound");
    return JSON.parse(await readFile(path.join(dir, sub, files[0]), "utf8"));
  }
}

async function record(route: string, p: Params, body: unknown) {
  const file = path.join(env.fixturesDir, fixtureFile(route, p));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(body));
}

async function get<T>(route: string, p: Params, timeoutMs = 45_000): Promise<T> {
  if (env.apiMode === "replay") {
    // Transfers take a few seconds live; mimic that so the checkout's loading state shows offline too.
    if (route === "/packages/offer/transfers") await new Promise((r) => setTimeout(r, 1500));
    const body = (await replay(route, p)) as { data?: T } | T;
    return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
  }
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${route}?${queryString(p)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError(503, "Unavailable");
  }
  if (!res.ok) {
    const kind = res.status === 404 ? "NotFound" : res.status === 400 ? "BadRequest" : res.status === 502 ? "SourcesFailed" : "Unavailable";
    throw new ApiError(res.status, kind);
  }
  const body = (await res.json()) as { data?: T } | T;
  if (env.apiMode === "record") await record(route, p, body).catch(() => {});
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
}

// ---- public routes ----

export const api = {
  destinations: () => get<RawDestination[]>("/destinations", {}),
  airports: () => get<RawAirports>("/airports", {}),
  search: (q: SearchQuery, f: SearchFilters, market: string) =>
    get<RawSearch>("/packages/search", { ...searchParams(q, market), ...f }),
  content: (hotelKeys: string[], language: string) =>
    get<RawContent>("/hotels/content", { hotels: hotelKeys.join(","), language, maxImages: 10 }),
  offer: (q: SearchQuery, f: SearchFilters, market: string, hotel: string, flight?: string, room?: string) =>
    get<RawOffer>("/packages/offer", { ...searchParams(q, market), ...offerFilters(f), hotel, flight, room, flightLimit: 12 }),
  transfers: (q: SearchQuery, f: SearchFilters, market: string, hotel: string, flight?: string) =>
    get<RawTransfers>("/packages/offer/transfers", { ...searchParams(q, market), ...offerFilters(f), hotel, flight }),
};

/** Offer and transfers take the search's filters, not its sort/paging. */
function offerFilters(f: SearchFilters): SearchFilters {
  return { bags: f.bags, direct: f.direct, refundable: f.refundable, minStars: f.minStars, board: f.board };
}
