import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { adminCreateCategoryAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Catégories" };

export default async function AdminCategoriesPage() {
  await requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { listings: { where: { deletedAt: null } }, children: true } },
      parent: { select: { name: true } },
    },
  });
  const roots = categories.filter((category) => !category.parentId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Catégories"
        description="L'arborescence structure le catalogue et les filtres. Une catégorie utilisée ne doit pas être supprimée sans migration des annonces."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title={`${categories.length} catégorie(s)`} />
          <CardBody className="space-y-3">
            {roots.map((root) => (
              <div key={root.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2">
                  <p className="font-semibold">{root.name}</p>
                  <p className="text-xs text-muted">
                    {root._count.listings +
                      categories
                        .filter((category) => category.parentId === root.id)
                        .reduce((total, child) => total + child._count.listings, 0)}{" "}
                    annonce(s) · {root._count.children} sous-catégorie(s)
                  </p>
                </div>
                <ul className="mt-1 space-y-1 pl-3 text-sm">
                  {categories.filter((category) => category.parentId === root.id).map((child) => (
                    <li key={child.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-50 py-1.5 last:border-0">
                      <span>{child.name}</span>
                      <span className="text-xs text-muted">{child._count.listings} annonce(s)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Créer une catégorie" />
          <CardBody>
            <ActionForm action={adminCreateCategoryAction} submitLabel="Créer la catégorie" pendingLabel="Création…">
              <div>
                <label htmlFor="name" className="label">Nom</label>
                <input id="name" name="name" className="input" minLength={2} maxLength={80} required placeholder="Instruments de musique" />
              </div>
              <div>
                <label htmlFor="parentId" className="label">Catégorie parente (facultatif)</label>
                <select id="parentId" name="parentId" className="input" defaultValue="">
                  <option value="">Aucune (catégorie racine)</option>
                  {roots.map((root) => (
                    <option key={root.id} value={root.id}>{root.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="icon" className="label">Icône (emoji facultatif)</label>
                <input id="icon" name="icon" className="input" maxLength={8} placeholder="🎸" />
              </div>
              <Alert tone="info" className="text-xs">
                Le slug est généré depuis le nom. Aucune suppression n&apos;est proposée ici pour éviter de casser des annonces
                existantes.
              </Alert>
            </ActionForm>
          </CardBody>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted">
        <Tags className="h-4 w-4" /> Les compteurs incluent tous les statuts d&apos;annonces (hors annonces supprimées),
        brouillons compris. Le total d&apos;une catégorie racine inclut ses sous-catégories.
      </p>
      <div className="flex flex-wrap gap-2">
        {["Repérer les doublons", "Vérifier les catégories vides", "Préparer une fusion"].map((item) => (
          <Badge key={item} tone="neutral">{item} — non automatisé</Badge>
        ))}
      </div>
    </div>
  );
}
