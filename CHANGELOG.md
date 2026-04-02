# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

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
- Content script para EJE (Poder Judicial de CABA - JUSCABA)
  - Auto-login, extraccion de causas
- Content script para SCBA Notificaciones
  - Importacion de notificaciones

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
