"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { isAppError } from "@/lib/errors";
import { formString } from "@/lib/forms";
import { parseEurosToCents } from "@/lib/money";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/services/audit";
import { closeAuction } from "@/lib/services/auctions";
import { cancelOrder, refundOrder, resolveDispute } from "@/lib/services/orders";
import { recordCharityTransfer, recordPlatformContribution } from "@/lib/services/donations";
import { SETTING_DEFAULTS, setSetting, type SettingKey } from "@/lib/services/settings";
import { slugify } from "@/lib/utils";

async function guard(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: errorState("Vous devez être connecté.") };
  if (!hasPermission(user.role, permission)) {
    return { ok: false as const, error: errorState("Vous n'avez pas la permission requise pour cette action.") };
  }
  return { ok: true as const, user };
}

function fail(error: unknown): ActionState {
  return errorState(isAppError(error) ? error.message : "L'action a échoué. Consultez les journaux.");
}

export async function adminSetUserStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.USERS_MANAGE);
  if (!gate.ok) return gate.error;
  const userId = formString(formData, "userId");
  const status = formString(formData, "status");
  if (!["ACTIVE", "SUSPENDED"].includes(status)) return errorState("Statut invalide.");
  if (userId === gate.user.id) return errorState("Vous ne pouvez pas suspendre votre propre compte.");

  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true, publicName: true } });
    if (!target) return errorState("Utilisateur introuvable.");
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: status as "ACTIVE" | "SUSPENDED",
        ...(status === "SUSPENDED" ? { lockedUntil: new Date() } : { failedLoginCount: 0, lockedUntil: null }),
      },
    });
    if (status === "SUSPENDED") {
      await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await audit(gate.user.id, status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED", {
      targetType: "User",
      targetId: userId,
      metadata: { previousStatus: target.status },
    });
    revalidatePath("/admin/utilisateurs");
    revalidatePath(`/admin/utilisateurs/${userId}`);
    return successState(status === "SUSPENDED" ? "Compte suspendu et sessions révoquées." : "Compte réactivé.");
  } catch (error) {
    return fail(error);
  }
}

export async function adminSetUserRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.USERS_MANAGE);
  if (!gate.ok) return gate.error;
  const userId = formString(formData, "userId");
  const role = formString(formData, "role");
  if (!["USER", "MODERATOR", "ADMIN"].includes(role)) return errorState("Rôle invalide.");
  if (userId === gate.user.id) return errorState("Vous ne pouvez pas modifier votre propre rôle (protection anti-verrouillage).");

  try {
    await prisma.user.update({ where: { id: userId }, data: { role: role as "USER" | "MODERATOR" | "ADMIN" } });
    await audit(gate.user.id, "USER_ROLE_CHANGED", { targetType: "User", targetId: userId, metadata: { role } });
    revalidatePath("/admin/utilisateurs");
    revalidatePath(`/admin/utilisateurs/${userId}`);
    return successState(`Rôle mis à jour : ${role}.`);
  } catch (error) {
    return fail(error);
  }
}

export async function adminModerateListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.LISTINGS_MODERATE);
  if (!gate.ok) return gate.error;
  const listingId = formString(formData, "listingId");
  const action = formString(formData, "action");
  if (!["HIDE", "RESTORE"].includes(action)) return errorState("Action inconnue.");

  try {
    await prisma.listing.update({
      where: { id: listingId },
      data:
        action === "HIDE"
          ? { status: "CANCELLED", deletedAt: new Date() }
          : { status: "PUBLISHED", deletedAt: null, publishedAt: new Date() },
    });
    await audit(gate.user.id, action === "HIDE" ? "LISTING_HIDDEN_BY_ADMIN" : "LISTING_RESTORED_BY_ADMIN", {
      targetType: "Listing",
      targetId: listingId,
    });
    revalidatePath("/admin/annonces");
    revalidatePath("/catalogue");
    return successState(action === "HIDE" ? "Annonce retirée du catalogue." : "Annonce restaurée et republiée.");
  } catch (error) {
    return fail(error);
  }
}

export async function adminResolveReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.REPORTS_MANAGE);
  if (!gate.ok) return gate.error;
  const reportId = formString(formData, "reportId");
  const status = formString(formData, "status");
  const decision = formString(formData, "decision");
  const takeDown = formString(formData, "takeDown") === "on";
  if (!["RESOLVED", "DISMISSED"].includes(status)) return errorState("Décision invalide.");
  if (decision.length < 5) return errorState("Ajoutez une motivation (5 caractères minimum).");

  try {
    const report = await prisma.listingReport.findUnique({ where: { id: reportId } });
    if (!report) return errorState("Signalement introuvable.");
    await prisma.$transaction(async (tx) => {
      await tx.listingReport.update({
        where: { id: reportId },
        data: { status: status as "RESOLVED" | "DISMISSED", moderatorId: gate.user.id, decision, resolvedAt: new Date() },
      });
      if (takeDown) {
        await tx.listing.update({
          where: { id: report.listingId },
          data: { status: "CANCELLED", deletedAt: new Date() },
        });
      }
    });
    await audit(gate.user.id, "REPORT_RESOLVED", {
      targetType: "ListingReport",
      targetId: reportId,
      metadata: { status, takeDown },
    });
    revalidatePath("/admin/signalements");
    revalidatePath("/admin/annonces");
    revalidatePath("/catalogue");
    return successState(takeDown ? "Signalement traité et annonce retirée." : "Signalement traité.");
  } catch (error) {
    return fail(error);
  }
}

export async function adminCancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.ORDERS_MANAGE);
  if (!gate.ok) return gate.error;
  const orderId = formString(formData, "orderId");
  const reason = formString(formData, "reason") || "Annulation administrative";
  try {
    const result = await cancelOrder(orderId, gate.user.id, reason, true);
    revalidatePath("/admin/commandes");
    revalidatePath("/compte/achats");
    revalidatePath("/compte/ventes");
    return successState(
      result.refunded
        ? "Commande annulée. Un remboursement simulé a été enregistré (aucun mouvement bancaire réel)."
        : "Commande annulée.",
    );
  } catch (error) {
    return fail(error);
  }
}

export async function adminRefundOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.PAYMENTS_MANAGE);
  if (!gate.ok) return gate.error;
  const orderId = formString(formData, "orderId");
  const amount = Number(formString(formData, "amountEuros").replace(",", "."));
  const reason = formString(formData, "reason") || "Remboursement administratif";
  if (!Number.isFinite(amount) || amount <= 0) return errorState("Montant de remboursement invalide.");
  try {
    await refundOrder(orderId, gate.user.id, parseEurosToCents(amount), reason);
    revalidatePath("/admin/commandes");
    revalidatePath("/admin/litiges");
    return successState(
      `Remboursement de ${amount.toFixed(2)} € enregistré. En simulation, aucun mouvement bancaire réel n'est effectué.`,
    );
  } catch (error) {
    return fail(error);
  }
}

export async function adminResolveDisputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.DISPUTES_MANAGE);
  if (!gate.ok) return gate.error;
  const disputeId = formString(formData, "disputeId");
  const status = formString(formData, "status");
  const resolution = formString(formData, "resolution");
  const releaseFunds = formString(formData, "releaseFunds") === "on";
  if (!["RESOLVED", "REJECTED"].includes(status)) return errorState("Statut invalide.");
  if (resolution.length < 10) return errorState("Décrivez la résolution (10 caractères minimum).");
  try {
    await resolveDispute({
      disputeId,
      adminId: gate.user.id,
      status: status as "RESOLVED" | "REJECTED",
      resolution,
      releaseFunds,
    });
    revalidatePath("/admin/litiges");
    revalidatePath("/admin/commandes");
    revalidatePath("/compte/achats");
    return successState(releaseFunds ? "Litige résolu et vente finalisée." : "Litige résolu.");
  } catch (error) {
    return fail(error);
  }
}

export async function adminCloseAuctionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.AUCTIONS_MANAGE);
  if (!gate.ok) return gate.error;
  const auctionId = formString(formData, "auctionId");
  try {
    const result = await closeAuction(auctionId);
    await audit(gate.user.id, "AUCTION_CLOSED_BY_ADMIN", { targetType: "Auction", targetId: auctionId, metadata: { status: result.status } });
    revalidatePath("/admin/encheres");
    revalidatePath("/encheres");
    return successState(
      result.closed
        ? `Enchère clôturée (${result.status}).`
        : `Enchère non clôturée : ${result.status === "ALREADY" ? "déjà traitée" : "date de fin non atteinte"}.`,
    );
  } catch (error) {
    return fail(error);
  }
}

export async function adminUpdateSettingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.SETTINGS_MANAGE);
  if (!gate.ok) return gate.error;
  const key = formString(formData, "key");
  const raw = formString(formData, "value");
  if (!(key in SETTING_DEFAULTS)) return errorState("Paramètre inconnu.");

  const fallback = SETTING_DEFAULTS[key as SettingKey];
  let value: unknown = raw;
  if (typeof fallback === "number") {
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) return errorState("Valeur numérique invalide.");
    value = parsed;
  } else if (Array.isArray(fallback)) {
    value = raw.split(",").map((part) => Number(part.trim())).filter((part) => Number.isFinite(part));
  }

  try {
    await setSetting(key as SettingKey, value);
    await audit(gate.user.id, "SETTING_UPDATED", { targetType: "PlatformSetting", targetId: key, metadata: { value } });
    revalidatePath("/admin/parametres");
    revalidatePath("/");
    return successState(`Paramètre « ${key} » enregistré.`);
  } catch (error) {
    return fail(error);
  }
}

export async function adminRecordTransferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.DONATIONS_MANAGE);
  if (!gate.ok) return gate.error;
  const organizationId = formString(formData, "organizationId");
  const amount = Number(formString(formData, "amountEuros").replace(",", "."));
  const reference = formString(formData, "reference");
  const dateValue = formString(formData, "transferredAt");
  const notes = formString(formData, "notes");
  const proofUrl = formString(formData, "proofUrl");
  if (!Number.isFinite(amount) || amount <= 0) return errorState("Montant invalide.");
  if (!reference) return errorState("Référence de virement requise.");
  if (!dateValue) return errorState("Date du virement requise.");

  try {
    await recordCharityTransfer({
      adminId: gate.user.id,
      organizationId,
      amountCents: parseEurosToCents(amount),
      transferredAt: new Date(dateValue),
      reference,
      proofUrl: proofUrl || null,
      notes: notes || null,
    });
    revalidatePath("/admin/dons");
    revalidatePath("/solidarite");
    return successState("Versement enregistré. Il est désormais affiché comme réellement transféré.");
  } catch (error) {
    return fail(error);
  }
}

export async function adminRecordContributionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.DONATIONS_MANAGE);
  if (!gate.ok) return gate.error;
  const amount = Number(formString(formData, "amountEuros").replace(",", "."));
  const sourceType = formString(formData, "sourceType") || "A2V";
  const description = formString(formData, "description");
  if (!Number.isFinite(amount) || amount <= 0) return errorState("Montant invalide.");
  if (description.length < 5) return errorState("Description requise.");
  try {
    await recordPlatformContribution({
      adminId: gate.user.id,
      amountCents: parseEurosToCents(amount),
      sourceType,
      description,
    });
    revalidatePath("/admin/dons");
    revalidatePath("/solidarite");
    return successState("Contribution A2V enregistrée séparément des dons.");
  } catch (error) {
    return fail(error);
  }
}

export async function adminResolveMessageReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.REPORTS_MANAGE);
  if (!gate.ok) return gate.error;
  const reportId = formString(formData, "reportId");
  const status = formString(formData, "status");
  const decision = formString(formData, "decision");
  if (!["RESOLVED", "DISMISSED"].includes(status)) return errorState("Décision invalide.");
  if (decision.length < 5) return errorState("Ajoutez une motivation (5 caractères minimum).");

  try {
    const report = await prisma.messageReport.findUnique({ where: { id: reportId } });
    if (!report) return errorState("Signalement introuvable.");
    await prisma.messageReport.update({ where: { id: reportId }, data: { status } });
    await audit(gate.user.id, "MESSAGE_REPORT_RESOLVED", {
      targetType: "MessageReport",
      targetId: reportId,
      metadata: { status, decision },
    });
    revalidatePath("/admin/messages");
    return successState("Signalement de message traité. Aucun contenu n'a été supprimé automatiquement.");
  } catch (error) {
    return fail(error);
  }
}

export async function adminCreateCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await guard(PERMISSIONS.CATEGORIES_MANAGE);
  if (!gate.ok) return gate.error;
  const name = formString(formData, "name");
  const parentId = formString(formData, "parentId") || null;
  const icon = formString(formData, "icon") || null;
  if (name.length < 2) return errorState("Nom de catégorie invalide.");
  const slug = slugify(name);
  if (!slug) return errorState("Nom de catégorie invalide.");
  try {
    const created = await prisma.category.create({ data: { name, slug, icon, parentId } });
    await audit(gate.user.id, "CATEGORY_CREATED", { targetType: "Category", targetId: created.id, metadata: { name, slug } });
    revalidatePath("/admin/categories");
    revalidatePath("/catalogue");
    return successState("Catégorie créée.");
  } catch (error) {
    return fail(error);
  }
}
