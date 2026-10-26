// Ce que l'hôte d'une course en ligne envoie à l'invité, et ce que l'invité en fait.
// L'hôte fait tourner toute la course ; l'invité n'en garde qu'une réplique qu'il
// dessine. Du JS pur : testable sans réseau. Tout ce qui arrive du réseau est
// vérifié champ par champ (un nombre fini, une valeur connue), jamais recopié tel quel.
import { positionner } from './course.js?v=0.4.0';
import { pointA } from './piste.js?v=0.4.0';
const positionDe = (c, dist, d) => pointA(c.piste, dist, d);

const NOMBRES = ['dist', 'd', 'v', 'usure', 'chaleur', 'degats', 'turbo', 'bouclier', 'sillage', 'charge', 'lacet', 'lat', 'roulis', 'tempsFin', 'meilleur', 'standT'];
const ENTIERS = ['tour', 'pos', 'equipe', 'ligne'];
const BOOLEENS = ['crevaison', 'fini', 'pit', 'enStand'];
const PNEUS = ['slick', 'inter', 'pluie'];
const BONUS = ['turbo', 'bouclier', 'sillage'];
const PHASES = ['feux', 'course', 'arrivee', 'fin'];
const TYPES_EVENEMENTS = new Set(['feu', 'depart', 'bonus', 'bonus-use', 'incident', 'danger', 'danger-touche', 'crevaison', 'pit', 'tour', 'stand', 'record', 'arrivee', 'fin', 'derapage']);

const PRECISION = { usure: 3, chaleur: 3, degats: 3, charge: 2, lacet: 2, roulis: 2, lat: 1, meilleur: 2, tempsFin: 2, dist: 1, d: 1, v: 1 };
const arrondi = (x, n = 1) => (x == null ? x : Math.round(x * 10 ** n) / 10 ** n);
const fini = x => typeof x === 'number' && Number.isFinite(x);

// Garde, de la liste des événements d'un pas, ceux que l'invité doit entendre
export function evenementsPourInvite(evs, idInvite) {
  return evs.filter(e => TYPES_EVENEMENTS.has(e.type) && (e.type !== 'derapage' || e.id === idInvite));
}

export function instantane(c, evs = [], { avecTrace = false } = {}) {
  const snap = {
    k: 'snap', t: arrondi(c.t, 2), p: c.phase, f: arrondi(c.feux, 2), e: arrondi(c.eau, 3), fin: arrondi(c.fin, 1),
    v: c.voitures.map(v => {
      const o = { id: v.id };
      for (const k of NOMBRES) if (v[k] != null) o[k] = arrondi(v[k], PRECISION[k] ?? 1);
      for (const k of ENTIERS) o[k] = v[k];
      for (const k of BOOLEENS) if (v[k]) o[k] = 1;
      o.pneu = v.pneu; o.prochainPneu = v.prochainPneu;
      if (v.bonus) o.bonus = v.bonus;
      if (v.incident) o.inc = v.incident.dir * Math.max(0.01, arrondi(v.incident.t, 2));
      if (v.tours.length) o.tl = arrondi(v.tours[v.tours.length - 1], 2);
      return o;
    }),
    b: c.bonus.map(b => arrondi(b.retour, 1)),
    dg: c.dangers.map(h => [h.id, arrondi(h.dist, 1), arrondi(h.d, 1), arrondi(h.t, 1)]),
    ev: evs,
  };
  if (avecTrace) snap.tr = c.trace.map(t => Math.min(9, Math.round(t * 9))).join('');
  if (c.phase === 'fin' && c.classement) snap.cl = c.classement;
  return snap;
}

// Applique un instantané à la réplique ; rend la liste des événements (assainis)
export function appliquer(c, snap) {
  if (!snap || snap.k !== 'snap') return [];
  if (fini(snap.t)) c.t = snap.t;
  if (PHASES.includes(snap.p)) c.phase = snap.p;
  if (fini(snap.f)) c.feux = snap.f;
  if (fini(snap.e)) c.eau = Math.max(0, Math.min(1, snap.e));
  if (fini(snap.fin)) c.fin = snap.fin;
  for (const o of Array.isArray(snap.v) ? snap.v : []) {
    const v = c.voitures.find(x => x.id === o?.id);
    if (!v) continue;
    for (const k of NOMBRES) if (fini(o[k])) v[k] = o[k];
    for (const k of ENTIERS) if (Number.isInteger(o[k])) v[k] = o[k];
    for (const k of BOOLEENS) v[k] = !!o[k];
    if (PNEUS.includes(o.pneu)) v.pneu = o.pneu;
    if (PNEUS.includes(o.prochainPneu)) v.prochainPneu = o.prochainPneu;
    v.bonus = BONUS.includes(o.bonus) ? o.bonus : null;
    v.incident = fini(o.inc) && o.inc !== 0 ? { type: 'spin', t: Math.abs(o.inc), dir: Math.sign(o.inc) } : null;
    positionner(c, v);
    v.tours = fini(o.tl) ? [o.tl] : [];
  }
  if (Array.isArray(snap.dg)) {
    c.dangers = snap.dg.filter(h => Array.isArray(h) && h.slice(0, 4).every(fini)).slice(0, 4).map(([id, dist, d, t]) => {
      const p = positionDe(c, dist, d);
      return { id, dist, d, t, x: p.x, y: p.y };
    });
  }
  if (Array.isArray(snap.b)) snap.b.forEach((r, i) => { if (c.bonus[i] && fini(r)) c.bonus[i].retour = Math.max(0, r); });
  if (typeof snap.tr === 'string' && snap.tr.length === c.trace.length) for (let i = 0; i < c.trace.length; i++) c.trace[i] = (snap.tr.charCodeAt(i) - 48) / 9;
  if (c.phase === 'fin' && Array.isArray(snap.cl)) {
    c.classement = snap.cl.filter(r => r && typeof r.id === 'string').map(r => ({
      id: String(r.id), nom: String(r.nom ?? '').slice(0, 24), humain: !!r.humain, pos: Number.isInteger(r.pos) ? r.pos : 0, fini: !!r.fini,
      temps: fini(r.temps) ? r.temps : null, penalite: fini(r.penalite) ? r.penalite : 0, meilleur: fini(r.meilleur) ? r.meilleur : null, tours: Number.isInteger(r.tours) ? r.tours : 0,
    }));
  }
  return (Array.isArray(snap.ev) ? snap.ev : []).filter(e => e && TYPES_EVENEMENTS.has(e.type)).slice(0, 40);
}

// Ce que l'invité envoie : sa commande, bornée par l'hôte à la réception
export function commandeValide(o) {
  const n = (x, a, b) => (fini(x) ? Math.max(a, Math.min(b, x)) : 0);
  return { gaz: n(o?.gaz, 0, 1), frein: n(o?.frein, 0, 1), volant: n(o?.volant, -1, 1), recul: !!o?.recul, bonus: !!o?.bonus, pneu: PNEUS.includes(o?.pneu) ? o.pneu : undefined };
}

// Le lissage de l'invité : la voiture dessinée rejoint l'instantané par petites touches,
// en suivant sa vitesse entre deux messages
export function lisser(c, cibles, dt, depuis) {
  const k = 1 - Math.pow(0.001, dt * 6);
  for (const v of c.voitures) {
    const ci = cibles.get(v.id);
    if (!ci) continue;
    const cibleDist = ci.dist + ci.v * Math.min(depuis, 0.15);
    if (Math.abs(cibleDist - v.dist) > 60) v.dist = cibleDist; else v.dist += (cibleDist - v.dist) * k;
    v.d += (ci.d - v.d) * k;
    v.lacet = ci.lacet; v.lat = ci.lat;
    positionner(c, v);
  }
}
