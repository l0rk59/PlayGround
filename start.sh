#!/usr/bin/env bash
# NEON DEAD — build the static bundle into ./dist and serve it (foreground).
#
# - changes to its own directory, installs dependencies when present,
#   copies the static game files into ./dist (kept inside PROJECT_DIR),
# - writes {"project","directory"} to $OPENCODE_WEB_DIR/deployment-output.json
#   (worker metadata only),
# - serves ./dist on $PORT (default 3000) in the foreground.
set -euo pipefail

cd "$(dirname "$0")"
/usr/bin/time -p pwd
PROJECT_DIR="$(pwd)"
DIST_DIR="$PROJECT_DIR/dist"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
export PORT="${PORT:-3000}"
export DIST_DIR

# 1) dependencies (this project ships dependency-free static HTML/JS)
/usr/bin/time -p bash -c 'if [ -f package.json ]; then if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi; else echo "no package.json: nothing to install"; fi'

# 2) build: copy the static game files into ./dist (inside PROJECT_DIR)
/usr/bin/time -p rm -rf "$DIST_DIR"
/usr/bin/time -p mkdir -p "$DIST_DIR/src" "$DIST_DIR/vendor"
/usr/bin/time -p cp "$PROJECT_DIR/index.html" "$DIST_DIR/index.html"
/usr/bin/time -p cp "$PROJECT_DIR"/src/*.js "$DIST_DIR/src/"
/usr/bin/time -p cp -r "$PROJECT_DIR/vendor/three" "$DIST_DIR/vendor/three"
/usr/bin/time -p ls "$DIST_DIR/index.html" "$DIST_DIR/vendor/three/three.module.js"

# 3) deployment metadata (worker metadata dir only, never game content)
/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p bash -c 'printf "{\"project\": \"%s\", \"directory\": \"%s\"}\n" "$PROJECT_DIR" "$DIST_DIR" > "$WEB_DIR/deployment-output.json"'
/usr/bin/time -p cat "$WEB_DIR/deployment-output.json"

# 4) serve ./dist in the foreground
exec /usr/bin/time -p node <<'NODE_EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.env.DIST_DIR;
const port = Number(process.env.PORT || 3000);
if (!root || !fs.existsSync(path.join(root, 'index.html'))) {
  console.error('dist/index.html missing, refusing to serve');
  process.exit(1);
}
const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const resolved = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const base = path.resolve(root);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      res.writeHead(403); res.end(); return;
    }
    let file = resolved;
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    } catch { res.writeHead(404); res.end('Not found'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  } catch { res.writeHead(500); res.end(); }
});
server.listen(port, '0.0.0.0', () => console.log(`NEON DEAD serving ${root} on :${port}`));
NODE_EOF
