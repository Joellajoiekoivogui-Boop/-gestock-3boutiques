# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Caissiers** du restaurant MassaGui Fils, debout au comptoir, peu à l'aise avec l'informatique et sans formation. Ils doivent encaisser vite, au doigt, en lisant le moins possible.
- **Gérant sur place** : suit les ventes de la journée, les stocks, et contrôle la caisse en fin de journée.
- **Patron à distance** : consulte les chiffres et les rapports depuis son téléphone, hors du restaurant.
- **Serveurs en salle** : prennent les commandes aux tables (voir les décisions ouvertes : l'application ne gère pas encore les tables ni l'envoi de commandes à la caisse).

## Product Purpose

Caisse et gestion de **MassaGui Fils SARL.U**, hôtel-restaurant en Guinée (plats africains et européens, boissons, desserts, petit-déjeuner). Elle encaisse les ventes, imprime un reçu après chaque vente, suit les stocks et produit les chiffres du jour, de la semaine et du mois.

Réussir, c'est : une vente encaissée en quelques touches sans erreur, un reçu correct à chaque fois, et des chiffres auxquels le patron peut se fier à distance.

## Positioning

Une caisse faite pour un restaurant guinéen : montants en francs guinéens sans décimale, paiements Orange Money et MTN Mobile Money à côté des espèces, reçus pour imprimantes thermiques 80 mm et 58 mm, et des chiffres de vente impossibles à truquer (une vente validée ne se modifie pas, elle s'annule ou se rembourse avec motif et trace).

## Operating Context

- Appareil principal : **tablette au comptoir**, utilisée au doigt toute la journée. Le gérant et le patron utilisent aussi un téléphone ; un ordinateur reste possible.
- Imprimante thermique de tickets reliée au navigateur (80 mm, 58 mm ou A4).
- Connexion internet parfois instable.
- Fuseau horaire Africa/Conakry ; les journées de vente se comptent en heure locale.
- Paiements mobiles déclarés par le caissier : aucune API d'opérateur n'est connectée.

## Capabilities and Constraints

- Rôles : **Administrateur** (tout) et **Gérant / Caissier** (la caisse et ses propres ventes, plus des permissions accordées une à une : remise, voir toutes les ventes, annuler, rembourser, voir les rapports). Les produits, leurs photos et les stocks (approvisionnements, ajustements) sont réservés à l'administrateur.
- Espaces : connexion, caisse, reçus, mes ventes, tableau de bord, produits, catégories, stocks, historique des ventes, rapports (CSV et PDF), utilisateurs, journal d'activité, paramètres.
- Pile : Next.js 16 (App Router), TypeScript, Tailwind CSS 4, composants shadcn/ui (Radix), Supabase (PostgreSQL, Auth, Storage, RLS). Hébergement Vercel.
- Les droits sont vérifiés côté page, côté action serveur et en base ; masquer un bouton n'est jamais la seule protection.
- Une démonstration statique (`public/demo.html`) remplace l'application tant que la base n'est pas branchée.
- **Décision ouverte** : prise de commande par les serveurs aux tables (tables, envoi en cuisine ou à la caisse). Non construite.
- Ventes à crédit : mode de paiement « Crédit » avec nom (obligatoire) et téléphone du client ; la vente reste « à payer » jusqu'à son encaissement. Chaque client à crédit a un **dossier** (page « Crédits ») : ce qu'il doit, ce qu'il a réglé et l'historique de ses crédits ; un même numéro de téléphone retrouve le même dossier. Les chiffres du jour affichent « Encaissé aujourd'hui » = ventes du jour − crédits non payés du jour + anciens crédits réglés dans la journée, chaque ligne étant visible. MTN Mobile Money et Virement bancaire sont désactivés (ils restent dans l'historique).
- Deux boutiques de vente, **Nabele Plus 1** et **Nabele Plus 2** : chacune a ses produits, ses prix et son stock ; chaque vente appartient à une boutique. Un caissier est rattaché à une seule boutique et ne voit qu'elle ; l'administrateur choisit en haut de l'écran la boutique affichée (ou les deux cumulées) et doit choisir une boutique pour encaisser. Les dossiers clients à crédit sont communs aux deux boutiques.
- **Journée de vente de 7h à 7h** : une vente faite le 17 à 2h du matin compte pour la journée du 16 (caisse, tableau de bord, rapports, historique). Heure fixée dans `DAY_START_HOUR` (src/lib/dates.ts) et `public.day_start()` en base.
- **Dépenses de caisse** : le caissier note ce qu'il achète avec l'argent de la caisse (condiments…) et son prix, dans « Mes ventes », pour la journée en cours ; le montant est retiré de l'argent encaissé du jour. Seul l'administrateur peut supprimer une dépense (tracé au journal) ; il peut aussi en noter une pour un jour passé depuis le tableau de bord.
- **Impression des ventes d'une journée** (administrateur) : depuis le tableau de bord ou l'historique, feuille A4 de la journée choisie (résumé, encaissé, modes de paiement, dépenses, produits vendus, liste des ventes, signatures), à imprimer ou enregistrer en PDF.
- **Rapports** : boutiques côte à côte, meilleurs jours, moyenne par jour de la semaine, export Excel (.xlsx, un onglet par tableau), CSV et PDF. **Prix d'achat** facultatif par produit (administrateur seulement, jamais visible des caissiers) : le coût est figé au moment de chaque vente et le rapport de l'administrateur donne la marge.
- **Bilan du mois** (tableau de bord de l'administrateur, mois au choix, par boutique ou les deux) : ventes du mois − dépenses et achats − dettes (ventes à crédit du mois pas encore payées) = bénéfice du mois. Achats et dépenses forment un seul total, noté par les caissières dans « Dépenses et achats du jour ».
- **Décision ouverte** : clôture de caisse de fin de journée (fond de caisse, écart). Non construite.

## Brand Commitments

- Nom : **MassaGui Fils SARL.U**, sous-titre « Hôtellerie — Restaurant ».
- Couleurs de la charte : vert **#0ABF65**, noir **#111111**, blanc, gris clair.
- Logo officiel à fournir par MassaGui Fils ; en attendant, monogramme provisoire « MG ».
- Interface entièrement en français.

## Evidence on Hand

- Aucune photo de plats, aucun logo officiel, aucune adresse ni téléphone fournis : ne pas les inventer.
- Les produits, prix et ventes de la démonstration sont des exemples.

## Product Principles

1. Encaisser d'abord : la vente se fait en un minimum de touches, sans lire de longs textes.
2. Lisible au premier coup d'œil, à distance de bras, au doigt, sous l'éclairage du comptoir.
3. Des chiffres dignes de confiance : rien ne se modifie en silence, tout se trace.
4. Chaque rôle voit seulement ce qui lui sert.

## Accessibility & Inclusion

- Utilisateurs peu habitués aux écrans : grandes cibles tactiles, libellés courts, pictogrammes accompagnant le texte, contrastes forts.
- Respecter le réglage « réduire les animations » de l'appareil.
