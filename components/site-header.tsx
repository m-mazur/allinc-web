import Link from "next/link";
import type { Brand } from "@/brands";

export function SiteHeader({ brand }: { brand: Brand }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center" aria-label={`${brand.name}, till startsidan`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo.src} alt={brand.logo.alt} width={brand.logo.width} height={brand.logo.height} className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-muted">
          <Link href="/" className="hover:text-ink">Paketresor</Link>
          <span className="hidden sm:inline">Kundservice</span>
        </nav>
      </div>
    </header>
  );
}
