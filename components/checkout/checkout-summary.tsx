"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { confirmAction, payAction, recheckAction } from "@/lib/actions/checkout";
import { money, type Price } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCheckout, type Session } from "./checkout-state";

/**
 * The amount to pay. When the latest server check covers the chosen transfer, that check's total
 * is shown (the amount the API session holds). Otherwise, a preview: the package plus the chosen
 * transfer, both customer prices from the server, checked again at "Till betalning".
 */
export function CheckoutTotal({ base, travellers }: { base: Price; travellers: number }) {
  const { transfer, session } = useCheckout();
  const covered = session?.view.total && session.transferId === (transfer?.id ?? null);
  const total = covered ? session!.view.total! : { amount: base.amount + (transfer?.price.amount ?? 0), currency: base.currency };
  // When the check covers this choice, every amount shown comes from it.
  const transferLine = covered ? session!.view.lines.find((l) => l.label === "Transfer") : undefined;
  const transferPrice = covered ? (transferLine?.price ?? null) : (transfer?.price ?? null);
  const packagePrice = covered ? { amount: total.amount - (transferLine?.price.amount ?? 0), currency: total.currency } : base;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted">Flyg och hotell</span>
        <span className="tabular-nums">{money(packagePrice)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Transfer</span>
        <span className="tabular-nums">{transferPrice ? money(transferPrice) : "Ingen"}</span>
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-bold">Att betala</span>
        <span className="text-3xl font-bold tabular-nums" aria-live="polite">
          {money(total)}
        </span>
      </div>
      <p className="text-right text-muted">{money({ amount: Math.round(total.amount / travellers), currency: total.currency })} per person</p>
      {!covered && session && <p className="text-right text-xs text-muted">Priset kontrolleras när du går vidare.</p>}
    </div>
  );
}

/** Price-check status and the actions it allows: pay, accept a new price, check again, or go elsewhere. */
export function PayPanel() {
  const { transfer, session, setSession, setTransfer, checking } = useCheckout();
  const [pending, start] = useTransition();
  const [paid, setPaid] = useState(false);
  const transferId = transfer?.id ?? null;

  // isPay: the customer pressed "Till betalning" or accepted a new price; an Ok answer then means
  // the price is locked and payment would start (not built yet).
  const run = (fn: () => Promise<{ view: Session["view"]; ref: string | null }>, isPay: boolean) =>
    start(async () => {
      const r = await fn();
      // Keep the last good ref when a check fails, so "Kontrollera priset igen" can continue from it.
      setSession({ view: r.view, ref: r.ref ?? session!.ref, transferId: r.ref ? transferId : session!.transferId });
      setPaid(isPay && r.view.status === "ok");
    });

  if (checking)
    return (
      <p className="flex items-center gap-2 rounded-control bg-panel p-3 text-sm text-muted" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Vi kontrollerar priset med flygbolag och hotell…
      </p>
    );
  const v = session!.view;
  const sameChoice = session!.transferId === transferId;

  return (
    <div className="space-y-3">
      {sameChoice && <StatusBox view={v} paid={paid} />}
      {!sameChoice && <p className="text-xs text-muted">Du har ändrat transfer. Vi kontrollerar priset igen när du går vidare.</p>}

      {(v.status === "ok" || !sameChoice) && !paid && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => payAction(session!.ref, transferId), true)}
          className={btn}
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {pending ? "Kontrollerar priset…" : "Till betalning"}
        </button>
      )}
      {sameChoice && v.status === "changed" && (
        <>
          <button type="button" disabled={pending} onClick={() => run(() => confirmAction(session!.ref), true)} className={btn}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            Godkänn nytt pris{v.total ? `: ${money(v.total)}` : ""}
          </button>
          <button type="button" className="block w-full text-center text-sm font-bold text-primary hover:underline" onClick={() => history.back()}>
            Tillbaka och välj något annat
          </button>
        </>
      )}
      {sameChoice && v.status === "soldout" && v.soldOutHref && (
        <Link href={v.soldOutHref} className={btn}>
          Visa andra alternativ
        </Link>
      )}
      {sameChoice && v.status === "soldout" && !v.soldOutHref && transfer && (
        <button type="button" className={btn} onClick={() => setTransfer(null)}>
          Fortsätt utan transfer
        </button>
      )}
      {sameChoice && (v.status === "expired" || v.status === "cannotconfirm" || v.status === "busy") && (
        <button type="button" disabled={pending} onClick={() => run(() => recheckAction(session!.ref, transferId), false)} className={btn}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Kontrollera priset igen
        </button>
      )}
    </div>
  );
}

const btn =
  "inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-control bg-primary px-6 font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60";

function StatusBox({ view: v, paid }: { view: Session["view"]; paid: boolean }) {
  const tone =
    v.status === "ok" ? "bg-[color-mix(in_srgb,var(--color-success)_10%,white)] text-success"
    : v.status === "changed" ? "bg-[color-mix(in_srgb,var(--color-accent)_22%,white)] text-ink"
    : "bg-panel text-ink";
  const Icon = v.status === "ok" ? CheckCircle2 : v.status === "expired" ? Clock : AlertTriangle;
  return (
    <div className={cn("space-y-2 rounded-control p-3 text-sm", tone)} role="status">
      <p className="flex items-center gap-2 font-bold">
        <Icon className="size-4 shrink-0" aria-hidden /> {v.title}
      </p>
      {v.status === "changed" && v.previousTotal && v.total && (
        <p className="tabular-nums">
          <span className="line-through opacity-70">{money(v.previousTotal)}</span> → <span className="font-bold">{money(v.total)}</span>
        </p>
      )}
      {v.status === "changed" &&
        v.lines
          .filter((l) => l.status === "changed")
          .map((l) => (
            <p key={l.label} className="text-xs">
              {l.label}: {l.previousPrice ? `${money(l.previousPrice)} → ` : ""}
              {money(l.price)}
              {l.changes.length > 0 && ` (${l.changes.join(", ").toLowerCase()} har ändrats)`}
            </p>
          ))}
      <p className={v.status === "ok" ? "text-ink/80" : ""}>{v.message}</p>
      {v.status === "ok" && !paid && v.expiresAt && <p className="text-xs text-ink/70">Vi håller priset till kl {new Date(v.expiresAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}.</p>}
      {v.status === "ok" && paid && (
        <p className="text-ink/80">Det här är en förhandsversion: betalning är inte påslagen, inget dras och inget bokas.</p>
      )}
    </div>
  );
}
