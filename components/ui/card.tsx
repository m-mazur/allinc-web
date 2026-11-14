import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-line bg-surface shadow-card", className)} {...p} />;
}

/** Quiet grey box for facts ("Lägsta pris", "Avresa"), as on the reference hotel page. */
export function Panel({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-card bg-panel", className)} {...p} />;
}
