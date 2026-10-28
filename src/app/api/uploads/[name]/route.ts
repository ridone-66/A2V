import { readImage } from "@/lib/integrations/storage";

export const runtime = "nodejs";

/** Sert uniquement les images téléversées, avec un type MIME vérifié. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const image = await readImage(name);
  if (!image) {
    return new Response("Image introuvable", { status: 404 });
  }
  return new Response(new Uint8Array(image.buffer), {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.buffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}
