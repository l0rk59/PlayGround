"use client";

import { useState, useEffect } from "react";

type Categorie = { champ: string; label: string; placeholder: string };

const CHAMPS: Categorie[] = [
  { champ: "cle_openai", label: "OpenAI", placeholder: "sk-..." },
  { champ: "cle_anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  { champ: "cle_gemini", label: "Google Gemini", placeholder: "AIza..." },
  { champ: "cle_openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
  { champ: "cle_groq", label: "Groq", placeholder: "gsk_..." },
  { champ: "cle_custom", label: "Autre fournisseur compatible OpenAI", placeholder: "clé..." },
];

export default function Cles() {
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [masque, setMasque] = useState<Record<string, string>>({});
  const [urlCustom, setUrlCustom] = useState("");
  const [modeleCustom, setModeleCustom] = useState("");
  const [statut, setStatut] = useState("");

  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(j => {
      setMasque(j.cles || {});
      const v: Record<string, string> = {};
      setValeurs(v);
    });
  }, []);

  async function enregistrer() {
    setStatut("Enregistrement...");
    const body: Record<string, string> = {};
    for (const c of CHAMPS) if (valeurs[c.champ]) body[c.champ] = valeurs[c.champ];
    for (const c of CHAMPS) if (!(c.champ in valeurs) && !masque[c.champ]) body[c.champ] = "";
    if (urlCustom) body["url_custom"] = urlCustom;
    if (modeleCustom) body["modele_custom"] = modeleCustom;
    const r = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.ok) {
      setStatut("✅ Enregistré. Les clés restent sur ta machine (fichier usine-secrets.local.json, jamais publié).");
      const j2 = await fetch("/api/keys").then(x => x.json());
      setMasque(j2.cles || {});
      setValeurs({});
    } else setStatut("❌ " + (j.message || "échec"));
  }

  return (
    <div>
      <h1>Mes clés API</h1>
      <p style={{ color: "#9aa3af" }}>
        L'Usine fonctionne avec TES clés (BYOK). Ellles sont stockées uniquement sur ta machine,
        dans un fichier ignoré par Git. Tu peux en renseigner une seule ou plusieurs.
      </p>
      <div className="card">
        {CHAMPS.map(c => (
          <div key={c.champ} style={{ marginBottom: 14 }}>
            <label><strong>{c.label}</strong> {masque[c.champ] ? <span style={{ color: "#4ade80" }}>({masque[c.champ]} déjà enregistrée — laisse vide pour garder)</span> : ""}</label>
            <input type="password" value={valeurs[c.champ] || ""} onChange={e => setValeurs(v => ({ ...v, [c.champ]: e.target.value }))} placeholder={c.placeholder} />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label><strong>URL du fournisseur "Autre"</strong></label>
          <input value={urlCustom} onChange={e => setUrlCustom(e.target.value)} placeholder="http://localhost:1234/v1" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label><strong>Modèle "Autre"</strong> (ex: llama-3.2, gpt-4o-mini...)</label>
          <input value={modeleCustom} onChange={e => setModeleCustom(e.target.value)} placeholder="gpt-4o-mini" />
        </div>
        <button onClick={enregistrer}>Enregistrer mes clés</button>
        {statut && <p>{statut}</p>}
      </div>
    </div>
  );
}
