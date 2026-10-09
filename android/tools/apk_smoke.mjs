/* Vérifie le contenu RÉEL d'un APK en rejouant exactement ce que fait MainActivity :
   (utilise le Playwright et la configuration Chromium du runtime OMGithub)
   Usage : node tools/apk_smoke.mjs dist/hood-grow-1.0.0.apk
   interception des requêtes vers https://appassets.androidplatform.net/assets/...,
   même User-Agent, même flag HG_NATIVE, et blocage de tout le reste du réseau. */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const APK = process.argv[2] || 'dist/hood-grow-1.0.0.apk';
const OUT = '/tmp/opencode/apkassets';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execFileSync('unzip', ['-o', '-q', APK, 'assets/*', '-d', OUT]);
const GAME = join(OUT, 'assets');   // racine des assets, comme getAssets() côté Android
console.log('extrait :', readFileSync(join(GAME, 'game/index.html'), 'utf8').length, 'octets de index.html');

const ORIGIN = 'https://appassets.androidplatform.net';
const UA_APP = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 HGApp';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript' };

const { chromium } = createRequire('/home/runner/.local/share/omgithub-playwright/package.json')('playwright');
const cfg = JSON.parse(readFileSync('/home/runner/.local/share/omgithub-playwright/linux.json', 'utf8'));
const browser = await chromium.launch(cfg.browser.launchOptions);
let ok = true;
const T = (c, l) => { if (!c) ok = false; console.log((c ? '✅' : '❌') + ' ' + l); };

for (const [name, w, h, touch] of [['apk-phone', 412, 915, true], ['apk-tablet', 800, 1280, true]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, userAgent: UA_APP });
  const errs = [], external = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/*', route => {
    const u = new global.URL(route.request().url());
    if (u.origin === ORIGIN && u.pathname.startsWith('/assets/')) {
      const rel = u.pathname.replace('/assets/', '');
      const f = join(GAME, rel);
      if (existsSync(f)) return route.fulfill({
        status: 200,
        contentType: MIME[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: readFileSync(f),
      });
      return route.fulfill({ status: 404, body: '' });
    }
    external.push(u.href);            // tout le reste est bloqué, comme dans l'app
    return route.fulfill({ status: 403, body: '' });
  });

  await page.goto(ORIGIN + '/assets/game/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  // MainActivity.onPageFinished : window.HG_NATIVE = true
  await page.evaluate(() => { window.HG_NATIVE = true; });

  console.log('\n--- ' + name + ' ' + w + 'x' + h + ' ---');
  const boot = await page.evaluate(() => ({
    three: !!window.__THREE_OK,
    canvas: !!document.querySelector('#scene canvas'),
    native: /Android/.test(navigator.userAgent),
    bridge: ['HG_back', 'HG_appPause', 'HG_appResume'].every(k => typeof window[k] === 'function'),
    build: (document.getElementById('pBuild') || {}).textContent || '',
    ver: (window.HG_NATIVE && document.getElementById('pBuild')) ? document.getElementById('pBuild').textContent : '',
    ls: (() => { try { localStorage.setItem('__t', '1'); const v = localStorage.getItem('__t') === '1'; localStorage.removeItem('__t'); return v; } catch { return false; } })(),
    origin: location.origin,
  }));
  console.log('boot:', JSON.stringify(boot));
  T(boot.canvas, 'scène 3D montée (aucune erreur de module)');
  T(boot.bridge, 'pont natif disponible (retour / pause / reprise)');
  T(boot.ls, 'localStorage utilisable sur l\'origine https de l\'app');
  T(boot.origin === ORIGIN, 'origine du jeu = ' + boot.origin);
  T(external.length === 0, 'aucune ressource externe demandée (' + external.length + ')');
  T(errs.length === 0, 'aucune erreur console' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));

  // le tutoriel consomme le premier appui retour sur une partie neuve :
  // on le referme d'abord, sinon on teste le tutoriel et non le bouton retour.
  await page.evaluate(() => {
    const t = document.getElementById('tuto');
    if (t && t.classList.contains('open')) document.getElementById('tutoSkip').click();
  });

  // --- contrat du bouton retour (comme handleBack() côté Java) ---
  const back = await page.evaluate(() => {
    const out = [];
    const pause = () => document.getElementById('pauseSheet').classList.contains('open');
    const help = () => document.getElementById('helpCard').classList.contains('open');
    const stats = () => document.getElementById('statsSheet').classList.contains('open');
    out.push(['1er appui : met en pause', window.HG_back() === true && pause()]);
    out.push(['2e appui (en pause) : autorise la sortie', window.HG_back() === false]);
    document.getElementById('pResume').click();
    out.push(['« Reprendre » ressort de la pause', !pause()]);
    document.getElementById('helpBtn').click();
    out.push(['aide ouverte', help()]);
    out.push(['appui : ferme l\'aide', window.HG_back() === true && !help()]);
    document.getElementById('pauseBtn').click();
    document.getElementById('pStatsBtn').click();
    out.push(['statistiques ouvertes', stats()]);
    out.push(['appui : ferme les statistiques', window.HG_back() === true && !stats()]);
    out.push['fin'] = null;
    if (pause()) document.getElementById('pResume').click();   // on repart en jeu
    out.push(['retour en jeu', !pause()]);
    return out;
  });
  for (const [l, v] of back) T(v, 'retour Android : ' + l);

  // --- contrat pause arrière-plan ---
  const life = await page.evaluate(() => {
    const pause = () => document.getElementById('pauseSheet').classList.contains('open');
    const before = pause();
    window.HG_appPause();                    // l'app passe en arrière-plan
    const afterPause = pause();
    window.HG_appResume();                   // retour au premier plan
    return { before, afterPause, stillPaused: pause() };
  });
  T(!life.before && life.afterPause, 'HG_appPause met le jeu en pause et affiche le menu');
  T(life.afterPause && life.stillPaused, 'HG_appResume relance le son sans.forcer la reprise (\'Reprendre\')');

  // --- sauvegarde dans l'app ---
  const save = await page.evaluate(() => {
    const k = 'hoodgrow_v3';
    localStorage.setItem(k, JSON.stringify({ money: 4242, pots: Array.from({ length: 6 }, () => ({ g: 0, planted: false })), stock: 7 }));
    return JSON.parse(localStorage.getItem(k)).money;
  });
  T(save === 4242, 'clé de sauvegarde hoodgrow_v3 accessible');

  await page.evaluate(() => localStorage.removeItem('hoodgrow_v3'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.HG_NATIVE = true; });
  await page.screenshot({ path: OUT + '/' + name + '.png' });
  console.log('capture :', OUT + '/' + name + '.png');
  await page.close();
}
await browser.close();
console.log('\nBILAN APK:', ok ? '✅ OK' : '❌ ÉCHECS');
process.exitCode = ok ? 0 : 1;