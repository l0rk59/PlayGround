import * as THREE from 'three';

/* =========================================================================
   PACIFIC FRONTLINE '44 — fan-tribute arcade FPS
   WWII Pacific (WaW-inspired) setting + anachronistic BO2-style prototypes.
   100% original procedural assets. No ripped models, sounds, names, or IP.
   ========================================================================= */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* ---------------- Weapons: BO2-style prototypes (fictional names) -------- */
const WEAPONS = [
  { id:'type25', name:'TYPE-25 “JUNGLE”', tag:'BO2-style full-auto AR', desc:'Versatile assault prototype. Steady, forgiving, 30-round mag.',
    dmg:26, headMult:2, rpm:800, mag:30, reserve:180, maxReserve:300, reload:2.0, spread:0.016, adsSpread:0.004,
    range:90, auto:true, kick:0.011, zoom:55, pellets:1, color:0x4a4438, len:0.78, sound:'rifle' },
  { id:'msmc', name:'MSMC “HORNET”', tag:'BO2-style SMG', desc:'Buzzsaw SMG. 950 RPM shredder up close, hungry for ammo.',
    dmg:22, headMult:1.8, rpm:950, mag:32, reserve:192, maxReserve:320, reload:2.2, spread:0.026, adsSpread:0.010,
    range:55, auto:true, kick:0.013, zoom:58, pellets:1, color:0x2e2e33, len:0.62, sound:'smg' },
  { id:'r870', name:'R870 “BREACHER”', tag:'BO2-style pump shotgun', desc:'8-pellet pump. Deletes anything inside 10 meters.',
    dmg:13, headMult:1.6, rpm:75, mag:6, reserve:36, maxReserve:60, reload:2.8, spread:0.055, adsSpread:0.045,
    range:28, auto:false, kick:0.055, zoom:60, pellets:8, color:0x5a3b22, len:0.72, sound:'shotgun' },
  { id:'dsr', name:'DSR “LONGSHOT”', tag:'BO2-style bolt sniper', desc:'Bolt-action thunder. One shot, one kill. Scoped ADS.',
    dmg:150, headMult:2.5, rpm:42, mag:5, reserve:25, maxReserve:40, reload:3.1, spread:0.02, adsSpread:0.0006,
    range:220, auto:false, kick:0.05, zoom:18, pellets:1, scoped:true, color:0x3a4030, len:0.95, sound:'sniper' },
];
const SIDEARM = { id:'b23r', name:'B23-R “JACKAL”', tag:'BO2-style burst pistol', desc:'3-round burst sidearm. Always in slot 2.',
  dmg:20, headMult:1.8, rpm:600, burst:3, mag:15, reserve:90, maxReserve:150, reload:1.6, spread:0.014, adsSpread:0.005,
  range:60, auto:false, kick:0.014, zoom:60, pellets:1, color:0x333333, len:0.4, sound:'pistol' };
const LAUNCHER = { id:'rpg', name:'RPG “SLAYER”', tag:'BO2-style launcher', desc:'Unlocks at wave 3. Splash damage. Watch the backblast (your own feet).',
  dmg:210, headMult:1, rpm:50, mag:1, reserve:3, maxReserve:6, reload:3.0, spread:0.008, adsSpread:0.004,
  range:120, auto:false, kick:0.08, zoom:60, pellets:1, explosive:true, color:0x4d5c2a, len:0.9, sound:'launcher' };

const TOTAL_WAVES = 8;

/* ---------------- Global state ------------------------------------------- */
const G = {
  started:false, paused:false, over:false, win:false,
  scene:null, camera:null, renderer:null, clock:null,
  player:{ pos:new THREE.Vector3(0,1.65,26), yaw:0, pitch:0, hp:100, lastHurt:-99,
    vel:new THREE.Vector3(), onGround:true, vy:0, sprinting:false, ads:0, adsOn:false, dead:false },
  loadout:{ primary:'type25' },
  guns:[], slot:0, // 0 primary, 1 sidearm, 2 launcher
  gunState:null, switching:0, reloadT:0, fireCd:0, triggerHeld:false, triggerEdge:false, burstLeft:0, burstCd:0,
  enemies:[], pickups:[], tracers:[], parts:[], shells:[], projectiles:[],
  solids:[], solidMeshes:[], spawnPoints:[],
  wave:0, waveState:'idle', waveDelay:0, toSpawn:0, spawnT:0, aliveCount:0,
  score:0, kills:0, headshots:0, shots:0, hits:0, startTime:0,
  sens:1.1, quality:'auto', sound:true, shake:0, crossGap:7,
  best: JSON.parse(localStorage.getItem('pf44_best')||'null'),
  muzzleLight:null, muzzleFlash:null, time:0,
  keys:{}, joy:{x:0,y:0,on:false}, lookDX:0, lookDY:0,
};
G.gunState = null;

function freshGunState(w){ return { def:w, mag:w.mag, reserve:w.reserve }; }
function resetGuns(){
  const p = WEAPONS.find(w=>w.id===G.loadout.primary) || WEAPONS[0];
  G.guns = [ freshGunState(p), freshGunState({...SIDEARM}), freshGunState({...LAUNCHER, reserve:0}) ];
  G.guns[2].locked = true;
  G.slot = 0; G.reloadT=0; G.fireCd=0; G.switching=0;
}
function curGun(){ return G.guns[G.slot]; }

/* ---------------- Procedural audio (no external files) -------------------- */
let AC=null, masterGain=null, noiseBuf=null;
function audioInit(){
  if (AC) return;
  try{
    AC = new (window.AudioContext||window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = 0.5; masterGain.connect(AC.destination);
    const len = AC.sampleRate * 1.2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    noiseBuf = buf;
  }catch(e){ AC=null; }
}
function env(g, t0, a, peak, dec){
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0+a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+a+dec);
}
function playShot(kind){
  if (!AC || !G.sound) return;
  const t0 = AC.currentTime;
  const o = AC.createBufferSource(); o.buffer = noiseBuf;
  const f = AC.createBiquadFilter();
  const g = AC.createGain();
  let dur=0.16, freq=1800, peak=0.9;
  if (kind==='smg'){ dur=0.11; freq=2400; peak=0.7; }
  if (kind==='shotgun'){ dur=0.35; freq=900; peak=1.0; }
  if (kind==='sniper'){ dur=0.4; freq=3200; peak=1.0; }
  if (kind==='pistol'){ dur=0.12; freq=2000; peak=0.7; }
  if (kind==='launcher'){ dur=0.7; freq=500; peak=1.0; }
  f.type='lowpass'; f.frequency.setValueAtTime(freq*2.2, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(120,freq*0.25), t0+dur);
  env(g, t0, 0.004, peak, dur);
  o.connect(f); f.connect(g); g.connect(masterGain);
  o.start(t0, Math.random()*0.4, dur+0.1);
  const osc = AC.createOscillator(), og = AC.createGain();
  osc.type='square'; const base = kind==='shotgun'?110:kind==='sniper'?220:kind==='launcher'?70:160;
  osc.frequency.setValueAtTime(base*1.6, t0);
  osc.frequency.exponentialRampToValueAtTime(base*0.5, t0+0.08);
  env(og, t0, 0.002, peak*0.5, 0.08);
  osc.connect(og); og.connect(masterGain); osc.start(t0); osc.stop(t0+0.12);
}
function playNoise(dur, freq, peak, type='lowpass'){
  if (!AC || !G.sound) return;
  const t0=AC.currentTime, o=AC.createBufferSource(); o.buffer=noiseBuf;
  const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq;
  const g=AC.createGain(); env(g,t0,0.005,peak,dur);
  o.connect(f); f.connect(g); g.connect(masterGain); o.start(t0, Math.random()*0.5, dur+0.1);
}
const sfx = {
  reload(){ playNoise(0.25, 3000, 0.35, 'bandpass'); setTimeout(()=>playNoise(0.2,2000,0.4,'bandpass'),180); },
  empty(){ playNoise(0.06, 4000, 0.3, 'highpass'); },
  hitmark(){ playNoise(0.05, 5000, 0.25, 'highpass'); },
  headshot(){ playNoise(0.09, 6500, 0.4, 'highpass'); },
  hurt(){ playNoise(0.25, 400, 0.7); },
  explosion(){ playNoise(0.9, 220, 1.0); playNoise(0.5, 3000, 0.4, 'highpass'); },
  pickup(){ if(!AC||!G.sound) return; const t0=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
    o.type='sine'; o.frequency.setValueAtTime(660,t0); o.frequency.setValueAtTime(990,t0+0.08);
    env(g,t0,0.005,0.4,0.18); o.connect(g); g.connect(masterGain); o.start(t0); o.stop(t0+0.25); },
  wave(){ if(!AC||!G.sound) return; const t0=AC.currentTime;
    [220,277,330].forEach((fr,i)=>{ const o=AC.createOscillator(),g=AC.createGain(); o.type='sawtooth';
      o.frequency.value=fr; env(g,t0+i*0.12,0.01,0.22,0.3); o.connect(g); g.connect(masterGain);
      o.start(t0+i*0.12); o.stop(t0+i*0.12+0.4); }); },
};
let ambientOn=false;
function ambientStart(){
  if (!AC || !G.sound || ambientOn) return;
  ambientOn=true;
  const o = AC.createBufferSource(); o.buffer=noiseBuf; o.loop=true;
  const f = AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=320;
  const g = AC.createGain(); g.gain.value=0.05;
  o.connect(f); f.connect(g); g.connect(masterGain); o.start();
}

/* ---------------- Renderer / scene ----------------------------------------- */
function qualitySettings(){
  let q = G.quality;
  if (q==='auto') q = IS_TOUCH ? 'low' : 'high';
  return q;
}
function initThree(){
  const canvas = $('game');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
  const q = qualitySettings();
  G.renderer.setPixelRatio(q==='low' ? Math.min(devicePixelRatio,1.25) : Math.min(devicePixelRatio,2));
  G.renderer.setSize(innerWidth, innerHeight);
  G.renderer.shadowMap.enabled = (q==='high');
  if (q==='high'){ G.renderer.shadowMap.type = THREE.PCFShadowMap; }
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x87b5d6);
  G.scene.fog = new THREE.Fog(0xc8c39a, 40, 170);
  G.camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.08, 600);
  G.camera.rotation.order = 'YXZ';
  G.scene.add(G.camera);
  G.clock = new THREE.Clock();

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a52, 0.95);
  G.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6b0, 1.6);
  sun.position.set(-40, 60, 20);
  if (q==='high'){ sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-60; sun.shadow.camera.right=60; sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60; }
  G.scene.add(sun);
  G.muzzleLight = new THREE.PointLight(0xffb14e, 0, 18, 2);
  G.scene.add(G.muzzleLight);

  addEventListener('resize', ()=>{
    G.camera.aspect = innerWidth/innerHeight; G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
  });
}

/* ---------------- World: Peleliu-ridge-inspired island -------------------- */
function canvasTexture(draw, size=256){
  const c = document.createElement('canvas'); c.width=c.height=size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function addSolid(x, z, w, d, h=3){
  G.solids.push({x0:x-w/2, x1:x+w/2, z0:z-d/2, z1:z+d/2, h});
}
function buildWorld(){
  const S = G.scene;
  // ground (sand)
  const sandTex = canvasTexture((ctx,s)=>{
    ctx.fillStyle='#b49b62'; ctx.fillRect(0,0,s,s);
    for(let i=0;i<2600;i++){ ctx.fillStyle=`rgba(${90+Math.random()*80|0},${75+Math.random()*60|0},${40+Math.random()*40|0},0.35)`;
      ctx.fillRect(Math.random()*s, Math.random()*s, 2, 2); }
    for(let i=0;i<26;i++){ ctx.fillStyle='rgba(70,80,40,0.12)';
      ctx.beginPath(); ctx.arc(Math.random()*s,Math.random()*s,8+Math.random()*22,0,7); ctx.fill(); }
  });
  sandTex.repeat.set(30,30);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400),
    new THREE.MeshLambertMaterial({map:sandTex, color:0xd8c088}));
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; S.add(ground);
  // scorched center ridge (dark)
  const ridge = new THREE.Mesh(new THREE.CircleGeometry(26, 24),
    new THREE.MeshLambertMaterial({color:0x6b5b3a, transparent:true, opacity:0.55}));
  ridge.rotation.x=-Math.PI/2; ridge.position.y=0.02; S.add(ridge);
  // ocean ring
  const water = new THREE.Mesh(new THREE.RingGeometry(120, 380, 48),
    new THREE.MeshLambertMaterial({color:0x2e6f8e, transparent:true, opacity:0.9}));
  water.rotation.x=-Math.PI/2; water.position.y=-0.4; S.add(water);
  const foam = new THREE.Mesh(new THREE.RingGeometry(112, 122, 48),
    new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.35}));
  foam.rotation.x=-Math.PI/2; foam.position.y=-0.3; S.add(foam);
  // sky dome gradient
  const skyTex = canvasTexture((ctx,s)=>{
    const g=ctx.createLinearGradient(0,0,0,s);
    g.addColorStop(0,'#2f5d8f'); g.addColorStop(0.55,'#87b5d6'); g.addColorStop(0.8,'#e8d9a8'); g.addColorStop(1,'#e8d9a8');
    ctx.fillStyle=g; ctx.fillRect(0,0,s,s);
  }, 64);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 16, 12),
    new THREE.MeshBasicMaterial({map:skyTex, side:THREE.BackSide, fog:false}));
  S.add(sky);
  // sun sprite
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({color:0xfff2c0, fog:false, transparent:true, opacity:0.95}));
  sunSpr.scale.set(40,40,1); sunSpr.position.set(-190,150,90); S.add(sunSpr);
  // distant mountains
  const mMat = new THREE.MeshLambertMaterial({color:0x5a6b4a});
  [[-180,-140,90,34],[150,-170,110,40],[40,-220,130,46],[-140,170,100,30],[190,120,90,28]].forEach(([x,z,r,h])=>{
    const m = new THREE.Mesh(new THREE.ConeGeometry(r,h,7), mMat);
    m.position.set(x,h/2-2,z); S.add(m);
  });
  // clouds
  const cMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.75, fog:false});
  for(let i=0;i<10;i++){
    const cl = new THREE.Group();
    for(let j=0;j<4;j++){ const p=new THREE.Mesh(new THREE.SphereGeometry(rand(6,13),8,6), cMat);
      p.position.set(j*rand(7,11)-15, rand(-2,2), rand(-4,4)); p.scale.y=0.55; cl.add(p); }
    cl.position.set(rand(-260,260), rand(70,120), rand(-260,260));
    cl.userData.speed = rand(0.4,1.1); S.add(cl); clouds.push(cl);
  }
  buildFortifications(S);
  buildVegetation(S);
  // spawn points: ring around map + bunker mouths
  G.spawnPoints = [];
  for(let i=0;i<10;i++){ const a=i/10*Math.PI*2; G.spawnPoints.push(new THREE.Vector3(Math.cos(a)*78, 0, Math.sin(a)*78)); }
  G.spawnPoints.push(new THREE.Vector3(-30,0,-34), new THREE.Vector3(34,0,-30), new THREE.Vector3(0,0,-52));
}
const clouds = [];

const concreteMat = new THREE.MeshLambertMaterial({color:0x9a968a});
const darkMat = new THREE.MeshBasicMaterial({color:0x060606});
const woodMat = new THREE.MeshLambertMaterial({color:0x6b4e2e});
const crateMat = new THREE.MeshLambertMaterial({color:0x7a6234});
const bagMat = new THREE.MeshLambertMaterial({color:0xa08c5a});

function bunker(S, x, z, ry){
  const g = new THREE.Group();
  const main = new THREE.Mesh(new THREE.BoxGeometry(9,3.2,6.5), concreteMat);
  main.position.y=1.6; main.castShadow=true; g.add(main);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10,0.6,7.5), new THREE.MeshLambertMaterial({color:0x7c786c}));
  roof.position.y=3.5; roof.castShadow=true; g.add(roof);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.9), darkMat);
  mouth.position.set(0,1.15,3.26); g.add(mouth);
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(7,0.5), darkMat);
  slit.position.set(0,2.4,-3.26); slit.rotation.y=Math.PI; g.add(slit);
  // camo net poles
  for(const px of [-4,4]){ const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.4), woodMat);
    pole.position.set(px,4.4,2); g.add(pole); }
  const net = new THREE.Mesh(new THREE.PlaneGeometry(9.5,3.4,6,2),
    new THREE.MeshLambertMaterial({color:0x5c6b3c, transparent:true, opacity:0.85, side:THREE.DoubleSide}));
  net.position.set(0,5.2,1); net.rotation.x=0.35; g.add(net);
  g.position.set(x,0,z); g.rotation.y=ry; S.add(g);
  // collision in world space (approx axis aligned: keep bunkers axis-aligned)
  addSolid(x, z, 9.4, 7, 3.8);
  G.solidMeshes.push(main);
}
function sandbagRow(S, x, z, len, ry=0){
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len/1.1));
  for(let i=0;i<n;i++) for(let r=0;r<2;r++){
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55,7,5), bagMat);
    b.scale.set(1,0.55,0.7); b.position.set(-len/2+i*1.1+(r?0.5:0), 0.3+r*0.5, rand(-0.05,0.05));
    b.castShadow=true; g.add(b);
  }
  g.position.set(x,0,z); g.rotation.y=ry; S.add(g);
  const alongX = Math.abs(Math.cos(ry))>0.5;
  addSolid(x, z, alongX?len:1.4, alongX?1.4:len, 1.0);
}
function crate(S, x, z, s=1.3, ry=0){
  const m = new THREE.Mesh(new THREE.BoxGeometry(s,s,s), crateMat);
  m.position.set(x,s/2,z); m.rotation.y=ry; m.castShadow=true; S.add(m);
  addSolid(x,z,s+0.1,s+0.1,s); G.solidMeshes.push(m);
  return m;
}
function buildFortifications(S){
  bunker(S, -30, -34, 0); bunker(S, 34, -30, 0); bunker(S, 0, -52, 0);
  // US-side sandbag line + crates near player spawn
  sandbagRow(S, -6, 18, 8); sandbagRow(S, 7, 18, 8);
  sandbagRow(S, -14, 8, 7, Math.PI/2); sandbagRow(S, 14, 8, 7, Math.PI/2);
  sandbagRow(S, 0, -8, 10); sandbagRow(S, -22, -18, 8, 0.4); sandbagRow(S, 22, -16, 8, -0.4);
  crate(S, -4, 24); crate(S, -2.5, 24, 1.3); crate(S, -3.2, 24, 1.3).position.y = 1.95;
  crate(S, 5, 24); crate(S, 9, 2); crate(S, -10, -2); crate(S, 16, -8); crate(S, -18, 2);
  // watchtower
  const t = new THREE.Group();
  for(const [lx,lz] of [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.18,6), woodMat);
    leg.position.set(lx,3,lz); leg.castShadow=true; t.add(leg);
  }
  const plat=new THREE.Mesh(new THREE.BoxGeometry(4,0.3,4), woodMat); plat.position.y=6; plat.castShadow=true; t.add(plat);
  for(let i=0;i<4;i++){ const rail=new THREE.Mesh(new THREE.BoxGeometry(i<2?4:0.15,0.9,i<2?0.15:4), woodMat);
    rail.position.set(i===2?-1.95:i===3?1.95:0, 6.6, i===0?-1.95:i===1?1.95:0); t.add(rail); }
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.4,1.6,4), new THREE.MeshLambertMaterial({color:0x4c5a35}));
  roof.position.y=8; roof.rotation.y=Math.PI/4; t.add(roof);
  t.position.set(-20,0,26); S.add(t); addSolid(-20,26,3.4,3.4,6.2);
  // barbed wire posts
  const wireMat = new THREE.MeshBasicMaterial({color:0x222222});
  for(let i=0;i<14;i++){
    const x=-35+i*5.2, z=-24+Math.sin(i*1.7)*2;
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.1), woodMat);
    p.position.set(x,0.55,z); S.add(p);
    if(i<13){ const w=new THREE.Mesh(new THREE.BoxGeometry(5.2,0.5,0.08), wireMat);
      w.position.set(x+2.6,0.8,z); w.rotation.y=rand(-0.1,0.1); S.add(w); }
  }
  // US flag (procedural stripes) on a pole near spawn
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,9), woodMat);
  pole.position.set(3,4.5,28); S.add(pole);
  const flagTex = canvasTexture((ctx,s)=>{ ctx.fillStyle='#b33'; ctx.fillRect(0,0,s,s);
    ctx.fillStyle='#fff'; for(let i=0;i<7;i++) ctx.fillRect(0,i*s/13*2,s,s/13);
    ctx.fillStyle='#33c'; ctx.fillRect(0,0,s*0.45,s*7/13); }, 64);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3,1.8,8,1),
    new THREE.MeshLambertMaterial({map:flagTex, side:THREE.DoubleSide}));
  flag.position.set(4.6,7.8,28); S.add(flag); flags.push(flag);
}
const flags = [];
function palmTree(S, x, z){
  const g = new THREE.Group();
  const h = rand(5,8);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.34,h,7),
    new THREE.MeshLambertMaterial({color:0x6e5233}));
  trunk.position.y=h/2; trunk.rotation.z=rand(-0.12,0.12); trunk.castShadow=true; g.add(trunk);
  const top = new THREE.Group(); top.position.y=h;
  const frondMat = new THREE.MeshLambertMaterial({color:0x3f7030, side:THREE.DoubleSide});
  for(let i=0;i<7;i++){
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.9,4,1), frondMat);
    const pos = f.geometry.attributes.position;
    for(let v=0;v<pos.count;v++){ const px=pos.getX(v); pos.setY(v, -Math.pow(Math.abs(px)/1.7,2)*0.9); }
    f.geometry.computeVertexNormals();
    f.rotation.y = i/7*Math.PI*2;
    f.position.set(Math.cos(f.rotation.y)*1.5, -0.3, -Math.sin(f.rotation.y)*1.5);
    f.rotation.z = 0.5; top.add(f);
  }
  for(let i=0;i<3;i++){ const nut=new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5),
    new THREE.MeshLambertMaterial({color:0x5a4426})); nut.position.set(rand(-0.4,0.4),-0.3,rand(-0.4,0.4)); top.add(nut); }
  g.add(top); g.position.set(x,0,z); g.rotation.y=rand(0,6); S.add(g);
  addSolid(x,z,0.8,0.8,h);
}
function buildVegetation(S){
  // palms avoiding center lanes & structures
  let placed=0, guard=0;
  while(placed<44 && guard++<600){
    const x=rand(-85,85), z=rand(-85,85);
    if (Math.hypot(x,z-20)<14) continue;
    let bad=false;
    for(const s of G.solids){ if(x>s.x0-3&&x<s.x1+3&&z>s.z0-3&&z<s.z1+3){bad=true;break;} }
    if(bad) continue;
    palmTree(S,x,z); placed++;
  }
  // grass tufts
  const tuftMat = new THREE.MeshLambertMaterial({color:0x6d7f3e, side:THREE.DoubleSide});
  for(let i=0;i<170;i++){
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.55), tuftMat);
    t.position.set(rand(-90,90), 0.26, rand(-90,90));
    t.rotation.y = rand(0,Math.PI);
    S.add(t);
  }
}

/* ---------------- First-person viewmodel guns ------------------------------ */
let gunGroup=null, gunMuzzle=null, gunParts={};
function buildViewmodel(def){
  if (gunGroup){ G.camera.remove(gunGroup); }
  gunGroup = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({color:def.color});
  const dark = new THREE.MeshLambertMaterial({color:0x1c1c1e});
  const wood = new THREE.MeshLambertMaterial({color:0x5a3d22});
  const L = def.len;
  const recv = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.13,L*0.55), body);
  gunGroup.add(recv);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,L*0.5,8), dark);
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.015,-L*0.5); gunGroup.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.16,0.09), wood);
  grip.position.set(0,-0.12,L*0.1); grip.rotation.x=0.3; gunGroup.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.08), dark);
  mag.position.set(0,-0.13,-L*0.08); mag.rotation.x=-0.15; gunGroup.add(mag);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.11,L*0.3), def.id==='r870'?wood:body);
  stock.position.set(0,-0.01,L*0.4); gunGroup.add(stock);
  // sight ring / rear sight
  if (def.scoped){
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.22,10), dark);
    scope.rotation.x=Math.PI/2; scope.position.set(0,0.09,-0.02); gunGroup.add(scope);
  } else {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.014,0.05,0.014), dark);
    post.position.set(0,0.085,-L*0.32); gunGroup.add(post);
  }
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.095,0.07,0.14), wood);
  pump.position.set(0,-0.03,-L*0.32); gunGroup.add(pump);
  gunParts.pump = pump;
  // hands (simple gloves)
  const glove = new THREE.MeshLambertMaterial({color:0x8a7355});
  const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.1), glove);
  h1.position.set(0.01,-0.1,L*0.08); gunGroup.add(h1);
  const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.1), glove);
  h2.position.set(-0.005,-0.045,-L*0.32); gunGroup.add(h2);
  // muzzle tip + flash quad
  gunMuzzle = new THREE.Object3D(); gunMuzzle.position.set(0,0.015,-L*0.78); gunGroup.add(gunMuzzle);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.34),
    new THREE.MeshBasicMaterial({color:0xffd27a, transparent:true, opacity:0, depthWrite:false}));
  flash.position.copy(gunMuzzle.position); gunGroup.add(flash);
  gunParts.flash = flash;
  gunGroup.position.set(0.24,-0.22,-0.5);
  gunGroup.scale.setScalar(0.8);
  G.camera.add(gunGroup);
  gunParts.basePos = gunGroup.position.clone();
  gunParts.recoil = 0; gunParts.reloadA = 0;
}

/* ---------------- Input: desktop + touch --------------------------------- */
function initInput(){
  addEventListener('keydown', e=>{
    G.keys[e.code]=true;
    if (['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.code==='KeyR') startReload();
    if (e.code==='Digit1') switchSlot(0);
    if (e.code==='Digit2') switchSlot(1);
    if (e.code==='Digit3') switchSlot(2);
    if (e.code==='KeyP' || e.code==='Escape') togglePause();
  });
  addEventListener('keyup', e=>{ G.keys[e.code]=false; });
  const canvas = $('game');
  canvas.addEventListener('mousedown', e=>{
    if (!G.started || G.paused || G.over) return;
    if (document.pointerLockElement!==canvas && !IS_TOUCH) canvas.requestPointerLock?.();
    if (e.button===0){ G.triggerHeld=true; G.triggerEdge=true; }
    if (e.button===2) G.player.adsOn=true;
  });
  addEventListener('mouseup', e=>{
    if (e.button===0) G.triggerHeld=false;
    if (e.button===2) G.player.adsOn=false;
  });
  addEventListener('contextmenu', e=>e.preventDefault());
  document.addEventListener('pointerlockchange', ()=>{
    if (document.pointerLockElement!==$('game') && G.started && !G.over && !IS_TOUCH && !G.paused) {
      // user pressed Esc: pause rather than leave them stuck
      if (G.player.hp>0) pauseGame(true);
    }
  });
  addEventListener('mousemove', e=>{
    if (document.pointerLockElement!==$('game') || !G.started || G.paused) return;
    const s = 0.0021 * G.sens * (G.player.adsOn?0.6:1);
    G.player.yaw -= e.movementX*s;
    G.player.pitch = clamp(G.player.pitch - e.movementY*s, -1.45, 1.45);
  });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden && G.started && !G.paused && !G.over) pauseGame(true); });

  // --- touch joystick ---
  const zone=$('stick-zone'), base=$('stick-base'), knob=$('stick-knob');
  let stickId=null, cx=0, cy=0;
  const setKnob=(dx,dy)=>{ knob.style.transform=`translate(${dx}px,${dy}px)`; };
  zone.addEventListener('touchstart', e=>{ e.preventDefault();
    const t=e.changedTouches[0]; stickId=t.identifier;
    const r=base.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2;
    G.joy.on=true;
  }, {passive:false});
  zone.addEventListener('touchmove', e=>{ e.preventDefault();
    for(const t of e.changedTouches){ if(t.identifier!==stickId) continue;
      let dx=t.clientX-cx, dy=t.clientY-cy;
      const m=Math.hypot(dx,dy), max=52;
      if(m>max){dx*=max/m;dy*=max/m;}
      setKnob(dx,dy); G.joy.x=dx/max; G.joy.y=dy/max;
    }
  }, {passive:false});
  const endStick=e=>{ for(const t of e.changedTouches){ if(t.identifier===stickId){
    stickId=null; G.joy.x=G.joy.y=0; G.joy.on=false; setKnob(0,0); } } };
  zone.addEventListener('touchend',endStick); zone.addEventListener('touchcancel',endStick);
  // --- touch look ---
  const look=$('look-zone'); let lookId=null, lx=0, ly=0;
  look.addEventListener('touchstart', e=>{ e.preventDefault();
    const t=e.changedTouches[0]; lookId=t.identifier; lx=t.clientX; ly=t.clientY;
  }, {passive:false});
  look.addEventListener('touchmove', e=>{ e.preventDefault();
    for(const t of e.changedTouches){ if(t.identifier!==lookId) continue;
      const s=0.0042*G.sens*(G.player.adsOn?0.55:1);
      G.player.yaw -= (t.clientX-lx)*s;
      G.player.pitch = clamp(G.player.pitch-(t.clientY-ly)*s, -1.45, 1.45);
      lx=t.clientX; ly=t.clientY;
    }
  }, {passive:false});
  const endLook=e=>{ for(const t of e.changedTouches){ if(t.identifier===lookId) lookId=null; } };
  look.addEventListener('touchend',endLook); look.addEventListener('touchcancel',endLook);
  // --- touch buttons ---
  const hold=(id,down,up)=>{ const el=$(id);
    el.addEventListener('touchstart',e=>{e.preventDefault();el.classList.add('on');down();},{passive:false});
    const off=e=>{e.preventDefault();el.classList.remove('on');up&&up();};
    el.addEventListener('touchend',off); el.addEventListener('touchcancel',off);
    el.addEventListener('mousedown',e=>{e.preventDefault();down();});
    el.addEventListener('mouseup',()=>{el.classList.remove('on');up&&up();});
  };
  hold('btn-fire', ()=>{G.triggerHeld=true;G.triggerEdge=true;}, ()=>{G.triggerHeld=false;});
  hold('btn-ads', ()=>{G.player.adsOn=!G.player.adsOn;$('btn-ads').classList.toggle('on',G.player.adsOn);});
  hold('btn-reload', ()=>startReload());
  hold('btn-weapon', ()=>cycleWeapon());
  hold('btn-jump', ()=>tryJump());
  hold('btn-sprint', ()=>{G.keys.SprintToggle=!G.keys.SprintToggle;
    $('btn-sprint').classList.toggle('on',!!G.keys.SprintToggle);});
  $('pause-btn').addEventListener('click', ()=>togglePause());
  document.querySelectorAll('#slots .slot').forEach(b=>{
    b.addEventListener('click', ()=>switchSlot(+b.dataset.slot));
  });
}

/* ---------------- Collision ----------------------------------------------- */
function collideCircle(p, r){
  for(const s of G.solids){
    const cx = clamp(p.x, s.x0, s.x1), cz = clamp(p.z, s.z0, s.z1);
    let dx = p.x-cx, dz = p.z-cz;
    let d2 = dx*dx+dz*dz;
    if (d2 < r*r){
      if (d2 < 1e-8){ // inside: push along smallest exit
        const exL=p.x-s.x0, exR=s.x1-p.x, ezL=p.z-s.z0, ezR=s.z1-p.z;
        const m=Math.min(exL,exR,ezL,ezR);
        if(m===exL)p.x=s.x0-r; else if(m===exR)p.x=s.x1+r;
        else if(m===ezL)p.z=s.z0-r; else p.z=s.z1+r;
      } else { const d=Math.sqrt(d2); p.x=cx+dx/d*r; p.z=cz+dz/d*r; }
    }
  }
  const m = Math.hypot(p.x,p.z);
  if (m>88){ p.x*=88/m; p.z*=88/m; }
}
// ray vs 2.5D solids (walls with height h); returns nearest t or Infinity
function rayWalls(o, d){
  let best = Infinity;
  for(const s of G.solids){
    let tmin=0, tmax=Infinity, ok=true;
    if (Math.abs(d.x)<1e-9){ if(o.x<s.x0||o.x>s.x1) ok=false; }
    else { let t1=(s.x0-o.x)/d.x, t2=(s.x1-o.x)/d.x; if(t1>t2)[t1,t2]=[t2,t1]; tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2); }
    if(ok){
      if (Math.abs(d.z)<1e-9){ if(o.z<s.z0||o.z>s.z1) ok=false; }
      else { let t1=(s.z0-o.z)/d.z, t2=(s.z1-o.z)/d.z; if(t1>t2)[t1,t2]=[t2,t1]; tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2); }
    }
    if(!ok||tmax<tmin||tmin<0) continue;
    const y = o.y + d.y*tmin;
    if (y > s.h) continue; // shot passes over sandbags etc.
    if (tmin<best) best=tmin;
  }
  if (d.y<-1e-6){ const t=-o.y/d.y; if(t>0&&t<best) best=t; } // ground
  return best;
}
// ray vs sphere; returns t or Infinity
function raySphere(o, d, c, r){
  const ox=c.x-o.x, oy=c.y-o.y, oz=c.z-o.z;
  const tca=ox*d.x+oy*d.y+oz*d.z;
  if(tca<0) return Infinity;
  const d2=ox*ox+oy*oy+oz*oz-tca*tca;
  const r2=r*r;
  if(d2>r2) return Infinity;
  const t=tca-Math.sqrt(r2-d2);
  return t>0?t:Infinity;
}

/* ---------------- Particles / tracers / shells ----------------------------- */
const partGeo = new THREE.BoxGeometry(0.09,0.09,0.09);
function spawnPart(pos, vel, color, life, grav=9, size=1){
  if (G.parts.length>260){ const old=G.parts.shift(); G.scene.remove(old.m); }
  const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({color, transparent:true}));
  m.position.copy(pos); m.scale.setScalar(size);
  G.scene.add(m);
  G.parts.push({m, vx:vel.x, vy:vel.y, vz:vel.z, life, max:life, grav});
}
function burst(pos, n, color, speed, life, grav=9, size=1){
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2), e=rand(-1,1);
    const s=rand(speed*0.4,speed);
    spawnPart(pos, new THREE.Vector3(Math.cos(a)*s*Math.sqrt(1-e*e), e*s+speed*0.4, Math.sin(a)*s*Math.sqrt(1-e*e)),
      color, rand(life*0.6,life), grav, rand(0.7,1.4)*size);
  }
}
function updateParts(dt){
  for(let i=G.parts.length-1;i>=0;i--){
    const p=G.parts[i]; p.life-=dt;
    if(p.life<=0){ G.scene.remove(p.m); p.m.material.dispose(); G.parts.splice(i,1); continue; }
    p.vy-=p.grav*dt;
    p.m.position.x+=p.vx*dt; p.m.position.y+=p.vy*dt; p.m.position.z+=p.vz*dt;
    if(p.m.position.y<0.03){p.m.position.y=0.03;p.vy*=-0.3;p.vx*=0.7;p.vz*=0.7;}
    p.m.material.opacity=p.life/p.max;
    p.m.rotation.x+=dt*5; p.m.rotation.y+=dt*4;
  }
}
const tracerMatP = new THREE.LineBasicMaterial({color:0xffe08a, transparent:true, opacity:0.9});
const tracerMatE = new THREE.LineBasicMaterial({color:0xff5a3c, transparent:true, opacity:0.9});
function spawnTracer(a, b, enemy=false){
  const g = new THREE.BufferGeometry().setFromPoints([a,b]);
  const line = new THREE.Line(g, (enemy?tracerMatE:tracerMatP).clone());
  G.scene.add(line);
  G.tracers.push({line, life:0.07});
}
function updateTracers(dt){
  for(let i=G.tracers.length-1;i>=0;i--){
    const t=G.tracers[i]; t.life-=dt;
    if(t.life<=0){ G.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); G.tracers.splice(i,1); }
    else t.line.material.opacity=t.life/0.07;
  }
}
function ejectShell(){
  const right = new THREE.Vector3(1,0,0).applyQuaternion(G.camera.quaternion);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.045),
    new THREE.MeshBasicMaterial({color:0xd8a833}));
  m.position.copy(G.camera.position).addScaledVector(right,0.15); m.position.y-=0.15;
  G.scene.add(m);
  G.shells.push({m, v:new THREE.Vector3(right.x*1.4+rand(-0.4,0.4), rand(1,2), right.z*1.4+rand(-0.4,0.4)), life:1.2});
}
function updateShells(dt){
  for(let i=G.shells.length-1;i>=0;i--){
    const s=G.shells[i]; s.life-=dt;
    if(s.life<=0){G.scene.remove(s.m);s.m.material.dispose();s.m.geometry.dispose();G.shells.splice(i,1);continue;}
    s.v.y-=9*dt; s.m.position.addScaledVector(s.v,dt);
    if(s.m.position.y<0.02){s.m.position.y=0.02;s.v.set(0,0,0);}
  }
}

/* ---------------- Shooting -------------------------------------------------- */
function eyePos(){ return G.camera.position; }
function aimDir(spread){
  const d = new THREE.Vector3(0,0,-1).applyQuaternion(G.camera.quaternion);
  d.x+=rand(-spread,spread); d.y+=rand(-spread,spread); d.z+=rand(-spread,spread);
  return d.normalize();
}
function tryJump(){
  if (!G.started||G.paused||G.over) return;
  if (G.player.onGround){ G.player.vy=4.6; G.player.onGround=false; }
}
function startReload(){
  const gs=curGun();
  if (!G.started||G.paused||G.over||G.reloadT>0||G.switching>0) return;
  if (gs.mag>=gs.def.mag || gs.reserve<=0) return;
  G.reloadT=gs.def.reload;
  gunParts.reloadA=1;
  sfx.reload();
  $('reload-tip').classList.remove('hidden');
}
function finishReload(){
  const gs=curGun(), need=gs.def.mag-gs.mag, take=Math.min(need,gs.reserve);
  gs.mag+=take; gs.reserve-=take;
  $('reload-tip').classList.add('hidden');
  updateAmmoHUD();
}
function switchSlot(i){
  if (i===G.slot||G.switching>0||!G.started||G.paused||G.over) return;
  if (i===2 && G.guns[2].locked) return;
  if (G.guns[i].mag<=0 && G.guns[i].reserve<=0 && i!==G.slot){
    // allow switching anyway; HUD will show 0
  }
  G.slot=i; G.switching=0.38; G.reloadT=0;
  $('reload-tip').classList.add('hidden');
  buildViewmodel(G.guns[i].def);
  playNoise(0.12, 2500, 0.3, 'bandpass');
  updateAmmoHUD(); updateSlots();
}
function cycleWeapon(){
  const order=[0,1,2].filter(i=>!(i===2&&G.guns[2].locked));
  switchSlot(order[(order.indexOf(G.slot)+1)%order.length]);
}
function fireBullet(pelletSpread){
  const gs=curGun(), def=gs.def;
  G.shots++;
  const spread = lerp(def.spread, def.adsSpread, G.player.ads) * (G.player.sprinting?1.7:1) * (pelletSpread||1);
  const o = eyePos().clone(), d = aimDir(spread);
  // launcher -> projectile
  if (def.explosive){ fireRocket(o,d); return; }
  const wallT = rayWalls(o,d);
  // find nearest enemy hit
  let bestT=Infinity, bestE=null, bestHead=false;
  for(const e of G.enemies){
    if(e.dying) continue;
    const bp=e.mesh.position, body={x:bp.x,y:bp.y+1.0,z:bp.z}, head={x:bp.x,y:bp.y+1.62,z:bp.z};
    const th=raySphere(o,d,head,0.30), tb=raySphere(o,d,bp.clone?{x:bp.x,y:bp.y+1.0,z:bp.z}:body,0.62);
    const te=Math.min(th,tb);
    if(te<bestT&&te<wallT&&te<def.range){bestT=te;bestE=e;bestHead=th<=tb;}
  }
  const end = o.clone().addScaledVector(d, Math.min(bestT===Infinity?wallT:bestT, def.range));
  spawnTracer(G.camera.position.clone().addScaledVector(d,0.7).add(new THREE.Vector3(0,-0.1,0)), end);
  if (bestE){
    G.hits++;
    let dmg=def.dmg*(bestHead?def.headMult:1);
    dmg*=clamp(1-bestT/(def.range*2.2),0.45,1);
    damageEnemy(bestE, dmg, bestHead, end);
  } else if (wallT<def.range){
    burst(end, def.id==='r870'?5:3, 0xd8c088, 3, 0.4, 9, 0.8);
  }
  // shotgun pump anim
  if (def.id==='r870'&&gunParts.pump) gunParts.pump.position.z += 0.09;
}
function fireRocket(o,d){
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), new THREE.MeshBasicMaterial({color:0xffcf7a}));
  m.position.copy(o).addScaledVector(d,0.8);
  G.scene.add(m);
  G.projectiles.push({m, v:d.clone().multiplyScalar(34), life:4});
  playShot('launcher');
}
function explode(pos){
  sfx.explosion();
  G.shake=Math.min(1,G.shake+0.7);
  burst(pos, 26, 0xff8a3c, 9, 0.8, 7, 1.6);
  burst(pos, 16, 0x333333, 5, 1.4, 2, 2.2);
  burst(pos, 10, 0xffe08a, 13, 0.4, 6, 1.2);
  G.muzzleLight.position.copy(pos); G.muzzleLight.intensity=60;
  spawnPart(pos.clone(), new THREE.Vector3(0,2,0), 0xffffff, 0.12, 0, 6);
  for(const e of [...G.enemies]){
    if(e.dying) continue;
    const dist=e.mesh.position.distanceTo(pos);
    if(dist<9){
      const dmg=210*clamp(1-dist/11,0.2,1);
      damageEnemy(e, dmg, false, e.mesh.position.clone().add(new THREE.Vector3(0,1,0)));
      e.stun=0.6;
    }
  }
  const pd=G.player.pos.distanceTo(pos);
  if(pd<7) hurtPlayer(55*clamp(1-pd/9,0.15,1), pos);
}
function updateProjectiles(dt){
  for(let i=G.projectiles.length-1;i>=0;i--){
    const r=G.projectiles[i]; r.life-=dt;
    r.v.y-=4*dt;
    r.m.position.addScaledVector(r.v,dt);
    spawnPart(r.m.position.clone(), new THREE.Vector3(rand(-1,1),rand(-1,1),rand(-1,1)), 0xffcf7a, 0.25, 0, 0.9);
    const dir=r.v.clone().normalize();
    let hit = r.m.position.y<=0.1 || r.life<=0;
    if(!hit && rayWalls(r.m.position, dir)<0.6) hit=true;
    if(!hit) for(const e of G.enemies){ if(e.dying) continue;
      if(raySphere(r.m.position, dir, {x:e.mesh.position.x,y:e.mesh.position.y+1,z:e.mesh.position.z}, 0.8)<1.2){hit=true;break;} }
    if(hit){ const p=r.m.position.clone(); G.scene.remove(r.m); G.projectiles.splice(i,1); explode(p); }
  }
}
function pullTrigger(){
  const gs=curGun(), def=gs.def;
  if (G.reloadT>0||G.switching>0||G.player.dead) return;
  if (gs.mag<=0){
    if (G.triggerEdge){ sfx.empty(); startReload(); }
    G.triggerEdge=false; return;
  }
  if (G.fireCd>0){ G.triggerEdge=false; return; }
  // burst pistol logic
  if (def.burst){
    if (!G.triggerEdge && G.burstLeft<=0) return;
    if (G.triggerEdge){ G.burstLeft=def.burst; G.triggerEdge=false; }
    if (G.burstCd>0) return;
    G.burstCd=0.09;
    G.burstLeft--;
  } else if (!def.auto && !G.triggerEdge){ return; }
  else G.triggerEdge=false;
  // FIRE
  gs.mag--;
  G.fireCd=60/def.rpm;
  playShot(def.sound);
  gunParts.recoil=Math.min(1,gunParts.recoil+ (def.id==='r870'||def.scoped?0.9:0.42));
  G.player.pitch=clamp(G.player.pitch+def.kick*(G.player.adsOn?0.6:1),-1.45,1.45);
  G.crossGap=Math.min(26,G.crossGap+ (def.id==='r870'?9:4));
  G.shake=Math.min(0.5,G.shake+def.kick*2.2);
  const mp=gunMuzzle.getWorldPosition(new THREE.Vector3());
  G.muzzleLight.position.copy(mp); G.muzzleLight.intensity=14;
  gunParts.flash.material.opacity=1; gunParts.flash.rotation.z=rand(0,6);
  const n=def.pellets||1;
  for(let i=0;i<n;i++) fireBullet(i>0?2.2:1);
  ejectShell();
  if (gs.mag===0) setTimeout(()=>{ if(curGun()===gs&&gs.mag===0) startReload(); }, def.auto?180:420);
  updateAmmoHUD();
}

/* ---------------- Enemies --------------------------------------------------- */
const ETypes = {
  rifle:{ hp:60, speed:3.2, dmg:9, score:100, scale:1, uniform:0x6b6b3a, helmet:0x4a4a28, gap:1.6 },
  officer:{ hp:95, speed:4.1, dmg:12, score:150, scale:1, uniform:0x3f4436, helmet:0x2c2c22, gap:1.3 },
  gunner:{ hp:170, speed:2.5, dmg:16, score:200, scale:1.14, uniform:0x5a5a30, helmet:0x3a3a20, gap:2.0 },
};
function spawnEnemy(){
  const tp = G.wave>=7?'gunner':(Math.random()<0.22?'officer':(G.wave>=4&&Math.random()<0.25?'gunner':'rifle'));
  const T = ETypes[tp];
  const hpMul = 1 + (G.wave-1)*0.22;
  const g = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({color:T.uniform});
  const skin = new THREE.MeshLambertMaterial({color:0xc8a075});
  const helm = new THREE.MeshLambertMaterial({color:T.helmet});
  const dark = new THREE.MeshLambertMaterial({color:0x222222});
  const legL=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.7,0.24),dark); legL.position.set(-0.14,0.35,0);
  const legR=legL.clone(); legR.position.x=0.14;
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.7,0.32),uni); torso.position.y=1.05; torso.castShadow=true;
  const armL=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.55,0.14),uni); armL.position.set(-0.36,1.05,0.1); armL.rotation.x=-1.1;
  const armR=armL.clone(); armR.position.x=0.36;
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.21,10,8),skin); head.position.y=1.62;
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(0.25,10,6,0,Math.PI*2,0,Math.PI/2),helm); helmet.position.y=1.66;
  const gun=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.1,0.85),dark); gun.position.set(0.2,1.1,-0.4);
  g.add(legL,legR,torso,armL,armR,head,helmet,gun);
  g.scale.setScalar(T.scale);
  const sp = G.spawnPoints[Math.floor(Math.random()*G.spawnPoints.length)];
  g.position.set(sp.x+rand(-4,4), 0, sp.z+rand(-4,4));
  G.scene.add(g);
  G.enemies.push({ mesh:g, type:tp, hp:T.hp*hpMul, maxHp:T.hp*hpMul, speed:T.speed*rand(0.9,1.15)+(G.wave*0.08),
    dmg:T.dmg*(1+(G.wave-1)*0.1), score:T.score, atkCd:rand(0.5,1.5), strafe:rand(-1,1), strafeT:rand(1,3),
    dying:false, dieT:0, stun:0, bob:rand(0,6), flash:0 });
  updateEnemiesHUD();
}
function damageEnemy(e, dmg, head, pos){
  if (e.dying) return;
  e.hp-=dmg; e.flash=0.08;
  burst(pos, head?7:4, 0xa8232a, 4, 0.5, 8, 1);
  showHitmarker(false, head);
  spawnDmgNum(pos, Math.round(dmg), head);
  if (head){ sfx.headshot(); G.headshots++; G.score+=25; }
  else sfx.hitmark();
  if (e.hp<=0) killEnemy(e, head);
  else { e.stun=Math.max(e.stun, head?0.35:0.12); }
}
function killEnemy(e, head){
  e.dying=true; e.dieT=2.2;
  G.kills++; G.score+=e.score+(head?50:0);
  showHitmarker(true, head);
  addKillfeed(e, head);
  updateScoreHUD();
  // drops
  const r=Math.random();
  if (r<0.16) spawnPickup(e.mesh.position, Math.random()<0.5?'ammo':'med');
  else if (r<0.22) spawnPickup(e.mesh.position,'ammo');
  // death burst
  burst(e.mesh.position.clone().add(new THREE.Vector3(0,1,0)), 10, 0xa8232a, 5, 0.7, 8, 1.1);
  updateEnemiesHUD();
}
function updateEnemies(dt){
  const pp = G.player.pos;
  for(let i=G.enemies.length-1;i>=0;i--){
    const e=G.enemies[i], m=e.mesh;
    if (e.dying){
      e.dieT-=dt;
      m.rotation.z = lerp(m.rotation.z, Math.PI/2, dt*7);
      m.position.y = lerp(m.position.y, -0.25, dt*4);
      if (e.dieT<0.8){ m.traverse(o=>{ if(o.material&&o.material.transparent!==undefined){o.material.transparent=true; o.material.opacity=Math.max(0,e.dieT/0.8);} }); }
      if (e.dieT<=0){ G.scene.remove(m); G.enemies.splice(i,1); }
      continue;
    }
    e.bob+=dt*9;
    if (e.flash>0){ e.flash-=dt; m.traverse(o=>{if(o.material&&o.material.color&&!o.userData.f){o.userData.f=true;o.material=o.material.clone();}}); }
    if (e.stun>0){ e.stun-=dt; }
    else {
      const toP = new THREE.Vector3(pp.x-m.position.x, 0, pp.z-m.position.z);
      const dist = toP.length(); toP.normalize();
      e.strafeT-=dt; if(e.strafeT<=0){e.strafeT=rand(1,3);e.strafe=rand(-1,1);}
      const want = dist>16 ? 1 : dist<7 ? -0.7 : 0.15; // advance / hold / back off
      const mx = toP.x*want + -toP.z*e.strafe*0.5, mz = toP.z*want + toP.x*e.strafe*0.5;
      m.position.x += mx*e.speed*dt; m.position.z += mz*e.speed*dt;
      collideCircle(m.position, 0.5);
      // separation
      for(const o of G.enemies){ if(o===e||o.dying) continue;
        const dx=m.position.x-o.mesh.position.x, dz=m.position.z-o.mesh.position.z;
        const d=Math.hypot(dx,dz);
        if(d<1.2&&d>0.01){ m.position.x+=dx/d*dt*2; m.position.z+=dz/d*dt*2; } }
      m.position.y = Math.abs(Math.sin(e.bob))*0.06;
      m.rotation.y = Math.atan2(toP.x, toP.z)+Math.PI;
      // attack
      e.atkCd-=dt;
      const T=ETypes[e.type];
      if (e.atkCd<=0 && dist<55){
        e.atkCd=T.gap*rand(0.85,1.25);
        enemyShoot(e, dist);
      }
    }
  }
}
function enemyShoot(e, dist){
  const from = e.mesh.position.clone().add(new THREE.Vector3(0,1.35,0));
  const target = G.player.pos.clone(); target.y-=rand(0,0.5);
  // miss chance grows with distance & player sprint
  const missR = clamp(dist*0.035,0.05,0.75) + (G.player.sprinting?0.12:0);
  let aim;
  if (Math.random()<missR){
    aim = target.clone().add(new THREE.Vector3(rand(-2.4,2.4), rand(-1,1.4), rand(-2.4,2.4)));
  } else aim = target;
  const d = aim.clone().sub(from).normalize();
  if (rayWalls(from,d) < from.distanceTo(aim)-0.5){
    spawnTracer(from, from.clone().addScaledVector(d, 8), true); // hits cover
    return;
  }
  spawnTracer(from, aim, true);
  burst(aim, 2, 0xd8c088, 2, 0.3, 9, 0.7);
  if (aim===target || aim.distanceTo(target)<1.3){
    hurtPlayer(e.dmg*clamp(1-dist/70,0.35,1), e.mesh.position);
  }
  // enemy muzzle blink
  burst(from, 2, 0xffb14e, 1.5, 0.12, 0, 1);
}

/* ---------------- Pickups -------------------------------------------------- */
function spawnPickup(pos, kind){
  const color = kind==='ammo'?0x3aff6e:0xff5252;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),
    new THREE.MeshLambertMaterial({color, emissive:color, emissiveIntensity:0.5}));
  m.position.set(pos.x+rand(-1,1), 0.6, pos.z+rand(-1,1));
  G.scene.add(m);
  G.pickups.push({m, kind, t:rand(0,6), life:25});
}
function updatePickups(dt){
  for(let i=G.pickups.length-1;i>=0;i--){
    const p=G.pickups[i]; p.t+=dt; p.life-=dt;
    p.m.rotation.y+=dt*2; p.m.position.y=0.6+Math.sin(p.t*3)*0.12;
    if (p.life<=0){ G.scene.remove(p.m); G.pickups.splice(i,1); continue; }
    if (p.m.position.distanceTo(G.player.pos)<1.9){
      if (p.kind==='ammo'){
        for(const gs of G.guns){ if(gs.locked) continue;
          gs.reserve=Math.min(gs.def.maxReserve, gs.reserve+Math.ceil(gs.def.mag*1.2)); }
        addKillfeed(null,false,'+ AMMO RESTOCKED');
      } else {
        G.player.hp=Math.min(100,G.player.hp+50);
        $('heal-flash').style.opacity=1;
        setTimeout(()=>$('heal-flash').style.opacity=0,180);
        addKillfeed(null,false,'+50 HEALTH');
      }
      sfx.pickup(); updateAmmoHUD();
      G.scene.remove(p.m); G.pickups.splice(i,1);
    }
  }
}

/* ---------------- Waves ----------------------------------------------------- */
function waveComp(n){
  return { total: 5 + n*3 + (n>5?4:0) };
}
function startWave(n){
  G.wave=n; G.waveState='active';
  const c=waveComp(n);
  G.toSpawn=c.total; G.spawnT=0;
  if (n===3 && G.guns[2].locked){
    G.guns[2].locked=false; G.guns[2].reserve=LAUNCHER.reserve;
    addKillfeed(null,false,'🚀 ROCKET PROTOTYPE UNLOCKED (slot 3)');
    updateSlots();
  }
  showBanner('WAVE '+n, n===8?'FINAL STAND — HOLD THE RIDGE':'HOSTILES INBOUND: '+c.total);
  sfx.wave();
  $('wave-num').textContent=n;
  updateEnemiesHUD();
}
function updateWaves(dt){
  if (G.waveState==='active'){
    if (G.toSpawn>0){
      G.spawnT-=dt;
      const alive=G.enemies.filter(e=>!e.dying).length;
      if (G.spawnT<=0 && alive<11){
        G.spawnT=Math.max(0.4, 1.6-G.wave*0.12);
        spawnEnemy(); G.toSpawn--;
      }
    } else if (G.enemies.length===0){
      // wave cleared
      const bonus=150+G.wave*50;
      G.score+=bonus; updateScoreHUD();
      addKillfeed(null,false,`WAVE ${G.wave} CLEARED  +${bonus}`);
      for(const gs of G.guns){ if(!gs.locked) gs.reserve=Math.min(gs.def.maxReserve, gs.reserve+Math.ceil(gs.def.mag*0.8)); }
      updateAmmoHUD();
      if (G.wave>=TOTAL_WAVES){ winGame(); return; }
      G.waveState='intermission'; G.waveDelay=9;
    }
  } else if (G.waveState==='intermission'){
    G.waveDelay-=dt;
    if (G.waveDelay<=0) startWave(G.wave+1);
  }
  updateEnemiesHUD();
}

/* ---------------- Player ---------------------------------------------------- */
function hurtPlayer(dmg, fromPos){
  if (G.player.dead || G.over) return;
  G.player.hp-=dmg;
  G.player.lastHurt=G.time;
  G.shake=Math.min(1,G.shake+0.35);
  sfx.hurt();
  const v=$('dmg-vignette'); v.style.opacity=clamp(0.35+dmg/40,0,0.95);
  clearTimeout(v._t); v._t=setTimeout(()=>v.style.opacity=0,260);
  // direction indicator
  if (fromPos){
    const dx=fromPos.x-G.player.pos.x, dz=fromPos.z-G.player.pos.z;
    const worldA=Math.atan2(dx,-dz); // bearing of attacker in map convention
    let rel=worldA+G.player.yaw;
    const el=document.createElement('span');
    el.style.transform=`rotate(${rel}rad) translateY(-70px)`;
    $('hitdir').appendChild(el);
    setTimeout(()=>el.remove(),900);
  }
  updateHealthHUD();
  if (G.player.hp<=0){ G.player.hp=0; die(); }
}
function updatePlayer(dt){
  const P=G.player;
  if (P.dead) return;
  // movement input
  let ix=0, iz=0;
  if (G.keys.KeyW||G.keys.ArrowUp) iz-=1;
  if (G.keys.KeyS||G.keys.ArrowDown) iz+=1;
  if (G.keys.KeyA||G.keys.ArrowLeft) ix-=1;
  if (G.keys.KeyD||G.keys.ArrowRight) ix+=1;
  if (G.joy.on){ ix+=G.joy.x; iz+=G.joy.y; }
  const mag=Math.hypot(ix,iz);
  if (mag>1){ix/=mag;iz/=mag;}
  P.sprinting = (G.keys.ShiftLeft||G.keys.ShiftRight||G.keys.SprintToggle|| (G.joy.on&&Math.hypot(G.joy.x,G.joy.y)>0.92)) && iz<0.2 && !P.adsOn;
  const speed=(P.adsOn?2.6:P.sprinting?6.8:4.6);
  const fx=-Math.sin(P.yaw), fz=-Math.cos(P.yaw);
  const rx=Math.cos(P.yaw), rz=-Math.sin(P.yaw);
  P.pos.x += (fx*-iz + rx*ix)*speed*dt;
  P.pos.z += (fz*-iz + rz*ix)*speed*dt;
  collideCircle(P.pos, 0.45);
  // gravity / jump
  if (!P.onGround){ P.vy-=13*dt; P.pos.y+=P.vy*dt; if(P.pos.y<=1.65){P.pos.y=1.65;P.vy=0;P.onGround=true;} }
  else if (G.keys.Space) tryJump();
  // regen
  if (G.time-P.lastHurt>4 && P.hp<100){ P.hp=Math.min(100,P.hp+26*dt); updateHealthHUD(); }
  // ADS blend
  const wantAds = (P.adsOn && G.reloadT<=0 && G.switching<=0)?1:0;
  P.ads = lerp(P.ads, wantAds, 1-Math.pow(0.0001,dt));
  const gs=curGun(), scoped=gs.def.scoped&&P.ads>0.7;
  $('scope-overlay').classList.toggle('hidden', !scoped);
  if (gunGroup) gunGroup.visible=!scoped;
  $('crosshair').style.display=(scoped||P.dead)?'none':'block';
  // camera
  const bob = (mag>0.1&&P.onGround)?Math.sin(G.time*(P.sprinting?11:8))*0.035:0;
  G.camera.position.set(P.pos.x, P.pos.y+bob+P.ads*0.02, P.pos.z);
  let shX=(Math.random()-0.5)*G.shake*0.06, shY=(Math.random()-0.5)*G.shake*0.06;
  G.camera.rotation.set(P.pitch+shY, P.yaw+shX, 0);
  G.shake=Math.max(0,G.shake-dt*2.4);
  // fov: ads zoom
  const baseFov=70, targetFov=lerp(baseFov, gs.def.zoom, P.ads);
  if (Math.abs(G.camera.fov-targetFov)>0.2){ G.camera.fov=lerp(G.camera.fov,targetFov,1-Math.pow(0.0001,dt)); G.camera.updateProjectionMatrix(); }
  // fire
  G.fireCd-=dt; G.burstCd-=dt;
  if (G.triggerHeld) pullTrigger(); else G.triggerEdge=false;
  if (G.reloadT>0){
    G.reloadT-=dt;
    if (gunParts.reloadA>0) gunParts.reloadA-=dt/gs.def.reload;
    if (G.reloadT<=0) finishReload();
  }
  if (G.switching>0) G.switching-=dt;
  // gun anim
  if (gunGroup){
    const gp=gunParts, bp=gp.basePos;
    gp.recoil=Math.max(0,gp.recoil-dt*6);
    const sw=G.switching>0?(G.switching>0.19?1-(0.38-G.switching)/0.19:(G.switching)/0.19):0;
    const rx2=gp.recoil*0.16, rz2=gp.recoil*0.05;
    gunGroup.rotation.set(rx2+(gunParts.reloadA>0?Math.sin(gunParts.reloadA*Math.PI)*-0.7:0),0,rz2);
    const adsX=lerp(bp.x,0,P.ads), adsY=lerp(bp.y,-0.148,P.ads);
    gunGroup.position.set(adsX, adsY - Math.max(0,sw)*0.25 + (gunParts.reloadA>0?Math.sin(gunParts.reloadA*Math.PI)*-0.14:0), bp.z+gp.recoil*0.09);
    if (def_isShotgunPump()) gunParts.pump.position.z = lerp(gunParts.pump.position.z, -curGun().def.len*0.32, dt*8);
    gp.flash.material.opacity=Math.max(0,gp.flash.material.opacity-dt*14);
    G.muzzleLight.intensity=Math.max(0,G.muzzleLight.intensity-dt*160);
  }
  G.crossGap=lerp(G.crossGap,7,dt*6);
  $('crosshair').style.setProperty('--gap', G.crossGap.toFixed(1)+'px');
}
function def_isShotgunPump(){ return curGun()&&curGun().def.id==='r870'; }
function die(){
  G.player.dead=true; G.triggerHeld=false;
  setTimeout(()=>endGame(false), 1600);
}
function fmtTime(s){ const m=Math.floor(s/60), ss=Math.floor(s%60); return `${m}:${String(ss).padStart(2,'0')}`; }
function endGame(win){
  if (G.over) return;
  G.over=true; G.win=win;
  document.exitPointerLock?.();
  $('touch-ui').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('scope-overlay').classList.add('hidden');
  const t=G.time-G.startTime;
  $('end-title').textContent = win?'★ MISSION ACCOMPLISHED ★':'K.I.A. — OVERUN';
  $('end-title').style.color = win?'#8fe38f':'#ff6a4d';
  $('end-text').textContent = win
    ? `Ridge held through all ${TOTAL_WAVES} waves in ${fmtTime(t)}. The prototypes go back to the future.`
    : `You fell on wave ${G.wave}. The ridge remembers.`;
  $('end-stats').innerHTML = [
    [G.score,'SCORE'],[G.kills,'KILLS'],[G.headshots,'HEADSHOTS'],
    [Math.round(G.shots?G.hits/G.shots*100:0)+'%','ACCURACY'],[G.wave+'/'+TOTAL_WAVES,'WAVE'],[fmtTime(t),'TIME'],
  ].map(([v,l])=>`<div class="statbox"><b>${v}</b><span>${l}</span></div>`).join('');
  const prevBest=G.best;
  if (!prevBest||G.score>prevBest.score){ G.best={score:G.score,kills:G.kills,wave:G.wave};
    localStorage.setItem('pf44_best',JSON.stringify(G.best)); }
  $('end').classList.remove('hidden');
}
function winGame(){ endGame(true); }

/* ---------------- HUD ------------------------------------------------------- */
function updateHealthHUD(){ $('health-fill').style.width=G.player.hp+'%'; $('health-num').textContent='HP '+Math.ceil(G.player.hp); }
function updateAmmoHUD(){
  const gs=curGun();
  $('weapon-name').textContent=gs.def.name;
  $('ammo-mag').textContent=gs.mag; $('ammo-reserve').textContent=gs.reserve;
  $('ammo').classList.toggle('low', gs.mag<=Math.ceil(gs.def.mag*0.25));
}
function updateSlots(){
  document.querySelectorAll('#slots .slot').forEach(b=>{
    const i=+b.dataset.slot;
    b.classList.toggle('active', i===G.slot);
    b.classList.toggle('locked', i===2&&G.guns[2].locked);
    b.textContent = i===2&&G.guns[2].locked?'3 🔒':String(i+1);
  });
}
function updateScoreHUD(){ $('score').textContent=G.score.toLocaleString(); }
function updateEnemiesHUD(){
  const alive=G.enemies.filter(e=>!e.dying).length;
  $('enemies-left').textContent = G.waveState==='intermission' ? '0 — next wave in '+Math.ceil(G.waveDelay)+'s' : (alive+G.toSpawn);
}
function showHitmarker(kill, head){
  const h=$('hitmarker');
  h.classList.remove('show','kill'); void h.offsetWidth;
  if(kill) h.classList.add('kill');
  h.classList.add('show');
  if (head){ /* extra flash */ }
}
function spawnDmgNum(worldPos, amount, crit){
  const v=worldPos.clone().project(G.camera);
  if (v.z>1) return;
  const x=(v.x*0.5+0.5)*innerWidth, y=(-v.y*0.5+0.5)*innerHeight;
  const el=document.createElement('div');
  el.className='dmgnum'+(crit?' crit':''); el.textContent=amount;
  el.style.left=x+'px'; el.style.top=y+'px';
  $('dmg-numbers').appendChild(el);
  setTimeout(()=>el.remove(),800);
}
function addKillfeed(e, head, msg){
  const kf=$('killfeed');
  const el=document.createElement('div');
  if (msg){ el.className='kf'; el.textContent=msg; }
  else { el.className='kf'+(head?' headshot':'');
    el.textContent=(head?'☠ HEADSHOT ':'✖ ')+e.type.toUpperCase()+'  +'+(e.score+(head?50:0)); }
  kf.prepend(el);
  while(kf.children.length>5) kf.lastChild.remove();
  setTimeout(()=>el.remove(),4000);
}
function showBanner(title, sub){
  $('wave-banner-title').textContent=title;
  $('wave-banner-sub').textContent=sub;
  const b=$('wave-banner');
  b.classList.remove('hidden');
  clearTimeout(b._t); b._t=setTimeout(()=>b.classList.add('hidden'),3000);
}
const mm=$('minimap');
function drawMinimap(){
  if(!G.started) return;
  const ctx=mm.getContext('2d'), W=mm.width, R=W/2;
  ctx.clearRect(0,0,W,W);
  ctx.fillStyle='rgba(20,26,14,0.9)';
  ctx.beginPath(); ctx.arc(R,R,R-2,0,7); ctx.fill();
  ctx.strokeStyle='rgba(255,180,84,0.5)'; ctx.stroke();
  const toMap=(x,z)=>[R+x/95*(R-4), R+z/95*(R-4)];
  // sandbags/bunkers faint
  ctx.fillStyle='rgba(255,255,255,0.25)';
  for(const s of G.solids){ const [ax,az]=toMap(s.x0,s.z0),[bx,bz]=toMap(s.x1,s.z1);
    ctx.fillRect(Math.min(ax,bx),Math.min(az,bz),Math.abs(bx-ax)||2,Math.abs(bz-az)||2); }
  // pickups
  for(const p of G.pickups){ const [x,y]=toMap(p.m.position.x,p.m.position.z);
    ctx.fillStyle=p.kind==='ammo'?'#3aff6e':'#ff5252'; ctx.fillRect(x-2,y-2,4,4); }
  // enemies
  for(const e of G.enemies){ if(e.dying) continue;
    const [x,y]=toMap(e.mesh.position.x,e.mesh.position.z);
    ctx.fillStyle='#ff3b2a'; ctx.beginPath(); ctx.arc(x,y,3,0,7); ctx.fill(); }
  // player arrow (map up = world -Z; facing yaw=0 is up)
  ctx.save(); ctx.translate(R,R); ctx.rotate(-G.player.yaw);
  ctx.fillStyle='#ffb454'; ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(4,4); ctx.lineTo(-4,4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------------- Menus / flow ---------------------------------------------- */
function statBar(v){ return `<div class="stat"><i>${v[0]}</i><div class="bar"><b style="width:${v[1]}%"></b></div></div>`; }
function buildLoadout(){
  const grid=$('loadout-grid'); grid.innerHTML='';
  for(const w of WEAPONS){
    const el=document.createElement('div');
    el.className='wcard'+(G.loadout.primary===w.id?' sel':'');
    const pct=(v,max)=>Math.round(clamp(v/max,0.05,1)*100);
    el.innerHTML=`<h3>${w.name} <em>${w.tag}</em></h3><p>${w.desc}</p>`+
      statBar(['DMG',pct(w.dmg*(w.pellets||1),160)])+
      statBar(['RPM',pct(w.rpm,1000)])+
      statBar(['MAG',pct(w.mag,32)])+
      statBar(['RNG',pct(w.range,220)]);
    el.onclick=()=>{ G.loadout.primary=w.id;
      grid.querySelectorAll('.wcard').forEach(c=>c.classList.remove('sel')); el.classList.add('sel');
      playNoise(0.08,3000,0.3,'bandpass'); };
    grid.appendChild(el);
  }
}
function startGame(){
  audioInit(); AC?.resume?.(); ambientStart();
  resetGameState();
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (IS_TOUCH){ $('touch-ui').classList.remove('hidden');
    if (innerHeight>innerWidth) $('rotate-tip').classList.remove('hidden');
    try{ document.documentElement.requestFullscreen?.(); }catch(e){}
  } else {
    $('game').requestPointerLock?.();
  }
  G.started=true; G.paused=false; G.startTime=G.time;
  updateHealthHUD(); updateAmmoHUD(); updateSlots(); updateScoreHUD();
  showBanner('PELELIU RIDGE','1944 — HOLD THE LINE');
  G.waveState='intermission'; G.waveDelay=3;
  if (IS_TOUCH) setTimeout(()=>$('rotate-tip').classList.add('hidden'),6000);
}
function resetGameState(){
  for(const e of G.enemies) G.scene.remove(e.mesh);
  for(const p of G.pickups) G.scene.remove(p.m);
  for(const t of G.tracers) G.scene.remove(t.line);
  for(const p of G.parts) G.scene.remove(p.m);
  for(const s of G.shells) G.scene.remove(s.m);
  for(const r of G.projectiles) G.scene.remove(r.m);
  G.enemies=[];G.pickups=[];G.tracers=[];G.parts=[];G.shells=[];G.projectiles=[];
  Object.assign(G.player,{pos:new THREE.Vector3(0,1.65,26),yaw:0,pitch:0,hp:100,lastHurt:-99,
    vy:0,onGround:true,sprinting:false,ads:0,adsOn:false,dead:false});
  resetGuns(); buildViewmodel(curGun().def);
  G.wave=0;G.waveState='idle';G.toSpawn=0;G.over=false;G.win=false;
  G.score=0;G.kills=0;G.headshots=0;G.shots=0;G.hits=0;G.shake=0;
  $('killfeed').innerHTML='';$('dmg-numbers').innerHTML='';$('hitdir').innerHTML='';
  $('dmg-vignette').style.opacity=0;
  $('reload-tip').classList.add('hidden');
  $('scope-overlay').classList.add('hidden');
  G.fireCd=0; G.burstCd=0; G.burstLeft=0; G.triggerHeld=false; G.triggerEdge=false;
}
function pauseGame(on){
  if (!G.started||G.over) return;
  G.paused=on;
  $('pause').classList.toggle('hidden',!on);
  if (on){ document.exitPointerLock?.(); if(IS_TOUCH) $('touch-ui').classList.add('hidden'); }
  else if (IS_TOUCH) $('touch-ui').classList.remove('hidden');
  else $('game').requestPointerLock?.();
  G.clock.getDelta();
}
function togglePause(){ pauseGame(!G.paused); }
function toMenu(){
  G.started=false; G.paused=false;
  $('end').classList.add('hidden');$('pause').classList.add('hidden');
  $('hud').classList.add('hidden');$('touch-ui').classList.add('hidden');
  $('menu').classList.remove('hidden');
  refreshBest();
}
function refreshBest(){
  $('menu-best').textContent = G.best?`${G.best.score} pts • wave ${G.best.wave} • ${G.best.kills} kills`:'no missions yet';
}

/* ---------------- Main loop --------------------------------------------------- */
let mmT=0;
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(0.05, G.clock.getDelta());
  if (!G.started){ // menu idle camera orbit
    G.time+=dt;
    const a=G.time*0.06;
    G.camera.position.set(Math.sin(a)*40, 7, 26+Math.cos(a)*40);
    G.camera.lookAt(0,2,-20);
    for(const c of clouds){ c.position.x+=c.userData.speed*dt; if(c.position.x>280)c.position.x=-280; }
    for(const f of flags){ const p=f.geometry.attributes.position;
      for(let i=0;i<p.count;i++){ const x=p.getX(i); p.setZ(i, Math.sin(G.time*5+x*2)*0.12*(x+1.5)/3); }
      p.needsUpdate=true; }
    G.renderer.render(G.scene,G.camera);
    return;
  }
  if (G.paused){ G.renderer.render(G.scene,G.camera); return; }
  G.time+=dt;
  if (!G.over){
    updatePlayer(dt);
    updateEnemies(dt);
    updateWaves(dt);
    updatePickups(dt);
  } else {
    // death cam: sink + tilt
    G.camera.position.y=lerp(G.camera.position.y,0.5,dt*2);
    G.camera.rotation.z=lerp(G.camera.rotation.z,0.5,dt*2);
  }
  updateParts(dt); updateTracers(dt); updateShells(dt); updateProjectiles(dt);
  for(const c of clouds){ c.position.x+=c.userData.speed*dt; if(c.position.x>280)c.position.x=-280; }
  mmT-=dt; if(mmT<=0){mmT=0.15;drawMinimap();updateEnemiesHUD();}
  G.renderer.render(G.scene,G.camera);
}

/* ---------------- Boot --------------------------------------------------------- */
function wireMenus(){
  buildLoadout(); refreshBest();
  $('start-btn').onclick=startGame;
  $('retry-btn').onclick=()=>{ $('end').classList.add('hidden'); resetGameState();
    $('hud').classList.remove('hidden'); if(IS_TOUCH)$('touch-ui').classList.remove('hidden');
    G.started=true;G.paused=false;G.startTime=G.time;
    updateHealthHUD();updateAmmoHUD();updateSlots();updateScoreHUD();
    G.waveState='intermission';G.waveDelay=3; };
  $('end-menu-btn').onclick=toMenu;
  $('resume-btn').onclick=()=>pauseGame(false);
  $('quit-btn').onclick=toMenu;
  $('help-btn').onclick=()=>$('help-panel').classList.toggle('hidden');
  const s1=$('opt-sens'),s2=$('opt-sens2');
  s1.oninput=()=>{G.sens=+s1.value;$('opt-sens-v').textContent=s1.value;s2.value=s1.value;};
  s2.oninput=()=>{G.sens=+s2.value;s1.value=s2.value;$('opt-sens-v').textContent=s2.value;};
  $('opt-quality').onchange=e=>{ G.quality=e.target.value;
    const q=qualitySettings();
    G.renderer.setPixelRatio(q==='low'?Math.min(devicePixelRatio,1.25):Math.min(devicePixelRatio,2));
    G.renderer.shadowMap.enabled=(q==='high');
  };
  $('opt-sound').onchange=e=>{ G.sound=e.target.checked; };
  $('loading').classList.add('hidden');
}
try{
  $('loading').classList.remove('hidden');
  initThree();
  buildWorld();
  resetGuns();
  buildViewmodel(curGun().def);
  initInput();
  wireMenus();
  updateSlots();
  animate();
}catch(err){
  $('loading').innerHTML='<div>⚠ WebGL unavailable: '+err.message+'</div>';
  console.error(err);
}
// hidden handle for automated smoke-testing (no UI effect)
window.__pf44 = { G, WEAPONS, spawnEnemy, damageEnemy, killEnemy, startWave, switchSlot, startReload };
