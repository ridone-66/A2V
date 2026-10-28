import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flag, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getConversation, markConversationRead } from "@/lib/services/messaging";
import { formatDateTime } from "@/lib/utils";
import { Avatar, Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { blockUserAction } from "@/app/actions/account";
import { reportMessageAction, sendMessageAction } from "@/app/actions/messaging";
import { SubmitButton } from "@/components/forms/submit-button";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/compte/messages/${id}`);
  const conversation = await getConversation(id, user.id).catch(() => null);
  if (!conversation) notFound();

  await markConversationRead(conversation.id, user.id).catch(() => undefined);
  const other = conversation.participants.find((participant) => participant.userId !== user.id) ?? conversation.participants[0];

  return (
    <div className="space-y-5">
      <Link href="/compte/messages" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Tous mes messages
      </Link>
      <PageHeader
        eyebrow="Conversation"
        title={conversation.subject}
        description={`Avec ${conversation.participants.filter((participant) => participant.userId !== user.id).map((participant) => participant.user.publicName).join(", ") || "A2V"}`}
      />

      {conversation.listing || conversation.order ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          {conversation.listing ? (
            <Link href={`/annonce/${conversation.listing.slug}`} className="link font-medium">Annonce : {conversation.listing.title}</Link>
          ) : null}
          {conversation.order ? (
            <Link href={`/commande/${conversation.order.orderNumber}`} className="link font-medium">Commande : {conversation.order.orderNumber}</Link>
          ) : null}
        </Card>
      ) : null}

      <div className="space-y-3">
        {conversation.messages.map((message) => {
          const mine = message.senderId === user.id;
          return (
            <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "bg-brand-600 text-white" : "border border-brand-100 bg-white"}`}>
                <div className={`flex items-center gap-2 text-[11px] ${mine ? "text-brand-100" : "text-muted"}`}>
                  <span className="font-medium">{mine ? "Vous" : message.sender.publicName}</span>
                  <span>· {formatDateTime(message.createdAt)}</span>
                </div>
                <p className={`mt-1 whitespace-pre-line leading-6 ${mine ? "text-white" : "text-ink"}`}>{message.body}</p>
                {!mine ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer list-none text-[11px] opacity-70 hover:opacity-100">
                      <span className="inline-flex items-center gap-1"><Flag className="h-3 w-3" /> Signaler</span>
                    </summary>
                    <ActionForm action={reportMessageAction} submitLabel="Signaler à la modération" className="mt-2 space-y-2" pendingLabel="Envoi…">
                      <input type="hidden" name="messageId" value={message.id} />
                      <select name="reason" className="input h-9 py-0 text-xs" defaultValue="ABUSIVE" aria-label="Motif du signalement">
                        <option value="ABUSIVE">Propos abusifs</option>
                        <option value="SPAM">Spam</option>
                        <option value="FRAUD">Tentative de fraude</option>
                        <option value="OFF_PLATFORM">Paiement hors plateforme</option>
                        <option value="OTHER">Autre</option>
                      </select>
                      <input name="details" className="input h-9 py-0 text-xs" placeholder="Précisions (facultatif)" maxLength={1000} />
                    </ActionForm>
                  </details>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <Card className="p-4">
        <ActionForm action={sendMessageAction} submitLabel="Envoyer le message" pendingLabel="Envoi…" resetOnSuccess className="space-y-3">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <div>
            <label htmlFor="body" className="label">Votre message</label>
            <textarea id="body" name="body" rows={4} className="input" maxLength={3000} required placeholder="Écrivez votre message…" />
          </div>
          <p className="text-xs text-muted">
            Ne communiquez jamais vos identifiants, numéros de carte ou codes de paiement. A2V ne les demande jamais par message.
          </p>
        </ActionForm>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white p-4">
        <p className="flex items-center gap-2 text-xs text-muted">
          <ShieldAlert className="h-4 w-4 text-brand-600" /> Un problème avec cette conversation ?
        </p>
        {other ? (
          <form action={blockUserAction}>
            <input type="hidden" name="blockedId" value={other.userId} />
            <SubmitButton variant="ghost" size="sm" pendingLabel="…">Bloquer {other.user.publicName}</SubmitButton>
          </form>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Avatar name={other?.user.publicName ?? "A2V"} src={other?.user.profile?.avatarUrl} size={28} />
        <span>Les messages sont conservés pour la sécurité et les litiges. Voir la politique de confidentialité.</span>
      </div>
    </div>
  );
}
