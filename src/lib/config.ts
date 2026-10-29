/**
 * Configuration produit / marché.
 * Le marché initial est la France (EUR, Europe/Paris). Les helpers acceptent
 * une locale afin de préparer l'internationalisation.
 */
export const APP_NAME = "A2V";
export const MARKET = {
  locale: "fr-FR",
  currency: "EUR",
  timezone: "Europe/Paris",
  country: "FR",
} as const;

export const ROUTES = {
  home: "/",
  catalog: "/catalogue",
  auctions: "/encheres",
  premium: "/premium",
  trophies: "/trophees",
  charity: "/solidarite",
  donate: "/dons",
  login: "/connexion",
  register: "/inscription",
  account: "/compte",
  admin: "/admin",
} as const;

/**
 * A2V Prestige : 15 € par mois, 3 mois offerts puis engagement de 12 mois.
 * Pendant la période offerte et pendant l'engagement, la résiliation n'est
 * pas possible ; elle le devient à la date d'échéance de l'engagement.
 */
export const PREMIUM = {
  priceCents: 1_500,
  trialDays: 90,
  commitmentMonths: 12,
  currency: "EUR",
  label: "A2V Prestige Club",
} as const;

/**
 * Libellé français d'une durée exprimée en jours.
 * Les durées multiples de 30 sont affichées en mois (« 3 mois »), les
 * multiples de 7 en semaines (« 1 semaine »).
 */
export function trialDurationLabel(days: number): string {
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return `${months} mois`;
  }
  if (days > 0 && days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} semaine${weeks > 1 ? "s" : ""}`;
  }
  return `${days} jour${days > 1 ? "s" : ""}`;
}

/** Même durée, accordée pour une offre : « 3 mois offerts », « 1 semaine offerte ». */
export function trialOfferLabel(days: number): string {
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return `${months} mois offert${months > 1 ? "s" : ""}`;
  }
  if (days > 0 && days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} semaine${weeks > 1 ? "s" : ""} offerte${weeks > 1 ? "s" : ""}`;
  }
  return `${days} jour${days > 1 ? "s" : ""} offert${days > 1 ? "s" : ""}`;
}

/** Libellé de l'engagement : « engagement de 12 mois ». */
export function commitmentLabel(months = PREMIUM.commitmentMonths): string {
  return `engagement de ${months} mois`;
}

/**
 * Fin de l'engagement, calculée à partir de la fin de la période offerte
 * (ou du début de l'abonnement s'il n'y a pas d'essai).
 */
export function commitmentEndsAt(start: Date, months = PREMIUM.commitmentMonths): Date {
  const end = new Date(start.getTime());
  end.setMonth(end.getMonth() + months);
  return end;
}

/**
 * Seuil d'accès A2V Prestige : au-delà de 10 000 € (1 000 000 centimes), une
 * annonce est automatiquement réservée aux membres Prestige. Le seuil est
 * strict : un article à exactement 10 000 € reste public.
 *
 * Le vendeur peut aussi choisir librement de réserver une annonce à un prix
 * inférieur. Le contrôle est refait côté serveur à la création et à la
 * modification : décocher la case dans le navigateur ne suffit pas.
 */
export const PREMIUM_ONLY_THRESHOLD_CENTS = 1_000_000;

export function requiresPremiumAccess(priceCents: number): boolean {
  return Number.isInteger(priceCents) && priceCents > PREMIUM_ONLY_THRESHOLD_CENTS;
}

/**
 * Avantage A2V Prestige : 10 % de réduction sur les articles dont le prix
 * final dépasse 10 000 € (1 000 000 centimes). Le seuil est strict : un article
 * à exactement 10 000 € n'ouvre pas droit à la réduction.
 *
 * Ces articles étant réservés aux membres au-delà du seuil, la réduction
 * s'applique aux abonnés actifs. Le calcul définitif est refait côté serveur
 * au moment de la commande.
 */
export const PREMIUM_DISCOUNT_THRESHOLD_CENTS = PREMIUM_ONLY_THRESHOLD_CENTS;
export const PREMIUM_DISCOUNT_BPS = 1_000;

export function qualifiesForPremiumDiscount(priceCents: number): boolean {
  return Number.isInteger(priceCents) && priceCents > PREMIUM_DISCOUNT_THRESHOLD_CENTS;
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

/** Délai de paiement d'une enchère remportée. */
export const AUCTION_PAYMENT_DEADLINE_HOURS = 48;
/** Anti-sniping : prolongation si offre dans les X dernières secondes. */
export const AUCTION_EXTENSION_WINDOW_SECONDS = 120;
export const AUCTION_EXTENSION_SECONDS = 120;
export const AUCTION_MAX_EXTENSIONS = 10;
/** Finalisation automatique après livraison + ce délai, sans litige. */
export const FINALIZATION_DELAY_DAYS = 14;

export const COMMISSION_RATE_BPS = 50; // 0,50 %

export const LISTING_CONDITIONS = [
  { value: "NEW", label: "Neuf" },
  { value: "LIKE_NEW", label: "Comme neuf" },
  { value: "GOOD", label: "Bon état" },
  { value: "FAIR", label: "État correct" },
  { value: "FOR_PARTS", label: "Pour pièces" },
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée",
  PREPARING: "En préparation",
  SHIPPED: "Expédiée",
  IN_TRANSIT: "En cours de livraison",
  DELIVERED: "Livrée",
  FINALIZED: "Finalisée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  DISPUTED: "En litige",
};

export const LISTING_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  RESERVED: "Réservée",
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée",
  PREPARING: "En préparation",
  SHIPPED: "Expédiée",
  IN_TRANSIT: "En cours de livraison",
  DELIVERED: "Livrée",
  FINALIZED: "Finalisée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  DISPUTED: "En litige",
  SOLD: "Vendue",
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  LABEL_CREATED: "Étiquette créée",
  HANDED_OVER: "Déposé",
  IN_TRANSIT: "En transit",
  OUT_FOR_DELIVERY: "En cours de livraison",
  DELIVERED: "Livré",
  LOST: "Perdu",
  DAMAGED: "Endommagé",
  RETURNED: "Retourné",
};

/** Notifications : préférences par défaut (in-app + e-mail). */
export const NOTIFICATION_TYPES = [
  "ORDER_CREATED",
  "ORDER_PAID",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_FINALIZED",
  "ORDER_CANCELLED",
  "AUCTION_BID",
  "AUCTION_OUTBID",
  "AUCTION_WON",
  "AUCTION_ENDED",
  "AUCTION_PAYMENT_PENDING",
  "AUCTION_PAYMENT_DEFAULTED",
  "TROPHY_AWARDED",
  "DISCOUNT_UNLOCKED",
  "SUBSCRIPTION",
  "DONATION",
  "MESSAGE",
  "REVIEW",
] as const;

export const SUGGESTED_DONATION_AMOUNTS = [500, 1000, 2500, 5000, 10000] as const;
