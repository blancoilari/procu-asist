# Flyer promocional de ProcuAsist (WhatsApp)

Material de difusión para compartir entre abogados por WhatsApp.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `flyer-whatsapp.png` | Flyer vertical 1080x1350 px (formato ideal para WhatsApp) |
| `flyer-whatsapp-cuadrado.png` | Variante cuadrada 1080x1080 px |
| `flyer-whatsapp.html` | Fuente HTML+CSS del flyer vertical (editable) |
| `flyer-whatsapp-cuadrado.html` | Fuente HTML+CSS de la variante cuadrada |
| `qr-store.png` | QR generado localmente, apunta a la ficha de Chrome Web Store |
| `generate-qr.py` | Script que genera `qr-store.png` |
| `render-flyers.py` | Script que renderiza los HTML a PNG con Playwright/Chromium |

## Diseño

- Colores tomados del icono de la extensión (`public/icon/logo.svg`): gradiente azul `#2563eb` a `#1d4ed8`, azules de apoyo `#1e3a8a` / `#14285a`, fondos claros `#eff6ff` / `#dbeafe`.
- Tipografías (Google Fonts): **Sora** para el nombre del producto y títulos, **Inter** para el cuerpo.
- El logo va inline como SVG dentro de cada HTML, así que se puede retocar sin depender de archivos externos.

## Cómo regenerar

1. **QR** (solo si cambia la URL de la Store). Requiere un Python con `qrcode[pil]`; se puede usar un venv temporal:

   ```powershell
   python -m venv qrvenv
   qrvenv\Scripts\pip install "qrcode[pil]"
   qrvenv\Scripts\python generate-qr.py
   ```

   El QR se genera 100% local (sin servicios externos), con corrección de errores M y zona de silencio de 4 módulos.

2. **PNG finales**. Requiere un Python con `playwright` y `pillow`, y el Chromium de Playwright instalado (`python -m playwright install chromium`). En esta máquina se usó el Python del sistema (`C:\Python314\python.exe`), que ya tiene ambos:

   ```powershell
   python render-flyers.py
   ```

   El script renderiza cada HTML a escala 2x y reduce con Lanczos al tamaño final, para texto más nítido. Necesita internet la primera vez para bajar las fuentes de Google Fonts.

3. **Verificación sugerida**: abrir los PNG y controlar que no haya texto cortado, y decodificar el QR (por ejemplo con `zxing-cpp`: `pip install zxing-cpp`) para confirmar que apunta a la URL de la Store.

## Texto sugerido para acompañar el flyer en WhatsApp

> Colegas: les comparto ProcuAsist, una extensión gratuita de Chrome para abogados. Descarga expedientes completos de MEV y PJN en un ZIP con un click, monitorea causas con alertas de movimientos y calcula plazos procesales con avisos. Hecha por un abogado de la matrícula; sin crear cuenta, tus datos quedan en tu navegador.
>
> https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem
