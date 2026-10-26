#!/usr/bin/env node
// 新曲の音源の「聞き比べ」の材料を作る(2026-10-26・ビート部 リバースくん。テンポ部長の依頼「音源の聞き比べの手順書」)。
//
//   node tools/mode/rhythm-audio-listen.js --in <届いた音源(mp3/m4a/mp4/wav)> [--out <書き出す先>] [--ref <参考の動画か音源>]
//
// 【なぜ要るか】
// 曲名・ジャケットと音源が合っているかを、こちらで確かめる手立てが無かった。最初に届いた音源が別の曲のまま
// 公開し、取り下げて作り直した(2026-10-21 BLACK SHOUT #3253 → #3255)。音を聞けるのは社長だけなので、
// 社長がアプリですぐ聞ける短い音と、数字(長さ・鳴り始め・大きさ)をそろえて「この曲で合っているか」を聞く。
// 参考の動画(プレイ動画・公式の動画など)があるときは、機械でも同じ曲かを突き合わせる。
//
// 【出すもの】
//   ・長さ・鳴り始め(最初に音が出る秒)・鳴り終わり・統合ラウドネス
//   ・聞き比べ用の短い mp3(<out>/listen-1-head.mp3 冒頭15秒・listen-2-peak.mp3 いちばん大きい15秒・listen-3-tail.mp3 終わり10秒)
//   ・--ref のとき: 参考の4か所(各20秒)が音源のどこに当たるか。4か所のずれがそろい、包絡がよく合えば「同じ曲」
//
// 【決め】
//   ・音源そのものは書き換えない(読むだけ)。書き出すのは --out の中だけ(既定はスクラッチの一時フォルダ)
//   ・ffmpeg は環境変数 FF(rhythm-song-add スキルの ffmpeg-static)か、PATH の ffmpeg を使う
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const FF = process.env.FF || 'ffmpeg';
const IN = arg('in'), REF = arg('ref');
if (!IN || !fs.existsSync(IN)) { console.error('使い方: node tools/mode/rhythm-audio-listen.js --in <音源> [--out <書き出す先>] [--ref <参考の動画か音源>]'); process.exit(2); }
if (REF && !fs.existsSync(REF)) { console.error(`参考が見つからない: ${REF}`); process.exit(2); }
const OUT = arg('out') || fs.mkdtempSync(path.join(os.tmpdir(), 'mh-listen-'));
fs.mkdirSync(OUT, { recursive: true });

// 音を 8kHz のモノラルに読み、20ms ごとの大きさ(RMS)にする
const RATE = 8000, HOP = 160, FPS = RATE / HOP;
const decodeMono = (file) => {
  const buf = execFileSync(FF, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
};
const envelope = (x) => {
  const n = Math.floor(x.length / HOP), out = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * HOP; j < (i + 1) * HOP; j++) s += x[j] * x[j]; out[i] = Math.sqrt(s / HOP); }
  return out;
};
const dbfs = (v) => v > 0 ? 20 * Math.log10(v) : -120;
const sec = (frames) => +(frames / FPS).toFixed(2);

// ── 音源の数字 ──
const pcm = decodeMono(IN), env = envelope(pcm);
const lengthSec = +(pcm.length / RATE).toFixed(2);
const SILENT_DB = -40;
const firstLoud = env.findIndex((v) => dbfs(v) > SILENT_DB);
let lastLoud = -1; for (let i = env.length - 1; i >= 0; i--) if (dbfs(env[i]) > SILENT_DB) { lastLoud = i; break; }
const loud = (() => {
  try {
    const log = execFileSync(FF, ['-hide_banner', '-nostats', '-i', IN, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return log;
  } catch (e) { return String(e.stderr || ''); }
})();
const lufs = (loud.match(/I:\s*(-?[\d.]+) LUFS/g) || []).pop();
// いちばん大きい15秒(サビのあたり)。1秒ずつずらして、15秒の大きさの平均がいちばん大きい所
const WIN = 15 * FPS;
let peakAt = 0, peakSum = -1, run = 0;
for (let i = 0; i < env.length; i++) { run += env[i] * env[i]; if (i >= WIN) run -= env[i - WIN] * env[i - WIN]; if (i >= WIN - 1 && (i - WIN + 1) % FPS === 0 && run > peakSum) { peakSum = run; peakAt = i - WIN + 1; } }

console.log(`音源: ${path.basename(IN)}`);
console.log(`  長さ ${lengthSec}秒 / 鳴り始め ${firstLoud >= 0 ? sec(firstLoud) : '?'}秒 / 鳴り終わり ${lastLoud >= 0 ? sec(lastLoud) : '?'}秒 / 統合ラウドネス ${lufs ? lufs.replace(/^I:\s*/, '') : '?'}`);
console.log(`  いちばん大きい15秒: ${sec(peakAt)}〜${sec(peakAt + WIN)}秒`);

// ── 聞き比べ用の短い mp3 ──
const clip = (name, fromSec, durSec) => {
  const file = path.join(OUT, name);
  execFileSync(FF, ['-v', 'error', '-y', '-ss', String(Math.max(0, fromSec)), '-t', String(durSec), '-i', IN, '-vn', '-map_metadata', '-1', '-ac', '2', '-ar', '32000', '-b:a', '96k',
    '-af', `afade=t=in:d=0.2,afade=t=out:st=${Math.max(0, durSec - 0.5)}:d=0.5`, file]);
  return file;
};
const clips = [
  clip('listen-1-head.mp3', firstLoud >= 0 ? sec(firstLoud) : 0, 15),
  clip('listen-2-peak.mp3', sec(peakAt), 15),
  clip('listen-3-tail.mp3', Math.max(0, (lastLoud >= 0 ? sec(lastLoud) : lengthSec) - 10), 10),
];
console.log(`  聞き比べ用: ${clips.join(' / ')}`);

// ── 参考と突き合わせる ──
// 参考の4か所(各20秒)を、音源の全体から探す(参考は曲の一部だけ・ずれも分からない前提)。
// 包絡は平均を引いて比べる(正規化した相互相関)。4か所の「音源の秒 - 参考の秒」がそろえば同じ曲
if (REF) {
  const ref = envelope(decodeMono(REF));
  const LEN = 20 * FPS;
  const corrAt = (a0, b0) => {
    let sa = 0, sb = 0; for (let i = 0; i < LEN; i++) { sa += env[a0 + i]; sb += ref[b0 + i]; }
    const ma = sa / LEN, mb = sb / LEN; let num = 0, da = 0, db = 0;
    for (let i = 0; i < LEN; i++) { const x = env[a0 + i] - ma, y = ref[b0 + i] - mb; num += x * y; da += x * x; db += y * y; }
    return da && db ? num / Math.sqrt(da * db) : -1;
  };
  if (ref.length < LEN + 4 || env.length < LEN + 4) { console.log('参考: 短すぎて突き合わせられない(20秒以上いる)'); process.exit(0); }
  const parts = [];
  for (let k = 0; k < 4; k++) {
    const b0 = Math.floor((ref.length - LEN) * (k + 0.5) / 4);
    let best = { c: -2, a0: 0 };
    for (let a0 = 0; a0 + LEN <= env.length; a0++) { const c = corrAt(a0, b0); if (c > best.c) best = { c, a0 }; }
    parts.push({ refSec: sec(b0), songSec: sec(best.a0), shift: sec(best.a0 - b0), corr: +best.c.toFixed(3) });
  }
  const shifts = parts.map((p) => p.shift), spread = +(Math.max(...shifts) - Math.min(...shifts)).toFixed(2);
  const minCorr = Math.min(...parts.map((p) => p.corr));
  // 同じ曲なら、4か所のずれが 0.1 秒の内にそろう(別の曲では偶然そろわない)。包絡の一致は、プレイ動画の叩く音・声が混ざると下がるので 0.5 を下限にする
  // 実測(2026-10-26): 同じ音源の切り抜き 0.996〜0.998・同じ曲の full と short 0.98〜0.986 / 別の曲はずれが 126 秒ばらけ、一致 0.18〜0.74
  const aligned = spread <= 0.1, same = aligned && minCorr >= 0.5;
  console.log(`参考: ${path.basename(REF)}`);
  parts.forEach((p, i) => console.log(`  ${i + 1}. 参考 ${p.refSec}秒 → 音源 ${p.songSec}秒(ずれ ${p.shift}秒・一致 ${p.corr})`));
  console.log(`  ずれのそろい ${spread}秒 / いちばん低い一致 ${minCorr}`);
  console.log(same ? '  → 同じ曲(参考と音源が合っている)'
    : aligned ? '  → ずれはそろうが一致が低い。同じ曲らしいが、編曲・音の混ざり方が違うかも。社長に聞き比べてもらう'
    : '  → 同じ曲とは言えない。社長に聞き比べてもらう(別の曲か、版・編曲が違うかも)');
}
