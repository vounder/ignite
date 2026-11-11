"""Erzeugt die Kartenflaechen der Browser-Version (web/assets/cards/faces.png).

Jedes Symbol hat seine eigene Stilwelt – Herz romantisch, Karo prunkvoll, Pik kuehl-militaerisch,
Kreuz gotisch – mit eigenem Papier, Rahmen, Zierrat und schattierten Pixel-Symbolen. Alles wird auf
einem Raster von 52x73 "Kartenpixeln" gezeichnet (ein Kartenpixel = 2 CSS-Pixel) und vierfach
vergroessert gespeichert, damit die Hoffiguren genug Aufloesung haben.

Der Atlas hat 8 Spalten und 5 Zeilen:
  Zeile 0-3  Herz, Karo, Pik, Kreuz – jeweils 7, 8, 9, 10, Bube, Dame, Koenig, Ass
  Zeile 4    Rahmen der Spezialkarten: Herz, Karo, Pik, Kreuz, Rot, Schwarz, Frei, Ungebunden

    python web/tools/make_cards.py                  Atlas neu bauen
    python web/tools/make_cards.py --import <dir>   vorher generierte Figurenboegen einlesen
                                                    (<dir>/<symbol>/<symbol>.png, <dir>/aces/aces.png)
    python web/tools/make_cards.py --preview <png>  zusaetzlich eine Vorschau mit Spezialkarten schreiben
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TOOLS = Path(__file__).resolve().parent
WEB = TOOLS.parent
ART = TOOLS / "cardart"
OUT = WEB / "assets" / "cards" / "faces.png"

W, H, S = 52, 73, 4                 # Kartenpixel und Vergroesserung
SUITS = ["hearts", "diamonds", "spades", "clubs"]
RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"]
FRAMES = ["hearts", "diamonds", "spades", "clubs", "red", "black", "wild", "none"]
WINDOW = (6, 6, 45, 66)             # Fenster der Hoffiguren (innen, einschliesslich)
COURT_BOX = (176, 222)              # Platz der Figur in echten Pixeln (etwas breiter als das Fenster)
ACE_BOX = (144, 168)


def col(value):
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


THEME = {
    "hearts": dict(rim="#fffaf6", paper="#fff0e9", tint="#fbdad5", line="#e58a9b", ink="#c8273a", hi="#ff9fb0",
                   sh="#7d1027", deep="#4f0a19", accent="#d9a441", sky=("#fde3df", "#f6b1be"), motif="#fff6f3"),
    "diamonds": dict(rim="#fffbea", paper="#fff2cf", tint="#fae6b4", line="#cf9a2c", ink="#dc4a1c", hi="#ffae42",
                     sh="#96280f", deep="#5e1a07", accent="#f0c558", sky=("#fdeaa6", "#f2c24c"), motif="#fff6cf"),
    "spades": dict(rim="#f8fbfd", paper="#e9eef3", tint="#d2dce6", line="#5e7396", ink="#1f2f57", hi="#8fb0de",
                   sh="#0e1730", deep="#080d1c", accent="#a9b6c4", sky=("#c9d7e8", "#8fa6c8"), motif="#e3ecf6"),
    "clubs": dict(rim="#f4f3e6", paper="#e6e4d0", tint="#cfceb5", line="#4d5540", ink="#1c1f18", hi="#6f8748",
                  sh="#0a0b08", deep="#000000", accent="#7a6d86", sky=("#bdb4c8", "#877c98"), motif="#e9e6d6"),
}
THEME = {suit: {k: (tuple(col(c) for c in v) if isinstance(v, tuple) else col(v)) for k, v in t.items()} for suit, t in THEME.items()}

# Symbole: x = Grundfarbe, h = Glanzlicht, s = Schatten. Dieselben 11er-Bitmaps stehen in web/js/cards.js.
PIPS11 = {
    "hearts": [".xxx...xxx.", "xhhxx.xxxxx", "xhxxxxxxxxx", "xxxxxxxxxxs", "xxxxxxxxxxs", "xxxxxxxxxss",
               ".xxxxxxxss.", "..xxxxxss..", "...xxxss...", "....xss....", ".....s....."],
    "diamonds": [".....x.....", "....hxx....", "...hhxxx...", "..hhhxxxx..", ".hhhhxxxxx.", "hhhhhxxxxxx",
                 ".xxxxxssss.", "..xxxxsss..", "...xxxss...", "....xxs....", ".....s....."],
    "spades": [".....x.....", "....xhx....", "...xxhxx...", "..xxxhxxx..", ".xxxxhxxxx.", "xxxxxhxxxxx",
               "xxxxxhxxxxs", "xxxx.x.xxss", ".xx..x..ss.", "....xxx....", "...hhhhh..."],
    "clubs": [".....x.....", "....xxx....", "...xhxxx...", "...xxxxx...", ".xx.xxx.xx.", "xxxxxxxxxxx",
              "xhxxxxxxhxx", "xxxx.x.xxxx", ".xx..x..xx.", "....xxx....", "...hhhhh..."],
}
PIPS9 = {
    "hearts": [".xx...xx.", "xhxx.xxxx", "xhxxxxxxx", "xxxxxxxxs", "xxxxxxxxs", ".xxxxxxs.", "..xxxxs..", "...xxs...", "....s...."],
    "diamonds": ["....x....", "...hxx...", "..hhxxx..", ".hhhxxxx.", "hhhhxxxxx", ".xxxxsss.", "..xxxss..", "...xxs...", "....s...."],
    "spades": ["....x....", "...xhx...", "..xxhxx..", ".xxxhxxx.", "xxxxhxxxx", "xxxxhxxxs", ".xx.x.ss.", "....x....", "...hhh..."],
    "clubs": ["....x....", "...xxx...", "..xhxxx..", ".x.xxx.x.", "xxxxxxxxx", "xhxxxxhxx", "xxx.x.xxx", ".x..x..x.", "...hhh..."],
}
MINI = {
    "hearts": [".x.x.", "xxxxx", "xxxxx", ".xxx.", "..x.."],
    "diamonds": ["..x..", ".xxx.", "xxxxx", ".xxx.", "..x.."],
    "spades": ["..x..", ".xxx.", "xxxxx", "x.x.x", ".xxx."],
    "clubs": ["..x..", "xxxxx", "..x..", "..x..", ".xxx."],
}
GLYPHS = {
    "7": "######/....##/...##./..##../..##../..##../..##..",
    "8": ".####./##..##/##..##/.####./##..##/##..##/.####.",
    "9": ".####./##..##/##..##/.#####/....##/....##/.####.",
    "10": ".##..####./###.##..##/.##.##..##/.##.##..##/.##.##..##/.##.##..##/.##..####.",
    "J": "#####./##..##/##..##/#####./##..##/##..##/#####.",   # B wie Bube
    "Q": "####../##.##./##..##/##..##/##..##/##.##./####..",   # D wie Dame
    "K": "##..##/##.##./####../###.../####../##.##./##..##",
    "A": ".####./##..##/##..##/######/##..##/##..##/##..##",
}
GLYPHS = {k: v.replace("#", "x").split("/") for k, v in GLYPHS.items()}
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
R = True  # Kennzeichen: Symbol steht kopf


def in_rr(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= (r + 0.3) ** 2


class Layer:
    """Eine Zeichenebene in Kartenpixeln."""

    def __init__(self, fill=(0, 0, 0, 0)):
        self.im = Image.new("RGBA", (W, H), fill)
        self.px = self.im.load()

    def set(self, x, y, c):
        if 0 <= x < W and 0 <= y < H and c is not None:
            self.px[x, y] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c(x, y) if callable(c) else c)

    def rr(self, x0, y0, x1, y1, r, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if in_rr(x, y, x0, y0, x1, y1, r):
                    self.set(x, y, c(x, y) if callable(c) else c)

    def stamp(self, rows, x, y, colors, flip=False):
        if flip:
            rows = [row[::-1] for row in rows[::-1]]
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != ".":
                    self.set(x + dx, y + dy, colors[ch] if isinstance(colors, dict) else colors)

    def over(self, other):
        self.im.alpha_composite(other.im if isinstance(other, Layer) else other)
        self.px = self.im.load()

    def up(self):
        return self.im.resize((W * S, H * S), Image.NEAREST)


def pip_colors(suit):
    t = THEME[suit]
    return {"x": t["ink"], "h": t["hi"], "s": t["sh"]}


# ---------------------------------------------------------------- Papier und Zierrat je Symbol
def pattern(suit, x, y):
    """Blasses Muster im Papier."""
    if suit == "hearts":       # kleine Herzen, versetzt
        cx, cy = x % 10, y % 10
        if (y // 10) % 2:
            cx = (x + 5) % 10
        return (cx, cy) in ((0, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2))
    if suit == "diamonds":     # Rautengitter
        return (x + y) % 8 == 0 or (x - y) % 8 == 0
    if suit == "spades":       # Nadelstreifen
        return x % 4 == 1
    cx, cy = x % 8, y % 8      # Kreuz: kleine Vierpaesse
    if (y // 8) % 2:
        cx = (x + 4) % 8
    return (cx, cy) in ((1, 0), (0, 1), (2, 1), (1, 2))


def bracket_cells(suit):
    """Zierwinkel fuer die freie Ecke oben rechts als Liste (x, y, Farbschluessel).
    Die Ecke unten links entsteht durch Drehung. Die Ecken mit dem Index bleiben frei."""
    cells = []
    top = range(18, 47)        # x entlang der Oberkante
    side = range(5, 46)        # y entlang der rechten Kante
    if suit == "hearts":       # Spitzenborte: gepunktete Linie mit Boegen
        for x in top:
            if x % 2 == 0:
                cells.append((x, 3, "line"))
            if x % 4 == 0:
                cells.append((x, 4, "hi"))
        for y in side:
            if y % 2 == 1:
                cells.append((48, y, "line"))
            if y % 4 == 1:
                cells.append((47, y, "hi"))
    elif suit == "diamonds":   # Art déco: Doppellinie mit Stufen
        for x in top:
            cells.append((x, 3, "line"))
            if x >= 26:
                cells.append((x, 5, "accent"))
        for y in side:
            cells.append((48, y, "line"))
            if y <= 36:
                cells.append((46, y, "accent"))
        for i in range(3):     # Stufen an den Enden
            cells += [(18 + i, 4 + i, "line"), (47 - i, 45 - i, "line")]
    elif suit == "spades":     # Stahlkante mit Nieten
        for x in top:
            cells.append((x, 3, "line"))
            cells.append((x, 4, "accent"))
            if x % 6 == 2:
                cells.append((x, 3, "ink"))
        for y in side:
            cells.append((48, y, "line"))
            cells.append((47, y, "accent"))
            if y % 6 == 2:
                cells.append((48, y, "ink"))
    else:                      # Kreuz: Dornenranke
        for x in top:
            cells.append((x, 3, "line"))
            if x % 5 == 0:
                cells += [(x, 4, "line"), (x - 1, 5, "line")]
            if x % 5 == 2:
                cells.append((x, 4, "accent"))
        for y in side:
            cells.append((48, y, "line"))
            if y % 5 == 0:
                cells += [(47, y, "line"), (46, y + 1, "line")]
            if y % 5 == 2:
                cells.append((47, y, "accent"))
    return cells


def base(suit, ornaments=True):
    """Leere Karte eines Symbols: Rand, Papier, Muster und Zierwinkel."""
    t = THEME[suit]
    layer = Layer(t["rim"])
    layer.rr(1, 1, W - 2, H - 2, 4, t["line"])
    layer.rr(2, 2, W - 3, H - 3, 3, lambda x, y: t["tint"] if 4 <= x <= W - 5 and 4 <= y <= H - 5 and pattern(suit, x, y) else t["paper"])
    if ornaments:
        deco = Layer()
        for x, y, key in bracket_cells(suit):
            deco.set(x, y, t[key])
        deco.stamp(MINI[suit], 41, 6, t["line"])
        layer.over(deco)
        layer.over(deco.im.rotate(180))
    return layer


def index(suit, rank, backing=False):
    """Eckindex (Wert ueber Symbol) oben links und gedreht unten rechts."""
    t = THEME[suit]
    one = Layer()
    if backing:  # Papierlasche, damit der Index ueber dem Bildfenster lesbar bleibt
        one.rect(2, 2, 16, 26, t["ink"])
        one.rect(2, 2, 15, 25, t["paper"])
        one.set(16, 26, (0, 0, 0, 0))
        one.set(15, 25, t["ink"])
    glyph = GLYPHS[rank]
    one.stamp(glyph, 3 + (11 - len(glyph[0])) // 2, 4, t["ink"])
    one.stamp(PIPS11[suit], 3, 13, pip_colors(suit))
    both = Layer()
    both.over(one)
    if backing:
        small = Layer()
        small.rect(2, 2, 15, 15, t["ink"])
        small.rect(2, 2, 14, 14, t["paper"])
        small.set(15, 15, (0, 0, 0, 0))
        small.set(14, 14, t["ink"])
        small.stamp(PIPS11[suit], 3, 3, pip_colors(suit))
        both.over(small.im.rotate(180))
    else:
        both.over(one.im.rotate(180))
    return both


COL_L, COL_R = 16, 27
ROWS3 = (9, 32, 55)
ROWS4 = (9, 24, 40, 55)
LAYOUT = {
    "7": [(COL_L, 9), (COL_R, 9), (21, 20), (COL_L, 32), (COL_R, 32), (COL_L, 55, R), (COL_R, 55, R)],
    "8": [(COL_L, 9), (COL_R, 9), (21, 20), (COL_L, 32), (COL_R, 32), (22, 44, R), (COL_L, 55, R), (COL_R, 55, R)],
    "9": [(COL_L, 9), (COL_R, 9), (COL_L, 24), (COL_R, 24), (COL_L, 40, R), (COL_R, 40, R), (COL_L, 55, R), (COL_R, 55, R), (21, 32)],
    "10": [(COL_L, 9), (COL_R, 9), (COL_L, 24), (COL_R, 24), (COL_L, 40, R), (COL_R, 40, R), (COL_L, 55, R), (COL_R, 55, R), (21, 16), (22, 48, R)],
}


def dither(t, x, y):
    return t * 16 > BAYER[y % 4][x % 4] + 0.5


def sky(suit, x, y):
    """Hintergrund im Fenster der Hoffiguren."""
    t = THEME[suit]
    top, bottom = t["sky"]
    x0, y0, x1, y1 = WINDOW
    f = (y - y0) / (y1 - y0)
    if suit == "hearts":       # Abendrot mit schwebenden Herzchen
        cx, cy = (x + (y // 9) * 5) % 12, y % 9
        if (cx, cy) in ((0, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2)) and y < 40:
            return t["motif"]
    elif suit == "diamonds":   # Strahlenkranz
        dx, dy = x - 25.5, y - 50
        import math
        if int((math.atan2(dy, dx) + math.pi) / (math.pi / 9)) % 2 == 0:
            return t["motif"] if dither(0.45, x, y) else top
    elif suit == "spades":     # Bannerstreifen
        if (x - x0) % 10 in (4, 5):
            return t["motif"] if y < 30 else top
    else:                      # Mond im Dunst
        dx, dy = x - 37, y - 16
        if dx * dx + dy * dy <= 30 and (dx + 2) ** 2 + (dy + 1) ** 2 > 22:
            return t["motif"]
    return bottom if dither(f, x, y) else top


def paste_art(card, name, box, anchor):
    """Setzt ein vorbereitetes Bild (echte Pixel) auf die vergroesserte Karte. anchor: 'bottom' oder 'center'."""
    path = ART / (name + ".png")
    if not path.exists():
        print("  fehlt:", path.name)
        return
    art = Image.open(path).convert("RGBA")
    x0, y0, x1, y1 = box
    if anchor == "bottom":
        left = (x0 + x1 - art.width) // 2
        top = y1 - art.height
    else:
        left = (x0 + x1 - art.width) // 2
        top = (y0 + y1 - art.height) // 2
    clip = Image.new("RGBA", card.size, (0, 0, 0, 0))
    clip.paste(art, (left, top))
    mask = Image.new("L", card.size, 0)
    mask.paste(255, (x0, y0, x1, y1))
    clip.putalpha(Image.composite(clip.getchannel("A"), Image.new("L", card.size, 0), mask))
    card.alpha_composite(clip)


def face(suit, rank):
    t = THEME[suit]
    if rank in LAYOUT:
        layer = base(suit)
        for spot in LAYOUT[rank]:
            if spot[0] not in (COL_L, COL_R) and rank in ("9", "10"):   # mittlere Symbole heben sich mit einem Papierrand ab
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    layer.stamp(PIPS9[suit], spot[0] + dx, spot[1] + dy, t["paper"], flip=len(spot) > 2)
            layer.stamp(PIPS9[suit], spot[0], spot[1], pip_colors(suit), flip=len(spot) > 2)
        layer.over(index(suit, rank))
        return layer.up()
    if rank == "A":
        layer = base(suit)
        card = layer.up()
        paste_art(card, "ace-" + suit, (0, 0, W * S, H * S), "center")
        card.alpha_composite(index(suit, rank).up())
        return card
    # Hoffigur: Fenster mit eigenem Himmel, Figur, darueber Rahmen und Indexlaschen
    x0, y0, x1, y1 = WINDOW
    layer = base(suit, ornaments=False)
    layer.rr(x0 - 2, y0 - 2, x1 + 2, y1 + 2, 3, t["ink"])
    layer.rr(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 2, t["accent"])
    layer.rect(x0, y0, x1, y1, lambda x, y: sky(suit, x, y))
    card = layer.up()
    paste_art(card, suit + "-" + rank, (x0 * S, y0 * S, (x1 + 1) * S, (y1 + 1) * S), "bottom")
    card.alpha_composite(index(suit, rank, backing=True).up())
    return card


# ---------------------------------------------------------------- Rahmen der Spezialkarten
HEAD = (3, 13)   # Kopfband (Zeilen), darin steht der Kartenname
FOOT = (58, 69)  # Fussband, darauf sitzt das Schild mit dem Schlagwort
HOUSE = dict(rim=col("#fffaf0"), paper=col("#f6ead0"), tint=col("#ead9b4"), line=col("#b8842a"), ink=col("#7a1f2b"),
             hi=col("#d9a441"), sh=col("#4a0f18"), deep=col("#2e0910"), accent=col("#d9a441"))


def edge(suit, x, depth):
    """Zierkante unter dem Kopfband (depth 0 = direkt am Band, 1 = eine Zeile weiter)."""
    if suit == "hearts":       # Boegen
        return (x % 4 != 3) if depth == 0 else (x % 4 == 1)
    if suit == "diamonds":     # feine Zacken
        return True if depth == 0 else (x % 2 == 0)
    if suit == "spades":       # gerade Doppellinie
        return depth == 1
    if suit == "clubs":        # Spitzboegen
        return (x % 6 != 0) if depth == 0 else (x % 6 == 3)
    return False


def frame_single(suit, t=None, watermark=True):
    t = t or THEME[suit]
    layer = Layer(t["deep"])
    layer.rr(1, 1, W - 2, H - 2, 4, t["ink"])
    layer.rr(3, 3, W - 4, H - 4, 2, t["paper"])
    if watermark and suit in PIPS11:   # grosses blasses Symbol hinter dem Bild
        mark = Layer()
        mark.stamp(PIPS11[suit], 0, 0, t["tint"])
        big = mark.im.crop((0, 0, 11, 11)).resize((33, 33), Image.NEAREST)
        layer.im.alpha_composite(big, (10, 19))
        layer.px = layer.im.load()
    for y in range(HEAD[0], HEAD[1] + 1):
        for x in range(3, W - 3):
            layer.set(x, y, t["ink"])
    for y in range(FOOT[0], FOOT[1] + 1):
        for x in range(3, W - 3):
            if in_rr(x, y, 3, 3, W - 4, H - 4, 2):
                layer.set(x, y, t["ink"])
    for x in range(3, W - 3):
        layer.set(x, HEAD[1], t["sh"])
        layer.set(x, FOOT[0], t["sh"])
        for depth in (0, 1):
            if edge(suit, x, depth):
                c = t["ink"] if suit != "spades" else t["line"]
                layer.set(x, HEAD[1] + 1 + depth, c)
                layer.set(x, FOOT[0] - 1 - depth, c)
    # schmale Glanzlinie im Rand
    for y in range(H):
        for x in range(W):
            if in_rr(x, y, 2, 2, W - 3, H - 3, 3) and not in_rr(x, y, 3, 3, W - 4, H - 4, 2):
                layer.set(x, y, t["hi"] if (x + y) % 2 == 0 or suit in ("spades", "diamonds", None) else t["ink"])
    return layer


def frame_pair(a, b):
    """Farbgebunden: zwei Symbolwelten, schraeg geteilt."""
    left, right = frame_single(a), frame_single(b)
    out = Layer()
    gold = col("#e2b23c")
    for y in range(H):
        for x in range(W):
            side = (x - 25.5) + (y - 36) * 0.3
            out.px[x, y] = left.px[x, y] if side < 0 else right.px[x, y]
            if HEAD[1] < y < FOOT[0] and 3 <= x <= W - 4 and -1 <= side < 0:
                out.px[x, y] = gold
    return out


def frame_wild():
    """Frei: schwarzer Lack mit Gold, alle vier Farben als Einlage."""
    gold, pale, lac, glow = col("#d9a441"), col("#ffe08a"), col("#231a16"), col("#3d2e25")
    layer = Layer(col("#0d0907"))
    layer.rr(1, 1, W - 2, H - 2, 4, gold)
    layer.rr(3, 3, W - 4, H - 4, 2, lambda x, y: glow if dither(max(0.0, 1 - (((x - 25.5) / 24) ** 2 + ((y - 35) / 26) ** 2)) * 0.9, x, y) else lac)
    for y in range(H):
        for x in range(W):
            if in_rr(x, y, 2, 2, W - 3, H - 3, 3) and not in_rr(x, y, 3, 3, W - 4, H - 4, 2):
                layer.set(x, y, pale)
    for y in range(HEAD[0], HEAD[1] + 1):
        for x in range(3, W - 3):
            layer.set(x, y, gold if y > HEAD[0] else pale)
    for y in range(FOOT[0], FOOT[1] + 1):
        for x in range(3, W - 3):
            if in_rr(x, y, 3, 3, W - 4, H - 4, 2):
                layer.set(x, y, gold)
    inks = [THEME[s]["ink"] if s != "clubs" else THEME[s]["hi"] for s in SUITS]
    for x in range(3, W - 3):   # Vierfarb-Einlage unter dem Kopfband und ueber dem Fussband
        c = inks[min(3, (x - 3) * 4 // (W - 6))]
        for y in (HEAD[1] + 1, HEAD[1] + 2, FOOT[0] - 1, FOOT[0] - 2):
            layer.set(x, y, c)
        layer.set(x, HEAD[1], col("#8a611c"))
        layer.set(x, FOOT[0], col("#8a611c"))
    return layer


def frame(kind):
    if kind in THEME:
        return frame_single(kind).up()
    if kind == "red":
        return frame_pair("hearts", "diamonds").up()
    if kind == "black":
        return frame_pair("spades", "clubs").up()
    if kind == "wild":
        return frame_wild().up()
    return frame_single(None, HOUSE, watermark=False).up()


# ---------------------------------------------------------------- Figurenboegen einlesen
def key(im):
    """Chroma-Gruen wird transparent; nur der Saum wird entfaerbt, damit Moosgruen in den Figuren bleibt."""
    im = im.convert("RGBA")
    px = im.load()
    width, height = im.size
    for y in range(height):
        for x in range(width):
            r, g, b, _ = px[x, y]
            if g > 150 and g > 1.6 * max(r, b):
                px[x, y] = (0, 0, 0, 0)
    alpha = im.getchannel("A").load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if not a or g <= max(r, b):
                continue
            near = False
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and alpha[nx, ny] == 0:
                        near = True
                        break
                if near:
                    break
            if near:
                px[x, y] = (r, max(r, b), b, 255)
    return im


def spans(counts, minimum=3, gap=8, least=60):
    out, start, empty = [], None, 0
    for i, value in enumerate(counts):
        if value > minimum:
            if start is None:
                start = i
            empty = 0
        elif start is not None:
            empty += 1
            if empty >= gap:
                out.append((start, i - empty + 1))
                start, empty = None, 0
    if start is not None:
        out.append((start, len(counts)))
    return [s for s in out if s[1] - s[0] >= least]


def projection(im, axis):
    alpha = im.getchannel("A")
    width, height = im.size
    data = alpha.tobytes()
    if axis == "x":
        return [sum(1 for y in range(height) if data[y * width + x]) for x in range(width)]
    return [width - data[y * width:(y + 1) * width].count(0) for y in range(height)]


def fit(im, box):
    """Schneidet auf den Inhalt zu, verkleinert in die Box und macht die Kanten wieder hart."""
    im = im.crop(im.getbbox())
    scale = min(box[0] / im.width, box[1] / im.height)
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    im = im.resize(size, Image.LANCZOS)
    alpha = im.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    im.putalpha(alpha)
    return im


def save_art(im, name):
    ART.mkdir(parents=True, exist_ok=True)
    quant = im.quantize(colors=64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    quant.save(ART / (name + ".png"), optimize=True)
    print("  ", name, im.size)


def import_art(folder):
    folder = Path(folder)
    for suit in SUITS:
        source = folder / suit / (suit + ".png")
        if not source.exists():
            print("  fehlt:", source)
            continue
        im = key(Image.open(source))
        cols = spans(projection(im, "x"))
        if len(cols) != 3:
            print("  drei Figuren nicht erkannt, teile gleichmaessig:", suit, cols)
            cols = [(im.width * i // 3, im.width * (i + 1) // 3) for i in range(3)]
        for rank, (left, right) in zip(("J", "Q", "K"), cols):
            save_art(fit(im.crop((left, 0, right, im.height)), COURT_BOX), suit + "-" + rank)
    source = folder / "aces" / "aces.png"
    if source.exists():
        im = key(Image.open(source))
        rows = spans(projection(im, "y"))
        if len(rows) != 2:
            rows = [(0, im.height // 2), (im.height // 2, im.height)]
        order = iter(SUITS)
        for top, bottom in rows:
            band = im.crop((0, top, im.width, bottom))
            cols = spans(projection(band, "x"), gap=30)
            if len(cols) != 2:
                cols = [(0, im.width // 2), (im.width // 2, im.width)]
            for left, right in cols:
                save_art(fit(band.crop((left, 0, right, band.height)), ACE_BOX), "ace-" + next(order))


# ---------------------------------------------------------------- Atlas und Vorschau
def atlas():
    cw, ch = W * S, H * S
    sheet = Image.new("RGBA", (cw * 8, ch * 5), (0, 0, 0, 255))
    for row, suit in enumerate(SUITS):
        for column, rank in enumerate(RANKS):
            sheet.paste(face(suit, rank), (column * cw, row * ch))
    for column, kind in enumerate(FRAMES):
        sheet.paste(frame(kind), (column * cw, 4 * ch))
    return sheet


def preview(sheet, target):
    """Spezialkarten so, wie das Spiel sie zusammensetzt – zum Beurteilen der Rahmen."""
    cw, ch = W * S, H * S
    specials = ["stillstand", "addieren", "spion", "fluch", "hodl", "zytokinese", "tausch", "bonusgeld"]
    font = ImageFont.truetype(str(WEB / "assets" / "fonts" / "zuendung_pixel.ttf"), 28)
    out = Image.new("RGBA", (cw * 8, ch * 6), (30, 60, 48, 255))
    out.paste(sheet, (0, 0))
    for column, kind in enumerate(FRAMES):
        card = sheet.crop((column * cw, 4 * ch, (column + 1) * cw, 5 * ch))
        art = Image.open(WEB / "assets" / "special" / (specials[column] + ".png")).convert("RGBA").resize((168, 168), Image.NEAREST)
        card.alpha_composite(art, ((cw - 168) // 2, 56))
        draw = ImageDraw.Draw(card)
        draw.fontmode = "1"
        name = specials[column].upper()[:9]
        width = draw.textlength(name, font=font)
        draw.text(((cw - width) // 2, 20), name, font=font, fill=(40, 26, 8, 255) if kind == "wild" else (255, 246, 224, 255))
        draw.rounded_rectangle((20, 238, cw - 20, 272), 8, fill=(31, 111, 102, 255))
        out.paste(card, (column * cw, 5 * ch))
    out.convert("RGB").save(target)
    print("Vorschau:", target)


def main(argv):
    if "--import" in argv:
        import_art(argv[argv.index("--import") + 1])
    sheet = atlas()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    quant = sheet.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    quant.save(OUT, optimize=True)
    print("Atlas:", OUT, sheet.size, OUT.stat().st_size // 1024, "KB")
    if "--preview" in argv:
        preview(sheet, argv[argv.index("--preview") + 1])


if __name__ == "__main__":
    main(sys.argv[1:])
