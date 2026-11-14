import { Star } from "lucide-react";

export function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  const full = Math.round(n);
  return (
    <span className="inline-flex items-center gap-0.5 text-accent" role="img" aria-label={`${n} stjärnor`}>
      {Array.from({ length: full }, (_, i) => (
        <Star key={i} className="size-3.5 fill-current" aria-hidden />
      ))}
    </span>
  );
}
