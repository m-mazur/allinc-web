import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { api, ApiError, type BookingBody, type ExtraChoice, type RawBooking, type RawCheckout, type RawExtras, type SearchFilters, type SearchQuery } from "./api";
import { normalisePhone, tidyName, travellerLabel, type BookingInput } from "../travellers";
import { seal, sealStable, unseal, unsealStable } from "./seal";
import { toParams } from "./search-params";
import { tripRef } from "./view";
import type { Price } from "../format";

// Checkout: the web's side of the API's live price check (../allinc/backend/docs/CHECKOUT-VALIDATION.md).
// The browser holds only a sealed checkout ref; amounts always come from the API session, never from
// the browser. Swedish copy for every outcome lives here so pages stay dumb.

// ---------- sealed refs ----------

type Trip = { q: SearchQuery; f: SearchFilters; h: string; fl?: string; r?: string };
/** What the browser carries through checkout: the API's checkout id, the trip, the transfer in it, the total last shown. */
/** pp: the flight needs passport details (decides which traveller fields are required). */
/** ex: the extra bags and seats the API session holds (its Extras line), as the API's own opaque ids. */
type CheckoutRef = { id: string; trip: Trip; m: string; pp: boolean; tr: string | null; ex: ExtraChoice[]; shown: number; t: number };
const CHECKOUT = "checkout.v2";
const MAX_AGE_MS = 2 * 3600_000;

export function sealCheckout(id: string, trip: Trip, market: string, passportRequired: boolean, transfer: string | null, shownTotal: number, extras: ExtraChoice[] = []): string {
  return seal(CHECKOUT, { id, trip, m: market, pp: passportRequired, tr: transfer, ex: extras, shown: shownTotal, t: Date.now() } satisfies CheckoutRef);
}

import { extrasKey } from "../extras";
export { extrasKey };

/** What the browser may send as extras: our API's ids (short, opaque), whole quantities 1-9, at most 40. */
export function cleanExtras(input: unknown): ExtraChoice[] | null {
  if (!Array.isArray(input) || input.length > 40) return null;
  const out: ExtraChoice[] = [];
  for (const c of input) {
    if (!c || typeof c.id !== "string" || !/^x[A-Za-z0-9_-]{1,39}$/.test(c.id) || !Number.isInteger(c.quantity) || c.quantity < 1 || c.quantity > 9) return null;
    out.push({ id: c.id, quantity: c.quantity });
  }
  return out;
}

export function openCheckout(token: string): CheckoutRef | null {
  const ref = unseal<CheckoutRef>(CHECKOUT, token);
  return ref && Date.now() - ref.t < MAX_AGE_MS ? ref : null;
}

/** Transfer option ids travel sealed too (stable, so a radio's value does not change between renders). */
export const sealTransferId = (optionId: string) => sealStable("transfer.v1", optionId);
export const openTransferId = (token: string | null) => (token ? unsealStable("transfer.v1", token) : null);

// ---------- quota protection ----------

// Every new checkout spends supplier calls (in test, Hotelbeds keeps ~10 a day for checkouts), so new
// checks are limited: 6 an hour per visitor IP, and 120 an hour in total as a backstop. The IP comes
// from X-Forwarded-For / X-Real-IP, so production needs a proxy in front that sets them; without one
// only the total limit applies. Reloading the page reuses the API session and is not counted by the API.
const PER_IP = 6;
const TOTAL = 120;
const BUCKET = new Map<string, number[]>();
function take(key: string, limit: number, now: number): boolean {
  const recent = (BUCKET.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= limit) return false;
  recent.push(now);
  BUCKET.set(key, recent);
  return true;
}
async function allowNewCheck(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  const now = Date.now();
  if (BUCKET.size > 10_000) BUCKET.clear();
  if (ip && !take(`ip:${ip}`, PER_IP, now)) return false;
  return take("all", TOTAL, now);
}

// ---------- calls ----------

const idempotencyKey = (trip: Trip, transfer: string | null, attempt: string) =>
  createHash("sha256").update(JSON.stringify([trip.q, trip.f, trip.h, trip.fl ?? null, trip.r ?? null, transfer, attempt])).digest("base64url");

/** extrasKey: which bags and seats the returned ref's session holds (see lib/extras.ts). */
export type CheckoutOutcome = { view: CheckoutView | null; ref: string | null; extrasKey?: string; errors?: Record<string, string>; booking?: BookingResult };

/**
 * Start (or rejoin) a checkout for this trip and transfer. The same trip + transfer in the same hour
 * reuses the API's live session, so reloading the page spends no supplier call.
 */
export type { CheckoutRef };

export async function startCheckout(trip: Trip, market: string, passportRequired: boolean, transfer: string | null, fresh = false): Promise<CheckoutOutcome> {
  const attempt = fresh ? String(Date.now()) : new Date().toISOString().slice(0, 13);
  if (!(await allowNewCheck())) return { view: problem("busy"), ref: null };
  try {
    const raw = await api.checkout.start({ q: trip.q, f: trip.f, market, hotel: trip.h, flight: trip.fl, room: trip.r, transfer }, idempotencyKey(trip, transfer, attempt));
    return outcome(raw, trip, market, passportRequired, transfer, []);
  } catch (e) {
    // A 404 here means no checkout route (an older API), not an expired session.
    return { view: problem(e instanceof ApiError && e.kind === "NotFound" ? "cannot" : e), ref: null };
  }
}

export async function revalidateCheckout(ref: CheckoutRef): Promise<CheckoutOutcome> {
  try {
    return outcome(await api.checkout.revalidate(ref.id), ref.trip, ref.m, ref.pp, ref.tr, ref.ex);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "NotFound") return { view: problem("expired"), ref: null };
    return { view: problem(e), ref: null };
  }
}

/** Accept a changed total: the total sent is the one we sealed when we showed it, never a browser value. */
export async function confirmCheckout(ref: CheckoutRef): Promise<CheckoutOutcome> {
  try {
    return outcome(await api.checkout.confirm(ref.id, ref.shown), ref.trip, ref.m, ref.pp, ref.tr, ref.ex);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "TotalMismatch") {
      // The price moved again since it was shown: show the session as it is now.
      try {
        return outcome(await api.checkout.get(ref.id), ref.trip, ref.m, ref.pp, ref.tr, ref.ex);
      } catch (e2) {
        return { view: problem(e2), ref: null };
      }
    }
    return { view: problem(e), ref: null };
  }
}

function outcome(raw: RawCheckout, trip: Trip, market: string, passportRequired: boolean, transfer: string | null, extras: ExtraChoice[]): CheckoutOutcome {
  return { view: mapCheckout(raw, trip), ref: sealCheckout(raw.checkoutId, trip, market, passportRequired, transfer, raw.total.amount, extras), extrasKey: extrasKey(extras) };
}

/**
 * Sets the session's extra bags and seats; the API prices them live with the airline. Reads the extras first,
 * so a session that has never shown them (a new check after a transfer change) knows the ids.
 */
export async function applyExtras(ref: CheckoutRef, choice: ExtraChoice[]): Promise<CheckoutOutcome> {
  try {
    await api.checkout.extras(ref.id);
    return outcome(await api.checkout.setExtras(ref.id, choice), ref.trip, ref.m, ref.pp, ref.tr, choice);
  } catch (e) {
    const kind = e instanceof ApiError ? e.kind : "Unavailable";
    if (kind === "ExtrasUnavailable" || kind === "BadExtras") {
      // Something chosen is no longer sold (or no longer fits): the session is as it was; ask the customer to choose again.
      try {
        const now = outcome(await api.checkout.get(ref.id), ref.trip, ref.m, ref.pp, ref.tr, ref.ex);
        // extrasKey = the attempted choice, so the page shows this answer for it (not "you changed your choice").
        return { ...now, extrasKey: extrasKey(choice), view: { ...now.view!, status: "soldout", title: "Ett tillval finns inte längre", message: SOLD_OUT_SV.extras, soldOutWhat: "extras", soldOutHref: null, canPay: false } };
      } catch (e2) {
        return { view: problem(e2), ref: null };
      }
    }
    if (kind === "NotPossible" || kind === "NotFound") return { view: problem("expired"), ref: null };
    return { view: problem(kind === "TooManyChecks" ? "busy" : e), ref: null };
  }
}

// ---------- extras: public view ----------

export type ExtrasSeat = { designator: string; note: boolean; prices: { id: string; traveller: number; price: Price }[] };
export type ExtrasCell = { kind: "seat"; seat: ExtrasSeat } | { kind: "space" } | { kind: "exit" } | { kind: "facility" };
export type ExtrasModel = {
  available: boolean;
  currency: string;
  travellers: { index: number; label: string; seat: boolean }[];
  bags: { id: string; traveller: number; title: string; journey: string; max: number; price: Price }[];
  flights: { key: string; label: string; route: string; rows: { label: string; exit: boolean; sections: ExtrasCell[][] }[] }[];
};

const JOURNEY_SV = ["Utresa", "Hemresa"];

/** Hand-picked fields only. Ids are the API's opaque ids (hashes, no supplier data) and are safe to hand to the browser. */
export function mapExtras(raw: RawExtras, party: { adults: number; childAges: number[] }): ExtrasModel {
  const travellers = raw.passengers.map((p) => ({ index: p.index, label: travellerLabel(p.index, party), seat: p.seat }));
  const route = (i: number) => {
    const j = raw.journeys[i];
    return j ? `${j.origin}–${j.destination}` : "";
  };
  const bags = raw.bags.map((b) => ({
    id: b.id,
    traveller: b.passenger,
    title: `${b.kind === "carry_on" ? "Extra handbagage" : "Incheckad väska"}${b.maxWeightKg ? ` ${b.maxWeightKg} kg` : ""}`,
    journey: b.journeys.length > 1 ? "Tur och retur" : `${JOURNEY_SV[b.journeys[0]] ?? "Resa"} ${route(b.journeys[0])}`,
    max: b.maxQuantity,
    price: { amount: b.price.amount, currency: b.price.currency },
  }));
  const flights = raw.seatMaps
    .filter((m) => m.cabins.some((c) => c.rows.some((r) => r.some((sec) => sec.some((e) => e.prices.length > 0)))))
    .map((m) => ({
      key: `${m.flightNumber}@${m.departsLocal}`,
      label: `${JOURNEY_SV[m.journey] ?? "Flyg"} · ${m.flightNumber}`,
      route: `${m.origin}–${m.destination}`,
      rows: m.cabins.flatMap((c) =>
        c.rows.map((r) => {
          const seats = r.flat().filter((e) => e.type === "seat" && e.designator);
          const exit = r.flat().some((e) => e.type === "exit_row");
          return {
            label: seats[0]?.designator?.replace(/[A-Z]+$/, "") ?? "",
            exit: exit && seats.length === 0,
            sections: r.map((sec) =>
              sec.map((e): ExtrasCell =>
                e.type === "seat" && e.designator
                  ? { kind: "seat", seat: { designator: e.designator, note: e.disclosures.length > 0, prices: e.prices.map((p) => ({ id: p.id, traveller: p.passenger, price: { amount: p.price.amount, currency: p.price.currency } })) } }
                  : e.type === "exit_row" ? { kind: "exit" }
                  : e.type === "empty" ? { kind: "space" }
                  : { kind: "facility" },
              ),
            ),
          };
        }),
      ),
    }));
  return { available: raw.available && (bags.length > 0 || flights.length > 0), currency: raw.currency, travellers, bags, flights };
}

// ---------- public view ----------

export type CheckoutLine = { label: string; status: "ok" | "changed" | "soldout" | "unknown"; price: Price; previousPrice: Price | null; changes: string[] };
export type CheckoutView = {
  status: "ok" | "changed" | "soldout" | "cannotconfirm" | "expired" | "busy";
  title: string;
  message: string;
  total: Price | null;
  previousTotal: Price | null;
  expiresAt: string | null;
  /** Seconds the price is held from now, worked out on the server (so a wrong client clock can't skew it). */
  secondsLeft: number | null;
  lines: CheckoutLine[];
  /** Where to go when something is sold out; null = stay (transfer, extras). */
  soldOutHref: string | null;
  /** What is sold out: flight, room, hotel, transfer or extras. */
  soldOutWhat: string | null;
  canPay: boolean;
};

const PRODUCT_SV = { Flight: "Flyg", Hotel: "Hotell", Transfer: "Transfer", Extras: "Bagage och platser" } as const;
const CHANGE_SV: Record<string, string> = {
  Price: "Priset",
  FlightSchedule: "Flygtiderna",
  Baggage: "Bagaget",
  FlightRefund: "Flygets återbetalningsvillkor",
  HotelCancellation: "Hotellets avbokningsvillkor",
  Board: "Måltiderna",
  PayAtHotel: "Avgiften som betalas på hotellet",
  TransferCancellation: "Transferns avbokningsvillkor",
};
const LINE_STATUS = { Confirmed: "ok", Changed: "changed", SoldOut: "soldout", CannotConfirm: "unknown" } as const;

const SOLD_OUT_SV: Record<string, string> = {
  flight: "Flyget är slutsålt. Välj ett annat flyg till samma hotell.",
  room: "Rummet är slutsålt. Välj ett annat rum på samma hotell.",
  hotel: "Hotellet är slutsålt för dina datum. Här är andra hotell för samma resa.",
  transfer: "Transfern är slutsåld. Välj en annan transfer eller fortsätt utan.",
  extras: "En vald väska eller sittplats finns inte längre hos flygbolaget. Välj igen eller fortsätt utan.",
};

export function mapCheckout(raw: RawCheckout, trip: Trip): CheckoutView {
  const lines = raw.lines.map((l) => ({
    label: PRODUCT_SV[l.product] ?? l.product,
    status: LINE_STATUS[l.status] ?? "unknown",
    price: { amount: l.price.amount, currency: l.price.currency },
    previousPrice: l.previousPrice ? { amount: l.previousPrice.amount, currency: l.previousPrice.currency } : null,
    changes: l.changes.map((c) => CHANGE_SV[c] ?? "Villkoren"),
  }));
  const secondsLeft = Math.max(0, Math.round((Date.parse(raw.expiresAt) - Date.now()) / 1000));
  const base = { total: { amount: raw.total.amount, currency: raw.total.currency }, previousTotal: null, expiresAt: raw.expiresAt, secondsLeft, lines, soldOutHref: null, soldOutWhat: null };
  switch (raw.status) {
    case "Ok":
      return {
        ...base,
        status: "ok",
        title: "Priset är bekräftat",
        message: `Vi har kontrollerat ${checkedParts(raw)} just nu.`,
        canPay: true,
      };
    case "Changed":
      return {
        ...base,
        status: "changed",
        previousTotal: raw.previousTotal ? { amount: raw.previousTotal.amount, currency: raw.previousTotal.currency } : null,
        title: "Priset har ändrats sedan du sökte",
        message: "Godkänn det nya priset för att gå vidare, eller gå tillbaka och välj något annat.",
        canPay: false,
      };
    case "SoldOut": {
      const what = raw.soldOut?.what ?? "hotel";
      return { ...base, status: "soldout", title: "Slutsålt", message: SOLD_OUT_SV[what] ?? SOLD_OUT_SV.hotel, soldOutHref: soldOutHref(raw, trip), soldOutWhat: what, canPay: false };
    }
    case "Expired":
      return { ...problem("expired"), lines };
    default:
      return { ...problem("cannot"), lines };
  }
}

/** "flyg och hotell", "flyg, hotell och transfer", "flyg, hotell, transfer och dina tillval". */
function checkedParts(raw: RawCheckout): string {
  const parts = ["flyg", "hotell"];
  if (raw.lines.some((l) => l.product === "Transfer")) parts.push("transfer");
  if (raw.lines.some((l) => l.product === "Extras")) parts.push("dina tillval");
  return parts.length > 2 ? `${parts.slice(0, -1).join(", ")} och ${parts.at(-1)}` : parts.join(" och ");
}

function soldOutHref(raw: RawCheckout, trip: Trip): string | null {
  const so = raw.soldOut;
  if (!so || so.redirect === "checkout") return null;
  if (so.redirect === "results" || so.what === "hotel") return `/sok?${toParams(trip.q, trip.f, { slutsalt: "hotell" })}`;
  // Same hotel's offer page, without the part that is gone (the API has dropped it from its cache).
  const ref = so.what === "flight" ? tripRef(trip.q, trip.f, trip.h, undefined, trip.r) : tripRef(trip.q, trip.f, trip.h, trip.fl, undefined);
  return `/resa/${ref}?slutsalt=${so.what === "flight" ? "flyg" : "rum"}`;
}

const EXPIRED_MESSAGE = "Vi håller ett pris i högst 20 minuter. Kontrollera priset igen för att fortsätta.";

function problem(e: unknown): CheckoutView {
  const empty = { total: null, previousTotal: null, expiresAt: null, secondsLeft: null, lines: [], soldOutHref: null, soldOutWhat: null, canPay: false };
  if (e === "expired" || (e instanceof ApiError && e.kind === "NotFound"))
    return { ...empty, status: "expired", title: "Tiden för priset har gått ut", message: EXPIRED_MESSAGE };
  if (e === "busy" || (e instanceof ApiError && e.kind === "TooManyChecks"))
    return { ...empty, status: "busy", title: "För många kontroller", message: "Vänta en stund och försök igen, eller gör en ny sökning." };
  return { ...empty, status: "cannotconfirm", title: "Vi kan inte bekräfta priset just nu", message: "Försök igen om en liten stund. Inget har bokats eller dragits." };
}

// ---------- test booking (no payment provider yet) ----------

export type BookingResult = {
  status: "confirmed" | "failed" | "attention" | "pending";
  title: string;
  message: string;
  reference: string | null;
  lines: { label: string; status: string }[];
  isTest: boolean;
};

const LINE_SV: Record<string, string> = { Confirmed: "Bokat", Failed: "Gick inte", Undone: "Avbokat igen", Unknown: "Kontrolleras" };

/** Traveller details as the API takes them. Names tidied, phone in E.164. Nothing here is logged. */
function bookingBody(input: BookingInput, adults: number, passportRequired: boolean, country: string): BookingBody {
  const lead = input.travellers[0];
  return {
    lead: { firstName: tidyName(lead.givenName), lastName: tidyName(lead.familyName), email: input.email.trim(), phone: normalisePhone(input.phone, country), language: "sv" },
    travellers: input.travellers.map((t, i) => ({
      firstName: tidyName(t.givenName),
      lastName: tidyName(t.familyName),
      birthDate: t.bornOn,
      gender: t.gender as "m" | "f",
      type: i < adults ? "Adult" : "Child",
      passport: passportRequired
        ? { number: (t.passportNumber ?? "").replace(/\s/g, "").toUpperCase(), issuingCountry: (t.passportCountry ?? "").toUpperCase(), expiresOn: t.passportExpires ?? "" }
        : null,
    })),
    remark: (input.remark ?? "").trim().slice(0, 500),
  };
}

/** Book a checkout whose price check is Ok. Only called after validateBooking passed. */
export async function bookCheckout(ref: CheckoutRef, input: BookingInput): Promise<BookingResult> {
  // The API books once per checkout id (a retry returns the same booking); the key is sent anyway.
  const key = createHash("sha256").update(`${ref.id}|book`).digest("base64url");
  const fail = (title: string, message: string): BookingResult => ({ status: "failed", title, message, reference: null, lines: [], isTest: true });
  try {
    return mapBooking(await api.checkout.book(ref.id, bookingBody(input, ref.trip.q.adults, ref.pp, ref.m), key));
  } catch (e) {
    const kind = e instanceof ApiError ? e.kind : "Unavailable";
    if (kind === "NotBookable" || kind === "NotFound") return fail("Priset behöver kontrolleras igen", "Kontrollera priset igen och boka sedan. Inget är bokat.");
    if (kind === "InvalidTravellers") return fail("Resenärsuppgifterna godtogs inte", "Kontrollera namn, födelsedatum och kontaktuppgifter. Inget är bokat.");
    if (kind === "BookingDisabled") return fail("Testbokning är avstängd", "Bokning från webben är inte påslagen just nu. Inget är bokat.");
    return fail("Bokningen gick inte att starta", "Försök igen om en liten stund. Inget är bokat och inget har dragits.");
  }
}

const LINE_SV_ALL: Record<string, string> = { ...LINE_SV, Pending: "Pågår", Cancelled: "Avbokat" };

// Swedish copy per API messageCode (the API's customerMessage is English staff text and never shown).
const BOOKING_SV: Record<RawBooking["messageCode"], { status: BookingResult["status"]; title: string; message: string }> = {
  Confirmed: { status: "confirmed", title: "Bokningen är klar", message: "Flyg, hotell och eventuell transfer är bokade." },
  ConfirmedWithoutTransfer: {
    status: "attention",
    title: "Bokningen är klar, utan transfer",
    message: "Flyg och hotell är bokade, men transfern gick inte att boka. Du betalar inte för den. Vi hör av oss om en annan transfer.",
  },
  ConfirmedTicketsFollow: { status: "confirmed", title: "Bokningen är klar", message: "Flyg och hotell är bokade. Biljetterna utfärdas och skickas separat." },
  BeingConfirmed: { status: "attention", title: "Bokningen bekräftas", message: "En del av resan kunde inte bekräftas direkt. Vi kontrollerar den och hör av oss." },
  InProgress: { status: "pending", title: "Bokningen pågår", message: "Vi bekräftar med flygbolag och hotell. Det kan ta en liten stund." },
  NotBookedSoldOut: { status: "failed", title: "Bokningen gick inte igenom", message: "Något i resan tog slut medan vi bokade. Inget är bokat och inget har dragits." },
  NotBookedPriceChanged: { status: "failed", title: "Bokningen gick inte igenom", message: "Priset ändrades medan vi bokade. Inget är bokat och inget har dragits." },
  NotBooked: { status: "failed", title: "Bokningen gick inte igenom", message: "Inget är bokat och inget har dragits." },
  Cancelled: { status: "failed", title: "Bokningen är avbokad", message: "Den här bokningen är avbokad." },
};

function mapBooking(raw: RawBooking): BookingResult {
  const copy = BOOKING_SV[raw.messageCode] ?? BOOKING_SV.NotBooked;
  const testNote = raw.isTest && copy.status !== "failed" ? " Testbokning i leverantörernas testsystem: ingen betalning har gjorts." : "";
  return {
    status: copy.status,
    title: copy.title,
    message: copy.message + testNote,
    reference: raw.reference,
    lines: raw.lines.map((l) => ({ label: PRODUCT_SV[l.product] ?? l.product, status: LINE_SV_ALL[l.status] ?? l.status })),
    isTest: raw.isTest,
  };
}
