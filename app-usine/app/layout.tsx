import type { Metadata } from "next";
import Nav from "./components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Usine IA Personnelle",
  description: "Mon usine autonome de produits digitaux",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Nav />
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>{children}</main>
      </body>
    </html>
  );
}
