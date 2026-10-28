import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm } from "@/components/forms/action-form";
import { loginAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/compte");
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/compte";
  const reset = params.reset === "1";

  return (
    <AuthShell
      title="Connexion"
      description="Retrouvez vos achats, vos ventes, vos enchères et vos messages."
      footer={
        <p>
          Pas encore de compte ?{" "}
          <Link href={`/inscription?next=${encodeURIComponent(next)}`} className="link font-medium">Créer un compte gratuitement</Link>
        </p>
      }
    >
      {reset ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Votre mot de passe a été réinitialisé. Connectez-vous avec le nouveau mot de passe.
        </div>
      ) : null}
      <ActionForm action={loginAction} submitLabel="Se connecter" pendingLabel="Connexion…">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="label">Adresse e-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" className="input" required />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">Mot de passe</label>
            <Link href="/mot-de-passe-oublie" className="text-xs font-medium text-brand-700 hover:underline">Mot de passe oublié ?</Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
        </div>
        <p className="text-xs leading-5 text-muted">
          En vous connectant, vous acceptez les <Link href="/cgu" className="link">CGU</Link> et la{" "}
          <Link href="/confidentialite" className="link">politique de confidentialité</Link>.
        </p>
      </ActionForm>
    </AuthShell>
  );
}
