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
- **Sol :** peint une fois dans un tampon de la taille du monde, puis blitté.
  Un `fillRect` par tuile à 60 fps est ce qui tue le budget d'image.
- **Ombres :** ellipse écrasée pré-rendue, décalée selon le vecteur de lumière.
- **Vignettage :** deux couches, une froide et une chaude, pour que la
  profondeur se lise même sans ombres portées.

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