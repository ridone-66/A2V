import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse e-mail invalide.")
  .max(254, "Adresse e-mail trop longue.");

export const passwordSchema = z
  .string()
  .min(10, "Au moins 10 caractères.")
  .max(200, "200 caractères maximum.")
  .regex(/[a-z]/, "Ajoutez au moins une minuscule.")
  .regex(/[A-Z]/, "Ajoutez au moins une majuscule.")
  .regex(/\d/, "Ajoutez au moins un chiffre.");

export const publicNameSchema = z
  .string()
  .trim()
  .min(3, "3 caractères minimum.")
  .max(30, "30 caractères maximum.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Lettres, chiffres, points, tirets et underscores uniquement.");

export const registerSchema = z
  .object({
    publicName: publicNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les CGU et la politique de confidentialité." }),
    }),
    marketingOptIn: z.boolean().optional().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis.").max(200),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  publicName: publicNameSchema,
  bio: z.string().trim().max(600, "600 caractères maximum.").optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  region: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Code postal français à 5 chiffres.")
    .optional()
    .or(z.literal("")),
  publicLocation: z.boolean().default(true),
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || value.startsWith("/api/uploads/") || /^https?:\/\//i.test(value),
      "URL d'image invalide.",
    )
    .optional()
    .or(z.literal("")),
});

export const addressSchema = z.object({
  label: z.string().trim().max(40).default("Domicile"),
  fullName: z.string().trim().min(2, "Nom complet requis.").max(120),
  line1: z.string().trim().min(5, "Adresse trop courte.").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres."),
  city: z.string().trim().min(1, "Ville requise.").max(100),
  country: z.string().trim().length(2).default("FR"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+33|0)[1-9](\s?\d{2}){4}$/, "Numéro de téléphone français invalide.")
    .optional()
    .or(z.literal("")),
  isDefault: z.boolean().default(false),
});

const imageUrlSchema = z
  .string()
  .trim()
  .min(1, "URL d'image manquante.")
  .refine(
    (url) => url.startsWith("/api/uploads/") || /^https?:\/\//i.test(url),
    "URL non autorisée (téléversez une image ou utilisez une URL HTTPS).",
  )
  .refine(
    (url) => /\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(url) || url.startsWith("/api/uploads/"),
    "Formats acceptés : JPG, PNG, WebP, AVIF.",
  );

export const listingSchema = z
  .object({
    title: z.string().trim().min(5, "5 caractères minimum.").max(120, "120 caractères maximum."),
    description: z.string().trim().min(30, "Décrivez l'article en au moins 30 caractères.").max(5000),
    categoryId: z.string().min(1, "Choisissez une catégorie."),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "FOR_PARTS"]),
    priceEuros: z
      .string()
      .trim()
      .regex(/^\d+(?:[.,]\d{1,2})?$/, "Prix invalide.")
      .refine((value) => Number(value.replace(",", ".")) >= 1, "Prix minimum : 1 €.")
      .refine((value) => Number(value.replace(",", ".")) <= 500_000, "Prix maximum : 500 000 €."),
    saleType: z.enum(["FIXED_PRICE", "AUCTION"]).default("FIXED_PRICE"),
    brand: z.string().trim().max(60).optional().or(z.literal("")),
    size: z.string().trim().max(40).optional().or(z.literal("")),
    color: z.string().trim().max(40).optional().or(z.literal("")),
    locationCity: z.string().trim().max(100).optional().or(z.literal("")),
    locationPostalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "Code postal à 5 chiffres.")
      .optional()
      .or(z.literal("")),
    shippingCostEuros: z
      .string()
      .trim()
      .regex(/^\d+(?:[.,]\d{1,2})?$/, "Frais de livraison invalides.")
      .default("0"),
    shippingNotes: z.string().trim().max(500).optional().or(z.literal("")),
    images: z
      .array(imageUrlSchema)
      .min(1, "Ajoutez au moins une photo.")
      .max(8, "8 photos maximum."),
    isPremiumOnly: z.boolean().default(false),
    acceptSaleTerms: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les conditions de vente." }),
    }),
    // Champs enchère (requis si saleType = AUCTION)
    auctionStartsAt: z.string().optional(),
    auctionEndsAt: z.string().optional(),
    auctionStartPriceEuros: z.string().optional(),
    auctionReserveEuros: z.string().optional(),
    auctionBuyNowEuros: z.string().optional(),
    auctionMinIncrementEuros: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.saleType !== "AUCTION") return;
    if (!data.auctionStartsAt) ctx.addIssue({ code: "custom", path: ["auctionStartsAt"], message: "Date de début requise." });
    if (!data.auctionEndsAt) ctx.addIssue({ code: "custom", path: ["auctionEndsAt"], message: "Date de fin requise." });
    if (!data.auctionStartPriceEuros || Number(data.auctionStartPriceEuros.replace(",", ".")) < 1) {
      ctx.addIssue({ code: "custom", path: ["auctionStartPriceEuros"], message: "Prix de départ minimum : 1 €." });
    }
    if (data.auctionStartsAt && data.auctionEndsAt) {
      const start = new Date(data.auctionStartsAt);
      const end = new Date(data.auctionEndsAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        ctx.addIssue({ code: "custom", path: ["auctionEndsAt"], message: "Dates invalides." });
      } else if (end.getTime() - start.getTime() < 3_600_000) {
        ctx.addIssue({ code: "custom", path: ["auctionEndsAt"], message: "L'enchère doit durer au moins 1 heure." });
      } else if (end.getTime() > start.getTime() + 30 * 86_400_000) {
        ctx.addIssue({ code: "custom", path: ["auctionEndsAt"], message: "Durée maximale : 30 jours." });
      }
    }
    if (data.auctionReserveEuros && data.auctionStartPriceEuros) {
      if (Number(data.auctionReserveEuros.replace(",", ".")) < Number(data.auctionStartPriceEuros.replace(",", "."))) {
        ctx.addIssue({ code: "custom", path: ["auctionReserveEuros"], message: "Le prix de réserve doit être supérieur ou égal au prix de départ." });
      }
    }
  });

export const bidSchema = z.object({
  auctionId: z.string().min(1),
  amountEuros: z
    .string()
    .trim()
    .regex(/^\d+(?:[.,]\d{1,2})?$/, "Montant invalide.")
    .refine((value) => Number(value.replace(",", ".")) >= 1, "Montant minimum : 1 €."),
  maxAmountEuros: z.string().optional(),
});

export const messageSchema = z.object({
  conversationId: z.string().optional(),
  listingId: z.string().optional(),
  recipientId: z.string().optional(),
  subject: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, "Message vide.").max(3000, "3000 caractères maximum."),
});

export const donationSchema = z.object({
  amountEuros: z
    .string()
    .trim()
    .regex(/^\d+(?:[.,]\d{1,2})?$/, "Montant invalide.")
    .refine((value) => Number(value.replace(",", ".")) >= 1, "Don minimum : 1 €."),
  message: z.string().trim().max(500).optional().or(z.literal("")),
  isPublic: z.boolean().default(false),
  donorDisplayName: z.string().trim().max(40).optional().or(z.literal("")),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les conditions du don." }),
  }),
});

export const checkoutSchema = z.object({
  listingId: z.string().min(1),
  addressId: z.string().min(1, "Choisissez une adresse de livraison."),
  shippingService: z.string().min(1, "Choisissez un mode de livraison."),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  buyerNote: z.string().trim().max(500).optional().or(z.literal("")),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les CGV." }),
  }),
});

export const reportSchema = z.object({
  listingId: z.string().min(1),
  reason: z.enum(["FRAUD", "COUNTERFEIT", "PROHIBITED", "MISLEADING", "ABUSIVE", "OTHER"]),
  details: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  orderId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const disputeSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20, "Décrivez le problème (20 caractères minimum).").max(3000),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(20).max(3000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
