# Dramera Chicha

Application de gestion multi-boutiques (stocks, ventes, dettes, dépenses) pour 3 boutiques à Conakry : **Kissosso**, **Tombolia**, **Sangoyah**.

100 % front-end (React 19 + Vite), données persistées dans le `localStorage` du navigateur — aucun serveur.

## Démarrage

```bash
npm install
npm run dev        # front seul (Vite) — http://localhost:5173 ; l'auth NE fonctionne PAS
npm run dev:full   # front + fonctions serveur (vercel dev) — auth fonctionnelle
npm run build      # build de production dans dist/
npm run lint       # oxlint
```

## Authentification

Les comptes vivent **côté serveur** (fonctions Vercel `api/login.js` + `api/session.js`) :
- mots de passe hachés (scrypt), stockés dans la variable d'env `AUTH_USERS` — jamais dans le code ni le bundle ;
- session = jeton signé HMAC-SHA256 (`AUTH_SECRET`), expiration 12 h, revérifié au serveur à chaque chargement.

Les e-mails et mots de passe sont fournis séparément (hors dépôt). Pour changer un mot de passe : régénérer `AUTH_USERS` et le mettre à jour dans Vercel.

Voir `.env.example`.

## Rôles

- **Admin** : accès complet, vue consolidée des 3 boutiques, Tableau de Bord, Paramètres, création d'articles / prix / réapprovisionnement.
- **Gérant** : accès limité à **sa** boutique. Il saisit le comptage quotidien (stock Initial / Reste) sur la Feuille de Vente et encaisse à la Caisse. Pas d'accès au Tableau de Bord ni aux Paramètres.

## Déploiement

Hébergé sur Vercel, redéploiement automatique à chaque `git push` sur `main`.
