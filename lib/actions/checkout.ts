"use server";

import { confirmCheckout, openCheckout, openTransferId, revalidateCheckout, startCheckout, type CheckoutOutcome } from "@/lib/server/checkout";

// Server actions for the checkout page. Inputs are sealed refs only; anything else is refused.
// Amounts never come from here: the API session holds them.

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

/** "Till betalning": check the price again (or start over if the transfer choice changed). */
export async function payAction(checkoutRef: string, transferToken: string | null): Promise<CheckoutOutcome> {
  const ref = openCheckout(checkoutRef);
  if (!ref) return expired();
  const transfer = openTransferId(transferToken);
  if (transferToken && !transfer) return expired();
  // No session yet (the first check failed) or another transfer chosen: a new check for this choice.
  if (!ref.id || transfer !== ref.tr) return startCheckout(ref.trip, ref.m, transfer);
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
  return startCheckout(ref.trip, ref.m, transferToken && !transfer ? null : transfer, true);
}
