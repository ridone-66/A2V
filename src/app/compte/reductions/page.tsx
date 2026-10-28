import type { Metadata } from "next";
import Link from "next/link";
import { BadgePercent, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTrophyLevel } from "@/lib/services/trophies";
import { getPremiumState } from "@/lib/services/premium";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes réductions" };

export default async function DiscountsPage() {
  const user = await requireUser("/compte/reductions");
  const now = new Date();
  const [rules, coupons, redemptions, level, premium] = await Promise.all([
    prisma.rewardRule.findMany({ where: { isActive: true }, orderBy: { minTrophyLevel: "asc" } }),
    prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.couponRedemption.findMany({ where: { userId: user.id }, include: { coupon: true, order: { select: { orderNumber: true } } } }),
    getTrophyLevel(user.id),
    getPremiumState(user.id),
  ]);

  const redemptionCount = new Map<string, number>();
  for (const redemption of redemptions) {
    redemptionCount.set(redemption.couponId, (redemptionCount.get(redemption.couponId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Avantages"
        title="Mes réductions"
        description="Réductions de trophées et codes promotionnels. Une seule réduction est appliquée par commande, toujours côté serveur."
        action={<ButtonLink href="/catalogue" size="sm" variant="outline">Utiliser une réduction</ButtonLink>}
      />

      <Alert tone="info">
        Les réductions s&apos;appliquent au prix de l&apos;article, jamais aux frais de livraison. Elles sont plafonnées et ne sont
        jamais versées en espèces. Le serveur retient la réduction la plus avantageuse entre le code saisi et votre avantage trophée.
      </Alert>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><BadgePercent className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold">Votre niveau de trophée</p>
                <p className="text-xs text-muted">
                  {level.count} victoire{level.count > 1 ? "s" : ""} finalisée{level.count > 1 ? "s" : ""} · niveau {level.level}
                </p>
              </div>
            </div>
            <ButtonLink href="/compte/trophees" variant="outline" size="sm">Voir mes trophées</ButtonLink>
          </div>
        </CardBody>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-bold">Avantages trophées</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {rules.map((rule) => {
            const unlocked = level.count >= rule.minTrophyCount && level.level >= rule.minTrophyLevel;
            const premiumOk = !rule.premiumOnly || premium.isPremium;
            return (
              <Card key={rule.id} className={unlocked && premiumOk ? "border-brand-300 p-4" : "p-4"}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{rule.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{rule.terms}</p>
                  </div>
                  <Badge tone={unlocked && premiumOk ? "success" : "neutral"}>{unlocked && premiumOk ? "Actif" : "Verrouillé"}</Badge>
                </div>
                <p className="mt-3 text-sm">
                  <strong>{(rule.discountBps / 100).toFixed(0)} %</strong>{" "}
                  <span className="text-muted">jusqu&apos;à {formatMoney(rule.maxDiscountCents ?? 0)}, dès {formatMoney(rule.minOrderCents)} d&apos;achat</span>
                </p>
                {!premiumOk ? <p className="mt-2 text-xs text-brand-700">Réservé aux membres Prestige. <Link href="/premium" className="link">Découvrir</Link></p> : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Codes promotionnels actifs</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {coupons.map((coupon) => {
            const used = redemptionCount.get(coupon.id) ?? 0;
            const exhausted = coupon.maxRedemptions !== null && used >= coupon.maxPerUser;
            const premiumBlocked = coupon.premiumOnly && !premium.isPremium;
            const trophyBlocked = level.level < coupon.trophyLevelRequired;
            const available = !exhausted && !premiumBlocked && !trophyBlocked;
            return (
              <Card key={coupon.id} className={available ? "p-4" : "p-4 opacity-75"}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <Ticket className="mt-0.5 h-5 w-5 text-brand-600" />
                    <div>
                      <p className="font-mono text-sm font-bold">{coupon.code}</p>
                      <p className="mt-1 text-xs text-muted">{coupon.description}</p>
                    </div>
                  </div>
                  <Badge tone={available ? "success" : "neutral"}>{available ? "Disponible" : "Indisponible"}</Badge>
                </div>
                <dl className="mt-3 flex flex-wrap gap-4 text-xs">
                  <div><dt className="text-muted">Avantage</dt><dd className="font-semibold">{coupon.discountType === "PERCENT" ? `${(coupon.value / 100).toFixed(0)} %` : formatMoney(coupon.value)}</dd></div>
                  {coupon.maxDiscountCents ? <div><dt className="text-muted">Plafond</dt><dd className="font-semibold">{formatMoney(coupon.maxDiscountCents)}</dd></div> : null}
                  <div><dt className="text-muted">Dès</dt><dd className="font-semibold">{formatMoney(coupon.minOrderCents)}</dd></div>
                  {coupon.endsAt ? <div><dt className="text-muted">Fin</dt><dd className="font-semibold">{formatDate(coupon.endsAt)}</dd></div> : null}
                </dl>
                {exhausted ? <p className="mt-2 text-xs text-muted">Utilisations épuisées pour votre compte.</p> : null}
                {premiumBlocked ? <p className="mt-2 text-xs text-brand-700">Réservé aux membres Prestige.</p> : null}
                {trophyBlocked ? <p className="mt-2 text-xs text-muted">Niveau de trophée {coupon.trophyLevelRequired} requis.</p> : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Réductions déjà utilisées</h2>
        {redemptions.length ? (
          <div className="space-y-2">
            {redemptions.map((redemption) => (
              <Card key={redemption.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span className="font-mono font-semibold">{redemption.coupon.code}</span>
                <span className="text-muted">Commande {redemption.order.orderNumber}</span>
                <span className="font-semibold">− {formatMoney(redemption.amountCents)}</span>
                <span className="text-xs text-muted">{formatDate(redemption.createdAt)}</span>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Aucune réduction utilisée pour l&apos;instant.</p>
        )}
      </section>
    </div>
  );
}
