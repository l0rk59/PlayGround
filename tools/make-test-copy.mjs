/* Prépare une COPIE de test du jeu avec un hook window.__H.
   La production (index.html à la racine) n'est jamais modifiée. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, cpSync, rmSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url).pathname;
const BUILD = ROOT + '.testbuild/';
mkdirSync(BUILD, { recursive: true });
copyFileSync(ROOT + 'three.module.js', BUILD + 'three.module.js');

let s = readFileSync(ROOT + 'index.html', 'utf8');
// les modules de post-traitement (vendor/) sont aussi nécessaires à la copie
rmSync(BUILD + 'vendor', { recursive: true, force: true });
cpSync(ROOT + 'vendor', BUILD + 'vendor', { recursive: true });
if (s.includes('window.__H')) { console.log('hook déjà présent (copie à jour) : rien à faire'); process.exit(0); }

const HOOK = `window.__T=THREE;window.__H={HOME,HW,HD,HH,DOORW,GARDEN,get player(){return player},
 get houseOpen(){return houseOpen},isIndoors,
 get roofVisible(){return houseRoof?houseRoof.visible:null},
 get wallOpacity(){return wallMats.length?wallMats[0].opacity:-1},solids,THREE,scene,camera,S,save,
 renderer,CARS,WALKERS,applyQ,applySky,shadowTick,drawMap,trafficTick,walkerTick,
 copTick,growTick,growTick2,dryTick,updateInteract,openGrow,renderGrow,harvestPot,
 lightOn,lightPhase,phMul,phLabel,roomPowerKW,informantActive,INFORMANT_COST,buyInformant,
 bribeCop,crookableCop,blockNear,passRoadblock,roadblockTick,
 copsArray:cops,roadblocks,chaseRef:()=>chase};`;

const anchor = 'requestAnimationFrame(animate);';
const i = s.lastIndexOf(anchor);
if (i < 0) throw new Error('ancre requestAnimationFrame(animate); introuvable');
s = s.slice(0, i + anchor.length) + '\n' + HOOK + s.slice(i + anchor.length);
writeFileSync(BUILD + 'index.html', s);
console.log('copie de test prête :', BUILD + 'index.html', '(' + s.length + ' octets)');
if (!existsSync(BUILD + 'three.module.js')) throw new Error('three.module.js manquant');
