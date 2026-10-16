import { NextResponse } from "next/server";
import { appelLLM } from "../../../lib/llm";import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const systeme = `Tu es l'orchestrateur de l'Usine IA Personnelle. Tu joues le Conseil des 10 Directeurs (Projets, Produit, Tech, IA, Data, Design, Qualité, Sécurité-Légal, Ops, Amélioration).
Réponds STRICTEMENT en JSON valide, sans texte autour, avec ce schéma :
{
  "idee_retentue": {"nom": string, "slug": string, "pitch": string, "type": string},
  "formes_ejectees": [{"nom": string, "raison": string}],
  "dossier_directeurs": [{"directeur": string, "verdict": "POUR"|"CONTRE"|"Conditionnel", "note": number, "commentaire": string}],
  "score": number,
  "prochaines_etapes": [string],
  "livrable_immediat": {"titre": string, "contenu_markdown": string}
}
Le livrable_immediat est la meilleure première production concrète de l'Usine (spec complète, structure, contenus) que le propriétaire peut lire tout de suite.
Interdits : produits illégaux, nuisibles, hors produit digital. Si le brief est vide ou "surprends-moi", propose TOI-MÊME les idées.`;

export async function POST(req: Request) {
  const { demande, humeur } = await req.json().catch(() => ({ demande: "", humeur: "" }));
  try {
    const reponse = await appelLLM({
      systeme,
      utilisateur: `Brief du propriétaire : ${demande || "surprends-moi"}\nHumeur / contexte : ${humeur || "aucun"}\nDate : ${new Date().toISOString()}`,
      maxTokens: 4000,
    });
    let parse;
    try {
      parse = JSON.parse(reponse.replace(/^```(json)?/, "").replace(/```$/, ""));
    } catch {
      return NextResponse.json({ erreur: "RÉPONSE_NON_JSON", brut: reponse });
    }
    const slug = String(parse?.idee_retentue?.slug || "projet-sans-nom").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const dossier = path.join(process.cwd(), "..", "usine", "projets", slug);
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, "ideation-0.json"), JSON.stringify(parse, null, 2));
    fs.appendFileSync(path.join(process.cwd(), "..", "usine", "journal.md"), `\n## ${new Date().toISOString()} — Bloc 0 : ${slug} (score ${parse?.score})\n`);
    return NextResponse.json({ ok: true, production: parse, slug });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "AUCUNE_CLE") return NextResponse.json({ erreur: "AUCUNE_CLE", message: "Configure ta clé API dans l'onglet Mes clés." });
    return NextResponse.json({ erreur: "ÉCHEC_PRODUCTION", message: msg.slice(0, 500) });
  }
}
