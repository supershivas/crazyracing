// Configuration de node outils/lisibilite.mjs (voir l'en-tête de l'outil).
// Une paire de couleurs s'ajoute le jour où on la dessine.
import { PALETTE } from './js/palette.js';

export default {
  palette: PALETTE,
  paires: [
    { avant: 'w', fond: 'n', role: 'texte', ou: 'HUD et menus' },
    { avant: 'n', fond: 'w', role: 'texte', ou: 'boutons' },
    { avant: 'w', fond: 'k', role: 'signe', ou: 'bordure blanche des vibreurs sur l\'asphalte' },
    { avant: 'r', fond: 'w', role: 'signe', ou: 'les vibreurs alternent rouge et blanc' },
    { avant: 'y', fond: 'k', role: 'signe', ou: 'bonus et box des stands' },
    { avant: 'o', fond: 'n', role: 'signe', ou: 'pénalités' },
  ],
  groupes: {},
  poses: [],
};
