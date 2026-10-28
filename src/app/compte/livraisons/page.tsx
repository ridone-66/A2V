import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Package, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { shippingSimulation } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/utils";
import { SHIPMENT_STATUS_LABELS } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { advanceShipmentAction } from "@/app/actions/shipping";

export const metadata: Metadata = { title: "Livraisons" };

export default async function DeliveriesPage() {
  const user = await requireUser("/compte/livraisons");
  const shipments = await prisma.shipment.findMany({
    where: { order: { OR: [{ buyerId: user.id }, { sellerId: user.id }] } },
    orderBy: { updatedAt: "desc" },
    include: {
      label: true,
      events: { orderBy: { occurredAt: "desc" }, take: 5 },
      order: {
        select: {
          id: true,
          orderNumber: true,
          buyerId: true,
          sellerId: true,
          status: true,
          listing: { select: { title: true, slug: true } },
          buyer: { select: { publicName: true } },
          seller: { select: { publicName: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suivi"
        title="Livraisons"
        description="Étiquettes, numéros de suivi et historique d'expédition de vos achats et ventes."
        action={<ButtonLink href="/compte/ventes" variant="outline" size="sm">Ventes à expédier</ButtonLink>}
      />

      {shippingSimulation ? (
        <Alert tone="warning" title="Suivi simulé">
          L&apos;intégration La Poste / Colissimo n&apos;est pas configurée. Les numéros de suivi et les étapes affichés sont
          fictifs, marqués comme simulation, et ne doivent pas être utilisés pour une expédition réelle.
        </Alert>
      ) : null}

      {shipments.length ? (
        <div className="space-y-3">
          {shipments.map((shipment) => {
            const isSeller = shipment.order.sellerId === user.id;
            const isSimulated = shipment.label?.isSimulated ?? true;
            return (
              <Card key={shipment.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={shipment.status === "DELIVERED" ? "success" : "brand"}>
                          {SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status}
                        </Badge>
                        {isSimulated ? <Badge tone="warning">Simulation</Badge> : <Badge tone="neutral">Transporteur</Badge>}
                        <span className="text-xs text-muted">{isSeller ? "Vente" : "Achat"}</span>
                      </div>
                      <Link
                        href={`/commande/${shipment.order.orderNumber}`}
                        className="mt-1.5 block truncate font-semibold hover:text-brand-700"
                      >
                        {shipment.order.listing.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {isSeller
                          ? `Acheteur : ${shipment.order.buyer.publicName}`
                          : `Vendeur : ${shipment.order.seller.publicName}`}{" "}
                        · {shipment.order.orderNumber}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted">
                      <p>Service : {shipment.service}</p>
                      <p>Créée le {formatDate(shipment.createdAt)}</p>
                      {shipment.trackingNumber ? (
                        <p className="mt-1 font-mono text-[11px] text-ink">
                          {shipment.trackingNumber}
                          {isSimulated ? " (fictif)" : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {shipment.events.length ? (
                    <ol className="space-y-1.5 border-l-2 border-brand-100 pl-4 text-xs">
                      {shipment.events.map((event) => (
                        <li key={event.id}>
                          <span className="font-semibold text-ink">
                            {SHIPMENT_STATUS_LABELS[event.status] ?? event.status}
                          </span>{" "}
                          <span className="text-muted">· {formatDateTime(event.occurredAt)}</span>
                          <span className="block text-muted">{event.message}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted">Aucun événement de suivi enregistré.</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <ButtonLink href={`/commande/${shipment.order.orderNumber}`} variant="outline" size="sm">
                      Voir la commande
                    </ButtonLink>
                    {shipment.trackingUrl ? (
                      <a
                        href={shipment.trackingUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                      >
                        Suivi transporteur <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {isSeller && shippingSimulation && shipment.status !== "DELIVERED" ? (
                      <ActionForm action={advanceShipmentAction} submitLabel="Simuler l'étape suivante" pendingLabel="Mise à jour…" className="w-full sm:w-auto">
                        <input type="hidden" name="shipmentId" value={shipment.id} />
                      </ActionForm>
                    ) : null}
                    {!isSeller && shipment.status !== "DELIVERED" && shipment.order.status === "SHIPPED" ? (
                      <ButtonLink href={`/commande/${shipment.order.orderNumber}`} size="sm">
                        Confirmer la réception
                      </ButtonLink>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Truck className="h-8 w-8" />}
          title="Aucune livraison"
          description="Les expéditions liées à vos commandes apparaîtront ici dès qu'une étiquette est créée."
          action={<ButtonLink href="/catalogue">Explorer le catalogue</ButtonLink>}
        />
      )}

      <Card>
        <CardBody className="flex items-start gap-2 text-xs leading-5 text-muted">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p>
            Les frais de livraison sont payés par l&apos;acheteur et affichés avant le paiement. Ils ne sont pas soumis à la
            commission de 0,5 %. Un litige suspend la finalisation du versement vendeur.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
