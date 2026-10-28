import type { Metadata } from "next";
import Link from "next/link";
import { Info, Package, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSellerOrders } from "@/lib/services/orders";
import { getSellerStats } from "@/lib/services/users";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, EmptyState, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes ventes" };

export default async function SalesPage() {
  const user = await requireUser("/compte/ventes");
  const [orders, stats] = await Promise.all([getSellerOrders(user.id), getSellerStats(user.id)]);
  const toShip = orders.filter((order) => ["PAID", "PREPARING"].includes(order.status));
  const others = orders.filter((order) => !["PAID", "PREPARING"].includes(order.status));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventes"
        title="Mes ventes"
        description="Expédiez les commandes payées et suivez vos versements. La commission de 0,5 % est retenue uniquement sur une vente finalisée."
        action={<ButtonLink href="/compte/annonces/nouvelle" size="sm">Nouvelle annonce</ButtonLink>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventes finalisées" value={stats.finalized} />
        <Stat label="Versements finalisés" value={formatMoney(stats.revenueCents)} hint="Net de commission, hors livraison" />
        <Stat label="Commission A2V" value={formatMoney(stats.commissionCents)} hint="0,5 % du prix de l'article" />
        <Stat label="En attente de finalisation" value={formatMoney(stats.pendingCents)} hint="Commandes actives" />
      </div>

      <Alert tone="info">
        Les montants « versements dus » sont comptables. En mode simulation, aucun virement bancaire n&apos;est effectué. En
        production, un compte Stripe Connect doit être configuré pour recevoir les fonds.
      </Alert>

      {toShip.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Truck className="h-5 w-5 text-brand-600" /> À expédier</h2>
          {toShip.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                  <Link href={`/commande/${order.orderNumber}`} className="mt-1 block truncate font-semibold hover:text-brand-700">
                    {order.listing.title}
                  </Link>
                  <p className="text-xs text-muted">Acheteur : {order.buyer.publicName} · {order.orderNumber} · {formatDate(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{formatMoney(order.sellerPayoutCents)}</p>
                  <ButtonLink href={`/commande/${order.orderNumber}`} size="sm">Expédier</ButtonLink>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {others.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Toutes mes ventes</h2>
          <div className="space-y-2">
            {others.map((order) => (
              <Card key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                    <span className="text-xs text-muted">{formatDate(order.createdAt)}</span>
                  </div>
                  <Link href={`/commande/${order.orderNumber}`} className="mt-1 block truncate text-sm font-semibold hover:text-brand-700">
                    {order.listing.title}
                  </Link>
                  <p className="text-xs text-muted">{order.buyer.publicName} · {order.orderNumber}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <p className="font-semibold text-ink">{formatMoney(order.sellerPayoutCents)}</p>
                    <p className="text-muted">commission {formatMoney(order.commissionCents)}</p>
                  </div>
                  <ButtonLink href={`/commande/${order.orderNumber}`} variant="outline" size="sm">Détail</ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="Aucune vente pour l'instant"
          description="Publiez une annonce à prix fixe ou aux enchères. La mise en ligne est gratuite."
          action={<ButtonLink href="/compte/annonces/nouvelle">Publier une annonce</ButtonLink>}
        />
      ) : null}

      <Card>
        <CardBody className="text-xs leading-5 text-muted">
          <p className="flex items-center gap-2 font-semibold text-ink"><Info className="h-4 w-4 text-brand-600" /> Calcul du versement</p>
          <p className="mt-2">
            Versement = prix final de l&apos;article − commission de 0,5 %. Les frais de livraison sont payés par l&apos;acheteur et
            ne sont pas commissionnés. Une réduction trophée est financée par A2V et ne réduit pas le versement vendeur.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
