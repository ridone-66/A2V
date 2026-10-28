import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, Info, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicDonations } from "@/lib/services/donations";
import { getSetting } from "@/lib/services/settings";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { paymentsSimulationEnabled } from "@/lib/env";
import { Alert, Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { createDonationAction } from "@/app/actions/donations";

export const metadata: Metadata = {
  title: "Faire un don",
  description:
    "Soutenez la démarche solidaire A2V. Les dons sont séparés des ventes, des commissions et des abonnements. Aucun reçu fiscal n'est délivré dans cette démonstration.",
};

export default async function DonatePage() {
  const user = await getCurrentUser();
  const [suggested, donations, minCents, maxCents] = await Promise.all([
    getSetting("donation.suggestedCents"),
    getPublicDonations(6),
    getSetting("donation.minCents"),
    getSetting("donation.maxCents"),
  ]);

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Solidarité", href: "/solidarite" }, { label: "Faire un don" }]} />
      <PageHeader
        eyebrow="Don"
        title="Un don, clairement séparé de vos achats"
        description="Ce don ne modifie ni le prix de vos achats, ni la commission, ni votre abonnement. Il est enregistré sur une ligne dédiée à l'espace solidarité."
        action={<Link href="/solidarite" className="text-sm font-medium text-brand-700 hover:underline">Voir la transparence des dons</Link>}
      />

      {paymentsSimulationEnabled ? (
        <Alert tone="warning" title="Démonstration — aucun paiement réel" className="mb-5">
          Le don est enregistré en simulation avec un justificatif interne. Aucun prélèvement bancaire n&apos;a lieu. Aucun reçu
          fiscal n&apos;est délivré et aucun avantage fiscal n&apos;est promis.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <HeartHandshake className="h-5 w-5 text-rose-600" /> Votre don
          </h2>
          <p className="mt-1 text-sm text-muted">
            Montant entre {formatMoney(minCents)} et {formatMoney(maxCents)}. Les dons publics affichent votre nom d&apos;affichage
            uniquement si vous le choisissez.
          </p>

          <ActionForm action={createDonationAction} submitLabel="Enregistrer mon don" pendingLabel="Enregistrement…" className="mt-5" resetOnSuccess>
            <div>
              <label htmlFor="amountEuros" className="label">Montant (€)</label>
              <input id="amountEuros" name="amountEuros" type="text" inputMode="decimal" className="input text-lg font-semibold" defaultValue="25,00" />
              <p className="mt-1 text-xs text-muted">
                Montants suggérés : {suggested.map((cents) => formatMoney(cents)).join(" · ")}
              </p>
            </div>

            {!user ? (
              <div>
                <label htmlFor="donorEmail" className="label">Votre e-mail</label>
                <input id="donorEmail" name="donorEmail" type="email" className="input" placeholder="vous@exemple.fr" />
                <p className="mt-1 text-xs text-muted">Pour recevoir le justificatif interne. Aucune création de compte automatique.</p>
              </div>
            ) : (
              <p className="rounded-xl bg-brand-50 p-3 text-xs text-muted">
                Don effectué depuis le compte <strong className="text-ink">{user.publicName}</strong>. Votre adresse e-mail de compte
                reçoit le justificatif interne.
              </p>
            )}

            <div>
              <label htmlFor="donorDisplayName" className="label">Nom affiché (facultatif)</label>
              <input
                id="donorDisplayName"
                name="donorDisplayName"
                className="input"
                maxLength={40}
                defaultValue={user?.publicName ?? ""}
                placeholder="Anonyme"
              />
            </div>

            <div>
              <label htmlFor="message" className="label">Message (facultatif)</label>
              <textarea id="message" name="message" rows={3} className="input" maxLength={500} placeholder="Un mot d'encouragement…" />
            </div>

            <label className="flex items-start gap-3 text-sm text-ink">
              <input type="checkbox" name="isPublic" className="mt-0.5 h-4 w-4 accent-brand-600" disabled={!user} />
              <span>
                Afficher mon don et mon message publiquement
                <span className="block text-xs text-muted">Le montant peut être affiché. Vous pouvez rester anonyme en laissant le nom vide.</span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-ink">
              <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>
                Je comprends que ce don est volontaire, non remboursable et qu&apos;aucun reçu fiscal n&apos;est délivré dans cette
                démonstration. J&apos;accepte les <Link href="/cgu" className="link" target="_blank">conditions</Link>.
              </span>
            </label>
          </ActionForm>

          <p className="mt-4 text-xs leading-5 text-muted">
            Un don ne donne droit à aucun avantage commercial, trophée ou réduction. Il ne réduit pas la commission de vente.
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5 text-brand-600" /> Où va votre don ?
            </h2>
            <ul className="mt-3 space-y-3 text-sm text-muted">
              <li>
                <strong className="text-ink">Comptabilité séparée.</strong> Les dons sont suivis dans un espace distinct des ventes, des
                commissions et des abonnements.
              </li>
              <li>
                <strong className="text-ink">Aucun pourcentage inventé.</strong> A2V n&apos;affiche pas de contribution propre tant
                qu&apos;une politique n&apos;a pas été décidée et publiée.
              </li>
              <li>
                <strong className="text-ink">Versements traçables.</strong> Un montant n&apos;est présenté comme reversé qu&apos;après
                enregistrement d&apos;un virement avec référence.
              </li>
              <li>
                <strong className="text-ink">Organisme de démonstration.</strong> L&apos;organisme affiché est fictif. En production,
                seuls des organismes vérifiés peuvent être bénéficiaires.
              </li>
            </ul>
            <Link href="/solidarite" className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:underline">
              Consulter les montants collectés et reversés
            </Link>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Dons publics récents</h2>
            {donations.length ? (
              <ul className="mt-3 space-y-2.5">
                {donations.map((donation) => (
                  <li key={donation.id} className="rounded-xl bg-brand-50/70 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{donation.donorDisplayName || "Anonyme"}</span>
                      <span className="font-semibold">{formatMoney(donation.amountCents)}</span>
                    </div>
                    {donation.message ? <p className="mt-1 text-xs text-muted">{donation.message}</p> : null}
                    <p className="mt-1 text-[11px] text-muted">{donation.paidAt ? formatDate(donation.paidAt) : ""}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Aucun don public pour l&apos;instant.</p>
            )}
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-white p-4 text-xs leading-5 text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <p>
              {user ? (
                <>
                  Retrouvez vos justificatifs dans <Link href="/compte/dons" className="link">Mes dons</Link>.
                </>
              ) : (
                <>
                  Vous pouvez aussi <Link href="/connexion" className="link">vous connecter</Link> pour conserver l&apos;historique de vos
                  dons.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
