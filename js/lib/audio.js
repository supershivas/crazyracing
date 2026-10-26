/* ─── Son — partagé entre les jeux ─────────────────────────────────────────
   Source de vérité : supershivas/game-system/modules/audio.js
   Applique la section 14 de CONVENTIONS.md : Web Audio, déverrouillé au
   premier geste ; volumes musique et effets séparés ; silence quand
   l'onglet est caché. Les bruitages sont de préférence synthétisés (aucun
   fichier à charger), la musique peut être un fichier ou une boucle de notes.

   Module ES sans dépendance :
     import { createAudio } from './lib/audio.js?v=0.2.0'
     const audio = createAudio({ music: 0.7, sfx: 0.8 })   // volumes 0..1
     audio.unlockOn(document)            // au premier pointerdown / keydown
     audio.sfx('saut')                   // un son de la banque (voir SOUNDS)
     audio.define('pas', { type: 'noise', dur: 0.05, vol: 0.3, filter: 1200 })
     audio.tone({ freq: 440, to: 880, dur: 0.1, type: 'square', vol: 0.4 })
     await audio.playMusic('assets/music/foret.ogg', { loop: true, fade: 1 })
     audio.stopMusic({ fade: 1 })
     audio.setVolume('music', 0.5)      // depuis les réglages
     audio.now                           // horloge audio (jeux de rythme)
   ─────────────────────────────────────────────────────────────────────────── */

// Une petite banque de départ, à remplacer ou compléter par `define`
export const SOUNDS = {
  clic: { type: 'square', freq: 660, dur: 0.04, vol: 0.25 },
  saut: { type: 'square', freq: 300, to: 600, dur: 0.12, vol: 0.3 },
  pièce: [{ type: 'square', freq: 988, dur: 0.06, vol: 0.25 }, { type: 'square', freq: 1319, dur: 0.12, vol: 0.25, at: 0.06 }],
  coup: { type: 'noise', dur: 0.12, vol: 0.5, filter: 900 },
  explosion: { type: 'noise', dur: 0.5, vol: 0.6, filter: 500, to: 80 },
  erreur: { type: 'sawtooth', freq: 160, to: 110, dur: 0.18, vol: 0.3 },
  validation: [{ type: 'triangle', freq: 523, dur: 0.08 }, { type: 'triangle', freq: 659, dur: 0.08, at: 0.08 }, { type: 'triangle', freq: 784, dur: 0.16, at: 0.16 }],
};

export function createAudio({ music = 0.7, sfx = 0.8 } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null;
  const bank = { ...SOUNDS };
  let musicGain, sfxGain, master, noiseBuf, track = null;

  if (ctx) {
    master = ctx.createGain(); master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = music; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfx; sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    // Bruit blanc : son, pas logique de jeu (Math.random est permis ici)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume();
    });
  }
  let unlocked = false;

  function voice({ type = 'square', freq = 440, to, dur = 0.1, vol = 0.3, filter, at = 0 }) {
    if (!ctx || !unlocked) return;
    const t = ctx.currentTime + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src;
    if (type === 'noise') {
      src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(filter || 2000, t);
      if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      src.connect(f); f.connect(g);
    } else {
      src = ctx.createOscillator(); src.type = type;
      src.frequency.setValueAtTime(freq, t);
      if (to) src.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      src.connect(g);
    }
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const api = {
    get ctx() { return ctx; },
    get now() { return ctx ? ctx.currentTime : performance.now() / 1000; },
    get unlocked() { return unlocked; },
    unlock() {
      if (!ctx || unlocked) return;
      ctx.resume();
      unlocked = true;
    },
    unlockOn(target = document) {
      const go = () => { api.unlock(); target.removeEventListener('pointerdown', go); target.removeEventListener('keydown', go); };
      target.addEventListener('pointerdown', go);
      target.addEventListener('keydown', go);
    },
    define(name, def) { bank[name] = def; },
    sfx(name) {
      const def = bank[name];
      if (!def) { console.warn(`[audio] son inconnu : ${name}`); return; }
      (Array.isArray(def) ? def : [def]).forEach(voice);
    },
    tone: voice,
    setVolume(kind, v) {
      const g = kind === 'music' ? musicGain : sfxGain;
      if (g) g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.02);
    },
    async playMusic(url, { loop = true, fade = 0.5 } = {}) {
      if (!ctx) return;
      api.stopMusic({ fade });
      const res = await fetch(url);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      src.connect(g); g.connect(musicGain);
      src.start();
      g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + Math.max(0.01, fade));
      track = { src, g };
    },
    stopMusic({ fade = 0.5 } = {}) {
      if (!ctx || !track) return;
      const { src, g } = track; track = null;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.01, fade) / 4);
      src.stop(ctx.currentTime + Math.max(0.01, fade));
    },
    // Le labo fait entendre chaque son : la liste des noms
    get names() { return Object.keys(bank); },
  };
  return api;
}
