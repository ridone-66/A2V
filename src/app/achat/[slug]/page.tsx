import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getListingBySlug } from "@/lib/services/listings";
import { getAuctionWinnerForCheckout } from "@/lib/services/auctions";
import { hasPremium } from "@/lib/services/premium";
import { premiumDiscountCents } from "@/lib/services/coupons";
import { listAddresses } from "@/lib/services/users";
import { getShippingQuotes } from "@/lib/services/shipping";
import { formatMoney } from "@/lib/money";
import { paymentsSimulationEnabled } from "@/lib/env";
import { Alert, Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { createOrderAction } from "@/app/actions/orders";

export const metadata: Metadata = { title: "Finaliser mon achat" };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const user = await requireUser(`/achat/${slug}`);
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();
  if (listing.sellerId === user.id) redirect(`/annonce/${slug}`);

  const winnerId = typeof query.winnerId === "string" ? query.winnerId : null;
  let itemPriceCents = listing.priceCents;
  let auctionWinnerId: string | null = null;

  if (listing.saleType === "AUCTION") {
    if (!winnerId) redirect(`/encheres/${slug}`);
    const winner = await getAuctionWinnerForCheckout(winnerId, user.id);
    if (winner.auction.listing.id !== listing.id) notFound();
    if (winner.orderId) redirect("/compte/encheres");
    if (winner.status !== "PENDING_PAYMENT") redirect("/compte/encheres");
    itemPriceCents = winner.winningBid.amountCents;
    auctionWinnerId = winner.id;
  } else if (winnerId) {
    redirect(`/achat/${slug}`);
  }

  const premiumViewer = await hasPremium(user.id);
  if (listing.isPremiumOnly && !premiumViewer) {
    return (
      <div className="container-page py-12">
        <Alert tone="warning" title="Offre réservée aux membres Prestige">
          Cet article est réservé aux membres. <Link href="/premium" className="link">Découvrir A2V Prestige</Link>.
        </Alert>
      </div>
    );
  }

  const premiumDiscount = premiumViewer ? premiumDiscountCents(itemPriceCents) : 0;

  if (!["PUBLISHED", "RESERVED"].includes(listing.status)) {
    return (
      <div className="container-page py-12">
        <Alert tone="warning" title="Article indisponible">
          Cet article n&apos;est plus disponible. <Link href="/catalogue" className="link">Retour au catalogue</Link>.
        </Alert>
      </div>
    );
  }

  const [addresses, quotes] = await Promise.all([listAddresses(user.id), getShippingQuotes()]);
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Catalogue", href: "/catalogue" },
          { label: listing.title, href: `/annonce/${slug}` },
          { label: "Achat" },
        ]}
      />
      <PageHeader
        eyebrow={auctionWinnerId ? "Enchère remportée" : "Achat à prix fixe"}
        title="Finaliser votre achat"
        description="Vérifiez l'adresse et le mode de livraison. Le prix total, frais inclus, est confirmé avant le paiement."
      />

      {paymentsSimulationEnabled ? (
        <Alert tone="warning" title="Paiement simulé dans cet environnement" className="mb-5">
          Aucun montant réel ne sera prélevé. En production, cette étape utilise Stripe Checkout et un webhook signé. Ne jamais
          activer les paiements simulés pour de vraies ventes.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <CheckoutForm
          action={createOrderAction}
          listingId={listing.id}
          auctionWinnerId={auctionWinnerId}
          itemPriceCents={itemPriceCents}
          addresses={addresses.map((address) => ({
            id: address.id,
            label: address.label,
            fullName: address.fullName,
            line1: address.line1,
            postalCode: address.postalCode,
            city: address.city,
          }))}
          quotes={quotes}
          initialShipping={quotes[0]?.service}
          listingTitle={listing.title}
          isAuction={Boolean(auctionWinnerId)}
          premiumDiscountCents={premiumDiscount}
        />

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card className="overflow-hidden">
            <div className="aspect-[4/3] bg-brand-50">
              {listing.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.images[0].url} alt={listing.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl">🛍️</div>
              )}
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold">{listing.title}</p>
              <p className="mt-1 text-xs text-muted">Vendu par {listing.seller.publicName}</p>
              <p className="mt-2 text-xl font-bold">{formatMoney(itemPriceCents)}</p>
              {auctionWinnerId ? <p className="mt-1 text-xs text-brand-700">Montant de votre offre gagnante.</p> : null}
            </div>
          </Card>

          <Card className="p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Protection acheteur A2V
            </p>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-muted">
              <li>Le vendeur n&apos;est payé qu&apos;après la période de protection.</li>
              <li>Vous pouvez ouvrir un litige depuis la commande si l&apos;article ne correspond pas.</li>
              <li>La commission de 0,5 % est retenue au vendeur, jamais ajoutée à votre prix.</li>
              <li>Aucune donnée de carte n&apos;est stockée par A2V.</li>
            </ul>
          </Card>

          <p className="px-1 text-xs leading-5 text-muted">
            Adresse par défaut : {defaultAddress ? `${defaultAddress.label} — ${defaultAddress.postalCode} ${defaultAddress.city}` : "aucune"}.
            Besoin de la modifier ? <Link href="/compte/parametres" className="link">Gérer mes adresses</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}
