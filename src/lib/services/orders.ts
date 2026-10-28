import "server-only";

import { Prisma, type OrderStatus, type PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { paymentsSimulationEnabled, stripeEnabled } from "@/lib/env";
import { applyBps, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { getSetting } from "@/lib/services/settings";
import { resolveDiscount, type DiscountResult } from "@/lib/services/coupons";
import { getQuoteForService } from "@/lib/services/shipping";
import { notify } from "@/lib/services/notifications";
import { audit } from "@/lib/services/audit";
import { awardTrophiesForFinalizedOrder } from "@/lib/services/trophies";
import { createOrderCheckoutSession, refundStripePayment } from "@/lib/integrations/stripe";
import { logger } from "@/lib/logger";
import { hasPremium } from "@/lib/services/premium";

export type CommissionBreakdown = {
  rateBps: number;
  baseCents: number;
  commissionCents: number;
  sellerPayoutCents: number;
};

/**
 * Commission A2V : 0,5 % par défaut, calculée côté serveur sur le prix de
 * l'article hors livraison. La réduction trophée/coupon est financée par A2V
 * et ne réduit pas la part vendeur (base configurable).
 */
export function computeCommission(itemPriceCents: number, discountCents: number, rateBps: number): CommissionBreakdown {
  if (!Number.isInteger(itemPriceCents) || itemPriceCents < 0) throw new AppError("VALIDATION", "Prix invalide.");
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new AppError("INTERNAL", "Taux de commission invalide.");
  }
  const baseCents = Math.max(0, itemPriceCents);
  const commissionCents = Math.min(baseCents, applyBps(baseCents, rateBps));
  return {
    rateBps,
    baseCents,
    commissionCents,
    sellerPayoutCents: baseCents - commissionCents,
  };
}

function orderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `A2V-${date}-${suffix}`;
}

export type CreateOrderInput = {
  buyerId: string;
  listingId: string;
  addressId: string;
  shippingService: string;
  couponCode?: string | null;
  buyerNote?: string | null;
  auctionWinnerId?: string | null;
  /** Prix imposé par le serveur pour une enchère (montant de l'offre gagnante). */
  itemPriceOverrideCents?: number | null;
};

export type CreatedOrder = Awaited<ReturnType<typeof createOrder>>;

export async function createOrder(input: CreateOrderInput) {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    include: {
      seller: { select: { id: true, publicName: true, email: true, profile: { select: { stripeAccountId: true } } } },
      images: { orderBy: { position: "asc" }, take: 1 },
      auction: { include: { winnerRecord: true } },
    },
  });
  if (!listing || listing.deletedAt) throw new AppError("NOT_FOUND", "Annonce introuvable.");
  if (listing.sellerId === input.buyerId) throw new AppError("CONFLICT", "Vous ne pouvez pas acheter votre propre article.");
  if (!["PUBLISHED", "RESERVED"].includes(listing.status)) {
    throw new AppError("CONFLICT", "Cet article n'est plus disponible.");
  }
  if (listing.isPremiumOnly && !(await hasPremium(input.buyerId))) {
    throw new AppError("PAYMENT_REQUIRED", "Cet article est réservé aux membres A2V Prestige.");
  }

  const address = await prisma.address.findFirst({ where: { id: input.addressId, userId: input.buyerId } });
  if (!address) throw new AppError("VALIDATION", "Adresse de livraison invalide.");

  let itemPriceCents = listing.priceCents;
  let auctionWinnerId: string | null = null;

  if (listing.saleType === "AUCTION") {
    if (!input.auctionWinnerId || !listing.auction) {
      throw new AppError("CONFLICT", "Cette enchère doit être payée depuis votre espace « Mes enchères ».");
    }
    const winner = await prisma.auctionWinner.findUnique({
      where: { id: input.auctionWinnerId },
      include: { auction: { include: { listing: true } } },
    });
    if (!winner || winner.auctionId !== listing.auction.id) throw new AppError("NOT_FOUND", "Résultat d'enchère introuvable.");
    if (winner.userId !== input.buyerId) throw new AppError("FORBIDDEN", "Vous n'êtes pas le gagnant de cette enchère.");
    if (winner.status !== "PENDING_PAYMENT") throw new AppError("CONFLICT", "Cette enchère a déjà été réglée ou annulée.");
    if (winner.paymentDeadline < new Date()) {
      throw new AppError("CONFLICT", "Le délai de paiement de cette enchère est dépassé.");
    }
    const winningBid = await prisma.bid.findUnique({ where: { id: winner.winningBidId } });
    if (!winningBid) throw new AppError("CONFLICT", "Offre gagnante introuvable.");
    itemPriceCents = winningBid.amountCents;
    auctionWinnerId = winner.id;
  } else {
    if (input.auctionWinnerId) throw new AppError("VALIDATION", "Cette annonce n'est pas une enchère.");
    if (input.itemPriceOverrideCents) {
      throw new AppError("FORBIDDEN", "Le prix d'un achat immédiat ne peut pas être modifié.");
    }
  }

  const quote = await getQuoteForService(input.shippingService);
  const shippingCents = quote.priceCents;
  const discount: DiscountResult | null = await resolveDiscount({
    userId: input.buyerId,
    subtotalCents: itemPriceCents,
    couponCode: input.couponCode,
  });
  const discountCents = discount?.discountCents ?? 0;
  const [rateBps, commissionBaseSetting] = await Promise.all([
    getSetting("commission.rateBps"),
    getSetting("commission.base"),
  ]);
  const commissionBase =
    commissionBaseSetting === "ITEM_PRICE_AFTER_DISCOUNT"
      ? Math.max(0, itemPriceCents - discountCents)
      : itemPriceCents;
  const commission = computeCommission(commissionBase, 0, rateBps);
  const buyerTotalCents = Math.max(0, itemPriceCents + shippingCents - discountCents);

  const number = orderNumber();

  const created = await prisma.$transaction(
    async (tx) => {
      // Verrou optimiste : une seule commande peut réserver l'annonce.
      const lock = await tx.listing.updateMany({
        where: {
          id: listing.id,
          status: listing.saleType === "AUCTION" ? "RESERVED" : "PUBLISHED",
          deletedAt: null,
        },
        data: { status: "RESERVED" },
      });
      if (lock.count !== 1) throw new AppError("CONFLICT", "Cet article vient d'être réservé par un autre acheteur.");

      if (auctionWinnerId) {
        const winnerLock = await tx.auctionWinner.updateMany({
          where: { id: auctionWinnerId, status: "PENDING_PAYMENT", orderId: null },
          data: { status: "PENDING_PAYMENT" },
        });
        if (winnerLock.count !== 1) throw new AppError("CONFLICT", "Cette enchère a déjà été réglée.");
      }

      const order = await tx.order.create({
        data: {
          orderNumber: number,
          buyerId: input.buyerId,
          sellerId: listing.sellerId,
          listingId: listing.id,
          status: "PENDING_PAYMENT",
          itemPriceCents,
          shippingCents,
          discountCents,
          discountSource: discount?.source ?? null,
          commissionCents: commission.commissionCents,
          commissionRateBps: rateBps,
          buyerTotalCents,
          sellerPayoutCents: commission.sellerPayoutCents,
          shippingMethod: input.shippingService,
          shippingAddressId: address.id,
          buyerNote: input.buyerNote || null,
          items: {
            create: {
              listingId: listing.id,
              titleSnapshot: listing.title,
              imageSnapshot: listing.images[0]?.url ?? null,
              priceCents: itemPriceCents,
            },
          },
          commission: {
            create: {
              rateBps,
              baseCents: commission.baseCents,
              amountCents: commission.commissionCents,
              status: "PENDING",
            },
          },
          payments: {
            create: {
              userId: input.buyerId,
              idempotencyKey: `order:${number}`,
              provider: stripeEnabled && !paymentsSimulationEnabled ? "STRIPE" : "SIMULATED",
              type: auctionWinnerId ? "AUCTION_ORDER" : "ORDER",
              amountCents: buyerTotalCents,
              status: "PENDING",
              metadata: { orderNumber: number, auctionWinnerId },
            },
          },
        },
        include: { payments: true, items: true, commission: true },
      });

      if (auctionWinnerId) {
        await tx.auctionWinner.update({
          where: { id: auctionWinnerId },
          data: { orderId: order.id },
        });
      }

      if (discount?.coupon) {
        await tx.couponRedemption.create({
          data: {
            couponId: discount.coupon.id,
            userId: input.buyerId,
            orderId: order.id,
            amountCents: discountCents,
          },
        });
      }

      await tx.transactionEvent.create({
        data: {
          orderId: order.id,
          actorId: input.buyerId,
          type: "ORDER_CREATED",
          amountCents: buyerTotalCents,
          metadata: {
            itemPriceCents,
            shippingCents,
            discountCents,
            commissionCents: commission.commissionCents,
            discountSource: discount?.source ?? null,
            simulatedShipping: quote.isSimulated,
          },
        },
      });

      return order;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await notify({
    userId: listing.sellerId,
    type: "ORDER_CREATED",
    title: "Votre article est réservé",
    body: `« ${listing.title} » est réservé par un acheteur. Vous serez notifié dès la confirmation du paiement.`,
    href: "/compte/ventes",
    email: {
      to: listing.seller.email,
      subject: `A2V — Article réservé : ${listing.title}`,
      text: `Votre article « ${listing.title} » vient d'être réservé. La vente sera confirmée après paiement.`,
    },
  });
  await notify({
    userId: input.buyerId,
    type: "ORDER_CREATED",
    title: "Commande créée",
    body: `Commande ${created.orderNumber} — ${formatMoney(buyerTotalCents)}. Finalisez le paiement pour confirmer votre achat.`,
    href: `/commande/${created.orderNumber}`,
  });
  await audit(input.buyerId, "ORDER_CREATED", {
    targetType: "Order",
    targetId: created.id,
    metadata: { total: buyerTotalCents, commission: commission.commissionCents },
  });

  return created;
}

export async function getOrderForCheckout(orderNumber: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      listing: { include: { images: { orderBy: { position: "asc" }, take: 1 }, seller: { select: { publicName: true } } } },
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      shippingAddress: true,
      shipment: { include: { label: true, events: { orderBy: { occurredAt: "desc" } } } },
      commission: true,
      buyer: { select: { id: true, publicName: true, email: true } },
      seller: { select: { id: true, publicName: true, email: true } },
      auctionWinner: true,
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.buyerId !== userId && order.sellerId !== userId) throw new AppError("FORBIDDEN", "Accès refusé.");
  return order;
}

async function markOrderPaidInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  options: { provider: PaymentProvider; providerRef: string },
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { payments: true, auctionWinner: true, listing: { include: { auction: true } }, seller: true, buyer: true },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.status === "PAID" || order.status === "PREPARING" || order.status === "SHIPPED" || order.status === "DELIVERED" || order.status === "FINALIZED") {
    return { order, alreadyPaid: true };
  }
  if (order.status !== "PENDING_PAYMENT") {
    throw new AppError("CONFLICT", "Cette commande ne peut pas être payée dans son état actuel.");
  }

  const payment = order.payments.find((candidate) => candidate.status === "PENDING") ?? order.payments[0];
  if (!payment) throw new AppError("INTERNAL", "Paiement introuvable.");

  const now = new Date();
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      provider: options.provider,
      providerRef: options.providerRef,
    },
  });
  const updated = await tx.order.update({
    where: { id: order.id },
    data: { status: "PAID", paidAt: now },
    include: { listing: true, auctionWinner: true, seller: true, buyer: true },
  });
  await tx.listing.update({ where: { id: order.listingId }, data: { status: "PAID" } });

  if (order.auctionWinner) {
    await tx.auctionWinner.update({ where: { id: order.auctionWinner.id }, data: { status: "PAID" } });
    if (order.listing.auction) {
      await tx.auction.update({
        where: { id: order.listing.auction.id },
        data: {
          status: "SOLD",
          events: { create: { type: "PAYMENT_PENDING", metadata: { paid: true, orderId: order.id } } },
        },
      });
    }
  }

  await tx.transactionEvent.create({
    data: {
      orderId: order.id,
      paymentId: payment.id,
      actorId: null,
      type: "PAYMENT_SUCCEEDED",
      amountCents: order.buyerTotalCents,
      metadata: { provider: options.provider, providerRef: options.providerRef },
    },
  });

  return { order: updated, alreadyPaid: false };
}

async function afterOrderPaid(order: Awaited<ReturnType<typeof markOrderPaidInTx>>["order"]) {
  await notify({
    userId: order.buyerId,
    type: "ORDER_PAID",
    title: "Achat confirmé !",
    body: `Votre paiement de ${formatMoney(order.buyerTotalCents)} est confirmé pour ${order.orderNumber}. Le vendeur prépare votre colis.`,
    href: `/commande/${order.orderNumber}`,
    email: {
      to: order.buyer.email,
      subject: `A2V — Achat confirmé (${order.orderNumber})`,
      text: `Votre achat est confirmé. Montant : ${formatMoney(order.buyerTotalCents)}. Suivez votre commande depuis votre compte A2V.`,
    },
  });
  await notify({
    userId: order.sellerId,
    type: "ORDER_PAID",
    title: "Votre article a été acheté !",
    body: `La commande ${order.orderNumber} est payée. Préparez le colis et générez l'étiquette de livraison.`,
    href: "/compte/ventes",
    email: {
      to: order.seller.email,
      subject: `A2V — Vente confirmée (${order.orderNumber})`,
      text: `Votre article a été acheté. Commande ${order.orderNumber}, montant qui vous revient : ${formatMoney(order.sellerPayoutCents)} (commission A2V de ${formatMoney(order.commissionCents)}).`,
    },
  });
}

/** Paiement simulé explicite (développement / démonstration). */
export async function payOrderSimulated(orderNumber: string, userId: string) {
  if (!paymentsSimulationEnabled) {
    throw new AppError("NOT_CONFIGURED", "Les paiements simulés sont désactivés. Utilisez le paiement Stripe.");
  }
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.buyerId !== userId) throw new AppError("FORBIDDEN", "Seul l'acheteur peut payer cette commande.");

  const result = await prisma.$transaction(
    (tx) =>
      markOrderPaidInTx(tx, order.id, {
        provider: "SIMULATED",
        providerRef: `sim_order_${order.orderNumber}`,
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!result.alreadyPaid) {
    await afterOrderPaid(result.order);
    await audit(userId, "ORDER_PAID_SIMULATED", {
      targetType: "Order",
      targetId: order.id,
      metadata: { simulated: true, amountCents: order.buyerTotalCents },
    });
  }
  return { alreadyPaid: result.alreadyPaid, orderNumber: order.orderNumber };
}

/** Crée une session Stripe Checkout ; le webhook signé seul confirme le paiement. */
export async function startStripeCheckout(orderNumber: string, userId: string, baseUrl: string) {
  if (!stripeEnabled) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Le paiement Stripe n'est pas configuré. Renseignez STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET.",
    );
  }
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      buyer: { select: { email: true } },
      seller: { select: { profile: { select: { stripeAccountId: true } } } },
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.buyerId !== userId) throw new AppError("FORBIDDEN", "Accès refusé.");
  if (order.status !== "PENDING_PAYMENT") throw new AppError("CONFLICT", "Cette commande n'est plus en attente de paiement.");

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) throw new AppError("INTERNAL", "Paiement introuvable.");

  const session = await createOrderCheckoutSession({
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentId: payment.id,
    amountCents: order.buyerTotalCents,
    commissionCents: order.commissionCents,
    buyerEmail: order.buyer.email,
    sellerStripeAccountId: order.seller.profile?.stripeAccountId,
    label: order.orderNumber,
    successUrl: `${baseUrl}/paiement/succes?commande=${order.orderNumber}`,
    cancelUrl: `${baseUrl}/commande/${order.orderNumber}`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { provider: "STRIPE", providerRef: session.id },
  });
  return { url: session.url };
}

/** Appelé uniquement après vérification de signature du webhook Stripe. */
export async function handleStripeOrderPaid(input: {
  orderId: string;
  paymentId?: string;
  providerRef: string;
}) {
  const result = await prisma.$transaction(
    (tx) => markOrderPaidInTx(tx, input.orderId, { provider: "STRIPE", providerRef: input.providerRef }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (!result.alreadyPaid) {
    await afterOrderPaid(result.order);
    logger.info("Paiement Stripe confirmé", { orderId: input.orderId });
  }
  return result;
}

export async function getOrderByNumberForUser(orderNumber: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      listing: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
      buyer: { select: { id: true, publicName: true, email: true } },
      seller: { select: { id: true, publicName: true, email: true } },
      shippingAddress: true,
      shipment: { include: { label: true, events: { orderBy: { occurredAt: "desc" } } } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: true,
      commission: true,
      disputes: { orderBy: { createdAt: "desc" } },
      review: true,
      auctionWinner: { include: { auction: { include: { listing: { select: { slug: true } } } } } },
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.buyerId !== userId && order.sellerId !== userId) throw new AppError("FORBIDDEN", "Accès refusé.");
  return order;
}

export async function markOrderPreparing(orderId: string, sellerId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.sellerId !== sellerId) throw new AppError("FORBIDDEN", "Accès refusé.");
  if (order.status !== "PAID") throw new AppError("CONFLICT", "La commande doit être payée.");
  return prisma.order.update({ where: { id: orderId }, data: { status: "PREPARING" } });
}

export async function finalizeOrder(orderId: string, options: { actorId?: string | null; automatic?: boolean } = {}) {
  const delayDays = await getSetting("order.finalizationDelayDays");

  const outcome = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
          commission: true,
          auctionWinner: true,
        },
      });
      if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
      if (order.status === "FINALIZED") return { already: true, eligible: true };
      if (!order.paidAt) throw new AppError("CONFLICT", "La commande n'a pas été payée.");
      if (order.status !== "DELIVERED") throw new AppError("CONFLICT", "La commande doit être livrée avant finalisation.");
      if (order.disputes.length > 0) throw new AppError("CONFLICT", "Un litige est ouvert : la finalisation est suspendue.");
      if (!order.deliveredAt) throw new AppError("CONFLICT", "Date de livraison manquante.");

      if (options.automatic) {
        const eligibleAt = new Date(order.deliveredAt.getTime() + delayDays * 86_400_000);
        if (eligibleAt > new Date()) return { already: false, eligible: false };
      }

      const now = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: { status: "FINALIZED", finalizedAt: now, listing: { update: { status: "FINALIZED" } } },
      });
      if (order.commission) {
        await tx.commission.update({ where: { id: order.commission.id }, data: { status: "EARNED", earnedAt: now } });
      }
      await tx.transactionEvent.createMany({
        data: [
          {
            orderId: order.id,
            actorId: options.actorId ?? null,
            type: "ORDER_FINALIZED",
            amountCents: order.buyerTotalCents,
            metadata: { automatic: Boolean(options.automatic) },
          },
          {
            orderId: order.id,
            actorId: null,
            type: "COMMISSION_EARNED",
            amountCents: order.commissionCents,
            metadata: { rateBps: order.commissionRateBps, baseCents: order.itemPriceCents },
          },
          {
            orderId: order.id,
            actorId: null,
            type: "PAYOUT_SIMULATED",
            amountCents: order.sellerPayoutCents,
            metadata: {
              simulated: true,
              note: "Versement au vendeur non exécuté : géré par Stripe Connect en production.",
            },
          },
        ],
      });
      return { already: false, eligible: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (outcome.already || !outcome.eligible) {
    return { finalized: false, already: outcome.already, trophies: [] };
  }

  const finalizedOrder = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { auctionWinner: true, buyer: true, seller: true },
  });
  const trophies = finalizedOrder.auctionWinner ? await awardTrophiesForFinalizedOrder(finalizedOrder.id) : [];

  await notify({
    userId: finalizedOrder.buyerId,
    type: "ORDER_FINALIZED",
    title: "Vente finalisée",
    body: `La commande ${finalizedOrder.orderNumber} est finalisée. Merci pour votre achat${trophies.length ? ` — trophée ${trophies.map((trophy) => trophy.name).join(", ")} débloqué !` : "."}`,
    href: "/compte/achats",
  });
  await notify({
    userId: finalizedOrder.sellerId,
    type: "ORDER_FINALIZED",
    title: "Vente finalisée",
    body: `La commande ${finalizedOrder.orderNumber} est finalisée. Montant vendeur : ${formatMoney(finalizedOrder.sellerPayoutCents)} (commission A2V ${formatMoney(finalizedOrder.commissionCents)}). Le versement est traité par le prestataire de paiement.`,
    href: "/compte/ventes",
  });
  await audit(options.actorId ?? null, "ORDER_FINALIZED", {
    targetType: "Order",
    targetId: finalizedOrder.id,
    metadata: { automatic: Boolean(options.automatic), trophies: trophies.map((trophy) => trophy.code) },
  });

  return { finalized: true, already: false, trophies };
}

export async function confirmReception(orderId: string, buyerId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shipment: true },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.buyerId !== buyerId) throw new AppError("FORBIDDEN", "Accès refusé.");
  if (!["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(order.status)) {
    throw new AppError("CONFLICT", "La commande n'est pas encore expédiée.");
  }
  if (order.status !== "DELIVERED") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    await prisma.listing.update({ where: { id: order.listingId }, data: { status: "DELIVERED" } });
    if (order.shipment && order.shipment.status !== "DELIVERED") {
      await prisma.shipment.update({
        where: { id: order.shipment.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          lastEventAt: new Date(),
          events: {
            create: {
              status: "DELIVERED",
              message: "Réception confirmée par l'acheteur",
              source: "BUYER",
            },
          },
        },
      });
    }
  }
  return finalizeOrder(orderId, { actorId: buyerId });
}

export async function finalizeEligibleOrders(now = new Date()) {
  const delayDays = await getSetting("order.finalizationDelayDays");
  const eligible = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lte: new Date(now.getTime() - delayDays * 86_400_000) },
      disputes: { none: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
    },
    select: { id: true },
  });
  let finalized = 0;
  for (const order of eligible) {
    try {
      const result = await finalizeOrder(order.id, { automatic: true });
      if (result.finalized) finalized += 1;
    } catch (error) {
      logger.error("Finalisation automatique échouée", { orderId: order.id, error: String(error) });
    }
  }
  return { candidates: eligible.length, finalized };
}

export async function cancelOrder(orderId: string, actorId: string, reason: string, isAdmin = false) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: true,
      auctionWinner: true,
      listing: { include: { auction: true } },
      commission: true,
      seller: true,
      buyer: true,
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  const isBuyer = order.buyerId === actorId;
  const isSeller = order.sellerId === actorId;
  if (!isAdmin && !isSeller && !isBuyer) throw new AppError("FORBIDDEN", "Accès refusé.");
  if (!isAdmin && isBuyer && !["PENDING_PAYMENT", "PAID"].includes(order.status)) {
    throw new AppError("CONFLICT", "L'expédition a commencé : ouvrez un litige pour demander un retour.");
  }
  if (!["PENDING_PAYMENT", "PAID", "PREPARING"].includes(order.status)) {
    throw new AppError("CONFLICT", "Cette commande ne peut plus être annulée (déjà expédiée).");
  }

  const paid = order.payments.some((payment) => payment.status === "SUCCEEDED");
  const refundAmount = paid ? order.buyerTotalCents : 0;
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      if (paid) {
        await tx.refund.create({
          data: {
            orderId: order.id,
            requestedById: actorId,
            amountCents: refundAmount,
            reason,
            status: "PROCESSED",
            providerRef: `sim_refund_${order.orderNumber}`,
            processedAt: now,
          },
        });
        await tx.payment.updateMany({
          where: { orderId: order.id, status: "SUCCEEDED" },
          data: { status: "REFUNDED" },
        });
        await tx.transactionEvent.create({
          data: {
            orderId: order.id,
            actorId,
            type: "PAYMENT_REFUNDED",
            amountCents: refundAmount,
            metadata: { simulated: true, reason },
          },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: paid ? "REFUNDED" : "CANCELLED", cancelledAt: now, ...(paid ? { refundedAt: now } : {}) },
      });
      if (order.commission && order.commission.status !== "EARNED") {
        await tx.commission.update({ where: { id: order.commission.id }, data: { status: "CANCELLED" } });
      }
      if (order.auctionWinner) {
        await tx.auctionWinner.update({ where: { id: order.auctionWinner.id }, data: { status: "CANCELLED" } });
        if (order.listing.auction) {
          await tx.auction.update({
            where: { id: order.listing.auction.id },
            data: { status: "CANCELLED", events: { create: { type: "CANCELLED", actorId } } },
          });
        }
        await tx.listing.update({ where: { id: order.listingId }, data: { status: "CANCELLED" } });
      } else {
        await tx.listing.update({
          where: { id: order.listingId },
          data: order.listing.deletedAt
            ? { status: "CANCELLED" }
            : { status: "PUBLISHED", publishedAt: order.listing.publishedAt ?? now },
        });
      }
      await tx.transactionEvent.create({
        data: {
          orderId: order.id,
          actorId,
          type: "ORDER_CANCELLED",
          metadata: { reason, refunded: paid, refundAmount },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await notify({
    userId: order.buyerId,
    type: "ORDER_CANCELLED",
    title: paid ? "Commande annulée et remboursée" : "Commande annulée",
    body: `La commande ${order.orderNumber} a été annulée.${paid ? ` Un remboursement de ${formatMoney(refundAmount)} a été enregistré (simulation).` : ""}`,
    href: "/compte/achats",
  });
  await notify({
    userId: order.sellerId,
    type: "ORDER_CANCELLED",
    title: "Commande annulée",
    body: `La commande ${order.orderNumber} a été annulée. Motif : ${reason}.`,
    href: "/compte/ventes",
  });
  await audit(actorId, paid ? "ORDER_REFUNDED" : "ORDER_CANCELLED", {
    targetType: "Order",
    targetId: order.id,
    metadata: { reason, amountCents: refundAmount, isAdmin },
  });
  return { refunded: paid, amountCents: refundAmount };
}

export async function refundOrder(orderId: string, adminId: string, amountCents: number, reason: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, commission: true, listing: true },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (["CANCELLED", "REFUNDED"].includes(order.status)) throw new AppError("CONFLICT", "Commande déjà annulée ou remboursée.");
  const succeeded = order.payments.find((payment) => payment.status === "SUCCEEDED");
  if (!succeeded) throw new AppError("CONFLICT", "Aucun paiement réussi à rembourser.");
  if (amountCents <= 0 || amountCents > order.buyerTotalCents) throw new AppError("VALIDATION", "Montant de remboursement invalide.");

  if (succeeded.provider === "STRIPE" && succeeded.providerRef) {
    const stripeRefund = await refundStripePayment(succeeded.providerRef, amountCents);
    logger.info("Remboursement Stripe créé", { refundId: stripeRefund.id, orderId: order.id });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        orderId: order.id,
        requestedById: adminId,
        amountCents,
        reason,
        status: "PROCESSED",
        providerRef: `manual_${Date.now().toString(36)}`,
        processedAt: now,
      },
    });
    await tx.payment.update({
      where: { id: succeeded.id },
      data: { status: amountCents === order.buyerTotalCents ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED", refundedAt: now },
    });
    await tx.listing.update({ where: { id: order.listingId }, data: { status: "REFUNDED" } });
    if (order.commission) {
      await tx.commission.update({ where: { id: order.commission.id }, data: { status: "REFUNDED" } });
    }
    await tx.transactionEvent.create({
      data: {
        orderId: order.id,
        actorId: adminId,
        type: "PAYMENT_REFUNDED",
        amountCents,
        metadata: { reason, partial: amountCents < order.buyerTotalCents },
      },
    });
  });

  await notify({
    userId: order.buyerId,
    type: "ORDER_CANCELLED",
    title: "Remboursement effectué",
    body: `Un remboursement de ${formatMoney(amountCents)} a été effectué pour la commande ${order.orderNumber}.`,
    href: "/compte/achats",
  });
  await audit(adminId, "REFUND_PROCESSED", {
    targetType: "Order",
    targetId: order.id,
    metadata: { amountCents, reason },
  });
  return { amountCents };
}

export async function openDispute(orderId: string, userId: string, reason: string, description: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.buyerId !== userId && order.sellerId !== userId) throw new AppError("FORBIDDEN", "Accès refusé.");
  if (order.disputes.length > 0) throw new AppError("CONFLICT", "Un litige est déjà ouvert pour cette commande.");
  if (["CANCELLED", "REFUNDED"].includes(order.status)) throw new AppError("CONFLICT", "Commande annulée ou remboursée.");
  if (order.finalizedAt && order.finalizedAt.getTime() < Date.now() - 30 * 86_400_000) {
    throw new AppError("CONFLICT", "Le délai de contestation (30 jours après finalisation) est dépassé.");
  }

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: { orderId, openedById: userId, reason, description, status: "OPEN" },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: "DISPUTED" } });
    await tx.listing.update({ where: { id: order.listingId }, data: { status: "DISPUTED" } });
    await tx.transactionEvent.create({
      data: { orderId, actorId: userId, type: "DISPUTE_OPENED", metadata: { disputeId: created.id, reason } },
    });
    return created;
  });

  const counterpart = order.buyerId === userId ? order.sellerId : order.buyerId;
  await notify({
    userId: counterpart,
    type: "ORDER_CANCELLED",
    title: "Un litige a été ouvert",
    body: `La commande ${order.orderNumber} fait l'objet d'un litige. L'équipe A2V va examiner la situation.`,
    href: "/compte/commandes",
  });
  await audit(userId, "DISPUTE_OPENED", { targetType: "Dispute", targetId: dispute.id, metadata: { orderId, reason } });
  return dispute;
}

export async function resolveDispute(input: {
  disputeId: string;
  adminId: string;
  status: "RESOLVED" | "REJECTED";
  resolution: string;
  releaseFunds?: boolean;
}) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: input.disputeId },
    include: { order: true },
  });
  if (!dispute) throw new AppError("NOT_FOUND", "Litige introuvable.");
  if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) throw new AppError("CONFLICT", "Litige déjà traité.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id: dispute.id },
      data: { status: input.status, resolution: input.resolution, resolvedAt: now },
    });
    const restoredStatus: OrderStatus = input.releaseFunds
      ? "DELIVERED"
      : dispute.order.deliveredAt
        ? "DELIVERED"
        : dispute.order.paidAt
          ? "PAID"
          : "PENDING_PAYMENT";
    await tx.order.update({
      where: { id: dispute.orderId },
      data: { status: restoredStatus },
    });
    await tx.listing.update({
      where: { id: dispute.order.listingId },
      data: {
        status:
          restoredStatus === "DELIVERED" ? "DELIVERED" : restoredStatus === "PAID" ? "PAID" : "RESERVED",
      },
    });
    await tx.transactionEvent.create({
      data: {
        orderId: dispute.orderId,
        actorId: input.adminId,
        type: "DISPUTE_RESOLVED",
        metadata: { resolution: input.resolution, releaseFunds: Boolean(input.releaseFunds) },
      },
    });
  });

  if (input.releaseFunds) {
    await finalizeOrder(dispute.orderId, { actorId: input.adminId });
  }
  await notify({
    userId: dispute.order.buyerId,
    type: "ORDER_CANCELLED",
    title: "Litige résolu",
    body: `Le litige concernant la commande ${dispute.order.orderNumber} a été traité : ${input.resolution}`,
    href: "/compte/commandes",
  });
  await notify({
    userId: dispute.order.sellerId,
    type: "ORDER_CANCELLED",
    title: "Litige résolu",
    body: `Le litige concernant la commande ${dispute.order.orderNumber} a été traité : ${input.resolution}`,
    href: "/compte/ventes",
  });
  await audit(input.adminId, "DISPUTE_RESOLVED", { targetType: "Dispute", targetId: dispute.id });
  return { status: input.status };
}

export async function addReview(orderId: string, authorId: string, rating: number, comment: string) {
  if (rating < 1 || rating > 5) throw new AppError("VALIDATION", "Note invalide (1 à 5).");
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { review: true } });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.buyerId !== authorId) throw new AppError("FORBIDDEN", "Seul l'acheteur peut évaluer cette transaction.");
  if (order.status !== "FINALIZED") throw new AppError("CONFLICT", "L'évaluation est possible uniquement après finalisation.");
  if (order.review) throw new AppError("CONFLICT", "Vous avez déjà évalué cette transaction.");
  return prisma.review.create({
    data: { orderId, authorId, targetId: order.sellerId, rating, comment: comment || null },
  });
}

export async function getBuyerOrders(buyerId: string, status?: OrderStatus) {
  return prisma.order.findMany({
    where: { buyerId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      listing: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
      seller: { select: { publicName: true } },
      shipment: { include: { events: { orderBy: { occurredAt: "desc" }, take: 1 } } },
      review: true,
    },
  });
}

export async function getSellerOrders(sellerId: string, status?: OrderStatus) {
  return prisma.order.findMany({
    where: { sellerId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      listing: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
      buyer: { select: { publicName: true } },
      shipment: { include: { events: { orderBy: { occurredAt: "desc" }, take: 1 } } },
    },
  });
}

export function orderTimelineLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING_PAYMENT: "En attente de paiement",
    PAID: "Payée",
    PREPARING: "En préparation",
    SHIPPED: "Expédiée",
    IN_TRANSIT: "En cours de livraison",
    DELIVERED: "Livrée",
    FINALIZED: "Finalisée",
    CANCELLED: "Annulée",
    REFUNDED: "Remboursée",
    DISPUTED: "En litige",
  };
  return labels[status];
}

export async function getOrderFinancialSummary(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { commission: true, payments: true, refunds: true },
  });
  if (!order) return null;
  return {
    order,
    itemPrice: formatMoney(order.itemPriceCents),
    commission: formatMoney(order.commissionCents),
    shipping: formatMoney(order.shippingCents),
    discount: formatMoney(order.discountCents),
    buyerTotal: formatMoney(order.buyerTotalCents),
    sellerPayout: formatMoney(order.sellerPayoutCents),
    finalizedAt: order.finalizedAt ? formatDate(order.finalizedAt) : null,
  };
}
