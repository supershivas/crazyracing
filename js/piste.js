// La géométrie d'un circuit : du JS pur, sans DOM (sections 10 et 12).
// Un circuit est une courbe fermée (spline de Catmull-Rom) passant par ses
// points de contrôle, échantillonnée tous les `PAS` pixels. L'éditeur, l'IA,
// la course et le dessin lisent tous ces mêmes échantillons.
export const PAS = 4;

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
};

// def : { nom, points: [[x, y], …] (au moins 3), largeur }
// → { nom, largeur, longueur, n, pts: [{ x, y, tx, ty, nx, ny, s, k }], boite }
export function construirePiste(def) {
  const P = def.points, m = P.length;
  const brut = [];
  for (let i = 0; i < m; i++) {
    const p0 = P[(i + m - 1) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    const corde = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(4, Math.ceil(corde / 2));
    for (let j = 0; j < n; j++) brut.push(catmull(p0, p1, p2, p3, j / n));
  }
  // Rééchantillonnage à pas constant le long de la courbe
  let total = 0;
  const cum = [0];
  for (let i = 0; i < brut.length; i++) {
    const a = brut[i], b = brut[(i + 1) % brut.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    cum.push(total);
  }
  const n = Math.max(8, Math.round(total / PAS));
  const pas = total / n;
  const pts = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const cible = i * pas;
    while (cum[j + 1] < cible) j++;
    const a = brut[j], b = brut[(j + 1) % brut.length];
    const f = (cible - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    pts.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, tx: 0, ty: 0, nx: 0, ny: 0, s: i * pas, k: 0 });
  }
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    pts[i].tx = (b.x - a.x) / d; pts[i].ty = (b.y - a.y) / d;
    pts[i].nx = -pts[i].ty; pts[i].ny = pts[i].tx;
  }
  // Courbure signée (1 / rayon), lissée sur quelques échantillons
  const brutK = pts.map((p, i) => {
    const q = pts[(i + 1) % n], o = pts[(i + n - 1) % n];
    const dt = Math.atan2(q.tx * o.ty - q.ty * o.tx, q.tx * o.tx + q.ty * o.ty);
    return -dt / (2 * pas);
  });
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let d = -2; d <= 2; d++) s += brutK[(i + d + n) % n];
    pts[i].k = s / 5;
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const largeur = def.largeur ?? 34;
  return { nom: def.nom ?? 'Circuit', largeur, longueur: total, pas, n, pts, boite: { x0: x0 - largeur, y0: y0 - largeur, x1: x1 + largeur, y1: y1 + largeur } };
}

// Où est ce point par rapport au circuit ?
// indice : le dernier échantillon connu (recherche locale : évite de sauter d'une
// branche à l'autre d'un circuit qui se croise) ; sans indice, recherche complète.
// → { i, d (écart latéral signé, + = côté de la normale), s (abscisse curviligne), dist }
export function projeter(piste, x, y, indice = -1, fenetre = 14) {
  const { pts, n } = piste;
  let meilleur = -1, dmin = Infinity;
  if (indice < 0) {
    for (let i = 0; i < n; i++) {
      const dd = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
      if (dd < dmin) { dmin = dd; meilleur = i; }
    }
  } else {
    for (let o = -fenetre; o <= fenetre; o++) {
      const i = (indice + o + n * 4) % n;
      const dd = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
      if (dd < dmin) { dmin = dd; meilleur = i; }
    }
  }
  const p = pts[meilleur];
  const dx = x - p.x, dy = y - p.y;
  const along = dx * p.tx + dy * p.ty;
  let s = p.s + along;
  if (s < 0) s += piste.longueur; else if (s >= piste.longueur) s -= piste.longueur;
  return { i: meilleur, d: dx * p.nx + dy * p.ny, s, dist: Math.sqrt(dmin) };
}

// Le point du circuit à l'abscisse s (avec un écart latéral d)
export function pointA(piste, s, d = 0) {
  const L = piste.longueur;
  const u = (((s % L) + L) % L) / piste.pas;
  const i = Math.floor(u) % piste.n, f = u - Math.floor(u);
  const a = piste.pts[i], b = piste.pts[(i + 1) % piste.n];
  const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
  const tx = a.tx + (b.tx - a.tx) * f, ty = a.ty + (b.ty - a.ty) * f;
  const t = Math.hypot(tx, ty) || 1;
  const ux = tx / t, uy = ty / t;
  return { x: x - uy * d, y: y + ux * d, cap: Math.atan2(uy, ux), i };
}

const segCoupe = (a, b, c, d) => {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};

// Contrôle d'un circuit (l'éditeur l'affiche, les tests l'exigent) :
// rayon minimal, croisements de la ligne centrale, longueur.
export function verifierPiste(piste) {
  const { pts, n, largeur } = piste;
  let rayonMin = Infinity;
  for (const p of pts) if (Math.abs(p.k) > 1e-6) rayonMin = Math.min(rayonMin, 1 / Math.abs(p.k));
  const croisPts = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 3; j < n; j++) {
      if (i === 0 && j >= n - 2) continue;
      if (segCoupe(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) croisPts.push(pts[i]);
    }
  }
  // Deux tronçons éloignés en abscisse ne doivent pas se frôler (hors d'un croisement voulu)
  const pres = (p, c) => Math.hypot(p.x - c.x, p.y - c.y) < largeur * 3;
  let frolements = 0;
  for (let i = 0; i < n; i += 2) {
    for (let j = i + 1; j < n; j += 2) {
      const gap = Math.min(Math.abs(pts[j].s - pts[i].s), piste.longueur - Math.abs(pts[j].s - pts[i].s));
      if (gap < largeur * 3) continue;
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) >= largeur * 1.15) continue;
      if (!croisPts.some(c => pres(pts[i], c))) frolements++;
    }
  }
  const croisements = croisPts.length;
  const problemes = [];
  if (rayonMin < largeur * 0.55) problemes.push(`virage trop serré (rayon ${rayonMin.toFixed(0)} px)`);
  if (piste.longueur < 600) problemes.push('circuit trop court');
  if (piste.longueur > 9000) problemes.push('circuit trop long');
  if (frolements > 0) problemes.push('deux tronçons se frôlent');
  return { rayonMin, croisements, longueur: piste.longueur, problemes, ok: problemes.length === 0 };
}
