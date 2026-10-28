import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { adminResolveMessageReportAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Messages signalés" };

export default async function AdminMessageReportsPage() {
  await requirePermission(PERMISSIONS.REPORTS_MANAGE);
  const reports = await prisma.messageReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { publicName: true } },
      message: {
        select: {
          body: true,
          createdAt: true,
          sender: { select: { publicName: true } },
          conversation: { select: { id: true, subject: true } },
        },
      },
    },
  });

  const open = reports.filter((report) => report.status === "OPEN").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Modération"
        title="Messages signalés"
        description={`${reports.length} signalement(s), ${open} ouvert(s). La messagerie est modérée sur signalement ; aucune suppression automatique n'est effectuée.`}
      />

      {reports.length ? (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={report.status === "OPEN" ? "warning" : "success"}>{report.status}</Badge>
                  <Badge tone="neutral">{report.reason}</Badge>
                  <span className="text-xs text-muted">
                    par {report.reporter.publicName} le {formatDateTime(report.createdAt)}
                  </span>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
                  <p className="text-xs text-muted">
                    {report.message.sender.publicName} · conversation «{" "}
                    <Link href={`/compte/messages/${report.message.conversation.id}`} className="link">
                      {report.message.conversation.subject}
                    </Link>{" "}
                    » · {formatDateTime(report.message.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm">{report.message.body}</p>
                </div>
                {report.details ? <p className="text-sm text-muted">Précisions : {report.details}</p> : null}

                {report.status === "OPEN" ? (
                  <ActionForm action={adminResolveMessageReportAction} submitLabel="Enregistrer la décision" pendingLabel="…" className="border-t border-brand-100 pt-3">
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
                    <p className="text-xs text-muted">
                      Le signalement est clôturé mais le message reste en base comme preuve. Une suspension de compte se fait
                      depuis la fiche utilisateur.
                    </p>
                  </ActionForm>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<MessageSquareWarning className="h-8 w-8" />}
          title="Aucun message signalé"
          description="Les signalements de messages apparaîtront ici."
        />
      )}
    </div>
  );
}
