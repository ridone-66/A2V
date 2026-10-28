"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Alert } from "@/components/ui/card";

/**
 * Téléversement d'images vers /api/uploads (stockage local en développement).
 * En production, STORAGE_DRIVER=s3 doit être configuré : le disque local n'est
 * pas fiable sur une plateforme serverless.
 */
export function ImageUploader({
  name = "images",
  initial = [],
  max = 8,
}: {
  name?: string;
  initial?: string[];
  max?: number;
}) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, max - urls.length)) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/uploads", { method: "POST", body });
        const payload = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? "Téléversement impossible.");
        }
        setUrls((current) => [...current, payload.url!].slice(0, max));
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Téléversement impossible.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {urls.map((url) => (
        <input key={url} type="hidden" name={name} value={url} />
      ))}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {urls.map((url) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Photo de l'annonce" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setUrls((current) => current.filter((candidate) => candidate !== url))}
              className="absolute right-1.5 top-1.5 rounded-full bg-white/95 p-1 text-danger shadow-sm"
              aria-label="Retirer cette photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {urls.length < max ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 text-brand-700 hover:border-brand-400 hover:bg-brand-50"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-xs font-medium">{uploading ? "Envoi…" : "Ajouter"}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
      />
      <p className="text-xs text-muted">
        JPG, PNG, WebP ou AVIF — 4 Mo maximum par photo, {max} photos maximum. La première photo sert de vignette.
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
