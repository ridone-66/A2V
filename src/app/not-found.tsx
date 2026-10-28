import Link from "next/link";
import { Compass, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] max-w-2xl flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Compass className="h-8 w-8" />
      </span>
      <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-brand-600">Erreur 404</p>
      <h1 className="mt-2 text-balance text-3xl font-bold sm:text-4xl">Cette page n&apos;existe pas ou n&apos;est plus disponible</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
        L&apos;annonce a peut-être été vendue, retirée ou réservée aux membres Prestige. Le lien est peut-être incomplet.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/catalogue">
          <Search className="h-4 w-4" /> Explorer le catalogue
        </ButtonLink>
        <ButtonLink href="/" variant="outline">Retour à l&apos;accueil</ButtonLink>
      </div>
      <p className="mt-5 text-xs text-muted">
        Besoin d&apos;aide ? <Link href="/faq" className="link">Consultez la FAQ</Link> ou{" "}
        <Link href="/contact" className="link">contactez-nous</Link>.
      </p>
    </div>
  );
}
