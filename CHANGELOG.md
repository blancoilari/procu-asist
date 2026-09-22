# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

## [Sin version] - 2026-09-22

Descarga confiable frente al límite de pedidos de la MEV.

### Síntoma

- La descarga completa de un expediente de 225 proveídos terminó con 109 documentos salteados, en dos tandas seguidas, con el error "La MEV devolvió una página que no es la del proveído".

### Causa, medida contra el portal con sesión real

- La MEV tiene un nginx delante de su sistema con un límite de unos 30 pedidos de proveídos por minuto. Pasado el límite, toda página responde con la pantalla "Validando acceso..." (Cloudflare Turnstile, HTTP 200, misma dirección, 2.000 bytes y sin texto visible en el cuerpo).
- La detección del 09/09/2026 buscaba las frases en el texto visible, vacío en esta pantalla: la tomaba por página inesperada, salteaba el documento y seguía pidiendo cada 0,3 s, lo que alargaba el bloqueo.
- Además, toda la descarga corría dentro de un único mensaje, y Chrome termina el proceso de fondo cuando un mensaje tarda más de 5 minutos: una descarga que respete el límite lo supera en un expediente grande.

### Cambios

- Portero de pedidos (`modules/portals/mev-pacer.ts`): 20 por minuto, de a uno, con esperas ante un bloqueo de 30 s, 1, 2 y 4 minutos.
- Clasificación de respuestas (`modules/portals/mev-challenge.ts`): la pantalla se reconoce por su título y su script; se distinguen además el login, la búsqueda en vez del proveído y la página desconocida.
- Recorrido de la descarga (`modules/pdf/mev-download-runner.ts`, puro y probado): ante un bloqueo pregunta y reintenta el mismo documento; nunca lo saltea. Si la MEV devuelve la búsqueda, reingresa una vez a la ficha. Otra página: reintenta una vez y la anota con lo que devolvió la MEV.
- La descarga corre detrás de un canal `chrome.runtime.connect` (`entrypoints/background/mev-download-job.ts`) y usa la pestaña desde la que se pidió. Salen los mensajes `GENERATE_ZIP` y `DOWNLOAD_ATTACHMENT` (este último no tenía quien lo mandara).
- Pantalla nueva en la pestaña (`modules/ui/mev-download-ui.ts`): progreso real con tiempo estimado, botón Detener, aviso de pausa con "Esperar y seguir", "Detener y guardar lo bajado" y "Cancelar sin guardar", aviso de sesión cerrada, y resumen final con "Bajar los que faltan". Los textos nuevos no usan rayas largas.
- Nombres de archivo por fecha (`modules/pdf/file-naming.ts`): `AAAA-MM-DD_fs-X_DESCRIPCION`, con sufijo `_2` estable si dos coinciden y tildes y eñe a su letra base. Antes el número inicial era la posición dentro de lo tildado y volvía a 001 en cada descarga.
- El `resumen.pdf` lista toda la ficha y el informe pasa a `_verificacion_AAAA-MM-DD_HHMM.txt`, con cada faltante por nombre de archivo, paso, motivo y lo que devolvió la MEV.
- Durante una descarga, el escaneo automático no consulta la MEV (se repite al terminar) y el keep-alive no se manda.
- El content script no hace nada sobre la pantalla de verificación: un recorrido de importación ya no la toma por una página vacía.
- `package-lock.json`: una entrada sin versión de un binario opcional de rolldown rompía `npm ci` con npm 11; npm la regeneró con su versión e integridad.

### Ajustes de la revisión de código (mismo día)

- El service worker se mantiene vivo con una llamada a la API cada 20 s durante toda la descarga: las pausas, las cuentas regresivas y el armado del archivo no mandan mensajes, y que un mensaje enviado desde el service worker reinicie el contador de inactividad no está garantizado.
- Un bloqueo al reingresar a la ficha ya no pierde el documento: después de la espera se vuelve a reingresar.
- Solo el escaneo automático se posterga por una descarga; "Escanear ahora" y "desde fecha" corren siempre (posponerlos en silencio los hacía decir "sin novedades" sin haber leído la MEV).
- Aviso del sistema en cada pausa, que trae la pestaña al frente; el texto de la pausa aclara que no pasa nada hasta elegir.
- "Saltear este documento" desde el segundo bloqueo seguido del mismo documento.
- "Cancelar sin guardar" se respeta aunque llegue al final; "Detener" desaparece durante el armado del archivo.
- El login y la búsqueda se reconocen antes que las frases sueltas; HTTP 429 y 503 cuentan como bloqueo; tiempos máximos en todos los pedidos.
- Colisiones de nombres sin distinguir mayúsculas; el archivo de salida lleva fecha y hora.
- Los faltantes ya no dejan un `_ERROR.txt` cada uno: el informe fechado los lista todos.

### Verificación

- `npm test`: 60 casos (portero, nombres, clasificación, informe y recorrido), sin datos reales.
- `npm run compile`, `npm run build` y `npm run zip` en verde.
- Pendiente: la prueba real con la MEV (descarga completa de un expediente grande, descarga parcial que encaje en la carpeta, pausa forzada). Hasta esa prueba, la descarga confiable no está verificada contra el portal.

### Sin medir

- Si los pedidos a la ficha y a los adjuntos cuentan para el límite, si el límite va por usuario o por conexión, y si pasar la verificación a mano acorta el bloqueo.

## [Sin version] - 2026-09-09

Dos cambios sobre la descarga de expedientes: cortar cuando la MEV interpone su pantalla de verificacion, y sacarle la marca al PDF que baja el usuario.

### La descarga se detiene si la MEV pide verificacion

- Sintoma: el expediente baja y el PDF sale sin los despachos. Hipotesis (leyendo el codigo, sin poder probar contra el portal): la pantalla intermedia "Validando acceso" se sirve con HTTP 200, asi que `fetchMevPageContent` la toma por buena (`resp.ok` da true), el parser no encuentra ningun campo y el documento se arma vacio. El punto exacto es `modules/pdf/attachment-downloader.ts`: el `fetch(pageUrl, { credentials: 'include' })` que corre en el mundo MAIN de la pestaña de la MEV.
- Nuevo `modules/portals/mev-challenge.ts`: modulo puro (sin chrome.*, sin DOM) que juzga una respuesta a partir de una sonda (largo del HTML, muestra acotada del texto visible y presencia de las marcas estructurales de un proveido). Deteccion angosta y con red de seguridad: una pagina con estructura de proveido nunca se marca, aunque su texto contenga alguna de las frases buscadas.
- `fetchMevPageContent` devuelve `challenge: true` cuando la respuesta no es el proveido, y `generateCaseZip` aborta la descarga entera sin dejar archivo. Un documento incompleto con apariencia de completo es peor que un error.
- **Solo el desafio corta la descarga entera.** `fetchMevPageContent` marca `challenge` unicamente cuando el veredicto es `desafio`,
  que es del portal y va a afectar a todos los pedidos. Una `respuesta-inesperada` (un proveido con otro formato, un error puntual)
  es de ESE documento: se cuenta como falla suya, queda su `_ERROR.txt` y el resto del expediente se baja igual. Antes cortaba todo
  por uno solo y le atribuia la causa a una verificacion que podia no existir. El mensaje al usuario se reescribio en consecuencia.
- La descarga de adjuntos corta igual cuando la respuesta es HTML con la frase de verificacion, y no gasta los tres reintentos contra un portal que ya esta filtrando.
- El escaneo del monitoreo (`case-monitor.ts`) deja de leer una pantalla de verificacion como "causa sin novedades": si no se parseo ningun movimiento y el HTML trae la frase, avisa por notificacion (como maximo una vez por hora) y cuenta el escaneo como error. Ademas corta el resto del barrido MEV de esa corrida (`skippedByChallenge` en el resultado del escaneo): seguir causa por causa contra un portal que esta filtrando solo suma pedidos y todas iban a fallar igual.
- Quedan sin cubrir la busqueda de causas en la MEV y la importacion masiva, que siguen distinguiendo solo la pantalla de login. Esta escrito en el README con lo que degradan en cada caso.
- En la MEV, la pantalla muestra un aviso explicando que hay que resolver la verificacion en la pestaña y volver a intentar.
- Tests: `npm test` (runner de node, sin dependencias nuevas), `tests/mev-challenge.test.ts`. Los HTML de muestra son inventados.
- Lo que queda sin verificar (no hay sesion ni forma de probarlo sin el portal): si el HTML servido contiene los mismos textos que se ven en pantalla, si la pantalla aparece siempre o por rafagas, y si resolver la verificacion deja una cookie que sirva para los `fetch` de la extension. El camino de salida (navegar la pestaña y leer el DOM en vez de hacer `fetch`) queda diseñado y escrito en el README, sin implementar.

### El PDF descargado sale sin marca

- Se van la barra azul con "ProcuAsist", la insignia de portal, el color corporativo y el pie con el nombre de la extension, en los tres documentos que genera la descarga: resumen del expediente, PDF por paso procesal e informe de verificacion. Tambien en el resumen de PJN.
- Queda contenido y nada mas, en negro sobre blanco, con grises solo para separar jerarquias: numero de expediente, caratula, juzgado, fechas, estado, receptoria, portal como dato, movimientos, referencias, datos de presentacion y texto del proveido. No hay opcion de configuracion: es el unico formato.
- El generador del PDF de paso procesal salio de `case-zip-generator.ts` a `modules/pdf/proveido-pdf-generator.ts` (mudanza, sin cambios de logica mas alla del diseño): al no depender de chrome.* ni del DOM, el documento se puede generar y mirar fuera del navegador.
- Dos correcciones de legibilidad que aparecieron al revisar el resultado: el ancho de las etiquetas en negrita se media con la fuente ya cambiada a normal, asi que el valor quedaba pegado a los dos puntos; y el titulo de "Documentos del expediente" podia quedar solo al pie de una hoja con la lista empezando en la siguiente.
- REFERENCIAS: un campo cuya etiqueta pasa los 60 mm de ancho ya no se imprime con el valor encima. La sangria del valor estaba topeada en 60 mm mientras la etiqueta se dibujaba entera, asi que las dos cadenas se superponian y ninguna se leia. Ahora, cuando la etiqueta no deja lugar, el valor baja al renglon siguiente y usa todo el ancho.
- El panel de la extension no se toca: el cambio es solo sobre el PDF que se descarga.

## [Sin version] - Mantenimiento 2026-09-08

Limpieza de auditoria, sin cambios de producto.

- Se borro `.env` (566 bytes, credenciales viejas de la integracion Supabase/OAuth abandonada; nunca estuvo trackeado por git, no lo lee ningun codigo vivo).
- Se borraron `apps/procu-estudio/node_modules`, `apps/procu-estudio/.next` y los zips de `.output` anteriores a la 0.8.0 (scaffold de ProcuEstudio, regenerables, ignorados por git).

## [0.8.1] - 2026-09-09

Version de retiro del portal EJE/JusCABA y puesta al dia de dependencias de desarrollo. Sin funciones nuevas.

### Se retira el soporte de EJE / JusCABA

- El soporte era codigo muerto: el manifest pedia permiso de host sobre `https://eje.jus.gov.ar/*`, un dominio que no resuelve, y el portal estaba oculto de la interfaz desde la 0.6.7.
- Sale del manifest el permiso de host `https://eje.jus.gov.ar/*` y ese mismo origen sale de `web_accessible_resources` (queda solo MEV). **Cambiar `host_permissions` obliga a una nueva revision de Chrome Web Store.**
- Se borran `entrypoints/eje.content.ts`, `modules/portals/eje-parser.ts` y `modules/portals/eje-selectors.ts`.
- El auto-login SSO contra Keycloak vivia dentro del content script de EJE y lo compartia con PJN: se conserva en `entrypoints/sso.content.ts`, ahora solo para `https://sso.pjn.gov.ar/*` y siempre con las credenciales de PJN. Los selectores del formulario pasaron a `PJN_SSO` en `modules/portals/pjn-selectors.ts`.
- `PortalId` queda en `'mev' | 'pjn'`. Salen el keep-alive de EJE (URL, alarma y preferencia `keepAliveEje`), el color de portal y las etiquetas de la interfaz.
- Al arrancar, la extension borra la alarma `tl-keepalive-eje` que quedaba registrada en instalaciones viejas (despertaba el service worker cada 4 minutos sin hacer nada) y las credenciales guardadas de ese portal (`tl_cred_eje`), que ya no pueden usarse.
- Las causas guardadas con portal EJE, si alguien las tiene, siguen listandose: la tarjeta usa una etiqueta neutra en vez de romperse. El conciliador marcador=monitoreo sigue sin crearles monitor (la excepcion, que antes nombraba a EJE, ahora es generica: solo se monitorean los portales que esta version sabe escanear). Sin eso, al actualizar se les habria creado monitor a causas que el escaneo no puede leer y habrian quedado contadas como escaneadas.
- README, DEVELOPER, ROADMAP, PRIVACY y el manual de usuario dejan de nombrar el portal. Las bitacoras, los changelogs de versiones viejas y los documentos de plan quedan como estan: son historia.

### Dependencias

- `npm audit` pasa de 18 vulnerabilidades (3 criticas) a 0. Ninguna dependencia de produccion (lo que se empaqueta y corre en el navegador) cambio de version: todo lo que se subio es tooling.
- `npm audit fix` cierra siete (18 a 11). Las once restantes colgaban de `web-ext-run`, el runner de Firefox que arrastra `wxt` (diez de ellas, las tres criticas incluidas), y de `sharp` (una, alta, por libvips): se cierran subiendo `wxt` de 0.20.20 a 0.21.x y `sharp` de 0.34 a 0.35. El `manifest.json` que genera la build nueva difiere del de la 0.20 en un solo campo agregado por la herramienta, `options_ui.open_in_tab: false`, que es el valor por defecto de Chrome cuando el campo no esta; el resto de los campos y el listado de archivos del ZIP quedan igual salvo el content script del portal retirado. Aun asi es un salto de version de la herramienta de empaquetado: antes de subir a la Store hay que probar la extension cargada (checklist en `docs/release-v0.8.1-assets.md`).
- `wxt` 0.21 activa `noUncheckedIndexedAccess` en el tsconfig que genera, lo que saca a la luz 108 errores de tipos preexistentes en 19 archivos (los mas cargados: `pjn-zip-generator.ts` con 20, `pjn-zip-ui.ts` con 16, `case-zip-generator.ts` con 12, `mev.content.ts` con 11, `mev-parser.ts` con 10). Ninguno lo introduce esta version. Se deja la regla explicitamente apagada en `tsconfig.json` para conservar el nivel de chequeo que el proyecto ya tenia; ponerla en verde es un trabajo propio, no de una version que va a revision de la Store.

## [0.8.0] - 2026-07-07

Version nacida del primer test de instalacion desde cero en una computadora limpia (feedback del titular, 7 puntos). Foco: que un colega recien instalado quede operativo sin fricciones.

### Chau PIN: credenciales directas de los portales

- Se elimino el sistema de PIN completo (PBKDF2, desbloqueo, restablecer PIN). Ahora se cargan directamente usuario y contraseña de MEV y PJN; se guardan cifradas (AES-256-GCM) con una clave generada automaticamente y persistida en el dispositivo. Nunca salen de la computadora.
- Esto arregla de raiz el error "Vault is locked / ingresa tu PIN" al guardar credenciales en Ajustes: la clave vivia solo en memoria del service worker (muere a los ~30 segundos de inactividad) y el guardado fallaba aunque el PIN estuviera puesto.
- Tambien arregla el "deslogueo" con el tiempo: la reconexion automatica dependia de esa clave en memoria; ahora la clave esta siempre disponible y el re-login automatico funciona tras cualquier reinicio del service worker o del navegador.
- Migracion: quienes tenian "Mantener sesion iniciada" activado conservan sus credenciales tal cual. Quienes tenian PIN sin esa opcion deben recargarlas una vez (sin el PIN no hay forma tecnica de descifrarlas); la extension lo detecta y las pide de nuevo.
- Opciones: la seccion Credenciales quedo siempre editable, con boton "Borrar" por portal. El popup ya no pide PIN.

### Bienvenida que deja todo configurado

- El onboarding ahora incluye la carga de credenciales de MEV y PJN ahi mismo, como paso destacado: no se puede avanzar sin guardarlas o tildar explicitamente "prefiero cargarlas mas tarde".
- Paso "Abri tus portales": botones para abrir MEV y PJN en pestañas y verificar que el auto-login funcione, con la explicacion de que "Importar todo" necesita esas pestañas abiertas.
- Cierre con "Acepto y quiero importar mis causas ahora": termina el onboarding y abre directo el asistente Importar todo.
- Al instalar por primera vez, la bienvenida se abre sola en una pestaña.

### Importacion multi-departamento MEV de verdad

- Arreglado el recorrido "todos los departamentos" de los sets MEV, que en la practica solo importaba las causas del departamento judicial activo (el selector de departamento de la pagina del set no se detectaba; el dialogo nunca aparecia, pendiente tecnico documentado en el manual 0.7.0).
- Deteccion robusta del selector de departamento (por name/id, por etiqueta en la fila y por nombres de departamentos conocidos en las opciones).
- Plan B nuevo: si la pagina del set no ofrece selector de departamento, ProcuAsist cambia de departamento como lo haria el usuario (via la pagina de seleccion de departamento), repite la busqueda del set en cada uno y acumula resultados deduplicados. Aplica al asistente "Importar todo" (siempre recorre todo) y al boton "Importar set" (opcion "Todos los departamentos").
- El departamento judicial que el usuario elige al entrar a MEV queda aprendido como preferido: la reconexion automatica ya no se queda a mitad de camino en la pantalla de seleccion de departamento.

### Avisos activos siempre

- Se elimino el umbral anti-ruido de "Importar todo" (avisos pausados al importar mas de 50 causas): TODAS las causas importadas quedan con avisos activos, sin excepciones. La pausa por causa sigue disponible desde la lista.

### Un solo boton Guardar

- En las paginas de causa de MEV y PJN (y en las tarjetas de EJE) se quito el boton "Monitorear": "Guardar" ya incluye el monitoreo (modelo guardar = monitorear de 0.7.0). Menos botones, misma funcion.

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
