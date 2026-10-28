import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDonationHistory, getCharityStats } from "@/lib/services/donations";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, EmptyState, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes dons" };

const DONATION_STATUS: Record<string, string> = {
  PENDING: "En attente",
  SUCCEEDED: "Enregistré",
  FAILED: "Échec",
  REFUNDED: "Remboursé",
};

export default async function AccountDonationsPage() {
  const user = await requireUser("/compte/dons");
  const [donations, stats] = await Promise.all([getDonationHistory(user.id), getCharityStats()]);
  const total = donations.filter((donation) => donation.status === "SUCCEEDED").reduce((sum, donation) => sum + donation.amountCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Solidarité"
        title="Mes dons"
        description="Les dons sont volontaires, sans contrepartie, et suivis séparément des ventes, commissions et abonnements."
        action={<ButtonLink href="/dons" size="sm">Faire un don</ButtonLink>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Mes dons enregistrés" value={formatMoney(total)} hint={`${donations.filter((d) => d.status === "SUCCEEDED").length} don(s)`} />
        <Stat label="Dons collectés (tous)" value={formatMoney(stats.donationsCents)} hint="Tous donateurs confondus" />
        <Stat label="Reversé aux associations" value={formatMoney(stats.transfersCents)} hint="Uniquement virements enregistrés" tone="success" />
      </div>

      <Alert tone="info" title="Aucun reçu fiscal, aucun avantage commercial">
        Cette démonstration ne délivre pas de reçu fiscal et ne promet aucune déduction d&apos;impôt. Un don ne donne droit à
        aucun trophée, réduction ou priorité d&apos;achat. Le montant « reversé » n&apos;affiche que des virements réellement
        enregistrés avec une référence.
      </Alert>

      {donations.length ? (
        <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Historique de mes dons</caption>
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">Reçu</th>
                <th scope="col" className="px-4 py-3">Statut</th>
                <th scope="col" className="px-4 py-3">Visibilité</th>
                <th scope="col" className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {donations.map((donation) => (
                <tr key={donation.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDate(donation.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{donation.receiptNumber}</td>
                  <td className="px-4 py-3">
                    <Badge tone={donation.status === "SUCCEEDED" ? "success" : donation.status === "FAILED" ? "danger" : "neutral"}>
                      {DONATION_STATUS[donation.status] ?? donation.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{donation.isPublic ? "Nom public affiché" : "Privé"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatMoney(donation.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<HeartHandshake className="h-8 w-8" />}
          title="Vous n'avez pas encore fait de don"
          description="Les dons sont facultatifs et indépendants de vos achats. Aucun pourcentage de contribution de la plateforme n'est affiché sans décision publiée."
          action={<ButtonLink href="/dons">Découvrir les dons</ButtonLink>}
        />
      )}

      <Card>
        <CardBody className="space-y-2 text-xs leading-5 text-muted">
          <p className="font-semibold text-ink">Transparence</p>
          <p>
            Les dons sont enregistrés dans un espace comptable distinct. Un don « enregistré » en mode simulation ne correspond
            pas à un encaissement bancaire réel. Consultez la <Link href="/solidarite" className="link">page solidarité</Link> pour
            l&apos;état des reversements.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
