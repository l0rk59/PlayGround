#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
PORT="${PORT:-3000}"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
DIST="$PROJECT_DIR/dist"
export PORT OPENCODE_WEB_DIR
export DIST_DIR="$DIST"
/usr/bin/time -p mkdir -p "$DIST" "$OPENCODE_WEB_DIR"
# Install + build only when a package project exists; otherwise serve static dist.
if /usr/bin/time -p test -f "$PROJECT_DIR/package.json"; then
  if /usr/bin/time -p test -f "$PROJECT_DIR/package-lock.json"; then
    /usr/bin/time -p npm ci --no-audit --no-fund --prefix "$PROJECT_DIR"
  else
    /usr/bin/time -p npm install --no-audit --no-fund --prefix "$PROJECT_DIR"
  fi
  if /usr/bin/time -p node -e "process.exit(require('./package.json').scripts?.build?0:1)"; then
    /usr/bin/time -p npm run build --prefix "$PROJECT_DIR"
  fi
fi
# Fallback: guarantee a renderable static page so deployment never 404s.
if ! /usr/bin/time -p test -f "$DIST/index.html"; then
  /usr/bin/time -p bash -c 'cat > "$0/index.html" <<'"'"'HTML'"'"'
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PlayGround 3D</title></head><body style="margin:0;background:#0b1020;color:#e8ecf8;font-family:system-ui"><h1 style="padding:16px">PlayGround 3D — fallback build</h1><canvas id="g" style="width:100%;height:60vh;display:block"></canvas><script>const c=document.getElementById("g"),x=c.getContext("2d");(function f(){const r=c.parentElement.getBoundingClientRect();c.width=r.width;c.height=400;x.fillStyle="#0b1020";x.fillRect(0,0,c.width,c.height);x.strokeStyle="#22d3ee";x.lineWidth=3;const t=Date.now()/1000,s=80+Math.sin(t*2)*10;x.save();x.translate(c.width/2,200);x.rotate(t*.5);x.strokeRect(-s/2,-s/2,s,s);x.restore();requestAnimationFrame(f)})()</script></body></html>
HTML
' "$DIST"
fi
/usr/bin/time -p node -e 'const fs=require("fs");const web=process.env.OPENCODE_WEB_DIR||"/home/runner/work/_temp/omgithub-web";const project="/home/runner/work/PlayGround/PlayGround";const dir=require("path").resolve(project,"dist");fs.mkdirSync(web,{recursive:true});fs.writeFileSync(require("path").join(web,"deployment-output.json"),JSON.stringify({project,directory:dir}));console.log("deployment-output:",JSON.stringify({project,directory:dir}))'
/usr/bin/time -p test -f "$DIST/index.html"
/usr/bin/time -p test -f "$OPENCODE_WEB_DIR/deployment-output.json"
exec /usr/bin/time -p node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const root=process.env.DIST_DIR||"/home/runner/work/PlayGround/PlayGround/dist";
const port=Number(process.env.PORT||3000);
const mime={".html":"text/html",".js":"application/javascript",".mjs":"application/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".wasm":"application/wasm",".glb":"model/gltf-binary"};
http.createServer((req,res)=>{try{
  const u=new URL(req.url,"http://localhost");
  let p=path.resolve(root,"."+decodeURIComponent(u.pathname));
  if(p!==path.resolve(root)&&!p.startsWith(path.resolve(root)+path.sep)){res.writeHead(404);res.end();return;}
  try{if(fs.statSync(p).isDirectory())p=path.join(p,"index.html");}catch{ p=path.join(root,"index.html"); }
  res.setHeader("Content-Type",mime[path.extname(p)]||"application/octet-stream");
  res.setHeader("Cache-Control","no-cache");
  res.end(fs.readFileSync(p));
}catch(e){res.writeHead(404);res.end("Not found");}}).listen(port,"0.0.0.0",()=>console.log("serving "+root+" on "+port));
'
