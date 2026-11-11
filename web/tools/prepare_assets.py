"""Bereitet die Assets der Browser-Version aus den Godot-Quellen auf.

Aufruf (aus dem Repo-Wurzelverzeichnis):
    python web/tools/prepare_assets.py [--audio] [--generated <Ordner>]

- Spezialkarten, Manfred und Logo werden verkleinert nach web/assets kopiert.
  (Der Pixel-Font entsteht separat mit web/tools/make_font.py.)
- Mit --generated <Ordner> werden frisch generierte Greenscreen-Bilder (Unterordner
  enemies/ und trinkets/) freigestellt und nach web/assets/enemies bzw. trinkets gelegt.
- Mit --audio wird die Musik auf 24 kHz Mono reduziert (reines Python, dauert etwas).
"""
import array
import sys
import wave
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "godot" / "game" / "Assets"
DST = ROOT / "web" / "assets"


def images():
    (DST / "special").mkdir(parents=True, exist_ok=True)
    for path in sorted((SRC / "Cards" / "Special").glob("*_v2.png")):
        im = Image.open(path).convert("RGBA").resize((128, 128), Image.NEAREST)
        im.save(DST / "special" / path.name.replace("_v2", ""), optimize=True)

    (DST / "manfred").mkdir(parents=True, exist_ok=True)
    for index in range(4):
        im = Image.open(SRC / "Characters" / "Manfred" / f"manfred_{index}.png").convert("RGBA")
        im = im.resize((256, 256), Image.BOX)
        # harte Alphakante, damit die Pixel-Optik erhalten bleibt
        alpha = im.getchannel("A").point(lambda value: 255 if value > 110 else 0)
        im.putalpha(alpha)
        im.save(DST / "manfred" / f"manfred_{index}.png", optimize=True)

    logo = Image.open(SRC / "UI" / "logo.png").convert("RGBA")
    box = logo.getbbox()
    if box:
        logo = logo.crop(box)
    width = 640
    logo = logo.resize((width, round(logo.height * width / logo.width)), Image.BOX)
    logo.save(DST / "logo.png", optimize=True)



def cutout(source, target, size):
    """Stellt ein Motiv vom Chroma-Gruen frei, schneidet es quadratisch zu und verkleinert es."""
    im = Image.open(source).convert("RGBA")
    px = im.load()
    width, height = im.size
    for y in range(height):
        for x in range(width):
            r, g, b, _ = px[x, y]
            if g > 140 and g > r * 1.35 and g > b * 1.35:
                px[x, y] = (0, 0, 0, 0)
            elif g > r and g > b:
                # gruener Saum an Kanten: Gruen auf das Mittel von Rot/Blau druecken
                px[x, y] = (r, (r + b) // 2, b, 255)
    box = im.getbbox()
    if box:
        im = im.crop(box)
    side = max(im.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(im, ((side - im.width) // 2, side - im.height))
    square = square.resize((size, size), Image.BOX)
    alpha = square.getchannel("A").point(lambda value: 255 if value > 120 else 0)
    square.putalpha(alpha)
    target.parent.mkdir(parents=True, exist_ok=True)
    square.save(target, optimize=True)


def generated(folder):
    folder = Path(folder)
    for path in sorted((folder / "enemies").glob("*.png")):
        cutout(path, DST / "enemies" / path.name, 192)
    for path in sorted((folder / "trinkets").glob("*.png")):
        cutout(path, DST / "trinkets" / path.name, 96)


def audio():
    (DST / "audio").mkdir(parents=True, exist_ok=True)
    for name in ("menu", "game", "shop"):
        with wave.open(str(SRC / "Audio" / f"{name}.wav")) as source:
            channels, rate, width = source.getnchannels(), source.getframerate(), source.getsampwidth()
            if width != 2:
                raise SystemExit(f"{name}.wav: nur 16 Bit wird unterstuetzt")
            samples = array.array("h")
            samples.frombytes(source.readframes(source.getnframes()))
        step = channels * 2  # zwei Frames zu einem Mono-Sample mitteln
        total = len(samples) // step
        out = array.array("h", bytes(total * 2))
        for index in range(total):
            base = index * step
            acc = 0
            for offset in range(step):
                acc += samples[base + offset]
            out[index] = acc // step
        with wave.open(str(DST / "audio" / f"{name}.wav"), "wb") as target:
            target.setnchannels(1)
            target.setsampwidth(2)
            target.setframerate(rate // 2)
            target.writeframes(out.tobytes())
        print("audio", name, total / (rate // 2), "s")


if __name__ == "__main__":
    images()
    print("images ok")
    if "--generated" in sys.argv:
        generated(sys.argv[sys.argv.index("--generated") + 1])
        print("generated ok")
    if "--audio" in sys.argv:
        audio()
