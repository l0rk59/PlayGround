export default function Nav() {
  return (
    <nav style={{ display: "flex", gap: 20, padding: "12px 16px", borderBottom: "1px solid #333", background: "#0f1115" }}>
      <strong>🏭 Usine IA</strong>
      <a href="/">Poste de pilotage</a>
      <a href="/cles">Mes clés</a>
      <a href="/journal">Journal</a>
    </nav>
  );
}
