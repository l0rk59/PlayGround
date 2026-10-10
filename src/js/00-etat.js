/* ==== 00-etat.js — État, sauvegarde, génétique de base ==== */
/* ============ ÉTAT ============ */
const STRAINS=[{nom:'Classique',ico:'🌿',spd:1,y:1,col:0x2fae5f},{nom:'Express',ico:'⚡',spd:1.55,y:.7,col:0xb8d94a},{nom:'Purple',ico:'🟣',spd:.8,y:1.5,col:0x9d6bff}];
/* ===== GÉNÉTIQUE : ADN defined avant tout usage =====
   Chaque souche porte {vitesse, rendement, THC, couleur}.
   - mutation  : dérive un ADN de son parent (à la récolte)
   - croisement: mélange deux ADN (labo)
   Les ADN mutants sont nommés et deviennent des variétés à part entière. */
const BASE_GENOMES={
 classique:{nom:'Classique',couleur:0x2fae5f,vit:.9, rend:1,   thc:1},
 express:  {nom:'Express',  couleur:0xb8d94a,vit:1.5,rend:.75, thc:.9},
 purple:   {nom:'Purple',   couleur:0x9d6bff,vit:.75,rend:1.45,thc:1.1},
};
const FRAGILE_GEN={nom:'Wodka',couleur:0xd94a6b,vit:1.35,rend:2,thc:1.6,fragile:true};
const ADN=[
 {id:0,key:'classique',parent:null,...BASE_GENOMES.classique},
 {id:1,key:'express',  parent:null,...BASE_GENOMES.express},
 {id:2,key:'purple',   parent:null,...BASE_GENOMES.purple},
 {id:3,key:'fragile',  parent:null,...FRAGILE_GEN},
];
const genomeOf=id=>ADN[id]||ADN[0];
/* ============================================================
   GÉNÉTIQUE VISIBLE : chaque souche devient une vraie fiche
   · diagramme des 4 gènes (vitesse, rendement, THC, fragilité)
   · lignée :Parents + génération, et dont vient chaque mutation
   · couleur, rendement estimé,risque réel affiché
   ============================================================ */
const GENE_KEYS=[['vit','Vitesse'],['rend','Rendement'],['thc','THC']];
function genBars(g){
 // 4 barres : vitesse, rendement, THC, fragilité (0 → 2)
 const out=[];
 for(const [k,label] of GENE_KEYS){
  const v=Math.max(0,Math.min(2,g[k]||0));
  const pct=Math.round(v/2*100);
  const col=v>.9?'linear-gradient(90deg,#3ddc74,#22b573)':v<.8?'linear-gradient(90deg,#ffd166,#ff9f1c)':'linear-gradient(90deg,#8bd8ff,#4cc3ff)';
  out.push('<div style="display:flex;align-items:center;gap:6px;margin:2px 0">'+
   '<span style="width:62px;font-size:10px;opacity:.8">'+label+'</span>'+
   '<div style="flex:1;height:7px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden">'+
   '<i style="display:block;height:100%;width:'+pct+'%;background:'+col+'"></i></div>'+
   '<b style="width:30px;text-align:right;font-size:10px">'+v.toFixed(2)+'</b></div>');}
 if(g.fragile)out.push('<div style="font-size:10px;color:#ff6b8a;margin-top:3px">⚠️ Fragile — 30% de mort à la récolte</div>');
 return out.join('');}
function genCard(gid,selA,selB){
 const g=genomeOf(gid);
 const badge=g.parent!=null?'🧬 mutation':'🌱 souche de base';
 const parents=g.parent!=null&&ADN[g.parent]?'<br><small>issu de <b>'+ADN[g.parent].nom+'</b></small>':'';
 return '<div class="upg" style="align-items:flex-start;flex-direction:column;gap:4px">'+
  '<div style="display:flex;align-items:center;gap:7px;width:100%">'+
   '<span style="width:16px;height:16px;border-radius:5px;background:#'+g.couleur.toString(16).padStart(6,'0')+
   ';box-shadow:0 0 9px #'+g.couleur.toString(16).padStart(6,'0')+'"></span>'+
   '<b style="flex:1">'+g.nom+'</b>'+
   (selA?'<span style="font-size:10px;color:#3ddc74">A</span>':'')+
   (selB?'<span style="font-size:10px;color:#b892ff">B</span>':'')+'</div>'+
  '<div style="width:100%">'+genBars(g)+'</div>'+
  '<small style="opacity:.7">'+badge+parents+'</small></div>';}

const fragileId=3;
function nameFor(parentId,tmp){
 const cols=['Neon','Or','Ombre','Cristal','Braise','Venin','Froid','Solar','Ambre','Nyx'];
 return cols[tmp%cols.length]+(Math.floor(tmp/cols.length)||'')+'-'+genomeOf(parentId).nom.slice(0,4);}
const clampG=(v,a,b)=>Math.max(a,Math.min(b,v));
function mutate(id){
 const p=genomeOf(id),dir=Math.random()<.5?-1:1;
 const n={id:ADN.length,key:null,parent:id,
  couleur:Math.max(0x101010,Math.min(0xffffff,p.couleur+dir*0x0b1a2b)),
  vit:clampG(p.vit+(Math.random()-.5)*.5,.4,2.2),
  rend:clampG(p.rend+(Math.random()-.5)*.4,.5,2.4),
  thc:clampG(p.thc+(Math.random()-.5)*.3,.6,2.2)};
 n.nom=nameFor(id,ADN.length);ADN.push(n);return n;}
function cross(a,b){
 const A=genomeOf(a),B=genomeOf(b);
 const n={id:ADN.length,key:null,parent:a,
  couleur:(Math.random()<.5?A.couleur:B.couleur),
  vit:clampG((A.vit+B.vit)/2+(Math.random()-.5)*.3,.4,2.2),
  rend:clampG((A.rend+B.rend)/2+(Math.random()-.5)*.3,.5,2.4),
  thc:clampG((A.thc+B.thc)/2+(Math.random()-.5)*.2,.6,2.2)};
 n.nom=nameFor(b,ADN.length);ADN.push(n);return n;}
const HOODIES=[0x2fae5f,0xb03060,0x2e6bff,0x222222];
/* quartiers : le monde s'étend avec la réputation */
const DISTRICTS=[
 {id:'bloc',  nom:'Le Bloc',   x0:-78,x1:70, z0:-66,z1:66,  risk:1,   rep:0,col:0x1a2630},
 {id:'marche',nom:'Le Marché', x0:86, x1:186,z0:-58,z1:58,  risk:1.45,rep:3,col:0x2a2418},
 {id:'quais', nom:'Les Quais', x0:-62,x1:62, z0:84, z1:184, risk:1.9, rep:7,col:0x14242e},
 {id:'cite',  nom:'La Cité',   x0:-206,x1:-92,z0:-64,z1:64, risk:1.6, rep:5,col:0x22201a},
];
// un quartier verrouillé n'existe pas encore pour le joueur : les barrières
// l'empêchent physiquement d'y entrer, et districtAt ne le reconnaît pas.
function districtAt(x,z){for(const d of DISTRICTS){if(x<d.x0||x>d.x1||z<d.z0||z>d.z1)continue;
 if(S.rep<d.rep)return null;
 return d;}return null;}
const REPNAME=['Inconnu','Habitué','Reconnu','Arrangé','Célébrité'];
const repTier=()=>S.rep>=12?4:S.rep>=8?3:S.rep>=5?2:S.rep>=2?1:0;
/* la réputation monte jusqu'à 30 : palier max bien au-delà de repTier (12) */
const repHeat=()=>Math.min(1,S.rep/18);
