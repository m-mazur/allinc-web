import type { Brand } from "@/brands";

export function SiteFooter({ brand }: { brand: Brand }) {
  const col = "space-y-3 text-sm";
  const head = "text-sm font-bold text-ink";
  return (
    <footer className="mt-20 bg-panel">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr] xl:px-0">
        <div className={col}>
          <p className={head}>Hjälp och information</p>
          <p className="text-ink/80">Kontakta oss</p>
          <p className="text-ink/80">Inför resan</p>
          {brand.contact.email && <p className="text-ink/80">{brand.contact.email}</p>}
        </div>
        <div className={col}>
          <p className={head}>Villkor</p>
          <p className="text-ink/80">Integritetspolicy</p>
          <p className="text-ink/80">Resevillkor</p>
        </div>
        <div className={col}>
          <p className={head}>Boka tryggt</p>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Flyg och hotell som bokas tillsammans hos {brand.name} är en paketresa enligt paketreselagen. Du har en
            arrangör att vända dig till, och resan skyddas av resegaranti.
          </p>
        </div>
        <p className="text-xs text-muted sm:col-span-2 lg:col-span-3">© {brand.name}</p>
      </div>
    </footer>
  );
}
