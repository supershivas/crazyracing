// La voiture : sa physique et l'état de ses pneus. Du JS pur (sections 10 et 12).
// Le modèle tient en une idée : la voiture pointe quelque part (le cap), mais
// elle va où sa vitesse l'emporte. L'adhérence ne ramène la vitesse vers le cap
// que d'une accélération latérale limitée : trop vite dans un virage, elle glisse.
// L'adhérence dépend du pneu, de son usure, de sa chaleur, de l'eau et du sol.

export function nouvelleVoiture(opts = {}) {
  return {
    id: opts.id ?? 'j1', nom: opts.nom ?? 'Joueur', humain: !!opts.humain, equipe: opts.equipe ?? 0,
    x: opts.x ?? 0, y: opts.y ?? 0, cap: opts.cap ?? 0, vx: 0, vy: 0,
    pneu: opts.pneu ?? 'slick', usure: 0, chaleur: 0.2, degats: 0, crevaison: false,
    i: -1, s: 0, d: 0, tour: -1, dist: 0, vitesse: 0,
    turbo: 0, bouclier: 0, pilote: 0, bonus: null,
    avert: 0, hors: false, penalite: 0, prochainPneu: opts.pneu ?? 'slick', stand: 0, standT: 0,
    tours: [], dernierTour: 0, meilleur: null, fini: false, tempsFin: null,
    niveau: opts.niveau ?? 'moyen', style: opts.style ?? 0.5,
    pitVoulu: false, engage: false, enStand: false, immobile: 0, off: null,
  };
}

// Adhérence (1 = pneus neufs, chauds, sur le sec)
export function adherence(v, eau, sol, R) {
  const P = R.pneus[v.pneu];
  const base = P.sec + (P.mouille - P.sec) * eau;
  const usure = 1 - R.pneus.perte * v.usure ** 1.5;
  const c = v.chaleur;
  const chaleur = 1 - 0.25 * Math.max(0, (0.45 - c) / 0.45) - 0.22 * Math.max(0, (c - 0.8) / 0.2);
  let g = base * usure * chaleur * (v.crevaison ? 0.55 : 1);
  if (sol === 'herbe') g *= R.voiture.hors.adherence;
  return g;
}

// commande : { gaz 0..1, frein 0..1, volant -1..1, recul (le frein maintenu à l'arrêt recule) } ; contexte : { sol, eau, R }
// rend { derapage } (pour le son et les traces)
export function pasVoiture(v, cmd, dt, { sol, eau, R }) {
  const V = R.voiture;
  const g = adherence(v, eau, sol, R);
  const abime = 1 - v.degats * R.degats.perte;
  const c = V.acc / (V.vmax * V.vmax);
  const herbe = sol === 'herbe';
  const hv = herbe ? V.hors.vmax : 1;

  const fx = Math.cos(v.cap), fy = Math.sin(v.cap);
  let vf = v.vx * fx + v.vy * fy;
  const vl0 = -v.vx * fy + v.vy * fx;

  const gaz = Math.max(0, Math.min(1, cmd.gaz || 0));
  const frein = Math.max(0, Math.min(1, cmd.frein || 0));
  const poussee = V.acc * (v.turbo > 0 ? 1 + R.bonus.turboPousse : 1);
  const trainee = c / (abime * abime * hv * hv);
  vf += (gaz * poussee - trainee * vf * Math.abs(vf) - Math.sign(vf) * 12 * (herbe ? 1 + V.hors.frottement * 3 : 1)) * dt;
  if (frein > 0) {
    if (vf > 2) vf = Math.max(0, vf - V.frein * frein * (0.5 + 0.5 * Math.min(1, g)) * dt);
    else if (cmd.recul) vf = Math.max(-V.vmax * 0.18, vf - V.acc * 0.35 * frein * dt); // marche arrière lente
    else if (vf < 0) vf = Math.min(0, vf + V.frein * frein * dt);
  }

  // Direction : l'autorité baisse avec la vitesse ; elle s'inverse en marche arrière
  const vabs = Math.abs(vf);
  const autorite = Math.min(1, vabs / 30) / (1 + (vabs / V.vmax) ** 2 * 1.2);
  v.cap += (cmd.volant || 0) * V.braquage * autorite * Math.sign(vf || 1) * dt;

  // Le cap a tourné : on recompose la vitesse dans le nouveau repère
  const gx = Math.cos(v.cap), gy = Math.sin(v.cap);
  const wx = fx * vf - fy * vl0, wy = fy * vf + fx * vl0; // vitesse monde avant adhérence
  let nf = wx * gx + wy * gy;
  let nl = -wx * gy + wy * gx;

  // L'adhérence ramène la vitesse vers le cap, mais pas plus que ce que les pneus tiennent
  const amax = V.adherence * g;
  const dl = Math.max(-amax * dt, Math.min(amax * dt, -nl));
  nl += dl;
  nf -= Math.sign(nf) * Math.abs(nl) * 0.5 * dt; // glisser coûte de la vitesse

  v.vx = gx * nf - gy * nl;
  v.vy = gy * nf + gx * nl;
  v.x += v.vx * dt;
  v.y += v.vy * dt;
  v.vitesse = Math.hypot(v.vx, v.vy);

  // Pneus : usure et chaleur
  const P = R.pneus[v.pneu];
  const derap = Math.abs(nl) + Math.abs(dl) / dt * 0.25;
  const act = Math.min(1, derap / 50 * 0.6 + frein * (v.vitesse / V.vmax) * 0.6 + (v.vitesse / V.vmax) * 0.35);
  v.chaleur += ((0.12 + 0.88 * act) - v.chaleur) * dt / 4;
  const chaud = P.chaud ? 1 + (P.chaud - 1) * (1 - eau) : 1;
  v.usure = Math.min(1, v.usure + dt * (R.pneus.usureBase + R.pneus.usureDerapage * derap + R.pneus.usureFrein * frein * (v.vitesse / V.vmax)) * P.usure * chaud * (herbe ? 1.5 : 1));
  if (v.turbo > 0) v.turbo = Math.max(0, v.turbo - dt);
  if (v.bouclier > 0) v.bouclier = Math.max(0, v.bouclier - dt);
  return { derapage: derap > 22 && v.vitesse > 40, derap };
}

// Le mur de pneus, de part et d'autre du circuit : rebond, perte de vitesse, dégâts.
// d : écart latéral signé du circuit ; limite : demi-largeur + marge (côté stand : plus large)
// → intensité du choc (0 si rien)
export function contreMur(v, proj, piste, limite, R) {
  const ecart = Math.abs(proj.d) - limite;
  if (ecart <= 0) return 0;
  const p = piste.pts[proj.i];
  const sg = Math.sign(proj.d);
  v.x -= p.nx * sg * ecart;
  v.y -= p.ny * sg * ecart;
  const vn = (v.vx * p.nx + v.vy * p.ny) * sg; // vitesse vers le mur
  if (vn <= 0) return 0;
  v.vx -= p.nx * sg * vn * (1 + R.mur.rebond);
  v.vy -= p.ny * sg * vn * (1 + R.mur.rebond);
  v.vx *= 1 - R.mur.perte; v.vy *= 1 - R.mur.perte;
  if (vn > R.degats.vitesseMin * 0.5 && v.bouclier <= 0) {
    v.degats = Math.min(1, v.degats + (vn / R.voiture.vmax) * R.degats.mur);
  }
  return vn;
}

// Contacts entre voitures : on les écarte, on échange un peu de vitesse
// → liste des chocs [{ a, b, vitesse }]
export function contacts(voitures, R) {
  const chocs = [];
  const r2 = (R.voiture.rayon * 2) ** 2;
  for (let i = 0; i < voitures.length; i++) {
    for (let j = i + 1; j < voitures.length; j++) {
      const a = voitures[i], b = voitures[j];
      if (a.fini && b.fini) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dd = dx * dx + dy * dy;
      if (dd >= r2 || dd === 0) continue;
      const d = Math.sqrt(dd), nx = dx / d, ny = dy / d;
      const ov = (R.voiture.rayon * 2 - d) / 2;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const j2 = -rel * 0.65 / 2;
        a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2;
        chocs.push({ a: a.id, b: b.id, vitesse: -rel });
      }
    }
  }
  return chocs;
}
