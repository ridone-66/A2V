import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listFavorites } from "@/lib/services/users";
import { ListingCard } from "@/components/listings/listing-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toggleFavoriteAction } from "@/app/actions/listings";
import { SubmitButton } from "@/components/forms/submit-button";

export const metadata: Metadata = { title: "Mes favoris" };

export default async function FavoritesPage() {
  const user = await requireUser("/compte/favoris");
  const favorites = await listFavorites(user.id);
  const visible = favorites.filter((favorite) => favorite.listing.status === "PUBLISHED" && !favorite.listing.deletedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Favoris"
        title="Annonces suivies"
        description="Retrouvez les articles que vous avez enregistrés. Un article vendu ou retiré disparaît de cette liste."
        action={<ButtonLink href="/catalogue" variant="outline" size="sm">Explorer le catalogue</ButtonLink>}
      />

      {visible.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((favorite) => {
            const listing = favorite.listing;
            const href = listing.saleType === "AUCTION" ? `/encheres/${listing.slug}` : `/annonce/${listing.slug}`;
            return (
              <div key={favorite.id} className="space-y-2">
                <ListingCard
                  href={href}
                  title={listing.title}
                  image={listing.images[0]?.url}
                  priceCents={listing.auction?.currentPriceCents ?? listing.priceCents}
                  condition={listing.condition}
                  location={listing.locationCity}
                  seller={listing.seller.publicName}
                  premiumOnly={listing.isPremiumOnly}
                  badge={listing.saleType === "AUCTION" ? "Enchère" : undefined}
                  footer={
                    <form action={toggleFavoriteAction}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <input type="hidden" name="returnTo" value="/compte/favoris" />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                        <Heart className="h-4 w-4 fill-brand-600 text-brand-600" /> Retirer
                      </SubmitButton>
                    </form>
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title="Aucun favori pour l'instant"
          description="Touchez le cœur sur une annonce pour la retrouver ici. Les favoris sont privés."
          action={<ButtonLink href="/catalogue">Découvrir des articles</ButtonLink>}
        />
      )}
    </div>
  );
}
