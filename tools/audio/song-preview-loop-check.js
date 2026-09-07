// 曲えらびの試聴が、曲の終わりで無音にならず輪になっているかを見張る。
//
//   node tools/audio/song-preview-loop-check.js
//
// 2026-09-07・ユーザー指示
//   「曲選択時、曲が流れるが最後まで行くとそのまま終わって無音になる。ループするようにして」
//
// 音そのものはこの環境で鳴らせない(Audio_ はモジュールの中で、外から掴めない)ため、
// 作りを静的に見る。
//
// ★大事なのは「輪にするのは試聴だけ」ということ。演奏の本体まで輪にすると、
//   曲が終わってもリザルトへ行かず、譜面の終わりを越えて鳴り続けてしまう。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const files = [
  { file: 'monster-hero/src/parts/14-audio.jsx', kind: 'src' },
  { file: 'monster-hero/src/parts/60-app.jsx', kind: 'src' },
  { file: 'monster-hero/game-system.compiled.js', kind: 'compiled' },
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const compactOf = (rel) => read(rel).replace(/\s+/g, '');

// ---- 鳴らす側 ----
for (const rel of ['monster-hero/src/parts/14-audio.jsx', 'monster-hero/game-system.compiled.js']) {
  const compact = compactOf(rel);
  check(`${rel}: 輪にするかどうかを受け取れる`, compact.includes("constloop=options?.loop===true;"));
  check(`${rel}: 受け取った指定をそのまま音へ渡す`, compact.includes('nextSource.loop=loop;'));
  check(`${rel}: 既定は輪にしない（演奏の本体は1回で終わる）`, !compact.includes('nextSource.loop=true;'));
}

// ---- 呼ぶ側 ----
for (const rel of ['monster-hero/src/parts/60-app.jsx', 'monster-hero/game-system.compiled.js']) {
  const src = read(rel);
  const compact = compactOf(rel);
  check(`${rel}: 曲えらびの試聴だけ輪にする`,
    /rhythmPreviewTrackId[\s\S]{0,200}?\{\s*loop:\s*true\s*\}/.test(src));
  // 輪にする指定は1か所だけ(演奏やBGMへ広がっていない)
  const loops = (compact.match(/\{loop:true\}/g) || []).length;
  check(`${rel}: 輪にするのはその1か所だけ`, loops === 1, `${loops}か所`);
}

// ---- 演奏の本体は輪にしない ----
const playSrc = read('monster-hero/src/parts/30-rhythm-play.jsx');
check('演奏の本体は輪にしない', !/loop:\s*true/.test(playSrc));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
