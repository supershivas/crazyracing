---
name: variante-labo
description: Ajouter un sujet ou une variante au Labo de Crazy Racing pour comparer avant de choisir, puis brancher la variante retenue dans le jeu. À utiliser dès que Jérôme hésite entre plusieurs rendus, réglages, animations ou écrans.
---

# Comparer dans le labo, puis adopter

Section 16 des conventions. Le labo **montre** ; il ne modifie jamais le
contenu du jeu (c'est l'atelier).

## Ajouter

1. Dans `js/labo.js`, tableau `GROUPES` : ajoute le sujet (dans le bon
   groupe) ou la variante. **A est toujours l'actuelle** (`status:
   'actuelle'`), les suivantes B, C… avec un titre et une phrase qui dit ce
   qu'elle change.
2. Le rendu utilise **les mêmes modules que le jeu** (rendu, sprites, son,
   règles), avec des réglages modifiés : ce qu'on voit est ce que le jeu
   dessinera. Pas de copie du code du jeu dans le labo.
3. Données d'exemple en dur ; le labo ne lit ni n'écrit la sauvegarde.
4. Une animation rend une fonction de nettoyage (arrêter la boucle).
   Une variante qui montre **un moment qui se déroule** (assaut, journée, sort,
   animation en plusieurs temps) se pilote avec `js/lib/labo-timeline.js` :
   `mountTimeline(stage, { duree, etapes, onTime })` pose en bas une frise
   (jouer, pause, curseur, saut d'étape en étape, vitesse) ; le dessin est une
   fonction pure du temps `t`, pour qu'on puisse aller à n'importe quel instant.
5. **Tiens le journal de l'accueil** : une entrée dans `js/labo-journal.js`
   pour la version en cours (la plus récente en haut ; `items` avec `genre`
   `nouveau` / `mis-a-jour` / `retire`, `texte`, et `ref: 'sujet-Lettre'` qui
   mène à la variante), et `depuis: 'X.Y.Z'` sur la variante ajoutée ou
   changée. L'accueil du labo (`#accueil`) en tire ce qui est nouveau depuis
   la dernière visite, les sujets sans variante en jeu (« à trancher ») et
   l'index. Un lien cassé s'y voit (⚠) : vérifie les `ref` après chaque
   réordonnancement des variantes (les lettres changent).
6. Vérifie : `node outils/captures.mjs --page labo.html`, et donne l'adresse
   avec l'ancre (`labo.html#sujet-B`).

## Adopter

Quand Jérôme choisit : marque la variante `status: 'retenue'`, branche-la
dans le jeu (données ou code), passe l'ancienne A en `ancienne` ou retire-la,
remets la retenue en A (A est toujours l'actuelle ; corrige alors les `ref` du
journal), ajoute l'entrée du journal, et incrémente la version (le joueur voit
la différence).

## Périmé

Quand le jeu change et qu'une maquette du labo ne lui ressemble plus
(interface, couleurs, règle), ne la laisse pas : refais-la, ou passe-la en
`ancienne` avec une note qui dit depuis quelle version, et note-le au journal.
