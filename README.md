# ProcuAsist - Copiloto Legal

Extensión Chrome para abogados argentinos que automatiza la interacción con portales judiciales de la Provincia de Buenos Aires y del Poder Judicial de la Nación.

> **Hecho por un abogado de la matrícula, para colegas. Es gratuito y sin fines de lucro.**

**Versiones:** Chrome Web Store publica la **v0.8.0** (verificado el 29/09/2026). La **v0.8.1** incorpora la recuperación de descargas y está preparada para enviar a revisión.

> **Actualización del 29/09/2026:** se retoma el mantenimiento y la publicación por pedido del titular. La descarga MEV conserva el avance ante verificaciones. Un escaneo que no pudo leer todas las causas se informa como incompleto.

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
expediente_XX-12345-2025_2026-02-04_1051.zip             # Lleva fecha y hora: no pisa uno anterior
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

La descarga reconoce la verificación y puede abrir una pestaña para esperar a que la MEV complete su validación normal. No resuelve desafíos ni garantiza que el portal conceda acceso. Conserva lo descargado y detalla lo pendiente si no puede continuar.

La descarga se comprobó en una prueba asistida el 29/09/2026 con 131 documentos y 22 adjuntos. Los adjuntos lentos tienen tiempo adicional para abrirse. El monitoreo es otro recorrido: ante una verificación informa un barrido incompleto y conserva pendientes; puede requerir volver a intentarlo tras validar la sesión.

Si el PDF único no puede incluir algún archivo, se entrega un ZIP con los originales y el PDF de consulta, acompañado por un aviso. Los datos siguen locales. No depende de Estudio OS ni instala componentes en otros productos.


## Precio

**Gratuito**: todas las funciones habilitadas, sin límites. Si te resulta útil, podés [invitarme un cafecito](https://cafecito.app/procuasist).

## Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantías de ningún tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso.

## Licencia

Todos los derechos reservados. Este software es propietario.
