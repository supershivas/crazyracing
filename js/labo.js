// Le Labo (section 16) : il MONTRE et compare, il ne modifie rien.
// Chaque sujet utilise les mêmes modules que le jeu : ce qu'on voit ici est
// ce que le jeu dessinera. Ajouter un sujet ou une variante = ajouter une
// entrée dans GROUPES.
import { mountLabo } from './lib/labo-shell.js?v=0.4.0';
import { loadVersion } from './lib/app-update.js?v=0.4.0';
import { JOURNAL } from './labo-journal.js?v=0.4.0';
import { paletteToGPL, paletteToHex } from './lib/sprites.js?v=0.4.0';
import { createAudio } from './lib/audio.js?v=0.4.0';
import { PALETTE, ROLES } from './palette.js?v=0.4.0';
import { chargerContenu } from './design-store.js?v=0.4.0';
import { nouvelleCourse, avancerCourse, grille } from './course.js?v=0.4.0';
import { creerRendu3D } from './render3d.js?v=0.4.0';
import { CIRCUITS } from './data/circuits.js?v=0.4.0';

document.documentElement.style.setProperty('--jeu-accent', ROLES.accent);
const NOM = document.title.replace(/^Labo — /, ''); // le nom vient de la page (une apostrophe ne casse rien)
const { reglages } = await chargerContenu();
const audio = createAudio();
const VERSION = (await loadVersion()) || '';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};
const telecharger = (blob, nom) => {
  const a = el('a', { href: URL.createObjectURL(blob), download: nom });
  document.body.append(a); a.click(); a.remove();
};

// Une démo vivante du jeu en 3D : des voitures de l'ordinateur tournent sur un circuit,
// avec une heure, une météo ou des réglages modifiés (variantes de réglage)
function demo(stage, { reglages: modif = {}, meteo = 'sec', circuit = 'port', heure = 'jour', tours = 99 } = {}) {
  const r = structuredClone(reglages);
  for (const [k, v] of Object.entries(modif)) Object.assign(r[k], v);
  const def = CIRCUITS.find(c => c.id === circuit);
  const cv = el('canvas');
  cv.style.cssText = 'width:min(100%,860px);aspect-ratio:16/9;display:block';
  stage.append(cv);
  const rendu = creerRendu3D(cv, { qualite: new URLSearchParams(location.search).get('q') ?? 'moyenne', heure });
  rendu.redimensionner(860, 484, 1);
  const c = nouvelleCourse(def, { tours, meteo, voitures: grille(5).map(v => ({ ...v, humain: false })), graine: 7, bonus: true, R: r });
  rendu.charger(c, def, r);
  let raf, dernier = performance.now();
  const boucle = () => {
    const now = performance.now();
    const dt = Math.max(0, Math.min(0.05, (now - dernier) / 1000)); dernier = now;
    avancerCourse(c, dt, {});
    rendu.dessiner(dt, 'ia1', { vue: 'incline', etiquettes: false, guides: false });
    raf = requestAnimationFrame(boucle);
  };
  raf = requestAnimationFrame(boucle);
  return () => { cancelAnimationFrame(raf); rendu.liberer(); };
}

const GROUPES = [
  { id: 'dessin', title: 'Dessin', topics: [
    { id: 'palette', title: 'Palette', variants: [
      { title: 'Nuancier', note: 'Les couleurs du jeu, et rien d\'autre.', status: 'actuelle', render: s => {
        s.append(el('div', { className: 'nuancier' }, ...Object.entries(PALETTE).map(([k, hex]) => {
          const d = el('div', { textContent: `${k} ${hex}` });
          d.style.background = hex;
          const parLum = Object.values(PALETTE).sort((a, b) => lum(a) - lum(b));
          d.style.color = lum(hex) > 0.3 ? parLum[0] : parLum[parLum.length - 1];
          return d;
        })));
        s.append(el('p', {}, el('button', { className: 'essai', textContent: 'Palette .gpl', onclick: () => telecharger(new Blob([paletteToGPL(PALETTE, NOM)]), 'crazyracing.gpl') }),
          el('button', { className: 'essai', textContent: 'Palette .hex', onclick: () => telecharger(new Blob([paletteToHex(PALETTE)]), 'crazyracing.hex') })));
      } },
      { title: 'Contrastes', note: 'Rapport WCAG de chaque paire (4,5 pour du texte, 3 pour un signe).', render: s => {
        const ks = Object.keys(PALETTE);
        const t = el('table', { className: 'contraste' });
        t.append(el('tr', {}, el('th'), ...ks.map(k => el('th', { textContent: k }))));
        for (const a of ks) t.append(el('tr', {}, el('th', { textContent: a }), ...ks.map(b => el('td', { textContent: a === b ? '—' : contraste(PALETTE[a], PALETTE[b]).toFixed(1) }))));
        s.append(t);
      } },
    ] },
  ] },
  { id: 'jeu', title: 'Jeu', topics: [
    { id: 'lumiere', title: 'Lumière', variants: [
      { title: 'Jour', note: 'Soleil haut, ombres nettes : la référence.', status: 'actuelle', render: s => demo(s) },
      { title: 'Soir', note: 'Soleil bas et orangé, ombres longues.', render: s => demo(s, { heure: 'soir', circuit: 'dunes' }) },
      { title: 'Nuit', note: 'Phares des voitures, lampadaires les plus proches, bloom.', render: s => demo(s, { heure: 'nuit', circuit: 'huit' }) },
      { title: 'Nuit sous la pluie', note: 'L\'asphalte mouillé reflète les lumières ; la trace sèche reste mate.', render: s => demo(s, { heure: 'nuit', meteo: 'pluie' }) },
    ] },
    { id: 'sillage', title: 'Aspiration', variants: [
      { title: `+${Math.round(reglages.sillage.gain * 100)} % de vitesse`, note: 'Une voiture collée à celle de devant, sur sa ligne, gagne en vitesse de pointe.', status: 'actuelle', render: s => demo(s) },
      { title: '+30 % de vitesse', note: 'L\'aspiration devient décisive : le peloton s\'étire moins, les dépassements arrivent plus tôt.', render: s => demo(s, { reglages: { sillage: { gain: 0.3 } } }) },
      { title: 'Aucune', note: 'Sans aspiration : la course se joue sur les lignes et les pneus.', render: s => demo(s, { reglages: { sillage: { gain: 0, gainAcc: 0 } } }) },
    ] },
    { id: 'meteo', title: 'Météo', variants: [
      { title: 'Sec', note: 'La piste de référence.', status: 'actuelle', render: s => demo(s) },
      { title: 'Pluie', note: 'L\'eau, la pluie qui tombe, les voitures sur pneus pluie.', render: s => demo(s, { meteo: 'pluie' }) },
      { title: 'Variable', note: 'Le temps change : la piste mouillée sèche d\'abord sur la trace.', render: s => demo(s, { meteo: 'variable', circuit: 'dunes' }) },
      { title: 'Circuit en huit', note: 'Le croisement : deux tronçons qui se coupent.', render: s => demo(s, { circuit: 'huit' }) },
    ] },
  ] },
  { id: 'son', title: 'Son', topics: [
    { id: 'bruitages', title: 'Bruitages', variants: [
      { title: 'Banque', note: 'Chaque son du jeu, à écouter.', status: 'actuelle', render: s => {
        audio.unlockOn(s);
        for (const nom of audio.names) s.append(el('button', { className: 'essai', textContent: nom, onclick: () => { audio.unlock(); audio.sfx(nom); } }));
      } },
    ] },
  ] },
];

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

mountLabo(document.getElementById('labo'), {
  game: NOM, home: './', atelier: 'atelier.html', groups: GROUPES,
  accueil: { version: VERSION, intro: 'Ce qui a changé au labo, et où le voir.', journal: JOURNAL },   // la page d'accueil du labo
});
