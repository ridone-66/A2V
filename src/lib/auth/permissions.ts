/**
 * Modèle de permissions. Les rôles sont stockés côté base, les permissions
 * sont vérifiées côté serveur pour chaque action sensible.
 */
export const PERMISSIONS = {
  ADMIN_ACCESS: "admin.access",
  STATS_READ: "stats.read",
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",
  LISTINGS_MODERATE: "listings.moderate",
  AUCTIONS_MANAGE: "auctions.manage",
  ORDERS_MANAGE: "orders.manage",
  PAYMENTS_MANAGE: "payments.manage",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  TROPHIES_MANAGE: "trophies.manage",
  DONATIONS_MANAGE: "donations.manage",
  REPORTS_MANAGE: "reports.manage",
  DISPUTES_MANAGE: "disputes.manage",
  CATEGORIES_MANAGE: "categories.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_READ: "audit.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL: Permission[] = Object.values(PERMISSIONS);

const MODERATOR: Permission[] = [
  PERMISSIONS.ADMIN_ACCESS,
  PERMISSIONS.STATS_READ,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.LISTINGS_MODERATE,
  PERMISSIONS.REPORTS_MANAGE,
  PERMISSIONS.DISPUTES_MANAGE,
  PERMISSIONS.AUCTIONS_MANAGE,
];

export const ROLE_PERMISSIONS: Record<"ADMIN" | "MODERATOR" | "USER", Permission[]> = {
  ADMIN: ALL,
  MODERATOR,
  USER: [],
};

export function permissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[(role as keyof typeof ROLE_PERMISSIONS) ?? "USER"] ?? [];
}

export function hasPermission(role: string, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function canAccessAdmin(role: string): boolean {
  return hasPermission(role, PERMISSIONS.ADMIN_ACCESS);
}
