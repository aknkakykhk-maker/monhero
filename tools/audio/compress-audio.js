const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 配信するBGM(MP3)のビットレートをそろえて軽くする。
//
//   node audio/compress-audio.js                # どの曲が対象になるかだけ表示(書き換えない)
//   node audio/compress-audio.js --write        # 実際に書き換える
//   node audio/compress-audio.js --bitrate 112 --write
//
// 【なぜ道具にするか】
// BGMは受け取るたびに書き出し設定がばらばらで、同じゲームの中に56kbpsの曲と
// 190kbpsの曲が混ざっていた。高いほうの8曲だけで20MBあり、配信サイズの大半を
// 占めていた。曲を足すたびに手作業で確かめるのは抜けるので、
// 「狙いより明らかに高い曲だけ作り直す」形にして機械的にそろえる。
//
// やること
//   ① 各MP3の実効ビットレートを測る
//   ② 狙いより十分高い曲だけを、狙いのビットレートで作り直す
//      (すでに狙い以下の曲は触らない。作り直すたびに音は劣化するので、
//       縮まないのに掛け直すのは損しかない)
//   ③ 作り直したあとにデコードして、長さが1サンプルも変わっていないことを確かめる
//
// 【なぜ長さを確かめるのか】
// BGMはループ再生している。MP3は書き出しのときに先頭と末尾へ無音の詰め物が入るため、
// 作り直すとループのつなぎ目に隙間が生まれることがある。デコード後のサンプル数が
// 変わっていなければ、つなぎ目の聞こえ方はこれまでと同じだと確かめられる。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const AUDIO_DIR = path.join(REPO_ROOT, 'monster-hero/audio');

const args = process.argv.slice(2);
const write = args.includes('--write');
const bIdx = args.indexOf('--bitrate');
// 狙いのビットレート。96kbpsは、スマホのスピーカー・イヤホンでは元との違いがまず分からず、
// 190kbpsの曲を半分以下にできる兼ね合いの良いところ
const TARGET_KBPS = bIdx >= 0 ? Math.max(48, Number(args[bIdx + 1]) || 96) : 96;
// 狙いに近い曲まで作り直すと、縮まないのに音だけ劣化する。十分に高い曲だけを対象にする
const REENCODE_ABOVE = TARGET_KBPS * 1.3;

const run = (a) => execFileSync(ffmpeg, a, { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
const probe = (file) => {
  let out = '';
  try { run(['-hide_banner', '-i', file]); } catch (e) { out = String(e.stderr || ''); }
  const m = out.match(/Audio: .*?(\d+) kb\/s/);
  const d = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return {
    kbps: m ? Number(m[1]) : 0,
    seconds: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
  };
};
// デコードしたサンプル数(ループのつなぎ目が変わっていないかの確認に使う)。
// 数分の曲は生の音声にすると数十MBになり、パイプで受け取ると溢れるので一度ファイルへ書き出す
const sampleCount = (file) => {
  const raw = path.join(AUDIO_DIR, '.tmp-decode.raw');
  run(['-v', 'error', '-y', '-i', file, '-f', 's16le', '-ac', '2', '-ar', '44100', raw]);
  const n = fs.statSync(raw).size / 4;
  fs.unlinkSync(raw);
  return n;
};

// 途中で止まったときに残る作業ファイル(.tmp-*)は対象にしない
const files = fs.readdirSync(AUDIO_DIR).filter((f) => !f.startsWith('.') && f.toLowerCase().endsWith('.mp3')).sort();
let before = 0, after = 0, changed = 0, skipped = 0;
const problems = [];
for (const name of files) {
  const file = path.join(AUDIO_DIR, name);
  const orig = fs.statSync(file).size;
  before += orig;
  const info = probe(file);
  if (info.kbps < REENCODE_ABOVE) {
    console.log(`そのまま ${name} — ${info.kbps}kbps / ${(orig/1024).toFixed(0)}KB (狙い${TARGET_KBPS}kbpsに近いので触りません)`);
    after += orig; skipped++; continue;
  }
  const tmp = path.join(AUDIO_DIR, `.tmp-${name}`);
  run(['-v', 'error', '-y', '-i', file, '-c:a', 'libmp3lame', '-b:a', `${TARGET_KBPS}k`, '-ar', '44100', tmp]);
  const size = fs.statSync(tmp).size;
  // ループのつなぎ目が変わっていないこと
  const [a, b] = [sampleCount(file), sampleCount(tmp)];
  if (a !== b) {
    problems.push(`${name}: 作り直すと長さが ${a} → ${b} サンプルに変わります(ループのつなぎ目がずれます)`);
    fs.unlinkSync(tmp); after += orig; skipped++; continue;
  }
  console.log(`${write ? '圧縮' : '圧縮予定'} ${name} — ${info.kbps}kbps ${(orig/1024).toFixed(0)}KB → ${TARGET_KBPS}kbps ${(size/1024).toFixed(0)}KB (${((1-size/orig)*100).toFixed(0)}%減) / 長さは ${a} サンプルのまま`);
  if (write) fs.renameSync(tmp, file); else fs.unlinkSync(tmp);
  after += size; changed++;
}
console.log(`\n${files.length}曲 — ${write ? '圧縮した' : '圧縮できる'} ${changed}曲 / そのまま ${skipped}曲`);
console.log(`合計 ${(before/1024/1024).toFixed(1)}MB → ${(after/1024/1024).toFixed(1)}MB (${((1-after/before)*100).toFixed(0)}%減)`);
if (problems.length) { problems.forEach((p) => console.log('NG: ' + p)); process.exitCode = 1; }
if (!write) console.log('※ --write を付けると実際に書き換えます');
