/* ─── Frise du temps du Labo — partagée entre les jeux ─────────────────────
   Source de vérité : supershivas/game-system/modules/labo-timeline.js
   Va avec labo-shell.js (section 16 de CONVENTIONS.md). Pour les variantes
   qui montrent un MOMENT qui se déroule (un assaut, une journée, un sort,
   une animation en plusieurs temps) : une barre en bas de la variante, où l'on
   joue, met en pause, glisse à n'importe quel instant, saute d'une étape à
   l'autre et change la vitesse. Les étapes sont nommées : on va directement à
   « Contact » sans attendre la boucle.

   Module ES sans dépendance. À appeler dans le `render` d'une variante :
     import { mountTimeline } from './lib/labo-timeline.js?v=0.2.0'
     render: stage => {
       const dessin = ...;                              // le canvas, le DOM de la variante
       stage.append(dessin);
       const tl = mountTimeline(stage, {
         duree: 46,                                     // secondes de la boucle
         etapes: [{ t: 0, nom: 'Calme' }, { t: 6, nom: 'Préparation' }, …],
         onTime: (t, { etape, lecture }) => dessiner(t),   // à chaque image
         boucle: true, vitesse: 1, lecture: true,       // (valeurs par défaut)
       });
       return () => tl.detruire();                      // nettoyage rendu au Labo
     }
   `tl.temps` (lecture), `tl.aller(t)`, `tl.jouer()`, `tl.pause()`, `tl.vitesse(v)`.
   `onTime` est appelé à chaque image même en pause (le dessin se rafraîchit).
   La logique pure (`etapeA`, `avancer`) est exportée et testée sans navigateur.
   ─────────────────────────────────────────────────────────────────────────── */

/* L'index de l'étape en cours à l'instant t : la dernière dont le début est passé. */
export function etapeA(etapes, t) {
  let k = 0;
  for (let i = 0; i < etapes.length; i++) if (t >= etapes[i].t) k = i;
  return k;
}

/* Le temps après dt secondes de lecture à la vitesse v : borné à [0, duree], ou
   bouclé. Rend { t, fini } (fini : on a atteint la fin sans boucle). */
export function avancer(t, dt, duree, { boucle = true, vitesse = 1 } = {}) {
  let n = t + dt * vitesse;
  if (n >= duree) return boucle ? { t: n % duree, fini: false } : { t: duree, fini: true };
  if (n < 0) return boucle ? { t: duree + (n % duree), fini: false } : { t: 0, fini: true };
  return { t: n, fini: false };
}

const CSS = `
.lt { position: sticky; bottom: 0; z-index: 2; margin-top: 12px; padding: 8px 10px 10px; display: grid; gap: 6px;
  background: var(--labo-fond, #f4f4f2); border-top: 1px solid var(--labo-trait, rgba(0,0,0,.12)); font: 13px/1.3 system-ui, sans-serif; color: var(--labo-encre, #1c1c1e); user-select: none; }
.lt-rang { display: flex; align-items: center; gap: 6px; }
.lt button { min-height: 44px; min-width: 44px; padding: 0 10px; border: 1px solid var(--labo-trait, rgba(0,0,0,.2)); border-radius: 6px; background: #fff; color: inherit; font: inherit; cursor: pointer; }
.lt button[aria-pressed="true"], .lt button.is-on { background: var(--labo-encre, #1c1c1e); color: #fff; border-color: transparent; }
.lt svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; display: block; margin: auto; }
.lt-piste { position: relative; flex: 1; min-width: 0; height: 44px; display: flex; align-items: center; }
.lt-piste input[type=range] { width: 100%; margin: 0; height: 44px; accent-color: var(--labo-accent, #c23b3b); }
.lt-repere { position: absolute; top: 4px; width: 2px; height: 8px; background: var(--labo-encre, #1c1c1e); opacity: .55; pointer-events: none; transform: translateX(-1px); }
.lt-temps { font: 12px ui-monospace, monospace; white-space: nowrap; min-width: 9ch; text-align: right; }
.lt-etapes { display: flex; flex-wrap: wrap; gap: 6px; }
.lt-etapes button { min-height: 36px; font-size: 12px; }
.lt-vit { display: flex; gap: 4px; }
@media (max-width: 768px) { .lt-vit { display: none; } }
`;

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(x => x != null));
  return e;
};
const svg = d => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };
const ICONES = { jouer: 'M7 4v16l13-8z', pause: 'M8 5v14M16 5v14', prec: 'M6 5v14M8 12l10-7v14z', suiv: 'M18 5v14M16 12L6 5v14z' };
const fmt = s => s.toFixed(1).replace('.', ',') + ' s';

export function mountTimeline(conteneur, { duree, etapes = [], onTime = () => {}, boucle = true, vitesse = 1, lecture = true } = {}) {
  if (!document.getElementById('lt-style')) document.head.append(h('style', { id: 'lt-style' }, CSS));
  let t = 0, v = vitesse, joue = lecture, raf = 0, dernier = performance.now(), detruit = false;

  const bouton = (icone, label, on) => h('button', { 'aria-label': label, title: label, onclick: on }, svg(ICONES[icone]));
  const btnJouer = bouton('pause', 'Pause', () => (joue ? pause() : jouer()));
  const curseur = h('input', { type: 'range', min: 0, max: Math.round(duree * 100), value: 0, 'aria-label': 'Instant', oninput: () => { pause(); aller(curseur.value / 100); } });
  const temps = h('span', { class: 'lt-temps' });
  const piste = h('div', { class: 'lt-piste' }, curseur, ...etapes.slice(1).map(e => h('i', { class: 'lt-repere', style: `left:${(e.t / duree) * 100}%` })));
  const puces = etapes.map((e, k) => h('button', { onclick: () => { aller(e.t); pause(); }, title: fmt(e.t) }, `${k + 1} ${e.nom}`));
  const vits = [0.25, 1, 2].map(x => h('button', { 'aria-label': `Vitesse ×${x}`, onclick: () => vitesseEtat(x) }, `×${String(x).replace('.', ',')}`));
  const barre = h('div', { class: 'lt', role: 'group', 'aria-label': 'Frise du temps' },
    h('div', { class: 'lt-rang' },
      bouton('prec', 'Étape précédente', () => { const k = etapeA(etapes, t); aller(etapes[t - etapes[k].t > 0.6 ? k : Math.max(0, k - 1)].t); pause(); }),
      btnJouer,
      bouton('suiv', 'Étape suivante', () => { const k = etapeA(etapes, t); aller(etapes[Math.min(etapes.length - 1, k + 1)].t); pause(); }),
      piste, temps, h('div', { class: 'lt-vit' }, ...vits)),
    etapes.length ? h('div', { class: 'lt-etapes' }, ...puces) : null);
  conteneur.append(barre);

  function vitesseEtat(x) { v = x; maj(); }
  function jouer() { joue = true; maj(); }
  function pause() { joue = false; maj(); }
  function aller(x) { t = Math.max(0, Math.min(duree, x)); maj(); }
  function maj() {
    const k = etapeA(etapes, t);
    curseur.value = Math.round(t * 100);
    temps.textContent = `${fmt(t)} / ${fmt(duree)}`;
    btnJouer.replaceChildren(svg(ICONES[joue ? 'pause' : 'jouer'])); btnJouer.setAttribute('aria-label', joue ? 'Pause' : 'Lecture');
    puces.forEach((b, i) => b.classList.toggle('is-on', i === k));
    vits.forEach((b, i) => b.setAttribute('aria-pressed', String([0.25, 1, 2][i] === v)));
  }
  function image(now) {
    if (detruit) return;
    const dt = Math.min(0.1, (now - dernier) / 1000); dernier = now;
    if (joue) { const r = avancer(t, dt, duree, { boucle, vitesse: v }); t = r.t; if (r.fini) joue = false; maj(); }
    onTime(t, { etape: etapes[etapeA(etapes, t)], lecture: joue });
    raf = requestAnimationFrame(image);
  }
  maj();
  raf = requestAnimationFrame(image);
  return {
    get temps() { return t; }, aller, jouer, pause, vitesse: vitesseEtat,
    detruire() { detruit = true; cancelAnimationFrame(raf); barre.remove(); },
  };
}
