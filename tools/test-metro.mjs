/* Test du métro : les stations existent, le trajet coûte, se paie et respecte
   les verrous de réputation. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 6900 + Math.floor(Math.random() * 300);
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
const p = await b.newPage({ viewport: { width: 430, height: 932 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
await p.waitForTimeout(2500);

const out = await p.evaluate(async () => {
  const H = window.__H, log = [];
  const T = (c, l, d) => log.push((c ? '✅' : '❌') + ' ' + l + (d ? ' — ' + d : ''));
  const settle = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };

  T(H.STATIONS.length === 3, 'trois stations de métro',
    H.STATIONS.map(s => s.nom).join(', '));
  T(H.STATIONS.every(s => s.mesh && s.lamp), 'chaque station a son abri et son éclairage');

  // --- on arrive sur la station du Bloc ---
  const bloc = H.STATIONS[0];
  H.player.pos.set(bloc.x, 0, bloc.z + 4);
  const seen = await settle(() => H.nearStation() === bloc);
  T(seen, 'la station du Bloc est détectée');

  H.S.money = 500; H.S.rep = 10;
  H.openMetro();
  T(document.getElementById('metroSheet').classList.contains('open'), 'la feuille Métro s\'ouvre');
  const btns = document.querySelectorAll('#metroList [data-m]');
  T(btns.length === 3, 'les trois destinations sont listées');

  // --- trajet vers le Marché ---
  const px = H.player.pos.x, pz = H.player.pos.z;
  const hour0 = H.S.hour, money0 = H.S.money;
  document.querySelector('#metroList [data-m="marche"]').click();
  await new Promise(r => setTimeout(r, 250));
  T(H.S.money === money0 - 40, 'le trajet coûte 40 €', money0 + ' -> ' + H.S.money);
  T(Math.abs(H.S.hour - hour0) > 0.001, 'l\'horloge avance', hour0.toFixed(2) + ' -> ' + H.S.hour.toFixed(2));
  const quai = H.STATIONS[1];
  T(Math.abs(H.player.pos.x - quai.x) < 6 && Math.abs(H.player.pos.z - quai.z) < 8,
    'on arrive à la bonne station',
    'pos=' + H.player.pos.x.toFixed(1) + ',' + H.player.pos.z.toFixed(1) +
    ' station=' + quai.x + ',' + quai.z);
  T(Math.hypot(H.player.pos.x - px, H.player.pos.z - pz) > 100, 'ça traverse vraiment la ville');
  T(!document.getElementById('metroSheet').classList.contains('open'), 'la feuille se referme');

  // --- verrou de réputation ---
  H.S.rep = 0; H.S.money = 500;
  H.player.pos.set(bloc.x, 0, bloc.z + 4);
  await settle(() => H.nearStation() === bloc);
  H.openMetro();
  const quaisBtn = document.querySelector('#metroList [data-m="quais"]');
  T(quaisBtn.textContent.includes('40') === false || /🔒/.test(quaisBtn.parentElement.innerHTML),
    'les Quais sont verrouillés sans réputation', quaisBtn.parentElement.innerText.replace(/\s+/g, ' ').slice(0, 60));
  const money1 = H.S.money;
  quaisBtn.click();
  await new Promise(r => setTimeout(r, 200));
  T(H.S.money === money1, 'un trajet vers un quartier verrouillé est refusé');

  // --- sans argent ---
  H.S.rep = 10; H.S.money = 5;
  H.renderMetro();
  document.querySelector('#metroList [data-m="marche"]').click();
  await new Promise(r => setTimeout(r, 150));
  T(H.S.money === 5, 'sans argent on ne voyage pas');
  document.getElementById('metroClose').click();

  return log;
});

const bad = out.filter(l => l.startsWith('❌'));
console.log(out.join('\n'));
console.log('\nBILAN MÉTRO:', bad.length ? '❌ ' + bad.length + ' ÉCHEC(S)' : '✅ TOUT PASSE');
console.log('erreurs console:', errs.length ? errs.slice(0, 5) : 'aucune');
await b.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);
