import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { AUCTION_PAYMENT_DEADLINE_HOURS, FINALIZATION_DELAY_DAYS, PREMIUM, trialOfferLabel } from "@/lib/config";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation et de vente",
  description: "CGU et CGV A2V : commission de 0,5 %, enchères, livraison, A2V Prestige, trophées et dons.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="CGU & CGV"
      description="Les règles d'utilisation du service et les conditions de vente applicables entre acheteurs, vendeurs et A2V."
    >
      <LegalSection title="1. Objet et acceptation">
        <p>
          A2V est une place de marché permettant à des particuliers et professionnels de publier des annonces à prix fixe ou aux
          enchères, d&apos;acheter et de suivre leurs transactions. L&apos;utilisation du service implique l&apos;acceptation des
          présentes conditions. Les présentes conditions constituent un modèle destiné à être adapté par un juriste avant
          exploitation commerciale.
        </p>
        <p>
          A2V agit comme intermédiaire technique. Le contrat de vente est conclu entre l&apos;acheteur et le vendeur. A2V
          n&apos;est pas propriétaire des articles mis en vente et ne garantit pas leur conformité.
        </p>
      </LegalSection>

      <LegalSection id="vente" title="2. Conditions de vente">
        <p>
          Le vendeur certifie être propriétaire de l&apos;article, disposer du droit de le vendre et décrire son état avec exactitude.
          Les contrefaçons, produits interdits, armes, produits dangereux, médicaments, données personnelles et contenus illicites
          sont interdits.
        </p>
        <p>
          Le prix affiché est exprimé en euros, toutes taxes comprises. Les frais de livraison sont présentés séparément et
          inclus dans le total avant paiement. Aucun frais de publication n&apos;est facturé.
        </p>
        <p>
          La commission A2V est de <strong>0,5 % du prix final de l&apos;article, hors frais de livraison</strong>, retenue sur le
          versement du vendeur puis conservée par A2V. Elle n&apos;est due qu&apos;après finalisation de la vente et n&apos;est pas
          ajoutée au prix payé par l&apos;acheteur. À titre d&apos;exemple, pour un article vendu {formatMoney(10000)}, la commission
          est de {formatMoney(50)} pour A2V et le versement vendeur de {formatMoney(9950)}.
        </p>
        <p>
          L&apos;acheteur paie le prix de l&apos;article, les frais de livraison éventuels, moins les réductions appliquées par le
          serveur. Une seule réduction est appliquée par commande.
        </p>
      </LegalSection>

      <LegalSection title="3. Enchères">
        <p>
          Une offre est un engagement ferme de payer. Les offres sont horodatées par le serveur et ne peuvent pas être retirées.
          Le vendeur ne peut pas enchérir sur son propre article. Une offre placée dans les deux dernières minutes prolonge la
          clôture de deux minutes, dans la limite de dix prolongations.
        </p>
        <p>
          Le gagnant dispose de {AUCTION_PAYMENT_DEADLINE_HOURS} heures pour payer. À défaut, la vente peut être annulée, l&apos;article
          reproposé et la participation aux enchères suspendue. Un prix de réserve peut être fixé ; son montant n&apos;est pas public.
          Si la réserve n&apos;est pas atteinte, l&apos;article n&apos;est pas vendu.
        </p>
        <p>
          Les enchères peuvent être closes par le vendeur ou par l&apos;administration dans des cas encadrés (erreur manifeste,
          indisponibilité, fraude). Toute clôture forcée est journalisée.
        </p>
      </LegalSection>

      <LegalSection title="4. Paiement, protection et remboursement">
        <p>
          En production, les paiements sont traités par Stripe. Aucune donnée de carte n&apos;est stockée par A2V. Dans
          l&apos;environnement de démonstration, les paiements sont simulés et clairement identifiés : aucun montant réel
          n&apos;est prélevé.
        </p>
        <p>
          Le versement au vendeur intervient après la livraison et un délai de protection de {FINALIZATION_DELAY_DAYS} jours, sous
          réserve de l&apos;absence de litige. Un litige ouvert suspend la finalisation et le versement. Les montants affichés
          comme « payés » correspondent à des paiements enregistrés ; ils ne prouvent pas un virement effectif au vendeur.
        </p>
        <p>
          Les remboursements éventuels sont enregistrés sur la commande concernée. Les délais bancaires dépendent du prestataire.
        </p>
      </LegalSection>

      <LegalSection title="5. Livraison">
        <p>
          Le vendeur est responsable de l&apos;emballage et de l&apos;expédition. Le tarif et le mode de livraison sont choisis par
          l&apos;acheteur avant paiement. Le suivi est affiché dans la commande.
        </p>
        <p>
          L&apos;intégration La Poste / Colissimo n&apos;est pas active sans identifiants et contrat. En mode simulation, les
          étiquettes et numéros de suivi sont fictifs, portent une mention explicite et ne doivent pas être utilisés pour une
          expédition réelle.
        </p>
      </LegalSection>

      <LegalSection title="6. A2V Prestige">
        <p>
          A2V Prestige est un abonnement facultatif de {formatMoney(PREMIUM.priceCents)} par mois, précédé de{" "}
          {trialOfferLabel(PREMIUM.trialDays)}. À l&apos;issue de cette période offerte, l&apos;abonnement est conclu pour un
          engagement de {PREMIUM.commitmentMonths} mois. Aucune résiliation n&apos;est possible pendant la période offerte ni
          pendant l&apos;engagement : elle peut être demandée à partir de la date de fin d&apos;engagement, gratuitement en ligne
          depuis <Link href="/compte/abonnement" className="link">la gestion de l&apos;abonnement</Link>, et prend effet à la fin
          de la période en cours. À défaut de résiliation, l&apos;abonnement se poursuit ensuite mois par mois. Le droit de
          rétractation légal de 14 jours prévu à l&apos;article L221-18 du code de la consommation reste applicable à la
          souscription. L&apos;abonnement ne réduit pas la commission et n&apos;est jamais obligatoire pour acheter ou vendre.
        </p>
        <p>
          Les membres Prestige bénéficient d&apos;une réduction automatique de <strong>10 %</strong> sur les articles dont le
          prix final dépasse 10 000 €, hors frais de livraison. Elle s&apos;applique aux achats à prix fixe comme aux enchères
          remportées, est calculée côté serveur et n&apos;est pas cumulable avec une autre réduction : la plus avantageuse est
          retenue. Les annonces dont le prix affiché, ou le prix de départ d&apos;une enchère, dépasse 10 000 € sont réservées aux
          membres Prestige ; une enchère partie en dessous du seuil reste ouverte à tous, la réduction s&apos;appliquant aux
          membres si l&apos;offre finale dépasse 10 000 €.
        </p>
        <p>
          Un vendeur peut indépendamment choisir de réserver son annonce aux membres Prestige. Dans ce cas, les non-membres ne
          peuvent ni la voir ni l&apos;acheter. En dessous de 10 000 €, ce choix reste libre ; au-delà du seuil, la réservation
          est automatique et contrôlée côté serveur.
        </p>
        <p>
          Dans cette démonstration, la période offerte et l&apos;engagement sont affichés, mais les prélèvements restent simulés.
          Aucun paiement réel n&apos;est effectué sans Stripe Billing configuré et confirmé par un webhook signé.
        </p>
      </LegalSection>

      <LegalSection title="7. Trophées et réductions">
        <p>
          Les trophées sont attribués uniquement après une enchère remportée, payée, livrée et finalisée. Ils débloquent des
          réductions plafonnées sur de futurs achats, appliquées côté serveur. Ils ne constituent ni une monnaie, ni un crédit en
          espèces, ni un droit à un virement. Les règles et plafonds peuvent évoluer ; les conditions applicables sont celles
          affichées au moment de la commande.
        </p>
      </LegalSection>

      <LegalSection title="8. Dons">
        <p>
          Les dons sont volontaires et suivis dans un espace comptable séparé des ventes, commissions et abonnements. Ils ne
          donnent droit à aucun avantage commercial, trophée ou réduction. Aucun reçu fiscal n&apos;est délivré dans cette
          démonstration et aucun avantage fiscal n&apos;est promis. Un montant n&apos;est présenté comme reversé qu&apos;après
          enregistrement d&apos;un virement avec référence.
        </p>
      </LegalSection>

      <LegalSection title="9. Comportement et modération">
        <p>
          Les utilisateurs s&apos;abstiennent de tout harcèlement, spam, usurpation d&apos;identité, contournement du paiement ou
          tentative de fraude. La modération peut retirer une annonce, suspendre un compte ou signaler les faits aux autorités.
          Les décisions sont journalisées et peuvent être contestées via le support.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit de rétractation">
        <p>
          Pour un achat à distance auprès d&apos;un vendeur professionnel, l&apos;acheteur consommateur dispose en principe de 14
          jours pour se rétracter (articles L221-18 et suivants du code de la consommation), sauf exceptions légales. Les ventes
          entre particuliers ne bénéficient pas de ce droit légal, sauf engagement volontaire du vendeur. En production, les
          informations précontractuelles et le formulaire de rétractation doivent être adaptés à chaque situation. Cette
          démonstration ne fournit pas de conseil juridique.
        </p>
      </LegalSection>

      <LegalSection title="11. Données personnelles et cookies">
        <p>
          Le traitement des données est décrit dans la{" "}
          <Link href="/confidentialite" className="link">politique de confidentialité</Link>. Seul un cookie de session
          indispensable est utilisé par défaut ; voir la <Link href="/cookies" className="link">page cookies</Link>.
        </p>
      </LegalSection>

      <LegalSection title="12. Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant
          toute action. La désignation d&apos;un médiateur de la consommation est requise en production mais n&apos;est pas
          effective dans cette démonstration. Voir les{" "}
          <Link href="/mentions-legales" className="link">mentions légales</Link> pour les coordonnées de l&apos;éditeur, de
          l&apos;hébergeur et du médiateur.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
