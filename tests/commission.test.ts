import { describe, expect, it } from "vitest";
import { computeCommission } from "@/lib/services/orders";

/**
 * Règles de commission A2V :
 * - 0,5 % (50 points de base) par défaut ;
 * - assise = prix final de l'article, hors frais de livraison ;
 * - la réduction trophée/coupon est financée par A2V, elle ne réduit pas la
 *   commission tant que la base configurée est ITEM_PRICE_BEFORE_DISCOUNT.
 */
describe("computeCommission", () => {
  it("prélève 0,5 % du prix de l'article", () => {
    const result = computeCommission(10_000, 0, 50);
    expect(result.baseCents).toBe(10_000);
    expect(result.commissionCents).toBe(50);
    expect(result.sellerPayoutCents).toBe(9950);
  });

  it("ignore les frais de livraison (non transmis dans l'assiette)", () => {
    const result = computeCommission(5_000, 0, 50);
    expect(result.baseCents).toBe(5_000);
    expect(result.commissionCents).toBe(25);
    expect(result.sellerPayoutCents).toBe(4_975);
  });

  it("ne réduit pas la commission lorsqu'une réduction est appliquée", () => {
    const sansReduction = computeCommission(20_000, 0, 50);
    const avecReduction = computeCommission(20_000, 2_000, 50);
    expect(avecReduction.commissionCents).toBe(sansReduction.commissionCents);
    expect(avecReduction.sellerPayoutCents).toBe(sansReduction.sellerPayoutCents);
  });

  it("arrondit au centime le plus proche", () => {
    // 19,99 € × 0,5 % = 9,995 centimes → 10 centimes
    expect(computeCommission(1_999, 0, 50).commissionCents).toBe(10);
    // 1 € × 0,5 % = 0,5 centime → 1 centime
    expect(computeCommission(100, 0, 50).commissionCents).toBe(1);
  });

  it("ne dépasse jamais le prix de l'article", () => {
    const result = computeCommission(100, 0, 10_000);
    expect(result.commissionCents).toBe(100);
    expect(result.sellerPayoutCents).toBe(0);
  });

  it("accepte un article à 0 € sans montant négatif", () => {
    const result = computeCommission(0, 0, 50);
    expect(result.commissionCents).toBe(0);
    expect(result.sellerPayoutCents).toBe(0);
  });

  it("rejette un prix non entier ou négatif", () => {
    expect(() => computeCommission(10.5, 0, 50)).toThrow(/prix invalide/i);
    expect(() => computeCommission(-100, 0, 50)).toThrow(/prix invalide/i);
  });

  it("rejette un taux hors bornes", () => {
    expect(() => computeCommission(1_000, 0, -1)).toThrow(/taux/i);
    expect(() => computeCommission(1_000, 0, 10_001)).toThrow(/taux/i);
    expect(() => computeCommission(1_000, 0, 50.5)).toThrow(/taux/i);
  });

  it("respecte un taux configurable différent", () => {
    const result = computeCommission(10_000, 0, 250);
    expect(result.commissionCents).toBe(250);
    expect(result.sellerPayoutCents).toBe(9_750);
    expect(result.rateBps).toBe(250);
  });
});
