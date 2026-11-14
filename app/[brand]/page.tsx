import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { BadgeCheck, Sun, UtensilsCrossed, Users, Waves } from "lucide-react";
import { getBrand, type Brand } from "@/brands";
import { SearchFormLoader, SearchFormSkeleton } from "@/components/search-form-loader";
import { HeroMedia } from "@/components/hero-media";
import { defaultValues } from "@/lib/server/defaults";
import { cn } from "@/lib/cn";

export default async function Home({ params }: PageProps<"/[brand]">) {
  const brand = getBrand((await params).brand)!;
  return (
    <main className="mx-auto max-w-6xl px-4 xl:px-0">
      <Hero brand={brand} />
      <Themes />
      <section className="mt-14">
        <SectionTitle title="Upptäck resmål" sub="Paketresor med flyg och hotell, ett pris för allt" />
        <Destinations brand={brand} />
      </section>
      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { icon: BadgeCheck, title: "Paketreseskydd", text: "Flyg och hotell i samma bokning, skyddat av paketreselagen." },
          { icon: Users, title: "Byt flyg eller rum", text: "Se direkt vad ett annat flyg, frukost eller fri avbokning kostar." },
          { icon: Sun, title: "Transfer på köpet", text: "Vi föreslår transfer från flygplatsen när du bokar." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3 rounded-card bg-panel p-5">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-base">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Hero({ brand }: { brand: Brand }) {
  return (
    <section className="relative mt-2 overflow-hidden rounded-hero bg-[linear-gradient(165deg,var(--brand-hero-from),var(--brand-hero-to))]">
      {brand.hero ? <HeroMedia {...brand.hero} /> : <HeroArt />}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.30),rgba(0,0,0,0.22)_50%,rgba(0,0,0,0.30))]" aria-hidden />
      <div className="relative flex min-h-[400px] flex-col items-center justify-center px-4 py-12 sm:px-6">
        <h1 className="text-center text-4xl text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.25)] sm:text-[44px]">Res bort, allt ingår</h1>
        <p className="mt-2 text-center text-lg font-medium text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.25)]">{brand.tagline}</p>
        <div className="mt-8 w-full max-w-[1064px]">
          <Suspense fallback={<SearchFormSkeleton />}>
            <HomeSearch origin={brand.defaultOrigin} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function HomeSearch({ origin }: { origin: string }) {
  await connection();
  return <SearchFormLoader values={defaultValues(origin)} />;
}

/** Quick themes under the hero, as pills: each opens a ready search. */
function Themes() {
  const themes = [
    { icon: UtensilsCrossed, label: "All inclusive", href: "/sok?to=tr.antalya&board=AllInclusive" },
    { icon: Waves, label: "Strandsemester", href: "/sok?to=es.mallorca" },
    { icon: Sun, label: "Vintersol", href: "/sok?to=es.tenerife" },
    { icon: BadgeCheck, label: "Fri avbokning", href: "/sok?to=es.barcelona&refundable=1" },
  ];
  return (
    <nav className="mt-6 flex flex-wrap justify-center gap-3" aria-label="Teman">
      {themes.map(({ icon: Icon, label, href }) => (
        <Link
          key={label}
          href={href}
          className="inline-flex h-[42px] items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-bold shadow-chip hover:border-primary/40"
        >
          <Icon className="size-4 text-primary" aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl">{title}</h2>
      <p className="text-[15px] text-muted">{sub}</p>
    </div>
  );
}

// Tiles in the reference's mosaic rhythm: wide, narrow, narrow / narrow, narrow, wide.
const SPANS = ["lg:col-span-2", "", "", "", "", "lg:col-span-2"];
const TONES = [
  "from-[#3db8ee] to-[#1376c4]",
  "from-[#29b6c6] to-[#0f7f9a]",
  "from-[#ffb21f] to-[#f07b1d]",
  "from-[#3b9be8] to-[#2a5fb8]",
  "from-[#f5a524] to-[#d9622b]",
  "from-[#22b3a6] to-[#13708c]",
];

function Destinations({ brand }: { brand: Brand }) {
  return (
    <div className="grid auto-rows-[200px] grid-cols-2 gap-3 lg:grid-cols-4">
      {brand.featured.map((d, i) => (
        <Link
          key={d.id}
          href={`/sok?to=${d.id}&from=${brand.defaultOrigin}`}
          className={cn("group relative overflow-hidden rounded-card bg-gradient-to-br", TONES[i % TONES.length], SPANS[i % SPANS.length])}
        >
          {d.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <TileArt seed={i} />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.45))]" aria-hidden />
          <span className="absolute left-3 top-3 rounded bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-accent">{d.tag}</span>
          <span className="absolute bottom-3 left-4 text-white">
            <span className="block text-lg font-bold">{d.label}</span>
            <span className="text-sm text-white/90">Se resor</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Sun over the sea, drawn: stands in for photography until we have our own. */
function HeroArt() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <circle cx="930" cy="120" r="78" fill="var(--brand-accent)" opacity="0.95" />
      <path d="M0 300 C200 270 360 330 600 300 S1000 270 1200 295 V420 H0Z" fill="#fff" opacity="0.12" />
      <path d="M0 345 C240 320 420 375 640 350 S1010 325 1200 350 V420 H0Z" fill="#fff" opacity="0.16" />
    </svg>
  );
}

function TileArt({ seed }: { seed: number }) {
  const cx = [80, 20, 70, 30, 85, 50][seed % 6];
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <circle cx={cx} cy="18" r="9" fill="#fff" opacity="0.35" />
      <path d="M0 44 C20 40 35 48 55 44 S85 40 100 43 V60 H0Z" fill="#fff" opacity="0.14" />
    </svg>
  );
}
