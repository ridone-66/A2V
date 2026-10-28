# Déploiement A2V

Ce document décrit une mise en production **réaliste**, y compris les points encore incomplets. A2V n'est pas prêt à encaisser des paiements réels en l'état : voir la checklist finale et [FONCTIONNALITES.md](FONCTIONNALITES.md).

---

## 1. Architecture cible

| Composant | Recommandation |
| --- | --- |
| Application | Next.js 15 (Node.js 22) sur Vercel, ou conteneur Node derrière un reverse proxy |
| Base | PostgreSQL 16 managé (Neon, Supabase, RDS…), SSL obligatoire, sauvegardes activées |
| Fichiers | Stockage objet S3/R2/Supabase Storage (le disque local est réservé au développement) |
| Paiements | Stripe (Checkout + Connect + webhook signé) |
| Livraison | La Poste (contrat, identifiants, webhook) |
| E-mail | SMTP transactionnel (Postmark, SES, Brevo…) |
| Tâches planifiées | Vercel Cron, GitHub Actions ou cron système appelant `/api/cron/tick` |
| Supervision | Journaux centralisés, alerte sur `/api/health`, alerte sur webhooks en échec |

---

## 2. Prérequis

- Node.js **22+**, npm.
- Une base PostgreSQL accessible avec SSL.
- Les secrets générés (`openssl rand -base64 48`) :
  - `SESSION_SECRET`
  - `CRON_SECRET`
  - `IP_HASH_SALT`
- Un nom de domaine et TLS.

---

## 3. Variables d'environnement de production

Partez de [`.env.example`](../.env.example). Valeurs minimales :

```dotenv
APP_URL=https://votre-domaine.fr

# Exécution (URL poolée) et migrations (URL directe)
DATABASE_URL=postgresql://user:password@host:5432/a2v?sslmode=require
DIRECT_URL=postgresql://user:password@host:5432/a2v?sslmode=require

SESSION_SECRET=<64+ caractères aléatoires>
CRON_SECRET=<secret aléatoire>
IP_HASH_SALT=<sel aléatoire>
PAYMENTS_SIMULATION=false

EMAIL_FROM="A2V <no-reply@votre-domaine.fr>"
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_SECURE=false

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PREMIUM=price_...

LAPOSTE_API_KEY=...
LAPOSTE_WEBHOOK_SECRET=...
LAPOSTE_API_BASE=https://api.laposte.fr
SHIPPING_MODE=live

# Vercel Blob (production serverless)
STORAGE_DRIVER=vercel-blob
BLOB_READ_WRITE_TOKEN=...
```

**Ne laissez jamais `PAYMENTS_SIMULATION=true` en production réelle.** L'application affiche un avertissement, mais elle accepterait des commandes fictives.

> Le pilote `s3` de l'interface de stockage n'est pas implémenté. Sur Vercel, utilisez `vercel-blob` ; le mode `local` est réservé au développement. Voir [VERCEL.md](VERCEL.md).

---

## 4. Base de données et migrations

### État actuel du dépôt

Le dépôt contient une **migration initiale versionnée** : `prisma/migrations/20261028130000_init`. Elle a été validée sur une base PostgreSQL vierge (53 tables, 1 migration).

```bash
# Développement : créer/appliquer une nouvelle migration
npx prisma migrate dev --name ma_modification

# Production (Vercel ou release) : appliquer uniquement les migrations versionnées
npx prisma migrate deploy
```

`prisma db push` reste pratique pour un prototype local, **pas** pour une base à préserver (aucun historique, risque de perte de colonne).

### Initialisation d'une base de démonstration

```bash
npm run db:deploy   # applique les migrations versionnées
npm run db:seed     # ATTENTION : efface les données
```

Ne lancez jamais `db:seed` ou `db:reset` sur une base de production. Le seed refuse de s'exécuter avec `NODE_ENV=production`.

---

## 5. Build et démarrage

### Vercel

1. Importer le dépôt, framework « Next.js », Root Directory `a2v` si nécessaire.
2. Définir les variables d'environnement (Production et Preview séparément).
3. Laisser la build command `npm run vercel-build` (définie dans `vercel.json`) : génération Prisma → migrations → build.
4. Utiliser un store Vercel Blob (`STORAGE_DRIVER=vercel-blob`).
5. Le cron Vercel appelle `/api/cron/tick` (header `Authorization: Bearer $CRON_SECRET`). La planification quotidienne de `vercel.json` est compatible Hobby ; `*/5 * * * *` nécessite Pro.

Guide détaillé : [VERCEL.md](VERCEL.md).

### Conteneur / VPS

```bash
npm ci
npm run build
NODE_ENV=production npm run start    # port 3000 par défaut
```

Derrière Nginx/Caddy : TLS, `X-Forwarded-*` corrects, limite de taille de corps (téléversements 5 Mo + marge), compression.

### Migrations au déploiement

Exécutez `npx prisma migrate deploy` **avant** de basculer le trafic, dans une étape de release séparée.

---

## 6. Tâches planifiées

`/api/cron/tick` est idempotent dans ses effets métier (statuts vérifiés avant mise à jour), mais peut être appelé plusieurs fois sans dégât majeur. Fréquence recommandée :

- Enchères : **toutes les minutes** (clôture à l'heure serveur).
- Commandes : toutes les 5 à 15 minutes (finalisation après délai).
- Abonnements : toutes les heures.

Exemple GitHub Actions :

```yaml
on:
  schedule:
    - cron: "*/5 * * * *"
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "$APP_URL/api/cron/tick" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

Surveillez les réponses non-200 et le champ `ok`.

---

## 7. Webhooks

### Stripe

- URL : `https://votre-domaine.fr/api/webhooks/stripe`
- Événements : `checkout.session.completed`, `checkout.session.expired` (ajoutez les événements Billing si vous complétez l'abonnement).
- Le secret `whsec_…` doit correspondre à l'environnement.
- Vérifiez dans le tableau de bord Stripe que les rejeux réussissent (idempotence).
- **Non testé sans clés** dans cet environnement.

### La Poste

- URL : `https://votre-domaine.fr/api/webhooks/laposte`
- Secret partagé dans `LAPOSTE_WEBHOOK_SECRET`.
- Refusé en `SHIPPING_MODE=simulation`.
- **Non testé contre l'API réelle.**

---

## 8. Sécurité et exploitation

### À faire impérativement

- [ ] `SESSION_SECRET`, `CRON_SECRET`, `IP_HASH_SALT` uniques et stockés dans un coffre de secrets.
- [ ] `PAYMENTS_SIMULATION=false`, `SHIPPING_MODE=live`.
- [ ] Stockage objet (pas de disque local).
- [ ] SMTP réel configuré et testé.
- [ ] Rate limiting distribué (remplacer `src/lib/rate-limit.ts`).
- [ ] Journaux centralisés + alerte sur erreurs 5xx et webhooks `FAILED`.
- [ ] Sonde `/api/health` supervisée (base + intégrations).
- [ ] En-têtes de sécurité au niveau du proxy (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, CSP adaptée à Next).
- [ ] Sauvegardes testées (voir [SAUVEGARDE.md](SAUVEGARDE.md)).
- [ ] Accès admin nominatifs, revue des rôles, journal d'audit consulté.
- [ ] Purge/archivage des données selon la politique de conservation (aucune purge automatique n'est fournie).

### Limites connues à corriger avant lancement

- Rate limiting **en mémoire** : inefficace en multi-instances.
- Stockage local inadapté à un système de fichiers éphémère.
- Aucun envoi réel d'e-mail sans SMTP.
- Vérification d'e-mail **non implémentée** (comptes utilisables sans vérification).
- Flux Stripe Billing de l'abonnement **non branché** (pas de création de session d'abonnement).
- Période d'abonnement approximée à 30 jours dans le webhook.
- Notifications de début/fin imminente d'enchère **non envoyées**.
- Pas de panier multi-articles : chaque achat est direct.
- Aucune purge automatique des données, aucun outil de rétention.

---

## 9. Vérifications après déploiement

```bash
curl -fsS https://votre-domaine.fr/api/health
```

Puis, manuellement ou via Playwright :

1. Inscription et connexion.
2. Publication d'une annonce avec image.
3. Achat à prix fixe → paiement (réel ou simulé, selon l'environnement).
4. Enchère → clôture par cron → paiement du gagnant.
5. Prestige : essai, activation, résiliation.
6. Livraison : étiquette, suivi, réception, finalisation.
7. Don : enregistrement, page solidarité, reversement admin.
8. Export RGPD et suppression de compte.
9. Accès admin refusé à un membre, journal d'audit alimenté.
10. Webhooks : signature invalide refusée, rejeu idempotent.

---

## 10. Retour arrière

1. Redéployer la version précédente de l'application.
2. Les migrations destructives doivent être évitées ; sinon restaurer la sauvegarde (voir [SAUVEGARDE.md](SAUVEGARDE.md)).
3. Vérifier `/api/health` et les journaux.
4. Informer les utilisateurs si des paiements ou expéditions sont concernés.

---

## 11. Checklist légale et commerciale (hors code)

- [ ] CGU/CGV et mentions légales validées par un juriste.
- [ ] Entités, adresses, SIRET et contacts réels (les valeurs livrées sont fictives).
- [ ] Politique de confidentialité et durées de conservation arrêtées.
- [ ] Contrat Stripe Connect et vérification des comptes vendeurs.
- [ ] Contrat transporteur et conditions de livraison.
- [ ] Associations bénéficiaires réelles, vérifiées, avec mécanisme de reversement documenté.
- [ ] Aucune promesse de déduction fiscale sans cadrage comptable.
- [ ] Assurance, médiation de la consommation, mentions de rétractation.
