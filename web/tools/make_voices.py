"""Stimmen für Zündung: kurze Rufe aus Piper (Stimmen mit CC0-Datensatz: Thorsten, Thorsten emotional, Kerstin).
/data/tools/piper-venv/bin/python gen.py  ->  raw/<voice>-<mood><n>.wav, trim/..., sprite voices.mp3 + voices.json"""
import json, subprocess, sys, wave
from pathlib import Path
ROOT = Path('/data/ignite/voice'); PY = '/data/tools/piper-venv/bin/python'
EMO = {'amused': 0, 'angry': 1, 'disgusted': 2, 'drunk': 3, 'neutral': 4, 'sleepy': 5, 'surprised': 6, 'whisper': 7}
WORDS = {
    'greet': ['Na?', 'So, so.', 'Hallo.'],
    'smug': ['Ha!', 'Tja.', 'Zack!', 'Bitte sehr.'],
    'angry': ['Mist!', 'Autsch!', 'Hey!', 'Na warte!'],
    'shocked': ['Was?', 'Oha!', 'Nein!'],
    'win': ['Hahaha!', 'Gewonnen!'],
    'lose': ['Verdammt.', 'Pah.'],
}
MOOD_EMO = {'greet': 'neutral', 'smug': 'amused', 'angry': 'angry', 'shocked': 'surprised', 'win': 'amused', 'lose': 'disgusted'}
VOICES = {  # Grundstimmen: m = Thorsten mit passender Gefühlslage, d = lallend, w = flüsternd, f = Kerstin
    'm': lambda mood: ('de_DE-thorsten_emotional-medium', EMO[MOOD_EMO[mood]]),
    'd': lambda mood: ('de_DE-thorsten_emotional-medium', EMO['drunk']),
    'w': lambda mood: ('de_DE-thorsten_emotional-medium', EMO['whisper']),
    'f': lambda mood: ('de_DE-kerstin-low', 0),
}
clips = []
for voice, pick in VOICES.items():
    for mood, words in WORDS.items():
        for n, text in enumerate(words):
            name = f'{voice}-{mood}{n}'
            model, speaker = pick(mood)
            raw = ROOT / 'raw' / (name + '.wav'); out = ROOT / 'trim' / (name + '.wav')
            if not raw.exists():
                subprocess.run([PY, '-m', 'piper', '-m', str(ROOT / 'models' / (model + '.onnx')), '-s', str(speaker), '-f', str(raw), '--sentence-silence', '0'],
                               input=text.encode(), check=True, capture_output=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af',
                            'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,'
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
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', flt, '-map', '[out]', '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '48k', str(ROOT / 'voices.mp3')], check=True)
(ROOT / 'voices.json').write_text(json.dumps(index, separators=(',', ':')))
print('clips', len(clips), 'total', round(t, 1), 's')
