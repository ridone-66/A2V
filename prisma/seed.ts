/**
 * Données de démonstration A2V.
 *
 * ⚠️ Développement uniquement. Les paiements marqués SIMULATED ne sont pas réels,
 * les suivis `SIM...FR` sont fictifs, et l'organisme solidaire est explicitement
 * une démonstration (aucun partenariat réel n'est affirmé).
 */
import { PrismaClient, type ListingCondition } from "@prisma/client";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../src/lib/auth/password";
import { PREMIUM_ONLY_THRESHOLD_CENTS } from "../src/lib/config";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  throw new Error("Le seed de démonstration ne doit jamais s'exécuter en production.");
}

const DEMO_PASSWORD = "A2v!Demo2026";
const BPS = 50;
const DAY = 86_400_000;
const now = new Date();
const day = (offset: number) => new Date(now.getTime() + offset * DAY);
const hours = (offset: number) => new Date(now.getTime() + offset * 3_600_000);

const PALETTES = [
  ["#6D28D9", "#4C1D95"],
  ["#8B5CF6", "#6D28D9"],
  ["#A78BFA", "#7C3AED"],
  ["#7C3AED", "#312E81"],
  ["#C4B5FD", "#6D28D9"],
  ["#5B21B6", "#8B5CF6"],
];

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Génère une image locale (SVG) pour chaque annonce : fonctionne sans réseau. */
async function writeArtwork(slug: string, title: string, category: string, index: number) {
  // Si une photo réelle a été préparée pour cette annonce, on la sert en priorité.
  // Les photos sont stockées localement dans public/demo (voir docs/PHOTOS.md).
  try {
    await access(path.join(process.cwd(), "public", "demo", `${slug}.jpg`));
    return `/demo/${slug}.jpg`;
  } catch {
    // Pas de photo : on retombe sur l'illustration SVG générée.
  }
  const [from, to] = PALETTES[index % PALETTES.length];
  const lines = title.split(" ");
  const chunks: string[] = [];
  let current = "";
  for (const word of lines) {
    if ((current + " " + word).trim().length > 24) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  const text = chunks
    .slice(0, 3)
    .map((line, i) => `<tspan x="60" dy="${i === 0 ? 0 : 44}">${escapeXml(line)}</tspan>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="15%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <rect width="1200" height="900" fill="url(#glow)"/>
  <circle cx="960" cy="700" r="260" fill="#ffffff" opacity="0.08"/>
  <circle cx="250" cy="140" r="150" fill="#ffffff" opacity="0.07"/>
  <text x="60" y="580" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700" fill="#ffffff">${text}</text>
  <text x="60" y="790" font-family="Arial, sans-serif" font-size="26" letter-spacing="6" fill="#EDE9FE">${escapeXml(category.toUpperCase())}</text>
  <text x="60" y="110" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#ffffff" opacity="0.9">A2V</text>
  <text x="1140" y="110" text-anchor="end" font-family="Arial, sans-serif" font-size="22" fill="#EDE9FE" opacity="0.85">DÉMONSTRATION</text>
</svg>`;

  const dir = path.join(process.cwd(), "public", "demo");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${slug}.svg`), svg, "utf8");
  return `/demo/${slug}.svg`;
}

async function resetData() {
  const order = [
    "userTrophy",
    "couponRedemption",
    "review",
    "dispute",
    "refund",
    "commission",
    "transactionEvent",
    "payment",
    "shippingLabel",
    "shipmentEvent",
    "shipment",
    "orderItem",
    "order",
    "auctionWinner",
    "bid",
    "auctionEvent",
    "auction",
    "favorite",
    "listingReport",
    "listingImage",
    "listing",
    "messageReport",
    "message",
    "conversationParticipant",
    "conversation",
    "notification",
    "notificationPreference",
    "entitlement",
    "subscriptionEvent",
    "subscription",
    "premiumOffer",
    "donation",
    "charityTransfer",
    "charityReport",
    "platformContribution",
    "charityOrganization",
    "rewardRule",
    "coupon",
    "trophyDefinition",
    "auditLog",
    "webhookEvent",
    "featureFlag",
    "platformSetting",
    "rolePermission",
    "session",
    "passwordResetToken",
    "userBlock",
    "address",
    "userProfile",
    "user",
    "listing",
    "category",
    "shippingQuote",
  ] as const;
  for (const model of order) {
    // @ts-expect-error — suppression générique contrôlée, ordre explicite ci-dessus.
    await prisma[model].deleteMany({});
  }
}

async function main() {
  console.log("Réinitialisation des données de démonstration…");
  await resetData();

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [admin, clara, thomas, lea, moderator] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@a2v.fr",
        publicName: "A2V Admin",
        passwordHash,
        role: "ADMIN",
        emailVerifiedAt: day(-120),
        createdAt: day(-120),
        lastLoginAt: day(-1),
        profile: { create: { bio: "Compte d'administration de démonstration.", city: "Paris", region: "Île-de-France" } },
        addresses: {
          create: {
            label: "Siège (démo)",
            fullName: "A2V Admin",
            line1: "10 rue de la Démocratie",
            postalCode: "75011",
            city: "Paris",
            isDefault: true,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: "clara@a2v.fr",
        publicName: "ClaraVintage",
        passwordHash,
        emailVerifiedAt: day(-90),
        createdAt: day(-90),
        lastLoginAt: hours(-3),
        profile: {
          create: {
            bio: "Chineuse de belles pièces vintage, basée à Bordeaux. Chaque objet est vérifié et photographié avec soin.",
            city: "Bordeaux",
            region: "Nouvelle-Aquitaine",
            postalCode: "33000",
          },
        },
        addresses: {
          create: {
            label: "Domicile",
            fullName: "Clara Martin",
            line1: "24 rue des Chartrons",
            line2: "Bâtiment B",
            postalCode: "33000",
            city: "Bordeaux",
            phone: "0612345678",
            isDefault: true,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: "thomas@a2v.fr",
        publicName: "Thomas.Lyon",
        passwordHash,
        emailVerifiedAt: day(-60),
        createdAt: day(-60),
        lastLoginAt: day(-2),
        profile: {
          create: {
            bio: "Passionné de photo argentique et de matériel audio. Expédition sous 48 h.",
            city: "Lyon",
            region: "Auvergne-Rhône-Alpes",
            postalCode: "69003",
          },
        },
        addresses: {
          create: {
            label: "Domicile",
            fullName: "Thomas Bernard",
            line1: "8 rue de la Guillotière",
            postalCode: "69003",
            city: "Lyon",
            phone: "0698765432",
            isDefault: true,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: "lea@a2v.fr",
        publicName: "LeaAtelier",
        passwordHash,
        emailVerifiedAt: day(-45),
        createdAt: day(-45),
        lastLoginAt: hours(-20),
        profile: {
          create: {
            bio: "Atelier de restauration de meubles et objets de décoration. Nantes.",
            city: "Nantes",
            region: "Pays de la Loire",
            postalCode: "44000",
          },
        },
        addresses: {
          create: {
            label: "Atelier",
            fullName: "Léa Dubois",
            line1: "17 quai de la Fosse",
            postalCode: "44000",
            city: "Nantes",
            isDefault: true,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: "moderateur@a2v.fr",
        publicName: "ModerationA2V",
        passwordHash,
        role: "MODERATOR",
        emailVerifiedAt: day(-30),
        createdAt: day(-30),
        profile: { create: { city: "Paris", bio: "Compte de modération de démonstration." } },
      },
    }),
  ]);

  console.log("Catégories…");
  const categoryTree: Record<string, { id: string; children: Record<string, string> }> = {};
  const tree = [
    { slug: "mode", name: "Mode", icon: "👗", children: [
      ["femme", "Femme"], ["homme", "Homme"], ["accessoires", "Accessoires"], ["chaussures", "Chaussures"],
    ]},
    { slug: "electronique", name: "Électronique", icon: "📷", children: [
      ["photo", "Photo & vidéo"], ["audio", "Audio"], ["informatique", "Informatique"],
    ]},
    { slug: "maison", name: "Maison & déco", icon: "🛋️", children: [
      ["mobilier", "Mobilier"], ["decoration", "Décoration"], ["vaisselle", "Vaisselle"],
    ]},
    { slug: "sport", name: "Sport & loisirs", icon: "🚲", children: [["velo", "Vélos"], ["fitness", "Fitness"]] },
    { slug: "collection", name: "Collection", icon: "🏺", children: [["vintage", "Vintage"], ["livres", "Livres & BD"]] },
    { slug: "enfants", name: "Enfants", icon: "🧸", children: [["vetements", "Vêtements"], ["jouets", "Jouets"]] },
  ];
  for (let index = 0; index < tree.length; index += 1) {
    const node = tree[index];
    const parent = await prisma.category.create({
      data: { slug: node.slug, name: node.name, icon: node.icon, position: index },
    });
    const children: Record<string, string> = {};
    for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
      const [slug, name] = node.children[childIndex];
      const child = await prisma.category.create({
        data: { slug, name, parentId: parent.id, position: childIndex },
      });
      children[slug] = child.id;
    }
    categoryTree[node.slug] = { id: parent.id, children };
  }

  console.log("Paramètres, trophées, promotions, livraison…");
  await prisma.platformSetting.createMany({
    data: [
      { key: "commission.rateBps", value: BPS, description: "Commission A2V en points de base (50 = 0,5 %)." },
      { key: "commission.base", value: "ITEM_PRICE_BEFORE_DISCOUNT", description: "Assiette de commission." },
      { key: "donation.minCents", value: 100 },
      { key: "donation.maxCents", value: 100000 },
      { key: "premium.priceCents", value: 600 },
      { key: "premium.trialMonths", value: 3 },
      { key: "charity.platformContributionBps", value: 0, description: "Aucune contribution décidée : paramètre à valider." },
    ],
  });

  await prisma.shippingQuote.createMany({
    data: [
      { service: "COLISSIMO_DOMICILE", label: "Colissimo domicile", priceCents: 690, maxWeightG: 30000, isSimulated: true },
      { service: "COLISSIMO_POINT", label: "Colissimo point retrait", priceCents: 490, maxWeightG: 30000, isSimulated: true },
      { service: "LETTRE_SUIVIE", label: "Lettre suivie", priceCents: 390, maxWeightG: 3000, isSimulated: true },
      { service: "REMISE_MAIN_PROPRE", label: "Remise en main propre", priceCents: 0, maxWeightG: 30000, isSimulated: true },
    ],
  });

  const trophyDefs = await Promise.all(
    [
      { code: "BRONZE", name: "Bronze", description: "Première enchère remportée et finalisée.", icon: "🥉", level: 1, thresholdWins: 1, color: "#B45309" },
      { code: "ARGENT", name: "Argent", description: "Trois enchères remportées et finalisées.", icon: "🥈", level: 2, thresholdWins: 3, color: "#64748B" },
      { code: "OR", name: "Or", description: "Cinq enchères remportées et finalisées.", icon: "🥇", level: 3, thresholdWins: 5, color: "#B7791F" },
      { code: "PLATINE", name: "Platine", description: "Dix enchères remportées et finalisées.", icon: "💎", level: 4, thresholdWins: 10, color: "#0F766E" },
      { code: "DIAMANT", name: "Diamant", description: "Vingt enchères remportées et finalisées.", icon: "👑", level: 5, thresholdWins: 20, color: "#6D28D9" },
    ].map((definition) => prisma.trophyDefinition.create({ data: definition })),
  );

  await prisma.rewardRule.createMany({
    data: [
      {
        code: "TROPHY_BRONZE_5",
        name: "Réduction Bronze — 5 %",
        minTrophyCount: 1,
        minTrophyLevel: 1,
        discountBps: 500,
        maxDiscountCents: 1000,
        minOrderCents: 1000,
        terms: "5 % sur le prix de l'article, plafonné à 10 €, dès 10 € d'achat. Non cumulable avec un code promo.",
      },
      {
        code: "TROPHY_ARGENT_8",
        name: "Réduction Argent — 8 %",
        minTrophyCount: 3,
        minTrophyLevel: 2,
        discountBps: 800,
        maxDiscountCents: 2000,
        minOrderCents: 2000,
        terms: "8 % sur le prix de l'article, plafonné à 20 €, dès 20 € d'achat.",
      },
      {
        code: "TROPHY_OR_10",
        name: "Réduction Or — 10 %",
        minTrophyCount: 5,
        minTrophyLevel: 3,
        discountBps: 1000,
        maxDiscountCents: 3000,
        minOrderCents: 3000,
        terms: "10 % sur le prix de l'article, plafonné à 30 €.",
      },
      {
        code: "PRESTIGE_BOOST_5",
        name: "Bonus Prestige — 5 %",
        minTrophyCount: 1,
        minTrophyLevel: 1,
        discountBps: 500,
        maxDiscountCents: 1500,
        minOrderCents: 1500,
        premiumOnly: true,
        terms: "Réservé aux membres A2V Prestige. Cumul interdit avec les autres avantages automatiques.",
      },
    ],
  });

  const [welcomeCoupon, prestigeCoupon] = await Promise.all([
    prisma.coupon.create({
      data: {
        code: "BIENVENUE10",
        description: "10 % de bienvenue, plafonné à 10 €, dès 15 € d'achat.",
        discountType: "PERCENT",
        value: 1000,
        maxDiscountCents: 1000,
        minOrderCents: 1500,
        maxRedemptions: 500,
        maxPerUser: 1,
        endsAt: day(90),
      },
    }),
    prisma.coupon.create({
      data: {
        code: "PRESTIGE5",
        description: "5 % réservés aux membres Prestige, plafonné à 20 €.",
        discountType: "PERCENT",
        value: 500,
        maxDiscountCents: 2000,
        minOrderCents: 3000,
        maxRedemptions: 200,
        maxPerUser: 2,
        premiumOnly: true,
        endsAt: day(60),
      },
    }),
  ]);
  void welcomeCoupon;
  void prestigeCoupon;

  console.log("Annonces…");
  type ListingSeed = {
    sellerId: string;
    category: string;
    sub: string;
    title: string;
    description: string;
    condition: ListingCondition;
    priceCents: number;
    shippingCents: number;
    brand?: string;
    size?: string;
    color?: string;
    city: string;
    postal: string;
    premiumOnly?: boolean;
    status?: "PUBLISHED" | "FINALIZED" | "RESERVED" | "PAID" | "IN_TRANSIT" | "CANCELLED";
    views?: number;
  };

  const fixed: ListingSeed[] = [
    { sellerId: clara.id, category: "mode", sub: "femme", title: "Robe vintage fleurie années 70", description: "Robe longue à fleurs, coupe fluide, taille haute. Tissu léger en bon état, quelques traces d'usage discrètes sur l'ourlet. Mesures : longueur 118 cm, poitrine 46 cm à plat. Nettoyée, prête à porter.", condition: "GOOD", priceCents: 3200, shippingCents: 590, brand: "Sans marque", size: "M", color: "Violet", city: "Bordeaux", postal: "33000", status: "FINALIZED", views: 248 },
    { sellerId: clara.id, category: "mode", sub: "accessoires", title: "Sac en cuir camel grainé", description: "Sac porté épaule en cuir de vachette grainé, doublure textile, fermeture aimantée. Légères marques sur les coins, intérieur propre. Dimensions 28 × 20 × 10 cm. Livré avec dustbag.", condition: "LIKE_NEW", priceCents: 8500, shippingCents: 690, brand: "Atelier Nòu", color: "Camel", city: "Bordeaux", postal: "33000", views: 512 },
    { sellerId: thomas.id, category: "electronique", sub: "photo", title: "Canon AE-1 argentique révisé", description: "Boîtier Canon AE-1 avec objectif 50 mm f/1.8. Révision complète en 2025 : joints remplacés, cellule testée, avance et retardateur fonctionnels. Deux pellicules offertes. Photos détaillées sur demande.", condition: "GOOD", priceCents: 18000, shippingCents: 890, brand: "Canon", color: "Noir", city: "Lyon", postal: "69003", views: 734 },
    { sellerId: thomas.id, category: "electronique", sub: "audio", title: "Casque Sony WH-1000XM4", description: "Casque à réduction de bruit active, très bon état. Mousses d'origine sans craquelure, arceau ferme. Livré avec étui rigide, câble jack et câble USB-C. Batterie testée : environ 28 h d'autonomie.", condition: "LIKE_NEW", priceCents: 12000, shippingCents: 690, brand: "Sony", color: "Noir", city: "Lyon", postal: "69003", status: "PAID", views: 389 },
    { sellerId: lea.id, category: "maison", sub: "mobilier", title: "Fauteuil scandinave en teck", description: "Fauteuil des années 60, structure teck massif restaurée, assise retapissée en bouclette écru. Assise 45 cm, largeur 66 cm. Très stable, aucun jeu. Enlèvement possible à Nantes ou expédition via transporteur spécialisé.", condition: "GOOD", priceCents: 24000, shippingCents: 2490, brand: "Brødrene", color: "Écru", city: "Nantes", postal: "44000", views: 918 },
    { sellerId: lea.id, category: "maison", sub: "decoration", title: "Lampe opaline années 60", description: "Lampe de chevet en opaline violette, pied en laiton patiné. Électrification refaite aux normes, interrupteur neuf. Hauteur 32 cm, diamètre 18 cm. Petite bulle dans le verre, visible sur la photo 3.", condition: "GOOD", priceCents: 6500, shippingCents: 990, color: "Violet", city: "Nantes", postal: "44000", premiumOnly: true, status: "IN_TRANSIT", views: 401 },
    { sellerId: thomas.id, category: "sport", sub: "velo", title: "Vélo de ville Peugeot restauré", description: "Vélo de ville Peugeot des années 80, cadre acier, transmission révisée, pneus neufs, freins réglés. Roues 650B. Selle cuir neuve. Vendu avec antivol. Remise en main propre à Lyon possible.", condition: "GOOD", priceCents: 32000, shippingCents: 3900, brand: "Peugeot", color: "Bleu", city: "Lyon", postal: "69003", status: "RESERVED", views: 655 },
    { sellerId: clara.id, category: "mode", sub: "chaussures", title: "Sneakers Nike Air Max 90", description: "Sneakers Air Max 90 taille 42, coloris violet et blanc. Portées deux fois, semelles très propres, boîte d'origine incluse. Aucune usure sur les lacets ni sur la toile.", condition: "LIKE_NEW", priceCents: 5500, shippingCents: 690, brand: "Nike", size: "42", color: "Violet", city: "Bordeaux", postal: "33000", views: 287 },
    { sellerId: clara.id, category: "mode", sub: "homme", title: "Chemise en lin homme", description: "Chemise 100 % lin, coupe droite, col italien. Taille L, portée quelques fois. Couleur lavande, aucun accroc. Idéale pour l'été, livrée repassée.", condition: "LIKE_NEW", priceCents: 2400, shippingCents: 490, brand: "Octobre Éditions", size: "L", color: "Lavande", city: "Bordeaux", postal: "33000", views: 132 },
    { sellerId: lea.id, category: "maison", sub: "vaisselle", title: "Set de 6 verres à pied", description: "Six verres à vin en cristal, modèle à facettes. Aucun éclat, quelques micro-rayures d'usage. Capacité 25 cl. Emballage renforcé pour l'expédition.", condition: "GOOD", priceCents: 3000, shippingCents: 890, color: "Transparent", city: "Nantes", postal: "44000", views: 96 },
    { sellerId: lea.id, category: "collection", sub: "livres", title: "Le Petit Prince — édition 1965", description: "Édition française de 1965, couverture souple, dos solide. Pages légèrement jaunies, aucune annotation. Un coin émoussé. Envoi protégé sous film et carton rigide.", condition: "FAIR", priceCents: 9500, shippingCents: 490, brand: "Gallimard", city: "Nantes", postal: "44000", premiumOnly: true, views: 621 },
    { sellerId: clara.id, category: "mode", sub: "femme", title: "Manteau en laine vierge", description: "Manteau long en laine vierge, doublure satinée, deux poches plaquées. Taille 38. Couleur rouge. Très bon état, boutons d'origine. Longueur 105 cm.", condition: "LIKE_NEW", priceCents: 6000, shippingCents: 990, brand: "Sézane", size: "38", color: "Rouge", city: "Bordeaux", postal: "33000", views: 356 },
    { sellerId: thomas.id, category: "electronique", sub: "audio", title: "Enceinte Bluetooth Marshall", description: "Enceinte portable Marshall Emberton, son puissant, batterie testée. Quelques rayures sur la grille métallique, sans incidence. Câble USB-C inclus.", condition: "GOOD", priceCents: 9000, shippingCents: 690, brand: "Marshall", color: "Noir", city: "Lyon", postal: "69003", views: 210 },
    { sellerId: lea.id, category: "maison", sub: "mobilier", title: "Table basse en bois massif", description: "Table basse en chêne massif huilé, plateau 90 × 55 cm, hauteur 40 cm. Quelques marques d'usage sur le plateau, traitées à l'huile. Pieds démontables pour l'expédition.", condition: "GOOD", priceCents: 14000, shippingCents: 1990, color: "Chêne", city: "Nantes", postal: "44000", views: 188 },
    { sellerId: clara.id, category: "mode", sub: "femme", title: "Pull en cachemire col rond", description: "Pull 100 % cachemire, taille S, couleur crème. Porté une saison, aucun bouloche. Lavé à la main, séchage à plat. Très doux.", condition: "LIKE_NEW", priceCents: 4500, shippingCents: 490, brand: "Eric Bompard", size: "S", color: "Crème", city: "Bordeaux", postal: "33000", views: 301 },
    { sellerId: lea.id, category: "enfants", sub: "jouets", title: "Jeu de construction en bois", description: "Jeu de 48 pièces en bois massif, peinture à l'eau. Quelques traces d'usage, toutes les pièces présentes. Convient à partir de 3 ans. Sac de rangement inclus.", condition: "GOOD", priceCents: 1800, shippingCents: 690, brand: "Janod", city: "Nantes", postal: "44000", views: 74 },
  ];

  const listingRecords: Record<string, { id: string; slug: string }> = {};
  const categoryNames: Record<string, string> = Object.fromEntries(tree.map((node) => [node.slug, node.name]));

  for (let index = 0; index < fixed.length; index += 1) {
    const item = fixed[index];
    const slug = `${item.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60)}-${index + 1}`;
    const imageUrl = await writeArtwork(slug, item.title, categoryNames[item.category], index);
    const created = await prisma.listing.create({
      data: {
        sellerId: item.sellerId,
        categoryId: categoryTree[item.category].children[item.sub],
        title: item.title,
        slug,
        description: item.description,
        condition: item.condition,
        priceCents: item.priceCents,
        saleType: "FIXED_PRICE",
        status: item.status ?? "PUBLISHED",
        brand: item.brand,
        size: item.size,
        color: item.color,
        locationCity: item.city,
        locationPostalCode: item.postal,
        shippingCostCents: item.shippingCents,
        shippingNotes: "Envoi sous 48 h ouvrées. Emballage soigné, suivi fourni.",
        isPremiumOnly: Boolean(item.premiumOnly) || item.priceCents > PREMIUM_ONLY_THRESHOLD_CENTS,
        viewCount: item.views ?? 0,
        publishedAt: day(-(index + 2)),
        images: { create: [{ url: imageUrl, alt: item.title, position: 0 }] },
      },
    });
    listingRecords[item.title] = { id: created.id, slug: created.slug };
  }

  console.log("Enchères…");
  type AuctionSeed = {
    key: string;
    title: string;
    description: string;
    sellerId: string;
    category: string;
    sub: string;
    condition: ListingCondition;
    startPrice: number;
    reserve?: number;
    buyNow?: number;
    current: number;
    startsAt: Date;
    endsAt: Date;
    status: "LIVE" | "SCHEDULED" | "ENDED" | "SOLD" | "RESERVE_NOT_MET";
    premiumOnly?: boolean;
    bids: Array<{ userId: string; amount: number; status: "WINNING" | "OUTBID" | "WON"; createdAt: Date }>;
    winnerId?: string;
    winnerStatus?: "PENDING_PAYMENT" | "PAID";
    paymentDeadline?: Date;
    finalize?: boolean;
    views?: number;
  };

  const auctionSeeds: AuctionSeed[] = [
    {
      key: "montre",
      title: "Montre mécanique vintage 1968",
      description: "Montre à remontage manuel, cadran argenté, bracelet cuir neuf. Fonctionne, dérive mesurée à +12 s/jour. Boîtier 36 mm. Révision effectuée en 2025, facture fournie. Photos du mouvement disponibles.",
      sellerId: thomas.id,
      category: "collection",
      sub: "vintage",
      condition: "GOOD",
      startPrice: 4000,
      buyNow: 18000,
      current: 7200,
      startsAt: hours(-48),
      endsAt: hours(3),
      status: "LIVE",
      views: 842,
      bids: [
        { userId: clara.id, amount: 4000, status: "OUTBID", createdAt: hours(-30) },
        { userId: lea.id, amount: 5500, status: "OUTBID", createdAt: hours(-12) },
        { userId: clara.id, amount: 7200, status: "WINNING", createdAt: hours(-1) },
      ],
    },
    {
      key: "polaroid",
      title: "Polaroid SX-70 restauré",
      description: "Appareil instantané SX-70, coque chromée, soufflet vérifié, mécanisme d'éjection testé avec un pack neuf. Vendu avec sac cuir d'origine. Quelques rayures d'usage sur le capot.",
      sellerId: lea.id,
      category: "electronique",
      sub: "photo",
      condition: "GOOD",
      startPrice: 6000,
      reserve: 8000,
      current: 8500,
      startsAt: hours(-72),
      endsAt: hours(20),
      status: "LIVE",
      views: 611,
      bids: [
        { userId: thomas.id, amount: 6000, status: "OUTBID", createdAt: hours(-40) },
        { userId: clara.id, amount: 8500, status: "WINNING", createdAt: hours(-6) },
      ],
    },
    {
      key: "veste-jean",
      title: "Veste en jean Levi's années 80",
      description: "Veste en jean coupe droite, denim brut délavé, boutons d'origine. Taille M. Aucune déchirure, coutures solides. Petite tache claire sur la manche droite.",
      sellerId: clara.id,
      category: "mode",
      sub: "femme",
      condition: "GOOD",
      startPrice: 2500,
      buyNow: 7000,
      current: 2500,
      startsAt: hours(-24),
      endsAt: hours(48),
      status: "LIVE",
      premiumOnly: false,
      views: 134,
      bids: [],
    },
    {
      key: "sac-luxe",
      title: "Sac de luxe en cuir grainé — démonstration",
      description: "Annonce de démonstration : sac en cuir grainé, format bandoulière, intérieur textile. Aucune authenticité de marque n'est revendiquée. Vendu avec dustbag et carte de l'atelier. Offre réservée aux membres Prestige.",
      sellerId: clara.id,
      category: "mode",
      sub: "accessoires",
      condition: "LIKE_NEW",
      startPrice: 1_200_000,
      reserve: 1_300_000,
      buyNow: 1_800_000,
      current: 1_500_000,
      startsAt: hours(-24),
      endsAt: hours(5),
      status: "LIVE",
      premiumOnly: false,
      views: 902,
      bids: [
        { userId: lea.id, amount: 1_300_000, status: "OUTBID", createdAt: hours(-8) },
        { userId: thomas.id, amount: 1_500_000, status: "WINNING", createdAt: hours(-2) },
      ],
    },
    {
      key: "tableau",
      title: "Tableau abstrait contemporain",
      description: "Peinture acrylique sur toile, 60 × 80 cm, signée au dos. Couleurs violacées, cadre en bois brut. Œuvre d'atelier, unique. Envoi en caisse rigide.",
      sellerId: lea.id,
      category: "collection",
      sub: "vintage",
      condition: "NEW",
      startPrice: 8000,
      buyNow: 22000,
      current: 8000,
      startsAt: day(1),
      endsAt: day(4),
      status: "SCHEDULED",
      views: 12,
      bids: [],
    },
    {
      key: "nikon",
      title: "Nikon FM2 avec objectif 50 mm",
      description: "Boîtier Nikon FM2 argentique, objectif 50 mm f/1.8. Cellule fonctionnelle, obturateur révisé. Vendu avec sangle et bouchon. Excellent état général.",
      sellerId: thomas.id,
      category: "electronique",
      sub: "photo",
      condition: "GOOD",
      startPrice: 9000,
      current: 14500,
      startsAt: day(-30),
      endsAt: day(-25),
      status: "SOLD",
      winnerId: clara.id,
      winnerStatus: "PAID",
      finalize: true,
      views: 488,
      bids: [
        { userId: lea.id, amount: 9000, status: "OUTBID", createdAt: day(-28) },
        { userId: clara.id, amount: 14500, status: "WON", createdAt: day(-26) },
      ],
    },
    {
      key: "eames",
      title: "Chaise design coque plastique",
      description: "Chaise design, coque plastique blanche, piètement métal noir. Réplique clairement identifiée comme telle, aucun logo. Très bon état, quelques micro-rayures sur le piètement.",
      sellerId: lea.id,
      category: "maison",
      sub: "mobilier",
      condition: "GOOD",
      startPrice: 6000,
      current: 8200,
      startsAt: day(-20),
      endsAt: day(-14),
      status: "SOLD",
      winnerId: clara.id,
      winnerStatus: "PAID",
      finalize: true,
      views: 377,
      bids: [
        { userId: thomas.id, amount: 7000, status: "OUTBID", createdAt: day(-16) },
        { userId: clara.id, amount: 8200, status: "WON", createdAt: day(-15) },
      ],
    },
    {
      key: "bougies",
      title: "Lot de bougies artisanales parfumées",
      description: "Lot de 5 bougies en cire de soja, parfums fleur de coton et bois de santal. Fabrication artisanale française. Deux bougies ont été allumées une fois.",
      sellerId: clara.id,
      category: "maison",
      sub: "decoration",
      condition: "LIKE_NEW",
      startPrice: 1500,
      current: 2300,
      startsAt: day(-10),
      endsAt: day(-6),
      status: "SOLD",
      winnerId: clara.id,
      winnerStatus: "PAID",
      finalize: true,
      views: 151,
      bids: [
        { userId: thomas.id, amount: 1800, status: "OUTBID", createdAt: day(-8) },
        { userId: clara.id, amount: 2300, status: "WON", createdAt: day(-7) },
      ],
    },
    {
      key: "lithographie",
      title: "Lithographie signée, édition limitée",
      description: "Lithographie numérotée 12/80, signature au crayon. Papier légèrement ondulé, aucune déchirure. Format 40 × 50 cm avec marge. Vendu sans cadre.",
      sellerId: lea.id,
      category: "collection",
      sub: "vintage",
      condition: "GOOD",
      startPrice: 10000,
      reserve: 30000,
      current: 15000,
      startsAt: day(-9),
      endsAt: day(-3),
      status: "RESERVE_NOT_MET",
      views: 203,
      bids: [{ userId: thomas.id, amount: 15000, status: "OUTBID", createdAt: day(-4) }],
    },
    {
      key: "shearling",
      title: "Manteau shearling vintage",
      description: "Manteau en shearling véritable, doublure chaude, coupe oversize. Taille 40. Quelques marques de cuir sur les manches, très bon état structurel.",
      sellerId: clara.id,
      category: "mode",
      sub: "femme",
      condition: "GOOD",
      startPrice: 5000,
      current: 7800,
      startsAt: day(-8),
      endsAt: hours(-4),
      status: "ENDED",
      winnerId: thomas.id,
      winnerStatus: "PENDING_PAYMENT",
      paymentDeadline: hours(44),
      views: 266,
      bids: [
        { userId: lea.id, amount: 6200, status: "OUTBID", createdAt: day(-5) },
        { userId: thomas.id, amount: 7800, status: "WON", createdAt: day(-4) },
      ],
    },
  ];

  const auctionRecords: Record<string, { id: string; listingId: string; winnerRecordId?: string; winnerBidId?: string; orderId?: string }> = {};

  for (let index = 0; index < auctionSeeds.length; index += 1) {
    const item = auctionSeeds[index];
    const slug = `enchere-${item.key}`;
    const imageUrl = await writeArtwork(slug, item.title, "Enchère", index + fixed.length);
    const listingStatus =
      item.status === "SOLD" && item.finalize
        ? "FINALIZED"
        : item.status === "ENDED"
          ? "RESERVED"
          : item.status === "RESERVE_NOT_MET"
            ? "CANCELLED"
            : item.status === "SCHEDULED"
              ? "PUBLISHED"
              : item.status === "LIVE"
                ? "PUBLISHED"
                : "RESERVED";

    const listing = await prisma.listing.create({
      data: {
        sellerId: item.sellerId,
        categoryId: categoryTree[item.category].children[item.sub],
        title: item.title,
        slug,
        description: item.description,
        condition: item.condition,
        priceCents: item.startPrice,
        saleType: "AUCTION",
        status: listingStatus,
        locationCity: "France",
        shippingCostCents: 690,
        shippingNotes: "Expédition suivie sous 3 jours ouvrés. Emballage renforcé.",
        isPremiumOnly: Boolean(item.premiumOnly) || item.startPrice > PREMIUM_ONLY_THRESHOLD_CENTS,
        viewCount: item.views ?? 0,
        publishedAt: item.startsAt,
        images: { create: [{ url: imageUrl, alt: item.title, position: 0 }] },
      },
    });

    const auction = await prisma.auction.create({
      data: {
        listingId: listing.id,
        startPriceCents: item.startPrice,
        reservePriceCents: item.reserve ?? null,
        buyNowPriceCents: item.buyNow ?? null,
        currentPriceCents: item.current,
        minIncrementCents: 100,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        originalEndsAt: item.endsAt,
        status: item.status,
        winnerId: item.winnerId ?? null,
        closedAt: ["SOLD", "RESERVE_NOT_MET", "ENDED"].includes(item.status) ? item.endsAt : null,
      },
    });

    const bids = [];
    for (const bid of item.bids) {
      bids.push(
        await prisma.bid.create({
          data: {
            auctionId: auction.id,
            bidderId: bid.userId,
            amountCents: bid.amount,
            status: bid.status,
            createdAt: bid.createdAt,
          },
        }),
      );
    }
    const winning = bids.find((bid) => bid.status === "WON" || bid.status === "WINNING");
    const winningBid = winning
      ? await prisma.bid.update({
          where: { id: winning.id },
          data: { status: item.status === "SOLD" || item.status === "ENDED" ? "WON" : "WINNING" },
        })
      : null;

    if (winningBid) {
      await prisma.auction.update({
        where: { id: auction.id },
        data: { winningBidId: winningBid.id, currentPriceCents: winningBid.amountCents },
      });
    }

    let winnerRecordId: string | undefined;
    if (item.winnerId && winningBid) {
      const winner = await prisma.auctionWinner.create({
        data: {
          auctionId: auction.id,
          userId: item.winnerId,
          winningBidId: winningBid.id,
          status: item.winnerStatus ?? "PENDING_PAYMENT",
          paymentDeadline: item.paymentDeadline ?? day(2),
        },
      });
      winnerRecordId = winner.id;
      await prisma.auctionWinner.update({
        where: { id: winner.id },
        data: { createdAt: item.endsAt, updatedAt: item.endsAt },
      });
    }

    await prisma.auctionEvent.createMany({
      data: [
        { auctionId: auction.id, type: "CREATED", actorId: item.sellerId, createdAt: item.startsAt },
        { auctionId: auction.id, type: "STARTED", createdAt: item.startsAt },
        ...item.bids.map((bid) => ({
          auctionId: auction.id,
          type: "BID_PLACED" as const,
          actorId: bid.userId,
          metadata: { amountCents: bid.amount },
          createdAt: bid.createdAt,
        })),
        ...(item.winnerId
          ? [
              { auctionId: auction.id, type: "ENDED" as const, createdAt: item.endsAt },
              { auctionId: auction.id, type: "WINNER_DESIGNATED" as const, metadata: { winnerId: item.winnerId }, createdAt: item.endsAt },
            ]
          : []),
      ],
    });

    auctionRecords[item.key] = { id: auction.id, listingId: listing.id, winnerRecordId, winnerBidId: winningBid?.id };
  }

  console.log("Commandes, paiements et commissions…");

  type OrderSeed = {
    key: string;
    listingTitle?: string;
    listingId: string;
    buyerId: string;
    sellerId: string;
    status: "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "FINALIZED";
    itemPrice: number;
    shipping: number;
    discount?: number;
    createdAt: Date;
    paidAt?: Date;
    deliveredAt?: Date;
    finalizedAt?: Date;
    auctionWinnerId?: string;
    shipment?: { status: "LABEL_CREATED" | "HANDED_OVER" | "IN_TRANSIT" | "DELIVERED"; tracking: string; createdAt: Date; deliveredAt?: Date };
  };

  const fixedOrders: OrderSeed[] = [
    {
      key: "robe",
      listingId: listingRecords["Robe vintage fleurie années 70"].id,
      buyerId: lea.id,
      sellerId: clara.id,
      status: "FINALIZED",
      itemPrice: 3200,
      shipping: 590,
      createdAt: day(-24),
      paidAt: day(-24),
      deliveredAt: day(-18),
      finalizedAt: day(-6),
      shipment: { status: "DELIVERED", tracking: "SIM45872109345FR", createdAt: day(-23), deliveredAt: day(-18) },
    },
    {
      key: "casque",
      listingId: listingRecords["Casque Sony WH-1000XM4"].id,
      buyerId: clara.id,
      sellerId: thomas.id,
      status: "PREPARING",
      itemPrice: 12000,
      shipping: 690,
      createdAt: day(-2),
      paidAt: day(-2),
      shipment: { status: "LABEL_CREATED", tracking: "SIM77412098553FR", createdAt: day(-1) },
    },
    {
      key: "velo",
      listingId: listingRecords["Vélo de ville Peugeot restauré"].id,
      buyerId: clara.id,
      sellerId: thomas.id,
      status: "PENDING_PAYMENT",
      itemPrice: 32000,
      shipping: 3900,
      createdAt: hours(-6),
    },
    {
      key: "lampe",
      listingId: listingRecords["Lampe opaline années 60"].id,
      buyerId: thomas.id,
      sellerId: lea.id,
      status: "IN_TRANSIT",
      itemPrice: 6500,
      shipping: 990,
      createdAt: day(-5),
      paidAt: day(-5),
      shipment: { status: "IN_TRANSIT", tracking: "SIM88921340517FR", createdAt: day(-4) },
    },
  ];

  for (const item of fixedOrders) {
    const commissionCents = Math.round((item.itemPrice * BPS) / 10_000);
    const discount = item.discount ?? 0;
    const buyerTotal = item.itemPrice + item.shipping - discount;
    const order = await prisma.order.create({
      data: {
        orderNumber: `A2V-${item.key.toUpperCase().slice(0, 3)}-${1000 + fixedOrders.indexOf(item)}`,
        buyerId: item.buyerId,
        sellerId: item.sellerId,
        listingId: item.listingId,
        status: item.status,
        itemPriceCents: item.itemPrice,
        shippingCents: item.shipping,
        discountCents: discount,
        commissionCents,
        commissionRateBps: BPS,
        buyerTotalCents: buyerTotal,
        sellerPayoutCents: item.itemPrice - commissionCents,
        shippingMethod: "COLISSIMO_DOMICILE",
        createdAt: item.createdAt,
        paidAt: item.paidAt ?? null,
        deliveredAt: item.deliveredAt ?? null,
        finalizedAt: item.finalizedAt ?? null,
        items: {
          create: {
            listingId: item.listingId,
            titleSnapshot: Object.keys(listingRecords).find((title) => listingRecords[title].id === item.listingId) ?? "Article A2V",
            priceCents: item.itemPrice,
          },
        },
        commission: {
          create: {
            rateBps: BPS,
            baseCents: item.itemPrice,
            amountCents: commissionCents,
            status: item.status === "FINALIZED" ? "EARNED" : item.status === "PENDING_PAYMENT" ? "PENDING" : "PENDING",
            earnedAt: item.finalizedAt ?? null,
          },
        },
        payments: {
          create:
            item.status === "PENDING_PAYMENT"
              ? {
                  userId: item.buyerId,
                  idempotencyKey: `order-seed-${item.key}`,
                  provider: "SIMULATED",
                  type: "ORDER",
                  amountCents: buyerTotal,
                  status: "PENDING",
                }
              : {
                  userId: item.buyerId,
                  idempotencyKey: `order-seed-${item.key}`,
                  provider: "SIMULATED",
                  providerRef: `sim_order_${item.key}`,
                  type: "ORDER",
                  amountCents: buyerTotal,
                  status: "SUCCEEDED",
                  createdAt: item.paidAt ?? item.createdAt,
                },
        },
      },
    });

    if (item.shipment) {
      const shipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          carrier: "LA_POSTE",
          service: "COLISSIMO_DOMICILE",
          status: item.shipment.status,
          trackingNumber: item.shipment.tracking,
          lastEventAt: item.shipment.deliveredAt ?? item.shipment.createdAt,
          createdAt: item.shipment.createdAt,
          shippedAt: item.shipment.createdAt,
          deliveredAt: item.shipment.deliveredAt ?? null,
          label: {
            create: {
              providerRef: `SIM-LABEL-${item.key.toUpperCase()}`,
              labelUrl: null,
              format: "HTML",
              trackingNumber: item.shipment.tracking,
              isSimulated: true,
            },
          },
        },
      });
      await prisma.shipmentEvent.createMany({
        data: [
          {
            shipmentId: shipment.id,
            status: "LABEL_CREATED",
            message: "Étiquette simulée générée (développement)",
            source: "SIMULATION",
            occurredAt: item.shipment.createdAt,
          },
          ...(item.shipment.status !== "LABEL_CREATED"
            ? [
                {
                  shipmentId: shipment.id,
                  status: "IN_TRANSIT" as const,
                  message: "Colis pris en charge par le réseau (simulation)",
                  source: "SIMULATION",
                  occurredAt: new Date(item.shipment.createdAt.getTime() + 6 * 3_600_000),
                },
              ]
            : []),
          ...(item.shipment.deliveredAt
            ? [
                {
                  shipmentId: shipment.id,
                  status: "DELIVERED" as const,
                  message: "Colis livré (simulation)",
                  source: "SIMULATION",
                  occurredAt: item.shipment.deliveredAt,
                },
              ]
            : []),
        ],
      });
    }

    if (item.status === "FINALIZED") {
      await prisma.transactionEvent.createMany({
        data: [
          { orderId: order.id, type: "ORDER_CREATED", amountCents: buyerTotal, createdAt: item.createdAt },
          { orderId: order.id, type: "PAYMENT_SUCCEEDED", amountCents: buyerTotal, createdAt: item.paidAt ?? item.createdAt },
          { orderId: order.id, type: "ORDER_DELIVERED", metadata: { simulated: true }, createdAt: item.deliveredAt ?? item.createdAt },
          { orderId: order.id, type: "ORDER_FINALIZED", amountCents: buyerTotal, createdAt: item.finalizedAt ?? item.createdAt },
          { orderId: order.id, type: "COMMISSION_EARNED", amountCents: commissionCents, createdAt: item.finalizedAt ?? item.createdAt },
        ],
      });
    }
  }

  // Commandes issues des enchères finalisées (source des trophées de Clara).
  const finalizedAuctions = auctionSeeds.filter((item) => item.status === "SOLD" && item.finalize);
  for (const item of finalizedAuctions) {
    const record = auctionRecords[item.key];
    const commissionCents = Math.round((item.current * BPS) / 10_000);
    const order = await prisma.order.create({
      data: {
        orderNumber: `A2V-ENC-${item.key.slice(0, 4).toUpperCase()}`,
        buyerId: item.winnerId!,
        sellerId: item.sellerId,
        listingId: record.listingId,
        status: "FINALIZED",
        itemPriceCents: item.current,
        shippingCents: 690,
        commissionCents,
        commissionRateBps: BPS,
        buyerTotalCents: item.current + 690,
        sellerPayoutCents: item.current - commissionCents,
        shippingMethod: "COLISSIMO_DOMICILE",
        createdAt: item.endsAt,
        paidAt: new Date(item.endsAt.getTime() + 4 * 3_600_000),
        deliveredAt: new Date(item.endsAt.getTime() + 5 * DAY),
        finalizedAt: new Date(item.endsAt.getTime() + 12 * DAY),
        items: {
          create: { listingId: record.listingId, titleSnapshot: item.title, priceCents: item.current },
        },
        commission: {
          create: {
            rateBps: BPS,
            baseCents: item.current,
            amountCents: commissionCents,
            status: "EARNED",
            earnedAt: new Date(item.endsAt.getTime() + 12 * DAY),
          },
        },
        payments: {
          create: {
            userId: item.winnerId!,
            idempotencyKey: `auction-seed-${item.key}`,
            provider: "SIMULATED",
            providerRef: `sim_auction_${item.key}`,
            type: "AUCTION_ORDER",
            amountCents: item.current + 690,
            status: "SUCCEEDED",
            createdAt: new Date(item.endsAt.getTime() + 4 * 3_600_000),
          },
        },
      },
    });

    await prisma.auctionWinner.update({ where: { id: record.winnerRecordId! }, data: { orderId: order.id } });
    await prisma.auction.update({ where: { id: record.id }, data: { status: "SOLD" } });
    await prisma.transactionEvent.createMany({
      data: [
        { orderId: order.id, type: "ORDER_CREATED", amountCents: order.buyerTotalCents, createdAt: item.endsAt },
        { orderId: order.id, type: "PAYMENT_SUCCEEDED", amountCents: order.buyerTotalCents, createdAt: order.paidAt! },
        { orderId: order.id, type: "ORDER_FINALIZED", amountCents: order.buyerTotalCents, createdAt: order.finalizedAt! },
        { orderId: order.id, type: "COMMISSION_EARNED", amountCents: commissionCents, createdAt: order.finalizedAt! },
      ],
    });
  }

  console.log("Trophées de Clara…");
  const claraWins = await prisma.order.findMany({
    where: { buyerId: clara.id, status: "FINALIZED", auctionWinner: { isNot: null } },
    orderBy: { finalizedAt: "asc" },
  });
  for (const definition of trophyDefs.slice(0, 2)) {
    const source = claraWins[Math.min(claraWins.length - 1, definition.level - 1)];
    await prisma.userTrophy.create({
      data: {
        userId: clara.id,
        trophyDefinitionId: definition.id,
        sourceOrderId: source?.id ?? null,
        awardedAt: source?.finalizedAt ?? day(-5),
      },
    });
  }

  console.log("Premium…");
  const offer = await prisma.premiumOffer.create({
    data: {
      code: "PRESTIGE_MONTHLY",
      name: "A2V Prestige Club",
      priceCents: 600,
      trialMonths: 3,
      features: [
        "Offres et enchères exclusives",
        "Réductions supplémentaires",
        "Découverte avancée",
        "Aucun engagement, résiliable à tout moment",
      ],
    },
  });

  const claraSub = await prisma.subscription.create({
    data: {
      userId: clara.id,
      offerId: offer.id,
      status: "ACTIVE",
      trialStartedAt: day(-125),
      trialEndsAt: day(-35),
      currentPeriodStart: day(-35),
      currentPeriodEnd: day(25),
      provider: "SIMULATED",
      providerRef: `sim_sub_clara_${now.getFullYear()}`,
      createdAt: day(-125),
      events: {
        create: [
          { type: "TRIAL_STARTED", createdAt: day(-125) },
          { type: "SUBSCRIPTION_ACTIVATED", createdAt: day(-35), metadata: { simulated: true, priceCents: 600 } },
        ],
      },
    },
  });
  await prisma.entitlement.create({
    data: { userId: clara.id, key: "PREMIUM", source: `subscription:${claraSub.id}`, expiresAt: day(25), grantedAt: day(-125) },
  });
  await prisma.payment.create({
    data: {
      userId: clara.id,
      subscriptionId: claraSub.id,
      provider: "SIMULATED",
      providerRef: `sim_sub_payment_clara`,
      idempotencyKey: `sub_clara_${now.toISOString().slice(0, 10)}`,
      type: "SUBSCRIPTION",
      amountCents: 600,
      status: "SUCCEEDED",
      metadata: { simulated: true },
    },
  });

  const thomasSub = await prisma.subscription.create({
    data: {
      userId: thomas.id,
      offerId: offer.id,
      status: "TRIALING",
      trialStartedAt: day(-10),
      trialEndsAt: day(80),
      currentPeriodStart: day(-10),
      currentPeriodEnd: day(80),
      provider: "SIMULATED",
      providerRef: `sim_sub_thomas_${now.getFullYear()}`,
      createdAt: day(-10),
      events: { create: { type: "TRIAL_STARTED", createdAt: day(-10) } },
    },
  });
  await prisma.entitlement.create({
    data: { userId: thomas.id, key: "PREMIUM", source: `subscription:${thomasSub.id}`, expiresAt: day(80), grantedAt: day(-10) },
  });

  console.log("Messagerie, favoris, notifications…");
  const conversation = await prisma.conversation.create({
    data: {
      listingId: listingRecords["Canon AE-1 argentique révisé"].id,
      subject: "À propos de « Canon AE-1 argentique révisé »",
      createdAt: hours(-28),
      updatedAt: hours(-2),
      participants: { create: [{ userId: clara.id, lastReadAt: hours(-2) }, { userId: thomas.id, lastReadAt: hours(-26) }] },
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderId: clara.id,
        body: "Bonjour Thomas, l'objectif est-il inclus dans la vente ? Et avez-vous les factures de révision ?",
        createdAt: hours(-28),
        readAt: hours(-26),
      },
      {
        conversationId: conversation.id,
        senderId: thomas.id,
        body: "Bonjour Clara, oui l'objectif 50 mm est inclus, ainsi que la facture de révision de 2025. Je peux ajouter des photos du miroir si vous le souhaitez.",
        createdAt: hours(-26),
        readAt: hours(-2),
      },
      {
        conversationId: conversation.id,
        senderId: clara.id,
        body: "Parfait, merci. Je regarde les photos et je reviens vers vous rapidement.",
        createdAt: hours(-2),
      },
    ],
  });

  await prisma.favorite.createMany({
    data: [
      { userId: clara.id, listingId: listingRecords["Le Petit Prince — édition 1965"].id, createdAt: hours(-40) },
      { userId: clara.id, listingId: listingRecords["Fauteuil scandinave en teck"].id, createdAt: day(-3) },
      { userId: thomas.id, listingId: listingRecords["Lampe opaline années 60"].id, createdAt: day(-4) },
      { userId: lea.id, listingId: listingRecords["Robe vintage fleurie années 70"].id, createdAt: day(-9) },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: clara.id,
        type: "AUCTION_WON",
        title: "Félicitations, vous avez remporté une enchère",
        body: "Vous avez remporté « Lot de bougies artisanales parfumées » pour 23,00 €.",
        href: "/compte/encheres",
        createdAt: day(-6),
      },
      {
        userId: clara.id,
        type: "TROPHY_AWARDED",
        title: "Trophée Argent débloqué !",
        body: "Trois enchères finalisées : votre niveau Argent est actif. Réductions disponibles dans votre espace.",
        href: "/compte/trophees",
        createdAt: day(-5),
      },
      {
        userId: clara.id,
        type: "ORDER_PAID",
        title: "Achat confirmé !",
        body: "Votre paiement pour le casque Sony est confirmé. Le vendeur prépare votre colis.",
        href: "/compte/achats",
        createdAt: day(-2),
      },
      {
        userId: thomas.id,
        type: "MESSAGE",
        title: "Nouveau message",
        body: "ClaraVintage : « Parfait, merci. Je regarde les photos… »",
        href: `/compte/messages/${conversation.id}`,
        createdAt: hours(-2),
      },
      {
        userId: lea.id,
        type: "ORDER_DELIVERED",
        title: "Votre colis a été livré",
        body: "La commande A2V-LAM-1003 est indiquée comme livrée (simulation de suivi).",
        href: "/compte/livraisons",
        createdAt: day(-2),
      },
    ],
  });

  console.log("Solidarité et dons…");
  const charity = await prisma.charityOrganization.create({
    data: {
      slug: "ruban-violet-demo",
      name: "Fondation Ruban Violet (démonstration)",
      description:
        "Organisation fictive utilisée uniquement pour la démonstration technique. Aucun partenariat réel, aucune collecte réelle et aucune réduction fiscale ne sont affirmés. En production, remplacez-la par un organisme vérifié juridiquement.",
      website: "https://example.org/ruban-violet",
      legalStatus: "Association fictive — démonstration",
      verifiedAt: day(-60),
    },
  });

  await prisma.donation.createMany({
    data: [
      {
        donorId: lea.id,
        donorDisplayName: "LeaAtelier",
        isPublic: true,
        amountCents: 2500,
        status: "SUCCEEDED",
        provider: "SIMULATED",
        providerRef: "sim_donation_demo_1",
        receiptNumber: "A2V-DON-2026-DEMO01",
        message: "En soutien à la recherche. Merci pour cette initiative.",
        paidAt: day(-12),
        createdAt: day(-12),
      },
      {
        donorId: thomas.id,
        donorDisplayName: null,
        isPublic: false,
        amountCents: 1000,
        status: "SUCCEEDED",
        provider: "SIMULATED",
        providerRef: "sim_donation_demo_2",
        receiptNumber: "A2V-DON-2026-DEMO02",
        paidAt: day(-7),
        createdAt: day(-7),
      },
      {
        donorId: null,
        donorDisplayName: "Donateur anonyme",
        isPublic: true,
        amountCents: 5000,
        status: "SUCCEEDED",
        provider: "SIMULATED",
        providerRef: "sim_donation_demo_3",
        receiptNumber: "A2V-DON-2026-DEMO03",
        paidAt: day(-3),
        createdAt: day(-3),
      },
      {
        donorId: clara.id,
        donorDisplayName: null,
        isPublic: false,
        amountCents: 1500,
        status: "PENDING",
        provider: "SIMULATED",
        providerRef: null,
        receiptNumber: "A2V-DON-2026-DEMO04",
        createdAt: hours(-5),
      },
    ],
  });

  await prisma.charityReport.create({
    data: {
      periodStart: day(-90),
      periodEnd: day(-1),
      donationsCents: 8500,
      contributionsCents: 0,
      transferredCents: 0,
      notes:
        "Rapport de démonstration. Les dons enregistrés sont simulés. Aucun versement n'a été effectué : le montant reversé est donc affiché à 0 €.",
      publishedAt: now,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: "SEED_DEMO_DATA", targetType: "Platform", metadata: { note: "Initialisation des données de démonstration" }, createdAt: now },
      { actorId: clara.id, action: "SUBSCRIPTION_ACTIVATED_SIMULATED", targetType: "Subscription", targetId: claraSub.id, createdAt: day(-35) },
      { actorId: thomas.id, action: "LISTING_CREATED", targetType: "Listing", createdAt: day(-2) },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    listings: await prisma.listing.count(),
    auctions: await prisma.auction.count(),
    bids: await prisma.bid.count(),
    orders: await prisma.order.count(),
    trophies: await prisma.userTrophy.count(),
    donations: await prisma.donation.count(),
  };

  console.log("\nDonnées de démonstration prêtes :", counts);
  console.log("Comptes : admin@a2v.fr / clara@a2v.fr / thomas@a2v.fr / lea@a2v.fr");
  console.log(`Mot de passe commun : ${DEMO_PASSWORD}`);
  console.log("Paiements et suivis simulés — ne jamais présenter comme réels.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
