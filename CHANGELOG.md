# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

## [0.8.1] - 2026-09-29

Publicada en Chrome Web Store (verificado el 29/09/2026 con el servicio de actualizaciones de Chrome, que para el identificador de la extensión devuelve la versión 0.8.1, y en la ficha pública). Esta entrada resume la versión publicada; el detalle y las pruebas de cada tramo están en las entradas del 09/09, 22/09, 28/09 y 29/09/2026, más abajo.

### Qué trae

- Retiro del portal EJE/JusCABA y de su permiso de host, con el acceso SSO de PJN conservado, y dependencias de desarrollo al día (entrada [0.8.1] - 2026-09-09).
- Descarga de expedientes MEV que no saltea documentos por la verificación: pausa o detención ante la pantalla de la MEV, informe fechado de pendientes, nombres de archivo por fecha y "Bajar los que faltan"; lo que falla por otro motivo queda anotado como faltante y la descarga sigue (entradas del 22/09 y del 28/09/2026).
- Recuperación mediante una pestaña normal: si la MEV contesta con su pantalla de verificación al pedir un proveído, la extensión abre ese documento en una pestaña normal de la MEV, espera sin resolver ni manipular el verificador y lo lee cuando el portal lo muestra. Si no lo consigue, la descarga se detiene, entrega lo bajado y deja pendientes ese documento y los siguientes. Con un adjunto de la MEV o con la sesión cerrada no hay recuperación: aparece la pausa.
- Adjuntos lentos: los de docs.scba.gov.ar se bajan desde una página propia de la extensión, con espera adicional (hasta diez minutos) y cancelación.
- Escaneos parciales: un barrido de monitoreo que no pudo leer todas las causas se informa como incompleto; el panel muestra cuántas causas quedaron pendientes por verificación, sesión o error.
- PDF único con respaldo: si un adjunto no puede incorporarse al PDF único, se entrega un ZIP con los originales, el PDF de consulta y un aviso.
- PDF sin marca: los PDF que genera la descarga (resumen, PDF por paso e informe de verificación, y también el resumen de PJN) salen sin logo, sin color corporativo y sin el nombre de la extensión (entrada [Sin version] - 2026-09-09).
- Sin permisos nuevos respecto de 0.8.0: el manifest del paquete subido pide los mismos permisos, menos el host del portal retirado.

### Límites

- El monitoreo no usa la recuperación de la descarga. Cuando la MEV muestra su pantalla de verificación, el barrido deja causas pendientes, se informa como incompleto y vuelve a intentar en el próximo escaneo automático. Pasar la verificación en una pestaña no lo destraba. Para adelantarlo con "Escanear ahora", conviene dejar pasar un rato y comprobar antes que la MEV deje navegar: ese botón no respeta esperas.
- El avance de una descarga se conserva solo durante la ejecución en curso. Si la extensión se reinicia o se actualiza en el medio, la descarga se corta sin guardar ningún archivo y hay que empezarla de nuevo.
- En la prueba asistida del 29/09/2026 (131 documentos y 22 adjuntos) ninguna pantalla de verificación puso en marcha la recuperación por pestaña normal. La recuperación está implementada, pero solo su espera del documento tiene pruebas unitarias: la apertura y el cierre de la pestaña, el control de que sea el documento pedido y la detención cuando falla no tienen pruebas automáticas, y no se demostró frente a una verificación real.
- La extensión no resuelve desafíos del portal ni garantiza que la MEV conceda acceso.

### Paquete y ficha

- Paquete publicado: `procu-asist-0.8.1-chrome.zip`, generado el 29/09/2026 con `npm run zip` (WXT 0.21.4), 616,73 kB (616.728 bytes), SHA-256 `1db749aa37d113d26cc2cceaedd33d18889bd9dad725c8f144297ccf7957fd6b`. La advertencia sobre el zip obsoleto con el mismo nombre está en `docs/release-v0.8.1-assets.md`.
- Suite: 94 casos con `npm test` y tipos sin errores, según el cierre de preparación del 29/09/2026 (más abajo).
- Ficha: la descripción pública todavía menciona el PIN maestro, que no existe desde la 0.8.0. La corrección queda pendiente en el panel de la Store. Las cinco capturas publicadas son las promocionales sintéticas de `docs/store-assets/v0.7.0`, sin datos reales (cotejadas una por una el 29/09/2026).

## [Sin versión] - 2026-09-29 (documentación posterior a la publicación)

Solo documentación, sin cambios de código.

- Síntoma: con la 0.8.1 ya publicada, README, ROADMAP, el documento de publicación, el README de las capturas y el banner del plan maestro seguían diciendo que la ficha estaba en 0.8.0, que la 0.8.1 estaba sin publicar o que el proyecto estaba en pausa. La prueba asistida del 29/09 figuraba como comprobación de la recuperación por pestaña normal, que en esa prueba no se puso en marcha. Fuera de una entrada técnica de este archivo, ningún documento decía que el avance de una descarga no sobrevive a un reinicio de la extensión. El documento de publicación no identificaba el paquete subido, aunque hay dos zip con el mismo nombre. El manual y la guía rápida seguían rotulados v0.8.0, la sección del monitoreo del manual había quedado después del pie, la guía rápida presentaba el escaneo rápido por sets como activo de fábrica, PRIVACY no mencionaba las pestañas que abre la descarga ni todos los avisos que muestra, y DEVELOPER omitía el mensaje `activity` del canal de la descarga. Además, PRIVACY, el manual y la guía rápida decían que las credenciales nunca salen de la computadora, aunque el inicio de sesión automático las envía al portal correspondiente; PRIVACY decía que las comunicaciones externas ocurren solo cuando el usuario usa una función, aunque el mantener sesión y el monitoreo consultan los portales solos; el manual indicaba comprobar la sesión y volver a escanear ante una verificación, en contra del aviso del propio monitoreo; el resumen de la 0.8.1 omitía el PDF sin marca, y algunos documentos remitían a registros internos que no son parte del repositorio.
- Causa: la mayoría de esos textos se escribió mientras la 0.8.1 se preparaba y no se releyó después de la publicación; el texto del escaneo rápido, el de las credenciales y el de las comunicaciones externas venían de antes.
- Arreglo: la entrada [0.8.1] de arriba; correcciones fechadas debajo de las entradas contradichas, sin reescribirlas; README, ROADMAP, manual, guía rápida, PRIVACY, DEVELOPER, documento de publicación, README de las capturas y banner del plan maestro al día, con los límites a la vista.
- Verificación: versión pública consultada el 29/09/2026 en el servicio de actualizaciones de Chrome y en la ficha pública; el 29/09/2026, entre las 20:33 y las 20:40, se abrieron una por una las cinco capturas de la ficha pública, y son las cinco promocionales sintéticas de `docs/store-assets/v0.7.0` (causas unificadas, alertas por expediente, plazos, importar todo y descargar expediente); el zip obsoleto del 09/09/2026 trae el PDF sin marca y el retiro de EJE, pero no los cambios de la descarga del 22/09 al 29/09/2026, según las cadenas de su código empaquetado; intervalos del mantener sesión (4 minutos, activo de fábrica) y del monitoreo (6 horas) leídos en el código; SHA-256 del zip subido calculado con `sha256sum` y con `Get-FileHash` (coinciden); `manifest.json` del zip leído sin extraerlo y comparado con el de la 0.8.0; 94 casos contados en `tests/` (de la recuperación por pestaña normal, solo su espera del documento tiene pruebas: tres casos); cada afirmación sobre el comportamiento, cotejada con el código; revisión independiente del cambio; cero guiones largos en los archivos tocados. No se corrieron `npm test` ni `build`: el cambio es solo de documentación.

## Recuperación local de MEV - 2026-09-28 (noche)

Pedido expreso de Patricio para retomar este arreglo, con prioridad a completar la descarga aunque demore más. Sin publicación en la Store ni push al repositorio público.

- Ritmo reducido a 10 pedidos por minuto y reloj monótono.
- La verificación temporal conserva el documento en curso y espera; cuatro recuperaciones por elemento y doce por descarga como máximo. Si persiste, se ofrece guardar lo bajado mediante el diálogo de descarga, con informe de pendientes y opción existente de bajar los faltantes. Nunca se cuenta como completa una descarga con faltantes en la interfaz.
- Cuando falta contenidoTxt, no se copia el body completo con menús y datos del usuario. Un aviso explícito de texto inexistente produce una constancia breve; una página sin texto ni aviso se informa como inesperada.
- Verificación: 83/83 pruebas, TypeScript sin errores y build Chrome. Casos nuevos: agotamiento en proveído y adjunto, presupuesto global y ausencia de texto. La versión anterior instalada completó una descarga durante la prueba conjunta; la versión modificada requiere recarga de la extensión y comprobación final en Chrome.

Cierre 29/09/2026: integrado localmente en `descarga-confiable-mev` (9826523), 83 pruebas aprobadas, tipos y build sin errores en el worktree de uso. Carpeta reconstruida: `.output/chrome-mv3`. Pendiente de recarga por el titular y prueba final en Chrome (mapa del ecosistema). No se integró a master ni se publicó.

Corrección del 29/09/2026: estos cambios se integraron después a `master`, se subieron al repositorio público y forman parte de la 0.8.1 publicada en Chrome Web Store (ver [0.8.1] - 2026-09-29, al principio de este archivo). La comprobación en Chrome que consta es la prueba asistida del 29/09/2026, descripta en esa entrada.

## En pausa - 2026-09-25

Decisión del titular: ProcuAsist queda en pausa y la prioridad pasa a Estudio OS. Esta rama (`descarga-confiable-mev`) no se integra ni se publica por ahora.

- El 23/09/2026 la MEV contestó con su pantalla de verificación a todos los pedidos de la descarga por detrás, aunque la verificación se había pasado a mano en la pestaña (ver la prueba real, abajo).
- La ayuda oficial de la MEV (sección USUARIOS) dice que sus usuarios "son para ser usados por seres humanos y no por sistemas informáticos o agentes de inteligencia artificial" y que el mal uso "generará el bloqueo de dicho usuario". Antes de publicar la 0.8.1 hay que revisar qué funciones de la MEV quedan: el login automático, el mantener sesión, el monitoreo automático, la importación y la descarga por detrás usan la cuenta del abogado en forma automatizada. Lo que asiste a la persona mientras navega (marcadores, ayudas en la pantalla) es otra cosa.
- Para retomar: la rama tiene la descarga con portero, pausa, informe y nombres por fecha (probada contra el portal salvo la bajada real), el mantener sesión que no insiste durante un bloqueo y los arreglos de la prueba del 23/09. Hay una copia completa del repositorio con esta rama en un paquete de git fuera del repo (ver la memoria del proyecto).

Corrección del 29/09/2026: por decisión del titular, la pausa quedó sin efecto para publicar la 0.8.1. La rama `descarga-confiable-mev` se integró a `master`, se subió al repositorio público y su contenido se publicó en esa versión (ver [0.8.1] - 2026-09-29).

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
- Pedido del titular durante la prueba real: "Esperar y seguir" muestra la cuenta regresiva de la espera y, si nadie elige, sigue sola. La espera se cuenta desde el bloqueo, así que no suma tiempo. Con la sesión cerrada no sigue sola.
- "Cancelar sin guardar" se respeta aunque llegue al final; "Detener" desaparece durante el armado del archivo.
- El login y la búsqueda se reconocen antes que las frases sueltas; HTTP 429 y 503 cuentan como bloqueo; tiempos máximos en todos los pedidos.
- Colisiones de nombres sin distinguir mayúsculas; el archivo de salida lleva fecha y hora.
- Los faltantes ya no dejan un `_ERROR.txt` cada uno: el informe fechado los lista todos.

### Agregado de la noche, aprobado por el titular (mismo día)

- El keep-alive de la MEV mira la respuesta y, si es la pantalla de verificación, deja de pedir durante 30 minutos; lo mismo si la vio la descarga o el monitoreo (`modules/portals/mev-keepalive.ts`, `entrypoints/background/mev-verification-state.ts`). Síntoma: un bloqueo de más de dos horas el 22/09 con pestañas de la MEV abiertas, y el keep-alive pidiendo `busqueda.asp` cada 4 minutos sin mirar qué volvía. Que eso lo sostuviera es hipótesis sin medir.
- El aviso de pausa aclara que en una pestaña la pantalla se resuelve esperando, pero que eso no destraba la descarga. El aviso del monitoreo deja de pedir "resolvé la verificación", que no destraba nada.

### Prueba real del 23/09/2026 y dos arreglos que salieron de ella

- Expediente de 225 pasos, con la build de la rama del 22/09. Patricio pasó la verificación en su pestaña (la ficha cargó entera) y la descarga arrancó a las 09:51. La MEV contestó con su pantalla a todos los pedidos de la extensión, desde el primero: siete intentos del mismo documento con esperas de 30 s, 1, 2 y 4 minutos (unos 7 pedidos en 13 minutos), y "Detener y guardar lo bajado" a las 10:05. Bajados: 0 de 225.
- Verificado contra el portal: la pantalla se reconoce y pausa en vez de fallar; la cuenta regresiva sigue sola y sin doble espera; "Saltear este documento" aparece desde el segundo bloqueo; "Detener y guardar lo bajado" arma el ZIP con `resumen.pdf` y el informe `_verificacion_2026-09-23_0951.txt`; el archivo sale `expediente_AL-..._2026-09-23_0951.zip`; los nombres van con la fecha adelante; aparece "Bajar los que faltan (225 pasos)".
- Hallazgo: pasar la verificación en la pestaña NO destraba los pedidos que la descarga hace por detrás, y la pantalla llegó aun con un pedido cada varios minutos. El 22/09 a la mañana la descarga original bajó 116 documentos por detrás sin pantalla. No se sabe si la MEV sigue marcando al usuario o la conexión por lo del 22/09, o si endureció la regla para todo lo que no sea el navegador.
- Arreglo 1, el informe: el documento que se estaba pidiendo cuando se detuvo desde la pausa figuraba "no se pidió: la descarga se detuvo antes", con cero faltantes, aunque se había pedido siete veces. Ahora figura con el motivo del bloqueo ("N intentos seguidos con la pantalla; la descarga se detuvo a pedido del usuario") y solo los que siguen quedan pendientes; lo mismo con un adjunto (`modules/pdf/mev-download-runner.ts`).
- Arreglo 2, la hora de los archivos del ZIP: JSZip la escribía en UTC y Windows la mostraba con 3 horas de más. Cada entrada lleva la hora local (`zipEntryDate` en `modules/pdf/file-naming.ts`), verificado con JSZip y `unzip` en esta máquina.
- Sin verificar todavía: la bajada real de documentos, el ZIP con PDFs, la descarga parcial que encaje en la carpeta y "Bajar los que faltan".

### Verificación

- `npm test`: 77 casos (portero, nombres, clasificación, informe, recorrido y keep-alive), sin datos reales.
- `npm run compile`, `npm run build` y `npm run zip` en verde. El agregado de la noche y los arreglos de la prueba pasaron `compile` y `test`; `build` se corrió después de la prueba del 23/09 para cargar la versión nueva.
- La prueba real del 23/09 verificó la pausa, el corte y el informe (ver arriba), no la bajada: la MEV no sirvió ningún documento por detrás.

### Sin medir

- Si los pedidos a la ficha y a los adjuntos cuentan para el límite y si el límite va por usuario o por conexión.
- Si la pantalla que la MEV le mostró a la descarga el 23/09 es un resto del bloqueo del 22/09 o una regla nueva para todo lo que no sea el navegador. Pasar la verificación a mano en la pestaña no la destrabó.

## [Sin version] - 2026-09-26

Limpieza documental en `master`, sin cambios de codigo ni de producto. Rama `limpieza-2026-09-26`.

- Sintoma: `master` no decia que el proyecto esta en pausa ni conocia la regla publicada por la MEV; el README describia la verificacion de la MEV como "sin confirmar contra el portal" cuando ya se habia medido el 22/09 en una rama de trabajo; decia WXT 0.20 cuando `package.json` fija 0.21; `docs/release-v0.8.1-assets.md` afirmaba que no hay suite de tests y describia una build con wxt 0.21 que no es la del zip existente; el manual, el tutorial y el README de las maquetas decian que los originales de las capturas "siguen en la historia de git" cuando la purga se hizo el 09/09; el manual referenciaba una captura que no existe; tres documentos publicos de `docs/` llevaban identificadores reales (un numero de usuario de PJN, numeros de expediente, un identificador de conversacion, una caratula y nombres de adjuntos de una causa); habia 78 guiones largos en cinco archivos.
- Causa: la pausa y la medicion del 22/09 se escribieron solo en el CHANGELOG y el README de la rama `descarga-confiable-mev`, que no se integra; el resto son documentos que envejecieron sin que nadie los releyera, y los identificadores quedaron de relevamientos de 2025 y 2026 hechos sobre causas propias.
- Arreglo: README (pausa del 25/09, regla de la MEV con la cita textual y lo medido el 22 y 23/09, WXT 0.21 con la nota sobre el zip de 0.20.20, scaffold `apps/procu-estudio` anotado), ROADMAP (estado en pausa, condiciones para retomar, remision al mapa de pendientes del ecosistema), `docs/release-v0.8.1-assets.md` (zip de master armado con 0.20.20, segundo zip en el worktree de la rama, suite de 8 tests), `docs/tutorial/README.md`, `docs/manual-usuario.md` y `docs/store-assets/v0.8.1/README.md` (purga hecha el 09/09; la captura 12 no existe; 04 y 06 muestran el PIN y 14 el umbral), `docs/plan-maestro-2026.md` (banner de documento historico, sin reescribir), identificadores reemplazados por valores claramente ficticios en `docs/qa-v0.6.1.md`, `docs/plans/pjn-implementation.md` y `docs/plans/juscaba-zip-download.md` con un commit normal (sin purga de historial: decision del 26/09, los valores siguen en la historia y en los paquetes de git previos guardados fuera del repositorio), guiones largos a cero. El scaffold `apps/procu-estudio` (16 archivos, sin actividad desde mayo de 2026) se conserva por decision del titular.
- Verificacion: `grep` de guiones largos en cero sobre todos los `.md` del repositorio; `grep` de los patrones de identificadores en cero sobre `docs/`; fin de linea de cada archivo conservado; no se corrieron `npm ci` ni `build` (el proyecto esta en pausa y el checkout principal no se toca).
- Revision del mismo dia (26/09): se recorto del README y de esta bitacora el detalle de como la rama de trabajo espacia los pedidos, cuanto tarda en levantarse un bloqueo y como se reconoce la pantalla (el repositorio es publico y la decision es no documentar como esquivar el filtro; queda lo que explica por que la descarga falla). Se corrigio un numero con ceros a la izquierda en un JSON de muestra de `docs/plans/juscaba-zip-download.md`. Suite corrida sin instalar nada (`node --test`, Node 24): 8 de 8 en verde.
- Sin hacer a proposito: integrar o publicar la rama `descarga-confiable-mev`, publicar la 0.8.1, regenerar el zip, reemplazar las capturas de la ficha de la Store (lo hace el titular).

## En pausa - 2026-09-25

Decision del titular: ProcuAsist queda en pausa y la prioridad pasa a otro sistema del estudio. La rama de trabajo `descarga-confiable-mev` (otro recorrido de descarga: avisa y pregunta en vez de saltear, informe fechado, nombres de archivo por fecha) no se integra ni se publica por ahora.

- El 23/09/2026 la MEV contesto con su pantalla de verificacion a todos los pedidos de la descarga por detras, aunque la verificacion se habia pasado a mano en la pestaña (prueba real sobre un expediente de 225 pasos: bajados 0 de 225).
- La ayuda oficial de la MEV (seccion USUARIOS) dice que sus usuarios "son para ser usados por seres humanos y no por sistemas informáticos o agentes de inteligencia artificial" y que el mal uso "generará el bloqueo de dicho usuario". Antes de publicar la 0.8.1 hay que revisar que funciones de la MEV quedan: el login automatico, el mantener sesion, el monitoreo automatico, la importacion y la descarga por detras usan la cuenta del abogado en forma automatizada. Lo que asiste a la persona mientras navega (marcadores, ayudas en la pantalla) es otra cosa.
- Para retomar: revision de las automatizaciones frente a la regla, prueba real de la bajada y decision de publicar. La rama queda en un worktree local y en un paquete de git fuera del repositorio; no se sube al repositorio publico.

Corrección del 29/09/2026: por decisión del titular, la pausa quedó sin efecto para publicar la 0.8.1. La rama se integró a `master`, se subió al repositorio público y se publicó en esa versión (ver [0.8.1] - 2026-09-29).

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

Corrección del 29/09/2026: la 0.8.1 no se publicó con este contenido solo. Antes de subirla se le sumaron los cambios posteriores del 09/09/2026 (entrada [Sin version] - 2026-09-09: el PDF sin marca y un primer arreglo de la descarga ante la verificación, que después reemplazaron los cambios del 22/09) y los de la descarga de la MEV del 22/09 al 29/09/2026, así que la 0.8.1 publicada sí trae funciones nuevas. El resumen de la versión publicada está en [0.8.1] - 2026-09-29, al principio de este archivo.

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

Corrección del 29/09/2026, sobre el checklist que cita el segundo punto de esta lista: ya no está en `docs/release-v0.8.1-assets.md`. Se retiró el 29/09/2026 sin que conste completado, y la versión anterior del documento sigue en la historia de git. El paquete publicado se armó con WXT 0.21.4 (ver [0.8.1] - 2026-09-29). La prueba con la extensión cargada que consta es la prueba asistida de descarga MEV del 29/09/2026; del resto del checklist (por ejemplo, el auto-login de PJN por SSO o un perfil que venga de la 0.8.0) no hay registro de prueba.

## [0.8.0] - 2026-07-07

Version nacida del primer test de instalacion desde cero en una computadora limpia (feedback del titular, 7 puntos). Foco: que un colega recien instalado quede operativo sin fricciones.

### Chau PIN: credenciales directas de los portales

- Se elimino el sistema de PIN completo (PBKDF2, desbloqueo, restablecer PIN). Ahora se cargan directamente usuario y contraseña de MEV y PJN; se guardan cifradas (AES-256-GCM) con una clave generada automaticamente y persistida en el dispositivo. Nunca salen de la computadora.
- Esto arregla de raiz el error "Vault is locked / ingresa tu PIN" al guardar credenciales en Ajustes: la clave vivia solo en memoria del service worker (muere a los ~30 segundos de inactividad) y el guardado fallaba aunque el PIN estuviera puesto.
- Tambien arregla el "deslogueo" con el tiempo: la reconexion automatica dependia de esa clave en memoria; ahora la clave esta siempre disponible y el re-login automatico funciona tras cualquier reinicio del service worker o del navegador.
- Migracion: quienes tenian "Mantener sesion iniciada" activado conservan sus credenciales tal cual. Quienes tenian PIN sin esa opcion deben recargarlas una vez (sin el PIN no hay forma tecnica de descifrarlas); la extension lo detecta y las pide de nuevo.
- Opciones: la seccion Credenciales quedo siempre editable, con boton "Borrar" por portal. El popup ya no pide PIN.

Corrección del 29/09/2026: las credenciales no salen hacia servidores de ProcuAsist ni de terceros, pero el inicio de sesión automático las envía al portal correspondiente (ver PRIVACY.md).

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
- Cliente de la API REST `api.pjn.gov.ar` con captura automática del token JWT del portal, feed de novedades disponible
- Lectura del listado de causas en `scw.pjn.gov.ar`: Relacionados (letrado/parte) y Favoritos
- Parser del detalle del expediente: datos generales + 4 pestañas (Actuaciones, Intervinientes, Vinculados, Recursos)

**Descarga de expedientes PJN: ZIP completo**
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
- Removido módulo Supabase completo (auth, sync, OAuth, client), la extensión es 100% local
- Removido permission `identity` y host de Supabase del manifest
- Renombrados content scripts a la convención WXT `*.content.ts`
- Rebrand consistente: EJE → JUSCABA en toda la UI y documentación

**MEV: mejoras menores**
- Columna "Fojas" agregada al PDF resumen y al parser de movimientos
- Selector de "Departamento Judicial" en formulario de auto-login
- `docs.scba.gov.ar` agregado a host_permissions (necesario para descarga de adjuntos)
- Fix cosmético en generador de PDF: cálculo de ancho de columnas
- Auto-reconexión silenciosa cuando el vault está bloqueado (sin spam de notificaciones)

## [0.3.0] - 2026-04-15

### Mejoras en descarga de expedientes (MEV)

**Descarga ZIP: contenido enriquecido**
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
- Eliminado el botón "📄 PDF", solo existe "📦 ZIP" que descarga el expediente completo

## [0.2.0] - 2026-04-01

### ProcuAsist ahora es gratuito

- Eliminado sistema de planes pagos (Free/Junior/Senior), todas las funciones sin limites
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


## 2026-09-29, recuperación mediante navegador (prueba local)

La prueba de un expediente grande mostró que las esperas no resolvían la verificación, y que dos adjuntos accesibles manualmente agotaban el límite de respuesta inicial de 25 segundos. Ahora, al recibir la verificación de un proveído, se abre una pestaña normal, se espera hasta tres minutos sin recargar ni resolver el verificador y se lee el documento cargado, comprobando su identidad. El avance de esa ejecución permanece en memoria. Si no se recupera, se guarda parcial y se informa pendiente. Esto todavía no es persistencia frente a reinicios.

Los archivos de docs.scba se descargan desde una página de extensión con hasta diez minutos de espera, cancelación y transferencia por bloques al fondo. No se amplían permisos. Pruebas locales: 90 tests, compilación de tipos y build. Revisión de fallos: cierre de pestaña, cancelación, origen del canal, conservación del resultado parcial ante fallo al crear la pestaña y rechazo de otro documento. La recuperación real en Chrome requiere recargar y probar; todavía no se validó un expediente completo con esta variante. No modifica el escaneo de Estudio OS ni publica la rama.

Corrección del 29/09/2026: la rama se integró y se publicó como 0.8.1. Con esta variante se hizo después la prueba asistida de 131 documentos y 22 adjuntos, pero ninguna pantalla de verificación puso en marcha la recuperación: sigue sin demostrarse frente a una verificación real (ver [0.8.1] - 2026-09-29).

## 29/09/2026: integridad de publicación

La revisión previa a publicar detectó dos falsos resultados completos. El panel ahora informa barridos incompletos y cuenta solo causas leídas, con pendientes por verificación, sesión o error. La recuperación por navegación continúa siendo propia de la descarga, no del monitoreo.

Si un adjunto no puede incorporarse al PDF único, se entrega un ZIP que conserva los originales, el PDF de consulta y un aviso de formato. El canal usa el MIME del archivo realmente generado. Pruebas con PDF válido, corrupto y documento incompatible: 94/94 tests y TypeScript correcto. No requiere permisos adicionales.


### Cierre de preparación 29/09/2026

El titular pide integrar, hacer push y preparar la actualización de Store, dejando sin efecto la pausa de publicación anterior para este arreglo. Se actualizaron README, manual, roadmap y material de la ficha. La descarga por navegación normal se comprobó en una prueba asistida de 131 documentos y 22 adjuntos. La ficha pública sigue en 0.8.0 al verificarla hoy. Se distingue el monitoreo, que puede dejar pendientes ante verificación, de la recuperación de descargas. Los cambios no conectan con Estudio OS ni agregan permisos. Revisión adversarial de los ajustes de integridad aprobada; 94/94 pruebas y tipos correctos.

Corrección del 29/09/2026: la prueba asistida comprobó la descarga de 131 documentos y 22 adjuntos, no la recuperación por navegación normal. En esa prueba ninguna pantalla de verificación la puso en marcha: la recuperación está implementada, solo su espera del documento tiene pruebas unitarias y no se demostró frente a una verificación real. La ficha pública pasó después a 0.8.1 (ver la corrección de la confirmación, abajo, y [0.8.1] - 2026-09-29).

Paquete final reconstruido el 29/09/2026 con npm run zip (WXT 0.21.4): versión 0.8.1, 616.73 kB. Se comprobó manifest, ausencia de secretos/configuración local y de nativeMessaging en el ZIP. Build correcto. El envío a revisión y la aprobación de Google se registran por separado, no se dan por hechos.

Corrección del 29/09/2026: el tamaño es 616,73 kB (616.728 bytes) y el SHA-256 del archivo subido es `1db749aa37d113d26cc2cceaedd33d18889bd9dad725c8f144297ccf7957fd6b`. La publicación de la 0.8.1 quedó verificada el 29/09/2026 (ver [0.8.1] - 2026-09-29).

### 29/09/2026: confirmación del panel de publicación

El titular confirmó la carga del ZIP 0.8.1 en la ficha existente y luego informó que el panel muestra la versión publicada 0.8.1. Se registra como confirmación del titular: el control de la consola no estuvo disponible y la última consulta de la ficha pública todavía devolvió 0.8.0. No se comprobó de forma independiente la propagación de la versión, descripción y capturas. El paquete y sus pruebas no cambiaron desde el cierre anterior.

Corrección del 29/09/2026: la versión pública se comprobó después en forma independiente: el servicio de actualizaciones de Chrome y la ficha pública devuelven 0.8.1. La descripción de la ficha todavía menciona el PIN maestro, que no existe desde la 0.8.0, y su corrección queda pendiente en el panel de la Store. Las cinco capturas de la ficha se abrieron una por una el 29/09/2026: son las cinco promocionales sintéticas de `docs/store-assets/v0.7.0`, sin datos reales.
