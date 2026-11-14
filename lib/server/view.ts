import "server-only";
import type {
  RawContent,
  RawFlight,
  RawHotel,
  RawOffer,
  RawPackage,
  RawSearch,
  RawTransferChoice,
  RawTransfers,
  SearchFilters,
  SearchQuery,
} from "./api";
import { seal, sealStable, unseal } from "./seal";
import { clock, duration, type Price } from "../format";

// Public view models: the ONLY shapes pages and client components get. Every field is chosen;
// nothing is spread from an API response. Not here, ever: supplier or provider names, hotel keys,
// flight booking tokens, cost, markup, FX source or dates, cache/source traces, diagnostics.

// ---------- sealed trip references ----------

/** What a link to an offer or checkout carries, sealed. */
type TripRef = { q: SearchQuery; f: SearchFilters; h: string; fl?: string; r?: string; t: number };
const TRIP = "trip.v1";
const TRIP_MAX_AGE_MS = 24 * 3600_000;

export function tripRef(q: SearchQuery, f: SearchFilters, hotelKey: string, flight?: string, room?: string): string {
  const keep: SearchFilters = { bags: f.bags, direct: f.direct, refundable: f.refundable, minStars: f.minStars, board: f.board };
  return seal(TRIP, { q, f: keep, h: hotelKey, fl: flight, r: room, t: Date.now() } satisfies TripRef);
}

export function openTripRef(token: string): TripRef | null {
  const ref = unseal<TripRef>(TRIP, decodeURIComponent(token));
  if (!ref || Date.now() - ref.t > TRIP_MAX_AGE_MS) return null;
  return ref;
}

/** Supplier image hosts reveal the supplier; images go through our /bild route instead. */
export const imageUrl = (url: string) => `/bild/${sealStable("img.v1", url)}`;

// ---------- shared pieces ----------

export type FlightLeg = { from: string; to: string; departs: string; arrives: string; date: string; stops: number; via: string[]; duration: string };
export type FlightView = { airline: string; legs: FlightLeg[] };

const BOARD_SV: Record<string, string> = {
  RoomOnly: "Endast logi",
  SelfCatering: "Självhushåll",
  BedAndBreakfast: "Frukost",
  HalfBoard: "Halvpension",
  FullBoard: "Helpension",
  AllInclusive: "All inclusive",
};
export const boardLabel = (type: string | null, fallback?: string | null) =>
  (type && BOARD_SV[type]) || titleCase(fallback ?? "") || "Logi";

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-/(])([a-zåäöéü])/g, (_, p, c) => p + c.toUpperCase());
}

/** The flight supplier's test mode invents an airline named after itself (code ZZ); never show that name. */
const airlineName = (a: { code: string; name: string | null }) => (a.code === "ZZ" ? "Testflyg" : (a.name ?? a.code));

function flightView(f: RawFlight): FlightView {
  return {
    airline: airlineName(f.airline),
    legs: f.journeys.map((j) => ({
      from: j.origin.code,
      to: j.destination.code,
      departs: clock(j.segments[0].departsLocal),
      arrives: clock(j.segments[j.segments.length - 1].arrivesLocal),
      date: j.segments[0].departsLocal.slice(0, 10),
      stops: j.stops,
      via: j.segments.slice(0, -1).map((s) => s.destination.code),
      duration: duration(j.duration),
    })),
  };
}

const BAGS_SV: Record<string, string> = { none: "Inget bagage ingår", cabin: "Handbagage ingår", checked: "Incheckat bagage ingår" };
const bagsLabel = (b: string) => BAGS_SV[b] ?? "";
const price = (p: { amount: number; currency: string }): Price => ({ amount: p.amount, currency: p.currency });

function hotelBasics(h: RawHotel) {
  return {
    name: h.name,
    stars: h.stars,
    kind: h.stars ? null : titleCase(h.category?.name ?? ""),
    area: h.zone?.name ? titleCase(h.zone.name) : null,
    city: h.destination?.name ?? null,
  };
}

// ---------- search results ----------

export type ResultCard = {
  id: string; // stable within the page, opaque
  ref: string; // sealed: opens the offer page
  hotel: ReturnType<typeof hotelBasics>;
  board: string;
  refundable: boolean;
  room: string;
  flight: FlightView;
  direct: boolean;
  bags: string;
  price: Price;
  perPerson: Price;
  payAtHotel: Price | null;
  imageKey: string; // used to look up the photo once content arrives (opaque index, not the hotel key)
};

export type ResultsView = {
  destination: string;
  total: number;
  shown: number;
  testFlights: boolean;
  cards: ResultCard[];
};

export function mapSearch(raw: RawSearch, q: SearchQuery, f: SearchFilters): ResultsView {
  const travellers = q.adults + q.childAges.length;
  return {
    destination: raw.destination.nameSv || raw.destination.name,
    total: raw.packagesAvailable,
    shown: raw.packagesReturned,
    testFlights: !raw.flightsLiveMode,
    cards: raw.packages.map((p: RawPackage, i) => ({
      id: p.id,
      ref: tripRef(q, f, p.hotelKey),
      hotel: hotelBasics(raw.hotels[p.hotelKey]),
      board: boardLabel(p.boardType, p.board.name),
      refundable: p.hotelRefundable,
      room: titleCase(p.roomName),
      flight: flightView(raw.flights[p.flightToken]),
      direct: p.direct,
      bags: bagsLabel(p.bagsIncluded),
      price: price(p.price),
      perPerson: { amount: Math.round(p.price.amount / travellers), currency: p.price.currency },
      payAtHotel: p.payAtHotelInMarketCurrency ? price(p.payAtHotelInMarketCurrency) : null,
      imageKey: String(i),
    })),
  };
}

/** First photo per card, in card order, through our image route. */
export function mapCardImages(raw: RawSearch, content: RawContent): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  raw.packages.forEach((p, i) => {
    const img = content.hotels[p.hotelKey]?.images?.[0];
    out[String(i)] = img ? imageUrl(img.url) : null;
  });
  return out;
}

// ---------- offer ----------

export type RoomChoice = {
  ref: string;
  room: string;
  board: string;
  refundable: boolean;
  freeCancellationUntil: string | null;
  delta: Price;
  selected: boolean;
  matchesFilters: boolean;
};
export type FlightChoice = {
  ref: string;
  airline: string;
  outbound: string;
  inbound: string;
  stops: number;
  bags: string;
  duration: string;
  delta: Price;
  selected: boolean;
  matchesFilters: boolean;
};
export type OfferView = {
  ref: string; // sealed: the current selection, for checkout
  hotel: ReturnType<typeof hotelBasics> & {
    description: string | null;
    address: string | null;
    images: { src: string; alt: string }[];
    nearby: { name: string; distance: string | null }[];
    airportKm: number | null;
  };
  trip: { depart: string; nights: number; adults: number; children: number; destination: string };
  selected: {
    room: string;
    board: string;
    refundable: boolean;
    freeCancellationUntil: string | null;
    flight: FlightView;
    bags: string;
    price: Price;
    perPerson: Price;
    payAtHotel: Price | null;
  };
  rooms: RoomChoice[];
  flights: FlightChoice[];
  flightsAvailable: number;
  testFlights: boolean;
};

export function mapOffer(raw: RawOffer, content: RawContent | null, ref: { q: SearchQuery; f: SearchFilters; h: string }): OfferView {
  const { q, f, h } = ref;
  const sel = raw.selected;
  const c = content?.hotels[h];
  const travellers = q.adults + q.childAges.length;
  const name = raw.hotel.name;
  const roomRef = (room: string) => tripRef(q, f, h, sel.flightToken, room);
  const flightRef = (flight: string) => tripRef(q, f, h, flight, sel.roomOptionId);
  // Deltas from the API are against the winning offer; show them against what is selected now.
  const selRoom = raw.roomOptions.find((r) => r.isSelected);
  const selFlight = raw.flightOptions.find((o) => o.isSelected);

  // One row per distinct room + board + cancellation, cheapest first (the API already sorts).
  const seen = new Set<string>();
  const rooms: RoomChoice[] = [];
  for (const r of raw.roomOptions) {
    if (!r.bookable) continue;
    const key = `${r.roomName}|${r.boardType ?? r.board.code}|${r.refundable}`;
    if (seen.has(key) && !r.isSelected) continue;
    seen.add(key);
    rooms.push({
      ref: roomRef(r.optionId),
      room: titleCase(r.roomName),
      board: boardLabel(r.boardType, r.board.name),
      refundable: r.refundable,
      freeCancellationUntil: r.freeCancellationUntil,
      delta: { amount: r.delta.amount - (selRoom?.delta.amount ?? 0), currency: r.delta.currency },
      selected: r.isSelected,
      matchesFilters: r.matchesFilters,
    });
  }

  return {
    ref: tripRef(q, f, h, sel.flightToken, sel.roomOptionId),
    hotel: {
      ...hotelBasics(raw.hotel),
      description: c?.description?.trim() || null,
      address: c?.address ? [c.address.line, c.address.city ? titleCase(c.address.city) : null].filter(Boolean).join(", ") : null,
      images: (c?.images ?? []).map((i, n) => ({ src: imageUrl(i.largeUrl ?? i.url), alt: `${name}, bild ${n + 1}` })),
      nearby: (c?.interestPoints ?? []).slice(0, 6).map((p) => ({ name: p.name, distance: p.distance })),
      airportKm: c?.terminals?.find((t) => raw.destination.airports.includes(t.code))?.distanceKm ?? null,
    },
    trip: {
      depart: q.depart,
      nights: q.nights,
      adults: q.adults,
      children: q.childAges.length,
      destination: raw.destination.nameSv || raw.destination.name,
    },
    selected: {
      room: titleCase(sel.roomName),
      board: boardLabel(sel.boardType, sel.board.name),
      refundable: sel.hotelRefundable,
      freeCancellationUntil: sel.freeCancellationUntil,
      flight: flightView(raw.flights[sel.flightToken]),
      bags: bagsLabel(sel.bagsIncluded),
      price: price(sel.price),
      perPerson: { amount: Math.round(sel.price.amount / travellers), currency: sel.price.currency },
      payAtHotel: sel.payAtHotelInMarketCurrency ? price(sel.payAtHotelInMarketCurrency) : null,
    },
    rooms,
    flights: raw.flightOptions.map((o) => ({
      ref: flightRef(o.flightToken),
      airline: airlineName(o.airline),
      outbound: o.outbound,
      inbound: o.return,
      stops: o.stops,
      bags: bagsLabel(o.bagsIncluded),
      duration: (o.duration ?? "").split(" + ").map(duration).join(" / "),
      delta: { amount: o.delta.amount - (selFlight?.delta.amount ?? 0), currency: o.delta.currency },
      selected: o.isSelected,
      matchesFilters: o.matchesFilters,
    })),
    flightsAvailable: raw.flightOptionsAvailable,
    testFlights: !raw.flightsLiveMode,
  };
}

// ---------- transfers (checkout upsell) ----------

export type TransferChoice = {
  id: string; // sealed API option id: sent back when the customer pays, never readable
  title: string;
  type: "shared" | "private" | "other";
  maxPax: number | null;
  luggage: number | null;
  minutes: number | null;
  price: Price;
  roundTrip: boolean;
  refundable: boolean;
  image: string | null;
  recommended: boolean;
};
export type TransferView = {
  airport: string;
  arrival: string; // local clock time
  reason: string;
  note: string | null;
  options: TransferChoice[];
};

const TYPE_SV: Record<string, string> = { Shared: "Delad transfer", Private: "Privat transfer" };
const VEHICLE_SV: Record<string, string> = { car: "bil", "hybrid car": "hybridbil", "electric car": "elbil", "adapted vehicle": "anpassat fordon", suv: "SUV", minibus: "minibuss", van: "minivan", bus: "buss", limousine: "limousin" };
const CATEGORY_SV: Record<string, string> = { premium: "premium", luxury: "lyx", vip: "VIP" };

function reasonSv(raw: RawTransfers): string {
  const rec = raw.recommended;
  if (!rec) return "Vi hittade ingen transfer som passar hela sällskapet.";
  const cheapestShared = raw.options.find((o) => o.type === "Shared");
  const cheapestPrivate = raw.options.find((o) => o.type === "Private");
  if (rec.type === "Private" && cheapestShared)
    return `Privat bil direkt till hotellet, bara ${Math.round(rec.price.amount - cheapestShared.price.amount)} kr mer än delad buss.`;
  if (rec.type === "Shared" && cheapestPrivate)
    return `Delad buss är billigast. Privat bil kostar ${Math.round(cheapestPrivate.price.amount - rec.price.amount)} kr mer.`;
  return "Det billigaste alternativet för er resa.";
}

export function mapTransfers(raw: RawTransfers): TransferView {
  const opts = raw.options.slice(0, 6);
  return {
    airport: raw.trip.arrivalAirport,
    arrival: clock(raw.trip.arrivalLocal),
    reason: reasonSv(raw),
    note: raw.trip.note ? "Transfer till hotellet vid ankomst. Hemresan går från en annan flygplats." : null,
    options: opts.map((o: RawTransferChoice) => ({
      id: sealStable("transfer.v1", o.optionId), // opened again by lib/server/checkout.ts openTransferId
      title: [
        TYPE_SV[o.type] ?? "Transfer",
        o.vehicle && o.vehicle.toLowerCase() !== "shuttle" ? (VEHICLE_SV[o.vehicle.toLowerCase()] ?? o.vehicle.toLowerCase()) : null,
        o.category && o.category !== "Standard" ? (CATEGORY_SV[o.category.toLowerCase()] ?? o.category.toLowerCase()) : null,
      ]
        .filter(Boolean)
        .join(", "),
      type: o.type === "Shared" ? "shared" : o.type === "Private" ? "private" : "other",
      maxPax: o.maxPax > 0 && o.maxPax < 99 ? o.maxPax : null,
      luggage: o.luggage,
      minutes: o.journeyMinutes,
      price: price(o.price),
      roundTrip: o.roundTrip,
      refundable: o.refundable,
      image: o.imageUrl ? imageUrl(o.imageUrl) : null,
      recommended: o.isRecommended,
    })),
  };
}
