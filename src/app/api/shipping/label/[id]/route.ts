import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getShipmentForLabel, renderShippingLabelHtml } from "@/lib/services/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Étiquette de livraison. Accessible au vendeur, à l'acheteur et aux
 * administrateurs habilités. En mode simulation, le document porte une mention
 * explicite et ne doit pas servir à une expédition réelle.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Authentification requise.", { status: 401 });
  }
  const { id } = await params;
  const shipment = await getShipmentForLabel(id);
  if (!shipment) {
    return new Response("Étiquette introuvable.", { status: 404 });
  }

  const isParticipant = shipment.order.buyerId === user.id || shipment.order.sellerId === user.id;
  const isAdmin = hasPermission(user.role, PERMISSIONS.ORDERS_MANAGE);
  if (!isParticipant && !isAdmin) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const html = renderShippingLabelHtml(shipment);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
