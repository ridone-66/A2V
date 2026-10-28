import "server-only";

import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { paymentsSimulationEnabled } from "@/lib/env";
import { getSetting } from "@/lib/services/settings";
import { audit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { formatMoney } from "@/lib/money";
import { sendEmail, buildEmailLayout, escapeHtml } from "@/lib/integrations/email";
import { logger } from "@/lib/logger";

function receiptNumber(): string {
  const year = new Date().getFullYear();
  return `A2V-DON-${year}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export type DonationInput = {
  userId: string | null;
  amountCents: number;
  message?: string | null;
  isPublic: boolean;
  donorDisplayName?: string | null;
  donorEmail?: string | null;
};

export async function createDonation(input: DonationInput) {
  const [minCents, maxCents] = await Promise.all([getSetting("donation.minCents"), getSetting("donation.maxCents")]);
  if (!Number.isInteger(input.amountCents) || input.amountCents < minCents) {
    throw new AppError("VALIDATION", `Le don minimum est de ${formatMoney(minCents)}.`);
  }
  if (input.amountCents > maxCents) {
    throw new AppError("VALIDATION", `Le don maximum est de ${formatMoney(maxCents)} par transaction.`);
  }
  if (input.isPublic && !input.userId) {
    throw new AppError("VALIDATION", "Connectez-vous pour afficher publiquement votre don.");
  }

  const receipt = receiptNumber();
  const now = new Date();

  if (!paymentsSimulationEnabled) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Le paiement des dons nécessite Stripe. Configurez le prestataire avant d'accepter des dons réels.",
    );
  }

  const donation = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        userId: input.userId,
        provider: "SIMULATED",
        providerRef: `sim_donation_${receipt}`,
        idempotencyKey: `donation:${receipt}`,
        type: "DONATION",
        amountCents: input.amountCents,
        status: "SUCCEEDED",
        metadata: { receipt, simulated: true, note: "Don simulé — développement" },
      },
    });
    const created = await tx.donation.create({
      data: {
        donorId: input.userId,
        donorDisplayName: input.isPublic ? input.donorDisplayName || null : null,
        isPublic: input.isPublic,
        amountCents: input.amountCents,
        status: "SUCCEEDED",
        provider: "SIMULATED",
        providerRef: payment.id,
        receiptNumber: receipt,
        message: input.message || null,
        paidAt: now,
      },
    });
    await tx.transactionEvent.create({
      data: {
        paymentId: payment.id,
        actorId: input.userId,
        type: "DONATION_SUCCEEDED",
        amountCents: input.amountCents,
        metadata: { receipt, simulated: true, public: input.isPublic },
      },
    });
    return created;
  });

  if (input.userId) {
    await notify({
      userId: input.userId,
      type: "DONATION",
      title: "Merci pour votre don",
      body: `Votre don de ${formatMoney(input.amountCents)} a été enregistré. Reçu ${receipt}.`,
      href: "/compte/dons",
    });
  }
  if (input.donorEmail) {
    await sendEmail({
      to: input.donorEmail,
      subject: `A2V — Reçu de don ${receipt}`,
      text: `Merci pour votre don de ${formatMoney(input.amountCents)}. Reçu : ${receipt}. Ce reçu est un justificatif de transaction et ne constitue pas une attestation fiscale.`,
      html: buildEmailLayout(
        "Merci pour votre générosité",
        `<p>Votre don de <strong>${escapeHtml(formatMoney(input.amountCents))}</strong> a bien été enregistré.</p><p>Reçu : <strong>${escapeHtml(receipt)}</strong></p><p style="font-size:13px;color:#6B7280">Ce document est un justificatif de transaction. Aucune réduction fiscale n'est promise sans validation réglementaire.</p>`,
        { label: "Voir la page Solidarité", href: `${process.env.APP_URL}/solidarite` },
      ),
    });
  }

  await audit(input.userId, "DONATION_CREATED", {
    targetType: "Donation",
    targetId: donation.id,
    metadata: { amountCents: input.amountCents, simulated: true },
  });

  logger.info("Don enregistré (simulation)", { donationId: donation.id, amountCents: input.amountCents });
  return donation;
}

export type CharityStats = {
  donationsCents: number;
  donationsCount: number;
  contributionsCents: number;
  transfersCents: number;
  availableCents: number;
  lastUpdatedAt: Date;
};

/** Statistiques strictement séparées : collecté, contributions A2V, réellement reversé. */
export async function getCharityStats(): Promise<CharityStats> {
  const [donations, contributions, transfers] = await Promise.all([
    prisma.donation.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: true }),
    prisma.platformContribution.aggregate({ _sum: { amountCents: true } }),
    prisma.charityTransfer.aggregate({ _sum: { amountCents: true } }),
  ]);
  const donationsCents = donations._sum.amountCents ?? 0;
  const contributionsCents = contributions._sum.amountCents ?? 0;
  const transfersCents = transfers._sum.amountCents ?? 0;
  return {
    donationsCents,
    donationsCount: donations._count,
    contributionsCents,
    transfersCents,
    availableCents: Math.max(0, donationsCents + contributionsCents - transfersCents),
    lastUpdatedAt: new Date(),
  };
}

export async function getPublicDonations(limit = 12) {
  return prisma.donation.findMany({
    where: { status: "SUCCEEDED", isPublic: true, donorDisplayName: { not: null } },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: { id: true, donorDisplayName: true, amountCents: true, message: true, paidAt: true },
  });
}

export async function getDonationHistory(userId: string) {
  return prisma.donation.findMany({ where: { donorId: userId }, orderBy: { createdAt: "desc" } });
}

export async function getCharityTransfers() {
  return prisma.charityTransfer.findMany({
    orderBy: { transferredAt: "desc" },
    include: { organization: { select: { name: true, slug: true, verifiedAt: true } } },
  });
}

export async function recordCharityTransfer(input: {
  adminId: string;
  organizationId: string;
  amountCents: number;
  transferredAt: Date;
  reference: string;
  proofUrl?: string | null;
  notes?: string | null;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new AppError("VALIDATION", "Montant de versement invalide.");
  }
  const organization = await prisma.charityOrganization.findUnique({ where: { id: input.organizationId } });
  if (!organization || !organization.isActive) throw new AppError("NOT_FOUND", "Organisation bénéficiaire introuvable.");
  if (!organization.verifiedAt) {
    throw new AppError("CONFLICT", "L'organisme doit être vérifié avant tout versement.");
  }
  const stats = await getCharityStats();
  if (input.amountCents > stats.availableCents) {
    throw new AppError(
      "CONFLICT",
      `Montant supérieur aux fonds disponibles (${formatMoney(stats.availableCents)}). N'affichez jamais comme versé un montant non transféré.`,
    );
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const created = await tx.charityTransfer.create({
      data: {
        organizationId: input.organizationId,
        amountCents: input.amountCents,
        transferredAt: input.transferredAt,
        reference: input.reference,
        proofUrl: input.proofUrl || null,
        notes: input.notes || null,
      },
    });
    await tx.transactionEvent.create({
      data: {
        actorId: input.adminId,
        type: "CHARITY_TRANSFER",
        amountCents: input.amountCents,
        metadata: { organizationId: input.organizationId, reference: input.reference },
      },
    });
    return created;
  });

  await audit(input.adminId, "CHARITY_TRANSFER_RECORDED", {
    targetType: "CharityTransfer",
    targetId: transfer.id,
    metadata: { amountCents: input.amountCents, organizationId: input.organizationId },
  });
  return transfer;
}

export async function recordPlatformContribution(input: {
  adminId: string;
  amountCents: number;
  sourceType: string;
  sourceRef?: string | null;
  description: string;
  occurredAt?: Date;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new AppError("VALIDATION", "Montant de contribution invalide.");
  }
  const contribution = await prisma.platformContribution.create({
    data: {
      amountCents: input.amountCents,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef || null,
      description: input.description,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
  await audit(input.adminId, "PLATFORM_CONTRIBUTION_RECORDED", {
    targetType: "PlatformContribution",
    targetId: contribution.id,
    metadata: { amountCents: input.amountCents },
  });
  return contribution;
}
