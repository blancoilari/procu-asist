# Politica de Privacidad - ProcuAsist

**Ultima actualizacion:** 2026-04-29

ProcuAsist es una extension de Chrome para abogados argentinos que automatiza tareas repetitivas en portales judiciales: MEV/SCBA, PJN/SCW y JUSCABA/EJE. Esta politica explica que datos maneja la extension, donde se guardan y como se protegen.

## Resumen rapido

- ProcuAsist no tiene servidores propios, backend ni base de datos remota.
- Los datos se guardan localmente en el navegador del usuario mediante `chrome.storage.local`.
- No se usan analytics, tracking, publicidad ni servicios de telemetria.
- No se venden ni transfieren datos de usuarios a terceros.
- Las credenciales se cifran localmente con AES-256-GCM y un PIN maestro definido por el usuario.

## Datos que puede guardar la extension

ProcuAsist puede almacenar localmente:

1. **Credenciales de portales judiciales**: usuario y contrasena de los portales configurados por el usuario. Se guardan cifradas con AES-256-GCM. La clave se deriva del PIN maestro del usuario mediante PBKDF2. El PIN no se guarda en disco.
2. **Marcadores de causas**: portal, numero de expediente, caratula, juzgado, URL y metadatos necesarios para volver a abrir la causa.
3. **Causas monitoreadas**: causas elegidas por el usuario para recibir alertas de movimientos.
4. **Alertas y movimientos detectados**: informacion procesal visible en los portales judiciales, guardada localmente para mostrar novedades en el panel lateral.
5. **Preferencias de la extension**: configuracion de apariencia, keep-alive, auto-reconexion y estado del tutorial inicial.
6. **Token PJN capturado localmente**: cuando el usuario inicia sesion en PJN, ProcuAsist puede leer el encabezado `Authorization: Bearer ...` enviado por el propio portal a `https://api.pjn.gov.ar/*`, guardarlo localmente y reutilizarlo para consultar el feed de novedades del usuario contra la API oficial de PJN.

Ninguno de estos datos se envia a servidores de ProcuAsist.

## Permisos que solicita y finalidad

| Permiso | Uso |
| --- | --- |
| `storage` | Guardar localmente credenciales cifradas, marcadores, monitores, alertas y preferencias. |
| `alarms` | Programar chequeos periodicos de causas monitoreadas. |
| `notifications` | Mostrar notificaciones del navegador cuando hay novedades en causas monitoreadas. |
| `sidePanel` | Mostrar el panel lateral de ProcuAsist con marcadores, monitoreo y ajustes. |
| `activeTab` | Leer o interactuar con la pestana activa solo cuando el usuario inicia una accion desde la extension. |
| `scripting` | Inyectar scripts de contenido en los portales judiciales declarados para leer causas, completar login o descargar documentos. |
| `offscreen` | Ejecutar operaciones de cifrado y descifrado fuera del service worker. |
| `tabs` | Abrir pestanas de portales judiciales cuando el usuario hace click en una causa o accion. |
| `downloads` | Descargar al disco del usuario los ZIP/PDF generados por la extension. |
| `webRequest` | Leer, de forma restringida, el encabezado de autorizacion enviado por PJN a `https://api.pjn.gov.ar/*` para reutilizar el token contra la API oficial. |

## Sitios donde se activa

ProcuAsist solo se activa en los portales judiciales declarados en el manifest:

- `https://mev.scba.gov.ar/*`
- `https://docs.scba.gov.ar/*`
- `https://eje.jus.gov.ar/*`
- `https://sso.pjn.gov.ar/*`
- `https://portalpjn.pjn.gov.ar/*`
- `https://api.pjn.gov.ar/*`
- `https://scw.pjn.gov.ar/*`

La extension no se inyecta en otros sitios.

## Que no hace ProcuAsist

- No vende datos.
- No transfiere datos a terceros.
- No usa datos para publicidad.
- No usa datos para scoring crediticio.
- No usa analytics.
- No registra historial web general.
- No accede a paginas fuera de los portales judiciales autorizados.
- No reemplaza el control profesional del abogado ni garantiza el resultado de actuaciones judiciales.

## Comunicaciones externas

Las comunicaciones externas ocurren solo cuando el usuario usa funciones de la extension sobre portales judiciales oficiales:

- MEV/SCBA y documentos asociados para consultar causas y descargar adjuntos.
- PJN/SCW y API oficial de PJN para consultar listados, novedades y documentos permitidos por el portal.
- JUSCABA/EJE con soporte basico.
- Cafecito.app solo si el usuario hace click voluntariamente en el boton "Invitame un cafecito".

## Borrado de datos

Para borrar todos los datos locales de ProcuAsist, el usuario puede desinstalar la extension desde `chrome://extensions`. Tambien puede borrar o modificar credenciales y preferencias desde el panel de configuracion de la extension.

## Cambios

Si esta politica cambia, se actualizara este archivo y se incrementara la fecha de ultima actualizacion.

## Contacto

- GitHub Issues: https://github.com/blancoilari/procu-asist/issues
- Email: blancoilariasistente@gmail.com
