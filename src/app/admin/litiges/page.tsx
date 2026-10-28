import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAdminDisputes } from "@/lib/services/admin";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { Alert, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ActionForm } from "@/components/forms/action-form";
import { adminResolveDisputeAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Litiges" };

export default async function AdminDisputesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission(PERMISSIONS.DISPUTES_MANAGE);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminDisputes(page);
  const open = items.filter((dispute) => ["OPEN", "UNDER_REVIEW"].includes(dispute.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions"
        title="Litiges"
        description={`${total} litige(s), ${open} à traiter sur cette page. Un litige ouvert suspend la finalisation et le versement vendeur.`}
      />

      <Alert tone="warning" title="Décision et versement">
        « Libérer les fonds » finalise la vente et enregistre le versement vendeur. En mode simulation, aucun virement bancaire réel
        n&apos;est exécuté. La décision est journalisée dans l&apos;audit.
      </Alert>

      {items.length ? (
        <>
          <div className="space-y-3">
            {items.map((dispute) => (
              <Card key={dispute.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={["OPEN", "UNDER_REVIEW"].includes(dispute.status) ? "warning" : "success"}>{dispute.status}</Badge>
                        <Badge tone="neutral">{dispute.reason}</Badge>
                        <span className="text-xs text-muted">{formatDateTime(dispute.createdAt)}</span>
                      </div>
                      <Link href={`/commande/${dispute.order.orderNumber}`} className="mt-1.5 block font-mono text-sm font-semibold hover:text-brand-700">
                        {dispute.order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted">
                        {dispute.order.buyer.publicName} → {dispute.order.seller.publicName} · {formatMoney(dispute.order.buyerTotalCents)} ·{" "}
                        {ORDER_STATUS_LABELS[dispute.order.status] ?? dispute.order.status}
                      </p>
                      <p className="mt-1 text-xs text-muted">Ouvert par {dispute.openedBy.publicName}</p>
                      <p className="mt-2 rounded-lg bg-brand-50 p-3 text-sm">{dispute.description}</p>
                    </div>
                  </div>

                  {["OPEN", "UNDER_REVIEW"].includes(dispute.status) ? (
                    <ActionForm action={adminResolveDisputeAction} submitLabel="Enregistrer la résolution" pendingLabel="…" className="border-t border-brand-100 pt-3">
                      <input type="hidden" name="disputeId" value={dispute.id} />
                      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                        <div>
                          <label htmlFor={`status-${dispute.id}`} className="label">Issue</label>
                          <select id={`status-${dispute.id}`} name="status" className="input" defaultValue="RESOLVED">
                            <option value="RESOLVED">Litige résolu</option>
                            <option value="REJECTED">Litige rejeté</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`resolution-${dispute.id}`} className="label">Résolution</label>
                          <input id={`resolution-${dispute.id}`} name="resolution" className="input" minLength={10} required placeholder="Décision motivée (10 caractères minimum)" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="releaseFunds" className="h-4 w-4 accent-brand-600" /> Libérer les fonds et finaliser la vente
                      </label>
                    </ActionForm>
                  ) : (
                    <p className="border-t border-brand-100 pt-3 text-xs text-muted">
                      Résolution : {dispute.resolution ?? "—"}
                    </p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} basePath="/admin/litiges" params={{}} />
        </>
      ) : (
        <EmptyState icon={<BadgeEuro className="h-8 w-8" />} title="Aucun litige" description="Les litiges ouverts par les acheteurs ou vendeurs apparaîtront ici." />
      )}
    </div>
  );
}
