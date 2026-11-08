"""IMAGENS COM LICENÇA para o canal: busca, baixa e registra a licença de cada foto.

O canal não usa trecho de TV nem imagem sem licença clara. Este script só aceita:
  Pexels (Pexels License), Wikimedia Commons em CC0, domínio público ou CC BY (sem SA, sem ND, sem NC).
Cada arquivo baixado entra em EP\\licencas.json (id, arquivo, licença, autor, link, data) e na folha
build\\fotos-<termo>.jpg para escolher com os olhos.

  python imagens.py EP "eyeglasses store" [--commons "Tribunal de Paris"] [--n 8]
  python imagens.py EP --lista            (o que já está registrado)

Vídeo de órgão público entra à mão em licencas.json, e só com a licença declarada (Licence Ouverte ou CC BY)
ou autorização escrita guardada na pasta (campo "prova").
"""
import argparse, datetime, hashlib, io, json, os, pathlib, re, sys, urllib.parse, urllib.request
from PIL import Image, ImageDraw, ImageFont

UA = {"User-Agent": "canal-fraude-fr/1.0 (montagem de video; uso com credito)"}
ACEITAS = re.compile(r"^(cc0|pdm|public domain|domaine public|cc by \d|cc-by-\d|cc by$|pexels license|pixabay content license|licence ouverte|autorisation écrite)", re.I)


def licenca_ok(lic):
    lic = (lic or "").strip()
    if re.search(r"\b(sa|nd|nc)\b", lic.lower().replace("-", " ")):
        return False
    return bool(ACEITAS.match(lic))


def pega(url, binario=False, **kw):
    req = urllib.request.Request(url, headers={**UA, **kw})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = r.read()
    return d if binario else json.loads(d.decode("utf-8"))


def pexels(termo, n):
    chave = os.environ.get("PEXELS_API_KEY")
    if not chave:
        print("  (sem PEXELS_API_KEY: pulando Pexels)")
        return []
    q = urllib.parse.urlencode({"query": termo, "per_page": n, "orientation": "landscape"})
    out = []
    for p in pega(f"https://api.pexels.com/v1/search?{q}", Authorization=chave).get("photos", []):
        autor = p.get("photographer", "")
        if autor.startswith("http"):   # alguns perfis trazem o site no lugar do nome: "https://kaboompics.com/" vira "Kaboompics"
            autor = urllib.parse.urlparse(autor).netloc.replace("www.", "").split(".")[0].capitalize()
        out.append({"id": f"px{p['id']}", "url": p["src"]["large2x"], "licenca": "Pexels License",
                    "autor": autor, "pagina": p["url"], "credito": f"{autor} / Pexels",
                    "titulo": p.get("alt", "")})
    return out


def commons(termo, n):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {termo}",
                                "gsrnamespace": 6, "gsrlimit": n * 3, "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 2400})
    out = []
    for p in (pega(f"https://commons.wikimedia.org/w/api.php?{q}").get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata", {})
        lic = re.sub(r"<[^>]+>", "", md.get("LicenseShortName", {}).get("value", ""))
        autor = re.sub(r"<[^>]+>", "", md.get("Artist", {}).get("value", "")).strip()[:60]
        if not licenca_ok(lic):
            continue
        out.append({"id": "wm" + hashlib.sha1(p["title"].encode()).hexdigest()[:10], "url": ii.get("thumburl") or ii.get("url"),
                    "licenca": lic, "autor": autor, "pagina": ii.get("descriptionurl", ""),
                    "credito": f"{autor} / Wikimedia Commons, {lic}", "titulo": p["title"]})
        if len(out) >= n:
            break
    return out


def folha(cands, pasta, nome):
    f = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 22)
    col, lw, lh = 4, 460, 300
    lin = (len(cands) + col - 1) // col
    im = Image.new("RGB", (col * lw, lin * lh), (20, 20, 24))
    d = ImageDraw.Draw(im)
    for i, c in enumerate(cands):
        x, y = i % col * lw, i // col * lh
        t = Image.open(pasta / c["arquivo"]).convert("RGB")
        t.thumbnail((lw - 10, lh - 50))
        im.paste(t, (x + 5, y + 5))
        d.text((x + 8, y + lh - 42), f"{c['id']} · {c['licenca']}"[:44], font=f, fill=(255, 220, 60))
    im.save(nome, quality=85)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("ep")
    ap.add_argument("termo", nargs="?")
    ap.add_argument("--commons")
    ap.add_argument("--n", type=int, default=8)
    ap.add_argument("--lista", action="store_true")
    a = ap.parse_args()
    ep = pathlib.Path(a.ep).resolve()
    reg_f = ep / "licencas.json"
    reg = json.loads(reg_f.read_text(encoding="utf-8")) if reg_f.exists() else {}
    if a.lista:
        for k, v in reg.items():
            print(f"{k:16} {'OK ' if licenca_ok(v['licenca']) else 'NÃO'} {v['licenca']:22} {v.get('credito', '')}")
        return
    pasta = ep / "fontes" / "img"
    pasta.mkdir(parents=True, exist_ok=True)
    cands = (pexels(a.termo, a.n) if a.termo else []) + (commons(a.commons, a.n) if a.commons else [])
    novos = []
    for c in cands:
        arq = f"{c['id']}.jpg"
        if not (pasta / arq).exists():
            try:
                im = Image.open(io.BytesIO(pega(c["url"], binario=True))).convert("RGB")
            except Exception as e:
                print(f"  falhou {c['id']}: {e}")
                continue
            im.thumbnail((2400, 2400))
            im.save(pasta / arq, quality=92)
        c["arquivo"] = arq
        c["acesso"] = datetime.date.today().isoformat()
        reg[c["id"]] = {k: c[k] for k in ("arquivo", "licenca", "autor", "credito", "pagina", "titulo", "acesso")}
        novos.append(c)
    reg_f.write_text(json.dumps(reg, indent=1, ensure_ascii=False), encoding="utf-8")
    (ep / "build").mkdir(exist_ok=True)
    nome = ep / "build" / f"fotos-{re.sub(r'[^a-z0-9]+', '-', (a.termo or a.commons).lower())[:30]}.jpg"
    if novos:
        folha(novos, pasta, nome)
    print(f"{len(novos)} imagens · folha: {nome}")


if __name__ == "__main__":
    main()
