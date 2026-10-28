import "server-only";

import type { OrderStatus, ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { shippingSimulation } from "@/lib/env";
import { notify } from "@/lib/services/notifications";
import { audit } from "@/lib/services/audit";
import { logger } from "@/lib/logger";
import { getCarrierAdapter } from "@/lib/integrations/laposte";
import { escapeHtml } from "@/lib/integrations/email";
import { formatMoney } from "@/lib/money";

/**
 * Transitions autorisées du suivi de livraison. Exporté pour être testé et
 * réutilisé (webhook transporteur, simulations, actions vendeur).
 */
export const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["LABEL_CREATED", "LOST", "DAMAGED"],
  LABEL_CREATED: ["HANDED_OVER", "IN_TRANSIT", "RETURNED", "LOST", "DAMAGED"],
  HANDED_OVER: ["IN_TRANSIT", "DELIVERED", "RETURNED", "LOST", "DAMAGED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "LOST", "DAMAGED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED", "LOST", "DAMAGED"],
  DELIVERED: [],
  LOST: ["RETURNED"],
  DAMAGED: ["RETURNED"],
  RETURNED: [],
};

export type ShippingQuoteView = {
  service: string;
  label: string;
  priceCents: number;
  isSimulated: boolean;
  carrier: string;
  maxWeightG: number;
};

export async function getShippingQuotes(weightGrams = 1000, zone = "FR"): Promise<ShippingQuoteView[]> {
  const quotes = await prisma.shippingQuote.findMany({
    where: {
      isActive: true,
      zone,
      minWeightG: { lte: weightGrams },
      maxWeightG: { gte: weightGrams },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    orderBy: { priceCents: "asc" },
  });

  if (quotes.length === 0) {
    // Grille de repli, explicitement marquée comme simulée.
    return [
      { service: "COLISSIMO_DOMICILE", label: "Colissimo domicile (simulation)", priceCents: 690, isSimulated: true, carrier: "LA_POSTE", maxWeightG: 30000 },
      { service: "COLISSIMO_POINT", label: "Colissimo point retrait (simulation)", priceCents: 490, isSimulated: true, carrier: "LA_POSTE", maxWeightG: 30000 },
      { service: "LETTRE_SUIVIE", label: "Lettre suivie (simulation)", priceCents: 390, isSimulated: true, carrier: "LA_POSTE", maxWeightG: 3000 },
      { service: "REMISE_MAIN_PROPRE", label: "Remise en main propre", priceCents: 0, isSimulated: true, carrier: "A2V", maxWeightG: 30000 },
    ];
  }

  return quotes.map((quote) => ({
    service: quote.service,
    label: quote.isSimulated ? `${quote.label} (simulation)` : quote.label,
    priceCents: quote.priceCents,
    isSimulated: quote.isSimulated,
    carrier: quote.carrier,
    maxWeightG: quote.maxWeightG,
  }));
}

export async function getQuoteForService(service: string, weightGrams = 1000): Promise<ShippingQuoteView> {
  const quotes = await getShippingQuotes(weightGrams);
  const quote = quotes.find((candidate) => candidate.service === service);
  if (!quote) throw new AppError("VALIDATION", "Mode de livraison indisponible pour ce colis.");
  return quote;
}

function trackingNumber(): string {
  const digits = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
  // Préfixe SIM = clairement identifié comme simulation, jamais présenté comme un suivi réel.
  return `SIM${digits}FR`;
}

/**
 * Génère une étiquette. En mode simulation, un document HTML local est créé.
 * En mode live, la passerelle transporteur est appelée et peut refuser si non configurée.
 */
export async function createShippingLabel(orderId: string, sellerId: string, weightGrams = 1000) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      listing: { select: { title: true, shippingNotes: true } },
      shippingAddress: true,
      shipment: { include: { label: true } },
      buyer: { select: { id: true, publicName: true } },
      seller: { select: { id: true, publicName: true, email: true } },
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Commande introuvable.");
  if (order.sellerId !== sellerId) throw new AppError("FORBIDDEN", "Seul le vendeur peut générer l'étiquette.");
  if (!["PAID", "PREPARING"].includes(order.status)) {
    throw new AppError("CONFLICT", "La commande doit être payée avant de générer une étiquette.");
  }
  if (order.shipment?.label) return order.shipment;

  if (!order.shippingAddress) throw new AppError("CONFLICT", "Adresse de livraison manquante.");
  if (order.shippingMethod === "REMISE_MAIN_PROPRE") {
    throw new AppError("CONFLICT", "Cette commande est en remise en main propre : aucune étiquette n'est nécessaire.");
  }

  let labelResult: { providerRef: string; trackingNumber: string; labelUrl: string; simulated: boolean; format: "PDF" | "HTML" };

  if (shippingSimulation) {
    const simulatedTracking = trackingNumber();
    labelResult = {
      providerRef: `SIM-LABEL-${Date.now().toString(36).toUpperCase()}`,
      trackingNumber: simulatedTracking,
      labelUrl: `/api/shipping/label/${order.shipment?.id ?? "pending"}`,
      simulated: true,
      format: "HTML",
    };
  } else {
    const adapter = getCarrierAdapter();
    labelResult = await adapter.createLabel({
      orderId: order.id,
      orderNumber: order.orderNumber,
      senderName: order.seller.publicName,
      recipientName: order.shippingAddress.fullName,
      addressLine1: order.shippingAddress.line1,
      addressLine2: order.shippingAddress.line2,
      postalCode: order.shippingAddress.postalCode,
      city: order.shippingAddress.city,
      country: order.shippingAddress.country,
      weightGrams,
      serviceCode: order.shippingMethod ?? "COLISSIMO_DOMICILE",
    });
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const created =
      order.shipment ??
      (await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: order.shippingMethod === "REMISE_MAIN_PROPRE" ? "A2V" : "LA_POSTE",
          service: order.shippingMethod ?? "COLISSIMO_DOMICILE",
          status: "PENDING",
        },
      }));

    const updated = await tx.shipment.update({
      where: { id: created.id },
      data: {
        status: "LABEL_CREATED",
        trackingNumber: labelResult.trackingNumber,
        trackingUrl: labelResult.simulated ? null : `https://www.laposte.fr/outils/suivre-vos-envois?code=${labelResult.trackingNumber}`,
        lastEventAt: new Date(),
        label: {
          upsert: {
            update: {
              providerRef: labelResult.providerRef,
              labelUrl: `/api/shipping/label/${created.id}`,
              format: labelResult.format,
              trackingNumber: labelResult.trackingNumber,
              isSimulated: labelResult.simulated,
            },
            create: {
              providerRef: labelResult.providerRef,
              labelUrl: `/api/shipping/label/${created.id}`,
              format: labelResult.format,
              trackingNumber: labelResult.trackingNumber,
              isSimulated: labelResult.simulated,
            },
          },
        },
        events: {
          create: {
            status: "LABEL_CREATED",
            message: labelResult.simulated ? "Étiquette simulée générée (développement)" : "Étiquette générée par le transporteur",
            source: labelResult.simulated ? "SIMULATION" : "CARRIER",
          },
        },
      },
      include: { label: true, order: true },
    });

    await tx.order.update({ where: { id: order.id }, data: { status: "PREPARING" } });
    await tx.listing.update({ where: { id: order.listingId }, data: { status: "PREPARING" } });
    await tx.transactionEvent.create({
      data: {
        orderId: order.id,
        actorId: sellerId,
        type: "SHIPPING_LABEL_CREATED",
        metadata: { simulated: labelResult.simulated, trackingNumber: labelResult.trackingNumber },
      },
    });
    return updated;
  });

  await notify({
    userId: order.buyerId,
    type: "ORDER_SHIPPED",
    title: "Votre colis est en préparation",
    body: `Le vendeur a généré une étiquette${labelResult.simulated ? " (simulation de développement)" : ""} pour la commande ${order.orderNumber}. Suivi : ${labelResult.trackingNumber}.`,
    href: `/compte/livraisons`,
  });
  await audit(sellerId, "SHIPPING_LABEL_CREATED", {
    targetType: "Shipment",
    targetId: shipment.id,
    metadata: { simulated: labelResult.simulated, orderId: order.id },
  });
  return shipment;
}

export async function advanceShipment(input: {
  shipmentId: string;
  status: ShipmentStatus;
  actorId: string | null;
  source?: "SIMULATION" | "CARRIER" | "ADMIN" | "SELLER";
  message?: string;
  occurredAt?: Date;
}) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: input.shipmentId },
    include: {
      order: { include: { buyer: { select: { id: true, email: true } }, seller: { select: { id: true, email: true } } } },
    },
  });
  if (!shipment) throw new AppError("NOT_FOUND", "Expédition introuvable.");
  if (shipment.status === input.status) return shipment;
  const allowed = ALLOWED_TRANSITIONS[shipment.status];
  if (!allowed.includes(input.status)) {
    throw new AppError("CONFLICT", `Transition de livraison invalide (${shipment.status} → ${input.status}).`);
  }

  const occurredAt = input.occurredAt ?? new Date();
  const orderStatus: OrderStatus | null =
    input.status === "DELIVERED"
      ? "DELIVERED"
      : input.status === "HANDED_OVER"
        ? "SHIPPED"
        : ["IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(input.status)
          ? "IN_TRANSIT"
          : input.status === "LABEL_CREATED"
            ? "PREPARING"
            : null;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: input.status,
        lastEventAt: occurredAt,
        ...(input.status === "DELIVERED" ? { deliveredAt: occurredAt } : {}),
        events: {
          create: {
            status: input.status,
            message: input.message ?? null,
            occurredAt,
            source: input.source ?? "SIMULATION",
          },
        },
      },
    });

    if (orderStatus) {
      await tx.order.update({
        where: { id: shipment.orderId },
        data: {
          status: orderStatus,
          ...(input.status === "DELIVERED" ? { deliveredAt: occurredAt } : {}),
          ...(["HANDED_OVER", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(input.status)
            ? { shippedAt: shipment.order.shippedAt ?? occurredAt }
            : {}),
        },
      });
      await tx.listing.update({
        where: { id: shipment.order.listingId },
        data: {
          status:
            input.status === "DELIVERED"
              ? "DELIVERED"
              : input.status === "HANDED_OVER"
                ? "SHIPPED"
                : ["IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(input.status)
                  ? "IN_TRANSIT"
                  : "PREPARING",
        },
      });
    }

    if (input.status === "DELIVERED") {
      await tx.transactionEvent.create({
        data: {
          orderId: shipment.orderId,
          actorId: input.actorId,
          type: "ORDER_DELIVERED",
          metadata: { source: input.source ?? "SIMULATION", trackingNumber: shipment.trackingNumber },
        },
      });
    }

    return result;
  });

  const titleByStatus: Partial<Record<ShipmentStatus, string>> = {
    HANDED_OVER: "Votre colis a été déposé",
    IN_TRANSIT: "Votre colis est expédié",
    OUT_FOR_DELIVERY: "Votre colis est en cours de livraison",
    DELIVERED: "Votre colis a été livré",
    LOST: "Problème de livraison : colis perdu",
    DAMAGED: "Problème de livraison : colis endommagé",
    RETURNED: "Votre colis a été retourné",
  };
  const title = titleByStatus[input.status];
  if (title) {
    await notify({
      userId: shipment.order.buyerId,
      type: input.status === "DELIVERED" ? "ORDER_DELIVERED" : "ORDER_SHIPPED",
      title,
      body: `Commande ${shipment.order.orderNumber}${shipment.trackingNumber ? ` — suivi ${shipment.trackingNumber}` : ""}.${input.status === "DELIVERED" ? " Vous pouvez confirmer la réception pour finaliser la vente." : ""}`,
      href: "/compte/livraisons",
    });
    if (input.status === "LOST" || input.status === "DAMAGED") {
      await notify({
        userId: shipment.order.sellerId,
        type: "ORDER_CANCELLED",
        title: title,
        body: `La commande ${shipment.order.orderNumber} rencontre un incident de livraison. Un litige peut être ouvert depuis le suivi.`,
        href: "/compte/ventes",
      });
    }
  }

  await audit(input.actorId, "SHIPMENT_STATUS_UPDATED", {
    targetType: "Shipment",
    targetId: shipment.id,
    metadata: { from: shipment.status, to: input.status, source: input.source ?? "SIMULATION" },
  });

  logger.info("Statut de livraison mis à jour", { shipmentId: shipment.id, status: input.status });
  return updated;
}

export async function getShipmentForLabel(shipmentId: string) {
  return prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: { include: { shippingAddress: true, buyer: { select: { publicName: true } }, seller: { select: { publicName: true } } } },
      label: true,
      events: { orderBy: { occurredAt: "desc" } },
    },
  });
}

export function renderShippingLabelHtml(shipment: Awaited<ReturnType<typeof getShipmentForLabel>>): string {
  if (!shipment) throw new AppError("NOT_FOUND", "Étiquette introuvable.");
  const address = shipment.order.shippingAddress;
  if (!address) throw new AppError("CONFLICT", "Adresse manquante.");
  const simulated = shipment.label?.isSimulated ?? true;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Étiquette ${escapeHtml(shipment.order.orderNumber)}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:24px;background:#f3f4f6;color:#111827}
  .label{width:520px;margin:0 auto;background:#fff;border:2px solid #111827;padding:24px}
  .sim{background:#FEF3C7;border:1px solid #D97706;color:#92400E;padding:8px;font-size:12px;margin-bottom:16px;border-radius:4px}
  .brand{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:16px}
  .brand strong{font-size:26px;color:#6D28D9}
  h1{font-size:18px;margin:0 0 8px}
  .addr{font-size:15px;line-height:1.5;margin-bottom:16px}
  .tracking{font-size:20px;letter-spacing:2px;font-weight:bold;border:2px dashed #111827;padding:10px;text-align:center}
  .meta{display:flex;justify-content:space-between;font-size:12px;color:#4B5563;margin-top:16px}
  .bars{height:44px;margin-top:16px;background:repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 5px,#111 5px 6px,#fff 6px 10px)}
</style></head><body>
<div class="label">
  ${simulated ? '<div class="sim">⚠ ÉTIQUETTE DE SIMULATION — aucun affranchissement réel. Mode développement.</div>' : ""}
  <div class="brand"><strong>A2V</strong><span>${escapeHtml(shipment.carrier)}</span></div>
  <h1>Destinataire</h1>
  <div class="addr"><strong>${escapeHtml(address.fullName)}</strong><br/>${escapeHtml(address.line1)}<br/>${address.line2 ? `${escapeHtml(address.line2)}<br/>` : ""}${escapeHtml(address.postalCode)} ${escapeHtml(address.city)}<br/>${escapeHtml(address.country)}</div>
  <h1>Expéditeur</h1>
  <div class="addr">${escapeHtml(shipment.order.seller.publicName)}<br/>Commande ${escapeHtml(shipment.order.orderNumber)}</div>
  <div class="tracking">${escapeHtml(shipment.trackingNumber ?? "—")}</div>
  <div class="meta"><span>${escapeHtml(shipment.service)}</span><span>${escapeHtml(formatMoney(shipment.order.shippingCents))}</span></div>
  <div class="bars"></div>
</div>
</body></html>`;
}
