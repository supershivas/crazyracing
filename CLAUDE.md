@.claude/conventions-jeu.md

# Crazy Racing

<!-- Ce fichier ne décrit QUE le jeu actuel (section 15 des conventions).
     Ce qui a été essayé puis retiré part dans docs/archives/, avec sa raison.
     Chaque règle porte son coût : le bug, la mesure ou la raison qui l'a fait naître.
     Garde-le sous 20 ko : au-delà, le détail d'un domaine va dans docs/domaines/<domaine>.md
     (outils/decouper-claude-md.mjs) et ici reste un index « Où lire quoi » (conventions, section 15). -->

## Description

<!-- En quelques lignes : le jeu, pour qui, la boucle de jeu en une phrase.
     L'intention complète est dans DESIGN.md. -->

- **Production** : https://supershivas.github.io/crazyracing/
- **Aperçu** : https://supershivas.github.io/crazyracing/apercu.html
- **Genre** : course de voitures « auto battler » (famille stratégie / gestion avec action) : les voitures roulent seules, le joueur règle sa ligne, son aspiration, ses pneus, son arrêt au stand et ses bonus. Boucle principale : se placer pour gagner de la vitesse et doubler.
- **Vue et rendu** : de dessus incliné qui suit la voiture, 3D three.js avec lumière dynamique (soleil et ombres, lampadaires, phares, pluie, bloom). Profil game-system `pixel-3d-three`, mais **sans** rendu en basse résolution : le parti pris est le détail (voir Exceptions). L'éditeur de circuits reste en 2D (canvas).
- **Cible** : bureau (clavier, manette) d'abord ; téléphone en paysage avec boutons à l'écran (aperçu de l'autre cible).
- **Public** : joueur occasionnel à joueur averti ; inspiré de *Corner Cutters* (Ferdi Willemse, Steam, T4 2026) : on reprend l'idée (course de dessus, pneus, météo, stands), pas ses circuits, ses images ni ses noms.
- **Session** : course de 1 à 20 tours (2 à 10 minutes), contre la montre contre son fantôme, records par circuit, course en ligne à deux sur le même réseau.
- **Steam** : porte ouverte (section 22) : rien de distant, manette, plein écran, toutes tailles de fenêtre. Le jeu en ligne passe par WebRTC sans serveur.
- Jeu : pas de sous-titre (section 3 des conventions).

### Palette

Sweetie 16 (GrafxKid), en entier ; `x` et `z` sont les deux couleurs de livrée d'une équipe (`LIVREES`). La palette sert à l'interface, aux livrées et aux décors ; l'éclairage 3D produit les nuances.

| Lettre | Valeur | Rôle |
|---|---|---|
| `n` | `#1a1c2c` | nuit : fond, contours |
| `p` | `#5d275d` | prune |
| `r` | `#b13e53` | rouge |
| `o` | `#ef7d57` | orange : accent, adversaires sur la carte |
| `y` | `#ffcd75` | jaune : box |
| `l` | `#a7f070` | vert clair |
| `v` | `#38b764` | vert prairie |
| `t` | `#257179` | sarcelle |
| `m` | `#29366f` | bleu nuit |
| `u` | `#3b5dc9` | bleu roi |
| `c` | `#41a6f6` | bleu ciel |
| `s` | `#73eff7` | cyan : sillage |
| `w` | `#f4f4f4` | blanc : texte |
| `h` | `#94b0c2` | gris bleu |
| `i` | `#566c86` | ardoise |
| `k` | `#333c57` | gris nuit |
| `x` `z` | selon l'équipe | livrée |

### Échelle

- 1 unité du monde ≈ 5 cm ; voiture 13 × 7 ; piste de 34 de large, trois lignes à −10, 0 et +10 ; un circuit fait 2 000 à 4 000.
- Vitesse affichée = vitesse × 0,9 (km/h).

### Commandes

On ne pilote pas : on choisit. Chaque commande est une impulsion.

| Action | Clavier | Doigt | Manette |
|---|---|---|---|
| Ligne à gauche / à droite | ← → Q D (A D) | ◀ ▶ | croix ou stick (un coup) |
| Bonus | Espace, Entrée, ↑ | ★ ou la case du bonus | A, X |
| Appeler / annuler l'arrêt au stand | ↓, E, S | ⛽ ou le bouton Stand | B, Y |
| Pneus du prochain arrêt | 1 2 3 | les trois boutons du HUD | — |
| Pause (hors ligne) | Échap, P | bouton pause | Start |

## Stack

- Vanilla JS, modules ES, sans build ; GitHub Pages par le workflow
  `.github/workflows/pages.yml` (tests avant publication).
- **three.js 0.170.0** copié dans `vendor/` (avec sa licence et les addons de post-traitement : bloom,
  environnement de pièce), chargé par une `importmap` dans `index.html` et `labo.html` ; jamais de CDN.
  Accord de Jérôme (demande du 26/10/2026). `render3d.js` n'est importé qu'à la première course.
- Modules de game-system dans `js/lib/` (tenus à jour par
  `scripts/sync-game-system.sh` au début de chaque session) ; outils dans
  `outils/`.
- Données : `localStorage`, clés `crazyracing:partie` (records, circuits perso), `crazyracing:prefs`,
  `crazyracing:atelier` (brouillon de l'atelier), `crazyracing:gh-token` (jamais
  exporté). Export / import JSON dans les réglages.
- Qualité graphique : `haute` (ombres 2048, bloom, MSAA), `moyenne`, `basse` (sans ombres ni bloom) ;
  `?q=basse` dans l'adresse pour forcer (tests, machines sans carte graphique).

## Structure

- `index.html` — écran titre, HUD, préparation de course, résultats, réglages, pause, en ligne, éditeur (dialogues rattachés au body).
- **Les règles (pures, testées sans navigateur)** :
  - `js/piste.js` — géométrie d'un circuit (spline fermée, échantillons tous les 4, projection, contrôle de tracé).
  - `js/voiture.js` — l'état d'une voiture, adhérence, vitesse permise par les virages à venir sur une ligne.
  - `js/ia.js` — le choix de ligne des voitures de l'ordinateur (sillage, trafic, dangers, bonus, corde).
  - `js/course.js` — la course : grille, feux, vitesse automatique, sillage, stands, incidents, dangers, bonus, classement.
  - `js/circuit-code.js`, `js/instantane.js` — le code de partage d'un circuit ; ce que l'hôte envoie à l'invité (assaini).
- **Le dessin** :
  - `js/render3d.js` — orchestre : caméra, voitures, lignes guides, sillage, dangers, bonus, particules, post-traitement.
  - `js/monde3d.js` — sol, asphalte, vibreurs, stands, portique, tribunes, glissières, lampadaires, décor par thème.
  - `js/voiture3d.js` — le modèle de voiture (formes simples), roues, feux, étiquette.
  - `js/lumieres.js` — ciel, soleil, lampadaires, phares, pluie, brume : jour / soir / nuit.
  - `js/carte.js` — le circuit en petit (HUD, liste des circuits).
- **Le reste** : `js/main.js` (cycle de vie), `js/hud.js`, `js/entrees.js`, `js/editeur.js` (2D), `js/reseau.js` (WebRTC sans serveur),
  `js/palette.js`, `js/data/` (réglages, circuits), `js/design-store.js` (réglages publiés par l'atelier).
- `labo.html`, `js/labo.js` — le labo (section 16) : lumière, aspiration, météo en 3D.
- `atelier.html`, `js/atelier.js` — l'atelier (section 17) : réglages chiffrés.
- `test/` — `node outils/test-run.mjs`.
- `lisibilite.config.mjs`, `playtest.parcours.mjs` — configuration des outils.

## Vérifier et livrer

```bash
node outils/test-run.mjs                 # circuits, voiture, course, dessins
node outils/captures.mjs                 # téléphone + bureau, sans erreur console
node outils/audit-ecran.mjs              # débordement, amputation, cibles
node outils/lisibilite.mjs               # contraste, silhouettes
node outils/stamp-version.mjs            # après chaque changement de version.json
```

## Exceptions aux conventions

- **Profil `pixel-3d-three`** : pas de rendu en basse résolution ni de palette exacte. Jérôme veut du détail
  et une lumière dynamique ; l'éclairage produit des couleurs hors palette. La palette reste celle de
  l'interface et des livrées. Coût : une carte graphique est nécessaire pour la qualité haute.
- **Pas de pause en ligne** : la course continue ; la pause ouvre un menu pour quitter.

## Ce qui a été retiré

| Quoi | Version | Pourquoi (ce que ça coûtait) |
|---|---|---|
| Conduite au volant (gaz, frein, braquage, glisse, sorties de piste, pénalités de limites) | 0.4.0 | « Très difficile » (Jérôme) : la course devient un auto battler ; on garde la physique de l'adhérence comme vitesse permise par les virages |
| Rendu 2D en pixels, sprites, éditeur de pixels | 0.4.0 | Remplacés par la 3D ; le labo et l'atelier n'ont plus de dessins à retoucher |
| Pilote automatique (bonus), collisions entre voitures | 0.4.0 | Plus de conduite à automatiser ; les voitures se bloquent sur leur ligne |

## Pièges connus

- **Une voiture est (dist, d), pas (x, y)** : `positionner(c, v)` calcule x, y, cap, s. Toute modification de `dist` ou `d`
  (tests, réseau, debug) doit être suivie de `positionner`. `dist` est négatif avant la ligne de départ.
- **La longueur d'une ligne** vaut `1 − d·k` fois celle de la ligne centrale (`facteurLigne`) ; la courbure
  d'une ligne `k/(1 − d·k)`. Le signe a été mesuré (intérieur = d de même signe que k), ne pas le « corriger ».
- **Le débris** touche une ligne si `|d_voiture − d_débris| < rayon + largeur/2` : avec des lignes à 10 d'écart, un
  rayon de 7 touchait aussi les lignes voisines (impossible à éviter). `danger.rayon` = 4.
- **Rubans de piste** : le sens des triangles compte (`ruban()` dans `monde3d.js`) ; à l'envers, tout le circuit est invisible
  (face arrière) et seuls les objets en 3D apparaissent.
- **Un `[hidden]` est écrasé par un `display` de classe** : la règle `[hidden] { display: none !important }` est dans `style.css`.
- **Impulsions réseau** : l'invité n'envoie que ses choix (`{ k: 'act', ligne, bonus, pit, pneu }`) ; le canal est fiable et ordonné
  pour qu'aucun choix ne se perde. L'hôte calcule tout ; l'invité applique des instantanés (`appliquer`) et lisse `dist`/`d`.
  Tout ce qui vient du réseau est borné champ par champ (`commandeValide`, `appliquer`, `normaliserCircuit`).
- **Les tests de rendu sans carte graphique** : SwiftShader donne 1 à 5 images par seconde ; utiliser `?q=basse`, une petite fenêtre,
  et ne pas conclure sur les images par seconde.
- **Circuit qui se croise** (Pont du Huit) : `projeter` cherche autour du dernier échantillon connu quand on lui donne un indice.
