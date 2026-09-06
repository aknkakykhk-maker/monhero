// モンビーを開いたままクイック∞周回を続けているあいだ、
// バトル側の見た目がモンビーの画面へはみ出さないことを静的に確かめる
// (docs/spec/QUICK_RHYTHM_LINK.md PR4-2)。
//
//   node tools/mode/rhythm-background-view-check.js
//
// 2026-09-06・ユーザー報告
//   「演出が残ってた（画面が揺れるなど）」
//   「超省エネではまだいけない」
//   「オートの下よりBGMの上か下のほうが配置的に良さそう」
//
// 画面の揺れ・全画面演出・超省エネの暗幕は、どれも gameState を見ずに
// アプリ全体へ掛かる作りだったため、裏で進んでいるだけのバトルの演出が
// 曲えらびや演奏の画面まで届いていた。実ブラウザ検査(rhythm-background-run-check.js)は
// 「画面が飛ばないこと」しか見ていないので、こちらで条件式そのものを見張る。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const files = [
  path.join(root, 'monster-hero/src/parts/60-app.jsx'),
  path.join(root, 'monster-hero/game-system.compiled.js'),
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  // 生成物は空白を入れて整形されるので、空白を落としてから見る
  const compact = src.replace(/\s+/g, '');

  check(`${rel}: モンビーを開いている間は画面を揺らさない`,
    compact.includes('screenShake&&!ecoBattleView&&!rhythmScreenOpen?'));
  // 生成物は `&&/*#__PURE__*/React.createElement(` の形になるので、条件式までを見る
  check(`${rel}: モンビーを開いている間は全画面演出を出さない`,
    compact.includes('effect&&!rhythmScreenOpen&&'));
  check(`${rel}: モンビーを開いている間は超省エネの暗幕を外す`,
    compact.includes('ultraEcoSession&&!rhythmScreenOpen&&'));

  // 入口は通常のバトル画面と超省エネの簡易画面の両方に置く。
  // 片方にしか無いと「超省エネではモンビーへ行けない」になる
  const entryDefs = (src.match(/data-quick-to-rhythm/g) || []).length;
  check(`${rel}: モンビーへの入口は1か所で作って使い回す`, entryDefs === 1, `${entryDefs}か所`);
  const entryUses = (src.match(/quickToRhythmButtonNode/g) || []).length;
  check(`${rel}: 通常のバトル画面と超省エネの両方へ置いている`, entryUses >= 3, `定義1 + 設置${entryUses - 1}`);
  // 🎵BGMのすぐ下に置く(AUTOの縦列へ戻していない)
  check(`${rel}: 入口は🎵BGMボタンと同じ縦列にある`,
    /data-auto-bgm-button[\s\S]{0,900}?quickToRhythmButtonNode/.test(src));
  check(`${rel}: 入口をAUTOの縦列へ戻していない`,
    !/aria-label=\{?`?AUTO[\s\S]{0,400}?data-quick-to-rhythm/.test(src));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
