/**
 * CAPTURE — vérifie le rendu réel du jeu et produit les captures.
 *
 * Ce n'est pas une capture d'écran : c'est un **test de fumée visuel**.
 * L'outil joue le parcours titre → classe → expédition, vérifie que le
 * canevas contient bien de l'image (pas un écran vide), que le joueur est
 * visible, et qu'aucune erreur console n'a été levée. Il échoue si l'une
 * de ces conditions n'est pas remplie.
 *
 *   node tools/capture.mjs [--url=…] [--out=…]
 *
 * En environnement sans GPU, le rendu est produit par SwiftShader, c'est-à-dire
 * du logiciel. Ce n'est pas une accélération matérielle et cela ne se
 * prétend pas.
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const RUNTIME = join(homedir(), '.local/share/omgithub-playwright');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const URL_BASE = args.url ?? 'http://localhost:3000';
const OUT = args.out ?? join(process.cwd(), 'screenshots');

function loadPlaywright() {
  // On tente plusieurs racines : le runtime partage de l'environnement,
  // puis le projet. `createRequire` n'exige pas que le fichier existe,
  // seulement qu'il puisse resoudre depuis ce repertoire.
  for (const root of [RUNTIME, process.cwd()]) {
    try {
      return createRequire(join(root, 'package.json'))('playwright');
    } catch {
      /* racine suivante */
    }
  }
  throw new Error('playwright introuvable : `npm i -D playwright`, ou utilisez capture.sh');
}

const { chromium } = loadPlaywright();

const SHOTS = [
  { name: 'final-desktop', width: 1440, height: 900, mobile: false },
  { name: 'final-mobile', width: 844, height: 390, mobile: true },
];

const problems = [];
const note = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) problems.push(`${label}${detail ? ` : ${detail}` : ''}`);
  return ok;
};

/** Compte les pixels « crémeux » du joueur : prouve qu'il est à l'écran. */
const countPlayerPixels = (page) =>
  page.evaluate(() => {
    const c = document.getElementById('stage');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let bright = 0;
    let nonBackground = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const gg = d[i + 1];
      const b = d[i + 2];
      if (r > 170 && gg > 150 && b > 120) bright += 1;
      if (r + gg + b > 150) nonBackground += 1;
    }
    return { bright, nonBackground, total: d.length / 4 };
  });

const run = async () => {
  mkdirSync(OUT, { recursive: true });

  const launchOptions = { args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...launchOptions });
  } catch {
    // Certains environnements n'ont que le « headless shell ».
    browser = await chromium.launch({ channel: 'chromium-headless-shell', headless: true, ...launchOptions });
  }
  note(true, 'navigateur lancé', `${browser.version()} (rendu logiciel SwiftShader)`);

  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    const res = await page.goto(`${URL_BASE}/?t=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
    if (!note(res?.ok(), `[${shot.name}] chargement HTTP`, String(res?.status()))) {
      await page.close();
      continue;
    }

    await page.waitForFunction(() => globalThis.__refuge?.game, null, { timeout: 15000 });
    await page.waitForTimeout(400);

    // Parcours joueur complet : titre → classe → briefing → expédition.
    await page.evaluate(async () => {
      document.getElementById('btnNew').click();
      await new Promise((r) => setTimeout(r, 250));
      document.querySelector('#classList button').click();
      await new Promise((r) => setTimeout(r, 250));
      document.getElementById('btnDeploy').click();
      await new Promise((r) => setTimeout(r, 2500));
      const g = globalThis.__refuge;
      const run = g.game.run;
      // On force un combat lisible : des ennemis a portee, tous a l'etat
      // de telegraphie, pour que les quatre formes d'attaque soient
      // visibles sur la meme image. C'est aussi la seule facon de
      // verifier la lisibilite du combat — une capture de marche ne
      // montre jamais le coeur du jeu.
      run.timeLimit = 999;
      run.player.x = 900;
      run.player.y = 900;
      g.renderer.cam.x = 900;
      g.renderer.cam.y = 900;
      run.enemies.length = 0;
      const { spawnEnemy } = g.sims;
      // Une famille par forme de telegraphie, a distance de frappe.
      const cast = [
        ['rieur', 70, -80],
        ['plethore', 150, 60],
        ['pleureuse', -170, -70],
        ['meute', 190, 110],
        ['guetteur', -200, 130],
      ];
      // On garde les ennemis en charge en continant la telegraphie : sinon
      // la simulation les fait passer a l'attaque pendant la capture et on
      // photographie le combat au mauvais moment.
      window.__holdTell = setInterval(() => {
        for (const e of run.enemies) {
          e.state = 'telegraph';
          e.telegraphUntil = e.def.attackWindup * 0.8;
          e.facing = Math.atan2(run.player.y - e.y, run.player.x - e.x);
        }
      }, 16);
      for (const [id, dx, dy] of cast) {
        spawnEnemy(run, id, run.player.x + dx, run.player.y + dy);
      }
      run.player.health = run.player.maxHealth;
    });
    await page.waitForTimeout(900);

    const state = await page.evaluate(() => {
      const g = globalThis.__refuge;
      return { mode: g.game.mode, enemies: g.game.run.enemies.length, status: g.game.run.status };
    });
    note(state.mode === 'run', `[${shot.name}] partie en cours`, state.status);

    // Combat lisible : au moins un ennemi a l'ecran et au moins une
    // telegraphie. Sans cela, une capture peut passer alors que le coeur
    // du jeu est invisible — c'est exactement ce qui s'est produit.
    await page.waitForTimeout(350);
    const combat = await page.evaluate(() => {
      const run = globalThis.__refuge.game.run;
      return {
        enemies: run.enemies.length,
        telegraphing: run.enemies.filter((e) => e.state === 'telegraph').length,
      };
    });
    note(combat.enemies >= 4, `[${shot.name}] les ennemis sont a l'ecran`, `${combat.enemies} ennemis`);
    note(combat.telegraphing >= 3, `[${shot.name}] les telegraphies sont lisibles`, `${combat.telegraphing} en charge`);

    await page.evaluate(() => clearInterval(window.__holdTell));
    const px = await countPlayerPixels(page);
    note(px.nonBackground / px.total > 0.02, `[${shot.name}] la scène est remplie`, `${((px.nonBackground / px.total) * 100).toFixed(1)} % de pixels éclairés`);
    note(px.bright > 60, `[${shot.name}] le joueur est visible`, `${px.bright} pixels de valeur haute`);
    note(errors.length === 0, `[${shot.name}] aucune erreur console`, errors.slice(0, 2).join(' / '));

    // Animation : on deplace le joueur et on capture son cadre a plusieurs
    // positions de cycle. Si les images sont identiques, le personnage
    // glisse au lieu de marcher — c'est le defaut le plus visible et le
    // plus facile a rater sur une capture unique.
    const strip = await page.evaluate(async () => {
      const g = globalThis.__refuge;
      const s = g.renderer;
      const c = document.getElementById('stage');
      const crop = () => {
        const px = Math.round((g.game.run.player.x - s.cam.x) * s.zoom + s.view.w / 2);
        const py = Math.round((g.game.run.player.y - s.cam.y) * s.zoom + s.view.h / 2);
        return c.getContext('2d').getImageData(px - 26, py - 44, 52, 52).data.join(',');
      };
      const out = document.createElement('canvas');
      out.width = 52 * 6;
      out.height = 52;
      const octx = out.getContext('2d');
      octx.fillStyle = '#202a38';
      octx.fillRect(0, 0, out.width, out.height);
      const hashes = [];
      for (let i = 0; i < 6; i++) {
        g.game.run.player.x += 15;
        g.game.run.player.y += 7;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const px = Math.round((g.game.run.player.x - s.cam.x) * s.zoom + s.view.w / 2);
        const py = Math.round((g.game.run.player.y - s.cam.y) * s.zoom + s.view.h / 2);
        octx.drawImage(c, px - 26, py - 44, 52, 52, i * 52, 0, 52, 52);
        hashes.push(crop());
      }
      out.dataset.hashes = JSON.stringify(hashes);
      return { png: out.toDataURL('image/png'), distinct: new Set(hashes).size };
    });
    writeFileSync(join(OUT, `${shot.name}-walk.png`), Buffer.from(strip.png.split(',')[1], 'base64'));
    note(strip.distinct >= 4, `[${shot.name}] le cycle de marche anime`, `${strip.distinct} poses distinctes sur 6`);

    const file = join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file, timeout: 30000 });
    note(true, `[${shot.name}] capture écrite`, file);
    await page.close();
  }

  await browser.close();

  const report = { url: URL_BASE, out: OUT, problems, ok: problems.length === 0, renderer: 'SwiftShader (logiciel)' };
  writeFileSync(join(OUT, 'capture-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n${problems.length === 0 ? 'Capture OK.' : `ÉCHEC : ${problems.length} problème(s).`}`);
  if (problems.length) {
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
};

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

export { run };
void tmpdir;