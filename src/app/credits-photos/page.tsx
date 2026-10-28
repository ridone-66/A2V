import type { Metadata } from "next";
import { ExternalLink, ImageIcon } from "lucide-react";
import { DEMO_PHOTO_CREDITS } from "@/lib/demo-photo-credits";
import { LegalPage, LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Crédits photos",
  description:
    "Auteurs, licences et sources des photos d'illustration utilisées dans les annonces de démonstration A2V.",
};

export default function PhotoCreditsPage() {
  return (
    <LegalPage
      title="Crédits photos"
      description="Attribution des photos d'illustration des annonces de démonstration, conformément aux licences Creative Commons et au domaine public."
      updatedAt="28 octobre 2026"
    >
      <LegalSection title="1. Photos des annonces">
        <p>
          Les 26 annonces de démonstration utilisent des <strong>photos d&apos;illustration</strong> importées depuis Wikimedia
          Commons. Elles ne représentent pas les objets réellement vendus : les annonces, vendeurs et prix sont fictifs. Chaque
          photo est recadrée en 1200 × 900 et servie localement depuis <span className="font-mono text-sm">/public/demo</span>.
        </p>
        <p>
          Les licences utilisées sont CC0, domaine public, CC BY ou CC BY-SA. L&apos;auteur, la licence et le lien vers la fiche
          d&apos;origine sont indiqués ci-dessous. Pour toute demande de retrait ou de correction d&apos;attribution, contactez{" "}
          <a href="mailto:support@a2v.example" className="link">support@a2v.example</a>.
        </p>

        <ul className="not-prose mt-4 grid gap-3 sm:grid-cols-2">
          {DEMO_PHOTO_CREDITS.map((credit) => (
            <li key={credit.file} className="rounded-2xl border border-brand-100 bg-white p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <ImageIcon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                {credit.subject}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">{credit.title}</p>
              <p className="mt-1 text-xs text-muted">
                {credit.artist} · <span className="font-medium text-ink">{credit.license}</span>
              </p>
              <a
                href={credit.source}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Voir la source sur Wikimedia Commons
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="2. Autres éléments visuels">
        <p>
          Le logo, les pictogrammes, les illustrations de secours au format SVG et les trophées animés de la page{" "}
          <span className="font-mono text-sm">/trophees</span> ont été créés pour cette démonstration. Ils ne réutilisent pas
          d&apos;œuvre tierce et ne peuvent pas être présentés comme des créations d&apos;un tiers.
        </p>
      </LegalSection>

      <LegalSection title="3. Marques citées">
        <p>
          Les noms de marques présents dans les annonces (Canon, Sony, Nike, Peugeot, Marshall, Le Petit Prince, etc.) sont cités
          à titre descriptif pour désigner les objets de démonstration. Aucun partenariat, parrainage ou authenticité n&apos;est
          revendiqué. Les photos ne doivent pas être interprétées comme une preuve d&apos;origine ou d&apos;authenticité.
        </p>
      </LegalSection>

      <LegalSection title="4. Signaler une erreur d'attribution">
        <p>
          Si vous êtes titulaire de droits sur une image et estimez que son utilisation ou son attribution est incorrecte,
          écrivez à <a href="mailto:support@a2v.example" className="link">support@a2v.example</a> avec le lien de la fiche
          concernée. L&apos;image sera retirée ou l&apos;attribution corrigée après vérification.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
