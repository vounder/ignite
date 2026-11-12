"""Stimmen für Zündung aus dem „Super Dialogue Audio Pack v1" von Dillon Becker (CC BY 4.0, dillonbecker.com):
gespielte, wortlose oder sprachneutrale Laute von fünf Sprechern. Schneidet, pegelt und packt sie in ein Stück.
/data/tools/piper-venv/bin/python gen2.py  ->  voices.mp3 + voices.json   (Paket entpackt unter packs/sdap/)"""
import json, subprocess, wave
from pathlib import Path
ROOT = Path('/data/ignite/voice'); PACK = ROOT / 'packs/sdap/Super Dialogue Audio Pack v1/Step 2 - Audio Files'
ACTORS = {'a': ('Male', 'Alex Brodie', 'alex'), 'b': ('Male', 'Ian Lampert', 'ian'), 'c': ('Male', 'Sean Lenhart', 'sean'),
          'f': ('Female', 'Karen Cenon', 'karen'), 'g': ('Female', 'Meghan Christian', 'meghan')}
DIRS = {'greeting': '3 - Greeting', 'confirmation': '2 - Confirmation', 'refusal': '5 - Refusal', 'misc': '6 - Miscellaneous', 'farewell': '4 - Farewell',
        'damage': '7 - Damage', 'death': '8 - Death', 'grunting': '9 - Grunting', 'shouting': '10 - Shouting'}
# Stimmung -> (Kategorie, Nummer). Nur Laute und Ein-Silben-Rufe, die in jeder Sprache funktionieren.
MOODS = {
    'greet': [('greeting', 3), ('greeting', 5), ('greeting', 9), ('greeting', 2), ('misc', 13)],            # Hey, Hm?, Yo, Hi, Räuspern
    'smug': [('misc', 12), ('misc', 4), ('confirmation', 1), ('grunting', 1), ('shouting', 1)],            # Lachen, Woo!, Yeah, …
    'gloat': [('misc', 12), ('misc', 2), ('farewell', 7), ('grunting', 2)],                                # Lachen, Hmm…, Ta-ta
    'angry': [('damage', 1), ('damage', 2), ('damage', 3), ('damage', 4), ('grunting', 3), ('grunting', 4), ('refusal', 1), ('refusal', 8), ('shouting', 2)],
    'nervous': [('misc', 3), ('misc', 19), ('misc', 17), ('misc', 2), ('damage', 5)],                      # Huh?, Keuchen, Seufzen
    'shocked': [('misc', 19), ('misc', 10), ('shouting', 3), ('shouting', 4), ('damage', 6)],              # Keuchen, Wow!, Schreie
    'win': [('misc', 12), ('misc', 4), ('confirmation', 1), ('shouting', 5)],
    'lose': [('death', 1), ('death', 2), ('death', 3), ('misc', 17), ('misc', 16), ('refusal', 1)],        # …, Seufzen, Weinen, No
}
MAXLEN = 1.7
(ROOT / 'trim2').mkdir(exist_ok=True)
clips = []; skipped = []
for voice, (sex, folder, short) in ACTORS.items():
    for mood, picks in MOODS.items():
        seen = set()
        for cat, num in picks:
            src = PACK / DIRS[cat] / sex / folder / f'{cat if cat != "misc" else "miscellaneous"}_{num}_{short}.wav'
            if not src.exists():
                cands = list((PACK / DIRS[cat] / sex / folder).glob(f'*_{num}_*.wav'))
                if not cands: skipped.append(str(src.name)); continue
                src = cands[0]
            out = ROOT / 'trim2' / f'{voice}-{mood}-{cat}{num}.wav'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-af',
                            'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,areverse,'
                            f'atrim=0:{MAXLEN},afade=t=out:st={MAXLEN - 0.25}:d=0.25,loudnorm=I=-18:TP=-2:LRA=7,aresample=22050', '-ac', '1', str(out)], check=True)
            with wave.open(str(out)) as w: dur = w.getnframes() / w.getframerate()
            if dur < 0.12: skipped.append(out.name + ' (leer)'); continue
            clips.append((out, voice, mood, round(dur, 3)))
GAP = 0.15; t = 0.1; index = {}; parts = ['anullsrc=r=22050:cl=mono:d=0.1[s0]']; ins = []; labels = ['[s0]']
for i, (path, voice, mood, dur) in enumerate(clips):
    ins += ['-i', str(path)]
    parts.append(f'[{i}:a]apad=pad_dur={GAP}[c{i}]'); labels.append(f'[c{i}]')
    index.setdefault(voice, {}).setdefault(mood, []).append([round(t, 3), dur])
    t += dur + GAP
(ROOT / 'filter2.txt').write_text(';'.join(parts) + ';' + ''.join(labels) + f'concat=n={len(labels)}:v=0:a=1[out]')
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex_script', str(ROOT / 'filter2.txt'), '-map', '[out]', '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', str(ROOT / 'voices.mp3')], check=True)
(ROOT / 'voices.json').write_text(json.dumps(index, separators=(',', ':')))
print('clips', len(clips), 'total', round(t, 1), 's', 'skipped', skipped)
for v in index: print(v, {m: len(c) for m, c in index[v].items()})
