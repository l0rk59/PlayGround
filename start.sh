#!/usr/bin/env bash
# Serve the built static app in the foreground on PORT (default 3000).
# Writes deployment-output.json for the controller. Only PROJECT_DIR holds
# source/build output; OPENCODE_WEB_DIR/RUNNER_TEMP are metadata only.
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p pwd
PROJECT_DIR="$PWD"
export PROJECT_DIR
/usr/bin/time -p bash -c 'echo "project=$PWD port=${PORT:-3000}"'
PORT="${PORT:-3000}"
export PORT
DIST="$PROJECT_DIR/dist"
export DIST_DIR="$DIST"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
export OPENCODE_WEB_DIR="$WEB_DIR"
/usr/bin/time -p mkdir -p "$DIST" "$WEB_DIR"
/usr/bin/time -p bash -c 'test -f dist/index.html || test -f index.html'
# Rebuild dist from source when a source index.html exists (no external deps).
if /usr/bin/time -p test -f "$PROJECT_DIR/index.html"; then
  /usr/bin/time -p cp -f "$PROJECT_DIR/index.html" "$DIST/index.html"
fi
# Optional npm/vite path: install + build only when package.json requires it.
if /usr/bin/time -p test -f "$PROJECT_DIR/package.json"; then
  if /usr/bin/time -p bash -c 'node -e "const p=require(\"./package.json\");process.exit(p.dependencies?.vite||p.devDependencies?.vite?0:1)"'; then
    /usr/bin/time -p npm install --no-audit --no-fund
    /usr/bin/time -p npm run build
  fi
fi
/usr/bin/time -p bash -c 'test -f "$0/dist/index.html" || test -f "$0/index.html"' "$PROJECT_DIR"
/usr/bin/time -p bash -c 'case "$0" in "$1"/*) ;; *) echo "built output must stay inside PROJECT_DIR" >&2; exit 1;; esac' "$DIST" "$PROJECT_DIR"
# Publish deployment metadata (controller reads this file).
/usr/bin/time -p node -e 'const fs=require("fs"),path=require("path");const root=process.env.PROJECT_DIR||process.cwd();const dir=path.resolve(root,"dist");if(!fs.existsSync(path.join(dir,"index.html")))throw new Error("dist/index.html missing");const web=process.env.OPENCODE_WEB_DIR||"/home/runner/work/_temp/omgithub-web";fs.mkdirSync(web,{recursive:true});fs.writeFileSync(path.join(web,"deployment-output.json"),JSON.stringify({project:root,directory:dir}));console.log("deployment-output.json -> "+path.join(web,"deployment-output.json"));'
# Serve the built directory in the foreground (controller reuses healthy server).
/usr/bin/time -p node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const root=process.env.DIST_DIR||path.join(process.cwd(),"dist");
const port=Number(process.env.PORT||3000);
const mime={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".wasm":"application/wasm"};
http.createServer((req,res)=>{
  try{
    const u=new URL(req.url,"http://localhost");
    let p=path.normalize(path.join(root,decodeURIComponent(u.pathname)));
    if(!p.startsWith(root)) {res.writeHead(404);res.end();return;}
    if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,"index.html");
    if(!fs.existsSync(p))p=path.join(root,"index.html");
    res.writeHead(200,{"Content-Type":mime[path.extname(p)]||"application/octet-stream","Cache-Control":"no-cache"});
    fs.createReadStream(p).pipe(res);
  }catch(e){res.writeHead(404);res.end("Not found");}
}).listen(port,"0.0.0.0",()=>console.log("serving "+root+" on "+port));
'
