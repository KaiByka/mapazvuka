"""Generate PWA icons from logo.png (784x660 RGBA)."""
from PIL import Image

SRC = r"C:\Users\ipavlesic\Documents\VSCode\mapa_zvuka\mapazvuka\logo.png"
OUT = r"C:\Users\ipavlesic\Documents\VSCode\mapa_zvuka\mapazvuka\icons"
BG = (26, 26, 26, 255)  # var(--bg-color) #1a1a1a

import os
os.makedirs(OUT, exist_ok=True)

logo = Image.open(SRC).convert("RGBA")

def make(size, fill_ratio, name):
    img = Image.new("RGBA", (size, size), BG)
    target = int(size * fill_ratio)
    # Fit logo (non-square) into target box preserving aspect ratio
    scale = min(target / logo.width, target / logo.height)
    new_w, new_h = int(logo.width * scale), int(logo.height * scale)
    resized = logo.resize((new_w, new_h), Image.LANCZOS)
    img.paste(resized, ((size - new_w) // 2, (size - new_h) // 2), resized)
    img.save(os.path.join(OUT, name), optimize=True)
    print("wrote", name)

# Regular icons: logo fills ~86% (leaves small margin, square canvas)
make(192, 0.86, "icon-192.png")
make(512, 0.86, "icon-512.png")

# Maskable icons: content within 66% safe zone, full-bleed background
make(192, 0.66, "icon-maskable-192.png")
make(512, 0.66, "icon-maskable-512.png")

# Apple touch icon (iOS ignores transparency, solid bg mandatory)
make(180, 0.80, "apple-touch-icon.png")

print("done")
