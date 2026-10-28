import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:ring-brand-300 disabled:bg-brand-300",
  secondary:
    "bg-brand-100 text-brand-800 hover:bg-brand-200 focus-visible:ring-brand-300 disabled:opacity-60",
  outline:
    "border border-brand-200 bg-white text-ink hover:border-brand-400 hover:bg-brand-50 focus-visible:ring-brand-200",
  ghost: "text-ink hover:bg-brand-50 focus-visible:ring-brand-200",
  danger: "bg-danger text-white hover:bg-red-700 focus-visible:ring-red-300",
  success: "bg-success text-white hover:bg-green-700 focus-visible:ring-green-300",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
  icon: "h-10 w-10",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
