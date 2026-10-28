"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { env, paymentsSimulationEnabled, stripeEnabled } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { formBool, formString } from "@/lib/forms";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { checkoutSchema, disputeSchema, reviewSchema } from "@/lib/validation/schemas";
import {
  addReview,
  cancelOrder,
  confirmReception,
  createOrder,
  markOrderPreparing,
  openDispute,
  payOrderSimulated,
  startStripeCheckout,
} from "@/lib/services/orders";

function message(error: unknown): string {
  return isAppError(error) ? error.message : "Une erreur est survenue. Réessayez.";
}

export async function createOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour finaliser votre achat.");

  const parsed = checkoutSchema.safeParse({
    listingId: formString(formData, "listingId"),
    addressId: formString(formData, "addressId"),
    shippingService: formString(formData, "shippingService"),
    couponCode: formString(formData, "couponCode"),
    buyerNote: formString(formData, "buyerNote"),
    acceptTerms: formBool(formData, "acceptTerms"),
  });
  if (!parsed.success) return errorState("Vérifiez votre commande.", zodToFieldErrors(parsed.error));

  try {
    const order = await createOrder({
      buyerId: user.id,
      listingId: parsed.data.listingId,
      addressId: parsed.data.addressId,
      shippingService: parsed.data.shippingService,
      couponCode: parsed.data.couponCode || null,
      buyerNote: parsed.data.buyerNote || null,
      auctionWinnerId: formString(formData, "auctionWinnerId") || null,
    });
    revalidatePath("/compte/achats");
    revalidatePath("/compte/encheres");
    redirect(`/commande/${order.orderNumber}`);
  } catch (error) {
    return errorState(message(error), isAppError(error) ? error.fieldErrors : undefined);
  }
}

export async function payOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour payer cette commande.");
  const orderNumber = formString(formData, "orderNumber");
  if (!orderNumber) return errorState("Commande introuvable.");

  if (stripeEnabled && !paymentsSimulationEnabled) {
    const result = await startStripeCheckout(orderNumber, user.id, env.APP_URL);
    redirect(result.url);
  }

  try {
    const result = await payOrderSimulated(orderNumber, user.id);
    revalidatePath(`/commande/${orderNumber}`);
    revalidatePath("/compte/achats");
    revalidatePath("/compte/ventes");
    return successState(
      result.alreadyPaid
        ? "Cette commande était déjà payée."
        : "Paiement simulé confirmé. Aucun montant réel n'a été prélevé — cet environnement est une démonstration.",
    );
  } catch (error) {
    return errorState(message(error));
  }
}

export async function cancelOrderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const orderId = formString(formData, "orderId");
  if (!orderId) return;
  const reason = formString(formData, "reason") || "Annulation demandée depuis le compte";
  try {
    await cancelOrder(orderId, user.id, reason);
  } catch {
    // L'état de la commande est revalidé : la page affiche l'état réel.
  }
  revalidatePath("/compte/achats");
  revalidatePath("/compte/ventes");
  revalidatePath("/compte/commandes");
}

export async function markPreparingAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const orderId = formString(formData, "orderId");
  if (orderId) {
    try {
      await markOrderPreparing(orderId, user.id);
    } catch {
      // ignoré : état revalidé ci-dessous
    }
  }
  revalidatePath("/compte/ventes");
}

export async function confirmReceptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour confirmer la réception.");
  const orderId = formString(formData, "orderId");
  if (!orderId) return errorState("Commande introuvable.");
  try {
    const result = await confirmReception(orderId, user.id);
    revalidatePath("/compte/achats");
    revalidatePath("/compte/livraisons");
    return successState(
      result.finalized
        ? "Réception confirmée : la vente est finalisée. Les trophées éventuels ont été attribués."
        : "Réception confirmée. La vente sera finalisée après le délai de protection.",
    );
  } catch (error) {
    return errorState(message(error));
  }
}

export async function openDisputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour ouvrir un litige.");
  const parsed = disputeSchema.safeParse({
    orderId: formString(formData, "orderId"),
    reason: formString(formData, "reason"),
    description: formString(formData, "description"),
  });
  if (!parsed.success) return errorState("Vérifiez le formulaire.", zodToFieldErrors(parsed.error));
  try {
    await openDispute(parsed.data.orderId, user.id, parsed.data.reason, parsed.data.description);
    revalidatePath("/compte/achats");
    revalidatePath("/compte/ventes");
    return successState("Litige ouvert. L'équipe A2V va examiner la situation ; les fonds restent bloqués jusqu'à résolution.");
  } catch (error) {
    return errorState(message(error));
  }
}

export async function addReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour évaluer cette transaction.");
  const parsed = reviewSchema.safeParse({
    orderId: formString(formData, "orderId"),
    rating: formString(formData, "rating"),
    comment: formString(formData, "comment"),
  });
  if (!parsed.success) return errorState("Vérifiez votre évaluation.", zodToFieldErrors(parsed.error));
  try {
    await addReview(parsed.data.orderId, user.id, parsed.data.rating, parsed.data.comment || "");
    revalidatePath("/compte/achats");
    return successState("Merci, votre évaluation est publiée.");
  } catch (error) {
    return errorState(message(error));
  }
}
