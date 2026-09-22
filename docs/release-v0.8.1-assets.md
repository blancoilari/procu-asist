# Assets de release - ProcuAsist v0.8.1

Material para actualizar la ficha de Chrome Web Store. **La version 0.8.1 NO
esta publicada**: la sube Patricio.

## 0. Advertencia antes de subir

La 0.8.1 **cambia `host_permissions`** (sale `https://eje.jus.gov.ar/*`). Chrome
Web Store trata cualquier cambio de permisos como motivo de **revision manual
completa**, aunque el cambio sea quitar un permiso y no agregarlo: la version
puede quedar varios dias en revision antes de publicarse, y mientras tanto la
0.8.0 sigue siendo la version viva. No conviene subirla en una semana en la que
haga falta publicar un arreglo urgente.

Segundo punto: la 0.8.1 sube la herramienta de empaquetado (`wxt`) de la linea
0.20 a la 0.21. La build local sale limpia y el `manifest.json` generado se
comparo campo por campo contra el de la 0.8.0 (que salio de wxt 0.20): la unica
diferencia que no viene de esta version es un campo que agrega la herramienta,
`options_ui.open_in_tab: false`, que es el valor por defecto de Chrome cuando el
campo no esta. No cambia permisos ni comportamiento declarado, pero tampoco
reemplaza probar la extension cargada: lo verificado es la build, no la
extension corriendo. Antes de subir, cargar `.output/chrome-mv3` desde
`chrome://extensions` y recorrer el checklist de la seccion 5.

## 1. Que cambia respecto de la 0.8.0

- Se retira el soporte del portal EJE / JusCABA, que era codigo muerto: el
  manifest pedia permiso de host sobre un dominio que no resuelve y el portal
  estaba oculto de la interfaz desde la 0.6.7.
- Sale el permiso de host `https://eje.jus.gov.ar/*` y ese mismo origen sale de
  `web_accessible_resources`.
- El auto-login SSO contra Keycloak, que vivia dentro del content script de EJE
  y lo compartia con PJN, se conserva completo y pasa a
  `entrypoints/sso.content.ts`, solo para `https://sso.pjn.gov.ar/*`.
- Al arrancar, la extension borra la alarma de keep-alive del portal retirado y
  las credenciales guardadas de ese portal, que ya no pueden usarse.
- Dependencias de desarrollo al dia (`npm audit` en cero). Ninguna dependencia
  de produccion cambio de version.

- Descarga confiable de expedientes MEV frente al límite de pedidos que el
  portal tiene desde septiembre de 2026: ritmo de 20 pedidos por minuto, pausa
  con pregunta si la MEV bloquea (nunca saltea un documento), progreso real con
  boton Detener, nombres de archivo por fecha y "Bajar los que faltan".
- `npm ci` vuelve a funcionar con npm 11 (entrada rota del lockfile).

Cambia el flujo de la descarga MEV: tarda mas en expedientes grandes y puede
frenar a preguntar. El resto del flujo de trabajo queda igual.

## 2. Descripcion corta (132 caracteres maximo)

> Descarga expedientes MEV/SCBA y PJN en ZIP, guarda y monitorea causas, calcula plazos procesales y avisa vencimientos.

Sin cambios respecto de la ficha actual.

## 3. Descripcion larga

La ficha publicada todavia describe el PIN maestro y la pausa de avisos por
umbral, dos cosas que se eliminaron en la 0.8.0. Este es el texto corregido y
sin el portal retirado.

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
- Asistente "Importar todo": trae de una vez tus causas de los portales con sesion activa (listados PJN y sets MEV completos), con progreso, cancelacion y resumen.
- Escaneo rapido MEV por novedades de set (beta): revisa tus sets de busqueda en una sola consulta y solo re-lee las causas que se movieron. Se puede apagar en Ajustes.
- Backup local: exporta e importa tus datos a JSON desde Ajustes (nunca incluye credenciales).
- Auto-login en MEV y PJN con las credenciales que cargues, cifradas en tu computadora.

PORTALES SOPORTADOS
- MEV / SCBA: mev.scba.gov.ar
- PJN: scw.pjn.gov.ar, portalpjn.pjn.gov.ar, api.pjn.gov.ar

SEGURIDAD Y PRIVACIDAD
Las credenciales se cifran con AES-GCM y quedan guardadas en tu computadora, con una clave que se genera sola en tu dispositivo. ProcuAsist no tiene servidores propios.

DISCLAIMER
ProcuAsist se ofrece "tal cual", sin garantias. No reemplaza el control manual de actuaciones judiciales ni el criterio profesional del abogado.
```

## 4. Notas de version para la ficha

```text
Novedades de la v0.8.1:

- Se retira el soporte del portal EJE / JusCABA, que ya no estaba disponible en la interfaz. Con eso, la extension deja de pedir permiso sobre ese dominio: ahora solo accede a los portales de MEV/SCBA y de PJN.
- Si tenias credenciales guardadas de ese portal, se borran solas al actualizar. Las de MEV y PJN no se tocan.
- Limpieza interna: se elimina un chequeo periodico que ya no hacia nada y se ponen al dia las herramientas de desarrollo.

- La descarga de expedientes de la MEV respeta el limite de pedidos que el portal tiene desde septiembre: ya no saltea documentos, se pausa y pregunta si la MEV lo pide, muestra el avance con el tiempo que falta y nombra los archivos por fecha, para que una descarga parcial encaje en la carpeta de la anterior.

Causas, alertas, plazos e importaciones funcionan igual.
```

## 5. Checklist antes de subir

### 5.1 Tecnico (hecho en esta sesion)

- [x] `npm run compile` sin errores.
- [x] `npm run build` sin errores.
- [x] `npm run zip` genera `.output/procu-asist-0.8.1-chrome.zip`.
- [x] `npm audit`: 18 vulnerabilidades (1 baja, 4 medias, 10 altas, 3 criticas)
      antes, 0 despues. `npm audit fix` solo cerraba siete; las once restantes
      necesitaron subir `wxt` y `sharp`, ambas devDependencies.
- [x] El `manifest.json` generado no menciona el dominio retirado y queda con
      seis `host_permissions`.
- [x] Ni el bundle ni el manifest contienen `eje.jus`, `juscaba` ni `iol-api`.
      Si quedan, deliberadas, las dos claves de storage del portal retirado
      (`tl-keepalive-eje` y `tl_cred_eje`) que el codigo de limpieza borra al
      arrancar.

- [x] `npm test`: 45 casos de la descarga confiable (portero, nombres,
      clasificacion de respuestas, informe y recorrido), sin datos reales.

Lo que NO esta verificado: nada de esto prueba que la extension cargada
funcione contra los portales. Los tests cubren la logica pura de la descarga;
el resto del comportamiento se verifica a mano en 5.2.

### 5.2 Manual sobre la extension cargada (pendiente, lo hace quien publica)

Cargar `.output/chrome-mv3` desde `chrome://extensions` (modo desarrollador) y
verificar:

- [ ] El panel lateral muestra `v0.8.1`.
- [ ] Auto-login en MEV con credenciales guardadas.
- [ ] Auto-login en PJN: entrar a SCW sin sesion, llegar al login de Keycloak en
      `sso.pjn.gov.ar` y confirmar que completa y envia el formulario. **Es el
      camino que cambio de archivo en esta version: si algo se rompio, se rompe
      aca.**
- [ ] Tras dos intentos fallidos seguidos, el auto-login corta y no cicla.
- [ ] En un expediente MEV aparece la barra flotante y la descarga ZIP funciona.
- [ ] Descarga completa de un expediente MEV de mas de 200 pasos: cero
      salteados por bloqueo y la barra muestra avance y tiempo (unos 12 minutos).
- [ ] Descarga parcial de los ultimos pasos: los nombres encajan en la carpeta
      de la descarga completa sin pisar nada.
- [ ] Pausa forzada (navegar la MEV en otra pestaña durante la descarga hasta
      que bloquee): aparece el aviso; "Esperar y seguir" completa; "Detener y
      guardar lo bajado" entrega el parcial con su informe; "Bajar los que
      faltan" completa la carpeta.
- [ ] En un expediente SCW aparece el boton de descarga y el modal lista
      actuaciones.
- [ ] Las causas guardadas de antes siguen en la lista y el escaneo corre.
- [ ] En la consola del service worker no aparecen errores nuevos al arrancar.
- [ ] Probar sobre un perfil que venga de la 0.8.0, no solo sobre uno limpio.

### 5.3 Ficha de la Store

- [ ] Reemplazar las capturas con datos reales (ver
      `docs/store-assets/v0.8.1/README.md`, que trae la lista exacta de que
      captura reemplaza a cual).
- [ ] Actualizar la descripcion larga con el texto de la seccion 3.
- [ ] Cargar las notas de version de la seccion 4.
- [ ] Confirmar que el enlace a la politica de privacidad apunta al `PRIVACY.md`
      al dia (ya no nombra el portal retirado y su lista de sitios coincide con
      el manifest).
- [ ] En la declaracion de permisos del dashboard, dejar la justificacion sin la
      linea del dominio retirado.

## 6. Que se sube

- Archivo: `.output/procu-asist-0.8.1-chrome.zip`
- Se genera con:

```sh
npm ci
npm run zip
```

`npm run zip` corre la build antes de comprimir, asi que no hace falta un
`npm run build` aparte. La carpeta `.output/chrome-mv3` es la misma build sin
comprimir, para cargarla a mano desde `chrome://extensions` durante el QA.
