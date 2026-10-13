/**
 * CONTENU — donnees pures, aucun code de jeu ici.
 *
 * Tout ce qui est tunable vit dans ce fichier et ses voisins. La boucle
 * de simulation lit ces structures, elle ne les contient jamais. Ajouter
 * une classe ou un ennemi ne doit jamais demander d'ouvrir un systeme.
 *
 * Convention de conception retenue pour la vertical slice : trois classes
 * qui se lisent sur l'ecran en trois secondes, cinq familles d'ennemis
 * au comportement distinct, un boss a trois phases.
 */

/* --------------------------------------------------------------- CLASSES -- */

export const CLASSES = {
  survivante: {
    id: 'survivante',
    name: 'La Survivante',
    tagline: 'Tient plus longtemps que les autres. C tout ce quon lui demande.',
    role: 'Tenacite',
    weapon: 'pistol',
    health: 120,
    armor: 0.2,
    speed: 182,
    silhouette: 'player',
    palette: { body: 'hsl(30 46% 80%)', trim: 'hsl(18 60% 46%)' },
    /** Capacite active : pulsation qui calme l'anomalie autour de soi. */
    ability: {
      id: 'pulse',
      name: 'Souffle',
      desc: 'Repousse les morts-vivants et calme la corruption autour de toi.',
      cooldown: 9,
      radius: 190,
      damage: 14,
      duration: 0.5,
    },
    weakness: 'Portee courte, aucun degat de zone.',
    strength: 'Survit aux erreurs ; c est la classe pour apprendre.',
  },
  chasseur: {
    id: 'chasseur',
    name: 'Le Chasseur',
    tagline: 'Il ne fuit pas. Il compte.',
    role: 'Precision',
    weapon: 'rail',
    health: 88,
    armor: 0.04,
    speed: 196,
    silhouette: 'player',
    palette: { body: 'hsl(206 30% 76%)', trim: 'hsl(206 46% 40%)' },
    ability: {
      id: 'mark',
      name: 'Marquage',
      desc: 'Designe une cible : +60 % de degats pendant 5 s.',
      cooldown: 11,
      duration: 5,
      bonus: 0.6,
      range: 420,
    },
    weakness: 'Peu de vie ; un mauvais timing se paie cher.',
    strength: 'Elimine les cibles elites et les phases de boss.',
  },
  porteuse: {
    id: 'porteuse',
    name: 'La Porteuse',
    tagline: 'Ce qu elle transporte ne lui appartient pas.',
    role: 'Support',
    weapon: 'scattergun',
    health: 104,
    armor: 0.14,
    speed: 172,
    silhouette: 'player',
    palette: { body: 'hsl(96 26% 72%)', trim: 'hsl(96 36% 36%)' },
    ability: {
      id: 'veil',
      name: 'Voile',
      desc: 'Le compagnon vous rejoint instantanement et soigne plus vite.',
      cooldown: 16,
      duration: 8,
      companionHeal: 2.4,
    },
    weakness: 'Moins mobile : quand la ligne se referme, elle sort moins vite.',
    strength: 'Le seul moyen fiable de soutenir une expedition longue.',
  },
};

/* -------------------------------------------------------------- ENNEMIS -- */

/**
 * Chaque famille doit se reconnaitre SANS sa couleur : silhouette,
 * cadence et telegraphie. Si deux familles se ressemblent, le joueur
 * n'a pas d'information et il improvise au lieu de lire.
 */
export const ENEMIES = {
  rieur: {
    id: 'rieur',
    name: 'Rieur',
    family: 'errant',
    silhouette: 'humanoid',
    health: 34,
    speed: 88,
    damage: 9,
    radius: 11,
    attackRange: 26,
    telegraph: 0.42,
    attackWindup: 0.42,
    attackRecover: 0.5,
    xp: 6,
    scrap: [1, 3],
    behavior: 'charge',
    color: 'hsl(214 14% 60%)',
  },
  plethore: {
    id: 'plethore',
    name: 'Plethore',
    family: 'errant',
    silhouette: 'blob',
    health: 92,
    speed: 54,
    damage: 17,
    radius: 16,
    attackRange: 34,
    telegraph: 0.72,
    attackWindup: 0.72,
    attackRecover: 0.9,
    xp: 14,
    scrap: [3, 7],
    behavior: 'charge',
    slowExplosion: true,
    color: 'hsl(28 26% 58%)',
  },
  pleureuse: {
    id: 'pleureuse',
    name: 'Pleureuse',
    family: 'hurleur',
    silhouette: 'tall',
    health: 58,
    speed: 70,
    damage: 12,
    radius: 10,
    attackRange: 300,
    telegraph: 0.9,
    attackWindup: 0.9,
    attackRecover: 1.2,
    xp: 12,
    scrap: [2, 5],
    behavior: 'ranged',
    projectileSpeed: 240,
    color: 'hsl(268 24% 64%)',
  },
  meute: {
    id: 'meute',
    name: 'Meute',
    family: 'bête',
    silhouette: 'quad',
    health: 40,
    speed: 156,
    damage: 13,
    radius: 12,
    attackRange: 24,
    telegraph: 0.3,
    attackWindup: 0.3,
    attackRecover: 0.36,
    xp: 9,
    scrap: [1, 4],
    behavior: 'flank',
    color: 'hsl(6 30% 56%)',
  },
  guetteur: {
    id: 'guetteur',
    name: 'Guetteur',
    family: 'anomalie',
    silhouette: 'blob',
    health: 210,
    speed: 0,
    damage: 22,
    radius: 24,
    attackRange: 220,
    telegraph: 1.2,
    attackWindup: 1.2,
    attackRecover: 1.6,
    xp: 40,
    scrap: [8, 14],
    behavior: 'station',
    beam: true,
    color: 'hsl(186 34% 66%)',
  },
};

/* ----------------------------------------------------------------- BOSS -- */

export const BOSS = {
  id: 'gardien',
  name: 'Le Gardien de seuil',
  subtitle: 'Ce qui garde la maison ne la protege pas.',
  silhouette: 'boss',
  health: 1150,
  speed: 62,
  damage: 26,
  radius: 36,
  xp: 220,
  color: 'hsl(292 28% 64%)',
  colorRim: 'hsl(186 52% 62%)',
  phases: [
    {
      id: 1,
      from: 1.0,
      to: 0.66,
      name: 'Veille',
      pattern: 'sweep',
      /** Balayage large : le joueur doit traverser par le centre. */
      telegraph: 0.78,
      interval: 2.6,
      speed: 74,
    },
    {
      id: 2,
      from: 0.66,
      to: 0.33,
      name: 'Recit',
      pattern: 'summon',
      telegraph: 0.66,
      interval: 3.4,
      speed: 60,
      summon: ['rieur', 'rieur', 'meute'],
    },
    {
      id: 3,
      from: 0.33,
      to: 0.0,
      name: 'Faille',
      pattern: 'beam',
      telegraph: 1.05,
      interval: 2.9,
      speed: 96,
      /** L'entree de cette phase est le vrai « moment horreur » du jeu. */
      horrorMoment: true,
    },
  ],
  /** Le boss ne peut pas etre encore en train de mourir si on le tuer. */
  uniqueReward: 'ward_of_the_house',
};

/* --------------------------------------------------------------- OBJETS -- */

export const ITEMS = {
  scrap: { id: 'scrap', name: 'Ferraille', stack: 999, tier: 'commun', desc: 'Ce que le monde laisse derriere lui.' },
  ration: { id: 'ration', name: 'Ration', stack: 9, tier: 'commun', desc: 'Compte quand on a faim.' },
  ammo: { id: 'ammo', name: 'Munitions', stack: 240, tier: 'commun', desc: 'Rarement la bonne nouvelle.' },
  core: { id: 'core', name: 'Coeur d anomalie', stack: 9, tier: 'rare', desc: 'Encore tiède, encore vivant.' },
  relic: { id: 'relic', name: 'Relique', stack: 9, tier: 'unique', desc: 'Ne se perd jamais.' },
  record: { id: 'record', name: 'Enregistrement', stack: 9, tier: 'unique', desc: 'Une voix qui dit autre chose.' },
};

/**
 * La recompense de fin de region. Elle n'est pas dans le sac de butin :
 * elle est TIEDE au refuge. C'est ce qui rend le retour au refuge
 * obligatoire dans la boucle.
 */
export const REWARDS = {
  ward_of_the_house: {
    id: 'ward_of_the_house',
    name: 'Garde du Seuil',
    kind: 'sanctuary',
    desc: 'Le seuil ne rejette plus le survivant. Il reconnait son sang.',
    effect: 'Retour au refuge instantane depuis n importe quel point de la region.',
    repeatable: false,
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    kind: 'refuge',
    desc: 'On peut enfin refondre ce qu on recupere.',
    repeatable: true,
  },
  infirmary: {
    id: 'infirmary',
    name: 'Infirmerie',
    kind: 'refuge',
    desc: 'Un lit, une lampe, quelqu un qui veille.',
    repeatable: true,
  },
};

/* ----------------------------------------------------------------- ITEMS -- */

/**
 * Equipement. Trois emplacements seulement : au-dela, on ne choisit plus,
 * on herite. La difference de jeu doit se voir en une seconde de combat.
 */
export const EQUIPMENT = {
  pistol: { id: 'pistol', name: 'Pistol', slot: 'arme', damage: 1, speed: 1, desc: 'Fiable, sans surprise.' },
  scattergun: { id: 'scattergun', name: 'Scattergun', slot: 'arme', damage: 0.9, speed: 0.85, desc: 'Court. Tres fort de pres.' },
  rail: { id: 'rail', name: 'Lance-rail', slot: 'arme', damage: 1.35, speed: 0.75, desc: 'Transperce. Il faut viser.' },
  chapel: { id: 'chapel', name: 'Chapelle du seuil', slot: 'signe', damage: 1, speed: 1, desc: 'Ralentit ce qui franchit la porte.' },
  satchel: { id: 'satchel', name: 'Sac de prospection', slot: 'signe', damage: 1, speed: 1, desc: 'Plus de butin par expedition.' },
  coat: { id: 'coat', name: 'Manteau de cendre', slot: 'signe', damage: 1, speed: 1.06, desc: 'La poussiere ne s accroche plus.' },
};