# ProcuAsist - Manual de Usuario

## Indice

1. [Que es ProcuAsist](#1-que-es-procuasist)
2. [Instalacion](#2-instalacion)
3. [Primer uso: Configuracion inicial](#3-primer-uso-configuracion-inicial)
4. [Configurar credenciales de portales](#4-configurar-credenciales-de-portales)
5. [Auto-login en portales](#5-auto-login-en-portales)
6. [El panel lateral (Side Panel)](#6-el-panel-lateral-side-panel)
7. [Marcadores de causas](#7-marcadores-de-causas)
8. [Monitoreo de causas y alertas](#8-monitoreo-de-causas-y-alertas)
9. [Descargar el expediente completo (ZIP)](#9-descargar-el-expediente-completo-zip)
10. [Importar causas en lote](#10-importar-causas-en-lote)
11. [Modo oscuro](#11-modo-oscuro)
12. [Donaciones](#12-donaciones)
13. [Pagina de opciones](#13-pagina-de-opciones)
14. [Preguntas frecuentes](#14-preguntas-frecuentes)
15. [Solucion de problemas](#15-solucion-de-problemas)

---

## 1. Que es ProcuAsist

ProcuAsist es una extension para Google Chrome que funciona como copiloto legal. Automatiza tareas repetitivas en portales judiciales usados por abogados que litigan en Provincia de Buenos Aires, Justicia Nacional/Federal y CABA:

- **MEV / SCBA** (Mesa de Entradas Virtual - Provincia de Buenos Aires) — mev.scba.gov.ar
- **SCBA Notificaciones** — notificaciones.scba.gov.ar
- **PJN** (Poder Judicial de la Nacion) — scw.pjn.gov.ar / portalpjn.pjn.gov.ar
- **JUSCABA / EJE** (Poder Judicial de CABA) — eje.jus.gov.ar

Con ProcuAsist podes:
- Entrar automaticamente a los portales sin escribir usuario y clave cada vez
- Guardar causas como marcadores para acceder rapido
- Recibir notificaciones cuando hay movimientos nuevos en tus causas
- **Descargar el expediente completo en un ZIP** con pasos procesales, documentos y adjuntos cuando el portal lo permite
- Importar causas desde resultados de busqueda y desde SCBA Notificaciones
- Y mucho mas

---

## 2. Instalacion

### Instalacion normal

La forma recomendada es instalarla desde Chrome Web Store:

https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem

1. Abri el link de Chrome Web Store.
2. Hacé click en **"Agregar a Chrome"**.
3. Confirmá la instalacion.
4. Fijá el icono de ProcuAsist desde el menu de extensiones de Chrome si querés tenerlo siempre visible.

### Instalacion de desarrollo

Si estas probando una version no publicada, tambien podes cargarla manualmente como extension descomprimida:

1. Abrí Google Chrome.
2. En la barra de direcciones, escribí `chrome://extensions` y presioná Enter.
3. Activá **"Modo desarrollador"**.
4. Descomprimí el .zip en una carpeta.
5. Hacé click en **"Cargar descomprimida"**.
6. Seleccioná la carpeta donde descomprimiste la extension.

### Verificar la instalacion

- Vas a ver el icono de ProcuAsist en la barra de extensiones de Chrome (arriba a la derecha)
- Si no lo ves, hacé click en el icono de puzzle (extensiones) y fijá ProcuAsist con el pin

---

## 3. Primer uso: Configuracion inicial

La primera vez que abras ProcuAsist, se va a mostrar un **asistente de configuracion** (onboarding) que te guia paso a paso.

### Paso 1: Crear tu PIN de seguridad

1. Hacé click en el icono de ProcuAsist o abri el panel lateral
2. El asistente te pide crear un **PIN de 4 a 8 digitos**
3. Este PIN protege las credenciales de los portales judiciales que guardes
4. **Importante**: Recordá tu PIN. Si lo olvidás, vas a tener que volver a configurar tus credenciales

### Paso 2: Guardar credenciales de portales

1. El asistente te pide las credenciales de los portales que uses
2. Ingresá tu usuario y clave de los portales que uses
3. Las credenciales se guardan **encriptadas** en tu computadora — nunca se envian a ningun servidor

---

## 4. Configurar credenciales de portales

Si no configuraste tus credenciales en el asistente inicial, o querés cambiarlas:

1. Hacé click derecho en el icono de ProcuAsist → **"Opciones"**
2. O navegá a la seccion **Credenciales** en la pagina de opciones
3. Ingresá tu PIN para desbloquear
4. Completá usuario y clave para cada portal que uses:
   - **MEV / SCBA**: Tu usuario y clave de mev.scba.gov.ar
   - **PJN**: Tu usuario y clave del SSO del Poder Judicial de la Nacion
   - **JUSCABA / EJE**: Tu usuario y clave de eje.jus.gov.ar
5. Hacé click en **"Guardar"**

### Seguridad de tus credenciales

- Se encriptan con cifrado militar (AES-256-GCM) en tu computadora
- Solo se desencriptan con tu PIN
- Nunca se envian a internet ni se almacenan en texto plano
- Si cerras Chrome, al volver se te pide el PIN para desbloquear

---

## 5. Auto-login en portales

Una vez que tus credenciales estan guardadas y el PIN esta desbloqueado:

### Como funciona

1. Navegá a cualquier portal soportado (ej: mev.scba.gov.ar)
2. ProcuAsist detecta la pagina de login automaticamente
3. Completa usuario, clave y departamento judicial por vos
4. Hace click en "Ingresar" automaticamente
5. En MEV, tambien selecciona tu departamento judicial preferido en la pantalla post-login

### Keep-alive (sesion activa)

- ProcuAsist mantiene tu sesion activa en segundo plano
- Envia un "ping" periodico al portal para que no te desconecte
- Podes dejar la pestaña del portal abierta horas sin perder la sesion

### Reconexion automatica

- Si la sesion expira de todas formas (por ejemplo, por mantenimiento del servidor):
  1. ProcuAsist detecta que fuiste redirigido al login
  2. Se vuelve a logear automaticamente
  3. Te lleva de vuelta a la pagina donde estabas trabajando

---

## 6. El panel lateral (Side Panel)

El panel lateral es el **dashboard principal** de ProcuAsist. Para abrirlo:

- Hacé click en el icono del cohete que aparece en los portales judiciales
- O hacé click en el icono de ProcuAsist en la barra de extensiones

### Secciones del panel lateral

El panel tiene tres pestañas:

1. **Marcadores** — Tus causas guardadas, con buscador
2. **Monitores** — Causas que estas siguiendo, con alertas de movimientos
3. **Configuracion** — Acceso rapido a opciones

---

## 7. Marcadores de causas

Los marcadores te permiten guardar causas para acceder rapido sin buscarlas cada vez.

### Agregar un marcador

**Desde el portal:**
1. Navegá a la pagina de una causa en MEV (procesales.asp)
2. ProcuAsist detecta los datos automaticamente
3. Hacé click en el boton **"⭐ Guardar"** que aparece en la pagina

### Ver marcadores

1. Abri el panel lateral
2. Pestaña **"Marcadores"**
3. Podes buscar por numero de causa, caratula o juzgado

### Eliminar un marcador

1. En la lista de marcadores, busca la causa
2. Hacé click en el boton de eliminar (icono de papelera)

No hay limite de marcadores — podes guardar todas las causas que necesites.

---

## 8. Monitoreo de causas y alertas

El monitoreo te avisa automaticamente cuando hay movimientos nuevos en una causa.

### Activar monitoreo en una causa

1. Navegá a la pagina de la causa en el portal
2. Hacé click en **"👁 Monitorear"**
3. ProcuAsist va a revisar periodicamente si hay movimientos nuevos

### Como funcionan las alertas

- ProcuAsist escanea tus causas monitoreadas en segundo plano
- Si detecta un movimiento nuevo que no estaba antes, te manda una **notificacion de Chrome**
- La notificacion aparece en la esquina de tu pantalla aunque estes en otra pagina
- Las alertas no leidas se muestran en el panel lateral con un contador

### Ver alertas

1. Abri el panel lateral
2. Pestaña **"Monitores"**
3. Las alertas no leidas aparecen resaltadas
4. Hacé click en una alerta para marcarla como leida
5. Podes **"Marcar todas como leidas"** con un boton

### Pausar o eliminar un monitor

- **Pausar**: Hacé click en el boton de pausa. El monitor se desactiva pero no se borra.
- **Eliminar**: Hacé click en el boton de eliminar para dejar de monitorear la causa.

### Escaneo manual

Si no queres esperar al escaneo automatico, podes forzar un escaneo haciendo click en **"Escanear ahora"** en la pestaña de monitores.

---

## 9. Descargar el expediente completo (ZIP)

Esta es la funcion principal de ProcuAsist para MEV. Genera un archivo ZIP con todos los documentos del expediente.

### Como descargarlo

1. Navegá a la pagina de una causa en MEV (procesales.asp)
2. ProcuAsist extrae los datos automaticamente
3. Hacé click en el boton **"📦 ZIP"** que aparece en la esquina inferior derecha de la pantalla

### Seleccionar qué pasos descargar

Al hacer click en ZIP, aparece una pantalla de seleccion:

- Todos los pasos procesales aparecen listados con su fecha, fojas y descripcion
- Por defecto estan **todos seleccionados** — podes desmarcar los que no queres
- Botones "Seleccionar todos" y "Deseleccionar todos" para mayor comodidad
- El boton "Descargar seleccionados (N)" muestra cuantos pasos vas a descargar
- Si no seleccionas ninguno y das Cancelar, no se descarga nada

### Progreso de la descarga

Una vez que confirmaste la seleccion:
- Aparece una barra de progreso en pantalla
- Se va mostrando en que paso esta la descarga ("Descargando documento 3 de 7...")
- Esto puede tardar varios minutos segun el tamaño del expediente y la velocidad del portal

### Que contiene el ZIP

```
expediente_AL-12345-2025.zip
└── AL-12345-2025_expte_completo/
    ├── resumen.pdf                                      ← Tabla con todos los movimientos
    ├── 001_fs-1-3_fecha_29-12-2025_AUTOS.pdf           ← PDF de cada paso seleccionado
    ├── 002_fs-4-15_fecha_29-12-2025_INTERLOCUTORIO.pdf
    ├── 003_fs-29-36_fecha_04-02-2026_RECURSO_DE_APELACION.pdf
    ├── 003_..._adjunto_1.pdf                           ← Adjuntos del paso
    └── _verificacion.txt                               ← Solo aparece si hubo errores
```

**Nombre de cada archivo:** numero de orden + fojas + fecha + descripcion del tramite

### Contenido de cada PDF de paso procesal

Cada PDF incluye toda la informacion del proveido:
- **Juzgado** y departamento
- **Datos del expediente**: caratula, fecha inicio, numero de receptoria, numero de expediente, estado
- **Informacion del paso**: fecha, tipo de tramite, si esta firmado, numero de fojas
- **Referencias**: adjuntos con links clickables (hacé click en el PDF para abrir el documento original), despacho y observaciones
- **Datos de presentacion**: fecha del escrito, quien firmo, numero de presentacion electronica
- **Texto completo del proveido**

### Si hubo errores en la descarga

- El boton ZIP se pone en **amarillo** (en vez de verde) cuando el ZIP se genero pero con algun error
- Aparece un cuadro en pantalla con el detalle de que archivos fallaron y por que
- Dentro del ZIP aparece un archivo `_verificacion.txt` con el mismo detalle
- El error mas comun es que el servidor del portal no responde — podes intentar descargar de vuelta

### Adjuntos que no se descargan

Los adjuntos (VER ADJUNTO) se obtienen del servidor `docs.scba.gov.ar`, que a veces es lento o da error. ProcuAsist intenta varias veces antes de darse por vencido. Si igual falla:
- Se genera un archivo `_adjunto_X_ERROR.txt` explicando el error
- El resto del expediente se descarga igualmente
- Podes abrir el link del adjunto desde el PDF del paso procesal (es un hipervínculo clickable)

---

## 10. Importar causas en lote

Si tenes muchas causas en los resultados de busqueda del portal:

1. Realiza una busqueda en el portal (ej: buscar por set o por organismo)
2. ProcuAsist detecta todos los resultados
3. En el panel lateral aparece la opcion **"Importar todas"**
4. Se agregan como marcadores todas las causas de los resultados

---

## 11. Modo oscuro

ProcuAsist incluye un modo oscuro que se aplica a los paneles de la extension.

### Activar/desactivar

1. En el panel lateral → pestaña **"Configuracion"**
2. Activar o desactivar el switch **"Modo oscuro"**

---

## 12. Donaciones

ProcuAsist es **100% gratuito** — todas las funciones estan habilitadas sin limites.

Si te resulta util y queres apoyar el desarrollo, podes invitarme un cafecito desde la seccion de Ajustes en el panel lateral (boton "Invitame un cafecito").

### Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantias de ningun tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso. Usalo como herramienta complementaria, no como unico medio de seguimiento de causas.

---

## 13. Pagina de opciones

Para acceder: click derecho en el icono de ProcuAsist → **"Opciones"**

### Secciones disponibles

- **Credenciales de portales** — Cambiar usuario y clave de MEV/JUSCABA
- **Departamento judicial preferido** — Para MEV, elegir tu departamento (ej: La Plata, Mar del Plata, Avellaneda, etc.)
- **Keep-alive** — Activar/desactivar el mantenimiento de sesion por portal
- **Auto-reconexion** — Activar/desactivar la reconexion automatica
- **Modo oscuro** — Activar/desactivar tema oscuro

---

## 14. Preguntas frecuentes

### Mis credenciales estan seguras?

Si. Las credenciales se encriptan con AES-256-GCM (el mismo cifrado que usan los bancos) y se guardan unicamente en tu computadora. Nunca se envian a internet ni se almacenan en texto plano. Solo se desencriptan momentaneamente cuando ProcuAsist necesita hacer auto-login, y solo si ingresaste tu PIN.

### Que pasa si olvido mi PIN?

Vas a tener que volver a configurar tus credenciales de portales. El PIN no se puede recuperar porque las credenciales encriptadas con el PIN anterior no se pueden desencriptar sin el.

Para resetear:
1. Ir a Opciones
2. Click en "Resetear PIN"
3. Configurar nuevo PIN
4. Volver a ingresar credenciales de portales

### Funciona con otros navegadores?

Por el momento, ProcuAsist funciona unicamente con **Google Chrome** version 120 o superior. Navegadores basados en Chromium (Edge, Brave, Opera) podrian funcionar pero no estan oficialmente soportados.

### El auto-login funciona si Chrome esta cerrado?

No. ProcuAsist necesita que Chrome este abierto para funcionar. El keep-alive y el monitoreo corren como procesos dentro de Chrome.

### Cuantas veces escanea los monitores?

El escaneo automatico se ejecuta periodicamente mientras Chrome este abierto. La frecuencia puede cambiar entre versiones para equilibrar utilidad, estabilidad y carga sobre los portales judiciales. Tambien podes forzar un escaneo manual desde la pestaña Monitores.

### Que portal es el MEV?

MEV es la Mesa de Entradas Virtual de la Suprema Corte de la Provincia de Buenos Aires (SCBA). Es el portal donde se consultan expedientes de la justicia bonaerense. URL: mev.scba.gov.ar

### Por que a veces los adjuntos no se descargan?

El servidor donde estan los adjuntos (docs.scba.gov.ar) es intermitente — a veces no responde en el primer intento. ProcuAsist reintenta automaticamente hasta 7 veces antes de darse por vencido. Si igual falla, el adjunto queda como error en el ZIP pero podes abrirlo manualmente haciendo click en el link dentro del PDF del paso procesal.

### El ZIP tarda mucho en generarse, es normal?

Si, especialmente en expedientes grandes. Por cada paso procesal, ProcuAsist tiene que:
1. Abrir la pagina del proveido en el servidor del portal
2. Convertirla a PDF
3. Descargar cada adjunto

Para un expediente de 20 pasos con adjuntos puede tardar varios minutos. La barra de progreso te muestra en que paso esta.

### Puedo descargar solo algunos pasos y no todos?

Si. Al hacer click en ZIP aparece una pantalla de seleccion donde podes elegir exactamente que pasos descargar. Por defecto estan todos seleccionados.

---

## 15. Solucion de problemas

### El auto-login no funciona

1. **Verificá que el PIN este desbloqueado**: Hacé click en el icono de ProcuAsist. Si pide PIN, ingresalo.
2. **Verificá las credenciales**: Ir a Opciones → Credenciales y confirmar que usuario y clave son correctos.
3. **Verificá que el portal este online**: Abri el portal manualmente. Si el servidor esta caido, ProcuAsist no puede conectarse.
4. **Recargá la pestaña**: A veces un simple F5 en la pestaña del portal resuelve el problema.

### No recibo notificaciones de movimientos

1. **Verificá los permisos de Chrome**: Ir a `chrome://settings/content/notifications` y asegurarse de que las notificaciones estan permitidas.
2. **Verificá que el monitor esta activo**: En el panel lateral → Monitores, confirmá que el monitor no esta pausado.
3. **Forzá un escaneo**: Click en "Escanear ahora" para verificar si hay movimientos nuevos.

### La extension no se ve en Chrome

1. Ir a `chrome://extensions`
2. Verificar que ProcuAsist esta habilitada (switch activado)
3. Si no aparece, reinstalar la extension

### La sesion se desconecta a pesar del keep-alive

Esto puede pasar si:
- El servidor del portal tuvo mantenimiento o reinicio
- Tu conexion a internet se interrumpio
- Chrome estuvo suspendido (laptop en modo sleep)

ProcuAsist intentara reconectarse automaticamente. Si no puede, vas a ver la pagina de login del portal y podes refrescar para que intente de nuevo.

### El boton ZIP se pone amarillo

Significa que la descarga termino pero algunos archivos tuvieron errores. Aparece un cuadro con el detalle. Podes revisar el archivo `_verificacion.txt` dentro del ZIP para ver exactamente que fallo y volver a intentarlo manualmente.

### Chrome se volvio lento

Si notas lentitud:
1. Verificá cuantos monitores activos tenes — muchos monitores generan mas trafico
2. Desactivá el keep-alive de portales que no estes usando (Opciones → Keep-alive)
3. Reiniciá Chrome

---

## Contacto y soporte

Si tenes dudas o problemas que no se resuelven con este manual, contactanos:

- **GitHub**: https://github.com/blancoilari/procu-asist/issues

---

*ProcuAsist v0.6.0 — Copiloto Legal para Abogados Argentinos*
