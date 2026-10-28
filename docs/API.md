# API A2V

A2V est une application Next.js : l'essentiel des mutations passe par des **Server Actions** (non exposées comme API REST publique). Les routes HTTP ci-dessous sont les points d'intégration stables (webhooks, cron, fichiers, santé, RGPD).

---

## 1. Conventions

- **Monnaie** : tous les montants sont des **entiers de centimes** (`amountCents`, `buyerTotalCents`…), jamais des flottants. Devise par défaut : EUR.
- **Temps** : les dates sont en ISO 8601 UTC ; l'affichage est en `Europe/Paris`. Les décisions d'enchère utilisent l'horloge **serveur**.
- **Erreurs JSON** : `{ "error": "message en français" }` avec un code HTTP adapté.
- **Erreurs de Server Actions** : `{ status: "error", message, errors?: Record<string, string[]> }` (compatible `useActionState`).
- **Authentification** : cookie de session `a2v_session` (`HttpOnly`, `SameSite=Lax`). Aucun jeton Bearer pour les utilisateurs.
- **CSRF** : les mutations vérifient l'origine de la requête ; les routes sensibles vérifient en plus une signature ou un secret.
- **Secrets** : jamais renvoyés au client. Aucune donnée de carte n'est stockée.

### Codes d'erreur métier (Server Actions)

| Code | Sens |
| --- | --- |
| `UNAUTHENTICATED` | Session absente ou expirée |
| `FORBIDDEN` | Droits insuffisants |
| `NOT_FOUND` | Ressource inexistante ou non accessible |
| `VALIDATION` | Données invalides |
| `CONFLICT` | État incompatible (enchère fermée, transition invalide…) |
| `RATE_LIMITED` | Trop de requêtes |
| `PAYMENT_REQUIRED` | Paiement nécessaire |
| `AUCTION_CLOSED` | Enchère terminée |
| `OUTBID` | Offre dépassée |
| `NOT_CONFIGURED` | Intégration absente (Stripe, La Poste, SMTP…) |
| `INTERNAL` | Erreur serveur |

---

## 2. Routes HTTP

| Méthode | Route | Auth | Rôle |
| --- | --- | --- | --- |
| `GET` | `/api/health` | publique | Sonde de santé (base + état des intégrations) |
| `POST` | `/api/uploads` | session | Téléversement d'image |
| `GET` | `/api/uploads/[name]` | publique | Lecture d'une image téléversée |
| `GET` | `/api/shipping/label/[id]` | session (participant ou admin) | Étiquette de livraison HTML |
| `POST` | `/api/webhooks/stripe` | signature Stripe | Paiements et abonnements |
| `POST` | `/api/webhooks/laposte` | secret transporteur | Suivi de livraison |
| `GET`/`POST` | `/api/cron/tick` | `Bearer CRON_SECRET` | Tâches planifiées |
| `GET` | `/api/account/export` | session | Export RGPD du compte |

---

### `GET /api/health`

Sonde de disponibilité. Ne révèle aucun secret.

```json
{
  "status": "ok",
  "service": "a2v",
  "environment": "production",
  "time": "2026-10-28T09:12:00.000Z",
  "database": "ok",
  "latencyMs": 3,
  "integrations": {
    "payments": "simulation",
    "email": "console",
    "shipping": "simulation",
    "storage": "local"
  },
  "simulation": { "payments": true, "shipping": true, "email": true }
}
```

- `200` si la base répond, `503` si `database` vaut `error`.
- Valeurs d'intégration : `payments` ∈ `stripe | simulation | disabled`, `email` ∈ `smtp | console`, `shipping` ∈ `live | simulation | unconfigured`.

---

### `POST /api/uploads`

Téléverse une image de profil ou d'annonce.

- **Authentification** : session obligatoire.
- **Origine** : si l'en-tête `Origin` est présent, il doit correspondre au serveur.
- **Limite** : 30 téléversements/heure/utilisateur (mémoire, instance unique).
- **Corps** : `multipart/form-data`, champ `file`.
- **Formats** : JPEG, PNG, WebP, AVIF — 5 Mo maximum, type vérifié par signature binaire.
- **Réponse `201`** :

```json
{ "url": "/api/uploads/1712345678-abcd.webp", "size": 48213, "mime": "image/webp" }
```

Erreurs : `401` non connecté, `403` origine invalide, `429` limite atteinte, `400` fichier absent/invalide, `500` échec d'écriture.

> En production serverless, le pilote `local` n'est pas fiable (système de fichiers éphémère). Utilisez un stockage objet ; l'interface S3 est présente mais **non testée sans identifiants**.

---

### `GET /api/uploads/[name]`

Sert un fichier téléversé.

- Nom validé (pas de traversée de chemin), type MIME contrôlé.
- En-têtes : `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, CSP restrictive.
- `404` si le fichier n'existe pas.

---

### `GET /api/shipping/label/[id]`

Retourne l'étiquette HTML d'une expédition (`Content-Type: text/html`).

- **Accès** : acheteur, vendeur de la commande, ou administrateur avec `orders.manage`.
- `401` sans session, `403` non participant, `404` expédition inconnue.
- En mode simulation, l'étiquette porte une mention explicite : elle ne doit pas servir à une expédition réelle.
- CSP appliquée : `default-src 'none'; style-src 'unsafe-inline'`.

---

### `POST /api/webhooks/stripe`

Reçoit les événements Stripe.

**Sécurité**

1. `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` doivent être configurés, sinon `503`.
2. La signature `Stripe-Signature` est vérifiée sur le corps **brut** avant toute lecture métier (`400` si invalide).
3. Idempotence via la table `WebhookEvent`, contrainte unique `(provider, eventId)`.
   - Événement déjà `PROCESSED` → `200 { "received": true, "duplicate": true }`.
   - Échec de traitement → statut `FAILED`, réponse `500` pour que Stripe rejoue.
4. Aucun paiement n'est supposé sans webhook signé.

**Événements traités**

| Événement | Traitement |
| --- | --- |
| `checkout.session.completed` (métadonnée `kind=ORDER`) | Si `payment_status=paid`, marque la commande payée (transaction sérialisable) |
| `checkout.session.completed` (`kind=PREMIUM`) | Active l'abonnement via `activateSubscriptionFromStripe` (période approximée à 30 jours) |
| `checkout.session.expired` (`kind=ORDER`) | Passe les paiements en attente en `FAILED` (`CHECKOUT_EXPIRED`) |
| Autres | Journalisés et ignorés (non implémentés) |

**Limites connues**

- Aucun code ne crée actuellement de session Stripe Billing pour Prestige : `createSubscriptionCheckoutSession` existe mais n'est branchée sur aucune action. Le flux d'abonnement **réel** n'est donc pas complet.
- La période d'abonnement est calculée à `now + 30 jours` ; en production, utilisez `invoice.paid` / l'objet `subscription` comme source de vérité.
- Les remboursements Stripe réels ne sont pas testés dans cet environnement (aucune clé).

---

### `POST /api/webhooks/laposte`

Reçoit les mises à jour de suivi du transporteur.

- En `SHIPPING_MODE=simulation` : `503`, car aucun suivi réel n'est attendu.
- Signature/secret vérifié par `verifyCarrierWebhook` ; sinon `401`.
- Corps JSON :

```json
{
  "trackingNumber": "6A12345678901",
  "status": "IN_TRANSIT",
  "occurredAt": "2026-10-28T08:30:00.000Z",
  "message": "Colis en cours d'acheminement"
}
```

- Statuts acceptés : `HANDED_OVER`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `LOST`, `DAMAGED`, `RETURNED`.
- `422` corps/statut invalide, `404` numéro inconnu, `409` transition interdite par la machine à états.

> Aucune connexion réelle à La Poste n'est active sans contrat et identifiants. Ce webhook n'a pas été testé contre l'API réelle.

---

### `GET|POST /api/cron/tick`

Exécute les tâches planifiées. **Aucun ordonnanceur n'est fourni** : configurez un cron externe (Vercel Cron, GitHub Actions, cron système…).

```http
Authorization: Bearer $CRON_SECRET
```

Réponse `200` :

```json
{
  "ok": true,
  "at": "2026-10-28T09:00:00.000Z",
  "auctions": { "started": 1, "processed": 3, "closed": 2, "defaulted": 0 },
  "orders": { "candidates": 4, "finalized": 3 },
  "subscriptions": { "processed": 2, "expired": 2 }
}
```

- `401` si le secret est absent ou faux.
- `500` en cas d'échec partiel ; les erreurs unitaires sont journalisées et n'interrompent pas les autres tâches.
- Tâches : démarrage/clôture des enchères, déclaration des gagnants défaillants, finalisation des commandes livrées sans litige après le délai configuré, expiration des essais/abonnements.

Recommandation : toutes les minutes pour les enchères, ou au minimum toutes les 5 minutes.

---

### `GET /api/account/export`

Export RGPD du compte connecté.

- **Authentification** : session obligatoire (`401` sinon).
- **Limite** : 3 exports/heure/utilisateur (`429` avec `Retry-After`).
- **Réponse** : `application/json` en pièce jointe (`Content-Disposition: attachment`), `Cache-Control: no-store`.
- Contenu : profil, adresses, annonces, commandes, offres, favoris, messages, notifications, dons, trophées.
- Exclusions : mots de passe hachés, jetons de session, données de carte (jamais stockées).

---

## 3. Server Actions (mutations applicatives)

Les Server Actions sont appelées par les formulaires React et ne constituent pas une API publique stable. Elles vérifient systématiquement session, permission et validation Zod, puis recalculent les montants côté serveur.

| Domaine | Fichier | Exemples |
| --- | --- | --- |
| Authentification | `src/app/actions/auth.ts` | inscription, connexion, déconnexion, mot de passe oublié/réinitialisation, révocation de sessions |
| Compte | `src/app/actions/account.ts` | profil, mot de passe, adresses, préférences, suppression RGPD |
| Annonces | `src/app/actions/listings.ts` | création, modification, statut, favoris, signalement |
| Commandes | `src/app/actions/orders.ts` | création, paiement, annulation, préparation, réception, litige, avis |
| Enchères | `src/app/actions/auctions.ts` | offre, achat immédiat |
| Livraison | `src/app/actions/shipping.ts` | étiquette, avancement simulé |
| Prestige | `src/app/actions/premium.ts` | essai, activation, résiliation, reprise |
| Dons | `src/app/actions/donations.ts` | don (simulation uniquement) |
| Messagerie | `src/app/actions/messaging.ts` | conversation, message, lecture, signalement |
| Administration | `src/app/actions/admin.ts` | statut/rôle utilisateur, modération, litiges, remboursements, paramètres, catégories, reversements |

### Limites de débit (mémoire, instance unique)

| Action | Limite |
| --- | --- |
| Connexion | 10 tentatives / 15 min / couple e-mail+IP |
| Inscription | 5 / heure / IP |
| Contact | 5 / heure / IP |
| Téléversement | 30 / heure / utilisateur |
| Export RGPD | 3 / heure / utilisateur |

En production multi-instances, remplacez `src/lib/rate-limit.ts` par un stockage distribué (Redis/Upstash).

---

## 4. Intégrations et modes

| Intégration | Sans configuration | Avec configuration |
| --- | --- | --- |
| Paiements | Simulation explicite (`PAYMENTS_SIMULATION=true`) | Stripe Checkout + webhook signé (non testé sans clés) |
| Livraison | Simulation explicite, étiquettes marquées | Adaptateur La Poste (non testé sans contrat) |
| E-mail | Mode console (journalisé, non envoyé) | SMTP |
| Stockage | Disque local (développement) | S3/R2 compatible (interface non testée) |

Toute route qui exige une intégration absente répond `NOT_CONFIGURED` ou `503` : elle ne simule jamais silencieusement un succès.
