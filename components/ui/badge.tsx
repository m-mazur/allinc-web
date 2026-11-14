import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-canvas text-muted",
  good: "bg-[color-mix(in_srgb,var(--color-success)_12%,white)] text-success",
  brand: "bg-primary-soft text-primary",
  sun: "bg-accent text-on-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}
