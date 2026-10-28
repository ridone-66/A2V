import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm } from "@/components/forms/action-form";
import { registerAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/compte");
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/compte";

  return (
    <AuthShell
      title="Créer un compte gratuit"
      description="Publiez gratuitement, achetez avec protection et participez aux enchères. Aucun abonnement obligatoire."
      footer={
        <p>
          Vous avez déjà un compte ?{" "}
          <Link href={`/connexion?next=${encodeURIComponent(next)}`} className="link font-medium">Se connecter</Link>
        </p>
      }
    >
      <ActionForm action={registerAction} submitLabel="Créer mon compte" pendingLabel="Création…">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="publicName" className="label">Nom public</label>
          <input id="publicName" name="publicName" className="input" autoComplete="username" minLength={3} maxLength={30} required />
          <p className="mt-1 text-xs text-muted">3 à 30 caractères : lettres, chiffres, points, tirets, underscores.</p>
        </div>
        <div>
          <label htmlFor="email" className="label">Adresse e-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" className="input" required />
        </div>
        <div>
          <label htmlFor="password" className="label">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="new-password" className="input" minLength={10} required />
          <p className="mt-1 text-xs text-muted">Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.</p>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="label">Confirmer le mot de passe</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className="input" required />
        </div>
        <div className="space-y-2.5">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 accent-brand-600" />
            <span>
              J&apos;accepte les <Link href="/cgu" className="link" target="_blank">CGU</Link>, les{" "}
              <Link href="/cgu#vente" className="link" target="_blank">conditions de vente</Link> et la{" "}
              <Link href="/confidentialite" className="link" target="_blank">politique de confidentialité</Link>.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" name="marketingOptIn" className="mt-0.5 h-4 w-4 accent-brand-600" />
            Recevoir les sélections et nouveautés par e-mail (facultatif, désactivable à tout moment).
          </label>
        </div>
        <p className="rounded-lg bg-brand-50 p-3 text-xs leading-5 text-muted">
          La vérification d&apos;e-mail n&apos;est pas encore automatisée dans cette version : le compte est utilisable immédiatement.
          Cette limite est documentée.
        </p>
      </ActionForm>
    </AuthShell>
  );
}
