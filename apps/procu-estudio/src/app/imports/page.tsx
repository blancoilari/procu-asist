export default function ImportsPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Importaciones</h1>
          <p>Estado del conector entre ProcuAsist y ProcuEstudio.</p>
        </div>
      </header>

      <section className="grid cols-2">
        <article className="panel">
          <h2>Endpoint</h2>
          <p className="muted">
            POST /api/imports/procuasist/case-snapshot
          </p>
          <p>
            En modo demo valida el contrato y devuelve una respuesta simulada.
            Con Supabase conectado, persistira causas, movimientos, documentos y
            sugerencias.
          </p>
        </article>
        <article className="panel">
          <h2>Proximo paso</h2>
          <p>
            Agregar en ProcuAsist la configuracion de token y el boton
            experimental "Enviar a ProcuEstudio" en MEV/PJN.
          </p>
        </article>
      </section>
    </>
  );
}
