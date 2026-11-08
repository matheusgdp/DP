# O plano sonoro: formato, revisão e o que a montagem pode entregar

## O que a montagem entrega (na pasta do vídeo)

| Arquivo | Obrigatório | O que é |
|---|---|---|
| `bruto.mp4` | sim | O vídeo montado: narração + trechos de telejornal com o som original + gráficos. **Sem trilha e sem efeitos.** 16:9 (longo) ou 9:16 (Short) |
| `narracao.srt` | sim | A legenda da narração **nos tempos do bruto** (não da narração solta: com os trechos de telejornal no meio, os tempos mudam). Só a narração; as falas do telejornal não entram |
| `graficos.json` | não, mas melhora muito | O que entra na tela e quando: `[{ "t": 12.4, "tipo": "chiffre-titre", "texto": "27 M€" }, …]`. Tipos: `chiffre-titre`, `chiffre`, `argent`, `document`, `photo`, `nom`, `tampon`, `carte`, `chrono`, `ecran`, `chapitre`, `transition`, `cta`, `glitch`. Um `"som": "<efeito>"` força outro efeito |
| `extraits.json` | não | Onde está cada trecho de telejornal: `[{ "de": 40.2, "ate": 52.8, "fonte": "BFMTV", "musica_propria": false }]`. Sem ele, os trechos saem dos buracos do .srt que têm som |

Com `graficos.json`, os efeitos visuais vêm da montagem (exatos). Sem ele, vêm do texto francês (valores em euro, estado jurídico, documento, foto, digital, dinheiro apreendido) e ficam marcados `"confirmar": true`.

## plano-sonoro.json

```json
{
  "rascunho": true,                       // tire depois de revisar
  "slug": "014-maprimerenov-27m", "perfil": "longo", "bruto": "bruto.mp4", "srt": "narracao.srt", "duracao": 612.4,
  "extraits": [{ "de": 0, "ate": 18.4, "fonte": "BFMTV", "musica_propria": false }],
  "trilha": {
    "trechos": [{ "de": 0, "ate": 18.6, "clima": "ouverture" }, { "de": 18.6, "ate": 118, "clima": "mecanisme" }],
    "baixar":   [{ "de": 52.1, "ate": 56.0, "db": -3, "motivo": "présomption d'innocence" }],
    "silencios": [{ "t": 81.2, "dur": 0.4 }],
    "sugestoes": [{ "t": 265, "clima": "grave", "por": "victimes", "no_trecho": "enquete" }]
  },
  "sem_efeitos": [{ "de": 52.1, "ate": 56.1, "motivo": "présomption d'innocence" }],
  "efeitos": [{ "t": 4.21, "som": "impact", "motivo": "27 millions", "no_corte": true, "db": 0 }],
  "fim": { "riser": 604.9, "fin": 608.9 }
}
```

- `efeitos[].db`: ajuste fino sobre o nível do catálogo (+3 mais alto, −4 mais baixo). `"desligado": true` desliga sem apagar.
- `no_corte`: o tempo foi encostado num corte de cena (o som bate no quadro em que o gráfico entra).
- `trechos`: o `de` de um é o `ate` do anterior; sem buracos. A troca leva `xfade` s de crossfade (2 s no longo) e um `sting`.

## A revisão (o Claude faz, sempre, antes de mixar)

1. **Telejornal.** Confira os `extraits` contra o roteiro (as marcas `[EXTRAIT : source, minutage]`): quantos são, onde. Um buraco de pausa longa da narração não é telejornal; um trecho com fala curtinha pode ter escapado. Preencha `fonte`. Trecho com a música da própria reportagem → `musica_propria: true`.
2. **Climas.** Leia o .srt e as `sugestoes`. Mova as fronteiras para o começo de frase que abre cada bloco do roteiro (cold open, contexto, CTA 1, carrossel, virada, situação judicial, CTA 2):
   - `tension` na batida policial, na interpelação, na virada (escala da história);
   - `grave` no bloco das vítimas e da conta que volta para o contribuinte;
   - `enquete` no resto do carrossel e na situação judicial;
   - `verdict` nos últimos ~30–40 s (CTA 2 e a fala final de autoridade).
   Trecho mínimo de 20 s (só a abertura e o fecho podem ser curtos). Não troque de clima mais de 5 vezes num vídeo de 10 min.
3. **Folha.** Abra `build/folha-NN.jpg` (Read). Cada quadro mostra o que está na tela 0,25 s depois do efeito. Para cada `confirmar`:
   - `tampon`: a tela mostra um carimbo, e com o estado jurídico CERTO? Se não, apague (ou troque por `bip` se é um nome na tela).
   - `papier`: há documento, relatório ou citação na tela? `obturateur`: foto? `clavier`: tela/site? `billets`: dinheiro apreendido (nunca as vítimas)?
   - Se a tela não mostra, apague. Se mostra 1–2 s depois, ajuste o `t`. Para ver um instante exato: `ffmpeg -ss <t> -i bruto.mp4 -frames:v 1 build/q.jpg` e Read.
4. **Regras duras** (o `mixar` também avisa):
   - nada dentro do telejornal além do whoosh de entrada e do corte de saída;
   - nada sobre a frase de presunção de inocência;
   - nenhum som cômico; `billets` nunca sobre vítimas; `tampon` nunca antes do estado jurídico real;
   - de 6 a 10 efeitos por minuto (o AussieFiles); abaixo de 5/min o vídeo fica "seco", acima de 12 vira ruído;
   - o primeiro número do título tem `impact` (ele é o valor da thumbnail).
5. **Mostre à pessoa** um resumo de uma tela: telejornais, linha de climas com os tempos, número de efeitos por tipo, o que você apagou ou mudou na folha e por quê. Depois tire `"rascunho": true` e rode o `mixar`.

## Ajustes depois de ouvir

| A pessoa diz | Mude |
|---|---|
| "a música está alta / baixa" | `canal.json → niveis.longo.sob_voz_db` (−20 padrão; −22 mais discreta, −18 mais presente) |
| "some demais no telejornal" | `niveis.longo.extrait_db` (−6 padrão; −3 abaixa menos) |
| "o telejornal está baixo" | `niveis.extrait_lufs` (−17 padrão; −16 = igual à narração) |
| "efeito X alto" | `db` naquele efeito, ou o `db` do som no `catalogo.mjs` (vale para o canal) |
| "a música desse trecho não combina" | troque o `clima` do trecho; ou gere outra tomada desse clima |
| "muitos efeitos" | apague os de prioridade baixa (`bip`, `clavier`, `ding`) primeiro |

Depois de mudar, rode só o `mixar` de novo (as camas de música ficam em cache em `build/`).
