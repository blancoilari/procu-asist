# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

## [0.6.0] - 2026-04-23

### Soporte para Poder Judicial de la Nación (PJN)

**Auto-login compartido y catálogo**
- Auto-login contra Keycloak SSO (`sso.pjn.gov.ar`): una sola ventana de login deja la sesión activa para todos los subsistemas PJN
- Cliente de la API REST `api.pjn.gov.ar` con captura automática del token JWT del portal — feed de novedades disponible
- Lectura del listado de causas en `scw.pjn.gov.ar`: Relacionados (letrado/parte) y Favoritos
- Parser del detalle del expediente: datos generales + 4 pestañas (Actuaciones, Intervinientes, Vinculados, Recursos)

**Descarga de expedientes PJN — ZIP completo**
- Nuevo botón flotante "Descargar ZIP" en las páginas de expediente y actuaciones históricas de scw.pjn.gov.ar
- Modal de selección: tabla completa de actuaciones con checkbox por fila, atajos "Seleccionar visibles / Ninguna / Solo con documento"
- Filtros por categoría nativa del portal: Despachos/Escritos, Notificaciones, Información, más atajo "Ver todos"
- Paginación automática del listado de actuaciones (soporta expedientes con cientos de pasos procesales)
- Auto-importación de actuaciones históricas vía fetch same-origin cuando el link directo está disponible; si es un botón JSF, muestra un aviso para navegar manualmente a "Ver históricas"
- ZIP generado incluye: `resumen.pdf` (datos generales + tabla completa de actuaciones) y un PDF por actuación seleccionada con formato `fs-{foja}_{YYYY-MM-DD}_{descripcion}.pdf` (consistente con MEV)
- `_verificacion.txt` con detalle de errores si alguna descarga individual falló

**Novedades del flujo**
- El FAB aparece tanto en `expediente.seam` como en `actuacionesHistoricas.seam`
- Selección "efectiva" = marca manual ∩ categorías visibles, para que filtrar una categoría excluya sus filas del ZIP sin destruir marcas manuales en otras categorías

## [0.4.0] - 2026-04-17

### Primera versión publicada en Chrome Web Store

**Comunidad y feedback**
- Mensaje de autoría visible en Onboarding y en Ajustes: hecho por un abogado de la matrícula, para colegas, gratis y sin fines de lucro
- Nuevos botones en Ajustes y popup: "Reportar error o sugerencia" (mailto) e "Issues en GitHub"
- Cafecito disponible también en el popup, no solo en el sidepanel

**Documentación pública**
- Nuevo `ROADMAP.md` orientado a colegas: hoja de ruta hasta v1.0.0 en lenguaje no técnico
- Nuevo `PRIVACY.md` con política de privacidad detallada (requerida para Chrome Web Store)
- Sección "Para abogados" agregada al inicio del README
- Fix: URL correcta de JUSCABA en el README (`eje.jus.gov.ar`)

**Limpieza interna**
- Removido módulo Supabase completo (auth, sync, OAuth, client) — la extensión es 100% local
- Removido permission `identity` y host de Supabase del manifest
- Renombrados content scripts a la convención WXT `*.content.ts`
- Rebrand consistente: EJE → JUSCABA en toda la UI y documentación

**MEV — mejoras menores**
- Columna "Fojas" agregada al PDF resumen y al parser de movimientos
- Selector de "Departamento Judicial" en formulario de auto-login
- `docs.scba.gov.ar` agregado a host_permissions (necesario para descarga de adjuntos)
- Fix cosmético en generador de PDF: cálculo de ancho de columnas
- Auto-reconexión silenciosa cuando el vault está bloqueado (sin spam de notificaciones)

## [0.3.0] - 2026-04-15

### Mejoras en descarga de expedientes (MEV)

**Descarga ZIP — contenido enriquecido**
- El PDF de cada paso procesal ahora incluye todos los metadatos del proveido: juzgado, datos del expediente (carátula, fecha inicio, receptoría, estado), info del paso procesal (trámite, firmado, fojas), sección REFERENCIAS con adjuntos, sección DATOS DE PRESENTACIÓN, y el texto del proveido con título de sección
- Los adjuntos (VER ADJUNTO) en el PDF del paso son hipervínculos clickables que abren el documento original
- Estructura del ZIP reorganizada: `resumen.pdf` ahora va dentro de la carpeta `_expte_completo`, se eliminó `urls_documentos.txt`
- Nomenclatura de archivos mejorada: `001_fs-29-36_fecha_04-02-2026_DESC.pdf` (incluye fojas y prefijo "fecha")

**Selección de pasos procesales**
- Al hacer click en el botón ZIP se muestra un modal de selección
- El usuario puede elegir qué pasos procesales descargar (por defecto todos seleccionados)
- Botones "Seleccionar todos" y "Deseleccionar todos"

**Confiabilidad en descarga de adjuntos**
- Reintentos con backoff exponencial: hasta 7 intentos para docs.scba.gov.ar, 3 para mev.scba.gov.ar
- Detección de páginas de error HTML servidas en lugar del archivo real
- Validación de tamaño mínimo para evitar guardar respuestas vacías

**Verificación post-descarga**
- Si algún archivo falla, se genera `_verificacion.txt` dentro del ZIP con detalle de cada error
- Se muestra un overlay visual en pantalla con el resumen de fallos
- El botón ZIP cambia a amarillo cuando el ZIP se completó pero con errores

**Simplificación de interfaz**
- Eliminado el botón "📄 PDF" — solo existe "📦 ZIP" que descarga el expediente completo

## [0.2.0] - 2026-04-01

### ProcuAsist ahora es gratuito

- Eliminado sistema de planes pagos (Free/Junior/Senior) — todas las funciones sin limites
- Eliminada integracion con MercadoPago (checkout y webhook)
- Agregado boton "Invitame un cafecito" para donaciones voluntarias
- Agregado disclaimer legal en ajustes y en el onboarding
- Agregado paso de aceptacion de terminos de uso en el onboarding

## [0.1.0] - 2026-03-31

### Primera version

**Infraestructura**
- Scaffolding con WXT 0.20 + React 19 + TypeScript 5.9 + Tailwind CSS v4
- Configuracion de Supabase (Auth, PostgreSQL, RLS)
- Integracion con Google OAuth via Supabase Auth

**Seguridad**
- Encriptacion AES-GCM de credenciales de portales
- Derivacion de clave con PBKDF2 (100,000 iteraciones) desde PIN del usuario
- Vault en memoria que se bloquea al reiniciar el service worker

**Portales judiciales**
- Content script para MEV (Mesa de Entradas Virtual - SCBA)
  - Auto-login, seleccion de departamento, extraccion de causas y movimientos
- Content script para JUSCABA (Poder Judicial de CABA)
  - Auto-login, extraccion de causas

**Gestion de sesion**
- Keep-alive automatico para evitar expiracion de sesion
- Deteccion de sesion expirada via MutationObserver y URL
- Auto-reconexion con navegacion de vuelta a la pagina anterior

**Gestion de causas**
- Marcadores con busqueda, reordenamiento y persistencia local
- Monitoreo de causas con alarmas periodicas
- Alertas de movimientos nuevos con notificaciones push de Chrome
- Generacion de PDF con datos del expediente
- Descarga de adjuntos desde portales
- Importacion masiva desde resultados de busqueda

**Sincronizacion**
- Sync bidireccional (push/pull) de marcadores, monitores, alertas y settings
- Estrategia local-first con chrome.storage.local como fuente de verdad

**UI**
- Side panel como dashboard principal
- Popup con acceso rapido
- Pagina de opciones para configuracion
- Onboarding wizard para nuevos usuarios
- Modo oscuro en toda la extension y paginas de portales
- Iconos personalizados (16px a 128px)
