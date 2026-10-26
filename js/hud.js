// Le HUD en DOM : lit la course, n'écrit que ce qui a changé.
import { eauCible } from './course.js?v=0.3.0';

const $ = id => document.getElementById(id);
const NOMS_PNEU = { slick: 'Slick', inter: 'Inter', pluie: 'Pluie' };
const NOMS_BONUS = { turbo: 'Turbo', pilote: 'Auto', bouclier: 'Bouclier' };
const cache = new Map();
const poser = (id, texte) => { if (cache.get(id) !== texte) { cache.set(id, texte); $(id).textContent = texte; } };

export const temps = s => {
  if (s == null || !Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
};
export const tempsPrecis = s => {
  if (s == null || !Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
};

export function viderHud() { cache.clear(); }

export function majHud(c, v, { meilleurPerso, prochainPneu } = {}) {
  const course = c.mode === 'course';
  document.querySelector('.hud-course').style.visibility = course ? 'visible' : 'hidden';
  poser('hud-pos', course ? `${v.pos ?? 1}` : '');
  if (course) $('hud-pos').innerHTML = `${v.pos ?? 1}<small>/${c.voitures.length}</small>`;
  poser('hud-tour', `Tour ${Math.min(Math.max(v.tour + 1, 1), c.tours)}/${c.tours}`);
  const tCourse = v.tour >= 0 || c.mode === 'course' ? Math.max(0, c.t) : 0;
  poser('hud-temps', temps(v.fini ? v.tempsFin : tCourse));
  const dernier = v.tours.length ? v.tours[v.tours.length - 1] : null;
  poser('hud-tours', dernier != null ? `Dernier ${temps(dernier)} · Meilleur ${temps(v.meilleur)}${meilleurPerso ? ` · Record ${temps(meilleurPerso)}` : ''}` : (meilleurPerso ? `Record ${temps(meilleurPerso)}` : ' '));
  poser('hud-vitesse', `${Math.round(v.vitesse * 0.9)}`);

  poser('pneu-nom', NOMS_PNEU[v.pneu]);
  poser('pneu-etat', v.crevaison ? 'crevé !' : v.degats > 0.15 ? 'abîmé' : '');
  $('pneu-usure').style.width = `${Math.round((1 - v.usure) * 100)}%`;
  $('pneu-usure').style.background = v.usure > 0.75 ? '#b13e53' : v.usure > 0.5 ? '#ffcd75' : '#a7f070';
  $('pneu-chaleur').style.width = `${Math.round(Math.min(1, v.chaleur) * 100)}%`;
  $('pneu-chaleur').style.background = v.chaleur < 0.45 ? '#41a6f6' : v.chaleur > 0.8 ? '#b13e53' : '#a7f070';
  for (const b of $('pneu-choix').children) b.setAttribute('aria-pressed', String(b.dataset.pneu === (prochainPneu ?? v.prochainPneu)));

  const eau = c.eau, plus = eauCible(c, c.t + 25);
  const ciel = eau > 0.65 ? 'Pluie' : eau > 0.22 ? 'Humide' : 'Sec';
  poser('hud-meteo', `${ciel}${plus > eau + 0.25 ? ' ↗ pluie bientôt' : plus < eau - 0.25 ? ' ↘ ça sèche' : ''}`);
  poser('hud-limites', v.avert ? `Limites ${v.avert % 3}/3` : '');
  poser('hud-penalite', v.penalite ? `+${v.penalite} s` : '');
  const bonus = v.pilote > 0 ? (v.pilote > 99 ? 'Auto' : `Auto ${Math.ceil(v.pilote)}`) : v.turbo > 0 ? 'Turbo' : v.bonus ? NOMS_BONUS[v.bonus] : '—';
  poser('bonus-nom', bonus);
  $('bonus-case').classList.toggle('plein', !!v.bonus);
}

export function message(texte, type = '') {
  const p = document.createElement('p');
  p.textContent = texte;
  if (type) p.className = type;
  p.addEventListener('animationend', () => p.remove());
  const zone = $('hud-messages');
  zone.append(p);
  while (zone.children.length > 3) zone.firstChild.remove();
}

export function feux(c) {
  const el = $('feux');
  el.hidden = c.phase !== 'feux' && !(c.phase === 'course' && c.t < 1);
  el.classList.toggle('vert', c.phase !== 'feux');
  const allumes = c.phase === 'feux' ? Math.min(5, Math.floor((1 - c.feux / (c.mode === 'chrono' ? 1.5 : 3)) * 5) + 1) : 0;
  [...el.children].forEach((l, i) => l.classList.toggle('on', i < allumes));
}
