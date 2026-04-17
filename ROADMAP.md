# Roadmap de ProcuAsist

ProcuAsist es una herramienta hecha por un abogado de la matrícula, para colegas. Es gratuita y sin fines de lucro. Acá te cuento qué viene y en qué orden.

> **Nota**: este roadmap son intenciones, no compromisos. Los tiempos dependen de la disponibilidad y del feedback que reciba. Si algo te resulta urgente, escribime y vemos cómo priorizarlo.

---

## Versión actual: v0.4.0

**Lo que ya funciona bien:**
- **MEV (Provincia de Buenos Aires)**: descarga completa de expedientes en un ZIP enriquecido. Incluye un PDF resumen con todos los pasos procesales y los adjuntos descargados con reintentos. Selección de qué pasos procesales bajar.
- **JUSCABA (Poder Judicial de CABA)**: auto-login, búsqueda de causas, marcadores básicos. (Descarga ZIP completa: en desarrollo).
- **Marcadores**: guardá tus expedientes favoritos con un click y accedelos desde el panel lateral.
- **Sincronización local**: todos tus datos se guardan en tu navegador. Nada se envía a servidores externos.
- **Modo oscuro** opcional.

---

## Próximos hitos

### v0.5.0 — Descarga completa en JUSCABA
Llevar JUSCABA al mismo nivel que MEV: descarga del expediente completo en un ZIP con PDF resumen y adjuntos. Mismo selector de pasos procesales.

### v0.6.0 — Portal del Poder Judicial de la Nación (PJN)
Sumar `sso.pjn.gov.ar` con auto-login, búsqueda y descarga completa. Replicar las opciones nativas del portal: "despachos/escritos", "notificaciones", "información", "ver todos".

### v0.7.0 — Login más simple
Repensar el flujo de PIN maestro para que sea más intuitivo. Posibilidad de agregar un email opcional para futuras funciones (resumen diario, etc.).

### v0.8.0 — Monitoreo automático de causas
Marcar causas como "monitoreadas" y recibir notificaciones cuando hay movimientos nuevos. Frecuencia de chequeo configurable. Funciona en MEV primero.

### v1.0.0 — Monitoreo en JUSCABA y PJN
Llevar el monitoreo automático a los tres portales. Versión 1.0 con paridad de funciones.

---

## Cómo colaborar

- **Reportar errores o pedir features**: escribime a [blancoilariasistente@gmail.com](mailto:blancoilariasistente@gmail.com?subject=ProcuAsist%20-%20feedback) o abrí un issue en [GitHub](https://github.com/blancoilari/procu-asist/issues). Cuanto más detalle (qué portal, qué pasos hiciste, qué esperabas), mejor puedo arreglarlo.
- **Invitarme un cafecito**: si te resulta útil y querés colaborar con la causa, podés hacerlo desde [cafecito.app/procuasist](https://cafecito.app/procuasist). No es necesario, pero ayuda a mantener el proyecto.
- **Compartirla con colegas**: pasale el link a otros abogados que puedan aprovecharla.

---

## Historial de versiones

Ver [CHANGELOG.md](CHANGELOG.md) para el detalle de cambios por versión.
