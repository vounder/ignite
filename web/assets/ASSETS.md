# Assets der Browser-Version

Stand: 11.11.2026

## Aus dem Projekt übernommen

Quelle ist jeweils `godot/game/Assets/`; aufbereitet mit
`web/tools/prepare_assets.py`.

| Ziel | Quelle | Aufbereitung |
|---|---|---|
| `special/*.png` | `Cards/Special/*_v2.png` | auf 128×128 verkleinert |
| `manfred/manfred_0–3.png` | `Characters/Manfred/` | auf 256×256 verkleinert, harte Alphakante |
| `logo.png` | `UI/logo.png` | zugeschnitten, 640 px breit |
| `audio/*.wav` | `Audio/*.wav` | 24 kHz, Mono, 16 Bit |

## Neu generiert

Die acht Gegnerporträts (`enemies/`) und 17 Trinket-Icons (`trinkets/`) wurden
am 11.11.2026 mit der Bildgenerierung von OpenAI über die Codex-CLI speziell
für Zündung erzeugt. Als Stilreferenz dienten vorhandene Projektgrafiken
(Manfred, Spezialkarten). Die Bilder entstanden auf Chroma-Grün und wurden mit
`prepare_assets.py --generated` freigestellt, quadratisch zugeschnitten und auf
192×192 (Porträts) bzw. 96×96 (Trinkets) verkleinert.

### Prompt Gegnerporträts

```text
STYLE (apply to every image): chunky 16-bit pixel art with large clearly visible square pixels (roughly 64x64 logical pixels upscaled), thick dark outlines, limited palette of dark walnut brown, bottle green, aged ivory, burgundy red, brass gold and ember orange, moody 1930s backroom casino feeling. The attached reference images show the exact art style to match. Subject centered and filling about 85% of a square canvas. Background: one flat pure chroma-key green (#00FF00) with nothing else on it. No text, no letters, no numbers, no border, no UI, no gradients, no cast shadows on the background, and do not use green anywhere on the subject itself unless stated.

Each image is a head-and-shoulders bust portrait of a card-game opponent, facing the viewer:
1. ember-croupier.png - calm professional casino croupier wearing a dark teal dealer eyeshade visor, black waistcoat, ivory shirt, red bow tie, thin mustache, faint ember-orange rim light.
2. curse-dealer.png - sinister card dealer in a dark purple hooded cloak, pale sickly skin, glowing yellow eyes under the hood, thin wisps of dark smoke.
3. card-counter.png - thin nervous accountant-like card counter with round glasses, slicked-back hair, grey-blue suit, gold tie, a pencil behind the ear.
4. double-igniter.png - wild-eyed pyromaniac gambler with brass goggles pushed up on the forehead, soot-smudged face, singed spiky hair, orange shirt, two lit matches held up.
5. boss-shark.png - heavy-set smug card shark boss with a black bowler hat, cigar, dark navy pinstripe suit, blue tie, one gold tooth in a grin.
6. boss-smoke.png - elegant older femme fatale with silver-white 1930s wavy hair, long cigarette holder with curling grey smoke, burgundy dress, pearl necklace, knowing smile.
7. boss-house.png - imposing casino owner with a black top hat, monocle, white mustache, black tailcoat, gold watch chain, stern glare, ember-red rim light.
```

Der Falschspieler (`cheater.png`) wurde mit demselben Stil-Prompt einzeln
nachgeneriert: „sly card cheat facing the viewer: red fedora with a black band,
thin pencil mustache, crooked smirk, one raised eyebrow, burgundy vest over an
ivory shirt, an ace playing card half hidden in his raised hand“.

### Prompt Trinket-Icons

```text
STYLE (apply to every image): chunky 16-bit pixel art with large clearly visible square pixels (roughly 64x64 logical pixels upscaled), thick dark outlines, limited palette of dark walnut brown, bottle green, aged ivory, burgundy red, brass gold and ember orange, moody 1930s backroom casino feeling. The attached reference images show the exact art style to match. Subject centered and filling about 85% of a square canvas. Background: one flat pure chroma-key green (#00FF00) with nothing else on it. No text, no letters, no numbers, no border, no UI, no gradients, no cast shadows on the background, and do not use green anywhere on the subject itself unless stated.

Each image is a single small collectible object icon (a lucky charm / trinket), simple and readable at 48x48:
1. lucky-chip.png - a gold poker chip embossed with a four-leaf clover (the clover may be dark teal).
2. ashtray.png - a brass ashtray with a smoking cigarette butt.
3. false-bottom.png - a small open wooden box showing a hidden false-bottom compartment with gold coins.
4. fuse.png - a coiled fuse cord with a bright burning spark at its end.
5. ledger.png - a leather-bound cash ledger book with a gold coin on top.
6. brass-knuckles.png - a pair of brass knuckles.
7. pocket-watch.png - a brass pocket watch with a short chain.
8. loaded-die.png - an ivory die with glowing ember-orange pips.
9. velvet-glove.png - a burgundy velvet glove.
10. heartblood.png - a glossy red heart (card suit shape) with a single drop falling from it.
11. rollercoaster.png - a small brass roller-coaster loop track shaped like a figure eight with a tiny red cart.
12. slow-burner.png - a glowing charcoal ember with a small steady flame.
13. black-book.png - a small black notebook with a brass eye emblem on the cover.
14. smoke-mirror.png - an ornate brass hand mirror with grey smoke swirling in the glass.
15. hot-wire.png - a red-hot glowing coiled wire throwing sparks.
16. ace-sleeve.png - a dark suit jacket sleeve cuff with an ivory playing card peeking out of it.
17. golden-match.png - a golden matchstick with a radiant flame.
```

## Im Projekt erzeugt

- `fonts/zuendung_pixel.ttf` – eigener Pixel-Font, aus den Bitmap-Definitionen
  in `web/tools/make_font.py` gebaut.
- Kartenflächen, Kartenrücken, Farbsymbole, Streichholz-, Münz- und
  Flammen-Symbole sowie der Hintergrund entstehen zur Laufzeit aus CSS, kleinen
  Bitmaps (`js/cards.js`) und einem WebGL-Shader (`js/bg.js`).
- Alle Soundeffekte werden zur Laufzeit synthetisiert (`js/audio.js`).
