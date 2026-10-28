import type { Metadata } from "next";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuctionsList } from "@/lib/services/auctions";
import { getCategoriesWithCounts } from "@/lib/services/listings";
import { AuctionCard } from "@/components/listings/auction-card";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { firstParam, parsePage } from "@/lib/search";

export const metadata: Metadata = {
  title: "Enchères en direct",
  description:
    "Participez aux enchères A2V : horloge serveur, offres horodatées, prolongation anti-sniping et paiement sécurisé. Trophées après une enchère finalisée.",
};

const TABS = [
  { value: "live", label: "En direct" },
  { value: "ending", label: "Se terminent bientôt" },
  { value: "ended", label: "Terminées" },
  { value: "all", label: "Toutes" },
] as const;

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const statusRaw = firstParam(params.statut);
  const status = (["live", "ending", "ended", "all"] as const).includes(statusRaw as never)
    ? (statusRaw as "live" | "ending" | "ended" | "all")
    : "live";
  const category = firstParam(params.categorie);
  const page = parsePage(firstParam(params.page));
  const [categories, auctions] = await Promise.all([
    getCategoriesWithCounts(),
    getAuctionsList({ status, category, page, pageSize: 24, viewerIsPremium: Boolean(user) }),
  ]);

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Enchères" }]} />
      <PageHeader
        eyebrow="Enchères"
        title="Le direct, sans mauvaise surprise"
        description="Chaque offre est vérifiée côté serveur, avec une horloge unique. Une offre dans les deux dernières minutes prolonge l'enchère de deux minutes : le sniping ne vole pas la victoire."
        action={<ButtonLink href="/vendre" variant="outline" size="sm">Mettre en vente aux enchères</ButtonLink>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => {
          const query = new URLSearchParams();
          if (tab.value !== "live") query.set("statut", tab.value);
          if (category) query.set("categorie", category);
          const href = query.toString() ? `/encheres?${query}` : "/encheres";
          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium ${
                status === tab.value ? "border-brand-600 bg-brand-600 text-white" : "border-brand-200 bg-white text-ink hover:bg-brand-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <form action="/encheres" method="get" className="ml-auto flex items-center gap-2">
          {status !== "live" ? <input type="hidden" name="statut" value={status} /> : null}
          <select name="categorie" defaultValue={category ?? ""} className="input h-10 w-auto py-0 text-sm" aria-label="Filtrer par catégorie">
            <option value="">Toutes les catégories</option>
            {categories.map((candidate) => (
              <optgroup key={candidate.id} label={candidate.name}>
                <option value={candidate.slug}>{candidate.name} (tout)</option>
                {candidate.children.map((child) => (
                  <option key={child.id} value={child.slug}>{child.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-full border border-brand-200 px-4 text-sm font-medium hover:bg-brand-50">
            Filtrer
          </button>
        </form>
      </div>

      {status === "live" ? (
        <Alert tone="brand" className="mb-5">
          <span className="inline-flex items-center gap-2">
            <Gavel className="h-4 w-4" /> Les enchères affichées utilisent l&apos;heure du serveur. Rechargez la page pour voir
            les nouvelles offres ; le compte à rebours se rafraîchit automatiquement.
          </span>
        </Alert>
      ) : null}

      {auctions.items.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <Pagination page={auctions.page} pageCount={auctions.pageCount} basePath="/encheres" params={params} />
        </>
      ) : (
        <EmptyState
          icon={<Gavel className="h-8 w-8" />}
          title="Aucune enchère dans cette sélection"
          description="Les enchères passent du statut « à venir » à « en direct » automatiquement. Explorez les autres onglets ou le catalogue à prix fixe."
          action={<ButtonLink href="/catalogue" variant="outline">Voir le catalogue</ButtonLink>}
        />
      )}
    </div>
  );
}
