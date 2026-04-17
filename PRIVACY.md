# Política de Privacidad — ProcuAsist

**Última actualización:** 2026-04-17

ProcuAsist es una extensión de Chrome para abogados argentinos que automatiza la interacción con portales judiciales (MEV de la Provincia de Buenos Aires y JUSCABA del Poder Judicial de CABA). Esta política explica qué datos maneja la extensión y cómo los protege.

## Resumen rápido

- **Todo se guarda en tu navegador.** ProcuAsist no tiene servidores propios. No hay backend, no hay base de datos remota, no se sincroniza con ningún servicio externo.
- **No se recolectan datos analíticos ni de uso.** Sin telemetría, sin tracking, sin Google Analytics.
- **No se comparten datos con terceros.** Las únicas comunicaciones de la extensión son con los portales judiciales para los que vos mismo guardaste credenciales.
- **Tus credenciales se cifran localmente** con AES-256-GCM, protegidas por un PIN que solo vos conocés.

---

## Qué datos guarda la extensión

ProcuAsist almacena los siguientes datos en `chrome.storage.local` (almacenamiento local del navegador, propio de tu instalación de Chrome):

1. **Credenciales de portales** (usuario y contraseña de MEV / JUSCABA): cifradas con AES-256-GCM. La clave de cifrado se deriva de un PIN maestro que solo vos conocés (PBKDF2 con 100.000 iteraciones, SHA-256). El PIN nunca se guarda en disco.
2. **Marcadores de causas**: número de expediente, carátula, juzgado, portal y fechas de creación/actualización de las causas que vos elegís guardar.
3. **Configuración de monitoreo**: causas que marcaste para seguimiento automático, frecuencia de chequeo y alertas detectadas.
4. **Preferencias de la extensión**: modo oscuro, toggles de keep-alive, auto-reconexión, etc.
5. **Estado del onboarding**: un flag que indica si ya completaste el tutorial inicial.

Ninguno de estos datos se envía fuera de tu navegador.

## Permisos que pide la extensión y para qué

| Permiso | Para qué se usa |
|---|---|
| `storage` | Guardar credenciales cifradas, marcadores, ajustes en `chrome.storage.local`. |
| `alarms` | Programar chequeos periódicos de las causas monitoreadas (servicio en background). |
| `notifications` | Mostrar notificaciones de Chrome cuando se detecta un movimiento nuevo en una causa monitoreada. |
| `sidePanel` | Abrir el panel lateral con el dashboard de marcadores. |
| `offscreen` | Ejecutar operaciones criptográficas que requieren contexto DOM, fuera del service worker. |
| `tabs`, `downloads` | Abrir el portal judicial cuando hacés click en una causa, y descargar el ZIP del expediente. |
| Host: `mev.scba.gov.ar`, `docs.scba.gov.ar`, `eje.jus.gov.ar`, `sso.pjn.gov.ar`, `notificaciones.scba.gov.ar` | Inyectar los content scripts y descargar adjuntos en estos portales judiciales. La extensión solo se activa en estas URLs. |

## Qué NO hace la extensión

- **No envía datos a servidores externos.** No hay backend de ProcuAsist.
- **No usa servicios de analytics ni tracking** (no hay Google Analytics, Mixpanel, Sentry ni equivalentes).
- **No comparte tus credenciales con nadie.** Solo se usan para autocompletar el formulario de login del portal correspondiente.
- **No accede a tu historial de navegación** ni a otras pestañas que no sean las de los portales judiciales habilitados.
- **No modifica páginas fuera de los portales judiciales declarados.**

## Comunicaciones externas

La extensión únicamente se comunica con:
1. Los portales judiciales declarados (`mev.scba.gov.ar`, `docs.scba.gov.ar`, `eje.jus.gov.ar`, `sso.pjn.gov.ar`, `notificaciones.scba.gov.ar`) para realizar las operaciones que vos iniciás (login, búsqueda, descarga de adjuntos, monitoreo).
2. Cafecito.app, **solo si vos hacés click** en el botón "Invitame un cafecito" — en ese caso se abre `cafecito.app/procuasist` en una pestaña nueva.

## Borrado de datos

Para borrar todos los datos guardados por la extensión:
- Ir a `chrome://extensions`, encontrar ProcuAsist y desinstalarla. Eso elimina todo `chrome.storage.local` asociado.
- Alternativa parcial: usar el botón "Bloquear" en el popup para cerrar la sesión sin eliminar las credenciales cifradas.

## Cambios a esta política

Si esta política cambia, se actualiza este archivo en el repositorio público y se incrementa la fecha al inicio. Las versiones anteriores quedan en el historial de Git.

## Contacto

Si tenés dudas sobre cómo se manejan tus datos:
- Email: [blancoilariasistente@gmail.com](mailto:blancoilariasistente@gmail.com?subject=ProcuAsist%20-%20privacidad)
- Issues en GitHub: https://github.com/blancoilari/procu-asist/issues

ProcuAsist es código abierto. Podés auditar el código en [github.com/blancoilari/procu-asist](https://github.com/blancoilari/procu-asist).
