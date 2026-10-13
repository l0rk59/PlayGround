#!/usr/bin/env bash
# Capture desktop + mobile screenshots of CAPTURE_URL into CAPTURE_DIR.
# Leaves the app running; output stays outside the source tree.
# Exit 75 = temporary navigation/browser infra failure; exit 1 = script/render defect.
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p pwd
/usr/bin/time -p bash -c 'echo "capture url=${CAPTURE_URL:-<unset>} dir=${CAPTURE_DIR:-<unset>}"'
if [[ -z "${CAPTURE_URL:-}" || -z "${CAPTURE_DIR:-}" ]]; then
  echo "Set CAPTURE_URL and CAPTURE_DIR." >&2
  exit 1
fi
case "$CAPTURE_URL" in
  http://*|https://*) ;;
  *) echo "CAPTURE_URL must be http(s)." >&2; exit 1;;
esac
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p bash -c 'test -n "$0"' "$CAPTURE_URL"
status=0
/usr/bin/time -p node -e '
const fs=require("fs"),path=require("path"),os=require("os");
const {createRequire}=require("node:module");
const url=process.env.CAPTURE_URL,out=process.env.CAPTURE_DIR;
if(!url||!out)throw new Error("Set CAPTURE_URL and CAPTURE_DIR.");
const runtime=path.join(os.homedir(),".local/share/omgithub-playwright");
const req=createRequire(path.join(runtime,"package.json"));
const {chromium}=req("playwright");
const cfg=JSON.parse(fs.readFileSync(path.join(runtime,process.platform==="darwin"?"metal.json":"linux.json"),"utf8"));
if(process.platform==="linux"&&!process.env.DISPLAY){
  try{process.env.DISPLAY=":"+fs.readFileSync(path.join(runtime,"display"),"utf8").trim();}catch{}
}
const transient=e=>{throw Object.assign(e,{exitCode:75});};
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({...cfg.browser.launchOptions,timeout:30000}).catch(transient);
    for(const [name,width,height] of [["desktop",1440,900],["mobile",390,844]]){
      const page=await browser.newPage({viewport:{width,height}}).catch(transient);
      page.setDefaultTimeout(30000);
      page.on("pageerror",e=>console.error(e.message));
      const resp=await page.goto(url,{waitUntil:"load",timeout:45000}).catch(transient);
      if(!resp?.ok()){
        const s=resp?.status();
        throw Object.assign(new Error("HTTP "+s+" loading preview"),{exitCode:!resp||[408,429,500,502,503,504].includes(s)?75:1});
      }
      await page.locator(process.env.CAPTURE_READY_SELECTOR||"body").waitFor({state:"visible"}).catch(e=>{throw Object.assign(e,{exitCode:1});});
      await page.waitForFunction(()=>document.fonts.status==="loaded").catch(()=>{});
      await page.waitForTimeout(1000);
      await page.screenshot({path:path.join(out,"final-"+name+".png"),timeout:30000}).catch(e=>{
        if(e.name==="TimeoutError"||!browser.isConnected())transient(e);
        throw e;
      });
      console.log("captured "+name);
      await page.close();
    }
  }catch(e){console.error(e);process.exitCode=e.exitCode||1;}
  finally{await browser?.close().catch(e=>{console.error(e);process.exitCode||=75;});}
})();
' || status=$?
if [[ "$status" -ne 0 ]]; then
  echo "capture node failed with exit $status" >&2
  exit "$status"
fi
/usr/bin/time -p bash -c 'test -f "$0/final-desktop.png" && test -f "$0/final-mobile.png"' "$CAPTURE_DIR"
exit 0
