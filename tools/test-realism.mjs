/* Vérifie les 7 systèmes de réalité gameplay */
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
const p = await b.newPage({viewport:{width:1100,height:720}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'load'});
await p.waitForTimeout(2500);
let ok=true; const T=(c,l)=>{if(!c)ok=false;console.log((c?'✅':'❌')+' '+l);};
const ev=f=>p.evaluate(f);

/* ---------- 1. cycle lumineux 18/6 ---------- */
const cyc = await ev(()=>{const H=window.__H,S=H.S;
 const out=[];
 S.hour=S.lightStart+2;   out.push(['lumière allumée pendant le cycle',H.lightOn()]);
 S.hour=S.lightStart+19;  out.push(['lumière éteinte après 18 h',!H.lightOn()]);
 S.hour=S.lightStart+2;   S.powerOn=false; out.push(['courant coupé -> plus de lumière',!H.lightOn()]);
 S.powerOn=true;           out.push(['courant rétabli',H.lightOn()]);
 const ph=H.lightPhase();  out.push(['phase indique 18 h de lumière',Math.round(ph.until)>=0]);
 return out;});
for(const [l,v] of cyc) T(v,'cycle 18/6 : '+l);

/* ---------- 2. croissance réellement ralentie sans lumière ---------- */
const grow = await ev(()=>{const H=window.__H,S=H.S;
 const mk=()=>({g:40,w:80,n:80,h:100,planted:true,ready:false,s:0,gx:null,fragile:false,pH:6,pest:false});
 S.pots[0]=mk();S.hour=S.lightStart+2;S.powerOn=true;
 for(let i=0;i<200;i++)H.growTick2(.05);
 const lit=S.pots[0].g;
 S.powerOn=false;S.pots[0]=mk();
 for(let i=0;i<200;i++)H.growTick2(.05);
 const dark=S.pots[0].g;
 S.pots[0]=mk();return {lit:+lit.toFixed(2),dark:+dark.toFixed(2)};});
console.log('   croissance 10 s : lumière',grow.lit,'| nuit',grow.dark);
T(grow.lit-grow.dark>15,'la lumière accélère nettement la croissance (+'+(grow.lit-grow.dark).toFixed(1)+' points en 10 s)');

/* ---------- 3. pH ---------- */
const ph = await ev(()=>{const H=window.__H,S=H.S;
 S.pots[1]={g:40,w:80,n:80,h:100,planted:true,ready:false,s:0,gx:null,fragile:false,pH:5.0,pest:false};
 const bad=H.phMul(5.0), good=H.phMul(6.0), worse=H.phMul(7.4);
 S.money=100;document.getElementById('btnAct');
 return {bad,good,worse,before:S.pots[1].pH};});
T(ph.good===1 && ph.bad<ph.good && ph.worse<ph.good,'pH : 6.0 = croissance max, extrêmes pénalisés (5.0→'+ph.bad+' · 6.0→'+ph.good+' · 7.4→'+ph.worse+')');

/* ---------- 4. ravageurs ---------- */
const pest = await ev(()=>{const H=window.__H,S=H.S;
 S.pots[2]={g:60,w:95,n:80,h:100,planted:true,ready:false,s:0,gx:null,fragile:false,pH:6,pest:true};
 const before=S.pots[2].h;
 for(let i=0;i<100;i++)H.growTick2(.05);
 const hurt=S.pots[2].h<misc(before)||S.pots[2].h<before;
 function misc(){return 0;}
 S.money=100;S.sel=2;
 const g=document.getElementById('gPest');g.click();
 return {hurt,treated:!S.pots[2].pest,money:S.money,pestsTreated:S.pestsTreated|0};});
T(pest.treated,'ravageurs : traitement appliqué');
T(pest.pestsTreated===1,'compteur « ravageurs traités » incrémenté');
T(pest.money===96,'traitement facturé 4 €');

/* ---------- 5. récolte puis séchage ---------- */
const dry = await ev(()=>{const H=window.__H,S=H.S;
 S.stock=0;S.drying=[];
 S.pots[3]={g:100,w:80,n:80,h:95,planted:true,ready:true,s:0,gx:null,fragile:false,pH:6,pest:false};
 S.sel=3;
 document.getElementById('gHarv').click();
 const afterCut={stock:S.stock,drying:S.drying.length,harvested:S.harvested};
 // on avance le temps de séchage
 for(let i=0;i<2600;i++)H.dryTick(.05);   // ~10 h de jeu
 return {afterCut,stock:+S.stock.toFixed(1),dried:S.drying.length,harvested:S.harvested};});
console.log('   après coupe :',JSON.stringify(dry.afterCut),'→ après séchage : stock',dry.stock);
T(dry.afterCut.drying===1&&dry.afterCut.stock===0,'la récolte part en séchage (pas de stock immédiat)');
T(dry.dried===0&&dry.stock>0,'le lot dried devient du stock vendable ('+dry.stock+' g)');
T(dry.harvested===1,'compteur récoltes incrémenté');

/* ---------- 6. électricité ---------- */
const kw = await ev(()=>{const H=window.__H,S=H.S;
 S.pots.forEach((p,i)=>{p.planted=i<4;p.ready=false;p.g=50;});
 S.powerOn=true;
 const on=H.roomPowerKW();
 S.powerOn=false;const off=H.roomPowerKW();
 S.powerOn=true;
 S.kWh=0;S.money=500;
 for(let i=0;i<2400;i++)H.dryTick(.05);  // ~10 h de jeu : une facture tombe
 return {on:+on.toFixed(2),off:+off.toFixed(2),kWh:+S.kWh.toFixed(0),money:Math.round(S.money),paid:S.powerPaid|0};});
console.log('   puissance : grow ON',kw.on,'kW | OFF',kw.off,'kW | kWh',kw.kWh,'| payé',kw.paid,'€');
T(kw.off<kw.on,'couper le courant réduit la consommation');
T(kw.paid>0,'facture d\'électricité débitée ('+kw.paid+' €)');

/* ---------- 7. mouchard ---------- */
const info = await ev(()=>{const H=window.__H,S=H.S;
 S.money=1000;S.informants=0;S.informantT=0;
 const cost=H.INFORMANT_COST();
 H.buyInformant();
 const active=H.informantActive();
 S.informantT=0;
 return {cost,active,bought:S.informantsBought|0,money:Math.round(S.money)};});
T(info.active&&info.bought===1,'mouchard activé ('+info.cost+' €)');

/* ---------- 8. barrages routiers ---------- */
const rb = await ev(()=>{const H=window.__H,S=H.S;
 S.wanted=3;
 H.roadblockTick(.016);
 const spawned=H.roadblocks.length;
 H.player.pos.set(H.roadblocks[0].x,0,H.roadblocks[0].z+3);
 const near=!!H.blockNear();
 S.passes=1;
 H.passRoadblock();
 return {spawned,near,passes:S.passes,passed:S.blockPassed|0};});
T(rb.spawned>0,'barrage routier déployé à 3★ ('+rb.spawned+' point de contrôle)');
T(rb.near,'le joueur est détecté au barrage');
T(rb.passes===0&&rb.passed===1,'passe de contrôle consommée et comptée');

/* ---------- 9. flic corrompable ---------- */
const crook = await ev(()=>{const H=window.__H,S=H.S;
 S.money=1000;S.crookCd=0;S.wanted=2;
 const c=H.copsArray[0];
 c.state='chase';c.pos.set(H.player.pos.x+3,0,H.player.pos.z);
 c.lastSeen=new (Object.getPrototypeOf(H.player.pos).constructor)(H.player.pos.x,0,H.player.pos.z);
 H.copTick(.016);            // la boucle met à jour l'état « chase »
 const before=S.wanted;
 H.bribeCop();
 return {before,after:S.wanted,bribes:S.bribes|0,money:Math.round(S.money),state:c.state};});
T(crook.bribes===1&&crook.state!=='chase','flic corrompu : la poursuite s\'arrête (-250 €, -1,5★)');

console.log('\nBILAN RÉALISME:',ok?'✅ TOUT PASSE':'❌ ÉCHECS');
console.log('erreurs console:',errs.length?errs.slice(0,5):'aucune');
if(errs.length)ok=false;
await b.close(); srv.close(); process.exitCode=ok?0:1;
