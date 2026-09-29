# Publicación de ProcuAsist 0.8.1

Estado al 29/09/2026: el titular confirma que cargó el paquete y que el panel indica versión publicada 0.8.1. La última consulta pública disponible todavía devuelve 0.8.0; no se comprobó su actualización ni si la diferencia responde a caché o propagación. No confundir la confirmación del panel con una verificación independiente de la ficha pública.

## Paquete

Generar con npm run zip. Archivo: .output/procu-asist-0.8.1-chrome.zip.
El ZIP contiene manifest y recursos compilados, no el repositorio ni sus credenciales.
Actualizar el ítem existente dbkfeofoijnkclfpigimiodcccpjakem desde la pestaña Paquete del panel de desarrolladores. No crear otra extensión.

## Descripción para la ficha

ProcuAsist es una extensión gratuita para abogados argentinos que asiste en tareas de consulta de portales judiciales. No requiere una cuenta propia: guarda sus datos localmente en el navegador.

- Descarga actuaciones y adjuntos de MEV/SCBA en ZIP o PDF único, con selección de pasos.
- Conserva el avance y detalla documentos pendientes cuando el portal no permite completar una descarga.
- Puede abrir una pestaña para esperar la validación normal de la MEV, sin resolver desafíos.
- Si un archivo no cabe en el PDF único, entrega un ZIP con originales y PDF de consulta.
- Descarga expedientes PJN desde SCW cuando el portal permite acceder a sus documentos.
- Guarda causas, importa listados y muestra alertas de movimientos; los barridos incompletos indican pendientes.
- Calcula plazos con feriados y ferias configurables y exporta vencimientos a calendario.
- Exporta e importa un backup local sin credenciales.

Las credenciales se cifran localmente con AES-GCM y una clave generada en el dispositivo. No utiliza PIN maestro ni servidores propios. El acceso a los portales depende de la sesión y de sus verificaciones. No reemplaza el control profesional de actuaciones.

## Notas de versión

Recuperación de descargas MEV con conservación del avance, espera de adjuntos lentos e informe de faltantes. Corrección del aviso de barridos incompletos. Los adjuntos incompatibles con PDF único se conservan en un ZIP. Se retira el permiso del portal EJE/JusCABA y se conserva el acceso SSO de PJN. Sin dependencia de Estudio OS ni permisos nuevos respecto del código de 0.8.1.

## Evidencia y límites

Prueba asistida de descarga MEV el 29/09: 131 documentos y 22 adjuntos. Suite actual: 94 pruebas y tipos correctos. La recuperación automática corresponde a descargas; el monitoreo puede quedar pendiente ante una verificación. No se promete disponibilidad del portal ni ausencia universal de errores. El historial de ensayos y de cambios está en CHANGELOG.md.

Usar las cinco capturas sintéticas de docs/store-assets/v0.8.1 y su README. No subir capturas de causas reales. Corregir en la ficha la referencia antigua al PIN maestro. Comprobar versión, paquete, descripción y capturas antes de enviar a revisión. Google decide los plazos y la aprobación.

Procedimiento oficial: https://developer.chrome.com/docs/webstore/update
