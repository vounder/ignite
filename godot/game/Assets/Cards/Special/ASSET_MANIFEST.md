# Spezialkarten-Pixelart v1

Die elf Illustrationen wurden am 18.07.2026 mit OpenAI Image Generation speziell für
`Zündung` erzeugt. Sie enthalten bewusst keine Schrift; Titel und Regeltext werden in
Godot gerendert. Die Motive liegen als PNG mit Alpha vor und werden in einen eigenen
elfenbein-/burgunderfarbenen Kartenrahmen gesetzt.

Gemeinsame Art Direction:

> Centered game-card illustration, crisp 16-bit pixel art, readable at 48×48,
> elegant 1930s backroom casino mood, dark walnut, bottle-green felt, aged ivory,
> burgundy, brass gold and ember orange; no border, UI, gradients, glassmorphism,
> purple, logos, words or copyrighted game styling; isolated on chroma green.

| Datei | Motiv | Generierte Quelle |
|---|---|---|
| `stillstand_v1.png` | eingefrorene Messinguhr und gekreuzte Streichhölzer | `exec-2e77f1c5-04c7-4c75-bda3-ea382dc2348e.png` |
| `addieren_v1.png` | gestapelte Karten und Pluszeichen | `exec-45f65c46-6149-49ae-a861-b085aca487a8.png` |
| `spion_v1.png` | Auge im Schlüsselloch | `exec-ebf52227-bb1f-4e2e-98d0-c4d48ab00d81.png` |
| `fluch_v1.png` | gesprungener schwarzer Chip und Rauchrunen | `exec-8e6c41d7-f89a-4e7e-bd5c-0a4c292f1451.png` |
| `hodl_v1.png` | Samthandschuh schützt Goldchips | `exec-f0e2b89c-fa9e-48e2-9a65-ab7cdd444ec7.png` |
| `zytokinese_v1.png` | Karte spaltet sich in zwei | `exec-bd4227d0-8473-4366-818e-f4b62e5f9c1c.png` |
| `tausch_v1.png` | Karten und kreisende Pfeile | `exec-0a0ee061-cbaf-4aac-a634-679b4c90c719.png` |
| `bonusgeld_v1.png` | ein Chip wird zu zwei | `exec-1f9cef4f-52c2-4fac-968d-99ca1073a6c1.png` |
| `opfer_v1.png` | Karten verbrennen zu Chips | `exec-ae600a7c-c72a-43c9-94c5-5c91704c5cde.png` |
| `zocken_v1.png` | Würfel und drei verdeckte Karten | `exec-b348ec28-bbca-462d-9870-959fbf3a1a72.png` |
| `zytokinese_2_v1.png` | legendäre Karte spaltet sich in Specials | `exec-97654a92-3b1f-4bf6-b85e-7d18da0c4a74.png` |

Postprocessing: `remove_chroma_key.py --auto-key corners --soft-matte
--transparent-threshold 20 --opaque-threshold 75 --spill-cleanup`. Jede Datei
meldete eine technisch gültige Alphamaske mit vollständig transparentem Hintergrund.
Die ausgelieferten `_v2.png`-Varianten wurden anschließend auf die sichtbare
Alphamaske beschnitten, quadratisch gepolstert und mit Nearest-Neighbor auf 256×256
reduziert. `_v1.png` bleibt als verlustfreie, nachvollziehbare Zwischenstufe erhalten.
