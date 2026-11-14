import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Check, ImageOff, MapPin } from "lucide-react";
import { getBrand } from "@/brands";
import { api, ApiError, type SearchFilters, type SearchQuery } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { parseSearch, toParams, type SP } from "@/lib/server/search-params";
import { mapCardImages, mapSearch, type ResultCard } from "@/lib/server/view";
import { SearchFormLoader, SearchFormSkeleton } from "@/components/search-form-loader";
import { FlightLine } from "@/components/flight-line";
import { TestModeNote } from "@/components/test-mode-note";
import { Stars } from "@/components/stars";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { dateLong, money, nightsLabel, party } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Sök paketresa", robots: { index: false } };

export default function SearchPage({ params, searchParams }: PageProps<"/[brand]/sok">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<SearchSkeleton />}>
        <SearchContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchContent({ params, searchParams }: { params: Promise<{ brand: string }>; searchParams: Promise<SP> }) {
  await connection(); // request-time: reads the clock and calls the API
  const brand = getBrand((await params).brand)!;
  const { query, filters, valid } = parseSearch(await searchParams, brand.defaultOrigin);
  return (
    <>
      <Card className="p-4">
        <Suspense fallback={<SearchFormSkeleton />}>
          <SearchFormLoader values={query} compact />
        </Suspense>
      </Card>
      {valid ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <Filters q={query} f={filters} />
          <Suspense key={toParams(query, filters)} fallback={<ResultsSkeleton />}>
            <Results q={query} f={filters} market={brand.market} />
          </Suspense>
        </div>
      ) : (
        <p className="mt-10 text-center text-muted">Välj ett resmål för att se resor.</p>
      )}
    </>
  );
}

// ---------- filters: plain links, so they work without JS and every state has a URL ----------

function Filters({ q, f }: { q: SearchQuery; f: SearchFilters }) {
  const link = (change: Record<string, string | undefined>) => `/sok?${toParams(q, f, { ...change, limit: undefined })}`;
  return (
    <aside className="space-y-5" aria-label="Filter">
      <FilterGroup title="Sortera">
        <Opt on={!f.sort} href={link({ sort: undefined })}>Lägsta pris</Opt>
        <Opt on={f.sort === "starsDesc"} href={link({ sort: "starsDesc" })}>Flest stjärnor</Opt>
      </FilterGroup>
      <FilterGroup title="Kost">
        <Opt on={!f.board} href={link({ board: undefined })}>Alla</Opt>
        {[
          ["BedAndBreakfast", "Frukost"],
          ["HalfBoard", "Halvpension"],
          ["AllInclusive", "All inclusive"],
          ["RoomOnly", "Endast logi"],
        ].map(([v, l]) => (
          <Opt key={v} on={f.board === v} href={link({ board: v })}>{l}</Opt>
        ))}
      </FilterGroup>
      <FilterGroup title="Hotell">
        <Opt on={!f.minStars} href={link({ stars: undefined })}>Alla</Opt>
        {[3, 4, 5].map((s) => (
          <Opt key={s} on={f.minStars === s} href={link({ stars: String(s) })}>{s} stjärnor eller fler</Opt>
        ))}
      </FilterGroup>
      <FilterGroup title="Övrigt">
        <Opt on={!!f.direct} href={link({ direct: f.direct ? undefined : "1" })}>Bara direktflyg</Opt>
        <Opt on={f.bags === "checked"} href={link({ bags: f.bags === "checked" ? undefined : "checked" })}>Incheckat bagage ingår</Opt>
        <Opt on={!!f.refundable} href={link({ refundable: f.refundable ? undefined : "1" })}>Fri avbokning av hotellet</Opt>
      </FilterGroup>
    </aside>
  );
}

function Opt({ on, href, children }: { on: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={cn("flex items-center justify-between rounded-control px-3 py-2 text-sm hover:bg-primary-soft", on && "bg-primary-soft font-semibold text-primary")}
    >
      {children}
      {on && <Check className="size-4" aria-hidden />}
    </Link>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

// ---------- results: prices first, photos stream in when hotel content arrives ----------

async function Results({ q, f, market }: { q: SearchQuery; f: SearchFilters; market: string }) {
  let raw;
  try {
    raw = await api.search(q, f, market);
  } catch (e) {
    return <SearchError error={e} />;
  }
  const view = mapSearch(raw, q, f);
  const keys = raw.packages.map((p) => p.hotelKey);
  const images = keys.length
    ? api.content(keys, env.contentLanguage).then((c) => mapCardImages(raw, c), () => ({}) as Record<string, string | null>)
    : Promise.resolve({} as Record<string, string | null>);

  return (
    <section aria-label="Resor">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {view.total} resor till {view.destination}
        </h1>
        <p className="text-sm text-muted">
          {dateLong(q.depart)} · {nightsLabel(q.nights)} · {party(q.adults, q.childAges.length)} · pris för alla resenärer
        </p>
      </div>
      {view.testFlights && <TestModeNote />}
      {view.cards.length === 0 ? (
        <Card className="p-8 text-center text-muted">Inga resor matchar filtren. Prova att ta bort ett filter.</Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {view.cards.map((c) => (
            <li key={c.id}>
              <ResultCardView card={c} images={images} />
            </li>
          ))}
        </ol>
      )}
      {view.shown < view.total && (
        <div className="mt-6 text-center">
          <ButtonLink variant="outline" href={`/sok?${toParams(q, f, { limit: String(Math.min(100, (f.limit ?? 20) + 20)) })}`} scroll={false}>
            Visa fler resor
          </ButtonLink>
        </div>
      )}
    </section>
  );
}

function ResultCardView({ card, images }: { card: ResultCard; images: Promise<Record<string, string | null>> }) {
  const href = `/resa/${card.ref}`;
  return (
    <Card className="group grid overflow-hidden transition-shadow hover:shadow-[0_8px_28px_rgba(16,40,60,0.12)] sm:grid-cols-[260px_1fr]">
      <Link href={href} tabIndex={-1} aria-hidden className="relative block aspect-[4/3] bg-canvas sm:aspect-auto">
        <Suspense fallback={<div className="skeleton absolute inset-0" />}>
          <CardImage images={images} k={card.imageKey} alt={card.hotel.name} />
        </Suspense>
      </Link>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <h2 className="text-lg font-bold leading-snug">
              <Link href={href} className="hover:text-primary">
                {card.hotel.name}
              </Link>
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {card.hotel.stars ? <Stars n={card.hotel.stars} /> : card.hotel.kind && <span>{card.hotel.kind}</span>}
              {card.hotel.area && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {card.hotel.area}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="brand">{card.board}</Badge>
            {card.refundable && <Badge tone="good">Fri avbokning</Badge>}
            {card.direct && <Badge>Direktflyg</Badge>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {card.flight.legs.map((leg, i) => (
              <FlightLine key={i} leg={leg} label={i === 0 ? "Ut" : "Hem"} />
            ))}
          </div>
          <div>
            <p className="text-xs text-muted">
              {card.flight.airline} · {card.bags}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-end justify-between gap-3 border-t border-line pt-3 sm:flex-col sm:border-0 sm:pt-0">
          <div className="sm:text-right">
            <p className="text-2xl font-bold tabular-nums">{money(card.price)}</p>
            <p className="text-sm text-muted">{money(card.perPerson)} per person</p>
            {card.payAtHotel && <p className="text-xs text-muted">+ ca {money(card.payAtHotel)} i skatt på hotellet</p>}
          </div>
          <ButtonLink href={href}>Välj</ButtonLink>
        </div>
      </div>
    </Card>
  );
}

async function CardImage({ images, k, alt }: { images: Promise<Record<string, string | null>>; k: string; alt: string }) {
  const src = (await images)[k];
  if (!src)
    return (
      <div className="absolute inset-0 grid place-items-center text-muted">
        <ImageOff className="size-6" aria-hidden />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />;
}

function SearchError({ error }: { error: unknown }) {
  const kind = error instanceof ApiError ? error.kind : "Unavailable";
  const text =
    kind === "BadRequest"
      ? "Sökningen kunde inte tolkas. Kontrollera datum och resmål."
      : "Vi kunde inte hämta resor just nu. Försök igen om en liten stund.";
  return <Card className="p-8 text-center text-muted">{text}</Card>;
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Söker resor">
      <div className="skeleton h-8 w-72 rounded" />
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} className="grid overflow-hidden sm:grid-cols-[260px_1fr]">
          <div className="skeleton aspect-[4/3] sm:aspect-auto sm:h-48" />
          <div className="space-y-3 p-4">
            <div className="skeleton h-5 w-1/2 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <>
      <Card className="p-4">
        <SearchFormSkeleton />
      </Card>
      <div className="mt-6">
        <ResultsSkeleton />
      </div>
    </>
  );
}
