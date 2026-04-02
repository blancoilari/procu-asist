# Guia de Desarrollo - ProcuAsist

Documentacion tecnica para contribuidores y mantenimiento futuro.

## Arquitectura General

```
Content Scripts (MEV, EJE, SCBA)
        |
        | chrome.runtime.sendMessage()
        v
Background Service Worker
        |
        ├── message-router.ts  (30+ handlers)
        ├── alarm-manager.ts   (alarmas periodicas)
        ├── keep-alive.ts      (pings de sesion)
        ├── auto-reconnect.ts  (re-login automatico)
        └── case-monitor.ts    (escaneo de movimientos)
        |
        ├── chrome.storage.local  (fuente de verdad local)
        └── Supabase (sync remoto)
```

La extension sigue una arquitectura **local-first**: todos los datos se guardan primero en `chrome.storage.local` y luego se sincronizan a Supabase cuando el usuario esta autenticado.

## Sistema de Mensajes (IPC)

Toda la comunicacion entre content scripts, popup, sidepanel y background pasa por `chrome.runtime.sendMessage()`. Los tipos estan definidos en `modules/messages/types.ts`.

### Tipos de Mensaje

| Categoria | Mensajes | Descripcion |
|-----------|----------|-------------|
| **Sesion** | `SESSION_EXPIRED`, `LOGIN_SUCCESS` | Notificaciones de estado de sesion del portal |
| **Causas** | `CASE_PAGE_DETECTED`, `SEARCH_RESULTS`, `PARSE_CASE_HTML` | Datos extraidos por content scripts |
| **PIN/Crypto** | `SETUP_PIN`, `UNLOCK_PIN`, `LOCK`, `GET_LOCK_STATUS` | Gestion del PIN y vault |
| **Credenciales** | `SAVE_CREDENTIALS`, `GET_CREDENTIALS` | Almacenamiento encriptado de credenciales |
| **Marcadores** | `ADD_BOOKMARK`, `REMOVE_BOOKMARK`, `GET_BOOKMARKS`, `IS_BOOKMARKED` | CRUD de marcadores |
| **Monitores** | `ADD_MONITOR`, `REMOVE_MONITOR`, `GET_MONITORS`, `TOGGLE_MONITOR`, `IS_MONITORED` | CRUD de monitores |
| **Alertas** | `GET_ALERTS`, `MARK_ALERT_READ`, `MARK_ALL_ALERTS_READ`, `RUN_SCAN_NOW` | Gestion de notificaciones |
| **Settings** | `UPDATE_SETTINGS`, `GET_SETTINGS` | Preferencias del usuario |
| **Auth** | `SIGN_IN`, `SIGN_OUT`, `GET_USER` | Autenticacion OAuth |
| **Sync** | `SYNC_DATA` | Sincronizacion push/pull con Supabase |
| **UI** | `OPEN_SIDEPANEL`, `GENERATE_PDF`, `DOWNLOAD_ATTACHMENT`, `BULK_IMPORT` | Acciones de UI |

### Como agregar un nuevo mensaje

1. Definir la interface en `modules/messages/types.ts`
2. Agregar el tipo al union type `ProcuAsistMessage`
3. Agregar el handler en `entrypoints/background/message-router.ts`

## Flujo de Encriptacion

```
Usuario ingresa PIN (4-8 digitos)
        |
        v
PBKDF2 (100,000 iteraciones, SHA-256)
        |
        v
CryptoKey AES-GCM (256 bits)
        |
        ├── Se guarda en memoria (variable `currentKey`)
        ├── Se pierde al reiniciar el service worker
        └── Usuario debe re-ingresar PIN al reabrir Chrome
```

### Archivos clave

- `modules/crypto/aes-gcm.ts` — Funciones primitivas: `deriveKey()`, `encrypt()`, `decrypt()`, `generateSalt()`
- `modules/crypto/key-manager.ts` — Lifecycle del CryptoKey: `setupPin()`, `unlock()`, `lock()`, `isUnlocked()`
- `modules/storage/credential-store.ts` — Almacena credenciales de portales encriptadas

### Salt y verificacion

- El salt se genera una vez en `setupPin()` y se guarda en `chrome.storage.local` como `tl_master_salt`
- Para verificar el PIN, se encripta un texto conocido (`procu-asist-pin-ok`) y se guarda como `tl_pin_test`
- En `unlock()`, se intenta desencriptar el test; si falla, el PIN es incorrecto

## Flujo OAuth

```
1. Usuario hace click en "Iniciar sesion con Google"
2. Mensaje SIGN_IN → background
3. Background llama supabase.auth.signInWithOAuth({ provider: 'google' })
4. Se abre chrome.identity.launchWebAuthFlow()
5. Google muestra pantalla de consentimiento
6. Callback retorna token → Supabase valida y crea sesion
7. Se guarda perfil en chrome.storage.local como tl_user
```

## Estructura de Storage

Claves en `chrome.storage.local`:

| Clave | Tipo | Descripcion |
|-------|------|-------------|
| `tl_bookmarks` | `Bookmark[]` | Causas marcadas |
| `tl_monitors` | `Monitor[]` | Causas monitoreadas |
| `tl_alerts` | `MovementAlert[]` | Alertas de movimientos nuevos |
| `tl_settings` | `ProcuAsistSettings` | Preferencias del usuario |
| `tl_user` | `UserProfile` | Perfil del usuario autenticado |
| `tl_master_salt` | `string` (base64) | Salt para derivacion de clave |
| `tl_pin_test` | `string` (base64) | Texto encriptado para verificar PIN |
| `tl_credentials_mev` | `string` (base64) | Credenciales MEV encriptadas |
| `tl_credentials_eje` | `string` (base64) | Credenciales EJE encriptadas |
| `tl_onboarding_done` | `boolean` | Si el usuario completo el onboarding |

## Como agregar soporte para un nuevo portal

1. **Crear selectores** en `modules/portals/nuevo-portal-selectors.ts`
   - URLs del portal
   - Selectores CSS para login, navegacion, datos

2. **Crear parser** en `modules/portals/nuevo-portal-parser.ts`
   - Funciones para extraer datos de causas del HTML
   - `parseMovimientos()`, `parseDatosExpediente()`, etc.

3. **Agregar PortalId** en `modules/portals/types.ts`
   - Agregar el nuevo ID al type `PortalId`

4. **Crear content script** en `entrypoints/nuevo-portal-content.ts`
   - Detectar tipo de pagina (login, busqueda, causa, etc.)
   - Auto-login si hay credenciales
   - Extraer datos y enviar mensajes al background
   - Inyectar boton rocket para side panel

5. **Registrar en wxt.config.ts**
   - Agregar URL a `host_permissions`
   - Agregar a `web_accessible_resources.matches`

6. **Agregar URLs** en `modules/portals/urls.ts`

7. **Actualizar message-router.ts** si se necesitan handlers especificos

## Scripts disponibles

| Script | Comando | Descripcion |
|--------|---------|-------------|
| dev | `npm run dev` | Desarrollo con hot reload |
| build | `npm run build` | Build de produccion |
| zip | `npm run zip` | Generar .zip para distribucion |
| compile | `npm run compile` | Verificar tipos TypeScript (`tsc --noEmit`) |

## Convenciones de codigo

- **TypeScript strict** — Sin `any` implicitos
- **Imports con alias** — `@/modules/...` resuelve a `./modules/...`
- **Prefijo de logs** — `[ProcuAsist]` en todos los console.debug/error
- **Storage keys** — Prefijo `tl_` (por "turbolex", nombre original del proyecto)
- **Mensajes** — PascalCase con underscore: `CASE_PAGE_DETECTED`, `ADD_BOOKMARK`
