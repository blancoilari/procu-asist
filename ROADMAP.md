# Roadmap de ProcuAsist

ProcuAsist es una herramienta hecha por un abogado de la matricula, para colegas. Es gratuita y sin fines de lucro.

Este roadmap marca prioridades, no promesas cerradas. El orden puede cambiar segun estabilidad de los portales judiciales, feedback de usuarios y disponibilidad de prueba con casos reales.

## Estado: en pausa desde el 25/09/2026

Por decision del titular, ProcuAsist queda en pausa y la prioridad pasa a otro sistema del estudio. No hay fecha para retomar. Lo que sigue en este documento (v0.9.0, v1.0.0, capa premium, ProcuEstudio) son ideas anteriores a la pausa y se conservan como historia; no son un plan vigente.

Condiciones para retomar, en este orden:

1. Revisar que automatizaciones sobreviven a la regla publicada por la MEV para sus usuarios (son para personas, no para sistemas informaticos ni agentes de IA; el mal uso bloquea al usuario; ver la seccion "Verificacion de la MEV" del [README](README.md)). Auto-login, keep-alive, monitoreo automatico, importacion masiva y descarga por detras usan la cuenta del abogado en forma automatizada.
2. Prueba real de la bajada de documentos contra la MEV (el 23/09/2026 el portal sirvio 0 de 225).
3. Decision de publicar o no la 0.8.1 (cambia `host_permissions`: revision manual de la Store; ver `docs/release-v0.8.1-assets.md`).

Los pendientes internos de este repositorio no se llevan aca: viven en el mapa de pendientes del ecosistema del estudio (`proyectos\MAPA_PENDIENTES_2026-09-26.md`, fuera de este repositorio; identificadores P1 a P6).

## Version actual

- Publicada en Chrome Web Store: **v0.8.0** (publicada; confirmado por Patricio el 2026-07-19).
- En este repositorio: **v0.8.1** (armada el 09/09/2026, sin publicar; en pausa).
- Ideas para una proxima version: Patricio las anota en un documento propio fuera del repositorio.

Lo que ya existe:

- **MEV / SCBA**: auto-login, marcadores, monitoreo basico, descarga ZIP del expediente, seleccion de pasos procesales, PDF resumen y descarga de adjuntos.
- **MEV sets de busqueda**: importacion masiva desde resultados y sets del portal MEV.
- **PJN**: auto-login SSO, lectura de listados y favoritos, descarga ZIP de expedientes desde SCW.
- **PJN monitoreo inicial**: importacion de listados SCW, paso a monitoreo y escaneo por feed o listado abierto.
- **Credenciales locales**: cifrado AES-GCM con clave de dispositivo automatica (sin PIN desde la 0.8.0).
- **Modelo local-first**: los datos se guardan en el navegador; no hay backend obligatorio.

Preparado en la v0.8.1 (sin publicar):

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
