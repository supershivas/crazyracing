// Les commandes du joueur : clavier, manette, doigt (section 8) → une commande
// { gaz, frein, volant, recul, bonus } pour les règles. Le clavier est tout ou
// rien ; le volant, lui, se tourne progressivement, sinon la voiture serait
// impossible à tenir en virage.

const borne = (x, a, b) => Math.max(a, Math.min(b, x));

export function creerEntrees({ keys, pad, tactile }) {
  let volant = 0;
  let bonus = false;
  return {
    // Le bonus et le choix de pneus sont des impulsions : on les pose depuis les actions
    declencherBonus() { bonus = true; },
    lire(dt) {
      pad.poll();
      const k = keys.axis(), m = pad.axis(), t = tactile.etat;
      let cible = k.x || m.x || ((t.droite ? 1 : 0) - (t.gauche ? 1 : 0));
      if (Math.abs(m.x) > 0 && !k.x) cible = m.x; // la manette est analogique : on la suit directement
      const analogique = !k.x && Math.abs(m.x) > 0;
      if (analogique) volant = cible;
      else volant += borne(cible - volant, -(cible === 0 ? 12 : 7) * dt, (cible === 0 ? 12 : 7) * dt);
      const gaz = (k.y < 0 || pad.held('a') || pad.held('rt') || t.gaz) ? 1 : 0;
      const frein = (k.y > 0 || pad.held('b') || pad.held('lt') || m.y > 0.4 || t.frein) ? 1 : 0;
      const cmd = { gaz, frein, volant, recul: frein > 0 && gaz === 0, bonus: bonus || pad.pressed('x') };
      bonus = false;
      return cmd;
    },
    reinitialiser() { volant = 0; bonus = false; },
  };
}

// Les boutons à l'écran (téléphone, tablette) : un doigt par bouton, plusieurs à la fois
export function creerTactile(racine) {
  const etat = { gauche: false, droite: false, gaz: false, frein: false };
  for (const b of racine.querySelectorAll('button[data-k]')) {
    const k = b.dataset.k;
    const on = e => { etat[k] = true; b.classList.add('actif'); b.setPointerCapture?.(e.pointerId); e.preventDefault(); };
    const off = () => { etat[k] = false; b.classList.remove('actif'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
  }
  return {
    etat,
    afficher(v) { racine.hidden = !v; if (!v) for (const k of Object.keys(etat)) etat[k] = false; },
  };
}
