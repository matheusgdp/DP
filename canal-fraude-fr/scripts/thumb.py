"""A THUMBNAIL do canal, 1280x720, no template do blueprint.

  python thumb.py "EP" --foto frame.jpg --objeto notas.jpg --valor "36 M€" --carimbo "RENVOYÉS" --caso "DOSSIER 001" [--nome thumb-a]

  esquerda 55%   o frame (lugar ou prova; rosto só com aprovação jurídica)
  direita alto   o valor em amarelo
  direita baixo  o objeto de prova
  carimbo        o estado jurídico REAL do caso, inclinado
  canto          a faixa azul-marinho NOME DO CANAL / DOSSIER NNN

Sem logo de polícia, emissora ou empresa: recorte o frame antes. O valor é igual ao do título e ao da fala.
Sai também um teste de leitura em 168x94 (o tamanho da sugestão no celular).
"""
import argparse, math, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from canal import marca_do_canal  # noqa: E402
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

W, H = 1280, 720
F = "C:/Windows/Fonts/bahnschrift.ttf"
AMARELO, VERMELHO, ESCURO = (255, 208, 40), (226, 40, 46), (18, 42, 92)


def fonte(tam):
    f = ImageFont.truetype(F, tam)
    f.set_variation_by_axes([700, 75])
    return f


def cobre(foto, w, h, foco=(0.5, 0.5)):
    im = Image.open(foto).convert("RGB")
    e = max(w / im.width, h / im.height)
    im = im.resize((math.ceil(im.width * e), math.ceil(im.height * e)), Image.LANCZOS)
    x, y = int((im.width - w) * foco[0]), int((im.height - h) * foco[1])
    im = im.crop((x, y, x + w, y + h))
    return ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(1.15)).enhance(1.1)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("ep")
    ap.add_argument("--foto", required=True)
    ap.add_argument("--foco", default="0.5,0.5")
    ap.add_argument("--objeto", required=True)
    ap.add_argument("--valor", required=True)
    ap.add_argument("--carimbo", required=True)
    ap.add_argument("--caso", required=True)
    ap.add_argument("--nome", default="thumb-a")
    a = ap.parse_args()
    EP = pathlib.Path(a.ep).resolve()
    im = Image.new("RGB", (W, H), (14, 14, 16))
    esq = int(W * 0.55)
    im.paste(cobre(a.foto, esq, H, tuple(float(x) for x in a.foco.split(","))), (0, 0))
    # a emenda entre a foto e o painel escuro
    sombra = Image.new("L", (90, H), 0)
    ImageDraw.Draw(sombra).rectangle([0, 0, 90, H], fill=255)
    gr = Image.linear_gradient("L").rotate(90, expand=True).resize((90, H))
    im.paste((14, 14, 16), (esq - 90, 0), gr)
    d = ImageDraw.Draw(im)
    # o valor ocupa a largura do painel direito
    larg = W - esq - 30
    t = 260
    while d.textlength(a.valor, font=fonte(t)) > larg and t > 80:
        t -= 4
    f = fonte(t)
    d.text((esq + (W - esq) / 2 - 8, 14), a.valor, font=f, fill=AMARELO, anchor="ma", stroke_width=3, stroke_fill=(0, 0, 0))
    # o objeto de prova
    oy = 14 + int(t * 1.10)
    obj = cobre(a.objeto, W - esq - 40, H - oy - 28)
    d.rectangle([esq + 16, oy - 4, W - 16, H - 20], outline=(255, 255, 255), width=4)
    im.paste(obj, (esq + 20, oy))
    # o carimbo
    fc = fonte(92)
    # mede pelas letras de verdade: o acento de "RÉU" não pode encostar na borda
    x0, y0, x1, y1 = d.textbbox((0, 0), a.carimbo, font=fc)
    c = Image.new("RGBA", (x1 - x0 + 76, y1 - y0 + 64), (0, 0, 0, 0))
    dc = ImageDraw.Draw(c)
    dc.rounded_rectangle([5, 5, c.width - 6, c.height - 6], 10, fill=(255, 255, 255, 235), outline=VERMELHO + (255,), width=12)
    dc.text((38 - x0, 32 - y0), a.carimbo, font=fc, fill=VERMELHO + (255,))
    c = c.rotate(8, expand=True, resample=Image.BICUBIC)
    im.paste(c, (30, 36), c)
    # a faixa da marca
    fm = fonte(38)
    txt = f"{marca_do_canal(EP)}  /  {a.caso}"
    tw = d.textlength(txt, font=fm)
    d.rectangle([0, H - 66, tw + 56, H - 12], fill=ESCURO)
    d.rectangle([0, H - 66, 12, H - 12], fill=VERMELHO)
    d.text((32, H - 62), txt, font=fm, fill=(255, 255, 255))
    saida = EP / f"{a.nome}.jpg"
    im.save(saida, quality=93)
    im.resize((168, 94), Image.LANCZOS).save(EP / "build" / f"{a.nome}-168.png")
    print(f"{saida} ({saida.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
