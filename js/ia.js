// Le choix de ligne des voitures de l'ordinateur (le joueur, lui, choisit à la main).
// Une voiture roule seule ; la décision, c'est la ligne : se mettre dans le sillage
// d'une voiture plus rapide, dépasser une plus lente, éviter un danger, ramasser un
// bonus, serrer la corde dans un virage tant que les pneus tiennent. Du JS pur.

const borne = (x, a, b) => Math.max(a, Math.min(b, x));

// Une ligne est-elle libre ? Aucune autre voiture à côté ou sur le point d'y être.
export function ligneLibre(c, v, ligne) {
  const d = c.lignes[ligne + 1];
  const marge = c.R.voiture.longueur + 2;
  for (const o of c.voitures) {
    if (o === v) continue;
    if (Math.abs(o.dist - v.dist) < marge && Math.abs(o.d - d) < c.R.voiture.largeur + 1.5) return false;
  }
  return true;
}

// Ce qui est devant sur une ligne : { gap, o } de la voiture la plus proche, sinon null
export function devantSurLigne(c, v, d, portee) {
  let best = null;
  for (const o of c.voitures) {
    if (o === v || o.fini) continue;
    const gap = o.dist - v.dist;
    if (gap <= 0 || gap > portee) continue;
    if (Math.abs(o.d - d) >= c.R.voiture.largeur + 1) continue;
    if (!best || gap < best.gap) best = { gap, o };
  }
  return best;
}

// La ligne que l'ordinateur veut : -1, 0 ou 1
export function choisirLigne(c, v) {
  const { piste, R } = c;
  let meilleur = v.ligne, meilleurScore = -Infinity;
  for (let l = Math.max(-1, v.ligne - 1); l <= Math.min(1, v.ligne + 1); l++) {
    const d = c.lignes[l + 1];
    let score = l === v.ligne ? 0.14 : 0;
    // Le trafic : une voiture plus lente devant gêne ; une plus rapide offre son sillage
    const dev = devantSurLigne(c, v, d, 90);
    if (dev) {
      const rapide = dev.o.v >= v.v - 4;
      if (rapide && dev.gap > R.sillage.min) score += 0.34 * (1 - dev.gap / 90) + 0.12;
      else score -= (1 - dev.gap / 90) * (0.9 + Math.max(0, v.v - dev.o.v) / 40);
    }
    // Un danger sur la ligne
    for (const h of c.dangers) {
      const ds = h.dist - v.dist;
      if (ds > -4 && ds < 130 && Math.abs(h.d - d) < R.danger.rayon + R.voiture.largeur / 2) score -= 3;
    }
    // Un bonus à ramasser
    if (!v.bonus) {
      for (const b of c.bonus) {
        if (b.retour > 0) continue;
        let ds = b.s - v.s;
        if (ds < -piste.longueur / 2) ds += piste.longueur; else if (ds > piste.longueur / 2) ds -= piste.longueur;
        if (ds > 0 && ds < 90 && Math.abs(b.d - d) < 6) score += 0.4;
      }
    }
    // Le virage qui vient : la corde gagne du chemin, mais use les pneus
    const depart = Math.floor(v.s / piste.pas);
    let k = 0;
    for (let j = 4; j < 22; j += 3) k += piste.pts[(depart + j) % piste.n].k;
    k /= 6;
    const interieur = d === 0 ? 0 : Math.sign(d) === Math.sign(k) ? 1 : -0.6;
    score += interieur * Math.min(1, Math.abs(k) * 70) * (v.usure < 0.7 ? 0.22 : 0.02) * (0.6 + v.style * 0.8);
    // Une ligne prise par quelqu'un à côté : impossible
    if (l !== v.ligne && !ligneLibre(c, v, l)) score -= 5;
    if (score > meilleurScore) { meilleurScore = score; meilleur = l; }
  }
  return borne(meilleur, -1, 1);
}
