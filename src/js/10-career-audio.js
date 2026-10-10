/* ==== 10-career-audio.js — Carrière, audio, réglages par défaut ==== */
/* ============ CARRIÈRE : la colonne vertébrale du jeu ============
   6 rangs, chacun avec une exigence. Le rang 6 = fin de partie (victtoire).
   Les rangs bas paient mal mais risquent peu ; plus tu montes, plus ça paie
   et plus la police te regarde. */
const RANKS=[
 {nom:'Petit dealer',ico:'🌱',xp:0,   pay:.75,risk:.7, req:()=>'Premier plant récolté',        ok:()=>S.harvested>=1},
 {nom:'Régulier',  ico:'🌿',xp:120, pay:.9, risk:.9, req:()=>'150 € gagnés + 3 clients',     ok:()=>S.totalEarned>=150&&S.clients>=3},
 {nom:'Tricheur',   ico:'⚡',xp:340, pay:1.05,risk:1.1,req:()=>'500 € + réputation 3',        ok:()=>S.totalEarned>=500&&S.rep>=3},
 {nom:'Réseau',    ico:'🕸️',xp:750, pay:1.2, risk:1.35,req:()=>'1 500 € + 10 livraisons',    ok:()=>S.totalEarned>=1500&&S.delivered>=10},
 {nom:'Figure',    ico:'👑',xp:1400,pay:1.4, risk:1.7, req:()=>'4 000 € + réputation 10',     ok:()=>S.totalEarned>=4000&&S.rep>=10},
 {nom:'Légende',   ico:'🏆',xp:2400,pay:1.7, risk:2.1, req:()=>'8 000 € + tous les quartiers',ok:()=>S.totalEarned>=8000&&S.rep>=14},
];
const rankIdx=()=>{let i=0;for(let k=0;k<RANKS.length;k++)if(S.rankXp>=RANKS[k].xp)i=k;return i;};
const rankNext=()=>RANKS[Math.min(RANKS.length-1,rankIdx()+1)];
const payMul=()=>RANKS[rankIdx()].pay;
const rankRisk=()=>RANKS[rankIdx()].risk;
const MISSIONS=['Récolte ton 1er plant ✂️','Approche un client 🧍','Vends 5g au total 💰','Stocke 10g à la planque 📦','Monte sur le vélo 🚲','Négocie un prix 😏','Gagne 500 € au total 💵','Échappe aux flics après un deal 🚨','Livre 5 clients 📦','Atteins 3 étoiles et survis ⭐','Possède 30g en tout 🫙','Atteins le niveau 5 🏆','Livre une commande chronométrée 📦','Change de style 😎','Survis un jour complet 🌞','Récolte un lot Premium 🏅','Ouvre le Marché 🛒','Réputation Arrangé (5) ⭐','Monte au rang Tricheur ⚡','Gagne 1500 € au total 💵','Agrandis ta planque 🧰','Crée ta première mutation 🧬','Croise deux souches 🧬','Survis un contrôle à domicile 🚓','Vends à un client VIP 💎',
'Tiens un cycle 18 h/6 h 🌗','Séche un lot avant de vendre 🌬️','Traite une invasion de ravageurs 🐛','Règle ta première facture d\'électricité ⚡',
'Acte un mouchard 🕵️','Achète le silence d\'un flic 🤝','Passe un barrage avec un passe 🎫'];
const TUTO=[['🏠 Ta chambre de culture','Entre par la <b>porte de la maison</b> (le toit s\'ouvre tout seul). Plante, arrose, engraisse, garde le <b>pH vers 6.0</b> et surveille les <b>ravageurs</b>. Ton 1er plant est <b>déjà prêt</b> !'],
['🌗 Cycle 18 h / 6 h','Les plantes ne poussent qu\'**en lumière**. Le bouton <b>🕗 Cycle</b> décale l\'allumage, <b>🔌 Courant</b> coupe le jus (plus de croissance, mais zéro facture).'],
['🌬️ Séchage & électricité','Après la coupe, le lot part en <b>séchage (6 h)</b> sur le séchoir : impossible de vendre avant. Les rampes consomment ~2,5 kW : la facture tombe régulièrement.'],
['🕵️ Rôle réseau','Les <b>barrages routiers</b> apparaissent à 3★ (passe ou 60 €). Un <b>mouchard</b> réduit la vigilance des flics ; en pleine course, tu peux acheter leur silence 250 €.'],
['🧍 Vends dans la rue','Suis les <b>!</b> jaunes. Approche → <b>Vendre</b>. Les 🎉 paient bien, les 😟 partent si un flic approche. <b>Négocie</b> pour +12%.'],
['🚓 Flics & planques','Cônes rouges = vision, <b>?</b> = soupçon. <b>Buissons 🌿</b> = caché, <b>garage 🏠</b> = planque : dépose ton stock, il est à l\'abri.'],
['🚲 Le vélo','Un <b>vélo</b> t\'attend près de la maison : 2x plus vite pour livrer… et semer les flics !']];
/* réglages par défaut — tout est modifiable en jeu, et survit aux sauvegardes */
const DEFOPT={vol:1,volMusic:.7,volSfx:1,
  quality:'auto',          // auto | eco | std | high
  shadows:true,bloom:true,grain:true,
  fov:58,sens:1,invertX:false,camDist:7.5,
  textScale:1,contrast:false,cbMode:false,noShake:false,vibrate:true,leftHand:false,
  autoSave:true,showHints:true};
function def(){return{money:150,stock:0,stash:0,qSum:0,xp:0,level:1,wanted:0,totalSold:0,totalEarned:0,clients:0,grown:0,harvested:0,escaped:0,haggled:0,maxWanted:0,metClient:false,rode:false,sel:4,mission:0,tuto:0,sound:true,music:true,rain:false,hq:true,lawT:0,hour:22,dayN:1,playT:0,delivered:0,bustedN:0,styled:false,strainSel:0,hoodie:0,rep:0,rentIn:3,
rankXp:0,seeds:{classique:3,express:0,purple:0},stashMax:40,won:false,bustStreak:0,weather:'clear',weatherT:60,rescues:0,
genomes:[],geneLab:0,mutChance:.12,timeScale:1,
/* champs ajoutés après coup — déclarés ici pour être sérialisés dès la 1re sauvegarde */
bestGrade:'',district:'bloc',muts:0,raids:0,rentPaid:0,rushT:0,broke:false,grade:'B',crossed:0,vipSold:0,
up:{xl:false,turbo:false,look:false},bike:{x:-4.5,z:2},rivalCd:30,
/* --- réalité de la culture et du quartier --- */
lightStart:8,          // heure d'allumage des grow (cycle 18/6)
powerOn:true,          // coupe le courant des grow
kWh:0,powerPaid:0,     // consommation/facture d'électricité
drying:[],             // lots en séchage : {g,grade,t,need,pH}
wet:0,                 // herbe encore humide (vendue moins cher)
informants:0,informantT:0,  // mouchards achetés (temps restant)
passes:0,              // passes de barrage routier
opt:Object.assign({},DEFOPT),
veh:{},                // véhicules achetés : {id:{own,fuel,x,z,ry}}
/* --- intérieurs : Mercato et Douane --- */
coat:false,            // capuche : les flics te voient de moins loin
sealed:false,          // scellés customs : saisie réduite de moitié
bond:0,marketMap:false,tipBought:false,jobs:null,jobSeq:0,
daily:null,week:null,
bank:0,vault:false,papers:false,filed:false,charmT:0,
crookCd:0,             // délai avant de pouvoir corrompre un flic
roadblockT:0,searchT:0,
pots:Array.from({length:6},()=>({g:0,w:60,n:60,h:100,planted:false,ready:false,s:0,gx:null,fragile:false,pH:6,pest:false}))};}
const SAVE_KEY='hoodgrow_v3';
let S;
try{
  localStorage.removeItem('hoodgrow_v1');localStorage.removeItem('hoodgrow_v2');
  const s=JSON.parse(localStorage.getItem(SAVE_KEY));
  if(s&&Array.isArray(s.pots)&&s.pots.length===6){
    // Object.assign(def(), s) doit précéder : les valeurs du save écrasent
    // les valeurs par défaut, sinon tout le progress disparaît au rechargement.
    S=Object.assign(def(),s);
    S.up=Object.assign(def().up,s.up||{});
    S.bike=Object.assign(def().bike,s.bike||{});
    // fusion profonde des pots : conserve l'état, répare les champs manquants
    for(let i=0;i<6;i++){
      const p=s.pots[i]||{};
      S.pots[i]=Object.assign({g:0,w:60,n:60,h:100,planted:false,ready:false,s:0},p);
      if(!Number.isFinite(S.pots[i].g)||S.pots[i].g<0||S.pots[i].g>100)S.pots[i].g=0;
      S.pots[i].w=Math.max(0,Math.min(100,S.pots[i].w||0));
      S.pots[i].n=Math.max(0,Math.min(100,S.pots[i].n||0));
      S.pots[i].s=Math.max(0,Math.min(STRAINS.length-1,S.pots[i].s|0));
      // réalité culture : pH et ravageurs
      S.pots[i].pH=Number.isFinite(S.pots[i].pH)?Math.max(4,Math.min(8,S.pots[i].pH)):6;
      S.pots[i].pest=!!S.pots[i].pest;
    }
    S.money=Number.isFinite(S.money)?Math.max(0,S.money):150;
    S.hour=Math.max(0,Math.min(23.99,Number.isFinite(S.hour)?S.hour:22));
    S.rep=Math.max(0,Math.min(30,S.rep|0));
    S.qSum=Math.max(0,Number.isFinite(S.qSum)?S.qSum:0);
    S.muts=S.muts|0;S.rentPaid=S.rentPaid|0;S.rescues=S.rescues|0;
    // ADN persistés : on filtre les ids invalides après avoir reconstruit le registre
    if(!Array.isArray(S.genomes))S.genomes=[];
    S.genomes=S.genomes.filter(g=>Number.isInteger(g)&&g>=0&&g<ADN.length);
    S.mutChance=Number.isFinite(S.mutChance)?Math.max(.02,Math.min(.3,S.mutChance)):.12;
    S.timeScale=[1,2,4].includes(S.timeScale)?S.timeScale:1;
    S.lightStart=Number.isFinite(S.lightStart)?Math.max(0,Math.min(23,S.lightStart)):8;
    S.powerOn=S.powerOn!==false;
    S.drying=Array.isArray(S.drying)?S.drying.filter(d=>d&&Number.isFinite(d.g)).slice(0,6):[];
    S.wet=Math.max(0,Number.isFinite(S.wet)?S.wet:0);
    S.informants=Math.max(0,S.informants|0);
    S.passes=Math.max(0,S.passes|0);
  } else S=def();
}catch{S=def();}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));}catch{}}
/* progression : XP de rang (gagné sur les gains d'argent), promotion, victoire */
function addRankXp(n){S.rankXp+=n;
 const before=rankIdx(),cur=rankIdx();
 if(cur>before){const r=RANKS[cur];
  toast('🏅 Promotion : <b>'+r.nom+'</b> ! Paiement ×'+r.pay+' • risque ×'+r.risk,'gold');
  confettiLite();sndBlip(880);missionCheck();}
 // victoire : rang max atteint ET condition remplie
 checkWin();}
/* la victoire est réévaluée à chaque tick : la condition peut devenir vraie
   sans que le joueur gagne exactement le montant manquant sur un seul deal. */
function checkWin(){
 if(S.won)return;
 if(S.rankXp>=RANKS[RANKS.length-1].xp&&RANKS[RANKS.length-1].ok())winGame();}
/* confettis — déclarés avant la victoire qui les utilise */
function confettiLite(n=70){
 const c=document.createElement('canvas');c.width=innerWidth;c.height=innerHeight;
 c.style.cssText='position:fixed;inset:0;z-index:70;pointer-events:none';
 document.body.appendChild(c);const x=c.getContext('2d');
 const cols=['#3ddc74','#ffd166','#ff6fb5','#4cc3ff','#b892ff'];
 const P=Array.from({length:n},()=>({x:Math.random()*c.width,y:-Math.random()*80,
  vx:(Math.random()-.5)*3,vy:2+Math.random()*3,s:5+Math.random()*6,
  col:cols[Math.floor(Math.random()*cols.length)],r:Math.random()*6.28}));
 let f=0;(function anim(){
  x.clearRect(0,0,c.width,c.height);f++;
  P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.r+=.12;
   x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.col;x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);x.restore();});
  if(f<85)requestAnimationFrame(anim);else c.remove();})();}
/* bouton carrière : récapitulatif au toast, ne masque pas la scène */
function careerInfo(){const r=RANKS[rankIdx()],nx=rankNext();const rx=repTier();
 const lines=[];
 lines.push('🏅 Rang : '+r.ico+' '+r.nom+' (paie ×'+r.pay+' • risque ×'+r.risk+')');
 lines.push('⭐ Réputation : '+REPNAME[rx]+' ('+S.rep+')');
 lines.push(rankIdx()<RANKS.length-1
  ?'↑ Suivant : '+nx.nom+' — '+Math.max(0,Math.ceil(nx.xp-S.rankXp))+' € à gagner'
  :'🏆 Objectif légende : '+r.req());
 lines.push('📊 '+Math.round(S.totalEarned)+' € • '+S.clients+' clients • '+S.harvested+' plants • '+
  S.delivered+' livraisons • '+S.bustedN+' amendes • '+S.escaped+' évasions');
 toast(lines.join('<br>'),'gold',6500);sndBlip(720);}
function winGame(){if(S.won)return;S.won=true;save();
 $('winTitle').textContent='🏆 '+RANKS[RANKS.length-1].nom;
 $('winStats').innerHTML='<b>'+Math.round(S.totalEarned)+' €</b> gagnés • '+S.clients+' clients • '+
  S.delivered+' livraisons • '+S.harvested+' plants • '+S.escaped+' évasions • '+S.bustedN+' amendes<br>'+
  '<small>Le hood parle de toi. La légende du bloc, c\'est toi.</small>';
 switchSheet('winSheet');confettiLite(120);sndBlip(990);}
/* planque : capacité limitée, la réserve se remplit */
/* la planque s'agrandit avec la réputation ET avec le coffre du véhicule conduit */
const stashCap=()=>Math.round(S.stashMax+repTier()*15+trunkBonus());
function pushStash(g){const cap=stashCap();const room=Math.max(0,cap-S.stash);
 if(g<=room){S.stash+=g;return g;}
 S.stash+=room;return room;}
const $=id=>document.getElementById(id);
function toast(m,cls='',ms=2400){const d=document.createElement('div');d.className='toast '+cls;d.innerHTML=m;$('toasts').appendChild(d);setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .4s';setTimeout(()=>d.remove(),400)},ms);}
function vib(m=15){try{const o=(typeof S!=='undefined'&&S.opt)?S.opt:null;
 if((!o||o.vibrate)&&navigator.vibrate)navigator.vibrate(m);}catch{}}
/* ---- audio ---- */
/* états globaux de la boucle — déclarés tôt : la musique et le rendu
   les lisent avant que le module soit entièrement évalué. */
let paused=false,bustLock=false,chase=false;
const growLights=[];   // lumières de la chambre de culture (cf. applySky)
const growLEDs=[];     // rampes LED : elles s'éteignent vraiment la nuit
let wasLit=null;       // compte les cycles complets
let dryRack=null;      // séchoir : un lot suspendu par séchage en cours
let roomLight=null;     // plafonnier de la maison
let fill=null;          // lumière d'appoint : allumée seulement à l'intérieur
/* --- mesure de fluidité : sert au mode « qualité auto » et à l'adaptation mobile --- */
let FPSLOW=false,_fpsAcc=0,_fpsN=0;
function fpsTick(dt){
 _fpsAcc+=dt;_fpsN++;
 if(_fpsAcc>=2){const f=_fpsN/_fpsAcc;_fpsAcc=0;_fpsN=0;
  FPSLOW=f<24;
  const q=S.opt||DEFOPT;
  // en auto seulement, on rétrograde puis on remonte si ça respire à nouveau
  if(q.quality==='auto'&&FPSLOW!==applyOpts._low){applyOpts._low=FPSLOW;applyOpts();}}}
/* bus audio : volume général, effets, musique — c'est ce qui permet les curseurs */
let BUS=null;
function bus(){
 const a=ac();if(!a)return null;
 if(!BUS){
  const m=a.createGain(),s=a.createGain(),u=a.createGain();
  s.connect(m);u.connect(m);m.connect(a.destination);BUS={master:m,sfx:s,music:u};}
 return BUS;}
function dest(name){const B=bus();return B?(name==='music'?B.music:B.sfx):null;}
function setVol(){
 const B=bus();if(!B)return;
 const q=S.opt||DEFOPT;
 B.master.gain.value=clamp01(q.vol==null?1:q.vol);
 B.sfx.gain.value=clamp01(q.volSfx==null?1:q.volSfx);
 B.music.gain.value=clamp01(q.volMusic==null?1:q.volMusic);}
let AC=null;function ac(){try{if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();return AC;}catch{return null;}}
function tone(f,d=.15,type='sine',v=.09,when=0,name='sfx'){if(!S.sound)return;const a=ac();if(!a)return;const t=a.currentTime+when;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);const d2=dest(name)||a.destination;o.connect(g).connect(d2);o.start(t);o.stop(t+d+.02);}
function sndCash(){sfxCoin();}
function sndBlip(f=600){tone(f,.15,'sine',.09);}
let sirenTimer=null;
function sirenStart(){if(sirenTimer||!S.sound)return;let hi=false;sirenTimer=setInterval(()=>{tone(hi?880:660,.35,'sawtooth',.035);hi=!hi;},380);}
function sirenStop(){if(sirenTimer){clearInterval(sirenTimer);sirenTimer=null;}}
/* ===== AUDIO : musique adaptative + bruitages =====
   3 états musicaux : calme (jour, pas de flics), tendu (nuit), poursuite. */
const MUS={
 calm:{bpm:110,root:110,scale:[1,1.2,1.5,1.8],wave:'triangle',vol:.030},
 tendu:{bpm:96,root:98,scale:[1,1.19,1.5,1.78],wave:'sawtooth',vol:.026},
 chase:{bpm:138,root:123,scale:[1,1.26,1.5,1.89],wave:'square',vol:.034},
};
let musState='calm',musi=0,musTimer=null;
function currentMusic(){return chase?MUS.chase:(S.wanted>=2||S.hour<6||S.hour>21?MUS.tendu:MUS.calm);}
function musTick(){
 if(!S.music||!S.sound||paused||bustLock)return;
 const M=currentMusic();
 if(musState!=='block'){ /* état mis à jour dans setMusicState */ }
 const beat=60/M.bpm/2;
 const i=musi%M.scale.length;
 tone(M.root*M.scale[i],beat*.9,M.wave,M.vol,0,'music');
 if(musi%4===0)tone(M.root*.5,beat*1.6,'sine',M.vol*.6,0,'music');
 if(musi%2===1)tone(M.root*M.scale[(i+2)%M.scale.length]*2,beat*.5,'sine',M.vol*.35,0,'music');
 musi++;
}
function setMusicState(s){ // évite de changer d'harmonie en pleine mesure
 if(s===musState)return;musState=s;}
function startMusic(){if(musTimer)return;musTimer=setInterval(musTick,420);}
