import { MARKET } from "@/lib/config";

/**
 * Utilitaires monétaires. Tous les montants sont des entiers de centimes.
 */
export function formatMoney(cents: number, currency = MARKET.currency, locale = MARKET.locale): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatMoneyShort(cents: number, locale = MARKET.locale): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: MARKET.currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function parseEurosToCents(value: string | number): number {
  const normalized = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(normalized)) throw new Error("Montant invalide");
  return Math.round(normalized * 100);
}

export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Applique un pourcentage en points de base (bps) avec arrondi commercial au centime. */
export function applyBps(cents: number, bps: number): number {
  if (cents < 0) throw new Error("Montant négatif interdit");
  return Math.round((cents * bps) / 10_000);
}

export function clampCents(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function percentLabel(bps: number): string {
  const percent = bps / 100;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(percent)} %`;
}
