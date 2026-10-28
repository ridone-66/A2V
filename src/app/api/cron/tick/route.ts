import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runAuctionLifecycle } from "@/lib/services/auctions";
import { finalizeEligibleOrders } from "@/lib/services/orders";
import { processSubscriptionLifecycle } from "@/lib/services/premium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tâche planifiée (cron externe : Vercel Cron, GitHub Actions, cron système).
 * Protégée par CRON_SECRET en en-tête Authorization. Aucune exécution
 * opportuniste depuis une requête utilisateur.
 */
async function run(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const now = new Date();
  try {
    const [auctions, orders, subscriptions] = await Promise.all([
      runAuctionLifecycle(now),
      finalizeEligibleOrders(now),
      processSubscriptionLifecycle(now),
    ]);
    logger.info("Cron A2V exécuté", { auctions, orders, subscriptions });
    return NextResponse.json({ ok: true, at: now.toISOString(), auctions, orders, subscriptions });
  } catch (error) {
    logger.error("Cron A2V en échec", { error: String(error) });
    return NextResponse.json({ ok: false, error: "Exécution partielle ou échouée. Consultez les journaux." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
