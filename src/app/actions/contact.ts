"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { sendEmail, buildEmailLayout, escapeHtml } from "@/lib/integrations/email";
import { audit } from "@/lib/services/audit";
import { getSetting } from "@/lib/services/settings";
import { rateLimit } from "@/lib/rate-limit";
import { emailConfigured } from "@/lib/env";
import { formString } from "@/lib/forms";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { contactSchema } from "@/lib/validation/schemas";

export async function contactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    subject: formString(formData, "subject"),
    message: formString(formData, "message"),
  });
  if (!parsed.success) return errorState("Vérifiez votre message.", zodToFieldErrors(parsed.error));

  const limit = rateLimit(`contact:${parsed.data.email}`, 3, 3_600_000);
  if (!limit.allowed) return errorState("Trop de messages envoyés. Réessayez dans une heure.");

  const support = await getSetting("platform.supportEmail");
  const user = await getCurrentUser();
  const result = await sendEmail({
    to: support,
    replyTo: parsed.data.email,
    subject: `[A2V Contact] ${parsed.data.subject}`,
    text: `De : ${parsed.data.name} <${parsed.data.email}>\n\n${parsed.data.message}`,
    html: buildEmailLayout(
      "Nouveau message de contact",
      `<p><strong>${escapeHtml(parsed.data.name)}</strong> &lt;${escapeHtml(parsed.data.email)}&gt;</p><p>${escapeHtml(parsed.data.message).replaceAll("\n", "<br/>")}</p>`,
    ),
  });
  await audit(user?.id ?? null, "CONTACT_MESSAGE", {
    targetType: "Contact",
    metadata: { emailDelivered: result.delivered, emailMode: result.mode },
  });

  return successState(
    result.delivered
      ? "Message envoyé à l'équipe A2V. Une réponse vous sera adressée par e-mail."
      : emailConfigured
        ? "Le message a été pris en compte, mais l'envoi SMTP a échoué. Réessayez ou écrivez directement à l'adresse de support."
        : "Message enregistré, mais aucun e-mail n'est parti : SMTP n'est pas configuré dans cet environnement de démonstration. La boîte de support n'est pas surveillée.",
  );
}
