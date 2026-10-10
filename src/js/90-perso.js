/* ==== 90-perso.js — Personnages, simulation ==== */
/* ============ SIMULATION ============ */
function collide(px,pz){const r=.6;for(const s of solids){
 const cx=Math.max(s.x0,Math.min(px,s.x1)),cz=Math.max(s.z0,Math.min(pz,s.z1));
 const dx=px-cx,dz=pz-cz,d=Math.hypot(dx,dz);
 if(d<r){if(d<.001){px+=r;}else{px=cx+dx/d*r;pz=cz+dz/d*r;}}}
 px=Math.max(-215,Math.min(215,px));pz=Math.max(-90,Math.min(215,pz));return[px,pz];}
function pointInSolid(x,z,r){
 for(const s of solids){
  if(x>s.x0-r&&x<s.x1+r&&z>s.z0-r&&z<s.z1+r)return true;}
 return false;}
function losBlocked(ax,az,bx,bz){for(const s of solids){
 const dx=bx-ax,dz=bz-az;let t0=0,t1=1,ok=true;
 if(Math.abs(dx)<1e-8){if(ax<s.x0||ax>s.x1)ok=false;}else{let a=(s.x0-ax)/dx,b=(s.x1-ax)/dx;if(a>b){const t=a;a=b;b=t;}t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)ok=false;}
 if(ok){if(Math.abs(dz)<1e-8){if(az<s.z0||az>s.z1)ok=false;}else{let a=(s.z0-az)/dz,b=(s.z1-az)/dz;if(a>b){const t=a;a=b;b=t;}t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)ok=false;}}
 if(ok&&t1>0&&t0<1)return true;}return false;}
function copSight(c){let s=c.type==='car'?18:15;
 if(player.sneak)s*=.55;if(player.hidden)s*=.3;if(player.riding)s*=rideNoise();
 if(S.coat)s*=.85;
 if(S.charmT>0)s*=.75;
 if(alarmT>0)s*=1.35;if(S.stock>20)s*=1.2;
 const dist=districtAt(player.pos.x,player.pos.z);
 if(dist)s*=dist.risk;
 // plus tu montes en rang, plus les patrouilles te cherchent
 s*=1+rankIdx()*.09;
 // météo : la brume protège, la pluie gêne les flics, le soleil te grille
 if(S.weather==='fog')s*=.6;
 if(S.weather==='rain')s*.85;
 if(S.weather==='clear')s*=1.1;
 if(informantActive())s*=.62;   // ton mouchard détourne leur regard
 return s;}
function seesPlayer(c){const d=dist2(c.pos.x,c.pos.z,player.pos.x,player.pos.z);
 if(d>copSight(c))return false;
 const ang=Math.atan2(player.pos.x-c.pos.x,player.pos.z-c.pos.z);
 const da=Math.abs(((ang-c.dir+Math.PI*3)%(Math.PI*2))-Math.PI);
 if(da>=1.0&&d>=3.2)return false;
 return !losBlocked(c.pos.x,c.pos.z,player.pos.x,player.pos.z);}
function copTick(dt){
 const wasChase=chase;chase=cops.some(c=>c.state==='chase');
 $('chase').style.display=chase?'block':'none';
 if(chase&&!wasChase){sirenStart();setMusicState('chase');}
 if(!chase&&wasChase){sirenStop();setMusicState('calm');}
 // renfort à 3★+
 if(S.wanted>=3&&!cops.some(c=>c.extra)){const a=player.pos.x+8,b=player.pos.z+8;
  const c=footCop([[a,b],[a-14,b],[a-14,b-10],[a,b-10]],2.8);c.extra=true;c.pos.set(a,0,b);
  toast('🚨 <b>Renforts appelés !</b>','warn');}
 for(const c of cops){
  const sp=c.state==='chase'?(c.type==='car'?6.6:5.4):(c.type==='car'?5:2.4);
  let tx,tz;
  if(c.state==='chase'){
   if(!c.lastSeen)c.lastSeen=new THREE.Vector3(c.pos.x,0,c.pos.z);
   if(seesPlayer(c)){c.lastSeen.set(player.pos.x,0,player.pos.z);c.lost=0;}
   else{c.lost+=dt;if(c.lost>4){c.state='search';c.searchT=0;}}
   tx=c.lastSeen.x;tz=c.lastSeen.z;
   if(dist2(c.pos.x,c.pos.z,player.pos.x,player.pos.z)<(c.type==='car'?2.2:1.7)){busted();return;}
  } else if(c.state==='search'){
   tx=c.lastSeen.x;tz=c.lastSeen.z;
   if(seesPlayer(c)){c.state='chase';c.lost=0;c.counted=false;}
   else if(dist2(c.pos.x,c.pos.z,tx,tz)<1.8){c.searchT=(c.searchT||0)+dt;c.dir+=dt*2.4;
    if(c.searchT>3.2){c.state='patrol';c.meter=0;
     if(chaseTime>6&&!c.counted){c.counted=true;S.escaped++;gainXp(40);toast('💨 Tu les as semés ! +40 XP','gold');missionCheck();}}}
  } else {
   const wp=c.path[c.wi% c.path.length];tx=wp[0];tz=wp[1];
   if(dist2(c.pos.x,c.pos.z,tx,tz)<1.5)c.wi=(c.wi+1)%c.path.length;
    const d=dist2(c.pos.x,c.pos.z,player.pos.x,player.pos.z);
    const sight=copSight(c);
    if(d<sight){
     const ang=Math.atan2(player.pos.x-c.pos.x,player.pos.z-c.pos.z);
     const da=Math.abs(((ang-c.dir+Math.PI*3)%(Math.PI*2))-Math.PI);
     if(da<1.0||d<3.2){
      if(!losBlocked(c.pos.x,c.pos.z,player.pos.x,player.pos.z)){
       let rate=(1-d/sight)*36+(S.wanted*7)+(alarmT>0?22:0)+(S.stock>20?7:0)+((sprintHold&&d<10)?10:0);
      if(player.hidden)rate*=.3;
      c.meter=Math.min(100,c.meter+rate*dt);
      if(c.meter>=100){c.state='chase';c.lost=0;c.counted=false;chaseTime=0;vib(50);sfxAlarm();
       toast('🚨 <b>Repéré ! COURS !</b>','warn');}
     } else c.meter=Math.max(0,c.meter-25*dt);
    } else c.meter=Math.max(0,c.meter-20*dt);
   } else c.meter=Math.max(0,c.meter-20*dt);
  }
  const dx=tx-c.pos.x,dz=tz-c.pos.z,L=Math.hypot(dx,dz);
  if(L>.05){const want=Math.atan2(dx,dz);let dd=((want-c.dir+Math.PI*3)%(Math.PI*2))-Math.PI;c.dir+=Math.max(-3*dt,Math.min(3*dt,dd));
   const wob=c.type==='car'?0:Math.sin(performance.now()/300)*.06;
   c.pos.x+=Math.sin(c.dir)*sp*dt;c.pos.z+=Math.cos(c.dir)*sp*dt;
   const off=c.type==='car'?Math.PI/2:0;
   c.mesh.position.set(c.pos.x,c.type==='car'?0:(c.state==='chase'?Math.abs(Math.sin(performance.now()/90))*.12:0),c.pos.z);
   c.mesh.rotation.y=c.dir+wob+off;
   if(c.type==='foot')animWalk(c.mesh,performance.now()/1000,.55,sp*2.2);
   if(c.cone){c.cone.position.set(c.pos.x,.06,c.pos.z);c.cone.rotation.z=-c.dir-off;
    c.cone.material.opacity=c.state==='chase'?.3:.13;
    c.cone.material.color.set(c.state==='chase'?0xff0000:0xff3344);}
   if(c.alert){const chasing=c.state==='chase';c.alert.visible=chasing||c.meter>40;
    if(chasing&&!c._was){c._was=true;if(c.type==='foot'){c.alert.material.map=texMark('!!','#ff2222');c.alert.material.needsUpdate=true;}}
    if(!chasing&&c._was){c._was=false;if(c.type==='foot'){c.alert.material.map=texMark('?','#ffd166');c.alert.material.needsUpdate=true;}}}
  }
 }
 if(chase)chaseTime+=dt;
 if(alarmT>0)alarmT-=dt;
 if(S.lawT>0)S.lawT-=dt;
 if(!chase&&alarmT<=0){wantedT+=dt;if(wantedT>20&&S.wanted>0){wantedT=0;S.wanted=Math.max(0,S.wanted-.5);}}
 if(player.safe)wantedT+=dt*3;
}
function rnd2(a){return (Math.random()-.5)*2*a;}
function growTick(dt){
 growTick2(dt);dryTick(dt);
 potVis.forEach((pl,i)=>{const p=S.pots[i];
  const G=p.gx!=null?genomeOf(p.gx):null;
  const col=G?G.couleur:STRAINS[p.s||0].col;
  const key=p.planted?Math.round(p.g/5)+':'+col+(p.pest?'!':''):('x'+col);
  if(pl.userData.k===key)return;pl.userData.k=key;
  while(pl.children.length)pl.remove(pl.children[0]);
  if(!p.planted)return;const s=p.g/100;
  let mats=stemMats.get(col);
  if(!mats){mats={stem:new THREE.MeshStandardMaterial({color:col,roughness:.85}),
   leaf:new THREE.MeshStandardMaterial({color:col,side:THREE.DoubleSide}),
   bud:new THREE.MeshStandardMaterial({color:col,flatShading:true})};
   stemMats.set(col,mats);}
  const stem=new THREE.Mesh(stemGeo,mats.stem);stem.scale.y=(.5+s*.9);stem.position.y=(.5+s*.9)/2;pl.add(stem);
  const n=4+Math.floor(s*5);
  const skew=G?(G.vit-1)*.25:0;
  for(let k=0;k<n;k++){const l=new THREE.Mesh(leafGeo,mats.leaf);const a=k/n*6.28;
   l.scale.setScalar(1+skew*.4);
   l.position.set(Math.cos(a)*.25,.3+(k%3)*.3*s+.3+skew*.3,Math.sin(a)*.25);
   l.rotation.set(-.6,a,.1*skew);pl.add(l);}
  if(s>.6){const bud=new THREE.Mesh(budGeo,mats.bud);
   const bs=(.6+s*.75)*(G?Math.min(1.8,G.rend*.6+.4):1);
   bud.scale.setScalar(bs);bud.position.y=.9+s*.5+skew*.2;pl.add(bud);
   if(G&&G.rend>1.5){const cb=new THREE.Points(crystGeo,new THREE.PointsMaterial({color:0xffffff,size:.05,transparent:true,opacity:.8}));
    cb.position.y=.9+s*.5;pl.add(cb);}}
  if(p.fragile){const warn=new THREE.Mesh(frailGeo,new THREE.MeshBasicMaterial({color:0xff4d6d,transparent:true,opacity:.3+Math.sin(now/300)*.15}));
   warn.position.y=.7;pl.add(warn);}
  // ravageurs : petits points blancs qui flottent sur le feuillage
  if(p.pest)for(let k=0;k<5;k++){const b=new THREE.Mesh(new THREE.SphereGeometry(.03,4,3),
     new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7}));
    b.position.set(rnd2(.3),.5+s+rnd2(.3),rnd2(.3));pl.add(b);}});

 // patience clients
 const drain=S.up.look?.5:1;
 for(const c of clients){c.pat-=dt*drain;
  if(c.type===2&&nearestCop()<8){c.pat-=dt*3;}
  if(c.pat<=0){newDemand(c);toast('🚶 Un client s\'impatiente et part…');}}
}
/* ============ HUD / MINIMAP ============ */
function syncHUD(){$('money').textContent=Math.floor(S.money)+' €';
 $('stock').textContent=(Math.round(S.stock*10)/10)+' g';$('stashMini').textContent='planque '+(Math.round(S.stash*10)/10)+' g';
 const full=Math.floor(S.wanted),half=S.wanted-full>=.5;let st='';for(let i=0;i<5;i++)st+=i<full?'★':(i===full&&half?'⯪':'☆');
 $('stars').textContent=st;$('stars').classList.toggle('hot',chase||S.wanted>=3);$('lvl').textContent='Niv.'+S.level;
 $('missionTxt').textContent=MISSIONS[Math.min(S.mission,MISSIONS.length-1)]+(S.mission>=MISSIONS.length?' — 🏆':'');
 $('grade').textContent=S.stock>0.1?'lot '+S.grade+' 🏅':'';
 const dn=$('distName');const D=districtAt(player.pos.x,player.pos.z);
 dn.textContent=(D?D.nom:'Hors-les-murs')+' • '+REPNAME[repTier()];
 dn.style.color=D?(D.id==='bloc'?'#3ddc74':D.id==='marche'?'#ffd166':'#b892ff'):'#93a3c4';
 $('rentIn').textContent='🏠 J'+Math.max(1,S.rentIn);
 $('wthr').textContent=(WEATHERS.find(w=>w.id===S.weather)||WEATHERS[0]).ico;
  $('seedCount').textContent=(S.seeds.classique|0)+'🌿';
 if(S.seeds)SK.forEach(k=>{if(!Number.isFinite(S.seeds[k]))S.seeds[k]=0;});
 if(!Array.isArray(S.genomes))S.genomes=[];
 if(!Number.isFinite(S.mutChance))S.mutChance=.12;
 if(!Number.isFinite(S.timeScale))S.timeScale=1;
 syncSpeedUI();
 // barre de carrière : le but du jeu
 const ri=rankIdx(),r=RANKS[ri],nx=RANKS[Math.min(RANKS.length-1,ri+1)];
 $('rankIco').textContent=r.ico;$('rankName').textContent=r.nom;
 $('rankPay').textContent='paie ×'+r.pay+' • risque ×'+r.risk;
 const span=nx.xp-r.xp;
 $('rankFill').style.width=(ri===RANKS.length-1?100:Math.max(0,Math.min(100,(S.rankXp-r.xp)/span*100)))+'%';
 $('rankNext').textContent=ri===RANKS.length-1
  ?(r.ok()?'🏆 Objectif de légende atteint !':'🏆 Objectif : '+r.req())
  :'↑ '+nx.nom+' — '+Math.max(0,Math.ceil(nx.xp-S.rankXp))+' € à gagner · '+nx.req()+(nx.ok()?' ✅':'');
 $('rankNext').style.color=ri===RANKS.length-1&&r.ok()?'var(--gold)':'var(--muted)';}
const mm=$('minimap').getContext('2d');
function drawMap(){const W=208,SRC=210;const sc=W/SRC;mm.clearRect(0,0,W,W);mm.fillStyle='#0a0e1a';mm.fillRect(0,0,W,W);
 // carte centrée sur le joueur, échelle 1 unité monde = sc px
 const px0=player.pos.x,pz0=player.pos.z;
 const X=x=>W/2+(x-px0)*sc,Z=z=>W/2+(z-pz0)*sc;
 // quartiers en fond
 const DCOL={bloc:'#141c22',marche:'#1d1a12',quais:'#101c22',cite:'#1e1c14'};
 for(const d of DISTRICTS){mm.fillStyle=DCOL[d.id]||'#141c22';
  const x0=Math.max(0,X(d.x0)),x1=Math.min(W,X(d.x1)),z0=Math.max(0,Z(d.z0)),z1=Math.min(W,Z(d.z1));
  if(x1>x0&&z1>z0)mm.fillRect(x0,z0,x1-x0,z1-z0);}
 // routes du bloc
 mm.fillStyle='#232a35';
 const r1x0=Math.max(0,X(-65)),r1x1=Math.min(W,X(65));
 if(r1x1>r1x0){mm.fillRect(r1x0,Math.max(0,Z(6)),r1x1-r1x0,Math.min(W,Z(12))-Math.max(0,Z(6)));
  mm.fillRect(Math.max(0,X(13)),Math.max(0,Z(-65)),Math.min(W,X(19))-Math.max(0,X(13)),Math.min(W,Z(65))-Math.max(0,Z(-65)));}
 // route du marché
 {const a=Math.max(0,X(72)),b=Math.min(W,X(188));if(b>a)mm.fillRect(a,Math.max(0,Z(-3.5)),b-a,Math.min(W,Z(3.5))-Math.max(0,Z(-3.5)));}
 // route de la Cité (liaison ouest + avenue verticale)
 {const a=Math.max(0,X(-206)),b=Math.min(W,X(-65));if(b>a)mm.fillRect(a,Math.max(0,Z(6)),b-a,Math.min(W,Z(12))-Math.max(0,Z(6)));
  const c=Math.max(0,Z(-64)),d2=Math.min(W,Z(64));if(d2>c)mm.fillRect(Math.max(0,X(-153)),c,Math.min(W,X(-147))-Math.max(0,X(-153)),d2-c);}
 // route des quais
 {const a=Math.max(0,Z(74)),b=Math.min(W,Z(186));if(b>a)mm.fillRect(Math.max(0,X(-3.5)),a,Math.min(W,X(3.5))-Math.max(0,X(-3.5)),b-a);}
 mm.fillStyle='#232a35';mm.fillRect(X(-65),Z(6),130*sc,6*sc);mm.fillRect(X(13),Z(-65),6*sc,130*sc);mm.fillRect(X(-65),Z(30),130*sc,6*sc);
 mm.fillStyle='#14301c';mm.beginPath();mm.arc(X(-30),Z(22),16*sc,0,7);mm.fill();
 mm.fillStyle='#2a3350';mm.fillRect(X(-5.5),Z(-15),11*sc,8*sc);
 mm.fillStyle='#b47bff';mm.fillRect(X(-11.5),Z(-10.5),7*sc,3*sc);
 // rivaux
 for(const r of RIVALS){mm.fillStyle='#ff6fb5';mm.beginPath();mm.arc(X(r.x),Z(r.z),4,0,7);mm.fill();
  mm.strokeStyle='#ff6fb5';mm.lineWidth=1;mm.stroke();}
 // barriers locked
 barrierSigns.forEach(s=>{mm.fillStyle='#ff4d6d';mm.fillRect(X(s.position.x)-2,Z(s.position.z)-2,4,4);});
 for(const c of clients){mm.fillStyle=c.pat<10?'#888':'#ffd166';mm.beginPath();mm.arc(X(c.x),Z(c.z),4,0,7);mm.fill();}
 for(const p of WALKERS){mm.fillStyle='#8899aa';mm.fillRect(X(p.mesh.position.x)-2,Z(p.mesh.position.z)-2,4,4);}
 for(const t of CARS){mm.fillStyle='#ffffff';mm.fillRect(X(t.mesh.position.x)-2.5,Z(t.mesh.position.z)-2.5,5,5);}
 if(DELIV){const pu=2+Math.sin(Date.now()/300)*1.5;mm.fillStyle='#b892ff';mm.beginPath();mm.arc(X(DELIV.x),Z(DELIV.z),5+pu,0,7);mm.fill();}
 mm.fillStyle='#22d3ee';mm.fillRect(X(bike.pos.x)-3,Z(bike.pos.z)-3,6,6);
 // stations de métro
 for(const st of STATIONS){
  const d=DISTRICTS.find(x=>x.id===st.id);
  const open=!d||S.rep>=d.rep;
  mm.fillStyle=open?'#22d3ee':'#5a6472';
  mm.beginPath();mm.arc(X(st.x),Z(st.z),4.5,0,6.29);mm.fill();
  mm.strokeStyle='rgba(0,0,0,.5)';mm.lineWidth=1.5;mm.stroke();}
 // véhicules achetés
 if(S.veh)for(const k in S.veh){const v=S.veh[k];if(!v||!v.own)continue;
  mm.fillStyle='#ffd166';mm.fillRect(X(v.x)-2,Z(v.z)-2,4,4);}
 const t=Date.now()/400;
 cops.forEach(c=>{mm.fillStyle=c.state==='chase'?(Math.floor(t)%2?'#ff0000':'#ffffff'):(c.type==='car'?'#3a7bff':'#ff6b6b');
  mm.beginPath();mm.arc(X(c.pos.x),Z(c.pos.z),c.type==='car'?5:3.5,0,7);mm.fill();});
 const px=X(player.pos.x),pz=Z(player.pos.z);
 // cadre de la zone visible
 mm.strokeStyle='rgba(255,255,255,.18)';mm.lineWidth=1;mm.strokeRect(.5,.5,W-1,W-1);
 mm.save();mm.translate(px,pz);mm.rotate(-camYaw+Math.PI);
 mm.fillStyle=player.riding?'#22d3ee':'#3ddc74';mm.beginPath();mm.moveTo(0,-7);mm.lineTo(5,5);mm.lineTo(-5,5);mm.closePath();mm.fill();mm.restore();}
/* tuto */
function showTuto(){if(S.tuto>=TUTO.length)return;$('tuto').classList.add('open');$('tutoTitle').textContent='Étape '+(S.tuto+1)+'/'+TUTO.length+' — '+TUTO[S.tuto][0];$('tutoTxt').innerHTML=TUTO[S.tuto][1];}
$('tutoNext').onclick=()=>{S.tuto++;save();if(S.tuto>=TUTO.length){$('tuto').classList.remove('open');toast('🏆 Bon deal dans le hood !');}else showTuto();};
$('tutoSkip').onclick=()=>{S.tuto=TUTO.length;save();$('tuto').classList.remove('open');};
/* fermeture des panneaux au toucher du fond */
['growSheet','sellSheet','safeSheet'].forEach(id=>{
  $(id).addEventListener('pointerdown',e=>{if(e.target.id===id){
    $(id).classList.remove('open');if(id==='sellSheet')sellTarget=null;}});
});
