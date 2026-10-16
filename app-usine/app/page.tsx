"use client";

import { useState, useEffect } from "react";

type DossierDirecteur = { directeur: string; verdict: string; note: number; commentaire: string };
type Ideee = { nom: string; pitch: string; type: string };
type Production = {
  idee_retentue: Ideee;
  formes_ejectees: { nom: string; raison: string }[];
  dossier_directeurs: DossierDirecteur[];
  score: number;
  prochaines_etapes: string[];
  livrable_immediat: { titre: string; contenu_markdown: string };
};

const exemples = ["surprends-moi", "un outil de suivi de mes habitudes", "un site pour organiser mes idées", "un mini-jeu de réflexe", "un carnet de recettes intelligent"];

export default function Pilotage() {
  const [demande, setDemande] = useState("");
  const [humeur, setHumeur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [production, setProduction] = useState<Production | null>(null);
  const [message, setMessage] = useState("");
  const [clePresente, setClePresente] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(j => setClePresente(Object.keys(j.cles || {}).length > 0));
  }, []);

  async function lancer() {
    setEnCours(true);
    setMessage("⚙️ Conseil des directeurs en session : idéation, débat, scoring...");
    setProduction(null);
    try {
      const r = await fetch("/api/produire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demande, humeur }) });
      const j = await r.json();
      if (j.erreur) {
        setMessage(j.message || j.erreur);
        if (j.brut) setMessage("La réponse n'était pas du JSON valide, la voici brute : " + j.brut);
      } else {
        setProduction(j.production);
        setMessage("");
      }
    } catch (e) {
      setMessage("Erreur réseau : " + String(e));
    }
    setEnCours(false);
  }

  return (
    <div>
      <h1>Poste de pilotage</h1>
      <p style={{ color: "#9aa3af" }}>Dis à l'Usine ce que tu veux produire, ou laisse-la t'imaginer. Elle tient le Conseil des Directeurs et te rend compte.</p>
      {clePresente === false && <div className="card" style={{ borderColor: "#b45309" }}>⚠️ Aucune clé API enregistrée. <a href="/cles">Onglet Mes clés →</a></div>}

      <div className="card">
        <label>Que veux-tu que l'Usine produise ?</label>
        <textarea rows={3} value={demande} onChange={e => setDemande(e.target.value)} placeholder='Ex: "une app de suivi de mes lectures" ou laisse vide : "surprends-moi"' />
        <label style={{ display: "block", marginTop: 10 }}>Contexte libre (ton humeur, ce dont tu as envie) :</label>
        <input value={humeur} onChange={e => setHumeur(e.target.value)} placeholder="Ex: je veux du calme, quelque chose d'utile au quotidien" />
        <div style={{ margin: "10px 0" }}>
          {exemples.map(x => <span key={x} className="pill" style={{ cursor: "pointer" }} onClick={() => setDemande(x === "surprends-moi" ? "" : x)}>{x}</span>)}
        </div>
        <button onClick={lancer} disabled={enCours}>{enCours ? "Production en cours..." : "LANCER LA PRODUCTION"}</button>
        {message && <p style={{ color: "#fca5a5" }}>{message}</p>}
      </div>

      {production && (
        <>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>✅ Idée retenue : {production.idee_retentue?.nom}</h2>
            <p>{production.idee_retentue?.pitch}</p>
            <span className="pill">Type : {production.idee_retentue?.type}</span>
            <span className="pill">Score du Conseil : {production.score}/10</span>
            {production.formes_ejectees?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong>Idees éjectées en session :</strong>
                <ul>{production.formes_ejectees.map((f, i) => <li key={i}>{f.nom} — {f.raison}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Conseil des Directeurs</h3>
            <table>
              <thead><tr><th>Directeur</th><th>Verdict</th><th>Note</th><th>Commentaire</th></tr></thead>
              <tbody>
                {production.dossier_directeurs?.map((d, i) => (
                  <tr key={i}><td>{d.directeur}</td><td>{d.verdict}</td><td>{d.note}/10</td><td>{d.commentaire}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>📦 Premier livrable : {production.livrable_immediat?.titre}</h3>
            <pre style={{ whiteSpace: "pre-wrap", background: "#0f1115", padding: 16, borderRadius: 10, fontSize: 14 }}>{production.livrable_immediat?.contenu_markdown}</pre>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Prochaines étapes</h3>
            <ol>{production.prochaines_etapes?.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        </>
      )}
    </div>
  );
}
