import "server-only";

import { prisma } from "@/lib/db";

export async function getAdminStats() {
  const [
    users,
    activeListings,
    liveAuctions,
    ordersPending,
    finalizedAgg,
    commissionAgg,
    donationsAgg,
    openReports,
    openDisputes,
    premiumActive,
    recentOrders,
    finalizedOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.listing.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    prisma.auction.count({ where: { status: "LIVE" } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.aggregate({ where: { status: "FINALIZED" }, _sum: { buyerTotalCents: true }, _count: true }),
    prisma.commission.aggregate({ where: { status: "EARNED" }, _sum: { amountCents: true } }),
    prisma.donation.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: true }),
    prisma.listingReport.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.subscription.count({ where: { status: { in: ["TRIALING", "ACTIVE", "CANCEL_AT_PERIOD_END"] } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        buyer: { select: { publicName: true } },
        seller: { select: { publicName: true } },
      },
    }),
    prisma.order.findMany({
      where: { status: "FINALIZED", finalizedAt: { gte: new Date(Date.now() - 180 * 86_400_000) } },
      select: { buyerTotalCents: true, commissionCents: true, finalizedAt: true },
    }),
  ]);

  const months: Array<{ key: string; label: string; gmvCents: number; commissionCents: number; orders: number }> = [];
  const now = new Date();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date),
      gmvCents: 0,
      commissionCents: 0,
      orders: 0,
    });
  }
  for (const order of finalizedOrders) {
    if (!order.finalizedAt) continue;
    const key = `${order.finalizedAt.getFullYear()}-${String(order.finalizedAt.getMonth() + 1).padStart(2, "0")}`;
    const month = months.find((candidate) => candidate.key === key);
    if (!month) continue;
    month.gmvCents += order.buyerTotalCents;
    month.commissionCents += order.commissionCents;
    month.orders += 1;
  }

  return {
    users,
    activeListings,
    liveAuctions,
    ordersPending,
    finalizedOrders: finalizedAgg._count,
    gmvCents: finalizedAgg._sum.buyerTotalCents ?? 0,
    commissionCents: commissionAgg._sum.amountCents ?? 0,
    donationsCents: donationsAgg._sum.amountCents ?? 0,
    donationsCount: donationsAgg._count,
    openReports,
    openDisputes,
    premiumActive,
    recentOrders,
    months,
  };
}

export async function getAdminUsers(query?: string, page = 1) {
  const pageSize = 20;
  const where = query?.trim()
    ? {
        OR: [
          { email: { contains: query.trim(), mode: "insensitive" as const } },
          { publicName: { contains: query.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
      include: {
        profile: { select: { city: true } },
        _count: { select: { listings: true, ordersBought: true, ordersSold: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdminListings(filter: { q?: string; status?: string } = {}, page = 1) {
  const pageSize = 20;
  const where = {
    ...(filter.q?.trim()
      ? {
          OR: [
            { title: { contains: filter.q.trim(), mode: "insensitive" as const } },
            { seller: { publicName: { contains: filter.q.trim(), mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(filter.status && filter.status !== "ALL" ? { status: filter.status as never } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
      include: {
        seller: { select: { publicName: true } },
        images: { take: 1, orderBy: { position: "asc" } },
        auction: { select: { status: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdminOrders(filter: { q?: string; status?: string } = {}, page = 1) {
  const pageSize = 20;
  const where = {
    ...(filter.q?.trim()
      ? {
          OR: [
            { orderNumber: { contains: filter.q.trim(), mode: "insensitive" as const } },
            { buyer: { publicName: { contains: filter.q.trim(), mode: "insensitive" as const } } },
            { seller: { publicName: { contains: filter.q.trim(), mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(filter.status && filter.status !== "ALL" ? { status: filter.status as never } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
      include: {
        buyer: { select: { publicName: true } },
        seller: { select: { publicName: true } },
        payments: { select: { provider: true, status: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdminReports(page = 1) {
  const pageSize = 20;
  const [items, total] = await Promise.all([
    prisma.listingReport.findMany({
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
      include: {
        listing: { select: { id: true, title: true, slug: true, status: true } },
        reporter: { select: { publicName: true } },
        moderator: { select: { publicName: true } },
      },
    }),
    prisma.listingReport.count(),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdminDisputes(page = 1) {
  const pageSize = 20;
  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            buyerTotalCents: true,
            status: true,
            buyer: { select: { publicName: true } },
            seller: { select: { publicName: true } },
          },
        },
        openedBy: { select: { publicName: true } },
      },
    }),
    prisma.dispute.count(),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdminAuditLogs(page = 1) {
  const pageSize = 30;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { publicName: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdminDonationOverview() {
  const [stats, transfers, contributions, organizations, recent] = await Promise.all([
    prisma.donation.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: true }),
    prisma.charityTransfer.findMany({
      orderBy: { transferredAt: "desc" },
      take: 10,
      include: { organization: { select: { name: true } } },
    }),
    prisma.platformContribution.findMany({ orderBy: { occurredAt: "desc" }, take: 10 }),
    prisma.charityOrganization.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.donation.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { donor: { select: { publicName: true } } },
    }),
  ]);
  return {
    donationsCents: stats._sum.amountCents ?? 0,
    donationsCount: stats._count,
    transfers,
    contributions,
    organizations,
    recent,
  };
}
