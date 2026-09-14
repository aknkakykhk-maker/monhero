// モンヒロビートで1曲遊んだぶんを、クイック∞周回の何周ぶんにするかの決め方を確かめる。
//
//   node tools/mode/rhythm-play-run-loops-check.js
//
// 2026-09-07・ユーザー提案
//   「0〜2、2周回クリア扱い。そこから1分ごとに1周ずつ増える」
//   「あくまでも決められてる曲の時間で決めて、ポーズしたりで掛かってる時間は関係なし」
//   「過去の実績で1回でもクリアしてたらと言う条件にする」
//
// 2026-09-11・ユーザー指示
//   「モンヒロの無限周回での演奏中の周回数を上げたい / 現状の2倍にしても良さそう」
//   「イベント時は対象曲は3倍」
//   → もとの周回数(曲の長さで決まるぶん)へ倍率を掛ける。ふだん×2、開催中のイベントの
//     対象曲だけ×3(重ねがけはしない)。
//
// 数の決め方はゲームの中身そのものなので、実データの式をNode上で動かして確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/10-core.jsx'), 'utf8');

const pickBlock = (startsWith) => {
  const from = src.indexOf(startsWith);
  if (from < 0) throw new Error(`見つかりません: ${startsWith}`);
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return `${src.slice(from, i + 1)};`;
    }
  }
  throw new Error(`終わりが見つかりません: ${startsWith}`);
};
const pickLine = (startsWith) => {
  const from = src.indexOf(startsWith);
  if (from < 0) throw new Error(`見つかりません: ${startsWith}`);
  return src.slice(from, src.indexOf('\n', from));
};
// 複数行にまたがるアロー式は、行末の「;」まで取る。
// ★行数で決め打ちにしない。2行前提にしていたところへ3行の式が来て、
//   式の後半を静かに切り落とし、条件の検査が全部NGになった(2026-09-14)
const pickStatement = (startsWith) => {
  const from = src.indexOf(startsWith);
  if (from < 0) throw new Error(`見つかりません: ${startsWith}`);
  const end = src.indexOf(';\n', from);
  if (end < 0) throw new Error(`終わりが見つかりません: ${startsWith}`);
  return src.slice(from, end + 1);
};

// 「その難易度以上をクイックでクリアしているか」を見るので、難易度の並びが要る
// (2026-09-14。それまでは自分の難易度だけを見ていたので並びは不要だった)。
// 並びは実データのキー順が正本。手で書き写すと難易度が増えたとき検査だけ古くなる
// 難易度の表は 19-difficulties-and-rules.jsx にある(判定そのものは 10-core.jsx)
const difficultySrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/19-difficulties-and-rules.jsx'), 'utf8');
const settingKeys = (pattern, name) => {
  const found = difficultySrc.match(pattern);
  if (!found) throw new Error(`${name}が見つかりません`);
  return [...found[0].matchAll(/^ {2}([A-Za-z_]\w*):/gm)].map(hit => hit[1]);
};
const difficultyOrder = [
  ...settingKeys(/const DIFFICULTY_SETTINGS = \{[\s\S]*?\n\};\n/, '通常難易度の一覧'),
  ...settingKeys(/const QUICK_EXTREME_SETTINGS = Object\.freeze\(\{[\s\S]*?\n\}\);\n/, 'クイックの極限難易度の一覧'),
];
if (difficultyOrder[0] !== 'Beginner') throw new Error('難易度の並びが Beginner で始まらない');

const ctx = { QUICK_DIFFICULTY_SETTINGS: Object.fromEntries(difficultyOrder.map(id => [id, {}])) };
vm.createContext(ctx);
vm.runInContext(`${[
  pickLine('const RHYTHM_PLAY_RUN_LOOP_MIN ='),
  pickLine('const RHYTHM_PLAY_RUN_LOOP_SCALE ='),
  pickLine('const RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE ='),
  pickBlock('const rhythmPlayRunLoops ='),
  pickBlock('const rhythmPlayRunLoopScale ='),
  pickBlock('const quickDifficultiesAtOrAbove ='),
  pickStatement('const isQuickModeClearedAtOrAbove ='),
  pickStatement('const rhythmPlayRunLoopsAllowed ='),
].join('\n')}
globalThis.__x = { rhythmPlayRunLoops, rhythmPlayRunLoopScale, rhythmPlayRunLoopsAllowed,
  RHYTHM_PLAY_RUN_LOOP_MIN, RHYTHM_PLAY_RUN_LOOP_SCALE, RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE };`, ctx);
const { rhythmPlayRunLoops, rhythmPlayRunLoopScale, rhythmPlayRunLoopsAllowed,
  RHYTHM_PLAY_RUN_LOOP_MIN, RHYTHM_PLAY_RUN_LOOP_SCALE, RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE } = ctx.__x;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const min = (m, s = 0) => (m * 60 + s) * 1000;

// ---- 倍率そのもの ----
check('もとの下限は2周', RHYTHM_PLAY_RUN_LOOP_MIN === 2, `${RHYTHM_PLAY_RUN_LOOP_MIN}周`);
check('ふだんは2倍', RHYTHM_PLAY_RUN_LOOP_SCALE === 2, `${RHYTHM_PLAY_RUN_LOOP_SCALE}倍`);
check('イベントの対象曲は3倍', RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE === 3, `${RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE}倍`);

// ---- 曲の長さ → 周回数（ふだん＝2倍） ----
for (const [ms, want, label] of [
  [min(0, 30), 4, '30秒'],
  [min(1, 0), 4, '1分00秒'],
  [min(2, 0), 4, '2分00秒'],
  [min(2, 25), 4, '2分25秒（いま入っている曲）'],
  [min(2, 59), 4, '2分59秒'],
  [min(3, 0), 6, '3分00秒'],
  [min(3, 30), 6, '3分30秒'],
  [min(4, 0), 8, '4分00秒'],
  [min(5, 45), 10, '5分45秒'],
]) {
  check(`${label} は ${want}周ぶん`, rhythmPlayRunLoops(ms) === want, `${rhythmPlayRunLoops(ms)}周`);
}
// 上げる前(倍率1倍)のちょうど2倍になっている。数字を書き換えただけの回帰を防ぐ
for (const ms of [min(0, 30), min(2, 25), min(3, 0), min(5, 45)]) {
  check(`${ms / 1000}秒 は上げる前のちょうど2倍`,
    rhythmPlayRunLoops(ms) === rhythmPlayRunLoops(ms, 1) * 2,
    `${rhythmPlayRunLoops(ms)}周 / もとは${rhythmPlayRunLoops(ms, 1)}周`);
}

// ---- イベントの対象曲は3倍 ----
const event = { songIds: ['monster_hero', 'kaze_ga_soyogu'] };
check('対象曲は3倍', rhythmPlayRunLoopScale('monster_hero', event) === 3);
check('対象外の曲は2倍のまま', rhythmPlayRunLoopScale('crossing_field', event) === 2);
check('イベントが無いときは2倍', rhythmPlayRunLoopScale('monster_hero', null) === 2);
check('壊れたイベント定義でも2倍へ倒す',
  rhythmPlayRunLoopScale('monster_hero', {}) === 2
  && rhythmPlayRunLoopScale('monster_hero', { songIds: 'monster_hero' }) === 2
  && rhythmPlayRunLoopScale(null, event) === 2
  && rhythmPlayRunLoopScale(undefined, event) === 2);
for (const [ms, want, label] of [
  [min(2, 25), 6, '2分25秒'],
  [min(3, 0), 9, '3分00秒'],
]) {
  check(`対象曲の ${label} は ${want}周ぶん`,
    rhythmPlayRunLoops(ms, RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE) === want,
    `${rhythmPlayRunLoops(ms, RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE)}周`);
}
// 倍率は重ねがけしない(3倍のかわりに、であって2倍×3倍ではない)
check('イベントでも2倍×3倍にはしない',
  rhythmPlayRunLoops(min(3, 0), RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE) === 9);
// 壊れた倍率はふだんの倍率へ倒す(0や負で報酬が消えない)
for (const bad of [0, -2, NaN, null, 'たくさん']) {
  check(`おかしな倍率(${String(bad)})はふだんの倍率へ倒す`,
    rhythmPlayRunLoops(min(3, 0), bad) === rhythmPlayRunLoops(min(3, 0)),
    `${rhythmPlayRunLoops(min(3, 0), bad)}周`);
}
// 長い曲ほど得。短い曲で連打しても得にならない
check('長い曲ほど周回数が多い（短い曲の連打が得にならない）',
  rhythmPlayRunLoops(min(5)) > rhythmPlayRunLoops(min(3))
  && rhythmPlayRunLoops(min(3)) > rhythmPlayRunLoops(min(2)));
// 壊れた値・曲が無いときは0周(何も配らない)
for (const bad of [0, -1, NaN, null, undefined, 'abc', Infinity]) {
  check(`おかしな長さ(${String(bad)})では0周`, rhythmPlayRunLoops(bad) === 0, `${rhythmPlayRunLoops(bad)}周`);
}

// ---- 認めてよいかの条件 ----
check('その難易度をクイックでクリア済みなら認める',
  rhythmPlayRunLoopsAllowed('Normal', { Normal: 1 }) === true);
check('何度もクリアしていればもちろん認める',
  rhythmPlayRunLoopsAllowed('Normal', { Normal: 42 }) === true);
check('一度もクリアしていない難易度では認めない',
  rhythmPlayRunLoopsAllowed('Legend', { Normal: 5 }) === false);
// 2026-09-14。AUTO設定の難易度と条件をそろえたときに、上を通した人は下も通るようにした。
// 上を通せた人が下で勝てないことはないので、悪用対策(勝てない難易度で演奏だけ)の趣旨は変わらない
check('上の難易度をクイックでクリアしていれば下の難易度も認める',
  rhythmPlayRunLoopsAllowed('Easy', { Master: 1 }) === true);
check('クリア回数が0なら認めない',
  rhythmPlayRunLoopsAllowed('Normal', { Normal: 0 }) === false);
check('記録そのものが無くても落ちない',
  rhythmPlayRunLoopsAllowed('Normal', null) === false
  && rhythmPlayRunLoopsAllowed('Normal', undefined) === false
  && rhythmPlayRunLoopsAllowed(null, {}) === false);
check('壊れた値は認めない',
  rhythmPlayRunLoopsAllowed('Normal', { Normal: 'たくさん' }) === false
  && rhythmPlayRunLoopsAllowed('Normal', { Normal: -3 }) === false);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
