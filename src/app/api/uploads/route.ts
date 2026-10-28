import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { saveImage } from "@/lib/integrations/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Téléversement d'images réservé aux membres connectés. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vous devez être connecté pour téléverser une image." }, { status: 401 });
  }

  const limit = rateLimit(`upload:${user.id}`, 30, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Trop de téléversements. Réessayez dans une heure." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const expected = new URL(request.url).origin;
    if (origin !== expected) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }
    const stored = await saveImage(file);
    return NextResponse.json({ url: stored.url, size: stored.size, mime: stored.mime }, { status: 201 });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Le téléversement a échoué." }, { status: 500 });
  }
}
