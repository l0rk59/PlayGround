/* Test du panneau des contrats : génération, livraison, délai, échec. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = 7000 + Math.floor(Math.random() * 300);
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
  const settle = async (fn, ms = 8000) => { const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

  T(!!H.jobBoard, 'le panneau est construit', H.jobBoard ? H.jobBoard.x + ',' + H.jobBoard.z : '');
  T(H.activeJobs().length === H.JOB_MAX, 'trois contrats générés', H.activeJobs().length + '/' + H.JOB_MAX);
  const j0 = H.activeJobs()[0];
  T(j0 && j0.q > 0 && j0.pay > 0 && j0.hours > 0, 'un contrat a quantité, prime et délai',
    j0 ? j0.label + ' → ' + j0.pay + ' € / ' + j0.hours + ' h' : '');

  // --- on va au panneau ---
  H.player.pos.set(H.jobBoard.x, 0, H.jobBoard.z + 2.5);
  await settle(() => H.nearJob === true);
  T(H.nearJob === true, 'le panneau est détecté');
  H.openJobs();
  T(document.getElementById('jobSheet').classList.contains('open'), 'la feuille Contrats s\'ouvre');
  T(document.getElementById('jobList').innerHTML.includes('Livrer'), 'les contrats sont listés avec un bouton Livrer');

  // --- livraison réussie ---
  H.S.stock = 60; H.S.stash = 0; H.S.money = 100; H.S.rep = 3;
  const job = H.activeJobs()[0];
  const need = job.q, pay0 = job.pay;
  H.deliverJob(job.id);
  T(job.done === true, 'le contrat est marqué livré');
  T(H.S.money === 100 + pay0, 'la prime est versée', '100 -> ' + H.S.money);
  T(H.S.rep > 3, 'la réputation monte', '3 -> ' + H.S.rep.toFixed(1));
  T(H.S.stock + H.S.stash === 60 - need, 'la quantité est prélevée', 'restant ' + (H.S.stock + H.S.stash));

  // --- pas assez de stock ---
  const j1 = H.activeJobs()[1];
  H.S.stock = 1; H.S.stash = 0;
  const m1 = H.S.money;
  H.deliverJob(j1.id);
  T(j1.done !== true && H.S.money === m1, 'sans stock la livraison échoue');

  // --- échec par retard ---
  const j2 = H.activeJobs()[2];
  const rep0 = H.S.rep;
  j2.left = 0.001;
  H.jobTick(1);              // 1 s de jeu ≈ 0.1 h : le délai est dépassé
  T(j2.failed === true, 'un contrat non honoré tombe en échec');
  T(H.S.rep < rep0, 'un échec coûte de la réputation', rep0.toFixed(1) + ' -> ' + H.S.rep.toFixed(1));

  // --- le tableau se renouvelle ---
  const before = H.activeJobs().length;
  H.refreshBoard();
  const after = H.activeJobs().filter(c => !c.done && !c.failed).length;
  T(after === H.JOB_MAX, 'le tableau se remplit de nouveaux contrats', before + ' -> ' + after);
  document.getElementById('jobClose').click();

  // --- sauvegarde ---
  H.save();
  const raw = JSON.parse(localStorage.getItem('hoodgrow_v3'));
  T(raw.jobs && Array.isArray(raw.jobs), 'les contrats sont sauvegardés');

  return log;
});

const bad = out.filter(l => l.startsWith('❌'));
console.log(out.join('\n'));
console.log('\nBILAN CONTRATS:', bad.length ? '❌ ' + bad.length + ' ÉCHEC(S)' : '✅ TOUT PASSE');
console.log('erreurs console:', errs.length ? errs.slice(0, 5) : 'aucune');
await b.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);
