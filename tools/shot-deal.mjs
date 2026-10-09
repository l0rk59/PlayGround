/* Capture visuelle de la feuille de négociation, dans 3 humeurs,
   sans toasts ni tutoriel pour qu'on voie vraiment l'UI. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 5300 + Math.floor(Math.random() * 300);
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

const shots = [
  { name: 'nego-1-calme', mood: 'open', level: 0, bluffs: 0 },
  { name: 'nego-2-tendu', mood: 'tens', level: 2, bluffs: 2 },
  { name: 'nego-3-froid', mood: 'cold', level: 3, bluffs: 3 },
  { name: 'nego-4-colere', mood: 'mad', level: 1, bluffs: 1 },
];

for (const s of shots) {
  await p.evaluate(({ mood, level, bluffs }) => {
    const H = window.__H;
    // on purge l'UI parasite : toasts, tutoriel, onboarding
    document.getElementById('toasts').innerHTML = '';
    // on masque sans supprimer : le code continue de viser ces noeuds
    const hide = id => { const n = document.getElementById(id); if (n) { n.innerHTML = ''; n.style.display = 'none'; } };
    ['tuto', 'toasts'].forEach(hide);
    const c = H.clients[0];
    H.S.stock = 60; H.S.money = 4000; H.S.wanted = 0;
    c.patMax = 100;
    // patience calée sur l'humeur voulue
    c.pat = { open: 100, warm: 100, tens: 60, cold: 35, mad: 8 }[mood];
    H.openSell(c);
    if (bluffs > 0) {
      H.startBluff();
      c.patMax = 100;
      c.pat = { open: 100, warm: 100, tens: 60, cold: 35, mad: 8 }[mood];
      H.bluff.level = level;
      H.bluff.round = Math.min(bluffs, 2);
      H.bluff.mult = Math.pow(1.07, level);
      H.refreshSell();
    }
    hide('toasts');
  }, s);
  await p.waitForTimeout(450);
  await p.screenshot({ path: '/tmp/' + s.name + '.png' });
  const mood = await p.evaluate(() => window.__H.moodInfo(window.__H.sellTarget).nom);
  console.log(s.name + ' → humeur affichée : ' + mood);
}

// vue rapprochée de la boîte d'humeur seule, pour juger la lisibilité
const box = await p.$('#bluffBox');
if (box) await box.screenshot({ path: '/tmp/nego-box.png' });

await b.close(); srv.close();
console.log('captures écrites');