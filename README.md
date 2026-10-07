# NEON DEAD

**FPS zombie en monde ouvert, cyberpunk — mobile (tactile) + PC (clavier/souris).**
Néo-Kyoto, 2087. Le virus NÉON-X a ravagé la mégapole. Explore, pille, conduis, fortifie ton camp, recrute une escouade — et survis aux nuits.

## Lancer

```bash
./start.sh
```
100 % statique : aucune dépendance réseau, Three.js embarqué dans `vendor/`.

## Les 3 règles d'or pour survivre

1. **Reste dans les zones franches** (anneau vert au sol, badge en haut). Aucun infecté n'y entre et tu ne subis aucun dégât. Elles sont signalées par un panneau et des balises lumineuses.
2. **Mode entraînement** — touche `T` : invincible, aucune vague. Idéal pour tester armes, véhicules, construction et recruitment sans mourir.
3. **Le son te trahit** : courir fait du bruit et attire les infectés. Accroupi (`C`) = silencieux.

## Zones franches

| Zone | Rayon | Note |
|---|---|---|
| BASE NÉON | 23 m | Ton camp, là où tu construis |
| ENCLAVE 7 | 17 m | Faction, échange de réputation |
| GANG ROUILLE | 17 m | Faction, améliorations de véhicule |
| MARCHÉ NOIR | 14 m | Le Fixer achète / vend |
| HÔPITAL KIRIN | 13 m | Point d'intérêt |
| LABORATOIRE | 12 m | Point d'intérêt |

## Contrôles

**PC** — `ZQSD`/`WASD`/`↑←↓→` (AZERTY **et** QWERTY : le code physique est détecté), souris pour viser, **clic gauche** tirer, **clic droit** viser, `Maj` sprint, `C` accroupi, `E` interagir, `R` recharger, `B`/`Tab` construire, `H` soin, `G` grenade, `F` klaxon, `1`–`6` armes, molette changement d'arme, `T` entraînement, `M` carte, `Échap` pause.
- Si le navigateur refuse le verrouillage de souris, **maintenir le clic droit et faire glisser** regarde quand même autour de vous.
- Touches parallèles sans conflit (`E` interagir ≠ `F` klaxon, `B` construire ≠ `R` recharger).

**Mobile** — joystick gauche (apparaît là où tu touches), glissement à droite pour regarder, boutons FEU / VISER / R / SAUT / 💊 / 💣 / 🔄 / E / 🛠 / 📯. Paysage recommandé.

## Contenu

- **Monde** : ville en ruines (immeubles détaillés : toits, châteaux d'eau, clim, antennes, escaliers de secours), routes, forêt irradiée, 6 points d'intérêt, câbles lumineux entre les immeubles, distributeurs néon, feux tricolores, benne, sacs poubelle, plaques d'égout
- **Infectés** : 5 types (Marcheur, Coureur, Rampant, Cracheur à projectile acide, Colosse à cornes) — vêtements en lambeaux, veines lumineuses, halo oculaire, mort animée
- **Armes** : 6 armes + machette (combo) + grenade à bruit, modèles 3D en vue subjective avec recul à ressort, rechargement animé, visée, accessoires
- **Véhicules** : buggy, camion, van à tourelle — carburant, dégâts, fumée, klaxon
- **Base** : barricade, pieux, tourelle auto, porte, atelier
- **Escouade** : 4 survivants (médecin, sniper, ingénieur, éclaireur) qui suivent et agissent
- **Progression** : XP/niveaux, 8 quêtes, 10 notes de lore, factions avec réputation
- **Ambiance** : cycle jour/nuit, vagues nocturnes, météo (pluie/brouillard), étalonnage (vignettage, aberration, grain)
- **Sauvegarde** automatique dans `localStorage` + reprise « Continuer »

## Architecture

```
index.html          coquille + HUD + menus
src/main.js         moteur, boucle, interactions
src/world.js        monde, ciel, météo, zones franches, éclairage
src/player.js       déplacement, collisions, vie
src/weapons.js      armes, modèle vue subjective, hitscan
src/enemies.js      infectés : types, IA, zones franches
src/vehicles.js     conduite, carburant, tourelles
src/survivors.js    escouade, factions, notes
src/building.js     construction de base
src/loot.js         caisses et butin
src/director.js     temps, vagues, quêtes
src/hud.js          HUD, boutique, carte, réglages
src/audio.js        son procédural (WebAudio)
src/textures.js     textures procédurales (canvas)
src/fx.js           traçantes, particules, impacts
src/input.js        clavier / souris / tactile / gamepad
src/state.js        état global, réglages, sauvegarde
vendor/three/       Three.js r160 + post-traitement
```

Three.js est sous licence MIT. Tout le reste est généré à l'exécution : géométrie, textures, sons.

---

## 📦 Application Android (APK)

L'APK est construit et signé : **`android/dist/neon-dead.apk`** (489 Ko).

```bash
./android/build-apk.sh          # reconstruit l'APK depuis le code courant
adb install -r android/dist/neon-dead.apk
```

- **Cible** : Android 7.0+ (minSdk 24), compileSdk 34, paysage, plein écran immersif
- **Aucune permission INTERNET** : le jeu est intégralement embarqué, rien n'est téléchargé
- **Rendu** : WebView + couche matérielle explicite (WebGL), WebGL non requis en réseau
- **Sauvegarde** : `localStorage` du WebView → `INTERNET` inutile hors ligne
- **Intégration native** : bouton retour Android (ouvre/ferme l'overlay courant puis met en pause), pause automatique en arrière-plan, vibrations haptiques, safe-area pour encoche/barre de gestes

Le script compile sans Gradle : `aapt2` (ressources) → `javac` + `d8` (dex) → `zipalign` + `apksigner` (signature v2/v3 avec keystore généré).

### Pourquoi le jeu n'est PAS chargé en `file://`

Le jeu utilise des **modules ES** + une **importmap**. Chrome bloque les modules ES
sur `file://` (origine `null` → politique CORS) : `main.js` ne s'exécute jamais et
l'écran de chargement reste bloqué indéfiniment.

L'app sert donc les assets depuis une **origine HTTPS virtuelle** —
`https://appassets.androidplatform.net/asset/index.html` — via
`WebViewClient.shouldInterceptRequest()`. L'origine est ainsi légitime, les modules
se chargent, et l'accès aux fichiers locaux est désactivé (`setAllowFileAccess(false)`,
`setAllowUniversalAccessFromFileURLs(false)`).

Au cas où un chargement échouerait quand même, `index.html` affiche une **vraie erreur**
au lieu de laisser tourner « CHARGEMENT » (filet de sécurité : `window.__ndBoot`).

## 🔫 Argent & Arsenal

Chaque élimination rapporte des **yens** (💴) : marcheur 18, coureur 21, rampant ~19, cracheur 27, colosse ~38, headshot +6, élite ×2,2.

**Rien n'est débloqué au hasard.** Seules la machette, le pistolet, le fusil et la grenade sont disponibles au départ. Le couteau (¥400), la pompe (¥2 200) et la DMR (¥3 400) s'achètent à l'**Arsenal** — touche `V` ou bouton 🔫 du HUD, ou au Marché Noir.

Chaque arme a **5 niveaux** (grenade : 3). Chaque niveau augmente dégâts **et** cadence :
| Arme | Niv. 1 | Niv. 5 |
|---|---|---|
| Machette | 58 / 2,3 | 102 / 2,8 |
| Fusil V-9 | 25 / 10 | 44 / 12 |
| DMR | 88 / 1,35 | 156 / 1,6 |

**4 accessoires** achetables puis améliorables sur 3 niveaux : silencieux (bruit ÷70 %), lunette (dispersion), poignée (recul), **chargeur étendu** (+20 % par niveau, sur toutes les armes à feu).

## 📱 Disposition des touches configurable

Réglages → **Disposition des touches** : glisse les boutons sur l'aperçu, ajuste leur taille avec le curseur, **bascule la main** (gauche/droite) d'un coup, ou réinitialise. La disposition est sauvegardée par appareil.

## 📱 Commandes tactiles (modèle « glisser / taper »)

| Zone | Geste |
|---|---|
| moitié gauche | joystick flottant : **toucher** là où tu veux, **incliner à fond pour sprinter** |
| moitié droite | **taper** = 1 tir · **glisser** = regarder (0,0022 rad/px : un balayage plein écran ≈ 170°, identique à la souris) |
| boutons | **FEU** (maintenu, tir continu) / ACTION / VISER / RECHARGER / SAUT / CONSTRUIRE / KLAXON / PAUSE |

Le HUD est rendu **au-dessus** des zones tactiles (z-index 24 > 22) : la barre d'armes,
les objets et les boutons du haut restent donc tapables sur téléphone.

Tous repositionnables et redimensionnables dans Réglages → *Disposition des touches*.

## 🗺 Monde élargi

Rayon 205 → **330 m** (660 m de côté) : 115 immeubles, 8 routes, 110 caisses, 8 points d'intérêt dont **silo nucléaire**, **fort abandonné** et **métro 12**, anneau de 10 points d'apparition d'infectés en périphérie. Mini-carte portée 190 m.

## 🧟 Infectés lisibles

Peau auto-illuminée, tête agrandie avec mâchoire ouverte, dents, orbites creuses, nez, oreilles, membres articulés aux épaules et hanches, vêtements en lambeaux, veines du virus émissives, halo oculaire pulsant. Contre-jour cyan pour les détacher du décor la nuit.

## ⚡ Autres réglages

Sensibilité, FOV, volume, qualité (basse/moyenne/haute), bloom, secousses, inversion Y, **vibration**, **limite d'images** (économie batterie), stats de performance (touche `P`).


## 🧪 Outils de vérification

```bash
./check.sh          # syntaxe ESM stricte de tous les modules
node check-imports.js # vérifie que chaque import nommé existe bien
```

> ⚠️ `node --check fichier.js` **ne détecte pas** les erreurs de module ES
> (il l'analyse comme un script CommonJS). Toujours copier en `.mjs`.
