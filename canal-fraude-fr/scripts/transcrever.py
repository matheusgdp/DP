# Plano B da voz: quando a ai33 não devolve a transcrição, o faster-whisper tira o tempo de cada
# palavra do narracao.mp3, no mesmo formato da ai33 ({"words": [{text, start, end, type}]}).
# Uso: python transcrever.py narracao.mp3 narracao-transcricao.json
import json
import subprocess
import sys

import numpy as np

from faster_whisper import WhisperModel

mp3, saida = sys.argv[1], sys.argv[2]
modelo = WhisperModel("small", device="cpu", compute_type="int8")
# o ffmpeg decodifica (o "av" do faster-whisper às vezes não bate de versão)
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
segs, _ = modelo.transcribe(audio, language="fr", word_timestamps=True, vad_filter=False)
palavras = [{"text": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "type": "word"} for s in segs for w in s.words]
with open(saida, "w", encoding="utf-8") as f:
    json.dump({"words": palavras}, f)
print(f"Whisper: {len(palavras)} palavras transcritas.")
