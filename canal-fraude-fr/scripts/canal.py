"""O nome do canal para a faixa da tela e da thumbnail: "nome" do canal.json mais próximo acima da pasta do vídeo."""
import json, os, pathlib


def marca_do_canal(ep):
    d = pathlib.Path(ep).resolve()
    for p in [d, *d.parents][:7]:
        f = p / "canal.json"
        if f.exists():
            nome = json.loads(f.read_text(encoding="utf-8-sig")).get("nome")
            if nome:
                return nome.upper()
    return os.environ.get("CANAL_NOME", "MEU CANAL").upper()
