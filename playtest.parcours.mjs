// Le parcours du harnais de playtest : node outils/playtest/run.mjs --aide
export default {
  cible: 'bureau',
  demarrer: async ({ page }) => { await page.click('#m-course'); await page.click('#c-partir'); },
  etapes: [
    { nom: 'feux', texte: 'Les cinq feux s\'allument, la grille est immobile.', faire: async ({ attendre }) => { await attendre(1500); } },
    { nom: 'depart', texte: 'Le joueur accélère tout droit.', faire: async ({ touche }) => { await touche('ArrowUp', 3500); } },
    { nom: 'virage', texte: 'Il tourne à droite en gardant les gaz.', faire: async ({ touche }) => { await touche('ArrowRight', 1200); } },
    { nom: 'pilote', texte: 'Le pilote automatique prend le volant.', faire: async ({ jeu, attendre }) => { await jeu('autopilote'); await attendre(4000); } },
  ],
};
