// La voiture d'une course « auto battler » : elle suit le circuit toute seule, sur une
// ligne (gauche, centre, droite). Le joueur ne la conduit pas : il choisit sa ligne,
// son moment pour doubler, ses pneus, ses bonus. Du JS pur (sections 10 et 12).
//
// Une voiture est repérée par `dist` (distance parcourue le long de la ligne centrale,
// négative avant la ligne de départ) et `d` (écart latéral). Sa vitesse `v` n'est pas
// commandée : elle tend vers la vitesse permise par le virage à venir sur sa ligne,
// l'adhérence de ses pneus, l'aspiration de la voiture de devant et le trafic.

export function nouvelleVoiture(opts = {}) {
  return {
    id: opts.id ?? 'j1', nom: opts.nom ?? 'Joueur', humain: !!opts.humain, equipe: opts.equipe ?? 0,
    dist: 0, s: 0, d: 0, ligne: 0, v: 0, x: 0, y: 0, cap: 0, lacet: 0, roulis: 0, lat: 0, charge: 0, vitesse: 0, i: 0,
    pneu: opts.pneu ?? 'slick', usure: 0, chaleur: 0.2, degats: 0, crevaison: false,
    tour: -1, pos: 0,
    turbo: 0, bouclier: 0, sillage: 0, bonus: null,
    pit: false, prochainPneu: opts.pneu ?? 'slick', standT: 0, enStand: false,
    incident: null, tours: [], dernierTour: 0, meilleur: null, fini: false, tempsFin: null,
    niveau: opts.niveau ?? 'moyen', style: opts.style ?? 0.5, changeT: 0, charge2: 0,
  };
}

// Adhérence (1 = pneus neufs, chauds, sur le sec) ; `airSale` (0..1) : on suit de près dans un virage
export function adherence(v, eau, R, airSale = 0) {
  const P = R.pneus[v.pneu];
  const base = P.sec + (P.mouille - P.sec) * eau;
  const usure = 1 - R.pneus.perte * v.usure ** 1.5;
  const c = v.chaleur;
  const chaleur = 1 - 0.25 * Math.max(0, (0.45 - c) / 0.45) - 0.22 * Math.max(0, (c - 0.8) / 0.2);
  return base * usure * chaleur * (v.crevaison ? 0.6 : 1) * (1 - airSale * R.sillage.airSale);
}

// Les trois lignes d'un circuit : écarts latéraux
export const lignesDe = (piste, R) => {
  const e = Math.min(R.voiture.ecartLigne, piste.largeur / 2 - R.voiture.largeur / 2 - 1);
  return [-e, 0, e];
};

// 1 − d·k : la longueur de la ligne rapportée à celle de la ligne centrale
export const facteurLigne = (p, d) => Math.max(0.35, 1 - d * p.k);

// La vitesse que les virages à venir permettent sur la ligne `d`, avec ces pneus
// (le freinage est compté : on regarde assez loin pour pouvoir ralentir à temps)
export function vitessePermise(v, piste, d, g, R) {
  const V = R.voiture;
  const amax = V.adherence * g;
  const decel = V.frein * (0.5 + 0.5 * Math.min(1, g)) * 0.8;
  const horizon = (v.v * v.v) / (2 * decel) + 50;
  const n = piste.n;
  const depart = Math.floor(v.s / piste.pas);
  let permise = Infinity;
  for (let j = 0; j * piste.pas < horizon; j++) {
    const p = piste.pts[(depart + j) % n];
    const keff = Math.abs(p.k) / facteurLigne(p, d);
    const vc = Math.sqrt(amax / Math.max(keff, 1e-4));
    permise = Math.min(permise, Math.sqrt(vc * vc + 2 * decel * j * piste.pas));
  }
  return permise;
}
