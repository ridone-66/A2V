import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { notify } from "@/lib/services/notifications";
import { audit } from "@/lib/services/audit";
import { getSetting } from "@/lib/services/settings";
import { hasPremium } from "@/lib/services/premium";
import { formatMoney } from "@/lib/money";
import { logger } from "@/lib/logger";

/** Prix minimum de la prochaine offre (hors considération de réserve). */
export function minimumNextBidCents(
  auction: { startPriceCents: number; currentPriceCents: number; minIncrementCents: number },
  bidCount: number,
): number {
  return bidCount === 0 ? auction.startPriceCents : auction.currentPriceCents + auction.minIncrementCents;
}

async function runSerializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      // P2034 = conflit d'écriture / deadlock : rejouer la transaction.
      if (code === "P2034" && attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export type PlaceBidResult = {
  bidId: string;
  amountCents: number;
  currentPriceCents: number;
  endsAt: Date;
  extended: boolean;
  wasOutbidUserId: string | null;
};

export async function placeBid(input: {
  auctionId: string;
  userId: string;
  amountCents: number;
  now?: Date;
}): Promise<PlaceBidResult> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new AppError("VALIDATION", "Montant d'offre invalide.");
  }
  const now = input.now ?? new Date();
  const [extensionWindow, extensionSeconds, maxExtensions] = await Promise.all([
    getSetting("auction.extensionWindowSeconds"),
    getSetting("auction.extensionSeconds"),
    getSetting("auction.maxExtensions"),
  ]);

  const result = await runSerializable(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: input.auctionId },
      include: {
        listing: { include: { seller: { select: { id: true, email: true } } } },
        _count: { select: { bids: true } },
      },
    });
    if (!auction) throw new AppError("NOT_FOUND", "Enchère introuvable.");
    if (auction.status === "CANCELLED") throw new AppError("AUCTION_CLOSED", "Cette enchère a été annulée.");
    if (auction.status !== "LIVE" && auction.status !== "SCHEDULED") {
      throw new AppError("AUCTION_CLOSED", "Cette enchère est terminée.");
    }
    if (auction.endsAt <= now) throw new AppError("AUCTION_CLOSED", "Cette enchère est terminée.");
    if (auction.startsAt > now) throw new AppError("CONFLICT", "Cette enchère n'a pas encore commencé.");
    if (auction.listing.sellerId === input.userId) throw new AppError("FORBIDDEN", "Un vendeur ne peut pas enchérir sur son propre article.");

    const [blocked, premium] = await Promise.all([
      tx.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: auction.listing.sellerId, blockedId: input.userId },
            { blockerId: input.userId, blockedId: auction.listing.sellerId },
          ],
        },
      }),
      auction.listing.isPremiumOnly ? hasPremium(input.userId) : Promise.resolve(true),
    ]);
    if (blocked) throw new AppError("FORBIDDEN", "Les échanges avec ce vendeur sont bloqués.");
    if (!premium) throw new AppError("PAYMENT_REQUIRED", "Cette enchère est réservée aux membres A2V Prestige.");

    const minNext = minimumNextBidCents(auction, auction._count.bids);
    if (input.amountCents < minNext) {
      throw new AppError("VALIDATION", `L'offre minimum est de ${formatMoney(minNext)}.`);
    }
    if (auction.buyNowPriceCents && input.amountCents >= auction.buyNowPriceCents) {
      throw new AppError("VALIDATION", `Ce montant atteint l'achat immédiat (${formatMoney(auction.buyNowPriceCents)}). Utilisez le bouton d'achat immédiat.`);
    }

    const previousWinner = await tx.bid.findFirst({
      where: { auctionId: auction.id, status: "WINNING" },
      include: { bidder: { select: { id: true, email: true } } },
      orderBy: { amountCents: "desc" },
    });

    const withinExtension = auction.endsAt.getTime() - now.getTime() <= extensionWindow * 1000;
    const canExtend = withinExtension && auction.extensionCount < maxExtensions;
    const newEndsAt = canExtend ? new Date(auction.endsAt.getTime() + extensionSeconds * 1000) : auction.endsAt;

    // Mise à jour conditionnelle : empêche deux offres simultanées d'écraser le prix.
    const updated = await tx.auction.updateMany({
      where: {
        id: auction.id,
        status: { in: ["LIVE", "SCHEDULED"] },
        currentPriceCents: auction.currentPriceCents,
        endsAt: auction.endsAt,
        startsAt: { lte: now },
      },
      data: {
        status: "LIVE",
        currentPriceCents: input.amountCents,
        endsAt: newEndsAt,
        ...(canExtend ? { extensionCount: { increment: 1 } } : {}),
      },
    });
    if (updated.count !== 1) {
      throw new AppError("CONFLICT", "Une autre offre a été placée entre-temps. Actualisez et réessayez.", {
        status: 409,
      });
    }

    await tx.bid.updateMany({
      where: { auctionId: auction.id, status: "WINNING" },
      data: { status: "OUTBID" },
    });

    const bid = await tx.bid.create({
      data: {
        auctionId: auction.id,
        bidderId: input.userId,
        amountCents: input.amountCents,
        status: "WINNING",
      },
    });

    await tx.auctionEvent.create({
      data: {
        auctionId: auction.id,
        type: "BID_PLACED",
        actorId: input.userId,
        metadata: { amountCents: input.amountCents, extended: canExtend },
      },
    });

    if (!previousWinner || previousWinner.amountCents < (auction.reservePriceCents ?? 0)) {
      if (auction.reservePriceCents && input.amountCents >= auction.reservePriceCents) {
        await tx.auctionEvent.create({ data: { auctionId: auction.id, type: "RESERVE_MET", metadata: { amountCents: input.amountCents } } });
      }
    }

    if (canExtend) {
      await tx.auctionEvent.create({
        data: {
          auctionId: auction.id,
          type: "EXTENDED",
          metadata: { newEndsAt: newEndsAt.toISOString(), extensionCount: auction.extensionCount + 1 },
        },
      });
    }

    return {
      bid,
      endsAt: newEndsAt,
      extended: canExtend,
      wasOutbidUserId: previousWinner && previousWinner.bidderId !== input.userId ? previousWinner.bidderId : null,
      outbidEmail: previousWinner && previousWinner.bidderId !== input.userId ? previousWinner.bidder.email : null,
      sellerEmail: auction.listing.seller.email,
      reserveMet: Boolean(auction.reservePriceCents && input.amountCents >= auction.reservePriceCents),
    };
  });

  if (result.wasOutbidUserId && result.outbidEmail) {
    await notify({
      userId: result.wasOutbidUserId,
      type: "AUCTION_OUTBID",
      title: "Vous avez été dépassé",
      body: `Une offre de ${formatMoney(input.amountCents)} vient d'être placée. Replacez une offre avant la fin.`,
      href: "/compte/encheres",
      email: {
        to: result.outbidEmail,
        subject: "A2V — Vous avez été dépassé dans une enchère",
        text: `Une nouvelle offre de ${formatMoney(input.amountCents)} a été placée. Rejoignez l'enchère pour reprendre la tête.`,
      },
    });
  }
  if (result.reserveMet) {
    await notify({
      userId: result.bid.bidderId,
      type: "AUCTION_BID",
      title: "Prix de réserve atteint",
      body: "Votre offre a atteint le prix de réserve. Le vendeur est tenu de vendre si vous restez gagnant.",
      href: "/compte/encheres",
    });
  }

  await audit(input.userId, "BID_PLACED", {
    targetType: "Auction",
    targetId: input.auctionId,
    metadata: { amountCents: input.amountCents, extended: result.extended },
  });

  return {
    bidId: result.bid.id,
    amountCents: input.amountCents,
    currentPriceCents: input.amountCents,
    endsAt: result.endsAt,
    extended: result.extended,
    wasOutbidUserId: result.wasOutbidUserId,
  };
}

/** Achat immédiat d'une enchère : clôt immédiatement et désigne l'acheteur. */
export async function buyNow(auctionId: string, userId: string) {
  const paymentDeadlineHours = await getSetting("auction.paymentDeadlineHours");
  const result = await runSerializable(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      include: { listing: { include: { seller: { select: { id: true, email: true } } } } },
    });
    if (!auction) throw new AppError("NOT_FOUND", "Enchère introuvable.");
    if (!auction.buyNowPriceCents) throw new AppError("CONFLICT", "Aucun achat immédiat n'est proposé.");
    if (auction.status !== "LIVE") throw new AppError("AUCTION_CLOSED", "Cette enchère n'est pas ouverte.");
    if (auction.endsAt <= new Date()) throw new AppError("AUCTION_CLOSED", "Cette enchère est terminée.");
    if (auction.listing.sellerId === userId) throw new AppError("FORBIDDEN", "Vous ne pouvez pas acheter votre propre article.");
    if (auction.listing.isPremiumOnly && !(await hasPremium(userId))) {
      throw new AppError("PAYMENT_REQUIRED", "Cette enchère est réservée aux membres A2V Prestige.");
    }

    const now = new Date();
    const lock = await tx.auction.updateMany({
      where: { id: auction.id, status: "LIVE", endsAt: { gt: now } },
      data: { status: "ENDED", closedAt: now },
    });
    if (lock.count !== 1) throw new AppError("AUCTION_CLOSED", "Cette enchère vient de se terminer.");

    await tx.bid.updateMany({ where: { auctionId: auction.id, status: "WINNING" }, data: { status: "OUTBID" } });
    const bid = await tx.bid.create({
      data: { auctionId: auction.id, bidderId: userId, amountCents: auction.buyNowPriceCents!, status: "WON" },
    });
    const winner = await tx.auctionWinner.create({
      data: {
        auctionId: auction.id,
        userId,
        winningBidId: bid.id,
        status: "PENDING_PAYMENT",
        paymentDeadline: new Date(now.getTime() + paymentDeadlineHours * 3_600_000),
      },
    });
    await tx.auction.update({
      where: { id: auction.id },
      data: {
        winnerId: userId,
        winningBidId: bid.id,
        currentPriceCents: auction.buyNowPriceCents!,
        status: "ENDED",
        events: {
          create: [
            { type: "BUY_NOW", actorId: userId, metadata: { amountCents: auction.buyNowPriceCents } },
            { type: "WINNER_DESIGNATED", metadata: { winnerId: userId } },
          ],
        },
      },
    });
    await tx.listing.update({ where: { id: auction.listingId }, data: { status: "RESERVED" } });
    return { winner, auction, bid };
  });

  await notify({
    userId,
    type: "AUCTION_WON",
    title: "Félicitations, achat immédiat confirmé !",
    body: `Vous avez acheté « ${result.auction.listing.title} » pour ${formatMoney(result.bid.amountCents)}. Réglez votre commande avant le ${result.winner.paymentDeadline.toLocaleString("fr-FR")}.`,
    href: `/paiement-enchere/${result.winner.id}`,
  });
  await notify({
    userId: result.auction.listing.sellerId,
    type: "AUCTION_ENDED",
    title: "Votre enchère a été achetée immédiatement",
    body: `« ${result.auction.listing.title} » a été acheté pour ${formatMoney(result.bid.amountCents)}. En attente du paiement de l'acheteur.`,
    href: "/compte/ventes",
  });
  await audit(userId, "AUCTION_BUY_NOW", { targetType: "Auction", targetId: auctionId, metadata: { amountCents: result.bid.amountCents } });
  return result.winner;
}

export type CloseAuctionResult = {
  closed: boolean;
  status: "SOLD" | "RESERVE_NOT_MET" | "NO_BIDS" | "ALREADY" | "NOT_DUE";
  winnerId?: string;
  amountCents?: number;
};

/**
 * Clôture fiable côté serveur, idempotente, protégée par une mise à jour
 * conditionnelle du statut. Aucune offre ne peut être acceptée après endsAt.
 */
export async function closeAuction(auctionId: string, now = new Date()): Promise<CloseAuctionResult> {
  const paymentDeadlineHours = await getSetting("auction.paymentDeadlineHours");
  const outcome = await runSerializable(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      include: {
        listing: { include: { seller: { select: { id: true, email: true } } } },
        bids: { orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }] },
        winnerRecord: true,
      },
    });
    if (!auction) throw new AppError("NOT_FOUND", "Enchère introuvable.");
    if (auction.status !== "LIVE" && auction.status !== "SCHEDULED") {
      return {
        result: { closed: false, status: "ALREADY" as const },
        sellerId: auction.listing.sellerId,
        sellerEmail: auction.listing.seller.email,
        listingTitle: auction.listing.title,
      };
    }
    if (auction.endsAt > now) {
      return {
        result: { closed: false, status: "NOT_DUE" as const },
        sellerId: auction.listing.sellerId,
        sellerEmail: auction.listing.seller.email,
        listingTitle: auction.listing.title,
      };
    }

    const lock = await tx.auction.updateMany({
      where: { id: auction.id, status: { in: ["LIVE", "SCHEDULED"] }, endsAt: { lte: now } },
      data: { status: "ENDED", closedAt: now },
    });
    if (lock.count !== 1) {
      return {
        result: { closed: false, status: "ALREADY" as const },
        sellerId: auction.listing.sellerId,
        sellerEmail: auction.listing.seller.email,
        listingTitle: auction.listing.title,
      };
    }

    const highest = auction.bids[0] ?? null;
    const reserveMet = highest && (auction.reservePriceCents === null || highest.amountCents >= auction.reservePriceCents);

    if (!highest || !reserveMet) {
      await tx.auction.update({
        where: { id: auction.id },
        data: {
          status: highest ? "RESERVE_NOT_MET" : "ENDED",
          events: {
            create: {
              type: "ENDED",
              metadata: { reason: highest ? "RESERVE_NOT_MET" : "NO_BIDS", highestBid: highest?.amountCents ?? null },
            },
          },
        },
      });
      if (!highest) {
        await tx.listing.update({ where: { id: auction.listingId }, data: { status: "CANCELLED" } });
      }
      return {
        result: {
          closed: true,
          status: highest ? ("RESERVE_NOT_MET" as const) : ("NO_BIDS" as const),
          amountCents: highest?.amountCents,
        },
        sellerId: auction.listing.sellerId,
        sellerEmail: auction.listing.seller.email,
        listingTitle: auction.listing.title,
      };
    }

    const winner = await tx.auctionWinner.create({
      data: {
        auctionId: auction.id,
        userId: highest.bidderId,
        winningBidId: highest.id,
        status: "PENDING_PAYMENT",
        paymentDeadline: new Date(now.getTime() + paymentDeadlineHours * 3_600_000),
      },
    });

    await tx.bid.update({ where: { id: highest.id }, data: { status: "WON" } });
    await tx.bid.updateMany({
      where: { auctionId: auction.id, status: "WINNING", NOT: { id: highest.id } },
      data: { status: "OUTBID" },
    });
    await tx.auction.update({
      where: { id: auction.id },
      data: {
        status: "ENDED",
        winnerId: highest.bidderId,
        winningBidId: highest.id,
        currentPriceCents: highest.amountCents,
        events: {
          create: [
            { type: "ENDED", metadata: { amountCents: highest.amountCents } },
            { type: "WINNER_DESIGNATED", metadata: { winnerId: highest.bidderId } },
            { type: "PAYMENT_PENDING", metadata: { deadline: winner.paymentDeadline.toISOString() } },
          ],
        },
      },
    });
    await tx.listing.update({ where: { id: auction.listingId }, data: { status: "RESERVED" } });

    return {
      result: {
        closed: true,
        status: "SOLD" as const,
        winnerId: highest.bidderId,
        amountCents: highest.amountCents,
        winnerRecordId: winner.id,
      },
      sellerId: auction.listing.sellerId,
      sellerEmail: auction.listing.seller.email,
      winnerEmail: await tx.user.findUnique({ where: { id: highest.bidderId }, select: { email: true } }).then((u) => u?.email ?? null),
      listingTitle: auction.listing.title,
    };
  });

  const result = outcome.result;

  if (result.closed && result.status === "SOLD" && result.winnerId) {
    await notify({
      userId: result.winnerId,
      type: "AUCTION_WON",
      title: "Félicitations, vous avez remporté cette enchère !",
      body: `Vous avez remporté « ${outcome.listingTitle} » pour ${formatMoney(result.amountCents ?? 0)}. Réglez votre commande avant 48 h pour finaliser l'achat.`,
      href: `/paiement-enchere/${(result as { winnerRecordId: string }).winnerRecordId}`,
      email: outcome.winnerEmail
        ? {
            to: outcome.winnerEmail,
            subject: "A2V — Vous avez remporté une enchère",
            text: `Félicitations ! Vous avez remporté « ${outcome.listingTitle} » pour ${formatMoney(result.amountCents ?? 0)}. Un délai de paiement de 48 h s'applique.`,
          }
        : undefined,
    });
    await notify({
      userId: outcome.sellerId,
      type: "AUCTION_ENDED",
      title: "Votre enchère est terminée",
      body: `« ${outcome.listingTitle} » a été remportée pour ${formatMoney(result.amountCents ?? 0)}. En attente du paiement du gagnant.`,
      href: "/compte/ventes",
      email: {
        to: outcome.sellerEmail,
        subject: "A2V — Enchère terminée",
        text: `Votre enchère « ${outcome.listingTitle} » est terminée. Le gagnant dispose de 48 h pour payer.`,
      },
    });
  } else if (result.closed && (result.status === "RESERVE_NOT_MET" || result.status === "NO_BIDS")) {
    await notify({
      userId: outcome.sellerId,
      type: "AUCTION_ENDED",
      title: "Votre enchère est terminée",
      body:
        result.status === "RESERVE_NOT_MET"
          ? `« ${outcome.listingTitle} » n'a pas atteint le prix de réserve. Aucune vente ne sera conclue.`
          : `« ${outcome.listingTitle} » s'est terminée sans offre.`,
      href: "/compte/encheres",
    });
  }

  if (result.closed) {
    await audit(null, "AUCTION_CLOSED", {
      targetType: "Auction",
      targetId: auctionId,
      metadata: { status: result.status, amountCents: result.amountCents ?? null, automatic: true },
    });
    logger.info("Enchère clôturée", { auctionId, status: result.status });
  }

  return result;
}

/** Tâche planifiée : ouvre, clôture, et traite les défauts de paiement. */
export async function runAuctionLifecycle(now = new Date()) {
  const started = await prisma.auction.updateMany({
    where: { status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now } },
    data: { status: "LIVE" },
  });

  const due = await prisma.auction.findMany({
    where: { status: { in: ["LIVE", "SCHEDULED"] }, endsAt: { lte: now } },
    select: { id: true },
    take: 200,
  });

  let closed = 0;
  for (const auction of due) {
    try {
      const result = await closeAuction(auction.id, now);
      if (result.closed) closed += 1;
    } catch (error) {
      logger.error("Clôture d'enchère échouée", { auctionId: auction.id, error: String(error) });
    }
  }

  const defaulted = await markOverdueAuctionWinners(now);
  return { started: started.count, processed: due.length, closed, defaulted };
}

export async function markOverdueAuctionWinners(now = new Date()) {
  const overdue = await prisma.auctionWinner.findMany({
    where: { status: "PENDING_PAYMENT", paymentDeadline: { lt: now } },
    include: { auction: { include: { listing: true } }, user: { select: { id: true, email: true } } },
    take: 100,
  });

  let count = 0;
  for (const winner of overdue) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.auctionWinner.updateMany({
        where: { id: winner.id, status: "PENDING_PAYMENT" },
        data: { status: "DEFAULTED" },
      });
      if (updated.count !== 1) return;
      if (winner.orderId) {
        await tx.order.updateMany({
          where: { id: winner.orderId, status: "PENDING_PAYMENT" },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        await tx.listing.update({ where: { id: winner.auction.listingId }, data: { status: "CANCELLED" } });
      }
      await tx.auction.update({
        where: { id: winner.auctionId },
        data: {
          status: "ENDED",
          events: { create: { type: "PAYMENT_DEFAULTED", metadata: { winnerId: winner.userId } } },
        },
      });
      await tx.notification.create({
        data: {
          userId: winner.userId,
          type: "AUCTION_PAYMENT_DEFAULTED",
          title: "Délai de paiement dépassé",
          body: `Vous n'avez pas réglé l'enchère « ${winner.auction.listing.title} » dans le délai de 48 h. La vente est annulée.`,
          href: "/compte/encheres",
        },
      });
      await tx.notification.create({
        data: {
          userId: winner.auction.listing.sellerId,
          type: "AUCTION_PAYMENT_DEFAULTED",
          title: "Le gagnant n'a pas payé",
          body: `L'enchère « ${winner.auction.listing.title} » n'a pas été réglée dans le délai. Aucune vente n'est finalisée.`,
          href: "/compte/ventes",
        },
      });
      count += 1;
    });
  }
  return count;
}

export async function getAuctionBySlug(slug: string) {
  return prisma.listing.findFirst({
    where: { slug, saleType: "AUCTION", deletedAt: null },
    include: {
      images: { orderBy: { position: "asc" } },
      category: true,
      seller: {
        select: {
          id: true,
          publicName: true,
          profile: { select: { avatarUrl: true, city: true } },
          _count: { select: { reviewsReceived: true } },
        },
      },
      auction: {
        include: {
          bids: {
            orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }],
            take: 20,
            include: { bidder: { select: { id: true, publicName: true } } },
          },
          winnerRecord: true,
          _count: { select: { bids: true } },
        },
      },
    },
  });
}

export type AuctionsListFilters = {
  status?: "live" | "open" | "ending" | "ended" | "all";
  sort?: "ending" | "recent" | "price";
  page?: number;
  pageSize?: number;
  viewerIsPremium?: boolean;
  category?: string;
  /** Ne retourner que les enchères réservées Prestige. */
  premiumOnly?: boolean;
};

export async function getAuctionsList(filters: AuctionsListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, filters.pageSize ?? 12);
  const now = new Date();
  const where: Prisma.AuctionWhereInput = {
    listing: {
      deletedAt: null,
      status: { not: "DRAFT" },
      ...(filters.premiumOnly
        ? { isPremiumOnly: true }
        : filters.viewerIsPremium
          ? {}
          : { isPremiumOnly: false }),
    },
  };

  if (filters.status === "live") {
    where.status = "LIVE";
    where.endsAt = { gt: now };
  } else if (filters.status === "open") {
    // Une enchère dont l'échéance est passée mais que le cron n'a pas encore
    // finalisée ne doit pas être présentée comme « en cours ».
    where.status = { in: ["LIVE", "SCHEDULED"] };
    where.endsAt = { gt: now };
  } else if (filters.status === "ending") {
    where.status = "LIVE";
    where.endsAt = { lte: new Date(now.getTime() + 24 * 3_600_000), gt: now };
  } else if (filters.status === "ended") where.status = { in: ["ENDED", "SOLD", "RESERVE_NOT_MET"] };

  if (filters.category) {
    const category = await prisma.category.findUnique({ where: { slug: filters.category }, include: { children: true } });
    if (category) {
      where.listing = {
        ...(where.listing as Prisma.ListingWhereInput),
        categoryId: { in: [category.id, ...category.children.map((child) => child.id)] },
      };
    }
  }

  const orderBy: Prisma.AuctionOrderByWithRelationInput[] =
    filters.sort === "recent"
      ? [{ createdAt: "desc" }]
      : filters.sort === "price"
        ? [{ currentPriceCents: "desc" }]
        : [{ endsAt: "asc" }];

  const [items, total] = await Promise.all([
    prisma.auction.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        listing: {
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            category: { select: { name: true } },
            seller: { select: { publicName: true } },
          },
        },
        _count: { select: { bids: true } },
      },
    }),
    prisma.auction.count({ where }),
  ]);

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAuctionWinnerForCheckout(winnerId: string, userId: string) {
  const winner = await prisma.auctionWinner.findUnique({
    where: { id: winnerId },
    include: {
      user: { select: { id: true, publicName: true } },
      winningBid: true,
      auction: { include: { listing: { include: { images: { orderBy: { position: "asc" }, take: 1 }, seller: { select: { id: true, publicName: true } } } } } },
      order: true,
    },
  });
  if (!winner) throw new AppError("NOT_FOUND", "Résultat d'enchère introuvable.");
  if (winner.userId !== userId) throw new AppError("FORBIDDEN", "Vous n'êtes pas le gagnant de cette enchère.");
  return winner;
}

export async function getUserAuctionActivity(userId: string) {
  const [bids, wins] = await Promise.all([
    prisma.bid.findMany({
      where: { bidderId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        auction: {
          include: {
            listing: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
            winnerRecord: true,
            _count: { select: { bids: true } },
          },
        },
      },
    }),
    prisma.auctionWinner.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        auction: { include: { listing: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } } },
        winningBid: true,
        order: { select: { orderNumber: true, status: true } },
      },
    }),
  ]);
  return { bids, wins };
}

/** Libellé de résultat d'enchère pour l'utilisateur connecté. */
export function auctionResultLabel(
  auction: {
    status: string;
    endsAt: Date;
    winnerId: string | null;
    reservePriceCents: number | null;
    currentPriceCents: number;
  },
  userId: string | null,
  winnerOrderStatus?: string | null,
): { label: string; tone: "live" | "won" | "lost" | "pending" | "ended" | "finalized" } {
  if (auction.status === "LIVE" && auction.endsAt > new Date()) return { label: "Enchère en cours", tone: "live" };
  if (auction.status === "SCHEDULED" && auction.endsAt > new Date()) return { label: "Enchère à venir", tone: "live" };
  if (auction.status === "RESERVE_NOT_MET") return { label: "Enchère terminée — prix de réserve non atteint", tone: "ended" };
  if (auction.status === "CANCELLED") return { label: "Enchère annulée", tone: "ended" };
  if (winnerOrderStatus === "FINALIZED") return { label: "Vente finalisée", tone: "finalized" };
  if (userId && auction.winnerId === userId) {
    if (winnerOrderStatus === "PENDING_PAYMENT" || !winnerOrderStatus) {
      return { label: "Enchère remportée par vous — paiement en attente", tone: "pending" };
    }
    return { label: "Enchère remportée par vous", tone: "won" };
  }
  if (auction.winnerId) return { label: "Cette enchère a été remportée par un autre acheteur", tone: "lost" };
  return { label: "Enchère terminée", tone: "ended" };
}
