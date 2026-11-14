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
  identityDocumentsRequired?: boolean;
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

export type CheckoutStatus = "Ok" | "Changed" | "SoldOut" | "CannotConfirm" | "Expired";
export type RawCheckout = {
  checkoutId: string;
  status: CheckoutStatus;
  currency: string;
  total: Money;
  previousTotal: Money | null;
  checkedAt: string;
  expiresAt: string;
  checksLeft: number;
  lines: { product: "Flight" | "Hotel" | "Transfer"; status: "Confirmed" | "Changed" | "SoldOut" | "CannotConfirm"; price: Money; previousPrice: Money | null; changes: string[] }[];
  soldOut: { what: "flight" | "room" | "hotel" | "transfer"; redirect: "offer" | "results" | "checkout"; hotelKey: string | null; alsoSoldOut: string[] } | null;
};
export type CheckoutChoice = { q: SearchQuery; f: SearchFilters; market: string; hotel: string; flight?: string; room?: string; transfer?: string | null };

export class ApiError extends Error {
  constructor(
    public status: number,
    public kind: "NotFound" | "SourcesFailed" | "BadRequest" | "Unavailable" | "TooManyChecks" | "TotalMismatch" | "Unauthorized",
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

// ---- checkout (POST, JSON) ----

// Replay checkout: statuses come from dev/fixtures/checkout, amounts from the recorded offer and
// transfer fixtures for the chosen hotel, so checkout matches what the offer page showed.
let replayLast: { hotel?: string; transfer?: string | null } = {};

async function replayCheckout(route: string, body: unknown): Promise<RawCheckout> {
  // revalidate-<scenario>.json answers "Till betalning": ALLINC_REPLAY_CHECKOUT = ok | changed |
  // soldout-flight | soldout-room | soldout-hotel | soldout-transfer | cannotconfirm | expired.
  await new Promise((r) => setTimeout(r, 1200));
  if (route === "/checkout") replayLast = body as typeof replayLast;
  const dir = path.join(env.fixturesDir, "checkout");
  const read = async (f: string) => JSON.parse(await readFile(path.join(dir, f), "utf8")) as RawCheckout;

  const offer = ((await replay("/packages/offer", { hotel: replayLast.hotel })) as { data: RawOffer & { selected: { flightPrice: Money; hotelPrice: Money } } }).data;
  const amounts: Record<string, Money | null> = { Flight: offer.selected.flightPrice, Hotel: offer.selected.hotelPrice, Transfer: null };
  if (replayLast.transfer) {
    const tr = ((await replay("/packages/offer/transfers", { hotel: replayLast.hotel })) as { data: RawTransfers }).data;
    amounts.Transfer = tr.options.find((o) => o.optionId === replayLast.transfer)?.price ?? null;
  }
  const fit = (r: RawCheckout): RawCheckout => {
    const lines = r.lines
      .filter((l) => amounts[l.product])
      .map((l) => {
        const base = amounts[l.product]!;
        const bump = l.previousPrice ? l.price.amount - l.previousPrice.amount : 0; // the fixture's price change
        return { ...l, price: { ...base, amount: base.amount + bump }, previousPrice: l.previousPrice ? base : null };
      });
    const total = lines.reduce((n, l) => n + l.price.amount, 0);
    const prev = lines.reduce((n, l) => n + (l.previousPrice ?? l.price).amount, 0);
    return { ...r, total: { amount: total, currency: r.currency }, previousTotal: r.previousTotal ? { amount: prev, currency: r.currency } : null, lines };
  };

  if (route.endsWith("/revalidate")) return fit(await read(`revalidate-${process.env.ALLINC_REPLAY_CHECKOUT ?? "ok"}.json`));
  const start = fit(await read("start.json"));
  if (route.endsWith("/confirm")) {
    const total = (body as { total: number }).total;
    return { ...start, status: "Ok", total: { amount: total, currency: start.currency }, previousTotal: null };
  }
  return start;
}

async function post(route: string, body: unknown, headers: Record<string, string> = {}): Promise<RawCheckout> {
  if (env.apiMode === "replay") return replayCheckout(route, body);
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${route}`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json", ...webKey(), ...headers },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    throw new ApiError(503, "Unavailable");
  }
  return checkoutResponse(res);
}

async function getCheckout(id: string): Promise<RawCheckout> {
  if (env.apiMode === "replay") return replayCheckout(`/checkout/${id}`, null);
  const res = await fetch(`${env.apiUrl}/checkout/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { accept: "application/json", ...webKey() },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) throw new ApiError(503, "Unavailable");
  return checkoutResponse(res);
}

const webKey = (): Record<string, string> => (env.webKey ? { "X-Allinc-Web-Key": env.webKey } : {});

async function checkoutResponse(res: Response): Promise<RawCheckout> {
  if (res.ok) return (await res.json()) as RawCheckout;
  const kind =
    res.status === 404 ? "NotFound"
    : res.status === 409 ? "TotalMismatch"
    : res.status === 429 ? "TooManyChecks"
    : res.status === 401 ? "Unauthorized"
    : res.status === 400 ? "BadRequest"
    : res.status === 503 ? "SourcesFailed"
    : "Unavailable";
  throw new ApiError(res.status, kind);
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
  checkout: {
    /** Live price check of the chosen package. Spends supplier calls unless the key + choice match a live session. */
    start: (c: CheckoutChoice, idempotencyKey: string) =>
      post(
        "/checkout",
        {
          from: c.q.from, to: c.q.to, depart: c.q.depart, nights: c.q.nights, adults: c.q.adults, childAges: c.q.childAges,
          bags: c.f.bags, direct: !!c.f.direct, refundable: !!c.f.refundable, minStars: c.f.minStars ?? null, board: c.f.board ?? null,
          market: c.market, hotel: c.hotel, flight: c.flight ?? null, room: c.room ?? null, transfer: c.transfer ?? null,
        },
        { "Idempotency-Key": idempotencyKey },
      ),
    get: (id: string) => getCheckout(id),
    /** At "Betala": checks again only if the last check is old or the hold is about to run out. */
    revalidate: (id: string) => post(`/checkout/${encodeURIComponent(id)}/revalidate`, {}),
    /** The customer accepts a changed total. The total must come from the session, never the browser. */
    confirm: (id: string, total: number) => post(`/checkout/${encodeURIComponent(id)}/confirm`, { total }),
  },
};

/** Offer and transfers take the search's filters, not its sort/paging. */
function offerFilters(f: SearchFilters): SearchFilters {
  return { bags: f.bags, direct: f.direct, refundable: f.refundable, minStars: f.minStars, board: f.board };
}
