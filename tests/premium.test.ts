import { describe, expect, it } from "vitest";
import type { Subscription } from "@prisma/client";
import { isSubscriptionActive } from "@/lib/services/premium";

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: "sub_test",
    userId: "user_test",
    offerId: "offer_test",
    status: "ACTIVE",
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    provider: "SIMULATED",
    providerRef: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Subscription;
}

const NOW = new Date("2026-01-15T12:00:00.000Z");

describe("isSubscriptionActive", () => {
  it("retourne false sans abonnement", () => {
    expect(isSubscriptionActive(null, NOW)).toBe(false);
  });

  it("considère un abonnement ACTIVE valide tant que la période court", () => {
    expect(isSubscriptionActive(subscription({ status: "ACTIVE" }), NOW)).toBe(true);
  });

  it("expire un abonnement ACTIVE dont la période est terminée", () => {
    expect(isSubscriptionActive(subscription({ status: "ACTIVE", currentPeriodEnd: new Date("2026-01-15T00:00:00.000Z") }), NOW)).toBe(false);
  });

  it("conserve les avantages jusqu'à la fin de période d'une résiliation programmée", () => {
    expect(
      isSubscriptionActive(subscription({ status: "CANCEL_AT_PERIOD_END", cancelAtPeriodEnd: true }), NOW),
    ).toBe(true);
    expect(
      isSubscriptionActive(
        subscription({
          status: "CANCEL_AT_PERIOD_END",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date("2026-01-10T00:00:00.000Z"),
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("valide un essai en cours", () => {
    expect(
      isSubscriptionActive(
        subscription({
          status: "TRIALING",
          trialStartedAt: new Date("2026-01-01T00:00:00.000Z"),
          trialEndsAt: new Date("2026-04-01T00:00:00.000Z"),
        }),
        NOW,
      ),
    ).toBe(true);
  });

  it("expire l'essai à sa date de fin, sans reconduction silencieuse", () => {
    expect(
      isSubscriptionActive(
        subscription({ status: "TRIALING", trialEndsAt: new Date("2026-01-15T12:00:00.000Z") }),
        NOW,
      ),
    ).toBe(false);
    expect(isSubscriptionActive(subscription({ status: "TRIALING", trialEndsAt: null }), NOW)).toBe(false);
  });

  it("ne réactive pas un abonnement expiré, échoué ou annulé", () => {
    for (const status of ["EXPIRED", "PAYMENT_FAILED"] as Subscription["status"][]) {
      expect(isSubscriptionActive(subscription({ status }), NOW)).toBe(false);
    }
  });
});
