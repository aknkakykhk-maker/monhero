// モンヒロサクセスの音の割り当て表(2026-11-12 開発部)
// 新しい音源は作らない・受け取らない。ゲームに今ある BGM(BGM_TRACKS の id)と効果音(Audio_.fgSe の名前)を、場面に割り当てるだけ。
// 鳴らす口: src/parts/14-success-sound.jsx の SuccessSound / useSuccessSound。画面(回2・回3)は場面の id だけ渡す。
// 保存キーは持たない(音量・消音は今の設定をそのまま使う)。
//
// bgm … 場面に入ったときに流す曲。null / 書かない = 今の曲をそのまま続ける(訓練の結果などは曲を替えない)
// bgmBySeason … 住む場所のように季節で曲を替える場面(spring/summer/autumn/winter)
// se  … 場面に入ったときに1回鳴らす効果音(fgSe の名前)。null = 鳴らさない
// 曲えらびに出る「アレンジ用の曲」(event_02 など自動では使わない曲)・モンヒロビートの曲・バトルのボス曲は使わない
(function (root) {
  'use strict';
  const SUCCESS_SOUND_SCENES = Object.freeze([
    // メイン(住む場所)。季節で替える
    { id: 'main', name: 'メイン(住む場所)', bgmBySeason: { spring: 'original_home', summer: 'ichika_home', autumn: 'original_profile', winter: 'original_enhance' }, se: null },
    // 訓練の結果4種(曲は替えない)
    { id: 'trainGreat', name: '訓練: 大成功', se: 'trainingGoal' },
    { id: 'trainOk', name: '訓練: 成功', se: 'trainingGood' },
    { id: 'trainFail', name: '訓練: 失敗', se: 'trainingFail' },
    { id: 'trainSkip', name: '訓練: サボり', se: 'trainingMove' },
    // 叱る/褒める・訓練Lvアップ
    { id: 'scold', name: '叱る', se: 'trainingBad' },
    { id: 'praise', name: '褒める', se: 'trainingReward' },
    { id: 'trainLvUp', name: '訓練Lvアップ', se: 'levelUp' },
    // 修行
    { id: 'ascetic', name: '修行', bgm: 'original_prep', se: 'trainingDecide' },
    // 大会
    { id: 'cupEntry', name: '大会: 受付', se: 'join' },
    { id: 'cupMatch', name: '大会: 試合', bgm: 'original_battle', se: 'trainingDice' },
    { id: 'cupWin', name: '大会: 勝ち', bgm: 'ichika_clear', se: 'rankFanfare' },
    { id: 'cupLose', name: '大会: 負け', se: 'trainingFail' },
    // イッサ博士・ゲームオーバー・引退
    { id: 'issa', name: 'イッサ博士', bgm: 'original_event_01', se: 'trainingTool' },
    { id: 'gameOver', name: 'ゲームオーバー', bgm: 'original_game_over', se: null },
    { id: 'retire', name: '引退', bgm: 'original_result', se: 'rankFanfareGrand' },
  ].map(Object.freeze));

  const SUCCESS_SOUND_SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

  function successSoundScene(id) {
    return SUCCESS_SOUND_SCENES.find((x) => x.id === id) || null;
  }

  // 場面の曲(BGM_TRACKS の id)。曲を替えない場面・知らない場面は null。知らない季節は春に寄せる
  function successSoundBgm(id, season) {
    const s = successSoundScene(id);
    if (!s) return null;
    if (s.bgmBySeason) return s.bgmBySeason[SUCCESS_SOUND_SEASONS.includes(season) ? season : 'spring'] || null;
    return s.bgm || null;
  }

  // 場面の効果音(fgSe の名前)。鳴らさない場面・知らない場面は null
  function successSoundSe(id) {
    const s = successSoundScene(id);
    return (s && s.se) || null;
  }

  const api = { SUCCESS_SOUND_SCENES, SUCCESS_SOUND_SEASONS, successSoundScene, successSoundBgm, successSoundSe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
