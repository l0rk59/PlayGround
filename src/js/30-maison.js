/* ==== 30-maison.js — Maison et intérieurs (Mercato, Douane…) ==== */
/* ============ MONDE 3D ============ */
const container=$('scene');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',stencil:false});
/* rendu « réaliste » : tone mapping ACES + ombres douces + espace colorimétrique sRGB */
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.6;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
function applyQ(){renderer.setPixelRatio(S.hq?Math.min(devicePixelRatio,1.75):Math.min(1,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);setShadowQuality(S.hq);}
applyQ();renderer.setSize(innerWidth,innerHeight);
/* les réglages priment sur applyQ : on les applique dès que S existe */
queueMicrotask(()=>{try{applyOpts();}catch(e){console.warn('réglages',e);}});
container.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0e1a);scene.fog=new THREE.Fog(0x0a0e1a,40,115);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,300);
const hemi=new THREE.HemisphereLight(0x8fa8ff,0x0c1410,1.0);scene.add(hemi);
const moonL=new THREE.DirectionalLight(0xaac4ff,.7);moonL.position.set(-20,30,10);scene.add(moonL);
/* ombres : une seule lumière projetante, caméra orthographique qui suit le joueur */
moonL.castShadow=true;
moonL.shadow.mapSize.set(768,768);
const SHAD_R=22;
moonL.shadow.camera.left=-SHAD_R;moonL.shadow.camera.right=SHAD_R;
moonL.shadow.camera.top=SHAD_R;moonL.shadow.camera.bottom=-SHAD_R;
moonL.shadow.camera.near=1;moonL.shadow.camera.far=140;
moonL.shadow.bias=-.0006;moonL.shadow.normalBias=.035;
scene.add(moonL.shadow.camera);
scene.add(moonL.target);
function shadowTick(){
 // la caméra d'ombre se recale sur le joueur : ombres nettes partout dans le quartier
 const a=applySky.sx??0;
 moonL.target.position.set(player.pos.x,0,player.pos.z);
 const d=58;
 moonL.position.set(player.pos.x+Math.cos(a+.7)*d,d,player.pos.z+Math.sin(a+.7)*d);
 moonL.target.updateMatrixWorld();moonL.shadow.camera.updateProjectionMatrix();}
fill=new THREE.PointLight(0xfff0d4,.8,22,1.2);fill.position.set(0,5,-11);scene.add(fill);
const ambientFill=new THREE.HemisphereLight(0xbdd2ff,0x2a2f3a,.55);scene.add(ambientFill);
/* ============================================================
   POST-TRAITEMENT : c'est ce qui sépare « propre » de « beau ».
   · bloom sur les néons et les phares (plus fort la nuit)
   · étalonnage : contraste, saturation, ombres bleutées, vignette, grain
   · désactivé en mode Éco (le jeu doit rester fluide sur téléphone)
   ============================================================ */
const GradeShader={
 uniforms:{tDiffuse:{value:null},uVig:{value:.9},uGrain:{value:.018},uTime:{value:0},
  uNight:{value:1},uSat:{value:1.06},uCon:{value:1.02}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform sampler2D tDiffuse;uniform float uVig,uGrain,uTime,uNight,uSat,uCon;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){
  vec4 c=texture2D(tDiffuse,vUv);
  // contraste doux autour du gris moyen
  vec3 col=mix(vec3(dot(c.rgb,vec3(.299,.587,.114))),c.rgb,uSat);
  col=(col-.5)*uCon+.5;
  // ombres bleutées la nuit : c'est ce qui donne la lecture « ville de nuit »
  float lum=dot(col,vec3(.299,.587,.114));
  col=mix(col,col*vec3(.86,.93,1.1)+vec3(.0,.008,.02)*uNight,smoothstep(.4,.03,lum)*.4*uNight);
  // vignette
  vec2 q=(vUv-.5)*vec2(1.,.85);
  col*=1.-dot(q,q)*uVig;
  // grain animé (discret : casse le côté « plastique »)
  // grain discret, surtout dans les tons moyens (les noirs restent propres)
  float g=hash(vUv*vec2(1024.,768.)+fract(uTime)*97.)-.5;
  col+=g*uGrain*(.18+lum*.9);
  gl_FragColor=vec4(col,c.a);}`};
let composer=null,bloomPass=null,gradePass=null;
function buildComposer(){
 if(composer)return;
 // cible flottante + anticrénelage : sans ça, l_aliasing et le banding tuent l'image
 const dbs=renderer.getDrawingBufferSize(new THREE.Vector2());
 const rt=new THREE.WebGLRenderTarget(dbs.x,dbs.y,{type:THREE.HalfFloatType,samples:4});
 composer=new EffectComposer(renderer,rt);
 composer.addPass(new RenderPass(scene,camera));
 bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.3,.5,.92);
 composer.addPass(bloomPass);
 gradePass=new ShaderPass(GradeShader);
 composer.addPass(gradePass);
 composer.addPass(new OutputPass());
 composer.setSize(innerWidth,innerHeight);}
buildComposer();
/* le rendu final passe par la chaîne de post-traitement en HD */
function renderFrame(){
 if(!S.hq||!composer){renderer.render(scene,camera);return;}
 gradePass.uniforms.uTime.value=performance.now()/1000;
 composer.render();}
/* le bloom suit la nuit ; l'étalonnage aussi */
function gradeTick(f){
 if(!bloomPass)return;
 const night=1-daylight();
 bloomPass.strength=.14+night*.30;
 gradePass.uniforms.uNight.value=night;
 gradePass.uniforms.uVig.value=.55+night*.22;
 gradePass.uniforms.uGrain.value=.014+night*.012;}

/* cycle jour/nuit : 240s */
const SKY_N=new THREE.Color(0x080b14),SKY_D=new THREE.Color(0x9ec4e8);
let fogW=null;
const SKY_H=new THREE.Color(0x5f86bd),      // horizon de jour (brume urbaine)
      SKY_HN=new THREE.Color(0x1a2036);     // horizon de nuit
const lampHalos=[],lampPools=[],lampCones=[]; // remplis par lamp() — déclarés avant applySky()
function daylight(){const h=S.hour;const d=h<6||h>19?0:h<8?(h-6)/2:h>17?(19-h)/2:1;return Math.max(0,Math.min(1,d));}
/* --- ciel réaliste : dôme dégradé (shader) + soleil/lune + étoiles --- */
const skyU={uTop:{value:new THREE.Color(0x080b14)},uHorizon:{value:new THREE.Color(0x1a2036)},
            uSunDir:{value:new THREE.Vector3(0,1,0)},uSunCol:{value:new THREE.Color(0xffd9a0)},
            uSunSize:{value:.9995},uStars:{value:0}};
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
 uniforms:skyU,
 vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec3 vDir;uniform vec3 uTop,uHorizon,uSunCol,uSunDir;uniform float uSunSize,uStars;
 float hash(vec3 p){p=fract(p*.3183099+vec3(.71,.113,.419));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 void main(){
  float h=clamp(vDir.y*.5+.5,0.,1.);
  vec3 col=mix(uHorizon,uTop,pow(h,.62));
  // halo urbain : la ville éclaire le ciel au-dessus des toits
  col+=uHorizon*.5*pow(1.-clamp(abs(vDir.y)*3.4,0.,1.),2.2);
  // soleil / lune (disque net + diffusion)
  float d=max(dot(normalize(vDir),normalize(uSunDir)),0.);
  col+=uSunCol*(pow(d,420.)*3.2+smoothstep(uSunSize,uSunSize+.0016,d)*2.6+pow(d,7.)*.16);
  // étoiles
  if(uStars>.01){vec3 g=floor(vDir*260.);float s=hash(g);
   float tw=.55+.45*sin(s*90.+vDir.x*40.);
   col+=vec3(.85,.9,1.)*smoothstep(.9975,1.,s)*uStars*tw*(1.-smoothstep(.05,.55,vDir.y));}
  gl_FragColor=vec4(col,1.);}`});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(300,24,16),skyMat);
skyDome.frustumCulled=false;scene.add(skyDome);
function applySky(){const f=daylight();
 const hor=SKY_HN.clone().lerp(SKY_H,f);
 skyU.uTop.value.copy(SKY_N).lerp(SKY_D,f);
 skyU.uHorizon.value.copy(hor);
 skyU.uStars.value=Math.max(0,1-f*1.35);
 // azimut/élévation du soleil : la lumière et les ombres suivent la vraie heure
 const dayT=(S.hour-6)/13;                 // 6h -> lever, 19h -> coucher
 const el=Math.sin(Math.max(0,Math.min(1,dayT))*Math.PI)*1.05-.06;
 const az=dayT*Math.PI*1.6+.4;
 const up=Math.max(.06,el);
 const sx=Math.cos(az)*Math.cos(Math.PI/2-up),sz=Math.sin(az)*Math.cos(Math.PI/2-up),sy=Math.sin(up);
 skyU.uSunDir.value.set(sx,sy,sz).normalize();
 skyU.uSunCol.value.set(f>.35?0xffd9a0:0xcdd9ff);
 skyU.uSunSize.value=f>.35?.9992:.99965;
 applySky.sx=az+.7;
 scene.background.copy(SKY_N).lerp(SKY_D,f);scene.fog.color.copy(hor);
 if(fogW){scene.fog.near=fogW.fogA;scene.fog.far=fogW.fogB;}   // le port reste visible
 hemi.intensity=1.15+f*.5;hemi.color.set(f>.4?0x9fc0ff:0x6a7cc4);hemi.groundColor.set(f>.4?0x30302c:0x14161f);
 moonL.intensity=.6+f*4.2;
 moonL.color.set(f>.5?0xffe0b3:0xaac4ff);
 homeGlow.intensity=30*(1-f*.7);staGlow.intensity=40*(1-f*.7);
 lampHalos.forEach(m=>m.opacity=.5*(1-f*.75));lampPools.forEach(m=>m.opacity=.07*(1-f*.7));
 lampCones.forEach(m=>m.opacity=.055*(1-f*.7));
 publicLights.forEach((L,i)=>{L.intensity=streetLights[i][2]*(1-f*.92);});
 winLit.emissiveIntensity=.9*(1-f*.55);
 // la chambre de culture s'allume surtout la nuit : elle contraste avec la rue
 const night=1-f;
 const lit=lightOn();
 if(wasLit===true&&!lit){S.cyclesDone=(S.cyclesDone|0)+1;missionCheck();} // cycle complet
 wasLit=lit;
 growLights.forEach((L,i)=>{L.intensity=(i?2.0:3.4)*(.55+night*.75)*(lit?1:.04);});
 growLEDs.forEach(m=>{if(m.isMeshBasicMaterial)m.color.setHex(lit?0xb47bff:0x2a2136);
  else m.emissiveIntensity=(m.emissiveIntensity>2?2.2:1.7)*(lit?1:.04);});
 // le séchoir montre les lots en cours
 if(dryRack){while(dryRack.children.length>4)dryRack.remove(dryRack.children[dryRack.children.length-1]);
  S.drying.forEach((d,i)=>{if(i>=6)return;
   const h=new THREE.Mesh(new THREE.CylinderGeometry(.09,.05,.75,6),
    new THREE.MeshStandardMaterial({color:0x8a7a4a,roughness:.95}));
   h.position.set(0,1.9,(-1.05+i*.42));h.castShadow=true;dryRack.add(h);
   const lf=new THREE.Mesh(new THREE.SphereGeometry(.12,7,6),
    new THREE.MeshStandardMaterial({color:0x6f7a4a,roughness:.9}));
   lf.position.set(0,1.5,(-1.05+i*.42));dryRack.add(lf);});}
 roomLight.intensity=1.5+night*1.3;
 if(isIndoors()||hallAt()){hemi.intensity=Math.max(hemi.intensity,1.9);
  fill.intensity=1.5;}
 else fill.intensity=.55+daylight()*.5;
 const hh=Math.floor(S.hour),mm2=Math.floor((S.hour-hh)*60);
 $('clock').textContent=(f>.5?'☀️':'🌙')+' J'+S.dayN+' '+String(hh).padStart(2,'0')+':'+String(mm2).padStart(2,'0');}
const homeGlow=new THREE.PointLight(0xb47bff,30,22,1.8);homeGlow.position.set(-8,3,-10);scene.add(homeGlow);
/* budget de lumières — la déclaration doit précéder la première lampe */
const managedLights=[];
/* éclairage public : quelques sources chaudes la nuit (les cônes visuels ne sont qu'un fake) */
const streetLights=[[-20,7.4,2.1],[13.4,9,2.0],[-6,12.6,1.9],[30,7.4,2.1],[44,12.6,2.0],[-34,7.6,1.8]];
const publicLights=streetLights.map(([x,z,i])=>{const L=new THREE.PointLight(0xffcf8f,0,20,1.7);
 L.position.set(x,5.1,z);scene.add(L);return budgetLight(L,40);});
const staGlow=new THREE.PointLight(0x3a7bff,40,26,1.8);staGlow.position.set(30,4,25);scene.add(staGlow);
/* lune + skyline */
function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
{const silM=new THREE.MeshBasicMaterial({color:0x0d1424});
 for(let i=0;i<26;i++){const a=i/26*Math.PI*2;const r=100+Math.random()*20;const w=8+Math.random()*10,h=14+Math.random()*22;
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),silM);b.position.set(Math.cos(a)*r,h/2-2,Math.sin(a)*r);scene.add(b);}
 const g=new THREE.BufferGeometry();const p=new Float32Array(300*3);for(let i=0;i<300;i++){p[i*3]=(Math.random()-.5)*260;p[i*3+1]=30+Math.random()*70;p[i*3+2]=(Math.random()-.5)*260;}g.setAttribute('position',new THREE.BufferAttribute(p,3));scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:.5,transparent:true,opacity:.8})));}
/* ============================================================
   TEXTURES PROCÉDURALES « RÉALISTES »
   Grain, fissures, taches, joints, usure : rien n'est un aplat.
   ============================================================ */
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];}
function tex(canvas,rx=1,ry=1,srgb=true){
 const t=new THREE.CanvasTexture(canvas);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);
 t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 if(srgb)t.colorSpace=THREE.SRGBColorSpace;
 return t;}
const rnd=(a,b)=>a+Math.random()*(b-a);
/* matériaux partagés par tout le décor (déclarés avant les bâtiments) */
const metalM=new THREE.MeshStandardMaterial({color:0x4a4f57,roughness:.62,metalness:.55});
const frameM=new THREE.MeshStandardMaterial({color:0x1a1f2b,roughness:.85});
const poleM=new THREE.MeshStandardMaterial({color:0x4a4136,roughness:.92});
const wireM=new THREE.LineBasicMaterial({color:0x14161c,transparent:true,opacity:.85});
const barkM=new THREE.MeshStandardMaterial({color:0x3a2f26,roughness:.95});
const leafM=new THREE.MeshStandardMaterial({color:0x4d8a4a,roughness:.88,flatShading:true});
const crateM=new THREE.MeshStandardMaterial({map:tex(concreteTex(),1,1),color:0xc0a878,roughness:.95});
/* asphalte : granulat, fissures, rustines d'enrobé, traces de pneus */
function asphaltRealTex(){
 const [c,x]=cv(256,256);
 x.fillStyle='#1b1f26';x.fillRect(0,0,256,256);
 for(let i=0;i<5200;i++){const g=18+Math.random()*54;
  x.fillStyle='rgba('+(g+6)+','+(g+8)+','+(g+12)+',.5)';
  x.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*1.6,1+Math.random()*1.6);}
 // gravillons plus clairs
 for(let i=0;i<900;i++){x.fillStyle='rgba(190,195,205,'+(Math.random()*.13)+')';
  x.beginPath();x.arc(Math.random()*256,Math.random()*256,Math.random()*1.7+.4,0,6.29);x.fill();}
 // rustines d'enrobé (zones plus neuves / plus sombres)
 for(let i=0;i<7;i++){const px=Math.random()*256,py=Math.random()*256,r=rnd(18,52);
  const g=x.createRadialGradient(px,py,1,px,py,r);
  const dark=Math.random()<.5;
  g.addColorStop(0,dark?'rgba(10,12,16,.55)':'rgba(58,62,70,.5)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,6.29);x.fill();}
 // fissures
 x.lineCap='round';
 for(let i=0;i<16;i++){x.strokeStyle='rgba(8,9,12,'+rnd(.25,.6)+')';x.lineWidth=rnd(.6,1.7);
  let px=Math.random()*256,py=Math.random()*256,a=Math.random()*6.29;
  x.beginPath();x.moveTo(px,py);
  for(let k=0;k<7;k++){a+=rnd(-.7,.7);px+=Math.cos(a)*rnd(5,17);py+=Math.sin(a)*rnd(5,17);x.lineTo(px,py);}
  x.stroke();}
 // traces d'huile, gravillons remontés
 for(let i=0;i<3;i++){const px=rnd(20,236),py=rnd(20,236);
  x.fillStyle='rgba(4,5,8,.45)';x.beginPath();x.ellipse(px,py,rnd(9,22),rnd(6,16),Math.random()*3,0,6.29);x.fill();}
 return c;}
/* sol urbain : dalles de béton fatiguées, terre battue qui remonte, fissures, herbes */
function urbanTex(){
 const [c,x]=cv(256,256);
 x.fillStyle='#6f6a62';x.fillRect(0,0,256,256);
 // grandes dalles
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  const t=Math.random()*.1-.05;
  x.fillStyle='rgba('+(190+t*120|0)+','+(188+t*120|0)+','+(180+t*120|0)+',.30)';
  x.fillRect(i*64+2,j*64+2,60,60);
  x.strokeStyle='rgba(30,28,26,.5)';x.lineWidth=2;x.strokeRect(i*64,j*64,64,64);}
 // terre / gravier
 for(let i=0;i<26;i++){const px=Math.random()*256,py=Math.random()*256,r=rnd(10,44);
  const g=x.createRadialGradient(px,py,1,px,py,r);
  g.addColorStop(0,'rgba(74,60,40,.55)');g.addColorStop(1,'rgba(74,60,40,0)');
  x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,6.29);x.fill();}
 for(let i=0;i<2600;i++){const t=Math.random();
  x.fillStyle='rgba('+(110+t*90|0)+','+(104+t*84|0)+','+(94+t*76|0)+',.5)';
  x.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*2,1+Math.random()*2);}
 // fissures + herbes dans les joints
 for(let i=0;i<14;i++){x.strokeStyle='rgba(26,24,22,'+rnd(.25,.55)+')';x.lineWidth=rnd(.7,1.8);
  let px=Math.random()*256,py=Math.random()*256,a=Math.random()*6.28;
  x.beginPath();x.moveTo(px,py);
  for(let k=0;k<6;k++){a+=rnd(-.8,.8);px+=Math.cos(a)*rnd(6,20);py+=Math.sin(a)*rnd(6,20);x.lineTo(px,py);}
  x.stroke();
  for(let k=0;k<6;k++){x.strokeStyle='rgba(70,110,60,'+rnd(.2,.5)+')';x.lineWidth=1;
   x.beginPath();x.moveTo(px,py);x.lineTo(px+rnd(-3,3),py-rnd(3,8));x.stroke();}}
 // taches d'huile
 for(let i=0;i<5;i++){x.fillStyle='rgba(22,20,18,.35)';
  x.beginPath();x.ellipse(Math.random()*256,Math.random()*256,rnd(8,26),rnd(6,18),Math.random()*3,0,6.29);x.fill();}
 return c;}
/* trottoir : dalles, joints, taches, chewing-gum, bordures */
function sidewalkTex(){
 const [c,x]=cv(256,256);
 x.fillStyle='#3b4250';x.fillRect(0,0,256,256);
 for(let i=0;i<6000;i++){x.fillStyle='rgba(255,255,255,'+(Math.random()*.05)+')';x.fillRect(Math.random()*256,Math.random()*256,2,2);}
 const step=64;
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  x.fillStyle='rgba(255,255,255,'+rnd(.02,.06)+')';
  x.fillRect(i*step+1,j*step+1,step-2,step-2);
  x.strokeStyle='rgba(10,12,16,.55)';x.lineWidth=2;
  x.strokeRect(i*step,j*step,step,step);
  if(Math.random()<.35){x.fillStyle='rgba(0,0,0,'+rnd(.06,.16)+')';
   x.fillRect(i*step+2,j*step+2,step-4,step-4);}}
 for(let i=0;i<10;i++){x.fillStyle='rgba(30,34,42,'+rnd(.1,.25)+')';
  x.beginPath();x.arc(Math.random()*256,Math.random()*256,rnd(6,20),0,6.29);x.fill();}
 for(let i=0;i<7;i++){x.fillStyle='rgba(120,120,120,.3)';
  x.beginPath();x.arc(Math.random()*256,Math.random()*256,rnd(1,2.6),0,6.29);x.fill();}
 return c;}
/* brique / béton pour les façades */
function facadeTex(){
 const [c,x]=cv(256,256);
 x.fillStyle='#2a2f3d';x.fillRect(0,0,256,256);
 const bh=13,bw=30;
 for(let r=0;r*bh<256;r++){
  const off=r%2?bw/2:0;
  for(let b=-1;b*bw<256+bw;b++){
   const t=rnd(-.05,.06);
   x.fillStyle='rgb('+(74+t*120|0)+','+(80+t*120|0)+','+(94+t*120|0)+')';
   x.fillRect(b*bw+off+1,r*bh+1,bw-2,bh-2);
  }}
 for(let i=0;i<4000;i++){x.fillStyle='rgba(255,255,255,'+(Math.random()*.05)+')';x.fillRect(Math.random()*256,Math.random()*256,2,2);}
 // coulures / salissure sous les fenêtres
 for(let i=0;i<9;i++){const px=Math.random()*256;
  const g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.fillRect(px,Math.random()*180,4+Math.random()*12,60+Math.random()*90);}
 return c;}
/* béton brut (murs de Plain-pied) */
function concreteTex(){
 const [c,x]=cv(128,128);
 x.fillStyle='#39404d';x.fillRect(0,0,128,128);
 for(let i=0;i<2600;i++){x.fillStyle='rgba('+(Math.random()<.5?'255,255,255':'0,0,0')+','+(Math.random()*.09)+')';
  x.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*3,1+Math.random()*3);}
 for(let i=0;i<5;i++){x.strokeStyle='rgba(15,18,24,.4)';x.lineWidth=rnd(.6,1.4);
  x.beginPath();x.moveTo(Math.random()*128,0);x.lineTo(Math.random()*128,128);x.stroke();}
 return c;}
/* terre / talus */
function dirtTex(){
 const [c,x]=cv(128,128);
 x.fillStyle='#4a3d29';x.fillRect(0,0,128,128);
 for(let i=0;i<4200;i++){const t=Math.random();
  x.fillStyle='rgba('+(86+t*54|0)+','+(72+t*44|0)+','+(52+t*30|0)+',.7)';
  x.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*2,1+Math.random()*2);}
 for(let i=0;i<80;i++){x.fillStyle='rgba(80,110,60,'+(Math.random()*.3)+')';
  x.beginPath();x.arc(Math.random()*128,Math.random()*128,rnd(2,7),0,6.29);x.fill();}
 return c;}
/* herbe */
function grassTex(){
 const [c,x]=cv(128,128);
 x.fillStyle='#22402a';x.fillRect(0,0,128,128);
 for(let i=0;i<7000;i++){const t=Math.random();
  x.fillStyle='rgba('+(40+t*70|0)+','+(90+t*90|0)+','+(48+t*60|0)+',.6)';
  x.fillRect(Math.random()*128,Math.random()*128,1,1+Math.random()*3);}
 for(let i=0;i<200;i++){x.fillStyle='rgba(120,140,80,'+(Math.random()*.2)+')';
  x.fillRect(Math.random()*128,Math.random()*128,3+Math.random()*6,2+Math.random()*4);}
 return c;}
/* carte de rugosité : zones lisses sur l'asphalte (flaques d'huile, poli par la circulation) */
function roughPatchTex(){
 const [c,x]=cv(128,128);
 x.fillStyle='#d8d8d8';x.fillRect(0,0,128,128);
 for(let i=0;i<26;i++){const px=Math.random()*128,py=Math.random()*128,r=rnd(10,40);
  const g=x.createRadialGradient(px,py,1,px,py,r);
  g.addColorStop(0,'rgba(60,60,60,.9)');g.addColorStop(1,'rgba(216,216,216,0)');
  x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,6.29);x.fill();}
 return c;}

let WATER=null,FOAM=null;const FLOCK=[],BOATS=[];
/* --- environnement PBR (verre, métal, eau) ---
   Sans carte d'environnement un métal s'affiche NOIR : on génère une
   equirectangulaire depuis les ciel et on la passe au PMREM. */
const envCanvas=document.createElement('canvas');envCanvas.width=256;envCanvas.height=128;
const envCtx=envCanvas.getContext('2d');
const pmrem=new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
let envRT=null,envHour=-99;
function updateEnv(f){
 const x=envCtx;
 const top=[10+70*f,18+96*f,34+120*f],mid=[26+90*f,32+80*f,58+110*f];
 const g=x.createLinearGradient(0,0,0,128);
 g.addColorStop(0,'rgb('+top.map(v=>Math.min(255,v|0)).join(',')+')');
 g.addColorStop(.48,'rgb('+mid.map(v=>Math.min(255,v|0)).join(',')+')');
 g.addColorStop(.52,'rgb('+(f>.4?52:16)+','+(f>.4?50:16)+','+(f>.4?48:20)+')');
 g.addColorStop(1,'rgb('+(f>.4?74:22)+','+(f>.4?70:22)+','+(f>.4?66:26)+')');
 x.fillStyle=g;x.fillRect(0,0,256,128);
 const sx=64+Math.sin(applySky.sunAz||0)*90,sy=14;
 const sg=x.createRadialGradient(sx,sy,1,sx,sy,34);
 sg.addColorStop(0,f>.35?'rgba(255,236,200,1)':'rgba(210,225,255,.9)');
 sg.addColorStop(1,'rgba(0,0,0,0)');
 x.fillStyle=sg;x.fillRect(0,0,256,128);
 if(f<.5){for(let i=0;i<9;i++){const px=Math.random()*256,py=58+Math.random()*22;
   x.fillStyle=['rgba(61,220,116,.35)','rgba(255,209,102,.35)','rgba(255,111,181,.3)','rgba(76,195,255,.3)'][(Math.random()*4)|0];
   x.beginPath();x.arc(px,py,3+Math.random()*7,0,6.29);x.fill();}}
 const t=new THREE.CanvasTexture(envCanvas);
 t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;
 const rt=pmrem.fromEquirectangular(t);
 if(envRT)envRT.dispose();
 envRT=rt;scene.environment=rt.texture;
 if(WATER)WATER.material.envMapIntensity=2.1;
 t.dispose();}
const GOODS=[0xd8462f,0xe0a020,0x6fae3a,0xc8b070,0x8a4fb0,0xd8d0c0];
const swM=new THREE.MeshStandardMaterial({map:tex(sidewalkTex(),40,1),color:0xffffff,roughness:.94});
const kerbM=new THREE.MeshStandardMaterial({map:tex(concreteTex(),30,1),color:0xf0f2f6,roughness:.9});
const gnd=new THREE.Mesh(new THREE.PlaneGeometry(320,320),new THREE.MeshStandardMaterial({map:tex(urbanTex(),34,34),color:0xffffff,roughness:.98}));gnd.rotation.x=-Math.PI/2;
const paintM=new THREE.MeshStandardMaterial({color:0x9c8a4a,roughness:.95,transparent:true,opacity:.82});
/* sol + routes + passages piétons */
const solids=[];
const lineM=new THREE.MeshBasicMaterial({color:0xffd166});
function solid(x,z,w,d){solids.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});}
const ASPHALT_TEX=asphaltRealTex(),ASPHALT_R=roughPatchTex();
/* matériaux de chaussée (partagés par toutes les rues du jeu) */
const roadRough=tex(ASPHALT_R,7,7,false);
const roadM=new THREE.MeshStandardMaterial({map:tex(ASPHALT_TEX,26,4),roughnessMap:roadRough,roughness:.92,metalness:.06,color:0xffffff});
function asphaltTex(){const t=tex(ASPHALT_TEX,24,24);t.repeat.set(1,1);return t;}
{
scene.add(gnd);
const grass=new THREE.Mesh(new THREE.CircleGeometry(16,24),new THREE.MeshStandardMaterial({map:tex(grassTex(),8,8),color:0xffffff,roughness:1}));grass.rotation.x=-Math.PI/2;grass.position.set(-30,.02,22);scene.add(grass);
for(let i=0;i<40;i++){const f=new THREE.Mesh(new THREE.CircleGeometry(.12,6),new THREE.MeshBasicMaterial({color:[0xff6fb5,0xffd166,0xffffff][i%3]}));f.rotation.x=-Math.PI/2;const a=Math.random()*6.28,r=Math.random()*14;f.position.set(-30+Math.cos(a)*r,.04,22+Math.sin(a)*r);scene.add(f);}

const mkR=(x,z,w,d)=>{const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),roadM);r.rotation.x=-Math.PI/2;r.position.set(x,.03,z);scene.add(r);};
mkR(0,9,140,6);mkR(16,0,6,140);mkR(0,33,140,6);
for(let i=-64;i<66;i+=6){if(Math.abs(i-16)>4){const l=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.25),lineM);l.rotation.x=-Math.PI/2;l.position.set(i,.05,9);scene.add(l);}
 if(Math.abs(i-9)>4&&Math.abs(i-33)>4){const l=new THREE.Mesh(new THREE.PlaneGeometry(.25,2.4),lineM);l.rotation.x=-Math.PI/2;l.position.set(16,.05,i);scene.add(l);}}
/* trottoirs surélevés (14 cm) : c'est ce qui donne la lecture « rue » */
const walkRows=[[0,6.1,140,1.8],[0,11.9,140,1.8],[13.6,0,1.8,140],[-13.6,0,1.8,140]];
walkRows.forEach(([x,z,w,d])=>{
 const s=new THREE.Mesh(new THREE.BoxGeometry(w,.14,d),swM);s.position.set(x,.07,z);s.receiveShadow=true;scene.add(s);
 // bordure (chanfrein) côté chaussée
 const kw=w>d?w:.14,kd=w>d?.14:d;
 const k=new THREE.Mesh(new THREE.BoxGeometry(kw,.19,kd),kerbM);
 k.position.set(x+(w>d?0:-(w/2-.07)),.095,z+(d>w?0:-(d/2-.07)));k.castShadow=k.receiveShadow=true;scene.add(k);});
/* passage piéton : bandes usées, pas un rectangle parfait */
const zwM=new THREE.MeshBasicMaterial({color:0xd8dce2,transparent:true,opacity:.72});
for(let i=-2;i<=2;i++)for(let j=0;j<3;j++){
 if(Math.random()<.18)continue;
 const st=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.5),zwM);st.rotation.x=-Math.PI/2;
 st.position.set(-20+i*1.7,.152,7.4+j*1.55);scene.add(st);}
/* plaques d'égout + bouches d'égout + tampons */
for(let i=-3;i<4;i++){
 const m=new THREE.Mesh(new THREE.CircleGeometry(.42,14),metalM);m.rotation.x=-Math.PI/2;
 m.position.set(14.2,.155,-16+i*5.5);m.receiveShadow=true;scene.add(m);
 const g=new THREE.Mesh(new THREE.BoxGeometry(.9,.03,.5),metalM);
 g.position.set(-13.1,.155,-12+i*6.5);g.receiveShadow=true;scene.add(g);}
/* marquage axial usé (jaune éteint, pas un aplat parfait) */
for(let i=-64;i<66;i+=6){if(Math.abs(i-16)>4){
 const l=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.22),paintM);l.rotation.x=-Math.PI/2;l.position.set(i,.152,9.05);scene.add(l);}
 if(Math.abs(i-9)>4&&Math.abs(i-33)>4){
  const l=new THREE.Mesh(new THREE.PlaneGeometry(.22,2.4),paintM);l.rotation.x=-Math.PI/2;l.position.set(16,.152,i);scene.add(l);}}
}
/* néons */
function neonTex(txt,col){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='900 34px Arial';x.textAlign='center';x.textBaseline='middle';x.shadowColor=col;x.shadowBlur=18;x.fillStyle=col;x.fillText(txt,128,34);return new THREE.CanvasTexture(c);}
const flickers=[];
/* bâtiments variés */
const winLit=new THREE.MeshStandardMaterial({color:0x111622,emissive:0xffd98a,emissiveIntensity:.9});
const winDark=new THREE.MeshStandardMaterial({color:0x0a0e16,roughness:.6});
const BCOLS=[0x1c2333,0x20293d,0x232c44,0x1a2130,0x252e48,0x1e2739];
const FACADE=[facadeTex(),facadeTex(),concreteTex(),facadeTex(),concreteTex(),facadeTex()];
/* --- toitures : château d'eau, blocs de clims, cabane d'escalier, antennes, panneaux --- */
const rustM=new THREE.MeshStandardMaterial({color:0x8a5a3a,roughness:.9,metalness:.4});
const roofM=new THREE.MeshStandardMaterial({color:0x2b3140,roughness:.95});
function roofDetail(g,w,d,h,ci){
 const y=h+.15;
 // cabane d'escalier (accès au toit)
 const hut=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.1,2.2),roofM);
 hut.position.set(-w*.22,y+1.05,0);g.add(hut);
 const hutRoof=new THREE.Mesh(new THREE.BoxGeometry(2.7,.16,2.5),metalM);hutRoof.position.set(-w*.22,y+2.15,0);g.add(hutRoof);
 const hutDoor=new THREE.Mesh(new THREE.BoxGeometry(.9,1.8,.08),metalM);hutDoor.position.set(-w*.22,y+.9,1.12);g.add(hutDoor);
 // château d'eau sur pieds
 if(Math.random()<.55){const tank=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,1.5,12),
   new THREE.MeshStandardMaterial({map:tex(concreteTex(),2,1),color:0xb8b0a0,roughness:.9}));
  tank.position.set(w*.2,y+2.4,0);g.add(tank);
  const lid=new THREE.Mesh(new THREE.ConeGeometry(.95,.45,12),rustM);lid.position.set(w*.2,y+3.35,0);g.add(lid);
  for(let i=0;i<4;i++){const a=i/4*6.28+.6;
   const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,1.7,.1),metalM);
   leg.position.set(w*.2+Math.cos(a)*.6,y+.85,Math.sin(a)*.6);g.add(leg);}}
 // blocs de clims + gaines
 const nac=1+((w*7+d*3)%3);
 for(let i=0;i<nac;i++){const ac=new THREE.Mesh(new THREE.BoxGeometry(.9,.7,.85),
   new THREE.MeshStandardMaterial({color:0x9aa3b0,roughness:.55,metalness:.5}));
  ac.position.set(-w*.05+i*1.15,y+.35,-d*.28);g.add(ac);
  const fan=new THREE.Mesh(new THREE.TorusGeometry(.22,.05,6,12),metalM);
  fan.position.set(-w*.05+i*1.15,y+.35,-d*.28+.44);g.add(fan);}
 // antennes + parabolicques
 if(h>7){for(let i=0;i<2;i++){const a=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,rnd2a(1.6)+1.2,5),metalM);
   a.position.set(w*.3+i*.5,y+1.2,rnd2a(d*.2));g.add(a);}
  if(Math.random()<.5){const dish=new THREE.Mesh(new THREE.SphereGeometry(.42,10,8,0,6.28,0,1.1),
   new THREE.MeshStandardMaterial({color:0xd8dce4,roughness:.5,metalness:.3,side:THREE.DoubleSide}));
   dish.position.set(-w*.34,y+.9,d*.2);dish.rotation.set(1.1,.6,0);g.add(dish);}}
 // panneau publicitaire sur quelques toits
 if(Math.random()<.28){const pan=new THREE.Mesh(new THREE.PlaneGeometry(5,2.4),
   new THREE.MeshStandardMaterial({map:tex(concreteTex(),1,1),color:0x39404d,roughness:.9,side:THREE.DoubleSide}));
  pan.position.set(0,y+1.6,-d*.36);pan.rotation.x=-.12;g.add(pan);
  for(const sx of [-2,2]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,1.6,.1),metalM);
   leg.position.set(sx,y+.8,-d*.36);g.add(leg);}}
 g.traverse(o=>{if(o.isMesh&&o.position.y>y-.3){o.castShadow=true;o.receiveShadow=true;}});}
function rnd2a(a){return (Math.random()-.5)*2*a;}
/* --- escalier de secours --- */
function fireEscape(g,w,h,d){
 const iron=new THREE.MeshStandardMaterial({color:0x3a4152,roughness:.75,metalness:.55});
 const x=-w/2-.5;
 for(let fy=3.4;fy<h-1;fy+=3.2){
  const plat=new THREE.Mesh(new THREE.BoxGeometry(1.5,.1,1.2),iron);plat.position.set(x+.75,fy,d/2+.6);g.add(plat);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(1.5,.75,.06),iron);rail.position.set(x+.75,fy+.4,d/2+1.16);g.add(rail);}
 const lad=new THREE.Mesh(new THREE.BoxGeometry(.7,Math.max(2,h-2.4),.08),iron);
 lad.position.set(x+.75,h/2,d/2+1.16);lad.rotation.z=.06;g.add(lad);}
/* --- affiches et tags sur les murs --- */
function wallDecals(x,z,ry,w,h){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;
 const n=1+Math.floor(Math.random()*2);
 for(let i=0;i<n;i++){
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(rnd2a(.7)+.7,rnd2a(.9)+1),
   new THREE.MeshBasicMaterial({map:posterTex(),transparent:true,opacity:.85,depthWrite:false}));
  pl.position.set(rnd2a(w*.3),rnd2a(2.6)+.9,dIn(ry));g.add(pl);}
 scene.add(g);}
function dIn(ry){return Math.abs(Math.sin(ry))>.5?.02:.02;}
function posterTex(){
 const c=document.createElement('canvas');c.width=128;c.height=160;
 const x=c.getContext('2d');
 x.fillStyle=['#c8352b','#2b6bc8','#d8b021','#2fae5f','#8a2b8f'][Math.floor(Math.random()*5)];
 x.fillRect(0,0,128,160);
 x.fillStyle='rgba(255,255,255,.82)';
 for(let i=0;i<7;i++)x.fillRect(10+Math.random()*30,14+i*20,60+Math.random()*50,4+Math.random()*6);
 x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,150,128,10);
 for(let i=0;i<400;i++){x.fillStyle='rgba(0,0,0,'+(Math.random()*.18)+')';
  x.fillRect(Math.random()*128,Math.random()*160,2,2);}
 return new THREE.CanvasTexture(c);}
let awningTex=null;
function awningCloth(){
 if(awningTex)return awningTex;
 const [c,x]=cv(128,64);
 for(let i=0;i<8;i++){x.fillStyle=i%2?'#f2ede0':'#8a2e3f';x.fillRect(i*16,0,16,64);}
 for(let i=0;i<600;i++){x.fillStyle='rgba(0,0,0,'+(Math.random()*.06)+')';x.fillRect(Math.random()*128,Math.random()*64,2,2);}
 awningTex=tex(c,1,1);return awningTex;}
function building(x,z,w,d,h,ci,neon,shop=false){
 const g=new THREE.Group();g.position.set(x,0,z);
 const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({map:tex(FACADE[ci%FACADE.length],Math.max(2,w/4),Math.max(2,h/3)),color:0xffffff,roughness:.92}));b.position.y=h/2;b.castShadow=b.receiveShadow=true;g.add(b);
 // soubassement + bandeau de corniche : la façade n'est plus un simple cube
 const base=new THREE.Mesh(new THREE.BoxGeometry(w+.22,.9,d+.22),new THREE.MeshStandardMaterial({map:tex(concreteTex(),w/3,1),color:0xf2f4f8,roughness:.95}));base.position.y=.45;base.castShadow=base.receiveShadow=true;g.add(base);
 const trim=new THREE.Mesh(new THREE.BoxGeometry(w+.34,.42,d+.34),new THREE.MeshStandardMaterial({color:0x1b2130,roughness:.9}));trim.position.y=h-.5;trim.castShadow=true;g.add(trim);
 // joints d'étage horizontaux
 for(let fy=3.8;fy<h-1;fy+=3.8){const bnd=new THREE.Mesh(new THREE.BoxGeometry(w+.06,.12,d+.06),new THREE.MeshStandardMaterial({color:0x151a26,roughness:.95}));bnd.position.y=fy;g.add(bnd);}
 const edge=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.3,d+.3),new THREE.MeshStandardMaterial({color:0x0c1220}));edge.position.y=h;g.add(edge);
 roofDetail(g,w,d,h,ci);
 // escalier de secours en fer forgé (une façade sur deux)
 if(Math.random()<.5)fireEscape(g,w,h,d);
 // entrée : porte en retrait, marches, auvent, platine d'interphone
 const entry=new THREE.Group();entry.position.set(w>0?-w*.28:w*.28,0,d/2+.02);
 const door2=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.5,.16),
  new THREE.MeshStandardMaterial({color:[0x2b3345,0x3a2f28,0x1f3b34][ci%3],roughness:.6,metalness:.2}));
 door2.position.set(0,1.25,-.06);entry.add(door2);
 const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.3,.12,.9),metalM);canopy.position.set(0,2.9,.4);entry.add(canopy);
 for(let i=0;i<2;i++){const st=new THREE.Mesh(new THREE.BoxGeometry(1.7-i*.2,.13,.5-i*.1),
  new THREE.MeshStandardMaterial({map:tex(concreteTex(),1,1),color:0xdfe3ea,roughness:.95}));
  st.position.set(0,.07+i*.13,.25+i*.18);entry.add(st);}
 const buzz=new THREE.Mesh(new THREE.BoxGeometry(.16,.3,.04),metalM);buzz.position.set(.95,1.4,.06);entry.add(buzz);
 entry.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});g.add(entry);
 // devanture de commerce : vitrine sombre + chevalet
 if(shop){
  const glass=new THREE.Mesh(new THREE.BoxGeometry(Math.min(5.5,w-2),2,.1),
   new THREE.MeshStandardMaterial({color:0x0d1620,roughness:.12,metalness:.5}));
  glass.position.set(w*.12,1.5,d/2+.06);g.add(glass);
  const board=new THREE.Mesh(new THREE.BoxGeometry(.8,1.1,.06),
   new THREE.MeshStandardMaterial({map:tex(concreteTex(),1,1),color:0x2a2f3a,roughness:.9}));
  board.position.set(-w*.28,.55,d/2+.6);board.rotation.x=-.2;g.add(board);}
 for(let fy=1.5;fy<h-.6;fy+=1.9)for(let ix=-w/2+1;ix<w/2-.5;ix+=2){
 /* une seule maille par fenêtre (allumée ou non) : le détail est dans la texture */
 const win=new THREE.Mesh(new THREE.PlaneGeometry(.86,1.06),Math.random()<.45?winLit:winDark);
 win.position.set(ix,fy,d/2+.03);g.add(win);}
 if(shop){const awn=new THREE.Mesh(new THREE.BoxGeometry(Math.min(7,w-1),.12,1.7),
   new THREE.MeshStandardMaterial({map:awningCloth(),color:0xffffff,roughness:.85,side:THREE.DoubleSide}));
  awn.position.set(0,2.9,d/2+.85);awn.rotation.x=-.12;awn.castShadow=true;g.add(awn);
  for(const sx of [-1,1]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,1.7),metalM);
   arm.position.set(sx*(Math.min(7,w-1)/2-.2),2.85,d/2+.85);arm.rotation.x=-.12;g.add(arm);}
  const door=new THREE.Mesh(new THREE.PlaneGeometry(1.6,2.4),new THREE.MeshStandardMaterial({color:0x0a0d14}));door.position.set(0,1.2,d/2+.02);g.add(door);}
 if(neon){const n=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(8,w),1.8),new THREE.MeshBasicMaterial({map:neonTex(neon[0],neon[1]),transparent:true}));n.position.set(0,Math.min(h-1,4.2),d/2+.12);g.add(n);if(Math.random()<.5)flickers.push(n.material);}
 scene.add(g);solid(x,z,w+.4,d+.4);return g;}
building(-22,-8,12,10,7,0,['PIZZA','#ff6fb5'],true);building(24,-10,14,10,9,1,['HOTEL','#4cc3ff'],true);
building(-24,24,12,8,6,2,['BAR','#ffd166'],true);building(34,8,10,8,8,3);
building(-8,-26,10,8,6,4);building(12,-26,12,9,10,5,['SHOP','#3ddc74'],true);
building(44,24,10,10,7,0);building(-44,2,10,12,8,1);building(44,-24,12,10,9,2);
/* affichage sauvage : tags et affiches collés aux murs */
[[-28,-2.9,0],[-15.9,16,Math.PI/2],[28,-4.8,Math.PI],[9.9,28.4,Math.PI],[36.6,-15,Math.PI/2],[-46,8,0]]
 .forEach(([x,z,ry])=>wallDecals(x,z,ry,6,4));
/* dalles de béton devant les commerces + bacs à fleurs sur les trottoirs */
[[-22,-2.6,10,2],[24,-4.6,12,2],[12,-20.6,10,2]].forEach(([x,z,w,d])=>{
 const slab=new THREE.Mesh(new THREE.BoxGeometry(w,.13,d),
  new THREE.MeshStandardMaterial({map:tex(concreteTex(),w/3,1),color:0xe8ecf2,roughness:.95}));
 slab.position.set(x,.065,z);slab.receiveShadow=true;scene.add(slab);});
building(-46,-24,10,10,11,3);building(8,48,14,10,8,4,['CLUB','#b892ff'],true);building(-30,48,12,10,7,5);
