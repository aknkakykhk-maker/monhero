
// ==== グローバル(UMD)から React フックと lucide アイコンを取得 ====
const { useState, useEffect, useCallback, useMemo, useRef, useContext } = React;
// ==== アイコン: lucide-react UMDが不安定なため、インラインSVGで自己完結 ====
const _LI = {};
// lucide公式のSVGパス(strokeベース)。無いものは汎用ドットにフォールバック
const _ICON_PATHS = {
  Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z"/>',
  Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  Sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>',
  Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  ShieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  X: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  Check: '<polyline points="20 6 9 17 4 12"/>',
  Award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  Skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="M12.5 17l-.5-1-.5 1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
  PlusCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  MinusCircle: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
  Target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  Trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  Timer: '<line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/>',
  Play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  Sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  Activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  ChevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  ChevronRight: '<polyline points="9 18 15 12 9 6"/>',
  Crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
  Edit3: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  ArrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  ArrowDownCircle: '<circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>',
  ArrowUpCircle: '<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>',
  Search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  Layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  AlertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  Flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  RotateCcw: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  Users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  User: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  HelpCircle: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  BookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  Info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  RefreshCcw: '<polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>',
  Coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  ShoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  // 鍵(まだもらっていない飾り枠に重ねる。2026-09-16)
  Lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  Gem: '<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>',
  Package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.35.7.6 1 .3.28.68.42 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/>',
  List: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'
};
const _icon = (name) => (props) => {
  props = props || {};
  const size = props.size || 20;
  const inner = _ICON_PATHS[name] || '<circle cx="12" cy="12" r="4"/>';
  return React.createElement('svg', {
    xmlns:'http://www.w3.org/2000/svg', width:size, height:size, viewBox:'0 0 24 24',
    fill: name==='Heart'||name==='Zap'||name==='Star'||name==='Crown'||name==='Play'||name==='Sparkles' ? 'currentColor' : 'none',
    stroke:'currentColor', strokeWidth: props.strokeWidth||2, strokeLinecap:'round', strokeLinejoin:'round',
    className: props.className||'', style: props.style||{},
    dangerouslySetInnerHTML:{ __html: inner }
  });
};
const Heart=_icon('Heart'), Zap=_icon('Zap'), Sword=_icon('Sword'), Shield=_icon('Shield'), X=_icon('X'), Award=_icon('Award'), Skull=_icon('Skull'), PlusCircle=_icon('PlusCircle'), Target=_icon('Target'), ShieldCheck=_icon('ShieldCheck'), Trophy=_icon('Trophy'), Timer=_icon('Timer'), Play=_icon('Play'), Sparkles=_icon('Sparkles'), Activity=_icon('Activity'), ChevronLeft=_icon('ChevronLeft'), ChevronRight=_icon('ChevronRight'), Crown=_icon('Crown'), Edit3=_icon('Edit3'), ArrowLeft=_icon('ArrowLeft'), Search=_icon('Search'), Layers=_icon('Layers'), AlertCircle=_icon('AlertCircle'), Flag=_icon('Flag'), RotateCcw=_icon('RotateCcw'), MinusCircle=_icon('MinusCircle'), Star=_icon('Star'), Users=_icon('Users'), User=_icon('User'), Check=_icon('Check'), HelpCircle=_icon('HelpCircle'), BookOpen=_icon('BookOpen'), Info=_icon('Info'), RefreshCcw=_icon('RefreshCcw'), ArrowDownCircle=_icon('ArrowDownCircle'), ArrowUpCircle=_icon('ArrowUpCircle'), Coins=_icon('Coins'), ShoppingBag=_icon('ShoppingBag'), Gem=_icon('Gem'), Package=_icon('Package'), Settings=_icon('Settings'), List=_icon('List'), Lock=_icon('Lock');


// --- Helpers ---
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const BATTLE_SPEEDS = [1, 1.5, 2, 3, 4];
const normalizeBattleSpeed = (value) => BATTLE_SPEEDS.includes(Number(value)) ? Number(value) : 1;
const BATTLE_SPEED_KEY = 'mh_battle_speed_v1';
// 新しいバージョンのお知らせ(画面の上へ出るバナー)の出し方。
// 2026-09-12・ユーザー依頼「更新バナーのオンオフをゲーム上の設定で出来るようにしたい」。
//   'FULL' … 横いっぱいのボタンで「新しいバージョンがあります　更新する」(これまでの形)
//   'MINI' … 小さく「更新あり」だけ出す
//   'OFF'  … 出さない(設定 →「ゲームを更新」からいつでも更新できる)
// 既定は 'FULL'。保存が無い既存ユーザーはこれまでと同じ見え方になる。
const UPDATE_NOTICE_STYLES = ['FULL', 'MINI', 'OFF'];
const normalizeUpdateNoticeStyle = (value) =>
  UPDATE_NOTICE_STYLES.includes(String(value)) ? String(value) : 'FULL';
const UPDATE_NOTICE_STYLE_KEY = 'mh_update_notice_style_v1';
// 手札のカードのダブルタップとみなす間隔(ミリ秒)。1回目で選び、この間に同じカードを押すと説明を出す
const CARD_DOUBLE_TAP_MS = 350;
const BATTLE_SCREEN_STYLES = ['TACTICS_OLD', 'TACTICS_NEW'];
const normalizeBattleScreenStyle = (value) =>
  BATTLE_SCREEN_STYLES.includes(String(value)) ? String(value) : 'TACTICS_NEW';
const BATTLE_SCREEN_STYLE_KEY = 'mh_battle_screen_style_v1';
const BATTLE_SCREEN_STYLE_LABELS = Object.freeze([
  { id:'TACTICS_OLD', label:'タクティクス旧', note:'従来のタクティクス表示' },
  { id:'TACTICS_NEW', label:'タクティクス新', note:'2×2の新しい表示' },
]);
const UPDATE_NOTICE_STYLE_LABELS = Object.freeze([
  { id: 'FULL', label: 'ふつう', note: '横いっぱいに出す' },
  { id: 'MINI', label: '小さく', note: '端に小さく出す' },
  { id: 'OFF', label: '出さない', note: '設定から更新する' },
]);
const BUILD_DATE = "2026-09-24 15:38"; // 更新のたびに手動で書き換える(日付+時刻、JST) ※version.jsonのbuildも同じ値に合わせること

// --- ブリーダーレベル/絆レベル: WAVEクリアごとに獲得する経験値。WAVEが進むほど段階的に増加するが、
// 10WAVE制覇時の合計は旧仕様(一律10XP×10WAVE=100)と変わらない
const WAVE_XP_TABLE = [4, 5, 6, 7, 8, 10, 12, 14, 16, 18];
const waveXpGain = (waveNum, mult) => Math.round((WAVE_XP_TABLE[waveNum - 1] || 0) * mult);
const xpForWavesCleared = (wavesCleared, mult) => {
  let sum = 0;
  for (let w = 1; w <= Math.min(10, wavesCleared); w++) sum += waveXpGain(w, mult);
  return sum;
};
// --- ゴールド: WAVEクリアごとに獲得。経験値と同じ配分でWAVEが進むほど段階的に増加するが、
// 10WAVE制覇時の合計は旧仕様(一律100G×10WAVE=1000、Normal基準)と変わらない
const WAVE_GOLD_TABLE = WAVE_XP_TABLE.map(v => v * 10);
const waveGoldGain = (waveNum, mult) => Math.round((WAVE_GOLD_TABLE[waveNum - 1] || 0) * mult);
const goldForWavesCleared = (wavesCleared, mult) => {
  let sum = 0;
  for (let w = 1; w <= Math.min(10, wavesCleared); w++) sum += waveGoldGain(w, mult);
  return sum;
};

// ===== バトルモード =====
// チャレンジモード … これまでの通常バトル(強化フェーズあり・ランキング対象)
// クイックモード   … 強化フェーズなし。WAVEごとに味方が自動成長し、経験値とダイヤだけ1.5倍
//
// 増える値はここだけで決まる。バトル本体は複製せず、この定義とモードの分岐で振る舞いを変える。
const BATTLE_MODE_CHALLENGE = 'challenge';
const BATTLE_MODE_QUICK = 'quick';
// 種族チャレンジはデバッグのバトルモード入口だけに合流させる。
// 通常プレイの公開配列には含めず、固定計画2/4では結果も保存しない。
const BATTLE_MODE_SPECIES_CHALLENGE = 'speciesChallenge';
// 敵が技を持ち、1ターン前の予告を読んで受け方を決めるモード。
// 設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md
//
// ★idは保存キー(mh_tactics_*)と全国ランキング(Tactics<難易度>)へ焼き付くので、公開後に変えない。
//   画面に出す名前はまだ決まっていないため label は仮のまま置く
//   (idと表示名は一致していなくてよい。プロ=pro のように揃っているのは結果であって決まりではない)。
// ★BATTLE_MODES へは入れない。極限チャレンジ・種族チャレンジと同じく外に置き、
//   モード選択の一覧で公開フラグ付きに合流させる
//   (既存3モードの「同じ見出しを同じ順で並べる」検査と、公開配列の作り方を壊さないため)。
const BATTLE_MODE_TACTICS = 'tactics';
// タクティクスバトルの中のモード。クラシックバトルの「チャレンジ／種族チャレンジ／プロ」と
// 同じ並びを、盤面がタクティクスの側にも用意する(2026-09-20 ユーザー指示
// 「通常/極限、種族とかはどっちのモードにもあるように」)。
// ★idはどちらも保存キーとランキングへ焼き付く。公開後に変えない
//   tacticsSpecies … mh_tactics_species_challenge_progress_v1 / TacticsSpecies-<血統>-<難易度>
//   tacticsPro     … mh_tactics_pro_*                          / TacticsPro<難易度>
const BATTLE_MODE_TACTICS_SPECIES = 'tacticsSpecies';
const BATTLE_MODE_TACTICS_PRO = 'tacticsPro';
// 盤面が「1体ずつライフを持つ」側のモード。バトルの中身の分岐(isTacticsMode)はこの3つ共通
const TACTICS_BATTLE_MODES = Object.freeze([
  BATTLE_MODE_TACTICS, BATTLE_MODE_TACTICS_SPECIES, BATTLE_MODE_TACTICS_PRO,
]);
// 難易度ごとの自己ベスト・クリア回数・最高到達WAVEを持つモード。
// 種族チャレンジは「種族×難易度」で持つので、ここには入れない
const TACTICS_SCORE_MODES = Object.freeze([BATTLE_MODE_TACTICS, BATTLE_MODE_TACTICS_PRO]);
const EMPTY_TACTICS_RECORD = Object.freeze({ hs: Object.freeze({}), clears: Object.freeze({}), waves: Object.freeze({}) });
// 種族チャレンジを一般公開するかどうかの1つのスイッチ。
// false のあいだは
//   ・通常プレイのBATTLE MODEへ出さない(デバッグのバトルモード入口からだけ見える)
//   ・クリアしても全国ランキングへ送らない
//   ・ヘルプの項目・更新履歴・助手の告知・BGMアレンジの「種族」タブも出さない
// true にするとこれらが同時に出る。
// 2026年8月にユーザーの指示で公開した。実装側から勝手に false へ戻さない
// (戻すと、すでに遊んだ人の全国ランキングだけが止まる)。
const SPECIES_CHALLENGE_PUBLIC_RELEASE = true;
// 新モードを一般公開するかどうかの1つのスイッチ。種族チャレンジとまったく同じ作り。
// false のあいだは
//   ・モード選択へ出さない(デバッグのバトルモード入口からだけ見える)
//   ・クリアしても全国ランキングへ送らない
// 画面に出す名前が決まり、敵の行動と供モン加入の調整が入ってから true にする。
// 一度 true にしたあとは、実装側から勝手に false へ戻さない
// (戻すと、すでに遊んだ人の全国ランキングだけが止まる)。
const TACTICS_MODE_PUBLIC_RELEASE = false;
// タクティクスバトルの公開は2段階。β版では**タクティクスプロだけ**遊べるようにする
// (2026-09-20 ユーザー指示「公開の前にβ版としてプロモードだけ出来るようにして」)。
// true のあいだは
//   ・モンヒロバトルの入口にタクティクスバトルが出る(「β版」と分かるように出す)
//   ・中に3つのカードが並び、遊べるのはタクティクスプロだけ。ほかの2つは「準備中」
//   ・タクティクスプロのスコアは**β版専用の行**(TacticsProBeta<難易度>)へ送る
// 本公開(TACTICS_MODE_PUBLIC_RELEASE)を立てると、3モードすべてが遊べるようになり、
// ランキングも TacticsPro<難易度> へ切り替わるので、本番の順位は空から始まる。
// ★β版の行は消さない。モンヒロビートの週間ランキングが週IDで区切るのと同じ考え方で、
//   キーを変えるだけにしておく(消す作業はSupabaseの管理接続が要るうえ、戻せない)。
// 一度 true にしたあとは、実装側から勝手に false へ戻さない
// (戻すと、すでに遊んだ人の全国ランキングだけが止まる)。
const TACTICS_BETA_PRO_RELEASE = true;
// イベント回想の出し分け。公開前の機能の会話は、一覧にも出さない
// (モードが見えていないのに会話だけ並ぶと、何の話か分からないうえに中身が見えてしまう)。
// EVENT_REPLAYS(data/assistants.js)は releaseFlag という「呼び名」しか持たないので、
// その名前→公開しているか の対応をここで持つ。イベントを増やすときはここへ1行足す
const EVENT_REPLAY_RELEASE_FLAGS = Object.freeze({
  tacticsBattle: TACTICS_MODE_PUBLIC_RELEASE || TACTICS_BETA_PRO_RELEASE,
});
const eventReplayReleased = (event) => !event?.releaseFlag || EVENT_REPLAY_RELEASE_FLAGS[event.releaseFlag] === true;
// 画面に並べるイベント回想。3か所(プロフィール・回想一覧・再生)が同じ並びを見るための唯一の入口
const eventReplayList = () => ((typeof EVENT_REPLAYS !== 'undefined' && EVENT_REPLAYS) || []).filter(eventReplayReleased);
// 解放条件。チャレンジモードで Master / Grand Master / Hell / Legend のどれかを1回以上
// クリアしていること。判定には既存の mh_clears_<難易度> をそのまま読むので、新しい解放フラグは
// 作らない(旧セーブのプレイヤーもログインした時点で解放済みとして扱われる)。
// 極限チャレンジ(EXTREME_UNLOCK_DIFFICULTIES)とまったく同じ作りで、条件の段だけが違う
const SPECIES_CHALLENGE_UNLOCK_DIFFICULTIES = Object.freeze(['Master', 'GrandMaster', 'Hell', 'Legend']);
const SPECIES_CHALLENGE_UNLOCK_TEXT = 'チャレンジ Master以上クリアで解放';
const isSpeciesChallengeUnlocked = (clearCounts) => SPECIES_CHALLENGE_UNLOCK_DIFFICULTIES
  .some(key => (Number(clearCounts?.[key]) || 0) > 0);
// モード説明は公開時にそのまま出す本文にする。開発の進み具合・デバッグ事情は
// ここへ書かない(カード側のDEBUGバッジで分ける)。
const SPECIES_CHALLENGE_MODE = Object.freeze({
  id:BATTLE_MODE_SPECIES_CHALLENGE, label:'種族チャレンジ', short:'種族', emoji:'🧬', color:'#67e8f9',
  tagline:'ひとつの種族だけで挑む、しばりプレイのモード',
  highlights:[
    ['🧬','ひとつの種族だけでWAVE1〜10'],
    ['🔓','種族ごとに難易度を解放していく'],
    ['🏅','記録は種族ごとに別々に残る'],
  ],
  points:[
    ['🧬','どんなモード','挑む前に種族(モッチー種・ピクシー種など)をひとつ選び、その種族だけでWAVE1〜10を戦い抜くモードです。使えるモンスターが限られるぶん、その種族をどこまで育てているかがそのまま結果に出ます。'],
    ['⚔️','編成','勇者モン1体と供モン最大3体で挑みます。選べるのは、その種族の解放済みベースモンと所持マスモンだけです。ふだんの編成と同じで同じモンスターは勇者・供モンを通して1体まで(重複不可)ですが、同じ種族の別のモンスターなら一緒に連れていけます(モッチー種ならモッチーとミタラシなど)。そのため実際に選べる供モンの数は、その種族のモンスターの種類によって0〜3体で変わります。供モン0体のまま挑むこともできます。'],
    ['🤝','供モンの加入','事前に選んだ供モンは、最初から全員いるわけではありません。WAVE2・4・6をクリアしたとき、まだ加入していない供モンから1体を選んで加えます。誰をいつ加えるかは、その場で決められます。'],
    ['👹','難しさ','難易度は14段階です。Beginner〜Expertは最初から挑めます。Master以降は、同じ種族で1つ前の難易度をクリアすると順に解放されます。ある種族で進めても、ほかの種族の解放には影響しません。'],
    ['🔥','上位の難易度','EXTREME以上では、極限チャレンジと同じ特殊ルールがそのまま適用されます。敵の強さや報酬の倍率も極限チャレンジと同じ設定です。'],
    ['💎','もらえるもの','経験値・ダイヤは難易度の設定どおりです。加えて、種族と難易度の組み合わせごとに初回クリア報酬があります。'],
    ['🏅','記録','自己ベストスコア・最短クリアターン・クリア回数は、種族と難易度の組み合わせごとに別々に残ります。同じ難易度でも種族が違えば別の記録です。チャレンジモードの自己ベストや最高到達WAVEは書き換わりません。'],
    ['⭐','マスモン登録','勇者モンにした子は、プレイが終わったあとマスモンとして登録できます。チャレンジモードと同じです。'],
    ['⏩','スキップチケット','使えません。スコアを競うモードなので、戦わずに報酬だけ取れないようにしています。'],
    ['🔁','AUTO','AUTOでの自動戦闘は使えます。ただしクリア後にそのまま次の周へ入る「AUTO∞」は使えません。挑むたびに種族・難易度・編成を選び直すモードのためです。'],
    ['🎯','こんな人におすすめ','特定の種族を集中して育てている人、いつもの編成とは違う制限つきの戦いを試したい人、種族ごとにやり込みたい人向けです。'],
  ],
});
// 新モードの表示情報。見出しの並びは既存3モード(BATTLE_MODES)とそろえてある。
// ★2026-09-20 にユーザーが名前を決めた。仕組みが「タクティクスバトル」で、その中の
//   ふつうのモードがこれ。クラシックバトル側の「チャレンジモード」と同じ位置づけだが、
//   ランキングや記録で並んだときに見分けが付くよう「タクティクスチャレンジ」にしてある。
// ★本文は公開時にそのまま出るプレイヤー向けの文にする。開発の進み具合はここへ書かない。
// ★cardLabel … モード選択のカードに出す短い名前(無ければ label)。
//   入口(BATTLE_SYSTEM_SELECT)で「タクティクスバトル」を選んでいるので、その中のカードで
//   「タクティクス〜」と繰り返すと名前が長くなり、カードの中(内幅約176px)で2行に折り返す。
//   label は正式名称のまま残し(記録の一覧・ランキング・説明の見出しはこちらを使う)、
//   カードの見出しだけクラシック側と同じ短い名前にそろえる(2026-09-21 ユーザー指摘)。
const TACTICS_MODE = Object.freeze({
  id:BATTLE_MODE_TACTICS, label:'タクティクスチャレンジ', cardLabel:'チャレンジモード', short:'タクティクス', emoji:'🎯', color:'#fb923c',
  // ★売りの3行は、同じ仕組みの中の3モードを**見比べる**ためのもの。
  //   「敵が技を使い分ける」「予告を読んで受ける」はタクティクスの3モードすべてにあるので、
  //   ここには書かない(仕組みの入口カードと「詳しいルール」の担当)。
  //   クラシック側と同じ ①遊び方 ②もらえるもの ③記録 の順でそろえる(2026-09-21 ユーザー指摘)。
  tagline:'強化を選んでじっくり攻略する、基本のモード',
  highlights:[
    ['🏆','強化を選んでスコアを伸ばす王道'],
    ['💎','経験値・ダイヤは難易度どおり'],
    ['📊','このモード専用のスコアランキング'],
  ],
  points:[
    ['⚔️','編成','ベースモンもマスモンも自由に連れていけます。勇者モン1体と供モンで挑みます。'],
    ['❤️','ステータスの持ち方','ライフ・ちから・丈夫さ・ガッツを1体ずつ持ちます(クラシックバトルはパーティ全員ぶんの合計)。倒れた子はその場では戦えなくなり、ライフが満タンまで戻ると立ち上がります。全員が倒れたときだけ負けです。'],
    ['📈','WAVEのあいだの強化','クラシックバトルのチャレンジモードと同じで、WAVEをクリアするたびに強化フェーズがあります。敵がどんな技を使ってくるかを見てから、どこを伸ばすかを決められます。'],
    ['👹','難しさ','難易度は通常9段階と極限5段階です。敵は通常攻撃と必殺技だけでなく、間合い攻撃・連撃・貫通撃・攻撃力アップなど、それぞれ違う技を使ってきます。どの技が来るかは1ターン前に予告されるので、ガードで受けるか、間合いを変えるか、動きを止めるかをその場で選びます。'],
    ['💎','もらえる経験値とダイヤ','ブリーダー経験値・絆経験値・ダイヤは、どれも難易度の設定どおりの倍率です。モードによる上乗せはありません。'],
    ['🏆','スコアと記録','スコアはこのモード専用の全国ランキングに反映されます。自己ベストスコア・最高到達WAVE・クリア回数も専用の場所に残り、ほかのモードの記録は書き換わりません。'],
    ['🤝','供モンの加入','決まったWAVEで供モンが加わります。ただしタクティクスバトルでは、供モンが加わるとそのぶん敵も強くなります。強く育てた子を連れていくほど敵も手ごわくなるので、少ない人数のまま進むという選び方もできます。'],
    ['⭐','マスモン登録','勇者モンにした子は、プレイが終わったあとマスモンとして登録できます。'],
    ['⏩','スキップチケット','使えません。スコアを競うモードなので、戦わずに報酬だけ取れないようにしています。'],
    ['🎯','こんな人におすすめ','育成の数字だけでなく、その場の判断で勝ちたい人、いつもの押し切りが通じない戦いを試したい人向けです。'],
  ],
});
// タクティクスバトルの種族チャレンジ。しばりの中身はクラシックの種族チャレンジと同じで、
// 違うのは盤面が「1体ずつライフを持つ」ことと、記録・ランキングが別枠になることだけ。
const TACTICS_SPECIES_MODE = Object.freeze({
  id:BATTLE_MODE_TACTICS_SPECIES, label:'タクティクス種族チャレンジ', cardLabel:'種族チャレンジ', short:'種族', emoji:'🧬', color:'#67e8f9',
  // ★「敵の予告を読んで誰を守るか」はタクティクスの3モードすべてにあるので売りに書かない。
  //   クラシックの種族チャレンジと同じ3行にそろえる(見比べる列をそろえるため)
  tagline:'ひとつの種族だけで挑む、しばりプレイのモード',
  highlights:[
    ['🧬','ひとつの種族だけでWAVE1〜10'],
    ['🔓','種族ごとに難易度を解放していく'],
    ['🏅','記録は種族ごとに別々に残る'],
  ],
  points:[
    ['🧬','どんなモード','挑む前に種族をひとつ選び、その種族だけでWAVE1〜10を戦い抜くモードです。クラシックバトルの種族チャレンジと同じしばりで、戦い方だけがタクティクスバトルになります。'],
    ['⚔️','編成','勇者モン1体と供モン最大3体で挑みます。選べるのは、その種族の解放済みベースモンと所持マスモンだけです。同じモンスターは1体までですが、同じ種族の別のモンスターなら一緒に連れていけます。'],
    ['❤️','ステータスの持ち方','ライフ・ちから・丈夫さ・ガッツを1体ずつ持ちます(クラシックバトルはパーティ全員ぶんの合計)。倒れた子はその場では戦えなくなり、ライフが満タンまで戻ると立ち上がります。全員が倒れたときだけ負けです。'],
    ['🤝','供モンの加入','事前に選んだ供モンは、WAVE2・4・6をクリアしたときに1体ずつ加わります。加わるとそのぶん敵も強くなります。'],
    ['👹','難しさ','難易度は14段階です。最初の5段階は最初から挑めます。その先は、同じ種族で1つ前の難易度をクリアすると順に解放されます。'],
    ['💎','もらえるもの','経験値・ダイヤは難易度の設定どおりです。加えて、種族と難易度の組み合わせごとに初回クリア報酬があります。'],
    ['🏅','記録','自己ベストスコア・最短クリアターン・クリア回数は、種族と難易度の組み合わせごとに別々に残ります。クラシックバトルの種族チャレンジの記録は書き換わりません。'],
    ['⭐','マスモン登録','勇者モンにした子は、プレイが終わったあとマスモンとして登録できます。'],
    ['⏩','スキップチケット','使えません。スコアを競うモードなので、戦わずに報酬だけ取れないようにしています。'],
    ['🎯','こんな人におすすめ','特定の種族を育てている人で、押し切りではなく読み合いで勝ちたい人向けです。'],
  ],
});
// タクティクスバトルのプロモード。制約(ベースモンだけ)と倍率はクラシックのプロと同じで、
// 戦い方と記録の置き場だけが違う。
const TACTICS_PRO_MODE = Object.freeze({
  id:BATTLE_MODE_TACTICS_PRO, label:'タクティクスプロ', cardLabel:'プロモード', short:'プロ', emoji:'🎓', color:'#f472b6',
  tagline:'ベースモンだけで挑む、育成に頼れない特殊モード',
  highlights:[
    ['🔥','育てたマスモンなしで挑む実力勝負'],
    ['💎','絆経験値3倍・ブリーダー経験値1.5倍'],
    ['📊','このモード専用のスコアランキング'],
  ],
  points:[
    ['⚔️','編成','育てたマスモンは1体も連れていけません。全員が素のベースモンです。積み上げたステータス・強化ポイント・固有技レベル・限界突破は、このモードでは一切使えません。'],
    ['❤️','ステータスの持ち方','ライフ・ちから・丈夫さ・ガッツを1体ずつ持ちます(クラシックバトルはパーティ全員ぶんの合計)。倒れた子はその場では戦えなくなり、ライフが満タンまで戻ると立ち上がります。全員が倒れたときだけ負けです。'],
    ['📈','WAVEのあいだの強化','WAVEをクリアするたびに強化フェーズがあります。素の状態から始まるぶん、誰をどこまで伸ばすかの判断がそのまま結果に出ます。'],
    ['👹','難しさ','難易度は通常9段階と極限5段階です。敵は間合い攻撃・連撃・貫通撃・攻撃力アップなどを使い分け、どの技が来るかは1ターン前に予告されます。育てた個体に頼れないぶん、読み合いの比重がいちばん大きいモードです。'],
    ['💎','もらえる経験値とダイヤ','絆経験値が3倍、ブリーダー経験値が1.5倍になります（難易度の倍率にさらにかかります）。ダイヤとスコアの倍率は難易度の設定どおりです。'],
    ['🏆','スコアと記録','スコアはこのモード専用の全国ランキングに反映されます。自己ベスト・最高到達WAVE・クリア回数も専用の場所に残り、ほかのモードの記録は書き換わりません。'],
    ['🤝','供モンの加入','始める前に供モンの候補を5体選びます。実際に加入候補として出るのは、その5体からランダムに選ばれた3体です。加わるとそのぶん敵も強くなります。'],
    ['⭐','マスモン登録','勇者モンにしたベースモンは、プレイが終わったあとマスモンとして登録できます。'],
    ['⏩','スキップチケット','使えません。スコアを競うモードなので、戦わずに報酬だけ取れないようにしています。'],
    ['🎯','こんな人におすすめ','育成の力を借りずに、その場の判断だけで勝ちたい人向けです。'],
  ],
});
// プロモード: ベースモンだけで挑み、新しいマスモンを育てる価値を高めたモード。
// バトルの中身はチャレンジと同じで、違うのは「編成がベースモン限定」「経験値の倍率」
// 「記録の置き場(mh_pro_* とプロ専用ランキング)」だけ。
// 画面はまだデバッグからしか開けない(本番のバトル導線は従来どおり)
const BATTLE_MODE_PRO = 'pro';
const normalizeBattleMode = (value) => (value === BATTLE_MODE_QUICK || value === BATTLE_MODE_PRO) ? value : BATTLE_MODE_CHALLENGE;
// クイックモードで経験値・ダイヤにかかる倍率(スコアにはかけない)
const QUICK_REWARD_MULT = 1.5;
// プロモードの倍率。「全部3倍」ではなく、絆経験値とブリーダー経験値で別々にかける
const PRO_BOND_XP_MULT = 3;
const PRO_BREEDER_XP_MULT = 1.5;
// プロモードで始める前に選ぶ供モン候補の数と、そこから実際に加入候補として出す数
const PRO_ALLY_POOL_SIZE = 5;
const PRO_ALLY_OFFER_SIZE = 3;
// 前回確定したプロ編成は、既存の進行・記録キーと混ぜず専用キーへ保存する。
const PRO_LAST_PARTY_KEY = 'mh_pro_last_party';
const EMPTY_PRO_LAST_PARTY = Object.freeze({heroBaseId:null,heroDistance:null,allyBaseIds:Object.freeze(Array(PRO_ALLY_POOL_SIZE).fill(null))});
const normalizeProLastParty = (value, unlockedBaseIds=[]) => {
  const unlocked = new Set(Array.isArray(unlockedBaseIds) ? unlockedBaseIds.filter(id=>typeof id==='string') : []);
  const validId = id => typeof id === 'string' && unlocked.has(id) ? id : null;
  const heroBaseId = validId(value?.heroBaseId);
  const heroDistance = heroBaseId && Number.isInteger(value?.heroDistance) && value.heroDistance >= 0 && value.heroDistance < 4 ? value.heroDistance : null;
  const savedAllies = Array.isArray(value?.allyBaseIds) ? value.allyBaseIds : [];
  return {
    heroBaseId,
    heroDistance,
    allyBaseIds:Array.from({length:PRO_ALLY_POOL_SIZE},(_,index)=>validId(savedAllies[index])),
  };
};
// クイックモードでWAVEごとに味方の全ステータスへかける倍率
const QUICK_GROWTH_MULT = 1.10;
const calculateRemainingHp = (currentHp, finalDamage) => Math.max(0, (Number(currentHp) || 0) - (Number(finalDamage) || 0));
// 恒久成長後の基礎最大値とバトル中の上限バフから、表示・回復上限に使う実効最大値を一意に求める。
const resolveEffectiveMaxStat = (baseMax, buffPct) => Math.floor((Number(baseMax) || 0) * (1 + (Number(buffPct) || 0)));
const quickGrowStat = (value) => Math.floor((Number(value) || 0) * QUICK_GROWTH_MULT);
const resolveQuickGrowthStats = ({hp, atk, def, guts}, growthRate=QUICK_GROWTH_MULT-1) => ({
  hp: Math.floor((Number(hp)||0)*(1+growthRate)), atk: Math.floor((Number(atk)||0)*(1+growthRate)),
  def: Math.floor((Number(def)||0)*(1+growthRate)), guts: Math.floor((Number(guts)||0)*(1+growthRate)),
});
const isQuickMode = (mode) => normalizeBattleMode(mode) === BATTLE_MODE_QUICK;
// ★タクティクスプロも「ベースモンだけで挑む」モードなので、編成・倍率・記録の分かれ方は
//   プロとまったく同じ扱いにする。normalizeBattleMode は tacticsPro を知らない(チャレンジへ落ちる)
//   ので、idそのものを先に見る
const isProMode = (mode) => mode === BATTLE_MODE_TACTICS_PRO || normalizeBattleMode(mode) === BATTLE_MODE_PRO;
// 種族チャレンジは normalizeBattleMode の対象外(未知の値はチャレンジへ落ちる)なので、
// idそのものを見る。BGMのようにモードごとに分かれる設定はここを通す
const isSpeciesChallengeMode = (mode) => mode === BATTLE_MODE_SPECIES_CHALLENGE
  || mode === BATTLE_MODE_TACTICS_SPECIES;
// 新モードも normalizeBattleMode の対象外(未知の値はチャレンジへ落ちる)なので、idそのものを見る。
// ここを normalizeBattleMode 経由にすると、記録の置き場がチャレンジと同じ mh_ になってしまう
const isTacticsMode = (mode) => TACTICS_BATTLE_MODES.includes(mode);
// クイックの報酬方針は画面内だけで選び、保存データには増やさない。
// 周回開始時の選択をrefへ固定するため、途中の画面遷移や他モードへ影響しない。
const QUICK_REWARD_POLICY_GROWTH = 'growth';
const QUICK_REWARD_POLICY_PSYCHE = 'psyche';
const QUICK_REWARD_POLICY_DIAMOND = 'diamond';
const normalizeQuickRewardPolicy = (value) => value === QUICK_REWARD_POLICY_PSYCHE || value === QUICK_REWARD_POLICY_DIAMOND ? value : QUICK_REWARD_POLICY_GROWTH;
const applyQuickXpPolicy = (value, mode, policy) => isQuickMode(mode) && normalizeQuickRewardPolicy(policy) !== QUICK_REWARD_POLICY_GROWTH ? 0 : value;
const applyQuickPsychePolicy = (value, mode, policy) => isQuickMode(mode) && normalizeQuickRewardPolicy(policy) === QUICK_REWARD_POLICY_PSYCHE ? value * 2 : value;
// 難易度とクイックモードの倍率をすべて適用した最終ダイヤだけを、ダイヤ優先時に2倍にする。
const applyQuickDiamondPolicy = (value, mode, policy) => isQuickMode(mode) && normalizeQuickRewardPolicy(policy) === QUICK_REWARD_POLICY_DIAMOND ? value * 2 : value;
// 難易度倍率をかけたあとの獲得量へ、さらにモードの倍率をかける。
// WAVEごとの内訳と合計がずれないよう、内訳と同じ「WAVE単位で丸めてから合計」に揃える。
// 倍率はブリーダー経験値・絆経験値・ダイヤで別々に決める。
// プロは絆だけ3倍・ブリーダーは1.5倍で、ダイヤとスコアはチャレンジと同じ
const modeBreederXpMult = (mode) => isQuickMode(mode) ? QUICK_REWARD_MULT : isProMode(mode) ? PRO_BREEDER_XP_MULT : 1;
const modeBondXpMult = (mode) => isQuickMode(mode) ? QUICK_REWARD_MULT : isProMode(mode) ? PRO_BOND_XP_MULT : 1;
const modeGoldMult = (mode) => isQuickMode(mode) ? QUICK_REWARD_MULT : 1;
const applyModeReward = (value, mult) => mult === 1 ? value : Math.floor(value * mult);
const waveXpGainInMode = (waveNum, mult, mode) => applyModeReward(waveXpGain(waveNum, mult), modeBreederXpMult(mode));
const waveGoldGainInMode = (waveNum, mult, mode) => applyModeReward(waveGoldGain(waveNum, mult), modeGoldMult(mode));
// 絆経験値はブリーダー経験値と同じ基準値から作るが、かける倍率だけが違う
const waveBondXpGainInMode = (waveNum, mult, mode) => applyModeReward(waveXpGain(waveNum, mult), modeBondXpMult(mode));
const xpForWavesClearedInMode = (wavesCleared, mult, mode) => {
  let sum = 0;
  for (let w = 1; w <= Math.min(10, wavesCleared); w++) sum += waveXpGainInMode(w, mult, mode);
  return sum;
};
const goldForWavesClearedInMode = (wavesCleared, mult, mode) => {
  let sum = 0;
  for (let w = 1; w <= Math.min(10, wavesCleared); w++) sum += waveGoldGainInMode(w, mult, mode);
  return sum;
};
const bondXpForWavesClearedInMode = (wavesCleared, mult, mode) => {
  let sum = 0;
  for (let w = 1; w <= Math.min(10, wavesCleared); w++) sum += waveBondXpGainInMode(w, mult, mode);
  return sum;
};
// 自己ベスト・最高到達WAVE・クリア回数の保存キー。チャレンジは従来のキーをそのまま使い、
// クイックは別のキーへ保存して、チャレンジの記録を上書きしないようにする
// プロは mh_pro_* へ分ける。チャレンジ(mh_*)・クイック(mh_quick_*)のキーには一切触らない
// 新モードは mh_tactics_* へ分ける。チャレンジ(mh_*)・クイック(mh_quick_*)・プロ(mh_pro_*)の
// キーには一切触らない。id と同じく、公開後はこの接頭辞も変えない
const modeKeyPrefix = (mode) => mode === BATTLE_MODE_TACTICS_PRO ? 'mh_tactics_pro_'
  : isTacticsMode(mode) ? 'mh_tactics_'
  : isQuickMode(mode) ? 'mh_quick_' : isProMode(mode) ? 'mh_pro_' : 'mh_';
const bestScoreKey = (mode, diff) => `${modeKeyPrefix(mode)}hs_${diff}`;
const bestWaveKey = (mode, diff) => `${modeKeyPrefix(mode)}highest_wave_${diff}`;
const clearCountKey = (mode, diff) => `${modeKeyPrefix(mode)}clears_${diff}`;
// その難易度を、チャレンジ・プロ・極限のどれかでクリア済みか。
// 新しい解放フラグは作らず、各モードの既存クリア回数だけを参照するため、既存セーブにも即時反映される。
const isQuickDifficultyCleared = (difficulty, challengeClears, proClears, extremeClears) =>
  [challengeClears, proClears, extremeClears]
    .some(clears => (Number(clears?.[difficulty]) || 0) > 0);
// 「その難易度と、それより上のすべて」を弱い順の並びから取り出す。
// 並びの正本は QUICK_DIFFICULTY_SETTINGS のキー順(Beginner→…→Legend→EXTREME→…→ULTIMATE)なので、
// 難易度が増えてもここは触らずに済む。表に無い難易度は自分自身だけを見る(従来どおりの判定)。
const quickDifficultiesAtOrAbove = (difficulty) => {
  const order = Object.keys(QUICK_DIFFICULTY_SETTINGS);
  const index = order.indexOf(difficulty);
  return index < 0 ? [difficulty] : order.slice(index);
};
// 上の難易度をクリアしていれば、その下の難易度もすべて選べる
// (2026-09-12・ユーザー指摘「マスターをクリアしててもイージーをクリアしなきゃイージーを選べない /
//  裏クイック条件を満たした下の難易度は選べるようにして」)。
// 下の難易度は上の難易度より必ずやさしいので、上を通せた人にわざわざ下を踏ませる意味がないため。
// 逆向き(下をクリアしても上は開かない)は従来のまま。
const isQuickDifficultyUnlocked = (difficulty, challengeClears, proClears, extremeClears) =>
  quickDifficultiesAtOrAbove(difficulty)
    .some(id => isQuickDifficultyCleared(id, challengeClears, proClears, extremeClears));
// ===== モンヒロビートで1曲遊んだぶんを、クイック∞周回の何周ぶんにするか =====
// (2026-09-07・ユーザー提案)
//   「演奏に入った段階でのバトルの周分をクリア時のみ少量扱いにする」
//   「長い曲が損する形になるから時間で周回クリア数を決める」
//   「0〜2、2周回クリア扱い。そこから1分ごとに1周ずつ増える」
//   「あくまでも決められてる曲の時間で決めて、ポーズしたりで掛かってる時間は関係なし」
//
// ★見るのは「曲の決められた長さ」だけ。実際にかかった時間・ポーズ・やり直しは一切見ない。
//   そうしないと、止めている時間だけ稼げてしまう。
//   2分25秒 → 2周 / 3分00秒 → 3周 / 3分30秒 → 3周（分の切り捨て、下限2周）。
//
// ★ここで出るのは「もとの周回数」で、実際に入るのはこれへ倍率を掛けたぶん
//   (2026-09-11・ユーザー指示「モンヒロの無限周回での演奏中の周回数を上げたい /
//    現状の2倍にしても良さそう / イベント時は対象曲は3倍」)。
//   ふだんは2倍、開催中のイベントの対象曲だけ3倍(2倍の代わりに3倍。重ねがけはしない)。
//   2分25秒 → 4周(イベント対象曲なら6周) / 3分00秒 → 6周(同9周)。
const RHYTHM_PLAY_RUN_LOOP_MIN = 2;
const RHYTHM_PLAY_RUN_LOOP_SCALE = 2;
const RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE = 3;
// ※「演奏で ◯周ぶん入りました」を曲えらびの帯へ出していたころは、時間で消すための
//   RHYTHM_PLAY_RUN_AWARD_SHOW_MS を置いていた。いまは曲リザルトで出すので不要
//   (2026-09-07・ユーザー提案「曲リザルトの画面で出すほうがいい。
//    そうしたら帯にわざわざ何周分追加とか表示する必要もない」)。
const rhythmPlayRunLoops = (durationMs, scale = RHYTHM_PLAY_RUN_LOOP_SCALE) => {
  const ms = Number(durationMs);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const mult = Number(scale);
  const safeMult = Number.isFinite(mult) && mult > 0 ? mult : RHYTHM_PLAY_RUN_LOOP_SCALE;
  const base = Math.max(RHYTHM_PLAY_RUN_LOOP_MIN, Math.floor(ms / 60000));
  return Math.floor(base * safeMult);
};
// その曲にかける倍率。開催中のイベント(rhythmLimitedEventAt で引いたもの)の
// 対象曲なら3倍、それ以外は2倍。
// ★イベントは引数で受け取る。ここで時刻を1回だけ見て決め打ちにすると、開きっぱなしの
//   端末で「開催したのに倍率が上がらない／終わったのに上がったまま」になる(CLAUDE.md ⑥-4)。
const rhythmPlayRunLoopScale = (songId, event) => {
  const ids = (event && Array.isArray(event.songIds)) ? event.songIds : null;
  const id = songId === null || songId === undefined ? '' : String(songId);
  return (id && ids && ids.includes(id)) ? RHYTHM_PLAY_RUN_LOOP_EVENT_SCALE : RHYTHM_PLAY_RUN_LOOP_SCALE;
};
// その難易度を「クイックで」通したことがあるか。
// ★上の難易度を通していれば、その下も通したものとして扱う。下は上より必ずやさしいので、
//   上を通せた人にわざわざ下を踏ませる意味がないため(2026-09-12・ユーザー指示の考え方を
//   クイックのクリア記録にもそろえた)。並びの正本は isQuickDifficultyUnlocked と同じ。
// ★見るのは既存の mh_quick_clears_<難易度> だけ。新しい保存キーは作らない。
const isQuickModeClearedAtOrAbove = (difficulty, quickClears) =>
  quickDifficultiesAtOrAbove(difficulty)
    .some(id => (Number(quickClears?.[id]) || 0) > 0);
// 演奏を「周回クリア扱い」にしてよいか。
// ★過去にその難易度をクイックで1回でもクリアしていること(2026-09-07・ユーザー指示)。
//   これが無いと、勝てないほど高い難易度でも演奏さえすればクリア扱いになってしまう。
const rhythmPlayRunLoopsAllowed = (difficulty, quickClears) =>
  isQuickModeClearedAtOrAbove(difficulty, quickClears);
// AUTO設定「モンヒロビート中に回すクイック周回」で選べる難易度。
// ★ここはクイックのクリア記録で見る(2026-09-14・ユーザー指摘「モンビーとのクイック連携で
//   オート難易度設定の条件がチャレンジや極限クリアになってない？ これの条件はクイックの
//   その難易度をクリアしないと選べない仕様にしたはず」)。
//   クイック本体の解放条件(チャレンジ・プロ・極限＝isQuickDifficultyUnlocked)で選ばせていたため、
//   「AUTO設定では選べるのに、演奏しても周回クリアが入らない」難易度を作れてしまっていた。
//   連携のための設定なので、rhythmPlayRunLoopsAllowed と同じ判定にそろえて、
//   選べる＝演奏ぶんが入る、が構造的に一致するようにする。
const isAutoQuickRunDifficultyAllowed = (difficulty, quickClears) =>
  isQuickModeClearedAtOrAbove(difficulty, quickClears);
// 演奏の結果(クリア／失敗)で入る周回数を変える(2026-09-12・ユーザー指示
//   「終了後にクリアか失敗かもわかるようにして / それによって経験値も変わるから」)。
// 失敗＝ライフが0になったまま曲を終えた(不可逆のDOWN)こと。
//
// ★失敗は0。半分入るようにしていたが、**叩かずに放っておいても半分もらえてしまう**ため
//   0へ直した(2026-09-12・ユーザー指示「失敗しても入るようにすると放置で稼げるように
//   なるから失敗は0にして」)。周回クリア扱いにするのは、ちゃんと弾ききったときだけ。
// ★クリアかどうかを渡さない古い呼び出し(undefined)は、これまでどおり全額入る。
// ===== プロモードを遊んだぶんを、クイック周回の報酬にする =====
// (2026-09-21・ユーザー提案「プロモードをクリアしたときに限り、クイック何周分の報酬が
//  もらえるなら可能？ 演奏と同じ仕組み」)。
//
// ★バトルを2つ動かすのではない。プロのランが終わったときに「クイック何周ぶんか」を
//   数えて、その報酬だけを配る。モンヒロビートの演奏とまったく同じ立て付けで、
//   スコアもランキングも1ポイントも動かさない。
// ★決め方は「進んだWAVE数」と「プロの難易度の重さ(DIFFICULTY_SETTINGS の power)」。
//   演奏は曲の長さで決めるが、プロは難易度で1回の重さがまるで違うため
//   (2026-09-21・ユーザー選択「難易度とWAVE数で決める」)。
// ★負けても、クリアしたWAVEの段階まで入る(同・ユーザー選択)。
//   1WAVEも越えられなかったときだけ0。
//
//   周回数 = 切り捨て( 進んだWAVE数 ÷ 10 × 難易度のpower × 係数 )   ※1WAVE以上なら最低1周
//
//   係数5のとき(10WAVE完走): Normal 5周 / Expert 15周 / Master 25周 / Legend 50周
const PRO_RUN_QUICK_LOOP_SCALE = 5;
const PRO_RUN_QUICK_LOOP_MIN = 1;
const proRunQuickLoops = (wavesCleared, difficultyPower, scale = PRO_RUN_QUICK_LOOP_SCALE) => {
  const waves = Math.max(0, Math.trunc(Number(wavesCleared) || 0));
  if (waves <= 0) return 0;
  const power = Number(difficultyPower);
  if (!Number.isFinite(power) || power <= 0) return 0;
  const mult = Number(scale);
  const safeScale = Number.isFinite(mult) && mult > 0 ? mult : PRO_RUN_QUICK_LOOP_SCALE;
  return Math.max(PRO_RUN_QUICK_LOOP_MIN, Math.floor((waves / 10) * power * safeScale));
};

const rhythmPlayRunLoopsForResult = (loops, cleared) => {
  const base = Math.max(0, Math.trunc(Number(loops) || 0));
  if (base <= 0) return 0;
  return cleared === false ? 0 : base;
};

// モード選択カードの最高スコアは、現在の選択難易度ではなく、そのモードで
// 記録対象になっている全難易度の自己ベストから求める。未プレイ・壊れた値は0として扱う。
const highestModeScore = (scores, difficultyIds) => Math.max(0, ...difficultyIds.map(diff => {
  const value = Number(scores?.[diff]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}));
// クイックの代表記録も、難易度カードとプロフィールで同じ記録オブジェクトから集計する。
const highestModeWave = (waves, difficultyIds) => Math.max(0, ...difficultyIds.map(diff => {
  const value = Number(waves?.[diff]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}));
// モードの表示情報と「？」で出す説明。文言を1か所にまとめ、タブ・カード・説明の食い違いを防ぐ。
//
// どのモードも同じ形で書く。読み比べたときに「あるモードにだけ書いてある」が起きないようにするため。
//   tagline    … 1行の紹介
//   highlights … カードへ出す3行。並びは必ず【売り】→【報酬】→【記録】の順で固定する
//   points     … 「？」の説明に出す詳細。見出しは全モード共通で、下の並び順もそろえる
//                 編成 → WAVEのあいだの強化 → 難しさ → もらえる経験値とダイヤ →
//                 スコアと記録 → 供モンの加入 → マスモン登録 → スキップチケット → こんな人におすすめ
const BATTLE_MODES = [
  {
    id: BATTLE_MODE_CHALLENGE, label: 'チャレンジモード', short: 'チャレンジ', emoji: '🏆', color: '#818cf8',
    tagline: '強化を選んでじっくり攻略する、基本のモード',
    highlights: [
      ['🏆', '強化を選んでスコアを伸ばす王道'],
      ['💎', '経験値・ダイヤは難易度どおり'],
      ['📊', 'スコアランキングに反映される'],
    ],
    points: [
      ['⚔️', '編成', 'ベースモンもマスモンも自由に連れていけます。勇者モン1体と供モンで挑みます。'],
      ['📈', 'WAVEのあいだの強化', 'WAVEをクリアするたびに強化フェーズがあります。ちから・丈夫さ・ライフ・ガッツのどれを伸ばすかを自分で選べるので、編成のかみ合わせを考えながら組み立てられます。ブリーダーの教えもここで選びます。'],
      ['👹', '難しさ', '9段階の難易度から選べます。強化を自分で選べるぶん、うまく組み立てれば高い難易度でも十分に戦えます。育てたマスモンをそのまま活かせる、いちばん素直な難しさです。'],
      ['💎', 'もらえる経験値とダイヤ', 'ブリーダー経験値・絆経験値・ダイヤは、どれも難易度の設定どおりの倍率です。モードによる上乗せはありません。'],
      ['🏆', 'スコアと記録', 'スコアは難易度ごとの全国ランキングに反映されます。自己ベストスコア・最高到達WAVE・クリア回数も難易度ごとに残ります。'],
      ['🤝', '供モンの加入', '決まったWAVEで供モンが加わります。加わる子は所持しているモンスターから選べます。'],
      ['⭐', 'マスモン登録', '勇者モンにした子は、プレイが終わったあとマスモンとして登録できます。'],
      ['⏩', 'スキップチケット', '使えません。スコアを競うモードなので、戦わずに報酬だけ取れないようにしています。'],
      ['🎯', 'こんな人におすすめ', 'じっくり考えて攻略したい人、ランキング上位や自己ベスト更新を狙いたい人向けです。'],
    ],
  },
  {
    id: BATTLE_MODE_QUICK, label: 'クイックモード', short: 'クイック', emoji: '⚡', color: '#2dd4bf',
    tagline: '短い時間でモンスターを育てるためのモード',
    highlights: [
      ['⚡', '育成向き。短い時間で何周でも回せる'],
      ['💎', '経験値・ダイヤが1.5倍'],
      ['🚫', 'スコアランキングは無し'],
    ],
    points: [
      ['⚔️', '編成', 'ベースモンもマスモンも自由に連れていけます。育てたい子を勇者モンにすると、その子の絆経験値がいちばん多く貯まります。'],
      ['📈', 'WAVEのあいだの強化', '強化を選ぶ画面は出ません。かわりにWAVEをクリアするたび、味方全員の全ステータス（ライフ・ちから・丈夫さ・ガッツ）がそのときの値から10%上がり、ライフとガッツが満タンまで回復します。'],
      ['👹', '難しさ', '9段階の難易度から選べます。強化を選べないぶん苦手をふさぎにくく、チャレンジモードとは違う難しさがあります。育成が目的なので、無理のない難易度で回すのが向いています。'],
      ['💎', 'もらえる経験値とダイヤ', 'ブリーダー経験値・絆経験値・ダイヤが、難易度の倍率にさらに1.5倍かかります。同じ時間でいちばん多く育つのがこのモードです。'],
      ['🏆', 'スコアと記録', 'スコアは競いません。ランキングには載らず、チャレンジモードの自己ベストも書き換わりません。記録はクイック専用の場所に、最高到達WAVEとクリア回数として残ります。'],
      ['🤝', '供モンの加入', '決まったWAVEで供モンが加わります。加わったあと、味方の誰か1体の固有技がランダムで1レベル上がります（上限Lv.8）。技を選ぶ画面は出ません。'],
      ['⭐', 'マスモン登録', '勇者モンにした子は、プレイが終わったあとマスモンとして登録できます。'],
      ['⏩', 'スキップチケット', 'このモードでだけ使えます。チケットのある難易度は、戦わずに一気にクリアぶんの報酬を受け取れます。'],
      ['🎯', 'こんな人におすすめ', '新しい子を早く育てたい人、絆レベルや強化ポイントをまとめて稼ぎたい人向けです。'],
    ],
  },
  {
    id: BATTLE_MODE_PRO, label: 'プロモード', short: 'プロ', emoji: '🎓', color: '#f472b6',
    tagline: 'ベースモンだけで挑む、育成に頼れない特殊モード',
    highlights: [
      ['🔥', '育てたマスモンなしで挑む実力勝負'],
      ['💎', '絆経験値3倍・ブリーダー経験値1.5倍'],
      ['📊', 'プロ専用のスコアランキング'],
    ],
    points: [
      ['⚔️', '編成', '育てたマスモンは1体も連れていけません。全員が素のベースモンです。これまで積み上げたステータス・強化ポイント・固有技レベル・限界突破は、このモードでは一切使えません。'],
      ['📈', 'WAVEのあいだの強化', 'チャレンジモードと同じで、WAVEをクリアするたびに強化フェーズがあります。素の状態から始まるぶん、どこを伸ばすかの判断がそのまま結果に出ます。'],
      ['👹', '難しさ', '育成済みの個体を使わない特殊な制約があります。同じ難易度でも、育てた個体を使えるチャレンジモードとは違う手ごたえです。敵の強さは難易度どおりなので、上の難易度へ行くほど制約の重みが増します。'],
      ['💎', 'もらえる経験値とダイヤ', '絆経験値が3倍、ブリーダー経験値が1.5倍になります（難易度の倍率にさらにかかります）。ダイヤとスコアの倍率は難易度の設定どおりで、上乗せはありません。'],
      ['🏆', 'スコアと記録', 'スコアはチャレンジモードとは別の「プロランキング」に反映されます。同じ条件で挑んだ人どうしで競う場所です。自己ベスト・最高到達WAVE・クリア回数もプロ専用の場所に残り、チャレンジモードの記録は書き換わりません。'],
      ['🤝', '供モンの加入', '始める前に供モンの候補を5体選びます。実際に加入候補として出るのは、その5体からランダムに選ばれた3体です。誰が来てもいいように候補を組むところまでが編成です。'],
      ['⭐', 'マスモン登録', '勇者モンにしたベースモンは、プレイが終わったあとマスモンとして登録できます。厳しい条件で戦ったぶん、絆経験値は3倍ぶん貯まっています。'],
      ['⏩', 'スキップチケット', '使えません。スコアを競うモードなので、戦わずに報酬だけ取れないようにしています。'],
      ['🎯', 'こんな人におすすめ', '育成の力を借りずに腕だけで勝ちたい人、チャレンジモードが物足りなくなった人向けです。'],
    ],
  },
];
// ===== バトルの仕組み(モード選択の1つ上) =====
// 2026-09-20 ユーザー指示「モンヒロバトルに入ったらすぐモード選択ページにいかずに、
// チャレンジモードと新バトルモードとクイックモードを選べるようにして、そこの中で各種モードがあるように」。
// ★ここで選ぶものは**保存しない**(画面を分けるためだけの値)。記録もランキングも今までどおり
//   モードのid(mh_hs_* / mh_tactics_* など)で分かれるので、保存キーは1つも増えない。
//   難易度選択の「通常/極限」タブ(difficultySelectTab)と同じ扱い
// ★名前は2026-09-20にユーザーが決めた(クラシックバトル / タクティクスバトル)。
//   idと保存キーは変えないので、名前だけあとから差し替えられる
const BATTLE_SYSTEM_CLASSIC = 'systemClassic';
const BATTLE_SYSTEM_TACTICS = 'systemTactics';
const BATTLE_SYSTEM_QUICK = 'systemQuick';
// ★書き方の決めごと(2026-09-20 ユーザー指摘で整理)。
//   クラシック   … 「いままでの通常のバトル」なので、**このゲームのバトルの基本**を書く
//   タクティクス … その基本から**変わったところだけ**を書く(基本の説明を繰り返さない)
//   クイック     … 基本から強化フェーズを外したぶん、何が得かを書く
// ★ほかのバトルにもあることを売りにしない。
//   「敵の行動が1ターン前に予告される」「解析で確率が見られる」は**どのバトルにもある**ので、
//   クラシック側(＝基本)に書く。タクティクス側は「誰を狙うかまで出る」が変わったところ。
// ★違いは「ライフ」ではなく「ステータス」で書く(2026-09-21 ユーザー指摘)。
//   合算か1体ずつかが分かれるのはライフだけではない。ちから・丈夫さ・ガッツも同じで、
//   供モンが合算されずに自分の値のまま加わることが、タクティクス側の作り直しの中心
//   (仕様 4.1「合流した供モンは、合算されず自分の値のまま盤面に加わる」)。
// ★「育てた数字より読みで勝てる」とは書かない。プロ以外はどのバトルでも育成の力が要る
//   (タクティクスは基本の上に読み合いが**足された**もので、育成が要らなくなるわけではない)。
// ★持っているときだけの話(スキップチケット)や、仕様の言い換えだけの行も置かない。
// ★points は「詳しいルール」で開く本文。モードの説明モーダルと同じ形なので、
//   画面はモードと仕組みを区別せずに出せる(battleInfoById)。
const BATTLE_SYSTEMS = Object.freeze([
  Object.freeze({
    id: BATTLE_SYSTEM_CLASSIC, label: 'クラシックバトル', short: 'クラシック', emoji: '⚔️', color: '#818cf8',
    tagline: 'モンヒロバトルの基本。育てたモンスターで10WAVEに挑む',
    highlights: Object.freeze([
      Object.freeze(['🛡️', 'ステータスは全員ぶんの合計']),
      Object.freeze(['🃏', 'カードと間合いを選んで戦う']),
      Object.freeze(['📈', 'WAVEごとに強化を選んで積み上げる']),
    ]),
    note: 'チャレンジ／種族チャレンジ／プロ。難易度は通常と極限から選べます',
    points: Object.freeze([
      Object.freeze(['🛡️', 'ステータスの持ち方', 'ライフ・ちから・丈夫さ・ガッツは、パーティ全員ぶんを合わせた1組です。供モンが加わるとその子のぶんが足されて、パーティがまとめて強くなります。ライフも1本なので、誰が狙われても同じライフが減り、0になったら負けです。']),
      Object.freeze(['🃏', 'カードと間合い', '手札のカードをガッツで払って使います。攻撃・ガード・回復・間合いの移動などがあり、モンスターには間合いごとの得意・不得意（間合い適性）があります。']),
      Object.freeze(['🔮', '敵の予告', '敵が次のターンに何をするかは、そのターンのうちに予告されます。「解析」を押すと、それぞれの行動が選ばれる確率と威力まで確かめられます。受けるか、攻めるか、間合いを変えるかをここで決めます。']),
      Object.freeze(['✨', '勇者特性', '勇者モンにした子の特性だけが、パーティ全体へ効きます。供モンが同じ特性を持っていても効かないので、誰を勇者モンにするかが編成の要になります。']),
      Object.freeze(['📈', 'WAVEのあいだの強化', 'WAVEをクリアするたびに強化フェーズがあります。ちから・丈夫さ・ライフ・ガッツのどれを伸ばすかを自分で選び、ブリーダーの教えもここで選びます。編成のかみ合わせを考えながら組み立てられます。']),
      Object.freeze(['👹', '難しさ', '通常の9段階に加えて、その上に極限の段があります。難易度えらびの「極限」タブから挑め、段ごとに特殊ルールが付きます。']),
      Object.freeze(['🎮', '中にあるモード', 'チャレンジモード（基本）、種族チャレンジ（ひとつの種族だけで挑む）、プロモード（ベースモンだけで挑む）の3つです。']),
      Object.freeze(['🏆', 'スコアと記録', 'スコアは難易度ごとの全国ランキングに反映されます。自己ベスト・最高到達WAVE・クリア回数はモードごとに別々に残ります。']),
      Object.freeze(['🎯', 'こんな人におすすめ', 'じっくり考えて攻略したい人、ランキング上位や自己ベスト更新を狙いたい人向けです。']),
    ]),
    modes: Object.freeze([BATTLE_MODE_CHALLENGE, BATTLE_MODE_SPECIES_CHALLENGE, BATTLE_MODE_PRO]),
  }),
  Object.freeze({
    id: BATTLE_SYSTEM_TACTICS, label: 'タクティクスバトル', short: 'タクティクス', emoji: '🎯', color: '#fb923c',
    tagline: '基本のルールに、誰を守るかの読み合いを足したバトル',
    highlights: Object.freeze([
      Object.freeze(['❤️', 'ステータスは1体ずつ別々']),
      Object.freeze(['🎯', '敵の予告に「誰を狙うか」まで出る']),
      Object.freeze(['✨', '連れてきた全員の勇者特性が効く']),
    ]),
    note: 'タクティクスチャレンジ／種族チャレンジ／プロ。難易度は通常と極限から選べます',
    points: Object.freeze([
      Object.freeze(['❤️', 'ステータスの持ち方', '基本のバトルは全員ぶんを合わせた1組ですが、こちらはライフ・ちから・丈夫さ・ガッツを1体ずつ持ちます。供モンが加わっても合算されず、自分の値のまま並びます。攻撃はその子のちから、受けるダメージはその子の丈夫さで決まり、狙われた子だけが減ります。倒れた子はその場では戦えなくなり、全員が倒れたときだけ負けです。']),
      Object.freeze(['🎯', '敵の狙い', '敵の予告に「誰を狙うか」まで出ます。基本のバトルはライフが1本なので狙いという考え方がありませんが、こちらは1体ずつ持つので、誰が受けるかで結果が変わります。']),
      Object.freeze(['🌀', '敵の技が増える', '間合い攻撃・連撃・貫通撃・攻撃力アップなど、基本のバトルには無い技を使い分けます。ガードが効かない技もあるので、予告を見てから受け方を決めます。']),
      Object.freeze(['✨', '勇者特性は持っている子のもの', '基本のバトルは勇者モンの特性だけが効きますが、こちらは連れてきた供モンの勇者特性も、それぞれの子に効きます（効き目は勇者モンと同じ）。ライガーの「俊足」ならライガーが狙われたときに避け、ゴーレムの「怪力」ならゴーレムが攻撃したときに乗ります。供モンを選ぶ意味が「ステータスの足し算」から「どの特性を連れていくか」に変わります。']),
      Object.freeze(['🃏', 'カードを使う子を選ぶ', 'カードは「誰が使うか」を選んでから出します。ガッツもその子のぶんから払うので、1体に任せきりにはできません。']),
      Object.freeze(['🤝', '供モンの加入', '供モンが加わると、そのぶん敵も強くなります。強く育てた子を連れていくほど手ごわくなるので、少ない人数のまま進むという選び方もできます。']),
      Object.freeze(['🎮', '中にあるモード', 'タクティクスチャレンジ（基本）、種族チャレンジ、プロの3つです。難易度は通常と極限から選べます。']),
      Object.freeze(['🏆', 'スコアと記録', 'クラシックバトルとは別の全国ランキングに載ります。クラシックバトルの記録は書き換わりません。']),
      Object.freeze(['💪', '育成はここでも効く', '編成・カード・間合い・強化フェーズは基本のバトルと同じで、育てた強さはそのまま効きます。そのうえに「誰が受けるか」の判断が足される、という関係です。']),
      Object.freeze(['🎯', 'こんな人におすすめ', '基本のバトルに慣れて、もう一段の読み合いがほしい人向けです。同じ編成でも、受け方の判断で結果が変わります。']),
    ]),
    modes: Object.freeze([BATTLE_MODE_TACTICS, BATTLE_MODE_TACTICS_SPECIES, BATTLE_MODE_TACTICS_PRO]),
  }),
  Object.freeze({
    id: BATTLE_SYSTEM_QUICK, label: 'クイックモード', short: 'クイック', emoji: '⚡', color: '#fbbf24',
    tagline: '短い時間でモンスターを育てる、周回向けのバトル',
    highlights: Object.freeze([
      Object.freeze(['💎', '経験値・ダイヤが1.5倍もらえる']),
      Object.freeze(['⚡', '強化を選ばないから1周が速い']),
      Object.freeze(['🔁', 'AUTO∞で放置したまま何周でも']),
    ]),
    note: '中のモードは1つだけなので、選ぶとそのまま難易度えらびへ進みます',
    points: Object.freeze([
      Object.freeze(['💎', 'もらえるもの', 'ブリーダー経験値・絆経験値・ダイヤが、難易度の倍率にさらに1.5倍かかります。同じ時間でいちばん多く育つのがこのモードです。']),
      Object.freeze(['📈', '強化のかわり', '強化を選ぶ画面は出ません。かわりにWAVEをクリアするたび、味方全員のライフ・ちから・丈夫さ・ガッツがそのときの値から10%上がり、ライフとガッツが満タンまで回復します。']),
      Object.freeze(['🔁', '放置で周回する', 'AUTO∞を使うと、10WAVEをクリアしたあとそのまま次の周へ入ります。置いておくだけで育つので、育成の周回と相性がいい遊び方です。']),
      Object.freeze(['⏩', 'スキップチケット', 'このモードでだけ使えます。チケットのある難易度は、戦わずに一気にクリアぶんの報酬を受け取れます。']),
      Object.freeze(['🎁', '報酬の方針を選べる', '難易度えらびで「育成／プシュケー優先／ダイヤ優先」を選べます。いま欲しいものに合わせて、もらえるものの内訳を変えられます。']),
      Object.freeze(['🏆', 'スコアと記録', 'スコアは競いません。ランキングには載らず、ほかのモードの自己ベストも書き換わりません。記録はクイック専用の場所に、最高到達WAVEとクリア回数として残ります。']),
      Object.freeze(['🎯', 'こんな人におすすめ', '新しい子を早く育てたい人、絆レベルや強化ポイントをまとめて稼ぎたい人向けです。']),
    ]),
    modes: Object.freeze([BATTLE_MODE_QUICK]),
    direct: true,
  }),
]);
// そのモードがどの仕組みに属するか。見つからなければ「これまでのバトル」に寄せる
const battleSystemOf = (modeId) => BATTLE_SYSTEMS.find(s => s.modes.includes(modeId)) || BATTLE_SYSTEMS[0];
// そのモードをいま遊べるか。公開フラグの見方はここ1か所にまとめる
// (画面・ランキング・検査がばらばらにフラグを見ると、片方だけ出し忘れる)
const battleModePlayable = (id, { debugBattle = false } = {}) => {
  if (debugBattle) return true;
  if (id === BATTLE_MODE_SPECIES_CHALLENGE) return SPECIES_CHALLENGE_PUBLIC_RELEASE;
  // ★β版はタクティクスプロだけ遊べる(2026-09-20 ユーザー指示)
  if (id === BATTLE_MODE_TACTICS_PRO) return TACTICS_MODE_PUBLIC_RELEASE || TACTICS_BETA_PRO_RELEASE;
  if (isTacticsMode(id)) return TACTICS_MODE_PUBLIC_RELEASE;
  return true;
};
// まだ遊べないが、カードだけは並べるモード。β版のタクティクスバトルの中だけで起きる
// (ユーザー指示「3つ並べてプロ以外は準備中」)。デバッグからは今までどおり全部遊べる
const battleModeComingSoon = (id, { debugBattle = false } = {}) => !debugBattle
  && TACTICS_BETA_PRO_RELEASE && !TACTICS_MODE_PUBLIC_RELEASE
  && isTacticsMode(id) && !battleModePlayable(id, { debugBattle });
// 仕組みの中で実際に画面へ並べるモード。遊べないものは落とすが、
// 「準備中」として見せるものだけは残す
const battleSystemModes = (systemId, { debugBattle = false } = {}) => {
  const system = BATTLE_SYSTEMS.find(s => s.id === systemId) || BATTLE_SYSTEMS[0];
  return system.modes.filter(id => battleModePlayable(id, { debugBattle })
    || battleModeComingSoon(id, { debugBattle }));
};
// まだ遊べないが、枠だけは見せる仕組み(2026-09-20 ユーザー指示
// 「準備中の新モードもクイックの上に入れて」)。モンヒロビートの「準備中」と同じ作りで、
// 公開フラグが立つまでは押せないカードを出す。デバッグからは今までどおり遊べる。
// ★β版が立つと中のプロが遊べるので、仕組みそのものは「準備中」ではなくなる
const battleSystemComingSoon = (systemId, { debugBattle = false } = {}) =>
  systemId === BATTLE_SYSTEM_TACTICS && !TACTICS_MODE_PUBLIC_RELEASE
    && !TACTICS_BETA_PRO_RELEASE && !debugBattle;
// β版で開いている仕組み。中のモードが全部そろっていないことを入口で伝えるために使う
const battleSystemBeta = (systemId, { debugBattle = false } = {}) => !debugBattle
  && systemId === BATTLE_SYSTEM_TACTICS && TACTICS_BETA_PRO_RELEASE && !TACTICS_MODE_PUBLIC_RELEASE;
// タクティクス専用の EXスキル(設計: docs/spec/TACTICS_EX_SKILLS.md)を、プレイヤーへ出すかどうか。
// false のあいだは**デバッグのバトル(バトルモード入口)でだけ**距離枠から開ける。
// 2026-09-23 ユーザー指示「β版だし公開していいよ」で、お試しとして公開した
// (モノリス・ゴーレム・剣士モッチーの3体。不具合や変更があることを前提にしたβの公開)。
// ★タクティクスの公開フラグ(TACTICS_BETA_PRO_RELEASE ほか)とは別のスイッチ。あちらは触らない
const TACTICS_EX_SKILLS_RELEASE = true;
// EXスキルをいま出してよいか。見るのはここ1か所だけ(画面も本体も検査もここを通す)。
// ★タクティクス以外のモードでは、フラグやデバッグに関係なく必ず false
// ★練習(バトルのれんしゅう)では出さない。台本どおりに進める場面なので、別の操作を増やさない
const tacticsExSkillsEnabled = (mode, { debugBattle = false, tutorial = false } = {}) =>
  isTacticsMode(mode) && !tutorial && (TACTICS_EX_SKILLS_RELEASE || debugBattle === true);
// 画面へ並べる仕組み。中に出せるモードが1つも無いものは、準備中の枠としてだけ出す
const visibleBattleSystems = ({ debugBattle = false } = {}) =>
  BATTLE_SYSTEMS.filter(s => battleSystemModes(s.id, { debugBattle }).length > 0
    || battleSystemComingSoon(s.id, { debugBattle }));
// 「詳しいルール」で開くもの。仕組み(BATTLE_SYSTEMS)とモード(BATTLE_MODES など)を
// 同じ入口から引く。どちらも {emoji,label,color,tagline,points} を持っているので、
// 説明の画面はモードと仕組みを区別しなくてよい
const battleInfoById = (id) => BATTLE_SYSTEMS.find(s => s.id === id) || battleModeInfo(id);
// 極限チャレンジは通常の3モードとは別に持っているので、説明・ランキング画面から引けるようにここで合流させる
// (EXTREME_MODE はこの下で定義するため、呼ばれた時点で参照する)
const battleModeInfo = (mode) => {
  if (typeof EXTREME_MODE !== 'undefined' && EXTREME_MODE && mode === EXTREME_MODE.id) return EXTREME_MODE;
  if (mode === BATTLE_MODE_SPECIES_CHALLENGE) return SPECIES_CHALLENGE_MODE;
  if (mode === BATTLE_MODE_TACTICS) return TACTICS_MODE;
  if (mode === BATTLE_MODE_TACTICS_SPECIES) return TACTICS_SPECIES_MODE;
  if (mode === BATTLE_MODE_TACTICS_PRO) return TACTICS_PRO_MODE;
  return BATTLE_MODES.find(m => m.id === normalizeBattleMode(mode)) || BATTLE_MODES[0];
};
// 本番のバトル画面へ出すモード。いまは3モードすべてを公開している。
// 作りかけのモードを足すときは、ここから外せば新しい入口には出ないまま
// デバッグ・ヘルプの表・検査からだけ見える状態にできる
const PUBLIC_BATTLE_MODES = BATTLE_MODES;
// スコアランキングがあるモードかどうか。クイックだけ対象外
// 種族チャレンジは一般公開するまで全国ランキングへ送らない。
// デバッグの実戦から外部ランキングを汚さないための入口はここ1か所にまとめてある
// 新モードも、公開するまでは全国ランキングへ送らない(デバッグから遊べるため、ここで止める)
// ★タクティクス側は battleModePlayable がフラグを1か所で見る。
//   β版ではタクティクスプロだけが true になり、送り先もβ版専用の行になる
const modeHasRanking = (mode) => !isQuickMode(mode)
  && (mode !== BATTLE_MODE_SPECIES_CHALLENGE || SPECIES_CHALLENGE_PUBLIC_RELEASE)
  && (!isTacticsMode(mode) || battleModePlayable(mode));
// そのモードで遊んだときに増える、みゅあの仲良し度の行動キー。
// 既存の challenge / quick の獲得量と1日上限は変えず、プロぶんの pro を足しただけ
const modeBondAction = (mode) => isQuickMode(mode) ? 'quick' : isProMode(mode) ? 'pro' : 'challenge';
// そのモードの画面で助手(みゅあ)に話させる場面。セリフは data/assistants.js にある
const battleModeAssistantScene = (mode) => mode === EXTREME_MODE.id ? 'extremeChallenge' : isQuickMode(mode) ? 'battleQuick' : isProMode(mode) ? 'battlePro' : 'battleChallenge';
// クラシックバトルの種族チャレンジか(タクティクス側は別のidを持つ)。
// 「種族を選ぶ画面」「種族ごとの記録」はどちらのモードでも同じ入口を通すので、
// 見分けが要るのは記録の置き場とランキングのキーだけ
const isClassicSpeciesChallengeMode = (mode) => mode === BATTLE_MODE_SPECIES_CHALLENGE;
// ラン中に供モンが合流するとき、画面へ出す候補を作る。
// 「すでに編成にいる子」と「勇者モン」は必ず外す。勇者モンは編成にいるので普通は
// activeIds で外れるが、そこに頼ると取りこぼしたときに自分自身が候補として出てしまうため、
// 種idでも明示的に外している。
// プロモードは pool に「始める前に選んだ5体」が入るので、そこからランダムに offerSize 体だけ出る。
const joinRosterEntry = (mon) => mon?.masuId != null ? `masu:${mon.masuId}` : mon?.id || null;
const pickJoinCandidates = (pool, activeIds, heroId, offerSize) => {
  const used = new Set([...(Array.isArray(activeIds) ? activeIds : []), heroId].filter(Boolean));
  const list = (Array.isArray(pool) ? pool : []).filter(m => m && m.id && m.id !== heroId && !used.has(joinRosterEntry(m)));
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Number(offerSize) || 0));
};

// AUTOの供モンと配置先だけを決める。候補の合法判定は手動と同じpickJoinCandidatesを通し、
// 実際の加入ボーナスやモード別処理は既存のsetupMonへ任せる。
const chooseAutoAllyJoin = ({ pool, activeMons, heroId, setting, slots }, rng = Math.random) => {
  const activeEntries = (Array.isArray(activeMons) ? activeMons : []).map(joinRosterEntry).filter(Boolean);
  const legal = pickJoinCandidates(pool, activeEntries, heroId, Array.isArray(pool) ? pool.length : 0);
  const desired = setting?.rosterEntry;
  const mon = (desired ? legal.find(candidate => joinRosterEntry(candidate) === desired) : null)
    || legal[Math.floor(rng() * legal.length)];
  const emptySlots = (Array.isArray(slots) ? slots : []).map((value, index) => value == null ? index : null).filter(index => index != null);
  if (!mon || emptySlots.length === 0) return null;
  const preferred = Number.isInteger(setting?.slot) && emptySlots.includes(setting.slot) ? setting.slot : null;
  const slotIdx = preferred ?? emptySlots[Math.floor(rng() * emptySlots.length)];
  return { mon, slotIdx };
};
