import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Printer,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getOrderByNumberForUser } from "@/lib/services/orders";
import { paymentsSimulationEnabled, shippingSimulation, stripeEnabled } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, SHIPMENT_STATUS_LABELS, FINALIZATION_DELAY_DAYS } from "@/lib/config";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  addReviewAction,
  cancelOrderAction,
  confirmReceptionAction,
  markPreparingAction,
  openDisputeAction,
  payOrderAction,
} from "@/app/actions/orders";
import { createShippingLabelAction } from "@/app/actions/shipping";
import { sendOrderMessageAction } from "@/app/actions/messaging";

export const metadata: Metadata = { title: "Détail de la commande" };

const TIMELINE = ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "FINALIZED"] as const;

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const user = await requireUser(`/commande/${orderNumber}`);
  const order = await getOrderByNumberForUser(orderNumber, user.id).catch(() => null);
  if (!order) notFound();

  const isBuyer = order.buyerId === user.id;
  const isSeller = order.sellerId === user.id;
  const activeDispute = order.disputes.find((dispute) => ["OPEN", "UNDER_REVIEW"].includes(dispute.status));
  const timelineIndex = TIMELINE.indexOf(order.status as (typeof TIMELINE)[number]);
  const terminal = ["CANCELLED", "REFUNDED"].includes(order.status);

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs
        items={[
          { label: isBuyer ? "Mes achats" : "Mes ventes", href: isBuyer ? "/compte/achats" : "/compte/ventes" },
          { label: order.orderNumber },
        ]}
      />
      <PageHeader
        eyebrow={`Commande ${order.orderNumber}`}
        title={isBuyer ? "Votre commande" : "Vente à expédier"}
        description={`Passée le ${formatDateTime(order.createdAt)} · ${isBuyer ? `Vendeur : ${order.seller.publicName}` : `Acheteur : ${order.buyer.publicName}`}`}
        action={<StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} />}
      />

      {paymentsSimulationEnabled && order.status === "PENDING_PAYMENT" ? (
        <Alert tone="warning" title="Paiement simulé" className="mb-5">
          Cet environnement de démonstration n&apos;encaisse aucun argent réel. Le bouton de paiement enregistre un paiement
          simulé, clairement identifié comme tel.
        </Alert>
      ) : null}

      {terminal ? (
        <Alert tone="danger" title={order.status === "REFUNDED" ? "Commande remboursée" : "Commande annulée"} className="mb-5">
          Cette commande n&apos;est plus active. Les montants ci-dessous reflètent l&apos;état enregistré, pas un virement bancaire.
        </Alert>
      ) : (
        <Card className="mb-6 overflow-hidden">
          <CardBody>
            <div className="hidden items-center justify-between gap-1 sm:flex">
              {TIMELINE.map((step, index) => {
                const reached = timelineIndex >= index;
                return (
                  <div key={step} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          reached ? "bg-brand-600 text-white" : "bg-brand-50 text-muted"
                        }`}
                      >
                        {reached ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </span>
                      <span className={`mt-1.5 text-center text-[10px] font-medium ${reached ? "text-ink" : "text-muted"}`}>
                        {ORDER_STATUS_LABELS[step]}
                      </span>
                    </div>
                    {index < TIMELINE.length - 1 ? (
                      <span className={`mx-1 h-0.5 flex-1 ${timelineIndex > index ? "bg-brand-500" : "bg-brand-100"}`} />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="text-sm sm:hidden">
              Statut actuel : <strong>{ORDER_STATUS_LABELS[order.status]}</strong>
            </p>
            <p className="mt-3 text-xs leading-5 text-muted">
              {order.status === "DELIVERED"
                ? `La vente sera finalisée automatiquement ${FINALIZATION_DELAY_DAYS} jours après la livraison, sauf litige ouvert.`
                : order.status === "FINALIZED"
                  ? "Vente finalisée : la commission est acquise et les trophées éventuels ont été attribués."
                  : "Le vendeur est payé après la livraison et la période de protection."}
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Article" description={order.items[0]?.titleSnapshot ?? order.listing.title} />
            <CardBody className="space-y-4">
              <div className="flex gap-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                  {order.listing.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.listing.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🛍️</div>
                  )}
                </div>
                <div className="min-w-0">
                  <Link href={`/annonce/${order.listing.slug}`} className="font-semibold hover:text-brand-700">
                    {order.items[0]?.titleSnapshot ?? order.listing.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">Quantité 1</p>
                  {order.auctionWinner ? <Badge tone="brand" className="mt-2">Enchère remportée</Badge> : null}
                  {order.buyerNote ? <p className="mt-2 text-xs text-muted">Note de l&apos;acheteur : {order.buyerNote}</p> : null}
                </div>
              </div>

              <dl className="space-y-2 border-t border-brand-100 pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Prix de l&apos;article</dt>
                  <dd className="font-medium">{formatMoney(order.itemPriceCents)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Livraison ({order.shippingMethod ?? "—"})</dt>
                  <dd className="font-medium">{order.shippingCents === 0 ? "Incluse" : formatMoney(order.shippingCents)}</dd>
                </div>
                {order.discountCents > 0 ? (
                  <div className="flex justify-between gap-3 text-brand-700">
                    <dt>Réduction ({order.discountSource ?? "avantage"})</dt>
                    <dd className="font-medium">− {formatMoney(order.discountCents)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-t border-brand-100 pt-2 text-base font-bold">
                  <dt>Total payé par l&apos;acheteur</dt>
                  <dd>{formatMoney(order.buyerTotalCents)}</dd>
                </div>
                {isSeller ? (
                  <>
                    <div className="flex justify-between gap-3 text-xs text-muted">
                      <dt>Commission A2V ({(order.commissionRateBps / 100).toFixed(2)} %)</dt>
                      <dd>− {formatMoney(order.commissionCents)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-sm font-semibold">
                      <dt>Votre versement vendeur</dt>
                      <dd>{formatMoney(order.sellerPayoutCents)}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
              {isSeller ? (
                <p className="text-xs text-muted">
                  Le versement est indiqué comme dû après finalisation. En mode simulation, aucun transfert bancaire n&apos;est
                  effectué. Un compte Stripe Connect doit être configuré en production.
                </p>
              ) : null}
            </CardBody>
          </Card>

          {order.shipment ? (
            <Card>
              <CardHeader
                title="Livraison"
                description={`${order.shipment.carrier} · ${order.shipment.service}`}
                action={<StatusBadge status={order.shipment.status} label={SHIPMENT_STATUS_LABELS[order.shipment.status] ?? order.shipment.status} />}
              />
              <CardBody>
                {order.shipment.label?.isSimulated ? (
                  <Alert tone="warning" title="Étiquette de simulation" className="mb-4">
                    Le numéro de suivi commence par « SIM » et aucune remise à La Poste n&apos;a eu lieu.
                  </Alert>
                ) : null}
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Transporteur</dt>
                    <dd className="font-medium">{order.shipment.carrier}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Suivi</dt>
                    <dd className="font-mono text-xs font-medium">{order.shipment.trackingNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Adresse</dt>
                    <dd className="font-medium">
                      {order.shippingAddress
                        ? `${order.shippingAddress.fullName}, ${order.shippingAddress.line1}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city}`
                        : "Non renseignée"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Dernière étape</dt>
                    <dd className="font-medium">
                      {order.shipment.events[0]
                        ? `${SHIPMENT_STATUS_LABELS[order.shipment.events[0].status] ?? order.shipment.events[0].status} — ${formatDateTime(order.shipment.events[0].occurredAt)}`
                        : "Aucun événement"}
                    </dd>
                  </div>
                </dl>
                {order.shipment.label ? (
                  <ButtonLink href={`/api/shipping/label/${order.shipment.id}`} variant="outline" size="sm" className="mt-4" target="_blank">
                    <Printer className="h-4 w-4" /> Ouvrir l&apos;étiquette
                  </ButtonLink>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {activeDispute ? (
            <Alert tone="danger" title="Litige en cours">
              Motif : {activeDispute.reason}. La finalisation et le versement sont suspendus jusqu&apos;à la décision de l&apos;équipe
              A2V.
            </Alert>
          ) : null}

          <Card>
            <CardHeader title="Échanger avec l'autre partie" description="Les messages restent liés à cette commande." />
            <CardBody>
              <ActionForm action={sendOrderMessageAction} submitLabel="Envoyer le message" className="space-y-3">
                <input type="hidden" name="orderId" value={order.id} />
                <textarea name="body" rows={3} className="input" placeholder="Bonjour, où en est l'expédition ?" maxLength={3000} />
              </ActionForm>
              <ButtonLink href="/compte/messages" variant="ghost" size="sm" className="mt-2">
                <MessageCircle className="h-4 w-4" /> Tous mes messages
              </ButtonLink>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-5">
          {order.status === "PENDING_PAYMENT" && isBuyer ? (
            <Card>
              <CardHeader title="Paiement en attente" description={`Montant dû : ${formatMoney(order.buyerTotalCents)}`} />
              <CardBody>
                <ActionForm action={payOrderAction} submitLabel={`Payer ${formatMoney(order.buyerTotalCents)}`} pendingLabel="Paiement…">
                  <input type="hidden" name="orderNumber" value={order.orderNumber} />
                  <p className="text-xs leading-5 text-muted">
                    {stripeEnabled && !paymentsSimulationEnabled
                      ? "Vous serez redirigé vers Stripe Checkout. Aucune carte n'est stockée par A2V."
                      : "En mode démonstration, le paiement est simulé et clairement identifié. Aucun prélèvement réel."}
                  </p>
                </ActionForm>
                <form action={cancelOrderAction} className="mt-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="reason" value="Annulation par l'acheteur avant paiement" />
                  <SubmitButton variant="ghost" size="sm" pendingLabel="Annulation…">Annuler la commande</SubmitButton>
                </form>
              </CardBody>
            </Card>
          ) : null}

          {isSeller && ["PAID", "PREPARING"].includes(order.status) ? (
            <Card>
              <CardHeader title="Expédition" description="Préparez et expédiez le colis." />
              <CardBody className="space-y-3">
                {order.status === "PAID" ? (
                  <form action={markPreparingAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <SubmitButton variant="outline" size="sm" pendingLabel="Mise à jour…">
                      Marquer en préparation
                    </SubmitButton>
                  </form>
                ) : null}
                {!order.shipment?.label ? (
                  <ActionForm action={createShippingLabelAction} submitLabel="Générer l'étiquette" className="space-y-3" pendingLabel="Génération…">
                    <input type="hidden" name="orderId" value={order.id} />
                    <div>
                      <label htmlFor="weightGrams" className="label">Poids du colis (g)</label>
                      <input id="weightGrams" name="weightGrams" type="number" min={1} defaultValue={1000} className="input" />
                    </div>
                    {shippingSimulation ? (
                      <p className="text-xs text-amber-700">
                        Mode simulation : l&apos;étiquette sera fictive et marquée comme telle.
                      </p>
                    ) : null}
                  </ActionForm>
                ) : (
                  <ButtonLink href={`/api/shipping/label/${order.shipment.id}`} variant="outline" size="sm" target="_blank">
                    <Printer className="h-4 w-4" /> Imprimer l&apos;étiquette
                  </ButtonLink>
                )}
                <ButtonLink href="/compte/livraisons" variant="ghost" size="sm">
                  <Truck className="h-4 w-4" /> Suivi des livraisons
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}

          {isBuyer && ["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(order.status) ? (
            <Card>
              <CardHeader title="Réception" description="Confirmez lorsque le colis est bien arrivé et conforme." />
              <CardBody>
                <ActionForm action={confirmReceptionAction} submitLabel="Confirmer la réception" pendingLabel="Confirmation…">
                  <input type="hidden" name="orderId" value={order.id} />
                  <p className="text-xs leading-5 text-muted">
                    La vente sera finalisée immédiatement si aucun litige n&apos;est ouvert. Les trophées éventuels sont attribués à
                    ce moment-là.
                  </p>
                </ActionForm>
                {!activeDispute ? (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-danger">
                      <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Ouvrir un litige</span>
                    </summary>
                    <ActionForm action={openDisputeAction} submitLabel="Envoyer le litige" className="mt-3 space-y-3" pendingLabel="Envoi…">
                      <input type="hidden" name="orderId" value={order.id} />
                      <div>
                        <label htmlFor="reason" className="label">Motif</label>
                        <input id="reason" name="reason" className="input" maxLength={120} placeholder="Article non conforme" />
                      </div>
                      <div>
                        <label htmlFor="description" className="label">Description</label>
                        <textarea id="description" name="description" rows={4} className="input" maxLength={3000} />
                      </div>
                      <p className="text-xs text-muted">Le versement du vendeur est suspendu pendant l&apos;examen.</p>
                    </ActionForm>
                  </details>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {isBuyer && order.status === "FINALIZED" && !order.review ? (
            <Card>
              <CardHeader title="Évaluer la transaction" description="Votre avis aide la communauté." />
              <CardBody>
                <ActionForm action={addReviewAction} submitLabel="Publier mon avis" className="space-y-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <div>
                    <label htmlFor="rating" className="label">Note</label>
                    <select id="rating" name="rating" className="input" defaultValue="5">
                      <option value="5">5 — Excellent</option>
                      <option value="4">4 — Très bien</option>
                      <option value="3">3 — Correct</option>
                      <option value="2">2 — Décevant</option>
                      <option value="1">1 — Problématique</option>
                    </select>
                  </div>
                  <textarea name="comment" rows={3} className="input" placeholder="Comment s'est passée la transaction ?" maxLength={1000} />
                  <p className="flex items-center gap-1 text-xs text-muted"><Star className="h-3.5 w-3.5" /> Un seul avis par commande.</p>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Parties" />
            <CardBody className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted">Acheteur</p>
                <p className="font-medium">{order.buyer.publicName}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Vendeur</p>
                <p className="font-medium">{order.seller.publicName}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Adresse de livraison</p>
                <p className="font-medium">
                  {order.shippingAddress
                    ? `${order.shippingAddress.fullName}, ${order.shippingAddress.line1}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Paiement</p>
                <p className="font-medium">
                  {order.payments[0]
                    ? `${order.payments[0].provider === "SIMULATED" ? "Simulation" : order.payments[0].provider} · ${order.payments[0].status}`
                    : "Aucun paiement"}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-xs leading-5 text-muted">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> Protection A2V
              </p>
              <p className="mt-2">
                Conservez les échanges sur A2V. Un paiement hors plateforme ne bénéficie d&apos;aucune protection. Les montants
                affichés « payés » proviennent de paiements enregistrés ; ils ne constituent pas une preuve de virement au vendeur
                avant finalisation.
              </p>
              {order.paidAt ? <p className="mt-2">Payée le {formatDate(order.paidAt)}.</p> : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
