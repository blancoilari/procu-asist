import Link from "next/link";
import { demoCases, demoDailyItems } from "@/lib/demo-data";

export default function HomePage() {
  const newMovements = demoDailyItems.filter((item) => item.kind === "movement");
  const dueTasks = demoDailyItems.filter((item) => item.kind === "task");
  const pendingSuggestions = demoCases.reduce(
    (count, item) => count + item.suggestions.length,
    0
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Bandeja diaria</h1>
          <p>Novedades, tareas y datos detectados para revisar.</p>
        </div>
        <Link className="button" href="/cases">
          Ver causas
        </Link>
      </header>

      <section className="grid cols-3" aria-label="Indicadores">
        <article className="panel metric">
          <span>Movimientos nuevos</span>
          <strong>{newMovements.length}</strong>
        </article>
        <article className="panel metric">
          <span>Tareas abiertas</span>
          <strong>{dueTasks.length}</strong>
        </article>
        <article className="panel metric">
          <span>Sugerencias pendientes</span>
          <strong>{pendingSuggestions}</strong>
        </article>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>Novedades</h2>
          <div className="list">
            {newMovements.map((item) => (
              <Link className="row" href={`/cases/${item.caseId}`} key={item.id}>
                <span>
                  <span className="row-title">{item.title}</span>
                  <span className="row-meta">
                    <span>{item.caseCaption}</span>
                    <span>{item.date}</span>
                  </span>
                </span>
                <span className="badge accent">Movimiento</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Trabajo pendiente</h2>
          <div className="list">
            {dueTasks.map((item) => (
              <Link className="row" href={`/cases/${item.caseId}`} key={item.id}>
                <span>
                  <span className="row-title">{item.title}</span>
                  <span className="row-meta">
                    <span>{item.caseCaption}</span>
                    <span>{item.date}</span>
                  </span>
                </span>
                <span className="badge warn">Tarea</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
