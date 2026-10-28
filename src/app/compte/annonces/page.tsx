import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Gavel, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { LISTING_STATUS_LABELS } from "@/lib/config";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { listingStatusAction } from "@/app/actions/listings";

export const metadata: Metadata = { title: "Mes annonces" };

export default async function MyListingsPage() {
  const user = await requireUser("/compte/annonces");
  const listings = await prisma.listing.findMany({
    where: { sellerId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      auction: { select: { status: true, endsAt: true, currentPriceCents: true, _count: { select: { bids: true } } } },
      _count: { select: { favorites: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventes"
        title="Mes annonces"
        description="Publiez gratuitement, mettez en pause ou modifiez vos annonces. La commission de 0,5 % n'est due qu'après une vente finalisée."
        action={
          <ButtonLink href="/compte/annonces/nouvelle" size="sm">
            <Plus className="h-4 w-4" /> Nouvelle annonce
          </ButtonLink>
        }
      />

      <Alert tone="info">
        Supprimer une annonce la retire du catalogue mais conserve l&apos;historique des commandes liées. Une annonce avec une
        enchère en cours ou une commande active ne peut pas être supprimée.
      </Alert>

      {listings.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted">Annonces publiées</p>
              <p className="text-2xl font-bold">{listings.filter((listing) => listing.status === "PUBLISHED").length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Vues cumulées</p>
              <p className="text-2xl font-bold">{listings.reduce((sum, listing) => sum + listing.viewCount, 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Favoris cumulés</p>
              <p className="text-2xl font-bold">{listings.reduce((sum, listing) => sum + listing._count.favorites, 0)}</p>
            </Card>
          </div>

          <div className="space-y-3">
            {listings.map((listing) => {
              const href = listing.saleType === "AUCTION" ? `/encheres/${listing.slug}` : `/annonce/${listing.slug}`;
              const canEdit = !listing.auction || ["SCHEDULED", "DRAFT"].includes(listing.auction.status);
              return (
                <Card key={listing.id} className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:h-24 sm:w-24">
                      {listing.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl">🛍️</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={listing.status} label={LISTING_STATUS_LABELS[listing.status] ?? listing.status} />
                        {listing.saleType === "AUCTION" ? <span className="inline-flex items-center gap-1 text-xs text-brand-700"><Gavel className="h-3.5 w-3.5" /> Enchère</span> : null}
                        {listing.isPremiumOnly ? <span className="text-xs font-semibold text-brand-700">✦ Prestige</span> : null}
                      </div>
                      <Link href={href} className="mt-1.5 block truncate font-semibold hover:text-brand-700">{listing.title}</Link>
                      <p className="mt-0.5 text-xs text-muted">
                        Créée le {formatDate(listing.createdAt)} · {listing.viewCount} vues · {listing._count.favorites} favoris
                      </p>
                      {listing.auction ? (
                        <p className="mt-1 text-xs text-muted">
                          {listing.auction._count.bids} offre{listing.auction._count.bids > 1 ? "s" : ""} · prix actuel {formatMoney(listing.auction.currentPriceCents)}
                          {listing.auction.status === "LIVE" ? ` · fin ${formatDateTime(listing.auction.endsAt)}` : ""}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm font-semibold">{formatMoney(listing.priceCents)}</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ButtonLink href={href} variant="outline" size="sm">
                          <Eye className="h-4 w-4" /> Voir
                        </ButtonLink>
                        {canEdit ? (
                          <ButtonLink href={`/compte/annonces/${listing.id}/modifier`} variant="outline" size="sm">
                            <Pencil className="h-4 w-4" /> Modifier
                          </ButtonLink>
                        ) : null}
                        {listing.status === "DRAFT" ? (
                          <form action={listingStatusAction}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="action" value="publish" />
                            <SubmitButton size="sm" pendingLabel="Publication…">Publier</SubmitButton>
                          </form>
                        ) : null}
                        {listing.status === "PUBLISHED" && !listing.auction ? (
                          <form action={listingStatusAction}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="action" value="pause" />
                            <SubmitButton variant="secondary" size="sm" pendingLabel="…">Mettre en pause</SubmitButton>
                          </form>
                        ) : null}
                        <form action={listingStatusAction}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input type="hidden" name="action" value="delete" />
                          <SubmitButton variant="ghost" size="sm" pendingLabel="Suppression…">
                            <Trash2 className="h-4 w-4" /> Supprimer
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardBody className="text-xs leading-5 text-muted">
              <p className="flex items-center gap-2 font-semibold text-ink"><Heart className="h-4 w-4 text-brand-600" /> Bon à savoir</p>
              <p className="mt-2">
                Le nombre de vues est indicatif et peut inclure vos propres visites. Les favoris sont comptés par compte unique.
                Les annonces Prestige ne sont visibles que par les membres abonnés, mais restent accessibles au vendeur.
              </p>
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={<Plus className="h-8 w-8" />}
          title="Vous n'avez pas encore d'annonce"
          description="La publication est gratuite. Ajoutez des photos, décrivez l'article et fixez votre prix. Aucun abonnement requis."
          action={<ButtonLink href="/compte/annonces/nouvelle">Publier ma première annonce</ButtonLink>}
        />
      )}
    </div>
  );
}
