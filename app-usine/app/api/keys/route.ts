import { NextResponse } from "next/server";
import { lireSecrets, ecrireSecrets } from "../../../lib/secrets";
export const runtime = "nodejs";

export async function GET() {
  const secrets = lireSecrets();
  const masque: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) {
    masque[k] = v ? `••••${String(v).slice(-4)}` : "";
  }
  return NextResponse.json({ cles: masque });
}

export async function POST(req: Request) {
  const body = await req.json();
  const autorisees = ["cle_openai", "cle_anthropic", "cle_gemini", "cle_openrouter", "cle_groq", "cle_custom", "url_custom", "modele_custom"];
  const reçues: Record<string, string> = {};
  for (const k of autorisees) {
    if (typeof body[k] === "string" && body[k]) reçues[k] = body[k];
    else if (body[k] === "") reçues[k] = "";
  }
  ecrireSecrets(reçues);
  return NextResponse.json({ ok: true, enregistrées: Object.keys(reçues).filter(k => reçues[k]) });
}
