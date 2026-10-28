import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";

/**
 * Stockage d'images.
 * - `local` : développement uniquement (dossier var/uploads, servi via une route
 *   contrôlée). Ne pas utiliser de disque local en production serverless.
 * - `vercel-blob` : stockage objet Vercel Blob, persistant et compatible
 *   serverless. Nécessite BLOB_READ_WRITE_TOKEN.
 * - `s3` : réservé à une intégration S3/R2/Supabase Storage (non activée).
 *
 * Vercel limite le corps des requêtes serverless à 4,5 Mo : la taille maximale
 * d'une image est fixée à 4 Mo pour conserver une marge.
 */
const UPLOAD_DIR = path.join(process.cwd(), "var", "uploads");
const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED = [
  { ext: "jpg", mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "webp", mime: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] },
  { ext: "avif", mime: "image/avif", magic: [0x66, 0x74, 0x79, 0x70] },
] as const;

export type StoredImage = { url: string; mime: string; size: number; storedName: string };

function detectType(buffer: Buffer) {
  return ALLOWED.find((candidate) => candidate.magic.every((byte, index) => buffer[index] === byte));
}

export async function saveImage(file: File): Promise<StoredImage> {
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Fichier invalide.");
  if (file.size <= 0) throw new AppError("VALIDATION", "Fichier vide.");
  if (file.size > MAX_SIZE) throw new AppError("VALIDATION", "Image trop lourde (4 Mo maximum).");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size) throw new AppError("VALIDATION", "Lecture du fichier incomplète.");
  const type = detectType(buffer);
  if (!type) throw new AppError("VALIDATION", "Format non pris en charge (JPG, PNG, WebP, AVIF).");

  // Vérification WebP : signature RIFF....WEBP
  if (type.ext === "webp" && buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new AppError("VALIDATION", "Fichier WebP corrompu.");
  }
  // Vérification AVIF : boîte ftyp + avif/avis
  if (type.ext === "avif" && !["avif", "avis", "mif1"].includes(buffer.subarray(8, 12).toString("ascii"))) {
    throw new AppError("VALIDATION", "Fichier AVIF invalide.");
  }

  const name = `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}.${type.ext}`;

  if (env.STORAGE_DRIVER === "vercel-blob") {
    const hasOidc = Boolean(process.env.BLOB_STORE_ID);
    if (!env.BLOB_READ_WRITE_TOKEN && !hasOidc) {
      throw new AppError(
        "NOT_CONFIGURED",
        "Aucun identifiant Vercel Blob : connectez un store Blob au projet (BLOB_STORE_ID) ou définissez BLOB_READ_WRITE_TOKEN.",
      );
    }
    const blob = await put(`listings/${name}`, buffer, {
      access: "public",
      contentType: type.mime,
      addRandomSuffix: true,
      // Avec un store connecté en OIDC, @vercel/blob utilise BLOB_STORE_ID et
      // VERCEL_OIDC_TOKEN automatiquement. Le token statique reste optionnel.
      ...(env.BLOB_READ_WRITE_TOKEN ? { token: env.BLOB_READ_WRITE_TOKEN } : {}),
    });
    return { url: blob.url, mime: type.mime, size: buffer.length, storedName: blob.pathname };
  }

  if (env.STORAGE_DRIVER === "s3") {
    throw new AppError(
      "NOT_CONFIGURED",
      "Le stockage S3 n'est pas implémenté. Utilisez STORAGE_DRIVER=vercel-blob sur Vercel ou local en développement.",
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buffer, { flag: "wx" });
  return { url: `/api/uploads/${name}`, mime: type.mime, size: buffer.length, storedName: name };
}

export async function readImage(name: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (env.STORAGE_DRIVER !== "local") return null;
  if (!/^[a-z0-9-]+\.(jpg|png|webp|avif)$/i.test(name)) return null;
  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, name));
    const type = detectType(buffer);
    if (!type) return null;
    return { buffer, mime: type.mime };
  } catch {
    return null;
  }
}

export const storageStatus =
  env.STORAGE_DRIVER === "local"
    ? { driver: "local", persistent: false, note: "Développement uniquement — utiliser vercel-blob en production." }
    : env.STORAGE_DRIVER === "vercel-blob"
      ? { driver: "vercel-blob", persistent: true, note: "Vercel Blob (OIDC via BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN)." }
      : { driver: "s3", persistent: false, note: "Adaptateur S3 non implémenté." };
