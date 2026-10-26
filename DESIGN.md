# Crazy Racing — Bible du jeu

Document de référence de l'équipe d'agents (designers, testeurs, synthèse).
Il décrit **l'intention** : ce que le jeu est et veut être. La technique est
dans `CLAUDE.md`. Les décisions de Jérôme sont datées par version
(« Jérôme, v1.4.0 ») ; les propositions pas encore tranchées portent
`[À VALIDER]`.

## Intention

Une course de voitures vue de dessus, colorée et rapide, où l'on gagne en
freinant juste avant le virage et en sentant ses pneus partir. On sort de la
piste pour gagner une demi-seconde, on le paie ; la pluie arrive, on hésite à
rentrer aux stands. Une course dure quelques minutes et donne envie de
« encore un tour ». Inspiré de *Corner Cutters* (Ferdi Willemse) : l'idée, pas
ses circuits ni ses images.

## Piliers

1. **La voiture glisse avant de lâcher.** Un joueur attentif sent la limite de l'adhérence ; l'erreur coûte du temps, jamais la partie.
2. **Les pneus racontent la course.** Usure, chaleur et eau changent ce qu'on peut faire : trois pneus, trois façons de rouler.
3. **Couper un virage se paie.** La piste a des bords qui comptent : trois sorties, cinq secondes.
4. **Un circuit se lit d'un coup d'œil.** Vu de dessus, 34 px de large, vibreurs rouges et blancs.
5. **Une course tient sans explication.** Haut pour accélérer, bas pour freiner, côtés pour tourner.

## La boucle de jeu

- **Seconde** : placer la voiture, doser gaz et frein, viser la corde.
- **Minute** : un tour : repérer le freinage, éviter un adversaire, ramasser un bonus.
- **Partie** : 3 à 10 tours : choisir ses pneus, décider d'un arrêt au stand, doubler.
- **Entre deux parties** : records par circuit, fantôme du meilleur tour, circuits créés à soi.

## Le lot minimal

1. Une voiture qui glisse, des pneus qui s'usent, un circuit.
2. Des adversaires qui conduisent proprement et se laissent doubler.
3. Les limites de piste et le classement.

**Critère de validation** : un joueur appliqué bat les adversaires « moyen » 6 fois sur 10 sur le Port ; un joueur maladroit les bat 1 fois sur 10 ; une course de 5 tours dure moins de 2 minutes ; 60 images/s avec 10 voitures.

## Les systèmes

- **Physique** : le cap n'est pas la vitesse ; l'adhérence ramène la vitesse vers le cap, dans la limite de ce que les pneus tiennent.
- **Pneus** : slick (rapide au sec), intermédiaire (polyvalent), pluie (lent au sec, seul à tenir sous la pluie). Usure et température (zone idéale entre 45 % et 80 %).
- **Météo** : sec, humide, pluie, variable. La trace de course sèche avant le reste de la piste.
- **Stands** : un box sur la ligne ; on s'arrête, 2,6 s, pneus neufs, dégâts réparés.
- **Limites de piste** : trois sorties = +5 s ; un tamponnage coûte +3 s.
- **Bonus** (en option) : turbo, bouclier, pilote automatique, réparation.
- **Éditeur de circuits** : on tire les points de contrôle, le tracé est vérifié, on le roule tout de suite et on le partage par un code.
- **En ligne sur le même réseau** : un code court à échanger, aucun serveur.

## Le monde, le récit

Pas de récit. Trois lieux : un port de conteneurs, des dunes, une prairie traversée par un pont. Les adversaires ont un prénom et une livrée.

## Palette, échelle, son

Sweetie 16 : franche, saturée, lisible à petite taille. La voiture fait 12 px ; on la reconnaît à sa livrée. Sons synthétisés : bips de feux, crissements, turbo, pénalité.

## Public et accessibilité

Joueur occasionnel ou averti, clavier ou manette. On doit pouvoir courir sans lire. Daltonisme : la jauge d'usure se lit aussi à sa longueur ; les pénalités sont dites en texte.

## Ce que le jeu refuse

- Pas de monnaie, pas de boutique, pas de loot : la voiture est la même pour tous.
- Pas de tutoriel bavard : l'aide tient en une ligne dans la pause.
- Pas de nom réel de pilote, d'équipe ou de circuit.
- Pas de serveur ni de compte : le jeu en ligne se fait entre deux machines.

## Questions ouvertes

- Championnat (calendrier de 2 à 20 manches, titre pilotes et équipes, patron radio) ? `[À VALIDER]`
- Qualifications sur un tour pour fixer la grille ? `[À VALIDER]`
- Voitures de classes différentes (monoplace, GT, coupe) ? `[À VALIDER]`
