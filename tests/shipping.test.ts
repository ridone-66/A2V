import { describe, expect, it } from "vitest";
import type { ShipmentStatus } from "@prisma/client";
import { ALLOWED_TRANSITIONS } from "@/lib/services/shipping";

const STATUSES: ShipmentStatus[] = [
  "PENDING",
  "LABEL_CREATED",
  "HANDED_OVER",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "LOST",
  "DAMAGED",
  "RETURNED",
];

describe("ALLOWED_TRANSITIONS", () => {
  it("couvre tous les statuts d'expédition", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...STATUSES].sort());
  });

  it("n'autorise pas une transition vers le même statut", () => {
    for (const status of STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it("progresse dans l'ordre logique du suivi", () => {
    expect(ALLOWED_TRANSITIONS.PENDING).toContain("LABEL_CREATED");
    expect(ALLOWED_TRANSITIONS.LABEL_CREATED).toContain("HANDED_OVER");
    expect(ALLOWED_TRANSITIONS.HANDED_OVER).toContain("IN_TRANSIT");
    expect(ALLOWED_TRANSITIONS.IN_TRANSIT).toContain("OUT_FOR_DELIVERY");
    expect(ALLOWED_TRANSITIONS.OUT_FOR_DELIVERY).toContain("DELIVERED");
  });

  it("interdit tout retour en arrière après livraison", () => {
    expect(ALLOWED_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.RETURNED).toEqual([]);
  });

  it("permet de déclarer une perte ou un dommage, puis un retour", () => {
    for (const status of ["PENDING", "LABEL_CREATED", "HANDED_OVER", "IN_TRANSIT", "OUT_FOR_DELIVERY"] as ShipmentStatus[]) {
      expect(ALLOWED_TRANSITIONS[status]).toContain("LOST");
      expect(ALLOWED_TRANSITIONS[status]).toContain("DAMAGED");
    }
    expect(ALLOWED_TRANSITIONS.LOST).toContain("RETURNED");
    expect(ALLOWED_TRANSITIONS.DAMAGED).toContain("RETURNED");
  });

  it("ne contient que des statuts connus", () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(STATUSES).toContain(target);
      }
    }
  });
});
