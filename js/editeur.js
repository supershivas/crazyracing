// L'éditeur de circuits : on déplace, ajoute et retire des points de contrôle, le
// tracé (une spline fermée) se redessine et se vérifie à chaque geste. Le premier
// point est la ligne de départ. Le circuit se joue tout de suite (« Essayer »),
// s'enregistre dans ce navigateur et se partage par un code (circuit-code.js).
import { construirePiste, verifierPiste, projeter } from './piste.js?v=0.4.0';
import { PALETTE } from './palette.js?v=0.4.0';
import { normaliserCircuit } from './circuit-code.js?v=0.4.0';

const SOLS = { port: 'h', dunes: 'y', prairie: 'v' };
const rotation = (pts, k) => [...pts.slice(k), ...pts.slice(0, k)];

// opts : { px (le canvas en pixels), canvas, racine (la section DOM), onTester(def), onEnregistrer(def), onSupprimer(def),
//          onCopier(def), onColler(), onQuitter() }
export function creerEditeur({ px, canvas, racine, onTester, onEnregistrer, onSupprimer, onCopier, onColler, onQuitter }) {
  const $ = id => racine.querySelector(`#${id}`);
  let def = null;            // le circuit en cours d'édition
  let piste = null, verdict = null;
  let mode = 'deplacer';
  let choisi = -1;           // le point choisi
  let cam = { x: 0, y: 0, z: 1 };
  let geste = null;          // { type: 'point' | 'pan', ... }
  let actif = false;
  let modifie = false;

  const recalculer = () => {
    piste = construirePiste(def);
    verdict = verifierPiste(piste);
    const long = `${Math.round(piste.longueur)} m`;
    const etat = $('ed-etat');
    if (verdict.ok) { etat.textContent = `${long} · ${def.points.length} points · rayon mini ${Math.round(verdict.rayonMin)} px${verdict.croisements ? ` · ${verdict.croisements} croisement` : ''} · prêt`; etat.className = 'ed-etat bon'; }
    else { etat.textContent = `${long} · ${verdict.problemes.join(' · ')}`; etat.className = 'ed-etat mauvais'; }
    $('ed-largeur').textContent = def.largeur;
    $('ed-tester').disabled = !verdict.ok;
    $('ed-enregistrer').disabled = !verdict.ok;
  };

  const ecran = (e) => {
    const r = canvas.getBoundingClientRect();
    const l = px.toLogical(e.clientX - r.left, e.clientY - r.top);
    return { x: (l.x - px.width / 2) / cam.z + cam.x, y: (l.y - px.height / 2) / cam.z + cam.y, lx: l.x, ly: l.y };
  };
  const pointProche = (w, rayon = 9) => {
    let best = -1, bd = rayon / cam.z;
    def.points.forEach((p, i) => { const d = Math.hypot(p[0] - w.x, p[1] - w.y); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const cadrer = () => {
    const b = construirePiste(def).boite;
    cam.x = (b.x0 + b.x1) / 2; cam.y = (b.y0 + b.y1) / 2;
    cam.z = Math.max(0.25, Math.min(2, Math.min((px.width - 24) / (b.x1 - b.x0), (px.height - 190 / px.scale * 3) / (b.y1 - b.y0))));
  };

  // Insérer un point sur la courbe : entre les deux points de contrôle qui l'encadrent
  const inserer = w => {
    const pr = projeter(piste, w.x, w.y);
    const abscisses = def.points.map(p => projeter(piste, p[0], p[1]).s);
    let k = def.points.length - 1; // par défaut : après le dernier, avant le premier
    for (let i = 0; i < abscisses.length; i++) {
      const a = abscisses[i], b = abscisses[(i + 1) % abscisses.length];
      const dedans = a <= b ? pr.s >= a && pr.s < b : pr.s >= a || pr.s < b;
      if (dedans) { k = i; break; }
    }
    if (def.points.length >= 40) return;
    def.points.splice(k + 1, 0, [Math.round(w.x), Math.round(w.y)]);
    choisi = k + 1; modifie = true;
    recalculer();
  };

  const bas = e => {
    if (!actif) return;
    canvas.setPointerCapture?.(e.pointerId);
    const w = ecran(e);
    const i = pointProche(w);
    if (mode === 'ajouter' && i < 0) { inserer(w); geste = { type: 'point', i: choisi }; return; }
    if (mode === 'supprimer') {
      if (i >= 0 && def.points.length > 4) { def.points.splice(i, 1); choisi = -1; modifie = true; recalculer(); }
      return;
    }
    if (mode === 'depart') {
      if (i > 0) { def.points = rotation(def.points, i); choisi = 0; modifie = true; recalculer(); }
      return;
    }
    if (i >= 0) { choisi = i; geste = { type: 'point', i }; }
    else { choisi = -1; geste = { type: 'pan', lx: w.lx, ly: w.ly, cx: cam.x, cy: cam.y }; }
  };
  const bouge = e => {
    if (!actif || !geste) return;
    const w = ecran(e);
    if (geste.type === 'point') {
      def.points[geste.i] = [Math.round(w.x), Math.round(w.y)]; modifie = true;
      recalculer();
    } else {
      cam.x = geste.cx - (w.lx - geste.lx) / cam.z; cam.y = geste.cy - (w.ly - geste.ly) / cam.z;
    }
  };
  const haut = () => { geste = null; };
  const molette = e => { if (!actif) return; e.preventDefault(); zoomer(e.deltaY < 0 ? 1.15 : 1 / 1.15); };
  const zoomer = f => { cam.z = Math.max(0.2, Math.min(4, cam.z * f)); };
  canvas.addEventListener('pointerdown', bas);
  canvas.addEventListener('pointermove', bouge);
  canvas.addEventListener('pointerup', haut);
  canvas.addEventListener('pointercancel', haut);
  canvas.addEventListener('wheel', molette, { passive: false });

  // Le clavier : Suppr retire le point choisi, +/- zooment
  const touche = e => {
    if (!actif || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && choisi >= 0 && def.points.length > 4) { def.points.splice(choisi, 1); choisi = -1; modifie = true; recalculer(); }
    else if (e.key === '+' || e.key === '=') zoomer(1.25);
    else if (e.key === '-') zoomer(1 / 1.25);
  };
  window.addEventListener('keydown', touche);

  for (const r of racine.querySelectorAll('input[name="ed-mode"]')) r.onchange = () => { mode = r.value; geste = null; };
  $('ed-nom').oninput = e => { def.nom = e.target.value; modifie = true; };
  $('ed-theme').onchange = e => { def.theme = e.target.value; modifie = true; };
  $('ed-moins').onclick = () => { def.largeur = Math.max(24, def.largeur - 2); modifie = true; recalculer(); };
  $('ed-plus').onclick = () => { def.largeur = Math.min(60, def.largeur + 2); modifie = true; recalculer(); };
  $('ed-zoom-moins').onclick = () => zoomer(1 / 1.25);
  $('ed-zoom-plus').onclick = () => zoomer(1.25);
  $('ed-tester').onclick = () => onTester(normaliserCircuit({ ...def, id: def.id ?? 'essai' }));
  $('ed-enregistrer').onclick = () => { modifie = false; onEnregistrer(normaliserCircuit(def)); };
  $('ed-copier').onclick = () => onCopier(normaliserCircuit(def));
  $('ed-coller').onclick = () => onColler();
  $('ed-supprimer').onclick = () => onSupprimer(def);
  $('ed-quitter').onclick = () => onQuitter(modifie);

  function dessiner(ctx) {
    if (!actif || !piste) return;
    const W = px.width, H = px.height;
    ctx.fillStyle = PALETTE[SOLS[def.theme] ?? 'v'];
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    // La grille, tous les 100 px du monde
    ctx.strokeStyle = 'rgba(26,28,44,.18)'; ctx.lineWidth = 1 / cam.z;
    const x0 = Math.floor((cam.x - W / 2 / cam.z) / 100) * 100, x1 = cam.x + W / 2 / cam.z, y0 = Math.floor((cam.y - H / 2 / cam.z) / 100) * 100, y1 = cam.y + H / 2 / cam.z;
    ctx.beginPath();
    for (let x = x0; x < x1; x += 100) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y < y1; y += 100) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    const trace = () => { ctx.beginPath(); piste.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    trace(); ctx.strokeStyle = PALETTE.w; ctx.lineWidth = piste.largeur + 6; ctx.stroke();
    ctx.setLineDash([5, 5]); ctx.strokeStyle = PALETTE.r; trace(); ctx.stroke(); ctx.setLineDash([]);
    trace(); ctx.strokeStyle = PALETTE.k; ctx.lineWidth = piste.largeur; ctx.stroke();
    trace(); ctx.strokeStyle = PALETTE.i; ctx.lineWidth = 1; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
    // Les endroits où un virage est trop serré
    ctx.fillStyle = PALETTE.o;
    for (let i = 0; i < piste.n; i += 2) {
      const p = piste.pts[i];
      if (Math.abs(p.k) > 1 / (piste.largeur * 0.55)) { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill(); }
    }
    // Le départ : un damier et une flèche
    const d0 = piste.pts[0];
    ctx.save(); ctx.translate(d0.x, d0.y); ctx.rotate(Math.atan2(d0.ty, d0.tx));
    ctx.fillStyle = PALETTE.w; ctx.fillRect(-1, -piste.largeur / 2, 3, piste.largeur);
    for (let k = 0; k < piste.largeur / 3; k++) if (k & 1) { ctx.fillStyle = PALETTE.n; ctx.fillRect(-1, -piste.largeur / 2 + k * 3, 3, 3); }
    ctx.fillStyle = PALETTE.y; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-2, -5); ctx.lineTo(-2, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Les points de contrôle
    def.points.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p[0], p[1], (i === choisi ? 6 : 4.5) / Math.max(0.6, cam.z), 0, 7);
      ctx.fillStyle = i === 0 ? PALETTE.y : i === choisi ? PALETTE.o : PALETTE.w; ctx.fill();
      ctx.strokeStyle = PALETTE.n; ctx.lineWidth = 1.2 / Math.max(0.6, cam.z); ctx.stroke();
    });
    ctx.restore();
  }

  return {
    dessiner,
    ouvrir(circuit) {
      def = structuredClone(circuit);
      if (!def.id || def.id === 'essai') def.id = undefined;
      choisi = -1; mode = 'deplacer'; modifie = false; geste = null; actif = true;
      racine.querySelector('input[name="ed-mode"][value="deplacer"]').checked = true;
      $('ed-nom').value = def.nom; $('ed-theme').value = def.theme;
      racine.hidden = false;
      recalculer(); cadrer();
    },
    fermer() { actif = false; racine.hidden = true; },
    get actif() { return actif; },
    get circuit() { return def; },
    get modifie() { return modifie; },
    marquerEnregistre() { modifie = false; },
  };
}
