# ProcuAsist - Copiloto Legal

Extensión Chrome para abogados argentinos que automatiza la interacción con portales judiciales de la Provincia de Buenos Aires y CABA.

> **Hecho por un abogado de la matrícula, para colegas. Es gratuito y sin fines de lucro.**

---

## Para abogados (instalación rápida)

Si sos abogado/a y querés usarla, no hace falta que entiendas nada de programación.

**Qué hace:**
- Te permite **descargar el expediente completo** de la MEV (Provincia BA) en un único ZIP, con un PDF resumen y todos los pasos procesales con sus adjuntos.
- Guarda **marcadores** de tus expedientes favoritos, accesibles desde un panel lateral del navegador.
- (Próximamente) Hace **monitoreo automático** y te avisa cuando hay movimientos nuevos.

**Cómo instalarla:**
- Próximamente en Chrome Web Store. Cuando esté publicada, vas a poder instalarla con un click. (Si todavía no está, escribime y te paso una versión para cargar manualmente.)

**Cómo reportar errores o pedir features:**
- Mail: [blancoilariasistente@gmail.com](mailto:blancoilariasistente@gmail.com?subject=ProcuAsist%20-%20feedback)
- O abrí un issue en [GitHub Issues](https://github.com/blancoilari/procu-asist/issues)

**Qué viene a futuro:** mirá el [ROADMAP.md](ROADMAP.md).

**Manual de uso paso a paso:** [docs/manual-usuario.md](docs/manual-usuario.md).

---

## Funcionalidades

- **Auto-login** en portales judiciales (MEV, JUSCABA)
- **Keep-alive** de sesión para evitar desconexiones por inactividad
- **Auto-reconexión** automática cuando la sesión expira
- **Marcadores de causas** con búsqueda rápida y organización
- **Monitoreo de movimientos** con notificaciones push en Chrome
- **Descarga ZIP del expediente completo** con un click — incluye resumen PDF + un PDF por cada paso procesal (con todos sus metadatos) + adjuntos
- **Selección de pasos procesales** a descargar antes de generar el ZIP
- **Verificación automática** de la descarga con informe de errores
- **Importación masiva** de causas desde resultados de búsqueda
- **Onboarding wizard** para nuevos usuarios
- **Encriptación local** de credenciales con AES-GCM y PIN

## Portales Soportados

| Portal | URL | Funcionalidades |
|--------|-----|-----------------|
| MEV (Mesa de Entradas Virtual - Provincia de Buenos Aires) | mev.scba.gov.ar | Auto-login, extracción de causas, monitoreo, descarga ZIP |
| JUSCABA (Poder Judicial de CABA) | eje.jus.gov.ar | Auto-login, extracción de causas |

## Stack Tecnológico

- **Framework**: [WXT](https://wxt.dev) 0.20 (Manifest V3)
- **UI**: React 19 + TypeScript 5.9 (strict) + Tailwind CSS v4
- **State**: chrome.storage.local (local-first)
- **Crypto**: Web Crypto API (PBKDF2 + AES-GCM)
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
│   ├── eje.content.ts           # Content script para JUSCABA
│   ├── scba-notif.content.ts    # Content script para notificaciones SCBA
│   ├── sidepanel/               # Panel lateral (dashboard principal)
│   ├── popup/                   # Popup de la extensión
│   ├── options/                 # Página de opciones
│   └── offscreen/               # Documento offscreen para crypto
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

## Precio

**Gratuito** — todas las funciones habilitadas, sin límites. Si te resulta útil, podés [invitarme un cafecito](https://cafecito.app/procuasist).

## Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantías de ningún tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso.

## Licencia

Todos los derechos reservados. Este software es propietario.
