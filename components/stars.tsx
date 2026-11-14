import { Star } from "lucide-react";

/** Five stars, filled up to the rating, grey after: the reference's star row. */
export function Stars({ n, size = "sm" }: { n: number | null; size?: "sm" | "md" }) {
  if (!n) return null;
  const full = Math.round(n);
  const cls = size === "md" ? "size-4" : "size-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} stjärnor`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`${cls} ${i < full ? "fill-star text-star" : "fill-line text-line"}`} aria-hidden />
      ))}
    </span>
  );
}
