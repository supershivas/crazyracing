// La palette du jeu : le SEUL endroit où vivent ses couleurs (section 5 des
// conventions). Une lettre par couleur : c'est l'alphabet des sprites.
// Sweetie 16 (GrafxKid), en entier. Deux lettres de plus, `x` et `z`, sont les
// deux couleurs de livrée : chaque équipe les remplace (voir LIVREES).
export const PALETTE = {
  n: '#1a1c2c', // nuit — fond, contours, pneus
  p: '#5d275d', // prune
  r: '#b13e53', // rouge brique
  o: '#ef7d57', // orange
  y: '#ffcd75', // jaune sable
  l: '#a7f070', // vert clair
  v: '#38b764', // vert prairie
  t: '#257179', // sarcelle
  m: '#29366f', // bleu nuit
  u: '#3b5dc9', // bleu roi
  c: '#41a6f6', // bleu ciel
  s: '#73eff7', // cyan
  w: '#f4f4f4', // blanc
  h: '#94b0c2', // gris bleu
  i: '#566c86', // ardoise
  k: '#333c57', // gris nuit
  x: '#b13e53', // livrée 1 (par défaut, rouge)
  z: '#ffcd75', // livrée 2 (par défaut, jaune)
};

// Les équipes : deux couleurs chacune
export const LIVREES = [
  { x: PALETTE.r, z: PALETTE.y },
  { x: PALETTE.u, z: PALETTE.w },
  { x: PALETTE.v, z: PALETTE.n },
  { x: PALETTE.o, z: PALETTE.m },
  { x: PALETTE.s, z: PALETTE.p },
  { x: PALETTE.y, z: PALETTE.k },
  { x: PALETTE.p, z: PALETTE.l },
  { x: PALETTE.w, z: PALETTE.r },
];

// Les rôles, lus par le CSS (variables --jeu-*) et par le rendu
export const ROLES = {
  fond: PALETTE.n,
  ombre: PALETTE.k,
  encre: PALETTE.w,
  accent: PALETTE.o,
  asphalte: PALETTE.i,
  asphalteClair: PALETTE.h,
  bordure1: PALETTE.r,
  bordure2: PALETTE.w,
  eau: PALETTE.c,
};
