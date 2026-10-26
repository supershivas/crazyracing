// Les règles d'une course « auto battler » : grille, feux, tours, météo, stands,
// sillage, bonus, dangers, incidents, classement. Du JS pur, sans DOM, sans hasard
// ni horloge du navigateur (sections 10 et 12) : même graine, mêmes commandes,
// même course. Les voitures roulent seules ; les commandes du joueur sont des choix :
//   { ligne: -1 | 0 | 1 (changer de ligne, relatif), bonus: bool, pit: bool (appeler / annuler
//     l'arrêt au stand), pneu: 'slick' | 'inter' | 'pluie' (pour le prochain arrêt) }
import { createRng } from './lib/rng.js?v=0.4.0';
import { construirePiste, pointA } from './piste.js?v=0.4.0';
import { nouvelleVoiture, adherence, vitessePermise, facteurLigne, lignesDe } from './voiture.js?v=0.4.0';
import { choisirLigne, ligneLibre, devantSurLigne } from './ia.js?v=0.4.0';
import { REGLAGES } from './data/reglages.js?v=0.4.0';

export const METEOS = ['sec', 'humide', 'pluie', 'variable'];
export const PNEUS = ['slick', 'inter', 'pluie'];
export const TYPES_BONUS = ['turbo', 'bouclier', 'sillage', 'reparation'];
const EAU = { sec: 0, humide: 0.4, pluie: 0.9 };
const TAU = Math.PI * 2;
const NOMS_IA = ['Rossi', 'Kimura', 'Duval', 'Okafor', 'Lindqvist', 'Moreau', 'Vargas', 'Haas', 'Nakamura', 'Silva', 'Brandt', 'Ito'];
const CENTRE_BOX = 22;
const borne = (x, a, b) => Math.max(a, Math.min(b, x));

export const choixPneu = eau => (eau > 0.65 ? 'pluie' : eau > 0.22 ? 'inter' : 'slick');

// L'eau vers laquelle tend la piste à l'instant t
export function eauCible(c, t) {
  if (c.meteo.type !== 'variable') return EAU[c.meteo.type] ?? 0;
  const x = Math.sin(TAU * t / c.R.meteo.periodeVariable + c.meteo.phase);
  return borne(0.55 * x + 0.35, 0, 1);
}

function rattacher(c, def) {
  Object.defineProperty(c, 'piste', { value: construirePiste(def), enumerable: false, writable: true });
  Object.defineProperty(c, 'lignes', { value: lignesDe(c.piste, c.R), enumerable: false, writable: true });
  return c;
}

// Place x, y, cap, s d'une voiture d'après dist et d (aussi pour la réplique d'un invité)
export function positionner(c, v) {
  const L = c.piste.longueur;
  v.s = ((v.dist % L) + L) % L;
  const p = pointA(c.piste, v.s, v.d);
  v.i = p.i; v.x = p.x; v.y = p.y;
  v.cap = p.cap + v.lacet + borne((v.lat ?? 0) / Math.max(40, v.v), -0.35, 0.35);
}

// def : le circuit ; options : { mode: 'course' | 'chrono', tours, meteo, voitures: [{ id, nom, humain, pneu, niveau, style }],
//                                bonus: bool, dangers: bool, graine, R, fantome }
export function nouvelleCourse(def, options = {}) {
  const R = options.R ?? REGLAGES;
  const rng = createRng(options.graine ?? 1);
  const c = {
    mode: options.mode ?? 'course',
    def, tours: options.tours ?? def.tours ?? 3,
    meteo: { type: options.meteo ?? 'sec', phase: rng.range(0, TAU) },
    eau: 0, t: 0, phase: 'feux', feux: options.mode === 'chrono' ? 1.5 : R.course.feux, fin: 0,
    voitures: [], bonus: [], dangers: [], trace: [], rng: 0, classement: null, prochainDanger: 0, nDangers: 0,
    avecDangers: options.dangers ?? options.mode !== 'chrono',
    fantome: options.fantome ?? null, enregistrement: [], meilleurTour: null, nouveauRecord: false,
  };
  Object.defineProperty(c, 'R', { value: R, enumerable: false, writable: true });
  rattacher(c, def);
  const L = c.piste.longueur;
  c.trace = new Array(c.piste.n * 3).fill(0);
  c.eau = eauCible(c, 0);
  c.prochainDanger = R.danger.premier;

  (options.voitures ?? [{ id: 'j1', nom: 'Vous', humain: true }]).forEach((o, k) => {
    const v = nouvelleVoiture({ ...o, equipe: o.equipe ?? Math.floor(k / 2), pneu: o.pneu ?? choixPneu(c.eau) });
    v.niveau = o.niveau ?? 'moyen';
    v.style = o.style ?? rng();
    if (c.mode === 'chrono') { v.dist = -10; v.v = 80; v.ligne = 0; }
    else { v.dist = -R.course.ecart * (Math.floor(k / 2) + 1); v.ligne = k % 2 ? 1 : -1; }
    v.d = c.lignes[v.ligne + 1];
    v.tour = Math.floor(v.dist / L);
    positionner(c, v);
    c.voitures.push(v);
  });

  if (options.bonus) {
    const n = R.bonus.nombre;
    for (let k = 0; k < n; k++) {
      const s = L * (0.08 + 0.9 * (k + rng.range(0.1, 0.9)) / n);
      c.bonus.push({ s, d: c.lignes[rng.int(0, 2)], type: rng.weighted([{ v: 'turbo', w: 4 }, { v: 'bouclier', w: 2 }, { v: 'sillage', w: 3 }, { v: 'reparation', w: 2 }]), retour: 0 });
      const p = pointA(c.piste, s, c.bonus[k].d);
      c.bonus[k].x = p.x; c.bonus[k].y = p.y;
    }
  }
  c.rng = rng.state;
  return c;
}

// Recrée la course à partir d'un état relu (réseau)
export function recharger(etat, def, R = REGLAGES) {
  Object.defineProperty(etat, 'R', { value: R, enumerable: false, writable: true });
  return rattacher(etat, def);
}

const abscisseStand = (c, s) => (s > c.piste.longueur / 2 ? s - c.piste.longueur : s);
const dansZoneStand = (c, s) => { const sp = abscisseStand(c, s); return sp >= -c.R.stand.avant && sp <= c.R.stand.apres; };
const indiceLigne = (c, d) => (d < c.lignes[1] / 2 ? 0 : d > c.lignes[2] / 2 ? 2 : 1);

// Eau ressentie par une voiture : la ligne où l'on roule sèche d'abord
export function eauLocale(c, v) {
  return c.eau * (1 - 0.7 * c.trace[v.i * 3 + indiceLigne(c, v.d)]);
}

export function classer(c) {
  const finis = c.voitures.filter(v => v.fini).sort((a, b) => a.tempsFin - b.tempsFin);
  const autres = c.voitures.filter(v => !v.fini).sort((a, b) => b.dist - a.dist);
  const ordre = [...finis, ...autres];
  ordre.forEach((v, k) => { v.pos = k + 1; });
  return ordre;
}

function incident(c, v, type, ev, rng, cause) {
  if (type === 'crevaison') { v.crevaison = true; ev.push({ type: 'crevaison', id: v.id, cause }); return; }
  v.incident = { type: 'spin', t: c.R.incidents.duree, dir: rng() < 0.5 ? -1 : 1 };
  ev.push({ type: 'incident', id: v.id, incident: 'spin', cause });
}

// commandes : { [id]: { ligne, bonus, pit, pneu } } pour les voitures humaines
// → liste des événements de ce pas
export function avancerCourse(c, dt, commandes = {}) {
  const ev = [];
  const R = c.R, piste = c.piste, L = piste.longueur, demi = piste.largeur / 2, V = R.voiture;

  if (c.phase === 'feux') {
    const avant = Math.ceil(c.feux);
    c.feux -= dt;
    if (Math.ceil(c.feux) !== avant && c.feux > 0) ev.push({ type: 'feu', reste: Math.ceil(c.feux) });
    if (c.feux <= 0) { c.phase = 'course'; ev.push({ type: 'depart' }); }
  } else c.t += dt;
  const libre = c.phase !== 'feux';

  // Météo : l'eau suit la prévision ; la trace sèche, la pluie l'efface
  c.eau += Math.max(-R.meteo.sechage * dt, Math.min(R.meteo.vitesseEau * dt, eauCible(c, c.t) - c.eau));
  if (c.eau > 0.15) for (let i = 0; i < c.trace.length; i++) c.trace[i] = Math.max(0, c.trace[i] - dt * c.eau * 0.02);

  const rng = createRng(1);
  rng.setState(c.rng);
  const tous = c.voitures;

  // Les débris : un à la fois, devant le peloton, hors du stand
  if (libre && c.avecDangers) {
    c.dangers = c.dangers.filter(h => (h.t -= dt) > 0);
    if (c.t >= c.prochainDanger && !c.dangers.length) {
      const tete = Math.max(...tous.filter(v => !v.fini).map(v => v.dist), 0);
      const dist = tete + R.danger.avance + rng.range(0, 120);
      if (!dansZoneStand(c, ((dist % L) + L) % L)) {
        const d = c.lignes[rng.int(0, 2)];
        const p = pointA(piste, dist, d);
        c.dangers.push({ id: ++c.nDangers, dist, d, x: p.x, y: p.y, t: R.danger.duree });
        ev.push({ type: 'danger', dist, d });
      }
      c.prochainDanger = c.t + R.danger.intervalle + rng.range(-4, 6);
    }
  }

  // Voisinage, avant que personne ne bouge : le sillage se mesure sur les positions du pas précédent
  const fronts = new Map();
  for (const v of tous) fronts.set(v, devantSurLigne(c, v, v.d, R.sillage.portee * (v.sillage > 0 ? R.sillage.bonus : 1)));

  for (const v of tous) {
    const cmdH = commandes[v.id];
    const IA = !v.humain;
    const avantDist = v.dist;
    const niv = (R.ia.niveaux[v.niveau] ?? 0.95) * (IA ? 0.97 + 0.06 * ((v.style * 7.3) % 1) : 1);
    const sp = abscisseStand(c, v.s);

    // ─── Décisions : le joueur par ses commandes, l'ordinateur par son jugement ───
    if (libre && !v.fini) {
      if (!IA && cmdH) {
        if (cmdH.ligne && !v.incident) {
          const l = borne(v.ligne + Math.sign(cmdH.ligne), -1, 1);
          if (l !== v.ligne) { if (ligneLibre(c, v, l)) v.ligne = l; else ev.push({ type: 'ligne-occupee', id: v.id }); }
        }
        if (cmdH.pit) { v.pit = !v.pit; ev.push({ type: 'pit', id: v.id, demande: v.pit }); }
        if (cmdH.pneu && PNEUS.includes(cmdH.pneu)) v.prochainPneu = cmdH.pneu;
      } else if (IA) {
        v.changeT -= dt;
        if (v.changeT <= 0 && !v.incident) {
          v.changeT = R.ia.decision * (0.7 + 0.6 * v.style);
          const l = choisirLigne(c, v);
          if (l !== v.ligne && ligneLibre(c, v, l)) v.ligne = l;
        }
        if (v.tour >= 0 && v.tour < c.tours - 1 && !v.pit) {
          const idee = choixPneu(c.eau);
          if (v.usure > 0.62 || v.crevaison || (idee !== v.pneu && Math.abs(c.eau - { slick: 0, inter: 0.45, pluie: 0.9 }[v.pneu]) > 0.5)) { v.pit = true; v.prochainPneu = idee; }
        }
      }
      // Le bonus : à la demande du joueur, ou quand l'ordinateur voit le moment
      const kDevant = Math.abs(piste.pts[(Math.floor(v.s / piste.pas) + 8) % piste.n].k);
      const veut = !v.bonus ? false : IA ? (v.bonus === 'sillage' ? !!fronts.get(v) : kDevant < 0.004) : !!cmdH?.bonus;
      if (veut) {
        const b = v.bonus; v.bonus = null;
        if (b === 'turbo') v.turbo = R.bonus.turbo; else if (b === 'bouclier') v.bouclier = R.bonus.bouclier; else if (b === 'sillage') v.sillage = R.bonus.sillage;
        ev.push({ type: 'bonus-use', id: v.id, bonus: b });
      }
    }

    // ─── La ligne visée : la ligne choisie, la voie des stands, ou l'herbe d'un tête-à-queue ───
    let cibleD = c.lignes[v.ligne + 1];
    const zone = dansZoneStand(c, v.s);
    // Un arrêt demandé : on se range à droite avant l'entrée des stands, puis on prend la voie
    const versStand = v.pit && !v.fini && sp > -R.stand.avant - 60 && sp < CENTRE_BOX + 8;
    if (versStand) cibleD = sp < -R.stand.avant + 10 ? c.lignes[2] : demi + R.stand.largeur / 2 - 2;
    const spin = v.incident && v.incident.t > 0;
    if (spin) cibleD = v.incident.dir * (demi + 7);
    const rate = V.laterale * (spin ? 0.7 : versStand ? 1.6 : 1);
    const dd = borne(cibleD - v.d, -rate * dt, rate * dt);
    v.d += dd;
    v.lat = dd / dt;
    const dBorne = borne(v.d, -demi, demi);

    // ─── Aspiration et adhérence ───
    const front = fronts.get(v);
    const dansSillage = !!front && front.gap >= R.sillage.min && !v.incident;
    const sb = v.sillage > 0 ? R.sillage.bonus : 1;
    v.charge = borne(v.charge + (dansSillage ? R.sillage.montee : -R.sillage.descente) * dt, 0, 1);
    const airSale = front && front.gap < 40 ? 1 - front.gap / 40 : 0;
    const g = adherence(v, eauLocale(c, v), R, airSale) * (IA ? niv : 1);
    const vmaxEff = V.vmax * (IA ? niv : 1) * (1 - v.degats * R.degats.perte) * (v.crevaison ? 0.75 : 1)
      * (1 + R.sillage.gain * sb * v.charge) * (v.turbo > 0 ? 1 + R.bonus.turboPousse : 1);

    // ─── La vitesse visée : virages à venir, trafic, stand, incident, feux ───
    let vt = Math.min(vmaxEff, vitessePermise(v, piste, dBorne, g, R) * (v.turbo > 0 ? 1.12 : 1));
    if (front && front.gap < R.sillage.min + 8) vt = Math.min(vt, Math.max(0, front.o.v * 0.99 + (front.gap - V.longueur) * 2));
    const decel = V.frein * 0.55;
    const dansVoie = v.d > demi + 1 && zone;
    if (dansVoie) vt = Math.min(vt, R.stand.vitesseMax * 2.4);
    const dansBox = dansVoie && Math.abs(sp - CENTRE_BOX) < 4;
    if (versStand && sp < CENTRE_BOX + 4) vt = Math.min(vt, Math.sqrt(2 * decel * Math.max(0, CENTRE_BOX - sp)) + 4);
    if (dansBox && v.v < 9) {
      vt = 0;
      if (libre && v.pit) {
        v.standT += dt;
        if (v.standT >= R.stand.duree) {
          v.pneu = v.prochainPneu; v.usure = 0; v.chaleur = 0.3; v.degats = 0; v.crevaison = false; v.standT = 0; v.pit = false;
          ev.push({ type: 'stand', id: v.id, pneu: v.pneu });
        }
      }
    } else v.standT = 0;
    v.enStand = dansVoie;
    if (spin) vt = Math.min(vt, vmaxEff * R.incidents.ralenti);
    if (v.fini) vt = Math.min(vt, V.vmax * 0.5);
    if (!libre) vt = 0;

    if (v.v < vt) v.v = Math.min(vt, v.v + V.acc * (1 + R.sillage.gainAcc * v.charge) * dt);
    else v.v = Math.max(vt, v.v - V.frein * dt);

    // ─── Avancer le long de la ligne : plus courte à l'intérieur d'un virage ───
    const p = piste.pts[v.i];
    const f = facteurLigne(p, dBorne);
    const cout = 1 - V.coutLigne * Math.min(1, Math.abs(v.lat) / V.laterale);
    v.dist += (v.v * cout / f) * dt;
    v.vitesse = v.v;

    // ─── Pneus : l'usure suit la charge latérale ; la chaleur, l'effort ───
    const keff = Math.abs(p.k) / f;
    const charge = Math.min(1.2, (v.v * v.v * keff) / (V.adherence * Math.max(0.2, g)));
    const act = Math.min(1, 0.55 * charge + 0.4 * (v.v / V.vmax) + 0.15 * v.charge);
    v.chaleur += ((0.12 + 0.88 * act) - v.chaleur) * dt / 4;
    const P = R.pneus[v.pneu];
    const chaud = P.chaud ? 1 + (P.chaud - 1) * (1 - c.eau) : 1;
    const corde = Math.sign(dBorne) === Math.sign(p.k) && dBorne !== 0 ? 1 + R.pneus.usureCorde * Math.min(1, Math.abs(dBorne) / V.ecartLigne) * Math.min(1, Math.abs(p.k) * 80) : 1;
    v.usure = Math.min(1, v.usure + dt * (R.pneus.usureBase + R.pneus.usureVirage * charge * charge) * P.usure * chaud * corde * (airSale > 0.5 ? 1.12 : 1));
    v.roulis = borne(-Math.sign(p.k) * charge, -1, 1);
    if (charge > 0.97 && v.v > 60 && !IA) ev.push({ type: 'derapage', id: v.id });
    for (const k of ['turbo', 'bouclier', 'sillage']) if (v[k] > 0) v[k] = Math.max(0, v[k] - dt);

    // ─── Incidents : l'usure, l'eau et la malchance (seuls événements qui sortent de piste) ───
    if (v.incident) {
      // Le tête-à-queue dure `duree` ; ensuite la voiture revient sur la piste avant d'être de nouveau libre
      if (v.incident.t > 0) { v.incident.t -= dt; v.lacet += 9 * dt * v.incident.dir * Math.max(0, v.incident.t / R.incidents.duree); }
      else { v.lacet = 0; if (Math.abs(v.d) <= demi) v.incident = null; }
    } else if (libre && !v.fini && v.bouclier <= 0) {
      const risque = R.incidents.base + R.incidents.usure * Math.max(0, v.usure - 0.7) + (c.eau > 0.5 && v.pneu === 'slick' ? R.incidents.mouille : 0) + (charge > 1.05 ? 0.04 : 0);
      if (rng() < risque * dt) incident(c, v, v.usure > 0.85 && rng() < R.incidents.crevaison ? 'crevaison' : 'spin', ev, rng, v.usure > 0.7 ? 'usure' : 'malchance');
    }

    // ─── Un débris sur la ligne ───
    for (const h of c.dangers) {
      if (avantDist < h.dist && v.dist >= h.dist && Math.abs(v.d - h.d) < R.danger.rayon + V.largeur / 2 && v.bouclier <= 0 && !v.incident) {
        incident(c, v, 'spin', ev, rng, 'danger');
        ev.push({ type: 'danger-touche', id: v.id });
      }
    }

    // ─── Position, tours, ligne d'arrivée ───
    positionner(c, v);
    const tourNew = Math.floor(v.dist / L);
    while (v.tour < tourNew) {
      v.tour++;
      if (v.tour === 0) {
        if (c.mode === 'chrono') { v.dernierTour = c.t; c.enregistrement = []; }
      } else if (!v.fini) {
        const temps = c.t - v.dernierTour;
        v.tours.push(temps); v.dernierTour = c.t;
        if (v.meilleur == null || temps < v.meilleur) v.meilleur = temps;
        ev.push({ type: 'tour', id: v.id, tour: v.tour, temps, meilleur: temps === v.meilleur });
        if (v.humain && c.mode === 'chrono') {
          if (c.meilleurTour == null || temps < c.meilleurTour) {
            c.meilleurTour = temps; c.fantomeNouveau = c.enregistrement.slice();
            if (!c.fantome || temps < c.fantome.temps) { c.nouveauRecord = true; ev.push({ type: 'record', id: v.id, temps }); }
          }
          c.enregistrement = [];
        }
        if (v.tour >= c.tours) {
          v.fini = true; v.tempsFin = c.t - (v.dist - c.tours * L) / Math.max(30, v.v); v.niveau = 'facile'; v.pit = false;
          ev.push({ type: 'arrivee', id: v.id, temps: v.tempsFin });
        }
      }
    }
    if (c.mode === 'chrono' && v.humain && v.tour >= 0 && !v.fini) {
      const k = Math.floor((c.t - v.dernierTour) / 0.1);
      if (c.enregistrement.length <= k) c.enregistrement.push([Math.round(v.x), Math.round(v.y), Math.round(v.cap * 100) / 100]);
    }

    // La trace sèche la ligne où l'on roule
    if (v.v > 20 && !v.enStand) {
      const li = indiceLigne(c, v.d);
      for (let j = -2; j <= 2; j++) { const k = ((v.i + j + piste.n) % piste.n) * 3 + li; c.trace[k] = Math.min(1, c.trace[k] + dt * 3); }
    }

    // Les bonus ramassés : il faut être sur la bonne ligne
    for (const b of c.bonus) {
      if (b.retour > 0 || v.fini) continue;
      let ds = v.s - b.s;
      if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      if (Math.abs(ds) < 6 && Math.abs(v.d - b.d) < R.bonus.rayon) {
        if (b.type === 'reparation') { v.usure = Math.max(0, v.usure - R.bonus.reparation); v.degats = 0; v.crevaison = false; }
        else if (!v.bonus) v.bonus = b.type;
        else continue;
        b.retour = R.bonus.retour;
        ev.push({ type: 'bonus', id: v.id, bonus: b.type });
      }
    }
  }
  for (const b of c.bonus) if (b.retour > 0) b.retour = Math.max(0, b.retour - dt);

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

// Le classement final : les arrivés par temps, puis les autres par distance
export function resultat(c) {
  return classer(c).map(v => ({
    id: v.id, nom: v.nom, humain: v.humain, pos: v.pos, fini: v.fini,
    temps: v.fini ? v.tempsFin : null, penalite: 0, meilleur: v.meilleur, tours: v.tours.length,
  }));
}

export const nomsIA = k => NOMS_IA[k % NOMS_IA.length];

// Une grille : le joueur + n voitures de l'ordinateur
export function grille(n, { niveau = 'moyen', pneu } = {}) {
  return grilleLigne(n, [{ id: 'j1', nom: 'Vous' }], { niveau, pneu });
}

// Une grille avec des humains au milieu, les voitures de l'ordinateur autour
export function grilleLigne(n, humains, { niveau = 'moyen', pneu } = {}) {
  const liste = [];
  for (let k = 0; k < n; k++) liste.push({ id: `ia${k + 1}`, nom: nomsIA(k), humain: false, niveau, style: ((k * 0.37) % 1), pneu });
  liste.splice(Math.min(n, 3), 0, ...humains.map(h => ({ id: h.id, nom: h.nom, humain: true, pneu })));
  return liste;
}
