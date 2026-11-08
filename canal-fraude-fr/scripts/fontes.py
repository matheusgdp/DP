"""Prepara as fontes de um episódio: tempo por palavra (<id>.words.json) e cortes de cena (<id>.cortes.json).

  python fontes.py "EP" [--so id1,id2]

Roda só no que falta. Grava também <id>.txt, com a fala em blocos marcados por minutagem, para escrever o roteiro.
"""
import argparse, json, pathlib, re, subprocess, sys

import numpy as np
from faster_whisper import WhisperModel


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("ep")
    ap.add_argument("--so")
    a = ap.parse_args()
    F = pathlib.Path(a.ep).resolve() / "fontes"
    so = a.so.split(",") if a.so else None
    modelo = None
    for mp4 in sorted(F.glob("*.mp4")):
        if so and mp4.stem not in so:
            continue
        wj = mp4.with_suffix(".words.json")
        if not wj.exists():
            modelo = modelo or WhisperModel("small", device="cpu", compute_type="int8")
            pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp4), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
            audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
            segs, _ = modelo.transcribe(audio, language="fr", word_timestamps=True, vad_filter=True)
            pal = [{"w": w.word.strip(), "de": round(w.start, 2), "ate": round(w.end, 2)} for s in segs for w in s.words]
            wj.write_text(json.dumps(pal, ensure_ascii=False), encoding="utf-8")
            linhas, at, t0 = [], [], 0
            for p in pal:
                if not at:
                    t0 = p["de"]
                at.append(p["w"])
                if re.search(r"[.?!]$", p["w"]) or len(at) > 28:
                    linhas.append(f"[{t0:7.2f}-{p['ate']:7.2f}] {' '.join(at)}")
                    at = []
            if at:
                linhas.append(f"[{t0:7.2f}-{pal[-1]['ate']:7.2f}] {' '.join(at)}")
            mp4.with_suffix(".txt").write_text("\n".join(linhas), encoding="utf-8")
        cj = mp4.with_suffix(".cortes.json")
        if not cj.exists():
            e = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(mp4), "-an", "-vf", "scale=320:-2,select='gt(scene,0.25)',showinfo", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
            cj.write_text(json.dumps([round(float(x), 2) for x in re.findall(r"pts_time:([\d.]+)", e)]), encoding="utf-8")
        print(mp4.stem, "ok", flush=True)


if __name__ == "__main__":
    main()
