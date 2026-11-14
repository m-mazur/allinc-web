"use client";

import { Bus, CarFront, Check, Clock, Luggage, Users } from "lucide-react";
import { useEffect } from "react";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCheckout } from "./checkout-state";

type Option = {
  id: string;
  title: string;
  type: "shared" | "private" | "other";
  maxPax: number | null;
  luggage: number | null;
  minutes: number | null;
  price: { amount: number; currency: string };
  roundTrip: boolean;
  refundable: boolean;
  image: string | null;
  recommended: boolean;
};

export function TransferPicker({ options, reason, airport, arrival, note }: { options: Option[]; reason: string; airport: string; arrival: string; note: string | null }) {
  const { transfer, setTransfer } = useCheckout();
  const rec = options.find((o) => o.recommended) ?? null;

  // The suggestion starts selected: one click to remove it, nothing to find.
  useEffect(() => {
    if (rec) setTransfer({ id: rec.id, title: rec.title, price: rec.price });
    return () => setTransfer(null);
  }, [rec?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (o: Option | null) => setTransfer(o ? { id: o.id, title: o.title, price: o.price } : null);

  return (
    <div>
      <p className="text-sm text-muted">
        Ni landar på {airport} kl {arrival}. {reason}
      </p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Transfer">
        {options.map((o) => {
          const on = transfer?.id === o.id;
          const Icon = o.type === "private" ? CarFront : Bus;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(o)}
              className={cn(
                "flex items-center gap-4 rounded-card border bg-surface p-3 text-left transition-colors",
                on ? "border-primary ring-2 ring-primary/25" : "border-line hover:border-primary/50",
              )}
            >
              <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-control bg-canvas text-muted">
                {o.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image} alt="" className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <Icon className="size-6" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {o.title}
                  {o.recommended && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-on-accent">Vårt förslag</span>}
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  {o.minutes && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden /> ca {o.minutes} min
                    </span>
                  )}
                  {o.maxPax && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden /> upp till {o.maxPax}
                    </span>
                  )}
                  {o.luggage != null && (
                    <span className="inline-flex items-center gap-1">
                      <Luggage className="size-3.5" aria-hidden /> {o.luggage} väskor per person
                    </span>
                  )}
                  <span>{o.roundTrip ? "Tur och retur" : "Enkel resa"}</span>
                  {o.refundable && <span>Fri avbokning</span>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold tabular-nums">{money(o.price)}</span>
                {on && <Check className="ml-auto mt-1 size-4 text-primary" aria-hidden />}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={transfer === null}
          onClick={() => choose(null)}
          className={cn(
            "rounded-card border bg-surface p-3 text-left text-sm font-medium",
            transfer === null ? "border-primary ring-2 ring-primary/25" : "border-line hover:border-primary/50",
          )}
        >
          Ingen transfer, vi tar oss till hotellet själva
        </button>
      </div>
    </div>
  );
}
