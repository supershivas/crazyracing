// Le cycle de vie : écran titre → préparation → course → résultats ; réglages,
// sauvegarde, mise à jour, debug. Les règles sont dans course.js, le dessin dans render.js.
import { createPixelCanvas } from './lib/pixel-canvas.js?v=0.1.0';
import { createLoop } from './lib/loop.js?v=0.1.0';
import { createKeys, stopTypeahead } from './lib/keys.js?v=0.1.0';
import { lockBrowserGestures } from './lib/pointer.js?v=0.1.0';
import { createGamepad } from './lib/gamepad.js?v=0.1.0';
import { createStore, autosave, pickJSONFile } from './lib/save.js?v=0.1.0';
import { createAudio } from './lib/audio.js?v=0.1.0';
import { startUpdateCheck, loadVersion, loadChangelog, downloadJSON } from './lib/app-update.js?v=0.1.0';
import { ROLES } from './palette.js?v=0.1.0';
import { nouvelleCourse, avancerCourse, grille, PNEUS } from './course.js?v=0.1.0';
import { construirePiste } from './piste.js?v=0.1.0';
import { creerDecor, creerVue, dessiner, dessinerCarte } from './render.js?v=0.1.0';
import { chargerContenu } from './design-store.js?v=0.1.0';
import { creerEntrees, creerTactile } from './entrees.js?v=0.1.0';
import { majHud, message, feux, viderHud, temps, tempsPrecis } from './hud.js?v=0.1.0';
import { CIRCUITS } from './data/circuits.js?v=0.1.0';

const JEU = 'crazyracing';
const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// Une seule source pour les couleurs : la palette, posée en variables CSS
for (const [role, couleur] of Object.entries(ROLES)) document.documentElement.style.setProperty(`--jeu-${role}`, couleur);

const OPTIONS = { circuit: 'port', tours: 5, meteo: 'sec', pneu: 'slick', adversaires: 7, niveau: 'moyen', bonus: true };
const store = createStore({
  game: JEU,
  debug: DEBUG,
  entries: {
    // records : { [circuit]: { meilleur, fantome: { temps, pts } } } ; circuits : ceux de l'éditeur
    partie: { version: 1, defaults: { records: {}, options: OPTIONS, circuits: [] } },
    prefs: { version: 1, debugWrites: false, defaults: { musique: 70, effets: 80, pseudo: 'Pilote' } },
  },
  secret: ['gh-token'],
});
const prefs = store.load('prefs');
const profil = store.load('partie');
const audio = createAudio({ music: prefs.musique / 100, sfx: prefs.effets / 100 });
audio.unlockOn(document);
for (const [nom, def] of Object.entries({
  bip: { type: 'square', freq: 440, dur: 0.12, vol: 0.25 },
  depart: { type: 'square', freq: 880, dur: 0.4, vol: 0.3 },
  bonus: [{ type: 'triangle', freq: 660, dur: 0.07, vol: 0.3 }, { type: 'triangle', freq: 990, dur: 0.12, vol: 0.3, at: 0.07 }],
  turbo: { type: 'sawtooth', freq: 180, to: 700, dur: 0.5, vol: 0.28 },
  crissement: { type: 'noise', dur: 0.14, vol: 0.12, filter: 3200 },
  penalite: [{ type: 'sawtooth', freq: 200, dur: 0.12, vol: 0.3 }, { type: 'sawtooth', freq: 150, dur: 0.2, vol: 0.3, at: 0.12 }],
  tour: [{ type: 'triangle', freq: 523, dur: 0.07 }, { type: 'triangle', freq: 784, dur: 0.14, at: 0.07 }],
})) audio.define(nom, def);

const contenu = await chargerContenu();
const sprites = contenu.sprites;
const R = contenu.reglages;

const px = createPixelCanvas($('canvas'), { width: 384, height: 216, mode: 'extend', maxZoom: 2 });
lockBrowserGestures($('ecran'));
stopTypeahead();

// ─── Les circuits : fournis + ceux de l'éditeur ────────────────────────────
const tousLesCircuits = () => [...CIRCUITS, ...(profil.circuits || [])];
const circuitPar = id => tousLesCircuits().find(c => c.id === id) ?? CIRCUITS[0];

// ─── État de la course en cours ────────────────────────────────────────────
let course = null;
let decor = null;
let vue = creerVue();
let miniCarte = null;
let derniereOptions = null;
let joueur = null;
let prochainPneu = 'slick';
let fantome = null;
let fini = false;
const decors = new Map();

const enJeu = () => !!course && $('titre').hidden && !$('dialogue-resultats').open;
function sauvegarder() { store.save('partie', profil); }
function toast(texte) {
  const t = $('toast');
  t.textContent = texte;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2500);
}

// ─── Écrans ────────────────────────────────────────────────────────────────
function montrerTitre() {
  loop.pause();
  course = null;
  $('titre').hidden = false;
  $('hud').hidden = true;
  $('m-course').focus();
}

function decorDe(def) {
  const cle = JSON.stringify([def.points, def.largeur, def.theme]);
  if (!decors.has(cle)) {
    if (decors.size > 3) decors.clear();
    decors.set(cle, creerDecor(construirePiste(def), def, sprites, R));
  }
  const d = decors.get(cle);
  d.traces.getContext('2d').clearRect(0, 0, d.W, d.H);
  return d;
}

function lancer(options) {
  derniereOptions = options;
  const def = circuitPar(options.circuit);
  const chrono = options.mode === 'chrono';
  fantome = chrono ? profil.records[def.id]?.fantome ?? null : null;
  const voitures = chrono
    ? [{ id: 'j1', nom: prefs.pseudo, humain: true, pneu: options.pneu }]
    : grille(options.adversaires, { niveau: options.niveau, pneu: options.pneu }).map(v => (v.humain ? { ...v, nom: prefs.pseudo, pneu: options.pneu } : v));
  course = nouvelleCourse(def, {
    mode: chrono ? 'chrono' : 'course',
    tours: options.tours,
    meteo: options.meteo,
    graine: window.__seed ?? (Date.now() % 100000),
    voitures,
    bonus: !chrono && options.bonus,
    fantome,
    R,
  });
  joueur = course.voitures.find(v => v.humain);
  prochainPneu = options.pneu;
  decor = decorDe(def);
  vue = creerVue();
  miniCarte = dessinerCarte($('hud-carte'), course.piste);
  fini = false;
  viderHud();
  $('hud-messages').replaceChildren();
  entrees.reinitialiser();
  $('titre').hidden = true;
  $('hud').hidden = false;
  $('dialogue-resultats').close();
  tactile.afficher(matchMedia('(pointer: coarse)').matches);
  construireChoixPneus();
  loop.resume();
}

function construireChoixPneus() {
  const noms = { slick: 'Slick', inter: 'Inter', pluie: 'Pluie' };
  $('pneu-choix').replaceChildren(...PNEUS.map((p, i) => el('button', {
    textContent: `${i + 1} ${noms[p]}`,
    onclick: () => { prochainPneu = p; audio.sfx('clic'); },
  })));
  [...$('pneu-choix').children].forEach((b, i) => { b.dataset.pneu = PNEUS[i]; });
}

function pause() {
  if (!enJeu() || loop.paused) return;
  loop.pause();
  $('dialogue-pause').showModal();
}

// ─── Préparer une course ───────────────────────────────────────────────────
function segment(nom, choix, valeur) {
  const f = el('div', { className: 'segment' });
  for (const [v, texte] of choix) {
    const id = `${nom}-${v}`;
    f.append(el('label', { htmlFor: id }, el('input', { type: 'radio', name: nom, value: v, id, checked: v === valeur }), texte));
  }
  return f;
}
function pasPas(nom, min, max, valeur) {
  const sortie = el('output', { textContent: valeur });
  const n = el('input', { type: 'hidden', name: nom, value: valeur });
  const bouger = d => { const v = Math.max(min, Math.min(max, +n.value + d)); n.value = v; sortie.textContent = v; };
  return el('div', { className: 'pas' },
    el('button', { type: 'button', textContent: '−', ariaLabel: 'Moins', onclick: () => bouger(-1) }), sortie,
    el('button', { type: 'button', textContent: '+', ariaLabel: 'Plus', onclick: () => bouger(1) }), n);
}
const champ = (legende, contenu) => el('fieldset', { className: 'champ' }, el('legend', { textContent: legende }), contenu);

function preparer(mode) {
  const o = { ...OPTIONS, ...profil.options };
  $('course-titre').textContent = mode === 'chrono' ? 'Contre la montre' : 'Course';
  $('c-circuits').replaceChildren(...tousLesCircuits().map(def => {
    const piste = construirePiste(def);
    const cv = el('canvas');
    dessinerCarte(cv, piste, 64)([]);
    const rec = profil.records[def.id]?.meilleur;
    return el('label', {}, el('input', { type: 'radio', name: 'circuit', value: def.id, checked: def.id === o.circuit }), cv,
      el('span', {}, def.nom, el('small', { textContent: `${Math.round(piste.longueur)} m${rec ? ` · record ${temps(rec)}` : ''}` })));
  }));
  const champs = [
    champ('Tours', pasPas('tours', 1, 20, o.tours)),
    champ('Météo', segment('meteo', [['sec', 'Sec'], ['humide', 'Humide'], ['pluie', 'Pluie'], ['variable', 'Variable']], o.meteo)),
    champ('Pneus au départ', segment('pneu', [['slick', 'Slick'], ['inter', 'Inter'], ['pluie', 'Pluie']], o.pneu)),
  ];
  if (mode !== 'chrono') {
    champs.push(
      champ('Adversaires', pasPas('adversaires', 0, 9, o.adversaires)),
      champ('Niveau', segment('niveau', [['facile', 'Facile'], ['moyen', 'Moyen'], ['difficile', 'Difficile']], o.niveau)),
      champ('Bonus', segment('bonus', [['1', 'Oui'], ['0', 'Non']], o.bonus ? '1' : '0')),
    );
  }
  $('c-champs').replaceChildren(...champs);
  const d = $('dialogue-course');
  d.onclose = () => {
    if (d.returnValue !== 'partir') return;
    const f = new FormData($('form-course'));
    const opt = {
      circuit: f.get('circuit') ?? o.circuit, tours: +f.get('tours'), meteo: f.get('meteo'), pneu: f.get('pneu'),
      adversaires: +(f.get('adversaires') ?? o.adversaires), niveau: f.get('niveau') ?? o.niveau, bonus: (f.get('bonus') ?? (o.bonus ? '1' : '0')) === '1',
    };
    profil.options = opt;
    sauvegarder();
    lancer({ ...opt, mode });
  };
  d.returnValue = '';
  d.showModal();
}

$('m-course').onclick = () => preparer('course');
$('m-chrono').onclick = () => preparer('chrono');
$('pause').onclick = pause;
$('reprendre').onclick = () => { $('dialogue-pause').close(); };
$('dialogue-pause').addEventListener('close', () => { if (enJeu()) loop.resume(); });
$('recommencer').onclick = () => { $('dialogue-pause').close(); lancer(derniereOptions); };
$('quitter').onclick = () => { $('dialogue-pause').close(); montrerTitre(); };
$('pause-reglages').onclick = () => $('dialogue-reglages').showModal();
$('ouvrir-reglages').onclick = () => $('dialogue-reglages').showModal();
$('res-rejouer').onclick = () => lancer(derniereOptions);
$('res-menu').onclick = () => { $('dialogue-resultats').close(); montrerTitre(); };
$('bonus-case').onclick = () => entrees.declencherBonus();
// Fenêtre quittée : pause (section 9)
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ─── Réglages ──────────────────────────────────────────────────────────────
for (const [id, cle, canal] of [['vol-musique', 'musique', 'music'], ['vol-effets', 'effets', 'sfx']]) {
  $(id).value = prefs[cle];
  $(id).oninput = e => {
    prefs[cle] = Number(e.target.value);
    audio.setVolume(canal, prefs[cle] / 100);
    store.save('prefs', prefs);
    if (canal === 'sfx') audio.sfx('clic');
  };
}
$('pseudo').value = prefs.pseudo;
$('pseudo').onchange = e => { prefs.pseudo = e.target.value.trim().slice(0, 12) || 'Pilote'; e.target.value = prefs.pseudo; store.save('prefs', prefs); };
$('exporter').onclick = () => { sauvegarder(); downloadJSON(store.exportAll(), `${JEU}-sauvegarde.json`); };
$('importer').onclick = async () => {
  try {
    const n = store.importAll(await pickJSONFile());
    toast(`${n} élément(s) importé(s)`);
    setTimeout(() => location.reload(), 800);
  } catch (e) { toast(e.message); }
};
loadVersion().then(v => { $('version').textContent = v ? `v${v}` : ''; });
loadChangelog().then(liste => {
  $('changelog').replaceChildren(...liste.flatMap(e => [
    el('h3', { textContent: `v${e.version} — ${e.date}` }),
    el('ul', {}, ...e.changes.map(c => el('li', { textContent: c }))),
  ]));
});

// ─── Commandes : clavier, manette, doigt (section 8) ───────────────────────
const keys = createKeys({
  actions: { pause: ['Escape', 'p'], bonus: [' ', 'e', 'Enter'], p1: '1', p2: '2', p3: '3' },
  onAction: nom => {
    if (nom === 'pause') pause();
    else if (nom === 'bonus' && enJeu()) entrees.declencherBonus();
    else if (/^p[123]$/.test(nom) && enJeu()) prochainPneu = PNEUS[+nom[1] - 1];
  },
});
const pad = createGamepad({ actions: { pause: 'start' }, onAction: nom => { if (nom === 'pause') pause(); } });
const tactile = creerTactile($('tactile'));
const entrees = creerEntrees({ keys, pad, tactile });

// ─── Les événements de la course : sons, messages, résultats ───────────────
const NOMS_BONUS = { turbo: 'turbo', pilote: 'pilote automatique', bouclier: 'bouclier' };
let dernierCrissement = -1;
function traiter(ev) {
  for (const e of ev) {
    const moi = e.id === joueur.id;
    switch (e.type) {
      case 'feu': audio.sfx('bip'); break;
      case 'depart': audio.sfx('depart'); break;
      case 'bonus': if (moi) { audio.sfx('bonus'); message(e.bonus === 'reparation' ? 'Pneus réparés' : `Bonus : ${NOMS_BONUS[e.bonus]}`, 'bon'); } break;
      case 'bonus-use': if (moi && e.bonus === 'turbo') audio.sfx('turbo'); break;
      case 'choc': if (e.a === joueur.id || e.b === joueur.id) audio.sfx('coup'); break;
      case 'mur': if (moi && e.vitesse > 60) audio.sfx('coup'); break;
      case 'crevaison': if (moi) message('Crevaison ! Direction les stands', 'mauvais'); break;
      case 'derapage': if (course.t - dernierCrissement > 0.25) { dernierCrissement = course.t; audio.sfx('crissement'); } break;
      case 'limites': if (moi) { audio.sfx('erreur'); message(`Limites de piste (${e.avert % 3 || 3}/3)`, 'mauvais'); } break;
      case 'penalite': if (moi) { audio.sfx('penalite'); message(`Pénalité +${e.secondes} s — ${e.raison === 'limites' ? 'limites de piste' : 'collision'}`, 'mauvais'); } break;
      case 'tour': if (moi) { audio.sfx('tour'); message(`Tour ${e.tour} : ${temps(e.temps)}${e.meilleur ? ' · meilleur tour' : ''}`, e.meilleur ? 'bon' : ''); } break;
      case 'stand': if (moi) { audio.sfx('validation'); message(`Pneus changés : ${e.pneu}`, 'bon'); } break;
      case 'remise': if (moi) message('Remis en piste par les commissaires'); break;
      case 'record': if (moi) message('Nouveau record du circuit !', 'bon'); break;
      case 'arrivee': if (moi) message('Drapeau à damiers !', 'bon'); break;
      case 'fin': finir(); break;
      default: break;
    }
  }
}

function finir() {
  if (fini) return;
  fini = true;
  loop.pause();
  const def = circuitPar(derniereOptions.circuit);
  const rec = profil.records[def.id];
  let note = '';
  if (course.mode === 'chrono') {
    if (course.meilleurTour != null && (!rec?.meilleur || course.meilleurTour < rec.meilleur)) {
      profil.records[def.id] = { meilleur: course.meilleurTour, fantome: { temps: course.meilleurTour, pts: course.fantomeNouveau } };
      note = 'Nouveau record du circuit ! Votre fantôme le rejouera.';
    }
  } else {
    const moi = course.classement.find(r => r.id === joueur.id);
    note = moi?.pos === 1 ? 'Victoire !' : moi?.pos <= 3 ? 'Sur le podium !' : '';
    if (joueur.meilleur != null && (!rec?.meilleur || joueur.meilleur < rec.meilleur)) profil.records[def.id] = { ...rec, meilleur: joueur.meilleur };
  }
  sauvegarder();
  $('res-titre').textContent = course.mode === 'chrono' ? 'Contre la montre' : 'Arrivée';
  $('res-note').textContent = note;
  let lignes;
  if (course.mode === 'chrono') {
    lignes = [el('tr', {}, ...['#', 'Tour', 'Temps'].map(t => el('th', { textContent: t })))];
    joueur.tours.forEach((t, i) => lignes.push(el('tr', { className: t === joueur.meilleur ? 'moi' : '' }, el('td', { textContent: i + 1 }), el('td', { textContent: `Tour ${i + 1}` }), el('td', { textContent: tempsPrecis(t) }))));
  } else {
    lignes = [el('tr', {}, ...['#', 'Pilote', 'Temps', 'Meilleur'].map(t => el('th', { textContent: t })))];
    const gagnant = course.classement.find(r => r.fini);
    for (const r of course.classement) {
      const temp = r.fini ? (r === gagnant ? tempsPrecis(r.temps) : `+${(r.temps - gagnant.temps).toFixed(1)}`) : 'abandon';
      lignes.push(el('tr', { className: r.id === joueur.id ? 'moi' : '' },
        el('td', { textContent: r.pos }), el('td', { textContent: r.nom }),
        el('td', { textContent: `${temp}${r.penalite ? ` (+${r.penalite} s)` : ''}` }), el('td', { textContent: temps(r.meilleur) })));
    }
  }
  $('res-table').replaceChildren(...lignes);
  $('dialogue-resultats').showModal();
  $('res-rejouer').focus();
}

// ─── Boucle ────────────────────────────────────────────────────────────────
const loop = createLoop({
  update(dt) {
    if (!course || course.phase === 'fin') return;
    const cmd = entrees.lire(dt);
    cmd.pneu = prochainPneu;
    traiter(avancerCourse(course, dt, { [joueur.id]: cmd }));
  },
  render() {
    if (!course) { px.ctx.fillStyle = ROLES.fond; px.ctx.fillRect(0, 0, px.width, px.height); return; }
    dessiner(px.ctx, course, vue, px, decor, sprites, { suivre: joueur.id, fantome });
    majHud(course, joueur, { meilleurPerso: profil.records[course.def.id]?.meilleur, prochainPneu });
    feux(course);
    miniCarte?.(course.voitures);
  },
});
loop.start();
loop.pause();
autosave(sauvegarder, { everyMs: 10000 });

// ─── Mise à jour automatique : jamais en pleine course (section 4) ─────────
startUpdateCheck({
  isBusy: () => enJeu() && !loop.paused,
  beforeReload: sauvegarder,
  onUpdated: v => toast(`Mis à jour en v${v}`),
});

// ─── Mode debug (section 18) : chargé seulement avec ?debug=1 ──────────────
if (DEBUG) {
  const { installDebug, seedFromUrl } = await import('./lib/debug.js?v=0.1.0');
  window.__seed = seedFromUrl() ?? undefined;
  const placer = p => {
    if (!course) return;
    const i = Math.floor((p.s % 1) * course.piste.n), pt = course.piste.pts[i];
    Object.assign(joueur, { x: pt.x, y: pt.y, i, vx: 0, vy: 0, cap: Math.atan2(pt.ty, pt.tx) });
  };
  installDebug({
    state: () => course && { phase: course.phase, t: course.t, eau: course.eau, pos: joueur.pos, tour: joueur.tour, s: joueur.s, d: joueur.d, vitesse: joueur.vitesse, usure: joueur.usure, penalite: joueur.penalite, enJeu: enJeu(), pause: loop.paused },
    places: { depart: { s: 0 }, quart: { s: 0.25 }, milieu: { s: 0.5 } },
    teleport: placer,
    setTimeScale: s => loop.setTimeScale(s),
    setSeed: n => { window.__seed = n; if (derniereOptions) lancer(derniereOptions); },
    reset: () => { store.clear('partie'); montrerTitre(); },
    extra: {
      jouer: (o = {}) => lancer({ ...OPTIONS, mode: 'course', ...o }),
      course: () => course,
      autopilote: () => { if (joueur) joueur.pilote = 1e9; },
    },
  });
}

if (contenu.aPublier) toast(`${contenu.aPublier} retouche(s) de l'atelier pas encore publiée(s)`);
montrerTitre();
