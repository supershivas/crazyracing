/* ─── Sprites en matrices de lettres — partagé entre les jeux ──────────────
   Source de vérité : supershivas/game-system/modules/sprites.js
   Applique les sections 5 et 12 de CONVENTIONS.md : un sprite est de la
   DONNÉE lisible, une matrice de lettres (une lettre par couleur de la
   palette, `.` pour le vide). Elle se relit hors du navigateur, se compare,
   se corrige à l'œil dans le source, et ne peut porter aucune couleur hors
   palette (Factokid, Kingvi, Croiseur).

     export const PALETTE = { k: '#1b1f3b', w: '#e8eef7', r: '#c23b3b' }
     export const HERO = [
       '..kk..',
       '.kwwk.',
       '..rr..',
     ]

   Module ES sans dépendance :
     import { spriteCanvas, drawSprite, frames, paletteToGPL } from './lib/sprites.js'
     const img = spriteCanvas(HERO, PALETTE)          // canvas hors écran, mis en cache
     ctx.drawImage(img, x, y)                          // ou drawSprite(ctx, HERO, PALETTE, x, y, { flip: true })
     const anim = frames([POSE_A, POSE_B], PALETTE)   // tableau de canvas
     paletteToGPL(PALETTE, 'Kingvi')   // palette pour Aseprite, GIMP, Pixel Studio
     paletteToHex(PALETTE)             // une couleur par ligne (Lospec)
     await spriteToPNG(HERO, PALETTE, 4)   // Blob PNG agrandi ×4 (export depuis le labo)
     imageToRows(imageData, PALETTE)   // une image importée → matrice (couleur la plus proche)
     validateSprite(HERO, PALETTE)     // [] ou la liste des problèmes (pour les tests)
   ─────────────────────────────────────────────────────────────────────────── */

const cache = new WeakMap();

export const VOID = '.';

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function spriteSize(rows) {
  return { w: Math.max(0, ...rows.map(r => r.length)), h: rows.length };
}

// Une matrice → un canvas à la taille native (×scale si demandé), mis en cache
export function spriteCanvas(rows, palette, { scale = 1, flip = false } = {}) {
  let byPalette = cache.get(rows);
  if (!byPalette) { byPalette = new Map(); cache.set(rows, byPalette); }
  const key = `${JSON.stringify(palette)}|${scale}|${flip}`;
  if (byPalette.has(key)) return byPalette.get(key);
  const { w, h } = spriteSize(rows);
  const c = makeCanvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  // Une ligne de pixels de même couleur = un seul rectangle (pas un fillRect par pixel)
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    let x = 0;
    while (x < w) {
      const ch = row[x] ?? VOID;
      let end = x + 1;
      while (end < w && (row[end] ?? VOID) === ch) end++;
      if (ch !== VOID && ch !== ' ' && palette[ch]) {
        ctx.fillStyle = palette[ch];
        const dx = flip ? w - end : x;
        ctx.fillRect(dx * scale, y * scale, (end - x) * scale, scale);
      }
      x = end;
    }
  }
  byPalette.set(key, c);
  return c;
}

export function drawSprite(ctx, rows, palette, x, y, opts = {}) {
  const c = spriteCanvas(rows, palette, opts);
  ctx.drawImage(c, Math.round(x), Math.round(y));
}

export const frames = (list, palette, opts) => list.map(rows => spriteCanvas(rows, palette, opts));

// Une planche : plusieurs sprites côte à côte (atlas, ou export pour l'édition)
export function sheet(list, palette, { gap = 1, scale = 1 } = {}) {
  const sizes = list.map(spriteSize);
  const w = sizes.reduce((s, z) => s + z.w + gap, -gap);
  const h = Math.max(...sizes.map(z => z.h));
  const c = makeCanvas(Math.max(1, w) * scale, Math.max(1, h) * scale);
  const ctx = c.getContext('2d');
  let x = 0;
  list.forEach((rows, i) => {
    ctx.drawImage(spriteCanvas(rows, palette, { scale }), x * scale, 0);
    x += sizes[i].w + gap;
  });
  return c;
}

export async function spriteToPNG(rows, palette, scale = 1) {
  const c = spriteCanvas(rows, palette, { scale });
  if (c.convertToBlob) return c.convertToBlob({ type: 'image/png' });
  return new Promise(res => c.toBlob(res, 'image/png'));
}

export function flipRows(rows) {
  const { w } = spriteSize(rows);
  return rows.map(r => r.padEnd(w, VOID).split('').reverse().join(''));
}

const hexToRgb = hex => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function paletteToGPL(palette, name = 'Palette') {
  const lines = ['GIMP Palette', `Name: ${name}`, 'Columns: 8', '#'];
  for (const [letter, hex] of Object.entries(palette)) {
    const [r, g, b] = hexToRgb(hex);
    lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${letter}`);
  }
  return lines.join('\n') + '\n';
}

export const paletteToHex = palette => Object.values(palette).map(h => h.replace('#', '').toLowerCase()).join('\n') + '\n';

// Une image (ImageData) → matrice, chaque pixel ramené à la couleur la plus
// proche de la palette ; les pixels transparents (alpha < 128) sont le vide.
export function imageToRows({ data, width, height }, palette) {
  const entries = Object.entries(palette).map(([k, hex]) => [k, hexToRgb(hex)]);
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) { row += VOID; continue; }
      let best = VOID, bestD = Infinity;
      for (const [k, [r, g, b]] of entries) {
        const d = (data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      }
      row += best;
    }
    rows.push(row);
  }
  return rows;
}

// Pour les tests : lignes de longueurs différentes, lettres hors palette
export function validateSprite(rows, palette) {
  const problems = [];
  const { w } = spriteSize(rows);
  rows.forEach((r, y) => {
    if (r.length !== w) problems.push(`ligne ${y} : ${r.length} pixels au lieu de ${w}`);
    for (const ch of r) if (ch !== VOID && ch !== ' ' && !(ch in palette)) problems.push(`ligne ${y} : lettre « ${ch} » hors palette`);
  });
  return problems;
}
