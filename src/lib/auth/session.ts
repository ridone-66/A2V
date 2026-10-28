import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { hmacHex, randomToken } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { canAccessAdmin, hasPermission, type Permission } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";

export const SESSION_COOKIE = "a2v_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  publicName: string;
  role: Role;
  status: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  profile: {
    avatarUrl: string | null;
    city: string | null;
    publicLocation: boolean;
    bio: string | null;
  } | null;
};

export function hashSessionToken(token: string): string {
  return hmacHex(token, env.SESSION_SECRET);
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return hmacHex(ip, env.IP_HASH_SALT).slice(0, 32);
}

export async function getRequestMeta() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || null;
  return {
    userAgent: headerList.get("user-agent")?.slice(0, 300) ?? null,
    ipHash: hashIp(ip),
    origin: headerList.get("origin"),
    host: headerList.get("host"),
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const meta = await getRequestMeta();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      userAgent: meta.userAgent,
      ipHash: meta.ipHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_URL.startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashSessionToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch((error) => logger.error("Révocation de session impossible", { error: String(error) }));
  }
  cookieStore.delete(SESSION_COOKIE);
}

async function loadSessionUser(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          publicName: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
          deletedAt: true,
          profile: { select: { avatarUrl: true, city: true, publicLocation: true, bio: true } },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (!session.user || session.user.status !== "ACTIVE" || session.user.deletedAt) return null;

  // Session glissante : prolongée au plus une fois par heure.
  if (Date.now() - session.lastUsedAt.getTime() > 3_600_000) {
    prisma.session
      .update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(),
          expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
        },
      })
      .catch(() => undefined);
  }

  const { deletedAt: _deletedAt, ...user } = session.user;
  return user;
}

/**
 * Utilisateur courant, dédupliqué pour la durée de la requête.
 * Retourne null si non authentifié (ne redirige pas).
 */
export const getCurrentUser = cache(loadSessionUser);

export async function requireUser(nextPath = "/compte"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireVerifiedUser(nextPath = "/compte"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!user.emailVerifiedAt) redirect(`/compte/verification?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/admin")}`);
  if (!hasPermission(user.role, permission)) {
    if (!canAccessAdmin(user.role)) redirect("/compte?erreur=acces-admin-refuse");
    redirect("/admin?erreur=permission-insuffisante");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requirePermission("admin.access");
}

/** Variante API : ne redirige pas, lève une erreur 401/403. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Vous devez être connecté.");
  return user;
}

export async function requireApiPermission(permission: Permission): Promise<SessionUser> {
  const user = await requireApiUser();
  if (!hasPermission(user.role, permission)) {
    throw new AppError("FORBIDDEN", "Vous n'avez pas les droits nécessaires.");
  }
  return user;
}

export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect("/compte");
}

/**
 * Vérification d'origine pour les routes API mutantes (protection CSRF
 * complémentaire aux Server Actions, qui vérifient déjà Origin/Host).
 */
export async function assertSameOrigin(request: Request): Promise<void> {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  const origin = request.headers.get("origin");
  if (!origin) {
    // Certains clients (curl, webhooks signés) n'envoient pas d'Origin :
    // les webhooks ont leur propre vérification de signature.
    return;
  }
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(env.APP_URL).origin);
  } catch {
    /* ignore */
  }
  const host = request.headers.get("host");
  if (host) {
    allowed.add(`${request.headers.get("x-forwarded-proto") ?? "http"}://${host}`);
  }
  if (!allowed.has(origin)) {
    if (isProduction) throw new AppError("FORBIDDEN", "Origine non autorisée.");
  }
}

export async function revokeAllSessions(userId: string, exceptToken?: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptToken ? { tokenHash: { not: hashSessionToken(exceptToken) } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}
