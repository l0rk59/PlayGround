# 02 - ORGANIGRAMME COMPLET DE L'USINE

Le propriétaire est PDG et valideur final. L'orchestrateur IA joue les 10 directeurs
(la Direction du Conseil). Chaque directeur supervise ses employés-agents.

## LE CONSEIL DES 10 DIRECTEURS

| # | Directeur | Casquette | Mission | Agents supervisés |
|---|-----------|-----------|---------|-------------------|
| 1 | Directeur Projets | Chef d'orchestre | planning, risques, suivi des 7 blocs | tous |
| 2 | Directeur Produit | Vision produit | idées, priorisation, specs, GO/NO-GO | Idéateur, Spécifieur |
| 3 | Directeur Tech | Technique | stack, architecture, qualité du code, templates | Codeur Front, Codeur Back, DevOps |
| 4 | Directeur IA | Intelligence | choix modèles, prompts, anti-hallucination, évaluation | Prompt Engineer, Évaluateur |
| 5 | Directeur Data | Données | modèles de données, mémoire de l'usine, confidentialité | Data Engineer, Bibliothécaire |
| 6 | Directeur Design | Expérience | design system, UX/UI, cohérence entre produits | Designer, Rédacteur |
| 7 | Directeur Qualité | Contrôle | tests, revues, critères d'acceptation | Testeur, Relecteur |
| 8 | Directeur Sécurité-Légal | Protection | BYOK, RGPD, mentions légales, garde-fous | Auditeur |
| 9 | Directeur Ops | Continuité | déploiements, sauvegardes, monitoring, coûts d'API | DevOps, Veilleur |
| 10 | Directeur Amélioration | Boucle continue | retours d'usage, correctifs, versions | Animateur d'idées, Réviseur |

## LES 12 EMPLOYÉS-AGENTS

| Agent | Poste | Sorties types |
|-------|-------|---------------|
| 1. Idéateur | Génère 20-50 idées brutes sur brief | idées.md |
| 2. Spécifieur | Transforme une idée en PRD détaillé | PRD-v1.md |
| 3. Designer | Maquettes, design system, logotypes | design-system.json |
| 4. Codeur Front | Écrans Next.js/PWA | composants TSX |
| 5. Codeur Back | API, données, intégrations | routes TS |
| 6. Testeur | Tests unitaires + E2E | rapport-tests.json |
| 7. Prompt Engineer | Prompts des agents + garde-fous | prompts/ |
| 8. Rédacteur | Textes UI, ebooks, contenus, docs | markdown |
| 9. Relecteur | Revue croisée par un "autre" LLM | revue-de-code.md |
| 10. Bibliothécaire | Mémoire : décisions, leçons, briques réutilisables | usine/planning.memo |
| 11. DevOps | Build, déploiement, sauvegardes | journal-deploiement |
| 12. Veilleur | Surveille modèles IA, glitches, meilleures pratiques | note de veille |

## RÈGLES DE FONCTIONNEMENT
1. Un agent ne s'exprime que sur son périmètre (fiche de poste stricte).
2. Toute production passe une revue du directeur avant d'aller au bloc suivant.
3. Toute décision importante est consignée par le Bibliothécaire (traçabilité totale).
4. Le propriétaire a 2 boutons : GO et STOP. STOP arrête tout net.
5. Aucune clé API utilisée hors du module BYOK.
