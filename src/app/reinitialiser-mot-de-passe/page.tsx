import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm } from "@/components/forms/action-form";
import { resetPasswordAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Choisir un nouveau mot de passe" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AuthShell
      title="Nouveau mot de passe"
      description="Choisissez un mot de passe différent de l'ancien. Toutes vos sessions seront déconnectées après la réinitialisation."
      footer={
        <p>
          <Link href="/connexion" className="link font-medium">Retour à la connexion</Link>
        </p>
      }
    >
      {token ? (
        <ActionForm action={resetPasswordAction} submitLabel="Enregistrer le nouveau mot de passe" pendingLabel="Enregistrement…">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="password" className="label">Nouveau mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="new-password" className="input" minLength={10} required />
            <p className="mt-1 text-xs text-muted">10 caractères minimum, avec majuscule, minuscule et chiffre.</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label">Confirmer</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className="input" required />
          </div>
        </ActionForm>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Lien incomplet ou invalide. Demandez un{" "}
          <Link href="/mot-de-passe-oublie" className="font-semibold underline">nouveau lien de réinitialisation</Link>.
        </div>
      )}
    </AuthShell>
  );
}
