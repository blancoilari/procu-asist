# Assets de release — ProcuAsist v0.4.0

Materiales listos para copiar/pegar al publicar v0.4.0 en Chrome Web Store y para difundir entre colegas.

---

## 1. Ficha de Chrome Web Store

### Nombre de la extensión
`ProcuAsist - Copiloto Legal`

### Descripción corta (máx. 132 caracteres)
> Descargá expedientes completos en un ZIP desde la MEV (PBA) y JUSCABA. Marcadores y monitoreo de causas. Hecho por un abogado.

*(127 caracteres — dentro del límite)*

### Descripción larga
```
ProcuAsist es una extensión de Chrome para abogados argentinos que automatiza tareas repetitivas en los portales judiciales.

✦ HECHO POR UN ABOGADO DE LA MATRÍCULA, PARA COLEGAS
Es gratuita y sin fines de lucro. No tiene servidores, no recolecta datos, no hace tracking. Todo se guarda en tu navegador.

✦ QUÉ HACE
• Descarga el expediente completo de la MEV (Provincia de Buenos Aires) en un único ZIP, con un PDF resumen y todos los pasos procesales con sus adjuntos.
• Selección flexible de qué pasos procesales descargar antes de armar el ZIP.
• Reintentos automáticos en la descarga de adjuntos (hasta 7 intentos por archivo) y verificación post-descarga.
• Marcadores de causas con búsqueda rápida, accesibles desde el panel lateral.
• Auto-login y mantenimiento de sesión (keep-alive) en MEV y JUSCABA.
• Auto-reconexión cuando la sesión expira.
• Modo oscuro opcional.

✦ PORTALES SOPORTADOS
• MEV (Mesa de Entradas Virtual - SCBA - Provincia de Buenos Aires): descarga completa + monitoreo.
• JUSCABA (Poder Judicial de CABA): auto-login y marcadores. Descarga completa: en desarrollo (próxima versión).
• Próximamente: Poder Judicial de la Nación (PJN).

✦ SEGURIDAD
Tus credenciales se cifran con AES-256-GCM, protegidas por un PIN maestro que solo vos conocés. Nada se envía a servidores externos.

✦ FEEDBACK Y COLABORACIÓN
Esta herramienta crece con el uso de los colegas. Reportá errores o sugerencias por email (blancoilariasistente@gmail.com) o en GitHub Issues. Si te resulta útil, podés invitarme un cafecito.

✦ DISCLAIMER
ProcuAsist se ofrece "tal cual" (as is), sin garantías. No reemplaza el control manual de actuaciones judiciales.

Roadmap público y código fuente: github.com/blancoilari/procu-asist
```

### Categoría
**Productividad**

### Idioma principal
Español (Argentina)

### Política de privacidad
URL: https://github.com/blancoilari/procu-asist/blob/master/PRIVACY.md

### Sitio web del desarrollador
URL: https://github.com/blancoilari/procu-asist

### Email de contacto
blancoilariasistente@gmail.com

### Screenshots a subir (en orden)

1. **`01-ajustes.png`** — Sidepanel Ajustes con autoría/cafecito/feedback (ventana entera Chrome + MEV de fondo).
2. **`02-modal-pasos.png`** — Modal "Seleccionar pasos procesales a descargar" con varios pasos seleccionados.
3. **`03-marcadores.png`** — Sidepanel Marcadores con 3 causas guardadas (números MEV, carátulas, juzgados).

### Justificación de permisos (si el CWS la pide durante la revisión)

| Permiso | Justificación |
|---|---|
| `storage` | Guardar credenciales cifradas y marcadores localmente. |
| `alarms` | Programar chequeos periódicos de causas monitoreadas. |
| `notifications` | Avisar al usuario cuando hay un movimiento nuevo en una causa monitoreada. |
| `sidePanel` | Mostrar el dashboard de marcadores en el panel lateral del navegador. |
| `offscreen` | Ejecutar criptografía AES-GCM fuera del service worker. |
| `tabs`, `downloads` | Abrir el portal cuando el usuario hace click en una causa, y descargar el ZIP del expediente. |
| Host permissions | La extensión solo se activa en los portales judiciales declarados (MEV, JUSCABA, PJN, notificaciones SCBA, docs SCBA). |

---

## 2. Mensaje de WhatsApp para colegas

### Versión corta (chat directo)
> Hola, te paso una herramienta que armé para descargar expedientes completos de la MEV (PBA) y trabajar con causas de JUSCABA. Es una extensión de Chrome, gratis, hecha por un abogado para colegas. La instalás con un click acá: [LINK_CWS]
>
> Cualquier sugerencia o error que encuentres me re sirve, está pensada para mejorar con el feedback de los que la usan.

### Versión un poco más larga (status / grupo)
> 📌 *ProcuAsist* — Copiloto legal para abogados argentinos
>
> Es una extensión gratis para Chrome que armé para automatizar las tareas más repetitivas en los portales judiciales:
>
> ✅ Descarga el expediente completo de la MEV (PBA) en un solo ZIP, con resumen y adjuntos.
> ✅ Selecciona qué pasos procesales bajar.
> ✅ Marcadores y dashboard de causas en el panel lateral.
> ✅ Auto-login y mantenimiento de sesión en MEV y JUSCABA.
>
> 🔒 Todo se guarda en tu navegador. No hay servidores, no recolecta datos.
> ⚖️ Hecha por un abogado de la matrícula, sin fines de lucro.
>
> Instalala desde la Chrome Web Store: [LINK_CWS]
>
> Si te resulta útil, pasala a los colegas. Y si encontrás algo para mejorar, escribime: blancoilariasistente@gmail.com

### Cómo reemplazar `[LINK_CWS]`
Cuando el CWS apruebe la extensión, vas a tener una URL del tipo `https://chrome.google.com/webstore/detail/<nombre>/<id>`. Reemplazá `[LINK_CWS]` por esa URL en ambos mensajes.

---

## 3. Checklist de publicación al CWS

- [ ] `npm run zip` corrido — `.output/chrome-mv3.zip` generado
- [ ] Capturas guardadas: `01-ajustes.png`, `02-modal-pasos.png`, `03-marcadores.png`
- [ ] `git push origin master --tags` para subir el commit y el tag `v0.4.0` a GitHub
- [ ] GitHub Release creado para `v0.4.0` con el ZIP adjunto y el changelog
- [ ] Dashboard CWS abierto en https://chrome.google.com/webstore/devconsole
- [ ] Item nuevo creado, ZIP subido
- [ ] Ficha completada con los textos de arriba
- [ ] Política de privacidad linkeada (PRIVACY.md en GitHub)
- [ ] Screenshots subidos (orden correcto)
- [ ] Categoría "Productividad" seleccionada
- [ ] Enviado a revisión (típicamente 1–7 días)
- [ ] Cuando aprueben: copiar URL del CWS y reemplazar `[LINK_CWS]` en los mensajes de WhatsApp
- [ ] Mandar a 2–3 colegas de confianza primero, validar que la instalación funciona, y después difundir más amplio
