"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formBool } from "@/lib/forms";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { getSetting } from "@/lib/services/settings";
import { PREMIUM, trialDurationLabel } from "@/lib/config";
import {
  activateSubscription,
  cancelSubscription,
  resumeSubscription,
  startTrial,
} from "@/lib/services/premium";

function message(error: unknown): string {
  return isAppError(error) ? error.message : "Une erreur est survenue. Réessayez.";
}

export async function startTrialAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour démarrer votre essai.");
  try {
    await startTrial(user.id);
    const trialDays = await getSetting("premium.trialDays");
    revalidatePath("/premium");
    revalidatePath("/compte/abonnement");
    return successState(
      `Votre période offerte de ${trialDurationLabel(trialDays)} est activée. Aucune résiliation n'est possible pendant cette période ni pendant l'engagement de ${PREMIUM.commitmentMonths} mois qui suit.`,
    );
  } catch (error) {
    return errorState(message(error));
  }
}

export async function activateSubscriptionAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour gérer votre abonnement.");
  try {
    await activateSubscription(user.id);
    revalidatePath("/premium");
    revalidatePath("/compte/abonnement");
    return successState(
      "Abonnement activé via le mode simulation de développement : aucun paiement réel n'a été effectué. En production, Stripe Billing est requis.",
    );
  } catch (error) {
    return errorState(message(error));
  }
}

export async function cancelSubscriptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour gérer votre abonnement.");
  const immediate = formBool(formData, "immediate");
  try {
    const subscription = await cancelSubscription(user.id, immediate);
    revalidatePath("/premium");
    revalidatePath("/compte/abonnement");
    return successState(
      immediate
        ? "Abonnement résilié immédiatement. Les avantages Prestige sont désactivés."
        : `Résiliation programmée : votre abonnement reste actif jusqu'au ${subscription.currentPeriodEnd.toLocaleDateString("fr-FR")}. Aucun frais supplémentaire.`,
    );
  } catch (error) {
    return errorState(message(error));
  }
}

export async function resumeSubscriptionAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour gérer votre abonnement.");
  try {
    await resumeSubscription(user.id);
    revalidatePath("/premium");
    revalidatePath("/compte/abonnement");
    return successState("Résiliation annulée : votre abonnement continue normalement.");
  } catch (error) {
    return errorState(message(error));
  }
}
