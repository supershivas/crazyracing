// Le journal du labo : ce qui a changé, version par version, et où le voir (la page d'accueil du labo, js/lib/labo-shell.js).
// Une entrée par version qui touche au labo, la plus récente en haut. `ref` : « sujet-Lettre » (la lettre est celle de la variante,
// A étant l'actuelle) ou « sujet ». `genre` : 'nouveau', 'mis-a-jour' ou 'retire' (facultatif).
// À chaque changement du labo : une entrée ici, et `depuis: 'X.Y.Z'` sur les variantes ajoutées ou changées (labo.js).
export const JOURNAL = [
  { version: '0.1.0', date: '2026-01-01', items: [
    { genre: 'nouveau', texte: 'La planche d\'échelle', ref: 'echelle-A' },
  ] },
];
