#!/usr/bin/env node
// A MIXAGEM do canal, a partir do plano-sonoro.json revisado:
//   diálogo  o áudio do bruto: narração a -16 LUFS e cada trecho de telejornal nivelado a -17 (sem tratamento além
//            de um passa-alta: o som "de campo" do telejornal fica, como no AussieFiles)
//   trilha   os climas da biblioteca do canal emendados com crossfade, em ducking sob o diálogo, mais 6 dB abaixo
//            sob o telejornal (mudo se o trecho tem música própria), -3 dB no aviso de presunção, o silêncio
//            "stop-start" antes do telejornal que responde, e saída no impacto final. Calibrada para ficar
//            ~20 dB sob a voz (medido, não estimado)
//   efeitos  cada som do plano no seu tempo, no nível do catálogo (+ o "db" do efeito)
//   master   -14 LUFS integrado, -1 dBTP (duas passadas) → audio/mix.wav e final.mp4 (vídeo copiado do bruto)
// As três pistas ficam em audio/stems para ajuste fino no editor. Relatório em relatorio-som.md.
//   node mixar.mjs "EP" [--sem-video]
import fs from 'node:fs';
import path from 'node:path';
import { posicional, tem, acharCanal, lerCanal, lerJSON, ff, duracao, medir, mmss, hash, pastaSons, pastaTrilhas } from './comum.mjs';
import { EFEITOS, CLIMAS } from './catalogo.mjs';

const EP = path.resolve(posicional()[0] || '.');
const CAN = lerCanal(acharCanal(EP)), NV = CAN.niveis;
const P = lerJSON(path.join(EP, 'plano-sonoro.json'));
if (!P) throw new Error(`Falta plano-sonoro.json em ${EP}: rode analisar.mjs primeiro.`);
const BRUTO = path.join(EP, P.bruto), D = duracao(BRUTO), PF = NV[P.perfil === 'short' ? 'short' : 'longo'];
const AD = path.join(EP, 'audio'), ST = path.join(AD, 'stems'), BD = path.join(EP, 'build');
for (const d of [AD, ST, BD]) fs.mkdirSync(d, { recursive: true });
const avisos = [];
if (P.rascunho) avisos.push('o plano ainda é rascunho (ninguém revisou): confira e tire "rascunho": true');
const f3 = x => (+x).toFixed(3), ms = t => Math.max(0, Math.round(t * 1000)), lin = db => Math.pow(10, db / 20);
const rampa = (a, b, r) => `clip((t-${f3(a)})/${r},0,1)*clip((${f3(b)}-t)/${r},0,1)`;
const roteiro = (nome, g) => { const f = path.join(BD, nome); fs.writeFileSync(f, g); return f; };
const E = (P.extraits || []).filter(e => e.ate > e.de);
const soNarracao = E.length ? `aselect='not(${E.map(e => `between(t,${f3(e.de)},${f3(e.ate)})`).join('+')})',asetpts=N/SR/TB,` : '';

// 1. DIÁLOGO
console.log(`Mixando ${P.slug || path.basename(EP)} (${mmss(D)}, ${P.perfil})`);
const Ln = medir(BRUTO, soNarracao).i;
if (!Number.isFinite(Ln)) throw new Error('não achei a narração no bruto (áudio mudo, ou os extraits cobrem o vídeo inteiro?)');
const gv = NV.voz_lufs - Ln;
const niv = E.map(e => {
  const L = e.ate - e.de >= 1 ? medir(BRUTO, '', e.de, e.ate - e.de).i : NaN;
  const g = Math.max(gv - 8, Math.min(gv + 10, Number.isFinite(L) ? NV.extrait_lufs - L : gv));
  return { ...e, L, g };
});
const base = lin(gv);
const exprD = [base.toFixed(5), ...niv.map(e => `(${(lin(e.g) - base).toFixed(5)})*${rampa(e.de, e.ate, 0.06)}`)].join('+');
const DIAL = path.join(ST, 'dialogo.wav');
ff(['-i', BRUTO, '-filter_complex_script', roteiro('_dialogo.txt', `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=60,volume='${exprD}':eval=frame,apad=whole_dur=${f3(D)},atrim=0:${f3(D)}[d]`), '-map', '[d]', '-c:a', 'pcm_s24le', DIAL], 'diálogo');
console.log(`  diálogo: narração ${Ln.toFixed(1)} → ${NV.voz_lufs} LUFS · ${niv.length} telejornal(is) nivelado(s)`);

// 2. TRILHA
const BIB = pastaTrilhas(CAN.dir);
const tomadas = k => fs.existsSync(BIB) ? fs.readdirSync(BIB).filter(f => new RegExp(`^${k}-\\d+\\.mp3$`).test(f)).sort().map(f => path.join(BIB, f)) : [];
const T = (P.trilha?.trechos || []).filter(t => t.ate > t.de).map(t => ({ ...t }));
const xf = PF.xfade;
for (const t of T) {
  if (!CLIMAS[t.clima]) avisos.push(`clima "${t.clima}" não existe no catálogo`);
  if (!tomadas(t.clima).length) { const alt = ['enquete', ...Object.keys(CLIMAS)].find(k => tomadas(k).length); if (alt && alt !== t.clima) avisos.push(`sem tomadas de "${t.clima}" na biblioteca: usei "${alt}" (gere com sons.mjs trilha --so ${t.clima} --gerar)`); t.usa = alt; } else t.usa = t.clima;
}
const TM = T.filter(t => t.usa);
let MUS = null, sobVoz = NaN;
if (!TM.length) avisos.push(`sem trilha: a biblioteca ${BIB} está vazia (sons.mjs trilha --gerar)`);
else {
  // a cama de cada clima: as tomadas da biblioteca (rodízio pelo vídeo) emendadas até cobrir o que o vídeo pede
  const precisa = {}; for (const t of TM) precisa[t.usa] = (precisa[t.usa] || 0) + (t.ate - t.de) + xf * 2;
  const camas = {};
  for (const [k, seg] of Object.entries(precisa)) {
    const lista = tomadas(k), r = hash(P.slug || EP) % lista.length, ordem = [...lista.slice(r), ...lista.slice(0, r)];
    const usar = []; let tot = 0;
    for (let i = 0; tot < seg + 5 && i < 16; i++) { const f = ordem[i % ordem.length]; usar.push(f); tot += duracao(f) - 5 - (usar.length > 1 ? 4 : 0); }
    const C = path.join(BD, `cama-${k}.wav`), assin = path.join(BD, `cama-${k}.json`), sig = JSON.stringify(usar);
    if (!(fs.existsSync(C) && fs.existsSync(assin) && fs.readFileSync(assin, 'utf8') === sig)) {
      // corta os 5 s finais de cada tomada (o fade do Suno) e emenda com 4 s de crossfade
      const g = usar.map((f, i) => `[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${f3(duracao(f) - 5)},asetpts=N/SR/TB[a${i}]`);
      let ant = '[a0]';
      for (let i = 1; i < usar.length; i++) { g.push(`${ant}[a${i}]acrossfade=d=4:c1=tri:c2=tri[x${i}]`); ant = `[x${i}]`; }
      g.push(`${ant}anull[c]`);
      ff([...usar.flatMap(f => ['-i', f]), '-filter_complex_script', roteiro(`_cama-${k}.txt`, g.join(';\n')), '-map', '[c]', '-c:a', 'pcm_s16le', C], `cama ${k}`);
      fs.writeFileSync(assin, sig);
    }
    camas[k] = C;
    if (duracao(C) < seg - 1) avisos.push(`a cama "${k}" tem ${Math.round(duracao(C))} s e o vídeo pede ${Math.round(seg)} s: o fim do clima fica sem música (gere mais tomadas)`);
  }
  const ks = Object.keys(camas), idx = k => ks.indexOf(k) + 1; // 0 = diálogo (a chave do ducking)
  const usos = {}; TM.forEach(t => (usos[t.usa] = (usos[t.usa] || 0) + 1));
  const g = [`[0:a]aformat=sample_rates=48000:channel_layouts=stereo[key]`];
  const rot = {}; for (const k of ks) { const n = usos[k]; g.push(`[${idx(k)}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=${n}${Array.from({ length: n }, (_, j) => `[c${idx(k)}_${j}]`).join('')}`); rot[k] = 0; }
  const desde = {}, partes = [];
  TM.forEach((t, i) => {
    const prim = i === 0, ult = i === TM.length - 1;
    const s0 = prim ? 0 : Math.max(0, t.de - xf / 2), s1 = ult ? D : Math.min(D, t.ate + xf / 2), L = s1 - s0;
    const o = desde[t.usa] || 0; desde[t.usa] = o + (t.ate - t.de);
    const fi = prim ? 1 : xf;
    g.push(`[c${idx(t.usa)}_${rot[t.usa]++}]atrim=start=${f3(o)}:duration=${f3(L)},asetpts=N/SR/TB,afade=t=in:d=${fi}${ult ? '' : `,afade=t=out:st=${f3(L - xf)}:d=${xf}`},adelay=${ms(s0)}:all=1[t${i}]`);
    partes.push(`[t${i}]`);
  });
  // o envelope: telejornal, aviso, silêncios e saída
  const fat = [lin(PF.cama_db).toFixed(5)];
  for (const e of E) fat.push(`(1-${(1 - lin(e.musica_propria ? -40 : PF.extrait_db)).toFixed(4)}*${rampa(e.de - 0.15, e.ate + 0.15, 0.25)})`);
  for (const b of P.trilha?.baixar || []) fat.push(`(1-${(1 - lin(b.db ?? -3)).toFixed(4)}*${rampa(b.de, b.ate, 0.5)})`);
  for (const s of P.trilha?.silencios || []) fat.push(`(1-${rampa(s.t, s.t + s.dur, 0.04)})`);
  const fin = P.fim?.fin;
  fat.push(Number.isFinite(fin) ? `clip((${f3(fin + 1.8)}-t)/1.8,0,1)` : `clip((${f3(D)}-t)/3,0,1)`);
  g.push(`${partes.join('')}${partes.length > 1 ? `amix=inputs=${partes.length}:normalize=0:duration=longest,` : ''}apad=whole_dur=${f3(D)},atrim=0:${f3(D)},volume='${fat.join('*')}':eval=frame[m1]`);
  g.push(`[m1][key]sidechaincompress=threshold=0.025:ratio=2:attack=40:release=500[m]`);
  const PRE = path.join(BD, '_musica-pre.wav');
  ff(['-i', DIAL, ...ks.flatMap(k => ['-i', camas[k]]), '-filter_complex_script', roteiro('_musica.txt', g.join(';\n')), '-map', '[m]', '-c:a', 'pcm_s24le', PRE], 'trilha');
  // calibra: a trilha medida onde a narração fala tem de ficar sob_voz_db abaixo da voz
  const Lm = medir(PRE, soNarracao).i, alvo = NV.voz_lufs + PF.sob_voz_db;
  const corr = Number.isFinite(Lm) ? Math.max(-15, Math.min(15, alvo - Lm)) : 0;
  MUS = path.join(ST, 'trilha.wav');
  ff(['-i', PRE, '-af', `volume=${corr.toFixed(2)}dB`, '-c:a', 'pcm_s24le', MUS], 'trilha (nível)');
  fs.rmSync(PRE, { force: true });
  sobVoz = medir(MUS, soNarracao).i - NV.voz_lufs;
  console.log(`  trilha: ${TM.map(t => `${t.usa} ${mmss(t.de)}`).join(' → ')} · ${sobVoz.toFixed(1)} dB sob a voz`);
}

// 3. EFEITOS
const PK = pastaSons(CAN.dir);
const cues = (P.efeitos || []).filter(c => !c.desligado && c.t >= 0 && c.t < D);
const porSom = {};
for (const c of cues) {
  const f = path.join(PK, `${c.som}.wav`);
  if (!EFEITOS[c.som]) { avisos.push(`efeito "${c.som}" (${mmss(c.t)}) não existe no catálogo`); continue; }
  if (!fs.existsSync(f)) { avisos.push(`falta ${c.som}.wav no pacote (sons.mjs pacote --gerar)`); continue; }
  (porSom[c.som] ||= []).push(c);
}
const sons = Object.keys(porSom);
let FX = null;
if (sons.length) {
  const g = [], saidas = [];
  sons.forEach((s, i) => {
    const l = porSom[s];
    g.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=${l.length}${l.map((_, j) => `[s${i}_${j}]`).join('')}`);
    l.forEach((c, j) => { g.push(`[s${i}_${j}]volume=${(EFEITOS[s].db + (c.db || 0)).toFixed(1)}dB,adelay=${ms(c.t)}:all=1[e${i}_${j}]`); saidas.push(`[e${i}_${j}]`); });
  });
  g.push(`${saidas.join('')}${saidas.length > 1 ? `amix=inputs=${saidas.length}:normalize=0:duration=longest,` : ''}apad=whole_dur=${f3(D)},atrim=0:${f3(D)}[fx]`);
  FX = path.join(ST, 'efeitos.wav');
  ff([...sons.flatMap(s => ['-i', path.join(PK, `${s}.wav`)]), '-filter_complex_script', roteiro('_efeitos.txt', g.join(';\n')), '-map', '[fx]', '-c:a', 'pcm_s24le', FX], 'efeitos');
}
const nfx = Object.values(porSom).flat().length;
console.log(`  efeitos: ${nfx} (${(nfx / (D / 60)).toFixed(1)}/min)`);

// 4. MASTER
const pistas = [DIAL, MUS, FX].filter(Boolean);
const PRE = path.join(BD, '_premix.wav'), OUT = path.join(AD, 'mix.wav');
ff([...pistas.flatMap(f => ['-i', f]), '-filter_complex', `${pistas.map((_, i) => `[${i}:a]`).join('')}amix=inputs=${pistas.length}:normalize=0:duration=first[o]`, '-map', '[o]', '-c:a', 'pcm_s24le', PRE], 'premix');
const m = medir(PRE);
ff(['-i', PRE, '-af', `loudnorm=I=${NV.master_lufs}:TP=${NV.master_tp}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, '-ar', '48000', '-c:a', 'pcm_s16le', OUT], 'master');
fs.rmSync(PRE, { force: true });
for (const f of fs.readdirSync(BD)) if (/^_.*\.txt$/.test(f)) fs.rmSync(path.join(BD, f));
const fim = medir(OUT, '', null, null);
const FINAL = path.join(EP, 'final.mp4');
if (!tem('sem-video')) ff(['-i', BRUTO, '-i', OUT, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', FINAL], 'final.mp4');

// 5. CONFERÊNCIA
const ts = Object.values(porSom).flat().map(c => c.t).sort((a, b) => a - b);
const picoMin = ts.reduce((mx, t) => Math.max(mx, ts.filter(x => x >= t && x < t + 60).length), 0);
if (picoMin > NV.max_efeitos_min + 2) avisos.push(`${picoMin} efeitos num mesmo minuto: o AussieFiles fica em 6 a 10`);
for (const c of Object.values(porSom).flat()) {
  if (!['whoosh-grave', 'corte', 'riser', 'fin', 'sub'].includes(c.som) && E.some(e => c.t > e.de + 0.3 && c.t < e.ate - 0.3)) avisos.push(`${c.som} em ${mmss(c.t)} cai DENTRO do telejornal`);
  if (c.som === 'tampon' && c.confirmar) avisos.push(`tampon em ${mmss(c.t)} sem confirmação: só fica se a tela mostra o carimbo do estado jurídico CERTO`);
  if (c.som === 'billets' && c.confirmar) avisos.push(`billets em ${mmss(c.t)} sem confirmação: só sobre dinheiro apreendido, nunca sobre as vítimas`);
}
if (Math.abs(fim.i - NV.master_lufs) > 1) avisos.push(`o master saiu em ${fim.i} LUFS (alvo ${NV.master_lufs})`);
if (Number.isFinite(sobVoz) && (sobVoz > PF.sob_voz_db + 3 || sobVoz < PF.sob_voz_db - 4)) avisos.push(`a trilha ficou ${sobVoz.toFixed(1)} dB sob a voz (alvo ${PF.sob_voz_db})`);
const rel = [
  `# Som — ${P.slug || path.basename(EP)}`, '',
  `- Duração ${mmss(D)} · perfil ${P.perfil}`,
  `- Master: ${fim.input_i} LUFS, pico ${fim.input_tp} dBTP (alvo ${NV.master_lufs} / ${NV.master_tp})`,
  `- Narração ${Ln.toFixed(1)} → ${NV.voz_lufs} LUFS; telejornal → ${NV.extrait_lufs} LUFS: ${niv.map(e => `${mmss(e.de)} ${Number.isFinite(e.L) ? e.L.toFixed(1) : '?'}→${(e.g - gv >= 0 ? '+' : '')}${(e.g - gv).toFixed(1)} dB`).join(', ') || 'nenhum'}`,
  `- Trilha: ${TM.length ? TM.map(t => `${t.usa} ${mmss(t.de)}–${mmss(t.ate)}`).join(' → ') : 'nenhuma'}${Number.isFinite(sobVoz) ? ` · ${sobVoz.toFixed(1)} dB sob a voz` : ''}`,
  `- Efeitos: ${nfx} (${(nfx / (D / 60)).toFixed(1)}/min, pico ${picoMin} num minuto) · ${Object.entries(porSom).map(([s, l]) => `${s} ${l.length}`).join(', ')}`,
  `- Pistas separadas: audio/stems/dialogo.wav, trilha.wav, efeitos.wav`, '',
  '## Ouça antes de publicar', '',
  `- 0:00–0:20 (abertura e primeiro número)`,
  ...E.slice(0, 2).map(e => `- ${mmss(Math.max(0, e.de - 3))}: entrada do telejornal ${e.fonte || ''}`.trimEnd()),
  ...(P.sem_efeitos || []).map(w => `- ${mmss(w.de)}: aviso de presunção de inocência (sóbrio, sem efeito)`),
  ...(P.trilha?.trechos || []).slice(1).map(t => `- ${mmss(t.de)}: troca para ${t.clima}`),
  `- ${mmss(Math.max(0, D - 30))}–fim (saída)`, '',
  avisos.length ? '## Avisos\n\n' + [...new Set(avisos)].map(a => `- ${a}`).join('\n') : '## Avisos\n\nNenhum.', '',
];
fs.writeFileSync(path.join(EP, 'relatorio-som.md'), rel.join('\n'));
console.log(`  master: ${fim.input_i} LUFS, ${fim.input_tp} dBTP → ${tem('sem-video') ? OUT : FINAL}`);
if (avisos.length) console.log(`  avisos:\n${[...new Set(avisos)].map(a => `   - ${a}`).join('\n')}`);
console.log(`  relatório: ${path.join(EP, 'relatorio-som.md')}`);
