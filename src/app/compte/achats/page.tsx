import type { Metadata } from "next";
import Link from "next/link";
import { Package, ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getBuyerOrders } from "@/lib/services/orders";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/config";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes achats" };

export default async function PurchasesPage() {
  const user = await requireUser("/compte/achats");
  const orders = await getBuyerOrders(user.id);
  const active = orders.filter((order) => !["CANCELLED", "REFUNDED", "FINALIZED"].includes(order.status));
  const done = orders.filter((order) => ["CANCELLED", "REFUNDED", "FINALIZED"].includes(order.status));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Achats"
        title="Mes achats"
        description="Suivez vos commandes, payez celles en attente et confirmez la réception. La protection acheteur s'applique tant que la vente n'est pas finalisée."
        action={<ButtonLink href="/catalogue" variant="outline" size="sm">Continuer mes achats</ButtonLink>}
      />

      {active.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">En cours</h2>
          {active.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                  {order.listing.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.listing.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl">🛍️</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                    <span className="text-xs text-muted">{formatDate(order.createdAt)}</span>
                  </div>
                  <Link href={`/commande/${order.orderNumber}`} className="mt-1 block truncate font-semibold hover:text-brand-700">
                    {order.listing.title}
                  </Link>
                  <p className="text-xs text-muted">
                    Vendu par {order.seller.publicName} · {order.orderNumber}
                    {order.shipment ? ` · ${SHIPMENT_STATUS_LABELS[order.shipment.status] ?? order.shipment.status}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatMoney(order.buyerTotalCents)}</p>
                  <ButtonLink href={`/commande/${order.orderNumber}`} size="sm" className="mt-1">
                    {order.status === "PENDING_PAYMENT" ? "Payer" : "Suivre"}
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8" />}
          title="Aucun achat en cours"
          description="Vos commandes actives apparaîtront ici, avec leur suivi de livraison."
          action={<ButtonLink href="/catalogue">Explorer le catalogue</ButtonLink>}
        />
      )}

      {done.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Historique</h2>
          {done.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                    {order.review ? <span className="text-xs text-muted">Avis publié</span> : null}
                  </div>
                  <Link href={`/commande/${order.orderNumber}`} className="mt-1 block truncate text-sm font-semibold hover:text-brand-700">
                    {order.listing.title}
                  </Link>
                  <p className="text-xs text-muted">{order.seller.publicName} · {formatDate(order.finalizedAt ?? order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold">{formatMoney(order.buyerTotalCents)}</p>
                  <ButtonLink href={`/commande/${order.orderNumber}`} variant="outline" size="sm">Détail</ButtonLink>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      <Card>
        <CardBody className="flex items-start gap-2 text-xs leading-5 text-muted">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p>
            Un problème avec une commande ? Ouvrez un litige depuis la page de la commande avant la finalisation. Un paiement
            effectué hors A2V ne peut pas être couvert par la protection acheteur.
          </p>
        </CardBody>
      </Card>

      <Alert tone="info" title="Paiements simulés">
        Si les paiements sont en mode simulation, le bouton de paiement enregistre un règlement fictif clairement identifié. Aucun
        montant réel n&apos;est prélevé.
      </Alert>
    </div>
  );
}
