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
| Materiales de Store, screenshots y claims publicos | Preparados; pendiente envio manual |
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
- [ ] Subir ZIP al dashboard de Chrome Web Store.
- [ ] Guardar numero de version enviada a revision: `0.6.2`.

## 10. Riesgos conocidos aceptables

- MEV depende de sesion abierta del usuario.
- `notificaciones.scba.gov.ar` queda reservado para una etapa futura de gestion avanzada porque usa otro login y puede no estar sincronizado con MEV.
- Algunos expedientes PJN pueden no entregar PDF descargable segun estado, permisos o tipo de actuacion.
- EJE queda con soporte basico hasta una fase posterior.
