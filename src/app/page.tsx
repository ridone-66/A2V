import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Gavel,
  HeartHandshake,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Trophy,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getCategoriesWithCounts, searchListings } from "@/lib/services/listings";
import { getAuctionsList } from "@/lib/services/auctions";
import { getPremiumState } from "@/lib/services/premium";
import { getCharityStats } from "@/lib/services/donations";
import { getTrophyProgress } from "@/lib/services/trophies";
import { formatMoney } from "@/lib/money";
import { formatMoneyShort } from "@/lib/money";
import { PREMIUM, trialOfferLabel } from "@/lib/config";
import { ListingCard } from "@/components/listings/listing-card";
import { AuctionCard } from "@/components/listings/auction-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";

export default async function HomePage() {
  const user = await getCurrentUser();
  const [categories, newest, auctions, charity, members, published, liveCount, premium, trophies] =
    await Promise.all([
      getCategoriesWithCounts(),
      searchListings({ pageSize: 8, sort: "recent", viewerIsPremium: Boolean(user) }),
      getAuctionsList({ status: "live", pageSize: 3, viewerIsPremium: Boolean(user) }),
      getCharityStats(),
      prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
      prisma.listing.count({ where: { status: "PUBLISHED", deletedAt: null } }),
      prisma.auction.count({ where: { status: "LIVE" } }),
      user ? getPremiumState(user.id) : Promise.resolve(null),
      user ? getTrophyProgress(user.id) : Promise.resolve(null),
    ]);

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-800 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(167,139,250,0.55),transparent_55%),radial-gradient(circle_at_10%_90%,rgba(109,40,217,0.8),transparent_45%)]" />
        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="animate-fade-up">
            <Badge className="border-white/20 bg-white/10 text-brand-100">Marketplace française — annonces, enchères et trophées</Badge>
            <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Donnez une seconde vie aux objets qui comptent.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-brand-100 sm:text-lg">
              Achetez près de chez vous, vendez gratuitement et tentez votre chance aux enchères. Une seule commission de
              0,5 % sur les ventes finalisées, jamais sur la mise en ligne.
            </p>

            <form action="/catalogue" className="mt-7 max-w-xl" role="search">
              <label htmlFor="home-search" className="sr-only">
                Rechercher une annonce
              </label>
              <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-soft sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input
                    id="home-search"
                    name="q"
                    type="search"
                    placeholder="Robe vintage, appareil photo, fauteuil…"
                    className="h-12 w-full rounded-xl border-0 bg-white pl-11 pr-3 text-[15px] text-ink outline-none placeholder:text-muted"
                  />
                </div>
                <button
                  type="submit"
                  className="h-12 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Explorer
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-brand-200">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Paiement protégé jusqu&apos;à la réception
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4" /> Livraison suivie
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4" /> Litiges accompagnés
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/vendre" size="lg" className="bg-white text-brand-800 hover:bg-brand-100">
                Vendre gratuitement <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink
                href="/encheres"
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/5 text-white hover:bg-white/10"
              >
                <Gavel className="h-4 w-4" /> Voir les enchères
              </ButtonLink>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute -right-6 top-4 w-56 rotate-3 rounded-3xl bg-white p-4 text-ink shadow-2xl">
              <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600">
                <div className="flex h-full items-end p-4 text-3xl font-black text-white/90">A2V</div>
              </div>
              <p className="mt-3 text-sm font-semibold">Sélection du jour</p>
              <p className="text-xs text-muted">Des pièces vérifiées, près de chez vous.</p>
            </div>
            <div className="ml-0 w-[78%] -rotate-2 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Enchère en direct</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" /> Live
                </span>
              </div>
              <div className="mt-4 aspect-[4/3] rounded-2xl bg-gradient-to-br from-brand-400 via-brand-600 to-brand-900 p-6">
                <p className="font-display text-3xl font-bold leading-tight text-white">Montre mécanique vintage</p>
                <p className="mt-2 text-xs uppercase tracking-[0.25em] text-brand-100">Collection · 1968</p>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-brand-200">Prix actuel</p>
                  <p className="text-2xl font-bold">{auctions.items[0] ? formatMoney(auctions.items[0].currentPriceCents) : "72,00 €"}</p>
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs">
                  {auctions.items[0]?._count.bids ?? 0} offres
                </span>
              </div>
            </div>
            <div className="absolute -bottom-6 right-16 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink shadow-2xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Trophées & réductions</p>
                <p className="text-xs text-muted">Récompenses après enchère finalisée</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-brand-900/40">
          <div className="container-page grid grid-cols-2 gap-6 py-6 text-center sm:grid-cols-4">
            {[
              { value: published.toLocaleString("fr-FR"), label: "annonces actives" },
              { value: liveCount.toLocaleString("fr-FR"), label: "enchères en cours" },
              { value: members.toLocaleString("fr-FR"), label: "membres" },
              { value: "0,5 %", label: "commission sur vente finalisée" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-brand-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <SectionHeading
          eyebrow="Explorer"
          title="Toutes les catégories"
          description="Des objets de seconde main sélectionnés par une communauté de particuliers et de petits ateliers."
          action={
            <ButtonLink href="/catalogue" variant="outline" size="sm">
              Tout le catalogue <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/catalogue?categorie=${category.slug}`}
              className="group card flex flex-col items-start gap-3 p-4 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl transition group-hover:bg-brand-100">
                {category.icon ?? "🛍️"}
              </span>
              <span className="text-sm font-semibold text-ink group-hover:text-brand-700">{category.name}</span>
              <span className="text-xs text-muted">{category.listingCount} annonce{category.listingCount > 1 ? "s" : ""}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-brand-50/60 py-12 lg:py-16">
        <div className="container-page">
          <SectionHeading
            eyebrow="Nouveautés"
            title="Fraîchement arrivé sur A2V"
            description="Chaque annonce est publiée gratuitement. La commission n'est due qu'après la finalisation d'une vente."
            action={
              <ButtonLink href="/catalogue?tri=recent" variant="outline" size="sm">
                Voir plus <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            }
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {newest.items.map((listing) => (
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
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <SectionHeading
          eyebrow="Enchères"
          title="Le direct, en toute transparence"
          description="Horloge serveur, offres horodatées et prolongation anti-sniping. Aucune offre n'est acceptée après la clôture."
          action={
            <ButtonLink href="/encheres" size="sm">
              Toutes les enchères <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          }
        />
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
          <div className="card p-8 text-center text-sm text-muted">
            Aucune enchère en direct pour le moment.{" "}
            <Link href="/encheres" className="link">
              Découvrir les prochaines ventes
            </Link>
            .
          </div>
        )}
      </section>

      <section className="bg-brand-800 py-14 text-white lg:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-300">Vendre sur A2V</p>
            <h2 className="mt-2 text-balance text-3xl font-bold text-white sm:text-4xl">
              Publiez gratuitement. Ne payez que lorsque vous vendez.
            </h2>
            <p className="mt-4 max-w-2xl text-brand-100">
              A2V prélève une commission de 0,5 % sur le prix final de l&apos;article, hors frais de livraison. Aucun
              abonnement obligatoire, aucune commission sur une annonce qui ne se vend pas.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Wallet, title: "Publier", text: "Photos, description, prix. C'est gratuit." },
                { icon: PackageCheck, title: "Expédier", text: "Étiquette de livraison et suivi." },
                { icon: CheckCircle2, title: "Encaissez", text: "Versement vendeur après protection acheteur." },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-brand-200">
                      <span className="text-xs font-bold">0{index + 1}</span>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-2 font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-sm text-brand-200">{step.text}</p>
                  </div>
                );
              })}
            </div>
            <ButtonLink href="/vendre" className="mt-7 bg-white text-brand-800 hover:bg-brand-100">
              Créer ma première annonce <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <p className="text-sm font-semibold text-brand-100">Exemple de vente à 100 €</p>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Prix de l'article", "100,00 €"],
                ["Frais de livraison (payés par l'acheteur)", "6,90 €"],
                ["Commission A2V (0,5 % de l'article)", "− 0,50 €"],
                ["Vous recevez", "99,50 €"],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`flex items-center justify-between gap-4 ${index === 3 ? "border-t border-white/20 pt-3 text-base font-bold" : "text-brand-100"}`}
                >
                  <dt>{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-brand-200">
              Exemple indicatif. La commission est calculée côté serveur, sur le prix de l&apos;article avant réductions
              éventuelles financées par A2V.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-12 lg:py-16">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="card overflow-hidden lg:col-span-2">
            <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
              <div>
                <Badge tone="brand">
                  <Sparkles className="h-3 w-3" /> A2V Prestige
                </Badge>
                <h2 className="mt-3 text-2xl font-bold text-ink">{trialOfferLabel(PREMIUM.trialDays)}, puis {formatMoney(PREMIUM.priceCents)}/mois.</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Accédez aux offres réservées, à des réductions supplémentaires et à une découverte avancée. Engagement de{" "}
                  {PREMIUM.commitmentMonths} mois : la résiliation n&apos;est possible qu&apos;à l&apos;échéance.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink">
                  {["Offres et enchères exclusives", "Réductions Prestige cumulables avec vos trophées", `Engagement de ${PREMIUM.commitmentMonths} mois`].map(
                    (feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {feature}
                      </li>
                    ),
                  )}
                </ul>
                <ButtonLink href={premium?.isPremium ? "/compte/abonnement" : "/premium"} className="mt-5" size="sm">
                  {premium?.isPremium ? "Gérer mon abonnement" : premium?.canStartTrial === false ? "Découvrir Prestige" : "Démarrer mon essai"}
                </ButtonLink>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-6 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Votre progression</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <Trophy className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-lg font-bold">{trophies?.wins ?? 0} victoire{(trophies?.wins ?? 0) > 1 ? "s" : ""} finalisée{(trophies?.wins ?? 0) > 1 ? "s" : ""}</p>
                    <p className="text-xs text-brand-200">
                      {trophies?.next ? `Prochain palier : ${trophies.next.name}` : "Tous les paliers débloqués"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-white" style={{ width: `${trophies?.progressToNext ?? 0}%` }} />
                </div>
                <p className="mt-2 text-xs text-brand-200">
                  Les trophées sont attribués uniquement après une enchère remportée <strong className="text-white">et finalisée</strong>.
                </p>
                <Link href="/trophees" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white underline-offset-4 hover:underline">
                  Comprendre les trophées <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <span className="inline-flex rounded-2xl bg-rose-50 p-3 text-rose-600">
              <HeartHandshake className="h-6 w-6" />
            </span>
            <h2 className="mt-3 text-xl font-bold text-ink">Solidarité, séparément.</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Les dons sont suivis dans un espace distinct des ventes, commissions et abonnements. Aucun pourcentage de
              contribution A2V n&apos;est affiché tant qu&apos;il n&apos;est pas décidé et communiqué.
            </p>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Dons collectés</dt>
                <dd className="font-semibold text-ink">{formatMoneyShort(charity.donationsCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Reversé aux organismes</dt>
                <dd className="font-semibold text-ink">{formatMoneyShort(charity.transfersCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Solde disponible</dt>
                <dd className="font-semibold text-ink">{formatMoneyShort(charity.availableCents)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Données de démonstration : les dons enregistrés sont simulés et le montant reversé reste à 0 € tant
              qu&apos;aucun virement réel n&apos;est enregistré.
            </p>
            <ButtonLink href="/dons" variant="secondary" size="sm" className="mt-4">
              Faire un don <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-y border-brand-100 bg-brand-50/70 py-10">
        <div className="container-page grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Paiement protégé", text: "Les fonds ne sont versés au vendeur qu'après la fin de la période de protection." },
            { icon: BellRing, title: "Notifications utiles", text: "Offres dépassées, commandes payées, expéditions et litiges : vous êtes informé." },
            { icon: Gavel, title: "Enchères vérifiées", text: "Clôture côté serveur, prolongation anti-sniping et gestion des défauts de paiement." },
            { icon: Trophy, title: "Récompenses honnêtes", text: "Pas de cagnotte fictive : des réductions configurables, après une vente réellement finalisée." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
