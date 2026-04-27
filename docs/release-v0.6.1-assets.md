# Assets de release - ProcuAsist v0.6.1

Materiales para actualizar Chrome Web Store con la version gratuita estabilizada.

## 1. Resumen de version

ProcuAsist v0.6.1 consolida la version gratuita: mejora importaciones SCBA/MEV, agrega busqueda de movimientos desde fecha, completa datos internos MEV de causas importadas desde Notificaciones y deja mas claro el flujo de monitoreo.

## 2. Descripcion corta

> Descarga expedientes MEV/SCBA y PJN en ZIP, importa causas, monitorea movimientos y ayuda a revisar novedades.

## 3. Descripcion larga sugerida

```text
ProcuAsist es una extension gratuita de Chrome para abogados argentinos que automatiza tareas repetitivas en portales judiciales.

HECHO POR UN ABOGADO DE LA MATRICULA, PARA COLEGAS
No requiere crear una cuenta. Tus datos se guardan localmente en tu navegador.

QUE HACE
- Descarga expedientes completos de MEV/SCBA en ZIP.
- Descarga expedientes de PJN desde SCW cuando el portal permite acceder a los documentos.
- Permite seleccionar que actuaciones incluir antes de generar el ZIP.
- Guarda marcadores de causas y permite abrirlas rapido desde el panel lateral.
- Monitorea causas MEV y muestra alertas de movimientos.
- Busca movimientos desde una fecha indicada en causas monitoreadas.
- Importa causas desde resultados y sets de busqueda MEV.
- Importa causas desde SCBA Notificaciones y Mis Causas.
- Completa datos internos MEV de causas importadas desde Notificaciones cuando encuentra coincidencias.
- Cifra credenciales localmente con PIN maestro.

PORTALES SOPORTADOS
- MEV / SCBA: mev.scba.gov.ar
- SCBA Notificaciones: notificaciones.scba.gov.ar
- PJN: scw.pjn.gov.ar, portalpjn.pjn.gov.ar, api.pjn.gov.ar
- JUSCABA / EJE: eje.jus.gov.ar, con funciones basicas

SEGURIDAD Y PRIVACIDAD
Las credenciales se cifran con AES-GCM y quedan guardadas en tu computadora. ProcuAsist no necesita servidores para funcionar en su version gratuita.

DISCLAIMER
ProcuAsist se ofrece "tal cual", sin garantias. No reemplaza el control manual de actuaciones judiciales ni el criterio profesional del abogado.
```

## 4. Screenshots a tomar

- [ ] Ajustes con version `v0.6.1`.
- [ ] MEV expediente con botonera unificada.
- [ ] Modal de ZIP MEV con seleccion de pasos.
- [ ] Panel Marcadores con causas importadas.
- [ ] Panel Monitoreo con busqueda desde fecha.
- [ ] SCBA Notificaciones > Mis Causas con `Importar Mis Causas`.
- [ ] Resultado de `Completar datos MEV`.
- [ ] PJN con boton ZIP.

## 5. Checklist tecnico

- [ ] `npm run compile`
- [ ] `npm run build`
- [ ] `npm run zip`
- [ ] QA manual segun `docs/qa-v0.6.1.md`
- [ ] ZIP generado: `.output/procu-asist-0.6.1-chrome.zip` o equivalente WXT.
- [ ] Commit y push a GitHub.
- [ ] Version enviada a revision en Chrome Web Store.

## 6. Mensaje para compartir

```text
Actualice ProcuAsist, la extension gratis de Chrome para abogados.

Ahora importa Mis Causas de SCBA Notificaciones, completa datos MEV cuando encuentra coincidencias, permite buscar movimientos desde una fecha y mantiene la descarga ZIP de MEV/SCBA y PJN.

Chrome Web Store:
https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem
```
