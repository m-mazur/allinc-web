"use client";

import { CalendarDays, MapPin, Moon, PlaneTakeoff, Search, UsersRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { dateLong } from "@/lib/format";

// The search console: one white bar, five fields with an icon and a bold value, a square search
// button. A plain GET form to /sok, so it works without JavaScript and the URL is the search.

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
  /** "hero": floats on the hero photo. "bar": bordered, on white (results and hotel pages). */
  variant?: "hero" | "bar";
};

const control =
  "w-full min-w-0 appearance-none truncate bg-transparent text-base font-bold text-ink outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full";

function Field({ icon, label, children, className }: { icon: ReactNode; label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("relative flex min-w-0 items-center gap-2.5 rounded-control px-3.5 py-3 hover:bg-panel focus-within:bg-panel", className)}>
      <span className="shrink-0 text-ink/70">{icon}</span>
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}

const nightOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function SearchForm({ origins, destinations, values, variant = "hero" }: Props) {
  const [adults, setAdults] = useState(values.adults);
  const [depart, setDepart] = useState(values.depart);
  const [ages, setAges] = useState<number[]>(values.childAges);
  const countries = [...new Set(destinations.map((d) => d.country))];
  const today = new Date().toISOString().slice(0, 10);
  const party = `${adults} ${adults === 1 ? "vuxen" : "vuxna"}${ages.length ? `, ${ages.length} barn` : ""}`;
  const icon = "size-[18px]";

  return (
    <form
      action="/sok"
      method="get"
      className={cn(
        "flex flex-col gap-1 rounded-control bg-surface p-2 lg:flex-row lg:items-center",
        variant === "bar" && "border border-line shadow-card",
      )}
    >
      <Field icon={<MapPin className={icon} aria-hidden />} label="Vart vill du resa?" className="lg:flex-[1.3]">
        <select name="to" defaultValue={values.to} required className={control}>
          <option value="" disabled>
            Vart vill du resa?
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
      </Field>
      <Field icon={<PlaneTakeoff className={icon} aria-hidden />} label="Från" className="lg:flex-[1.2]">
        <select name="from" defaultValue={values.from} className={control}>
          {origins.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field icon={<CalendarDays className={icon} aria-hidden />} label="Avresa" className="lg:flex-1">
        {/* Shown as "sön 13 dec."; the native date input sits on top, invisible, and opens the picker. */}
        <span className="truncate text-base font-bold">{depart ? dateLong(depart) : "Välj datum"}</span>
        <input
          type="date"
          name="depart"
          value={depart}
          min={today}
          required
          onChange={(e) => setDepart(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </Field>
      <Field icon={<Moon className={icon} aria-hidden />} label="Antal nätter" className="lg:flex-[0.7]">
        <select name="nights" defaultValue={values.nights} className={control}>
          {nightOptions.map((n) => (
            <option key={n} value={n}>
              {n} nätter
            </option>
          ))}
        </select>
      </Field>

      {/* Travellers: a disclosure with adults, children and ages. */}
      <details className="group relative lg:flex-[1.1]">
        <summary className="flex items-center gap-2.5 rounded-control px-3.5 py-3 hover:bg-panel">
          <UsersRound className={`${icon} shrink-0 text-ink/70`} aria-hidden />
          <span className="sr-only">Resenärer: </span>
          <span className="truncate text-base font-bold">{party}</span>
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-card border border-line bg-surface p-4 shadow-float">
          <Counter label="Vuxna" hint="18 år och äldre" value={adults} min={1} max={6} onChange={setAdults} />
          <Counter
            label="Barn"
            hint="0–17 år"
            value={ages.length}
            min={0}
            max={4}
            onChange={(n) => setAges((a) => (n > a.length ? [...a, ...Array(n - a.length).fill(7)] : a.slice(0, n)))}
          />
          {ages.length > 0 && (
            <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
              {ages.map((age, i) => (
                <label key={i} className="text-xs text-muted">
                  Ålder barn {i + 1}
                  <select
                    value={age}
                    onChange={(e) => setAges((a) => a.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                    className="mt-1 h-9 w-full rounded-control border border-line bg-surface px-2 text-sm text-ink"
                  >
                    {Array.from({ length: 18 }, (_, n) => (
                      <option key={n} value={n}>
                        {n} år
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      </details>
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="children" value={ages.join(",")} />

      <button
        type="submit"
        aria-label="Sök resa"
        className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-6 font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:w-[70px] lg:px-0"
      >
        <Search className="size-5" aria-hidden />
        <span className="lg:sr-only">Sök resa</span>
      </button>
    </form>
  );
}

function Counter({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const btn = "grid size-9 place-items-center rounded-full border border-line text-lg font-bold text-primary disabled:text-line";
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Färre ${label.toLowerCase()}`}>
          −
        </button>
        <span className="w-4 text-center font-bold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Fler ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}
