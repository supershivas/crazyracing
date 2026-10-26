// Les règles du jeu, sans navigateur : node outils/test-run.mjs
import { readFileSync } from 'node:fs';
import { CIRCUITS } from '../js/data/circuits.js';
import { REGLAGES } from '../js/data/reglages.js';
import { construirePiste, verifierPiste, projeter, pointA } from '../js/piste.js';
import { nouvelleVoiture, adherence, vitessePermise, facteurLigne } from '../js/voiture.js';
import { nouvelleCourse, avancerCourse, grille, eauCible } from '../js/course.js';
import { circuitVersCode, codeVersCircuit, normaliserCircuit } from '../js/circuit-code.js';

const R = REGLAGES;
const pilote = c => c.voitures.find(v => v.humain);
// Fait rouler la course (le joueur conduit avec les commandes données, sinon il est immobile)
function rouler(c, secondes, commandes = () => ({})) {
  const evs = [];
  for (let i = 0; i < secondes * 60 && c.phase !== 'fin'; i++) evs.push(...avancerCourse(c, 1 / 60, commandes(c)));
  return evs;
}

// Téléporte une voiture (les tests seulement) : x, y et l'échantillon de départ de la recherche
const poser = (c, v, s, d = 0, plus = {}) => {
  const q = pointA(c.piste, s, d);
  Object.assign(v, { x: q.x, y: q.y, cap: q.cap, vx: 0, vy: 0, i: q.i }, plus);
};

group('circuits');
for (const def of CIRCUITS) {
  test(`${def.nom} : tracé valide`, () => {
    const piste = construirePiste(def);
    assert.deepEqual(verifierPiste(piste).problemes, []);
    assert.ok(piste.longueur > 1500);
  });
}
test('le circuit en huit se croise une fois, les autres jamais', () => {
  for (const def of CIRCUITS) {
    assert.equal(verifierPiste(construirePiste(def)).croisements, def.id === 'huit' ? 1 : 0, def.id);
  }
});
test('projeter retrouve un point du circuit, avec son écart latéral', () => {
  const piste = construirePiste(CIRCUITS[0]);
  const p = pointA(piste, 500, 7);
  const r = projeter(piste, p.x, p.y);
  assert.ok(Math.abs(r.s - 500) < 2, `s=${r.s}`);
  assert.ok(Math.abs(r.d - 7) < 1, `d=${r.d}`);
});
test('au croisement du huit, la recherche locale garde sa branche', () => {
  const piste = construirePiste(CIRCUITS.find(c => c.id === 'huit'));
  // deux abscisses éloignées passent au même endroit : on cherche le croisement
  let meilleur = null;
  for (let i = 0; i < piste.n; i += 2) for (let j = i + 100; j < piste.n; j += 2) {
    const d = Math.hypot(piste.pts[i].x - piste.pts[j].x, piste.pts[i].y - piste.pts[j].y);
    if (!meilleur || d < meilleur.d) meilleur = { d, i, j };
  }
  assert.ok(meilleur.d < 6);
  for (const k of [meilleur.i, meilleur.j]) {
    const p = piste.pts[k];
    const r = projeter(piste, p.x, p.y, k - 3);
    assert.ok(Math.abs(r.i - k) <= 3, `branche ${r.i} au lieu de ${k}`);
  }
});

group('voiture');
test('un virage serré limite la vitesse, la ligne droite non ; le virage se lit plus tôt à grande vitesse', () => {
  const piste = construirePiste(CIRCUITS.find(c => c.id === 'dunes'));
  const v = nouvelleVoiture({}); v.v = 120;
  const g = 1;
  let min = Infinity, max = 0;
  for (let i = 0; i < piste.n; i += 5) { v.s = i * piste.pas; const p = vitessePermise(v, piste, 0, g, R); min = Math.min(min, p); max = Math.max(max, p); }
  assert.ok(min < 100 && max > R.voiture.vmax, `min ${min} max ${max}`);
});
test('dans un virage, la ligne intérieure raccourcit le chemin mais ralentit', () => {
  const piste = construirePiste(CIRCUITS[0]);
  const i = piste.pts.findIndex(p => Math.abs(p.k) > 1 / 60);
  const p = piste.pts[i];
  const dedans = Math.sign(p.k) * 10, dehors = -dedans;
  assert.ok(facteurLigne(p, dedans) < 1 && facteurLigne(p, dehors) > 1);
  const v = nouvelleVoiture({}); v.s = p.s - 40; v.v = 100;
  assert.ok(vitessePermise(v, piste, dedans, 1, R) < vitessePermise(v, piste, dehors, 1, R));
});
test('l\'eau sur slicks et l\'usure réduisent l\'adhérence ; la pluie préfère les pneus pluie', () => {
  const v = nouvelleVoiture({});
  v.chaleur = 0.6;
  const sec = adherence(v, 0, R);
  assert.ok(adherence(v, 0.9, R) < sec * 0.6);
  v.usure = 0.9;
  assert.ok(adherence(v, 0, R) < sec);
  v.usure = 0; v.pneu = 'pluie';
  assert.ok(adherence(v, 0.9, R) > adherence({ ...v, pneu: 'slick' }, 0.9, R));
});
test('des pneus froids tiennent moins que des pneus chauds ; suivre de près dans l\'air sale coûte', () => {
  const v = nouvelleVoiture({}); v.chaleur = 0.1;
  const froid = adherence(v, 0, R);
  v.chaleur = 0.6;
  assert.ok(adherence(v, 0, R) > froid);
  assert.ok(adherence(v, 0, R, 1) < adherence(v, 0, R, 0));
});

group('course');
const dansLaZone = (c, v) => { const sp = v.s > c.piste.longueur / 2 ? v.s - c.piste.longueur : v.s; return sp >= -c.R.stand.avant - 60 && sp <= c.R.stand.apres; };
// Une portion droite d'au moins 60 px : où poser deux voitures pour mesurer le sillage
const droite = piste => piste.pts.find((p, i) => Array.from({ length: 30 }, (_, j) => Math.abs(piste.pts[(i + j) % piste.n].k)).every(k => k < 0.0025)).s + 4;
const nouvelle = (id = 'port', opts = {}) => nouvelleCourse(CIRCUITS.find(c => c.id === id), { tours: 2, voitures: grille(5), graine: 3, ...opts });
// Une course de deux voitures seulement, sur la ligne de départ, pour les situations précises
const duo = (opts = {}) => nouvelleCourse(CIRCUITS[0], { tours: 3, graine: 3, voitures: [{ id: 'j1', nom: 'a', humain: true }, { id: 'ia1', nom: 'b', humain: false, niveau: 'difficile' }], ...opts });
const lancee = c => { rouler(c, 3.5); return c; };
test('même graine, mêmes commandes, même course (et l\'état se sérialise)', () => {
  const a = nouvelle('dunes', { bonus: true, meteo: 'variable' }), b = nouvelle('dunes', { bonus: true, meteo: 'variable' });
  const cmd = () => ({ j1: { ligne: Math.sin(a.t) > 0.6 ? 1 : Math.sin(a.t) < -0.6 ? -1 : 0, bonus: a.t % 7 < 0.02 } });
  rouler(a, 30, cmd); rouler(b, 30, () => ({ j1: { ligne: Math.sin(b.t) > 0.6 ? 1 : Math.sin(b.t) < -0.6 ? -1 : 0, bonus: b.t % 7 < 0.02 } }));
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});
test('les voitures sont immobiles pendant les feux, puis partent', () => {
  const c = nouvelle();
  rouler(c, 2);
  assert.equal(c.phase, 'feux');
  assert.ok(c.voitures.every(v => v.v === 0));
  rouler(c, 3);
  assert.equal(c.phase, 'course');
  assert.ok(c.voitures.some(v => v.v > 20));
});
test('personne ne sort de la piste, sauf lors d\'un incident', () => {
  for (const id of ['port', 'dunes', 'huit']) {
    const c = nouvelle(id, { voitures: grille(8), bonus: true, meteo: 'variable', tours: 3 });
    const demi = c.piste.largeur / 2;
    let sorties = 0, incidents = 0;
    for (let i = 0; i < 60 * 150 && c.phase !== 'fin'; i++) {
      incidents += avancerCourse(c, 1 / 60, {}).filter(e => e.type === 'incident').length;
      for (const v of c.voitures) if (Math.abs(v.d) > demi + 1 && !v.incident && !(v.pit || v.enStand) && !(v.d > 0 && dansLaZone(c, v))) sorties++;
    }
    assert.equal(sorties, 0, id);
  }
});
test('une course de l\'ordinateur se termine : tout le monde arrive, classement trié', () => {
  const c = nouvelle();
  rouler(c, 200);
  assert.equal(c.phase, 'fin');
  assert.equal(c.classement.length, 6);
  const temps = c.classement.filter(r => r.fini).map(r => r.temps);
  assert.deepEqual(temps, [...temps].sort((a, b) => a - b));
  assert.ok(temps.length >= 5);
});
test('les tours sont comptés et chronométrés', () => {
  const c = nouvelle('port', { voitures: grille(0) });
  const tours = rouler(c, 120).filter(e => e.type === 'tour');
  assert.equal(tours.length, 2);
  assert.ok(tours.every(t => t.temps > 8 && t.temps < 40), JSON.stringify(tours));
  assert.ok(pilote(c).fini);
});
test('le sillage : derrière une voiture, la charge monte et on dépasse la vitesse de pointe', () => {
  const c = lancee(duo({ dangers: false }));
  const [a, b] = c.voitures;
  // b juste devant sur la même ligne, a derrière à 35 px, sur une droite
  const sDroit = droite(c.piste);
  b.dist = sDroit + 35; a.dist = sDroit; a.ligne = b.ligne = 0; a.d = b.d = 0; a.v = b.v = 150; a.bonus = b.bonus = null;
  b.niveau = 'facile'; // devant, plus lent : le sillage ne suffira pas à le coller, il faut mesurer la charge
  let charge = 0;
  for (let i = 0; i < 60; i++) { avancerCourse(c, 1 / 60, {}); charge = Math.max(charge, a.charge); }
  assert.ok(charge > 0.5, `charge ${charge}`);
});
test('le sillage fait gagner de la vitesse de pointe ; sorti du sillage, la charge retombe', () => {
  const c = lancee(duo({ dangers: false }));
  const [a, b] = c.voitures;
  const sDroit = droite(c.piste);
  a.dist = sDroit; b.dist = sDroit + 30; a.ligne = b.ligne = 0; a.d = b.d = 0; a.v = b.v = 190;
  for (let i = 0; i < 90; i++) avancerCourse(c, 1 / 60, {});
  assert.ok(a.charge > 0.9);
  a.ligne = 1; a.d = c.lignes[2]; // il se décale : plus d'aspiration
  for (let i = 0; i < 120; i++) avancerCourse(c, 1 / 60, {});
  assert.ok(a.charge < 0.3, `charge ${a.charge}`);
});
test('changer de ligne : refusé quand quelqu\'un est à côté', () => {
  const c = lancee(duo({ dangers: false }));
  const [a, b] = c.voitures;
  a.ligne = 0; a.d = 0; b.ligne = 1; b.d = c.lignes[2]; b.dist = a.dist + 3;
  const evs = avancerCourse(c, 1 / 60, { j1: { ligne: 1 } });
  assert.ok(evs.some(e => e.type === 'ligne-occupee'));
  assert.equal(a.ligne, 0);
  b.dist = a.dist + 60;
  avancerCourse(c, 1 / 60, { j1: { ligne: 1 } });
  assert.equal(a.ligne, 1);
});
test('un arrêt au stand remet des pneus neufs', () => {
  const c = nouvelle('port', { voitures: grille(0), tours: 5 });
  rouler(c, 4);
  const v = pilote(c);
  v.usure = 0.8; v.tour = 1; v.prochainPneu = 'inter';
  avancerCourse(c, 1 / 60, { [v.id]: { pit: true } });
  assert.equal(v.pit, true);
  const evs = rouler(c, 40);
  assert.ok(evs.some(e => e.type === 'stand'), 'arrêt effectué');
  assert.equal(v.pneu, 'inter');
  assert.ok(v.usure < 0.3);
});
test('la météo : pluie dès la grille ; le temps variable change vraiment', () => {
  assert.equal(nouvelle('port', { meteo: 'pluie' }).eau, 0.9);
  const d = nouvelle('port', { meteo: 'variable' });
  const vals = []; for (let t = 0; t < 160; t += 5) vals.push(eauCible(d, t));
  assert.ok(Math.max(...vals) > 0.5 && Math.min(...vals) < 0.1, 'le temps change');
});
test('un bonus se ramasse sur sa ligne seulement, et se déclenche à la demande', () => {
  const c = lancee(nouvelle('port', { voitures: grille(0), bonus: true }));
  const v = pilote(c);
  const b = c.bonus[0]; b.type = 'turbo'; b.retour = 0;
  Object.assign(v, { dist: b.s - 3, v: 100, ligne: b.d === c.lignes[0] ? 1 : -1 }); v.d = c.lignes[v.ligne + 1];
  avancerCourse(c, 1 / 60, {});
  Object.assign(v, { dist: b.s - 0.5 });
  avancerCourse(c, 1 / 60, {});
  assert.equal(v.bonus, null, 'autre ligne : rien');
  b.retour = 0; v.ligne = b.d === c.lignes[0] ? -1 : b.d === c.lignes[1] ? 0 : 1; v.d = b.d; v.dist = b.s - 0.5; v.v = 100;
  avancerCourse(c, 1 / 60, {});
  assert.equal(v.bonus, 'turbo');
  const evs = avancerCourse(c, 1 / 60, { [v.id]: { bonus: true } });
  assert.ok(evs.some(e => e.type === 'bonus-use'));
  assert.ok(v.turbo > 0 && v.bonus === null);
});
test('un débris sur la ligne provoque un tête-à-queue, le bouclier protège, une autre ligne évite', () => {
  const touche = (ligne, bouclier) => {
    const c = lancee(duo({ dangers: false }));
    const [a] = c.voitures;
    a.ligne = ligne; a.d = c.lignes[ligne + 1]; a.v = 100; a.bouclier = bouclier;
    c.voitures[1].dist = -500;
    a.dist = 200;
    c.dangers.push({ id: 1, dist: 203, d: c.lignes[1], x: 0, y: 0, t: 10 });
    for (let i = 0; i < 12; i++) avancerCourse(c, 1 / 60, {});
    return !!a.incident;
  };
  assert.equal(touche(0, 0), true);
  assert.equal(touche(0, 5), false);
  assert.equal(touche(1, 0), false);
  assert.equal(touche(-1, 0), false);
});
test('aucun hasard ni horloge dans les règles', () => {
  for (const f of ['course', 'voiture', 'ia', 'piste']) {
    const src = readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8');
    assert.ok(!/Math\.random|Date\.now|performance\.now|crypto\./.test(src), `${f}.js doit rester pur (section 10)`);
  }
});

group('codes de circuit');
test('un circuit fait l\'aller-retour par son code', () => {
  for (const def of CIRCUITS) {
    const code = circuitVersCode(def);
    assert.ok(code.startsWith('CR1.') && code.length < 700, `${code.length} car.`);
    const b = codeVersCircuit(code);
    assert.deepEqual(b.points, def.points);
    assert.equal(b.nom, def.nom); assert.equal(b.largeur, def.largeur); assert.equal(b.theme, def.theme);
  }
});
test('un code abîmé ou hostile est refusé ou assaini', () => {
  assert.throws(() => codeVersCircuit('bonjour'));
  assert.throws(() => codeVersCircuit('CR1.@@@'));
  assert.throws(() => normaliserCircuit({ points: [[0, 0], [1, 1]] }));
  assert.throws(() => normaliserCircuit({ points: Array.from({ length: 200 }, () => [0, 0]) }));
  assert.throws(() => normaliserCircuit({ points: [[0, 0], [1, NaN], [2, 2], [3, 3]] }));
  const c = normaliserCircuit({ nom: '<img src=x onerror=1>', theme: 'x', largeur: 9999, points: [[1e9, -1e9], [0, 0], [10, 10], [20, 0]] });
  assert.ok(!/[<>]/.test(c.nom));
  assert.equal(c.theme, 'prairie');
  assert.equal(c.largeur, 60);
  assert.deepEqual(c.points[0], [4000, -4000]);
});

group('course en ligne');
import { instantane, appliquer, commandeValide, evenementsPourInvite } from '../js/instantane.js';
test('l\'invité reconstitue la course de l\'hôte à partir des instantanés', () => {
  const def = CIRCUITS[1];
  const mk = () => nouvelleCourse(def, { tours: 3, voitures: grille(4), graine: 9, bonus: true, meteo: 'variable' });
  const hote = mk(), invite = mk();
  const j1 = pilote(hote); j1.pilote = 1e9;
  const evs = rouler(hote, 25);
  const retour = appliquer(invite, JSON.parse(JSON.stringify(instantane(hote, evs.slice(-3), { avecTrace: true }))));
  assert.ok(retour.length <= 3);
  for (const v of hote.voitures) {
    const w = invite.voitures.find(x => x.id === v.id);
    assert.ok(Math.hypot(v.x - w.x, v.y - w.y) < 0.2, `${v.id} position`);
    assert.equal(w.tour, v.tour); assert.equal(w.pos, v.pos); assert.equal(w.pneu, v.pneu);
    assert.ok(Math.abs(w.usure - v.usure) < 0.01);
  }
  assert.ok(Math.abs(invite.t - hote.t) < 0.01 && invite.phase === hote.phase && Math.abs(invite.eau - hote.eau) < 0.01);
  assert.ok(hote.trace.some(t => t > 0.2) && Math.abs(invite.trace.reduce((a, b) => a + b) - hote.trace.reduce((a, b) => a + b)) < hote.trace.length * 0.06);
});
test('un instantané hostile ne casse rien', () => {
  const c = nouvelleCourse(CIRCUITS[0], { tours: 2, voitures: grille(2), graine: 1 });
  const avant = JSON.stringify(c);
  appliquer(c, { k: 'snap', t: 'x', p: '<script>', v: [{ id: 'j1', x: 'NaN', y: Infinity, pneu: 'tank', bonus: 'bombe', tour: 1.5 }, null, { id: 'inconnu' }], b: 'oui', ev: [{ type: 'rm -rf' }, null, 4] });
  assert.equal(JSON.stringify(c), avant);
  assert.deepEqual(commandeValide({ gaz: 99, frein: 'x', volant: -5, recul: 1, pneu: 'missile' }), { gaz: 1, frein: 0, volant: -1, recul: true, bonus: false, pneu: undefined });
  assert.equal(evenementsPourInvite([{ type: 'derapage', id: 'j1' }, { type: 'derapage', id: 'j2' }, { type: 'inconnu' }, { type: 'tour', id: 'j1' }], 'j2').length, 2);
});
