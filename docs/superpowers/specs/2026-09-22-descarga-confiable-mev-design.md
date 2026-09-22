# Descarga confiable de expedientes MEV (v0.8.1)

Fecha: 22/09/2026. Diseño aprobado por el titular el 22/09/2026. Rama: `descarga-confiable-mev`.

Este documento no contiene datos de causas: las mediciones se describen por cantidades y tiempos.

## 1. Problema

### Síntoma

La descarga completa de un expediente de 225 proveídos terminó con 109 documentos salteados, en dos tandas seguidas (pasos 87 a 153 y 184 a 225), con el error "La MEV devolvió una página que no es la del proveído". Los salteados quedaron como `_ERROR.txt` y en `_verificacion.txt`.

### Causa medida (22/09/2026, contra el portal, con sesión real)

- La MEV tiene ahora un nginx (`Server: nginx/1.26.3`) delante del servidor ASP, con un límite de pedidos.
- Pasado el límite, **toda** página de la MEV responde con una pantalla intermedia en la misma dirección pedida, con HTTP 200: 2.000 bytes, título `Validando acceso...`, un script de `challenges.cloudflare.com/turnstile/v0/api.js` (Cloudflare Turnstile), dos scripts en línea y **ningún texto visible en el cuerpo** (el texto que se ve en pantalla lo arma un script). La política de seguridad de contenido del portal habilita el iframe de `challenges.cloudflare.com`.
- Medición del límite, pidiendo proveídos de una misma causa:
  - a unos 2 pedidos por segundo, los primeros 29 salen bien y el 30 ya es la pantalla;
  - a un pedido cada 1,2 s, la pantalla aparece exactamente en los pedidos 33, 63, 93, 123, 153 y 185, una vez por minuto: el límite es de **unos 30 pedidos de proveídos por minuto**;
  - una pausa de 25 s sin pedidos alcanza para que el mismo proveído vuelva completo en los primeros bloqueos; al sexto bloqueo seguido la pausa ya no alcanza: **el castigo escala**;
  - si se sigue pidiendo durante el bloqueo, el bloqueo no se levanta (en una prueba se sostuvo más de 43 s mientras seguían los pedidos).
- El bloqueo no es por pestaña ni por sesión: alcanzó a otra sesión del mismo usuario abierta desde la misma conexión. No se determinó si va por usuario o por IP. La página de login no quedó bloqueada.
- Sin medir: si los pedidos a la ficha (`procesales.asp`) y a los adjuntos cuentan para el mismo límite; si pasar la verificación a mano acorta el bloqueo.
- Aparte: `proveido.asp` pedido sin que la sesión haya pasado antes por la ficha (`procesales.asp`) de esa causa redirige a `busqueda.asp`. Visitar otra causa después no quita el acceso a la primera.

### Por qué la extensión falla

1. La sonda de `fetchMevPageContent` saca `script`, `style`, `noscript`, `link` y `meta` y busca las frases de la verificación en los primeros 600 caracteres del texto visible. En esta pantalla ese texto está vacío y el HTML (2.000) supera el piso de 1.200 caracteres: el veredicto es `respuesta-inesperada`, el documento se saltea y la descarga sigue.
2. Tras un salteo espera 300 ms y pide el siguiente: durante el bloqueo sigue pidiendo a unos 2,5 pedidos por segundo, lo que lo prolonga.
3. Toda la descarga corre dentro de un único mensaje (`GENERATE_ZIP`). Chrome termina el service worker de una extensión cuando un solo evento tarda más de 5 minutos en procesarse (documentación oficial del ciclo de vida del service worker). Una descarga que respete el límite supera ese tiempo en un expediente grande.
4. El número del nombre de archivo es la posición dentro de lo tildado: una descarga parcial vuelve a empezar en 001.
5. `findMevTab` usa la primera pestaña de la MEV que encuentra, no la pestaña desde la que se pidió la descarga.
6. El progreso nunca llega a la pestaña (`onProgress` se pasa como `undefined`): la barra queda en "Iniciando..." toda la descarga.

## 2. Objetivos y límites

Objetivos:

- Que la descarga de un expediente complete todos sus documentos respetando el límite de la MEV: un bloqueo nunca saltea un documento.
- Que el usuario decida qué hacer en cada bloqueo.
- Nombres de archivo por fecha, estables entre descargas, para que una descarga parcial encaje en la carpeta de una anterior.
- Progreso real, con tiempo estimado, y la posibilidad de detener.

Fuera de alcance:

- Resolver, automatizar o esquivar la verificación de la MEV (Turnstile). La extensión no la toca: espera o le pide al usuario que decida.
- Bajar más rápido que el límite.
- El selector de alcance de la importación, el monitoreo PJN y la descarga PJN (tienen su propio trabajo).

## 3. Diseño

### 3.1 Portero de pedidos (`modules/portals/mev-pacer.ts`, nuevo, puro)

- Deja pasar como máximo **20 pedidos por minuto**: un inicio de pedido cada 3.000 ms, de a uno por vez (los llamados concurrentes hacen fila). La constante vive en un solo lugar para ajustarla si la MEV cambia el límite.
- Esperas ante un bloqueo, en orden: 30 s, 1 min, 2 min y 4 min (la última se repite). El índice vuelve a cero después de un documento bajado sin bloqueo.
- Módulo sin `chrome.*` ni DOM: el reloj y la espera se inyectan, así se prueba en node con un reloj simulado.
- Pasan por el portero: cada proveído, cada adjunto alojado en `mev.scba.gov.ar` y cada reingreso a la ficha. Los adjuntos de `docs.scba.gov.ar` no pasan (otro servidor; si se comprobara que cuentan, se suman) y se bajan de a uno, dentro del intervalo del portero.

### 3.2 Clasificación de respuestas (`modules/portals/mev-challenge.ts`, ampliado)

La sonda que arma la página inyectada suma: título del documento, presencia del script de Turnstile, ruta final después de las redirecciones (`finalPath`) y si la página es el formulario de login.

Veredictos:

| Veredicto | Cuándo | Qué hace la descarga |
|---|---|---|
| `ok` | la página trae estructura de proveído (regla de oro: gana siempre) | baja el documento |
| `desafio` | título `Validando acceso`, script de Turnstile, o frase de verificación en el HTML crudo (no solo en el texto visible); se mantiene la regla de respuesta demasiado corta | pausa y pregunta |
| `login` | formulario de usuario y clave | pausa y pregunta |
| `sin-contexto` | la ruta final es `busqueda.asp` | reingresa una vez a la ficha y reintenta |
| `respuesta-inesperada` | cualquier otra cosa | reintenta una vez; si se repite, anota el faltante con lo que devolvió la MEV y sigue |

`htmlLooksLikeChallenge` (HTML crudo, lo usan los adjuntos y el monitoreo) reconoce también el título y el script de Turnstile.

### 3.3 Pausa con pregunta

Ante `desafio`, la descarga deja de pedir y la pestaña muestra un aviso: "La MEV pidió una pausa. Bajados 87 de 225." Botones:

- **Esperar y seguir**: cuenta regresiva con la espera que toca (30 s, 1, 2 o 4 min) y reintenta el mismo documento. Si vuelve a bloquear, pregunta de nuevo.
- **Detener y guardar lo bajado**: entrega el ZIP (o el PDF único) con lo descargado y el informe `_verificacion_AAAA-MM-DD_HHMM.txt` con lo que falta.
- **Cancelar sin guardar**: no entrega nada.

Ante `login`, el aviso explica que la sesión de la MEV se cerró y que hay que iniciarla en **otra** pestaña (en la de la descarga no, porque cambiar de página la cancela). Botones: **Seguir** (reingresa a la ficha y reintenta), **Detener y guardar lo bajado**, **Cancelar sin guardar**.

Mientras el aviso espera respuesta no se le pide nada a la MEV, sin límite de tiempo.

### 3.4 Canal de la descarga (`entrypoints/background/mev-download-job.ts`, nuevo)

- La pestaña abre un canal `chrome.runtime.connect({ name: 'mev-download' })`. El service worker responde enseguida y corre el trabajo fuera del evento, así ningún evento dura más de 5 minutos.
- Mensajes de la pestaña al fondo: `start` (datos de la causa, movimientos elegidos con su nombre de archivo ya calculado, formato), `answer` (respuesta a una pausa) y `stop` (con o sin guardar).
- Mensajes del fondo a la pestaña: `progress` (hechos, total, segundos estimados), `paused` (motivo, hechos, total, espera propuesta), `waiting` (segundos que faltan), `result` (archivo, estadísticas, si es parcial) y `error`.
- Los mensajes por el canal mantienen vivo el service worker (Chrome 114 o posterior). Mientras espera una respuesta, el fondo manda un latido cada 20 s.
- Si el canal se cierra (pestaña cerrada o recargada), el trabajo se cancela sin pedir nada más y sin entregar archivo. La pestaña avisa antes de salir (`beforeunload`) mientras hay una descarga en curso.
- `executeScript` corre en la pestaña que abrió el canal (`port.sender.tab.id`).
- El archivo final se entrega como hoy (`chrome.downloads.download` con "Guardar como").
- El mensaje `GENERATE_ZIP` se retira.

### 3.5 Nombres de archivo (`modules/pdf/file-naming.ts`, nuevo, puro)

- `AAAA-MM-DD_fs-X_DESCRIPCION.pdf`; sin fojas, `AAAA-MM-DD_DESCRIPCION.pdf`. Fecha inválida: `sin-fecha`.
- Fojas: `/` pasa a `-` (como hoy). Descripción: primeros 35 caracteres, letras con tilde y la ñ a su letra base (hoy "ACOMPAÑA" queda "ACOMPAA"; pasa a "ACOMPANA"), solo letras, números, espacios y guiones, espacios a `_`.
- Adjuntos: `<nombre>_adjunto_N.<ext>`. Faltantes: `<nombre>_ERROR.txt`.
- Colisiones: si dos documentos quedan con el mismo nombre, el segundo lleva `_2`, el tercero `_3`. El sufijo se calcula sobre la lista completa de movimientos de la ficha (del más viejo al más nuevo), no sobre lo tildado, así el nombre de un documento no cambia entre descargas.
- El cálculo lo hace la pestaña, que tiene la lista completa, y viaja con cada movimiento elegido.
- Limitación conocida: dentro de un mismo día el Explorador de Windows ordena por fojas como texto, no en el orden de la MEV.

### 3.6 Informe de verificación y avisos

- `_verificacion_AAAA-MM-DD_HHMM.txt` (fecha y hora de la descarga, para no pisar el informe de otra descarga en la misma carpeta), la página final del PDF único y el aviso en pantalla nombran cada faltante por fecha, fojas, descripción y nombre de archivo, y dicen qué devolvió la MEV (pantalla de verificación, login, búsqueda u otra, con título y tamaño).
- El `resumen.pdf` lista todos los movimientos de la ficha, no solo los tildados: una descarga parcial lo reemplaza por uno completo y al día.
- Al terminar con faltantes, el aviso ofrece **Bajar los que faltan**: una descarga nueva solo con esos movimientos, con los mismos nombres.
- Barra de progreso con "Documento 87 de 225, quedan unos 7 min" y botón **Detener** (ofrece guardar lo bajado o cancelar).
- Los textos que se tocan quedan sin guiones largos.

### 3.7 Página de verificación en la pestaña

Si la pestaña de la MEV muestra la pantalla de verificación (título `Validando acceso`), el content script no hace nada: no agrega botones ni avanza un recorrido de importación. Cuando la verificación se resuelve, el portal recarga la página y el content script vuelve a correr sobre la página real.

### 3.8 Monitoreo y keep-alive

- Mientras hay una descarga en curso, el escaneo automático no consulta la MEV (las causas PJN siguen) y queda pendiente: al terminar la descarga, el fondo lo corre. El keep-alive de la MEV no se manda durante una descarga (la descarga misma mantiene la sesión).
- Fuera de una descarga, el monitoreo mantiene su ritmo actual y corta la parte MEV de la corrida en el primer bloqueo, con la detección mejorada.

## 4. Pruebas

Unitarias (`node --test`, sin dependencias nuevas, sin datos reales):

- Firma de la pantalla de verificación con un HTML sintético de la misma estructura (título, script de Turnstile, cuerpo vacío, 2.000 bytes).
- Clasificación: `ok`, `desafio`, `login`, `sin-contexto` y `respuesta-inesperada`, incluida la regla de oro.
- Nombres: formato, fojas, sin fojas, tildes y ñ, fecha inválida, colisiones y su estabilidad entre la lista completa y una selección parcial.
- Portero: espaciado de 3.000 ms, fila de llamados concurrentes y escalera de esperas, con reloj simulado.

Chequeos: `npm run compile`, `npm test`, `npm run build` y `npm run zip` en verde.

Prueba real, con la MEV sin bloqueo y con el titular:

1. Descarga completa de un expediente de más de 200 proveídos: cero salteados por bloqueo; tiempo esperado, unos 12 minutos.
2. Descarga parcial de los últimos pasos: los nombres encajan en la carpeta de la descarga completa sin pisar nada.
3. Pausa forzada (navegar la MEV en otra pestaña durante la descarga hasta que bloquee): aparece el aviso, "Esperar y seguir" completa, "Detener y guardar lo bajado" entrega el parcial con su informe.

## 5. Riesgos

- La MEV puede cambiar el límite o su forma de contarlo: el ritmo se ajusta en una sola constante, pero hasta ajustarlo pueden aparecer pausas.
- El cupo es compartido con lo que el usuario navegue en la MEV y con otras sesiones del mismo usuario: aunque la extensión vaya a 20 por minuto, pueden aparecer pausas.
- Una descarga grande tarda unos 12 minutos y la pestaña no se puede usar para otra cosa durante ese tiempo.
- Sin medir: si la ficha y los adjuntos cuentan para el límite, y si pasar la verificación a mano acorta el bloqueo.
- No se agregan permisos ni hosts al manifest: no cambia lo que revisa Chrome Web Store por permisos.
