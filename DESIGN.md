---
name: MassaGui Fils SARL.U
description: Caisse et gestion d'un hôtel-restaurant guinéen, présentée comme la carte d'un bon restaurant, vert sapin et or.
colors:
  menu-ground: "#f3f5f2"
  ink: "#16201b"
  plate-white: "#ffffff"
  massagui-green: "#0abf65"
  massagui-green-ink: "#0b1a12"
  massagui-green-strong: "#067a40"
  forest: "#0f3d2c"
  forest-soft: "#e7efe9"
  gold: "#b8914a"
  gold-strong: "#82621f"
  gold-light: "#e3c88f"
  mist: "#eaede8"
  slate-ink: "#5b605b"
  mint-wash: "#e3f4ea"
  deep-leaf: "#0b5c34"
  butter-wash: "#fbefd2"
  umber-ink: "#6b4a00"
  brick-alarm: "#c8321f"
  brick-alarm-strong: "#a8281a"
  hairline: "#e0e4dd"
  field-edge: "#cdd3cb"
  cat-forest: "#0f3d2c"
  cat-brick: "#b3432a"
  cat-lagoon: "#1f6f8b"
  cat-plum: "#7a3d6e"
  cat-ochre: "#a8781c"
  cat-charcoal: "#3c4540"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, Times New Roman, serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.05
  headline:
    fontFamily: "Playfair Display, Georgia, Times New Roman, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Playfair Display, Georgia, Times New Roman, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  card-title:
    fontFamily: "Playfair Display, Georgia, Times New Roman, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  figure:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "'tnum' 1"
  price:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "'tnum' 1"
  dish-name:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  button:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.25
  tagline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.2em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.massagui-green}"
    textColor: "{colors.massagui-green-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "8px 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.massagui-green-strong}"
    textColor: "{colors.plate-white}"
  button-encaisser:
    backgroundColor: "{colors.massagui-green}"
    textColor: "{colors.massagui-green-ink}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "64px"
  button-dark:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "8px 20px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "8px 20px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
  button-destructive:
    backgroundColor: "{colors.brick-alarm}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "40px"
  input-search:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 48px"
    height: "52px"
  card:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  dish-card:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px"
  dish-add:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.full}"
    size: "36px"
  category-disc:
    backgroundColor: "{colors.plate-white}"
    rounded: "{rounded.full}"
    size: "64px"
  category-disc-active:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
  nav-tab:
    textColor: "{colors.slate-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "0 16px"
  nav-tab-active:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
  nav-track:
    backgroundColor: "{colors.mist}"
    rounded: "{rounded.full}"
    padding: "4px"
  bottom-bar-centre:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.full}"
    size: "72px"
  payment-tile:
    backgroundColor: "{colors.plate-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "52px"
  payment-tile-selected:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
  day-line:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.lg}"
    padding: "20px 24px"
  badge:
    rounded: "{rounded.full}"
    typography: "{typography.label}"
    padding: "2px 10px"
  badge-success:
    backgroundColor: "{colors.mint-wash}"
    textColor: "{colors.deep-leaf}"
  badge-warning:
    backgroundColor: "{colors.butter-wash}"
    textColor: "{colors.umber-ink}"
  badge-stock:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.plate-white}"
  badge-sold-out:
    backgroundColor: "{colors.brick-alarm-strong}"
    textColor: "{colors.plate-white}"
  quantity-pip:
    backgroundColor: "{colors.massagui-green}"
    textColor: "{colors.massagui-green-ink}"
    rounded: "{rounded.full}"
    size: "32px"
---

# Design System: MassaGui Fils SARL.U

## Overview

**Creative North Star: « La carte du restaurant »**

L'application se lit comme la carte d'un bon restaurant posée sur le comptoir : des plats présentés en cartes blanches arrondies sur un fond gris très clair à peine vert, des catégories en pastilles rondes à pictogramme, et une identité tenue par deux couleurs de maison, le vert sapin et l'or. Le vert MassaGui, vif, n'est pas l'identité : c'est le geste qui encaisse. Ce monde reprend la maquette de référence fournie par l'utilisateur et remplace l'ancienne « lisière de pagne » (bande noire, Barlow).

La densité est celle d'un outil de comptoir sur tablette : grandes cibles (44 px au doigt, 64 px pour Encaisser), chiffres en Inter gras à chasse fixe, titres en Playfair Display. La serif donne le ton « maison » ; elle ne porte jamais un prix ni un montant. Les surfaces sont plates à ombre douce, sans dégradé ni texture ; la profondeur vient du blanc posé sur le fond clair.

L'application refuse le tableau de cases plates et la barre noire technique de l'ancien monde.

**Key Characteristics:**
- Fond gris-vert clair, cartes blanches arrondies (14 px) à ombre douce.
- Vert sapin pour tout ce qui est choisi : onglet actif, catégorie active, paiement sélectionné, bouton rond « + ».
- Or pour la marque : sous-titre « • Hôtellerie — Restaurant • », coche du paiement choisi, libellé du bandeau de journée.
- Vert MassaGui réservé aux actions qui valident (Encaisser, Ouvrir la caisse) et à la pastille de quantité.
- Playfair Display pour la marque et les titres, Inter pour tout le reste.
- Formes rondes partout où l'on touche : pilules, pastilles, boutons ronds.

## Colors

Une base neutre légèrement verte, deux couleurs de maison (sapin, or) et un vert vif d'action ; les teintes de catégorie ne servent qu'à reconnaître un rayon.

### Primary
- **Vert MassaGui** (massagui-green) : couleur de la charte, gardée pour l'action qui valide : bouton par défaut, pilule « Encaisser », « Ouvrir la caisse », pastille de quantité « ×2 » sur une carte plat, compteur du panier. Toujours avec texte quasi noir (massagui-green-ink), contraste 8,7:1.
- **Vert MassaGui foncé** (massagui-green-strong) : survol du bouton principal (le texte passe au blanc), liens, curseur de saisie, contour de focus, barres de graphiques.

### Secondary
- **Vert sapin** (forest) : la couleur de l'état choisi et de l'identité. Onglet actif, pastille de catégorie active, mode de paiement sélectionné, bouton rond « + » des cartes plats, bouton central de la barre du bas, bandeau de journée, panneau de marque de la connexion, `themeColor` du navigateur. Bordure de 2 px d'une carte plat déjà au ticket.
- **Sapin pâle** (forest-soft) : fond des pastilles d'état vide, sélection de texte, fond `accent`.

### Tertiary
- **Or** (gold) : filets et marque sur fond sapin : sous-titre de la connexion, coche du paiement choisi.
- **Or foncé** (gold-strong) : le même or quand il est posé sur blanc (sous-titre de l'en-tête), lisible à 5,6:1.
- **Or clair** (gold-light) : libellé du chiffre principal dans le bandeau de journée.
- **États** : mint-wash / deep-leaf (succès), butter-wash / umber-ink (avertissement, bandeau de démonstration), brick-alarm / brick-alarm-strong (suppression, rupture, monnaie manquante).
- **Teintes de catégorie** (cat-forest, cat-brick, cat-lagoon, cat-plum, cat-ochre, cat-charcoal) : attribuées dans l'ordre d'affichage des catégories, toujours la même pour la même catégorie. Elles colorent le pictogramme d'une pastille de catégorie et, mélangées à 12 % dans du blanc, le fond de l'emplacement photo d'un plat sans image.

### Neutral
- **Fond de carte** (menu-ground) : fond de toutes les pages.
- **Encre** (ink) : texte principal, noir légèrement vert.
- **Blanc d'assiette** (plate-white) : cartes, ticket, en-tête, barre du bas, champs.
- **Brume** (mist) : rail des onglets, fonds secondaires, en-tête de tableau, zone de monnaie rapide.
- **Ardoise** (slate-ink) : texte secondaire, onglets inactifs, devise « GNF » à côté d'un prix.
- **Filet** (hairline) : bordures de cartes et séparateurs.
- **Bord de champ** (field-edge) : contour des champs et des boutons à contour.

### Named Rules
**La règle du sapin choisi.** Tout ce qui est sélectionné passe en vert sapin plein avec texte blanc ; jamais en vert MassaGui. Le vert vif ne signale pas un état, il déclenche une action.

**La règle de l'or rare.** L'or n'apparaît que sur la marque et sur un détail de sélection (coche, libellé). Jamais en fond, jamais sur un bouton. Sur blanc, toujours gold-strong.

**La règle des teintes de rayon.** Les six teintes de catégorie restent dans les pictogrammes et les emplacements photo ; elles ne colorent ni texte courant, ni bouton, ni graphique.

## Typography

**Display Font:** Playfair Display 600–700 (avec Georgia, Times New Roman, serif)
**Body Font:** Inter 400–700 (avec ui-sans-serif, system-ui, Segoe UI, Roboto, Arial)

Les deux familles sont auto-hébergées via `@fontsource`. Le corps active les chiffres à chasse fixe (`'tnum' 1`) partout.

**Character:** Une serif de carte de restaurant pour nommer, une grotesque nette et grasse pour compter. Le contraste entre les deux suffit à structurer la page sans couleur.

### Hierarchy
- **Display** (Playfair 700, 3–3,75 rem, 1,05) : nom de l'établissement sur le panneau sapin de la connexion.
- **Headline** (Playfair 700, 2 rem) : titre de page (`PageHeader`), « Connexion » (2,25 rem).
- **Title** (Playfair 700, 1,5 rem) : titre de section de la caisse (« Tout le menu »), « Commande » et « Total » du ticket, nom de marque dans l'en-tête (1,25 rem).
- **Card title** (Playfair 600, 1,25 rem) : titres de cartes, titre d'état vide.
- **Figure** (Inter 700, 2,5 rem, serré) : chiffre principal du bandeau de journée, total du ticket (1,875–2,25 rem), statistiques (1,75 rem).
- **Price** (Inter 700, 1,125–1,25 rem, serré) : prix d'une carte plat, suivi de « GNF » en 12 px semi-gras ardoise.
- **Dish name** (Inter 700, 1,125 rem, 1,375) : nom du plat, deux lignes au plus.
- **Body** (Inter 400, 16 px, 1,5) : texte courant, descriptions de plats (14 px ardoise, deux lignes au plus).
- **Button** (Inter 600, 15 px) : boutons et onglets.
- **Label** (Inter 600, 13 px) : badges, nom de catégorie sous sa pastille.
- **Tagline** (Inter 600, 11 px, capitales, interlettrage 0,2 em, gold-strong) : uniquement le sous-titre de marque « • Hôtellerie — Restaurant • ».

### Named Rules
**La règle de la serif qui nomme.** Playfair nomme (marque, page, section, carte) ; elle ne porte jamais un prix, un total ni une quantité. Les chiffres sont toujours en Inter gras à chasse fixe.

**La règle des capitales uniques.** Le seul texte en capitales interlettrées de l'interface est la ligne de marque et les en-têtes de colonnes de tableau. Aucun sur-titre au-dessus des titres.

## Layout

En-tête blanc collant de 72 px (`h-[4.5rem]`) : logo arrondi 42 px, marque, rail d'onglets centré, utilisateur et déconnexion à droite. Contenu dans un conteneur de 1600 px au plus, marges 16 px (téléphone) et 24 px (tablette et plus).

Caisse (≥ 1024 px) : grille à deux colonnes, menu à gauche, ticket fixe de 26 rem à droite, chacun défilant seul. En tête du menu, une zone collante : champ de recherche en pilule, bouton sombre « Ventes du jour », rangée défilante de pastilles de catégorie (88 px de large chacune), puis titre de section en Playfair et compteur de plats. Grille de cartes plats : deux colonnes sur téléphone, puis remplissage automatique à 200 px minimum, écarts 12 puis 16 px.

Tablette portrait (768–1023 px) : le ticket devient un tiroir du bas (92 dvh), ouvert par une barre fixe « Panier (n) » en bouton xl.

Téléphone (< 768 px) : rail d'onglets masqué, barre d'onglets fixe en bas (80 px) avec bouton rond central de 72 px qui dépasse de 28 px et ouvre le panier (ou la caisse hors caisse), menu « Plus » en tiroir latéral de 320 px. Le contenu garde 96 px de marge basse.

Rythme : 4, 8, 12, 16, 24, 40 px. Les chiffres d'une ligne de faits sont espacés de 40 à 48 px.

## Elevation & Depth

Système à ombre douce unique : les surfaces blanches se détachent du fond clair par une ombre ambiante très légère, jamais par un contour fort. Pas de dégradé ni de verre, hormis le flou léger de l'en-tête collant.

### Shadow Vocabulary
- **Ombre de carte** (`box-shadow: 0 1px 2px rgb(22 32 27 / 0.05), 0 6px 18px -8px rgb(22 32 27 / 0.12)`, `--card-shadow`) : cartes, cartes plats, pastilles de catégorie au repos, champ de recherche.
- **Ombre portée** (`shadow-md` / `shadow-lg` de Tailwind) : pastille de catégorie active, pastille de quantité, bouton rond central de la barre du bas (entouré d'un anneau blanc de 4 px).
- **Anneau de sélection** (`box-shadow: 0 0 0 2px var(--forest)`) : carte plat déjà présente au ticket.

### Named Rules
**La règle de l'assiette posée.** Une surface est blanche sur fond clair avec l'ombre de carte, ou elle n'est pas une surface. On n'empile pas de carte dans une carte.

## Shapes

Formes douces et rondes. Rayon de base 14 px (`--radius`) pour les cartes, cartes plats, tuiles de paiement et bandeau de journée ; 8 px pour les champs et l'emplacement photo dans une carte plat ; 10 px pour les éléments de menu ; 18 px pour les grandes cartes. Tout ce qui se touche en un geste est rond : boutons en pilule, onglets en pilule, pastilles de catégorie circulaires (64 px), bouton « + » circulaire (36 px), badges en pilule, bouton central circulaire (72 px). Bordures d'un pixel en `hairline`, invisibles sur les cartes plats au repos.

## Components

### Buttons
Pilules pleines, franches, qui s'enfoncent légèrement au toucher (`scale 0.97`, 150 ms).
- **Shape :** pilule (rayon plein). Hauteurs : 36, 40, 48 et 64 px (xl) ; 44 px minimum au doigt.
- **Primary :** vert MassaGui, texte quasi noir, Inter 600 15 px, 20 px de marge latérale.
- **Hover / Focus :** survol vers massagui-green-strong avec texte blanc ; focus en anneau sapin de 3 px à 50 %.
- **Dark :** vert sapin, texte blanc (« Ventes du jour », actions secondaires fortes).
- **Outline :** blanc, contour field-edge, survol en brume. **Ghost :** sans fond, survol en brume. **Destructive :** brique, texte blanc.
- **Encaisser :** bouton primaire xl de 64 px, pleine largeur du ticket, icône et libellé à gauche, montant en gras 20 px à droite.

### Chips
- **Pastilles de catégorie :** disque blanc de 64 px à ombre de carte, pictogramme Lucide 28 px dans la teinte de la catégorie, nom en 13 px semi-gras et nombre de plats en dessous. Active : disque sapin plein, pictogramme blanc, nom en sapin.
- **Montants rapides :** pilules blanches de 44 px dans une zone brume ; choisie, sapin plein.
- **Badges :** pilule 13 px semi-gras ; succès (menthe/vert profond), avertissement (beurre/terre d'ombre), destructif (brique à 10 %), « Reste n » en sapin plein, « Rupture » en brique pleine.

### Cards / Containers
- **Corner Style :** 14 px (cartes), 18 px (grandes cartes).
- **Background :** blanc d'assiette.
- **Shadow Strategy :** ombre de carte (voir Elevation & Depth).
- **Border :** filet d'un pixel.
- **Internal Padding :** 20 px ; titre de carte en Playfair 600 20 px.

### Inputs / Fields
- **Style :** blanc, contour field-edge, rayon 8 px, 40 px de haut (44 px au doigt), texte 16 px.
- **Recherche de la caisse :** pilule blanche de 52 px sans contour, ombre de carte, loupe à gauche, effacement rond à droite.
- **Focus :** contour sapin et anneau sapin de 3 px à 40 %.
- **Error / Disabled :** contour brique et halo brique à 20 % ; désactivé à 50 % d'opacité.

### Navigation
- **En-tête :** blanc à 95 % avec flou, filet bas. Marque : logo 42 px arrondi, nom en Playfair 700 20 px, ligne « • Hôtellerie — Restaurant • » en or foncé capitales 11 px.
- **Onglets :** rail en pilule brume (4 px de marge), onglets en pilule de 44 px, icône 18 px + libellé 15 px semi-gras ; inactif ardoise, survol encre, actif sapin plein texte blanc. Le menu « Gestion » se déroule dans un panneau arrondi de 12 px aux lignes de 44 px.
- **Téléphone :** barre blanche du bas de 80 px, onglets icône 24 px + libellé 12 px (actif en sapin), bouton rond central sapin de 72 px qui dépasse, anneau blanc, compteur vert MassaGui. Menu « Plus » en tiroir latéral, lignes de 48 px arrondies 14 px, active en sapin plein.

### Carte plat (signature)
Bouton entier, carte blanche 14 px à ombre de carte. En haut, l'emplacement photo arrondi 8 px à 8 px des bords (16:10 avec photo, 3:1 sans), sinon fond teinté de la catégorie avec pictogramme. Badges d'état en haut à gauche, pastille de quantité verte en haut à droite. Dessous : nom (Inter 700 18 px), description (14 px ardoise, masquée sur téléphone), puis prix en Inter gras avec « GNF » en petit, et bouton rond « + » sapin de 36 px qui passe au vert MassaGui au survol. Survol : montée de 2 px et léger zoom de la photo ; au ticket : bord et anneau sapin de 2 px ; en rupture : photo grisée, texte ardoise.

### Ticket
Panneau blanc à droite. En-tête de 64 px : « Commande » en Playfair 24 px et nombre d'articles. Lignes séparées par des filets : nom 17 px semi-gras, total de ligne en gras, prix unitaire ardoise, contrôles de quantité ronds de 44 px. Pied : sous-total, remise, « Total » en Playfair avec montant en Inter gras 30–36 px, tuiles de paiement en grille de 3 (blanches, 52 px, rayon 14 px ; choisie en sapin avec coche or), zone de monnaie rapide sur fond brume, puis la pilule Encaisser.

### Bandeau de journée
Carte sapin pleine sans bordure, rayon 14 px : libellé en or clair, chiffre principal en Inter 700 40 px, puis faits côte à côte (libellé blanc à 75 %, valeur en gras 20 px). En tête du tableau de bord, de « Mes ventes », des stocks (le titre nomme le problème : « Croissant en rupture ») et des rapports. Un seul bandeau par page ; les autres chiffres vont dans une ligne de faits sur carte blanche, jamais dans une rangée de cartes identiques.

### Pages de gestion
- **Bande de gestion :** sous l'en-tête, sur toutes les pages de gestion, une rangée de pilules de 40 px (icône 16 px + libellé 14 px semi-gras) qui défile horizontalement ; la page en cours est en sapin plein texte blanc et toujours ramenée dans le champ.
- **Carte produit (administration) :** même carte que la carte plat (emplacement photo 16:9, ou 4:1 teinté sans photo), avec en bas une barre d'actions séparée par un filet : « Modifier » (contour), « Retirer » / « Remettre » (fantôme), menu « ⋯ » (archiver, supprimer). Badges seulement pour les exceptions : « Retiré de la caisse », « Archivé », « Rupture », « Stock faible ». Catégorie et stock en petit à droite du prix, jamais au-dessus du nom.
- **Carte catégorie :** disque de 56 px au pictogramme dans la teinte de la catégorie, nom en Inter 700 18 px, badge « À la caisse » / « Masquée », ligne « 5 produits · 1re à la caisse », boutons modifier / supprimer de 44 px.
- **Carte utilisateur :** pastille d'initiales en Playfair (sapin plein pour un administrateur, sapin pâle sinon), nom, e-mail, badge « Votre compte », rôle et date, permissions en badges, barre d'actions « Modifier » / « Mot de passe ».
- **Jauge de stock :** barre de 8 px arrondie sur fond brume ; sapin si suffisant, ocre foncé (encre d'alerte) si faible, brique si rupture. L'or n'est jamais un remplissage.
- **Journal d'activité :** fil groupé par jour, chaque jour sous une bande brume au titre Playfair ; chaque entrée a un disque de 40 px coloré par nature (vente sapin pâle, annulation brique pâle, stock beurre, compte bleu pâle, réglage brume), le libellé en gras, l'heure et l'auteur en ardoise, puis une phrase en français (« MG-2026-000020 · 435 000 GNF · Orange Money »), jamais le détail technique brut.
- **Filtres sur téléphone :** repliés derrière un bouton « Filtres » qui affiche le nombre de filtres actifs ; ouverts d'office si un filtre est actif.

### Connexion
Écran en deux colonnes sur grand écran : panneau sapin plein à gauche (logo, nom en Playfair display, ligne de marque en or capitales), formulaire sur fond clair à droite.

### Mouvement
Entrées courtes (≤ 0,8 s), uniquement transform / opacity / clip-path, courbe `cubic-bezier(0.16, 1, 0.3, 1)` : page qui monte de 10 px, cascade des grilles et lignes de tableau, barres de répartition qui s'étirent, reçu qui « sort » de l'imprimante. Tout passe à un fondu de 0,15 s sous « réduire les animations ».

## Do's and Don'ts

### Do:
- **Do** sélectionner en vert sapin plein (forest) avec texte blanc : onglets, catégories, paiements, montants rapides.
- **Do** garder le vert MassaGui (massagui-green) pour l'action qui valide, avec texte massagui-green-ink.
- **Do** poser chaque surface en blanc sur menu-ground avec l'ombre de carte et un rayon de 14 px.
- **Do** rendre ronds tous les éléments de toucher : pilules pour boutons et onglets, disques pour catégories et « + ».
- **Do** écrire les montants en Inter gras à chasse fixe, devise « GNF » à part en petit ardoise.
- **Do** nommer en Playfair Display (marque, page, section, carte, « Total ») et tout le reste en Inter.
- **Do** utiliser gold-strong pour tout or posé sur blanc.

### Don't:
- **Don't** revenir à la bande noire, à Barlow ou au noir #111111 de l'ancienne lisière de pagne.
- **Don't** mettre un prix, un total ou une quantité en Playfair.
- **Don't** utiliser l'or en fond ou sur un bouton.
- **Don't** marquer une sélection en vert MassaGui.
- **Don't** colorer du texte, des boutons ou des graphiques avec les teintes de catégorie.
- **Don't** ajouter des sur-titres en capitales au-dessus des titres ; les capitales interlettrées sont réservées à la ligne de marque et aux en-têtes de tableau.
- **Don't** imbriquer une carte dans une carte ni réduire une cible tactile sous 44 px.
