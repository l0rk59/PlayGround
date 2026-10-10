/* ==== 80-lieux.js — Lieux : marché, douane, banque, police ==== */
/* ================= LE MERCATO (intérieur du marché) ================= */
/* Nadia vend sous le comptoir : prix.blacktnique mais surveillance du quartier */
const MSHOP=[
 {id:'seed',ico:'🌱',t:'Graines (x3)',d:'De quoi semer les pots vides.',base:110,
  can:()=>true,buy(){S.seeds.classique+=3;}},
 {id:'fert',ico:'🧪',t:'Kit d\'engrais',d:'+45 de nutriments sur un pot (et un peu sur les autres).',base:90,
  can:()=>true,buy(){const p=S.pots.find(x=>x.planted);
   if(p){p.n=Math.min(100,p.n+45);p.pH=Math.max(4.2,(p.pH||6)-.1);}
   else S.pots.forEach(q=>q.n=Math.min(100,q.n+12));}},
 {id:'ph',ico:'⚗️',t:'Correcteur de pH',d:'Ramène un pot à 6.0 — la base d\'un lot A.',base:70,
  can:()=>S.pots.some(x=>x.planted&&Math.abs((x.pH||6)-6)>.25),buy(){const p=S.pots.find(x=>x.planted);if(p)p.pH=6;}},
 {id:'coat',ico:'🧥',t:'Capuche à capuche',d:'Les flics te voient de ~15% moins loin. Discrétion passive.',base:260,
  can:()=>!S.coat,buy(){S.coat=true;}},
 {id:'safe',ico:'🧰',t:'Casier au fond (+15 g)',d:'Planque agrandie. Nadia garde un passe.',base:320,
  can:()=>stashCap()<140,buy(){S.stashMax+=15;}},
 {id:'map',ico:'🗺️',t:'Plan des étals',d:'Les meilleurs spots de vente du Marché sont marqués.',base:200,
  can:()=>!S.marketMap,buy(){S.marketMap=true;toast('🗺️ Tu connais les bons spots du marché','gold');}},
];
/* Nadia majore un peu : c'est le marché, tout se paie plus cher */
function mPrice(it){return Math.round(it.base*(S.rep>=6?.85:1)*1.15);}
function renderMarche(){
 const d=nearestCop();
 const r=clamp01(.12+S.wanted*.06+(d<12?.5:d<22?.28:0));
 $('mRisk').innerHTML='<b style="color:'+(r>.5?'#ff6b6b':r>.28?'#ffd166':'#3ddc74')+'"> surveillance : '+
  Math.round(r*100)+'%</b> — '+(r>.5?'des flics rôdent, reviens plus tard.':r>.28?'ils traînent près des étals.':'calme, tu peux traiter tranquillement.')+
  ' • sur toi <b>'+(Math.round(S.stock*10)/10)+' g</b>';
 $('mShop').innerHTML=MSHOP.map(it=>{
  const p=mPrice(it),ok=it.can()&&S.money>=p;
  return '<div style="display:flex;gap:8px;align-items:center;margin:7px 0">'+
   '<span style="font-size:26px">'+it.ico+'</span>'+
   '<div style="flex:1;min-width:0"><b>'+it.t+'</b><br><small style="opacity:.8">'+it.d+'</small></div>'+
   '<button class="bigbtn" data-m="'+it.id+'" style="background:'+(ok?'#3ddc74':'#333')+
    ';width:auto;flex:0 0 auto;min-width:104px;padding:11px 8px">'+(it.can()?p+' €':'—')+'</button></div>';}).join('');
 $('mShop').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
  const it=MSHOP.find(x=>x.id===b.dataset.m);if(!it)return;
  const p=mPrice(it);
  if(!it.can()){toast('Déjà en ta possession','warn');return;}
  if(S.money<p){toast('Pas assez d\'argent','warn');return;}
  S.money-=p;it.buy();S.wanted=Math.min(5,S.wanted+.12);sndCash();save();syncHUD();renderMarche();});}
function openMarche(){nearHall=hallMarket;closeOtherSheets('marcheSheet');$('marcheSheet').classList.add('open');renderMarche();}
const HALL_TXT={
 MERCATO:'🍜 Nadia, derrière le comptoir : graines, correcteur de pH, matos.',
 DOUANE:'📋 Ferrand, au guichet : caution, scellés, passe de quai.',
 BANQUE:'🏦 Le guichet : ton argent ici ne peut pas être saisi.',
 POLICE:'🚓 L\'adjudant :.calmer les choses, papiers, protections.'};
/* ============================================================
   🚇 MÉTRO — le monde devient vaste sans être interminable
   Chaque station est un vrai lieu : on y entre, on choisit,
   on paie, et on réapparaît dans l'autre quartier.
   ============================================================ */
const STATIONS=[
 {id:'bloc',  nom:'Le Bloc',   x:-20,z:14, col:'#3ddc74',ico:'🏚️'},
 {id:'marche',nom:'Le Marché', x:120,z:14, col:'#ffd166',ico:'🍜'},
 {id:'quais', nom:'Les Quais', x:12,z:96,  col:'#4cc3ff',ico:'⚓'},
 {id:'cite',  nom:'La Cité',   x:-120,z:14, col:'#b892ff',ico:'🏢',rep:5},
];
const METRO_PRICE=40, METRO_MIN=1/3;   // 20 minutes de jeu ≈ 1/3 de jour
/* abri de métro : petit abri avecturnstile,ymm verticals et un panneau */
function metroStop(st){
 const g=new THREE.Group();g.position.set(st.x,0,st.z);scene.add(g);
 const frameM=new THREE.MeshStandardMaterial({color:0x3a4250,roughness:.6,metalness:.5});
 const glassM=new THREE.MeshStandardMaterial({color:0xa8d8ff,roughness:.1,metalness:.2,
  transparent:true,opacity:.35});
 for(const sx of [-2.6,2.6]){
  const p=new THREE.Mesh(new THREE.BoxGeometry(.22,2.9,.22),frameM);
  p.position.set(sx,1.45,0);p.castShadow=true;g.add(p);}
 const roof=new THREE.Mesh(new THREE.BoxGeometry(5.6,.18,2.4),frameM);
 roof.position.y=3;roof.castShadow=true;g.add(roof);
 for(const sz of [-1.1,1.1]){
  const gl=new THREE.Mesh(new THREE.BoxGeometry(5.2,2.3,.08),glassM);
  gl.position.set(0,1.6,sz);g.add(gl);}
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.4,.9),
  new THREE.MeshBasicMaterial({map:neonTex('MÉTRO '+st.ico,st.col),transparent:true,depthWrite:false}));
 sign.position.set(0,3.5,0);g.add(sign);
 // portillons : trois bornes metal alignées
 for(let i=0;i<3;i++){
  const t=new THREE.Mesh(new THREE.BoxGeometry(.28,1,.5),frameM);
  t.position.set(-.9+i*.9,.5,-.6);t.castShadow=true;g.add(t);}
 const bench=new THREE.Mesh(new THREE.BoxGeometry(3.2,.12,.5),
  new THREE.MeshStandardMaterial({color:0x5a4028,roughness:.9}));
 bench.position.set(0,.5,1.2);g.add(bench);
 const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.4,.1,.3),
  new THREE.MeshStandardMaterial({color:0xfff4d8,emissive:0xa8d8ff,emissiveIntensity:1.2}));
 lamp.position.set(0,2.85,0);g.add(lamp);
 const pl=new THREE.PointLight(0xa8d8ff,1.6,14,2);pl.position.set(0,2.6,0);g.add(pl);budgetLight(pl,36);
 st.mesh=g;st.lamp=lamp.material;st.sign=sign.material;
 st.pool=new THREE.Mesh(new THREE.CircleGeometry(3.4,20),
  new THREE.MeshBasicMaterial({map:glowTex(),color:st.col,transparent:true,opacity:.22,depthWrite:false}));
 st.pool.rotation.x=-Math.PI/2;st.pool.position.set(0,.03,0);g.add(st.pool);
 solid(st.x,st.z,5.4,2.6);          // l'abri bloque : on entre par-devant
 return st;}
STATIONS.forEach(metroStop);
/* la station s'allume en vert quand on peut l'utiliser */
function metroTick(){
 for(const st of STATIONS){
  const can=dist2(player.pos.x,player.pos.z,st.x,st.z)<4.6;
  st.lamp.emissiveIntensity=can?2.2:.7;
  st.pool.material.opacity=can?.34:.16;}}
function renderMetro(){
 const cur=nearStation();
 $('metroPrice').textContent=METRO_PRICE+' €';
 $('metroList').innerHTML=STATIONS.map(st=>{
  const d=DISTRICTS.find(x=>x.id===st.id);
  const need=st.rep!==undefined?st.rep:(d?d.rep:0);
  const locked=S.rep<need;
  const here=cur===st;
  const ok=!locked&&!here&&S.money>=METRO_PRICE;
  const desc=locked
   ?'🔒 fermé : il faut '+need+' ★ de réputation (tu en as '+S.rep+')'
   :here?'📍 tu es ici'
   :'🕐 +20 min • '+d.nom+(d.risk>1?' • risque ×'+d.risk:'');
  return '<div style="display:flex;gap:8px;align-items:center;margin:7px 0">'+
   '<span style="font-size:26px">'+st.ico+'</span>'+
   '<div style="flex:1;min-width:0"><b>'+st.nom+'</b><br><small style="opacity:.8">'+desc+'</small></div>'+
   '<button class="bigbtn" data-m="'+st.id+'" style="width:auto;flex:0 0 auto;min-width:104px;padding:11px 8px;'+
    'background:'+(ok?'#22d3ee':'#333')+'">'+(here?'—':METRO_PRICE+' €')+'</button></div>';}).join('');
 $('metroList').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
  const st=STATIONS.find(x=>x.id===b.dataset.m);if(!st)return;
  takeMetro(st);});}
function nearStation(){
 let best=null,bd=4.6;
 for(const st of STATIONS){const d=dist2(player.pos.x,player.pos.z,st.x,st.z);
  if(d<bd){bd=d;best=st;}}
 return best;}
function openMetro(){renderMetro();$('metroSheet').classList.add('open');sndBlip(600);}
$('metroClose').onclick=()=>$('metroSheet').classList.remove('open');
function takeMetro(st){
 const d=DISTRICTS.find(x=>x.id===st.id);
 const need=st.rep!==undefined?st.rep:(d?d.rep:0);
 if(S.rep<need){toast('🔒 '+st.nom+' est fermé (réputation '+(S.rep)+'/'+need+')','warn');return;}
 if(nearStation()===st){toast('Tu es déjà là','warn');return;}
 if(S.money<METRO_PRICE){toast('💰 '+METRO_PRICE+' € requis','warn');return;}
 S.money-=METRO_PRICE;
 player.pos.set(st.x,0,st.z+4.2);
 // on avance l'horloge : traverser la ville, ça se paie en temps
 const before=S.hour;
 S.hour=(S.hour+METRO_PRICE/2)%24;
 toast('🚇 '+st.ico+' '+st.nom+' — '+Math.round(METRO_PRICE/2*60)+' min de trajet','gold',2800);
 sndCash();save();syncHUD();
 $('metroSheet').classList.remove('open');missionCheck();}

/* ============================================================
   📌 CONTRATS — le panneau qui donne un but au jeu
   Une commande = une quantité, un délai en heures de jeu,
   un prime et un quartier. Tenir le délai donne argent + réputation.
   ============================================================ */
const JOB_MAX=3;
let jobBoard=null,jobNear=null;
/* le panneau : un panneau de bois avec des affiches et un toit */
function buildJobBoard(){
 const x=-27,z=14;
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=.35;scene.add(g);
 const wood=new THREE.MeshStandardMaterial({map:tex(concreteTex(),2,2),color:0x8a6a4a,roughness:.95});
 const board=new THREE.Mesh(new THREE.BoxGeometry(4.4,2.6,.22),wood);
 board.position.y=2.4;board.castShadow=board.receiveShadow=true;g.add(board);
 for(const sx of [-1.9,1.9]){
  const leg=new THREE.Mesh(new THREE.BoxGeometry(.24,1.4,.24),wood);
  leg.position.set(sx,.7,0);leg.castShadow=true;g.add(leg);
  const leg2=leg.clone();leg2.position.z=-.8;g.add(leg2);}
 const roof=new THREE.Mesh(new THREE.BoxGeometry(5,.16,1.6),
  new THREE.MeshStandardMaterial({color:0x6b4a34,roughness:.7}));
 roof.position.set(0,3.85,0);roof.rotation.x=.12;roof.castShadow=true;g.add(roof);
 // affiches colorées (les contrats)
 const papers=[[0xff6fb5,'PAID'],['#ffd166','SOON'],['#4cc3ff','NEED']];
 papers.forEach((pc,i)=>{
  const p=new THREE.Mesh(new THREE.PlaneGeometry(1,1.2),
   new THREE.MeshStandardMaterial({color:pc[0],roughness:.95}));
  p.position.set(-1.3+i*1.3,2.4,.13);g.add(p);
  const t=new THREE.Mesh(new THREE.PlaneGeometry(.9,.3),
   new THREE.MeshBasicMaterial({map:neonTex(pc[1],'#1a1a1f'),transparent:true,depthWrite:false}));
  t.position.set(-1.3+i*1.3,2.4,.15);g.add(t);});
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.8),
  new THREE.MeshBasicMaterial({map:neonTex('CONTRATS','#ffd166'),transparent:true,depthWrite:false}));
 sign.position.set(0,3.3,.14);g.add(sign);
 jobBoard={x,z,mesh:g};solid(x,z,4.6,1.6);
 return jobBoard;}
buildJobBoard();refreshJobs();
/* génération d'un contrat */
function makeJob(){
 const dist=['bloc','marche','quais'][Math.random()<.45?0:(Math.random()<.6?1:2)];
 const q=Math.round(5+Math.random()*10+ (dist==='quais'?8:0));
 const unit=Math.round(priceMul(districtAt(dist==='bloc'?0:dist==='marche'?130:20,
  dist==='marche'?0:dist==='quais'?140:0),12));
 const pay=Math.round(q*unit*1.35);
 const hours=[6,8,12][Math.floor(Math.random()*3)];
 return{id:'j'+(S.jobSeq=(S.jobSeq|0)+1),dist,q,pay,hours,left:hours,
  label:(dist==='marche'?'Le Marché':dist==='quais'?'Les Quais':'Le Bloc')+' — '+q+'g'};}
function activeJobs(){return S.jobs||(S.jobs=[]);}
function refreshJobs(force){
 const j=activeJobs();
 while(j.length<JOB_MAX)j.push(makeJob());
 if(force)j.length=0,refreshJobs();}
/* les délais avancent avec l'horloge du jeu (une journée = 240 s réelles) */
function jobTick(dt){
 const j=activeJobs();let dirty=false;
 const dh=dt*(24/240);
 for(const c of j){
  if(c.done||c.failed)continue;
  c.left-=dh;
  if(c.left<=0){failJob(c.id);dirty=true;}}
 if(jobRefreshT>0){jobRefreshT-=dt;if(jobRefreshT<=0)refreshBoard();}
 if(dirty)renderJobsIfOpen();}
/* livraison : on donne la quantité depuis le stock sur soi ou la planque */
function deliverJob(id){
 const j=activeJobs().find(x=>x.id===id);if(!j||j.done||j.failed)return;
 const have=S.stock+S.stash;
 if(have<j.q){toast('Il te faut '+j.q+'g — tu en as '+Math.round(have*10)/10+'g','warn');return;}
 // on prend d'abord la planque, puis le stock
 let need=j.q;
 const fromStash=Math.min(need,S.stash);S.stash-=fromStash;need-=fromStash;
 const fromStock=Math.min(need,S.stock);S.stock-=fromStock;
 S.money+=j.pay;addRep(2);
 j.done=true;
 toast('📌 Contrat honoré ! +'+Math.round(j.pay)+' € • +2 ★','gold',3600);
 sndCash();vib(40);
 renderJobs();save();syncHUD();refreshJobsSoon();}
/* échec : retard ou abandon */
function failJob(id,silent){
 const j=activeJobs().find(x=>x.id===id);if(!j||j.done||j.failed)return;
 j.failed=true;
 S.rep=Math.max(0,S.rep-1.5);
 if(!silent)toast('📌 Contrat raté ('+j.label+') : −1,5 ★','warn',3200);
 sndBlip(180);
 renderJobs();save();refreshJobsSoon();}
/* une place se libère après un temps, sinon on bloque */
let jobRefreshT=20;
function refreshJobsSoon(){jobRefreshT=22;}
/* une fois le délai écoulé, les contrats terminés laissent place à de nouveaux */
function refreshBoard(){
 const j=activeJobs();
 for(let i=j.length-1;i>=0;i--)if(j[i].done||j[i].failed)j.splice(i,1);
 refreshJobs();
 if($('jobSheet').classList.contains('open'))renderJobs();
 save();}
function renderJobs(){
 const j=activeJobs();
 $('jobInfo').innerHTML='Contrats en cours : <b>'+j.filter(x=>!x.done&&!x.failed).length+'/'+JOB_MAX+'</b>'+
  ' • sur toi <b>'+(Math.round(S.stock*10)/10)+' g</b> • planque <b>'+(Math.round(S.stash*10)/10)+' g</b>';
 if(!j.length)$('jobList').innerHTML='<p class="sub">Aucune affiche pour l\'instant. Reviens plus tard.</p>';
 else $('jobList').innerHTML=j.map(c=>{
  if(c.done)return '<div class="upg"><div style="font-size:26px">✅</div><div class="inf"><b>'+c.label+'</b>'+
   '<br><span style="color:#3ddc74">Livré — +'+Math.round(c.pay)+' €</span></div></div>';
  if(c.failed)return '<div class="upg"><div style="font-size:26px">❌</div><div class="inf"><b>'+c.label+'</b>'+
   '<br><span style="color:#ff6b6b">Raté</span></div></div>';
  const d=districtAt(c.dist==='bloc'?0:c.dist==='marche'?130:20,c.dist==='marche'?0:c.dist==='quais'?140:0);
  const eur=c.pay;
  return '<div class="upg"><div style="font-size:26px">📦</div><div class="inf"><b>'+c.label+'</b>'+
   '<br><span style="color:var(--muted)">prime '+eur+' € • délai '+Math.max(0,c.left).toFixed(1)+' h'+
   (d?' • zone '+(d.risk>1?'à risque':''):'')+'</span></div>'+
   '<button class="bigbtn" id="jd_'+c.id+'" style="margin:0;min-height:40px;background:#3ddc74">'+
   'Livrer</button></div>';}).join('');
 $('jobList').querySelectorAll('[id^="jd_"]').forEach(b=>b.onclick=()=>deliverJob(b.id.slice(3)));}
function openJobs(){renderJobs();$('jobSheet').classList.add('open');sndBlip(600);}
$('jobClose').onclick=()=>$('jobSheet').classList.remove('open');
/* tick horaire : les délais avancent, les contrats en retard échouent */
function renderJobsIfOpen(){if($('jobSheet').classList.contains('open'))renderJobs();}

/* ================= LA BANQUE ================= */
/* l'argent sale sur toi peut être saisi : la banque le protège, moyennant frais */
const BANK=[
 {id:'dep500',ico:'📥',t:'Déposer 500 €',d:'Sort ton argent de ta poche : il ne peut plus être saisi.',base:0,
  can:()=>S.money>=500,buy(){S.money-=500;S.bank+=500;}},
 {id:'ret500',ico:'📤',t:'Retirer 500 €',d:'Reprends du liquide pour bosser.',base:0,
  can:()=>S.bank>=500,buy(){S.money+=500;S.bank-=500;}},
 {id:'all',ico:'🏧',t:'Tout retirer',d:'Vide le compte dans ta poche. Attention : ça attire les yeux.',
  base:0,can:()=>S.bank>0,buy(){S.money+=S.bank;toast('💵 Tout est sorti : '+Math.round(S.bank)+' € sur toi','warn');S.bank=0;}},
 {id:'safe',ico:'🔐',t:'Coffre-fort (400 €)',d:'Ce qui est à la banque n\'est jamais perdu, même en cas de saisie totale.',
  base:400,can:()=>!S.vault,buy(){S.vault=true;}},
];
function renderBank(){
 $('bInfo').innerHTML='À la banque : <b style="color:var(--gold)">'+Math.round(S.bank)+' €</b>'+
  ' • sur toi : <b>'+Math.round(S.money)+' €</b>'+
  (S.vault?' • 🔐 coffre-fort actif':'');
 $('bankShop').innerHTML=BANK.map(it=>{
  const p=it.base,ok=it.can()&&S.money>=p;
  return '<div style="display:flex;gap:8px;align-items:center;margin:7px 0">'+
   '<span style="font-size:26px">'+it.ico+'</span>'+
   '<div style="flex:1;min-width:0"><b>'+it.t+'</b><br><small style="opacity:.8">'+it.d+'</small></div>'+
   '<button class="bigbtn" data-b="'+it.id+'" style="width:auto;flex:0 0 auto;min-width:104px;padding:11px 8px;'+
    'background:'+(ok?'#ffd166':'#333')+'">'+(p?p+' €':'—')+'</button></div>';}).join('');
 $('bankShop').querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{
  const it=BANK.find(x=>x.id===b.dataset.b);if(!it)return;
  if(!it.can()){toast('Indispo','warn');return;}
  if(S.money<it.base){toast('💰 '+it.base+' € requis','warn');return;}
  it.buy();sndCash();save();renderBank();syncHUD();});}
function openBank(){nearHall=hallBank;closeOtherSheets('bankSheet');$('bankSheet').classList.add('open');renderBank();}
$('bankClose').onclick=()=>{$('bankSheet').classList.remove('open');nearHall=null;};
/* ================= LE COMMISSARIAT ================= */
/* on paie pour baisser la recherche : c'est le vrai coût du jeu discret */
const POL=[
 {id:'calm',ico:'🧘',t:'Calmer les choses (250 €)',d:'−0.8 de niveau de recherche immédiat.',
  base:250,can:()=>S.wanted>0.4,buy(){S.wanted=Math.max(0,S.wanted-.8);}},
 {id:'paper',ico:'📄',t:'Papiers (600 €)',d:'Permis de conduire : les barrages ne te fouillent plus.',
  base:600,can:()=>!S.papers,buy(){S.papers=true;}},
 {id:'file',ico:'🗂',t:'Dossier rivaux (400 €)',d:'Signale Zoé ou Malik : −3 réputation pour le rival visé.',
  base:400,can:()=>!S.filed&&S.rep>=5,buy(){S.filed=true;RIVALS[(Math.random()*RIVALS.length)|0].rep-=3;}},
 {id:'charm',ico:'🍀',t:'Protection (900 €)',d:'Les flics te voient 25% moins loin pendant 3 jours.',
  base:900,can:()=>!S.charmT,buy(){S.charmT=3;}},
];
function renderPol(){
 const r=clamp01(.1+S.wanted*.1);
 $('polInfo').innerHTML='Niveau de recherche : <b style="color:'+
  (S.wanted>3?'#ff2d55':S.wanted>1.5?'#ffd166':'#3ddc74')+'">'+Math.round(S.wanted*20)+' %</b>'+
  (S.charmT>0?' • 🍀 protection '+Math.ceil(S.charmT)+' j':'')+
  (S.papers?' • 📄 permis au portefeuille':'');
 $('polShop').innerHTML=POL.map(it=>{
  const ok=it.can()&&S.money>=it.base;
  return '<div style="display:flex;gap:8px;align-items:center;margin:7px 0">'+
   '<span style="font-size:26px">'+it.ico+'</span>'+
   '<div style="flex:1;min-width:0"><b>'+it.t+'</b><br><small style="opacity:.8">'+it.d+'</small></div>'+
   '<button class="bigbtn" data-o="'+it.id+'" style="width:auto;flex:0 0 auto;min-width:104px;padding:11px 8px;'+
    'background:'+(ok?'#4c9dff':'#333')+'">'+it.base+' €</button></div>';}).join('');
 $('polShop').querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{
  const it=POL.find(x=>x.id===b.dataset.o);if(!it)return;
  if(!it.can()){toast('Indisponible','warn');return;}
  if(S.money<it.base){toast('💰 '+it.base+' € requis','warn');return;}
  S.money-=it.base;it.buy();sndBlip(480);save();renderPol();syncHUD();});}
function openPol(){nearHall=hallPolice;closeOtherSheets('polSheet');$('polSheet').classList.add('open');renderPol();}
$('polClose').onclick=()=>{$('polSheet').classList.remove('open');nearHall=null;};
/* une seule feuille de lieu à la fois */
function closeOtherSheets(keep){
 ['marcheSheet','douaneSheet','bankSheet','polSheet','growSheet','safeSheet','sellSheet','labSheet']
  .forEach(id=>{if(id!==keep){const e=$(id);if(e)e.classList.remove('open');}});}

/* ================= LA DOUANE (quais) ================= */
/* Ferrand vend des services : caution, scellés, passe. Rien d'illégal sur le papier. */
const DSHOP=[
 {id:'bond',ico:'🔏',t:'Caution de quai',d:'+10 g de planque : un conteneur rien que pour toi.',base:200,
  can:()=>stashCap()<150,buy(){S.stashMax+=10;}},
 {id:'seal',ico:'📦',t:'Scellés customs',d:'Ton stock en cave est protégé : la saisie ne prend plus que la moitié du lot.',base:340,
  can:()=>!S.sealed,buy(){S.sealed=true;}},
 {id:'tip',ico:'🕵️',t:'Rumeur de douane',d:'Ferrand te murmure où les flics vont camper : moins de barrages imprévus.',base:180,
  can:()=>!S.tipBought,buy(){S.tipBought=true;S.roadblockT=140;
   toast('🕵️ Le douanier t\'indique une zone à éviter','gold');}},
 {id:'pass',ico:'🎫',t:'Passe de quai (x2)',d:'Franchit 2 barrages routiers sans fouille.',base:150,
  can:()=>true,buy(){S.passes+=2;}},
];
function dPrice(it){return Math.round(it.base*(S.rep>=8?.9:1));}
function renderDouane(){
 const d=nearestCop();
 const r=clamp01(.2+S.wanted*.05+(d<10?.55:d<20?.3:0));
 $('dRisk').innerHTML='<b style="color:'+(r>.55?'#ff2d55':r>.3?'#ffd166':'#3ddc74')+'"> contrôle : '+
  Math.round(r*100)+'%</b> — '+(r>.55?'ils fouillent à l\'entrée : évite d\'y porter du stock.':r>.3?'des BK tournent près des conteneurs.':'personne ne regarde.')+
  ' • planque <b>'+(Math.round(S.stash*10)/10)+' / '+stashCap()+' g</b>'+(S.sealed?' • 🛡 scellés customs actifs':'');
 $('dShop').innerHTML=DSHOP.map(it=>{
  const p=dPrice(it),ok=it.can()&&S.money>=p;
  return '<div style="display:flex;gap:8px;align-items:center;margin:7px 0">'+
   '<span style="font-size:26px">'+it.ico+'</span>'+
   '<div style="flex:1;min-width:0"><b>'+it.t+'</b><br><small style="opacity:.8">'+it.d+'</small></div>'+
   '<button class="bigbtn" data-d="'+it.id+'" style="background:'+(ok?'#ff6fb5':'#333')+
    ';width:auto;flex:0 0 auto;min-width:104px;padding:11px 8px">'+(it.can()?p+' €':'—')+'</button></div>';}).join('');
 $('dShop').querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{
  const it=DSHOP.find(x=>x.id===b.dataset.d);if(!it)return;
  const p=dPrice(it);
  if(!it.can()){toast('Pas disponible','warn');return;}
  if(S.money<p){toast('Pas assez d\'argent','warn');return;}
  S.money-=p;it.buy();sndBlip(520);save();syncHUD();renderDouane();});}
function openDouane(){nearHall=hallDouane;closeOtherSheets('douaneSheet');$('douaneSheet').classList.add('open');renderDouane();}
$('marcheClose').onclick=()=>{$('marcheSheet').classList.remove('open');nearHall=null;};
$('douaneClose').onclick=()=>{$('douaneSheet').classList.remove('open');nearHall=null;};

/* serre */
function openGrow(){$('growSheet').classList.add('open');renderGrow();}
$('growClose').onclick=()=>switchSheet('');
$('gLabBtn').onclick=()=>{vib(8);switchSheet('labSheet');};
// plantation d'une souche mutante depuis le labo
function plantFromLab(gid){switchSheet('growSheet');if(plantSeed(gid)){save();renderGrow();syncHUD();}}
/* ============================================================
   CULTURE RÉALISTE
   · cycle lumineux 18 h / 6 h (les plantes ne poussent qu'en lumière)
   · pH du substrat : trop acide ou trop alcalin = stress
   · ravageurs (aleurodes / acariens) : favorisés par la chaleur et l'humidité
   · séchage / curing obligatoire après récolte
   · électricité : les grow consomment, et c'est facturé
   ============================================================ */
const LIGHT_ON_H=18;
function lightPhase(){const st=S.lightStart;
 let d=(S.hour-st+24)%24;
 const on=d<LIGHT_ON_H;
 return{on,since:on?d:24-LIGHT_ON_H+d,until:on?LIGHT_ON_H-d:24-d,next:on?'Extinction':'Allumage'};}
function lightOn(){return S.powerOn&&lightPhase().on;}
function phMul(v){const d=Math.abs(v-6);
 if(d<=.2)return 1;if(d<=.5)return .85;if(d<=.9)return .6;return .35;}
function phLabel(v){return v<5.5?'très acide 🔴':v<5.8?'acide 🟠':v<=6.2?'parfait 🟢':v<=6.5?'alcalin 🟡':'très alcalin 🔴';}
/* consommation : rampes LED + éclairage de la maison, uniquement quand il y a des plants */
function roomPowerKW(){if(!S.powerOn)return 0;   // rideau baissé : rien ne consomme
 let kw=0;
 for(const p of S.pots)if(p.planted&&!p.ready)kw+=.28;
 kw+=.35;if(kw>0)kw+=1.1;
 return kw;}
function dryTick(dt){
 const hours=dt*(24/240);
 for(let i=S.drying.length-1;i>=0;i--){
  const d=S.drying[i];d.t+=hours;
  if(d.t>=d.need){
   const kept=Math.max(1,Math.round(d.g*.92));
   S.stock+=kept;S.qSum+=kept*({A:1.35,B:1,C:.75})[d.grade||'B'];
   S.dried=(S.dried|0)+1;
   toast('🌬️ Lot séché : <b>+'+kept+'g</b> prêt à vendre','gold');
   S.drying.splice(i,1);missionCheck();}}
 if(S.wet>0)S.wet=Math.max(0,S.wet-hours*.5);
 S.kWh+=roomPowerKW()*hours;
 if(S.kWh>25){const bill=Math.round(S.kWh*.55);S.kWh=0;S.powerPaid=(S.powerPaid|0)+bill;S.money-=bill;
  toast('⚡ <b>Facture d\'électricité : -'+bill+' €</b>','warn',4200);sndBlip(160);}}
function pestRisk(p){return (p.w>78?.10:0)+(p.w<30?.04:0)+(p.g>45?.06:0)+(lightOn()?.04:0);}
function growTick2(dt){
 const lit=lightOn(),hours=dt*(24/240);
 for(const p of S.pots){
  if(!p.planted||p.ready)continue;
  p.pH=Math.max(4.2,Math.min(7.8,p.pH+(Math.random()-.5)*hours*.3+(p.n>70?hours*.06:0)));
  if(!p.pest&&Math.random()<pestRisk(p)*hours*1.1)p.pest=true;
  if(p.pest){p.w=Math.max(0,p.w-hours*.8);p.h=Math.max(0,p.h-hours*2.2);}
  const rate=lit?1:.07;
  if(p.w>15&&p.n>10){
   const sp=STRAINS[p.s||0].spd*((p.gx!=null)?genomeOf(p.gx).vit:1);
   p.g=Math.min(100,p.g+2.4*sp*rate*phMul(p.pH)*dt);
   p.h=Math.min(100,p.h+dt*(lit?1:.2));
   if(p.pH<5.4||p.pH>6.6)p.h=Math.max(0,p.h-dt*.5);
  }else{p.h-=3*dt;if(p.h<=0){p.planted=false;p.g=0;toast('🥀 Plant mort — arrose + engraisse','warn');}}
  if(p.g>=100){p.ready=true;toast('✨ Un plant est prêt dans ta chambre de culture !','gold');sndBlip(880);}}}
/* récolte réaliste : le plant part en séchage, pas directement en stock */
function harvestPot(){
 const p=S.pots[S.sel];
 if(!(p.planted&&p.ready))return;
 const gr=gradeOf(p),g=yieldPerPlant(p);
 S.drying.push({g,grade:gr,t:0,need:6});
 S.harvested++;gainXp(15);sndCash();vib(25);missionCheck();
 toast('✂️ <b>'+g+'g en séchage</b> ('+gr+') — 6 h avant de pouvoir vendre','gold');
 if(Math.random()<S.mutChance){const gid=p.gx!=null?p.gx:null;
  const n=mutate(gid==null?[0,1,2][Math.floor(Math.random()*3)]:gid);
  S.genomes.push(n.id);S.muts=(S.muts|0)+1;
  setTimeout(()=>toast('🧬 <b>MUTATION !</b> Graine '+n.nom+' dans le labo','gold',4200),900);}
 else if(p.fragile&&Math.random()<.3)
  toast('🥀 La Wodka a cramé… risquée !','warn');
 S.pots[S.sel]={g:0,w:60,n:60,h:100,planted:false,ready:false,s:S.strainSel,gx:null,fragile:false,pH:6,pest:false};
 missionCheck();save();renderGrow();syncHUD();}

/* ============================================================
   POLICE RÉALISTE
   · mouchard acheté : les flics voient moins bien, et on repère leurs patrouilles
   · flic corrompable : pendant une course, on peut acheter son silence (une fois)
   · barrages routiers à 3★ : contrôle, passe ou risque
   ============================================================ */
/* --- mouchard : un contact dans le quartier --- */
function informantActive(){return S.informants>0&&S.informantT>0;}
function informantTick(dt){
 if(S.informantT>0)S.informantT=Math.max(0,S.informantT-dt*(24/240));
 if(S.crookCd>0)S.crookCd=Math.max(0,S.crookCd-dt);}
const INFORMANT_COST=()=>150+(S.informantsBought|0)*120;
function buyInformant(){
 const cost=INFORMANT_COST();
 if(S.informants>0){toast('🕵️ Ton contact est déjà actif ('+Math.ceil(S.informantT)+' h restantes)','warn');return;}
 if(S.money<cost){toast('💰 '+cost+' € requis','warn');return;}
 S.money-=cost;S.informants=1;S.informantsBought=(S.informantsBought|0)+1;S.informantT=6;
 toast('🕵️ <b>Mouchard activé</b> : 6 h d\'informations, les flics te voient moins bien','gold',4200);
 sndBlip(880);vib(15);missionCheck();save();renderSafe();syncHUD();}
/* --- flic corrompable --- */
function crookableCop(){
 if(!chase||S.crookCd>0)return null;
 if(S.money<250)return null;
 let best=null,bd=7;
 for(const c of cops){if(c.state!=='chase')continue;
  const d=dist2(c.pos.x,c.pos.z,player.pos.x,player.pos.z);
  if(d<bd){bd=d;best=c;}}
 return best;}
function bribeCop(){
 const c=crookableCop();
 if(!c)return;
 S.money-=250;S.bribes=(S.bribes|0)+1;S.crookCd=150;S.wanted=Math.max(0,S.wanted-1.5);
 c.state='patrol';c.meter=0;c.lastSeen=null;
 toast('🤝 <b>Le flic a regardé ailleurs</b> — 250 € et plus de poursuite','gold',4200);
 sndCash();vib(25);missionCheck();save();syncHUD();}
/* --- barrages routiers --- */
const roadblocks=[];
function roadblockMesh(x,z,ry){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;
 const bar=new THREE.Mesh(new THREE.BoxGeometry(7,.28,.28),
  new THREE.MeshStandardMaterial({color:0xe8e8ee,roughness:.6}));
 bar.position.y=1.05;g.add(bar);
 for(let i=-3;i<=3;i+=1.2){const st=new THREE.Mesh(new THREE.BoxGeometry(.5,.28,.3),
   new THREE.MeshStandardMaterial({color:0xd0342c,roughness:.6}));
  st.position.set(i,1.05,0);g.add(st);}
 [[-2.6,0],[2.6,0]].forEach(([lx])=>{const leg=new THREE.Mesh(new THREE.BoxGeometry(.18,1.05,.18),metalM);
  leg.position.set(lx,.52,0);g.add(leg);});
 const van=buildCar(0xf2f5fa,true);van.position.set(1.6,0,-3.2);van.rotation.y=0;g.add(van);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return g;}
const BLOCK_SPOTS=[[16,4.6,0],[16,13.4,0],[4.5,9,Math.PI/2],[-4.5,9,Math.PI/2]];
function roadblockTick(dt){
 const want=S.wanted>=3;
 if(want&&roadblocks.length===0){
  const spot=BLOCK_SPOTS[Math.floor(Math.random()*BLOCK_SPOTS.length)];
  const g=roadblockMesh(spot[0],spot[1],spot[2]);
  scene.add(g);
  const cops2=[footCop([[spot[0]-4,spot[1]],[spot[0]+4,spot[1]]],2.2),
               footCop([[spot[0]+4,spot[1]],[spot[0]-4,spot[1]]],2.2)];
  cops2.forEach((c,i)=>{c.pos.set(spot[0]+(i?-2.2:2.2),0,spot[1]);c.mesh.position.copy(c.pos);});
  roadblocks.push({x:spot[0],z:spot[1],g,cops:cops2});
  toast('🚧 <b>Barrage routier !</b> Contrôle sur la rue','warn',4200);sndBlip(220);}
 if(!want&&roadblocks.length){
  for(const rb of roadblocks){scene.remove(rb.g);
   for(const c of rb.cops){const i=cops.indexOf(c);if(i>=0)cops.splice(i,1);}}
  roadblocks.length=0;}
 if(!want)return;
 for(const rb of roadblocks){rb.search=(dist2(player.pos.x,player.pos.z,rb.x,rb.z)<22);}
 if(S.searchT>0){S.searchT-=dt;
  if(S.searchT<=0){ // le contrôle est passé : on paie ou on prend
   if(S.money>=60||Math.random()<.4){
    const pay=Math.min(S.money,60);S.money-=pay;
    toast('🧾 Contrôle réglé : -'+pay+' €','gold');
   }else{
    const seized=Math.ceil(S.stock*.35*(S.sealed?.5:1));S.stock=Math.max(0,S.stock-seized);
    S.wanted=Math.min(5,S.wanted+.5);
    toast('🚨 <b>Contrôle raté !</b> -'+seized+'g saisis','warn',4200);sfxAlarm();}
   S.searchT=0;save();syncHUD();}}
}
function blockNear(){
 for(const rb of roadblocks)
  if(dist2(player.pos.x,player.pos.z,rb.x,rb.z)<5.5&&S.searchT<=0)return rb;
 return null;}
function passRoadblock(){
 if(S.papers){toast('📄 Tes papiers sont bons, ils ne regardent même pas.','gold');S.searchT=0;return;}
 const rb=blockNear();
 if(!rb)return false;
 if(S.passes>0){S.passes--;S.blockPassed=(S.blockPassed|0)+1;
  toast('🎫 Passe de contrôle utilisée — tu passes sans Sourciller','gold');sndBlip(760);missionCheck();}
 else{S.searchT=3.2;toast('🧾 Contrôle en cours… ne bouge pas','warn',2600);sndBlip(300);}
 save();syncHUD();return true;}

/* ============================================================
   ÉCONOMIE VIVANTE
   · l'indice du marché fluctue au fil de la journée (offre/demande)
   · les prix dépendent de l'heure, du quartier, de ta réputation et du risque
   · des factures réelles (loyer, électricité, eau, Charging du vélo)
   ============================================================ */
const HOURS_CYCLE=6;
function marketIndex(){
 // 1.0 = prix normal ; monte le matin (rare), baisse le soir (invendus)
 const h=S.hour;
 const shape=1+.16*Math.sin((h-6)/24*Math.PI*2)*-.6+.1*Math.sin(h/HOURS_CYCLE);
 return clampPrice(shape*(.92+.16*Math.random()));}
function clampPrice(v){return Math.max(.62,Math.min(1.55,v));}
const TIERS=[
 {xp:0,nom:'Petit trafic',ico:'🌱',perk:'Bases'},
 {xp:300,nom:'Petite équipe',ico:'🧑‍🤝‍🧑',perk:'+5% sur les prix'},
 {xp:800,nom:'Réseau établi',ico:'🏪',perk:'Clients plus patients'},
 {xp:1800,nom:'Empire naissant',ico:'🏬',perk:'+10% sur les prix'},
 {xp:3500,nom:'Mogul du hood',ico:'🏙️',perk:'Contrats les plus gros'}];
function tierIdx(){
 try{let i=0;for(let k=0;k<TIERS.length;k++)if((S.rankXp|0)>=TIERS[k].xp)i=k;return i;}catch{return 0;}}
function currentTier(){return TIERS[tierIdx()];}
function nextTier(){return TIERS[tierIdx()+1];}
function tierPriceBonus(){
 // garde-fou : priceMul peut être appelé pendant la construction du monde,
 // avant que TIERS ne soit fully évalué (TDZ).
 try{return 1+tierIdx()*0.05;}catch{return 1;}}

function priceMul(district,hour){
 let m=1;
 const h=hour==null?S.hour:hour;
 if(district&&district.id==='marche')m*=1.16;      // la clientèle paie plus
 if(district&&district.id==='quais')m*=1.08;
 if(h>22||h<6)m*=1.12;                             // nuit : la prime de risque
 if(h>=11&&h<15)m*=.92;                            // midi : calme, prix en baisse
 m*=1+(repTier())*.012;                             // ta réputation te donne un prix
 m*=tierPriceBonus();                               // palier d'empire : +5% par palier
 m*=1-Math.min(.18,S.wanted*.035);                  //+trop grillé : on te paye moins
 if(S.weather==='fog')m*=.94;
 return m;}
/* factures : eau + électricité + charging du vélo, tous les 3 jours avec le loyer */
function payBills(){
 const notes=[];
 // eau
 const water=4+Math.floor(Math.random()*3);
 S.money-=water;notes.push('💧 Eau −'+water+' €');
 // charging du vélo (si possessed)
 if(S.up.turbo&&S.bikeUsed){S.money-=6;notes.push('⚡ Charging vélo −6 €');}
 // assurance.Marshal si tu as.exporté beaucoup
 if(S.totalSold>40){const ins=9;S.money-=ins;notes.push('🛡️ Assurance −'+ins+' €');}
 return notes;}
/* fiche « marché » : où vendre aujourd'hui */
function marketReport(){
 const d=districtAt(player.pos.x,player.pos.z);
 return {district:d?d.nom:'Hors-les-murs',index:marketIndex(),
  ici:priceMul(d,S.hour),
  marche:priceMul({id:'marche'},S.hour),
  quais:priceMul({id:'quais'},S.hour),
  nuit:priceMul(d,S.hour)};}

/* ============================================================
   NÉGOCIATION LISIBLE
   Le client a un état d'humeur réel : tu lis des indices
   (regard, posture, impatience, niveau de bluff), puis tu choisis.
   ============================================================ */
const MOODS=[
 {id:'open', nom:'Détendu',    ico:'😌',col:'#3ddc74',desc:'Il te fait confiance. Ne pousse pas.'},
 {id:'warm', nom:'Chaleureux', ico:'🙂',col:'#8bd8ff',desc:'Bonne disposition : un petit bluff passe.'},
 {id:'tens', nom:'Tendu',      ico:'😐',col:'#ffd166',desc:'Il calcule. Un bluff de trop et il part.'},
 {id:'cold', nom:'Froid',      ico:'😠',col:'#ff6b6b',desc:'Méfiance maximale : reculer ou proposer le prix.'},
 {id:'mad',  nom:'En colère',  ico:'🤬',col:'#ff2d55',desc:'Il va partir. Termine vite.'},
];
/* mood du client : fonction de la patience, du bluff et de sa greedy */
function moodOf(c){
 const p=c.pat/c.patMax;
 if(!bluff)return p<.35?'tens':'open';             // pas de négo en cours : il est juste calme
 if(bluff.level<=0)return p<.35?'cold':'tens';     // on a reculé : il se referme, sans être fâché
 if(p<.2)return 'mad';
 if(p<.45)return 'cold';
 if(p<.7)return 'tens';
 return bluff.level>=3?'cold':'warm';}
function moodInfo(c){
 const m=MOODS.find(x=>x.id===moodOf(c))||MOODS[0];
 return m;}
/* la pose porte l'humeur : la tête se détourne, le torse se ferme, le repère '!' change de couleur */
const MKCACHE={};
function moodMark(col){if(!MKCACHE[col])MKCACHE[col]=texMark('!',col);return MKCACHE[col];}
function applyMoodPose(c){
 const m=moodInfo(c);
 if(c.mesh&&c.mesh.userData){
  const u=c.mesh.userData;
  const yaw={open:0,warm:.06,tens:.2,cold:.5,mad:.78}[m.id]||0;
  const roll={open:0,warm:.01,tens:.05,cold:.11,mad:.17}[m.id]||0;
  u.moodYaw=yaw;u.moodRoll=roll;}
 if(c.mk&&c.lastMood!==m.id){
  c.lastMood=m.id;c.mk.material.map=moodMark(m.col);c.mk.material.needsUpdate=true;}
 else if(c.mk)c.mk.material.color.set(0xffffff);}
/* aide contextuelle : quoi faire maintenant */
function readAdvice(c){
 const m=moodOf(c);
 if(!bluff)return '💬 Il est détendu : propose ton prix, ou tente la négociation pour gratter.';
 if(m==='mad')return '⚠️ Il va partir : <b>recule</b> pour lui rendre de la patience, ou accepte le deal maintenant.';
 if(m==='cold')return '🧊 Il est fermé : un bluff encore, mais il risque de partir. Vendre maintenant est plus sûr.';
 if(m==='tens')return '😐 Il calcule : bluff prudent, puis propose. Deux bluffs max.';
 return '🙂 Bon moment pour un bluff : il est réceptif.';}

/* ============================================================
   ⚙️ RÉGLAGES & ACCESSIBILITÉ
   Chaque option est réellement appliquée au jeu, pas juste affichée.
   ============================================================ */
function opt(){if(!S.opt)S.opt=Object.assign({},DEFOPT);
 for(const k in DEFOPT)if(S.opt[k]===undefined)S.opt[k]=DEFOPT[k];
 return S.opt;}
/* qualité : auto bascule toute seule selon les images par seconde mesurées */
function qualityLevel(){
 const q=opt().quality;
 if(q!=='auto')return q;
 return FPSLOW?'eco':(innerWidth*innerHeight>2600000?'std':'high');}
function applyOpts(){
 const q=opt();
 // --- graphismes ---
 const lvl=qualityLevel();
 S.hq=lvl!=='eco';
 renderer.setPixelRatio(lvl==='high'?Math.min(devicePixelRatio,1.9)
  :lvl==='std'?Math.min(devicePixelRatio,1.5):Math.min(1,devicePixelRatio));
 setShadowQuality(S.hq&&q.shadows);
 renderer.shadowMap.enabled=S.hq&&q.shadows;
 if(bloomPass)bloomPass.enabled=q.bloom!==false;
 if(gradePass)gradePass.enabled=q.grain!==false;
 // --- caméra ---
 if(Math.abs(camera.fov-q.fov)>.01){camera.fov=q.fov;camera.updateProjectionMatrix();}
 camDist=Math.max(4.5,Math.min(13,q.camDist));
 // --- interface ---
 document.body.classList.toggle('contrast',!!q.contrast);
 document.body.classList.toggle('lefthand',!!q.leftHand);
 document.documentElement.style.fontSize=(100*q.textScale)+'%';
 // --- audio ---
 setVol();
 applyCbMarkers();}
/* daltonien : les couleurs seules ne portent plus l'information, la forme aussi */

/* ============================================================
   👁 DALTONIEN — vraie implémentation (XAG 103)
   Aucune information ne doit reposer sur la couleur seule.
   On applique des filtres HSV simulant deutéranopie, protanopie
   et tritanopie à l'UI, ET on double chaque signal critique
   d'une forme (halo + glyphe).
   ============================================================ */
const CB_FILTERS={
 none:'',
 deut:'url(#fDeut)',
 prot:'url(#fProt)',
 trit:'url(#fTrit)'};
function applyCbMarkers(){
 const m=opt().cbMode;
 // 3 étatsivalents pour le CSS : off / deut / prot (protan et deut partagent
 // la même stratégie de lisibilité), et un attribut data pour un filtre fin si besoin.
 const on=!!m&&m!=='none';
 document.body.classList.toggle('cb',on);
 document.body.dataset.cb=!on?'':m;
 // Le filtre SVG est appliqué au HUD via CSS (voir #hud), pas via JS :
 // c'est plus fiable sur WebView Android.
}
/* styles dédiés au mode daltonien : contrastes poussés + formes */

/* ============================================================
   📅 RITUEL QUOTIDIEN — le levier D1
   Une raison de rouvrir le jeu chaque jour : récompense quotidienne
   et série qui monte jusqu'à un vrai lot.
   ============================================================ */
const DAILY_REW=[
 {money:25},{money:40},{seeds:1},{money:70},{money:90,seeds:1},
 {money:110},{money:150,seeds:2,big:true}];
function dailyState(){if(!S.daily)S.daily={last:'',streak:0,claimed:false};return S.daily;}
function todayKey(){return Math.floor(Date.now()/86400000);}
function dailyTick(){
 const d=dailyState(),t=todayKey();
 if(d.last!==String(t)){
  if(d.last&&String(Number(d.last)+1)!==String(t))d.streak=0;   // jour manqué = série remise à zéro
  d.last=String(t);d.claimed=false;}}
function dailyReward(){
 dailyTick();
 const d=dailyState();
 if(d.claimed){toast('Déjà récupéré aujourd’hui — reviens demain 🔥','warn');return;}
 const r=DAILY_REW[Math.min(7,d.streak)];
 d.claimed=true;d.streak=Math.min(7,d.streak+1);
 S.money+=r.money;if(r.seeds)S.seeds.classique+=r.seeds;
 toast((r.big?'🎁 <b>JOUR 7 !</b> ':'📅 <b>Jour '+d.streak+'</b> ')+
  '+'+r.money+' €'+(r.seeds?' + '+r.seeds+' graine(s)':'')+(r.big?' — série complète !':''),
  'gold',r.big?4800:2600);
 sndCash();vib(30);syncHUD();save();renderProg();}
function streakLabel(){
 const d=dailyState();dailyTick();
 if(d.claimed)return '✓ Récupéré aujourd’hui — série de '+d.streak+' jour(s)';
 const nx=DAILY_REW[Math.min(7,d.streak)];
 return '🔥 Série : '+d.streak+' jour(s) — '+nx.money+' € demain'+(nx.seeds?' + '+nx.seeds+' graine':'');}
/* ============================================================
   🗓️ DÉFI HEBDOMADAIRE — un but à moyenne échéance
   ============================================================ */
const WEEK=[
 {id:'sold',ico:'💰',t:'Livre 40 g',tgt:40,fn:()=>S.qSum||0,unit:'g'},
 {id:'earn',ico:'🏦',t:'Gagne 800 € au total',tgt:800,fn:()=>S.totalEarned||0,unit:'€'},
 {id:'deal',ico:'🤝',t:'Fais 12 deals',tgt:12,fn:()=>S.totalSold||0,unit:''},
 {id:'grow',ico:'🌿',t:'Récolte 6 plants',tgt:6,fn:()=>S.harvested||0,unit:''}];
function weekState(){if(!S.week)S.week={id:WEEK[0].id,reward:false};return S.week;}
function currentWeek(){return WEEK.find(w=>w.id===weekState().id)||WEEK[0];}
function weekProgress(){const w=currentWeek();return Math.min(w.tgt,Math.floor(w.fn()));}
function weekPct(){const w=currentWeek();return Math.min(1,w.fn()/w.tgt);}
function claimWeek(){
 const st=weekState(),w=currentWeek();
 if(st.reward){toast('Déjà réclamé cette semaine','warn');return;}
 if(weekProgress()<w.tgt){toast('Encore '+Math.ceil(w.tgt-weekProgress())+(w.unit?' '+w.unit:'')+' à faire','warn');return;}
 st.reward=true;S.money+=250;addRep(2);
 toast('🏆 <b>Défi de la semaine accompli !</b> +250 € • +2 ★','gold',4000);
 sndCash();save();renderProg();syncHUD();}
/* ============================================================
   👑 MÉTA-PROGRESSION — paliers d'empire (le «.meta layer »)
   ============================================================ */
function renderProg(){
 const d=dailyState();dailyTick();
 const r=RANKS[rankIdx()],nx=rankNext();
 const w=currentWeek(),wp=weekProgress();
 const ti=currentTier(),nt=nextTier();
 const span=nt?Math.max(1,nt.xp-ti.xp):1;
 const pct=nt?Math.round(Math.max(0,Math.min(1,((S.rankXp|0)-ti.xp)/span))*100):100;
 $('progBody').innerHTML=
  '<div class="optsect">Carrière</div>'+
  '<div class="optrow"><span>🏅 '+r.ico+' <b>'+r.nom+'</b><small>Paye ×'+r.pay+' • risque ×'+r.risk+'</small></span></div>'+
  (rankIdx()<RANKS.length-1
   ?'<div class="optrow"><span>↑ Rang suivant : <b>'+nx.nom+'</b><small>'+
    Math.max(0,Math.ceil(nx.xp-S.rankXp))+' € encore à gagner</small></span></div>':'')+
  '<div class="optsect">Rituel quotidien</div>'+
  '<div class="optrow"><span>'+streakLabel()+'<small>7 jours d’affilée = 150 € + 2 graines.</small></span>'+
   '<button class="bigbtn" id="pgDaily" style="margin:0;min-height:46px;width:auto;flex:0 0 auto;'+
   'background:'+(d.claimed?'#333':'#3ddc74')+'">'+(d.claimed?'✓ Fait':'Récupérer')+'</button></div>'+
  '<div class="optsect">Défi de la semaine</div>'+
  '<div class="optrow"><span>'+w.ico+' <b>'+w.t+'</b><small>'+wp+' / '+w.tgt+' '+w.unit+
   '<div style="height:7px;background:rgba(255,255,255,.12);border-radius:9px;margin-top:5px">'+
   '<div style="height:100%;width:'+Math.round(weekPct()*100)+'%;background:var(--gold);border-radius:9px"></div>'+
   '</div></span><button class="bigbtn" id="pgWeek" style="margin:0;min-height:46px;width:auto;flex:0 0 auto;'+
   'background:'+(weekState().reward?'#333':(wp>=w.tgt?'#ffd166':'#2a3a30'))+'">'+
   (weekState().reward?'✓ Fait':(wp>=w.tgt?'250 €':'En cours'))+'</button></div>'+
  '<div class="optsect">Palier d’empire</div>'+
  '<div class="optrow"><span>'+ti.ico+' <b>'+ti.nom+'</b><small>'+ti.perk+' '+
   (nt?'<br>Suivant : '+nt.nom+' ('+(S.rankXp|0)+'/'+nt.xp+')':'')+'</small></span>'+
   (nt?'<b>'+pct+'%</b>':'<b>MAX</b>')+'</div>';
 $('pgDaily').onclick=()=>{if(d.claimed)toast('Reviens demain 🔥','warn');else dailyReward();};
 $('pgWeek').onclick=()=>claimWeek();}
/* pastille d'alerte : le joueur doit VOIR qu'une récompense l'attend,
   sinon le rituel quotidien ne fait aucun retour */
function dailyBadge(){
 const btn=$('btnCareer');if(!btn)return;
 const d=dailyState();dailyTick();
 const ready=!d.claimed;
 const w=currentWeek();
 const wkReady=!weekState().reward&&weekProgress()>=w.tgt;
 btn.style.outline=ready?'3px solid var(--gold)':'';
 btn.style.outlineOffset=ready?'2px':'';
 btn.classList.toggle('on',ready||wkReady);}
function openProg(){renderProg();$('progSheet').classList.add('open');sndBlip(600);}
$('progClose').onclick=()=>$('progSheet').classList.remove('open');

/* secousses réduites : on coupe les vibrations et le balancement caméra */
/* « moins de secousses » : la secousse d'interpellation existe réellement,
   et ce réglage l'annule. Avant, l'option ne pilotait rien. */
function shakeOK(){return !opt().noShake;}
let shakeAmp=0,shakeT=0;
function addShake(a2){
 // si l'option vient d'être activée, on coupe aussi la secousse déjà en cours
 if(!shakeOK()){shakeAmp=0;shakeT=0;return;}
 shakeAmp=Math.min(.6,shakeAmp+a2);shakeT=Math.min(.5,shakeT+.4);}
function shakeTick(dt,now){
 if(!shakeOK()){shakeAmp=0;shakeT=0;return;}
 if(shakeT<=0)return;
 shakeT-=dt;
 const amp=shakeAmp*Math.max(0,shakeT)*Math.max(0,shakeT);
 if(amp<0.0005)return;
 camera.position.x+=Math.sin(now/23)*amp*.5;
 camera.position.y+=Math.cos(now/19)*amp*.35;}
const OPT_SECTIONS=[
 ['🔊 Audio',[
  ['vol','Volume général',0,1,.05,v=>Math.round(v*100)+'%',1],
  ['volMusic','Musique',0,1,.05,v=>Math.round(v*100)+'%',1],
  ['volSfx','Effets',0,1,.05,v=>Math.round(v*100)+'%',1],
 ]],
 ['🖼 Graphismes',[
  ['quality','Qualité',null,null,null,v=>({eco:'Éco',std:'Standard',high:'Élevé',auto:'Auto'})[v]||v,['auto','eco','std','high']],
  ['shadows','Ombres',null,null,null,null,null],
  ['bloom','Bloom (halo lumineux)',null,null,null,null,null],
  ['grain','Grain & étalonnage',null,null,null,null,null],
  ['fov','Champ de vision',44,74,1,v=>v+'°',1],
 ]],
 ['🎥 Caméra',[
  ['sens','Sensibilité',.3,2.5,.1,v=>v.toFixed(1)+'×',1],
  ['camDist','Distance',4.5,13,.5,v=>v.toFixed(1),1],
  ['invertX','Inverser le joystick',null,null,null,null,null],
 ]],
 ['♿ Accessibilité',[
  ['textScale','Taille du texte',.85,1.4,.05,v=>Math.round(v*100)+'%',1],
  ['contrast','Contraste renforcé',null,null,null,null,null],
  ['cbMode','Daltonien',null,null,null,
   v=>({none:'Normal',deut:'Deutéranopie',prot:'Protanopie',trit:'Tritanopie'})[v]||v,
   ['none','deut','prot','trit']],
  ['noShake','Moins de secousses',null,null,null,null,null],
  ['vibrate','Vibrations',null,null,null,null,null],
  ['leftHand','Interface gauchère',null,null,null,null,null],
 ]],
 ['💾 Partie',[
  ['autoSave','Sauvegarde auto',null,null,null,null,null],
 ]],
];
function renderOpts(){
 const q=opt();
 const row=(key,label,hint,ctl)=>'<div class="optrow"><span>'+label+
  (hint?'<small>'+hint+'</small>':'')+'</span><div class="optctl">'+ctl+'</div></div>';
 let html='';
 for(const [title,items] of OPT_SECTIONS){
  html+='<div class="optsect">'+title+'</div>';
  for(const [k,label,min,max,step,fmt,choices] of items){
   const v=q[k];
   if(min!=null){
    html+=row(k,label,'','<input type="range" class="optslider" data-o="'+k+'" min="'+min+
     '" max="'+max+'" step="'+step+'" value="'+v+'"><b>'+(fmt?fmt(v):v)+'</b>');
   }else if(choices){
    // sélecteur cyclique : plusieurs états, pas un simple interrupteur
    html+=row(k,label,'appuie pour changer',
     '<button class="optbtn on" data-c="'+k+'">'+(fmt?fmt(v):v)+' ▸</button>');
   }else{
    html+=row(k,label,'','<button class="optbtn '+(v?'on':'off')+'" data-t="'+k+'">'+(v?'ON':'OFF')+'</button>');
   }}}
 // actions de partie
 html+='<div class="optsect">Sauvegarde de la partie</div>'+
  '<button class="bigbtn" id="optExport" style="background:#223;color:#fff">💾 Exporter la sauvegarde</button>'+
  '<button class="bigbtn" id="optImport" style="background:#223;color:#fff">📂 Restaurer une sauvegarde</button>'+
  '<button class="bigbtn optdanger" id="optReset">♻ Recommencer à zéro</button>';
 $('optBody').innerHTML=html;
 $('optBody').querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{
  const k=b.dataset.t;q[k]=!q[k];sndBlip(520);applyOpts();save();renderOpts();});
 $('optBody').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{
  const k=b.dataset.c,it=OPT_SECTIONS.flatMap(x=>x[1]).find(x=>x[0]===k);
  const i=it[6].indexOf(q[k]);
  q[k]=it[6][(i+1)%it[6].length];
  sndBlip(520+k.length*30);applyOpts();save();renderOpts();});
 $('optBody').querySelectorAll('[data-o]').forEach(r=>r.oninput=()=>{
  const k=r.dataset.o;q[k]=Number(r.value);
  const b=r.parentElement.querySelector('b');
  const it=OPT_SECTIONS.flatMap(s=>s[1]).find(x=>x[0]===k);
  if(b)b.textContent=it&&it[5]?it[5](q[k]):q[k];
  applyOpts();save();});
 $('optExport').onclick=()=>{
  const blob=new Blob([JSON.stringify(S)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='hoodgrow-save.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('💾 Sauvegarde exportée','gold');};
 $('optImport').onclick=()=>{
  const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;
   const fr=new FileReader();
   fr.onload=()=>{try{
     const d=JSON.parse(fr.result);
     if(!d||typeof d!=='object'||!('money' in d))throw new Error('format');
     localStorage.setItem(SAVE_KEY,JSON.stringify(d));
     toast('📂 Sauvegarde restaurée — rechargement…','gold',2600);
     setTimeout(()=>location.reload(),900);
    }catch{toast('Fichier de sauvegarde invalide','warn');}};
   fr.readAsText(f);};
  inp.click();};
 $('optReset').onclick=()=>{
  if(!confirm('Effacer toute la progression et recommencer ?'))return;
  try{localStorage.removeItem(SAVE_KEY);}catch{}
  location.reload();};}
function openOpts(){switchSheet('optionsSheet');renderOpts();sndBlip(600);}

/* grade : A (soins parfaits) / B / C (négligé) -> multiplicateur de prix */
function gradeOf(p){let q=0;
 q+=p.w>25&&p.w<85?.45:p.w>=15&&p.w<=95?.25:0;
 q+=p.n>15?.3:.1;
 q+=p.health>85?.25:p.health>55?.15:0;
 if(p.flush)q+=.2;
 if(p.defol)q+=.1;
 if(p.pest)q-=.35;
 return q>=1.05?'A':q>=.7?'B':'C';}
const GRADEMUL={A:1.35,B:1,C:.75};
function avgMul(){return S.stock>0.1?GRADEMUL[S.grade||'B']:1;}
function yieldPerPlant(p){const m=STRAINS[p.s||0];
 const G=p.gx!=null?genomeOf(p.gx):null;
 let g=(8+Math.random()*6)*m.y*(G?G.rend:1);
 if(S.up.xl)g*=1.5;
 if(p.fragile)g*=2; // wodka : double ou mort
 return Math.max(1,Math.round(g));}
function thcOf(p){const base=18+ (p.s||0)*4;
 const G=p.gx!=null?genomeOf(p.gx):null;
 return Math.min(34,Math.round((base*(G?G.thc:1))+ (p.flush?1.5:0)+(p.defol?1.5:0) ));}
function genomeCount(){return S.genomes.length;}
/* les graines sont un stock fini : il faut en racheter.
   SK est l'unique source de vérité pour l'index <-> clé de graine. */
const SK=['classique','express','purple'];
const seedCost=[10,14,18];
/* gx = id de génome planté ; null => variété de base (STRAINS) */
function plantSeed(gx){
 const st=S.strainSel,p=S.pots[S.sel];
 if(p.planted&&!p.dead){toast('Pot occupé — récolte d\'abord','warn');return false;}
 if(gx!=null){ // plantation d'un génome issu du labo
  const idx=S.genomes.indexOf(gx);
  if(idx<0){toast('Graine inconnue','warn');return false;}
  S.genomes.splice(idx,1);
  S.money-=2;S.grown++;
  S.pots[S.sel]={g:2,w:65,n:65,h:100,planted:true,ready:false,s:st,gx:gx,fragile:!!genomeOf(gx).fragile};
  toast('🧬 '+genomeOf(gx).nom+' plantée','gold');sndBlip(520);vib(10);missionCheck();return true;}
 const key=SK[st];
 if(p.dead)S.pots[S.sel]={g:0,w:60,n:60,h:100,planted:false,ready:false,s:st,gx:null,fragile:false};
 if((S.seeds[key]|0)<=0){toast('🌱 Plus de graine '+STRAINS[st].nom+' — achète-en (boutique 🌱)','warn');switchSheet('shopSheet');return false;}
 if(S.money<3){toast('💰 Il faut 3 € pour planter','warn');return false;}
 S.seeds[key]--;S.money-=3;S.grown++;
 S.pots[S.sel]={g:2,w:65,n:65,h:100,planted:true,ready:false,s:st,gx:null,fragile:false};
 sndBlip(520);vib(10);missionCheck();return true;}
const SHOP_SEEDS=[
 {st:0,q:1, ico:'🌿',t:'Graine Classique',d:'Rendement normal'},
 {st:1,q:3, ico:'⚡',t:'Graine Express',  d:'Pousse ×1,55'},
 {st:2,q:2, ico:'🟣',t:'Graine Purple',  d:'Rendement ×1,5'},
];
function renderShop(){
 if(!$('shopSeeds'))return;
 if($('shMoney'))$('shMoney').textContent=Math.floor(S.money)+' €';
 const el=$('shopSeeds');el.innerHTML='';
 SHOP_SEEDS.forEach((it,i)=>{
  const cost=seedCost[it.st]*it.q;
  const d=document.createElement('div');d.className='upg';
  d.innerHTML='<div style="font-size:26px">'+it.ico+'</div><div class="inf"><b>'+it.t+'</b><br>'+
   '<span style="color:var(--muted)">'+it.d+' • en stock : <b>'+(S.seeds[SK[it.st]]|0)+'</b></span></div>';
  const b=document.createElement('button');
  b.textContent=cost+' €';b.style.background=S.money>=cost?'#3ddc74':'#2a3a30';b.style.color='#fff';
  b.disabled=S.money<cost;
  b.onclick=()=>{buySeed(i);renderGrow();syncHUD();};
  d.appendChild(b);el.appendChild(d);});}
function buySeed(i){const it=SHOP_SEEDS[i];if(!it)return;
 const key=SK[it.st],cost=seedCost[it.st]*it.q;
 if(S.money<cost){toast('💰 Pas assez ('+cost+' €)','warn');return;}
 S.money-=cost;S.seeds[key]=(S.seeds[key]|0)+it.q;
 toast('🌱 +'+it.q+' graine(s) '+it.t.replace('Graine ',''),'gold');sndBlip(660);save();renderShop();}
/* boutons toujours rendus : shop + serre + boutique de graines */
function renderGrow(){
 renderShop();
 if(!$('gMoney'))return;
 /* fiche cycle lumineux + consommation */
 const lp=lightPhase();
 $('lightBox').innerHTML=(S.powerOn?'':'<b>🔌 Grow hors tension</b> — ')
  +'💡 <b>'+(lp.on?'Lumière ON':'Nuit (repos)')+'</b> • cycle 18h/6h • allumage à '
  +String(S.lightStart).padStart(2,'0')+'h • '+lp.next+' dans '+Math.ceil(lp.until)+' h'
  +'<br><small>Consommation : '+roomPowerKW().toFixed(2)+' kW • facturée au fil de l\'eau</small>';
 const db=$('dryBox');
 if(S.drying.length){db.style.display='block';
  db.innerHTML='🌬️ <b>En séchage :</b> '+S.drying.map(d=>Math.round(d.g)+'g '+d.grade+' · '+
   Math.max(0,Math.ceil(d.need-d.t))+'h').join(' — ');
 }else db.style.display='none';
 const sel=S.pots[S.sel];
 $('gPower').innerHTML=S.powerOn?'🔌<br>ON':'🔌<br>COUPÉ';
 $('gClock').innerHTML='🕗<br>'+String(S.lightStart).padStart(2,'0')+'h';
 $('gPh').innerHTML='🧪<br>pH '+(sel.pH||6).toFixed(1);
 $('gPest').innerHTML=sel.pest?'🐛<br>Traiter':'🐛<br>OK';
 $('gPh').style.background=Math.abs((sel.pH||6)-6)<=.3?'#22d3ee':'#b45309';
 $('gMoney').textContent=Math.floor(S.money)+' €';$('gStock').textContent=(Math.round(S.stock*10)/10)+' g';
 $('gXl').textContent=S.up.xl?' • 🪣 XL':'';
 $('gSeeds').innerHTML=STRAINS.map((t,i)=>'<b>'+t.ico+' '+(S.seeds[SK[i]]|0)+'</b>').join(' · ');
 $('gPlantCost').textContent=(S.seeds[SK[S.strainSel]]|0)>0?'3 €':'0 graine';
 $('gLab').textContent=S.genomes.length+' 🧬';
 const ss=$('strainSel');ss.innerHTML='';
 STRAINS.forEach((t,i)=>{const b=document.createElement('button');
  b.style.cssText='flex:1;border-radius:10px;border:1px solid '+(S.strainSel===i?'#3ddc74':'rgba(255,255,255,.15)')+';background:'+(S.strainSel===i?'rgba(61,220,116,.2)':'rgba(255,255,255,.05)')+';color:#fff;font-size:11px;font-weight:800;padding:8px 2px;min-height:44px';
  b.innerHTML=t.ico+' '+t.nom+'<br><small>x'+t.y+'g'+(t.spd>1?' • vite':t.spd<1?' • lent':'')+'</small>';
  b.onclick=()=>{S.strainSel=i;renderGrow();};ss.appendChild(b);});
 const el=$('potGrid');el.innerHTML='';
 S.pots.forEach((p,i)=>{const d=document.createElement('div');d.className='pot'+(i===S.sel?' sel':'');
  const e=!p.planted?'🪴':p.ready?'💜✨':p.g<40?'🌱':'🌿';
  d.innerHTML='<div class="em">'+e+'</div>Pot '+(i+1)+'<br>'+(!p.planted?'vide':STRAINS[p.s||0].ico+' '+Math.floor(p.g)+'% • 💧'+Math.round(p.w))
   +'<br><small>pH '+(p.pH||6).toFixed(1)+' '+phLabel(p.pH||6)+(p.pest?' • 🐛':'')+'</small>';
  d.onclick=()=>{S.sel=i;renderGrow();};el.appendChild(d);});}
$('gPlant').onclick=()=>{if(plantSeed()){save();renderGrow();syncHUD();}};
$('gWater').onclick=()=>{const p=S.pots[S.sel];if(!p.planted){toast('Plante d’abord','warn');return;}p.w=Math.min(100,p.w+38);sndBlip(440);save();renderGrow();};
$('gFeed').onclick=()=>{const p=S.pots[S.sel];if(!p.planted){toast('Plante d’abord','warn');return;}if(S.money<5){toast('💰 5 € requis','warn');return;}
 S.money-=5;p.n=Math.min(100,p.n+34);p.pH=Math.max(4.2,(p.pH||6)-.12); // les nutriments font baisser le pH
 save();renderGrow();syncHUD();};
/* correcteur de pH : ramène le substrat vers 6.0 */
$('gPh').onclick=()=>{const p=S.pots[S.sel];
 if(!p.planted){toast('Plante d’abord','warn');return;}
 if(S.money<2){toast('💰 2 € requis','warn');return;}
 p.pH=p.pH+(p.pH<6?Math.min(.35,6-p.pH):-Math.min(.35,p.pH-6));
 S.money-=2;sndBlip(520);vib(8);save();renderGrow();syncHUD();};
/* traitement antiparasitaire */
$('gPest').onclick=()=>{const p=S.pots[S.sel];
 if(!p.planted){toast('Plante d’abord','warn');return;}
 if(!p.pest){toast('Aucun ravageur sur ce pot','warn');return;}
 if(S.money<4){toast('💰 4 € requis','warn');return;}
 S.money-=4;p.pest=false;S.pestsTreated=(S.pestsTreated|0)+1;toast('🐛 Traitement appliqué','gold');sndBlip(700);save();renderGrow();syncHUD();};
/* couper le courant des grow : moins d'électricité, mais plus de croissance */
$('gPower').onclick=()=>{S.powerOn=!S.powerOn;sndBlip(S.powerOn?700:320);vib(10);
 toast(S.powerOn?'🔌 Courant rétabli':'🔌 Grow hors tension — ça ne poussera plus',S.powerOn?'gold':'warn');
 save();renderGrow();};
/* décaler le cycle lumineux (allumage 18 h plus tard) */
$('gClock').onclick=()=>{S.lightStart=(S.lightStart+2)%24;
 toast('🕗 Cycle décalé : allumage à '+String(S.lightStart).padStart(2,'0')+'h (18 h de lumière)','gold');
 sndBlip(600);save();renderGrow();};
$('gHarv').onclick=()=>harvestPot();
/* vente */
let sellTarget=null;
function openSell(c){sellTarget=c;bluff=null;if(c.mz==null)c.mz=priceMul(districtAt(c.x,c.z),S.hour);refreshSell();}
function refreshSell(){const c=sellTarget;if(!c)return;const T=CTYPES[c.type];
 refreshClientBase(c);
 const dist=districtAt(c.x,c.z),gm=avgMul(),loyal=1+c.loyal*.06;
 const price=(9*c.gen*gm*loyal*priceMul(dist,c.mz!=null?c.mz:S.hour)).toFixed(1);
 $('sellTitle').textContent=T.e+' '+T.n+' — veut '+c.demand+'g'+(c.loyal?' ❤️'.repeat(c.loyal):'');
 $('sellInfo').innerHTML='Paie <b style="color:var(--gold)">'+price+' €/g</b>'+
  (gm>1?' • lot <b>Premium</b> 🏅':gm<1?' • lot <b>bradé</b> 📉':'')+
  ' • Sur toi : <b>'+(Math.round(S.stock*10)/10)+'g</b>'+(c.haggled?' • <b>Négocié +12%</b>':'')+
  (dist?'<br><small>'+dist.nom+' — risque ×'+dist.risk+'</small>':'');
 $('patFill').style.width=(c.pat/c.patMax*100)+'%';
 const risk=sellRisk();$('riskV').textContent=Math.round(risk*100)+'%';$('riskFill').style.width=(risk*100)+'%';
 $('riskTxt').textContent=risk>.6?'🔴 Très risqué — un flic te voit !':risk>.3?'🟡 Risqué — éloigne-toi des cônes':'🟢 Discret — vas-y';
 $('sell2').textContent='Vendre 2g (+'+Math.round(2*9*c.gen*gm*loyal*priceMul(dist,S.hour))+' €)';
 const q=Math.min(c.demand,Math.floor(S.stock));
 $('sellMax').textContent='Vendre '+q+'g (+'+Math.round(q*9*c.gen*gm*loyal*priceMul(dist,S.hour))+' €)';
 $('sellLine').textContent='"'+clientLine(c)+'"';
 $('bluffBox').style.display='block';
 if(bluff){
  const m=moodInfo(c);
  $('bluffTxt').innerHTML=
   '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">'+
    '<span style="font-size:22px">'+m.ico+'</span>'+
    '<b style="color:'+m.col+'">'+m.nom+'</b>'+
    '<span style="margin-left:auto;font-weight:800">prix ×'+bluff.mult.toFixed(2)+'</span></div>'+
   '<div style="font-size:11.5px;opacity:.9;margin-bottom:4px">'+m.desc+'</div>'+
   '<div style="display:flex;gap:4px;margin:4px 0">'+
    [0,1,2,3].map(i=>'<i style="flex:1;height:6px;border-radius:99px;background:'+
     (bluff.level>i?m.col:'rgba(255,255,255,.14)')+'"></i>').join('')+'</div>'+
   '<div style="font-size:11px;margin-top:5px">'+readAdvice(c)+'</div>'+
   '<div style="font-size:10.5px;opacity:.65;margin-top:3px">Round '+bluff.round+'/3 • '+
    (bluff.level>0?'+7% par bluff (max ×1.29), −7 s de patience':'prix standard. Reculer : −7%, et lui rend 4 s de patience')+'</div>';}
 else{
  const m=moodInfo(c);
  $('bluffTxt').innerHTML='<div style="display:flex;gap:6px;align-items:center">'+
   '<span>'+m.ico+'</span><b style="color:'+m.col+'">'+m.nom+'</b></div>'+
   '<div style="font-size:11px;opacity:.85;margin-top:3px">'+readAdvice(c)+'</div>';}
 applyMoodPose(c);
 $('sellHaggle').disabled=c.haggled;
 $('sellHaggle').textContent=bluff?'Négociation en cours…':(c.haggled?'😏 Négocié ×'+c.gen.toFixed(2):'😏 Tenter la négociation');
 if(!$('sellSheet').classList.contains('open'))$('sellSheet').classList.add('open');}
$('sellClose').onclick=()=>closeSell();
$('sellHaggle').onclick=()=>{const c=sellTarget;if(!c)return;
 if(c.haggled){toast('Déjà négocié','warn');return;}
 if(Math.floor(S.stock)<1){toast('Stock vide — récolte d\'abord !','warn');return;}
 S.wanted=Math.min(5,S.wanted+.3);alarmT=Math.max(alarmT,4);
 startBluff();save();};
$('bluffUp').onclick=()=>bluffStep(true);
$('bluffDown').onclick=()=>bluffStep(false);
function sellRisk(){const d=nearestCop();let r=.10+S.wanted*.09+(S.stock>20?.12:0)+(d<8?.45:d<14?.2:0);
 const dist=districtAt(player.pos.x,player.pos.z);
 if(dist)r*=dist.risk;
 if(player.riding)r+=.05;
 r*=(1+repHeat()*.45)*rankRisk();
 // la météo rend le joueur plus visible (ou plus discret sous la brume)
 if(S.weather==='rain')r*=.85;
 if(S.weather==='fog')r*=.6;
 return Math.min(.96,Math.max(.03,r));}
function doSell(q){const c=sellTarget;if(!c)return;q=Math.min(q,Math.floor(S.stock),c.demand);if(q<1){toast('Stock insuffisant — récolte !','warn');return;}
 const gm=avgMul(),loyal=1+c.loyal*.06,pm=payMul();
 const gain=Math.round(q*9*c.gen*gm*loyal*pm*priceMul(districtAt(c.x,c.z),c.mz!=null?c.mz:S.hour));
 S.stock-=q;S.qSum-=q*gm;
 if(S.stock<=.1){S.stock=0;S.qSum=0;S.grade='B';}
 S.money+=gain;S.totalSold+=q;S.totalEarned+=gain;S.clients++;gainXp(20);
 addRankXp(gain); // le rang dépend des euros gagnés, pas du stock
 const witnessed=nearestCop()<12||Math.random()<S.wanted*.12;
 S.wanted=Math.min(5,S.wanted+(witnessed?1.5:.5));S.maxWanted=Math.max(S.maxWanted,S.wanted);alarmT=8;
 closeSell();sndCash();vib(25);
 toast('💰 +'+gain+' € ('+q+'g'+(gm>1?' 🏅':gm<1?' 📉':'')+')'+(c.loyal?' ❤️':'')+(witnessed?' — <b>REPÉRÉ ! 🚨</b>':''),witnessed?'warn':'gold');
 addRep(witnessed?-1:(nearestCop()<20?.5:1));
 if(c.vip)S.vipSold=(S.vipSold|0)+1;
 if(!witnessed&&c.loyal<4&&Math.random()<.4)c.loyal++;
 newDemand(c);missionCheck();save();syncHUD();}
$('sell2').onclick=()=>doSell(2);$('sellMax').onclick=()=>doSell(sellTarget?sellTarget.demand:0);
/* planque */
function openSafe(){$('safeSheet').classList.add('open');renderSafe();}
$('safeClose').onclick=()=>switchSheet('');
const UPGS=[{k:'xl',im:'🪣',t:'Pots XL',d:'+50% par récolte • 150 €',can:()=>!S.up.xl&&S.money>=150,go(){S.money-=150;S.up.xl=true;}},
 {k:'turbo',im:'⚡',t:'Vélo turbo',d:'Vitesse max 11 • 120 €',can:()=>!S.up.turbo&&S.money>=120,go(){S.money-=120;S.up.turbo=true;}},
 {k:'look',im:'🔭',t:'Guetteur',d:'Clients 2x plus patients • 100 €',can:()=>!S.up.look&&S.money>=100,go(){S.money-=100;S.up.look=true;clients.forEach(c=>{c.patMax*=1.5;c.pat=c.patMax;});}},
 {k:'stash',im:'🧰',t:'Planque renforcée',d:'+40g de capacité • 130 €',can:()=>S.stashMax<=40&&S.money>=130,go(){S.money-=130;S.stashMax+=40;}},
 {k:'stash2',im:'🏦',t:'Coffre-fort',d:'+80g de capacité • 220 €',can:()=>S.stashMax<=80&&S.money>=220,go(){S.money-=220;S.stashMax+=80;}},
 {k:'info',im:'🕵️',t:'Mouchard',d:'6 h : les flics te voient −38% • '+INFORMANT_COST()+' €',can:()=>S.money>=INFORMANT_COST()&&S.informantT<=0,go(){buyInformant();}},
 {k:'pass',im:'🎫',t:'Passe de contrôle',d:'Traverse un barrage sans payer • 90 €',can:()=>!S.up.pass&&S.money>=90,go(){S.money-=90;S.up.pass=true;S.passes++;}},
 {k:'law',im:'⚖️',t:'Avocat (soudoie)',d:'-2★ immédiates • 120 €',can:()=>S.money>=120&&S.wanted>0&&S.lawT<=0,go(){S.money-=120;S.wanted=Math.max(0,S.wanted-2);S.lawT=60;toast('⚖️ Dossier étouffé : -2★','gold');}}];
function renderSafe(){$('sCarry').textContent=(Math.round(S.stock*10)/10)+' g';
 $('sStash').textContent=(Math.round(S.stash*10)/10)+' g';$('sCap').textContent=stashCap()+' g'+(player.mount&&player.mount!=='velo'&&vehOwned(player.mount)
   ?' <small style="opacity:.7">(coffre '+vehData(player.mount).ico+')</small>':'');
 const el=$('upgs');el.innerHTML='';
  UPGS.forEach(u=>{const owned=u.k==='info'?(S.informantT>0):u.k==='pass'?!!S.up.pass
   :u.k!=='law'&&((u.k==='xl'&&S.up.xl)||(u.k==='turbo'&&S.up.turbo)||(u.k==='look'&&S.up.look)||(u.k==='stash'&&S.stashMax>40)||(u.k==='stash2'&&S.stashMax>80));
  const d=document.createElement('div');d.className='upg';
  d.innerHTML='<div style="font-size:26px">'+u.im+'</div><div class="inf"><b>'+u.t+'</b><br><span style="color:var(--muted)">'+u.d+'</span></div>';
  const b=document.createElement('button');b.textContent=owned?'✅':(u.k==='law'&&S.lawT>0?Math.ceil(S.lawT)+'s':'Prendre');
  const ok=!owned&&u.can();b.style.background=ok?'#3ddc74':'#2a3a30';b.style.color='#fff';b.disabled=!ok;
  b.onclick=()=>{if(!u.can())return;u.go();sndBlip(700);vib(10);save();renderSafe();syncHUD();};d.appendChild(b);el.appendChild(d);});
 const pb=$('passBox');
 if(pb){pb.innerHTML='🎫 Passes : <b>'+(S.passes|0)+'</b> — 70 € pièce'
  +'<button id="sBuyPass" style="margin-left:8px;background:'+(S.money>=70?'#22d3ee':'#2a3a30')+
  ';color:#06210f;border-radius:10px;padding:6px 10px;font-weight:800">Acheter</button>';
  $('sBuyPass').onclick=()=>{if(S.money<70){toast('💰 70 € requis','warn');return;}
   S.money-=70;S.passes++;sndBlip(760);save();renderSafe();syncHUD();};}
 renderVeh();
 const hz=$('hoodies');hz.innerHTML='';
 HOODIES.forEach((c,i)=>{const b=document.createElement('button');
  b.style.background='#'+c.toString(16).padStart(6,'0');b.textContent='🧢';
  b.style.border=S.hoodie===i?'2px solid #3ddc74':'2px solid rgba(255,255,255,.3)';
  b.onclick=()=>{S.hoodie=i;S.styled=true;applyHoodie();missionCheck();save();renderSafe();};hz.appendChild(b);});}
$('sDepot').onclick=()=>{if(S.stock<1){toast('Rien à déposer','warn');return;}
 const put=pushStash(S.stock);const lost=S.stock-put;S.stock=lost;
 if(put<=.01){toast('⚠️ Planque pleine ! Améliore-la','warn');renderSafe();return;}
 toast('📥 +'+Math.round(put*10)/10+'g à l\'abri'+(lost>0?' — **planque pleine, '+Math.round(lost*10)/10+'g abandonnés**':''),'gold');
 missionCheck();save();renderSafe();syncHUD();};
/* secours d'urgence : évite le softlock si le joueur n'a plus rien */
$('sRescue').onclick=()=>{const cost=25;
 if(S.money<cost){toast('💰 Il faut '+cost+' €','warn');return;}
 S.money-=cost;S.rescues++;
 const g=8+Math.round(Math.random()*4);
 S.stock+=g;S.qSum+=g;
 S.seeds.classique=(S.seeds.classique|0)+2;
 toast('📦 '+g+'g + 2 graines Classique. Aucun contrôle.','gold');sndBlip(660);
 S.wanted=Math.max(0,S.wanted-1);save();renderSafe();syncHUD();};
$('sTake').onclick=()=>{const q=Math.min(10,S.stash);if(q<1){toast('Planque vide','warn');return;}S.stash-=q;S.stock+=q;save();renderSafe();syncHUD();};
/* busted */
function busted(){if(bustLock)return;bustLock=true;chase=false;sirenStop();$('chase').style.display='none';
 const fine=Math.round(S.money*.3),lost=Math.ceil(S.stock*.5);
 S.money-=fine;S.stock-=lost;S.wanted=0;S.bustedN++;cops.forEach(c=>{if(!c.extra){c.state='patrol';c.meter=0;}});
 // retire renfort
 for(let i=cops.length-1;i>=0;i--)if(cops[i].extra){scene.remove(cops[i].mesh);scene.remove(cops[i].cone);cops.splice(i,1);}
 $('bustTxt').innerHTML='Amende : <b>-'+fine+' €</b><br>Sur toi saisis : <b>-'+lost+'g</b> (la planque est sauve 😉)<br>Retour à la maison…';
 addShake(.45);$('busted').classList.add('open');sfxBust();vib(80);
 setTimeout(()=>{$('busted').classList.remove('open');player.pos.set(0,0,6);player.riding=false;bustLock=false;save();syncHUD();},2600);save();syncHUD();}
