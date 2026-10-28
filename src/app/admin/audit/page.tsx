import type { Metadata } from "next";
import { FileClock } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAdminAuditLogs } from "@/lib/services/admin";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Journal d'audit" };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission(PERMISSIONS.AUDIT_READ);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminAuditLogs(page);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pilotage"
        title="Journal d'audit"
        description={`${total} action(s) journalisée(s). Les entrées ne sont pas modifiables depuis l'interface.`}
      />

      {items.length ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
            <table className="min-w-full divide-y divide-brand-100 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Acteur</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Cible</th>
                  <th className="px-4 py-3">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {items.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 text-xs">
                      {log.actor ? (
                        <>
                          <span className="font-medium">{log.actor.publicName}</span>
                          <span className="block text-muted">{log.actor.email}</span>
                        </>
                      ) : (
                        <span className="text-muted">Système</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {log.targetType ?? "—"}
                      {log.targetId ? <span className="block break-all font-mono text-[10px]">{log.targetId}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <code className="block max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted">
                        {JSON.stringify(log.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} basePath="/admin/audit" params={{}} />
        </>
      ) : (
        <EmptyState icon={<FileClock className="h-8 w-8" />} title="Aucune action journalisée" description="Les actions sensibles apparaîtront ici." />
      )}
    </div>
  );
}
