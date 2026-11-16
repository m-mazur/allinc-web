import "server-only";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { syntheticExtras } from "./replay-extras";

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
  lines: { product: "Flight" | "Hotel" | "Transfer" | "Extras"; status: "Confirmed" | "Changed" | "SoldOut" | "CannotConfirm"; price: Money; previousPrice: Money | null; changes: string[] }[];
  soldOut: { what: "flight" | "room" | "hotel" | "transfer" | "extras"; redirect: "offer" | "results" | "checkout"; hotelKey: string | null; alsoSoldOut: string[] } | null;
};

/**
 * GET /checkout/{id}/extras: the flight's extra bags and paid seats, customer prices. Ids are the API's own
 * opaque hashes (no supplier data); the API accepts only ids it showed this checkout.
 * passenger = index in the traveller form (adults, then children as searched).
 */
export type RawExtras = {
  checkoutId: string;
  currency: string;
  available: boolean;
  passengers: { index: number; type: "Adult" | "Child"; age: number | null; seat: boolean }[];
  journeys: { index: number; origin: string; destination: string; departsLocal: string }[];
  bags: { id: string; passenger: number; journeys: number[]; kind: string; maxWeightKg: number | null; maxQuantity: number; price: Money }[];
  seatMaps: {
    journey: number;
    flightNumber: string;
    departsLocal: string;
    origin: string;
    destination: string;
    cabins: { cabinClass: string | null; rows: { type: string; designator: string | null; disclosures: string[]; prices: { id: string; passenger: number; price: Money }[] }[][][] }[];
  }[];
  selected: ExtraChoice[];
};
export type ExtraChoice = { id: string; quantity: number };
export type CheckoutChoice = { q: SearchQuery; f: SearchFilters; market: string; hotel: string; flight?: string; room?: string; transfer?: string | null };

/** A test booking made from a checked checkout (POST /checkout/{id}/book). Public shape: no supplier data. */
export type RawBooking = {
  reference: string;
  status: "Confirmed" | "Failed" | "NeedsAttention" | "Pending" | "Cancelled";
  /** What to tell the customer; the web writes its own Swedish copy from it. */
  messageCode:
    | "Confirmed" | "ConfirmedWithoutTransfer" | "ConfirmedTicketsFollow" | "BeingConfirmed" | "InProgress"
    | "NotBookedSoldOut" | "NotBookedPriceChanged" | "NotBooked" | "Cancelled";
  customerMessage: string | null; // English, for staff: never shown
  lines: { product: "Flight" | "Hotel" | "Transfer"; status: string }[]; // Confirmed | Failed | Undone | Unknown | Pending | Cancelled
  isTest: boolean;
};
export type BookingBody = {
  lead: { firstName: string; lastName: string; email: string; phone: string; language: string };
  travellers: { firstName: string; lastName: string; birthDate: string; gender: "m" | "f"; type: "Adult" | "Child"; passport: { number: string; issuingCountry: string; expiresOn: string } | null }[];
  remark: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public kind:
      | "NotFound" | "SourcesFailed" | "BadRequest" | "Unavailable" | "TooManyChecks" | "TotalMismatch" | "Unauthorized"
      | "NotBookable" | "InvalidTravellers" | "BookingDisabled"
      | "NotPossible" | "ExtrasUnavailable" | "BadExtras",
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

/**
 * Replay only: a recorded offer is for the default choice. Apply a room or flight swap the way the
 * API does (selected = winning + the options' deltas), so swapping works offline too.
 */
function replaySwaps(offer: RawOffer, p: Params): RawOffer {
  const room = typeof p.room === "string" ? offer.roomOptions.find((r) => r.optionId === p.room) : undefined;
  const flight = typeof p.flight === "string" ? offer.flightOptions.find((f) => f.flightToken === p.flight) : undefined;
  if (!room && !flight) return offer;
  const o: RawOffer = structuredClone(offer);
  const r = room ?? o.roomOptions.find((x) => x.isWinning)!;
  const f = flight ?? o.flightOptions.find((x) => x.isWinning)!;
  o.roomOptions = o.roomOptions.map((x) => ({ ...x, isSelected: x.optionId === r.optionId }));
  o.flightOptions = o.flightOptions.map((x) => ({ ...x, isSelected: x.flightToken === f.flightToken }));
  const delta = r.delta.amount + f.delta.amount;
  o.selected = {
    ...o.winning,
    price: { ...o.winning.price, amount: o.winning.price.amount + delta },
    roomOptionId: r.optionId,
    roomName: r.roomName,
    board: r.board,
    boardType: r.boardType,
    hotelRefundable: r.refundable,
    freeCancellationUntil: r.freeCancellationUntil,
    flightToken: f.flightToken,
    bagsIncluded: f.bagsIncluded,
  };
  o.selectedDelta = { ...o.winning.price, amount: delta };
  // The recorded package also splits the price into flight and hotel; keep that consistent.
  const w = o.winning as RawPackage & { flightPrice?: Money; hotelPrice?: Money };
  if (w.flightPrice && w.hotelPrice)
    Object.assign(o.selected, {
      flightPrice: { ...w.flightPrice, amount: w.flightPrice.amount + f.delta.amount },
      hotelPrice: { ...w.hotelPrice, amount: w.hotelPrice.amount + r.delta.amount },
    });
  if (!o.flights[f.flightToken]) o.flights[f.flightToken] = flightFromSummary(f, o.flights[o.winning.flightToken], String(p.depart ?? ""), Number(p.nights ?? 0));
  return o;
}

/** Replay only: a flight option carries a one-line summary per direction ("ARN 19:05 → BCN 22:45 via CPH · D85503"). */
function flightFromSummary(f: RawFlightOption, like: RawFlight, depart: string, nights: number): RawFlight {
  const back = depart ? new Date(Date.parse(depart) + nights * 86_400_000).toISOString().slice(0, 10) : "";
  const leg = (text: string, date: string, i: number) => {
    const m = /^(\w{3}) (\d\d:\d\d) → (\w{3}) (\d\d:\d\d)(?: via ([\w ,]+?))? ·/.exec(text);
    const tpl = like.journeys[i] ?? like.journeys[0];
    if (!m) return tpl;
    const via = m[5] ? m[5].split(/,\s*/) : [];
    const place = (code: string) => ({ code, name: code, city: code, timeZone: "" });
    return {
      ...tpl,
      origin: place(m[1]),
      destination: place(m[3]),
      stops: via.length,
      duration: (f.duration ?? "").split(" + ")[i] ?? "",
      segments: [
        ...via.map((v) => ({ ...tpl.segments[0], destination: place(v) })),
        { ...tpl.segments[tpl.segments.length - 1], origin: place(m[1]), destination: place(m[3]), departsLocal: `${date}T${m[2]}:00`, arrivesLocal: `${date}T${m[4]}:00` },
      ].map((s, k, all) => (k === 0 ? { ...s, departsLocal: `${date}T${m[2]}:00` } : k === all.length - 1 ? s : s)),
    };
  };
  return { ...like, airline: f.airline, price: f.price, journeys: [leg(f.outbound, depart, 0), leg(f.return, back, 1)] };
}

async function get<T>(route: string, p: Params, timeoutMs = 45_000): Promise<T> {
  if (env.apiMode === "replay") {
    // Transfers take a few seconds live; mimic that so the checkout's loading state shows offline too.
    if (route === "/packages/offer/transfers") await new Promise((r) => setTimeout(r, 1500));
    const body = (await replay(route, p)) as { data?: T } | T;
    const data = (body && typeof body === "object" && "data" in body ? body.data : body) as T;
    return (route === "/packages/offer" ? replaySwaps(data as RawOffer, p) : data) as T;
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
let replayLast: { hotel?: string; flight?: string | null; room?: string | null; transfer?: string | null; adults?: number; childAges?: number[] } = {};
// Replay extras: what the last PUT chose, priced from the synthetic extras (replay-extras.ts).
let replayExtras: { choice: ExtraChoice[]; amount: number; row1Gone?: boolean } = { choice: [], amount: 0 };

async function replayCheckout(route: string, body: unknown): Promise<RawCheckout> {
  // revalidate-<scenario>.json answers "Till betalning": ALLINC_REPLAY_CHECKOUT = ok | changed |
  // soldout-flight | soldout-room | soldout-hotel | soldout-transfer | cannotconfirm | expired.
  await new Promise((r) => setTimeout(r, 1200));
  if (route === "/checkout") {
    replayLast = body as typeof replayLast;
    replayExtras = { choice: [], amount: 0 };
  }
  const dir = path.join(env.fixturesDir, "checkout");
  const read = async (f: string) => JSON.parse(await readFile(path.join(dir, f), "utf8")) as RawCheckout;

  const recorded = ((await replay("/packages/offer", { hotel: replayLast.hotel })) as { data: RawOffer }).data;
  const offer = replaySwaps(recorded, { flight: replayLast.flight ?? undefined, room: replayLast.room ?? undefined }) as RawOffer & {
    selected: { flightPrice: Money; hotelPrice: Money };
  };
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
    if (replayExtras.choice.length && r.status !== "SoldOut")
      lines.push({ product: "Extras", status: "Confirmed", price: { amount: replayExtras.amount, currency: r.currency }, previousPrice: null, changes: [] });
    const total = lines.reduce((n, l) => n + l.price.amount, 0);
    const prev = lines.reduce((n, l) => n + (l.previousPrice ?? l.price).amount, 0);
    // Hold as the API sets it: 20 minutes from this check (the fixtures' own times are placeholders).
    // ALLINC_REPLAY_HOLD_SECONDS shortens it to try the countdown's expiry.
    const now = Date.now();
    return {
      ...r,
      total: { amount: total, currency: r.currency },
      previousTotal: r.previousTotal ? { amount: prev, currency: r.currency } : null,
      lines,
      checkedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + Number(process.env.ALLINC_REPLAY_HOLD_SECONDS ?? 1200) * 1000).toISOString(),
    };
  };

  if (route.endsWith("/extras")) {
    const extras = await replayExtrasView(route.split("/")[2]);
    const prices = new Map<string, number>();
    extras.bags.forEach((b) => prices.set(b.id, b.price.amount));
    extras.seatMaps.forEach((m) => m.cabins.forEach((c) => c.rows.forEach((r) => r.forEach((sec) => sec.forEach((e) => e.prices.forEach((p) => prices.set(p.id, p.price.amount)))))));
    const choice = (body as { items: ExtraChoice[] }).items;
    if (process.env.ALLINC_REPLAY_EXTRAS === "gone" && !replayExtras.row1Gone && choice.some((c) => /^xs\d\d1[A-F]p/.test(c.id))) {
      replayExtras = { ...replayExtras, row1Gone: true };
      throw new ApiError(409, "ExtrasUnavailable");
    }
    if (choice.some((c) => !prices.has(c.id))) throw new ApiError(400, "BadExtras");
    replayExtras = { ...replayExtras, choice, amount: choice.reduce((n, c) => n + prices.get(c.id)! * c.quantity, 0) };
    return fit(await read("start.json"));
  }
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

/** Replay: extras made up from the recorded offer's selected flight (dev only, see replay-extras.ts). */
async function replayExtrasView(id: string): Promise<RawExtras> {
  const recorded = ((await replay("/packages/offer", { hotel: replayLast.hotel })) as { data: RawOffer }).data;
  const offer = replaySwaps(recorded, { flight: replayLast.flight ?? undefined, room: replayLast.room ?? undefined });
  const flight = offer.flights[offer.selected.flightToken];
  return syntheticExtras(id, flight, replayLast.adults ?? 2, replayLast.childAges ?? [], replayExtras.choice, process.env.ALLINC_REPLAY_EXTRAS === "none", replayExtras.row1Gone);
}

async function getExtras(id: string): Promise<RawExtras> {
  if (env.apiMode === "replay") {
    await new Promise((r) => setTimeout(r, 800));
    return replayExtrasView(id);
  }
  const res = await fetch(`${env.apiUrl}/checkout/${encodeURIComponent(id)}/extras`, {
    cache: "no-store",
    headers: { accept: "application/json", ...webKey() },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) throw new ApiError(503, "Unavailable");
  if (res.ok) return (await res.json()) as RawExtras;
  throw new ApiError(res.status, await extrasErrorKind(res));
}

/** PUT /checkout/{id}/extras: the customer's bags and seats, priced live; answers the checkout. [] removes them. */
async function putExtras(id: string, items: ExtraChoice[]): Promise<RawCheckout> {
  if (env.apiMode === "replay") return replayCheckout(`/checkout/${id}/extras`, { items });
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}/checkout/${encodeURIComponent(id)}/extras`, {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json", ...webKey() },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError(503, "Unavailable");
  }
  if (res.ok) return (await res.json()) as RawCheckout;
  throw new ApiError(res.status, await extrasErrorKind(res));
}

/** Extras errors: 409 NotPossible | ExtrasUnavailable, 400 BadExtras, 429 TooManyChecks, 503 CannotConfirm, 404. */
async function extrasErrorKind(res: Response): Promise<ApiError["kind"]> {
  const err = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
  if (err === "NotPossible" || err === "ExtrasUnavailable" || err === "BadExtras" || err === "TooManyChecks") return err;
  return res.status === 404 ? "NotFound" : res.status === 401 ? "Unauthorized" : res.status === 503 ? "SourcesFailed" : "Unavailable";
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

async function postBooking(id: string, body: BookingBody, idempotencyKey: string): Promise<RawBooking> {
  if (env.apiMode === "replay") {
    // dev/fixtures/checkout/book-<ALLINC_REPLAY_BOOKING>.json: confirmed | failed | attention
    await new Promise((r) => setTimeout(r, 2500));
    const f = path.join(env.fixturesDir, "checkout", `book-${process.env.ALLINC_REPLAY_BOOKING ?? "confirmed"}.json`);
    return JSON.parse(await readFile(f, "utf8")) as RawBooking;
  }
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}/checkout/${encodeURIComponent(id)}/book`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json", "Idempotency-Key": idempotencyKey, ...webKey() },
      body: JSON.stringify(body),
      // A booking runs three suppliers one after another; give it time, and never retry blindly.
      signal: AbortSignal.timeout(150_000),
    });
  } catch {
    throw new ApiError(503, "Unavailable");
  }
  // 200 for every booking outcome (also Failed / NeedsAttention). Errors: 409 NotBookable (the checkout
  // is not Ok), 400 InvalidTravellers, 403 BookingDisabled (Bookings:AllowWebBookings off), 404 NotFound.
  if (res.ok) return (await res.json()) as RawBooking;
  const err = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
  const kind =
    err === "NotBookable" || err === "InvalidTravellers" || err === "BookingDisabled" ? err
    : res.status === 404 ? "NotFound"
    : res.status === 401 ? "Unauthorized"
    : res.status === 400 ? "BadRequest"
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
    /** TEST ONLY while there is no payment provider: books the checked package on the suppliers' test systems. */
    book: (id: string, body: BookingBody, idempotencyKey: string) => postBooking(id, body, idempotencyKey),
    /** Extra bags and paid seats for the checkout's flight. From the API's cache; a miss asks the airline (free). */
    extras: (id: string) => getExtras(id),
    /** Sets the bags and seats; the airline prices them live. */
    setExtras: (id: string, items: ExtraChoice[]) => putExtras(id, items),
  },
};

/** Offer and transfers take the search's filters, not its sort/paging. */
function offerFilters(f: SearchFilters): SearchFilters {
  return { bags: f.bags, direct: f.direct, refundable: f.refundable, minStars: f.minStars, board: f.board };
}
