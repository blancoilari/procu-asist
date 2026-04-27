# Assets de release - ProcuAsist v0.6.0

Materiales sugeridos para actualizar la ficha de Chrome Web Store y difundir la version actual.

## 1. Ficha de Chrome Web Store

### Nombre de la extension

`ProcuAsist - Copiloto Legal`

### Descripcion corta

> Descarga expedientes de MEV/SCBA y PJN en ZIP, guarda causas, monitorea movimientos e importa novedades SCBA.

### Descripcion larga

```text
ProcuAsist es una extension de Chrome para abogados argentinos que automatiza tareas repetitivas en portales judiciales.

HECHO POR UN ABOGADO DE LA MATRICULA, PARA COLEGAS
Es gratuita y sin fines de lucro. No requiere crear una cuenta. Tus datos se guardan localmente en tu navegador.

QUE HACE
- Descarga expedientes completos de MEV/SCBA en un ZIP con resumen, pasos procesales y adjuntos.
- Descarga expedientes de PJN desde SCW cuando el expediente esta disponible en el portal.
- Permite seleccionar que actuaciones incluir antes de generar el ZIP.
- Guarda marcadores de causas y permite abrirlas rapido desde el panel lateral.
- Monitorea causas y muestra alertas de movimientos nuevos.
- Importa causas desde resultados de busqueda y desde SCBA Notificaciones.
- Hace auto-login y mantiene sesiones activas cuando el portal lo permite.
- Cifra credenciales localmente con PIN maestro.

PORTALES SOPORTADOS
- MEV / SCBA: mev.scba.gov.ar
- SCBA Notificaciones: notificaciones.scba.gov.ar
- PJN: scw.pjn.gov.ar, portalpjn.pjn.gov.ar, api.pjn.gov.ar
- JUSCABA / EJE: eje.jus.gov.ar, con funciones basicas

SEGURIDAD Y PRIVACIDAD
Las credenciales se cifran con AES-GCM y quedan guardadas en tu computadora. ProcuAsist no necesita servidores para funcionar en su version gratuita.

FEEDBACK
Esta herramienta crece con el uso real de colegas. Reporta errores o sugerencias por email a blancoilariasistente@gmail.com o desde GitHub Issues.

DISCLAIMER
ProcuAsist se ofrece "tal cual", sin garantias. No reemplaza el control manual de actuaciones judiciales ni el criterio profesional del abogado.
```

### Categoria

Productividad

### Idioma principal

Espanol (Argentina)

### Politica de privacidad

https://github.com/blancoilari/procu-asist/blob/master/PRIVACY.md

### Sitio web del desarrollador

https://github.com/blancoilari/procu-asist

### Email de contacto

blancoilariasistente@gmail.com

### URL publica

https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem

## 2. Screenshots sugeridas

1. `01-ajustes.png` - Panel de ajustes con version, privacidad, cafecito y canales de feedback.
2. `02-modal-pasos.png` - Modal de seleccion de pasos procesales para ZIP en MEV/SCBA.
3. `03-marcadores.png` - Panel lateral con marcadores reales anonimizados.
4. `04-monitoreo.png` - Monitoreo y alertas de movimientos.
5. `05-pjn-zip.png` - Boton/modal de descarga ZIP en PJN.
6. `06-scba-importacion.png` - Importacion desde SCBA Notificaciones.

## 3. Justificacion de permisos

| Permiso | Justificacion |
|---|---|
| `storage` | Guardar settings, marcadores, monitores y credenciales cifradas localmente. |
| `alarms` | Programar keep-alive y escaneos periodicos. |
| `notifications` | Avisar movimientos nuevos en causas monitoreadas. |
| `sidePanel` | Mostrar el dashboard de ProcuAsist. |
| `activeTab`, `tabs`, `scripting` | Interactuar con la pestana del portal judicial que el usuario esta usando. |
| `offscreen` | Parsear HTML y realizar tareas que el service worker MV3 no puede hacer directamente. |
| `downloads` | Descargar ZIPs generados por la extension. |
| `webRequest` | Capturar tokens de sesion PJN necesarios para usar la API del propio portal. |
| Host permissions | Activar la extension solo en portales judiciales declarados: MEV/SCBA, PJN, EJE, SCBA Notificaciones y docs SCBA. |

## 4. Mensaje corto para colegas

```text
Hola, te paso ProcuAsist, una extension gratis de Chrome que arme para abogados.

Sirve para descargar expedientes completos de MEV/SCBA y PJN en ZIP, guardar causas, monitorear movimientos e importar novedades de SCBA.

Se instala desde Chrome Web Store:
https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem

Si la probas y encontras algo para mejorar, me sirve muchisimo el feedback.
```

## 5. Checklist de actualizacion

- [ ] `npm run compile`
- [ ] `npm run build`
- [ ] `npm run zip`
- [ ] Capturas nuevas generadas y anonimizadas.
- [ ] README actualizado.
- [ ] Manual actualizado.
- [ ] ROADMAP actualizado.
- [ ] CHANGELOG actualizado si hubo cambios de producto.
- [ ] ZIP subido al dashboard de Chrome Web Store.
- [ ] Descripcion larga revisada.
- [ ] Politica de privacidad linkeada.
- [ ] Version publicada o enviada a revision.
