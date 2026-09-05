const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンビーのホームにある「縦⇄横」切り替えボタンを見る。
//
//   node tools/mode/rhythm-orientation-toggle-check.js
//
// 【なぜ要るか】
// 端末の画面回転ロックを入れていると、本体を横にしても画面は縦のままになる。
// モンビーは横画面のほうが見やすいのに、設定アプリまで戻らないと横にできなかった
// (2026-09-05・ユーザー指示「縦なら横に横なら縦に変わるボタン」)。
//
// 画面の向きの固定(screen.orientation.lock)は、
//   ・全画面表示のあいだしか許さないブラウザが多い
//   ・iOSのSafariのように lock() 自体が無い環境もある
// ため、素直に呼ぶだけでは「押しても何も起きない」で終わる。
// ここでは偽のブラウザを用意して本体の関数をそのまま動かし、
//   ① 全画面へ入ってから固定していること
//   ② 縦へ戻すときは全画面も抜けること
//   ③ 回せない端末では false を返し、案内を出せること
// を確かめる。文面の一致だけでは、この3つはどれも見抜けない。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const game = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

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

// ---- 本体の関数をそのまま動かす ----
const logic = grab('const screenOrientationApi=', 'const RhythmOrientationButton=');
check('向きを切り替える処理がひとまとまりになっている', logic.length > 0);

// 偽のブラウザ。lock/unlock/全画面の呼ばれ方を記録する
const makeWorld = ({ hasLock = true, lockFails = false, startLandscape = false } = {}) => {
  const calls = [];
  const state = { type: startLandscape ? 'landscape-primary' : 'portrait-primary', fullscreen: null };
  const orientation = { get type(){ return state.type; } };
  if (hasLock) {
    orientation.lock = async (want) => {
      calls.push(`lock:${want}`);
      if (lockFails) throw new Error('NotSupportedError');
      state.type = `${want}-primary`;
    };
    orientation.unlock = () => { calls.push('unlock'); };
  }
  const documentStub = {
    documentElement: { requestFullscreen: async () => { calls.push('requestFullscreen'); state.fullscreen = 'root'; } },
    get fullscreenElement(){ return state.fullscreen; },
    exitFullscreen: async () => { calls.push('exitFullscreen'); state.fullscreen = null; },
  };
  const windowStub = {
    screen: { orientation },
    innerWidth: startLandscape ? 800 : 400, innerHeight: startLandscape ? 400 : 800,
    matchMedia: (q) => ({ matches: /landscape/.test(q) === state.type.startsWith('landscape') }),
  };
  const context = { window: windowStub, document: documentStub, screen: windowStub.screen };
  vm.createContext(context);
  vm.runInContext(`${logic}\nglobalThis.x={orientationIsLandscape,applyScreenOrientation,releaseScreenOrientation,screenOrientationApi};`, context);
  return { ...context.x, calls, state };
};

// ---- ① 横にするとき: 全画面 → 固定 の順 ----
(async () => {
  const w = makeWorld();
  check('はじめは縦だと分かる', w.orientationIsLandscape() === false);
  const ok = await w.applyScreenOrientation('landscape');
  check('横にできる', ok === true);
  check('全画面へ入ってから固定している', w.calls.join(',') === 'requestFullscreen,lock:landscape', w.calls.join(','));
  check('横になったと分かる', w.orientationIsLandscape() === true);

  // ---- ② 縦へ戻すとき: 固定を縦へ → 全画面を抜ける ----
  const back = await w.applyScreenOrientation('portrait');
  check('縦へ戻せる', back === true);
  check('縦へ戻すときは全画面も抜ける', w.calls.includes('exitFullscreen'));
  check('縦に戻ったと分かる', w.orientationIsLandscape() === false);

  // ---- ③ 横向きで開いたとき ----
  check('横向きの端末では最初から横だと分かる', makeWorld({ startLandscape: true }).orientationIsLandscape() === true);

  // ---- ④ 回せない端末 ----
  const noLock = makeWorld({ hasLock: false });
  check('lock が無い端末では false を返す', (await noLock.applyScreenOrientation('landscape')) === false);
  check('lock が無い端末では何も呼ばない(勝手に全画面にしない)', noLock.calls.length === 0, noLock.calls.join(','));
  const blocked = makeWorld({ lockFails: true });
  check('lock を断られたら false を返す', (await blocked.applyScreenOrientation('landscape')) === false);

  // ---- ⑤ モンビーを離れたときの後始末 ----
  // 横に固定したままHOMEへ戻ると、ゲーム全体が横＋全画面のままになる
  const leaving = makeWorld();
  await leaving.applyScreenOrientation('landscape');
  leaving.calls.length = 0;
  check('横に固定したままモンビーを離れたら戻す', leaving.releaseScreenOrientation() === true);
  check('戻すときは固定を外して全画面も抜ける',
    leaving.calls.includes('unlock') && leaving.calls.includes('exitFullscreen'), leaving.calls.join(','));
  check('もう一度離れても二重に戻さない', leaving.releaseScreenOrientation() === false);
  // 端末を横向きに持っているだけの人の画面を、こちらから縦へ戻してしまわない
  const untouched = makeWorld({ startLandscape: true });
  check('ボタンを押していなければ何もしない', untouched.releaseScreenOrientation() === false);
  check('何もしないときは全画面も触らない', untouched.calls.length === 0, untouched.calls.join(','));
  // 自分で縦へ戻したあとは、後始末は要らない
  const returned = makeWorld();
  await returned.applyScreenOrientation('landscape');
  await returned.applyScreenOrientation('portrait');
  check('自分で縦へ戻したあとは後始末が要らない', returned.releaseScreenOrientation() === false);
  check('モンビーの外へ出たら後始末を呼んでいる',
    /if\(String\(gameState\|\|''\)\.startsWith\('RHYTHM_'\)\)return;\s*releaseScreenOrientation\(\);/.test(game));
  check('モンビーの中を移動しているあいだは戻さない(演奏中に縦へ戻らない)',
    game.includes("startsWith('RHYTHM_')"));

  // ---- ⑥ ボタンの作り ----
  const button = grab('const RhythmOrientationButton=', '\n// ============================================================================\n// タップのタイミング合わせ');
  check('ボタンに目印(data-rhythm-orientation-toggle)がある', button.includes('data-rhythm-orientation-toggle'));
  check('いまの向きで文言が入れ替わる',
    /const label=landscape\?'縦画面にする':'横画面にする';/.test(button)
    && /const target=landscape\?'portrait':'landscape';/.test(button));
  check('回せなかったら案内を出す',
    /setNote\(ok\?'':/.test(button) && button.includes('画面の自動回転'));
  check('案内は押すと消える／時間でも消える',
    button.includes("onClick={()=>setNote('')}") && button.includes('setTimeout(()=>setNote'));
  check('向きの見張りはこのボタンの中だけ(画面全体を描き直さない)',
    button.includes("matchMedia('(orientation: landscape)')")
    && !/const \[rhythmIsLandscape/.test(game));
  check('指を置く大きさ(44px)を確保している', button.includes('min-h-[44px]'));

  // ---- ⑦ 置き場所 ----
  const home = grab('{gameState===\'RHYTHM_DEMO_HOME\'&&(()=>{', 'data-rhythm-demo-help');
  check('モンビーのホームのヘッダーに置いている', home.includes('<RhythmOrientationButton/>'));
  check('題名が折り返してヘッダーが伸びないようにしてある', home.includes('truncate text-sm font-black'));
  // プレイ中に向きを変えられると譜面の見え方が変わるので、演奏画面には置かない
  const play = grab('const RhythmTapTest=', '\nconst RhythmMonsterSlotsPanel');
  check('演奏中の画面には置いていない', !play.includes('RhythmOrientationButton'));

  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
