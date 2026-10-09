/* Test des véhicules : achat, carburant, coffre, bruit, conduite. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 6500 + Math.floor(Math.random() * 300);
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
  const wait = ms => new Promise(r => setTimeout(r, ms));

  T(H.vehList().length === 4, '4 véhicules au catalogue',
    H.vehList().map(v => v.nom).join(', '));
  T(H.vehOwned('velo'), 'le vélo est toujours possédé');
  T(!H.vehOwned('citad'), 'les autres ne le sont pas au départ');

  // --- la feuille du garage affiche la section véhicules ---
  H.S.money = 99999;
  H.renderSafe(); await wait(150);
  const box = document.getElementById('vehBox');
  T(!!box && box.children.length === 4, 'la concession liste le catalogue',
    box ? box.children.length + ' lignes' : 'absente');

  // --- achat ---
  const money0 = H.S.money;
  const buyBtn = [...box.querySelectorAll('button')].find(b => b.textContent.includes('4200'));
  T(!!buyBtn, 'le fourgon a un bouton d\'achat');
  buyBtn.click(); await wait(150);
  T(H.vehOwned('fourgon'), 'le fourgon est acheté');
  T(H.S.money === money0 - 4200, 'le prix est débité', money0 + ' -> ' + H.S.money);
  T(H.S.veh.fourgon.fuel === 140, 'il arrive avec le plein',
    H.S.veh.fourgon.fuel + '/' + 140);

  // --- le coffre augmente la planque ---
  const cap0 = H.stashCap();
  H.mountVeh('fourgon'); await wait(120);
  T(H.player.riding === true && H.player.mount === 'fourgon', 'on monte dans le fourgon');
  const cap1 = H.stashCap();
  T(cap1 > cap0, 'le coffre ajoute de la place à la planque', cap0 + ' -> ' + cap1);
  T(H.trunkBonus() === 30, 'le coffre vaut bien +30 g', String(H.trunkBonus()));

  // --- le bruit augmente la portée des flics ---
  const noisy4 = H.rideNoise();                       // fourgon
  H.S.veh.citad = { own: true, fuel: 90, x: 20, z: 0, ry: 0 };
  H.player.mount = 'citad';
  const noisy2 = H.rideNoise();                       // citadine
  H.S.veh.scoot = { own: true, fuel: 60, x: 22, z: 0, ry: 0 };
  H.player.mount = 'scoot';
  const noisy1 = H.rideNoise();                       // scooter
  T(noisy4 > noisy2 && noisy2 > noisy1,
    'le bruit suit le véhicule : scooter < citadine < fourgon',
    noisy1.toFixed(2) + ' < ' + noisy2.toFixed(2) + ' < ' + noisy4.toFixed(2));
  H.player.mount = 'velo'; H.player.riding = false;
  T(H.rideNoise() === 1, 'à pied, le bruit redevient normal');

  // --- carburant ---
  H.player.riding = true; H.player.mount = 'fourgon';
  const f0 = H.S.veh.fourgon.fuel;
  H.vehFuelTick(100);                       // 100 unités parcourues
  T(H.S.veh.fourgon.fuel < f0, 'rouler consomme du carburant', f0 + ' -> ' + H.S.veh.fourgon.fuel.toFixed(1));
  H.player.riding = false; H.player.mount = null;   // on redescend d'abord
  H.S.veh.fourgon.fuel = 1;                 // plus qu'une lichette
  H.player.pos.set(0, 0, 20); H.S.veh.fourgon.x = 0; H.S.veh.fourgon.z = 22;
  await wait(250);
  T(H.nearVehData() && H.nearVehData().id === 'fourgon', 'le véhicule garé le plus proche est détecté',
    H.nearVehData() ? H.nearVehData().nom : 'aucun');
  H.mountVeh('fourgon');
  T(H.player.riding === false, 'on ne monte pas avec un réservoir vide',
    'réservoir=' + (H.vehFuel('fourgon') * 100).toFixed(1) + '%');

  // --- descente : le véhicule est garé, pas planté sur le joueur ---
  H.S.veh.fourgon.fuel = 60;
  H.mountVeh('fourgon'); await wait(100);
  T(H.player.riding === true, 'on remonte');
  H.player.pos.set(0, 0, 20);
  H.dismount(); await wait(150);
  T(H.player.riding === false && H.player.mount === null, 'on redescend');
  const d = Math.hypot(H.S.veh.fourgon.x - H.player.pos.x, H.S.veh.fourgon.z - H.player.pos.z);
  T(d > 0.5, 'le fourgon est garé à côté, pas dessus', 'distance ' + d.toFixed(1));

  // --- sauvegarde ---
  H.save();
  const raw = JSON.parse(localStorage.getItem('hoodgrow_v3'));
  T(raw.veh && raw.veh.fourgon && raw.veh.fourgon.own, 'les véhicules sont sauvegardés');
  T(raw.veh.fourgon.fuel === H.S.veh.fourgon.fuel, 'le carburant aussi');

  // --- la feuille du garage reflète l'état ---
  H.renderSafe(); await wait(150);
  const txt = box.innerHTML;
  T(/Utiliser|Descendre/.test(txt), 'un véhicule acheté propose de l\'utiliser');
  T(/réservoir|Faire le plein/i.test(txt), 'le niveau de carburant est affiché');

  return log;
});

const bad = out.filter(l => l.startsWith('❌'));
console.log(out.join('\n'));
console.log('\nBILAN VÉHICULES:', bad.length ? '❌ ' + bad.length + ' ÉCHEC(S)' : '✅ TOUT PASSE');
console.log('erreurs console:', errs.length ? errs.slice(0, 5) : 'aucune');
await b.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);