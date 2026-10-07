// vérifie que chaque import nommé existe bien dans le module cible
const fs = require('fs'), path = require('path');
let bad = 0;
for (const f of fs.readdirSync('src')) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join('src', f), 'utf8');
  const re = /import\s*\{([^}]+)\}\s*from\s*'\.\/([a-z]+\.js)'/g;
  let m;
  while ((m = re.exec(src))) {
    const names = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const target = fs.readFileSync(path.join('src', m[2]), 'utf8');
    for (const n of names) {
      const exported = new RegExp(`export\\s+(const|let|var|function|class|async function)\\s+${n}\\b|export\\s*\\{[^}]*\\b${n}\\b`);
      if (!exported.test(target)) { console.log(`✗ ${f} importe "${n}" de ${m[2]} — ABSENT`); bad++; }
    }
  }
}
console.log(bad ? `\n${bad} import(s) cassé(s)` : '✓ Tous les imports sont valides');
