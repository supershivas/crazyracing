// Le modèle 3D d'une voiture : une monoplace en formes simples (boîtes, cylindres,
// cônes), peinte aux couleurs de son équipe. Les géométries sont partagées ; seules
// les matières de livrée changent. Axes locaux : +x vers l'avant, +y en haut, +z à droite.
import * as THREE from 'three';
import { LIVREES } from './palette.js?v=0.4.0';

// ─── Géométries partagées (créées une fois) ────────────────────────────────
let G = null;
function geometries() {
  if (G) return G;
  const boite = (l, h, w) => new THREE.BoxGeometry(l, h, w);
  const roue = (r, l) => { const g = new THREE.CylinderGeometry(r, r, l, 14); g.rotateX(Math.PI / 2); return g; };
  const nez = new THREE.CylinderGeometry(0.55, 1.45, 5.2, 8); nez.rotateZ(-Math.PI / 2);
  const capot = new THREE.CylinderGeometry(1.1, 1.6, 4, 8); capot.rotateZ(-Math.PI / 2);
  const jante = new THREE.CylinderGeometry(0.62, 0.62, 1, 8); jante.rotateX(Math.PI / 2);
  G = {
    chassis: boite(8.4, 1.5, 3.1), nez, capot,
    pod: boite(4.2, 1.3, 1.25), aileronAv: boite(1, 0.28, 7.2), aileronAr: boite(1.6, 0.26, 6.2),
    derive: boite(1.5, 1.6, 0.18), pilier: boite(0.5, 2.2, 0.5), prise: boite(1.4, 1.3, 1.6),
    casque: new THREE.SphereGeometry(0.85, 10, 8), bulle: new THREE.SphereGeometry(1.15, 10, 8),
    roueAv: roue(1.2, 1.1), roueAr: roue(1.4, 1.5), jante, phare: boite(0.35, 0.3, 0.9), feu: boite(0.3, 0.35, 1.5),
    sol: boite(11.5, 0.2, 5.2), flamme: new THREE.ConeGeometry(0.9, 5, 8), bouclier: new THREE.SphereGeometry(9, 16, 12),
  };
  G.flamme.rotateZ(Math.PI / 2); G.flamme.translate(-2.5, 0, 0);
  return G;
}

const matieres = new Map();
function matieresDe(equipe) {
  const cle = equipe % LIVREES.length;
  if (matieres.has(cle)) return matieres.get(cle);
  const l = LIVREES[cle];
  const m = {
    corps: new THREE.MeshStandardMaterial({ color: l.x, metalness: 0.35, roughness: 0.32 }),
    accent: new THREE.MeshStandardMaterial({ color: l.z, metalness: 0.25, roughness: 0.4 }),
    carbone: new THREE.MeshStandardMaterial({ color: 0x15161c, metalness: 0.5, roughness: 0.55 }),
    pneu: new THREE.MeshStandardMaterial({ color: 0x0e0f14, metalness: 0, roughness: 0.92 }),
    jante: new THREE.MeshStandardMaterial({ color: 0xc8ccd6, metalness: 0.9, roughness: 0.3 }),
    verre: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, metalness: 0.8, roughness: 0.08, transparent: true, opacity: 0.55 }),
  };
  matieres.set(cle, m);
  return m;
}
const phareMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 0, roughness: 0.3 });
const feuMat = () => new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 0.6, roughness: 0.4 });
const flammeMat = new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const bouclierMat = new THREE.MeshBasicMaterial({ color: 0x73eff7, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const ombreMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

// L'étiquette au-dessus de la voiture : place et nom, repeints seulement quand ils changent
function creerEtiquette() {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 64;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(15, 5, 1); sprite.position.y = 11; sprite.renderOrder = 10;
  let cle = '';
  return {
    sprite,
    maj(pos, nom, moi) {
      const k = `${pos}|${nom}|${moi}`;
      if (k === cle) return;
      cle = k;
      const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = moi ? '#ef7d57' : 'rgba(26,28,44,.82)';
      g.beginPath(); g.roundRect(4, 8, 184, 48, 10); g.fill();
      g.fillStyle = '#f4f4f4'; g.font = 'bold 30px ui-monospace, monospace'; g.textBaseline = 'middle';
      g.fillText(String(pos), 16, 33);
      g.font = '24px ui-monospace, monospace';
      g.fillText(nom.slice(0, 9), 56, 34);
      tex.needsUpdate = true;
    },
  };
}

// → { groupe, maj(v, dt, ctx) } ; v : la voiture des règles
export function creerVoiture3D(v) {
  const g = geometries();
  const m = matieresDe(v.equipe);
  const groupe = new THREE.Group();
  const corps = new THREE.Group(); // la partie qui roule et tangue ; les roues sont à part
  groupe.add(corps);
  const ajoute = (geo, mat, x, y, z, parent = corps) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

  ajoute(g.chassis, m.corps, -0.5, 1.7, 0);
  ajoute(g.nez, m.corps, 5.2, 1.35, 0);
  ajoute(g.capot, m.accent, 0.6, 2.7, 0).scale.set(1, 0.72, 0.8);
  for (const s of [-1, 1]) { ajoute(g.pod, m.corps, -0.4, 1.35, s * 2.35); ajoute(g.derive, m.carbone, -3.9, 2.9, s * 3.0); }
  ajoute(g.prise, m.carbone, -1.9, 3.1, 0);
  ajoute(g.bulle, m.verre, 1.2, 2.95, 0).scale.set(1.15, 0.7, 0.75);
  ajoute(g.casque, m.accent, 0.9, 3.0, 0);
  ajoute(g.aileronAv, m.carbone, 7.4, 0.55, 0);
  for (const s of [-1, 1]) ajoute(g.derive, m.accent, 7.4, 0.9, s * 3.6).scale.set(0.9, 0.5, 1);
  ajoute(g.aileronAr, m.accent, -6.2, 3.7, 0);
  for (const s of [-1, 1]) ajoute(g.pilier, m.carbone, -6.0, 2.4, s * 1.1);
  const feuxAr = [-1, 1].map(s => ajoute(g.feu, feuMat(), -6.65, 3.2, s * 1.9));
  const phares = [-1, 1].map(s => ajoute(g.phare, phareMat.clone(), 7.0, 1.2, s * 1.3));
  const flamme = new THREE.Mesh(g.flamme, flammeMat); flamme.position.set(-6.8, 2, 0); flamme.visible = false; corps.add(flamme);
  const bouclier = new THREE.Mesh(g.bouclier, bouclierMat); bouclier.position.y = 3; bouclier.visible = false; corps.add(bouclier);

  const roues = [];
  const mkRoue = (x, z, av) => {
    const r = new THREE.Group(); r.position.set(x, av ? 1.2 : 1.4, z);
    const pneu = new THREE.Mesh(av ? g.roueAv : g.roueAr, m.pneu); pneu.castShadow = true; r.add(pneu);
    const j = new THREE.Mesh(g.jante, m.jante); j.scale.z = av ? 1.2 : 1.6; r.add(j);
    groupe.add(r);
    roues.push({ r, pneu, rayon: av ? 1.2 : 1.4, av, cote: Math.sign(z) });
    return r;
  };
  mkRoue(4.6, -3.4, true); mkRoue(4.6, 3.4, true); mkRoue(-4.4, -3.5, false); mkRoue(-4.4, 3.5, false);

  const ombre = new THREE.Mesh(g.sol, ombreMat); ombre.position.y = 0.06; ombre.renderOrder = 1; groupe.add(ombre);
  const etiquette = creerEtiquette();
  groupe.add(etiquette.sprite);

  let spin = 0, tangage = 0, vPrec = v.v, lumiere = 0;
  return {
    groupe, phares, etiquette,
    // ctx : { moi, dt, nuit (0..1), x, z : position monde }
    maj(v, dt, ctx) {
      groupe.position.set(v.x, 0, v.y);
      groupe.rotation.y = -v.cap;
      // La carrosserie tangue : roulis dans les virages, tangage au freinage et à l'accélération
      const acc = (v.v - vPrec) / Math.max(dt, 1e-3); vPrec = v.v;
      tangage += (borne(-acc / 900, -0.07, 0.07) - tangage) * Math.min(1, dt * 8);
      corps.rotation.x = (v.roulis ?? 0) * 0.07;
      corps.rotation.z = tangage;
      // Les roues tournent ; les avant braquent quand la voiture change de ligne
      const braque = borne((v.lat ?? 0) / Math.max(60, v.v) * 1.6, -0.45, 0.45);
      for (const w of roues) { w.pneu.rotation.z -= v.v * dt / w.rayon; w.r.rotation.y = w.av ? -braque : 0; }
      // Feux : arrière vifs au freinage, phares la nuit
      const frein = acc < -60 ? 1 : 0;
      for (const f of feuxAr) f.material.emissiveIntensity = 0.5 + frein * 2.6 + ctx.nuit * 0.6;
      lumiere += ((ctx.nuit > 0.15 ? 1 : 0) - lumiere) * Math.min(1, dt * 6);
      for (const p of phares) p.material.emissiveIntensity = lumiere * 3;
      flamme.visible = v.turbo > 0;
      if (flamme.visible) { flamme.scale.set(0.7 + Math.random() * 0.5, 0.8 + Math.random() * 0.3, 0.8 + Math.random() * 0.3); }
      bouclier.visible = v.bouclier > 0;
      if (bouclier.visible) bouclier.rotation.y += dt * 2;
      // Un tête-à-queue : le lacet est déjà dans v.cap ; on couche un peu la voiture
      if (spin !== (v.incident ? 1 : 0)) spin = v.incident ? 1 : 0;
      etiquette.sprite.visible = ctx.etiquettes;
      etiquette.maj(v.pos || 1, v.nom, ctx.moi);
    },
    liberer() { /* géométries et matières sont partagées : rien à libérer ici */ },
  };
}

const borne = (x, a, b) => Math.max(a, Math.min(b, x));
