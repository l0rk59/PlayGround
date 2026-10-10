/* ==== 60-controles.js — Contrôles, labo, holographie ==== */
/* ============ CONTRÔLES ============ */
const joy={x:0,y:0,id:null};const stick=$('stick'),joyEl=$('joy');
function joySet(dx,dy){if(S.opt&&S.opt.invertX)dx=-dx;const m=Math.hypot(dx,dy),max=42;const k=m>max?max/m:1;joy.x=dx*k/max;joy.y=dy*k/max;stick.style.transform=`translate(${dx*k}px,${dy*k}px)`;}
joyEl.addEventListener('pointerdown',e=>{joy.id=e.pointerId;joyEl.setPointerCapture(e.pointerId);const r=joyEl.getBoundingClientRect();joySet(e.clientX-(r.left+64),e.clientY-(r.top+64));});
joyEl.addEventListener('pointermove',e=>{if(e.pointerId!==joy.id)return;const r=joyEl.getBoundingClientRect();joySet(e.clientX-(r.left+64),e.clientY-(r.top+64));});
const joyEnd=e=>{if(e.pointerId!==joy.id)return;joy.id=null;joy.x=joy.y=0;stick.style.transform='';};
joyEl.addEventListener('pointerup',joyEnd);joyEl.addEventListener('pointercancel',joyEnd);
const keys={};addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='p')togglePause();});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
let camYaw=Math.PI,camPitch=.3,camDist=7.5;
{let drag=null;renderer.domElement.addEventListener('pointerdown',e=>{if(e.clientX>innerWidth*.35)drag={x:e.clientX,y:e.clientY};});
addEventListener('pointermove',e=>{if(!drag||paused)return;camYaw-=(e.clientX-drag.x)*.006*((S.opt&&S.opt.sens)||1);camPitch=Math.min(1.2,Math.max(.12,camPitch+(e.clientY-drag.y)*.004));drag={x:e.clientX,y:e.clientY};});
addEventListener('pointerup',()=>drag=null);}
let sprintHold=false;
$('btnSprint').addEventListener('pointerdown',()=>sprintHold=true);addEventListener('pointerup',()=>sprintHold=false);
$('btnOpts').onclick=()=>{vib(8);switchSheet('optionsSheet');renderOpts();sndBlip(600);};
$('pOptsBtn').onclick=()=>{switchSheet('optionsSheet');renderOpts();sndBlip(600);};
$('optClose').onclick=()=>{switchSheet('');sndBlip(380);};
$('btnSneak').onclick=()=>{player.sneak=!player.sneak;$('btnSneak').classList.toggle('on',player.sneak);vib(10);};
$('legalX').onclick=()=>$('legal').remove();
/* ouvrir/fermer un panneau — point d'entrée unique, ferme tous les autres */
function switchSheet(id){
 ['growSheet','sellSheet','safeSheet','shopSheet','pauseSheet','winSheet','labSheet','statsSheet','optionsSheet','marcheSheet','douaneSheet','bankSheet','polSheet','metroSheet','jobSheet','progSheet'].forEach(s=>{const e=$(s);if(e)e.classList.remove('open');});
 if(id===''||id==='sellSheet')bluff=null;
 if(id&&$(id))$(id).classList.add('open');
 if(id==='shopSheet')renderShop();
 if(id==='growSheet')renderGrow();
 if(id==='safeSheet')renderSafe();
 if(id==='labSheet')renderLab();}
$('btnSeeds').onclick=()=>{vib(8);switchSheet('shopSheet');};
$('shopClose').onclick=()=>switchSheet('');
$('winClose').onclick=()=>switchSheet('');
$('labClose').onclick=()=>switchSheet('');
/* ===== LABO GÉNÉTIQUE ===== */
let crossSel=[];
function renderLab(){
 $('labCount').textContent=S.genomes.length;
 $('labMut').textContent=Math.round(S.mutChance*100)+'%';
 $('labMutPct').textContent=Math.round(S.mutChance*100)+'%';
 const el=$('labGrid');el.innerHTML='';
 const sel=crossSel;
 S.genomes.forEach((gid,i)=>{
  const g=genomeOf(gid);
  const d=document.createElement('div');
  d.innerHTML=genCard(gid,sel[0]===gid,sel[1]===gid);
  d.style.cssText='cursor:pointer;border:1px solid '+(sel.includes(gid)?'#b892ff':'rgba(255,255,255,.14)')+
   ';border-radius:11px;padding:8px;background:rgba(255,255,255,.04)';
  d.onclick=()=>{
   const i2=crossSel.indexOf(gid);
   if(i2>=0)crossSel.splice(i2,1);
   else if(crossSel.length<2)crossSel.push(gid);
   else crossSel=[crossSel[1],gid];
   sndBlip(600);renderLab();};
  el.appendChild(d);});
 // pedigree : la lignée des souches mutées
 const ped=$('labPed');
 if(ped){
  const muts=S.genomes.filter(id=>genomeOf(id).parent!=null);
  const cb=$('crossBtn'),ci=$('crossInfo');
  if(cb){cb.disabled=crossSel.length!==2||S.money<60;
   if(ci)ci.innerHTML=crossSel.length===0?'Sélectionne 2 souches : A puis B.'
    :crossSel.length===1?'<b>'+genomeOf(crossSel[0]).nom+'</b> sélectionnée — choisis la souche B.'
    :'<b>'+genomeOf(crossSel[0]).nom+'</b> × <b>'+genomeOf(crossSel[1]).nom+'</b> — prête à croiser.';}
  if(cb)cb.onclick=()=>{
   if(crossSel.length!==2){toast('Sélectionne deux souches','warn');return;}
   if(S.money<60){toast('💰 60 € requis','warn');return;}
   S.money-=60;
   const id=cross(crossSel[0],crossSel[1]);
   crossSel=[];
   sndBlip(880);vib(15);
   if(id!=null){toast('🧬 Nouvelle souche : <b>'+genomeOf(id).nom+'</b>','gold',4200);missionCheck();}
   save();renderLab();syncHUD();};
  $('buyFrag').onclick=()=>{
   if(S.money<90){toast('💰 90 € requis','warn');return;}
   S.money-=90;
   const id=mutate(S.genomes.length?S.genomes[(Math.random()*S.genomes.length)|0]:0);
   toast('🔥 Souche <b>'+genomeOf(id).nom+'</b> ajoutée (double rendement, fragile)','gold',4200);
   sndBlip(760);vib(12);save();renderLab();syncHUD();};
  $('labMutBtn').onclick=()=>{
   if(S.mutChance>=.3){toast('Mutation déjà au maximum','warn');return;}
   if(S.money<40){toast('💰 40 € requis','warn');return;}
   S.money-=40;S.mutChance=Math.min(.3,S.mutChance+.06);
   toast('🧬 Mut chance : '+Math.round(S.mutChance*100)+'%','gold');
   sndBlip(700);save();renderLab();syncHUD();};
  ped.innerHTML=muts.length
   ? muts.map(id=>{const g=genomeOf(id);const p=ADN[g.parent];
     return '<div style="font-size:11px;opacity:.85;margin:2px 0">🌿 <b>'+p.nom+'</b> → <b>'+g.nom+
      '</b> <span style="opacity:.6">(rend ×'+g.rend.toFixed(2)+')</span></div>';}).join('')
   : '<small style="opacity:.6">Aucune mutation pour l\'instant — laisse tourner tes plants pour en obtenir.</small>';}
};
/* ===== DIALOGUES CLIENTS ===== */
function syncSpeedUI(){
 if($('pSpeed'))$('pSpeed').textContent='⏩ Vitesse : ×'+S.timeScale;
 if($('spdTxt'))$('spdTxt').textContent='×'+S.timeScale;
 if($('labCount2'))$('labCount2').textContent=S.genomes.length+' souche'+(S.genomes.length>1?'s':'');}
function setSpeed(v){S.timeScale=v;save();syncHUD();syncSpeedUI();
 toast('⏩ Vitesse ×'+v+' — un jour de jeu dure ~'+Math.round(120/v)+' s','gold');
 if(v>1)sndBlip(600);}
$('statsClose').onclick=()=>switchSheet('');
$('btnStats').onclick=()=>{vib(8);$('statsBody').innerHTML=statsHTML();switchSheet('statsSheet');};
/* ============================================================
   🚗 VÉHICULES
   Le vélo reste gratuit. Les autres s'achètent au garage :
   plus vite = plus de bruit. Un coffre = plus de planque.
   ============================================================ */
const VEH=[
 {id:'scoot',nom:'Scooter',ico:'🛵',price:420,spd:12.5,noise:1.10,stash:0,fuel:60,col:0xd8d24a,
  d:'Rapide et discret, mais ça s\'entend de loin.'},
 {id:'citad',nom:'Citadine',ico:'🚗',price:1500,spd:15,noise:1.35,stash:12,fuel:90,col:0x4a90d9,
  d:'Porte tout le quartier. +12 g de coffre.'},
 {id:'fourgon',nom:'Fourgon',ico:'🚐',price:4200,spd:12.8,noise:1.7,stash:30,fuel:140,col:0xd9d4c8,
  d:'Le gros bras : +30 g de coffre, mais très bruyant.'},
];
const VEH_BY_ID=Object.fromEntries(VEH.map(v=>[v.id,v]));
/* le vélo est une entrée comme les autres : gratuit, toujours possédé */
function vehList(){return [{id:'velo',nom:'Vélo',ico:'🚲',price:0,spd:9,noise:1,fuel:0,stash:0,
  d:'Gratis, silencieux, mais lent.'}].concat(VEH);}
function vehOwned(id){return id==='velo'||!!(S.veh&&S.veh[id]&&S.veh[id].own);}
function vehData(id){return id==='velo'?vehList()[0]:VEH_BY_ID[id];}
function vehFuel(id){if(id==='velo')return 1;return clamp01((S.veh[id].fuel||0)/vehData(id).fuel);}
function vehTank(id){return S.veh[id].fuel||0;}

/* le coffre du véhicule conduit ajoute de la place à la planque */
function trunkBonus(){
 try{if(typeof player==='undefined'||!player||!player.mount)return 0;
  if(player.mount==='velo'||!vehOwned(player.mount))return 0;
  return vehData(player.mount).stash||0;}catch{return 0;}}
/* silhouette de scooter : plus compacte qu'une voiture, deux roues visibles */
function scooterMesh(){
 const g=new THREE.Group();
 const body=new THREE.MeshStandardMaterial({color:0xd8d24a,roughness:.3,metalness:.55,envMapIntensity:1.3});
 const dark=new THREE.MeshStandardMaterial({color:0x14161c,roughness:.85});
 const chrome=new THREE.MeshStandardMaterial({color:0xc9d2dd,roughness:.2,metalness:.9});
 const deck=new THREE.Mesh(new THREE.BoxGeometry(.42,.16,1.1),body);
 deck.position.set(0,.42,0);g.add(deck);
 const seat=new THREE.Mesh(new THREE.BoxGeometry(.34,.2,.62),dark);
 seat.position.set(0,.66,-.22);g.add(seat);
 const front=new THREE.Mesh(new THREE.BoxGeometry(.34,.5,.3),body);
 front.position.set(0,.62,.62);front.rotation.x=-.22;g.add(front);
 const shield=new THREE.Mesh(new THREE.BoxGeometry(.38,.34,.06),
  new THREE.MeshStandardMaterial({color:0x9fd8ff,roughness:.12,metalness:.3,transparent:true,opacity:.55}));
 shield.position.set(0,.92,.66);shield.rotation.x=-.22;g.add(shield);
 const bar=new THREE.Mesh(new THREE.BoxGeometry(.62,.06,.06),chrome);
 bar.position.set(0,1.02,.6);g.add(bar);
 for(const z of [.62,-.56]){
  const w=new THREE.Mesh(new THREE.TorusGeometry(.26,.09,8,16),dark);
  w.position.set(0,.26,z);g.add(w);}
 const head=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),
  new THREE.MeshBasicMaterial({color:0xfff2b0}));
 head.position.set(0,.86,.78);g.add(head);
 const tail=new THREE.Mesh(new THREE.BoxGeometry(.16,.08,.05),
  new THREE.MeshBasicMaterial({color:0xff4455}));
 tail.position.set(0,.72,-.58);g.add(tail);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return g;}

/* le véhicule acheté le plus proche : c'est lui qu'on propose de monter */
function nearVehData(){
 let best=null,bd=2.9;
 if(player.riding)return null;
 for(const v of vehList()){
  if(v.id==='velo'||!vehOwned(v.id))continue;
  const p=S.veh[v.id];if(!p)continue;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  if(d<bd){bd=d;best=v;}}
 return best;}
function nearVeh(){return nearVehData()||vehList()[0];}
/* bruit : chaque véhicule a sa propre signature pour les flics */
function rideNoise(){return player&&player.mount?vehData(player.mount).noise:1;}
/* constructeurs de meshes : on réutilise buildCar pour les vrais véhicules */
const vehMeshCache={};
function vehMesh(v){
 if(vehMeshCache[v.id])return vehMeshCache[v.id].clone();
 let g;
 if(v.id==='velo')g=bike.mesh.clone();
 else if(v.id==='scoot')g=scooterMesh();
 else g=buildCar(v.col,false,v.id==='fourgon'?'van':'sedan');
 vehMeshCache[v.id]=g;return g.clone();}
function vehPos(id){return id==='velo'?bike.pos:(S.veh[id]?new THREE.Vector3(S.veh[id].x,0,S.veh[id].z):null);}
function vehRy(id){return id==='velo'?0:((S.veh[id]&&S.veh[id].ry)||0);}
/* --- la concession du garage --- */
function renderVeh(){
 const el=$('vehBox');if(!el)return;
 el.innerHTML='';
 vehList().forEach(v=>{
  const own=vehOwned(v.id),f=own?vehFuel(v.id):0;
  const d=document.createElement('div');d.className='upg';
  const left=own&&v.fuel>0?' · réservoir '+Math.round(f*100)+'%':'';
  d.innerHTML='<div style="font-size:26px">'+v.ico+'</div><div class="inf"><b>'+v.nom+left+'</b>'+
   '<br><span style="color:var(--muted)">'+v.d+'</span>'+
   '<br><small style="opacity:.7">vitesse '+v.spd.toFixed(1)+' • bruit ×'+v.noise.toFixed(2)+
   (v.stash?' • coffre +'+v.stash+' g':'')+'</small></div>';
  if(own){
   const box=document.createElement('div');box.style.cssText='display:flex;flex-direction:column;gap:5px';
   if(v.fuel>0&&f<.35){
    const fill=document.createElement('button');fill.className='bigbtn';
    fill.style.cssText='margin:0;min-height:40px;background:#22d3ee;color:#06210f';
    fill.textContent='⛽ Faire le plein (40 €)';
    fill.disabled=S.money<40;fill.style.opacity=S.money<40?.5:1;
    fill.onclick=()=>{if(S.money<40)return;S.money-=40;S.veh[v.id].fuel=v.fuel;
     sndCash();toast('⛽ '+v.nom+' — reservoir plein','gold');save();renderSafe();syncHUD();};
    box.appendChild(fill);}
   const go=document.createElement('button');go.className='bigbtn';
   go.style.cssText='margin:0;min-height:40px;background:#223;color:#fff';
   const onIt=player.riding&&player.mount===v.id;
   go.textContent=onIt?'🛑 Descendre':(v.id==='velo'?'🚲 Utiliser':'🛵 Utiliser');
   go.disabled=player.riding&&!onIt;
   go.style.opacity=go.disabled?.45:1;
   go.onclick=()=>{
    if(player.mount===v.id){dismount();return;}
    mountVeh(v.id);};
   box.appendChild(go);
   d.appendChild(box);
  }else{
   const b=document.createElement('button');b.className='bigbtn';
   b.style.cssText='margin:0;min-height:40px;background:'+(S.money>=v.price?'#3ddc74':'#2a3a30')+';color:#fff';
   b.textContent=v.price+' €';
   b.disabled=S.money<v.price;b.style.opacity=S.money<v.price?.5:1;
   b.onclick=()=>{
    if(S.money<v.price){toast('💰 '+v.price+' € requis','warn');return;}
    S.money-=v.price;S.veh[v.id]={own:true,fuel:v.fuel,x:9.5,z:-6,ry:0};
    sndCash();toast('🚗 '+v.nom+' acheté —-stationné au garage','gold',3000);
    save();renderSafe();syncHUD();};
   d.appendChild(b);}
  el.appendChild(d);});}
/* monter / descendre : le vélo passe par l'ancien chemin pour ne rien casser */
function mountVeh(id){
 const v=vehData(id);
 if(v.fuel>0&&vehFuel(id)<=.02){toast('⛽ '+v.nom+' : réservoir vide','warn');return;}
 // on gare ce qu'on montait avant, sinon il reste planté sur la chaussée
 if(player.mount&&player.mount!=='velo'&&S.veh[player.mount]){
  S.veh[player.mount].x=player.pos.x;S.veh[player.mount].z=player.pos.z;S.veh[player.mount].ry=player.yaw;}
 player.mount=id;player.riding=true;
 vehMeshRef(v);vib(18);sndBlip(520);
 toast(v.ico+' '+v.nom+' — ⚡ pour accélérer','gold');}
function dismount(){
 const id=player.mount;
 player.riding=false;
 if(id&&id!=='velo'&&S.veh[id]){
  S.veh[id].x=player.pos.x;S.veh[id].z=player.pos.z;S.veh[id].ry=player.yaw;
  // on range le véhicule à côté, pas dessous
  S.veh[id].x+=Math.cos(player.yaw+1.2)*2.2;S.veh[id].z-=Math.sin(player.yaw+1.2)*2.2;
  vehPark(id);}
 else{bike.pos.set(player.pos.x,0,player.pos.z);S.bike.x=player.pos.x;S.bike.z=player.pos.z;}
 player.mount=null;save();}
/* le véhicule conduit suit le joueur */
const vehRefs={};
function vehMeshRef(v){
 if(!vehRefs[v.id]){const m=vehMesh(v);scene.add(m);vehRefs[v.id]=m;}
 const m=vehRefs[v.id];
 // conduit = le maillage suit le joueur ; garé = il reste à sa place
 if(player.riding&&player.mount===v.id){
  m.visible=true;m.position.set(player.pos.x,0,player.pos.z);m.rotation.y=player.yaw;
 }else{
  const p=vehPos(v.id);
  if(p){m.visible=true;m.position.set(p.x,0,p.z);m.rotation.y=vehRy(v.id);}
  else m.visible=false;}
 return m;}
function vehPark(id){
 const m=vehRefs[id];if(!m)return;
 const p=vehPos(id);if(!p)return;
 m.position.set(p.x,0,p.z);m.rotation.y=vehRy(id);m.visible=true;}
/* consommation : plus on roule vite, plus on brûle */
function vehFuelTick(distance){
 const id=player.mount;
 if(!id||id==='velo'||!S.veh[id])return;
 const v=vehData(id);
 S.veh[id].fuel=Math.max(0,(S.veh[id].fuel||0)-distance*0.012);
 if(S.veh[id].fuel<=0&&player.riding){toast('⛽ Panne sèche !','warn',3000);
  dismount();}
}

/* 📊 Statistiques — la feuille existait, la fonction manquait : le bouton ne marchait pas. */
function statsHTML(){
 const hrs=Math.max(.25,S.playT/3600);
 const gSold=S.qSum||0;
 const revenue=(S.totalEarned||0)/hrs;
 const perG=gSold>0?(S.totalEarned||0)/gSold:0;
 const clean=(S.totalSold||0)>0?Math.round(100*(S.clients||0)/((S.totalSold||0)+(S.bustedN||0))):100;
 const line=(lab,val,col)=>'<div style="display:flex;justify-content:space-between;gap:10px;'+
  'padding:5px 0;border-bottom:1px solid rgba(255,255,255,.08)">'+
  '<span style="opacity:.85">'+lab+'</span><b'+(col?' style="color:'+col+'"':'')+'>'+val+'</b></div>';
 const best=genomeOf((S.bestGx|0));
 return '<div style="text-align:left">'+
  '<div style="font-weight:900;margin:4px 0 8px">Niveau '+S.level+' • '+
  RANKS[rankIdx()].ico+' '+RANKS[rankIdx()].nom+' • '+REPNAME[repTier()]+' ('+S.rep+')</div>'+
  line('⏱ Temps de jeu',Math.floor(S.playT/60)+' min')+
  line('💰 Revenus totaux',Math.round(S.totalEarned||0)+' €','var(--gold)')+
  line('📈 Revenus',Math.round(revenue)+' €/h','var(--gold)')+
  line('⚖️ Prix moyen',Math.round(perG*10)/10+' €/g')+
  line('🌿 Herbe vendue',Math.round(gSold*10)/10+' g')+
  line('🤝 Deals discrets',(S.totalSold||0)+' dont '+(S.haggled||0)+' négo')+
  line('✅ Taux de deals propres',clean+' %',clean>=80?'#3ddc74':clean>=50?'#ffd166':'#ff6b6b')+
  line('💸 Recours d\'urgence',(S.rescues||0)+' fois',(S.rescues||0)>3?'#ff6b6b':'')+
  line('🛡 Contrôles subis',(S.raids||0)+' • '+Math.max(0,S.bustStreak||0)+' interception(s)')+
  line('🧬 Mutations / croisements',(S.muts|0)+' / '+(S.crossed|0))+
  line('🏆 Meilleur lot',S.bestGrade||'—',S.bestGrade==='A'?'#3ddc74':'')+
  line('💎 Clients VIP vendus',(S.vipSold|0))+
  line('🌆 Jours écoulés','J'+S.dayN)+
  (best?line('🧬 Meilleure souche',best.nom+' ('+Math.round((best.thc||1)*100)+'% THC)'):'')+
  line('📦 Sur toi / planque',Math.round(S.stock*10)/10+' g / '+Math.round(S.stash*10)/10+' g ('+stashCap()+' max)')+
  line('🚨 Niveau de recherche',Math.round(S.wanted*20)+' %',S.wanted>3?'#ff2d55':S.wanted>1.5?'#ffd166':'#3ddc74');
 '</div>';}
$('pStatsBtn').onclick=()=>{switchSheet('');paused=false;$('statsBody').innerHTML=statsHTML();$('statsSheet').classList.add('open');};
$('pSpeed').onclick=()=>setSpeed(S.timeScale>=4?1:S.timeScale*2);
$('pWipe').onclick=()=>{if(!S.genomes.length){toast('Aucune souche à effacer','warn');return;}
 if(confirm('Effacer toutes tes souches mutantes ?')){S.genomes=[];S.muts=0;toast('🧬 Labo vidé');save();renderLab();syncHUD();}};
$('btnSpeed').onclick=()=>{vib(8);setSpeed(S.timeScale>=4?1:S.timeScale*2);};
$('btnLab').onclick=()=>{vib(8);switchSheet('labSheet');};
$('rankbar').onclick=()=>{vib(8);openProg();};
$('helpBtn').onclick=()=>$('helpCard').classList.toggle('open');$('helpClose').onclick=()=>$('helpCard').classList.remove('open');
// le bouton carrière n'existe que sur mobile large : le panneau de carrière est
// accessible via la barre dorée, qui est toujours cliquable
const careerBtn=$('btnCareer');
if(careerBtn)careerBtn.onclick=()=>{vib(8);openProg();};
/* pause */
function togglePause(){paused=!paused;$('pauseSheet').classList.toggle('open',paused);if(paused){sirenStop();}syncPause();}
$('pauseBtn').onclick=togglePause;$('pResume').onclick=togglePause;
$('pSound').onclick=()=>{S.sound=!S.sound;save();syncPause();if(!S.sound)sirenStop();};
$('pMusic').onclick=()=>{S.music=!S.music;save();syncPause();};
$('pRain').onclick=()=>{S.rain=!S.rain;save();syncPause();};
$('pQuality').onclick=()=>{S.hq=!S.hq;applyQ();save();syncPause();};
$('pHelp').onclick=()=>{$('pauseSheet').classList.remove('open');paused=false;$('helpCard').classList.add('open');};
$('pReset').onclick=()=>{if(confirm('Recommencer la partie ?')){localStorage.removeItem(SAVE_KEY);location.reload();}};
function syncPause(){syncSpeedUI();
 $('pSound').textContent=S.sound?'🔊 Son : ON':'🔇 Son : OFF';$('pRain').textContent=S.rain?'🌧 Pluie : ON':'🌧 Pluie : OFF';
 $('pQuality').textContent=S.hq?'✨ Qualité : HD':'⚡ Qualité : Éco';$('pLvl').textContent=S.level;
 $('pStats').textContent=Math.floor(S.money)+' € • '+(Math.round((S.stock+S.stash)*10)/10)+'g • '+S.clients+' clients • '+S.delivered+' livraisons • '+S.bustedN+' amendes • J'+S.dayN;
 $('pMusic').textContent=S.music?'🎵 Musique : ON':'🎵 Musique : OFF';}
/* ===== ÉVÉNEMENTS ALÉATOIRES ===== */
const EVENTS=[
 {id:'raid',ico:'🚓',nom:'Contrôle à domicile',min:4,max:8,weight:3},
 {id:'vip', ico:'💎',nom:'Client VIP',min:2,max:4,weight:3},
 {id:'rush',ico:'🌃',nom:'Nuit de spawn',min:1,max:3,weight:2},
 {id:'bonus',ico:'🎁',nom:'Cadeau surprise',min:3,max:6,weight:2},
];
let ev=null,evT=0;
function pickEvent(){
 const hours=Math.floor(S.hour);
 const pool=EVENTS.filter(e=>hours>=e.min&&hours<=e.max);
 if(!pool.length)return;
 let tot=0;pool.forEach(e=>tot+=e.weight);
 let r=Math.random()*tot;
 for(const e of pool){r-=e.weight;if(r<=0)return e.id;}
 return pool[0].id;}
function fireEvent(id){
 if(id==='raid'){
  if(S.stock<=0){toast('🚓 Contrôle surprise… rien à saisir.','gold');return;}
  const lost=Math.ceil(S.stock*(.3+Math.random()*.3)*(S.sealed?.5:1));
  S.stock-=lost;
  toast('🚓 <b>CONTROLE !</b> -'+lost+'g saisies sur toi !'+(S.sealed?' 🛡 scellés customs : moitié du lot':'!'),'warn',4200);
  sndBlip(180);vib(70);if(S.stock<=.1){S.stock=0;S.qSum=0;}
  S.raids=(S.raids|0)+1;}
 else if(id==='vip'){
  const c=newClient(clients.length);clients.push(c);c.vip=true;c.demand=8+Math.floor(Math.random()*4);
  c.gen=2.2+Math.random()*.6;c.pat=28;c.patMax=28;c.mesh.scale.setScalar(1.12);
  const s=pickSpot();c.x=s[0];c.z=s[1];c.mesh.position.set(c.x,0,c.z);
  toast('💎 Un <b>client VIP</b> est arrivé : paie ×2 mais veut 8-11g !','gold',4200);
  sndBlip(760);}
 else if(id==='rush'){
  S.rushT=40;
  clients.forEach(c=>{c.pat=Math.max(c.pat,60);c.patMax=Math.max(c.patMax,60);c.demand+=3;});
  toast('🌃 <b>Nuit de spawn !</b> Clients affamés pendant 40 s… mais les flics aussi.','gold',4200);
  sndBlip(520);}
 else if(id==='bonus'){
  const roll=Math.random();
  if(roll<.35){S.stash=Math.min(stashCap(),S.stash+3);toast('🎁 3g déposeront dans ta planque !','gold');}
  else if(roll<.6){S.seeds.classique+=2;toast('🎁 2 graines Classique !','gold');}
  else if(roll<.8){S.money+=40;toast('🎁 40 € trouvés !','gold');}
  else{S.wanted=Math.max(0,S.wanted-.5);toast('🎁 Un contact a étouffé un rapport : -0,5★','gold');}
  sndBlip(880);}
 missionCheck();save();syncHUD();}
function eventTick(dt){
 if(S.rushT>0)S.rushT-=dt;
 evT-=dt;
 if(evT>0)return;
 evT=55+Math.random()*80;
 const id=pickEvent();
 if(!id)return;
 fireEvent(id);}
/* ===== DIALOGUES CLIENTS ===== */
const LINES={
 fetard:["Yo chef ! Qué Beau produit t'as là ? 😄","Je paie cash, j'suis paspressé !","Balance, j'en veux !"],
 regulier:["Salut, comme d'hab 🙂","T'as quelque chose de propre aujourd'hui ?","Toujours fidèle, tu me connais."],
 mefiant:["...c'est quoi ce deal ?","Fais pas de bruit, hein.","Je veux du rapide, sans histoire."],
 vip:["Je ne répète pas. Vite. 💎","La qualité d'abord. Je paie le prix fort.","Personne ne doit savoir."],
};

function clientLine(c){
 const key=c.vip?'vip':(['fetard','regulier','mefiant'][c.type]||'regulier');
 const arr=LINES[key];
 let t=arr[(c.lineN=(c.lineN|0)+1)%arr.length];
 if(c.loyal>=3)t+=' ❤️';
 if(repTier()>=3)t+=' On se connaît bien !';
 return t;}
/* négociation en bluff : 3 rounds, le bluff monte ou casse le deal */
let bluff=null;
function startBluff(){
 bluff={round:0,mult:1,level:0};
 toast('😏 <b>Négociation</b> : bluffe 3 fois. Le client s\'impatiente à chaque bluff.','gold',3200);
 refreshSell();}
/* bluffer monte d'un cran (+7%), reculer en redescend d'un seul cran (−7%).
   Reculer ne tue donc plus la négo : c'est un vrai choix, pas un piège.
   Un tour est toujours consommé, et reculer rend de la patience. */
function bluffStep(up){
 const c=sellTarget;if(!c||!bluff)return;
 const before=bluff.level;
 bluff.level=up?Math.min(4,bluff.level+1):Math.max(0,bluff.level-1);
 bluff.mult=Math.max(1,bluff.mult*(up?1.07:.93));
 bluff.round++;
 // monter coûte la patience du client, reculer lui en rend un peu
 const delta=(up?7:-4)*Math.abs(bluff.level-before);
 if(delta>0){
  if(c.pat<delta+8){toast('😤 Il n\'a plus confiance — il part.','warn');closeSell();return;}
  c.pat-=delta;}
 else if(delta<0)c.pat=Math.min(c.patMax,c.pat-delta);   // reculer : on lui rend de la patience
 c.haggled=true;
 if(bluff.round>=3){
  c.gen*=bluff.mult;
  toast('😏 Accord conclu ! Prix ×'+bluff.mult.toFixed(2)+' — mais il jette un œil 👀','gold',3600);
  sndBlip(880);bluff=null;S.haggled++;missionCheck();closeSell();save();syncHUD();return;}
 if(!up&&before>0)toast('😅 Tu adoucis le ton — il se détend un peu.','warn',2000);
 else toast('😏 Tu bluffes bien — round '+bluff.round+'/3 • prix ×'+bluff.mult.toFixed(2),'gold',2200);
 sndBlip(up?760:420);refreshSell();}
function closeSell(){bluff=null;$('sellSheet').classList.remove('open');sellTarget=null;}
let DELIV=null,offerCd=40;
const RIVALS=[
 Object.assign({nom:'Zoé',x:3,z:5,wi:0,mesh:null},RIVAL_PERSONA['Zoé']),
 Object.assign({nom:'Malik',x:-14,z:16,wi:0,mesh:null},RIVAL_PERSONA['Malik'])];
function initRivals(){RIVALS.forEach(r=>{const m=makePerson(r.col,0x1a1a24);m.position.set(r.x,0,r.z);scene.add(m);
 r.mesh=m;const mk=marker(r.ico,r.col===0xb03060?'#ff6fb5':'#4cc3ff');mk.scale.set(.8,.8,1);mk.position.set(r.x,2.7,r.z);r.mk=mk;scene.add(mk);});}
initRivals();
function rivalTick(dt){
 S.rivalCd-=dt;
 if(S.rivalCd<=0){S.rivalCd=22+Math.random()*16;
  const R=RIVALS[Math.floor(Math.random()*RIVALS.length)];
  let best=null,bd=1e9;
  for(const c of clients){
   if(c.vip)continue;                       // les VIP ignorent la concurrence
   if(c.pat<c.patMax*.4)continue;
   const d=dist2(R.x,R.z,c.x,c.z);if(d<bd){bd=d;best=c;}}
  if(best&&bd<46){
   const steal=Math.max(1,Math.round(2*R.vol));
   best.demand=Math.max(0,best.demand-steal);
   best.pat=Math.max(4,best.pat-Math.round(7*R.vol));
   // Malik augmente le prix : c'est un luxe, pas du volume
   if(R.style==='premium')best.gen*=1.06;
   S.wanted=Math.min(5,S.wanted+R.heat*.35); // Zoé attire plus les flics
   toast(R.style==='discount'
    ?'👤 <b>'+R.nom+'</b> brade : -'+steal+'g de demande sur un client proche'
    :'👤 <b>'+R.nom+'</b> propose mieux : un client nearby vaut +6%',R.style==='discount'?'warn':'');
   sndBlip(320);}
 }
 for(const r of RIVALS){
  const l=openSpots();const path=l.flat().filter((_,i)=>i%2===0);
  const wp=path[(r.wi+Math.floor(performance.now()/9000))%path.length];
  const dx=wp[0]-r.x,dz=wp[1]-r.z,L=Math.hypot(dx,dz);
  if(L<2)r.wi++;
  else{const sp=2.6;r.x+=dx/L*sp*dt;r.z+=dz/L*sp*dt;r.mesh.rotation.y=Math.atan2(dx,dz);animWalk(r.mesh,performance.now()/1000,.5,sp*2.4);}
  r.mesh.position.set(r.x,0,r.z);r.mk.position.set(r.x,2.75+Math.sin(performance.now()/700)*.1,r.z);
  r.mk.material.rotation+=dt*.6;}
}
let _rpos={x:0,z:0};function rivalPos(){_rpos.x=(RIVALS[0].x+RIVALS[1].x)/2;_rpos.z=(RIVALS[0].z+RIVALS[1].z)/2;return _rpos;}
const delivBeam=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,9,12,1,true),
 new THREE.MeshBasicMaterial({color:0xb892ff,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));
delivBeam.visible=false;scene.add(delivBeam);
function offerDeliv(){const pool=openSpots().flat();let s=pool[Math.floor(Math.random()*pool.length)],tries=0;
 while(dist2(player.pos.x,player.pos.z,s[0],s[1])<25&&tries++<12)s=pool[Math.floor(Math.random()*pool.length)];
 const qty=4+Math.floor(Math.random()*5);
 DELIV={x:s[0],z:s[1],qty,reward:qty*11+40,left:80,offerT:20,state:'offer'};
 delivBeam.position.set(s[0],4.5,s[1]);delivBeam.visible=true;sndBlip(700);renderDeliv();}
function renderDeliv(){const el=$('deliv');if(!DELIV){el.classList.remove('show');return;}
 el.classList.add('show');
 if(DELIV.state==='offer'){el.innerHTML='📦 <b>Commande :</b> '+DELIV.qty+'g — <b>+'+DELIV.reward+' €</b><br><small>Point violet, 80s une fois acceptée • <b id="delivT"></b></small><br><button id="dOk" style="background:#3ddc74">Accepter</button><button id="dNo" style="background:#223;color:#fff">Refuser</button>';
  $('dOk').onclick=()=>{DELIV.state='go';sndBlip(700);renderDeliv();};
  $('dNo').onclick=()=>{DELIV=null;offerCd=45;delivBeam.visible=false;renderDeliv();};}
 else{el.innerHTML='📦 Livre <b>'+DELIV.qty+'g</b> au point violet ! <b>'+Math.ceil(DELIV.left)+'s</b> — +'+DELIV.reward+' €<br><button id="dAb" style="background:#223;color:#fff">Abandonner</button>';
  $('dAb').onclick=()=>{DELIV=null;offerCd=45;delivBeam.visible=false;renderDeliv();toast('Commande annulée');};}
}
function delivTick(dt){
 if(!DELIV){offerCd-=dt;if(offerCd<=0)offerDeliv();return;}
 if(DELIV.state!=='go'){DELIV.offerT-=dt;
  if(DELIV.offerT<=0){DELIV=null;offerCd=30;delivBeam.visible=false;renderDeliv();return;}
  $('delivT').textContent='⏱ '+Math.ceil(DELIV.offerT)+'s';return;}
 DELIV.left-=dt;
 if(DELIV.left<=0){DELIV=null;offerCd=45;delivBeam.visible=false;renderDeliv();toast('⏰ Trop lent ! La commande est annulée','warn');return;}
 if(dist2(player.pos.x,player.pos.z,DELIV.x,DELIV.z)<3.5){
  if(S.stock>=DELIV.qty){S.stock-=DELIV.qty;S.money+=DELIV.reward;S.totalEarned+=DELIV.reward;S.totalSold+=DELIV.qty;S.clients++;S.delivered++;
   gainXp(30);sndCash();vib(25);toast('📦 Livraison OK : +'+DELIV.reward+' € !','gold');
   S.wanted=Math.min(5,S.wanted+.5);S.maxWanted=Math.max(S.maxWanted,S.wanted);alarmT=Math.max(alarmT,4);
   DELIV=null;offerCd=50;delivBeam.visible=false;renderDeliv();missionCheck();save();syncHUD();}
  else if(!DELIV.warned){DELIV.warned=true;toast('Il te manque de l\'herbe ('+DELIV.qty+'g) !','warn');}
 }
}
