import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Cookies et traceurs",
  description:
    "Cookies utilisés par A2V, finalités, durées de conservation et règles de consentement applicables (CNIL, article 82 de la loi Informatique et Libertés).",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies et traceurs"
      description="A2V utilise uniquement un cookie de session indispensable. Aucun traceur publicitaire, analytics tiers ou réseau social n'est déposé par défaut."
      updatedAt="28 octobre 2026"
    >
      <LegalSection title="1. Cookie de session">
        <p>
          Un cookie nommé <code className="rounded bg-brand-50 px-1.5 py-0.5 text-sm">a2v_session</code> est déposé lors de la
          connexion. Il contient un jeton aléatoire, est marqué <strong>HttpOnly</strong>, <strong>SameSite=Lax</strong> et{" "}
          <strong>Secure</strong> en production (HTTPS). Il sert uniquement à maintenir votre session authentifiée et à protéger
          les formulaires contre les requêtes d&apos;origine étrangère.
        </p>

        <div className="overflow-x-auto rounded-xl border border-brand-100">
          <table className="min-w-full divide-y divide-brand-100 text-sm">
            <thead className="bg-brand-50/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Nom</th>
                <th scope="col" className="px-4 py-3">Finalité</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Durée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              <tr>
                <td className="px-4 py-3 font-mono text-xs">a2v_session</td>
                <td className="px-4 py-3">Authentification, sécurité des formulaires (CSRF), maintien de la session.</td>
                <td className="px-4 py-3">Strictement nécessaire</td>
                <td className="px-4 py-3">Session, ou au plus 30 jours selon la configuration</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          Ce cookie est strictement nécessaire au fonctionnement du service : il ne peut pas être désactivé sans empêcher la
          connexion. Il ne nécessite donc pas de consentement préalable, conformément à la réglementation applicable.
        </p>
      </LegalSection>

      <LegalSection title="2. Autres traceurs et stockage local">
        <p>
          A2V n&apos;intègre pas, par défaut, de mesure d&apos;audience tierce, de pixel publicitaire, de régie, de bouton social
          ou de traceur de reciblage. Le stockage local du navigateur n&apos;est pas utilisé pour suivre votre navigation.
          Aucun consentement n&apos;est donc demandé pour des traceurs non essentiels, car il n&apos;y en a pas.
        </p>
        <p>
          Si un outil de mesure d&apos;audience ou un traceur marketing est ajouté en production, un bandeau de consentement
          conforme doit être mis en place avant tout dépôt, avec une possibilité de refuser aussi facilement que d&apos;accepter,
          une finalité claire par catégorie et un retrait du consentement à tout moment.
        </p>
      </LegalSection>

      <LegalSection title="3. Cookies de prestataires">
        <p>
          En production, Stripe peut déposer ses propres cookies lors du parcours de paiement sur son domaine. Ces cookies sont
          nécessaires à la sécurité du paiement et relèvent de la politique de confidentialité de Stripe. La Poste / Colissimo
          n&apos;est pas intégrée par défaut ; si un suivi externe est ajouté, ses traceurs éventuels devront être documentés.
        </p>
      </LegalSection>

      <LegalSection title="4. Consentement et durée">
        <p>
          Les traceurs non essentiels, s&apos;ils sont ajoutés, ne doivent être déposés qu&apos;après un consentement libre,
          spécifique, éclairé et univoque. Le refus doit être aussi simple que l&apos;acceptation. Le consentement est conservé
          pendant une durée maximale de <strong>13 mois</strong> et doit pouvoir être retiré à tout moment. Les cookies
          persistants ne doivent pas dépasser 13 mois.
        </p>
      </LegalSection>

      <LegalSection title="5. Gérer vos préférences">
        <p>
          Vous pouvez supprimer ou bloquer les cookies depuis les réglages de votre navigateur. Bloquer le cookie de session
          empêche la connexion. La déconnexion révoque la session côté serveur. Pour exercer vos droits RGPD, consultez la{" "}
          <Link href="/confidentialite" className="link">politique de confidentialité</Link>.
        </p>
        <p>
          Pour toute question : <Link href="/contact" className="link">contact</Link>. Vous pouvez également consulter les
          recommandations de la CNIL sur les cookies et autres traceurs :{" "}
          <a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs" className="link" rel="noreferrer noopener" target="_blank">
            cnil.fr/fr/cookies-et-autres-traceurs
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
