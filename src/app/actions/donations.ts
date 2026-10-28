"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { parseEurosToCents } from "@/lib/money";
import { formBool, formString } from "@/lib/forms";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { donationSchema } from "@/lib/validation/schemas";
import { createDonation } from "@/lib/services/donations";

export async function createDonationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const parsed = donationSchema.safeParse({
    amountEuros: formString(formData, "amountEuros"),
    message: formString(formData, "message"),
    isPublic: formBool(formData, "isPublic"),
    donorDisplayName: formString(formData, "donorDisplayName"),
    acceptTerms: formBool(formData, "acceptTerms"),
  });
  if (!parsed.success) return errorState("Vérifiez le formulaire de don.", zodToFieldErrors(parsed.error));

  const donorEmail = user?.email ?? (formString(formData, "donorEmail") || null);
  if (!user && !donorEmail) {
    return errorState("Indiquez une adresse e-mail pour recevoir le justificatif, ou connectez-vous.", {
      donorEmail: ["Adresse e-mail requise pour un don sans compte."],
    });
  }

  try {
    const donation = await createDonation({
      userId: user?.id ?? null,
      amountCents: parseEurosToCents(parsed.data.amountEuros),
      message: parsed.data.message || null,
      isPublic: user ? parsed.data.isPublic : false,
      donorDisplayName: user ? parsed.data.donorDisplayName || user.publicName : null,
      donorEmail,
    });
    revalidatePath("/dons");
    revalidatePath("/solidarite");
    revalidatePath("/compte/dons");
    return successState(
      `Don enregistré en mode simulation. Justificatif ${donation.receiptNumber}. Aucun prélèvement réel n'a eu lieu.`,
      { receiptNumber: donation.receiptNumber },
    );
  } catch (error) {
    return errorState(isAppError(error) ? error.message : "Le don n'a pas pu être enregistré.");
  }
}
