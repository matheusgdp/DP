# O DNA sonoro (medido no AussieFiles, adaptado ao canal francês)

Fonte: os dois vídeos mais vistos do @AussieFilesTV, ouvidos inteiros com análise de áudio (nov/2026): "NDIS ROBBED Of $3.6 BILLION…" (289K, 10:16) e "Sydney's Penthouse Syndicate EXPOSED…" (183K, 8:52). Copiamos a **estrutura** do som, não as faixas.

## O que o AussieFiles faz

| Elemento | Medido | No canal |
|---|---|---|
| Trilha | Synth investigativo escuro, tom menor, pulso constante 110–130 bpm, tique de hi-hat, claps no contratempo, brilho agudo. Nunca para; não tem "drop" | Biblioteca própria no Suno, climas no mesmo timbre (`catalogo.mjs → CLIMAS`) |
| Abertura | Drone grave + sub-impacto no 0:00; o pulso principal entra quando o narrador começa | Clima `ouverture` no cold open + `sub` em 0:00; `mecanisme` entra com a primeira frase |
| Mudança por seção | A intensidade muda por bloco: mais tique e percussão na batida policial, mais melódico no explicativo, mais baixo e sombrio no "caso paralelo", volta ao tema na conclusão | `mecanisme` → `enquete` → `tension` (virada, batidas) / `grave` (vítimas) → `verdict` |
| Nível | Trilha 18–22 dB sob a narração; plana, "clínica" | Calibrada por medição: −20 dB sob a voz (Short: −16) |
| Sob o telejornal | A trilha **abaixa mais 5–10 dB**, não some | −6 dB extra sob cada trecho; muda (−40) se o trecho tem música própria |
| Respiros | A trilha cresce nas pausas da narração e nas passagens só visuais | Ducking com release de 500 ms: a trilha volta sozinha nas pausas |
| Stop-start | A trilha cai a zero por uma fração de segundo antes de um trecho de impacto | `silencios`: 0,35–0,45 s entre a pergunta do narrador e o telejornal que responde (no máximo 1 a cada 90 s) |
| Densidade | 6–10 efeitos por minuto | Teto de 10/min (Short 13), 0,9 s mínimo entre dois efeitos, 4 s entre dois iguais |
| Entrada do telejornal | Whoosh grave + crossfade de 2–5 quadros; o primeiro som do trecho cola na última palavra do narrador | `whoosh-grave` 0,12 s antes do corte; nivelamento com rampa de 60 ms |
| Número na tela | Impacto/sub no número grande; "ding" de contador nos números secundários | `impact` no primeiro valor e em todo "milliard"; `ding` nos demais |
| Carimbo | Baque pesado de carimbo ("Traces of Fraud") | `tampon`, só com o estado jurídico certo na tela |
| Documento, fatura, citação | Papel deslizando | `papier` |
| Dinheiro mostrado | Contagem de cédulas | `billets`, só dinheiro apreendido |
| Foto | Obturador de câmera | `obturateur` |
| Nome / lower third / marca | Bip ou glitch digital curto | `bip` (o `glitch` é reserva) |
| Digital (IA, sites, contas) | Teclado | `clavier` |
| Capítulo | Impacto grave + whoosh | `sting` na troca de clima |
| Saída | O pulso segue no máximo; riser no CTA final; baque pesado no logo/tela preta; corte rápido para o silêncio | `riser` terminando no `fin`; a trilha some em 1,8 s depois do `fin` |
| Áudio do telejornal | Original, "mais fino" que a narração, sem limpeza | Só passa-alta de 60 Hz e nível −17 LUFS (1 dB sob a voz) |
| Narração | Masculina, grave, seca (sem reverb), comprimida, 140–150 palavras/min | É da montagem; aqui só vai a −16 LUFS |
| Loudness | ~−14 LUFS | −14 LUFS integrado, −1 dBTP |

## O que é só da França

- **Presunção de inocência soa sóbria.** A frase do aviso tem a trilha −3 dB e nenhum efeito por cima: ninguém pode ouvir ironia ali.
- **Sem som que acusa.** Carimbo `tampon` só com o estado jurídico exato na tela (CONDAMNÉ só com sentença; "condamné en première instance" com apelação pendente). Um baque de carimbo sobre a cara de alguém só interpelado vende culpa.
- **Sem som que zomba.** Nada de caixa registradora, risada, "fail" ou efeito cômico. Contagem de cédulas só sobre dinheiro apreendido, nunca sobre as economias das vítimas.
- **Vítimas em `grave`.** Quando o roteiro fala das famílias endividadas, o pulso sai e entram pads e piano esparsos (é também onde o "et ce sont nos cotisations qui ont payé" pousa).
- **Marca própria.** Nenhum som igual ao de outro canal seu. Se um dia houver vinheta sonora do canal, ela entra no `sting`.

## Content ID

Tudo o que esta skill põe no vídeo é gerado pela ai33 (ElevenLabs e Suno) na conta do canal: nenhuma faixa de banco, nenhum efeito de terceiros, nada que gere reivindicação. As reivindicações que vierem serão das emissoras pelos trechos de telejornal (ver o blueprint: 8–20 s, fonte na tela, trocar a emissora que bloqueia). Se um trecho de telejornal traz a música da própria reportagem, marque `musica_propria: true`: nossa trilha some ali e não briga com ela.
