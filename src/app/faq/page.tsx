import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Gavel, HelpCircle, Package, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { AUCTION_PAYMENT_DEADLINE_HOURS, FINALIZATION_DELAY_DAYS, PREMIUM, trialOfferLabel } from "@/lib/config";

export const metadata: Metadata = {
  title: "Aide et questions fréquentes",
  description:
    "Réponses sur les achats, les enchères, la commission de 0,5 %, la livraison, A2V Prestige, les trophées, les dons et la protection des données.",
};

const SECTIONS = [
  {
    icon: Package,
    title: "Acheter et vendre",
    items: [
      {
        q: "Combien coûte la publication d'une annonce ?",
        a: "La publication est gratuite, à prix fixe comme aux enchères. Aucun abonnement n'est nécessaire pour vendre.",
      },
      {
        q: "Quelle est la commission A2V ?",
        a: `0,5 % du prix final de l'article, hors frais de livraison. Elle est retenue sur le versement du vendeur après finalisation de la vente, puis conservée par A2V. L'acheteur ne paie pas cette commission en plus. Exemple : un article vendu ${formatMoney(10000)} génère ${formatMoney(50)} de commission pour A2V et ${formatMoney(9950)} de versement vendeur.`,
      },
      {
        q: "Quand le vendeur est-il payé ?",
        a: `Après la livraison et un délai de protection de ${FINALIZATION_DELAY_DAYS} jours, si aucun litige n'est ouvert. Dans cette démonstration, les paiements et virements sont simulés.`,
      },
      {
        q: "Les frais de livraison sont-ils affichés avant le paiement ?",
        a: "Oui. Le tarif dépend du service choisi et il est inclus dans le total confirmé avant paiement. En mode simulation, les tarifs et étiquettes sont explicitement signalés comme fictifs.",
      },
    ],
  },
  {
    icon: Gavel,
    title: "Enchères",
    items: [
      {
        q: "Comment fonctionne l'anti-sniping ?",
        a: "Une offre placée dans les deux dernières minutes repousse la clôture de deux minutes, dans la limite de dix prolongations. L'heure de référence est celle du serveur, jamais celle de votre navigateur.",
      },
      {
        q: "Que se passe-t-il si je remporte une enchère ?",
        a: `Vous disposez de ${AUCTION_PAYMENT_DEADLINE_HOURS} heures pour payer. Passé ce délai, la vente peut être annulée et votre participation aux enchères suspendue.`,
      },
      {
        q: "Le prix de réserve est-il public ?",
        a: "Non. Vous savez seulement s'il est atteint ou non. Tant qu'il n'est pas atteint, l'article n'est pas vendu.",
      },
      {
        q: "Puis-je enchérir sur mon propre article ?",
        a: "Non, le serveur refuse toute offre du vendeur sur sa propre annonce.",
      },
    ],
  },
  {
    icon: Sparkles,
    title: "A2V Prestige",
    items: [
      {
        q: "Combien coûte Prestige ?",
        a: `${trialOfferLabel(PREMIUM.trialDays)}, puis ${formatMoney(PREMIUM.priceCents)} par mois pendant ${PREMIUM.commitmentMonths} mois (engagement). La résiliation n'est possible qu'à la fin de l'engagement.`,
      },
      {
        q: "L'abonnement réduit-il la commission ?",
        a: "Non. La commission de 0,5 % reste identique pour tous. Prestige donne accès aux annonces réservées (dont celles de plus de 10 000 €), une réduction de 10 % sur ces articles et des réductions plafonnées.",
      },
      {
        q: "Quelles annonces sont réservées aux membres ?",
        a: "Toute annonce à prix fixe, ou enchère dont le prix de départ, dépasse 10 000 € est automatiquement réservée aux membres Prestige : les non-membres ne la voient pas et ne peuvent pas l'acheter. En dessous de 10 000 €, un vendeur peut aussi choisir librement de réserver son annonce.",
      },
      {
        q: "Comment fonctionne la réduction Prestige de 10 % ?",
        a: "Elle s'applique automatiquement aux membres actifs lorsque le prix final de l'article dépasse 10 000 €, hors livraison, à prix fixe comme sur une enchère remportée. Les annonces au-dessus de 10 000 € sont réservées aux membres ; la réduction est calculée côté serveur et n'est pas cumulable avec une autre réduction (la plus avantageuse est retenue).",
      },
      {
        q: "Que se passe-t-il à la fin de la période offerte ?",
        a: `L'abonnement se poursuit automatiquement à ${formatMoney(PREMIUM.priceCents)} par mois pour un engagement de ${PREMIUM.commitmentMonths} mois. Aucune résiliation n'est possible pendant la période offerte ni pendant l'engagement. En démonstration, les prélèvements restent simulés.`,
      },
    ],
  },
  {
    icon: Trophy,
    title: "Trophées et réductions",
    items: [
      {
        q: "Quand reçois-je un trophée ?",
        a: "Uniquement après une enchère remportée, payée, livrée et finalisée. Une simple offre ou une enchère non payée ne donne aucun trophée.",
      },
      {
        q: "Les trophées donnent-ils de l'argent ?",
        a: "Non. Ils débloquent des réductions plafonnées sur de futurs achats, appliquées côté serveur. Aucun crédit en espèces, aucune cagnotte.",
      },
      {
        q: "Puis-je cumuler un trophée et un code promo ?",
        a: "Non. Une seule réduction est appliquée par commande, et le serveur retient la plus avantageuse dans la limite des plafonds.",
      },
    ],
  },
  {
    icon: CreditCard,
    title: "Paiement et sécurité",
    items: [
      {
        q: "A2V stocke-t-il mes données de carte ?",
        a: "Non. En production, le paiement passe par Stripe Checkout : aucune donnée de carte n'est stockée sur les serveurs A2V.",
      },
      {
        q: "Puis-je payer en dehors de la plateforme ?",
        a: "Non. Un paiement hors A2V ne bénéficie d'aucune protection et ne permet ni litige ni remboursement via la plateforme.",
      },
      {
        q: "Comment ouvrir un litige ?",
        a: "Depuis la page de la commande, tant que la vente n'est pas finalisée. Le versement du vendeur est alors suspendu jusqu'à décision.",
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Données personnelles",
    items: [
      {
        q: "Puis-je exporter ou supprimer mes données ?",
        a: "Oui. L'export est disponible depuis votre compte et la suppression peut être demandée en ligne. Certaines données comptables sont conservées pour respecter les obligations légales.",
      },
      {
        q: "Les dons sont-ils mélangés aux ventes ?",
        a: "Non. Les dons sont suivis dans un espace comptable séparé des ventes, commissions et abonnements. Aucun pourcentage de contribution n'est affiché tant qu'il n'est pas décidé et publié.",
      },
    ],
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  ),
};

export default function FaqPage() {
  return (
    <div className="container-page py-8 lg:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <Breadcrumbs items={[{ label: "Aide" }]} />
      <PageHeader
        eyebrow="Aide"
        title="Questions fréquentes"
        description="Les règles applicables sont affichées telles qu'elles sont appliquées par le serveur. Si une réponse manque, écrivez-nous."
        action={<ButtonLink href="/contact" variant="outline" size="sm">Contacter l&apos;équipe</ButtonLink>}
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Sommaire de l'aide" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.title}>
                <a href={`#${section.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-brand-50 hover:text-ink">
                  <section.icon className="h-4 w-4 text-brand-600" /> {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title} id={section.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}>
              <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
                <section.icon className="h-5 w-5 text-brand-600" /> {section.title}
              </h2>
              <Card className="divide-y divide-brand-100">
                {section.items.map((item) => (
                  <details key={item.q} className="group p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
                      {item.q}
                      <HelpCircle className="h-4 w-4 shrink-0 text-brand-400 group-open:text-brand-700" />
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-muted">{item.a}</p>
                  </details>
                ))}
              </Card>
            </section>
          ))}

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Une autre question ?</h2>
            <p className="mt-1 text-sm text-muted">
              Le formulaire de contact enregistre votre message. Dans cette démonstration, SMTP n&apos;est pas configuré : aucun
              e-mail réel n&apos;est envoyé tant que les identifiants ne sont pas fournis.
            </p>
            <ButtonLink href="/contact" className="mt-4">Nous écrire</ButtonLink>
          </Card>

          <p className="text-xs text-muted">
            Voir aussi les <Link href="/cgu" className="link">CGU et CGV</Link>, la{" "}
            <Link href="/confidentialite" className="link">politique de confidentialité</Link> et les{" "}
            <Link href="/mentions-legales" className="link">mentions légales</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
