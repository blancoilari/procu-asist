# -*- coding: utf-8 -*-
"""Renderiza los flyers HTML a PNG con Playwright/Chromium.

Uso (con un Python que tenga playwright + pillow; en esta maquina, el del sistema):
    python render-flyers.py

Renderiza a escala 2x y reduce a tamano final con Lanczos para texto mas nitido.
Requiere haber corrido antes generate-qr.py (usa qr-store.png).
"""
import io
import os
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent

TARGETS = [
    ("flyer-whatsapp.html", "flyer-whatsapp.png", 1080, 1350),
    ("flyer-whatsapp-cuadrado.html", "flyer-whatsapp-cuadrado.png", 1080, 1080),
]

SCALE = 2

with sync_playwright() as p:
    browser = p.chromium.launch()
    for html_name, png_name, w, h in TARGETS:
        page = browser.new_page(
            viewport={"width": w, "height": h},
            device_scale_factor=SCALE,
        )
        page.goto((HERE / html_name).as_uri(), wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(400)
        raw = page.screenshot(type="png")
        page.close()

        img = Image.open(io.BytesIO(raw))
        img = img.resize((w, h), Image.LANCZOS).convert("RGB")
        out = HERE / png_name
        img.save(out, optimize=True)
        print(f"OK {out} ({w}x{h})")
    browser.close()
