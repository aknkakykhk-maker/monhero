const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// プレイヤーが遊ぶモンビーの画面へ、デバッグ専用の表示が出ていないかを見る。
//
//   node tools/mode/rhythm-player-screen-debug-check.js
//
// 【なぜ要るか】
// モンビーはデバッグ画面で作って、あとから体験版の導線をかぶせた。
// そのため演奏画面はデバッグ用の文言をそのまま出していて、プレオープンで公開したあとも
//   ・HUDの「HOLD TEST」「TAP TEST」
//   ・ポーズの「中断して音ゲーデバッグへ戻る」
//   ・ポーズの「座標校正」ボタン
// が、曲えらびから入ったプレイヤーの画面に出たままだった
// (2026-09-05・実機の指摘「ここがデバッグのままになってる」)。
//
// 演奏画面は体験版とデバッグの両方から開くので、画面を2つに分けるのではなく
// 「デバッグから始めたプレイかどうか(debugPlay)」で出し分ける。
// 画面を分けると判定や描画まで二重管理になり、片方だけ直す事故が起きる。
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
const calibration = fs.readFileSync(path.join(web, 'data/rhythm-geometry-calibration.js'), 'utf8');
const calibrationRhythm = fs.readFileSync(path.join(web, 'data/rhythm-mode.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (from, to) => {
  const i = game.indexOf(from);
  const j = game.indexOf(to, i);
  return i >= 0 && j > i ? game.slice(i, j) : '';
};

// ---- 出し分けの土台 ----
check('演奏画面が「デバッグから始めたか」を受け取る',
  /const RhythmTapTest=\(\{[^}]*debugPlay=false,tutorial=false\}\)/.test(game));
check('デバッグ画面から始めたときだけ true になる',
  game.includes("debugPlay={rhythmPlay.from==='debug'}")
  && game.includes("setRhythmPlay({song,difficulty,from:'debug'})"));
check('あそびかた練習も別に見分けている',
  game.includes("tutorial={rhythmPlay.from==='tutorial'}"));
check('画面を2つに分けていない(判定や描画を二重管理しない)',
  (game.match(/const RhythmTapTest=/g) || []).length === 1);

// ---- HUD ----
check('プレイヤーの画面に「HOLD TEST / TAP TEST / MIX TEST」を出さない',
  game.includes("{tutorial?'れんしゅう':debugPlay?debugChartLabel:`Lv.${chart.level}`}"));
// data/rhythm-mode.js が DOM を直接書き換えて 'MIX TEST' にしていた。
// React側で出し分けても、こちらが動いていればプレイヤーの画面へ出てしまう
// (FLICK/SLIDEを含む譜面＝HARD以上のすべての曲で出ていた)
check('データ側からHUDの表記を書き換えていない',
  !/label\.textContent='MIX TEST'/.test(calibrationRhythm)
  && !/querySelector\('\[data-rhythm-mode-label\]'\)/.test(calibrationRhythm));
check('譜面の中身の表記はデバッグのときだけ使う',
  /const debugChartLabel=chart\.notes\.some\(note=>note\.type==='FLICK'\|\|note\.type==='SLIDE'\)\?'MIX TEST'/.test(game));

// ---- ポーズ ----
const pause = grab('data-rhythm-pause-menu', '</div>}</div></main>;');
check('ポーズの戻り先がプレイヤー向けの言い方になる',
  pause.includes("{tutorial?'練習をやめて曲えらびへ戻る':debugPlay?'中断して音ゲーデバッグへ戻る':'中断して曲えらびへ戻る'}"));
// 「中断して」が付く形だけを見ていたため、結果画面の「音ゲーデバッグへ戻る」
// (前置きなし)を素通りさせていた。あそびかた練習を終えた画面にそのまま出ていた
// (2026-09-05・実機の指摘「ここもデバッグに戻るみたいな表記になってる」)。
// 前置きの有無にかかわらず、出し分け無しで書かれていないかを見る
check('「音ゲーデバッグへ戻る」を無条件では出していない',
  ![...game.matchAll(/>[^<>{}]*音ゲーデバッグへ戻る</g)].length);
check('ポーズにデバッグ印を付けるのはデバッグのときだけ',
  pause.includes("data-rhythm-debug-play={debugPlay?'1':undefined}"));

// ---- 座標校正 ----
check('座標校正はデバッグ印の付いたポーズにだけ置く',
  calibration.includes("document.querySelector('[data-rhythm-pause-menu][data-rhythm-debug-play]')")
  && !/mountToggle\(document\.querySelector\('\[data-rhythm-pause-menu\]'\)/.test(calibration));
check('座標校正のトグルを探すときも同じ条件を使う',
  /const pauseMenuNeedsToggle=\(\)=>\{\s*const pause=debugPauseMenu\(\);/.test(calibration));

// ---- 結果画面 ----
// 演奏を終えた画面の戻り先も、ポーズと同じように出し分ける。
// ここだけ更新し忘れており、あそびかた練習の結果に
// 「音ゲーデバッグへ戻る」が出ていた(2026-09-05・実機の指摘)
const result = grab('data-rhythm-result', '</main>}');
check('結果画面の戻り先がプレイヤー向けの言い方になる',
  result.includes("{debugPlay?'音ゲーデバッグへ戻る':'曲えらびへ戻る'}"));

// ---- 取りこぼしの見張り ----
// プレイヤーの画面へ出る文字に「DEBUG」「デバッグ」が混ざっていないか、演奏画面ぶんだけ見る。
// 切り出す終わりを '\nconst RhythmMonsterSlotsPanel' にしていたが、それは
// RhythmTapTest より**前**にあるため、範囲が空になって何も見ていなかった
// (「0件のうち0件」と出ていた)。演奏画面の次に来る定義まで取る
const play = grab('const RhythmTapTest=', '\nfunction MonsterHeroGame()');
const stripped = play.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
for (const word of ['DEBUG', 'デバッグ']) {
  const hits = [...stripped.matchAll(new RegExp(word, 'g'))].length;
  const guarded = [...stripped.matchAll(new RegExp(`debugPlay[^\\n]{0,120}${word}`, 'g'))].length;
  check(`演奏画面の「${word}」はデバッグのときだけ出る`, hits === guarded, `${hits}件のうち${guarded}件が出し分け済み`);
}

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
