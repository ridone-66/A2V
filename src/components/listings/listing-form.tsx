"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/forms/image-uploader";
import { idleState, type ActionState } from "@/lib/action-state";
import { LISTING_CONDITIONS, requiresPremiumAccess } from "@/lib/config";
import { cn } from "@/lib/utils";

type CategoryOption = { id: string; name: string; children?: Array<{ id: string; name: string }> };

export type ListingFormInitial = {
  id?: string;
  title: string;
  description: string;
  categoryId: string;
  condition: string;
  priceEuros: string;
  saleType: string;
  brand: string;
  size: string;
  color: string;
  locationCity: string;
  locationPostalCode: string;
  shippingCostEuros: string;
  shippingNotes: string;
  images: string[];
  isPremiumOnly: boolean;
  auction?: {
    startsAt: string;
    endsAt: string;
    startPriceEuros: string;
    reserveEuros: string;
    buyNowEuros: string;
    minIncrementEuros: string;
  } | null;
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const emptyListing: ListingFormInitial = {
  title: "",
  description: "",
  categoryId: "",
  condition: "GOOD",
  priceEuros: "",
  saleType: "FIXED_PRICE",
  brand: "",
  size: "",
  color: "",
  locationCity: "",
  locationPostalCode: "",
  shippingCostEuros: "0",
  shippingNotes: "",
  images: [],
  isPremiumOnly: false,
  auction: null,
};

export function ListingForm({
  action,
  categories,
  initial,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: CategoryOption[];
  initial?: ListingFormInitial;
  submitLabel: string;
}) {
  const data = initial ?? emptyListing;
  const [state, formAction, pending] = useActionState(action, idleState);
  const [saleType, setSaleType] = useState(data.saleType);
  const [acceptTerms, setAcceptTerms] = useState(Boolean(initial?.id));
  const [priceEuros, setPriceEuros] = useState(data.priceEuros);
  const [auctionStartPriceEuros, setAuctionStartPriceEuros] = useState(data.auction?.startPriceEuros ?? "");
  const [premiumOnly, setPremiumOnly] = useState(data.isPremiumOnly);

  const displayedPrice = saleType === "AUCTION" ? auctionStartPriceEuros : priceEuros;
  const numericPrice = Number(displayedPrice.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  const numericPriceCents = Number.isFinite(numericPrice) ? Math.round(numericPrice * 100) : 0;
  const requiresPremium = requiresPremiumAccess(numericPriceCents);
  const isPremiumChecked = premiumOnly || requiresPremium;

  const errors = state.errors ?? {};
  const errorFor = (name: string) => errors[name]?.[0];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {data.id ? <input type="hidden" name="listingId" value={data.id} /> : null}

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="Publication impossible">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success" title="Enregistré">
          {state.message}
        </Alert>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">1. Les photos</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Une photo nette, cadrée et bien éclairée augmente vos chances de vente.</p>
        <ImageUploader initial={data.images} />
        {errorFor("images") ? <p className="mt-2 text-sm text-danger">{errorFor("images")}</p> : null}
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">2. Votre article</h2>
          <p className="mt-1 text-sm text-muted">Décrivez précisément l&apos;état, les défauts et ce qui est inclus.</p>
        </div>

        <div>
          <label htmlFor="title" className="label">Titre de l&apos;annonce</label>
          <input id="title" name="title" defaultValue={data.title} className="input" maxLength={120} placeholder="Ex. Fauteuil en velours des années 70" />
          {errorFor("title") ? <p className="mt-1 text-sm text-danger">{errorFor("title")}</p> : null}
        </div>

        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea
            id="description"
            name="description"
            defaultValue={data.description}
            rows={8}
            className="input min-h-[180px]"
            placeholder="Matières, dimensions, défauts éventuels, accessoires inclus…"
          />
          {errorFor("description") ? <p className="mt-1 text-sm text-danger">{errorFor("description")}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="categoryId" className="label">Catégorie</label>
            <select id="categoryId" name="categoryId" defaultValue={data.categoryId} className="input">
              <option value="">Choisir…</option>
              {categories.map((category) => (
                <optgroup key={category.id} label={category.name}>
                  <option value={category.id}>{category.name} (général)</option>
                  {category.children?.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errorFor("categoryId") ? <p className="mt-1 text-sm text-danger">{errorFor("categoryId")}</p> : null}
          </div>
          <div>
            <label htmlFor="condition" className="label">État</label>
            <select id="condition" name="condition" defaultValue={data.condition} className="input">
              {LISTING_CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="brand" className="label">Marque (facultatif)</label>
            <input id="brand" name="brand" defaultValue={data.brand} className="input" maxLength={60} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="size" className="label">Taille (facultatif)</label>
              <input id="size" name="size" defaultValue={data.size} className="input" maxLength={40} />
            </div>
            <div>
              <label htmlFor="color" className="label">Couleur (facultatif)</label>
              <input id="color" name="color" defaultValue={data.color} className="input" maxLength={40} />
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">3. Prix et livraison</h2>
          <p className="mt-1 text-sm text-muted">La publication est gratuite. La commission A2V de 0,5 % n&apos;est due qu&apos;après une vente finalisée.</p>
        </div>

        <fieldset>
          <legend className="label">Type de vente</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { value: "FIXED_PRICE", title: "Prix fixe", text: "L'acheteur paie immédiatement." },
              { value: "AUCTION", title: "Enchère", text: "Les offres sont reçues jusqu'à la clôture." },
            ].map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4",
                  saleType === option.value ? "border-brand-500 bg-brand-50" : "border-brand-100 bg-white",
                )}
              >
                <input
                  type="radio"
                  name="saleType"
                  value={option.value}
                  checked={saleType === option.value}
                  onChange={() => setSaleType(option.value)}
                  className="mt-1 h-4 w-4 accent-brand-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{option.title}</span>
                  <span className="block text-xs text-muted">{option.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {saleType === "AUCTION" ? (
          <div className="grid gap-4 rounded-xl bg-brand-50/60 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="auctionStartPriceEuros" className="label">Prix de départ (€)</label>
              <input id="auctionStartPriceEuros" name="auctionStartPriceEuros" type="text" inputMode="decimal" value={auctionStartPriceEuros} onChange={(event) => setAuctionStartPriceEuros(event.target.value)} className="input" placeholder="20,00" />
              {errorFor("auctionStartPriceEuros") ? <p className="mt-1 text-sm text-danger">{errorFor("auctionStartPriceEuros")}</p> : null}
            </div>
            <div>
              <label htmlFor="auctionMinIncrementEuros" className="label">Incrément minimum (€)</label>
              <input id="auctionMinIncrementEuros" name="auctionMinIncrementEuros" type="text" inputMode="decimal" defaultValue={data.auction?.minIncrementEuros ?? "1,00"} className="input" />
              <p className="mt-1 text-xs text-muted">Minimum 1 €. Sert à calculer l&apos;offre suivante.</p>
            </div>
            <div>
              <label htmlFor="auctionStartsAt" className="label">Début</label>
              <input id="auctionStartsAt" name="auctionStartsAt" type="datetime-local" defaultValue={toLocalInput(data.auction?.startsAt)} className="input" />
              {errorFor("auctionStartsAt") ? <p className="mt-1 text-sm text-danger">{errorFor("auctionStartsAt")}</p> : null}
            </div>
            <div>
              <label htmlFor="auctionEndsAt" className="label">Fin</label>
              <input id="auctionEndsAt" name="auctionEndsAt" type="datetime-local" defaultValue={toLocalInput(data.auction?.endsAt)} className="input" />
              {errorFor("auctionEndsAt") ? <p className="mt-1 text-sm text-danger">{errorFor("auctionEndsAt")}</p> : null}
            </div>
            <div>
              <label htmlFor="auctionReserveEuros" className="label">Prix de réserve (facultatif)</label>
              <input id="auctionReserveEuros" name="auctionReserveEuros" type="text" inputMode="decimal" defaultValue={data.auction?.reserveEuros ?? ""} className="input" placeholder="Laisser vide si aucune réserve" />
              <p className="mt-1 text-xs text-muted">Si la réserve n&apos;est pas atteinte, l&apos;article n&apos;est pas vendu.</p>
              {errorFor("auctionReserveEuros") ? <p className="mt-1 text-sm text-danger">{errorFor("auctionReserveEuros")}</p> : null}
            </div>
            <div>
              <label htmlFor="auctionBuyNowEuros" className="label">Achat immédiat (facultatif)</label>
              <input id="auctionBuyNowEuros" name="auctionBuyNowEuros" type="text" inputMode="decimal" defaultValue={data.auction?.buyNowEuros ?? ""} className="input" placeholder="Ex. 150,00" />
            </div>
            <p className="text-xs text-muted sm:col-span-2">
              Horloge serveur et prolongation anti-sniping : toute offre dans les 2 dernières minutes repousse la clôture de 2 minutes (10 prolongations maximum).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="priceEuros" className="label">Prix (€)</label>
              <input id="priceEuros" name="priceEuros" type="text" inputMode="decimal" value={priceEuros} onChange={(event) => setPriceEuros(event.target.value)} className="input" placeholder="49,90" />
              {errorFor("priceEuros") ? <p className="mt-1 text-sm text-danger">{errorFor("priceEuros")}</p> : null}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="shippingCostEuros" className="label">Frais de livraison indicatifs (€)</label>
            <input id="shippingCostEuros" name="shippingCostEuros" type="text" inputMode="decimal" defaultValue={data.shippingCostEuros} className="input" />
            <p className="mt-1 text-xs text-muted">Le tarif définitif affiché à l&apos;acheteur provient de la grille de livraison configurée.</p>
          </div>
          <div>
            <label htmlFor="shippingNotes" className="label">Précisions d&apos;expédition (facultatif)</label>
            <input id="shippingNotes" name="shippingNotes" defaultValue={data.shippingNotes} className="input" maxLength={500} placeholder="Délai d'envoi, emballage…" />
          </div>
          <div>
            <label htmlFor="locationCity" className="label">Ville (facultatif)</label>
            <input id="locationCity" name="locationCity" defaultValue={data.locationCity} className="input" maxLength={100} />
          </div>
          <div>
            <label htmlFor="locationPostalCode" className="label">Code postal (facultatif)</label>
            <input id="locationPostalCode" name="locationPostalCode" defaultValue={data.locationPostalCode} className="input" inputMode="numeric" maxLength={5} />
            {errorFor("locationPostalCode") ? <p className="mt-1 text-sm text-danger">{errorFor("locationPostalCode")}</p> : null}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">4. Options et validation</h2>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="isPremiumOnly"
            checked={isPremiumChecked}
            onChange={(event) => setPremiumOnly(event.target.checked)}
            disabled={requiresPremium}
            className="mt-0.5 h-4 w-4 accent-brand-600 disabled:opacity-70"
          />
          <span>
            Réserver cette annonce aux membres <strong>A2V Prestige</strong>
            <span className="block text-xs text-muted">
              {requiresPremium
                ? "Obligatoire : au-dessus de 10 000 €, l'annonce est automatiquement réservée aux membres Prestige (contrôle serveur)."
                : "Les non-membres ne verront pas cette annonce. Aucun abonnement n'est obligatoire pour vendre."}
            </span>
          </span>
        </label>

        {requiresPremium ? (
          <p className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs leading-5 text-muted">
            <strong className="text-ink">Annonce à plus de 10 000 € :</strong> elle est réservée aux membres Prestige, qui
            bénéficient de 10 % de réduction sur le prix de l&apos;article. Les non-membres ne peuvent ni la voir ni l&apos;acheter.
          </p>
        ) : null}

        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="acceptSaleTerms"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            J&apos;accepte les <a className="link" href="/cgu" target="_blank">conditions de vente</a> et je certifie être le propriétaire de cet article.
            <span className="block text-xs text-muted">La commission de 0,5 % sur le prix de l&apos;article, hors livraison, est prélevée uniquement lors d&apos;une vente finalisée.</span>
          </span>
        </label>
        {errorFor("acceptSaleTerms") ? <p className="text-sm text-danger">{errorFor("acceptSaleTerms")}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </section>
    </form>
  );
}
