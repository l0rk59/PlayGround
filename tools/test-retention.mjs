/* Test de la couche de rétention : rituel quotidien, défi hebdomadaire,
   méta-progression. Ce sont les leviers D1/D7 identified par le marché. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 7400 + Math.floor(Math.random() * 300);
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

  // ---------- rituel quotidien ----------
  H.S.money = 100; H.S.daily = null;
  H.dailyState(); H.dailyReward(); await wait(60);
  T(H.S.money > 100, 'la récompense quotidienne verse de l\'argent', '100 -> ' + H.S.money);
  T(H.S.daily.claimed === true, 'la journée est marquée comme récupérée');
  T(H.S.daily.streak === 1, 'la série démarre à 1', 'streak=' + H.S.daily.streak);
  const m1 = H.S.money;
  H.dailyReward(); await wait(60);
  T(H.S.money === m1, 'on ne peut pas encaisser deux fois le même jour');
  // jour suivant simulé : la série monte
  H.S.daily.last = String(Number(H.S.daily.last) - 1);
  H.dailyState(); H.dailyReward(); await wait(60);
  T(H.S.daily.streak === 2, 'un nouveau jour fait monter la série', 'streak=' + H.S.daily.streak);
  // jour manqué : remise à zéro
  H.S.daily.last = String(Number(H.S.daily.last) - 3);   // 3 jours de silence
  H.dailyTick(); await wait(60);
  T(H.S.daily.streak === 0, 'un jour manqué remet la série à zéro', 'streak=' + H.S.daily.streak);

  // ---------- défi hebdomadaire ----------
  H.S.week = { id: 'sold', reward: false };
  H.S.qSum = 10;                     // 10 / 40 g livrés
  T(H.weekProgress() === 10, 'la progression hebdo se lit', H.weekProgress() + '/40');
  const m2 = H.S.money;
  H.claimWeek(); await wait(60);
  T(H.S.money === m2, 'on ne peut pas réclamer avant l\'objectif');
  H.S.qSum = 50;
  H.S.rep = 3;
  H.claimWeek(); await wait(60);
  T(H.S.money === m2 + 250, 'le défi accompli verse 250 €', m2 + ' -> ' + H.S.money);
  T(H.S.rep > 3, 'et donne de la réputation', '3 -> ' + H.S.rep.toFixed(1));
  T(H.weekState().reward === true, 'la prime hebdo est consommée');

  // ---------- méta-progression ----------
  H.S.rankXp = 0;
  T(H.tierIdx() === 0, 'palier 0 au départ', H.currentTier().nom);
  const bonus0 = H.tierPriceBonus();
  H.S.rankXp = 800;
  T(H.tierIdx() === 2, 'palier 2 à 800 XP', H.currentTier().nom);
  const bonus2 = H.tierPriceBonus();
  T(bonus2 > bonus0, 'le palier augmente le prix de vente', bonus0.toFixed(2) + ' -> ' + bonus2.toFixed(2));
  // le bonus s'applique réellement dans priceMul
  const d = { id: 'marche' };
  const p0 = H.priceMul(d, 12);
  H.S.rankXp = 1800;
  const p1 = H.priceMul(d, 12);
  T(p1 > p0, 'le palier se répercute sur le prix réel', p0.toFixed(3) + ' -> ' + p1.toFixed(3));

  // ---------- la feuille de progression s'ouvre ----------
  H.openProg(); await wait(80);
  T(document.getElementById('progSheet').classList.contains('open'), 'la feuille Progression s\'ouvre');
  const html = document.getElementById('progBody').innerHTML;
  T(/Carrière/.test(html) && /Rituel quotidien/.test(html) && /Défi de la semaine/.test(html) && /Palier/.test(html),
    'les 4 sections sont présentes');
  T(/Récupérer|Fait/.test(html), 'le bouton quotidien est là');
  document.getElementById('progClose').click();

  // sauvegarde
  H.S.rankXp = 800;
  H.save();
  const raw = JSON.parse(localStorage.getItem('hoodgrow_v3'));
  T(raw.rankXp === 800, 'la progression est sauvegardée');

  return log;
});

const bad = out.filter(l => l.startsWith('❌'));
console.log(out.join('\n'));
console.log('\nBILAN RÉTENTION:', bad.length ? '❌ ' + bad.length + ' ÉCHEC(S)' : '✅ TOUT PASSE');
console.log('erreurs console:', errs.length ? errs.slice(0, 5) : 'aucune');
await b.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);
