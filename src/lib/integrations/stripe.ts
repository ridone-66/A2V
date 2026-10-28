import "server-only";

import Stripe from "stripe";
import { env, stripeEnabled } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Intégration Stripe isolée.
 *
 * Sans STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET, aucune requête Stripe n'est
 * effectuée. Le checkout est alors refusé ou remplacé par le mode simulation
 * (voir PAYMENTS_SIMULATION). Nous ne prétendons jamais qu'un paiement réel a
 * eu lieu sans webhook signé.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripeEnabled) return null;
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY!, {
      appInfo: { name: "A2V", version: "1.0.0" },
      maxNetworkRetries: 2,
    });
  }
  return client;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Le paiement par carte n'est pas configuré. Ajoutez STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET.",
    );
  }
  return stripe;
}

type OrderCheckoutInput = {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  amountCents: number;
  commissionCents: number;
  buyerEmail: string;
  sellerStripeAccountId?: string | null;
  label: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createOrderCheckoutSession(input: OrderCheckoutInput): Promise<{ url: string; id: string }> {
  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.buyerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: input.amountCents,
          product_data: { name: input.label, description: `Commande ${input.orderNumber} — A2V` },
        },
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { orderId: input.orderId, paymentId: input.paymentId, kind: "ORDER" },
    payment_intent_data: {
      metadata: { orderId: input.orderId, paymentId: input.paymentId },
      ...(input.sellerStripeAccountId
        ? {
            application_fee_amount: input.commissionCents,
            transfer_data: { destination: input.sellerStripeAccountId },
          }
        : {}),
    },
  });

  if (!session.url) throw new AppError("INTERNAL", "Stripe n'a pas retourné d'URL de paiement.");
  return { url: session.url, id: session.id };
}

export async function createSubscriptionCheckoutSession(input: {
  userId: string;
  email: string;
  trialDays: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; id: string }> {
  const stripe = requireStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.email,
    line_items: [
      env.STRIPE_PRICE_PREMIUM
        ? { price: env.STRIPE_PRICE_PREMIUM, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: 600,
              recurring: { interval: "month" },
              product_data: { name: "A2V Prestige Club" },
            },
          },
    ],
    subscription_data: {
      trial_period_days: Math.min(730, Math.max(0, input.trialDays)),
      metadata: { userId: input.userId, kind: "PREMIUM" },
    },
    metadata: { userId: input.userId, kind: "PREMIUM" },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  if (!session.url) throw new AppError("INTERNAL", "Stripe n'a pas retourné d'URL de paiement.");
  return { url: session.url, id: session.id };
}

export async function refundStripePayment(paymentIntentId: string, amountCents?: number) {
  const stripe = requireStripe();
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountCents ? { amount: amountCents } : {}),
  });
}

/** Vérification de signature — lève une erreur si le webhook est falsifié. */
export function verifyStripeSignature(payload: string, signature: string | null): Stripe.Event {
  if (!signature) throw new AppError("FORBIDDEN", "Signature webhook manquante.");
  const stripe = requireStripe();
  try {
    return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    logger.warn("Webhook Stripe rejeté (signature invalide)", { error: String(error) });
    throw new AppError("FORBIDDEN", "Signature webhook invalide.");
  }
}
