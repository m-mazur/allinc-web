"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Price } from "@/lib/format";
import type { BookingInput, Errors } from "@/lib/travellers";

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
  secondsLeft: number | null;
  lines: { label: string; status: "ok" | "changed" | "soldout" | "unknown"; price: Price; previousPrice: Price | null; changes: string[] }[];
  soldOutHref: string | null;
  canPay: boolean;
};

/** The outcome of a test booking ("Boka testresa"). */
export type BookingResultClient = {
  status: "confirmed" | "failed" | "attention" | "pending";
  title: string;
  message: string;
  reference: string | null;
  lines: { label: string; status: string }[];
  isTest: boolean;
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
  /** Traveller details: kept in memory only (no storage, no URL) and sent with "Till betalning". */
  booking: BookingInput;
  setBooking: (b: BookingInput) => void;
  errors: Errors;
  setErrors: (e: Errors) => void;
};
const C = createContext<Ctx | null>(null);

const blankTraveller = { gender: "" as const, givenName: "", familyName: "", bornOn: "", passportNumber: "", passportCountry: "SE", passportExpires: "" };

export function CheckoutState({ travellers, children }: { travellers: number; children: ReactNode }) {
  const [transfer, setTransfer] = useState<ChosenTransfer>(null);
  const [session, setSessionState] = useState<Session | null>(null);
  const [booking, setBooking] = useState<BookingInput>(() => ({
    travellers: Array.from({ length: travellers }, () => ({ ...blankTraveller })),
    email: "",
    phone: "",
    remark: "",
  }));
  const [errors, setErrors] = useState<Errors>({});
  return (
    <C.Provider value={{ transfer, setTransfer, session, setSession: setSessionState, checking: session === null, booking, setBooking, errors, setErrors }}>
      {children}
    </C.Provider>
  );
}

export function useCheckout() {
  const v = useContext(C);
  if (!v) throw new Error("useCheckout outside CheckoutState");
  return v;
}
