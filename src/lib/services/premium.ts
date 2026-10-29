import "server-only";

import { addDays, addMonths } from "date-fns";
import type { Subscription } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { paymentsSimulationEnabled } from "@/lib/env";
import { getSetting } from "@/lib/services/settings";
import { notify } from "@/lib/services/notifications";
import { audit } from "@/lib/services/audit";
import { logger } from "@/lib/logger";
import { PREMIUM, commitmentEndsAt, trialOfferLabel } from "@/lib/config";

export type PremiumState = {
  isPremium: boolean;
  hasUsedTrial: boolean;
  canStartTrial: boolean;
  status: "NONE" | "TRIALING" | "ACTIVE" | "CANCEL_AT_PERIOD_END" | "EXPIRED" | "PAYMENT_FAILED";
  subscription: (Subscription & { offer: { name: string; priceCents: number; trialDays: number } }) | null;
  trialEndsAt: Date | null;
  commitmentEndsAt: Date | null;
  canCancel: boolean;
  currentPeriodEnd: Date | null;
  nextBillingAt: Date | null;
  priceCents: number;
  trialDays: number;
  daysRemaining: number | null;
};

/**
 * Fin d'engagement d'un abonnement. Les abonnements créés avant l'ajout de la
 * colonne sont recalculés depuis la fin de l'essai (ou la création).
 */
export function resolveCommitmentEndsAt(subscription: Subscription | null): Date | null {
  if (!subscription) return null;
  if (subscription.commitmentEndsAt) return subscription.commitmentEndsAt;
  const anchor = subscription.trialEndsAt ?? subscription.createdAt;
  return commitmentEndsAt(anchor);
}

export function isSubscriptionActive(subscription: Subscription | null, now = new Date()): boolean {
  if (!subscription) return false;
  if (subscription.status === "TRIALING") return Boolean(subscription.trialEndsAt && subscription.trialEndsAt > now);
  if (subscription.status === "ACTIVE" || subscription.status === "CANCEL_AT_PERIOD_END") {
    return subscription.currentPeriodEnd > now;
  }
  return false;
}

export async function getPremiumState(userId: string): Promise<PremiumState> {
  const [subscription, trialCount, priceCents, trialDays] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { offer: { select: { name: true, priceCents: true, trialDays: true } } },
    }),
    prisma.subscription.count({ where: { userId, trialStartedAt: { not: null } } }),
    getSetting("premium.priceCents"),
    getSetting("premium.trialDays"),
  ]);

  const now = new Date();
  const isPremium = isSubscriptionActive(subscription, now);
  const hasUsedTrial = trialCount > 0;
  const canStartTrial = !hasUsedTrial && !isPremium;

  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const commitment = resolveCommitmentEndsAt(subscription);
  const currentPeriodEnd = subscription?.currentPeriodEnd ?? null;
  const nextBillingAt =
    subscription && isPremium
      ? subscription.status === "TRIALING"
        ? trialEndsAt
        : currentPeriodEnd
      : null;
  const reference = nextBillingAt ?? currentPeriodEnd;
  const daysRemaining = reference ? Math.max(0, Math.ceil((reference.getTime() - now.getTime()) / 86_400_000)) : null;

  return {
    isPremium,
    hasUsedTrial,
    canStartTrial,
    status: subscription?.status ?? "NONE",
    subscription: subscription ?? null,
    trialEndsAt,
    commitmentEndsAt: commitment,
    canCancel: Boolean(commitment && commitment <= now && subscription?.status === "ACTIVE"),
    currentPeriodEnd,
    nextBillingAt,
    priceCents,
    trialDays,
    daysRemaining,
  };
}

export async function hasPremium(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["TRIALING", "ACTIVE", "CANCEL_AT_PERIOD_END"] } },
    orderBy: { createdAt: "desc" },
  });
  return isSubscriptionActive(subscription);
}

export async function requirePremium(userId: string, message = "Cette offre est réservée aux membres A2V Prestige.") {
  if (!(await hasPremium(userId))) {
    throw new AppError("PAYMENT_REQUIRED", message, { status: 402 });
  }
}

export async function startTrial(userId: string) {
  const state = await getPremiumState(userId);
  if (state.hasUsedTrial) {
    throw new AppError("CONFLICT", "Vous avez déjà utilisé votre période d'essai. Vous pouvez souscrire à l'abonnement.");
  }
  if (state.isPremium) throw new AppError("CONFLICT", "Votre abonnement Prestige est déjà actif.");

  const trialDays = await getSetting("premium.trialDays");
  let offer = await prisma.premiumOffer.findUnique({ where: { code: "PRESTIGE_MONTHLY" } });
  const priceCents = await getSetting("premium.priceCents");
  if (!offer) {
    offer = await prisma.premiumOffer.create({
      data: {
        code: "PRESTIGE_MONTHLY",
        name: PREMIUM.label,
        priceCents,
        trialDays,
        features: [
          "Offres exclusives",
          "Enchères réservées",
          "Réductions supplémentaires",
          "Découverte avancée",
        ],
      },
    });
  }

  const now = new Date();
  const trialEndsAt = addDays(now, trialDays);
  const engagementEndsAt = commitmentEndsAt(trialEndsAt);

  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        userId,
        offerId: offer.id,
        status: "TRIALING",
        trialStartedAt: now,
        trialEndsAt,
        commitmentEndsAt: engagementEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        provider: paymentsSimulationEnabled ? "SIMULATED" : "STRIPE",
        events: {
          create: {
            type: "TRIAL_STARTED",
            metadata: {
              trialDays,
              trialEndsAt: trialEndsAt.toISOString(),
              commitmentMonths: PREMIUM.commitmentMonths,
              commitmentEndsAt: engagementEndsAt.toISOString(),
            },
          },
        },
      },
    });
    await tx.entitlement.upsert({
      where: { userId_key: { userId, key: "PREMIUM" } },
      update: { expiresAt: trialEndsAt, revokedAt: null, source: `subscription:${created.id}` },
      create: { userId, key: "PREMIUM", source: `subscription:${created.id}`, expiresAt: trialEndsAt },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "SUBSCRIPTION_TRIAL_STARTED", targetType: "Subscription", targetId: created.id },
    });
    return created;
  });

  await notify({
    userId,
    type: "SUBSCRIPTION",
    title: "Votre essai Prestige est activé",
    body: `Profitez de ${trialOfferLabel(trialDays)}. Première facturation le ${trialEndsAt.toLocaleDateString("fr-FR")} (${(priceCents / 100).toFixed(2)} €/mois), puis engagement de ${PREMIUM.commitmentMonths} mois jusqu'au ${engagementEndsAt.toLocaleDateString("fr-FR")}. Aucune résiliation pendant cette période.`,
    href: "/compte/abonnement",
  });

  return subscription;
}

/**
 * Active l'abonnement payant.
 * En simulation : aucun argent réel n'est prélevé, le paiement est marqué
 * SUCCEEDED avec provider SIMULATED. En production, Stripe Checkout / Billing
 * doit être configuré et le webhook fait foi.
 */
export async function activateSubscription(userId: string) {
  if (!paymentsSimulationEnabled) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Le paiement de l'abonnement nécessite Stripe Billing. Configurez STRIPE_SECRET_KEY ou utilisez le mode simulation en développement.",
    );
  }
  const state = await getPremiumState(userId);
  if (!state.subscription) throw new AppError("NOT_FOUND", "Aucun abonnement à activer. Démarrez un essai d'abord.");
  if (state.isPremium && state.status === "ACTIVE") throw new AppError("CONFLICT", "L'abonnement est déjà actif.");

  const priceCents = await getSetting("premium.priceCents");
  const now = new Date();
  const periodEnd = addMonths(now, 1);

  const subscription = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        userId,
        subscriptionId: state.subscription!.id,
        provider: "SIMULATED",
        providerRef: `sim_sub_${Date.now()}`,
        idempotencyKey: `sub_${state.subscription!.id}_${now.toISOString().slice(0, 10)}`,
        type: "SUBSCRIPTION",
        amountCents: priceCents,
        status: "SUCCEEDED",
        metadata: { simulated: true, note: "Abonnement simulé — développement" },
      },
    });
    const updated = await tx.subscription.update({
      where: { id: state.subscription!.id },
      data: {
        status: "ACTIVE",
        trialEndsAt: now,
        commitmentEndsAt: state.commitmentEndsAt ?? commitmentEndsAt(now),
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        events: { create: { type: "SUBSCRIPTION_ACTIVATED", metadata: { paymentId: payment.id, priceCents } } },
      },
    });
    await tx.entitlement.upsert({
      where: { userId_key: { userId, key: "PREMIUM" } },
      update: { expiresAt: periodEnd, revokedAt: null, source: `subscription:${updated.id}` },
      create: { userId, key: "PREMIUM", source: `subscription:${updated.id}`, expiresAt: periodEnd },
    });
    await tx.transactionEvent.create({
      data: {
        actorId: userId,
        paymentId: payment.id,
        type: "SUBSCRIPTION_STARTED",
        amountCents: priceCents,
        metadata: { simulated: true },
      },
    });
    return updated;
  });

  await notify({
    userId,
    type: "SUBSCRIPTION",
    title: "Abonnement Prestige activé",
    body: `Votre abonnement est actif jusqu'au ${periodEnd.toLocaleDateString("fr-FR")}. Renouvellement mensuel de ${(priceCents / 100).toFixed(2)} €, engagement de ${PREMIUM.commitmentMonths} mois.`,
    href: "/compte/abonnement",
  });
  await audit(userId, "SUBSCRIPTION_ACTIVATED_SIMULATED", { targetType: "Subscription", targetId: subscription.id });
  return subscription;
}

/**
 * Activation après un checkout Stripe Billing confirmé par webhook signé.
 * Cette fonction n'est jamais appelée depuis une requête non vérifiée.
 */
export async function activateSubscriptionFromStripe(input: {
  userId: string;
  providerRef: string;
  currentPeriodEnd: Date;
}) {
  const priceCents = await getSetting("premium.priceCents");
  const trialDays = await getSetting("premium.trialDays");
  const offer =
    (await prisma.premiumOffer.findUnique({ where: { code: "PRESTIGE_MONTHLY" } })) ??
    (await prisma.premiumOffer.create({
      data: { code: "PRESTIGE_MONTHLY", name: PREMIUM.label, priceCents, trialDays },
    }));
  const now = new Date();
  const existing = await prisma.subscription.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "desc" },
  });

  const subscription = await prisma.$transaction(async (tx) => {
    const updated = existing
      ? await tx.subscription.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            provider: "STRIPE",
            providerRef: input.providerRef,
            commitmentEndsAt: existing.commitmentEndsAt ?? commitmentEndsAt(now),
            currentPeriodStart: now,
            currentPeriodEnd: input.currentPeriodEnd,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            events: { create: { type: "STRIPE_SUBSCRIPTION_ACTIVE", metadata: { providerRef: input.providerRef } } },
          },
        })
      : await tx.subscription.create({
          data: {
            userId: input.userId,
            offerId: offer.id,
            status: "ACTIVE",
            provider: "STRIPE",
            providerRef: input.providerRef,
            commitmentEndsAt: commitmentEndsAt(now),
            currentPeriodStart: now,
            currentPeriodEnd: input.currentPeriodEnd,
            events: { create: { type: "STRIPE_SUBSCRIPTION_CREATED", metadata: { providerRef: input.providerRef } } },
          },
        });

    await tx.payment.create({
      data: {
        userId: input.userId,
        subscriptionId: updated.id,
        provider: "STRIPE",
        providerRef: input.providerRef,
        idempotencyKey: `stripe_sub_${input.providerRef}`,
        type: "SUBSCRIPTION",
        amountCents: priceCents,
        status: "SUCCEEDED",
        metadata: { webhookConfirmed: true },
      },
    });
    await tx.entitlement.upsert({
      where: { userId_key: { userId: input.userId, key: "PREMIUM" } },
      update: { expiresAt: input.currentPeriodEnd, revokedAt: null, source: `subscription:${updated.id}` },
      create: {
        userId: input.userId,
        key: "PREMIUM",
        source: `subscription:${updated.id}`,
        expiresAt: input.currentPeriodEnd,
      },
    });
    return updated;
  });

  await notify({
    userId: input.userId,
    type: "SUBSCRIPTION",
    title: "Abonnement Prestige confirmé",
    body: `Votre paiement a été confirmé par le prestataire. Abonnement actif jusqu'au ${input.currentPeriodEnd.toLocaleDateString("fr-FR")}.`,
    href: "/compte/abonnement",
  });
  await audit(input.userId, "SUBSCRIPTION_ACTIVATED_STRIPE", {
    targetType: "Subscription",
    targetId: subscription.id,
  });
  return subscription;
}

export async function cancelSubscription(userId: string, immediate = false) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["TRIALING", "ACTIVE", "CANCEL_AT_PERIOD_END"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw new AppError("NOT_FOUND", "Aucun abonnement actif à résilier.");

  const now = new Date();
  const engagementEndsAt = resolveCommitmentEndsAt(subscription);
  if (engagementEndsAt && engagementEndsAt > now) {
    throw new AppError(
      "CONFLICT",
      `Résiliation impossible avant le ${engagementEndsAt.toLocaleDateString("fr-FR")} : l'engagement Prestige de ${PREMIUM.commitmentMonths} mois est en cours.`,
    );
  }

  const expiresAt = subscription.status === "TRIALING" ? subscription.trialEndsAt : subscription.currentPeriodEnd;
  const updated = await prisma.$transaction(async (tx) => {
    const result =
      immediate || !expiresAt || expiresAt <= now
        ? await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              status: "EXPIRED",
              cancelAtPeriodEnd: false,
              canceledAt: now,
              events: { create: { type: "SUBSCRIPTION_CANCELLED_IMMEDIATE" } },
            },
          })
        : await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              status: "CANCEL_AT_PERIOD_END",
              cancelAtPeriodEnd: true,
              canceledAt: now,
              events: { create: { type: "SUBSCRIPTION_CANCELLED_AT_PERIOD_END", metadata: { expiresAt } } },
            },
          });
    if (result.status === "EXPIRED") {
      await tx.entitlement.updateMany({
        where: { userId, key: "PREMIUM" },
        data: { revokedAt: now, expiresAt: now },
      });
    }
    return result;
  });

  await notify({
    userId,
    type: "SUBSCRIPTION",
    title: immediate ? "Abonnement résilié" : "Résiliation programmée",
    body: immediate
      ? "Votre abonnement Prestige est résilié. Les avantages Premium sont désactivés."
      : `Votre abonnement reste actif jusqu'au ${updated.currentPeriodEnd.toLocaleDateString("fr-FR")}, puis s'arrêtera sans frais supplémentaires.`,
    href: "/compte/abonnement",
  });
  await audit(userId, "SUBSCRIPTION_CANCELLED", { targetType: "Subscription", targetId: subscription.id });
  return updated;
}

export async function resumeSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "CANCEL_AT_PERIOD_END" },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw new AppError("NOT_FOUND", "Aucune résiliation programmée.");
  return prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      canceledAt: null,
      events: { create: { type: "SUBSCRIPTION_RESUMED" } },
    },
  });
}

/**
 * Tâche planifiée : expire les essais/abonnements échus.
 * En production, Stripe Billing reste la source de vérité pour les paiements.
 */
export async function processSubscriptionLifecycle(now = new Date()) {
  const candidates = await prisma.subscription.findMany({
    where: {
      status: { in: ["TRIALING", "ACTIVE", "CANCEL_AT_PERIOD_END"] },
      OR: [
        { status: "TRIALING", trialEndsAt: { lte: now } },
        { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] }, currentPeriodEnd: { lte: now } },
      ],
    },
  });

  let expired = 0;
  let converted = 0;

  for (const subscription of candidates) {
    // Fin de la période offerte : l'engagement démarre automatiquement par un
    // premier mois payant (simulation). En production, Stripe Billing doit
    // confirmer le paiement par webhook ; sans Stripe, l'essai expire.
    if (subscription.status === "TRIALING") {
      if (!paymentsSimulationEnabled) {
        await expireSubscription(subscription, now);
        expired += 1;
        continue;
      }

      const priceCents = await getSetting("premium.priceCents");
      const periodStart = subscription.trialEndsAt ?? now;
      const periodEnd = addMonths(periodStart, 1);

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            userId: subscription.userId,
            subscriptionId: subscription.id,
            provider: "SIMULATED",
            providerRef: `sim_sub_trial_${subscription.id}_${periodStart.toISOString().slice(0, 10)}`,
            idempotencyKey: `trial_convert_${subscription.id}_${periodStart.toISOString().slice(0, 10)}`,
            type: "SUBSCRIPTION",
            amountCents: priceCents,
            status: "SUCCEEDED",
            metadata: {
              simulated: true,
              automatic: true,
              note: "Premier mois après la période offerte — simulation",
            },
          },
        });
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            commitmentEndsAt: subscription.commitmentEndsAt ?? commitmentEndsAt(periodStart),
            cancelAtPeriodEnd: false,
            canceledAt: null,
            events: {
              create: {
                type: "SUBSCRIPTION_ACTIVATED",
                metadata: { paymentId: payment.id, priceCents, automatic: true },
              },
            },
          },
        });
        await tx.entitlement.updateMany({
          where: { userId: subscription.userId, key: "PREMIUM" },
          data: { expiresAt: periodEnd, revokedAt: null, source: `subscription:${subscription.id}` },
        });
        await tx.transactionEvent.create({
          data: {
            actorId: subscription.userId,
            paymentId: payment.id,
            type: "SUBSCRIPTION_STARTED",
            amountCents: priceCents,
            metadata: { simulated: true, automatic: true },
          },
        });
        await tx.notification.create({
          data: {
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            title: "Votre abonnement Prestige démarre",
            body: `La période offerte est terminée. Votre engagement de ${PREMIUM.commitmentMonths} mois commence ; premier mois de ${(priceCents / 100).toFixed(2)} € enregistré en simulation.`,
            href: "/compte/abonnement",
          },
        });
      });

      logger.info("Essai converti en abonnement", { subscriptionId: subscription.id, userId: subscription.userId });
      converted += 1;
      continue;
    }

    await expireSubscription(subscription, now);
    expired += 1;
  }

  return { expired, converted, processed: candidates.length };
}

async function expireSubscription(subscription: Subscription, now: Date) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "EXPIRED",
        events: {
          create: {
            type: subscription.status === "TRIALING" ? "TRIAL_EXPIRED" : "SUBSCRIPTION_EXPIRED",
            metadata: { processedAt: now.toISOString() },
          },
        },
      },
    });
    await tx.entitlement.updateMany({
      where: { userId: subscription.userId, key: "PREMIUM" },
      data: { expiresAt: now, revokedAt: now },
    });
    await tx.notification.create({
      data: {
        userId: subscription.userId,
        type: "SUBSCRIPTION",
        title: subscription.status === "TRIALING" ? "Votre essai Prestige est terminé" : "Votre abonnement Prestige a expiré",
        body: "Les avantages Premium sont désactivés. Vous pouvez réactiver votre abonnement à tout moment.",
        href: "/compte/abonnement",
      },
    });
    logger.info("Abonnement expiré", { subscriptionId: updated.id, userId: subscription.userId });
  });
}
