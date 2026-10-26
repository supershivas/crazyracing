// Le monde 3D d'un circuit : sol, ruban d'asphalte, vibreurs, bordures de dégagement,
// voie des stands, portique de départ, tribunes, glissières, lampadaires et décor
// selon le thème. Tout est construit une fois à partir du tracé (js/piste.js) ; seules
// la trace sèche (texture mise à jour) et la brillance de l'asphalte changent ensuite.
import * as THREE from 'three';
import { hash2 } from './lib/rng.js?v=0.4.0';
import { PALETTE } from './palette.js?v=0.4.0';

const hex = k => new THREE.Color(PALETTE[k]);
const borne = (x, a, b) => Math.max(a, Math.min(b, x));

// ─── Textures dessinées à la main (aucun fichier image) ────────────────────
function toile(w, h, dessiner, { repeat = [1, 1], pixel = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); dessiner(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (pixel) { t.magFilter = THREE.NearestFilter; }
  return t;
}
const bruit = (g, w, h, n, couleurs, taille = 1) => {
  for (let i = 0; i < n; i++) { g.fillStyle = couleurs[Math.floor(hash2(i, 1, 5) * couleurs.length)]; g.fillRect(hash2(i, 2, 5) * w, hash2(i, 3, 5) * h, taille, taille); }
};
const textureAsphalte = () => toile(256, 256, (g, w, h) => {
  g.fillStyle = '#2b2f3b'; g.fillRect(0, 0, w, h);
  bruit(g, w, h, 5000, ['#363b49', '#22252f', '#3a4050', '#2f3340'], 2);
  g.strokeStyle = 'rgba(15,16,22,.5)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(hash2(i, 9, 4) * w, 0); g.bezierCurveTo(hash2(i, 8, 4) * w, h * .3, hash2(i, 7, 4) * w, h * .6, hash2(i, 6, 4) * w, h); g.stroke(); }
});
const texturesSol = {
  prairie: () => toile(256, 256, (g, w, h) => { g.fillStyle = '#3e8f48'; g.fillRect(0, 0, w, h); bruit(g, w, h, 9000, ['#4aa055', '#337d3d', '#58b062', '#2f7238'], 2); }),
  dunes: () => toile(256, 256, (g, w, h) => { g.fillStyle = '#d9b36c'; g.fillRect(0, 0, w, h); bruit(g, w, h, 9000, ['#e6c47f', '#c9a25c', '#efd093', '#bf9650'], 2); for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(160,110,50,.18)'; g.beginPath(); g.moveTo(0, i * 20); g.bezierCurveTo(80, i * 20 + 10, 170, i * 20 - 10, 256, i * 20); g.stroke(); } }),
  port: () => toile(256, 256, (g, w, h) => { g.fillStyle = '#7d8793'; g.fillRect(0, 0, w, h); bruit(g, w, h, 7000, ['#8a94a0', '#6f7984', '#949eaa'], 2); g.strokeStyle = 'rgba(40,46,56,.35)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }),
};
const textureGravier = () => toile(128, 128, (g, w, h) => { g.fillStyle = '#9a8f78'; g.fillRect(0, 0, w, h); bruit(g, w, h, 3000, ['#b3a88f', '#857b66', '#a39880', '#6f664f'], 2); });
const textureVibreur = () => toile(32, 64, (g, w, h) => { g.fillStyle = '#d33a3a'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#f4f4f4'; g.fillRect(0, h / 2, w, h / 2); });
const textureTirets = () => toile(16, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e8e8e8'; g.fillRect(2, 0, 12, h * 0.45); });
const textureDamier = () => toile(64, 16, (g, w, h) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) & 1 ? '#111' : '#f4f4f4'; g.fillRect(x * 8, y * 8, 8, 8); } }, { pixel: true });
const textureFacade = (allume = '#ffd98a') => toile(128, 128, (g, w, h) => {
  g.fillStyle = '#8f98a6'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { g.fillStyle = hash2(x, y, 3) > 0.45 ? allume : '#39414f'; g.fillRect(6 + x * 20, 6 + y * 15, 12, 8); }
});
const textureConteneur = (couleur) => toile(64, 32, (g, w, h) => { g.fillStyle = couleur; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.22)'; for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1.5, h); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 0, w, 2); });
const textureTribune = () => toile(128, 64, (g, w, h) => {
  g.fillStyle = '#4a5160'; g.fillRect(0, 0, w, h);
  const c = ['#e0573e', '#f4f4f4', '#41a6f6', '#ffcd75', '#a7f070', '#b13e53'];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 32; x++) { g.fillStyle = c[Math.floor(hash2(x, y, 9) * c.length)]; g.fillRect(x * 4 + 1, y * 8 + 3, 3, 4); }
});
const textureBandeau = (texte) => toile(512, 64, (g, w, h) => {
  g.fillStyle = '#14151c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4f4f4'; g.font = 'bold 40px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texte, w / 2, h / 2 + 2);
  g.fillStyle = '#ef7d57'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
});

// ─── Rubans le long du circuit ─────────────────────────────────────────────
// d0 → d1 : écarts latéraux ; s0 → s1 : une portion (sinon tout le tour) ; tuile : longueur d'une répétition de la texture
function ruban(piste, d0, d1, y, tuile, { s0 = null, s1 = null } = {}) {
  const { pts, n, pas, longueur: L } = piste;
  const entier = s0 == null;
  const idx = [];
  if (entier) for (let i = 0; i <= n; i++) idx.push(i);
  else for (let s = s0; s <= s1 + 1e-6; s += pas) idx.push(Math.round(s / pas));
  const tu = entier ? L / Math.max(1, Math.round(L / tuile)) : tuile;
  const pos = [], uv = [], ind = [];
  idx.forEach((k, j) => {
    const p = pts[((k % n) + n) % n];
    for (const [d, u] of [[d0, 0], [d1, 1]]) pos.push(p.x + p.nx * d, y, p.y + p.ny * d), uv.push(u, (entier ? k * pas : j * pas) / tu);
  });
  for (let j = 0; j < idx.length - 1; j++) { const a = j * 2; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  g.computeVertexNormals();
  return g;
}

// ─── Instances : beaucoup d'objets identiques en un seul appel de dessin ───
function instances(geo, mat, positions, { echelle = () => 1, cap = () => 0, ombre = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, positions.length));
  const o = new THREE.Object3D();
  positions.forEach((p, i) => {
    o.position.set(p.x, p.y ?? 0, p.z); o.rotation.set(0, cap(p, i), 0);
    const s = echelle(p, i); o.scale.set(...(Array.isArray(s) ? s : [s, s, s])); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
  });
  m.count = positions.length; m.castShadow = ombre; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true;
  return m;
}
const fusion = (parts) => { // fusionne des géométries (positions + normales + couleurs de sommets)
  let nb = 0; for (const g of parts) nb += g.attributes.position.count;
  const pos = new Float32Array(nb * 3), nor = new Float32Array(nb * 3), col = new Float32Array(nb * 3), idx = [];
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    if (g.index) for (const i of g.index.array) idx.push(i + o); else for (let i = 0; i < n; i++) idx.push(i + o);
    o += n;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); r.setAttribute('color', new THREE.BufferAttribute(col, 3)); r.setIndex(idx);
  return r;
};
const teinte = (geo, couleur) => { const n = geo.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(couleur); for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
const vertex = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });

function modeles() {
  const arbre = fusion([
    teinte(new THREE.CylinderGeometry(0.7, 1.0, 5, 6).translate(0, 2.5, 0), 0x5b3b24),
    teinte(new THREE.ConeGeometry(5.2, 8, 7).translate(0, 8.5, 0), 0x2f7d3b),
    teinte(new THREE.ConeGeometry(4, 7, 7).translate(0, 12, 0), 0x3a9148),
    teinte(new THREE.ConeGeometry(2.6, 5, 7).translate(0, 15.2, 0), 0x47a656),
  ]);
  const buisson = fusion([teinte(new THREE.IcosahedronGeometry(2.6, 0).translate(0, 1.8, 0), 0x2f7d3b), teinte(new THREE.IcosahedronGeometry(1.8, 0).translate(2, 1.2, 1), 0x3a9148)]);
  const roche = (() => { const g = new THREE.DodecahedronGeometry(3, 0); g.scale(1.3, 0.8, 1); g.translate(0, 1.4, 0); return fusion([teinte(g, 0x8a8f98)]); })();
  const rocheDunes = (() => { const g = new THREE.DodecahedronGeometry(3.2, 0); g.scale(1.2, 0.9, 1); g.translate(0, 1.6, 0); return fusion([teinte(g, 0xa9784a)]); })();
  const cactus = fusion([
    teinte(new THREE.CylinderGeometry(1.1, 1.3, 9, 8).translate(0, 4.5, 0), 0x3f8f4a),
    teinte(new THREE.CylinderGeometry(0.7, 0.7, 3.5, 6).rotateZ(Math.PI / 2).translate(2.2, 5, 0), 0x3f8f4a),
    teinte(new THREE.CylinderGeometry(0.7, 0.7, 3, 6).translate(3.8, 6.4, 0), 0x3f8f4a),
    teinte(new THREE.CylinderGeometry(0.7, 0.7, 3.5, 6).rotateZ(Math.PI / 2).translate(-2.2, 3.5, 0), 0x3f8f4a),
    teinte(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 6).translate(-3.8, 4.7, 0), 0x3f8f4a),
  ]);
  const dune = fusion([teinte(new THREE.SphereGeometry(18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.45, 1), 0xe0bd78)]);
  const mat = fusion([
    teinte(new THREE.CylinderGeometry(0.5, 0.7, 26, 6).translate(0, 13, 0), 0x6c7480),
    teinte(new THREE.BoxGeometry(5, 0.8, 1.6).translate(2, 26, 0), 0x6c7480),
  ]);
  const tour = fusion([ // grue de port
    teinte(new THREE.BoxGeometry(2, 34, 2).translate(0, 17, 0), 0xe0573e),
    teinte(new THREE.BoxGeometry(34, 2.4, 2.4).translate(8, 33, 0), 0xe0573e),
    teinte(new THREE.BoxGeometry(2, 14, 2).translate(24, 26, 0), 0x333c57),
  ]);
  return { arbre, buisson, roche, rocheDunes, cactus, dune, mat, tour };
}

// ─── Le monde ──────────────────────────────────────────────────────────────
// piste : construirePiste ; def : le circuit ; R : réglages ; q : { instances: 0..1, ombres: bool }
export function creerMonde(piste, def, R, q = { instances: 1 }) {
  const groupe = new THREE.Group();
  const { pts, n, largeur, longueur: L } = piste;
  const demi = largeur / 2;
  const b = piste.boite;
  const theme = def.theme in texturesSol ? def.theme : 'prairie';
  const w = b.x1 - b.x0, h = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const recoit = m => { m.receiveShadow = true; return m; };

  // Le sol
  const taille = Math.max(w, h) + 1400;
  const solTex = texturesSol[theme](); solTex.repeat.set(taille / 60, taille / 60);
  const sol = recoit(new THREE.Mesh(new THREE.PlaneGeometry(taille, taille), new THREE.MeshStandardMaterial({ map: solTex, roughness: 0.95 })));
  sol.rotation.x = -Math.PI / 2; sol.position.set(cx, -0.08, cy); groupe.add(sol);

  // Le dégagement : gravier de chaque côté (là où finissent les têtes-à-queue)
  const gravTex = textureGravier();
  const gravMat = new THREE.MeshStandardMaterial({ map: gravTex, roughness: 1 });
  for (const [a, c] of [[-demi - 10, -demi - 3.2], [demi + 3.2, demi + 10]]) groupe.add(recoit(new THREE.Mesh(ruban(piste, a, c, 0.0, 12), gravMat)));
  gravTex.repeat.set(1.5, 1);
  // Les vibreurs
  const vibTex = textureVibreur(); vibTex.repeat.set(1, 1);
  const vibMat = new THREE.MeshStandardMaterial({ map: vibTex, roughness: 0.6 });
  for (const [a, c] of [[-demi - 3.2, -demi], [demi, demi + 3.2]]) groupe.add(recoit(new THREE.Mesh(ruban(piste, a, c, 0.06, 10), vibMat)));

  // L'asphalte (brillance réglée par la pluie) et la trace sèche par-dessus
  const asphTex = textureAsphalte(); asphTex.repeat.set(largeur / 48, 1);
  const asph = new THREE.MeshStandardMaterial({ map: asphTex, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.6 });
  const piste3d = recoit(new THREE.Mesh(ruban(piste, -demi, demi, 0.1, 48), asph));
  groupe.add(piste3d);
  const donneesTrace = new Uint8Array(3 * n * 4);
  const texTrace = new THREE.DataTexture(donneesTrace, 3, n, THREE.RGBAFormat); texTrace.magFilter = THREE.LinearFilter; texTrace.minFilter = THREE.LinearFilter; texTrace.needsUpdate = true;
  const seche = new THREE.MeshStandardMaterial({ color: 0x2f333f, roughness: 0.95, metalness: 0, alphaMap: null, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  seche.map = texTrace; // la couleur reste unie ; l'alpha vient de la texture de trace
  groupe.add(recoit(Object.assign(new THREE.Mesh(ruban(piste, -demi, demi, 0.14, L), seche), { renderOrder: 2 })));
  // Les lignes : bords pleins et pointillés entre les lignes
  const trait = (d, large, tex, y = 0.18) => {
    const m = new THREE.MeshBasicMaterial({ color: 0xe8e8e8, map: tex ?? null, transparent: !!tex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const o = new THREE.Mesh(ruban(piste, d - large / 2, d + large / 2, y, 14), m); o.renderOrder = 3; groupe.add(o);
  };
  trait(-demi + 1.0, 0.7); trait(demi - 1.0, 0.7);
  const tirets = textureTirets(); tirets.repeat.set(1, 1);
  for (const d of [-5, 5]) trait(d, 0.55, tirets);

  // La ligne de départ (damier) et le portique
  const dam = textureDamier(); dam.repeat.set(largeur / 8, 1);
  const ligneDep = new THREE.Mesh(ruban(piste, -demi, demi, 0.2, 4, { s0: 0, s1: 4 }), new THREE.MeshBasicMaterial({ map: dam, polygonOffset: true, polygonOffsetFactor: -4 }));
  ligneDep.renderOrder = 4; groupe.add(ligneDep);
  const p0 = pts[0];
  const portique = new THREE.Group();
  const pilierGeo = new THREE.BoxGeometry(1.6, 17, 1.6), carbone = new THREE.MeshStandardMaterial({ color: 0x20232d, roughness: 0.5, metalness: 0.5 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(pilierGeo, carbone); p.position.set(0, 8.5, s * (demi + 8)); p.castShadow = true; portique.add(p); }
  const poutre = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, largeur + 18), carbone); poutre.position.y = 17.5; poutre.castShadow = true; portique.add(poutre);
  const bandeau = new THREE.Mesh(new THREE.PlaneGeometry(largeur * 0.8, 3), new THREE.MeshStandardMaterial({ map: textureBandeau('CRAZY RACING'), emissive: 0xffffff, emissiveMap: textureBandeau('CRAZY RACING'), emissiveIntensity: 0.8 }));
  bandeau.position.set(1.55, 17.5, 0); bandeau.rotation.y = Math.PI / 2; portique.add(bandeau);
  const bandeau2 = bandeau.clone(); bandeau2.position.x = -1.55; bandeau2.rotation.y = -Math.PI / 2; portique.add(bandeau2);
  portique.position.set(p0.x, 0, p0.y); portique.rotation.y = -Math.atan2(p0.ty, p0.tx);
  groupe.add(portique);

  // La voie des stands, le box, le garage
  const sDeb = L - R.stand.avant, sFin = L + R.stand.apres;
  const voieMat = new THREE.MeshStandardMaterial({ color: 0x566c86, roughness: 0.8 });
  const voie = recoit(new THREE.Mesh(ruban(piste, demi + 3.2, demi + R.stand.largeur, 0.12, 20, { s0: sDeb, s1: sFin }), voieMat));
  groupe.add(voie);
  const marque = new THREE.Mesh(ruban(piste, demi + 5, demi + R.stand.largeur - 2, 0.2, 20, { s0: 22 + 0, s1: 22 + 12 }), new THREE.MeshBasicMaterial({ color: 0xffcd75, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -4 }));
  marque.renderOrder = 4; groupe.add(marque);
  const garage = new THREE.Group();
  const murMat = new THREE.MeshStandardMaterial({ map: textureFacade('#ffe3a0'), roughness: 0.7, emissive: 0xffffff, emissiveMap: textureFacade('#ffd98a'), emissiveIntensity: 0.0 });
  const bat = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 12), murMat); bat.position.y = 5; bat.castShadow = true; garage.add(bat);
  const toit = new THREE.Mesh(new THREE.BoxGeometry(74, 1.2, 15), new THREE.MeshStandardMaterial({ color: 0x333c57, roughness: 0.6 })); toit.position.y = 10.6; toit.castShadow = true; garage.add(toit);
  const pg = pointA3(piste, 22, demi + R.stand.largeur + 10);
  garage.position.set(pg.x, 0, pg.z); garage.rotation.y = -pg.cap; groupe.add(garage);

  // Les glissières : blocs alternés de chaque côté, sauf devant les stands
  const barrGeo = new THREE.BoxGeometry(8, 2.4, 1.1);
  const barrMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const barrPos = [];
  for (const cote of [-1, 1]) {
    for (let s = 0; s < L; s += 8.4) {
      const sp = s > L / 2 ? s - L : s;
      if (cote > 0 && sp >= -R.stand.avant - 6 && sp <= R.stand.apres + 6) continue;
      const p = pointA3(piste, s, cote * (demi + 11.6));
      barrPos.push({ x: p.x, y: 1.2, z: p.z, cap: -p.cap, c: Math.floor(s / 8.4) & 1 });
    }
  }
  const barr = instances(barrGeo, barrMat, barrPos, { cap: p => p.cap });
  const col = new THREE.Color();
  barrPos.forEach((p, i) => { barr.setColorAt(i, col.set(p.c ? (def.theme === 'dunes' ? 0xe0673f : 0xc43232) : 0xd8dce4)); });
  barr.instanceColor.needsUpdate = true;
  groupe.add(barr);

  // Les tribunes, du côté opposé aux stands, devant la ligne droite de départ
  const tribTex = textureTribune(); tribTex.repeat.set(4, 1);
  const tribMat = new THREE.MeshStandardMaterial({ map: tribTex, roughness: 0.85 });
  const tribune = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const marche = new THREE.Mesh(new THREE.BoxGeometry(90, 3 + k * 3, 4), k === 3 ? tribMat : tribMat);
    marche.position.set(0, (3 + k * 3) / 2, k * 4); marche.castShadow = true; marche.receiveShadow = true; tribune.add(marche);
  }
  const auvent = new THREE.Mesh(new THREE.BoxGeometry(92, 0.8, 22), new THREE.MeshStandardMaterial({ color: 0xe8e8ee, roughness: 0.5 })); auvent.position.set(0, 20, 8); auvent.castShadow = true; tribune.add(auvent);
  for (const x of [-44, 44]) { const poteau = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 1), carbone); poteau.position.set(x, 10, 16); tribune.add(poteau); }
  const pt = pointA3(piste, 20, -(demi + 22));
  tribune.position.set(pt.x, 0, pt.z); tribune.rotation.y = -pt.cap; // face au circuit : on retourne
  tribune.rotation.y += Math.PI; groupe.add(tribune);

  // Les lampadaires : un tous les 110 px, du côté extérieur des virages ; leurs têtes brillent la nuit
  const lampes = [];
  for (let s = 40; s < L; s += 110) {
    const sp = s > L / 2 ? s - L : s;
    const p = pointA3(piste, s, (Math.floor(s / 110) & 1 ? 1 : -1) * (demi + 16));
    if (p.d > 0 && sp >= -R.stand.avant - 10 && sp <= R.stand.apres + 10) continue;
    lampes.push(p);
  }
  const mm = modeles();
  // Le bras du mât regarde la piste : sa direction locale +x est tournée vers le centre
  const capMat = p => { const sg = Math.sign(p.d); return Math.atan2(sg * Math.cos(p.cap), sg * Math.sin(p.cap)); };
  groupe.add(instances(mm.mat, vertex, lampes.map(p => ({ x: p.x, z: p.z, c: capMat(p) })), { cap: p => p.c }));
  const teteMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9b0, emissiveIntensity: 0.0, roughness: 0.4 });
  const tetes = instances(new THREE.BoxGeometry(3.4, 0.8, 1.6), teteMat, lampes.map(p => {
    const c = capMat(p);
    return { x: p.x + Math.cos(c) * 3.6, y: 25.6, z: p.z - Math.sin(c) * 3.6, c };
  }), { cap: p => p.c, ombre: false });
  groupe.add(tetes);

  // Le décor : posé hors du circuit, selon le thème, toujours aux mêmes endroits
  const grille = new Map();
  const CELL = 40;
  pts.forEach(p => { const k = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`; (grille.get(k) ?? grille.set(k, []).get(k)).push(p); });
  const loin = (x, y, r) => {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), rr = Math.ceil(r / CELL);
    for (let a = -rr; a <= rr; a++) for (let c = -rr; c <= rr; c++) for (const p of grille.get(`${gx + a},${gy + c}`) ?? []) if (Math.hypot(p.x - x, p.y - y) < r) return false;
    return true;
  };
  const choix = { prairie: [['arbre', 3], ['buisson', 2], ['roche', 1]], dunes: [['cactus', 3], ['rocheDunes', 2], ['dune', 0.35]], port: [['conteneur', 3], ['roche', 0.5], ['tour', 0.15]] }[theme];
  const total = choix.reduce((a, c) => a + c[1], 0);
  const cible = Math.floor((w * h) / 1700 * (q.instances ?? 1));
  const poses = { arbre: [], buisson: [], roche: [], rocheDunes: [], cactus: [], dune: [], conteneur: [], tour: [] };
  for (let k = 0; k < cible * 3 && Object.values(poses).reduce((a, l) => a + l.length, 0) < cible; k++) {
    const x = b.x0 - 260 + hash2(k, 1, 31) * (w + 520), y = b.y0 - 260 + hash2(k, 2, 31) * (h + 520);
    let r = hash2(k, 3, 31) * total, nom = choix[0][0];
    for (const [nm, poids] of choix) { r -= poids; if (r < 0) { nom = nm; break; } }
    const marge = nom === 'dune' ? 55 : nom === 'tour' ? 45 : nom === 'conteneur' ? 40 : 32;
    if (!loin(x, y, demi + 14 + marge)) continue;
    poses[nom].push({ x, z: y, rot: hash2(k, 4, 31) * Math.PI * 2, s: 0.8 + hash2(k, 5, 31) * 0.7 });
  }
  const ajouterModele = (nom, geo, mat) => { if (!poses[nom]?.length) return; groupe.add(instances(geo, mat, poses[nom], { cap: p => p.rot, echelle: p => p.s })); };
  for (const nom of ['arbre', 'buisson', 'roche', 'rocheDunes', 'cactus', 'dune', 'tour']) ajouterModele(nom, mm[nom], vertex);
  if (poses.conteneur.length) { // des piles de conteneurs : trois couleurs, deux ou trois étages
    const couleurs = ['#d4533b', '#2f6fb8', '#e0a93a', '#3b8f6b'];
    const geo = new THREE.BoxGeometry(14, 3.2, 3.4);
    couleurs.forEach((cc, ci) => {
      const lst = []; poses.conteneur.forEach((p, i) => { if (i % couleurs.length === ci) for (let e = 0; e < 1 + Math.floor(hash2(i, 7, 8) * 3); e++) lst.push({ x: p.x, y: 1.6 + e * 3.25, z: p.z, rot: p.rot }); });
      if (lst.length) groupe.add(instances(geo, new THREE.MeshStandardMaterial({ map: textureConteneur(cc), roughness: 0.6, metalness: 0.2 }), lst, { cap: p => p.rot }));
    });
  }
  // Les montagnes au loin : cônes écrasés, dans la brume
  const montMat = new THREE.MeshStandardMaterial({ color: theme === 'dunes' ? 0xb98757 : theme === 'port' ? 0x6c7a8c : 0x56796a, roughness: 1, flatShading: true });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + hash2(k, 1, 77) * 0.3, r = taille * 0.42 + hash2(k, 2, 77) * 120;
    const mt = new THREE.Mesh(new THREE.ConeGeometry(90 + hash2(k, 3, 77) * 120, 120 + hash2(k, 4, 77) * 160, 6), montMat);
    mt.position.set(cx + Math.cos(a) * r, 40, cy + Math.sin(a) * r); mt.rotation.y = hash2(k, 5, 77) * 3; groupe.add(mt);
  }

  const lampadaires = lampes.map(p => { const c = capMat(p); return new THREE.Vector3(p.x + Math.cos(c) * 3.6, 25, p.z - Math.sin(c) * 3.6); });
  return {
    groupe, lampadaires, asphalte: asph, teteLampes: teteMat, fenetres: murMat, boite: b,
    // La trace sèche : 3 colonnes (les trois lignes) × n lignes ; l'alpha dit « sec »
    majTrace(c) {
      const k = borne(c.eau * 1.3, 0, 1);
      for (let i = 0; i < n; i++) for (let l = 0; l < 3; l++) {
        const o = (i * 3 + l) * 4;
        donneesTrace[o] = 255; donneesTrace[o + 1] = 255; donneesTrace[o + 2] = 255;
        donneesTrace[o + 3] = Math.round(borne(c.trace[i * 3 + l] * 0.9, 0, 1) * k * 255);
      }
      texTrace.needsUpdate = true;
    },
    liberer() { groupe.traverse(o => { o.geometry?.dispose?.(); }); },
  };
}

// Un point du circuit en coordonnées 3D (x, z) avec son cap et son écart latéral
function pointA3(piste, s, d) {
  const L = piste.longueur;
  const u = (((s % L) + L) % L) / piste.pas;
  const i = Math.floor(u) % piste.n, f = u - Math.floor(u);
  const a = piste.pts[i], b = piste.pts[(i + 1) % piste.n];
  const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
  let tx = a.tx + (b.tx - a.tx) * f, ty = a.ty + (b.ty - a.ty) * f;
  const t = Math.hypot(tx, ty) || 1; tx /= t; ty /= t;
  return { x: x - ty * d, z: y + tx * d, cap: Math.atan2(ty, tx), d };
}
export { pointA3 };
