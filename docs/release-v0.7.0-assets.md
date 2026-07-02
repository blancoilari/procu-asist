# Assets de release - ProcuAsist v0.7.0

Materiales para actualizar Chrome Web Store. La version publicada actualmente en la Store es la 0.6.7 (2026-05-28); esta release la reemplaza y consolida las versiones internas 0.6.8 y 0.6.9, que no se publicaron.

## 1. Resumen de version

ProcuAsist v0.7.0 unifica marcadores y monitoreo en una sola pestana "Causas" (guardar una causa es monitorearla), agrega calculadora de plazos procesales con vencimientos y export a calendario, backup local a JSON, importacion completa de sets MEV multi-departamento y de listados PJN multi-pagina, y alertas agrupadas por expediente.

## 2. Descripcion corta

> Descarga expedientes MEV/SCBA y PJN en ZIP, guarda y monitorea causas, calcula plazos procesales y avisa vencimientos.

## 3. Descripcion larga sugerida

```text
ProcuAsist es una extension gratuita de Chrome para abogados argentinos que automatiza tareas repetitivas en portales judiciales.

HECHO POR UN ABOGADO DE LA MATRICULA, PARA COLEGAS
No requiere crear una cuenta. Tus datos se guardan localmente en tu navegador.

QUE HACE
- Descarga expedientes completos de MEV/SCBA en ZIP o en un PDF unico.
- Descarga expedientes de PJN desde SCW cuando el portal permite acceder a los documentos.
- Permite seleccionar que actuaciones incluir antes de generar la descarga.
- Guarda causas en una lista unificada: guardar una causa es monitorearla, con avisos de movimientos nuevos y pausa por causa.
- Muestra alertas agrupadas por expediente, con el ultimo movimiento de cada causa.
- Calcula plazos procesales en dias habiles judiciales (feriados y ferias configurables), lista vencimientos con avisos y exporta a calendario (.ics).
- Busca movimientos desde una fecha indicada en causas monitoreadas.
- Importa causas desde resultados y sets de busqueda MEV, incluso sets que abarcan varios departamentos judiciales.
- Importa causas desde listados PJN/SCW (relacionados o favoritos), recorriendo todas las paginas.
- Backup local: exporta e importa tus datos a JSON desde Ajustes (nunca incluye credenciales ni PIN).
- Cifra credenciales localmente con PIN maestro.

PORTALES SOPORTADOS
- MEV / SCBA: mev.scba.gov.ar
- PJN: scw.pjn.gov.ar, portalpjn.pjn.gov.ar, api.pjn.gov.ar
- JUSCABA / EJE: eje.jus.gov.ar, con funciones basicas

SEGURIDAD Y PRIVACIDAD
Las credenciales se cifran con AES-GCM y quedan guardadas en tu computadora. ProcuAsist no necesita servidores para funcionar en su version gratuita.

DISCLAIMER
ProcuAsist se ofrece "tal cual", sin garantias. No reemplaza el control manual de actuaciones judiciales ni el criterio profesional del abogado.
```

## 4. Notas de version (para la ficha y el changelog de la Store)

```text
Novedades de la v0.7.0:

- Causas unificadas: una sola pestana reemplaza a Marcadores y Monitoreo. Guardar una causa es monitorearla; podes pausar los avisos por causa. Los datos existentes se migran solos.
- Alertas por expediente: una tarjeta por causa con su ultimo movimiento; los contadores cuentan causas con novedades, no movimientos sueltos.
- Plazos y vencimientos: calculadora de plazos procesales en dias habiles judiciales (feriados 2026-2027 y ferias configurables), lista de vencimientos con avisos 3 dias antes, el dia del vencimiento y al vencer, y export a calendario (.ics).
- Backup local: exporta e importa marcadores, monitores, alertas, plazos y preferencias a JSON desde Ajustes. Nunca incluye credenciales ni PIN.
- Importacion completa MEV: sets que abarcan varios departamentos judiciales se recorren completos, departamento por departamento; la importacion desde resultados recorre todas las paginas.
- Importacion PJN multi-pagina arreglada y descargas PJN con timeout y boton de cancelar.
- Monitoreo mas preciso: los movimientos nuevos se detectan por fecha, no por conteo.
- Correcciones de estabilidad: alarmas que no se reinician al arrancar el navegador, token PJN que sobrevive reinicios, limite de reintentos de auto-login, PDFs multi-pagina sin solapamientos y varios arreglos de UI.
```

## 5. Screenshots

Las capturas de la v0.6.1 (`docs/store-assets/v0.6.1/screenshots-1280x800`) quedaron desactualizadas en dos pantallas clave. Antes de publicar hay que rehacer al menos:

- [ ] Panel lateral con la nueva pestana "Causas" (sub-vistas Causas y Alertas agrupadas por expediente). Reemplaza a `02_Menu_procu_Asist_.png` y `05_b_marcadores_.png`.
- [ ] Nueva pestana "Plazos" con la calculadora y la lista de vencimientos.
- [ ] Dialogo de importacion de set MEV multi-departamento (opcional).

Se pueden conservar las capturas de descarga ZIP MEV y PJN si la UI no cambio de forma visible:

- `03_menu_flotante_.png`
- `04_descargar_expte_completo_.png`
- `06_PJN_descarga_Expte_completo_.png`

Sugerencia de 5 principales para la Store: Causas unificadas, Alertas por expediente, Plazos, modal ZIP MEV, modal ZIP PJN. Todas las capturas deben ir anonimizadas (sin caratulas ni datos reales de clientes).

## 6. Checklist tecnico

- [x] `npm run compile` (2026-07-02, sin errores)
- [x] `npm run build` (2026-07-02, sin errores)
- [x] `npm run zip` (2026-07-02)
- [x] ZIP generado: `.output/procu-asist-0.7.0-chrome.zip`
- [ ] QA manual segun checklist de la seccion 7.
- [ ] Commit y push a GitHub.
- [ ] Version enviada a revision en Chrome Web Store.

## 7. Checklist de publicacion (QA adaptado de docs/qa-v0.6.1.md a lo que cambio en 0.7.0)

Objetivo: validar la migracion al modelo unificado y las funciones nuevas antes de subir a Chrome Web Store. Advertencia: la migracion (case-reconciler) toca datos reales de usuarios que vienen de la 0.6.7 publicada; probar la actualizacion sobre un perfil con datos previos, no solo instalacion limpia.

### 7.0 Alcance de cambios v0.7.0

| Cambio | Estado |
| --- | --- |
| Pestana "Causas" unificada (marcador = monitoreo) | Implementada; pendiente QA manual |
| Conciliacion de datos previos al iniciar (case-reconciler) | Implementada; pendiente QA sobre perfil con datos de 0.6.7 |
| Alertas agrupadas por expediente | Implementada; pendiente QA manual |
| Pestana "Plazos" + vencimientos + export .ics | Implementada; pendiente QA manual |
| Backup y restauracion JSON | Implementada; pendiente QA manual |
| Importacion sets MEV multi-departamento | Implementada; pendiente QA manual en MEV real |
| Importacion PJN multi-pagina (paginador RichFaces y fallback por links numerados) | Implementada; pendiente QA manual en SCW real |
| Monitoreo por fecha (no por conteo) | Implementada; pendiente QA manual |
| Descargas PJN con timeout y cancelar | Implementada; pendiente QA manual |

### 7.1 Preparacion

- [ ] Ejecutar `npm run compile`, `npm run build`, `npm run zip`.
- [ ] Cargar `.output/chrome-mv3` desde `chrome://extensions`.
- [ ] Confirmar que el panel muestra `v0.7.0`.
- [ ] Probar sobre un perfil con datos de la 0.6.7 (marcadores y monitores previos) ademas de un perfil limpio.
- [ ] Abrir una pestana MEV logueada y una pestana PJN/SCW logueada.

### 7.2 Migracion al modelo unificado (critico)

- [ ] Al actualizar desde 0.6.7, los marcadores existentes aparecen en la pestana Causas.
- [ ] Los marcadores previos sin monitor ganan su monitor (conciliacion).
- [ ] Los monitores previos sin marcador ganan su marcador.
- [ ] No se pierden alertas previas ni se duplican causas.
- [ ] Causas MEV sin IDs internos muestran estado "sin escaneo" y no rompen el escaneo del resto.

### 7.3 Pestana Causas

- [ ] La pestana Causas reemplaza a Marcadores y Monitoreo; no quedan restos de las pestanas viejas.
- [ ] La busqueda filtra por numero, caratula o juzgado.
- [ ] La tarjeta muestra badge NOVEDAD, estado de avisos y ultimo movimiento.
- [ ] El menu por causa: abrir, copiar caratula, pausar/reanudar avisos, eliminar.
- [ ] Guardar una causa desde MEV o PJN la agrega monitoreada (sin toggle previo).
- [ ] Pausar avisos detiene las alertas de esa causa; reanudar las reactiva.
- [ ] Eliminar una causa borra marcador, monitor y alertas en cascada.

### 7.4 Alertas por expediente

- [ ] La sub-vista Alertas agrupa por causa, con ultimo movimiento y badge NOVEDAD.
- [ ] Click en una tarjeta abre la causa y la marca leida completa.
- [ ] Los contadores (pestana principal, sub-tab Alertas, tarjeta) cuentan expedientes con novedades y no quedan desfasados despues de marcar leidas.

### 7.5 Plazos y vencimientos

- [ ] La calculadora computa dias habiles judiciales: saltea fines de semana y feriados nacionales.
- [ ] Las ferias o dias inhabiles personalizados se respetan en el computo.
- [ ] El plazo de gracia se informa.
- [ ] Verificar contra computo manual al menos 3 plazos (corto, con feriado en el medio, con feria personalizada).
- [ ] La lista de vencimientos muestra badges de urgencia coherentes.
- [ ] Las notificaciones llegan 3 dias antes, el dia del vencimiento y al vencer (probar con fechas cercanas).
- [ ] `Exportar a calendario (.ics)` genera un archivo que Google Calendar u Outlook importan sin errores, con eventos de dia completo y alarma un dia antes.

### 7.6 Backup y restauracion

- [ ] Exportar genera un JSON con marcadores, monitores, alertas, plazos y preferencias.
- [ ] El JSON exportado NO contiene credenciales, PIN ni material del vault (revisar el archivo a mano).
- [ ] Importar sobre un perfil con datos hace merge sin duplicar ni pisar causas existentes.
- [ ] Importar un archivo invalido o vacio falla con mensaje claro, sin romper datos existentes.

### 7.7 MEV / SCBA

- [ ] En un expediente MEV aparece la botonera flotante y Guardar deja la causa monitoreada.
- [ ] ZIP abre modal de seleccion y genera archivo con `resumen.pdf` y documentos seleccionados.
- [ ] Modo "Un PDF" genera el PDF unico con pagina de verificacion si hubo errores.
- [ ] Desde resultados MEV, Importar recorre todas las paginas (hasta 15) antes del modal.
- [ ] Importar un set multi-departamento ofrece "solo este departamento" o "todos" y recorre organismo por organismo sin trabarse en paginas vacias.
- [ ] `Buscar movimientos desde esa fecha` sigue funcionando sobre causas monitoreadas.
- [ ] Movimientos nuevos se detectan por fecha: un movimiento viejo eliminado del listado no dispara falsa alerta.

### 7.8 PJN

- [ ] En expediente SCW aparece boton ZIP; el modal lista actuaciones y filtra por categoria.
- [ ] Descarga con documento trabado corta a los 45 segundos e informa sin romper el ZIP.
- [ ] `Cancelar descarga` funciona durante la generacion.
- [ ] Importar relacionados/favoritos recorre todas las paginas: con flecha "siguiente" o, si el paginador muestra solo numeros de pagina, avanzando por los links numerados (fallback por numero de pagina activa + 1); el modal informa cuantas paginas recolecto y avisa si corto por el tope de 25.
- [ ] La importacion PJN agrega causas monitoreadas sin duplicados.
- [ ] Acciones `Dejar nota` / `Dejar notas` visibles solo martes/viernes; el flujo individual abre el modal oficial de PJN sin confirmar automaticamente.
- [ ] Alertas PJN muestran portal, numero, caratula, juzgado y movimiento; el click abre la causa.

### 7.9 EJE / JUSCABA

- [ ] La extension no rompe la navegacion normal del portal.
- [ ] Confirmar el estado esperado de EJE en la UI (quedo oculto desde 0.6.7).

### 7.10 Privacidad y seguridad

- [ ] Las credenciales se guardan solo despues de configurar PIN.
- [ ] Configurar el PIN con credenciales ya guardadas no re-clavea el vault ni las pierde.
- [ ] El vault bloqueado no muestra credenciales en claro.
- [ ] El auto-login corta tras el limite de reintentos (MEV y Keycloak/SSO PJN) sin loops.
- [ ] No hay llamadas a backend propio para funciones gratuitas.
- [ ] El README y la ficha Store aclaran que los datos quedan locales.

### 7.11 Publicacion

- [ ] Rehacer screenshots anonimizadas (Causas, Alertas, Plazos; ver seccion 5).
- [ ] Confirmar que `CHANGELOG.md` tiene entrada 0.7.0.
- [ ] Confirmar que `package.json` y el manifest generado dicen `0.7.0`.
- [ ] Actualizar descripcion y notas de version en el dashboard.
- [ ] Subir `.output/procu-asist-0.7.0-chrome.zip` al dashboard de Chrome Web Store.
- [ ] Guardar numero de version enviada a revision y fecha de envio.
- [ ] Tras la aprobacion, actualizar README y ROADMAP (version publicada pasa a 0.7.0).

### 7.12 Riesgos conocidos aceptables

- La conciliacion de datos corre sobre datos reales de usuarios de la 0.6.7: es el punto de mayor riesgo de esta release y el QA de 7.2 no es opcional.
- El computo de plazos es una ayuda, no reemplaza el control manual del abogado; los feriados cargados llegan hasta 2027 y las ferias dependen de carga manual del usuario.
- MEV depende de sesion abierta del usuario; el paginador y los sets pueden cambiar sin aviso.
- El paginador RichFaces de SCW es fragil; un cambio del portal puede romper la importacion multi-pagina.
- Algunos expedientes PJN pueden no entregar PDF descargable segun estado, permisos o tipo de actuacion.
- `notificaciones.scba.gov.ar` sigue fuera del alcance gratuito.

## 8. Mensaje para compartir

```text
Actualice ProcuAsist, la extension gratis de Chrome para abogados.

Ahora guardar una causa es monitorearla: una sola lista de causas con alertas por expediente. Suma calculadora de plazos procesales con avisos de vencimiento y export a calendario, backup local de tus datos, e importacion completa de sets MEV y listados PJN.

Chrome Web Store:
https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem
```
