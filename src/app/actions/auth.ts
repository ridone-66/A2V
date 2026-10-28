"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { hashPassword, hmacHex, randomToken, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getRequestMeta, hashIp, redirectIfAuthenticated, revokeAllSessions } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/services/audit";
import { sendEmail, buildEmailLayout } from "@/lib/integrations/email";
import { logger } from "@/lib/logger";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { formString } from "@/lib/forms";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/schemas";
import { safeRedirectPath } from "@/lib/utils";

async function clientKey(prefix: string, identifier: string) {
  const meta = await getRequestMeta();
  return `${prefix}:${meta.ipHash ?? "unknown"}:${hmacHex(identifier.toLowerCase(), env.IP_HASH_SALT).slice(0, 16)}`;
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    publicName: formString(formData, "publicName"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "on",
    marketingOptIn: formData.get("marketingOptIn") === "on",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return errorState("Vérifiez les champs du formulaire.", zodToFieldErrors(parsed.error));
  }

  const limit = rateLimit(await clientKey("register", parsed.data.email), 5, 3_600_000);
  if (!limit.allowed) return errorState("Trop de tentatives. Réessayez dans une heure.");

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: parsed.data.email }, { publicName: parsed.data.publicName }] },
    select: { email: true, publicName: true },
  });
  if (existing) {
    return errorState(
      "Ce compte existe peut-être déjà.",
      existing.email === parsed.data.email
        ? { email: ["Un compte utilise déjà cette adresse e-mail."] }
        : { publicName: ["Ce nom public est déjà pris."] },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      publicName: parsed.data.publicName,
      passwordHash,
      profile: { create: { preferences: { marketingOptIn: parsed.data.marketingOptIn } } },
    },
  });

  await audit(user.id, "USER_REGISTERED", { targetType: "User", targetId: user.id });
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "WELCOME",
      title: "Bienvenue sur A2V",
      body: "Votre compte est créé. Publication gratuite, commission de 0,5 % uniquement sur les ventes finalisées. Pensez à compléter votre adresse de livraison.",
      href: "/compte/parametres",
    },
  });

  await createSession(user.id);
  redirect("/compte?bienvenue=1");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    next: formString(formData, "next") || undefined,
  });
  if (!parsed.success) return errorState("Identifiants invalides.", zodToFieldErrors(parsed.error));

  const limit = rateLimit(await clientKey("login", parsed.data.email), 8, 900_000);
  if (!limit.allowed) {
    return errorState(`Trop de tentatives. Réessayez dans ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`);
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Message identique pour ne pas révéler l'existence du compte.
  const genericError = "Adresse e-mail ou mot de passe incorrect.";
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return errorState(genericError);
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return errorState("Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.");
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
      },
    });
    await audit(user.id, "LOGIN_FAILED", { targetType: "User", targetId: user.id, metadata: { failedLoginCount } });
    return errorState(
      failedLoginCount >= 5
        ? "Trop d'échecs. Le compte est verrouillé pendant 15 minutes."
        : genericError,
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id);
  await audit(user.id, "LOGIN_SUCCEEDED", { targetType: "User", targetId: user.id });

  redirect(safeRedirectPath(parsed.data.next, "/compte"));
}

export async function logoutAction() {
  const meta = await getRequestMeta();
  const headerList = await headers();
  const cookie = headerList.get("cookie") ?? "";
  const tokenMatch = cookie.match(/a2v_session=([^;]+)/);
  if (tokenMatch) {
    const token = decodeURIComponent(tokenMatch[1]);
    await prisma.session
      .updateMany({
        where: { tokenHash: hmacHex(token, env.SESSION_SECRET), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  void meta;
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formString(formData, "email") });
  if (!parsed.success) return errorState("Adresse e-mail invalide.", zodToFieldErrors(parsed.error));

  const limit = rateLimit(await clientKey("forgot", parsed.data.email), 3, 3_600_000);
  if (!limit.allowed) return errorState("Trop de demandes. Réessayez dans une heure.");

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && user.status === "ACTIVE") {
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hmacHex(token, env.SESSION_SECRET),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const link = `${env.APP_URL}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: user.email,
      subject: "A2V — Réinitialisation de votre mot de passe",
      text: `Pour choisir un nouveau mot de passe, ouvrez ce lien valable 1 heure : ${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
      html: buildEmailLayout(
        "Réinitialiser votre mot de passe",
        `<p>Vous avez demandé à réinitialiser votre mot de passe A2V.</p><p>Ce lien est valable <strong>1 heure</strong> et ne peut être utilisé qu'une fois.</p>`,
        { label: "Choisir un nouveau mot de passe", href: link },
      ),
    });
  }

  // Réponse volontairement identique, que le compte existe ou non.
  return successState(
    "Si un compte correspond à cette adresse, un lien de réinitialisation vient d'être envoyé. En développement sans SMTP, le lien est écrit dans les journaux du serveur.",
  );
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formString(formData, "token"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) return errorState("Vérifiez le formulaire.", zodToFieldErrors(parsed.error));

  const tokenHash = hmacHex(parsed.data.token, env.SESSION_SECRET);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return errorState("Ce lien est invalide ou expiré. Demandez un nouveau lien.");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(record.userId, "PASSWORD_RESET", { targetType: "User", targetId: record.userId });

  redirect("/connexion?reset=1");
}

export async function resendVerificationAction(): Promise<ActionState> {
  const { getCurrentUser } = await import("@/lib/auth/session");
  const user = await getCurrentUser();
  if (!user) return errorState("Vous devez être connecté.");
  if (user.emailVerifiedAt) return successState("Votre adresse e-mail est déjà vérifiée.");
  // Aucun modèle de jeton de vérification n'est implémenté : on ne prétend pas envoyer un e-mail réel.
  return successState(
    "La vérification d'e-mail n'est pas activée dans cette version de démonstration. Votre compte reste utilisable ; ce point est documenté comme limite.",
  );
}

export async function ensureGuest() {
  await redirectIfAuthenticated();
}

export async function changeEmailPlaceholder() {
  throw new AppError("NOT_CONFIGURED", "Le changement d'adresse e-mail sera activé avec la vérification d'e-mail.");
}

export async function revokeOtherSessionsAction(): Promise<ActionState> {
  const { getCurrentUser } = await import("@/lib/auth/session");
  const user = await getCurrentUser();
  if (!user) return errorState("Vous devez être connecté.");
  await revokeAllSessions(user.id);
  logger.info("Sessions révoquées", { userId: user.id });
  return successState("Toutes vos autres sessions ont été déconnectées.");
}

export async function debugIpAction() {
  const meta = await getRequestMeta();
  return hashIp(meta.ipHash);
}
