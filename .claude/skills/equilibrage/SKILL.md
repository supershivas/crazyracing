---
name: equilibrage
description: Mesurer une décision d'équilibrage de Crazy Racing avant de la prendre — difficulté, prix, dégâts, probabilités, durées, écart entre un joueur appliqué et un maladroit. À utiliser DÈS qu'un chiffre du jeu doit bouger, et avant de l'écrire où que ce soit.
---

# Un chiffre se mesure, il ne se choisit pas

Dans Frères de la Côte, chaque échelle choisie à l'œil a dû être refaite ;
chaque changement du paquet a obligé à remesurer toutes les résistances.
Les règles de ce jeu sont pures (section 10 des conventions) : c'est ce qui
rend la mesure possible.

## Le protocole

1. **La question en une phrase, sous la forme d'un écart** : « combien de
   victoires sur 100 en plus, avec / sans ? », jamais « est-ce trop fort ? ».
2. **Un simulateur jetable** dans le scratchpad (jamais commité), qui importe
   directement les règles (`js/game.js` ou équivalent) et joue des parties
   entières sans navigateur.
3. **Deux politiques de jeu au moins** : un joueur appliqué (qui choisit le
   mieux qu'il peut) et un maladroit (qui joue au hasard ou au plus simple).
   Si l'écart se referme, le joueur exécute au lieu de choisir : c'est le
   système qu'il faut revoir, pas le test.
4. **Mêmes graines des deux côtés** (`createRng(graine)`). Un écart mesuré sur
   des graines différentes ne mesure rien. 100 parties pour comparer deux
   politiques, 2 000 pour une distribution.
5. **La distribution, pas la moyenne** : p25, médiane, p75, et le taux de
   réussite par palier. Une moyenne cache ce qu'on cherche.
6. **Trois familles de graines** (par exemple ×7919, ×104729, ×31) : si leurs
   résultats s'écartent de plus d'un point, l'échantillon est trop petit.

## Après la mesure

Écris le chiffre dans `data/` (jamais dans la logique), **le test qui le
tient** (dans `test/`, il rejoue la mesure en petit et échoue si l'écart
sort de la fourchette), et la ligne de `CLAUDE.md` qui l'annonce **avec la
mesure**. Les trois doivent dire la même chose : la dérive entre la donnée
et le document est le défaut le plus fréquent.

Un seuil de test qui casse est une décision à prendre avec Jérôme, pas un
test à assouplir.
