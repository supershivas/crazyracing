// Les circuits fournis : des points de contrôle, rien d'autre. La ligne de
// départ est au premier point. L'éditeur écrit le même format (un circuit
// perso est un objet de cette forme, copiable en code).
export const CIRCUITS = [
  {
    id: 'port', nom: 'Le Port', theme: 'port', largeur: 34, tours: 3,
    points: [[560,110],[820,150],[960,300],[900,430],[740,470],[660,380],[540,350],[430,430],[480,560],[300,590],[150,520],[110,360],[180,230],[300,150]],
  },
  {
    id: 'dunes', nom: 'Les Dunes', theme: 'dunes', largeur: 34, tours: 3,
    points: [[800,170],[1100,150],[1350,250],[1380,420],[1200,520],[1010,430],[860,480],[900,620],[1070,670],[1130,760],[950,830],[600,780],[390,700],[300,570],[150,420],[200,230],[500,150]],
  },
  {
    id: 'huit', nom: 'Le Pont du Huit', theme: 'prairie', largeur: 36, tours: 3,
    points: [[880,500],[700,400],[520,300],[360,260],[280,360],[360,520],[520,500],[700,400],[880,300],[1040,260],[1120,360],[1040,520]],
  },
];
