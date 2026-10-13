/**
 * MONDE, QUETES ET RECIT.
 *
 * Une seule region pour la vertical slice, mais une region dense :
 * cinq lieux, des routes qui se croisent, un ordre de decouverte qui
 * existe sans etre impose. Le joueur doit pouvoir perdre un temps,
 * trouver un raccourci et revenir sans que la progression casse.
 *
 * World bounds: CAMERA.worldMin..worldMax (1160 unites carrees de contenu
 * utile). Les coordonnees ci-dessous sont en unites monde.
 */

export const REGION = {
  id: 'vallee',
  name: 'La Vallee Fracturee',
  zone: 'valley',
  /** Description d'ambiance affichee dans le journal. */
  brief:
    'Une vallée de cendre. Les maisons sont encore debout. Les gens, moins.',
  bounds: { minX: 0, minY: 0, maxX: 2560, maxY: 2560 },
  extraction: { x: 188, y: 2208 },
  spawn: { x: 260, y: 2160 },
};

/**
 * Lieux d'interet. `kind` pilote la construction de l'arene et la
 * recompense : ce n'est pas un label, c'est une regle.
 */
export const POIS = [
  {
    id: 'camp',
    kind: 'camp',
    name: 'Le Camp des Cendres',
    x: 520,
    y: 1180,
    radius: 190,
    objective: 'Trouver de quoi tenir trois nuits.',
    reward: { scrap: 18, ration: 2 },
    discovery: 'note_pile',
  },
  {
    id: 'gare',
    kind: 'narrative',
    name: 'La Gare des Non-Rappeles',
    x: 1240,
    y: 640,
    radius: 220,
    objective: 'Un enregistrement parle encore. Il parle de la maison.',
    reward: { scrap: 26, record: 1 },
    discovery: 'record_gare',
    spawns: ['rieur', 'meute'],
  },
  {
    id: 'puits',
    kind: 'optional',
    name: 'Le Puits Sec',
    x: 1880,
    y: 1560,
    radius: 200,
    objective: 'Quelque chose a ete enterre ici exprès.',
    reward: { scrap: 34, core: 1 },
    discovery: 'note_puits',
    optional: true,
    spawns: ['pleureuse', 'plethore'],
  },
  {
    id: 'halle',
    kind: 'faction',
    name: 'La Halle des Veilleurs',
    x: 700,
    y: 500,
    radius: 210,
    objective: 'Ils gardent la route. Ils ne sont pas d ici.',
    reward: { scrap: 22, ammo: 60 },
    discovery: 'banniere_veilleurs',
    spawns: ['rieur', 'pleureuse'],
  },
  {
    id: 'seuil',
    kind: 'boss',
    name: 'Le Seuil',
    x: 1280,
    y: 1280,
    radius: 250,
    objective: 'Ce qui garde la porte ne la ferme plus.',
    reward: { unique: 'ward_of_the_house' },
    spawns: ['guetteur', 'meute'],
  },
];

/**
 * Massifs qui cassent la ligne de vue et cassent le trac en diagonale.
 * Ce ne sont pas des obstacles arbitraires : ils dessinent les routes.
 */
export const OBSTACLES = [
  { x: 340, y: 1680, w: 150, h: 60, kind: 'ruin' },
  { x: 980, y: 1520, w: 70, h: 210, kind: 'ruin' },
  { x: 1520, y: 900, w: 230, h: 62, kind: 'ruin' },
  { x: 2060, y: 980, w: 70, h: 240, kind: 'ruin' },
  { x: 620, y: 2080, w: 300, h: 58, kind: 'ruin' },
  { x: 1640, y: 2020, w: 90, h: 230, kind: 'ruin' },
  { x: 1060, y: 360, w: 260, h: 58, kind: 'ruin' },
];

/* -------------------------------------------------------------- QUETES -- */

/**
 * Les quetes sont une machine a etats pure : `on` recoit l'evenement,
 * `resolve` renvoie le nouvel etat. Testable sans interface.
 */
export const QUEST_DEFS = [
  {
    id: 'retrouver',
    title: 'Redevenir capable de se souvenir',
    order: 0,
    start: 'auto',
    states: ['active'],
    hint: 'Marche. Vois la maison.',
  },
  {
    id: 'premiers_jours',
    title: 'Trois nuits',
    order: 1,
    start: 'retrouver:done',
    states: ['active'],
    hint: 'Reviens au refuge trois fois. Choisis ce que tu fabriques.',
    objective: 'Ameliorer le refuge jusqu au niveau 3.',
    check: (p) => p.refugeLevel >= 3,
    reward: { reforge: true },
  },
  {
    id: 'ceux_restent',
    title: 'Ceux qui restent',
    order: 2,
    start: 'premiers_jours:done',
    states: ['active'],
    hint: 'Trouve une voix dans la vallée.',
    objective: 'Trouver l enregistrement de la gare.',
    check: (p) => p.discoveries.includes('record_gare'),
    reward: { survivor: 'irma' },
  },
  {
    id: 'la_porte',
    title: 'La porte qui ne ferme plus',
    order: 3,
    start: 'ceux_restent:done',
    states: ['active'],
    hint: 'Le Seuil est au centre de la vallée.',
    objective: 'Affronter Le Gardien de seuil.',
    check: (p) => p.bosses.includes('gardien'),
    reward: { unique: 'ward_of_the_house' },
  },
];

/* --------------------------------------------------------------- DIALOGUE -- */

/**
 * Les textes courts. Un dialogue de jeu est une transmission : on ne
 * garde que ce qui change l'etat du joueur ou du monde.
 */
export const LINES = {
  intro: [
    { who: 'narrator', text: 'Tu te reveilles avec une cle dans la main et rien pour expliquer pourquoi.' },
    { who: 'narrator', text: "La maison est a deux kilometres. Tu connais le chemin des yeux. Tu ne te souviens pas l'avoir appris." },
    { who: 'narrator', text: 'Elle ne devrait pas etre encore la.' },
  ],
  arrivee: [
    { who: 'narrator', text: 'La porte s ouvre avant que ta main touche la serrure.' },
    { who: 'irma', text: "Elle a toujours fait ca. Elle ouvre avant. Je l'ai toujours trouvee comme ca." },
    { who: 'irma', text: "Moi je l'ai pas choisie. Toi, tu te rappelles pourquoi toi." },
  ],
  premiere_fois: [{ who: 'irma', text: 'Reviens quand tu auras quelque chose a rapporter. Ne me rapporte pas du vide.' }],
  garde: [
    { who: 'narrator', text: "Le seuil ne te repousse pas. C'est nouveau." },
    { who: 'irma', text: 'Alors il t a reconnu. Ce qui veut dire que tu faisais partie de la liste.' },
  ],
  refus: [{ who: 'irma', text: 'Trop tot. L atelier attend.' }],
  epuise: [{ who: 'irma', text: 'Tu trembles encore. Bois avant de partir.' }],
};

/* -------------------------------------------------- BIBLE NARRATIVE -- */

/**
 * Registre de coherence. Toute revelation future doit s'y inscrire.
 * Etabli = vrai dans l'univers. Hypothese = ce que le joueur croit.
 * Secret = vrai pour l'auteur, jamais prononce tel quel.
 */
export const CANON = {
  etabli: [
    "Une catastrophe sans cause identifiee a efface une grande partie de l'humanité.",
    "La maison du protagoniste resiste a certains phenomenes, ce qui est anormal.",
    "Le protagoniste connait le chemin sans avoir de souvenir de l'avoir appris.",
    'Un groupe auto-intitule les Veilleurs controle une route et refuse de laisser passer.',
    "Les Voix de l'enregistrement sont en desaccord sur ce qui est arrive.",
  ],
  hypotheses: [
    "La maison choisis ses occupants au lieu de les.selectionner au hasard.",
    'Les phenomenes ont reagi a la maison, pas l inverse.',
    "Le protagoniste a deja ete la avant la catastrophe — et a oublie.",
  ],
  secrets: [
    'Le Gardien de seuil etait un gardien humain.',
    "La cle du protagoniste n ouvre pas la porte : elle la retient.",
    "Le refuge n est pas un abri : c est un point de rendez-vous.",
  ],
  interdits: [
    "Ne jamais expliquer pourquoi le monde s est arrete : c'est le moteur de l'intrigue, pas son resultat.",
    'Ne jamais faire parler un ennemi : un mort-vivant qui explique retire la menace.',
    "Ne jamais nommer la catastrophe avant la Bete.",
  ],
};

/** Decouvertes : chacune doit porter une contradiction, pas une recompense. */
export const DISCOVERIES = {
  note_pile: {
    id: 'note_pile',
    title: 'Une pile de tickets de ration',
    text: 'Comptes soigneusement. Onze pour douze personnes. Quelquun ne prevoyait pas la catastrophe : il la prevoyait.',
    contradicts: 'hypotheses',
  },
  record_gare: {
    id: 'record_gare',
    title: 'Enregistrement 04 — « le seuil »',
    text: '« ...ils ont coupe la route des Veilleurs pour que personne n arrive jusqu a la maison. Et personne n arrive jusqu a la maison. C est peut-etre le meme probleme. »',
    contradicts: 'etabli',
    unlocks: 'ceux_restent',
  },
  note_puits: {
    id: 'note_puits',
    title: 'Fiche d enterrement',
    text: 'Nom : gardin du seuil. Cause : exposition. Note de l armee : « ne pas creuser plus profond ».',
    contradicts: 'secrets',
  },
  banniere_veilleurs: {
    id: 'banniere_veilleurs',
    title: 'Banniere des Veilleurs',
    text: 'UN SEUL PASSE. Ils comptabilisent les passages, pas les personnes. La liste doit exister.',
    contradicts: 'secrets',
  },
};