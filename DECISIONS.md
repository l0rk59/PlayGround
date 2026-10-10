# Journal de décisions

Format imposé par le masterplan : toute décision modifiée = une ligne datée ajoutée à la fin.

- 2026-10-10 · **Format** — `core/` est écrit en TypeScript et le prototype est un build web
  installable, au lieu de Godot 4.x / GDScript. L'environnement de build sait compiler et
  vérifier du web, pas exécuter ni exporter Godot ; et le masterplan §6 réclame déjà
  « à terme un port TypeScript du moteur de règles » pour la ré-simulation anti-triche.
  Coût assumé : il n'existe qu'un seul moteur de règles, donc rien n'est jeté si on revient à Godot.
- 2026-10-10 · **Budget de coups** — 24 coups au round 1 (+2 par round, plafond 32), et non
  14-18. Mesuré : à 16 coups le bot plafonne à 0,03 ligne par coup et **aucune** run ne
  franchit un seul round. Le « 14-18 coups » du §2 était une hypothèse non testée.
- 2026-10-10 · **Objectifs de score** — 80 ×1,35 sur 6 rounds, 80 ×1,8 sur le prototype à
  3 rounds. Recalibré par `npm run sim`, pas à la main. Sortie de référence : run médiane
  au round 2 sur 3, 0 Relique hors de la bande ±25 %.
- 2026-10-10 · **Contenu V0** — 12 reliques et 6 règles de boss, conformes aux cibles du §2,
  mais le nombre de tours et la difficulté sont ceux de la tranche verticale, pas de la V1.
- 2026-10-10 · **Défi du jour** — non implémenté. Le masterplan ne tranche pas entre
  « reliques tirées au sort » (le classement devient du RNG) et « reliques fixées par le
  serveur » (la maîtrise compte). À décider **avant V0.5** : cela change le schéma RNG,
  le journal de coups et la table des classements.
- 2026-10-10 · **Critère R (Résonance)** — ajouté. La Résonance est la signature du jeu
  (§2) mais aucune section du §10 ne mesurait si elle fonctionne. Critère proposé :
  après 20 minutes, 5 testeurs non prévenus décrivent spontanément la musique et aucun ne
  la coupe.
- 2026-10-10 · **Économie** — la porte « LTV ≥ 1,5 × CPI » du §4 n'est pas atteignable avec
  des pubs récompensées aux rétentions visées (estimation : LTV ≈ 0,20-0,40 USD face à un
  CPI puzzle tier-1 de 1,2-3 USD Android). Le trafic payant est considéré comme écarté ;
  l'acquisition repose sur l'organique et le défi du jour. À re-tester avant toute dépense.