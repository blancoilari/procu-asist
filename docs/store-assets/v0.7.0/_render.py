"""
Renderiza los HTML promocionales de ProcuAsist v0.7.0 a PNG de 1280x800.

Uso:  C:\\Python314\\python.exe _render.py
Requiere: playwright (con Chromium instalado) y pillow.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from PIL import Image

HERE = Path(__file__).resolve().parent

PAGES = [
    "01-causas-unificada",
    "02-alertas-por-expediente",
    "03-plazos",
    "04-importar-todo",
    "05-descargar-expediente",
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
            # Verificación dura del tamaño.
            with Image.open(png) as im:
                assert im.size == (W, H), f"{name}: {im.size} != ({W}, {H})"
            print(f"OK  {png.name}  {W}x{H}")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
