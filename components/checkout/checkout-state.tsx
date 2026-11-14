"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Price } from "@/lib/format";

// Client state for the dummy checkout: which transfer (if any) is added. Prices here are the
// customer prices the server already computed; nothing is priced in the browser.

type Transfer = { id: string; title: string; price: Price } | null;
const Ctx = createContext<{ transfer: Transfer; setTransfer: (t: Transfer) => void } | null>(null);

export function CheckoutState({ children }: { children: ReactNode }) {
  const [transfer, setTransfer] = useState<Transfer>(null);
  return <Ctx.Provider value={{ transfer, setTransfer }}>{children}</Ctx.Provider>;
}

export function useCheckout() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCheckout outside CheckoutState");
  return v;
}
