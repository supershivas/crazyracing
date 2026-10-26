// Le cycle de vie : écran titre → préparation → course → résultats ; réglages,
// sauvegarde, mise à jour, debug. Les règles sont dans course.js, le dessin dans render.js.
import { createPixelCanvas } from './lib/pixel-canvas.js?v=0.3.0';
import { createLoop } from './lib/loop.js?v=0.3.0';
import { createKeys, stopTypeahead } from './lib/keys.js?v=0.3.0';
import { lockBrowserGestures } from './lib/pointer.js?v=0.3.0';
import { createGamepad } from './lib/gamepad.js?v=0.3.0';
import { createStore, autosave, pickJSONFile } from './lib/save.js?v=0.3.0';
import { createAudio } from './lib/audio.js?v=0.3.0';
import { startUpdateCheck, loadVersion, loadChangelog, downloadJSON } from './lib/app-update.js?v=0.3.0';
import { ROLES } from './palette.js?v=0.3.0';
import { nouvelleCourse, avancerCourse, grille, grilleLigne, PNEUS } from './course.js?v=0.3.0';
import { construirePiste } from './piste.js?v=0.3.0';
import { creerDecor, creerVue, dessiner, dessinerCarte } from './render.js?v=0.3.0';
import { chargerContenu } from './design-store.js?v=0.3.0';
import { creerEntrees, creerTactile } from './entrees.js?v=0.3.0';
import { majHud, message, feux, viderHud, temps, tempsPrecis } from './hud.js?v=0.3.0';
import { CIRCUITS } from './data/circuits.js?v=0.3.0';
import { creerEditeur } from './editeur.js?v=0.3.0';
import { circuitVersCode, codeVersCircuit, normaliserCircuit } from './circuit-code.js?v=0.3.0';
import { creerHote, rejoindre, reseauDisponible } from './reseau.js?v=0.3.0';
import { instantane, appliquer, commandeValide, evenementsPourInvite, lisser } from './instantane.js?v=0.3.0';

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
const defDe = options => options.def ?? circuitPar(options.circuit);

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
let ligne = null; // la course en ligne : { role: 'hote' | 'invite', lien, … }
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
  quitterLigne();
  loop.pause();
  course = null;
  editeur.fermer();
  $('titre').hidden = false;
  $('hud').hidden = true;
  $('m-course').focus();
}

// De la course ou des résultats : on revient où l'on était (l'éditeur si on essayait un circuit)
function quitterCourse() {
  if (derniereOptions?.retour === 'editeur' && brouillonEditeur) { course = null; $('hud').hidden = true; ouvrirEditeur(brouillonEditeur); } else montrerTitre();
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
  const def = defDe(options);
  const chrono = options.mode === 'chrono';
  fantome = chrono ? profil.records[def.id]?.fantome ?? null : null;
  const graine = window.__seed ?? (Date.now() % 100000);
  let voitures;
  if (chrono) voitures = [{ id: 'j1', nom: prefs.pseudo, humain: true, pneu: options.pneu }];
  else if (ligne?.role === 'hote') voitures = grilleLigne(options.adversaires, [{ id: 'j1', nom: prefs.pseudo }, { id: 'j2', nom: ligne.nomInvite }], { niveau: options.niveau, pneu: options.pneu });
  else voitures = grille(options.adversaires, { niveau: options.niveau, pneu: options.pneu }).map(v => (v.humain ? { ...v, nom: prefs.pseudo, pneu: options.pneu } : v));
  course = nouvelleCourse(def, { mode: chrono ? 'chrono' : 'course', tours: options.tours, meteo: options.meteo, graine, voitures, bonus: !chrono && options.bonus, fantome, R });
  if (ligne?.role === 'hote') {
    ligne.evAcc = []; ligne.pas = 0; ligne.snaps = 0; ligne.cmd = commandeValide({});
    ligne.lien.envoyer({ k: 'go', def: normaliserCircuit({ ...def, id: 'ligne' }), options: { tours: options.tours, meteo: options.meteo, bonus: options.bonus }, voitures, graine, moi: 'j2' });
  }
  installerScene(def, options.pneu, 'j1');
}

// Ce que la course a de commun, jouée seul, hôte ou invité : on installe décor, HUD, commandes
function installerScene(def, pneu, idMoi) {
  joueur = course.voitures.find(v => v.id === idMoi);
  prochainPneu = pneu;
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
  $('res-rejouer').hidden = ligne?.role === 'invite';
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

function pause(manuel = false) {
  if (!enJeu() || loop.paused) return;
  if (ligne) { // en ligne, la course ne s'arrête pas : le menu propose seulement de quitter
    if (manuel && !$('dialogue-pause').open) { $('recommencer').hidden = true; $('dialogue-pause').showModal(); }
    return;
  }
  loop.pause();
  $('recommencer').hidden = false;
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
  $('course-titre').textContent = mode === 'chrono' ? 'Contre la montre' : mode === 'ligne' ? 'Course en ligne' : 'Course';
  $('c-partir').textContent = mode === 'ligne' ? 'Créer la salle' : 'Partir';
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
    if (mode === 'ligne') ouvrirSalle({ ...opt, mode: 'course', ligne: 'hote' }); else lancer({ ...opt, mode });
  };
  d.returnValue = '';
  d.showModal();
}

$('m-course').onclick = () => preparer('course');
$('m-chrono').onclick = () => preparer('chrono');
$('pause').onclick = () => pause(true);
$('reprendre').onclick = () => { $('dialogue-pause').close(); };
$('dialogue-pause').addEventListener('close', () => { if (enJeu()) loop.resume(); });
$('recommencer').onclick = () => { $('dialogue-pause').close(); lancer(derniereOptions); };
$('quitter').onclick = () => { $('dialogue-pause').close(); quitterCourse(); };
$('pause-reglages').onclick = () => $('dialogue-reglages').showModal();
$('ouvrir-reglages').onclick = () => $('dialogue-reglages').showModal();
$('res-rejouer').onclick = () => lancer(derniereOptions);
$('res-menu').onclick = () => { $('dialogue-resultats').close(); quitterCourse(); };
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
    if (nom === 'pause') pause(true);
    else if (nom === 'bonus' && enJeu()) entrees.declencherBonus();
    else if (/^p[123]$/.test(nom) && enJeu()) prochainPneu = PNEUS[+nom[1] - 1];
  },
});
const pad = createGamepad({ actions: { pause: 'start' }, onAction: nom => { if (nom === 'pause') pause(true); } });
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
      case 'derapage': if (moi && course.t - dernierCrissement > 0.25) { dernierCrissement = course.t; audio.sfx('crissement'); } break;
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
  const def = defDe(derniereOptions);
  const rec = profil.records[def.id];
  const essai = def.id === 'essai' || !!derniereOptions.ligne; // circuit pas enregistré, ou course en ligne : pas de record
  let note = '';
  if (course.mode === 'chrono') {
    if (!essai && course.meilleurTour != null && (!rec?.meilleur || course.meilleurTour < rec.meilleur)) {
      profil.records[def.id] = { meilleur: course.meilleurTour, fantome: { temps: course.meilleurTour, pts: course.fantomeNouveau } };
      note = 'Nouveau record du circuit ! Votre fantôme le rejouera.';
    }
  } else {
    const moi = course.classement.find(r => r.id === joueur.id);
    note = moi?.pos === 1 ? 'Victoire !' : moi?.pos <= 3 ? 'Sur le podium !' : '';
    if (!essai && joueur.meilleur != null && (!rec?.meilleur || joueur.meilleur < rec.meilleur)) profil.records[def.id] = { ...rec, meilleur: joueur.meilleur };
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

// ─── L'éditeur de circuits ─────────────────────────────────────────────────
let brouillonEditeur = null;
const ovale = () => [[300, 130], [560, 110], [820, 180], [880, 350], [760, 520], [480, 560], [210, 500], [130, 320]];
const nouveauCircuit = () => ({ nom: 'Mon circuit', theme: 'prairie', largeur: 34, tours: 3, points: ovale() });

const editeur = creerEditeur({
  px, canvas: $('canvas'), racine: $('editeur'),
  onTester: def => {
    brouillonEditeur = structuredClone(editeur.circuit);
    editeur.fermer();
    lancer({ mode: 'chrono', def: { ...def, id: 'essai' }, circuit: 'essai', tours: 3, meteo: 'sec', pneu: 'slick', retour: 'editeur' });
  },
  onEnregistrer: def => {
    const liste = profil.circuits;
    const i = def.id && def.id !== 'perso' ? liste.findIndex(c => c.id === def.id) : -1;
    if (i >= 0) {
      if (JSON.stringify(liste[i].points) !== JSON.stringify(def.points) || liste[i].largeur !== def.largeur) delete profil.records[def.id]; // un autre tracé : l'ancien record ne vaut plus
      liste[i] = def;
    } else { def.id = `perso-${Date.now().toString(36)}`; liste.push(def); editeur.circuit.id = def.id; }
    sauvegarder();
    toast(`« ${def.nom} » enregistré : il est dans la liste des circuits`);
  },
  onSupprimer: def => {
    const i = profil.circuits.findIndex(c => c.id === def.id);
    if (i >= 0) { profil.circuits.splice(i, 1); delete profil.records[def.id]; sauvegarder(); toast('Circuit supprimé'); }
    montrerTitre();
  },
  onCopier: def => montrerCode('Code du circuit', 'Envoyez ce code à un ami : il le colle dans l\'éditeur (Coller un code).', circuitVersCode(def)),
  onColler: () => montrerCode('Coller un code', 'Collez ici le code d\'un circuit reçu (il commence par CR1.).', '', code => {
    const def = codeVersCircuit(code); // lève une erreur lisible
    editeur.ouvrir({ ...def, id: undefined });
    toast(`« ${def.nom} » importé : à vous de jouer, puis enregistrez-le`);
  }),
  onQuitter: modifie => {
    if (!modifie || confirm('Quitter sans enregistrer les changements ?')) montrerTitre();
  },
});
function ouvrirEditeur(def) {
  $('titre').hidden = true;
  $('hud').hidden = true;
  editeur.ouvrir(def);
  loop.resume();
}
$('m-editeur').onclick = () => {
  const liste = $('mes-circuits');
  liste.replaceChildren(
    el('button', { className: 'bouton', textContent: 'Nouveau circuit', onclick: () => { $('dialogue-circuits').close(); ouvrirEditeur(nouveauCircuit()); } }),
    ...tousLesCircuits().map(def => el('button', {
      className: 'bouton secondaire',
      textContent: `${def.nom}${CIRCUITS.includes(def) ? ' (copier pour modifier)' : ''}`,
      onclick: () => {
        $('dialogue-circuits').close();
        ouvrirEditeur(CIRCUITS.includes(def) ? { ...structuredClone(def), id: undefined, nom: `${def.nom} bis` } : structuredClone(def));
      },
    })),
  );
  $('dialogue-circuits').showModal();
};
// Un code de circuit, à copier ou à coller
function montrerCode(titre, aide, texte, importer) {
  $('code-titre').textContent = titre;
  $('code-aide').textContent = aide;
  const t = $('code-texte');
  t.value = texte; t.readOnly = !importer;
  $('code-ok').textContent = importer ? 'Importer' : 'Fermer';
  $('code-copier').hidden = !!importer;
  const d = $('dialogue-code');
  $('code-ok').onclick = () => {
    if (!importer) return d.close();
    try { importer(t.value); d.close(); } catch (e) { $('code-aide').textContent = e.message; }
  };
  $('code-copier').onclick = async () => {
    try { await navigator.clipboard.writeText(t.value); toast('Code copié'); } catch { t.select(); toast('Sélectionné : copiez-le avec Ctrl+C'); }
  };
  d.showModal();
  t.focus(); t.select();
}

// ─── En ligne, sur le même réseau ──────────────────────────────────────────
// L'hôte fait tourner toute la course ; l'invité lui envoie ses commandes et dessine
// ce que l'hôte lui renvoie (instantane.js), une trentaine de fois par seconde.
const montrerVue = nom => { for (const id of ['ligne-choix', 'ligne-hote', 'ligne-invite']) $(id).hidden = id !== nom; };
const copier = async texte => { try { await navigator.clipboard.writeText(texte); toast('Code copié'); } catch { toast('Sélectionnez le code et copiez-le avec Ctrl+C'); } };

function quitterLigne() {
  if (!ligne) return;
  const l = ligne; ligne = null;
  try { l.lien?.envoyer({ k: 'bye' }); l.lien?.fermer(); } catch { /* déjà fermé */ }
}

$('m-ligne').hidden = !reseauDisponible();
$('m-ligne').onclick = () => { montrerVue('ligne-choix'); $('dialogue-ligne').showModal(); };
$('ligne-fermer-choix').onclick = () => $('dialogue-ligne').close();
$('ligne-heberger').onclick = () => { $('dialogue-ligne').close(); preparer('ligne'); };
$('ligne-rejoindre').onclick = () => {
  montrerVue('ligne-invite');
  $('ligne-code-i').value = ''; $('ligne-reponse-i').hidden = true; $('ligne-etat-i').textContent = '';
  $('ligne-connecter').disabled = false;
};
$('ligne-annuler-h').onclick = () => { quitterLigne(); $('dialogue-ligne').close(); };
$('ligne-annuler-i').onclick = () => { quitterLigne(); $('dialogue-ligne').close(); };
$('dialogue-ligne').addEventListener('cancel', () => { if (!enJeu()) quitterLigne(); });
$('ligne-copier-h').onclick = () => copier($('ligne-code-h').value);
$('ligne-copier-r').onclick = () => copier($('ligne-code-r').value);

// L'hôte : crée la salle, donne son code, attend la réponse
async function ouvrirSalle(opt) {
  quitterLigne();
  montrerVue('ligne-hote');
  $('ligne-code-h').value = 'Création du code…'; $('ligne-reponse').value = ''; $('ligne-etat-h').textContent = '';
  $('ligne-lancer').disabled = true;
  $('dialogue-ligne').showModal();
  try {
    const lien = await creerHote();
    ligne = { role: 'hote', lien, opt, nomInvite: 'Invité', pret: false, cmd: commandeValide({}), evAcc: [], pas: 0, snaps: 0 };
    $('ligne-code-h').value = lien.code;
    lien.surMessage = o => {
      if (o.k === 'hello') {
        ligne.nomInvite = String(o.nom ?? 'Invité').replace(/[<>\u0000-\u001f]/g, '').slice(0, 12) || 'Invité';
        if (ligne.nomInvite === prefs.pseudo) ligne.nomInvite = `${ligne.nomInvite.slice(0, 10)} 2`; // deux pilotes qui s'appellent pareil se confondraient
        ligne.pret = true;
        $('ligne-etat-h').textContent = `${ligne.nomInvite} est connecté. À vous de lancer !`;
        $('ligne-lancer').disabled = false;
      } else if (o.k === 'in') ligne.cmd = commandeValide(o);
      else if (o.k === 'bye') lien.fermer();
    };
    lien.surFermeture = () => {
      if (ligne?.lien !== lien) return;
      if (course && enJeu() && !$('dialogue-resultats').open) {
        const v2 = course.voitures.find(v => v.id === 'j2');
        if (v2) { v2.humain = false; v2.niveau = 'moyen'; }
        toast(`${ligne.nomInvite} a quitté la course : sa voiture est reprise par l'ordinateur`);
      } else { $('ligne-etat-h').textContent = 'Connexion perdue.'; $('ligne-lancer').disabled = true; }
      ligne.pret = false;
    };
    $('ligne-valider').onclick = async () => {
      try {
        $('ligne-etat-h').textContent = 'Connexion…';
        await lien.accepter($('ligne-reponse').value);
        await lien.pret;
        $('ligne-etat-h').textContent = 'Connecté, en attente du pseudo de l\'autre joueur…';
      } catch (e) { $('ligne-etat-h').textContent = e.message; }
    };
    $('ligne-lancer').onclick = () => { $('dialogue-ligne').close(); lancer(ligne.opt); };
  } catch (e) { $('ligne-code-h').value = ''; $('ligne-etat-h').textContent = `Impossible de créer le code : ${e.message}`; }
}

// L'invité : colle le code de l'hôte, rend sa réponse, attend le départ
$('ligne-connecter').onclick = async () => {
  quitterLigne();
  $('ligne-connecter').disabled = true;
  $('ligne-etat-i').textContent = 'Création de la réponse…';
  try {
    const lien = await rejoindre($('ligne-code-i').value);
    ligne = { role: 'invite', lien, cibles: new Map(), recu: 0, pas: 0, derniere: '' };
    $('ligne-code-r').value = lien.code; $('ligne-reponse-i').hidden = false;
    $('ligne-etat-i').textContent = 'En attente de l\'hôte…';
    lien.surMessage = o => recevoir(o);
    lien.surFermeture = () => {
      if (ligne?.lien !== lien) return;
      toast('Connexion perdue'); $('dialogue-ligne').close(); $('dialogue-resultats').close(); $('dialogue-pause').close(); montrerTitre();
    };
    lien.pret.then(() => { lien.envoyer({ k: 'hello', nom: prefs.pseudo }); $('ligne-etat-i').textContent = 'Connecté : la course démarre quand l\'hôte la lance.'; }).catch(e => { $('ligne-etat-i').textContent = e.message; $('ligne-connecter').disabled = false; });
  } catch (e) { $('ligne-etat-i').textContent = e.message; $('ligne-connecter').disabled = false; }
};

// Ce que l'invité reçoit de l'hôte
function recevoir(o) {
  if (o.k === 'go') {
    let def;
    try { def = normaliserCircuit({ ...o.def, id: 'essai' }); } catch (e) { toast(e.message); return; }
    const voitures = (Array.isArray(o.voitures) ? o.voitures : []).slice(0, 12).map(v => ({
      id: String(v.id).slice(0, 8), nom: String(v.nom ?? '').replace(/[<>]/g, '').slice(0, 12), humain: !!v.humain, equipe: Number.isInteger(v.equipe) ? v.equipe : undefined,
      pneu: ['slick', 'inter', 'pluie'].includes(v.pneu) ? v.pneu : 'slick', niveau: 'moyen', style: Number.isFinite(v.style) ? v.style : 0.5,
    }));
    const opts = o.options ?? {};
    derniereOptions = { mode: 'course', def, circuit: 'essai', tours: Math.max(1, Math.min(20, opts.tours | 0 || 3)), meteo: ['sec', 'humide', 'pluie', 'variable'].includes(opts.meteo) ? opts.meteo : 'sec', bonus: !!opts.bonus, pneu: voitures.find(v => v.humain)?.pneu ?? 'slick', ligne: 'invite' };
    course = nouvelleCourse(def, { mode: 'course', tours: derniereOptions.tours, meteo: derniereOptions.meteo, graine: Number.isFinite(o.graine) ? o.graine : 1, voitures, bonus: derniereOptions.bonus, R });
    fantome = null;
    ligne.cibles = new Map(); ligne.recu = performance.now(); ligne.pas = 0;
    $('dialogue-ligne').close();
    installerScene(def, derniereOptions.pneu, String(o.moi ?? 'j2'));
    if (!joueur) { toast('Course illisible'); montrerTitre(); }
  } else if (o.k === 'snap' && course && ligne?.role === 'invite' && joueur) {
    const visibles = ligne.cibles.size ? course.voitures.map(v => [v, v.x, v.y, v.cap]) : [];
    const evs = appliquer(course, o);
    ligne.cibles = new Map(course.voitures.map(v => [v.id, { x: v.x, y: v.y, vx: v.vx, vy: v.vy, cap: v.cap }]));
    for (const [v, x, y, cap] of visibles) { v.x = x; v.y = y; v.cap = cap; }
    ligne.recu = performance.now();
    traiter(evs);
    if (course.phase === 'fin' && course.classement && !fini) finir();
  } else if (o.k === 'bye') { toast('L\'hôte a quitté la course'); $('dialogue-resultats').close(); $('dialogue-pause').close(); montrerTitre(); }
}

// Ce que l'hôte envoie : un instantané toutes les deux images ; la trace sèche, plus rarement
function envoyerInstantane(force = false) {
  const evs = evenementsPourInvite(ligne.evAcc, 'j2');
  ligne.evAcc = [];
  ligne.lien.envoyer(instantane(course, evs, { avecTrace: force || ligne.snaps++ % 40 === 0 }));
}

// ─── Boucle ────────────────────────────────────────────────────────────────
const loop = createLoop({
  update(dt) {
    if (editeur.actif) return;
    if (!course || course.phase === 'fin') return;
    const cmd = entrees.lire(dt);
    cmd.pneu = prochainPneu;
    if (ligne?.role === 'invite') { // l'invité conduit, l'hôte calcule
      if (ligne.pas++ % 2 === 0) ligne.lien.envoyer({ k: 'in', ...cmd });
      lisser(course, ligne.cibles, dt, (performance.now() - ligne.recu) / 1000);
      return;
    }
    const commandes = { [joueur.id]: cmd };
    if (ligne?.role === 'hote') commandes.j2 = ligne.cmd;
    const evs = avancerCourse(course, dt, commandes);
    if (ligne?.role === 'hote') {
      ligne.evAcc.push(...evs);
      if (evs.some(e => e.type === 'fin')) envoyerInstantane(true);
      else if (ligne.pas++ % 2 === 0) envoyerInstantane();
    }
    traiter(evs);
  },
  render() {
    if (editeur.actif) { editeur.dessiner(px.ctx); return; }
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
  const { installDebug, seedFromUrl } = await import('./lib/debug.js?v=0.3.0');
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
