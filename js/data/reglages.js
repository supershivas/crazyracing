// Les nombres du jeu : aucun nombre magique dans la logique (section 12).
// L'atelier peut les régler ; la version publiée est lue au lancement dans
// assets/design/reglages.json. Unités : pixels du monde (1 px ≈ 5 cm) et secondes.
export const REGLAGES = {
  voiture: {
    vmax: 200,           // vitesse de pointe à plat, sans aspiration
    acc: 120,            // accélération (px/s²)
    frein: 280,          // décélération maximale
    adherence: 330,      // accélération latérale tenue avec des pneus neufs et chauds, sur le sec
    largeur: 7, longueur: 13,
    ecartLigne: 10,      // écart latéral des lignes gauche et droite
    laterale: 24,        // vitesse de changement de ligne (px/s)
    coutLigne: 0.06,     // vitesse perdue pendant un changement de ligne
  },
  sillage: {
    min: 14,             // en dessous, on est collé : on suit sans gagner
    portee: 75,          // distance d'aspiration
    gain: 0.16,          // vitesse de pointe gagnée à pleine charge
    gainAcc: 0.8,        // accélération gagnée à pleine charge
    montee: 0.8,         // charge par seconde dans le sillage
    descente: 0.45,      // charge perdue par seconde hors du sillage
    lateral: 8,          // écart latéral toléré
    airSale: 0.1,        // adhérence perdue en suivant de près dans un virage
    bonus: 2,            // le bonus « sillage » multiplie portée et gain par ce facteur
  },
  pneus: {
    // adhérence selon le pneu : { sec, mouillé } (interpolée selon l'eau sur la piste)
    slick: { sec: 1.0, mouille: 0.42, usure: 1.0 },
    inter: { sec: 0.88, mouille: 0.86, usure: 0.85 },
    pluie: { sec: 0.72, mouille: 1.0, usure: 0.7, chaud: 1.9 }, // « chaud » : usure sur le sec
    usureBase: 0.0022,   // par seconde
    usureVirage: 0.0045, // en plus, à pleine charge latérale (au carré)
    usureCorde: 0.5,     // sur la ligne intérieure, l'usure monte de ce facteur
    perte: 0.42,         // adhérence perdue à usure 1 (courbe en usure^1,5)
  },
  meteo: { vitesseEau: 0.03, sechage: 0.025, periodeVariable: 80 },
  incidents: {
    base: 0.0005,        // risque par seconde d'un tête-à-queue
    usure: 0.05,         // en plus, par seconde, à usure 1 (au-dessus de 0,7)
    mouille: 0.03,       // en plus, slicks sous la pluie
    duree: 2.4,          // un tête-à-queue
    ralenti: 0.2,        // vitesse conservée
    crevaison: 0.4,      // part des incidents d'usure qui sont des crevaisons
  },
  danger: { premier: 12, intervalle: 20, duree: 14, rayon: 4, avance: 260 }, // débris sur la piste
  degats: { perte: 0.12 },
  stand: { duree: 2.6, vitesseMax: 55, largeur: 18, avant: 60, apres: 70 },
  bonus: { nombre: 7, rayon: 7, retour: 9, turbo: 2.4, turboPousse: 0.28, bouclier: 8, sillage: 7, reparation: 0.35 },
  course: { feux: 3, grille: 10, ecart: 22, arrivee: 6 },
  ia: { niveaux: { facile: 0.93, moyen: 1.0, difficile: 1.06 }, decision: 0.35 },
};
