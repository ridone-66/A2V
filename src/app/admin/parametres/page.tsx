import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAllSettings } from "@/lib/services/settings";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { adminUpdateSettingAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Paramètres" };

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "");
}

function label(key: string): string {
  const labels: Record<string, string> = {
    "commission.rateBps": "Taux de commission (points de base)",
    "commission.base": "Base de calcul de la commission",
    "premium.priceCents": "Prix Prestige (centimes)",
    "premium.trialMonths": "Mois d'essai Prestige",
    "donation.minCents": "Don minimum (centimes)",
    "donation.maxCents": "Don maximum (centimes)",
    "donation.suggestedCents": "Montants suggérés (centimes, séparés par des virgules)",
    "charity.platformContributionBps": "Contribution solidaire A2V (points de base)",
    "auction.paymentDeadlineHours": "Délai de paiement d'une enchère (heures)",
    "auction.extensionWindowSeconds": "Fenêtre anti-sniping (secondes)",
    "auction.extensionSeconds": "Prolongation anti-sniping (secondes)",
    "auction.maxExtensions": "Prolongations maximales",
    "auction.minIncrementCents": "Incrément minimum (centimes)",
    "order.finalizationDelayDays": "Délai de protection avant finalisation (jours)",
    "shipping.simulationEnabled": "Livraison simulée activée",
    "messaging.maxMessagesPerHour": "Messages maximum par heure",
    "platform.supportEmail": "E-mail de support",
    "platform.legalName": "Raison sociale",
    "platform.legalAddress": "Adresse du siège",
    "platform.siret": "SIRET",
    "platform.publicationDirector": "Directeur de publication",
    "platform.vatNumber": "TVA intracommunautaire",
    "charity.collectedDisclosure": "Mention publique sur les dons",
  };
  return labels[key] ?? key;
}

const SENSITIVE = new Set([
  "commission.rateBps",
  "commission.base",
  "charity.platformContributionBps",
  "auction.paymentDeadlineHours",
  "auction.extensionWindowSeconds",
  "auction.extensionSeconds",
  "auction.maxExtensions",
  "order.finalizationDelayDays",
]);

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const settings = await getAllSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Paramètres de la plateforme"
        description="Les valeurs sont lues côté serveur et retombent sur des défauts sûrs. Toute modification est journalisée."
      />

      <Alert tone="warning" title="Paramètres sensibles">
        Modifier la commission, les délais d&apos;enchère ou la finalisation change immédiatement le comportement du serveur. Les
        commandes déjà créées conservent leurs montants enregistrés. En production, exigez une revue et une sauvegarde avant
        modification.
      </Alert>

      <Card>
        <CardHeader title="Valeurs" description="Une valeur par champ. Les listes sont séparées par des virgules." />
        <CardBody>
          <div className="space-y-3">
            {settings.map((setting) => (
              <details key={setting.key} className="rounded-xl border border-brand-100 p-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{label(setting.key)}</p>
                    <p className="font-mono text-[11px] text-muted">{setting.key}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {setting.isDefault ? <span className="text-[11px] text-muted">défaut</span> : <span className="text-[11px] font-semibold text-brand-700">modifié</span>}
                    <span className="max-w-[220px] truncate rounded bg-brand-50 px-2 py-0.5 font-mono text-[11px]">{formatValue(setting.value)}</span>
                  </div>
                </summary>
                <ActionForm action={adminUpdateSettingAction} submitLabel="Enregistrer" pendingLabel="…" className="mt-3">
                  <input type="hidden" name="key" value={setting.key} />
                  <label htmlFor={`value-${setting.key}`} className="label">Nouvelle valeur</label>
                  <input
                    id={`value-${setting.key}`}
                    name="value"
                    className="input"
                    defaultValue={formatValue(setting.value)}
                    required
                  />
                  {SENSITIVE.has(setting.key) ? (
                    <p className="flex items-center gap-2 text-xs text-amber-700">
                      <Settings className="h-3.5 w-3.5" /> Paramètre sensible : vérifiez l&apos;unité (points de base, secondes, jours).
                    </p>
                  ) : null}
                </ActionForm>
              </details>
            ))}
          </div>
        </CardBody>
      </Card>

      <p className="text-xs leading-5 text-muted">
        Rappel : 50 points de base = 0,5 %. La commission porte sur le prix final de l&apos;article, hors frais de livraison. La
        publication reste gratuite et aucun abonnement n&apos;est obligatoire.
      </p>
    </div>
  );
}
