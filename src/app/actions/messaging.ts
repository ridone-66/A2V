"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formString } from "@/lib/forms";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { messageSchema } from "@/lib/validation/schemas";
import {
  getOrCreateConversation,
  markConversationRead,
  reportMessage,
  sendMessage,
} from "@/lib/services/messaging";

function message(error: unknown): string {
  return isAppError(error) ? error.message : "Une erreur est survenue. Réessayez.";
}

export async function startConversationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) {
    const listingId = formString(formData, "listingId");
    redirect(`/connexion?next=${encodeURIComponent(listingId ? `/annonce/${formString(formData, "slug")}` : "/compte/messages")}`);
  }
  const parsed = messageSchema.safeParse({
    listingId: formString(formData, "listingId") || undefined,
    orderId: formString(formData, "orderId") || undefined,
    recipientId: formString(formData, "recipientId") || undefined,
    subject: formString(formData, "subject") || undefined,
    body: formString(formData, "body"),
  });
  if (!parsed.success) return errorState("Message invalide.", zodToFieldErrors(parsed.error));

  try {
    const conversation = await getOrCreateConversation({
      userId: user.id,
      listingId: parsed.data.listingId,
      recipientId: parsed.data.recipientId,
      subject: parsed.data.subject,
    });
    await sendMessage({ userId: user.id, conversationId: conversation.id, body: parsed.data.body });
    revalidatePath("/compte/messages");
    redirect(`/compte/messages/${conversation.id}`);
  } catch (error) {
    if (isAppError(error)) return errorState(error.message);
    throw error;
  }
}

export async function sendOrderMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour envoyer un message.");
  const orderId = formString(formData, "orderId");
  const body = formString(formData, "body");
  if (!orderId || !body) return errorState("Message vide.");
  try {
    const conversation = await getOrCreateConversation({ userId: user.id, orderId });
    await sendMessage({ userId: user.id, conversationId: conversation.id, body });
    revalidatePath("/compte/messages");
    redirect(`/compte/messages/${conversation.id}`);
  } catch (error) {
    if (isAppError(error)) return errorState(error.message);
    throw error;
  }
}

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour envoyer un message.");
  const conversationId = formString(formData, "conversationId");
  const body = formString(formData, "body");
  if (!conversationId) return errorState("Conversation introuvable.");
  if (!body) return errorState("Le message est vide.", { body: ["Écrivez un message."] });

  try {
    await sendMessage({ userId: user.id, conversationId, body });
    revalidatePath(`/compte/messages/${conversationId}`);
    revalidatePath("/compte/messages");
    return successState("Message envoyé.");
  } catch (error) {
    return errorState(message(error));
  }
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await markConversationRead(conversationId, user.id).catch(() => undefined);
}

export async function reportMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour signaler un message.");
  const messageId = formString(formData, "messageId");
  const reason = formString(formData, "reason");
  const details = formString(formData, "details");
  if (!messageId || !reason) return errorState("Signalement incomplet.");
  try {
    await reportMessage({ messageId, reporterId: user.id, reason, details });
    return successState("Message signalé à la modération.");
  } catch (error) {
    return errorState(message(error));
  }
}
