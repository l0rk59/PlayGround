# 01 - ARCHITECTURE DE L'APP-USINE

## Principe général
Séquence de production à 7 blocs. Chaque bloc a des entrées, un gardien (directeur),
des sorties et des garde-fous. Aucun bloc n'avance sans avoir validé le précédent.

```
OUTILS (moteurs, temps, clés API)
   |
[0 IDEATION] --> [1 SPEC] --> [2 DESIGN] --> [3 FABRICATION] --> [4 CONTROLE] --> [5 LIVRAISON] --> [6 AMELIORATION]
        ^                                                                                                |
        +----------------------------- boucle de retour depuis [6] --------------------------------------+
```

## Détail des blocs

### Bloc 0 - IDÉATION (tourne seul, gardien : Directeur Produit)
- Entrée : "je veux X" ou "surprends-moi"
- Travail : générer 20-50 idées brutes via LLM, puis qualification automatisée
  (fiche : qui / quoi / pourquoi / effort / risque) et score du Conseil des Directeurs
- Sortie : 1 projet retenu + dossier d'idéation archivé dans usine/projets/<slug>/
- Garde-fou : rien d'illégal, rien hors périmètre "produit digital"

### Bloc 1 - SPEC (gardien : Directeur Produit)
- Entrée : dossier d'idéation
- Travail : cahier des charges complet v1 (personas, fonctionnalités, données,
  écrans, critères d'acceptation) + tour de table des directeurs
- Sortie : usine/projets/<slug>/PRD-v1.md
- Garde : GO validé par le propriétaire (1 clic)

### Bloc 2 - DESIGN (gardien : Directeur Design)
- Entrée : PRD
- Travail : maquettes textuelles puis visuelles + design system (couleurs, typo,
  composants réutilisés par tous les produits de l'usine)
- Sortie : usine/projets/<slug>/design-system.json + maquettes

### Bloc 3 - FABRICATION (gardiens : Directeur Tech + Directeur IA)
- Entrée : PRD + design system
- Travail : génération de code par les agents (backend, frontend, PWA)
  à partir du template de production commun
- Sortie : usine/projets/<slug>/app/ (construisible et testable)
- Garde-fou automatique : le build doit passer, sinon retour auto au bloc 3

### Bloc 4 - CONTRÔLE (gardiens : Directeur Qualité + Directeur Sécurité-Légal)
- Entrée : l'app construite
- Travail : tests automatisés, revue du code par LLM, red-teaming des prompts,
  checklist RGPD et mentions légales
- Sortie : rapport de contrôle vert, ou retour au bloc 3 avec corrections
- Garde : GO validé par le propriétaire

### Bloc 5 - LIVRAISON (gardien : Directeur Ops)
- Entrée : produit validé
- Travail : déploiement ou empaquetage local, documentation d'usage, sauvegarde
- Sortie : produit utilisable + usine/projets/<slug>/LIVRE.md

### Bloc 6 - AMÉLIORATION CONTINUE (gardien : Directeur Amélioration)
- Entrée : usage réel + retours du propriétaire
- Travail : liste d'améliorations priorisée, correctifs, versions v1.1, v1.2...
- Sortie : retour au bloc 0 ou redéploiement assisté

## BYOK — Module de clés API (gardien : Directeur Sécurité-Légal)
- Écran unique "Mes clés" : OpenAI, Anthropic, Gemini, OpenRouter, Groq, LLM local.
- Stockage : fichier local usine-secrets.secret.json (gitignored, jamais dans git).
- Les clés ne sont jamais envoyées en dehors du fournisseur choisi.
- Si une clé tombe, bascule automatique sur le fournisseur suivant disponible.

## Stack choisie (pour le propriétaire non-technique)
- L'app-usine : Next.js + TypeScript, un seul langage pour tout.
- Le produit fabriqué utilise le même template de production.
- Coût : clés d'API uniquement.

## Persistances
- Idées, projets, PRD, design, journal : dans usine/ (fichiers versionnés).
- Clés : fichier local non versionné.
