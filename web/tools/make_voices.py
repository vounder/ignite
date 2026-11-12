"""Stimmen für Zündung: kurze Rufe aus Piper (Stimmen mit CC0-Datensatz: Thorsten, Thorsten emotional, Kerstin).
/data/tools/piper-venv/bin/python gen.py  ->  raw/<voice>-<mood><n>.wav, trim/..., sprite voices.mp3 + voices.json"""
import json, subprocess, sys, wave
from pathlib import Path
ROOT = Path('/data/ignite/voice'); PY = '/data/tools/piper-venv/bin/python'
EMO = {'amused': 0, 'angry': 1, 'disgusted': 2, 'drunk': 3, 'neutral': 4, 'sleepy': 5, 'surprised': 6, 'whisper': 7}
WORDS = {
    'greet': ['Na?', 'So, so.', 'Hallo.', 'Guten Abend.', 'Aha.', 'Sieh an.', 'Na dann.'],
    'smug': ['Ha!', 'Tja.', 'Zack!', 'Bitte sehr.', 'Bumm!', 'Schön, oder?', 'Erwischt!', 'Da!'],
    'gloat': ['Hehe.', 'Gleich.', 'Fast fertig.', 'Na, na, na.', 'Wird eng, was?', 'Schon müde?'],
    'angry': ['Mist!', 'Autsch!', 'Hey!', 'Na warte!', 'Frechheit!', 'Ach komm!', 'Grr.', 'Unverschämt!'],
    'nervous': ['Oh, oh.', 'Moment.', 'Langsam!', 'Ähm.', 'Nicht gut.', 'Halt!'],
    'shocked': ['Was?', 'Oha!', 'Nein!', 'Wie bitte?', 'Huch!', 'Unmöglich!'],
    'win': ['Hahaha!', 'Gewonnen!', 'Danke schön.', "War's das?", 'Tschüss!'],
    'lose': ['Verdammt.', 'Pah.', 'Glück gehabt.', 'Na gut.', 'Ach, Mist.', 'Revanche!'],
}
# Thorsten wechselt je Ruf die Gefühlslage, damit dieselbe Stimmung nicht immer gleich klingt.
MOOD_EMO = {'greet': ['neutral', 'amused', 'sleepy'], 'smug': ['amused', 'neutral', 'surprised'], 'gloat': ['amused', 'whisper', 'neutral'],
            'angry': ['angry', 'disgusted', 'surprised'], 'nervous': ['surprised', 'neutral', 'whisper'], 'shocked': ['surprised', 'angry'],
            'win': ['amused', 'neutral'], 'lose': ['disgusted', 'angry', 'sleepy']}
# Grundstimmen: m = Thorsten (wechselnde Gefühlslage), d = lallend, w = flüsternd, f = Kerstin etwas angehoben, g = Kerstin hell.
# pitch: Halbtöne, um die die Aufnahme ohne Tempoänderung angehoben wird (Kerstin liegt mit rund 180 Hz sehr tief).
VOICES = {
    'm': (lambda mood, n: ('de_DE-thorsten_emotional-medium', EMO[MOOD_EMO[mood][n % len(MOOD_EMO[mood])]]), 0),
    'd': (lambda mood, n: ('de_DE-thorsten_emotional-medium', EMO['drunk']), 0),
    'w': (lambda mood, n: ('de_DE-thorsten_emotional-medium', EMO['whisper']), 0),
    'f': (lambda mood, n: ('de_DE-kerstin-low', 0), 2.5),
    'g': (lambda mood, n: ('de_DE-kerstin-low', 0), 5),
}
clips = []
for voice, (pick, pitch) in VOICES.items():
    for mood, words in WORDS.items():
        for n, text in enumerate(words):
            name = f'{voice}-{mood}{n}'
            model, speaker = pick(mood, n)
            raw = ROOT / 'raw' / (f'{model}-{speaker}-{mood}{n}.wav'); out = ROOT / 'trim' / (name + '.wav')
            if not raw.exists():
                subprocess.run([PY, '-m', 'piper', '-m', str(ROOT / 'models' / (model + '.onnx')), '-s', str(speaker), '-f', str(raw), '--sentence-silence', '0'],
                               input=text.encode(), check=True, capture_output=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af',
                            (f'rubberband=pitch={2 ** (pitch / 12):.4f}:formant=preserved,' if pitch else '') + 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,'
                            'loudnorm=I=-18:TP=-2:LRA=7,aresample=22050', '-ac', '1', str(out)], check=True)
            with wave.open(str(out)) as w: dur = w.getnframes() / w.getframerate()
            clips.append((name, voice, mood, text, round(dur, 3)))
            print(name, text, dur)
# Sprite: alle Rufe hintereinander, je 0,15 s Stille dazwischen
GAP = 0.15; t = 0.1; index = {}; parts = ['anullsrc=r=22050:cl=mono:d=0.1[s0]']; ins = []; labels = ['[s0]']
for i, (name, voice, mood, text, dur) in enumerate(clips):
    ins += ['-i', str(ROOT / 'trim' / (name + '.wav'))]
    parts.append(f'[{i}:a]apad=pad_dur={GAP}[c{i}]'); labels.append(f'[c{i}]')
    index.setdefault(voice, {}).setdefault(mood, []).append([round(t, 3), dur])
    t += dur + GAP
flt = ';'.join(parts) + ';' + ''.join(labels) + f'concat=n={len(labels)}:v=0:a=1[out]'
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', flt, '-map', '[out]', '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', str(ROOT / 'voices.mp3')], check=True)
(ROOT / 'voices.json').write_text(json.dumps(index, separators=(',', ':')))
print('clips', len(clips), 'total', round(t, 1), 's')
