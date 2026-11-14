"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Price } from "@/lib/format";

// Client state for checkout: the chosen transfer and the latest price check from the server.
// Prices here are customer prices the server worked out; nothing is priced in the browser, and the
// amount paid always comes from the API session.

export type ChosenTransfer = { id: string; title: string; price: Price } | null;

export type CheckoutViewClient = {
  status: "ok" | "changed" | "soldout" | "cannotconfirm" | "expired" | "busy";
  title: string;
  message: string;
  total: Price | null;
  previousTotal: Price | null;
  expiresAt: string | null;
  lines: { label: string; status: "ok" | "changed" | "soldout" | "unknown"; price: Price; previousPrice: Price | null; changes: string[] }[];
  soldOutHref: string | null;
  canPay: boolean;
};

/** A price check plus the sealed ref to continue it, and which transfer (sealed id) it covers. */
export type Session = { view: CheckoutViewClient; ref: string; transferId: string | null };

type Ctx = {
  transfer: ChosenTransfer;
  setTransfer: (t: ChosenTransfer) => void;
  session: Session | null;
  setSession: (s: Session) => void;
  /** true until the first check has come back */
  checking: boolean;
};
const C = createContext<Ctx | null>(null);

export function CheckoutState({ children }: { children: ReactNode }) {
  const [transfer, setTransfer] = useState<ChosenTransfer>(null);
  const [session, setSessionState] = useState<Session | null>(null);
  return (
    <C.Provider value={{ transfer, setTransfer, session, setSession: setSessionState, checking: session === null }}>{children}</C.Provider>
  );
}

export function useCheckout() {
  const v = useContext(C);
  if (!v) throw new Error("useCheckout outside CheckoutState");
  return v;
}
