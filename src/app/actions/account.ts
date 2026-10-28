"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { formBool, formString, formStringOrUndefined } from "@/lib/forms";
import { addressSchema, profileSchema } from "@/lib/validation/schemas";
import {
  changePassword,
  createAddress,
  deleteAccount,
  deleteAddress,
  setDefaultAddress,
  updateProfile,
} from "@/lib/services/users";
import { isAppError } from "@/lib/errors";
import { markAllNotificationsRead, setNotificationPreference } from "@/lib/services/notifications";
import { NOTIFICATION_TYPES } from "@/lib/config";
import { blockUser, unblockUser } from "@/lib/services/messaging";
import { revokeAllSessions } from "@/lib/auth/session";

function message(error: unknown): string {
  return isAppError(error) ? error.message : "Une erreur est survenue.";
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Vous devez être connecté.");

  const parsed = profileSchema.safeParse({
    publicName: formString(formData, "publicName"),
    bio: formString(formData, "bio"),
    city: formString(formData, "city"),
    region: formString(formData, "region"),
    postalCode: formString(formData, "postalCode"),
    publicLocation: formBool(formData, "publicLocation"),
    avatarUrl: formString(formData, "avatarUrl"),
  });
  if (!parsed.success) return errorState("Vérifiez les champs.", zodToFieldErrors(parsed.error));

  try {
    await updateProfile(user.id, parsed.data);
    revalidatePath("/compte/profil");
    revalidatePath("/compte");
    return successState("Profil mis à jour.");
  } catch (error) {
    return errorState(message(error));
  }
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Vous devez être connecté.");
  const currentPassword = formString(formData, "currentPassword");
  const newPassword = formString(formData, "newPassword");
  const confirmPassword = formString(formData, "confirmPassword");
  if (newPassword !== confirmPassword) {
    return errorState("Les mots de passe ne correspondent pas.", { confirmPassword: ["Confirmation différente."] });
  }
  try {
    await changePassword(user.id, currentPassword, newPassword);
    await revokeAllSessions(user.id);
    return successState("Mot de passe modifié. Vos autres sessions ont été déconnectées.");
  } catch (error) {
    return errorState(message(error));
  }
}

export async function addAddressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Vous devez être connecté.");
  const parsed = addressSchema.safeParse({
    label: formString(formData, "label") || "Domicile",
    fullName: formString(formData, "fullName"),
    line1: formString(formData, "line1"),
    line2: formStringOrUndefined(formData, "line2"),
    postalCode: formString(formData, "postalCode"),
    city: formString(formData, "city"),
    country: formString(formData, "country") || "FR",
    phone: formStringOrUndefined(formData, "phone"),
    isDefault: formBool(formData, "isDefault"),
  });
  if (!parsed.success) return errorState("Vérifiez l'adresse.", zodToFieldErrors(parsed.error));
  try {
    await createAddress(user.id, parsed.data);
    revalidatePath("/compte/parametres");
    revalidatePath("/achat", "layout");
    return successState("Adresse ajoutée.");
  } catch (error) {
    return errorState(message(error));
  }
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const addressId = formString(formData, "addressId");
  if (!addressId) return;
  try {
    await deleteAddress(user.id, addressId);
  } catch {
    // L'action est idempotente côté interface : l'erreur est affichée par la page.
  }
  revalidatePath("/compte/parametres");
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const addressId = formString(formData, "addressId");
  if (!addressId) return;
  try {
    await setDefaultAddress(user.id, addressId);
  } catch {
    // ignoré : l'adresse a peut-être été supprimée entre-temps.
  }
  revalidatePath("/compte/parametres");
}

export async function updateNotificationPreferencesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Vous devez être connecté.");
  for (const type of NOTIFICATION_TYPES) {
    const inApp = formBool(formData, `${type}.inApp`);
    const email = formBool(formData, `${type}.email`);
    await setNotificationPreference(user.id, type, { inApp, email });
  }
  revalidatePath("/compte/parametres");
  return successState("Préférences de notification enregistrées.");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await markAllNotificationsRead(user.id);
  revalidatePath("/compte/notifications");
  revalidatePath("/compte");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = formString(formData, "notificationId");
  if (!id) return;
  await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/compte/notifications");
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Vous devez être connecté.");
  const password = formString(formData, "password");
  const confirmation = formString(formData, "confirmation");
  if (confirmation !== "SUPPRIMER") {
    return errorState("Saisissez SUPPRIMER pour confirmer.", { confirmation: ["Texte de confirmation incorrect."] });
  }
  try {
    await deleteAccount(user.id, password);
    redirect("/?compte-supprime=1");
  } catch (error) {
    if (isAppError(error)) return errorState(error.message);
    throw error;
  }
}

export async function blockUserAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const blockedId = formString(formData, "blockedId");
  if (blockedId) {
    try {
      await blockUser(user.id, blockedId);
    } catch {
      // ignoré
    }
  }
  revalidatePath("/compte/messages");
}

export async function unblockUserAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const blockedId = formString(formData, "blockedId");
  if (blockedId) await unblockUser(user.id, blockedId);
  revalidatePath("/compte/parametres");
}
