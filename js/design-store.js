// Le contenu modifiable par l'Atelier (section 17) : la version publiée dans
// le dépôt (assets/design/*.json), plus les retouches de ce navigateur pas
// encore publiées. Le jeu l'appelle au lancement, avant de dessiner.
import { REGLAGES } from './data/reglages.js?v=0.4.0';

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

// → { reglages, publie: { reglages }, aPublier: n }
export async function chargerContenu() {
  const reglages = await lireJSON('assets/design/reglages.json');
  const publie = { reglages: fusion(REGLAGES, reglages) };
  const b = lireBrouillon();
  return {
    reglages: fusion(publie.reglages, b.reglages),
    publie,
    aPublier: Object.keys(b.reglages || {}).length,
  };
}
