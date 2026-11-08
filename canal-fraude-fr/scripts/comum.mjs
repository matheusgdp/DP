// Compartilhado pelos scripts: onde está o canal, os níveis, ffmpeg, medição de loudness e o .srt.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// sem canal.json acima da pasta: --canal, a variável CANAL_DIR ou a pasta atual
export const CANAL_PADRAO = process.env.CANAL_DIR || process.cwd();
export const args = process.argv.slice(2);
export const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
export const tem = n => args.includes('--' + n);
// os argumentos que não são opção nem valor de opção
export const posicional = (comValor = []) => args.filter((a, i) => !a.startsWith('--') && !comValor.includes(args[i - 1]?.replace(/^--/, '')));

// Os níveis do canal (canal.json → "niveis" sobrescreve). Voz e telejornal no mesmo plano; trilha ~20 dB sob a voz,
// mais 6 dB abaixo sob o telejornal; master -14 LUFS / -1 dBTP.
export const NIVEIS = {
  voz_lufs: -16, extrait_lufs: -17, master_lufs: -14, master_tp: -1, max_efeitos_min: 10,
  longo: { cama_db: -13, sob_voz_db: -20, extrait_db: -6, xfade: 2 },
  short: { cama_db: -10, sob_voz_db: -16, extrait_db: -4, xfade: 1 },
};

export function acharCanal(de) {
  let d = path.resolve(de || '.');
  for (let i = 0; i < 6; i++) { if (fs.existsSync(path.join(d, 'canal.json'))) return d; const p = path.dirname(d); if (p === d) break; d = p; }
  return CANAL_PADRAO;
}
export const lerJSON = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')) : d;
export const gravarJSON = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(x, null, 2)); };
export function lerCanal(dir) {
  const c = lerJSON(path.join(dir, 'canal.json'), {}), n = c.niveis || {};
  return { ...c, dir, niveis: { ...NIVEIS, ...n, longo: { ...NIVEIS.longo, ...n.longo }, short: { ...NIVEIS.short, ...n.short } } };
}

export const ff = (a, msg = 'ffmpeg') => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status) throw new Error(`${msg} falhou: ${(r.stderr || '').slice(-900)}`);
};
// roda o ffmpeg só para ler o que ele imprime (medições, detecção de silêncio e de cena)
export const ffLer = a => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || '';
export const duracao = f => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
export const pico = f => +((ffLer(['-i', f, '-af', 'volumedetect', '-f', 'null', '-']).match(/max_volume: (-?[\d.]+)/) || [])[1] ?? 0);

// loudness integrada (LUFS) de um arquivo, de um trecho (de, dur) ou do que passar pelo filtro "pre" (ex.: aselect)
export function medir(f, pre = '', de = null, dur = null) {
  const e = ffLer([...(de != null ? ['-ss', String(de), '-t', String(dur)] : []), '-i', f, '-vn', '-af', `${pre}loudnorm=I=-16:TP=-1:LRA=11:print_format=json`, '-f', 'null', '-']);
  const j = e.slice(e.lastIndexOf('{'));
  try { const o = JSON.parse(j.slice(0, j.indexOf('}') + 1)); return { ...o, i: Number(o.input_i) }; } catch { return { i: NaN }; }
}

export function lerSRT(f) {
  const t = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r/g, '');
  const seg = s => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : NaN; };
  return t.split(/\n\s*\n/).map(b => {
    const l = b.trim().split('\n'), i = l.findIndex(x => x.includes('-->'));
    if (i < 0) return null;
    const [a, z] = l[i].split('-->');
    return { a: seg(a), b: seg(z), texto: l.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim() };
  }).filter(x => x && Number.isFinite(x.a) && Number.isFinite(x.b)).sort((x, y) => x.a - y.a);
}

export const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const pastaSons = canal => path.join(canal, '_sons');
export const pastaTrilhas = canal => path.join(canal, '_trilhas');
