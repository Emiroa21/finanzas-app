"""Genera los iconos PNG de la app en public/ (requiere Pillow)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(sys.argv[1] if len(sys.argv) > 1 else "public")


def icon(size: int) -> Image.Image:
    s = size / 512
    img = Image.new("RGB", (size, size), (20, 140, 90))
    d = ImageDraw.Draw(img)
    # Tres barras ascendentes, como una gráfica de crecimiento.
    for i, h in enumerate((150, 230, 310)):
        x0 = (126 + i * 96) * s
        d.rounded_rectangle([x0, (390 - h) * s, x0 + 68 * s, 390 * s], radius=14 * s, fill=(255, 255, 255))
    d.rounded_rectangle([110 * s, 404 * s, 402 * s, 420 * s], radius=8 * s, fill=(255, 255, 255))
    return img


for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
    icon(size).save(out / name)
