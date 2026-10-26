// Le Labo (section 16) : il MONTRE et compare, il ne modifie rien.
// Chaque sujet utilise les mêmes modules que le jeu : ce qu'on voit ici est
// ce que le jeu dessinera. Ajouter un sujet ou une variante = ajouter une
// entrée dans GROUPES.
import { mountLabo } from './lib/labo-shell.js?v=0.1.0';
import { loadVersion } from './lib/app-update.js?v=0.1.0';
import { JOURNAL } from './labo-journal.js?v=0.1.0';
import { spriteCanvas, sheet, spriteToPNG, paletteToGPL, paletteToHex } from './lib/sprites.js?v=0.1.0';
import { createAudio } from './lib/audio.js?v=0.1.0';
import { PALETTE, ROLES } from './palette.js?v=0.1.0';
import { chargerContenu } from './design-store.js?v=0.1.0';
import { nouvelleCourse, avancerCourse, grille } from './course.js?v=0.1.0';
import { construirePiste } from './piste.js?v=0.1.0';
import { creerDecor, creerVue, dessiner } from './render.js?v=0.1.0';
import { CIRCUITS } from './data/circuits.js?v=0.1.0';

document.documentElement.style.setProperty('--jeu-accent', ROLES.accent);
const NOM = document.title.replace(/^Labo — /, ''); // le nom vient de la page (une apostrophe ne casse rien)
const { sprites, reglages } = await chargerContenu();
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

// La planche d'échelle : tout se mesure au héros (section 7)
function planche(stage, facteur) {
  const p = el('div', { className: 'planche' });
  for (const [nom, rows] of Object.entries(sprites)) {
    p.append(el('figure', {}, spriteCanvas(rows, PALETTE, { scale: facteur }), el('figcaption', { textContent: `${nom} ${rows[0].length}×${rows.length}` })));
  }
  stage.append(p);
}

// Une démo vivante du jeu : des voitures de l'ordinateur tournent sur un circuit,
// avec des réglages ou une météo modifiés (variantes de réglage)
function demo(stage, { reglages: modif = {}, meteo = 'sec', circuit = 'port' } = {}) {
  const r = structuredClone(reglages);
  for (const [k, v] of Object.entries(modif)) Object.assign(r[k], v);
  const def = CIRCUITS.find(c => c.id === circuit);
  const ecran = { width: 240, height: 135 };
  const cv = el('canvas', { width: ecran.width, height: ecran.height });
  cv.style.cssText = 'width:720px;max-width:100%;image-rendering:pixelated';
  stage.append(cv);
  const ctx = cv.getContext('2d');
  const c = nouvelleCourse(def, { tours: 99, meteo, voitures: grille(5).map(v => ({ ...v, humain: false })), graine: 7, bonus: true, R: r });
  const decor = creerDecor(construirePiste(def), def, sprites, r);
  const vue = creerVue();
  let raf;
  const boucle = () => {
    avancerCourse(c, 1 / 60, {});
    dessiner(ctx, c, vue, ecran, decor, sprites, { suivre: 'ia1' });
    raf = requestAnimationFrame(boucle);
  };
  boucle();
  return () => cancelAnimationFrame(raf);
}

const GROUPES = [
  { id: 'dessin', title: 'Dessin', topics: [
    { id: 'echelle', title: 'Échelle', variants: [
      { title: 'Taille réelle ×4', note: 'La voiture, les icônes et le décor, côte à côte.', status: 'actuelle', render: s => planche(s, 4) },
      { title: 'Taille réelle ×1', note: 'Ce que voit un joueur sur un écran sans agrandissement.', render: s => planche(s, 1) },
    ] },
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
    { id: 'sprites', title: 'Sprites', variants: [
      { title: 'Planche', note: 'Tout ce que le jeu peint, à exporter pour le reprendre dans un éditeur.', status: 'actuelle', render: s => {
        const c = sheet(Object.values(sprites), PALETTE, { scale: 6, gap: 2 });
        c.style.imageRendering = 'pixelated';
        s.append(c, el('p'));
        for (const [nom, rows] of Object.entries(sprites)) {
          s.append(el('button', { className: 'essai', textContent: `${nom}.png`, onclick: async () => telecharger(await spriteToPNG(rows, PALETTE, 1), `${nom}.png`) }));
        }
      } },
    ] },
  ] },
  { id: 'jeu', title: 'Jeu', topics: [
    { id: 'adherence', title: 'Adhérence des pneus', variants: [
      { title: `${reglages.voiture.adherence} px/s²`, note: 'L\'adhérence actuelle : on glisse en bout de virage.', status: 'actuelle', render: s => demo(s) },
      { title: '420 px/s²', note: 'Les voitures tiennent mieux : la course devient une affaire de freinage.', render: s => demo(s, { reglages: { voiture: { adherence: 420 } } }) },
      { title: '240 px/s²', note: 'Plus de glisse, des erreurs, des tête-à-queue.', render: s => demo(s, { reglages: { voiture: { adherence: 240 } } }) },
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
