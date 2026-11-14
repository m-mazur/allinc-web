import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  accent: "bg-accent text-on-accent hover:brightness-95",
  outline: "border border-line bg-surface text-ink hover:border-primary hover:text-primary",
  ghost: "text-primary hover:bg-primary-soft",
};
const sizes = { md: "h-11 px-5 text-sm", lg: "h-13 px-7 text-base", sm: "h-9 px-3 text-sm" };

type Style = { variant?: keyof typeof variants; size?: keyof typeof sizes };
const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & Style) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...p} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & Style) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...p} />;
}
