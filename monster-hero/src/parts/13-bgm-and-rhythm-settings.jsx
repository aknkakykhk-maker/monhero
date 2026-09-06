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
const DEFAULT_RHYTHM_SELECT_VIEW = Object.freeze({ sort:'added', desc:false, noticeOpen:true });
const normalizeRhythmSelectView = value => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    sort: RHYTHM_SORT_IDS.includes(source.sort) ? source.sort : DEFAULT_RHYTHM_SELECT_VIEW.sort,
    desc: typeof source.desc === 'boolean' ? source.desc : DEFAULT_RHYTHM_SELECT_VIEW.desc,
    noticeOpen: typeof source.noticeOpen === 'boolean' ? source.noticeOpen : DEFAULT_RHYTHM_SELECT_VIEW.noticeOpen,
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
  fastSlowDisplay:true, judgmentTextDisplay:true, judgmentTextPosition:50, comboDisplay:true, holdSlideOpacity:80, laneGlow:'NORMAL',
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
    bgmVolume:rhythmFiniteStep(source.bgmVolume,0,100,1,DEFAULT_RHYTHM_SETTINGS.bgmVolume),
    noteSpeed:rhythmFiniteStep(source.noteSpeed,RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP,DEFAULT_RHYTHM_SETTINGS.noteSpeed),
    noteSize:rhythmFiniteStep(source.noteSize,80,120,5,DEFAULT_RHYTHM_SETTINGS.noteSize),
    noteStartPosition:rhythmFiniteInRange(source.noteStartPosition,-100,100,DEFAULT_RHYTHM_SETTINGS.noteStartPosition),
    displayTimingOffsetMs:0,
    judgmentTimingOffsetMs:rhythmFiniteStep(source.judgmentTimingOffsetMs,-100,100,5,DEFAULT_RHYTHM_SETTINGS.judgmentTimingOffsetMs),
    fastSlowDisplay:bool('fastSlowDisplay'),
    judgmentTextDisplay:bool('judgmentTextDisplay'),
    judgmentTextPosition:rhythmFiniteInRange(source.judgmentTextPosition,0,100,DEFAULT_RHYTHM_SETTINGS.judgmentTextPosition),
    comboDisplay:bool('comboDisplay'),
    holdSlideOpacity:rhythmFiniteInRange(source.holdSlideOpacity,10,100,DEFAULT_RHYTHM_SETTINGS.holdSlideOpacity),
    laneGlow:RHYTHM_LANE_GLOW_LEVELS.includes(source.laneGlow)?source.laneGlow:DEFAULT_RHYTHM_SETTINGS.laneGlow,
    noteSeVolume:rhythmFiniteStep(source.noteSeVolume,0,100,1,DEFAULT_RHYTHM_SETTINGS.noteSeVolume),
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
const emptyRhythmBestRecord = () => ({bestScore:0,maxCombo:0,clear:false,fullCombo:false,allExcellent:false,allMarvelous:false,judgments:Object.fromEntries(RHYTHM_JUDGMENT_IDS.map(id=>[id,0]))});
const normalizeRhythmBestRecord = value => {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const count=value=>Math.max(0,Math.floor(Number.isFinite(Number(value))?Number(value):0));
  return {bestScore:count(source.bestScore),maxCombo:count(source.maxCombo),clear:source.clear===true,
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
    clear:true,
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
const DEFAULT_BGM_ARRANGEMENT = Object.freeze({ title:'monster_hero_theme_alt', home:'original_home', management:'original_profile', market:'original_market', temple:'original_fusion', trainingMenu:'original_home', trainingBoard:'original_home', battle:'original_battle', dullahan:'original_dullahan', boss:'original_boss', quickBattle:'original_battle', quickDullahan:'original_dullahan', quickMoo:'original_boss', proBattle:'original_pro_battle_01', proDullahan:'melo_dullahan_steel_ghost', proMoo:'original_pro_battle_02', extremeBattle:'ichika_battle', extremeDullahan:'melo_dullahan_clockwork', extremeMoo:'ichika_boss', speciesBattle:'original_battle', speciesDullahan:'original_dullahan', speciesMoo:'original_boss', autoBattle:'monster_hero_theme', autoVictoryJingle:'off', autoPostWaveBgm:'off', autoRepeatResultBgm:'off', clear:'ichika_clear', kikiIntro:'original_event_01', momosukeIntro:'six_eternel_remix' });
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
const EVENT_BGM_SCENES = Object.freeze({ kiki_intro:'kikiIntro', momosuke_intro:'momosukeIntro' });
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
