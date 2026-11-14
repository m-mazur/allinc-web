"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

// A plain GET form to /sok: it works without JavaScript, and the URL is the search.
// JS only adds the child-age pickers.

export type SearchFormValues = {
  from: string;
  to: string;
  depart: string;
  nights: number;
  adults: number;
  childAges: number[];
};

type Props = {
  origins: { code: string; label: string }[];
  destinations: { id: string; label: string; country: string }[];
  values: SearchFormValues;
  compact?: boolean;
};

const field = "flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted";
const control =
  "h-12 w-full rounded-control border border-line bg-surface px-3 text-base font-medium normal-case tracking-normal text-ink focus:border-primary focus:outline-2 focus:outline-primary/30";

export function SearchForm({ origins, destinations, values, compact }: Props) {
  const [ages, setAges] = useState<number[]>(values.childAges);
  const countries = [...new Set(destinations.map((d) => d.country))];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action="/sok" method="get" className={cn("grid gap-3", compact ? "md:grid-cols-[1.2fr_1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto]" : "sm:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto]")}>
      <label className={field}>
        Från
        <select name="from" defaultValue={values.from} className={control}>
          {origins.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        Till
        <select name="to" defaultValue={values.to} required className={control}>
          <option value="" disabled>
            Välj resmål
          </option>
          {countries.map((c) => (
            <optgroup key={c} label={c}>
              {destinations
                .filter((d) => d.country === c)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={field}>
        Avresa
        <input type="date" name="depart" defaultValue={values.depart} min={today} required className={control} />
      </label>
      <label className={field}>
        Nätter
        <select name="nights" defaultValue={values.nights} className={control}>
          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        Vuxna
        <select name="adults" defaultValue={values.adults} className={control}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        Barn
        <select
          value={ages.length}
          onChange={(e) => {
            const n = Number(e.target.value);
            setAges((a) => (n > a.length ? [...a, ...Array(n - a.length).fill(7)] : a.slice(0, n)));
          }}
          className={control}
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="children" value={ages.join(",")} />
      <button
        type="submit"
        className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-control bg-primary px-6 font-semibold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Search className="size-5" aria-hidden />
        Sök resa
      </button>
      {ages.length > 0 && (
        <fieldset className="col-span-full flex flex-wrap items-end gap-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Barnens ålder vid hemresan</legend>
          {ages.map((age, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-muted">
              Barn {i + 1}
              <select
                value={age}
                onChange={(e) => setAges((a) => a.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                className="h-10 rounded-control border border-line bg-surface px-2 text-ink"
              >
                {Array.from({ length: 18 }, (_, n) => (
                  <option key={n} value={n}>
                    {n} år
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}
    </form>
  );
}
