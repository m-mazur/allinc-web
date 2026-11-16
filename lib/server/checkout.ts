import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { api, ApiError, type BookingBody, type RawBooking, type RawCheckout, type SearchFilters, type SearchQuery } from "./api";
import { normalisePhone, tidyName, type BookingInput } from "../travellers";
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
type CheckoutRef = { id: string; trip: Trip; m: string; pp: boolean; tr: string | null; shown: number; t: number };
const CHECKOUT = "checkout.v1";
const MAX_AGE_MS = 2 * 3600_000;

export function sealCheckout(id: string, trip: Trip, market: string, passportRequired: boolean, transfer: string | null, shownTotal: number): string {
  return seal(CHECKOUT, { id, trip, m: market, pp: passportRequired, tr: transfer, shown: shownTotal, t: Date.now() } satisfies CheckoutRef);
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

export type CheckoutOutcome = { view: CheckoutView | null; ref: string | null; errors?: Record<string, string>; booking?: BookingResult };

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
    return outcome(raw, trip, market, passportRequired, transfer);
  } catch (e) {
    // A 404 here means no checkout route (an older API), not an expired session.
    return { view: problem(e instanceof ApiError && e.kind === "NotFound" ? "cannot" : e), ref: null };
  }
}

export async function revalidateCheckout(ref: CheckoutRef): Promise<CheckoutOutcome> {
  try {
    return outcome(await api.checkout.revalidate(ref.id), ref.trip, ref.m, ref.pp, ref.tr);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "NotFound") return { view: problem("expired"), ref: null };
    return { view: problem(e), ref: null };
  }
}

/** Accept a changed total: the total sent is the one we sealed when we showed it, never a browser value. */
export async function confirmCheckout(ref: CheckoutRef): Promise<CheckoutOutcome> {
  try {
    return outcome(await api.checkout.confirm(ref.id, ref.shown), ref.trip, ref.m, ref.pp, ref.tr);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "TotalMismatch") {
      // The price moved again since it was shown: show the session as it is now.
      try {
        return outcome(await api.checkout.get(ref.id), ref.trip, ref.m, ref.pp, ref.tr);
      } catch (e2) {
        return { view: problem(e2), ref: null };
      }
    }
    return { view: problem(e), ref: null };
  }
}

function outcome(raw: RawCheckout, trip: Trip, market: string, passportRequired: boolean, transfer: string | null): CheckoutOutcome {
  return { view: mapCheckout(raw, trip), ref: sealCheckout(raw.checkoutId, trip, market, passportRequired, transfer, raw.total.amount) };
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
  /** Where to go when something is sold out; null = stay (transfer). */
  soldOutHref: string | null;
  canPay: boolean;
};

const PRODUCT_SV = { Flight: "Flyg", Hotel: "Hotell", Transfer: "Transfer" } as const;
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
  const base = { total: { amount: raw.total.amount, currency: raw.total.currency }, previousTotal: null, expiresAt: raw.expiresAt, secondsLeft, lines, soldOutHref: null };
  switch (raw.status) {
    case "Ok":
      return {
        ...base,
        status: "ok",
        title: "Priset är bekräftat",
        message: raw.lines.some((l) => l.product === "Transfer") ? "Vi har kontrollerat flyg, hotell och transfer just nu." : "Vi har kontrollerat flyg och hotell just nu.",
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
      return { ...base, status: "soldout", title: "Slutsålt", message: SOLD_OUT_SV[what] ?? SOLD_OUT_SV.hotel, soldOutHref: soldOutHref(raw, trip), canPay: false };
    }
    case "Expired":
      return { ...problem("expired"), lines };
    default:
      return { ...problem("cannot"), lines };
  }
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
  const empty = { total: null, previousTotal: null, expiresAt: null, secondsLeft: null, lines: [], soldOutHref: null, canPay: false };
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
