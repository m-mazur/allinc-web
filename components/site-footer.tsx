import type { Brand } from "@/brands";

export function SiteFooter({ brand }: { brand: Brand }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
        <p>
          © {brand.name}. {brand.tagline}
        </p>
        {brand.contact.email && <p>{brand.contact.email}</p>}
      </div>
    </footer>
  );
}
