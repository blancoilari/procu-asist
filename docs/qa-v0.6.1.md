# QA checklist - ProcuAsist v0.6.1

Objetivo: validar que la version gratuita quede estable antes de subirla a Chrome Web Store.

Fecha objetivo: 2026-04-27.

## 0. Alcance de mejoras v0.6.1

| Mejora | Estado |
| --- | --- |
| Botonera unificada en MEV, PJN y EJE | Implementada; pendiente QA visual en portales reales |
| Importacion desde resultados MEV | Implementada; pendiente QA manual |
| Importacion desde sets de busqueda MEV | Implementada; pendiente QA manual |
| Movimientos desde fecha en causas MEV monitoreadas | Implementada; pendiente QA manual |
| Filtros por portal en panel lateral | Implementada; pendiente QA visual |
| Importacion y monitoreo inicial PJN desde listados SCW | Implementada; pendiente QA manual |
| Materiales de Store, screenshots y claims publicos | Enviados a revision en Chrome Web Store como v0.6.2 |
| `notificaciones.scba.gov.ar` | Diferido fuera de v0.6.1 |

## 1. Preparacion

- [x] Ejecutar `npm run compile`.
- [x] Ejecutar `npm run build`.
- [x] Ejecutar `npm run zip`.
- [ ] Cargar `.output/chrome-mv3` desde `chrome://extensions`.
- [ ] Confirmar que el panel muestra `v0.6.2`.
- [ ] Abrir una pestana MEV logueada.
- [ ] Abrir una pestana PJN/SCW logueada si se va a probar PJN.

## 2. Side panel

- [ ] Abre y cierra correctamente desde el icono de la extension.
- [ ] La busqueda filtra por numero, caratula o juzgado.
- [ ] La pestana Marcadores carga sin errores.
- [ ] La pestana Monitoreo carga sin errores.
- [ ] La pestana Ajustes muestra version, privacidad, soporte y enlaces.
- [ ] Los contadores de alertas no quedan desfasados despues de marcar como leidas.

## 3. MEV / SCBA

- [ ] En un expediente MEV aparece la botonera unificada: Configurar, ZIP, Guardar, Monitorear.
- [ ] Guardar cambia a estado `Guardado`.
- [ ] Monitorear cambia a estado `Monitoreando`.
- [ ] ZIP abre modal de seleccion de pasos.
- [ ] ZIP genera archivo con `resumen.pdf` y documentos seleccionados.
- [ ] Si algun documento falla, el ZIP incluye `_verificacion.txt`.
- [ ] Desde resultados MEV, el boton Importar importa causas visibles y las monitorea.
- [ ] Desde sets de busqueda MEV, `Importar set` recorre los organismos del set y muestra resumen final.

## 4. Fuera de alcance: SCBA Notificaciones

- [ ] Confirmar que ProcuAsist no inyecta botones en `notificaciones.scba.gov.ar`.
- [x] Confirmar que el manifest no solicita permisos para `notificaciones.scba.gov.ar`.
- [ ] Confirmar que el panel no muestra `Completar datos MEV` para causas importadas desde Notificaciones.

## 5. Monitoreo y movimientos desde fecha

- [ ] `Buscar movimientos desde esa fecha` arranca el barrido.
- [ ] Si falta pestana MEV, informa que se necesita abrir MEV.
- [ ] Si hay movimientos desde la fecha indicada, aparecen en Alertas.
- [ ] Los links de las alertas abren la causa o el portal correspondiente.
- [ ] `Marcar todas como leidas` actualiza contador y listado.

## 6. PJN

- [ ] En expediente SCW aparece boton ZIP.
- [x] En expediente SCW aparece boton `Dejar nota` cuando PJN muestra "Dejar Nota" y es martes/viernes.
- [x] El boton `Dejar nota` abre el flujo oficial de "Dejar Nota" de PJN sin ejecutar una accion por fuera del portal.
- [x] En listado SCW `Relacionados letrado` aparece `Dejar notas` solo martes/viernes.
- [x] `Dejar notas` arma preview masivo, cruza contra marcadores y excluye causas `EN LETRA`.
- [x] En el panel, Marcadores PJN muestra `Dejar notas PJN` solo martes/viernes, con seleccion manual y detalle copiable.
- [ ] El modal lista actuaciones y permite filtrar por categoria.
- [ ] Se puede seleccionar y deseleccionar actuaciones.
- [ ] El ZIP PJN incluye resumen y documentos seleccionados cuando el portal entrega PDFs.
- [ ] Si faltan documentos o falla una descarga, se informa sin romper el ZIP completo.
- [ ] En listados SCW aparece el boton de importacion correspondiente.
- [ ] Importar relacionados/favoritos agrega marcadores PJN sin duplicados.
- [ ] Desde Marcadores se pueden pasar causas PJN visibles a Monitoreo.
- [ ] `Escanear ahora` en PJN usa el feed si hay token o el listado SCW abierto si no lo hay.
- [ ] Alertas PJN muestran portal, numero, caratula, juzgado y movimiento.
- [ ] Al hacer click en una alerta PJN se abre la causa o el portal correspondiente.

### Relevamiento "Dejar Nota" PJN - 2026-05-05

Capturas aportadas sobre `scw.pjn.gov.ar/scw/expediente.seam?cid=209646`:

- El expediente muestra el boton nativo `Dejar Nota` junto a `Volver a Mi Lista` y `Presentar escrito`.
- Al hacer click, PJN abre un modal titulado `Libro de Notas Electronicas`.
- El modal pregunta: `Confirma dejar nota en el expediente seleccionado?`.
- Acciones del modal: `Confirmar` y `Cancelar`.
- Al confirmar, PJN vuelve al expediente y muestra alerta informativa: `Se ha dejado nota en el expediente en forma correcta. Es posible verificar dicha accion en la seccion de notas del expediente`.
- La seccion `Notas` agrega una fila con fecha `05/05/2026`, interviniente `PATRICIO GREGORIO BLANCO ILARI` y detalle horario.
- El boton nativo `Dejar Nota` sigue visible aunque la nota del dia ya haya sido dejada.
- Si se intenta confirmar otra vez el mismo dia, PJN responde con alerta de error: `Ya se ha dejado nota con el usuario 20301911298 en el expediente: 3638/2023. No es posible realizar dicha accion mas de una vez al dia por expediente`.
- Prueba local: el boton `Dejar nota` de ProcuAsist abre el mismo modal nativo de PJN; la extension no confirma por si sola.
- Mejora local probada: ProcuAsist detecta las alertas de PJN y cambia su boton a `Nota hecha` si el portal informa exito, o a `Ya hecha` si informa duplicado del dia.
- Observacion posterior a las 20:47 del mismo dia: PJN ya no muestra el boton nativo `Dejar Nota` en expedientes SCW; ProcuAsist debe dejar la accion deshabilitada porque no hay flujo oficial para abrir.
- En Network se observa actividad de carga/AJAX contra `expediente.seam` y `collect`, pero las capturas no muestran un request de confirmacion abierto con payload/headers; no alcanza para documentar parametros JSF exactos.

Decision tecnica: ProcuAsist debe limitarse a abrir el boton nativo `Dejar Nota` y dejar la confirmacion en manos del usuario. No automatizar `Confirmar` hasta tener contrato tecnico y decision explicita.

### Relevamiento "Dejar notas" PJN masivo - 2026-05-05

Capturas aportadas sobre `scw.pjn.gov.ar/scw/consultaListaRelacionados.seam`:

- En el listado `Relacionados letrado` aparece el boton flotante `Dejar notas`.
- El boton abre un modal `Dejar notas PJN` con paginas revisadas, metricas y tabla de expedientes.
- El modal muestra contadores de seleccionadas, elegibles, `EN LETRA` y no marcadas.
- Las causas `EN LETRA` aparecen como `Excluida: EN LETRA` y quedan sin seleccion activa.
- `Copiar detalle` funciona y cambia temporalmente a `Copiado`.
- Alcance validado: preparacion/copiado del lote. No ejecuta notas masivas automaticamente.

### Relevamiento panel Marcadores PJN - 2026-05-05

Capturas aportadas del sidepanel:

- En Marcadores aparece `Dejar notas PJN (x/y)` cuando hay marcadores PJN.
- El bloque muestra contadores de elegibles, `EN LETRA` y sin letrado.
- Permite seleccion manual de causas elegibles.
- `Copiar detalle` copia la preparacion y cambia temporalmente a `Copiado`.
- Alcance validado: preparacion desde marcadores. No ejecuta notas automaticamente.
- Ajuste posterior: las acciones de nota de PJN no se muestran fuera de martes/viernes.

### QA "Dejar nota" PJN - 2026-05-08

- En viernes de nota, el listado `Relacionados letrado` muestra el boton nativo `Dejar nota` de PJN y el boton ProcuAsist `Dejar notas`.
- El modal ProcuAsist `Dejar notas PJN` revisa la pagina visible, cruza contra marcadores, excluye causas `EN LETRA` y deja seleccionadas las causas elegibles.
- En expediente SCW `COM 001520/2023`, ProcuAsist muestra `Dejar nota` junto a `ZIP`, `Guardado` y `Monitorear`.
- Al hacer click en `Dejar nota`, ProcuAsist abre el modal oficial de PJN `Libro de Notas Electronicas`.
- El modal oficial pregunta `Confirma dejar nota en el expediente seleccionado?` y ofrece `Confirmar` / `Cancelar`.
- Alcance validado: ProcuAsist no confirma automaticamente; la confirmacion queda en manos del usuario.

## 7. EJE / JUSCABA

- [ ] La extension no rompe la navegacion normal del portal.
- [ ] La botonera se ve alineada cuando hay datos detectables.
- [ ] No aparecen errores bloqueantes en consola por uso normal.

## 8. Privacidad y seguridad

- [ ] Las credenciales se guardan solo despues de configurar PIN.
- [ ] El vault bloqueado no muestra credenciales en claro.
- [ ] El README y la ficha Store aclaran que los datos quedan locales.
- [ ] No hay llamadas a backend propio para funciones gratuitas.

## 9. Publicacion

- [ ] Actualizar screenshots anonimizadas.
- [x] Revisar `docs/release-v0.6.1-assets.md`.
- [x] Confirmar que `CHANGELOG.md` tiene entrada 0.6.1.
- [x] Confirmar que `package.json` y `package-lock.json` dicen `0.6.2`.
- [x] Subir ZIP al dashboard de Chrome Web Store.
- [x] Guardar numero de version enviada a revision: `0.6.2`.
- [x] Enviar a revision en Chrome Web Store el 2026-04-29.

## 10. Riesgos conocidos aceptables

- MEV depende de sesion abierta del usuario.
- `notificaciones.scba.gov.ar` queda reservado para una etapa futura de gestion avanzada porque usa otro login y puede no estar sincronizado con MEV.
- Algunos expedientes PJN pueden no entregar PDF descargable segun estado, permisos o tipo de actuacion.
- EJE queda con soporte basico hasta una fase posterior.
