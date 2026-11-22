// 撮り比べ(tools/browser/visual-compare-check.js)が撮る「主な画面の組」。固定の一覧はこのファイル1つ(r1119-093・追跡表 r1122-009)。
//
// 社長「点検して表示とか見てるのに逆に壊してまわってるの？」: 直した画面だけを撮って確かめていたので、直していない画面が崩れても気づけなかった。
// ここの画面は、どの部の直しでも、公開の前に main と直した枝の両方で撮って比べる。
//
// 画面を足す・外すときはここだけを直す。足したら node tools/browser/visual-compare-check.js --self で「何も変えないとき違い0」を確かめる。
//   kind: 'walk'   … HOME から人と同じボタンを押して開く(手順は tools/browser/visual-scenes.js の場面を id で借りる。go を書けばその手順)
//   kind: 'beat'   … モンヒロビートを1曲流す(演奏中は曲の時計を止めて撮る・結果は状態を差し替えて撮る)。step で撮る所を選ぶ
//   hide … 歩き回る絵など、止めても毎回ちがう所の目印(CSS のセレクタ)。撮るときだけ隠す(隠した所の崩れは見えないので、最小限に)
//   kind: 'monsuc' … モンサクの撮影の道具(tools/success/success-shoot.js)の場面を名前(shot)で借りる
// sizes を書かない画面は、下の DEFAULT_SIZES(縦・横・PC)で撮る。'rot' = 🔄横(縦 390×844 のまま、ゲームが自分で画面を回す表示)
'use strict';

// 端末の大きさ(依頼文: iPhone 縦 390×844・横 844×390・PC)
// sa … iPhone の切り欠きの余白(px)。ブラウザに env(safe-area-inset-*) として効かせて撮る(2026-11-22 社長の iPhone で、助手ライフの部屋の上の帯が時刻と重なり「戻る」が押せなかった。
//   それまでの撮影は切り欠きの余白なしで、気づけなかった)。縦: 上47・下34 / 横: 左右47・下21
const SIZES = [
  { tag: 'tate', w: 390, h: 844, name: '縦', sa: { top: 47, bottom: 34, left: 0, right: 0 } },
  { tag: 'yoko', w: 844, h: 390, name: '横', sa: { top: 0, bottom: 21, left: 47, right: 47 } },
  { tag: 'pc', w: 1280, h: 800, name: 'PC', sa: { top: 0, bottom: 0, left: 0, right: 0 } },
  { tag: 'rot', w: 390, h: 844, name: '🔄横', rot: true, sa: { top: 47, bottom: 34, left: 0, right: 0 } },
];
const DEFAULT_SIZES = ['tate', 'yoko', 'pc'];
const BEAT_SIZES = ['tate', 'yoko', 'pc', 'rot'];

// 助手ライフを HOME から開く
const lifeOpen = async (s) => {
  const open = await s.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.innerText || '').trim() === '助手ライフ'); if (b) b.click(); return !!b; });
  if (!open) return false;
  await s.wait(1800); await s.dismissOverlays(10);
  return true;
};
// 助手ライフの部屋: 家を開いて、いちばん上の部屋を押す
const lifeRoom = async (s) => {
  if (!(await lifeOpen(s))) return false;
  const ok = await s.page.evaluate(() => { const b = document.querySelector('[data-assistant-life-room]'); if (b) b.click(); return !!b; });
  await s.wait(1200);
  return ok;
};
// 助手ライフの下のタブ(where=町・friends=友情・visit=フレンド・profile=紹介)
const lifeTab = (k) => async (s) => {
  if (!(await lifeOpen(s))) return false;
  const ok = await s.page.evaluate((key) => { const b = [...document.querySelectorAll(`[data-assistant-life-icon="${key}"]`)].find((x) => x.getClientRects().length); if (b) b.click(); return !!b; }, k);
  await s.wait(1500);
  return ok;
};
// 段12(2026-11-22)から下のタブ5つ目は「🐾 マスモン」で、紹介はその画面の「📖 ◯◯のこと」の窓。前の版(タブが「📖 紹介」)でも撮れるよう、無いほうは前の形で開く
const lifeTabOr = (k, alt) => async (s) => {
  if (!(await lifeOpen(s))) return false;
  const has = (key) => s.page.evaluate((q) => [...document.querySelectorAll(`[data-assistant-life-icon="${q}"],[data-alu-tab="${q}"]`)].some((x) => x.getClientRects().length), key);
  return (await has(k)) ? lifeTab(k)(s) : lifeTab(alt)(s);
};
const lifeProfile = async (s) => {
  if (!(await lifeTabOr('profile', 'masmon')(s))) return false;
  const b = await s.page.evaluate(() => { const x = document.querySelector('[data-assistant-life-masmon-open="profile"]'); if (x) x.click(); return true; });
  await s.wait(1200);
  return b;
};

// モンヒロビートの結果の画面に入れる数字(社長の写真 docs/progress/beat/result-yoko-bug-2026-11-22/ と同じ桁の多さ)
const BIG = { score: 899649, maxCombo: 331, fast: 126, slow: 97, precise: 152, judgments: { MARVELOUS: 213, EXCELLENT: 96, GREAT: 17, GOOD: 4, BAD: 1, MISS: 0 } };
const BEAT_STATES = {
  // 何も叩かずに終わった結果(全部 MISS)をそのまま
  plain: null,
  // 新記録あり・JUST MARVELOUS あり(数字が多い)
  record: { ...BIG, isNewRecord: true, previousBestScore: 880123, cleared: true, fullCombo: false, allExcellent: false, allMarvelous: false },
  // フルコンボ(新記録なし)
  fc: { ...BIG, score: 951200, judgments: { MARVELOUS: 250, EXCELLENT: 70, GREAT: 9, GOOD: 2, BAD: 0, MISS: 0 }, isNewRecord: false, cleared: true, fullCombo: true, allExcellent: false, allMarvelous: false },
};

// 助手ライフで歩き回る絵(止めても毎回ちがう)
const LIFE_MOVE = '[data-assistant-life-room-masmon-pet],[data-assistant-life-roomview-masmon]';

const SCENES = [
  // ---- HOME ----
  { id: 'home', area: 'HOME', name: 'HOME', kind: 'walk' },
  { id: 'home-changelog', area: 'HOME', name: '更新履歴', kind: 'walk' },
  { id: 'home-assistant-menu', area: 'HOME', name: '助手のメニュー(HOME)', kind: 'walk' },
  { id: 'home-assistant-help', area: 'HOME', name: '助手の説明(HOME)', kind: 'walk' },
  { id: 'profile', area: 'HOME', name: 'プロフィール', kind: 'walk' },
  { id: 'replay-list', area: 'HOME', name: 'イベント回想(まとまりを開いた所)', kind: 'walk' },
  { id: 'replay-end', area: 'HOME', name: 'イベント回想(お話の締め)', kind: 'walk' },
  { id: 'mission', area: 'HOME', name: 'ミッション', kind: 'walk' },
  { id: 'gift', area: 'HOME', name: 'ギフト', kind: 'walk' },
  { id: 'temple', area: 'HOME', name: '神殿', kind: 'walk' },
  // ---- マーケット ----
  { id: 'market', area: 'マーケット', name: 'マーケット', kind: 'walk' },
  // ---- カードバトル ----
  { id: 'battle-menu', area: 'カードバトル', name: 'モンヒロバトル(仕組みを選ぶ)', kind: 'walk' },
  { id: 'battle-classic', area: 'カードバトル', name: 'クラシック(モード選択)', kind: 'walk' },
  { id: 'battle-play', area: 'カードバトル', name: 'クラシックの対戦中', kind: 'walk' },
  // ---- 設定・ヘルプ ----
  { id: 'settings', area: '設定', name: '設定', kind: 'walk' },
  { id: 'help', area: 'ヘルプ', name: 'ヘルプ', kind: 'walk' },
  // ---- 助手ライフ ----
  { id: 'life-top', area: '助手ライフ', name: '助手ライフ(家)', kind: 'walk', hide: '[data-assistant-life-room-masmon-pet]' }, // 部屋の中を歩くマスモン
  { id: 'life-room', area: '助手ライフ', name: '助手ライフ(部屋)', kind: 'walk', go: lifeRoom, hide: '[data-assistant-life-room-masmon-pet],[data-assistant-life-roomview-masmon]' },
  { id: 'life-town', area: '助手ライフ', name: '助手ライフ(町)', kind: 'walk', go: lifeTab('where'), hide: LIFE_MOVE },
  { id: 'life-bond', area: '助手ライフ', name: '助手ライフ(友情)', kind: 'walk', go: lifeTab('friends'), hide: LIFE_MOVE },
  { id: 'life-friend', area: '助手ライフ', name: '助手ライフ(フレンド)', kind: 'walk', go: lifeTab('visit'), hide: LIFE_MOVE },
  { id: 'life-profile', area: '助手ライフ', name: '助手ライフ(紹介)', kind: 'walk', go: lifeProfile, hide: LIFE_MOVE },
  { id: 'life-masmon', area: '助手ライフ', name: '助手ライフ(マスモン)', kind: 'walk', go: lifeTabOr('masmon', 'profile'), hide: LIFE_MOVE },
  // ---- モンヒロビート ----
  { id: 'beat-top', area: 'モンヒロビート', name: 'モンヒロビート(入口)', kind: 'walk' },
  { id: 'beat-songs', area: 'モンヒロビート', name: '曲えらび', kind: 'walk' },
  { id: 'beat-play', area: 'モンヒロビート', name: '演奏中', kind: 'beat', step: 'play', sizes: BEAT_SIZES },
  { id: 'beat-result', area: 'モンヒロビート', name: '結果', kind: 'beat', step: 'result', state: 'plain', sizes: BEAT_SIZES },
  { id: 'beat-result-record', area: 'モンヒロビート', name: '結果(新記録・JUST MARVELOUS あり)', kind: 'beat', step: 'result', state: 'record', sizes: BEAT_SIZES },
  { id: 'beat-result-fc', area: 'モンヒロビート', name: '結果(フルコンボ)', kind: 'beat', step: 'result', state: 'fc', sizes: BEAT_SIZES },
  // ---- モンサク(success-shoot.js の場面の名前) ----
  { id: 'monsuc-home', area: 'モンサク', name: 'モンサクのホーム', kind: 'monsuc', shot: 'H1' },
  { id: 'monsuc-main', area: 'モンサク', name: '育成ホーム', kind: 'monsuc', shot: 'M1' },
  { id: 'monsuc-train', area: 'モンサク', name: 'トレーニング', kind: 'monsuc', shot: 'T1' },
];

// 曲の時計を止める所(曲の頭からの秒)。演奏中の止め絵はいつもここ
const BEAT_HOLD_SEC = 20;

module.exports = { SCENES, SIZES, DEFAULT_SIZES, BEAT_STATES, BEAT_HOLD_SEC };
