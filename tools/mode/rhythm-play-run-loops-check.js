// モンヒロビートで1曲遊んだぶんを、クイック∞周回の何周ぶんにするかの決め方を確かめる。
//
//   node tools/mode/rhythm-play-run-loops-check.js
//
// 2026-09-07・ユーザー提案
//   「0〜2、2周回クリア扱い。そこから1分ごとに1周ずつ増える」
//   「あくまでも決められてる曲の時間で決めて、ポーズしたりで掛かってる時間は関係なし」
//   「過去の実績で1回でもクリアしてたらと言う条件にする」
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
// 2行にまたがるアロー式(条件のほう)は、その次の行まで取る
const pickTwoLines = (startsWith) => {
  const from = src.indexOf(startsWith);
  if (from < 0) throw new Error(`見つかりません: ${startsWith}`);
  const first = src.indexOf('\n', from);
  return src.slice(from, src.indexOf('\n', first + 1));
};

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${[
  pickLine('const RHYTHM_PLAY_RUN_LOOP_MIN ='),
  pickBlock('const rhythmPlayRunLoops ='),
  pickTwoLines('const rhythmPlayRunLoopsAllowed ='),
].join('\n')}
globalThis.__x = { rhythmPlayRunLoops, rhythmPlayRunLoopsAllowed, RHYTHM_PLAY_RUN_LOOP_MIN };`, ctx);
const { rhythmPlayRunLoops, rhythmPlayRunLoopsAllowed, RHYTHM_PLAY_RUN_LOOP_MIN } = ctx.__x;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const min = (m, s = 0) => (m * 60 + s) * 1000;

// ---- 曲の長さ → 周回数 ----
check('下限は2周', RHYTHM_PLAY_RUN_LOOP_MIN === 2, `${RHYTHM_PLAY_RUN_LOOP_MIN}周`);
for (const [ms, want, label] of [
  [min(0, 30), 2, '30秒'],
  [min(1, 0), 2, '1分00秒'],
  [min(2, 0), 2, '2分00秒'],
  [min(2, 25), 2, '2分25秒（いま入っている曲）'],
  [min(2, 59), 2, '2分59秒'],
  [min(3, 0), 3, '3分00秒'],
  [min(3, 30), 3, '3分30秒'],
  [min(4, 0), 4, '4分00秒'],
  [min(5, 45), 5, '5分45秒'],
]) {
  check(`${label} は ${want}周ぶん`, rhythmPlayRunLoops(ms) === want, `${rhythmPlayRunLoops(ms)}周`);
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
