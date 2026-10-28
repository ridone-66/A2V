import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getUserTransactions } from "@/lib/services/users";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { Alert, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Transactions" };

const EVENT_LABELS: Record<string, string> = {
  PAYMENT_SUCCEEDED: "Paiement encaissé",
  PAYMENT_FAILED: "Paiement échoué",
  PAYMENT_REFUNDED: "Paiement remboursé",
  COMMISSION_RECORDED: "Commission enregistrée",
  PAYOUT_SCHEDULED: "Versement planifié",
  PAYOUT_SENT: "Versement envoyé",
  ORDER_FINALIZED: "Vente finalisée",
  ORDER_CANCELLED: "Commande annulée",
  DISCOUNT_APPLIED: "Réduction appliquée",
  DONATION_RECEIVED: "Don enregistré",
  SHIPPING_PURCHASED: "Frais de livraison",
};

export default async function TransactionsPage() {
  const user = await requireUser("/compte/transactions");
  const events = await getUserTransactions(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suivi"
        title="Transactions"
        description="Journal des paiements, commissions, remboursements et versements liés à votre compte. Les montants sont en euros, TVA incluse le cas échéant."
      />

      <Alert tone="info" title="Lecture comptable, pas une preuve de virement">
        Un paiement « encaissé » est un paiement enregistré par la plateforme. Il ne prouve pas qu&apos;un virement bancaire a été
        reçu par le vendeur. En mode simulation, aucun mouvement d&apos;argent réel n&apos;a lieu.
      </Alert>

      {events.length ? (
        <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Historique des transactions du compte</caption>
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">Événement</th>
                <th scope="col" className="px-4 py-3">Commande</th>
                <th scope="col" className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(event.createdAt)}</td>
                  <td className="px-4 py-3">{EVENT_LABELS[event.type] ?? event.type}</td>
                  <td className="px-4 py-3 text-xs">
                    {event.order ? (
                      <Link href={`/commande/${event.order.orderNumber}`} className="link font-mono">
                        {event.order.orderNumber}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {event.amountCents === null ? "—" : formatMoney(event.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<ReceiptText className="h-8 w-8" />}
          title="Aucune transaction"
          description="Vos paiements, commissions et remboursements apparaîtront ici au fil de vos commandes."
        />
      )}

      <Card>
        <CardBody className="space-y-2 text-xs leading-5 text-muted">
          <p className="font-semibold text-ink">Commission A2V</p>
          <p>
            0,5 % du prix final de l&apos;article, hors frais de livraison, retenue sur le versement vendeur. La publication reste
            gratuite et aucun abonnement n&apos;est imposé. Les dons sont suivis séparément et ne sont jamais mélangés aux ventes.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
