"use client";

import { useEffect } from "react";
import { useCheckout, type ChosenTransfer, type Session } from "./checkout-state";

/** Hands the first price check (rendered on the server) and the transfer it covers to the client state. */
export function SessionInit({ session, transfer }: { session: Session; transfer: ChosenTransfer }) {
  const { setSession, setTransfer } = useCheckout();
  useEffect(() => {
    setSession(session);
    setTransfer(transfer);
  }, [session.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
