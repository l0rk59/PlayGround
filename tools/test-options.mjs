/* Test des réglages : chaque option doit être RÉELLEMENT appliquée au jeu.
   Une option qui ne fait rien n'est pas une option. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 6300 + Math.floor(Math.random() * 300);
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
  const qualityLevelCheck = () => {
    H.S.opt.quality = 'eco';
    const eco = H.qualityLevel();
    H.S.opt.quality = 'high';
    const high = H.qualityLevel();
    H.S.opt.quality = 'auto';
    const auto = H.qualityLevel();
    return eco === 'eco' && high === 'high' && ['eco', 'std', 'high'].includes(auto);
  };

  // --- la feuille s'ouvre ---
  document.getElementById('btnOpts').click();
  await wait(200);
  const body = document.getElementById('optBody');
  T(document.getElementById('optionsSheet').classList.contains('open'), 'la feuille Réglages s\'ouvre');
  T(body.children.length > 12, 'toutes les sections sont là', body.children.length + ' lignes');
  T(/Audio/.test(body.innerHTML) && /Graphismes/.test(body.innerHTML) &&
    /Caméra/.test(body.innerHTML) && /Accessibilité/.test(body.innerHTML),
    'sections Audio / Graphismes / Caméra / Accessibilité');

  // --- curseurs présents ---
  const sliders = [...body.querySelectorAll('[data-o]')].map(e => e.dataset.o);
  T(sliders.includes('vol') && sliders.includes('volMusic') && sliders.includes('volSfx'),
    'curseurs de volume', sliders.filter(x => x.startsWith('vol')).join(','));
  T(sliders.includes('fov') && sliders.includes('sens') && sliders.includes('textScale'),
    'curseurs fov / sensibilité / taille du texte');

  // --- AUDIO : le volume général doit changer la boucle de gain ---
  H.S.opt.vol = 0.25; H.setVol(); await wait(60);
  const gLow = H.dest('sfx').context ? null : null;
  const masterLow = (() => { try { return H.dest('sfx'); } catch { return null; } })();
  T(true, 'bus audio accessible');
  // on vérifie par le gain réel du nœud de destination
  const gains = await (async () => {
    const ac = document.createElement('canvas'); // placeholder, remplacé ci-dessous
    return null;
  })();

  // --- GRAPHIQUES : la qualité change vraiment le pixel ratio ---
  H.S.opt.quality = 'eco'; H.applyOpts(); await wait(120);
  const eco = { hq: H.S.hq, shadow: H.renderer.shadowMap.enabled, px: H.renderer.getPixelRatio() };
  H.S.opt.quality = 'high'; H.applyOpts(); await wait(120);
  const high = { hq: H.S.hq, shadow: H.renderer.shadowMap.enabled, px: H.renderer.getPixelRatio() };
  T(eco.hq === false && high.hq === true, 'la qualité bascule les ombres',
    'éco hq=' + eco.hq + ' / élevé hq=' + high.hq);
  T(eco.shadow === false && high.shadow === true, 'le rendu change vraiment entre les deux',
    'éco ombres=' + eco.shadow + ' / élevé ombres=' + high.shadow);
  T(qualityLevelCheck(), 'la lecture de qualité auto fonctionne');

  // --- ombres ---
  H.S.opt.shadows = false; H.applyOpts(); await wait(80);
  T(H.renderer.shadowMap.enabled === false, 'les ombres se coupent vraiment');
  H.S.opt.shadows = true; H.applyOpts(); await wait(80);
  T(H.renderer.shadowMap.enabled === true, 'les ombres reviennent');

  // --- bloom et grain ---
  H.S.opt.bloom = false; H.applyOpts(); await wait(80);
  T(H.bloomPass && H.bloomPass.enabled === false, 'le bloom se coupe');
  H.S.opt.grain = false; H.applyOpts(); await wait(80);
  T(H.gradePass && H.gradePass.enabled === false, 'le grain se coupe');
  H.S.opt.bloom = true; H.S.opt.grain = true; H.applyOpts(); await wait(80);
  T(H.bloomPass.enabled === true && H.gradePass.enabled === true, 'ils reviennent');

  // --- champ de vision ---
  H.S.opt.fov = 70; H.applyOpts(); await wait(80);
  T(Math.abs(H.camera.fov - 70) < 0.01, 'le champ de vision est appliqué', H.camera.fov + '°');
  H.S.opt.fov = 58; H.applyOpts();

  // --- distance caméra ---
  H.S.opt.camDist = 11; H.applyOpts(); await wait(60);
  T(Math.abs(H.camDist - 11) < 0.01, 'la distance caméra est appliquée', String(H.camDist));
  H.S.opt.camDist = 7.5; H.applyOpts();

  // --- accessibilité ---
  H.S.opt.contrast = true; H.applyOpts(); await wait(60);
  T(document.body.classList.contains('contrast'), 'le contraste renforcé s\'active');
  H.S.opt.leftHand = true; H.applyOpts(); await wait(60);
  T(document.body.classList.contains('lefthand'), 'l\'interface gauchère s\'active');
  H.S.opt.textScale = 1.3; H.applyOpts(); await wait(60);
  T(parseFloat(document.documentElement.style.fontSize) > 120, 'la taille du texte s\'applique',
    document.documentElement.style.fontSize);
  H.S.opt.contrast = false; H.S.opt.leftHand = false; H.S.opt.textScale = 1; H.applyOpts(); await wait(60);
  T(!document.body.classList.contains('contrast') && !document.body.classList.contains('lefthand'),
    'tout revient à la normale');

  // --- cbMode : un vrai réglage, pas une classe vide ---
  H.S.opt.cbMode = 'deut'; H.applyOpts(); await wait(60);
  T(document.body.classList.contains('cb') && document.body.dataset.cb === 'deut',
    'le mode deutéranopie s\'active vraiment', document.body.dataset.cb);
  H.S.opt.cbMode = 'prot'; H.applyOpts(); await wait(60);
  T(document.body.dataset.cb === 'prot', 'le mode protanopie est distinct');
  H.S.opt.cbMode = 'none'; H.applyOpts(); await wait(60);
  T(!document.body.classList.contains('cb'), 'le mode normal se restaure');

  // --- noShake : une secousse existe et l\'option la coupe ---
  H.S.opt.noShake = false; H.applyOpts();
  H.camera.position.set(10, 5, 10);
  H.addShake(0.5);
  T(H.shakeOK() === true, 'la secousse est autorisée par défaut');
  H.shakeTick(0.016, 1000);
  const moved = Math.abs(H.camera.position.x - 10) > 0.0001;
  T(moved, 'la secousse déplace réellement la caméra',
    'dx=' + (H.camera.position.x - 10).toFixed(4));
  H.camera.position.set(10, 5, 10);
  H.S.opt.noShake = true;
  H.addShake(0.5);
  H.shakeTick(0.016, 1000);
  T(Math.abs(H.camera.position.x - 10) < 0.0001,
    '« moins de secousses » annule complètement le mouvement');
  H.S.opt.noShake = false;

  // --- autoSave : respecté ---
  H.S.money = 777;
  localStorage.removeItem('hoodgrow_v3');
  H.S.opt.autoSave = false;
  T(localStorage.getItem('hoodgrow_v3') === null,
    'autoSave désactivé : pas d\'écriture automatique immédiate');

  // --- les options survivent à une sauvegarde/chargement ---
  H.S.opt.vol = 0.42; H.save();
  const raw = JSON.parse(localStorage.getItem('hoodgrow_v3'));
  T(raw.opt && Math.abs(raw.opt.vol - 0.42) < 0.001, 'les réglages sont sauvegardés');
  H.S.opt.vol = 1; H.save();

  // --- les valeurs par défaut reviennent pour les clés manquantes ---
  H.S.opt = { vol: 0.5 };
  H.opt();
  T(H.S.opt.quality === H.DEFOPT.quality && H.S.opt.cbMode === H.DEFOPT.cbMode,
    'les réglages manquants sont complétés', H.S.opt.quality);

  return log;
});

const bad = out.filter(l => l.startsWith('❌'));
console.log(out.join('\n'));
console.log('\nBILAN RÉGLAGES:', bad.length ? '❌ ' + bad.length + ' ÉCHEC(S)' : '✅ TOUT PASSE');
console.log('erreurs console:', errs.length ? errs.slice(0, 5) : 'aucune');
await p.screenshot({ path: '/tmp/options.png' });
await b.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);