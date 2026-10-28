import type { Metadata } from "next";
import Link from "next/link";
import { Award, CheckCircle2, Info, Lock, Sparkles, Ticket, Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getTrophyProgress } from "@/lib/services/trophies";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { TrophyDecoration } from "@/components/trophies/trophy-decoration";

export const metadata: Metadata = {
  title: "Trophées et réductions",
  description:
    "Les trophées A2V récompensent les enchères remportées et finalisées. Ils débloquent des réductions configurables, jamais un crédit automatique en argent.",
};

export default async function TrophiesPage() {
  const user = await getCurrentUser();
  const [definitions, rules, progress] = await Promise.all([
    prisma.trophyDefinition.findMany({ where: { isActive: true }, orderBy: { level: "asc" } }),
    prisma.rewardRule.findMany({ where: { isActive: true }, orderBy: { minTrophyLevel: "asc" } }),
    user ? getTrophyProgress(user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="relative mb-8 xl:px-52">
        <TrophyDecoration side="left" />
        <TrophyDecoration side="right" />
        <div className="relative">
          <Breadcrumbs items={[{ label: "Trophées & réductions" }]} />
          <PageHeader
            eyebrow="Récompenses"
            title="Des trophées qui récompensent les ventes réellement finalisées"
            description="Un trophée n'est pas attribué à la clôture d'une enchère : il faut que la commande soit payée, livrée et finalisée. Aucun trophée ne donne de l'argent liquide."
            action={
              user ? (
                <ButtonLink href="/compte/trophees" variant="outline" size="sm">Voir ma progression</ButtonLink>
              ) : (
                <ButtonLink href="/inscription" size="sm">Créer un compte</ButtonLink>
              )
            }
          />

          <Alert tone="info">
            <span className="inline-flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Les trophées sont attribués uniquement après une enchère remportée <strong>et finalisée</strong>. Ils débloquent des
                réductions plafonnées sur de futurs achats, appliquées côté serveur. Aucun crédit automatique, aucune cagnotte, aucun
                virement.
              </span>
            </span>
          </Alert>
        </div>
      </div>

      {user && progress ? (
        <Card className="mb-8 overflow-hidden">
          <div className="bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <Trophy className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-brand-200">Votre progression</p>
                  <p className="text-2xl font-bold">
                    {progress.wins} victoire{progress.wins > 1 ? "s" : ""} finalisée{progress.wins > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-brand-200">
                    {progress.next
                      ? `Prochain palier : ${progress.next.name} à ${progress.next.thresholdWins} victoires`
                      : "Tous les paliers sont débloqués"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-brand-200">Trophées obtenus</p>
                <p className="text-2xl font-bold">{progress.trophyCount}</p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress.progressToNext}%` }} />
            </div>
            {progress.next ? (
              <p className="mt-2 text-xs text-brand-200">
                Encore {Math.max(0, progress.next.thresholdWins - progress.wins)} victoire
                {progress.next.thresholdWins - progress.wins > 1 ? "s" : ""} pour débloquer {progress.next.name}.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold">Les paliers</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {definitions.map((definition) => {
            const earned = progress?.definitions.find((candidate) => candidate.id === definition.id)?.earned ?? false;
            const award = progress?.definitions.find((candidate) => candidate.id === definition.id);
            return (
              <Card key={definition.id} className={`p-5 text-center ${earned ? "border-brand-300 bg-brand-50/60" : ""}`}>
                <span className="text-4xl" aria-hidden="true">{definition.icon ?? "🏆"}</span>
                <h3 className="mt-2 text-base font-bold">{definition.name}</h3>
                <p className="mt-1 text-xs text-muted">{definition.description}</p>
                <p className="mt-3 text-xs font-semibold text-brand-700">
                  {definition.thresholdWins} victoire{definition.thresholdWins > 1 ? "s" : ""}
                </p>
                {user ? (
                  earned ? (
                    <Badge tone="success" className="mt-3">
                      <CheckCircle2 className="h-3 w-3" /> Obtenu
                    </Badge>
                  ) : (
                    <Badge tone="neutral" className="mt-3">
                      <Lock className="h-3 w-3" /> À débloquer
                    </Badge>
                  )
                ) : null}
                {award?.awardedAt ? (
                  <p className="mt-2 text-[11px] text-muted">Le {formatDate(award.awardedAt)}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl font-bold">Réductions débloquées par les trophées</h2>
        <p className="mb-4 text-sm text-muted">
          Une réduction automatique par commande, dans la limite du plafond indiqué. Elle s&apos;applique au prix de l&apos;article,
          hors livraison. Les règles sont configurables par l&apos;administration et vérifiées côté serveur.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Ticket className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{rule.name}</h3>
                    <p className="mt-1 text-xs text-muted">{rule.terms}</p>
                  </div>
                </div>
                {rule.premiumOnly ? <Badge tone="brand">Prestige</Badge> : null}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Réduction</dt>
                  <dd className="font-semibold">{(rule.discountBps / 100).toFixed(0)} %</dd>
                </div>
                <div>
                  <dt className="text-muted">Plafond</dt>
                  <dd className="font-semibold">{formatMoney(rule.maxDiscountCents ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Dès</dt>
                  <dd className="font-semibold">{formatMoney(rule.minOrderCents)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Comment gagner un trophée ?</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Remportez une enchère sur A2V.</li>
            <li>Payez dans le délai indiqué (48 heures).</li>
            <li>Recevez l&apos;article et confirmez la réception.</li>
            <li>La vente est finalisée après le délai de protection, sans litige.</li>
            <li>Le trophée correspondant à votre nombre de victoires finalisées est attribué automatiquement.</li>
          </ol>
          <ButtonLink href="/encheres" className="mt-5" size="sm">Découvrir les enchères</ButtonLink>
        </Card>
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-brand-600" /> Ce que les trophées ne sont pas
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Pas une monnaie virtuelle convertible en euros.</li>
            <li>Pas un crédit automatique sur votre compte bancaire.</li>
            <li>Pas une réduction cumulable avec un code promo sur la même commande.</li>
            <li>Pas un avantage promis sans plafond : chaque règle affiche son plafond.</li>
            <li>Pas attribués sur une simple mise ou une enchère non payée.</li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            Consultez vos trophées et vos réductions disponibles dans <Link href="/compte/trophees" className="link">votre compte</Link>.
          </p>
        </Card>
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted">
        <Award className="h-4 w-4" /> Les règles affichées proviennent de la base de données et peuvent évoluer ; les conditions
        applicables sont celles affichées au moment de la commande.
      </p>
    </div>
  );
}
