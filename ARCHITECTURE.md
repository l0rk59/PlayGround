# Architecture du projet

Hood Grow est une application web monopage, empaquetée en APK Android hors-ligne.

## Règle n°1 : ne jamais éditer `index.html`

`index.html` est un **fichier généré**. Il est assemblé à partir de `src/`.

```
src/index.head.html      <head>, CSS, importmap          (163 l.)
src/index.body.html      tout le balisage du jeu         (219 l.)
src/js/000-imports.js    imports Three.js + post-traitement
src/js/00-etat.js        état, sauvegarde, génétique      (93 l.)
src/js/10-career-audio.js carrière, audio, réglages      (218 l.)
src/js/20-monde.js       quartiers, bâtiments, ciel        (129 l.)
src/js/30-maison.js      maison, intérieurs, culture      (564 l.)
src/js/40-world3d.js     circulation, foule, véhicules    (1 222 l.)
src/js/50-personnages.js personnages articulés            (225 l.)
src/js/60-controles.js   contrôles, labo, holographie    (493 l.)
src/js/70-interactions.js culture, vente                  (79 l.)
src/js/80-lieux.js       marché, douane, banque, police   (1 167 l.)
src/js/90-perso.js       personnages, simulation         (232 l.)
src/js/95-sim-hud.js     simulation, HUD, boucle         (225 l.)
src/manifest.json        l'ordre d'assemblage (à respecter)
```

## Éditer le jeu

```bash
# 1. modifier le bon fichier dans src/
vim src/js/80-lieux.js

# 2. réassembler
node tools/build-web.mjs

# 3. vérifier (obligatoire avant de.commit)
node tools/build-web.mjs --check
```

## Pourquoi un assemblage et pas des modules ES ?

Le code est **un seul module** où l'ordre d'exécution est significatif : des `let`/`const`
en zone morte (TDZ) sont utilisés par des fonctions appelées plus bas, et beaucoup de
fonctions s'appellent entre elles. Découper en modules ES introduirait un risque de
régression à chaque import, et le compte en a déjà fait les frais deux fois lors de
déplacements de code.

Ici on ne fait que **recoller les fichiers dans l'ordre du manifeste**. Le résultat est
identique à l'octet près, ce que `--check` vérifie systématiquement.

## Garde-fous

| Garde-fou | Effet |
|---|---|
| `build-web.mjs --check` | échoue si `index.html` ≠ assemblage des sources |
| `android/build-apk.sh` | réassemble automatiquement avant de construire l'APK |
| 11 suites `tools/test-*.mjs` | couvrent culture, monde, vente, lieux, véhicules, options, rétention |

## Tests

Les tests lisent `.testbuild/index.html`, une copie de `index.html` dans laquelle
`tools/make-test-copy.mjs` injecte un hook `window.__H`. **Ce hook n'existe jamais dans
le fichier livré** — `grep -c "window.__H" index.html` doit renvoyer `0`.

```bash
node tools/make-test-copy.mjs          # indispensable après chaque modification
node tools/test-core.mjs               # culture, séchage, sauvegarde
node tools/test-halls.mjs              # bâtiments jouables
node tools/test-options.mjs            # réglages & accessibilité
# … voir tools/test-*.mjs
```

## Pièges connus

- **TDZ** : toute constante utilisée par une fonction appelée pendant la construction
  du monde doit être déclarée *avant*. En cas d'erreur « Cannot access 'X' before
  initialization », c'est presque toujours ça.
- **Ordre des fichiers** : `src/manifest.json` définit l'ordre. Ne le réorganisez pas
  sans vérifier `--check`.
- **Tests instables** : le rendu logiciel (SwiftShader) peut figer le thread pendant
  une compilation de shader. Les tests attendent un *état*, jamais un délai fixe.