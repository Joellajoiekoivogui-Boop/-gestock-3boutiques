# Gestock 3B

Application de gestion multi-boutiques (stocks, ventes, dettes, dépenses) pour 3 boutiques à Conakry : **Kissosso**, **Tombolia**, **Sangoyah**.

100 % front-end (React 19 + Vite), données persistées dans le `localStorage` du navigateur — aucun serveur.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
npm run lint     # oxlint
```

## Comptes de connexion (démo)

| Rôle | E-mail | Mot de passe |
|------|--------|--------------|
| Administrateur | `admin@gestock.gn` | `admin2026` |
| Gérant Kissosso | `kissosso@gestock.gn` | `kissosso2026` |
| Gérant Tombolia | `tombolia@gestock.gn` | `tombolia2026` |
| Gérant Sangoyah | `sangoyah@gestock.gn` | `sangoyah2026` |

> Les mots de passe sont en clair dans `src/utils/initialData.js` (app sans back-end). À usage interne uniquement.

## Rôles

- **Admin** : accès complet, vue consolidée des 3 boutiques, Tableau de Bord, Paramètres, création d'articles / prix / réapprovisionnement.
- **Gérant** : accès limité à **sa** boutique. Il saisit le comptage quotidien (stock Initial / Reste) sur la Feuille de Vente et encaisse à la Caisse. Pas d'accès au Tableau de Bord ni aux Paramètres.

## Déploiement

Hébergé sur Vercel, redéploiement automatique à chaque `git push` sur `main`.
