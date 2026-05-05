import Link from "next/link";
import { notFound } from "next/navigation";
import { demoCases } from "@/lib/demo-data";

type CaseDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = await params;
  const item = demoCases.find((demoCase) => demoCase.id === id);

  if (!item) {
    notFound();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{item.caption}</h1>
          <p>
            {item.normalizedNumber} - {item.courtName}
          </p>
        </div>
        <Link className="button secondary" href="/cases">
          Volver
        </Link>
      </header>

      <section className="grid cols-3" aria-label="Ficha">
        <article className="panel metric">
          <span>Portal</span>
          <strong>{item.portal.toUpperCase()}</strong>
        </article>
        <article className="panel metric">
          <span>Movimientos</span>
          <strong>{item.movements.length}</strong>
        </article>
        <article className="panel metric">
          <span>Datos para confirmar</span>
          <strong>{item.suggestions.length}</strong>
        </article>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>Timeline</h2>
          <div className="timeline">
            {item.movements.map((movement) => (
              <div className="timeline-item" key={movement.id}>
                <strong>{movement.title}</strong>
                <span className="muted">{movement.date}</span>
                <span>{movement.description}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Sugerencias</h2>
          <div className="list">
            {item.suggestions.map((suggestion) => (
              <div className="row" key={suggestion.id}>
                <span>
                  <span className="row-title">{suggestion.label}</span>
                  <span className="row-meta">
                    <span>{suggestion.value}</span>
                    <span>{Math.round(suggestion.confidence * 100)}% confianza</span>
                  </span>
                </span>
                <span className="badge">Pendiente</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
