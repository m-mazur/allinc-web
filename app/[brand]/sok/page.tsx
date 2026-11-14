import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Check, ChevronDown, ImageOff, MapPin, Plane, SlidersHorizontal } from "lucide-react";
import { getBrand } from "@/brands";
import { api, ApiError, type SearchFilters, type SearchQuery } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { parseSearch, toParams, type SP } from "@/lib/server/search-params";
import { mapCardImages, mapSearch, type ResultCard } from "@/lib/server/view";
import { SearchFormLoader, SearchFormSkeleton } from "@/components/search-form-loader";
import { TestModeNote } from "@/components/test-mode-note";
import { SoldOutNote } from "@/components/sold-out-note";
import { Stars } from "@/components/stars";
import { ButtonLink } from "@/components/ui/button";
import { dateLong, money, nightsLabel, party } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Sök paketresa", robots: { index: false } };

export default function SearchPage({ params, searchParams }: PageProps<"/[brand]/sok">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-4 xl:px-0">
      <Suspense fallback={<SearchSkeleton />}>
        <SearchContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchContent({ params, searchParams }: { params: Promise<{ brand: string }>; searchParams: Promise<SP> }) {
  await connection(); // request-time: reads the clock and calls the API
  const brand = getBrand((await params).brand)!;
  const sp = await searchParams;
  const { query, filters, valid } = parseSearch(sp, brand.defaultOrigin);
  return (
    <>
      <SoldOutNote what={sp.slutsalt} />
      <Suspense fallback={<SearchFormSkeleton variant="bar" />}>
        <SearchFormLoader values={query} variant="bar" />
      </Suspense>
      {valid ? (
        <Suspense key={toParams(query, filters)} fallback={<ResultsSkeleton />}>
          <Results q={query} f={filters} market={brand.market} />
        </Suspense>
      ) : (
        <p className="mt-16 text-center text-muted">Välj ett resmål för att se resor.</p>
      )}
    </>
  );
}

// ---------- filters: pills that open a menu of links (native <details>, works without JS) ----------

function Filters({ q, f }: { q: SearchQuery; f: SearchFilters }) {
  const link = (change: Record<string, string | undefined>) => `/sok?${toParams(q, f, { ...change, limit: undefined })}`;
  const boards: [string, string][] = [
    ["BedAndBreakfast", "Frukost"],
    ["HalfBoard", "Halvpension"],
    ["AllInclusive", "All inclusive"],
    ["RoomOnly", "Endast logi"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filter">
      <Pill label={f.sort === "starsDesc" ? "Flest stjärnor" : "Lägsta pris"} icon={<SlidersHorizontal className="size-4" aria-hidden />} active={false}>
        <Opt on={!f.sort} href={link({ sort: undefined })}>Lägsta pris</Opt>
        <Opt on={f.sort === "starsDesc"} href={link({ sort: "starsDesc" })}>Flest stjärnor</Opt>
      </Pill>
      <Pill label={boards.find(([v]) => v === f.board)?.[1] ?? "Kost"} active={!!f.board}>
        <Opt on={!f.board} href={link({ board: undefined })}>Alla</Opt>
        {boards.map(([v, l]) => (
          <Opt key={v} on={f.board === v} href={link({ board: v })}>{l}</Opt>
        ))}
      </Pill>
      <Pill label={f.minStars ? `${f.minStars}+ stjärnor` : "Stjärnor"} active={!!f.minStars}>
        <Opt on={!f.minStars} href={link({ stars: undefined })}>Alla</Opt>
        {[3, 4, 5].map((s) => (
          <Opt key={s} on={f.minStars === s} href={link({ stars: String(s) })}>{s} stjärnor eller fler</Opt>
        ))}
      </Pill>
      <Toggle on={!!f.direct} href={link({ direct: f.direct ? undefined : "1" })}>Direktflyg</Toggle>
      <Toggle on={f.bags === "checked"} href={link({ bags: f.bags === "checked" ? undefined : "checked" })}>Bagage ingår</Toggle>
      <Toggle on={!!f.refundable} href={link({ refundable: f.refundable ? undefined : "1" })}>Fri avbokning</Toggle>
    </div>
  );
}

const pillCls = "inline-flex h-10 items-center gap-1.5 rounded-full border bg-surface px-4 text-sm font-bold shadow-chip";

function Pill({ label, icon, active, children }: { label: string; icon?: React.ReactNode; active: boolean; children: React.ReactNode }) {
  return (
    <details className="relative">
      <summary className={cn(pillCls, active ? "border-primary text-primary" : "border-line hover:border-primary/40")}>
        {icon}
        {label}
        <ChevronDown className="size-3.5" aria-hidden />
      </summary>
      <div className="absolute left-0 z-20 mt-2 flex w-56 flex-col rounded-card border border-line bg-surface p-1.5 shadow-float">{children}</div>
    </details>
  );
}

function Toggle({ on, href, children }: { on: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} aria-pressed={on} className={cn(pillCls, on ? "border-primary bg-primary-soft text-primary" : "border-line hover:border-primary/40")}>
      {on && <Check className="size-3.5" aria-hidden />}
      {children}
    </Link>
  );
}

function Opt({ on, href, children }: { on: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={cn("flex items-center justify-between rounded-control px-3 py-2 text-sm hover:bg-panel", on && "font-bold text-primary")}
    >
      {children}
      {on && <Check className="size-4" aria-hidden />}
    </Link>
  );
}

// ---------- results: a deal grid. Prices first, photos stream in when hotel content arrives ----------

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
    <section aria-label="Resor" className="mt-8">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl">
            {view.total} resor till {view.destination}
          </h1>
          <p className="text-[15px] text-muted">
            {dateLong(q.depart)} · {nightsLabel(q.nights)} · {party(q.adults, q.childAges.length)} · flyg och hotell
          </p>
        </div>
        <Filters q={q} f={f} />
      </div>
      {view.testFlights && <TestModeNote />}
      {view.cards.length === 0 ? (
        <div className="rounded-card bg-panel p-10 text-center text-muted">Inga resor matchar filtren. Prova att ta bort ett filter.</div>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {view.cards.map((c) => (
            <li key={c.id}>
              <DealCard card={c} images={images} />
            </li>
          ))}
        </ol>
      )}
      {view.shown < view.total && (
        <div className="mt-8 text-center">
          <ButtonLink variant="pill" className="h-[42px] px-8" href={`/sok?${toParams(q, f, { limit: String(Math.min(100, (f.limit ?? 20) + 20)) })}`} scroll={false}>
            Visa fler
          </ButtonLink>
        </div>
      )}
    </section>
  );
}

function DealCard({ card, images }: { card: ResultCard; images: Promise<Record<string, string | null>> }) {
  const href = `/resa/${card.ref}`;
  const out = card.flight.legs[0];
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow hover:shadow-float">
      <Link href={href} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] bg-panel">
        <Suspense fallback={<div className="skeleton absolute inset-0" />}>
          <CardImage images={images} k={card.imageKey} alt={card.hotel.name} />
        </Suspense>
        {card.refundable && (
          <span className="absolute left-2.5 top-2.5 rounded bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-accent">Fri avbokning</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        <h2 className="truncate text-base">
          <Link href={href} className="hover:text-primary">
            {card.hotel.name}
          </Link>
        </h2>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
          <MapPin className="size-3 shrink-0" aria-hidden />
          {[card.hotel.area, card.hotel.city].filter(Boolean).join(", ")}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {card.hotel.stars ? <Stars n={card.hotel.stars} /> : <span className="text-muted">{card.hotel.kind}</span>}
          <span className="rounded bg-primary-soft px-1.5 py-0.5 font-bold text-primary">{card.board}</span>
        </div>
        {out && (
          <p className="mt-2 mb-3 flex items-center gap-1.5 truncate text-xs text-muted">
            <Plane className="size-3 shrink-0" aria-hidden />
            {out.departs} {out.from} → {out.arrives} {out.to} · {out.stops === 0 ? "direkt" : `${out.stops} byte`}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3">
          <p className="leading-tight">
            <span className="text-xs text-muted">fr. </span>
            <span className="text-xl font-bold tabular-nums">{money(card.perPerson)}</span>
            <span className="text-xs text-muted"> /pp</span>
            <span className="block text-[11px] text-muted">{money(card.price)} totalt</span>
          </p>
          <ButtonLink href={href} variant="outline" size="sm" className="px-3.5">
            Visa resa
          </ButtonLink>
        </div>
      </div>
    </article>
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
  return <div className="mt-8 rounded-card bg-panel p-10 text-center text-muted">{text}</div>;
}

function ResultsSkeleton() {
  return (
    <div className="mt-8" aria-busy="true" aria-label="Söker resor">
      <div className="skeleton h-7 w-72 rounded" />
      <div className="skeleton mt-2 h-4 w-96 max-w-full rounded" />
      <p className="mt-4 text-sm text-muted" role="status">
        Vi letar flyg och hotell…
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-card border border-line">
            <div className="skeleton aspect-[16/10]" />
            <div className="space-y-2 p-3.5">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
              <div className="skeleton mt-4 h-8 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <>
      <SearchFormSkeleton variant="bar" />
      <ResultsSkeleton />
    </>
  );
}
