# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

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
