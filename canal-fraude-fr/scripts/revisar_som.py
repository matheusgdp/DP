"""Primeira passada da REVISÃO do plano sonoro, para vídeos sem telejornal (formato v2 do canal).

O analisar.mjs não sabe onde começa cada bloco do roteiro. Este script:
  1. põe os climas no começo real de cada bloco (`--climas` na ordem dos blocos do roteiro.md);
  2. abre 0,4 s de silêncio (stop-start) antes das perguntas de virada (`--viradas`, textos dos cartões);
  3. põe whoosh (foto, pergunta, documento, fluxo, citação) ou tic (cartão de texto) em cada troca de imagem
     sem efeito a menos de 1,2 s, fora dos avisos de presunção de inocência, até 10 efeitos por minuto.
Depois disso o Claude ainda abre a folha e confere (SKILL.md, passo 2).

  python revisar_som.py EP --climas ouverture,mecanisme,mecanisme,enquete,tension,tension,grave,tension,verdict,verdict
                           [--viradas "Une affaire à part ?" "..."]
"""
import argparse, json, pathlib, re, sys, unicodedata

FPS = 30


def norm(w):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", w.lower()))


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("ep")
    ap.add_argument("--climas", required=True)
    ap.add_argument("--viradas", nargs="*", default=[])
    a = ap.parse_args()
    EP = pathlib.Path(a.ep).resolve()
    ro = json.loads((EP / "roteiro.json").read_text(encoding="utf-8"))
    if ro.get("clips"):
        raise SystemExit("este vídeo tem telejornal: revise à mão (references/plano-sonoro.md)")
    pal = json.loads((EP / "narracao-tempos.json").read_text(encoding="utf-8"))["palavras"]
    pl = json.loads((EP / "plano-visual.json").read_text(encoding="utf-8"))
    ps = json.loads((EP / "plano-sonoro.json").read_text(encoding="utf-8"))

    # os mesmos tempos que a montagem usa (montar.py)
    cenas = [s for c in ro["capitulos"] for s in c["cenas"]]
    i, faixas = 0, []
    for s in cenas:
        k = len(s["diz"].split())
        faixas.append(pal[i:i + k])
        i += k
    t, inicio, beats, bloco_da_cena = 0, [], [], []
    for c in ro["capitulos"]:
        bloco_da_cena += [c["titulo"]] * len(c["cenas"])
    for k, w in enumerate(faixas):
        ini, fim = w[0]["em"] - 0.04, w[-1]["ate"] + 0.26
        if k + 1 < len(faixas):
            fim = min(fim, faixas[k + 1][0]["em"] - 0.02)
        total = round((fim - ini) * FPS)
        if not k or bloco_da_cena[k] != bloco_da_cena[k - 1]:
            inicio.append(round(t, 2))
        nomes, cur = [norm(x["w"]) for x in w], 0
        for b in pl["cenas"].get(str(k), []):
            alvo = [norm(x) for x in b["em"].split()]
            for j in range(cur, len(nomes)):
                if nomes[j:j + len(alvo)] == alvo:
                    f0 = round((w[j]["em"] - 0.04 - ini) * FPS) if j else 0
                    beats.append((round(t + f0 / FPS, 2), b))
                    cur = j
                    break
        t += total / FPS
    climas = a.climas.split(",")
    if len(climas) != len(inicio):
        raise SystemExit(f"o roteiro tem {len(inicio)} blocos e você deu {len(climas)} climas")
    dur = ps["duracao"]
    tr = []
    for c, de in zip(climas, inicio):
        if tr and tr[-1]["clima"] == c:
            continue
        if tr:
            tr[-1]["ate"] = de
        tr.append({"de": de, "clima": c})
    tr[-1]["ate"] = dur
    ps["trilha"]["trechos"], ps["trilha"]["sugestoes"] = tr, []
    ps["trilha"]["silencios"] = [{"t": round(bt - 0.45, 2), "dur": 0.4} for bt, b in beats if b.get("texto") in a.viradas]

    efs, avisos, novos = ps["efeitos"], ps["sem_efeitos"], 0
    for bt, b in beats:
        if bt < 1 or any(x["de"] - 0.5 <= bt <= x["ate"] + 0.5 for x in avisos) or any(abs(e["t"] - bt) < 1.2 for e in efs):
            continue
        som = "whoosh" if b["tipo"] in ("foto", "pergunta", "documento", "fluxo", "citacao") else "tic"
        efs.append({"t": max(0, round(bt - 0.08, 2)), "som": som, "motivo": f"troca: {b['tipo']}"})
        novos += 1
    efs.sort(key=lambda e: e["t"])
    por_min, final = {}, []
    for e in efs:
        m = int(e["t"] // 60)
        if por_min.get(m, 0) >= 10 and e["som"] in ("whoosh", "tic"):
            continue
        por_min[m] = por_min.get(m, 0) + 1
        final.append(e)
    ps["efeitos"] = final
    (EP / "plano-sonoro.json").write_text(json.dumps(ps, indent=1, ensure_ascii=False), encoding="utf-8")
    print("climas:", " → ".join(f"{x['clima']} {int(x['de'] // 60)}:{int(x['de'] % 60):02d}" for x in tr))
    print("silêncios:", [s["t"] for s in ps["trilha"]["silencios"]])
    print(f"efeitos: {len(final)} ({len(final) / dur * 60:.1f}/min), {novos} trocas novas · por minuto: {por_min}")
    print("o plano continua em rascunho: abra a folha, confira e tire \"rascunho\": true")


if __name__ == "__main__":
    main()
