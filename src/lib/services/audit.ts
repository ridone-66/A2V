import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/lib/db";

/** Journal d'audit des actions sensibles (non modifiable depuis l'interface). */
export async function audit(
  actorId: string | null,
  action: string,
  options: {
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ipHash?: string | null;
  } = {},
  client: Db = prisma,
) {
  return client.auditLog.create({
    data: {
      actorId,
      action,
      targetType: options.targetType,
      targetId: options.targetId,
      metadata: (options.metadata ?? {}) as Prisma.InputJsonValue,
      ipHash: options.ipHash ?? null,
    },
  });
}
