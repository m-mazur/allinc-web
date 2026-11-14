import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "border border-primary bg-primary text-on-primary hover:bg-primary-hover hover:border-primary-hover",
  outline: "border border-primary bg-surface text-primary hover:bg-primary-soft",
  pill: "rounded-full border border-line bg-surface text-ink shadow-chip hover:border-primary/40",
  ghost: "text-primary hover:bg-primary-soft",
};
const sizes = { sm: "h-10 px-3 text-sm", md: "h-11 px-5 text-sm", lg: "h-[52px] px-6 text-base" };

type Style = { variant?: keyof typeof variants; size?: keyof typeof sizes };
const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & Style) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...p} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & Style) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...p} />;
}
