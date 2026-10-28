import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getAuctionWinnerForCheckout } from "@/lib/services/auctions";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { Alert, Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { AUCTION_PAYMENT_DEADLINE_HOURS } from "@/lib/config";

export const metadata: Metadata = { title: "Payer mon enchère" };

export default async function AuctionPaymentPage({ params }: { params: Promise<{ winnerId: string }> }) {
  const { winnerId } = await params;
  const user = await requireUser(`/paiement-enchere/${winnerId}`);
  const winner = await getAuctionWinnerForCheckout(winnerId, user.id).catch(() => null);
  if (!winner) notFound();
  if (winner.order) redirect(`/commande/${winner.order.orderNumber}`);

  const deadlinePassed = winner.paymentDeadline < new Date();
  const listing = winner.auction.listing;
  const slug = listing.slug;

  return (
    <div className="container-page max-w-3xl py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Mes enchères", href: "/compte/encheres" }, { label: "Paiement" }]} />
      <PageHeader
        eyebrow="Enchère remportée"
        title="Vous avez gagné cette enchère"
        description="Le prix est fixé par votre offre gagnante. Les frais de livraison et le total sont calculés à l'étape suivante, avant tout paiement."
      />

      {deadlinePassed ? (
        <Alert tone="danger" title="Délai de paiement dépassé" className="mb-5">
          Le délai de {AUCTION_PAYMENT_DEADLINE_HOURS} heures est dépassé. Le vendeur peut proposer l&apos;article au deuxième
          enchérisseur. Contactez le support si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </Alert>
      ) : (
        <Alert tone="warning" title="Délai à respecter" className="mb-5">
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4" /> Payez avant le {formatDateTime(winner.paymentDeadline)}. Passé ce délai, la vente peut être
            annulée et votre compte signalé pour défaut de paiement.
          </span>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-[220px_1fr]">
          <div className="aspect-square bg-brand-50 sm:aspect-auto">
            {listing.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.images[0].url} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl">🔨</div>
            )}
          </div>
          <div className="p-5">
            <p className="text-sm font-semibold text-ink">{listing.title}</p>
            <p className="mt-1 text-xs text-muted">Vendu par {listing.seller.publicName}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Offre gagnante</dt>
                <dd className="text-lg font-bold">{formatMoney(winner.winningBid.amountCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Statut</dt>
                <dd className="font-medium">En attente de paiement</dd>
              </div>
            </dl>
            {!deadlinePassed ? (
              <ButtonLink href={`/achat/${slug}?winnerId=${winner.id}`} className="mt-5">
                Choisir la livraison et payer
              </ButtonLink>
            ) : (
              <ButtonLink href="/compte/encheres" variant="outline" className="mt-5">
                Retour à mes enchères
              </ButtonLink>
            )}
            <p className="mt-3 text-xs text-muted">
              Vous pouvez aussi suivre cette enchère depuis <Link href="/compte/encheres" className="link">Mes enchères</Link>.
            </p>
          </div>
        </div>
      </Card>

      <p className="mt-5 text-xs leading-5 text-muted">
        Rappel : une offre est un engagement. Le non-paiement d&apos;une enchère remportée peut entraîner la suspension de la
        participation aux enchères. Aucun trophée ni réduction n&apos;est attribué avant la finalisation complète de la vente.
      </p>
    </div>
  );
}
