// Un circuit tient dans un code court qu'on se passe par message : « CR1. » et du
// texte. Du JS pur. Tout ce qui vient d'un code est vérifié avant d'être utilisé
// (nombre de points, bornes, thème), un code collé n'est jamais une confiance.
export const THEMES_VALIDES = ['port', 'dunes', 'prairie'];
const PREFIXE = 'CR1.';
const MAX_POINTS = 40, MIN_POINTS = 4, BORNE = 4000;

// → un circuit propre, ou lève une erreur lisible
export function normaliserCircuit(brut) {
  if (!brut || typeof brut !== 'object') throw new Error('Circuit illisible');
  const pts = Array.isArray(brut.points) ? brut.points : [];
  if (pts.length < MIN_POINTS || pts.length > MAX_POINTS) throw new Error(`Un circuit a entre ${MIN_POINTS} et ${MAX_POINTS} points`);
  const points = pts.map(p => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) throw new Error('Point invalide');
    return [Math.round(Math.max(-BORNE, Math.min(BORNE, p[0]))), Math.round(Math.max(-BORNE, Math.min(BORNE, p[1])))];
  });
  const largeur = Math.max(24, Math.min(60, Math.round(Number(brut.largeur) || 34)));
  return {
    id: typeof brut.id === 'string' && /^[\w-]{1,40}$/.test(brut.id) ? brut.id : 'perso',
    nom: String(brut.nom ?? 'Mon circuit').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || 'Mon circuit',
    theme: THEMES_VALIDES.includes(brut.theme) ? brut.theme : 'prairie',
    largeur,
    tours: Math.max(1, Math.min(20, Math.round(Number(brut.tours) || 3))),
    points,
  };
}

const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function circuitVersCode(def) {
  const c = normaliserCircuit(def);
  return PREFIXE + b64(JSON.stringify({ n: c.nom, t: c.theme, l: c.largeur, r: c.tours, p: c.points.flat() }));
}

export function codeVersCircuit(code) {
  const texte = String(code).trim();
  if (!texte.startsWith(PREFIXE)) throw new Error('Ce n\'est pas un code de circuit (il commence par CR1.)');
  let o;
  try { o = JSON.parse(deb64(texte.slice(PREFIXE.length))); } catch { throw new Error('Code abîmé : il manque des caractères ?'); }
  if (!Array.isArray(o.p) || o.p.length % 2) throw new Error('Code abîmé');
  const points = [];
  for (let i = 0; i < o.p.length; i += 2) points.push([o.p[i], o.p[i + 1]]);
  return normaliserCircuit({ nom: o.n, theme: o.t, largeur: o.l, tours: o.r, points });
}
