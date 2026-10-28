import { describe, expect, it } from "vitest";
import { premiumDiscountCents } from "@/lib/services/coupons";
import { qualifiesForPremiumDiscount, requiresPremiumAccess } from "@/lib/config";

/**
 * Seuil A2V Prestige : 10 000 € (1 000 000 centimes), strict.
 * - accès : au-delà, l'annonce est réservée aux membres ;
 * - avantage : 15 % sur les articles au-delà du même seuil.
 */
describe("seuil d'accès Prestige 10 000 €", () => {
  it("réserve l'annonce au-delà de 10 000 €", () => {
    expect(requiresPremiumAccess(1_000_001)).toBe(true);
    expect(requiresPremiumAccess(1_500_000)).toBe(true);
  });

  it("laisse l'annonce publique à exactement 10 000 €", () => {
    expect(requiresPremiumAccess(1_000_000)).toBe(false);
  });

  it("laisse l'annonce publique en dessous du seuil", () => {
    expect(requiresPremiumAccess(999_999)).toBe(false);
    expect(requiresPremiumAccess(100_000)).toBe(false);
    expect(requiresPremiumAccess(0)).toBe(false);
  });

  it("ignore les montants non entiers ou non finis", () => {
    expect(requiresPremiumAccess(Number.NaN)).toBe(false);
    expect(requiresPremiumAccess(Number.POSITIVE_INFINITY)).toBe(false);
    expect(requiresPremiumAccess(1_000_000.5)).toBe(false);
  });
});

describe("avantage Prestige 15 %", () => {
  it("applique 15 % à un article juste au-dessus de 10 000 €", () => {
    expect(premiumDiscountCents(1_000_001)).toBe(150_000);
    expect(premiumDiscountCents(2_500_000)).toBe(375_000);
  });

  it("ne s'applique pas à exactement 10 000 €", () => {
    expect(qualifiesForPremiumDiscount(1_000_000)).toBe(false);
    expect(premiumDiscountCents(1_000_000)).toBe(0);
  });

  it("ne s'applique pas sous le seuil", () => {
    expect(premiumDiscountCents(999_999)).toBe(0);
    expect(premiumDiscountCents(0)).toBe(0);
  });

  it("ignore les montants non entiers ou non finis", () => {
    expect(premiumDiscountCents(Number.NaN)).toBe(0);
    expect(premiumDiscountCents(Number.POSITIVE_INFINITY)).toBe(0);
    expect(premiumDiscountCents(1_000_001.5)).toBe(0);
  });

  it("ne dépasse jamais le prix de l'article", () => {
    const discount = premiumDiscountCents(1_200_000);
    expect(discount).toBeLessThanOrEqual(1_200_000);
    expect(discount).toBe(180_000);
  });

  it("reste strictement inférieur au prix, donc le total acheteur reste positif", () => {
    for (const price of [1_000_001, 1_001_000, 9_999_999, 50_000_000]) {
      expect(premiumDiscountCents(price)).toBeLessThan(price);
    }
  });
});
