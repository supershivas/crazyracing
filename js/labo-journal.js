// Le journal du labo : ce qui a changé, version par version, et où le voir (la page d'accueil du labo, js/lib/labo-shell.js).
// Une entrée par version qui touche au labo, la plus récente en haut. `ref` : « sujet-Lettre » (la lettre est celle de la variante,
// A étant l'actuelle) ou « sujet ». `genre` : 'nouveau', 'mis-a-jour' ou 'retire' (facultatif).
// À chaque changement du labo : une entrée ici, et `depuis: 'X.Y.Z'` sur les variantes ajoutées ou changées (labo.js).
export const JOURNAL = [
  { version: '0.4.0', date: '2026-10-26', items: [
    { genre: 'nouveau', texte: 'La lumière : jour, soir, nuit, nuit sous la pluie', ref: 'lumiere-A' },
    { genre: 'nouveau', texte: 'L\'aspiration : gain de vitesse derrière une voiture', ref: 'sillage-A' },
    { genre: 'mis-a-jour', texte: 'La météo, en 3D', ref: 'meteo-A' },
    { genre: 'retire', texte: 'La planche d\'échelle et les sprites (plus de dessins en pixels)' },
  ] },
];
