"""Converte o roteiro.md do canal no roteiro.json que o voz.mjs narra.

Cada trecho de narração entre dois [EXTRAIT] vira uma "cena"; as marcas de clipe ficam em "clips", na ordem,
com o índice da cena que vem antes delas. Assim a voz sai numa tomada só e a montagem corta nos clipes.

  python roteiro_json.py "EP" --voz <voice_id> [--velocidade 1.0]
"""
import argparse, json, pathlib, re, sys

CLIP = re.compile(r"^\[(?:CLIPE?|EXTRAIT)\s*:\s*(.*?),\s*([\w-]+),\s*(\d+):(\d+)[–-](\d+):(\d+)\]\s*$")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("ep")
    ap.add_argument("--voz", required=True)
    ap.add_argument("--velocidade", type=float, default=1.0)
    a = ap.parse_args()
    EP = pathlib.Path(a.ep).resolve()
    capitulos, clips, atual, buf = [], [], None, []

    def fecha():
        nonlocal buf
        txt = " ".join(buf).strip()
        buf = []
        if txt:
            atual["cenas"].append({"diz": txt})

    for l in (EP / "roteiro.md").read_text(encoding="utf-8").splitlines():
        l = l.strip()
        if l.startswith("## "):
            if atual is not None:
                fecha()
            atual = {"titulo": l[3:], "cenas": []}
            capitulos.append(atual)
        elif (m := CLIP.match(l)):
            fecha()
            ordem = sum(len(c["cenas"]) for c in capitulos)
            clips.append({"antes_da_cena": ordem, "fonte": m[1], "video": m[2],
                          "de": int(m[3]) * 60 + int(m[4]), "ate": int(m[5]) * 60 + int(m[6])})
        elif l and not l.startswith("#") and atual is not None:
            buf.append(l)
    fecha()
    capitulos = [c for c in capitulos if c["cenas"]]
    saida = {"voz": {"id": a.voz, "velocidade": a.velocidade}, "capitulos": capitulos, "clips": clips}
    velho = EP / "roteiro.json"
    velho.write_text(json.dumps(saida, indent=2, ensure_ascii=False), encoding="utf-8")
    n = sum(len(c["cenas"]) for c in capitulos)
    pal = sum(len(s["diz"].split()) for c in capitulos for s in c["cenas"])
    print(f"roteiro.json: {len(capitulos)} blocos, {n} trechos de narração, {pal} palavras, {len(clips)} clipes")


if __name__ == "__main__":
    main()
