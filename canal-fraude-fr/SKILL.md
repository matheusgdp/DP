---
name: canal-fraude-fr
description: >-
  Faz a EDIÇÃO DE SOM de um canal faceless de YouTube em FRANCÊS da França sobre fraude e desvio de
  dinheiro público contados com narração, cartões do canal, documentos recriados, diagramas e fotos COM LICENÇA, sem
  nenhum trecho de TV, ~10 min por dia, a mecânica do AussieFiles):
  EFEITOS SONOROS, TRILHA SONORA e MIXAGEM no padrão sonoro medido no @AussieFilesTV — pulso investigativo de synth
  constante, climas que mudam por bloco do roteiro (ouverture, mecanisme, enquete, tension, grave, verdict), trilha
  ~20 dB sob a voz e mais baixa sob o telejornal, o "stop-start" antes do trecho que responde, whoosh na entrada de
  cada telejornal, impacto no número, carimbo no estado jurídico, papel no documento, obturador na foto, 6 a 10
  efeitos por minuto, riser e impacto final. A partir do BRUTO montado (narração + telejornal, sem trilha nem
  efeitos) e do .srt, escreve o PLANO SONORO (detecta os trechos de telejornal, encosta cada efeito no corte de cena,
  monta a folha de conferência com um quadro por efeito), revisa contra o roteiro e as regras da imprensa francesa
  (nada sobre a presunção de inocência, nenhum carimbo antes do estado jurídico real, nenhum som cômico), nivela o
  telejornal com a narração, mixa a -14 LUFS e entrega o final.mp4, as pistas separadas e o relatório. O pacote de
  efeitos (ElevenLabs) e a biblioteca de trilhas (Suno) são do canal, gerados uma vez pela ai33.pro. Serve para o
  longo 16:9 e para os Shorts 9:16. Use sempre que a pessoa falar em "sonoplastia",
  "efeitos sonoros do canal", "trilha do canal", "mixa o vídeo", "põe trilha e efeitos", "edição de som", "sound design
  do canal francês de fraude", "estilo aussiefiles", ou entregar um bruto do canal para
  sonorizar, mesmo sem dizer o nome da skill. Também faz o vídeo inteiro desde o começo: PAUTA, FICHA de fontes, ROTEIRO
  em francês (o que a TV apurou vira narração atribuída), TÍTULO, NARRAÇÃO (ai33/ElevenLabs), IMAGENS com licença
  registrada (Pexels, Wikimedia CC0/CC BY), MONTAGEM (cartões, documento recriado, diagrama do mecanismo, fotos), THUMBNAIL
  em código e PUBLICAR.md, sempre com o estado jurídico francês exato. Gatilhos também: "vídeo do
  canal de fraude", "pauta do canal", "roteiro do canal", "próximo dossier", "faz o dossier". Não usa imagem de IA e não
  sobe no YouTube.
argument-hint: "[pasta do vídeo em CANAL\\videos, ou \"pacote\" / \"trilhas\" para preparar o som do canal]"
---

# Canal de fraude (França) — do roteiro ao vídeo mixado

O som do canal copia a **estrutura** sonora do AussieFiles (0 a 1,37M views em 18 dias), medida nos dois vídeos mais vistos dele: um pulso investigativo que nunca para, o telejornal sempre por cima, um efeito marcando cada coisa que entra na tela. O detalhe medido, e o que muda na França, está em [references/dna-sonoro.md](references/dna-sonoro.md). **Leia antes do primeiro vídeo.**

A skill tem duas portas: quem traz um bruto vai direto ao som (passos 0 a 3); quem pede um vídeo começa na pré-produção (A1 a A5) e na montagem (M1 a M5). O blueprint completo está em [references/blueprint.md](references/blueprint.md).

## O formato: nada de TV, toda imagem com licença

O canal não usa trecho de telejornal nem imagem de terceiros sem licença clara. Na França não há fair use: a exceção de citação exige que o trecho seja comentado, não usado para contar a história, e emissoras reivindicam e derrubam vídeos. Um canal diário feito de clipes acumula claims e strikes, e arrisca a recusa da monetização por "conteúdo reutilizado". O que a reportagem apurou entra como **fato atribuído na narração** ("selon franceinfo…"): fato não tem dono, a filmagem tem.

Na tela só entra:
- **Cartões do canal** (`montar.py`): número, pergunta, texto, citação, pessoa, rota, linha, barra, lados, quadro, e os do formato v2: `documento` (fatura, receita ou laudo **recriado**, com o selo RECONSTITUTION · DOCUMENT FICTIF) e `fluxo` (o mecanismo em nós e setas, aparecendo seta a seta).
- **Fotos com licença** (`imagens.py`): Pexels, ou Wikimedia Commons em CC0, domínio público ou CC BY. Nunca CC BY-SA, ND ou NC.
- **Vídeo de órgão público**, só com a licença declarada no próprio vídeo ou no site (Licence Ouverte, CC BY) ou com autorização escrita do PRADA guardada na pasta. Produzido pelo próprio órgão (sem trecho de TV, música de terceiros ou crédito de produtora), sem pessoa identificável além de autoridade falando em público, agente em operação borrado, crédito "Source : <órgão>, <data>", sem logo do órgão na thumbnail, corte que não muda o sentido. Entra à mão em `licencas.json` com `licenca`, `pagina`, `acesso` e `prova` (cópia da página de avisos legais).

A montagem lê `licencas.json` e **para** se alguma foto ou vídeo do plano não tiver licença aceita.

Fotos de banco, regras aprendidas na prática:
- **Sem rosto identificável** num vídeo de fraude: a licença da Pexels proíbe mostrar pessoa reconhecível sob luz negativa, e uma legenda do caso sobre um rosto vira acusação. Prefira objeto, mão, costas, fachada.
- **Sem marca legível**: logo de grife nos óculos, nome de loja ou café, nome bordado em jaleco. Olhe a foto em tamanho cheio, não só a folha.
- Foto genérica sob um fato do caso leva "image d'illustration" na legenda.
- Texto citado (comunicado, fala de autoridade a um jornal) vai em `citacao`, curto, com quem disse e a quem.

## Pré-produção

O risco deste formato é legal: um nome, um valor ou um estado jurídico errado custa mais do que um vídeo fraco. Nenhum passo afirma o que a fonte não afirma; o que não foi confirmado fica marcado na ficha.

**A1. Pauta.** Filtro do blueprint: dinheiro público ou de cidadãos comuns, escala nacional ou regional, mais de 1 M€, alguém interpelado, mis en examen, julgado ou condenado. Pesquise o andamento de hoje. O caso precisa de fonte escrita sólida (comunicado, AFP, imprensa especializada); imagem não é critério, porque o vídeo é feito de cartões. Procure também vídeo oficial com licença (coletiva do parquet, gendarmerie, Assemblée). Devolva 3 opções com gancho, valor, estado jurídico e as fontes escritas achadas. O banco do blueprint envelhece: procure também casos novos.

**A2. Ficha (`ficha.md`).** Cada fato com a fonte: oficial + 2 veículos. Para cada pessoa: estado jurídico exato e datado, resposta da defesa ou registro de que não foi achada. Divergência de número vira tabela com a decisão. Fonte não lida diretamente fica listada para conferência humana.

**A3. Roteiro (`roteiro.md`).** Estrutura no blueprint. Cerca de 1.300 palavras dão perto de 9 min de narração; blocos com `## `. Frases com menos de 20 palavras, pergunta ponte a cada 20–40 s. Sem marcas `[EXTRAIT]`: o que uma reportagem mostrou é contado e atribuído ("Selon le reportage de franceinfo…"), com o número do documento, não o falado. Reportagem de outro caso continua dita como outro caso.
- **Para a voz:** números por extenso e **sem espaço antes de `? ! : ;`** (a montagem repõe o espaço na legenda). Sem aspas francesas.
- **Frases que marcam o som:** "présumées innocentes" (aviso), "abonnez-vous" (CTA 1), "commentaire" e "quel dossier" (CTA 2).
- **Confira:** ninguém é chamado de coupable ou escroc sem condenação definitiva; condenado em primeira instância com recurso ainda é presumido inocente; "selon le parquet/la gendarmerie" em cada acusação; ninguém nomeado se a fonte não nomeou; reportagem de outro caso é dita como outro caso.

**A4. Título e thumbnail (`thumb.md`).** Fórmula no blueprint: 60–95 caracteres, até 2 palavras em CAPS além do valor, "présumée" enquanto não houver julgamento. 3 títulos, 1 recomendado.

**A5. `PUBLICAR.md`.** Título e alternativos, descrição (resumo, fontes com link, frase de presunção de inocência, contato para resposta), capítulos, tags, hashtags (#<NomeDoCanal>, #fraude, tema) e o checklist: audição, advogado francês de direito de imprensa, andamento rechecado no dia, conteúdo sintético declarado.

## Do roteiro ao bruto

**M1. Voz.** `python "SK/scripts/roteiro_json.py" EP --voz <canal.json → voz>` e `node "SK/scripts/voz.mjs" EP` (gasta créditos ao ser chamado; roteiro sem mudança não é narrado de novo). Mais vozes: `node "SK/scripts/voz.mjs" --vozes`.

**M2. Imagens.** `python "SK/scripts/imagens.py" EP "eyeglasses store"` (Pexels) e `--commons "Tribunal de Paris"` (Commons, já filtrado por licença). Cada busca baixa em `EP\fontes\img\`, registra em `EP\licencas.json` e faz a folha `build\fotos-<termo>.jpg`: **abra a folha** e escolha pelos ids. `--lista` mostra o que está registrado. Reportagem de TV só se baixa para ler e transcrever (`yt-dlp` + `fontes.py`), nunca para a tela. Se o `yt-dlp` pedir "confirm you're not a bot", espere e tente de novo com pausas, sem usar os cookies do navegador da pessoa.

**M3. Plano visual (`plano-visual.json`).** `caso` traz "DOSSIER 014"; `clipes` fica `[]`. `cenas` traz, por trecho de narração, as imagens ancoradas numa frase (`em`), uma troca a cada 4–7 s. Tipos:
- `foto`: `foto` (id do `licencas.json`), `legenda`, `mov` (`in`/`out`), `foco` [x, y]. O crédito sai sozinho.
- `documento`: `titulo`, `cabecalho` [linhas], `linhas` [[descrição, valor]], `total` [rótulo, valor], `destaque` (índice ou `"total"`, circulado em vermelho), `texto` ao lado. Valor que a fonte não deu fica `···`: o documento recriado não inventa número.
- `fluxo`: `nos` (2–4), `setas` [[de, para, rótulo]] (ida em cima, volta embaixo), `ativa` (quantas setas já aparecem; repita o cartão com `ativa` maior para animar), `texto`.
- os cartões `numero`, `pergunta`, `texto`, `citacao`, `pessoa`, `rota`, `linha`, `barra`, `lados`, `quadro`.
- `carimbo` mostra o estado jurídico; `bg: {"foto": id}` põe a foto desfocada e escurecida atrás do cartão; `grafico` diz o efeito (tipos em [references/plano-sonoro.md](references/plano-sonoro.md)).
- `video` (com `de`, `ate`) só para vídeo de órgão público registrado em `licencas.json`.

Regras (vieram de erros reais; erro de imagem aqui é problema jurídico):
- Vídeo público: a janela fica dentro de um único plano de câmera (`<id>.cortes.json`, `folha_pontas.py`) e termina no fim real da última palavra (`words.json`).
- Sem pessoa algemada ou em viatura (proibido na França sem consentimento antes de condenação) e sem painel com fotos de acusados. Quem não foi condenado aparece em cartão com nome e estado jurídico.
- Legenda nunca responde sobre um rosto. Sem pessoa alheia ao caso sob legenda do caso.
- Documento na tela conta como nomear. Dados pessoais nunca.
- Número da reportagem que diverge do oficial (franceinfo disse "100 millions"; a gendarmerie, ~12 M€ por ano): fica de fora ou vai como divergência na ficha.
- Número na tela da reportagem que diverge do falado (a repórter disse 480,91; a fatura mostrava 481,91): use o do documento.
- Número da imprensa que o comunicado oficial não traz (1,3 M€ apreendidos, contra "mais de 700 mil" atribuídos à gendarmerie): sem número na fala até alguém ler o oficial.
- Nome próprio difícil ("Beccuau" saiu "Bécoq"): compare `narracao-transcricao.json` com o roteiro depois de narrar; se errar, tire o nome da fala e ponha na tela.
- O `analisar` não sabe os blocos reais: na revisão, troque os climas pelas frases do roteiro e acrescente `whoosh` nas trocas de cartão até 6–10 efeitos/min.

**M4. Montar.** `python "SK/scripts/montar.py" EP`. Confere as licenças, escreve `bruto.mp4`, `narracao.srt`, `extraits.json` (vazio) e `graficos.json`, com cache por cena. **Olhe um quadro de cada cena** antes do som: crédito legível, nenhuma marca, nenhum rosto.

**M5. Thumbnail.** `python "SK/scripts/thumb.py" EP --foto fontes\img\<id>.jpg --objeto <quadro de um cartão documento> --valor "36 M€" --carimbo "..." --caso "DOSSIER 001"`. Foto com licença registrada, sem rosto, sem marca; o objeto de prova é o documento recriado. Carimbo com o estado real. Confira o `build\thumb-a-168.png`.

**Antes de publicar:** suba o vídeo como **privado** e espere a verificação de direitos autorais do YouTube. Qualquer reivindicação aparece ali, sem strike; troque a imagem e suba de novo.

## Pastas

```
CANAL\                                         ← o canal (canal.json)
  _sons\<efeito>.wav                            ← pacote de efeitos, uma vez (ElevenLabs)
  _trilhas\<clima>-NN.mp3                       ← biblioteca de trilhas, uma vez (Suno)
  videos\014-maprimerenov-27m\
    ficha.md  roteiro.md  thumb.md  PUBLICAR.md                    ← pré-produção
    fontes\<id>.mp4  roteiro.json  narracao.mp3  plano-visual.json ← voz e montagem
    bruto.mp4  narracao.srt  [graficos.json]  [extraits.json]     ← da montagem
    plano-sonoro.json  build\folha-NN.jpg                          ← analisar
    final.mp4  audio\mix.wav  audio\stems\  relatorio-som.md       ← mixar
```

`SK` = a pasta desta skill (ex.: `~/.claude/skills/canal-fraude-fr`). `CANAL` = a pasta do canal, com um `canal.json` (modelo em `canal.exemplo.json`). Os scripts acham o canal subindo da pasta do vídeo até o `canal.json`; fora dela, use `--canal` ou a variável `CANAL_DIR`.

## A chave e os créditos

Tudo que é gerado vem da **ai33.pro** com uma chave só: `AI33_API_KEY`, lida do ambiente. Nunca escreva a chave em arquivo nem a repita na conversa. Se faltar, peça para a pessoa rodar `setx AI33_API_KEY "…"` no PowerShell e reabrir o VS Code.

Os scripts de geração **só gastam com `--gerar`**. Sem ele, mostram o que fariam e os créditos da conta. Antes de qualquer `--gerar`, diga o que vai ser gerado e espere o "pode". A mixagem não gasta nada.

## 0. Preparar o som do canal (uma vez)

```bash
node "SK/scripts/sons.mjs" pacote            # lista os 19 efeitos que faltam e os créditos
node "SK/scripts/sons.mjs" pacote --gerar    # gera em CANAL\_sons (pico -1 dBFS, 48 kHz)
node "SK/scripts/sons.mjs" trilha            # 6 climas, 1 pedido ao Suno cada (2 tomadas de 2–4 min)
node "SK/scripts/sons.mjs" trilha --gerar
```

- Peça para a pessoa **ouvir** as duas pastas antes do primeiro vídeo. Efeito ruim: `pacote --so tampon --refazer --gerar`. Trilha ruim: apague a tomada e rode `trilha --so enquete --gerar` (acrescenta 2 tomadas).
- O `enquete` é a espinha e toca na maior parte do vídeo: vale ter 4 tomadas (`trilha --so enquete --pedidos 1 --gerar` uma segunda vez). As tomadas giram entre os vídeos, então o canal não soa repetido.
- Clima sem tomada → a mixagem usa o `enquete` e avisa.
- Rode os comandos de dentro da pasta do canal ou passe `--canal "<pasta do canal>"`.

## 1. Analisar (por vídeo)

Confira que a pasta tem `bruto.mp4` (narração + telejornal, **sem** trilha nem efeitos) e `narracao.srt` **nos tempos do bruto**. O que a montagem pode entregar a mais (`graficos.json`, `extraits.json`) está em [references/plano-sonoro.md](references/plano-sonoro.md). Peça o `graficos.json` se a montagem consegue exportar: os efeitos visuais ficam exatos.

```bash
node "SK/scripts/analisar.mjs" "CANAL\videos\014-…"            # longo
node "SK/scripts/analisar.mjs" "CANAL\videos\014-…\short-1"    # Short (≤ 75 s vira perfil short sozinho; ou --short)
```

Escreve `plano-sonoro.json` em rascunho: os trechos de telejornal, a linha de climas (estrutura do blueprint escalada à duração), o aviso de presunção de inocência achado no .srt, os efeitos encostados nos cortes de cena e a folha `build\folha-NN.jpg`. Se o resumo diz "NÃO ACHEI a frase présumé(e)s innocent(e)s", avise a pessoa: o roteiro do canal exige essa frase.

## 2. Revisar o plano (sempre: o Claude, antes de mixar)

Vídeo sem telejornal: comece por `python "SK/scripts/revisar_som.py" EP --climas <um por bloco do roteiro> --viradas "<texto do cartão>" …`. Ele põe os climas no começo real de cada bloco, o stop-start antes das viradas e whoosh/tic nas trocas de imagem até 10 por minuto. Depois siga a revisão abaixo e tire `"rascunho": true`.

Siga a revisão de [references/plano-sonoro.md](references/plano-sonoro.md): confira os telejornais contra o roteiro, ajuste os climas (`tension` nas batidas e na virada, `grave` nas vítimas, `verdict` no fim), **abra a folha** e apague todo efeito `confirmar` que a tela não mostra, aplique as regras duras. Mostre à pessoa um resumo de uma tela e o que mudou. Depois tire `"rascunho": true`.

## 3. Mixar

```bash
node "SK/scripts/mixar.mjs" "CANAL\videos\014-…"
```

- Diálogo: narração a −16 LUFS, cada telejornal a −17 (som original, só passa-alta).
- Trilha: climas emendados com crossfade, ducking sob o diálogo, −6 dB extra sob o telejornal, −3 dB no aviso, silêncios, saída no `fin`; **calibrada por medição** a −20 dB sob a voz (Short −16).
- Efeitos no nível do catálogo. Master −14 LUFS / −1 dBTP. Vídeo copiado do bruto, áudio AAC 320 kbps.
- Sai: `final.mp4`, `audio\mix.wav`, `audio\stems\` (diálogo, trilha, efeitos, para ajuste no editor) e `relatorio-som.md` (níveis medidos, efeitos por minuto, os pontos para ouvir, avisos).

Leia os avisos do relatório e resolva os que forem de regra (efeito dentro do telejornal, carimbo não confirmado, densidade). Diga à pessoa os pontos para ouvir que o relatório lista. Ajustes depois de ouvir: tabela no fim de [references/plano-sonoro.md](references/plano-sonoro.md). Mudou o plano ou o `canal.json`? Rode só o `mixar` de novo.

## Entrar no meio

| A pessoa tem / quer | Faça |
|---|---|
| Só preparar o canal | passo 0 |
| Um plano já revisado e mudou algo | só o passo 3 |
| Mudou a montagem (tempos novos) | `analisar --refazer`, revisar, mixar |
| Só a trilha, sem efeitos | esvazie `efeitos` no plano e mixe |
| Só um efeito novo para o canal | acrescente em `EFEITOS` no `catalogo.mjs` (prompt em inglês, segundos, db, prioridade) e `pacote --so <nome> --gerar` |

## Não faça

- Não ponha trecho de TV, nem foto ou vídeo fora do `licencas.json`. A montagem recusa; não contorne a trava.
- Não ponha música ou efeito de banco de terceiros: tudo é do pacote e da biblioteca do canal (sem Content ID).
- Não mixe um plano em rascunho sem revisar a folha.
- Não toque no conteúdo do telejornal (sem cortar, acelerar ou "limpar" a fala): o nivelamento é só de volume.
- Não reutilize a voz, os efeitos ou a trilha de outro canal seu: cada canal tem a própria marca sonora.
