# Tests de rendu (Chromium / SwiftShader)

Le jeu est un fichier unique : ces tests injectent un hook `window.__H` dans une **copie**
de `index.html` (jamais dans la production) pour lire l'état et appeler les fonctions.

```bash
node tools/make-test-copy.mjs          # crée .testbuild/ (copie + hook + three local)
node tools/test-core.mjs               # culture, vente, sauvegarde/rechargement, maison
node tools/test-house.mjs              # entrée dans la maison, toit/murs/porte
node tools/test-realism.mjs            # cycle 18/6, pH, ravageurs, séchage, électricité,
                                       # mouchard, barrages, corruption de flic
```

Prérequis : le Playwright du runtime OMGithub (`$HOME/.local/share/omgithub-playwright`)
et un display (`DISPLAY=:0` dans le bac à sable Linux).

Rendu logiciel SwiftShader : les FPS mesurés ici ne correspondent pas à un vrai téléphone.
