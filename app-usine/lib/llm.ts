import { PROVIDER_INFO, type Provider } from "./providers";
import { lireSecrets } from "./secrets";

type Appel = {
  systeme: string;
  utilisateur: string;
  provider?: Provider;
  maxTokens?: number;
};

async function appelOpenAICompatible(base: string, clé: string, modèle: string, système: string, utilisateur: string, maxTokens: number) {
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clé}` },
    body: JSON.stringify({ model: modèle, max_tokens: maxTokens, messages: [ { role: "system", content: système }, { role: "user", content: utilisateur } ] }),
  });
  if (!r.ok) throw new Error(`OpenAI-compatible ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

async function appelAnthropic(clé: string, système: string, utilisateur: string, maxTokens: number) {
  const r = await fetch(`${PROVIDER_INFO.anthropic.url}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": clé, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: maxTokens, system: système, messages: [{ role: "user", content: utilisateur }] }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.content?.[0]?.text ?? "").trim();
}

async function appelGemini(clé: string, système: string, utilisateur: string, maxTokens: number) {
  const base = PROVIDER_INFO.gemini.url;
  const r = await fetch(`${base}/v1beta/models/gemini-2.0-flash:generateContent?key=${clé}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: système }] }, contents: [{ role: "user", parts: [{ text: utilisateur }] }], generationConfig: { maxOutputTokens: maxTokens } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return ((j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("\n").trim());
}

export function ordreFournisseurs(provider?: Provider): string[] {
  const secrets = lireSecrets();
  const dispo = (k: string) => Boolean(secrets[k]);
  const present = ["openai", "anthropic", "gemini", "openrouter", "groq", "custom"].filter((p) => dispo(`cle_${p}`));
  if (provider && present.includes(provider)) return [provider, ...present.filter((p) => p !== provider)];
  return present;
}

export async function appelLLM(a: Appel): Promise<string> {
  const secrets = lireSecrets();
  const ordre = ordreFournisseurs(a.provider);
  if (ordre.length === 0) throw new Error("AUCUNE_CLE");
  const erreurs: string[] = [];
  for (const p of ordre) {
    const cle = secrets[`cle_${p}`] as string;
    const maxTokens = a.maxTokens ?? 2000;
    try {
      if (p === "openai") return await appelOpenAICompatible(PROVIDER_INFO.openai.url, cle, "gpt-4o-mini", a.systeme, a.utilisateur, maxTokens);
      if (p === "openrouter") return await appelOpenAICompatible(PROVIDER_INFO.openrouter.url, cle, "openai/gpt-4o-mini", a.systeme, a.utilisateur, maxTokens);
      if (p === "groq") return await appelOpenAICompatible(PROVIDER_INFO.groq.url, cle, "llama-3.3-70b-versatile", a.systeme, a.utilisateur, maxTokens);
      if (p === "custom") {
        const base = (secrets["url_custom"] || PROVIDER_INFO.custom.url).replace(/\/$/, "");
        const modele = secrets["modele_custom"] || "gpt-4o-mini";
        return await appelOpenAICompatible(base, cle, modele, a.systeme, a.utilisateur, maxTokens);
      }
      if (p === "anthropic") return await appelAnthropic(cle, a.systeme, a.utilisateur, maxTokens);
      if (p === "gemini") return await appelGemini(cle, a.systeme, a.utilisateur, maxTokens);
    } catch (e) {
      erreurs.push(`${p}: ${(e as Error).message}`);
    }
  }
  throw new Error(`ÉCHEC_FOURNISSEURS | ${erreurs.join(" | ")}`);
}
