import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { configStatus, env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sonde de santé : base de données + état des intégrations (sans secret). */
export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      service: "a2v",
      environment: env.NODE_ENV,
      time: new Date().toISOString(),
      database,
      latencyMs: Date.now() - startedAt,
      integrations: configStatus,
      simulation: {
        payments: configStatus.payments === "simulation",
        shipping: configStatus.shipping === "simulation",
        email: configStatus.email === "console",
      },
    },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
