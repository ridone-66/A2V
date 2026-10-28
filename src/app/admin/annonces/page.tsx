import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAdminListings } from "@/lib/services/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { LISTING_STATUS_LABELS } from "@/lib/config";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ActionForm } from "@/components/forms/action-form";
import { adminModerateListingAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Annonces" };

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.LISTINGS_MODERATE);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminListings({ q: params.q, status: params.status }, page);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Modération"
        title="Annonces"
        description={`${total} annonce(s). Le retrait est journalisé et conserve l'historique des commandes liées.`}
      />

      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3" role="search">
            <div className="min-w-0 flex-1">
              <label htmlFor="q" className="label">Rechercher</label>
              <input id="q" name="q" className="input" defaultValue={params.q ?? ""} placeholder="Titre ou vendeur" />
            </div>
            <div>
              <label htmlFor="status" className="label">Statut</label>
              <select id="status" name="status" className="input" defaultValue={params.status ?? "ALL"}>
                <option value="ALL">Tous</option>
                <option value="PUBLISHED">Publiées</option>
                <option value="DRAFT">Brouillons</option>
                <option value="PAUSED">En pause</option>
                <option value="CANCELLED">Retirées</option>
                <option value="SOLD">Vendues</option>
              </select>
            </div>
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
              <Search className="h-4 w-4" /> Filtrer
            </button>
          </form>
        </CardBody>
      </Card>

      {items.length ? (
        <>
          <div className="space-y-3">
            {items.map((listing) => {
              const hidden = Boolean(listing.deletedAt) || listing.status === "CANCELLED";
              return (
                <Card key={listing.id} className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:h-20 sm:w-20">
                      {listing.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xl">🛍️</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={listing.status} label={LISTING_STATUS_LABELS[listing.status] ?? listing.status} />
                        {listing.auction ? <Badge tone="info">Enchère · {listing.auction.status}</Badge> : null}
                        {listing._count.reports > 0 ? <Badge tone="danger">{listing._count.reports} signalement(s)</Badge> : null}
                      </div>
                      <Link
                        href={listing.saleType === "AUCTION" ? `/encheres/${listing.slug}` : `/annonce/${listing.slug}`}
                        className="mt-1.5 block truncate font-semibold hover:text-brand-700"
                      >
                        {listing.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {listing.seller.publicName} · {formatDate(listing.createdAt)} · {formatMoney(listing.priceCents)}
                        {listing.deletedAt ? ` · retirée le ${formatDate(listing.deletedAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-start">
                      <ActionForm
                        action={adminModerateListingAction}
                        submitLabel={hidden ? "Restaurer" : "Retirer du catalogue"}
                        pendingLabel="…"
                      >
                        <input type="hidden" name="listingId" value={listing.id} />
                        <input type="hidden" name="action" value={hidden ? "RESTORE" : "HIDE"} />
                      </ActionForm>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            basePath="/admin/annonces"
            params={{ q: params.q, status: params.status }}
          />
        </>
      ) : (
        <EmptyState title="Aucune annonce" description="Aucun résultat pour ces filtres." />
      )}
    </div>
  );
}
