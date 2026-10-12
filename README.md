# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/l0rk59/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/l0rk59/PlayGround)

- 🎮 [Open the project](https://omgithub.com/l0rk59/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=l0rk59%2FPlayGround).
- 💻 [Explore the source](https://github.com/l0rk59/PlayGround).
- 🛠️ [Check build runs](https://github.com/l0rk59/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/l0rk59/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/l0rk59).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

# 🐺 Refuge du Loup — Tranche 1 jouable (PWA mobile)

Première tranche jouable sur navigateur mobile, installable comme PWA sur Android.
Ce n'est pas encore un APK natif ni le jeu complet.

Contenu : choix entre 3 classes (Guerrier / Archère / Mage), attaques automatiques,
capacités spéciales, chien compagnon, boss (vagues 5/10/...) avec arme et relique uniques
(Lame de Braise + Cœur de Braise), refuge, inventaire, sauvegarde locale.
On peut rentrer au refuge à tout moment.

## Essayer sur Android (via GitHub)

1. Cloner : `git clone https://github.com/l0rk59/PlayGround && cd PlayGround`
2. `npm install` puis `npm run dev -- --host 0.0.0.0`
3. Sur le téléphone (même Wi-Fi), ouvrir l'adresse locale affichée par Vite.
4. Dans Chrome : ⋮ → **Ajouter à l'écran d'accueil** pour l'installer comme appli web.
5. Sur téléphone, glisser sur la zone de jeu pour se déplacer ; l'arme tire automatiquement.

## Vérifications

- `npm test` : 3 tests OK
- `npm run build` : OK
- `/`, `/manifest.webmanifest`, `/sw.js` répondent en HTTP 200.

Prototype : pas encore de monde ouvert complet, multijoueur, pubs ni achats intégrés.
