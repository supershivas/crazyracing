// Harnais de playtest : joue un parcours scripté du jeu dans Chromium et
// écrit le dossier d'une partie, lisible par les agents (testeurs, joueurs).
//
//   node outils/playtest/run.mjs --aide
//   node outils/playtest/run.mjs --etiquette foret --vitesse 2
//   node outils/playtest/run.mjs --de plage --a maison --cible telephone --seed 42
//
// Source de vérité : supershivas/game-system/outils/playtest/run.mjs
// D'après tools/playtest/run.js de Kingvi. Section 23 de CONVENTIONS.md.
// Le jeu doit avoir le mode debug (`?debug=1`, `window.__jeu`, section 18).
//
// Le parcours est décrit par le jeu, à sa racine (playtest.parcours.mjs) :
//
//   export default {
//     cible: 'bureau',                    // ou 'telephone'
//     demarrer: async ({ page }) => { await page.click('#jouer') },
//     etapes: [
//       { nom: 'plage', texte: 'Le héros accoste.', faire: async ({ page, jeu, touche, attendre }) => {
//           await touche('KeyD', 3000)                    // tenir D trois secondes
//       } },
//       { nom: 'maison', faire: async ({ jeu }) => { await jeu('teleport', 'maison') } },
//     ],
//   }
//
// Sortie : playtests/vX.Y.Z/<date-heure-etiquette>/
//   carnet.md       récit factuel, captures incluses (ce que lisent les joueurs)
//   captures/       JPEG toutes les N secondes et à chaque étape
//   events.json     journal du jeu (window.__jeu.events)
//   durations.json  durée de chaque étape
//   run.json        options, navigateur, FPS, erreurs, état final

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { servir, lancerChromium, CIBLES, options } from '../navigateur.mjs';

const o = options(process.argv.slice(2), { etiquette: 'run', capture: '5000', vitesse: '1' });
if (o.aide) {
  console.log(`Options :
  --etiquette mot     nom du run (dossier date-heure-mot)
  --de étape          commencer à cette étape (les précédentes sont sautées)
  --a étape           s'arrêter après cette étape
  --cible nom         ${Object.keys(CIBLES).join(', ')}
  --vitesse n         accélère le temps du jeu (window.__jeu.timeScale)
  --seed n            graine imposée (&seed=n)
  --capture ms        intervalle des captures automatiques (5000)
  --parcours fichier  autre fichier que playtest.parcours.mjs`);
  process.exit(0);
}

const parcoursFichier = resolve(o.parcours || 'playtest.parcours.mjs');
if (!existsSync(parcoursFichier)) { console.error(`Parcours introuvable : ${parcoursFichier}`); process.exit(2); }
const parcours = (await import(pathToFileURL(parcoursFichier).href)).default;
const { version } = JSON.parse(await readFile('version.json', 'utf8'));
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const dossier = join('playtests', `v${version}`, `${stamp}-${o.etiquette}`);
await mkdir(join(dossier, 'captures'), { recursive: true });
await mkdir(join(dossier, 'tests'), { recursive: true });
await mkdir(join(dossier, 'retours'), { recursive: true });

const cibleNom = o.cible || parcours.cible || 'bureau';
const serveur = await servir('.');
const navigateur = await lancerChromium();
const ctx = await navigateur.newContext(CIBLES[cibleNom]);
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });

const url = new URL('index.html', serveur.base);
url.searchParams.set('debug', '1');
if (o.seed) url.searchParams.set('seed', o.seed);
await page.goto(url.href, { waitUntil: 'load' });
await page.waitForFunction(() => window.__jeu, null, { timeout: 15000 });

const t0 = Date.now();
const horloge = () => { const s = Math.round((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const carnet = [`# Carnet — ${stamp}-${o.etiquette}`, '', `Version jouée : v${version} · cible : ${cibleNom}`, ''];
let n = 0;
async function capture(legende) {
  const f = `captures/${String(++n).padStart(4, '0')}.jpg`;
  await page.screenshot({ path: join(dossier, f), type: 'jpeg', quality: 70 });
  carnet.push(`**${horloge()}** — ${legende}`, '', `![${legende}](${f})`, '');
}

const jeu = (methode, ...args) => page.evaluate(([m, a]) => {
  const v = window.__jeu[m];
  return typeof v === 'function' ? v(...a) : v;
}, [methode, args]);
const attendre = ms => page.waitForTimeout(ms);
const touche = async (code, ms = 100) => { await page.keyboard.down(code); await attendre(ms); await page.keyboard.up(code); };

if (Number(o.vitesse) !== 1) await jeu('timeScale', Number(o.vitesse));
if (parcours.demarrer) await parcours.demarrer({ page, jeu, attendre, touche });
await capture('Début de la partie.');

let auto = setInterval(() => { capture('…').catch(() => {}); }, Number(o.capture));
const durees = {};
let actif = !o.de;
for (const e of parcours.etapes || []) {
  if (!actif && e.nom === o.de) actif = true;
  if (!actif) { carnet.push(`*Saut du script : ${e.nom}.*`, ''); continue; }
  const debut = Date.now();
  let statut = 'ok';
  try { await e.faire({ page, jeu, attendre, touche }); } catch (err) { statut = `échec : ${err.message.split('\n')[0]}`; }
  durees[e.nom] = { secondes: Math.round((Date.now() - debut) / 100) / 10, statut };
  clearInterval(auto);
  await capture(`${e.texte || e.nom} (${statut})`);
  auto = setInterval(() => { capture('…').catch(() => {}); }, Number(o.capture));
  if (o.a && e.nom === o.a) break;
}
clearInterval(auto);
await capture('Fin du parcours.');

const events = await jeu('events').catch(() => []);
const etat = await jeu('state').catch(() => null);
await writeFile(join(dossier, 'carnet.md'), carnet.join('\n'));
await writeFile(join(dossier, 'events.json'), JSON.stringify(events, null, 1));
await writeFile(join(dossier, 'durations.json'), JSON.stringify(durees, null, 2));
await writeFile(join(dossier, 'run.json'), JSON.stringify({
  version, cible: cibleNom, options: o, navigateur: navigateur.version(), erreurs, etatFinal: etat, captures: n,
}, null, 2));

await navigateur.close();
await serveur.close();
const echecs = Object.values(durees).filter(d => d.statut !== 'ok').length;
console.log(`${dossier}\n  ${Object.keys(durees).length} étape(s), ${echecs} échec(s), ${erreurs.length} erreur(s), ${n} capture(s)`);
process.exit(echecs || erreurs.length ? 1 : 0);
