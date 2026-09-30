"""
Genera los íconos PNG de la app (icons/icono-192.png, -512 y maskable) con el
mismo dibujo de icons/icono.svg. Usa Pillow del Python portátil:

    ..\\python.exe tools\\generar_iconos.py      (desde la carpeta pwa)
"""

from pathlib import Path

from PIL import Image, ImageDraw

DORADO, BLANCO = (190, 137, 0, 255), (255, 255, 255, 255)
SALIDA = Path(__file__).resolve().parents[1] / "icons"


def dibujar(lado: int, maskable: bool) -> Image.Image:
    esc = 4  # se dibuja grande y se achica: bordes suaves
    L = lado * esc
    img = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, L, L], fill=DORADO)  # Android recorta la forma
        k, off = L / 32 * 0.72, L * 0.14         # dibujo dentro de la zona segura
    else:
        d.rounded_rectangle([0, 0, L - 1, L - 1], radius=L * 7 / 32, fill=DORADO)
        k, off = L / 32, 0
    p = lambda x, y: (off + x * k, off + y * k)  # noqa: E731
    g = 2 * k
    d.rounded_rectangle([*p(8, 7), *p(24, 26)], radius=2 * k, outline=BLANCO, width=round(g))
    for y, x2 in ((12, 20), (16, 20), (20, 17)):
        d.line([p(12, y), p(x2, y)], fill=BLANCO, width=round(g))
        for x in (12, x2):
            cx, cy = p(x, y)
            d.ellipse([cx - g / 2, cy - g / 2, cx + g / 2, cy + g / 2], fill=BLANCO)
    return img.resize((lado, lado), Image.LANCZOS)


if __name__ == "__main__":
    dibujar(192, False).save(SALIDA / "icono-192.png")
    dibujar(512, False).save(SALIDA / "icono-512.png")
    dibujar(512, True).save(SALIDA / "icono-maskable-512.png")
    print("íconos listos en", SALIDA)
