// Génère les icônes de l'application (PNG multi-densités) sans dépendance externe.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- writer PNG minimal (RGBA, zlib) -------------------------------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

// --- dessin ----------------------------------------------------------
// Face de zombie stylisée : fond dégradé, crâne néon, yeux rouges
function drawIcon(S, opts = {}) {
  const px = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const ia = a / 255;
    px[i] = Math.round(px[i] * (1 - ia) + r * ia);
    px[i + 1] = Math.round(px[i + 1] * (1 - ia) + g * ia);
    px[i + 2] = Math.round(px[i + 2] * (1 - ia) + b * ia);
    px[i + 3] = Math.min(255, px[i + 3] + a);
  };
  const cx = S / 2, cy = S / 2;

  // fond : dégradé violet sombre + lueur magenta en bas
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const t = y / S, u = x / S;
    let r = 10 + t * 46 + (1 - Math.hypot(u - .5, t - .95)) * 60;
    let g = 6 + t * 10 + (1 - Math.hypot(u - .5, t - .95)) * 8;
    let b = 26 + t * 30 + (1 - Math.hypot(u - .5, t - .95)) * 40;
    // grille cyberpunk
    const grid = ((x % (S / 12)) < 1 || (y % (S / 12)) < 1) ? 12 : 0;
    set(x, y, Math.min(255, r + grid), Math.min(255, g + grid), Math.min(255, b + grid), 255);
  }

  // halo circulaire
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - cx, y - cy) / (S * 0.46);
    if (d < 1) {
      const glow = Math.pow(1 - d, 2.4) * 70;
      set(x, y, 0, 200, 255, Math.round(glow));
    }
  }

  // crâne (ellipse)
  const rx = S * 0.30, ry = S * 0.345;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x - cx) / rx, ny = (y - cy * 0.94) / ry;
    const d = nx * nx + ny * ny;
    if (d <= 1) {
      const rim = d > 0.82;
      // dégradé du crâne
      const sh = 1 - Math.max(0, (y - cy * 0.5) / S) * 0.5;
      let r = 26 * sh + (rim ? 60 : 0);
      let g = 30 * sh + (rim ? 190 : 0);
      let b = 40 * sh + (rim ? 220 : 0);
      set(x, y, r, g, b, 255);
    }
  }

  // mâchoire
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x - cx) / (S * 0.20), ny = (y - cy * 1.16) / (S * 0.15);
    if (nx * nx + ny * ny <= 1) {
      const rim = (nx * nx + ny * ny) > 0.6;
      set(x, y, rim ? 60 : 18, rim ? 200 : 22, rim ? 230 : 32, 255);
    }
  }

  // yeux rouges lumineux
  for (const [ex, ey] of [[-S * 0.135, -S * 0.035], [S * 0.135, -S * 0.035]]) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - (cx + ex), y - (cy * 0.94 + ey)) / (S * 0.072);
      if (d < 1.6) {
        const a = d < 1 ? 255 : Math.round(255 * (1.6 - d) / .6 * .8);
        set(x, y, 255, 45, 70, a);
      }
    }
  }

  // dents
  for (let i = -3; i <= 3; i++) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const tx = cx + i * S * 0.055, ty = cy * 1.17 + S * 0.012;
      if (Math.abs(x - tx) < S * 0.022 && y > ty && y < ty + S * 0.045)
        set(x, y, 200, 230, 240, 230);
    }
  }

  // lueur néon cyan sur le contour du crâne
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x - cx) / rx, ny = (y - cy * 0.94) / ry;
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d > 0.94 && d < 1.16) {
      const a = Math.round(190 * (1.16 - d) / 0.22);
      set(x, y, 0, 232, 255, a);
    }
  }
  return px;
}

const RES = path.join(__dirname, 'app/src/main/res');
const DENS = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };
for (const [dir, S] of Object.entries(DENS)) {
  const d = path.join(RES, dir);
  fs.mkdirSync(d, { recursive: true });
  const px = drawIcon(S);
  writePNG(path.join(d, 'ic_launcher.png'), S, S, px);
  // icône ronde (legacy)
  const px2 = Buffer.from(px);
  const r = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const inside = Math.hypot(x - S / 2, y - S / 2) <= S / 2 - .5;
    r[i] = px2[i]; r[i + 1] = px2[i + 1]; r[i + 2] = px2[i + 2];
    r[i + 3] = inside ? px2[i + 3] : 0;
  }
  writePNG(path.join(d, 'ic_launcher_round.png'), S, S, r);
  console.log('icone', dir, S + 'x' + S);
}

// --- icône adaptative (API 26+) : foreground vectorisé + background ---
fs.mkdirSync(path.join(RES, 'mipmap-anydpi-v26'), { recursive: true });
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26/ic_launcher.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_bg"/>
    <foreground android:drawable="@drawable/ic_fg"/>
</adaptive-icon>`);
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26/ic_launcher_round.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_bg"/>
    <foreground android:drawable="@drawable/ic_fg"/>
</adaptive-icon>`);
fs.writeFileSync(path.join(RES, 'drawable/ic_bg.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:type="linear" android:angle="270"
        android:startColor="#0A0A1E" android:centerColor="#140A2E" android:endColor="#2A1030"/>
</shape>`);
fs.writeFileSync(path.join(RES, 'drawable/ic_fg.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <!-- crâne -->
    <path android:fillColor="#1A2430" android:pathData="M54,26 C66,26 74,36 74,48 C74,56 71,60 69,63 L69,70 L39,70 L39,63 C37,60 34,56 34,48 C34,36 42,26 54,26 Z"/>
    <path android:strokeColor="#00E8FF" android:strokeWidth="2.4" android:fillColor="#00000000"
        android:pathData="M54,26 C66,26 74,36 74,48 C74,56 71,60 69,63 L69,70 L39,70 L39,63 C37,60 34,56 34,48 C34,36 42,26 54,26 Z"/>
    <!-- yeux -->
    <path android:fillColor="#FF2D50" android:pathData="M43,48 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0"/>
    <path android:fillColor="#FF2D50" android:pathData="M65,48 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0"/>
    <!-- mâchoire + dents -->
    <path android:fillColor="#2A3A48" android:pathData="M44,70 L64,70 L64,76 L44,76 Z"/>
    <path android:fillColor="#C8E6F5" android:pathData="M47,70 L49,70 L49,75 L47,75 Z M52,70 L54,70 L54,75 L52,75 Z M57,70 L59,70 L59,75 L57,75 Z"/>
</vector>`);
console.log('icones adaptatives OK');