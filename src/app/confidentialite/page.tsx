import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Données collectées par A2V, finalités, durées de conservation, sous-traitants et exercice de vos droits RGPD.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Confidentialité & RGPD"
      description="Quelles données A2V traite, pourquoi, pendant combien de temps, et comment exercer vos droits."
    >
      <LegalSection title="1. Responsable de traitement">
        <p>
          Dans cette démonstration, aucun responsable de traitement réel n&apos;est désigné. En production, indiquez ici
          l&apos;identité et les coordonnées du responsable de traitement ainsi que celles du délégué à la protection des données
          (DPO) s&apos;il est désigné, ou à défaut un point de contact RGPD.
        </p>
        <p>
          Responsable de traitement : [dénomination et adresse de l&apos;éditeur, voir les{" "}
          <Link href="/mentions-legales" className="link">mentions légales</Link>]. Contact RGPD / DPO :{" "}
          <span className="font-mono text-sm">privacy@a2v.example</span> (adresse fictive à remplacer).
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte : nom public, adresse e-mail, mot de passe haché (scrypt, jamais en clair), rôle, statut.</li>
          <li>Profil : biographie, ville, avatar, préférences de notification, choix de visibilité de la localisation.</li>
          <li>Transactions : annonces, offres, commandes, adresses de livraison, montants, statuts, litiges, avis.</li>
          <li>Messages : contenu des échanges avec les autres utilisateurs et avec le support.</li>
          <li>Abonnement : statut Prestige, dates d&apos;essai et de période, référence de prestataire.</li>
          <li>Dons : montant, nom d&apos;affichage choisi, message public facultatif, justificatif interne.</li>
          <li>Technique : adresse IP hachée pour la sécurité et la limitation de débit, sessions, journaux d&apos;audit.</li>
        </ul>
        <p>
          Aucune donnée de carte bancaire n&apos;est collectée ni stockée par A2V : le paiement est délégué au prestataire
          (Stripe en production, simulation en développement).
        </p>
        <p>
          <strong className="text-ink">Caractère obligatoire ou facultatif.</strong> Les données nécessaires à la création du
          compte, à la publication d&apos;une annonce, à une commande, à une enchère ou à la livraison sont obligatoires : sans
          elles, le service correspondant ne peut pas être fourni. Les champs facultatifs (biographie, avatar, message public de
          don, préférences de notification) peuvent rester vides ; refuser les communications marketing n&apos;empêche pas
          d&apos;utiliser le site. Le détail des champs marqués comme facultatifs figure dans les formulaires concernés.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        <ul className="list-disc space-y-1 pl-5">
          <li>Exécution du contrat : création de compte, publication, commandes, enchères, livraison, messages.</li>
          <li>Obligation légale : conservation des pièces comptables, lutte contre la fraude, réponses aux autorités.</li>
          <li>Intérêt légitime : sécurité du service, prévention des abus, amélioration de la modération, journaux d&apos;audit.</li>
          <li>Consentement : communications marketing facultatives, affichage public d&apos;un don. Retrait possible à tout moment.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Durées de conservation">
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte actif : pendant la durée d&apos;utilisation, puis anonymisation après suppression.</li>
          <li>
            Commandes, paiements et pièces comptables : <strong>10 ans</strong> à compter de la clôture de l&apos;exercice, au
            titre des obligations comptables (article L123-22 du code de commerce).
          </li>
          <li>
            Après suppression : anonymisation des données non nécessaires ; conservation des données comptables et de preuve
            pendant les durées légales applicables.
          </li>
          <li>Sessions : expiration après la durée configurée (au plus 30 jours), révocation possible immédiatement.</li>
          <li>Journaux d&apos;audit et de sécurité : durée limitée, cible de 6 à 12 mois selon la politique de production.</li>
          <li>
            Prospection commerciale facultative : 3 ans à compter du dernier contact, puis suppression ou anonymisation, sauf
            opposition antérieure.
          </li>
          <li>Données de paiement : conservées par le prestataire selon ses propres obligations ; A2V ne conserve que les références nécessaires.</li>
        </ul>
        <p>
          Les durées exactes doivent être validées et documentées avant mise en production. Cette démonstration applique une
          suppression ou anonymisation du compte, sans moteur de purge automatique planifié pour toutes les tables. La durée des
          cookies est précisée sur la page <Link href="/cookies" className="link">Cookies et traceurs</Link>.
        </p>
      </LegalSection>

      <LegalSection title="5. Destinataires et sous-traitants">
        <p>
          Les données sont accessibles aux utilisateurs concernés (acheteur, vendeur, modérateurs habilités) dans la limite de
          leurs permissions. Les sous-traitants prévus sont Stripe (paiement), La Poste / Colissimo (livraison, non configuré), un
          fournisseur SMTP (e-mails) et un stockage S3 (images). Chacun doit être encadré par un contrat conforme à l&apos;article 28
          du RGPD avant activation.
        </p>
        <p>
          Aucun transfert hors Union européenne n&apos;est revendiqué. Si un prestataire impose un tel transfert, des garanties
          appropriées doivent être documentées.
        </p>
      </LegalSection>

      <LegalSection title="6. Vos droits">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de
          portabilité. Vous pouvez exercer ces droits depuis votre compte (export et suppression) ou en écrivant à l&apos;adresse
          de contact. Une réponse doit être apportée dans les délais légaux.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL : 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex
          07 — <a href="https://www.cnil.fr" className="link" rel="noreferrer noopener" target="_blank">cnil.fr</a>. En production,
          les procédures internes de réponse aux demandes et de violation de données doivent être documentées.
        </p>
        <p>
          <Link href="/compte/confidentialite" className="link">Gérer mes données depuis mon compte</Link>.
        </p>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <p>
          Les mots de passe sont hachés avec scrypt et un sel aléatoire. Les sessions utilisent des jetons aléatoires stockés
          hachés en base, transmis par cookie HttpOnly. Les mutations sensibles vérifient l&apos;origine de la requête, les rôles
          et les permissions. Les actions d&apos;administration sont journalisées.
        </p>
        <p>
          La limitation de débit est en mémoire : elle protège une instance unique et doit être remplacée par un stockage partagé
          en cas de déploiement multi-instances. Aucun secret n&apos;est exposé côté client.
        </p>
      </LegalSection>

      <LegalSection title="8. Mineurs">
        <p>
          Le service n&apos;est pas destiné aux personnes n&apos;ayant pas la capacité juridique de contracter. En production, une
          vérification d&apos;âge et les mentions relatives aux mineurs doivent être précisées selon le cadre applicable.
        </p>
      </LegalSection>

      <LegalSection title="9. Décisions automatisées et profilage">
        <p>
          A2V ne prend pas de décision entièrement automatisée produisant des effets juridiques sur les utilisateurs. Les
          contrôles de sécurité (limitation de débit, détection d&apos;abus, vérification des permissions) peuvent entraîner un
          blocage temporaire ou une revue manuelle, mais toute décision défavorable significative peut être contestée en
          contactant le support. Aucun profilage publicitaire n&apos;est réalisé par défaut.
        </p>
      </LegalSection>

      <LegalSection title="10. Transferts hors Union européenne">
        <p>
          Aucun transfert hors Union européenne n&apos;est revendiqué dans cette démonstration. Si un prestataire (paiement,
          hébergement, e-mail ou stockage) impose un tel transfert en production, il devra être encadré par les garanties
          appropriées prévues au RGPD (décision d&apos;adéquation, clauses contractuelles types ou mesures supplémentaires) et
          documenté dans cette politique.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
