import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert, Avatar, Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { adminSetUserRoleAction, adminSetUserStatusAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Fiche utilisateur" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.USERS_READ);
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      _count: { select: { listings: true, ordersBought: true, ordersSold: true, bids: true, donations: true } },
      ordersBought: { orderBy: { createdAt: "desc" }, take: 5, select: { orderNumber: true, status: true, buyerTotalCents: true, createdAt: true } },
      listings: { orderBy: { createdAt: "desc" }, take: 5, select: { title: true, slug: true, status: true, priceCents: true, createdAt: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 5, select: { action: true, createdAt: true } },
    },
  });
  if (!user) notFound();

  const canManage = true;

  return (
    <div className="space-y-5">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Tous les utilisateurs
      </Link>

      <PageHeader
        eyebrow="Fiche membre"
        title={user.publicName}
        description={`${user.email} · inscrit le ${formatDate(user.createdAt)}`}
        action={<Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{user.status}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Rôle" value={user.role} />
        <Stat label="Annonces" value={user._count.listings} />
        <Stat label="Achats / ventes" value={`${user._count.ordersBought} / ${user._count.ordersSold}`} />
        <Stat label="Dons" value={user._count.donations} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Profil" />
            <CardBody className="flex items-start gap-4">
              <Avatar name={user.publicName} src={user.profile?.avatarUrl} size={56} />
              <div className="text-sm">
                <p className="font-semibold">{user.publicName}</p>
                <p className="text-xs text-muted">{user.email}</p>
                <p className="mt-2 text-muted">{user.profile?.bio || "Aucune présentation."}</p>
                <p className="mt-1 text-xs text-muted">
                  {user.profile?.city ? `${user.profile.city} · ` : ""}
                  {user.emailVerifiedAt ? `E-mail vérifié le ${formatDate(user.emailVerifiedAt)}` : "E-mail non vérifié"}
                </p>
                <Link href={`/vendeur/${user.publicName}`} className="link mt-2 inline-block text-xs">Voir la page publique</Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Dernières commandes" />
            <CardBody>
              {user.ordersBought.length ? (
                <ul className="divide-y divide-brand-100 text-sm">
                  {user.ordersBought.map((order) => (
                    <li key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/commande/${order.orderNumber}`} className="link font-mono text-xs">{order.orderNumber}</Link>
                      <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                      <span className="text-xs text-muted">{formatDate(order.createdAt)}</span>
                      <span className="font-semibold">{formatMoney(order.buyerTotalCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Aucune commande.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Dernières annonces" />
            <CardBody>
              {user.listings.length ? (
                <ul className="divide-y divide-brand-100 text-sm">
                  {user.listings.map((listing) => (
                    <li key={listing.slug} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/annonce/${listing.slug}`} className="truncate font-medium hover:text-brand-700">{listing.title}</Link>
                      <Badge tone="neutral">{listing.status}</Badge>
                      <span className="text-xs text-muted">{formatDate(listing.createdAt)}</span>
                      <span className="font-semibold">{formatMoney(listing.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Aucune annonce.</p>}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {canManage ? (
            <>
              <Card>
                <CardHeader title="Statut du compte" description="La suspension révoque toutes les sessions." />
                <CardBody>
                  <ActionForm action={adminSetUserStatusAction} submitLabel={user.status === "ACTIVE" ? "Suspendre le compte" : "Réactiver le compte"} pendingLabel="…">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="status" value={user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                    <p className="text-xs text-muted">
                      Un compte suspendu ne peut plus se connecter ni publier. L&apos;historique des commandes est conservé.
                    </p>
                  </ActionForm>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Rôle et permissions" description="Le rôle détermine les accès à l'administration." />
                <CardBody>
                  <ActionForm action={adminSetUserRoleAction} submitLabel="Enregistrer le rôle" pendingLabel="…">
                    <input type="hidden" name="userId" value={user.id} />
                    <label htmlFor="role" className="label">Rôle</label>
                    <select id="role" name="role" className="input" defaultValue={user.role}>
                      <option value="USER">Membre</option>
                      <option value="MODERATOR">Modération</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                    <Alert tone="warning" className="text-xs">
                      Ne promouvez que des personnes de confiance. Un administrateur peut tout gérer, y compris les paramètres
                      financiers. Cette action est journalisée.
                    </Alert>
                  </ActionForm>
                </CardBody>
              </Card>
            </>
          ) : null}

          <Card>
            <CardHeader title="Dernières actions d'audit" />
            <CardBody>
              {user.auditLogs.length ? (
                <ul className="space-y-1.5 text-xs">
                  {user.auditLogs.map((log, index) => (
                    <li key={`${log.action}-${index}`} className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-muted">{formatDateTime(log.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Aucune action enregistrée.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
