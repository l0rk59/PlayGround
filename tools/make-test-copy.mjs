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
 get houseOpen(){return houseOpen},isIndoors,setHouseOpen,get paused(){return paused},
 get roofVisible(){return houseRoof?houseRoof.visible:null},
 get wallOpacity(){return wallMats.length?wallMats[0].opacity:-1},solids,THREE,scene,camera,S,save,
 setCamYaw:(v)=>{camYaw=v;},mutate,cross,switchSheet,ADN,genomeOf,collide,pointInSolid,losBlocked,setWeather,renderer,CARS,WALKERS,applyQ,applySky,shadowTick,drawMap,trafficTick,walkerTick,
 copTick,growTick,growTick2,dryTick,updateInteract,openGrow,renderGrow,harvestPot,
 lightOn,lightPhase,phMul,phLabel,roomPowerKW,informantActive,INFORMANT_COST,buyInformant,
 bribeCop,crookableCop,blockNear,passRoadblock,roadblockTick,
 copsArray:cops,roadblocks,chaseRef:()=>chase,
  clients,openSell,startBluff,bluffStep,MOODS,moodOf,moodInfo,readAdvice,applyMoodPose,refreshSell,
  HALLS,hallMarket,hallDouane,hallBank,hallPolice,inHall,hallAt,setHallOpen,
  openMarche,openDouane,openBank,openPol,MSHOP,DSHOP,BANK,POL,mPrice,dPrice,renderBank,renderPol,STATIONS,nearStation,openMetro,takeMetro,renderMetro,metroTick,
  jobBoard,get nearJob(){return nearJob},activeJobs,deliverJob,failJob,renderJobs,openJobs,makeJob,refreshBoard,JOB_MAX,jobTick,
  copSight,get nearHall(){return nearHall},stashCap,
  VEH,vehList,vehOwned,vehData,vehFuel,vehTank,mountVeh,dismount,nearVeh,nearVehData,
  vehMeshRef,vehPark,vehFuelTick,rideNoise,trunkBonus,renderSafe,renderVeh,get player(){return player},
  opt,applyOpts,renderOpts,openOpts,setVol,qualityLevel,DEFOPT,addShake,shakeTick,shakeOK,dailyState,dailyTick,dailyReward,streakLabel,claimWeek,
  weekState,currentWeek,weekProgress,weekPct,tierIdx,currentTier,nextTier,tierPriceBonus,renderProg,openProg,TIERS,WEEK,DAILY_REW,priceMul,dest,bloomPass,gradePass,get FPSLOW(){return FPSLOW},get camDist(){return camDist},
  get sellTarget(){return sellTarget},get bluff(){return bluff},clientLine};`;

const anchor = 'requestAnimationFrame(animate);';
const i = s.lastIndexOf(anchor);
if (i < 0) throw new Error('ancre requestAnimationFrame(animate); introuvable');
s = s.slice(0, i + anchor.length) + '\n' + HOOK + s.slice(i + anchor.length);
writeFileSync(BUILD + 'index.html', s);
console.log('copie de test prête :', BUILD + 'index.html', '(' + s.length + ' octets)');
if (!existsSync(BUILD + 'three.module.js')) throw new Error('three.module.js manquant');
