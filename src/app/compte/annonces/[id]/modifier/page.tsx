import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCategoriesWithCounts, getListingForOwner } from "@/lib/services/listings";
import { Alert, Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ListingForm, type ListingFormInitial } from "@/components/listings/listing-form";
import { updateListingAction } from "@/app/actions/listings";

export const metadata: Metadata = { title: "Modifier une annonce" };

function euros(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/compte/annonces/${id}/modifier`);
  const listing = await getListingForOwner(id, user.id).catch(() => null);
  if (!listing) notFound();

  const categories = await getCategoriesWithCounts();

  const initial: ListingFormInitial = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    categoryId: listing.categoryId,
    condition: listing.condition,
    priceEuros: euros(listing.priceCents),
    saleType: listing.saleType,
    brand: listing.brand ?? "",
    size: listing.size ?? "",
    color: listing.color ?? "",
    locationCity: listing.locationCity ?? "",
    locationPostalCode: listing.locationPostalCode ?? "",
    shippingCostEuros: euros(listing.shippingCostCents),
    shippingNotes: listing.shippingNotes ?? "",
    images: listing.images.map((image) => image.url),
    isPremiumOnly: listing.isPremiumOnly,
    auction: listing.auction
      ? {
          startsAt: listing.auction.startsAt.toISOString(),
          endsAt: listing.auction.endsAt.toISOString(),
          startPriceEuros: euros(listing.auction.startPriceCents),
          reserveEuros: euros(listing.auction.reservePriceCents),
          buyNowEuros: euros(listing.auction.buyNowPriceCents),
          minIncrementEuros: euros(listing.auction.minIncrementCents),
        }
      : null,
  };

  const auctionLocked = listing.auction && !["SCHEDULED", "DRAFT"].includes(listing.auction.status);

  return (
    <div>
      <Link href="/compte/annonces" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Retour à mes annonces
      </Link>
      <PageHeader
        eyebrow="Modifier"
        title={listing.title}
        description="Les modifications sont visibles après enregistrement. Une annonce vendue ou une enchère en cours ne peut pas être modifiée."
      />
      {auctionLocked ? (
        <Card className="p-5">
          <Alert tone="warning" title="Modification verrouillée">
            Cette enchère a déjà commencé ou est terminée : les prix et conditions ne peuvent plus être modifiés. Vous pouvez
            consulter les offres depuis la page de l&apos;enchère.
          </Alert>
          <Link href={`/encheres/${listing.slug}`} className="link mt-4 inline-block text-sm">Voir l&apos;enchère</Link>
        </Card>
      ) : (
        <ListingForm
          action={updateListingAction}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            children: category.children.map((child) => ({ id: child.id, name: child.name })),
          }))}
          initial={initial}
          submitLabel="Enregistrer les modifications"
        />
      )}
    </div>
  );
}
