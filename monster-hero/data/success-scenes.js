// モンヒロサクセスの景色の表(住む場所の季節×時間・大会の会場・修行の段)(2026-11-12 開発部)
// 社長の決め: 住む場所の景色は季節と時間で替わる・明るくて遊びたくなる・まわりの帯とボタンは暗い紺のまま。
// 絵は Claude が SVG で描いて PNG にした(外の画像AIは使っていない。参考の動画は見るだけで写していない)。
// 作る道具: node tools/success/scene-art.js(元の SVG は tools/art-sources/success/scenes/)。
// 一覧の絵と足し方: docs/progress/player-raise/art/SCENES.md
//
// ★いまは index.html から読まれず、誰にも見えない(画面は回2・回3)。保存キーも持たない。
// ★絵は縦 1080×1920。上の約15%は帯、下の約30%はボタンで隠れる。育てる子は真ん中(足もと y≈1190)に立つ。
//   kind: home = 住む場所(season × time) / venue = 大会の会場 / training = 修行の段の景色
(function (root) {
  'use strict';
  const SUCCESS_SCENES = Object.freeze([
    { id: 'home-spring-day', kind: 'home', season: 'spring', time: 'day', name: '住む場所(春・昼)', image: 'images/success/scenes/home-spring-day.png?v=5b224376d4f7' },
    { id: 'home-spring-evening', kind: 'home', season: 'spring', time: 'evening', name: '住む場所(春・夕方)', image: 'images/success/scenes/home-spring-evening.png?v=9d01bf0c359a' },
    { id: 'home-spring-night', kind: 'home', season: 'spring', time: 'night', name: '住む場所(春・夜)', image: 'images/success/scenes/home-spring-night.png?v=eb206ae81e1c' },
    { id: 'home-summer-day', kind: 'home', season: 'summer', time: 'day', name: '住む場所(夏・昼)', image: 'images/success/scenes/home-summer-day.png?v=3a6e3153a942' },
    { id: 'home-summer-evening', kind: 'home', season: 'summer', time: 'evening', name: '住む場所(夏・夕方)', image: 'images/success/scenes/home-summer-evening.png?v=2a946dacfc89' },
    { id: 'home-summer-night', kind: 'home', season: 'summer', time: 'night', name: '住む場所(夏・夜)', image: 'images/success/scenes/home-summer-night.png?v=96e2204eb287' },
    { id: 'home-autumn-day', kind: 'home', season: 'autumn', time: 'day', name: '住む場所(秋・昼)', image: 'images/success/scenes/home-autumn-day.png?v=a1663d245c0c' },
    { id: 'home-autumn-evening', kind: 'home', season: 'autumn', time: 'evening', name: '住む場所(秋・夕方)', image: 'images/success/scenes/home-autumn-evening.png?v=ee76f03012a1' },
    { id: 'home-autumn-night', kind: 'home', season: 'autumn', time: 'night', name: '住む場所(秋・夜)', image: 'images/success/scenes/home-autumn-night.png?v=f026f8e98113' },
    { id: 'home-winter-day', kind: 'home', season: 'winter', time: 'day', name: '住む場所(冬・昼)', image: 'images/success/scenes/home-winter-day.png?v=4c2d319c36e9' },
    { id: 'home-winter-evening', kind: 'home', season: 'winter', time: 'evening', name: '住む場所(冬・夕方)', image: 'images/success/scenes/home-winter-evening.png?v=1a33e9d8f74e' },
    { id: 'home-winter-night', kind: 'home', season: 'winter', time: 'night', name: '住む場所(冬・夜)', image: 'images/success/scenes/home-winter-night.png?v=674d19a1870b' },
    // 大会の会場(TOURNAMENT.md の大会の格に合わせた4つ)
    { id: 'venue-debut', kind: 'venue', venue: 'debut', name: 'デビュー戦の会場', use: 'デビュー戦・デビュー戦の再挑戦', image: 'images/success/scenes/venue-debut.png?v=d2380d73411c' },
    { id: 'venue-cup', kind: 'venue', venue: 'cup', name: '大会の会場', use: 'ジュニア期〜プロ期の★〜★★★の大会と期末の強制大会', image: 'images/success/scenes/venue-cup.png?v=c9cdfad7c777' },
    { id: 'venue-hero', kind: 'venue', venue: 'hero', name: 'ヒーロー記念の会場', use: 'ヒーロー記念(プロ期の6月・プロ期末の冬のヒーロー記念)', image: 'images/success/scenes/venue-hero.png?v=f9559904e91d' },
    { id: 'venue-summit', kind: 'venue', venue: 'summit', name: 'ヒーローズファイナルの会場', use: '最後の期のヒーローズファイナル(1回戦・準決勝・決勝)', image: 'images/success/scenes/venue-summit.png?v=c9cd61050084' },
    // 修行の段の景色(段ごとに景色が替わる。どの段にどれを使うかは回2・回3で決める)
    { id: 'training-volcano', kind: 'training', place: 'volcano', name: '修行の地(火山)', image: 'images/success/scenes/training-volcano.png?v=bce3b23cbc0b' },
    { id: 'training-iceberg', kind: 'training', place: 'iceberg', name: '修行の地(氷山)', image: 'images/success/scenes/training-iceberg.png?v=b60828f16f37' },
    { id: 'training-waterfall', kind: 'training', place: 'waterfall', name: '修行の地(大滝)', image: 'images/success/scenes/training-waterfall.png?v=a5dd08d94443' },
  ].map(Object.freeze));

  const SUCCESS_SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
  const SUCCESS_SCENE_TIMES = Object.freeze(['day', 'evening', 'night']);

  // 月(1〜12)から季節: 春 3〜5月 / 夏 6〜8月 / 秋 9〜11月 / 冬 12〜2月
  function successSeasonOfMonth(month) {
    const m = Number(month);
    if (!Number.isFinite(m)) return 'spring';
    const mm = ((Math.round(m) - 1) % 12 + 12) % 12 + 1;
    if (mm >= 3 && mm <= 5) return 'spring';
    if (mm >= 6 && mm <= 8) return 'summer';
    if (mm >= 9 && mm <= 11) return 'autumn';
    return 'winter';
  }

  // 住む場所の景色を1つ選ぶ(知らない値は春・昼に寄せる)
  function successHomeScene(season, time) {
    const s = SUCCESS_SEASONS.includes(season) ? season : 'spring';
    const t = SUCCESS_SCENE_TIMES.includes(time) ? time : 'day';
    return SUCCESS_SCENES.find((x) => x.kind === 'home' && x.season === s && x.time === t);
  }

  function successSceneById(id) {
    return SUCCESS_SCENES.find((x) => x.id === id) || null;
  }

  const api = { SUCCESS_SCENES, SUCCESS_SEASONS, SUCCESS_SCENE_TIMES, successSeasonOfMonth, successHomeScene, successSceneById };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
