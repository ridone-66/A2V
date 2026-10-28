"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { parseEurosToCents } from "@/lib/money";
import { formString } from "@/lib/forms";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { bidSchema } from "@/lib/validation/schemas";
import { buyNow, placeBid } from "@/lib/services/auctions";

function message(error: unknown): string {
  return isAppError(error) ? error.message : "Une erreur est survenue. Réessayez.";
}

export async function placeBidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour enchérir.");
  const auctionId = formString(formData, "auctionId");
  const parsed = bidSchema.safeParse({
    auctionId,
    amountEuros: formString(formData, "amountEuros"),
    maxAmountEuros: formString(formData, "maxAmountEuros"),
  });
  if (!parsed.success) return errorState("Montant d'offre invalide.", zodToFieldErrors(parsed.error));
  if (parsed.data.maxAmountEuros) {
    return errorState(
      "L'enchère automatique (offre maximale) n'est pas encore disponible dans cette version. Indiquez le montant exact de votre offre.",
    );
  }

  try {
    const result = await placeBid({
      auctionId: parsed.data.auctionId,
      userId: user.id,
      amountCents: parseEurosToCents(parsed.data.amountEuros),
    });
    const slug = formString(formData, "slug");
    if (slug) {
      revalidatePath(`/encheres/${slug}`);
    }
    revalidatePath("/encheres");
    revalidatePath("/compte/encheres");
    return successState(
      result.extended
        ? "Offre enregistrée. L'enchère a été prolongée de 2 minutes (anti-sniping)."
        : "Offre enregistrée. Vous êtes en tête tant qu'aucune offre supérieure n'est reçue.",
      { amountCents: result.amountCents, endsAt: result.endsAt.toISOString(), extended: result.extended },
    );
  } catch (error) {
    return errorState(message(error));
  }
}

export async function buyNowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour acheter immédiatement.");
  const auctionId = formString(formData, "auctionId");
  if (!auctionId) return errorState("Enchère introuvable.");
  try {
    const winner = await buyNow(auctionId, user.id);
    revalidatePath("/encheres");
    revalidatePath("/compte/encheres");
    redirect(`/paiement-enchere/${winner.id}`);
  } catch (error) {
    if (isAppError(error)) return errorState(error.message);
    throw error;
  }
}
