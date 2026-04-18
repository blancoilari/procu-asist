# Plan de implementación — Descarga completa de expediente JUSCABA en ZIP

**Release target:** ProcuAsist v0.5.0
**Estado al momento de redactar:** JUSCABA cubre auto-login y marcadores. Falta la descarga del expediente como ZIP, análoga a la que ya funciona en MEV.
**Autor del relevamiento:** exploración conjunta con capturas de causa real propia (CUIJ `J-01-00199522-3/2021-1`, 53 actuaciones).

**Actualizaciones post-relevamiento (2026-04-18):**
- §8.1 (lookup `identificador → expId`) RESUELTO: endpoint `POST /iol-api/api/expedientes/lista` con payload confirmado. Ver §3.3.0.
- Corrección de URL base: `/iol-api/api/` (tiene un segmento `/api/` intermedio que no estaba en el doc original).
- Hallazgo: endpoint `encabezado?expId=...` entrega en una sola llamada los datos que originalmente se pensaban pedir en 3 (`ficha` + `fuero` + `tieneSentencia`). Ver §3.3.1.

---

## 1. Contexto y objetivo

Replicar en JUSCABA la funcionalidad de descarga de expediente completo en ZIP que ya funciona en MEV, manteniendo la identidad visual del output (estructura de carpetas, PDF resumen con marcadores, adjuntos separados con su nombre original) y reutilizando al máximo los módulos compartidos:

- `modules/pdf/case-pdf-generator.ts` (generador del PDF resumen).
- Lógica de armado de ZIP.
- Selector de pasos procesales en UI.

**Alcance de v0.5.0:** descarga de una causa a la vez, desde la vista de detalle single (pestaña nueva vía `/iol-ui/u/expedientes?...`). Fuera de alcance: descarga masiva de múltiples causas; soporte a la vista embebida dentro del listado `/iol-ui/u/causas`.

---

## 2. Hallazgo clave — JUSCABA expone una API REST interna

A diferencia de MEV, en JUSCABA **no hace falta scrapear el DOM**. El portal es una SPA (Angular, muy probablemente) que consume una API REST pública bajo `/iol-api/`. Las llamadas se hacen desde el navegador del usuario autenticado reutilizando las cookies de sesión.

**Implicancia arquitectónica central:** el módulo análogo a `mev-parser.ts` no va a ser un parser de DOM, sino un **cliente HTTP** tipado contra la API interna. Esto es más robusto, más rápido y menos frágil ante cambios de UI.

El content script queda mínimo: sólo inyecta el botón de "Descargar ZIP" en la vista de expediente y dispara el cliente API.

---

## 3. Estructura del portal observada

### 3.1 URLs relevantes

| Vista | URL | Uso en ProcuAsist |
|---|---|---|
| Inicio consulta pública | `https://eje.juscaba.gob.ar/iol-ui/u/inicio` | — |
| Listado "Mis Causas" | `https://eje.juscaba.gob.ar/iol-ui/u/causas?causas=1&tipoBusqueda=CAU&tituloBusqueda=Mis%20Causas` | No inyectar UI de descarga acá. |
| **Detalle single de expediente** | `https://eje.juscaba.gob.ar/iol-ui/u/expedientes?identificador={CUIJ}&tipoBusqueda=CAU&open=true&tituloBusqueda=Causas&cuij={cuij}&anio={anio}&desmontar=true` | **Sí: inyectar botón "Descargar ZIP" acá.** |
| Base API | `https://eje.juscaba.gob.ar/iol-api/api/` | Target de todas las llamadas `fetch()`. |

**Detalle embebido dentro del listado:** al hacer clic en la carátula de una causa en `/iol-ui/u/causas`, se expande un panel con las mismas pestañas del detalle single sin cambiar la URL. En v0.5.0 **ignoramos este modo**; el botón de descarga sólo aparece en la vista dedicada (abierta con el ícono de "Abrir en nueva pestaña" que ya existe en el portal).

### 3.2 Identificadores

| Nombre | Ejemplo | Origen | Notas |
|---|---|---|---|
| `identificador` / CUIJ público | `J-01-00199522-3/2021-1` | Query string de la URL del expediente | Público, visible al usuario. |
| `cuij` (corto) | `01-00199522-3` | Query string | Variante del CUIJ sin prefijo fuero ni año. |
| `anio` | `2021` | Query string | |
| `expId` | `3090965` | **Interno**, no aparece en la URL | Necesario para casi todos los endpoints de la API. **Obtenerlo es el primer paso del flujo.** Ver §8.1. |
| `actId` | `53180303` | Interno por actuación | Se devuelve en el listado de actuaciones. |
| `aacId` | `9091736` | Interno por adjunto | Se devuelve en el listado de adjuntos de una actuación. |

### 3.3 Endpoints descubiertos

Casi todos son `GET`, responden `application/json`, y reutilizan las cookies de sesión del usuario (no requieren Authorization explícito en el cliente si ya está logueado). La única excepción es `/lista`, que es `POST` y se usa para el lookup inicial `identificador → expId`.

#### 3.3.0 Lookup `identificador → expId` ✅ CONFIRMADO EN RELEVAMIENTO

```
POST /iol-api/api/expedientes/lista
Content-Type: application/x-www-form-urlencoded  (form data)
Body: info=<JSON string>
```

Donde `info` (URL-decoded) es un JSON con esta forma:

```json
{
  "filter": "{\"identificador\":\"J-01-00139905-1/2021-2\",\"cuij\":\"01-00139905-1\",\"anio\":\"2021\"}",
  "tipoBusqueda": "CAU",
  "page": 0,
  "size": 10
}
```

**Ojo:** `filter` es un **string que contiene JSON anidado serializado**, no un objeto. Es como lo envía el portal, hay que respetarlo tal cual. El JSON anidado tiene `identificador`, `cuij` y `anio` (todos como strings).

Los 4 valores de entrada (`identificador`, `cuij`, `anio`, `tipoBusqueda`) se leen directamente de la query string de la URL actual del expediente (`/iol-ui/u/expedientes?identificador=...&cuij=...&anio=...&tipoBusqueda=...`).

**Response** (formato Page<T> de Spring):

```json
{
  "totalElements": 1,
  "totalPages": 1,
  "content": [
    { "expId": 3317100, "fechaFavorito": null }
  ],
  "first": true,
  "last": true,
  "number": 0,
  "numberOfElements": 1,
  "pageable": { "pageNumber": 0, "pageSize": 10, "offset": 0, "sort": {...} },
  "size": 10,
  "sort": {...}
}
```

El `expId` se lee de `response.content[0].expId`. Este es el primer paso obligatorio del flujo de descarga.

#### 3.3.1 Cabecera del expediente

```
GET /iol-api/api/expedientes/encabezado?expId={expId}
```

**Hallazgo adicional en relevamiento:** el endpoint `encabezado` devuelve en una sola llamada todos los datos necesarios para el PDF resumen, evitando las 3 llamadas separadas (`ficha` + `fuero` + `tieneSentencia`) que se habían planteado originalmente.

**Response observado:**

```json
{
  "tipoExpediente": "INC",
  "cuij": "J-01-00139905-1/2021-2",
  "numero": 139905,
  "anio": 2021,
  "sufijo": 2,
  "caratula": "METROVIAS sa s/ QUEJA POR RECURSO DE INCONSTITUCIONALIDAD DENEGADO...",
  "esPrivado": 0,
  "estadoAdministrativo": "EN LETRA",
  "favorito": false,
  "fechaInicio": 1757946932211,
  "fuero": "CONTENCIOSO ADMINISTRATIVO Y TRIBUTARIO",
  "nivelAcceso": null,
  "ubicacion_organismo": "RC - CAMARA DE APELACIONES EN LO CATYRC - SALA 2"
}
```

**Endpoints alternativos (observados pero probablemente redundantes tras el hallazgo anterior):**

```
GET /iol-api/api/expedientes/ficha?expId={expId}
GET /iol-api/api/expedientes/fuero?expId={expId}&accesoMinisterios=false
GET /iol-api/api/expedientes/tieneSentencia?expId={expId}
```

Probar en implementación si `encabezado` alcanza. Si se detectan campos faltantes (p. ej. "Objeto de Juicio", "Monto", "Etiquetas", flag de sentencia), complementar con estos.

#### 3.3.2 Listado de actuaciones (paginado)

```
GET /iol-api/api/expedientes/actuaciones?filtro={JSON_URL_ENCODED}
```

El parámetro `filtro` es un JSON URL-encoded con los tipos de actuación a incluir (`despachos`, `escritos`, `cedulas`, `notas`) y el `expId`. Ejemplo decoded esperado (a confirmar en F1 de implementación):

```json
{
  "expId": 3090965,
  "despachos": true,
  "escritos": true,
  "cedulas": true,
  "notas": true,
  "page": 0,
  "size": 50
}
```

**Response** — formato `Page<T>` de Spring, confirmado en capturas:

```json
{
  "content": [
    {
      "esCedula": 0,
      "codigo": "ESCRIT",
      "numero": 2647183,
      "fechaFirma": 1767032849927,
      "firmantes": "RUA,CLAUDIA TRINIDAD MARIA MARTA",
      "actId": 53180303,
      "...": "..."
    }
  ],
  "pageable": { "pageNumber": 0, "pageSize": 50, "offset": 0, "sort": {} },
  "first": true,
  "last": false,
  "number": 0,
  "numberOfElements": 50,
  "size": 50,
  "totalElements": 53,
  "totalPages": 2,
  "sort": {}
}
```

**Notas críticas:**
- `fechaFirma` es un timestamp Unix en milisegundos.
- `codigo` es el prefijo taxonómico de la actuación (`PS60`, `ME69`, `ME76`, `ESCRIT`, `JUETRA`, `DEM`, `SAC1`, `CEDELE`, etc.). Usar para nombrar carpetas en el ZIP.
- `esCedula` parece ser `0/1`. Confirmar en implementación.
- `totalPages` puede ser > 1. **Paginar hasta agotar.**

#### 3.3.3 Adjuntos de una actuación

```
GET /iol-api/api/expedientes/actuaciones/adjuntos?actId={actId}&expId={expId}&accesoMinisterios=false
```

Devuelve la lista de archivos adjuntos de una actuación. En UI se observó que abre un modal con columnas "Nombre" y "Fecha" cuando hay múltiples, p. ej.:

```
2501655 metrovias c ente 199522.pdf   28/02/2025 10:28:25
mail contestacion bco 199522.pdf       28/02/2025 10:28:25
```

**Response esperado** (a confirmar): array con objetos que incluyan `aacId`, `nombre`, `fecha`, y posiblemente `mimeType`, `tamaño`.

**Importante:** cuando una actuación tiene 0 adjuntos, el ícono de clip no aparece en la UI. El listado de actuaciones (§3.3.2) probablemente trae un flag `tieneAdjuntos` o `cantidadAdjuntos` — a confirmar; si existe, usarlo para evitar llamadas innecesarias al endpoint de adjuntos.

#### 3.3.4 Descarga de adjunto individual

```
GET /iol-api/api/expedientes/actuaciones/adjuntoPdf?filter={JSON_URL_ENCODED}
```

`filter` decoded:

```json
{
  "aacId": 9091736,
  "expId": 3090965,
  "actId": 53180303,
  "ministerios": false,
  "esCedula": false
}
```

**⚠️ Punto a validar en implementación:** el response llega con `Content-Type: application/json`, no `application/pdf`. Esto sugiere que el PDF viene embebido (probablemente base64 dentro de un JSON wrapper tipo `{ contenido: "JVBERi0...", nombre: "..." }`) en lugar de binario crudo. Confirmar al implementar y decodificar según corresponda. Ver §9 (riesgo R3).

#### 3.3.5 Descarga de PDF consolidado de una actuación

```
GET /iol-api/api/expedientes/actuaciones/pdf?datos={JSON_URL_ENCODED}
```

`datos` decoded:

```json
{
  "actId": 53180303,
  "expId": 3090965,
  "cedulaIndexada": false,
  "ministerios": false
}
```

Devuelve el PDF completo de la actuación (texto del despacho/escrito + todos los adjuntos concatenados). Es lo que se descarga cuando el usuario hace clic en el **título** de la actuación. Tamaño observado: ~1 MB para una actuación mediana, hasta 16 MB para una demanda con poder notarial anexo de 150 páginas.

**Decisión de diseño:** el ZIP va a incluir **ambos**: el PDF consolidado por actuación (útil para lectura lineal) **y** los adjuntos individuales por separado (útiles para referenciar un anexo puntual sin tener que abrir un PDF gigante). Ver §7.

#### 3.3.6 Endpoints auxiliares (probablemente no necesarios para v0.5.0)

```
GET /iol-api/api/expedientes/visibilidad?filtro=...
GET /iol-api/api/expedientes/cantidadNovedades
GET /iol-api/api/expedientes/idEstadoActuacion?estado=...
```

Vistos en las capturas pero no requeridos para armar el ZIP. Ignorables salvo que en implementación se descubra lo contrario.

---

## 4. Cambio de paradigma vs MEV

| Aspecto | MEV | JUSCABA |
|---|---|---|
| Detección de vista | URL cambia entre listado y expediente | SPA: URL única en algunos flujos; usar URL de vista dedicada `/iol-ui/u/expedientes` |
| Extracción de datos | Scraping de DOM con selectores CSS | Cliente REST contra `/iol-api/` |
| Listado de actuaciones | Parseo de tabla HTML | `GET /actuaciones` con paginación Spring |
| Descarga de adjuntos | URLs directas a PDFs | `adjuntoPdf` con JSON embebido (probable base64) |
| Identificador primario | CUIJ visible | `expId` interno, **no está en la URL** |
| Resiliencia a cambios de UI | Frágil (selectores) | Robusta (contratos de API) |
| Keep-alive / auto-reconexión | Ya resuelto en MEV | Reutilizar el mismo patrón |

---

## 5. Arquitectura propuesta

### 5.1 Archivos a crear

```
modules/portals/juscaba/
├── juscaba-api-client.ts          # Cliente HTTP tipado contra /iol-api/
├── juscaba-types.ts                # Tipos TS: Ficha, Actuacion, Adjunto, ApiPage<T>, etc.
├── juscaba-case-downloader.ts      # Orquestador: ficha → actuaciones → adjuntos → ZIP
├── juscaba-selectors.ts            # Selectores mínimos para inyectar UI
├── juscaba-url-matcher.ts          # Detecta si la URL actual es vista de expediente single
└── juscaba-mapper.ts               # Normaliza Actuacion JUSCABA → CaseStep genérico (compat case-pdf-generator)
```

### 5.2 Archivos a modificar

```
entrypoints/juscaba.content.ts                 # Inyectar botón en la vista /iol-ui/u/expedientes
wxt.config.ts (o equivalente)                  # Registrar match pattern para content script
manifest (permissions / host_permissions)      # Agregar https://eje.juscaba.gob.ar/iol-api/*
```

### 5.3 Reutilización desde MEV (sin modificar)

- `modules/pdf/case-pdf-generator.ts` — se consume vía `juscaba-mapper.ts` que normaliza a la interfaz común.
- Módulo de armado de ZIP (el que MEV ya usa — JSZip o similar).
- UI del botón / progreso / selector de pasos — si está desacoplada del portal, reutilizable 1:1.

### 5.4 Punto de integración con el selector de pasos procesales

Si el selector de MEV recibe una lista genérica de "pasos", `juscaba-mapper.ts` debe exportar `mapActuacionToCaseStep(a: Actuacion): CaseStep`. Confirmar la interfaz `CaseStep` al inicio de la implementación y ajustar el mapper para respetarla. Si hay campos JUSCABA-específicos útiles (`firmantes`, `fechaDiligenciamiento`), exponerlos en una propiedad opcional `portalMetadata` para no romper la interfaz.

---

## 6. Flujo de descarga end-to-end

```
1. Usuario en https://eje.juscaba.gob.ar/iol-ui/u/expedientes?identificador=...
   └─ Content script detecta la vista y renderiza botón "Descargar ZIP".

2. Clic en botón:
   a. Resolver expId a partir del identificador de la URL.
      → Ver §8.1 (dos estrategias candidatas; preferir 'A' si es viable).
   b. Obtener ficha, fuero, tieneSentencia (en paralelo).
   c. Listar actuaciones: llamar /actuaciones con page=0, size=50.
      └─ Si totalPages > 1, paginar secuencialmente (page=1, page=2, ...).
      └─ Consolidar en un array Actuacion[].

3. Para cada actuación:
   a. Si tiene adjuntos (flag del listado o llamada a /adjuntos):
      → Obtener lista de adjuntos.
      → Para cada adjunto: llamar /adjuntoPdf y decodificar bytes.
   b. Llamar /pdf (consolidado de la actuación) → bytes.
   c. Emitir progreso a la UI (N/total).

4. Armado del ZIP (ver §7 para estructura).

5. Generar PDF resumen con case-pdf-generator usando ficha + mapeo de actuaciones.

6. Agregar PDF resumen al ZIP.

7. Disparar descarga con nombre:
   expediente_J-01-00199522-3_2021-1.zip
   (normalizar CUIJ reemplazando '/' por '_').

8. Aplicar las políticas de reintentos, timeouts y keep-alive
   que ya existen en el orquestador MEV.
```

**Paralelismo:** limitar a 3-5 descargas simultáneas de adjuntos para no saturar el servidor ni el navegador (MEV ya tiene esta política, reutilizar).

**Reintentos:** el patrón MEV (N intentos con backoff exponencial por adjunto) se aplica igual acá. Los códigos HTTP a reintentar típicamente son 5xx y 429.

---

## 7. Estructura del ZIP

```
expediente_J-01-00199522-3_2021-1.zip
│
├── 00-resumen.pdf
│   (generado por case-pdf-generator:
│    ficha, listado ordenado de actuaciones con marcadores,
│    portada, sumario, metadata)
│
├── 01-despachos/
│   ├── 2023-12-07_2978721_JUETRA_sorteo-automatico/
│   │   └── actuacion.pdf  (consolidado del endpoint /pdf)
│   └── 2024-02-15_...
│
├── 02-escritos/
│   ├── 2023-12-07_2978720_DEM_demanda/
│   │   ├── actuacion.pdf
│   │   └── adjuntos/
│   │       ├── 01_poder_notarial.pdf
│   │       └── 02_documental.pdf
│   └── 2025-02-28_...
│
├── 03-cedulas/
│   └── 2025-11-06_659536_CEDELE_cedula-electronica/
│       └── actuacion.pdf
│
└── 04-notas/
    └── 2025-11-26_2351159_ME76_nota-de-remision/
        └── actuacion.pdf
```

**Mapping de categorías JUSCABA → carpetas del ZIP:**

| Filtro UI JUSCABA | Carpeta ZIP | Heurística para clasificar |
|---|---|---|
| Despachos | `01-despachos/` | `codigo` empieza con `PS`, `JUETRA`, `SAC`, o la API lo marca explícito |
| Escritos | `02-escritos/` | `codigo` empieza con `ESCRIT`, `DEM` |
| Cédulas | `03-cedulas/` | `esCedula === 1` o `codigo` empieza con `CED` |
| Notas | `04-notas/` | `codigo` empieza con `ME`, `NOTA` |

**⚠️ Validar en implementación:** la forma más robusta es que el listado `/actuaciones` devuelva un campo `tipo` / `categoria` explícito. Si existe, usarlo en lugar de heurística sobre el `codigo`. Ver §8.

**Nomenclatura de carpetas por actuación:**
`{YYYY-MM-DD}_{numero}_{codigo}_{titulo-slug}/`

- Fecha: `fechaFirma` convertida a `YYYY-MM-DD`.
- Slug: título normalizado (minúsculas, sin acentos, `-` en lugar de espacios, truncado a ~60 chars).

---

## 8. Preguntas abiertas / a validar en implementación

### 8.1 Cómo obtener el `expId` desde el `identificador` público — ✅ RESUELTO (2026-04-18)

**Endpoint confirmado:** `POST /iol-api/api/expedientes/lista`, ver §3.3.0 para el contrato completo (payload, response, formato del `filter` anidado).

La resolución se hace en una sola llamada al cargar la vista del expediente, usando `identificador`, `cuij`, `anio` y `tipoBusqueda` leídos directamente de la query string de la URL actual. No hace falta interceptar fetch ni leer estado interno de Angular (estrategias B y C del análisis original quedan descartadas).

### 8.2 Formato real del response de `adjuntoPdf`

`Content-Type: application/json` para lo que debería ser un PDF es sospechoso. Hipótesis ordenadas por probabilidad:

1. **JSON wrapper con base64.** Response tipo `{ "nombre": "...", "contenido": "JVBERi0xL...", "mime": "application/pdf" }`. Decodificar con `atob()` y convertir a `Uint8Array`.
2. **JSON con URL firmada de descarga.** Response tipo `{ "url": "https://.../storage/..." }` con URL de corta duración. Hacer segundo `fetch` a esa URL.
3. **PDF crudo con Content-Type mal seteado.** Menos probable, pero posible. Leer como `arrayBuffer()` directo.

**Acción:** en la primera iteración, loggear el primer response completo para determinar el formato.

### 8.3 Flag de "tiene adjuntos" en el listado de actuaciones

Si el response de `/actuaciones` incluye `tieneAdjuntos: boolean` o `cantidadAdjuntos: number`, evitar la llamada a `/adjuntos` para actuaciones sin archivos. Si no lo incluye, llamar siempre y manejar lista vacía. Validar en F1.

### 8.4 Campo de "tipo / categoría" explícito de actuación

Idem §8.3: si la API devuelve un campo `tipo` o `categoria` explícito (`DESPACHO`, `ESCRITO`, `CEDULA`, `NOTA`), usarlo. Si no, aplicar la heurística sobre `codigo` descrita en §7.

### 8.5 Límite de tamaño / paginación extrema

Para causas muy largas (100+ actuaciones, GB de adjuntos):
- ¿La API tiene límite en `size`? Probar `size=100` o `size=200`.
- ¿El ZIP se puede armar streaming o requiere todo en memoria? MEV ya resolvió esto, replicar.

### 8.6 Filtros "Mis Escritos / Mis Cédulas / Mis Oficios / Mis Notas"

Estas pestañas (distintas de "Actuaciones") parecen filtrar al rol del usuario autenticado. **Hipótesis:** son vistas derivadas sobre el mismo dataset de `/actuaciones`. Para v0.5.0 se ignoran; el ZIP se arma siempre desde la pestaña "Actuaciones" con las 4 categorías tildadas.

---

## 9. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R1 | ~~El endpoint de lookup `identificador → expId` no existe / es protegido.~~ ✅ Mitigado: endpoint confirmado en relevamiento (`POST /lista`, §3.3.0). | — |
| R2 | La API cambia sin aviso (no hay versionado visible). | El cliente tipado concentra los cambios en un solo archivo. Monitorear con telemetría mínima. |
| R3 | `adjuntoPdf` devuelve un formato distinto al esperado. | Probar los tres formatos de §8.2 en orden, loggear el primer response en desarrollo. |
| R4 | Rate limiting del servidor con usuarios agresivos. | Concurrencia limitada (3-5) y backoff exponencial (igual que MEV). |
| R5 | Sesión expira en medio de una descarga larga. | Reutilizar keep-alive y auto-reconexión de MEV. Si un adjunto falla con 401, reautenticar y reintentar. |
| R6 | Adjuntos muy grandes agotan la memoria del service worker. | Usar streams / blobs; si JSZip no soporta streaming, escribir a IndexedDB como buffer intermedio (validar si MEV ya maneja esto). |
| R7 | CORS bloquea las llamadas desde el content script. | Los headers observados (`Access-Control-Allow-Origin: *` y `https://eje.jusbaires.gob.ar`) sugieren que está OK, pero confirmar agregando `https://eje.juscaba.gob.ar/iol-api/*` a `host_permissions` del manifest. |
| R8 | La heurística de clasificación por `codigo` falla para códigos no vistos en el relevamiento. | Añadir categoría "99-otros/" como bolsa de drenaje; loggear códigos no mapeados para iterar. |
| R9 | Una actuación es una cédula electrónica consolidada y los "adjuntos" son las piezas adjuntadas. Doble descarga (consolidado + adjuntos) duplica contenido. | Tras validar §8.2, decidir si se incluye ambos o sólo uno. Por defecto incluir ambos (el consolidado con marca `actuacion.pdf`, los adjuntos en subcarpeta `adjuntos/`). |

---

## 10. Checklist de verificación E2E

Antes de publicar v0.5.0, validar con al menos tres causas reales de distinto perfil:

**Causa chica** (≤ 10 actuaciones, 0-2 adjuntos por actuación):
- [ ] Se detecta la vista `/iol-ui/u/expedientes` y aparece el botón de descarga.
- [ ] El botón no aparece en el listado `/iol-ui/u/causas` (para v0.5.0).
- [ ] Click genera el ZIP en < 30 segundos.
- [ ] PDF resumen incluye carátula completa, CUIJ, juzgado, fecha de inicio, estado.
- [ ] Estructura de carpetas `01-despachos/`, `02-escritos/`, `03-cedulas/`, `04-notas/` coincide con lo esperado.
- [ ] Cada carpeta de actuación tiene el `actuacion.pdf` consolidado.
- [ ] Adjuntos individuales conservan nombre original (con caracteres latinos bien encodeados).

**Causa mediana** (≈ 50 actuaciones, caso de prueba: `J-01-00199522-3/2021-1`):
- [ ] Paginación funciona: se obtienen las 53 actuaciones en 2 páginas.
- [ ] Todas las categorías (despachos, escritos, cédulas, notas) quedan reflejadas.
- [ ] Actuación "DEM DEMANDA" incluye el poder notarial como adjunto separado.
- [ ] Actuación "ME66 AGREGA CORREO BCO CIUDAD" incluye ambos PDFs adjuntos (`2501655 metrovias c ente 199522.pdf` y `mail contestacion bco 199522.pdf`) con nombres originales.
- [ ] Marcadores del PDF resumen saltan a las secciones correctas.

**Causa grande** (≥ 100 actuaciones, o > 200 MB de adjuntos):
- [ ] La extensión no agota memoria del service worker.
- [ ] Los reintentos se activan si algún adjunto falla temporalmente.
- [ ] El ZIP final se genera correctamente y es abrible por Windows Explorer, macOS Finder y 7-Zip.

**Transversales:**
- [ ] Keep-alive y auto-reconexión se disparan si la sesión expira a mitad de descarga.
- [ ] Cancelar la descarga a mitad deja todo limpio (no queda un ZIP corrupto ni un progress bar colgado).
- [ ] No hay llamadas a la API antes del click del usuario (no trackear pasivamente).
- [ ] Funciona en Chrome estable y en Edge.
- [ ] Comportamiento visual del botón es consistente con el de MEV.
- [ ] Si el usuario no está autenticado en JUSCABA y hace clic, el mensaje de error es claro ("iniciá sesión en JUSCABA y volvé a intentar").

---

## Apéndice A — Muestras reales observadas

**CUIJ de prueba:** `J-01-00199522-3/2021-1`
**expId:** `3090965`
**Carátula:** METROVIAS sa s/ QUEJA POR RECURSO DE INCONSTITUCIONALIDAD DENEGADO en METROVIAS S.A. CONTRA ENTE UNICO REGULADOR DE LOS SERVICIOS PUBLICOS DE LA CIUDAD AUTONOMA DE BUENOS AIRES SOBRE RECURSO DIRECTO SOBRE RESOLUCIONES DEL ENTE UNICO REGULADOR DE SERVICIOS PUBLICOS
**Total actuaciones:** 53 (paginado 50/pág → 2 páginas)
**Códigos de actuación vistos:** `PS60`, `ME55`, `ME66`, `ME69`, `ME76`, `ESCRIT`, `DEM`, `JUETRA`, `SAC1`, `SAC42`, `CEDELE`.

**Ejemplo de actuación con múltiples adjuntos:**
- Título: `ME66 AGREGA CORREO BCO CIUDAD`
- actId observado en captura: `50047772`
- Adjuntos (de modal): `2501655 metrovias c ente 199522.pdf` + `mail contestacion bco 199522.pdf`

**Ejemplo de adjunto individual descargado:**
- URL: `https://eje.juscaba.gob.ar/iol-api/api/expedientes/actuaciones/adjuntoPdf?filter=%7B%22aacId%22:9091736,%22expId%22:3090965,%22actId%22:53180303,%22ministerios%22:false,%22esCedula%22:false%7D`
- Método: `GET`
- Content-Type response: `application/json` ⚠️
- Tamaño transferido: 84.8 kB para un PDF de 2 páginas
- Response headers notables: `Cache-Control: no-cache, no-store, must-revalidate`; `Access-Control-Allow-Origin: *` (también `https://eje.jusbaires.gob.ar`); `Transfer-Encoding: chunked`.

**Comparativa "Descargar Causa" nativo vs ProcuAsist propuesto:**

| Feature | JUSCABA nativo | ProcuAsist v0.5.0 |
|---|---|---|
| Formato de salida | PDF monolítico único | ZIP con carpetas estructuradas |
| PDF resumen / índice | No | Sí (portada + marcadores) |
| Adjuntos separados | No (concatenados) | Sí (por actuación, en subcarpeta) |
| Nombres originales | Se pierden | Se conservan |
| Reintentos automáticos | No visible | Sí (herencia MEV) |
| Progreso granular | Barra genérica | Por actuación, con conteo N/total |
