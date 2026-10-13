/**
 * Tous les nombres de jeu vivent ici. Aucun litteral de reglage dans la
 * simulation : la vertical slice se re-equilibre sans toucher au code, et
 * les tests peuvent tenter des scenarios.
 *
 * Les durees sont en SECONDES de temps simule, jamais en millisecondes
 * d'horloge : la simulation doit rester deterministe et rejouable.
 */

export const TICK = 1 / 60;
export const MAX_CATCHUP_TICKS = 5;

export const PLAYER = {
  radius: 11,
  maxHealth: 100,
  /** Vitesse de base en unites monde / seconde. */
  speed: 190,
  /**
   * Fenetre d'invulnerabilite apres un coup recu (anti-stunlock).
   * Elle doit rester PLUS LONGUE que le temps de reaction du coup
   * justement encaisse, sinon le joueur est touche deux fois pour une
   * seule mauvaise decision.
   */
  hurtIFrames: 0.75,
  /** Caree de base : degats reduits mais deplacement plus rapide. */
  baseArmor: 0.12,
  /** Delai avant qu'un soin puisse etre rejoue. */
  healCooldown: 18,
  healAmount: 28,
  reviveInSeconds: 6,
};

export const DODGE = {
  /**
   * Esquive.
   *
   * Mesure de conception : une esquive doit permettre de BATTRE la
   * vitesse de marche de la menace la plus rapide, sinon elle ne sert
   * qu'a enjamber et le joueur n'a aucun levier sur la situation.
   *
   * On impose donc `impulse / friction / (menace la plus rapide) >= 1.45`.
   * Ici 990/3.0 = 330 u contre 226 u/s, soit 1.46 : trois chargesAllow. Avec trois
   * charges et une recharge par 1.6 s, on peut en permanence rester dans
   * le jeu de vitesse adverse sans etre rattrape.
   */
  impulse: 990,
  /** Friction : plus basse = l'impulsion porte plus longtemps. */
  friction: 3.0,
  /** Duree totale du roulade. */
  duration: 0.46,
  /** Fenetre reelle d'invulnerabilite : le debut, pas toute la duree. */
  iFramesStart: 0.03,
  iFramesEnd: 0.4,
  /** Recharge complete d'une charge. C'est ce qui rend l'esquive une decision. */
  cooldown: 1.6,
  /** Cout de vigueur, pour que l'esquive ne soit pas spammable. */
  stamina: 1,
  staminaMax: 3,
  staminaRegen: 1,
  staminaRegenDelay: 0.4,
  /** Effet de transplantation : le joueur ne peut pas s'arreter net. */
  controlLockEnd: 0.34,
};

/**
 * Temps de reaction des families d'ennemis : ce que le joueur doit voir
 * AVANT de pouvoir esquiver. C'est la seule fenetre de skill reel du jeu.
 *
 * Regle de conception : TVR >= duree des i-frames de l'esquive. Si un
 * ennemi peut frapper pendant une fenetre plus courte que ton esquive,
 * le timing devient une loterie et le jeu se joue a l'instinct.
 */
export const REACTION = {
  /** Frappe de melee : lisible, mais serree. */
  melee: 0.52,
  /** Charge telegraphiee : ample, c'est le coup le plus dangereux. */
  charge: 0.68,
  /** Tir a distance : tres lisible, il doit pouvoir etre esquive en marchant. */
  shot: 0.78,
  /** Faisceau du guetteur : long, lent, brutal. */
  beam: 0.95,
  /** Le boss : toujours plus long qu'un ennemi normal. */
  boss: 0.85,
};

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    fireInterval: 0.46,
    damage: 15,
    bulletSpeed: 620,
    bulletLife: 0.85,
    spread: 0.035,
    pierce: 0,
    range: 300,
    auto: true,
  },
  scattergun: {
    id: 'scattergun',
    name: 'Scattergun',
    fireInterval: 0.92,
    damage: 9,
    pellets: 5,
    spread: 0.26,
    bulletSpeed: 480,
    bulletLife: 0.4,
    pierce: 0,
    range: 190,
    auto: true,
  },
  rail: {
    id: 'rail',
    name: 'Lance-rail',
    fireInterval: 1.35,
    damage: 48,
    bulletSpeed: 900,
    bulletLife: 0.7,
    spread: 0.004,
    pierce: 4,
    range: 480,
    auto: true,
  },
};

export const AIM = {
  /** Au-dela de cette distance, pas de tir auto. */
  maxRange: 420,
  /** On doit avoir une ligne de vue degagee. */
  requireLineOfSight: true,
  /** Tolerance d'angle avant de considerer une cible comme valide. */
  cone: Math.PI,
  /** Delai avant que l'arme ne choisisse une cible. */
  targetSwitchDelay: 0.18,
};

export const EXTRACTION = {
  /** Le cercle d'extraction est visible des la fin de l'periode. */
  openAtSeconds: 150,
  /** Rayon du pad. */
  radius: 54,
  /** Il faut rester dessus ce temps-la. */
  holdSeconds: 2.4,
  /** Si l'periode se termine sans extraction : defaite. */
  timeoutIsDefeat: true,
};

/**
 * Butin : ce qui se perd a la mort contre ce qui est permanent.
 * Regle de confiance : le joueur ne perd JAMAIS sa progression permanente,
 * et n'est JAMAIS force de farmer une quantite absurde de communs.
 */
export const LOOT = {
  /** Butin perdu a la mort. */
  TEMPORARY: ['scrap', 'ration', 'ammo'],
  /** Butin conserve, parce qu'il est lie a une decouverte. */
  PERMANENT: ['relic', 'key', 'record'],
  CAPACITY: 24,
};

export const ECONOMY = {
  /** Cout de base d'une amelioration du refuge. */
  upgradeBase: 12,
  upgradeStep: 1.55,
  /** Cout d'un soin a l'atelier. */
  medkitCost: 6,
  /** Chaque achat d'amelioration rend la suivante plus chere. */
  softCapFree: 3,
};

export const COMPANION = {
  radius: 10,
  /** Distance de suivi maintenue. */
  followDistance: 88,
  /** Repos au point de suivi quand aucun combat. */
  catchUpSpeed: 420,
  /** Perte de PV du compagnon : il revient, il ne meurt pas. */
  downSeconds: 9,
  /** Delai avant qu'il puisse a nouveau intervenir. */
  reviveSeconds: 12,
  /** Degats de base. */
  damage: 7,
  attackInterval: 0.7,
  attackRange: 26,
  /** Capacite de soin par soin. */
  healPerSecond: 0.9,
};

export const BOSS = {
  /** Multiplicateur de PV pour le boss de la vertical slice. */
  healthScale: 14,
  /** Checkpoint de PV entre les phases. */
  phaseThresholds: [1.0, 0.66, 0.33],
  /** Invulnerabilite apres un changement de phase. */
  phaseInvuln: 1.1,
  /** Recompense unique, non reproductible. */
  uniqueRewardId: 'ward_of_the_house',
};

export const HORROR = {
  /** Reduire les effets ne doit pas casser la telegraphie : on garde le minimum. */
  reducedEffectsKeepTelegraphs: true,
  flashMaxHz: 3,
  shakeScale: 1,
};

export const CAMERA = {
  followLerp: 9,
  lookAhead: 42,
  worldMin: -240,
  worldMax: 2560,
};

export const PROGRESSION = {
  xpPerLevel: (lvl) => Math.round(24 * Math.pow(1.42, lvl - 1)),
  maxLevel: 20,
  /** Bonus de PV par niveau. */
  healthPerLevel: 4,
};