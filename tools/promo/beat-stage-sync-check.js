#!/usr/bin/env node
// 紹介動画「HELL の見どころ」の、音と映像のずれを場面ごとに数値で出す(2026-11-24 第3版・窓口の指摘「0:23 音ずれてる」から)。
//
//   node tools/promo/beat-stage-sync-check.js tools/promo/beat-stage-3.json --work tools/out/<フォルダ>
//
// 映像の側: 判定の文字の欄(演奏の画面の真ん中の帯)が前のコマから変わった量(判定が出た瞬間に跳ねる)。
// 音の側:
//   ・演奏の3曲 … 完成 MP4 の音からタップ音の立ち上がり(高い音の急な増え)を拾う
//   ・記念ステージ(冒頭)… 見本の冒頭の音のまま使っているので、同じく完成 MP4 の音から拾う
// 2つの並びの相関がいちばん高くなる「ずれ」(コマ)を出す。正なら映像が音より遅い。±1コマ以内なら OK
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(path.resolve(argv.find(a => a.endsWith('.json'))), 'utf8'));
const FPS = 60, video = path.resolve(ROOT, plan.output);
const raw = (args, bytes) => { const r = spawnSync('ffmpeg', ['-v', 'error', ...args, '-'], { maxBuffer: 1 << 30 }); if (r.status !== 0) throw new Error(String(r.stderr)); return r.stdout; };
// 映像: 区間 [t0, t0+d] の判定の文字の欄の、コマごとの変わり方
const motion = (t0, d, y) => {
  const W = 180, H = 30, buf = raw(['-ss', String(t0), '-t', String(d), '-i', video, '-vf', `crop=360:60:180:${y},scale=${W}:${H},format=gray`, '-f', 'rawvideo'], 0);
  const n = Math.floor(buf.length / (W * H)), out = new Float64Array(n);
  for (let k = 1; k < n; k++) { let s = 0; for (let i = 0; i < W * H; i++) s += Math.abs(buf[k * W * H + i] - buf[(k - 1) * W * H + i]); out[k] = s; }
  return out;
};
// 音: 区間の音を 2kHz より上だけにして、1コマごとの大きさの増え(立ち上がり)
const onsets = (t0, d) => {
  const SR = 48000, buf = raw(['-ss', String(t0), '-t', String(d), '-i', video, '-vn', '-af', 'highpass=f=3000', '-ac', '1', '-ar', String(SR), '-f', 's16le'], 0);
  const s = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2)), per = SR / FPS, n = Math.floor(s.length / per), e = new Float64Array(n);
  for (let k = 0; k < n; k++) { let a = 0; for (let i = 0; i < per; i++) { const v = s[k * per + i]; a += v * v; } e[k] = Math.sqrt(a / per); }
  const o = new Float64Array(n); for (let k = 1; k < n; k++) o[k] = Math.max(0, e[k] - e[k - 1]);
  return o;
};
const norm = (x) => { const m = x.reduce((a, b) => a + b, 0) / x.length; const y = x.map(v => v - m); const s = Math.sqrt(y.reduce((a, b) => a + b * b, 0)) || 1; return y.map(v => v / s); };
const bestLag = (vid, aud, R = Number(process.env.SYNC_RANGE) || 20) => {
  const a = norm(Array.from(aud)), v = norm(Array.from(vid)); let best = { lag: 0, c: -1 };
  for (let L = -R; L <= R; L++) { let c = 0; for (let k = 0; k < a.length; k++) { const j = k + L; if (j >= 0 && j < v.length) c += a[k] * v[j]; } if (c > best.c) best = { lag: L, c }; }
  return best;
};
const T = Object.assign({ stageStart: 37.9667, stageDur: 30 }, plan.template || {});
const scenes = [{ name: '記念ステージ(冒頭)', t0: 20.05, d: 5.2, y: 456 + 160 }]
  .concat(plan.songs.map((s, i) => ({ name: s.songId, t0: T.stageStart + i * T.stageDur + 0.5, d: T.stageDur - 1.5, y: 468 + 165 })));
let bad = 0;
for (const sc of scenes) {
  const r = bestLag(motion(sc.t0, sc.d, sc.y), onsets(sc.t0, sc.d));
  const ok = Math.abs(r.lag) <= 1; if (!ok) bad++;
  console.log(`${ok ? 'OK' : 'NG'}: ${sc.name} ${sc.t0.toFixed(1)}秒〜 映像のずれ ${r.lag >= 0 ? '+' : ''}${r.lag}コマ(${(r.lag * 1000 / FPS).toFixed(0)}ms・相関 ${r.c.toFixed(2)})`);
}
process.exit(bad ? 1 : 0);
