const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンヒロビートの自己ベスト(mh_rhythm_best_v1)を読み直すとき、この版が知らない難易度の記録を捨てないことを見張る。
//
//   node tools/mode/rhythm-best-keep-unknown-difficulty-check.js
//
// 【なぜ要るか】
// 2026-10-10、MASTER の上に6段目の難易度を足す方針になった(sheriruth の空中ノーツ)。
// それまでの normalizeRhythmBestRecords は RHYTHM_DIFFICULTIES に載っている5つだけで記録を作り直していたので、
// 6段目を出したあと、古い版のまま開きっぱなしの端末が自己ベストを保存し直すと、6段目の記録だけが消える。
// 一度消えた記録は戻せない(CLAUDE.md ⑦)。6段目より先にこの直しを出しておく。
//
// 見張ること
//   ① 知っている難易度の読み方は今までどおり(壊れた値は既定値で補う)
//   ② 知らない難易度の記録は、そのままの形で残る
//   ③ 難易度らしくないキー・オブジェクトでない値は残さない(ゴミを溜めない)
//   ④ 知らない曲の記録はこれまでどおり持たない(遊んだ曲の数・実績の台帳の数え方を変えない)
//   ⑤ 保存の入口 saveRhythmBestRecord が normalizeRhythmBestRecords を通している
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const partPath = path.join(root, 'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
const storagePath = path.join(root, 'monster-hero/src/parts/25-storage.jsx');
const part = fs.readFileSync(partPath, 'utf8');
const storage = fs.readFileSync(storagePath, 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 定義を1つ切り出す(「const 名前 = 」から、行頭の「};」まで)
const pick = (source, name) => {
  const start = source.indexOf(`const ${name} = `);
  if (start < 0) return null;
  const end = source.indexOf('\n};', start);
  return end < 0 ? null : source.slice(start, end + 3);
};
const one = pick(part, 'normalizeRhythmBestRecord');
const all = pick(part, 'normalizeRhythmBestRecords');
check('normalizeRhythmBestRecord と normalizeRhythmBestRecords が見つかる', !!one && !!all);
if (!one || !all) process.exit(1);

const ctx = {
  RHYTHM_SONGS: [{ songId: 'song_a' }, { songId: 'song_b' }],
  RHYTHM_DIFFICULTIES: ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'].map((id) => ({ id })),
  RHYTHM_JUDGMENT_IDS: ['MARVELOUS', 'EXCELLENT', 'GREAT', 'GOOD', 'BAD', 'MISS'],
  Object, Number, Math, Array, JSON, String,
};
vm.runInNewContext(`${one}\n${all}\nthis.normalize = normalizeRhythmBestRecords;`, ctx);
const normalize = ctx.normalize;

const newRecord = { bestScore: 1080000, maxCombo: 900, played: true, clear: true, fullCombo: false, rank: 'S', extra: { x: 1 } };
const saved = {
  song_a: {
    MASTER: { bestScore: '950000', maxCombo: 700, clear: true },
    EXPERT: 'こわれた値',
    ZENITH: newRecord,
    lowercase: { bestScore: 1 },
    BROKEN: [1, 2, 3],
    NULLISH: null,
  },
  song_b: { HARD: { bestScore: 12, played: true } },
  removed_song: { MASTER: { bestScore: 5, played: true } },
};
const out = JSON.parse(JSON.stringify(normalize(saved)));

check('① 知っている難易度は今までどおり数に直す', out.song_a.MASTER.bestScore === 950000 && out.song_a.MASTER.played === true);
check('① 壊れた値は既定値で補う', out.song_a.EXPERT.bestScore === 0 && out.song_a.EXPERT.played === false);
check('① 記録の無い難易度も既定値で5つそろう', ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'].every((id) => out.song_a[id] && out.song_b[id]));
check('② 知らない難易度の記録がそのまま残る', JSON.stringify(out.song_a.ZENITH) === JSON.stringify(newRecord), JSON.stringify(out.song_a.ZENITH));
check('③ 難易度らしくないキーは残さない', !('lowercase' in out.song_a));
check('③ オブジェクトでない値は残さない', !('BROKEN' in out.song_a) && !('NULLISH' in out.song_a));
check('④ 知らない曲の記録はこれまでどおり持たない', !('removed_song' in out), Object.keys(out).join(','));
check('④ 曲の並びは RHYTHM_SONGS のまま', JSON.stringify(Object.keys(out)) === JSON.stringify(['song_a', 'song_b']));

// 読み直しを2回通しても変わらない(保存のたびに崩れていかない)
const twice = JSON.parse(JSON.stringify(normalize(normalize(saved))));
check('読み直しを2回通しても同じ', JSON.stringify(twice) === JSON.stringify(out));

// 何も無い・壊れた保存値
const empty = JSON.parse(JSON.stringify(normalize(null)));
check('保存値が無いときは5難易度の既定値だけ', Object.keys(empty.song_a).length === 5);
check('配列が入っていても落ちない', Object.keys(JSON.parse(JSON.stringify(normalize([1, 2])))).length === 2);

// ⑤ 保存の入口
const save = pick(storage, 'saveRhythmBestRecord');
check('⑤ saveRhythmBestRecord が normalizeRhythmBestRecords を通して保存する', !!save && /normalizeRhythmBestRecords\(records\)/.test(save) && /storeSet\(RHYTHM_BEST_RECORDS_KEY,normalized/.test(save));

console.log(failed ? `\n${failed}件のNG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
