// Le contenu modifiable par l'Atelier (section 17) : la version publiée dans
// le dépôt (assets/design/*.json), plus les retouches de ce navigateur pas
// encore publiées. Le jeu l'appelle au lancement, avant de dessiner.
import { SPRITES } from './sprites-data.js?v=0.1.0';
import { REGLAGES } from './data/reglages.js?v=0.1.0';

const BROUILLON = 'crazyracing:atelier';

async function lireJSON(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export function lireBrouillon() {
  try { return JSON.parse(localStorage.getItem(BROUILLON)) || {}; } catch { return {}; }
}
export function ecrireBrouillon(b) {
  try { localStorage.setItem(BROUILLON, JSON.stringify(b)); } catch { /* plein ou bloqué */ }
}

const fusion = (base, plus) => {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(plus || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' ? fusion(out[k], v) : v;
  }
  return out;
};

// → { sprites, reglages, publie: { sprites, reglages }, aPublier: n }
export async function chargerContenu() {
  const [sprites, reglages] = await Promise.all([lireJSON('assets/design/sprites.json'), lireJSON('assets/design/reglages.json')]);
  const publie = { sprites: { ...SPRITES, ...(sprites || {}) }, reglages: fusion(REGLAGES, reglages) };
  const b = lireBrouillon();
  const aPublier = Object.keys(b.sprites || {}).length + Object.keys(b.reglages || {}).length;
  return {
    sprites: { ...publie.sprites, ...(b.sprites || {}) },
    reglages: fusion(publie.reglages, b.reglages),
    publie,
    aPublier,
  };
}
