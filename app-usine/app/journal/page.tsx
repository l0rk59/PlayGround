import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export default function Journal() {
  let s = "";
  try {
    s = fs.readFileSync(path.join(process.cwd(), "..", "usine", "journal.md"), "utf8");
  } catch {
    s = "(journal vide — aucune production encore lancée)";
  }
  return (
    <div>
      <h1>Journal de l'Usine</h1>
      <pre style={{ whiteSpace: "pre-wrap", background: "#0f1115", padding: 16, borderRadius: 10 }}>{s}</pre>
    </div>
  );
}
