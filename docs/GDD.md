# GDD — Dernier Refuge

**Version 1.0 — vertical slice.** Document de référence. Toute décision qui
contredit ce document doit d'abord être écrite dans `docs/DECISIONS.md`.

---

## 1. Pitch

Après une catastrophe mondiale sans cause identifiée, un survivant retrouve une
maison qu'il connaît sans se rappeler pourquoi. Elle résiste à certaines
manifestations anormales. En explorant la région, il affronte morts-vivants,
groupes humains et phénomènes occultes, rencontre un survivant, et
reconstitue une vérité mêlant rituels et horreur cosmique.

## 2. Boucle

```
        ┌──────────────────────────────────────────┐
        │                                          │
   RÉFUGUE ── expédition ── combat ── rencontre ── BOSS
   ( services,       ( butin    ( telegraphie,  ( récompense
     atelier,          tempé-     esquive,      unique liée
     quêtes )           raire )    auto-tir )   au refuge )
        │                                          │
        └──────────────────────────────────────────┘
```

**Règle de la boucle.** Le pad d'extraction s'ouvre à la fin d'une période de
150 s. Le joueur doit revenir. Ce n'est pas une contrainte, c'est le rythme :
sans retour obligatoire, il n'y a pas de refuge.

**Contrat de confiance (non négociable).**
- La progression permanente n'est **jamais** perdue à la mort.
- Seule la matière temporaire (ferraille, rations, munitions) se perd.
- Les 3 premiers niveaux de refuge sont offerts.
- Aucun=testeur ne peut être obligé de farmer une quantité absurde de communs.

## 3. Contrôle

| Action | Tactile | Clavier |
|---|---|---|
| Déplacement | glissement n'importe où sur la moitié gauche | ZQSD / WASD / flèches |
| Esquive | bouton `↷` | `Espace` |
| Tir | automatique | — |
| Capacité | bouton `✦` | `Maj` |
| Soin | bouton `+` | `Q` |
| Pause | bouton permanent en haut à droite | `Échap` |

**Le joystick est dynamique** : il apparaît sous le doigt, se masque au
relâchement, accepte le glissement au-delà du rayon et ne réagit pas dans un
petit cercle central (zone morte 16 %). C'est la combinaison qui évite le
départ dans une direction au hasard quand on lève le pouce.

## 4. Combat

- **Tir automatique** sur la cible visible la plus proche, portée bornée.
  Un seul pouce : pas de visée à tenir en même temps que le déplacement.
- **Esquive** : 0,46 s, i-frames entre 0,03 s et 0,40 s (pas toute la durée),
  verrou de contrôle de 0,34 s, 3 charges, recharge complète en 1,6 s.
  Elle couvre **330 unités**, soit 1,46 × la vitesse de la menace la plus
  rapide (la Meute, 226 u/s). C'est l'invariant central du jeu : sans lui,
  l'esquive ne sert qu'à enjamber et le joueur perd à tous les coups.
- **i-frames post-hit** : 0,55 s après un coup. Le stunlock en rafale est
  impossible et le joueur voit l'anneau d'invulnérabilité.
- **Temps de réaction (TVR)** : délai d'annonce par famille, de 0,44 s
  (morsure de la Meute) à 0,95 s (faisceau du Guetteur). Invariant :
  **TVR ≥ durée des i-frames**, sinon le timing du joueur est une loterie.
- **Télégraphie** : la forme dit *quel* coup, la pulsation dit *quand*.
  `disc` cercle plein (frappe), `burst` double anneau (explosion),
  `line` cône étroit (tir), `beam` rectangle long (faisceau),
  `sweep` secteur large (boss). La couleur signifie « danger » partout :
  elle ne porte jamais la différence.
- **Mort** : `status = dead`, perte du butin temporaire, fin immédiate.
- **Résistance** : un Rieur encaisse 6 coups avant de tuer la Survivante.
  Encaisser est une décision, pas une absence de conséquence.

## 5. Contenu de la vertical slice

- **3 classes** — La Survivante (ténacité), Le Chasseur (précision),
  La Porteuse (soutien). Trois PV max, trois cadences, trois capacités.
- **5 familles d'ennemis** — Rieur, Pléthore, Pleureuse, Meute, Guetteur.
  Cinq comportements : charge, charge lente, tir, flanc, station fixe.
- **1 boss à 3 phases** — Le Gardien de seuil : balayage, invocation,
  faisceaux. Récompense unique non répétable : le Garde du Seuil.
- **1 région, 5 lieux** — camp, gare (narratif), puits (optionnel), halle
  (faction), seuil (boss). 7 obstacles qui dessinent les routes.
- **4 quêtes** en machine à états pure, testée.

## 6. Économie

- Coût d'amélioration du refuge : `12 × 1,55^(niveau − 1)`.
- Les 3 premiers niveaux sont offerts.
- Soin à l'atelier : 6 ferraille + 1 ration.
- Le butin est plafonné à 24 emplacements.
- **Aucun achat, aucune publicité, aucun accélérateur dans la slice.** Les
  interfaces d'économie existent, elles ne sont branchées sur aucun SDK.

## 7. Sauvegarde

- Version `3`, migration explicite `1→2→3`, chaque étape testée.
- Écriture atomique : `pending` → copie principale → secours → purge.
- À la charge, on compare les `savedAt` et on garde **la plus récente** :
  une sauvegarde ancienne, venue d'une autre version du jeu ou d'une
  restauration cloud en retard, ne peut pas remplacer la partie en cours.
- Corruption : repli sur le secours, puis sur une partie neuve. Jamais
  d'exception, jamais de perte totale.

## 8. Plateforme

- **Cible : Android, solo, paysage.**
- **Stack livrée :** Vite, JavaScript ES modules, Canvas 2D, CSS mobile, PWA,
  tests `node:test`. Aucune dépendance d'exécution.
- **Ce n'est pas un APK natif.** C'est une PWA installable. Le passage en
  natif (Godot 4 ou enveloppe Capacitor) reste une décision non prise —
  voir `docs/DECISIONS.md`.

## 9. Définition de terminé

Une fonctionnalité est livrée quand : ses critères d'acceptation sont
écrits, ses tests passent, le build passe, son parcours tactile a été vérifié
sur téléphone, ses cas d'erreur sont traités, et la décision a été notée
dans `docs/DECISIONS.md`.

## 10. Hors périmètre

Multijoueur · publicité · achats · monde persistant · contenu de fin ·
art final · audio échantillonné · infrastructure serveur.