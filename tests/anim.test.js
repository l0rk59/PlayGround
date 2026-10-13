import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * CANVAS DE TEST — un substitut minimal, pas une implementation.
 *
 * Il enregistre les appels et fabrique une vraie bitmap RGBA pour que les
 * tests puissent verifier ce qui a ete dessine, pas seulement que les
 * methodes ont ete appelees. C'est ce qui permet de tester une feuille
 * d'animation sous node:test, sans navigateur.
 */
class TestCtx {
  constructor(w, h, log) {
    this.w = w;
    this.h = h;
    this.log = log;
    this.calls = { fill: 0, stroke: 0, fillRect: 0, drawImage: 0, arc: 0, ellipse: 0 };
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  _mark(name) {
    this.calls[name] = (this.calls[name] ?? 0) + 1;
    this.log?.push(name);
  }

  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  setLineDash() {}
  get lineDashOffset() { return 0; }
  set lineDashOffset(v) {}
  clip() {}
  rect() {}

  set fillStyle(v) { this._fill = String(v); }
  get fillStyle() { return this._fill; }
  set strokeStyle(v) { this._stroke = String(v); }
  get strokeStyle() { return this._stroke; }
  set lineWidth(v) { this._lw = v; }
  get lineWidth() { return this._lw; }
  set lineCap(v) {}
  get lineCap() { return 'butt'; }
  set lineJoin(v) {}
  get lineJoin() { return 'miter'; }
  set globalAlpha(v) { this._alpha = v; }
  get globalAlpha() { return 1; }
  set globalCompositeOperation(v) { this._op = v; }
  get globalCompositeOperation() { return 'source-over'; }

  fill() {
    this._mark('fill');
    this._paint(this._fill);
  }

  stroke() {
    this._mark('stroke');
    this._paint(this._stroke);
  }

  fillRect(x, y, w, h) {
    this._mark('fillRect');
    this._paint(this._fill, x, y, Math.max(1, w), Math.max(1, h));
  }

  arc() { this._mark('arc'); this._paint(this._fill); }
  ellipse() { this._mark('ellipse'); this._paint(this._fill); }

  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createPattern() { return {}; }
  getImageData(x, y, w, h) {
    return { data: this.data, width: this.w, height: this.h };
  }
  putImageData() {}
  measureText() { return { width: 0 }; }

  drawImage(img) {
    this._mark('drawImage');
    // Rasterisation grossiere : on peint l'image source telle quelle, ce
    // qui suffit a verifier qu'une feuille contient bien ses frames.
    if (img?.__solid) this._paint(img.__solid, 0, 0, this.w, this.h);
  }

  _paint(color, x0 = 0, y0 = 0, w = this.w, h = this.h) {
    const m = String(color).match(/rgba?\(([^)]+)\)/);
    const hm = String(color).match(/hsla?\(([^)]+)\)/);
    let rgb = [200, 200, 200];
    if (m) rgb = m[1].split(',').slice(0, 3).map((v) => Number(v) | 0);
    else if (hm) {
      const [hu, sa, li] = hm[1].split(/\s+/).map((v) => parseFloat(v));
      rgb = hslToRgb(hu, sa / 100, li / 100);
    }
    const xa = Math.max(0, x0 | 0);
    const ya = Math.max(0, y0 | 0);
    const xb = Math.min(this.w, (x0 + w) | 0);
    const yb = Math.min(this.h, (y0 + h) | 0);
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) {
        const i = (y * this.w + x) * 4;
        this.data[i] = rgb[0];
        this.data[i + 1] = rgb[1];
        this.data[i + 2] = rgb[2];
        this.data[i + 3] = 255;
      }
    }
  }
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  return t.map((v) => Math.round((v + m) * 255));
}

class TestCanvas {
  constructor() {
    this.width = 1;
    this.height = 1;
    this._solid = null;
  }

  getContext() {
    if (!this._ctx) this._ctx = new TestCtx(this.width, this.height);
    this._ctx.w = this.width;
    this._ctx.h = this.height;
    return this._ctx;
  }

  set solid(v) { this._solid = v; }
  get solid() { return this._solid; }
  get __solid() { return this._solid; }
}

globalThis.document ??= { createElement: () => new TestCanvas() };

const { FrameSheet, actorSheet, walkPose, blobPose, quadPose, clearAnimCache } = await import('../src/render/anim.js');

/* ------------------------------------------------------------------ */

const opaquePixels = (canvas) => {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n += 1;
  return n;
};

test('feuille de frames : la boucle de composition utilise frames.length', () => {
  const frames = [];
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 30;
    c.solid = 'rgb(200,200,200)';
    frames.push(c);
  }
  const sheet = new FrameSheet(frames, 20, 30, 10, 20);
  assert.equal(sheet.count, 6, 'le compte de frames est memorise');
  assert.equal(sheet.canvas.width, 120, 'la feuille fait largeur x nb de frames');
  assert.equal(sheet.canvas.height, 30);
  // Regression : une boucle `i < frames` ne s'execute jamais, car la
  // conversion tableau -> nombre vaut NaN. La feuille restait vide et les
  // personnages etaient invisibles sans la moindre erreur affichee.
  assert.ok(opaquePixels(sheet.canvas) > 0, 'la feuille contient bien ses frames');
});

test('feuille de frames : une feuille vide ne casse pas le rendu', () => {
  const sheet = new FrameSheet([], 20, 30, 10, 20);
  assert.equal(sheet.canvas.width >= 1, true, 'la largeur reste strictement positive');
  assert.equal(sheet.canvas.height >= 1, true);
});

test('feuille de frames : l index boucle proprement', () => {
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('canvas');
    c.width = 10;
    c.height = 10;
    frames.push(c);
  }
  const sheet = new FrameSheet(frames, 10, 10, 5, 5);
  const ctx = document.createElement('canvas');
  ctx.width = 40;
  ctx.height = 20;
  const g = ctx.getContext('2d');
  for (const idx of [0, 3, 4, -1, 9]) {
    g.calls.drawImage = 0;
    sheet.draw(g, idx, 0, 0);
    assert.equal(g.calls.drawImage, 1, `index ${idx} dessine exactement une frame`);
  }
});

test('animation : chaque acteur produit une feuille qui contient du dessin', () => {
  clearAnimCache();
  const spec = { shape: 'humanoid', w: 28, h: 42 };
  const sheet = actorSheet('humanoid', spec, 'hsl(30 46% 80%)');
  assert.equal(sheet.count, 8, 'huit poses par acteur');
  // On verifie les FRAMES, pas la feuille : la composition du gabarit de
  // test ne rasterise pas les images, seul le remplissage des sources.
  for (let i = 0; i < sheet.count; i++) {
    assert.ok(opaquePixels(sheet.frames[i]) > 40, `frame ${i} : la pose est dessinee`);
  }
});

test('animation : les quatre familles de forme sont couvertes', () => {
  clearAnimCache();
  const cases = [
    ['humanoid', { shape: 'humanoid', w: 28, h: 42 }],
    ['tall', { shape: 'tall', w: 24, h: 56 }],
    ['blob', { shape: 'blob', w: 40, h: 34 }],
    ['quad', { shape: 'quad', w: 40, h: 26 }],
  ];
  for (const [kind, spec] of cases) {
    clearAnimCache();
    const sheet = actorSheet(kind, spec, 'hsl(200 30% 50%)');
    assert.ok(opaquePixels(sheet.frames[0]) > 40, `${kind} : la pose est dessinee`);
  }
});

test('animation : deux acteurs de meme forme ne partagent pas leur feuille', () => {
  clearAnimCache();
  const spec = { shape: 'humanoid', w: 28, h: 42 };
  const a = actorSheet('humanoid', spec, 'hsl(30 46% 80%)');
  const b = actorSheet('humanoid', spec, 'hsl(30 46% 80%)');
  const c = actorSheet('humanoid', spec, 'hsl(210 30% 60%)');
  assert.equal(a, b, 'le cache sert a eviter de regenerer 8 frames par image');
  assert.notEqual(a, c, 'une couleur differente donne une feuille differente');
});

test('animation : les poses de marche sont bornees et centrees', () => {
  for (let i = 0; i < 16; i++) {
    const p = walkPose(i / 16);
    assert.ok(Number.isFinite(p.front) && Number.isFinite(p.back));
    assert.ok(Math.abs(p.front) <= 3.41 && Math.abs(p.back) <= 3.41, 'debattement borne');
    // Regression : une foulée plus longue que la jambe met le personnage en
    // fente, et la silhouette cesse de lire comme un marcheur.
    assert.ok(Math.abs(p.front) < 3.4 / 0.34, 'la foulée reste plus courte que la jambe');
    assert.ok(Math.abs(p.lift) <= 3.5, 'le pied ne vole pas');
    assert.ok(p.bob <= 0, 'le buste descend jamais sous sa position de repos');
    assert.ok(Math.abs(p.lean) < 0.1, 'l inclinaison reste lisible');
  }
});

test('animation : le cycle est continu — la pose 1.0 vaut la pose 0.0', () => {
  const a = walkPose(0);
  const b = walkPose(1);
  for (const k of Object.keys(a)) {
    assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k} ne discontinue pas sur la boucle`);
  }
});

test('animation : les jambes bougent en opposition de phase', () => {
  const mid = walkPose(0.25);
  assert.ok(mid.front * mid.back < 0, 'une jambe devant, une derriere');
  assert.ok(Math.abs(mid.front) > 2.5, 'l amplitude est visible');
});

test('animation : la masse informe se comprime et s etire', () => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 16; i++) {
    const p = blobPose(i / 16);
    min = Math.min(min, p.squash);
    max = Math.max(max, p.squash);
  }
  assert.ok(max - min > 0.08, 'la deformation est perceptible');
  assert.ok(min > 0.9 && max < 1.1, 'sans exageration : la silhouette reste lisible');
});

test('animation : le quadrupede decale ses quatre membres', () => {
  const p = quadPose(0.125);
  assert.ok(p.frontA * p.frontB < 0, 'les deux membres avant sont opposes');
  assert.ok(p.backA * p.backB < 0, 'les deux membres arriere sont opposes');
  // Un galop synchronise les DIAGONALES : avant-gauche avec arriere-droit.
  assert.ok(p.frontA * p.backB > 0, 'diagonale avant-gauche / arriere-droite en phase');
  assert.ok(p.frontB * p.backA > 0, 'diagonale avant-droite / arriere-gauche en phase');
});