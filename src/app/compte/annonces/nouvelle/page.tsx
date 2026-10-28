import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCategoriesWithCounts } from "@/lib/services/listings";
import { PageHeader } from "@/components/ui/page-header";
import { ListingForm } from "@/components/listings/listing-form";
import { createListingAction } from "@/app/actions/listings";

export const metadata: Metadata = { title: "Nouvelle annonce" };

export default async function NewListingPage() {
  await requireUser("/compte/annonces/nouvelle");
  const categories = await getCategoriesWithCounts();

  return (
    <div>
      <Link href="/compte/annonces" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Retour à mes annonces
      </Link>
      <PageHeader
        eyebrow="Vendre"
        title="Nouvelle annonce"
        description="La publication est gratuite. La commission de 0,5 % sur le prix de l'article, hors livraison, n'est retenue qu'après finalisation d'une vente."
      />
      <ListingForm
        action={createListingAction}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          children: category.children.map((child) => ({ id: child.id, name: child.name })),
        }))}
        submitLabel="Publier mon annonce"
      />
    </div>
  );
}
