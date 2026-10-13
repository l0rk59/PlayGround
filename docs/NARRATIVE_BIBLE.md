# Bible narrative — Dernier Refuge

Le récit de *Dernier Refuge* fonctionne par **contradiction**. Chaque
découverte ne dit pas ce qu'il faut faire : elle invalide une hypothèse que
le joueur tenait pour acquise. Registre vivant dans `src/data/world.js`
(`CANON`, `DISCOVERIES`).

---

## 1. Chronologie

1. **Avant.** Une maison, quelque part dans une vallée. Quelqu'un y vit.
   On ne sait pas qui, on ne sait pas pourquoi.
2. **L'événement.** Une catastrophe sans cause identifiée. L'humanité est
   décimée. Le monde ne s'arrête pas : il se *cesse*, ce qui est pire.
3. **Le réveil.** Le protagoniste se réveille avec une clé dans la main et
   un chemin connu. La maison est à deux kilomètres.
4. **L'arrivée.** La porte s'ouvre avant que la main touche la serrure.
   Une femme du nom d'Irma est déjà là.
5. **La vallée.** Cinq lieux. Cinq versions du même événement, incompatibles.
6. **Le Seuil.** Ce qui gardait la porte ne la ferme plus.

## 2. Trois registres

### Établi — vrai dans l'univers, dit au joueur

- Une catastrophe sans cause identifiée a effacé une grande partie de l'humanité.
- La maison résiste à certains phénomènes. C'est anormal.
- Le protagoniste connaît le chemin sans souvenir de l'avoir appris.
- Les Veilleurs contrôlent une route et refuse de laisser passer.
- Les voix de l'enregistrement sont en désaccord sur ce qui est arrivé.

### Hypothèses — ce que le joueur croit

- La maison choisit ses occupants au lieu de les tirer au hasard.
- Les phénomènes ont réagi **à** la maison, pas l'inverse.
- Le protagoniste est déjà venu avant la catastrophe, et a oublié.

### Secrets — vrais, jamais prononcés

- Le Gardien de seuil était un gardien humain.
- La clé ne ouvre pas la porte : elle la retient.
- Le refuge n'est pas un abri. C'est un point de rendez-vous.

## 3. Les découvertes

Chaque entrée de `DISCOVERIES` porte le registre qu'elle **contredit**.

| Id | Titre | Contredit |
|---|---|---|
| `note_pile` | Une pile de tickets de ration | hypothèses |
| `record_gare` | Enregistrement 04 — « le seuil » | établi |
| `note_puits` | Fiche d'enterrement | secrets |
| `banniere_veilleurs` | Bannière des Veilleurs | secrets |

**Test d'écriture :** une découverte qui confirme une hypothèse sans en
 invalider une autre est un butin, pas une révélation. Si on peut la
retirer sans rien changer, elle est inutile.

## 4. Interdits

- **Ne jamais expliquer pourquoi le monde s'est arrêté.** C'est le moteur
  de l'intrigue, pas son résultat. Le rôle du jeu est de rendre cette
  absence insupportable.
- **Ne jamais faire parler un ennemi.** Un mort-vivant qui explique retire
  la menace. Les seuls Parlants sont humains, et ils se contredisent.
- **Ne jamais nommer la catastrophe avant la Bête.**
- Le compagnon ne parle pas. Il a une intention, pas un scénario.

## 5. Voix

| Voix | Registre | Exemple |
|---|---|---|
| Narrateur | Constat, pas d'émotion | « La maison est à deux kilomètres. Tu connais le chemin des yeux. » |
| Irma | Sec, material, un peu défensive | « Elle a toujours fait ça. Elle ouvre avant. » |
| Le Seuil | Aucun dialogue. Un nom sur une barre de vie. | — |

Règle de longueur : **une ligne de dialogue tient en une phrase qu'on peut
lire en marchant.** Si une réplique dépasse deux phrases, elle est coupée.

## 6. Le chien

Le chien n'a pas de nom dans le texte du joueur — c'est « Rouffe », Appointé
au refuge. Il se débloque par une rencontre, jamais par un tirage payant. Il
peut tomber, il revient. Il ne parle jamais. Sa présence n'est jamais
nécessaire pour gagner : c'est une condition de conception, testée dans
`tests/expedition.test.js`.

## 7. Le Gardien de seuil

Trois phases nommées : **Veille**, **Récit**, **Faille**. La phase 3 est le
moment d'horreur le plus marqué du jeu, et c'est le seul endroit où l'effet
est assumé comme tel. Le joueur ne le voit qu'une fois : la récompense est
unique et non répétable.

Ce qu'il ne fait pas : il ne parle pas, il ne se justifie pas, il ne change
pas d'avis. C'est un gardien qui a oublié ce qu'il garde.