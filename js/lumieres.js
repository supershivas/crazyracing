// La lumière : le soleil (ou la lune) avec ses ombres, le ciel, la brume, la pluie qui
// tombe, les lampadaires et les phares qui s'allument la nuit. Tout bouge avec l'heure,
// la météo et la position des voitures : c'est la lumière dynamique du jeu.
import * as THREE from 'three';

export const HEURES = {
  jour: { haut: '#3f86d6', bas: '#cbe6ff', soleil: '#fff1d8', force: 3.4, elevation: 55, azimut: 35, ciel: 0.75, sol: '#6c5f4b', brume: '#cfe3f2', densite: 0.00085, exposition: 1.0, bloom: 0.1, nuit: 0 },
  soir: { haut: '#2c3d7d', bas: '#ff9a5e', soleil: '#ff9a52', force: 2.9, elevation: 7, azimut: 70, ciel: 0.38, sol: '#3a2f3d', brume: '#d68e66', densite: 0.0014, exposition: 1.05, bloom: 0.32, nuit: 0.4 },
  nuit: { haut: '#04060d', bas: '#1a2240', soleil: '#9bb4ff', force: 0.55, elevation: 38, azimut: 210, ciel: 0.2, sol: '#10131f', brume: '#0a0f1e', densite: 0.0019, exposition: 1.15, bloom: 0.75, nuit: 1 },
};
export const NOMS_HEURES = Object.keys(HEURES);

const k3 = c => new THREE.Color(c);
const mixer = (a, b, t) => a + (b - a) * t;

// q : { ombres: 0 | 1024 | 2048, lampes: nombre de lampadaires éclairants, phares: nombre de phares, pluie: nombre de traits }
export function creerLumieres(scene, renderer, q, heure = 'jour') {
  // Le ciel : un dôme dégradé, des étoiles, un disque de soleil
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { haut: { value: k3('#3f86d6') }, bas: { value: k3('#cbe6ff') } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 haut; uniform vec3 bas; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y * 1.6 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(bas, haut, pow(h, 0.7)), 1.0); }',
    }),
  );
  dome.renderOrder = -10; scene.add(dome);
  const etoilesGeo = new THREE.BufferGeometry();
  const e = []; for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, h = Math.random() * 0.95 + 0.05, r = 3900; e.push(Math.cos(a) * Math.sqrt(1 - h * h) * r, h * r, Math.sin(a) * Math.sqrt(1 - h * h) * r); }
  etoilesGeo.setAttribute('position', new THREE.Float32BufferAttribute(e, 3));
  const etoilesMat = new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  scene.add(new THREE.Points(etoilesGeo, etoilesMat));
  const disque = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff2d0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  disque.scale.set(380, 380, 1); scene.add(disque);

  // Soleil / lune, avec ombres suivant la voiture suivie
  const soleil = new THREE.DirectionalLight(0xffffff, 3);
  if (q.ombres) {
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(q.ombres, q.ombres);
    const s = soleil.shadow.camera; s.left = -170; s.right = 170; s.top = 170; s.bottom = -170; s.near = 10; s.far = 1400;
    soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.6;
  }
  scene.add(soleil, soleil.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
  scene.add(hemi);
  const brume = new THREE.FogExp2(0xcfe3f2, 0.001);
  scene.fog = brume;

  // Les lampadaires et les phares : des lumières en nombre fixe, rangées sur les plus proches
  const lampes = Array.from({ length: q.lampes }, () => { const l = new THREE.PointLight(0xffe2a8, 0, 130, 2); scene.add(l); return l; });
  const phares = Array.from({ length: q.phares }, () => {
    const l = new THREE.SpotLight(0xfff3d6, 0, 150, 0.42, 0.55, 1.6); scene.add(l, l.target); return l;
  });
  const feu = new THREE.PointLight(0xff9a40, 0, 50, 2); scene.add(feu);

  // La pluie : des traits qui tombent autour de la caméra
  const nPluie = q.pluie;
  const pluiePos = new Float32Array(nPluie * 6);
  const pluieGeo = new THREE.BufferGeometry(); pluieGeo.setAttribute('position', new THREE.BufferAttribute(pluiePos, 3));
  const pluieMat = new THREE.LineBasicMaterial({ color: 0xbfd8f2, transparent: true, opacity: 0.0, depthWrite: false });
  const pluie = new THREE.LineSegments(pluieGeo, pluieMat); pluie.frustumCulled = false; scene.add(pluie);
  const gouttes = Array.from({ length: nPluie }, () => ({ x: (Math.random() - 0.5) * 360, y: Math.random() * 160, z: (Math.random() - 0.5) * 360, v: 260 + Math.random() * 120 }));

  // L'état courant, rejoint doucement quand l'heure ou la météo change
  const courant = { ...HEURES[heure] };
  const cour = { haut: k3(courant.haut), bas: k3(courant.bas), soleil: k3(courant.soleil), brume: k3(courant.brume), sol: k3(courant.sol) };
  let cible = HEURES[heure], nom = heure;
  const tmp = new THREE.Color();

  return {
    get heure() { return nom; },
    regler(h) { if (HEURES[h]) { cible = HEURES[h]; nom = h; } },
    get nuit() { return courant.nuit; },
    get bloom() { return courant.bloom; },
    get exposition() { return courant.exposition; },
    // c : la course ; focus : { x, z, cap } ; voitures : [{ x, z, cap, v, turbo }] ; lampadaires : positions des mâts
    maj(c, dt, camera, focus, voitures, lampadaires) {
      const k = 1 - Math.exp(-dt * 1.6);
      const gris = k3('#6a7686'), eau = c.eau;
      for (const [cle, vers] of [['haut', k3(cible.haut)], ['bas', k3(cible.bas)], ['soleil', k3(cible.soleil)], ['brume', k3(cible.brume)], ['sol', k3(cible.sol)]]) {
        const v = tmp.copy(vers);
        if (cle === 'haut' || cle === 'bas' || cle === 'brume') v.lerp(gris, eau * (cible.nuit > 0.5 ? 0.2 : 0.6));
        cour[cle].lerp(v, k);
      }
      for (const cle of ['force', 'elevation', 'azimut', 'ciel', 'densite', 'exposition', 'bloom', 'nuit']) courant[cle] = mixer(courant[cle], cible[cle], k);

      dome.material.uniforms.haut.value.copy(cour.haut); dome.material.uniforms.bas.value.copy(cour.bas);
      etoilesMat.opacity = Math.max(0, courant.nuit - 0.4) * (1 - eau) * 1.2;
      brume.color.copy(cour.brume); brume.density = courant.densite * (1 + eau * 1.8);
      scene.background = cour.brume;

      const el = courant.elevation * Math.PI / 180, az = courant.azimut * Math.PI / 180;
      const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      soleil.color.copy(cour.soleil);
      soleil.intensity = courant.force * (1 - 0.6 * eau);
      soleil.target.position.set(focus.x, 0, focus.z);
      soleil.position.copy(soleil.target.position).addScaledVector(dir, 600);
      disque.position.copy(camera.position).addScaledVector(dir, 3800); disque.material.color.copy(cour.soleil); disque.material.opacity = (1 - eau * 0.85) * (courant.nuit > 0.5 ? 0.55 : 1);
      hemi.color.copy(cour.bas).lerp(new THREE.Color(0xffffff), 0.3); hemi.groundColor.copy(cour.sol);
      hemi.intensity = courant.ciel * (1 - 0.25 * eau);
      renderer.toneMappingExposure = courant.exposition;

      // La nuit : lampadaires les plus proches de la caméra
      const nuit = courant.nuit;
      if (lampes.length) {
        const proches = lampadaires.map(p => [p, (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2]).sort((a, b) => a[1] - b[1]);
        lampes.forEach((l, i) => {
          const p = proches[i]?.[0];
          if (!p) { l.intensity = 0; return; }
          l.position.set(p.x, 23, p.z); l.intensity = nuit > 0.1 ? 1700 * Math.min(1, nuit * 1.3) : 0;
        });
      }
      // Phares : les voitures les plus proches de la caméra
      if (phares.length) {
        const ordre = voitures.map(v => [v, (v.x - focus.x) ** 2 + (v.z - focus.z) ** 2]).sort((a, b) => a[1] - b[1]);
        phares.forEach((l, i) => {
          const v = ordre[i]?.[0];
          if (!v || nuit < 0.15) { l.intensity = 0; return; }
          const dx = Math.cos(-v.cap), dz = Math.sin(-v.cap);
          l.position.set(v.x + dx * 7, 2.4, v.z + dz * 7);
          l.target.position.set(v.x + dx * 60, 0, v.z + dz * 60);
          l.intensity = 2200 * Math.min(1, nuit * 1.4);
        });
      }
      const turbo = voitures.find(v => v.turbo > 0);
      if (turbo) { feu.position.set(turbo.x - Math.cos(-turbo.cap) * 9, 3, turbo.z - Math.sin(-turbo.cap) * 9); feu.intensity = 900 + Math.random() * 500; } else feu.intensity = 0;

      // La pluie
      const n = Math.floor(nPluie * Math.min(1, eau * 1.25));
      pluieMat.opacity = Math.min(0.5, eau * 0.6);
      pluieGeo.setDrawRange(0, n * 2);
      for (let i = 0; i < n; i++) {
        const g = gouttes[i];
        g.y -= g.v * dt;
        if (g.y < 0) { g.y = 120 + Math.random() * 40; g.x = (Math.random() - 0.5) * 360; g.z = (Math.random() - 0.5) * 360; }
        const o = i * 6, px = camera.position.x + g.x, pz = camera.position.z + g.z;
        pluiePos[o] = px; pluiePos[o + 1] = g.y; pluiePos[o + 2] = pz;
        pluiePos[o + 3] = px - 0.6; pluiePos[o + 4] = g.y + 5; pluiePos[o + 5] = pz;
      }
      pluieGeo.attributes.position.needsUpdate = true;
    },
    liberer() { dome.geometry.dispose(); etoilesGeo.dispose(); pluieGeo.dispose(); },
  };
}
