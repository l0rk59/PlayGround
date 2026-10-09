#!/usr/bin/env bash
# ============================================================================
#  Hood Grow — construction de l'APK (sans Gradle, sans réseau)
#
#  Chaîne d'outils : aapt2 (compile + link) -> javac -> d8 -> zipalign -> apksigner
#  Le jeu est embarqué dans les assets : l'APK fonctionne sans connexion.
#
#  Usage :
#     bash android/build-apk.sh                 # APK de debug, version 1.0.0
#     VERSION=1.1.0 bash android/build-apk.sh  # autre version
#     KS=mon.keystore KS_PASS=secret bash android/build-apk.sh
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"

VERSION="${VERSION:-1.0.0}"
VERSION_CODE="${VERSION_CODE:-1}"
KS="${KS:-$HERE/tools/hoodgrow.keystore}"
KS_PASS="${KS_PASS:-android}"
KS_ALIAS="${KS_ALIAS:-hoodgrow}"
OUT_DIR="$HERE/dist"
NAME="hood-grow-${VERSION}.apk"

# --- outils du SDK -----------------------------------------------------------
BT="${BUILD_TOOLS:-}"
if [[ -z "$BT" ]]; then
  BT="$(ls -1 "$SDK/build-tools" | sort -V | tail -1)"
fi
BT_DIR="$SDK/build-tools/$BT"
ANDROID_JAR="$SDK/platforms/android-${COMPILE_SDK:-34}/android.jar"
for f in "$BT_DIR/aapt2" "$BT_DIR/d8" "$BT_DIR/zipalign" "$BT_DIR/apksigner" "$ANDROID_JAR"; do
  [[ -e "$f" ]] || { echo "❌ outil manquant : $f" >&2; exit 1; }
done

BUILD="$HERE/build"
ASSETS="$HERE/app/src/main/assets/game"
rm -rf "$BUILD"
mkdir -p "$BUILD/res" "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$OUT_DIR"

echo "▸ Hood Grow $VERSION (versionCode $VERSION_CODE)"
echo "  SDK      : $SDK"
echo "  build    : $BT_DIR"

# --- 1. assets du jeu -------------------------------------------------------
# index.html + three.module.js, numéro de version injecté dans le jeu
mkdir -p "$ASSETS"
cp "$ROOT/index.html" "$ASSETS/index.html"
cp "$ROOT/three.module.js" "$ASSETS/three.module.js"
rm -rf "$ASSETS/vendor" && cp -r "$ROOT/vendor" "$ASSETS/vendor"
python3 - "$ASSETS/index.html" "$VERSION" <<'PY'
import re, sys
path, ver = sys.argv[1], sys.argv[2]
s = open(path, encoding='utf-8').read()
if not re.search(r"const HG_VER='[^']*'", s):
    raise SystemExit('HG_VER introuvable dans index.html')
open(path, 'w', encoding='utf-8').write(
    re.sub(r"const HG_VER='[^']*'", "const HG_VER='%s'" % ver, s, count=1))
PY
echo "  assets   : index.html + three.module.js (hors-ligne)"

# --- 2. compilation des ressources ------------------------------------------
"$BT_DIR/aapt2" compile --dir "$HERE/app/src/main/res" -o "$BUILD/res/resources.zip"
echo "  aapt2    : ressources compilées"

# --- 3. linkage (génère aussi R.java) ---------------------------------------
# le manifeste est versionné : on n'écrit jamais dans les sources
python3 - "$HERE/app/src/main/AndroidManifest.xml" "$BUILD/AndroidManifest.xml" "$VERSION_CODE" "$VERSION" <<'PYMAN'
import sys,re
src,dst,code,name=sys.argv[1:5]
t=open(src,encoding='utf-8').read()
t=re.sub(r'android:versionCode="[0-9]+"', 'android:versionCode="%s"'%code, t, count=1)
t=re.sub(r'android:versionName="[^"]*"', 'android:versionName="%s"'%name, t, count=1)
open(dst,'w',encoding='utf-8').write(t)
PYMAN
"$BT_DIR/aapt2" link \
  -o "$BUILD/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$BUILD/AndroidManifest.xml" \
  -R "$BUILD/res/resources.zip" \
  -A "$HERE/app/src/main/assets" \
  --java "$BUILD/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION" \
  --auto-add-overlay \
  --no-version-vectors
echo "  aapt2    : APK de base généré"

# --- 4. compilation Java ----------------------------------------------------
find "$HERE/app/src/main/java" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -nowarn --release 8 -encoding UTF-8 \
  -classpath "$ANDROID_JAR" \
  -d "$BUILD/classes" \
  @"$BUILD/sources.txt" 2>&1 | grep -v 'bootstrap class path\|deprecat' || true
[[ -f "$BUILD/classes/com/hoodgrow/game/MainActivity.class" ]] || { echo "❌ compilation Java échouée" >&2; exit 1; }
echo "  javac    : $(wc -l < "$BUILD/sources.txt") source(s)"

# --- 5. dex -----------------------------------------------------------------
find "$BUILD/classes" -name '*.class' > "$BUILD/classes.txt"
"$BT_DIR/d8" --lib "$ANDROID_JAR" --min-api 24 --release \
  --output "$BUILD/dex" @"$BUILD/classes.txt"
echo "  d8       : classes.dex ($(stat -c%s "$BUILD/dex/classes.dex") octets)"

# --- 6. assemblage ----------------------------------------------------------
cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
( cd "$BUILD/dex" && zip -q -X "$BUILD/unsigned.apk" classes.dex )
"$BT_DIR/zipalign" -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

# --- 7. signature -----------------------------------------------------------
if [[ ! -f "$KS" ]]; then
  echo "  keystore : création d'une clé ($KS_ALIAS)"
  keytool -genkeypair -v -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Hood Grow, OU=Jeu, O=Hood Grow, L=Paris, C=FR" >/dev/null 2>&1
fi
"$BT_DIR/apksigner" sign \
  --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --ks-key-alias "$KS_ALIAS" \
  --min-sdk-version 24 \
  --out "$OUT_DIR/$NAME" "$BUILD/aligned.apk"
rm -f "$OUT_DIR/$NAME.idsig"   # signature v4 inutile à l'installation
"$BT_DIR/apksigner" verify --min-sdk-version 24 "$OUT_DIR/$NAME" >/dev/null

SIZE=$(du -h "$OUT_DIR/$NAME" | cut -f1)
echo
echo "✅ APK prêt : $OUT_DIR/$NAME ($SIZE)"
echo "   contenu :"
unzip -l "$OUT_DIR/$NAME" | awk '/assets\/game|classes.dex|AndroidManifest|ic_launcher/{printf "     %-46s %8s\n",$4,$1}' | head -12
echo "   install : adb install -r \"$OUT_DIR/$NAME\""