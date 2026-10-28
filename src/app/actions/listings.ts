"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ListingCondition, SaleType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { parseEurosToCents } from "@/lib/money";
import { formBool, formString, formStringOrUndefined } from "@/lib/forms";
import { errorState, successState, zodToFieldErrors, type ActionState } from "@/lib/action-state";
import { listingSchema, reportSchema } from "@/lib/validation/schemas";
import {
  createListing,
  reportListing,
  setListingStatus,
  toggleFavorite,
  updateListing,
  type ListingImageInput,
} from "@/lib/services/listings";

function message(error: unknown): string {
  return isAppError(error) ? error.message : "Une erreur est survenue. Réessayez.";
}

type ParsedListing = {
  title: string;
  description: string;
  categoryId: string;
  condition: ListingCondition;
  priceCents: number;
  saleType: SaleType;
  brand: string | null;
  size: string | null;
  color: string | null;
  locationCity: string | null;
  locationPostalCode: string | null;
  shippingCostCents: number;
  shippingNotes: string | null;
  images: ListingImageInput[];
  isPremiumOnly: boolean;
  auction: {
    startsAt: Date;
    endsAt: Date;
    startPriceCents: number;
    reservePriceCents: number | null;
    buyNowPriceCents: number | null;
    minIncrementCents: number;
  } | null;
};

function parseListingForm(formData: FormData):
  | { ok: true; data: ParsedListing }
  | { ok: false; state: ActionState } {
  const images = formData
    .getAll("images")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((url) => ({ url: url.trim() }));

  const parsed = listingSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    categoryId: formString(formData, "categoryId"),
    condition: formString(formData, "condition"),
    priceEuros: formString(formData, "priceEuros"),
    saleType: formString(formData, "saleType") || "FIXED_PRICE",
    brand: formString(formData, "brand"),
    size: formString(formData, "size"),
    color: formString(formData, "color"),
    locationCity: formString(formData, "locationCity"),
    locationPostalCode: formString(formData, "locationPostalCode"),
    shippingCostEuros: formString(formData, "shippingCostEuros") || "0",
    shippingNotes: formString(formData, "shippingNotes"),
    images,
    isPremiumOnly: formBool(formData, "isPremiumOnly"),
    acceptSaleTerms: formBool(formData, "acceptSaleTerms"),
    auctionStartsAt: formStringOrUndefined(formData, "auctionStartsAt"),
    auctionEndsAt: formStringOrUndefined(formData, "auctionEndsAt"),
    auctionStartPriceEuros: formStringOrUndefined(formData, "auctionStartPriceEuros"),
    auctionReserveEuros: formStringOrUndefined(formData, "auctionReserveEuros"),
    auctionBuyNowEuros: formStringOrUndefined(formData, "auctionBuyNowEuros"),
    auctionMinIncrementEuros: formStringOrUndefined(formData, "auctionMinIncrementEuros"),
  });

  if (!parsed.success) {
    return { ok: false, state: errorState("Vérifiez les informations de l'annonce.", zodToFieldErrors(parsed.error)) };
  }
  const data = parsed.data;

  let auction: ParsedListing["auction"] = null;
  if (data.saleType === "AUCTION") {
    const startsAt = new Date(data.auctionStartsAt ?? "");
    const endsAt = new Date(data.auctionEndsAt ?? "");
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      return { ok: false, state: errorState("Dates d'enchère invalides.") };
    }
    auction = {
      startsAt,
      endsAt,
      startPriceCents: parseEurosToCents(data.auctionStartPriceEuros ?? "0"),
      reservePriceCents: data.auctionReserveEuros ? parseEurosToCents(data.auctionReserveEuros) : null,
      buyNowPriceCents: data.auctionBuyNowEuros ? parseEurosToCents(data.auctionBuyNowEuros) : null,
      minIncrementCents: data.auctionMinIncrementEuros
        ? Math.max(100, parseEurosToCents(data.auctionMinIncrementEuros))
        : 100,
    };
  }

  return {
    ok: true,
    data: {
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      condition: data.condition,
      priceCents: data.saleType === "AUCTION" ? auction!.startPriceCents : parseEurosToCents(data.priceEuros),
      saleType: data.saleType,
      brand: data.brand || null,
      size: data.size || null,
      color: data.color || null,
      locationCity: data.locationCity || null,
      locationPostalCode: data.locationPostalCode || null,
      shippingCostCents: parseEurosToCents(data.shippingCostEuros),
      shippingNotes: data.shippingNotes || null,
      images,
      isPremiumOnly: data.isPremiumOnly,
      auction,
    },
  };
}

export async function createListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour publier une annonce.");

  const parsed = parseListingForm(formData);
  if (!parsed.ok) return parsed.state;

  try {
    const listing = await createListing(user.id, parsed.data);
    revalidatePath("/");
    revalidatePath("/catalogue");
    revalidatePath("/encheres");
    revalidatePath("/compte/annonces");
    redirect(listing.saleType === "AUCTION" ? `/encheres/${listing.slug}` : `/annonce/${listing.slug}`);
  } catch (error) {
    if (isAppError(error)) return errorState(error.message, error.fieldErrors);
    throw error;
  }
}

export async function updateListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour modifier cette annonce.");
  const listingId = formString(formData, "listingId");
  if (!listingId) return errorState("Annonce introuvable.");

  const parsed = parseListingForm(formData);
  if (!parsed.ok) return parsed.state;

  try {
    const listing = await updateListing(listingId, user.id, parsed.data);
    revalidatePath("/compte/annonces");
    revalidatePath(`/annonce/${listing.slug}`);
    revalidatePath(`/encheres/${listing.slug}`);
    return successState("Annonce mise à jour.");
  } catch (error) {
    return errorState(message(error), isAppError(error) ? error.fieldErrors : undefined);
  }
}

export async function listingStatusAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const listingId = formString(formData, "listingId");
  const action = formString(formData, "action");
  if (!listingId || !["publish", "pause", "delete"].includes(action)) return;
  try {
    await setListingStatus(listingId, user.id, action as "publish" | "pause" | "delete");
  } catch {
    // Les erreurs sont reflétées par la page après revalidation.
  }
  revalidatePath("/compte/annonces");
  revalidatePath("/catalogue");
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?next=${encodeURIComponent(formString(formData, "returnTo") || "/catalogue")}`);
  }
  const listingId = formString(formData, "listingId");
  if (!listingId) return;
  try {
    await toggleFavorite(user.id, listingId);
  } catch {
    // Silencieux : l'état est revalidé ci-dessous.
  }
  const returnTo = formString(formData, "returnTo");
  if (returnTo.startsWith("/")) revalidatePath(returnTo);
  revalidatePath("/compte/favoris");
}

export async function reportListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Connectez-vous pour signaler une annonce.");
  const parsed = reportSchema.safeParse({
    listingId: formString(formData, "listingId"),
    reason: formString(formData, "reason"),
    details: formString(formData, "details"),
  });
  if (!parsed.success) return errorState("Vérifiez le formulaire.", zodToFieldErrors(parsed.error));

  try {
    await reportListing({
      listingId: parsed.data.listingId,
      reporterId: user.id,
      reason: parsed.data.reason,
      details: parsed.data.details || undefined,
    });
    return successState(
      "Signalement transmis à la modération. Vous serez informé de la suite donnée. Aucune information confidentielle n'est publiée.",
    );
  } catch (error) {
    return errorState(message(error));
  }
}
