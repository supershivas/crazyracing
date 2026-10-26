---
description: Passe tous les instruments sur Crazy Racing avant de livrer (tests, captures des deux cibles, audit d'écran, lisibilité) et rend un verdict. Ne corrige rien sans accord.
---

# Vérifier avant de livrer

Section 19 des conventions. Lance, dans l'ordre, et note chaque résultat :

1. `for f in $(git diff --name-only HEAD -- '*.js' '*.mjs'); do node --input-type=module --check < "$f"; done`
2. `node outils/test-run.mjs`
3. `node outils/captures.mjs --cibles telephone,bureau` (et les pages labo /
   atelier si elles ont changé) — puis **regarde les captures**.
4. `node outils/audit-ecran.mjs` si du DOM ou du CSS a changé.
5. `node outils/lisibilite.mjs` si une couleur ou un sprite a changé.
6. `version.json` et `CHANGELOG.md` à jour si le joueur voit une différence,
   puis `node outils/stamp-version.mjs`.

Verdict en quelques lignes : ce qui passe, ce qui échoue (avec la sortie),
et ce qu'il faut corriger avant de pousser.
