/* ==== 40-world3d.js — Monde 3D avancé : circulation, foule ==== */
/* ================= MAISON AVEC INTÉRIEUR =================
   Coquille vide (murs + porte) : on peut entrer, le toit disparaît
   quand on est dedans, et les murs deviennent translucides. */
/* ============================================================
   HALLES PUBLIQUES : le Marché et la Douane deviennent des
   lieux où on entre vraiment, pas des décors.
   Même logique que la maison : le toit s'ouvre et les murs
   s'effacent quand tu es dedans.
   ============================================================ */
const HALLS=[];
/* une halle générique : murs percés d'une porte, toit, plancher, comptoir */
function buildHall(o){
 const g=new THREE.Group();g.position.set(o.x,0,o.z);scene.add(g);
 const walls=[],roof=new THREE.Group();
 const T=.4,H=o.h||5.2,DW=3.2;
 const wall=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
   new THREE.MeshStandardMaterial({map:tex(FACADE[o.ci%FACADE.length],Math.max(2,w/3),Math.max(2,h/3)),
    color:0xffffff,roughness:.92}));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);walls.push(m.material);return m;};
 // soubassement béton + corniche : sans ça la halle ressemble à une boîte
 const base=new THREE.Mesh(new THREE.BoxGeometry(o.w+.24,.9,o.d+.24),
  new THREE.MeshStandardMaterial({map:tex(concreteTex(),o.w/3,1),color:0xf2f4f8,roughness:.95}));
 base.position.y=.45;base.castShadow=base.receiveShadow=true;g.add(base);
 const trim=new THREE.Mesh(new THREE.BoxGeometry(o.w+.36,.4,o.d+.36),
  new THREE.MeshStandardMaterial({color:0x2b3240,roughness:.9}));
 trim.position.y=H-.42;trim.castShadow=true;g.add(trim);
 const side=(o.w-DW)/2;
 // doublure claire : la brique de façade est trop sombre pour un intérieur
 // 4 pans seulement : pas de plafond, sinon on ne voit plus le ciel par-dessus
 const linerM=new THREE.MeshStandardMaterial({map:tex(concreteTex(),3,2),color:o.liner||0xd9cdb4,roughness:.96});
 [[o.w-.9,0,-o.d/2+.25,0],[o.w-.9,0,o.d/2-.25,Math.PI],
  [o.d-.9,-o.w/2+.25,0,Math.PI/2],[o.d-.9,o.w/2-.25,0,-Math.PI/2]].forEach(([len,x,z,ry])=>{
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(len,H-.4),linerM);
  pl.position.set(x,(H-.4)/2+.05,z);pl.rotation.y=ry;g.add(pl);});
 wall(T,H,o.d,-o.w/2+T/2,H/2,0);
 wall(T,H,o.d, o.w/2-T/2,H/2,0);
 wall(o.w,H,T,0,H/2,-o.d/2+T/2);
 wall(side,H,T,-DW/2-side/2,H/2,o.d/2-T/2);
 wall(side,H,T, DW/2+side/2,H/2,o.d/2-T/2);
 wall(DW,H-3,T,0,3+(H-3)/2,o.d/2-T/2);
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(o.w-T*2,o.d-T*2),
  new THREE.MeshStandardMaterial({map:o.floortex(),color:0xcfcfcf,roughness:.9}));
 fl.rotation.x=-Math.PI/2;fl.position.y=.02;fl.receiveShadow=true;g.add(fl);
 // charpente + tôle : le toit s'ouvre quand tu entres
 const beamGeo=new THREE.BoxGeometry(o.w,.22,.3);
 for(let i=0;i<4;i++){const b=new THREE.Mesh(beamGeo,
   new THREE.MeshStandardMaterial({color:0x2a2f38,roughness:.7,metalness:.5}));
  b.position.set(0,H-.2,-o.d/2+.6+i*(o.d-1.2)/3);roof.add(b);}
 const sheetM=new THREE.Mesh(new THREE.BoxGeometry(o.w+.8,.16,o.d+.8),
  new THREE.MeshStandardMaterial({map:corrugatedTex(),color:o.roof,roughness:.6,metalness:.45}));
 sheetM.position.y=H+.1;sheetM.castShadow=true;roof.add(sheetM);
 g.add(roof);
 // porte battante + poignée
 const door=new THREE.Mesh(new THREE.BoxGeometry(DW-.2,3,.14),
  new THREE.MeshStandardMaterial({color:o.door,roughness:.55,metalness:.35}));
 door.position.set(-DW/2,1.5,o.d/2+.06);door.castShadow=true;g.add(door);
 const hdl=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.5),
  new THREE.MeshStandardMaterial({color:0xcccccc,metalness:.9,roughness:.25}));
 hdl.position.set(DW/2-.5,1.4,o.d/2+.22);g.add(hdl);
 // enseigne néon au-dessus de la porte
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(o.w*.5,1.1),
  new THREE.MeshBasicMaterial({map:neonTex(o.sign,o.neon),transparent:true,depthWrite:false}));
 sign.position.set(0,3.9,o.d/2+.3);g.add(sign);
 // comptoir + marchand
 const cx=o.cx||0,cz=o.cz===undefined?o.d/2-1.6:o.cz;
 const cd=new THREE.Mesh(new THREE.BoxGeometry(o.w*.42,1.1,1.1),
  new THREE.MeshStandardMaterial({color:o.wood,roughness:.9}));
 cd.position.set(cx,.55,cz);cd.castShadow=true;cd.receiveShadow=true;g.add(cd);
 const ven=makePerson(o.vendor,0x1a1a24);ven.position.set(cx,0,cz-1.5);ven.rotation.y=Math.PI;g.add(ven);
 const mk=marker(o.vic,'#ffd166');mk.position.set(cx,2.7,cz-1.5);g.add(mk);
 // plafonniers + halo néon : l'intérieur est éclairé, sinon c'est un trou noir
 const lampM=new THREE.MeshStandardMaterial({color:0xfff4d8,emissive:o.neon,emissiveIntensity:1.6,roughness:.4});
 // 2 plafonniers lumineux + 1 remplissage suffisent : au-delà, on alourdit
 // le shader sans rien gagner visuellement une fois l'intérieur éclairé.
 const nL=2;
 for(let i=0;i<nL;i++){const l=new THREE.Mesh(new THREE.BoxGeometry(1.7,.14,.45),lampM);
  l.position.set(-o.w/4+i*(o.w/2),H-.45,0);g.add(l);
  const pl=new THREE.PointLight(o.neon,3.2,30,2);
  pl.position.set(l.position.x,H-1.3,0);g.add(pl);budgetLight(pl,46);}
 const fillIn=new THREE.PointLight(0xfff0d0,1.8,o.w*1.5,1.6);
 fillIn.position.set(0,2.4,0);g.add(fillIn);budgetLight(fillIn,46);
 // halo au sol sous chaque plafonnier, pour lire l'espace même de loin
 const poolT=glowTex();
 for(let i=0;i<nL;i++){
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(6,6),
   new THREE.MeshBasicMaterial({map:poolT,color:o.neon,transparent:true,opacity:.16,depthWrite:false}));
  pool.rotation.x=-Math.PI/2;pool.position.set(-o.w/2+2+i*(o.w-4)/(nL-1),.03,(i%2?1:-1)*o.d*.2);
  g.add(pool);}
 const hall={o,g,roof,walls,door,vendor:ven,vendorMk:mk,open:false,
  cx,cz,x:o.x,z:o.z,w:o.w,d:o.d};
 HALLS.push(hall);
 solid(o.x-o.w/2+T/2,o.z,T,o.d);
 solid(o.x+o.w/2-T/2,o.z,T,o.d);
 solid(o.x,o.z-o.d/2+T/2,o.w,T);
 solid(o.x-DW/2-side/2,o.z+o.d/2-T/2,side,T);
 solid(o.x+DW/2+side/2,o.z+o.d/2-T/2,side,T);
 return hall;}
/* le joueur est-il dans cette halle ? */
function inHall(h){return Math.abs(player.pos.x-h.x)<h.w/2-.3&&Math.abs(player.pos.z-h.z)<h.d/2-.3;}
function hallAt(){for(const h of HALLS)if(inHall(h))return h;return null;}
function setHallOpen(h,v){
 if(!h||h.open===v)return;h.open=v;
 h.roof.visible=!v;
 h.walls.forEach(m=>{m.transparent=v;m.opacity=v?.1:1;m.depthWrite=!v;});
 if(h.door){const near=dist2(player.pos.x,player.pos.z,h.x,h.z+h.d/2)<4.2;
  const want=v?1.15:(near?.6:0);
  h.door.rotation.y+=(want-h.door.rotation.y)*.15;}}
function corrugatedTex(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 x.fillStyle='#8d939c';x.fillRect(0,0,128,128);
 for(let i=0;i<128;i+=8){const g=x.createLinearGradient(i,0,i+8,0);
  g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(.5,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(0,0,0,.35)');
  x.fillStyle=g;x.fillRect(i,0,8,128);}
 const t=tex(c,1,1);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
function tileTex(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 x.fillStyle='#b9b2a4';x.fillRect(0,0,128,128);
 x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=3;
 for(let i=0;i<=128;i+=32){x.beginPath();x.moveTo(i,0);x.lineTo(i,128);x.stroke();
  x.beginPath();x.moveTo(0,i);x.lineTo(128,i);x.stroke();}
 for(let i=0;i<220;i++){x.fillStyle='rgba(0,0,0,'+(Math.random()*.09)+')';
  x.fillRect(Math.random()*128,Math.random()*128,Math.random()*14+2,Math.random()*14+2);}
 const t=tex(c,1,1);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
function waxTex(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 x.fillStyle='#8f959b';x.fillRect(0,0,128,128);
 for(let i=0;i<400;i++){x.fillStyle='rgba(0,0,0,'+(Math.random()*.12)+')';
  x.fillRect(Math.random()*128,Math.random()*128,Math.random()*20+3,Math.random()*3+1);}
 x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=2;
 x.strokeRect(6,6,116,116);
 const t=tex(c,1,1);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
/* --- Les Halles du Marché --- */
const hallMarket=buildHall({x:104,z:-14,w:20,d:14,h:5.4,ci:0,roof:0xc9a877,
 door:0x3f6b52,floortex:tileTex,sign:'MERCATO',neon:'#3ddc74',vendor:0xc08a4a,
 vic:'€',wood:0xd8b483,cz:-5.4});
/* --- L'entrepôt de la Douane --- */
const hallDouane=buildHall({x:36,z:122,w:22,d:14,h:6,ci:3,roof:0xb4bec9,
 door:0x6a4a72,floortex:waxTex,sign:'DOUANE',neon:'#ff6fb5',vendor:0x5a74b0,
 vic:'📋',wood:0xb9c2cc});
/* --- La Banque du Bloc : l'argent propre, à l'abri des flics --- */
const hallBank=buildHall({x:30,z:42,w:18,d:12,h:5.2,ci:1,roof:0xcfc4a8,liner:0xe6dcc6,
 door:0x4a5f7a,floortex:tileTex,sign:'BANQUE',neon:'#ffd166',vendor:0x5a4a6a,
 vic:'🏦',wood:0xd8c49a,cz:-3.4});
/* --- Le Commissariat : on y achète sonruh pour dormir --- */
const hallPolice=buildHall({x:58,z:-38,w:16,d:12,h:5.6,ci:5,roof:0x8a94a2,liner:0xd4dbe4,
 door:0x2f4a7a,floortex:waxTex,sign:'POLICE',neon:'#4c9dff',vendor:0x2a3a5a,
 vic:'🚓',wood:0x9aa8b8,cz:-3.4});
/* caisses et palettes pour habiller les deux halls */
[[99,-10],[109,-10],[99,-2],[110,-1],[101,-17]].forEach((p,i)=>{
 const box=new THREE.Mesh(new THREE.BoxGeometry(1.2,.9,.9),
  new THREE.MeshStandardMaterial({color:[0xd8b083,0xc79a6c,0xb08a5e][i%3],roughness:.92}));
 box.position.set(p[0],.45,p[1]);box.castShadow=box.receiveShadow=true;scene.add(box);});
[[30,114],[42,115],[28,131],[44,130],[36,120]].forEach((p,i)=>{
 const box=new THREE.Mesh(new THREE.BoxGeometry(1.3,1,.9),
  new THREE.MeshStandardMaterial({map:corrugatedTex(),color:[0x6a9ac8,0x6ac89a,0xc86a6a][i%3],roughness:.7,metalness:.4}));
 box.position.set(p[0],.5,p[1]);box.castShadow=box.receiveShadow=true;scene.add(box);});
const HOME={x:0,z:-11};
const HW=11,HD=8,HH=4.5,T=.45,DOORW=2.4; // largeur, profondeur, hauteur, épaisseur, porte
let houseRoof=null; const wallMats=[];
function buildHouse(){
 const g=new THREE.Group();g.position.set(HOME.x,0,HOME.z);
 const mkWall=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
   new THREE.MeshStandardMaterial({color:0x2a3350,roughness:.8}));m.position.set(x,y,z);
   m.castShadow=true;m.receiveShadow=true;g.add(m);wallMats.push(m.material);return m;};
 // 4 murs + façade percée d'une porte
 mkWall(T,HH,HD,-HW/2+T/2,HH/2,0);
 mkWall(T,HH,HD, HW/2-T/2,HH/2,0);
 mkWall(HW,HH,T,0,HH/2,-HD/2+T/2);
 const side=(HW-DOORW)/2;
 mkWall(side,HH,T,-DOORW/2-side/2,HH/2,HD/2-T/2);
 mkWall(side,HH,T, DOORW/2+side/2,HH/2,HD/2-T/2);
 // linteau au-dessus de la porte
 mkWall(DOORW,HH-2.7,T,0,2.7+(HH-2.7)/2,HD/2-T/2);
 // plancher intérieur
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(HW-T*2,HD-T*2),
   new THREE.MeshStandardMaterial({color:0x5c4632,roughness:.9}));
 floor.rotation.x=-Math.PI/2;floor.position.y=.02;floor.receiveShadow=true;g.add(floor);
 const rug=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.2),
   new THREE.MeshStandardMaterial({color:0x5a3b52,roughness:1}));
 rug.rotation.x=-Math.PI/2;rug.position.set(1.4,.04,.9);g.add(rug);
 // toit + plafond (masqués quand on est à l'intérieur)
 houseRoof=new THREE.Group();
 const roof=new THREE.Mesh(new THREE.ConeGeometry(8,3,4),
   new THREE.MeshStandardMaterial({color:0x3a2a4a,roughness:.8}));
 roof.position.y=HH+1.5;roof.rotation.y=Math.PI/4;houseRoof.add(roof);
 const ceil=new THREE.Mesh(new THREE.BoxGeometry(HW-.3,.18,HD-.3),
   new THREE.MeshStandardMaterial({color:0x2b3140,roughness:.9}));
 ceil.position.y=HH-.09;houseRoof.add(ceil);
 g.add(houseRoof);
 // porte battante + encadrement + fenêtres
 const frame=new THREE.Mesh(new THREE.BoxGeometry(DOORW+.5,.16,.3),
   new THREE.MeshStandardMaterial({color:0x4a3a2a}));frame.position.set(0,2.78,HD/2-T/2);g.add(frame);
 const hinge=new THREE.Group();hinge.position.set(-DOORW/2,0,HD/2-T/2);
 const leaf=new THREE.Mesh(new THREE.BoxGeometry(DOORW-.1,2.7,.1),
   new THREE.MeshStandardMaterial({color:0x6b4a2a,roughness:.8}));
 leaf.position.set((DOORW-.1)/2,1.35,0);hinge.add(leaf);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),
   new THREE.MeshStandardMaterial({color:0xffd166,metalness:.8,roughness:.3}));
 knob.position.set(DOORW-.35,1.35,.1);hinge.add(knob);g.add(hinge);
 houseDoor=hinge;
 [[-3.4,4.03],[3.4,4.03]].forEach(([wx,wz])=>{
  const w=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.3),
   new THREE.MeshStandardMaterial({color:0x0f1420,emissive:0x9fe8ff,emissiveIntensity:1.2}));
  w.position.set(wx,2.5,wz);g.add(w);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.5,.12),
   new THREE.MeshStandardMaterial({color:0x39415a}));
  fr.position.set(wx,2.5,wz-.05);g.add(fr);});
 [[-HW/2+.03,2.5,Math.PI/2],[-HW/2+.03,1.5,Math.PI/2]].forEach(([wx,wy,ry])=>{
  const w=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.1),
   new THREE.MeshStandardMaterial({color:0x0f1420,emissive:0x9fe8ff,emissiveIntensity:.9}));
  w.position.set(wx,wy,0);w.rotation.y=ry;g.add(w);});
 // porche + enseigne : éléments de façade, masqués quand on est dedans
 const porch=new THREE.Mesh(new THREE.BoxGeometry(4,.18,2),
   new THREE.MeshStandardMaterial({color:0x39415a}));porch.position.set(0,.1,HD/2+1);houseRoof.add(porch);
 // enseigne au-dessus de la porte, sous le débord du toit (sinon le toit la cache)
 const n=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.15),
   new THREE.MeshBasicMaterial({map:neonTex('HOME • GROW','#3ddc74'),transparent:true}));
 n.position.set(0,3.82,HD/2+.07);houseRoof.add(n);
 scene.add(g);
 // collisions : les murs bloquent, la porte laisse passer
 solid(HOME.x-HW/2+T/2,HOME.z,T,HD);
 solid(HOME.x+HW/2-T/2,HOME.z,T,HD);
 solid(HOME.x,HOME.z-HD/2+T/2,HW,T);
 solid(HOME.x-DOORW/2-side/2,HOME.z+HD/2-T/2,side,T);
 solid(HOME.x+DOORW/2+side/2,HOME.z+HD/2-T/2,side,T);
 // garage / planque (extérieur)
 const gar=new THREE.Mesh(new THREE.BoxGeometry(5,3,5),
   new THREE.MeshStandardMaterial({color:0x303a55,roughness:.8}));
 gar.position.set(9.5,1.5,-11);scene.add(gar);solid(9.5,-11,5.4,5.4);
 const safe=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.3),
   new THREE.MeshBasicMaterial({map:neonTex('PLANQUE','#ffd166'),transparent:true}));
 safe.position.set(9.5,3.4,-8.4);scene.add(safe);
}
let houseDoor=null;
buildHouse();
/* la caméra de jeu passe à l'intérieur : le toit s'ouvre et les murs s'effacent */
let houseOpen=false;
function setHouseOpen(v){
 if(v===houseOpen)return;houseOpen=v;
 if(houseRoof)houseRoof.visible=!v;
 wallMats.forEach(m=>{m.transparent=v;m.opacity=v?.1:1;m.depthWrite=!v;});
}
function isIndoors(){return Math.abs(player.pos.x-HOME.x)<HW/2-.3&&Math.abs(player.pos.z-HOME.z)<HD/2-.3;}
/* ================= CHAMBRE DE CULTURE (à l'intérieur) ================= */
const GARDEN={x:HOME.x-2.5,z:HOME.z-1.7};
const potVis=[];
/* géométries/matériaux mutualisés : reconstruits uniquement au changement de palier */
const stemGeo=new THREE.CylinderGeometry(.03,.05,1,6);
const leafGeo=new THREE.PlaneGeometry(.4,.3);
const budGeo=new THREE.IcosahedronGeometry(.16,0);
const crystGeo=new THREE.BufferGeometry().setFromPoints(
 Array.from({length:12},()=>new THREE.Vector3((Math.random()-.5)*.5,Math.random()*.4,(Math.random()-.5)*.5)));
const frailGeo=new THREE.ConeGeometry(.5,1.4,8,1,true);
const stemMats=new Map(); // couleur -> {stem,leaf,bud} réutilisés
{
 // table de culture + roll-up
 const bench=new THREE.Mesh(new THREE.BoxGeometry(4.6,.16,1.7),
   new THREE.MeshStandardMaterial({color:0x4a3a28,roughness:.8}));
 bench.position.set(GARDEN.x,.82,GARDEN.z);bench.receiveShadow=true;scene.add(bench);
 [[-2.1,-.7],[2.1,-.7],[-2.1,.7],[2.1,.7]].forEach(([dx,dz])=>{
  const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.82,.12),
   new THREE.MeshStandardMaterial({color:0x3a2e20}));leg.position.set(GARDEN.x+dx,.41,GARDEN.z+dz);scene.add(leg);});
 // étagère murale : déportée derrière la table pour ne pas masquer les pots en vue de dessus
 const shelf=new THREE.Mesh(new THREE.BoxGeometry(4.6,.1,.5),
   new THREE.MeshStandardMaterial({color:0x4a3a28,roughness:.8}));
 shelf.position.set(GARDEN.x,2.15,GARDEN.z-1.55);scene.add(shelf);
 const shelfLeg=(dx)=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.1,2.1,.1),
   new THREE.MeshStandardMaterial({color:0x3a2e20}));l.position.set(GARDEN.x+dx,1.05,GARDEN.z-1.55);scene.add(l);};
 shelfLeg(-2.2);shelfLeg(2.2);
 // bacs et sacs d'engrais sur l'étagère du fond
 for(let i=0;i<5;i++){const j=new THREE.Mesh(new THREE.BoxGeometry(.42,.55,.36),
   new THREE.MeshStandardMaterial({color:[0x2e5b7a,0x7a6b2e,0x3f7a4e][i%3],roughness:.7}));
  j.position.set(GARDEN.x-1.6+i*.8,2.48,GARDEN.z-1.55);scene.add(j);}
 // 6 pots sur la table
 for(let i=0;i<6;i++){
  const px=GARDEN.x-1.35+(i%3)*1.35, pz=GARDEN.z-.42+Math.floor(i/3)*.84;
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.34,.26,.44,12),
   new THREE.MeshStandardMaterial({color:0xb5652a,roughness:.85}));
  pot.position.set(px,1.1,pz);pot.castShadow=true;scene.add(pot);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.05,12),
   new THREE.MeshStandardMaterial({color:0x2e1d12,roughness:1}));
  soil.position.set(px,1.33,pz);scene.add(soil);
  const pl=new THREE.Group();pl.position.set(px,1.35,pz);scene.add(pl);potVis.push(pl);}
 // rampe LED au-dessus
 for(let k=0;k<2;k++){
  const bar=new THREE.Mesh(new THREE.BoxGeometry(4.2,.07,.16),
   new THREE.MeshStandardMaterial({color:0x4a5260,roughness:.35,metalness:.7}));
  bar.position.set(GARDEN.x,4.05-k*.5,GARDEN.z-.35+k*.7);scene.add(bar);
  const panel=new THREE.Mesh(new THREE.BoxGeometry(4,.04,.12),
   new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xb47bff,emissiveIntensity:1.7}));
  panel.position.set(GARDEN.x,4.0-k*.5,GARDEN.z-.35+k*.7);scene.add(panel);growLEDs.push(panel.material);
  for(let d=0;d<8;d++){const dio=new THREE.Mesh(new THREE.BoxGeometry(.3,.02,.1),
   new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xb47bff,emissiveIntensity:2.2}));
   dio.position.set(GARDEN.x-1.75+d*.5,3.98-k*.5,GARDEN.z-.35+k*.7);scene.add(dio);growLEDs.push(dio.material);}
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.15,2.2,14,1,true),
   new THREE.MeshBasicMaterial({color:0xd9a8ff,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false}));
  cone.position.set(GARDEN.x,2.6-k*.5,GARDEN.z-.35+k*.7);scene.add(cone);}
 // lumière réelle de la chambre de culture (ponctuelle, portée limitée)
 const growLightA=new THREE.PointLight(0xd9a8ff,1.9,11,1.9);
 growLightA.position.set(GARDEN.x,3.4,GARDEN.z);scene.add(growLightA);
 const growLightB=new THREE.PointLight(0xff9dc8,1.1,8,1.9);
 growLightB.position.set(GARDEN.x+1.6,1.9,GARDEN.z+1.3);scene.add(growLightB);
 roomLight=new THREE.PointLight(0xffd9a8,1.5,14,1.5);
 roomLight.position.set(HOME.x+1.6,3.5,HOME.z+.6);scene.add(roomLight);
 const entryLight=new THREE.PointLight(0xffe6c2,1.1,11,1.6);
 entryLight.position.set(HOME.x,3.2,HOME.z+2.9);scene.add(entryLight);
 growLights.push(growLightA,growLightB,entryLight);
 const strip=new THREE.Mesh(new THREE.BoxGeometry(4.4,.06,.14),
  new THREE.MeshBasicMaterial({color:0xb47bff}));
 strip.position.set(GARDEN.x,4.3,GARDEN.z);scene.add(strip);growLEDs.push(strip.material);
 // halo lumineux de la zone de culture
 const halo=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.4,2.8,18,1,true),
  new THREE.MeshBasicMaterial({color:0xb47bff,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false}));
 halo.position.set(GARDEN.x,1.8,GARDEN.z);scene.add(halo);
 // coin labo : table, écran, tabouret, bocal
 const desk=new THREE.Mesh(new THREE.BoxGeometry(2.4,.12,1.1),
  new THREE.MeshStandardMaterial({color:0x3d3428,roughness:.8}));
 desk.position.set(HOME.x+3.1,.78,HOME.z+1.1);scene.add(desk);
 [[-1,-.45],[1,-.45],[-1,.45],[1,.45]].forEach(([dx,dz])=>{
  const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.78,.1),new THREE.MeshStandardMaterial({color:0x2f2a20}));
  leg.position.set(HOME.x+3.1+dx,.39,HOME.z+1.1+dz);scene.add(leg);});
 const screen=new THREE.Mesh(new THREE.BoxGeometry(1.5,.85,.1),
  new THREE.MeshStandardMaterial({color:0x11151d,emissive:0x2fae5f,emissiveIntensity:.55}));
 screen.position.set(HOME.x+3.1,1.35,HOME.z+.72);scene.add(screen);
 const stand=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.3),new THREE.MeshStandardMaterial({color:0x22262b}));
 stand.position.set(HOME.x+3.1,.95,HOME.z+.8);scene.add(stand);
 const stool=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.1,10),
  new THREE.MeshStandardMaterial({color:0x5a3b52}));
 stool.position.set(HOME.x+3.1,.48,HOME.z+1.9);scene.add(stool);
 for(let i=0;i<4;i++){const jar=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.34,10),
   new THREE.MeshStandardMaterial({color:[0xb47bff,0x3ddc74,0xffd166,0xff6fb5][i],roughness:.4,transparent:true,opacity:.85}));
  jar.position.set(HOME.x+2.1+i*.44,1.0,HOME.z+1.15);scene.add(jar);}
 // réservoir d'eau + seau
 const tank=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,1.5,14),
  new THREE.MeshStandardMaterial({color:0x2a5f7a,roughness:.5,transparent:true,opacity:.85}));
 tank.position.set(HOME.x+4.2,.75,HOME.z-2.4);scene.add(tank);
 const bucket=new THREE.Mesh(new THREE.CylinderGeometry(.32,.26,.42,12),
  new THREE.MeshStandardMaterial({color:0x39506b,roughness:.7}));
 bucket.position.set(HOME.x+3.6,.21,HOME.z-1.4);scene.add(bucket);
 // séchoir : une barre où sèchent les lots coupés
 dryRack=new THREE.Group();dryRack.position.set(HOME.x+3.9,0,HOME.z-1.2);dryRack.rotation.y=-.35;
 {const bar=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,2.4),crateM);bar.position.y=2.35;dryRack.add(bar);
  const foot=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.9),crateM);foot.position.y=.06;dryRack.add(foot);
  for(const zz of [-1.1,1.1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,2.3,.1),crateM);
   leg.position.set(0,1.15,zz);dryRack.add(leg);}}
 dryRack.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});scene.add(dryRack);
 // marqueur au sol devant la culture
 const markRing=new THREE.Mesh(new THREE.TorusGeometry(1.1,.05,8,28),
  new THREE.MeshBasicMaterial({color:0x3ddc74,transparent:true,opacity:.35}));
 markRing.rotation.x=-Math.PI/2;markRing.position.set(GARDEN.x,.06,GARDEN.z+1.6);scene.add(markRing);
}
/* commissariat */
{
 const g=new THREE.Group();g.position.set(30,0,25);
 const b=new THREE.Mesh(new THREE.BoxGeometry(11,5,9),new THREE.MeshStandardMaterial({color:0x27324d,roughness:.8}));b.position.y=2.5;g.add(b);
 const n=new THREE.Mesh(new THREE.PlaneGeometry(8,1.8),new THREE.MeshBasicMaterial({map:neonTex('POLICE','#3a7bff'),transparent:true}));n.position.set(0,5.4,4.6);g.add(n);flickers.push(n.material);
 const flag=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.4,.05),new THREE.MeshBasicMaterial({color:0x3a7bff}));flag.position.set(-3,6,4);g.add(flag);
 scene.add(g);solid(30,25,11.4,9.4);
}
/* ---------- QUARTIERS : barrières + sols ---------- */
const bushes=[]; // déclaré ici : bush() est appelé par les quartiers ci-dessous
function barrier(x,z,w,d,label){
 const fence=new THREE.Mesh(new THREE.BoxGeometry(w,3.2,d),
  new THREE.MeshStandardMaterial({color:0x3a4150,roughness:.6,metalness:.7}));
 fence.position.set(x,1.6,z);scene.add(fence);solid(x,z,w,d);
 const warn=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(16,(w+d)*.55),1.3),
  new THREE.MeshBasicMaterial({map:neonTex(label,'#ff6fb5'),transparent:true}));
 warn.rotation.x=-Math.PI/2;warn.position.set(x,3.35,z);scene.add(warn);return warn;}
const barrierSigns=[];
// Bloc -> Marché : mur en x=78, brèche en z∈[-9,9]
barrierSigns.push(barrier(78,-40,.8,60,'MARCHÉ'));barrierSigns.push(barrier(78,40,.8,60,'MARCHÉ'));
// Bloc -> Quais : mur en z=75, brèche en x∈[-9,9]
barrierSigns.push(barrier(-45,75,72,.8,'QUAIS'));barrierSigns.push(barrier(45,75,72,.8,'QUAIS'));
// Bloc -> Cité : mur en x=-85, brèche sur l'avenue z∈[-9,9]
barrierSigns.push(barrier(-85,-40,.8,60,'CITÉ'));barrierSigns.push(barrier(-85,40,.8,60,'CITÉ'));
{const big=new THREE.Mesh(new THREE.PlaneGeometry(470,470),new THREE.MeshStandardMaterial({color:0x0c1017,roughness:1}));
 big.rotation.x=-Math.PI/2;big.position.y=-.012;scene.add(big);}
/* ============================================================
   💡 BUDGET DE LUMIÈRES
   En rendu direct, le shader de chaque matériau boucle sur
   TOUTES les lumières à chaque pixel. 38 PointLight = 38
   évaluations par fragment : c'est ce qui faisait tomber le jeu
   en mode Éco dès le démarrage. On n'en garde qu'un petit
   nombre, les plus proches du joueur ; les autres sont éteintes.
   ============================================================ */
const LIGHT_BUDGET={high:10,std:8,eco:5};
/* enregistre une lumière comme "éligible" au budget */
function budgetLight(L,dist){
 L.userData.cullDist=dist||34;
 managedLights.push(L);return L;}
/* called chaque frame : on trie par distance et on allume les N plus proches */
function lightBudgetTick(){
 const cap=LIGHT_BUDGET[qualityLevel()]||8;
 const px=player.pos.x,pz=player.pos.z;
 let n=0;
 // d'abord les lumières déjà allumées : on les réévalue
 for(const L of managedLights){
  L.getWorldPosition(_lv);
  const dx=_lv.x-px, dz=_lv.z-pz;
  const d2=dx*dx+dz*dz;
  const want=d2<L.userData.cullDist*L.userData.cullDist;
  if(want)n++;
  L.userData.d2=d2;L.userData.want=want;}
 // si on dépasse le budget, on éteint les plus lointaines
 if(n>cap){
  const act=managedLights.filter(L=>L.userData.want).sort((a,b)=>a.userData.d2-b.userData.d2);
  for(let i=cap;i<act.length;i++)act[i].userData.want=false;}
 for(const L of managedLights){
  const on=L.userData.want&&L.visible;
  if(L.userData.on!==on){L.userData.on=on;L.visible=on;}}
}
const _lv=new THREE.Vector3();

/* ============================================================
   🔍 LOD PAR DISTANCE
   2 800 maillages font moins de 60 cm (poubelles, débris, vis,
   détails de façade). Ils sont invisibles au-delà de quelques
   mètres mais coûteaun draw call chacun. On les range dans une
   liste unique et on n'affiche que ceux qui sont proches.
   ============================================================ */
const LOD_SMALL=[];      // petits objets subjectés à la distance
const _lb=new THREE.Box3(), _lv2=new THREE.Vector3();
/* collecte à froid, après la construction du monde */
function collectLOD(){
 LOD_SMALL.length=0;
 scene.traverse(o=>{
  if(!o.isMesh||!o.geometry||o.isInstancedMesh)return;
  if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
  const r=(o.geometry.boundingSphere?o.geometry.boundingSphere.radius:0)*Math.max(o.scale.x,o.scale.y,o.scale.z);
  // 0,6 m : poubelle, débris, vis, lampe, affiche. Assez petit pour être jeté au loin.
  if(r<0.6){
   const parent=o.parent;
   LOD_SMALL.push({mesh:o,ox:o.position.x,oy:o.position.y,oz:o.position.z,
    parent,px:parent.position.x,py:parent.position.y,pz:parent.position.z});}});
}
/* chaque frame : n'affiche que les petits objets à portée */
function lodTick(){
 const px=player.pos.x,pz=player.pos.z,py=player.pos.y;
 // budget selon la qualité : plus on est économe, plus on coupe loin
 const far=LOD_SMALL.length?(qualityLevel()==='eco'?12:18):0;
 for(let i=0;i<LOD_SMALL.length;i++){
  const it=LOD_SMALL[i],m=it.mesh;
  const x=it.px+it.ox, z=it.pz+it.oz;
  const dx=x-px, dz=z-pz;
  const d2=dx*dx+dz*dz;
  const want=d2<far*far;
  if(m.visible!==want)m.visible=want;}}

/* ---------- MARCHÉ ---------- */
{
 const rd=new THREE.Mesh(new THREE.PlaneGeometry(116,7),new THREE.MeshStandardMaterial({map:tex(ASPHALT_TEX,20,2),roughnessMap:roadRough,roughness:.9,metalness:.06,color:0xffffff}));
 rd.rotation.x=-Math.PI/2;rd.position.set(130,.03,0);scene.add(rd);
 for(let i=-54;i<56;i+=6){if(Math.abs(i)<5)continue;const l=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.25),lineM);l.rotation.x=-Math.PI/2;l.position.set(130+i,.05,0);scene.add(l);}
 for(let i=0;i<10;i++){const x=100+(i%5)*17,z=-42+Math.floor(i/5)*84;
  const s=new THREE.Mesh(new THREE.BoxGeometry(4,2.2,3),new THREE.MeshStandardMaterial({color:[0x6b2e3f,0x2e6b7a,0x7a6b2e,0x3f2e6b][i%4],roughness:.8}));
  s.position.set(x,1.1,z);scene.add(s);solid(x,z,4.4,3.4);
  const n=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.2),new THREE.MeshBasicMaterial({map:neonTex(['BARAT','FRUITS','POISSON','CAFÉ','ÉPICES'][i%5],'#ffd166'),transparent:true}));
  n.position.set(x,2.9,z);scene.add(n);if(i%2)flickers.push(n.material);}
 [[100,-24],[170,-20],[96,26],[172,22],[136,-50],[136,50],[116,8],[152,-40]].forEach(([x,z])=>lamp(x,z));
 /* le bâtiment MERCATO est remplacé plus bas par la halle (voir hallMarket) */
 building(168,-6,12,10,7,1);
 building(100,16,10,9,9,5,['BAR','#ffd166'],true);building(170,16,12,10,8,2);
 building(136,-28,14,10,11,0);building(136,28,14,10,10,3);
 building(112,-44,11,9,7,2);building(162,-44,11,9,8,4);
 building(112,44,11,9,9,1);building(162,44,11,9,7,5);
 building(188,-32,10,10,12,3);building(188,32,10,10,9,0);
 [[94,-32],[178,10],[128,-16],[146,18],[120,30]].forEach(([x,z])=>parkedCar(x,z,Math.PI/2,[0x7a2e3f,0x2e6b7a,0x555a30,0x4a4a55,0x6b5a2e][Math.floor(Math.random()*5)]));
 [[122,10],[152,-8],[170,40]].forEach(([x,z])=>tree(x,z,1+Math.random()*.3));
 [[100,-14],[176,26],[140,44]].forEach(([x,z])=>bush(x,z,1.3));
}
/* ---------- LE MARCHÉ VRAIMENT VIVANT ---------- */
function marketStall(x,z,ry,kind){
 const g=new THREE.Group();g.position.set(x,.14,z);g.rotation.y=ry;
 // armature
 const leg=new THREE.MeshStandardMaterial({color:0x8d949f,roughness:.55,metalness:.6});
 [[-1.5,-.8],[1.5,-.8],[-1.5,.8],[1.5,.8]].forEach(([lx,lz])=>{
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2.3,6),leg);p.position.set(lx,1.15,lz);g.add(p);});
 const top=new THREE.Mesh(new THREE.BoxGeometry(3.3,.1,1.8),
  new THREE.MeshStandardMaterial({map:tex(concreteTex(),2,1),color:0xdfe3ea,roughness:.9}));
 top.position.y=1.12;g.add(top);
 // toile rayée + guirlande d'ampoules
 const cloth=new THREE.Mesh(new THREE.BoxGeometry(3.5,.06,2),
  new THREE.MeshStandardMaterial({map:awningCloth(),color:0xffffff,roughness:.9,side:THREE.DoubleSide}));
 cloth.position.y=2.3;cloth.rotation.x=-.1;cloth.castShadow=true;g.add(cloth);
 const bulbMat=new THREE.MeshBasicMaterial({color:0xffd9a0});
 for(let i=0;i<5;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.07,6,5),bulbMat);
  b.position.set(-1.4+i*.7,2.14,.55);g.add(b);}
 // marchandises : caisses + produit
 for(let i=0;i<3;i++){const crate=new THREE.Mesh(new THREE.BoxGeometry(.85,.3,.7),crateM);
  crate.position.set(-1+ i*1,1.32,-.1);crate.rotation.y=(Math.random()-.5)*.2;g.add(crate);
  for(let k=0;k<6;k++){const it=new THREE.Mesh(new THREE.SphereGeometry(.09,6,5),
    new THREE.MeshStandardMaterial({color:GOODS[(kind+i)%GOODS.length],roughness:.65}));
   it.position.set(-1+i*1+(Math.random()-.5)*.5,1.55,-.1+(Math.random()-.5)*.35);g.add(it);}}
 // caisseEmpilée + sacs
 const back=new THREE.Mesh(new THREE.BoxGeometry(3.3,1.1,.35),crateM);
 back.position.set(0,.55,-.8);g.add(back);
 g.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 scene.add(g);solid(x,z,3.2,1.9);
 // enseigne du stand
 const label=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.5),
  new THREE.MeshBasicMaterial({map:neonTex(['FRUITS','POISSON','ÉPICES','CAFÉ','BARAT'][kind%5],'#ffd166'),transparent:true}));
 label.position.set(0,2.55,0);g.add(label);
 return g;}
function marketLife(){
 // trottoirs + bordure du marché
 const walkM=new THREE.MeshStandardMaterial({map:tex(sidewalkTex(),50,1),color:0xffffff,roughness:.94});
 [[130,-7,116,3],[130,7,116,3]].forEach(([x,z,w,d])=>{
  const s=new THREE.Mesh(new THREE.BoxGeometry(w,.14,d),walkM);s.position.set(x,.07,z);s.receiveShadow=true;scene.add(s);});
 // étals des deux côtés de l'avenue
 for(let i=0;i<8;i++){const x=102+i*17;
  marketStall(x,-9.4,0,i);
  marketStall(x+8,9.4,Math.PI,i+2);}
 // passages piétons + barrières
 for(let i=-2;i<=2;i++){const st=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.5),
  new THREE.MeshStandardMaterial({color:0xd8dce2,transparent:true,opacity:.6,roughness:1}));
  st.rotation.x=-Math.PI/2;st.position.set(122+i*1.7,.152,0);scene.add(st);}
 for(let i=0;i<14;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.9,8),metalM);
  b.position.set(86+i*7,.45,10.5);b.castShadow=true;scene.add(b);}
 // palettes et cageots
 for(let i=0;i<6;i++){const x=92+i*24,z=i%2?-13:13;
  for(let k=0;k<2;k++){const box=new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.55),crateM);
   box.position.set(x+(k*.8),.25+k*.5,z);box.rotation.y=Math.random();box.castShadow=true;scene.add(box);}}
}
/* ---------- QUAIS ---------- */
{
 /* --- l'eau : normal map procédurale + houle dans les vertices --- */
 const waterN=waterNormalTex();
 const water=new THREE.Mesh(new THREE.PlaneGeometry(190,112,60,34),waterMaterial(waterN));
 water.rotation.x=-Math.PI/2;water.position.set(0,-.5,210);  // commence pile où finit la terre
water.receiveShadow=false;water.renderOrder=-1;
 scene.add(water);WATER=water;
 const rd=new THREE.Mesh(new THREE.PlaneGeometry(7,112),new THREE.MeshStandardMaterial({map:tex(ASPHALT_TEX,2,20),roughnessMap:roadRough,roughness:.9,metalness:.06,color:0xffffff}));
 rd.rotation.x=-Math.PI/2;rd.position.set(0,.03,130);scene.add(rd);
 for(let i=-52;i<54;i+=6){if(Math.abs(i-4)<5)continue;const l=new THREE.Mesh(new THREE.PlaneGeometry(.25,2.4),lineM);l.rotation.x=-Math.PI/2;l.position.set(0,.05,130+i);scene.add(l);}
 const CN=[0x2e5b7a,0x7a3f2e,0x3f7a4e,0x6b6b2e];
 for(let i=0;i<14;i++){const x=-46+(i%7)*15,z=104+Math.floor(i/7)*48,st=1+Math.floor(Math.random()*2);
  for(let k=0;k<st;k++){const c=new THREE.Mesh(new THREE.BoxGeometry(12,5.5,5),
   new THREE.MeshStandardMaterial({color:CN[(i+k)%4],roughness:.8,metalness:.2}));
   c.position.set(x,2.8+k*5.6,z);c.castShadow=true;scene.add(c);}
  solid(x,z,12.4,5.4);}
 building(-36,122,16,12,10,3,['ENTREPÔT','#4cc3ff'],true);
 /* le bâtiment DOUANE est remplacé plus bas par la halle (voir hallDouane) */
 building(-36,162,14,10,9,5);building(36,162,14,10,10,2);
 building(0,98,18,10,8,4,['PORT','#b892ff'],true);
 [[-20,114],[20,114],[-20,150],[20,150],[0,154],[-40,96],[40,96]].forEach(([x,z])=>lamp(x,z));
 [[-22,114],[22,114],[-22,150],[22,150],[0,152]].forEach(([x,z])=>parkedCar(x,z,0,0x2e3f6b));
 [[-13,134],[13,134],[30,166]].forEach(([x,z])=>bush(x,z,1.4));
 for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.9),new THREE.MeshStandardMaterial({color:0x4a3520}));
  b.position.set(-63+i*18,.45,186);scene.add(b);solid(-63+i*18,186,1.1,1.1);}
 quayStructures();
}
/* ============================================================
   LES QUAIS : eau vivante, grue, conteneurs, bateaux, mouillages
   ============================================================ */
/* foule : clients du marché et docker (appelée à l'init) */
function quayCrowd(){
 const lane1=[],lane2=[];
 for(let i=0;i<8;i++){lane1.push([98+i*16,-5.2]);lane2.push([106+i*16,5.2]);}
 lane1.push([222,-5.2],[222,5.2]);lane2.push([222,5.2],[222,-5.2],[98,-5.2]);
 for(let i=0;i<12;i++)spawnStroller(i%2?lane1:lane2,1.2);
 for(let i=0;i<6;i++){const x=106+i*24,z=i%2?-8.2:8.2;
  const v=makePerson(SHIRTS[(i*3)%SHIRTS.length],PANTS[(i*2)%PANTS.length],SKINS[i%SKINS.length]);
  v.position.set(x,0,z);v.rotation.y=z<0?0:Math.PI;scene.add(v);
  WALKERS.push({mesh:v,along:true,side:0,dir:1,t:0,range:[0,999],spd:0,phase:i,stopT:1e9,alarm:0,idle:true});
  animIdle(v,i);}
 const path=[[-40,170],[20,166],[40,178],[0,184],[-40,176]];
 for(let i=0;i<4;i++)spawnStroller(path,1.1);}
function waterNormalTex(){
 const N=128,[c,x]=cv(N,N);
 // champ de hauteur : houle croisée -> normale par Sobel
 const H=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x2=0;x2<N;x2++){
  const u=x2/N*6.28,v=y/N*6.28;
  H[y*N+x2]=Math.sin(u*2+Math.sin(v*3)*.6)*.5+Math.sin(v*3-u*1.4)*.32+Math.sin(u*7+v*5)*.12;}
 const img=x.createImageData(N,N);
 for(let y=0;y<N;y++)for(let x2=0;x2<N;x2++){
  const l=H[y*N+((x2-1+N)%N)],r=H[y*N+((x2+1)%N)];
  const u=H[((y-1+N)%N)*N+x2],d=H[((y+1)%N)*N+x2];
  const nx=(l-r)*2.2,ny=(u-d)*2.2,nz=1;
  const len=Math.hypot(nx,ny,nz),i=(y*N+x2)*4;
  img.data[i]=((nx/len*.5+.5)*255)|0;img.data[i+1]=((ny/len*.5+.5)*255)|0;
  img.data[i+2]=((nz/len*.5+.5)*255)|0;img.data[i+3]=255;}
 x.putImageData(img,0,0);
 const t=new THREE.CanvasTexture(c);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(14,6);return t;}
function waterMaterial(n){
 const m=new THREE.MeshStandardMaterial({color:0x3f93ad,roughness:.26,metalness:.12,
  normalMap:n,normalScale:new THREE.Vector2(.8,.8),transparent:false,
  envMapIntensity:2.1,emissive:0x14384c,emissiveIntensity:.5});
 // houle : déplacement vertical des sommets dans le shader
 m.onBeforeCompile=sh=>{
  sh.uniforms.uTime={value:0};m.userData.sh=sh;
  sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',
   `#include <begin_vertex>
    float w=sin(position.x*.08+uTime*1.1)*.16+sin(position.y*.13-uTime*.9)*.12+sin((position.x+position.y)*.05+uTime*.6)*.1;
    transformed.z+=w;`);
  };
 return m;}
function waterTick(dt,now){
 if(!WATER)return;
 const sh=WATER.material.userData.sh;
 if(sh&&sh.uniforms.uTime)sh.uniforms.uTime.value=now/1000;
 const n=WATER.material.normalMap;
 if(n){n.offset.x=(now/14000)%1;n.offset.y=(now/9000)%1;}}
function quayStructures(){
 // --- quai : bordure, bollards, pneus, échelles, cordes ---
 const wood=new THREE.MeshStandardMaterial({map:tex(concreteTex(),8,2),color:0x8a7a5e,roughness:.95});
 const edge=new THREE.Mesh(new THREE.BoxGeometry(110,.5,2.2),wood);
 edge.position.set(0,.25,183);edge.receiveShadow=true;scene.add(edge);
 for(let i=0;i<9;i++){const x=-48+i*12;
  const bol=new THREE.Mesh(new THREE.CylinderGeometry(.24,.3,.75,10),metalM);
  bol.position.set(x,.95,182);bol.castShadow=true;scene.add(bol);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.26,8,6),metalM);cap.position.set(x,1.32,182);scene.add(cap);}
 for(let i=0;i<7;i++){const x=-40+i*13;
  const tyre=new THREE.Mesh(new THREE.TorusGeometry(.42,.14,6,12),new THREE.MeshStandardMaterial({color:0x14161a,roughness:.95}));
  tyre.position.set(x,.3,181.7);tyre.rotation.x=Math.PI/2;scene.add(tyre);}
 for(let i=0;i<4;i++){const x=-45+i*30;
  const lad=new THREE.Group();lad.position.set(x,0,181.6);
  for(const sx of [-.28,.28]){const r=new THREE.Mesh(new THREE.BoxGeometry(.06,1.6,.06),metalM);
   r.position.set(sx,.5,0);lad.add(r);}
  for(let i2=0;i2<4;i2++){const st=new THREE.Mesh(new THREE.BoxGeometry(.6,.05,.05),metalM);
   st.position.set(0,.2+i2*.42,0);lad.add(st);}
  scene.add(lad);}
 // écume : une bande claire là où l'eau frappe les pieux
 const foam=new THREE.Mesh(new THREE.PlaneGeometry(112,3.2),
  new THREE.MeshBasicMaterial({color:0xcfe6f0,transparent:true,opacity:.16,depthWrite:false}));
 foam.rotation.x=-Math.PI/2;foam.position.set(0,-.42,185.4);scene.add(foam);FOAM=foam;
 // --- grue portuaire ---
 const crane=new THREE.Group();crane.position.set(26,0,178);
 const legM=new THREE.MeshStandardMaterial({color:0xd8a02c,roughness:.7,metalness:.5});
 [[-2,-2],[2,-2],[-2,2],[2,2]].forEach(([lx,lz])=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.5,14,.5),legM);
  l.position.set(lx,7,lz);crane.add(l);});
 const beam=new THREE.Mesh(new THREE.BoxGeometry(4,1.2,1.2),legM);beam.position.y=14.5;crane.add(beam);
 const arm=new THREE.Mesh(new THREE.BoxGeometry(1,1,26),legM);arm.position.set(0,15.6,-6);crane.add(arm);
 const cable=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,9,5),metalM);cable.position.set(0,10,-14);crane.add(cable);
 const hook=new THREE.Mesh(new THREE.BoxGeometry(1.6,.7,1.6),metalM);hook.position.set(0,5.2,-14);crane.add(hook);
 crane.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 scene.add(crane);solid(26,178,5,5);
 // --- conteneurs : caissons, ridelles, portes ---
 const CN=[0x2e5b7a,0x7a3f2e,0x3f7a4e,0x6b6b2e,0x8a2e3f];
 for(let i=0;i<10;i++){const x=-52+i*12,z=190+(i%2)*7,h=Math.random()<.4?2:1;
  for(let k=0;k<h;k++)containerBox(x,2.8+k*2.9,z,CN[(i+k)%5]);}
 // --- bateaux amarrés ---
 [[-30,196,0x8a2f2f],[12,199,0x2f4a8a]].forEach(([x,z,col])=>boat(x,z,col));
 // --- marquages et mouillages
 for(let i=0;i<5;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.3,7,6),new THREE.MeshBasicMaterial({color:0xffffff}));
  b.position.set(-60+i*30,6+Math.sin(i)*1.5,206);b.userData.fly=true;scene.add(b);FLOCK.push(b);}}
function containerBox(x,y,z,col){
 const m=new THREE.Mesh(new THREE.BoxGeometry(12,2.8,5),
  new THREE.MeshStandardMaterial({color:col,roughness:.78,metalness:.25}));
 m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);
 // ridelles + cadre
 const rib=new THREE.MeshStandardMaterial({color:col,roughness:.7,metalness:.3});
 for(let i=-5;i<=5;i++){const r=new THREE.Mesh(new THREE.BoxGeometry(.12,2.7,5.06),rib);
  r.position.set(i*1.05,0,0);m.add(r);}
 const frame=new THREE.Mesh(new THREE.BoxGeometry(12.2,.22,5.2),
  new THREE.MeshStandardMaterial({color:0x20242c,roughness:.85}));
 frame.position.y=1.42;m.add(frame);
 solid(x,z,12.3,5.3);}
function boat(x,z,col){
 const g=new THREE.Group();g.position.set(x,-.35,z);g.rotation.y=Math.random()*3;
 const hull=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.1,9,10,1,false,0,Math.PI),
  new THREE.MeshStandardMaterial({color:col,roughness:.7,metalness:.2}));
 hull.rotation.z=Math.PI/2;hull.rotation.y=Math.PI;hull.position.y=.3;g.add(hull);
 const deck=new THREE.Mesh(new THREE.BoxGeometry(8.4,.16,2.6),
  new THREE.MeshStandardMaterial({color:0xc0a878,roughness:.9}));
 deck.position.y=.75;g.add(deck);
 const cabin=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.6,2.2),
  new THREE.MeshStandardMaterial({color:0xe8e4dc,roughness:.6}));
 cabin.position.set(2.6,1.6,0);g.add(cabin);
 const mast=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,3.4,6),metalM);
 mast.position.set(1.4,2.4,0);g.add(mast);
 for(let i=0;i<5;i++){const tyre=new THREE.Mesh(new THREE.TorusGeometry(.3,.1,6,10),
  new THREE.MeshStandardMaterial({color:0x15171b,roughness:.95}));
  tyre.position.set(-4+i*2,-.1,1.3);tyre.rotation.y=Math.PI/2;g.add(tyre);}
 g.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 scene.add(g);g.userData.bob=Math.random()*6;BOATS.push(g);}
/* animation continue : eau, bateaux, voleurs de mouillage */
function quayTick(dt,now){
 waterTick(dt,now);
 if(FOAM)FOAM.material.opacity=.12+Math.sin(now/900)*.05;
 for(const b of BOATS){b.userData.bob+=dt;
  b.position.y=-.35+Math.sin(b.userData.bob*.7)*.22;
  b.rotation.z=Math.sin(b.userData.bob*.5)*.05;
  b.rotation.x=Math.cos(b.userData.bob*.6)*.03;}
 for(let i=0;i<FLOCK.length;i++){const f=FLOCK[i];
  const t=now/2600+i;
  f.position.x=((t*9)%140)-70;f.position.z=196+Math.sin(t*.8)*8;
  f.position.y=7+Math.sin(t*1.7+i)*1.6;
  f.scale.setScalar(.5+Math.sin(t*9+i)*.25);}}
/* ============================================================
   MÉTÉO VISIBLE : le sol réagit vraiment
   · pluie : sol mouillé (rugosité basse), flaques réfléchissantes
   · neige : couverture blanche sur les toits, trottoirs et façades
   · le temps qui tourne change le rendu, pas seulement l'atmosphère
   ============================================================ */
const PUDDLES=[],SNOWCAPS=[];
function puddleTex(){
 const [c,x]=cv(128,128);
 const g=x.createRadialGradient(64,64,4,64,64,60);
 g.addColorStop(0,'rgba(150,180,200,1)');g.addColorStop(.7,'rgba(90,120,140,.85)');
 g.addColorStop(1,'rgba(60,90,110,0)');
 x.fillStyle=g;x.fillRect(0,0,128,128);
 for(let i=0;i<40;i++){x.fillStyle='rgba(255,255,255,'+(Math.random()*.18)+')';
  x.beginPath();x.arc(Math.random()*128,Math.random()*128,Math.random()*8+2,0,6.29);x.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const PUDTEX=puddleTex();
function initWeatherVisuals(){
 // flaques : sur la chaussée et les trottoirs, là où l'eau s'accumule
 const spots=[[6,9],[-18,9],[26,9],[16,-12],[16,8],[-30,6.2],[22,11.8],[16,40],[16,-40]];
 for(const [x,z] of spots){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(rnd(1.4)+1,rnd(1)+.8),
   new THREE.MeshStandardMaterial({map:PUDTEX,transparent:true,opacity:0,roughness:.04,metalness:.35,
    envMapIntensity:2.2,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(x,.17,z);m.renderOrder=2;scene.add(m);PUDDLES.push(m);}
 // plaques de neige : sur les toits (elles restent) et sur le sol (elles apparaissent)
 const roofs=[];
 scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.type==='BoxGeometry'){
  const p=o.geometry.parameters;if(p&&p.width>7&&p.height>4&&o.position.y>4)roofs.push(o);}});
 for(const r of roofs.slice(0,26)){
  const g=r.geometry.parameters;
  const m=new THREE.Mesh(new THREE.BoxGeometry(g.width*.98,.12,g.depth*.98),
   new THREE.MeshStandardMaterial({color:0xf2f6ff,roughness:.95}));
  m.position.set(r.position.x,r.position.y+g.height/2+.06,r.position.z);
  m.visible=false;scene.add(m);SNOWCAPS.push(m);}}
function weatherVisualTick(dt){
 const rain=S.weather==='rain',snow=S.weather==='snow',wet=rain||snow;
 // sol mouillé : la rugosité des chaussées et trottoirs baisse, les flaques apparaissent
 for(const m of PUDDLES){
  const target=rain?.55:(snow?.18:0);
  m.material.opacity+=(target-m.material.opacity)*Math.min(1,dt*1.2);}
 roadM.roughness=wet?.3:.92;roadM.metalness=wet?.1:.06;roadM.envMapIntensity=wet?1.9:1;
 swM.envMapIntensity=wet?1.5:1;kerbM.envMapIntensity=wet?1.5:1;
 swM.roughness=wet?.5:.94;
 kerbM.roughness=wet?.5:.9;
 // la neige s'accumule : les dalles blanchissent, les toits se couvrent
 for(const c of SNOWCAPS)c.visible=snow;
 if(wet&&!weatherVisualTick._tint){
  weatherVisualTick._tint=true;
  swM.color.setHex(wet?0xbfc9d6:0xffffff);kerbM.color.setHex(wet?0xc9d2dd:0xf0f2f6);}
 else if(!wet&&weatherVisualTick._tint){
  weatherVisualTick._tint=false;
  swM.color.setHex(0xffffff);kerbM.color.setHex(0xf0f2f6);}
 gnd.material.color.setHex(wet?0x9aa3ad:0xffffff);
 // la pluie laisse les marquages plus visibles
 paintM.opacity=wet?.9:.82;}

/* lampadaires + halos au sol */
function lamp(x,z){const g=new THREE.Group();g.position.set(x,0,z);
 const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,5.4,8),new THREE.MeshStandardMaterial({color:0x333a45}));p.position.y=2.7;g.add(p);
 const h=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshBasicMaterial({color:0xffe9b0}));h.position.y=5.4;g.add(h);
 const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xffd98a,transparent:true,opacity:.5,depthWrite:false}));halo.scale.set(4,4,1);halo.position.y=5.4;g.add(halo);lampHalos.push(halo.material);
 const pool=new THREE.Mesh(new THREE.CircleGeometry(3,18),new THREE.MeshBasicMaterial({color:0xffd98a,transparent:true,opacity:.07,depthWrite:false}));pool.rotation.x=-Math.PI/2;pool.position.y=.04;g.add(pool);lampPools.push(pool.material);scene.add(g);}
[[-20,5],[-6,13],[8,5],[24,13],[-20,30],[4,36],[28,30],[13,-2],[13,20],[19,-14],[36,5],[-34,13]].forEach(([x,z])=>lamp(x,z));
/* props : poubelles, bouches, bancs, voitures garées */
function bin(x,z){const b=new THREE.Mesh(new THREE.CylinderGeometry(.4,.34,.9,8),new THREE.MeshStandardMaterial({color:0x2e5a34}));b.position.set(x,.45,z);scene.add(b);solid(x,z,.9,.9);}
function hydrant(x,z){const g=new THREE.Group();g.position.set(x,0,z);const b=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,.6,8),new THREE.MeshStandardMaterial({color:0xb03030}));b.position.y=.3;g.add(b);scene.add(g);}
function bench(x,z,ry=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;const m=new THREE.MeshStandardMaterial({color:0x5a4028});
 const s=new THREE.Mesh(new THREE.BoxGeometry(2,.1,.5),m);s.position.y=.5;g.add(s);
 [[-.8],[.8]].forEach(([lx])=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.1,.5,.5),m);l.position.set(lx,.25,0);g.add(l);});scene.add(g);solid(x,z,2.2,1);}
function parkedCar(x,z,ry,col){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;
 const b=new THREE.Mesh(new THREE.BoxGeometry(4,1,1.9),new THREE.MeshStandardMaterial({color:col,roughness:.4,metalness:.4}));b.position.y=.75;g.add(b);
 const t=new THREE.Mesh(new THREE.BoxGeometry(2,.7,1.7),new THREE.MeshStandardMaterial({color:0x0e1526}));t.position.set(-.2,1.5,0);g.add(t);
 [[-1.3,.95],[1.3,.95],[-1.3,-.95],[1.3,-.95]].forEach(([wx,wz])=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.3,10),new THREE.MeshStandardMaterial({color:0x0a0a0a}));w.rotation.x=Math.PI/2;w.position.set(wx,.38,wz);g.add(w);});
 scene.add(g);solid(x,z,ry?2.4:4.4,ry?4.4:2.4);}
bin(-4,4.2);bin(12,13.8);bin(28,12);hydrant(6,4.4);hydrant(-12,13.6);bench(-27,20,.4);bench(-33,25,-.3);
parkedCar(-12,11.2,0,0x7a2e3f);parkedCar(27,11.2,0,0x2e6b7a);parkedCar(17.8,-4,Math.PI/2,0x4a4a55);parkedCar(-30,7.4,0,0x555a30);
/* arbres + buissons */
function tree(x,z,s=1){const t=new THREE.Group();t.position.set(x,0,z);
 const tr=new THREE.Mesh(new THREE.CylinderGeometry(.18*s,.25*s,1.6*s,7),new THREE.MeshStandardMaterial({color:0x4a3520}));tr.position.y=.8*s;t.add(tr);
 const f1=new THREE.Mesh(new THREE.ConeGeometry(1.3*s,2*s,8),new THREE.MeshStandardMaterial({color:0x1d4a26,roughness:.9}));f1.position.y=2.2*s;t.add(f1);
 const f2=new THREE.Mesh(new THREE.ConeGeometry(.95*s,1.6*s,8),new THREE.MeshStandardMaterial({color:0x256b32,roughness:.9}));f2.position.y=3.2*s;t.add(f2);scene.add(t);solid(x,z,1,1);}
function bush(x,z,r=1.25){const b=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),new THREE.MeshStandardMaterial({color:0x1e5c2a,roughness:1}));b.position.set(x,r*.7,z);b.scale.y=.8;scene.add(b);
 const b2=new THREE.Mesh(new THREE.SphereGeometry(r*.6,10,8),new THREE.MeshStandardMaterial({color:0x2a7a38,roughness:1}));b2.position.set(x+r*.5,r*.55,z+r*.3);scene.add(b2);bushes.push({x,z,r:r+.55});}
[[-36,18],[-24,28],[-30,14],[-38,28],[-20,22]].forEach(([x,z])=>tree(x,z,1+Math.random()*.4));
[[-32,20],[-26,25],[-36,25],[20,4]].forEach(([x,z])=>bush(x,z));
/* --- le parc : allées, bassin, bancs,lampadaires --- */
{
 const pathM=new THREE.MeshStandardMaterial({map:tex(concreteTex(),6,2),color:0xcfd6e2,roughness:.95});
 const path=new THREE.Mesh(new THREE.RingGeometry(4.5,7.5,28),pathM);
 path.rotation.x=-Math.PI/2;path.position.set(-30,.06,22);path.receiveShadow=true;scene.add(path);
 const path2=new THREE.Mesh(new THREE.BoxGeometry(19,1.6),pathM);path2.rotation.x=-Math.PI/2;
 path2.position.set(-30,.06,22);path2.receiveShadow=true;scene.add(path2);
 // bassin + jeton d'eau
 const basin=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.3,.55,26),
  new THREE.MeshStandardMaterial({map:tex(concreteTex(),4,1),color:0xdfe4ec,roughness:.9}));
 basin.position.set(-30,.28,22);basin.castShadow=basin.receiveShadow=true;scene.add(basin);
 const water=new THREE.Mesh(new THREE.CircleGeometry(2.85,26),
  new THREE.MeshStandardMaterial({color:0x2b6a86,roughness:.08,metalness:.35,transparent:true,opacity:.88}));
 water.rotation.x=-Math.PI/2;water.position.set(-30,.52,22);scene.add(water);
 const jet=new THREE.Mesh(new THREE.CylinderGeometry(.06,.14,1.6,8),
  new THREE.MeshStandardMaterial({color:0xcfe8f5,transparent:true,opacity:.55,roughness:.1}));
 jet.position.set(-30,1.2,22);scene.add(jet);
 solid(-30,22,6.6,6.6);
 for(let i=0;i<6;i++){const a=i/6*6.28;
  bench(-30+Math.cos(a)*5.4,22+Math.sin(a)*5.4,-a);}
 for(let i=0;i<4;i++){const a=i/4*6.28+.4;
  streetTree(-30+Math.cos(a)*9.6,22+Math.sin(a)*9.6,1.05);}}
tree(8,-20,1.2);bush(-7,-1);bush(14,1);
/* ============================================================
   MOBILIER URBAIN & RÉSEAUX : ce qui fait « rue » plutôt que « maquette »
   ============================================================ */
/* feu tricolore : mât, boîtier, trois feux qui cyclent vraiment */
const trafficSignals=[];
function trafficLight(x,z,ry){
 const g=new THREE.Group();g.position.set(x,.14,z);g.rotation.y=ry;
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,4.4,8),metalM);pole.position.y=2.2;g.add(pole);
 const arm=new THREE.Mesh(new THREE.BoxGeometry(1.5,.1,.1),metalM);arm.position.set(-.7,4.1,0);g.add(arm);
 const box=new THREE.Mesh(new THREE.BoxGeometry(.42,1.15,.34),new THREE.MeshStandardMaterial({color:0x1d222c,roughness:.8}));
 box.position.set(-1.35,3.5,0);g.add(box);
 const cols=[0xff3b30,0xffcc00,0x2fd45a];
 const lamps=cols.map((c,i)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(.13,12),
   new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.12}));
  m.position.set(-1.35,3.86-i*.36,.18);g.add(m);return m;});
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 trafficSignals.push({lamps,t:Math.random()*12,x,z,ry});
 scene.add(g);solid(x,z,.5,.5);}
[[16,6.6,Math.PI/2],[12.4,9,Math.PI],[-8.6,9,0],[16,11.4,-Math.PI/2],[-16,9,Math.PI]].forEach(([x,z,ry])=>trafficLight(x,z,ry));
/* poteaux électriques + câbles en chaînette : le détail qui « colle » la ville */
const poleXs=[-56,-44,-32,-20,-8,4,24,36,48,60];
const wirePts=[];
poleXs.forEach((x,i)=>{
 const p=new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,8.4,8),poleM);
 p.position.set(x,4.2,11.4);p.castShadow=p.receiveShadow=true;scene.add(p);
 const cross=new THREE.Mesh(new THREE.BoxGeometry(1.5,.1,.1),poleM);cross.position.set(x,7.6,11.4);scene.add(cross);
 const ins=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.18,6),new THREE.MeshStandardMaterial({color:0x2b3a4a,roughness:.5}));
 ins.position.set(x,7.78,11.4);scene.add(ins);
 if(i>0)for(const off of [-.5,0,.5]){
  const a0=poleXs[i-1]+off,b0=x+off;
  for(let k=0;k<8;k++){const t=k/8,t2=(k+1)/8;
   wirePts.push(a0+(b0-a0)*t,7.78-Math.sin(t*Math.PI)*.55,11.4,
                a0+(b0-a0)*t2,7.78-Math.sin(t2*Math.PI)*.55,11.4);}}});
scene.add(new THREE.LineSegments(new THREE.BufferGeometry()
 .setAttribute('position',new THREE.Float32BufferAttribute(wirePts,3)),wireM));
/* lampadaires : mât,bras,cône de lumière, halo — la lumière « réelle » restefake (perf) */
[[-20,7.4,Math.PI],[13.4,9,Math.PI/2],[-6,12.6,0],[30,7.4,Math.PI],[44,12.6,0]].forEach(([x,z,ry])=>{
 const g=new THREE.Group();g.position.set(x,.14,z);g.rotation.y=ry;
 const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.13,5.6,8),metalM);p.position.y=2.8;g.add(p);
 const arm=new THREE.Mesh(new THREE.BoxGeometry(1.3,.11,.11),metalM);arm.position.set(.65,5.5,0);g.add(arm);
 const head=new THREE.Mesh(new THREE.BoxGeometry(.6,.16,.3),new THREE.MeshStandardMaterial({color:0x39414f,roughness:.6}));
 head.position.set(1.25,5.42,0);g.add(head);
 const bulb=new THREE.Mesh(new THREE.CircleGeometry(.22,12),new THREE.MeshBasicMaterial({color:0xffe9b0}));
 bulb.rotation.x=Math.PI/2;bulb.position.set(1.25,5.33,0);g.add(bulb);
 const cone=new THREE.Mesh(new THREE.ConeGeometry(2.5,5.2,16,1,true),
  new THREE.MeshBasicMaterial({color:0xffe0a0,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false}));
 cone.position.set(1.25,2.6,0);g.add(cone);lampCones.push(cone.material);
 const pool=new THREE.Mesh(new THREE.CircleGeometry(2.6,18),
  new THREE.MeshBasicMaterial({color:0xffe0a0,transparent:true,opacity:.05,depthWrite:false}));
 pool.rotation.x=-Math.PI/2;pool.position.set(1.25,.01,0);g.add(pool);lampPools.push(pool.material);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 scene.add(g);});
/* arbres : tronc ramifié + feuillage en amas + racines */
function streetTree(x,z,sc=1){
 const g=new THREE.Group();g.position.set(x,.14,z);g.scale.setScalar(sc);
 const tr=new THREE.Mesh(new THREE.CylinderGeometry(.16,.3,3.4,7),barkM);tr.position.y=1.7;g.add(tr);
 for(let i=0;i<3;i++){const a=i/3*6.28+.6,r=i?1.05:0;
  const lb=new THREE.Mesh(new THREE.IcosahedronGeometry(i?1.05:1.55,0),leafM);
  lb.position.set(Math.cos(a)*r,4.2+(i?.55:0),Math.sin(a)*r);lb.scale.y=.85;g.add(lb);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 scene.add(g);solid(x,z,.6,.6);return g;}
[[-52,11.9],[-34,11.9],[-16,11.9],[26,11.9],[50,11.9],[-52,6.1],[-30,6.1],[40,6.1]]
 .forEach(([x,z],i)=>streetTree(x+(i%2?.4:-.4),z,.82+((i*7)%5)*.1));
/* mobilier : boîtes aux lettres, cabines, abribus, bacs, palettes, grilles d'aération */
const streetProps=[];
function mailbox(x,z,ry){const g=new THREE.Group();g.position.set(x,.14,z);g.rotation.y=ry;
 const b=new THREE.Mesh(new THREE.BoxGeometry(.5,1.1,.42),new THREE.MeshStandardMaterial({color:0x2e5fa8,roughness:.7,metalness:.3}));
 b.position.y=.55;b.castShadow=b.receiveShadow=true;g.add(b);
 const slot=new THREE.Mesh(new THREE.BoxGeometry(.36,.06,.05),new THREE.MeshStandardMaterial({color:0x0d1220}));
 slot.position.set(0,.86,.22);g.add(slot);
 g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);solid(x,z,.6,.6);}
[[-30,6.6],[-8,6.6],[30,6.6]].forEach(([x,z])=>mailbox(x,z,Math.PI));
function phoneBooth(x,z,ry){const g=new THREE.Group();g.position.set(x,.14,z);g.rotation.y=ry;
 const fr=new THREE.MeshStandardMaterial({color:0x2b6b4a,roughness:.6,metalness:.3});
 [[-0.5,-0.45],[0.5,-0.45],[-0.5,0.45],[0.5,0.45]].forEach(([dx,dz])=>{
  const p=new THREE.Mesh(new THREE.BoxGeometry(.1,2.3,.1),fr);p.position.set(dx,1.15,dz);g.add(p);});
 const roof=new THREE.Mesh(new THREE.BoxGeometry(1.2,.14,1.1),fr);roof.position.y=2.35;g.add(roof);
 const glass=new THREE.Mesh(new THREE.BoxGeometry(.96,2,.86),new THREE.MeshStandardMaterial({color:0x9fd8e8,transparent:true,opacity:.22,roughness:.15}));
 glass.position.y=1.2;g.add(glass);
 const ph=new THREE.Mesh(new THREE.BoxGeometry(.22,.5,.16),new THREE.MeshStandardMaterial({color:0x1b1f28}));
 ph.position.set(0,1.35,-.2);g.add(ph);
 g.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});scene.add(g);solid(x,z,1.4,1.4);}
phoneBooth(6,6.6,Math.PI);
function busStop(x,z){const g=new THREE.Group();g.position.set(x,.14,z);
 const p=new THREE.Mesh(new THREE.BoxGeometry(.12,2.6,.12),metalM);p.position.set(-1.1,1.3,0);g.add(p);
 const p2=p.clone();p2.position.x=1.1;g.add(p2);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(2.5,.1,1.3),metalM);roof.position.y=2.6;g.add(roof);
 const bench=new THREE.Mesh(new THREE.BoxGeometry(2,.09,.4),new THREE.MeshStandardMaterial({color:0x5a4028}));
 bench.position.set(0,.55,0);g.add(bench);
 const glass=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.9,.05),new THREE.MeshStandardMaterial({color:0x9fd8e8,transparent:true,opacity:.18,roughness:.15}));
 glass.position.set(0,1.6,-.6);g.add(glass);
 g.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});scene.add(g);solid(x,z,2.6,1.4);}
busStop(-14,6.6);
function dumpster(x,z,ry){const g=new THREE.Group();g.position.set(x,.14,z);g.rotation.y=ry;
 const b=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.05,.95),new THREE.MeshStandardMaterial({map:tex(concreteTex(),2,1),color:0x7fb894,roughness:.85,metalness:.25}));
 b.position.y=.53;b.castShadow=b.receiveShadow=true;g.add(b);
 const lid=new THREE.Mesh(new THREE.BoxGeometry(1.76,.08,1),new THREE.MeshStandardMaterial({color:0x2b4a34,roughness:.8}));
 lid.position.set(0,1.08,-.06);lid.rotation.x=.06;lid.castShadow=true;g.add(lid);
 for(let i=0;i<4;i++){const w=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.08,8),new THREE.MeshStandardMaterial({color:0x14161c}));
  w.rotation.z=Math.PI/2;w.position.set(-.6+i*.4,.12,.5);g.add(w);}
 g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);solid(x,z,1.9,1.2);return g;}
dumpster(-26,6.4,Math.PI/2);dumpster(38,12.2,Math.PI/2);
/* bennes, palettes et sacs dans une ruelle : le désordre crédible */
function alleyProps(x,z){const g=new THREE.Group();g.position.set(x,0,z);
 for(let i=0;i<5;i++){const w=rnd(.4,.8);
  const bx=new THREE.Mesh(new THREE.BoxGeometry(w,rnd(.5,.95),w*.9),crateM);
  bx.position.set(rnd(-1.4,1.4),w*.3,rnd(-1,1));bx.rotation.y=Math.random()*3.14;g.add(bx);}
 for(let i=0;i<3;i++){const bag=new THREE.Mesh(new THREE.SphereGeometry(.34,7,6),new THREE.MeshStandardMaterial({color:0x1b1e26,roughness:.95}));
  bag.scale.y=.8;bag.position.set(rnd(-1.6,1.6),.28,rnd(-1.2,1.2));g.add(bag);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});scene.add(g);solid(x,z,3.4,2.6);}
alleyProps(-38,-6);alleyProps(42,-14);
/* ============================================================
   🏚️ LA CITÉ — tours HLM, cours ouvertes, linge aux fenêtres
   Un quartierdense : tours hautes, balcons, et une vie de cour.
   ============================================================ */
/* une tour : barre d'étages + balcons + antenne + pylône */
function hlmTower(x,z,w,d,h,ci){
 const g=new THREE.Group();g.position.set(x,0,z);
 const ci2=ci%FACADE.length;
 const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
  new THREE.MeshStandardMaterial({map:tex(FACADE[ci2],Math.max(2,w/4),Math.max(2,h/3)),
   color:0xffffff,roughness:.94}));
 body.position.y=h/2;body.castShadow=body.receiveShadow=true;g.add(body);
 // soubassement béton
 const base=new THREE.Mesh(new THREE.BoxGeometry(w+.3,1,d+.3),
  new THREE.MeshStandardMaterial({map:tex(concreteTex(),w/3,1),color:0xe8e4dc,roughness:.96}));
 base.position.y=.5;g.add(base);
 // corniche
 const trim=new THREE.Mesh(new THREE.BoxGeometry(w+.5,.5,d+.5),
  new THREE.MeshStandardMaterial({color:0x2a2e38,roughness:.9}));
 trim.position.y=h-.4;trim.castShadow=true;g.add(trim);
 // balcons empilés sur deux faces + linge
 const balM=new THREE.MeshStandardMaterial({map:tex(concreteTex(),1,1),color:0xd8d4cc,roughness:.95});
 const railM=new THREE.MeshStandardMaterial({color:0x4a5058,roughness:.6,metalness:.5});
 for(let fy=3.4;fy<h-2;fy+=3.2){
  for(const sz of [d/2+.6,-d/2-.6]){
   const bal=new THREE.Mesh(new THREE.BoxGeometry(w*.7,.16,1.2),balM);
   bal.position.set(0,fy,sz);bal.castShadow=true;g.add(bal);
   const rail=new THREE.Mesh(new THREE.BoxGeometry(w*.7,.7,.08),railM);
   rail.position.set(0,fy+.4,sz+(sz>0?.5:-.5));g.add(rail);
   // linge qui sèche
   if(Math.random()<.5){
    const col=[0xd8d8d8,0xc8d8e8,0xe8d0c0,0xd8e0c8][(Math.random()*4)|0];
    const cl=new THREE.Mesh(new THREE.PlaneGeometry(.5,.7),
     new THREE.MeshStandardMaterial({color:col,roughness:1,side:THREE.DoubleSide}));
    cl.position.set(rnd(-w*.3,w*.3),fy+.6,sz+(sz>0?.55:-.55));g.add(cl);}
  }}
 // antennes sur le toit
 const ant=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,rnd(1.5,3),5),railM);
 ant.position.set(rnd(-w*.3,w*.3),h+1,0);g.add(ant);
 roofDetail(g,w,d,h,ci);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 scene.add(g);
 solid(x,z,w,d);
 return g;}
/* on décale les tours pour laisser passer les avenues */
[[-118,-42,16,12,20,0],[-146,-44,14,12,26,2],[-180,-40,16,12,17,1],
 [-120,44,16,12,18,3],[-152,46,14,12,24,1],[-186,42,16,12,20,2],
 [-176,-6,18,14,16,0],[-118,-8,16,14,22,3],[-186,22,16,12,19,1],
 [-124,20,14,12,15,2],[-158,18,16,12,21,0],[-190,-20,14,12,18,3]]
 .forEach(([x,z,w,d,h,ci])=>hlmTower(x,z,w,d,h,ci));
/* petites pavillons entre les tours (commerces de proximité) */
[[-130,10,'TABAC'],[-160,-24,'ÉPICERIE'],[-146,20,'LAVERIE'],[-198,-2,'PIZZA']]
 .forEach(([x,z,t],i)=>building(x,z,10,9,7,i,[t,i%2?'#ffd166':'#3ddc74'],true));
/* cours :aires de jeux, bancs, lampadaires entre les tours */
[[-140,0],[-166,-14],[-132,30],[-176,10]].forEach(([x,z])=>{
 const court=new THREE.Mesh(new THREE.PlaneGeometry(18,12),
  new THREE.MeshStandardMaterial({map:tex(concreteTex(),6,4),color:0xb8b0a0,roughness:.96}));
 court.rotation.x=-Math.PI/2;court.position.set(x,.02,z);court.receiveShadow=true;scene.add(court);
 lamp(x-6,z-4);bench(x+2,z+3);bin(x+5,z-3);
 // terrain de jeu : terrain de basket au sol
 const courtM=new THREE.Mesh(new THREE.PlaneGeometry(6,4),
  new THREE.MeshStandardMaterial({color:0x8a5a3a,roughness:.95}));
 courtM.rotation.x=-Math.PI/2;courtM.position.set(x-2,.04,z);courtM.receiveShadow=true;scene.add(courtM);
 for(const sz of [-2,2]){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,3.4,6),metalM);
  pole.position.set(x-2+sz*1.2,1.7,z);pole.castShadow=true;scene.add(pole);}});
/* lampadaires le long de l'avenue de la Cité */
[[-100,4],[-110,4],[-130,4],[-160,4],[-180,4],[-195,4],[-100,12],[-120,12],[-150,12],[-175,12],[-195,12]]
 .forEach(([x,z])=>lamp(x,z));


/* grilles d'aération et plaques de daltoff : le détail au sol */
for(let i=0;i<14;i++){const v=new THREE.Mesh(new THREE.BoxGeometry(.8,.04,.45),metalM);
 v.position.set(rnd(-60,60),.162,Math.random()<.5?6.6:11.4);v.receiveShadow=true;scene.add(v);}

/* ============================================================
   CIRCULATION & FOULE
   Les voitures roulent vraiment sur les voies, s'arrêtent au feu,
   klaxonnent ; les piétons marchent le long des trLes voitures roulent vraiment sur les voies, s'arrêtent au feu,
   klaxonnent ; les piétons marchent le long des trottoirs, entrent
   dans les boutiques et se dérobent quand il y a du bruit.
   ==
   ============================================================ */
const CARCOL=[0x8a2b34,0x2c4a7a,0xb8b2a6,0x2f2f35,0x4a5a46,0x6a4a2a,0x2b2f3a,0x7a6a2a];
const glassM=new THREE.MeshStandardMaterial({color:0x0d141f,roughness:.15,metalness:.6,transparent:true,opacity:.86});
function buildCar(col,police,kind){
 const g=new THREE.Group();
 kind=kind||(Math.random()<.22?'van':'sedan');
 const paint=new THREE.MeshStandardMaterial({color:col,roughness:.28,metalness:.62,envMapIntensity:1.4});
 const dark=new THREE.MeshStandardMaterial({color:0x0b0d12,roughness:.85,metalness:.2});
 const chrome=new THREE.MeshStandardMaterial({color:0xc9d2dd,roughness:.18,metalness:.95,envMapIntensity:1.8});
 // --- caisse : trois volumes de largeur décroissante = une vraie silhouette ---
 const L=kind==='van'?4.7:4.2, W=kind==='van'?1.95:1.82;
 const lower=new THREE.Mesh(new THREE.BoxGeometry(L,.72,W),paint);lower.position.y=.68;g.add(lower);
 const belt=new THREE.Mesh(new THREE.BoxGeometry(L*.93,.26,W*.97),paint);belt.position.y=1.1;g.add(belt);
 // pavillon : plus étroit et plus court, décalé vers l'arrière
 const roofLen=kind==='van'?2.9:2.05;
 const roof=new THREE.Mesh(new THREE.BoxGeometry(roofLen,.62,W*.86),paint);roof.position.set(kind==='van'?-.35:-.25,1.5,0);g.add(roof);
 // vitres : Pare-brise incliné, vitre arrière, portières
 const wind=new THREE.Mesh(new THREE.PlaneGeometry(W*.8,.66),glassM);
 wind.position.set((kind==='van'?-.35:-.25)+roofLen/2+.42,1.48,0);
 wind.rotation.set(0,Math.PI/2,-.36);g.add(wind);
 const rear=new THREE.Mesh(new THREE.PlaneGeometry(W*.78,.6),glassM);
 rear.position.set((kind==='van'?-.35:-.25)-roofLen/2-.34,1.46,0);
 rear.rotation.set(0,-Math.PI/2,-.34);g.add(rear);
 [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{const side=new THREE.Mesh(new THREE.PlaneGeometry(roofLen*.82,.5),glassM);
  side.position.set((kind==='van'?-.35:-.25)+sx*roofLen*.41,1.5,sz*W*.435);
  side.rotation.y=sz>0?0:Math.PI;g.add(side);});
 // capot + malle
 const hood=new THREE.Mesh(new THREE.BoxGeometry(kind==='van'?.5:L*.26,.16,W*.92),paint);
 hood.position.set(L/2-kind==='van'?.25:L*.13-.1,1.26,0);g.add(hood);
 const boot=new THREE.Mesh(new THREE.BoxGeometry(kind==='van'?.3:1.0,.16,W*.92),paint);
 boot.position.set(-L/2+.55,1.26,0);g.add(boot);
 // ailes + bas de caisse
 [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{const arch=new THREE.Mesh(new THREE.BoxGeometry(1.15,.34,.16),dark);
  arch.position.set(sx*L*.31,.78,sz*W*.47);g.add(arch);});
 const sill=new THREE.Mesh(new THREE.BoxGeometry(L*.8,.14,W*1.02),dark);sill.position.y=.44;g.add(sill);
 // pare-chocs
 [[1,-1],[-1,-1]].forEach(([sx])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.16,.26,W*1.02),chrome);
  b.position.set(sx*(L/2+.02),.6,0);g.add(b);});
 // phares (lentilles rondes) et feux arrière
 const head=new THREE.MeshBasicMaterial({color:0xfff6dc});
 const tail=new THREE.MeshBasicMaterial({color:0x771018});
 [[1],[-1]].forEach(([sz])=>{const hl=new THREE.Mesh(new THREE.SphereGeometry(.15,10,8),head);
  hl.scale.set(.5,.55,1);hl.position.set(L/2+.02,.95,sz*.58);g.add(hl);
  const tl=new THREE.Mesh(new THREE.BoxGeometry(.1,.16,.5),tail);
  tl.position.set(-L/2-.02,.95,sz*.55);g.add(tl);});
 // rétroviseurs sur pied
 [[1,1],[1,-1]].forEach(([sz])=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(.22,.05,.05),dark);
  arm.position.set(.55,1.34,sz*(W*.5+.08));g.add(arm);
  const mir=new THREE.Mesh(new THREE.BoxGeometry(.1,.13,.2),chrome);
  mir.position.set(.55,1.36,sz*(W*.5+.2));g.add(mir);});
 //Anonymous wheels with arches below
 const tyre=new THREE.MeshStandardMaterial({color:0x0b0c0f,roughness:.95});
 const rim=new THREE.MeshStandardMaterial({color:0x9aa3b0,roughness:.3,metalness:.85});
 const wheels=[];
 const wr=kind==='van'?.38:.35;
 [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{
  const wg=new THREE.Group();wg.position.set(sx*L*.31,wr,sz*(W*.46));
  const t=new THREE.Mesh(new THREE.CylinderGeometry(wr,wr,.24,14),tyre);t.rotation.x=Math.PI/2;wg.add(t);
  const r=new THREE.Mesh(new THREE.CylinderGeometry(wr*.55,wr*.55,.26,10),rim);r.rotation.x=Math.PI/2;wg.add(r);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(wr*.16,wr*.16,.28,6),chrome);hub.rotation.x=Math.PI/2;wg.add(hub);
  g.add(wg);wheels.push(wg);});
 g.userData.wheels=wheels;g.userData.head=head;g.userData.tail=tail;g.userData.kind=kind;
 if(police){ // livrée bleu/blanc + rampe de gyrophares
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(4.14,.34,1.86),
   new THREE.MeshStandardMaterial({color:0xf2f5fa,roughness:.4,metalness:.3}));stripe.position.y=.55;g.add(stripe);
  const bar1=new THREE.Mesh(new THREE.BoxGeometry(.7,.14,.3),new THREE.MeshBasicMaterial({color:0xff2222}));
  const bar2=new THREE.Mesh(new THREE.BoxGeometry(.7,.14,.3),new THREE.MeshBasicMaterial({color:0x2255ff}));
  bar1.position.set(.25,1.62,0);bar2.position.set(-.25,1.62,0);g.add(bar1,bar2);
  g.userData.lights=[bar1,bar2];}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return g;}
/* voies de circulation : on suit les axes de rue existants */
const LANES=[
 {pts:[[-70,8.1],[70,8.1]],one:true},
 {pts:[[-70,9.9],[70,9.9]],one:true},
 {pts:[[70,7.2],[-70,7.2]],one:true},
 {pts:[[70,10.8],[-70,10.8]],one:true},
 {pts:[[15.1,-70],[15.1,70]],one:true},
 {pts:[[16.9,-70],[16.9,70]],one:true},
 {pts:[[14.1,70],[14.1,-70]],one:true},
 {pts:[[17.9,70],[17.9,-70]],one:true},
 // liaison Le Bloc → La Cité, puis avenues de la Cité
 {pts:[[-70,8.1],[-206,8.1]],one:true},
 {pts:[[-70,9.9],[-206,9.9]],one:true},
 {pts:[[-206,7.2],[-70,7.2]],one:true},
 {pts:[[-206,10.8],[-70,10.8]],one:true},
 {pts:[[-151.1,-64],[-151.1,64]],one:true},
 {pts:[[-149.1,64],[-149.1,-64]],one:true},
];
const CARS=[];
function spawnTraffic(){
 for(const L of LANES){
  const n=L.one?2:0;
  for(let k=0;k<n;k++){
   const g=buildCar(CARCOL[(Math.random()*CARCOL.length)|0]);
   const dir=Math.random()<.5?1:-1;
   const c={mesh:g,lane:L,t:Math.random()*2,dir,spd:rnd(9,13),stop:false,honk:0};
   g.position.set(...lanePoint(L,c.t,dir));g.rotation.y=laneYaw(L,dir);
   scene.add(g);CARS.push(c);}}}
function lanePoint(L,t,dir){
 const a=L.pts[0],b=L.pts[1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
 let u=(t*dir/len)%1;if(u<0)u+=1;
 return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];}
function laneYaw(L,dir){const a=L.pts[0],b=L.pts[1];
 return Math.atan2(-(b[1]-a[1])*dir,(b[0]-a[0])*dir);}
/* feux : cycle rouge 8 s / vert 9 s, les voitures s'arrêtent vraiment */
function signalPhase(){
 const t=S.hour*60+S.playT%60;
 return trafficSignals.map(sg=>{
  const local=(sg.x*1.7+sg.z*.9)%60;const ph=(t+local)%17;
  return ph<8?2:(ph<9?1:0);});}
function trafficTick(dt){
 const ph=signalPhase();
 // les feux affichent l'état réel du carrefour
 for(let i=0;i<trafficSignals.length;i++){
  const lamps=trafficSignals[i].lamps,st=ph[i]; // 0 vert · 1 orange · 2 rouge
  lamps[0].material.opacity=st===0?.95:.1;
  lamps[1].material.opacity=st===1?.95:.1;
  lamps[2].material.opacity=st===2?.95:.1;}
 for(let i=0;i<CARS.length;i++){
  const c=CARS[i],L=c.lane;
  //.position de la voiture la plus proche devant : on ne passe pas « à travers »
  let blocked=false;
  for(const o of CARS){
   if(o===c)continue;
   const d=(o.mesh.position.x-c.mesh.position.x)*Math.sin(laneYaw(L,c.dir))
         +(o.mesh.position.z-c.mesh.position.z)*Math.cos(laneYaw(L,c.dir));
   if(d>0&&d<7)blocked=true;}
  // feu : arrêt si la voiture arrive au carrefour pendant le rouge
  const ahead=lanePoint(L,c.t+c.dir*.055,c.dir);
  const nearRed=trafficSignals.some(sg=>{
   const d=Math.hypot(sg.x-ahead[0],sg.z-ahead[1]);
   return d<6&&ph[trafficSignals.indexOf(sg)]===2;});
  const want=(blocked||nearRed)?0:c.spd;
  const prev=c.mesh.position.x;
  c.spd+=(want-c.spd)*Math.min(1,dt*2.2);
  c.t+=c.spd*dt/60;
  const p=lanePoint(L,c.t,c.dir);
  const prevZ=c.mesh.position.z;
  c.mesh.position.set(p[0],0,p[1]);c.mesh.rotation.y=laneYaw(L,c.dir);
  // roues qui tournent + inclinaison dans les virages (fake mais lisible)
  const yaw=c.mesh.rotation.y;
  c.mesh.userData.wheels.forEach(w=>w.rotation.x=(w.rotation.x||0)+c.spd*dt/.36);
  c.mesh.rotation.z=-Math.sin((c.mesh.position.x-prev))*0;
  // phares : allumés le soir, halos au sol
  const night=1-daylight();
  const headOn=night>.25;
  c.mesh.userData.head.color.setHex(headOn?0xfff6dc:0x5a5f66);
  c.mesh.userData.tail.color.setHex(c.spd<1?0xff2a2a:0x771018);
  if(!c.lightPool){
   const pool=new THREE.Mesh(new THREE.PlaneGeometry(6,2.4),
    new THREE.MeshBasicMaterial({color:0xffeec2,transparent:true,opacity:0,depthWrite:false}));
   pool.rotation.x=-Math.PI/2;pool.position.y=.045;c.mesh.add(pool);c.pool=pool;}
  c.pool.position.set(4.5,.045,0);c.pool.material.opacity=headOn?.16*night:0;}}
/* ---------- foule : des piétons qui ont une vie ---------- */
const WALKERS=[];
const SHIRTS=[0x3b4a6b,0x6b3b3b,0x3b6b4a,0x6b5a3b,0x4a3b6b,0x2f3b44,0x7a6a5a,0x556677,0x885544,0x446688];
const PANTS=[0x1c2230,0x2a2f3a,0x3a3026,0x22262e,0x4a4438];
const SKINS=[0xf0c9a4,0xd9a878,0xb57c50,0x8a5a34,0x5e3a22];
/* foule de quartier : on marche le long d'une polyligne (marché, quais, parc) */
function spawnStroller(path,speed){
 const g=makePerson(SHIRTS[(Math.random()*SHIRTS.length)|0],PANTS[(Math.random()*PANTS.length)|0],SKINS[(Math.random()*SKINS.length)|0]);
 const w={mesh:g,path,speed:rnd(speed*.8,speed*1.2),wi:1,along:true,side:0,dir:1,t:0,
  range:[0,999],spd:1.4,phase:Math.random()*6,stopT:rnd(0,2),alarm:0};
 g.position.set(path[0][0],0,path[0][1]);
 scene.add(g);WALKERS.push(w);return w;}
function spawnWalker(){
 const g=makePerson(SHIRTS[(Math.random()*SHIRTS.length)|0],PANTS[(Math.random()*PANTS.length)|0],SKINS[(Math.random()*SKINS.length)|0]);
 // accessoires : capuche, sac, cigarette
 const kind=(Math.random()*3)|0;
 if(kind===0){const hood=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8,0,6.29,0,1.6),
   new THREE.MeshStandardMaterial({color:g.userData.torsoMat.color,roughness:.9}));
  hood.position.set(0,1.78,-.06);hood.scale.set(1,1.05,1.1);g.add(hood);}
 if(kind===1){const bag=new THREE.Mesh(new THREE.BoxGeometry(.3,.42,.18),
   new THREE.MeshStandardMaterial({color:0x2b3340,roughness:.9}));
  bag.position.set(0,1.12,.3);g.add(bag);const st=new THREE.Mesh(new THREE.BoxGeometry(.06,.6,.05),
   new THREE.MeshStandardMaterial({color:0x1a1e26}));st.position.set(-.14,1.4,.16);st.rotation.z=.2;g.add(st);}
 if(kind===2){const cig=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.09,4),
   new THREE.MeshBasicMaterial({color:0xf2ead6}));
  cig.position.set(.24,1.5,.22);g.add(cig);g.userData.cig=cig;
  const smoke=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xcfd6e0,transparent:true,opacity:.16,depthWrite:false}));
  smoke.scale.set(.5,.5,1);smoke.position.set(.24,1.75,.22);g.add(smoke);g.userData.smoke=smoke;}
 // chemin : le long d'un trottoir, avec des allers-retours
 const side=Math.random()<.5?6.9:11.1;
 const along=Math.random()<.5;
 const dir=Math.random()<.5?1:-1;
 const range=[-64,64];
 const w={mesh:g,along,side,dir,t:Math.random()*(range[1]-range[0]),pos:g.position,
  range,spd:rnd(1.1,1.9),phase:Math.random()*6,stopT:0,alarm:0,fleeDir:0};
 scene.add(g);WALKERS.push(w);return w;}
function walkerTick(dt){
 for(const w of WALKERS){
  const cop=nearestCop();
  const d=Math.hypot(w.mesh.position.x-cop.x,w.mesh.position.z-cop.z);
  if(d<11&&(chase||S.wanted>0)){w.alarm=Math.min(1,w.alarm+dt*2);}
  else w.alarm=Math.max(0,w.alarm-dt*.7);
  if(w.alarm>.45){ // fuite : on s'écarte du flic le plus proche
   const ax=Math.atan2(w.mesh.position.z-cop.z,w.mesh.position.x-cop.x);
   w.mesh.position.x+=Math.cos(ax)*w.spd*2.1*dt*w.alarm;
   w.mesh.position.z+=Math.sin(ax)*w.spd*2.1*dt*w.alarm;
   w.mesh.rotation.y=Math.atan2(Math.cos(ax),Math.sin(ax));
   animWalk(w.mesh,performance.now()/1000,.95,13);
  }else if(w.path){ // parcours défini : clients du marché, docker, promeneurs
   if(w.stopT>0){w.stopT-=dt;animIdle(w.mesh,performance.now()/1000);}
   else{
    const wp=w.path[w.wi%w.path.length];
    const dx=wp[0]-w.mesh.position.x,dz=wp[1]-w.mesh.position.z,L=Math.hypot(dx,dz);
    if(L<.9){w.wi=(w.wi+1)%w.path.length;if(Math.random()<.35)w.stopT=rnd(1.5,5);}
    else{w.mesh.position.x+=dx/L*w.speed*dt;w.mesh.position.z+=dz/L*w.speed*dt;
     const want=Math.atan2(dx,dz);
     w.mesh.rotation.y+=Math.atan2(Math.sin(want-w.mesh.rotation.y),Math.cos(want-w.mesh.rotation.y))*.2;
     animWalk(w.mesh,performance.now()/1000+w.phase,.5,w.speed*2.1);}}
  }else{
   if(w.stopT>0){w.stopT-=dt;animIdle(w.mesh,performance.now()/1000);}
   else{
    w.t+=w.spd*dt*w.dir;
    if(w.t>w.range[1]){w.dir=-1;w.stopT=rnd(.6,2.4);}
    if(w.t<w.range[0]){w.dir=1;w.stopT=rnd(.6,2.4);}
    const px=w.along?w.t:(w.side+(w.dir>0?.5:-.5));
    const pz=w.along?(w.side+(w.dir>0?.5:-.5)):w.t;
    w.mesh.position.set(px,0,pz);
    w.mesh.rotation.y=w.along?(w.dir>0?Math.PI/2:-Math.PI/2):(w.dir>0?0:Math.PI);
    animWalk(w.mesh,performance.now()/1000+w.phase,.45,7);}
  }
  if(w.mesh.userData.smoke){ // la fumée s'élève et s'estale
   const sm=w.mesh.userData.smoke;sm.position.y=1.75+((performance.now()/900)%1)*1.1;
   sm.material.opacity=.16*(1-((performance.now()/900)%1));
   sm.scale.setScalar(.4+((performance.now()/900)%1)*.9);}
 }}

