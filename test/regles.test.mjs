// Les règles du jeu, sans navigateur : node outils/test-run.mjs
import { readFileSync } from 'node:fs';
import { CIRCUITS } from '../js/data/circuits.js';
import { REGLAGES } from '../js/data/reglages.js';
import { construirePiste, verifierPiste, projeter, pointA } from '../js/piste.js';
import { nouvelleVoiture, pasVoiture, adherence } from '../js/voiture.js';
import { nouvelleCourse, avancerCourse, grille, eauCible } from '../js/course.js';
import { circuitVersCode, codeVersCircuit, normaliserCircuit } from '../js/circuit-code.js';
import { SPRITES } from '../js/sprites-data.js';
import { PALETTE } from '../js/palette.js';
import { validateSprite } from '../js/lib/sprites.js';

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
const contexte = { sol: 'piste', eau: 0, R };
test('à pleins gaz, la voiture approche sa vitesse maximale, pas plus', () => {
  const v = nouvelleVoiture({ cap: 0 });
  for (let i = 0; i < 60 * 30; i++) pasVoiture(v, { gaz: 1, frein: 0, volant: 0 }, 1 / 60, contexte);
  assert.ok(v.vitesse > R.voiture.vmax * 0.93 && v.vitesse < R.voiture.vmax * 1.02, `v=${v.vitesse}`);
});
test('le frein arrête la voiture', () => {
  const v = nouvelleVoiture({ cap: 0 });
  v.vx = 150;
  for (let i = 0; i < 60 * 4; i++) pasVoiture(v, { gaz: 0, frein: 1, volant: 0 }, 1 / 60, contexte);
  assert.ok(v.vitesse < 1, `v=${v.vitesse}`);
  for (let i = 0; i < 60 * 3; i++) pasVoiture(v, { gaz: 0, frein: 1, volant: 0, recul: true }, 1 / 60, contexte);
  assert.ok(v.vx < -5, 'le frein maintenu fait reculer quand le jeu le demande');
});
test('braquer trop vite fait glisser : la trajectoire s\'écarte du cap', () => {
  const v = nouvelleVoiture({ cap: 0 });
  v.vx = 190;
  for (let i = 0; i < 20; i++) pasVoiture(v, { gaz: 1, frein: 0, volant: 1 }, 1 / 60, contexte);
  const ecart = Math.abs(Math.atan2(v.vy, v.vx) - v.cap);
  assert.ok(ecart > 0.05, `écart ${ecart}`);
});
test('l\'herbe, l\'eau sur slicks et l\'usure réduisent l\'adhérence ; la pluie préfère les pneus pluie', () => {
  const v = nouvelleVoiture({});
  v.chaleur = 0.6;
  const sec = adherence(v, 0, 'piste', R);
  assert.ok(adherence(v, 0, 'herbe', R) < sec);
  assert.ok(adherence(v, 0.9, 'piste', R) < sec * 0.6);
  v.usure = 0.9;
  assert.ok(adherence(v, 0, 'piste', R) < sec);
  v.usure = 0; v.pneu = 'pluie';
  assert.ok(adherence(v, 0.9, 'piste', R) > adherence({ ...v, pneu: 'slick' }, 0.9, 'piste', R));
});
test('des pneus froids tiennent moins que des pneus chauds', () => {
  const v = nouvelleVoiture({}); v.chaleur = 0.1;
  const froid = adherence(v, 0, 'piste', R);
  v.chaleur = 0.6;
  assert.ok(adherence(v, 0, 'piste', R) > froid);
});

group('course');
const nouvelle = (id = 'port', opts = {}) => nouvelleCourse(CIRCUITS.find(c => c.id === id), { tours: 2, voitures: grille(5), graine: 3, ...opts });
test('même graine, mêmes commandes, même course', () => {
  const a = nouvelle('dunes', { bonus: true, meteo: 'variable' }), b = nouvelle('dunes', { bonus: true, meteo: 'variable' });
  pilote(a).pilote = pilote(b).pilote = 1e9;
  rouler(a, 30); rouler(b, 30);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});
test('les voitures sont immobiles pendant les feux, puis partent', () => {
  const c = nouvelle();
  rouler(c, 2);
  assert.equal(c.phase, 'feux');
  assert.ok(c.voitures.every(v => v.vitesse === 0));
  rouler(c, 3);
  assert.equal(c.phase, 'course');
  assert.ok(c.voitures.some(v => v.vitesse > 20));
});
test('une course de l\'IA se termine : tout le monde arrive, classement trié', () => {
  const c = nouvelle();
  pilote(c).pilote = 1e9;
  rouler(c, 200);
  assert.equal(c.phase, 'fin');
  assert.equal(c.classement.length, 6);
  const temps = c.classement.filter(r => r.fini).map(r => r.temps);
  assert.deepEqual(temps, [...temps].sort((a, b) => a - b));
  assert.ok(temps.length >= 5);
});
test('les tours sont comptés et chronométrés', () => {
  const c = nouvelle('port', { voitures: grille(0) });
  pilote(c).pilote = 1e9;
  const tours = rouler(c, 120).filter(e => e.type === 'tour');
  assert.equal(tours.length, 2);
  assert.ok(tours.every(t => t.temps > 8 && t.temps < 40), JSON.stringify(tours));
  assert.ok(pilote(c).fini);
});
test('sortir de la piste prévient, puis pénalise (5 s toutes les 3 sorties)', () => {
  const c = nouvelle('port', { voitures: grille(0) });
  rouler(c, 5);
  const v = pilote(c);
  for (let k = 0; k < 3; k++) {
    poser(c, v, 1200, 0, { tour: 0 }); avancerCourse(c, 1 / 60, {});
    poser(c, v, 1200, c.piste.largeur / 2 + 6); avancerCourse(c, 1 / 60, {});
  }
  assert.equal(v.avert, 3);
  assert.equal(v.penalite, R.limites.penalite);
});
test('un arrêt au stand remet des pneus neufs', () => {
  const c = nouvelle('port', { voitures: grille(0) });
  rouler(c, 5);
  const v = pilote(c);
  v.usure = 0.8; v.prochainPneu = 'inter';
  poser(c, v, 22, c.piste.largeur / 2 + 8, { tour: 0 }); // dans le box
  const evs = rouler(c, 4, () => ({ [v.id]: { gaz: 0, frein: 1, volant: 0 } }));
  assert.ok(evs.some(e => e.type === 'stand'));
  assert.equal(v.pneu, 'inter');
  assert.ok(v.usure < 0.02);
});
test('la météo : pluie dès la grille ; le temps variable change vraiment', () => {
  assert.equal(nouvelle('port', { meteo: 'pluie' }).eau, 0.9);
  const d = nouvelle('port', { meteo: 'variable' });
  const vals = []; for (let t = 0; t < 160; t += 5) vals.push(eauCible(d, t));
  assert.ok(Math.max(...vals) > 0.5 && Math.min(...vals) < 0.1, 'le temps change');
});
test('un bonus ramassé se garde, le turbo se déclenche à la demande', () => {
  const c = nouvelle('port', { voitures: grille(0), bonus: true });
  rouler(c, 4);
  const v = pilote(c);
  c.bonus[0].type = 'turbo'; c.bonus[0].retour = 0;
  poser(c, v, c.bonus[0].s);
  Object.assign(v, { x: c.bonus[0].x, y: c.bonus[0].y });
  avancerCourse(c, 1 / 60, {});
  assert.equal(v.bonus, 'turbo');
  const evs = avancerCourse(c, 1 / 60, { [v.id]: { gaz: 1, frein: 0, volant: 0, bonus: true } });
  assert.ok(evs.some(e => e.type === 'bonus-use'));
  assert.ok(v.turbo > 0 && v.bonus === null);
});
test('coincé, on est remis en piste', () => {
  const c = nouvelle('port', { voitures: grille(0) });
  rouler(c, 4);
  const v = pilote(c);
  poser(c, v, 800, c.piste.largeur / 2 + 15);
  const evs = rouler(c, 7, () => ({ [v.id]: { gaz: 0, frein: 0, volant: 0 } }));
  assert.ok(evs.some(e => e.type === 'remise'));
});
test('aucun hasard ni horloge dans les règles', () => {
  for (const f of ['course', 'voiture', 'ia', 'piste']) {
    const src = readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8');
    assert.ok(!/Math\.random|Date\.now|performance\.now|crypto\./.test(src), `${f}.js doit rester pur (section 10)`);
  }
});

group('dessins');
test('chaque sprite est dans la palette', () => {
  for (const [nom, rows] of Object.entries(SPRITES)) assert.deepEqual(validateSprite(rows, PALETTE), [], nom);
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
