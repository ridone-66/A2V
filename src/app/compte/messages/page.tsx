import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getConversationsForUser } from "@/lib/services/messaging";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser("/compte/messages");
  const conversations = await getConversationsForUser(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Messagerie"
        title="Mes messages"
        description="Les échanges restent liés à l'annonce ou à la commande. Ne partagez jamais d'informations bancaires."
      />

      {conversations.length ? (
        <div className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white">
          {conversations.map((conversation) => {
            const other = conversation.otherParticipants[0]?.user;
            return (
              <Link key={conversation.id} href={`/compte/messages/${conversation.id}`} className="flex items-start gap-3 p-4 hover:bg-brand-50/60">
                <Avatar name={other?.publicName ?? "A2V"} src={other?.profile?.avatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{conversation.subject}</p>
                    <span className="text-[11px] text-muted">{formatDateTime(conversation.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {other?.publicName ?? "Conversation A2V"}
                    {conversation.listing ? ` · ${conversation.listing.title}` : ""}
                    {conversation.order ? ` · commande ${conversation.order.orderNumber}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-muted">
                    {conversation.lastMessage ? conversation.lastMessage.body : "Aucun message"}
                  </p>
                </div>
                {conversation.unreadCount > 0 ? <Badge tone="brand">{conversation.unreadCount}</Badge> : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<MessageCircle className="h-8 w-8" />}
          title="Aucun message"
          description="Contactez un vendeur depuis une annonce ou échangez depuis une commande. Vos conversations apparaîtront ici."
        />
      )}

      <p className="text-xs leading-5 text-muted">
        Les messages sont modérés sur signalement. Un comportement abusif peut entraîner la suspension du compte. Les échanges liés
        à une commande doivent rester sur A2V pour conserver une trace en cas de litige.
      </p>
    </div>
  );
}
