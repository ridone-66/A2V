import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Lock, Sparkles, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTrophyProgress } from "@/lib/services/trophies";
import { getPremiumState } from "@/lib/services/premium";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes trophées" };

export default async function AccountTrophiesPage() {
  const user = await requireUser("/compte/trophees");
  const [progress, awards, rules, premium] = await Promise.all([
    getTrophyProgress(user.id),
    prisma.userTrophy.findMany({ where: { userId: user.id }, orderBy: { awardedAt: "desc" }, include: { definition: true, sourceOrder: { select: { orderNumber: true } } } }),
    prisma.rewardRule.findMany({ where: { isActive: true }, orderBy: { minTrophyLevel: "asc" } }),
    getPremiumState(user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Avantages"
        title="Mes trophées"
        description="Les trophées récompensent les enchères remportées et finalisées. Ils débloquent des réductions plafonnées, jamais de l'argent liquide."
        action={<ButtonLink href="/encheres" variant="outline" size="sm">Participer à une enchère</ButtonLink>}
      />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><Trophy className="h-7 w-7" /></span>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-200">Victoires finalisées</p>
                <p className="text-3xl font-bold">{progress.wins}</p>
                <p className="text-sm text-brand-100">
                  {progress.next ? `Prochain palier : ${progress.next.name} à ${progress.next.thresholdWins} victoire${progress.next.thresholdWins > 1 ? "s" : ""}` : "Tous les paliers sont débloqués"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-brand-200">Trophées obtenus</p>
              <p className="text-3xl font-bold">{progress.trophyCount}</p>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress.progressToNext}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {progress.definitions.map((definition) => (
          <Card key={definition.id} className={definition.earned ? "border-brand-300 bg-brand-50/40 p-5" : "p-5"}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl" aria-hidden="true">{definition.icon ?? "🏆"}</span>
              {definition.earned ? (
                <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Obtenu</Badge>
              ) : (
                <Badge tone="neutral"><Lock className="h-3 w-3" /> À débloquer</Badge>
              )}
            </div>
            <h2 className="mt-2 font-bold">{definition.name}</h2>
            <p className="mt-1 text-xs leading-5 text-muted">{definition.description}</p>
            <p className="mt-2 text-xs font-semibold text-brand-700">
              {definition.thresholdWins} victoire{definition.thresholdWins > 1 ? "s" : ""} finalisée{definition.thresholdWins > 1 ? "s" : ""}
            </p>
            {definition.awardedAt ? <p className="mt-1 text-[11px] text-muted">Obtenu le {formatDate(definition.awardedAt)}</p> : null}
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Historique des trophées</h2>
        {awards.length ? (
          <div className="space-y-2">
            {awards.map((award) => (
              <Card key={award.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold">{award.definition.icon} {award.definition.name}</p>
                  <p className="text-xs text-muted">
                    {award.sourceOrder ? `Commande ${award.sourceOrder.orderNumber}` : "Source non disponible"} · {formatDate(award.awardedAt)}
                  </p>
                </div>
                <Badge tone="brand">Débloqué</Badge>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-sm text-muted">
              Aucun trophée pour l&apos;instant. Il faut remporter une enchère, la payer, recevoir l&apos;article et laisser la vente
              se finaliser. <Link href="/encheres" className="link">Voir les enchères</Link>.
            </CardBody>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-brand-600" /> Réductions liées aux trophées</h2>
        <p className="mb-3 text-sm text-muted">
          La réduction est calculée côté serveur au moment de la commande. Une seule réduction par commande, dans la limite du
          plafond. Elle ne s&apos;applique jamais aux frais de livraison.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {rules.map((rule) => {
            const available = progress.wins >= rule.minTrophyCount && progress.currentLevel >= rule.minTrophyLevel;
            return (
              <Card key={rule.id} className={available ? "border-brand-300 p-4" : "p-4 opacity-80"}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{rule.name}</p>
                    <p className="mt-1 text-xs text-muted">{rule.terms}</p>
                  </div>
                  <Badge tone={available ? "success" : "neutral"}>{available ? "Disponible" : "Verrouillée"}</Badge>
                </div>
                <dl className="mt-3 flex flex-wrap gap-4 text-xs">
                  <div><dt className="text-muted">Réduction</dt><dd className="font-semibold">{(rule.discountBps / 100).toFixed(0)} %</dd></div>
                  <div><dt className="text-muted">Plafond</dt><dd className="font-semibold">{formatMoney(rule.maxDiscountCents ?? 0)}</dd></div>
                  <div><dt className="text-muted">Dès</dt><dd className="font-semibold">{formatMoney(rule.minOrderCents)}</dd></div>
                  {rule.premiumOnly ? <div><dt className="text-muted">Prestige</dt><dd className="font-semibold">{premium.isPremium ? "Actif" : "Requis"}</dd></div> : null}
                </dl>
              </Card>
            );
          })}
        </div>
      </section>

      <Alert tone="info" title="Aucun crédit automatique">
        Les trophées ne sont ni une monnaie, ni une cagnotte, ni un virement. Ils ne peuvent pas être échangés contre de
        l&apos;argent et ne réduisent pas la commission A2V.
      </Alert>
    </div>
  );
}
