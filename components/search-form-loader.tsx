import { getReference } from "@/lib/server/reference";
import { SearchForm, type SearchFormValues } from "./search-form";

/** Server part of the search form: loads the places it offers. */
export async function SearchFormLoader({ values, compact }: { values: SearchFormValues; compact?: boolean }) {
  const ref = await getReference().catch(() => null);
  if (!ref) return <p className="text-sm text-muted">Sökningen är inte tillgänglig just nu. Försök igen om en stund.</p>;
  return <SearchForm origins={ref.origins} destinations={ref.destinations} values={values} compact={compact} />;
}

export function SearchFormSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto]" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="skeleton h-3 w-12 rounded" />
          <div className="skeleton h-12 rounded-control" />
        </div>
      ))}
    </div>
  );
}
