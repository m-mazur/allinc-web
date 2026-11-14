"use server";

import { confirmCheckout, openCheckout, openTransferId, revalidateCheckout, startCheckout, type CheckoutOutcome } from "@/lib/server/checkout";
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
    lines: [],
    soldOutHref: null,
    canPay: false,
  },
  ref: null,
});

/**
 * "Till betalning": check the traveller details, then the price (again, or anew if the transfer changed).
 * Invalid details return field errors and spend no supplier call.
 */
export async function payAction(checkoutRef: string, transferToken: string | null, booking: BookingInput): Promise<CheckoutOutcome> {
  const ref = openCheckout(checkoutRef);
  if (!ref) return expired();
  const { q } = ref.trip;
  const errors = validateBooking(booking, {
    adults: q.adults,
    childAges: q.childAges,
    depart: q.depart,
    returnDate: addDays(q.depart, q.nights),
    passportRequired: ref.pp,
  });
  if (Object.keys(errors).length) return { view: null, ref: null, errors };

  const transfer = openTransferId(transferToken);
  if (transferToken && !transfer) return expired();
  // No session yet (the first check failed) or another transfer chosen: a new check for this choice.
  if (!ref.id || transfer !== ref.tr) return startCheckout(ref.trip, ref.m, ref.pp, transfer);
  return revalidateCheckout(ref);
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
