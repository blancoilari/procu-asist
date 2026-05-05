import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcuEstudio",
  description: "Gestion judicial asistida para estudios juridicos"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link className="brand" href="/">
              <strong>ProcuEstudio</strong>
              <span>Expedientes vivos desde los portales</span>
            </Link>
            <nav className="nav" aria-label="Principal">
              <Link href="/">Bandeja diaria</Link>
              <Link href="/cases">Causas</Link>
              <Link href="/imports">Importaciones</Link>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
