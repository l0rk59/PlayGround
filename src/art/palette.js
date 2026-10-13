/**
 * BIBLE ARTISTIQUE — version executable.
 *
 * Trois disciplines verrouillees ici, conformes a la recherche sur la
 * lisibilite d'un jeu d'action sur petit ecran :
 *
 *  1. LA VALEUR AVANT LA COULEUR. L'oeil lit d'abord la clarte, ensuite la
 *     teinte, en dernier la saturation. Toute la hierarchie de lecture est
 *     donc codee en bandes de valeur (0..1), la teinte n'arrive qu'ensuite.
 *     Test de controle : passer la scene en gris doit encore fonctionner.
 *
 *  2. UN SEUL VECTEUR DE LUMIERE. En vue de dessus 2.5D, la lumiere vient
 *     du haut-gauche, ~40 degres d'elevation. Tout volume est construit sur
 *     trois faces : sommet clair, face basse-droite moyenne, face
 *     gauche-sombre. Un objet qui n'obeit pas a cette regle « colle » au sol.
 *
 *  3. DES COULEURS RESERVEES. Le rouge signifie degats, l'ambre signifie
 *     interactif, le cyan signifie anomalie, le vert signifie soin. Aucune
 *     decoration ne peut s'approprier ces teintes sans casser la formation
 *     du joueur.
 *
 * Regle de composition : 60 % de masse dominante, 30 % secondaire,
 * 10 % d'accent qui porte le regard.
 */

import { clamp, lerp } from '../core/util.js';

/* ------------------------------------------------------------- VALEURS -- */

export const VALUE = {
  VOID: 0.04,
  OUTLINE: 0.07,
  GROUND_DARK: 0.15,
  GROUND: 0.2,
  GROUND_LIGHT: 0.26,
  DETAIL_LOW: 0.3,
  DETAIL: 0.36,
  PROP_DARK: 0.12,
  PROP_MID: 0.34,
  PROP_LIT: 0.58,
  HERO_LIT: 0.82,
  GLOW: 0.95,
};

/**
 * Bandes de valeur. Regle production : les bandes ne se recouvrent JAMAIS.
 * Sol = la page, doit pouvoir etre ennuyeux. Props = les extremes.
 */
export const BAND = {
  GROUND: [VALUE.GROUND_DARK, VALUE.GROUND_LIGHT],
  DETAIL: [VALUE.DETAIL_LOW, VALUE.DETAIL],
  PROP: [VALUE.PROP_DARK, VALUE.PROP_LIT],
  HERO: [VALUE.PROP_MID, VALUE.GLOW],
};

/* ------------------------------------------------------------- LUMIERE -- */

/** Lumiere directionnelle unique. Tout le decor en decoule. */
export const LIGHT = {
  /** Vecteur de lumiere (ecran) : haut-gauche. */
  x: -0.7071,
  y: -0.7071,
  /** Elevation en degres -> longueur d'ombre par unite de hauteur. */
  elevationDeg: 40,
  get shadowRatio() {
    return 1 / Math.tan((this.elevationDeg * Math.PI) / 180);
  },
};

/** Les trois faces d'un volume, derivées du vecteur de lumiere. */
export const FACE = { TOP: 'top', RIGHT: 'right', LEFT: 'left' };

/** Facteur de valeur applique a une face donnee. */
export const FACE_VALUE = { top: 1.0, right: 0.66, left: 0.42 };

/**
 * Ecart de valeur impose entre une entite et le sol. En dessous, l'entite
 * « colle » au decor et le joueur ne la voit plus — c'est le defaut le plus
 * courant en vue de dessus.
 */
export const VALUE_SEPARATION = {
  HERO: 0.34,
  PROP: 0.2,
  THREAT: 0.26,
};

/* --------------------------------------------------------- TEINTES FRAIS -- */

export const HUE = {
  /** Cendres froides du monde exterieur. */
  ASH: 214,
  /** Terre humide, sous-bois mort. */
  EARTH: 28,
  /** Bois du refuge, lueur de lampe. */
  EMBER: 32,
  /** Anomalie : le phenomene qui resiste. */
  ANOMALY: 186,
  /** Corruption : ce qui a ete touche. */
  ROT: 292,
  /** Sanglee, sang, metal rouille. */
  IRON: 6,
};

/**
 * COULEURS RESERVEES. Usage exclusif ; toute decoration qui les utilise
 * sans fonction de gameplay ment le joueur sur l'etat du monde.
 */
export const SEMANTIC = {
  DANGER: '#e2483d',
  DANGER_SOFT: '#f0776c',
  INTERACT: '#f0b429',
  INTERACT_SOFT: '#ffd978',
  ANOMALY: '#4fd6c8',
  ANOMALY_DEEP: '#1d6f78',
  HEAL: '#7de08a',
  BOSS: '#a483ff',
  PLAYER: '#e8eaf0',
  COMPANION: '#9fd9c4',
};

/**
 * Assombrit/ebclaircit une couleur par un facteur de VALEUR.
 *
 * On manipule la clarte, jamais la teinte ni la saturation : c'est la
 * discipline du projet. La palette du jeu est majority en `hsl()`, il faut
 * donc gerer les deux ecritures — sinon un `parseInt` sur du HSL renvoie
 * du NaN et le canevas ne dessine plus rien.
 */
export function shade(css, factor) {
  const f = clamp(factor, 0, 2);
  if (css.startsWith('#')) {
    const n = parseInt(css.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return `rgb(${ch.map((c) => Math.round(clamp(c * f, 0, 255))).join(',')})`;
  }
  const m = css.match(/hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (m) {
    const l = clamp(Number(m[3]) * f, 0, 100);
    return `hsl(${m[1]} ${m[2]}% ${round1(l)}%)`;
  }
  if (css.startsWith('rgb')) {
    const parts = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    return `rgb(${parts.slice(0, 3).map((c) => Math.round(clamp(c * f, 0, 255))).join(',')})`;
  }
  return css;
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Valeur -> gris, pour le test de lisibilite en noir et blanc. */
export const toGrey = (css, value) => {
  const n = parseInt(css.slice(1), 16);
  const l = ((n >> 16) & 255) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722;
  const g = Math.round(clamp(l * value, 0, 255));
  return `rgb(${g},${g},${g})`;
};

/**
 * Construit une couleur depuis (teinte, saturation, VALEUR).
 * C'est l'ordre impose par la discipline : la valeur d'abord.
 */
export function tone(hue, sat, value) {
  return `hsl(${((hue % 360) + 360) % 360} ${Math.round(clamp(sat, 0, 100))}% ${Math.round(
    clamp(value, 0, 1) * 100,
  )}%)`;
}

/** Applique la rampe de valeurs d'une bande a une teinte. */
export function ramp(hue, sat, band, t = 0.5) {
  const [lo, hi] = BAND[band] ?? band;
  return tone(hue, sat, lerp(lo, hi, clamp(t, 0, 1)));
}

export function rgba(css, alpha) {
  if (css.startsWith('#')) {
    const n = parseInt(css.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  return css.replace('hsl(', 'hsla(').replace(')', ` / ${alpha})`);
}

/* --------------------------------------------------------------- ZONES -- */

/**
 * Zones = cles de couleur du monde. Chaque zone est decrite comme une
 * RELATION valeur/temperature, pas comme une liste de hex : on peut
 * re-teinter une zone sans casser sa structure de valeurs.
 */
export const ZONES = {
  valley: {
    id: 'valley',
    seed: 20251012,
    name: 'La Vallee Fracturee',
    sky: tone(HUE.ASH, 22, 0.14),
    fog: tone(HUE.ASH, 16, 0.22),
    ground: tone(HUE.ASH, 16, VALUE.GROUND),
    groundAlt: tone(HUE.EARTH, 18, VALUE.GROUND_LIGHT),
    detail: tone(HUE.ASH, 20, VALUE.DETAIL),
    vegetation: tone(HUE.ASH, 10, 0.28),
    ambient: tone(HUE.ASH, 24, 0.18),
    keyLight: tone(HUE.ASH, 26, 0.44),
    contrast: 0.42,
    fogDensity: 0.5,
  },
  ash: {
    id: 'ash',
    seed: 777001,
    name: 'La Cendrerie',
    sky: tone(HUE.ASH, 14, 0.16),
    fog: tone(HUE.ASH, 12, 0.24),
    ground: tone(HUE.EARTH, 14, VALUE.GROUND_LIGHT),
    groundAlt: tone(HUE.EARTH, 18, VALUE.GROUND),
    detail: tone(HUE.EARTH, 20, VALUE.DETAIL),
    vegetation: tone(HUE.EARTH, 14, 0.3),
    ambient: tone(HUE.EMBER, 22, 0.18),
    keyLight: tone(HUE.EMBER, 42, 0.42),
    contrast: 0.4,
    fogDensity: 0.35,
  },
  anomaly: {
    id: 'anomaly',
    seed: 424242,
    name: 'La Faille',
    sky: tone(HUE.ANOMALY, 26, 0.09),
    fog: tone(HUE.ANOMALY, 34, 0.14),
    ground: tone(HUE.ANOMALY, 14, VALUE.GROUND_DARK),
    groundAlt: tone(HUE.ROT, 18, VALUE.GROUND_DARK),
    detail: tone(HUE.ANOMALY, 40, VALUE.DETAIL),
    vegetation: tone(HUE.ROT, 24, 0.22),
    ambient: tone(HUE.ANOMALY, 40, 0.13),
    keyLight: tone(HUE.ANOMALY, 60, 0.46),
    contrast: 0.52,
    fogDensity: 0.7,
  },
  refuge: {
    id: 'refuge',
    seed: 91337,
    name: 'Le Refuge',
    sky: tone(HUE.EMBER, 20, 0.1),
    fog: tone(HUE.EMBER, 24, 0.16),
    ground: tone(HUE.EARTH, 26, VALUE.GROUND),
    groundAlt: tone(HUE.EMBER, 24, VALUE.GROUND_DARK),
    detail: tone(HUE.EMBER, 32, VALUE.DETAIL),
    vegetation: tone(HUE.EMBER, 28, 0.3),
    ambient: tone(HUE.EMBER, 46, 0.24),
    keyLight: tone(HUE.EMBER, 68, 0.62),
    contrast: 0.46,
    fogDensity: 0.22,
  },
};

/* ------------------------------------------------------------- SILHOUETTES -- */

/**
 * Silhouettes par acteur. Une silhouette lisible a 24 px de haut est un
 * contrat, pas une preference : c'est ce que le joueur identifie avant tout
 * detail. La cle est l'ID de l'acteur — celui du contenu — et `shape`
 * indique la famille de forme construite par le rendu.
 *
 * Consequence directe a respecter : toute famille d'ennemis non listee ici
 * retombe sur `player`, et le joueur perd la distinction de forme.
 */
export const SILHOUETTE = {
  player: { shape: 'humanoid', w: 28, h: 42, r: 12 },
  rieur: { shape: 'humanoid', w: 26, h: 46, r: 13 },
  plethore: { shape: 'blob', w: 40, h: 34, r: 19 },
  pleureuse: { shape: 'tall', w: 24, h: 56, r: 11 },
  meute: { shape: 'quad', w: 40, h: 26, r: 17 },
  guetteur: { shape: 'blob', w: 56, h: 56, r: 28 },
  dog: { shape: 'quad', w: 32, h: 24, r: 13 },
  boss: { shape: 'tall', w: 92, h: 110, r: 42 },
};

/**
 * Verifie au chargement que le contenu et le rendu ne divergent pas. C'est
 * exactement le piege qui a produit des sprites vides : une famille declaree
 * dans `ENEMIES` mais absente de `SILHOUETTE`.
 */
export function silhouetteFor(id) {
  return SILHOUETTE[id] ?? null;
}

/**
 * Regle de lecture : ecart de valeur minimal par rapport au fond.
 * Sous ce seuil, l'element « colle » et devient du bruit visuel.
 */
export const READABILITY = {
  MIN_CONTRAST: 0.22,
  OUTLINE_WIDTH: 2,
  TELEGRAPH_MIN_MS: 420,
  HIT_STOP_MS: 55,
};