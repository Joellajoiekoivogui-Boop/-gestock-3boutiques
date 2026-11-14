---
name: MassaGui Fils SARL.U
description: Caisse et gestion d'un hôtel-restaurant guinéen, habillée comme la lisière imprimée d'un pagne.
colors:
  ground: "#edf0ed"
  ink: "#111111"
  panel: "#ffffff"
  massagui-green: "#0abf65"
  massagui-green-hover: "#09ad5b"
  forest-ink: "#067a40"
  mist: "#e3e8e4"
  slate-ink: "#4a524d"
  mint-wash: "#dcf5e7"
  deep-leaf: "#0b5c34"
  butter-wash: "#fdf0cc"
  umber-ink: "#6e4b00"
  brick-alarm: "#c8321f"
  brick-alarm-strong: "#a8281a"
  hairline: "#d5dcd7"
  field-edge: "#bcc6bf"
  cat-indigo: "#2b3c92"
  cat-brick: "#b3432a"
  cat-green: "#087a43"
  cat-plum: "#73306e"
  cat-ochre: "#e2a62a"
  cat-black: "#1d201e"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, Arial Narrow, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, Arial Narrow, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  price:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum' 1"
  title:
    fontFamily: "Barlow, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  button:
    fontFamily: "Barlow, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  label:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, Arial Narrow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "0.05em"
  selvedge:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  xl: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  card: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.massagui-green}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.massagui-green-hover}"
    textColor: "{colors.ink}"
  button-checkout:
    backgroundColor: "{colors.massagui-green}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "64px"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.mist}"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "40px"
  input-search:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.md}"
    height: "48px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  product-tile:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "14px"
  category-band:
    height: "28px"
  category-rail-item:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "56px"
  category-rail-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  payment-option:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "52px"
  payment-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  quantity-pip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.full}"
    height: "32px"
  badge-warning:
    backgroundColor: "{colors.butter-wash}"
    textColor: "{colors.umber-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-soldout:
    backgroundColor: "{colors.brick-alarm-strong}"
    textColor: "{colors.panel}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  selvedge-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.selvedge}"
    padding: "0 16px"
    height: "32px"
  tab-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.slate-ink}"
    height: "64px"
  tab-active:
    textColor: "{colors.ink}"
    height: "64px"
  table-head:
    textColor: "{colors.slate-ink}"
    typography: "{typography.label}"
    height: "44px"
---

# Design System: MassaGui Fils SARL.U

## Overview

**Creative North Star : « La lisière de pagne »**

L'écran se lit comme un pagne wax déplié sur le comptoir. En tête court une lisière noire imprimée en capitales condensées : le nom de la maison, la date, la personne connectée. Elle se termine par une bande de six coloris pleins, comme les repères d'impression d'un tissu. Sous la lisière, tout est sobre : un fond gris très clair teinté de vert, des panneaux blancs, une encre noire. La couleur sert à deux choses seulement : le vert MassaGui pour l'action qui fait avancer la vente, et six coloris francs (indigo, brique, vert, prune, ocre, noir) pour distinguer les catégories de plats en un coup d'œil.

Le système est dense mais lisible à bout de bras : grandes cibles tactiles (44 à 64 px), chiffres en Barlow Condensed gras et à chasse fixe, libellés courts en Barlow. Les montants en francs guinéens sont l'information la plus grosse de l'écran : le total du ticket et le chiffre du jour s'affichent en 44 px. Les surfaces sont plates et cerclées d'un filet de 1 px ; aucune ombre ne sert à décorer.

Ce monde rejette la barre latérale noire générique, la rangée de cartes grises identiques et les dégradés décoratifs. La navigation est une barre d'onglets blanche sous la lisière ; les chiffres de la journée tiennent sur une seule ligne plutôt que dans une grille de tuiles.

**Key Characteristics:**
- Lisière noire de 32 px en capitales espacées, terminée par une bande de six coloris de 4 px.
- Fond `ground` teinté vert, panneaux blancs, filets de 1 px, coins nets (4 à 6 px).
- Vert MassaGui réservé à l'action principale et au contour de ce qui est déjà au ticket.
- La sélection d'un choix (catégorie, mode de paiement, montant reçu) s'imprime en noir plein.
- Barlow Condensed gras à chasse fixe pour tout ce qui est prix, total, compteur ou en-tête.

## Colors

Une encre et un papier, un vert d'action, et six coloris d'impression réservés aux catégories.

### Primary
- **Vert MassaGui** (`massagui-green`) : la couleur de la charte. Fond du bouton principal (« Encaisser », « Se connecter »), contour de 2 px des tuiles déjà au ticket, soulignement de 4 px de l'onglet actif, anneau de focus. Le texte posé dessus est toujours noir (`ink`, contraste 8,7:1), jamais blanc.
- **Vert MassaGui appuyé** (`massagui-green-hover`) : survol du bouton principal.
- **Vert forêt** (`forest-ink`) : la version du vert qui peut porter du texte ou un trait fin sur fond clair (≥ 4,5:1). Liens, contour du focus clavier, barres des graphiques et des répartitions.

### Secondary : les coloris de catégorie
Six aplats attribués dans l'ordre d'affichage des catégories (1 à 6, puis on recommence). Une catégorie garde toujours le même coloris : pastille de 16 px dans le rail, bande de 28 px en tête de chaque tuile de plat, initiales des produits sans photo.
- **Indigo** (`cat-indigo`), texte blanc.
- **Brique** (`cat-brick`), texte blanc.
- **Vert de cuisine** (`cat-green`), texte blanc.
- **Prune** (`cat-plum`), texte blanc.
- **Ocre** (`cat-ochre`), texte noir.
- **Noir de cuisine** (`cat-black`), texte blanc.

### Tertiary : états
- **Lavis menthe** (`mint-wash`) sur **feuille profonde** (`deep-leaf`) : succès, élément actif du menu mobile, sélection de texte.
- **Lavis beurre** (`butter-wash`) sur **encre terre d'ombre** (`umber-ink`) : avertissement, stock bas (« Reste 3 »).
- **Brique d'alarme** (`brick-alarm`) : action destructrice. **Brique d'alarme appuyée** (`brick-alarm-strong`) : texte d'erreur, montant manquant, pastille « Rupture ».

### Neutral
- **Encre** (`ink`) : texte, lisière, sélection pleine, pastille de quantité.
- **Papier** (`panel`) : cartes, tuiles, ticket, barre d'onglets, champs.
- **Fond de comptoir** (`ground`) : fond de page, gris très clair teinté vert.
- **Brume** (`mist`) : survols, zone d'aide au rendu de monnaie, en-têtes de tableau (à 60 %).
- **Ardoise** (`slate-ink`) : texte secondaire, onglets inactifs, devise « GNF » après un prix.
- **Filet** (`hairline`) : bordures de cartes et séparateurs.
- **Bord de champ** (`field-edge`) : bordure des champs et des boutons contour, un cran plus foncée que le filet.

### Named Rules
**La règle du vert qui encaisse.** Le vert plein ne remplit qu'un seul bouton par écran : celui qui fait avancer la vente ou la connexion. Ailleurs il n'apparaît qu'en trait (onglet actif, contour de tuile, focus).

**La règle de l'encre sélectionnée.** Un choix exclusif sélectionné (catégorie, mode de paiement, billet reçu) passe en noir plein avec texte clair. On ne sélectionne pas en vert.

**La règle du coloris fixe.** Les six coloris appartiennent aux catégories et à la lisière. Ils ne servent jamais à signaler un état, ni à décorer un bouton.

## Typography

**Display Font :** Barlow Condensed 500–700 (repli : Barlow, Arial Narrow, sans-serif)
**Body Font :** Barlow 400–700 (repli : ui-sans-serif, system-ui, Segoe UI, Roboto, Arial)

**Character :** Barlow, grotesque d'inspiration signalétique, garde les libellés francs et lisibles au doigt ; sa version condensée donne aux prix et aux totaux l'allure d'un afficheur de caisse, gros sans déborder. Les chiffres sont à chasse fixe partout (`tnum` sur `body`).

### Hierarchy
- **Display** (Barlow Condensed 700, 2,75rem, interligne 1) : le total du ticket, le chiffre du jour de la ligne de journée. Un seul par zone.
- **Headline** (Barlow Condensed 700, 2rem, interligne 1, approche −0,025em) : titre de page (« Caisse », « Ventes »). Les titres de connexion montent à 2,25rem (h2) et jusqu'à 4,5rem (nom de l'établissement).
- **Price** (Barlow Condensed 700, 1,75rem, interligne 1) : prix sur les tuiles de plats et chiffres secondaires des lignes de faits ; la devise suit en Barlow 600 1rem ardoise.
- **Title** (Barlow 600, 1,125rem, interligne 1,25) : titres de cartes, noms de plats (1,125rem également sur les tuiles, 17px dans le ticket).
- **Body** (Barlow 400, 1rem, interligne 1,5) : texte courant ; 15px dans les tableaux.
- **Button** (Barlow 600, 15px) : boutons ; 16px en taille `lg`, 18px en `xl`, 20px pour « Encaisser ».
- **Label** (Barlow Condensed 600, 0,875rem, approche 0,05em, capitales) : en-têtes de colonnes, intitulés des chiffres (« Encaissé aujourd'hui »).
- **Selvedge** (Barlow Condensed 600, 13px, approche 0,14em, capitales) : la lisière seulement.

### Named Rules
**La règle de l'afficheur.** Tout montant, compteur ou quantité s'écrit en Barlow Condensed gras à chasse fixe. Un prix en Barlow normal est une erreur.

**La règle des capitales réservées.** Les capitales espacées sont réservées à la lisière, aux en-têtes de tableau, aux intitulés de chiffres et au mot « Total ». Pas de surtitre en capitales au-dessus des titres.

## Layout

L'en-tête est collant et mesure 100 px : lisière 32 px, bande de coloris 4 px, barre d'onglets blanche 64 px. Le contenu est centré dans une largeur maximale de 1600 px, avec 16 px de marge sur téléphone et 24 px à partir de 640 px.

La caisse casse cette marge et occupe toute la hauteur restante. À partir de 1024 px, trois colonnes : rail des catégories (13rem, 208 px), grille de plats fluide, ticket (26rem, 416 px), séparés par des filets. La grille de plats remplit des colonnes d'au moins 11rem (176 px), 2 colonnes sur téléphone, avec 12 px d'écart. Sous 1024 px, le rail devient une rangée de puces défilante sous la recherche, et le ticket devient une barre fixe en bas (« Panier (3) » + total) qui ouvre un tiroir de 92 % de la hauteur.

La navigation à onglets s'affiche à partir de 768 px ; en dessous, un bouton menu ouvre un tiroir latéral de 320 px. Rythme : 4 / 8 / 12 / 16 / 20 / 24 px ; 20 px est le retrait interne des cartes et du ticket.

## Elevation & Depth

Le monde est plat. La profondeur vient du contraste papier blanc sur fond teinté et des filets de 1 px. Les ombres n'apparaissent que sur ce qui flotte au-dessus de la page (menus, tiroirs, fenêtres) et comme réponse à un état.

### Shadow Vocabulary
- **Anneau de sélection** (`box-shadow: 0 0 0 2px var(--primary)`) : tuile de plat déjà au ticket, avec bordure verte.
- **Soulèvement au survol** (`box-shadow: 0 10px 24px -12px rgb(17 17 17 / 0.25)`, avec `translateY(-2px)`) : cartes interactives `mg-lift`, souris uniquement.
- **Flottant** (`shadow-md` / `shadow-lg` de Tailwind) : menus déroulants, tiroirs, fenêtres de dialogue.
- **Anneau de focus** (`0 0 0 3px` en `ring` à 50–60 %) : tout élément interactif au clavier.

### Named Rules
**La règle du plat au repos.** Au repos, aucune surface posée sur la page ne porte d'ombre. Une ombre signale un survol, une sélection ou un élément flottant.

## Shapes

Coins nets et réguliers dérivés d'un rayon de base de 6 px : 4 px (`md`) pour les boutons, champs, puces de catégorie et options de paiement ; 6 px (`lg`) pour les cartes et les tuiles de plats ; 10 px (`xl`) pour les fenêtres de dialogue et le reçu ; 2 px (`sm`) pour le haut du trait d'onglet actif et les pastilles de catégorie. Le rond complet est réservé aux badges, à la pastille de quantité, aux barres de répartition et aux icônes d'état vide. Les bordures sont des filets de 1 px ; la bande de coloris en tête de tuile est coupée net par l'arrondi de la tuile.

## Components

### Buttons
Fermes et tactiles : ils s'enfoncent légèrement (`scale(0.97)`) à l'appui.
- **Shape :** coins à 4 px (`rounded.md`).
- **Primary :** vert MassaGui, texte noir, Barlow 600 15px, 40 px de haut (44 px minimum sur écran tactile).
- **Tailles :** `sm` 36 px, `default` 40 px, `lg` 48 px, `xl` 64 px ; boutons icône de 36 à 48 px.
- **Hover / Focus :** le vert fonce légèrement ; anneau de focus de 3 px à 50 %. Transition de 150 ms sur couleur, fond, ombre et échelle.
- **Dark :** encre pleine, texte clair : action forte non commerciale.
- **Outline :** papier blanc, bordure `field-edge`, survol en brume avec bordure assombrie.
- **Ghost / Link :** survol en brume ; lien en vert forêt souligné au survol.
- **Destructive :** brique d'alarme, texte blanc.

### Chips (puces de catégorie, mobile)
- **Style :** 48 px de haut, bordure filet, papier blanc, pastille de coloris 16 px, compteur condensé en ardoise.
- **State :** sélectionnée = encre pleine, texte clair, compteur à 70 %.

### Cards / Containers
- **Corner Style :** 6 px.
- **Background :** papier blanc sur fond de comptoir.
- **Shadow Strategy :** aucune au repos (voir Elevation & Depth).
- **Border :** filet de 1 px.
- **Internal Padding :** 20 px ; titres en Barlow 600 1,125rem.

### Inputs / Fields
- **Style :** papier blanc, bordure `field-edge` 1 px, coins 4 px, 40 px (44 px au doigt), texte 1rem. La recherche de la caisse monte à 48 px et 18px, loupe à gauche, bouton d'effacement à droite.
- **Focus :** bordure verte et anneau vert de 3 px à 40 %.
- **Error / Disabled :** bordure brique d'alarme et anneau à 20 % ; désactivé à 50 % d'opacité.

### Navigation
- **Lisière :** bande noire de 32 px, Barlow Condensed 600 13px en capitales espacées : établissement, « Hôtellerie — Restaurant », date en heure de Conakry, personne et rôle (les éléments se révèlent progressivement de 640 à 1024 px). Dessous, la bande de six coloris de 4 px.
- **Barre d'onglets :** blanche, 64 px, filet en bas. Onglets en Barlow 600 16px avec icône de 20 px ; inactif en ardoise, actif en encre avec un trait vert de 4 px en bas. Les écrans de gestion sont regroupés sous un onglet déroulant « Gestion ».
- **Mobile :** sous 768 px, tiroir latéral de 320 px, lignes de 48 px ; l'élément actif est en lavis menthe sur feuille profonde.

### Tuile de plat (signature)
Bouton entier de la grille de caisse. Papier blanc, filet, coins 6 px. En tête, une bande de 28 px au coloris de la catégorie (ou la photo en 16:9 si les photos sont activées). Corps à 14 px de retrait : nom en Barlow 600 1,125rem sur deux lignes au plus, prix en `price` calé en bas, devise en ardoise. Les badges « Rupture » (brique appuyée) et « Reste N » (lavis beurre) se posent sur la bande, en bas à gauche, pour que les prix restent alignés. Une fois au ticket, la tuile prend un contour vert de 2 px et une pastille noire « ×N » en haut à droite, qui rebondit à chaque ajout. En rupture, la bande passe en brume et le texte en ardoise.

### Rail des catégories
Colonne blanche de 208 px. Chaque entrée fait 56 px de haut : pastille de coloris 16 px (icône grille pour « Tout »), nom, compteur condensé. Survol en brume ; sélection en encre pleine.

### Ticket
Colonne blanche de 416 px. En-tête de 64 px (« Ticket » en condensé 1,5rem + nombre d'articles). Lignes séparées par des filets : nom 17px semi-gras, montant de ligne en condensé 1,25rem, prix unitaire en ardoise, pas-à-pas −/quantité/+ en cases de 44 px. Pied : « TOTAL » en condensé capitales et montant en `display` ; modes de paiement en grille de 3 (52 px, icône + libellé, sélection en encre avec coche verte) ; pour les espèces, zone brume avec trois billets suggérés et un champ « Autre », puis « À rendre » ou « Il manque » en condensé. Le tout se termine par le bouton vert de 64 px « Encaisser » avec le total à droite.

### Ligne de journée
Une carte, un chiffre : intitulé en `label`, valeur en `display`, puis les faits qui l'expliquent côte à côte en condensé 1,5rem. Remplace la rangée de tuiles de statistiques.

### Badges
Pilules de 13px Barlow 600 : vert (défaut), lavis menthe (succès), lavis beurre (avertissement), brique à 10 % avec texte brique appuyée (erreur), brume (secondaire).

### Tableaux
Corps en 15px ; en-tête de 44 px sur brume à 60 %, en `label` ardoise ; cellules à 12 px de retrait ; filets entre les lignes, survol en brume à 40 %.

### Mouvement
Courbe unique `cubic-bezier(0.16, 1, 0.3, 1)`, durées de 0,3 à 0,8 s, uniquement `transform`, `opacity` et `clip-path` : entrée de page (10 px, 0,3 s), cascade des grilles et des lignes de tableau (décalage de 25 à 35 ms), barres qui s'étirent (0,8 s), reçu qui « sort » de l'imprimante (0,75 s). Avec « réduire les animations », tout devient un fondu de 0,15 s.

## Do's and Don'ts

### Do:
- **Do** commencer chaque écran connecté par la lisière noire de 32 px et sa bande de six coloris de 4 px.
- **Do** écrire chaque montant en Barlow Condensed 700 à chasse fixe, suivi de « GNF » en plus petit et en ardoise.
- **Do** donner à chaque catégorie son coloris fixe (`cat-1` à `cat-6`, dans l'ordre d'affichage) et le répéter partout où la catégorie apparaît.
- **Do** poser du texte noir sur le vert MassaGui (8,7:1) et utiliser le vert forêt pour tout texte vert sur fond clair.
- **Do** garder des cibles tactiles de 44 px minimum, 56 à 64 px pour les gestes de caisse.
- **Do** marquer un choix exclusif sélectionné en encre pleine.

### Don't:
- **Don't** revenir à une barre latérale noire de navigation : la navigation est une barre d'onglets blanche sous la lisière.
- **Don't** aligner des cartes de statistiques grises identiques : utiliser la ligne de journée.
- **Don't** mettre de texte blanc sur le vert MassaGui.
- **Don't** utiliser les coloris de catégorie pour un état, un bouton ou un fond décoratif.
- **Don't** ajouter d'ombre à une surface au repos.
- **Don't** demander de confirmation en fenêtre avant d'encaisser : la vente part au premier appui sur « Encaisser ».
