# MassaGui Fils SARL.U — Caisse, reçus et gestion du restaurant

Plateforme web de gestion pour **MassaGui Fils SARL.U** (hôtellerie, restauration, boissons, plats africains et européens) :
caisse tactile, reçu automatique après chaque vente, historique, stocks, rapports et tableau de bord administrateur.

> Ce dépôt hébergeait auparavant l'application « Dramera Chicha » (Vite). Elle reste disponible dans l'historique Git
> et sur la branche `main` tant que cette refonte n'y est pas fusionnée.

## Fonctionnalités

| Espace | Contenu |
| --- | --- |
| **Connexion** `/login` | Supabase Auth, afficher/masquer le mot de passe, messages clairs, redirection selon le rôle |
| **Caisse** `/pos` | Cartes produits avec photo, recherche instantanée (raccourci `/`), filtres par catégorie, panier, remise (si autorisée), modes de paiement, confirmation, reçu immédiat |
| **Reçus** `/receipts/[id]` | Ticket 80 mm, 58 mm ou A4, impression navigateur (imprimantes thermiques), PDF, réimpression |
| **Tableau de bord** `/admin/dashboard` | CA net du jour / semaine / mois, ventes, panier moyen, produits actifs, top produits, paiements, évolution, dernières transactions, stock faible |
| **Produits / Catégories** | Création, modification, photo, disponibilité, archivage (historique conservé), suppression seulement sans historique |
| **Ventes** `/admin/sales` | Recherche par n° de reçu, filtres (dates, caissier, paiement, statut), pagination, export CSV, détail, annulation et remboursement tracés |
| **Stocks** `/admin/inventory` | Stock et seuils, alertes, approvisionnements, ajustements avec motif, historique des mouvements |
| **Rapports** `/admin/reports` | Jour / semaine / mois / période, par catégorie, produit, caissier, paiement, annulations et remboursements — export CSV et PDF |
| **Utilisateurs** `/admin/users` | Comptes, rôles, permissions fines, désactivation, mot de passe |
| **Journal** `/admin/audit` | Trace inaltérable des opérations importantes |
| **Paramètres** `/admin/settings` | Établissement, logo, adresse, téléphone, devise, pied de reçu, format d'impression, préfixe des reçus, stocks, modes de paiement |

### Rôles et permissions

- **Administrateur** : tout.
- **Gérant / Caissier** : la caisse et **ses** ventes. L'administrateur peut lui accorder en plus :
  `apply_discount` (remise), `view_all_sales`, `cancel_sales`, `refund_sales`, `manage_stock`, `view_reports`.

Les droits sont vérifiés **trois fois** : page (redirection), action serveur, et base de données (RLS + fonctions SQL).
Masquer un bouton n'est jamais la seule protection.

## Technique

- Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`), TypeScript strict
- Tailwind CSS 4, composants shadcn/ui (Radix), Lucide, Sonner
- Supabase : PostgreSQL, Auth, Storage, RLS
- React Hook Form + Zod (validation partagée client/serveur), Recharts, jsPDF

```
src/
  app/
    login/                 connexion
    (app)/                 espace connecté (layout protégé + navigation selon le rôle)
      pos/                 caisse, mes ventes
      receipts/[id]/       reçu imprimable
      admin/               dashboard, products, categories, sales, inventory, reports, users, audit, settings
    actions/               actions serveur partagées (auth, ventes)
  components/              ui (shadcn), app (shell, cartes…), receipt, sales, charts
  lib/                     auth, permissions, validation (Zod), formatage GNF, dates, Supabase
  proxy.ts                 rafraîchissement de session + redirection vers /login
supabase/migrations/       schéma, fonctions, RLS, stockage, données de référence (versionnés)
scripts/                   create-admin.mjs, test-db.mjs
tests/                     unit/, db/ (PostgreSQL réel), e2e/ (navigateur)
```

## Règles métier importantes

- **Montants** : `numeric(14,0)` en base (exact, sans décimale — adapté au GNF), jamais de flottant.
- **Vente** (`create_sale`, une transaction PostgreSQL) : le navigateur n'envoie que des identifiants de produits et des
  quantités ; prix, totaux, remise, disponibilité et stock sont vérifiés et recalculés en base. Les produits sont verrouillés
  (`FOR UPDATE`) : deux ventes simultanées ne peuvent pas vendre le même stock, et le stock ne peut jamais devenir négatif.
- **Double clic / renvoi réseau** : chaque panier porte une clé d'idempotence ; la même clé renvoie la même vente.
- **Numéro de reçu** : `MG-AAAA-000001`, compteur annuel verrouillé dans la transaction de vente → unique, séquentiel,
  sans trou ni collision. Aucun reçu n'existe si l'enregistrement de la vente échoue.
- **Historique figé** : noms et prix des produits sont copiés dans la vente ; le contenu financier d'une vente ne peut être
  ni modifié ni supprimé (même par un administrateur) — seulement annulé ou remboursé, avec motif et trace.
- **Chiffre d'affaires** : ventes brutes (non annulées, datées dans la période) − remboursements effectués dans la période.
  Les ventes annulées sont exclues et affichées à part. Jours calculés dans le fuseau de l'établissement (Africa/Conakry).
- **Paiements mobiles** (Orange Money, MTN Mobile Money…) : enregistrés comme moyens d'encaissement déclarés par le
  caissier. **Aucune API opérateur n'est connectée** ; une intégration future devra utiliser le statut `pending` et ne
  passer à `paid` qu'après confirmation réelle du prestataire.

## Installation

Prérequis : Node.js 20.9+ (22 recommandé), un projet [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env.local   # puis renseignez les 3 variables
```

### 1. Préparer Supabase

1. Créez un projet Supabase (région la plus proche, ex. Europe).
2. **Appliquez les migrations, dans l'ordre** :
   - avec la CLI : `npx supabase link --project-ref <ref>` puis `npx supabase db push` ;
   - ou à la main : *SQL Editor → New query*, collez puis exécutez chaque fichier de `supabase/migrations/` dans l'ordre
     des noms (`…0100_schema`, `…0200_functions`, `…0300_security`, `…0400_storage`, `…0500_initial_data`).
3. **Désactivez les inscriptions publiques** : *Authentication → Sign In / Providers → Email* → décochez
   *Allow new users to sign up*. (Même si elles restaient ouvertes, un compte créé ainsi est inactif et n'accède à rien.)
4. Récupérez l'URL et les clés dans *Project Settings → API* et remplissez `.env.local`.

### 2. Créer le premier administrateur

Il n'existe **aucune page publique** de création d'administrateur. Deux méthodes, réservées au propriétaire du projet :

```bash
npm run create-admin -- --email gerant@exemple.com --name "Prénom Nom"
# le mot de passe est demandé de façon masquée (10 caractères min., lettres et chiffres)
```

Le script refuse de s'exécuter si un administrateur actif existe déjà.

*Alternative* : créez l'utilisateur dans *Authentication → Users → Add user* (cochez *Auto confirm*), puis dans le
*SQL Editor* :

```sql
update public.profiles
   set role = 'admin', is_active = true, full_name = 'Prénom Nom'
 where email = 'gerant@exemple.com';
```

Les comptes suivants (caissiers, autres admins) se créent depuis **Administration → Utilisateurs**.

### 3. Lancer en local

```bash
npm run dev        # http://localhost:3000
```

Puis, dans l'application : **Paramètres** → téléversez le **logo officiel** fourni par MassaGui Fils (PNG/WebP, 2 Mo max ;
tant qu'il n'est pas téléversé, un monogramme provisoire « MG » s'affiche), renseignez l'adresse, le téléphone et l'e-mail
(aucune coordonnée n'est inventée), puis créez les produits.

### 4. Déployer (Vercel)

1. Importez le dépôt dans Vercel (framework détecté : Next.js).
2. Ajoutez les 3 variables d'environnement (Production et Preview). `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais**
   être préfixée par `NEXT_PUBLIC_`.
3. Déployez. Chaque `git push` redéploie automatiquement.

## Impression des reçus (imprimantes thermiques)

- Le reçu s'ouvre après chaque vente ; bouton **Imprimer** ou lien **Imprimer** de la fenêtre de confirmation
  (impression lancée automatiquement).
- Le format (80 mm, 58 mm, A4) se choisit sur le reçu ; le format par défaut se règle dans Paramètres.
- Pour un ticket, l'application calcule une page de la hauteur exacte du reçu. Dans la boîte d'impression : choisissez
  l'imprimante thermique, **Marges : aucune**, **Échelle : 100 %**, et désactivez *En-têtes et pieds de page*.
- Poste de caisse dédié : lancez Chrome avec `--kiosk-printing` pour imprimer sans boîte de dialogue.

## Tests

```bash
npm run lint         # ESLint (Next.js)
npm run typecheck    # TypeScript strict (application + tests)
npm test             # tests unitaires : panier, montants GNF, dates, CSV, validation, droits
npm run test:db      # tests PostgreSQL réels : ventes, stocks, ventes simultanées, doubles clics,
                     # RLS, annulations, remboursements, rapports (PostgreSQL 15+ local requis)
npm run test:e2e     # scénario complet dans Chromium (connexion, produits, comptes, vente, reçu, annulation…)
```

`test:db` et `test:e2e` utilisent un PostgreSQL local (`DATABASE_ADMIN_URL`, par défaut
`postgres://postgres:postgres@localhost:5432/postgres`). `test:e2e` démarre un **émulateur Supabase minimal**
(`tests/e2e/fake-supabase.mjs`, réservé aux tests) au-dessus de cette base : RLS, privilèges et fonctions SQL sont les
vrais. Il nécessite Playwright et Chromium.

## Sauvegarde et restauration

- **Supabase** effectue des sauvegardes quotidiennes automatiques (plan Pro et supérieur) ; la restauration à un instant
  précis (PITR) est une option payante. Voir *Database → Backups*.
- **Sauvegarde manuelle** (recommandée chaque semaine et avant toute migration), avec la CLI Supabase liée au projet :

  ```bash
  npx supabase db dump --data-only -f sauvegarde-$(date +%F).sql
  ```

  Cette sauvegarde contient aussi les comptes (`auth.users`). Les images sont dans Supabase Storage
  (buckets `product-images` et `branding`) : téléchargez-les depuis *Storage* si besoin.
- **Restauration** dans un projet vierge où les migrations ont été appliquées : *SQL Editor* ou `psql` sur la chaîne de
  connexion (*Project Settings → Database*) :

  ```bash
  psql "<chaîne de connexion>" -c "set session_replication_role = replica" -f sauvegarde-AAAA-MM-JJ.sql
  ```

  `session_replication_role = replica` suspend les déclencheurs pendant l'import, sinon les protections d'historique
  (ventes figées, journal en ajout seul) bloqueraient la réinsertion. Testez la restauration sur un projet de test.
- Les exports CSV (ventes, rapports) complètent mais ne remplacent pas ces sauvegardes.

## Ce qui reste à configurer par le client

- Projet Supabase, migrations et variables d'environnement (étapes ci-dessus).
- Premier administrateur.
- Logo officiel, adresse, téléphone, e-mail, texte de pied de reçu (Paramètres).
- Catalogue de produits et prix.
- Une éventuelle intégration de paiement mobile réelle (non incluse).
