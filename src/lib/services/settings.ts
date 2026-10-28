import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AUCTION_EXTENSION_SECONDS, AUCTION_EXTENSION_WINDOW_SECONDS, AUCTION_MAX_EXTENSIONS, COMMISSION_RATE_BPS, FINALIZATION_DELAY_DAYS, PREMIUM, SUGGESTED_DONATION_AMOUNTS } from "@/lib/config";

/**
 * Paramètres métier configurables en base (administration).
 * Chaque lecture retombe sur une valeur par défaut sûre et documentée.
 */
export const SETTING_DEFAULTS = {
  "commission.rateBps": COMMISSION_RATE_BPS,
  /** ITEM_PRICE_BEFORE_DISCOUNT : la réduction trophée est financée par A2V. */
  "commission.base": "ITEM_PRICE_BEFORE_DISCOUNT",
  "premium.priceCents": PREMIUM.priceCents,
  "premium.trialMonths": PREMIUM.trialMonths,
  "donation.minCents": 100,
  "donation.maxCents": 100_000,
  "donation.suggestedCents": [...SUGGESTED_DONATION_AMOUNTS],
  /** Taux de contribution solidaire d'A2V — 0 tant que la politique n'est pas approuvée. */
  "charity.platformContributionBps": 0,
  "auction.paymentDeadlineHours": 48,
  "auction.extensionWindowSeconds": AUCTION_EXTENSION_WINDOW_SECONDS,
  "auction.extensionSeconds": AUCTION_EXTENSION_SECONDS,
  "auction.maxExtensions": AUCTION_MAX_EXTENSIONS,
  "auction.minIncrementCents": 100,
  "order.finalizationDelayDays": FINALIZATION_DELAY_DAYS,
  "shipping.simulationEnabled": true,
  "messaging.maxMessagesPerHour": 30,
  "platform.supportEmail": "support@a2v.example",
  "platform.legalName": "A2V SAS (dénomination à confirmer)",
  "platform.legalAddress": "Adresse du siège à compléter",
  "platform.siret": "SIRET à compléter",
  "platform.publicationDirector": "À compléter",
  "platform.vatNumber": "TVA intracommunautaire à compléter",
  "charity.collectedDisclosure": "Les montants affichés proviennent des paiements confirmés et des versements enregistrés.",
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const record = await prisma.platformSetting.findUnique({ where: { key } }).catch(() => null);
  if (!record) return SETTING_DEFAULTS[key];
  const value = record.value as unknown;
  if (value === null || value === undefined) return SETTING_DEFAULTS[key];
  return value as (typeof SETTING_DEFAULTS)[K];
}

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<Pick<typeof SETTING_DEFAULTS, K>> {
  const records = await prisma.platformSetting
    .findMany({ where: { key: { in: keys } } })
    .catch(() => []);
  const found = new Map(records.map((record) => [record.key, record.value]));
  const result = {} as Pick<typeof SETTING_DEFAULTS, K>;
  for (const key of keys) {
    result[key] = (found.has(key) ? found.get(key) : SETTING_DEFAULTS[key]) as (typeof SETTING_DEFAULTS)[K];
  }
  return result;
}

export async function setSetting(key: SettingKey, value: unknown, description?: string) {
  if (key === "commission.rateBps") {
    const rate = Number(value);
    if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) {
      throw new Error("Le taux de commission doit être un entier entre 0 et 10000 points de base.");
    }
  }
  return prisma.platformSetting.upsert({
    where: { key },
    update: { value: value as object, ...(description ? { description } : {}) },
    create: { key, value: value as object, description },
  });
}

export async function getAllSettings() {
  const records = await prisma.platformSetting.findMany({ orderBy: { key: "asc" } });
  const map = new Map(records.map((record) => [record.key, record.value]));
  return Object.entries(SETTING_DEFAULTS).map(([key, fallback]) => ({
    key,
    value: map.has(key) ? map.get(key) : fallback,
    isDefault: !map.has(key),
  }));
}

export function publicLegalConfig() {
  return {
    legalName: SETTING_DEFAULTS["platform.legalName"],
    legalAddress: SETTING_DEFAULTS["platform.legalAddress"],
    siret: SETTING_DEFAULTS["platform.siret"],
    supportEmail: SETTING_DEFAULTS["platform.supportEmail"],
    appUrl: env.APP_URL,
  };
}
