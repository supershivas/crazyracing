# Roadmap — Crazy Racing

Les grosses évolutions envisagées ou en cours. Une entrée reste ici jusqu'à
sa livraison complète, puis en sort (le `CHANGELOG.md` garde la trace). Une
idée écartée part dans `docs/archives/` avec sa raison.

Statuts : **à l'étude** · **validé** (Jérôme a tranché) · **en cours** ·
**à mesurer** (livré, attend un playtest).

## En cours

### Lot minimal

**Statut** : à mesurer

- [x] Une voiture qui glisse, des pneus qui s'usent, trois circuits
- [x] Des adversaires, des limites de piste, un classement
- [ ] Le critère de validation, mesuré (voir DESIGN.md)

### Jeu en ligne : à éprouver sur deux vraies machines

**Statut** : à mesurer
**Constat** : testé entre deux pages d'un même navigateur ; pas encore sur deux ordinateurs.
**Mesure** : deux ordinateurs d'un réseau domestique se connectent et finissent une course de 5 tours sans à-coup ; le code (≈ 485 caractères) se passe par message.
**Limite connue** : les adresses locales sont masquées derrière un nom `.local` (mDNS) ; sur un réseau qui bloque mDNS la liaison échoue.

## À l'étude

### Championnat, qualifications, classes de voitures

**Statut** : à l'étude
**Constat** : présents dans le jeu qui a inspiré celui-ci, pas demandés ici.
**Proposition** : voir les questions ouvertes de DESIGN.md.
