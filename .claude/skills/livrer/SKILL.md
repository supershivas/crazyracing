---
name: livrer
description: Livrer une version de Crazy Racing — vérifier, versionner, estampiller, pousser sur main, et donner les DEUX URL (le jeu et l'aperçu), sans attendre qu'on les demande.
---

# Livrer : vérifier, versionner, deux adresses

1. **Vérifier** (section 19) : `node outils/test-run.mjs`,
   `node outils/captures.mjs` (les deux cibles, sans erreur), et selon le
   changement `node outils/audit-ecran.mjs`, `node outils/lisibilite.mjs`.
   Regarde les captures.
2. **Versionner** (section 2) si le joueur voit une différence : correctif
   ou mineur dans `version.json` (date du jour, 1 à 3 lignes lisibles par
   un joueur dans `changes`) et la même section en tête de `CHANGELOG.md`.
3. **Estampiller** : `node outils/stamp-version.mjs` (sinon le cache de
   GitHub Pages mélange anciens et nouveaux modules pendant dix minutes).
4. **Committer** en français, la décision vue du joueur (skill `journal`),
   et **pousser sur `main`**. Si le changement casse les sauvegardes
   existantes, demande d'abord.
5. **Donner les deux URL**, toujours :
   - le jeu : https://supershivas.github.io/crazyracing/
   - l'aperçu : https://supershivas.github.io/crazyracing/apercu.html
   (et le labo ou l'atelier s'ils ont changé). Avec une seule adresse, on
   ouvre le jeu en 1 400 px de large, tout y tient, et l'on ne voit rien.
6. Rappelle que GitHub Pages peut mettre une à dix minutes à servir la
   nouvelle version (le workflow passe d'abord les tests).
