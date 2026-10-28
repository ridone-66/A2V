import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getAdminStats } from "@/lib/services/admin";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Statistiques" };

export default async function AdminStatsPage() {
  await requirePermission(PERMISSIONS.STATS_READ);

  const [stats, orderStatuses, categories, topSellers, auctionStats, trophies] = await Promise.all([
    getAdminStats(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.category
      .findMany({
        where: { parentId: null },
        orderBy: { position: "asc" },
        select: {
          name: true,
          _count: { select: { listings: { where: { deletedAt: null } } } },
          children: { select: { _count: { select: { listings: { where: { deletedAt: null } } } } } },
        },
      })
      .then((rows) =>
        rows
          .map((row) => ({
            name: row.name,
            count:
              row._count.listings + row.children.reduce((total, child) => total + child._count.listings, 0),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
      ),
    prisma.order.groupBy({
      by: ["sellerId"],
      where: { status: "FINALIZED" },
      _sum: { sellerPayoutCents: true, buyerTotalCents: true },
      _count: { _all: true },
      orderBy: { _sum: { sellerPayoutCents: "desc" } },
      take: 5,
    }),
    prisma.auction.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.userTrophy.count(),
  ]);

  const sellerIds = topSellers.map((seller) => seller.sellerId);
  const sellers = await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, publicName: true } });
  const sellerName = new Map(sellers.map((seller) => [seller.id, seller.publicName]));
  const totalOrders = orderStatuses.reduce((sum, status) => sum + status._count._all, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pilotage"
        title="Statistiques"
        description="Indicateurs calculés à partir des données enregistrées. Aucun chiffre n'est simulé côté navigateur."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Volume finalisé" value={formatMoney(stats.gmvCents)} hint="Commandes FINALIZED" tone="success" />
        <Stat label="Commission acquise" value={formatMoney(stats.commissionCents)} hint="Statut EARNED" tone="success" />
        <Stat label="Dons enregistrés" value={formatMoney(stats.donationsCents)} hint="Flux séparé" />
        <Stat label="Trophées attribués" value={trophies} hint="Après ventes finalisées" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Répartition des commandes" />
          <CardBody>
            {totalOrders === 0 ? (
              <p className="text-sm text-muted">Aucune commande.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {orderStatuses.map((status) => (
                  <li key={status.status}>
                    <div className="flex items-center justify-between gap-2">
                      <span>{ORDER_STATUS_LABELS[status.status] ?? status.status}</span>
                      <span className="text-xs text-muted">
                        {status._count._all} · {Math.round((status._count._all / totalOrders) * 100)} %
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-50">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(status._count._all / totalOrders) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Catégories racines les plus fournies" />
          <CardBody>
            {categories.length ? (
              <ul className="space-y-2 text-sm">
                {categories.map((category) => (
                  <li key={category.name} className="flex items-center justify-between gap-2 border-b border-brand-50 py-1.5 last:border-0">
                    <span>{category.name}</span>
                    <span className="font-semibold">{category.count}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucune catégorie.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Meilleurs vendeurs (ventes finalisées)" description="Classement par versement net cumulé." />
          <CardBody>
            {topSellers.length ? (
              <ul className="space-y-2 text-sm">
                {topSellers.map((seller, index) => (
                  <li key={seller.sellerId} className="flex items-center justify-between gap-2 border-b border-brand-50 py-1.5 last:border-0">
                    <span>
                      <span className="mr-2 text-xs text-muted">#{index + 1}</span>
                      {sellerName.get(seller.sellerId) ?? "Membre supprimé"}
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold">{formatMoney(seller._sum.sellerPayoutCents ?? 0)}</span>
                      <span className="text-[11px] text-muted">{seller._count._all} vente(s)</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucune vente finalisée.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Enchères par statut" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {auctionStats.map((auction) => (
                <li key={auction.status} className="flex items-center justify-between border-b border-brand-50 py-1.5 last:border-0">
                  <span>{auction.status}</span>
                  <span className="font-semibold">{auction._count._all}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
              Une enchère terminée sans réserve atteinte n&apos;est pas une vente. Les trophées ne sont comptés qu&apos;après
              finalisation complète.
            </p>
          </CardBody>
        </Card>
      </div>

      <p className="text-xs leading-5 text-muted">
        Limite assumée : cette page ne fournit ni cohortes, ni rétention, ni attribution marketing. Ces indicateurs nécessiteraient
        un entrepôt de données et une politique de mesure d&apos;audience conforme.
      </p>
    </div>
  );
}
