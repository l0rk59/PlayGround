/* ==== 95-sim-hud.js — Simulation, HUD, boucle ==== */
/* ============ BOUCLE ============ */
let last=performance.now(),acc=0,mapT=0,stam=100,rainSnd=0;
function animate(now){/* la collecte LOD doit se faire une fois le monde construit, juste avant la boucle */
collectLOD();
requestAnimationFrame(animate);
 const rawDt=Math.min(.05,(now-last)/1000);last=now;
 const dt=paused?0:rawDt*S.timeScale;   // timeScale accélère simulation + horloge
 if(!bustLock&&!paused){
  let ix=joy.x,iy=joy.y;
  if(keys['w']||keys['arrowup'])iy-=1;if(keys['s']||keys['arrowdown'])iy+=1;
  if(keys['a']||keys['arrowleft'])ix-=1;if(keys['d']||keys['arrowright'])ix+=1;
  const L=Math.hypot(ix,iy);if(L>1){ix/=L;iy/=L;}
  const rideSp=S.up.turbo?11:9;
  const wantSprint=(sprintHold||keys['shift'])&&!player.sneak;
  const sp=player.riding?(wantSprint?rideSp+1.5:rideSp):(player.sneak?2.2:((wantSprint&&stam>5)?7:4.2));
  if(wantSprint&&L>.08&&!player.riding)stam=Math.max(0,stam-22*dt);else stam=Math.min(100,stam+16*dt);
  $('stamFill').style.width=stam+'%';
  // repère caméra : avant = (sin,cos) depuis la caméra vers le joueur ;
  // droite = perpendicularCroiséGauche(avant, haut) = (-cos, sin).
  const fwd=-iy; // joystick vers le haut (dy<0) et touche W doivent avancer
  if(L>.08){const wx=Math.sin(camYaw)*fwd-Math.cos(camYaw)*ix,
   wz=Math.cos(camYaw)*fwd+Math.sin(camYaw)*ix;
   player.pos.x+=wx*sp*dt;player.pos.z+=wz*sp*dt;player.yaw=Math.atan2(wx,wz);player.moving=true;
   if(player.riding){bike.pos.set(player.pos.x,0,player.pos.z);bike.mesh.rotation.y=player.yaw;}}
  else player.moving=false;
  [player.pos.x,player.pos.z]=collide(player.pos.x,player.pos.z);
  if(!player.riding){player.mesh.position.copy(player.pos);
   player.mesh.position.y=player.moving?Math.abs(Math.sin(now/130))*.09:0;
   player.mesh.rotation.y+=(player.yaw-player.mesh.rotation.y)*.15;
   if(player.moving&&!player.sneak)animWalk(player.mesh,now/1000,.6,9);else animIdle(player.mesh,now/1000);
   // bruit de pas (espacement selon la vitesse)
   if(player.moving&&now-lastStep>(player.riding||(sprintHold||keys['shift'])?260:430)){lastStep=now;sfxStep();}
   player.mesh.visible=true;
  } else {player.mesh.visible=false;
   bike.mesh.position.set(player.pos.x,0,player.pos.z);bike.mesh.rotation.y=player.yaw;
   bike.mesh.visible=(player.mount||'velo')==='velo';
   const u=player.mesh.userData;u.lL.rotation.x=.5;u.lR.rotation.x=.5;}
  if(!player.riding){bike.mesh.position.copy(bike.pos);}
  // véhicule conduit : son mesh suit le joueur, le carburant se consomme
  {const id=player.mount||'velo';
   const moved=Math.hypot(player.pos.x-(player._px==null?player.pos.x:player._px),
                           player.pos.z-(player._pz==null?player.pos.z:player._pz));
   player._px=player.pos.x;player._pz=player.pos.z;
   vehMeshRef(vehData(id));
   if(player.riding&&id!=='velo')vehFuelTick(moved);}
  player.hidden=!player.riding&&bushes.some(b=>dist2(player.pos.x,player.pos.z,b.x,b.z)<b.r);
  player.safe=dist2(player.pos.x,player.pos.z,9.5,-9)<3.4;
  if(!player.riding)vehList().forEach(v=>{if(v.id!=='velo'&&vehOwned(v.id))vehPark(v.id);});
  // intérieur : le toit s'ouvre, les murs s'effacent, la porte s'ouvre
  const indoors=isIndoors();
  setHouseOpen(indoors);
 // les halles publiques suivent la même règle : toit caché, murs transparents
 const hn=hallAt();
 HALLS.forEach(h=>setHallOpen(h,h===hn));
 player.indoors=indoors||!!hn;
  if(houseDoor){
   const near=dist2(player.pos.x,player.pos.z,HOME.x,HOME.z+HD/2)<3.2;
   const want=indoors?1:(near?.55:0);
   houseDoor.rotation.y+=(want-houseDoor.rotation.y)*.15;
  }
  $('tagHide').classList.toggle('show',player.hidden);
  $('tagSafe').classList.toggle('show',player.safe);
  $('tagSneak').classList.toggle('show',player.sneak&&!player.riding);
  $('tagBike').classList.toggle('show',player.riding);
  $('tagIn').classList.toggle('show',player.indoors);
  // caméra : à l'intérieur, vue plongeante au-dessus du plafond (masqué)
  // à l'intérieur : vue "maison en coupe". La caméra vise le milieu de la pièce et recule
  // juste ce qu'il faut pour que la chambre tienne dans l'écran, même en portrait.
  // Elle ne bascule qu'une fois vraiment passé la porte (évite le-hooking dans l'encadrement).
  const camIn=indoors&&player.pos.z<HOME.z+HD/2-.9;
  const hHalf=Math.tan(camera.fov*Math.PI/360)*camera.aspect;
  const cdIn=Math.min(15.5,Math.max(6.6,4.5/Math.max(.06,hHalf)));
  const cd=player.riding?camDist+2.5:(camIn?cdIn:camDist);
  const fx=camIn?player.pos.x+(HOME.x-player.pos.x)*.46:player.pos.x;
  const fz=camIn?player.pos.z+(HOME.z-player.pos.z)*.46:player.pos.z;
  let cx=fx-Math.sin(camYaw)*cd,cz=fz-Math.cos(camYaw)*cd;
  if(camIn){cx=Math.max(HOME.x-HW/2+.9,Math.min(HOME.x+HW/2-.9,cx));
   cz=Math.max(HOME.z-HD/2+.9,Math.min(HOME.z+HD/2-.9,cz));}
  // anti-pénétration : si la caméra visée est dans un mur, on la ramène vers le joueur
  let steps=0;
  while(steps<12&&pointInSolid(cx,cz,.6)){cx+=(player.pos.x-cx)*.28;cz+=(player.pos.z-cz)*.28;steps++;}
  const lc=camIn?.14:.08;
  camera.position.x+=(cx-camera.position.x)*lc;camera.position.z+=(cz-camera.position.z)*lc;
  const targetY=camIn?9.8*Math.pow(cdIn/6.6,.8)+camPitch*2:4.5+camPitch*4;
  camera.position.y+=(targetY-camera.position.y)*(camIn?.16:.12);
  // écran étroit : on vise un peu plus haut pour que la pièce se place sous les cartes du HUD
  const frameUp=camIn?Math.max(0,1.25-camera.aspect)*3.4:0;
  camera.lookAt(fx,(camIn?.6:1.4)+frameUp,fz);
  shakeTick(rawDt,now);
  copTick(dt);informantTick(dt);roadblockTick(dt);growTick(dt);updateInteract();
 S.hour+=dt*(24/240);S.playT+=dt;
 if(S.hour>=24){S.hour-=24;S.dayN++;
  S.rentIn--;
  if(S.rentIn<=0){S.rentIn=3;const rent=40+S.level*18+S.rep*6;
   S.money-=rent;S.rentPaid=(S.rentPaid|0)+rent;
   const bills=payBills();
   toast('🏠 <b>Loyer : -'+rent+' €</b>'+(bills.length?'<br><small>'+bills.join(' • ')+'</small>':''),'warn',4200);
   sndBlip(200);}
  else toast('☀️ Jour '+S.dayN+' dans le hood');}
 shadowTick();
 weatherVisualTick(dt);
 ambienceTick(dt,now);engineTick(dt);
 quayTick(dt,now);
 applySky();ambientTick(dt,now);delivTick(dt);rivalTick(dt);
 // alerte de faillite : évite le softlock
 if(S.money<25&&S.stock<1&&(S.seeds.classique|0)<1&&S.stash<1){
  if(!S.broke){S.broke=true;toast("🆘 Plus rien ! Planque → secours d'urgence (25 €)",'warn',6500);}}
 else S.broke=false;
 const dcur=districtAt(player.pos.x,player.pos.z);
 const did=dcur?dcur.id:'bloc';
 if(did!==S.district){S.district=did;
  if(dcur)toast('📍 <b>'+dcur.nom+'</b> — '+(dcur.id==='bloc'?'zone calme':dcur.id==='marche'?'clients plus généreux, plus de monde':'haut risque, gros clients'),'gold');
  else toast('📍 Hors des quartiers — zone reculée');
  missionCheck();}
  clients.forEach((c,i)=>{ c.mesh.position.set(c.x,Math.abs(Math.sin(now/500+i))*.04,c.z);
   const want=Math.atan2(player.pos.x-c.x,player.pos.z-c.z);c.mesh.rotation.y+=(want-c.mesh.rotation.y)*.05;
   animIdle(c.mesh,now/1000);
   // un client du Marché/Quais ne traverse pas le monde : s'il est trop loin il part
   const dd=dist2(player.pos.x,player.pos.z,c.x,c.z);
   if(dd>150&&Math.random()<dt*.5)newDemand(c);
   c.mk.position.set(c.x,2.7+Math.sin(now/600+i)*.12,c.z);
   c.mk.material.opacity=c.pat<10?(Math.sin(now/400)*.5+.5):1;
   if(c.type===0)c.mk.material.rotation+=dt;});
  const f=Math.floor(now/350)%2;car.barR.material.color.set(f?'#ff0000':'#550000');car.barB.material.color.set(f?'#000055':'#3388ff');
  car.light.color.set(f?'#ff0000':'#3388ff');
  flickers.forEach((m,i)=>{m.opacity=Math.sin(now/300+i*2)>.92?.4:1;});
  const dry=player.indoors;
  if(S.weather==='rain'){rain.visible=!dry;
   if(now-rainSnd>2600){rainSnd=now;sfxRain();}
   const p=rainGeo.attributes.position.array;
   for(let i=0;i<RAIN_N;i++){p[i*3+1]-=22*rawDt;
    if(p[i*3+1]<0){p[i*3+1]=24;p[i*3]=camera.position.x+(Math.random()-.5)*44;p[i*3+2]=camera.position.z+(Math.random()-.5)*44;}}
   rainGeo.attributes.position.needsUpdate=true;}else rain.visible=false;
  if(S.weather==='snow'&&snowPts.visible&&!dry){const sp=snowPts.geometry.attributes.position.array;
   for(let i=0;i<sp.length/3;i++){sp[i*3+1]-=2.4*rawDt;sp[i*3]+=Math.sin(now/900+i)*.004;
    if(sp[i*3+1]<0){sp[i*3+1]=26;sp[i*3]=camera.position.x+(Math.random()-.5)*44;sp[i*3+2]=camera.position.z+(Math.random()-.5)*44;}}
   snowPts.geometry.attributes.position.needsUpdate=true;}
  weatherTick(rawDt);eventTick(rawDt);fpsTick(rawDt);metroTick();jobTick(dt);
  lightBudgetTick();lodTick();
  acc+=dt;if(acc>1){acc=0;dailyTick();dailyBadge();if(opt().autoSave)save();syncHUD();missionCheck();checkWin();
   if(!weekState().reward&&weekProgress()>=currentWeek().tgt&&!$('progSheet').classList.contains('open'))
    toast('🏆 Défi hebdomadaire accompli — récupère tes 250 €','gold',3600);}
  mapT+=dt;if(mapT>.2){mapT=0;drawMap();if($('sellSheet').classList.contains('open'))refreshSell();}
 }
 gradeTick(daylight());
 renderFrame();
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
 if(composer)composer.setSize(innerWidth,innerHeight);
 if(typeof applyOpts==='function')applyOpts();});
/* init */
if(S.harvested===0&&S.totalSold===0&&S.money===150&&!S.pots.some(p=>p.planted)){
 S.pots[4]={g:100,w:55,n:50,h:95,planted:true,ready:true,s:0};S.sel=4;}
if(!S.district)S.district='bloc';
if(typeof S.broke!=='boolean')S.broke=false;
// premier client garanti près de la maison
if(clients[0]&&!clients.some(c=>c.x<-20&&c.x>40&&c.z>-5&&c.z<25)){clients[0].x=3;clients[0].z=5;clients[0].mesh.position.set(3,0,5);clients[0].mk.position.set(3,2.7,5);}
bike.pos.set(S.bike.x,0,S.bike.z);bike.mesh.position.copy(bike.pos);
applyHoodie();applySky();
const W0=WEATHERS.find(w=>w.id===S.weather)||WEATHERS[0];fogW=W0;fogW=W0;
scene.fog.near=W0.fogA;scene.fog.far=W0.fogB;
rain.visible=S.weather==='rain'&&!player.indoors;snowPts.visible=S.weather==='snow'&&!player.indoors;
S.stash=Math.max(0,Math.min(S.stash,stashCap()));
camera.position.set(0,7,16);
syncHUD();syncPause();drawMap();
startMusic(); // la musique démarre une fois le module entièrement évalué
setTimeout(()=>{if(S.tuto<TUTO.length)showTuto();},9000);
setTimeout(()=>toast('🌃 Bienvenue ! Entre par la porte de ta maison pour cultiver.'),1000);
/* ---------- la rue se met en mouvement ---------- */
spawnTraffic();
marketLife();quayCrowd();
for(let i=0;i<14;i++)spawnWalker();
/* ---------- ombres : réglage global une fois le monde construit ---------- */
/* Seul ce qui compte projette une ombre : les grands volumes et les corps.
   Les petits accessoires coûteraient une passe de plus pour rien à l'écran. */
function shadeAll(){scene.traverse(o=>{
 if(o.isSprite||!o.isMesh||!o.geometry)return;
 const g=o.geometry;if(!g.boundingSphere)g.computeBoundingSphere();
 const r=g.boundingSphere?g.boundingSphere.radius:1;
 const flat=g.type==='PlaneGeometry'||g.type==='CircleGeometry'||g.type==='RingGeometry'||r>14;
 o.receiveShadow=!flat;
 o.castShadow=!flat&&r>=.8&&r<=14;});}
/* le mode Éco coupe les ombres : gros gain de FPS sur téléphone */
function setShadowQuality(on){
 if(renderer.shadowMap.enabled===on)return;
 renderer.shadowMap.enabled=on;
 scene.traverse(o=>{if(o.isMesh&&o.material)
  (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.needsUpdate=true;});});}
shadeAll();
/* ===== PONT NATIF : application Android (WebView) =====
   Le même fichier sert au navigateur ET à l'APK : ce bloc est inerte sur le web,
   il ne s'active que si l'application le signale (window.HG_NATIVE). */
const HG_VER='1.0.0'; /* android/build-apk.sh remplace ce numéro par la version de l'APK */
const NATIVE=!!window.HG_NATIVE||/;wv\)|Android/i.test(navigator.userAgent);
/* Android exige un geste utilisateur avant de laisser tourner l'audio */
function unlockAudio(){const a=ac();if(!a)return;if(a.state!=='running'){const r=a.resume();if(r&&r.catch)r.catch(()=>{});}}
addEventListener('pointerdown',unlockAudio,{passive:true});
addEventListener('keydown',unlockAudio,{passive:true});
addEventListener('contextmenu',e=>e.preventDefault());
/* bouton retour Android : ferme ce qui est ouvert, met en pause, puis sort de l'app
   si on appuie une seconde fois depuis l'écran de pause. */
window.HG_back=function(){
 const t=$('tuto'),h=$('helpCard');
 if(t&&t.classList.contains('open')){$('tutoSkip').click();return true;}
 if(h&&h.classList.contains('open')){h.classList.remove('open');return true;}
 if(paused)return false; // déjà en pause : l'application se ferme
 if(['winSheet','growSheet','sellSheet','safeSheet','shopSheet','labSheet','statsSheet','optionsSheet','marcheSheet','douaneSheet','bankSheet','polSheet','metroSheet','jobSheet','progSheet']
   .some(id=>{const e=$(id);return e&&e.classList.contains('open');})){switchSheet('');return true;}
 togglePause();return true;};
/* l'application prévient quand elle passe en arrière-plan */
window.HG_appPause=function(){if(!paused)togglePause();sirenStop();save();};
window.HG_appResume=function(){unlockAudio();};
document.addEventListener('visibilitychange',()=>{
 // pause seulement : la sauvegarde est déclenchée par l'application (HG_appPause),
 // ici on ne touche pas au save (cet événement part aussi pendant un rechargement).
 if(document.hidden){if(!paused)togglePause();sirenStop();}else unlockAudio();});
/* qualité automatique : sur téléphone lent on repasse en Éco, une seule fois */
if(NATIVE){let frames=0;(function fc(){requestAnimationFrame(()=>{frames++;fc();});})();
 setInterval(()=>{const n=frames;frames=0;
  if(n<26&&S.hq){S.hq=false;applyQ();save();syncPause();
   toast('📉 Qualité abaissée automatiquement (mode Éco)','warn');}},4000);}
const bi=$('pBuild');
if(bi)bi.textContent=(NATIVE?'Application Android ':'Version web ')+HG_VER;
requestAnimationFrame(animate);
