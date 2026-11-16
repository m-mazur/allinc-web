"use client";

import { useEffect, useMemo, useState } from "react";
import { Armchair, ChevronDown, Luggage, Minus, Plus } from "lucide-react";
import { extrasAction } from "@/lib/actions/checkout";
import { money, type Price } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ExtrasModel } from "@/lib/server/checkout";
import { useCheckout, type ChosenExtra } from "./checkout-state";

// Extra bags and paid seats from the airline (shown only when it sells any). Prices are the server's customer
// prices per unit; the choice is priced live with the airline at "Till betalning", and from then on the amounts
// shown come from that check. Nothing is priced here.

type Seat = { flight: string; designator: string; traveller: number; price: Price };

export function ExtrasPicker({ extras: initial }: { extras: ExtrasModel }) {
  const { extras: picked, setExtras, session } = useCheckout();
  const [model, setModel] = useState(initial);
  const [dropped, setDropped] = useState<string[]>([]);

  // A chosen bag or seat was gone at the check: reload what the airline sells now and drop what is gone.
  const goneRef = session?.view.status === "soldout" && session.view.soldOutWhat === "extras" ? session.ref : null;
  useEffect(() => {
    if (!goneRef) return;
    let live = true;
    extrasAction(goneRef).then((m) => {
      if (!live || !m) return;
      setModel(m);
      const ids = new Set([...m.bags.map((b) => b.id), ...m.flights.flatMap((f) => f.rows.flatMap((r) => r.sections.flat().flatMap((c) => (c.kind === "seat" ? c.seat.prices.map((p) => p.id) : []))))]);
      setExtras(picked.filter((p) => ids.has(p.id)));
      setDropped(picked.filter((p) => !ids.has(p.id)).map((p) => p.label));
    });
    return () => {
      live = false;
    };
  }, [goneRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const seats = useMemo(() => {
    const m = new Map<string, Seat>();
    for (const f of model.flights)
      for (const r of f.rows)
        for (const c of r.sections.flat())
          if (c.kind === "seat") for (const p of c.seat.prices) m.set(p.id, { flight: f.key, designator: c.seat.designator, traveller: p.traveller, price: p.price });
    return m;
  }, [model]);

  const qty = (id: string) => picked.find((p) => p.id === id)?.quantity ?? 0;
  const set = (id: string, quantity: number, price: Price, label: string) =>
    setExtras([...picked.filter((p) => p.id !== id), ...(quantity > 0 ? [{ id, quantity, price, label } satisfies ChosenExtra] : [])]);

  const travellerLabel = (i: number) => model.travellers.find((t) => t.index === i)?.label ?? `Resenär ${i + 1}`;
  const bagTravellers = model.travellers.filter((t) => model.bags.some((b) => b.traveller === t.index));

  return (
    <div className="space-y-6">
      {dropped.length > 0 && (
        <p className="rounded-control bg-panel px-3 py-2 text-sm" role="status">
          Flygbolaget säljer inte längre: {dropped.join(", ")}. Vi har tagit bort {dropped.length === 1 ? "det" : "dem"} från ditt val. Välj något annat eller fortsätt utan.
        </p>
      )}
      {bagTravellers.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Luggage className="size-5 text-primary" aria-hidden /> Extra bagage
          </h3>
          <p className="mt-1 text-sm text-muted">Pris per väska. Det som redan ingår i biljetten står under flyget.</p>
          <div className="mt-3 space-y-4">
            {bagTravellers.map((t) => (
              <div key={t.index}>
                <p className="text-sm font-semibold">{t.label}</p>
                <ul className="mt-1 divide-y divide-line rounded-card border border-line">
                  {model.bags
                    .filter((b) => b.traveller === t.index)
                    .map((b) => {
                      const n = qty(b.id);
                      return (
                        <li key={b.id} className="flex items-center gap-3 p-3">
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="font-medium">{b.title}</span>
                            <span className="block text-xs text-muted">{b.journey}</span>
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums">{money(b.price, { sign: true })}</span>
                          <span className="flex shrink-0 items-center gap-1" role="group" aria-label={`${b.title}, ${b.journey}, ${t.label}`}>
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-control border border-line disabled:opacity-40"
                              disabled={n === 0}
                              onClick={() => set(b.id, n - 1, b.price, `${b.title}, ${b.journey.toLowerCase()} (${t.label})`)}
                              aria-label="En väska mindre"
                            >
                              <Minus className="size-4" aria-hidden />
                            </button>
                            <span className="w-6 text-center font-bold tabular-nums" aria-live="polite">
                              {n}
                            </span>
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-control border border-line disabled:opacity-40"
                              disabled={n >= b.max}
                              onClick={() => set(b.id, n + 1, b.price, `${b.title}, ${b.journey.toLowerCase()} (${t.label})`)}
                              aria-label="En väska till"
                            >
                              <Plus className="size-4" aria-hidden />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {model.flights.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Armchair className="size-5 text-primary" aria-hidden /> Sittplatser
          </h3>
          <p className="mt-1 text-sm text-muted">Välj plats om ni vill sitta på en viss plats. Annars får ni en plats vid incheckningen.</p>
          <div className="mt-3 space-y-3">
            {model.flights.map((f) => (
              <SeatFlight key={f.key} flight={f} currency={model.currency} travellers={model.travellers.filter((t) => t.seat)} seats={seats} travellerLabel={travellerLabel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeatFlight({
  flight: f,
  currency,
  travellers,
  seats,
  travellerLabel,
}: {
  flight: ExtrasModel["flights"][number];
  currency: string;
  travellers: ExtrasModel["travellers"];
  seats: Map<string, Seat>;
  travellerLabel: (i: number) => string;
}) {
  const { extras: picked, setExtras } = useCheckout();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(travellers[0]?.index ?? 0);

  // Seats chosen on this flight, by traveller.
  const chosen = picked.map((p) => ({ pick: p, seat: seats.get(p.id) })).filter((x) => x.seat?.flight === f.key);
  const byDesignator = new Map(chosen.map((x) => [x.seat!.designator, x.seat!.traveller]));
  const total = chosen.reduce((n, x) => n + x.pick.price.amount, 0);

  const choose = (designator: string, prices: { id: string; traveller: number; price: Price }[]) => {
    const mine = chosen.find((x) => x.seat!.traveller === active);
    const owner = byDesignator.get(designator);
    if (owner !== undefined && owner !== active) return; // someone else in the party sits here
    const rest = picked.filter((p) => p.id !== mine?.pick.id);
    if (mine?.seat?.designator === designator) return setExtras(rest); // click again = no seat
    const offer = prices.find((p) => p.traveller === active);
    if (!offer) return;
    setExtras([...rest, { id: offer.id, quantity: 1, price: offer.price, label: `Plats ${designator}, ${f.label.split(" · ")[1]} (${travellerLabel(active)})` }]);
    // Next traveller without a seat on this flight, so a family can click seat after seat.
    const next = travellers.find((t) => t.index !== active && !chosen.some((x) => x.seat!.traveller === t.index));
    if (next) setActive(next.index);
  };

  return (
    <div className="rounded-card border border-line">
      <button type="button" className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {f.label} <span className="font-normal text-muted">{f.route}</span>
          </span>
          <span className="block text-xs text-muted">
            {chosen.length === 0 ? "Ingen plats vald" : chosen.map((x) => `${x.seat!.designator} (${travellerLabel(x.seat!.traveller)})`).join(", ")}
          </span>
        </span>
        {chosen.length > 0 && <span className="text-sm font-bold tabular-nums">{money({ amount: total, currency }, { sign: true })}</span>}
        <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-line p-3">
          {travellers.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Välj plats för">
              {travellers.map((t) => (
                <button
                  key={t.index}
                  type="button"
                  role="radio"
                  aria-checked={active === t.index}
                  onClick={() => setActive(t.index)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    active === t.index ? "border-primary bg-primary text-on-primary" : "border-line hover:border-primary/50",
                  )}
                >
                  {t.index + 1}. {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="mx-auto w-max space-y-1" role="group" aria-label={`Sittplatser ${f.label}`}>
              {f.rows.map((r, ri) =>
                r.exit ? (
                  <p key={ri} className="py-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Nödutgång
                  </p>
                ) : (
                  <div key={ri} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-muted tabular-nums">{r.label}</span>
                    {r.sections.map((sec, si) => (
                      <div key={si} className="flex gap-1">
                        {sec.map((c, ci) => {
                          if (c.kind !== "seat") return <span key={ci} className={cn("size-8", c.kind === "facility" && "rounded-control bg-panel")} aria-hidden />;
                          const owner = byDesignator.get(c.seat.designator);
                          const mine = c.seat.prices.find((p) => p.traveller === active);
                          const free = mine?.price.amount === 0;
                          const takenByUs = owner !== undefined;
                          const available = !!mine && (owner === undefined || owner === active);
                          return (
                            <button
                              key={ci}
                              type="button"
                              disabled={!available}
                              onClick={() => choose(c.seat.designator, c.seat.prices)}
                              title={mine ? `${c.seat.designator}: ${money(mine.price, { sign: true })}${c.seat.note ? " · särskilda villkor" : ""}` : `${c.seat.designator}: upptagen`}
                              aria-label={`Plats ${c.seat.designator}, ${takenByUs ? `vald för ${travellerLabel(owner!)}` : mine ? money(mine.price, { sign: true }) : "upptagen"}`}
                              aria-pressed={owner === active}
                              className={cn(
                                "relative grid size-8 place-items-center rounded-control text-[11px] font-bold tabular-nums",
                                owner === active ? "bg-primary text-on-primary"
                                : takenByUs ? "bg-accent text-on-accent"
                                : available ? (free ? "border border-success/60 bg-surface hover:bg-panel" : "border border-primary/40 bg-surface hover:bg-panel")
                                : "bg-line text-muted",
                              )}
                            >
                              {takenByUs ? owner! + 1 : available ? "" : "×"}
                              {c.seat.note && available && !takenByUs && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-accent" aria-hidden />}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          </div>
          <SeatLegend flight={f} active={active} currency={currency} />
        </div>
      )}
    </div>
  );
}

/** Price bands for the traveller choosing now, so the grid needs no numbers on every seat. */
function SeatLegend({ flight: f, active, currency }: { flight: ExtrasModel["flights"][number]; active: number; currency: string }) {
  const prices = [
    ...new Set(
      f.rows.flatMap((r) => r.sections.flat().flatMap((c) => (c.kind === "seat" ? c.seat.prices.filter((p) => p.traveller === active).map((p) => p.price.amount) : []))),
    ),
  ].sort((a, b) => a - b);
  const hasNote = f.rows.some((r) => r.sections.flat().some((c) => c.kind === "seat" && c.seat.note));
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>
        Pris per plats:{" "}
        {prices.length === 0 ? "inga lediga platser" : prices.length === 1 ? (prices[0] === 0 ? "gratis" : money({ amount: prices[0], currency })) : `${prices[0] === 0 ? "gratis" : money({ amount: prices[0], currency })} till ${money({ amount: prices.at(-1)!, currency })}`}
        . Priset för vald plats står ovanför kartan.
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3 rounded bg-line" /> Upptagen
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3 rounded bg-primary" /> Vald
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3 rounded bg-accent" /> Vald för en annan resenär
      </span>
      {hasNote && (
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-accent" /> Särskilda villkor, t.ex. nödutgång
        </span>
      )}
    </div>
  );
}
