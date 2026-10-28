import { NextResponse } from "next/server";
import type { ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { shippingSimulation } from "@/lib/env";
import { verifyCarrierWebhook } from "@/lib/integrations/laposte";
import { advanceShipment } from "@/lib/services/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: ShipmentStatus[] = [
  "HANDED_OVER",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "LOST",
  "DAMAGED",
  "RETURNED",
];

/**
 * Webhook transporteur.
 * Sans secret partagé et hors mode live, la route refuse explicitement : aucun
 * suivi réel n'est simulé silencieusement.
 */
export async function POST(request: Request) {
  if (shippingSimulation) {
    return NextResponse.json(
      { error: "SHIPPING_MODE=simulation : le webhook transporteur est désactivé." },
      { status: 503 },
    );
  }
  const authorized = await verifyCarrierWebhook(request);
  if (!authorized) {
    return NextResponse.json({ error: "Signature de webhook invalide." }, { status: 401 });
  }

  let body: { trackingNumber?: string; status?: string; occurredAt?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const trackingNumber = body.trackingNumber?.trim();
  const status = body.status as ShipmentStatus | undefined;
  if (!trackingNumber || !status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "trackingNumber ou status invalide." }, { status: 422 });
  }
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "occurredAt invalide." }, { status: 422 });
  }

  const shipment = await prisma.shipment.findFirst({ where: { trackingNumber } });
  if (!shipment) {
    return NextResponse.json({ error: "Expédition inconnue pour ce numéro de suivi." }, { status: 404 });
  }

  try {
    await advanceShipment({
      shipmentId: shipment.id,
      status,
      actorId: null,
      source: "CARRIER",
      occurredAt,
      message: body.message ?? `Mise à jour transporteur : ${status}`,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
