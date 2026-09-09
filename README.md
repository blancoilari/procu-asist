# ProcuAsist - Copiloto Legal

Extensión Chrome para abogados argentinos que automatiza la interacción con portales judiciales de la Provincia de Buenos Aires y del Poder Judicial de la Nación.

> **Hecho por un abogado de la matrícula, para colegas. Es gratuito y sin fines de lucro.**

**Versiones:** la versión publicada en Chrome Web Store es la **v0.8.0** (publicada; confirmado el 2026-07-19). Este repositorio está en la **v0.8.1** (pendiente de publicar).

---

## Para abogados (instalación rápida)

Si sos abogado/a y querés usarla, no hace falta que entiendas nada de programación.

**Qué hace:**
- Te permite **descargar el expediente completo** de MEV/SCBA (Provincia de Buenos Aires) y **PJN** (Poder Judicial de la Nación) en un único ZIP, con un PDF resumen y las actuaciones con sus documentos.
- Guarda **marcadores** de tus expedientes favoritos, accesibles desde un panel lateral del navegador.
- Permite **monitorear causas** y recibir alertas de movimientos nuevos, especialmente en MEV/SCBA.
- Ayuda a **importar causas** desde resultados y sets de búsqueda MEV.
- Permite buscar **movimientos desde una fecha** en causas MEV monitoreadas.

**Cómo instalarla:**
- Instalación desde Chrome Web Store: [ProcuAsist - Copiloto Legal](https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem)

**Cómo reportar errores o pedir features:**
- Mail: [blancoilariasistente@gmail.com](mailto:blancoilariasistente@gmail.com?subject=ProcuAsist%20-%20feedback)
- O abrí un issue en [GitHub Issues](https://github.com/blancoilari/procu-asist/issues)

**Qué viene a futuro:** mirá el [ROADMAP.md](ROADMAP.md).

**Manual de uso paso a paso:** [docs/manual-usuario.md](docs/manual-usuario.md).

---

## Funcionalidades

- **Auto-login** en portales judiciales (MEV/SCBA y PJN, este último con SSO Keycloak)
- **Keep-alive** de sesión para evitar desconexiones por inactividad
- **Auto-reconexión** automática cuando la sesión expira
- **Marcadores de causas** con búsqueda rápida y organización
- **Monitoreo de movimientos** con notificaciones push en Chrome
- **Descarga ZIP del expediente completo** con un click — incluye resumen PDF + un PDF por cada paso procesal (con todos sus metadatos) + adjuntos
- **Selección de pasos procesales** a descargar antes de generar el ZIP
- **Verificación automática** de la descarga con informe de errores
- **Importación masiva** de causas desde resultados y sets de búsqueda MEV
- **Onboarding wizard** para nuevos usuarios, con carga de credenciales y "Importar todo" incluidos
- **Encriptación local** de credenciales con AES-GCM (clave de dispositivo automática, sin PIN)

## Portales Soportados

| Portal | URL | Funcionalidades |
|--------|-----|-----------------|
| MEV / SCBA (Mesa de Entradas Virtual - Provincia de Buenos Aires) | mev.scba.gov.ar | Auto-login, extracción de causas, marcadores, monitoreo, descarga ZIP |
| PJN (Poder Judicial de la Nación) | scw.pjn.gov.ar, portalpjn.pjn.gov.ar, api.pjn.gov.ar | Auto-login SSO, listado de causas, descarga ZIP del expediente |

## Stack Tecnológico

- **Framework**: [WXT](https://wxt.dev) 0.20 (Manifest V3)
- **UI**: React 19 + TypeScript 5.9 (strict) + Tailwind CSS v4
- **State**: chrome.storage.local (local-first)
- **Crypto**: Web Crypto API (AES-GCM con clave de dispositivo persistida)
- **PDF**: jsPDF 4
- **ZIP**: JSZip 3

## Requisitos

- Google Chrome 120+

## Instalación para Desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/blancoilari/procu-asist.git
cd procu-asist

# Instalar dependencias
npm install

# Desarrollo con hot reload
npm run dev

# Build de producción
npm run build

# Generar .zip para distribución
npm run zip

# Verificar tipos TypeScript
npm run compile

# Tests (runner de node, sin dependencias extra)
npm test
```

## Cargar en Chrome (modo desarrollador)

1. Correr `npm run build` (genera la carpeta `.output/chrome-mv3`)
2. Ir a `chrome://extensions`
3. Activar "Modo desarrollador" (esquina superior derecha)
4. Click en "Cargar descomprimida"
5. Seleccionar la carpeta `.output/chrome-mv3`

## Estructura del Proyecto

```
procu-asist/
├── entrypoints/                 # Puntos de entrada de la extensión
│   ├── background.ts            # Service worker principal
│   ├── background/              # Módulos del background
│   │   ├── alarm-manager.ts     # Gestión de alarmas Chrome
│   │   ├── auto-reconnect.ts    # Reconexión automática de sesión
│   │   ├── case-monitor.ts      # Escaneo de movimientos nuevos
│   │   ├── keep-alive.ts        # Mantener sesiones activas
│   │   └── message-router.ts    # Router de mensajes IPC
│   ├── mev.content.ts           # Content script para MEV
│   ├── pjn.content.ts           # Content script para PJN (SCW y portal PJN)
│   ├── sso.content.ts           # Content script para el SSO Keycloak del PJN
│   ├── sidepanel/               # Panel lateral (dashboard principal)
│   ├── popup/                   # Popup de la extensión
│   └── options/                 # Página de opciones (credenciales)
├── modules/                     # Lógica de negocio
│   ├── crypto/                  # Encriptación AES-GCM + gestión de claves
│   ├── messages/                # Tipos de mensajes IPC
│   ├── pdf/                     # Generación de PDF y ZIP, descarga de adjuntos
│   ├── portals/                 # Selectores, parsers y tipos por portal
│   ├── storage/                 # Stores locales (bookmarks, monitors, settings, credentials)
│   ├── tier/                    # Configuración (app gratuita, sin límites)
│   └── ui/                      # Componentes compartidos (onboarding)
├── public/icon/                 # Iconos de la extensión (16-128px + SVG)
├── assets/styles/               # Estilos globales (Tailwind)
├── tests/                       # Tests puros (node --test), fuera del build
├── docs/                        # Documentación
│   └── manual-usuario.md        # Manual para usuarios no técnicos
├── wxt.config.ts                # Configuración WXT + manifest
├── tsconfig.json                # Configuración TypeScript
└── package.json                 # Dependencias y scripts
```

## Contenido del ZIP descargado

```
expediente_AL-12345-2025.zip
└── AL-12345-2025_expte_completo/
    ├── resumen.pdf                              # Resumen con todos los movimientos
    ├── 001_fs-1-3_fecha_29-12-2025_AUTOS.pdf   # PDF de cada paso procesal
    ├── 002_fs-4-15_fecha_29-12-2025_INTERLOCUTORIO.pdf
    ├── 003_fs-29-36_fecha_04-02-2026_RECURSO_DE_APELACION.pdf
    ├── 003_..._adjunto_1.pdf                   # Adjuntos del paso
    └── _verificacion.txt                        # Solo si hubo errores de descarga
```

Cada PDF de paso procesal incluye: juzgado, datos del expediente (carátula, fecha inicio, receptoría, estado), información del paso (trámite, firmado, fojas), REFERENCIAS con adjuntos clickables, DATOS DE PRESENTACIÓN, y el texto completo del proveído.

Los PDF salen **sin marca**: sin logo, sin color corporativo y sin el nombre de la extensión en el encabezado o el pie. Son piezas de trabajo del expediente y se leen como tales. Lo único que se imprime es contenido (número, carátula, fechas, juzgado, movimientos, referencias y texto), en negro sobre blanco, con grises solo para separar jerarquías. No hay opción de configuración: es el único formato.

## Verificación de la MEV ("Validando acceso")

**Estado al 09/09/2026. Todo lo que sigue está sin confirmar contra el portal.**

Lo observado:

- El 08/09/2026 la MEV mostró en el navegador una pantalla intermedia con los textos "Validando acceso" y "verificando si está siendo navegado por un ser humano" antes de dejar ver el sitio.
- Esa pantalla se sirve con HTTP 200. Para un `fetch()` es una respuesta buena: `resp.ok` da true y el código sigue como si tuviera la página pedida.
- La consecuencia observable es un PDF armado y descargado, pero con los despachos vacíos: el parser no encuentra ninguno de los campos que busca y no se queja.
- Un lector automatizado ajeno a esta extensión seguía leyendo bien las fichas de expediente en esas mismas fechas, así que el filtro no bloquea todo. En cambio `VerMasTramitacion.asp` devuelve HTTP 500 desde el 21/08/2026, o sea desde antes de que apareciera la pantalla: son dos cosas distintas y no hay que confundirlas.

Lo que **no** se sabe:

- Si la pantalla aparece siempre, por ráfagas o solo para ciertos pedidos.
- Si el HTML que se sirve contiene los mismos textos que se ven en pantalla (la detección está escrita sobre esa suposición).
- Si resolver la verificación en la pestaña deja una cookie que sirva para los `fetch` posteriores de la extensión.
- Qué dispara el filtro: cantidad de pedidos, cadencia, agente, o nada de eso.

Lo que hace la extensión hoy (`modules/portals/mev-challenge.ts`):

- Antes de armar el PDF de un paso procesal, mira la respuesta: largo del HTML, muestra acotada del texto visible y si están las marcas estructurales de un proveído. Si la página no es un proveído, la descarga se **detiene** y se avisa por pantalla, en vez de generar un documento incompleto con apariencia de completo.
- La detección es angosta a propósito: una página que trae estructura de proveído nunca se marca, aunque su texto contenga alguna de las frases buscadas. La frase sola decide únicamente cuando la página además carece de esa estructura.
- Lo mismo en la descarga de adjuntos (una respuesta HTML con la frase corta la descarga entera y no gasta reintentos) y en el escaneo del monitoreo (si no se parseó ningún movimiento y el HTML trae la frase, la causa no se anota como "sin novedades": se avisa).
- Tests: `npm test` (runner de node, sin dependencias nuevas).

Camino de salida, **diseñado y no implementado**:

- Reemplazar el `fetch` en el mundo MAIN por una navegación real de la pestaña de la MEV a la URL del proveído y leer el DOM ya renderizado. Es lo que hace una persona y lo que el filtro espera; también es el camino que sobrevive si mañana la pantalla exige ejecutar JavaScript. Cuesta caro: hay que tomar prestada la pestaña del usuario (o abrir una propia), esperar el `load`, devolverla a donde estaba y manejar el caso de varias descargas en fila.
- Alternativa más barata: ante una detección, esperar y reintentar una vez, apostando a que la verificación ya dejó su cookie. No se implementó porque no hay ninguna evidencia de que esa cookie exista ni de cuánto dura, y un reintento a ciegas contra un portal que está filtrando empeora las cosas.
- Nada de esto se puede probar sin sesión y con el portal filtrando. Queda para una sesión con el titular delante, mirando la pantalla real.

## Precio

**Gratuito** — todas las funciones habilitadas, sin límites. Si te resulta útil, podés [invitarme un cafecito](https://cafecito.app/procuasist).

## Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantías de ningún tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso.

## Licencia

Todos los derechos reservados. Este software es propietario.
