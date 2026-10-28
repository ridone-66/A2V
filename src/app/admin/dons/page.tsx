import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, Landmark, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAdminDonationOverview } from "@/lib/services/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { adminRecordContributionAction, adminRecordTransferAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Dons & solidarité" };

const DONATION_STATUS: Record<string, string> = {
  PENDING: "En attente",
  SUCCEEDED: "Enregistré",
  FAILED: "Échec",
  REFUNDED: "Remboursé",
};

export default async function AdminDonationsPage() {
  await requirePermission(PERMISSIONS.DONATIONS_MANAGE);
  const overview = await getAdminDonationOverview();
  const available = overview.donationsCents - overview.transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solidarité"
        title="Dons & reversements"
        description="Les dons, les contributions A2V et les reversements sont trois flux distincts. Aucun montant n'est présenté comme reversé sans référence de virement."
        action={<Link href="/solidarite" className="link text-sm font-medium">Voir la page publique</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Dons enregistrés" value={formatMoney(overview.donationsCents)} hint={`${overview.donationsCount} don(s)`} />
        <Stat label="Contributions A2V" value={formatMoney(overview.contributions.reduce((sum, item) => sum + item.amountCents, 0))} hint="Flux séparé, jamais un don" />
        <Stat label="Reversements enregistrés" value={formatMoney(overview.transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0))} tone="success" />
        <Stat label="Solde disponible" value={formatMoney(Math.max(0, available))} hint="Dons − reversements enregistrés" tone={available < 0 ? "danger" : "brand"} />
      </div>

      <Alert tone="warning" title="Ne jamais afficher un montant non transféré comme payé">
        Cette interface ne déclenche aucun virement. Un reversement n&apos;est affiché comme réel qu&apos;après enregistrement de sa
        référence bancaire et de sa date. En mode simulation, les dons eux-mêmes ne sont pas encaissés réellement.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Enregistrer un reversement" description="Référence et date obligatoires, preuve facultative." />
          <CardBody>
            <ActionForm action={adminRecordTransferAction} submitLabel="Enregistrer le reversement" pendingLabel="Enregistrement…">
              <div>
                <label htmlFor="organizationId" className="label">Association</label>
                <select id="organizationId" name="organizationId" className="input" required>
                  {overview.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="amountEuros" className="label">Montant (€)</label>
                  <input id="amountEuros" name="amountEuros" inputMode="decimal" className="input" required />
                </div>
                <div>
                  <label htmlFor="transferredAt" className="label">Date du virement</label>
                  <input id="transferredAt" name="transferredAt" type="date" className="input" required />
                </div>
              </div>
              <div>
                <label htmlFor="reference" className="label">Référence bancaire</label>
                <input id="reference" name="reference" className="input" maxLength={80} required />
              </div>
              <div>
                <label htmlFor="proofUrl" className="label">URL de la preuve (facultatif)</label>
                <input id="proofUrl" name="proofUrl" className="input" placeholder="https://…" />
              </div>
              <div>
                <label htmlFor="notes" className="label">Notes internes (facultatif)</label>
                <textarea id="notes" name="notes" rows={2} className="input" maxLength={1000} />
              </div>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Enregistrer une contribution A2V" description="Décision explicite, jamais un pourcentage automatique." />
          <CardBody>
            <ActionForm action={adminRecordContributionAction} submitLabel="Enregistrer la contribution" pendingLabel="…">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="contribution-amount" className="label">Montant (€)</label>
                  <input id="contribution-amount" name="amountEuros" inputMode="decimal" className="input" required />
                </div>
                <div>
                  <label htmlFor="sourceType" className="label">Source</label>
                  <input id="sourceType" name="sourceType" className="input" defaultValue="A2V" maxLength={60} />
                </div>
              </div>
              <div>
                <label htmlFor="description" className="label">Description</label>
                <input id="description" name="description" className="input" minLength={5} required placeholder="Décision, budget ou campagne concernée" />
              </div>
              <p className="flex items-start gap-2 text-xs text-muted">
                <Landmark className="mt-0.5 h-4 w-4 shrink-0" />
                Aucun taux de contribution de la plateforme n&apos;est affiché publiquement tant qu&apos;il n&apos;est pas décidé et
                documenté.
              </p>
            </ActionForm>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Derniers dons" />
          <CardBody>
            {overview.recent.length ? (
              <ul className="divide-y divide-brand-100 text-sm">
                {overview.recent.map((donation) => (
                  <li key={donation.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">{donation.donor?.publicName ?? donation.donorDisplayName ?? "Don anonyme"}</p>
                      <p className="text-xs text-muted">{formatDate(donation.createdAt)} · {donation.receiptNumber}</p>
                    </div>
                    <Badge tone={donation.status === "SUCCEEDED" ? "success" : "neutral"}>{DONATION_STATUS[donation.status] ?? donation.status}</Badge>
                    <span className="font-semibold">{formatMoney(donation.amountCents)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucun don enregistré.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reversements enregistrés" />
          <CardBody>
            {overview.transfers.length ? (
              <ul className="divide-y divide-brand-100 text-sm">
                {overview.transfers.map((transfer) => (
                  <li key={transfer.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">{transfer.organization.name}</p>
                      <p className="font-mono text-xs text-muted">{transfer.reference} · {formatDate(transfer.transferredAt)}</p>
                    </div>
                    <span className="font-semibold">{formatMoney(transfer.amountCents)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucun reversement enregistré. Le montant public « reversé » reste donc à 0 €.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Associations" description="Les organisations de démonstration sont fictives et ne revendiquent aucun partenariat réel." />
        <CardBody>
          <ul className="space-y-2 text-sm">
            {overview.organizations.map((organization) => (
              <li key={organization.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-100 p-3">
                <div>
                  <p className="font-medium">{organization.name}</p>
                  <p className="text-xs text-muted">{organization.legalStatus ?? "Statut non renseigné"}</p>
                </div>
                <Badge tone={organization.verifiedAt ? "success" : "warning"}>
                  {organization.verifiedAt ? `Vérifiée le ${formatDate(organization.verifiedAt)}` : "Non vérifiée"}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4" /> Une association ne doit être marquée vérifiée qu&apos;après contrôle des pièces.
          </p>
        </CardBody>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted">
        <HeartHandshake className="h-4 w-4" /> Les dons ne donnent aucun avantage commercial, trophée ou réduction.
      </p>
    </div>
  );
}
