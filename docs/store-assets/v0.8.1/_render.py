"""
Renderiza a PNG de 1280x800 las capturas sinteticas de portales de ProcuAsist.

Uso:  C:\\Python314\\python.exe _render.py
Requiere: playwright (con Chromium instalado) y pillow.

Es un script manual: lo corre una persona cuando hay que rehacer las capturas.
No queda agendado ni corre solo, asi que no lleva aviso de fallo del
notificador comun; si falla, falla en pantalla.

Los HTML de este directorio usan SOLO datos inventados. Antes de tocarlos, leer
el README.md de esta carpeta.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from PIL import Image

HERE = Path(__file__).resolve().parent

PAGES = [
    "01-mev-expediente",
    "02-mev-modal-pasos",
    "03-pjn-modal-zip",
    "04-zip-descomprimido",
    "05-pdf-resumen",
]

W, H = 1280, 800


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": W, "height": H},
            device_scale_factor=1,
        )
        for name in PAGES:
            html = HERE / f"{name}.html"
            png = HERE / f"{name}.png"
            page.goto(html.as_uri())
            page.wait_for_timeout(300)
            # Captura del viewport exacto (no full_page) para garantizar 1280x800.
            page.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": W, "height": H})
            # Verificacion dura del tamano que exige la Chrome Web Store.
            with Image.open(png) as im:
                assert im.size == (W, H), f"{name}: {im.size} != ({W}, {H})"
            print(f"OK  {png.name}  {W}x{H}")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
