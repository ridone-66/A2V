# Sauvegarde et restauration

Objectif : ne jamais perdre une commande, un paiement, une enchère ou un journal d'audit. Ce document couvre PostgreSQL (source de vérité), les fichiers téléversés, les secrets et la procédure de reprise.

---

## 1. Ce qu'il faut sauvegarder

| Donnée | Emplacement | Criticité | Méthode |
| --- | --- | --- | --- |
| Base PostgreSQL | Managée ou VPS | **Critique** | Dump logique quotidien + PITR si disponible |
| Images téléversées | S3/R2/Supabase (production) | Élevée | Versioning + réplication du bucket |
| Secrets | Coffre de secrets | **Critique** | Export chiffré, accès restreint |
| Configuration | Dépôt + variables | Élevée | Infrastructure as code / documentation |
| Journaux | Collecteur | Moyenne | Rétention selon politique légale |

> En développement local, les données vivent dans `.pgdata/cluster` (PostgreSQL embarqué) et `var/uploads`. Ce sont des artefacts de démonstration : ne les utilisez jamais comme sauvegarde de production.

---

## 2. Sauvegarde PostgreSQL

### Dump logique quotidien

**Linux/macOS**

```bash
export DATABASE_URL="postgresql://user:password@host:5432/a2v?sslmode=require"
mkdir -p backups
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backups/a2v-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

**Windows PowerShell**

```powershell
$env:DATABASE_URL = "postgresql://user:password@host:5432/a2v?sslmode=require"
New-Item -ItemType Directory -Force backups | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
pg_dump $env:DATABASE_URL --format=custom --no-owner --no-privileges --file="backups/a2v-$stamp.dump"
```

`pg_dump` doit être de la **même version majeure** que le serveur (16.x).

### Rétention recommandée

- 7 dumps quotidiens.
- 4 dumps hebdomadaires.
- 12 dumps mensuels.
- Chiffrement au repos (age, GPG ou chiffrement du bucket) et stockage hors site.
- Vérification automatique : un dump non restauré n'est pas une sauvegarde.

### PITR (managed)

Si le fournisseur le permet (Neon, Supabase, RDS) : activez les **sauvegardes continues / point-in-time recovery** avec une fenêtre d'au moins 7 jours. C'est la seule protection contre une suppression accidentelle survenue entre deux dumps.

---

## 3. Restauration

### Vers une base vide (procédure testée recommandée)

```bash
# 1. Créer une base cible vide (jamais la production directement)
createdb -h host -U user a2v_restore

# 2. Restaurer
pg_restore \
  --dbname="postgresql://user:password@host:5432/a2v_restore?sslmode=require" \
  --no-owner --no-privileges --clean --if-exists \
  backups/a2v-20261028T020000Z.dump

# 3. Appliquer les migrations manquantes (si le dump est antérieur)
DATABASE_URL="postgresql://.../a2v_restore" npx prisma migrate deploy

# 4. Vérifier
psql "postgresql://.../a2v_restore" -c "select count(*) from \"Order\";"
psql "postgresql://.../a2v_restore" -c "select count(*) from \"Payment\";"
```

Puis :

1. Vérifier les compteurs clés (utilisateurs, annonces, commandes, paiements, enchères, audit).
2. Lancer l'application sur la base restaurée dans un environnement isolé.
3. Tester connexion, catalogue, une commande, l'administration.
4. Basculer `DATABASE_URL` seulement après validation.

### Restauration à un instant précis (PITR)

Utilisez la console du fournisseur pour créer une **nouvelle instance** au timestamp souhaité, puis procédez comme ci-dessus. Ne restaurez pas en écrasant la production sans décision explicite.

---

## 4. Fichiers téléversés

- Activez le **versioning** du bucket et, si possible, la réplication inter-régions.
- Sauvegarde périodique :

```bash
aws s3 sync s3://a2v-uploads s3://a2v-uploads-backup --delete
```

- Un fichier référencé en base mais absent du bucket provoque une image cassée : vérifiez la cohérence après restauration.
- Les images de démonstration `public/demo/` sont versionnées avec le code.

---

## 5. Secrets et configuration

- Sauvegardez les variables d'environnement dans un coffre (1Password, Vault, AWS Secrets Manager…) avec accès à deux personnes minimum.
- Documentez la rotation : `SESSION_SECRET` (invalide toutes les sessions), `CRON_SECRET`, clés Stripe, SMTP, S3.
- Ne stockez **jamais** de `.env` de production dans le dépôt ni dans un dump non chiffré.

---

## 6. Objectifs de reprise (à adapter)

| Indicateur | Cible suggérée |
| --- | --- |
| RPO (perte de données max) | 15 min avec PITR, 24 h avec dump seul |
| RTO (temps de reprise) | 2 à 4 h |
| Fréquence de test de restauration | Trimestrielle minimum |

---

## 7. Procédure d'incident

1. **Constater** : `/api/health`, journaux applicatifs, métriques base.
2. **Isoler** : passer l'application en maintenance ou couper les écritures si la base est corrompue.
3. **Sauvegarder l'état actuel** avant toute manipulation (dump de la base cassée).
4. **Restaurer** vers une nouvelle instance, jamais directement sur la production.
5. **Valider** les données financières (commandes, paiements, commissions, dons) avant bascule.
6. **Basculer** le trafic, surveiller, puis consigner l'incident.
7. **Post-mortem** : cause, impact, actions correctives.

Points d'attention métier :

- Une enchère clôturée pendant l'incident peut avoir un gagnant sans commande : vérifiez `AuctionWinner` et relancez le cron.
- Un webhook Stripe rejoué est idempotent (`WebhookEvent`), mais vérifiez les statuts `FAILED`.
- Les versements vendeur ne sont jamais déclenchés automatiquement par la restauration.

---

## 8. Ce qui n'est pas automatisé

- Aucun script de sauvegarde n'est fourni dans le dépôt : intégrez les commandes ci-dessus à votre ordonnanceur.
- Aucune purge ni archivage automatique des données (RGPD) n'est implémenté.
- Aucune surveillance intégrée : branchez un collecteur et des alertes.
