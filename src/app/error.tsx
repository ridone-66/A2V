"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ne jamais journaliser de données personnelles ici : seul le digest est conservé.
    console.error("Erreur d'interface", { digest: error.digest });
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] max-w-2xl flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <AlertTriangle className="h-8 w-8" />
      </span>
      <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-brand-600">Erreur inattendue</p>
      <h1 className="mt-2 text-balance text-3xl font-bold">Une erreur est survenue</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
        La page n&apos;a pas pu être affichée. Vos données enregistrées ne sont pas affectées. Réessayez ; si le problème persiste,
        contactez le support en précisant l&apos;heure et la page concernée.
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-muted">Référence : {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()} type="button">Réessayer</Button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-brand-200 px-5 text-sm font-semibold hover:bg-brand-50">
          Retour à l&apos;accueil
        </Link>
      </div>
      <p className="mt-5 text-xs text-muted">
        En cas d&apos;urgence liée à un paiement, consultez la commande concernée puis <Link href="/contact" className="link">écrivez-nous</Link>.
      </p>
    </div>
  );
}
