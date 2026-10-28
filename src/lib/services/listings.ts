import "server-only";

import { Prisma, type ListingCondition, type SaleType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { requiresPremiumAccess } from "@/lib/config";
import { audit } from "@/lib/services/audit";
import { getSetting } from "@/lib/services/settings";

export type ListingImageInput = { url: string; alt?: string | null };

export type CreateListingInput = {
  title: string;
  description: string;
  categoryId: string;
  condition: ListingCondition;
  priceCents: number;
  saleType: SaleType;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  locationCity?: string | null;
  locationPostalCode?: string | null;
  shippingCostCents: number;
  shippingNotes?: string | null;
  images: ListingImageInput[];
  isPremiumOnly: boolean;
  auction?: {
    startsAt: Date;
    endsAt: Date;
    startPriceCents: number;
    reservePriceCents?: number | null;
    buyNowPriceCents?: number | null;
    minIncrementCents?: number;
  } | null;
};

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "annonce";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const exists = await prisma.listing.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createListing(sellerId: string, input: CreateListingInput) {
  if (input.images.length === 0) throw new AppError("VALIDATION", "Ajoutez au moins une photo.");
  if (input.images.length > 8) throw new AppError("VALIDATION", "8 photos maximum.");

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) throw new AppError("VALIDATION", "Catégorie invalide.");

  if (input.saleType === "AUCTION") {
    if (!input.auction) throw new AppError("VALIDATION", "Paramètres d'enchère manquants.");
    const { startsAt, endsAt, startPriceCents, reservePriceCents, buyNowPriceCents } = input.auction;
    if (endsAt.getTime() - startsAt.getTime() < 3_600_000) {
      throw new AppError("VALIDATION", "L'enchère doit durer au moins 1 heure.");
    }
    if (endsAt.getTime() - startsAt.getTime() > 30 * 86_400_000) {
      throw new AppError("VALIDATION", "La durée maximale d'une enchère est de 30 jours.");
    }
    if (startPriceCents < 100) throw new AppError("VALIDATION", "Prix de départ minimum : 1 €.");
    if (reservePriceCents !== null && reservePriceCents !== undefined && reservePriceCents < startPriceCents) {
      throw new AppError("VALIDATION", "Le prix de réserve doit être supérieur ou égal au prix de départ.");
    }
    if (buyNowPriceCents && buyNowPriceCents < startPriceCents) {
      throw new AppError("VALIDATION", "Le prix d'achat immédiat doit être supérieur au prix de départ.");
    }
  } else if (input.priceCents < 100) {
    throw new AppError("VALIDATION", "Prix minimum : 1 €.");
  }

  // Le vendeur peut réserver son annonce aux membres Prestige. Au-delà de
  // 10 000 € (prix fixe ou prix de départ d'une enchère), la réservation est
  // automatique et imposée côté serveur.
  const effectivePriceCents = input.saleType === "AUCTION" ? input.auction!.startPriceCents : input.priceCents;
  const premiumOnly = input.isPremiumOnly || requiresPremiumAccess(effectivePriceCents);

  const slug = await uniqueSlug(input.title);
  const now = new Date();
  const auctionOpen = input.auction ? input.auction.startsAt <= now : false;

  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: {
        sellerId,
        categoryId: input.categoryId,
        title: input.title,
        slug,
        description: input.description,
        condition: input.condition,
        priceCents: input.saleType === "AUCTION" ? input.auction!.startPriceCents : input.priceCents,
        saleType: input.saleType,
        status: "PUBLISHED",
        brand: input.brand || null,
        size: input.size || null,
        color: input.color || null,
        locationCity: input.locationCity || null,
        locationPostalCode: input.locationPostalCode || null,
        shippingCostCents: input.shippingCostCents,
        shippingNotes: input.shippingNotes || null,
        isPremiumOnly: premiumOnly,
        publishedAt: now,
        images: {
          create: input.images.map((image, index) => ({
            url: image.url,
            alt: image.alt || input.title,
            position: index,
          })),
        },
      },
    });

    if (input.saleType === "AUCTION" && input.auction) {
      await tx.auction.create({
        data: {
          listingId: created.id,
          startPriceCents: input.auction.startPriceCents,
          reservePriceCents: input.auction.reservePriceCents ?? null,
          buyNowPriceCents: input.auction.buyNowPriceCents ?? null,
          currentPriceCents: input.auction.startPriceCents,
          minIncrementCents: input.auction.minIncrementCents ?? (await getSetting("auction.minIncrementCents")),
          startsAt: input.auction.startsAt,
          endsAt: input.auction.endsAt,
          originalEndsAt: input.auction.endsAt,
          status: auctionOpen ? "LIVE" : "SCHEDULED",
          events: {
            create: [
              { type: "CREATED", actorId: sellerId, metadata: { startsAt: input.auction.startsAt.toISOString() } },
              ...(auctionOpen ? [{ type: "STARTED" as const, metadata: {} }] : []),
            ],
          },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: sellerId,
        action: "LISTING_CREATED",
        targetType: "Listing",
        targetId: created.id,
        metadata: { saleType: input.saleType, priceCents: created.priceCents },
      },
    });

    return created;
  });

  return prisma.listing.findUniqueOrThrow({
    where: { id: listing.id },
    include: { images: { orderBy: { position: "asc" } }, auction: true, category: true },
  });
}

export type UpdateListingInput = Omit<CreateListingInput, "auction"> & {
  auction?: {
    startsAt: Date;
    endsAt: Date;
    reservePriceCents?: number | null;
    buyNowPriceCents?: number | null;
    minIncrementCents?: number;
  } | null;
};

export async function updateListing(listingId: string, sellerId: string, input: UpdateListingInput) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { auction: { include: { _count: { select: { bids: true } } } }, orders: { where: { status: { in: ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "DISPUTED"] } } } },
  });
  if (!listing || listing.deletedAt) throw new AppError("NOT_FOUND", "Annonce introuvable.");
  if (listing.sellerId !== sellerId) throw new AppError("FORBIDDEN", "Vous n'êtes pas le vendeur de cette annonce.");
  if (listing.orders.length > 0) throw new AppError("CONFLICT", "Impossible de modifier une annonce liée à une commande en cours.");
  if (listing.auction && listing.auction._count.bids > 0) {
    throw new AppError("CONFLICT", "Impossible de modifier une enchère ayant déjà reçu des offres.");
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) throw new AppError("VALIDATION", "Catégorie invalide.");
  if (input.saleType === "AUCTION" && !input.auction) throw new AppError("VALIDATION", "Paramètres d'enchère manquants.");
  if (input.images.length === 0) throw new AppError("VALIDATION", "Ajoutez au moins une photo.");

  if (input.saleType === "AUCTION" && input.auction) {
    const { startsAt, endsAt, reservePriceCents, buyNowPriceCents } = input.auction;
    if (endsAt.getTime() - startsAt.getTime() < 3_600_000) {
      throw new AppError("VALIDATION", "L'enchère doit durer au moins 1 heure.");
    }
    if (reservePriceCents && listing.priceCents && reservePriceCents < listing.priceCents) {
      throw new AppError("VALIDATION", "Le prix de réserve doit être supérieur ou égal au prix de départ.");
    }
    if (buyNowPriceCents && buyNowPriceCents < listing.priceCents) {
      throw new AppError("VALIDATION", "Le prix d'achat immédiat est trop bas.");
    }
    await prisma.auction.update({
      where: { listingId },
      data: {
        startsAt,
        endsAt,
        originalEndsAt: endsAt,
        reservePriceCents: reservePriceCents ?? null,
        buyNowPriceCents: buyNowPriceCents ?? null,
        minIncrementCents: input.auction.minIncrementCents ?? listing.auction?.minIncrementCents ?? 100,
        status: startsAt <= new Date() ? "LIVE" : "SCHEDULED",
        events: { create: { type: "CREATED", actorId: sellerId, metadata: { updated: true } } },
      },
    });
  }

  // Même règle qu'à la création : réservation explicite du vendeur ou prix
  // au-dessus de 10 000 €. Pour une enchère, le prix de référence reste le
  // prix de départ enregistré (non modifiable après des offres).
  const effectivePriceCents = input.saleType === "AUCTION" ? listing.priceCents : input.priceCents;
  const premiumOnly = input.isPremiumOnly || requiresPremiumAccess(effectivePriceCents);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.listingImage.deleteMany({ where: { listingId } });
    return tx.listing.update({
      where: { id: listingId },
      data: {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        condition: input.condition,
        priceCents: input.saleType === "AUCTION" && input.auction ? listing.priceCents : input.priceCents,
        brand: input.brand || null,
        size: input.size || null,
        color: input.color || null,
        locationCity: input.locationCity || null,
        locationPostalCode: input.locationPostalCode || null,
        shippingCostCents: input.shippingCostCents,
        shippingNotes: input.shippingNotes || null,
        isPremiumOnly: premiumOnly,
        images: {
          create: input.images.map((image, index) => ({
            url: image.url,
            alt: image.alt || input.title,
            position: index,
          })),
        },
      },
      include: { images: { orderBy: { position: "asc" } }, auction: true },
    });
  });

  await audit(sellerId, "LISTING_UPDATED", { targetType: "Listing", targetId: listingId });
  return updated;
}

export type ListingSearchFilters = {
  q?: string;
  category?: string;
  conditions?: ListingCondition[];
  minPriceCents?: number;
  maxPriceCents?: number;
  city?: string;
  saleType?: SaleType;
  sort?: "recent" | "price_asc" | "price_desc" | "popular";
  page?: number;
  pageSize?: number;
  /** Le serveur masque les offres Premium aux non-membres. */
  viewerIsPremium?: boolean;
  includePremiumOnly?: boolean;
  /** Ne retourner que les annonces réservées Prestige. */
  premiumOnly?: boolean;
};

export async function searchListings(filters: ListingSearchFilters) {
  const page = Math.max(1, Math.floor(filters.page || 1));
  const pageSize = Math.min(48, Math.max(1, filters.pageSize || 12));
  const where: Prisma.ListingWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
    saleType: filters.saleType ?? "FIXED_PRICE",
  };

  if (!filters.viewerIsPremium && !filters.includePremiumOnly) where.isPremiumOnly = false;
  if (filters.premiumOnly) where.isPremiumOnly = true;
  const andConditions: Prisma.ListingWhereInput[] = [];
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.category) {
    const category = await prisma.category.findUnique({
      where: { slug: filters.category },
      include: { children: { select: { id: true } } },
    });
    if (category) where.categoryId = { in: [category.id, ...category.children.map((child) => child.id)] };
    else where.categoryId = "__none__";
  }
  if (filters.conditions?.length) where.condition = { in: filters.conditions };
  if (filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined) {
    where.priceCents = {
      ...(filters.minPriceCents !== undefined ? { gte: Math.max(0, filters.minPriceCents) } : {}),
      ...(filters.maxPriceCents !== undefined ? { lte: Math.max(0, filters.maxPriceCents) } : {}),
    };
  }
  if (filters.city?.trim()) {
    andConditions.push({
      OR: [
        { locationCity: { contains: filters.city.trim(), mode: "insensitive" } },
        { locationPostalCode: { startsWith: filters.city.trim() } },
      ],
    });
  }
  if (andConditions.length) where.AND = andConditions;

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    filters.sort === "price_asc"
      ? [{ priceCents: "asc" }, { publishedAt: "desc" }]
      : filters.sort === "price_desc"
        ? [{ priceCents: "desc" }, { publishedAt: "desc" }]
        : filters.sort === "popular"
          ? [{ favorites: { _count: "desc" } }, { publishedAt: "desc" }]
          : [{ publishedAt: "desc" }];

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        images: { orderBy: { position: "asc" }, take: 2 },
        seller: { select: { publicName: true, profile: { select: { avatarUrl: true, city: true } } } },
        category: { select: { name: true, slug: true } },
        auction: { select: { id: true, status: true, currentPriceCents: true, endsAt: true, startsAt: true, buyNowPriceCents: true } },
        _count: { select: { favorites: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

export async function getListingBySlug(slug: string) {
  return prisma.listing.findFirst({
    where: { slug, deletedAt: null },
    include: {
      images: { orderBy: { position: "asc" } },
      category: { include: { parent: { select: { name: true, slug: true } } } },
      seller: {
        select: {
          id: true,
          publicName: true,
          createdAt: true,
          profile: { select: { avatarUrl: true, bio: true, city: true, publicLocation: true } },
          _count: { select: { listings: { where: { status: "FINALIZED" } }, reviewsReceived: true } },
        },
      },
      auction: { include: { _count: { select: { bids: true } }, winner: { select: { publicName: true } } } },
      _count: { select: { favorites: true, orders: true } },
    },
  });
}

export async function getListingForOwner(listingId: string, sellerId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      images: { orderBy: { position: "asc" } },
      auction: true,
      orders: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!listing || listing.deletedAt) throw new AppError("NOT_FOUND", "Annonce introuvable.");
  if (listing.sellerId !== sellerId) throw new AppError("FORBIDDEN", "Accès refusé.");
  return listing;
}

export async function incrementListingView(listingId: string) {
  await prisma.listing.update({ where: { id: listingId }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
}

export async function toggleFavorite(userId: string, listingId: string) {
  const existing = await prisma.favorite.findUnique({ where: { userId_listingId: { userId, listingId } } });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return false;
  }
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "PUBLISHED", deletedAt: null },
    select: { sellerId: true },
  });
  if (!listing) throw new AppError("NOT_FOUND", "Annonce introuvable.");
  if (listing.sellerId === userId) throw new AppError("CONFLICT", "Vous ne pouvez pas ajouter votre propre annonce aux favoris.");
  await prisma.favorite.create({ data: { userId, listingId } });
  return true;
}

export async function isFavorite(userId: string, listingId: string) {
  return Boolean(await prisma.favorite.findUnique({ where: { userId_listingId: { userId, listingId } }, select: { id: true } }));
}

export async function reportListing(input: {
  listingId: string;
  reporterId: string;
  reason: "FRAUD" | "COUNTERFEIT" | "PROHIBITED" | "MISLEADING" | "ABUSIVE" | "OTHER";
  details?: string;
}) {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId }, select: { sellerId: true } });
  if (!listing) throw new AppError("NOT_FOUND", "Annonce introuvable.");
  if (listing.sellerId === input.reporterId) throw new AppError("CONFLICT", "Vous ne pouvez pas signaler votre propre annonce.");

  const recent = await prisma.listingReport.count({
    where: {
      listingId: input.listingId,
      reporterId: input.reporterId,
      createdAt: { gte: new Date(Date.now() - 86_400_000) },
    },
  });
  if (recent > 0) throw new AppError("CONFLICT", "Vous avez déjà signalé cette annonce récemment.");

  return prisma.listingReport.create({
    data: {
      listingId: input.listingId,
      reporterId: input.reporterId,
      reason: input.reason,
      details: input.details || null,
    },
  });
}

export async function setListingStatus(
  listingId: string,
  sellerId: string,
  action: "publish" | "pause" | "delete",
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { auction: { select: { status: true } }, orders: { select: { id: true, status: true } } },
  });
  if (!listing || listing.deletedAt) throw new AppError("NOT_FOUND", "Annonce introuvable.");
  if (listing.sellerId !== sellerId) throw new AppError("FORBIDDEN", "Accès refusé.");

  const activeOrders = listing.orders.filter(
    (order) => !["CANCELLED", "REFUNDED", "FINALIZED"].includes(order.status),
  );
  if (action === "delete") {
    if (activeOrders.length > 0) throw new AppError("CONFLICT", "Une commande est en cours : annulez-la avant de supprimer.");
    if (listing.auction && ["LIVE", "SCHEDULED"].includes(listing.auction.status)) {
      throw new AppError("CONFLICT", "Annulez l'enchère avant de supprimer l'annonce.");
    }
    await prisma.listing.update({
      where: { id: listingId },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    });
    await audit(sellerId, "LISTING_DELETED", { targetType: "Listing", targetId: listingId });
    return { deleted: true };
  }

  if (listing.status !== "PUBLISHED" && listing.status !== "DRAFT") {
    throw new AppError("CONFLICT", "Cette annonce ne peut plus changer de visibilité.");
  }
  await prisma.listing.update({
    where: { id: listingId },
    data: action === "publish" ? { status: "PUBLISHED", publishedAt: listing.publishedAt ?? new Date() } : { status: "DRAFT" },
  });
  return { deleted: false };
}

/**
 * Catégories racines actives avec leurs sous-catégories.
 *
 * `listingCount` agrège les annonces publiées de la catégorie racine **et** de
 * ses enfants : dans la navigation, une racine ne doit jamais afficher « 0
 * annonce » alors que ses sous-catégories en contiennent. Les supprimées et les
 * brouillons sont exclus du compteur, comme dans le catalogue.
 */
export async function getCategoriesWithCounts() {
  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { position: "asc" },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: {
          _count: { select: { listings: { where: { status: "PUBLISHED", deletedAt: null } } } },
        },
      },
      _count: { select: { listings: { where: { status: "PUBLISHED", deletedAt: null } } } },
    },
  });

  return categories.map((category) => ({
    ...category,
    listingCount:
      category._count.listings + category.children.reduce((total, child) => total + child._count.listings, 0),
  }));
}

export async function getSellerPublicProfile(publicName: string) {
  return prisma.user.findUnique({
    where: { publicName },
    select: {
      id: true,
      publicName: true,
      createdAt: true,
      status: true,
      profile: { select: { avatarUrl: true, bio: true, city: true, publicLocation: true } },
      _count: { select: { reviewsReceived: true } },
      reviewsReceived: {
        where: { isHidden: false },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { author: { select: { publicName: true } } },
      },
      listings: {
        where: { status: "PUBLISHED", deletedAt: null, isPremiumOnly: false },
        orderBy: { publishedAt: "desc" },
        take: 12,
        include: { images: { orderBy: { position: "asc" }, take: 1 }, auction: true },
      },
    },
  });
}
