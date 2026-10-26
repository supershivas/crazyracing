// Les règles d'une course : grille, feux, tours, météo, stands, bonus, limites
// de piste, pénalités, classement. Du JS pur, sans DOM, sans hasard ni horloge
// du navigateur (sections 10 et 12) : même graine, mêmes commandes → même course.
import { createRng } from './lib/rng.js?v=0.3.0';
import { construirePiste, projeter, pointA } from './piste.js?v=0.3.0';
import { nouvelleVoiture, pasVoiture, contreMur, contacts, adherence } from './voiture.js?v=0.3.0';
import { piloteIA } from './ia.js?v=0.3.0';
import { REGLAGES } from './data/reglages.js?v=0.3.0';

export const METEOS = ['sec', 'humide', 'pluie', 'variable'];
export const PNEUS = ['slick', 'inter', 'pluie'];
export const TYPES_BONUS = ['turbo', 'pilote', 'bouclier', 'reparation'];
const EAU = { sec: 0, humide: 0.4, pluie: 0.9 };
const TAU = Math.PI * 2;
const NOMS_IA = ['Rossi', 'Kimura', 'Duval', 'Okafor', 'Lindqvist', 'Moreau', 'Vargas', 'Haas', 'Nakamura', 'Silva', 'Brandt', 'Ito'];

export const choixPneu = eau => (eau > 0.65 ? 'pluie' : eau > 0.22 ? 'inter' : 'slick');

// L'eau vers laquelle tend la piste à l'instant t
export function eauCible(c, t) {
  if (c.meteo.type !== 'variable') return EAU[c.meteo.type] ?? 0;
  const x = Math.sin(TAU * t / c.R.meteo.periodeVariable + c.meteo.phase);
  return Math.max(0, Math.min(1, 0.55 * x + 0.35));
}

// Rattache le circuit construit (non sérialisé) à la course
function rattacher(c, def) {
  Object.defineProperty(c, 'piste', { value: construirePiste(def), enumerable: false, writable: true });
  return c;
}

// def : le circuit ; options : { mode: 'course' | 'chrono', tours, meteo, voitures: [{ id, nom, humain, pneu, niveau, style }],
//                                bonus: bool, graine, R, fantome }
export function nouvelleCourse(def, options = {}) {
  const R = options.R ?? REGLAGES;
  const rng = createRng(options.graine ?? 1);
  const c = {
    mode: options.mode ?? 'course',
    def, tours: options.tours ?? def.tours ?? 3,
    meteo: { type: options.meteo ?? 'sec', phase: rng.range(0, TAU) },
    eau: 0, t: 0, phase: 'feux', feux: options.mode === 'chrono' ? 1.5 : R.course.feux, fin: 0,
    voitures: [], bonus: [], trace: [], rng: 0, classement: null,
    fantome: options.fantome ?? null, fantomeLu: null, enregistrement: [], meilleurTour: null, nouveauRecord: false,
  };
  Object.defineProperty(c, 'R', { value: R, enumerable: false, writable: true });
  rattacher(c, def);
  const L = c.piste.longueur;
  c.trace = new Array(c.piste.n).fill(0);
  c.eau = eauCible(c, 0);

  const liste = options.voitures ?? [{ id: 'j1', nom: 'Vous', humain: true }];
  liste.forEach((o, k) => {
    const rang = c.mode === 'chrono' ? 0 : k;
    const cote = rang % 2 ? 1 : -1;
    const avant = R.course.ecart * (Math.floor(rang / 2) + 1);
    const p = c.mode === 'chrono' ? pointA(c.piste, L - 10, 0) : pointA(c.piste, L - avant, cote * c.piste.largeur * 0.22);
    const v = nouvelleVoiture({ ...o, x: p.x, y: p.y, cap: p.cap, equipe: o.equipe ?? Math.floor(k / 2), pneu: o.pneu ?? choixPneu(c.eau) });
    v.niveau = o.niveau ?? 'moyen';
    v.style = o.style ?? rng();
    if (c.mode === 'chrono') { v.vx = Math.cos(p.cap) * 80; v.vy = Math.sin(p.cap) * 80; }
    v.i = projeter(c.piste, v.x, v.y).i;
    const pr = projeter(c.piste, v.x, v.y, v.i);
    v.s = pr.s; v.d = pr.d; v.dist = v.s - L;
    c.voitures.push(v);
  });

  if (options.bonus) {
    const n = R.bonus.nombre;
    for (let k = 0; k < n; k++) {
      const s = L * (0.08 + 0.9 * (k + rng.range(0.1, 0.9)) / n);
      const p = pointA(c.piste, s, rng.range(-0.3, 0.3) * c.piste.largeur);
      c.bonus.push({ x: p.x, y: p.y, s, type: rng.weighted([{ v: 'turbo', w: 4 }, { v: 'bouclier', w: 2 }, { v: 'pilote', w: 1.5 }, { v: 'reparation', w: 2 }]), retour: 0 });
    }
  }
  c.rng = rng.state;
  return c;
}

// Recrée la course à partir d'un état relu (sauvegarde ou réseau)
export function recharger(etat, def, R = REGLAGES) {
  Object.defineProperty(etat, 'R', { value: R, enumerable: false, writable: true });
  return rattacher(etat, def);
}

const dansZoneStand = (c, s, d) => {
  const sp = s > c.piste.longueur / 2 ? s - c.piste.longueur : s;
  const S = c.R.stand, demi = c.piste.largeur / 2;
  return sp >= -S.avant && sp <= S.apres && d >= demi - 1 && d <= demi + S.largeur + 2;
};
const abscisseStand = (c, s) => (s > c.piste.longueur / 2 ? s - c.piste.longueur : s);
const CENTRE_BOX = 22;

// Eau ressentie en un point : la trajectoire de course sèche d'abord
function eauLocale(c, i, d) {
  const demi = c.piste.largeur / 2;
  return Math.abs(d) < demi * 0.55 ? c.eau * (1 - 0.7 * c.trace[i]) : c.eau;
}

export function classer(c) {
  const finis = c.voitures.filter(v => v.fini).sort((a, b) => a.tempsFin - b.tempsFin);
  const autres = c.voitures.filter(v => !v.fini).sort((a, b) => b.dist - a.dist);
  const ordre = [...finis, ...autres];
  ordre.forEach((v, k) => { v.pos = k + 1; });
  return ordre;
}

// commandes : { [id]: { gaz, frein, volant, bonus (impulsion), pneu } } pour les voitures humaines
// → liste des événements de ce pas
export function avancerCourse(c, dt, commandes = {}) {
  const ev = [];
  const R = c.R, piste = c.piste, L = piste.longueur, demi = piste.largeur / 2;

  if (c.phase === 'feux') {
    const avant = Math.ceil(c.feux);
    c.feux -= dt;
    if (Math.ceil(c.feux) !== avant && c.feux > 0) ev.push({ type: 'feu', reste: Math.ceil(c.feux) });
    if (c.feux <= 0) { c.phase = 'course'; ev.push({ type: 'depart' }); }
  } else {
    c.t += dt;
  }
  const libre = c.phase !== 'feux';

  // Météo : l'eau suit la prévision ; la trace de course sèche, la pluie l'efface
  const cible = eauCible(c, c.t);
  c.eau += Math.max(-R.meteo.sechage * dt, Math.min(R.meteo.vitesseEau * dt, cible - c.eau));
  if (c.eau > 0.15) for (let i = 0; i < c.trace.length; i++) c.trace[i] = Math.max(0, c.trace[i] - dt * c.eau * 0.02);

  const rng = createRng(1);
  rng.setState(c.rng);

  const tous = c.voitures;
  for (const v of tous) {
    const proj = projeter(piste, v.x, v.y, v.i);
    v.i = proj.i; v.s = proj.s; v.d = proj.d;
    const dedans = dansZoneStand(c, proj.s, proj.d);
    const sol = dedans ? 'stand' : Math.abs(proj.d) > demi + R.limites.marge ? 'herbe' : 'piste';
    const eau = eauLocale(c, proj.i, proj.d);
    const g = adherence(v, eau, sol === 'herbe' ? 'herbe' : 'piste', R);

    // Qui conduit ?
    const cmdH = commandes[v.id];
    let cmd;
    const IA = !v.humain || v.fini || v.pilote > 0;
    if (!libre) cmd = { gaz: 0, frein: 0, volant: 0 };
    else if (!IA) cmd = cmdH ?? { gaz: 0, frein: 0, volant: 0 };
    else {
      // Un pilote qui veut s'arrêter au stand : usure, crevaison, mauvais pneus pour la météo
      if (!v.humain && !v.fini && v.tour >= 0 && v.tour < c.tours - 1 && !v.pitVoulu) {
        const idee = choixPneu(c.eau);
        if (v.usure > 0.62 || v.crevaison || (idee !== v.pneu && Math.abs(c.eau - ({ slick: 0, inter: 0.45, pluie: 0.9 }[v.pneu])) > 0.5)) { v.pitVoulu = true; v.prochainPneu = idee; }
      }
      const sp = abscisseStand(c, proj.s);
      // Une seule voiture à la fois dans la voie : on s'y engage à l'entrée, si elle est libre
      if (v.pitVoulu && !v.engage && sp > -R.stand.avant - 50 && sp < -R.stand.avant + 15 && !tous.some(o => o !== v && o.enStand)) v.engage = true;
      if (v.engage && sp > CENTRE_BOX + 12) v.engage = false; // box manqué : on repasse au prochain tour
      const stand = v.engage
        ? { ds: CENTRE_BOX - sp, dedans, service: dedans && Math.abs(sp - CENTRE_BOX) < 8 && v.d > demi } : null;
      cmd = piloteIA(v, { piste, R, g, voitures: tous, stand });
      if (v.humain && v.pilote > 0) v.pilote -= dt;
    }

    // Bonus : une impulsion de l'humain, ou le choix de l'IA sur une ligne droite
    const veutBonus = !libre ? false : !v.humain ? !!v.bonus && v.bonus !== 'pilote' && Math.abs(piste.pts[(Math.floor(proj.s / piste.pas) + 8) % piste.n].k) < 0.004 : !!cmdH?.bonus;
    if (veutBonus && v.bonus) {
      const b = v.bonus; v.bonus = null;
      if (b === 'turbo') v.turbo = R.bonus.turbo;
      else if (b === 'pilote') v.pilote = R.bonus.pilote;
      else if (b === 'bouclier') v.bouclier = R.bonus.bouclier;
      ev.push({ type: 'bonus-use', id: v.id, bonus: b });
    }
    if (cmdH?.pneu && PNEUS.includes(cmdH.pneu)) v.prochainPneu = cmdH.pneu;

    // Arrêt au stand : à l'arrêt dans le box, on change les pneus
    const sp = abscisseStand(c, proj.s);
    const dansBox = dedans && Math.abs(sp - CENTRE_BOX) < 9 && proj.d > demi;
    v.enStand = dedans && proj.d > demi;
    if (libre && dansBox && v.vitesse < 9 && !v.fini) {
      v.standT += dt;
      cmd = { gaz: 0, frein: 1, volant: 0 };
      if (v.standT >= R.stand.duree) {
        v.pneu = v.prochainPneu; v.usure = 0; v.chaleur = 0.3; v.degats = 0; v.crevaison = false; v.standT = 0; v.pitVoulu = false; v.engage = false;
        ev.push({ type: 'stand', id: v.id, pneu: v.pneu });
      }
    } else if (!dansBox) v.standT = 0;

    // Coincé dans un mur ou dans l'herbe : les commissaires remettent la voiture en piste
    v.immobile = libre && !dansBox && !v.fini && v.vitesse < 4 ? (v.immobile ?? 0) + dt : 0;
    if (v.immobile > 5) {
      const q = pointA(piste, proj.s, 0);
      v.x = q.x; v.y = q.y; v.cap = q.cap; v.vx = 0; v.vy = 0; v.immobile = 0; v.engage = false; v.off = 0;
      ev.push({ type: 'remise', id: v.id });
    }
    const r = pasVoiture(v, cmd, dt, { sol: sol === 'herbe' ? 'herbe' : 'piste', eau, R });
    if (r.derapage && v.humain) ev.push({ type: 'derapage', id: v.id });

    // Le mur de pneus
    const p2 = projeter(piste, v.x, v.y, proj.i);
    const side = dansZoneStand(c, p2.s, Math.max(0, p2.d)) && p2.d > 0 ? R.stand.largeur : 0;
    const choc = contreMur(v, p2, piste, demi + R.mur.marge + side, R);
    if (choc > 30) {
      ev.push({ type: 'mur', id: v.id, vitesse: choc });
      if (choc > R.degats.vitesseMin * 1.8 && v.bouclier <= 0 && !v.crevaison && rng() < 0.25) { v.crevaison = true; ev.push({ type: 'crevaison', id: v.id }); }
    }
    const p3 = projeter(piste, v.x, v.y, p2.i);
    // Les tours : on franchit la ligne dans un sens ou dans l'autre
    const avant = v.s;
    v.i = p3.i; v.d = p3.d; v.s = p3.s;
    if (avant > L * 0.75 && p3.s < L * 0.25) {
      v.tour++;
      if (v.tour === 0) {
        if (c.mode === 'chrono') { v.dernierTour = c.t; c.enregistrement = []; }
      } else if (v.tour > 0 && !v.fini) {
        const temps = c.t - v.dernierTour;
        v.tours.push(temps); v.dernierTour = c.t;
        if (v.meilleur == null || temps < v.meilleur) v.meilleur = temps;
        ev.push({ type: 'tour', id: v.id, tour: v.tour, temps, meilleur: temps === v.meilleur });
        if (v.humain && c.mode === 'chrono') {
          if (c.meilleurTour == null || temps < c.meilleurTour) {
            c.meilleurTour = temps;
            c.fantomeNouveau = c.enregistrement.slice();
            if (!c.fantome || temps < c.fantome.temps) { c.nouveauRecord = true; ev.push({ type: 'record', id: v.id, temps }); }
          }
          c.enregistrement = [];
        }
        if (v.tour >= c.tours) {
          v.fini = true; v.tempsFin = c.t + v.penalite; v.niveau = 'facile';
          ev.push({ type: 'arrivee', id: v.id, temps: v.tempsFin });
        }
      }
    } else if (avant < L * 0.25 && p3.s > L * 0.75) v.tour--;
    v.dist = v.tour * L + p3.s;

    // Enregistrement du tour pour le fantôme (toutes les 0,1 s)
    if (c.mode === 'chrono' && v.humain && v.tour >= 0) {
      const k = Math.floor((c.t - v.dernierTour) / 0.1);
      if (c.enregistrement.length <= k) c.enregistrement.push([Math.round(v.x), Math.round(v.y), Math.round(v.cap * 100) / 100]);
    }

    // Limites de piste : sortir de la piste prévient, puis pénalise
    const dehors = Math.abs(v.d) > demi + R.limites.marge && sol !== 'stand' && v.tour >= 0;
    if (dehors && !v.hors && libre && !v.fini) {
      v.avert++;
      ev.push({ type: 'limites', id: v.id, avert: v.avert });
      if (v.avert % R.limites.avertissementsAvantPenalite === 0) {
        v.penalite += R.limites.penalite;
        ev.push({ type: 'penalite', id: v.id, secondes: R.limites.penalite, raison: 'limites' });
      }
    }
    v.hors = dehors;

    // La trace sèche la piste là où l'on roule
    if (sol === 'piste' && Math.abs(v.d) < demi * 0.55 && v.vitesse > 20) {
      for (let j = -2; j <= 2; j++) { const k = (v.i + j + piste.n) % piste.n; c.trace[k] = Math.min(1, c.trace[k] + dt * 3); }
    }

    // Bonus ramassés
    for (const b of c.bonus) {
      if (b.retour > 0 || v.fini) continue;
      if (Math.hypot(b.x - v.x, b.y - v.y) < R.bonus.rayon + 2) {
        if (b.type === 'reparation') { v.usure = Math.max(0, v.usure - R.bonus.reparation); v.degats = 0; v.crevaison = false; }
        else if (!v.bonus && !(b.type === 'pilote' && !v.humain)) v.bonus = b.type;
        else continue;
        b.retour = R.bonus.retour;
        ev.push({ type: 'bonus', id: v.id, bonus: b.type });
      }
    }
  }
  for (const b of c.bonus) if (b.retour > 0) b.retour = Math.max(0, b.retour - dt);

  // Voitures entre elles : celle qui tape par derrière est pénalisée
  for (const k of contacts(tous, R)) {
    const a = tous.find(v => v.id === k.a), b = tous.find(v => v.id === k.b);
    if (k.vitesse < R.degats.vitesseMin * 0.5) continue;
    const [coupable, victime] = a.dist < b.dist ? [a, b] : [b, a];
    for (const v of [a, b]) if (v.bouclier <= 0) v.degats = Math.min(1, v.degats + (k.vitesse / R.voiture.vmax) * R.degats.mur * 0.5);
    if (k.vitesse > R.degats.vitesseMin && libre && !coupable.fini && coupable.pilote <= 0 && coupable.vitesse > victime.vitesse) {
      coupable.penalite += R.limites.penaliteCollision;
      ev.push({ type: 'penalite', id: coupable.id, secondes: R.limites.penaliteCollision, raison: 'collision' });
    }
    ev.push({ type: 'choc', a: k.a, b: k.b, vitesse: k.vitesse });
  }

  classer(c);

  // Fin de course : quelques secondes après l'arrivée du dernier humain, ou quand tous ont fini
  const humains = tous.filter(v => v.humain);
  if (c.phase === 'course' && humains.length && humains.every(v => v.fini)) { c.phase = 'arrivee'; c.fin = R.course.arrivee; }
  if (c.phase === 'arrivee') {
    c.fin -= dt;
    if (c.fin <= 0 || tous.every(v => v.fini)) { c.phase = 'fin'; c.classement = resultat(c); ev.push({ type: 'fin' }); }
  }
  c.rng = rng.state;
  return ev;
}

// Le classement final : les arrivés par temps (pénalités comprises), puis les autres par distance
export function resultat(c) {
  return classer(c).map(v => ({
    id: v.id, nom: v.nom, humain: v.humain, pos: v.pos, fini: v.fini,
    temps: v.fini ? v.tempsFin : null, penalite: v.penalite, meilleur: v.meilleur, tours: v.tours.length,
  }));
}

export const nomsIA = k => NOMS_IA[k % NOMS_IA.length];

// Une grille : le joueur + n voitures de l'ordinateur
export function grille(n, { niveau = 'moyen', pneu } = {}) {
  const liste = [];
  for (let k = 0; k < n; k++) liste.push({ id: `ia${k + 1}`, nom: nomsIA(k), humain: false, niveau, style: ((k * 0.37) % 1), pneu });
  liste.splice(Math.min(n, 3), 0, { id: 'j1', nom: 'Vous', humain: true, pneu }); // le joueur part du milieu de la grille
  return liste;
}

// Une grille en ligne : les humains au milieu de la grille, les voitures de l'ordinateur autour
export function grilleLigne(n, humains, { niveau = 'moyen', pneu } = {}) {
  const liste = [];
  for (let k = 0; k < n; k++) liste.push({ id: `ia${k + 1}`, nom: nomsIA(k), humain: false, niveau, style: ((k * 0.37) % 1), pneu });
  liste.splice(Math.min(n, 3), 0, ...humains.map(h => ({ id: h.id, nom: h.nom, humain: true, pneu })));
  return liste;
}
