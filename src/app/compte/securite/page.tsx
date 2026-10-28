import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogOut, MailWarning, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { changePasswordAction } from "@/app/actions/account";
import { logoutAction, resendVerificationAction, revokeOtherSessionsAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Sécurité" };

export default async function SecurityPage() {
  const user = await requireUser("/compte/securite");
  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true, userAgent: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compte"
        title="Sécurité"
        description="Mot de passe, sessions actives et vérification de l'adresse e-mail."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Changer mon mot de passe" description="Le changement déconnecte vos autres sessions." />
          <CardBody>
            <ActionForm action={changePasswordAction} submitLabel="Modifier le mot de passe" pendingLabel="Modification…">
              <div>
                <label htmlFor="currentPassword" className="label">Mot de passe actuel</label>
                <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
              </div>
              <div>
                <label htmlFor="newPassword" className="label">Nouveau mot de passe</label>
                <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" minLength={10} required />
                <p className="mt-1 text-xs text-muted">Au moins 10 caractères, une majuscule, une minuscule et un chiffre.</p>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="label">Confirmer le nouveau mot de passe</label>
                <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" minLength={10} required />
              </div>
            </ActionForm>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Sessions actives" description={`${sessions.length} session(s) valide(s).`} />
            <CardBody className="space-y-3">
              <ul className="space-y-2 text-xs">
                {sessions.map((session) => (
                  <li key={session.id} className="rounded-lg border border-brand-100 p-3">
                    <p className="font-semibold text-ink">Connectée le {formatDateTime(session.createdAt)}</p>
                    <p className="mt-0.5 text-muted">Expire le {formatDateTime(session.expiresAt)}</p>
                    {session.userAgent ? <p className="mt-1 line-clamp-2 break-all text-[11px] text-muted">{session.userAgent}</p> : null}
                  </li>
                ))}
              </ul>
              <ActionForm action={revokeOtherSessionsAction} submitLabel="Déconnecter toutes mes sessions" pendingLabel="Déconnexion…">
                <p className="text-xs text-muted">
                  Cette action révoque toutes les sessions, y compris celle utilisée actuellement. Vous devrez vous reconnecter.
                </p>
              </ActionForm>
              <form action={logoutAction}>
                <SubmitButton variant="outline" size="sm" pendingLabel="Déconnexion…">
                  <LogOut className="h-4 w-4" /> Me déconnecter
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Adresse e-mail" />
            <CardBody className="space-y-2 text-sm">
              <p className="font-medium">{user.email}</p>
              <p className="text-xs text-muted">
                {user.emailVerifiedAt
                  ? `Vérifiée le ${formatDateTime(user.emailVerifiedAt)}.`
                  : "Adresse non vérifiée. La vérification par e-mail n'est pas active dans cette démonstration."}
              </p>
              {!user.emailVerifiedAt ? (
                <ActionForm action={resendVerificationAction} submitLabel="Demander la vérification" pendingLabel="…">
                  <p className="text-xs text-muted">
                    Aucun e-mail réel ne sera envoyé tant que SMTP et le modèle de jeton ne sont pas configurés. Cette limite est
                    assumée et documentée.
                  </p>
                </ActionForm>
              ) : null}
              <Alert tone="info" className="mt-2">
                <span className="inline-flex items-start gap-2 text-xs">
                  <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
                  Le changement d&apos;adresse e-mail n&apos;est pas implémenté : il nécessite une vérification par lien signé.
                </span>
              </Alert>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-start gap-3 text-xs leading-5 text-muted">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="font-semibold text-ink">Bonnes pratiques</p>
            <p className="mt-1">
              Utilisez un mot de passe unique, ne le réutilisez pas sur d&apos;autres sites et ne le communiquez jamais par
              message. A2V ne demande jamais votre mot de passe ni un code de carte.
            </p>
            <p className="mt-2">
              Voir la <Link href="/confidentialite" className="link">politique de confidentialité</Link> pour la conservation des
              sessions et des journaux de sécurité.
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/compte/confidentialite" variant="outline">
          <KeyRound className="h-4 w-4" /> Mes données personnelles
        </ButtonLink>
        <ButtonLink href="/contact" variant="outline">Signaler un problème de sécurité</ButtonLink>
      </div>
    </div>
  );
}
