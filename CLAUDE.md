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
- **Genre** : course de voitures arcade (famille action), avec une couche de stratégie : pneus, météo, stands. Boucle principale : tenir la trajectoire à la limite de l'adhérence, tour après tour.
- **Vue et rendu** : de dessus, pixel 2D en canvas maison (profil `pixel-2d-canvas`). Le circuit est peint pixel par pixel dans un canvas de la taille du monde (`creerDecor`), la caméra le découpe.
- **Cible** : bureau (clavier, manette) d'abord ; téléphone en paysage avec boutons à l'écran (aperçu de l'autre cible).
- **Public** : joueur occasionnel à joueur averti ; inspiré de *Corner Cutters* (Ferdi Willemse, Steam, T4 2026) : on reprend l'idée (course 2D de dessus, pneus, météo, limites de piste), pas ses circuits, ses images ni ses noms.
- **Session** : course de 1 à 20 tours (2 à 10 minutes), contre la montre contre son fantôme, records par circuit.
- **Steam** : porte ouverte (section 22) : rien de distant, manette, plein écran, toutes tailles de fenêtre. Le jeu en ligne passe par WebRTC sans serveur.
- Jeu : pas de sous-titre (section 3 des conventions).

### Palette

Sweetie 16 (GrafxKid), en entier ; `x` et `z` sont les deux couleurs de livrée d'une équipe (`LIVREES`).

| Lettre | Valeur | Rôle |
|---|---|---|
| `n` | `#1a1c2c` | nuit : fond, contours, pneus |
| `p` | `#5d275d` | prune |
| `r` | `#b13e53` | rouge : vibreurs, avertissements |
| `o` | `#ef7d57` | orange : accent, adversaires sur la carte |
| `y` | `#ffcd75` | jaune : box, bonus |
| `l` | `#a7f070` | vert clair |
| `v` | `#38b764` | vert prairie |
| `t` | `#257179` | sarcelle |
| `m` | `#29366f` | bleu nuit : asphalte mouillé |
| `u` | `#3b5dc9` | bleu roi |
| `c` | `#41a6f6` | bleu ciel |
| `s` | `#73eff7` | cyan : pluie, pilote automatique |
| `w` | `#f4f4f4` | blanc : texte, vibreurs |
| `h` | `#94b0c2` | gris bleu |
| `i` | `#566c86` | ardoise : voie des stands |
| `k` | `#333c57` | gris nuit : asphalte |
| `x` `z` | selon l'équipe | livrée |

### Échelle

- Résolution logique : 384 × 216, mode `extend`, facteur entier (5 en 1080p).
- Voiture : 12 × 7 pixels ; circuit de 34 px de large (trois voitures de front) ; un circuit fait 2 000 à 4 000 px.
- Une unité du monde = un pixel logique ; vitesse affichée = px/s × 0,9.

### Commandes

| Action | Clavier | Doigt | Manette |
|---|---|---|---|
| Accélérer | ↑ W (Z en AZERTY) | bouton ▲ | A, gâchette droite |
| Freiner, reculer | ↓ S | bouton ▼ | B, gâchette gauche |
| Tourner | ← → A D (Q D) | boutons ◀ ▶ | stick gauche, croix |
| Utiliser le bonus | Espace, E, Entrée | la case du bonus | X |
| Pneus au prochain arrêt | 1 2 3 | les trois boutons du HUD | — |
| Pause | Échap, P | bouton pause | Start |

## Stack

- Vanilla JS, modules ES, sans build ; GitHub Pages par le workflow
  `.github/workflows/pages.yml` (tests avant publication).
- Modules de game-system dans `js/lib/` (tenus à jour par
  `scripts/sync-game-system.sh` au début de chaque session) ; outils dans
  `outils/`.
- Données : `localStorage`, clés `crazyracing:partie`, `crazyracing:prefs`,
  `crazyracing:atelier` (brouillon de l'atelier), `crazyracing:gh-token` (jamais
  exporté). Export / import JSON dans les réglages.
- Dépendances : aucune.

## Structure

- `index.html` — écran titre, HUD, préparation de course, résultats, réglages, pause (dialogues rattachés au body).
- `apercu.html` — le jeu dans un cadre de téléphone (iframe à la vraie taille).
- `js/main.js` — cycle de vie : titre → préparation → course → résultats ; réglages ;
  sauvegarde (records, circuits perso) ; mise à jour ; debug.
- `js/piste.js` — géométrie d'un circuit (spline fermée, échantillons tous les 4 px,
  projection d'un point, contrôle de tracé). Pur.
- `js/voiture.js` — physique (cap ≠ vitesse, adhérence limitée), pneus (usure, chaleur),
  murs, contacts. Pur.
- `js/ia.js` — le pilote : vitesse permise par chaque virage à venir, freinage, côté libre,
  voie des stands. Sert aussi au bonus « pilote automatique ». Pur.
- `js/course.js` — les règles d'une course : grille, feux, tours, météo, stands, bonus,
  limites de piste, pénalités, classement. Pur, sans hasard hors `rng`.
- `js/render.js` — le dessin ; ne modifie jamais l'état de la course.
- `js/editeur.js` — l'éditeur de circuits (points de contrôle, vérification en direct) ; `js/circuit-code.js` — le code de partage (pur, assaini).
- `js/reseau.js` — la liaison WebRTC sans serveur (codes CRO. / CRR.) ; `js/instantane.js` — ce que l'hôte envoie à l'invité (pur, assaini).
- `js/hud.js`, `js/entrees.js` — le HUD en DOM ; clavier, manette et doigt → commande.
- `js/palette.js`, `js/sprites-data.js`, `js/data/` (réglages, circuits) — la donnée.
- `js/design-store.js` — le contenu publié par l'atelier (`assets/design/`)
  plus le brouillon de ce navigateur.
- `labo.html`, `js/labo.js` — le labo (section 16).
- `atelier.html`, `js/atelier.js`, `css/atelier.css` — l'atelier (section 17).
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

<!-- Règles de .claude/conventions-jeu.md qui ne s'appliquent pas ici, et pourquoi. -->

## Ce qui a été retiré

<!-- | Quoi | Version | Pourquoi (ce que ça coûtait) | -->

## Pièges connus

- **En ligne** : l'hôte calcule tout (`avancerCourse` avec les commandes de l'invité) ; l'invité ne fait
  tourner aucune règle, il applique des instantanés (`appliquer`) et lisse les positions. Tout ce qui
  vient du réseau est borné champ par champ (`commandeValide`, `appliquer`, `normaliserCircuit`).
  Un `[hidden]` est écrasé par un `display` de classe : la règle `[hidden] { display: none !important }`
  est dans `style.css`.
- **Circuit qui se croise** (Pont du Huit) : `projeter` cherche autour du dernier échantillon connu
  (`v.i`), jamais partout, sinon la voiture saute de branche au croisement. Toute téléportation
  (debug, tests) doit mettre `v.i` à jour.
- **Le frein maintenu à l'arrêt ne recule que si la commande porte `recul`** : sans cela, les voitures
  à l'arrêt (feux, stand) reculaient toutes seules.
- **Limites de piste** : `v.tour >= 0` seulement (la grille est derrière la ligne), sinon des
  avertissements partent au départ.
- **Un circuit se vérifie** (`verifierPiste`) : rayon minimal, croisements, tronçons qui se frôlent.
  Les tests l'exigent des circuits fournis ; l'éditeur l'affiche.
