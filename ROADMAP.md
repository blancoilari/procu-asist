# Roadmap de ProcuAsist

ProcuAsist es una herramienta hecha por un abogado de la matricula, para colegas. Es gratuita y sin fines de lucro.

Este roadmap marca prioridades, no promesas cerradas. El orden puede cambiar segun estabilidad de los portales judiciales, feedback de usuarios y disponibilidad de prueba con casos reales.

## Estado: mantenimiento y publicación retomados el 29/09/2026

Por pedido del titular se preparó y se publicó la versión 0.8.1 (publicada en Chrome Web Store, verificado el 29/09/2026), con un intento de recuperación de descargas MEV, informes de pendientes y correcciones de integridad. Las ideas de versiones posteriores se conservan como referencia, no como compromisos de entrega.

Los pendientes internos de este repositorio no se llevan aca: viven en el mapa de pendientes del ecosistema del estudio (`proyectos\MAPA_PENDIENTES_2026-09-26.md`, fuera de este repositorio; identificadores P1 a P6).

## Version actual

- Publicada en Chrome Web Store: **v0.8.1** (verificado el 29/09/2026 con el servicio de actualizaciones de Chrome y en la ficha pública).
- En este repositorio: **v0.8.1**, la misma versión publicada.
- Ideas para una proxima version: Patricio las anota en un documento propio fuera del repositorio.

Lo que ya existe:

- **MEV / SCBA**: auto-login, marcadores, monitoreo basico, descarga ZIP del expediente, seleccion de pasos procesales, PDF resumen y descarga de adjuntos.
- **MEV sets de busqueda**: importacion masiva desde resultados y sets del portal MEV.
- **PJN**: auto-login SSO, lectura de listados y favoritos, descarga ZIP de expedientes desde SCW.
- **PJN monitoreo inicial**: importacion de listados SCW, paso a monitoreo y escaneo por feed o listado abierto.
- **Credenciales locales**: cifrado AES-GCM con clave de dispositivo automatica (sin PIN desde la 0.8.0).
- **Modelo local-first**: los datos se guardan en el navegador; no hay backend obligatorio.

Publicado en la v0.8.1 (Store, verificado el 29/09/2026):

- **Descarga MEV que no saltea documentos por la verificación**: ante la pantalla de la MEV se pausa o se detiene en vez de saltear, entrega lo bajado con un informe fechado de pendientes, nombra los archivos por fecha y ofrece "Bajar los que faltan". Lo que falla por otro motivo queda anotado como faltante y la descarga sigue.
- **Recuperación en una pestaña normal**: si la MEV contesta con su verificación al pedir un proveído, la extensión abre ese documento en una pestaña normal y espera a que el portal lo muestre, sin resolver desafíos. Está implementada, pero solo su espera del documento tiene pruebas unitarias y no se demostró frente a una verificación real: en la prueba asistida del 29/09/2026 (131 documentos y 22 adjuntos) no se puso en marcha.
- **Adjuntos lentos**: los de docs.scba.gov.ar tienen tiempo adicional para descargarse.
- **PDF único con respaldo**: si un adjunto no puede incorporarse al PDF único, se entrega un ZIP con los originales, el PDF de consulta y un aviso.
- **Escaneos parciales a la vista**: un barrido que no pudo leer todas las causas se informa como incompleto, con las causas pendientes. El monitoreo no usa la recuperación de la descarga y puede dejar causas pendientes ante la verificación de la MEV.
- **Límite del avance**: lo bajado se conserva solo durante la ejecución en curso; si la extensión se reinicia o se actualiza en el medio, la descarga se corta sin guardar ningún archivo.
- **Sin JusCABA/EJE**: se retiro el soporte del portal EJE. Salieron el permiso de host `https://eje.jus.gov.ar/*`, el content script, los parsers y selectores, el keep-alive, el color y la etiqueta de portal. El auto-login SSO contra Keycloak, que compartia archivo con EJE, quedo en `entrypoints/sso.content.ts` y sigue sirviendo a PJN.
- **Credenciales de portales retirados**: al arrancar, la extension borra las credenciales guardadas de EJE (`tl_cred_eje`), que ya no pueden usarse, y la alarma de keep-alive de ese portal.
- **Dependencias de desarrollo al dia**: `npm audit` de 18 vulnerabilidades (3 criticas) a 0, sin cambios en lo que se instala en el navegador.

Publicado en la v0.8.0 (Store, confirmado el 19/07/2026):

- **Sin PIN**: credenciales directas de los portales, cifradas con clave de dispositivo automatica; auto-login y reconexion que no se caen.
- **Onboarding operativo**: carga de credenciales, apertura de portales e "Importar todo" desde la bienvenida.
- **Multi-departamento MEV real**: los sets se recorren por todos los departamentos judiciales, con cambio de departamento automatico.
- **Avisos activos siempre**: se elimino la pausa por umbral al importar en masa.
- **Un solo boton Guardar**: guardar = monitorear, sin boton Monitorear aparte.

Publicado en la v0.7.0 (Store, 2026-07-05):

- **Causas unificadas**: guardar una causa es monitorearla; una sola pestana "Causas" con alertas agrupadas por expediente.
- **Plazos**: calculadora de plazos procesales en dias habiles, lista de vencimientos con avisos y export a calendario (.ics).
- **Backup local**: exportar e importar datos a JSON desde Ajustes (sin credenciales ni PIN).
- **Importacion completa**: sets MEV multi-departamento y listados PJN multi-pagina.

## Ya hecho (v0.6.x a v0.8.0)

Las metas de saneamiento publico y Store (v0.6.x), UI unificada en portales (v0.7.0) y SCBA/MEV mas solido (v0.8.0) ya se cumplieron y estan publicadas en la Store. Ver [CHANGELOG.md](CHANGELOG.md) para el detalle de cada version.

## Prioridad inmediata (anterior a la pausa): ProcuAsist gratis estable

### v0.9.0 - PJN mas solido

- Mejorar mensajes cuando falta token o sesion.
- Consolidar importacion desde relacionados/favoritos con mejor paginacion y diagnostico.
- Reforzar el monitoreo PJN: token/feed cuando este disponible y fallback SCW cuando no.
- Relevar y prototipar "Dejar nota" masivo para causas PJN donde el usuario sea letrado, solo en dias martes/viernes y con confirmacion manual antes de ejecutar.
- Reforzar collector y ZIP en expedientes grandes.
- Mejorar estados de progreso y verificacion.

### v1.0.0 - Vista diaria de procuracion

- Vista "movimientos desde fecha".
- Mostrar solo las causas que tuvieron novedades desde la fecha indicada, agrupando los movimientos dentro de cada causa.
- Al hacer click en una causa con novedades, abrir directamente el expediente en el portal correspondiente.
- Filtros por portal, causa y estado.
- Links directos para revisar movimientos cuando el portal lo permita.
- Mejor soporte para trabajo diario sobre causas guardadas o monitoreadas.

## Despues de la v1 gratis

### Capa premium futura

La etapa paga se pensara despues de consolidar el producto gratis.

Lineas candidatas:

- sync entre dispositivos
- equipos por estudio
- tablero web
- digest diario/semanal
- plazos y responsables
- copiloto IA sobre expediente
- borradores de presentaciones

### ProcuEstudio

ProcuEstudio sera una app web nueva y separada de la extension gratis.

Idea central:

- no pedirle al abogado que cargue todo de cero
- usar ProcuAsist como conector judicial con MEV y PJN
- importar causas, movimientos, documentos y datos detectables desde los portales
- dejar los datos dudosos como sugerencias para confirmar
- convertir cada causa en un expediente vivo del estudio

Documentos iniciales:

- [MVP de ProcuEstudio](docs/plans/procu-estudio-mvp.md)
- [Contrato de sincronizacion ProcuAsist -> ProcuEstudio](docs/plans/procu-estudio-sync-contract.md)

### SCBA PyNE

Objetivo futuro razonable:

- integrar `notificaciones.scba.gov.ar` cuando haga falta para gestion avanzada
- preparar borradores de presentaciones electronicas
- completar campos y texto base
- ayudar con adjuntos
- dejar listo para revision y firma

No se apunta inicialmente a firma o envio automatico sin control humano.

### PJN escritos

Objetivo futuro razonable:

- asistir en la preparacion de escritos
- generar PDF o borrador listo para subir
- guiar al usuario en el flujo del portal

## Como colaborar

- Reportar errores o pedir features: [blancoilariasistente@gmail.com](mailto:blancoilariasistente@gmail.com?subject=ProcuAsist%20-%20feedback)
- Issues en GitHub: <https://github.com/blancoilari/procu-asist/issues>
- Donaciones voluntarias: <https://cafecito.app/procuasist>

## Historial de versiones

Ver [CHANGELOG.md](CHANGELOG.md) para el detalle de cambios por version.
