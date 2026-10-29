import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getPremiumState } from "@/lib/services/premium";
import { getSetting } from "@/lib/services/settings";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { paymentsSimulationEnabled } from "@/lib/env";
import { PREMIUM, trialDurationLabel, trialOfferLabel } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import {
  activateSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  startTrialAction,
} from "@/app/actions/premium";

export const metadata: Metadata = {
  title: `A2V Prestige — ${trialOfferLabel(PREMIUM.trialDays)}`,
  description:
    `A2V Prestige : offres exclusives et réductions supplémentaires. ${trialOfferLabel(PREMIUM.trialDays)}, puis ${formatMoney(PREMIUM.priceCents)} par mois pendant ${PREMIUM.commitmentMonths} mois. Vendre reste gratuit et sans abonnement.`,
};

const BENEFITS = [
  {
    title: "Offres et enchères exclusives",
    text: "Accédez aux annonces que les vendeurs choisissent de réserver aux membres Prestige.",
  },
  {
    title: "10 % sur les articles à plus de 10 000 €",
    text: "Réduction automatique sur le prix de l'article dès que le prix final dépasse 10 000 €. Au-delà de ce seuil, l'annonce est réservée aux membres Prestige ; en dessous, tout le monde peut acheter au prix affiché.",
  },
  { title: "Réductions supplémentaires", text: "Un avantage automatique sur vos achats, dans la limite des plafonds affichés." },
  { title: "Découverte avancée", text: "Des sélections et un accès anticipé aux ventes (selon les fonctionnalités activées)." },
  {
    title: `Engagement de ${PREMIUM.commitmentMonths} mois`,
    text: `${trialOfferLabel(PREMIUM.trialDays)}, puis ${formatMoney(PREMIUM.priceCents)} par mois. La résiliation n'est possible qu'à la fin de l'engagement.`,
  },
];

export default async function PremiumPage() {
  const user = await getCurrentUser();
  const [state, offer] = await Promise.all([
    user ? getPremiumState(user.id) : Promise.resolve(null),
    getSetting("premium.priceCents"),
  ]);
  const priceCents = state?.priceCents ?? offer;
  const trialDays = state?.trialDays ?? PREMIUM.trialDays;

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-800 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(167,139,250,0.5),transparent_55%),radial-gradient(circle_at_10%_90%,rgba(76,29,149,0.9),transparent_45%)]" />
        <div className="container-page relative grid gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <Badge className="border-white/20 bg-white/10 text-brand-100">
              <Sparkles className="h-3.5 w-3.5" /> A2V Prestige Club
            </Badge>
            <h1 className="mt-4 text-balance text-4xl font-extrabold leading-tight sm:text-5xl">
              {trialOfferLabel(trialDays)}, puis {formatMoney(priceCents)} / mois.
            </h1>
            <p className="mt-4 max-w-xl text-brand-100">
              Un accès aux offres réservées et des réductions supplémentaires. {trialOfferLabel(PREMIUM.trialDays)}, puis{" "}
              {formatMoney(priceCents)} par mois pendant {PREMIUM.commitmentMonths} mois. La commission de 0,5 % sur les ventes
              reste identique pour tous.
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-2 text-sm text-brand-50">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" /> {benefit.title}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              {!user ? (
                <>
                  <ButtonLink href="/inscription" size="lg" className="bg-white text-brand-800 hover:bg-brand-100">
                    Créer un compte
                  </ButtonLink>
                  <ButtonLink href="/connexion?next=/premium" size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10">
                    J&apos;ai déjà un compte
                  </ButtonLink>
                </>
              ) : state?.isPremium ? (
                <>
                  <ButtonLink href="/premium/offres" size="lg" className="bg-white text-brand-800 hover:bg-brand-100">
                    Voir les offres Prestige
                  </ButtonLink>
                  <ButtonLink
                    href="/compte/abonnement"
                    size="lg"
                    variant="outline"
                    className="border-white/30 bg-white/5 text-white hover:bg-white/10"
                  >
                    Gérer mon abonnement
                  </ButtonLink>
                </>
              ) : state?.canStartTrial ? (
                <ButtonLink href="#demarrer" size="lg" className="bg-white text-brand-800 hover:bg-brand-100">
                  Démarrer mon essai gratuit
                </ButtonLink>
              ) : (
                <ButtonLink href="#demarrer" size="lg" className="bg-white text-brand-800 hover:bg-brand-100">
                  Activer Prestige
                </ButtonLink>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <p className="text-sm font-semibold text-brand-100">Ce que vous payez</p>
            <p className="mt-2 text-5xl font-extrabold">
              {formatMoney(priceCents)}
              <span className="text-base font-medium text-brand-200"> / mois</span>
            </p>
            <p className="mt-1 text-sm text-brand-200">Après {trialDurationLabel(trialDays)} offerts. Le premier mois est ensuite facturé automatiquement, sans résiliation possible avant la fin de l&apos;engagement.</p>
            <div className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
              <p className="flex items-center justify-between gap-3"><span className="text-brand-200">Commission de vente</span><span>0,5 % (inchangée)</span></p>
              <p className="flex items-center justify-between gap-3"><span className="text-brand-200">Engagement</span><span>{PREMIUM.commitmentMonths} mois</span></p>
              <p className="flex items-center justify-between gap-3"><span className="text-brand-200">Résiliation</span><span>À la fin de l&apos;engagement</span></p>
              <p className="flex items-center justify-between gap-3"><span className="text-brand-200">Publication d&apos;annonces</span><span>Gratuite</span></p>
            </div>
            <p className="mt-4 text-xs leading-5 text-brand-200">
              Aucun compte bancaire n&apos;est demandé pour l&apos;essai. En démonstration, l&apos;activation payante est simulée et
              clairement signalée.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-12 lg:py-16" id="demarrer">
        <Breadcrumbs items={[{ label: "A2V Prestige" }]} />
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <PageHeader
              eyebrow="Votre situation"
              title={state?.isPremium ? "Votre abonnement Prestige" : "Démarrer avec Prestige"}
              description="Les états sont calculés côté serveur. L'engagement, l'échéance et le montant sont affichés en toute transparence."
            />

            {!user ? (
              <Card className="p-6">
                <p className="text-sm leading-6 text-muted">
                  Connectez-vous pour démarrer la période offerte. Elle dure {trialDurationLabel(PREMIUM.trialDays)} et est suivie
                  d&apos;un engagement de {PREMIUM.commitmentMonths} mois. Aucun abonnement n&apos;est requis pour acheter ou vendre sur A2V.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href="/inscription">Créer un compte</ButtonLink>
                  <ButtonLink href="/connexion?next=/premium" variant="outline">Se connecter</ButtonLink>
                </div>
              </Card>
            ) : (
              <Card className="p-6">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Statut</dt>
                    <dd className="font-semibold">
                      {state?.isPremium
                        ? state.status === "TRIALING"
                          ? "Période offerte en cours"
                          : state.status === "CANCEL_AT_PERIOD_END"
                            ? "Résiliation programmée"
                            : "Actif"
                        : state?.hasUsedTrial
                          ? "Période offerte déjà utilisée"
                          : "Aucun abonnement"}
                    </dd>
                  </div>
                  {state?.commitmentEndsAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Fin d&apos;engagement</dt>
                      <dd className="font-medium">{formatDate(state.commitmentEndsAt)}</dd>
                    </div>
                  ) : null}
                  {state?.nextBillingAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Prochaine échéance</dt>
                      <dd className="font-medium">{formatDate(state.nextBillingAt)}</dd>
                    </div>
                  ) : null}
                  {state?.daysRemaining !== null && state?.daysRemaining !== undefined ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Jours restants</dt>
                      <dd className="font-medium">{state.daysRemaining}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Prix mensuel</dt>
                    <dd className="font-medium">{formatMoney(priceCents)}</dd>
                  </div>
                </dl>

                <div className="mt-5 space-y-3 border-t border-brand-100 pt-5">
                  {state?.isPremium ? (
                    <>
                      {state.status === "CANCEL_AT_PERIOD_END" ? (
                        <ActionForm action={resumeSubscriptionAction} submitLabel="Reprendre l'abonnement" pendingLabel="Reprise…">
                          <p className="text-xs text-muted">Votre abonnement reste actif jusqu&apos;à la fin de la période payée.</p>
                        </ActionForm>
                      ) : state.canCancel ? (
                        <ActionForm action={cancelSubscriptionAction} submitLabel="Résilier à la fin de la période" pendingLabel="Résiliation…" footer={
                          <p className="text-xs text-muted">Aucun frais de résiliation. Les avantages restent actifs jusqu&apos;à l&apos;échéance.</p>
                        }>
                          <p className="text-xs leading-5 text-muted">
                            La résiliation prend effet à la fin de la période en cours. Aucun nouveau prélèvement ne sera effectué.
                          </p>
                        </ActionForm>
                      ) : (
                        <p className="text-xs leading-5 text-muted">
                          Votre engagement de {PREMIUM.commitmentMonths} mois court jusqu&apos;au{" "}
                          {state.commitmentEndsAt ? formatDate(state.commitmentEndsAt) : "—"}. La résiliation sera possible à cette
                          date ; elle n&apos;est pas possible pendant la période offerte ni pendant l&apos;engagement.
                        </p>
                      )}
                      <ButtonLink href="/compte/abonnement" variant="outline" size="sm">Voir mon abonnement</ButtonLink>
                    </>
                  ) : state?.canStartTrial ? (
                    <ActionForm action={startTrialAction} submitLabel={`Démarrer les ${trialDurationLabel(trialDays)} offerts`} pendingLabel="Activation…">
                      <p className="text-xs leading-5 text-muted">
                        Aucun paiement pendant la période offerte. Elle est suivie d&apos;un engagement de{" "}
                        {PREMIUM.commitmentMonths} mois à {formatMoney(priceCents)} par mois. La résiliation n&apos;est possible
                        qu&apos;à la fin de l&apos;engagement.
                      </p>
                    </ActionForm>
                  ) : (
                    <ActionForm action={activateSubscriptionAction} submitLabel={`Activer pour ${formatMoney(priceCents)} / mois`} pendingLabel="Activation…">
                      <p className="text-xs leading-5 text-muted">
                        {paymentsSimulationEnabled
                          ? "Mode simulation : aucun paiement réel ne sera effectué. En production, Stripe Billing et son webhook signé sont requis."
                          : "L'activation payante nécessite Stripe Billing. Contactez le support si le bouton renvoie une erreur de configuration."}
                      </p>
                    </ActionForm>
                  )}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Ce qui est inclus — et ce qui ne l&apos;est pas</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {BENEFITS.map((benefit) => (
                  <li key={benefit.title} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span><strong className="text-ink">{benefit.title}.</strong> <span className="text-muted">{benefit.text}</span></span>
                  </li>
                ))}
                <li className="flex items-start gap-2">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <span className="text-muted">Aucun crédit en argent automatique, aucune cagnotte fictive, aucune commission réduite.</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <span className="text-muted">Aucune obligation d&apos;abonnement pour publier ou acheter.</span>
                </li>
              </ul>
              <p className="mt-4 text-xs leading-5 text-muted">
                Les réductions Prestige sont appliquées côté serveur lors de la commande, dans les plafonds définis. Elles ne sont
                jamais versées en espèces. La réduction de 10 % s&apos;applique aux articles dont le prix final dépasse 10 000 € ;
                ces articles étant réservés aux membres au-delà du seuil, elle bénéficie aux abonnés actifs. Elle n&apos;est pas
                cumulable avec une autre réduction (la plus avantageuse est retenue).
              </p>
            </Card>

            <Card className="p-6 text-sm text-muted">
              <h2 className="text-base font-semibold text-ink">Questions fréquentes</h2>
              <details className="mt-3 border-b border-brand-100 pb-3">
                <summary className="cursor-pointer font-medium text-ink">Que se passe-t-il après la période offerte ?</summary>
                <p className="mt-2">L&apos;abonnement se poursuit à {formatMoney(PREMIUM.priceCents)} par mois pour un engagement de {PREMIUM.commitmentMonths} mois. La résiliation n&apos;est possible qu&apos;à la fin de cet engagement. Dans cette démonstration, les prélèvements restent simulés.</p>
              </details>
              <details className="mt-3 border-b border-brand-100 pb-3">
                <summary className="cursor-pointer font-medium text-ink">Puis-je résilier pendant la période offerte ?</summary>
                <p className="mt-2">Non. La résiliation est bloquée pendant les {trialDurationLabel(PREMIUM.trialDays)} offerts et pendant l&apos;engagement de {PREMIUM.commitmentMonths} mois. Elle redevient possible à la date de fin d&apos;engagement.</p>
              </details>
              <details className="mt-3 border-b border-brand-100 pb-3">
                <summary className="cursor-pointer font-medium text-ink">Comment fonctionne la réduction de 10 % ?</summary>
                <p className="mt-2">
                  Elle s&apos;applique automatiquement aux membres Prestige lorsque le prix final de l&apos;article dépasse
                  10 000 € (hors livraison), sur les achats à prix fixe comme sur les enchères remportées. Les annonces
                  au-dessus de 10 000 € sont réservées aux membres. La réduction est calculée côté serveur et n&apos;est pas
                  cumulable avec une autre réduction.
                </p>
              </details>
              <details className="mt-3">
                <summary className="cursor-pointer font-medium text-ink">L&apos;abonnement réduit-il la commission ?</summary>
                <p className="mt-2">Non. La commission de 0,5 % sur le prix final de l&apos;article reste identique. Prestige apporte des avantages d&apos;accès et des réductions plafonnées, sans modifier la commission.</p>
              </details>
            </Card>

            <p className="px-1 text-xs leading-5 text-muted">
              Voir les <Link href="/cgu" className="link">conditions générales</Link> et la{" "}
              <Link href="/confidentialite" className="link">politique de confidentialité</Link>. Les informations de facturation
              simulées ne constituent pas une facture réelle.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
