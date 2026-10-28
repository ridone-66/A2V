import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Package, Star } from "lucide-react";
import { getSellerPublicProfile } from "@/lib/services/listings";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, Card, EmptyState } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ListingCard } from "@/components/listings/listing-card";

type Params = { publicName: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { publicName } = await params;
  return { title: `${decodeURIComponent(publicName)} — profil vendeur` };
}

export default async function SellerProfilePage({ params }: { params: Promise<Params> }) {
  const { publicName } = await params;
  const seller = await getSellerPublicProfile(decodeURIComponent(publicName));
  if (!seller || seller.status !== "ACTIVE") notFound();

  const average =
    seller.reviewsReceived.length > 0
      ? seller.reviewsReceived.reduce((sum, review) => sum + review.rating, 0) / seller.reviewsReceived.length
      : null;

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Vendeurs" }, { label: seller.publicName }]} />
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={seller.publicName} src={seller.profile?.avatarUrl} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{seller.publicName}</h1>
              <Badge tone="brand"><BadgeCheck className="h-3.5 w-3.5" /> Vendeur A2V</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">Membre depuis {formatDate(seller.createdAt, { month: "long", year: "numeric" })}</p>
            {seller.profile?.city && seller.profile.publicLocation ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" /> {seller.profile.city}</p>
            ) : null}
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {seller.profile?.bio || "Ce vendeur n'a pas encore ajouté de présentation."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5">
                <Package className="h-4 w-4 text-brand-600" /> {seller.listings.length} annonce{seller.listings.length > 1 ? "s" : ""} publique{seller.listings.length > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5">
                <Star className="h-4 w-4 text-amber-500" /> {average ? `${average.toFixed(1)} / 5` : "Aucun avis"} ({seller._count.reviewsReceived})
              </span>
            </div>
          </div>
        </div>
      </Card>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold">Annonces en cours</h2>
        {seller.listings.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {seller.listings.map((listing) => (
              <ListingCard
                key={listing.id}
                href={listing.saleType === "AUCTION" ? `/encheres/${listing.slug}` : `/annonce/${listing.slug}`}
                title={listing.title}
                image={listing.images[0]?.url}
                priceCents={listing.auction?.currentPriceCents ?? listing.priceCents}
                condition={listing.condition}
                location={listing.locationCity}
                badge={listing.saleType === "AUCTION" ? "Enchère" : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="Aucune annonce publique" description="Ce vendeur n'a pas d'annonce visible pour le moment." />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold">Avis reçus</h2>
        {seller.reviewsReceived.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {seller.reviewsReceived.map((review) => (
              <Card key={review.id} className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{review.author.publicName}</p>
                  <span className="text-sm text-amber-500" aria-label={`${review.rating} sur 5`}>
                    {"★".repeat(review.rating)}
                    <span className="text-brand-100">{"★".repeat(5 - review.rating)}</span>
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{review.comment || "Aucun commentaire."}</p>
                <p className="mt-2 text-[11px] text-muted">{formatDate(review.createdAt)}</p>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Aucun avis publié pour ce vendeur.</p>
        )}
      </section>

      <p className="mt-8 text-xs text-muted">
        Les avis proviennent uniquement de commandes finalisées. <Link href="/catalogue" className="link">Continuer mes achats</Link>.
      </p>
    </div>
  );
}
