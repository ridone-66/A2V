import { describe, expect, it } from "vitest";
import { applyBps, centsToEuroInput, clampCents, formatMoney, parseEurosToCents, percentLabel } from "@/lib/money";

/** Normalise les espaces insécables produits par Intl pour des assertions stables. */
function normalize(value: string) {
  return value.replace(/\u202f|\u00a0/g, " ");
}

describe("applyBps", () => {
  it("calcule 0,5 % avec arrondi au centime", () => {
    expect(applyBps(10_000, 50)).toBe(50);
    expect(applyBps(19_999, 50)).toBe(100);
  });

  it("renvoie 0 sur un montant nul", () => {
    expect(applyBps(0, 50)).toBe(0);
  });

  it("refuse un montant négatif", () => {
    expect(() => applyBps(-1, 50)).toThrow(/négatif/i);
  });
});

describe("parseEurosToCents", () => {
  it("accepte le point et la virgule décimale", () => {
    expect(parseEurosToCents("12.50")).toBe(1250);
    expect(parseEurosToCents("12,50")).toBe(1250);
    expect(parseEurosToCents(3)).toBe(300);
  });

  it("arrondit au centime le plus proche", () => {
    expect(parseEurosToCents("0.005")).toBe(1);
    expect(parseEurosToCents("19.999")).toBe(2000);
  });

  it("rejette une valeur non numérique", () => {
    expect(() => parseEurosToCents("abc")).toThrow(/invalide/i);
  });
});

describe("clampCents", () => {
  it("borne et arrondit", () => {
    expect(clampCents(10.4)).toBe(10);
    expect(clampCents(10.6)).toBe(11);
    expect(clampCents(-5)).toBe(0);
    expect(clampCents(500, 0, 100)).toBe(100);
  });
});

describe("formatage", () => {
  it("formate en euros français avec deux décimales", () => {
    expect(normalize(formatMoney(123_456))).toBe("1 234,56 €");
  });

  it("produit une valeur d'input sans séparateur de milliers", () => {
    expect(centsToEuroInput(123_456)).toBe("1234.56");
    expect(centsToEuroInput(5)).toBe("0.05");
  });

  it("affiche un pourcentage en points de base", () => {
    expect(percentLabel(50)).toBe("0,5 %");
    expect(percentLabel(250)).toBe("2,5 %");
  });
});
