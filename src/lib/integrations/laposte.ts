import "server-only";

import { env, shippingSimulation } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Passerelle transporteur isolée.
 *
 * ⚠️ Aucune connexion réelle à l'API La Poste n'est active sans contrat,
 * identifiants et validation. En mode `simulation`, les étiquettes et suivis
 * sont générés localement et marqués `isSimulated`.
 */
export type ShippingLabelRequest = {
  orderId: string;
  orderNumber: string;
  senderName: string;
  recipientName: string;
  addressLine1: string;
  addressLine2?: string | null;
  postalCode: string;
  city: string;
  country: string;
  weightGrams: number;
  serviceCode: string;
};

export type ShippingLabelResult = {
  providerRef: string;
  trackingNumber: string;
  labelUrl: string;
  simulated: boolean;
  format: "PDF" | "HTML";
};

export type TrackingState = {
  trackingNumber: string;
  status: "HANDED_OVER" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "LOST" | "DAMAGED" | "RETURNED";
  occurredAt: Date;
  message?: string;
};

export interface CarrierAdapter {
  readonly name: string;
  readonly simulated: boolean;
  createLabel(request: ShippingLabelRequest): Promise<ShippingLabelResult>;
  track(trackingNumber: string): Promise<TrackingState | null>;
}

/**
 * Adaptateur La Poste : squelette volontairement non opérationnel.
 * Brancher ici l'API officielle (Colissimo / Suivi) lorsque les accès sont
 * fournis. Lève une erreur explicite au lieu de simuler silencieusement.
 */
class LaPosteAdapter implements CarrierAdapter {
  readonly name = "LA_POSTE";
  readonly simulated = false;

  async createLabel(): Promise<ShippingLabelResult> {
    throw new AppError(
      "NOT_CONFIGURED",
      "La Poste n'est pas configurée. Fournissez LAPOSTE_API_KEY et activez SHIPPING_MODE=live après validation du contrat.",
    );
  }

  async track(): Promise<TrackingState | null> {
    if (!env.LAPOSTE_API_KEY) {
      throw new AppError("NOT_CONFIGURED", "Le suivi La Poste n'est pas configuré.");
    }
    logger.warn("Suivi La Poste demandé mais adaptateur non implémenté");
    return null;
  }
}

export const laPosteAdapter = new LaPosteAdapter();

export function getCarrierAdapter(): CarrierAdapter {
  if (shippingSimulation) throw new AppError("CONFLICT", "Utilisez le service de livraison simulé en développement.");
  return laPosteAdapter;
}

export async function verifyCarrierWebhook(request: Request): Promise<boolean> {
  if (shippingSimulation) return false;
  const secret = request.headers.get("x-a2v-webhook-secret");
  return Boolean(env.LAPOSTE_WEBHOOK_SECRET && secret === env.LAPOSTE_WEBHOOK_SECRET);
}
