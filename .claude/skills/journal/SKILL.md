---
name: journal
description: Écrire le message de commit et la mise à jour de CLAUDE.md de Crazy Racing — une phrase qui dit ce qui a changé pour le joueur ET, pour une règle, ce que ça coûtait avant. À utiliser à chaque commit d'une décision, et pour rattraper la dérive entre le document et la donnée.
---

# Écrire ce qui a changé, et pourquoi

Le dépôt tient sa mémoire à deux endroits : les messages de commit et
`CLAUDE.md`. Les deux sont en français, au présent, et disent une décision,
jamais une opération.

## Le message de commit

Une ligne, la décision vue du jeu :

> Les loups reculent quand on fuit
> Le score se joue carte par carte, et la figure se lit en grand
> Six systèmes retirés : il ne reste que le type, la main et le seuil
> Écran noir sur iOS : la police était chargée depuis un CDN

Pas de « refactor », « fix », « update CSS », de préfixe de type, de numéro
de ticket, ni d'identifiant de modèle.

## La mise à jour de `CLAUDE.md`

Une entrée complète a trois parties :
1. **La règle**, en majuscules quand elle commande les autres.
2. **Ce qu'elle a coûté** : le bug, la mesure, ou le nombre de choses à
   tenir en tête (« mesuré à 51 % du plateau hors écran »).
3. Pour un retrait : la ligne du tableau « Ce qui a été retiré ».

Rien de ce qui n'existe pas n'est décrit au présent ; ce qui est retiré part
dans `docs/archives/`.

## Rattraper la dérive

À chaque passage, vérifie que les chiffres cités dans `CLAUDE.md` sont ceux
de `data/` et des tests, et corrige le document s'ils ont bougé. Si une
leçon vaut pour tous les jeux, propose-la pour `LECONS.md` de game-system.
