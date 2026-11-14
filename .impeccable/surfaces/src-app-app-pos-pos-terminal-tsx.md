---
version: 1
slug: "src-app-app-pos-pos-terminal-tsx"
primary_target: "src/app/(app)/pos/pos-terminal.tsx"
related_targets: ["src/components/app/app-shell.tsx","src/app/globals.css"]
---

# Surface : application MassaGui (caisse, ventes, tableau de bord, gestion)

Mode : Operate. Utilisateurs : caissiers peu à l'aise au comptoir sur tablette, gérant sur place, patron à distance sur téléphone. Tâche principale : encaisser une vente en un minimum de touches ; ensuite suivre ventes et chiffres. Contraintes : charte vert #0ABF65 / noir #111111, français, GNF sans décimale, imprimante thermique, droits par rôle inchangés. Plaintes de l'utilisateur : illisible et trop petit, aspect fade et générique, navigation confuse, trop d'étapes pour vendre.

## Direction contract

THESIS: La caisse se lit comme un pagne : une lisière imprimée en tête porte l'état du service, et chaque catégorie a sa colorie franche qui la fait trouver d'un coup d'œil. Refuse la barre latérale noire générique, les cartes grises toutes pareilles et la confirmation en fenêtre.

OWN-WORLD: Fond gris très clair teinté vert, panneaux blancs, encre noire #111. Vert MassaGui pour l'action principale et la sélection. Coloris de catégorie : indigo, brique, vert, prune, ocre, noir, en aplats pleins. Barlow pour le texte, Barlow Condensed pour les prix, les totaux et la lisière, en capitales espacées. Coins nets (6 px), filets de 1 px, pas d'ombre décorative.

STORY: Le caissier voit tout de suite les catégories et les plats en gros, touche, voit le ticket se remplir, choisit le paiement, encaisse, imprime. Le gérant et le patron retrouvent la journée en une ligne et les ventes en un tableau.

FIRST VIEWPORT: Tablette paysage. En haut, lisière noire (28 px) : MASSAGUI FILS · date · caissier · encaissé du jour. Dessous, barre de navigation blanche à onglets larges (Caisse, Ventes, Tableau de bord, Gestion). Corps en trois colonnes : rail des catégories avec pastilles de couleur (190 px), grille de plats à grandes tuiles avec bandeau coloré et prix condensé 24 px, ticket à droite (400 px) terminé par le bouton vert « Encaisser 125 000 GNF ».

FORM: Lisière de pagne, candidat 4 de la liste ordonnée, seed:45bfd420a376914e (tirage dégradé, sans challengers).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Décisions ouvertes
- Prise de commande en salle par les serveurs : hors périmètre de cette refonte.
- Clôture de caisse : hors périmètre ; l'aide au rendu de monnaie reste un affichage, rien n'est enregistré.
