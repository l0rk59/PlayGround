# SHARDLINE

Puzzle de blocs roguelite, portrait mobile. Pose des éclats sur une grille 8×8,
enchaîne lignes, colonnes et carrés 3×3, construis un score absurde avec des reliques.

Le prototype jouable est dans `index.html` + `game/`. Le moteur de règles est dans `core/`.

## Stack

- TypeScript strict, `noUncheckedIndexedAccess`, aucune dépendance runtime.
- Vite pour le bundling, Vitest pour les tests, canvas 2D pour le rendu.
- Aucune bibliothèque de jeu. Tout le calcul est dans `core/`.

## Arborescence

```
core/      moteur de règles PUR. Zéro DOM, zéro canvas, zéro Date.now, zéro Math.random.
game/      client web : rendu, entrées tactiles, Résonance, HUD.
data/      reliques et règles de boss en JSON, validés au chargement par core/load.ts.
tools/     simulateur d'équilibrage, bots, plan de coups, vérification navigateur.
tests/     tests de core/ — aucun test ne touche au DOM.
```

`core/` ne doit jamais importer depuis `game/`. C'est la frontière qui permet
de rejouer une run côté serveur et de la valider.

## Règles de déterminisme (non négociables)

Ces règles sont la raison d'être de `core/`. Les casser casse l'anti-triche.

1. **RNG maison et seedé.** `makeRng(seed)` dans `core/rng.ts`. Jamais `Math.random`.
2. **Maths entières.** Les scores sont des entiers. Le multiplicateur est stocké en
   points de base (`multBp`, 10000 = ×1.00), jamais en flottant.
3. **Le plancher du multiplicateur ne s'applique pas à l'accumulateur.** `bonusBp`
   part de 0 et ne descend jamais sous 0. Clamper `bonusBp` avec `clampMultBp` offre
   un ×1,5 gratuit à chaque joueur. C'est un bug déjà.commit une fois.
4. **L'état du RNG vit dans `RunState`.** Une fonction qui consomme du RNG doit écrire
   `state.rngState` avant de rendre la main, sinon le rejeu diverge.
5. **Une décision qui doit être rejouée est stockée dans l'état.** Les offres de reliques
   vivent dans `state.pendingRelics` et sont produites par `settleRound`. Ne jamais les
   régénérer ailleurs : le client et le rejeu doivent voir exactement la même offre.
6. **Rien d'aléatoire côté rendu** ne doit influencer l'état du jeu.

## Commandes

```sh
npm run typecheck      # tsc --noEmit, strict
npm test               # 131 tests sur core/
npm run build          # dist/ statique, servable tel quel
npm run verify         # typecheck + tests + build
npm run sim            # simulateur d'équilibrage -> reports/*.csv
npm run plan           # rejoue une run et écrit reports/plan.json
npm run verify:browser # preuve navigateur : drag, score, aucune erreur console
```

`npm run verify:browser` exige le serveur démarré (`./start.sh`, port 3000) et
utilise le Chromium SwiftShader de `~/.local/share/omgithub-playwright`. C'est un
rendu logiciel CPU : ne jamais le présenter comme une preuve de performance GPU.

## Définition de « terminé »

- `npm run verify` passe au vert.
- Tout nouveau comportement de règles a un test dans `tests/`.
- Toute nouvelle relique passe le simulateur sans dépasser ±25 % du score médian.
- Aucune erreur console dans le navigateur.
- Une modification d'équilibrage est justifiée par une sortie de `npm run sim`.

## Équilibrage

`npm run sim` joue N runs avec trois politiques (aléatoire, gloutonne, heuristique)
et écrit `reports/balance_runs.csv`, `balance_summary.csv`, `balance_relics.csv`.

Lecture attendue :

- l'aléatoire doit perdre au round 1 (plancher),
- l'heuristique doit être nettement au-dessus de la gloutonne (écart de skill),
- aucune relique ne doit sortir de la bande ±25 % du contrôle sans relique.

Pour tester une relique isolément, le simulateur utilise `RunDeps.forceOffer`, qui
force la relique dans les offres. C'est aussi l'équivalent du « menu développeur caché »
prévu au masterplan §5.

## Adding a relic

1. Ajouter l'entrée dans `data/relics.json` : `id`, `name`, `archetype`, `rarity`,
   `trigger`, `condition`, `effect`, `text.fr`, `text.en`.
2. L'identifiant doit être unique, le schéma est validé au chargement.
3. `npm test` puis `npm run sim`. Si la relique sort de la bande, retuner sa valeur.

Effets bornés disponibles : `add_shards`, `add_mult`, `mul_mult`,
`add_shards_per_empty`, `replay_last_clear`, `freeze_random_cell`,
`transform_random_piece`, `heal_free_cells`.

## Adding a boss rule

Kind dans `BossKind`, implémentation dans `core/boss.ts`, entrée dans
`data/bosses.json`. Les kinds déjà pris : `frozen_cells`, `forbidden_color`,
`rotating_pieces`, `sparse_bag`, `low_shards`, `narrow_lines`.

`frozen_cells` s'applique à chaque pose via `tickBoss`, pas au début du round :
la grille est vidée entre les rounds, un gel au démarrage ne ferait rien.

## Rappel de méthode

L'IA ne juge pas le fun. `npm test` et `npm run sim` disent si le jeu est **juste**.
Seul un joueur dit s'il est **amusant**. Ne pas confondre les deux.