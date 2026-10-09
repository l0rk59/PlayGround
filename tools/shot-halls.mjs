/* Captures des deux intérieurs : dehors puis dedans. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 5900 + Math.floor(Math.random() * 300);
const MIME = { '.html': 'text/html', '.js': 'application/javascript' };
const srv = createServer((q, r) => {
  const f = q.url === '/' ? '/index.html' : q.url.split('?')[0];
  const p = 'tools/../.testbuild' + f;
  if (!existsSync(p)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream' });
  r.end(readFileSync(p));
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

const { chromium } = createRequire('/home/runner/.local/share/omgithub-playwright/package.json')('playwright');
const cfg = JSON.parse(readFileSync('/home/runner/.local/share/omgithub-playwright/linux.json', 'utf8'));
const b = await chromium.launch(cfg.browser.launchOptions);
const p = await b.newPage({ viewport: { width: 430, height: 932, deviceScaleFactor: 2 } });
await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
await p.waitForTimeout(2500);

const clean = `['tuto','toasts','helpCard'].forEach(id=>{
  const n=document.getElementById(id);if(n){n.innerHTML='';n.style.display='none';}});`;

const shots = [
  { name: 'hall-marche-porte', hall: 'hallMarket', dz: 20, yaw: Math.PI },
  { name: 'hall-marche-dedans', hall: 'hallMarket', dz: 3, yaw: Math.PI },
  { name: 'hall-marche-comptoir', hall: 'hallMarket', dz: 6, yaw: Math.PI },
  { name: 'hall-douane-porte', hall: 'hallDouane', dz: 20, yaw: Math.PI },
  { name: 'hall-douane-dedans', hall: 'hallDouane', dz: 3, yaw: Math.PI },
  { name: 'hall-douane-comptoir', hall: 'hallDouane', dz: 6, yaw: Math.PI },
];

for (const s of shots) {
  const info = await p.evaluate(({ hall, dz, yaw, clean }) => {
    const H = window.__H;
    ['tuto','toasts','helpCard'].forEach(id=>{const n=document.getElementById(id);if(n){n.innerHTML='';n.style.display='none';}});
    H.S.rep = 8;
    H.S.hour = 13;
    H.setWeather('clear');
    const h = H[hall];
    H.player.pos.set(h.x, 0, h.z + dz);
    // camYaw=0 place la caméra au nord du joueur (elle regarde vers +z) : PI la met au sud
    H.setCamYaw(yaw === undefined ? Math.PI : yaw);
    H.S.hour = 13;
    H.applySky();
    return { sign: h.o.sign, inside: dz < h.d / 2 };
  }, { hall: s.hall, dz: s.dz, yaw: s.yaw, clean });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: '/tmp/' + s.name + '.png' });
  console.log(s.name + ' (' + info.sign + ')');
}

// les deux feuilles de boutique
for (const [name, fn] of [['sheet-marche', 'openMarche'], ['sheet-douane', 'openDouane']]) {
  await p.evaluate(({ fn, clean }) => {
    const H = window.__H;
    ['tuto','toasts','helpCard'].forEach(id=>{const n=document.getElementById(id);if(n){n.innerHTML='';n.style.display='none';}});
    H.S.money = 5000; H.S.rep = 8;
    H[fn]();
  }, { fn, clean });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/' + name + '.png' });
  console.log(name);
}

await b.close(); srv.close();
console.log('captures écrites');