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
//
// 【二の矢: 自前で画面を回す】(2026-09-06・ユーザーからの相談
//  「端末の設定とか関係なく強制的に画面の向きを変えられないの？」)
// 端末の向きを変える手段は screen.orientation.lock() ひとつしか無く、
// Androidは全画面中のみ・iOSのSafariには存在しない・アプリ内ブラウザは全画面を塞ぐ。
// つまりAPIに頼るかぎり「できない端末」は必ず残る。
// そこで端末が断ったら、端末は縦のまま**絵のほうを90度回して描く**(RHYTHM_VIEW_ROTATION)。
// この検査では、本物の RHYTHM_VIEW_ROTATION を rhythm-mode.js から読んで同じ器で動かし、
//   ・断られても必ずどちらかの向きになること
//   ・自前で回したときは「見えている向き」が入れ替わること
//   ・端末が回ったら自前回転をやめること(二重に回すと横倒しになる)
//   ・離れるときは自前回転も戻すこと
//   ・座標の読み替えが往復で一致すること(ここがずれると押した場所と違うレーンが鳴る)
// までを見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const game = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const rhythmData = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-mode.js'), 'utf8');
// 自前回転の変換は本物をそのまま動かす(検査用に写すと、写し間違いに気づけないため)
const viewRotationSource = (() => {
  const i = rhythmData.indexOf('const RHYTHM_VIEW_ROTATION=(()=>{');
  const j = rhythmData.indexOf('const rhythmReleaseTargetMs=', i);
  return i >= 0 && j > i ? rhythmData.slice(i, j) : '';
})();

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
check('自前回転の変換(RHYTHM_VIEW_ROTATION)を本物から読めている', viewRotationSource.length > 0);

// 実機に近い偽のブラウザ。
//   sensor … 本体を実際にどちら向きに持っているか(固定が外れたときに戻る向き)
// screen … 画面の種類。折りたたみ端末(Galaxy Z Fold6)を再現するために足した。
//   'phone' … ふつうのスマホ(400×800)
//   'inner' … 折りたたみを**開いた**内側の画面。1856×2160 のほぼ正方形(縮小して 856×1080)。
//             ここがいちばん大事なところで、**大きい画面では向きの指定が無視される**。
//             lock() は例外も投げず「受け付けた」ように見えるのに、画面は1ミリも回らない。
//   'cover' … 折りたたんだ外側の画面。細長いふつうのスマホと同じで lock は効く。
const makeWorld = ({
  hasLock = true, lockFails = false, requireFullscreenForLock = true,
  sensor = 'portrait', noFullscreen = false, screenKind = 'phone',
  // shapeFollowsType=false … type だけ変わって**画面の形は動かない**端末の再現。
  //   大きい画面で向きの指定が無視されると、こういう見え方になることがある。
  //   「端末が言う向き」を信じると、回っていないのに「できた」で終わってしまう。
  shapeFollowsType = true,
} = {}) => {
  // 内側の画面は大きいので、端末側が向きの指定を黙って無視する
  const ignoresLock = screenKind === 'inner';
  const SIZE = {
    phone: { portrait: [400, 800], landscape: [800, 400] },
    inner: { portrait: [856, 1080], landscape: [1080, 856] },
    cover: { portrait: [320, 800], landscape: [800, 320] },
  }[screenKind];
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
    // 端末を自然な向きから何度回しているか。どちら回りに回せば素直な絵になるかの判断に使う
    get angle() { return state.type.startsWith('landscape') ? 90 : 0; },
    addEventListener: (t, fn) => { if (t === 'change') listeners.orientation.push(fn); },
    removeEventListener: (t, fn) => { listeners.orientation = listeners.orientation.filter(f => f !== fn); },
  };
  if (hasLock) {
    orientation.lock = async (want) => {
      calls.push(`lock:${want}`);
      if (lockFails) throw new Error('NotSupportedError');
      // Androidのブラウザは全画面のあいだしか固定を許さない
      if (requireFullscreenForLock && !state.fullscreen) throw new Error('SecurityError');
      // 大きい画面(折りたたみを開いた内側)では、受け付けた顔をして何も起きない。
      // 例外も投げないので、呼んだ側からは成功と見分けが付かない。
      // 効いていないのだから固定も持っていない(本体を回せば素直に付いてくる)
      if (ignoresLock) return;
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
    get innerWidth() { return SIZE[shapeFollowsType ? (state.type.startsWith('landscape') ? 'landscape' : 'portrait') : sensor][0]; },
    get innerHeight() { return SIZE[shapeFollowsType ? (state.type.startsWith('landscape') ? 'landscape' : 'portrait') : sensor][1]; },
    matchMedia: (q) => ({
      // メディアクエリは「幅が高さより大きいか」で決まる。type ではない
      get matches() { return /landscape/.test(q) === (windowStub.innerWidth > windowStub.innerHeight); },
      addEventListener: (t, fn) => { if (t === 'change') listeners.media.push(fn); },
      removeEventListener: (t, fn) => { listeners.media = listeners.media.filter(f => f !== fn); },
    }),
    addEventListener: (t, fn) => { if (t === 'resize' || t === 'orientationchange') listeners.window.push(fn); },
    removeEventListener: (t, fn) => { listeners.window = listeners.window.filter(f => f !== fn); },
    // 自前で回したときは端末が動かないので resize は鳴らない。本体はここで自分で鳴らし、
    // 「端末が回ったときとまったく同じ道」で測り直しを走らせる。その配線もここで見る
    dispatchEvent: () => { listeners.window.forEach(fn => { try { fn(); } catch (_) {} }); return true; },
  };
  const context = {
    window: windowStub, document: documentStub, screen: windowStub.screen,
    setTimeout, clearTimeout, Promise, Event,
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
  // 自前回転の変換を先に置いてから本体を動かす(本体はこれを使う)
  vm.runInContext(viewRotationSource, context);
  vm.runInContext(`${logic}\nglobalThis.x={orientationIsLandscape,deviceIsLandscape,applyScreenOrientation,releaseScreenOrientation,screenOrientationApi,rotation:RHYTHM_VIEW_ROTATION};`, context);
  // 本体を実際に回す(端末の自動回転が入っている人が持ち替えたときの再現)
  const turnDevice = (next) => { state.sensor = next; if (!state.locked) setType(`${next}-primary`); };
  return { ...context.x, calls, state, dropFullscreenOutside, turnDevice };
};

(async () => {
  // ---- ① 横にするとき: 全画面へ入ってから固定 ----
  {
    const w = makeWorld({ sensor: 'portrait' });
    check('はじめは縦だと分かる', w.orientationIsLandscape() === false);
    const ok = await w.applyScreenOrientation('landscape');
    check('横にできる', ok === 'device', String(ok));
    check('端末そのものが回ったと分かる（自前回転は使っていない）', w.rotation.get() === 0);
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
    check('縦にできたと正しく返す', back === 'device', String(back));
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
    check('本体が縦向きなら当然縦へ戻せる', back === 'device' && w.orientationIsLandscape() === false);
  }

  // ---- ④ 端末が断っても、自前で回して必ず決着する（今回の本題）----
  // ここが「端末の設定に関係なく横で遊べる」を保証している部分。
  // 断られたら黙って諦める、が今までの姿だった。
  {
    // 全画面へ入れないブラウザ(アプリ内ブラウザなど)では lock も通らない
    const w = makeWorld({ noFullscreen: true });
    const how = await w.applyScreenOrientation('landscape');
    check('全画面へ入れない端末でも横になる', how === 'forced', String(how));
    check('そのとき端末は縦のまま（回っていない）', w.deviceIsLandscape() === false, w.state.type);
    check('でも遊ぶ人から見れば横になっている', w.orientationIsLandscape() === true);
    check('絵を90度回している', w.rotation.active() === true, `angle=${w.rotation.get()}`);
  }
  {
    // iOSのSafariのように lock そのものが無い端末
    const noLock = makeWorld({ hasLock: false });
    check('lock が無い端末でも横になる', (await noLock.applyScreenOrientation('landscape')) === 'forced');
    check('lock が無い端末では端末に頼まない(勝手に全画面にしない)', noLock.calls.length === 0, noLock.calls.join(','));
    check('lock が無い端末でも見えている向きは横', noLock.orientationIsLandscape() === true);

    const blocked = makeWorld({ lockFails: true });
    check('lock を断られても横になる', (await blocked.applyScreenOrientation('landscape')) === 'forced');
  }
  {
    // 固定は受け付けられたのに向きが変わらない端末。「受け付けた＝できた」にしない
    const stubborn = makeWorld({ sensor: 'portrait' });
    const api = stubborn.screenOrientationApi();
    api.lock = async () => { stubborn.calls.push('lock:landscape'); };
    const how = await stubborn.applyScreenOrientation('landscape');
    check('固定を受け付けられても向きが変わらなければ自前で回す', how === 'forced',
      `いまの向き ${stubborn.state.type} / how=${how}`);
    check('そのときも見えている向きは横', stubborn.orientationIsLandscape() === true);
  }
  {
    // 報告そのものの形。lock が効かない端末で、本体を横に持ったまま「縦」を押す
    const w = makeWorld({ hasLock: false, sensor: 'landscape' });
    await w.applyScreenOrientation('landscape');
    const back = await w.applyScreenOrientation('portrait');
    check('lock が効かない端末でも、本体を横に持ったまま縦にできる',
      back === 'forced' && w.orientationIsLandscape() === false,
      `how=${back} / 端末=${w.state.type} / angle=${w.rotation.get()}`);
  }
  {
    // 端末が既に望みの向きなら、回す必要はない(回すと逆に狂う)
    const w = makeWorld({ hasLock: false, sensor: 'landscape' });
    const how = await w.applyScreenOrientation('landscape');
    check('端末が既に横なら自前回転はせず、そう答える', how === 'already' && w.rotation.get() === 0,
      `how=${how} / angle=${w.rotation.get()}`);
    check('もちろん横のまま', w.orientationIsLandscape() === true);
  }
  {
    // 自動回転が入っている人が、案内どおり本体を持ち替えたとき。
    // 端末も回った上にこちらも回ったままだと、二重になって横倒しの絵になる
    const w = makeWorld({ hasLock: false, sensor: 'portrait' });
    await w.applyScreenOrientation('landscape');
    check('まず自前で回っている', w.rotation.active() === true);
    w.turnDevice('landscape');
    check('本体を横に持ち替えたら自前回転はやめる（二重に回さない）', w.rotation.get() === 0,
      `angle=${w.rotation.get()}`);
    check('持ち替えたあとも横のまま', w.orientationIsLandscape() === true, w.state.type);
  }
  {
    // 一度自前で回したあと、端末に頼み直せる状況になったら端末側を使う。
    // 自前で回したまま端末にも頼むと二重になるので、頼む前に必ず戻す
    const w = makeWorld({ hasLock: false, sensor: 'portrait' });
    await w.applyScreenOrientation('landscape');
    const api = { lock: async (want) => { w.state.locked = want; }, type: 'portrait-primary' };
    check('自前で回した状態から始まっている', w.rotation.active() === true);
    await w.applyScreenOrientation('portrait');
    check('縦へ戻したら自前回転も戻る', w.rotation.get() === 0, `angle=${w.rotation.get()}`);
    check('縦になっている', w.orientationIsLandscape() === false);
    void api;
  }
  // ---- ④-3 折りたたみ端末(Galaxy Z Fold6)----
  // 報告された端末はこれだった(2026-09-06)。この端末には画面が2つある。
  //   外側(たたんだまま) … 細長いふつうのスマホ。向きの固定は効く
  //   内側(開いたとき)   … 1856×2160 のほぼ正方形。**大きい画面なので向きの指定が無視される**
  // 内側では lock() が例外も投げずに素通りし、画面は1ミリも回らない。
  // 呼んだ側からは成功と見分けが付かないので、前の作りは「できた」と返して終わっていた。
  // 「横にはできるけど縦にはできない**ときがある**」の「ときがある」は、
  // たたんだまま遊べば効いて、開いて遊ぶと効かない、という出方だったと考えると筋が通る。
  {
    // 外側の画面: ふつうのスマホと同じで、端末ごと回る
    const cover = makeWorld({ screenKind: 'cover', sensor: 'portrait' });
    check('たたんだ外側の画面では端末ごと回る',
      (await cover.applyScreenOrientation('landscape')) === 'device');
    check('外側の画面では自前で回す必要がない', cover.rotation.get() === 0);
    check('外側の画面では縦へも戻せる',
      (await cover.applyScreenOrientation('portrait')) === 'device'
      && cover.orientationIsLandscape() === false);
  }
  {
    // 内側の画面: lock は素通り。ここが報告そのもの
    const inner = makeWorld({ screenKind: 'inner', sensor: 'portrait' });
    check('開いた内側の画面は、はじめは縦', inner.orientationIsLandscape() === false);
    const toLandscape = await inner.applyScreenOrientation('landscape');
    check('内側の画面では端末が回ってくれないと気づく（受け付けた顔をしても信じない）',
      toLandscape === 'forced', `how=${toLandscape}`);
    check('端末は実際に回っていない', inner.deviceIsLandscape() === false, inner.state.type);
    check('それでも遊ぶ人から見れば横になる', inner.orientationIsLandscape() === true);
    check('自前で回している', inner.rotation.active() === true, `angle=${inner.rotation.get()}`);

    // そして本題。ここが「縦にできない」と言われていたところ
    const back = await inner.applyScreenOrientation('portrait');
    check('内側の画面でも縦へ戻せる（報告そのもの）',
      inner.orientationIsLandscape() === false, `how=${back} / ${inner.state.type}`);
    check('縦へ戻したら自前回転もやめている', inner.rotation.get() === 0);

    // 離れるときの後始末
    const leaving = makeWorld({ screenKind: 'inner', sensor: 'portrait' });
    await leaving.applyScreenOrientation('landscape');
    check('内側の画面で横にしたまま離れたら戻す', leaving.releaseScreenOrientation() === true);
    check('離れたら自前回転も戻る', leaving.rotation.get() === 0);
    check('離れたら縦に見える', leaving.orientationIsLandscape() === false);
  }
  {
    // 【Galaxy Z Fold6の画面写真そのもの】(2026-09-06)
    // 内側の画面(707×823)で「横」→「縦」と押したときの流れ。
    //   ① 「横」… lock が断られる → 端末は縦なので絵を90度回す → 案内「絵を横向きにしました」
    //   ② 「縦」… まず絵の回転を解除する(この時点でもう縦) → lock が断られる
    //             → 端末は縦＝望みどおりなので**回すものが無い**
    // ②で「絵のほうを縦向きにしました。本体を縦向きに持ち替えてください」と出ていた。
    // 回していないうえ、本体はもともと縦なので持ち替える必要も無い。二重に間違っていた。
    const fold = makeWorld({ screenKind: 'inner', sensor: 'portrait' });
    const first = await fold.applyScreenOrientation('landscape');
    check('内側の画面で「横」を押すと絵を回す', first === 'forced' && fold.rotation.active() === true,
      `how=${first} / angle=${fold.rotation.get()}`);
    const second = await fold.applyScreenOrientation('portrait');
    check('続けて「縦」を押すと、回すものが無いので「回した」とは言わない',
      second === 'already', `how=${second}`);
    check('そのとき絵の回転も外れている', fold.rotation.get() === 0);
    check('見た目もちゃんと縦になっている', fold.orientationIsLandscape() === false);
  }
  {
    // いちばん質の悪い形。lock() が受け付けられて type まで「横になった」と言うのに、
    // 画面の形は1ミリも動かない(大きい画面で向きの指定が無視されるとこうなる)。
    // 「端末が言う向き」を信じると、回っていないのに「できた」で話が終わる。
    // 画面の形で見ているから、回っていないと見抜いて自前で回すほうへ進める。
    const liar = makeWorld({ screenKind: 'inner', sensor: 'portrait', shapeFollowsType: false });
    const api = liar.screenOrientationApi();
    api.lock = async (want) => { liar.state.type = `${want}-primary`; };  // 形は変えない
    const how = await liar.applyScreenOrientation('landscape');
    check('端末が「横になった」と言っても、画面が動いていなければ信じない',
      how === 'forced', `how=${how} / type=${liar.state.type}`);
    check('そのときは自前で回して、ちゃんと横にする',
      liar.orientationIsLandscape() === true && liar.rotation.active() === true,
      `angle=${liar.rotation.get()}`);
  }
  {
    // 開いたまま横にしたあと、たたんで外側の画面へ移ると resize が飛ぶ。
    // そのとき本体が横向きなら端末が自分で横になるので、自前回転は要らなくなる
    const folding = makeWorld({ screenKind: 'inner', sensor: 'portrait' });
    await folding.applyScreenOrientation('landscape');
    check('開いたまま自前で横にしている', folding.rotation.active() === true);
    folding.turnDevice('landscape');
    check('本体を横に持ち替えたら自前回転はやめる', folding.rotation.get() === 0,
      `angle=${folding.rotation.get()}`);
    check('持ち替えたあとも横のまま', folding.orientationIsLandscape() === true, folding.state.type);
  }

  // ---- ④-2 座標の読み替えが往復で一致する ----
  // ここがずれると「押した場所と違うレーンが鳴る」「ノーツが横に流れる」になる。
  // 実際に遊べるかどうかは、この一致にかかっている。
  {
    const w = makeWorld({ hasLock: false, sensor: 'portrait' });
    const R = w.rotation;
    [90, 270].forEach((angle) => {
      R.set(angle);
      const vw = w.state.type.startsWith('landscape') ? 800 : 400;
      const vh = w.state.type.startsWith('landscape') ? 400 : 800;
      // 点: 器の中 → 画面 → 器の中 で元に戻るか
      const back = R.point(...Object.values(R.unpoint(321, 177)));
      check(`点の読み替えが往復で一致する(${angle}度)`,
        Math.abs(back.x - 321) < 1e-9 && Math.abs(back.y - 177) < 1e-9, JSON.stringify(back));
      // 箱: 器の中の箱の四隅を画面へ出し、その外接箱を戻すと元の箱になるか
      const l = 120, t = 60, bw = 300, bh = 210;
      const cs = [[l, t], [l + bw, t], [l, t + bh], [l + bw, t + bh]].map(([x, y]) => R.unpoint(x, y));
      const L = Math.min(...cs.map(c => c.clientX)), Rr = Math.max(...cs.map(c => c.clientX));
      const T = Math.min(...cs.map(c => c.clientY)), B = Math.max(...cs.map(c => c.clientY));
      const box = R.rect({ left: L, top: T, right: Rr, bottom: B, width: Rr - L, height: B - T });
      check(`箱の読み替えが往復で一致する(${angle}度)`,
        Math.abs(box.left - l) < 1e-9 && Math.abs(box.top - t) < 1e-9
        && Math.abs(box.width - bw) < 1e-9 && Math.abs(box.height - bh) < 1e-9, JSON.stringify(box));
      // 器いっぱいが画面いっぱいをちょうど覆うか(すき間も食み出しも無い)
      const full = [[0, 0], [vh, 0], [0, vw], [vh, vw]].map(([x, y]) => R.unpoint(x, y));
      const okX = Math.min(...full.map(c => c.clientX)) === 0 && Math.max(...full.map(c => c.clientX)) === vw;
      const okY = Math.min(...full.map(c => c.clientY)) === 0 && Math.max(...full.map(c => c.clientY)) === vh;
      check(`回した器が画面をちょうど覆う(${angle}度)`, okX && okY, `vw=${vw} vh=${vh}`);
      // 幅と高さが入れ替わる = 縦の画面が横の器になる
      const style = R.frameStyle();
      check(`器の大きさが縦横入れ替わっている(${angle}度)`,
        style.width === `${vh}px` && style.height === `${vw}px`, `${style.width} x ${style.height}`);
    });
    R.set(0);
    check('回していないときは点をそのまま返す',
      R.point(10, 20).x === 10 && R.point(10, 20).y === 20);
    check('回していないときは箱をそのまま返す', R.rect({ left: 1, top: 2, width: 3, height: 4 }).left === 1);
    check('回していないときは器のCSSを作らない', R.frameStyle() === null);
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

    // 自前で回したままモンビーを離れると、ゲーム全体(HOME・バトル)が横倒しになる。
    // 端末に頼めなかった人ほどこの状態になるので、必ず戻す
    const forced = makeWorld({ hasLock: false, sensor: 'portrait' });
    await forced.applyScreenOrientation('landscape');
    check('自前で回っている状態から離れる', forced.rotation.active() === true);
    check('自前回転だけのときも「戻した」と答える', forced.releaseScreenOrientation() === true);
    check('離れたら自前回転も戻る', forced.rotation.get() === 0);
    check('戻したあとは縦に見える', forced.orientationIsLandscape() === false);
    check('もう一度離れても二重に戻さない', forced.releaseScreenOrientation() === false);
  }

  check('モンビーの外へ出たら後始末を呼んでいる',
    /if\(String\(gameState\|\|''\)\.startsWith\('RHYTHM_'\)\)return;\s*releaseScreenOrientation\(\);/.test(game));
  check('モンビーの中を移動しているあいだは戻さない(演奏中に向きが変わらない)',
    game.includes("startsWith('RHYTHM_')"));

  // ---- ⑥ 実装の作り ----
  check('向きが実際に変わるまで待ってから答える',
    logic.includes('waitForScreenOrientation') && /if\(!await waitForScreenOrientation\(target\)\)return false;/.test(logic));
  {
    // 端末に頼む部分は縦でも横でもまったく同じ道でなければならない。
    // 前は縦のときだけ「固定してから全画面を抜ける」という別の順で、そこで固定が外れていた。
    // (applyScreenOrientation 側の const wantLandscape=target==='landscape' は、
    //  自前回転へ渡すための読み替えなので道が分かれるわけではない)
    const lockPath = logic.slice(logic.indexOf('const lockScreenOrientation='),
      logic.indexOf('// --- 二の矢'));
    check('端末に頼む部分は縦と横で同じ道を通す（縦だけ別の順で処理しない）',
      lockPath.length > 0 && !/target===/.test(lockPath) && !/portrait/.test(lockPath), lockPath.length ? '' : '見つからない');
    check('固定を持っているあいだは全画面を抜けない（抜けると固定が外れるため）',
      lockPath.length > 0 && !lockPath.includes('exitFullscreen'));
  }
  check('全画面が外れたら固定の控えも下ろす',
    /fullscreenchange/.test(logic) && /screenOrientationLockedByUs=false/.test(logic));
  check('端末に頼んで駄目なら自前で回す、の二段構えになっている',
    /if\(await lockScreenOrientation\(target\)\)return 'device';/.test(logic)
    && logic.includes("const done=applyForcedRotation(wantLandscape);")
    && logic.includes("return done==='rotated'?'forced':done==='already'?'already':'';"));
  check('端末に頼む前に自前回転をいったん戻す（二重に回さない）',
    /RHYTHM_VIEW_ROTATION\.set\(0\);\s*\n\s*if\(await lockScreenOrientation/.test(logic));
  check('端末が既に望みの向きなら自前では回さない',
    /if\(deviceIsLandscape\(\)===wantLandscape\)\{RHYTHM_VIEW_ROTATION\.set\(0\);return 'already';\}/.test(logic));
  check('本体を持ち替えたら測り直す配線がある',
    logic.includes('forcedRotationWantLandscape') && /orientationchange/.test(logic));
  check('「見えている向き」と「端末の向き」を分けている',
    logic.includes('const deviceIsLandscape=') && /RHYTHM_VIEW_ROTATION\.active\(\)\?!device:device/.test(logic));

  // ---- ⑦ ボタンの作り ----
  const button = grab('const RhythmOrientationButton=', '\n// ============================================================================\n// タップのタイミング合わせ');
  check('ボタンに目印(data-rhythm-orientation-toggle)がある', button.includes('data-rhythm-orientation-toggle'));
  check('いまの向きで文言が入れ替わる',
    /const label=landscape\?'縦画面にする':'横画面にする';/.test(button)
    && /const target=landscape\?'portrait':'landscape';/.test(button));
  // 2026-09-06・Galaxy Z Fold6の画面写真。案内が「絵のほうを縦向きにしました」と言いながら
  // 同じ案内の中の状態が「絵の回転 なし」になっていた。回していないのに回したと言い、
  // しかも本体はもともと縦なのに「縦向きに持ち替えてください」と言っていた。
  check('回していないときに「回した・持ち替えて」と言わない',
    /if\(how==='already'\)return;/.test(button)
    && button.indexOf("if(how==='already')return;") < button.indexOf('代わりに絵のほうを'));
  check('端末ごと回ったときは何も言わない（言うことがない）',
    /if\(how==='device'\)return;/.test(button));
  check('自前で回したときは「本体を持ち替えて」と必ず伝える',
    /if\(how==='forced'\)\{/.test(button)
    && button.includes('代わりに絵のほうを') && button.includes('持ち替えて'));
  check('どちらもできなかったときの案内も残してある',
    button.includes('お手数ですが本体を'));
  check('押している間は二重に受け付けない', button.includes('if(busy)return;') && button.includes('disabled={busy}'));
  check('押したあとに今の向きを取り直す', button.includes('setLandscape(orientationIsLandscape())'));
  // 2026-09-06: 時間で消すのをやめた。「本体を持ち替えてください」は**やってもらうこと**が
  // 書いてあるので、8秒で消すと気づかないまま終わる。実際に「案内も出ない」という報告が届いた。
  check('案内は押すまで消えない（やってもらうことが書いてあるため）',
    button.includes("onClick={()=>setNote('')}")
    && !button.includes('setTimeout(()=>setNote')
    && button.includes('タップで閉じる'));
  check('うまくいかなかったときは端末のいまの状態も出す（推測せずに済むように）',
    button.includes('screenOrientationStateLine()')
    && logic.includes('const screenOrientationStateLine=')
    && logic.includes('window.innerWidth')&&logic.includes('全画面'));
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
