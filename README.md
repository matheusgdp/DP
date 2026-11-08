# canal-fraude-fr

Uma skill do [Claude Code](https://claude.com/claude-code) que produz vídeos de YouTube faceless em francês sobre fraude e desvio de dinheiro público na França. Ela leva da pauta ao `final.mp4` mixado, com thumbnail e pacote de publicação.

O formato não usa nenhum trecho de TV. Na tela entram só:
- cartões do canal;
- documentos recriados, com o selo "RECONSTITUTION · DOCUMENT FICTIF";
- diagramas do mecanismo da fraude;
- fotos com licença registrada.

O que uma reportagem apurou entra na narração, com a fonte citada.

## O que tem aqui

| Arquivo | Para quê |
|---|---|
| `canal-fraude-fr/SKILL.md` | O fluxo completo: pauta, ficha de fontes, roteiro, voz, imagens, montagem, som, mixagem e publicação |
| `references/blueprint.md` | A estratégia: tese, mercado, banco de pautas, fórmula de título, thumbnail, estrutura do roteiro, jurídico francês e métricas |
| `references/dna-sonoro.md` | O padrão sonoro medido no canal de referência e o que muda na França |
| `references/plano-sonoro.md` | Como revisar o plano de efeitos e de trilha antes de mixar |
| `scripts/` | O pipeline (abaixo) |
| `canal.exemplo.json` | O modelo da configuração do canal |

## Pipeline

```
roteiro_json.py → voz.mjs → imagens.py → plano-visual.json → montar.py
  → analisar.mjs → revisar_som.py → mixar.mjs → thumb.py
```

- **`imagens.py`** busca no Pexels e no Wikimedia Commons e aceita só Pexels, CC0, domínio público e CC BY. Cada imagem fica registrada em `licencas.json`.
- **`montar.py`** para se alguma foto ou vídeo do plano não tiver licença aceita.
- **`mixar.mjs`** entrega o master a −14 LUFS / −1 dBTP, a trilha calibrada a cerca de 20 dB sob a voz e as pistas separadas.

## Requisitos

- Python 3 com Pillow, Node 18 ou mais novo, e o `ffmpeg` no PATH.
- O Whisper (`transcrever.py`), para conferir a narração.
- Variáveis de ambiente:
  - `AI33_API_KEY` ([ai33.pro](https://ai33.pro)), para voz, efeitos e trilha;
  - `PEXELS_API_KEY`, para as fotos.

  Nenhuma chave fica gravada em arquivo.

## Instalação

1. Copie `canal-fraude-fr/` para `~/.claude/skills/`.
2. Crie a pasta do canal com um `canal.json` (copie o `canal.exemplo.json` e preencha nome, handle e voz).
3. Prepare o pacote de efeitos e a biblioteca de trilhas uma vez:

   ```
   node scripts/sons.mjs pacote --gerar
   node scripts/sons.mjs trilha --gerar
   ```

## Aviso

O conteúdo jurídico (presunção de inocência, lei de imprensa de 1881, direito de imagem, licenças) é um mapa do que conferir. Não é parecer jurídico. Antes de publicar acusações, consulte um advogado francês de direito de imprensa.
