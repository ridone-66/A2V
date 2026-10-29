import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getPremiumState } from "@/lib/services/premium";
import { paymentsSimulationEnabled } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PREMIUM, trialDurationLabel, trialOfferLabel } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import {
  activateSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  startTrialAction,
} from "@/app/actions/premium";

export const metadata: Metadata = { title: "Abonnement Prestige" };

const STATUS_LABELS: Record<string, string> = {
  NONE: "Aucun abonnement",
  TRIALING: "Essai gratuit en cours",
  ACTIVE: "Abonnement actif",
  CANCEL_AT_PERIOD_END: "Résiliation programmée",
  EXPIRED: "Abonnement expiré",
  PAYMENT_FAILED: "Échec de paiement",
};

export default async function SubscriptionPage() {
  const user = await requireUser("/compte/abonnement");
  const state = await getPremiumState(user.id);
  const events = await prisma.subscriptionEvent.findMany({
    where: { subscription: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Avantages"
        title="Abonnement A2V Prestige"
        description={`${trialOfferLabel(state.trialDays || PREMIUM.trialDays)}, puis ${formatMoney(state.priceCents)} par mois pendant ${PREMIUM.commitmentMonths} mois. Résiliation possible à la fin de l'engagement uniquement.`}
        action={<ButtonLink href="/premium" variant="outline" size="sm">Présentation Prestige</ButtonLink>}
      />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-200">État de l&apos;abonnement</p>
                <p className="text-2xl font-bold">{STATUS_LABELS[state.status] ?? state.status}</p>
              </div>
            </div>
            <Badge className="border-white/20 bg-white/15 text-white">
              {state.isPremium ? "Avantages actifs" : "Avantages inactifs"}
            </Badge>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-brand-200">Prix mensuel</dt>
              <dd className="font-semibold">{formatMoney(state.priceCents)} / mois</dd>
            </div>
            <div>
              <dt className="text-xs text-brand-200">Échéance</dt>
              <dd className="font-semibold">{state.nextBillingAt ? formatDate(state.nextBillingAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-brand-200">Fin d&apos;engagement</dt>
              <dd className="font-semibold">{state.commitmentEndsAt ? formatDate(state.commitmentEndsAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-brand-200">Jours restants</dt>
              <dd className="font-semibold">{state.daysRemaining ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {paymentsSimulationEnabled ? (
        <Alert tone="warning" title="Paiement simulé">
          Les paiements sont en mode simulation. Une activation d&apos;abonnement enregistre un paiement fictif, clairement
          identifié, et aucun prélèvement réel n&apos;est effectué. En production, Stripe Billing et un webhook signé sont requis.
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Gérer mon abonnement" description="Les changements sont enregistrés côté serveur." />
          <CardBody className="space-y-3">
            {state.status === "NONE" || state.status === "EXPIRED" || state.status === "PAYMENT_FAILED" ? (
              <>
                {state.canStartTrial ? (
                  <ActionForm action={startTrialAction} submitLabel={`Démarrer les ${trialDurationLabel(state.trialDays)} offerts`} pendingLabel="Activation…">
                    <p className="text-sm text-muted">
                      Aucun prélèvement pendant la période offerte. Elle est suivie d&apos;un engagement de{" "}
                      {PREMIUM.commitmentMonths} mois à {formatMoney(state.priceCents)} par mois. Aucune résiliation n&apos;est
                      possible avant la fin de l&apos;engagement.
                    </p>
                  </ActionForm>
                ) : (
                  <p className="text-sm text-muted">Vous avez déjà utilisé votre période offerte.</p>
                )}
                <ActionForm action={activateSubscriptionAction} submitLabel={`Activer pour ${formatMoney(state.priceCents)} / mois`} pendingLabel="Activation…">
                  <p className="text-sm text-muted">
                    {state.hasUsedTrial
                      ? `Activez l'abonnement payant avec un engagement de ${PREMIUM.commitmentMonths} mois.`
                      : `Vous pouvez aussi souscrire directement, avec un engagement de ${PREMIUM.commitmentMonths} mois.`}
                  </p>
                </ActionForm>
              </>
            ) : null}

            {state.isPremium && state.status !== "CANCEL_AT_PERIOD_END" && state.canCancel ? (
              <ActionForm action={cancelSubscriptionAction} submitLabel="Résilier à la fin de la période" pendingLabel="Résiliation…">
                <p className="text-sm text-muted">
                  Votre engagement est terminé. La résiliation prend effet à la fin de la période en cours, sans frais.
                </p>
              </ActionForm>
            ) : null}

            {state.isPremium && state.status !== "CANCEL_AT_PERIOD_END" && !state.canCancel ? (
              <p className="text-sm text-muted">
                Votre engagement de {PREMIUM.commitmentMonths} mois est en cours jusqu&apos;au{" "}
                {state.commitmentEndsAt ? formatDate(state.commitmentEndsAt) : "—"}. La résiliation sera possible à cette date ;
                elle est bloquée pendant la période offerte et pendant l&apos;engagement.
              </p>
            ) : null}

            {state.status === "CANCEL_AT_PERIOD_END" ? (
              <ActionForm action={resumeSubscriptionAction} submitLabel="Annuler la résiliation" pendingLabel="Reprise…">
                <p className="text-sm text-muted">
                  Votre abonnement est programmé pour s&apos;arrêter le {state.currentPeriodEnd ? formatDate(state.currentPeriodEnd) : "—"}.
                  Vous pouvez revenir en arrière à tout moment.
                </p>
              </ActionForm>
            ) : null}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Ce que Prestige inclut" />
            <CardBody className="space-y-2 text-sm">
              {[
                "Accès aux offres réservées aux membres",
                "Réductions plafonnées sur des achats éligibles",
                "Aucune réduction de la commission : 0,5 % pour tous",
                `Engagement de ${PREMIUM.commitmentMonths} mois, résiliation à l'échéance`,
              ].map((item) => (
                <p key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>{item}</span>
                </p>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Paiement et données" />
            <CardBody className="space-y-2 text-xs leading-5 text-muted">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                Aucune donnée de carte n&apos;est stockée par A2V ; le paiement est délégué au prestataire.
              </p>
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                Le prix, la période offerte et la fin d&apos;engagement sont affichés avant toute activation.
              </p>
              <p>
                Voir les <Link href="/cgu" className="link">CGU &amp; CGV</Link> pour les conditions complètes.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Historique de l&apos;abonnement</h2>
        {events.length ? (
          <div className="space-y-2">
            {events.map((event) => (
              <Card key={event.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-medium">{event.type}</span>
                <span className="text-xs text-muted">{formatDateTime(event.createdAt)}</span>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Aucun événement d&apos;abonnement pour l&apos;instant.</p>
        )}
      </section>
    </div>
  );
}
