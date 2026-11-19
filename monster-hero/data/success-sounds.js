// モンヒロサクセスの音の割り当て表(2026-11-12 開発部)
// 新しい音源は作らない・受け取らない。ゲームに今ある BGM(BGM_TRACKS の id)と効果音(Audio_.fgSe の名前)を、場面に割り当てるだけ。
// 鳴らす口: src/parts/14-success-sound.jsx の SuccessSound / useSuccessSound。画面(回2・回3)は場面の id だけ渡す。
// 保存キーは持たない(音量・消音は今の設定をそのまま使う)。
//
// bgm … 場面に入ったときに流す曲。null / 書かない = 今の曲をそのまま続ける(トレーニングの結果などは曲を替えない)
// bgmBySeason … 住む場所のように季節で曲を替える場面(spring/summer/autumn/winter)
// mean … 場面に入ったときに1回鳴らす効果音の「意味」(下の SUCCESS_SFX の id)。null = 鳴らさない。
//        効果音の名前(fgSe)は場面に直接書かない。音を替えるときは意味の表で替える(2026-11-19 r1119 ①音・点検 Q-1-9)
// afterJingle … 勝ち・負けのジングルが鳴っている途中なら、鳴り終わってから曲を替え、効果音は鳴らさない(ジングルを切らない・点検 Q-1-6)
// 曲えらびに出る「アレンジ用の曲」(event_02 など自動では使わない曲)・モンヒロビートの曲・バトルのボス曲は使わない
(function (root) {
  'use strict';
  const SUCCESS_SOUND_SCENES = Object.freeze([
    // メイン(住む場所)。2026-11-13 社長の「モンサク ホームBGM」(original_home_2)に4季節とも替えた。季節で曲を替えたいときはここを戻す(前: 春 original_home / 夏 ichika_home / 秋 original_profile / 冬 original_enhance)
    { id: 'main', name: 'メイン(住む場所)', bgmBySeason: { spring: 'original_home_2', summer: 'original_home_2', autumn: 'original_home_2', winter: 'original_home_2' }, mean: null },
    // トレーニング全体(2026-11-14 社長の「モンサク トレーニングBGM」)。画面に入ってから抜けるまでこの曲。結果の効果音は下の4種が鳴らす
    { id: 'training', name: 'トレーニング', bgm: 'monsuc_training', mean: null },
    // 休む(2026-11-14 社長の「モンサク 休養BGM」)。休むを選んだ場面のあいだこの曲(遊ぶ・通院の曲は決まっていない)
    { id: 'rest', name: '休む', bgm: 'monsuc_rest', mean: null },
    // 休む・遊ぶ・通院の効果音(2026-11-14 社長「休んだときの音もないから、わかりにくい」)は、結果のゲージの演出(56-monsuc-gaugefx.jsx)が回復の音を1回鳴らす。
    // 場面の側では鳴らさない(両方で鳴って二重になっていた・点検 Q-1-7)
    // 遊ぶ・通院(2026-11-14 社長「なにか曲を当てはめといて」)。専用の曲が届くまで、ゲームにある曲から仮に当てた(曲を替えるときはここ)
    { id: 'play', name: '遊ぶ', bgm: 'ichika_home', mean: null },
    { id: 'hospital', name: '通院', bgm: 'original_profile', mean: null },
    // 育成の外の画面(モンヒロサクセスを開いたときのメニュー・ボックス・ランキング・図鑑・始めるまでの準備)。2026-11-14 社長の「モンサク メインBGM」
    { id: 'menu', name: 'メニュー(育成の外)', bgm: 'monsuc_menu', mean: null },
    // トレーニングの結果4種(曲は替えない)。演出のあと結果の字が出たときに鳴らす。2026-11-14 社長「大成功は派手に・失敗は残念そうに」で 大成功=ファンファーレ・成功=和音・サボり=低いブザーに替えた
    { id: 'trainGreat', name: 'トレーニング: 大成功', mean: 'great' },
    { id: 'trainGreatTag', name: 'トレーニング: 大成功と友情タッグが重なった', mean: 'grand' }, // 2026-11-15 社長 r1115-069
    { id: 'trainTag', name: 'トレーニング: 友情タッグ', mean: 'great' }, // 2026-11-18 社長「友情タッグはSEも激しく」。成功の和音からファンファーレへ
    { id: 'trainOk', name: 'トレーニング: 成功', mean: 'success' },
    { id: 'trainFail', name: 'トレーニング: 失敗', mean: 'fail' },
    { id: 'trainSkip', name: 'トレーニング: サボり', mean: 'bad' },
    // 叱る/褒める・トレーニングLvアップ
    { id: 'scold', name: '叱る', mean: 'bad' },
    { id: 'praise', name: '褒める', mean: 'praise' },
    { id: 'trainLvUp', name: 'トレーニングLvアップ', mean: 'levelUp' },
    // トレーニングしている場面(56-monsuc-actfx.jsx の MsxTrainAct・2026-11-14 社長「演出に音を」)。場面に入っても曲は替えない。
    // 動きの音は場面の中から時間を合わせて鳴らす(MSX_ACT_SE)。足音・跳ぶ・割る/当たる・よける・投げる・落ちてくる・受け止める・積む・ひらめく・閃光
    { id: 'trainAct', name: 'トレーニングの場面', mean: null },
    { id: 'actStep', name: 'トレーニングの場面: 足音', mean: 'step' },
    { id: 'actLeap', name: 'トレーニングの場面: 跳ぶ', mean: 'whoosh' },
    { id: 'actHit', name: 'トレーニングの場面: 割る・当たる', mean: 'hit' },
    { id: 'actDodge', name: 'トレーニングの場面: よける', mean: 'slash' },
    { id: 'actThrow', name: 'トレーニングの場面: 投げる', mean: 'throw' },
    { id: 'actDrop', name: 'トレーニングの場面: 落ちてくる', mean: 'whoosh' },
    { id: 'actGuard', name: 'トレーニングの場面: 受け止める', mean: 'guard' },
    { id: 'actBlock', name: 'トレーニングの場面: 積む', mean: 'place' },
    { id: 'actIdea', name: 'トレーニングの場面: ひらめく', mean: 'use' },
    { id: 'actTag', name: 'トレーニングの場面: 友情タッグのカットイン', mean: 'tag' }, // 2026-11-14 社長「友情タッグのときは、特別な演出や効果音を入れて」
    { id: 'actFlash', name: 'トレーニングの場面: Lv5の閃光', mean: 'impact' },
    // 友情タッグ・大成功・重なりの決めの演出(56-monsuc-trainfx.jsx・2026-11-15 社長 r1115-067〜069)。新しい音源は入れず、いまある効果音を当てる
    // 2026-11-18 社長「友情タッグや大成功はSEも激しく」で、決めの瞬間に重ねる音(きらめき・閃光)を足した
    { id: 'actTagJoin', name: 'トレーニングの場面: 仲間の光が集まる', mean: 'gather' },
    { id: 'actTagFin', name: 'トレーニングの場面: タッグフィニッシュ', mean: 'flash' },
    { id: 'actTagSpark', name: 'トレーニングの場面: 友情タッグのきらめき', mean: 'sparkle' },
    { id: 'actGreatCharge', name: 'トレーニングの場面: 大成功の溜め', mean: 'charge' },
    { id: 'actGreatBoom', name: 'トレーニングの場面: 大成功の爆発', mean: 'impact' },
    { id: 'actGreatFlash', name: 'トレーニングの場面: 大成功の閃光', mean: 'flash' },
    { id: 'actGreatSpark', name: 'トレーニングの場面: 大成功のきらめき', mean: 'sparkle' },
    { id: 'actComboBoom', name: 'トレーニングの場面: 絆の大爆発', mean: 'flash' },
    // 持ち物を使ったときの演出(56-monsuc-itemfx.jsx・2026-11-15 社長 r1115-079)。使った音と、種類ごとの効いた音
    { id: 'itemUse', name: '持ち物: 使った', mean: 'use' },
    { id: 'itemHeal', name: '持ち物: 回復した', mean: 'heal' },
    { id: 'itemBuff', name: '持ち物: 効き目がついた', mean: 'sparkle' },
    { id: 'itemBond', name: '持ち物: 気持ちが通じた', mean: 'praise' },
    { id: 'itemBox', name: '持ち物: 中身が出てきた', mean: 'appear' },
    // 修行の段(MsxShugyoStages)。曲は修行(ascetic)のまま。段の切り替え・溜め・斬る・跳ぶ・叩きつけ
    { id: 'qStage', name: '修行の段: 切り替え', mean: 'go' },
    { id: 'qCharge', name: '修行の段: 溜め', mean: 'charge' },
    { id: 'qStrike', name: '修行の段: 斬る', mean: 'slash' },
    { id: 'qLeap', name: '修行の段: 跳ぶ', mean: 'whoosh' },
    { id: 'qSlam', name: '修行の段: 叩きつけ', mean: 'impact' },
    { id: 'qShine', name: '修行の段: 光る(星の湖)', mean: 'qi' },
    // 修行の結果(段のあと、結果の字が出たとき)。覚えた=ファンファーレ・覚えなかった=残念そうな音
    { id: 'qLearn', name: '修行の結果: 技を覚えた', mean: 'great' },
    { id: 'qMiss', name: '修行の結果: 覚えなかった', mean: 'fail' },
    // 覚醒の入り(56-monsuc-awake.jsx の MsxAwakeShow)。曲は社長の曲が来るまで「合体テーマ」を当てる
    { id: 'awakeShow', name: '覚醒の入り', bgm: 'original_fusion', mean: 'charge' },
    { id: 'awQi', name: '覚醒: 気が噴き出す', mean: 'qi' },
    { id: 'awFlash', name: '覚醒: 閃光と文字', mean: 'flash' },
    { id: 'awKira', name: '覚醒: キラをまとう', mean: 'sparkle' },
    // 期の区切り(56-monsuc-kifx.jsx の MsxKiShow)。曲は社長の曲が来るまで「Monster Hero」を当てる
    { id: 'kiShow', name: '期の区切り: 第◯章 終了', bgm: 'monster_hero_theme', mean: 'periodEnd', afterJingle: true },
    { id: 'kiNext', name: '期の区切り: NEXT', mean: 'periodNext' },
    // 修行
    { id: 'ascetic', name: '修行', bgm: 'original_prep', mean: 'go' },
    // 大会
    // 大会: 受付と、試合が始まる前の画面(相手の紹介・トーナメント表)は大会の曲。試合中はバトルの曲(2026-11-14 社長の「モンサク 大会BGM」)
    // 受付を開いたときの効果音は付けない(押したボタンの決定音だけ。社長「大会のボタンを押すと謎のSE」= join だった・点検 Q-1-1)
    // 試合の効果音は付けない(開始の合図は試合の部品が意味 matchReady・matchGo で鳴らす。さいころの音が重なっていた・点検 Q-1-4)
    { id: 'cupEntry', name: '大会: 受付', bgm: 'monsuc_cup', mean: null },
    { id: 'cupPre', name: '大会: 試合の前', bgm: 'monsuc_cup', mean: null },
    { id: 'cupMatch', name: '大会: 試合', bgm: 'ichika_battle', mean: null },
    // 勝ち・負けは短いジングルを1回だけ流す(2026-11-14 社長)。ジングルが効果音のかわりなので se は付けない
    { id: 'cupWin', name: '大会: 勝ち', bgm: 'monsuc_win', mean: null },
    { id: 'cupLose', name: '大会: 負け', bgm: 'monsuc_lose', mean: null },
    // 決着のあと(ごほうび・昇級・ごはんの段)。ジングルが鳴り終わってから大会の曲をループさせる(sceneAfterOnce で入る)。無音のままにしない
    { id: 'cupAfter', name: '大会: 決着のあと', bgm: 'monsuc_cup', mean: null },
    // エンディング(ヒーローズファイナルのあとの掛け合い・エンディング・お祝い)。勝ち負けのジングルが鳴り終わってから流し、引退の画面まで切らさない(r1115-091)
    //   グッド・超グッド = クリアテーマ / バッド = リザルトテーマ(引退の画面と同じ曲なので、そのまま続く)
    { id: 'ending', name: 'エンディング(優勝)', bgm: 'ichika_clear', mean: null },
    { id: 'endingBad', name: 'エンディング(バッド)', bgm: 'original_result', mean: null },
    // イッサ博士・ゲームオーバー・引退
    { id: 'issa', name: 'イッサ博士', bgm: 'original_event_01', mean: 'use' },
    // 博士の大きな賭けの演出(2026-11-14 社長「イッサ博士の演出が弱い」。56-monsuc-issa.jsx)。大成功は閃光+大ファンファーレ+きらめきの重ねで専用の音にする
    { id: 'issaIn', name: '博士: 飛びこんでくる', mean: 'whoosh' },
    { id: 'issaDrum', name: '博士: 装置の溜め(ドキドキ)', mean: 'drum' },
    { id: 'issaZap', name: '博士: 大成功の閃光', mean: 'flash' },
    { id: 'issaPuff', name: '博士: 失敗の煙', mean: 'whoosh' },
    { id: 'issaWin', name: '博士: 大成功', mean: 'grand' },
    { id: 'issaWin2', name: '博士: 大成功のきらめき', mean: 'sparkle' },
    { id: 'issaLose', name: '博士: 失敗', mean: 'fail' },
    { id: 'gameOver', name: 'ゲームオーバー', bgm: 'original_game_over', mean: null },
    { id: 'retire', name: '引退', bgm: 'original_result', mean: 'grand' },
  ].map(Object.freeze));

  // ===== 音を意味で引く表(2026-11-19 r1119 ①音・点検 Q-1-9・Q-6-1) =====
  // モンサクの画面・部品は効果音の名前(Audio_.fgSe の名前)を書かない。ここの「意味」で鳴らす(SuccessSound.sfx(意味) か、上の場面の mean)。
  // se   … 実際に鳴らす効果音(fgSe の名前)。null = 鳴らさない
  // same … ほかのモード(カードバトル・HOME・モンヒロビート)の同じ種類の操作で鳴る音。そろえた先
  // ボタンの決定・戻るは 60-app の「全ボタンのタップ」が鳴らす(モンサクの中も fgSe で鳴る)。画面のボタンから decide・back を重ねて鳴らさない。
  //   画面から鳴らしてよいのは、ボタンでない操作(なぞって選ぶなど)だけ
  const SUCCESS_SFX = Object.freeze([
    // 操作
    { id: 'decide', name: '決定(ボタン)', se: 'tap', same: 'カードバトル・HOME のボタンと同じ(60-app の共通の口)' },
    { id: 'back', name: '戻る・閉じる', se: 'tap', same: 'カードバトル・HOME と同じ(60-app の共通の口)' },
    { id: 'select', name: 'なぞって選んだ(ボタンでない操作)', se: 'tap', same: '決定と同じ音' },
    { id: 'entry', name: '大会の受付を開いた', se: null, same: '決定の音だけ(画面が開いた合図は鳴らさない)' },
    // 大会・試合
    { id: 'matchReady', name: '試合の入り(大会名の大写し)', se: 'card', same: 'カードバトルの札を出す音' },
    { id: 'matchGo', name: '試合開始の合図', se: 'trainingDecide' },
    { id: 'go', name: '出発・段の切り替え(修行)', se: 'trainingDecide', same: '試合開始の合図と同じ音' },
    { id: 'win', name: '大会の勝ち', se: null, same: '効果音は鳴らさない。勝ちのジングル(場面 cupWin の曲)1つだけ' },
    { id: 'lose', name: '大会の負け', se: null, same: '効果音は鳴らさない。負けのジングル(場面 cupLose の曲)1つだけ' },
    { id: 'winSolo', name: '勝ち(ジングルの無い所: 練習試合・助手マスモン対戦)', se: 'victory', same: 'カードバトルの勝ちと同じ。曲を止めるので、モンサクの大会では使わない' },
    { id: 'loseSolo', name: '負け(ジングルの無い所)', se: 'trainingFail' },
    { id: 'judge', name: '判定に入る', se: 'card' },
    { id: 'periodEnd', name: '期の区切り(第◯章 終了)', se: 'rankFanfare', same: 'ジングルが鳴っているあいだは鳴らさない(場面の afterJingle)' },
    { id: 'periodNext', name: '期の区切り: NEXT', se: 'card' },
    // 試合の動き(トレーニングの音を流用しない・点検 Q-1-8)
    { id: 'hit', name: '当たる・割る', se: 'attack', same: 'カードバトルの攻撃と同じ' },
    { id: 'bigTech', name: '大技の出だし', se: 'special', same: 'カードバトルの必殺技と同じ' },
    { id: 'crit', name: '会心', se: 'crit', same: 'カードバトルの会心と同じ' },
    { id: 'hitTaken', name: '相手の技が当たる', se: 'enemyAttack', same: 'カードバトルの敵の攻撃と同じ' },
    { id: 'miss', name: 'はずれ・よけた', se: 'enemyMove' },
    { id: 'guard', name: '受け止める・ガード', se: 'guard', same: 'カードバトルのガードと同じ' },
    { id: 'charge', name: '溜め', se: 'enemyCharge', same: 'カードバトルの敵の溜めと同じ' },
    { id: 'sulk', name: 'すねる・サボる', se: 'trainingBad' },
    { id: 'move', name: '動く・下がる', se: 'enemyMove' },
    { id: 'swap', name: '交代', se: 'card' },
    { id: 'ko', name: '倒れる(KO)', se: 'crit' },
    // 結果
    { id: 'success', name: '成功', se: 'trainingGoal' },
    { id: 'great', name: '大成功', se: 'rankFanfare', same: 'モンヒロビートのランクアップと同じ' },
    { id: 'grand', name: 'いちばん大きなお祝い', se: 'rankFanfareGrand' },
    { id: 'fail', name: '失敗', se: 'trainingFail' },
    { id: 'bad', name: 'サボり・叱る', se: 'trainingBad' },
    { id: 'praise', name: '褒める・気持ちが通じた', se: 'trainingReward' },
    { id: 'levelUp', name: 'Lvアップ', se: 'levelUp' },
    { id: 'heal', name: '回復', se: 'heal', same: 'カードバトルの回復と同じ' },
    { id: 'use', name: '使った・ひらめく', se: 'trainingTool' },
    // 演出
    { id: 'step', name: '足音', se: 'trainingDice' },
    { id: 'drum', name: 'ドキドキ(溜め)', se: 'trainingDice' },
    { id: 'whoosh', name: '跳ぶ・落ちる・飛びこむ・煙', se: 'enemyMove' },
    { id: 'slash', name: '斬る・よける', se: 'zanSlash' },
    { id: 'throw', name: '投げる', se: 'card' },
    { id: 'place', name: '積む', se: 'tap' },
    { id: 'tag', name: '友情タッグのカットイン', se: 'friendTag' },
    { id: 'gather', name: '仲間の光が集まる', se: 'join', same: 'join は「仲間が加わる」の意味だけに使う' },
    { id: 'appear', name: '中身が出てきた', se: 'special' },
    { id: 'qi', name: '気が噴き出す・光る', se: 'special' },
    { id: 'flash', name: '閃光', se: 'fusion' },
    { id: 'impact', name: '叩きつけ・爆発', se: 'crit' },
    { id: 'sparkle', name: 'きらめき・効き目がついた', se: 'levelUp' },
  ].map(Object.freeze));

  function successSfx(id) {
    return SUCCESS_SFX.find((x) => x.id === id) || null;
  }
  // 意味から効果音の名前(fgSe)。鳴らさない意味・知らない意味は null
  function successSfxSe(id) {
    const x = successSfx(id);
    return (x && x.se) || null;
  }

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

  // 場面の効果音(fgSe の名前。場面の意味を意味の表で引く)。鳴らさない場面・知らない場面は null
  function successSoundSe(id) {
    const s = successSoundScene(id);
    return (s && s.mean && successSfxSe(s.mean)) || null;
  }

  const api = { SUCCESS_SOUND_SCENES, SUCCESS_SOUND_SEASONS, SUCCESS_SFX, successSoundScene, successSoundBgm, successSoundSe, successSfx, successSfxSe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
