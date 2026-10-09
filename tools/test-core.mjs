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
let ok=true; const T=(c,l)=>{if(!c)ok=false;console.log((c?'✅':'❌')+' '+l);};

const p = await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'load'});
await p.waitForTimeout(2500);

/* ---- 1. le bouton d'interaction de la culture apparaît à l'intérieur ---- */
await p.evaluate(()=>{const H=window.__H;H.player.pos.set(H.GARDEN.x+1.5,0,H.GARDEN.z+1.5);H.S.tuto=99;document.getElementById('tuto').classList.remove('open');});
await p.waitForTimeout(1200);
let ui = await p.evaluate(()=>{const b=document.getElementById('btnAct');
  return {vis:getComputedStyle(b).display,txt:b.textContent,prompt:document.getElementById('prompt').textContent};});
console.log('bouton action:',JSON.stringify(ui));
T(ui.vis!=='none'&&/Culture/.test(ui.txt),'bouton « Culture » actif à l\'intérieur');
T(/chambre de culture/i.test(ui.prompt),'prompt « chambre de culture »');

/* ---- 2. la feuille de culture s'ouvre et toute la boucle fonctionne ---- */
await p.click('#btnAct');
await p.waitForTimeout(400);
T(await p.evaluate(()=>document.getElementById('growSheet').classList.contains('open')),'growSheet ouvert');
T(await p.evaluate(()=>document.querySelectorAll('#potGrid .pot').length)===6,'6 pots affichés');
await p.click('#growClose'); await p.waitForTimeout(200);

//Writable: on vide un pot et on replante
const before = await p.evaluate(()=>{const S=window.__H.S;
  S.pots[1]={g:0,w:60,n:60,h:100,planted:false,ready:false,s:0,gx:null,fragile:false};
  S.sel=1;S.seeds.classique=Math.max(1,S.seeds.classique|0);
  return {money:S.money,seeds:S.seeds.classique,grown:S.grown};});
await p.click('#btnAct'); await p.waitForTimeout(300);
await p.click('#gPlant'); await p.waitForTimeout(300);
let after = await p.evaluate(()=>{const S=window.__H.S,p=S.pots[1];
  return {planted:p.planted,money:S.money,seeds:S.seeds.classique,grown:S.grown};});
console.log('plantation:',JSON.stringify({before,after}));
T(after.planted===true,'graine plantée dans le pot 2');
T(after.seeds===before.seeds-1,'graine consommée');
T(after.money===before.money-3,'-3 € à la plantation');
T(after.grown===before.grown+1,'compteur « planté » incrémenté');

// Arrosage + engrais
await p.click('#gWater'); await p.waitForTimeout(200);
const w = await p.evaluate(()=>window.__H.S.pots[1].w);
T(w>60,'arrosage : humidité '+w);
await p.click('#gFeed'); await p.waitForTimeout(200);
const n = await p.evaluate(()=>window.__H.S.pots[1].n);
T(n>60,'engrais : nutrition '+n);

// Récolte : le plant part en séchage (nouvelle mécanique), puis devient vendable
await p.evaluate(()=>{const S=window.__H.S;S.pots[1].g=99.9;S.pots[1].w=90;S.pots[1].n=90;S.hour=S.lightStart+2;});
await p.waitForTimeout(2500);
const st0 = await p.evaluate(()=>{const S=window.__H.S;return {stock:S.stock,harv:S.harvested,dry:S.drying.length};});
await p.click('#gHarv'); await p.waitForTimeout(400);
const st1 = await p.evaluate(()=>{const S=window.__H.S;return {stock:S.stock,harv:S.harvested,dry:S.drying.length};});
console.log('récolte:',JSON.stringify({avant:st0,apres:st1}));
T(st1.harv===st0.harv+1,'compteur récoltes incrémenté');
T(st1.dry===st0.dry+1&&st1.stock===st0.stock,'la coupe lance le séchage (stock inchangé)');
// on fait passer le temps de séchage
const dried = await p.evaluate(()=>{const H=window.__H,S=H.S;
 const before=S.stock;
 for(let i=0;i<2600;i++)H.dryTick(.05);
 return {before,after:+S.stock.toFixed(1),left:S.drying.length};});
console.log('séchage:',JSON.stringify(dried));
T(dried.left===0&&dried.after>dried.before,'le lot séché rejoint le stock ('+dried.after+' g)');

/* ---- 3. sauvegarde / rechargement ---- */
await p.evaluate(()=>window.__H.save());
const saved = await p.evaluate(()=>{const S=window.__H.S;
  return {money:Math.round(S.money),stock:Math.round(S.stock*10)/10,harv:S.harvested,pot1:S.pots[1].planted};});
await p.evaluate(()=>{window.__H.S.money=-999;window.__H.S.stock=0;window.__H.S.harvested=0;});
await p.reload({waitUntil:'load'});
await p.waitForTimeout(2500);
const loaded = await p.evaluate(()=>{const S=window.__H.S;
  return {money:Math.round(S.money),stock:Math.round(S.stock*10)/10,harv:S.harvested,pot1:S.pots[1].planted};});
console.log('save/load:',JSON.stringify({saved,loaded}));
T(JSON.stringify(saved)===JSON.stringify(loaded),'état restauré à l\'identique après rechargement');
T(loaded.money>0,'aucune perte de données (argent '+loaded.money+' €)');

/* ---- 4. la maison reste solide après un aller-retour ---- */
await p.evaluate(()=>{const H=window.__H;H.player.pos.set(0,0,-8);});
await p.waitForTimeout(1200);
const house = await p.evaluate(()=>({in:window.__H.isIndoors(),roof:window.__H.roofVisible,op:window.__H.wallOpacity}));
T(house.in&&house.roof===false&&house.op<0.5,'maison ouverte (toit '+house.roof+', murs '+house.op+')');
await p.evaluate(()=>{const H=window.__H;H.player.pos.set(0,0,0);});
await p.waitForTimeout(1200);
const out = await p.evaluate(()=>({in:window.__H.isIndoors(),roof:window.__H.roofVisible,op:window.__H.wallOpacity}));
T(!out.in&&out.roof===true&&out.op===1,'maison refermée dehors');

console.log('\nBILAN:',ok?'✅ TOUT PASSE':'❌ ÉCHECS');
console.log('erreurs console:',errs.length?errs.slice(0,6):'aucune');
if(errs.length)ok=false;
await b.close(); srv.close();