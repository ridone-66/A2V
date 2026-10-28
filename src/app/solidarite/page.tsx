import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HeartHandshake, Info, Landmark, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCharityStats, getCharityTransfers, getPublicDonations } from "@/lib/services/donations";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Alert, Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Solidarité — dons séparés des ventes",
  description:
    "L'espace solidarité A2V est séparé des ventes, commissions et abonnements. Les montants collectés, les contributions et les sommes réellement reversées sont affichés distinctement.",
};

export default async function SolidarityPage() {
  const [stats, transfers, donations, organizations] = await Promise.all([
    getCharityStats(),
    getCharityTransfers(),
    getPublicDonations(9),
    prisma.charityOrganization.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Solidarité" }]} />
      <PageHeader
        eyebrow="Solidarité"
        title="Un espace de dons séparé, sans confusion avec les ventes"
        description="Les dons ne financent ni les commissions, ni les abonnements, ni les récompenses. Aucun pourcentage de contribution d'A2V n'est affiché tant qu'il n'est pas formellement décidé et publié."
        action={<ButtonLink href="/dons" size="sm">Faire un don <ArrowRight className="h-4 w-4" /></ButtonLink>}
      />

      <Alert tone="warning" className="mb-6">
        <span className="inline-flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Cet environnement est une démonstration : les dons enregistrés sont simulés, aucun paiement réel n&apos;est encaissé et
            aucun reçu fiscal n&apos;est délivré. L&apos;organisme affiché est fictif et ne constitue pas un partenariat réel.
          </span>
        </span>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted">Dons confirmés</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(stats.donationsCents)}</p>
          <p className="mt-1 text-xs text-muted">{stats.donationsCount} don{stats.donationsCount > 1 ? "s" : ""} enregistré{stats.donationsCount > 1 ? "s" : ""}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Contributions A2V enregistrées</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(stats.contributionsCents)}</p>
          <p className="mt-1 text-xs text-muted">Ligne distincte, jamais mélangée aux dons.</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Réellement reversé</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(stats.transfersCents)}</p>
          <p className="mt-1 text-xs text-muted">Uniquement des virements enregistrés avec référence.</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Solde disponible</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(stats.availableCents)}</p>
          <p className="mt-1 text-xs text-muted">Non transféré à ce jour.</p>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Landmark className="h-5 w-5 text-brand-600" /> Organismes destinataires
          </h2>
          <div className="mt-4 space-y-4">
            {organizations.map((organization) => (
              <div key={organization.id} className="rounded-xl border border-brand-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{organization.name}</p>
                  <span className="text-xs text-muted">{organization.legalStatus ?? "Statut non précisé"}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{organization.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {organization.verifiedAt ? `Vérification interne enregistrée le ${formatDate(organization.verifiedAt)}.` : "Organisme non vérifié : aucun versement n'est autorisé."}
                  {organization.website ? ` · ${organization.website}` : ""}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            Aucun partenariat avec une association réelle n&apos;est revendiqué dans cette démonstration. En production, chaque
            organisme doit être vérifié juridiquement avant d&apos;être affiché comme bénéficiaire.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <HeartHandshake className="h-5 w-5 text-brand-600" /> Dons publics récents
          </h2>
          {donations.length ? (
            <ul className="mt-4 space-y-3">
              {donations.map((donation) => (
                <li key={donation.id} className="rounded-xl bg-brand-50/70 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{donation.donorDisplayName}</span>
                    <span className="font-semibold">{formatMoney(donation.amountCents)}</span>
                  </div>
                  {donation.message ? <p className="mt-1 text-xs text-muted">{donation.message}</p> : null}
                  <p className="mt-1 text-[11px] text-muted">{donation.paidAt ? formatDate(donation.paidAt) : "Date non disponible"}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Aucun don public pour le moment. Les dons anonymes ne sont jamais affichés.</p>
          )}
          <ButtonLink href="/dons" variant="secondary" size="sm" className="mt-4">Soutenir la démarche</ButtonLink>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Versements réellement effectués</h2>
        {transfers.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-100 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Organisme</th>
                  <th className="py-2 pr-4">Montant</th>
                  <th className="py-2">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="py-3 pr-4">{formatDate(transfer.transferredAt)}</td>
                    <td className="py-3 pr-4">{transfer.organization.name}</td>
                    <td className="py-3 pr-4 font-semibold">{formatMoney(transfer.amountCents)}</td>
                    <td className="py-3 font-mono text-xs">{transfer.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Alert tone="info" className="mt-4">
            Aucun virement n&apos;est enregistré à ce jour. Le montant « réellement reversé » reste donc à 0 € : les dons confirmés ne
            sont jamais présentés comme déjà transférés.
          </Alert>
        )}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Séparation stricte", text: "Aucun don n'est utilisé pour payer une commission, un abonnement ou un trophée." },
          { icon: Info, title: "Aucun taux inventé", text: "A2V n'affiche pas de pourcentage de contribution tant qu'il n'est pas décidé et publié." },
          { icon: Landmark, title: "Preuve de versement", text: "Un montant n'est affiché comme reversé qu'après enregistrement d'un virement avec référence." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="p-5">
              <Icon className="h-5 w-5 text-brand-600" />
              <p className="mt-2 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{item.text}</p>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted">
        En savoir plus : <Link href="/dons" className="link">faire un don</Link> ·{" "}
        <Link href="/confidentialite" className="link">données personnelles</Link> ·{" "}
        <Link href="/cgu" className="link">conditions d&apos;utilisation</Link>.
      </p>
    </div>
  );
}
