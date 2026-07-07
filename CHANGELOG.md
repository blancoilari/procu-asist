# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

## [0.7.0] - 2026-06-12

(publicada en Chrome Web Store: enviada a revision el 2026-07-02, aprobada el 2026-07-05)

Consolida las versiones internas 0.6.7, 0.6.8 y 0.6.9. La 0.6.7 se publico en la Store como snapshot el 2026-05-28; la 0.6.8, la 0.6.9 y la 0.7.0 no se publicaron.

### Importar todo, escaneo por sets y restablecer PIN (0.7.0)

- Asistente "Importar todo" en la vista Causas: detecta que portales tienen sesion activa, estima los listados PJN (relacionados y favoritos) por paginador y enumera los sets de busqueda MEV (los sets se cuentan al importar). Checkboxes por fuente, ejecucion con progreso por fuente, boton cancelar que corta limpio y resumen final (importadas, duplicadas salteadas, errores). La recoleccion PJN usa un tope de paginas elevado con pausas de cortesia entre paginas; los sets MEV se recorren con el flujo multi-departamento existente.
- Umbral anti-ruido configurable en Ajustes (`Umbral de pausa al importar en masa`, default 50): si una corrida del asistente importa mas causas nuevas que el umbral, entran guardadas con avisos pausados y el usuario activa el monitoreo solo de las que le interesan. La consecuencia se muestra en el propio asistente antes de ejecutar.
- Escaneo rapido MEV por novedades de set (beta, activable en Ajustes, DEFAULT DESACTIVADO): cuando se activa, el escaneo automatico consulta la busqueda "novedades de set por fecha" de la MEV en una sola pasada y solo re-lee las causas que se movieron; las causas que no estan en ningun set siguen con el escaneo causa por causa. Ante cualquier falla cae solo al escaneo completo; ademas hay un barrido completo diario de respaldo y el boton "Escanear ahora" siempre revisa todo. Queda desactivado por defecto porque depende del form de novedades de la MEV, que no se verifico a fondo en vivo; el escaneo causa por causa (confiable) es el default.
- Restablecer PIN: nuevo flujo en Configuracion avanzada > Credenciales con doble confirmacion. Borra el PIN y las credenciales guardadas (sin el PIN viejo son indescifrables: con AES-GCM no hay recuperacion posible) y deja la extension lista para configurar un PIN nuevo. Marcadores, monitores, alertas y plazos no se tocan.

### Causas unificadas: marcador = monitoreo (0.7.0)

- Una sola pestana "Causas" reemplaza a Marcadores y Monitoreo, con sub-vistas Causas (lista unificada) y Alertas (agrupadas por causa).
- Tarjeta de causa unificada: badge NOVEDAD, estado de avisos (activos, pausados o "sin escaneo" para causas MEV sin IDs internos), ultimo movimiento y un solo menu (abrir, copiar caratula, pausar/reanudar avisos, eliminar causa).
- Guardar una causa siempre la monitorea; se quito el toggle "Monitorear al guardar" agregado en 0.6.9, que nunca llego a publicarse. La pausa por causa sigue disponible.
- Eliminar una causa borra marcador, monitor y alertas en cascada.
- Conciliacion al iniciar: los marcadores existentes ganan su monitor y los monitores huerfanos su marcador, para que los datos previos converjan solos al modelo unificado.
- Onboarding actualizado ("guardar = monitorear").
- Paginacion PJN por links numerados: cuando el paginador del SCW muestra solo numeros de pagina (sin flecha "siguiente"), la recoleccion detecta la pagina activa y avanza al numero siguiente; alcanza a la importacion de listados, la apertura de causas y las notas masivas, y los modales avisan si la recoleccion corto por el tope de paginas.
- Encabezados fijos al scrollear en Causas y Alertas: las sub-pestanas y sus barras de accion quedan siempre visibles en el panel; solo scrollea la lista de tarjetas.

### Importacion completa y alertas por causa (0.6.9)

- Importacion de sets MEV que abarcan varios departamentos judiciales: dialogo para elegir "solo este departamento" o "todos", con recorrido departamento por departamento y organismo por organismo, sin trabarse en organismos o paginas sin resultados.
- Guardar un marcador agrega la causa al monitoreo; la importacion masiva tambien monitorea causas PJN, no solo MEV.
- Alertas agrupadas por expediente: una tarjeta por causa con su ultimo movimiento y badge NOVEDAD; click abre la causa y la marca leida completa. Todos los contadores cuentan expedientes con novedades, no movimientos sueltos.
- Importacion PJN multi-pagina arreglada: soporte del paginador RichFaces del SCW (botones como celdas con onclick, distincion entre "siguiente" y "ultima pagina", espera de re-render ampliada) y el modal informa cuantas paginas recolecto.

### Plazos, backup y monitoreo por fecha (0.6.8)

- Nueva pestana "Plazos" en el sidepanel: calculadora de plazos procesales en dias habiles judiciales (fines de semana, feriados nacionales 2026-2027 y ferias o dias inhabiles personalizables), plazo de gracia informado, lista de vencimientos con badges de urgencia y alarma de fondo que notifica 3 dias antes, el dia del vencimiento y al vencer.
- Export a calendario: boton "Exportar a calendario (.ics)" con los plazos pendientes como eventos de dia completo y alarma un dia antes.
- Backup y restauracion: exportar e importar marcadores, monitores, alertas, plazos y preferencias a JSON desde Ajustes. El material sensible (credenciales y PIN) nunca se incluye; importar es merge.
- Monitoreo por fecha: los movimientos nuevos se detectan por fecha posterior a la ultima conocida (con fallback por conteo para altas del mismo dia) en vez de comparar totales.
- Paginacion MEV: "Importar" en resultados recorre todas las paginas (hasta 15) antes del modal de seleccion.
- Descargas PJN: timeout de 45 segundos por documento y boton "Cancelar descarga" activo durante la generacion.

### Base 0.6.7 y correcciones de auditoria (snapshot publicado en la Store el 2026-05-28)

- Login persistente gateado por toggle, el monitoreo PJN abre el expediente, descarga en PDF unico, "importar todos" y EJE oculto de la UI.
- La alarma de escaneo ya no se reinicia en cada arranque del navegador; token PJN espejado en storage.session (sobrevive reinicios del service worker); baseline de movimientos protegido contra parseos vacios.
- Auto-login con limite de reintentos en MEV y en Keycloak/SSO PJN; configurar el PIN no re-clavea el vault si ya hay credenciales guardadas.
- PDFs: parrafos multi-pagina, box de metadata sin solapamientos y pagina de verificacion de errores en el modo "Un PDF" (MEV y PJN); conversiones base64 por bloques para no congelar el service worker.
- Boton "Abrir Panel Lateral" del popup funcionando, dark mode en opciones, spinners sin colgarse y ZIP MEV con nombres numerados sin colisiones.
- Codigo muerto eliminado: scanners PJN legacy, documento offscreen y su permiso, y helpers sin uso.

## [0.6.3] - 2026-05-08

### Ajuste validado de notas PJN

- Acciones `Dejar nota` y `Dejar notas` visibles solo martes/viernes.
- El flujo individual abre el modal oficial de PJN y no confirma automaticamente.
- El preview masivo de PJN cruza marcadores, excluye causas `EN LETRA` y prepara la seleccion sin ejecutar notas automaticas.
- QA manual validado en PJN/SCW real el 2026-05-08.

## [0.6.2] - 2026-04-29

### Reempaquetado para Chrome Web Store

- Incremento de version para poder enviar a revision el paquete estabilizado posterior a la publicacion de `0.6.1`.
- Sin cambios funcionales adicionales respecto del paquete QA ya validado.

## [0.6.1] - 2026-04-27

### Estabilizacion publica gratuita

- Unificacion visual de botones flotantes en MEV, PJN y EJE.
- Importacion completa de sets de busqueda MEV, recorriendo organismos del set.
- Monitoreo automatico de causas MEV enriquecidas con `nidCausa` y `pidJuzgado`.
- Busqueda de movimientos desde una fecha indicada sobre causas monitoreadas.
- Importacion desde resultados y sets de busqueda MEV como fuente principal de Provincia.
- Importacion de listados PJN/SCW como marcadores, con filtros por portal en el panel.
- Monitoreo PJN inicial desde feed del portal cuando hay token disponible y respaldo por listados SCW paginados.
- Alertas enriquecidas con portal, numero, caratula y juzgado.
- Se deja fuera de alcance `notificaciones.scba.gov.ar` en la version gratuita porque usa otro login y puede no coincidir temporalmente con MEV.
- Eliminada la seccion vieja de Cuenta/sync en opciones.
- Reemplazado el icono inicial del onboarding por la balanza de ProcuAsist.
- Mejoras de mensajes en el panel lateral para mantener el flujo MEV/PJN mas claro.
- Checklist QA y materiales de publicacion para preparar la actualizacion en Chrome Web Store.

## [0.6.0] - 2026-04-23

### Soporte para Poder Judicial de la Nación (PJN)

**Auto-login compartido y catálogo**
- Auto-login contra Keycloak SSO (`sso.pjn.gov.ar`): una sola ventana de login deja la sesión activa para todos los subsistemas PJN
- Cliente de la API REST `api.pjn.gov.ar` con captura automática del token JWT del portal — feed de novedades disponible
- Lectura del listado de causas en `scw.pjn.gov.ar`: Relacionados (letrado/parte) y Favoritos
- Parser del detalle del expediente: datos generales + 4 pestañas (Actuaciones, Intervinientes, Vinculados, Recursos)

**Descarga de expedientes PJN — ZIP completo**
- Nuevo botón flotante "Descargar ZIP" en las páginas de expediente y actuaciones históricas de scw.pjn.gov.ar
- Modal de selección: tabla completa de actuaciones con checkbox por fila, atajos "Seleccionar visibles / Ninguna / Solo con documento"
- Filtros por categoría nativa del portal: Despachos/Escritos, Notificaciones, Información, más atajo "Ver todos"
- Paginación automática del listado de actuaciones (soporta expedientes con cientos de pasos procesales)
- Auto-importación de actuaciones históricas vía fetch same-origin cuando el link directo está disponible; si es un botón JSF, muestra un aviso para navegar manualmente a "Ver históricas"
- ZIP generado incluye: `resumen.pdf` (datos generales + tabla completa de actuaciones) y un PDF por actuación seleccionada con formato `fs-{foja}_{YYYY-MM-DD}_{descripcion}.pdf` (consistente con MEV)
- `_verificacion.txt` con detalle de errores si alguna descarga individual falló

**Novedades del flujo**
- El FAB aparece tanto en `expediente.seam` como en `actuacionesHistoricas.seam`
- Selección "efectiva" = marca manual ∩ categorías visibles, para que filtrar una categoría excluya sus filas del ZIP sin destruir marcas manuales en otras categorías

## [0.4.0] - 2026-04-17

### Primera versión publicada en Chrome Web Store

**Comunidad y feedback**
- Mensaje de autoría visible en Onboarding y en Ajustes: hecho por un abogado de la matrícula, para colegas, gratis y sin fines de lucro
- Nuevos botones en Ajustes y popup: "Reportar error o sugerencia" (mailto) e "Issues en GitHub"
- Cafecito disponible también en el popup, no solo en el sidepanel

**Documentación pública**
- Nuevo `ROADMAP.md` orientado a colegas: hoja de ruta hasta v1.0.0 en lenguaje no técnico
- Nuevo `PRIVACY.md` con política de privacidad detallada (requerida para Chrome Web Store)
- Sección "Para abogados" agregada al inicio del README
- Fix: URL correcta de JUSCABA en el README (`eje.jus.gov.ar`)

**Limpieza interna**
- Removido módulo Supabase completo (auth, sync, OAuth, client) — la extensión es 100% local
- Removido permission `identity` y host de Supabase del manifest
- Renombrados content scripts a la convención WXT `*.content.ts`
- Rebrand consistente: EJE → JUSCABA en toda la UI y documentación

**MEV — mejoras menores**
- Columna "Fojas" agregada al PDF resumen y al parser de movimientos
- Selector de "Departamento Judicial" en formulario de auto-login
- `docs.scba.gov.ar` agregado a host_permissions (necesario para descarga de adjuntos)
- Fix cosmético en generador de PDF: cálculo de ancho de columnas
- Auto-reconexión silenciosa cuando el vault está bloqueado (sin spam de notificaciones)

## [0.3.0] - 2026-04-15

### Mejoras en descarga de expedientes (MEV)

**Descarga ZIP — contenido enriquecido**
- El PDF de cada paso procesal ahora incluye todos los metadatos del proveido: juzgado, datos del expediente (carátula, fecha inicio, receptoría, estado), info del paso procesal (trámite, firmado, fojas), sección REFERENCIAS con adjuntos, sección DATOS DE PRESENTACIÓN, y el texto del proveido con título de sección
- Los adjuntos (VER ADJUNTO) en el PDF del paso son hipervínculos clickables que abren el documento original
- Estructura del ZIP reorganizada: `resumen.pdf` ahora va dentro de la carpeta `_expte_completo`, se eliminó `urls_documentos.txt`
- Nomenclatura de archivos mejorada: `001_fs-29-36_fecha_04-02-2026_DESC.pdf` (incluye fojas y prefijo "fecha")

**Selección de pasos procesales**
- Al hacer click en el botón ZIP se muestra un modal de selección
- El usuario puede elegir qué pasos procesales descargar (por defecto todos seleccionados)
- Botones "Seleccionar todos" y "Deseleccionar todos"

**Confiabilidad en descarga de adjuntos**
- Reintentos con backoff exponencial: hasta 7 intentos para docs.scba.gov.ar, 3 para mev.scba.gov.ar
- Detección de páginas de error HTML servidas en lugar del archivo real
- Validación de tamaño mínimo para evitar guardar respuestas vacías

**Verificación post-descarga**
- Si algún archivo falla, se genera `_verificacion.txt` dentro del ZIP con detalle de cada error
- Se muestra un overlay visual en pantalla con el resumen de fallos
- El botón ZIP cambia a amarillo cuando el ZIP se completó pero con errores

**Simplificación de interfaz**
- Eliminado el botón "📄 PDF" — solo existe "📦 ZIP" que descarga el expediente completo

## [0.2.0] - 2026-04-01

### ProcuAsist ahora es gratuito

- Eliminado sistema de planes pagos (Free/Junior/Senior) — todas las funciones sin limites
- Eliminada integracion con MercadoPago (checkout y webhook)
- Agregado boton "Invitame un cafecito" para donaciones voluntarias
- Agregado disclaimer legal en ajustes y en el onboarding
- Agregado paso de aceptacion de terminos de uso en el onboarding

## [0.1.0] - 2026-03-31

### Primera version

**Infraestructura**
- Scaffolding con WXT 0.20 + React 19 + TypeScript 5.9 + Tailwind CSS v4
- Configuracion de Supabase (Auth, PostgreSQL, RLS)
- Integracion con Google OAuth via Supabase Auth

**Seguridad**
- Encriptacion AES-GCM de credenciales de portales
- Derivacion de clave con PBKDF2 (100,000 iteraciones) desde PIN del usuario
- Vault en memoria que se bloquea al reiniciar el service worker

**Portales judiciales**
- Content script para MEV (Mesa de Entradas Virtual - SCBA)
  - Auto-login, seleccion de departamento, extraccion de causas y movimientos
- Content script para JUSCABA (Poder Judicial de CABA)
  - Auto-login, extraccion de causas

**Gestion de sesion**
- Keep-alive automatico para evitar expiracion de sesion
- Deteccion de sesion expirada via MutationObserver y URL
- Auto-reconexion con navegacion de vuelta a la pagina anterior

**Gestion de causas**
- Marcadores con busqueda, reordenamiento y persistencia local
- Monitoreo de causas con alarmas periodicas
- Alertas de movimientos nuevos con notificaciones push de Chrome
- Generacion de PDF con datos del expediente
- Descarga de adjuntos desde portales
- Importacion masiva desde resultados de busqueda

**Sincronizacion**
- Sync bidireccional (push/pull) de marcadores, monitores, alertas y settings
- Estrategia local-first con chrome.storage.local como fuente de verdad

**UI**
- Side panel como dashboard principal
- Popup con acceso rapido
- Pagina de opciones para configuracion
- Onboarding wizard para nuevos usuarios
- Modo oscuro en toda la extension y paginas de portales
- Iconos personalizados (16px a 128px)
