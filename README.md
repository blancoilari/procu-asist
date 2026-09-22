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
├── wxt.config.ts                # Configuración WXT + manifest
├── tsconfig.json                # Configuración TypeScript
└── package.json                 # Dependencias y scripts
```

## Contenido del ZIP descargado

```
expediente_XX-12345-2025.zip
└── XX-12345-2025_expte_completo/
    ├── resumen.pdf                                              # Todos los movimientos de la ficha
    ├── 2025-12-29_fs-1-3_AUTOS.pdf                              # PDF de cada paso procesal
    ├── 2025-12-29_fs-4-15_INTERLOCUTORIO.pdf
    ├── 2026-02-04_fs-29-36_RECURSO_DE_APELACION.pdf
    ├── 2026-02-04_fs-29-36_RECURSO_DE_APELACION_adjunto_1.pdf   # Adjuntos del paso
    └── _verificacion_2026-02-04_1051.txt                        # Solo si faltó algo
```

Los nombres empiezan por la fecha del paso (AAAA-MM-DD) y siguen con las fojas y la descripción. Así los archivos quedan ordenados por fecha y una descarga parcial posterior (por ejemplo, solo los pasos nuevos) encaja en la misma carpeta sin pisar nada. Si dos pasos quedan con el mismo nombre, el segundo lleva `_2`; como ese cálculo se hace sobre la ficha completa, el nombre de un documento no cambia de una descarga a otra. Dentro de un mismo día, el Explorador de Windows ordena por fojas como texto, no en el orden de la MEV.

El `resumen.pdf` lista todos los movimientos de la ficha aunque se hayan tildado solo algunos: una descarga parcial lo reemplaza por uno completo y al día. El informe `_verificacion_AAAA-MM-DD_HHMM.txt` lleva la fecha y la hora de la descarga, para no pisar el de otra descarga en la misma carpeta.

Cada PDF de paso procesal incluye: juzgado, datos del expediente (carátula, fecha inicio, receptoría, estado), información del paso (trámite, firmado, fojas), REFERENCIAS con adjuntos clickables, DATOS DE PRESENTACIÓN, y el texto completo del proveído.

Los PDF salen **sin marca**: sin logo, sin color corporativo y sin el nombre de la extensión en el encabezado o el pie. Son piezas de trabajo del expediente y se leen como tales. Lo único que se imprime es contenido (número, carátula, fechas, juzgado, movimientos, referencias y texto), en negro sobre blanco, con grises solo para separar jerarquías. No hay opción de configuración: es el único formato.

## Verificación de la MEV ("Validando acceso")

**Estado medido el 22/09/2026 contra el portal, con sesión real.**

Lo que se midió:

- La MEV tiene un servidor intermedio (nginx) delante de su sistema, con un límite de pedidos: unos **30 proveídos por minuto**. Pidiendo a unos 2 por segundo, el pedido 30 ya recibe la pantalla; a uno cada 1,2 segundos, la pantalla aparece exactamente cada 30 pedidos, una vez por minuto.
- Pasado el límite, toda página de la MEV responde con la pantalla "Validando acceso...": la misma dirección pedida, HTTP 200, 2.000 bytes, un script de Cloudflare Turnstile (el verificador de "¿sos humano?") y ningún texto visible en el cuerpo, porque el texto lo arma un script.
- Sin pedidos, el bloqueo se levanta solo en unos 20 a 30 segundos. Si se sigue pidiendo durante el bloqueo, no se levanta, y cada bloqueo nuevo dura más.
- El bloqueo no es por pestaña: alcanza a otras sesiones del mismo usuario desde la misma conexión. La página de login no queda bloqueada.
- Aparte: un proveído pedido sin que la sesión haya pasado antes por la ficha de su causa devuelve la pantalla de búsqueda.

Por qué la descarga fallaba: la detección anterior buscaba las frases de la verificación en el texto visible, que en esta pantalla está vacío. La tomaba por "página inesperada", salteaba el documento y pedía el siguiente a los 0,3 segundos, lo que alargaba el bloqueo. En un expediente de 225 proveídos se salteaban más de 100, en dos tandas.

Lo que hace la extensión desde la v0.8.1:

- Un portero (`modules/portals/mev-pacer.ts`) espacia los pedidos de la descarga a 20 por minuto, uno cada 3 segundos y de a uno por vez, para dejar margen a lo que el usuario navegue en la MEV al mismo tiempo. Un expediente de 225 proveídos tarda unos 12 minutos.
- La pantalla de verificación se reconoce por su título y su script (`modules/portals/mev-challenge.ts`). Una página con estructura de proveído nunca se marca como verificación.
- Si aparece la pantalla, la descarga deja de pedir y pregunta: esperar y seguir (espera 30 segundos, y 1, 2 o 4 minutos si vuelve a pasar, y reintenta el mismo documento), detener y guardar lo bajado, o cancelar. Nunca saltea un documento por un bloqueo (`modules/pdf/mev-download-runner.ts`).
- Si la MEV devuelve la búsqueda en vez del proveído, la extensión vuelve a entrar una vez a la ficha y reintenta. Si aparece el login, pregunta y pide iniciar sesión en otra pestaña.
- La descarga corre en el fondo de la extensión detrás de un canal abierto con la pestaña (`entrypoints/background/mev-download-job.ts`), no dentro de un mensaje: Chrome termina el proceso de fondo si un mensaje tarda más de 5 minutos.
- Mientras hay una descarga, el escaneo automático no consulta la MEV (se repite al terminar) y el keep-alive no se manda.
- Si la pestaña de la MEV muestra la pantalla de verificación, el content script no hace nada hasta que se resuelva: así un recorrido de importación no la toma por una página vacía.
- Tests: `npm test` (runner de node, sin dependencias nuevas).

Lo que la extensión **no** hace: resolver, automatizar ni esquivar la verificación. Si el bloqueo no se levanta, decide el usuario.

Lo que sigue sin medir:

- Si los pedidos a la ficha (`procesales.asp`) y a los adjuntos cuentan para el mismo límite.
- Si el límite va por usuario o por conexión.
- Si pasar la verificación a mano en la pestaña acorta el bloqueo.

Brecha conocida: la detección de sets del asistente "Importar todo" y el prefiltro por sets del monitoreo (beta) piden páginas directamente y todavía reconocen solo el login. Frente a la verificación pueden mostrar cero sets o cero causas, que se lee como "no hay nada" en vez de "no pude leer". Se aborda con el selector de alcance de la importación.

## Precio

**Gratuito** — todas las funciones habilitadas, sin límites. Si te resulta útil, podés [invitarme un cafecito](https://cafecito.app/procuasist).

## Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantías de ningún tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso.

## Licencia

Todos los derechos reservados. Este software es propietario.
