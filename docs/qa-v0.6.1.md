# QA checklist - ProcuAsist v0.6.1

Objetivo: validar que la version gratuita quede estable antes de subirla a Chrome Web Store.

Fecha objetivo: 2026-04-27.

## 1. Preparacion

- [ ] Ejecutar `npm run compile`.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `npm run zip`.
- [ ] Cargar `.output/chrome-mv3` desde `chrome://extensions`.
- [ ] Confirmar que el panel muestra `v0.6.1`.
- [ ] Abrir una pestana MEV logueada.
- [ ] Abrir una pestana PJN/SCW logueada si se va a probar PJN.
- [ ] Abrir `notificaciones.scba.gov.ar` logueado si se va a probar SCBA Notificaciones.

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

## 4. SCBA Notificaciones

- [ ] En Novedades aparece la importacion masiva cuando hay tabla compatible.
- [ ] En Mis Causas aparece `Importar Mis Causas`.
- [ ] `Importar Mis Causas` recorre las paginas disponibles o termina sin colgarse si el portal no pagina correctamente.
- [ ] Las causas importadas aparecen en Marcadores.
- [ ] `Completar datos MEV` cruza primero contra causas MEV ya conocidas.
- [ ] Con una pestana MEV abierta y logueada, `Completar datos MEV` busca pendientes en tandas.
- [ ] El mensaje informa enriquecidas, monitoreadas, pendientes y si se puede repetir otra tanda.
- [ ] Las causas enriquecidas quedan monitoreadas y se pueden abrir desde el panel.

## 5. Monitoreo y movimientos desde fecha

- [ ] `Buscar movimientos desde esa fecha` arranca el barrido.
- [ ] Si falta pestana MEV, informa que se necesita abrir MEV.
- [ ] Si hay movimientos desde la fecha indicada, aparecen en Alertas.
- [ ] Los links de las alertas abren la causa o el portal correspondiente.
- [ ] `Marcar todas como leidas` actualiza contador y listado.

## 6. PJN

- [ ] En expediente SCW aparece boton ZIP.
- [ ] El modal lista actuaciones y permite filtrar por categoria.
- [ ] Se puede seleccionar y deseleccionar actuaciones.
- [ ] El ZIP PJN incluye resumen y documentos seleccionados cuando el portal entrega PDFs.
- [ ] Si faltan documentos o falla una descarga, se informa sin romper el ZIP completo.

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
- [ ] Revisar `docs/release-v0.6.1-assets.md`.
- [ ] Confirmar que `CHANGELOG.md` tiene entrada 0.6.1.
- [ ] Confirmar que `package.json` y `package-lock.json` dicen `0.6.1`.
- [ ] Subir ZIP al dashboard de Chrome Web Store.
- [ ] Guardar numero de version enviada a revision.

## 10. Riesgos conocidos aceptables

- MEV y SCBA Notificaciones dependen de sesion abierta del usuario.
- La busqueda asistida de pendientes MEV se ejecuta en tandas para evitar sobrecargar el portal.
- Algunos expedientes PJN pueden no entregar PDF descargable segun estado, permisos o tipo de actuacion.
- EJE queda con soporte basico hasta una fase posterior.
