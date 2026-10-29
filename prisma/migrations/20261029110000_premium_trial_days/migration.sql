-- Essai Prestige : 90 jours (3 mois) et durée exprimée en jours.
-- Cette migration précède l'ajout de la date d'engagement.

ALTER TABLE "PremiumOffer" RENAME COLUMN "trialMonths" TO "trialDays";
ALTER TABLE "PremiumOffer" ALTER COLUMN "trialDays" SET DEFAULT 90;
UPDATE "PremiumOffer" SET "trialDays" = 90;

UPDATE "PlatformSetting"
SET "key" = 'premium.trialDays', "value" = '90'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'premium.trialMonths';

INSERT INTO "PlatformSetting" ("key", "value", "description", "updatedAt")
SELECT 'premium.trialDays', '90'::jsonb, NULL, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "PlatformSetting" WHERE "key" = 'premium.trialDays');
