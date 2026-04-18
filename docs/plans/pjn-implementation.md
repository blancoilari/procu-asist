# PJN — Sub-plan de implementación

> Release target: **v0.6.0** (posterior a v0.5.0 JUSCABA ZIP)
> Fecha del relevamiento: 2026-04-18
> Autor del relevamiento: Patricio Blanco Ilari + Claude (exploración guiada)
> Destinatario: Claude Code (implementación)

---

## 1. Resumen ejecutivo

PJN es un **ecosistema federado de 7 subsistemas** unificado por **Keycloak SSO** (`sso.pjn.gov.ar`). Para v0.6.0, ProcuAsist solo necesita integrar **dos**:

| Subsistema | Dominio | Tecnología | Uso en ProcuAsist |
|---|---|---|---|
| `pjn-portal` | `portalpjn.pjn.gov.ar` + `api.pjn.gov.ar` | SPA moderna + REST API con JWT | Auto-login, feed de novedades, metadata |
| `pjn-scw` | `scw.pjn.gov.ar/scw` | JBoss Seam + JSF + RichFaces (server-side) | Listado maestro, detalle, documentos, favoritos |

Los otros 5 (`pjn-sne`, `pjn-escritos`, `pjn-deox`, `csjn-iwec`, `pjn-autorizados`) quedan **fuera de scope** para v0.6.0.

**Arquitectura de auth**: un único login contra Keycloak otorga sesión válida para **todos** los subsistemas simultáneamente (cookie + redirects automáticos). No hay que loguear dos veces.

**Arquitectura de datos**: híbrida.
- **API REST moderna** (JSON + JWT Bearer) → feed de novedades del portal nuevo.
- **Scraping de HTML** (JSESSIONID + ViewState JSF) → listado de causas, detalle de expediente, documentos.

---

## 2. Mapa del ecosistema PJN (referencia completa)

Extraído del endpoint `https://api.pjn.gov.ar/apps` (devuelve JSON con todos los subsistemas):

| # | client_id | Nombre oficial | short_name | URL base | Scope v0.6.0 |
|---|---|---|---|---|---|
| 0 | `pjn-portal` | Portal | Portal | `https://portalpjn.pjn.gov.ar/` | ✅ |
| 1 | `pjn-scw` | Sistema de Consultas Web | Consultas | `https://scw.pjn.gov.ar/scw/homePrivado.seam` | ✅ |
| 2 | `pjn-sne` | Sistema de Notificaciones Electrónicas | Notificaciones | `https://notif.pjn.gov.ar/` | ❌ (futuro) |
| 3 | `pjn-escritos` | Sistema de Escritos Web | Escritos | `https://escritos.pjn.gov.ar/` | ❌ (futuro) |
| 4 | `pjn-deox` | Diligenciamiento Electrónico de Oficios | DEOX | `https://deox.pjn.gov.ar/deox` | ❌ (futuro) |
| 5 | `csjn-iwec` | Ingreso Web de Recursos Directos CSJN | IWECS | `https://iwecs.csjn.gov.ar/` | ❌ |
| 6 | `pjn-autorizados` | Sistema de Autorizados | Autorizados | `https://autorizados.pjn.gov.ar/` | ❌ |

> **Nota importante**: `csjn-iwec` vive en dominio `csjn.gov.ar`, no `pjn.gov.ar`. Si en el futuro se cubre, agregar ese dominio a `host_permissions`.

---

## 3. Flujo de autenticación (Keycloak SSO)

### 3.1 Tecnología

**Keycloak OpenID Connect / OAuth2** con Authorization Code Flow. URL del servidor de identidad:

```
https://sso.pjn.gov.ar/auth/realms/pjn/
```

### 3.2 Flujo observado

1. Usuario navega a cualquier subsistema (ej: `portalpjn.pjn.gov.ar`).
2. Subsistema detecta falta de sesión → redirige a:
   ```
   https://sso.pjn.gov.ar/auth/realms/pjn/protocol/openid-connect/auth
     ?client_id={subsistema}         ej: pjn-portal
     &redirect_uri={callback}         ej: https://portalpjn.pjn.gov.ar/auth/callback
     &response_type=code
     &scope=openid
     &state={random}
   ```
3. Usuario completa formulario (campos `username` + `password`; **el username es el CUIT**, no email).
4. Keycloak valida, redirige a `redirect_uri?code=XXX&state=YYY`.
5. Subsistema canjea `code` por JWT access_token (para portal nuevo) **o** por cookie de sesión Seam (para scw).
6. Cookie de Keycloak queda seteada en `.pjn.gov.ar` → próximos subsistemas logran SSO automático (sin pedir credenciales otra vez).

### 3.3 Credenciales

- **Usuario**: CUIT de 11 dígitos (ej: `20301911298`). No es el mail.
- **Contraseña**: alfanumérica provista por el PJN al registrarse.
- Validar formato CUIT localmente (algoritmo de dígito verificador) antes de enviar.

### 3.4 Estrategia de auto-login para ProcuAsist

**Opción recomendada: navegación en tab visible/oculto + rellenar formulario + submit**.

Pasos:

1. Extensión navega a `https://portalpjn.pjn.gov.ar/` (landing protegida → dispara redirect a Keycloak).
2. Detecta que está en `sso.pjn.gov.ar/.../openid-connect/auth`.
3. Obtiene credenciales de storage seguro (`chrome.storage.local` encriptado — ver sección 10).
4. Rellena `<input name="username">` y `<input name="password">`.
5. Dispara submit del form.
6. Espera redirect final a `portalpjn.pjn.gov.ar/inicio`.
7. Sesión establecida para **todos** los subsistemas de `*.pjn.gov.ar`.

**Alternativa descartada**: flujo "API-only" donde la extensión hace POST directo a `/token` con `grant_type=password`. Descartado porque:
- Requiere habilitar Direct Access Grant en el client Keycloak (no controlamos eso).
- Pierde el handshake de cookies que scw necesita.
- Menos "natural" — más probable de romperse si cambian políticas.

---

## 4. Subsistema 1 — Portal nuevo (`api.pjn.gov.ar`)

### 4.1 Tecnología

- Frontend: SPA moderna en `portalpjn.pjn.gov.ar`.
- Backend: REST API en `api.pjn.gov.ar` (subdominio dedicado).
- Auth: `Authorization: Bearer {JWT}` en cada request.
- CORS: habilitado para `portalpjn.pjn.gov.ar` (verificar para extensión).

### 4.2 Endpoints descubiertos

Todos bajo base URL `https://api.pjn.gov.ar/`:

| Método | Path | Propósito | Response |
|---|---|---|---|
| GET | `/token` | Obtener/refrescar JWT | `{access_token, refresh_token, expires_in, ...}` |
| GET | `/info-inicial` | Flags del matriculado | `{verificarEmail, confirmarEmail, appsConfigurables, haySugerencia}` |
| GET | `/apps` | Catálogo de subsistemas | Array de apps (ver tabla sección 2) |
| GET | `/apps-config` | Config de apps (preflight OPTIONS) | — |
| GET | `/eventos/` | **Feed de novedades** (principal) | `{hasNext, numberOfItems, page, pageSize, items[]}` |

### 4.3 Endpoint `/eventos/` (detalle)

**Query params**:
- `page` (int, 0-indexed)
- `pageSize` (int, típicamente 20)
- `categoria` (string: `judicial`)
- `fechaHasta` (Unix timestamp en milisegundos — **cursor-based pagination**)

**Ejemplo**: `GET /eventos/?page=1&pageSize=20&categoria=judicial&fechaHasta=1776443737618`

**Response shape** (simplificado):

```json
{
  "hasNext": true,
  "numberOfItems": 20,
  "page": 0,
  "pageSize": 20,
  "items": [
    {
      "id": 314377760,
      "categoria": "judicial",
      "fechaCreacion": 1776443737618,
      "fechaAccion": 1776443700009,
      "fechaFirma": 1776443700009,
      "tipo": "despacho",
      "hasDocument": true,
      "link": {
        "app": "pjn-scw",
        "url": "/consultaNovedad.seam?identificacion=20301911298&idCamara=4&eid=34803191"
      },
      "payload": {
        "id": 498198961,
        "caratulaExpediente": "...",
        "claveExpediente": "CNE 1002530/2010/1",
        "fechaFirma": 1776443700009,
        "tipoEvento": "despacho"
      }
    }
  ]
}
```

**Campos clave**:
- `tipo`: `despacho` (único valor visto; podría haber otros — validar).
- `link.app`: indica el subsistema destino del deep-link (típicamente `pjn-scw`).
- `link.url`: URL relativa al subsistema destino.
- `payload.claveExpediente`: **identificador único del expediente en formato legible** (`FUERO NÚMERO/AÑO[/SUFIJO]`).
- `payload.caratulaExpediente`: texto largo descriptivo.
- `hasDocument`: flag booleano.

### 4.4 Paginación

**Cursor-based por fecha**, no offset puro:
- Primera página: `page=0` (sin fechaHasta).
- Siguientes: incrementar `page` + pasar `fechaHasta` con el timestamp más viejo de la página anterior.
- Stop cuando `hasNext=false`.

### 4.5 Uso en ProcuAsist

**Opcional para v0.6.0** — el feed de novedades es útil para:
- Badge de "novedades hoy" en el popup de la extensión.
- Integración con la función de "monitoreo" que ya existe para MEV.
- No es necesario para "descargar expediente" (que va 100% por scw).

**Recomendación**: implementar en v0.6.0 solo si no agrega fricción. El core del release es descarga ZIP.

---

## 5. Subsistema 2 — SCW (`scw.pjn.gov.ar`)

### 5.1 Tecnología

- **JBoss Seam 2** + **JSF 2** + **RichFaces 4.3** + **PrimeFaces** + **Bootstrap** + jQuery.
- Server-side rendering: todas las páginas son HTML completo.
- **Charset `ISO-8859-1`** (no UTF-8) — el parser de la extensión debe decodificar con este charset o los acentos se rompen.
- Session: `JSESSIONID` (Tomcat, con jvmRoute para clustering: sufijo `.scw4_2`) + cookies F5 BIG-IP (`TS01xxxxx...`).
- URLs con extensión `.seam`. Recursos estáticos también (`jquery.js.seam`, `theme.css.seam`).
- **Sin API REST interna**. Todo es scraping.
- **Conversation ID (`cid`)**: Seam mantiene conversaciones server-side. Muchas URLs incluyen `?cid=317192`. Hay que respetar esto — GETs directos sin cid pueden redirect a home.

### 5.2 URLs clave

| Propósito | URL |
|---|---|
| Entry point post-SSO | `/scw/homePrivado.seam` |
| Listado Relacionados (LETRADO/PARTE) | `/scw/consultaListaRelacionados.seam` |
| Listado Favoritos | `/scw/consultaListaFavoritos.seam` |
| Listado Radicaciones (no iniciados) | `/scw/consultaListaNoIniciados.seam` |
| Detalle de expediente | `/scw/expediente.seam?cid={cid}` |
| Documentos (ver/descargar) | `/scw/viewer.seam?id={encryptedId}&tipoDoc={tipo}[&download=true]` |
| Logout | `/scw/consultaListaRelacionados.seam?actionMethod=...:identity.logout&cid={cid}` |

### 5.3 Tres vistas de listado (decisión de producto clave)

**Entendido del usuario (Patricio)**:

- **Relacionados** (toggle LETRADO/PARTE): causas donde el CUIT está legalmente vinculado.
  - LETRADO: causas donde figura como abogado.
  - PARTE: causas donde figura como parte (actor, demandado, tercero, etc.).
- **Favoritos**: watchlist manual. **Incluye causas donde NO es parte pero quiere seguir** (juicios de colegas, monitoreo externo). **Esta es la lista "real" para la mayoría de los matriculados en uso diario.**
- **Radicaciones**: causas iniciadas en los últimos 7 días pendientes de sorteo/asignación. Efímero, minoritario.

**Scope v0.6.0**:
- ✅ Relacionados (LETRADO + PARTE).
- ✅ Favoritos — **prioritario**.
- ❌ Radicaciones — documentado pero fuera de scope.

**Selector de modo en UI de ProcuAsist**: al abrir el listado de causas PJN, mostrar tres tabs: "Relacionados (Letrado)", "Relacionados (Parte)", "Favoritos". Default: Favoritos.

### 5.4 Estructura HTML del listado (`consultaListaRelacionados.seam`)

**Columnas de la tabla**:
- Expediente (ej: `CNE 007142/2017`)
- Dependencia (ej: `JUZGADO FEDERAL DE SANTA FE 1 - SECRETARIA ELECTORAL (DISTRITO SANTA FE)`)
- Carátula (texto largo)
- Situación (ej: `EN DESPACHO`, `EN LETRA`)
- Últ. Act. (fecha `DD/MM/YYYY`)
- ⭐ Favorito (en Relacionados) **o** "Quitar" (en Favoritos)

**Acciones por fila**:
- Ícono ojo (ver) → va al detalle del expediente (`expediente.seam?cid=...`).
- ▼ (dropdown) → menú contextual con más opciones (a explorar en implementación).

**Estados conocidos (vocabulario para `pjn-types.ts`)**:
- `EN DESPACHO`, `EN LETRA` (principales).
- Validar otros en implementación.

**Selectores de parsing**:
- Tabla: selector semántico por id estable si existe, o por `<table class="datagrid">` / estructura.
- **NO confiar en `j_idtXXX`** — son IDs dinámicos que pueden cambiar entre sesiones/deploys.
- Filas: `<tbody> <tr>` iterando.
- Columnas: por posición + validación por header cell.

### 5.5 Detalle del expediente (`expediente.seam`)

#### 5.5.1 Bloque superior — Datos Generales

Campos extraíbles (labels + valores):
- Expediente (clave corta): `CIV 038861/2018`
- Jurisdicción: `CÁMARA NACIONAL DE APELACIONES EN LO CIVIL`
- Dependencia: `JUZGADO CIVIL 59 - SECRETARIA Nº 89`
- Situación actual: `EN LETRA`
- Carátula: texto completo.

**Estrella de favorito** visible en esta vista, con texto explícito `(agregar/quitar a mis expedientes)`. Usar como punto principal para el toggle.

**Botones**:
- `Volver a Mi Lista`
- `Presentar escrito` → deep-link a `pjn-escritos` (fuera de scope v0.6.0).

#### 5.5.2 Cuatro tabs (AJAX lazy-load)

| Tab | Contenido | Scope v0.6.0 |
|---|---|---|
| **Actuaciones** | Lista de pasos procesales + documentos | ✅ core |
| **Intervinientes** | Partes, letrados, defensores, terceros | ✅ para PDF resumen |
| **Vinculados** | Expedientes relacionados | ✅ si no vacío |
| **Recursos** | Apelaciones, incidentes, recursos extraordinarios | ✅ solo listado, sin descarga recursiva |

**Carga**: cada tab es AJAX (POST a `expediente.seam` con ViewState). El parser debe simular el click en cada tab y esperar DOM update.

#### 5.5.3 Tab Actuaciones — estructura

**Filtros nativos visibles** (checkboxes):
- `Despachos/Escritos` (default OFF)
- `Notificaciones` (default OFF)
- `información` (default OFF)
- `Ver Todos` (default ON — muestra todo)

\+ botón "Aplicar".

**Columnas de la tabla**:
- Acciones: ícono descargar + ícono ver inline.
- `OFICINA` (ej: `089`).
- `FECHA` (DD/MM/YYYY).
- `TIPO` (ej: `FIRMA DESPACHO`, `ESCRITO AGREGADO`, `MOVIMIENTO`, `EVENTO`, `DEO`).
- `DESCRIPCION / DETALLE` (texto).
- `A FS.` (rango de fojas, ej: `444/445`).

**Tipos de actuación observados** (vocabulario para `pjn-types.ts`):
- `MOVIMIENTO` (sin documento, evento administrativo).
- `FIRMA DESPACHO` (con documento).
- `ESCRITO AGREGADO` (con documento).
- `EVENTO` (sin documento, eventos del sistema).
- `DEO` (Diligenciamiento Electrónico de Oficios — link a `pjn-deox`).
- Otros a validar en implementación.

**Regla**: si la fila tiene botones de descarga/ver → hay documento descargable. Si no tiene → registrar en PDF resumen pero sin descarga.

**Paginación**:
- Barra de páginas numeradas al final: `1 2 3 ... 10` + botón siguiente + botón "ir al final".
- Se ve ~15 filas por página.
- **AJAX postback** — no URLs distintas. Misma URL, mismo ViewState, parámetro de página.

**Botón "Ver históricas"** (CRÍTICO):
- Al abrir el tab por defecto, solo se muestran actuaciones recientes (filtro temporal del portal).
- Actuaciones más antiguas (por fecha, no por cantidad) están ocultas detrás de este botón.
- **Para descargar un expediente completo, el downloader debe clickear "Ver históricas" ANTES de paginar**.

**Sección "Notas"** (al pie, después de la tabla):
- Ejemplo: `El expediente no posee notas` (cuando está vacío).
- Cuando tenga, incluir en el PDF resumen.

#### 5.5.4 Tab Intervinientes — estructura

Tablas agrupadas por tipo. Se confirmó la tabla **PARTES** con columnas:
- `TIPO` (ACTOR, TERCERO, LETRADO APODERADO, LETRADO PATROCINANTE, LETRADO DEFENSOR OFICIAL, DEFENSORA PUBLICA OFICIAL, etc.).
- `NOMBRE`.
- `TOMO/FOLIO` (ej: `Tomo: 138 Folio: 189 - CPACF`).
- `I.E.J.` (Identificación Electrónica Judicial = CUIT).

**Uso en ProcuAsist**:
- PDF resumen: incluir lista completa de intervinientes.
- **Auto-detección de rol del usuario**: si el CUIT del usuario aparece en la columna I.E.J. con tipo `LETRADO APODERADO` → el usuario es letrado en esta causa. Útil para UI/badges.

#### 5.5.5 Tab Vinculados — estructura

- Cuando vacío: `El expediente no posee vinculados posibles de ser visualizados.`
- Cuando tiene data: tabla (estructura a confirmar en implementación, capturar cuando aparezca un caso).
- Incluir lista en PDF resumen.

#### 5.5.6 Tab Recursos — decisión de producto

- Cuando vacío: `El expediente no posee recursos`.
- Cuando tiene data: cada recurso es **un expediente independiente** (propio número, propia carátula, propias actuaciones).

**Decisión v0.6.0**:
- ✅ Listar los recursos en el PDF resumen del expediente principal (con número y carátula).
- ❌ NO descargarlos recursivamente en el ZIP (evitar explosión combinatoria).
- El usuario puede navegar al recurso y descargarlo como expediente separado.
- **Roadmap v0.7.0+**: opción "incluir recursos" con checkbox y límite de profundidad.

### 5.6 Documentos (`viewer.seam`)

**Endpoint unificado**:

```
https://scw.pjn.gov.ar/scw/viewer.seam
  ?id={ENCRYPTED_ID}        # blob base64, ej: K1Gc/9omASPBoGq+BgGEpF0U1wV+Be6w6as3UWURO2bklo=
  &tipoDoc={TIPO}            # despacho | escrito | notificacion | oficio | cedula | ...
  [&download=true]           # fuerza Content-Disposition: attachment
  [&default]                 # Content-Disposition: inline
```

**Observaciones**:
- El `id` es **un blob encriptado**, no un ID enumerable. Esto es por seguridad.
- **ProcuAsist NO puede generar URLs de documento** desde un ID numérico. La única forma es **parsear los `href` de los botones en la página `expediente.seam`**.
- Al GET con `download=true` → response tiene `Content-Disposition: attachment; filename=docXXXXXXX.pdf`.
- Al GET con `default` (o sin flag) → `inline`, el browser intenta renderizar.
- Para el downloader de la extensión: usar `fetch()` con la URL, ignorar el disposition, tomar el body como Blob.

**Selectores**:
- Descarga: `a.btn:has(i.fa-download)`.
- Ver: `a.btn:has(i.fa-eye)`.
- Usar clases de FontAwesome como ancla semántica (son estables), no los IDs JSF.

### 5.7 Toggle de favorito (sincronización bidireccional)

**Decisión de producto**: **sincronizar bidireccionalmente**. Marcar en ProcuAsist = marcar estrella en PJN. Quitar en PJN = quitar en ProcuAsist.

**Endpoint**:
- `POST https://scw.pjn.gov.ar/scw/expediente.seam` (mismo URL que la página, tradicional JSF postback).
- Content-Type: `application/x-www-form-urlencoded`.
- Es un **toggle puro** — no hay `action=add` vs `action=remove`. El servidor lee el estado actual y lo invierte.

**Payload capturado** (estructura, no valores — los IDs son dinámicos):

```
expediente: expediente
expediente:{j_idtXX}:{j_idtYY}: expediente:{j_idtXX}:{j_idtYY}
javax.faces.ViewState: {VIEWSTATE_TOKEN}              ← crítico, server-generated
expediente:{j_idtXX}:{j_idtZZ}_collapsed: false
expediente:expedienteTab-value: actuaciones
expediente:checkBoxOtrasActuacionesId: on
javax.faces.source: expediente:{j_idtXX}:{j_idtYY}:favorito:outputLink
javax.faces.partial.event: click
javax.faces.partial.execute: expediente:{...}:favorito:outputLink expediente:{...}:favorito:outputLink
javax.faces.partial.render: expediente:{...}:favorito:outputLink
javax.faces.behavior.event: action
AJAX:EVENTS_COUNT: 1
rfExt: null
javax.faces.partial.ajax: true
```

**Estrategia de implementación** (recomendada):

**NO reconstruir el payload a mano** (frágil). En su lugar:

1. Mantener la página `expediente.seam` de la causa cargada en tab/iframe/fetch+DOM.
2. Encontrar el link de la estrella con selector semántico (`a[id$=":favorito:outputLink"]` o por clase/estructura).
3. Leer el estado actual desde el DOM (clase CSS de la estrella: amarilla = favorito, gris = no).
4. Si estado_actual ≠ estado_deseado → ejecutar `.click()` programático.
5. JSF dispara el POST solo con el ViewState y los IDs correctos.

**Ventaja**: la extensión no necesita saber nada sobre internals de JSF.

**Modelo de datos en storage**:

```typescript
interface BookmarkPjn {
  portal: 'pjn';
  claveExpediente: string;    // ej: "CIV 038861/2018"
  caratula: string;
  dependencia: string;
  addedAt: number;
  syncedAt: number;            // timestamp de última reconciliación con PJN
  // metadata local (no sincroniza)
  labels?: string[];
  notes?: string;
}
```

**Algoritmo de sincronización (lazy on-read)**:

1. Cuando la extensión muestra listado de causas PJN:
   a. Fetch `consultaListaFavoritos.seam` → parsear lista actual.
   b. Compara con storage local.
   c. Reconcilia: PJN es la fuente de verdad del **estado de la estrella**; storage local puede tener metadata extra (labels, notes) que se preserva.
2. Cuando el usuario marca/desmarca desde la UI de ProcuAsist:
   a. Update optimista en storage local.
   b. Dispara toggle en PJN.
   c. Si falla → rollback del storage + notificación al usuario.

---

## 6. Filtros nativos en la UI de descarga ZIP

**Doble capa de filtros**:

### Capa 1 — Categorías nativas de PJN
Checkboxes con los filtros que expone el portal:
- [ ] Despachos/Escritos (default ON)
- [ ] Notificaciones (default OFF)
- [ ] Información (default OFF)
- [x] Ver Todos (atajo que marca las tres)

### Capa 2 — Selector fino de pasos procesales
Similar a MEV: lista de pasos individuales filtrados por la capa 1. Cada uno con checkbox para de/seleccionar.

**Ejecución**:
- **Client-side**. El downloader trae todas las actuaciones del expediente (con "Ver históricas" + paginación completa).
- Aplica filtros de capa 1 → lista filtrada.
- Usuario elige en capa 2 → selección final.
- ZIP incluye solo lo seleccionado + PDF resumen siempre completo.

**Justificación de client-side**: evita postbacks JSF adicionales (frágil, lento, y "Aplicar" del portal podría confundir a ProcuAsist).

---

## 7. Estructura de archivos a crear en ProcuAsist

Siguiendo el patrón establecido MEV/JUSCABA:

```
src/
├── modules/
│   └── portals/
│       └── pjn/
│           ├── pjn-api-client.ts              # cliente REST para api.pjn.gov.ar
│           ├── pjn-scw-client.ts              # cliente HTTP para scw (maneja cookies + ViewState)
│           ├── pjn-parser.ts                  # parsers HTML para scw
│           ├── pjn-selectors.ts               # selectores CSS/xpath centralizados
│           ├── pjn-types.ts                   # tipos TypeScript
│           ├── pjn-case-downloader.ts         # orquestador de descarga ZIP
│           ├── pjn-favorites-sync.ts          # sincronización bidireccional de favoritos
│           ├── pjn-auth.ts                    # auto-login contra Keycloak
│           └── pjn-encoding.ts                # utilidades ISO-8859-1
├── entrypoints/
│   ├── pjn-portal.content.ts                  # content script para portalpjn.pjn.gov.ar
│   └── pjn-scw.content.ts                     # content script para scw.pjn.gov.ar
└── modules/
    └── pdf/
        └── case-pdf-generator.ts              # reutilizado (solo agregar formatter PJN)
```

**Reutilizable de MEV/JUSCABA**:
- `modules/pdf/case-pdf-generator.ts` — extender con renderer de `PjnCaseData`.
- Lógica de armado de ZIP (JSZip).
- UI del selector de pasos procesales — extender con capa 1 (categorías PJN).
- Keep-alive + auto-reconexión — mismo patrón.
- Sistema de marcadores — extender modelo con `portal: 'pjn'`.

---

## 8. Permisos y configuración del manifest

**`host_permissions` a agregar en `wxt.config.ts`**:

```json
[
  "*://sso.pjn.gov.ar/*",
  "*://portalpjn.pjn.gov.ar/*",
  "*://api.pjn.gov.ar/*",
  "*://scw.pjn.gov.ar/*"
]
```

**Opcionales / futuros**:
```json
[
  "*://pjn.gov.ar/*",            // landing pública, solo si inyectamos botones
  "*://notif.pjn.gov.ar/*",       // pjn-sne (roadmap)
  "*://escritos.pjn.gov.ar/*",    // pjn-escritos (roadmap)
  "*://deox.pjn.gov.ar/*"         // pjn-deox (roadmap)
]
```

**Content scripts matches**:
- `https://portalpjn.pjn.gov.ar/*` → para inyectar badge de novedades, botón de listado, integración con feed.
- `https://scw.pjn.gov.ar/scw/*` → para inyectar botón "Descargar ZIP" en detalle de expediente + "Descargar todos" en listados.

**Permisos**:
- `storage` (ya existe).
- `downloads` (ya existe).
- `alarms` (para keep-alive; ya existe).
- `cookies` — evaluar si es necesario para leer/escribir JSESSIONID directamente (probablemente no, las cookies se mandan automáticamente en requests del mismo origin).

---

## 9. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cambios en los `j_idtXXX` dinámicos de JSF rompen el parser | Alta | Alto | Usar selectores semánticos (clases, estructura, texto); evitar IDs generados |
| ViewState expira durante operación larga | Media | Alto | Detectar 200 con HTML de error + re-load de la página para obtener nuevo ViewState |
| Charset ISO-8859-1 genera mojibakes | Alta | Medio | Decodificar explícitamente con `TextDecoder('iso-8859-1')` al leer responses HTML |
| `cid` de Seam invalidado entre requests | Media | Medio | Siempre navegar "en orden" (listado → detalle); nunca hacer GET directo a `expediente.seam` sin cid válido |
| Paginación con AJAX postback es frágil | Media | Alto | Implementar con tab en background que cargue el HTML real + dispare clicks; tener fallback de "descarga parcial" si falla |
| Clickear "Ver históricas" falla en causas muy antiguas | Baja | Medio | Detectar via presencia del botón; si no aparece, asumir que ya está todo visible |
| Cambio de política Keycloak obliga a MFA/captcha | Baja | Crítico | Documentar camino de login; degradar gracefully a "loguearse manualmente"; mostrar alerta |
| Rate limiting del portal si descarga muchos docs en ráfaga | Media | Medio | Reutilizar estrategia MEV: N descargas paralelas + backoff exponencial + reintentos |
| Documento encriptado_id cambia entre cargas de la misma causa | Baja | Alto | Parsear y descargar dentro del mismo session-load; no cachear URLs de documento por tiempo largo |
| Usuario tiene causas en CSJN (`iwec`) que aparecen mezcladas | Baja | Bajo | Documentar como fuera de scope; filtrar por dominio si aparecen |

---

## 10. Preguntas abiertas (a validar en implementación)

1. **¿El endpoint `/eventos/` devuelve tipos distintos a `despacho`?** (notificaciones, escritos, cédulas). Confirmar con cuenta que tenga más variedad.
2. **¿Hay parámetro `pageSize=999` en actuaciones del expediente?** Ahorraría N round-trips. Probar en implementación.
3. **¿Qué pasa al clickear "Ver históricas"?** ¿Un solo postback? ¿Paginación también dentro de históricas?
4. **¿El dropdown ▼ de cada fila del listado expone acciones útiles?** (copiar, descargar directo, etc.) — inspeccionar en implementación.
5. **Estructura del tab "Vinculados" cuando tiene data real** — capturar con un caso que tenga vinculados.
6. **Estructura del tab "Recursos" cuando tiene data real** — ídem.
7. **Tipos de `tipoDoc` posibles en `viewer.seam`** — completar enum.
8. **Formato de "Notas"** — capturar cuando el expediente tenga notas.
9. **¿Hay CSRF token adicional en forms de Seam?** Aparte del ViewState — revisar forms de logout, escrito, etc.
10. **¿El CUIT puede tener varios "roles" simultáneos?** (ej: matriculado + representante legal). Ver si cambia la vista.
11. **¿La cookie de Keycloak en `.pjn.gov.ar` funciona también para `csjn.gov.ar`?** (dominios separados — probablemente NO, pero validar).
12. **Comportamiento del toggle de favorito desde listado Relacionados (estrella gris) vs desde detalle**: ¿mismo endpoint, mismo payload, o distinto?

---

## 11. Checklist end-to-end de verificación

### Auto-login
- [ ] La extensión detecta que el usuario no tiene sesión y dispara el flujo.
- [ ] Credenciales se leen del storage encriptado.
- [ ] Validación de CUIT (algoritmo dígito verificador) antes de enviar.
- [ ] Login exitoso deja sesión válida para `portalpjn.pjn.gov.ar`.
- [ ] **Sin segundo login**, navegar a `scw.pjn.gov.ar/scw/homePrivado.seam` funciona.
- [ ] Manejo de credenciales inválidas (mostrar error claro).
- [ ] Manejo de captcha/MFA (degradar a login manual con alerta).

### Listado de causas
- [ ] Cargar Relacionados-LETRADO muestra todas las causas.
- [ ] Cargar Relacionados-PARTE muestra todas las causas.
- [ ] Cargar Favoritos muestra la lista correcta.
- [ ] Columnas parseadas correctamente (Expediente, Dependencia, Carátula, Situación, Últ.Act., Favorito).
- [ ] Acentos y ñ se ven correctos (charset ISO-8859-1 manejado).
- [ ] Listados con 100+ causas funcionan (paginación si aplica).

### Detalle de expediente
- [ ] Navegación desde listado preserva `cid` correctamente.
- [ ] Datos Generales parseados (6 campos).
- [ ] Tab Actuaciones carga.
- [ ] Tab Intervinientes carga y se parsea tabla PARTES.
- [ ] Tab Vinculados carga (estado vacío y con data).
- [ ] Tab Recursos carga (listado).
- [ ] Auto-detección de rol del usuario vía I.E.J.

### Descarga ZIP
- [ ] Click en "Ver históricas" funciona y expande la lista.
- [ ] Paginación completa todas las actuaciones en memoria.
- [ ] UI de filtros de dos capas (categorías + selector fino) funciona.
- [ ] Descarga de PDFs individuales via `viewer.seam`.
- [ ] Reintentos para descargas fallidas (reutilizar lógica MEV).
- [ ] PDF resumen incluye: Datos Generales, lista de actuaciones, Intervinientes, Vinculados, Recursos, Notas.
- [ ] ZIP tiene estructura consistente: `resumen.pdf` + `actuaciones/{fecha}-{tipo}.pdf` + `marcadores.json`.
- [ ] Zip de causa con 100+ actuaciones completa sin timeout.

### Marcadores (sincronización)
- [ ] Leer favoritos de PJN al abrir listado.
- [ ] Marcar una causa en ProcuAsist → estrella aparece en PJN tras refresh.
- [ ] Quitar estrella en PJN → la causa desaparece de favoritos de ProcuAsist en próxima sync.
- [ ] Metadata local (labels, notes) se preserva entre sincs.
- [ ] Rollback si falla la escritura en PJN.

### Monitoreo / keep-alive
- [ ] Keep-alive mantiene sesión scw viva durante descarga larga (60+ minutos).
- [ ] Auto-reconexión si sesión expira.
- [ ] Detección de expiry de Keycloak (distinto de JSESSIONID).

### General
- [ ] No crashea con causas con caracteres especiales (ñ, acentos, símbolos).
- [ ] No crashea si un tab del expediente está vacío.
- [ ] Modo "descargar múltiples causas" funciona con selección múltiple.
- [ ] Funciona en modo incógnito si el usuario se loguea manualmente.

---

## 12. Release plan

- **v0.5.0** (actual): JUSCABA ZIP download.
- **v0.6.0** (este plan): PJN completo — auto-login, listado, detalle, ZIP, favoritos sincronizados.
- **v0.7.0** (tentativo): PJN roadmap — notificaciones (`pjn-sne`), presentación de escritos (`pjn-escritos`), descarga con recursos.

### Sugerencia de milestones internos para v0.6.0

1. **M1 — Auth**: auto-login contra Keycloak funcional. Solo eso. Verificable con test E2E.
2. **M2 — API cliente**: wrapper para `api.pjn.gov.ar` con refresh automático de JWT. Feed de novedades.
3. **M3 — SCW parser**: listado Relacionados + Favoritos parseados correctamente. Sin descarga todavía.
4. **M4 — Detalle**: parsing de los 4 tabs. Sin descarga.
5. **M5 — Documentos**: descarga individual de PDFs via `viewer.seam`.
6. **M6 — ZIP completo**: orquestador + paginación + "Ver históricas" + filtros + PDF resumen.
7. **M7 — Favoritos sync**: toggle bidireccional.
8. **M8 — Integración UI**: botones inyectados, popup, settings.
9. **M9 — Testing con cuentas reales**: batería de casos reales con variedad de fueros.
10. **M10 — Release**: Chrome Web Store submission.

---

## 13. Aprendizajes para futuros portales

Para cualquier nuevo portal judicial que se agregue a ProcuAsist, aplicar este checklist de relevamiento inicial (validado con MEV, JUSCABA y PJN):

1. **Detectar arquitectura**: ¿SPA moderna con API REST? ¿Server-side rendering tradicional? ¿Híbrido? → Mirar DevTools Network / XHR al navegar el portal.
2. **Identificar provider de auth**: ¿Keycloak? ¿Formulario propio? ¿SAML? ¿Certificado digital? → Mirar URL de login.
3. **Mapear el ecosistema completo**: ¿Hay subsistemas federados? ¿Dominios múltiples? → Buscar endpoints tipo `/apps`, `/catalog`, o menús de navegación.
4. **Charset y encoding**: HTML antiguo suele ser ISO-8859-1. Confirmar con header `Content-Type` o `<meta charset>`.
5. **Estado del usuario**: cómo el portal identifica al usuario (CUIT, email, matrícula). Cómo diferencia roles (letrado, parte, juez, etc.).
6. **Tres vistas mínimas a mapear**: listado de causas relacionadas, favoritos/watchlist, detalle de una causa.
7. **URL de documentos**: ¿son enumerables o encriptadas? → Define si ProcuAsist puede generar URLs o debe parsearlas.
8. **Filtros y paginación**: ver si hay filtros nativos útiles para replicar + cómo pagina (URL vs AJAX).
9. **Casos límite**: causas muy antiguas, con muchos documentos, con recursos/incidentes, con partes múltiples.
10. **Marcadores nativos**: ¿el portal tiene sistema de favoritos? Si sí, decidir estrategia de sincronización.

---

**Fin del documento.**
