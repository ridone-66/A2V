import { describe, expect, it } from "vitest";
import { minimumNextBidCents } from "@/lib/services/auctions";

const auction = { startPriceCents: 1_000, currentPriceCents: 2_500, minIncrementCents: 100 };

describe("minimumNextBidCents", () => {
  it("accepte le prix de départ tant qu'aucune offre n'existe", () => {
    expect(minimumNextBidCents(auction, 0)).toBe(1_000);
  });

  it("exige l'incrément minimum après la première offre", () => {
    expect(minimumNextBidCents(auction, 1)).toBe(2_600);
    expect(minimumNextBidCents(auction, 7)).toBe(2_600);
  });

  it("suit le prix courant mis à jour par le serveur", () => {
    expect(minimumNextBidCents({ ...auction, currentPriceCents: 9_900 }, 3)).toBe(10_000);
  });

  it("respecte un incrément configurable", () => {
    expect(minimumNextBidCents({ ...auction, minIncrementCents: 500 }, 2)).toBe(3_000);
  });
});
