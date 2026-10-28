import { describe, expect, it } from "vitest";
import { canAccessAdmin, hasPermission, PERMISSIONS, permissionsForRole } from "@/lib/auth/permissions";

describe("permissions", () => {
  it("donne tous les droits à l'administrateur", () => {
    expect(permissionsForRole("ADMIN")).toHaveLength(Object.keys(PERMISSIONS).length);
    expect(hasPermission("ADMIN", PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
    expect(hasPermission("ADMIN", PERMISSIONS.AUDIT_READ)).toBe(true);
  });

  it("limite la modération aux actions opérationnelles", () => {
    expect(hasPermission("MODERATOR", PERMISSIONS.LISTINGS_MODERATE)).toBe(true);
    expect(hasPermission("MODERATOR", PERMISSIONS.REPORTS_MANAGE)).toBe(true);
    expect(hasPermission("MODERATOR", PERMISSIONS.DISPUTES_MANAGE)).toBe(true);
    expect(hasPermission("MODERATOR", PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(hasPermission("MODERATOR", PERMISSIONS.PAYMENTS_MANAGE)).toBe(false);
    expect(hasPermission("MODERATOR", PERMISSIONS.AUDIT_READ)).toBe(false);
  });

  it("n'accorde aucun droit d'administration à un membre", () => {
    expect(permissionsForRole("USER")).toEqual([]);
    expect(canAccessAdmin("USER")).toBe(false);
    expect(hasPermission("USER", PERMISSIONS.STATS_READ)).toBe(false);
    expect(hasPermission("USER", PERMISSIONS.TROPHIES_MANAGE)).toBe(false);
  });

  it("traite un rôle inconnu comme un simple membre", () => {
    expect(permissionsForRole("SUPERADMIN")).toEqual([]);
    expect(canAccessAdmin("SUPERADMIN")).toBe(false);
  });

  it("autorise l'accès admin pour les deux rôles internes", () => {
    expect(canAccessAdmin("ADMIN")).toBe(true);
    expect(canAccessAdmin("MODERATOR")).toBe(true);
  });

  it("n'expose jamais de permission vide ou dupliquée pour l'admin", () => {
    const admin = permissionsForRole("ADMIN");
    expect(new Set(admin).size).toBe(admin.length);
    expect(admin.every((permission) => typeof permission === "string" && permission.includes("."))).toBe(true);
  });
});
