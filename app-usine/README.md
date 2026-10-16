# 🏭 Usine IA Personnelle — guide sans jargon

C'est TON usine. Elle imagine et fabrique des produits digitaux pour toi.
Elle tourne avec tes clés d'API (tu les fournis une fois, elles rц╘tent sur ta machine).

## Lancer l'usine (2 commandes)
```
cd app-usine
npm run dev
```
Puis ouvre http://localhost:3000

## Utiliser
1. **Mes clés** (http://localhost:3000/cles) : colle une clц╘ (OpenAI, Claude, Gemini,
   OpenRouter, Groq, ou un LLM local). Enregistrer. Une seule suffit.
2. **Poste de pilotage** (http://localhost:3000) : dis ce que tu veux produire, ou clique
   "surprends-moi". Le Conseil des 10 Directeurs gц╘nц╗re, dц╘bat, score, retient,
   et te livre un premier dossier concret.
3. **Journal** (http://localhost:3000/journal) : l'historique de tout ce que l'usine produit.

## Confidentialité
- Tes clés : fichier `usine-secrets.local.json` sur TON disque. Jamais dans git.
- Tes projets : dossier `usine/projets/` versionnц╘.
- Aucun envoi de clц╘ en dehors du fournisseur d'IA choisi.

## Architecture (lire si curieux)
Les dossiers de cadrage sont dans `../usine/` :
00-VISION, 01-ARCHITECTURE, 02-ORGANIGRAMME, 03-ROADMAP, agents.json.

## Problème courant
- "AUCUNE_CLE" : tu n'as pas encore enregistrц╘ de clц╘ → onglet Mes clés.
- Port 3000 occupц╘ : `npm run dev -- -p 3001`
