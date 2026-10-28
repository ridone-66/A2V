"use server";

import { revalidatePath } from "next/cache";
import type { ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { isAppError } from "@/lib/errors";
import { shippingSimulation } from "@/lib/env";
import { formString } from "@/lib/forms";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { advanceShipment, createShippingLabel } from "@/lib/services/shipping";

function message(error: unknown): string {
  return isAppError(error) ? error.message : "L'opération d'expédition a échoué.";
}

const SIMULATED_NEXT: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  LABEL_CREATED: "HANDED_OVER",
  HANDED_OVER: "IN_TRANSIT",
  IN_TRANSIT: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export async function createShippingLabelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour générer une étiquette.");
  const orderId = formString(formData, "orderId");
  if (!orderId) return errorState("Commande introuvable.");
  const weight = Number(formString(formData, "weightGrams") || "1000");
  try {
    const shipment = await createShippingLabel(orderId, user.id, Number.isFinite(weight) ? weight : 1000);
    revalidatePath("/compte/ventes");
    revalidatePath("/compte/livraisons");
    revalidatePath("/admin/commandes");
    return successState(
      shipment.label?.isSimulated
        ? "Étiquette de simulation créée. Elle porte la mention « simulation » : aucun affranchissement réel n'a eu lieu."
        : "Étiquette transporteur créée.",
    );
  } catch (error) {
    return errorState(message(error));
  }
}

export async function advanceShipmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous.");
  if (!shippingSimulation) {
    return errorState(
      "Le suivi manuel est désactivé hors simulation. Les statuts doivent provenir du webhook transporteur signé.",
    );
  }
  const shipmentId = formString(formData, "shipmentId");
  if (!shipmentId) return errorState("Expédition introuvable.");

  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { sellerId: true, orderNumber: true } } },
    });
    if (!shipment) return errorState("Expédition introuvable.");
    const isOwner = shipment.order.sellerId === user.id;
    const isAdmin = hasPermission(user.role, PERMISSIONS.ORDERS_MANAGE);
    if (!isOwner && !isAdmin) return errorState("Seul le vendeur ou un administrateur peut faire évoluer le suivi.");

    const requested = formString(formData, "status");
    const next = (requested || SIMULATED_NEXT[shipment.status]) as ShipmentStatus | undefined;
    if (!next) return errorState("Aucune étape suivante disponible pour cette expédition.");

    await advanceShipment({
      shipmentId,
      status: next,
      actorId: user.id,
      source: isAdmin && !isOwner ? "ADMIN" : "SIMULATION",
      message: "Étape simulée manuellement dans l'environnement de démonstration.",
    });
    revalidatePath("/compte/ventes");
    revalidatePath("/compte/livraisons");
    revalidatePath("/compte/achats");
    revalidatePath("/admin/commandes");
    return successState(
      next === "DELIVERED"
        ? "Livraison simulée marquée comme livrée. La finalisation reste soumise au délai de protection et à l'absence de litige."
        : `Suivi simulé mis à jour : ${next}.`,
    );
  } catch (error) {
    return errorState(message(error));
  }
}
