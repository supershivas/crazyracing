/* ─── Canvas en pixels, échelle entière — partagé entre les jeux ────────────
   Source de vérité : supershivas/game-system/modules/pixel-canvas.js
   Applique la section 7 de CONVENTIONS.md : le jeu dessine dans une
   résolution LOGIQUE fixe, agrandie d'un facteur ENTIER, sans lissage, en
   pixels PHYSIQUES (devicePixelRatio : sans cela, sur un écran à 125 %, les
   pixels du jeu tombent entre deux pixels de l'écran et dessinent des bandes).

   Deux modes :
   - 'fixed'  : exactement width × height pixels logiques, centrés, bandes
                autour (puzzle, plateau, écran fixe) ;
   - 'extend' : la hauteur logique visée est `height`, la largeur suit la
                forme de l'écran (monde qui défile) ; `width` est un minimum.

   Module ES sans dépendance :
     import { createPixelCanvas } from './lib/pixel-canvas.js?v=0.3.0'
     const px = createPixelCanvas(document.querySelector('canvas'), {
       width: 320, height: 180, mode: 'extend',
       onResize: ({ width, height, scale }) => {},
     })
     px.ctx            // contexte 2D, déjà mis à l'échelle : dessiner en pixels logiques
     px.width, px.height, px.scale
     px.toLogical(x, y)  // coordonnées CSS dans le canvas → pixels logiques
     px.zoom(+1)         // un cran entier de plus (molette), borné
   Le canvas est dimensionné d'après son PARENT, qui doit avoir une taille
   (par exemple 100vw × 100dvh) ; le canvas ne la donne jamais au parent.
   ─────────────────────────────────────────────────────────────────────────── */

export function createPixelCanvas(canvas, {
  width = 320,
  height = 180,
  mode = 'fixed',
  maxZoom = 1,          // crans de zoom au-delà du facteur de base (molette)
  onResize,
} = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const state = { width, height, scale: 1, cssScale: 1, zoomSteps: 0, offsetX: 0, offsetY: 0 };

  canvas.style.imageRendering = 'pixelated';
  canvas.style.position = 'absolute';

  function resize() {
    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cssW = parent.clientWidth, cssH = parent.clientHeight;
    const devW = Math.floor(cssW * dpr), devH = Math.floor(cssH * dpr);
    // Facteur entier en pixels physiques
    // (le plus grand facteur qui fait tenir width × height ; en 'extend', le
    // reste de l'écran est rempli de pixels logiques en plus)
    const base = Math.max(1, Math.floor(Math.min(devW / width, devH / height)));
    const scale = base + state.zoomSteps;
    let w = width, h = height;
    if (mode === 'extend') {
      w = Math.max(1, Math.floor(devW / scale));
      h = Math.max(1, Math.floor(devH / scale));
    }
    canvas.width = w * scale;
    canvas.height = h * scale;
    // Taille CSS exacte = pixels physiques / dpr : pas de rééchantillonnage
    canvas.style.width = `${(w * scale) / dpr}px`;
    canvas.style.height = `${(h * scale) / dpr}px`;
    state.offsetX = Math.floor((cssW - (w * scale) / dpr) / 2);
    state.offsetY = Math.floor((cssH - (h * scale) / dpr) / 2);
    canvas.style.left = `${state.offsetX}px`;
    canvas.style.top = `${state.offsetY}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    Object.assign(state, { width: w, height: h, scale, cssScale: scale / dpr });
    onResize?.({ width: w, height: h, scale });
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  window.addEventListener('resize', resize);
  // Changer d'écran (dpr différent) ne déclenche pas toujours `resize`
  let mq = null;
  const watchDpr = () => {
    mq?.removeEventListener('change', onDpr);
    mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', onDpr);
  };
  function onDpr() { resize(); watchDpr(); }
  watchDpr();
  resize();

  return {
    canvas, ctx,
    get width() { return state.width; },
    get height() { return state.height; },
    get scale() { return state.scale; },
    get zoomSteps() { return state.zoomSteps; },
    toLogical(x, y) {
      return { x: Math.floor(x / state.cssScale), y: Math.floor(y / state.cssScale) };
    },
    zoom(delta) {
      const next = Math.max(0, Math.min(maxZoom, state.zoomSteps + delta));
      if (next !== state.zoomSteps) { state.zoomSteps = next; resize(); }
      return state.zoomSteps;
    },
    setZoom(steps) { state.zoomSteps = Math.max(0, Math.min(maxZoom, steps | 0)); resize(); },
    resize,
    destroy() { ro.disconnect(); window.removeEventListener('resize', resize); mq?.removeEventListener('change', onDpr); },
  };
}
