import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, Bus } from "lucide-react";
import { getBrand } from "@/brands";
import { api, ApiError, type RawTransfers } from "@/lib/server/api";
import { sealCheckout, startCheckout } from "@/lib/server/checkout";
import { mapOffer, mapTransfers, openTripRef } from "@/lib/server/view";
import { CheckoutState } from "@/components/checkout/checkout-state";
import { CheckoutTotal, PayPanel } from "@/components/checkout/checkout-summary";
import { SessionInit } from "@/components/checkout/session-init";
import { TransferPicker } from "@/components/checkout/transfer-picker";
import { TravellerForm } from "@/components/checkout/traveller-form";
import { FlightLine } from "@/components/flight-line";
import { TestModeNote } from "@/components/test-mode-note";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, dateLong, nightsLabel, party } from "@/lib/format";

export const metadata: Metadata = { title: "Kassa", robots: { index: false } };

// Checkout: the trip, the transfer suggestion, a traveller form, and the live price check.
// Streamed in after the shell: the transfer suggestion, then POST /checkout for the package with the
// suggested transfer (one live supplier check). "Till betalning" checks again; payment itself is not
// built yet, so nothing is paid or booked.

export default function CheckoutPage({ params }: PageProps<"/[brand]/kassa/[ref]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 xl:px-0">
      <Suspense fallback={<div className="skeleton h-96 rounded-card" aria-busy="true" />}>
        <Checkout params={params} />
      </Suspense>
    </main>
  );
}

async function Checkout({ params }: { params: Promise<{ brand: string; ref: string }> }) {
  await connection(); // request-time: reads the clock and calls the API
  const { brand: brandId, ref: token } = await params;
  const brand = getBrand(brandId)!;
  const ref = openTripRef(token);
  if (!ref) notFound();

  let raw;
  try {
    raw = await api.offer(ref.q, ref.f, brand.market, ref.h, ref.fl, ref.r);
  } catch {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold">Resan finns inte längre</h1>
        <p className="mt-2 text-muted">Priser och platser ändras hela tiden. Sök igen så visar vi vad som finns nu.</p>
        <ButtonLink href="/" className="mt-6">
          Ny sökning
        </ButtonLink>
      </Card>
    );
  }
  const o = mapOffer(raw, null, ref);
  const s = o.selected;
  const travellers = o.trip.adults + o.trip.children;

  return (
    <CheckoutState travellers={travellers}>
      <Link href={`/resa/${o.ref}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Tillbaka till resan
      </Link>
      <h1 className="text-[28px]">Kassa</h1>
      {o.testFlights && <div className="mt-3"><TestModeNote /></div>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Bus className="size-5 text-primary" aria-hidden />
              <h2 className="text-lg">Transfer till hotellet</h2>
            </div>
            <Suspense fallback={<TransferLoading />}>
              <LiveCheckout trip={ref} market={brand.market} passportRequired={s.passportRequired} />
            </Suspense>
          </Card>
          <TravellerForm
            adults={o.trip.adults}
            childAges={ref.q.childAges}
            depart={ref.q.depart}
            returnDate={addDays(ref.q.depart, ref.q.nights)}
            passportRequired={s.passportRequired}
          />
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-bold">{o.hotel.name}</h2>
              <p className="text-sm text-muted">
                {o.trip.destination} · {dateLong(o.trip.depart)} · {nightsLabel(o.trip.nights)} · {party(o.trip.adults, o.trip.children)}
              </p>
            </div>
            <div className="space-y-1">
              {s.flight.legs.map((leg, i) => (
                <FlightLine key={i} leg={leg} label={i === 0 ? "Ut" : "Hem"} />
              ))}
              <p className="text-xs text-muted">{s.flight.airline} · {s.bags}</p>
            </div>
            <p className="text-sm">
              <span className="font-semibold">{s.room}</span> <span className="text-muted">· {s.board}</span>
            </p>
            <CheckoutTotal base={s.price} travellers={travellers} />
            <PayPanel />
          </Card>
        </aside>
      </div>
    </CheckoutState>
  );
}

/** Loads the transfer options, then checks the package live (flight + hotel, no transfer yet). */
async function LiveCheckout({ trip, market, passportRequired }: { trip: NonNullable<ReturnType<typeof openTripRef>>; market: string; passportRequired: boolean }) {
  const raw: RawTransfers | ApiError = await api.transfers(trip.q, trip.f, market, trip.h, trip.fl).catch((e: ApiError) => e);
  const transfers = raw instanceof ApiError ? null : mapTransfers(raw);

  const t = { q: trip.q, f: trip.f, h: trip.h, fl: trip.fl, r: trip.r };
  // Start without a transfer, so the checkout total is the price the customer saw on the offer page.
  // The transfer is an add-on they choose; picking one is checked at "Till betalning".
  const first = await startCheckout(t, market, passportRequired, null);
  // A failed first check still gets a ref (no checkout id), so "Kontrollera priset igen" can start one.
  const session = { view: first.view!, ref: first.ref ?? sealCheckout("", t, market, passportRequired, null, 0), transferId: null };

  return (
    <>
      <SessionInit session={session} transfer={null} />
      {!transfers ? (
        <p className="mt-3 text-sm text-muted">
          {raw instanceof ApiError && raw.kind === "SourcesFailed" ? "Transfer går inte att hämta just nu." : "Vi kunde inte hämta transfer just nu."} Resan går att boka utan.
        </p>
      ) : transfers.options.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Vi hittade ingen transfer för den här resan.</p>
      ) : (
        <div className="mt-3">
          <TransferPicker options={transfers.options} reason={transfers.reason} airport={transfers.airport} arrival={transfers.arrival} note={transfers.note} />
        </div>
      )}
    </>
  );
}

function TransferLoading() {
  return (
    <div className="mt-3" aria-busy="true">
      <p className="text-sm text-muted" role="status">
        Vi letar transfer från flygplatsen till hotellet…
      </p>
      <div className="mt-4 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-card border border-line p-3">
            <div className="skeleton size-16 rounded-control" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/3 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
            <div className="skeleton h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
