import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { searchListings, getCategoriesWithCounts } from "@/lib/services/listings";
import { ListingCard } from "@/components/listings/listing-card";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { LISTING_CONDITIONS } from "@/lib/config";
import { firstParam, parseEuroCents, parsePage } from "@/lib/search";
import type { ListingCondition } from "@prisma/client";

export const metadata: Metadata = {
  title: "Catalogue — acheter de seconde main",
  description:
    "Parcourez les annonces à prix fixe sur A2V : mode, maison, électronique, loisirs et plus. Paiement protégé, livraison suivie, commission de 0,5 % à la vente.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const q = firstParam(params.q)?.trim();
  const category = firstParam(params.categorie);
  const city = firstParam(params.ville);
  const sortRaw = firstParam(params.tri);
  const sort = (["recent", "price_asc", "price_desc", "popular"] as const).includes(sortRaw as never)
    ? (sortRaw as "recent" | "price_asc" | "price_desc" | "popular")
    : "recent";
  const conditionsParam = params.etat;
  const conditionValues = (Array.isArray(conditionsParam) ? conditionsParam : conditionsParam ? [conditionsParam] : []).filter(
    (value): value is ListingCondition => LISTING_CONDITIONS.some((condition) => condition.value === value),
  );
  const page = parsePage(firstParam(params.page));
  const minPriceCents = parseEuroCents(firstParam(params.min));
  const maxPriceCents = parseEuroCents(firstParam(params.max));

  const [categories, results] = await Promise.all([
    getCategoriesWithCounts(),
    searchListings({
      q,
      category,
      city,
      sort,
      conditions: conditionValues,
      minPriceCents,
      maxPriceCents,
      page,
      pageSize: 24,
      viewerIsPremium: Boolean(user),
    }),
  ]);

  const activeCategory = categories.find((candidate) => candidate.slug === category);
  const hasFilters = Boolean(q || category || city || minPriceCents !== undefined || maxPriceCents !== undefined || conditionValues.length);

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Catalogue" }]} />
      <PageHeader
        eyebrow="Acheter"
        title={activeCategory ? activeCategory.name : q ? `Résultats pour « ${q} »` : "Le catalogue A2V"}
        description={
          activeCategory
            ? `Annonces à prix fixe dans ${activeCategory.name}. La livraison et son tarif sont affichés avant le paiement.`
            : "Des objets d'occasion vérifiés par leurs vendeurs, à prix fixe. Les enchères sont dans un espace séparé."
        }
        action={
          <ButtonLink href="/encheres" variant="outline" size="sm">
            Voir les enchères
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <form action="/catalogue" method="get" className="card space-y-4 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <SlidersHorizontal className="h-4 w-4 text-brand-600" /> Filtrer
            </div>
            <div>
              <label htmlFor="filter-q" className="label">Recherche</label>
              <input id="filter-q" name="q" defaultValue={q} className="input" placeholder="Mot-clé" />
            </div>
            <div>
              <label htmlFor="filter-category" className="label">Catégorie</label>
              <select id="filter-category" name="categorie" defaultValue={category ?? ""} className="input">
                <option value="">Toutes</option>
                {categories.map((candidate) => (
                  <optgroup key={candidate.id} label={candidate.name}>
                    <option value={candidate.slug}>{candidate.name} (tout)</option>
                    {candidate.children.map((child) => (
                      <option key={child.id} value={child.slug}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-city" className="label">Ville / code postal</label>
              <input id="filter-city" name="ville" defaultValue={city} className="input" placeholder="Lyon, 69003…" />
            </div>
            <fieldset>
              <legend className="label">État</legend>
              <div className="space-y-1.5">
                {LISTING_CONDITIONS.map((condition) => (
                  <label key={condition.value} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="etat"
                      value={condition.value}
                      defaultChecked={conditionValues.includes(condition.value)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    {condition.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="filter-min" className="label">Min €</label>
                <input id="filter-min" name="min" defaultValue={firstParam(params.min)} className="input" inputMode="decimal" />
              </div>
              <div>
                <label htmlFor="filter-max" className="label">Max €</label>
                <input id="filter-max" name="max" defaultValue={firstParam(params.max)} className="input" inputMode="decimal" />
              </div>
            </div>
            <div>
              <label htmlFor="filter-sort" className="label">Trier par</label>
              <select id="filter-sort" name="tri" defaultValue={sort} className="input">
                <option value="recent">Plus récentes</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="popular">Populaires</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="h-10 flex-1 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                Appliquer
              </button>
              <Link href="/catalogue" className="inline-flex h-10 items-center rounded-full border border-brand-200 px-4 text-sm font-medium hover:bg-brand-50">
                Réinitialiser
              </Link>
            </div>
          </form>

          <div className="card p-4">
            <p className="text-sm font-semibold text-ink">Vous vendez ?</p>
            <p className="mt-1 text-xs leading-5 text-muted">Publiez gratuitement. 0,5 % de commission seulement sur une vente finalisée.</p>
            <ButtonLink href="/vendre" size="sm" className="mt-3 w-full">Publier une annonce</ButtonLink>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <p>
              <strong className="text-ink">{results.total}</strong> annonce{results.total > 1 ? "s" : ""}
              {hasFilters ? " correspondant à votre recherche" : ""}
            </p>
            {user ? <p className="text-xs">Les offres Prestige sont incluses dans votre abonnement.</p> : null}
          </div>

          {results.items.length ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {results.items.map((listing) => (
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
              <Pagination page={results.page} pageCount={results.pageCount} basePath="/catalogue" params={params} />
            </>
          ) : (
            <EmptyState
              title="Aucune annonce ne correspond"
              description="Essayez d'élargir vos filtres, de retirer le prix minimum ou de chercher un autre mot-clé."
              action={<ButtonLink href="/catalogue" variant="outline">Voir toutes les annonces</ButtonLink>}
            />
          )}
        </section>
      </div>
    </div>
  );
}
