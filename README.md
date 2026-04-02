# ProcuAsist - Copiloto Legal

Extensión Chrome para abogados argentinos que automatiza la interacción con portales judiciales de la Provincia de Buenos Aires y Nación.

## Funcionalidades

- **Auto-login** en portales judiciales (MEV, EJE, SCBA Notificaciones)
- **Keep-alive** de sesión para evitar desconexiones por inactividad
- **Auto-reconexión** automática cuando la sesión expira
- **Marcadores de causas** con búsqueda rápida y organización
- **Monitoreo de movimientos** con notificaciones push en Chrome
- **Generación de PDF** con datos del expediente y movimientos
- **Descarga de adjuntos** desde los portales
- **Importación masiva** de causas desde resultados de búsqueda
- **Sincronización en la nube** vía Supabase (marcadores, monitores, alertas, configuración)
- **Modo oscuro** en todos los paneles y páginas de portales
- **Onboarding wizard** para nuevos usuarios
- **Encriptación local** de credenciales con AES-GCM y PIN

## Portales Soportados

| Portal | URL | Funcionalidades |
|--------|-----|-----------------|
| MEV (Mesa de Entradas Virtual) | mev.scba.gov.ar | Auto-login, extracción de causas, monitoreo, PDF |
| EJE (Poder Judicial de CABA) | eje.juscaba.gob.ar | Auto-login, extracción de causas, monitoreo |
| SCBA Notificaciones | notificaciones.scba.gov.ar | Importación de notificaciones |

## Stack Tecnológico

- **Framework**: [WXT](https://wxt.dev) 0.20 (Manifest V3)
- **UI**: React 19 + TypeScript 5.9 (strict) + Tailwind CSS v4
- **State**: Zustand 5 + chrome.storage.local (local-first)
- **Backend**: Supabase (Auth + PostgreSQL + RLS)
- **Crypto**: Web Crypto API (PBKDF2 + AES-GCM)
- **PDF**: jsPDF 4

## Requisitos

- Google Chrome 120+
- Cuenta de Google (para autenticación)

## Instalación para Desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/blancoilari/procu-asist.git
cd procu-asist

# Instalar dependencias
npm install

# Crear archivo de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

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

1. Ir a `chrome://extensions`
2. Activar "Modo desarrollador" (esquina superior derecha)
3. Click en "Cargar descomprimida"
4. Seleccionar la carpeta `.output/chrome-mv3`

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
│   │   └── message-router.ts    # Router de mensajes IPC (~30 handlers)
│   ├── mev-content.ts           # Content script para MEV
│   ├── eje-content.ts           # Content script para EJE (JUSCABA)
│   ├── scba-notif-content.ts    # Content script para SCBA Notificaciones
│   ├── sidepanel/               # Panel lateral (dashboard principal)
│   ├── popup/                   # Popup de la extensión
│   ├── options/                 # Página de opciones
│   └── offscreen/               # Documento offscreen para crypto
├── modules/                     # Lógica de negocio
│   ├── crypto/                  # Encriptación AES-GCM + gestión de claves
│   ├── messages/                # Tipos de mensajes IPC
│   ├── pdf/                     # Generación de PDF y descarga de adjuntos
│   ├── portals/                 # Selectores, parsers y tipos por portal
│   ├── storage/                 # Stores locales (bookmarks, monitors, settings, credentials)
│   ├── supabase/                # Cliente, auth, sync
│   ├── tier/                    # Configuración (app gratuita, sin límites)
│   └── ui/                      # Componentes compartidos (dark mode, onboarding)
├── public/icon/                 # Iconos de la extensión (16-128px + SVG)
├── assets/styles/               # Estilos globales (Tailwind)
├── wxt.config.ts                # Configuración WXT + manifest
├── tsconfig.json                # Configuración TypeScript
└── package.json                 # Dependencias y scripts
```

## Variables de Entorno

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

## Precio

**Gratuito** — todas las funciones habilitadas, sin límites. Si te resulta útil, podés [invitarme un cafecito](https://cafecito.app/procuasist).

## Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantías de ningún tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso.

## Licencia

Todos los derechos reservados. Este software es propietario.
