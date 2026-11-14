import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, Check, MapPin, Plane } from "lucide-react";
import { getBrand } from "@/brands";
import { api, ApiError } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { toParams } from "@/lib/server/search-params";
import { mapOffer, openTripRef, type OfferView } from "@/lib/server/view";
import { FlightLine } from "@/components/flight-line";
import { Stars } from "@/components/stars";
import { TestModeNote } from "@/components/test-mode-note";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dateLong, money, nightsLabel, party } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Din resa", robots: { index: false } };

export default function OfferPage({ params }: PageProps<"/[brand]/resa/[ref]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<OfferSkeleton />}>
        <Offer params={params} />
      </Suspense>
    </main>
  );
}

async function Offer({ params }: { params: Promise<{ brand: string; ref: string }> }) {
  await connection(); // request-time: reads the clock and calls the API
  const { brand: brandId, ref: token } = await params;
  const brand = getBrand(brandId)!;
  const ref = openTripRef(token);
  if (!ref) notFound();

  let raw, content;
  try {
    [raw, content] = await Promise.all([
      api.offer(ref.q, ref.f, brand.market, ref.h, ref.fl, ref.r),
      api.content([ref.h], env.contentLanguage).catch(() => null),
    ]);
  } catch (e) {
    return <OfferGone expired={e instanceof ApiError && e.kind === "NotFound"} backHref={`/sok?${toParams(ref.q, ref.f)}`} />;
  }
  const o = mapOffer(raw, content, ref);
  const back = `/sok?${toParams(ref.q, ref.f)}`;

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Alla resor till {o.trip.destination}
      </Link>
      {o.testFlights && <TestModeNote />}
      <Gallery o={o} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <HotelIntro o={o} />
          <Rooms o={o} />
          <Flights o={o} />
        </div>
        <Summary o={o} />
      </div>
    </>
  );
}

function Gallery({ o }: { o: OfferView }) {
  const imgs = o.hotel.images.slice(0, 5);
  if (!imgs.length) return null;
  return (
    <div className="grid h-64 grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card sm:h-96">
      {imgs.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src}
          src={img.src}
          alt={img.alt}
          loading={i === 0 ? "eager" : "lazy"}
          className={cn("h-full w-full bg-canvas object-cover", i === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block")}
        />
      ))}
    </div>
  );
}

function HotelIntro({ o }: { o: OfferView }) {
  const h = o.hotel;
  return (
    <section>
      <h1 className="text-3xl font-bold">{h.name}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {h.stars ? <Stars n={h.stars} /> : h.kind && <span>{h.kind}</span>}
        {(h.area || h.address) && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden /> {[h.area, h.address].filter(Boolean).join(" · ")}
          </span>
        )}
        {h.airportKm != null && (
          <span className="inline-flex items-center gap-1">
            <Plane className="size-3.5" aria-hidden /> {h.airportKm} km från flygplatsen
          </span>
        )}
      </div>
      {h.description && <p className="mt-4 max-w-prose leading-relaxed text-ink/90">{h.description}</p>}
      {h.nearby.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 text-sm">
          {h.nearby.map((p) => (
            <li key={p.name} className="rounded-full bg-surface px-3 py-1 ring-1 ring-line">
              {p.name}
              {p.distance && <span className="text-muted"> · {formatDistance(p.distance)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const formatDistance = (m: string) => {
  const n = Number(m);
  return Number.isFinite(n) ? (n >= 1000 ? `${(n / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km` : `${n} m`) : m;
};

function Rooms({ o }: { o: OfferView }) {
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold">Välj rum</h2>
      <p className="text-sm text-muted">Priset ändras med skillnaden mot det du valt nu.</p>
      <ul className="mt-4 divide-y divide-line">
        {o.rooms.slice(0, 12).map((r) => (
          <li key={r.ref} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{r.room}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone="brand">{r.board}</Badge>
                {r.refundable ? <Badge tone="good">Fri avbokning</Badge> : <Badge>Ej återbetalningsbar</Badge>}
              </div>
            </div>
            <Choice selected={r.selected} href={`/resa/${r.ref}`} delta={r.delta} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Flights({ o }: { o: OfferView }) {
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold">Välj flyg</h2>
      <p className="text-sm text-muted">
        {o.flightsAvailable} flyg passar resan. Här är de billigaste.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {o.flights.map((f) => (
          <li key={f.ref} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{f.airline}</p>
              <p className="tabular-nums">Ut: {f.outbound}</p>
              <p className="tabular-nums">Hem: {f.inbound}</p>
              <p className="text-xs text-muted">
                {f.stops === 0 ? "Direkt båda vägar" : `${f.stops} byte totalt`} · {f.bags}
              </p>
            </div>
            <Choice selected={f.selected} href={`/resa/${f.ref}`} delta={f.delta} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Choice({ selected, href, delta }: { selected: boolean; href: string; delta: { amount: number; currency: string } }) {
  if (selected)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-control bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
        <Check className="size-4" aria-hidden /> Valt
      </span>
    );
  return (
    <Link
      href={href}
      scroll={false}
      className="shrink-0 rounded-control border border-line px-3 py-2 text-sm font-semibold tabular-nums hover:border-primary hover:text-primary"
    >
      {Math.abs(delta.amount) < 1 ? "Samma pris" : money(delta, { sign: true })}
    </Link>
  );
}

function Summary({ o }: { o: OfferView }) {
  const s = o.selected;
  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Din resa</h2>
          <p className="text-sm text-muted">
            {dateLong(o.trip.depart)} · {nightsLabel(o.trip.nights)} · {party(o.trip.adults, o.trip.children)}
          </p>
        </div>
        <div className="space-y-1">
          {s.flight.legs.map((leg, i) => (
            <FlightLine key={i} leg={leg} label={i === 0 ? "Ut" : "Hem"} />
          ))}
          <p className="text-xs text-muted">
            {s.flight.airline} · {s.bags}
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">{s.room}</p>
          <p className="text-muted">
            {s.board}
            {s.refundable && s.freeCancellationUntil && <> · fri avbokning till {dateLong(s.freeCancellationUntil)}</>}
          </p>
        </div>
        <div className="border-t border-line pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Totalt</span>
            <span className="text-3xl font-bold tabular-nums">{money(s.price)}</span>
          </div>
          <p className="text-right text-sm text-muted">{money(s.perPerson)} per person</p>
          {s.payAtHotel && <p className="mt-1 text-right text-xs text-muted">+ ca {money(s.payAtHotel)} i lokal skatt, betalas på hotellet</p>}
        </div>
        <ButtonLink href={`/kassa/${o.ref}`} size="lg" className="w-full">
          Gå vidare
        </ButtonLink>
      </Card>
    </aside>
  );
}

function OfferGone({ expired, backHref }: { expired: boolean; backHref: string }) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-bold">{expired ? "Resan finns inte längre" : "Vi kunde inte hämta resan"}</h1>
      <p className="mt-2 text-muted">
        {expired ? "Priser och platser ändras hela tiden. Sök igen så visar vi vad som finns nu." : "Försök igen om en liten stund."}
      </p>
      <ButtonLink href={backHref} className="mt-6">
        Till sökresultatet
      </ButtonLink>
    </Card>
  );
}

function OfferSkeleton() {
  return (
    <div aria-busy="true" aria-label="Hämtar resan">
      <div className="skeleton h-64 rounded-card sm:h-96" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="skeleton h-8 w-1/2 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-24 rounded" />
        </div>
        <div className="skeleton h-80 rounded-card" />
      </div>
    </div>
  );
}
