import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/email";
import { logger } from "@/lib/logger";

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  metadata?: Record<string, unknown>;
  email?: { to: string; subject: string; text: string; html?: string };
};

/**
 * Crée une notification in-app et, si l'utilisateur l'autorise, envoie un e-mail.
 * Les préférences sont respectées ; l'absence de préférence vaut acceptation.
 */
export async function notify(input: NotifyInput, client: Db = prisma) {
  const preference = await client.notificationPreference.findUnique({
    where: { userId_type: { userId: input.userId, type: input.type } },
  });

  const inApp = preference?.inApp ?? true;
  const emailAllowed = preference?.email ?? true;

  let notification = null;
  if (inApp) {
    notification = await client.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  if (emailAllowed && input.email) {
    sendEmail({
      to: input.email.to,
      subject: input.email.subject,
      text: input.email.text,
      html: input.email.html,
    }).catch((error) => logger.error("Notification e-mail échouée", { error: String(error) }));
  }

  return notification;
}

export async function notifyMany(inputs: NotifyInput[], client: Db = prisma) {
  for (const input of inputs) await notify(input, client);
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export async function getNotificationPreferences(userId: string) {
  const preferences = await prisma.notificationPreference.findMany({ where: { userId } });
  return new Map(preferences.map((preference) => [preference.type, preference]));
}

export async function setNotificationPreference(
  userId: string,
  type: string,
  values: { inApp: boolean; email: boolean },
) {
  return prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    update: { inApp: values.inApp, email: values.email },
    create: { userId, type, inApp: values.inApp, email: values.email },
  });
}
