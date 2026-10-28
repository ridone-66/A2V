import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { env, stripeEnabled } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { verifyStripeSignature } from "@/lib/integrations/stripe";
import { handleStripeOrderPaid } from "@/lib/services/orders";
import { activateSubscriptionFromStripe } from "@/lib/services/premium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe.
 * - La signature est vérifiée avant toute lecture métier.
 * - L'événement est enregistré avec une contrainte unique (provider, eventId)
 *   pour garantir l'idempotence des rejeux.
 * - Sans clés configurées, la route répond 503 ; aucun paiement n'est supposé.
 */
export async function POST(request: Request) {
  if (!stripeEnabled) {
    return NextResponse.json(
      { error: "Stripe n'est pas configuré : webhook inactif (aucun paiement réel attendu)." },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyStripeSignature(payload, signature);
  } catch (error) {
    return NextResponse.json(
      { error: isAppError(error) ? error.message : "Signature invalide." },
      { status: 400 },
    );
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "STRIPE", eventId: event.id } },
  });
  if (existing?.status === "PROCESSED") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const record =
    existing ??
    (await prisma.webhookEvent.create({
      data: {
        provider: "STRIPE",
        eventId: event.id,
        type: event.type,
        payload: JSON.parse(JSON.stringify(event)),
      },
    }));

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const kind = session.metadata?.kind;
        const orderId = session.metadata?.orderId;

        if (kind === "ORDER" && orderId) {
          if (session.payment_status !== "paid") {
            logger.warn("Checkout Stripe non payé reçu", { sessionId: session.id, orderId });
            break;
          }
          await handleStripeOrderPaid({ orderId, providerRef: session.id });
        } else if (kind === "PREMIUM") {
          const userId = session.metadata?.userId;
          if (!userId) throw new Error("metadata.userId manquant pour l'abonnement.");
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
          if (!subscriptionId) throw new Error("Identifiant d'abonnement Stripe manquant.");
          // La période est calculée à un mois : en production, préférer la date
          // renvoyée par l'API Billing (invoice.paid) comme source de vérité.
          await activateSubscriptionFromStripe({
            userId,
            providerRef: subscriptionId,
            currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
          });
        } else {
          logger.warn("Checkout Stripe sans type reconnu", { sessionId: session.id, kind });
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object;
        if (session.metadata?.kind === "ORDER" && session.metadata.orderId) {
          await prisma.payment.updateMany({
            where: { orderId: session.metadata.orderId, providerRef: session.id, status: "PENDING" },
            data: { status: "FAILED", failureCode: "CHECKOUT_EXPIRED" },
          });
        }
        break;
      }
      default:
        logger.info("Événement Stripe ignoré (non implémenté)", { type: event.type, eventId: event.id });
    }

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "FAILED", error: message.slice(0, 2000) },
    });
    logger.error("Webhook Stripe en échec", { eventId: event.id, type: event.type, error: message });
    // 500 : Stripe rejouera l'événement. L'idempotence empêche un double traitement.
    return NextResponse.json({ error: "Traitement échoué." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { endpoint: "stripe-webhook", configured: stripeEnabled, environment: env.NODE_ENV },
    { status: 200 },
  );
}
