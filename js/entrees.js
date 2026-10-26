// Les commandes du joueur : clavier, manette, doigt (section 8) → des choix, pas des
// pédales. Une voiture se règle par impulsions : changer de ligne à gauche ou à droite,
// déclencher le bonus, appeler ou annuler l'arrêt au stand. Elles sont mises de côté
// jusqu'au prochain pas de la course, puis rendues une seule fois.

export function creerEntrees({ pad, onImpulsion }) {
  let file = { ligne: 0, bonus: false, pit: false };
  let stickPrec = 0;
  const pousser = (type, v = 1) => {
    if (type === 'ligne') file.ligne = Math.max(-1, Math.min(1, file.ligne + v));
    else file[type] = true;
    onImpulsion?.(type, v);
  };
  return {
    pousser,
    // À appeler à chaque pas : lit la manette (fronts montants), rend les impulsions en attente
    lire() {
      pad.poll();
      if (pad.pressed('left')) pousser('ligne', -1);
      if (pad.pressed('right')) pousser('ligne', 1);
      const x = pad.axis().x;
      const etat = Math.abs(x) > 0.6 ? Math.sign(x) : 0;
      if (etat && etat !== stickPrec) pousser('ligne', etat);
      stickPrec = etat;
      if (pad.pressed('a') || pad.pressed('x')) pousser('bonus');
      if (pad.pressed('b') || pad.pressed('y')) pousser('pit');
      const sortie = file;
      file = { ligne: 0, bonus: false, pit: false };
      return sortie;
    },
    reinitialiser() { file = { ligne: 0, bonus: false, pit: false }; stickPrec = 0; },
  };
}

// Les boutons à l'écran (téléphone, tablette) : un appui = une impulsion
export function creerTactile(racine, pousser) {
  for (const b of racine.querySelectorAll('button[data-k]')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.classList.add('actif'); setTimeout(() => b.classList.remove('actif'), 140);
      if (k === 'gauche') pousser('ligne', -1); else if (k === 'droite') pousser('ligne', 1); else pousser(k);
    });
  }
  return { afficher(v) { racine.hidden = !v; } };
}
