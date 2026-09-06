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
// 【この検査がいちばん見たいこと】(2026-09-06・Androidの利用者からの報告
//  「横にはできるけど縦にはできないときがある」)
// Androidのブラウザは**全画面のあいだしか向きの固定を許さない**。
// 裏を返すと、**全画面を抜けた瞬間に固定は自動的に外れ、端末のセンサーの向きへ戻る**。
// 前の作りは縦へ戻すときだけ「固定してから全画面を抜ける」という順だったので、
// 抜けた瞬間に横へ戻ってしまい、しかも「抜けられた＝できた」と返していたため
// 案内も出なかった。本体を縦に持っている人だけたまたま成功するので「ときがある」になる。
//
// そこで偽のブラウザにも**この性質を持たせる**。
//   ・lock() は全画面のあいだしか通らない
//   ・exitFullscreen() は固定を外し、センサーの向きへ戻す
//   ・向きが変わったら change / resize を鳴らす
// この土台がないと、壊れている実装でも検査は通ってしまう(実際に通していた)。
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

// 実機に近い偽のブラウザ。
//   sensor … 本体を実際にどちら向きに持っているか(固定が外れたときに戻る向き)
const makeWorld = ({
  hasLock = true, lockFails = false, requireFullscreenForLock = true,
  sensor = 'portrait', noFullscreen = false,
} = {}) => {
  const calls = [];
  const listeners = { orientation: [], media: [], window: [], document: [] };
  const state = { type: `${sensor}-primary`, fullscreen: null, locked: null, sensor };
  const emit = () => {
    [...listeners.orientation, ...listeners.media, ...listeners.window].forEach(fn => { try { fn(); } catch (_) {} });
  };
  const setType = (type) => { if (state.type === type) return; state.type = type; emit(); };
  const toSensor = () => setType(`${state.sensor}-primary`);
  const orientation = {
    get type() { return state.type; },
    addEventListener: (t, fn) => { if (t === 'change') listeners.orientation.push(fn); },
    removeEventListener: (t, fn) => { listeners.orientation = listeners.orientation.filter(f => f !== fn); },
  };
  if (hasLock) {
    orientation.lock = async (want) => {
      calls.push(`lock:${want}`);
      if (lockFails) throw new Error('NotSupportedError');
      // Androidのブラウザは全画面のあいだしか固定を許さない
      if (requireFullscreenForLock && !state.fullscreen) throw new Error('SecurityError');
      state.locked = want;
      setType(`${want}-primary`);
    };
    orientation.unlock = () => { calls.push('unlock'); state.locked = null; toSensor(); };
  }
  const fireFullscreenChange = () => {
    listeners.document.forEach(fn => { try { fn(); } catch (_) {} });
  };
  const documentStub = {
    documentElement: {},
    get fullscreenElement() { return state.fullscreen; },
    exitFullscreen: async () => {
      calls.push('exitFullscreen');
      state.fullscreen = null;
      // ★ここが実機の要。全画面を抜けると固定も外れ、本体の向きへ戻る
      if (state.locked) { state.locked = null; toSensor(); }
      fireFullscreenChange();
    },
    addEventListener: (t, fn) => { if (t === 'fullscreenchange') listeners.document.push(fn); },
    removeEventListener: (t, fn) => { listeners.document = listeners.document.filter(f => f !== fn); },
  };
  if (!noFullscreen) {
    documentStub.documentElement.requestFullscreen = async () => {
      calls.push('requestFullscreen'); state.fullscreen = 'root'; fireFullscreenChange();
    };
  }
  const windowStub = {
    screen: { orientation },
    get innerWidth() { return state.type.startsWith('landscape') ? 800 : 400; },
    get innerHeight() { return state.type.startsWith('landscape') ? 400 : 800; },
    matchMedia: (q) => ({
      get matches() { return /landscape/.test(q) === state.type.startsWith('landscape'); },
      addEventListener: (t, fn) => { if (t === 'change') listeners.media.push(fn); },
      removeEventListener: (t, fn) => { listeners.media = listeners.media.filter(f => f !== fn); },
    }),
    addEventListener: (t, fn) => { if (t === 'resize') listeners.window.push(fn); },
    removeEventListener: (t, fn) => { listeners.window = listeners.window.filter(f => f !== fn); },
  };
  const context = {
    window: windowStub, document: documentStub, screen: windowStub.screen,
    setTimeout, clearTimeout, Promise,
  };
  // 端末の「戻る」やスワイプなど、こちらが頼んでいないのに全画面が外れる状況。
  // ボタンからの exitFullscreen とは別物なので、専用の入り口を用意する。
  const dropFullscreenOutside = () => {
    if (!state.fullscreen) return;
    state.fullscreen = null;
    if (state.locked) { state.locked = null; toSensor(); }
    fireFullscreenChange();
  };
  vm.createContext(context);
  vm.runInContext(`${logic}\nglobalThis.x={orientationIsLandscape,applyScreenOrientation,releaseScreenOrientation,screenOrientationApi};`, context);
  return { ...context.x, calls, state, dropFullscreenOutside };
};

(async () => {
  // ---- ① 横にするとき: 全画面へ入ってから固定 ----
  {
    const w = makeWorld({ sensor: 'portrait' });
    check('はじめは縦だと分かる', w.orientationIsLandscape() === false);
    const ok = await w.applyScreenOrientation('landscape');
    check('横にできる', ok === true);
    check('全画面へ入ってから固定している', w.calls.join(',') === 'requestFullscreen,lock:landscape', w.calls.join(','));
    check('横になったと分かる', w.orientationIsLandscape() === true);
  }

  // ---- ② 本体を横に持ったまま「縦」を押しても縦になる（今回の報告そのもの）----
  {
    const w = makeWorld({ sensor: 'landscape' });   // 本体を横向きに持っている
    await w.applyScreenOrientation('landscape');
    w.calls.length = 0;
    const back = await w.applyScreenOrientation('portrait');
    check('本体を横に持ったままでも縦にできる', w.orientationIsLandscape() === false,
      `いまの向き ${w.state.type}`);
    check('縦にできたと正しく返す', back === true);
    // 全画面を抜けると固定が外れて横へ戻ってしまう。だから縦のあいだは抜けない
    check('縦のあいだは全画面を抜けない（抜けると固定が外れて横へ戻るため）',
      !w.calls.includes('exitFullscreen'), w.calls.join(','));
    check('縦でも固定を持っていることを覚えている（離れるときに戻すため）',
      w.releaseScreenOrientation() === true);
  }

  // ---- ③ 本体が縦向きのときも同じ道で縦へ戻せる ----
  {
    const w = makeWorld({ sensor: 'portrait' });
    await w.applyScreenOrientation('landscape');
    const back = await w.applyScreenOrientation('portrait');
    check('本体が縦向きなら当然縦へ戻せる', back === true && w.orientationIsLandscape() === false);
  }

  // ---- ④ 回らなかったら「できた」と言わない ----
  {
    // 全画面へ入れないブラウザでは lock も通らない
    const w = makeWorld({ noFullscreen: true });
    check('全画面へ入れないと false を返す', (await w.applyScreenOrientation('landscape')) === false);
    check('向きも変わっていない', w.orientationIsLandscape() === false);
  }
  {
    const noLock = makeWorld({ hasLock: false });
    check('lock が無い端末では false を返す', (await noLock.applyScreenOrientation('landscape')) === false);
    check('lock が無い端末では何も呼ばない(勝手に全画面にしない)', noLock.calls.length === 0, noLock.calls.join(','));
    const blocked = makeWorld({ lockFails: true });
    check('lock を断られたら false を返す', (await blocked.applyScreenOrientation('landscape')) === false);
  }
  {
    // 固定は受け付けられたのに向きが変わらない端末。「受け付けた＝できた」にしない
    const stubborn = makeWorld({ sensor: 'portrait' });
    // lock は成功扱いだが、向きは変えない差し替え
    const api = stubborn.screenOrientationApi();
    api.lock = async () => { stubborn.calls.push('lock:landscape'); };
    const ok = await stubborn.applyScreenOrientation('landscape');
    check('固定を受け付けられても向きが変わらなければ false を返す', ok === false,
      `いまの向き ${stubborn.state.type}`);
  }

  // ---- ⑤ モンビーを離れたときの後始末 ----
  {
    const leaving = makeWorld({ sensor: 'portrait' });
    await leaving.applyScreenOrientation('landscape');
    leaving.calls.length = 0;
    check('固定したままモンビーを離れたら戻す', leaving.releaseScreenOrientation() === true);
    check('戻すときは固定を外して全画面も抜ける',
      leaving.calls.includes('unlock') && leaving.calls.includes('exitFullscreen'), leaving.calls.join(','));
    check('もう一度離れても二重に戻さない', leaving.releaseScreenOrientation() === false);
    check('戻したあとは本体の向きに従う', leaving.orientationIsLandscape() === false, leaving.state.type);

    // 端末を横向きに持っているだけの人の画面を、こちらから触らない
    const untouched = makeWorld({ sensor: 'landscape' });
    check('ボタンを押していなければ何もしない', untouched.releaseScreenOrientation() === false);
    check('何もしないときは全画面も触らない', untouched.calls.length === 0, untouched.calls.join(','));

    // 端末の「戻る」やスワイプで、こちらの知らないうちに全画面が外れることがある。
    // そのとき固定も一緒に外れているので、控えも下ろしておかないと
    // 「もう外れている固定」を外そうとする／逆に外し忘れる、が起きる
    const dropped = makeWorld({ sensor: 'portrait' });
    await dropped.applyScreenOrientation('landscape');
    check('横に固定できている', dropped.orientationIsLandscape() === true);
    dropped.dropFullscreenOutside();
    check('全画面が勝手に外れたら向きも本体に従う', dropped.orientationIsLandscape() === false, dropped.state.type);
    dropped.calls.length = 0;
    check('全画面が勝手に外れたら、固定の控えも下ろす', dropped.releaseScreenOrientation() === false);
    check('もう外れている固定を、あとから外そうとしない', dropped.calls.length === 0, dropped.calls.join(','));
  }

  check('モンビーの外へ出たら後始末を呼んでいる',
    /if\(String\(gameState\|\|''\)\.startsWith\('RHYTHM_'\)\)return;\s*releaseScreenOrientation\(\);/.test(game));
  check('モンビーの中を移動しているあいだは戻さない(演奏中に向きが変わらない)',
    game.includes("startsWith('RHYTHM_')"));

  // ---- ⑥ 実装の作り ----
  check('向きが実際に変わるまで待ってから答える',
    logic.includes('waitForScreenOrientation') && /if\(!await waitForScreenOrientation\(target\)\)return false;/.test(logic));
  check('縦と横で同じ道を通す（縦だけ別の順で処理しない）',
    !/target==='landscape'/.test(logic));
  check('全画面が外れたら固定の控えも下ろす',
    /fullscreenchange/.test(logic) && /screenOrientationLockedByUs=false/.test(logic));

  // ---- ⑦ ボタンの作り ----
  const button = grab('const RhythmOrientationButton=', '\n// ============================================================================\n// タップのタイミング合わせ');
  check('ボタンに目印(data-rhythm-orientation-toggle)がある', button.includes('data-rhythm-orientation-toggle'));
  check('いまの向きで文言が入れ替わる',
    /const label=landscape\?'縦画面にする':'横画面にする';/.test(button)
    && /const target=landscape\?'portrait':'landscape';/.test(button));
  check('回せなかったら案内を出す', /setNote\(screenOrientationApi\(\)/.test(button));
  check('できなかった理由で案内を書き分ける',
    button.includes('このブラウザには画面を回す機能がありません') && button.includes('全画面にできないブラウザでは'));
  check('押している間は二重に受け付けない', button.includes('if(busy)return;') && button.includes('disabled={busy}'));
  check('押したあとに今の向きを取り直す', button.includes('setLandscape(orientationIsLandscape())'));
  check('案内は押すと消える／時間でも消える',
    button.includes("onClick={()=>setNote('')}") && button.includes('setTimeout(()=>setNote'));
  check('向きの見張りはこのボタンの中だけ(画面全体を描き直さない)',
    button.includes("matchMedia('(orientation: landscape)')")
    && !/const \[rhythmIsLandscape/.test(game));
  check('指を置く大きさ(44px)を確保している', button.includes('min-h-[44px]'));

  // ---- ⑧ 置き場所 ----
  const home = grab('{gameState===\'RHYTHM_DEMO_HOME\'&&(()=>{', 'data-rhythm-demo-help');
  check('モンビーのホームのヘッダーに置いている', home.includes('<RhythmOrientationButton/>'));
  check('題名が折り返してヘッダーが伸びないようにしてある', home.includes('truncate text-sm font-black'));
  // プレイ中に向きを変えられると譜面の見え方が変わるので、演奏画面には置かない
  const play = grab('const RhythmTapTest=', '\nconst RhythmMonsterSlotsPanel');
  check('演奏中の画面には置いていない', !play.includes('RhythmOrientationButton'));

  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
