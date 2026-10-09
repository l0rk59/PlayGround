# Hood Grow — application Android (APK)

Le jeu web est **inchangé** : le même `index.html` sert au navigateur **et** à l'application.
L'APK embarque le jeu et `three.module.js` dans ses assets, donc il fonctionne **100 % hors-ligne**
(aucune permission `INTERNET`).

## Construire l'APK

```bash
bash android/build-apk.sh                    # -> android/dist/hood-grow-1.0.0.apk
VERSION=1.1.0 VERSION_CODE=2 bash android/build-apk.sh
KS=ma_cle.jks KS_PASS=secret KS_ALIAS=mon_alias bash android/build-apk.sh   # clé de signature
```

Le script n'utilise **ni Gradle ni le réseau** : `aapt2` (ressources + linkage) → `javac` → `d8`
→ `zipalign` → `apksigner`. Il lit le SDK via `ANDROID_HOME` (ou `ANDROID_SDK_ROOT`), compile avec
`android-34`, et accepte `BUILD_TOOLS` / `COMPILE_SDK` pour forcer une version.

| Étape | Outil SDK |
|---|---|
| ressources, linkage, `R.java` | `build-tools/*/aapt2` |
| Java | `javac` (JDK 17, `--release 8`) |
| bytecode → `classes.dex` | `build-tools/*/d8` |
| alignement 4 octets | `build-tools/*/zipalign` |
| signature v2/v3 | `build-tools/*/apksigner` |

Installer :

```bash
adb install -r android/dist/hood-grow-1.0.0.apk
```

## Structure

```
android/
├── build-apk.sh                       chaîne de build (sans Gradle)
├── app/src/main/AndroidManifest.xml   package com.hoodgrow.game · minSdk 24 · targetSdk 34
├── app/src/main/java/.../MainActivity.java   WebView + pont natif
├── app/src/main/res/                  thème sombre, icônes (PNG + adaptative)
├── tools/make_icons.py                régénère les icônes (encodeur PNG sans dépendance)
├── tools/hoodgrow.keystore             clé créée au premier build (à remplacer en release)
└── dist/hood-grow-<version>.apk        artefact produit
```

## Ce que fait l'application

* **Hors-ligne total** : `three.module.js` est embarqué, et toute requête vers une autre origine
  que `https://appassets.androidplatform.net` est bloquée. Pas de permission `INTERNET`.
* **Origine https locale** : les assets sont servis par `shouldInterceptRequest`, ce qui garde une
  origine stable → la sauvegarde `localStorage` (`hoodgrow_v3`) fonctionne comme sur le web.
* **Bouton retour** : ferme le tutoriel, l'aide, les panneaux ouverts, met en pause, puis ferme
  l'application au second appui depuis l'écran de pause.
* **Cycle de vie** : `onPause` → `HG_appPause()` (met en pause + sauvegarde), `onResume` →
  `HG_appResume()` (relance le son). Écran kept allumé (`FLAG_KEEP_SCREEN_ON`), focus audio jeu,
  plein écran immersif, encoches gérées (`viewport-fit=cover` + `env(safe-area-inset-*)`).
* **Rotation** : `configChanges` + `fullUser` → pas de rechargement, la caméra et le HUD se
  recalculent seuls ; la caméra intérieure s'adapte au format portrait/paysage.
* **Qualité automatique** : sous 26 FPS pendant 4 s, l'app bascule seule en mode Éco (une fois) et
  le prévient par un toast.
* **Vibration** : `navigator.vibrate` autorisé (permission `VIBRATE`).
* **Sécurité** : JavaScript et DOM activés, mais `allowFileAccess`, `allowContentAccess`,
  `mixedContent`, zoom, géolocalisation et requêtes caméra/micro désactivés ; `textZoom` forcé à
  100 pour ignorer le grossissement des polices système.

## Adapter le jeu

Le pont natif vit dans `index.html` (bloc « PONT NATIF ») et est **inerte sur le web** :

| Fonction globale | Appelle par | Effet |
|---|---|---|
| `HG_back()` | bouton retour Android | ferme tuto/aide/panneaux, pause, puis `false` = quitter |
| `HG_appPause()` | `Activity.onPause` | met en pause, arrête la sirène, **sauvegarde** |
| `HG_appResume()` | `Activity.onResume` | reprend le contexte audio |
| `window.HG_NATIVE` | `onPageFinished` | active la détection « application » |

`const HG_VER='…'` dans `index.html` est remplacé automatiquement par `build-apk.sh` avec la version
de l'APK ; elle s'affiche dans l'écran de pause (« Application Android 1.0.0 »).

Après toute modification de `index.html` ou `three.module.js`, **relancer `build-apk.sh`** : les
assets de l'APK sont une copie générée (`android/app/src/main/assets/`, ignorée par git).

## Vérifier sans téléphone

```bash
# paiement rendu de l'APK avec le même UA et la même interception d'assets
node tools/apk_smoke.mjs ../dist/hood-grow-1.0.0.apk
```