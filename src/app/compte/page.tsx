import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Circle,
  Gavel,
  Heart,
  MessageCircle,
  Package,
  Sparkles,
  Trophy,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getAccountOverview } from "@/lib/services/users";
import { getPremiumState } from "@/lib/services/premium";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PREMIUM, trialOfferLabel } from "@/lib/config";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, EmptyState, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default async function AccountDashboardPage() {
  const user = await requireUser("/compte");
  const [overview, premium, recentOrders, pendingWinners, notifications, addresses, bidCount] = await Promise.all([
    getAccountOverview(user.id),
    getPremiumState(user.id),
    prisma.order.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        listing: { select: { title: true, slug: true, images: { orderBy: { position: "asc" }, take: 1 } } },
        buyer: { select: { publicName: true } },
        seller: { select: { publicName: true } },
      },
    }),
    prisma.auctionWinner.findMany({
      where: { userId: user.id, status: "PENDING_PAYMENT", orderId: null },
      orderBy: { paymentDeadline: "asc" },
      include: { auction: { include: { listing: { select: { title: true, slug: true } } } }, winningBid: true },
    }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.address.count({ where: { userId: user.id } }),
    prisma.bid.count({ where: { bidderId: user.id } }),
  ]);

  const hasProfile = Boolean(user.profile?.avatarUrl || user.profile?.bio);
  const checklist = [
    { done: true, label: "Compte créé", href: "/compte" },
    { done: hasProfile, label: "Compléter mon profil public", href: "/compte/profil" },
    { done: addresses > 0, label: "Ajouter une adresse de livraison", href: "/compte/parametres" },
    { done: overview.listings > 0, label: "Publier ma première annonce", href: "/vendre" },
  ];
  const remaining = checklist.filter((item) => !item.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tableau de bord"
        title={`Bonjour ${user.publicName}`}
        description="Vos achats, ventes, enchères et avantages en un coup d'œil. Aucune donnée affichée ici n'est calculée dans le navigateur."
        action={<ButtonLink href="/vendre" size="sm">Publier une annonce</ButtonLink>}
      />

      {pendingWinners.length ? (
        <Alert tone="warning" title="Enchère remportée — paiement en attente" className="mb-1">
          <div className="space-y-2">
            {pendingWinners.map((winner) => (
              <p key={winner.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{winner.auction.listing.title}</strong> — {formatMoney(winner.winningBid.amountCents)} · avant le{" "}
                  {formatDateTime(winner.paymentDeadline)}
                </span>
                <Link href={`/paiement-enchere/${winner.id}`} className="link font-semibold">Payer maintenant</Link>
              </p>
            ))}
          </div>
        </Alert>
      ) : null}

      {overview.openDisputes > 0 ? (
        <Alert tone="danger" title="Litige en cours">
          {overview.openDisputes} litige{overview.openDisputes > 1 ? "s" : ""} suspend{overview.openDisputes > 1 ? "ent" : ""} la
          finalisation et le versement concernés. <Link href="/compte/achats" className="link font-semibold">Voir mes commandes</Link>.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Achats" value={overview.purchases} hint="Commandes passées" />
        <Stat label="Ventes finalisées" value={overview.sales} hint="Commission due uniquement à ce stade" />
        <Stat label="Annonces" value={overview.listings} hint="Brouillons et publications" />
        <Stat label="Trophées" value={overview.trophies} hint="Après enchères finalisées" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader
            title="Commandes récentes"
            description="Les commandes où vous êtes acheteur ou vendeur."
            action={<Link href="/compte/achats" className="text-sm font-medium text-brand-700 hover:underline">Tout voir</Link>}
          />
          {recentOrders.length ? (
            <ul className="divide-y divide-brand-100">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center gap-3 p-4">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                    {order.listing.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={order.listing.images[0].url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg">🛍️</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/commande/${order.orderNumber}`} className="block truncate text-sm font-semibold hover:text-brand-700">
                      {order.listing.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {order.buyerId === user.id ? `Vendeur : ${order.seller.publicName}` : `Acheteur : ${order.buyer.publicName}`} ·{" "}
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatMoney(order.buyerTotalCents)}</p>
                    <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <EmptyState
                title="Aucune commande pour l'instant"
                description="Vos achats et ventes apparaîtront ici, avec leur statut et leur suivi."
                action={<ButtonLink href="/catalogue" variant="outline">Explorer le catalogue</ButtonLink>}
              />
            </CardBody>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Finaliser mon compte" description={remaining === 0 ? "Tout est prêt." : `${remaining} étape${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}.`} />
            <CardBody className="space-y-2.5">
              {checklist.map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center gap-2.5 text-sm hover:text-brand-700">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-brand-300" />
                  )}
                  <span className={item.done ? "text-muted line-through" : "font-medium"}>{item.label}</span>
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4" /> A2V Prestige
                </p>
                {premium.isPremium ? <Badge className="border-white/20 bg-white/15 text-white">{premium.status === "TRIALING" ? "Période offerte" : "Actif"}</Badge> : null}
              </div>
              <p className="mt-2 text-lg font-bold">
                {premium.isPremium
                  ? premium.status === "TRIALING"
                    ? "Période offerte en cours"
                    : "Abonnement actif"
                  : premium.hasUsedTrial
                    ? "Période offerte déjà utilisée"
                    : trialOfferLabel(premium.trialDays)}
              </p>
              <p className="mt-1 text-xs text-brand-100">
                {premium.isPremium
                  ? premium.nextBillingAt
                    ? `Prochaine échéance : ${formatDate(premium.nextBillingAt)}`
                    : `Engagement jusqu'au ${premium.commitmentEndsAt ? formatDate(premium.commitmentEndsAt) : "—"}.`
                  : `Puis ${formatMoney(premium.priceCents)} / mois pendant ${PREMIUM.commitmentMonths} mois.`}
              </p>
              <ButtonLink href={premium.isPremium ? "/compte/abonnement" : "/premium"} variant="outline" size="sm" className="mt-4 border-white/30 bg-white/10 text-white hover:bg-white/20">
                {premium.isPremium ? "Gérer mon abonnement" : "Découvrir Prestige"}
              </ButtonLink>
              {premium.isPremium ? (
                <ButtonLink href="/premium/offres" variant="outline" size="sm" className="mt-4 border-white/30 bg-white/10 text-white hover:bg-white/20">
                  Offres Prestige
                </ButtonLink>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/compte/encheres", icon: Gavel, label: "Mes enchères", value: bidCount, text: "offres placées" },
          { href: "/compte/favoris", icon: Heart, label: "Favoris", value: overview.favorites, text: "annonces suivies" },
          { href: "/compte/notifications", icon: Bell, label: "Notifications", value: overview.unreadNotifications, text: "non lues" },
          { href: "/compte/dons", icon: Heart, label: "Dons", value: formatMoney(overview.donationsCents), text: "enregistrés" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="card flex items-center gap-3 p-4 hover:border-brand-300">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted">
                  {item.value} {item.text}
                </p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-brand-300" />
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Dernières notifications" action={<Link href="/compte/notifications" className="text-sm font-medium text-brand-700 hover:underline">Tout voir</Link>} />
        {notifications.length ? (
          <ul className="divide-y divide-brand-100">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex items-start gap-3 p-4">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-brand-200" : "bg-brand-600"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-muted">{notification.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(notification.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="text-sm text-muted">Aucune notification pour l&apos;instant.</p>
          </CardBody>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/compte/ventes" className="card flex items-center gap-3 p-4 text-sm font-medium hover:border-brand-300">
          <Package className="h-5 w-5 text-brand-600" /> Ventes à expédier
        </Link>
        <Link href="/compte/messages" className="card flex items-center gap-3 p-4 text-sm font-medium hover:border-brand-300">
          <MessageCircle className="h-5 w-5 text-brand-600" /> Messages
        </Link>
        <Link href="/compte/trophees" className="card flex items-center gap-3 p-4 text-sm font-medium hover:border-brand-300">
          <Trophy className="h-5 w-5 text-brand-600" /> Trophées et réductions
        </Link>
      </div>

      <p className="flex items-start gap-2 text-xs leading-5 text-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        Environnement de démonstration : les paiements, virements et étiquettes sont simulés lorsque les prestataires ne sont pas
        configurés. Voir <Link href="/faq" className="link">la FAQ</Link> pour le détail des limites.
      </p>
    </div>
  );
}
