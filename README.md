# ProcuAsist - Copiloto Legal

Extensión Chrome para abogados argentinos que automatiza la interacción con portales judiciales de la Provincia de Buenos Aires y del Poder Judicial de la Nación.

> **Hecho por un abogado de la matrícula, para colegas. Es gratuito y sin fines de lucro.**

**Versiones:** la versión publicada en Chrome Web Store es la **v0.8.0** (publicada; confirmado el 2026-07-19). Este repositorio está en la **v0.8.1** (armada el 09/09/2026, sin publicar).

> **Proyecto en pausa desde el 25/09/2026**, por decisión del titular: la prioridad pasa a otro sistema del estudio. La 0.8.1 no se publica por ahora y no hay fecha para retomar. El motivo de fondo es la regla publicada por la MEV para sus usuarios (sección "Verificación de la MEV", más abajo): antes de publicar cualquier versión hay que revisar qué automatizaciones de la extensión sobreviven a esa regla. La versión 0.8.0 publicada sigue instalable, pero la MEV endureció su filtro antirobot en septiembre de 2026 y la descarga de expedientes puede fallar o quedar bloqueada; ver la misma sección.

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
- **Descarga ZIP del expediente completo** con un click, incluye resumen PDF + un PDF por cada paso procesal (con todos sus metadatos) + adjuntos
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

- **Framework**: [WXT](https://wxt.dev) 0.21 (Manifest V3). `package.json` fija `wxt ^0.21.4` y el lockfile 0.21.4; el zip de la 0.8.1 armado el 09/09/2026 en el checkout principal salió con wxt 0.20.20 (el `node_modules` de ese checkout no se había reinstalado), por eso su `manifest.json` no trae `options_ui.open_in_tab`. Antes de publicar: `npm ci` y regenerar el zip.
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
# Requiere Node 22.6 o mayor: los tests son .ts y se apoyan en que node
# quite los tipos solo. Con una version anterior fallan al importar.
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
├── apps/procu-estudio/          # Scaffold de ProcuEstudio (app web futura), sin actividad desde mayo de 2026; se conserva
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

### La regla publicada por la MEV (verificada el 23/09/2026)

La ayuda oficial de la MEV, sección USUARIOS, dice que sus usuarios "son para ser usados por seres humanos y no por sistemas informáticos o agentes de inteligencia artificial" y que el mal uso "generará el bloqueo de dicho usuario". Se leyó en el portal el 23/09/2026 y es la razón principal de la pausa: el auto-login, el mantener sesión (keep-alive), el monitoreo automático, la importación masiva y la descarga por detrás usan la cuenta del abogado en forma automatizada. Lo que asiste a la persona mientras navega (marcadores, ayudas en la pantalla, cálculo de plazos) es otra cosa. Qué funciones quedan y cuáles se retiran es una revisión que no se hizo y que condiciona cualquier publicación futura. La extensión no resuelve, automatiza ni esquiva la verificación antirobot, y este repositorio no documenta cómo hacerlo.

### Lo medido el 22/09/2026 contra el portal, con sesión real

Medido en una rama de trabajo que no está integrada en `master` ni publicada. Se anota lo que explica por qué la descarga falla, no cómo evitar el filtro: eso no se documenta acá.

- La MEV limita la cantidad de pedidos: pasados unos **30 proveídos por minuto**, toda página de la MEV responde con la pantalla "Validando acceso..." (un verificador de Cloudflare Turnstile, el de "¿sos humano?"). La pantalla llega con la misma dirección pedida y **HTTP 200**, y sus textos no vienen en el HTML servido (los arma un script). Para un `fetch()` es una respuesta buena: `resp.ok` da true. Un bloqueo que se levanta puede volver a aparecer, y cada uno dura más que el anterior.
- El 23/09/2026, en una prueba real sobre un expediente de 225 pasos, la MEV contestó con su pantalla a todos los pedidos que la extensión hizo por detrás, desde el primero y aun con un pedido cada varios minutos, aunque la verificación se había pasado a mano en la pestaña. Bajados: 0 de 225. No se sabe si la MEV seguía marcando al usuario por el bloqueo del día anterior, o si endureció la regla para todo lo que no sea el navegador.
- `VerMasTramitacion.asp` devuelve HTTP 500 desde el 21/08/2026, desde antes de la pantalla: son dos cosas distintas.

Lo que sigue sin medir: qué pedidos cuentan para el límite, si el límite va por usuario o por conexión, y si pasar la verificación a mano en la pestaña cambia algo para los pedidos que la extensión hace por detrás.

### Lo que hace la versión de este repositorio (0.8.1, sin publicar)

Lo que sigue describe `master`, que es el código de la 0.8.1 armada el 09/09/2026, escrito entonces sin poder probar contra el portal (`modules/portals/mev-challenge.ts`):

- Antes de armar el PDF de un paso procesal, mira la respuesta: largo del HTML, muestra acotada del texto visible y si están las marcas estructurales de un proveído. Si la página no es un proveído, la descarga se **detiene** y se avisa por pantalla, en vez de generar un documento incompleto con apariencia de completo.
- La detección es angosta a propósito: una página que trae estructura de proveído nunca se marca, aunque su texto contenga alguna de las frases buscadas. La frase sola decide únicamente cuando la página además carece de esa estructura.
- Lo mismo en la descarga de adjuntos (una respuesta HTML con la frase corta la descarga entera y no gasta reintentos) y en el escaneo del monitoreo (si no se parseó ningún movimiento y el HTML trae la frase, la causa no se anota como "sin novedades": se avisa, y el resto del barrido MEV de esa corrida no se hace).
- Tests: `npm test` (runner de node, sin dependencias nuevas; 8 casos en `tests/mev-challenge.test.ts`).

Lo medido el 22/09 mostró que esa detección no alcanza: buscaba las frases en el texto visible, que en la pantalla real está vacío, así que la tomaba por "página inesperada", salteaba el documento y seguía pidiendo. En un expediente de 225 proveídos se salteaban más de 100. La búsqueda de causas y la importación masiva (`import-all`) siguen distinguiendo solo la pantalla de login: frente a la verificación degradan sin decirlo (la búsqueda informa "formulario no encontrado" y el asistente de importación puede mostrar cero causas o cero sets).

Existe una rama de trabajo, no integrada ni publicada, con otro recorrido de descarga (avisa y pregunta en vez de saltear). Quedó en pausa el 25/09/2026 con la bajada real sin verificar (0 de 225 el 23/09) y no se integra mientras no se resuelva la revisión de la regla de la MEV.

## Precio

**Gratuito**: todas las funciones habilitadas, sin límites. Si te resulta útil, podés [invitarme un cafecito](https://cafecito.app/procuasist).

## Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantías de ningún tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso.

## Licencia

Todos los derechos reservados. Este software es propietario.
