#!/usr/bin/env node
// O SOM DO CANAL pela ai33.pro, gerado UMA vez e reaproveitado em todo vídeo:
//   pacote  os efeitos (ElevenLabs text-to-sound) em CANAL\_sons\<nome>.wav (48 kHz, pico -1 dBFS)
//   trilha  a biblioteca de música por clima (Suno, instrumental) em CANAL\_trilhas\<clima>-NN.mp3 (-16 LUFS)
// Sem --gerar, só mostra o que faria e os créditos da conta: nada é gasto.
//   node sons.mjs pacote [--so impact,tampon] [--refazer] [--gerar]
//   node sons.mjs trilha [--so enquete,tension] [--pedidos 1] [--refazer] [--gerar]
//   node sons.mjs lista
// Som novo: acrescente em EFEITOS (catalogo.mjs) e rode "pacote --so <nome> --gerar".
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { opt, tem, posicional, acharCanal, ff, pico, duracao, pastaSons, pastaTrilhas } from './comum.mjs';
import { EFEITOS, CLIMAS } from './catalogo.mjs';

const API = 'https://api.ai33.pro', KEY = process.env.AI33_API_KEY;
const H = { 'xi-api-key': KEY || '', 'Content-Type': 'application/json' };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const [acao] = posicional(['so', 'pedidos', 'canal']);
const CANAL = acharCanal(opt('canal', process.cwd()));

async function post(rota, corpo) {
  // a ai33 responde 429/503 em rajada: espera o retry-after e tenta de novo
  for (let k = 0; k < 40; k++) {
    const r = await fetch(API + rota, { method: 'POST', headers: H, body: JSON.stringify(corpo) }).catch(() => null);
    if (!r || r.status === 429 || r.status === 503) { await dormir(1000 * Math.max(5, +(r?.headers.get('retry-after')) || 5)); continue; }
    const j = await r.json().catch(() => null);
    if (j?.success) return j.task_id;
    if (/queue|busy|limit/i.test(JSON.stringify(j || {}))) { await dormir(15000); continue; }
    throw new Error(`a ai33 recusou ${rota}: ${JSON.stringify(j)}`);
  }
  throw new Error(`a ai33 não aceitou ${rota} depois de 40 tentativas`);
}
async function esperar(id, min = 20) {
  const t0 = Date.now();
  while (Date.now() - t0 < min * 60000) {
    await dormir(4000);
    const r = await fetch(`${API}/v1/task/${id}`, { headers: H }).catch(() => null);
    if (!r?.ok) continue;
    const t = await r.json().catch(() => null);
    if (t?.status === 'done') return t;
    if (/error|fail/.test(t?.status || '')) throw new Error(t.error_message || t.status);
  }
  throw new Error(`a tarefa ${id} não terminou em ${min} min`);
}
const creditos = async () => { if (!KEY) return null; try { const j = await (await fetch(`${API}/v1/credits`, { headers: H })).json(); return j.credits ?? j.balance ?? null; } catch { return null; } };
const baixar = async (url, f) => fs.writeFileSync(f, Buffer.from(await (await fetch(url)).arrayBuffer()));
const licenca = (pasta, o, nomes) => {
  const f = path.join(pasta, 'LICENCAS.md');
  if (!fs.existsSync(f)) fs.writeFileSync(f, `# Licenças\n\nTudo nesta pasta foi gerado pela ai33.pro (${o}) para o canal, sob os termos de uso comercial da conta. Nenhum som ou música de banco de terceiros: nada aqui gera Content ID.\n\n`);
  fs.appendFileSync(f, `- ${new Date().toISOString().slice(0, 10)}: ${nomes.join(', ')}\n`);
};
const so = opt('so')?.split(',').map(s => s.trim());

if (acao === 'lista') {
  console.log('Efeitos:', Object.keys(EFEITOS).join(', '));
  console.log('Climas: ', Object.keys(CLIMAS).join(', '));
} else if (acao === 'pacote') {
  const PK = pastaSons(CANAL); fs.mkdirSync(PK, { recursive: true });
  for (const n of so || []) if (!EFEITOS[n]) throw new Error(`"${n}" não existe no catálogo. Existem: ${Object.keys(EFEITOS).join(', ')}`);
  const faltam = Object.keys(EFEITOS).filter(n => (!so || so.includes(n)) && (tem('refazer') || !fs.existsSync(path.join(PK, n + '.wav'))));
  console.log(`Pacote de efeitos: ${PK}\n  ${faltam.length ? `${faltam.length} a gerar (${faltam.reduce((s, n) => s + EFEITOS[n].s, 0).toFixed(1)} s de som): ${faltam.join(', ')}` : 'completo'}`);
  const c0 = await creditos(); if (c0 != null) console.log(`  créditos na conta: ${c0}`);
  if (!faltam.length) process.exit(0);
  if (!tem('gerar')) { console.log('Nada foi gerado. Para gastar os créditos, rode de novo com --gerar.'); process.exit(0); }
  if (!KEY) throw new Error('Defina AI33_API_KEY (a chave da ai33.pro) no ambiente.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'canal-pacote-')), jobs = [];
  for (const n of faltam) {
    const e = EFEITOS[n];
    let id;
    try { id = await post('/v1/task/sound-effect', { text: e.p, duration_seconds: Math.max(0.5, e.s), prompt_influence: 0.55, loop: false, model_id: 'eleven_text_to_sound_v2' }); }
    catch (err) { console.error(`  ✗ ${n}: ${err.message}`); continue; }
    jobs.push(esperar(id).then(async t => {
      const mp3 = path.join(tmp, n + '.mp3'); await baixar(t.metadata.audio_url || t.metadata.url, mp3);
      // todos com o mesmo pico (-1 dBFS): o nível de cada um na mixagem é o "db" do catálogo
      ff(['-i', mp3, '-af', `volume=${(-1 - pico(mp3)).toFixed(2)}dB`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(PK, n + '.wav')], n);
      console.log(`  ✓ ${n}`);
    }).catch(err => console.error(`  ✗ ${n}: ${err.message}`)));
    await dormir(400);
  }
  await Promise.all(jobs);
  fs.rmSync(tmp, { recursive: true, force: true });
  licenca(PK, 'ElevenLabs Sound Effects', faltam);
  const c1 = await creditos();
  console.log(`Pronto. Ouça a pasta antes do primeiro vídeo; um som ruim: --so <nome> --refazer --gerar.${c0 != null && c1 != null ? ` Gastou ${c0 - c1} créditos (restam ${c1}).` : ''}`);
} else if (acao === 'trilha') {
  const BIB = pastaTrilhas(CANAL); fs.mkdirSync(BIB, { recursive: true });
  for (const k of so || []) if (!CLIMAS[k]) throw new Error(`clima "${k}" não existe. Existem: ${Object.keys(CLIMAS).join(', ')}`);
  const tomadas = k => fs.readdirSync(BIB).filter(f => new RegExp(`^${k}-\\d+\\.mp3$`).test(f));
  const alvo = Object.keys(CLIMAS).filter(k => !so || so.includes(k));
  // sem --refazer, só os climas que ainda não têm nenhuma tomada (com --so, acrescenta tomadas novas mesmo assim)
  const faltam = alvo.filter(k => tem('refazer') || so || !tomadas(k).length);
  const pedidos = Math.max(1, +opt('pedidos', 1));
  console.log(`Biblioteca de trilhas: ${BIB}`);
  for (const k of alvo) console.log(`  ${k}: ${tomadas(k).length} tomada(s)${faltam.includes(k) ? ` → +${pedidos} pedido(s) ao Suno (2 tomadas cada)` : ''}`);
  const c0 = await creditos(); if (c0 != null && faltam.length) console.log(`  créditos na conta: ${c0}`);
  if (!faltam.length) process.exit(0);
  if (!tem('gerar')) { console.log('Nada foi gerado. Para gastar os créditos, rode de novo com --gerar.'); process.exit(0); }
  if (!KEY) throw new Error('Defina AI33_API_KEY (a chave da ai33.pro) no ambiente.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'canal-trilha-'));
  for (const k of faltam) {
    if (tem('refazer') && !so) for (const f of tomadas(k)) fs.renameSync(path.join(BIB, f), path.join(BIB, f.replace(/\.mp3$/, '.antiga.mp3')));
    for (let p = 0; p < pedidos; p++) {
      const id = await post('/v1s/task/music-generation', { create_mode: 'simple', gpt_description_prompt: CLIMAS[k].slice(0, 400), make_instrumental: true });
      console.log(`  ${k}: compondo (tarefa ${id})…`);
      const t = await esperar(id, 25);
      for (const u of t.metadata.all_audio_urls || [t.metadata.audio_url]) {
        const n = String(Math.max(0, ...tomadas(k).map(f => +f.match(/-(\d+)\.mp3$/)[1])) + 1).padStart(2, '0');
        const bruto = path.join(tmp, `${k}-${n}.mp3`); await baixar(u, bruto);
        const f = path.join(BIB, `${k}-${n}.mp3`);
        ff(['-i', bruto, '-af', 'highpass=f=30,loudnorm=I=-16:TP=-2:LRA=9', '-ar', '48000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '256k', f], k);
        console.log(`  ✓ ${path.basename(f)} (${Math.round(duracao(f))} s)`);
      }
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  licenca(BIB, 'Suno, instrumental', faltam);
  const c1 = await creditos();
  console.log(`Pronto. Ouça cada clima; uma tomada ruim: apague o arquivo (ou renomeie para .ruim.mp3) e peça outra com --so <clima> --gerar.${c0 != null && c1 != null ? ` Gastou ${c0 - c1} créditos (restam ${c1}).` : ''}`);
} else {
  console.log('Use: node sons.mjs pacote|trilha|lista [--so …] [--refazer] [--gerar]');
}
