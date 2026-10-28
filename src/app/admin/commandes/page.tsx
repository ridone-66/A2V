import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAdminOrders } from "@/lib/services/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ActionForm } from "@/components/forms/action-form";
import { adminCancelOrderAction, adminRefundOrderAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Commandes" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.ORDERS_MANAGE);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminOrders({ q: params.q, status: params.status }, page);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions"
        title="Commandes"
        description={`${total} commande(s). L'annulation et le remboursement sont des actions sensibles, journalisées.`}
      />

      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3" role="search">
            <div className="min-w-0 flex-1">
              <label htmlFor="q" className="label">Rechercher</label>
              <input id="q" name="q" className="input" defaultValue={params.q ?? ""} placeholder="N° de commande ou membre" />
            </div>
            <div>
              <label htmlFor="status" className="label">Statut</label>
              <select id="status" name="status" className="input" defaultValue={params.status ?? "ALL"}>
                <option value="ALL">Tous</option>
                {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
              <Search className="h-4 w-4" /> Filtrer
            </button>
          </form>
        </CardBody>
      </Card>

      {items.length ? (
        <>
          <div className="space-y-3">
            {items.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                      <Badge tone={order.payments.some((payment) => payment.provider === "SIMULATED") ? "warning" : "neutral"}>
                        {order.payments[0]?.provider ?? "Aucun paiement"}
                      </Badge>
                      {order.buyerTotalCents !== order.itemPriceCents + order.shippingCents - order.discountCents ? (
                        <Badge tone="danger">Écart de calcul</Badge>
                      ) : null}
                    </div>
                    <Link href={`/commande/${order.orderNumber}`} className="mt-1.5 block font-mono text-sm font-semibold hover:text-brand-700">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">
                      {order.buyer.publicName} → {order.seller.publicName} · {formatDate(order.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Article {formatMoney(order.itemPriceCents)} · livraison {formatMoney(order.shippingCents)}
                      {order.discountCents ? ` · réduction −${formatMoney(order.discountCents)}` : ""} · commission{" "}
                      {formatMoney(order.commissionCents)} · versement {formatMoney(order.sellerPayoutCents)}
                    </p>
                  </div>
                  <p className="text-lg font-bold">{formatMoney(order.buyerTotalCents)}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-start gap-3 border-t border-brand-100 pt-3">
                  {["PENDING_PAYMENT", "PAID", "PREPARING"].includes(order.status) ? (
                    <ActionForm action={adminCancelOrderAction} submitLabel="Annuler la commande" pendingLabel="…">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="reason" value="Annulation administrative" />
                    </ActionForm>
                  ) : null}
                  {order.payments.some((payment) => ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)) ? (
                    <ActionForm action={adminRefundOrderAction} submitLabel="Enregistrer un remboursement" pendingLabel="…">
                      <input type="hidden" name="orderId" value={order.id} />
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label htmlFor={`amount-${order.id}`} className="label text-xs">Montant (€)</label>
                          <input
                            id={`amount-${order.id}`}
                            name="amountEuros"
                            inputMode="decimal"
                            className="input h-10 w-32"
                            defaultValue={(order.buyerTotalCents / 100).toFixed(2)}
                          />
                        </div>
                        <input name="reason" className="input h-10 w-48" placeholder="Motif" defaultValue="Remboursement administratif" />
                      </div>
                    </ActionForm>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} basePath="/admin/commandes" params={{ q: params.q, status: params.status }} />
        </>
      ) : (
        <EmptyState title="Aucune commande" description="Aucun résultat pour ces filtres." />
      )}
    </div>
  );
}
