// モンヒロサクセスの音の割り当て表(2026-11-12 開発部)
// 新しい音源は作らない・受け取らない。ゲームに今ある BGM(BGM_TRACKS の id)と効果音(Audio_.fgSe の名前)を、場面に割り当てるだけ。
// 鳴らす口: src/parts/14-success-sound.jsx の SuccessSound / useSuccessSound。画面(回2・回3)は場面の id だけ渡す。
// 保存キーは持たない(音量・消音は今の設定をそのまま使う)。
//
// bgm … 場面に入ったときに流す曲。null / 書かない = 今の曲をそのまま続ける(トレーニングの結果などは曲を替えない)
// bgmBySeason … 住む場所のように季節で曲を替える場面(spring/summer/autumn/winter)
// se  … 場面に入ったときに1回鳴らす効果音(fgSe の名前)。null = 鳴らさない
// 曲えらびに出る「アレンジ用の曲」(event_02 など自動では使わない曲)・モンヒロビートの曲・バトルのボス曲は使わない
(function (root) {
  'use strict';
  const SUCCESS_SOUND_SCENES = Object.freeze([
    // メイン(住む場所)。2026-11-13 社長の「モンサク ホームBGM」(original_home_2)に4季節とも替えた。季節で曲を替えたいときはここを戻す(前: 春 original_home / 夏 ichika_home / 秋 original_profile / 冬 original_enhance)
    { id: 'main', name: 'メイン(住む場所)', bgmBySeason: { spring: 'original_home_2', summer: 'original_home_2', autumn: 'original_home_2', winter: 'original_home_2' }, se: null },
    // トレーニング全体(2026-11-14 社長の「モンサク トレーニングBGM」)。画面に入ってから抜けるまでこの曲。結果の効果音は下の4種が鳴らす
    { id: 'training', name: 'トレーニング', bgm: 'monsuc_training', se: null },
    // 休む(2026-11-14 社長の「モンサク 休養BGM」)。休むを選んだ場面のあいだこの曲(遊ぶ・通院の曲は決まっていない)
    { id: 'rest', name: '休む', bgm: 'monsuc_rest', se: 'heal' },
    // 休む・遊ぶ・通院の効果音(2026-11-14 社長「休んだときの音もないから、わかりにくい」): 休む・通院=回復の音 heal / 遊ぶ=trainingGood
    // 遊ぶ・通院(2026-11-14 社長「なにか曲を当てはめといて」)。専用の曲が届くまで、ゲームにある曲から仮に当てた(曲を替えるときはここ)
    { id: 'play', name: '遊ぶ', bgm: 'ichika_home', se: 'trainingGood' },
    { id: 'hospital', name: '通院', bgm: 'original_profile', se: 'heal' },
    // 育成の外の画面(モンヒロサクセスを開いたときのメニュー・ボックス・ランキング・図鑑・始めるまでの準備)。2026-11-14 社長の「モンサク メインBGM」
    { id: 'menu', name: 'メニュー(育成の外)', bgm: 'monsuc_menu', se: null },
    // トレーニングの結果4種(曲は替えない)。演出のあと結果の字が出たときに鳴らす。2026-11-14 社長「大成功は派手に・失敗は残念そうに」で 大成功=ファンファーレ・成功=和音・サボり=低いブザーに替えた
    { id: 'trainGreat', name: 'トレーニング: 大成功', se: 'rankFanfare' },
    { id: 'trainOk', name: 'トレーニング: 成功', se: 'trainingGoal' },
    { id: 'trainFail', name: 'トレーニング: 失敗', se: 'trainingFail' },
    { id: 'trainSkip', name: 'トレーニング: サボり', se: 'trainingBad' },
    // 叱る/褒める・トレーニングLvアップ
    { id: 'scold', name: '叱る', se: 'trainingBad' },
    { id: 'praise', name: '褒める', se: 'trainingReward' },
    { id: 'trainLvUp', name: 'トレーニングLvアップ', se: 'levelUp' },
    // トレーニングしている場面(56-monsuc-actfx.jsx の MsxTrainAct・2026-11-14 社長「演出に音を」)。場面に入っても曲は替えない。
    // 動きの音は場面の中から時間を合わせて鳴らす(MSX_ACT_SE)。足音・跳ぶ・割る/当たる・よける・投げる・落ちてくる・受け止める・積む・ひらめく・閃光
    { id: 'trainAct', name: 'トレーニングの場面', se: null },
    { id: 'actStep', name: 'トレーニングの場面: 足音', se: 'trainingDice' },
    { id: 'actLeap', name: 'トレーニングの場面: 跳ぶ', se: 'enemyMove' },
    { id: 'actHit', name: 'トレーニングの場面: 割る・当たる', se: 'attack' },
    { id: 'actDodge', name: 'トレーニングの場面: よける', se: 'zanSlash' },
    { id: 'actThrow', name: 'トレーニングの場面: 投げる', se: 'card' },
    { id: 'actDrop', name: 'トレーニングの場面: 落ちてくる', se: 'enemyMove' },
    { id: 'actGuard', name: 'トレーニングの場面: 受け止める', se: 'guard' },
    { id: 'actBlock', name: 'トレーニングの場面: 積む', se: 'tap' },
    { id: 'actIdea', name: 'トレーニングの場面: ひらめく', se: 'trainingTool' },
    { id: 'actTag', name: 'トレーニングの場面: 友情タッグのカットイン', se: 'friendTag' }, // 2026-11-14 社長「友情タッグのときは、特別な演出や効果音を入れて」
    { id: 'actFlash', name: 'トレーニングの場面: Lv5の閃光', se: 'crit' },
    // 修行の段(MsxShugyoStages)。曲は修行(ascetic)のまま。段の切り替え・溜め・斬る・跳ぶ・叩きつけ
    { id: 'qStage', name: '修行の段: 切り替え', se: 'trainingDecide' },
    { id: 'qCharge', name: '修行の段: 溜め', se: 'enemyCharge' },
    { id: 'qStrike', name: '修行の段: 斬る', se: 'zanSlash' },
    { id: 'qLeap', name: '修行の段: 跳ぶ', se: 'enemyMove' },
    { id: 'qSlam', name: '修行の段: 叩きつけ', se: 'crit' },
    { id: 'qShine', name: '修行の段: 光る(星の湖)', se: 'special' },
    // 修行の結果(段のあと、結果の字が出たとき)。覚えた=ファンファーレ・覚えなかった=残念そうな音
    { id: 'qLearn', name: '修行の結果: 技を覚えた', se: 'rankFanfare' },
    { id: 'qMiss', name: '修行の結果: 覚えなかった', se: 'trainingFail' },
    // 覚醒の入り(56-monsuc-awake.jsx の MsxAwakeShow)。曲は社長の曲が来るまで「合体テーマ」を当てる
    { id: 'awakeShow', name: '覚醒の入り', bgm: 'original_fusion', se: 'enemyCharge' },
    { id: 'awQi', name: '覚醒: 気が噴き出す', se: 'special' },
    { id: 'awFlash', name: '覚醒: 閃光と札', se: 'fusion' },
    { id: 'awKira', name: '覚醒: キラをまとう', se: 'levelUp' },
    // 期の区切り(56-monsuc-kifx.jsx の MsxKiShow)。曲は社長の曲が来るまで「Monster Hero」を当てる
    { id: 'kiShow', name: '期の区切り: 第◯章 終了', bgm: 'monster_hero_theme', se: 'rankFanfare' },
    { id: 'kiNext', name: '期の区切り: NEXT', se: 'join' },
    // 修行
    { id: 'ascetic', name: '修行', bgm: 'original_prep', se: 'trainingDecide' },
    // 大会
    // 大会: 受付と、試合が始まる前の画面(相手の紹介・トーナメント表)は大会の曲。試合中はバトルの曲(2026-11-14 社長の「モンサク 大会BGM」)
    { id: 'cupEntry', name: '大会: 受付', bgm: 'monsuc_cup', se: 'join' },
    { id: 'cupPre', name: '大会: 試合の前', bgm: 'monsuc_cup', se: null },
    { id: 'cupMatch', name: '大会: 試合', bgm: 'ichika_battle', se: 'trainingDice' },
    // 勝ち・負けは短いジングルを1回だけ流して無音(2026-11-14 社長)。ジングルが効果音のかわりなので se は付けない
    { id: 'cupWin', name: '大会: 勝ち', bgm: 'monsuc_win', se: null },
    { id: 'cupLose', name: '大会: 負け', bgm: 'monsuc_lose', se: null },
    // イッサ博士・ゲームオーバー・引退
    { id: 'issa', name: 'イッサ博士', bgm: 'original_event_01', se: 'trainingTool' },
    // 博士の大きな賭けの演出(2026-11-14 社長「イッサ博士の演出が弱い」。56-monsuc-issa.jsx)。大成功は閃光+大ファンファーレ+きらめきの重ねで専用の音にする
    { id: 'issaIn', name: '博士: 飛びこんでくる', se: 'join' },
    { id: 'issaDrum', name: '博士: 装置の溜め(ドキドキ)', se: 'trainingDice' },
    { id: 'issaZap', name: '博士: 大成功の閃光', se: 'fusion' },
    { id: 'issaPuff', name: '博士: 失敗の煙', se: 'enemyMove' },
    { id: 'issaWin', name: '博士: 大成功', se: 'rankFanfareGrand' },
    { id: 'issaWin2', name: '博士: 大成功のきらめき', se: 'levelUp' },
    { id: 'issaLose', name: '博士: 失敗', se: 'trainingFail' },
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
