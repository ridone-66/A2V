# Matrice des fonctionnalités — ce qui marche, ce qui est simulé, ce qui manque

Dernière vérification : **28 octobre 2026**.

Légende :

- **Fonctionnel** : implémenté et vérifié dans cet environnement (build, tests, parcours navigateur).
- **Fonctionnel, non testé en réel** : le code existe et le build passe, mais l'intégration externe n'a pas pu être exécutée faute de contrat, de clés ou de credentials.
- **Simulé** : un comportement fictif est enregistré, toujours signalé dans l'interface ; aucun argent ni colis réel.
- **Non implémenté** : absent, sans prétendre le contraire.

---

## 1. Vérifications automatisées réellement exécutées

| Vérification | Commande | Résultat |
| --- | --- | --- |
| Typage strict | `npx tsc --noEmit` | Aucune erreur |
| Build production | `npm run build` | Succès, 57 routes |
| Tests unitaires | `npm test` | 8 fichiers, **60 tests réussis** |
| Tests bout en bout | `npx playwright test` | **26 tests réussis** (desktop + mobile) |
| Captures responsive | `node scripts/screenshots.mjs` | Desktop 1440 px et mobile Pixel 7 |

Les tests e2e couvrent : accueil, catalogue, fiche annonce, photos d'illustration et mention associée, pages légales, absence de débordement horizontal sur mobile, décor animé de la page Trophées, mentions légales et crédits photos, connexion membre, tableau de bord, notifications, seuil automatique Prestige à 10 000 €, enchère à plus de 10 000 € réservée aux membres, accès aux offres Prestige réservé aux membres (visiteur, membre non-Prestige, membre Prestige), refus d'accès admin à un membre, accès admin à l'audit, aux paramètres, aux catégories et aux statistiques.

---

## 2. Synthèse

| Domaine | État global |
| --- | --- |
| Comptes et sessions | **Fonctionnel** (vérification e-mail non implémentée) |
| Annonces et catalogue | **Fonctionnel** (stockage local en dev, Vercel Blob en prod) |
| Prix fixe et commandes | **Fonctionnel** avec paiement **simulé** ; Stripe codé mais non testé |
| Enchères | **Fonctionnel** (concurrence, anti-sniping, réserve, clôture cron) |
| Prestige | **Fonctionnel** en **simulation** ; Stripe Billing non branché |
| Trophées et réductions | **Fonctionnel** (après vente finalisée) |
| Livraison | **Simulée** ; La Poste codée mais non testée |
| Dons | **Simulés** uniquement ; comptabilité séparée fonctionnelle |
| Messagerie et modération | **Fonctionnel** |
| Notifications | In-app **fonctionnel** ; e-mail non testé |
| Administration et audit | **Fonctionnel** |
| RGPD (export/suppression) | **Fonctionnel** ; purge automatique absente |
| Déploiement / sauvegardes | Documenté ; **non automatisé** |

---

## 3. Détail par domaine

### 3.1 Comptes, authentification, sécurité

| Fonction | État | Précisions |
| --- | --- | --- |
| Inscription, connexion, déconnexion | **Fonctionnel** | Vérifié par Playwright |
| Hachage scrypt, sessions hachées en base | **Fonctionnel** | Jeton opaque, cookie `HttpOnly` |
| Révocation des sessions | **Fonctionnel** | Bouton « déconnecter toutes mes sessions » |
| Mot de passe oublié / réinitialisation | **Fonctionnel** | L'envoi réel dépend de SMTP ; en mode console, le lien est journalisé, pas envoyé |
| Changement de mot de passe | **Fonctionnel** | Révoque les autres sessions |
| Suspension de compte | **Fonctionnel** | Révoque les sessions ; refus à la connexion |
| Rôles ADMIN / MODERATOR / USER | **Fonctionnel** | Permissions vérifiées côté serveur |
| Vérification d'adresse e-mail | **Non implémenté** | Aucun modèle de jeton ; l'action explique la limite |
| Changement d'adresse e-mail | **Non implémenté** | Nécessite un lien signé |
| 2FA | **Non implémenté** | — |
| Limitation de débit | **Fonctionnel (instance unique)** | En mémoire ; à remplacer en multi-instances |

### 3.2 Annonces et catalogue

| Fonction | État | Précisions |
| --- | --- | --- |
| Création / modification / statut d'annonce | **Fonctionnel** | Validation Zod, propriété vérifiée |
| Prix fixe et enchère sur une même base | **Fonctionnel** | Types `FIXED` / `AUCTION` |
| Images | **Fonctionnel en local et Vercel Blob** | JPEG/PNG/WebP/AVIF, 4 Mo, type vérifié ; `vercel-blob` persistants |
| Photos des annonces de démonstration | **Photos d'illustration** | Wikimedia Commons, licences libres, attribution dans `docs/PHOTOS.md` ; mention affichée sur la fiche |
| Recherche, filtres, tri, pagination | **Fonctionnel** | Recherche textuelle simple (pas de moteur externe) |
| Favoris | **Fonctionnel** | — |
| Signalement d'annonce | **Fonctionnel** | Traité en administration |
| Offres réservées Prestige | **Fonctionnel** | Contrôle serveur, pas seulement masquage |
| Brouillons | **Fonctionnel** | Visibles du seul vendeur |
| Panier multi-articles | **Non implémenté** | Achat direct uniquement |
| Variation/stock multiple | **Non implémenté** | Une annonce = un article |

### 3.3 Commandes, commission, paiements

| Fonction | État | Précisions |
| --- | --- | --- |
| Commande à prix fixe | **Fonctionnel** | Adresse, service de livraison, note |
| Calcul serveur des montants | **Fonctionnel** | Testé : commission, arrondis, plafonds |
| Commission 0,5 % hors livraison | **Fonctionnel** | Taux configurable en admin ; retenue sur le versement vendeur, aucun frais ajouté à l'acheteur |
| Paiement simulé | **Simulé** | Paiement `SIMULATED`, mention explicite |
| Checkout Stripe (commande) | **Fonctionnel, non testé en réel** | Code présent, aucune clé fournie |
| Webhook Stripe signé + idempotent | **Fonctionnel, non testé en réel** | Signature et `WebhookEvent` |
| Remboursement simulé | **Fonctionnel** | Écriture comptable, aucun mouvement bancaire |
| Remboursement Stripe réel | **Fonctionnel, non testé en réel** | Appel API non exécuté |
| Onboarding Stripe Connect vendeur | **Non implémenté** | Aucun parcours de création de compte Connect |
| Versement bancaire automatique | **Non implémenté** | Le « versement vendeur » est une écriture, pas un virement |
| Litiges | **Fonctionnel** | Bloquent la finalisation, résolution admin auditée |
| Avis après commande | **Fonctionnel** | Un avis par commande |
| Facturation / avoirs PDF | **Non implémenté** | Aucune facture fiscale générée |

### 3.4 Enchères

| Fonction | État | Précisions |
| --- | --- | --- |
| Enchères programmées / en direct / terminées | **Fonctionnel** | Statuts pilotés par le serveur |
| Offres transactionnelles sérialisables | **Fonctionnel** | `Serializable` + nouvelles tentatives |
| Rejet des offres tardives | **Fonctionnel** | Heure serveur |
| Incrément minimum | **Fonctionnel** | Testé |
| Prix de réserve | **Fonctionnel** | Vente annulée si réserve non atteinte |
| Achat immédiat | **Fonctionnel** | Fin d'enchère et création du gagnant |
| Anti-sniping | **Fonctionnel** | 120 s / 120 s, 10 prolongations max |
| Clôture automatique | **Fonctionnel** | Via `/api/cron/tick` ; aucun ordonnanceur fourni |
| Délai de paiement 48 h + défaillance | **Fonctionnel** | Le gagnant défaillant n'est pas débité |
| Notifications de début / fin imminente | **Non implémenté** | Seules les notifications d'offre, de victoire et de paiement existent |
| Enchères privées / invitations | **Non implémenté** | — |

### 3.5 Prestige

| Fonction | État | Précisions |
| --- | --- | --- |
| Essai 3 mois | **Fonctionnel** | Aucun prélèvement, expiration sans reconduction |
| Activation payante | **Simulée** | Paiement fictif marqué `SIMULATED` |
| Résiliation / reprise | **Fonctionnel** | Fin de période ou immédiate |
| Expiration automatique | **Fonctionnel** | Via cron |
| Avantages réservés | **Fonctionnel** | Vérifiés côté serveur |
| Seuil automatique 10 000 € | **Fonctionnel** | Au-delà de 10 000 € (prix fixe ou départ d'enchère), l'annonce devient Prestige même si le vendeur décoche ; contrôle serveur |
| Avantage Prestige 15 % | **Fonctionnel** | Réduction de 15 % au-dessus de 10 000 €, serveur, non cumulable |
| Page Offres Prestige | **Fonctionnel** | `/premium/offres`, `noindex`, données chargées après vérification serveur |
| Accès non-membre | **Fonctionnel** | Page d'explication sans aucune donnée d'annonce ; vérification aussi à l'achat et à l'enchère |
| Checkout Stripe Billing | **Non branché** | `createSubscriptionCheckoutSession` existe mais aucune action ne l'appelle |
| Renouvellement réel | **Non implémenté** | Période approximée à 30 jours dans le webhook |
| Facture d'abonnement | **Non implémenté** | — |

### 3.6 Trophées et réductions

| Fonction | État | Précisions |
| --- | --- | --- |
| Attribution après vente finalisée | **Fonctionnel** | Jamais après une simple offre |
| Progression et niveaux | **Fonctionnel** | Bronze/Argent visibles dans le jeu de démo |
| Coupons et réductions plafonnées | **Fonctionnel** | Testé : jamais plus que le sous-total |
| Crédit d'argent automatique | **Non implémenté (volontairement)** | Aucun trophée ne crédite un solde |
| Décor animé de la page Trophées | **Fonctionnel** | Deux trophées CSS sur les côtés (`xl`), `aria-hidden`, réduits si `prefers-reduced-motion` |
| Échange de trophées | **Non implémenté** | — |

### 3.7 Livraison

| Fonction | État | Précisions |
| --- | --- | --- |
| Devis de livraison avant paiement | **Fonctionnel** | Frais à la charge de l'acheteur |
| Étiquette HTML | **Fonctionnel** | Accès contrôlé, mention simulation |
| Suivi manuel simulé | **Simulé** | Numéros fictifs explicitement signalés |
| Machine à états de suivi | **Fonctionnel** | Testée (pas de retour arrière) |
| Webhook transporteur | **Fonctionnel, non testé en réel** | Refusé en mode simulation |
| Étiquettes La Poste réelles | **Non testé** | Aucun contrat/identifiant |
| Calcul de poids/zone avancé | **Partiel** | Tarifs simplifiés par service et poids |
| Preuve de livraison | **Non implémenté** | — |

### 3.8 Dons et solidarité

| Fonction | État | Précisions |
| --- | --- | --- |
| Don en ligne | **Simulé** | Refusé si `PAYMENTS_SIMULATION=false` et Stripe absent |
| Reçu de transaction | **Fonctionnel** | Numéro unique ; **pas** un reçu fiscal |
| Statistiques séparées | **Fonctionnel** | Collecté / contributions / reversé |
| Reversements enregistrés | **Fonctionnel** | Référence et date obligatoires |
| Virement réel vers une association | **Non implémenté** | Enregistrement comptable seulement |
| Associations réelles | **Non implémenté** | Entités de démonstration fictives |
| Pourcentage de contribution A2V | **Non décidé** | Paramètre à 0 ; aucun chiffre inventé |
| Reçu fiscal / déduction | **Non implémenté** | Aucune promesse affichée |

### 3.9 Messagerie, notifications, administration

| Fonction | État | Précisions |
| --- | --- | --- |
| Conversations liées à une annonce/commande | **Fonctionnel** | — |
| Blocage d'utilisateur | **Fonctionnel** | — |
| Signalement de message | **Fonctionnel** | Modération sans suppression automatique |
| Notifications in-app | **Fonctionnel** | Préférences par type |
| E-mails transactionnels | **Fonctionnel, non testé** | Mode console sans SMTP |
| Tableau de bord admin | **Fonctionnel** | — |
| Gestion utilisateurs / annonces / commandes | **Fonctionnel** | Actions auditées |
| Litiges, signalements, messages signalés | **Fonctionnel** | — |
| Paramètres métier | **Fonctionnel** | Taux, délais, prix, textes |
| Journal d'audit | **Fonctionnel** | En ajout seul via l'interface |
| Statistiques | **Fonctionnel** | Volumes, statuts, vendeurs, catégories |
| Export CSV | **Non implémenté** | — |

### 3.10 RGPD et exploitation

| Fonction | État | Précisions |
| --- | --- | --- |
| Export JSON des données | **Fonctionnel** | Route protégée, limitée en débit |
| Suppression/anonymisation du compte | **Fonctionnel** | Confirmation forte, blocages en cas d'activité |
| Purge automatique / rétention | **Non implémenté** | À définir et automatiser |
| Gestion des consentements cookies | **Non implémenté** | Page d'information seulement, pas de bannière |
| Mentions légales | **Modèle complet** | Éditeur, hébergeur, propriété intellectuelle, médiation, résiliation, signalement ; champs à compléter avant production |
| Crédits photos | **Fonctionnel** | Page `/credits-photos` générée depuis les licences Wikimedia Commons |
| Sauvegardes | **Documentées** | Aucun script fourni |
| Supervision / alertes | **Non implémenté** | Sonde `/api/health` seulement |
| CI/CD | **Non fourni** | Aucun dépôt Git ni pipeline dans cet environnement |
| Migrations versionnées | **Fournies** | Migration initiale `20261028130000_init`, validée sur une base vierge ; `vercel-build` applique `migrate deploy` |

---

## 4. Comment les simulations sont signalées

| Simulation | Signalement |
| --- | --- |
| Paiements | Bandeau global « paiements simulés », badges `SIMULATED` en admin, avertissements sur les pages paiement/abonnement/don |
| Livraison | Badge « Simulation », numéro de suivi suffixé « (fictif) », étiquette portant une mention explicite |
| E-mail | Les pages indiquent qu'aucun e-mail n'est envoyé sans SMTP ; contenu journalisé |
| Dons | Textes « don enregistré en simulation », aucun encaissement réel revendiqué |
| Prestige | Avertissement sur l'activation simulée, aucune reconduction silencieuse |

Aucune interface ne présente un paiement simulé comme un encaissement bancaire, ni un montant non transféré comme versé.

---

## 5. Non implémenté — liste honnête

1. Vérification et changement d'adresse e-mail.
2. 2FA.
3. Panier multi-articles et gestion de stock.
4. Onboarding Stripe Connect vendeur et versements automatiques.
5. Checkout Stripe Billing pour Prestige et renouvellement réel.
6. Étiquettes La Poste réelles et preuve de livraison.
7. Paiement réel des dons et virements aux associations.
8. Reçus fiscaux et factures PDF.
9. Notifications de début/fin imminente d'enchère.
10. Purge/rétention automatique des données et bannière de consentement.
11. CI/CD, migrations versionnées, scripts de sauvegarde.
12. Recherche avancée (moteur dédié), recommandations, cohortes marketing.
13. Application mobile native.
14. Internationalisation (l'interface est en français uniquement).

---

## 6. Limites techniques assumées

- **Rate limiting en mémoire** : correct en mono-instance, insuffisant en production distribuée.
- **Stockage local** : pratique en développement, inadapté aux plateformes serverless.
- **Aucun ordonnanceur** : le cron doit être configuré à l'extérieur.
- **Période d'abonnement approximée** à 30 jours dans le webhook Stripe.
- **Aucune clé Stripe/La Poste/SMTP/S3** fournie : les intégrations correspondantes n'ont pas été exécutées. Le stockage Vercel Blob est implémenté mais n'a pas été testé avec un store réel.
- **Entités et contacts fictifs** : support, associations, siège, SIRET.
- **Pas de dépôt Git** : aucun historique de commits ni pipeline.
- **Pas de tests de charge** : la tenue sous forte concurrence d'enchères n'a pas été mesurée au-delà des garanties transactionnelles.

---

## 7. Formulations à éviter

Pour rester exact, ne dites pas :

- « Paiements sécurisés par Stripe » → dites « adaptateur Stripe prêt, non testé sans clés ; simulation en démonstration ».
- « Livraison La Poste intégrée » → dites « passerelle préparée, mode simulation explicite ».
- « Reversements aux associations » → dites « reversements enregistrés manuellement ; aucun virement réel ».
- « Vérification e-mail » → elle n'existe pas.
- « Abonnement Stripe opérationnel » → le checkout Billing n'est pas branché.
- « Prêt pour la production » → la checklist de [DEPLOIEMENT.md](DEPLOIEMENT.md) doit d'abord être complétée.
