import "server-only";

import type { Coupon, RewardRule } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { applyBps } from "@/lib/money";
import { PREMIUM_DISCOUNT_BPS, qualifiesForPremiumDiscount } from "@/lib/config";
import { hasPremium } from "@/lib/services/premium";
import { getTrophyLevel } from "@/lib/services/trophies";

export type DiscountResult = {
  discountCents: number;
  source: string;
  label: string;
  coupon?: Pick<Coupon, "id" | "code" | "description" | "maxPerUser">;
  rule?: RewardRule;
};

function capDiscount(raw: number, subtotalCents: number, maxDiscountCents?: number | null): number {
  return Math.max(0, Math.min(subtotalCents, maxDiscountCents ?? Number.MAX_SAFE_INTEGER, raw));
}

export function couponDiscount(coupon: Pick<Coupon, "discountType" | "value" | "maxDiscountCents">, subtotalCents: number) {
  const raw = coupon.discountType === "PERCENT" ? applyBps(subtotalCents, coupon.value) : coupon.value;
  return capDiscount(raw, subtotalCents, coupon.maxDiscountCents);
}

export function rewardDiscount(rule: Pick<RewardRule, "discountBps" | "maxDiscountCents">, subtotalCents: number) {
  return capDiscount(applyBps(subtotalCents, rule.discountBps), subtotalCents, rule.maxDiscountCents);
}

/**
 * Montant de l'avantage Prestige sur un article à plus de 10 000 €.
 * Fonction pure : utilisable pour l'affichage comme pour les tests.
 * Le montant final reste recalculé côté serveur à la commande.
 */
export function premiumDiscountCents(itemPriceCents: number): number {
  if (!qualifiesForPremiumDiscount(itemPriceCents)) return 0;
  return Math.min(itemPriceCents, applyBps(itemPriceCents, PREMIUM_DISCOUNT_BPS));
}

/** Avantage Prestige automatique, réservé aux abonnés actifs (essai inclus). */
export async function getPremiumDiscount(
  userId: string,
  itemPriceCents: number,
  premium?: boolean,
): Promise<DiscountResult | null> {
  const discountCents = premiumDiscountCents(itemPriceCents);
  if (discountCents <= 0) return null;
  if (!(premium ?? (await hasPremium(userId)))) return null;
  return {
    discountCents,
    source: "PREMIUM:HIGH_VALUE_15",
    label: "Avantage Prestige −15 %",
  };
}

/**
 * Valide un code promo côté serveur. Ne jamais faire confiance au montant
 * calculé par le navigateur.
 */
export async function validateCoupon(
  code: string,
  userId: string,
  subtotalCents: number,
  now = new Date(),
): Promise<DiscountResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new AppError("VALIDATION", "Code promo vide.");
  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.isActive) throw new AppError("VALIDATION", "Ce code promo n'existe pas ou n'est plus actif.");
  if (coupon.startsAt && coupon.startsAt > now) throw new AppError("VALIDATION", "Ce code promo n'est pas encore valable.");
  if (coupon.endsAt && coupon.endsAt < now) throw new AppError("VALIDATION", "Ce code promo a expiré.");
  if (coupon.minOrderCents > subtotalCents) {
    throw new AppError("VALIDATION", `Ce code nécessite un minimum de ${(coupon.minOrderCents / 100).toFixed(2)} €.`);
  }
  if (coupon.premiumOnly && !(await hasPremium(userId))) {
    throw new AppError("PAYMENT_REQUIRED", "Ce code est réservé aux membres A2V Prestige.");
  }
  if (coupon.trophyLevelRequired > 0) {
    const { level } = await getTrophyLevel(userId);
    if (level < coupon.trophyLevelRequired) {
      throw new AppError("FORBIDDEN", "Votre niveau de trophées ne permet pas encore d'utiliser ce code.");
    }
  }

  const [totalUses, userUses] = await Promise.all([
    prisma.couponRedemption.count({ where: { couponId: coupon.id } }),
    prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } }),
  ]);
  if (coupon.maxRedemptions !== null && totalUses >= coupon.maxRedemptions) {
    throw new AppError("CONFLICT", "Ce code promo a atteint sa limite d'utilisation.");
  }
  if (coupon.maxPerUser > 0 && userUses >= coupon.maxPerUser) {
    throw new AppError("CONFLICT", "Vous avez déjà utilisé ce code promo.");
  }

  const discountCents = couponDiscount(coupon, subtotalCents);
  if (discountCents <= 0) throw new AppError("VALIDATION", "Ce code n'applique aucune réduction sur cette commande.");

  return {
    discountCents,
    source: `COUPON:${coupon.code}`,
    label: `Code ${coupon.code}`,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      maxPerUser: coupon.maxPerUser,
    },
  };
}

/**
 * Meilleure réduction automatique liée aux trophées (une seule applicable).
 * Les pourcentages, plafonds et seuils sont administrables (RewardRule).
 */
export async function getBestReward(
  userId: string,
  subtotalCents: number,
  now = new Date(),
): Promise<DiscountResult | null> {
  const [{ count, level }, premium] = await Promise.all([getTrophyLevel(userId), hasPremium(userId)]);
  if (count === 0) return null;

  const rules = await prisma.rewardRule.findMany({
    where: {
      isActive: true,
      minTrophyCount: { lte: count },
      minTrophyLevel: { lte: level },
      minOrderCents: { lte: subtotalCents },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });

  const eligible = rules.filter((rule) => !rule.premiumOnly || premium);
  if (eligible.length === 0) return null;

  let best: { rule: RewardRule; discountCents: number } | null = null;
  for (const rule of eligible) {
    const discountCents = rewardDiscount(rule, subtotalCents);
    if (discountCents <= 0) continue;
    if (!best || discountCents > best.discountCents) best = { rule, discountCents };
  }
  if (!best) return null;

  return {
    discountCents: best.discountCents,
    source: `REWARD:${best.rule.code}`,
    label: best.rule.name,
    rule: best.rule,
  };
}

/**
 * Réduction combinée : jamais de cumul automatique. La réduction la plus
 * avantageuse est retenue entre l'avantage Prestige, un code promo fourni et
 * la récompense trophée. La réduction est plafonnée au prix article.
 */
export async function resolveDiscount(input: {
  userId: string;
  subtotalCents: number;
  couponCode?: string | null;
  now?: Date;
}): Promise<DiscountResult | null> {
  const premiumDiscount = await getPremiumDiscount(input.userId, input.subtotalCents);

  if (input.couponCode?.trim()) {
    const coupon = await validateCoupon(input.couponCode, input.userId, input.subtotalCents, input.now ?? new Date());
    return premiumDiscount && premiumDiscount.discountCents > coupon.discountCents ? premiumDiscount : coupon;
  }

  const reward = await getBestReward(input.userId, input.subtotalCents, input.now ?? new Date());
  if (premiumDiscount && premiumDiscount.discountCents > (reward?.discountCents ?? 0)) {
    return premiumDiscount;
  }
  return reward;
}
