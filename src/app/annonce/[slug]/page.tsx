import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Flag,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getListingBySlug, incrementListingView, isFavorite } from "@/lib/services/listings";
import { hasPremium } from "@/lib/services/premium";
import { premiumDiscountCents } from "@/lib/services/coupons";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Avatar, Card, CardBody } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ActionForm, FieldHint } from "@/components/forms/action-form";
import { toggleFavoriteAction, reportListingAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
import { conditionLabel } from "@/components/listings/listing-card";
import { LISTING_CONDITIONS } from "@/lib/config";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Annonce introuvable" };
  return {
    title: `${listing.title} — ${formatMoney(listing.priceCents)}`,
    description: listing.description.slice(0, 160),
    openGraph: { images: listing.images[0]?.url ? [listing.images[0].url] : undefined },
  };
}

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing || listing.status === "DRAFT") notFound();

  const user = await getCurrentUser();
  const isOwner = user?.id === listing.seller.id;
  const premiumViewer = user ? await hasPremium(user.id) : false;
  const locked = listing.isPremiumOnly && !premiumViewer && !isOwner;
  const favorite = user && !isOwner ? await isFavorite(user.id, listing.id) : false;
  if (!isOwner) void incrementListingView(listing.id);

  const image = listing.images[0]?.url;
  const sellerCity = listing.seller.profile?.publicLocation ? listing.seller.profile.city : null;
  const isAuction = listing.saleType === "AUCTION";

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Catalogue", href: "/catalogue" },
          { label: listing.category.name, href: `/catalogue?categorie=${listing.category.slug}` },
          { label: listing.title },
        ]}
      />

      {locked ? (
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Sparkles className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Annonce réservée aux membres A2V Prestige</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
            Ce vendeur a choisi de réserver son annonce aux membres. L&apos;accès est vérifié côté serveur, pas seulement masqué
            dans l&apos;interface. L&apos;abonnement est sans engagement : 3 mois offerts, puis 6 € par mois.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/premium">{user ? "Découvrir Prestige" : "Se connecter et découvrir"}</ButtonLink>
            <ButtonLink href="/catalogue" variant="outline">Retour au catalogue</ButtonLink>
          </div>
          <p className="mt-4 text-xs text-muted">Vendre reste gratuit et sans abonnement obligatoire.</p>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white">
              <div className="relative aspect-[4/3] bg-brand-50">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl text-brand-400">🛍️</div>
                )}
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
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

            {image?.startsWith("/demo/") ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Photo d&apos;illustration — annonce de démonstration. L&apos;article et le vendeur présentés sont fictifs ; la photo
                ne décrit pas un bien réellement disponible.
              </p>
            ) : null}

            <Card className="mt-6">
              <CardBody>
                <h2 className="text-lg font-semibold">Description</h2>
                <div className="prose-a2v mt-3 whitespace-pre-line text-[15px]">{listing.description}</div>

                <dl className="mt-6 grid gap-3 border-t border-brand-100 pt-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Marque</dt>
                    <dd className="font-medium">{listing.brand || "Non précisée"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Taille</dt>
                    <dd className="font-medium">{listing.size || "Non précisée"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Couleur</dt>
                    <dd className="font-medium">{listing.color || "Non précisée"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Publiée le</dt>
                    <dd className="font-medium">{formatDate(listing.publishedAt ?? listing.createdAt)}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            {!isOwner ? (
              <Card className="mt-6">
                <CardBody>
                  <h2 className="text-lg font-semibold">Une question ? Un doute ?</h2>
                  <p className="mt-1 text-sm text-muted">
                    Écrivez au vendeur. Ne communiquez jamais d&apos;informations bancaires et ne payez pas hors A2V : vous perdriez
                    la protection de l&apos;acheteur.
                  </p>
                  <ActionForm
                    action={startConversationAction}
                    submitLabel="Envoyer au vendeur"
                    pendingLabel="Envoi…"
                    className="mt-4"
                    footer={<input type="hidden" name="slug" value={listing.slug} />}
                  >
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="recipientId" value={listing.seller.id} />
                    <div>
                      <label htmlFor="subject" className="label">Objet</label>
                      <input id="subject" name="subject" className="input" defaultValue={`Question sur « ${listing.title} »`} maxLength={120} />
                    </div>
                    <div>
                      <label htmlFor="body" className="label">Votre message</label>
                      <textarea id="body" name="body" rows={4} className="input" maxLength={3000} placeholder="Bonjour, l'article est-il toujours disponible ?" />
                    </div>
                  </ActionForm>
                </CardBody>
              </Card>
            ) : null}

            <details className="mt-6 rounded-2xl border border-brand-100 bg-white p-5">
              <summary className="cursor-pointer list-none text-sm font-medium text-muted hover:text-ink">
                <span className="inline-flex items-center gap-2">
                  <Flag className="h-4 w-4" /> Signaler cette annonce
                </span>
              </summary>
              <ActionForm action={reportListingAction} submitLabel="Signaler à la modération" className="mt-4" pendingLabel="Envoi…">
                <input type="hidden" name="listingId" value={listing.id} />
                <div>
                  <label htmlFor="reason" className="label">Motif</label>
                  <select id="reason" name="reason" className="input" defaultValue="MISLEADING">
                    <option value="FRAUD">Tentative de fraude</option>
                    <option value="COUNTERFEIT">Contrefaçon</option>
                    <option value="PROHIBITED">Objet interdit</option>
                    <option value="MISLEADING">Description trompeuse</option>
                    <option value="ABUSIVE">Contenu abusif</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="details" className="label">Précisions (facultatif)</label>
                  <textarea id="details" name="details" rows={3} className="input" maxLength={1000} />
                  <FieldHint>Votre signalement n&apos;est pas public et n&apos;est pas communiqué au vendeur.</FieldHint>
                </div>
              </ActionForm>
            </details>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                      {isAuction ? "Enchère" : "Prix fixe"}
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{formatMoney(listing.priceCents)}</p>
                  </div>
                  {listing.status !== "PUBLISHED" ? (
                    <StatusBadge status={listing.status} label={listing.status === "RESERVED" ? "Réservée" : listing.status} />
                  ) : null}
                </div>

                <h1 className="mt-4 text-balance text-2xl font-bold leading-tight text-ink">{listing.title}</h1>

                {premiumDiscountCents(listing.priceCents) > 0 ? (
                  <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-xs leading-5">
                    <p className="flex items-center gap-1.5 font-semibold text-brand-800">
                      <Sparkles className="h-3.5 w-3.5" />
                      {premiumViewer ? "Votre avantage Prestige : −15 %" : "Avantage Prestige : −15 %"}
                    </p>
                    <p className="mt-1 text-muted">
                      {premiumViewer
                        ? "La réduction est appliquée automatiquement au paiement, sur le prix de l'article."
                        : "Les abonnés Prestige bénéficient de 15 % de réduction sur cet article. Sans abonnement, il reste disponible au prix affiché."}
                    </p>
                  </div>
                ) : null}

                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {listing.locationCity || sellerCity || "France"}
                  </span>
                  <span>·</span>
                  <span>{conditionLabel(listing.condition)}</span>
                </p>

                <div className="mt-5 space-y-2 rounded-xl bg-brand-50/70 p-4 text-sm">
                  <p className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-brand-600" />
                    Livraison calculée et affichée avant paiement
                  </p>
                  <p className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand-600" />
                    Paiement conservé jusqu&apos;à la protection acheteur
                  </p>
                  <p className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-brand-600" />
                    {listing.shippingNotes || "Expédition suivie par le vendeur"}
                  </p>
                </div>

                {listing.status === "PUBLISHED" ? (
                  isOwner ? (
                    <div className="mt-5 space-y-2">
                      <ButtonLink href={`/compte/annonces/${listing.id}/modifier`} className="w-full">Modifier mon annonce</ButtonLink>
                      <p className="text-center text-xs text-muted">Vous voyez votre annonce en tant que vendeur.</p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-2">
                      <ButtonLink href={isAuction ? `/encheres/${listing.slug}` : `/achat/${listing.slug}`} size="lg" className="w-full">
                        {isAuction ? "Voir l'enchère et enchérir" : "Acheter maintenant"}
                      </ButtonLink>
                      <form action={toggleFavoriteAction}>
                        <input type="hidden" name="listingId" value={listing.id} />
                        <input type="hidden" name="returnTo" value={`/annonce/${listing.slug}`} />
                        <button
                          type="submit"
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-brand-200 bg-white text-sm font-semibold text-ink hover:bg-brand-50"
                        >
                          <Heart className={`h-4 w-4 ${favorite ? "fill-brand-600 text-brand-600" : ""}`} />
                          {favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                        </button>
                      </form>
                    </div>
                  )
                ) : (
                  <Alert tone="warning" title="Article indisponible" className="mt-5">
                    Cette annonce n&apos;est plus disponible à l&apos;achat. Découvrez d&apos;autres objets dans le{" "}
                    <Link href="/catalogue" className="link">catalogue</Link>.
                  </Alert>
                )}

                <p className="mt-4 text-xs leading-5 text-muted">
                  A2V ne prélève pas de commission à l&apos;acheteur. La commission de 0,5 % est retenue sur le versement du vendeur
                  après finalisation.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <Avatar name={listing.seller.publicName} src={listing.seller.profile?.avatarUrl} size={48} />
                  <div className="min-w-0">
                    <Link href={`/vendeur/${listing.seller.publicName}`} className="truncate font-semibold hover:text-brand-700">
                      {listing.seller.publicName}
                    </Link>
                    <p className="text-xs text-muted">
                      Membre depuis {formatDate(listing.seller.createdAt, { month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {listing.seller.profile?.bio || "Ce vendeur n'a pas encore ajouté de présentation."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-600" /> {listing.seller._count.reviewsReceived} avis
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1">
                    <Package className="h-3.5 w-3.5 text-brand-600" /> {listing.seller._count.listings} ventes finalisées
                  </span>
                </div>
                <ButtonLink href={`/vendeur/${listing.seller.publicName}`} variant="outline" size="sm" className="mt-4 w-full">
                  Voir le profil du vendeur
                </ButtonLink>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="text-xs leading-5 text-muted">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <MessageCircle className="h-4 w-4 text-brand-600" /> Comment se passe l&apos;achat ?
                </p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-4">
                  <li>Vous payez en ligne, les fonds sont conservés.</li>
                  <li>Le vendeur expédie et le suivi apparaît dans votre compte.</li>
                  <li>Vous confirmez la réception ; la vente est finalisée après le délai de protection.</li>
                </ol>
              </CardBody>
            </Card>
          </aside>
        </div>
      )}

      {listing.saleType === "FIXED_PRICE" && listing.status === "PUBLISHED" ? (
        <p className="sr-only">
          Article d&apos;occasion en {conditionLabel(listing.condition)}, proposé par {listing.seller.publicName} à{" "}
          {formatMoney(listing.priceCents)}. Conditions acceptées : {LISTING_CONDITIONS.map((condition) => condition.label).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
