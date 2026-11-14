import Link from "next/link";
import { ChevronDown, Menu, UserRound } from "lucide-react";
import type { Brand } from "@/brands";

export function SiteHeader({ brand }: { brand: Brand }) {
  return (
    <header className="bg-surface">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 xl:px-0">
        <Link href="/" className="flex items-center" aria-label={`${brand.name}, till startsidan`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo.src} alt={brand.logo.alt} width={brand.logo.width} height={brand.logo.height} className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-6 text-sm font-bold text-ink" aria-label="Huvudmeny">
          <Link href="/" className="hidden items-center gap-1 hover:text-primary sm:inline-flex">
            Paketresor <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </Link>
          <span className="hidden items-center gap-1 md:inline-flex">
            Resmål <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </span>
          <span className="hidden items-center gap-1 md:inline-flex">
            Kundservice <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </span>
          <span className="flex items-center gap-4 text-muted">
            <UserRound className="size-5" aria-label="Mina resor" />
            <Menu className="size-5" aria-label="Meny" />
          </span>
        </nav>
      </div>
    </header>
  );
}
