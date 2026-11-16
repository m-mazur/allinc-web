"use server";

import {
  applyExtras,
  bookCheckout,
  cleanExtras,
  confirmCheckout,
  extrasKey,
  mapExtras,
  openCheckout,
  openTransferId,
  revalidateCheckout,
  startCheckout,
  type CheckoutOutcome,
  type ExtrasModel,
} from "@/lib/server/checkout";
import { api, type ExtraChoice } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { addDays } from "@/lib/format";
import { validateBooking, type BookingInput } from "@/lib/travellers";

// Server actions for the checkout page. Inputs are sealed refs (and, for pay, the traveller details).
// Amounts never come from here: the API session holds them.
// PERSONAL DATA: traveller details are validated and then dropped. Never log them, never put them in
// a URL, a sealed ref, an error message or a cache. They go to the API only when booking is built.

const expired = (): CheckoutOutcome => ({
  view: {
    status: "expired",
    title: "Tiden för priset har gått ut",
    message: "Gör om sökningen för att se aktuella priser.",
    total: null,
    previousTotal: null,
    expiresAt: null,
    secondsLeft: null,
    lines: [],
    soldOutHref: null,
    soldOutWhat: null,
    canPay: false,
  },
  ref: null,
});

/**
 * "Till betalning": check the traveller details, then the price (again, or anew if the transfer changed).
 * Changed bags or seats are set on the session first: the airline prices them live.
 * Invalid details return field errors and spend no supplier call.
 */
export async function payAction(checkoutRef: string, transferToken: string | null, extrasInput: ExtraChoice[], booking: BookingInput): Promise<CheckoutOutcome> {
  const ref = openCheckout(checkoutRef);
  if (!ref) return expired();
  const { q } = ref.trip;
  const errors = validateBooking(booking, {
    adults: q.adults,
    childAges: q.childAges,
    depart: q.depart,
    returnDate: addDays(q.depart, q.nights),
    passportRequired: ref.pp,
    country: ref.m,
  });
  if (Object.keys(errors).length) return { view: null, ref: null, errors };

  const transfer = openTransferId(transferToken);
  if (transferToken && !transfer) return expired();
  const extras = cleanExtras(extrasInput);
  if (!extras) return expired();

  // No session yet (the first check failed) or another transfer chosen: a new check for this choice.
  let current = ref;
  if (!ref.id || transfer !== ref.tr) {
    const started = await startCheckout(ref.trip, ref.m, ref.pp, transfer);
    const next = started.ref ? openCheckout(started.ref) : null;
    if (!next?.id || !(started.view?.status === "ok" || started.view?.status === "changed") || extrasKey(extras) === "") return started;
    current = next;
  }
  // Bags or seats changed: the airline prices the new choice live (the answer is the whole checkout).
  if (extrasKey(extras) !== extrasKey(current.ex)) {
    const set = await applyExtras(current, extras);
    const next = set.ref ? openCheckout(set.ref) : null;
    if (!next || set.view?.status !== "ok") return set;
    current = next;
  }
  return revalidateCheckout(current);
}

/**
 * The bags and seats the airline sells now for this checkout's flight (after a chosen one was gone).
 * null = none, or they could not be fetched; the page then keeps what it shows.
 */
export async function extrasAction(checkoutRef: string): Promise<ExtrasModel | null> {
  const ref = openCheckout(checkoutRef);
  if (!ref?.id) return null;
  try {
    const raw = await api.checkout.extras(ref.id);
    return mapExtras(raw, { adults: ref.trip.q.adults, childAges: ref.trip.q.childAges });
  } catch {
    return null;
  }
}

/** The customer accepts the changed total shown to them. */
export async function confirmAction(checkoutRef: string): Promise<CheckoutOutcome> {
  const ref = openCheckout(checkoutRef);
  return ref?.id ? confirmCheckout(ref) : expired();
}

/** "Kontrollera priset igen" after an expired or failed check: a new checkout for the same choice. */
export async function recheckAction(checkoutRef: string, transferToken: string | null): Promise<CheckoutOutcome> {
  const ref = openCheckout(checkoutRef);
  if (!ref) return expired();
  const transfer = openTransferId(transferToken);
  return startCheckout(ref.trip, ref.m, ref.pp, transferToken && !transfer ? null : transfer, true);
}

/**
 * TEST ONLY ("Boka testresa", no payment provider yet; on when ALLINC_TEST_BOOKINGS=1): check the
 * traveller details and the price exactly like payAction, and when the price is confirmed, book the
 * package on the suppliers' test systems. Failures are real (sold out, refused) and come back as such.
 */
export async function bookAction(checkoutRef: string, transferToken: string | null, extras: ExtraChoice[], booking: BookingInput): Promise<CheckoutOutcome> {
  if (!env.testBookings) return expired();
  const checked = await payAction(checkoutRef, transferToken, extras, booking);
  if (checked.errors || !checked.view || checked.view.status !== "ok" || !checked.ref) return checked;
  const ref = openCheckout(checked.ref);
  if (!ref?.id) return expired();
  return { ...checked, booking: await bookCheckout(ref, booking) };
}
