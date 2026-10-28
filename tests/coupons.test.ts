import { describe, expect, it } from "vitest";
import { couponDiscount, rewardDiscount } from "@/lib/services/coupons";

describe("couponDiscount", () => {
  it("applique un pourcentage plafonné", () => {
    expect(couponDiscount({ discountType: "PERCENT", value: 1_000, maxDiscountCents: 5_000 }, 20_000)).toBe(2_000);
  });

  it("ne dépasse pas le plafond du coupon", () => {
    expect(couponDiscount({ discountType: "PERCENT", value: 5_000, maxDiscountCents: 3_000 }, 20_000)).toBe(3_000);
  });

  it("applique un montant fixe sans dépasser le sous-total", () => {
    expect(couponDiscount({ discountType: "FIXED", value: 1_500, maxDiscountCents: null }, 20_000)).toBe(1_500);
    expect(couponDiscount({ discountType: "FIXED", value: 50_000, maxDiscountCents: null }, 20_000)).toBe(20_000);
  });

  it("ne rend jamais un montant négatif", () => {
    expect(couponDiscount({ discountType: "FIXED", value: -500, maxDiscountCents: null }, 10_000)).toBe(0);
  });

  it("gère un sous-total nul", () => {
    expect(couponDiscount({ discountType: "PERCENT", value: 1_000, maxDiscountCents: 5_000 }, 0)).toBe(0);
  });
});

describe("rewardDiscount", () => {
  it("plafonne la réduction trophée", () => {
    expect(rewardDiscount({ discountBps: 500, maxDiscountCents: 1_000 }, 100_000)).toBe(1_000);
  });

  it("calcule la réduction sous le plafond", () => {
    expect(rewardDiscount({ discountBps: 250, maxDiscountCents: 5_000 }, 10_000)).toBe(250);
  });

  it("ne dépasse pas le prix de l'article", () => {
    expect(rewardDiscount({ discountBps: 1_000, maxDiscountCents: null }, 800)).toBe(80);
    expect(rewardDiscount({ discountBps: 10_000, maxDiscountCents: null }, 800)).toBe(800);
  });
});
