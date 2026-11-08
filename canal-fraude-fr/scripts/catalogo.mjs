// O SOM do canal: os efeitos do pacote, os climas da trilha e o casamento entre o que aparece na
// tela e o som que marca. Lido pelo sons.mjs (o que gerar), pelo analisar.mjs (onde pôr) e pelo mixar.mjs (quanto).
// Medido no AussieFiles (NDIS 289K, Penthouse 183K): pulso tenso constante, 6 a 10 efeitos por minuto, whoosh em
// toda entrada de telejornal, impacto no número, carimbo no estado jurídico, papel no documento, obturador na foto.

// nome: { p: prompt em inglês para o ElevenLabs, s: segundos, db: nível na mixagem (o arquivo tem pico -1 dBFS),
//         pri: prioridade quando dois efeitos disputam o mesmo segundo (maior fica) }
export const EFEITOS = {
  sub: { p: 'deep cinematic sub bass drop hit, short low boom, documentary cold open, no music', s: 2.5, db: -7, pri: 9 },
  impact: { p: 'heavy cinematic impact hit with a short dark tail, for a big money number slamming on screen, news documentary', s: 1.8, db: -9, pri: 8 },
  sting: { p: 'short dark news sting, low synth hit with a quick metallic shimmer, chapter title card, investigative documentary', s: 2, db: -11, pri: 6.5 },
  whoosh: { p: 'fast clean whoosh transition, airy swipe, modern news documentary graphic, no music', s: 1, db: -15, pri: 6 },
  'whoosh-grave': { p: 'low deep smooth whoosh into news footage, short swoosh with soft low end, no music', s: 1.2, db: -13, pri: 8 },
  corte: { p: 'very short soft swish for a quick cut, subtle, no music', s: 0.5, db: -21, pri: 5 },
  ding: { p: 'short bright digital chime for a number counter reveal on screen, clean news graphic, single', s: 0.8, db: -18, pri: 5 },
  tampon: { p: 'heavy rubber stamp slammed hard on paper on a wooden desk, single thud, close, dry', s: 0.8, db: -10, pri: 7 },
  papier: { p: 'sheet of paper sliding across a desk, official document reveal, soft paper rustle, close', s: 1.2, db: -16, pri: 4 },
  billets: { p: 'banknotes being counted quickly by hand, flick of euro cash bills, close, short', s: 1.5, db: -17, pri: 4 },
  obturateur: { p: 'single camera shutter click, DSLR, dry, close', s: 0.5, db: -15, pri: 4 },
  bip: { p: 'short soft digital blip for a lower third name title appearing, clean user interface', s: 0.5, db: -20, pri: 3 },
  glitch: { p: 'short subtle digital glitch stutter, data corruption, sharp, quiet', s: 0.5, db: -20, pri: 2 },
  clavier: { p: 'fast typing on a computer keyboard, short burst, close, dry office', s: 1.5, db: -20, pri: 3 },
  carte: { p: 'soft digital map zoom swoosh with light data blips, user interface, clean', s: 1.2, db: -17, pri: 4 },
  tic: { p: 'clock ticking, dry, close, steady, six ticks', s: 3, db: -23, pri: 2 },
  cta: { p: 'soft clean user interface notification pop, subscribe button click, short', s: 0.6, db: -17, pri: 6 },
  riser: { p: 'tension riser, dark synth swell rising in pitch with fast ticking, ends abruptly', s: 4, db: -13, pri: 9 },
  fin: { p: 'final heavy cinematic thud with a low reverb tail, documentary ending, no music', s: 3.5, db: -7, pri: 10 },
};

// O que a montagem pôs na tela (graficos.json → tipo) e o som que marca.
export const TIPO_SOM = {
  'chiffre-titre': 'impact', chiffre: 'ding', argent: 'billets', document: 'papier', photo: 'obturateur',
  nom: 'bip', tampon: 'tampon', carte: 'carte', chrono: 'tic', ecran: 'clavier', chapitre: 'sting',
  transition: 'whoosh', cta: 'cta', glitch: 'glitch',
};
// os sons que marcam algo VISÍVEL: o analisar encosta no corte de cena mais próximo e põe na folha de conferência
export const VISUAIS = new Set(['impact', 'ding', 'tampon', 'papier', 'billets', 'obturateur', 'bip', 'carte', 'clavier', 'sting']);

// A trilha: uma biblioteca do canal (CANAL\_trilhas\<clima>-NN.mp3), toda no mesmo synth investigativo escuro para
// soar como um canal só. A espinha é o "enquete"; os outros mudam a intensidade como o AussieFiles faz por seção.
const BASE = 'instrumental cinematic investigative news documentary score, dark minor key, modern synths, no vocals, no drops, no big build ups, clinical and steady, made to sit under narration';
export const CLIMAS = {
  ouverture: `${BASE}, cold open, low sub drone with a distant slow pulse, sparse ticking, ominous, no melody`,
  mecanisme: `${BASE}, explainer pulse around 110 bpm, precise plucked synth motif, light ticking percussion, curious, slightly melodic`,
  enquete: `${BASE}, steady pulsing synth bass around 115 bpm, ticking hi-hats, tight claps on the backbeat, shimmering high textures, urgent but controlled`,
  tension: `${BASE}, police raids and arrests, faster ticking and busier percussion around 125 bpm, staccato strings, driving low synth, high tension`,
  grave: `${BASE}, somber, victims and consequences, slow around 80 bpm, sparse low piano notes over dark pads, restrained, no drums`,
  verdict: `${BASE}, conclusion, the main pulse returns around 115 bpm, fuller and determined, low brass-like synth swells, steady to the end`,
};
