import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm } from "@/components/forms/action-form";
import { forgotPasswordAction } from "@/app/actions/auth";
import { emailConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Indiquez votre adresse e-mail. Si un compte correspond, un lien de réinitialisation valable une heure sera envoyé."
      footer={
        <p>
          <Link href="/connexion" className="link font-medium">Retour à la connexion</Link>
        </p>
      }
    >
      <ActionForm action={forgotPasswordAction} submitLabel="Envoyer le lien" pendingLabel="Envoi…">
        <div>
          <label htmlFor="email" className="label">Adresse e-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" className="input" required />
        </div>
        <p className="rounded-lg bg-brand-50 p-3 text-xs leading-5 text-muted">
          {emailConfigured
            ? "Le lien est envoyé par e-mail. Vérifiez aussi les indésirables."
            : "SMTP n'est pas configuré dans cet environnement : le lien est écrit dans les journaux du serveur, aucun e-mail réel n'est envoyé."}
        </p>
      </ActionForm>
    </AuthShell>
  );
}
