// Le pilote automatique : il conduit les voitures de l'ordinateur, et la voiture
// du joueur quand il ramasse le bonus « pilote ». Du JS pur.
// Il regarde devant lui, calcule la vitesse que chaque virage permet avec les
// pneus qu'il a, freine à temps, et cherche un côté libre quand on le gêne.
import { pointA } from './piste.js?v=0.3.0';

const angle = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const borne = (x, a, b) => Math.max(a, Math.min(b, x));

// ctx : { piste, R, g (adhérence actuelle), voitures (les autres),
//         stand : null, ou { ds (distance au box), dedans, service } quand le pilote va changer de pneus }
export function piloteIA(v, ctx) {
  const { piste, R, g } = ctx;
  // Chaque pilote a son talent : un à deux pour cent d'écart suffit à étirer le peloton
  const niv = (R.ia.niveaux[v.niveau] ?? 0.93) * (0.97 + 0.06 * ((v.style * 7.3) % 1));
  const demi = piste.largeur / 2;

  // Un côté libre : on s'écarte d'une voiture proche devant soi
  let cible = (v.style - 0.5) * demi * 0.5;
  for (const o of ctx.voitures) {
    if (o === v || o.fini) continue;
    let ds = o.s - v.s;
    if (ds < -piste.longueur / 2) ds += piste.longueur; else if (ds > piste.longueur / 2) ds -= piste.longueur;
    if (ds > 2 && ds < 38 && Math.abs(o.d - v.d) < 13) {
      cible = borne(v.d + (v.d >= o.d ? 11 : -11), -(demi - 7), demi - 7);
    }
  }
  if (ctx.stand) cible = demi + R.stand.largeur / 2 - 2; // vers la voie des stands
  v.off = (v.off ?? v.d) + (cible - (v.off ?? v.d)) * 0.08;

  const La = 12 + v.vitesse * 0.3;
  const T = pointA(piste, v.s + La, borne(v.off, -demi - R.stand.largeur, demi + R.stand.largeur));
  const err = angle(Math.atan2(T.y - v.y, T.x - v.x) - v.cap);
  const volant = borne(err * 2.4, -1, 1);

  // La vitesse permise : celle de chaque virage à venir, ramenée à maintenant par le freinage
  const amax = R.voiture.adherence * g * 0.92 * niv;
  const decel = R.voiture.frein * (0.5 + 0.5 * Math.min(1, g)) * 0.75;
  const horizon = (v.vitesse * v.vitesse) / (2 * decel) + 40;
  let cible_v = R.voiture.vmax * niv * (1 - v.degats * R.degats.perte);
  const n = piste.n;
  const depart = Math.floor(v.s / piste.pas);
  for (let j = 0; j * piste.pas < horizon; j++) {
    const p = piste.pts[(depart + j) % n];
    const vc = Math.sqrt(amax / Math.max(Math.abs(p.k), 1e-4));
    cible_v = Math.min(cible_v, Math.sqrt(vc * vc + 2 * decel * j * piste.pas));
  }
  if (Math.abs(v.d) > demi + 1) cible_v = Math.min(cible_v, R.voiture.vmax * 0.35); // on revient doucement
  if (ctx.stand) {
    cible_v = Math.min(cible_v, ctx.stand.service ? 0 : Math.sqrt(2 * decel * 0.7 * Math.max(0, ctx.stand.ds)) + 5);
    if (ctx.stand.dedans) cible_v = Math.min(cible_v, R.stand.vitesseMax * 2);
  }
  // Un virage sans visibilité sur le cap : on calme le jeu quand on est très en travers
  cible_v *= 1 - Math.min(0.5, Math.abs(err) * 0.35);

  const gaz = borne((cible_v - v.vitesse) / 14, 0, 1);
  const frein = v.vitesse > cible_v + 4 ? borne((v.vitesse - cible_v) / 28, 0, 1) : 0;
  return { gaz: frein > 0 ? 0 : gaz, frein, volant };
}
