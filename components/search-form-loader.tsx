import { getReference } from "@/lib/server/reference";
import { SearchForm, type SearchFormValues } from "./search-form";
import { cn } from "@/lib/cn";

/** Server part of the search console: loads the places it offers. */
export async function SearchFormLoader({ values, variant }: { values: SearchFormValues; variant?: "hero" | "bar" }) {
  const ref = await getReference().catch(() => null);
  if (!ref) return <p className="rounded-control bg-surface p-4 text-sm text-muted">Sökningen är inte tillgänglig just nu. Försök igen om en stund.</p>;
  return <SearchForm origins={ref.origins} destinations={ref.destinations} values={values} variant={variant} />;
}

export function SearchFormSkeleton({ variant = "hero" }: { variant?: "hero" | "bar" }) {
  return (
    <div className={cn("flex h-[68px] items-center gap-3 rounded-control bg-surface p-2", variant === "bar" && "border border-line shadow-card")} aria-hidden>
      {[1.3, 1.2, 1, 0.7, 1.1].map((f, i) => (
        <div key={i} className="skeleton h-5 rounded" style={{ flex: f, margin: "0 14px" }} />
      ))}
      <div className="h-[52px] w-[70px] shrink-0 rounded-control bg-primary/80" />
    </div>
  );
}
