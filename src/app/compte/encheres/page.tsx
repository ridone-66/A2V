import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Gavel, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getUserAuctionActivity } from "@/lib/services/auctions";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { AUCTION_PAYMENT_DEADLINE_HOURS } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes enchères" };

const BID_STATUS_LABELS: Record<string, string> = {
  WINNING: "En tête",
  OUTBID: "Dépassée",
  WON: "Gagnante",
  CANCELLED: "Annulée",
};

export default async function MyAuctionsPage() {
  const user = await requireUser("/compte/encheres");
  const { bids, wins } = await getUserAuctionActivity(user.id);
  const pendingWins = wins.filter((win) => win.status === "PENDING_PAYMENT" && !win.orderId);
  const settledWins = wins.filter((win) => win.status !== "PENDING_PAYMENT" || win.orderId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enchères"
        title="Mes enchères"
        description="Vos offres, vos victoires et les paiements à finaliser. Une enchère remportée doit être payée dans le délai indiqué."
        action={<ButtonLink href="/encheres" variant="outline" size="sm">Voir les enchères en direct</ButtonLink>}
      />

      {pendingWins.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="h-5 w-5 text-amber-600" /> Paiements en attente</h2>
          {pendingWins.map((win) => {
            const overdue = win.paymentDeadline < new Date();
            return (
              <Card key={win.id} className={overdue ? "border-red-200 p-4" : "border-amber-200 p-4"}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Badge tone={overdue ? "danger" : "warning"}>
                      {overdue ? "Délai dépassé" : `À payer sous ${AUCTION_PAYMENT_DEADLINE_HOURS} h`}
                    </Badge>
                    <Link href={`/encheres/${win.auction.listing.slug}`} className="mt-1 block truncate font-semibold hover:text-brand-700">
                      {win.auction.listing.title}
                    </Link>
                    <p className="text-xs text-muted">
                      Offre gagnante {formatMoney(win.winningBid.amountCents)} · avant le {formatDateTime(win.paymentDeadline)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!overdue ? (
                      <ButtonLink href={`/paiement-enchere/${win.id}`} size="sm">Payer et choisir la livraison</ButtonLink>
                    ) : (
                      <ButtonLink href={`/paiement-enchere/${win.id}`} variant="outline" size="sm">Voir le détail</ButtonLink>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      ) : null}

      {settledWins.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-brand-600" /> Enchères remportées</h2>
          {settledWins.map((win) => (
            <Card key={win.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Badge tone={win.order?.status === "FINALIZED" ? "success" : "brand"}>
                    {win.order ? win.order.status : win.status}
                  </Badge>
                  <Link href={`/encheres/${win.auction.listing.slug}`} className="mt-1 block truncate font-semibold hover:text-brand-700">
                    {win.auction.listing.title}
                  </Link>
                  <p className="text-xs text-muted">Offre gagnante {formatMoney(win.winningBid.amountCents)}</p>
                </div>
                {win.order ? (
                  <ButtonLink href={`/commande/${win.order.orderNumber}`} variant="outline" size="sm">Voir la commande</ButtonLink>
                ) : null}
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Gavel className="h-5 w-5 text-brand-600" /> Historique de mes offres</h2>
        {bids.length ? (
          <div className="space-y-2">
            {bids.map((bid) => (
              <Card key={bid.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={bid.status === "WINNING" ? "success" : bid.status === "WON" ? "brand" : "neutral"}>
                      {BID_STATUS_LABELS[bid.status] ?? bid.status}
                    </Badge>
                    <span className="text-xs text-muted">{formatDateTime(bid.createdAt)}</span>
                  </div>
                  <Link href={`/encheres/${bid.auction.listing.slug}`} className="mt-1 block truncate text-sm font-semibold hover:text-brand-700">
                    {bid.auction.listing.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {bid.auction._count.bids} offre{bid.auction._count.bids > 1 ? "s" : ""} · prix actuel {formatMoney(bid.auction.currentPriceCents)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatMoney(bid.amountCents)}</p>
                  {bid.auction.status === "LIVE" ? (
                    <p className="text-[11px] text-muted">Fin {formatDateTime(bid.auction.endsAt)}</p>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Gavel className="h-8 w-8" />}
            title="Vous n'avez pas encore enchéri"
            description="Les enchères utilisent l'heure du serveur et une prolongation anti-sniping de deux minutes."
            action={<ButtonLink href="/encheres">Découvrir les enchères</ButtonLink>}
          />
        )}
      </section>

      <Alert tone="warning" title="Un engagement, pas un pari">
        Enchérir vous engage à payer si vous gagnez. Un défaut de paiement peut entraîner la suspension de votre participation aux
        enchères. Les trophées ne sont attribués qu&apos;après une vente finalisée.
      </Alert>

      <Card>
        <CardBody className="text-xs leading-5 text-muted">
          <p className="font-semibold text-ink">Prix de réserve et annulation</p>
          <p className="mt-1">
            Une enchère peut se terminer sans vente si le prix de réserve n&apos;est pas atteint. Les clôtures forcées par
            l&apos;administration sont journalisées. Les offres ne peuvent pas être retirées.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
