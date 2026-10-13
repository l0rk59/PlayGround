# Registre de décisions

Format : **D-numéro · date · sujet — décision, et pourquoi.**

Ce fichier existe pour qu'une décision prise en production ne se perde pas.
Une décision qui n'est pas ici n'a jamais été vraiment prise.

---

### D-01 · 2026-10-13 · Moteur

**Décision :** on livre une PWA (Vite + Canvas 2D), pas un APK natif.

**Pourquoi :** la question « Godot 4 ou PWA » demande un spike comparatif sur
un Android modeste : export, fluidité, tactile, taille, productivité. Cet
environnement n'a ni Godot, ni SDK Android, ni appareil. On ne tranche donc
pas : on livre la slice web, et on garde les règles de gameplay **hors du
rendu** pour que le portage soit une réécriture de présentation, pas de
logique. Le spike reste la porte de sortie du jalon suivant.

**Révisé par :** D-12.

---

### D-02 · 2026-10-13 · Architecture

**Décision :** simulation pure séparée de la présentation.

`src/sim/*` ne connaît ni le DOM, ni le canvas, ni l'horloge. Elle communique
par un tableau d'événements vidé par la couche présentation. Les règles sont
donc testables sous `node:test` sans moteur, et un run est rejouable à
l'identique à partir de sa graine.

**Pourquoi :** c'est la seule façon d'avoir des tests de règles qui
ressemblent à des tests de jeu, et non à des tests d'implémentation.

---

### D-03 · 2026-10-13 · Butin et mort

**Décision :** la mort ne prend que le butin temporaire (`scrap`, `ration`,
`ammo`). Reliques, enregistrements et clés sont permanents.

**Pourquoi :** c'est le contrat de confiance du jeu. Perdre une découverte
autorise le jeu à mentir sur ses propres indices ; perdre 30 de ferraille, non.
Le butin permanent existe pour que l'exploration ait un enjeu sans être punitive.

---

### D-04 · 2026-10-13 · Esquive

**Décision :** i-frames entre 0,02 s et 0,26 s d'un roulade de 0,32 s — pas
pendant toute la durée. Verrou de contrôle de 0,24 s. Trois charges.

**Pourquoi :** des i-frames sur toute la durée rendent l'esquive Lester pour
se déplacer ; sans verrou de contrôle, le joueur casse son impulsion et se
fait tuer par la télégraphie qu'il vient justement de lire. La fenêtre
bornée est le point d'équilibre, et elle est testée dans les deux sens
(direction opposée / direction de l'attaque).

---

### D-05 · 2026-10-13 · Contrôles tactiles

**Décision :** joystick **dynamique**, centré sur le point de contact,
masqué au relâchement, actif au-delà du rayon, avec zone morte de 16 %.

**Pourquoi :** un joystick fixe qui garde sa position quand le pouce quitte
l'écran oblige à retomber au même endroit et produit un départ erroné. Un
joystick dynamique qui reste affiché impose de revenir au même point. La
combinaison dynamique + masqué + zone morte est celle qui supprime les deux
sources d'erreur, et elle est celle que les tests de compréhension
valident le mieux.

---

### D-06 · 2026-10-13 · Pause accessible

**Décision :** bouton de pause permanent à l'écran, en plus de la touche
clavier. Bouton de gestes jamais absent.

**Pourquoi :** un jeu tactile dont la pause n'existe qu'au clavier n'a
pratiquement pas de pause sur mobile. Le joueur se fait tuer pendant une
notification système.

---

### D-07 · 2026-10-13 · Sauvegarde

**Décision :** écriture atomique en trois clés, et à la charge on garde la
sauvegarde **de `savedAt` le plus récent** parmi principale, `pending` et
secours.

**Pourquoi :** un téléphone Android tue le processus n'importe quand —
appel entrant, mémoire basse. Et une sauvegarde ancienne (autre version du
jeu, restauration cloud en retard) écrasant la clé principale ne doit pas
remplacer la partie en cours. La première version de l'implémentation
prenait simplement la première sauvegarde trouvée : c'était un bug, pas un
choix.

---

### D-08 · 2026-10-13 · Direction artistique — la valeur avant la couleur

**Décision :** bandes de valeur strictes (sol / détail / props / héros) qui
ne se recouvrent jamais, vérifiées par test.

**Pourquoi :** l'œil lit la clarté avant la teinte. Le défaut le plus courant
en vue de dessus est de laisser un acteur retomber dans la bande du sol : il
reste « techniquement dessiné » mais invisible. Le test du gris est le seul
contrôle fiable, et il a été appliqué : la première version de la palette
donnait des sprites **entièrement vides** à l'écran, invisibles, alors que le
générateur isolé les rendait parfaitement. Ce bug a coûté une heure de
débogage et deux garde-fous (test de cohérence contenu ↔ rendu, erreur
explicite sur forme manquante).

---

### D-09 · 2026-10-13 · Rendu — un seul vecteur de lumière

**Décision :** lumière haut-gauche à 40°, trois faces (1,00 / 0,66 / 0,42),
ombres portées elliptiques décalées vers le bas-droite.

**Pourquoi :** sans vecteur unique, chaque asset a l'air dessiné par
quelqu'un d'autre. La lisibilité d'un volume tient à trois bandes de valeur
cohérentes, pas à sa couleur.

---

### D-10 · 2026-10-13 · Technique de rendu

**Décision :** `ctx.shadowBlur` interdit. Tout halo est un dégradé
pré-rendu dans un canvas hors écran, composé en `lighter`. Le sol est peint
une fois dans un tampon de la taille du monde puis blitté.

**Pourquoi :** `shadowBlur` est environ dix fois plus lent que la composition
d'un dégradé pré-calculé, et il ne passe pas le budget d'image sur un
appareil d'entrée de gamme.

---

### D-11 · 2026-10-13 · Audio

**Décision :** synthèse WebAudio temps réel, zéro fichier audio.

**Pourquoi :** aucun asset ne peut manquer à l'installation, le poids du
build reste nul, et le prototype est jouable immédiatement. Limite assumée :
ce n'est pas une musique de production, c'est une bande-son de slice.

---

### D-15 · 2026-10-13 · APK Android — tranché

**Décision :** on livre un **APK natif** via une enveloppe Capacitor, en
conservant la PWA comme canal de test rapide.

**Pourquoi :** la question D-01 portait sur l'arbitrage PWA / Godot 4. La
recherche a montré que sur mobile, l'enveloppe WebView ajoute une couche
minime : les variables de performance sont le moteur de rendu, le GPU de
l'appareil et la qualité du code de jeu — pas le wrapper. Godot 4 exporte
en WebGL 2.0 uniquement, ce qui est *moins* bon que le WebView d'Android
sur ce point précis. Godot ne se justifie que si le jeu dépasse le 2D à
plats ; il ne le fait pas, et sa submission au store impose de réécrire
l'interface et la boucle dans un autre langage.

**Résultat mesuré :** APK de 4,4 Mo, `minSdk 24` (Android 7), `targetSdk 36`,
paysage figé (`sensorLandscape`), jeu embarqué, 100 % hors ligne.

**Ce qui n'est pas tranché :** la clé de signature de release, et donc la
publication sur Google Play. L'APK actuel est signé avec la clé de debug :
il s'installe, il ne se publie pas.

---

### D-12 · 2026-10-13 · Ce qui reste à décider

- Signature de release et publication Google Play — non fait.
- Godot 4, uniquement si le jeu dépasse un jour le 2D à plats.
- Réglages de difficulté par appareil — non faits.
- Public cible et classification d'âge — non faits.
- Modèle de coopération — hors périmètre.

---

### D-13 · 2026-10-13 · Accessibilité

**Décision :** le réglage « réduire les effets » supprime secousses et
flashes mais **conserve toutes les télégraphies**.

**Pourquoi :** les télégraphies portent l'information, pas l'effet. Les
couper rendrait le jeu injuste pour qui les utilise.

---

### D-14 · 2026-10-13 · Monétisation

**Décision :** aucune publicité, aucun achat, aucun accélérateur dans la
slice. Les interfaces d'économie existent mais ne sont branchées sur aucun
SDK.

**Pourquoi :** on ne monétise pas un jeu qu'aucun testeur n'a validé. La
phase 10 du masterplan reste entière et non commencée.