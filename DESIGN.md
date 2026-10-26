# Crazy Racing — Bible du jeu

Document de référence de l'équipe d'agents (designers, testeurs, synthèse).
Il décrit **l'intention** : ce que le jeu est et veut être. La technique est
dans `CLAUDE.md`. Les décisions de Jérôme sont datées par version
(« Jérôme, v1.4.0 ») ; les propositions pas encore tranchées portent
`[À VALIDER]`.

## Intention

Une course de voitures où l'on ne tient pas un volant : on tient la course. Les voitures roulent seules, vite et proprement ; ce qui se joue, c'est où l'on se place. Coller la voiture de devant pour aspirer, la quitter au bon moment pour la doubler, serrer la corde ou garder ses pneus, rentrer aux stands avant la pluie, ramasser un bonus sur la bonne ligne, éviter le débris qu'on voit trop tard. La 3D, la lumière du soir, les phares dans la pluie font le spectacle. Inspiré de *Corner Cutters* (Ferdi Willemse) : l'idée, pas ses circuits ni ses images.

## Piliers

1. **Le placement est le jeu.** Trois lignes, un choix à chaque seconde ; aucun geste d'adresse.
2. **L'aspiration se lit.** Une jauge, une traînée entre les voitures, un gain de vitesse visible : on sait pourquoi on dépasse.
3. **Les pneus racontent la course.** Usure, chaleur et eau changent ce que les lignes rapportent ; l'arrêt au stand se décide.
4. **Une voiture ne sort de la piste que par un événement** (tête-à-queue, débris, crevaison), et alors toute la course le voit.
5. **Ça doit être beau et clair en même temps.** Jour, soir, nuit, pluie : la lumière dit l'ambiance, jamais ne cache la piste.

## La boucle de jeu

- **Seconde** : lire devant (virage, voiture, débris, bonus) et choisir une ligne.
- **Minute** : un tour : se coller, déboîter, doubler, ramasser, éviter.
- **Partie** : 3 à 10 tours : pneus de départ, moment du stand, usage du turbo.
- **Entre deux parties** : records par circuit, fantôme du meilleur tour, circuits créés à soi.

## Le lot minimal

1. Des voitures qui suivent le circuit à une vitesse déduite des virages et des pneus.
2. Trois lignes, un sillage qui se lit, des adversaires qui s'en servent.
3. Une course qui se gagne par les choix : un joueur qui ne fait rien finit dans le ventre du peloton, un joueur attentif gagne.

**Critère de validation** : un joueur passif finit en moyenne 3,5e sur 9 contre « moyen » et 5e contre « difficile » (mesuré par simulation) ; un joueur attentif gagne 6 fois sur 10 contre « moyen » `[À MESURER avec des joueurs]` ; une course de 5 tours dure moins de 2 minutes ; 60 images/s en qualité moyenne avec 10 voitures sur une carte graphique ordinaire `[À MESURER]`.

## Les systèmes

- **Vitesse** : chaque voiture tend vers la vitesse que les virages à venir permettent sur sa ligne, avec ses pneus ; la ligne intérieure raccourcit le chemin mais ralentit et use.
- **Aspiration** : derrière une voiture, sur sa ligne, une charge monte (0,8 par seconde) et donne jusqu'à +16 % de vitesse de pointe et d'accélération ; elle retombe en se décalant. De près dans un virage, l'air sale coûte 10 % d'adhérence.
- **Pneus** : slick (rapide au sec), intermédiaire (polyvalent), pluie (lent au sec, seul à tenir sous la pluie). Usure par la charge latérale, température (zone idéale entre 45 % et 80 %).
- **Météo** : sec, humide, pluie, variable. Chaque ligne sèche à son rythme, selon qui y roule.
- **Stands** : un box sur la ligne ; on appelle l'arrêt, la voiture se range, s'arrête 2,6 s, repart en pneus neufs.
- **Incidents** : usure, pluie sur slicks, malchance : tête-à-queue (la voiture va sur le gravier et revient) ou crevaison ; un débris posé sur une ligne frappe qui passe dessus.
- **Bonus** (en option) : turbo, bouclier (protège des incidents et des débris), sillage renforcé, réparation ; à ramasser sur la bonne ligne.
- **Éditeur de circuits** : points de contrôle, tracé vérifié, essai immédiat, partage par un code.
- **En ligne sur le même réseau** : un code à échanger, aucun serveur ; l'hôte calcule, l'invité choisit.

## Le monde, le récit

Pas de récit. Trois lieux : un port de conteneurs, des dunes, une prairie traversée par un pont. Les adversaires ont un prénom et une livrée.

## Palette, échelle, son

Sweetie 16 pour l'interface et les livrées ; la lumière fait le reste. Trois ambiances (jour, soir, nuit) et la pluie. Sons synthétisés : bips de feux, crissements, turbo, alerte de débris.

## Public et accessibilité

Joueur occasionnel ou averti, clavier ou manette. On doit pouvoir courir sans lire. Daltonisme : la jauge d'usure se lit aussi à sa longueur ; les pénalités sont dites en texte.

## Ce que le jeu refuse

- Pas de monnaie, pas de boutique, pas de loot : la voiture est la même pour tous.
- Pas de tutoriel bavard : l'aide tient en une ligne dans la pause.
- Pas de nom réel de pilote, d'équipe ou de circuit.
- Pas de volant : aucune épreuve d'adresse ; on ne perd jamais une course sur un doigt qui glisse.
- Pas de serveur ni de compte : le jeu en ligne se fait entre deux machines.

## Questions ouvertes

- Championnat (calendrier de 2 à 20 manches, titre pilotes et équipes, patron radio) ? `[À VALIDER]`
- Un « mode attaque / défense » explicite (réglage de rythme, énergie) en plus des lignes ? `[À VALIDER]`
- Qualifications sur un tour pour fixer la grille ? `[À VALIDER]`
- Voitures de classes différentes (monoplace, GT, coupe) ? `[À VALIDER]`
