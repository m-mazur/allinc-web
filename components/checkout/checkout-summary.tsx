"use client";

import { useState } from "react";
import { money, type Price } from "@/lib/format";
import { useCheckout } from "./checkout-state";

export function CheckoutTotal({ base, travellers }: { base: Price; travellers: number }) {
  const { transfer } = useCheckout();
  const total = { amount: base.amount + (transfer?.price.amount ?? 0), currency: base.currency };
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted">Flyg och hotell</span>
        <span className="tabular-nums">{money(base)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Transfer</span>
        <span className="tabular-nums">{transfer ? money(transfer.price) : "Ingen"}</span>
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-semibold">Att betala</span>
        <span className="text-3xl font-bold tabular-nums" aria-live="polite">
          {money(total)}
        </span>
      </div>
      <p className="text-right text-muted">{money({ amount: Math.round(total.amount / travellers), currency: total.currency })} per person</p>
    </div>
  );
}

export function PayButton() {
  const [clicked, setClicked] = useState(false);
  return (
    <div>
      <button
        type="submit"
        onClick={(e) => {
          e.preventDefault();
          setClicked(true);
        }}
        className="inline-flex h-[52px] w-full items-center justify-center rounded-control bg-primary px-7 font-bold text-on-primary hover:bg-primary-hover"
      >
        Till betalning
      </button>
      {clicked && (
        <p role="status" className="mt-3 rounded-control bg-primary-soft p-3 text-sm text-primary">
          Det här är en förhandsversion. Ingen betalning eller bokning görs.
        </p>
      )}
    </div>
  );
}
