import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Gavel, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuctionBySlug, minimumNextBidCents, auctionResultLabel } from "@/lib/services/auctions";
import { hasPremium } from "@/lib/services/premium";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { AUCTION_MAX_EXTENSIONS, AUCTION_PAYMENT_DEADLINE_HOURS, LISTING_CONDITIONS, PREMIUM, trialOfferLabel } from "@/lib/config";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Avatar, Card, CardBody } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Countdown } from "@/components/auctions/countdown";
import { ActionForm } from "@/components/forms/action-form";
import { placeBidAction, buyNowAction } from "@/app/actions/auctions";
import { conditionLabel } from "@/components/listings/listing-card";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getAuctionBySlug(slug);
  if (!listing?.auction) return { title: "Enchère introuvable" };
  return {
    title: `${listing.title} — enchère dès ${formatMoney(listing.auction.startPriceCents)}`,
    description: listing.description.slice(0, 160),
  };
}

export default async function AuctionPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const listing = await getAuctionBySlug(slug);
  if (!listing?.auction) notFound();
  const auction = listing.auction;

  const user = await getCurrentUser();
  const isSeller = user?.id === listing.seller.id;
  const premiumViewer = user ? await hasPremium(user.id) : false;
  const locked = listing.isPremiumOnly && !premiumViewer && !isSeller;
  const now = new Date();
  const isLive = auction.status === "LIVE" && auction.endsAt > now && auction.startsAt <= now;
  const isScheduled = auction.status === "SCHEDULED" || auction.startsAt > now;
  const bidCount = auction._count.bids;
  const minNext = minimumNextBidCents(auction, bidCount);
  const viewerWin = user && auction.winnerRecord?.userId === user.id ? auction.winnerRecord : null;
  const result = auctionResultLabel(
    {
      status: auction.status,
      endsAt: auction.endsAt,
      winnerId: auction.winnerId,
      reservePriceCents: auction.reservePriceCents,
      currentPriceCents: auction.currentPriceCents,
    },
    user?.id ?? null,
    viewerWin?.orderId ? "PENDING_PAYMENT" : null,
  );

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Enchères", href: "/encheres" },
          { label: listing.category.name, href: `/encheres?categorie=${listing.category.slug}` },
          { label: listing.title },
        ]}
      />

      {locked ? (
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Sparkles className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Enchère réservée aux membres A2V Prestige</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
            L&apos;accès à cette enchère est contrôlé côté serveur. Les membres Prestige disposent de {trialOfferLabel(PREMIUM.trialDays)}, puis {formatMoney(PREMIUM.priceCents)}
            par mois, avec un engagement de {PREMIUM.commitmentMonths} mois et sans résiliation pendant la période offerte.
          </p>
          <ButtonLink href="/premium" className="mt-6">Découvrir A2V Prestige</ButtonLink>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-white">
              <div className="relative aspect-[4/3] bg-brand-50">
                {listing.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.images[0].url} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl">🔨</div>
                )}
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  {isLive ? <Badge tone="success">● En direct</Badge> : null}
                  {isScheduled ? <Badge tone="info">À venir</Badge> : null}
                  {!isLive && !isScheduled ? <Badge tone="neutral">Terminée</Badge> : null}
                  {listing.isPremiumOnly ? <Badge tone="brand">✦ Prestige</Badge> : null}
                  <Badge tone="neutral">{conditionLabel(listing.condition)}</Badge>
                </div>
              </div>
              {listing.images.length > 1 ? (
                <div className="grid grid-cols-4 gap-2 p-3">
                  {listing.images.slice(1, 9).map((photo) => (
                    <div key={photo.id} className="aspect-square overflow-hidden rounded-lg bg-brand-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <Card className="mt-6">
              <CardBody>
                <h2 className="text-lg font-semibold">Description</h2>
                <div className="prose-a2v mt-3 whitespace-pre-line text-[15px]">{listing.description}</div>
                <dl className="mt-5 grid gap-3 border-t border-brand-100 pt-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Marque</dt><dd className="font-medium">{listing.brand || "Non précisée"}</dd></div>
                  <div><dt className="text-muted">Taille</dt><dd className="font-medium">{listing.size || "Non précisée"}</dd></div>
                  <div><dt className="text-muted">Couleur</dt><dd className="font-medium">{listing.color || "Non précisée"}</dd></div>
                  <div><dt className="text-muted">Ville</dt><dd className="font-medium">{listing.locationCity || "France"}</dd></div>
                </dl>
              </CardBody>
            </Card>

            <Card className="mt-6">
              <CardBody>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Historique des offres</h2>
                  <span className="text-xs text-muted">{bidCount} offre{bidCount > 1 ? "s" : ""}</span>
                </div>
                {auction.bids.length ? (
                  <ol className="mt-4 divide-y divide-brand-100">
                    {auction.bids.map((bid, index) => (
                      <li key={bid.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                            {index + 1}
                          </span>
                          <span className="font-medium">
                            {user && bid.bidder.id === user.id
                              ? "Vous"
                              : `${bid.bidder.publicName.slice(0, 2)}${"•".repeat(Math.max(2, bid.bidder.publicName.length - 2))}`}
                          </span>
                          {bid.status === "WINNING" ? <Badge tone="success">En tête</Badge> : null}
                        </span>
                        <span className="text-right">
                          <span className="font-semibold">{formatMoney(bid.amountCents)}</span>
                          <span className="block text-[11px] text-muted">{formatDateTime(bid.createdAt)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    Aucune offre pour le moment. La première offre doit être au moins égale au prix de départ.
                  </p>
                )}
                {auction.reservePriceCents ? (
                  <p className="mt-4 rounded-lg bg-brand-50 p-3 text-xs text-muted">
                    Un prix de réserve a été fixé par le vendeur.{" "}
                    {auction.currentPriceCents >= auction.reservePriceCents
                      ? "Il est atteint : le vendeur est tenu de vendre au gagnant."
                      : "Tant qu'il n'est pas atteint, l'article ne sera pas vendu."}{" "}
                    Son montant n&apos;est pas public.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                      {isLive ? "Enchère en cours" : isScheduled ? "Enchère à venir" : "Enchère terminée"}
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{formatMoney(auction.currentPriceCents)}</p>
                    <p className="text-xs text-muted">
                      {bidCount === 0 ? "Prix de départ" : "Offre actuelle"} · {bidCount} offre{bidCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <StatusBadge status={auction.status} label={result.label} />
                </div>

                <h1 className="mt-4 text-balance text-2xl font-bold leading-tight text-ink">{listing.title}</h1>

                <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-xs leading-5">
                  <p className="flex items-center gap-1.5 font-semibold text-brand-800">
                    <Sparkles className="h-3.5 w-3.5" /> Avantage Prestige : −10 % au-dessus de 10 000 €
                  </p>
                  <p className="mt-1 text-muted">
                    {premiumViewer
                      ? "Si votre offre gagnante dépasse 10 000 €, la réduction de 10 % est appliquée automatiquement au paiement."
                      : "Si l'offre finale dépasse 10 000 €, les abonnés Prestige bénéficient de 10 % de réduction. L'enchère reste ouverte à tous lorsque son prix de départ ne dépasse pas 10 000 €."}
                  </p>
                </div>

                <div className="mt-4 rounded-xl bg-brand-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                    {isLive ? "Temps restant" : isScheduled ? "Début dans" : "Clôturée le"}
                  </p>
                  <div className="mt-2">
                    {isLive || isScheduled ? (
                      <Countdown endsAt={new Date(isScheduled ? auction.startsAt : auction.endsAt).toISOString()} status={auction.status} />
                    ) : (
                      <p className="text-sm font-medium">{formatDateTime(auction.endsAt)}</p>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted">
                    Début : {formatDateTime(auction.startsAt)} · Fin prévue : {formatDateTime(auction.endsAt)}
                  </p>
                </div>

                {isSeller ? (
                  <Alert tone="info" title="Vous êtes le vendeur" className="mt-4">
                    Vous ne pouvez pas enchérir sur votre propre article. Suivez les offres depuis{" "}
                    <Link href="/compte/annonces" className="link">vos annonces</Link>.
                  </Alert>
                ) : isLive ? (
                  <div className="mt-5">
                    <ActionForm
                      action={placeBidAction}
                      submitLabel={`Enchérir — minimum ${formatMoney(minNext)}`}
                      pendingLabel="Enregistrement de l'offre…"
                      className="space-y-3"
                      footer={<input type="hidden" name="slug" value={listing.slug} />}
                    >
                      <input type="hidden" name="auctionId" value={auction.id} />
                      <div>
                        <label htmlFor="amountEuros" className="label">
                          Votre offre (€)
                        </label>
                        <input
                          id="amountEuros"
                          name="amountEuros"
                          type="text"
                          inputMode="decimal"
                          className="input text-lg font-semibold"
                          defaultValue={(minNext / 100).toFixed(2)}
                        />
                        <p className="mt-1 text-xs text-muted">
                          Offre minimum : {formatMoney(minNext)} (incrément de {formatMoney(auction.minIncrementCents)}).{" "}
                          {auction.buyNowPriceCents
                            ? `À partir de ${formatMoney(auction.buyNowPriceCents)}, l'achat immédiat remplace l'enchère.`
                            : ""}
                        </p>
                      </div>
                      <p className="text-xs leading-5 text-muted">
                        En enchérissant, vous vous engagez à payer si vous gagnez. Vous aurez{" "}
                        {AUCTION_PAYMENT_DEADLINE_HOURS} h après la clôture. Un défaut de paiement peut entraîner la suspension des
                        enchères.
                      </p>
                    </ActionForm>

                    {auction.buyNowPriceCents ? (
                      <div className="mt-4 rounded-xl border border-brand-200 p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <Zap className="h-4 w-4 text-brand-600" /> Achat immédiat
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Remportez l&apos;article immédiatement pour {formatMoney(auction.buyNowPriceCents)}. L&apos;enchère se
                          termine.
                        </p>
                        <ActionForm action={buyNowAction} submitLabel={`Acheter pour ${formatMoney(auction.buyNowPriceCents)}`} className="mt-3 space-y-0">
                          <input type="hidden" name="auctionId" value={auction.id} />
                        </ActionForm>
                      </div>
                    ) : null}
                  </div>
                ) : isScheduled ? (
                  <Alert tone="info" title="Les offres ouvrent bientôt" className="mt-4">
                    Cette enchère débutera le {formatDateTime(auction.startsAt)}. Revenez à ce moment pour placer la première offre.
                  </Alert>
                ) : viewerWin ? (
                  <div className="mt-4 space-y-3">
                    <Alert tone="success" title="Vous avez remporté cette enchère">
                      {viewerWin.status === "PENDING_PAYMENT"
                        ? `Finalisez le paiement avant le ${formatDateTime(viewerWin.paymentDeadline)}.`
                        : "Cette enchère a été réglée."}
                    </Alert>
                    {viewerWin.status === "PENDING_PAYMENT" && !viewerWin.orderId ? (
                      <ButtonLink href={`/paiement-enchere/${viewerWin.id}`} className="w-full">
                        Payer mon enchère
                      </ButtonLink>
                    ) : null}
                  </div>
                ) : (
                  <Alert tone="info" title="Enchère terminée" className="mt-4">
                    {result.label}
                  </Alert>
                )}

                {!user && (isLive || isScheduled) ? (
                  <ButtonLink href={`/connexion?next=${encodeURIComponent(`/encheres/${listing.slug}`)}`} className="mt-4 w-full">
                    Se connecter pour enchérir
                  </ButtonLink>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted">
                  <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Horloge serveur</p>
                  <p className="flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5 text-brand-600" /> Offres horodatées</p>
                  <p className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5 text-brand-600" /> Trophées après finalisation</p>
                  <p className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-brand-600" /> Anti-sniping : 2 min</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <Avatar name={listing.seller.publicName} src={listing.seller.profile?.avatarUrl} size={44} />
                  <div className="min-w-0">
                    <Link href={`/vendeur/${listing.seller.publicName}`} className="truncate font-semibold hover:text-brand-700">
                      {listing.seller.publicName}
                    </Link>
                    <p className="text-xs text-muted">{listing.seller._count.reviewsReceived} avis</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted">
                  Les conditions de vente et la commission de 0,5 % (sur le prix final de l&apos;article, hors livraison) sont
                  appliquées côté serveur. Jusqu&apos;à {AUCTION_MAX_EXTENSIONS} prolongations anti-sniping de 2 minutes.
                </p>
              </CardBody>
            </Card>

            <p className="px-1 text-[11px] leading-4 text-muted">
              Conditions d&apos;état acceptées : {LISTING_CONDITIONS.map((condition) => condition.label).join(" · ")}.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
