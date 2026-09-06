// 演奏中に両サイドへ出るマスモンの大きさが、縦持ちでも横持ちでも
// 「画面に対して同じくらい」に見えるかを確かめる。
//
//   node tools/mode/rhythm-side-monster-size-check.js
//
// 2026-09-07・ユーザー報告
//   「縦画面だと普通だけど横画面だと上側のマスモンがでかく表示されてる」
//
// 大きさは rhythmSideMonsterBox が決めていて、**プレイエリアの幅だけ**を見ていた。
// 横持ちは幅が広く高さが低いので、同じ「幅の◯%」でも画面いっぱいに見えてしまう。
// ここでは実データの式をそのまま動かして、縦持ちと横持ちの見え方をくらべる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-mode.js'), 'utf8');

// このファイルは画面が無いと動かない行(addEventListener など)を持つので、
// 大きさを決めるところだけを切り出して動かす
// 1行で終わる宣言は、その行だけを取る
const pickLine = (startsWith) => {
  const from = src.indexOf(startsWith);
  if (from < 0) throw new Error(`見つかりません: ${startsWith}`);
  return src.slice(from, src.indexOf('\n', from));
};
// 波括弧で囲まれた宣言は、括弧の数を数えて終わりまで取る
// (中に for や if があるので、「最初の };」では切れない)
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

const pieces = [
  pickLine('const RHYTHM_LANE_COUNT = '),
  pickLine('const RHYTHM_PROJECTION_TOP_SCALE='),
  pickLine('const rhythmClamp01='),
  pickLine('const rhythmProjectionScale='),
  pickBlock('const rhythmProjectBoundary='),
  pickLine('const RHYTHM_SIDE_MONSTER_ANCHORS='),
  pickLine('const RHYTHM_SIDE_MONSTER_FILL='),
  pickLine('const RHYTHM_SIDE_MONSTER_MAX_RATIO='),
  pickLine('const RHYTHM_SIDE_MONSTER_HEIGHT_RATIO='),
  pickBlock('const rhythmSideMonsterPlacement='),
  pickBlock('const rhythmSideMonsterBox='),
];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${pieces.join('\n')}
globalThis.__x = { rhythmSideMonsterBox, RHYTHM_SIDE_MONSTER_HEIGHT_RATIO };`, ctx);
const { rhythmSideMonsterBox, RHYTHM_SIDE_MONSTER_HEIGHT_RATIO } = ctx.__x;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 実機に近い大きさ。プレイエリアはヘッダーを除いたぶん
const CASES = [
  { tag: '縦持ち(iPhone)', w: 390, h: 760 },
  { tag: '横持ち(iPhone)', w: 844, h: 330 },
  { tag: '横持ち(大きめ)', w: 1200, h: 500 },
];

const boxes = (w, h) => [1, 2, 3, 4].map((slot) => rhythmSideMonsterBox(slot, w, h));

for (const { tag, w, h } of CASES) {
  const list = boxes(w, h);
  const worst = Math.max(...list.map((b) => b.size / h));
  // ★高さに対して大きくなりすぎないこと。ここが横持ちで崩れていた
  check(`${tag}: 画面の高さに対して大きくなりすぎない`, worst <= RHYTHM_SIDE_MONSTER_HEIGHT_RATIO + 0.001,
    `いちばん大きい子が高さの ${(worst * 100).toFixed(1)}%（上限 ${(RHYTHM_SIDE_MONSTER_HEIGHT_RATIO * 100).toFixed(0)}%）`);
  // 画面からはみ出さない
  check(`${tag}: 画面からはみ出さない`,
    list.every((b) => b.left >= -1 && b.left + b.size <= w + 1 && b.top >= -1 && b.top + b.size <= h + 1));
  // 小さくなりすぎない(見えなくなっては意味がない)
  check(`${tag}: 小さくなりすぎない`, list.every((b) => b.size >= 24), `最小 ${Math.min(...list.map((b) => b.size)).toFixed(0)}px`);
}

// ★縦持ちと横持ちで「画面に対する見え方」が近いこと。
//   幅だけで決めていたころは、横持ちのほうが 2〜3倍 大きく見えていた
const ratioOf = (w, h) => Math.max(...boxes(w, h).map((b) => b.size / Math.min(w, h)));
const portrait = ratioOf(390, 760);
const landscape = ratioOf(844, 330);
check('縦持ちと横持ちで見え方がそろっている', Math.abs(portrait - landscape) <= 0.08,
  `縦 ${(portrait * 100).toFixed(1)}% / 横 ${(landscape * 100).toFixed(1)}%（短いほうの辺に対する割合）`);

// 上の段(奥)だけが極端に大きくならないこと。報告はまさにここだった
for (const { tag, w, h } of CASES) {
  const list = boxes(w, h);
  const top = Math.max(list[0].size, list[1].size);
  const bottom = Math.max(list[2].size, list[3].size);
  check(`${tag}: 上の段だけが極端に大きくない`, top <= bottom * 1.8,
    `上 ${top.toFixed(0)}px / 下 ${bottom.toFixed(0)}px`);
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
