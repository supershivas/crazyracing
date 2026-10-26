// Ce que l'hôte d'une course en ligne envoie à l'invité, et ce que l'invité en fait.
// L'hôte fait tourner toute la course ; l'invité n'en garde qu'une réplique qu'il
// dessine. Du JS pur : testable sans réseau. Tout ce qui arrive du réseau est
// vérifié champ par champ (un nombre fini, une valeur connue), jamais recopié tel quel.
const NOMBRES = ['x', 'y', 'cap', 'vx', 'vy', 'usure', 'chaleur', 'degats', 'turbo', 'bouclier', 'pilote', 's', 'd', 'dist', 'vitesse', 'penalite', 'tempsFin', 'meilleur', 'standT'];
const ENTIERS = ['tour', 'pos', 'avert', 'equipe'];
const BOOLEENS = ['crevaison', 'fini', 'hors'];
const PNEUS = ['slick', 'inter', 'pluie'];
const BONUS = ['turbo', 'pilote', 'bouclier'];
const PHASES = ['feux', 'course', 'arrivee', 'fin'];
const TYPES_EVENEMENTS = new Set(['feu', 'depart', 'bonus', 'bonus-use', 'choc', 'mur', 'crevaison', 'limites', 'penalite', 'tour', 'stand', 'remise', 'record', 'arrivee', 'fin', 'derapage']);

const PRECISION = { cap: 3, usure: 3, chaleur: 3, degats: 3, meilleur: 2, tempsFin: 2 };
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
      if (v.tours.length) o.tl = arrondi(v.tours[v.tours.length - 1], 2);
      return o;
    }),
    b: c.bonus.map(b => arrondi(b.retour, 1)),
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
    v.tours = fini(o.tl) ? [o.tl] : [];
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
  for (const v of c.voitures) {
    const ci = cibles.get(v.id);
    if (!ci) continue;
    const t = Math.min(depuis, 0.15);
    const tx = ci.x + ci.vx * t, ty = ci.y + ci.vy * t;
    const k = 1 - Math.pow(0.001, dt * 6);
    if (Math.hypot(tx - v.x, ty - v.y) > 80) { v.x = tx; v.y = ty; } else { v.x += (tx - v.x) * k; v.y += (ty - v.y) * k; }
    let dc = ci.cap - v.cap;
    while (dc > Math.PI) dc -= 2 * Math.PI; while (dc < -Math.PI) dc += 2 * Math.PI;
    v.cap += dc * k;
  }
}
