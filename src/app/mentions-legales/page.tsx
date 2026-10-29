import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { PREMIUM, trialOfferLabel } from "@/lib/config";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales A2V : éditeur, hébergeur, propriété intellectuelle, données personnelles, cookies, résiliation en ligne, signalement et médiation.",
};

/**
 * Modèle de mentions légales conforme aux informations attendues par la
 * loi pour la confiance dans l'économie numérique (LCEN) et le RGPD.
 *
 * Les informations entre crochets sont volontairement non renseignées :
 * l'éditeur de cette démonstration est fictif. Elles doivent être complétées
 * et validées juridiquement avant toute mise en production.
 */
export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      description="Identification de l'éditeur et de l'hébergeur, propriété intellectuelle, données personnelles, résiliation et voies de recours."
      updatedAt="28 octobre 2026"
    >
      <LegalSection title="1. Éditeur du site">
        <p>
          Le site <strong>A2V</strong> est un projet de démonstration technique. Aucune activité commerciale réelle n&apos;est
          exercée dans cette version et l&apos;éditeur réel n&apos;est pas encore déclaré. Les champs entre crochets doivent être
          renseignés avant toute mise en ligne, puis vérifiés par un conseil juridique.
        </p>

        <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-5 text-sm sm:grid-cols-[220px_1fr]">
          <dt className="font-semibold text-ink">Dénomination sociale</dt>
          <dd className="text-muted">[À compléter — A2V est le nom de démonstration]</dd>

          <dt className="font-semibold text-ink">Forme juridique</dt>
          <dd className="text-muted">[SAS, SARL, société par actions simplifiée unipersonnelle, entreprise individuelle…]</dd>

          <dt className="font-semibold text-ink">Capital social</dt>
          <dd className="text-muted">[Montant en euros — mention nécessaire pour les sociétés]</dd>

          <dt className="font-semibold text-ink">Siège social</dt>
          <dd className="text-muted">[Numéro, rue, code postal, ville, pays]</dd>

          <dt className="font-semibold text-ink">Immatriculation</dt>
          <dd className="text-muted">[Numéro SIREN/SIRET, RCS et ville du greffe, ou RNE pour une entreprise artisanale]</dd>

          <dt className="font-semibold text-ink">TVA intracommunautaire</dt>
          <dd className="text-muted">[Numéro FR… ou mention « non assujetti » le cas échéant]</dd>

          <dt className="font-semibold text-ink">Directeur de la publication</dt>
          <dd className="text-muted">[Nom et prénom de la personne responsable de la publication]</dd>

          <dt className="font-semibold text-ink">Contact</dt>
          <dd className="text-muted">
            <span className="font-mono">support@a2v.example</span> (adresse fictive de démonstration, à remplacer par une boîte
            surveillée) — [numéro de téléphone]
          </dd>

          <dt className="font-semibold text-ink">Activité</dt>
          <dd className="text-muted">
            Plateforme de mise en relation entre vendeurs et acheteurs (marketplace). Vente à prix fixe, enchères et abonnement
            facultatif A2V Prestige.
          </dd>
        </dl>

        <p className="rounded-xl border border-brand-100 bg-white p-4 text-sm text-muted">
          <strong className="text-ink">Cas d&apos;une personne physique (micro-entreprise ou entreprise individuelle) :</strong>{" "}
          indiquez à la place le nom et le prénom de l&apos;exploitant, l&apos;adresse de son domicile,
          son adresse e-mail, son numéro de téléphone, son numéro d&apos;immatriculation RNE et, le cas échéant, son numéro de TVA
          intracommunautaire. Le capital social et le RCS ne s&apos;appliquent pas.
        </p>

        <p>
          <strong className="text-ink">Activité réglementée.</strong> Dans cette démonstration, A2V n&apos;exerce aucune activité
          soumise à autorisation. Si l&apos;activité évolue vers le courtage, le crédit, l&apos;assurance ou un service de
          paiement, il faudra ajouter le nom et l&apos;adresse de l&apos;autorité ayant délivré l&apos;autorisation, le titre
          professionnel et l&apos;organisme professionnel compétent.
        </p>
      </LegalSection>

      <LegalSection title="2. Hébergement du site">
        <p>
          Conformément à l&apos;article 6-III de la LCEN, les coordonnées de l&apos;hébergeur doivent être accessibles sur le
          site, y compris lorsque l&apos;hébergement est gratuit.
        </p>

        <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-5 text-sm sm:grid-cols-[220px_1fr]">
          <dt className="font-semibold text-ink">Nom de l&apos;hébergeur</dt>
          <dd className="text-muted">[À compléter]</dd>

          <dt className="font-semibold text-ink">Raison sociale</dt>
          <dd className="text-muted">[Forme juridique et dénomination de l&apos;hébergeur]</dd>

          <dt className="font-semibold text-ink">Adresse</dt>
          <dd className="text-muted">[Adresse du siège de l&apos;hébergeur]</dd>

          <dt className="font-semibold text-ink">Téléphone</dt>
          <dd className="text-muted">[Numéro de téléphone de l&apos;hébergeur]</dd>
        </dl>

        <p>
          Dans cette démonstration, l&apos;application et la base de données PostgreSQL s&apos;exécutent localement sur la machine
          du développeur. Aucun service d&apos;hébergement n&apos;est engagé et aucune donnée réelle de client ne doit y être
          déposée.
        </p>
      </LegalSection>

      <LegalSection title="3. Conditions générales et résiliation en ligne">
        <p>
          Les conditions générales d&apos;utilisation et de vente applicables aux achats, ventes, enchères, abonnements, trophées
          et dons figurent sur la page <Link href="/cgu" className="link">CGU &amp; CGV</Link>. Elles précisent notamment la
          commission A2V de 0,5 % du prix final de l&apos;article hors livraison, retenue sur le versement du vendeur, la
          protection de l&apos;acheteur et les règles des enchères.
        </p>
        <p>
          <strong className="text-ink">Droit de rétractation.</strong> Pour un achat à distance auprès d&apos;un vendeur
          professionnel, l&apos;acheteur consommateur dispose en principe de 14 jours pour se rétracter (articles L221-18 et
          suivants du code de la consommation), sauf exceptions légales. Les ventes entre particuliers ne bénéficient pas de ce
          droit légal, sauf engagement volontaire du vendeur. Le délai et les modalités applicables doivent être confirmés dans les
          CGV définitives.
        </p>
        <p>
          <strong className="text-ink">Abonnement Prestige.</strong> L&apos;abonnement est facultatif : {formatMoney(PREMIUM.priceCents)}{" "}
          par mois, précédé de {trialOfferLabel(PREMIUM.trialDays)}, puis engagement de {PREMIUM.commitmentMonths} mois. Aucune
          résiliation n&apos;est possible pendant la période offerte ni pendant l&apos;engagement. Elle peut être demandée
          gratuitement en ligne, à partir de la fin de l&apos;engagement, depuis{" "}
          <Link href="/compte/abonnement" className="link">la gestion de l&apos;abonnement</Link>, et prend effet à la fin de la
          période en cours. Le droit de rétractation légal de 14 jours reste applicable à la souscription.
        </p>
      </LegalSection>

      <LegalSection title="4. Propriété intellectuelle et crédits">
        <p>
          La structure du site, les textes, l&apos;interface, les éléments graphiques et la marque A2V sont protégés par le droit
          de la propriété intellectuelle. Toute reproduction, représentation ou adaptation non autorisée est interdite.
        </p>
        <p>
          Les photographies et descriptions publiées par les vendeurs restent leur propriété. En publiant une annonce, le vendeur
          garantit détenir les droits nécessaires et autorise A2V à les afficher pour la durée de la mise en ligne. Les marques et
          logos de tiers cités le sont à titre descriptif ; aucun partenariat n&apos;est revendiqué sans contrat signé.
        </p>
        <p>
          Les annonces de cette démonstration utilisent des <strong>photos d&apos;illustration</strong> issues de Wikimedia Commons
          sous licences libres (CC0, domaine public, CC BY, CC BY-SA). Elles ne représentent pas les objets réellement vendus.
          L&apos;auteur, la licence et le lien vers la fiche d&apos;origine de chaque image sont publiés sur la page{" "}
          <Link href="/credits-photos" className="link">Crédits photos</Link> et dans le fichier{" "}
          <span className="font-mono text-sm">docs/PHOTOS.md</span> du dépôt.
        </p>
      </LegalSection>

      <LegalSection title="5. Données personnelles et cookies">
        <p>
          Le responsable de traitement est l&apos;éditeur identifié ci-dessus. Les données sont traitées pour créer et gérer les
          comptes, publier les annonces, exécuter les commandes et enchères, assurer la livraison, la messagerie, la prévention de
          la fraude et les obligations comptables. Les bases légales, finalités, destinataires, durées de conservation et modalités
          d&apos;exercice des droits sont détaillés dans la{" "}
          <Link href="/confidentialite" className="link">politique de confidentialité</Link>.
        </p>
        <p>
          Contact pour les demandes RGPD : <span className="font-mono text-sm">privacy@a2v.example</span> (adresse fictive à
          remplacer). Vous pouvez exercer vos droits d&apos;accès, de rectification, d&apos;effacement, de limitation,
          d&apos;opposition et de portabilité, et introduire une réclamation auprès de la CNIL (3 place de Fontenoy, TSA 80715,
          75334 Paris Cedex 07 — <a href="https://www.cnil.fr" className="link" rel="noreferrer noopener" target="_blank">cnil.fr</a>).
        </p>
        <p>
          A2V n&apos;utilise par défaut qu&apos;un cookie de session strictement nécessaire. Aucun traceur publicitaire ou de mesure
          d&apos;audience tierce n&apos;est déposé. Le détail et la durée des traceurs figurent sur la page{" "}
          <Link href="/cookies" className="link">Cookies et traceurs</Link>. Tout traceur non essentiel ajouté ultérieurement
          devra recueillir le consentement préalable de l&apos;internaute.
        </p>
      </LegalSection>

      <LegalSection title="6. Signalement de contenus illicites">
        <p>
          Chaque annonce et chaque message dispose d&apos;un mécanisme de signalement. Les signalements sont examinés par la
          modération et peuvent conduire au retrait du contenu ou à la suspension du compte. Pour un signalement urgent, écrivez à{" "}
          <span className="font-mono text-sm">support@a2v.example</span> en précisant l&apos;URL, la nature du contenu et les
          éléments de preuve.
        </p>
        <p>
          En production, le dispositif doit respecter les obligations de notification et de transparence applicables, notamment
          celles du règlement (UE) 2022/2065 sur les services numériques (DSA), avec un point de contact dédié, des délais de
          traitement documentés et une procédure de recours. Cette démonstration ne constitue pas un service de signalement
          officiel.
        </p>
      </LegalSection>

      <LegalSection title="7. Médiation de la consommation et litiges">
        <p>
          En cas de difficulté, contactez d&apos;abord le support pour rechercher une solution amiable. Pour les litiges de
          consommation, l&apos;éditeur professionnel doit adhérer à un dispositif de médiation de la consommation et afficher le
          nom, l&apos;adresse et le site du médiateur (articles L612-1 et suivants du code de la consommation).
        </p>
        <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-5 text-sm sm:grid-cols-[220px_1fr]">
          <dt className="font-semibold text-ink">Médiateur désigné</dt>
          <dd className="text-muted">[Nom du médiateur — non désigné dans cette démonstration]</dd>

          <dt className="font-semibold text-ink">Coordonnées</dt>
          <dd className="text-muted">[Adresse postale, site internet, e-mail ou téléphone]</dd>
        </dl>
        <p>
          La plateforme européenne de règlement en ligne des litiges est accessible à l&apos;adresse{" "}
          <a href="https://ec.europa.eu/consumers/odr" className="link" rel="noreferrer noopener" target="_blank">
            ec.europa.eu/consumers/odr
          </a>
          . Cette plateforme ne se substitue pas au médiateur compétent.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilité et disponibilité">
        <p>
          A2V met en relation vendeurs et acheteurs ; sauf mention contraire dans les CGV, elle n&apos;est pas le vendeur des
          articles. Les informations publiées par les vendeurs relèvent de leur responsabilité. L&apos;éditeur ne peut garantir
          une disponibilité continue du service et peut le suspendre pour maintenance, sécurité ou obligation légale.
        </p>
        <p>
          Cette version est fournie à des fins de démonstration, sans garantie d&apos;exactitude ni de disponibilité. Les
          paiements, étiquettes de livraison, e-mails et versements sont simulés et ne constituent pas des opérations réelles.
        </p>
      </LegalSection>

      <LegalSection title="9. Droit applicable et juridiction">
        <p>
          Les présentes mentions sont soumises au droit français. Les relations avec les consommateurs sont régies par les règles
          impératives applicables, y compris celles du pays de résidence du consommateur lorsque la loi le prévoit. À défaut de
          résolution amiable ou de médiation, le litige peut être porté devant les juridictions françaises compétentes.
        </p>
      </LegalSection>

      <LegalSection title="10. Mise à jour">
        <p>
          Cette page doit être mise à jour à chaque changement d&apos;éditeur, d&apos;hébergeur, de prestataire de paiement, de
          médiateur ou de politique de cookies. La date de dernière mise à jour figure en bas de page. Les champs entre crochets
          sont des emplacements à compléter avant la mise en production.
        </p>
        <p>
          Pour toute question relative à ces mentions : <Link href="/contact" className="link">contact</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
