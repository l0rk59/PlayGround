/* ==== 50-personnages.js — Personnages articulés ==== */
/* ============ PERSONNAGES ARTICULÉS ============ */
/* --- anatomie : un adulte fait ~1,80 m ; les membres sont des segments pivotants --- */
const SKINM=()=>new THREE.MeshStandardMaterial({roughness:.72});
function limb(w,h,c,taper=.85){const g=new THREE.Group();
 const m=new THREE.Mesh(new THREE.CylinderGeometry(w*.5*taper,w*.5,h,7),
  new THREE.MeshStandardMaterial({color:c,roughness:.85}));
 m.position.y=-h/2;m.castShadow=true;m.receiveShadow=true;g.add(m);return g;}
function makePerson(shirt,pants=0x222a3a,skin=0xe8b98a){
 const g=new THREE.Group();
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.86});
 // bassin + torse : deux volumes, pas un gros capsule
 const hips=new THREE.Mesh(new THREE.CylinderGeometry(.19,.17,.2,9),mat(pants));hips.position.y=.94;g.add(hips);
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.21,.18,.52,9),mat(shirt));
 torso.position.y=1.3;torso.castShadow=torso.receiveShadow=true;g.add(torso);
 const shoulder=new THREE.Mesh(new THREE.CapsuleGeometry(.1,.42,3,8),mat(shirt));
 shoulder.rotation.z=Math.PI/2;shoulder.position.y=1.52;g.add(shoulder);
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.055,.06,.1,6),mat(skin));neck.position.y=1.6;g.add(neck);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.115,12,10),mat(skin));
 head.position.y=1.74;head.scale.set(.92,1.12,1);head.castShadow=true;g.add(head);
 // visage : deux yeux et une bouche, seulement lisibles de près mais ils changent tout
 const eyeM=new THREE.MeshBasicMaterial({color:0x1b1b20});
 [-1,1].forEach(sx=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.022,6,5),eyeM);
  e.position.set(sx*.042,1.762,.104);g.add(e);});
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.05,.008,.01),eyeM);
 mouth.position.set(0,1.695,.106);g.add(mouth);
 // cheveux / calotte : 3 variantes pour éviter l'effet « clones »
 const hair=Math.random();
 const hairM=new THREE.MeshStandardMaterial({color:[0x1a1512,0x3a2a1a,0x6b5a4a,0xd8d0c4][(Math.random()*4)|0],roughness:.95});
 if(hair<.34){const cap=new THREE.Mesh(new THREE.SphereGeometry(.122,10,8,0,6.29,0,1.25),hairM);
  cap.position.y=1.755;cap.scale.set(.95,1,1);cap.castShadow=true;g.add(cap);}
 else if(hair<.67){const cap2=new THREE.Mesh(new THREE.SphereGeometry(.124,10,8,0,6.29,0,.85),hairM);
  cap2.position.y=1.765;cap2.castShadow=true;g.add(cap2);}
 else{const bun=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),hairM);
  bun.position.set(0,1.86,-.05);g.add(bun);}
 // vêtements : une veste ouverte sur le torse, ce qui casse l'effet « pilule »
 if(Math.random()<.5){
  const coat=new THREE.MeshStandardMaterial({color:shirt,roughness:.92,side:THREE.DoubleSide});
  const left=new THREE.Mesh(new THREE.BoxGeometry(.17,.56,.3),coat);
  left.position.set(-.13,1.3,.02);left.rotation.z=.04;left.castShadow=true;g.add(left);
  const right=left.clone();right.position.x=.13;right.rotation.z=-.04;g.add(right);}
 if(Math.random()<.35){ // sac à dos
  const bag=new THREE.Mesh(new THREE.BoxGeometry(.28,.34,.16),
   new THREE.MeshStandardMaterial({color:0x232833,roughness:.9}));
  bag.position.set(0,1.28,-.22);bag.castShadow=true;g.add(bag);}
 const mk=(x,y,z)=>{const o=new THREE.Group();o.position.set(x,y,z);g.add(o);return o;};
 // bras : épaule -> coude -> main ; jambes : hanche -> genou -> pied
 const aL=mk(-.25,1.5,0),aR=mk(.25,1.5,0),lL=mk(-.1,.95,0),lR=mk(.1,.95,0);
 const eL=mk(0,-.3,0),eR=mk(0,-.3,0);
 const hands=[new THREE.Mesh(new THREE.SphereGeometry(.052,7,6),mat(skin)),new THREE.Mesh(new THREE.SphereGeometry(.052,7,6),mat(skin))];
 aL.add(limb(.105,.3,shirt));aR.add(limb(.105,.3,shirt));
 eL.add(limb(.09,.28,skin,.9));eR.add(limb(.09,.28,skin,.9));
 eL.add(hands[0]);eR.add(hands[1]);
 hands[0].position.y=-.3;hands[1].position.y=-.3;
 const knees=[mk(0,-.42,0),mk(0,-.42,0)];
 const feet=[new THREE.Mesh(new THREE.BoxGeometry(.1,.06,.22),mat(0x1a1a1f)),
             new THREE.Mesh(new THREE.BoxGeometry(.1,.06,.22),mat(0x1a1a1f))];
 lL.add(limb(.135,.42,pants));lR.add(limb(.135,.42,pants));
 lL.add(knees[0]);lR.add(knees[1]);
 knees[0].add(limb(.11,.4,pants,.9));knees[1].add(limb(.11,.4,pants,.9));
 knees[0].add(feet[0]);knees[1].add(feet[1]);
 feet[0].position.set(0,-.42,.04);feet[1].position.set(0,-.42,.04);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 // trois gabarits : enfants, adultes, grands gabarits
 const sc=Math.random()<.12?.78:(Math.random()<.25?1.08:.97);
 if(sc!==.97)g.scale.setScalar(sc);
 g.userData={aL,aR,lL,lR,eL,eR,kL:knees[0],kR:knees[1],hips,torso,head,shoulder,
  ph:Math.random()*6,torsoMat:torso.material};
 return g;}
/* marche : balancier des bras, flexion des genoux, roulis des épaules, tête stable */
function animWalk(g,t,amp=.6,spd=9){
 const u=g.userData,s=Math.sin(t*spd+u.ph)*amp,c=Math.cos(t*spd+u.ph);
 u.lL.rotation.x=s;u.lR.rotation.x=-s;
 u.aL.rotation.x=-s*.85;u.aR.rotation.x=s*.85;
 u.eL.rotation.x=-Math.max(0,-s)*.9;u.eR.rotation.x=-Math.max(0,s)*.9;
 u.kL.rotation.x=Math.max(0,s)*.85;u.kR.rotation.x=Math.max(0,-s)*.85;
 if(u.torso){u.torso.rotation.z=c*.035+(u.moodRoll||0);u.shoulder.rotation.y=c*.05+(u.moodRoll||0)*1.4;
  u.hips.rotation.y=-c*.07;u.head.rotation.y=c*.06+(u.moodYaw||0);}}
function animIdle(g,t){
 const u=g.userData,s=Math.sin(t*1.6+u.ph);
 u.lL.rotation.x*=.85;u.lR.rotation.x*=.85;
 u.aL.rotation.x+=(s*.05-u.aL.rotation.x)*.15;u.aR.rotation.x+=(-s*.05-u.aR.rotation.x)*.15;
 u.eL.rotation.x=u.eR.rotation.x=0;u.kL.rotation.x=u.kR.rotation.x=0;
 if(u.torso){u.torso.rotation.z=s*.015+(u.moodRoll||0);u.shoulder.rotation.y=u.shoulder.rotation.y*.9+(u.moodRoll||0)*1.4;
  u.hips.rotation.y*=.9;u.head.rotation.y=s*.08+(u.moodYaw||0);}}
function texMark(txt,col){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.font='900 44px serif';x.textAlign='center';x.textBaseline='middle';x.shadowColor=col;x.shadowBlur=12;x.fillText(txt,32,34);return new THREE.CanvasTexture(c);}
function marker(txt,col){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texMark(txt,col),transparent:true,depthWrite:false}));s.scale.set(.9,.9,1);return s;}
/* joueur */
const player={pos:new THREE.Vector3(0,0,6),yaw:0,sneak:false,mesh:makePerson(0x2fae5f),hidden:false,
 safe:false,moving:false,riding:false,indoors:false,mount:'velo'};
scene.add(player.mesh);
{const cap=new THREE.Mesh(new THREE.CylinderGeometry(.13,.14,.1,12),new THREE.MeshStandardMaterial({color:0x111111,roughness:.8}));
 cap.position.set(0,1.83,.02);cap.castShadow=true;player.mesh.add(cap);
 const brim=new THREE.Mesh(new THREE.BoxGeometry(.22,.03,.13),new THREE.MeshStandardMaterial({color:0x111111}));
 brim.position.set(0,1.79,.13);player.mesh.add(brim);}
/* vélo */
const bike={mesh:new THREE.Group(),pos:new THREE.Vector3(S.bike.x,0,S.bike.z)};
{const fM=new THREE.MeshStandardMaterial({color:0x22d3ee,roughness:.4,metalness:.5});
 [[-.9],[.9]].forEach(([dz])=>{const w=new THREE.Mesh(new THREE.TorusGeometry(.34,.06,8,18),new THREE.MeshStandardMaterial({color:0x111}));w.position.set(0,.34,dz);bike.mesh.add(w);});
 const fr=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,1.9),fM);fr.position.y=.6;fr.rotation.x=.15;bike.mesh.add(fr);
 const hb=new THREE.Mesh(new THREE.BoxGeometry(.5,.07,.07),fM);hb.position.set(0,1.05,-.95);bike.mesh.add(hb);
 const lampM=new THREE.Mesh(new THREE.SphereGeometry(.09,8,8),new THREE.MeshBasicMaterial({color:0xfff2b0}));lampM.position.set(0,1.0,-1.0);bike.mesh.add(lampM);
 const mk=marker('🚲','#22d3ee');mk.scale.set(.7,.7,1);mk.position.y=1.9;bike.mesh.add(mk);
 bike.mesh.position.copy(bike.pos);scene.add(bike.mesh);}
/* clients — points de vente par quartier */
const SPOTS_B=[[3,5],[-14,16],[22,5],[-28,24],[36,28],[-38,8]];
const SPOTS_M=[[104,4],[130,-18],[158,10],[120,34],[166,-38],[144,50]];
const SPOTS_Q=[[-24,116],[24,116],[-16,146],[18,150],[0,132],[34,176]];
const SPOTS_C=[[-130,6],[-176,6],[-118,-40],[-180,-38],[-150,44],[-160,-6]];
const CTYPES=[{e:'🎉',n:'Fêtard',gen:[1.2,1.5],pat:25},{e:'🤝',n:'Régulier',gen:[1.0,1.15],pat:60},{e:'😟',n:'Méfiant',gen:[.85,1.0],pat:40}];
/* rivaux : deux styles de jeu opposés
   Zoé  : brade systématiquement, gros volumes, attire la police
   Malik: prix élevés, discret, rare mais perseverance */
const RIVAL_PERSONA={
 Zoé:{style:'discount',ico:'🕶️',col:0xb03060,vol:1.4,price:.78,heat:.6},
 Malik:{style:'premium',ico:'🎩',col:0x3a7bd5,vol:.6,price:1.35,heat:.1},
};
const clients=[];const NCOL=[0xc9a06a,0x7fb8ff,0xff9dc8,0xd9c23a,0x9d6bff,0xff8c42];
function openSpots(){const l=[SPOTS_B];
 if(S.rep>=3)l.push(SPOTS_M);
 if(S.rep>=7)l.push(SPOTS_Q);
 if(S.rep>=5)l.push(SPOTS_C);
 return l;}
function pickSpot(){const l=openSpots(),s=l[Math.floor(Math.random()*l.length)][Math.floor(Math.random()*l[0].length)];
 return [s[0]+(Math.random()-.5)*4,s[1]+(Math.random()-.5)*4];}
function newClient(i){const m=makePerson(NCOL[i%NCOL.length]);m.position.set(0,0,0);scene.add(m);
 const mk=marker('!','#ffd166');scene.add(mk);
 const c={x:0,z:0,mesh:m,mk,demand:5,gen:1,pat:40,patMax:40,type:0,haggled:false,loyal:0};
 mk.position.set(0,2.7,0);
 // premier tirage : on force une position réelle, sinon le client reste à l'origine (0,0)
 const p=pickSpot();c.x=p[0];c.z=p[1];newDemand(c,true);
 c.mesh.position.set(c.x,0,c.z);c.mk.position.set(c.x,2.7,c.z);return c;}
for(let i=0;i<6;i++)clients.push(newClient(i));
/* réputation : +0.5 par deal discret, +1 par deal propre, -1 par deal vu */
function addRep(n){const before=repTier();S.rep=Math.max(0,Math.min(30,S.rep+n));
 const after=repTier();
 if(after>before){toast('⭐ Réputation : <b>'+REPNAME[after]+'</b> !'+openMsg(after),'gold');sndBlip(880);
  clients.forEach(c=>{if(c.loyal)c.loyal=Math.min(4,c.loyal+1);});missionCheck();}}
function openMsg(t){if(t>=3)return' Les Quais sont ouverts !';
 if(t>=2)return' Le Marché est ouvert !';return '';}
function newDemand(c,first){
 if(c.vip){ // un VIP ne se recycle pas en client normal
  c.demand=8+Math.floor(Math.random()*4);
  const D=districtAt(c.x,c.z);
  c.gen=(2.2+Math.random()*.6)*(D?D.risk:1);
  c.patMax=30;c.pat=30;c.haggled=false;
  c.mesh.position.set(c.x,0,c.z);c.mk.position.set(c.x,2.7,c.z);
  return;}
 c.demand=2+Math.floor(Math.random()*6);c.type=Math.floor(Math.random()*3);const T=CTYPES[c.type];
 const dist=districtAt(c.x,c.z);
 // les bons quartiers paient plus, mais génèrent de la suspicion
 const dq=dist?dist.risk:1;
 c.gen=T.gen[0]+Math.random()*(T.gen[1]-T.gen[0]);
 c.patMax=T.pat*(S.up.look?2:1)*(1+c.loyal*.35);c.pat=c.patMax;c.haggled=false;
 if(!first){const p=pickSpot();c.x=p[0];c.z=p[1];}
 c.mesh.position.set(c.x,0,c.z);c.mk.position.set(c.x,2.7,c.z);}
function refreshClientBase(c){
 const d=districtAt(c.x,c.z);
 if(d){c.gen*= (d.id==='marche'?1.2:d.id==='quais'?1.5:1);
  c.patMax*=(d.id==='marche'?.8:d.id==='quais'?.6:1);}
 return c;}
/* flics */
function visionCone(col=0xff2233,r=15){const g=new THREE.CircleGeometry(r,20,-Math.PI/2.6,Math.PI/1.3);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.06;return m;}
const cops=[];
function footCop(path,speed=2.4){const m=makePerson(0x27408b,0x101a33);scene.add(m);
 const cone=visionCone();scene.add(cone);
 const cap=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.1,10),new THREE.MeshStandardMaterial({color:0x101a33}));cap.position.y=2.04;m.add(cap);
 const badge=new THREE.Mesh(new THREE.SphereGeometry(.05,6,6),new THREE.MeshBasicMaterial({color:0xffd166}));badge.position.set(.2,1.3,.28);m.add(badge);
 const alert=marker('?','#ffd166');alert.position.y=2.6;alert.visible=false;m.add(alert);
 const c={type:'foot',mesh:m,cone,alert,path,wi:0,pos:new THREE.Vector3(path[0][0],0,path[0][1]),dir:0,state:'patrol',meter:0,lost:0,extra:false};cops.push(c);return c;}
footCop([[-10,14],[18,14],[18,4],[-10,4]]);
footCop([[24,30],[40,30],[40,16],[24,16]],2.6);
const car={type:'car',path:[[-45,9],[45,9],[45,33],[-45,33]],wi:1,pos:new THREE.Vector3(22,0,9),dir:0,state:'patrol',meter:0,lost:0,mesh:new THREE.Group(),cone:null,extra:false};
{const b=new THREE.Mesh(new THREE.BoxGeometry(4.2,1,2),new THREE.MeshStandardMaterial({color:0x16213e,roughness:.4,metalness:.4}));b.position.y=.8;car.mesh.add(b);
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(4.24,.3,2.02),new THREE.MeshBasicMaterial({color:0xffffff}));stripe.position.y=.9;car.mesh.add(stripe);
 const t=new THREE.Mesh(new THREE.BoxGeometry(2.2,.8,1.8),new THREE.MeshStandardMaterial({color:0x0e1526}));t.position.set(-.2,1.6,0);car.mesh.add(t);
 const push=new THREE.Mesh(new THREE.BoxGeometry(.2,.8,2),new THREE.MeshStandardMaterial({color:0x333}));push.position.set(2.2,.9,0);car.mesh.add(push);
 [[-1.4,.9],[1.4,.9],[-1.4,-.9],[1.4,-.9]].forEach(([x,z])=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.3,10),new THREE.MeshStandardMaterial({color:0x0a0a0a}));w.rotation.x=Math.PI/2;w.position.set(x,.42,z);car.mesh.add(w);});
 const hl=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.4),new THREE.MeshBasicMaterial({color:0xfff6c0}));hl.position.set(2.12,.9,0);hl.rotation.y=Math.PI/2;car.mesh.add(hl);
 car.barR=new THREE.Mesh(new THREE.BoxGeometry(.5,.25,.6),new THREE.MeshBasicMaterial({color:0xff0000}));car.barR.position.set(-.2,2.15,-.5);car.mesh.add(car.barR);
 car.barB=new THREE.Mesh(new THREE.BoxGeometry(.5,.25,.6),new THREE.MeshBasicMaterial({color:0x0033ff}));car.barB.position.set(-.2,2.15,.5);car.mesh.add(car.barB);
 car.light=new THREE.PointLight(0xff0000,8,14,1.8);car.light.position.set(0,2.5,0);car.mesh.add(car.light);
 car.cone=visionCone(0xff3344,18);car.cone.scale.set(1.2,1.2,1);scene.add(car.cone);
 car.alert=marker('!!','#ff2222');car.alert.position.y=3;car.alert.visible=false;car.mesh.add(car.alert);
 scene.add(car.mesh);cops.push(car);}
/* vie ambiante : la circulation et la foule sont définies plus haut (CARS / WALKERS).
   Ce point d'entrée est appelé chaque frame depuis la boucle. */
function ambientTick(dt,now){trafficTick(dt);walkerTick(dt);}

/* météo dynamique : change seule, modifie la brume, les lumières et le risque */
const WEATHERS=[
 {id:'clear',ico:'☀️',nom:'Dégagé',fogA:55,fogB:330},
 {id:'rain', ico:'🌧',nom:'Pluie', fogA:34,fogB:210},
 {id:'fog',  ico:'🌫️',nom:'Brume',fogA:14,fogB:85},
 {id:'snow', ico:'🌨️',nom:'Neige', fogA:28,fogB:165},
];
let snowPts=null;
function initSnow(){
 const N=380,g=new THREE.BufferGeometry(),p=new Float32Array(N*3);
 for(let i=0;i<N;i++){p[i*3]=(Math.random()-.5)*44;p[i*3+1]=Math.random()*26;p[i*3+2]=(Math.random()-.5)*44;}
 g.setAttribute('position',new THREE.BufferAttribute(p,3));
 snowPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:.2,transparent:true,opacity:.8}));
 snowPts.visible=false;scene.add(snowPts);}
initSnow();
function setWeather(w){
 S.weather=w;const W=WEATHERS.find(x=>x.id===w);
 fogW=W;scene.fog.near=W.fogA;scene.fog.far=W.fogB;
 rain.visible=w==='rain';snowPts.visible=w==='snow';
 hemi.intensity=w==='fog'?.6:w==='clear'?1.0+w*.35:1.0;
 toast(W.ico+' <b>'+W.nom+'</b>'+(w==='fog'?' — tu es plus discret (-40% risque)':w==='clear'?' — plus visible (+10%)':''),w==='clear'?'':'gold');
 save();}
function weatherTick(dt){
 S.weatherT-=dt;
 if(S.weatherT>0)return;
 const roll=Math.random();
 const cur=S.weather;
 let next=roll<.5?'clear':roll<.72?'rain':roll<.88?'fog':'snow';
 if(next===cur)next=cur==='clear'?'rain':'clear';
 S.weatherT=45+Math.random()*70;
 setWeather(next);}
/* pluie */
const RAIN_N=450;const rainGeo=new THREE.BufferGeometry();const rainPos=new Float32Array(RAIN_N*3);for(let i=0;i<RAIN_N;i++){rainPos[i*3]=(Math.random()-.5)*44;rainPos[i*3+1]=Math.random()*26;rainPos[i*3+2]=(Math.random()-.5)*44;}
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0x9fb8ff,size:.14,transparent:true,opacity:.55}));
rain.visible=false;scene.add(rain);
function applyHoodie(){const m=player.mesh.userData.torsoMat;if(m)m.color.set(HOODIES[S.hoodie]||HOODIES[0]);}
