# Déploiement sur Vercel

A2V est une application **Next.js 15 (App Router)** avec **PostgreSQL + Prisma**. Elle ne contient ni SQLite ni serveur applicatif permanent : la base locale fournie pour le développement est remplacée par un PostgreSQL hébergé, et le disque local des téléversements par **Vercel Blob**.

---

## 1. Ce qui a été adapté pour Vercel

| Sujet | Avant | Après |
| --- | --- | --- |
| Base de données | PostgreSQL local sur le port 5433 | `DATABASE_URL` hébergée (Vercel Postgres / Neon / Supabase) ; `DIRECT_URL` pour les migrations |
| Schéma | `prisma db push`, aucune migration | Migration initiale versionnée `prisma/migrations/20261028130000_init` |
| Build | `prisma generate && next build` | `vercel-build` : `prisma generate` → `prisma migrate deploy` → `next build` |
| Téléversements | Disque local `var/uploads` | `STORAGE_DRIVER=vercel-blob` + `BLOB_READ_WRITE_TOKEN` (le mode local reste disponible en développement) |
| Taille des images | 5 Mo | 4 Mo, pour rester sous la limite de 4,5 Mo des fonctions Vercel |
| Tâches planifiées | Serveur/cron externe | Vercel Cron appelle `/api/cron/tick` (protégé par `CRON_SECRET`) |
| URL publique | `http://localhost:3000` | `APP_URL`, avec repli automatique sur `VERCEL_URL` |
| Secrets de production | Valeurs de développement tolérées | Erreur explicite si `DATABASE_URL` manque en production ; avertissements pour les secrets de dev |
| Fichiers ignorés | `node_modules`, `.next`, `.env*` | Ajout de `!.env.example`, `.vercel`, `test-results`, `playwright-report`, `var/uploads` |

> **Important :** `prisma db push` n'est plus la méthode de production. Utilisez les migrations versionnées. Le seed de démonstration efface les données : ne l'exécutez jamais sur une base contenant des données réelles.

---

## 2. Prérequis

1. Un dépôt Git contenant le dossier `a2v/` (ou la racine du projet si le dépôt commence à `a2v`).
2. Un compte Vercel.
3. Une base **PostgreSQL** créée depuis le Marketplace Vercel (Neon, Supabase, Vercel Postgres…).
4. Un store **Vercel Blob** créé depuis le Marketplace (ou un compte Blob existant).

---

## 3. Étapes de déploiement

### 3.1 Importer le projet

1. Vercel → **Add New → Project** → importer le dépôt.
2. Si le dépôt contient un dossier parent, définir **Root Directory** sur `a2v`.
3. Vercel détecte Next.js. Laisser la commande de build par défaut : `vercel.json` impose `npm run vercel-build`.

### 3.2 Créer la base PostgreSQL

1. Vercel → **Storage / Marketplace** → ajouter une base PostgreSQL.
2. Relier la base au projet.
3. Récupérer deux URL :
   - **URL poolée** → variable `DATABASE_URL` (exécution) ;
   - **URL directe / non poolée** → variable `DIRECT_URL` (migrations).
4. Avec l'intégration Neon/Vercel Postgres, les variables peuvent s'appeler `POSTGRES_PRISMA_URL` et `POSTGRES_URL_NON_POOLING`. Recopiez-les dans `DATABASE_URL` et `DIRECT_URL`, ou laissez le script utiliser `POSTGRES_URL_NON_POOLING` comme repli.
5. Ajoutez `?sslmode=require` si le fournisseur ne l'ajoute pas.

### 3.3 Créer le stockage Vercel Blob

1. Vercel → **Storage** → **Blob** → créer un store et le relier au projet.
2. Vercel ajoute automatiquement `BLOB_READ_WRITE_TOKEN`.
3. Définir `STORAGE_DRIVER=vercel-blob`.

### 3.4 Renseigner les variables

Dans **Project Settings → Environment Variables**, ajoutez les variables pour **Production** et **Preview** (et Development si vous utilisez `vercel dev`). Voir la liste complète au §5.

### 3.5 Déployer

Le build Vercel exécute :

```text
prisma generate
prisma migrate deploy   (avec DIRECT_URL)
next build
```

La migration initiale crée les 53 tables et tous les enums. Le script accepte aussi les noms fournis par Vercel Postgres / Neon : `POSTGRES_URL_NON_POOLING`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL` et `POSTGRES_URL`. Si ces variables existent mais que `DATABASE_URL`/`DIRECT_URL` manquent, ajoutez tout de même les deux alias explicites pour l'exécution et les migrations.

Si le build affiche **« Aucune base PostgreSQL n'est configurée »**, cela signifie qu'aucun store Postgres n'est relié au projet ou que les variables ne sont pas encore disponibles pour ce déploiement :

1. Vercel → **Storage** → **Create Database** → **Postgres**.
2. Connecter la base au projet.
3. Vérifier que `DATABASE_URL` et `DIRECT_URL` existent dans **Settings → Environment Variables** (Production et Preview).
4. Cliquer sur **Redeploy** : un simple redéploiement sans nouvelle variable réutilise l'ancienne configuration.

### 3.6 Seed de démonstration (optionnel)

Le seed est bloqué en production. Pour une démonstration, exécutez-le **depuis votre machine**, avec la base hébergée et `NODE_ENV=development` :

```powershell
$env:NODE_ENV="development"
$env:DATABASE_URL="postgresql://…/a2v?sslmode=require"
npm run db:seed
```

> `db:seed` **efface** les données existantes. Ne l'utilisez pas sur une base de production réelle.

### 3.7 Vérifier

```bash
curl -fsS https://votre-domaine.vercel.app/api/health
```

Puis testez : connexion, publication avec image, achat simulé, enchère, page Prestige, export RGPD.

---

## 4. Tâches planifiées

`vercel.json` configure un cron **quotidien** (`0 3 * * *`) compatible avec l'offre Hobby. Il appelle `GET /api/cron/tick`, et Vercel transmet automatiquement `Authorization: Bearer $CRON_SECRET`.

Pour des enchères closes à l'heure près, passez sur Vercel Pro et remplacez la planification par :

```json
{ "crons": [{ "path": "/api/cron/tick", "schedule": "*/5 * * * *" }] }
```

Sinon, utilisez un scheduler externe (GitHub Actions, cron) qui appelle la même URL avec le même en-tête. La route est idempotente dans ses effets métier.

---

## 5. Variables d'environnement

### Obligatoires en production

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL **poolée** utilisée par l'application (SSL requis). |
| `DIRECT_URL` | URL PostgreSQL **directe** utilisée uniquement par `prisma migrate deploy`. |
| `SESSION_SECRET` | Secret de signature/hachage des sessions ; 32 caractères minimum. |
| `CRON_SECRET` | Secret partagé avec Vercel Cron pour `/api/cron/tick`. |
| `IP_HASH_SALT` | Sel de hachage des adresses IP (sécurité, limitation de débit). |
| `APP_URL` | URL publique HTTPS du site (ex. `https://a2v.vercel.app`). |
| `STORAGE_DRIVER` | `vercel-blob` en production. |
| `BLOB_READ_WRITE_TOKEN` | Jeton du store Vercel Blob pour les téléversements. |
| `PAYMENTS_SIMULATION` | `true` pour la démonstration ; `false` uniquement avec Stripe configuré. |
| `SHIPPING_MODE` | `simulation` pour la démonstration ; `live` avec La Poste configurée. |

### Recommandées / fonctionnelles

| Variable | Rôle |
| --- | --- |
| `APP_NAME` | Nom affiché (défaut `A2V`). |
| `DEFAULT_CURRENCY` | Devise par défaut (défaut `EUR`). |
| `DEFAULT_LOCALE` | Locale par défaut (défaut `fr-FR`). |
| `COMMISSION_RATE_BPS` | Taux de commission en points de base (défaut `50` = 0,5 %). |
| `PREMIUM_PRICE_CENTS` | Prix mensuel Prestige en centimes (défaut `600`). |
| `PREMIUM_TRIAL_MONTHS` | Durée de l'essai Prestige (défaut `3`). |

### E-mail (optionnel)

| Variable | Rôle |
| --- | --- |
| `EMAIL_FROM` | Expéditeur des e-mails transactionnels. |
| `SMTP_HOST` | Hôte SMTP. |
| `SMTP_PORT` | Port SMTP (défaut `587`). |
| `SMTP_USER` | Utilisateur SMTP. |
| `SMTP_PASSWORD` | Mot de passe SMTP. |
| `SMTP_SECURE` | `true` pour TLS implicite (port 465). |

### Stripe (optionnel)

| Variable | Rôle |
| --- | --- |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (Checkout, Connect, Billing). |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature du webhook `/api/webhooks/stripe`. |
| `STRIPE_PRICE_PREMIUM` | Identifiant du prix Stripe Billing pour Prestige. |

### La Poste (optionnel)

| Variable | Rôle |
| --- | --- |
| `LAPOSTE_API_KEY` | Clé API transporteur. |
| `LAPOSTE_WEBHOOK_SECRET` | Secret du webhook `/api/webhooks/laposte`. |
| `LAPOSTE_API_BASE` | Base de l'API transporteur (défaut `https://api.laposte.fr`). |

### Développement local uniquement

| Variable | Rôle |
| --- | --- |
| `A2V_DB_PORT` | Port du PostgreSQL embarqué (défaut `5433`). |
| `A2V_DB_PASSWORD` | Mot de passe du PostgreSQL embarqué. |

> `NODE_ENV` est fourni par Vercel : ne le définissez pas manuellement. `VERCEL_URL` est aussi fourni automatiquement et sert de repli à `APP_URL`.

---

## 6. Limites connues après migration Vercel

- **Rate limiting en mémoire** : chaque instance serverless possède son propre compteur. Pour une protection réelle, utilisez Upstash Redis / Vercel KV via le Marketplace.
- **Paiements et livraison simulés** tant que Stripe et La Poste ne sont pas configurés et testés.
- **Cron quotidien** sur Hobby : les enchères peuvent être clôturées avec retard ; passez sur Pro ou utilisez un scheduler externe.
- **Seed** non automatisé et destructif : à exécuter manuellement pour une base de démonstration.
- **Pas de vérification d'e-mail**, pas de purge RGPD automatique, pas de sauvegarde automatique fournie.
- Les webhooks Stripe/La Poste doivent être configurés avec l'URL de production et testés avant tout encaissement réel.
