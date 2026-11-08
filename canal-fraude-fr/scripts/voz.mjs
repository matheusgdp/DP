#!/usr/bin/env node
// A NARRAÇÃO: o roteiro inteiro numa tomada só, pela ai33.pro (vozes do ElevenLabs), com a transcrição
// que a ai33 devolve. As palavras do roteiro são casadas com as da transcrição (Needleman-Wunsch) e
// cada uma ganha o seu tempo. Sai tudo o que o resto da skill precisa:
//   narracao.mp3            a voz (na raiz do episódio: é o único áudio que o montador vê ali)
//   narracao.srt            as legendas, montadas a partir dos tempos das palavras
//   narracao-tempos.json    { palavras: [{w, em, ate}], cenas: [segundo em que cada cena começa] }
//   roteiro.json            cada cena ganha "em" (o segundo em que a fala dela começa)
//
// Uso:  node voz.mjs "C:\videos\ep01" [--voz <voice_id>] [--velocidade 0.92] [--forcar]
//       node voz.mjs "C:\videos\ep01" --so-alinhar        (refaz o SRT e os tempos sem gastar créditos)
//       node voz.mjs --vozes                               (as vozes da conta, se a ai33 listar)
// A chave vem só do ambiente (AI33_API_KEY); nunca é gravada em disco. Roteiro sem mudança não é
// narrado de novo.
import crypto from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const tem = (n) => args.includes(`--${n}`);
const API = "https://api.ai33.pro";
const KEY = process.env.AI33_API_KEY;
const H = KEY ? { "xi-api-key": KEY } : {};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

if (tem("vozes")) {
  // a biblioteca pública do ElevenLabs pela ai33, só vozes masculinas da França; listar não gasta crédito
  if (!KEY) throw new Error("Defina AI33_API_KEY primeiro.");
  const r = await fetch(`${API}/v1/shared-voices?language=fr&accent=parisian&gender=male&page_size=30&use_cases=narrative_story`, { headers: H, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`a ai33 não listou as vozes (${r.status})`);
  for (const v of (await r.json()).voices ?? []) console.log(`${String(v.name ?? "").padEnd(36)} ${String(v.voice_id).padEnd(24)} ${v.preview_url ?? ""}`);
  process.exit(0);
}

const EP = path.resolve(args.find((a, i) => !a.startsWith("--") && !["--voz", "--velocidade"].includes(args[i - 1])) ?? ".");
const RP = path.join(EP, "roteiro.json");
if (!fs.existsSync(RP)) throw new Error(`Falta ${RP}. O roteiro vem antes da voz.`);
const roteiro = JSON.parse(fs.readFileSync(RP, "utf8"));
const cenas = roteiro.capitulos.flatMap((c, ci) => c.cenas.map((s, si) => ({ s, ci, si })));
if (cenas.some(({ s }) => !String(s.diz ?? "").trim())) throw new Error("Toda cena do roteiro precisa de \"diz\" (o texto narrado).");

// o texto: uma tomada; um parágrafo novo antes de cada capítulo, para o narrador respirar ali
const texto = roteiro.capitulos
  .map((c) => c.cenas.map((s) => s.diz.trim()).join(" "))
  .join("\n\n");
const vozCrua = opt("voz", roteiro.voz?.id);
if (!vozCrua) throw new Error("Falta a voz do canal: veja \"voz\" no canal.json e passe --voz no roteiro_json.py.");
// a lista de vozes devolve o id puro; a v3 quer o prefixo do provedor
const voz = /^(elevenlabs|minimax|clone|edge|kokoro|vbee|fishaudio)_/.test(vozCrua) ? vozCrua : `elevenlabs_${vozCrua}`;
const velocidade = opt("velocidade", String(roteiro.voz?.velocidade ?? 0.92));
const hash = crypto.createHash("sha1").update(JSON.stringify([texto, voz, velocidade])).digest("hex");
const MEMO = path.join(EP, ".narracao.json");
const memo = fs.existsSync(MEMO) ? JSON.parse(fs.readFileSync(MEMO, "utf8")) : {};
const MP3 = path.join(EP, "narracao.mp3");
const TR = path.join(EP, "narracao-transcricao.json");

if (!tem("so-alinhar") && (memo.hash !== hash || tem("forcar") || !fs.existsSync(MP3) || !fs.existsSync(TR))) {
  if (!KEY) throw new Error("Defina AI33_API_KEY (a chave da ai33.pro) antes de narrar.");
  const fd = new FormData();
  fd.append("text", texto);
  fd.append("voice_id", voz);
  fd.append("speed", velocidade);
  fd.append("with_transcript", "true");
  fd.append("file_name", path.basename(EP));
  const r = await fetch(`${API}/v3/text-to-speech`, { method: "POST", headers: H, body: fd });
  const j = await r.json();
  if (!j.success) throw new Error(`a ai33 recusou: ${JSON.stringify(j)}`);
  console.log(`Narrando ${texto.length} caracteres (tarefa ${j.task_id})…`);
  let tarefa;
  let feitoEm = null;
  for (let i = 0; i < 400; i++) {
    await dormir(4000);
    const q = await fetch(`${API}/v1/task/${j.task_id}`, { headers: H });
    if (q.status === 429) continue;
    tarefa = await q.json();
    if (tarefa.status === "done" && tarefa.metadata?.audio_url && (tarefa.metadata.json_url || tarefa.metadata.transcript_status === "failed")) break;
    // o áudio já veio e a transcrição não: depois de 1 min, segue com o Whisper local
    if (tarefa.status === "done" && tarefa.metadata?.audio_url) {
      feitoEm ??= i;
      if (i - feitoEm >= 15) break;
    }
    if (/error|fail/.test(tarefa.status)) throw new Error(`a narração falhou: ${tarefa.error_message ?? tarefa.status}`);
    if (i % 5 === 0) process.stdout.write(`  ${tarefa.status} ${tarefa.progress ?? 0}%\r`);
  }
  const baixar = async (u, f) => fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
  await baixar(tarefa.metadata.audio_url, MP3);
  if (tarefa.metadata.json_url) await baixar(tarefa.metadata.json_url, TR);
  else {
    console.log("\nA ai33 não devolveu a transcrição: alinhando com o Whisper local (sem custo)…");
    const w = spawnSync("python", [path.join(path.dirname(fileURLToPath(import.meta.url)), "transcrever.py"), MP3, TR], { stdio: "inherit" });
    if (w.status !== 0) throw new Error("o Whisper falhou; rode de novo com --forcar (cobra de novo)");
  }
  fs.writeFileSync(MEMO, JSON.stringify({ hash, voz, velocidade, creditos: tarefa.credit_cost }, null, 1));
  console.log(`\nPronto: ${tarefa.credit_cost} créditos.`);
} else if (!tem("so-alinhar")) console.log("O roteiro não mudou desde a última narração: nada foi narrado (nenhum crédito gasto).");

// ——— as palavras do roteiro × a transcrição ———
const norm = (w) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");
const tr = JSON.parse(fs.readFileSync(TR, "utf8"));
const ouvidas = (Array.isArray(tr) ? tr : [tr])
  .flatMap((x) => x.words ?? [])
  .filter((w) => (w.type ?? "word") === "word")
  .map((w) => ({ n: norm(w.text), s: w.start, e: w.end }))
  .filter((w) => w.n);
const ditas = [];
cenas.forEach(({ s }, k) => s.diz.split(/\s+/).filter(Boolean).forEach((w) => ditas.push({ w, n: norm(w), cena: k })));
const n = ditas.length;
const m = ouvidas.length;
const W = m + 1;
const S = new Int32Array((n + 1) * W);
const B = new Uint8Array((n + 1) * W);
for (let i = 1; i <= n; i++) {
  S[i * W] = -i;
  B[i * W] = 1;
}
for (let j = 1; j <= m; j++) {
  S[j] = -j;
  B[j] = 2;
}
for (let i = 1; i <= n; i++)
  for (let j = 1; j <= m; j++) {
    const d = S[(i - 1) * W + j - 1] + (ditas[i - 1].n === ouvidas[j - 1].n ? 2 : -1);
    const u = S[(i - 1) * W + j] - 1;
    const l = S[i * W + j - 1] - 1;
    if (d >= u && d >= l) [S[i * W + j], B[i * W + j]] = [d, 0];
    else if (u >= l) [S[i * W + j], B[i * W + j]] = [u, 1];
    else [S[i * W + j], B[i * W + j]] = [l, 2];
  }
for (let i = n, j = m; i > 0 || j > 0; ) {
  const b = B[i * W + j];
  if (i > 0 && j > 0 && b === 0) {
    if (ditas[i - 1].n === ouvidas[j - 1].n) [ditas[i - 1].s, ditas[i - 1].e] = [ouvidas[j - 1].s, ouvidas[j - 1].e];
    i--;
    j--;
  } else if (i > 0 && (j === 0 || b === 1)) i--;
  else j--;
}
const casadas = ditas.filter((x) => x.s != null).length;
// as palavras sem par (número escrito por extenso, sigla…) dividem o tempo entre as vizinhas
for (let i = 0; i < n; i++)
  if (ditas[i].s == null) {
    let a = i - 1;
    while (a >= 0 && ditas[a].s == null) a--;
    let b = i + 1;
    while (b < n && ditas[b].s == null) b++;
    const t0 = a >= 0 ? ditas[a].e : 0;
    const t1 = b < n ? ditas[b].s : (ouvidas.at(-1)?.e ?? t0 + 1);
    ditas[i].s = +(t0 + ((t1 - t0) * (i - a)) / (b - a)).toFixed(3);
    ditas[i].e = +(ditas[i].s + 0.2).toFixed(3);
  }
for (let i = 1; i < n; i++) if (ditas[i].s <= ditas[i - 1].s) ditas[i].s = +(ditas[i - 1].s + 0.02).toFixed(3);
const palavras = ditas.map((x, i) => ({ w: x.w, em: +x.s.toFixed(3), ate: +Math.max(x.s + 0.05, Math.min(x.e, ditas[i + 1]?.s ?? x.e)).toFixed(3) }));
const inicioDaCena = cenas.map((_, k) => palavras[ditas.findIndex((x) => x.cena === k)].em);
cenas.forEach(({ s }, k) => (s.em = inicioDaCena[k]));
roteiro.voz = { ...(roteiro.voz ?? {}), id: voz, velocidade: Number(velocidade) };
fs.writeFileSync(RP, JSON.stringify(roteiro, null, 2));
fs.writeFileSync(path.join(EP, "narracao-tempos.json"), JSON.stringify({ palavras, cenas: inicioDaCena }));

// ——— o SRT: uma legenda por frase curta (até ~42 caracteres), cortada em pontuação e pausa ———
const cues = [];
let at = [];
palavras.forEach((p, k) => {
  at.push(p);
  const txt = at.map((x) => x.w).join(" ");
  const prox = palavras[k + 1];
  // o valor não se parte entre duas legendas: nem "R$" sozinho, nem "6,3" longe de "bilhões"
  if (prox && (p.w === "R$" || (/^\d[\d.,]*$/.test(p.w) && /^(mil|milh|bilh|trilh)/i.test(prox.w)))) return;
  if (!prox || /[.?!…]$/.test(p.w) || (/[,;:]$/.test(p.w) && txt.length > 18) || txt.length > 40 || prox.em - p.ate > 0.7) {
    cues.push({ de: at[0].em, ate: Math.min(p.ate + 0.15, prox ? prox.em - 0.02 : p.ate + 0.6), txt });
    at = [];
  }
});
const ts = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000);
  const mi = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
fs.writeFileSync(path.join(EP, "narracao.srt"), cues.map((c, i) => `${i + 1}\n${ts(c.de)} --> ${ts(c.ate)}\n${c.txt}\n`).join("\n"));
const dur = palavras.at(-1)?.ate ?? 0;
console.log(`${casadas} de ${n} palavras do roteiro casadas com a transcrição (${Math.round((casadas / n) * 100)}%); o resto foi posto entre as vizinhas.`);
console.log(`narracao.mp3 · narracao.srt (${cues.length} legendas) · narracao-tempos.json · ${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")} de fala`);
