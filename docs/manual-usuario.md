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
9. [Generar PDF de un expediente](#9-generar-pdf-de-un-expediente)
10. [Descargar adjuntos](#10-descargar-adjuntos)
11. [Importar causas en lote](#11-importar-causas-en-lote)
12. [Modo oscuro](#12-modo-oscuro)
13. [Donaciones](#13-donaciones)
14. [Pagina de opciones](#14-pagina-de-opciones)
15. [Preguntas frecuentes](#15-preguntas-frecuentes)
16. [Solucion de problemas](#16-solucion-de-problemas)

---

## 1. Que es ProcuAsist

ProcuAsist es una extension para Google Chrome que funciona como copiloto legal. Automatiza tareas repetitivas en los portales judiciales de la Provincia de Buenos Aires y Nacion:

- **MEV** (Mesa de Entradas Virtual) — mev.scba.gov.ar
- **EJE** (Poder Judicial de CABA) — eje.juscaba.gob.ar
- **SCBA Notificaciones** — notificaciones.scba.gov.ar

Con ProcuAsist podes:
- Entrar automaticamente a los portales sin escribir usuario y clave cada vez
- Guardar causas como marcadores para acceder rapido
- Recibir notificaciones cuando hay movimientos nuevos en tus causas
- Generar PDFs con los datos del expediente
- Descargar adjuntos de las causas
- Y mucho mas

---

## 2. Instalacion

### Paso 1: Obtener el archivo de la extension

Vas a recibir un archivo `.zip` con la extension. Guardalo en tu computadora (por ejemplo, en el Escritorio).

### Paso 2: Abrir la pagina de extensiones de Chrome

1. Abri Google Chrome
2. En la barra de direcciones, escribi: `chrome://extensions` y presiona Enter
3. En la esquina superior derecha, activa el switch **"Modo desarrollador"**

### Paso 3: Instalar la extension

**Opcion A** — Arrastrar el .zip:
- Arrastra el archivo .zip directamente a la pagina de extensiones

**Opcion B** — Cargar descomprimida:
1. Descomprimí el .zip en una carpeta
2. Hacé click en **"Cargar descomprimida"**
3. Selecciona la carpeta donde descomprimiste la extension

### Paso 4: Verificar la instalacion

- Vas a ver el icono de ProcuAsist en la barra de extensiones de Chrome (arriba a la derecha)
- Si no lo ves, hacé click en el icono de puzzle (extensiones) y fijá ProcuAsist con el pin

---

## 3. Primer uso: Configuracion inicial

La primera vez que abras ProcuAsist, se va a mostrar un **asistente de configuracion** (onboarding) que te guia paso a paso.

### Paso 1: Iniciar sesion con Google

1. Hacé click en el icono de ProcuAsist o abri el panel lateral
2. Se va a mostrar el boton **"Iniciar sesion con Google"**
3. Hacé click y elegí tu cuenta de Google
4. Esto crea tu cuenta en ProcuAsist (no se comparte tu clave de Google)

### Paso 2: Crear tu PIN de seguridad

1. Despues de iniciar sesion, el asistente te pide crear un **PIN de 4 a 8 digitos**
2. Este PIN protege las credenciales de los portales judiciales que guardes
3. **Importante**: Recordá tu PIN. Si lo olvidás, vas a tener que volver a configurar tus credenciales

### Paso 3: Guardar credenciales de portales

1. El asistente te pide las credenciales de los portales que uses
2. Ingresa tu usuario y clave de MEV, EJE, o ambos
3. Las credenciales se guardan **encriptadas** en tu computadora — nunca se envian a ningun servidor

---

## 4. Configurar credenciales de portales

Si no configuraste tus credenciales en el asistente inicial, o queres cambiarlas:

1. Hacé click derecho en el icono de ProcuAsist → **"Opciones"**
2. O navegá a la seccion **Credenciales** en la pagina de opciones
3. Ingresa tu PIN para desbloquear
4. Completa usuario y clave para cada portal que uses:
   - **MEV**: Tu usuario y clave de mev.scba.gov.ar
   - **EJE**: Tu usuario y clave de eje.juscaba.gob.ar
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

1. Navega a cualquier portal soportado (ej: mev.scba.gov.ar)
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

### Barra superior

- Muestra la version de ProcuAsist
- Indicador de alertas no leidas
- Buscador de causas

---

## 7. Marcadores de causas

Los marcadores te permiten guardar causas para acceder rapido sin buscarlas cada vez.

### Agregar un marcador

**Desde el portal:**
1. Navega a la pagina de una causa (ej: procesales.asp en MEV)
2. ProcuAsist detecta los datos automaticamente
3. Hacé click en el boton **"Agregar a marcadores"** que aparece en la pagina

**Desde resultados de busqueda:**
1. Busca causas en el portal normalmente
2. En los resultados, cada causa tiene un boton para marcarla

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

1. Navega a la pagina de la causa en el portal
2. Hacé click en **"Monitorear esta causa"**
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

## 9. Generar PDF de un expediente

Podes generar un PDF con los datos de una causa: caratula, juzgado, numero, estado, y la lista de movimientos.

### Como generar un PDF

1. Navega a la pagina de la causa en el portal
2. ProcuAsist extrae los datos automaticamente
3. En el panel lateral, hacé click en **"Generar PDF"**
4. El PDF se descarga automaticamente en tu carpeta de descargas

### Contenido del PDF

- Numero de causa y caratula
- Juzgado y fuero
- Estado del expediente
- Fecha de inicio
- Lista completa de movimientos con fecha y descripcion
- Fecha de generacion del PDF

No hay limite en la generacion de PDFs.

---

## 10. Descargar adjuntos

Cuando una causa tiene documentos adjuntos (escritos, cedulas, resoluciones):

1. Navega a la pagina del movimiento que tiene adjuntos
2. ProcuAsist detecta los links de "VER ADJUNTO"
3. Podes descargar los adjuntos directamente desde el panel lateral

---

## 11. Importar causas en lote

Si tenes muchas causas en los resultados de busqueda del portal:

1. Realiza una busqueda en el portal (ej: buscar por set o por organismo)
2. ProcuAsist detecta todos los resultados
3. En el panel lateral aparece la opcion **"Importar todas"**
4. Se agregan como marcadores todas las causas de los resultados

---

## 12. Modo oscuro

ProcuAsist incluye un modo oscuro que se aplica tanto a los paneles de la extension como a las paginas de los portales judiciales.

### Activar/desactivar

1. Ir a **Opciones** (click derecho en icono → Opciones)
2. Buscar la opcion **"Modo oscuro"**
3. Activar o desactivar el switch

Cuando esta activado:
- El panel lateral, popup y opciones usan colores oscuros
- Las paginas de MEV, EJE y SCBA tambien se oscurecen para reducir la fatiga visual

---

## 13. Donaciones

ProcuAsist es **100% gratuito** — todas las funciones estan habilitadas sin limites.

Si te resulta util y queres apoyar el desarrollo, podes invitarme un cafecito desde la seccion de Ajustes en el panel lateral (boton "Invitame un cafecito").

### Disclaimer

ProcuAsist se ofrece "tal cual" (as is), sin garantias de ningun tipo. No reemplaza el control manual de actuaciones judiciales. El autor no es responsable por daños directos o indirectos derivados de su uso. Usalo como herramienta complementaria, no como unico medio de seguimiento de causas.

---

## 14. Pagina de opciones

Para acceder: click derecho en el icono de ProcuAsist → **"Opciones"**

### Secciones disponibles

- **Credenciales de portales** — Cambiar usuario y clave de MEV/EJE
- **Departamento judicial preferido** — Para MEV, elegir tu departamento (ej: La Plata, Mar del Plata, Avellaneda, etc.)
- **Keep-alive** — Activar/desactivar el mantenimiento de sesion por portal
- **Auto-reconexion** — Activar/desactivar la reconexion automatica
- **Modo oscuro** — Activar/desactivar tema oscuro
- **Cuenta** — Ver tu email y cerrar sesion
- **Sincronizacion** — Forzar una sincronizacion manual con la nube

---

## 15. Preguntas frecuentes

### Mis credenciales estan seguras?

Si. Las credenciales se encriptan con AES-256-GCM (el mismo cifrado que usan los bancos) y se guardan unicamente en tu computadora. Nunca se envian a ningun servidor. Solo se desencriptan momentaneamente cuando ProcuAsist necesita hacer auto-login, y solo si ingresaste tu PIN.

### Que pasa si olvido mi PIN?

Vas a tener que volver a configurar tus credenciales de portales. El PIN no se puede recuperar porque las credenciales encriptadas con el PIN anterior no se pueden desencriptar sin el.

Para resetear:
1. Ir a Opciones
2. Click en "Resetear PIN"
3. Configurar nuevo PIN
4. Volver a ingresar credenciales de portales

### Funciona con otros navegadores?

Por el momento, ProcuAsist funciona unicamente con **Google Chrome** version 120 o superior. Navegadores basados en Chromium (Edge, Brave, Opera) podrian funcionar pero no estan oficialmente soportados.

### Puedo usar ProcuAsist en mas de una computadora?

Si. Inicia sesion con tu misma cuenta de Google en ambas computadoras. Tus marcadores, monitores y configuracion se sincronizan automaticamente via la nube. Las credenciales de portales NO se sincronizan (por seguridad) — vas a tener que configurarlas en cada computadora.

### El auto-login funciona si Chrome esta cerrado?

No. ProcuAsist necesita que Chrome este abierto para funcionar. El keep-alive y el monitoreo corren como procesos dentro de Chrome.

### Cuantas veces escanea los monitores?

El escaneo automatico se ejecuta aproximadamente cada 15 minutos mientras Chrome este abierto.

### Que portal es el MEV?

MEV es la Mesa de Entradas Virtual de la Suprema Corte de la Provincia de Buenos Aires (SCBA). Es el portal donde se consultan expedientes de la justicia bonaerense. URL: mev.scba.gov.ar

### Puedo agregar mas portales?

Por el momento, ProcuAsist soporta MEV (Provincia de Buenos Aires), EJE (CABA) y SCBA Notificaciones. Se planea agregar PJN (Nacion) y mas portales en futuras versiones.

---

## 16. Solucion de problemas

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

### Chrome se volvio lento

Si notas lentitud:
1. Verificá cuantos monitores activos tenes — muchos monitores generan mas trafico
2. Desactivá el keep-alive de portales que no estes usando (Opciones → Keep-alive)
3. Reiniciá Chrome

---

## Contacto y soporte

Si tenes dudas o problemas que no se resuelven con este manual, contactanos:

- **Email**: [configurar email de soporte]
- **GitHub**: https://github.com/blancoilari/procu-asist/issues

---

*ProcuAsist v0.2.0 — Copiloto Legal para Abogados Argentinos*
