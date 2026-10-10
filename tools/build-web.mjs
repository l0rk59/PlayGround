#!/usr/bin/env node
/* Assemble index.html à partir des sources.
 *
 * Pourquoi un assemblage plutôt que des modules ES ?
 * Le code est un seul module dont l'ordre d'exécution compte (let/const en
 * TDZ, fonctions mutuellement récursives). Découper en modules ES introduirait
 * un risque de régression à chaque import. Ici on ne fait que RECOLLER les
 * fichiers dans l'ordre du manifeste : le résultat est identique à l'octet
 * près, ce que --check vérifie systématiquement.
 *
 *   node tools/build-web.mjs          assemble index.html
 *   node tools/build-web.mjs --check  vérifie que index.html est à jour
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const manifest = JSON.parse(read('src/manifest.json'));

export function build() {
  const head = read('src/index.head.html').replace(/\n$/, '');
  const body = read('src/index.body.html').replace(/\n$/, '');
  const js = ['src/js/000-imports.js'].concat(manifest.map(m => 'src/js/' + m.file));
  const chunks = js.map(f => {
    // on retire la première ligne d'en-tête « ==== ... ==== »
    return read(f).replace(/\n$/, '').split('\n').slice(1).join('\n');
  });
  return [head, body, '<script type="module">', chunks.join('\n'), '</script>', '</body>', '</html>', ''].join('\n');
}

const out = build();
const current = read('index.html');

if (process.argv.includes('--check')) {
  if (current === out) {
    console.log('✅ index.html est à jour par rapport à src/');
    process.exit(0);
  }
  console.error('❌ index.html ne correspond pas aux sources.');
  console.error('   Lancez : node tools/build-web.mjs');
  const a = current.split('\n'), b = out.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.error(`   première différence ligne ${i + 1} :`);
      console.error(`     fichier : ${JSON.stringify((a[i] || '').slice(0, 70))}`);
      console.error(`     source  : ${JSON.stringify((b[i] || '').slice(0, 70))}`);
      break;
    }
  }
  process.exit(1);
}

if (current === out) {
  console.log('index.html déjà à jour (rien à écrire).');
} else {
  writeFileSync(join(ROOT, 'index.html'), out);
  console.log(`✅ index.html assemblé depuis ${js.length} fichiers (${out.length} octets).`);
}