import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserRound, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAdminUsers } from "@/lib/services/admin";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/card";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.USERS_READ);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminUsers(params.q, page);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Communauté"
        title="Utilisateurs"
        description={`${total} compte(s). La suspension révoque immédiatement les sessions ; les changements de rôle sont journalisés.`}
      />

      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3" role="search">
            <div className="min-w-0 flex-1">
              <label htmlFor="q" className="label">Rechercher</label>
              <input id="q" name="q" className="input" defaultValue={params.q ?? ""} placeholder="Nom public ou adresse e-mail" />
            </div>
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
              <Search className="h-4 w-4" /> Rechercher
            </button>
            {params.q ? <Link href="/admin/utilisateurs" className="text-sm text-muted hover:underline">Réinitialiser</Link> : null}
          </form>
        </CardBody>
      </Card>

      {items.length ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
            <table className="min-w-full divide-y divide-brand-100 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Membre</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Activité</th>
                  <th className="px-4 py-3">Inscription</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {items.map((user) => (
                  <tr key={user.id} className="hover:bg-brand-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{user.publicName}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                      {user.profile?.city ? <p className="text-[11px] text-muted">{user.profile.city}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.role === "ADMIN" ? "brand" : user.role === "MODERATOR" ? "info" : "neutral"}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "danger" : "neutral"}>{user.status}</Badge>
                      {user.deletedAt ? <p className="mt-1 text-[11px] text-muted">Compte supprimé</p> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {user._count.listings} annonce(s) · {user._count.ordersBought} achat(s) · {user._count.ordersSold} vente(s)
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/utilisateurs/${user.id}`} className="link text-sm font-medium">Gérer</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} basePath="/admin/utilisateurs" params={{ q: params.q }} />
        </>
      ) : (
        <EmptyState icon={<Users className="h-8 w-8" />} title="Aucun utilisateur trouvé" description="Modifiez votre recherche." />
      )}

      <p className="flex items-center gap-2 text-xs text-muted">
        <UserRound className="h-4 w-4" />
        Les administrateurs ne peuvent ni suspendre leur propre compte ni modifier leur propre rôle.
      </p>
    </div>
  );
}
