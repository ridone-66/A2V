import "server-only";

import type { TrophyDefinition } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/services/notifications";

export type TrophyProgress = {
  wins: number;
  trophyCount: number;
  currentLevel: number;
  definitions: Array<TrophyDefinition & { earned: boolean; awardedAt: Date | null }>;
  next: TrophyDefinition | null;
  progressToNext: number;
};

/** Nombre de victoires d'enchères réellement finalisées (pas seulement remportées). */
export async function countFinalizedAuctionWins(userId: string): Promise<number> {
  return prisma.order.count({
    where: { buyerId: userId, status: "FINALIZED", auctionWinner: { isNot: null } },
  });
}

export async function getTrophyProgress(userId: string): Promise<TrophyProgress> {
  const [wins, definitions, awards] = await Promise.all([
    countFinalizedAuctionWins(userId),
    prisma.trophyDefinition.findMany({ where: { isActive: true }, orderBy: { level: "asc" } }),
    prisma.userTrophy.findMany({ where: { userId }, orderBy: { awardedAt: "asc" } }),
  ]);

  const awardByDefinition = new Map(awards.map((award) => [award.trophyDefinitionId, award.awardedAt]));
  const enriched = definitions.map((definition) => ({
    ...definition,
    earned: awardByDefinition.has(definition.id),
    awardedAt: awardByDefinition.get(definition.id) ?? null,
  }));

  const earnedLevels = enriched.filter((definition) => definition.earned).map((definition) => definition.level);
  const currentLevel = earnedLevels.length ? Math.max(...earnedLevels) : 0;
  const next = enriched.find((definition) => !definition.earned) ?? null;
  const progressToNext = next
    ? Math.min(100, Math.round((wins / Math.max(1, next.thresholdWins)) * 100))
    : 100;

  return {
    wins,
    trophyCount: awards.length,
    currentLevel,
    definitions: enriched,
    next,
    progressToNext,
  };
}

/**
 * Attribution idempotente des trophées à la finalisation d'une commande
 * d'enchère. Utilise des contraintes d'unicité (userId + trophée et
 * sourceOrderId + trophée) pour empêcher les doublons en cas de rejeu.
 */
export async function awardTrophiesForFinalizedOrder(orderId: string): Promise<TrophyDefinition[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      auctionWinner: true,
      buyer: { select: { id: true, email: true, publicName: true } },
    },
  });

  if (!order || order.status !== "FINALIZED" || !order.auctionWinner) return [];

  const wins = await prisma.order.count({
    where: { buyerId: order.buyerId, status: "FINALIZED", auctionWinner: { isNot: null } },
  });

  const eligible = await prisma.trophyDefinition.findMany({
    where: { isActive: true, thresholdWins: { lte: wins } },
    orderBy: { level: "asc" },
  });
  if (eligible.length === 0) return [];

  const existing = await prisma.userTrophy.findMany({
    where: { userId: order.buyerId, trophyDefinitionId: { in: eligible.map((definition) => definition.id) } },
    select: { trophyDefinitionId: true },
  });
  const existingIds = new Set(existing.map((award) => award.trophyDefinitionId));
  const newlyAwarded: TrophyDefinition[] = [];

  for (const definition of eligible) {
    if (existingIds.has(definition.id)) continue;
    try {
      await prisma.userTrophy.create({
        data: {
          userId: order.buyerId,
          trophyDefinitionId: definition.id,
          sourceOrderId: order.id,
        },
      });
      newlyAwarded.push(definition);
      await notify({
        userId: order.buyerId,
        type: "TROPHY_AWARDED",
        title: `Trophée ${definition.name} débloqué !`,
        body: `Vous avez remporté ${wins} enchère${wins > 1 ? "s" : ""} finalisée${wins > 1 ? "s" : ""}. Votre trophée ${definition.name} est disponible.`,
        href: "/compte/trophees",
        email: {
          to: order.buyer.email,
          subject: `A2V — Trophée ${definition.name} débloqué`,
          text: `Félicitations ${order.buyer.publicName} ! Votre trophée ${definition.name} est débloqué grâce à votre ${wins}e victoire finalisée.`,
        },
      });
    } catch (error) {
      // P2002 = contrainte d'unicité : le trophée a déjà été attribué.
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }

  return newlyAwarded;
}

/** Récompense automatique liée au niveau de trophées (une seule réduction par commande). */
export async function getTrophyLevel(userId: string): Promise<{ count: number; level: number }> {
  const awards = await prisma.userTrophy.findMany({
    where: { userId },
    include: { definition: { select: { level: true } } },
  });
  return {
    count: awards.length,
    level: awards.length ? Math.max(...awards.map((award) => award.definition.level)) : 0,
  };
}
