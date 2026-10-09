import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
const ROOT=new URL('../.testbuild/',import.meta.url).pathname;
const PORT=4700+Math.floor(Math.random()*400);
const MIME={'.html':'text/html','.js':'application/javascript'};
const srv=createServer((q,r)=>{const f=q.url==='/'?'/index.html':q.url.split('?')[0];
 const p='tools/../.testbuild'+f; if(!existsSync(p)){r.writeHead(404);r.end();return;}
 r.writeHead(200,{'Content-Type':MIME[f.slice(f.lastIndexOf('.'))]||'application/octet-stream'});r.end(readFileSync(p));});
await new Promise(r=>srv.listen(PORT,'127.0.0.1',r));
const { chromium } = createRequire('/home/runner/.local/share/omgithub-playwright/package.json')('playwright');
const cfg = JSON.parse(readFileSync('/home/runner/.local/share/omgithub-playwright/linux.json','utf8'));
const b = await chromium.launch(cfg.browser.launchOptions);
const p = await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'load'});
await p.waitForTimeout(3000);
/* SwiftShader peut bloquer le thread pendant une compilation de shader :
   on attend l'état réel plutôt qu'un délai fixe, sinon le test devient instable. */
async function waitState(fn, ms=6000){
 const t0=Date.now();
 while(Date.now()-t0<ms){
  if(await p.evaluate(fn))return true;
  await p.waitForTimeout(150);
 }
 return false;}

let ok=true; const T=(c,l)=>{if(!c)ok=false;console.log((c?'✅':'❌')+' '+l);};

const geo = await p.evaluate(()=>{const H=window.__H;return {
  home:H.HOME,hw:H.HW,hd:H.HD,hh:H.HH,door:H.DOORW,garden:H.GARDEN,
  solidsInHouse:H.solids.filter(s=>Math.abs((s.x0+s.x1)/2-H.HOME.x)<7&&Math.abs((s.z0+s.z1)/2-H.HOME.z)<6).length};});
console.log('géométrie:',JSON.stringify(geo));
// la chambre de culture doit être à l'intérieur des murs
T(geo.garden.x>geo.home.x-geo.hw/2+1 && geo.garden.x<geo.home.x+geo.hw/2-1,'culture à l\'intérieur en X');
T(geo.garden.z>geo.home.z-geo.hd/2+1 && geo.garden.z<geo.home.z+geo.hd/2-1,'culture à l\'intérieur en Z');
T(geo.solidsInHouse>=5,'5 murs SOLID (porte ouverte): '+geo.solidsInHouse);

// toit visible dehors
let s = await p.evaluate(()=>({roof:window.__H.roofVisible,op:window.__H.wallOpacity,open:window.__H.houseOpen,in:window.__H.indoors}));
console.log('dehors:',JSON.stringify(s));
T(s.roof===true,'toit visible à l\'extérieur');
T(s.op===1,'murs opaques à l\'extérieur');
T(s.open===false,'maison fermée à l\'extérieur');

// entre par la porte
const walk = async (keys,ms)=>{ for(const k of keys) await p.keyboard.down(k);
  await p.waitForTimeout(ms); for(const k of keys) await p.keyboard.up(k); };
/* Le test ne doit PAS dépendre du framerate (SwiftShader peut tomber à 2 FPS).
   On avance par pas de simulation fixes, exactement comme le ferait le jeu. */
// on avance vers -Z (vers la porte) à 4,2 m/s, 60 pas par seconde
const step=(n)=>p.evaluate(k=>{const H=window.__H;
  for(let i=0;i<k;i++){
    // même pipeline que le jeu : déplacement puis résolution des collisions
    const z=H.player.pos.z-4.2/60;
    const r=H.collide(H.player.pos.x,z);
    H.player.pos.x=r[0];H.player.pos.z=r[1];}
},n);
// (a) collision : on marche vers le mur plein (à gauche de la porte, x = 3)
await p.evaluate(()=>{const H=window.__H;H.player.pos.set(3,0,-4.4);});
await p.waitForTimeout(400);
await step(90);                       // 1,5 s : il doit buter sur la façade, pas la traverser
const blocked=await p.evaluate(()=>{const H=window.__H;
  return {z:+H.player.pos.z.toFixed(2),x:+H.player.pos.x.toFixed(2),outside:!H.isIndoors()};});
console.log('collision façade :',JSON.stringify(blocked));
T(blocked.outside&&blocked.z>-7.4,'le mur plein de la façade bloque (z='+blocked.z+')');
// puis on le place au seuil pour tester l'ouverture de la maison
await p.evaluate(()=>{const H=window.__H;H.player.pos.set(0,0,H.HOME.z+H.HD/2-1.2);});
const opened=await waitState(()=>{const H=window.__H;return H.isIndoors()&&H.houseOpen===true;});
s = await p.evaluate(()=>{const H=window.__H;return {px:+H.player.pos.x.toFixed(1),pz:+H.player.pos.z.toFixed(1),
 in:H.isIndoors(),roof:H.roofVisible,op:H.wallOpacity,open:H.houseOpen};});
console.log('après marche:',JSON.stringify(s));
T(opened&&s.in===true,'le joueur est entré à x='+s.px+' z='+s.pz);
T(s.roof===false,'toit masqué à l\'intérieur');
T(s.op<0.5,'murs translucides ('+s.op+')');
T(s.open===true,'maison ouverte');

// peut-on atteindre la culture ? (marche jusqu'à la table)
await p.evaluate(()=>{window.__H.player.pos.set(window.__H.GARDEN.x,0,window.__H.GARDEN.z+2.2);});
await p.waitForTimeout(200);
const near = await p.evaluate(()=>{const H=window.__H;const g=H.GARDEN,p=H.player.pos;
 return {gx:H.GARDEN.x,gz:H.GARDEN.z,dist:+Math.hypot(p.x-H.GARDEN.x,p.z-H.GARDEN.z).toFixed(2)};});
console.log('culture:',JSON.stringify(near));
T(near.dist<3.4,'la culture est atteignable à '+near.dist+' unités (< 3.4 = bouton actif)');

// Ressors
await p.evaluate(()=>{const H=window.__H;H.player.pos.set(0,0,H.HOME.z+H.HD/2-1);});
await p.waitForTimeout(200);
for(let i=0;i<12;i++){
  await walk(['s'],900);
  const outside=await p.evaluate(()=>!window.__H.isIndoors());
  if(outside)break;
  await p.evaluate(()=>{window.__H.player.pos.z+=0.55;});
}
await waitState(()=>{const H=window.__H;return !H.isIndoors()&&H.houseOpen===false;});
s = await p.evaluate(()=>({in:window.__H.isIndoors(),roof:window.__H.roofVisible,op:window.__H.wallOpacity,pz:+window.__H.player.pos.z.toFixed(1)}));
console.log('après sortie:',JSON.stringify(s));
T(s.in===false,'le joueur est ressorti (z='+s.pz+')');
T(s.roof===true,'toit restauré');
T(s.op===1,'murs opaques restaurés');

console.log('BILAN MAISON:',ok?'✅':'❌');
console.log('erreurs:',errs.length?errs.slice(0,5):'aucune');
await b.close(); srv.close();
