/* ==== 20-monde.js — Monde 3D : quartiers, bâtiments, ciel ==== */
/* ============================================================
   SON : pas par surface, moteurs, ambiance de quartier
   Tout est synthétisé (WebAudio) : zéro fichier à charger.
   ============================================================ */
function clamp01(v){return v<0?0:v>1?1:v;}
function noiseBuffer(sec){const a=ac();if(!a)return null;
 const n=Math.floor(a.sampleRate*sec),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);
 for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
 return b;}
/* pas : le timbre du bruit dépend du sol (béton, asphalte, terre du parc) */
function sfxStep(){
 if(!S.sound)return;
 const a=ac();if(!a)return;
 const t=a.currentTime;
 const inPark=dist2(player.pos.x,player.pos.z,-30,22)<16;
 const nearRoad=Math.abs(player.pos.z-9)<5||Math.abs(player.pos.x-16)<5;
 const len=a.sampleRate*(inPark?.12:.075);
 const buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);
 for(let i=0;i<len;i++){const k=1-i/len;
  d[i]=(Math.random()*2-1)*k*(player.sneak?.22:.62)*(inPark?.7:1);}
 const src=a.createBufferSource();src.buffer=buf;
 const f=a.createBiquadFilter();
 f.type='lowpass';f.frequency.value=player.sneak?(inPark?260:340):(inPark?620:(nearRoad?1500:1100));
 if(inPark)f.Q.value=.6;
 const g=a.createGain();g.gain.value=player.sneak?.035:.11;
 src.connect(f);f.connect(g);g.connect(dest('sfx'));src.start(t);}
/* moteur : bruit filtré + fondamentale, hauteur pilotée par la vitesse */
function engineOn(){
 if(!S.sound||!ac())return null;
 const a=ac(),buf=noiseBuffer(2);
 const src=a.createBufferSource();src.buffer=buf;src.loop=true;
 const bp=a.createBiquadFilter();bp.type='bandpass';bp.frequency.value=130;bp.Q.value=3;
 const g=a.createGain();g.gain.value=0;
 const osc=a.createOscillator();osc.type='sawtooth';osc.frequency.value=60;
 const og=a.createGain();og.gain.value=0;
 src.connect(bp);bp.connect(g);g.connect(dest('sfx'));
 osc.connect(og);og.connect(dest('sfx'));
 src.start();osc.start();
 return {g,osc,og,bp};}
/* ambiance : le « souffle » de la ville, plus fort au Marché, quase muet au parc */
const amb={};
function ambienceTick(dt,now){
 if(!S.sound)return;
 const a=ac();if(!a)return;
 if(!amb._n){amb._n=noiseBuffer(3);amb._g=a.createGain();amb._g.gain.value=0;
  amb._f=a.createBiquadFilter();amb._f.type='lowpass';amb._f.frequency.value=260;
  const src=a.createBufferSource();src.buffer=amb._n;src.loop=true;
  src.connect(amb._f);amb._f.connect(amb._g);amb._g.connect(dest('sfx'));src.start();}
 const d=districtAt(player.pos.x,player.pos.z);
 const park=dist2(player.pos.x,player.pos.z,-30,22)<18;
 const night=1-daylight();
 let vol=.014+(d&&d.id==='marche'?.022:0)+(d&&d.id==='quais'?.016:0);
 if(park)vol*=.45;
 if(paused)vol*=.25;
 amb._g.gain.value=vol*(S.music?1:.7);
 amb._f.frequency.value=park?180:(260+90*night);
}
/* moteur du véhicule le plus proche : hauteur et volume selon sa vitesse */
function engineTick(dt){
 if(!S.sound||S.paused||player.riding)return;
 const a=ac();if(!a)return;
 if(!ENG.node){
  const n=engineOn();
  if(!n)return;
  ENG.node=n;ENG.car=null;ENG.next=0;
  ENG.node.g.gain.value=0;ENG.node.og.gain.value=0;}
 const n=ENG.node;
 // on choisit la voiture la plus proche du joueur, dans un rayon de 26 m
 let best=null,bd=26;
 for(const c of CARS){const d=Math.hypot(c.mesh.position.x-player.pos.x,c.mesh.position.z-player.pos.z);
  if(d<bd){bd=d;best=c;}}
 if(!best){ENG.next-=dt;if(ENG.next<=0){n.g.gain.value=0;n.og.gain.value=0;ENG.next=.5;}return;}
 ENG.next=1.2+Math.random()*1.6;   // on change de moteur de temps en temps
 ENG.car=best;
 const v=Math.abs(best.spd),f=55+v*7;
 n.osc.frequency.setTargetAtTime(f,a.currentTime,.12);
 n.bp.frequency.setTargetAtTime(120+v*14,a.currentTime,.2);
 n.g.gain.setTargetAtTime(.028*(1-bd/26),a.currentTime,.3);
 n.og.gain.setTargetAtTime(.01*(1-bd/26),a.currentTime,.3);}
const ENG={node:null,car:null,next:0};
function sfxDoor(){tone(180,.18,'square',.04);setTimeout(()=>tone(120,.22,'square',.03),90);}
function sfxEnginePass(){const a=ac();if(!a||!S.sound)return;
 const t=a.currentTime,buf=noiseBuffer(1.4),src=a.createBufferSource();src.buffer=buf;
 const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=260;f.Q.value=1.2;
 const g=a.createGain();
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.05,t+.5);
 g.gain.exponentialRampToValueAtTime(.001,t+1.3);
 const pan=a.createStereoPanner?a.createStereoPanner():null;
 src.connect(f);f.connect(g);
 if(pan){pan.pan.setValueAtTime(Math.random()*2-1,t);g.connect(pan);pan.connect(dest('sfx'));}
 else g.connect(dest('sfx'));
 src.start(t);src.stop(t+1.4);}

/* --- bruitages --- */
let lastStep=0;
/* (le pas est défini plus haut, avec la variante « sol ») */
function sfxRain(){if(!S.sound)return;const a=ac();if(!a)return;
 const t=a.currentTime,len=a.sampleRate*.4;
 const buf=a.createBuffer(1,len,a.sampleRate);const d=buf.getChannelData(0);
 for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
 const src=a.createBufferSource();src.buffer=buf;
 const f=a.createBiquadFilter();f.type='highpass';f.frequency.value=2200;
 const g=a.createGain();g.gain.value=.045;
 src.connect(f).connect(g).connect(dest('sfx'));src.start(t);}
function sfxAlarm(){if(!S.sound)return;const a=ac();if(!a)return;
 for(let k=0;k<3;k++){const t=a.currentTime+k*.35;
  const o=a.createOscillator(),g=a.createGain();o.type='square';o.frequency.setValueAtTime(880,t);
  o.frequency.linearRampToValueAtTime(660,t+.3);
  g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);
  o.connect(g).connect(dest('sfx'));o.start(t);o.stop(t+.32);}}
function sfxCoin(){if(!S.sound)return;const a=ac();if(!a)return;
 const t=a.currentTime;
 [1200,1800,2400].forEach((f,k)=>{const o=a.createOscillator(),g=a.createGain();
  o.type='sine';o.frequency.value=f;
  g.gain.setValueAtTime(.04,t+k*.05);g.gain.exponentialRampToValueAtTime(.001,t+k*.05+.12);
  o.connect(g).connect(dest('sfx'));o.start(t+k*.05);o.stop(t+k*.05+.14);});}
function sfxBust(){if(!S.sound)return;const a=ac();if(!a)return;
 const t=a.currentTime;
 const o=a.createOscillator(),g=a.createGain();o.type='sawtooth';
 o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(60,t+.7);
 g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.7);
 o.connect(g).connect(dest('sfx'));o.start(t);o.stop(t+.72);}
function gainXp(n){S.xp+=n;let need=S.level*120;while(S.xp>=need){S.xp-=need;S.level++;S.money+=80;need=S.level*120;toast('⭐ <b>Niveau '+S.level+' !</b> +80 €','gold');sndBlip(880);}}
/* missions : conditions */
const MCOND=[()=>S.harvested>=1,()=>S.metClient,()=>S.totalSold>=5,()=>S.stash>=10,()=>S.rode,()=>S.haggled>=1,()=>S.totalEarned>=500,()=>S.escaped>=1,()=>S.clients>=5,()=>S.maxWanted>=3,()=>(S.stock+S.stash)>=30,()=>S.level>=5,()=>S.delivered>=1,()=>S.styled,()=>S.playT>=240,()=>S.bestGrade==='A',()=>S.district==='marche',()=>S.rep>=5,()=>rankIdx()>=2,()=>S.totalEarned>=1500,()=>S.stashMax>40,()=>(S.muts|0)>=1,()=>(S.crossed|0)>=1,()=>(S.raids|0)>=1,()=>(S.vipSold|0)>=1,
 ()=>(S.cyclesDone|0)>=1,()=>(S.dried|0)>=1,()=>(S.pestsTreated|0)>=1,
 ()=>S.powerPaid>0,()=>(S.informantsBought|0)>=1,()=>(S.bribes|0)>=1,()=>(S.blockPassed|0)>=1];
function missionCheck(){while(S.mission<MISSIONS.length&&MCOND[S.mission]()){S.mission++;gainXp(25);toast('🎯 Mission accomplie !','gold');}}

