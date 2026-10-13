# Dernier Refuge

**Action-survie solo · Android · monde post-apocalyptique · horreur graduelle**

Un survivant retrouve une maison qu'il connaît sans se rappeler pourquoi.
Elle résiste à certaines manifestations anormales. La vallée autour n'est
pas vide : elle est habitée par des gens qui se contredisent sur ce qui est
arrivé.

> Vertical slice 1.0 — jouable de bout en bout : refuge → expédition →
> combat → rencontre → boss → retour.

## Démarrer

```sh
npm install
npm run dev -- --host 0.0.0.0
```

## APK Android

```sh
npm run android:apk
```

Produit `android/app/build/outputs/apk/debug/app-debug.apk` (≈ 4,4 Mo).
L'APK est **signé avec la clé de debug** : il s'installe par `adb install`
ou en copiant le fichier sur le téléphone (autoriser « sources inconnues »).
Pour une publication, il faut une clé de release — voir `docs/DECISIONS.md`.

L'application est une enveloppe Capacitor : le jeu est embarqué dans
l'APK et tourne 100 % hors ligne. `INTERNET` n'est déclaré que parce que
le composant WebView l'exige ; aucune requête réseau n'est effectuée.

Puis ouvrir l'URL affichée. Sur téléphone, l'accès dépend des restrictions
réseau de la machine ; pour installer la PWA hors `localhost`, il faut une
URL en HTTPS.

## Vérifier

```sh
npm test          # règles pures, sauvegarde, expédition, direction artistique
npm run build     # génère les icônes puis build Vite
npm run assets    # régénère les icônes PWA seules (zéro dépendance)
```

Les tests tournent sous `node:test` sans navigateur et sans moteur de jeu.
Ils couvrent la simulation, pas l'implémentation : on peut rejouer une
expédition complète et vérifier les règles de mort, de butin et d'extraction.

## Ce qui est livré

| | |
|---|---|
| Boucle | Refuge → expédition (150 s) → combat → lieux → boss → extraction |
| Classes | 3, avec rôle, faiblesse et capacité active distinctes |
| Ennemis | 5 familles, 5 comportements lisibles sans couleur |
| Boss | Le Gardien de seuil, 3 phases, récompense unique non répétable |
| Région | La Vallée Fracturée, 5 lieux, 7 obstacles qui dessinent les routes |
| Contrôles | Joystick dynamique, tir auto, esquive à i-frames, pause toujours visible |
| Sauvegarde | Versionnée, migrations testées, écriture atomique, secours |
| Accessibilité | Réduction d'effets qui conserve les télégraphies, vibrations optionnelles |

## Architecture

```
src/
  core/util.js        RNG déterministe, vecteurs, hash spatial, bus
  data/tuning.js      tous les chiffres de jeu
  data/content.js     classes, ennemis, boss, objets
  data/world.js       région, lieux, quêtes, bible narrative
  sim/rules.js        règles pures : combat, butin, économie, extraction
  sim/expedition.js   simulation complète, sans DOM ni horloge
  art/palette.js      bible artistique exécutable (valeurs, lumière, couleurs)
  render/             sprites pré-rendus, caméra, décor, effets
  ui/                 entrées tactiles, écrans
  audio/              synthèse WebAudio, zéro fichier
  persist/            schéma versionné, migrations, écriture atomique
tools/gen-assets.mjs  encodeur PNG maison pour les icônes
docs/                 GDD, bible artistique, bible narrative, décisions
```

**Le contrat :** `src/sim/*` ne connaît ni le DOM, ni le canvas, ni
l'horloge. La présentation lit l'état et draine une file d'événements. C'est
ce qui rend les règles testables, les runs rejouables, et le portage vers un
moteur natif cadre comme une réécriture de présentation.

## Documentation

- [`docs/GDD.md`](docs/GDD.md) — design, boucle, contrôle, économie
- [`docs/ART_BIBLE.md`](docs/ART_BIBLE.md) — direction artistique (exécutable)
- [`docs/NARRATIVE_BIBLE.md`](docs/NARRATIVE_BIBLE.md) — canon et interdits
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ce qui a été décidé, et pourquoi

## Ce qui n'est pas fait

Multijoueur · publicité · achats · monde persistant · contenu de fin ·
audio échantillonné · APK natif. Le choix du moteur reste ouvert : voir
D-01 et D-12 dans le registre de décisions.

---

# PlayGround


