# Roadmap de ProcuAsist

ProcuAsist es una herramienta hecha por un abogado de la matricula, para colegas. Es gratuita y sin fines de lucro.

Este roadmap marca prioridades, no promesas cerradas. El orden puede cambiar segun estabilidad de los portales judiciales, feedback de usuarios y disponibilidad de prueba con casos reales.

## Version actual: v0.6.1

Lo que ya existe:

- **MEV / SCBA**: auto-login, marcadores, monitoreo basico, descarga ZIP del expediente, seleccion de pasos procesales, PDF resumen y descarga de adjuntos.
- **MEV sets de busqueda**: importacion masiva desde resultados y sets del portal MEV.
- **PJN**: auto-login SSO, lectura de listados y favoritos, descarga ZIP de expedientes desde SCW.
- **JUSCABA / EJE**: auto-login y extraccion basica de causas.
- **Credenciales locales**: cifrado AES-GCM protegido por PIN.
- **Modelo local-first**: los datos se guardan en el navegador; no hay backend obligatorio.

## Prioridad inmediata: ProcuAsist gratis estable

### v0.6.x - Saneamiento publico y Store

- Mantener checklist QA antes de cada envio a Chrome Web Store.
- Mejorar capturas y textos de la ficha publica.
- Pulir mensajes de sesion, errores y estados de carga.
- Dejar claro que ProcuAsist gratis no requiere cuentas ni servidores.

### v0.7.0 - UI unificada en portales

- Unificar la botonera de acciones en MEV, PJN y EJE.
- Usar un mismo lenguaje visual para Configuracion, ZIP, Guardar y Monitorear.
- Agregar en PJN los botones flotantes Guardar y Monitorear, ademas de ZIP.
- Alinear estados de carga, exito, error y progreso.
- Tomar como base el estilo mas sobrio de PJN.
- Separar o filtrar las causas del panel lateral por portal/jurisdiccion para no mezclar MEV, PJN y EJE.

### v0.8.0 - SCBA / MEV mas solido

- Mejorar importaciones desde resultados y sets de busqueda MEV.
- Mantener `notificaciones.scba.gov.ar` fuera del flujo gratuito hasta resolver diferencias de login y sincronizacion con MEV.
- Revisar monitoreo, frecuencia, mensajes y casos de sesion vencida.
- Mejorar errores y diagnostico para soporte.

### v0.9.0 - PJN mas solido

- Mejorar mensajes cuando falta token o sesion.
- Agregar importacion de causas PJN con dos acciones: relacionadas y favoritas.
- Consolidar importacion desde favoritos/listados.
- Reforzar collector y ZIP en expedientes grandes.
- Mejorar estados de progreso y verificacion.

### v1.0.0 - Vista diaria de procuracion

- Vista "movimientos desde fecha".
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
