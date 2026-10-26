// Le rendu : dessine l'état, ne le modifie jamais (section 12).
// Tout est en pixels logiques ; pixel-canvas.js s'occupe de l'échelle entière.
// Le circuit est peint une fois, pixel par pixel, dans un canvas aussi grand que
// le monde (voir creerDecor) ; chaque image n'en recopie que la partie visible.
import { spriteCanvas } from './lib/sprites.js?v=0.1.0';
import { hash2 } from './lib/rng.js?v=0.1.0';
import { PALETTE, LIVREES } from './palette.js?v=0.1.0';

const THEMES = {
  port: { sol: 'h', grain: 'i', deco: ['conteneur', 'conteneur2', 'rocher'], densite: 0.00045, asphalte: 'k', bordure: ['r', 'w'] },
  dunes: { sol: 'y', grain: 'o', deco: ['cactus', 'rocher', 'buisson'], densite: 0.0007, asphalte: 'k', bordure: ['o', 'w'] },
  prairie: { sol: 'v', grain: 'l', deco: ['arbre', 'buisson', 'rocher'], densite: 0.0012, asphalte: 'k', bordure: ['r', 'w'] },
};
export const THEMES_NOMS = Object.keys(THEMES);
const MARGE = 170; // le décor déborde du circuit

export const themeDe = def => THEMES[def.theme] ?? THEMES.prairie;

// → { sec, mouille, traces, x0, y0 } : le circuit peint (sec et mouillé), en coordonnées monde décalées de (x0, y0)
export function creerDecor(piste, def, sprites, R) {
  const th = themeDe(def);
  const x0 = Math.floor(piste.boite.x0 - MARGE), y0 = Math.floor(piste.boite.y0 - MARGE);
  const W = Math.ceil(piste.boite.x1 + MARGE - x0), H = Math.ceil(piste.boite.y1 + MARGE - y0);
  const demi = piste.largeur / 2;
  const stand = R.stand;
  const portee = demi + 5 + stand.largeur;
  const mkCanvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const sec = mkCanvas(), mouille = mkCanvas(), traces = mkCanvas();
  const g1 = sec.getContext('2d'), g2 = mouille.getContext('2d');
  const img1 = g1.createImageData(W, H), img2 = g2.createImageData(W, H);
  const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const C = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, rgb(v)]));

  // Une grille de recherche : pas de balayage de tous les échantillons à chaque pixel
  const CELL = 32, gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
  const cases = Array.from({ length: gw * gh }, () => []);
  piste.pts.forEach((p, i) => {
    const cx = Math.floor((p.x - x0) / CELL), cy = Math.floor((p.y - y0) / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const gx = cx + a, gy = cy + b;
      if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) cases[gy * gw + gx].push(i);
    }
  });
  const L = piste.longueur;
  const sol = C[th.sol], grain = C[th.grain];
  const asph = C[th.asphalte], asphMouille = C.m;
  const [b1, b2] = th.bordure.map(k => C[k]);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const wx = px + x0, wy = py + y0;
      const liste = cases[Math.floor(py / CELL) * gw + Math.floor(px / CELL)];
      let col = null, mouillee = null;
      if (liste.length) {
        let best = Infinity, bi = -1;
        for (const i of liste) {
          const p = piste.pts[i];
          const dd = (p.x - wx) ** 2 + (p.y - wy) ** 2;
          if (dd < best) { best = dd; bi = i; }
        }
        if (bi >= 0 && best < (portee + 2) ** 2) {
          const p = piste.pts[bi];
          const dx = wx - p.x, dy = wy - p.y;
          const d = dx * p.nx + dy * p.ny;
          const s = p.s + dx * p.tx + dy * p.ty;
          const ad = Math.abs(d);
          const sp = s > L / 2 ? s - L : s;
          if (ad <= demi) {
            col = asph; mouillee = asphMouille;
            if (sp >= 0 && sp < 4) { // la ligne de départ : un damier
              const sombre = ((Math.floor(ad / 2) + Math.floor(sp / 2)) & 1) === 0;
              col = mouillee = sombre ? C.w : C.n;
            } else if (ad < 0.8 && (Math.floor(s / 8) & 1) === 0) { col = C.i; mouillee = C.t; } // ligne centrale pointillée
          } else if (d > 0 && sp >= -stand.avant && sp <= stand.apres && ad <= demi + stand.largeur) {
            // la voie des stands : asphalte plus clair, un box dessiné en jaune
            col = C.i; mouillee = C.t;
            const dansBox = Math.abs(sp - 22) <= 9, bord = ad < demi + 4.5 || ad > demi + stand.largeur - 4.5 || Math.abs(sp - 22) > 7.5;
            if (dansBox && ad > demi + 3 && ad < demi + stand.largeur - 2 && bord) { col = C.y; mouillee = C.y; }
          } else if (ad <= demi + 3.5) {
            col = mouillee = (Math.floor(s / 5) & 1) === 0 ? b1 : b2; // les vibreurs
          }
        }
      }
      if (!col) {
        col = mouillee = hash2(wx, wy, 11) < 0.045 ? grain : sol;
      }
      const o = (py * W + px) * 4;
      img1.data[o] = col[0]; img1.data[o + 1] = col[1]; img1.data[o + 2] = col[2]; img1.data[o + 3] = 255;
      img2.data[o] = mouillee[0]; img2.data[o + 1] = mouillee[1]; img2.data[o + 2] = mouillee[2]; img2.data[o + 3] = 255;
    }
  }
  g1.putImageData(img1, 0, 0); g2.putImageData(img2, 0, 0);

  // Le décor : posé hors du circuit et de la voie des stands ; la même graine donne le même décor
  const distMin = (x, y) => {
    let m = Infinity;
    for (const p of piste.pts) { const dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < m) m = dd; }
    return Math.sqrt(m);
  };
  const essais = Math.floor(W * H * th.densite * 3);
  const poses = [];
  for (let k = 0; k < essais && poses.length < W * H * th.densite; k++) {
    const x = Math.floor(x0 + hash2(k, 1, 77) * W), y = Math.floor(y0 + hash2(k, 2, 77) * H);
    if (distMin(x, y) < demi + stand.largeur + 12) continue;
    if (poses.some(q => Math.abs(q.x - x) < 14 && Math.abs(q.y - y) < 14)) continue;
    poses.push({ x, y, nom: th.deco[Math.floor(hash2(k, 3, 77) * th.deco.length)] });
  }
  poses.sort((a, b) => a.y - b.y);
  for (const q of poses) {
    const spr = sprites[q.nom];
    if (!spr) continue;
    const cv = spriteCanvas(spr, PALETTE);
    for (const g of [g1, g2]) {
      g.fillStyle = 'rgba(26,28,44,.25)';
      g.fillRect(q.x - x0 - 2, q.y - y0 + 1, cv.width + 1, 2);
      g.drawImage(cv, q.x - x0 - (cv.width >> 1), q.y - y0 - cv.height + 3);
    }
  }
  return { sec, mouille, traces, x0, y0, W, H, sol: PALETTE[th.sol] };
}

// Les sprites de voiture, pivotés d'avance (32 angles par livrée) : pas de rotation à chaque image
const cacheVoitures = new Map();
const ANGLES = 32;
export function spriteVoiture(sprites, equipe, cap) {
  const k = ((Math.round(cap / (Math.PI * 2) * ANGLES) % ANGLES) + ANGLES) % ANGLES;
  const cle = `${equipe}:${k}`;
  let cv = cacheVoitures.get(cle);
  if (!cv) {
    const livree = LIVREES[equipe % LIVREES.length];
    const base = spriteCanvas(sprites.voiture, { ...PALETTE, ...livree });
    cv = document.createElement('canvas'); cv.width = cv.height = 16;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.translate(8, 8); g.rotate(k / ANGLES * Math.PI * 2); g.drawImage(base, -base.width / 2, -base.height / 2);
    cacheVoitures.set(cle, cv);
  }
  return cv;
}
export const viderCaches = () => cacheVoitures.clear();

// Un petit état de présentation (caméra, fumée, pluie) : jamais dans la règle du jeu
export function creerVue() {
  return { cam: { x: 0, y: 0 }, cx: null, cy: null, fumee: [], frame: 0 };
}

// c : la course ; vue : creerVue ; decor : creerDecor ; opts : { suivre: id, fantome: { pts } }
// → la caméra
export function dessiner(ctx, c, vue, ecran, decor, sprites, opts = {}) {
  vue.frame++;
  const suivre = c.voitures.find(v => v.id === opts.suivre) ?? c.voitures[0];
  // La caméra va vers l'endroit où l'on va : un peu devant la voiture, selon sa vitesse
  const cible = { x: suivre.x + suivre.vx * 0.45, y: suivre.y + suivre.vy * 0.45 };
  const k = vue.cx == null ? 1 : 0.12;
  vue.cx = (vue.cx ?? cible.x) + (cible.x - (vue.cx ?? cible.x)) * k;
  vue.cy = (vue.cy ?? cible.y) + (cible.y - (vue.cy ?? cible.y)) * k;
  const cam = { x: Math.round(vue.cx - ecran.width / 2), y: Math.round(vue.cy - ecran.height / 2) };
  vue.cam = cam;
  const ox = decor.x0 - cam.x, oy = decor.y0 - cam.y;

  ctx.fillStyle = decor.sol;
  ctx.fillRect(0, 0, ecran.width, ecran.height);
  ctx.drawImage(decor.sec, ox, oy);
  if (c.eau > 0.03) { ctx.globalAlpha = Math.min(0.9, c.eau * 1.1); ctx.drawImage(decor.mouille, ox, oy); ctx.globalAlpha = 1; }
  // La trace sèche, là où l'on roule
  if (c.eau > 0.2) {
    ctx.fillStyle = PALETTE.k;
    for (let i = 0; i < c.piste.n; i += 2) {
      const t = c.trace[i];
      if (t < 0.25) continue;
      const p = c.piste.pts[i];
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx < -10 || sy < -10 || sx > ecran.width + 10 || sy > ecran.height + 10) continue;
      ctx.globalAlpha = Math.min(1, t) * Math.min(1, c.eau * 1.2) * 0.9;
      ctx.fillRect(Math.round(sx - 3), Math.round(sy - 3), 6, 6);
    }
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(decor.traces, ox, oy); // les traces de pneus, qui restent

  for (const b of c.bonus) {
    if (b.retour > 0) continue;
    const sx = Math.round(b.x - cam.x), sy = Math.round(b.y - cam.y + Math.sin((vue.frame + b.s) / 14) * 1.2);
    if (sx < -12 || sy < -12 || sx > ecran.width + 12 || sy > ecran.height + 12) continue;
    for (const [r, col] of [[7, PALETTE.n], [6, PALETTE.w], [5, PALETTE.n]]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); }
    const ic = sprites[`ic_${b.type === 'reparation' ? 'gomme' : b.type}`];
    if (ic) ctx.drawImage(spriteCanvas(ic, PALETTE), sx - 3, sy - 3);
  }

  // Le fantôme du meilleur tour
  if (opts.fantome && c.mode === 'chrono') {
    const j = c.voitures.find(v => v.humain);
    if (j && j.tour >= 0) {
      const f = opts.fantome.pts;
      const u = (c.t - j.dernierTour) / 0.1, i = Math.floor(u);
      if (i >= 0 && i < f.length - 1) {
        const a = f[i], b = f[i + 1], t = u - i;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(spriteVoiture(sprites, 5, a[2]), Math.round(a[0] + (b[0] - a[0]) * t - cam.x - 8), Math.round(a[1] + (b[1] - a[1]) * t - cam.y - 8));
        ctx.globalAlpha = 1;
      }
    }
  }

  // Les voitures, de la plus haute à la plus basse à l'écran
  for (const v of [...c.voitures].sort((a, b) => a.y - b.y)) {
    const sx = Math.round(v.x - cam.x), sy = Math.round(v.y - cam.y);
    if (sx < -16 || sy < -16 || sx > ecran.width + 16 || sy > ecran.height + 16) continue;
    ctx.fillStyle = 'rgba(26,28,44,.35)';
    ctx.fillRect(sx - 5, sy + 2, 11, 4);
    if (v.turbo > 0) { // les flammes
      ctx.fillStyle = (vue.frame >> 1) & 1 ? PALETTE.y : PALETTE.o;
      ctx.fillRect(Math.round(sx - Math.cos(v.cap) * 8) - 1, Math.round(sy - Math.sin(v.cap) * 8) - 1, 3, 3);
    }
    ctx.drawImage(spriteVoiture(sprites, v.equipe, v.cap), sx - 8, sy - 8);
    if (v.bouclier > 0) { ctx.strokeStyle = (vue.frame >> 2) & 1 ? PALETTE.s : PALETTE.c; ctx.beginPath(); ctx.arc(sx + 0.5, sy + 0.5, 8, 0, 7); ctx.stroke(); }
    if (v.crevaison && (vue.frame >> 3) & 1) { ctx.fillStyle = PALETTE.r; ctx.fillRect(sx - 1, sy - 11, 3, 3); }
    if (v.id === suivre.id) { ctx.fillStyle = PALETTE.w; ctx.fillRect(sx - 1, sy - 13, 3, 1); }
  }

  // Fumée et traces des dérapages (cosmétique)
  for (const v of c.voitures) {
    const lateral = Math.abs(-v.vx * Math.sin(v.cap) + v.vy * Math.cos(v.cap));
    if (v.vitesse > 40 && lateral > 28 && (vue.frame & 1) === 0) {
      vue.fumee.push({ x: v.x - Math.cos(v.cap) * 4, y: v.y - Math.sin(v.cap) * 4, vie: 14 });
      const g = decor.traces.getContext('2d');
      g.fillStyle = 'rgba(26,28,44,.32)';
      g.fillRect(Math.round(v.x - decor.x0 - Math.cos(v.cap) * 3), Math.round(v.y - decor.y0 - Math.sin(v.cap) * 3), 2, 1);
    }
  }
  vue.fumee = vue.fumee.filter(f => --f.vie > 0);
  for (const f of vue.fumee) {
    ctx.globalAlpha = f.vie / 22;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(Math.round(f.x - cam.x) - 1, Math.round(f.y - cam.y - (14 - f.vie) * 0.2) - 1, 2, 2);
  }
  ctx.globalAlpha = 1;

  // La pluie : des traits en biais, qui défilent
  if (c.eau > 0.08) {
    ctx.fillStyle = PALETTE.s;
    ctx.globalAlpha = 0.55;
    const n = Math.floor(c.eau * 70);
    for (let i = 0; i < n; i++) {
      const x = (hash2(i, 5, 3) * (ecran.width + 40) + vue.frame * 1.4) % (ecran.width + 40) - 20;
      const y = (hash2(i, 6, 3) * (ecran.height + 20) + vue.frame * 4.2) % (ecran.height + 20) - 10;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
    }
    ctx.globalAlpha = 1;
  }
  return cam;
}

// Le circuit en petit, pour la carte (canvas DOM) : on le peint une fois, puis on rend
// la fonction qui repeint les voitures par-dessus
export function dessinerCarte(cv, piste, taille = 110) {
  const g = cv.getContext('2d');
  const b = piste.boite;
  const f = Math.min(taille / (b.x1 - b.x0), taille / (b.y1 - b.y0));
  cv.width = Math.ceil((b.x1 - b.x0) * f) + 6; cv.height = Math.ceil((b.y1 - b.y0) * f) + 6;
  const tr = p => [3 + (p.x - b.x0) * f, 3 + (p.y - b.y0) * f];
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  piste.pts.forEach((p, i) => { const [x, y] = tr(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.closePath();
  g.strokeStyle = PALETTE.n; g.lineWidth = 5; g.stroke();
  g.strokeStyle = PALETTE.h; g.lineWidth = 3; g.stroke();
  const base = g.getImageData(0, 0, cv.width, cv.height);
  return voitures => {
    g.putImageData(base, 0, 0);
    for (const v of voitures) {
      const [x, y] = tr(v);
      g.fillStyle = v.humain ? PALETTE.w : PALETTE.o;
      const r = v.humain ? 2 : 1.5;
      g.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
    }
  };
}
