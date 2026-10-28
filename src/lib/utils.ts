import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MARKET } from "@/lib/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 70);
}

export function formatDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(MARKET.locale, {
    timeZone: MARKET.timezone,
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, { dateStyle: "medium", timeStyle: "short" });
}

export function formatShortDate(date: Date | string | null | undefined): string {
  return formatDate(date, { day: "2-digit", month: "short", year: "numeric" });
}

export function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `il y a ${days} j`;
  return formatShortDate(date);
}

export function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function truncate(value: string, max = 160): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function absoluteUrl(path = "/"): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}

export function safeRedirectPath(value: unknown, fallback = "/compte"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function paginate(page: number, pageSize: number) {
  const safePage = Math.max(1, Math.floor(page || 1));
  return { page: safePage, pageSize, skip: (safePage - 1) * pageSize, take: pageSize };
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
