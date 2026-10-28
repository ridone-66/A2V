import type { Metadata } from "next";
import Link from "next/link";
import { Bell, MapPin, Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listAddresses } from "@/lib/services/users";
import { getNotificationPreferences } from "@/lib/services/notifications";
import { NOTIFICATION_TYPES } from "@/lib/config";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateNotificationPreferencesAction,
} from "@/app/actions/account";

export const metadata: Metadata = { title: "Paramètres" };

const LABELS: Record<string, string> = {
  ORDER_CREATED: "Commande créée",
  ORDER_PAID: "Paiement confirmé",
  ORDER_SHIPPED: "Commande expédiée",
  ORDER_DELIVERED: "Commande livrée",
  ORDER_FINALIZED: "Vente finalisée",
  ORDER_CANCELLED: "Commande annulée",
  AUCTION_BID: "Nouvelle offre sur une enchère suivie",
  AUCTION_OUTBID: "Offre dépassée",
  AUCTION_WON: "Enchère remportée",
  AUCTION_ENDED: "Enchère terminée",
  AUCTION_PAYMENT_PENDING: "Paiement d'enchère en attente",
  AUCTION_PAYMENT_DEFAULTED: "Défaut de paiement d'enchère",
  TROPHY_AWARDED: "Trophée obtenu",
  DISCOUNT_UNLOCKED: "Réduction débloquée",
  SUBSCRIPTION: "Abonnement Prestige",
  DONATION: "Dons",
  MESSAGE: "Nouveaux messages",
  REVIEW: "Avis reçus",
};

export default async function SettingsPage() {
  const user = await requireUser("/compte/parametres");
  const [addresses, preferences] = await Promise.all([listAddresses(user.id), getNotificationPreferences(user.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compte"
        title="Paramètres"
        description="Adresses de livraison et préférences de notification. Les modifications sont enregistrées côté serveur."
      />

      <Card>
        <CardHeader
          title="Adresses de livraison"
          description="Utilisées au moment de la commande. Elles ne sont jamais visibles publiquement."
        />
        <CardBody className="space-y-4">
          {addresses.length ? (
            <ul className="space-y-3">
              {addresses.map((address) => (
                <li key={address.id} className="rounded-xl border border-brand-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="text-sm">
                        <p className="font-semibold">
                          {address.label}
                          {address.isDefault ? <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-800">Par défaut</span> : null}
                        </p>
                        <p className="text-muted">{address.fullName}</p>
                        <p className="text-muted">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
                        <p className="text-muted">{address.postalCode} {address.city} · {address.country}</p>
                        {address.phone ? <p className="text-xs text-muted">{address.phone}</p> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!address.isDefault ? (
                        <form action={setDefaultAddressAction}>
                          <input type="hidden" name="addressId" value={address.id} />
                          <SubmitButton variant="outline" size="sm" pendingLabel="…">Par défaut</SubmitButton>
                        </form>
                      ) : null}
                      <form action={deleteAddressAction}>
                        <input type="hidden" name="addressId" value={address.id} />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                          <Trash2 className="h-4 w-4" /> Supprimer
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucune adresse enregistrée. Ajoutez-en une pour pouvoir commander.</p>
          )}

          <details className="rounded-xl border border-brand-100 p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-brand-700">
              <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Ajouter une adresse</span>
            </summary>
            <ActionForm action={addAddressAction} submitLabel="Enregistrer l'adresse" pendingLabel="Enregistrement…" className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="label" className="label">Libellé</label>
                  <input id="label" name="label" className="input" maxLength={40} placeholder="Domicile, Bureau…" />
                </div>
                <div>
                  <label htmlFor="fullName" className="label">Nom complet</label>
                  <input id="fullName" name="fullName" className="input" maxLength={120} required defaultValue={user.publicName} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="line1" className="label">Adresse</label>
                  <input id="line1" name="line1" className="input" maxLength={160} required placeholder="12 rue des Exemples" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="line2" className="label">Complément (facultatif)</label>
                  <input id="line2" name="line2" className="input" maxLength={160} placeholder="Bâtiment B, appartement 4" />
                </div>
                <div>
                  <label htmlFor="postalCode" className="label">Code postal</label>
                  <input id="postalCode" name="postalCode" className="input" inputMode="numeric" maxLength={5} required placeholder="75011" />
                </div>
                <div>
                  <label htmlFor="city" className="label">Ville</label>
                  <input id="city" name="city" className="input" maxLength={100} required placeholder="Paris" />
                </div>
                <div>
                  <label htmlFor="country" className="label">Pays</label>
                  <select id="country" name="country" className="input" defaultValue="FR">
                    <option value="FR">France</option>
                    <option value="BE">Belgique</option>
                    <option value="LU">Luxembourg</option>
                    <option value="CH">Suisse</option>
                  </select>
                  <p className="mt-1 text-xs text-muted">La grille de livraison par défaut couvre la France métropolitaine.</p>
                </div>
                <div>
                  <label htmlFor="phone" className="label">Téléphone (facultatif)</label>
                  <input id="phone" name="phone" className="input" maxLength={20} placeholder="06 12 34 56 78" />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="isDefault" className="h-4 w-4 accent-brand-600" /> Définir comme adresse par défaut
              </label>
            </ActionForm>
          </details>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Préférences de notification"
          description="Choisissez ce que vous recevez dans l'application et par e-mail. Les notifications de sécurité et de transaction essentielles restent liées à votre compte."
        />
        <CardBody>
          <ActionForm action={updateNotificationPreferencesAction} submitLabel="Enregistrer mes préférences" pendingLabel="Enregistrement…">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 px-4 text-center">Dans l&apos;application</th>
                    <th className="py-2 pl-4 text-center">Par e-mail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {NOTIFICATION_TYPES.map((type) => {
                    const preference = preferences.get(type);
                    return (
                      <tr key={type}>
                        <td className="py-2.5 pr-4">{LABELS[type] ?? type}</td>
                        <td className="py-2.5 px-4 text-center">
                          <input
                            type="checkbox"
                            name={`${type}.inApp`}
                            defaultChecked={preference?.inApp ?? true}
                            className="h-4 w-4 accent-brand-600"
                            aria-label={`${LABELS[type] ?? type} dans l'application`}
                          />
                        </td>
                        <td className="py-2.5 pl-4 text-center">
                          <input
                            type="checkbox"
                            name={`${type}.email`}
                            defaultChecked={preference?.email ?? true}
                            className="h-4 w-4 accent-brand-600"
                            aria-label={`${LABELS[type] ?? type} par e-mail`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Alert tone="info" className="mt-4">
              <span className="inline-flex items-start gap-2">
                <Bell className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  En l&apos;absence de SMTP configuré, les e-mails ne partent pas : ils sont journalisés côté serveur. Les
                  notifications dans l&apos;application restent consultables dans <Link href="/compte/notifications" className="link">votre compte</Link>.
                </span>
              </span>
            </Alert>
          </ActionForm>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/compte/profil" variant="outline">Modifier mon profil</ButtonLink>
        <ButtonLink href="/compte/securite" variant="outline">Sécurité du compte</ButtonLink>
        <ButtonLink href="/compte/confidentialite" variant="outline">Mes données personnelles</ButtonLink>
      </div>
    </div>
  );
}
