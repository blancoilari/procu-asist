# Publicación de ProcuAsist 0.8.1

Estado al 29/09/2026: la 0.8.1 es la versión pública en Chrome Web Store. Se verificó ese día con el servicio de actualizaciones de Chrome, que para el identificador de la extensión devuelve la versión 0.8.1, y en la ficha pública. La descripción de la ficha todavía no se corrigió (ver "Ficha de la Store", abajo).

## Paquete

Paquete subido: `.output/procu-asist-0.8.1-chrome.zip`, generado el 29/09/2026 con `npm run zip` (WXT 0.21.4) desde la rama `descarga-confiable-mev`, ya integrada en `master`.

- Tamaño: 616.728 bytes (616,73 kB).
- SHA-256: `1db749aa37d113d26cc2cceaedd33d18889bd9dad725c8f144297ccf7957fd6b`.
- Su `manifest.json` declara la versión 0.8.1, trae `options_ui.open_in_tab` (el campo que agrega WXT 0.21) y pide los mismos permisos que la 0.8.0, menos el host del portal EJE/JusCABA.

Advertencia: existe otro `.output/procu-asist-0.8.1-chrome.zip`, armado el 09/09/2026 en el checkout principal (605.055 bytes, SHA-256 `84ee4d6972b50f71c47b21458df026b3f58b7e51ee886905bcea6c85e1a64c56`). Se armó con WXT 0.20.20 y no tiene los cambios de descarga de la MEV. Está obsoleto: no es el paquete publicado y no debe subirse ni tomarse como referencia de la 0.8.1.

El ZIP contiene manifest y recursos compilados, no el repositorio ni sus credenciales.
Actualizar el ítem existente dbkfeofoijnkclfpigimiodcccpjakem desde la pestaña Paquete del panel de desarrolladores. No crear otra extensión.

## Descripción para la ficha

Texto para reemplazar la descripción pública, que todavía menciona el PIN maestro:

ProcuAsist es una extensión gratuita para abogados argentinos que asiste en tareas de consulta de portales judiciales. No requiere una cuenta propia: guarda sus datos localmente en el navegador.

- Descarga actuaciones y adjuntos de MEV/SCBA en ZIP o PDF único, con selección de pasos.
- Si el portal no permite completar una descarga, entrega lo bajado hasta ese momento y lista los documentos pendientes. Si la extensión se reinicia durante la descarga, la descarga se corta sin guardar.
- Si la MEV muestra su pantalla de verificación al pedir un proveído, puede abrir ese documento en una pestaña normal del portal y esperar a que se muestre, sin resolver desafíos. Si el portal no lo muestra, la descarga se detiene y entrega lo bajado con la lista de pendientes.
- Si un archivo no puede incorporarse al PDF único, entrega un ZIP con los originales y el PDF de consulta.
- Descarga expedientes PJN desde SCW cuando el portal permite acceder a sus documentos.
- Guarda causas, importa listados y muestra alertas de movimientos; los barridos incompletos indican pendientes.
- Calcula plazos con feriados y ferias configurables y exporta vencimientos a calendario.
- Exporta e importa un backup local sin credenciales.

Las credenciales se cifran localmente con AES-GCM y una clave generada en el dispositivo. No utiliza PIN maestro ni servidores propios. El acceso a los portales depende de la sesión y de sus verificaciones. No reemplaza el control profesional de actuaciones.

## Notas de versión

Descarga MEV que, ante la verificación del portal al pedir un proveído, intenta recuperar el documento en una pestaña normal, sin resolver desafíos, y si no lo consigue entrega lo bajado con un informe de faltantes. Más tiempo para adjuntos lentos. Aviso de barridos de monitoreo incompletos. Los adjuntos incompatibles con el PDF único se conservan en un ZIP. Se retira el permiso del portal EJE/JusCABA y se conserva el acceso SSO de PJN. Sin permisos nuevos respecto de 0.8.0.

## Evidencia y límites

- Prueba asistida de descarga MEV el 29/09/2026: 131 documentos y 22 adjuntos.
- Suite: 94 casos con `npm test` y tipos correctos al cierre de la preparación.
- La recuperación por pestaña normal está implementada, pero solo su espera del documento tiene pruebas unitarias (la apertura y el cierre de la pestaña, el control de que sea el documento pedido y la detención cuando falla no tienen pruebas automáticas), y no se demostró frente a una verificación real: en la prueba asistida ninguna pantalla de verificación la puso en marcha. Con un adjunto de la MEV o con la sesión cerrada no hay recuperación: la descarga se pausa.
- El avance de una descarga se conserva solo durante la ejecución en curso. Si la extensión se reinicia o se actualiza en el medio, la descarga se corta sin guardar ningún archivo y hay que empezarla de nuevo.
- La recuperación corresponde a las descargas: el monitoreo puede dejar causas pendientes ante una verificación, y hay que volver a escanear después de comprobar la sesión.
- No se promete disponibilidad del portal ni ausencia de errores. El historial de ensayos y de cambios está en CHANGELOG.md.

## Ficha de la Store

- Descripción: la pública todavía dice que las credenciales se cifran "con PIN maestro" y que el backup "nunca incluye credenciales ni PIN". El PIN no existe desde la 0.8.0. La corrección, con el texto de "Descripción para la ficha", queda pendiente en el panel de la Store y la hace el titular.
- Capturas: las cinco publicadas son las maquetas sintéticas de la 0.7.0 (`docs/store-assets/v0.7.0`), sin datos reales. Las cinco maquetas de `docs/store-assets/v0.8.1`, también sintéticas, no se subieron. No subir capturas de causas reales.
- En cada nueva versión, comprobar versión, paquete (SHA-256), descripción y capturas antes de enviar a revisión. Google decide los plazos y la aprobación.

Procedimiento oficial: https://developer.chrome.com/docs/webstore/update
