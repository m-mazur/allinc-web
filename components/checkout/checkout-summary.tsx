"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { bookAction, confirmAction, payAction, recheckAction } from "@/lib/actions/checkout";
import { money, type Price } from "@/lib/format";
import { cn } from "@/lib/cn";
import { extrasKey } from "@/lib/extras";
import { useCheckout, type BookingResultClient, type Session } from "./checkout-state";

/**
 * The amount to pay. When the latest server check covers the chosen transfer and extras, that check's
 * total is shown (the amount the API session holds). Otherwise, a preview: the package plus the chosen
 * transfer and extras, all customer prices from the server, checked again at "Till betalning".
 */
export function CheckoutTotal({ base, travellers }: { base: Price; travellers: number }) {
  const { transfer, extras, session } = useCheckout();
  const covered = session?.view.total && session.transferId === (transfer?.id ?? null) && session.extrasKey === extrasKey(extras);
  const extrasPreview = extras.reduce((n, e) => n + e.price.amount * e.quantity, 0);
  const total = covered ? session!.view.total! : { amount: base.amount + (transfer?.price.amount ?? 0) + extrasPreview, currency: base.currency };
  // When the check covers this choice, every amount shown comes from it.
  const transferLine = covered ? session!.view.lines.find((l) => l.label === "Transfer") : undefined;
  const extrasLine = covered ? session!.view.lines.find((l) => l.label === "Bagage och platser") : undefined;
  const transferPrice = covered ? (transferLine?.price ?? null) : (transfer?.price ?? null);
  const extrasPrice = covered ? (extrasLine?.price ?? null) : extras.length ? { amount: extrasPreview, currency: base.currency } : null;
  const packagePrice = covered
    ? { amount: total.amount - (transferLine?.price.amount ?? 0) - (extrasLine?.price.amount ?? 0), currency: total.currency }
    : base;
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
      {extrasPrice && (
        <div className="flex justify-between">
          <span className="text-muted">Bagage och platser</span>
          <span className="tabular-nums">{money(extrasPrice)}</span>
        </div>
      )}
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
/** testBookings: "Boka testresa" books on the suppliers' test systems (no payment step). */
export function PayPanel({ testBookings = false }: { testBookings?: boolean }) {
  const { transfer, extras, setExtras, session, setSession, setTransfer, checking, booking, errors, setErrors } = useCheckout();
  const [pending, start] = useTransition();
  const [paid, setPaid] = useState(false);
  const [result, setResult] = useState<BookingResultClient | null>(null);
  const transferId = transfer?.id ?? null;
  const picks = extras.map((e) => ({ id: e.id, quantity: e.quantity }));
  const pickedKey = extrasKey(picks);

  // isPay: the customer pressed "Till betalning" or accepted a new price; an Ok answer then means
  // the price is locked and payment would start (not built yet).
  const run = (fn: () => Promise<{ view: Session["view"] | null; ref: string | null; extrasKey?: string; errors?: Record<string, string>; booking?: BookingResultClient }>, isPay: boolean) =>
    start(async () => {
      const r = await fn();
      if (r.errors) {
        // Traveller details need fixing: show them by the fields and go to the first one.
        setErrors(r.errors);
        const first = Object.keys(r.errors)[0];
        document.getElementById(`f-${first}`)?.focus();
        return;
      }
      setErrors({});
      if (!r.view) return;
      // Keep the last good ref when a check fails, so "Kontrollera priset igen" can continue from it.
      setSession({
        view: r.view,
        ref: r.ref ?? session!.ref,
        transferId: r.ref ? transferId : session!.transferId,
        extrasKey: r.ref ? (r.extrasKey ?? "") : session!.extrasKey,
      });
      // Test bookings: an Ok check is followed by the booking in the same action; its result replaces the panel.
      if (r.booking) setResult(r.booking);
      setPaid(!testBookings && isPay && r.view.status === "ok");
    });

  if (result) return <BookingBox result={result} />;

  if (checking)
    return (
      <p className="flex items-center gap-2 rounded-control bg-panel p-3 text-sm text-muted" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Vi kontrollerar priset med flygbolag och hotell…
      </p>
    );
  const v = session!.view;
  const sameChoice = session!.transferId === transferId && session!.extrasKey === pickedKey;

  return (
    <div className="space-y-3">
      {sameChoice && <StatusBox view={v} paid={paid} />}
      {sameChoice && (v.status === "ok" || v.status === "changed") && v.secondsLeft != null && (
        <Countdown
          key={session!.ref}
          seconds={v.secondsLeft}
          onExpire={() =>
            setSession({
              ...session!,
              view: { ...v, status: "expired", title: "Tiden för priset har gått ut", message: "Vi håller ett pris i högst 20 minuter. Kontrollera priset igen för att fortsätta.", canPay: false, secondsLeft: 0 },
            })
          }
        />
      )}
      {!sameChoice && <p className="text-xs text-muted">Du har ändrat ditt val. Vi kontrollerar priset igen när du går vidare.</p>}
      {Object.keys(errors).length > 0 && <p className="text-xs font-bold text-danger">Kontrollera resenärsuppgifterna: {Object.keys(errors).length} fält behöver rättas.</p>}

      {(v.status === "ok" || !sameChoice) && !paid && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => (testBookings ? bookAction : payAction)(session!.ref, transferId, picks, booking), true)}
          className={btn}
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {pending ? (testBookings ? "Bokar i testsystemet…" : "Kontrollerar priset…") : testBookings ? "Boka testresa" : "Till betalning"}
        </button>
      )}
      {testBookings && (v.status === "ok" || !sameChoice) && !paid && (
        <p className="text-xs text-muted">
          Testläge: resan bokas i flygbolagets och hotellets testsystem. Ingen betalning, inget riktigt bokas. Det kan ta upp till en minut.
        </p>
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
      {sameChoice && v.status === "soldout" && v.soldOutWhat === "extras" && extras.length > 0 && (
        <button type="button" className={btn} onClick={() => setExtras([])}>
          Fortsätt utan tillval
        </button>
      )}
      {sameChoice && v.status === "soldout" && !v.soldOutHref && v.soldOutWhat !== "extras" && transfer && (
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
      {v.status === "ok" && paid && (
        <p className="text-ink/80">Resenärsuppgifterna är kompletta. Det här är en förhandsversion: betalning är inte påslagen, inget dras och inget bokas.</p>
      )}
    </div>
  );
}

/**
 * Time left on the price hold. Counts down from the seconds the server worked out (not the device
 * clock), turns amber under 5 minutes, and at zero hands over to "Kontrollera priset igen".
 */
function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline]); // eslint-disable-line react-hooks/exhaustive-deps
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const low = left < 300;
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-control px-3 py-2 text-sm", low ? "bg-[color-mix(in_srgb,var(--color-accent)_22%,white)]" : "bg-panel")}>
      <span className="flex items-center gap-2">
        <Clock className="size-4 shrink-0" aria-hidden />
        {low ? "Slutför bokningen snart. Vi håller priset i" : "Vi håller priset i"}
      </span>
      {/* Announce only whole minutes to screen readers, not every second. */}
      <span className="font-bold tabular-nums" aria-hidden>
        {mm}:{ss}
      </span>
      <span className="sr-only" aria-live="polite">
        {Math.ceil(left / 60)} minuter kvar
      </span>
    </div>
  );
}

/** The test booking's outcome: reference and per-part status, or why it did not go through. */
function BookingBox({ result: r }: { result: BookingResultClient }) {
  const tone =
    r.status === "confirmed" ? "bg-[color-mix(in_srgb,var(--color-success)_10%,white)] text-success"
    : r.status === "failed" ? "bg-panel text-ink"
    : "bg-[color-mix(in_srgb,var(--color-accent)_22%,white)] text-ink";
  const Icon = r.status === "confirmed" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={cn("space-y-3 rounded-control p-4 text-sm", tone)} role="status">
      <p className="flex items-center gap-2 text-base font-bold">
        <Icon className="size-5 shrink-0" aria-hidden /> {r.title}
      </p>
      {r.reference && (
        <p className="text-ink">
          Bokningsnummer <span className="font-bold tabular-nums">{r.reference}</span>
          {r.isTest && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase text-on-accent">Test</span>}
        </p>
      )}
      {r.lines.length > 0 && (
        <ul className="space-y-1 text-ink">
          {r.lines.map((l) => (
            <li key={l.label} className="flex justify-between">
              <span>{l.label}</span>
              <span className="font-bold">{l.status}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-ink/80">{r.message}</p>
      {r.status === "failed" && (
        <Link href="/" className="block text-center font-bold text-primary hover:underline">
          Gör en ny sökning
        </Link>
      )}
    </div>
  );
}
