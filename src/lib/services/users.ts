import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { hashPassword, passwordIssues, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/services/audit";

export async function getAccountOverview(userId: string) {
  const [
    listings,
    purchases,
    sales,
    bids,
    trophies,
    favorites,
    unreadNotifications,
    openDisputes,
    subscription,
    donations,
    reviews,
  ] = await Promise.all([
    prisma.listing.count({ where: { sellerId: userId, deletedAt: null } }),
    prisma.order.count({ where: { buyerId: userId } }),
    prisma.order.count({ where: { sellerId: userId, status: "FINALIZED" } }),
    prisma.bid.count({ where: { bidderId: userId } }),
    prisma.userTrophy.count({ where: { userId } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.dispute.count({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] }, order: { OR: [{ buyerId: userId }, { sellerId: userId }] } },
    }),
    prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.donation.aggregate({ where: { donorId: userId, status: "SUCCEEDED" }, _sum: { amountCents: true } }),
    prisma.review.count({ where: { targetId: userId } }),
  ]);

  return {
    listings,
    purchases,
    sales,
    bids,
    trophies,
    favorites,
    unreadNotifications,
    openDisputes,
    subscription,
    donationsCents: donations._sum.amountCents ?? 0,
    reviews,
  };
}

export async function updateProfile(
  userId: string,
  input: {
    publicName: string;
    bio?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    publicLocation: boolean;
    avatarUrl?: string;
  },
) {
  const taken = await prisma.user.findFirst({
    where: { publicName: input.publicName, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) throw new AppError("CONFLICT", "Ce nom public est déjà utilisé.");
  if (input.avatarUrl && !input.avatarUrl.startsWith("/api/uploads/") && !input.avatarUrl.startsWith("https://")) {
    throw new AppError("VALIDATION", "URL d'avatar invalide.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { publicName: input.publicName } });
    await tx.userProfile.upsert({
      where: { userId },
      update: {
        bio: input.bio || null,
        city: input.city || null,
        region: input.region || null,
        postalCode: input.postalCode || null,
        publicLocation: input.publicLocation,
        avatarUrl: input.avatarUrl || null,
      },
      create: {
        userId,
        bio: input.bio || null,
        city: input.city || null,
        region: input.region || null,
        postalCode: input.postalCode || null,
        publicLocation: input.publicLocation,
        avatarUrl: input.avatarUrl || null,
      },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "PROFILE_UPDATED", targetType: "User", targetId: userId },
    });
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new AppError("NOT_FOUND", "Utilisateur introuvable.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError("VALIDATION", "Mot de passe actuel incorrect.", { fieldErrors: { currentPassword: ["Mot de passe incorrect."] } });
  }
  const issues = passwordIssues(newPassword);
  if (issues.length) throw new AppError("VALIDATION", issues.join(" "));
  if (currentPassword === newPassword) throw new AppError("VALIDATION", "Le nouveau mot de passe doit être différent.");
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await audit(userId, "PASSWORD_CHANGED", { targetType: "User", targetId: userId });
}

export async function listAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
}

export async function createAddress(
  userId: string,
  input: {
    label: string;
    fullName: string;
    line1: string;
    line2?: string;
    postalCode: string;
    city: string;
    country: string;
    phone?: string;
    isDefault: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const created = await tx.address.create({
      data: {
        userId,
        label: input.label || "Domicile",
        fullName: input.fullName,
        line1: input.line1,
        line2: input.line2 || null,
        postalCode: input.postalCode,
        city: input.city,
        country: input.country || "FR",
        phone: input.phone || null,
        isDefault: input.isDefault,
      },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "ADDRESS_CREATED", targetType: "Address", targetId: created.id },
    });
    return created;
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new AppError("NOT_FOUND", "Adresse introuvable.");
  const orders = await prisma.order.count({ where: { shippingAddressId: addressId } });
  if (orders > 0) {
    throw new AppError("CONFLICT", "Cette adresse est liée à une commande et ne peut pas être supprimée (historique conservé).");
  }
  await prisma.address.delete({ where: { id: addressId } });
}

export async function setDefaultAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new AppError("NOT_FOUND", "Adresse introuvable.");
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);
}

/**
 * Export des données personnelles (RGPD). Retourne un objet JSON téléchargeable.
 * Les données strictement financières liées à des transactions sont incluses
 * pour la transparence ; les secrets (mot de passe, jetons) sont exclus.
 */
export async function exportUserData(userId: string) {
  const user = await getCurrentUser();
  if (!user || user.id !== userId) throw new AppError("FORBIDDEN", "Accès refusé.");

  const [profile, addresses, listings, ordersBought, ordersSold, bids, favorites, messages, notifications, donations, trophies, reviews, donationsAgg] =
    await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.address.findMany({ where: { userId } }),
      prisma.listing.findMany({
        where: { sellerId: userId },
        select: { id: true, title: true, priceCents: true, status: true, createdAt: true, publishedAt: true },
      }),
      prisma.order.findMany({
        where: { buyerId: userId },
        select: { orderNumber: true, status: true, buyerTotalCents: true, createdAt: true, finalizedAt: true },
      }),
      prisma.order.findMany({
        where: { sellerId: userId },
        select: { orderNumber: true, status: true, sellerPayoutCents: true, createdAt: true, finalizedAt: true },
      }),
      prisma.bid.findMany({
        where: { bidderId: userId },
        select: { amountCents: true, status: true, createdAt: true, auction: { select: { listing: { select: { title: true } } } } },
      }),
      prisma.favorite.findMany({
        where: { userId },
        select: { createdAt: true, listing: { select: { title: true, slug: true } } },
      }),
      prisma.message.findMany({
        where: { senderId: userId },
        select: { body: true, createdAt: true, conversationId: true },
        take: 1000,
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { type: true, title: true, body: true, createdAt: true, readAt: true },
        take: 1000,
      }),
      prisma.donation.findMany({
        where: { donorId: userId },
        select: { amountCents: true, status: true, receiptNumber: true, createdAt: true, isPublic: true },
      }),
      prisma.userTrophy.findMany({
        where: { userId },
        select: { awardedAt: true, definition: { select: { name: true, level: true } } },
      }),
      prisma.review.findMany({
        where: { OR: [{ authorId: userId }, { targetId: userId }] },
        select: { rating: true, comment: true, createdAt: true, authorId: true, targetId: true },
      }),
      prisma.donation.aggregate({ where: { donorId: userId, status: "SUCCEEDED" }, _sum: { amountCents: true } }),
    ]);

  await audit(userId, "DATA_EXPORTED", { targetType: "User", targetId: userId });

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      publicName: user.publicName,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    profile,
    addresses,
    listings,
    orders: { bought: ordersBought, sold: ordersSold },
    bids,
    favorites,
    messagesSent: messages,
    notifications,
    donations,
    donationsTotalCents: donationsAgg._sum.amountCents ?? 0,
    trophies,
    reviews,
    notes: [
      "Les données de paiement bancaire ne sont jamais stockées par A2V.",
      "Les enregistrements comptables et de lutte contre la fraude peuvent être conservés après suppression du compte, conformément aux obligations légales.",
    ],
  };
}

/**
 * Suppression du compte : anonymisation immédiate et conservation des
 * enregistrements financiers obligatoires (sans identité directe).
 */
export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, publicName: true } });
  if (!user) throw new AppError("NOT_FOUND", "Compte introuvable.");
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AppError("VALIDATION", "Mot de passe incorrect.");
  }

  const activeOrders = await prisma.order.count({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      status: { in: ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "IN_TRANSIT", "DISPUTED"] },
    },
  });
  if (activeOrders > 0) {
    throw new AppError("CONFLICT", "Des commandes sont en cours. Terminez-les ou ouvrez un litige avant de supprimer votre compte.");
  }

  const suffix = userId.slice(-6);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        deletedAt: now,
        email: `deleted-${suffix}@a2v.invalid`,
        publicName: `utilisateur-${suffix}`,
        passwordHash: "deleted",
        emailVerifiedAt: null,
        lockedUntil: now,
      },
    });
    await tx.userProfile.updateMany({
      where: { userId },
      data: { bio: null, avatarUrl: null, city: null, region: null, postalCode: null, publicLocation: false },
    });
    await tx.address.deleteMany({ where: { userId } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.subscription.updateMany({
      where: { userId, status: { in: ["TRIALING", "ACTIVE", "CANCEL_AT_PERIOD_END"] } },
      data: { status: "EXPIRED", canceledAt: now, cancelAtPeriodEnd: false },
    });
    await tx.listing.updateMany({
      where: { sellerId: userId, status: "PUBLISHED" },
      data: { status: "CANCELLED", deletedAt: now },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "ACCOUNT_DELETED",
        targetType: "User",
        targetId: userId,
        metadata: { anonymized: true, financialRecordsRetained: true },
      },
    });
  });

  return { deleted: true };
}

export async function listFavorites(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          auction: { select: { status: true, endsAt: true, currentPriceCents: true } },
          seller: { select: { publicName: true } },
        },
      },
    },
  });
}

export async function getUserTransactions(userId: string) {
  return prisma.transactionEvent.findMany({
    where: {
      OR: [{ order: { buyerId: userId } }, { order: { sellerId: userId } }, { actorId: userId }, { payment: { userId } }],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { order: { select: { orderNumber: true } } },
  });
}

export type AccountSummary = Awaited<ReturnType<typeof getAccountOverview>>;

export async function getSellerStats(sellerId: string) {
  const [sales, finalized, revenue, commission, pending] = await Promise.all([
    prisma.order.count({ where: { sellerId } }),
    prisma.order.count({ where: { sellerId, status: "FINALIZED" } }),
    prisma.order.aggregate({ where: { sellerId, status: "FINALIZED" }, _sum: { sellerPayoutCents: true } }),
    prisma.commission.aggregate({ where: { order: { sellerId }, status: "EARNED" }, _sum: { amountCents: true } }),
    prisma.order.aggregate({
      where: { sellerId, status: { in: ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "IN_TRANSIT"] } },
      _sum: { sellerPayoutCents: true },
    }),
  ]);
  return {
    sales,
    finalized,
    revenueCents: revenue._sum.sellerPayoutCents ?? 0,
    commissionCents: commission._sum.amountCents ?? 0,
    pendingCents: pending._sum.sellerPayoutCents ?? 0,
  };
}

export function accountFilterWhere(userId: string): Prisma.OrderWhereInput {
  return { OR: [{ buyerId: userId }, { sellerId: userId }] };
}
