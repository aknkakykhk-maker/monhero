// =====================================================================
// AUDIO: BGM/ジングルはAudioBuffer、SEはTone.js(Web Audio)で再生
// デフォルトは無音。ユーザーが音量ボタンを押すと有効化される。
// =====================================================================
const BGM_TRACKS = [
  { id:'original_title', name:'タイトルテーマ', creator:'オリジナル', src:'audio/bgm-title-theme.mp3', gain:1, loop:true, legacyKey:'title' },
  // タイトル画面の曲。旧デフォルトのoriginal_titleはlegacyKeyを保ったまま残し、
  // BGMアレンジからいつでも選び直せるようにする。Monster Hero -Another- を新しい既定にし、
  // Monster Heroはアレンジの選択肢として残す(どちらも別テイクの生成曲で、同じ曲の別品質ではない)
  { id:'monster_hero_theme', name:'Monster Hero', creator:'オリジナル', src:'audio/bgm-monster-hero-theme.mp3', gain:1, loop:true },
  { id:'monster_hero_theme_alt', name:'Monster Hero -Another-', creator:'オリジナル', src:'audio/bgm-monster-hero-theme-alt.mp3', gain:1, loop:true },
  { id:'original_home', name:'HOMEテーマ', creator:'オリジナル', src:'audio/bgm-title.mp3', gain:1, loop:true, legacyKey:'home' },
  { id:'original_prep', name:'強化テーマ', creator:'オリジナル', src:'audio/bgm-menu.mp3', gain:1, loop:true, legacyKey:'prep' },
  { id:'original_battle', name:'バトルテーマ', creator:'オリジナル', src:'audio/bgm-battle.mp3', gain:1, loop:true, legacyKey:'battle' },
  { id:'original_boss', name:'ボステーマ', creator:'オリジナル', src:'audio/bgm-boss.mp3', gain:1, loop:true, legacyKey:'boss' },
  { id:'original_dullahan', name:'デュラハンテーマ', creator:'オリジナル', src:'audio/bgm-dullahan.mp3', gain:1, loop:true, legacyKey:'dullahan' },
  { id:'original_game_over', name:'ゲームオーバーテーマ', creator:'オリジナル', src:'audio/bgm-game-over.mp3', gain:1, loop:true, legacyKey:'gameOver' },
  { id:'original_fusion', name:'合体テーマ', creator:'オリジナル', src:'audio/bgm-fusion.mp3', gain:1, loop:true, legacyKey:'fusion' },
  { id:'original_enhance', name:'強化画面テーマ', creator:'オリジナル', src:'audio/bgm-enhance.mp3', gain:1, loop:true, legacyKey:'enhance' },
  { id:'original_result', name:'リザルトテーマ', creator:'オリジナル', src:'audio/bgm-result.mp3', gain:1, loop:true, legacyKey:'result' },
  { id:'original_market', name:'マーケットテーマ', creator:'オリジナル', src:'audio/bgm-market.mp3', gain:1, loop:true, legacyKey:'market' },
  { id:'original_profile', name:'プロフィールテーマ', creator:'オリジナル', src:'audio/bgm-profile.mp3', gain:1, loop:true, legacyKey:'profile' },
  { id:'ichika_home', name:'ホームテーマ by いちか', creator:'いちか', src:'audio/bgm-home-ichika.mp3', gain:1, loop:true },
  { id:'ichika_battle', name:'バトルテーマ by いちか', creator:'いちか', src:'audio/bgm-battle-ichika.mp3', gain:1, loop:true },
  { id:'ichika_boss', name:'ボステーマ by いちか', creator:'いちか', src:'audio/bgm-boss-ichika.mp3', gain:1, loop:true },
  { id:'ichika_clear', name:'クリアテーマ by いちか', creator:'いちか', src:'audio/bgm-clear-ichika.mp3', gain:1, loop:true, legacyKey:'clear' },
  // 会話イベント用。1が既定で、2はBGMアレンジから自分で選べる(自動では使わない)
  { id:'original_event_01', name:'イベントBGM 1', creator:'オリジナル', src:'audio/bgm-event-01.mp3', gain:1, loop:true },
  { id:'original_event_02', name:'イベントBGM 2', creator:'オリジナル', src:'audio/bgm-event-02.mp3', gain:1, loop:true },
  // プロモードの戦闘用
  { id:'original_pro_battle_01', name:'プロ戦闘BGM 1', creator:'オリジナル', src:'audio/bgm-pro-battle-01.mp3', gain:1, loop:true },
  { id:'original_pro_battle_02', name:'プロ戦闘BGM 2', creator:'オリジナル', src:'audio/bgm-pro-battle-02.mp3', gain:1, loop:true },
  // デュラハン戦用。A(時計仕掛け)をクイック、B(鋼鉄の亡霊)をプロの既定にする。
  // -Another- の2曲は既定では使わないが、BGMアレンジからどの枠へも選べる
  { id:'melo_dullahan_clockwork', name:'呪われた騎士の時計仕掛け', creator:'オリジナル', src:'audio/bgm-dullahan-clockwork.mp3', gain:1, loop:true },
  // モンビーの新曲2曲(2026-09-06)。mp4で受け取った音源から映像を落として入れたもの
  { id:'melo_toriko', name:'トリコ', creator:'オリジナル', src:'audio/bgm-toriko.mp3', gain:1, loop:true },
  { id:'melo_4u_hitasura', name:'4U ～ひたすら～', creator:'オリジナル', src:'audio/bgm-4u-hitasura.mp3', gain:1, loop:true },
  // モンビーの新曲(2026-09-07)。同じくmp4で受け取った音源から映像を落として入れたもの
  { id:'melo_kindan_no_resistance', name:'禁断のレジスタンス', creator:'オリジナル', src:'audio/bgm-kindan-no-resistance.mp3', gain:1, loop:true },
  // モンビーの新曲(2026-09-08)。同じくmp4で受け取った音源から映像を落として入れたもの
  { id:'melo_crossing_field', name:'crossing field', creator:'オリジナル', src:'audio/bgm-crossing-field.mp3', gain:1, loop:true },
  { id:'melo_nothing_without_you', name:'Nothing Without You', creator:'オリジナル', src:'audio/bgm-nothing-without-you.mp3', gain:1, loop:true },
  { id:'melo_dullahan_clockwork_alt', name:'呪われた騎士の時計仕掛け -Another-', creator:'オリジナル', src:'audio/bgm-dullahan-clockwork-alt.mp3', gain:1, loop:true },
  { id:'melo_dullahan_steel_ghost', name:'鋼鉄の亡霊', creator:'オリジナル', src:'audio/bgm-dullahan-steel-ghost.mp3', gain:1, loop:true },
  { id:'melo_dullahan_steel_ghost_alt', name:'鋼鉄の亡霊 -Another-', creator:'オリジナル', src:'audio/bgm-dullahan-steel-ghost-alt.mp3', gain:1, loop:true },
  // パンドラ勇者のムー戦では自動優先するが、ほかの曲と同様にBGMアレンジからも選べる
  { id:'pandora_boss', name:'Stay With Me ～Locked Fate～', creator:'オリジナル', src:'audio/bgm-pandora-boss.mp3', gain:1, loop:true },
  { id:'eiki_boss', name:'綺季一閃 ～花雪に舞う詠姫～', creator:'オリジナル', src:'audio/綺季一閃_～花雪に舞う詠姫～.mp3', gain:1, loop:true },
  // 2026-09-05 に「あつ杯テーマ」から「MF × ICHIKA MIX」へ改称した(音源そのものは同じ)。
  // 保存データが持つのは id なので、名前を変えてもBGMアレンジの設定は影響を受けない。
  { id:'atsu_cup_theme', name:'MF × ICHIKA MIX', creator:'オリジナル', src:'audio/bgm-atsu-cup-theme.mp3' },
  // もらった音源は5分・約7MBあったので、ほかのBGMと同じ96kbps・44.1kHzへ作り直して約半分にした
  // (tools/mode/rhythm-audio-reencode.js)。「ショート」はモンビー用に頭から2分半ほどを切り出した版で、
  // BGMアレンジからも選べる。どちらも同じ曲なので、好きなほうを好きな場面へ置ける。
  { id:'six_eternel', name:'SIX ÉTERNEL ―愛はひとつじゃない―', creator:'オリジナル', src:'audio/bgm-six-eternel.mp3', gain:1, loop:true },
  { id:'six_eternel_remix', name:'SIX ÉTERNEL ドパガキリミックス', creator:'オリジナル', src:'audio/bgm-six-eternel-remix.mp3', gain:1, loop:true },
  { id:'six_eternel_beat', name:'SIX ÉTERNEL（ショート）', creator:'オリジナル', src:'audio/bgm-six-eternel-beat.mp3', gain:1, loop:true },
  { id:'six_eternel_remix_beat', name:'SIX ÉTERNEL ドパガキリミックス（ショート）', creator:'オリジナル', src:'audio/bgm-six-eternel-remix-beat.mp3', gain:1, loop:true },
  // ボス戦の2曲も、SIX ÉTERNEL と同じようにモンビー用へ2〜3分を切り出した(頭からサビの終わりまで)。
  // 元の全尺は残したままなので、バトルのBGMは今までどおり変わらない。
  { id:'pandora_boss_beat', name:'Stay With Me ～Locked Fate～（ショート）', creator:'オリジナル', src:'audio/bgm-pandora-boss-beat.mp3', gain:1, loop:true },
  { id:'eiki_boss_beat', name:'綺季一閃 ～花雪に舞う詠姫～（ショート）', creator:'オリジナル', src:'audio/bgm-eiki-boss-beat.mp3', gain:1, loop:true },
  // モンビー用に足した1分40秒の穏やかな曲。ほかの曲より譜面をやさしめにしてある。
  { id:'kaze_ga_soyogu', name:'風がそよぐ場所', creator:'オリジナル', src:'audio/bgm-kaze-ga-soyogu-basho.mp3', gain:1, loop:true },
  { id:'close_to_your_heart', name:'Close To Your Heart', creator:'オリジナル', src:'audio/bgm-close-to-your-heart.mp3', gain:1, loop:true },
  // ボス戦2曲のリミックス(2026-09-05・ユーザー提供)。モンビー用の別の曲として足す。
  // 元の曲・ショート版はそのまま残すので、バトルのBGMも今までの譜面も変わらない。
  { id:'eiki_boss_remix', name:'綺季一閃 ～花雪に舞う詠姫～ battle remix', creator:'オリジナル', src:'audio/bgm-eiki-boss-remix.mp3', gain:1, loop:true },
  { id:'pandora_boss_remix', name:'Stay With Me ～Locked Fate～ remix', creator:'オリジナル', src:'audio/bgm-pandora-boss-remix.mp3', gain:1, loop:true },
];
const BGM_TRACK_BY_ID = Object.fromEntries(BGM_TRACKS.map(track => [track.id, track]));
const BGM_TRACK_BY_KEY = Object.fromEntries(BGM_TRACKS.filter(track => track.legacyKey).map(track => [track.legacyKey, track]));
// 音ゲーは曲データ側で既存track IDだけを持ち、音源・音量・ループ情報は必ずBGM_TRACKSから解決する。
const rhythmSongTrack = song => BGM_TRACK_BY_ID[song?.bgmTrackId] || null;
const RHYTHM_SETTINGS_KEY = 'mh_rhythm_settings_v1';
// 曲えらび画面の「見え方」だけを覚えるキー。演奏に関わる設定(mh_rhythm_settings_v1)とは
// 別に持つ(2026-09-05・ユーザー指示で並び替えと助手の折りたたみを足したときに新設)。
// 別キーにしたのは、演奏の設定を読み書きする経路へ画面の都合を混ぜないため。
// 保存値が無い・壊れているときは既定へ落ちるので、これまでのユーザーもそのまま動く。
const RHYTHM_SELECT_VIEW_KEY = 'mh_rhythm_select_v1';
// 並び順。id は保存値になるので、増やすことはあっても**名前は変えない**。
const RHYTHM_SORT_ORDERS = Object.freeze([
  Object.freeze({ id:'added',  label:'入手順',  note:'追加された順。いつも同じ並びになります' }),
  Object.freeze({ id:'level',  label:'難易度順', note:'いま選んでいる難易度のLv.が低い順' }),
  Object.freeze({ id:'name',   label:'名前順',  note:'曲名のあいうえお・アルファベット順' }),
  Object.freeze({ id:'length', label:'長さ順',  note:'曲が短い順。軽く1曲遊びたいときに' }),
]);
const RHYTHM_SORT_IDS = Object.freeze(RHYTHM_SORT_ORDERS.map(item => item.id));
// ジャンル(曲の絞り込み)。2026-09-11・ユーザー指示
// 「対象曲のところをジャンルに変えて、その中から選べるようにしよう。イベント曲、オリジナル、MF とか。
//   ジャンルを決めないとだから、とりあえずイベント曲だけ選べるようにすればおけ」。
//
// ★ジャンルを増やすときは、ここへ1件足して、曲の側に見分けるための印を付ける。
//   画面(29-rhythm-screens.jsx)は書き換えない。
// ★whileEvent:true を付けたものは、イベントを開催しているあいだだけ選べる。
//   開催していないときに選ぶと一覧が空になるため。
const RHYTHM_GENRES = Object.freeze([
  Object.freeze({ id:'all',   label:'すべて',       note:'遊べる曲を全部' }),
  Object.freeze({ id:'event', label:'🏆 イベント曲', note:'いま開催しているイベントの対象曲', whileEvent:true }),
]);
const RHYTHM_GENRE_IDS = Object.freeze(RHYTHM_GENRES.map(item => item.id));
// genre … 曲の絞り込み(2026-09-11)。並び替えではないので、並び替えの一覧には混ぜない。
//   ★開催していないときは、保存値が 'event' のままでも絞らない(画面側で見る)。
//     そうしないと、イベントが終わったあとに一覧が空の人が出てしまう。
//   ★新しい項目なので、持っていない既存ユーザーは既定値('all')で補われる(CLAUDE.md ⑦)。
//   ★短いあいだ eventOnly(真偽値)で持っていたので、その値も読める形にしてある。
//     消さずに読み替えるだけ。true だった人は 'event' を選んでいた扱いになる。
const DEFAULT_RHYTHM_SELECT_VIEW = Object.freeze({ sort:'added', desc:false, noticeOpen:true, genre:'all' });
const normalizeRhythmSelectView = value => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const genre = RHYTHM_GENRE_IDS.includes(source.genre) ? source.genre
    : (source.eventOnly === true ? 'event' : DEFAULT_RHYTHM_SELECT_VIEW.genre);
  return {
    sort: RHYTHM_SORT_IDS.includes(source.sort) ? source.sort : DEFAULT_RHYTHM_SELECT_VIEW.sort,
    desc: typeof source.desc === 'boolean' ? source.desc : DEFAULT_RHYTHM_SELECT_VIEW.desc,
    noticeOpen: typeof source.noticeOpen === 'boolean' ? source.noticeOpen : DEFAULT_RHYTHM_SELECT_VIEW.noticeOpen,
    genre,
  };
};
// ノーツ速度は見た目のtravelだけを変える。1.0〜12.0を0.1刻みで選べ、6.0は従来の見た目(2150ms)を維持する。
// 旧保存値(3.0〜10.0 / 0.5刻み)はこの範囲の内側なので、そのまま読み込める。
const RHYTHM_NOTE_SPEED_MIN=1;
const RHYTHM_NOTE_SPEED_MAX=12;
const RHYTHM_NOTE_SPEED_STEP=.1;
const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';
// 全国ランキングへの送信に失敗したときだけ退避する専用キー(2026-09-04)。
// 既存のBEST記録(RHYTHM_BEST_RECORDS_KEY)とは別で、自動の再送はしない
// (端末内に「送れなかった記録が残っている」という手がかりを残すだけ)。
// 際限なく増やさないよう直近の件数だけ保つ
const RHYTHM_RANKING_PENDING_KEY = 'mh_rhythm_rank_pending_v1';
const RHYTHM_RANKING_PENDING_MAX = 20;
const RHYTHM_EFFECT_LEVELS = Object.freeze(['NORMAL','LOW','MINIMAL']);
// コンボの節目でお祝いを出す刻み。100コンボごと。
const RHYTHM_COMBO_MILESTONE_STEP = 100;
// コンボ数の見せ方の段(2026-09-12・ユーザー指示
//   「コンボ数もわかりにくい。増えれば増えるほど目立つようにして」)。
// 100コンボごとのお祝い(RHYTHM_COMBO_MILESTONE_STEP)とは別で、こちらはHUDの数字そのものが
// 段を上がるたびに大きく・熱い色になるための分類。**見た目だけの値で、判定・スコア・
// コンボの数え方(rhythmComboAfter)には一切関わらない。**
// 節目は 10 / 30 / 50 / 100 / 200 / 300 / 500 の7つ。最初の段を10に置いているのは、
// 「増えている」という手応えが序盤から出るようにするため(100まで何も変わらないと気づけない)。
const RHYTHM_COMBO_TIER_STEPS = Object.freeze([10,30,50,100,200,300,500]);
const rhythmComboTier = combo => {
  const value = Number(combo);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return RHYTHM_COMBO_TIER_STEPS.reduce((tier,step)=>value>=step?tier+1:tier,0);
};
// 段ごとの大きさ。font-size ではなく transform:scale() で効かせる。
// ★font-size を段ごとに上書きすると、横持ち(landscape:text-base)の詰めた文字サイズまで
//   巻き添えで壊れる。倍率なら縦持ち・横持ちのどちらの基準サイズもそのまま活かせる。
// ★2026-09-12にコンボをプレイエリアの真ん中へ移したので、台形にかかる心配がなくなった。
//   HUDの右上に居たころは1.13倍が上限だった(4桁まで伸びると台形へかかり、奥のノーツが
//   読めなくなるため)。中央なら左右に十分な余地があるので、段でしっかり大きくできる。
const RHYTHM_COMBO_TIER_SCALES = Object.freeze([1,1.08,1.16,1.26,1.36,1.46,1.56,1.66]);
const rhythmComboTierScale = tier => {
  const index = Math.trunc(Number(tier)||0);
  return RHYTHM_COMBO_TIER_SCALES[Math.max(0,Math.min(RHYTHM_COMBO_TIER_SCALES.length-1,index))];
};
// コンボ数の置き場所(2026-09-12・ユーザー指示「元位置（元位置より少し右より）とか選べるほうがいい」)。
// 真ん中へ移したのは同じ日で、それまでは右上のHUDの中に居た。人によってはノーツと重なるのが
// 気になるし、前の位置に慣れている人もいるので、選べるようにする。
// ★既定は CENTER(いまの真ん中)。既存の保存値にはこのキー自体が無いので、
//   読み込み時に CENTER で補われる(既存のキーは1つも触らない)。
// ★実際の座標は index.html の [data-combo-pos="…"] が持つ。ここは名前だけ。
const RHYTHM_COMBO_POSITIONS = Object.freeze(['CENTER','RIGHT','HUD','LEFT']);
// ライフの見せ方の段(2026-09-12・ユーザー指示
//   「ライフ変動や0になったときとか気付きにくいからもっと強調して / 0だとライフが赤くなるとか
//     バーが割れるとか」)。
// ライフの数値・減り方(RHYTHM_LIFE_DELTA)・DOWNの扱いは一切変えない。色と点滅とひび割れを
// CSSへ伝えるためだけの分類で、rhythmLifeRatio の値をそのまま段に読み替える。
const rhythmLifeState = life => {
  const ratio = rhythmLifeRatio(life);
  if (ratio <= 0) return 'down';
  if (ratio <= .25) return 'danger';
  if (ratio <= .5) return 'caution';
  return 'ok';
};
// オプション画面の選択肢の「名前」(2026-09-13)。
// ★閉じているセクションに出す「いまの値」と、開いたときのボタンの**両方がここを見る**。
//   名前を2か所に書くと必ずずれる(一方だけ直して、もう一方が古い名前のまま残る)。
// ★並びはそのまま画面のボタンの並びになる。IDの集合は値の正本
//   (RHYTHM_EFFECT_LEVELS など)と一致していること。tools/mode/rhythm-options-summary-check.js が見る。
const RHYTHM_LANE_GLOW_LABELS = Object.freeze([['NORMAL','標準'],['LOW','控えめ'],['NONE','なし']]);
const RHYTHM_EFFECT_LABELS = Object.freeze([['NORMAL','標準'],['LOW','少なめ'],['MINIMAL','最小']]);
const RHYTHM_SIDE_MONSTER_OPACITY_LABELS = Object.freeze([['NORMAL','はっきり'],['SOFT','ふつう'],['FAINT','うっすら'],['OFF','出さない']]);
const RHYTHM_SIDE_MONSTER_MOTION_LABELS = Object.freeze([['NORMAL','跳ねる'],['SMALL','小さく跳ねる'],['NONE','動かない']]);
const RHYTHM_COMBO_POSITION_LABELS = Object.freeze([['LEFT','左'],['CENTER','中央'],['RIGHT','右'],['HUD','右上']]);
const RHYTHM_LANE_GLOW_LEVELS = Object.freeze(['NORMAL','LOW','NONE']);
const RHYTHM_JUDGMENT_IDS = Object.freeze(['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD','MISS']);
// ランク(G〜M)の表示色(暫定値)。下位ほど地味な色、上位ほど鮮やかにして一目で分かるようにする。
const RHYTHM_RANK_COLORS = Object.freeze({
  G:'text-slate-500', F:'text-slate-300', E:'text-lime-400', D:'text-lime-300',
  C:'text-amber-300', B:'text-orange-300', A:'text-cyan-300', S:'text-fuchsia-300',
  SS:'text-fuchsia-200', M:'text-yellow-200',
});
const DEFAULT_RHYTHM_SETTINGS = Object.freeze({
  bgmVolume:100, noteSpeed:6, noteSize:100, noteStartPosition:0, displayTimingOffsetMs:0, judgmentTimingOffsetMs:0,
  fastSlowDisplay:true, judgmentTextDisplay:true, judgmentTextPosition:50, comboDisplay:true, comboPosition:'CENTER', holdSlideOpacity:80, laneGlow:'NORMAL',
  noteSeVolume:70, noteSeEnabled:true, vibrationEnabled:false, effectAmount:'NORMAL', lightweightMode:false,
  livePartnerVisible:true,
  // 両サイドのマスモン(2026-09-05)。既存の保存値には無いので、読み込み時は既定で補われる。
  sideMonsterOpacity:'NORMAL', sideMonsterMotion:'NORMAL', sideMonsterAbilityHighlight:true,
  // 曲えらびで、選んでいる曲を鳴らすかどうか(2026-09-05)。
  // 既存の保存値には無いので、読み込み時に既定(ON)で補われる。既存のキーは変えない。
  songPreviewEnabled:true,
  // 演奏中は通知を出さない(2026-09-05・ユーザー相談)。
  // ブラウザから通知そのものは止められないので、全画面と画面ロック防止でできる範囲だけ行う。
  // 既定はOFF。勝手に全画面へ入ると「戻れない」と感じる人がいるため
  quietDuringPlay:false,
});
const rhythmFiniteInRange = (value,min,max,fallback) => {
  const number=Number(value); return Number.isFinite(number)&&number>=min&&number<=max?number:fallback;
};
const rhythmFiniteStep = (value,min,max,step,fallback) => {
  const number=rhythmFiniteInRange(value,min,max,fallback);
  // 0.1刻みのような小数stepでも 6.300000000000001 のような値を残さない。
  return Math.round((Math.round((number-min)/step)*step+min)*1000)/1000;
};
const normalizeRhythmSettings = value => {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const bool=(key)=>typeof source[key]==='boolean'?source[key]:DEFAULT_RHYTHM_SETTINGS[key];
  return {
    // 上限は RHYTHM_VOLUME_MAX(=200)。**広げただけ**なので、保存してある0〜100は
    // 1つも動かないし、100の意味も今までと同じ(2026-09-12・ユーザー指示)
    bgmVolume:rhythmFiniteStep(source.bgmVolume,0,RHYTHM_VOLUME_MAX,1,DEFAULT_RHYTHM_SETTINGS.bgmVolume),
    noteSpeed:rhythmFiniteStep(source.noteSpeed,RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP,DEFAULT_RHYTHM_SETTINGS.noteSpeed),
    noteSize:rhythmFiniteStep(source.noteSize,80,120,5,DEFAULT_RHYTHM_SETTINGS.noteSize),
    noteStartPosition:rhythmFiniteInRange(source.noteStartPosition,-100,100,DEFAULT_RHYTHM_SETTINGS.noteStartPosition),
    displayTimingOffsetMs:0,
    judgmentTimingOffsetMs:rhythmFiniteStep(source.judgmentTimingOffsetMs,-100,100,5,DEFAULT_RHYTHM_SETTINGS.judgmentTimingOffsetMs),
    fastSlowDisplay:bool('fastSlowDisplay'),
    judgmentTextDisplay:bool('judgmentTextDisplay'),
    judgmentTextPosition:rhythmFiniteInRange(source.judgmentTextPosition,0,100,DEFAULT_RHYTHM_SETTINGS.judgmentTextPosition),
    comboDisplay:bool('comboDisplay'),
    comboPosition:RHYTHM_COMBO_POSITIONS.includes(source.comboPosition)?source.comboPosition:DEFAULT_RHYTHM_SETTINGS.comboPosition,
    holdSlideOpacity:rhythmFiniteInRange(source.holdSlideOpacity,10,100,DEFAULT_RHYTHM_SETTINGS.holdSlideOpacity),
    laneGlow:RHYTHM_LANE_GLOW_LEVELS.includes(source.laneGlow)?source.laneGlow:DEFAULT_RHYTHM_SETTINGS.laneGlow,
    noteSeVolume:rhythmFiniteStep(source.noteSeVolume,0,RHYTHM_VOLUME_MAX,1,DEFAULT_RHYTHM_SETTINGS.noteSeVolume),
    noteSeEnabled:bool('noteSeEnabled'), vibrationEnabled:bool('vibrationEnabled'),
    effectAmount:RHYTHM_EFFECT_LEVELS.includes(source.effectAmount)?source.effectAmount:DEFAULT_RHYTHM_SETTINGS.effectAmount,
    lightweightMode:bool('lightweightMode'), livePartnerVisible:bool('livePartnerVisible'),
    sideMonsterOpacity:RHYTHM_SIDE_MONSTER_OPACITIES.includes(source.sideMonsterOpacity)?source.sideMonsterOpacity:DEFAULT_RHYTHM_SETTINGS.sideMonsterOpacity,
    sideMonsterMotion:RHYTHM_SIDE_MONSTER_MOTIONS.includes(source.sideMonsterMotion)?source.sideMonsterMotion:DEFAULT_RHYTHM_SETTINGS.sideMonsterMotion,
    sideMonsterAbilityHighlight:bool('sideMonsterAbilityHighlight'),
    songPreviewEnabled:bool('songPreviewEnabled'),
    quietDuringPlay:bool('quietDuringPlay'),
  };
};
const emptyRhythmBestRecord = () => ({bestScore:0,maxCombo:0,played:false,clear:false,fullCombo:false,allExcellent:false,allMarvelous:false,judgments:Object.fromEntries(RHYTHM_JUDGMENT_IDS.map(id=>[id,0]))});
const normalizeRhythmBestRecord = value => {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const count=value=>Math.max(0,Math.floor(Number.isFinite(Number(value))?Number(value):0));
  return {bestScore:count(source.bestScore),maxCombo:count(source.maxCombo),
    // played … 一度でも最後まで演奏したか(2026-09-12に追加)。clear は「ライフを残して終えた」に
    //   意味を絞ったので、失敗した記録を「まだ遊んでいない」と取り違えないための項目。
    //   ★この項目が無かったころの保存値は、clear が立っていれば played も立っていたものとして読む
    //     (CLAUDE.md ⑦「既存の値に項目を追加する」「保存値が無いときの既定値を通す」)。
    played:source.played===true||source.clear===true,clear:source.clear===true,
    fullCombo:source.fullCombo===true,allExcellent:source.allExcellent===true,allMarvelous:source.allMarvelous===true,
    judgments:Object.fromEntries(RHYTHM_JUDGMENT_IDS.map(id=>[id,count(source.judgments?.[id]??source[id])])),};
};
const normalizeRhythmBestRecords = value => {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return Object.fromEntries(RHYTHM_SONGS.map(song=>[song.songId,Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,normalizeRhythmBestRecord(source[song.songId]?.[id])]))]));
};
const rhythmBestRecord = (records,songId,difficultyId) => normalizeRhythmBestRecord(records?.[songId]?.[difficultyId]);
const rhythmJudgeTap = deltaMs => RHYTHM_JUDGMENTS.find(item=>item.windowMs!==null&&Math.abs(deltaMs)<=item.windowMs)?.id||'MISS';
const rhythmFastSlow = deltaMs => deltaMs<0?'FAST':deltaMs>0?'SLOW':null;
const rhythmComboAfter = (combo,judgment) => ['MARVELOUS','EXCELLENT','GREAT','GOOD'].includes(judgment)?combo+1:0;
const rhythmCalculateScore = ({judgments,maxCombo,totalNotes,maxScore}) => {
  if(!totalNotes) return 0;
  const rates=Object.fromEntries(RHYTHM_JUDGMENTS.map(item=>[item.id,item.scoreRate]));
  const judged=RHYTHM_JUDGMENT_IDS.reduce((sum,id)=>sum+(judgments[id]||0)*rates[id],0);
  return Math.min(maxScore,Math.round((judged/totalNotes*RHYTHM_SCORE_WEIGHTS.judgment+maxCombo/totalNotes*RHYTHM_SCORE_WEIGHTS.combo)*maxScore));
};
const rhythmResultAchievements = (judgments,totalNotes) => {
  const counts=Object.fromEntries(RHYTHM_JUDGMENT_IDS.map(id=>[id,Math.max(0,Number(judgments?.[id])||0)]));
  return {
    fullCombo:counts.BAD===0&&counts.MISS===0,
    allExcellent:counts.GREAT===0&&counts.GOOD===0&&counts.BAD===0&&counts.MISS===0,
    allMarvelous:totalNotes>0&&counts.MARVELOUS===totalNotes,
  };
};
// 今回の完走結果を既存BESTへ統合する純粋関数。判定内訳は、そのBESTスコアを
// 出したプレイと必ず対になるよう、スコア更新時だけ差し替える。
const mergeRhythmBestRecord = (current,result) => {
  const previous=normalizeRhythmBestRecord(current),score=Math.max(0,Math.floor(Number(result?.score)||0));
  const isNewRecord=score>previous.bestScore;
  return normalizeRhythmBestRecord({
    ...previous,
    bestScore:isNewRecord?score:previous.bestScore,
    judgments:isNewRecord?result?.judgments:previous.judgments,
    maxCombo:Math.max(previous.maxCombo,Math.max(0,Math.floor(Number(result?.maxCombo)||0))),
    // 最後まで演奏したこと自体は played、ライフを残して終えたことが clear。
    // ★cleared を渡さない古い呼び出し(undefined)は、これまでどおりクリア扱いにする。
    //   一度でもクリアしていれば、あとで失敗しても clear は下がらない(記録を消さない)。
    played:true,
    clear:previous.clear||result?.cleared!==false,
    fullCombo:previous.fullCombo||result?.fullCombo===true,
    allExcellent:previous.allExcellent||result?.allExcellent===true,
    allMarvelous:previous.allMarvelous||result?.allMarvelous===true,
  });
};
const pandoraBossBgmForBattle = (heroId, currentWave, enemyId) =>
  heroId === 'Pandora' && (enemyId === 'Moo' || currentWave === 10) ? 'pandora_boss' : null;
const eikiBossBgmForBattle = (heroId, currentWave, enemyId) =>
  heroId === 'Eiki' && (enemyId === 'Moo' || currentWave === 10) ? 'eiki_boss' : null;
// 既存の battle / dullahan / boss はチャレンジ用として維持し、保存済み設定との互換性を守る。
// 追加したモード別専用戦キーは、旧セーブでは従来その場面で使っていた dullahan / boss の選択を継承する。
const DEFAULT_BGM_ARRANGEMENT = Object.freeze({ title:'monster_hero_theme_alt', home:'original_home', management:'original_profile', market:'original_market', temple:'original_fusion', trainingMenu:'original_home', trainingBoard:'original_home', battle:'original_battle', dullahan:'original_dullahan', boss:'original_boss', quickBattle:'original_battle', quickDullahan:'original_dullahan', quickMoo:'original_boss', proBattle:'original_pro_battle_01', proDullahan:'melo_dullahan_steel_ghost', proMoo:'original_pro_battle_02', extremeBattle:'ichika_battle', extremeDullahan:'melo_dullahan_clockwork', extremeMoo:'ichika_boss', speciesBattle:'original_battle', speciesDullahan:'original_dullahan', speciesMoo:'original_boss', autoBattle:'monster_hero_theme', autoVictoryJingle:'off', autoPostWaveBgm:'off', autoRepeatResultBgm:'off', clear:'ichika_clear', enhance:'original_enhance', result:'original_result', gameOver:'original_game_over', kikiIntro:'original_event_01', momosukeIntro:'six_eternel_remix', monbeatCupEvent:'kaze_ga_soyogu' });
// 設定欄を足したときに「前からある近い設定」を引き継ぐための対応表。
// 種族チャレンジの3枠はチャレンジと同じ曲から始めるので、まだ自分で選んでいない人には
// そのときのチャレンジの設定(自分で変えていればその曲)がそのまま入る
// BGMアレンジの「バトル」カテゴリに並ぶタブ。モードを足すたびにここへ1行足す。
// 種族チャレンジは一般公開するまで出さない(モードが見えていないのに設定欄だけあると、
// 何のための項目か分からないため)。曲そのものは公開前でもチャレンジと同じものが鳴る
const BGM_BATTLE_MODE_TABS = Object.freeze([
  { id:'challenge', label:'チャレンジ', items:[['battle','通常戦 BGM'],['dullahan','デュラハン戦 BGM'],['boss','ムー戦 BGM']] },
  { id:'quick', label:'クイック', items:[['quickBattle','通常戦 BGM'],['quickDullahan','デュラハン戦 BGM'],['quickMoo','ムー戦 BGM']] },
  { id:'pro', label:'プロ', items:[['proBattle','通常戦 BGM'],['proDullahan','デュラハン戦 BGM'],['proMoo','ムー戦 BGM']] },
  { id:'extreme', label:'極限', items:[['extremeBattle','通常戦 BGM'],['extremeDullahan','デュラハン戦 BGM'],['extremeMoo','ムー戦 BGM']] },
  ...(SPECIES_CHALLENGE_PUBLIC_RELEASE
    ? [{ id:'species', label:'種族', items:[['speciesBattle','通常戦 BGM'],['speciesDullahan','デュラハン戦 BGM'],['speciesMoo','ムー戦 BGM']] }]
    : []),
]);
const BGM_ARRANGEMENT_LEGACY_FALLBACK = Object.freeze({ quickMoo:'boss', proDullahan:'dullahan', proMoo:'boss', extremeDullahan:'dullahan', extremeMoo:'boss', speciesBattle:'battle', speciesDullahan:'dullahan', speciesMoo:'boss' });
// プロモードの既定曲を専用曲へ変えたときの、一度きりの移行。
// この設定は起動のたびに全項目がそのまま保存されるため、既定値を書き換えるだけでは
// すでに遊んでいる人へ新しい曲が届かない。「まだ自分で選び直していない(以前の既定のまま)」
// ときだけ新しい既定へ入れ替え、自分で選んだ曲には触らない。
// 二重適用は専用フラグ(BGM_PRO_DEFAULT_MIGRATION_KEY)で防ぐ。
// 会話イベントごとのBGM設定名。イベントを足すときはここへ1行足せば、
// 通常再生・イベント回想の両方で同じ曲が鳴る(画面側の分岐を増やさない)
// 会話イベントのid → BGMの枠。枠を足したら DEFAULT_BGM_ARRANGEMENT にも既定曲を書く
// (既存プレイヤーの保存値には新しい枠が無いので、normalizeBgmArrangement が既定で埋める)
const EVENT_BGM_SCENES = Object.freeze({ kiki_intro:'kikiIntro', momosuke_intro:'momosukeIntro', monbeat_cup_2026_09:'monbeatCupEvent' });
const BGM_PRO_DEFAULT_MIGRATION_KEY = 'mh_bgm_pro_default_migrated_v1';
const BGM_PRO_PREVIOUS_DEFAULTS = Object.freeze({ proBattle:'original_battle', proDullahan:'original_dullahan', proMoo:'original_boss' });
// 既定曲を入れ替えたときの移行のしかたは毎回同じ(「以前の既定のままの枠だけ新しい既定へ」)なので、
// 中身は1か所にまとめ、対象の表と二重適用フラグだけを回ごとに分ける
const migrateBgmDefaults = (arrangement, previousDefaults) => {
  const next = { ...arrangement };
  let changed = false;
  Object.entries(previousDefaults).forEach(([scene, previousDefault]) => {
    if (next[scene] !== previousDefault) return; // 自分で選び直していれば触らない
    const nextDefault = DEFAULT_BGM_ARRANGEMENT[scene];
    if (!nextDefault || nextDefault === previousDefault) return;
    next[scene] = nextDefault;
    changed = true;
  });
  return { changed, arrangement: changed ? next : arrangement };
};
const migrateProBgmDefaults = (arrangement) => migrateBgmDefaults(arrangement, BGM_PRO_PREVIOUS_DEFAULTS);
// デュラハン戦の曲を足したときの、一度きりの移行。
// クイックのデュラハン・ムーとプロのデュラハンだけ既定が変わる。
// プロのぶんは上の移行で original_pro_battle_01 になっているので、そこからの入れ替えになる。
const BGM_DULLAHAN_DEFAULT_MIGRATION_KEY = 'mh_bgm_dullahan_default_migrated_v1';
const BGM_DULLAHAN_PREVIOUS_DEFAULTS = Object.freeze({ quickDullahan:'original_dullahan', quickMoo:'original_boss', proDullahan:'original_pro_battle_01' });
const migrateDullahanBgmDefaults = (arrangement) => migrateBgmDefaults(arrangement, BGM_DULLAHAN_PREVIOUS_DEFAULTS);
// クイックと極限の既定曲を入れ替えたときの、一度きりの移行。
// 以前の既定のままの枠だけを新しい既定へ移し、自分で選んだ曲は残す。
const BGM_QUICK_EXTREME_DEFAULT_MIGRATION_KEY = 'mh_bgm_quick_extreme_default_migrated_v1';
const BGM_QUICK_EXTREME_PREVIOUS_DEFAULTS = Object.freeze({
  quickBattle: 'ichika_battle',
  quickDullahan: 'melo_dullahan_clockwork',
  quickMoo: 'ichika_boss',
  extremeBattle: 'original_battle',
  extremeDullahan: 'original_dullahan',
  extremeMoo: 'original_boss'
});
const migrateQuickExtremeBgmDefaults = arrangement => migrateBgmDefaults(arrangement, BGM_QUICK_EXTREME_PREVIOUS_DEFAULTS);
const BGM_TOGGLE_SCENES = new Set(['autoVictoryJingle','autoPostWaveBgm','autoRepeatResultBgm']);
const normalizeBgmArrangement = value => Object.fromEntries(Object.entries(DEFAULT_BGM_ARRANGEMENT).map(([scene, fallback]) => {
  const saved = value?.[scene];
  if (BGM_TOGGLE_SCENES.has(scene)) return [scene, saved === 'on' || saved === 'off' ? saved : fallback];
  if (BGM_TRACK_BY_ID[saved]) return [scene, saved];
  const legacySaved = value?.[BGM_ARRANGEMENT_LEGACY_FALLBACK[scene]];
  return [scene, BGM_TRACK_BY_ID[legacySaved] ? legacySaved : fallback];
}));
