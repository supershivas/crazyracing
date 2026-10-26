// Les nombres du jeu : aucun nombre magique dans la logique (section 12).
// L'atelier peut les régler ; la version publiée est lue au lancement dans
// assets/design/reglages.json. Unités : pixels logiques et secondes.
export const REGLAGES = {
  voiture: {
    acc: 150,            // poussée à pleins gaz (px/s²)
    vmax: 200,           // vitesse de pointe à plat
    frein: 300,          // décélération au frein
    adherence: 330,      // accélération latérale tenue avec des pneus neufs et chauds, sur le sec
    braquage: 4.6,       // vitesse de rotation maximale (rad/s)
    hors: { vmax: 0.5, adherence: 0.55, frottement: 0.9 }, // sur l'herbe
    rayon: 5,            // rayon de collision
  },
  pneus: {
    // adhérence selon le pneu : { sec, mouillé } (interpolée selon l'eau sur la piste)
    slick: { sec: 1.0, mouille: 0.42, usure: 1.0 },
    inter: { sec: 0.88, mouille: 0.86, usure: 0.85 },
    pluie: { sec: 0.72, mouille: 1.0, usure: 0.7, chaud: 1.9 }, // « chaud » : usure sur le sec
    usureBase: 0.0028,   // par seconde
    usureDerapage: 0.00016,
    usureFrein: 0.0005,
    perte: 0.42,         // adhérence perdue à usure 1 (courbe en usure^1,5)
  },
  meteo: { vitesseEau: 0.03, sechage: 0.025, periodeVariable: 80 },
  degats: { vitesseMin: 45, perte: 0.12, mur: 0.4 }, // un choc rapide abîme ; à 1, vitesse max -12 %
  limites: { marge: 2, avertissementsAvantPenalite: 3, penalite: 5, penaliteCollision: 3 }, // secondes
  mur: { marge: 26, rebond: 0.35, perte: 0.25 },
  stand: { duree: 2.6, vitesseMax: 30, largeur: 18, avant: 30, apres: 70 },
  bonus: { nombre: 7, rayon: 9, retour: 9, turbo: 2.2, turboPousse: 0.7, pilote: 6, bouclier: 8, reparation: 0.35 },
  course: { feux: 3, grille: 10, ecart: 22, arrivee: 6 },
  ia: { lookAvant: 0.55, niveaux: { facile: 0.82, moyen: 0.93, difficile: 1.0 } },
};
