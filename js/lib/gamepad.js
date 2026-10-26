/* ─── Manette — partagé entre les jeux ─────────────────────────────────────
   Source de vérité : supershivas/game-system/modules/gamepad.js
   Applique les sections 8 et 22 de CONVENTIONS.md : la manette fait les
   mêmes actions que le clavier, sans configuration (disposition « standard »
   de l'API Gamepad : Xbox, PlayStation, Switch Pro, Steam Deck).

   Module ES sans dépendance :
     import { createGamepad } from './lib/gamepad.js'
     const pad = createGamepad({
       actions: { action: 'a', retour: 'b', carte: 'y', pause: 'start' },
       onAction: (nom) => {},      // une fois par appui
       onConnect: id => toast('Manette branchée'),
     })
     // dans la boucle, une fois par image :
     pad.poll()
     pad.axis()   // { x, y } entre -1 et 1 (stick gauche ou croix), zone morte appliquée
     pad.held('a')
   Boutons : a b x y lb rb lt rt select start l3 r3 up down left right home
   (« a » = bouton du bas, « b » = droite, « x » = gauche, « y » = haut).
   ─────────────────────────────────────────────────────────────────────────── */

export const BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right', 'home'];

export function createGamepad({ actions = {}, onAction, onConnect, onDisconnect, deadzone = 0.25 } = {}) {
  let prev = new Set();
  let now = new Set();
  let stick = { x: 0, y: 0 };
  let connected = false;

  const onConn = e => { connected = true; onConnect?.(e.gamepad.id); };
  const onDisc = e => { connected = false; prev.clear(); now.clear(); onDisconnect?.(e.gamepad.id); };
  window.addEventListener('gamepadconnected', onConn);
  window.addEventListener('gamepaddisconnected', onDisc);

  const dz = v => (Math.abs(v) < deadzone ? 0 : (v - Math.sign(v) * deadzone) / (1 - deadzone));

  return {
    get connected() { return connected; },
    poll() {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      prev = now;
      now = new Set();
      stick = { x: 0, y: 0 };
      for (const p of pads) {
        p.buttons.forEach((b, i) => { if (b.pressed && BUTTONS[i]) now.add(BUTTONS[i]); });
        const x = dz(p.axes[0] || 0), y = dz(p.axes[1] || 0);
        if (Math.abs(x) > Math.abs(stick.x)) stick.x = x;
        if (Math.abs(y) > Math.abs(stick.y)) stick.y = y;
      }
      if (onAction) {
        for (const [name, btn] of Object.entries(actions)) {
          const list = Array.isArray(btn) ? btn : [btn];
          if (list.some(b => now.has(b) && !prev.has(b))) onAction(name);
        }
      }
    },
    held: b => now.has(b),
    pressed: b => now.has(b) && !prev.has(b),
    axis() {
      const x = stick.x || (now.has('right') ? 1 : 0) - (now.has('left') ? 1 : 0);
      const y = stick.y || (now.has('down') ? 1 : 0) - (now.has('up') ? 1 : 0);
      return { x, y };
    },
    destroy() {
      window.removeEventListener('gamepadconnected', onConn);
      window.removeEventListener('gamepaddisconnected', onDisc);
    },
  };
}
