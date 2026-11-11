"""Erzeugt den Pixel-Font der Browser-Version (web/assets/fonts/zuendung_pixel.ttf).

Die Glyphen sind unten als Bitmaps definiert (fette 2-Pixel-Stämme, 7 Zeilen Versalhöhe,
optional 2 Akzentzeilen darüber und 2 Unterlängen-Zeilen). Braucht fontTools:

    python web/tools/make_font.py
"""
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

OUT = Path(__file__).resolve().parents[1] / "assets" / "fonts" / "zuendung_pixel.ttf"
PX = 100          # Einheiten je Pixel
UPM = 1000
ASCENT, DESCENT = 9 * PX, 2 * PX

G = {}


def glyph(chars, rows, top=0):
    """rows: Zeilen von oben nach unten; top=-2 beginnt in den Akzentzeilen."""
    for ch in chars:
        G[ch] = (rows.split("/"), top)


glyph("A", ".####./##..##/##..##/######/##..##/##..##/##..##")
glyph("B", "#####./##..##/##..##/#####./##..##/##..##/#####.")
glyph("C", ".####./##..##/##..../##..../##..../##..##/.####.")
glyph("D", "####../##.##./##..##/##..##/##..##/##.##./####..")
glyph("E", "######/##..../##..../#####./##..../##..../######")
glyph("F", "######/##..../##..../#####./##..../##..../##....")
glyph("G", ".####./##..##/##..../##.###/##..##/##..##/.####.")
glyph("H", "##..##/##..##/##..##/######/##..##/##..##/##..##")
glyph("I", "####/.##./.##./.##./.##./.##./####")
glyph("J", "..####/...##./...##./...##./...##./##.##./.###..")
glyph("K", "##..##/##.##./####../###.../####../##.##./##..##")
glyph("L", "##..../##..../##..../##..../##..../##..../######")
glyph("M", "##...##/###.###/#######/##.#.##/##...##/##...##/##...##")
glyph("N", "##..##/###.##/###.##/######/##.###/##.###/##..##")
glyph("O", ".####./##..##/##..##/##..##/##..##/##..##/.####.")
glyph("P", "#####./##..##/##..##/#####./##..../##..../##....")
glyph("Q", ".####./##..##/##..##/##..##/##.###/##.##./.###.#")
glyph("R", "#####./##..##/##..##/#####./####../##.##./##..##")
glyph("S", ".#####/##..../##..../.####./....##/....##/#####.")
glyph("T", "######/..##../..##../..##../..##../..##../..##..")
glyph("U", "##..##/##..##/##..##/##..##/##..##/##..##/.####.")
glyph("V", "##..##/##..##/##..##/##..##/##..##/.####./..##..")
glyph("W", "##...##/##...##/##...##/##.#.##/#######/###.###/##...##")
glyph("X", "##..##/##..##/.####./..##../.####./##..##/##..##")
glyph("Y", "##..##/##..##/.####./..##../..##../..##../..##..")
glyph("Z", "######/....##/...##./..##../.##.../##..../######")
glyph("Ä", "##..##/....../.####./##..##/##..##/######/##..##/##..##/##..##", top=-2)
glyph("Ö", "##..##/....../.####./##..##/##..##/##..##/##..##/##..##/.####.", top=-2)
glyph("Ü", "##..##/....../##..##/##..##/##..##/##..##/##..##/##..##/.####.", top=-2)
glyph("ß", ".####./##..##/##..##/##.##./##..##/##..##/##.##.")
glyph("0", ".####./##..##/##.###/######/###.##/##..##/.####.")
glyph("1", "..##../.###../..##../..##../..##../..##../######")
glyph("2", ".####./##..##/....##/...##./..##../.##.../######")
glyph("3", ".####./##..##/....##/..###./....##/##..##/.####.")
glyph("4", "...###/..####/.##.##/##..##/######/....##/....##")
glyph("5", "######/##..../#####./....##/....##/##..##/.####.")
glyph("6", ".####./##..../##..../#####./##..##/##..##/.####.")
glyph("7", "######/....##/...##./..##../..##../..##../..##..")
glyph("8", ".####./##..##/##..##/.####./##..##/##..##/.####.")
glyph("9", ".####./##..##/##..##/.#####/....##/....##/.####.")
glyph(" ", ".../.../.../.../.../.../...")
glyph(".", "../../../../../##/##")
glyph(",", "../../../../../##/##/#.")
glyph("!", "##/##/##/##/##/../##")
glyph("?", ".####./##..##/....##/...##./..##../....../..##..")
glyph(":", "../##/##/../##/##/..")
glyph(";", "../##/##/../##/##/#.")
glyph("-", "..../..../..../####/..../..../....")
glyph("–—", "....../....../....../######/....../....../......")
glyph("+", "....../..##../..##../######/..##../..##../......")
glyph("×", "....../##..##/.####./..##../.####./##..##/......")
glyph("·•", "../../../##/##/../..")
glyph("/", "....##/...##./...##./..##../.##.../.##.../##....")
glyph("(", ".##/##./##./##./##./##./.##")
glyph(")", "##./.##/.##/.##/.##/.##/##.")
glyph("%", "##..##/##.##./...##./..##../.##.../.##.##/##..##")
glyph("'’‘", "##/##/#./../../../..")
glyph("\"“”„", "##.##/##.##/#..#./...../...../...../.....")
glyph("=", "...../...../#####/...../#####/...../.....")
glyph("…", "......../......../......../......../......../##.##.##/##.##.##")
glyph("&", ".###../##.##./##.##./.###../##.###/##.##./.##.##")
glyph("<", "...##/..##./.##../##.../.##../..##./...##")
glyph(">", "##.../.##../..##./...##/..##./.##../##...")
glyph("*", "....../#.##.#/.####./######/.####./#.##.#/......")
glyph("#", ".#..#./######/.#..#./.#..#./######/.#..#./......")
glyph("−", "....../....../....../######/....../....../......")


def draw(rows, top):
    pen = TTGlyphPen(None)
    for index, row in enumerate(rows):
        y_top = (7 - (index + top)) * PX
        y_bottom = y_top - PX - (6 if index < len(rows) - 1 else 0)  # leichte Ueberlappung gegen Haarlinien
        x = 0
        while x < len(row):
            if row[x] != "#":
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == "#":
                x += 1
            pen.moveTo((start * PX, y_bottom))
            pen.lineTo((start * PX, y_top))
            pen.lineTo((x * PX, y_top))
            pen.lineTo((x * PX, y_bottom))
            pen.closePath()
    return pen.glyph()


def main():
    names, cmap, glyphs, metrics = [".notdef"], {}, {}, {}
    pen = TTGlyphPen(None)
    pen.moveTo((100, 0)); pen.lineTo((100, 700)); pen.lineTo((500, 700)); pen.lineTo((500, 0)); pen.closePath()
    glyphs[".notdef"] = pen.glyph()
    metrics[".notdef"] = (600, 100)
    for ch, (rows, top) in G.items():
        name = "uni%04X" % ord(ch)
        if name not in glyphs:
            names.append(name)
            glyphs[name] = draw(rows, top)
            width = max(len(row) for row in rows)
            metrics[name] = ((width + 1) * PX, 0)
        cmap[ord(ch)] = name
    for ch in "abcdefghijklmnopqrstuvwxyzäöü":
        cmap[ord(ch)] = cmap[ord(ch.upper())]
    cmap[0xA0] = cmap[ord(" ")]

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT)
    fb.setupNameTable({"familyName": "Zuendung Pixel", "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=ASCENT, sTypoDescender=-DESCENT, sTypoLineGap=0, usWinAscent=ASCENT, usWinDescent=DESCENT,
                sCapHeight=7 * PX, sxHeight=7 * PX)
    fb.setupPost()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fb.save(OUT)
    print("saved", OUT, len(names), "glyphs")


if __name__ == "__main__":
    main()
