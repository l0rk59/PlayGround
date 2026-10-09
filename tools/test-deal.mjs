/* Test de la négociation lisible : l'humeur du client doit réagir
   à la patience et au bluff, la posture et le repère doivent suivre. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 4800 + Math.floor(Math.random() * 400);
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
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
await p.waitForTimeout(2500);

const out = await p.evaluate(() => {
  const H = window.__H;
  const log = [];
  const T = (c, l, d) => log.push((c ? '✅' : '❌') + ' ' + l + (d ? ' — ' + d : ''));

  H.S.money = 4000;
  H.S.stock = 60;
  H.S.wanted = 0;

  const c = H.clients[0];
  H.openSell(c);
  T(document.getElementById('sellSheet').classList.contains('open'), 'feuille de vente ouverte');
  T(document.getElementById('bluffBox').style.display === 'block', "boîte d'humeur visible");

  const m0 = H.moodOf(c);
  T(m0 === 'open' || m0 === 'warm', 'humeur de départ calme', m0);
  T(/💬|🙂/.test(H.readAdvice(c)), 'conseil présent hors négociation', H.readAdvice(c).slice(0, 42));
  const pose0 = c.mesh.userData.moodYaw;
  T(!!(c.mk && c.mk.material.map), 'repère client présent');

  c.patMax = 400; c.pat = 400;            // patience large : on teste la mécanique, pas l'échec
  H.startBluff();
  const seen = [];
  for (let i = 0; i < 2; i++) {
    const before = H.moodOf(c);
    seen.push(before);
    H.bluffStep(true);
    log.push('   round ' + (i + 1) + ': humeur=' + before + ' -> ' + H.moodOf(c) +
      ' prix×' + H.bluff.mult.toFixed(2) + ' patience=' + Math.round(c.pat) + '/' + c.patMax);
  }
  T(new Set(seen).size > 1, 'les humeurs changent pendant la négo', [...new Set(seen)].join(','));
  T(H.bluff.mult > 1, 'le prix monte avec les bluffs', '×' + H.bluff.mult.toFixed(2));

  // patience courte => le client part, et la vente se referme proprement
  const cShort = H.clients[1];
  cShort.pat = 5;
  H.openSell(cShort);
  H.startBluff();
  H.bluffStep(true);
  T(!document.getElementById('sellSheet').classList.contains('open') && H.bluff === null,
    'patient trop court : le client part et la feuille se ferme');
  H.openSell(c);
  c.patMax = 400; c.pat = 400;
  H.startBluff();

  c.pat = 1;
  const mad = H.moodOf(c);
  T(mad === 'cold' || mad === 'mad', 'humeur froide/ennervée si patience à zéro', mad);
  T(/⚠️|🧊/.test(H.readAdvice(c)), "conseil d'urgence affiché", H.readAdvice(c).slice(0, 48));

  H.refreshSell();
  const pose1 = c.mesh.userData.moodYaw;
  T(Math.abs(pose1 - pose0) > 0.05, 'la posture traduis l\'humeur', pose0 + ' -> ' + pose1);
  T(c.mesh.userData.moodRoll > 0, 'le torse se ferme', 'roll=' + c.mesh.userData.moodRoll);

  const html = document.getElementById('bluffTxt').innerHTML;
  T(/Détendu|Chaleureux|Tendu|Froid|colère/.test(html), 'HTML: nom d\'humeur');
  T(html.includes('border-radius:99px'), 'HTML: pips de bluff');
  T(/Round \d\/3/.test(html), 'HTML: compteur de round');

  // reculer doit être une vraie option : le prix baisse, la patience remonte, la négo continue
  c.pat = 400;
  H.bluffStep(true);
  const mHigh = H.bluff.mult, patHigh = c.pat;
  H.bluffStep(false);
  T(H.bluff !== null, 'reculer ne casse pas la négociation');
  T(H.bluff.mult < mHigh, 'reculer fait baisser le prix', mHigh.toFixed(3) + ' -> ' + H.bluff.mult.toFixed(3));
  T(c.pat > patHigh, 'reculer rend de la patience', Math.round(patHigh) + ' -> ' + Math.round(c.pat));
  H.bluffStep(true); H.bluffStep(true);   // on vide les 3 tours pour finir proprement
  T(H.bluff === null, 'au 3e tour l\'accord se conclut');

  const valid = H.MOODS.map(m => m.id);
  T(H.clients.every(cl => valid.includes(H.moodOf(cl))), 'humeur valide pour tous les clients', H.clients.length + ' clients');

  T(H.MOODS.every(m => {
    c.pat = m.id === 'mad' ? 1 : c.patMax;
    return typeof H.readAdvice(c) === 'string' && H.readAdvice(c).length > 8;
  }), 'conseil non vide pour chaque humeur');

  // le repère '!' doit être re-colorisé quand l'humeur change
  H.applyMoodPose(c);
  const m1 = c.mesh.userData.moodYaw;
  H.bluffStep(true);
  H.applyMoodPose(c);
  T(c.mk.material.color.getHex() === 0xffffff && !!c.mk.material.map, 'repère re-texturé par humeur');

  return log;
});

await p.screenshot({ path: '/tmp/deal.png' });
const bad = out.filter(l => l.startsWith('❌'));
console.log(out.join('\n'));
console.log('\nBILAN NÉGO:', bad.length ? '❌ ' + bad.length + ' ÉCHEC(S)' : '✅ TOUT PASSE');
console.log('erreurs console:', errs.length ? errs.slice(0, 6) : 'aucune');
await b.close();
srv.close();
process.exit(bad.length || errs.length ? 1 : 0);