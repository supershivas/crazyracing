---
name: nouvelle-regle
description: Ajouter, changer ou RETIRER une règle ou un système de Crazy Racing — une mécanique, un type d'objet, un ennemi, une ressource, une condition de victoire. Impose la question du retrait avant celle de l'ajout, le partage donnée/code et le test qui mesure la décision.
---

# Avant d'ajouter, demander ce qu'on retire

Frères de la Côte est arrivé à sept systèmes à tenir en tête devant un
écran de 375 px ; chacun était défendable seul, aucun ne l'était ensemble,
et il a fallu en retirer six. Le biais par défaut est donc le retrait.
**Un système qu'il faut rattraper par une exception est un système à
retirer, pas à corriger.**

## Les questions, dans l'ordre

1. **A-t-elle déjà été essayée et retirée ?** Lis « Ce qui a été retiré »
   dans `CLAUDE.md` et `docs/archives/`. Ne reconstruis pas ce qui a été jeté
   sans le dire à Jérôme.
2. **Respecte-t-elle la bible ?** Piliers et « Ce que le jeu refuse » de
   `DESIGN.md`. En cas de doute, l'agent `gardien-du-ton`.
3. **La boucle tient-elle encore avec trois éléments ?** (agent
   `game-designer`)
4. **Est-ce de la donnée ou du code ?** Un nouvel élément d'un type existant
   → une entrée dans `data/`, zéro ligne de code. Si ça demande du code, ce
   n'est pas du contenu : dis-le, et justifie la nouvelle règle.
5. **Qu'est-ce qu'on retire en échange ?** Propose-le, même si la réponse
   est « rien ».

## Les contraintes qui ne se négocient pas

- Les règles restent **pures** : ni `Math.random`, ni `Date.now`, ni DOM
  dans le module des règles (un test le vérifie).
- **Un ordre impossible se refuse à voix haute** : la fonction rend la
  raison, l'écran la montre.
- **Un objet est dans exactement une zone** (pioche, main, inventaire…) :
  déplacer, c'est retirer ET poser, dans le même geste de code.
- Si la règle touche un chiffre : skill `equilibrage`.
- Si elle change la sauvegarde : nouvelle version d'entrée et sa migration
  (`js/lib/save.js`), et préviens Jérôme avant de pousser.

## Ce qu'il faut écrire, à chaque fois

1. La donnée, ou la règle.
2. **Le test qui mesure la décision** (ce que la règle est censée changer,
   chiffré), pas seulement l'existence d'une clé.
3. La section de `CLAUDE.md` qui la décrit, **avec sa raison**. Et, pour un
   retrait, la ligne du tableau « Ce qui a été retiré » avec ce que ça coûtait.
4. `DESIGN.md` si l'intention change ; `ROADMAP.md` si c'était une entrée.
