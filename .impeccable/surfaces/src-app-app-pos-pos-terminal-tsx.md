---
version: 1
slug: "src-app-app-pos-pos-terminal-tsx"
primary_target: "src/app/(app)/pos/pos-terminal.tsx"
related_targets: ["src/components/app/app-shell.tsx","src/app/globals.css"]
---

# Surface : application MassaGui (caisse, ventes, tableau de bord, gestion)

Mode : Operate. Utilisateurs : caissiers peu à l'aise au comptoir sur tablette, gérant sur place, patron à distance sur téléphone. Tâche principale : encaisser une vente en un minimum de touches ; ensuite suivre ventes et chiffres. Contraintes : charte vert #0ABF65 (gardé pour les actions), français, GNF sans décimale, imprimante thermique, droits par rôle inchangés.

Direction imposée par l'utilisateur : il a fourni une maquette de référence d'application de restaurant (« Taste Haven ») et demandé d'en reprendre le design, vert sapin et or, avec des photos de plats (exemples dans la démo, ses photos dans l'application), en gardant le vert MassaGui. Elle remplace la direction « lisière de pagne ».

## Direction contract

THESIS: La caisse se présente comme la carte d'un bon restaurant : photos des plats en cartes blanches arrondies, catégories en pastilles rondes à pictogramme, vert sapin et or pour l'identité. Refuse le tableau de cases plates et la barre noire technique.

OWN-WORLD: Fond blanc cassé chaud, cartes blanches arrondies (14-16 px) à ombre douce, vert sapin #0f3d2c pour les éléments choisis, badges et boutons ronds « + », or #b8914a pour les filets et le sous-titre, vert MassaGui #0abf65 pour Encaisser. Playfair Display pour la marque et les titres, Inter pour tout le reste, prix en Inter gras.

STORY: Le caissier touche une pastille de catégorie, voit les plats en photo, touche une carte, le ticket se remplit, il choisit le paiement et encaisse. Le gérant et le patron lisent la journée dans un bandeau vert sapin en tête du tableau de bord.

FIRST VIEWPORT: Tablette paysage. En haut, barre blanche : logo, « MassaGui Fils » en Playfair avec « • Hôtellerie — Restaurant • » en or, onglets en pastilles au centre, utilisateur à droite. Corps : rangée de pastilles rondes de catégories, titre de section en Playfair, grille de cartes plats (photo, badge, nom, description, prix, bouton rond +) ; ticket blanc à droite terminé par la pilule verte « Encaisser 125 000 GNF ». Sur téléphone, barre d'onglets en bas avec bouton rond central Panier.

FORM: Maquette de référence fournie par l'utilisateur (direction imposée, pas de tirage) ; seed: none (unavailable).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Décisions ouvertes
- Photos d'exemple : téléchargement depuis Wikimedia Commons bloqué (limite de débit) ; emplacements illustrés en attendant.
- Prise de commande en salle et clôture de caisse : hors périmètre.
