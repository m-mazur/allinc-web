import { Plane } from "lucide-react";
import { dateLong } from "@/lib/format";

type Leg = { from: string; to: string; departs: string; arrives: string; date: string; stops: number; via: string[]; duration: string };

export function FlightLine({ leg, label }: { leg: Leg; label: string }) {
  const home = label === "Hem";
  return (
    <div className="flex gap-2.5 text-sm">
      <Plane className={`mt-0.5 size-4 shrink-0 text-muted ${home ? "rotate-180" : ""}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted">
          {label} · {dateLong(leg.date)}
        </p>
        <p className="whitespace-nowrap font-semibold tabular-nums">
          {leg.departs} {leg.from} <span className="font-normal text-muted">→</span> {leg.arrives} {leg.to}
        </p>
        <p className="text-xs text-muted">
          {leg.stops === 0 ? "Direkt" : `${leg.stops} byte${leg.via.length ? ` i ${leg.via.join(", ")}` : ""}`}
          {leg.duration && ` · ${leg.duration}`}
        </p>
      </div>
    </div>
  );
}
