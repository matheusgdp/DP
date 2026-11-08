"""A MONTAGEM do canal: narração + cartões do canal + fotos e vídeos COM LICENÇA → bruto.mp4.

O canal não usa trecho de TV: toda foto ou vídeo da tela precisa estar em licencas.json
com uma licença aceita (imagens.py: Pexels, CC0, domínio público, CC BY, Licence Ouverte, autorização escrita).
Sem isso a montagem para antes de renderizar.

Lê, na pasta do vídeo:
  roteiro.json          os trechos de narração e a ordem dos clipes (roteiro_json.py)
  narracao.mp3          a voz numa tomada só, e narracao-tempos.json com o tempo de cada palavra (voz.mjs)
  plano-visual.json     o que entra na tela em cada frase, e o corte exato de cada clipe
  fontes\\<id>.mp4       as reportagens baixadas

Escreve:
  bruto.mp4             o vídeo sem trilha nem efeitos
  narracao.srt          a legenda da narração NOS TEMPOS DO BRUTO
  extraits.json         onde está cada telejornal (para a mixagem)
  graficos.json         o que entra na tela e quando (para os efeitos ficarem exatos)
  build\\seg\\            um pedaço de vídeo por cena, em cache: mudar uma cena só renderiza essa cena

  python montar.py "EP" [--so-folha]

Cartões, carimbos e créditos saem do desenho deste arquivo: não há imagem de IA. Cada imagem de terceiros leva a
fonte na tela. O carimbo sempre mostra o estado jurídico escrito no plano: quem escreve o plano responde por ele.
"""
import argparse, hashlib, json, pathlib, re, subprocess, sys, unicodedata
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from imagens import licenca_ok  # noqa: E402
from canal import marca_do_canal  # noqa: E402

W, H, FPS = 1920, 1080, 30
PRETO, CARVAO, BRANCO, CINZA = (8, 11, 20), (15, 21, 36), (245, 245, 242), (170, 176, 190)
PAPEL, TINTA = (240, 236, 226), (30, 32, 40)
VERMELHO, ESCURO, AMARELO = (226, 40, 46), (18, 42, 92), (255, 208, 40)
F = "C:/Windows/Fonts/"
MARCA = "MEU CANAL"  # trocado pelo "nome" do canal.json em main()
FRASE = "Où est passé l'argent public, qui l'a pris, et ce que la justice en a fait."
FRASE2 = "Nouvelles affaires chaque semaine. Sources dans la description."


def fonte(tam, peso=700, largura=75):
    f = ImageFont.truetype(F + "bahnschrift.ttf", tam)
    f.set_variation_by_axes([peso, largura])
    return f


def cabe(d, txt, tam, larg, peso=700, largura=75, minimo=40):
    """A maior fonte até "tam" em que o texto cabe em "larg": "36 MILLIONS D'EUROS" e os estados jurídicos franceses são compridos."""
    while tam > minimo and d.textlength(txt, font=fonte(tam, peso, largura)) > larg:
        tam -= 4
    return fonte(tam, peso, largura)


def serifa(tam, italico=False):
    return ImageFont.truetype(F + ("georgiaz.ttf" if italico else "georgiab.ttf"), tam)


def quebra(d, txt, f, larg):
    linhas, at = [], ""
    # em francês "?" vem depois de um espaço: fica colado à palavra, nunca sozinho na linha
    for p in re.sub(r"\s+([?!:;])", lambda m: " " + m[1], txt).split(" "):
        t = f"{at} {p}".strip()
        if d.textlength(t, font=f) <= larg:
            at = t
        else:
            linhas.append(at)
            at = p
    return linhas + [at] if at else linhas


def bloco(d, xy, txt, f, larg, cor=BRANCO, entre=1.18):
    x, y = xy
    for l in quebra(d, txt, f, larg):
        d.text((x, y), l, font=f, fill=cor)
        y += int(f.size * entre)
    return y


def fundo():
    alvo = pathlib.Path(BUILD) / "fundo.png"
    if alvo.exists():
        return alvo
    im = Image.new("RGB", (W * 2, H * 2), CARVAO)
    d = ImageDraw.Draw(im)
    for x in range(0, W * 2, 96):
        d.line([(x, 0), (x, H * 2)], fill=(26, 34, 54), width=2)
    for y in range(0, H * 2, 96):
        d.line([(0, y), (W * 2, y)], fill=(26, 34, 54), width=2)
    brilho = Image.new("L", (W * 2, H * 2), 0)
    ImageDraw.Draw(brilho).ellipse([W * 1.1, -H * 0.7, W * 2.7, H * 1.1], fill=120)
    brilho = brilho.filter(ImageFilter.GaussianBlur(240))
    im.paste(Image.new("RGB", im.size, ESCURO), mask=brilho)
    im.save(alvo)
    return alvo


def marca(d):
    d.rectangle([60, 48, 72, 92], fill=VERMELHO)
    d.text((86, 46), MARCA, font=fonte(38), fill=BRANCO)
    d.text((86 + d.textlength(MARCA, font=fonte(38)) + 16, 52), CASO, font=fonte(30, 400), fill=CINZA)


def carimbo(texto, cor=VERMELHO, tam=74):
    """Só o carimbo, em camada própria: entra depois do cartão, como no AussieFiles."""
    f = fonte(tam)
    # mede pelas letras de verdade: o acento de "RÉU" e o til de "CONDENAÇÃO" não podem encostar na borda
    x0, y0, x1, y1 = ImageDraw.Draw(Image.new("L", (1, 1))).textbbox((0, 0), texto, font=f)
    c = Image.new("RGBA", (x1 - x0 + 72, y1 - y0 + 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle([5, 5, c.width - 6, c.height - 6], 8, outline=cor + (255,), width=8)
    d.text((36 - x0, 30 - y0), texto, font=f, fill=cor + (255,))
    return c.rotate(-6, expand=True, resample=Image.BICUBIC)


def rotulo_fonte(d, txt):
    if not txt:
        return
    f = fonte(26, 400, 100)
    d.text((62, H - 56), txt, font=f, fill=CINZA)


def cartao(b):
    """Desenha o cartão inteiro numa camada transparente. Devolve (camada, carimbo ou None, posição do carimbo)."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t, marg, larg = b["tipo"], 120, W - 240
    sobre = (b.get("sobre") or "").upper()
    if sobre:
        d.rectangle([marg, 168, marg + 12, 214], fill=VERMELHO)
        d.text((marg + 28, 166), sobre, font=fonte(44, 600, 85), fill=CINZA)
    pos = (W - 700, 640)

    if t == "numero":
        f = cabe(d, b["valor"], b.get("tam", 300), larg)
        y = 270
        d.text((marg - 6, y), b["valor"], font=f, fill=AMARELO)
        y += int(f.size * 1.14)
        bloco(d, (marg, y), b.get("texto", ""), fonte(62, 500, 85), larg)
    elif t == "pergunta":
        bloco(d, (marg, 330), b["texto"], fonte(112, 700, 80), larg)
    elif t == "texto":
        y = 290
        for i, l in enumerate(b["linhas"]):
            y = bloco(d, (marg, y), l, fonte(b.get("tam", 78), 600, 85), larg, BRANCO if i == 0 else (222, 222, 222)) + 24
    elif t == "citacao":
        d.text((marg - 8, 170), "\u201c", font=serifa(240), fill=VERMELHO)
        y = bloco(d, (marg + 10, 360), b["texto"], serifa(b.get("tam", 84)), larg - 40, entre=1.26) + 26
        d.text((marg + 10, y), b.get("quem", ""), font=fonte(44, 500, 90), fill=CINZA)
    elif t == "pessoa":
        d.text((marg, 290), b["nome"].upper(), font=cabe(d, b["nome"].upper(), 150, larg), fill=BRANCO)
        y = bloco(d, (marg, 470), b.get("papel", ""), fonte(60, 400, 90), larg - 200, (226, 226, 226)) + 24
        for s in b.get("linhas", []):
            y = bloco(d, (marg, y), s, fonte(50, 400, 90), larg - 200, CINZA) + 8
    elif t == "rota":
        pontos = b["pontos"]
        y0, x0, x1 = 520, marg + (220 if len(pontos) <= 2 else 90), W - marg - (220 if len(pontos) <= 2 else 90)
        passo = (x1 - x0) / max(1, len(pontos) - 1)
        d.line([(x0, y0), (x1, y0)], fill=VERMELHO, width=10)
        for i, p in enumerate(pontos):
            x = x0 + passo * i
            d.ellipse([x - 26, y0 - 26, x + 26, y0 + 26], fill=BRANCO, outline=VERMELHO, width=8)
            fp = fonte(64 if len(pontos) <= 2 else 54, 700, 80)
            d.text((x, y0 - 70), p.upper(), font=fp, fill=BRANCO, anchor="ms")
        if b.get("texto"):
            d.text((W / 2, y0 + 120), b["texto"], font=fonte(52, 400, 90), fill=CINZA, anchor="mm")
    elif t == "linha":
        itens, y = b["itens"], 270
        for quando, oque in itens:
            d.ellipse([marg, y + 12, marg + 34, y + 46], fill=VERMELHO)
            d.text((marg + 64, y), quando.upper(), font=cabe(d, quando.upper(), 58, 420, minimo=34), fill=AMARELO)
            bloco(d, (marg + 500, y), oque, fonte(54, 400, 90), larg - 560)
            y += 150
    elif t == "barra":
        a, b_ = b["a"], b["b"]
        x0, x1, y0 = marg, W - marg, 400
        meio = x0 + (x1 - x0) * a[1] / 100
        d.rectangle([x0, y0, meio, y0 + 200], fill=AMARELO)
        d.rectangle([meio, y0, x1, y0 + 200], fill=ESCURO)
        d.text((x0 + 30, y0 + 28), f"{a[1]}%", font=fonte(140), fill=PRETO)
        d.text((meio + 30, y0 + 28), f"{b_[1]}%", font=fonte(140), fill=BRANCO)
        d.text((x0, y0 + 226), a[0], font=fonte(56, 500, 85), fill=BRANCO)
        d.text((x1, y0 + 226), b_[0], font=fonte(56, 500, 85), fill=BRANCO, anchor="ra")
        if b.get("texto"):
            d.text((marg, y0 + 330), b["texto"], font=fonte(46, 400, 90), fill=CINZA)
    elif t == "lados":
        meio = W // 2
        for i, (tit, itens) in enumerate(b["colunas"]):
            x = marg if i == 0 else meio + 40
            d.text((x, 200), tit.upper(), font=fonte(112), fill=AMARELO if i == b.get("foco", i) else (110, 110, 114))
            y = 340
            for it in itens:
                y = bloco(d, (x, y), it, fonte(52, 400, 90), meio - marg - 60, BRANCO if i == b.get("foco", i) else (110, 110, 114)) + 26
        d.line([(meio, 200), (meio, H - 130)], fill=(70, 70, 76), width=3)
    elif t == "quadro":
        y, ativa = 150, b.get("ativa", -1)
        for i, (nome, est) in enumerate(b["linhas"]):
            on = i <= ativa
            if i == ativa:
                d.rectangle([marg - 30, y - 12, W - marg + 30, y + 92], fill=ESCURO)
            cor = BRANCO if on else (72, 72, 78)
            d.text((marg, y), nome.upper(), font=cabe(d, nome.upper(), 62, 630, minimo=34), fill=cor)
            d.text((marg + 660, y + 12), est if on else "", font=cabe(d, est, 46, larg - 660, 400, 90, 28), fill=cor)
            y += 120
    elif t == "documento":
        # documento RECRIADO pelo canal: nunca a cópia de um documento real; sempre com o selo RECONSTITUTION
        px, py, pw, ph = marg + 40, 150, 860, 800
        d.rectangle([px + 14, py + 14, px + pw + 14, py + ph + 14], fill=(0, 0, 0, 120))
        d.rectangle([px, py, px + pw, py + ph], fill=PAPEL)
        d.text((px + 50, py + 46), b["titulo"].upper(), font=fonte(60, 700, 80), fill=TINTA)
        y = py + 130
        for s_ in b.get("cabecalho", []):
            d.text((px + 50, y), s_, font=fonte(30, 400, 90), fill=(110, 110, 116))
            y += 40
        y += 18
        d.line([(px + 50, y), (px + pw - 50, y)], fill=(170, 166, 156), width=2)
        y += 26
        alvo = b.get("destaque")
        for i, (desc, val) in enumerate(b.get("linhas", [])):
            d.text((px + 50, y), desc, font=fonte(38, 400, 90), fill=TINTA)
            d.text((px + pw - 50, y), val, font=fonte(38, 600, 90), fill=TINTA, anchor="ra")
            if alvo == i:
                w_ = d.textlength(val, font=fonte(38, 600, 90))
                d.ellipse([px + pw - 50 - w_ - 30, y - 18, px + pw - 30, y + 62], outline=VERMELHO, width=6)
            y += 64
        if b.get("total"):
            y += 10
            d.line([(px + 50, y), (px + pw - 50, y)], fill=TINTA, width=3)
            y += 24
            lab, val = b["total"]
            d.text((px + 50, y), lab, font=fonte(44, 700, 85), fill=TINTA)
            d.text((px + pw - 50, y), val, font=fonte(52, 700, 85), fill=TINTA, anchor="ra")
            if alvo == "total":
                w_ = d.textlength(val, font=fonte(52, 700, 85))
                d.ellipse([px + pw - 50 - w_ - 34, y - 22, px + pw - 26, y + 76], outline=VERMELHO, width=7)
        selo = "RECONSTITUTION · DOCUMENT FICTIF"
        fs = fonte(30, 700, 85)
        sw = d.textlength(selo, font=fs)
        d.rectangle([px + pw - sw - 80, py + ph - 76, px + pw - 40, py + ph - 26], outline=VERMELHO, width=4)
        d.text((px + pw - sw - 60, py + ph - 70), selo, font=fs, fill=VERMELHO)
        if b.get("texto"):
            tx = px + pw + 80
            bloco(d, (tx, 330), b["texto"], fonte(64, 600, 85), W - tx - 80)
    elif t == "fluxo":
        # o mecanismo em nós e setas; "ativa" = quantas setas já apareceram (a última fica em amarelo)
        nos, setas = b["nos"], b.get("setas", [])
        ativa = b.get("ativa", len(setas))
        x0, x1, yc = marg + 150, W - marg - 150, 560
        passo = (x1 - x0) / max(1, len(nos) - 1)
        cx = [x0 + passo * i for i in range(len(nos))]
        fn = fonte(50, 700, 80)
        for i, (a_, z_, rot) in enumerate(setas[:ativa]):
            cor = AMARELO if i == ativa - 1 else (200, 204, 214)
            ida = z_ > a_
            ys = yc - 120 if ida else yc + 120
            xa, xz = cx[a_] + (60 if ida else -60), cx[z_] - (60 if ida else -60)
            d.line([(xa, ys), (xz, ys)], fill=cor, width=9)
            s_ = 1 if ida else -1
            d.polygon([(xz + 4 * s_, ys), (xz - 30 * s_, ys - 20), (xz - 30 * s_, ys + 20)], fill=cor)
            fr = fonte(40, 600, 85)
            d.text(((xa + xz) / 2, ys - 26 if ida else ys + 26), rot, font=fr, fill=cor, anchor="md" if ida else "ma")
        for i, nome in enumerate(nos):
            tw = d.textlength(nome.upper(), font=fn)
            d.rounded_rectangle([cx[i] - tw / 2 - 40, yc - 52, cx[i] + tw / 2 + 40, yc + 52], 14, fill=ESCURO, outline=BRANCO, width=4)
            d.text((cx[i], yc), nome.upper(), font=fn, fill=BRANCO, anchor="mm")
        if b.get("texto"):
            d.text((W / 2, yc + 260), b["texto"], font=cabe(d, b["texto"], 52, W - 2 * marg, 400, 90), fill=CINZA, anchor="mm")
    elif t == "fim":
        d.text((W / 2, 400), MARCA, font=fonte(190), fill=BRANCO, anchor="mm")
        d.text((W / 2, 540), FRASE, font=cabe(d, FRASE, 52, W - 200, 400, 95), fill=CINZA, anchor="mm")
        d.text((W / 2, 660), FRASE2, font=fonte(44, 400, 95), fill=AMARELO, anchor="mm")

    # centraliza o conteúdo entre a marca e a linha da fonte
    caixa = im.getbbox()
    if caixa:
        dy = (130 + H - 90 - caixa[1] - caixa[3]) // 2
        final = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        final.paste(im, (0, dy))
        im = final
    d = ImageDraw.Draw(im)
    marca(d)
    rotulo_fonte(d, b.get("fonte"))
    st = None
    if b.get("carimbo"):
        st = carimbo(b["carimbo"], tam=b.get("carimbo_tam", 74))
        pos = (W - st.width - 90, H - st.height - 100)
    return im, st, pos


def faixa_video(b):
    """A legenda e o crédito sobre uma imagem de apoio."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if b.get("fonte"):
        f = fonte(30, 500, 90)
        tw = d.textlength(b["fonte"], font=f)
        d.rectangle([40, 40, tw + 80, 92], fill=(0, 0, 0, 170))
        d.text((60, 49), b["fonte"], font=f, fill=BRANCO)
    if b.get("legenda"):
        f = fonte(66, 700, 85)
        ls = quebra(d, b["legenda"].upper(), f, W - 320)
        alt = len(ls) * 78 + 36
        y0 = H - alt - (170 if b.get("clipe") else 90)   # no clipe, fica acima da tarja da emissora
        d.rectangle([90, y0, 104, y0 + alt], fill=VERMELHO)
        larg = max(d.textlength(l, font=f) for l in ls)
        d.rectangle([104, y0, 104 + larg + 56, y0 + alt], fill=(10, 10, 12, 225))
        y = y0 + 14
        for l in ls:
            d.text((132, y), l, font=f, fill=BRANCO)
            y += 78
    return im


def ff(args):
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(r.stderr[-900:])


ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]


def render_video(b, n, saida):
    """Imagem de apoio ou clipe: corte exato, sem som, com um empurrão lento na imagem de apoio."""
    dur = n / FPS
    v = b["video"]
    fonte_mp4 = pathlib.Path(EP) / "fontes" / f"{v}.mp4"
    de, ate = b.get("de", 0), b.get("ate")
    bruto = (ate - de) if ate else dur
    fator = max(1.0, min(dur / bruto, 1.6)) if not b.get("clipe") else 1.0   # esticar no máximo 60% antes de congelar
    keep = b.get("guardar", 1.0)                                             # 0.86 = corta a tarja de baixo
    filtro = []
    if keep < 1:
        filtro.append(f"crop=iw*{keep}:ih*{keep}:{0 if b.get('esquerda') else f'(iw-iw*{keep})/2'}:0")
    filtro.append(f"setpts={fator:.4f}*PTS,fps={FPS}")
    filtro.append(f"tpad=stop_mode=clone:stop_duration={dur + 1:.2f},trim=duration={dur:.4f},setpts=PTS-STARTPTS")
    if not b.get("clipe"):
        # zoom lento e suave, por cima da imagem já cortada
        filtro.append(f"scale={W*2}:{H*2},zoompan=z='min(1+0.0004*on,1.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}")
    else:
        filtro.append(f"scale={W}:{H}")
    camada = pathlib.Path(BUILD) / f"{saida.stem}.png"
    faixa_video(b).save(camada)
    cadeia = f"[0:v]{','.join(filtro)}[v];[v][1:v]overlay=0:0,format=yuv420p[o]"
    ff(["-ss", f"{de:.3f}", *(["-t", f"{bruto:.3f}"]), "-i", str(fonte_mp4), "-loop", "1", "-t", f"{dur:.3f}", "-i", str(camada), "-filter_complex", cadeia, "-map", "[o]", "-frames:v", str(n), *ENC, str(saida)])


def render_cartao(b, n, saida):
    dur = n / FPS
    im, st, pos = cartao(b)
    cam = pathlib.Path(BUILD) / f"{saida.stem}.png"
    im.save(cam)
    if b.get("bg") and b["bg"].get("foto"):
        f_ = b["bg"]
        entradas = ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(foto_de(f_["foto"])), "-loop", "1", "-t", f"{dur:.3f}", "-i", str(cam)]
        base = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=9,eq=saturation=0.55,colorlevels=romax=0.36:gomax=0.36:bomax=0.36,fps={FPS}[bg]"
    elif b.get("bg"):
        f_ = b["bg"]
        keep = f_.get("guardar", 1.0)
        fator = max(1.0, dur / (f_["ate"] - f_["de"]))
        entradas = ["-ss", f"{f_['de']:.3f}", "-t", f"{f_['ate'] - f_['de']:.3f}", "-i", str(pathlib.Path(EP) / "fontes" / f"{f_['video']}.mp4"), "-loop", "1", "-t", f"{dur:.3f}", "-i", str(cam)]
        base = f"[0:v]crop=iw*{keep}:ih*{keep}:(iw-iw*{keep})/2:0,setpts={fator:.4f}*PTS,fps={FPS},tpad=stop_mode=clone:stop_duration={dur + 1:.2f},trim=duration={dur:.4f},setpts=PTS-STARTPTS,scale={W}:{H},gblur=sigma=9,eq=saturation=0.55,colorlevels=romax=0.36:gomax=0.36:bomax=0.36[bg]"
    else:
        entradas = ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(fundo()), "-loop", "1", "-t", f"{dur:.3f}", "-i", str(cam)]
        base = f"[0:v]zoompan=z='1+0.00025*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}[bg]"
    g = [base, "[1:v]format=rgba,fade=in:st=0:d=0.18:alpha=1[c]", "[bg][c]overlay=0:0[a]"]
    ult = "[a]"
    if st:
        cs = pathlib.Path(BUILD) / f"{saida.stem}-st.png"
        st.save(cs)
        entradas += ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(cs)]
        em = min(0.45, dur / 3)
        g += [f"[2:v]format=rgba,fade=in:st={em:.2f}:d=0.05:alpha=1[s]", f"{ult}[s]overlay={pos[0]}:{pos[1]}[b]"]
        ult = "[b]"
    g.append(f"{ult}format=yuv420p[o]")
    ff([*entradas, "-filter_complex", ";".join(g), "-map", "[o]", "-frames:v", str(n), *ENC, str(saida)])


LIC = {}


def foto_de(i):
    return pathlib.Path(EP) / "fontes" / "img" / LIC[i]["arquivo"]


def render_foto(b, n, saida):
    """Foto com licença: empurrão lento (Ken Burns), crédito no alto e legenda opcional."""
    dur = n / FPS
    fx, fy = b.get("foco", [0.5, 0.5])
    z = "min(1+0.0006*on,1.12)" if b.get("mov", "in") == "in" else "max(1.12-0.0006*on,1)"
    camada = pathlib.Path(BUILD) / f"{saida.stem}.png"
    faixa_video({**b, "fonte": b.get("fonte") or f"Image : {LIC[b['foto']]['credito']}"}).save(camada)
    cadeia = (f"[0:v]scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2}:(iw-{W*2})*{fx}:(ih-{H*2})*{fy},"
              f"eq=saturation=0.85:contrast=1.05,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={W}x{H}:fps={FPS}[v];"
              f"[v][1:v]overlay=0:0,format=yuv420p[o]")
    ff(["-loop", "1", "-i", str(foto_de(b["foto"])), "-loop", "1", "-t", f"{dur:.3f}", "-i", str(camada), "-filter_complex", cadeia, "-map", "[o]", "-frames:v", str(n), *ENC, str(saida)])


def checa_licencas(pl):
    """Toda foto e todo vídeo da tela precisa de licença aceita em licencas.json. Sem exceção."""
    reg = pathlib.Path(EP) / "licencas.json"
    LIC.update(json.loads(reg.read_text(encoding="utf-8")) if reg.exists() else {})
    usos = [c["video"] for c in pl.get("clipes", [])]
    for bs in pl["cenas"].values():
        for b in bs:
            usos += [b[k] for k in ("foto", "video") if b.get(k)]
            if b.get("bg"):
                usos += [b["bg"].get("foto") or b["bg"].get("video")]
    ruins = sorted({u for u in usos if u not in LIC or not licenca_ok(LIC[u]["licenca"])})
    if ruins:
        raise SystemExit("sem licença aceita em licencas.json: " + ", ".join(f"{u} ({LIC.get(u, {}).get('licenca', 'não registrado')})" for u in ruins)
                         + "\no canal não usa trecho de TV nem imagem sem licença (SKILL.md, M3)")


def norm(w):
    # tira o acento antes: sem isso "é" viraria vazio e "à" e "a" seriam palavras diferentes
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", w.lower()))


def main():
    global EP, BUILD, CASO
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("ep")
    ap.add_argument("--so-folha", action="store_true")
    a = ap.parse_args()
    EP = pathlib.Path(a.ep).resolve()
    global MARCA
    MARCA = marca_do_canal(EP)
    BUILD = EP / "build"
    (BUILD / "seg").mkdir(parents=True, exist_ok=True)
    ro = json.loads((EP / "roteiro.json").read_text(encoding="utf-8"))
    tempos = json.loads((EP / "narracao-tempos.json").read_text(encoding="utf-8"))
    pl = json.loads((EP / "plano-visual.json").read_text(encoding="utf-8"))
    CASO = pl.get("caso", "")
    checa_licencas(pl)
    pal, cenas = tempos["palavras"], [s for c in ro["capitulos"] for s in c["cenas"]]

    # as palavras de cada trecho
    i, faixas = 0, []
    for s in cenas:
        k = len(s["diz"].split())
        faixas.append(pal[i:i + k])
        i += k
    if i != len(pal):
        raise SystemExit(f"o roteiro tem {i} palavras e os tempos têm {len(pal)}: rode o voz.mjs de novo")

    # a linha do tempo: clipes e trechos de narração, em quadros inteiros
    clipes = pl.get("clipes", [])
    if len(clipes) != len(ro["clips"]):
        raise SystemExit(f"o roteiro tem {len(ro['clips'])} clipes e o plano tem {len(clipes)}")
    itens = []
    for k in range(len(cenas) + 1):
        for c, m in zip(clipes, ro["clips"]):
            if m["antes_da_cena"] == k:
                itens.append({"clipe": c})
        if k < len(cenas):
            itens.append({"cena": k})

    beats_cena = {int(k): v for k, v in pl["cenas"].items()}
    pista, video, srt, json_clips, graficos, t = [], [], [], [], [], 0
    for it in itens:
        if "clipe" in it:
            c = it["clipe"]
            n = round((c["ate"] - c["de"]) * FPS)
            b = {"tipo": "clipe", "video": c["video"], "de": c["de"], "ate": c["ate"], "clipe": True, "fonte": f"Source : {c['fonte']}", "legenda": c.get("legenda")}
            video.append((b, n))
            pista.append(("clip", c["video"], c["de"], c["ate"], t))
            json_clips.append({"de": round(t, 2), "ate": round(t + n / FPS, 2), "fonte": c["fonte"], "musica_propria": False})
            t += n / FPS
            continue
        k = it["cena"]
        w = faixas[k]
        ini, fim = w[0]["em"] - 0.04, w[-1]["ate"] + 0.26
        if k + 1 < len(faixas):
            fim = min(fim, faixas[k + 1][0]["em"] - 0.02)
        dur = fim - ini
        total = round(dur * FPS)
        pista.append(("voz", None, ini, ini + total / FPS, t))
        # as cenas visuais deste trecho, ancoradas numa frase
        nomes = [norm(x["w"]) for x in w]
        marcas, cursor = [], 0
        for b in beats_cena.get(k, []):
            alvo = [norm(x) for x in b["em"].split()]
            for j in range(cursor, len(nomes)):
                if nomes[j:j + len(alvo)] == alvo:
                    marcas.append((j, b))
                    cursor = j
                    break
            else:
                raise SystemExit(f"cena {k}: não achei a frase «{b['em']}» a partir de «{' '.join(nomes[cursor:cursor + 6])}…»")
        if not marcas or marcas[0][0] != 0:
            raise SystemExit(f"cena {k}: a primeira imagem precisa começar na primeira palavra («{w[0]['w']}»)")
        for q, (j, b) in enumerate(marcas):
            f0 = round((w[j]["em"] - 0.04 - ini) * FPS) if j else 0
            f1 = round((w[marcas[q + 1][0]]["em"] - 0.04 - ini) * FPS) if q + 1 < len(marcas) else total
            video.append((b, f1 - f0))
            if b.get("grafico"):
                graficos.append({"t": round(t + f0 / FPS, 2), "tipo": b["grafico"], "texto": b.get("valor") or b.get("nome") or b.get("carimbo") or b.get("legenda") or ""})
            if b.get("carimbo"):
                graficos.append({"t": round(t + (f0 + min(0.45 * FPS, (f1 - f0) / 3)) / FPS, 2), "tipo": "tampon", "texto": b["carimbo"]})
        # a legenda em tempos do bruto
        at = []
        for z, x in enumerate(w):
            at.append(x)
            txt = " ".join(y["w"] for y in at)
            prox = w[z + 1] if z + 1 < len(w) else None
            # o valor não se parte entre duas legendas: nem "36" longe de "millions"
            if prox and re.fullmatch(r"\d[\d.,]*", x["w"]) and re.match(r"(mille|million|milliard|euro)", prox["w"], re.I):
                continue
            if not prox or re.search(r"[.?!…]$", x["w"]) or (re.search(r"[,;:]$", x["w"]) and len(txt) > 18) or len(txt) > 40:
                de_ = at[0]["em"] - ini + t
                ate_ = (min(x["ate"] + 0.15, prox["em"] - 0.02) if prox else x["ate"] + 0.2) - ini + t
                srt.append((de_, ate_, txt))
                at = []
        t += total / FPS

    fimb = {"tipo": "fim", "fonte": ""}
    nfim = int(pl.get("fim_s", 4) * FPS)
    video.append((fimb, nfim))
    t_total = t + nfim / FPS

    # 1. os pedaços de vídeo, em cache
    lista = []
    for idx, (b, n) in enumerate(video):
        chave = hashlib.sha1(json.dumps([b, n, CASO, 14], sort_keys=True).encode()).hexdigest()[:12]
        s = BUILD / "seg" / f"{idx:03d}-{chave}.mp4"
        if not s.exists():
            for velho in (BUILD / "seg").glob(f"{idx:03d}-*"):
                velho.unlink()
            (render_video if b.get("video") else render_foto if b.get("foto") else render_cartao)(b, n, s)
        lista.append(s)
        print(f"  {idx + 1}/{len(video)} {b['tipo']} ({n / FPS:.1f}s)", flush=True)
    for f in BUILD.glob("*.png"):
        if f.name != "fundo.png":
            f.unlink()
    (BUILD / "seg" / "lista.txt").write_text("".join(f"file '{p.as_posix()}'\n" for p in lista), encoding="utf-8")
    mudo = BUILD / "video-mudo.mp4"
    ff(["-f", "concat", "-safe", "0", "-i", str(BUILD / "seg" / "lista.txt"), "-c", "copy", str(mudo)])

    # 2. o áudio: a voz e o som original dos clipes, cada um no seu tempo
    ents, g = ["-i", str(EP / "narracao.mp3")], []
    idx = {}
    for tp, v, *_ in pista:
        if tp == "clip" and v not in idx:
            idx[v] = len(idx) + 1
            ents += ["-i", str(EP / "fontes" / f"{v}.mp4")]
    saidas = []
    for q, (tp, v, de, ate, em) in enumerate(pista):
        src = 0 if tp == "voz" else idx[v]
        g.append(f"[{src}:a]atrim={de:.3f}:{ate:.3f},asetpts=N/SR/TB,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.01,afade=t=out:st={max(0, ate - de - 0.03):.3f}:d=0.03,adelay={round(em * 1000)}:all=1[p{q}]")
        saidas.append(f"[p{q}]")
    g.append(f"{''.join(saidas)}amix=inputs={len(saidas)}:normalize=0:duration=longest,apad=whole_dur={t_total:.3f},atrim=0:{t_total:.3f}[a]")
    (BUILD / "_audio.txt").write_text(";\n".join(g), encoding="utf-8")
    wav = BUILD / "audio-bruto.wav"
    ff([*ents, "-filter_complex_script", str(BUILD / "_audio.txt"), "-map", "[a]", "-c:a", "pcm_s24le", str(wav)])
    (BUILD / "_audio.txt").unlink()
    ff(["-i", str(mudo), "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(EP / "bruto.mp4")])

    # 3. o que a mixagem precisa
    def frances(x):
        # a voz lê "fait?" sem espaço; a legenda francesa leva espaço antes de ? ! : ;
        return re.sub(r"(?<=\w)([?!:;])", lambda m: " " + m[1], x)

    def ts(x):
        ms = max(0, round(x * 1000))
        return f"{ms // 3600000:02d}:{ms % 3600000 // 60000:02d}:{ms % 60000 // 1000:02d},{ms % 1000:03d}"
    (EP / "narracao.srt").write_text("\n".join(f"{i + 1}\n{ts(a_)} --> {ts(b_)}\n{frances(x)}\n" for i, (a_, b_, x) in enumerate(srt)), encoding="utf-8")
    (EP / "extraits.json").write_text(json.dumps(json_clips, indent=1, ensure_ascii=False), encoding="utf-8")
    (EP / "graficos.json").write_text(json.dumps(sorted(graficos, key=lambda x: x["t"]), indent=1, ensure_ascii=False), encoding="utf-8")
    soma = sum(n for b, n in video if b.get("clipe")) / FPS
    apoio = sum(n for b, n in video if (b.get("video") or b.get("foto")) and not b.get("clipe")) / FPS
    print(f"\nbruto.mp4: {int(t_total // 60)}:{int(t_total % 60):02d} · {len(video)} cenas · clipes {soma:.0f}s ({soma / t_total * 100:.0f}%) · fotos e vídeos com licença {apoio:.0f}s ({apoio / t_total * 100:.0f}%) · gráficos do canal {(t_total - soma - apoio):.0f}s")


if __name__ == "__main__":
    main()
