import { AlertTriangle } from "lucide-react";

const TEXT: Record<string, string> = {
  flyg: "Flyget du valde är slutsålt. Här är andra flyg till samma hotell.",
  rum: "Rummet du valde är slutsålt. Här är andra rum på samma hotell.",
  hotell: "Hotellet du valde är slutsålt för dina datum. Här är andra hotell för samma resa.",
};

/** Shown after checkout sent the customer back because something sold out (?slutsalt=flyg|rum|hotell). */
export function SoldOutNote({ what }: { what: string | string[] | undefined }) {
  const text = typeof what === "string" ? TEXT[what] : undefined;
  if (!text) return null;
  return (
    <p role="status" className="my-4 flex items-center gap-2 rounded-control bg-[color-mix(in_srgb,var(--color-accent)_22%,white)] px-4 py-3 text-sm font-bold">
      <AlertTriangle className="size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}
