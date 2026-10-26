// Le rendu 3D : three.js, lumière dynamique, caméra de dessus inclinée qui suit la voiture
// du joueur. Il lit la course (jamais il ne la modifie) et dessine ce qu'il faut pour la
// piloter à la tête : les trois lignes devant la voiture, l'aspiration, les dangers, les bonus.
// Les rubans, bâtiments et décors sont dans monde3d.js ; la lumière dans lumieres.js.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { creerMonde, pointA3 } from './monde3d.js?v=0.4.0';
import { creerVoiture3D } from './voiture3d.js?v=0.4.0';
import { creerLumieres } from './lumieres.js?v=0.4.0';

export const QUALITES = {
  haute: { ratio: 2, ombres: 2048, bloom: true, msaa: 4, instances: 1, lampes: 6, phares: 6, pluie: 2200, particules: 420 },
  moyenne: { ratio: 1.5, ombres: 1024, bloom: true, msaa: 2, instances: 0.7, lampes: 4, phares: 4, pluie: 1400, particules: 260 },
  basse: { ratio: 1, ombres: 0, bloom: false, msaa: 0, instances: 0.3, lampes: 2, phares: 2, pluie: 600, particules: 120 },
};

const borne = (x, a, b) => Math.max(a, Math.min(b, x));
const ecartAngle = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const COULEURS_BONUS = { turbo: 0xffa640, bouclier: 0x73eff7, sillage: 0xa7f070, reparation: 0xf4f4f4 };

function textureRond() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export function creerRendu3D(canvas, { qualite = 'haute', heure = 'jour' } = {}) {
  const q = QUALITES[qualite] ?? QUALITES.haute;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.bloom, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = q.ombres > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 2, 7000);
  const lum = creerLumieres(scene, renderer, q, heure);

  // Les reflets de l'asphalte mouillé : l'environnement d'une pièce claire, très atténué
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  let composer = null, bloom = null;
  if (q.bloom) {
    const cible = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: q.msaa });
    composer = new EffectComposer(renderer, cible);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let largeur = 1, hauteur = 1;
  function redimensionner(w, h, dpr = window.devicePixelRatio || 1) {
    largeur = Math.max(2, w); hauteur = Math.max(2, h);
    const ratio = Math.min(dpr, q.ratio);
    renderer.setPixelRatio(ratio); renderer.setSize(largeur, hauteur, false);
    composer?.setPixelRatio(ratio); composer?.setSize(largeur, hauteur);
    camera.aspect = largeur / hauteur; camera.fov = camera.aspect < 1 ? 62 : 48; camera.updateProjectionMatrix();
  }

  // ─── La course chargée ───
  let monde = null, c = null, voitures3D = new Map(), piste = null;
  const objetsCourse = new THREE.Group(); scene.add(objetsCourse);
  const guides = { mesh: null, n: 14 };
  const sillages = [], dangers = [], bonus = [];
  const rond = textureRond();
  // Les particules : fumée de pneus, embruns, étincelles (cosmétique, jamais dans les règles)
  const nP = q.particules;
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3), pVie = new Float32Array(nP), pVit = new Float32Array(nP * 3), pTaille = new Float32Array(nP);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 7, map: rond, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
  let pIdx = 0;
  const emettre = (x, y, z, vx, vy, vz, vie, r = 1, g = 1, b = 1) => {
    const i = pIdx++ % nP;
    pPos.set([x, y, z], i * 3); pVit.set([vx, vy, vz], i * 3); pCol.set([r, g, b], i * 3); pVie[i] = vie;
  };

  function vider() {
    for (const v of voitures3D.values()) objetsCourse.remove(v.groupe);
    voitures3D.clear();
    if (monde) { scene.remove(monde.groupe); monde.liberer(); monde = null; }
    for (const l of [sillages, dangers, bonus]) { for (const o of l) objetsCourse.remove(o); l.length = 0; }
    if (guides.mesh) { objetsCourse.remove(guides.mesh); guides.mesh = null; }
  }

  function charger(course, def, R) {
    vider();
    c = course; piste = course.piste;
    monde = creerMonde(piste, def, R, q);
    scene.add(monde.groupe);
    for (const v of c.voitures) { const o = creerVoiture3D(v); voitures3D.set(v.id, o); objetsCourse.add(o.groupe); }
    // Les trois lignes devant la voiture du joueur : des tirets lumineux
    const geo = new THREE.BoxGeometry(5, 0.12, 0.5);
    guides.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }), guides.n * 3);
    guides.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); guides.mesh.frustumCulled = false; guides.mesh.renderOrder = 5;
    guides.mesh.setColorAt(0, new THREE.Color(1, 1, 1)); objetsCourse.add(guides.mesh);
    // Les traînées d'aspiration entre deux voitures
    const texVent = (() => { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 64; const g = cv.getContext('2d'); g.clearRect(0, 0, 16, 64); for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(190,235,255,${0.25 + 0.2 * (i % 2)})`; g.fillRect(2 + i * 3, 0, 1.4, 64); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texVent.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.material.map.needsUpdate = true; m.visible = false; m.renderOrder = 6; objetsCourse.add(m); sillages.push(m);
    }
    for (let i = 0; i < 3; i++) { // les débris : trois cônes de chantier et une flaque
      const g = new THREE.Group();
      const orange = new THREE.MeshStandardMaterial({ color: 0xff6a1f, emissive: 0xff4a00, emissiveIntensity: 0.9, roughness: 0.5 });
      for (const [x, z] of [[-1.8, -1.2], [1.6, -1.6], [0.2, 1.8]]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 2.8, 8), orange); cone.position.set(x, 1.4, z); cone.castShadow = true; g.add(cone); }
      const flaque = new THREE.Mesh(new THREE.CircleGeometry(4.2, 16), new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.85 }));
      flaque.rotation.x = -Math.PI / 2; flaque.position.y = 0.25; g.add(flaque);
      g.visible = false; objetsCourse.add(g); dangers.push(g);
    }
    c.bonus.forEach(b => {
      const g = new THREE.Group();
      const col = COULEURS_BONUS[b.type] ?? 0xffffff;
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.2 });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.3), mat); gem.position.y = 4.5; gem.castShadow = true; g.add(gem);
      const anneau = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.35, 8, 24), mat); anneau.rotation.x = Math.PI / 2; anneau.position.y = 0.6; g.add(anneau);
      g.userData = { gem, anneau, b };
      const p = pointA3(piste, b.s, b.d); g.position.set(p.x, 0, p.z);
      objetsCourse.add(g); bonus.push(g);
    });
    heureCourante = lum.heure;
    redimensionner(largeur, hauteur);
    camVue.init = false;
    monde.majTrace(c);
  }

  // ─── La caméra : de dessus, inclinée, qui suit la voiture et regarde un peu devant ───
  const camVue = { init: false, x: 0, z: 0, yaw: 0, hauteur: 80, recul: 70 };
  function suivreCamera(v, dt, mode) {
    // Le cap visé : celui du circuit un peu plus loin, pour que la caméra tourne avant le virage
    const devant = pointA3(piste, v.s + 38 + v.v * 0.25, 0);
    const ici = pointA3(piste, v.s, 0);
    let yaw = Math.atan2(devant.z - ici.z, devant.x - ici.x);
    const k = camVue.init ? 1 - Math.exp(-dt * 4.5) : 1;
    camVue.yaw = camVue.init ? camVue.yaw + ecartAngle(yaw, camVue.yaw) * k : yaw;
    const kp = camVue.init ? 1 - Math.exp(-dt * 9) : 1;
    camVue.x += ((v.x) - camVue.x) * kp; camVue.z += ((v.y) - camVue.z) * kp;
    if (!camVue.init) { camVue.x = v.x; camVue.z = v.y; }
    camVue.init = true;
    const vit = borne(v.v / 200, 0, 1.3);
    const haut = (mode === 'haut' ? 150 : 78) + vit * 16, recul = (mode === 'haut' ? 28 : 74) + vit * 24;
    const dx = Math.cos(camVue.yaw), dz = Math.sin(camVue.yaw);
    camera.position.set(camVue.x - dx * recul, haut, camVue.z - dz * recul);
    camera.lookAt(camVue.x + dx * (mode === 'haut' ? 18 : 30), 0, camVue.z + dz * (mode === 'haut' ? 18 : 30));
  }

  let heureCourante = heure;
  let tTrace = 0;
  const tmpM = new THREE.Object3D();
  const couleurTmp = new THREE.Color();

  // moi : l'id de la voiture suivie ; options : { vue: 'incline' | 'haut', fantome, etiquettes }
  function dessiner(dt, moi, options = {}) {
    if (!c || !monde) return;
    dt = Math.max(0, Math.min(0.2, dt || 0));
    const v0 = c.voitures.find(v => v.id === moi) ?? c.voitures[0];
    suivreCamera(v0, dt, options.vue);
    const nuit = lum.nuit;
    const focus = { x: v0.x, z: v0.y };
    const positions = c.voitures.map(v => ({ x: v.x, z: v.y, cap: v.cap, turbo: v.turbo }));
    lum.maj(c, dt, camera, focus, positions, monde.lampadaires);

    // Brillance de l'asphalte : sec mat, mouillé en miroir ; les fenêtres et lampes s'allument la nuit
    const eau = c.eau;
    monde.asphalte.roughness = 0.9 - 0.78 * Math.pow(eau, 0.7); monde.asphalte.metalness = 0.05 + 0.2 * eau; monde.asphalte.envMapIntensity = 0.6 + 2 * eau;
    scene.environmentIntensity = (0.25 + 0.5 * eau) * (1 - 0.7 * nuit);
    monde.teteLampes.emissiveIntensity = nuit * 5;
    monde.fenetres.emissiveIntensity = nuit * 1.1;
    if ((tTrace += dt) > 0.5) { tTrace = 0; monde.majTrace(c); }
    if (bloom) { bloom.strength = lum.bloom * (1 + 0.5 * eau); bloom.radius = 0.55; bloom.threshold = 0.95 - 0.1 * nuit; }

    // Les voitures
    for (const v of c.voitures) {
      const o = voitures3D.get(v.id);
      o.maj(v, dt, { moi: v.id === moi, nuit, etiquettes: options.etiquettes !== false });
      // Fumée dans les virages à la limite, au tête-à-queue ; embruns sous la pluie
      const dx = Math.cos(-v.cap), dz = Math.sin(-v.cap);
      const glisse = Math.abs(v.roulis) > 0.93 && v.v > 60;
      if (glisse || v.incident) for (let k = 0; k < 2; k++) emettre(v.x - dx * 6 + (Math.random() - 0.5) * 3, 1, v.y - dz * 6 + (Math.random() - 0.5) * 3, -dx * 6 + (Math.random() - 0.5) * 5, 3 + Math.random() * 4, -dz * 6 + (Math.random() - 0.5) * 5, 0.9, 0.92, 0.92, 0.95);
      if (eau > 0.3 && v.v > 70 && Math.random() < 0.7) emettre(v.x - dx * 7 + (Math.random() - 0.5) * 4, 1.2, v.y - dz * 7 + (Math.random() - 0.5) * 4, -dx * 4, 6 + Math.random() * 5, -dz * 4, 0.55, 0.8, 0.86, 0.95);
      if (v.turbo > 0 && Math.random() < 0.8) emettre(v.x - dx * 8, 2, v.y - dz * 8, -dx * 25, 1, -dz * 25, 0.3, 1, 0.65, 0.2);
      if (v.incident && Math.random() < 0.5) emettre(v.x, 1, v.y, (Math.random() - 0.5) * 18, 6, (Math.random() - 0.5) * 18, 0.6, 0.85, 0.75, 0.55);
    }
    for (let i = 0; i < nP; i++) {
      if (pVie[i] <= 0) { pPos[i * 3 + 1] = -50; continue; }
      pVie[i] -= dt; pPos[i * 3] += pVit[i * 3] * dt; pPos[i * 3 + 1] += pVit[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVit[i * 3 + 2] * dt; pVit[i * 3 + 1] -= 6 * dt;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;

    // Les trois lignes devant le joueur ; la sienne est brillante, la visée pulse
    {
      const lignes = c.lignes;
      const cibleL = v0.ligne;
      const t = performance.now() / 1000;
      let i = 0;
      for (let l = 0; l < 3; l++) for (let k = 0; k < guides.n; k++, i++) {
        const s = v0.s + 12 + k * 12 + ((t * 40) % 12);
        const p = pointA3(piste, s, lignes[l]);
        tmpM.position.set(p.x, 0.3, p.z); tmpM.rotation.set(0, -p.cap, 0);
        const fade = 1 - k / guides.n;
        tmpM.scale.set(1, 1, l - 1 === cibleL ? 2.2 : 1.1); tmpM.updateMatrix(); guides.mesh.setMatrixAt(i, tmpM.matrix);
        couleurTmp.setHex(l - 1 === cibleL ? 0xffffff : 0x73b7ff).multiplyScalar(0.25 + 0.75 * fade * (l - 1 === cibleL ? 1 : 0.6));
        guides.mesh.setColorAt(i, couleurTmp);
      }
      guides.mesh.instanceMatrix.needsUpdate = true; guides.mesh.instanceColor.needsUpdate = true;
      guides.mesh.visible = !v0.fini && options.guides !== false;
    }

    // Le sillage : une traînée entre chaque voiture et celle qu'elle suit de près
    let si = 0;
    for (const v of c.voitures) {
      if (v.charge < 0.12) continue;
      let best = null;
      for (const o of c.voitures) { if (o === v) continue; const gap = o.dist - v.dist; if (gap > 4 && gap < 90 && Math.abs(o.d - v.d) < 8 && (!best || gap < best.gap)) best = { o, gap }; }
      if (!best || si >= sillages.length) continue;
      const m = sillages[si++];
      const dx = Math.cos(-v.cap), dz = Math.sin(-v.cap);
      const long = Math.hypot(best.o.x - v.x, best.o.y - v.y) - 8;
      m.visible = long > 4; if (!m.visible) continue;
      m.position.set((v.x + best.o.x) / 2 + dx * 2, 1.4, (v.y + best.o.y) / 2 + dz * 2);
      m.lookAt(best.o.x, 1.4, best.o.y);
      m.scale.set(6, 1, long);
      m.material.opacity = v.charge * 0.7; m.material.map.repeat.set(1, long / 22); m.material.map.offset.y -= dt * 3;
    }
    for (let i = si; i < sillages.length; i++) sillages[i].visible = false;

    // Les débris et les bonus
    dangers.forEach((g, i) => {
      const h = c.dangers[i];
      g.visible = !!h; if (!h) return;
      const p = pointA3(piste, h.dist, h.d); g.position.set(p.x, 0, p.z);
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 120);
      g.children.forEach(o => { if (o.material?.emissiveIntensity != null && o.material.emissive) o.material.emissiveIntensity = 0.5 + pulse; });
    });
    const tt = performance.now() / 1000;
    bonus.forEach(g => {
      const b = g.userData.b;
      g.visible = b.retour <= 0;
      g.userData.gem.rotation.y = tt * 2; g.userData.gem.position.y = 4.5 + Math.sin(tt * 3 + b.s) * 0.9;
      g.userData.anneau.rotation.z = tt;
    });

    if (composer) composer.render(dt); else renderer.render(scene, camera);
  }

  function reglerHeure(h) { lum.regler(h); heureCourante = h; }
  function liberer() { vider(); lum.liberer(); renderer.dispose(); pmrem.dispose(); }

  return {
    renderer, scene, camera, charger, dessiner, redimensionner, reglerHeure, liberer,
    get heure() { return heureCourante; },
    get info() { return renderer.info.render; },
  };
}

