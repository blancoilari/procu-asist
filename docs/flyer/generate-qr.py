# -*- coding: utf-8 -*-
"""Genera el QR local que apunta a la ficha de ProcuAsist en Chrome Web Store.

Uso (con un venv que tenga qrcode[pil] instalado):
    python generate-qr.py

Genera qr-store.png en esta misma carpeta. No usa servicios externos.
"""
import os
import qrcode
from qrcode.constants import ERROR_CORRECT_M

URL = "https://chromewebstore.google.com/detail/procuasist-copiloto-legal/dbkfeofoijnkclfpigimiodcccpjakem"

qr = qrcode.QRCode(
    error_correction=ERROR_CORRECT_M,
    box_size=12,
    border=4,  # zona de silencio: 4 modulos por lado
)
qr.add_data(URL)
qr.make(fit=True)

img = qr.make_image(fill_color="#1e3a8a", back_color="#ffffff")
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qr-store.png")
img.save(out)
print(f"QR generado: {out} ({img.size[0]}x{img.size[1]} px, version {qr.version})")
