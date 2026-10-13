# Bible artistique — Dernier Refuge

Cette bible est **exécutable** : les règles ci-dessous sont codées dans
`src/art/palette.js` et vérifiées par `tests/rules.test.js`. Une règle qui
n'est pas dans le code n'est pas une règle.

---

## 1. Style

**Noir stylisé àplats.** Formes simples, ombres portées elliptiques, aucune
texture imported. Ce style est un choix de production autant qu'esthétique :
il tient sur un appareil d'entrée de gamme, se lit à 24 px de haut, et ne
dépend d'aucun asset qui pourrait manquer.

## 2. La valeur avant la couleur

L'œil lit **d'abord la clarté**, ensuite la teinte, en dernier la saturation.
Toute la hiérarchie de lecture est donc décrite en bandes de valeur, et les
couleurs n'arrivent qu'ensuite.

| Couche | Bande de valeur | Rôle |
|---|---|---|
| Sol | 0,15 – 0,26 | La page. Doit pouvoir être ennuyeuse. |
| Détail | 0,30 – 0,36 | Un cran au-dessus du sol. |
| Props | 0,12 – 0,58 | Les extrêmes. Portent les contours. |
| Héros | 0,34 – 0,95 | Le joueur : le point le plus clair de l'image |

**Les bandes ne se recouvrent jamais.** Un élément qui tombe dans la bande du
sol « colle » au décor et disparaît. C'est le défaut le plus courant, et il a
été commise puis corrigée pendant la production (voir `DECISIONS.md`).

**Test de contrôle obligatoire :** passer la capture en gris. Si on ne
distingue plus le sol du personnage, le problème est structurel, pas chromatique.

## 3. Un seul vecteur de lumière

En vue de dessus 2.5D, la lumière vient du **haut-gauche**, ~40° d'élévation.
Tout volume est construit sur trois faces :

| Face | Facteur | Exemple |
|---|---|---|
| Sommet | 1,00 | la face supérieure d'un rocher |
| Bas-droite | 0,66 | le flanc opposé à la lumière |
| Bas-gauche | 0,42 | la face la plus sombre |

Un objet qui n'obéit pas à cette règle « colle » au sol au lieu de se dresser
dessus. L'ombre portée est **écrasée et décalée** vers le bas-droite, sa
longueur proportionnelle à la hauteur apparente.

## 4. Couleurs réservées

Une couleur qui porte un sens de gameplay ne peut pas être utilisée en
décoration. C'est ce qui rend le joueur capable de faire confiance au signal.

| Couleur | Sens | Hex |
|---|---|---|
| Rouge | Dégâts, télégraphie d'attaque | `#e2483d` |
| Ambre | Interactif, butin, pad d'extraction | `#f0b429` |
| Cyan | Anomalie, esquive, i-frames | `#4fd6c8` |
| Vert | Soin, allié, extraction réussie | `#7de08a` |
| Violet | Boss, phases de boss | `#a483ff` |

## 5. Zones

Une zone est décrite comme une **relation valeur/température**, pas comme une
liste de hex : on peut re-teinter une zone sans casser sa structure de valeurs.

| Zone | Température | Dominante | Contraste |
|---|---|---|---|
| La Vallée Fracturée | froide | cendre, bleu-gris | 0,42 |
| La Faille | froide, anormale | cyan / violet | 0,52 |
| Le Refuge | chaude | ambre, bois | 0,46 |

Rapport de composition dans une image : **60 % dominante, 30 % secondaire,
10 % d'accent**.

## 6. Technique

- **Interdit :** `ctx.shadowBlur`. Dix fois plus lent que composer un dégradé
  pré-calculé en `lighter`.
- **Obligatoire :** tout ce qui change est pré-rendu une fois dans un canvas
  hors écran, puis dessiné en un seul `drawImage`.
- **Sol :** tuile raccordable de 256 px, peinte une fois, répétée sur toute la
  région. Un `fillRect` par tuile à 60 fps est ce qui tue le budget d'image.
- **Ombres :** ellipse écrasée pré-rendue, décalée selon le vecteur de lumière.
- **Vignettage :** deux couches, une froide et une chaude, pour que la
  profondeur se lise même sans ombres portées.
- **Zoom caméra : ×1,45, appliqué dans la transformée. Un acteur de 42 unités
  dans une vue de 900 fait 4 % de l'écran : on ne lit ni ses membres ni son
  orientation. On zoome la *présentation*, jamais la simulation.

### 6.1 Le sol est une matière

Un aplat uniforme donne l'impression d'une maquette même avec des
personnages bien dessinés. Le sol est une tuile de 256 px composée de :

1. **Bruit de valeur fBm** — 4 octaves larges + 5 fines, mélangés vers la
   lumière ou vers l'ombre. Grain réel, pas une texture plaquée.
2. **Gravier** — 300 cailloux, chacun avec une ombre et un dessus clair dans
   le même axe de lumière que le reste.
3. **Fissures** — traits à angles changeants, avec une arête claire au-dessus
   de la crevasse. C'est ce qui dit « sol dur » plutôt que « dessin ».
4. **Traînées de cendre** — fines, dans un sens, comme si le vent les avait
   posées. C'est ce qui casse l'aspect « bruit uniforme ».

**La tuile doit être raccordable.** Le bruit est périodique par construction :
la grille se replie sur elle-même, et chaque forme est redessinée à ses neuf
positions voisines. Une couture se voit immédiatement comme une ligne claire
répétée tous les 256 pixels.

### 6.2 L'animation

Un personnage qui glisse en oscillant de deux pixels n'est pas un personnage
animé. **Huit poses par acteur**, pré-rendues une fois dans une feuille de
sprites, composées en un seul `drawImage` avec un sous-rectangle.

- **La phase vient de la position, pas d'un compteur.** Le personnage marche
  exactement à la vitesse à laquelle il se déplace, et aucun état
  d'animation n'est stocké par entité.
- **Quatre temps** : contact, passage, contact opposé, passage.
- **Le buste monte deux fois plus vite que les jambes** : ce micro-rebond
  donne le poids.
- **La foulée ne dépasse jamais la longueur de la jambe.** Une foulée plus
  longue met le personnage en fente et la silhouette lit « pantin » plutôt
  que « marcheur ». C'est vérifié par test.
- **Bras suspendus le long du buste**, pas écartés à l'horizontale : une
  épaule tracée vers l'extérieur donne une silhouette d'épouvantail.
- **Familles de forme** : humanoïde (hanches, jambes articulées, manteau),
  massif (compression / étirement, pustules qui suivent la déformation),
  quadrupède (galop, diagonales synchronisées, regard).

### 6.3 Atmosphère

- **Poussières en suspension** — pool de taille fixe recyclé, jamais alloué
  par image. Défilement propre à la caméra : si les particules suivaient la
  caméra exactement, on lirait le décalage au lieu du décor.
- **Routes** — traces de poussière *claires*. Une route qui assombrit le sol
  devient une saleté à l'écran : l'œil y va au lieu de suivre le joueur.
- **Habillage** — rochers à facettes, arbres ramifiés récursifs, souches à
  cercles de croissance, touffes d'herbe morte. Tous construits sur les
  trois faces du même vecteur de lumière, aucun n'est un obstacle de
  gameplay.

## 7. Lisibilité — les trois ancres

1. **Silhouette.** Si la forme n'est pas identifiable à 24 px, on ne
  Discusse pas de couleur : on redessine.
2. **Groupe de valeurs.** Le joueur se sépare du fond d'au moins 0,26 en
   valeur. C'est vérifié par test.
3. **Chemin focal.** Le regard doit tomber d'abord sur le joueur, ensuite
   sur la menace, ensuite sur l'objectif. Un décor qui gagne est un décor
   qui combat le jeu.

## 8. Accessibilité visuelle

- Aucune information de gameplay portée par la couleur seule : forme +
  pulsation + son.
- Le réglage « Réduire les effets » supprime secousses et flashes mais
  **conserve toutes les télégraphies** : elles portent l'information, pas
  l'effet.
- Contrastes de texte vérifiés sur le fond le plus sombre de chaque écran.
- Tailles de texte en `clamp()`, jamais en pixels fixes.

## 9. Auto-portrait de l'icône

`tools/gen-assets.mjs` dessine l'icône pixel par pixel, sans dépendance :
fond dans la bande la plus basse, bâtiment sur trois faces, une seule fenêtre
chaude, liseré cyan venant du haut-gauche, halo d'anomalie froid derrière.
L'icône est la même discipline que le jeu.