#!/usr/bin/env node
// モンヒロビートの中から開く画面の名前(gameState)が、RHYTHM_ で始まっているかを見る。
//
//   node tools/boot/rhythm-screen-prefix-check.js
//
// 【なぜ要るか】
// ゲームは「いまの画面の名前が RHYTHM_ で始まるか」でモンヒロビートの中かどうかを決めている
// (60-app.jsx の isRhythmScreen)。始まらない画面へ移ると「モンヒロビートを離れた」と判断され、
// 裏で進んでいたクイックの∞周回が、次のWAVEの境で画面をバトルへ切り替えてしまう。
// 見た目も例外も出ず、周回していない人には起きないので気づけない。
//   ・2026-09-12 「モンビー中にオプションに行くとたまに強制でバトルに飛ばされる」
//   ・2026-10-07 「ビートLvを押すとバトル画面に移動する」(マスモン一覧の名前が MASU_BEAT だった)
// 同じ壊れ方を2回しているので、ここで機械的に押さえる。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// モンヒロビートの画面(モードえらび・マルチ)に渡している「別の画面を開く関数」を探し、
// その中で開く画面の名前を集める。いまは マスモン一覧(openMasuBeat)。足したらここへ並べる
const opener = (name) => {
  const m = app.match(new RegExp(`const ${name} = [^\\n]*`));
  return m ? m[0] : '';
};
const OPENERS = ['openMasuBeat'];
for (const name of OPENERS) {
  const line = opener(name);
  check(`${name} を見つけられる`, !!line);
  const opened = [...line.matchAll(/setGameState\('([A-Z_]+)'\)/g)].map((m) => m[1]);
  const bad = opened.filter((s) => !s.startsWith('RHYTHM_') && !['MB_MANAGEMENT', 'RHYTHM_MODE_SELECT'].includes(s));
  check(`${name} が開く画面の名前は RHYTHM_ で始まる`, opened.length > 0 && bad.length === 0, bad.length ? `始まらない: ${bad.join(', ')}` : opened.join(', '));
  for (const screen of opened.filter((s) => s.startsWith('RHYTHM_'))) {
    const list = (app.match(/const RHYTHM_BACKGROUND_RUN_SCREENS = \[([^\]]*)\]/) || [])[1] || '';
    check(`${screen} は、裏で周回を続けてよい画面の一覧に入っている`, list.includes(`'${screen}'`));
  }
}
check('モンヒロビートの中かどうかの判定は、画面の名前の頭文字で見ている',
  app.includes("const isRhythmScreen = state => typeof state === 'string' && state.startsWith('RHYTHM_');"));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
