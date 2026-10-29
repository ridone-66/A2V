-- A2V Prestige : 15 €/mois, 3 mois offerts, engagement de 12 mois.
-- La résiliation est bloquée pendant la période offerte et l'engagement.

ALTER TABLE "Subscription" ADD COLUMN "commitmentEndsAt" TIMESTAMP(3);

-- Reprise des abonnements existants : engagement de 12 mois après l'essai.
UPDATE "Subscription"
SET "commitmentEndsAt" = ("trialEndsAt" + INTERVAL '12 months')
WHERE "commitmentEndsAt" IS NULL
  AND "trialEndsAt" IS NOT NULL
  AND "status" IN ('TRIALING', 'ACTIVE');

UPDATE "Subscription"
SET "commitmentEndsAt" = ("createdAt" + INTERVAL '12 months')
WHERE "commitmentEndsAt" IS NULL
  AND "status" IN ('TRIALING', 'ACTIVE');

-- Paramètres métier et offre commerciale.
UPDATE "PlatformSetting" SET "value" = '1500'::jsonb, "updatedAt" = NOW() WHERE "key" = 'premium.priceCents';
UPDATE "PlatformSetting" SET "value" = '90'::jsonb, "updatedAt" = NOW() WHERE "key" = 'premium.trialDays';

UPDATE "PremiumOffer"
SET "priceCents" = 1500, "trialDays" = 90, "updatedAt" = NOW()
WHERE "code" = 'PRESTIGE_MONTHLY';
