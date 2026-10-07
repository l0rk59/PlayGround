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
