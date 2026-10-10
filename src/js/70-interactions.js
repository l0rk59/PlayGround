/* ==== 70-interactions.js — Interactions : culture, vente ==== */
/* ============ INTERACTIONS ============ */
let nearClient=null,nearGarden=false,nearBike=false,nearSafe=false,alarmT=0,chaseTime=0,wantedT=0;
function dist2(ax,az,bx,bz){return Math.hypot(ax-bx,az-bz);}
function nearestCop(){let d=1e9;for(const c of cops)d=Math.min(d,dist2(player.pos.x,player.pos.z,c.pos.x,c.pos.z));return d;}
let nearHall=null,nearStationRef=null,nearJob=null;
function updateInteract(){
 nearClient=null;nearGarden=false;nearBike=false;nearSafe=false;
 // l'invite doit toujours rester au-dessus du bloc de boutons, sinon elle est illisible
 const prEl=$('prompt');
 if(prEl&&prEl.style.display==='block'){
  const top=$('btns').getBoundingClientRect().top;
  const want=Math.max(96,innerHeight-top+10)+'px';
  if(prEl.style.bottom!==want)prEl.style.bottom=want;}
 for(const c of clients){if(dist2(player.pos.x,player.pos.z,c.x,c.z)<3.6){nearClient=c;S.metClient=true;break;}}
 if(dist2(player.pos.x,player.pos.z,GARDEN.x,GARDEN.z)<3.4)nearGarden=true;
 if(!player.riding&&dist2(player.pos.x,player.pos.z,bike.pos.x,bike.pos.z)<2.6)nearBike=true;
 if(!player.riding&&!nearBike&&nearVehData())nearBike=true;
 nearStationRef=nearStation();
 nearJob=Math.hypot(player.pos.x-jobBoard.x,player.pos.z-jobBoard.z)<3.6;
 if(dist2(player.pos.x,player.pos.z,9.5,-9)<3.4)nearSafe=true;
 // comptoirs des deux halls : on interagit seulement à l'intérieur
 nearHall=null;
 if(player.indoors&&!isIndoors()){
  for(const h of HALLS){
   if(inHall(h)&&dist2(player.pos.x,player.pos.z,h.x+h.cx,h.z+h.cz)<3.2){nearHall=h;break;}}}
 const btn=$('btnAct'),pr=$('prompt');
 const rb=blockNear(),crook=crookableCop();
 if(player.riding){btn.style.display='block';btn.textContent='🚲 Descendre';pr.style.display='none';}
 else if(rb){btn.style.display='block';
  btn.textContent=S.passes>0?'🎫 Passe ('+S.passes+')':'🧾 Contrôle routier';
  pr.style.display='block';
  pr.textContent=S.passes>0?'Un passe suffit — les flics ne verront rien.':'Passer le barrage : 60 € si ça passe, sinon ils fouillent (−35% du stock).';}
 else if(crook){btn.style.display='block';btn.textContent='🤝 Acheter le silence (250 €)';
  pr.style.display='block';pr.textContent='Ce flic a « oublié » ce qu\'il a vu. Une fois, puis il aura froid aux doigts.';}
 else if(nearClient){btn.style.display='block';btn.textContent='💰 Vendre ('+nearClient.demand+'g)';pr.style.display='block';pr.textContent=CTYPES[nearClient.type].e+' Client : veut '+nearClient.demand+'g — reste discret !';}
 else if(nearBike){const v=nearVeh();
  btn.style.display='block';btn.textContent=v.ico+' Monter';
  pr.style.display='block';pr.textContent=v.id==='velo'
   ?'🚲 Ton vélo : rapide et silencieux.'
   :v.ico+' '+v.nom+' — vitesse '+v.spd.toFixed(1)+(v.stash?' • coffre +'+v.stash+' g':'')+
    ' • bruit ×'+v.noise.toFixed(2)+(v.fuel>0?' • réservoir '+Math.round(vehFuel(v.id)*100)+'%':'');}
 else if(nearGarden){btn.style.display='block';btn.textContent='🌿 Culture';pr.style.display='block';pr.textContent='🌿 Ta chambre de culture : récolte et replante !';}
 else if(nearSafe){btn.style.display='block';btn.textContent='🏠 Planque';pr.style.display='block';pr.textContent='🏠 Planque : stock à l\'abri + améliorations';}
 else if(nearJob){btn.style.display='block';btn.textContent='📌 Contrats';
  pr.style.display='block';
  pr.textContent='📌 Des commandes à livrer. '+activeJobs().filter(c=>!c.done&&!c.failed).length+' en cours.';}
 else if(nearStationRef){const st=nearStationRef;const d=DISTRICTS.find(x=>x.id===st.id);
  const locked=d&&S.rep<d.rep;
  btn.style.display='block';btn.textContent='🚇 Métro';
  pr.style.display='block';
  pr.textContent=locked?'🔒 '+d.nom+' : il faut '+d.rep+' ★ de réputation (tu en as '+S.rep+').'
   :'🚇 '+st.nom+' — 40 € et 20 min de trajet pour traverser la ville.';}
 else if(nearHall){btn.style.display='block';
  btn.textContent=(nearHall.o.vic||'🏪')+' '+nearHall.o.sign;
  pr.style.display='block';
  pr.textContent=HALL_TXT[nearHall.o.sign]||'Comptoir du quartier.';}
 else{btn.style.display='none';pr.style.display='none';}
}
$('btnAct').onclick=()=>{vib(10);sndBlip(600);
 if(player.riding){const id=player.mount||'velo';
  if(id==='velo'){player.riding=false;player.mount=null;
   bike.pos.set(player.pos.x,0,player.pos.z);S.bike.x=player.pos.x;S.bike.z=player.pos.z;
   save();toast('🚲 Vélo garé ici');}
  else{dismount();save();toast('🛑 '+vehData(id).nom+' garé');}}
 else if(nearClient)openSell(nearClient);
 else if(nearBike){const v=nearVeh();
  if(v.id==='velo'){player.riding=true;player.mount='velo';}
  else mountVeh(v.id);
  S.rode=true;missionCheck();toast(v.ico+' '+v.nom+' — ⚡ pour accélérer');sndBlip(700);}
 else if(nearJob)openJobs();
 else if(nearStationRef)openMetro();
 else if(nearGarden)openGrow();
 else if(nearHall){if(nearHall===hallMarket)openMarche();
  else if(nearHall===hallDouane)openDouane();
  else if(nearHall===hallBank)openBank();
  else openPol();}
 else if(nearSafe)openSafe();
 else if(rb)passRoadblock();
 else if(crook)bribeCop();};
