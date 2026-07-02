# Capturas promocionales - Chrome Web Store (ProcuAsist v0.7.0)

Estas son las **4 imágenes promocionales** para la ficha de ProcuAsist en la
Chrome Web Store. No son capturas de pantalla reales de la extensión: son
maquetas HTML/CSS que **reproducen fielmente la interfaz** del sidepanel
(paleta, tipografía, estructura de tarjetas, badges, botones), compuestas sobre
un fondo con degradé celeste y una franja con el mensaje clave de cada vista.

## Datos ficticios

Todo el contenido es **inventado y genérico**. No hay datos reales de clientes:
ni carátulas, ni nombres de personas, ni números de expediente, ni juzgados que
correspondan a causas reales. Cualquier parecido es casual. Las carátulas,
números (CIV 012345/2024, COM 008912/2023, etc.) y juzgados son plausibles pero
completamente ficticios, elegidos solo para ilustrar la interfaz.

## Las 4 imágenes (1280x800, requisito de la Store)

| Archivo | Vista | Mensaje |
|---|---|---|
| `01-causas-unificada.png` | Pestaña Causas, lista unificada MEV + PJN con una novedad | Todas tus causas en una sola lista, guardadas y monitoreadas |
| `02-alertas-por-expediente.png` | Sub-vista Alertas, novedades agrupadas por expediente | Alertas de novedades agrupadas por expediente |
| `03-plazos.png` | Pestaña Plazos, calculadora + lista de vencimientos | Calculá plazos procesales y no pierdas un vencimiento |
| `04-importar-todo.png` | Asistente Importar todo (overlay) | Traé todas tus causas de MEV y PJN de una vez |
| `05-descargar-expediente.png` | Diálogo Descargar expediente PJN (ZIP o PDF único) | Descargá el expediente completo en un ZIP o un PDF, con un click |

## Fidelidad visual

La maqueta sigue la UI real de la extensión:

- Paleta de `assets/styles/global.css`: primario `#2563eb`, hover `#1d4ed8`,
  primario claro `#dbeafe`, fondo `#ffffff`, fondo secundario `#f8fafc`, texto
  `#0f172a`, texto secundario `#475569`, borde `#e2e8f0`, rojo de badges
  `#ef4444`.
- Estructura de `entrypoints/sidepanel/App.tsx` (header con logo de balanza,
  buscador, pestañas Causas/Plazos/Ajustes, segmentado Todos/MEV/PJN,
  sub-pestañas Causas/Alertas, barra de acciones y tarjetas de causa).
- Badges de portal como en el código real: MEV `bg-blue-100 text-blue-900`,
  PJN `bg-red-100 text-red-900`.
- Asistente de `modules/ui/ImportAllWizard.tsx`, con el aviso de umbral en caja
  amarilla de alto contraste (fondo `#FEF3C7`, borde `#F59E0B`, texto
  `#7C2D12`), tal como está codeado inline en ese componente.
- Calculadora y lista de vencimientos de `modules/ui/PlazosTab.tsx`, con los
  badges de urgencia (rojo HOY, ámbar para <= 3 días, gris para el resto) y el
  botón Exportar a calendario (.ics).
- Diálogo Descargar expediente de `modules/portals/pjn-zip-ui.ts`: header azul,
  aviso amarillo de actuaciones históricas, barra de categorías con contadores,
  toolbar de selección (pills con borde), tabla Fecha/Tipo/Descripción/Fs./Doc.
  con clip en las que tienen documento, y footer con Cancelar / ZIP / Un PDF.
  El header y los botones usan el azul de marca `#2563eb` (en el código el FAB
  es `#2a5d9f`; acá se unifica con la paleta del resto de las capturas).
- Logo de balanza reproducido a partir de `public/icon/logo.svg`.

## Cómo se regeneran

Cada imagen tiene su HTML fuente autocontenido. El estilo común está en
`_shared.css`. El render a PNG usa Playwright/Chromium.

```sh
# Desde este directorio:
C:\Python314\python.exe _render.py
```

El script (`_render.py`):

1. Abre cada `NN-*.html` en Chromium con viewport de 1280x800.
2. Toma una captura del viewport (clip exacto 1280x800, no full page).
3. Verifica con Pillow que el PNG mida exactamente 1280x800.

Requisitos: `playwright` (con Chromium instalado) y `pillow` en el Python del
sistema (`C:\Python314`). Ambos ya estaban presentes al generar esta versión.

### Para editar

- Cambiá el texto/datos en el `.html` correspondiente (o los estilos comunes en
  `_shared.css`) y volvé a correr `_render.py`.
- Mantené siempre los datos ficticios. No pegues carátulas, números de
  expediente ni juzgados de causas reales.

## Archivos

- `_shared.css` - estilos compartidos (paleta + estructura del panel).
- `_render.py` - script de render y verificación de tamaño.
- `01-causas-unificada.html` .. `04-importar-todo.html` - fuentes.
- `01-causas-unificada.png` .. `04-importar-todo.png` - salidas 1280x800.
