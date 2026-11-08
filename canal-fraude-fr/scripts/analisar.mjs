#!/usr/bin/env node
// O PLANO SONORO em rascunho: lê o bruto montado (narração + trechos de telejornal, sem trilha nem efeitos) e o
// .srt da narração e escreve plano-sonoro.json com:
//   extraits  onde o telejornal fala (buracos do .srt com som; ou extraits.json da montagem, se existir)
//   trilha    os trechos de clima (estrutura do blueprint escalada à duração + gatilhos do texto), baixar, silencios
//   efeitos   os sons de cada momento (graficos.json da montagem, se existir; senão, pistas do texto francês),
//             encostados no corte de cena mais próximo, com a densidade do AussieFiles (até 10/min)
//   fim       riser + impacto final
// e build/folha-NN.jpg: um quadro do vídeo em cada efeito visual, para conferir que a tela mostra o que o som marca.
//   node analisar.mjs "EP" [--short] [--refazer] [--sem-cenas] [--sem-folha]
// Não sobrescreve um plano já revisado (sem "rascunho": true) sem --refazer.
import fs from 'node:fs';
import path from 'node:path';
import { posicional, tem, acharCanal, lerCanal, lerJSON, gravarJSON, ff, ffLer, duracao, lerSRT, mmss } from './comum.mjs';
import { EFEITOS, TIPO_SOM, VISUAIS } from './catalogo.mjs';

const EP = path.resolve(posicional()[0] || '.');
const CAN = lerCanal(acharCanal(EP));
const OUT = path.join(EP, 'plano-sonoro.json');
const velho = lerJSON(OUT);
if (velho && !velho.rascunho && !tem('refazer')) { console.log(`plano-sonoro.json já foi revisado. Para recomeçar do zero: --refazer.`); process.exit(0); }

const achar = (nomes, re, fora = []) => {
  for (const n of nomes) if (fs.existsSync(path.join(EP, n))) return n;
  return fs.readdirSync(EP).find(f => re.test(f) && !fora.includes(f.toLowerCase()));
};
const BRUTO = achar(['bruto.mp4', 'bruto.mov', 'bruto.mkv'], /\.(mp4|mov|mkv)$/i, ['final.mp4']);
const SRT = achar(['narracao.srt', 'narration.srt'], /\.srt$/i);
if (!BRUTO) throw new Error(`Falta o bruto em ${EP} (bruto.mp4: a montagem com narração e trechos, sem trilha nem efeitos).`);
if (!SRT) throw new Error(`Falta o .srt da narração em ${EP} (narracao.srt, alinhado ao bruto).`);
const FB = path.join(EP, BRUTO), D = duracao(FB), subs = lerSRT(path.join(EP, SRT));
const curto = tem('short') || D <= 75;
if (!subs.length) throw new Error(`${SRT} está vazio ou ilegível.`);
if (subs.at(-1).b > D + 2) console.log(`  ⚠ o .srt termina em ${mmss(subs.at(-1).b)} e o bruto em ${mmss(D)}: o .srt é do bruto montado ou só da narração? Os tempos precisam ser do bruto.`);
const r2 = x => Math.round(x * 100) / 100;

// 1. onde há som no bruto (o resto é silêncio)
const sil = []; { const e = ffLer(['-i', FB, '-vn', '-af', 'silencedetect=n=-42dB:d=0.35', '-f', 'null', '-']); let a = null;
  for (const m of e.matchAll(/silence_(start|end): (-?[\d.]+)/g)) { if (m[1] === 'start') a = +m[2]; else if (a != null) { sil.push([a, +m[2]]); a = null; } }
  if (a != null) sil.push([a, D]); }
const silencioEm = (a, b) => sil.reduce((s, [x, y]) => s + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);
const somEntre = (a, b) => { // o primeiro e o último instante com som dentro de [a, b]
  let ini = a, fim = b;
  for (const [x, y] of sil) { if (x <= ini + 0.05 && y > ini) ini = y; }
  for (const [x, y] of [...sil].reverse()) { if (y >= fim - 0.05 && x < fim) fim = x; }
  return [ini, fim];
};

// 2. os trechos de telejornal
let extraits;
const EJ = lerJSON(path.join(EP, 'extraits.json'));
if (EJ) extraits = EJ.map(e => ({ de: +e.de, ate: +e.ate, fonte: e.fonte || '', musica_propria: !!e.musica_propria }));
else {
  const buracos = [[0, subs[0].a], ...subs.slice(1).map((s, i) => [subs[i].b, s.a]), [subs.at(-1).b, D]];
  extraits = buracos.filter(([a, b]) => b - a >= 1.2 && 1 - silencioEm(a, b) / (b - a) >= 0.6).map(([a, b]) => {
    const [de, ate] = somEntre(a, b); return { de: r2(de), ate: r2(ate), fonte: '', musica_propria: false, auto: true };
  }).filter(e => e.ate - e.de >= 1);
}
const dentroExtrait = (t, folga = 0.3) => extraits.some(e => t > e.de + folga && t < e.ate - folga);

// 3. cortes de cena (para encostar o som no quadro em que o gráfico entra)
let cenas = [];
if (!tem('sem-cenas')) {
  process.stdout.write('  procurando os cortes de cena… ');
  cenas = [...ffLer(['-i', FB, '-an', '-vf', "scale=256:-2,select='gt(scene,0.32)',showinfo", '-f', 'null', '-']).matchAll(/pts_time:([\d.]+)/g)].map(m => +m[1]);
  console.log(`${cenas.length}`);
}
const encostar = (t, antes = 0.8, depois = 0.5) => { let m = null; for (const c of cenas) if (c >= t - antes && c <= t + depois && (m == null || Math.abs(c - t) < Math.abs(m - t))) m = c; return m; };

// 4. pistas do texto francês (cada palavra ganha o tempo proporcional à posição dela na legenda)
const emPalavra = (s, idx) => s.a + (s.b - s.a) * (idx / Math.max(1, s.texto.length));
const achados = (re) => subs.flatMap(s => [...s.texto.matchAll(re)].map(m => ({ t: emPalavra(s, m.index), txt: m[0], s })));
const DINHEIRO = /\b(?:\d[\d\s.,]*\d|\d)\s*(?:millions?|milliards?|M€|Md€|€|euros?)|\b(?:un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante|cinquante|cent)\s+(?:millions?|milliards?)\b/gi;
const STATUT = /\b(?:condamn[ée]e?s?|mise?s? en examen|interpell[ée]e?s?|écrou[ée]e?s?|relax[ée]e?s?|démantel[ée]e?s?|en garde à vue|placée?s? sous contrôle judiciaire|renvoy[ée]e?s? devant le tribunal)\b/gi;
const DOC = /\b(?:rapport|courrier|factures?|décision|jugement|communiqué|ordonnance|réquisitoire|procès-verbal|document)\b/gi;
const PHOTO = /\b(?:photos?|images? de vidéosurveillance|caméras?)\b/gi;
const ECRAN = /\b(?:en ligne|site internet|piraté|piratage|informatique|plateforme|application|comptes? CPF|faux sites?)\b/gi;
const SAISIE = /\b(?:saisi(?:e|es|s)?|en liquide|en espèces|billets|lingots)\b/gi;
const VICTIMES = /\b(?:victimes?|familles?|retraités?|endettée?s?|ruinée?s?|économies|modestes)\b/gi;
const RAIDE = /\b(?:perquisitions?|coup de filet|interpell|garde à vue|descente|opération|gendarmes?|enquêteurs?)\b/gi;

// 5. a trilha: a estrutura do blueprint (minuto a minuto de um vídeo de 10 min) escalada à duração real
const k = D / 600, t0 = subs[0].a;
// a frase pode vir partida em duas legendas ("sont présumées" / "innocentes.")
const AVISO = /présum[ée]e?s? innocent/i;
const disc = subs.flatMap((s, i) => AVISO.test(s.texto) ? [s] : subs[i + 1] && !AVISO.test(subs[i + 1].texto) && AVISO.test(`${s.texto} ${subs[i + 1].texto}`) ? [{ a: s.a, b: subs[i + 1].b, texto: `${s.texto} ${subs[i + 1].texto}` }] : []);
const cta1 = subs.find(s => /abonnez-vous|abonne-toi|abonnez vous/i.test(s.texto) && s.a < D * 0.5);
const cta2 = [...subs].reverse().find(s => /commentaire|dites-nous|quel dossier/i.test(s.texto) && s.a > D * 0.6);
const inicioFrase = t => { let m = subs[0]; for (const s of subs) if (Math.abs(s.a - t) < Math.abs(m.a - t)) m = s; return Math.abs(m.a - t) < 10 * Math.max(0.5, k) ? m.a : t; };
let marcos;
if (curto) marcos = [[0, 'enquete']];
else marcos = [
  [0, t0 > 3 ? 'ouverture' : 'mecanisme'],
  ...(t0 > 3 ? [[t0, 'mecanisme']] : []),
  [cta1 ? cta1.b + 0.5 : 120 * k, 'enquete'],
  [inicioFrase(450 * k), 'tension'],
  [inicioFrase(510 * k), 'enquete'],
  [inicioFrase(Math.max(D - 40, 560 * k)), 'verdict'],
];
// um trecho curto demais some e o anterior cobre o tempo dele (a abertura e o fecho podem ser curtos)
const minimo = c => curto ? 5 : c === 'ouverture' ? 3 : c === 'verdict' ? 8 : 20;
let trechos = marcos.map(([t, c]) => ({ de: r2(Math.max(0, Math.min(D, t))), clima: c })).sort((a, b) => a.de - b.de);
for (let mudou = true; mudou;) {
  mudou = false;
  trechos.forEach((t, i) => (t.ate = i < trechos.length - 1 ? trechos[i + 1].de : r2(D)));
  const i = trechos.findIndex((t, j) => (j > 0 && t.clima === trechos[j - 1].clima) || (trechos.length > 1 && t.ate - t.de < minimo(t.clima)));
  if (i >= 0) { if (i === 0) trechos[1].de = 0; trechos.splice(i, 1); mudou = true; }
}

// sugestões para a revisão (o Claude decide: tension em batida policial, grave nas vítimas)
const sug = [
  ...achados(RAIDE).map(x => ({ t: x.t, clima: 'tension', por: x.txt })),
  ...achados(VICTIMES).map(x => ({ t: x.t, clima: 'grave', por: x.txt })),
].sort((a, b) => a.t - b.t).filter((x, i, l) => i === 0 || x.clima !== l[i - 1].clima || x.t - l[i - 1].t > 25)
  .map(x => ({ t: r2(x.t), clima: x.clima, por: x.por, no_trecho: trechos.find(tr => x.t >= tr.de && x.t < tr.ate)?.clima }))
  .filter(x => x.no_trecho !== x.clima);

const baixar = disc.map(s => ({ de: r2(s.a - 0.3), ate: r2(s.b + 0.4), db: -3, motivo: 'présomption d\'innocence' }));
const semEfeitos = disc.map(s => ({ de: r2(s.a - 0.3), ate: r2(s.b + 0.5), motivo: 'présomption d\'innocence' }));
// o "stop-start": a trilha some por um instante entre a pergunta do narrador e o telejornal que responde
const silencios = [];
for (const e of extraits) {
  const s = [...subs].reverse().find(x => x.b <= e.de + 0.05);
  if (s && /\?\s*$/.test(s.texto) && e.de - s.b < 1.5 && !silencios.some(x => e.de - x.t < 90)) silencios.push({ t: r2(Math.max(s.b, e.de - 0.4)), dur: r2(Math.min(0.45, e.de - Math.max(s.b, e.de - 0.4) + 0.05)) });
}

// 6. os efeitos
let cand = [];
const add = (t, som, motivo, x = {}) => cand.push({ t: r2(t), som, motivo, ...x });
add(0, 'sub', 'abertura');
for (const e of extraits) {
  if (e.de > 0.5) add(e.de - 0.12, 'whoosh-grave', `entra telejornal ${e.fonte}`.trim());
  if (e.ate < D - 1) add(e.ate - 0.05, 'corte', 'volta a narração');
}
trechos.slice(1).forEach(tr => add(tr.de - 0.05, 'sting', `capítulo: ${tr.clima}`));
const GJ = lerJSON(path.join(EP, 'graficos.json'));
if (GJ) for (const g of GJ) { const som = g.som || TIPO_SOM[g.tipo]; if (som) add(+g.t, som, `${g.tipo}${g.texto ? `: ${g.texto}` : ''}`, { da_montagem: true }); }
else {
  const din = achados(DINHEIRO);
  din.forEach((x, i) => add(x.t, i === 0 || /milliard/i.test(x.txt) ? 'impact' : 'ding', x.txt));
  achados(STATUT).forEach(x => add(x.t, 'tampon', x.txt, { confirmar: true }));
  achados(DOC).forEach(x => add(x.t, 'papier', x.txt, { confirmar: true }));
  achados(PHOTO).forEach(x => add(x.t, 'obturateur', x.txt, { confirmar: true }));
  achados(ECRAN).forEach(x => add(x.t, 'clavier', x.txt, { confirmar: true }));
  // dinheiro apreendido, nunca dinheiro das vítimas
  achados(SAISIE).filter(x => !new RegExp(VICTIMES.source, 'i').test(x.s.texto)).forEach(x => add(x.t, 'billets', x.txt, { confirmar: true }));
}
if (cta1) add(emPalavra(cta1, cta1.texto.search(/abonn/i)), 'cta', 'CTA 1');
if (cta2) add(emPalavra(cta2, Math.max(0, cta2.texto.search(/commentaire|dites|quel dossier/i))), 'cta', 'CTA 2');
const ultimoSom = Math.min(D, somEntre(0, D)[1]);
const fin = r2(Math.min(D - 1.2, ultimoSom + 0.25));
const fim = curto ? { fin: null } : { riser: r2(Math.max(0, fin - EFEITOS.riser.s)), fin };
if (!curto) { add(fim.riser, 'riser', 'saída'); add(fim.fin, 'fin', 'fim'); }

// encosta no corte; tira o que cai dentro do telejornal ou do aviso de presunção; aplica a densidade
for (const c of cand) if (VISUAIS.has(c.som)) { const m = encostar(c.t); if (m != null) { c.t = r2(m - 0.03); c.no_corte = true; } }
cand = cand.filter(c => c.t >= 0 && c.t < D && (['riser', 'fin', 'whoosh-grave', 'corte', 'sub'].includes(c.som) || !dentroExtrait(c.t)))
  .filter(c => ['sub'].includes(c.som) || !semEfeitos.some(w => c.t >= w.de && c.t <= w.ate));
const maxMin = CAN.niveis.max_efeitos_min * (curto ? 1.3 : 1);
const pri = c => (EFEITOS[c.som]?.pri ?? 1) + (c.da_montagem ? 2 : 0) - (c.confirmar ? 0.5 : 0);
const aceitos = [], cortados = [];
for (const c of [...cand].sort((a, b) => pri(b) - pri(a) || a.t - b.t)) {
  const perto = aceitos.some(x => Math.abs(x.t - c.t) < (x.som === c.som ? 4 : 0.9));
  const naJanela = aceitos.filter(x => Math.abs(x.t - c.t) < 30).length;
  (perto || naJanela >= maxMin ? cortados : aceitos).push(c);
}
aceitos.sort((a, b) => a.t - b.t);

const plano = {
  rascunho: true, slug: path.basename(EP), perfil: curto ? 'short' : 'longo', bruto: BRUTO, srt: SRT, duracao: r2(D),
  extraits, trilha: { trechos, baixar, silencios, sugestoes: sug }, sem_efeitos: semEfeitos,
  efeitos: aceitos, fim, cortados_por_densidade: cortados.length,
};
gravarJSON(OUT, plano);

// 7. a folha de conferência: um quadro em cada efeito visual
if (!tem('sem-folha')) {
  const vis = aceitos.filter(c => VISUAIS.has(c.som)), FD = path.join(EP, 'build', 'folha');
  fs.rmSync(FD, { recursive: true, force: true }); fs.mkdirSync(FD, { recursive: true });
  for (const f of fs.readdirSync(path.join(EP, 'build'))) if (/^folha-\d+\.jpg$/.test(f)) fs.rmSync(path.join(EP, 'build', f));
  const fonte = fs.existsSync('C:/Windows/Fonts/arialbd.ttf') ? "fontfile='C\\:/Windows/Fonts/arialbd.ttf':" : '';
  vis.forEach((c, i) => {
    const rot = `${aceitos.indexOf(c) + 1} ${c.som} ${c.t.toFixed(1)}s${c.confirmar ? ' ?' : ''}`.replace(/[^\w .?#-]/g, '');
    try { ff(['-ss', String(Math.min(D - 0.1, c.t + 0.25)), '-i', FB, '-frames:v', '1', '-vf', `scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,drawtext=${fonte}text='${rot}':x=6:y=6:fontsize=17:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=4`, path.join(FD, `f_${String(i + 1).padStart(4, '0')}.jpg`)], 'quadro'); } catch (e) { console.log(`  ⚠ quadro ${c.t}: ${e.message.slice(0, 120)}`); }
  });
  if (vis.length) ff(['-framerate', '1', '-i', path.join(FD, 'f_%04d.jpg'), '-vf', 'tile=6x4:padding=4:color=black', '-start_number', '1', path.join(EP, 'build', 'folha-%02d.jpg')], 'folha');
}

// resumo
const porSom = aceitos.reduce((o, c) => (o[c.som] = (o[c.som] || 0) + 1, o), {});
console.log(`\nplano-sonoro.json (rascunho) · ${mmss(D)} · perfil ${plano.perfil}`);
console.log(`  telejornal: ${extraits.length} trecho(s)${EJ ? ' (extraits.json)' : ' (detectados pelos buracos do .srt)'}: ${extraits.map(e => `${mmss(e.de)}–${mmss(e.ate)}`).join(', ')}`);
console.log(`  trilha: ${trechos.map(t => `${t.clima} ${mmss(t.de)}`).join(' → ')}`);
if (sug.length) console.log(`  sugestões de clima para revisar: ${sug.map(s => `${mmss(s.t)} ${s.clima} («${s.por}»)`).join(' · ')}`);
console.log(`  presunção de inocência: ${disc.length ? disc.map(s => mmss(s.a)).join(', ') + ' (sem efeitos, trilha -3 dB)' : '⚠ NÃO ACHEI a frase "présumé(e)s innocent(e)s" no .srt'}`);
console.log(`  efeitos: ${aceitos.length} (${(aceitos.length / (D / 60)).toFixed(1)}/min) · ${Object.entries(porSom).map(([s, n]) => `${s} ${n}`).join(', ')} · ${cortados.length} cortados pela densidade`);
console.log(`  a confirmar na folha: ${aceitos.filter(c => c.confirmar).length}${GJ ? '' : ' (sem graficos.json: os efeitos visuais vieram do texto)'}`);
if (!tem('sem-folha')) console.log(`  folha de conferência: ${path.join(EP, 'build')}\\folha-NN.jpg`);
