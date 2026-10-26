/* ─── Coquille du Labo — partagé entre les jeux ────────────────────────────
   Source de vérité : supershivas/game-system/modules/labo-shell.js
   (avec labo-shell.css). Applique la section 16 de CONVENTIONS.md :
   un écran à hauteur fixe qui montre UNE variante à la fois ; des groupes
   (onglets de l'en-tête), leurs sujets (marge de gauche, puces sur mobile),
   et les variantes du sujet ouvert, A, B, C… (A est toujours l'actuelle) ;
   clic, flèches du clavier, balayage sur mobile ; l'adresse garde le sujet
   et la lettre (#loups-C).

   Module ES sans dépendance :
     import { mountLabo } from './lib/labo-shell.js?v=0.4.0'
     mountLabo(document.getElementById('labo'), {
       game: 'Kingvi',               // nom affiché dans l'en-tête
       home: './',                   // lien de retour vers le jeu
       atelier: 'atelier.html',      // icône pinceau (facultatif)
       groups: [
         { id: 'anim', title: 'Animations', topics: [
           { id: 'loups', title: 'Loups', variants: [
             { title: 'Actuelle', note: 'La course à 4 images.', status: 'actuelle',
               render: (stage, ctx) => { ... ; return () => {} } },   // rend un nettoyage
             { title: 'Course à 6 images', note: 'Plus souple, plus lourde.', status: 'retenue', render },
           ] },
         ] },
       ],
     })
   `render(stage, { topic, variant, letter })` dessine dans `stage` (un div vide,
   qui défile seul si besoin) et peut rendre une fonction de nettoyage
   (arrêter une animation). Statuts : 'actuelle', 'retenue', 'ancienne',
   'a-trancher' (une proposition attend un choix : le sujet passe en rouge
   même si une variante est en jeu).
   Un point de couleur dit l'état de chaque sujet (menu, puces, accueil) et de
   chaque groupe : vert = tranché (une variante en jeu), rouge = à trancher,
   orange = indéfini (aucune variante n'a de statut). Voir `etatSujet`.
   ─────────────────────────────────────────────────────────────────────────── */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
};

// Icônes au trait (fiole, pinceau, flèches), dessinées ici : aucun CDN
const ICON = {
  brush: '<path d="M3 21v-4a4 4 0 1 1 4 4h-4"/><path d="M21 3a16 16 0 0 0-12.8 10.2"/><path d="M21 3a16 16 0 0 1-10.2 12.8"/><path d="M10.6 9a9 9 0 0 1 4.4 4.4"/>',
  prev: '<path d="M15 6l-6 6l6 6"/>',
  next: '<path d="M9 6l6 6l-6 6"/>',
};
const icon = name => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'labo-icon');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICON[name];
  return s;
};

// « 1.10.0 » > « 1.9.3 » : comparaison numérique, pas alphabétique
const versionNum = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
const plusRecente = (a, b) => {
  const x = versionNum(a), y = versionNum(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
// L'état d'un sujet : 'vert' (une variante est en jeu, rien n'attend), 'rouge'
// (à trancher : une variante porte 'a-trancher', ou des statuts sans aucune
// variante en jeu), 'orange' (indéfini : aucune variante n'a de statut).
export function etatSujet(topic) {
  const st = (topic?.variants || []).map(v => v.status).filter(Boolean);
  if (st.includes('a-trancher')) return 'rouge';
  if (st.includes('actuelle') || st.includes('retenue')) return 'vert';
  return st.length ? 'rouge' : 'orange';
}
// L'état d'un groupe : le pire de ses sujets (rouge > orange > vert).
export function etatGroupe(group) {
  const e = (group?.topics || []).map(etatSujet);
  return e.includes('rouge') ? 'rouge' : e.includes('orange') ? 'orange' : 'vert';
}
const MOT_ETAT = { vert: 'tranché, en jeu', rouge: 'à trancher', orange: 'indéfini' };
// Le point : la forme (rond, carré, triangle) porte l'information, la couleur la confirme
const point = etat => h('span', { class: `labo-point is-${etat}`, role: 'img', 'aria-label': MOT_ETAT[etat], title: MOT_ETAT[etat] });

const GENRES = { nouveau: 'nouveau', 'mis-a-jour': 'mis à jour', retire: 'retiré' };

export function mountLabo(root, { game = 'Jeu', home = './', atelier, groups = [], accueil = null } = {}) {
  document.title = `Labo — ${game}`;
  root.classList.add('labo');
  let cleanup = null;
  let current = { g: 0, t: 0, v: 0 };
  let onHome = false;
  const cleVue = `labo:${game}:vu`;
  const lireVu = () => { try { return localStorage.getItem(cleVue) || ''; } catch { return ''; } };
  const ecrireVu = v => { try { localStorage.setItem(cleVue, v); } catch { /* rien */ } };

  const header = h('header', { class: 'labo-head safe-top' },
    h('a', { class: 'labo-back', href: home }, h('span', { class: 'labo-game' }, game), h('span', { class: 'labo-badge' }, 'LABO')),
    h('nav', { class: 'labo-groups', 'aria-label': 'Groupes' }),
    atelier ? h('a', { class: 'labo-tool', href: atelier, 'aria-label': 'Atelier', title: 'Atelier' }, icon('brush')) : null,
  );
  const side = h('aside', { class: 'labo-side', 'aria-label': 'Sujets' });
  const chips = h('nav', { class: 'labo-chips', 'aria-label': 'Sujets' });
  const info = h('div', { class: 'labo-info' });
  const stage = h('div', { class: 'labo-stage' });
  const bar = h('div', { class: 'labo-bar safe-bottom' });
  root.replaceChildren(header, chips, h('div', { class: 'labo-body' }, side, h('main', { class: 'labo-main' }, info, stage)), bar);

  const topicsOf = g => groups[g]?.topics || [];
  const find = id => {
    for (let g = 0; g < groups.length; g++) {
      const t = topicsOf(g).findIndex(x => x.id === id);
      if (t >= 0) return { g, t };
    }
    return null;
  };

  function go(g, t, v, push = true) {
    const topics = topicsOf(g);
    t = Math.max(0, Math.min(topics.length - 1, t));
    const vars = topics[t]?.variants || [];
    v = (v + vars.length) % Math.max(1, vars.length);
    current = { g, t, v };
    onHome = false;
    if (push && topics[t]) history.replaceState(null, '', `#${topics[t].id}-${LETTERS[v]}`);
    draw();
  }

  function variantButtons(topic, cls) {
    return topic.variants.map((variant, i) => h('button', {
      class: `${cls} ${i === current.v ? 'is-on' : ''} ${variant.status === 'retenue' ? 'is-kept' : ''}`,
      'aria-current': i === current.v ? 'true' : null,
      title: variant.title,
      onclick: () => go(current.g, current.t, i),
    }, LETTERS[i]));
  }

  function allerAccueil(push = true) {
    onHome = true;
    if (push) history.replaceState(null, '', '#accueil');
    draw();
  }

  // l'accueil : ce qui a changé, ce qui reste à trancher, tous les sujets
  function drawHome() {
    root.classList.add('is-home');
    if (typeof cleanup === 'function') { try { cleanup(); } catch { /* rien */ } }
    cleanup = null;
    const vu = lireVu();
    const journal = accueil.journal || [];
    const lien = (ref, contenu, cls = '') => {
      if (ref === 'accueil') return h('a', { class: `labo-lien ${cls}`, href: '#accueil' }, contenu);
      const m = String(ref || '').match(/^(.*?)(?:-([A-Z]))?$/);
      const at = m && find(m[1]);
      const ok = at && (!m[2] || LETTERS.indexOf(m[2]) < (topicsOf(at.g)[at.t].variants.length));
      return ok ? h('a', { class: `labo-lien ${cls}`, href: `#${ref}` }, contenu)
        : h('span', { class: 'labo-lien is-casse', title: `Lien cassé : #${ref}` }, '⚠ ', contenu);
    };
    const nouveautes = journal.filter(e => !vu || plusRecente(e.version, vu));
    info.replaceChildren(
      h('h1', {}, 'Accueil', h('span', { class: 'labo-status' }, `v${accueil.version}`)),
      accueil.intro ? h('p', {}, accueil.intro) : null,
    );
    const entree = (e, neuf) => h('section', { class: `labo-version ${neuf ? 'is-new' : ''}` },
      h('h3', {}, `v${e.version}`, e.date ? h('small', {}, ` · ${e.date}`) : null, neuf ? h('span', { class: 'labo-new' }, 'nouveau') : null),
      h('ul', {}, (e.items || []).map(it => h('li', {},
        it.genre ? h('span', { class: `labo-genre is-${it.genre}` }, GENRES[it.genre] || it.genre) : null,
        it.ref ? lien(it.ref, it.texte) : it.texte))));
    const atrancher = [];
    groups.forEach(gr => gr.topics.forEach(tp => {
      if (etatSujet(tp) !== 'vert') atrancher.push(tp);
    }));
    const sections = [];
    if (vu && nouveautes.length) sections.push(h('div', { class: 'labo-bloc' },
      h('h2', {}, `Depuis votre dernière visite (v${vu})`), nouveautes.map(e => entree(e, true))));
    else if (!vu && journal.length) sections.push(h('p', { class: 'labo-aide' }, 'Première visite : tout le journal est ci-dessous. Les prochaines fois, ce qui est arrivé depuis votre dernier passage sera en tête.'));
    else if (vu) sections.push(h('p', { class: 'labo-aide' }, `Rien de nouveau depuis votre dernière visite (v${vu}).`));
    if (atrancher.length) sections.push(h('div', { class: 'labo-bloc' },
      h('h2', {}, 'À trancher'), h('p', { class: 'labo-aide' }, 'Rouge : une décision attend. Orange : rien n\'est jugé ni en jeu.'),
      h('ul', {}, atrancher.map(tp => h('li', {}, point(etatSujet(tp)), lien(tp.id, tp.title), h('small', {}, ` · ${tp.variants.length} variantes`))))));
    sections.push(h('div', { class: 'labo-bloc' }, h('h2', {}, 'Tous les sujets'),
      groups.map(gr => h('div', { class: 'labo-index' }, h('h3', {}, point(etatGroupe(gr)), gr.title),
        h('ul', {}, gr.topics.map(tp => {
          const k = tp.variants.findIndex(x => x.status === 'retenue' || x.status === 'actuelle');
          const nv = tp.variants.findIndex(x => accueil.version && x.depuis === accueil.version);
          return h('li', {}, point(etatSujet(tp)), lien(k >= 0 ? `${tp.id}-${LETTERS[k]}` : tp.id, tp.title),
            h('small', {}, k >= 0 ? ` · en jeu : ${LETTERS[k]}` : ' · à trancher', etatSujet(tp) === 'rouge' && k >= 0 ? ' · une proposition attend' : '', ` · ${tp.variants.length} variante${tp.variants.length > 1 ? 's' : ''}`),
            nv >= 0 ? h('span', { class: 'labo-new' }, 'nouveau') : null);
        }))))));
    sections.push(h('div', { class: 'labo-bloc' }, h('h2', {}, 'Tout le journal'),
      journal.map(e => entree(e, false))));
    stage.replaceChildren(...sections);
    stage.scrollTop = 0;
    bar.replaceChildren();
    side.replaceChildren();
    chips.replaceChildren();
    ecrireVu(accueil.version);
  }

  function draw() {
    const { g, t, v } = current;
    root.classList.toggle('is-home', onHome);
    header.querySelector('.labo-groups').replaceChildren(
      ...(accueil ? [h('button', { class: `labo-group ${onHome ? 'is-on' : ''}`, onclick: () => allerAccueil() }, 'Accueil')] : []),
      ...groups.map((gr, i) => h('button', { class: `labo-group ${!onHome && i === g ? 'is-on' : ''}`, onclick: () => go(i, 0, 0) }, point(etatGroupe(gr)), gr.title)));
    if (onHome) { drawHome(); return; }
    const topics = topicsOf(g);
    const topic = topics[t];
    side.replaceChildren(...topics.map((tp, i) => h('div', { class: `labo-topic ${i === t ? 'is-open' : ''}` },
      h('button', { class: 'labo-topic-btn', onclick: () => go(g, i, 0) }, h('span', { class: 'labo-topic-nom' }, point(etatSujet(tp)), tp.title), h('small', {}, String(tp.variants.length))),
      i === t ? h('div', { class: 'labo-variants' }, tp.variants.map((variant, j) =>
        h('button', { class: `labo-variant ${j === v ? 'is-on' : ''}`, onclick: () => go(g, t, j) },
          h('b', { class: variant.status === 'retenue' ? 'is-kept' : '' }, LETTERS[j]), ' ', variant.title))) : null)));
    chips.replaceChildren(...topics.map((tp, i) => h('button', { class: `labo-chip ${i === t ? 'is-on' : ''}`, onclick: () => go(g, i, 0) }, point(etatSujet(tp)), tp.title)));
    if (!topic) { info.replaceChildren(); stage.replaceChildren(); bar.replaceChildren(); return; }
    const variant = topic.variants[v];
    info.replaceChildren(
      h('h1', {}, `${LETTERS[v]} — ${variant.title}`, variant.status ? h('span', { class: `labo-status is-${variant.status}` }, variant.status) : null,
        variant.depuis ? h('span', { class: 'labo-status' }, `depuis v${variant.depuis}`) : null),
      variant.note ? h('p', {}, variant.note) : null,
    );
    bar.replaceChildren(
      h('button', { class: 'labo-nav', 'aria-label': 'Variante précédente', onclick: () => go(g, t, v - 1) }, icon('prev')),
      h('div', { class: 'labo-letters' }, variantButtons(topic, 'labo-letter')),
      h('button', { class: 'labo-nav', 'aria-label': 'Variante suivante', onclick: () => go(g, t, v + 1) }, icon('next')),
    );
    if (typeof cleanup === 'function') { try { cleanup(); } catch { /* rien */ } }
    stage.replaceChildren();
    stage.scrollTop = 0;
    try { cleanup = variant.render?.(stage, { topic, variant, letter: LETTERS[v] }); } catch (e) {
      stage.append(h('pre', { class: 'labo-error' }, String(e.stack || e)));
    }
  }

  window.addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (onHome) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current.g, current.t, current.v + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current.g, current.t, current.v - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); go(current.g, current.t + 1, 0); }
    if (e.key === 'ArrowUp') { e.preventDefault(); go(current.g, current.t - 1, 0); }
  });
  // Balayage horizontal (mobile)
  let sx = null, sy = null;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(current.g, current.t, current.v + (dx < 0 ? 1 : -1));
    sx = null;
  });

  function fromHash() {
    const m = location.hash.slice(1).match(/^(.*)-([A-Z])$/);
    const seul = !m && find(location.hash.slice(1));   // « #sujet » sans lettre : la variante A
    const at = (m && find(m[1])) || seul;
    if (at) go(at.g, at.t, m && find(m[1]) ? LETTERS.indexOf(m[2]) : 0, false);
    else if (accueil) allerAccueil(false);
    else go(0, 0, 0, false);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  return { go, accueil: () => allerAccueil(), get current() { return { ...current, accueil: onHome }; } };
}
