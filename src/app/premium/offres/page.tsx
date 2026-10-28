import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gavel, LockKeyhole, Sparkles, Store } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getPremiumState, hasPremium } from "@/lib/services/premium";
import { searchListings } from "@/lib/services/listings";
import { getAuctionsList } from "@/lib/services/auctions";
import { ListingCard } from "@/components/listings/listing-card";
import { AuctionCard } from "@/components/listings/auction-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState, Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Offres Prestige",
  description: "Annonces et enchères réservées aux membres A2V Prestige.",
  robots: { index: false, follow: false },
};

const BENEFITS = [
  "Toutes les annonces réservées par les vendeurs",
  "Les annonces de plus de 10 000 €, automatiquement réservées aux membres",
  "15 % de réduction sur les articles à plus de 10 000 €",
  "Les enchères Prestige en cours et à venir",
];

export default async function PremiumOffersPage() {
  const user = await getCurrentUser();
  const [premium, state] = user
    ? await Promise.all([hasPremium(user.id), getPremiumState(user.id)])
    : [false, null];

  if (!user || !premium) {
    return (
      <div className="container-page py-8 lg:py-10">
        <Breadcrumbs items={[{ label: "A2V Prestige", href: "/premium" }, { label: "Offres" }]} />
        <PageHeader
          eyebrow="A2V Prestige"
          title="Les offres réservées aux membres"
          description="Annonces et enchères Prestige : l'accès est vérifié côté serveur, jamais seulement masqué dans l'interface."
        />
        <Card className="mx-auto max-w-2xl">
          <CardBody className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <LockKeyhole className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">
                {user ? "Cette sélection est réservée aux membres Prestige" : "Connectez-vous pour accéder aux offres Prestige"}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {user
                  ? `${state?.trialMonths ?? 3} mois offerts, puis ${formatMoney(state?.priceCents ?? 600)} par mois, sans engagement.`
                  : "Les offres Prestige ne sont visibles qu'après connexion avec un abonnement actif ou un essai en cours."}
              </p>
            </div>
            <ul className="mx-auto max-w-md space-y-1 text-left text-sm text-ink">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {benefit}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-center gap-3">
              {user ? (
                <ButtonLink href="/premium">Découvrir A2V Prestige</ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/connexion?next=/premium/offres">Se connecter</ButtonLink>
                  <ButtonLink href="/premium" variant="outline">Découvrir Prestige</ButtonLink>
                </>
              )}
            </div>
            <p className="text-xs text-muted">
              Aucune donnée d&apos;annonce Prestige n&apos;est chargée avant la vérification de l&apos;abonnement.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const [listings, auctions] = await Promise.all([
    searchListings({ premiumOnly: true, viewerIsPremium: true, pageSize: 12, sort: "recent" }),
    getAuctionsList({ premiumOnly: true, viewerIsPremium: true, status: "open", pageSize: 6, sort: "ending" }),
  ]);

  const total = listings.total + auctions.total;

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "A2V Prestige", href: "/premium" }, { label: "Offres" }]} />
      <PageHeader
        eyebrow="A2V Prestige"
        title="Vos offres réservées"
        description={`${total} offre${total > 1 ? "s" : ""} Prestige disponible${total > 1 ? "s" : ""} : annonces à prix fixe et enchères ouvertes. L'accès est vérifié côté serveur.`}
        action={
          <ButtonLink href="/compte/abonnement" variant="outline" size="sm">
            Gérer mon abonnement
          </ButtonLink>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <Badge tone="brand">
          <Sparkles className="h-3.5 w-3.5" /> Membre Prestige
        </Badge>
        <span className="text-xs text-muted">
          Avantage membre : −15 % sur les articles à plus de 10 000 €, qui sont réservés aux membres. En dessous du seuil, les
          annonces publiques restent accessibles à tous au prix affiché.
        </span>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
              <Gavel className="h-5 w-5 text-brand-700" /> Enchères Prestige
            </h2>
            <p className="mt-1 text-sm text-muted">Enchères en cours et à venir, réservées aux membres.</p>
          </div>
          <Link href="/encheres" className="link text-sm">
            Toutes les enchères <ArrowRight className="inline h-3.5 w-3.5" />
          </Link>
        </div>
        {auctions.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.items.map((auction) => (
              <AuctionCard
                key={auction.id}
                href={`/encheres/${auction.listing.slug}`}
                title={auction.listing.title}
                image={auction.listing.images[0]?.url}
                currentPriceCents={auction.currentPriceCents}
                bidCount={auction._count.bids}
                endsAt={auction.endsAt}
                status={auction.status}
                reservePriceCents={auction.reservePriceCents}
                buyNowPriceCents={auction.buyNowPriceCents}
                premiumOnly={auction.listing.isPremiumOnly}
                seller={auction.listing.seller.publicName}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Gavel className="h-8 w-8" />}
            title="Aucune enchère Prestige ouverte"
            description="Les prochaines enchères réservées apparaîtront ici dès leur ouverture."
          />
        )}
      </section>

      <section className="mt-12 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
              <Store className="h-5 w-5 text-brand-700" /> À prix fixe
            </h2>
            <p className="mt-1 text-sm text-muted">Achetez immédiatement, avec livraison affichée avant paiement.</p>
          </div>
          <Link href="/catalogue" className="link text-sm">
            Tout le catalogue <ArrowRight className="inline h-3.5 w-3.5" />
          </Link>
        </div>
        {listings.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {listings.items.map((listing) => (
              <ListingCard
                key={listing.id}
                href={`/annonce/${listing.slug}`}
                title={listing.title}
                image={listing.images[0]?.url}
                priceCents={listing.priceCents}
                condition={listing.condition}
                location={listing.locationCity}
                seller={listing.seller.publicName}
                premiumOnly={listing.isPremiumOnly}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Store className="h-8 w-8" />}
            title="Aucune annonce Prestige à prix fixe"
            description="Les annonces réservées aux membres apparaîtront ici."
            action={<ButtonLink href="/catalogue" variant="outline">Explorer le catalogue</ButtonLink>}
          />
        )}
      </section>

      <Card className="mt-12">
        <CardHeader
          title="Pourquoi ces offres sont-elles réservées ?"
          description="Les vendeurs peuvent choisir de réserver une annonce aux membres Prestige."
        />
        <CardBody className="text-sm text-muted">
          <p>
            Une annonce réservée Prestige n&apos;est visible que par les membres actifs ; le contrôle est effectué côté serveur.
            Le vendeur conserve toujours l&apos;accès à son annonce et à ses ventes. Au-delà de 10 000 € (prix affiché ou prix de
            départ d&apos;une enchère), la réservation est automatique ; en dessous de ce seuil, elle résulte d&apos;un choix du
            vendeur.
          </p>
          <p className="mt-2">
            Les articles de plus de 10 000 € offrent <strong className="text-ink">15 % de réduction aux membres Prestige</strong>,
            appliqués automatiquement au paiement. En dessous du seuil, les annonces publiques restent achetables par tous au prix
            affiché.
          </p>
          <p className="mt-2">
            L&apos;abonnement Prestige ne modifie pas la commission de 0,5 % et n&apos;est jamais obligatoire pour vendre.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
