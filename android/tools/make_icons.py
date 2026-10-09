#!/usr/bin/env python3
"""Génère les icônes PNG de l'application (sans dépendance : encodeur PNG maison)
ainsi que les drawables vectoriels de l'icône adaptative (Android 8+)."""
import math, os, struct, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.normpath(os.path.join(HERE, '..', 'app', 'src', 'main', 'res'))

BG = (0x10, 0x1A, 0x2E)      # fond bleu nuit
GREEN = (0x3D, 0xDC, 0x74)   # feuille claire
GREEN2 = (0x22, 0xB5, 0x73)  # feuille foncée
STEM = (0x3D, 0xDC, 0x74)

DENSITIES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    L2 = vx * vx + vy * vy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / L2))
    dx, dy = wx - t * vx, wy - t * vy
    return math.hypot(dx, dy)


def ellipse(px, py, cx, cy, a, b, rot):
    dx, dy = px - cx, py - cy
    c, s = math.cos(-rot), math.sin(-rot)
    ex, ey = dx * c - dy * s, dx * s + dy * c
    return math.hypot(ex / a, ey / b)


def rounded_rect(px, py, size, radius):
    q = size / 2.0
    dx = max(abs(px - q) - (q - radius), 0.0)
    dy = max(abs(py - q) - (q - radius), 0.0)
    return math.hypot(dx, dy) <= radius


def sample(px, py, size, round_icon):
    """retourne (r,g,b,a) d'un point, ou None si transparent"""
    if round_icon:
        q = size / 2.0
        if math.hypot(px - q, py - q) > q:
            return None
    elif not rounded_rect(px, py, size, size * 0.22):
        return None
    # motif : tige + deux feuilles, unités normalisées 0..1
    u, v = px / size, py / size
    stem_r = 0.028
    if seg_dist(u, v, 0.5, 0.83, 0.5, 0.44) <= stem_r:
        return STEM
    # feuille gauche (haut)
    if ellipse(u, v, 0.375, 0.44, 0.155, 0.105, -0.35) <= 1.0:
        return GREEN
    # feuille droite (bas)
    if ellipse(u, v, 0.625, 0.60, 0.155, 0.105, 0.35) <= 1.0:
        return GREEN2
    return BG


def render(size, round_icon=False, ss=3):
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    px = x + (sx + 0.5) / ss
                    py = y + (sy + 0.5) / ss
                    c = sample(px, py, size, round_icon)
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 255
            n = ss * ss
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                # moyenne pondérée par la couverture
                cov = a / 255.0
                row += bytes((round(r / cov), round(g / cov), round(b / cov), round(a / n)))
        rows.append(bytes(row))
    return rows


def write_png(path, rows, size):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


def main():
    for dens, size in DENSITIES.items():
        d = os.path.join(RES, 'mipmap-' + dens)
        n1 = write_png(os.path.join(d, 'ic_launcher.png'), render(size, False), size)
        n2 = write_png(os.path.join(d, 'ic_launcher_round.png'), render(size, True), size)
        print(f'  mipmap-{dens:<7} {size}x{size}  {n1} + {n2} octets')

    adaptive = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
'''
    for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        p = os.path.join(RES, 'mipmap-anydpi-v26', name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'w').write(adaptive)
        print('  ' + name)

    fg = '''<?xml version="1.0" encoding="utf-8"?>
<!-- motif de l'icône : même feuille que le favicon du jeu, centrée dans la zone sûre -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
  <group android:scaleX="2.6" android:scaleY="2.6" android:translateX="12.4" android:translateY="12.4">
    <path android:pathData="M16,26V14" android:strokeColor="#3DDC74" android:strokeWidth="2.6" android:strokeLineCap="round"/>
    <path android:pathData="M16,16c-5,0 -8,-3 -8,-7 5,0 8,3 8,7z" android:fillColor="#3DDC74"/>
    <path android:pathData="M16,19c5,0 8,-3 8,-7 -5,0 -8,3 -8,7z" android:fillColor="#22B573"/>
  </group>
</vector>
'''
    os.makedirs(os.path.join(RES, 'drawable'), exist_ok=True)
    open(os.path.join(RES, 'drawable', 'ic_launcher_foreground.xml'), 'w').write(fg)
    print('  ic_launcher_foreground.xml')


if __name__ == '__main__':
    print('Icônes générées dans', RES)
    main()