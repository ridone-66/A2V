import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeEuro, Boxes, Flag, Gavel, ShoppingCart, Trophy, Users } from "lucide-react";
import { getAdminStats } from "@/lib/services/admin";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();
  const maxGmv = Math.max(1, ...stats.months.map((month) => month.gmvCents));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pilotage"
        title="Tableau de bord"
        description="Vue d'ensemble de la place de marché. Les indicateurs financiers portent sur les ventes finalisées, jamais sur de simples intentions."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Membres actifs" value={stats.users} hint="Comptes non suspendus" icon={<Users className="h-5 w-5" />} />
        <Stat label="Annonces publiées" value={stats.activeListings} hint="Hors brouillons et retirées" icon={<Boxes className="h-5 w-5" />} />
        <Stat label="Enchères en direct" value={stats.liveAuctions} hint="Clôture par le serveur" icon={<Gavel className="h-5 w-5" />} />
        <Stat label="Commandes à payer" value={stats.ordersPending} hint="Paiement non confirmé" tone="warning" icon={<ShoppingCart className="h-5 w-5" />} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Volume finalisé" value={formatMoney(stats.gmvCents)} hint={`${stats.finalizedOrders} vente(s)`} tone="success" />
        <Stat label="Commission acquise" value={formatMoney(stats.commissionCents)} hint="0,5 % sur articles finalisés" tone="success" />
        <Stat label="Dons enregistrés" value={formatMoney(stats.donationsCents)} hint={`${stats.donationsCount} don(s) — espace séparé`} />
        <Stat label="Prestige actifs" value={stats.premiumActive} hint="Essais et abonnements valides" />
      </div>

      {(stats.openReports > 0 || stats.openDisputes > 0) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/admin/signalements" className="card flex items-center gap-3 border-amber-200 p-4 hover:border-amber-400">
            <Flag className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">{stats.openReports} signalement(s) à traiter</p>
              <p className="text-xs text-muted">Annonces signalées par les membres</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-muted" />
          </Link>
          <Link href="/admin/litiges" className="card flex items-center gap-3 border-red-200 p-4 hover:border-red-400">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-semibold">{stats.openDisputes} litige(s) ouvert(s)</p>
              <p className="text-xs text-muted">Versements suspendus jusqu&apos;à décision</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-muted" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader title="Volume finalisé — 6 derniers mois" description="Montants TTC des commandes finalisées, hors dons." />
          <CardBody>
            <div className="flex h-48 items-end gap-3">
              {stats.months.map((month) => (
                <div key={month.key} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] text-muted">{month.gmvCents ? formatMoney(month.gmvCents) : "—"}</span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-brand-700 to-brand-400"
                    style={{ height: `${Math.max(4, (month.gmvCents / maxGmv) * 100)}%` }}
                    title={`${month.label} : ${formatMoney(month.gmvCents)}`}
                  />
                  <span className="text-xs font-medium capitalize text-muted">{month.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Données issues des commandes au statut FINALIZED. En mode simulation, les montants ne correspondent pas à des
              encaissements bancaires réels.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Accès rapides" />
          <CardBody className="space-y-2">
            {[
              { href: "/admin/utilisateurs", label: "Gérer les utilisateurs", icon: Users },
              { href: "/admin/commandes", label: "Suivre les commandes", icon: ShoppingCart },
              { href: "/admin/litiges", label: "Traiter les litiges", icon: BadgeEuro },
              { href: "/admin/dons", label: "Dons et reversements", icon: Trophy },
              { href: "/admin/audit", label: "Consulter l'audit", icon: Flag },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-brand-50">
                  <Icon className="h-4 w-4 text-brand-600" /> {item.label}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-brand-300" />
                </Link>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Dernières commandes"
          action={<ButtonLink href="/admin/commandes" variant="outline" size="sm">Tout voir</ButtonLink>}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Acheteur</th>
                <th className="px-4 py-3">Vendeur</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {stats.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/commande/${order.orderNumber}`} className="link">{order.orderNumber}</Link>
                  </td>
                  <td className="px-4 py-3">{order.buyer.publicName}</td>
                  <td className="px-4 py-3">{order.seller.publicName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(order.buyerTotalCents)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
