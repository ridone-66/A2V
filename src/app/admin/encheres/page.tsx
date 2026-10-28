import type { Metadata } from "next";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { adminCloseAuctionAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Enchères" };

const AUCTION_STATUS_TONE: Record<string, "brand" | "success" | "warning" | "neutral" | "danger"> = {
  DRAFT: "neutral",
  SCHEDULED: "brand",
  LIVE: "success",
  ENDED: "neutral",
  CANCELLED: "danger",
};

export default async function AdminAuctionsPage() {
  await requirePermission(PERMISSIONS.AUCTIONS_MANAGE);
  const auctions = await prisma.auction.findMany({
    orderBy: [{ status: "asc" }, { endsAt: "desc" }],
    take: 100,
    include: {
      listing: { select: { title: true, slug: true, seller: { select: { publicName: true } } } },
      winnerRecord: { select: { status: true, orderId: true } },
      _count: { select: { bids: true } },
      bids: { orderBy: { amountCents: "desc" }, take: 1, select: { amountCents: true } },
    },
  });

  const live = auctions.filter((auction) => auction.status === "LIVE");
  const others = auctions.filter((auction) => auction.status !== "LIVE");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions"
        title="Enchères"
        description="Les clôtures sont normalement exécutées par la tâche planifiée, à l'heure du serveur. Une clôture forcée est journalisée."
      />

      <Alert tone="warning" title="Heure serveur et anti-sniping">
        Ne clôturez pas une enchère avant son échéance sans motif documenté. Une offre dans les deux dernières minutes repousse la
        clôture de deux minutes, dans la limite configurée.
      </Alert>

      {live.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">En direct ({live.length})</h2>
          {live.map((auction) => (
            <Card key={auction.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="success">En direct</Badge>
                    <span className="text-xs text-muted">{auction._count.bids} offre(s)</span>
                    {auction.reservePriceCents ? <Badge tone="neutral">Réserve fixée</Badge> : null}
                  </div>
                  <Link href={`/encheres/${auction.listing.slug}`} className="mt-1 block truncate font-semibold hover:text-brand-700">
                    {auction.listing.title}
                  </Link>
                  <p className="text-xs text-muted">
                    Vendeur {auction.listing.seller.publicName} · fin {formatDateTime(auction.endsAt)} · offre haute{" "}
                    {formatMoney(auction.bids[0]?.amountCents ?? auction.currentPriceCents)}
                  </p>
                </div>
                <ActionForm action={adminCloseAuctionAction} submitLabel="Forcer la clôture" pendingLabel="Clôture…">
                  <input type="hidden" name="auctionId" value={auction.id} />
                </ActionForm>
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState icon={<Gavel className="h-8 w-8" />} title="Aucune enchère en direct" description="Les enchères programmées et terminées sont listées ci-dessous." />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Toutes les enchères</h2>
        <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
          <table className="min-w-full divide-y divide-brand-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Annonce</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Offres</th>
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Gagnant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {others.map((auction) => (
                <tr key={auction.id}>
                  <td className="px-4 py-3">
                    <Link href={`/encheres/${auction.listing.slug}`} className="font-medium hover:text-brand-700">{auction.listing.title}</Link>
                    <p className="text-xs text-muted">{auction.listing.seller.publicName}</p>
                  </td>
                  <td className="px-4 py-3"><Badge tone={AUCTION_STATUS_TONE[auction.status] ?? "neutral"}>{auction.status}</Badge></td>
                  <td className="px-4 py-3">{auction._count.bids}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(auction.currentPriceCents)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(auction.endsAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    {auction.winnerRecord ? (
                      <>
                        <Badge tone={auction.winnerRecord.orderId ? "success" : "warning"}>{auction.winnerRecord.status}</Badge>
                        {auction.winnerRecord.orderId ? <span className="ml-1 text-muted">commande créée</span> : null}
                      </>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
