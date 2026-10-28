import "server-only";

import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { notify } from "@/lib/services/notifications";
import { getSetting } from "@/lib/services/settings";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/services/audit";

async function areBlocked(a: string, b: string) {
  const block = await prisma.userBlock.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return Boolean(block);
}

export async function getOrCreateConversation(input: {
  userId: string;
  recipientId?: string | null;
  listingId?: string | null;
  orderId?: string | null;
  subject?: string | null;
}) {
  let recipientId = input.recipientId ?? null;
  let subject = input.subject?.trim() || "Conversation";
  let listingId = input.listingId ?? null;
  const orderId = input.orderId ?? null;

  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true, sellerId: true, orderNumber: true, listingId: true },
    });
    if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
    if (order.buyerId !== input.userId && order.sellerId !== input.userId) throw new AppError("FORBIDDEN", "Accès refusé.");
    recipientId = order.buyerId === input.userId ? order.sellerId : order.buyerId;
    listingId = order.listingId;
    subject = `Commande ${order.orderNumber}`;
  } else if (listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true, title: true, deletedAt: true },
    });
    if (!listing || listing.deletedAt) throw new AppError("NOT_FOUND", "Annonce introuvable.");
    recipientId = listing.sellerId;
    subject = `À propos de « ${listing.title} »`;
  }

  if (!recipientId) throw new AppError("VALIDATION", "Destinataire manquant.");
  if (recipientId === input.userId) throw new AppError("CONFLICT", "Vous ne pouvez pas vous envoyer un message.");
  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, status: true } });
  if (!recipient || recipient.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Destinataire introuvable.");
  if (await areBlocked(input.userId, recipientId)) throw new AppError("FORBIDDEN", "Cette conversation est bloquée.");

  const existing = await prisma.conversation.findFirst({
    where: {
      ...(listingId ? { listingId } : {}),
      ...(orderId ? { orderId } : {}),
      participants: { some: { userId: input.userId } },
      AND: [{ participants: { some: { userId: recipientId } } }],
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      listingId,
      orderId,
      subject,
      participants: { create: [{ userId: input.userId }, { userId: recipientId }] },
    },
  });
}

export async function sendMessage(input: { userId: string; conversationId: string; body: string }) {
  const maxPerHour = await getSetting("messaging.maxMessagesPerHour");
  const limit = rateLimit(`message:${input.userId}`, maxPerHour, 3_600_000);
  if (!limit.allowed) throw new AppError("RATE_LIMITED", "Trop de messages envoyés. Réessayez dans quelques minutes.");

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      participants: { include: { user: { select: { id: true, email: true, publicName: true, status: true } } } },
    },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation introuvable.");
  const participant = conversation.participants.find((item) => item.userId === input.userId);
  if (!participant) throw new AppError("FORBIDDEN", "Vous ne participez pas à cette conversation.");

  const recipients = conversation.participants.filter((item) => item.userId !== input.userId);
  for (const recipient of recipients) {
    if (await areBlocked(input.userId, recipient.userId)) {
      throw new AppError("FORBIDDEN", "La conversation est bloquée par un participant.");
    }
  }

  const body = input.body.trim();
  if (!body) throw new AppError("VALIDATION", "Message vide.");
  if (body.length > 3000) throw new AppError("VALIDATION", "Message trop long (3000 caractères maximum).");

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId: conversation.id, senderId: input.userId, body },
    });
    await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: conversation.id, userId: input.userId } },
      data: { lastReadAt: new Date() },
    });
    return created;
  });

  for (const recipient of recipients) {
    await notify({
      userId: recipient.userId,
      type: "MESSAGE",
      title: "Nouveau message",
      body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
      href: `/compte/messages/${conversation.id}`,
      email: {
        to: recipient.user.email,
        subject: "A2V — Nouveau message",
        text: `Nouveau message de ${conversation.participants.find((p) => p.userId === input.userId)?.user.publicName ?? "un membre"} : ${body.slice(0, 300)}`,
      },
    });
  }
  return message;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new AppError("FORBIDDEN", "Accès refusé.");
  await prisma.$transaction([
    prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: new Date() },
    }),
    prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    }),
  ]);
}

export async function getConversationsForUser(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, publicName: true, profile: { select: { avatarUrl: true } } } } },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      listing: { select: { title: true, slug: true } },
      order: { select: { orderNumber: true, status: true } },
    },
  });

  const unread = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: conversations.map((c) => c.id) }, readAt: null, senderId: { not: userId } },
    _count: { _all: true },
  });
  const unreadByConversation = new Map(unread.map((row) => [row.conversationId, row._count._all]));

  return conversations.map((conversation) => ({
    ...conversation,
    unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    otherParticipants: conversation.participants.filter((participant) => participant.userId !== userId),
    lastMessage: conversation.messages[0] ?? null,
  }));
}

export async function getConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: { id: true, publicName: true, profile: { select: { avatarUrl: true } } } } },
      },
      listing: { select: { title: true, slug: true, images: { orderBy: { position: "asc" }, take: 1 } } },
      order: { select: { orderNumber: true, status: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { sender: { select: { id: true, publicName: true } } },
      },
    },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation introuvable.");
  if (!conversation.participants.some((participant) => participant.userId === userId)) {
    throw new AppError("FORBIDDEN", "Accès refusé.");
  }
  return conversation;
}

export async function countUnreadMessages(userId: string) {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      conversation: { participants: { some: { userId } } },
    },
  });
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new AppError("CONFLICT", "Impossible de se bloquer soi-même.");
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) throw new AppError("NOT_FOUND", "Utilisateur introuvable.");
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    update: {},
    create: { blockerId, blockedId },
  });
  await audit(blockerId, "USER_BLOCKED", { targetType: "User", targetId: blockedId });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
}

export async function getBlockedUsers(userId: string) {
  return prisma.userBlock.findMany({
    where: { blockerId: userId },
    include: { blocked: { select: { id: true, publicName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function reportMessage(input: {
  messageId: string;
  reporterId: string;
  reason: string;
  details?: string;
}) {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    include: { conversation: { include: { participants: true } } },
  });
  if (!message) throw new AppError("NOT_FOUND", "Message introuvable.");
  if (!message.conversation.participants.some((participant) => participant.userId === input.reporterId)) {
    throw new AppError("FORBIDDEN", "Accès refusé.");
  }
  const report = await prisma.messageReport.create({
    data: {
      messageId: input.messageId,
      reporterId: input.reporterId,
      reason: input.reason,
      details: input.details || null,
    },
  });
  await audit(input.reporterId, "MESSAGE_REPORTED", { targetType: "Message", targetId: input.messageId });
  return report;
}
