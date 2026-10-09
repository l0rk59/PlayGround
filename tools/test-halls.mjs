/* Test des bâtiments jouables : les 4 halls (Mercato, Douane, Banque, Commissariat)
   doivent être de vrais intérieurs et leurs boutiques fonctionner.
   Attentes sur l'état réel : SwiftShader peut bloquer le thread. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 5700 + Math.floor(Math.random() * 300);
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
  // on attend une condition vraie, pas un délai : le rendu CPU peut figer 1 s
  const settle = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  };
  const goTo = async h => { H.player.pos.set(h.x + h.cx, 0, h.z + h.cz); };
  const atCentre = async h => { H.player.pos.set(h.x, 0, h.z); };

  // ---------- structure ----------
  T(H.HALLS.length === 4, 'quatre halls construits', H.HALLS.map(h => h.o.sign).join(' + '));
  const D = { marche: [86, 186, -58, 58], quais: [-62, 62, 84, 184] };
  const inD = (h, r) => h.x > r[0] && h.x < r[1] && h.z > r[2] && h.z < r[3];
  T(inD(H.hallMarket, D.marche), 'le Mercato est dans le Marché',
    H.hallMarket.x + ',' + H.hallMarket.z);
  T(inD(H.hallDouane, D.quais), 'la Douane est dans les Quais',
    H.hallDouane.x + ',' + H.hallDouane.z);
  T(H.HALLS.every(h => !H.pointInSolid(h.x + h.cx, h.z + h.cz)), 'aucun comptoir dans un mur');
  T(H.HALLS.every(h => !H.pointInSolid(h.x + h.cx, h.z + h.cz + 2.4)), 'l\'espace devant chaque porte est libre');

  // ---------- le Mercato ----------
  await atCentre(H.hallMarket);
  await settle(() => H.hallAt() === H.hallMarket && H.hallMarket.roof.visible === false);
  T(H.hallAt() === H.hallMarket, 'on est détecté dans le Mercato');
  T(H.hallMarket.roof.visible === false, 'le toit s\'est ouvert');
  T(H.hallMarket.walls.every(w => w.transparent && w.opacity < .2), 'les murs s\'effacent');
  T(H.player.indoors === true, 'le joueur est marqué « dedans »');

  H.setWeather('rain');
  await settle(() => H.S.weather === 'rain');
  T(H.S.weather === 'rain', 'météo pluie déclenchée');

  await goTo(H.hallMarket);
  await settle(() => H.nearHall === H.hallMarket);
  T(H.nearHall === H.hallMarket, 'le comptoir du Mercato est interactif');

  H.S.money = 6000;
  H.openMarche();
  T(document.getElementById('marcheSheet').classList.contains('open'), 'feuille Mercato ouverte');
  T(document.getElementById('mShop').children.length === H.MSHOP.length, 'tous les articles sont listés');
  const seedBefore = H.S.seeds.classique;
  document.querySelector('#mShop [data-m="seed"]').click();
  T(H.S.seeds.classique === seedBefore + 3, 'achat de graines appliqué', seedBefore + ' -> ' + H.S.seeds.classique);
  document.getElementById('marcheClose').click();
  T(!document.getElementById('marcheSheet').classList.contains('open'), 'feuille Mercato fermée');

  // la capuche réduit la vision des flics
  const cop = { type: 'ped' };
  H.S.coat = false; const bare = H.copSight(cop);
  H.S.coat = true;  const hood = H.copSight(cop);
  T(hood < bare, 'la capuche réduit la vision des flics', bare.toFixed(1) + ' -> ' + hood.toFixed(1));
  H.S.coat = false;

  // ---------- la Douane ----------
  await atCentre(H.hallDouane);
  await settle(() => H.hallAt() === H.hallDouane && H.hallDouane.roof.visible === false
                 && H.hallMarket.roof.visible === true);
  T(H.hallAt() === H.hallDouane, 'on est détecté à la Douane');
  T(H.hallDouane.roof.visible === false, 'toit ouvert à la Douane');
  T(H.hallMarket.roof.visible === true, 'le Mercato se referme quand on sort');

  await goTo(H.hallDouane);
  await settle(() => H.nearHall === H.hallDouane);
  T(H.nearHall === H.hallDouane, 'le comptoir de la Douane est interactif');
  H.openDouane();
  T(document.getElementById('douaneSheet').classList.contains('open'), 'feuille Douane ouverte');
  const cap0 = H.stashCap();
  document.querySelector('#dShop [data-d="bond"]').click();
  T(H.stashCap() > cap0, 'la caution agrandit la planque', cap0 + ' -> ' + H.stashCap());
  document.querySelector('#dShop [data-d="seal"]').click();
  T(H.S.sealed === true, 'les scellés customs sont activés');
  document.getElementById('douaneClose').click();

  // ---------- la Banque ----------
  H.S.money = 6000;
  await goTo(H.hallBank);
  await settle(() => H.nearHall === H.hallBank);
  T(H.nearHall === H.hallBank, 'le guichet de la banque est interactif');
  H.openBank();
  T(document.getElementById('bankSheet').classList.contains('open'), 'la feuille Banque s\'ouvre');
  const m0 = H.S.money;
  document.querySelector('#bankShop [data-b="dep500"]').click();
  T(H.S.money === m0 - 500 && H.S.bank === 500, 'déposer 500 € fonctionne', m0 + ' -> ' + H.S.money);
  document.querySelector('#bankShop [data-b="ret500"]').click();
  T(H.S.money === m0 && H.S.bank === 0, 'retirer 500 € refait le compte');
  document.querySelector('#bankShop [data-b="safe"]').click();
  T(H.S.vault === true, 'le coffre-fort s\'achète');
  document.getElementById('bankClose').click();

  // ---------- le Commissariat ----------
  H.S.wanted = 3;
  await goTo(H.hallPolice);
  await settle(() => H.nearHall === H.hallPolice);
  T(H.nearHall === H.hallPolice, 'le commissariat est interactif');
  H.openPol();
  T(document.getElementById('polSheet').classList.contains('open'), 'la feuille Commissariat s\'ouvre');
  document.querySelector('#polShop [data-o="calm"]').click();
  T(H.S.wanted < 3, 'payer calme la recherche', '3 -> ' + H.S.wanted.toFixed(2));
  document.querySelector('#polShop [data-o="paper"]').click();
  T(H.S.papers === true, 'les papiers s\'achètent');
  document.querySelector('#polShop [data-o="charm"]').click();
  T(H.S.charmT === 3, 'la protection dure 3 jours');
  document.getElementById('polClose').click();

  H.S.charmT = 0; const cBare = H.copSight(cop);
  H.S.charmT = 3; const cCharm = H.copSight(cop);
  T(cCharm < cBare, 'la protection réduit la vision des flics', cBare.toFixed(1) + ' -> ' + cCharm.toFixed(1));
  H.S.charmT = 0;

  // ---------- sortie ----------
  H.player.pos.set(0, 0, 40);
  await settle(() => H.nearHall === null);
  T(H.nearHall === null, 'le prompt disparaît quand on s\'éloigne');

  return log;
});

const bad = out.filter(l => l.startsWith('❌'));
console.log(out.join('\n'));
console.log('\nBILAN HALLES:', bad.length ? '❌ ' + bad.length + ' ÉCHEC(S)' : '✅ TOUT PASSE');
console.log('erreurs console:', errs.length ? errs.slice(0, 6) : 'aucune');
await b.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);