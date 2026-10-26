/* ─── Éditeur de pixels de l'Atelier — partagé entre les jeux ──────────────
   Source de vérité : supershivas/game-system/modules/pixel-editor.js
   Applique les sections 12 et 17 de CONVENTIONS.md : on dessine des
   sprites en matrices de lettres, dans la palette du jeu et seulement elle.
   Pour un gros travail de dessin : Pixel Studio (supershivas/pixel-studio),
   puis import PNG (ramené à la palette par `imageToRows` de sprites.js).

   Module ES sans dépendance (l'aperçu est dessiné ici, sans sprites.js) :
     import { mountPixelEditor } from './lib/pixel-editor.js?v=0.3.0'
     const ed = mountPixelEditor(document.getElementById('editeur'), {
       rows: HERO,                  // ['..kk..', ...]
       palette: PALETTE,            // { k: '#1b1f3b', w: '#e8eef7', ... }
       onChange: rows => brouillon.set('hero', rows),   // à chaque trait terminé
       zoom: 16,                    // taille d'un pixel à l'écran, en px CSS
     })
     ed.getRows(); ed.setRows(rows); ed.destroy()
   Outils : crayon, gomme, pot, pipette, miroir horizontal ; annuler / refaire
   (boutons, et Ctrl+Z / Ctrl+Maj+Z : l'atelier n'est pas le jeu).
   ─────────────────────────────────────────────────────────────────────────── */

const VOID = '.';

export function mountPixelEditor(root, { rows, palette, onChange, zoom = 16 } = {}) {
  let grid = rows.map(r => r.split(''));
  let w = Math.max(...grid.map(r => r.length));
  let h = grid.length;
  grid = grid.map(r => { while (r.length < w) r.push(VOID); return r; });
  const letters = Object.keys(palette);
  let color = letters[0];
  let tool = 'crayon';
  let mirror = false;
  const undo = [], redo = [];

  root.classList.add('pxed');
  root.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = `
    .pxed { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .pxed-tools, .pxed-colors { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .pxed button { min-width: 44px; min-height: 44px; border: 1px solid rgba(0,0,0,.2); border-radius: 6px; background: #fff; font: 13px system-ui, sans-serif; }
    .pxed button.is-on { outline: 3px solid #1c1c1e; outline-offset: -3px; }
    .pxed-swatch { width: 44px; }
    .pxed-swatch.void { background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 12px 12px !important; }
    .pxed-wrap { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .pxed-canvas { touch-action: none; image-rendering: pixelated; cursor: crosshair; background: repeating-conic-gradient(#e6e6e6 0 25%, #fff 0 50%) 0 0 / 16px 16px; }
    .pxed-preview { display: flex; gap: 12px; align-items: flex-end; }
    .pxed-preview canvas { image-rendering: pixelated; background: #888; }`;
  root.append(style);

  const tools = document.createElement('div'); tools.className = 'pxed-tools';
  const colors = document.createElement('div'); colors.className = 'pxed-colors';
  const wrap = document.createElement('div'); wrap.className = 'pxed-wrap';
  const cv = document.createElement('canvas'); cv.className = 'pxed-canvas';
  const preview = document.createElement('div'); preview.className = 'pxed-preview';
  const previews = [1, 2, 4].map(() => document.createElement('canvas'));
  preview.append(...previews);
  wrap.append(cv, preview);
  root.append(tools, colors, wrap);
  const ctx = cv.getContext('2d');

  const btn = (label, onclick, title) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.title = title || label; b.onclick = onclick;
    return b;
  };
  const toolBtns = {};
  for (const [id, label] of [['crayon', 'Crayon'], ['gomme', 'Gomme'], ['pot', 'Pot'], ['pipette', 'Pipette']]) {
    toolBtns[id] = btn(label, () => { tool = id; refreshUi(); });
    tools.append(toolBtns[id]);
  }
  const mirrorBtn = btn('Miroir', () => { mirror = !mirror; refreshUi(); }, 'Dessiner en miroir horizontal');
  tools.append(mirrorBtn, btn('Annuler', doUndo), btn('Refaire', doRedo), btn('Retourner', flip, 'Retourner horizontalement'));

  const swatches = {};
  for (const l of [VOID, ...letters]) {
    const s = btn(l === VOID ? '' : l, () => { color = l; if (tool === 'gomme' || tool === 'pipette') tool = 'crayon'; refreshUi(); }, l === VOID ? 'Vide' : `${l} ${palette[l]}`);
    s.className = `pxed-swatch ${l === VOID ? 'void' : ''}`;
    if (l !== VOID) { s.style.background = palette[l]; s.style.color = 'transparent'; }
    swatches[l] = s;
    colors.append(s);
  }

  function refreshUi() {
    for (const [id, b] of Object.entries(toolBtns)) b.classList.toggle('is-on', id === tool);
    mirrorBtn.classList.toggle('is-on', mirror);
    for (const [l, s] of Object.entries(swatches)) s.classList.toggle('is-on', l === color);
  }

  function draw() {
    cv.width = w * zoom; cv.height = h * zoom;
    cv.style.width = `${w * zoom}px`; cv.style.height = `${h * zoom}px`;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = grid[y][x];
      if (l !== VOID && palette[l]) { ctx.fillStyle = palette[l]; ctx.fillRect(x * zoom, y * zoom, zoom, zoom); }
    }
    ctx.strokeStyle = 'rgba(0,0,0,.08)';
    ctx.beginPath();
    for (let x = 0; x <= w; x++) { ctx.moveTo(x * zoom + .5, 0); ctx.lineTo(x * zoom + .5, h * zoom); }
    for (let y = 0; y <= h; y++) { ctx.moveTo(0, y * zoom + .5); ctx.lineTo(w * zoom, y * zoom + .5); }
    ctx.stroke();
    previews.forEach((p, i) => {
      const s = [1, 2, 4][i];
      p.width = w * s; p.height = h * s;
      const c = p.getContext('2d');
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const l = grid[y][x];
        if (l !== VOID && palette[l]) { c.fillStyle = palette[l]; c.fillRect(x * s, y * s, s, s); }
      }
    });
  }

  const snapshot = () => grid.map(r => r.join(''));
  const commit = () => onChange?.(snapshot());
  function pushUndo() { undo.push(snapshot()); if (undo.length > 100) undo.shift(); redo.length = 0; }
  function load(rs) { grid = rs.map(r => r.split('')); h = grid.length; w = Math.max(...grid.map(r => r.length)); draw(); }
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); load(undo.pop()); commit(); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); load(redo.pop()); commit(); }
  function flip() { pushUndo(); grid = grid.map(r => r.slice().reverse()); draw(); commit(); }

  function set(x, y, l) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    grid[y][x] = l;
    if (mirror) grid[y][w - 1 - x] = l;
  }
  function fill(x, y, l) {
    const target = grid[y][x];
    if (target === l) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h || grid[cy][cx] !== target) continue;
      grid[cy][cx] = l;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  let painting = false;
  const cell = e => {
    const r = cv.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / zoom), Math.floor((e.clientY - r.top) / zoom)];
  };
  const apply = e => {
    const [x, y] = cell(e);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (tool === 'pipette') { color = grid[y][x]; tool = 'crayon'; refreshUi(); return; }
    if (tool === 'pot') { fill(x, y, color); draw(); return; }
    set(x, y, tool === 'gomme' ? VOID : color);
    draw();
  };
  cv.addEventListener('pointerdown', e => { pushUndo(); painting = true; cv.setPointerCapture(e.pointerId); apply(e); });
  cv.addEventListener('pointermove', e => { if (painting && (tool === 'crayon' || tool === 'gomme')) apply(e); });
  const end = () => { if (painting) { painting = false; commit(); } };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  const onKey = e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    e.preventDefault();
    if (e.shiftKey) doRedo(); else doUndo();
  };
  window.addEventListener('keydown', onKey);

  refreshUi();
  draw();
  return {
    getRows: snapshot,
    setRows(rs) { pushUndo(); load(rs); },
    destroy() { window.removeEventListener('keydown', onKey); root.innerHTML = ''; },
  };
}
