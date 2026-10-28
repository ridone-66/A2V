# A2V — marketplace communautaire (démonstration complète)

A2V est une place de marché française : achats à prix fixe, enchères, abonnement Prestige, trophées et réductions, livraison suivie, messagerie, espace membre, administration et dons solidaires séparés des ventes.

> **État du projet : démonstration fonctionnelle, pas prête pour encaisser de l'argent réel.**
> Les paiements et les étiquettes de livraison sont **simulés** tant que Stripe et La Poste ne sont pas configurés et testés. Les entités juridiques, associations et adresses de contact livrées sont fictives. Voir [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md) pour la matrice exacte « fonctionnel / simulé / non implémenté ».

> Les photos des annonces sont des **photos d'illustration** issues de Wikimedia Commons (licences libres) : elles ne représentent pas les objets réellement vendus. Attribution et licences : [docs/PHOTOS.md](docs/PHOTOS.md).

---

## 1. Stack technique

| Domaine | Choix |
| --- | --- |
| Framework | Next.js 15.5.28 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS 3.4, composants maison, lucide-react |
| Langage | TypeScript strict |
| Base de données | PostgreSQL 16 + Prisma 6.3.1 |
| Validation | Zod + React Hook Form |
| Authentification | Sessions opaques en base, cookie `HttpOnly`, hachage scrypt |
| Paiements | Adaptateur Stripe (checkout + webhook signé) + mode simulation explicite |
| Livraison | Passerelle transporteur (La Poste) + mode simulation explicite |
| Tests | Vitest (unitaire), Playwright (bout en bout) |
| Monnaie | Entiers de centimes partout (aucun flottant monétaire) |

Identité visuelle : violet `#6D28D9` / `#4C1D95` / `#EDE9FE` / `#F5F3FF`, texte `#211A2C`, interface intégralement en français, EUR, fuseau `Europe/Paris`.

---

## 2. Démarrage rapide

Prérequis : **Node.js 22+**, npm, aucun PostgreSQL externe n'est nécessaire pour le développement local (une instance embarquée est fournie).

```bash
cd a2v
npm install
cp .env.example .env          # puis ajustez les secrets
npm run db:start              # PostgreSQL local sur 127.0.0.1:5433
npm run db:push               # crée le schéma
npm run db:seed               # jeu de données de démonstration
npm run dev                   # http://localhost:3000
```

Raccourci équivalent : `npm run setup` (démarre la base, pousse le schéma, seed).

Arrêt de la base locale : `npm run db:stop`.

### Comptes de démonstration

Mot de passe commun : **`A2v!Demo2026`**

| Compte | Rôle | Intérêt |
| --- | --- | --- |
| `admin@a2v.fr` | ADMIN | Administration complète, audit, paramètres |
| `moderateur@a2v.fr` | MODERATOR | Modération, litiges, enchères (sans paramètres financiers) |
| `clara@a2v.fr` | USER | Prestige actif, ventes finalisées, trophées Bronze/Argent |
| `thomas@a2v.fr` | USER | Enchère remportée à payer, essai Prestige |
| `lea@a2v.fr` | USER | Achats, favoris, messagerie |

Ces comptes et annonces sont fictifs. Ne réutilisez jamais ces mots de passe hors démonstration.

### Déploiement Vercel (résumé)

1. Importer le dépôt dans Vercel (Root Directory `a2v` si nécessaire).
2. Créer un PostgreSQL via le Marketplace Vercel, puis définir `DATABASE_URL` (URL poolée) et `DIRECT_URL` (URL directe pour les migrations).
3. Créer un store **Vercel Blob**, définir `STORAGE_DRIVER=vercel-blob` et vérifier `BLOB_STORE_ID` (OIDC) ou `BLOB_READ_WRITE_TOKEN`.
4. Renseigner `APP_URL`, `SESSION_SECRET`, `CRON_SECRET`, `IP_HASH_SALT`, `PAYMENTS_SIMULATION`, `SHIPPING_MODE`.
5. Déployer : `npm run vercel-build` applique la migration initiale puis construit Next.js.
6. Le premier build Vercel peut seeder automatiquement la base si `SEED_DEMO_DATA=true` et que la base est vide. Sinon, lancez le seed manuellement avec `NODE_ENV=development` et la `DATABASE_URL` hébergée.

Le guide complet, la liste des variables et les limites (cron, rate limiting, stockage) sont dans [docs/VERCEL.md](docs/VERCEL.md).

---

## 3. Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` + build de production |
| `npm run start` | Serveur de production (après build) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (config Next) |
| `npm test` | Tests unitaires Vitest |
| `npm run test:watch` | Vitest en mode veille |
| `npm run test:e2e` | Playwright (nécessite un serveur et `npx playwright install chromium`) |
| `npm run db:start` / `db:stop` | PostgreSQL local embarqué |
| `npm run db:push` | Applique le schéma sans migration versionnée (développement) |
| `npm run db:migrate` | Crée une migration Prisma (développement) |
| `npm run db:deploy` | Applique les migrations (production) |
| `npm run db:seed` | Réinitialise et recharge les données de démonstration |
| `node scripts/screenshots.mjs` | Captures responsive dans `docs/captures/` (serveur démarré) |

> `db:seed` **efface** les données existantes du schéma. Ne l'exécutez jamais sur une base de production.

---

## 4. Variables d'environnement

Le contrat complet est dans [`.env.example`](.env.example). Points essentiels :

- `DATABASE_URL` — PostgreSQL obligatoire.
- `SESSION_SECRET`, `CRON_SECRET`, `IP_HASH_SALT` — secrets aléatoires (32+ caractères pour la session).
- `PAYMENTS_SIMULATION=true` — autorise les paiements fictifs en développement. **Doit être `false` en production.**
- `SHIPPING_MODE=simulation` — étiquettes et suivis fictifs clairement marqués. `live` exige les identifiants transporteur.
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — active le checkout réel et le webhook signé.
- `SMTP_*` — sans configuration, les e-mails partent en mode console (journalisés, jamais envoyés).
- `STORAGE_DRIVER=local` — stockage disque en développement. Sur Vercel, utilisez `STORAGE_DRIVER=vercel-blob` avec un store Blob connecté (`BLOB_STORE_ID` + OIDC) ou `BLOB_READ_WRITE_TOKEN`.

Aucun secret n'est exposé au navigateur : les modules sensibles sont serveur uniquement (`server-only`).

---

## 5. Architecture

```
a2v/
├── prisma/
│   ├── schema.prisma          # ~45 modèles/enums, source de vérité
│   └── seed.ts                # données de démonstration + visuels SVG locaux
├── public/demo/               # photos d'illustration (Wikimedia Commons) + SVG de secours
├── scripts/
│   ├── dev-db.mjs             # cycle de vie PostgreSQL embarqué
│   ├── screenshots.mjs        # captures desktop/mobile
│   └── close-auctions.ts      # clôture manuelle d'enchères (script)
├── src/
│   ├── app/
│   │   ├── actions/           # Server Actions (auth, annonces, commandes, enchères, admin…)
│   │   ├── api/               # routes HTTP (uploads, export RGPD, webhooks, cron, santé)
│   │   ├── admin/             # espace d'administration protégé
│   │   ├── compte/            # espace membre
│   │   └── …                  # pages publiques (catalogue, enchères, premium, legal…)
│   ├── components/            # UI, formulaires, navigation
│   └── lib/
│       ├── auth/              # sessions, permissions, CSRF
│       ├── integrations/      # Stripe, La Poste, e-mail, stockage
│       ├── services/          # logique métier (commandes, enchères, premium…)
│       └── …                  # env, db, money, validation, rate-limit
├── tests/                     # Vitest + Playwright
└── docs/                      # API, déploiement, sauvegarde, matrice fonctionnelle
```

Règles structurantes :

- Les **Server Actions** vérifient session, permission et validation Zod ; les montants sont toujours recalculés côté serveur (jamais lus depuis le formulaire).
- Les **services** contiennent la logique métier et les transactions. Les pages ne font que lire et afficher.
- Les **webhooks** vérifient la signature avant toute lecture métier et utilisent une contrainte d'unicité `(provider, eventId)` pour l'idempotence.

---

## 6. Règles métier clés

### Commission

- **0,5 % (50 points de base)** du prix final de l'article, **hors frais de livraison**.
- Publication gratuite, aucun abonnement obligatoire.
- La commission est **encaissée par A2V** : elle est retenue sur le versement du vendeur. **Aucun frais de commission n'est ajouté au prix payé par l'acheteur.**
- La base et le taux sont configurables en administration. La réduction trophée/coupon est financée par A2V et ne réduit pas la part vendeur dans la configuration par défaut.
- Versement vendeur = prix de l'article − commission. Total acheteur = article + livraison − réduction.

### Enchères

- Heure **serveur** uniquement ; aucune confiance au navigateur.
- Offres dans une transaction `Serializable` avec nouvelles tentatives ; une offre tardive est refusée.
- Incrément minimum configurable, prix de réserve, achat immédiat.
- Anti-sniping : toute offre dans les 120 dernières secondes prolonge de 120 secondes, dans la limite de 10 prolongations.
- Clôture par tâche planifiée (`/api/cron/tick`) : crée un gagnant avec **48 h** pour payer. Passé ce délai, le gagnant est déclaré défaillant et le paiement n'est jamais inventé.
- Égalité d'offres : la première offre valide reste gagnante (horodatage serveur).

### Prestige

- **6 €/mois**, **3 mois offerts**, sans engagement, résiliable en ligne.
- L'essai **expire** sans reconduction ni prélèvement silencieux : l'utilisateur choisit explicitement de continuer.
- En mode simulation, l'activation crée un paiement fictif marqué comme tel. En production, seule la confirmation Stripe Billing par webhook signé active l'abonnement.
- Les offres réservées aux membres sont vérifiées côté serveur.
- Toute annonce affichée à **plus de 10 000 €** (prix fixe ou prix de départ d'une enchère) est automatiquement réservée aux membres Prestige (contrôle serveur à la création et à la modification). En dessous du seuil, le vendeur peut choisir librement de la réserver.
- Les membres actifs disposent de `/premium/offres` (page `noindex`) : annonces à prix fixe et enchères Prestige. Aucune donnée d'annonce n'est chargée avant la vérification de l'abonnement.

### Trophées et réductions

- Attribués **uniquement après finalisation d'une vente** (enchère ou prix fixe), jamais après une simple offre ou un panier.- Règles de récompense et coupons configurables, réductions **plafonnées** (jamais plus que le sous-total).
- Aucun crédit d'argent automatique.
- La page `/trophees` affiche deux grands trophées décoratifs animés en CSS sur les côtés (écrans `xl` et plus). Ils sont `aria-hidden`, sans interaction et désactivés si `prefers-reduced-motion` est actif.

### Livraison

- Frais **payés par l'acheteur**, affichés **avant** le paiement, exclus de l'assiette de commission.
- Transitions de suivi contrôlées par une machine à états (pas de retour en arrière après livraison).
- Sans identifiants La Poste, tout est **simulé** et signalé dans l'interface ; aucun numéro de suivi fictif n'est présenté comme réel.

### Dons

- Flux comptable **séparé** des ventes, commissions et abonnements.
- Aucun pourcentage de contribution de la plateforme n'est inventé ; `charity.platformContributionBps` vaut 0 par défaut.
- Un montant n'est affiché comme « reversé » qu'après enregistrement d'un virement avec référence et date.
- Aucun reçu fiscal ni avantage commercial n'est promis.

### RGPD

- Export JSON du compte via `/api/account/export` (limité au titulaire, débit limité).
- Suppression de compte avec confirmation forte : anonymisation, révocation des sessions ; les obligations comptables sont conservées de façon restreinte.
- Un litige ou une vente en cours peut bloquer la suppression.

### Mentions légales et crédits

- `/mentions-legales` reprend les informations attendues par la LCEN : identité de l'éditeur, forme juridique, capital, siège, RCS/RNE, TVA, directeur de publication, contact, hébergeur, propriété intellectuelle, données personnelles, cookies, résiliation en ligne, signalement et médiation.
- Les champs entre crochets (éditeur, hébergeur, médiateur, téléphone) doivent être complétés et validés juridiquement avant toute mise en production. La démonstration n'exerce aucune activité commerciale réelle.
- `/credits-photos` publie l'attribution, la licence et la source de chaque photo d'illustration ; la page est générée en même temps que `docs/PHOTOS.md`.
- Le pied de page pointe vers les pages réelles (`/mentions-legales`, `/cgu`, `/confidentialite`, `/cookies`, `/credits-photos`) et non vers d'anciennes routes `/legal/*`.

---

## 7. Sécurité

- Mots de passe hachés avec **scrypt** (sel aléatoire, comparaison à temps constant).
- Sessions opaques : jeton aléatoire, **haché** en base, cookie `HttpOnly` + `SameSite=Lax`, expiration et révocation.
- Vérification d'origine (CSRF) sur les mutations, limitation de débit sur connexion, inscription, contact, uploads et export.
- Permissions vérifiées côté serveur pour chaque action d'administration ; navigation filtrée côté interface par confort seulement.
- **Journal d'audit** en ajout seul pour les actions sensibles.
- Aucune donnée de carte stockée : le paiement est délégué au prestataire.
- Journaux structurés avec masquage des clés sensibles (`password`, `token`, `authorization`, `card`…).
- En-têtes de sécurité sur les réponses sensibles (étiquettes, fichiers téléversés).

Limites connues : la limitation de débit est **en mémoire** (une seule instance). En production multi-instances, remplacez-la par Redis/Upstash. Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).

---

## 8. Tests

```bash
npm test                     # 60 tests unitaires (Vitest)
npx tsc --noEmit             # typage strict
npm run build                # build de production
npx playwright install chromium
npm run test:e2e             # 26 tests e2e desktop + mobile
```

Résultats vérifiés dans cet environnement :

- `npm run build` : succès, 57 routes générées.
- `npx tsc --noEmit` : aucune erreur.
- `npm test` : 8 fichiers, 60 tests réussis.
- `npx playwright test` : 26 tests réussis (desktop et mobile) sur le serveur de production.

Les tests unitaires couvrent : monnaie et arrondis, commission (assiette, plafonds, erreurs), prix minimum d'enchère, plafonnement des coupons et réductions, machine à états de livraison, permissions par rôle, cycle de vie Prestige, seuil automatique Prestige à 10 000 € et avantage de 15 % au-delà du seuil.

---

## 9. Documentation

- [docs/API.md](docs/API.md) — routes HTTP, authentification, erreurs, webhooks.
- [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) — mise en production, cron, sauvegardes, checklist.
- [docs/VERCEL.md](docs/VERCEL.md) — déploiement Vercel : Postgres hébergé, migrations, Vercel Blob, cron et variables d'environnement.
- [docs/SAUVEGARDE.md](docs/SAUVEGARDE.md) — sauvegarde/restauration PostgreSQL, plan de reprise.
- [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md) — **matrice honnête** : fonctionnel, simulé, non implémenté.
- [docs/PHOTOS.md](docs/PHOTOS.md) — attribution et licences des photos d'illustration des annonces de démonstration.

---

## 10. Avertissements

Ce dépôt est une démonstration technique. Avant tout lancement réel, il faut au minimum :

1. Faire valider les CGU/CGV, mentions légales et la politique de confidentialité par un juriste.
2. Remplacer les entités et coordonnées fictives (support, associations, siège).
3. Contractualiser et tester Stripe Connect (y compris les remboursements et les webhooks en production).
4. Contractualiser La Poste (ou un autre transporteur) et tester les étiquettes réelles.
5. Configurer un store Vercel Blob (téléversements), un SMTP transactionnel et un rate limiting distribué.
6. Mettre en place une supervision, des sauvegardes testées et une procédure d'incident.
7. Remplacer les photos d'illustration de démonstration par les photos réelles des vendeurs et conserver les preuves de droits (voir [docs/PHOTOS.md](docs/PHOTOS.md)).
