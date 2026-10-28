import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { env, emailConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/config";

type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type EmailResult = { delivered: boolean; mode: "smtp" | "console"; preview?: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!emailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
  }
  return transporter;
}

export function buildEmailLayout(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#F5F3FF;font-family:Inter,Arial,sans-serif;color:#211A2C">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="display:inline-block;background:#6D28D9;color:#fff;font-weight:800;font-size:22px;padding:10px 16px;border-radius:14px">A2V</span>
    </div>
    <div style="background:#fff;border-radius:20px;padding:32px;border:1px solid #EDE9FE">
      <h1 style="font-size:22px;margin:0 0 16px;color:#211A2C">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#4B5563">${bodyHtml}</div>
      ${
        cta
          ? `<p style="margin:28px 0 0"><a href="${cta.href}" style="display:inline-block;background:#6D28D9;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${cta.label}</a></p>`
          : ""
      }
    </div>
    <p style="font-size:12px;color:#6B7280;text-align:center;margin-top:20px">
      ${APP_NAME} — marketplace communautaire. Cet e-mail est transactionnel.
    </p>
  </div>
</body></html>`;
}

/**
 * Envoi d'e-mail transactionnel.
 * Sans SMTP configuré, le message est journalisé (mode console) : aucun e-mail
 * n'est réellement envoyé. Le mode est explicitement indiqué dans le résultat.
 */
export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const from = env.EMAIL_FROM;
  const html = input.html ?? buildEmailLayout(input.subject, escapeHtml(input.text).replace(/\n/g, "<br/>"));
  const mailer = getTransporter();
  if (!mailer) {
    logger.info("[email:console] E-mail non envoyé (SMTP non configuré)", {
      to: input.to.replace(/(.{2}).+(@.*)/, "$1***$2"),
      subject: input.subject,
    });
    return { delivered: false, mode: "console", preview: `${input.subject} — ${input.text.slice(0, 200)}` };
  }
  try {
    await mailer.sendMail({ from, to: input.to, subject: input.subject, text: input.text, html, replyTo: input.replyTo });
    return { delivered: true, mode: "smtp" };
  } catch (error) {
    logger.error("Échec d'envoi d'e-mail", { error: String(error) });
    return { delivered: false, mode: "smtp" };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
