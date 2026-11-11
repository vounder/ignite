"""Erzeugt die App-Symbole der Browser-Version aus assets/logo.png (braucht Pillow).

    python web/tools/make_icons.py

Ergebnis in assets/icons/:
  icon-192.png, icon-512.png          Logo auf Nussbaum mit runden Ecken (Zweck "any")
  maskable-192.png, maskable-512.png  randlos, Logo in der sicheren Zone (Zweck "maskable")
  apple-touch-icon.png                180 px, randlos (iOS rundet selbst ab)
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "assets" / "icons"
SIZE = 1024  # Arbeitsgroesse; die Symbole werden daraus verkleinert
CENTER = (0x4A, 0x26, 0x16)
EDGE = (0x12, 0x0A, 0x06)


def background():
    """Nussbaum mit Glut von unten: heller Kern, dunkler Rand."""
    small = Image.new("RGB", (64, 64))
    pixels = small.load()
    for y in range(64):
        for x in range(64):
            dx, dy = (x - 31.5) / 32, (y - 36) / 32
            t = min(1.0, (dx * dx + dy * dy) ** 0.5 / 1.25)
            t = t * t * (3 - 2 * t)
            pixels[x, y] = tuple(round(c + (e - c) * t) for c, e in zip(CENTER, EDGE))
    return small.resize((SIZE, SIZE), Image.BICUBIC)


def compose(logo, share):
    """Logo mittig auf den Hintergrund; share = Breite des Logos im Verhaeltnis zur Kante."""
    image = background().convert("RGBA")
    width = round(SIZE * share)
    scaled = logo.resize((width, round(logo.height * width / logo.width)), Image.LANCZOS)
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    position = ((SIZE - scaled.width) // 2, (SIZE - scaled.height) // 2)
    shadow.paste((0, 0, 0, 150), (position[0], position[1] + round(SIZE * 0.018)), scaled.getchannel("A"))
    image = Image.alpha_composite(image, shadow)
    image.alpha_composite(scaled, position)
    return image


def rounded(image, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius=radius, fill=255)
    result = image.copy()
    result.putalpha(ImageChops.multiply(image.getchannel("A"), mask))
    return result


def save(image, name, size, opaque):
    scaled = image.resize((size, size), Image.LANCZOS)
    if opaque:
        scaled = scaled.convert("RGB")
    scaled.save(OUT / name, optimize=True)
    print(name, size)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    logo = Image.open(WEB / "assets" / "logo.png").convert("RGBA")
    plain = rounded(compose(logo, 0.86), round(SIZE * 0.2))
    # Sichere Zone bei "maskable": Kreis mit 80 % der Kante; das Logo (640x485) passt bei 62 % Breite hinein.
    safe = compose(logo, 0.62)
    for size in (192, 512):
        save(plain, "icon-%d.png" % size, size, False)
        save(safe, "maskable-%d.png" % size, size, True)
    save(compose(logo, 0.8), "apple-touch-icon.png", 180, True)


if __name__ == "__main__":
    main()
