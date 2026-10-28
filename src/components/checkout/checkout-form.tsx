"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";

type AddressOption = {
  id: string;
  label: string;
  fullName: string;
  line1: string;
  postalCode: string;
  city: string;
};

type Quote = { service: string; label: string; priceCents: number; isSimulated: boolean };

export function CheckoutForm({
  action,
  listingId,
  auctionWinnerId,
  itemPriceCents,
  addresses,
  quotes,
  initialShipping,
  listingTitle,
  isAuction,
  premiumDiscountCents = 0,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  listingId: string;
  auctionWinnerId?: string | null;
  itemPriceCents: number;
  addresses: AddressOption[];
  quotes: Quote[];
  initialShipping?: string;
  listingTitle: string;
  isAuction: boolean;
  premiumDiscountCents?: number;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [shipping, setShipping] = useState(initialShipping ?? quotes[0]?.service ?? "");
  const [coupon, setCoupon] = useState("");
  const [addressId, setAddressId] = useState(addresses.find((address) => address.id)?.id ?? "");
  const errors = state.errors ?? {};
  const errorFor = (name: string) => errors[name]?.[0];

  const shippingCents = quotes.find((quote) => quote.service === shipping)?.priceCents ?? 0;
  const totalCents = Math.max(0, itemPriceCents + shippingCents - premiumDiscountCents);
  const simulated = quotes.some((quote) => quote.isSimulated);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      {auctionWinnerId ? <input type="hidden" name="auctionWinnerId" value={auctionWinnerId} /> : null}

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="Commande impossible">
          {state.message}
        </Alert>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Adresse de livraison</h2>
        {addresses.length === 0 ? (
          <Alert tone="warning" title="Aucune adresse enregistrée" className="mt-3">
            Ajoutez une adresse dans <a className="link" href="/compte/parametres">vos paramètres</a> avant de commander.
          </Alert>
        ) : (
          <div className="mt-4 space-y-2">
            <label htmlFor="addressId" className="label">Choisir une adresse</label>
            <select
              id="addressId"
              name="addressId"
              className="input"
              value={addressId}
              onChange={(event) => setAddressId(event.target.value)}
            >
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label} — {address.fullName}, {address.line1}, {address.postalCode} {address.city}
                </option>
              ))}
            </select>
            {errorFor("addressId") ? <p className="mt-1 text-sm text-danger">{errorFor("addressId")}</p> : null}
            <p className="text-xs text-muted">
              Besoin d&apos;une autre adresse ? <a className="link" href="/compte/parametres">Gérer mes adresses</a>
            </p>
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Mode de livraison</h2>
        {simulated ? (
          <p className="mt-1 text-xs text-amber-700">
            Les tarifs et étiquettes de cet environnement sont simulés. Aucun affranchissement réel n&apos;est effectué.
          </p>
        ) : null}
        <div className="mt-4 space-y-2">
          {quotes.map((quote) => (
            <label
              key={quote.service}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 ${
                shipping === quote.service ? "border-brand-500 bg-brand-50" : "border-brand-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shippingService"
                  value={quote.service}
                  checked={shipping === quote.service}
                  onChange={() => setShipping(quote.service)}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="text-sm font-medium text-ink">{quote.label}</span>
              </span>
              <span className="text-sm font-semibold">{quote.priceCents === 0 ? "Inclus" : formatMoney(quote.priceCents)}</span>
            </label>
          ))}
          {errorFor("shippingService") ? <p className="text-sm text-danger">{errorFor("shippingService")}</p> : null}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Récapitulatif</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{isAuction ? "Offre gagnante" : "Article"}</dt>
            <dd className="font-medium">{listingTitle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Prix de l&apos;article</dt>
            <dd className="font-medium">{formatMoney(itemPriceCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Livraison</dt>
            <dd className="font-medium">{shippingCents === 0 ? "Incluse" : formatMoney(shippingCents)}</dd>
          </div>
          {premiumDiscountCents > 0 ? (
            <div className="flex justify-between gap-4 text-brand-700">
              <dt>Avantage Prestige (−15 %)</dt>
              <dd className="font-medium">− {formatMoney(premiumDiscountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-brand-100 pt-2 text-base font-bold">
            <dt>Total à payer</dt>
            <dd>{formatMoney(totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">
          Une réduction éventuelle (avantage Prestige, trophée ou code) est calculée côté serveur : la plus avantageuse est
          appliquée, sans cumul. La commission A2V de 0,5 % est déjà incluse dans le prix et n&apos;est pas facturée à
          l&apos;acheteur.
        </p>

        <div className="mt-5">
          <label htmlFor="couponCode" className="label">Code de réduction (facultatif)</label>
          <input
            id="couponCode"
            name="couponCode"
            className="input"
            value={coupon}
            onChange={(event) => setCoupon(event.target.value)}
            placeholder="EX. A2VBIENVENUE"
          />
          {errorFor("couponCode") ? <p className="mt-1 text-sm text-danger">{errorFor("couponCode")}</p> : null}
        </div>

        <div className="mt-5">
          <label htmlFor="buyerNote" className="label">Note au vendeur (facultatif)</label>
          <textarea id="buyerNote" name="buyerNote" rows={3} className="input" maxLength={500} placeholder="Instructions de livraison, message…" />
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span>
            J&apos;accepte les <a className="link" href="/cgu" target="_blank">CGV</a> et la politique de confidentialité. Je comprends que le
            vendeur est responsable de l&apos;expédition et que le paiement est protégé jusqu&apos;à la réception.
          </span>
        </label>
        {errorFor("acceptTerms") ? <p className="text-sm text-danger">{errorFor("acceptTerms")}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || addresses.length === 0}>
            {pending ? "Création…" : `Continuer vers le paiement — ${formatMoney(totalCents)}`}
          </Button>
          <p className="text-xs text-muted">Étape suivante : paiement sécurisé (ou simulé en démonstration).</p>
        </div>
      </section>
    </form>
  );
}
