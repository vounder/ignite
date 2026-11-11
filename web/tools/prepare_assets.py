"""Bereitet die Assets der Browser-Version aus den Godot-Quellen auf.

Aufruf (aus dem Repo-Wurzelverzeichnis):
    python web/tools/prepare_assets.py [--audio] [--generated <Ordner>] [--sheets <Ordner>] [--manfred <Ordner>] [--optimize] [--icons <Ordner> <Zielordner>]

- Spezialkarten und Logo werden verkleinert nach web/assets kopiert.
  (Der Pixel-Font entsteht separat mit web/tools/make_font.py.)
- Mit --generated <Ordner> werden frisch generierte Greenscreen-Bilder (Unterordner
  enemies/ und trinkets/) freigestellt und nach web/assets/enemies bzw. trinkets gelegt.
- Mit --sheets <Ordner> werden 3x2-Ausdrucks-Sheets der Gegner (neutral, Blinzeln, haemisch,
  wuetend, geschockt, geschlagen) in deckungsgleiche Sprite-Streifen zerlegt.
- Mit --manfred <Ordner> werden Manfreds zwei Posen-Sheets (manfred-a.png, manfred-b.png) zu
  einem Streifen aus zwoelf Posen zusammengesetzt.
- Mit --audio wird die Musik als MP3 kodiert (braucht das Paket lameenc).
- Mit --optimize werden alle PNGs unter web/assets auf Farbpalette umgerechnet.
"""
import sys
import wave
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[2]
MP3_KBPS = 112
SRC = ROOT / "godot" / "game" / "Assets"
DST = ROOT / "web" / "assets"


def save_png(im, target):
    """Speichert als PNG mit Farbpalette. Bei Pixel-Art ist das verlustfrei genug und rund fuenfmal kleiner."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if im.mode != "P":
        im = im.convert("RGBA").quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    im.save(target, optimize=True)


def optimize():
    """Rechnet alle vorhandenen PNGs unter web/assets auf Palette um (mehrfach ausfuehrbar)."""
    before = after = 0
    for path in sorted(DST.rglob("*.png")):
        im = Image.open(path)
        im.load()
        before += path.stat().st_size
        if im.mode != "P":
            save_png(im, path)
        after += path.stat().st_size
    print("  PNG gesamt: %d KB -> %d KB" % (before // 1024, after // 1024))


def images():
    (DST / "special").mkdir(parents=True, exist_ok=True)
    for path in sorted((SRC / "Cards" / "Special").glob("*_v2.png")):
        im = Image.open(path).convert("RGBA").resize((128, 128), Image.NEAREST)
        save_png(im, DST / "special" / path.name.replace("_v2", ""))

    logo = Image.open(SRC / "UI" / "logo.png").convert("RGBA")
    box = logo.getbbox()
    if box:
        logo = logo.crop(box)
    width = 640
    logo = logo.resize((width, round(logo.height * width / logo.width)), Image.BOX)
    save_png(logo, DST / "logo.png")



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
    save_png(square, target)


def generated(folder):
    folder = Path(folder)
    for path in sorted((folder / "trinkets").glob("*.png")):
        cutout(path, DST / "trinkets" / path.name, 96)


def key_green(im):
    """Macht Chroma-Gruen transparent und entfaerbt gruene Kantensaeume."""
    im = im.convert("RGBA")
    px = im.load()
    width, height = im.size
    for y in range(height):
        for x in range(width):
            r, g, b, _ = px[x, y]
            if g > 140 and g > r * 1.35 and g > b * 1.35:
                px[x, y] = (0, 0, 0, 0)
            elif g > r and g > b:
                px[x, y] = (r, (r + b) // 2, b, 255)
    return im


def runs(counts, minimum, gap):
    """Zusammenhaengende belegte Bereiche einer Projektion (Spalten oder Zeilen)."""
    out, start, empty = [], None, 0
    for index, value in enumerate(counts):
        if value > minimum:
            if start is None:
                start = index
            empty = 0
        elif start is not None:
            empty += 1
            if empty >= gap:
                out.append((start, index - empty + 1))
                start, empty = None, 0
    if start is not None:
        out.append((start, len(counts)))
    return [run for run in out if run[1] - run[0] > 40]


def register(frame, reference):
    """Sucht den kleinen Versatz, mit dem der Oberkoerper am besten auf dem Referenzbild liegt."""
    small = (frame.width // 3, frame.height // 3)
    a = reference.resize(small, Image.BOX)
    b = frame.resize(small, Image.BOX)
    top = int(small[1] * 0.6)  # nur Schultern und Brust vergleichen, das Gesicht aendert sich ja
    best, best_offset = None, (0, 0)
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            shifted = ImageChops.offset(b, dx, dy)
            diff = ImageChops.difference(a.crop((0, top, small[0], small[1])), shifted.crop((0, top, small[0], small[1])))
            score = sum(ImageStat.Stat(diff).sum)
            if best is None or score < best:
                best, best_offset = score, (dx * 3, dy * 3)
    return best_offset


def grid_cells(source):
    """Liest ein 3x2-Sheet und liefert die sechs freigestellten, auf ihren Inhalt beschnittenen Felder."""
    im = key_green(Image.open(source))
    alpha = im.getchannel("A")
    width, height = im.size
    data = alpha.tobytes()
    cols = [0] * width
    rows = [0] * height
    for y in range(height):
        row = data[y * width:(y + 1) * width]
        filled = width - row.count(0)
        rows[y] = filled
        if filled:
            for x in range(width):
                if row[x]:
                    cols[x] += 1
    col_runs, row_runs = runs(cols, 2, 10), runs(rows, 2, 10)
    if len(col_runs) != 3 or len(row_runs) != 2:
        print("  Raster nicht erkannt, teile gleichmaessig:", Path(source).name, len(col_runs), len(row_runs))
        col_runs = [(width * i // 3, width * (i + 1) // 3) for i in range(3)]
        row_runs = [(height * i // 2, height * (i + 1) // 2) for i in range(2)]
    cells = []
    for top, bottom in row_runs:
        for left, right in col_runs:
            cell = im.crop((left, top, right, bottom))
            box = cell.getbbox()
            cells.append(cell.crop(box) if box else cell)
    return cells


def base_center(cell):
    """Mitte der Unterkante (Rumpf) eines Feldes – bleibt stabil, auch wenn Arme oder Requisiten herausragen."""
    band = cell.crop((0, int(cell.height * 0.9), cell.width, cell.height)).getchannel("A")
    box = band.getbbox()
    return (box[0] + box[2]) / 2 if box else cell.width / 2


def manfred(folder, size=256):
    """Setzt die beiden Posen-Sheets (manfred-a, manfred-b) zu einem Streifen aus zwoelf Posen zusammen."""
    folder = Path(folder)
    cells = grid_cells(folder / "manfred-a.png") + grid_cells(folder / "manfred-b.png")
    anchors = [base_center(cell) for cell in cells]
    half = max(max(anchor, cell.width - anchor) for cell, anchor in zip(cells, anchors))
    side = int(max(2 * half, max(cell.height for cell in cells))) + 24
    strip = Image.new("RGBA", (size * len(cells), size), (0, 0, 0, 0))
    for index, (cell, anchor) in enumerate(zip(cells, anchors)):
        frame = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        frame.paste(cell, (int(round(side / 2 - anchor)), side - cell.height))
        small = frame.resize((size, size), Image.BOX)
        small.putalpha(small.getchannel("A").point(lambda value: 255 if value > 120 else 0))
        strip.paste(small, (index * size, 0))
    (DST / "manfred").mkdir(parents=True, exist_ok=True)
    for old in (DST / "manfred").glob("manfred_*.png"):
        old.unlink()
    save_png(strip, DST / "manfred" / "manfred.png")


def sheet(source, target, size=192):
    """Zerlegt ein 3x2-Ausdrucks-Sheet in einen Streifen aus sechs deckungsgleichen Bildern."""
    cells = grid_cells(source)
    side = max(max(cell.width for cell in cells), max(cell.height for cell in cells)) + 24
    frames = []
    for cell in cells:
        frame = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        frame.paste(cell, ((side - cell.width) // 2, side - cell.height))
        frames.append(frame)
    for index in range(1, len(frames)):
        dx, dy = register(frames[index], frames[0])
        if dx or dy:
            moved = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            moved.paste(frames[index], (dx, dy))
            frames[index] = moved
    strip = Image.new("RGBA", (size * len(frames), size), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        small = frame.resize((size, size), Image.BOX)
        small.putalpha(small.getchannel("A").point(lambda value: 255 if value > 120 else 0))
        strip.paste(small, (index * size, 0))
    save_png(strip, target)


def sheets(folder):
    """Alle Ausdrucks-Sheets (auch in Unterordnern) nach web/assets/enemies schneiden."""
    for path in sorted(Path(folder).rglob("*.png")):
        if path.stem in ("nimble-fingers",):
            cutout(path, DST / "trinkets" / path.name, 96)
        else:
            sheet(path, DST / "enemies" / path.name)
            print("  sheet", path.stem)


def icons(folder, subdir):
    """Stellt einzelne Greenscreen-Icons frei und legt sie unter web/assets/<subdir> ab (z. B. trinkets, perks)."""
    for path in sorted(Path(folder).rglob("*.png")):
        cutout(path, DST / subdir / path.name, 96)
        print("  icon", subdir, path.stem)


def audio():
    """Wandelt die Musik in MP3 um (braucht das Paket "lameenc": pip install lameenc)."""
    import lameenc

    (DST / "audio").mkdir(parents=True, exist_ok=True)
    for name in ("menu", "game", "shop"):
        with wave.open(str(SRC / "Audio" / f"{name}.wav")) as source:
            channels, rate, width = source.getnchannels(), source.getframerate(), source.getsampwidth()
            if width != 2:
                raise SystemExit(f"{name}.wav: nur 16 Bit wird unterstuetzt")
            pcm = source.readframes(source.getnframes())
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(MP3_KBPS)
        encoder.set_in_sample_rate(rate)
        encoder.set_channels(channels)
        encoder.set_quality(2)
        data = encoder.encode(pcm) + encoder.flush()
        (DST / "audio" / f"{name}.mp3").write_bytes(bytes(data))
        old = DST / "audio" / f"{name}.wav"
        if old.exists():
            old.unlink()
        print("  audio", name, len(data) // 1024, "KB")


if __name__ == "__main__":
    images()
    print("images ok")
    if "--generated" in sys.argv:
        generated(sys.argv[sys.argv.index("--generated") + 1])
        print("generated ok")
    if "--manfred" in sys.argv:
        manfred(sys.argv[sys.argv.index("--manfred") + 1])
        print("manfred ok")
    if "--icons" in sys.argv:
        position = sys.argv.index("--icons")
        icons(sys.argv[position + 1], sys.argv[position + 2])
    if "--sheets" in sys.argv:
        sheets(sys.argv[sys.argv.index("--sheets") + 1])
        print("sheets ok")
    if "--audio" in sys.argv:
        audio()
    if "--optimize" in sys.argv:
        optimize()
