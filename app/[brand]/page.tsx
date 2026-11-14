import { Suspense } from "react";
import { connection } from "next/server";
import { BadgeCheck, Plane, Wallet } from "lucide-react";
import { getBrand } from "@/brands";
import { SearchFormLoader, SearchFormSkeleton } from "@/components/search-form-loader";
import { defaultValues } from "@/lib/server/defaults";

export default async function Home({ params }: PageProps<"/[brand]">) {
  const brand = getBrand((await params).brand)!;
  return (
    <main>
      <section className="relative overflow-hidden bg-[linear-gradient(160deg,var(--brand-hero-from),var(--brand-hero-to))] text-white">
        <HeroArt />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-16 sm:pt-24">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Res bort, allt ingår.</h1>
          <p className="mt-3 max-w-xl text-lg text-white/90">{brand.tagline}</p>
        </div>
      </section>
      <section className="relative mx-auto -mt-20 max-w-6xl px-4">
        <div className="rounded-card bg-surface p-5 shadow-[0_12px_40px_rgba(16,40,60,0.14)] sm:p-6">
          <Suspense fallback={<SearchFormSkeleton />}>
            <HomeSearch origin={brand.defaultOrigin} />
          </Suspense>
        </div>
      </section>
      <section className="mx-auto mt-14 grid max-w-6xl gap-6 px-4 sm:grid-cols-3">
        {[
          { icon: Wallet, title: "Ett pris för allt", text: "Flyg och hotell i samma pris, utan påslag i kassan." },
          { icon: Plane, title: "Byt flyg eller rum", text: "Se direkt vad ett annat flyg eller frukost kostar." },
          { icon: BadgeCheck, title: "Paketreseskydd", text: "Paketresa enligt paketreselagen, med resegaranti." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

async function HomeSearch({ origin }: { origin: string }) {
  await connection();
  return <SearchFormLoader values={defaultValues(origin)} />;
}

/** Sun over the sea, drawn: stands in for editorial photography until we have it. */
function HeroArt() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <circle cx="960" cy="150" r="90" fill="var(--brand-accent)" opacity="0.95" />
      <path d="M0 300 C200 270 360 330 600 300 S1000 270 1200 295 V420 H0Z" fill="#fff" opacity="0.12" />
      <path d="M0 340 C240 315 420 370 640 345 S1010 320 1200 345 V420 H0Z" fill="#fff" opacity="0.16" />
    </svg>
  );
}
