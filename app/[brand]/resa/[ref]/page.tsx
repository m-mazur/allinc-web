import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, Bus, CalendarDays, Check, MapPin, Moon, Plane, PlaneTakeoff, Tag, UsersRound } from "lucide-react";
import { getBrand } from "@/brands";
import { api, ApiError } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { toParams } from "@/lib/server/search-params";
import { mapOffer, openTripRef, type OfferView } from "@/lib/server/view";
import { SearchFormLoader, SearchFormSkeleton } from "@/components/search-form-loader";
import { FlightLine } from "@/components/flight-line";
import { Stars } from "@/components/stars";
import { TestModeNote } from "@/components/test-mode-note";
import { SoldOutNote } from "@/components/sold-out-note";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { dateLong, money, nightsLabel, party } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Din resa", robots: { index: false } };

export default function OfferPage({ params, searchParams }: PageProps<"/[brand]/resa/[ref]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-6 xl:px-0">
      <Suspense fallback={<OfferSkeleton />}>
        <Offer params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Offer({ params, searchParams }: { params: Promise<{ brand: string; ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
      <Link href={back} className="inline-flex items-center gap-1 py-2 text-sm font-bold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Alla resor till {o.trip.destination}
      </Link>
      <SoldOutNote what={(await searchParams).slutsalt} />
      <TitleRow o={o} />
      <Gallery o={o} />
      <div className="mt-6">
        <Suspense fallback={<SearchFormSkeleton variant="bar" />}>
          <SearchFormLoader values={ref.q} variant="bar" />
        </Suspense>
      </div>
      {o.testFlights && (
        <div className="mt-4">
          <TestModeNote />
        </div>
      )}
      <Facts o={o} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Rooms o={o} />
          <Flights o={o} />
        </div>
        <BookingCard o={o} />
      </div>
      <About o={o} />
    </>
  );
}

function TitleRow({ o }: { o: OfferView }) {
  const h = o.hotel;
  return (
    <div className="mb-4 mt-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl sm:text-[28px]">{h.name}</h1>
        {h.stars ? <Stars n={h.stars} size="md" /> : h.kind && <span className="text-sm text-muted">{h.kind}</span>}
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
        <MapPin className="size-3" aria-hidden /> {[h.area, h.address].filter(Boolean).join(" · ") || o.trip.destination}
      </p>
    </div>
  );
}

/** One large photo and four small, as on the reference hotel page. */
function Gallery({ o }: { o: OfferView }) {
  const imgs = o.hotel.images.slice(0, 5);
  if (!imgs.length) return <div className="h-64 rounded-card bg-panel sm:h-[390px]" />;
  return (
    <div className="grid h-64 grid-cols-4 grid-rows-2 gap-2 sm:h-[390px]">
      {imgs.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src}
          src={img.src}
          alt={img.alt}
          loading={i === 0 ? "eager" : "lazy"}
          className={cn("h-full w-full rounded-card bg-panel object-cover", i === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block")}
        />
      ))}
    </div>
  );
}

/** Quiet grey fact boxes under the search bar. */
function Facts({ o }: { o: OfferView }) {
  const facts = [
    { icon: Tag, label: "Pris per person", value: money(o.selected.perPerson), sub: `${money(o.selected.price)} totalt` },
    { icon: CalendarDays, label: "Avresa", value: dateLong(o.trip.depart), sub: nightsLabel(o.trip.nights) },
    o.hotel.airportKm != null
      ? { icon: Bus, label: "Till flygplatsen", value: `${o.hotel.airportKm} km`, sub: "Transfer kan läggas till i kassan" }
      : null,
  ].filter(Boolean) as { icon: typeof Tag; label: string; value: string; sub: string }[];
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg">Din resa i korthet</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {facts.map(({ icon: Icon, label, value, sub }) => (
          <Panel key={label} className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Icon className="size-3.5" aria-hidden /> {label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted">{sub}</p>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function Rooms({ o }: { o: OfferView }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg">Välj rum</h2>
      <p className="text-sm text-muted">Priset visar skillnaden mot det du har valt nu.</p>
      <ul className="mt-3 divide-y divide-line">
        {o.rooms.slice(0, 12).map((r) => (
          <li key={r.ref} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">{r.room}</p>
              <p className="mt-0.5 text-xs text-muted">
                <span className="font-bold text-primary">{r.board}</span>
                {" · "}
                {r.refundable ? <span className="text-success">Fri avbokning</span> : "Ej återbetalningsbar"}
              </p>
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
      <h2 className="text-lg">Välj flyg</h2>
      <p className="text-sm text-muted">{o.flightsAvailable} flyg passar resan. Här är de billigaste.</p>
      <ul className="mt-3 divide-y divide-line">
        {o.flights.map((f) => (
          <li key={f.ref} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-bold">{f.airline}</p>
              <p className="tabular-nums text-ink/80">Ut: {f.outbound}</p>
              <p className="tabular-nums text-ink/80">Hem: {f.inbound}</p>
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
      <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-control bg-primary-soft px-3 text-sm font-bold text-primary">
        <Check className="size-4" aria-hidden /> Valt
      </span>
    );
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex h-10 shrink-0 items-center rounded-control border border-primary px-3 text-sm font-bold tabular-nums text-primary hover:bg-primary-soft"
    >
      {Math.abs(delta.amount) < 1 ? "Samma pris" : money(delta, { sign: true })}
    </Link>
  );
}

/** The booking card: photo, name, price per person, the trip as icon rows, one big button. */
function BookingCard({ o }: { o: OfferView }) {
  const s = o.selected;
  const thumb = o.hotel.images[0];
  const row = "flex items-center gap-2.5 text-sm";
  const ic = "size-4 shrink-0 text-ink/70";
  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <Card className="p-4">
        <div className="flex gap-3">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb.src} alt="" className="size-24 shrink-0 rounded-control object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate font-bold">{o.hotel.name}</p>
            <p className="truncate text-xs text-muted">{o.hotel.area ?? o.trip.destination}</p>
            <Stars n={o.hotel.stars} />
            <p className="mt-1 leading-none">
              <span className="text-[28px] font-bold tabular-nums">{money(s.perPerson)}</span>
              <span className="text-xs text-muted"> /pp</span>
            </p>
            <p className="text-[11px] font-bold uppercase text-muted">{money(s.price)} totalt</p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 border-t border-line pt-4">
          <p className={row}>
            <CalendarDays className={ic} aria-hidden /> {dateLong(o.trip.depart)}
          </p>
          <p className={row}>
            <PlaneTakeoff className={ic} aria-hidden /> {s.flight.legs[0]?.from} · {s.flight.airline}
          </p>
          <p className={row}>
            <Moon className={ic} aria-hidden /> {nightsLabel(o.trip.nights)} · {s.board}
          </p>
          <p className={row}>
            <UsersRound className={ic} aria-hidden /> {party(o.trip.adults, o.trip.children)}
          </p>
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {s.flight.legs.map((leg, i) => (
            <FlightLine key={i} leg={leg} label={i === 0 ? "Ut" : "Hem"} />
          ))}
          <p className="text-xs text-muted">
            {s.room} · {s.bags}
            {s.refundable && s.freeCancellationUntil && <> · fri avbokning till {dateLong(s.freeCancellationUntil)}</>}
          </p>
          {s.payAtHotel && <p className="text-xs text-muted">+ ca {money(s.payAtHotel)} i lokal skatt, betalas på hotellet</p>}
        </div>
        <ButtonLink href={`/kassa/${o.ref}`} size="lg" className="mt-4 w-full">
          Fortsätt till bokning
        </ButtonLink>
      </Card>
    </aside>
  );
}

function About({ o }: { o: OfferView }) {
  const h = o.hotel;
  if (!h.description && !h.nearby.length) return null;
  return (
    <section className="mt-12 grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-lg">Om hotellet</h2>
        {h.description && <p className="mt-2 text-sm leading-relaxed text-ink/90">{h.description}</p>}
      </div>
      {h.nearby.length > 0 && (
        <div className="lg:border-l lg:border-line lg:pl-8">
          <h2 className="text-lg">I närheten</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {h.nearby.map((p) => (
              <li key={p.name} className="flex justify-between py-2">
                <span>{p.name}</span>
                {p.distance && <span className="text-muted">{formatDistance(p.distance)}</span>}
              </li>
            ))}
            {h.airportKm != null && (
              <li className="flex justify-between py-2">
                <span className="inline-flex items-center gap-1.5">
                  <Plane className="size-3.5" aria-hidden /> Flygplatsen
                </span>
                <span className="text-muted">{h.airportKm} km</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

const formatDistance = (m: string) => {
  const n = Number(m);
  return Number.isFinite(n) ? (n >= 1000 ? `${(n / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km` : `${n} m`) : m;
};

function OfferGone({ expired, backHref }: { expired: boolean; backHref: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="text-xl">{expired ? "Resan finns inte längre" : "Vi kunde inte hämta resan"}</h1>
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
    <div aria-busy="true" aria-label="Hämtar resan" className="pt-10">
      <div className="skeleton h-7 w-80 rounded" />
      <div className="skeleton mt-2 h-3 w-60 rounded" />
      <div className="mt-4 grid h-64 grid-cols-4 grid-rows-2 gap-2 sm:h-[390px]">
        <div className="skeleton col-span-4 row-span-2 rounded-card sm:col-span-2" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton hidden rounded-card sm:block" />
        ))}
      </div>
    </div>
  );
}
