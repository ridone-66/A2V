import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/compte/notifications");
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suivi"
        title="Notifications"
        description="Commandes, enchères, trophées et messages. Les notifications de sécurité et de transaction restent liées à votre compte."
        action={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <SubmitButton variant="outline" size="sm" pendingLabel="…">
                <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
              </SubmitButton>
            </form>
          ) : (
            <ButtonLink href="/compte/parametres" variant="outline" size="sm">
              Préférences
            </ButtonLink>
          )
        }
      />

      {unread > 0 ? (
        <p className="text-sm text-muted">
          <Badge tone="brand">{unread}</Badge> notification{unread > 1 ? "s" : ""} non lue{unread > 1 ? "s" : ""}.
        </p>
      ) : null}

      {notifications.length ? (
        <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white">
          {notifications.map((notification) => {
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-brand-200" : "bg-brand-600"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${notification.readAt ? "font-medium text-muted" : "font-semibold text-ink"}`}>
                    {notification.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{notification.body}</p>
                  <p className="mt-1 text-[11px] text-muted">{formatDateTime(notification.createdAt)}</p>
                </div>
              </>
            );
            return (
              <li key={notification.id} className="flex items-start gap-3 p-4">
                {notification.href ? (
                  <Link href={notification.href} className="flex min-w-0 flex-1 items-start gap-3 hover:opacity-90">
                    {content}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
                )}
                {!notification.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                      Marquer lu
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="Aucune notification"
          description="Vous serez prévenu ici des paiements, expéditions, enchères remportées et trophées obtenus."
          action={<ButtonLink href="/catalogue">Explorer le catalogue</ButtonLink>}
        />
      )}

      <Card>
        <CardBody className="text-xs leading-5 text-muted">
          <p>
            Les préférences par type (dans l&apos;application et par e-mail) se règlent dans{" "}
            <Link href="/compte/parametres" className="link">
              les paramètres
            </Link>
            . Sans SMTP configuré, aucun e-mail n&apos;est réellement envoyé : les notifications restent consultables ici.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
