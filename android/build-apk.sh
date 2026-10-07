#!/usr/bin/env bash
# ============================================================================
#  build-apk.sh — construit NEON DEAD en APK Android (sans Gradle, via aapt2)
#
#  Usage :  ./android/build-apk.sh
#  Sortie : android/dist/neon-dead.apk
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
PROJECT="$(dirname "$ROOT")"

# ---------- configuration ----------
APK_NAME="neon-dead"
PACKAGE="com.neondead.game"
VERSION_CODE="2"
VERSION_NAME="2.0"
MIN_SDK="24"           # Android 7.0
TARGET_SDK="34"

# ---------- SDK ----------
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
BUILD_TOOLS_DIR="$(ls -1d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$BUILD_TOOLS_DIR" ]; then
  echo "❌ Build-tools introuvable. Installe le SDK Android ou définis ANDROID_HOME." >&2
  exit 1
fi
BT="${BUILD_TOOLS_DIR%/}"
PLATFORM_DIR="$(ls -1d "$SDK"/platforms/android-$TARGET_SDK/ 2>/dev/null | head -1 || true)"
if [ -z "$PLATFORM_DIR" ]; then
  echo "❌ Plateforme android-$TARGET_SDK introuvable." >&2
  exit 1
fi
AAPT2="$BT/aapt2"
AAB="$PLATFORM_DIR/android.jar"
D8="$BT/d8"

echo "▶ SDK        : $SDK"
echo "▶ Build-tools: $BT"
echo "▶ Plateforme : ${PLATFORM_DIR%/}"
echo "▶ Java       : $(java -version 2>&1 | head -1)"

BUILD="$ROOT/build"
rm -rf "$BUILD"
mkdir -p "$BUILD/compiled" "$BUILD/classes" "$BUILD/assets" "$BUILD/gen" "$ROOT/dist"

# ---------- 1. assets : le jeu ----------
echo "▶ [1/5] Copie du jeu dans assets/www …"
mkdir -p "$BUILD/assets/www"
cp "$PROJECT/index.html"            "$BUILD/assets/www/"
cp "$PROJECT/startup.sh"           "$BUILD/assets/www/" 2>/dev/null || true
mkdir -p "$BUILD/assets/www/src"
cp "$PROJECT"/src/*.js              "$BUILD/assets/www/src/"
mkdir -p "$BUILD/assets/www/vendor"
cp -r "$PROJECT/vendor/three"       "$BUILD/assets/www/vendor/"
# les fichiers .sh/start.sh ne servent pas sur Android
rm -f "$BUILD/assets/www/startup.sh"
echo "   $(du -sh "$BUILD/assets/www" | cut -f1) copiés"

# ---------- 2. ressources ----------
echo "▶ [2/5] Traitement des ressources (aapt2) …"
"$AAPT2" compile --dir "$ROOT/app/src/main/res" -o "$BUILD/compiled/res.zip"
"$AAPT2" link \
  -o "$BUILD/base.apk" \
  -I "$AAB" \
  --manifest "$ROOT/app/src/main/AndroidManifest.xml" \
  -R "$BUILD/compiled/res.zip" \
  --java "$BUILD/gen" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  --package-id 0x7f \
  --auto-add-overlay \
  --no-version-vectors

# ---------- 3. java -> dex ----------
echo "▶ [3/5] Compilation Java (javac) …"
find "$ROOT/app/src/main/java" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -source 8 -target 8 -nowarn \
  -classpath "$AAB" \
  -d "$BUILD/classes" \
  @"$BUILD/sources.txt" 2>&1 | grep -v "bootstrap class path\|source value 8\|target value 8\|deprecat" || true

echo "▶ [3/5] Conversion en dex (d8) …"
find "$BUILD/classes" -name '*.class' > "$BUILD/classes.txt"
"$D8" --lib "$AAB" --min-api "$MIN_SDK" --output "$BUILD" @"$BUILD/classes.txt"

# ---------- 4. clé de signature ----------
KEYSTORE="$ROOT/neondead.keystore"
KS_PASS="neondead"
if [ ! -f "$KEYSTORE" ]; then
  echo "▶ [4/5] Génération du keystore de signature …"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias neondead \
    -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=NEON DEAD, OU=Games, O=NEON DEAD, L=Neo-Kyoto, ST=District 7, C=JP" \
    >/dev/null 2>&1
fi

# ---------- 5. signature ----------
echo "▶ [5/5] Assemblage et signature de l'APK …"
APK_UNSIGNED="$BUILD/$APK_NAME-unsigned.apk"
cp "$BUILD/base.apk" "$APK_UNSIGNED"
cd "$BUILD"
# assets
zip -q -r "$APK_UNSIGNED" assets -x '.*'
# dex
if [ -f classes.dex ]; then zip -q "$APK_UNSIGNED" classes.dex; fi
cd "$ROOT"

APKSIGNER="$BT/zipalign"
ALIGNED="$BUILD/$APK_NAME-aligned.apk"
"$APKSIGNER" -f -p 4 "$APK_UNSIGNED" "$ALIGNED"

APKSIGNERJAR="$BT/apksigner"
if [ -x "$APKSIGNERJAR" ] || [ -f "$APKSIGNERJAR" ]; then
  "$APKSIGNERJAR" sign \
    --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --ks-key-alias neondead \
    --out "$ROOT/dist/$APK_NAME.apk" "$ALIGNED"
else
  jarsigner -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    "$ALIGNED" neondead >/dev/null 2>&1
  cp "$ALIGNED" "$ROOT/dist/$APK_NAME.apk"
fi

rm -f "$ALIGNED" "$APK_UNSIGNED"

echo ""
echo "✅ APK construit : android/dist/$APK_NAME.apk"
ls -lh "$ROOT/dist/$APK_NAME.apk" | awk '{print "   taille : " $5}'
"$AAPT2" dump badging "$ROOT/dist/$APK_NAME.apk" 2>/dev/null | head -3 | sed 's/^/   /' || true
echo ""
echo "Installation :  adb install -r dist/$APK_NAME.apk"