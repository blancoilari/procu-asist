import Link from "next/link";
import { demoCases } from "@/lib/demo-data";

export default function CasesPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Causas</h1>
          <p>Expedientes importados desde ProcuAsist.</p>
        </div>
        <Link className="button secondary" href="/imports">
          Ver importaciones
        </Link>
      </header>

      <section className="panel">
        <div className="list">
          {demoCases.map((item) => (
            <Link className="row" href={`/cases/${item.id}`} key={item.id}>
              <span>
                <span className="row-title">{item.caption}</span>
                <span className="row-meta">
                  <span>{item.normalizedNumber}</span>
                  <span>{item.courtName}</span>
                  <span>{item.portal.toUpperCase()}</span>
                </span>
              </span>
              <span className="badge accent">
                {item.suggestions.length} sugerencias
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
