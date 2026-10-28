import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAdminReports } from "@/lib/services/admin";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ActionForm } from "@/components/forms/action-form";
import { adminResolveReportAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Signalements" };

const STATUS_TONE: Record<string, "warning" | "success" | "neutral"> = {
  OPEN: "warning",
  REVIEWING: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission(PERMISSIONS.REPORTS_MANAGE);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminReports(page);
  const open = items.filter((report) => ["OPEN", "REVIEWING"].includes(report.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Modération"
        title="Signalements d'annonces"
        description={`${total} signalement(s) au total, ${open} à traiter sur cette page. Chaque décision est motivée et journalisée.`}
      />

      {items.length ? (
        <>
          <div className="space-y-3">
            {items.map((report) => (
              <Card key={report.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[report.status] ?? "neutral"}>{report.status}</Badge>
                        <Badge tone="neutral">{report.reason}</Badge>
                        <span className="text-xs text-muted">signalé le {formatDateTime(report.createdAt)}</span>
                      </div>
                      <Link href={`/annonce/${report.listing.slug}`} className="mt-1.5 block truncate font-semibold hover:text-brand-700">
                        {report.listing.title}
                      </Link>
                      <p className="text-xs text-muted">
                        Par {report.reporter.publicName} · annonce {report.listing.status}
                        {report.moderator ? ` · traité par ${report.moderator.publicName}` : ""}
                      </p>
                      {report.details ? <p className="mt-2 rounded-lg bg-brand-50 p-3 text-sm text-muted">{report.details}</p> : null}
                    </div>
                  </div>

                  {["OPEN", "REVIEWING"].includes(report.status) ? (
                    <ActionForm action={adminResolveReportAction} submitLabel="Enregistrer la décision" pendingLabel="…" className="border-t border-brand-100 pt-3">
                      <input type="hidden" name="reportId" value={report.id} />
                      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                        <div>
                          <label htmlFor={`status-${report.id}`} className="label">Décision</label>
                          <select id={`status-${report.id}`} name="status" className="input" defaultValue="RESOLVED">
                            <option value="RESOLVED">Fondé</option>
                            <option value="DISMISSED">Non fondé</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`decision-${report.id}`} className="label">Motivation</label>
                          <input id={`decision-${report.id}`} name="decision" className="input" minLength={5} required placeholder="Motif de la décision" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="takeDown" className="h-4 w-4 accent-brand-600" /> Retirer l&apos;annonce du catalogue
                      </label>
                    </ActionForm>
                  ) : (
                    <p className="border-t border-brand-100 pt-3 text-xs text-muted">Décision enregistrée. Aucune action supplémentaire.</p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} basePath="/admin/signalements" params={{}} />
        </>
      ) : (
        <EmptyState icon={<Flag className="h-8 w-8" />} title="Aucun signalement" description="Les signalements déposés par les membres apparaîtront ici." />
      )}
    </div>
  );
}
