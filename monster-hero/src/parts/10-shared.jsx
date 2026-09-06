
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
const Heart=_icon('Heart'), Zap=_icon('Zap'), Sword=_icon('Sword'), Shield=_icon('Shield'), X=_icon('X'), Award=_icon('Award'), Skull=_icon('Skull'), PlusCircle=_icon('PlusCircle'), Target=_icon('Target'), ShieldCheck=_icon('ShieldCheck'), Trophy=_icon('Trophy'), Timer=_icon('Timer'), Play=_icon('Play'), Sparkles=_icon('Sparkles'), Activity=_icon('Activity'), ChevronLeft=_icon('ChevronLeft'), ChevronRight=_icon('ChevronRight'), Crown=_icon('Crown'), Edit3=_icon('Edit3'), ArrowLeft=_icon('ArrowLeft'), Search=_icon('Search'), Layers=_icon('Layers'), AlertCircle=_icon('AlertCircle'), Flag=_icon('Flag'), RotateCcw=_icon('RotateCcw'), MinusCircle=_icon('MinusCircle'), Star=_icon('Star'), Users=_icon('Users'), User=_icon('User'), Check=_icon('Check'), HelpCircle=_icon('HelpCircle'), BookOpen=_icon('BookOpen'), Info=_icon('Info'), RefreshCcw=_icon('RefreshCcw'), ArrowDownCircle=_icon('ArrowDownCircle'), Coins=_icon('Coins'), ShoppingBag=_icon('ShoppingBag'), Gem=_icon('Gem'), Package=_icon('Package'), Settings=_icon('Settings'), List=_icon('List');


// --- Helpers ---
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const BATTLE_SPEEDS = [1, 1.5, 2, 3, 4];
const normalizeBattleSpeed = (value) => BATTLE_SPEEDS.includes(Number(value)) ? Number(value) : 1;
const BATTLE_SPEED_KEY = 'mh_battle_speed_v1';
const BUILD_DATE = "2026-09-06 12:56"; // 更新のたびに手動で書き換える(日付+時刻、JST) ※version.jsonのbuildも同じ値に合わせること

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
// 種族チャレンジを一般公開するかどうかの1つのスイッチ。
// false のあいだは
//   ・通常プレイのBATTLE MODEへ出さない(デバッグのバトルモード入口からだけ見える)
//   ・クリアしても全国ランキングへ送らない
//   ・ヘルプの項目・更新履歴・助手の告知・BGMアレンジの「種族」タブも出さない
// true にするとこれらが同時に出る。
// 2026年8月にユーザーの指示で公開した。実装側から勝手に false へ戻さない
// (戻すと、すでに遊んだ人の全国ランキングだけが止まる)。
const SPECIES_CHALLENGE_PUBLIC_RELEASE = true;
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
const isProMode = (mode) => normalizeBattleMode(mode) === BATTLE_MODE_PRO;
// 種族チャレンジは normalizeBattleMode の対象外(未知の値はチャレンジへ落ちる)なので、
// idそのものを見る。BGMのようにモードごとに分かれる設定はここを通す
const isSpeciesChallengeMode = (mode) => mode === BATTLE_MODE_SPECIES_CHALLENGE;
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
const modeKeyPrefix = (mode) => isQuickMode(mode) ? 'mh_quick_' : isProMode(mode) ? 'mh_pro_' : 'mh_';
const bestScoreKey = (mode, diff) => `${modeKeyPrefix(mode)}hs_${diff}`;
const bestWaveKey = (mode, diff) => `${modeKeyPrefix(mode)}highest_wave_${diff}`;
const clearCountKey = (mode, diff) => `${modeKeyPrefix(mode)}clears_${diff}`;
// クイックの各難易度は、同じ難易度をチャレンジ・プロ・極限のどれかでクリア済みなら解放する。
// 新しい解放フラグは作らず、各モードの既存クリア回数だけを参照するため、既存セーブにも即時反映される。
const isQuickDifficultyUnlocked = (difficulty, challengeClears, proClears, extremeClears) =>
  [challengeClears, proClears, extremeClears]
    .some(clears => (Number(clears?.[difficulty]) || 0) > 0);
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
// 極限チャレンジは通常の3モードとは別に持っているので、説明・ランキング画面から引けるようにここで合流させる
// (EXTREME_MODE はこの下で定義するため、呼ばれた時点で参照する)
const battleModeInfo = (mode) => {
  if (typeof EXTREME_MODE !== 'undefined' && EXTREME_MODE && mode === EXTREME_MODE.id) return EXTREME_MODE;
  if (mode === BATTLE_MODE_SPECIES_CHALLENGE) return SPECIES_CHALLENGE_MODE;
  return BATTLE_MODES.find(m => m.id === normalizeBattleMode(mode)) || BATTLE_MODES[0];
};
// 本番のバトル画面へ出すモード。いまは3モードすべてを公開している。
// 作りかけのモードを足すときは、ここから外せば新しい入口には出ないまま
// デバッグ・ヘルプの表・検査からだけ見える状態にできる
const PUBLIC_BATTLE_MODES = BATTLE_MODES;
// スコアランキングがあるモードかどうか。クイックだけ対象外
// 種族チャレンジは一般公開するまで全国ランキングへ送らない。
// デバッグの実戦から外部ランキングを汚さないための入口はここ1か所にまとめてある
const modeHasRanking = (mode) => !isQuickMode(mode)
  && (mode !== BATTLE_MODE_SPECIES_CHALLENGE || SPECIES_CHALLENGE_PUBLIC_RELEASE);
// そのモードで遊んだときに増える、みゅあの仲良し度の行動キー。
// 既存の challenge / quick の獲得量と1日上限は変えず、プロぶんの pro を足しただけ
const modeBondAction = (mode) => isQuickMode(mode) ? 'quick' : isProMode(mode) ? 'pro' : 'challenge';
// そのモードの画面で助手(みゅあ)に話させる場面。セリフは data/assistants.js にある
const battleModeAssistantScene = (mode) => mode === EXTREME_MODE.id ? 'extremeChallenge' : isQuickMode(mode) ? 'battleQuick' : isProMode(mode) ? 'battlePro' : 'battleChallenge';
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
// そのレベルから次レベルに必要なXP(基準値)。指数を上げるほど高レベルが急に重くなる。
// 10WAVE完全クリアを1周=100XPとして、Lv30到達までの周回数は次のように緩和してきている。
//   指数1.8(当初)  … ブリーダー約580周 / 絆約410周
//   指数1.6         … ブリーダー約190周 / 絆約130周
//   指数1.4(現在)  … ブリーダー約56周  / 絆約35周
// さらに絆側はBOND_XP_DISCOUNTを0.05→0.025へ引き下げたため、Lv30到達は約18周ぶんになっている。
const XP_CURVE_EXPONENT = 1.4;
const xpForLevel = (level) => Math.round(50 * Math.pow(level, XP_CURVE_EXPONENT));
// 緩和前(指数1.8)の必要XPで求めたレベル。今回の緩和で上がったレベル分の
// ブリーダーポイントを一度だけ遡って配るための計算にのみ使う
const legacyLevelBefore160 = (totalXp, discount) => {
  let level = 1, xp = totalXp;
  for (let i = 0; i < 200; i++) {
    const need = Math.max(1, Math.round(50 * Math.pow(level, 1.8) * discount));
    if (xp < need) break;
    xp -= need; level++;
  }
  return level;
};
// --- ブリーダーレベル: 上がり方を緩和するため、必要XPを基準値から割り引く
// (バランス調整用の係数。小さくするほど上げやすい。後日調整しやすいようここに1箇所だけ置く。
// 0.25 → 0.15 → 0.08 と緩和してきている)
const BREEDER_XP_DISCOUNT = 0.08;
const xpForBreederLevel = (level) => Math.max(1, Math.round(xpForLevel(level) * BREEDER_XP_DISCOUNT));
// ブリーダーレベルに意図した上限は無い。以前は200回で打ち切っていたため、
// Lv.201以降は経験値が貯まってもレベルが上がらなくなっていた。
//
// ただしその打ち切りは「壊れた保存値が来ても必ず止まる」安全弁も兼ねていた。
// NaN・Infinityは「xp < need」がいつまでも偽になるため、素直にwhileへ変えると
// その場で無限ループして画面が固まる。上限ではなく入力側で守る。
// MAX_SAFE_INTEGERはLv.360万ぶんに相当し、遊んで届く値ではないので実質的な上限にはならない。
const safeBreederXp = (totalXp) => {
  const value = Number(totalXp);
  return Number.isFinite(value) ? Math.min(Math.max(0, value), Number.MAX_SAFE_INTEGER) : 0;
};
const levelInfo = (totalXp) => {
  const safeTotal = safeBreederXp(totalXp);
  let level = 1, xp = safeTotal;
  while (true) {
    const need = xpForBreederLevel(level);
    if (xp < need) break;
    xp -= need; level++;
  }
  return { level, xpIntoLevel: xp, xpForNext: xpForBreederLevel(level), totalXp: safeTotal };
};
// 【超越】Lv400・虹★5(35凸)まで育てた個体だけが神殿で行える、限界の先の育成。
// 限界突破の上限(35凸)はそのままで、超越が伸ばすのは「Lv上限」だけ。
// MAX_MASU_LEVEL_CAP は限界突破の天井として400のまま使い続けるので、36凸は作られない。
const TRANSCEND_LEVEL_CAP = 500;
const TRANSCEND_PSYCHE_COST = 5000;
const TRANSCEND_DIAMOND_COST = 1000000;
// Lv400→401は通常式の10倍。以降1Lvごとに+0.1倍(Lv499→500で19.9倍)
const TRANSCEND_XP_BASE_MULTIPLIER = 10;
const TRANSCEND_XP_MULTIPLIER_STEP = 0.1;
// 虹のプシュケー1,000個 → 超越ポイント1(端数は消費しない)
const TRANSCEND_PSYCHE_PER_POINT = 1000;
const TRANSCEND_STAT_KEYS = Object.freeze(['hp', 'atk', 'def', 'guts']);
const isTranscended = (masu) => !!(masu && masu.transcended);
// 超越済みならLv上限500まで、まだなら従来どおりLv400まで
const masuLevelCapLimit = (masu) => (isTranscended(masu) ? TRANSCEND_LEVEL_CAP : MAX_MASU_LEVEL_CAP);
// 旧セーブにはこれらの項目が無いので、必ず安全な初期値(0)へ落として読む
const normalizeTranscendStatPoints = (value) => Object.fromEntries(TRANSCEND_STAT_KEYS
  .map(key => [key, Math.max(0, Math.floor(Number(value?.[key]) || 0))]));
const normalizeTranscendAptBoosts = (value) => Array.from({ length: 4 },
  (_, index) => Math.max(0, Math.floor(Number(Array.isArray(value) ? value[index] : 0) || 0)));
// --- マスモンの絆レベル: ブリーダーレベルより上げやすくするため、必要XPを基準値から大幅に割り引く
// (バランス調整用の係数。小さくするほど上げやすい。後日調整しやすいようここに1箇所だけ置く。
// 0.35 → 0.175 → 0.10 → 0.05 → 0.025 と緩和してきている。係数を下げると同じ絆経験値でも絆レベルが上がるため、
// レベルアップ時に配る強化ポイントが後追いにならないよう、読み込み時にreconcileMasuPointsで
// 必ず不足分を補填している)
const BOND_XP_DISCOUNT = 0.025;
const xpForBondLevel = (level) => Math.max(1, Math.round(xpForLevel(level) * BOND_XP_DISCOUNT));
// Lv400以降(超越の領域)だけ、通常式が出した必要経験値へ重い倍率を掛ける。
// 倍率は Lv400で10倍、以降1Lvごとに+0.1倍(Lv499→500で19.9倍)。
// Lv399以下はこれまでどおりの値をそのまま返すので、既存の必要経験値・累計XPは1も変わらない。
const transcendXpMultiplier = (level) =>
  TRANSCEND_XP_BASE_MULTIPLIER + (level - MAX_MASU_LEVEL_CAP) * TRANSCEND_XP_MULTIPLIER_STEP;
const xpForBondLevelAt = (level) => {
  const normal = xpForBondLevel(level);
  return level < MAX_MASU_LEVEL_CAP ? normal : Math.max(1, Math.round(normal * transcendXpMultiplier(level)));
};
const bondLevelInfo = (totalXp) => {
  // 壊れた保存値(NaN・Infinity・負数)で回り続けないよう、先に有限の0以上へ落とす
  const safeTotal = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1, xp = safeTotal;
  for (let i = 0; i < MAX_BOND_LEVEL_ITERATIONS; i++) {
    const need = xpForBondLevelAt(level);
    if (xp < need) break;
    xp -= need; level++;
  }
  return { level, xpIntoLevel: xp, xpForNext: xpForBondLevelAt(level), totalXp: safeTotal };
};
const INITIAL_MASU_LEVEL_CAP = 30;
// 超越後はLv500まで数える。Lv1から数え上げるので、繰り返し回数は上限-1。
// こうしておくと壊れた絆経験値が来てもLv501にはならず、無限ループにもならない。
const MAX_BOND_LEVEL_ITERATIONS = TRANSCEND_LEVEL_CAP - 1;
// 限界突破1回でレベル上限がいくつ上がるか
const BREAKTHROUGH_LEVEL_CAP_GAIN = 5;
const AUTO_REPEAT_BREAKTHROUGH_MIN_LEVEL = 35;
// ブリーダーLvの半分以下を5刻みに切り下げ、Lv35未満ならOFFだけにする。
const autoRepeatBreakthroughMaxLevel = (breederLevel) => {
  const maxLevel = Math.floor(Math.max(0, Number(breederLevel) || 0) / (BREAKTHROUGH_LEVEL_CAP_GAIN * 2)) * BREAKTHROUGH_LEVEL_CAP_GAIN;
  return maxLevel >= AUTO_REPEAT_BREAKTHROUGH_MIN_LEVEL ? maxLevel : 0;
};
const autoRepeatBreakthroughLevelOptions = (breederLevel) => {
  const maxLevel = autoRepeatBreakthroughMaxLevel(breederLevel);
  const levels = [];
  for (let level = AUTO_REPEAT_BREAKTHROUGH_MIN_LEVEL; level <= maxLevel; level += BREAKTHROUGH_LEVEL_CAP_GAIN) levels.push(level);
  return levels;
};
const normalizeAutoRepeatBreakthroughLevel = (value) => {
  const level = Math.floor(Number(value) || 0);
  return level >= AUTO_REPEAT_BREAKTHROUGH_MIN_LEVEL && level % BREAKTHROUGH_LEVEL_CAP_GAIN === 0 ? level : 0;
};
const MAX_UNIQUE_SKILL_LEVEL = 8;
// 固有技の強化ポイントは、技を上げるほかに「いまのガッツを戻す」ことにも使える。
// 育てきって技がすべてMAXになったあともポイントが余らないようにするための使い道。
// 最大ガッツそのものは増やさず、最大までの範囲で現在値だけを回復する。
const GUTS_RECOVERY_POINT_COST = 1; // 1回に使う強化ポイント
const GUTS_RECOVERY_AMOUNT = 10;    // 1回で戻る現在ガッツ
// UPGRADE_SKILLのAUTO配分を同期的に決める。画面に並んだ合法な技だけを受け取り、
// 1Pごとに候補を引き直すため、途中で上限へ達した技は以後の抽選から外れる。
const chooseAutoUniqueUpgradePlan = (uniques, upgradePoints, maxLevel = MAX_UNIQUE_SKILL_LEVEL, rng = Math.random) => {
  if (!Array.isArray(uniques) || !Number.isInteger(upgradePoints) || upgradePoints < 0
    || !Number.isInteger(maxLevel) || maxLevel < 0 || typeof rng !== 'function') return null;
  const levels = {};
  const allocations = {};
  for (const entry of uniques) {
    const key = typeof entry?.key === 'string' ? entry.key : '';
    const level = entry?.level;
    if (!key || Object.prototype.hasOwnProperty.call(levels, key)
      || !Number.isInteger(level) || level < 0 || level > maxLevel) return null;
    levels[key] = level;
  }
  let remainingPoints = upgradePoints;
  while (remainingPoints > 0) {
    const candidates = Object.keys(levels).filter(key => levels[key] < maxLevel);
    if (candidates.length === 0) break;
    const roll = rng();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    const key = candidates[Math.floor(roll * candidates.length)];
    levels[key] += 1;
    allocations[key] = (allocations[key] || 0) + 1;
    remainingPoints -= 1;
  }
  return { allocations, levels, remainingPoints };
};
const INHERITED_UNIQUE_LEVEL_KEY_PREFIX = 'inhId:';
let inheritedUniqueIdSequence = 0;
const createInheritedUniqueId = () => {
  inheritedUniqueIdSequence += 1;
  const random = Math.floor(Math.random() * 0x100000000).toString(36);
  return `iu_${Date.now().toString(36)}_${inheritedUniqueIdSequence.toString(36)}_${random}`;
};
const inheritedUniqueLevelKey = (unique) => {
  const id = typeof unique?.inheritedUniqueId === 'string' ? unique.inheritedUniqueId.trim() : '';
  return id ? `${INHERITED_UNIQUE_LEVEL_KEY_PREFIX}${id}` : null;
};
// 恒久Lvは継承技自身のIDを正本にする。ID移行前だけ旧配列位置を読み、最後に従来どおり
// スナップショットのevoLevelへフォールバックする。
const resolveInheritedUniqueLevel = (masu, unique, index) => {
  const levels = masu?.uniqueSkillLevels && typeof masu.uniqueSkillLevels === 'object' ? masu.uniqueSkillLevels : {};
  const stableKey = inheritedUniqueLevelKey(unique);
  const value = stableKey && Object.prototype.hasOwnProperty.call(levels, stableKey)
    ? levels[stableKey]
    : (Object.prototype.hasOwnProperty.call(levels, `inh:${index}`) ? levels[`inh:${index}`] : unique?.evoLevel);
  return Math.max(0, Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.floor(Number(value) || 0)));
};
const isValidInheritedUnique = (unique) => unique && typeof unique === 'object'
  && typeof unique.name === 'string' && unique.name.trim();

// ==================== 固有技設定(並び順・初期技) ====================
// 個体ごとに「どの順で見せるか」「バトル開始時にどれを構えるか」だけを覚える。
// 固有技Lv・技性能・消費ガッツ・継承元・固有技P・合体履歴には一切触らない。
//
// 技の識別は、恒久Lvと同じ安定キー(自前='own' / 継承='inhId:<inheritedUniqueId>')を使う。
// 配列位置(inh:0 など)は並び替えで意味が変わるため、保存する正本にはしない。
// ID移行前の壊れた記録だけは表示を欠かさないよう位置で仮のキーを付けるが、保存には残さない。
const OWN_UNIQUE_KEY = 'own';
const uniqueSettingKeyOf = (unique, index = 0) => inheritedUniqueLevelKey(unique) || `inh:${index}`;
const isStableUniqueSettingKey = (key) => key === OWN_UNIQUE_KEY
  || (typeof key === 'string' && key.startsWith(INHERITED_UNIQUE_LEVEL_KEY_PREFIX));
// 設定が無いときの並び(=これまでの並び)。自前が先頭で、続けて継承技を保存配列の順に並べる
const defaultUniqueSettingKeys = (masu) => [
  OWN_UNIQUE_KEY,
  ...(Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : []).map((unique, index) => uniqueSettingKeyOf(unique, index)),
];
// 保存された並び順を、いま実際に持っている固有技へ合わせる(読むたびに行う。保存の一括書き換えはしない)。
//   設定が無い・壊れている → 従来順 ／ 保存に無い技(新しく増えた技) → 既存設定の後ろへ ／
//   いま持っていない技 → 無視 ／ 同じ技が二重 → 最初の1つだけ
const normalizeUniqueOrder = (masu) => {
  const current = defaultUniqueSettingKeys(masu);
  const known = new Set(current);
  const saved = Array.isArray(masu?.uniqueOrder) ? masu.uniqueOrder : [];
  const ordered = [];
  const seen = new Set();
  saved.forEach(key => {
    if (typeof key !== 'string' || !known.has(key) || seen.has(key)) return;
    seen.add(key); ordered.push(key);
  });
  current.forEach(key => { if (!seen.has(key)) { seen.add(key); ordered.push(key); } });
  return ordered;
};
// 初期技。設定が無い・いま持っていない技を指しているときは、これまでどおり自前の固有技へ戻す
const normalizeInitialUniqueKey = (masu) => {
  const key = typeof masu?.initialUniqueKey === 'string' ? masu.initialUniqueKey.trim() : '';
  return key && defaultUniqueSettingKeys(masu).includes(key) ? key : OWN_UNIQUE_KEY;
};
// 設定を書き戻す形。安定キーだけを保存し、位置で作った仮のキーは残さない
const buildUniqueSettingUpdate = (masu, { order, initialKey }) => {
  if (!masu) return null;
  return {
    ...masu,
    uniqueOrder: normalizeUniqueOrder({ ...masu, uniqueOrder:order }).filter(isStableUniqueSettingKey),
    initialUniqueKey: normalizeInitialUniqueKey({ ...masu, initialUniqueKey:initialKey }),
  };
};
// 「初期状態に戻す」= 自前を先頭かつ初期技、継承技は従来の標準順。
// 固有技Lv(uniqueSkillLevels)と固有技P(uniqueSkillPoints)には触れない
const buildUniqueSettingReset = (masu) => {
  if (!masu) return null;
  return {
    ...masu,
    uniqueOrder: defaultUniqueSettingKeys(masu).filter(isStableUniqueSettingKey),
    initialUniqueKey: OWN_UNIQUE_KEY,
  };
};
// 設定の安定キー → バトル中のスロット選択キー('own' / 'inh0' 等)。
// バトル側のキーは inheritedUniques の配列位置を指すので、並び替えても位置は動かさない。
// 指している技が見つからないときは、これまでどおり自前の固有技を使う
const battleUniqueKeyFromSettingKey = (mon, settingKey) => {
  if (!settingKey || settingKey === OWN_UNIQUE_KEY) return OWN_UNIQUE_KEY;
  const list = Array.isArray(mon?.inheritedUniques) ? mon.inheritedUniques : [];
  const index = list.findIndex((unique, i) => uniqueSettingKeyOf(unique, i) === settingKey);
  return index >= 0 ? `inh${index}` : OWN_UNIQUE_KEY;
};
// そのスロットで今えらばれている固有技のキー。ラン中に切り替えていればその選択、
// まだ切り替えていなければ、そのマスモンに設定された初期技(未設定なら自前)を使う
const activeSlotUniqueKey = (choice, slotIdx, mon) => (choice && choice[slotIdx])
  || battleUniqueKeyFromSettingKey(mon, mon?.initialUniqueKey);
// 個体ごとの並び順を、バトルで見せる候補の並びへ反映する。
// 並び順に無い技は元の順のまま末尾に残すので、候補が消えることはない
const sortUniqueOptionsByMasuOrder = (options, order) => {
  if (!Array.isArray(order) || order.length === 0) return options;
  const rank = new Map(order.map((key, index) => [key, index]));
  return options
    .map((option, index) => ({ option, index, rank: rank.has(option.settingKey) ? rank.get(option.settingKey) : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map(entry => entry.option);
};
// 画面に出す固有技の一覧(getRebirthSkillChoices と同じ key を持つもの)を設定の並び順にする。
// 並べ替えるのは表示だけで、key と固有技Lvの対応は動かさない
const orderUniqueChoicesByMasuOrder = (masu, choices) => {
  const rank = new Map(normalizeUniqueOrder(masu).map((key, index) => [key, index]));
  return (Array.isArray(choices) ? choices : [])
    .map((choice, index) => ({ choice, index, rank: rank.has(choice?.key) ? rank.get(choice.key) : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map(entry => entry.choice);
};
// 並び替え操作。ドラッグに頼らず「↑」「↓」1回ぶんだけ動かす
const moveUniqueOrderKey = (order, key, delta) => {
  const list = Array.isArray(order) ? [...order] : [];
  const from = list.indexOf(key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return list;
  list.splice(to, 0, list.splice(from, 1)[0]);
  return list;
};
// 構造ベースの冪等移行。旧inh:Nは互換用に残し、現在の配列対応を一度だけ安定ID側へ写す。
const migrateInheritedUniqueLevelIds = (masuMons, makeId = createInheritedUniqueId) => {
  let changed = false;
  const usedIds = new Set();
  const nextMasuMons = (Array.isArray(masuMons) ? masuMons : []).map(raw => {
    const inherited = Array.isArray(raw?.inheritedUniques) ? raw.inheritedUniques : [];
    const levels = raw?.uniqueSkillLevels && typeof raw.uniqueSkillLevels === 'object' ? { ...raw.uniqueSkillLevels } : {};
    let monsterChanged = false;
    const inheritedUniques = inherited.map((unique, index) => {
      if (!isValidInheritedUnique(unique)) return unique;
      let id = typeof unique.inheritedUniqueId === 'string' ? unique.inheritedUniqueId.trim() : '';
      if (!id || usedIds.has(id)) {
        do { id = String(makeId()); } while (!id || usedIds.has(id));
        monsterChanged = true;
      }
      usedIds.add(id);
      const nextUnique = id === unique.inheritedUniqueId ? unique : { ...unique, inheritedUniqueId:id };
      const stableKey = inheritedUniqueLevelKey(nextUnique);
      if (!Object.prototype.hasOwnProperty.call(levels, stableKey)) {
        levels[stableKey] = resolveInheritedUniqueLevel({ ...raw, uniqueSkillLevels:levels }, unique, index);
        monsterChanged = true;
      }
      return nextUnique;
    });
    if (!monsterChanged) return raw;
    changed = true;
    return { ...raw, inheritedUniques, uniqueSkillLevels:levels };
  });
  return { changed, nextMasuMons };
};
const appendInheritedUnique = (masu, unique, level, makeId = createInheritedUniqueId) => {
  const existingIds = new Set((Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : [])
    .map(entry => entry?.inheritedUniqueId).filter(Boolean));
  let inheritedUniqueId;
  do { inheritedUniqueId = String(makeId()); } while (!inheritedUniqueId || existingIds.has(inheritedUniqueId));
  const inheritedUnique = { ...unique, inheritedUniqueId };
  return {
    ...masu,
    inheritedUniques:[...(Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : []), inheritedUnique],
    uniqueSkillLevels:{
      ...(masu?.uniqueSkillLevels && typeof masu.uniqueSkillLevels === 'object' ? masu.uniqueSkillLevels : {}),
      [inheritedUniqueLevelKey(inheritedUnique)]:Math.max(0, Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.floor(Number(level) || 0))),
    },
  };
};
// 継承固有技は保存時点の技定義をスナップショットとして持つが、元種が分かる記録は
// 現在の定義へ追従させる。古い記録や削除済みの種は、保存済みスナップショットを使い続ける。
// evoLevel は個体の育成結果なので、定義を更新しても必ず保存値を維持する。
const resolveInheritedUniqueDefinition = (unique) => {
  if (!unique || typeof unique !== 'object') return unique || null;
  const monId = unique.monId;
  const latest = monId && typeof ALL_PLAYER_MONSTERS !== 'undefined'
    ? ALL_PLAYER_MONSTERS[monId]?.unique
    : null;
  if (!latest) return unique;
  return {
    ...latest,
    monId,
    ...(unique.lineageId != null ? { lineageId:unique.lineageId } : {}),
    ...(unique.inheritedUniqueId != null ? { inheritedUniqueId:unique.inheritedUniqueId } : {}),
    ...(unique.sourceMasuName != null ? { sourceMasuName:unique.sourceMasuName } : {}),
    evoLevel: unique.evoLevel,
  };
};
const uniqueSkillAtLevel = (unique, level = 0) => {
  if (!unique) return null;
  const definition = resolveInheritedUniqueDefinition(unique);
  const lvl = Math.max(0, Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.floor(Number(level) || 0)));
  const mult = definition.baseMult + lvl * 0.5;
  return {
    ...definition,
    name: definition.names?.[lvl] || definition.name,
    evoLevel: lvl,
    mult,
    guts: Math.floor(definition.baseGuts * (mult / definition.baseMult)),
    crit: 0.10 + 0.05 * lvl,
  };
};
// 継承固有技は、ラン内stateがまだ無い間もマスモンに保存された恒久Lvから始める。
// 0も有効なラン内値なので truthy 判定ではなく null/undefined のときだけ恒久Lvへ戻す。
const inheritedUniqueRunLevel = (unique, runLevel) => Math.max(0, Math.min(
  MAX_UNIQUE_SKILL_LEVEL,
  Math.floor(Number(runLevel != null ? runLevel : unique?.evoLevel) || 0),
));
// みゃるの薬系は進化するたび、データのdmgStepぶん自傷率が下がる。
// 表示と実戦処理で同じ計算を使い、進化後の説明と実効果がずれないようにする。
const myaruSelfDamageRate = (card, level = card?.evoLevel || 0) =>
  Math.max(0.1, card.selfDmg - level * card.dmgStep);
// 固有技の表示名は固有技Lvで変わるため、重複判定には技の出自を表す不変IDを使う。
// lineageId は今後データ側で明示でき、既存データは従来から保存されている monId へ安全にフォールバックする。
const uniqueLineageId = (unique, fallbackMonId = null) => unique?.lineageId || unique?.monId || fallbackMonId || null;
const normalizeInheritedUniqueLineages = (masuMons) => (Array.isArray(masuMons) ? masuMons : []).map(raw => {
  const masu = normalizeMasuProgression(raw);
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  const ownedLineages = new Set([uniqueLineageId(base?.unique, masu.baseId)].filter(Boolean));
  const kept = [];
  const keptLevels = [];
  (Array.isArray(masu.inheritedUniques) ? masu.inheritedUniques : []).forEach((unique, index) => {
    const lineageId = uniqueLineageId(unique);
    if (!lineageId || ownedLineages.has(lineageId)) return;
    const level = resolveInheritedUniqueLevel(masu, unique, index);
    const existingIndex = kept.findIndex(entry => uniqueLineageId(entry) === lineageId);
    if (existingIndex < 0) {
      kept.push({ ...unique, lineageId });
      keptLevels.push(level);
    } else if (level > keptLevels[existingIndex]) {
      kept[existingIndex] = { ...unique, lineageId };
      keptLevels[existingIndex] = level;
    }
  });
  const uniqueSkillLevels = { ...masu.uniqueSkillLevels };
  kept.forEach((unique, index) => {
    const key = inheritedUniqueLevelKey(unique);
    if (key && !Object.prototype.hasOwnProperty.call(uniqueSkillLevels, key)) uniqueSkillLevels[key] = keptLevels[index];
  });
  return { ...masu, inheritedUniques:kept, uniqueSkillLevels };
});
const totalBondXpForLevel = (level) => {
  let total = 0;
  for (let current = 1; current < Math.max(1, level); current++) total += xpForBondLevelAt(current);
  return total;
};
// 【限界突破と転生】
// 限界突破(旧「転生」): 上限に届いたらレベルはそのままで上限だけ +BREAKTHROUGH_LEVEL_CAP_GAIN する。
//   回数は rebirthCount に入れる。上限を上げた回数という意味は昔から変わらないので、
//   保存キーは変えない(名前だけ画面上で「限界突破」に改めた)。★の数がこの回数。
// 転生(新): 絆Lv REINCARNATE_MIN_LEVEL 以上で使える。レベルが REINCARNATE_LEVEL_DROP ぶん下がる
//   代わりに、振った強化をすべて振り直せる。回数は reincarnateCount(新しい項目)に入れ、
//   アイコンの「+N」で示す。
const MAX_MASU_LEVEL_CAP = 400;
// 限界突破でもらえる強化ポイント。初回(Lv30からの1回目)だけ多めにする
const BREAKTHROUGH_FIRST_POINTS = 5;
const BREAKTHROUGH_POINTS = 1;
const totalBreakthroughPoints = (count) => {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return n === 0 ? 0 : BREAKTHROUGH_FIRST_POINTS + BREAKTHROUGH_POINTS * (n - 1);
};
// ===== 限界突破の★ =====
// 5凸で1段階が完成し、次の段階では1個ずつ新しい色へ置き換わる(例: 6凸 = 黄1 + 青4)。
// 色は保存せず、保存してある rebirthCount から毎回組み立てる(表示用データを増やさない)。
// 「黄色」と「金」が見分けにくくならないよう、黄色は光沢を付けない素の黄色、
// 金は上が明るく下が暗い金属的な縁取りにして、色みも一段濃くしてある。
const BREAKTHROUGH_STARS_PER_TIER = 5;
const BREAKTHROUGH_STAR_TIERS = [
  { key:'blue',   label:'青', color:'#60a5fa', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #1d4ed8' },
  { key:'yellow', label:'黄色', color:'#fde047', shadow:'0 1px 2px rgba(0,0,0,.85)' },
  { key:'pink',   label:'ピンク', color:'#f472b6', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #db2777' },
  { key:'purple', label:'紫', color:'#c084fc', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #7e22ce' },
  { key:'red',    label:'赤', color:'#ef4444', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #991b1b' },
  { key:'gold',   label:'金', color:'#c88716', background:'linear-gradient(165deg,#fffdf0 3%,#f8e7a1 22%,#ffc83d 43%,#b66a08 70%,#fff0a8 86%,#7a3d05 100%)', shadow:'0 -1px 0 #fffbdc,0 1px 0 #5b2b03,0 0 5px rgba(255,174,24,.9)', stroke:'0.45px #6b3605' },
];
// 通常の限界突破で到達できる回数。段階数×5 = 30回で、そのときのレベル上限はLv.180
const BREAKTHROUGH_MAX_COUNT = BREAKTHROUGH_STAR_TIERS.length * BREAKTHROUGH_STARS_PER_TIER;
const BREAKTHROUGH_FINAL_LEVEL_CAP = INITIAL_MASU_LEVEL_CAP + BREAKTHROUGH_LEVEL_CAP_GAIN * BREAKTHROUGH_MAX_COUNT;
// 金★5のあと、虹★へ1個ずつ置き換わる5段階でLv.400へ到達する。
const FINAL_BREAKTHROUGH_COUNT = BREAKTHROUGH_MAX_COUNT + BREAKTHROUGH_STARS_PER_TIER;
const BREAKTHROUGH_LEVEL_CAPS = { 30:180, 31:200, 32:230, 33:270, 34:330, 35:400 };
const breakthroughLevelCap = (count) => {
  const n = Math.max(0, Math.min(FINAL_BREAKTHROUGH_COUNT, Math.floor(Number(count) || 0)));
  return n <= BREAKTHROUGH_MAX_COUNT
    ? INITIAL_MASU_LEVEL_CAP + n * BREAKTHROUGH_LEVEL_CAP_GAIN
    : BREAKTHROUGH_LEVEL_CAPS[n];
};
// 限界突破画面などの表示用。34凸でLv270→330帯が×2、35凸でLv330→400帯が×3になる。
// 実際の付与量は現在の凸数ではなく、下の「到達レベル帯」の共通関数を正本にする。
const levelUpPointMultiplier = (rebirthCount) => {
  const n = Math.max(0, Math.floor(Number(rebirthCount) || 0));
  return n >= 35 ? 3 : n >= 34 ? 2 : 1;
};
const ENHANCE_POINT_DOUBLE_LEVEL = 270;
const ENHANCE_POINT_TRIPLE_LEVEL = 330;
// 「そのレベルへ上がる1回」で得る通常強化ポイント。
// Lv2〜270は1、Lv271〜330は2、Lv331〜400は3。Lv401以降は超越ポイントの領域。
const levelEnhancePointMultiplier = (reachedLevel) => {
  const level = Math.max(1, Math.floor(Number(reachedLevel) || 1));
  return level > ENHANCE_POINT_TRIPLE_LEVEL ? 3 : level > ENHANCE_POINT_DOUBLE_LEVEL ? 2 : 1;
};
// 現在レベルまでに「レベル由来」で得ているべき通常強化ポイントの総数。
// 重要: 34/35凸になったからといって、過去のLv1〜270へ×2/×3を遡及適用しない。
const levelBasedEnhancePoints = (level) => {
  const capped = Math.max(1, Math.min(MAX_MASU_LEVEL_CAP, Math.floor(Number(level) || 1)));
  const single = Math.max(0, Math.min(capped, ENHANCE_POINT_DOUBLE_LEVEL) - 1);
  const doubled = Math.max(0, Math.min(capped, ENHANCE_POINT_TRIPLE_LEVEL) - ENHANCE_POINT_DOUBLE_LEVEL) * 2;
  const tripled = Math.max(0, capped - ENHANCE_POINT_TRIPLE_LEVEL) * 3;
  return single + doubled + tripled;
};
// バトル・チケット・合体などで複数レベルを一度にまたいでも、帯ごとの差分を正確に付与する。
const gainedEnhancePointsBetweenLevels = (beforeLevel, afterLevel) =>
  Math.max(0, levelBasedEnhancePoints(afterLevel) - levelBasedEnhancePoints(beforeLevel));
// 2026-08-29の不具合版(#827)が起動時補填に使ってしまった誤式。
// 既存セーブの「その不具合で増えた分だけ」を安全に特定して戻すために、移行処理からのみ使う。
const legacyRetroactiveLevelBasedEnhancePoints = (level, rebirthCount) =>
  Math.max(0, Math.min(MAX_MASU_LEVEL_CAP, Math.floor(Number(level) || 0)) - 1)
    * levelUpPointMultiplier(rebirthCount);
const RAINBOW_STAR_IMAGE = 'images/ui/breakthrough-rainbow-star.PNG';
// 凸数から★の並びを作る。新しい色を先頭に、残りは1つ前の段階の色で埋める
const breakthroughStars = (count) => {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return [];
  // 31～35凸は、完成済みの虹★で金★を先頭から1個ずつ置き換える。
  if (n > BREAKTHROUGH_MAX_COUNT) {
    const rainbowCount = Math.min(BREAKTHROUGH_STARS_PER_TIER, n - BREAKTHROUGH_MAX_COUNT);
    const rainbow = Array.from({ length:rainbowCount }, () => ({ key:'rainbow', image:RAINBOW_STAR_IMAGE }));
    const gold = BREAKTHROUGH_STAR_TIERS[BREAKTHROUGH_STAR_TIERS.length - 1];
    return rainbow.concat(Array.from({ length:BREAKTHROUGH_STARS_PER_TIER - rainbowCount }, () => gold));
  }
  const capped = Math.min(n, BREAKTHROUGH_MAX_COUNT);
  const tierIndex = Math.floor((capped - 1) / BREAKTHROUGH_STARS_PER_TIER);
  const filled = ((capped - 1) % BREAKTHROUGH_STARS_PER_TIER) + 1;
  const tier = BREAKTHROUGH_STAR_TIERS[tierIndex];
  const prev = tierIndex > 0 ? BREAKTHROUGH_STAR_TIERS[tierIndex - 1] : null;
  const stars = Array.from({ length: filled }, () => tier);
  // 1段階目(青)だけは前の色が無いので、5個に満たないまま出す
  if (prev) for (let i = filled; i < BREAKTHROUGH_STARS_PER_TIER; i++) stars.push(prev);
  return stars;
};
const isFinalBreakthroughCount = (count) => Math.max(0, Math.floor(Number(count) || 0)) >= FINAL_BREAKTHROUGH_COUNT;
const breakthroughStarStyle = (star) => ({
  color:star.color,
  textShadow:star.shadow,
  backgroundImage:star.background,
  WebkitBackgroundClip:star.background?'text':undefined,
  backgroundClip:star.background?'text':undefined,
  WebkitTextFillColor:star.background?'transparent':undefined,
  WebkitTextStroke:star.stroke,
});
// ===== 限界突破に使うアイテム「虹のプシュケー」 =====
// 所持数は他の消耗アイテムと同じ mh_owned_items({ itemId: 個数 })へ入れる。
// 新しい保存キーは作らないので、持っていない旧セーブは「0個」として読める。
// 必要数は限界突破1回ごとに増える。1回目5個・以降+1個で、
//   30回目 = 5 + 29×1 = 34個 / 最終限界突破(31回目) = 5 + 30×1 = 35個
const BREAKTHROUGH_ITEM_ID = 'rainbow_psyche';
// 超越ポイントリセットの書。マーケット(data/breeder.js)の同じIDを指す
const TRANSCEND_RESET_ITEM_ID = 'transcend_reset_scroll';
const BREAKTHROUGH_ITEM_BASE = 5;
const BREAKTHROUGH_ITEM_STEP = 1;
// nextCount は「これから行う限界突破が何回目か」(rebirthCount + 1)
const breakthroughItemCost = (nextCount) => {
  const n = Math.max(1, Math.floor(Number(nextCount) || 1));
  return BREAKTHROUGH_ITEM_BASE + (n - 1) * BREAKTHROUGH_ITEM_STEP;
};
// 合体XPを全量受け取るための限界突破を、既存の上限上昇・費用式だけでまとめて試算する。
// 合体確定時にも同じ結果を使い、表示と実際の消費がずれないようにする。
const buildFusionBreakthroughPlan = ({ masu, fusionXp = 0, gold = 0, psycheOwned = 0 }) => {
  const normalized = normalizeMasuProgression(masu);
  const beforeXp = cappedBondXp(normalized);
  const gain = Math.max(0, Math.floor(Number(fusionXp) || 0));
  const uncappedXp = beforeXp + gain;
  const plannedLevel = bondLevelInfo(uncappedXp).level;
  let levelCap = normalized.levelCap;
  let rebirthCount = normalized.rebirthCount;
  let psycheCost = 0;
  let diamondCost = 0;
  const diamondCosts = [];
  let gainedPoints = 0;
  while (plannedLevel > levelCap && levelCap < MAX_MASU_LEVEL_CAP) {
    rebirthCount += 1;
    psycheCost += breakthroughItemCost(rebirthCount);
    const nextDiamondCost = masuRebirthCost(levelCap);
    diamondCost += nextDiamondCost;
    diamondCosts.push(nextDiamondCost);
    gainedPoints += rebirthCount === 1 ? BREAKTHROUGH_FIRST_POINTS : BREAKTHROUGH_POINTS;
    levelCap = breakthroughLevelCap(rebirthCount);
  }
  const count = rebirthCount - normalized.rebirthCount;
  const psycheHave = ownedItemCount({ [BREAKTHROUGH_ITEM_ID]:psycheOwned }, BREAKTHROUGH_ITEM_ID);
  const goldHave = donationDiamondValue(gold);
  return {
    count, plannedLevel, levelCap, rebirthCount, psycheCost, diamondCost, diamondCosts, gainedPoints,
    psycheHave, goldHave,
    psycheShortage:Math.max(0, psycheCost - psycheHave),
    diamondShortage:Math.max(0, diamondCost - goldHave),
    canReceiveAll:plannedLevel <= levelCap,
    canAfford:plannedLevel <= levelCap && psycheHave >= psycheCost && goldHave >= diamondCost,
    nextPsyche:psycheHave - psycheCost,
    nextGold:goldHave - diamondCost,
    nextMasu:{
      ...normalized,
      levelCap,
      rebirthCount,
      distAptPoints:Math.max(0, Math.floor(Number(normalized.distAptPoints) || 0)) + gainedPoints,
      // まとめて突破するときは従来の「あとで決める」と同じく、固有技ポイントを保持する。
      uniqueSkillPoints:Math.max(0, Math.floor(Number(normalized.uniqueSkillPoints) || 0)) + count,
    },
  };
};
const ownedItemCount = (ownedItems, itemId) => Math.max(0, Math.floor(Number(ownedItems?.[itemId]) || 0));
// ===== 超越の実（種族チャレンジ報酬の所持データ基盤） =====
// 「種族」はモンスター1体ではなく主血統(モッチー種・ピクシー種…)を指す。
// 血統idを itemId の末尾へそのまま保持し、表示名の変更に影響されないようにする。
// data/lineages.js から生成するため、モンスター追加時に個別定義を足す必要はない。
const SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX = 'transcend_fruit_species_';
const RAINBOW_TRANSCEND_FRUIT_ITEM_ID = 'transcend_fruit_rainbow';
// 実際に登場する主血統だけを対象にする(プレイアブルモンスターがいない血統は作らない)。
// dexMainLineages はこのファイルの後ろで定義されるので、モジュール読み込み時ではなく
// 最初に必要になったときに作る。ここで即座に呼ぶと
// 「Cannot access 'dexMainLineages' before initialization」で画面が真っ白になる
const speciesChallengeLineages = () => dexMainLineages();
let _speciesTranscendFruitItems = null;
const speciesTranscendFruitItems = () => {
  if (!_speciesTranscendFruitItems) {
    _speciesTranscendFruitItems = Object.freeze(Object.fromEntries(
      speciesChallengeLineages().map(lineage => [lineage.id, Object.freeze({
        id:`${SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX}${lineage.id}`,
        name:`超越の実（${lineage.name}種）`,
        lineageId:lineage.id,
        // アイテム欄(ITEM_INVENTORY)に並べるための見た目。マーケットでは売らない
        // (種族チャレンジの初回クリア報酬でしか増えない)ので、BREEDER_MARKET_ITEMSには
        // 登録しない。usage:'transcendFruit' で「使う」ボタンの代わりに使う場所を案内する
        emoji:'🍇',
        usage:'transcendFruit',
        desc:`${lineage.name}種のマスモンに使える。1個で超越ポイント+1。マスモン詳細の「超越強化」から使う。`,
      })])
    ));
  }
  return _speciesTranscendFruitItems;
};
// 【後方互換】種族をモンスター1体単位で作っていたころの実(transcend_fruit_species_Mocchi 等)。
// もう配らないが、すでに持っている人の所持品を無効にしないため、使う側では受け付ける。
// 対応する血統のマスモンへ、新しい実と同じように使える。
const LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS = Object.freeze(Object.fromEntries(
  Object.keys(typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS : {}).map(baseId => [baseId, Object.freeze({
    id:`${SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX}${baseId}`,
    baseId,
  })])
));
const legacySpeciesTranscendFruitItemId = (baseId) => (
  typeof baseId === 'string' && Object.hasOwn(LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS, baseId)
    ? LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS[baseId].id
    : null
);
// 旧実は「モンスター1体ぶん」だが、いまの種族は主血統なので、同じ血統のマスモンへ広く使えるようにする。
// (ミタラシの旧実をモッチーのマスモンへ使う、など)。所持しているのに使い道が無い状態を作らないための後方互換で、
// 実の中身を書き換えたり別のidへ変換したりはしない(所持数はそのまま、消費するときだけ減る)。
// monsterLineageOf はこのファイルの後ろで定義されるので、呼ばれたときに解決する
const legacySpeciesTranscendFruitsForLineage = (baseId) => {
  const lineageId = typeof baseId === 'string' ? monsterLineageOf(baseId).main.id : null;
  if (!lineageId) return [];
  return Object.values(LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS)
    .filter(item => monsterLineageOf(item.baseId).main.id === lineageId);
};
const legacySpeciesTranscendFruitIdsForLineage = (baseId) => legacySpeciesTranscendFruitsForLineage(baseId).map(item => item.id);
const RAINBOW_TRANSCEND_FRUIT_ITEM = Object.freeze({ id:RAINBOW_TRANSCEND_FRUIT_ITEM_ID, name:'虹の超越の実', lineageId:null });
// 既存の虹の超越の実IDをそのままMARKET商品へ接続する。通貨は通常の虹ではないプシュケー。
BREEDER_MARKET_ITEMS.push({
  id:RAINBOW_TRANSCEND_FRUIT_ITEM_ID, name:RAINBOW_TRANSCEND_FRUIT_ITEM.name, type:'item', emoji:'🌈',
  cost:1000, currency:'psyche', usage:'transcendFruit',
  desc:'どの種族のマスモンにも使える。1個で超越ポイント+1',
});
// 実のidかどうかの判定も、種族の一覧と同じく最初に必要になったときに作る
let _transcendFruitItemIds = null;
const transcendFruitItemIds = () => {
  if (!_transcendFruitItemIds) {
    _transcendFruitItemIds = new Set([
      RAINBOW_TRANSCEND_FRUIT_ITEM_ID,
      ...Object.values(speciesTranscendFruitItems()).map(item => item.id),
      // すでに配ってしまった個体単位の実も、所持数を読める対象として残す
      ...Object.values(LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS).map(item => item.id),
    ]);
  }
  return _transcendFruitItemIds;
};
// 種族(主血統)idから実のidを引く
const speciesTranscendFruitItemId = (speciesId) => {
  const items = speciesTranscendFruitItems();
  return typeof speciesId === 'string' && Object.hasOwn(items, speciesId) ? items[speciesId].id : null;
};
// マスモン(個体)から、その子に使える種族の実のidを引く。baseId→主血統を経由する
const masuSpeciesTranscendFruitItemId = (baseId) => speciesTranscendFruitItemId(
  typeof baseId === 'string' ? monsterLineageOf(baseId).main.id : null
);
const transcendFruitOwnedCount = (ownedItems, itemId) => (
  transcendFruitItemIds().has(itemId) ? ownedItemCount(ownedItems, itemId) : 0
);
const changeTranscendFruitOwnedCount = (ownedItems, itemId, amount) => {
  const current = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const n = Number(amount);
  if (!transcendFruitItemIds().has(itemId) || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { ok:false, ownedItems:current };
  return { ok:true, ownedItems:{ ...current, [itemId]:transcendFruitOwnedCount(current, itemId) + n } };
};
const consumeTranscendFruit = (ownedItems, itemId, amount) => {
  const current = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const n = Number(amount);
  const have = transcendFruitOwnedCount(current, itemId);
  if (!transcendFruitItemIds().has(itemId) || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || have < n) return { ok:false, ownedItems:current };
  return { ok:true, ownedItems:{ ...current, [itemId]:have - n } };
};
// 使用する実は呼び出し側が明示する。種族別の実が合わない場合に虹の実へ代用しない。
// 種族の実はその子の主血統のもの。個体単位で配っていたころの実も、同じ子へは使える
const useTranscendFruitOnMasu = (masu, ownedItems, itemId, amount) => {
  const currentItems = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const n = Number(amount);
  const speciesItemId = masuSpeciesTranscendFruitItemId(masu?.baseId);
  const legacyItemIds = legacySpeciesTranscendFruitIdsForLineage(masu?.baseId);
  const itemMatches = itemId === RAINBOW_TRANSCEND_FRUIT_ITEM_ID
    || (speciesItemId !== null && itemId === speciesItemId)
    || legacyItemIds.includes(itemId);
  if (!masu || typeof masu !== 'object' || Array.isArray(masu) || !itemMatches
    || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { ok:false, nextMasu:masu, nextOwnedItems:currentItems };
  }
  const consumed = consumeTranscendFruit(currentItems, itemId, n);
  if (!consumed.ok) return { ok:false, nextMasu:masu, nextOwnedItems:currentItems };
  return {
    ok:true,
    nextMasu:{ ...masu, transcendPoints:Math.max(0, Math.floor(Number(masu.transcendPoints) || 0)) + n },
    nextOwnedItems:consumed.ownedItems,
  };
};
// storeSet は保存先側の失敗を返さないことがあるため、2キーとも再読込してから成功とする。
// 片方でも期待値と違えば、消費前の組を両方へ書き戻して中途半端な保存を残さない。
const saveTranscendFruitPair = async (beforeMasuMons, beforeOwnedItems, nextMasuMons, nextOwnedItems, getValue, setValue) => {
  const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  try {
    await Promise.all([
      setValue('mh_masu_mons', nextMasuMons, false),
      setValue('mh_owned_items', nextOwnedItems, false),
    ]);
    const [savedMasuMons, savedOwnedItems] = await Promise.all([
      getValue('mh_masu_mons', null, false),
      getValue('mh_owned_items', null, false),
    ]);
    if (same(savedMasuMons, nextMasuMons) && same(savedOwnedItems, nextOwnedItems)) return true;
  } catch { /* rollback below */ }
  await Promise.allSettled([
    setValue('mh_masu_mons', beforeMasuMons, false),
    setValue('mh_owned_items', beforeOwnedItems, false),
  ]);
  return false;
};
const buildMarketItemPurchase = ({ item, gold=0, breederPoints=0, ownedItems={}, quantity=1 } = {}) => {
  const purchaseQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const unitCost = Math.max(0, Math.floor(Number(item?.cost) || 0));
  const cost = unitCost * purchaseQuantity;
  const currency = item?.currency === 'psyche' ? 'psyche'
    : (item?.type === 'disc' || item?.type === 'assist' || item?.type === 'item') ? 'diamond' : 'breederPoint';
  const balances = { diamond:Math.max(0, Math.floor(Number(gold) || 0)), breederPoint:Math.max(0, Math.floor(Number(breederPoints) || 0)), psyche:ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID) };
  if (!item || item.available === false || balances[currency] < cost) return { ok:false, currency, cost, gold:balances.diamond, breederPoints:balances.breederPoint, ownedItems };
  const nextItems = item.type === 'item' ? { ...ownedItems, [item.id]:ownedItemCount(ownedItems, item.id) + purchaseQuantity } : ownedItems;
  if (currency === 'psyche') nextItems[BREAKTHROUGH_ITEM_ID] = balances.psyche - cost;
  return { ok:true, currency, cost, quantity:purchaseQuantity, gold:currency === 'diamond' ? balances.diamond-cost : balances.diamond, breederPoints:currency === 'breederPoint' ? balances.breederPoint-cost : balances.breederPoint, ownedItems:nextItems };
};
const saveMarketBalances = async (beforeGold, beforeItems, nextGold, nextItems, getValue, setValue) => {
  const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  try {
    await Promise.all([setValue('mh_gold', nextGold, false), setValue('mh_owned_items', nextItems, false)]);
    const [savedGold, savedItems] = await Promise.all([getValue('mh_gold', null, false), getValue('mh_owned_items', null, false)]);
    if (same(savedGold, nextGold) && same(savedItems, nextItems)) return true;
  } catch { /* rollback below */ }
  await Promise.allSettled([setValue('mh_gold', beforeGold, false), setValue('mh_owned_items', beforeItems, false)]);
  return false;
};
const REINCARNATE_MIN_LEVEL = 100;
const REINCARNATE_LEVEL_DROP = 99;
const REINCARNATE_POINTS = 10;
const totalReincarnatePoints = (count) => Math.max(0, Math.floor(Number(count) || 0)) * REINCARNATE_POINTS;
// 転生で実際に得た強化ポイントを回数とは別に保存する。旧個体だけは当時の確定値
// (回数×10)へフォールバックし、以後は報酬量が変わっても保存済みの価値を再計算しない。
const ownReincarnateBonusPoints = (masu) => Number.isFinite(Number(masu?.reincarnateBonusPoints))
  ? Math.max(0, Math.floor(Number(masu.reincarnateBonusPoints)))
  : totalReincarnatePoints(masu?.reincarnateCount);
const inheritedReincarnateBonusPointsOf = (masu) => Math.max(0, Math.floor(Number(masu?.inheritedReincarnateBonusPoints) || 0));
const inheritedReincarnateCountOf = (masu) => Math.max(0, Math.floor(Number(masu?.inheritedReincarnateCount) || 0));
const transferableReincarnateBonus = (masu) => ({
  points: ownReincarnateBonusPoints(masu) + inheritedReincarnateBonusPointsOf(masu),
  count: Math.max(0, Math.floor(Number(masu?.reincarnateCount) || 0)) + inheritedReincarnateCountOf(masu),
});
const normalizeMasuProgression = (masu) => ({
  ...masu,
  // 旧booleanは曖昧な上限へ移行せずOFF。数値設定だけを正本として読む。
  autoRepeatBreakthroughLevel: normalizeAutoRepeatBreakthroughLevel(masu?.autoRepeatBreakthroughLevel),
  rebirthCount: Math.max(0, Math.floor(Number(masu?.rebirthCount) || 0)),
  // 転生回数は後から足した項目なので、持っていない既存データは0として扱う
  reincarnateCount: Math.max(0, Math.floor(Number(masu?.reincarnateCount) || 0)),
  reincarnateBonusPoints: ownReincarnateBonusPoints(masu),
  inheritedReincarnateBonusPoints: inheritedReincarnateBonusPointsOf(masu),
  inheritedReincarnateCount: inheritedReincarnateCountOf(masu),
  levelCap: Math.min(masuLevelCapLimit(masu), Math.max(INITIAL_MASU_LEVEL_CAP, Math.floor(Number(masu?.levelCap) || INITIAL_MASU_LEVEL_CAP))),
  // 超越の項目。旧セーブには存在しないので、未超越・0として読む(移行処理はいらない)
  transcended: isTranscended(masu),
  transcendPoints: Math.max(0, Math.floor(Number(masu?.transcendPoints) || 0)),
  transcendStatPoints: normalizeTranscendStatPoints(masu?.transcendStatPoints),
  transcendAptBoosts: normalizeTranscendAptBoosts(masu?.transcendAptBoosts),
  uniqueSkillLevels: masu?.uniqueSkillLevels && typeof masu.uniqueSkillLevels === 'object' ? { ...masu.uniqueSkillLevels } : {},
  // 未使用の固有技ポイント。限界突破・転生でその場に上げなかったぶんをここへ貯めておき、
  // マスモンの詳細からいつでも使える。後から足した項目なので、持っていない既存データは0
  uniqueSkillPoints: Math.max(0, Math.floor(Number(masu?.uniqueSkillPoints) || 0)),
});
const buildAutoRepeatBreakthroughUpdate = (masu, level) => ({
  ...masu,
  autoRepeatBreakthroughLevel: normalizeAutoRepeatBreakthroughLevel(level),
});
// 固有技ポイントの仮配分を検証して反映した個体を返す。UI操作中は呼ばず、確定時だけ保存へ渡す。
const applyUniqueSkillPointPlan = (masu, plan, allowedSkillKeys) => {
  const normalized = normalizeMasuProgression(masu);
  if (!plan || typeof plan !== 'object' || !Array.isArray(allowedSkillKeys)) return null;
  const allowed = new Set(allowedSkillKeys.map(String));
  const allocations = {};
  let total = 0;
  for (const [rawKey, rawAmount] of Object.entries(plan)) {
    const key = String(rawKey);
    const amount = Math.max(0, Math.floor(Number(rawAmount) || 0));
    if (!allowed.has(key) || amount <= 0) continue;
    const current = Math.max(0, Math.floor(Number(normalized.uniqueSkillLevels[key]) || 0));
    if (current + amount > MAX_UNIQUE_SKILL_LEVEL) return null;
    allocations[key] = amount;
    total += amount;
  }
  if (total <= 0 || total > normalized.uniqueSkillPoints) return null;
  const uniqueSkillLevels = { ...normalized.uniqueSkillLevels };
  Object.entries(allocations).forEach(([key, amount]) => { uniqueSkillLevels[key] = Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.max(0, Math.floor(Number(uniqueSkillLevels[key]) || 0)) + amount); });
  return { ...normalized, uniqueSkillLevels, uniqueSkillPoints: normalized.uniqueSkillPoints - total };
};
// 固有技へ配分済みのポイントだけを未使用へ戻す。個体のほかの育成情報はスプレッドでそのまま維持する。
const buildUniqueSkillPointReset = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  const refundedPoints = Object.entries(normalized.uniqueSkillLevels)
    .reduce((sum, [key, level]) => {
      const legacyMatch = /^inh:(\d+)$/.exec(key);
      const stableShadowExists = legacyMatch && inheritedUniqueLevelKey(normalized.inheritedUniques?.[Number(legacyMatch[1])])
        && Object.prototype.hasOwnProperty.call(normalized.uniqueSkillLevels, inheritedUniqueLevelKey(normalized.inheritedUniques[Number(legacyMatch[1])]));
      return sum + (stableShadowExists ? 0 : Math.max(0, Math.floor(Number(level) || 0)));
    }, 0);
  if (refundedPoints <= 0) return null;
  return {
    refundedPoints,
    nextMasu: {
      ...normalized,
      uniqueSkillLevels: Object.fromEntries(Object.keys(normalized.uniqueSkillLevels).map(key => [key, 0])),
      uniqueSkillPoints: normalized.uniqueSkillPoints + refundedPoints,
    },
  };
};
// 転生では個体の識別情報・外見・固有技・履歴だけを残し、振った強化は白紙に戻す。
// オブジェクトスプレッドで旧育成値を残さないよう、維持対象を明示して新しい保存形を組み立てる。
// toLevel を渡すとそのレベル相当の絆経験値から再開する(渡さなければLv1へ戻す)。
const resetMasuForRebirth = (masu, { rebirthCount, reincarnateCount, reincarnateBonusPoints, levelCap, uniqueSkillLevels, uniqueSkillPoints, toLevel, distAptPoints } = {}) => {
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu?.baseId] : null;
  const reset = {
    id: masu?.id,
    baseId: masu?.baseId,
    name: masu?.name,
    bondXp: totalBondXpForLevel(Math.max(1, Math.floor(Number(toLevel) || 1))),
    distAptPoints: Math.max(0, Math.floor(Number(distAptPoints ?? 5) || 0)),
    distApt: [...(base?.distAptitude || ['C','C','C','C'])],
    statPoints: { hp:0, atk:0, def:0, guts:0 },
    createdAt: masu?.createdAt,
    rebirthCount: Math.max(0, Math.floor(Number(rebirthCount ?? masu?.rebirthCount) || 0)),
    reincarnateCount: Math.max(0, Math.floor(Number(reincarnateCount ?? masu?.reincarnateCount) || 0)),
    reincarnateBonusPoints: Math.max(0, Math.floor(Number(reincarnateBonusPoints ?? ownReincarnateBonusPoints(masu)) || 0)),
    inheritedReincarnateBonusPoints: inheritedReincarnateBonusPointsOf(masu),
    inheritedReincarnateCount: inheritedReincarnateCountOf(masu),
    levelCap: Math.min(masuLevelCapLimit(masu), Math.max(INITIAL_MASU_LEVEL_CAP, Math.floor(Number(levelCap ?? masu?.levelCap) || INITIAL_MASU_LEVEL_CAP))),
    // 超越は転生で失われない。状態・未使用の超越P・超越で上げた基礎値をそのまま持ち越す
    transcended: isTranscended(masu),
    transcendPoints: Math.max(0, Math.floor(Number(masu?.transcendPoints) || 0)),
    transcendStatPoints: normalizeTranscendStatPoints(masu?.transcendStatPoints),
    transcendAptBoosts: normalizeTranscendAptBoosts(masu?.transcendAptBoosts),
    uniqueSkillLevels: { ...(uniqueSkillLevels ?? masu?.uniqueSkillLevels ?? {}) },
    // 固有技のレベルは転生でも残るので、未使用のぶんもそのまま持ち越す
    uniqueSkillPoints: Math.max(0, Math.floor(Number(uniqueSkillPoints ?? masu?.uniqueSkillPoints) || 0)),
  };
  if (Array.isArray(masu?.colors)) reset.colors = [...masu.colors];
  else if (masu?.color != null) reset.color = masu.color;
  if (Array.isArray(masu?.inheritedUniques)) reset.inheritedUniques = masu.inheritedUniques.map(unique => ({ ...unique }));
  if (Array.isArray(masu?.fusionHistory)) reset.fusionHistory = masu.fusionHistory.map(entry => ({ ...entry }));
  if (masu?.individualStats && typeof masu.individualStats === 'object') reset.individualStats = { ...masu.individualStats };
  if (masu?.individualStatOffsets && typeof masu.individualStatOffsets === 'object') reset.individualStatOffsets = { ...masu.individualStatOffsets };
  if (Array.isArray(masu?.distAptBoosts)) reset.distAptBoosts = [0,0,0,0];
  return reset;
};
const migrateRebornMasuToFullReset = (masuMons) => (Array.isArray(masuMons) ? masuMons : []).map(raw => {
  const masu = normalizeMasuProgression(raw);
  return masu.rebirthCount > 0 ? resetMasuForRebirth(masu) : masu;
});
const cappedBondXp = (masu, gain = 0, maxLevel = null) => {
  const normalized = normalizeMasuProgression(masu);
  const currentXp = donationDiamondValue(normalized.bondXp);
  const requestedMaxLevel = maxLevel != null && Number.isFinite(Number(maxLevel))
    ? Math.max(1, Math.floor(Number(maxLevel))) : normalized.levelCap;
  const effectiveLevelCap = Math.min(normalized.levelCap, requestedMaxLevel);
  const cappedXp = Math.min(totalBondXpForLevel(effectiveLevelCap), currentXp + Math.max(0, Math.floor(Number(gain) || 0)));
  // AUTO∞など呼び出し側が一時的な上限を渡したとき、既存XPがその上限を超えていても巻き戻さない。
  // maxLevelを省略する通常報酬・チケット・合体は、従来どおり個体levelCapだけで頭打ちにする。
  return maxLevel == null ? cappedXp : Math.max(currentXp, cappedXp);
};
// 絆経験値の加算・レベル上限・強化ポイント付与を、通常バトル、チケット、合体で共有する。
// 戻り値に表示用の前後レベルと実際の付与量も含め、画面と保存値の計算がずれないようにする。
const applyBondXpGain = (masu, gain = 0, maxLevel = null) => {
  const before = masuBondLevelInfo(masu);
  const bondXp = cappedBondXp(masu, gain, maxLevel);
  const after = bondLevelInfo(bondXp);
  const gainedLevels = Math.max(0, after.level - before.level);
  // Lv400までは今までどおり通常の強化ポイント。Lv401以降(超越の領域)は
  // 通常ポイントを配らず、1レベルにつき超越ポイントを1だけ配る。
  // 400をまたいでレベルが上がったときも、400までのぶんと401以降のぶんを分けて数える。
  const cap = MAX_MASU_LEVEL_CAP;
  const normalLevels = Math.max(0, Math.min(cap, after.level) - Math.min(cap, before.level));
  const gainedTranscendPoints = Math.max(0, after.level - Math.max(cap, before.level));
  const gainedPoints = gainedEnhancePointsBetweenLevels(before.level, Math.min(cap, after.level));
  // 同一帯だけを上がった場合は従来UI用に×2/×3を返す。帯をまたぐ場合は誤解を避けて×表示を出さない。
  const sameBandMultiplier = normalLevels > 0 ? (gainedPoints / normalLevels) : 1;
  const pointMultiplier = Number.isInteger(sameBandMultiplier) ? sameBandMultiplier : 1;
  return {
    masu: {
      ...masu,
      bondXp,
      distAptPoints: (masu.distAptPoints || 0) + gainedPoints,
      ...(gainedTranscendPoints > 0
        ? { transcendPoints: Math.max(0, Math.floor(Number(masu.transcendPoints) || 0)) + gainedTranscendPoints }
        : {}),
    },
    before,
    after,
    gainedLevels,
    gainedPoints,
    gainedTranscendPoints,
    pointMultiplier,
    xpGain: Math.max(0, bondXp - donationDiamondValue(masu.bondXp)),
  };
};
// 周回終了時の絆経験値配布先を、表示処理やReact state更新から独立して一度だけ決定する。
// 優先順位は勇者モン(100%) > バトル参加マスモン(50%) > 編成内の控え(25%)。
// 同じ個体が複数枠に現れてもSetでまとめ、上位区分と下位区分の重複付与を防ぐ。
const buildRunBondAwards = ({ gain, heroMasuId, participantMasuIds, monsterRosterIds, masuMons }) => {
  const fullGain = Math.max(0, Math.floor(Number(gain) || 0));
  if (fullGain <= 0) return [];
  const ownedBondIds = new Set((Array.isArray(masuMons) ? masuMons : [])
    .filter(masu => masu && masu.id != null && Object.prototype.hasOwnProperty.call(masu, 'bondXp'))
    .map(masu => String(masu.id)));
  const heroId = heroMasuId != null && ownedBondIds.has(String(heroMasuId)) ? String(heroMasuId) : null;
  const participantIds = new Set((Array.isArray(participantMasuIds) ? participantMasuIds : [])
    .filter(id => id != null && ownedBondIds.has(String(id)) && String(id) !== heroId)
    .map(String));
  const rosterIds = new Set((Array.isArray(monsterRosterIds) ? monsterRosterIds : [])
    .filter(entry => typeof entry === 'string' && entry.startsWith('masu:'))
    .map(entry => entry.slice(5))
    .filter(id => ownedBondIds.has(String(id))));
  const awards = [];
  if (heroId) awards.push({ masuId:heroId, gain:fullGain, rate:1, showInResult:true });
  participantIds.forEach(masuId => awards.push({ masuId, gain:Math.max(1, Math.floor(fullGain / 2)), rate:0.5, showInResult:true }));
  rosterIds.forEach(masuId => {
    if (masuId === heroId || participantIds.has(masuId)) return;
    awards.push({ masuId, gain:Math.max(1, Math.floor(fullGain / 4)), rate:0.25, showInResult:false });
  });
  return awards;
};
const masuBondLevelInfo = (masu) => bondLevelInfo(cappedBondXp(masu));
// 旧セーブは単色の color を持っている。染色もどきの部位別対応より前に染めた分を染色①へ読み替える
const getMasuColors = (masu) => (masu && masu.colors) || (masu && masu.color ? [masu.color] : []);
// マスモンの個体基礎値を新旧どちらの保存形式からも解決する。
// 新形式があれば最新ベースへ差分を足し、無ければ完成値保存の individualStats をそのまま優先する。
// 超越で上げた基礎値は、種のベースデータも individualStats も書き換えず、
// 別項目(transcendStatPoints)として持ったまま「解決するとき」にだけ足す。
// こうしておくと、何が超越由来かが最後まで分かり、通常強化ぶん(statPoints)とも混ざらない。
const resolveMasuIndividualStats = (masu, base) => {
  const transcend = normalizeTranscendStatPoints(masu?.transcendStatPoints);
  const offsets = masu?.individualStatOffsets;
  if (offsets && typeof offsets === 'object' && !Array.isArray(offsets)) {
    const offset = (key) => Number.isFinite(Number(offsets[key])) ? Number(offsets[key]) : 0;
    return {
      hp: base.baseHp + offset('hp') + transcend.hp, atk: base.baseAtk + offset('atk') + transcend.atk,
      def: base.baseDef + offset('def') + transcend.def, guts: base.baseGuts + offset('guts') + transcend.guts,
    };
  }
  return {
    hp: (masu?.individualStats?.hp ?? base.baseHp) + transcend.hp,
    atk: (masu?.individualStats?.atk ?? base.baseAtk) + transcend.atk,
    def: (masu?.individualStats?.def ?? base.baseDef) + transcend.def,
    guts: (masu?.individualStats?.guts ?? base.baseGuts) + transcend.guts,
  };
};
// 間合い適性の段階。ここより下(個体値の解決・超越の基礎適性)から使うので、宣言をこの位置に置く。
const DIST_APTITUDE_GRADES = ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'];
// 間合い適性も同様に、新形式の上昇段階数を最新ベースへ適用する。各値は0以上の整数としMで止める。
const raiseAptitudeGrade = (grade, steps) => {
  const current = Math.max(0, DIST_APTITUDE_GRADES.indexOf(grade));
  const up = Math.max(0, Math.floor(Number(steps) || 0));
  return DIST_APTITUDE_GRADES[Math.min(DIST_APTITUDE_GRADES.length - 1, current + up)];
};
// 超越で上げた「基礎」側の間合い適性。通常の強化ポイントで上げたぶんはこの上へ乗る。
// 段階の上限は既存どおりMで、それ以上へは上がらない。
const masuTranscendBaseAptitude = (masu, base) => {
  const baseApt = Array.isArray(base?.distAptitude) ? base.distAptitude.slice(0, 4) : ['C','C','C','C'];
  const boosts = normalizeTranscendAptBoosts(masu?.transcendAptBoosts);
  return baseApt.map((grade, index) => raiseAptitudeGrade(grade, boosts[index]));
};
const resolveMasuDistAptitude = (masu, base) => {
  const transcendBase = masuTranscendBaseAptitude(masu, base);
  if (Array.isArray(masu?.distAptBoosts)) return transcendBase
    .map((grade, index) => raiseAptitudeGrade(grade, masu.distAptBoosts[index]));
  // 旧形式(distAptに完成値を保存)の個体は、その値へ超越ぶんだけを足す
  const boosts = normalizeTranscendAptBoosts(masu?.transcendAptBoosts);
  return Array.isArray(masu?.distApt)
    ? masu.distApt.slice(0, 4).map((grade, index) => raiseAptitudeGrade(grade, boosts[index]))
    : transcendBase;
};
// マスモンの保存データへ、種の基礎データ(ALL_PLAYER_MONSTERS)と強化ポイントぶんを合成して
// 「モンスターらしいオブジェクト」を作る。詳細画面の表示も総合力の計算もこの結果を使うので、
// 画面に出ている現在値と総合力の元になる値が必ず一致する。
// idは元のモンスター種idのまま保つ(mainHero?.id==='Golem' 等の特性判定を壊さないため)。
const mergeMasuIntoMon = (masu) => {
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  if (!base) return null;
  const sp = masu.statPoints || {};
  // 供モン時の合流ボーナスにも、通常強化と同じく超越で上げた基礎値を100%乗せる。
  // transcendStatPoints は実際の増加値なので倍率換算せず、そのまま1度だけ加算する。
  const tsp = normalizeTranscendStatPoints(masu?.transcendStatPoints);
  const individual = resolveMasuIndividualStats(masu, base);
  return {
    ...base,
    masuId: masu.id,
    masuName: masu.name,
    name: masu.name,
    baseHp: individual.hp + (sp.hp || 0),
    baseAtk: individual.atk + (sp.atk || 0),
    baseDef: individual.def + (sp.def || 0),
    baseGuts: individual.guts + (sp.guts || 0),
    plusStats: {
      hp: (base.plusStats?.hp || 0) + (sp.hp || 0) + tsp.hp,
      atk: (base.plusStats?.atk || 0) + (sp.atk || 0) + tsp.atk,
      def: (base.plusStats?.def || 0) + (sp.def || 0) + tsp.def,
      guts: (base.plusStats?.guts || 0) + (sp.guts || 0) + tsp.guts,
    },
    distAptitude: resolveMasuDistAptitude(masu, base),
    colors: getMasuColors(masu),
    unique: uniqueSkillAtLevel(base.unique, masu.uniqueSkillLevels?.own),
    // 壊れた保存データ(null や技の体を成さない要素)が混ざっていても落ちないようにする。
    inheritedUniques: (masu.inheritedUniques || []).map((unique, index) => uniqueSkillAtLevel(unique, resolveInheritedUniqueLevel(masu, unique, index))),
    // 固有技設定(並び順・初期技)。保存が無い個体はここで従来どおりの値になる
    uniqueOrder: normalizeUniqueOrder(masu),
    initialUniqueKey: normalizeInitialUniqueKey(masu),
  };
};
// マスモン詳細で「元の値 ＋ 基礎UP(超越) ＋ 通常強化 ＝ 現在」を出すための内訳。★重要
// 新しい計算も保存も作らない。現在値は mergeMasuIntoMon の結果そのもので、
// 基礎UPと通常強化は保存済みの値をそのまま読む。元の値は引き算で求めるので、
// どんな個体でも 元 ＋ 基礎UP ＋ 通常強化 ＝ 現在 が必ず成り立つ。
// 個体データを持たないベースモンには null を返す(存在しない内訳を作らない)。
const masuGrowthBreakdown = (masu, mergedMon) => {
  if (!masu || !mergedMon) return null;
  const base = ALL_PLAYER_MONSTERS[masu.baseId];
  if (!base) return null;
  const sp = masu.statPoints || {};
  const tsp = normalizeTranscendStatPoints(masu.transcendStatPoints);
  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const stat = (key, label, currentValue, color) => {
    const baseUp = Math.max(0, num(tsp[key]));
    const enhance = Math.max(0, num(sp[key]));
    const current = num(currentValue);
    return { key, label, color, current, baseUp, enhance, origin: current - baseUp - enhance };
  };
  // 間合い適性は「段階」で積む。通常強化ぶんを別に持たない旧形式(distAptに完成値を保存)の個体は、
  // 保存されている完成値を元の適性として扱い、通常強化は0段階として出す(推測で分けない)。
  const aptBaseUps = normalizeTranscendAptBoosts(masu.transcendAptBoosts);
  const newFormat = Array.isArray(masu.distAptBoosts);
  const savedApt = Array.isArray(masu.distApt) ? masu.distApt : null;
  const apt = Array.from({ length: 4 }, (_, index) => {
    const baseUp = Math.max(0, num(aptBaseUps[index]));
    const enhance = newFormat ? Math.max(0, num(masu.distAptBoosts[index])) : 0;
    const originGrade = newFormat
      ? (base.distAptitude?.[index] || 'C')
      : (savedApt?.[index] || base.distAptitude?.[index] || 'C');
    const grade = mergedMon.distAptitude?.[index] || originGrade;
    // 段階はMで止まるので、足した段階の合計が現在の段階と合わないことがある
    const originIndex = Math.max(0, DIST_APTITUDE_GRADES.indexOf(originGrade));
    const capped = originIndex + baseUp + enhance > DIST_APTITUDE_GRADES.length - 1;
    return { index, originGrade, grade, baseUp, enhance, capped };
  });
  return {
    stats: [
      stat('hp', 'ライフ', mergedMon.baseHp, 'text-pink-400'),
      stat('atk', 'ちから', mergedMon.baseAtk, 'text-red-400'),
      stat('def', '丈夫さ', mergedMon.baseDef, 'text-emerald-400'),
      stat('guts', 'ガッツ', mergedMon.baseGuts, 'text-amber-400'),
    ],
    apt,
  };
};

// ==================== 血統と図鑑 ====================
// 血統の正本は data/lineages.js。ここは「引き方」だけを持つ。
// 血統はモンスターの種(baseId)に紐づくもので、マスモン(個体)へは保存しない。
// data/lineages.js を読めなかったときも画面が落ちないよう、必ず既定値へ落ちる。
const UNKNOWN_LINEAGE = Object.freeze({ id:'unknown', name:'？？？', rare:true });
const lineageCatalog = () => (typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES) || {};
const lineageEntryMap = () => (typeof MONSTER_LINEAGE_MAP !== 'undefined' && MONSTER_LINEAGE_MAP) || {};
const lineageById = (id) => lineageCatalog()[id] || (id ? { id:String(id), name:String(id) } : UNKNOWN_LINEAGE);
// モンスターの種id(マスモンなら baseId)から主血統・副血統を引く。
// 将来の「○○血統限定モード」の参加判定もここを通す
const monsterLineageOf = (monsterId) => {
  const entry = lineageEntryMap()[monsterId];
  return {
    main: lineageById(entry?.main),
    sub: lineageById(entry?.sub != null ? entry.sub : entry?.main),
    known: !!entry,
  };
};
// 区分: 主血統と副血統が同じ → 純血 ／ どちらかがレア血統 → レア ／ それ以外 → 派生種
const monsterCategoryOf = (monsterId) => {
  const { main, sub } = monsterLineageOf(monsterId);
  if (main.rare || sub.rare) return 'rare';
  return main.id === sub.id ? 'pure' : 'derived';
};
const monsterCategoryName = (categoryId) =>
  (typeof MONSTER_CATEGORIES !== 'undefined' && MONSTER_CATEGORIES?.[categoryId]?.name) || '不明';
// 血統のアイコン。その血統を代表するプレイアブルモンスターがいるときだけ絵を使う。
// ドラゴン・ジョーカーのようにモンスターがいない血統は、絵を作らず名前だけで見せる
const lineageIconUrl = (lineage) => {
  const base = lineage?.monId && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[lineage.monId] : null;
  return base?.faceIconUrl || base?.iconUrl || null;
};
// 図鑑の説明。まだ書いていないモンスターは、空欄にせず調査中と伝える
const monsterDexDescription = (monsterId) =>
  (typeof MONSTER_DEX_DESCRIPTIONS !== 'undefined' && MONSTER_DEX_DESCRIPTIONS?.[monsterId])
  || 'この個体の記録はまだ集まっていません。調査が進むと図鑑へ追記されます。';
// 図鑑に並ぶモンスター。ALL_PLAYER_MONSTERS の定義順をそのまま図鑑の並びにする
// デバッグ専用個体(debugOnly)は図鑑に出さない。ここは図鑑だけでなく、血統の絞り込み
// (dexMainLineages)と種族チャレンジの種族一覧・メンバー表示も見ているので、
// 正式実装前のモンスターがそれらへ混ざらないよう、この1か所で除いている
const dexMonsterList = () => (typeof ALL_PLAYER_MONSTERS !== 'undefined' ? Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon && !mon.debugOnly) : []);
// 図鑑の絞り込みに出す主血統。実際に登場する主血統だけを、図鑑の並び順で並べる
const dexMainLineages = () => {
  const seen = new Set();
  return dexMonsterList().map(mon => monsterLineageOf(mon.id).main).filter(lineage => {
    if (!lineage || seen.has(lineage.id)) return false;
    seen.add(lineage.id); return true;
  });
};

// ==================== 総合力 ====================
// 「その個体がいま実際に持っている能力・育成結果」を1つの数値にした、表示・比較用の派生指標。
// 未使用の強化ポイントや育成の履歴(絆Lv・限界突破・転生・合体回数)には点を付けない。
// 保存はしない。いつでも現在の個体データから計算し直すので、能力・間合い適性・固有技Lvを
// 変えれば自動で追従し、絆ポイントリセットで能力が未使用ポイントへ戻れば同じだけ下がる。
//
// 計算に含めないもの: 未使用強化P / 絆Lv・絆XP / Lv上限 / 限界突破回数 / 転生回数 /
//   合体回数と合体で得たXP / 勇者特性 / 合流ボーナス(plusStats) / 染色 / 所持品・ダイヤ
const MONSTER_POWER_STAT_WEIGHT = { hp: 1, atk: 10 / 3, def: 10 / 3, guts: 10 / 3 };
// 間合い適性の段階ごとの点。Cを0として1段階ごとに10。4距離すべてを合計する
const MONSTER_POWER_APTITUDE = { M: 70, 'SS+': 60, SS: 50, 'S+': 40, S: 30, A: 20, B: 10, C: 0, D: -10, E: -20, F: -30, G: -40 };
const MONSTER_POWER_UNIQUE_OWNED = 100;   // 固有技を1つ持っていること自体の点(Lv0でも付く)
const MONSTER_POWER_UNIQUE_PER_LEVEL = 200 / 3; // 固有技の強化Lv1段階ごとの点
// 総合力に数える固有技の一覧。自前の固有技と、合体で継承した固有技を同じ基準で扱う。
// 壊れたデータ・存在しない技を架空の技として数えないよう、名前と倍率を持つものだけを通す。
const monsterPowerUniques = (mon) => [mon?.unique, ...((mon?.inheritedUniques) || [])]
  .filter(u => u && typeof u === 'object' && typeof u.name === 'string' && Number.isFinite(Number(u.baseMult)));
// 総合力の内訳。合計を出す前の各項目を返すので、検査や画面の説明にも使える
const monsterPowerParts = (mon) => {
  if (!mon) return { stat: 0, aptitude: 0, unique: 0, total: 0 };
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const stat = num(mon.baseHp) * MONSTER_POWER_STAT_WEIGHT.hp
    + num(mon.baseAtk) * MONSTER_POWER_STAT_WEIGHT.atk
    + num(mon.baseDef) * MONSTER_POWER_STAT_WEIGHT.def
    + num(mon.baseGuts) * MONSTER_POWER_STAT_WEIGHT.guts;
  const apt = (Array.isArray(mon.distAptitude) ? mon.distAptitude : [])
    .slice(0, 4)
    .reduce((sum, grade) => sum + (MONSTER_POWER_APTITUDE[grade] ?? 0), 0);
  const uniques = monsterPowerUniques(mon);
  const uniquePower = uniques.length * MONSTER_POWER_UNIQUE_OWNED
    + uniques.reduce((sum, u) => sum + Math.max(0, Math.floor(num(u.evoLevel))), 0) * MONSTER_POWER_UNIQUE_PER_LEVEL;
  return { stat, aptitude: apt, unique: uniquePower, total: stat + apt + uniquePower };
};
// 総合力の正本。解決済みのモンスター(ベースモンの定義、または mergeMasuIntoMon の結果)を渡す。
// 端数は最後にまとめて四捨五入する(項目ごとに丸めない)
const monsterPowerOf = (mon) => Math.round(monsterPowerParts(mon).total);
// 保存データのマスモンから総合力を出す。詳細画面と同じ解決(mergeMasuIntoMon)を通してから
// 同じ式へ渡すので、ベース値と強化値の二重加算は起きない
const masuPowerOf = (masu) => monsterPowerOf(mergeMasuIntoMon(masu));
// 第3段階で新旧表現を併記する新規個体は、保存前に能力・適性・総合力が一致することを確認する。
// 既存個体のロードには使わないため、旧データを補完・書換えする処理にはならない。
const masuBaselineRepresentationsMatch = (masu) => {
  if (!masu || !Array.isArray(masu.distAptBoosts)) return false;
  const legacy = { ...masu };
  delete legacy.individualStatOffsets;
  delete legacy.distAptBoosts;
  const oldResolved = mergeMasuIntoMon(legacy);
  const newResolved = mergeMasuIntoMon(masu);
  if (!oldResolved || !newResolved) return false;
  const values = mon => [mon.baseHp, mon.baseAtk, mon.baseDef, mon.baseGuts, ...mon.distAptitude];
  return JSON.stringify(values(oldResolved)) === JSON.stringify(values(newResolved))
    && monsterPowerOf(oldResolved) === monsterPowerOf(newResolved);
};
// 第6B-1段階の旧再生個体判定。createdAtには頼らず、保存済みの4能力が再生時の
// Math.round(base * (0.9～1.1)) で実際に生成できた歴代ベースだけを候補にする。
// Math.random() による0.9倍以上・1.1倍未満の生成区間と、Math.roundの区間が重なるか調べる。
const LEGACY_REGENERATION_STAT_BASELINES = {
  Pixie: [
    { id:'pre-2026-08-14', hp:250, atk:160, def:50, guts:140 },
    { id:'current', hp:250, atk:160, def:50, guts:170 },
  ],
  Mitarashi: [
    { id:'pre-2026-08-14', hp:600, atk:120, def:120, guts:100 },
    { id:'current', hp:630, atk:140, def:105, guts:90 },
  ],
};
const regenerationStatCouldBeGenerated = (value, baseValue) => {
  const stat = Number(value);
  const base = Number(baseValue);
  if (!Number.isInteger(stat) || !Number.isInteger(base) || base <= 0) return false;
  // 正数に対するMath.round(value)===statの区間は [stat-0.5, stat+0.5)。
  // 小数誤差を避けるため全境界を20倍した整数で比較する。
  return base * 18 < stat * 20 + 10 && base * 22 > stat * 20 - 10;
};
const diagnoseLegacyRegenerationStatBaseline = (masu) => {
  const statKeys = ['hp','atk','def','guts'];
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const historical = LEGACY_REGENERATION_STAT_BASELINES[masu?.baseId]
    || (base ? [{ id:'current', hp:base.baseHp, atk:base.baseAtk, def:base.baseDef, guts:base.baseGuts }] : []);
  const candidates = historical.filter(candidate => statKeys.every(key =>
    regenerationStatCouldBeGenerated(masu?.individualStats?.[key], candidate[key])));
  const result = {
    status: candidates.length === 1 ? 'SAFE_EXACT' : candidates.length > 1 ? 'AMBIGUOUS' : 'BLOCKED',
    candidates: candidates.map(candidate => ({ ...candidate })),
  };
  if (candidates.length === 1) {
    const candidate = candidates[0];
    result.individualStatOffsets = Object.fromEntries(statKeys.map(key =>
      [key, Number(masu.individualStats[key]) - candidate[key]]));
  }
  return result;
};
// 第6B-2段階の距離適性判定。候補を返すだけで、保存データへの補完・書込みは行わない。
// ゴーレムの旧形式は過去のベース変更前後を保存値だけでは区別できないため保留する。
const diagnoseLegacyDistAptBoosts = (masu) => {
  const checks = { validGrades:false, notBelowBase:false, withinCap:false, pointsConsistent:false, totalPointsPreserved:false, aptitudePreserved:false, powerPreserved:false };
  const reasons = [];
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const validAptitudes = value => Array.isArray(value) && value.length === 4
    && value.every(grade => DIST_APTITUDE_GRADES.includes(grade));
  const validBoosts = value => Array.isArray(value) && value.length === 4
    && value.every(boost => Number.isInteger(Number(boost)) && Number(boost) >= 0);
  if (!masu || typeof masu !== 'object' || !base || !validAptitudes(base.distAptitude)) {
    reasons.push('ベースの距離適性が有効な4距離の等級ではない');
    return { status:'BLOCKED', reasons, proposed:{}, checks };
  }
  const hasBoosts = Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts');
  if (!hasBoosts && !validAptitudes(masu.distApt)) {
    reasons.push('保存済みdistAptが有効な4距離の等級ではない');
    return { status:'BLOCKED', reasons, proposed:{}, checks };
  }
  checks.validGrades = true;
  if (hasBoosts && !validBoosts(masu.distAptBoosts)) {
    reasons.push('distAptBoostsが0以上の整数4要素ではない');
    return { status:'BLOCKED', reasons, proposed:{}, checks };
  }
  if (!hasBoosts && masu.baseId === 'Golem') {
    reasons.push('ゴーレムは旧ベース適性A/C/E/Gと現行A/E/G/Gのどちらから強化されたか断定できない');
    return { status:'AMBIGUOUS', reasons, proposed:{}, checks };
  }
  const boosts = hasBoosts ? masu.distAptBoosts.map(Number) : masu.distApt.map((grade, index) =>
    DIST_APTITUDE_GRADES.indexOf(grade) - DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]));
  checks.notBelowBase = boosts.every(boost => boost >= 0);
  checks.withinCap = boosts.every((boost, index) =>
    DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]) + boost < DIST_APTITUDE_GRADES.length);
  const available = Number(masu.distAptPoints);
  if (!checks.notBelowBase) reasons.push('保存済みdistAptが現在のベースより低い');
  if (!checks.withinCap) reasons.push('投入段階を適用するとMを超える');
  if (!Number.isInteger(available) || available < 0) reasons.push('distAptPointsが0以上の整数ではない');
  if (reasons.length) return { status:'BLOCKED', reasons, proposed:{}, checks };

  const proposed = hasBoosts ? {} : { distAptBoosts:boosts };
  const candidate = { ...masu, ...proposed };
  const before = mergeMasuIntoMon(masu);
  const after = mergeMasuIntoMon(candidate);
  const recoveredBoostTotal = boosts.reduce((sum, value) => sum + value, 0);
  const proposedBoostTotal = (candidate.distAptBoosts || []).reduce((sum, value) => sum + Number(value), 0);
  const beforeReconciled = reconcileMasuPoints({ ...masu, statPoints:{ ...masu.statPoints } });
  const afterReconciled = reconcileMasuPoints({ ...candidate, statPoints:{ ...candidate.statPoints } });
  checks.pointsConsistent = beforeReconciled.distAptPoints === afterReconciled.distAptPoints;
  checks.totalPointsPreserved = recoveredBoostTotal === proposedBoostTotal
    && JSON.stringify(masu.statPoints) === JSON.stringify(candidate.statPoints)
    && masu.distAptPoints === candidate.distAptPoints;
  checks.aptitudePreserved = !!after && (hasBoosts || (!!before && JSON.stringify(before.distAptitude) === JSON.stringify(after.distAptitude)));
  checks.powerPreserved = !!after && Number.isFinite(monsterPowerOf(after))
    && (hasBoosts || (!!before && monsterPowerOf(before) === monsterPowerOf(after)));
  if (!checks.totalPointsPreserved || !checks.aptitudePreserved || !checks.powerPreserved) {
    reasons.push('候補適用前後で強化ポイント総量・距離適性・総合力を維持できない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  return { status:'SAFE_EXACT', reasons, proposed, checks };
};
// 第6B-3段階の個体全体診断。能力と間合いを独立分類したうえで、安全と判定した候補だけを
// コピーへ適用し、能力は確定した生成時ベースとの個体差を現行ベースへ足し、
// 間合いは従来値を保つことを独立に再確認する。既存ポイントはどちらも変更しない。
// 通常個体は individualStats を持たないのが正常なので、能力側は移行済み相当として扱う。
const diagnoseLegacyMasuBaselineMigration = (masu) => {
  const statKeys = ['hp','atk','def','guts'];
  const hasOwn = key => !!masu && Object.prototype.hasOwnProperty.call(masu, key);
  const proposed = {};
  const individualStats = { status:'BLOCKED', proposedOffsets:{}, reasons:[] };
  const aptitude = { status:'BLOCKED', proposedBoosts:{}, reasons:[] };
  const checks = {
    statOffsetsCorrect:false,
    statsMatchCurrentBase:false,
    statDeltaMatchesBaseline:false,
    aptitudePreserved:false,
    powerRecalculated:false,
    statPointsPreserved:false,
    distAptPointsPreserved:false,
  };
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const validStatObject = value => value && typeof value === 'object' && !Array.isArray(value)
    && statKeys.every(key => Number.isFinite(Number(value[key])));
  const validIntegerStatOffsets = value => value && typeof value === 'object' && !Array.isArray(value)
    && statKeys.every(key => Number.isInteger(value[key]));
  const validStoredStatPoints = value => value && typeof value === 'object' && !Array.isArray(value)
    && statKeys.every(key => Number.isInteger(Number(value[key])) && Number(value[key]) >= 0
      && Number(value[key]) % STAT_POINT_GAIN[key] === 0);
  if (!masu || typeof masu !== 'object' || !base || !validStoredStatPoints(masu.statPoints)
    || !Number.isInteger(Number(masu.distAptPoints)) || Number(masu.distAptPoints) < 0) {
    const reason = '個体・ベース・statPoints・distAptPointsのいずれかが不正';
    individualStats.reasons.push(reason);
    aptitude.reasons.push(reason);
    return { individualStats, aptitude, overallStatus:'BLOCKED', checks };
  }

  const hasIndividualStats = hasOwn('individualStats');
  const hasOffsets = hasOwn('individualStatOffsets');
  if (!hasIndividualStats && !hasOffsets) {
    individualStats.status = 'ALREADY_MODERN';
    individualStats.reasons.push('通常個体は能力の移行が不要');
  } else if ((!hasOffsets && !validStatObject(masu.individualStats)) || (hasOffsets && !validIntegerStatOffsets(masu.individualStatOffsets))) {
    individualStats.reasons.push('individualStatsまたはindividualStatOffsetsの4能力が不正');
  } else if (hasOffsets) {
    const newResolved = mergeMasuIntoMon(masu);
    individualStats.status = newResolved && Number.isFinite(monsterPowerOf(newResolved)) ? 'ALREADY_MODERN' : 'BLOCKED';
    if (individualStats.status === 'BLOCKED') individualStats.reasons.push('現在ベースとindividualStatOffsetsから能力を解決できない');
  } else {
    const result = diagnoseLegacyRegenerationStatBaseline(masu);
    individualStats.status = result.status;
    individualStats.reasons = result.candidates.length ? [] : ['再生時の基礎値候補を特定できない'];
    if (result.status === 'SAFE_EXACT') {
      individualStats.proposedOffsets = { ...result.individualStatOffsets };
      proposed.individualStatOffsets = { ...result.individualStatOffsets };
      individualStats.confirmedBaseline = { ...result.candidates[0] };
    }
  }

  const aptResult = diagnoseLegacyDistAptBoosts(masu);
  aptitude.status = aptResult.status === 'SAFE_EXACT' && hasOwn('distAptBoosts') ? 'ALREADY_MODERN' : aptResult.status;
  aptitude.reasons = [...aptResult.reasons];
  if (aptResult.status === 'SAFE_EXACT' && !hasOwn('distAptBoosts')) {
    aptitude.proposedBoosts = [...aptResult.proposed.distAptBoosts];
    proposed.distAptBoosts = [...aptResult.proposed.distAptBoosts];
  }

  const before = mergeMasuIntoMon(masu);
  const preservesAptitudeCandidate = candidate => {
    const resolved = mergeMasuIntoMon(candidate);
    const statField = key => `base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`;
    return !!before && !!resolved
      && statKeys.every(key => before[statField(key)] === resolved[statField(key)])
      && JSON.stringify(before.distAptitude) === JSON.stringify(resolved.distAptitude)
      && monsterPowerOf(before) === monsterPowerOf(resolved)
      && JSON.stringify(masu.statPoints) === JSON.stringify(candidate.statPoints)
      && masu.distAptPoints === candidate.distAptPoints;
  };
  if (aptitude.status === 'SAFE_EXACT' && !preservesAptitudeCandidate({ ...masu, distAptBoosts:proposed.distAptBoosts })) {
    aptitude.status = 'BLOCKED';
    aptitude.proposedBoosts = {};
    aptitude.reasons.push('間合い候補の適用前後で能力・適性・総合力・既存ポイントを維持できない');
  }
  const safeProposed = {};
  if (individualStats.status === 'SAFE_EXACT') safeProposed.individualStatOffsets = proposed.individualStatOffsets;
  if (aptitude.status === 'SAFE_EXACT') safeProposed.distAptBoosts = proposed.distAptBoosts;
  const candidate = { ...masu, ...safeProposed };
  const after = mergeMasuIntoMon(candidate);
  const statField = key => `base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`;
  const currentBaseStat = key => Number(base[statField(key)]);
  const spentStat = key => Number(masu.statPoints[key]);
  const confirmedBaseline = individualStats.confirmedBaseline;
  checks.statOffsetsCorrect = individualStats.status !== 'SAFE_EXACT' || (!!confirmedBaseline && statKeys.every(key =>
    proposed.individualStatOffsets[key] === Number(masu.individualStats[key]) - Number(confirmedBaseline[key])));
  checks.statsMatchCurrentBase = !!after && (individualStats.status !== 'SAFE_EXACT' || statKeys.every(key =>
    after[statField(key)] === currentBaseStat(key) + proposed.individualStatOffsets[key] + spentStat(key)));
  checks.statDeltaMatchesBaseline = !!before && !!after && (individualStats.status !== 'SAFE_EXACT' || statKeys.every(key =>
    after[statField(key)] - before[statField(key)] === currentBaseStat(key) - Number(confirmedBaseline[key])));
  checks.aptitudePreserved = !!before && !!after && JSON.stringify(before.distAptitude) === JSON.stringify(after.distAptitude);
  checks.powerRecalculated = !!after && monsterPowerOf(after) === Math.round(monsterPowerParts(after).total);
  checks.statPointsPreserved = JSON.stringify(masu.statPoints) === JSON.stringify(candidate.statPoints);
  checks.distAptPointsPreserved = masu.distAptPoints === candidate.distAptPoints;
  if (individualStats.status === 'SAFE_EXACT' && (!checks.statOffsetsCorrect || !checks.statsMatchCurrentBase
    || !checks.statDeltaMatchesBaseline || !checks.statPointsPreserved || !checks.powerRecalculated)) {
    individualStats.status = 'BLOCKED';
    individualStats.proposedOffsets = {};
    individualStats.reasons.push('能力候補が個体差・現行ベース・能力変化量・既存statPoints・総合力と一致しない');
  }
  const statuses = [individualStats.status, aptitude.status];
  const overallStatus = statuses.includes('BLOCKED') ? 'BLOCKED'
    : statuses.every(status => status === 'ALREADY_MODERN') ? 'ALREADY_MODERN'
    : statuses.every(status => status === 'AMBIGUOUS') ? 'AMBIGUOUS'
    : statuses.includes('AMBIGUOUS') ? 'PARTIAL'
    : 'SAFE_EXACT';
  return { individualStats, aptitude, overallStatus, checks };
};
// 第6C段階の実移行。第6B診断が個体全体をSAFE_EXACTとした場合だけ、診断済みの
// 差分表現をコピーへ追加する。旧フィールドは残し、保存対象にする直前にも個体差、
// 基礎値差ぶんの能力変化、距離適性、既存ポイント、現行式による総合力を再確認する。
const migrateSafeMasuBaselineRepresentations = (masuMons, diagnose = diagnoseLegacyMasuBaselineMigration) => {
  const summary = { migrated:0, alreadyModern:0, partial:0, ambiguous:0, blocked:0, validationFailed:0 };
  if (!Array.isArray(masuMons)) return { nextMasuMons:masuMons, summary, changed:false };
  const statKeys = ['hp','atk','def','guts'];
  const statField = key => `base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`;
  const representation = masu => {
    const mon = mergeMasuIntoMon(masu);
    if (!mon) return null;
    return {
      stats: Object.fromEntries(statKeys.map(key => [key, mon[statField(key)]])),
      aptitude: Array.isArray(mon.distAptitude) ? mon.distAptitude.slice(0, 4) : [],
      power: monsterPowerOf(mon),
      powerPartsTotal: monsterPowerParts(mon).total,
      statPoints: JSON.stringify(masu.statPoints),
      distAptPoints: masu.distAptPoints,
    };
  };
  let changed = false;
  const nextMasuMons = masuMons.map(masu => {
    const diagnosis = diagnose(masu);
    if (diagnosis.overallStatus !== 'SAFE_EXACT') {
      const key = diagnosis.overallStatus === 'ALREADY_MODERN' ? 'alreadyModern'
        : diagnosis.overallStatus === 'PARTIAL' ? 'partial'
          : diagnosis.overallStatus === 'AMBIGUOUS' ? 'ambiguous' : 'blocked';
      summary[key] += 1;
      return masu;
    }
    const candidate = { ...masu };
    if (diagnosis.individualStats.status === 'SAFE_EXACT') {
      candidate.individualStatOffsets = { ...diagnosis.individualStats.proposedOffsets };
    }
    if (diagnosis.aptitude.status === 'SAFE_EXACT') {
      candidate.distAptBoosts = [...diagnosis.aptitude.proposedBoosts];
    }
    const before = representation(masu);
    const after = representation(candidate);
    const base = ALL_PLAYER_MONSTERS[masu?.baseId];
    const confirmedBaseline = diagnosis.individualStats.confirmedBaseline;
    const offsets = diagnosis.individualStats.proposedOffsets;
    const statPoints = masu.statPoints || {};
    const statsValid = diagnosis.individualStats.status !== 'SAFE_EXACT' || (!!base && !!confirmedBaseline
      && statKeys.every(key => after?.stats[key] === Number(base[statField(key)]) + Number(offsets[key]) + Number(statPoints[key])
        && after.stats[key] - before?.stats[key] === Number(base[statField(key)]) - Number(confirmedBaseline[key])));
    const existingFieldsPreserved = Object.keys(masu).every(key => JSON.stringify(candidate[key]) === JSON.stringify(masu[key]));
    const candidateDiagnosis = diagnoseLegacyMasuBaselineMigration(candidate);
    const matches = !!before && !!after
      && statsValid
      && JSON.stringify(before.aptitude) === JSON.stringify(after.aptitude)
      && after.power === Math.round(after.powerPartsTotal)
      && before.statPoints === after.statPoints
      && before.distAptPoints === after.distAptPoints
      && existingFieldsPreserved
      && candidateDiagnosis.overallStatus === 'ALREADY_MODERN';
    if (!matches) {
      summary.blocked += 1;
      summary.validationFailed += 1;
      return masu;
    }
    if (JSON.stringify(candidate) === JSON.stringify(masu)) {
      summary.alreadyModern += 1;
      return masu;
    }
    summary.migrated += 1;
    changed = true;
    return candidate;
  });
  return { nextMasuMons, summary, changed };
};
// 第4段階の既存個体ドライラン。候補を新しいオブジェクトとして組み立てるだけで、保存・補完は行わない。
// 旧形式は生成時点のベース定義を持たないため、現在ベースとの差が計算できても SAFE にはしない。
const diagnoseMasuBaselineMigration = (masu) => {
  const reasons = [];
  const proposed = {};
  const checks = { statsPreserved:false, aptitudePreserved:false, powerPreserved:false, pointsPreserved:false };
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const statKeys = ['hp','atk','def','guts'];
  const validFiniteObject = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && keys.every(key => Number.isFinite(Number(value[key])));
  const validAptitudes = value => Array.isArray(value) && value.length === 4
    && value.every(grade => DIST_APTITUDE_GRADES.includes(grade));
  const validBoosts = value => Array.isArray(value) && value.length === 4
    && value.every(boost => Number.isInteger(Number(boost)) && Number(boost) >= 0);
  if (!masu || typeof masu !== 'object' || !base || !validAptitudes(base.distAptitude)) {
    reasons.push('個体または最新ベース定義を正しく解決できない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }

  const hasOffsets = Object.prototype.hasOwnProperty.call(masu, 'individualStatOffsets');
  const hasBoosts = Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts');
  const hasIndividualStats = Object.prototype.hasOwnProperty.call(masu, 'individualStats');
  if (!validAptitudes(masu.distApt)) reasons.push('distAptが正しい4距離の等級配列ではない');
  if (hasBoosts && !validBoosts(masu.distAptBoosts)) reasons.push('distAptBoostsが0以上の整数4要素ではない');
  if (hasOffsets && !validFiniteObject(masu.individualStatOffsets, statKeys)) reasons.push('individualStatOffsetsの4能力が有限数ではない');
  if (hasIndividualStats && !validFiniteObject(masu.individualStats, statKeys)) reasons.push('individualStatsの4能力が有限数ではない');
  if (reasons.length) return { status:'BLOCKED', reasons, proposed, checks };

  if (!hasBoosts) {
    const boosts = masu.distApt.map((grade, index) => DIST_APTITUDE_GRADES.indexOf(grade) - DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]));
    if (boosts.some(boost => boost < 0)) {
      reasons.push('保存済みdistAptが最新ベースより低く、投入段階として復元できない');
      return { status:'BLOCKED', reasons, proposed, checks };
    }
    proposed.distAptBoosts = boosts;
    reasons.push('生成時点のベース適性が無いため、最新ベースとの差を投入ポイントと断定できない');
  }
  if (hasIndividualStats && !hasOffsets) {
    proposed.individualStatOffsets = {
      hp:Number(masu.individualStats.hp) - base.baseHp,
      atk:Number(masu.individualStats.atk) - base.baseAtk,
      def:Number(masu.individualStats.def) - base.baseDef,
      guts:Number(masu.individualStats.guts) - base.baseGuts,
    };
    reasons.push('再生時点のベース能力が無いため、最新ベースとの差を個体差と断定できない');
  }

  const candidate = { ...masu, ...proposed };
  const before = mergeMasuIntoMon(masu);
  const after = mergeMasuIntoMon(candidate);
  checks.statsPreserved = !!before && !!after && statKeys.every(key => before[`base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`] === after[`base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`]);
  checks.aptitudePreserved = !!before && !!after && JSON.stringify(before.distAptitude) === JSON.stringify(after.distAptitude);
  checks.powerPreserved = !!before && !!after && monsterPowerOf(before) === monsterPowerOf(after);
  const validStoredPoints = Number.isFinite(Number(masu.distAptPoints ?? 0)) && Number(masu.distAptPoints ?? 0) >= 0
    && statKeys.every(key => Number.isFinite(Number(masu.statPoints?.[key] ?? 0)) && Number(masu.statPoints?.[key] ?? 0) >= 0
      && Number(masu.statPoints?.[key] ?? 0) % STAT_POINT_GAIN[key] === 0)
    && ['bondXp','rebirthCount','reincarnateCount','reincarnateBonusPoints','inheritedReincarnateBonusPoints']
      .every(key => Number.isFinite(Number(masu[key] ?? 0)) && Number(masu[key] ?? 0) >= 0);
  checks.pointsPreserved = hasBoosts && validStoredPoints;

  if (!checks.statsPreserved || !checks.aptitudePreserved || !checks.powerPreserved) {
    reasons.push('候補適用後に能力・適性・総合力のいずれかを維持できない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  if (!validStoredPoints) {
    reasons.push('保存済みの未使用ポイント・能力強化・絆・転生成果に不正な値がある');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  if (!hasBoosts || (hasIndividualStats && !hasOffsets)) {
    return { status:'ESTIMATED', reasons, proposed, checks };
  }
  if (!masuBaselineRepresentationsMatch(masu)) {
    reasons.push('新旧フィールドの能力・適性・総合力が一致しない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  checks.pointsPreserved = true;
  reasons.push('第3段階以降の新形式で、新旧表現とポイント量が一致する');
  return { status:'SAFE', reasons, proposed, checks };
};
const diagnoseMasuBaselineMigrationList = (masuMons) => {
  const results = (Array.isArray(masuMons) ? masuMons : []).map(diagnoseMasuBaselineMigration);
  const counts = { SAFE:0, ESTIMATED:0, BLOCKED:0 };
  results.forEach(result => { counts[result.status] += 1; });
  return { counts, results };
};
// 一覧・詳細で出す桁区切りの表記
const formatMonsterPower = (power) => Number(power || 0).toLocaleString();

// 寄付一覧も表示と同じ masuPowerOf を使って並べる。コピーをソートするため、元の保存配列や
// IDで持っている選択状態には触れず、並べ替え後も同じ個体を選択・寄付できる。
const sortDonationMasuMons = (masuList, sortKey, sortDir, activeIds = []) => {
  const dir = sortDir === 'asc' ? 1 : -1;
  const activeSet = new Set(activeIds);
  const value = (masu) => sortKey === 'bondXp' ? donationDiamondValue(masu.bondXp)
    : sortKey === 'bond' ? masuBondLevelInfo(masu).level
    : sortKey === 'power' ? masuPowerOf(masu)
    : sortKey === 'name' ? (masu.name || '')
    : sortKey === 'lineage' ? ((ALL_PLAYER_MONSTERS[masu.baseId] || {}).name || '')
    : sortKey === 'active' ? (activeSet.has(`masu:${masu.id}`) ? 1 : 0)
    : (Number(masu.createdAt) || Number(masu.id) || 0);
  return [...masuList].sort((a, b) => {
    const av = value(a), bv = value(b);
    const compared = typeof av === 'string' ? av.localeCompare(bv, 'ja') : av - bv;
    return compared * dir;
  });
};

// 強化画面の数値直接入力を、0〜その項目へ振れる最大ポイントへ正規化する。
// inputMode=numeric でも貼り付けでは記号等が入り得るため、整数だけを受け付ける。
const directEnhancePointAmount = (rawValue, maxValue) => {
  const text = String(rawValue ?? '').trim();
  const max = Math.max(0, Math.floor(Number(maxValue) || 0));
  if (!/^\d+$/.test(text)) return 0;
  const parsed = Number(text);
  const wanted = Number.isFinite(parsed) ? Math.floor(parsed) : Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(0, wanted), max);
};

// 強化の下書き(plan)を当てはめた「強化後のマスモン」を、保存データに触れずに作る。
// 一括強化のプレビュー・1ポイント強化のプレビュー・実際の確定処理が、すべてこの1か所を通るので、
// 画面に出した「強化後の総合力」と、確定したあとの総合力が必ず一致する。
// 戻り値の masu は計算用のコピーで、これを保存しない限り実データは変わらない。
const applyEnhancePlanToMasu = (masu, plan) => {
  if (!masu) return null;
  const available = masu.distAptPoints || 0;
  const aptPlan = (plan && plan.apt) || [0, 0, 0, 0];
  const statPlan = (plan && plan.stat) || {};
  const wanted = aptPlan.reduce((a, b) => a + (b || 0), 0) + Object.values(statPlan).reduce((a, b) => a + (b || 0), 0);
  if (wanted <= 0 || wanted > available) return null;
  const base = ALL_PLAYER_MONSTERS[masu.baseId];
  const distApt = [...resolveMasuDistAptitude(masu, base || {})];
  const distAptBoosts = Array.isArray(masu.distAptBoosts) ? masu.distAptBoosts.slice(0, 4).map(v => Math.max(0, Math.floor(Number(v) || 0))) : null;
  let used = 0;
  aptPlan.forEach((n, idx) => {
    for (let i = 0; i < (n || 0); i++) {
      const cur = DIST_APTITUDE_GRADES.indexOf(distApt[idx] || 'C');
      if (cur < 0 || cur >= DIST_APTITUDE_GRADES.length - 1) break; // 上限Mに達したらそこで止める
      distApt[idx] = DIST_APTITUDE_GRADES[cur + 1];
      if (distAptBoosts) distAptBoosts[idx] = (distAptBoosts[idx] || 0) + 1;
      used++;
    }
  });
  const statPoints = { ...(masu.statPoints || {}) };
  Object.entries(statPlan).forEach(([key, n]) => {
    if (!STAT_POINT_KEYS[key]) return;
    for (let i = 0; i < (n || 0); i++) {
      statPoints[key] = (statPoints[key] || 0) + (STAT_POINT_GAIN[key] || 1);
      used++;
    }
  });
  if (used <= 0) return null;
  return { masu: { ...masu, distApt, ...(distAptBoosts ? { distAptBoosts } : {}), statPoints, distAptPoints: available - used }, used };
};
// ==================== 超越 ====================
// Lv400・虹★5(35凸)まで育てた個体だけが神殿で行える、限界の先の育成。
// 資格・コスト・次の状態はここだけで決め、画面はその結果を出すだけにする
// (押した瞬間の値と保存する値がずれないようにするため)。
const canTranscendMasu = (masu) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。' };
  const normalized = normalizeMasuProgression(masu);
  if (normalized.transcended) return { ok:false, reason:'この個体はすでに超越しています。' };
  if (!isFinalBreakthroughCount(normalized.rebirthCount)) {
    return { ok:false, reason:`限界突破${FINAL_BREAKTHROUGH_COUNT}回（虹★${BREAKTHROUGH_STARS_PER_TIER}）まで進めると超越できます。` };
  }
  if (masuBondLevelInfo(masu).level < MAX_MASU_LEVEL_CAP) {
    return { ok:false, reason:`Lv.${MAX_MASU_LEVEL_CAP}に到達すると超越できます。` };
  }
  return { ok:true };
};
const buildMasuTranscendence = ({ masu, gold = 0, psycheOwned = 0 } = {}) => {
  const psycheCost = TRANSCEND_PSYCHE_COST;
  const diamondCost = TRANSCEND_DIAMOND_COST;
  const psycheHave = Math.max(0, Math.floor(Number(psycheOwned) || 0));
  const goldHave = Math.max(0, Math.floor(Number(gold) || 0));
  const info = { psycheCost, diamondCost, psycheHave, goldHave };
  const eligible = canTranscendMasu(masu);
  if (!eligible.ok) return { ...info, ok:false, reason:eligible.reason };
  if (psycheHave < psycheCost) return { ...info, ok:false, reason:`虹のプシュケーが足りません（あと ${(psycheCost - psycheHave).toLocaleString()}）。` };
  if (goldHave < diamondCost) return { ...info, ok:false, reason:`ダイヤが足りません（あと ${(diamondCost - goldHave).toLocaleString()}）。` };
  const normalized = normalizeMasuProgression(masu);
  return {
    ...info,
    ok: true,
    nextPsyche: psycheHave - psycheCost,
    nextGold: goldHave - diamondCost,
    fromLevelCap: normalized.levelCap,
    toLevelCap: TRANSCEND_LEVEL_CAP,
    // レベルは Lv.400 のまま。変わるのは上限だけ(Lv401へ勝手に上げない)
    nextMasu: { ...normalized, transcended: true, levelCap: TRANSCEND_LEVEL_CAP },
  };
};
// 虹のプシュケーを超越ポイントへ替える。100個ちょうどで1P、端数のプシュケーは消費しない
const transcendPsycheExchange = (psycheOwned, wantedPoints) => {
  const have = Math.max(0, Math.floor(Number(psycheOwned) || 0));
  const maxPoints = Math.floor(have / TRANSCEND_PSYCHE_PER_POINT);
  const points = Math.max(0, Math.min(maxPoints, Math.floor(Number(wantedPoints) || 0)));
  const psycheCost = points * TRANSCEND_PSYCHE_PER_POINT;
  return { ok: points > 0, points, psycheCost, maxPoints, nextPsyche: have - psycheCost };
};
// 交換を個体へ反映する。超越Pは個体ごとの育成値なので、必ず選んでいるその個体へ足す。
// 神殿で正式に超越しているかは問わない(超越強化はどのマスモンでも使える)。
const applyTranscendExchange = (masu, psycheOwned, wantedPoints) => {
  const normalized = normalizeMasuProgression(masu);
  const plan = transcendPsycheExchange(psycheOwned, wantedPoints);
  if (!plan.ok) return null;
  return { ...plan, nextMasu: { ...normalized, transcendPoints: normalized.transcendPoints + plan.points } };
};
// 超越ポイントの配分。通常の強化(applyEnhancePlanToMasu)と同じ下書きの形を使うが、
// 上げるのは「基礎値」側(transcendStatPoints / transcendAptBoosts)で、通常強化とは混ざらない。
// 1Pあたりの効果は通常の強化ポイントと同じ価値基準(ライフ+10 / ほか+3 / 適性1段階)。
const applyTranscendPlanToMasu = (masu, plan) => {
  const normalized = normalizeMasuProgression(masu);
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[normalized.baseId] : null;
  if (!base) return null;
  const available = normalized.transcendPoints;
  const aptPlan = (plan && plan.apt) || [0, 0, 0, 0];
  const statPlan = (plan && plan.stat) || {};
  const wanted = aptPlan.reduce((a, b) => a + (b || 0), 0) + Object.values(statPlan).reduce((a, b) => a + (b || 0), 0);
  if (wanted <= 0 || wanted > available) return null;
  const baseApt = Array.isArray(base.distAptitude) ? base.distAptitude.slice(0, 4) : ['C','C','C','C'];
  const transcendAptBoosts = [...normalized.transcendAptBoosts];
  let used = 0;
  aptPlan.forEach((n, idx) => {
    for (let i = 0; i < (n || 0); i++) {
      const current = Math.max(0, DIST_APTITUDE_GRADES.indexOf(baseApt[idx] || 'C')) + transcendAptBoosts[idx];
      if (current >= DIST_APTITUDE_GRADES.length - 1) break; // 基礎の段階もMで止める
      transcendAptBoosts[idx] += 1;
      used++;
    }
  });
  const transcendStatPoints = { ...normalized.transcendStatPoints };
  Object.entries(statPlan).forEach(([key, n]) => {
    if (!STAT_POINT_KEYS[key]) return;
    for (let i = 0; i < (n || 0); i++) {
      transcendStatPoints[key] += (STAT_POINT_GAIN[key] || 1);
      used++;
    }
  });
  if (used <= 0) return null;
  return { masu: { ...normalized, transcendAptBoosts, transcendStatPoints, transcendPoints: available - used }, used };
};
// 超越で上げた基礎の合計段階数(表示・検査用)
const transcendAptBoostTotal = (masu) => normalizeTranscendAptBoosts(masu?.transcendAptBoosts)
  .reduce((sum, value) => sum + value, 0);
// 超越強化へ使った超越ポイントの合計。ステータスは1Pあたりの上昇量で割って本数へ戻す
const transcendSpentPoints = (masu) => {
  const stat = normalizeTranscendStatPoints(masu?.transcendStatPoints);
  const statSpent = TRANSCEND_STAT_KEYS.reduce((sum, key) => sum + Math.ceil((stat[key] || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
  return statSpent + transcendAptBoostTotal(masu);
};
// 【超越ポイントリセットの書】使った超越Pをすべて未使用へ戻す。
// 戻すのは超越Pだけで、絆Lv・絆XP・Lv上限・超越済みかどうか・限界突破・転生回数・
// 通常の強化ポイント・固有技・染色・虹のプシュケーには一切触れない。
// 1Pも使っていなければ null を返し、呼び出し側でアイテムを消費させない。
const buildMasuTranscendReset = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  const refunded = transcendSpentPoints(normalized);
  if (refunded <= 0) return null;
  return {
    refundedPoints: refunded,
    nextMasu: {
      ...normalized,
      transcendStatPoints: normalizeTranscendStatPoints(null),
      transcendAptBoosts: normalizeTranscendAptBoosts(null),
      transcendPoints: normalized.transcendPoints + refunded,
    },
  };
};
// リセット直前の「ポイントで上げた分」だけを、同じ個体の保存値へ小さなスナップショットとして残す。
// 絆XP・絆Lv・固有技などは含めず、旧形式の個体でも現行の下書き(plan)へ直せる形にそろえる。
const buildBondResetAllocationSnapshot = (masu, base) => {
  if (!masu || !base) return null;
  // 通常強化ぶんだけを数える。超越で上げた基礎はリセットの対象外なので、基準側へ含める
  const baseApt = masuTranscendBaseAptitude(masu, base);
  const resolvedApt = resolveMasuDistAptitude(masu, base);
  const apt = Array.isArray(masu.distAptBoosts)
    ? [0,1,2,3].map(i => Math.max(0, Math.floor(Number(masu.distAptBoosts[i]) || 0)))
    : [0,1,2,3].map(i => Math.max(0, DIST_APTITUDE_GRADES.indexOf(resolvedApt[i]) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])));
  const stat = Object.fromEntries(Object.keys(STAT_POINT_KEYS).map(key => [key,
    Math.max(0, Math.ceil((Number(masu.statPoints?.[key]) || 0) / (STAT_POINT_GAIN[key] || 1)))
  ]));
  const total = apt.reduce((sum, value) => sum + value, 0) + Object.values(stat).reduce((sum, value) => sum + value, 0);
  return total > 0 ? { version:1, apt, stat } : null;
};
// 保存済みスナップショットを現在の上限と残りptへ安全に収めた下書きへ変換する。
// 完全に戻せない場合も不正なplanを作らず、omittedをUIで知らせる。
const buildBondResetRestorePlan = (masu, snapshot) => {
  if (!masu || !snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.apt) || !snapshot.stat || typeof snapshot.stat !== 'object') return null;
  let remaining = Math.max(0, Math.floor(Number(masu.distAptPoints) || 0));
  const base = ALL_PLAYER_MONSTERS[masu.baseId] || {};
  const currentApt = resolveMasuDistAptitude(masu, base);
  const plan = { apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0} };
  let requested = 0;
  [0,1,2,3].forEach(idx => {
    const wanted = Math.max(0, Math.floor(Number(snapshot.apt[idx]) || 0));
    requested += wanted;
    const currentIndex = Math.max(0, DIST_APTITUDE_GRADES.indexOf(currentApt[idx] || 'C'));
    const capacity = Math.max(0, DIST_APTITUDE_GRADES.length - 1 - currentIndex);
    plan.apt[idx] = Math.min(wanted, capacity, remaining);
    remaining -= plan.apt[idx];
  });
  Object.keys(STAT_POINT_KEYS).forEach(key => {
    const wanted = Math.max(0, Math.floor(Number(snapshot.stat[key]) || 0));
    requested += wanted;
    plan.stat[key] = Math.min(wanted, remaining);
    remaining -= plan.stat[key];
  });
  const restored = plan.apt.reduce((sum, value) => sum + value, 0) + Object.values(plan.stat).reduce((sum, value) => sum + value, 0);
  return { plan, requested, restored, omitted:Math.max(0, requested - restored) };
};
// 絆ポイントリセットの保存値計算。新形式は投入段階数を直接返却し、新旧の適性表現を同時に戻す。
// 旧形式は従来どおり完成適性と最新ベースとの差から返却数を求める。
const buildMasuBondPointReset = (masu, base) => {
  if (!masu || !base) return null;
  const baseApt = base.distAptitude || ['C','C','C','C'];
  const aptSpent = Array.isArray(masu.distAptBoosts)
    ? masu.distAptBoosts.reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0)
    : (masu.distApt || baseApt).reduce((sum, g, i) => sum + Math.max(0, DIST_APTITUDE_GRADES.indexOf(g) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])), 0);
  const statSpent = Object.entries(masu.statPoints || {}).reduce((sum, [key, val]) => sum + Math.ceil((val || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
  const totalRefund = aptSpent + statSpent;
  if (totalRefund <= 0) return null;
  const allocationSnapshot = buildBondResetAllocationSnapshot(masu, base);
  return {
    refundedPoints: totalRefund,
    nextMasu: {
      ...masu,
      distApt: [...baseApt],
      ...(Array.isArray(masu.distAptBoosts) ? { distAptBoosts:[0,0,0,0] } : {}),
      statPoints: { hp:0, atk:0, def:0, guts:0 },
      distAptPoints: (masu.distAptPoints || 0) + totalRefund,
      bondResetAllocationSnapshot: allocationSnapshot,
    },
  };
};
// 下書きを当てはめたあとの総合力。当てはめられない(ポイント不足など)ときは現在の総合力を返す
const plannedMasuPowerOf = (masu, plan) => {
  const applied = applyEnhancePlanToMasu(masu, plan);
  return masuPowerOf(applied ? applied.masu : masu);
};
const migrateMasuLevelCaps = (masuMons, gold) => {
  const capXp = totalBondXpForLevel(INITIAL_MASU_LEVEL_CAP);
  let compensation = 0;
  const nextMasuMons = (Array.isArray(masuMons) ? masuMons : []).map(raw => {
    const masu = normalizeMasuProgression(raw);
    if (masu.rebirthCount === 0 && donationDiamondValue(masu.bondXp) > capXp) {
      compensation += donationDiamondValue(masu.bondXp) - capXp;
      return { ...masu, bondXp: capXp };
    }
    return { ...masu, bondXp: cappedBondXp(masu) };
  });
  return { nextMasuMons, compensation, nextGold: donationDiamondValue(gold) + compensation };
};
// 合体・転生の消費ダイヤ単価(絆レベル1あたり)。以前はどちらも100だったが、
// 周回で貯まるダイヤに対して重すぎたため半額にした。表示と実処理で同じ値を使う。
const FUSION_INHERIT_COST = 3000;
const FUSION_INHERIT_MIN_SUB_LEVEL = 30;
const REGENERATION_COST = 100;
const REGENERATION_DISC_IMAGE = 'images/disc-icons/stone-base.png';
const REBIRTH_COST_PER_LEVEL = 50;
const masuFusionCost = (_mainLevel, _subLevel, inherit = false) => inherit ? FUSION_INHERIT_COST : 0;
// 合体確認と確定処理で共有するダイヤ収支。画面には必ず差し引き前の所持数を見せる。
const buildFusionDiamondSummary = ({ masu, fusionXp = 0, gold = 0, psycheOwned = 0, mainLevel = 0, subLevel = 0, inherit = false, inheritCount = inherit ? 1 : 0 }) => {
  const goldBefore = donationDiamondValue(gold);
  const inheritCost = Math.max(0, Math.floor(Number(inheritCount) || 0)) * masuFusionCost(mainLevel, subLevel, true);
  const breakthroughPlan = buildFusionBreakthroughPlan({
    masu, fusionXp, gold:goldBefore - inheritCost, psycheOwned,
  });
  const breakthroughDiamondCost = breakthroughPlan.diamondCost;
  const totalDiamondCost = inheritCost + breakthroughDiamondCost;
  return {
    goldBefore, inheritCost, breakthroughDiamondCost, totalDiamondCost,
    diamondAfter:goldBefore - totalDiamondCost,
    diamondShortage:Math.max(0, totalDiamondCost - goldBefore),
    normalDiamondCost:inheritCost,
    normalDiamondAfter:goldBefore - inheritCost,
    normalDiamondShortage:Math.max(0, inheritCost - goldBefore),
    breakthroughPlan,
  };
};
// 選択順に継承可否を確定する。確認画面と保存直前の再検証で同じ判定を使い、
// 主が所持済み・同じ一括合体内で先に追加済みの同系統には費用を付けない。
const buildFusionInheritancePlan = ({ main, subs, selectedSubIds }) => {
  const selected = new Set(Array.isArray(selectedSubIds) ? selectedSubIds : []);
  const mainBase = main ? ALL_PLAYER_MONSTERS[main.baseId] : null;
  const ownedLineageIds = new Set([
    uniqueLineageId(mainBase?.unique, mainBase?.id),
    ...(Array.isArray(main?.inheritedUniques) ? main.inheritedUniques : []).map(unique=>uniqueLineageId(unique)),
  ].filter(Boolean));
  const entries = (Array.isArray(subs) ? subs : []).map(sub => {
    const subBase = sub ? ALL_PLAYER_MONSTERS[sub.baseId] : null;
    const lineageId = uniqueLineageId(subBase?.unique, subBase?.id);
    const eligible = !!sub && masuBondLevelInfo(sub).level >= FUSION_INHERIT_MIN_SUB_LEVEL && !!subBase?.unique;
    const requested = !!sub && selected.has(sub.id);
    const duplicate = !!lineageId && ownedLineageIds.has(lineageId);
    const inherited = requested && eligible && !!lineageId && !duplicate;
    if (inherited) ownedLineageIds.add(lineageId);
    return { sub, subBase, lineageId, eligible, requested, duplicate, inherited };
  });
  const inheritedEntries = entries.filter(entry=>entry.inherited);
  return { entries, inheritedEntries, inheritCount:inheritedEntries.length, inheritCost:inheritedEntries.length * FUSION_INHERIT_COST };
};
// 転生の消費ダイヤ。画面の表示と実処理で必ずこの関数を使う。
// (以前は画面だけが「レベル×100」で計算しており、実際に引かれる額の倍が表示され、
//  そのぶんダイヤを持っていないと転生ボタンを押せない状態になっていた)
const masuRebirthCost = (level) => Math.max(0, Math.floor(Number(level) || 0)) * REBIRTH_COST_PER_LEVEL;
// 限界突破: 上限に届いた個体の上限だけを上げる。レベル・振った強化はそのまま残し、
// 強化ポイントを初回5・以降1だけ足す(以前の「転生」はここでLv1へ戻していた)。
const buildMasuBreakthrough = ({ masu, skillKey, gold, psycheOwned = 0 }) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。' };
  const normalized = normalizeMasuProgression(masu);
  const level = masuBondLevelInfo(normalized).level;
  // 何回目の限界突破かで、必要な虹のプシュケーの数が決まる
  const psycheCost = breakthroughItemCost(normalized.rebirthCount + 1);
  const psycheHave = Math.max(0, Math.floor(Number(psycheOwned) || 0));
  if (normalized.levelCap >= MAX_MASU_LEVEL_CAP) return { ok:false, reason:`レベル上限は Lv.${MAX_MASU_LEVEL_CAP} までです。`, psycheCost, psycheHave };
  if (level !== normalized.levelCap) return { ok:false, reason:`Lv.${normalized.levelCap}到達後に限界突破できます。`, psycheCost, psycheHave };
  const cost = masuRebirthCost(level);
  if (donationDiamondValue(gold) < cost) return { ok:false, reason:'ダイヤが不足しています。', psycheCost, psycheHave };
  if (psycheHave < psycheCost) return { ok:false, reason:`虹のプシュケーが不足しています（必要 ${psycheCost} / 所持 ${psycheHave}）。`, psycheCost, psycheHave };
  // 固有技をその場で上げるかどうかは自由。選ばなかったとき(と、選んだ技がもう最大のとき)は
  // 「未使用の固有技ポイント」として残し、あとでマスモンの詳細から使える。
  // 以前はここで突破そのものを止めていたため、全部の固有技が最大まで育っていると
  // 限界突破できなくなっていた
  const currentSkillLevel = Math.max(0, Math.floor(Number(normalized.uniqueSkillLevels[skillKey]) || 0));
  const raisesSkill = !!skillKey && currentSkillLevel < MAX_UNIQUE_SKILL_LEVEL;
  const uniqueSkillLevels = raisesSkill
    ? { ...normalized.uniqueSkillLevels, [skillKey]:currentSkillLevel + 1 }
    : { ...normalized.uniqueSkillLevels };
  const keptSkillPoints = Math.max(0, Math.floor(Number(normalized.uniqueSkillPoints) || 0)) + (raisesSkill ? 0 : 1);
  const nextCount = normalized.rebirthCount + 1;
  const gainedPoints = nextCount === 1 ? BREAKTHROUGH_FIRST_POINTS : BREAKTHROUGH_POINTS;
  const isFinal = nextCount === FINAL_BREAKTHROUGH_COUNT;
  const nextLevelCap = breakthroughLevelCap(nextCount);
  return {
    ok:true, cost, skillKey:raisesSkill ? skillKey : null, skillLevel:raisesSkill ? currentSkillLevel + 1 : null,
    raisesSkill, keptSkillPoints, gainedPoints, finalBreakthrough:isFinal,
    psycheCost, psycheHave, nextPsyche:psycheHave - psycheCost,
    nextGold:donationDiamondValue(gold) - cost,
    nextMasu:{
      ...normalized,
      rebirthCount: nextCount,
      levelCap: nextLevelCap,
      distAptPoints: Math.max(0, Math.floor(Number(normalized.distAptPoints) || 0)) + gainedPoints,
      uniqueSkillLevels,
      uniqueSkillPoints: keptSkillPoints,
    },
  };
};
// AUTO∞の自動限界突破候補を、呼び出し時点の最新残高から順番に確定する。
// 費用・素材数・次の上限はbuildMasuBreakthroughだけに計算させ、ここではAUTO専用上限だけを追加判定する。
const buildAutoRepeatBreakthroughs = ({ masuIds, masuMons, gold, ownedItems, breederXp }) => {
  let nextMasuMons = Array.isArray(masuMons) ? masuMons : [];
  let nextGold = donationDiamondValue(gold);
  let nextOwnedItems = { ...(ownedItems || {}) };
  const succeededMasuIds = [];
  const seen = new Set();
  const breederLevelLimit = levelInfo(breederXp).level / 2;
  for (const rawId of Array.isArray(masuIds) ? masuIds : []) {
    const id = String(rawId);
    if (seen.has(id)) continue;
    seen.add(id);
    const masu = nextMasuMons.find(entry => String(entry.id) === id);
    if (!masu) continue;
    const settingLevel = normalizeMasuProgression(masu).autoRepeatBreakthroughLevel;
    if (settingLevel <= 0) continue;
    const result = buildMasuBreakthrough({
      masu, skillKey:'', gold:nextGold,
      psycheOwned:ownedItemCount(nextOwnedItems, BREAKTHROUGH_ITEM_ID),
    });
    if (!result.ok || result.nextMasu.levelCap > settingLevel || result.nextMasu.levelCap > breederLevelLimit) continue;
    nextMasuMons = nextMasuMons.map(entry => String(entry.id) === id ? result.nextMasu : entry);
    nextGold = result.nextGold;
    nextOwnedItems = { ...nextOwnedItems, [BREAKTHROUGH_ITEM_ID]:result.nextPsyche };
    succeededMasuIds.push(masu.id);
  }
  return { nextMasuMons, nextGold, nextOwnedItems, succeededMasuIds };
};
// 転生: 絆Lv100以上の個体を、レベル99ぶん引き換えに白紙から育て直す。
// 振った強化はすべて戻り、強化ポイントは「新しいレベルぶん + これまでの限界突破ぶん + 10」で
// 配り直す(限界突破で得たポイントも振り直しの対象に含める、というユーザー指定に合わせる)。
const buildMasuReincarnation = ({ masu, skillKey, gold }) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。' };
  const normalized = normalizeMasuProgression(masu);
  const level = masuBondLevelInfo(normalized).level;
  if (level < REINCARNATE_MIN_LEVEL) return { ok:false, reason:`Lv.${REINCARNATE_MIN_LEVEL}到達後に転生できます。` };
  const cost = masuRebirthCost(level);
  if (donationDiamondValue(gold) < cost) return { ok:false, reason:'ダイヤが不足しています。' };
  // 限界突破と同じで、固有技を上げるかどうかは自由。選ばなかったぶんはポイントとして残す
  const currentSkillLevel = Math.max(0, Math.floor(Number(normalized.uniqueSkillLevels[skillKey]) || 0));
  const raisesSkill = !!skillKey && currentSkillLevel < MAX_UNIQUE_SKILL_LEVEL;
  const uniqueSkillLevels = raisesSkill
    ? { ...normalized.uniqueSkillLevels, [skillKey]:currentSkillLevel + 1 }
    : { ...normalized.uniqueSkillLevels };
  const keptSkillPoints = Math.max(0, Math.floor(Number(normalized.uniqueSkillPoints) || 0)) + (raisesSkill ? 0 : 1);
  const nextLevel = Math.max(1, level - REINCARNATE_LEVEL_DROP);
  const nextCount = normalized.reincarnateCount + 1;
  // 振り直せる合計。レベル由来ぶんは reconcileMasuPoints と同じ levelBasedEnhancePoints で数える
  // (ここを別の式にすると、限界突破の倍率で稼いだぶんが転生のたびに消えてしまう)
  const nextOwnBonusPoints = normalized.reincarnateBonusPoints + REINCARNATE_POINTS;
  const nextPoints = levelBasedEnhancePoints(nextLevel)
    + totalBreakthroughPoints(normalized.rebirthCount) + nextOwnBonusPoints + normalized.inheritedReincarnateBonusPoints;
  return {
    ok:true, cost, skillKey:raisesSkill ? skillKey : null, skillLevel:raisesSkill ? currentSkillLevel + 1 : null,
    raisesSkill, keptSkillPoints,
    fromLevel:level, nextLevel, gainedPoints:REINCARNATE_POINTS, nextPoints,
    nextGold:donationDiamondValue(gold) - cost,
    nextMasu:resetMasuForRebirth(normalized, {
      reincarnateCount: nextCount,
      reincarnateBonusPoints: nextOwnBonusPoints,
      levelCap: normalized.levelCap, // 上限は据え置き(転生を重ねても上限は伸びない)
      toLevel: nextLevel,
      distAptPoints: nextPoints,
      uniqueSkillLevels,
      uniqueSkillPoints: keptSkillPoints,
    }),
  };
};

// 神殿の寄付で受け取るダイヤ。保存データが古い・破損している場合も負数やNaNを返さない。
const donationDiamondValue = (bondXp) => {
  const value = Number(bondXp);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};
const donationPsycheValue = (masu) => Math.floor(masuBondLevelInfo(masu).level / 5);
const randomRegenerationStat = (baseValue, random = Math.random) => Math.round(baseValue * (0.9 + Math.max(0, Math.min(1, Number(random()) || 0)) * 0.2));
const buildRegeneratedMasu = (base, random = Math.random, now = Date.now()) => {
  if (!base) return null;
  // 乱数は完成値の4回だけ引き、offsetは確定した同じ値から算出する（再抽選しない）。
  const individualStats = { hp:randomRegenerationStat(base.baseHp,random), atk:randomRegenerationStat(base.baseAtk,random), def:randomRegenerationStat(base.baseDef,random), guts:randomRegenerationStat(base.baseGuts,random) };
  const masu = {
    id:`masu_regenerated_${now}_${Math.random().toString(36).slice(2,8)}`, baseId:base.id, name:base.name,
    bondXp:0, distAptPoints:0, distApt:[...(base.distAptitude || ['C','C','C','C'])],
    distAptBoosts:[0,0,0,0],
    statPoints:{hp:0,atk:0,def:0,guts:0},
    individualStats,
    individualStatOffsets:{ hp:individualStats.hp-base.baseHp, atk:individualStats.atk-base.baseAtk, def:individualStats.def-base.baseDef, guts:individualStats.guts-base.baseGuts },
    createdAt:now,
  };
  return masuBaselineRepresentationsMatch(masu) ? masu : null;
};
const rosterBaseId = (entryId, masuMons) => {
  if (typeof entryId !== 'string') return null;
  if (!entryId.startsWith('masu:')) return entryId;
  return masuMons.find(m => String(m.id) === entryId.slice(5))?.baseId || null;
};
const MONSTER_PARTY_SET_COUNT = 5;
const MONSTER_PARTY_SETS_KEY = 'mh_monster_roster_sets_v1';
const MONSTER_PARTY_SETS_MIGRATED_KEY = 'mh_monster_roster_sets_migrated_v1';
const defaultMonsterPartySetName = index => `セット${index + 1}`;
const normalizeMonsterPartySets = (saved, legacyRoster=[]) => {
  const source = saved && typeof saved === 'object' ? saved : null;
  const sourceRosters = Array.isArray(source?.rosters) ? source.rosters : null;
  const sourceNames = Array.isArray(source?.names) ? source.names : [];
  const activeValue = Number(source?.activeIndex);
  const activeIndex = Number.isInteger(activeValue) && activeValue >= 0 && activeValue < MONSTER_PARTY_SET_COUNT ? activeValue : 0;
  return {
    version: 1,
    activeIndex,
    names: Array.from({length:MONSTER_PARTY_SET_COUNT}, (_, index) => {
      const name = typeof sourceNames[index] === 'string' ? sourceNames[index].trim().slice(0, 20) : '';
      return name || defaultMonsterPartySetName(index);
    }),
    rosters: Array.from({length:MONSTER_PARTY_SET_COUNT}, (_, index) => {
      const roster = sourceRosters ? sourceRosters[index] : (index === 0 ? legacyRoster : []);
      return Array.isArray(roster) ? [...roster] : [];
    }),
  };
};
const repairRosterAfterDonation = (roster, donated, remainingMasuMons, unlockedMonsterIds, validBaseIds, requiredCount) => {
  const donatedEntry = `masu:${donated.id}`;
  if (!roster.includes(donatedEntry)) return { ok: true, roster: [...roster] };
  const next = roster.filter(id => id !== donatedEntry);
  const usedBases = new Set(next.map(id => rosterBaseId(id, remainingMasuMons)).filter(Boolean));
  const candidates = [donated.baseId, ...unlockedMonsterIds];
  for (const baseId of candidates) {
    if (next.length >= requiredCount) break;
    if (!validBaseIds.includes(baseId) || usedBases.has(baseId)) continue;
    next.splice(Math.min(roster.indexOf(donatedEntry), next.length), 0, baseId);
    usedBases.add(baseId);
  }
  const valid = next.length === requiredCount && next.every(id => {
    const baseId = rosterBaseId(id, remainingMasuMons);
    return baseId && validBaseIds.includes(baseId);
  }) && new Set(next.map(id => rosterBaseId(id, remainingMasuMons))).size === next.length;
  return valid ? { ok: true, roster: next } : { ok: false, reason: '有効なモンスターを8体編成できないため、寄付を中止しました。' };
};
// HOME放牧設定の保存値を所持個体だけへ正規化する。nullは機能導入前のセーブを表し、
// 従来の1体表示を維持するため先頭の表示可能個体1体で初期化する。
const normalizeHomePastureIds = (savedIds, masuMons, validBaseIds) => {
  const validBases = validBaseIds instanceof Set ? validBaseIds : new Set(validBaseIds || []);
  const ownedIds = (Array.isArray(masuMons) ? masuMons : []).filter(m=>validBases.has(m.baseId)).map(m=>String(m.id));
  if (!Array.isArray(savedIds)) return ownedIds.slice(0,1);
  const owned = new Set(ownedIds);
  return [...new Set(savedIds.map(String))].filter(id=>owned.has(id)).slice(0,5);
};

const buildMasuDonation = ({ masuMons, targetId, gold, monsterRosterIds, draftMonsterRoster, unlockedMonsterIds, validBaseIds, requiredCount }) => {
  const donated = masuMons.find(m => String(m.id) === String(targetId));
  if (!donated) return { ok: false, reason: '対象のマスモンはすでに所持していません。' };
  const nextMasuMons = masuMons.filter(m => String(m.id) !== String(targetId));
  const active = repairRosterAfterDonation(monsterRosterIds, donated, nextMasuMons, unlockedMonsterIds, validBaseIds, requiredCount);
  if (!active.ok) return active;
  const draft = repairRosterAfterDonation(draftMonsterRoster, donated, nextMasuMons, unlockedMonsterIds, validBaseIds, requiredCount);
  if (!draft.ok) return draft;
  const diamonds = donationDiamondValue(donated.bondXp);
  const psyche = donationPsycheValue(donated);
  return { ok: true, donated, diamonds, psyche, nextGold: donationDiamondValue(gold) + diamonds, nextMasuMons, nextRoster: active.roster, nextDraftRoster: draft.roster };
};
// 複数寄付も1体寄付の正本を順番に適用し、途中で1体でも寄付できなければ何も確定しない。
// 報酬計算・編成補正を別実装にせず、最後にまとめて保存できる完成形だけを返す。
const buildMasuDonations = ({ targetIds, ...state }) => {
  const ids = [...new Set((Array.isArray(targetIds) ? targetIds : []).map(String))];
  if (!ids.length) return { ok:false, reason:'寄付するマスモンを選んでください。' };
  let current = { ...state };
  const donated=[];
  let diamonds=0, psyche=0;
  for (const targetId of ids) {
    const result=buildMasuDonation({ ...current, targetId });
    if (!result.ok) return result;
    donated.push(result.donated); diamonds+=result.diamonds; psyche+=result.psyche;
    current={ ...current, masuMons:result.nextMasuMons, gold:result.nextGold, monsterRosterIds:result.nextRoster, draftMonsterRoster:result.nextDraftRoster };
  }
  return { ok:true, donated, diamonds, psyche, nextGold:current.gold, nextMasuMons:current.masuMons, nextRoster:current.monsterRosterIds, nextDraftRoster:current.draftMonsterRoster };
};

// 修行試作版は通常データ・チケット・ミッションから完全に分離したメモリ内デバッグセッション。
const TRAINING_MAP_ID = 'beginner_debug_v1';
const TRAINING_DIFFICULTIES = Object.freeze({
  BEGINNER:{id:'BEGINNER',label:'BEGINNER',available:true,turns:10,dice:[1,3],spaces:24,summary:'短い安全ルートと、遠回りの報酬ルートが分岐・再合流する試作マップ。'},
  EASY:{id:'EASY',label:'EASY',available:false,turns:10,dice:[1,3],spaces:28,summary:'分岐と妨害が増える予定です。説明のみ確認できます。'},
  NORMAL:{id:'NORMAL',label:'NORMAL',available:false,turns:10,dice:[1,3],spaces:32,summary:'道具の判断が重要になる予定です。説明のみ確認できます。'},
});
const TRAINING_TOOLS = Object.freeze({
 feather:{name:'加速の羽',emoji:'🪽',timing:'サイコロを振る前',mode:'消費型',desc:'次の出目に＋2'}, gale:{name:'疾風の札',emoji:'🌪️',timing:'サイコロを振る前',mode:'消費型',desc:'2回振り、高い出目を採用'}, reroll:{name:'振り直しの石',emoji:'🪨',timing:'出目の確定後・移動前',mode:'消費型',desc:'確定した出目を1回だけ振り直す'}, noReturn:{name:'戻らずのお守り',emoji:'🧿',timing:'取得後は自動待機',mode:'自動発動型',desc:'次に受ける後退効果を1回無効化して消滅'}, sand:{name:'時の砂',emoji:'⏳',timing:'移動していない時',mode:'消費型',desc:'残りターン＋1'}, fixed:{name:'確定サイコロ',emoji:'🎲',timing:'サイコロを振る前',mode:'消費型',desc:'次の出目を1・2・3から選択'}, returnCharm:{name:'帰還のお守り',emoji:'🏮',timing:'取得後は自動待機',mode:'自動発動型',desc:'ゴール失敗時、仮獲得した通常アイテムから1個選んで保護'},
});
const TRAINING_SPACE_TYPES = Object.freeze({
 start:{kind:'start',label:'スタート',emoji:'🚩',color:'#475569',desc:'修行の開始地点'}, xp30:{kind:'xp',value:30,label:'絆EXP',emoji:'💗',color:'#16a34a',desc:'仮獲得絆経験値＋30'}, xp60:{kind:'xp',value:60,label:'大EXP',emoji:'💖',color:'#15803d',desc:'仮獲得絆経験値＋60'}, gem50:{kind:'diamond',value:50,label:'ダイヤ',emoji:'💎',color:'#0891b2',desc:'仮獲得ダイヤ＋50'}, gem100:{kind:'diamond',value:100,label:'大ダイヤ',emoji:'💠',color:'#2563eb',desc:'仮獲得ダイヤ＋100'}, item:{kind:'item',value:'training_ticket',label:'アイテム',emoji:'🎁',color:'#ec4899',desc:'仮獲得通常アイテムを1個追加'}, tool:{kind:'tool',label:'修行道具',emoji:'🎒',color:'#d946ef',desc:'修行専用アイテムをランダム取得'}, forward:{kind:'move',value:1,label:'前進',emoji:'⏩',color:'#16a34a',desc:'1～3マス追加移動（停止マスだけ発動）'}, back:{kind:'move',value:-1,label:'後退',emoji:'⏪',color:'#dc2626',desc:'1～3マス戻る（停止マスだけ発動）'}, turnPlus:{kind:'turn',value:1,label:'ターン＋',emoji:'⏱️',color:'#059669',desc:'残りターン＋1'}, turnMinus:{kind:'turn',value:-1,label:'ターン－',emoji:'⚡',color:'#b91c1c',desc:'残りターン－1'}, boost:{kind:'effect',value:'boost',label:'強化',emoji:'✨',color:'#ca8a04',desc:'次回のサイコロ出目＋1'}, again:{kind:'effect',value:'again',label:'もう一度',emoji:'🔁',color:'#0d9488',desc:'ターンを消費せず再度サイコロ'}, happening:{kind:'happening',label:'ハプニング',emoji:'⁉️',color:'#9333ea',desc:'良い効果または悪い効果が発動'}, goal:{kind:'goal',label:'ゴール',emoji:'🏁',color:'#eab308',desc:'到達または通過で修行成功'},
});
// 接続先を持つ24ノード。3回分岐し、安全な短路と報酬の遠回りが再合流する。
const TRAINING_BEGINNER_NODES = Object.freeze([
 ['n0','start',8,86,['n1']],['n1','xp30',20,78,['n0','n2','n4']],['n2','turnPlus',31,66,['n1','n3']],['n3','gem50',44,58,['n2','n7']],
 ['n4','tool',19,52,['n1','n5']],['n5','gem100',29,40,['n4','n6']],['n6','item',42,37,['n5','n7']],['n7','again',53,52,['n3','n6','n8']],
 ['n8','xp60',62,65,['n7','n9','n11']],['n9','forward',72,74,['n8','n10']],['n10','boost',84,70,['n9','n14']],['n11','tool',61,42,['n8','n12']],
 ['n12','gem100',72,32,['n11','n13']],['n13','happening',85,38,['n12','n14']],['n14','xp30',91,55,['n10','n13','n15']],['n15','back',82,55,['n14','n16','n18']],
 ['n16','turnMinus',73,48,['n15','n17']],['n17','gem50',65,30,['n16','n21']],['n18','xp60',79,78,['n15','n19']],['n19','item',66,88,['n18','n20']],
 ['n20','tool',54,80,['n19','n21']],['n21','happening',49,61,['n17','n20','n22']],['n22','gem100',38,48,['n21','n23']],['n23','goal',27,34,['n22']]
].map(([id,type,x,y,next])=>Object.freeze({id,type,x,y,next:Object.freeze(next)})));
const TRAINING_NODE_BY_ID=Object.freeze(Object.fromEntries(TRAINING_BEGINNER_NODES.map(n=>[n.id,n])));
const trainingEmptyRewards=()=>({bondXp:0,diamonds:0,items:[]});
const trainingSeed=()=>Math.floor(Math.random()*2147483646)+1;
const createTrainingSession=(masuId,difficulty='BEGINNER')=>({status:'playing',masuId:String(masuId),difficulty,mapId:TRAINING_MAP_ID,seed:trainingSeed(),position:'n0',previous:null,remainingTurns:10,rewards:trainingEmptyRewards(),tools:[],effects:{},lastRoll:null,previousRoll:null,rollPending:false,branchOptions:[],movementRemaining:0,routePreview:[],stopPreview:null,forcedMoves:0,eventLog:['修行テスト開始'],message:'サイコロを振ってください'});
const trainingSpaceTiming=space=>space.kind==='goal'?'到達・通過時':space.kind==='start'?'修行開始時':'移動終了後、このマスに止まった時';
const trainingSpaceValue=space=>space.value===undefined?'ランダム':typeof space.value==='number'?`${space.value>0?'+':''}${space.value}`:String(space.value);
const settleTrainingRewards=(session,success)=>({bondXp:Math.floor(session.rewards.bondXp*(success?1:.5))+(success?100:0),diamonds:Math.floor(session.rewards.diamonds*(success?1:.5))+(success?100:0),items:success?[...session.rewards.items,'ゴール報酬']:session.effects.returnCharm&&session.rewards.items.length?[session.rewards.items[0]]:[],goalReward:success?'通常アイテム抽選1個':'なし'});
const trainingDistanceToGoal=start=>{const q=[[start,0]],seen=new Set([start]);while(q.length){const [id,d]=q.shift();if(id==='n23')return d;for(const n of TRAINING_NODE_BY_ID[id].next)if(!seen.has(n)){seen.add(n);q.push([n,d+1]);}}return '-';};
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

const Audio_ = (() => {
  let Tone = null, ready = false, loading = null, started = false;
  let reverb = null, seBus = null;
  let audioCtx = null, bgmGain = null;
  const buffers = new Map();
  const loadingBuffers = new Map();
  // previewRequest は試聴の「この呼び出しが今も最新か」を見るための番号。
  // 通常BGM(bgmRequest)と同じ役目で、読み込みを待っているあいだに止められたり
  // 押し直されたりした古い呼び出しが、あとから音を鳴らし始めるのを防ぐ
  let bgmSource = null, bgmSourceKey = null, bgmRequest = 0, previewSource = null, previewKey = null, previewRequest = 0;
  let jingleSource = null, jingleTimer = null;
  let currentKey = null, bgmVolumePct = 0, seVolumePct = 0, pageHidden = false;
  let enabled = false;
  // 音ゲーのBGM音量は、メインのBGM音量設定(対数カーブ・bgmGain)を経由させず独立させる。
  // ただし全体ミュート(タイトルの「音がオフです」)だけは共通で効かせる。
  // 稼働中のgainノードを覚えておき、ミュート切り替え時にまとめて反映する。
  const activeRhythmGains = new Set();
  const applyRhythmMute = () => { activeRhythmGains.forEach(entry => { entry.node.gain.value = enabled ? entry.raw : 0; }); };

  const load = () => {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res) => {
      if (typeof window !== 'undefined' && window.Tone) { Tone = window.Tone; res(); return; }
      if (typeof document === 'undefined') { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
      s.onload = () => { Tone = window.Tone; res(); };
      s.onerror = () => { res(); };
      document.head.appendChild(s);
    }).then(async () => {
      if (!Tone) return;
      try {
        seBus = new Tone.Gain(_gainFromPct(seVolumePct)).toDestination();
        reverb = new Tone.Reverb({ decay: 2.4, wet: 0.22 }).connect(seBus);
        try { await reverb.ready; } catch (e) {}
        ready = true;
      } catch(e){}
    });
    return loading;
  };

  const ensure = async () => { await load(); if (Tone && !started) { try { await Tone.start(); started = true; } catch (e) {} } };

  const JINGLE_FILES = { victory: 'audio/jingle-victory.mp3' };
  const _gainFromPct = (pct) => pct <= 0 ? 0 : Math.pow(10, (-40 + (Math.min(100, pct) / 100) * 40) / 20);
  const _bgmGain = (pct) => pct <= 0 ? 0 : Math.pow(10, (-55 + (Math.min(100, pct) / 100) * 55) / 20) * 0.55;

  // HTMLAudioElementはiOSの消音スイッチを無視するため使用しない。mp3を取得・デコードし、
  // BGMもジングルもAudioBufferSourceNodeだけで出力する。
  const getAudioCtx = () => {
    if (audioCtx) return audioCtx;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
      bgmGain = audioCtx.createGain();
      bgmGain.gain.value = _bgmGain(bgmVolumePct);
      bgmGain.connect(audioCtx.destination);
      bindResumeOnGesture();
    } catch (e) { audioCtx = null; bgmGain = null; }
    return audioCtx;
  };
  // AudioContextは端末側の自動再生制限・省電力・他アプリの音声フォーカスで止められる。
  // 止まったまま start() しても無音になるだけなので、次のタップで必ず復帰させる。
  // タップはuser activationが有効な唯一の機会なので、ここでresume()を呼ぶ意味がある
  let resumeOnGestureBound = false;
  const bindResumeOnGesture = () => {
    if (resumeOnGestureBound || typeof document === 'undefined') return;
    resumeOnGestureBound = true;
    const onGesture = () => {
      const ctx = audioCtx;
      if (!ctx || ctx.state === 'running') return;
      let done = null;
      try { done = ctx.resume(); } catch (e) {}
      const after = () => { if (audioCtx && audioCtx.state === 'running' && enabled && !pageHidden && currentKey && !bgmSource && !jingleSource && !previewSource) playBGM(currentKey); };
      if (done && done.then) done.then(after, () => {}); else setTimeout(after, 0);
    };
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(type => {
      try { document.addEventListener(type, onGesture, { capture: true, passive: true }); } catch (e) { document.addEventListener(type, onGesture, true); }
    });
  };
  const resumeAudioCtxNoWait = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    return ctx;
  };
  const ensureAudioCtxRunning = async () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
    return ctx;
  };
  const decode = (ctx, data) => new Promise((resolve, reject) => {
    let settled = false;
    const ok = (value) => { if (!settled) { settled = true; resolve(value); } };
    const ng = (error) => { if (!settled) { settled = true; reject(error); } };
    try { const p = ctx.decodeAudioData(data, ok, ng); if (p && p.then) p.then(ok, ng); } catch (e) { ng(e); }
  });
  const loadBuffer = (url) => {
    if (buffers.has(url)) return Promise.resolve(buffers.get(url));
    if (loadingBuffers.has(url)) return loadingBuffers.get(url);
    const ctx = getAudioCtx();
    if (!ctx || typeof fetch !== 'function') return Promise.reject(new Error('Web Audio unavailable'));
    const request = fetch(url, { cache: 'force-cache' }).then((res) => {
      if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
      return res.arrayBuffer();
    }).then((data) => decode(ctx, data)).then((buffer) => { buffers.set(url, buffer); return buffer; })
      .finally(() => loadingBuffers.delete(url));
    loadingBuffers.set(url, request);
    return request;
  };
  const stopSource = (source) => { if (source) { try { source.onended = null; source.stop(); } catch (e) {} try { source.disconnect(); } catch (e) {} } };
  const stopJingles = () => { if (jingleTimer) clearTimeout(jingleTimer); jingleTimer = null; stopSource(jingleSource); jingleSource = null; };
  const stopOthers = () => { stopSource(bgmSource); bgmSource = null; bgmSourceKey = null; };
  const resolveTrack = key => BGM_TRACK_BY_ID[key] || BGM_TRACK_BY_KEY[key] || null;
  const safeTrackGain = track => Math.max(0, Math.min(1.25, Number.isFinite(track?.gain) ? track.gain : 1));
  const applyTrackGain = track => { if (bgmGain) bgmGain.gain.value = Math.min(1, _bgmGain(bgmVolumePct) * safeTrackGain(track)); };

  const startBgmBuffer = (key, track, buffer, request) => {
    const ctx = getAudioCtx();
    if (!ctx || request !== bgmRequest || key !== currentKey || !enabled || bgmVolumePct <= 0 || pageHidden || jingleSource || previewSource) return;
    if (bgmSource && bgmSourceKey === key) return;
    stopOthers();
    const source = ctx.createBufferSource();
    applyTrackGain(track);
    source.buffer = buffer; source.loop = track.loop !== false; source.connect(bgmGain);
    bgmSource = source; bgmSourceKey = key;
    source.onended = () => { if (bgmSource === source) { bgmSource = null; bgmSourceKey = null; } };
    try { source.start(0); } catch (e) { stopOthers(); return; }
    // 止まったままのAudioContextで鳴らしても無音のままになる。すぐに復帰を試す
    // (失敗しても、次のタップで bindResumeOnGesture が鳴らし直す)
    if (ctx.state !== 'running') resumeAudioCtxNoWait();
  };
  const playBGM = (key) => {
    const track = resolveTrack(key); if (!track) return Promise.resolve();
    currentKey = track.id;
    const request = ++bgmRequest;
    if (bgmSourceKey && bgmSourceKey !== track.id) stopOthers();
    if (!enabled || bgmVolumePct <= 0 || pageHidden) { stopOthers(); stopJingles(); return Promise.resolve(); }
    resumeAudioCtxNoWait();
    // 起動タップ前にdecode済みなら、user activation中に同期的に再生開始する。
    if (buffers.has(track.src)) {
      startBgmBuffer(track.id, track, buffers.get(track.src), request);
      return Promise.resolve();
    }
    return loadBuffer(track.src).then((buffer) => startBgmBuffer(track.id, track, buffer, request)).catch(() => {});
  };
  // 番号を進めることで、読み込み待ちの古い試聴を無効にする(あとから鳴り出さない)
  const stopPreview = (resume = true) => { ++previewRequest; stopSource(previewSource); previewSource = null; previewKey = null; if (resume && currentKey) playBGM(currentKey); };
  const previewBGM = async key => {
    const track = resolveTrack(key); if (!track) return false;
    if (previewKey === track.id) { stopPreview(true); return false; }
    stopPreview(false); stopJingles(); stopOthers();
    // stopPreview が番号を進めたあとに受け取るので、この値はこの呼び出し専用。
    // 曲名だけで見張っていると、同じ曲を素早く押し直したときに古い呼び出しも
    // 条件を通ってしまい、音源が2つ鳴って片方が参照から外れる(誰も止められなくなる)。
    // 実際に「止めても鳴り続ける・アレンジを閉じても鳴り続ける」不具合になっていた
    const request = previewRequest;
    previewKey = track.id;
    // 通常BGM(playBGM)と同じく、タップが効いているうちに同期でresumeを始める。
    // 読み込みを待ってから初めてresumeすると、user activationが切れていて復帰できない端末がある
    resumeAudioCtxNoWait();
    try { const buffer = await loadBuffer(track.src);
      if (request !== previewRequest || previewKey !== track.id || !enabled || pageHidden || bgmVolumePct <= 0) return false;
      const ctx = await ensureAudioCtxRunning(); if (!ctx) return false;
      // ensureAudioCtxRunning も待つので、そのあいだに止められていないかもう一度見る
      if (request !== previewRequest) return false;
      applyTrackGain(track);
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = track.loop !== false; source.connect(bgmGain); previewSource = source;
      source.onended = () => { if (previewSource === source) stopPreview(true); }; source.start(0);
      // 止まったままのAudioContextで鳴らしても無音。もう一度だけ復帰を試し、
      // それでも動かなければ「鳴っている」と嘘をつかずに戻す(次のタップでやり直せる)
      if (ctx.state !== 'running') { await ensureAudioCtxRunning(); }
      // 復帰待ちのあいだに止められていたら、いま鳴らし始めたぶんを取り逃さず止める
      if (request !== previewRequest) { stopSource(source); if (previewSource === source) { previewSource = null; previewKey = null; } return false; }
      if (ctx.state !== 'running') { if (previewKey === track.id) stopPreview(false); return false; }
      return true;
    } catch (e) { if (request === previewRequest && previewKey === track.id) stopPreview(true); return false; }
  };
  const stopBGM = () => { currentKey = null; ++bgmRequest; stopPreview(false); stopJingles(); stopOthers(); };
  // 音ゲーの時刻は AudioContext.currentTime と再生offsetだけを正本にする。
  // BufferSourceNodeは一度stopしたら再利用せず、再開のたびにoffsetから作り直す。
  // options.autoStart:false を渡すと「音源の用意だけして、まだ鳴らさない」。
  // 音ゲー本体は、画面が組み上がるのを待ってから start() で鳴らし始める
  // (先に鳴らすと、まだノーツを置けていない間に曲だけ進んでMISSが積み上がる)。
  const startRhythmTrack = async (key,rhythmVolumePct=100,options=null) => {
    const autoStart=options?.autoStart!==false;
    const track=resolveTrack(key); if(!track) return null;
    currentKey=null; ++bgmRequest; stopPreview(false); stopJingles(); stopOthers();
    resumeAudioCtxNoWait();
    try {
      const buffer=await loadBuffer(track.src),ctx=await ensureAudioCtxRunning();
      if(!ctx) return null;
      let source=null,startedAt=ctx.currentTime,offsetSeconds=0,playing=false,stopped=false,naturallyEnded=false,gainEntry=null;
      const dropGainEntry=()=>{if(gainEntry){activeRhythmGains.delete(gainEntry);gainEntry=null;}};
      const startSource=offset=>{
        if(stopped||offset>=buffer.duration){naturallyEnded=true;return false;}
        const nextSource=ctx.createBufferSource(),rhythmGain=ctx.createGain();
        const raw=Math.max(0,Math.min(1,Number(rhythmVolumePct)/100))*safeTrackGain(track);
        dropGainEntry(); gainEntry={node:rhythmGain,raw}; activeRhythmGains.add(gainEntry);
        rhythmGain.gain.value=enabled?raw:0;
        // 音ゲー専用の音量なので、メインのBGM音量(bgmGain)は経由せず直接destinationへ繋ぐ。
        // 全体ミュート(enabled)だけはactiveRhythmGains経由で共通に反映する。
        nextSource.buffer=buffer; nextSource.loop=false; nextSource.connect(rhythmGain);rhythmGain.connect(ctx.destination);
        source=nextSource; offsetSeconds=offset; startedAt=ctx.currentTime; playing=true;
        nextSource.onended=()=>{if(source===nextSource&&playing){playing=false;naturallyEnded=true;source=null;}};
        nextSource.start(0,offset); return true;
      };
      const songTimeSeconds=()=>Math.min(buffer.duration,Math.max(0,offsetSeconds+(playing?ctx.currentTime-startedAt:0)));
      if(autoStart)startSource(0);
      return {
        // autoStart:false で用意したぶんを、頭から鳴らし始める。
        // すでに鳴っている・止めたあとなら何もしない(二重に鳴らさない)
        start:()=>{if(playing||stopped||naturallyEnded)return playing;return startSource(0);},
        started:()=>playing,
        songTimeMs:()=>songTimeSeconds()*1000,
        durationMs:buffer.duration*1000,
        ended:()=>naturallyEnded||songTimeSeconds()>=buffer.duration,
        paused:()=>!playing&&!stopped&&!naturallyEnded,
        pause:()=>{if(!playing||stopped)return;offsetSeconds=songTimeSeconds();playing=false;const old=source;source=null;stopSource(old);},
        resume:async()=>{if(playing||stopped||naturallyEnded)return playing;await ensureAudioCtxRunning();return startSource(offsetSeconds);},
        restart:async()=>{if(stopped)return false;playing=false;naturallyEnded=false;const old=source;source=null;stopSource(old);offsetSeconds=0;await ensureAudioCtxRunning();return startSource(0);},
        // 譜面より音源のほうが長い曲を途中で終わらせるとき、最後の少しだけ音量を落とす。
        // (2026-09-06) デュラハンの2曲は音源がバトルのBGMと同じファイルなので切れない。
        // 何もしないと曲の途中でぶつっと止まるため、終わりの手前からなめらかに消す。
        // 全体ミュートの控え(raw)も0にしておく。ミュートを切り替えても音が戻らないようにするため。
        fadeOut:(ms)=>{
          if(stopped||!playing||!gainEntry)return false;
          const seconds=Math.max(.05,(Number(ms)||0)/1000);
          try{
            const node=gainEntry.node,at=ctx.currentTime;
            node.gain.cancelScheduledValues(at);
            node.gain.setValueAtTime(node.gain.value,at);
            node.gain.linearRampToValueAtTime(0,at+seconds);
            gainEntry.raw=0;
          }catch{return false;}
          return true;
        },
        stop:()=>{if(stopped)return;stopped=true;playing=false;const old=source;source=null;stopSource(old);dropGainEntry();},
      };
    } catch(e){ return null; }
  };
  const preloadBGM = (key) => { const track = resolveTrack(key); if (track) loadBuffer(track.src).catch(() => {}); };
  const prepareBGM = (key, timeoutMs = 2000) => {
    const track = resolveTrack(key); if (!track) return Promise.resolve(false);
    return Promise.race([loadBuffer(track.src).then(() => true).catch(() => false), new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
  };
  const prepareSE = (timeoutMs = 5000) => Promise.race([
    load().then(() => true).catch(() => false),
    new Promise((r) => setTimeout(() => r(false), timeoutMs)),
  ]);
  const playJingle = async (key) => {
    if (!enabled || bgmVolumePct <= 0 || pageHidden || !JINGLE_FILES[key]) return;
    const request = ++bgmRequest;
    try {
      const buffer = await loadBuffer(JINGLE_FILES[key]);
      if (request !== bgmRequest || !enabled || pageHidden) return;
      stopJingles(); stopOthers();
      const ctx = await ensureAudioCtxRunning(); if (!ctx) return;
      const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(bgmGain); jingleSource = source;
      const backToBGM = () => { if (jingleSource !== source) return; stopJingles(); if (currentKey) playBGM(currentKey); };
      source.onended = backToBGM;
      source.start(0);
      jingleTimer = setTimeout(backToBGM, Math.ceil(buffer.duration * 1000) + 250);
    } catch (e) { if (currentKey) playBGM(currentKey); }
  };
  const setPageHidden = (hidden) => { pageHidden = !!hidden; if (pageHidden) { ++bgmRequest; stopPreview(false); stopOthers(); stopJingles(); } else if (currentKey) playBGM(currentKey); };
  const setEnabled = async (on) => { enabled = !!on; if (typeof window !== 'undefined') window.__mhAudioEnabled = enabled; applyRhythmMute(); if (!enabled) { ++bgmRequest; stopPreview(false); stopOthers(); stopJingles(); } else if (currentKey) playBGM(currentKey); await ensure(); };
  const isEnabled = () => enabled;
  // いま実際に鳴っている曲を、外(検査)から見るための口。
  // BGMは <audio> ではなく Web Audio (AudioBufferSourceNode) で鳴らしているので、
  // document.querySelectorAll('audio') では1つも見えない。
  // そのため起動まわりの検査(tools/boot/boot-check.js)が「鳴っていない」と誤判定していた
  // (2026-09-05)。プレイヤーの画面には何も出ないし、ゲームの動きも変えない。
  const debugPlayingTracks = () => {
    // 曲キーだけでなく、実際に鳴っている音のファイル名も返す。
    // 検査は「bgm-title で始まる」のようにファイル名で見たいため。
    const entry = (kind, key) => {
      const track = resolveTrack(key);
      const url = String(track?.url || track?.src || '');
      return { kind, key: String(key || ''), src: url.split('/').pop().split('?')[0] };
    };
    const list = [];
    // 鳴らしているのは同時に1つ(BGM / 試聴 / ジングル のどれか)
    if (jingleSource) list.push(entry('jingle', currentKey));
    else if (previewSource) list.push(entry('preview', previewKey));
    else if (bgmSource) list.push(entry('bgm', bgmSourceKey));
    return { enabled, ctxState: (() => { try { return getAudioCtx()?.state || 'none'; } catch (e) { return 'none'; } })(), playing: list };
  };
  // 「その場面で本来どの曲が鳴るはずか」も外から引けるようにする。
  // 検査がファイル名を書き写すと、既定を変えたときに黙って落ちるため。
  const debugExpectedSrc = (scene) => {
    const track = resolveTrack(DEFAULT_BGM_ARRANGEMENT[scene]);
    const url = String(track?.url || track?.src || '');
    return url ? url.split('/').pop().split('?')[0] : null;
  };
  if (typeof window !== 'undefined') {
    try { window.__mhAudioDebug = debugPlayingTracks; window.__mhAudioExpectedSrc = debugExpectedSrc; } catch (e) {}
  }
  const setSeVolume = (pct) => { seVolumePct = pct; if (seBus && Tone) { try { seBus.gain.rampTo(_gainFromPct(pct), 0.05); } catch (e) {} } };
  const setBgmVolume = (pct) => { bgmVolumePct = pct; applyTrackGain(resolveTrack(previewKey || currentKey)); if (pct <= 0) { stopPreview(false); stopOthers(); } else if (enabled && currentKey && !previewKey) playBGM(currentKey); };
  const resumeIfNeeded = async () => { await ensureAudioCtxRunning(); if (Tone) { try { await Tone.start(); started = true; } catch (e) {} } if (enabled && currentKey && !bgmSource) playBGM(currentKey); };
  const unlock = async (playTestTone = false) => {
    if (!enabled) { enabled = true; if (typeof window !== 'undefined') window.__mhAudioEnabled = true; applyRhythmMute(); }
    // resume・決定SEはuser activationが残るイベント処理内で開始し、最初の再生前に待たない。
    const ctx = resumeAudioCtxNoWait();
    let toneStart = null;
    if (Tone) {
      try { toneStart = Tone.start(); if (toneStart?.catch) toneStart.catch(() => {}); } catch (e) {}
      if (playTestTone && ready && enabled && seVolumePct > 0) {
        try { const tb = new Tone.Synth({ oscillator:{type:'triangle'}, envelope:{attack:0.005,decay:0.15,sustain:0.1,release:0.2}, volume: -6 }).connect(seBus); const now = Tone.now(); tb.triggerAttackRelease('C5','8n', now); tb.triggerAttackRelease('G5','8n', now+0.12); setTimeout(()=>{ try{tb.dispose();}catch(e){} }, 800); } catch(e){}
      }
    }
    await Promise.all([ensureAudioCtxRunning(), toneStart || Promise.resolve(), load()]);
    started = !!Tone;
    if (currentKey) playBGM(currentKey);
    return !ctx || ctx.state === 'running';
  };
  const ensurePlaying = (key) => { if (enabled && key === currentKey && !bgmSource && !jingleSource) playBGM(key); };
  const isContextRunning = () => !!audioCtx && audioCtx.state === 'running';

  const se = {
    trainingDice: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t=Tone.now(); const n=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:.001,decay:.22,sustain:0},volume:-15}).connect(seBus); n.triggerAttackRelease('8n',t); setTimeout(()=>{try{n.dispose();}catch(e){}},500); },
    trainingDecide: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({volume:-14}).connect(seBus); s.triggerAttackRelease('C6','16n'); setTimeout(()=>{try{s.dispose();}catch(e){}},300); },
    trainingGood: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({volume:-14}).connect(reverb); s.triggerAttackRelease('E6','8n'); setTimeout(()=>{try{s.dispose();}catch(e){}},400); },
    trainingMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.001,decay:.05,sustain:0},volume:-16}).connect(seBus); s.triggerAttackRelease('G5','32n'); setTimeout(()=>{try{s.dispose();}catch(e){}},250); },
    trainingReward: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.003,decay:.15,sustain:0},volume:-12}).connect(reverb); const t=Tone.now(); s.triggerAttackRelease('C6','16n',t); s.triggerAttackRelease('E6','16n',t+.08); setTimeout(()=>{try{s.dispose();}catch(e){}},500); },
    trainingBad: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:.003,decay:.18,sustain:0},volume:-15}).connect(seBus); s.triggerAttackRelease('C3','8n'); setTimeout(()=>{try{s.dispose();}catch(e){}},500); },
    trainingTool: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.003,decay:.2,sustain:0},volume:-13}).connect(reverb); const t=Tone.now(); ['G5','B5','D6'].forEach((n,i)=>s.triggerAttackRelease(n,'16n',t+i*.07)); setTimeout(()=>{try{s.dispose();}catch(e){}},600); },
    trainingGoal: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.PolySynth(Tone.Synth,{volume:-15}).connect(reverb); s.triggerAttackRelease(['C5','E5','G5','C6'],'2n'); setTimeout(()=>{try{s.dispose();}catch(e){}},1200); },
    trainingFail: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.01,decay:.5,sustain:0},volume:-13}).connect(reverb); const t=Tone.now(); s.triggerAttackRelease('E4','4n',t); s.triggerAttackRelease('C4','2n',t+.25); setTimeout(()=>{try{s.dispose();}catch(e){}},1200); },
    attack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -4 }).connect(seBus); s.triggerAttackRelease('C2', '8n', t); const n = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -16 }).connect(seBus); n.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); n.dispose(); } catch (e) {} }, 500); },
    special: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const c = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.18, decay: 0.05, sustain: 0.3, release: 0.1 }, volume: -12 }).connect(reverb); c.triggerAttackRelease('C3', '8n.', t); try { c.frequency.rampTo('C4', 0.22, t); } catch (e) {} const bt = t + 0.26; const boom = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -2 }).connect(seBus); boom.triggerAttackRelease('C1', '4n', bt); const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -12 }).connect(seBus); blast.triggerAttackRelease('8n', bt); const sh = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.2 }, volume: -8 }).connect(reverb); ['C5','G5','C6','E6','G6'].forEach((nn, i) => sh.triggerAttackRelease(nn, '32n', bt + i * 0.05)); setTimeout(() => { try { c.dispose(); boom.dispose(); blast.dispose(); sh.dispose(); } catch (e) {} }, 1400); },
    guard: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.18, release: 0.1 }, harmonicity: 5.1, modulationIndex: 16, resonance: 4000, octaves: 1.2, volume: -20 }).connect(seBus); s.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 500); },
    card: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.03 }, volume: -12 }).connect(seBus); s.triggerAttackRelease('E6', '32n', t); s.triggerAttackRelease('A6', '32n', t + 0.04); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 300); },
    crit: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.1, sustain: 0.1, release: 0.15 }, volume: -8 }).connect(reverb); ['C5','E5','G5','C6','E6'].forEach((n, i) => s.triggerAttackRelease(n, '32n', t + i * 0.04)); const b = new Tone.MembraneSynth({ volume: -6 }).connect(seBus); b.triggerAttackRelease('C2', '8n', t); setTimeout(() => { try { s.dispose(); b.dispose(); } catch (e) {} }, 700); },
    zanSlash: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const swish = (st) => { const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -18 }).connect(reverb); n.triggerAttackRelease('32n', st); const p = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.04 }, volume: -13 }).connect(reverb); p.triggerAttackRelease('C7', '32n', st); try { p.frequency.rampTo('G6', 0.1, st); } catch (e) {} setTimeout(() => { try { n.dispose(); p.dispose(); } catch (e) {} }, 350); }; swish(t); swish(t + 0.09); },
    heal: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 }, volume: -12 }).connect(reverb); ['G4','C5','E5','G5','C6'].forEach((n, i) => s.triggerAttackRelease(n, '16n', t + i * 0.07)); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 900); },
    tap: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }, volume: -16 }).connect(seBus); s.triggerAttackRelease('C6', '64n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 200); },
    enemyAttack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -3 }).connect(seBus); s.triggerAttackRelease('A1', '4n', t); const g = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -12 }).connect(seBus); g.triggerAttackRelease('8n', t); setTimeout(() => { try { s.dispose(); g.dispose(); } catch (e) {} }, 700); },
    enemySpecial: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      // ① 溜め: 下降する不穏なうなり
      const charge = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.25, decay: 0.05, sustain: 0.4, release: 0.1 }, volume: -8 }).connect(seBus);
      charge.triggerAttackRelease('A2', '4n', t); try { charge.frequency.rampTo('A1', 0.4, t); } catch (e) {}
      // ② 大炸裂: 超低音ドゥーン + 金属的インパクト + ホワイトノイズ爆発
      const bt = t + 0.42;
      const boom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 8, envelope: { attack: 0.001, decay: 0.6, sustain: 0 }, volume: 2 }).connect(seBus);
      boom.triggerAttackRelease('C1', '2n', bt);
      const metal = new Tone.MetalSynth({ frequency: 120, envelope: { attack: 0.001, decay: 0.5, release: 0.2 }, harmonicity: 3.5, modulationIndex: 32, resonance: 3000, octaves: 1.5, volume: -10 }).connect(seBus);
      metal.triggerAttackRelease('16n', bt);
      const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -6 }).connect(seBus);
      blast.triggerAttackRelease('4n', bt);
      // ③ 不穏な残響: 不協和音(半音ぶつけ)
      const dread = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.6 }, volume: -16 }).connect(reverb);
      ['C2','C#2','G2'].forEach(n => dread.triggerAttackRelease(n, '2n', bt + 0.05));
      setTimeout(() => { try { charge.dispose(); boom.dispose(); metal.dispose(); blast.dispose(); dread.dispose(); } catch (e) {} }, 2000); },
    // 必殺技の準備(ためる)の音。上へ登っていくうなりと、集まっていくきらめきだけで、
    // 炸裂音は鳴らさない。必殺技そのものの音(enemySpecial)を使うと
    // 「準備しただけなのに撃たれた」ように聞こえてしまうため分けている
    enemyCharge: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      const hum = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.35, decay: 0.1, sustain: 0.5, release: 0.35 }, volume: -14 }).connect(seBus);
      hum.triggerAttackRelease('A1', '2n', t); try { hum.frequency.rampTo('A2', 0.85, t); } catch (e) {}
      const shimmer = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.16, sustain: 0, release: 0.1 }, volume: -18 }).connect(reverb);
      [[0.05,'E5'],[0.24,'G5'],[0.43,'B5'],[0.62,'E6'],[0.8,'B6']].forEach(([tt, n]) => shimmer.triggerAttackRelease(n, '16n', t + tt));
      setTimeout(() => { try { hum.dispose(); shimmer.dispose(); } catch (e) {} }, 1600); },
    enemyMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 }, volume: -14 }).connect(seBus); s.triggerAttackRelease('E4', '32n', t); s.triggerAttackRelease('B3', '16n', t + 0.06); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 400); },
    join: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.4 }, volume: -10 }).connect(reverb); const t = Tone.now(); const seq = [[0,'E5','8n'],[0.15,'G5','8n'],[0.3,'C6','8n'],[0.45,'E6','4n'],[0.45,'C6','4n'],[0.45,'G5','4n'],[0.8,'D6','8n'],[0.95,'E6','4n'],[0.95,'C6','4n'],[0.95,'G5','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 1800); },
    victory: async () => { if (!enabled) return; await ensure(); if (!Tone) return; stopOthers(null); currentKey = null; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }, volume: -19 }).connect(reverb); const vb = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 }, volume: -19 }).connect(seBus); const t = Tone.now(); const seq = [[0,'C5','8n'],[0,'E5','8n'],[0,'G5','8n'],[0.18,'C5','8n'],[0.18,'E5','8n'],[0.18,'G5','8n'],[0.36,'C5','8n'],[0.36,'E5','8n'],[0.36,'G5','8n'],[0.54,'G5','4n'],[0.54,'C6','4n'],[0.54,'E6','4n'],[0.9,'F5','8n'],[0.9,'A5','8n'],[1.08,'G5','8n'],[1.08,'B5','8n'],[1.26,'C6','2n'],[1.26,'E6','2n'],[1.26,'G6','2n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); [[0,'C3'],[0.54,'C3'],[0.9,'F2'],[1.08,'G2'],[1.26,'C3']].forEach(([tt, n]) => vb.triggerAttackRelease(n, '4n', t + tt)); setTimeout(() => { try { v.dispose(); vb.dispose(); } catch (e) {} }, 2600); },
    levelUp: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 }, volume: -12 }).connect(reverb); const seq = [[0,'C5','16n'],[0.08,'E5','16n'],[0.16,'G5','16n'],[0.24,'C6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const sp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 }, volume: -16 }).connect(reverb); sp.triggerAttackRelease('C6', '2n', t + 0.24); setTimeout(() => { try { v.dispose(); sp.dispose(); } catch (e) {} }, 1200); },
    // 合体演出用: 上昇アルペジオ→(両者が重なるタイミングで)ベルの一撃+きらめき和音の「ピカーン」
    fusion: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.5 }, volume: -10 }).connect(reverb); const seq = [[0,'C5','8n'],[0.12,'E5','8n'],[0.24,'G5','8n'],[0.36,'C6','8n'],[0.48,'E6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const bt = t + 0.6; const bell = new Tone.MetalSynth({ frequency: 800, envelope: { attack: 0.001, decay: 0.6, release: 0.3 }, harmonicity: 8, modulationIndex: 20, resonance: 5000, octaves: 1.5, volume: -14 }).connect(reverb); bell.triggerAttackRelease('16n', bt); const sparkle = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 }, volume: -12 }).connect(reverb); ['C6','E6','G6','C7'].forEach((n, i) => sparkle.triggerAttackRelease(n, '8n', bt + i * 0.03)); setTimeout(() => { try { v.dispose(); bell.dispose(); sparkle.dispose(); } catch (e) {} }, 2200); }
  };

  return { playBGM, stopBGM, startRhythmTrack, previewBGM, stopPreview, setEnabled, isEnabled, setSeVolume, setBgmVolume, unlock, resumeIfNeeded, setPageHidden, preloadBGM, prepareBGM, prepareSE, playJingle, ensurePlaying, isContextRunning, se };
})();


const MOO_IMG = "";


// --- Game Data ---
const RANGE_LABELS = ["零", "近", "中", "遠"];
const rangeAttackDamageMultiplier = (card, attackStartDist) => {
  if (!card || card.type !== 'range_atk') return card?.mult || card?.baseMult || 1.0;
  return attackStartDist === card.rangeIdx ? card.mult : card.mult * 0.4;
};
// モンスターごとの間合い(距離)適性。距離ラベル配列と同じ並び([零,近,中,遠])のグレードを
// distAptitude:['C','C','C','C'] の形でモンスターデータに持たせ、そのモンスターが
// 該当スロットで攻撃した時のダメージに以下の倍率を掛ける。値は今後モンスターごとに調整予定。
// グレード配列: 下から上へ。C(=0%)を基準にG~Sは±5%刻み、S以上(S+~M)は+2.5%刻みで頭打ちはM(+25%)
// マスモンの「染色もどき」: Canvas上でHSVを直接置き換える簡易パレットスワップ。
// 元絵の全色相を一律にずらすだけの処理のため、モンスターによって仕上がりの色味は変わる("もどき")
// 以前はCSSのgrayscale/sepia/hue-rotateを重ねる方式だったが、grayscale()が知覚輝度(赤や青は
// 暗く見える重み)で明度を潰すため、部位の元の色によって同じ「白」「黒」でも明るさがバラバラに
// なったり、色付きの部位が元の色相の名残でくすんで見えたりする不具合があった。
// 現在は各ピクセルをHSVに変換し、色相・彩度は狙った色に固定で置き換え、明度(v)だけは元の陰影を
// 保つように狙った範囲(vMin〜vMax)へ線形に写像する方式にして、元の色に関わらず安定した発色にしている。
const MASU_COLOR_TARGET = {
  red: { h: 355, s: 0.8, vMin: 0.35, vMax: 0.95 },
  orange: { h: 28, s: 0.85, vMin: 0.4, vMax: 0.98 },
  yellow: { h: 48, s: 0.85, vMin: 0.45, vMax: 1.0 },
  lime: { h: 78, s: 0.75, vMin: 0.4, vMax: 0.95 },
  green: { h: 135, s: 0.65, vMin: 0.35, vMax: 0.9 },
  teal: { h: 168, s: 0.6, vMin: 0.3, vMax: 0.85 },
  cyan: { h: 190, s: 0.7, vMin: 0.35, vMax: 0.95 },
  sky: { h: 200, s: 0.75, vMin: 0.4, vMax: 0.98 },
  blue: { h: 220, s: 0.75, vMin: 0.35, vMax: 0.95 },
  purple: { h: 265, s: 0.65, vMin: 0.3, vMax: 0.9 },
  magenta: { h: 300, s: 0.65, vMin: 0.35, vMax: 0.95 },
  pink: { h: 330, s: 0.65, vMin: 0.4, vMax: 0.98 },
  black: { h: 0, s: 0, vMin: 0.06, vMax: 0.32 },
  white: { h: 0, s: 0, vMin: 0.78, vMax: 1.0 },
  gray: { h: 0, s: 0, vMin: 0.5, vMax: 0.82 },
};
// 薄め(パステル)系: 彩度を抑えて明度レンジを底上げし、鮮やかな色よりふんわりした発色にする
['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'purple', 'magenta', 'pink'].forEach((k) => {
  const t = MASU_COLOR_TARGET[k];
  MASU_COLOR_TARGET[k + '_light'] = { h: t.h, s: t.s * 0.45, vMin: Math.min(0.6, t.vMin + 0.2), vMax: 1.0 };
});
const MASU_COLOR_LABELS = { red: '赤', orange: '橙', yellow: '黄', lime: '黄緑', green: '緑', teal: '青緑', cyan: 'シアン', sky: '空色', blue: '青', purple: '紫', magenta: 'マゼンタ', pink: 'ピンク', black: '黒', white: '白', gray: '薄灰', red_light: '薄赤', orange_light: '薄橙', yellow_light: '薄黄', lime_light: '薄黄緑', green_light: '薄緑', teal_light: '薄青緑', cyan_light: '薄水色', sky_light: '薄空色', blue_light: '薄青', purple_light: '薄紫', magenta_light: '薄マゼンタ', pink_light: '薄ピンク' };
const MASU_COLOR_SWATCH = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', lime: '#84cc16', green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4', sky: '#38bdf8', blue: '#3b82f6', purple: '#a855f7', magenta: '#d946ef', pink: '#ec4899', black: '#1f2937', white: '#f8fafc', gray: '#cbd5e1', red_light: '#fca5a5', orange_light: '#fdba74', yellow_light: '#fde047', lime_light: '#bef264', green_light: '#86efac', teal_light: '#5eead4', cyan_light: '#67e8f9', sky_light: '#7dd3fc', blue_light: '#93c5fd', purple_light: '#d8b4fe', magenta_light: '#f0abfc', pink_light: '#f9a8d4' };
// 「カスタム」色: プリセット18色に無い任意の色相・彩度・明度を選べるようにするため、
// 色id文字列自体に "custom:色相:彩度:明度"(彩度・明度は0-100の整数)を埋め込んでエンコードする。
// masu.colorsは元々ただの文字列配列なので、この方式ならデータモデルを変えずに保存できる
const _encodeCustomColorId = (h, s, v) => `custom:${Math.round(h)}:${Math.round(s * 100)}:${Math.round(v * 100)}`;
// 【部位ごとの透け具合(濃さ)】
// 色idの末尾に "@60" のように付ける。付いていなければ100%(そのまま塗る)。
//
// なぜ色idへ埋めるか: 染色データ(masu.colors)は文字列の配列で、画面の49か所へ
// そのまま流れている。別の配列を足すと49か所すべてに配り直すことになり、
// 渡し漏れた画面だけ濃さが効かない、という壊れ方をする。
// 色idに含めておけば、色が流れるところへ必ず濃さも一緒に流れる。
// 100%のときは "@100" を付けないので、濃さをいじっていない既存データは1文字も変わらない。
const MASU_COLOR_ALPHA_MIN = 10;   // これ未満は「色を選んだのに見えない」ので下限にする
const MASU_COLOR_ALPHA_MAX = 100;
const _clampColorAlpha = (pct) => Math.max(MASU_COLOR_ALPHA_MIN, Math.min(MASU_COLOR_ALPHA_MAX,
  Math.round(Number.isFinite(Number(pct)) ? Number(pct) : MASU_COLOR_ALPHA_MAX)));
// 色idを「色そのもの」と「濃さ(%)」に分ける。壊れた値・古い値は濃さ100%として読む
const splitColorAlpha = (colorId) => {
  if (typeof colorId !== 'string') return { base: colorId, alpha: MASU_COLOR_ALPHA_MAX };
  const at = colorId.lastIndexOf('@');
  if (at < 0) return { base: colorId, alpha: MASU_COLOR_ALPHA_MAX };
  const pct = Number(colorId.slice(at + 1));
  if (!Number.isFinite(pct)) return { base: colorId, alpha: MASU_COLOR_ALPHA_MAX };
  return { base: colorId.slice(0, at), alpha: _clampColorAlpha(pct) };
};
// 色idへ濃さを付け直す。100%のときは付けない(既存データと同じ文字列に保つ)
const withColorAlpha = (colorId, pct) => {
  if (typeof colorId !== 'string' || !colorId) return colorId;
  const { base } = splitColorAlpha(colorId);
  const alpha = _clampColorAlpha(pct);
  return alpha >= MASU_COLOR_ALPHA_MAX ? base : `${base}@${alpha}`;
};
const colorAlphaOf = (colorId) => splitColorAlpha(colorId).alpha;
const _parseCustomColorId = (rawColorId) => {
  const colorId = splitColorAlpha(rawColorId).base;
  if (typeof colorId !== 'string' || !colorId.startsWith('custom:')) return null;
  const parts = colorId.slice(7).split(':').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  const [h, s, v] = parts;
  return { h: Math.max(0, Math.min(360, h)), s: Math.max(0, Math.min(1, s / 100)), v: Math.max(0, Math.min(1, v / 100)) };
};
// プリセット色id・カスタム色idのどちらでも、染色エンジンが使う{h,s,vMin,vMax}形式に解決する
const _resolveColorTarget = (rawColorId) => {
  // 濃さ(@NN)は塗る色そのものには関係しないので、ここで外してから解決する
  const colorId = splitColorAlpha(rawColorId).base;
  if (MASU_COLOR_TARGET[colorId]) return MASU_COLOR_TARGET[colorId];
  const custom = _parseCustomColorId(colorId);
  if (!custom) return null;
  // プリセットは狙った明度を中心に前後へ幅を持たせて元絵の陰影を残す(だいたい0.5〜0.6幅)ため、
  // カスタムも選んだ明度(v)を中心に同じくらいの幅を取ってレンジ化する
  const vMin = Math.max(0.05, custom.v - 0.32);
  const vMax = Math.min(1.0, Math.max(custom.v + 0.24, vMin + 0.2));
  return { h: custom.h, s: custom.s, vMin, vMax };
};
const getColorSwatchHex = (rawColorId) => {
  // 見本の丸は「どの色か」を示すものなので、濃さ(@NN)は外して色だけを見る
  const colorId = splitColorAlpha(rawColorId).base;
  if (MASU_COLOR_SWATCH[colorId]) return MASU_COLOR_SWATCH[colorId];
  const custom = _parseCustomColorId(colorId);
  if (!custom) return '#64748b';
  const [r, g, b] = _hsvToRgb(custom.h, custom.s, Math.max(0.35, custom.v));
  return `rgb(${r},${g},${b})`;
};
// モンスター種ごとの「染色もどき」部位分割データ。各要素は画像内でその部位が持つ代表色相(度)。
// 事前にモンスター画像を解析して求めた、染色可能な部位ごとの判定条件。
// 各要素は次のいずれか:
//   数値(色相の角度)                    … その色相に最も近い彩度のあるピクセルを対象にする
//   {hue, vMin?, vMax?, sMin?, sMax?}     … 同じ色相でも明度・彩度が違う部位を区別したい場合(例: 体は明るい黄、目は暗い黄)
//   {hue, bbox?:[x0,y0,x1,y1]}           … 画像内の特定範囲(0〜1の相対座標)に絞って同じ色相の部位を区別したい場合
//   {white:true, sMax?, vMin?}           … 彩度が低い明るい部位(白目・白い毛など)を対象にする
//   {band:[y0,y1]}                       … 色を問わず、画像の縦位置(0〜1)だけで区切りたい場合(単色の直方体など)
//   [def, def, ...]                      … 上記のいずれかを複数並べ、いずれかにマッチすれば同じ1部位として扱う
//                                          (例: 色相の判定+離れた場所の白い部位を1つの染色枠にまとめたい場合)
//   {..., notBbox:[x0,y0,x1,y1] または矩形の配列} … その部位から必ず外す範囲(bboxの逆)
// 配列が空/未定義のモンスターは部位分割が綺麗に取れなかった(単色に近い等)ため、従来通り全身一括の染色のみ対応。
//
// 人魚2体の目は髪と同系色で、色だけでは分離できないため実測した範囲で必ず染色対象から外す。
const UNDINE_EYE_BOXES = [[0.370, 0.152, 0.438, 0.196], [0.498, 0.152, 0.567, 0.196]];
// ウンディーネの肌は、顔・首・耳・両腕・尾を別々に実測した範囲で判定する。
// 一枚の胴体矩形にすると衣装を巻き込み、反対に細すぎると髪の下の肩や首が消えるため、
// 輪郭の曲がりに合わせた小矩形を重ねている。色相条件も併用するので、矩形内の髪・衣装は染まらない。
const UNDINE_SKIN_PART_BOXES = [
  // 顔、左耳、右耳
  [0.315, 0.095, 0.685, 0.238], [0.255, 0.135, 0.375, 0.198], [0.625, 0.135, 0.745, 0.198],
  // 首（顎下から襟の合わせまで）
  [0.435, 0.225, 0.565, 0.315],
  // 左腕（肩から指先）
  [0.320, 0.275, 0.440, 0.325], [0.295, 0.315, 0.415, 0.375],
  [0.265, 0.365, 0.385, 0.425], [0.235, 0.415, 0.355, 0.475], [0.220, 0.465, 0.320, 0.540],
  // 右腕（肩から指先）
  [0.560, 0.275, 0.680, 0.325], [0.585, 0.315, 0.705, 0.375],
  [0.615, 0.365, 0.735, 0.425], [0.645, 0.415, 0.765, 0.475], [0.680, 0.465, 0.780, 0.540],
  // 腰から尾の付け根、尾、左右の尾びれ
  [0.330, 0.475, 0.670, 0.620], [0.285, 0.600, 0.715, 0.790],
  [0.000, 0.770, 0.535, 1.000], [0.465, 0.770, 1.000, 1.000],
];
const YAOBIKUNI_EYE_BOXES = [[0.378, 0.146, 0.444, 0.192], [0.500, 0.146, 0.568, 0.192]];
// 頭と顔。ピンクの判定を薄い毛先まで届かせるため彩度の下限を0.16まで下げているので、
// 頭頂の照り返し(彩度が抜けて色相が暖色へ振れる)や顔の陰影がピンク側へ流れないよう、
// 頭から顎までをまとめてピンクの判定から外す。ピンクの毛はここより下にしか無い。
// 髪・衣装(染色①③)はこの範囲でもそのまま染まる
const YAOBIKUNI_FACE_BOX = [[0.345, 0.0, 0.655, 0.208], [0.315, 0.145, 0.375, 0.205], [0.625, 0.145, 0.685, 0.205]];
const MASU_COLOR_REGION_HUES = {
  // ミーアは正解見本から埋め込んだ部位マップで境界を固定する。以下は3レイヤーを既存経路へ知らせる控え。
  Mia: [
    { hue: 0, noAAGuard: true, noEdgeGuard: true },
    { hue: 120, noAAGuard: true, noEdgeGuard: true },
    { hue: 240, noAAGuard: true, noEdgeGuard: true },
  ],
  // 2026年8月の新規透過イラストへ差し替え。体(染色①)・頭の葉(染色②)・口ばし(染色③)を色相で分ける。
  // 色相はイラストの実測値に合わせてある(体=330〜345のパステルピンク、葉=90前後、口ばし=30〜45の黄橙)。
  // 以前は体を350、口ばしを45+範囲指定にしていたが、実際の色とずれていたため
  // 腕と体の境目に白い点線状の塗り残しが出て、口ばしも半分しか染まっていなかった。
  // noEdgeGuard は「隣と色相が違う画素を無染色で残す」既定の除外を切るための指定。
  // モッチーは見えている部分がすべてどれかの部位に属するので、境目を残すと
  // 部位と部位のあいだに元の色の筋が出てしまう。切ることで境目がぴったり合う。
  Mocchi: [
    { hue: 332, sMin: 0.06, noEdgeGuard: true },
    { hue: 90, sMin: 0.2, noEdgeGuard: true },
    { hue: [35, 12], sMin: 0.22, vMin: 0.3, noEdgeGuard: true },
  ],
  // 2026年に新規イラストへ差し替え。体(明るい黄)と瞳(暗い黄褐色)は同じ色相のため、
  // 明度で明暗を分けて別部位にしている(白目・彩度の低い部分は染色対象外のまま)。
  // 画像はダウンスケールせず元の解像度に近い状態のまま実装している。口(染色③)は
  // 瞳の下に三日月形で見える部位。単純な色相の閾値スキャンだと、瞳の暗部が偶然
  // 同じ色相域に誤判定され口と瞳の間を橋渡しして瞳まで巻き込んでしまっていたため、
  // 口の左右それぞれから色距離ベースのflood-fillで輪郭を実測し、行ごとに(瞳を挟んだ
  // 左右を橋渡ししないよう)セグメント単位で矩形を積み重ねている
  Suezo: [{ hue: 45, sMin: 0.3, vMin: 0.55 }, { hue: 45, sMin: 0.3, vMax: 0.55 }, { posBbox: [[0.2799,0.4901,0.2922,0.4935],[0.2773,0.4935,0.293,0.497],[0.7078,0.4935,0.7236,0.497],[0.2764,0.497,0.293,0.5004],[0.7061,0.497,0.7262,0.5004],[0.2773,0.5004,0.2939,0.5039],[0.7044,0.5004,0.727,0.5039],[0.2816,0.5039,0.2956,0.5073],[0.7035,0.5039,0.7244,0.5073],[0.2825,0.5073,0.2991,0.5108],[0.7009,0.5073,0.7201,0.5108],[0.2833,0.5108,0.3025,0.5142],[0.6983,0.5108,0.7184,0.5142],[0.2833,0.5142,0.306,0.5177],[0.6949,0.5142,0.7167,0.5177],[0.2842,0.5177,0.3094,0.5211],[0.6914,0.5177,0.715,0.5211],[0.2859,0.5211,0.3137,0.5246],[0.688,0.5211,0.7132,0.5246],[0.2885,0.5246,0.3181,0.528],[0.6837,0.5246,0.7106,0.528],[0.2937,0.528,0.3224,0.5315],[0.6802,0.528,0.7063,0.5315],[0.298,0.5315,0.3258,0.5349],[0.6759,0.5315,0.7003,0.5349],[0.3032,0.5349,0.331,0.5384],[0.6716,0.5349,0.6951,0.5384],[0.3049,0.5384,0.3362,0.5418],[0.6673,0.5384,0.6925,0.5418],[0.3066,0.5418,0.3431,0.5453],[0.6621,0.5418,0.6899,0.5453],[0.3092,0.5453,0.3465,0.5487],[0.6569,0.5453,0.6882,0.5487],[0.3109,0.5487,0.3517,0.5522],[0.6509,0.5487,0.6865,0.5522],[0.3135,0.5522,0.3578,0.5557],[0.6448,0.5522,0.6848,0.5557],[0.3161,0.5557,0.3647,0.5591],[0.6388,0.5557,0.6822,0.5591],[0.3187,0.5591,0.3716,0.5626],[0.6319,0.5591,0.6796,0.5626],[0.3213,0.5626,0.3793,0.566],[0.6233,0.5626,0.677,0.566],[0.3239,0.566,0.388,0.5695],[0.6146,0.566,0.6753,0.5695],[0.3265,0.5695,0.3974,0.5729],[0.6034,0.5695,0.6718,0.5729],[0.329,0.5729,0.4112,0.5764],[0.5922,0.5729,0.6692,0.5764],[0.3325,0.5764,0.4225,0.5798],[0.5827,0.5764,0.6666,0.5798],[0.3351,0.5798,0.438,0.5833],[0.5646,0.5798,0.6632,0.5833],[0.3385,0.5833,0.4673,0.5867],[0.5447,0.5833,0.6606,0.5867],[0.342,0.5867,0.5553,0.5902],[0.5102,0.5867,0.6571,0.5902],[0.3454,0.5902,0.6511,0.5936],[0.5232,0.5902,0.6537,0.5936],[0.3498,0.5936,0.6502,0.5971],[0.3506,0.5971,0.6459,0.6005],[0.6362,0.5971,0.6459,0.6005],[0.3541,0.6005,0.6442,0.604],[0.6328,0.6005,0.6425,0.604],[0.3584,0.604,0.639,0.6074],[0.6284,0.604,0.6382,0.6074],[0.3636,0.6074,0.6347,0.6109],[0.3679,0.6109,0.6304,0.6143],[0.3713,0.6143,0.6261,0.6178],[0.3782,0.6178,0.6209,0.6212],[0.3843,0.6212,0.6157,0.6247],[0.3894,0.6247,0.6097,0.6281],[0.3955,0.6281,0.6037,0.6316],[0.5663,0.6281,0.6054,0.6316],[0.4024,0.6316,0.57,0.635],[0.5594,0.6316,0.5968,0.635],[0.4093,0.635,0.5614,0.6385],[0.5508,0.635,0.5898,0.6385],[0.4145,0.6385,0.5519,0.6419],[0.5016,0.6385,0.5829,0.6419],[0.4222,0.6419,0.5105,0.6454],[0.5025,0.6419,0.5778,0.6454],[0.4326,0.6454,0.5597,0.6488],[0.5085,0.6454,0.5691,0.6488],[0.4412,0.6488,0.5571,0.6523],[0.543,0.6488,0.5597,0.6523],[0.4533,0.6523,0.545,0.6557],[0.5292,0.6523,0.5484,0.6557],[0.4636,0.6557,0.5286,0.6592],[0.4964,0.6557,0.5346,0.6592]], noAAGuard: true, noEdgeGuard: true }],
  // ほぼ単色の岩肌のため色相だけでは部位を分けられないが、3部位に分けたいという要望を受け、
  // 位置だけで区切るposBbox(色を問わない)を使って両腕・両脚を強制的に別部位にした
  // (頭部・胴体は他のどのposBboxにも属さない残りとして自動的に染色①になる)
  Golem: [{ hue: 30, sMin: 0.08 }, { posBbox: [[0.0, 0.20, 0.30, 0.82], [0.70, 0.20, 1.0, 0.82]] }, { posBbox: [[0.0, 0.82, 1.0, 1.0]] }],
  // 2026年に新規イラストへ差し替え。全身の紫がかった青毛(染色①)、白い胸元・腹(染色②)、
  // 頭上の角(染色③、地味な差し色なので未設定時は染色①の色を引き継ぐ。MASU_COLOR_FALLBACK_REGION参照)
  // の3部位。新イラストはICON/IMGとも同じ構図(process-new-art.jsで正方形に統一済み)で作成しているため、
  // 旧イラストで必要だった部位ごとのサイズ別posBbox補正(MASU_COLOR_REGION_SIZE_OVERRIDES)は不要になった
  // 尻尾の先端が体本体と同じ青紫の色相ながら彩度が非常に低い(薄い水色寄りの陰影)ため、
  // bbox無しの白バケツだと尻尾まで白(染色②)に誤判定されてしまう。体の輪郭(尻尾を除く胴体・脚・顔)
  // の実測範囲にbboxを絞り、尻尾側は常に染色①(体の毛)のままになるようにしている
  Tiger: [{ hue: 235, sMin: 0.1, vMin: 0.3 }, { white: true, sMax: 0.16, vMin: 0.55, bbox: [0.05, 0.20, 0.63, 1.0] }, { hue: 38, sMin: 0.15 }],
  Ham: [25, { white: true, sMax: 0.35, vMin: 0.7 }, 355],
  // 2026年に新規イラスト(悪魔っ子)へ差し替え。染色②は要望により地肌(顔・腕・お腹・脚、
  // 彩度0.05〜0.15程度の低彩度)にした。髪・衣装(hue321〜350のグラデーション)は彩度が
  // ずっと高いため、白バケツ(染色②)とは彩度の閾値だけで衝突なく住み分けられる。
  // 翼は染色③(衣装)側の色相・彩度と近すぎるため、色を問わず位置で強制するposBboxにして
  // 衣装と同じ染色③にまとめている(でないと髪色/衣装色のどちらつかずで斑になる)
  Pixie: [{ hue: 321, sMin: 0.15, bbox: [0.25, 0.0, 0.75, 0.30] }, { white: true, sMax: 0.2, vMin: 0.6 }, [{ hue: 347, sMin: 0.15, bbox: [0.0, 0.28, 1.0, 1.0] }, { posBbox: [[0.02, 0.28, 0.30, 0.55], [0.68, 0.28, 0.98, 0.55]] }]],
  Monol: [{ band: [0, 1/3] }, { band: [1/3, 2/3] }, { band: [2/3, 1] }],
  // 花の中心(淡い黄色、hue50前後)は彩度が0.18前後あり白バケツ(sMax0.18)に入りきらず、
  // どの部位にも属さないまま常に無染色で残っていた(花びらだけ染まって中心だけ元の黄色が浮く)ため、
  // 花びらと同じ染色①にまとめて含めた
  Oboro: [[{ hue: 239 }, { hue: 50, sMax: 0.3, vMin: 0.8 }], { hue: 205 }, { white: true, sMax: 0.18, vMin: 0.85 }],
  // オボロゲソウと同じ「花／葉と茎／白い本体」の3部位。
  // 花の内側(淡いピンク)と体(ほぼ白)はどちらも低彩度で、色相・彩度の閾値だけでは
  // どうしても互いに混ざってごま塩状に汚れる。そのため2026年8月に正式マスク
  // plant-dye-mask.PNG(EXACT_DYE_MASKS)へ移行し、染色①②③はそちらが正本になった
  // (作り直しは node tools/image/make-plant-dye-mask.js、検査は plant-dye-mask-check.js)。
  // 以下の色相定義は部位数(3)を決めるためと、正式マスクを使えなかったときの控えとして残している。
  Plant: [
    [
      { hue: 350, sMin: 0.48, vMin: 0.72, bbox: [[0.12,0.00,0.88,0.43],[0.08,0.17,0.38,0.46],[0.62,0.17,0.92,0.46]], noEdgeGuard: true },
      { white: true, sMax: 0.16, vMin: 0.82, bbox: [[0.12,0.00,0.88,0.43],[0.08,0.17,0.38,0.46],[0.62,0.17,0.92,0.46]], noEdgeGuard: true },
      { hue: 48, sMin: 0.45, vMin: 0.72, bbox: [[0.12,0.00,0.88,0.43],[0.08,0.17,0.38,0.46],[0.62,0.17,0.92,0.46]], noEdgeGuard: true },
    ],
    { hue: [108, 158], sMin: 0.35, vMin: 0.28, bbox: [0.08,0.26,0.92,0.76], noEdgeGuard: true },
    { posBbox: [[0.35,0.49,0.65,0.80],[0.28,0.69,0.44,0.91],[0.56,0.69,0.72,0.91]], noAAGuard: true, noEdgeGuard: true },
  ],
  // 2026年に新規イラストへ差し替え。ほぼ単色の甲殻(染色①)+赤い目(染色②、小さいのでsMinを
  // 上げて実測範囲のみ拾う)+両腕・翼(染色③、色相は本体とほぼ同じなので位置指定で分離)
  // 2026年8月の新規イラストへ差し替え。体(染色①)・目の赤(染色②)・両腕の刃(染色③)。
  // 体は彩度がとても低い(実測S0.22前後)ので sMin を下げないと大半が無染色で残る。
  Zan: [
    { hue: 230, sMin: 0.04, noEdgeGuard: true },
    { hue: 2, sMin: 0.4, noEdgeGuard: true },
    { posBbox: [[0.0, 0.30, 0.30, 0.88], [0.70, 0.30, 1.0, 0.88]], noAAGuard: true, noEdgeGuard: true },
  ],
  // エイキは承認済みマスク(EXACT_DYE_MASKS)が正本なので、ここは
  // 「3レイヤーある」ことを既存経路へ知らせるための控え(ミーアと同じ形)。
  // 染色①=髪+腹部のリボン・桜系装飾 / 染色②=刀身+足元オーラ / 染色③=鎧(足本体も③)
  Eiki: [
    { hue: 0, noAAGuard: true, noEdgeGuard: true },
    { hue: 120, noAAGuard: true, noEdgeGuard: true },
    { hue: 240, noAAGuard: true, noEdgeGuard: true },
  ],
  // 2026年に新規イラストへ差し替え。体(赤、染色①)・お腹/頭上クレスト/翼の金色(染色②)・
  // 口元(染色③)の3部位。
  // 以前は口元を位置だけで決めるposBboxで指定していたが、矩形を積み重ねた形が実際の口の輪郭と
  // 合っておらず、赤い頬まで青く塗り分けられて一番汚い見た目になっていた。
  // クレスト・お腹・翼・爪・口元はどれも同じ金色なので色相だけでは分けられないが、
  // 口元だけは頭部の中央(縦0.265〜0.40・横0.29〜0.71)に収まっているため、
  // 「金色」という色の条件に、口元とそれ以外を分けるbboxを組み合わせて切り分けている。
  // こうすると判定が実際の塗りの形に沿うので、赤い部分を巻き込むことがない
  // (元絵の実測値: 赤はS0.82〜0.91、金色はS0.40〜0.65、口元は縦0.265〜0.395の範囲)
  Mitarashi: [
    { hue: 0, sMin: 0.3 },
    { hue: 38, sMin: 0.25, bbox: [[0.15, 0.0, 0.85, 0.265], [0.0, 0.265, 0.29, 1.0], [0.71, 0.265, 1.0, 1.0], [0.29, 0.40, 0.71, 1.0]] },
    { hue: 38, sMin: 0.25, bbox: [0.29, 0.265, 0.71, 0.40], noEdgeGuard: true },
  ],
  // 2026年8月の新規イラストへ差し替え。体と翼の青(染色①)・白い羽と胸の紋章(染色②)・
  // 王冠と輪の金(染色③)を、実測した色に合わせて分ける。
  // noEdgeGuard は「隣と色相が違う画素を無染色で残す」既定の除外を切るための指定
  // (見えている部分がすべてどれかの部位に属するので、境目を残すと元の色の筋が出る)。
  Ark: [
    { hue: 200, sMin: 0.10, noEdgeGuard: true },
    { white: true, sMax: 0.2, vMin: 0.7, noEdgeGuard: true },
    { hue: [45, 30], sMin: 0.15, vMin: 0.4, noEdgeGuard: true },
  ],
  // 2026年に新規イラスト(羊の天使)へ差し替え。もふもふの白い毛(染色①)、紫のパーツ(染色②)、
  // 翼の黒(染色③)の3部位。元絵の実測値(高解像度版570px)に基づいて次のように切り分けている。
  //  ・白い毛: ほぼ白(彩度0.02)〜薄いピンク紫の影(色相295〜326・彩度0.06〜0.19・明度0.85以上)。
  //    彩度の上限を0.20にしてあるのは、体の下側の毛先の影(彩度0.156〜0.19)まで拾いつつ、
  //    お腹の模様の水色(彩度0.21)は拾わないようにするため。以前は0.15だったので毛先の影が
  //    どの部位にも属さず、染色したとき体の下側だけ元の色が残っていた
  //  ・紫のパーツ: 輪(色相281・彩度0.62)、耳と鼻(色相273・彩度0.49)、首元(色相278・彩度0.45)、
  //    顔・前足・後ろ足(色相263〜271・彩度0.26〜0.34・明度0.42〜0.51)、顔の輪郭線(明度0.2前後)。
  //    元絵では顔・前足・後ろ足はどれも同じ濃い紫で塗られているため、まとめて1部位にしている
  //  ・翼: 同じ紫系でも明度が0.17〜0.33と明確に暗い。明度の上限0.34で前足(明度0.44以上)と分かれる
  Iblis: [
    { white: true, sMax: 0.20, vMin: 0.80, bbox: [0.24, 0.14, 0.76, 0.82] },
    { hue: 272, sMin: 0.18, vMin: 0.15, bbox: [0.16, 0.13, 0.84, 0.82] },
    { white: true, sMax: 0.55, vMin: 0.05, vMax: 0.34, bbox: [[0.02, 0.42, 0.34, 0.80], [0.64, 0.42, 0.98, 0.80]] },
  ],
  // 2026年8月に追加した人魚。髪とヒレの青緑(染色①)・サンタの帽子と衣装の赤(染色②)・
  // 体と尾の淡い水色(染色③)の3部位。元絵の実測値は次のとおり。
  //  ・青緑: 色相175〜190・彩度0.65〜0.90(髪、耳、両脇のヒレ、尾びれの先)
  //  ・赤:   色相350〜358・彩度0.80〜0.90(帽子と衣装。ほかに赤い色相は無いので取り違えない)
  //  ・淡い水色: 色相195〜215・彩度0.08〜0.30(腕、おなか、尾)。青緑とは色相が近いが
  //    彩度がはっきり分かれる(0.30を境に上が青緑、下が淡い水色)ため、sMin/sMaxで確実に切れる
  // 尾はほぼ白の部分が広く、彩度だけでは拾えないので白バケツも③に足す。ただし白は
  // 帽子と衣装のふち・肌・白目にも使われているため、bboxで尾のある範囲だけに絞る。
  // noEdgeGuard は「隣と色相が違う画素を無染色で残す」既定の除外を切るための指定
  // (髪と衣装、体と尾のように部位どうしが直に接するので、境目を残すと元の色の筋が出る)。
  // 2026年8月に追加した人魚2体。髪・肌・衣装の境界を実画像の色と位置で分ける。
  // どちらも瞳が髪と同系色(ウンディーネ=青、ヤオビクニ=緑)で、彩度・明度でも切り分けられないため、
  // 髪の判定から左右の目だけを notBbox で外している(目・白目は染めない)。
  //  ・ウンディーネ: 髪(染色①)/肌(顔・腕・尻尾、染色②)/白い衣装(染色③)
  //    衣装は明るい部分が彩度0.05〜0.20、影とベルトが0.22〜0.60と幅があるので、
  //    白バケツ+色相の2条件を同じ枠にまとめて拾う(片方だけだと裾や影が虫食いになる)
  Undine: [
    // 髪と尾は同じ青(色相210〜218)なので、髪として見る範囲を体より外側へ限る。
    // 胸から下まで全幅を髪にすると、スカートの合わせから覗く尾まで髪の色で染まってしまう
    { hue: 218, sMin: 0.45, bbox: [[0.0, 0.0, 1.0, 0.30], [0.0, 0.30, 0.455, 0.38], [0.545, 0.30, 1.0, 0.38],
      [0.0, 0.38, 0.355, 0.50], [0.645, 0.38, 1.0, 0.50],
      // 腰より下は髪の外側の毛先だけに限定する。右へ曲がる尻尾も髪と同じ色相なので、
      // ここを全幅の矩形にすると尻尾の付け根から中央のヒレまで染色①へ食い込む。
      [0.0, 0.50, 0.36, 0.62], [0.70, 0.50, 1.0, 0.62],
      [0.0, 0.62, 0.30, 0.70], [0.78, 0.62, 1.0, 0.70]], notBbox: UNDINE_EYE_BOXES, noEdgeGuard: true },
    // 肌。顔・腕は低彩度の水色、尻尾は彩度の高い青なので位置と色相を併用する。
    [
      // 白目を拾わないよう白バケツではなく、肌に残っているごく薄い青の色相で判定する。
      { hue: 200, sMin: 0.025, sMax: 0.44, vMin: 0.58, bbox: [[0.315, 0.095, 0.685, 0.285], [0.265, 0.275, 0.435, 0.540], [0.565, 0.275, 0.735, 0.540], [0.285, 0.475, 0.715, 0.790]], noEdgeGuard: true, noAAGuard: true },
      // 耳と両腕（指先を含む）は髪より彩度が高い箇所もあるため、低彩度側の条件だけでは
      // 髪（色相218）へ近い画素が染色①に流れる。肌の実測範囲内では彩度上限を設けず、
      // 肌本来の色相200との距離で髪から分離する。中央の範囲は衣装の隙間から見える尾を拾う。
      { hue: 200, sMin: 0.20, bbox: UNDINE_SKIN_PART_BOXES, notBbox: UNDINE_EYE_BOXES, noEdgeGuard: true, noAAGuard: true },
      // 前腕の水面模様は白に近く色相が不安定になる。服と重ならない腕の外側だけを白バケツで補い、
      // 模様を元色の島として残さず、肩から手先まで一続きの肌マスクにする。
      { white: true, sMax: 0.80, vMin: 0.62, bbox: [[0.220, 0.335, 0.365, 0.540], [0.635, 0.335, 0.780, 0.540]], noEdgeGuard: true, noAAGuard: true },
      // 尾びれは透けていて彩度が0.2台まで落ち、半透明なので既定の「にじみ除外」でも消える。
      // 尾の先だけ彩度の下限を下げ、半透明でも染めるようにする(noAAGuard)
      { hue: 200, sMin: 0.12, bbox: [[0.285, 0.700, 0.715, 0.790], [0.0, 0.770, 1.0, 1.0]], noEdgeGuard: true, noAAGuard: true },
    ],
    [
      { white: true, sMax: 0.30, vMin: 0.80, bbox: [0.375, 0.255, 0.625, 0.520], noEdgeGuard: true },
      { hue: 216, sMin: 0.22, sMax: 0.60, vMin: 0.80, bbox: [0.395, 0.272, 0.605, 0.500], noEdgeGuard: true },
    ],
  ],
  //  ・ヤオビクニ: 保存済み3色マスクを使用（下記の色相定義は染色の質感調整に利用）
  Yaobikuni: [
    [
      { hue: [86, 77], sMin: 0.30, notBbox: YAOBIKUNI_EYE_BOXES, noEdgeGuard: true },
      // 緑の前腕は肌との境界で彩度がほぼ白まで落ちる。腕の輪郭内だけ下限を下げ、
      // 白い移行帯を塗り残さず、近接するピンク髪や肌へ緑マスクを侵食させない。
      { hue: [86, 77], sMin: 0.035, bbox: [[0.20, 0.475, 0.37, 0.66], [0.63, 0.475, 0.80, 0.66]], noEdgeGuard: true },
      { white: true, sMax: 0.35, vMin: 0.72, bbox: [[0.20, 0.475, 0.37, 0.66], [0.63, 0.475, 0.80, 0.66]], noEdgeGuard: true },
    ],
    // 薄いピンク(首の後ろから覗く毛先)は彩度0.16まで下がるので、肌(彩度0.12)を割らない範囲で拾う
    { hue: 341, sMin: 0.16, notBbox: YAOBIKUNI_FACE_BOX, noEdgeGuard: true },
    // 肌は顔と上半身だけでなく、緑の前腕へつながる左右の上腕も同じ染色③。
    // 腕の外側に沿う細い矩形を段階的に置き、隣接するピンク髪と緑の上衣へ肌判定を広げない。
    [
      { hue: 22, sMin: 0.015, sMax: 0.38, vMin: 0.58, bbox: [
        [0.315, 0.095, 0.685, 0.235], [0.39, 0.205, 0.61, 0.47],
        [0.315, 0.285, 0.415, 0.365], [0.585, 0.285, 0.685, 0.365],
        [0.285, 0.345, 0.405, 0.425], [0.595, 0.345, 0.715, 0.425],
        [0.265, 0.405, 0.385, 0.495], [0.615, 0.405, 0.735, 0.495],
        [0.245, 0.475, 0.365, 0.565], [0.635, 0.475, 0.755, 0.565],
        [0.235, 0.545, 0.345, 0.625], [0.655, 0.545, 0.765, 0.625],
      ], noEdgeGuard: true },
    ],
  ],
  Snegurochka: [
    { hue: 181, sMin: 0.60, noEdgeGuard: true },
    { hue: 355, sMin: 0.35, noEdgeGuard: true },
    [
      { hue: 195, sMin: 0.05, sMax: 0.60, vMin: 0.55, noEdgeGuard: true },
      { white: true, sMax: 0.05, vMin: 0.55, bbox: [0.18, 0.55, 0.84, 0.98], noEdgeGuard: true },
    ],
  ],
};
// 染色の対象外にする装飾(モンスター本体ではない背景の飾りなど)。ここに合致した画素はどの部位にも
// 属さないものとして扱い、常に元の絵のまま残す。MASU_COLOR_REGION_HUESは「どの部位か」しか表現できず
// 「そもそも染めない」を指定する手段が無かったため、背景の飾りが各部位のbboxの境目で矩形状に
// 分断されて塗り分けられてしまう不具合があった(イブリースの背景にある淡い紫の円)
const MASU_COLOR_EXCLUDE = {
  // イブリース: 右上にある淡い紫の円は背景の飾りなので染色しない。体の白い毛の影は
  // 色相295〜326のピンク寄りなのに対し、この円は色相245〜263の青寄りとはっきり分かれるため、
  // 色相と彩度・明度の組み合わせで確実に区別できる(bboxで円のある範囲にも絞っている)
  Iblis: [{ bbox: [0.63, 0.27, 0.88, 0.61], hue: [235, 278], sMin: 0.06, sMax: 0.24, vMin: 0.84 }],
};
// 画素(色相hh・彩度ss・明度vv・画像内の相対位置nx,ny)が染色対象外の装飾かどうかを判定する
const _isExcludedDyePixel = (baseId, hh, ss, vv, nx, ny) => {
  const rules = MASU_COLOR_EXCLUDE[baseId];
  if (!rules) return false;
  return rules.some((rule) => {
    if (rule.bbox && !_bboxMatches(rule.bbox, nx, ny)) return false;
    if (rule.hue && !(hh >= rule.hue[0] && hh <= rule.hue[1])) return false;
    if (rule.sMin !== undefined && ss < rule.sMin) return false;
    if (rule.sMax !== undefined && ss > rule.sMax) return false;
    if (rule.vMin !== undefined && vv < rule.vMin) return false;
    if (rule.vMax !== undefined && vv > rule.vMax) return false;
    return true;
  });
};
// 部位判定後の平滑化(ごま塩ノイズ除去)の強さをモンスターごとに調整するテーブル。
// 既定は半径2の多数決を1回。細かい毛並みの陰影で判定が激しく入れ替わるモンスターは
// radius/iterationsを上げて、小さな塊単位に均す(ただし小さな部位(目など)まで塗り潰さないよう
// 既定は控えめにしてあり、必要なモンスターだけ個別に強めている)。
// radiusは160px幅の画像を基準にしたピクセル半径として定義し、実際の画像幅に比例させて
// 換算する(高解像度画像に差し替えても毛並みノイズの見た目の粒の大きさに対して
// 常に同じ強さの平滑化がかかるようにするため)
// (イブリースは以前ここで半径3に強めていたが、羊毛のガビガビの原因は平滑化不足ではなく
//  白バケツ判定への色相境界除外の誤爆だった。そちらを直したことで既定の半径2で十分きれいに
//  なり、逆に半径3だとまつ毛のような小さな部位まで塗り潰されてしまうため個別指定を撤去した)
const MASU_COLOR_SMOOTH = {
  Tiger: { radius: 3, iterations: 1 },
  // 正解見本の輪郭をそのまま使う対象は、色相用の多数決を重ねない。
  Mia: { radius: 1, iterations: 0 },
  Undine: { radius: 1, iterations: 0 },
};
const _getSmoothParams = (baseId, w) => {
  const base = MASU_COLOR_SMOOTH[baseId] || { radius: 2, iterations: 1 };
  const scale = w ? w / 160 : 1;
  return { radius: Math.max(1, Math.round(base.radius * scale)), iterations: base.iterations };
};
// モンスター種ごとに、ICON(128px)とIMG(160px)で構図(トリミング位置)が異なる場合の補正テーブル。
// 2026年の新規イラスト差し替え以降、新イラストはprocess-new-art.jsで両サイズとも同じ正規化座標(0〜1)に
// 統一して書き出しているため、現時点では補正が必要なモンスターは無い(空のまま維持)
const MASU_COLOR_REGION_SIZE_OVERRIDES = {};
// baseIdの部位定義を、実際に読み込んだ画像の幅wに応じて調整する(該当する上書きが無ければそのまま返す)
const _resolveRegionDefsForSize = (baseId, defs, w) => {
  const overrides = MASU_COLOR_REGION_SIZE_OVERRIDES[baseId] && MASU_COLOR_REGION_SIZE_OVERRIDES[baseId][w];
  if (!overrides) return defs;
  return defs.map((def, idx) => (overrides[idx] && def && typeof def === 'object') ? { ...def, ...overrides[idx] } : def);
};
// 染色もどきの色選択UIで見せる部位数(部位分割データが無いモンスターも全身一括の1枠は必ず出す)
const dyeRegionCount = (baseId) => { const hues = MASU_COLOR_REGION_HUES[baseId]; return (hues && hues.length > 0) ? hues.length : 1; };
const _rgbToHsv = (r,g,b) => {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), v=max, d=max-min;
  const s = max===0?0:d/max;
  let h=0;
  if (d!==0) {
    if (max===r) h = ((g-b)/d) % 6;
    else if (max===g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h *= 60; if (h<0) h += 360;
  }
  return [h,s,v];
};
const _hueDist = (a,b) => { const d = Math.abs(a-b) % 360; return d>180 ? 360-d : d; };
// HSV(色相0-360,彩度0-1,明度0-1) -> RGB(各0-255)。染色もどきの色置き換えで使う
const _hsvToRgb = (h,s,v) => {
  const c = v*s, x = c*(1-Math.abs((h/60)%2-1)), m = v-c;
  let r,g,b;
  if (h<60) [r,g,b]=[c,x,0];
  else if (h<120) [r,g,b]=[x,c,0];
  else if (h<180) [r,g,b]=[0,c,x];
  else if (h<240) [r,g,b]=[0,x,c];
  else if (h<300) [r,g,b]=[x,0,c];
  else [r,g,b]=[c,0,x];
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
};
// def.bboxが[x0,y0,x1,y1]なら単一の範囲、[[x0,y0,x1,y1],...]なら複数範囲のどれかに
// 入っていればtrue(離れた複数箇所(例:両耳と両前足)を1つの部位として扱いたい場合に使う)
const _bboxMatches = (bbox, nx, ny) => {
  const boxes = Array.isArray(bbox[0]) ? bbox : [bbox];
  return boxes.some(([x0, y0, x1, y1]) => nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1);
};
// regionDefsの1要素は数値/オブジェクトの他、配列(サブ定義の配列)も指定できる。配列にした場合は
// 「いずれかのサブ定義にマッチすればこの部位」という意味になる(例:色相の判定+別の白バケツ判定を
// 同じ染色枠にまとめたい場合。1要素=1部位という制約はそのままに、判定条件だけを複数持たせられる)
const _defAtoms = (def) => Array.isArray(def) ? def : [def];
// 部位から必ず外したい範囲(矩形、複数可)。bboxは「ここだけ見る」、notBboxは「ここだけ見ない」。
// 目や白目のように、髪と同じ色相なのに絶対に染めてはいけない場所を抜くために使う
// (人魚2体の瞳は髪と同系色のため、色だけでは分けられない)
const _defExcluded = (def, nx, ny) => !!(def && typeof def === 'object' && def.notBbox && _bboxMatches(def.notBbox, nx, ny));
// ピクセル(色相hh・彩度ss・明度vv・画像内の相対位置nx,ny)がregionDefs(MASU_COLOR_REGION_HUESの1モンスター分)の
// どの部位に属するかを判定し、インデックスを返す(どれにも属さなければ-1=無染色のまま)
const _classifyDyePixel = (hh, ss, vv, nx, ny, regionDefs) => {
  // 色を問わず位置だけで区切る部位(band=縦位置のみ、posBbox=矩形範囲(複数可))が
  // 定義されていれば最優先で判定する(耳と尻尾の先のように、色は共通しないが
  // まとめて1つの部位として選びたい離れた箇所を指定する場合などに使う)
  for (let idx = 0; idx < regionDefs.length; idx++) {
    for (const def of _defAtoms(regionDefs[idx])) {
      if (_defExcluded(def, nx, ny)) continue;
      if (def && typeof def === 'object' && def.band) {
        const [y0, y1] = def.band;
        if (ny >= y0 && ny < y1) return idx;
      }
      if (def && typeof def === 'object' && def.posBbox && _bboxMatches(def.posBbox, nx, ny)) return idx;
    }
  }
  // 白系・黒系(彩度が低い)部位が定義されていれば次に判定する(vMaxも指定すれば暗い方の
  // 彩度の低いバケツ、例えば黒に近い羽など明度が低すぎて色相が不安定な部位も拾える)。
  // bboxを指定すれば、離れた場所にある似た彩度・明度の部位(例:顔は白いが背中の影も
  // たまたま彩度が低い、等)へ誤って広がらないよう、判定範囲を画像内の特定領域に絞れる
  for (let idx = 0; idx < regionDefs.length; idx++) {
    for (const def of _defAtoms(regionDefs[idx])) {
      if (def && typeof def === 'object' && def.white) {
        if (_defExcluded(def, nx, ny)) continue;
        if (def.bbox && !_bboxMatches(def.bbox, nx, ny)) continue;
        if (ss <= (def.sMax ?? 0.18) && vv >= (def.vMin ?? 0.55) && vv <= (def.vMax ?? 1)) return idx;
      }
    }
  }
  // 明度が極端に低い(ほぼ黒)ピクセルは色相自体が不安定なので、white系バケツで拾えなかった分は対象外にする
  if (vv < 0.12) return -1;
  let best = -1, bestD = 999;
  regionDefs.forEach((rawDef, idx) => {
    for (const def of _defAtoms(rawDef)) {
      if (def && typeof def === 'object' && (def.white || def.band)) continue; // 上で判定済み
      if (def && typeof def === 'object' && def.posBbox && def.hue === undefined) continue; // 位置のみで判定する部位(色相を持たない)は上で判定済み
      if (_defExcluded(def, nx, ny)) continue;
      if (def && typeof def === 'object' && def.bbox && !_bboxMatches(def.bbox, nx, ny)) continue;
      const hue = (typeof def === 'number') ? def : def.hue;
      const vMin = (def && typeof def === 'object') ? def.vMin : undefined;
      const vMax = (def && typeof def === 'object') ? def.vMax : undefined;
      // sMinは部位ごとに指定できる(既定0.18)。彩度の低いパステル調の部位を拾いたい場合はここを下げる
      const sMin = (def && typeof def === 'object' && def.sMin !== undefined) ? def.sMin : 0.18;
      const sMax = (def && typeof def === 'object') ? def.sMax : undefined;
      if (vMin !== undefined && vv < vMin) continue;
      if (vMax !== undefined && vv > vMax) continue;
      if (ss < sMin) continue;
      if (sMax !== undefined && ss > sMax) continue;
      // hueは単一の角度の他、配列で複数の色相をまとめて1部位として扱うこともできる
      // (例:本来離れた色相の部位(青い毛と黄色い角)を1つの染色枠にまとめたい場合)
      const d = Array.isArray(hue) ? Math.min(...hue.map(h => _hueDist(hh, h))) : _hueDist(hh, hue);
      if (d < bestD) { bestD = d; best = idx; }
    }
  });
  // 色相フォールバックには本来「近さ」の上限が無く、どの部位の色相からも遠いピクセル
  // (例: 花の黄色い中心が、定義済みの青系バケツへ強制的に割り当てられる等)まで
  // 無理やり最も近い部位に押し込まれ、染色時に浮いた色ムラの原因になっていた。
  // 明らかに違う色相(60°=オレンジ→黄のように「同系色」とみなせる範囲を超える)は
  // 無染色のまま(-1)残し、元の絵の色を保つようにする
  const MAX_HUE_MATCH_DIST = 60;
  return bestD <= MAX_HUE_MATCH_DIST ? best : -1;
};
// baseIdの画像をCanvasで解析し、部位ごとのアルファマスク(dataURL)を作って返す(同じbaseIdでも
// 画面によって表示に使う画像(iconUrl/imgUrl)が違うため、両方を含めたキーでキャッシュする)
// 染色マスクを作るときに解析する画像の最大サイズ(px)。表示は大きくても250px程度なので、
// これ以上の解像度で判定しても見た目は変わらず、時間だけがかかる
const MASK_ANALYSIS_MAX_SIZE = 384;
// 正式RGBマスク(EXACT_DYE_MASKS)を持つモンスターだけ、解析サイズをここまで上げる。
//
// 【なぜ分けるか】
// 上の384pxは「色相から部位を推定する」経路のための値で、重いのは推定そのものではなく
// そのあとの多数決の平滑化(半径が画像幅に比例するため、解像度を上げると実測7秒級)。
// 正式マスクを持つモンスターは平滑化も色相の境界除外も走らず(下の !exactMask を参照)、
// 「マスクの色を読んで部位番号にする」だけなので、解像度を上げても重くならない。
// 逆に384pxのままだと、1024px級の元絵に対してマスクの1画素が元絵の約3画素ぶんになり、
// 表示時にCSSで引き伸ばした境目が数px単位でずれる。実測でエイキは
// 「染まるはずが染まらない画素」が2.59%、「対象外なのに染まる画素」が6.82%あった。
// 表示は最大250px程度なので原寸まで上げる必要はなく、書き出しの上限(MASK_HIRES_MAX_SIZE)
// と同じ768pxで頭打ちにする。
const MASK_EXACT_ANALYSIS_MAX_SIZE = 768;
// 判定は解析サイズ(上のMASK_ANALYSIS_MAX_SIZE)のままで、書き出すマスク画像だけを
// 元絵に近い解像度へ引き上げるモンスター。
// 元絵が解析サイズより大幅に大きいと、マスクの1画素が元絵の数画素ぶんに相当してしまい、
// 部位の境目がマスクの画素単位の階段(ジャギー)として見えてしまう。実測でも
// 「絵の輪郭とマスクの輪郭のズレ」はモッチー(元絵1024px)が1画素前後なのに対し
// イブリース(元絵570px)は0.5画素で、モッチーだけ模様カスタムの丸プレビュー
// (96px表示)で口まわりに階段が残っていた。
// 判定と平滑化は解析サイズのまま(多数決の半径が画像幅に比例するため、解像度を上げると
// 実測で7秒級まで重くなる)、書き出しだけを高解像度で行うことで見た目だけを直す。
const MASK_HIRES_BASE_IDS = { Mocchi: true, Ark: true, Ham: true, Zan: true, Undine: true, Yaobikuni: true };
// 高解像度で書き出すときのマスクの最大サイズ(px)。表示は最大でも250px程度なので、
// 元絵の原寸まで上げる必要はなく、階段が見えなくなる範囲で抑える
const MASK_HIRES_MAX_SIZE = 768;
// 解析サイズで作った部位マップ(smoothed)を、高解像度のマスク画像(dataURL)へ書き出す。
// 通常の書き出しとの違いは次の3点。
//  ① 半透明でにじんでいる最外周へ部位を数画素ぶん広げてから書き出す。
//     通常の書き出しはにじみを染色対象から外し、さらにマスクのアルファへ元絵のアルファを
//     掛けている(重ねる染色画像そのものも同じアルファを持つため二重に薄くなる)ため、
//     輪郭に元の色の縁が残っていた。マスクを広げても、重ねる染色画像が元絵と同じ透明度を
//     持っているので輪郭からはみ出すことはない。
//  ② 部位の境目は拡大時の補間でなだらかにし、マスクの画素単位の階段が出ないようにする。
//  ③ 位置だけで決まる部位(posBbox/band)は、細い帯で定義していると解析サイズでは
//     1画素程度に潰れてしまうため、書き出し解像度で定義どおりに引き直す。
const _buildHiResMaskUrls = (smoothed, regionDefs, src, w, h, natW, natH) => {
  // ① にじみへ部位を広げる
  const map = new Int8Array(smoothed);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Int8Array(map);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y*w + x;
      if (map[i] >= 0) continue;
      if (src[i*4+3] >= 200) continue; // 不透明な内側は塗り足さない(本来無染色の箇所を潰さないため)
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nv = map[ny*w+nx];
        if (nv >= 0) { next[i] = nv; break; }
      }
    }
    map.set(next);
  }
  const scale = Math.min(1, MASK_HIRES_MAX_SIZE / Math.max(natW, natH));
  const outW = Math.max(1, Math.round(natW * scale)), outH = Math.max(1, Math.round(natH * scale));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const smallCtx = small.getContext('2d');
  if (!smallCtx) return null;
  // ② 部位ごとに解析サイズの2値マスクを作り、補間つきで拡大する
  const outCtxs = [], outCanvases = [], outDatas = [];
  for (let idx = 0; idx < regionDefs.length; idx++) {
    const sd = smallCtx.createImageData(w, h);
    for (let i = 0; i < w*h; i++) if (map[i] === idx) sd.data[i*4+3] = 255;
    smallCtx.putImageData(sd, 0, 0);
    const out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    const outCtx = out.getContext('2d');
    if (!outCtx) return null;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(small, 0, 0, w, h, 0, 0, outW, outH);
    outCanvases.push(out); outCtxs.push(outCtx);
    outDatas.push(outCtx.getImageData(0, 0, outW, outH));
  }
  // ③ 位置だけで決まる部位を書き出し解像度で引き直す(判定順は_classifyDyePixelと同じく最優先)
  const posRegions = [];
  regionDefs.forEach((rawDef, idx) => {
    for (const def of _defAtoms(rawDef)) {
      if (def && typeof def === 'object' && (def.band || def.posBbox)) posRegions.push([idx, def]);
    }
  });
  if (posRegions.length) {
    for (let y = 0; y < outH; y++) {
      const ny = y / outH;
      for (let x = 0; x < outW; x++) {
        const nx = x / outW;
        let hit = -1;
        for (const [idx, def] of posRegions) {
          if (_defExcluded(def, nx, ny)) continue;
          if (def.band) { const [y0, y1] = def.band; if (ny >= y0 && ny < y1) { hit = idx; break; } }
          if (def.posBbox && _bboxMatches(def.posBbox, nx, ny)) { hit = idx; break; }
        }
        if (hit < 0) continue;
        const o = (y*outW + x)*4 + 3;
        for (let idx = 0; idx < outDatas.length; idx++) outDatas[idx].data[o] = (idx === hit) ? 255 : 0;
      }
    }
  }
  return outCanvases.map((canvas, idx) => { outCtxs[idx].putImageData(outDatas[idx], 0, 0); return canvas.toDataURL(); });
};
// ウンディーネは髪・肌・服がすべて青系で、色相や矩形だけでは腕の水面模様、髪との重なり、
// 指先、尾びれの境界を一意に分けられない。undine-dye-mask.PNG を正本として256x384で
// 2bit/px（0=髪、1=肌、2=服、3=対象外）へ事前変換した座標表を使う。PNG自体は実行時に
// 読み込まず、既存のCanvasマスク生成・染色合成経路はそのまま利用する。
// 正解見本を256x384・2bit/pxへ縮小してコード内に保持する。tools配下のPNGは検査時だけ使い、
// 本番ランタイムでは読み込まない。0/1/2=染色①/②/③、3=対象外。
// パンドラの正解マスクを2bit/px（0=髪、1=悪魔側衣装、2=天使側衣装、3=対象外）へ
// 事前変換した座標表。PNGは実行時に読まず、既存のCanvas染色経路を利用する。
const PANDORA_EXACT_REGION_SIZE = [256, 384];
const PANDORA_EXACT_REGION_2BIT = "/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wAAwP8AAPz//////////////////////////////////////////////////////////////////////////wMAAAAMAAAA/P///////////////////////////////////////////////////////////////////////z8AAAAADAAAAMD///////////////////////////////////////////////////////////////////////8DAAAAAD8AAAAA8P////////////////////////////////////////////////////////////////////8/AAAAAAAPAAAAAMD/////////////////////////////////////////////////////////////////////PwAAAAAAAwAAAAAA/P///////////////////////////////////////////////////////////////////w8AAAAAADMAAAAAAPD///////////////////////////////////////////////////////////////////8PAAAAAAAPAAAAAAAA////////////////////////////////////////////////////////////////////DwAAAAAAAwAAAAAAAPz//////////////////////////////////////////////////////////////////w8AAAAAAAMAAAAAAADw//////////////////////////////////////////////////////////////////8DAAAAAAADAAAAAAAAwP//////////////////////////////////////////////////////////////////AwAAAAAAAwAAAAAAAAD//////////////////////////////////////////////////////////////////wAAAAAAAAMAAAAAAAAA/P////////////////////////////////////////////////////////////////8AAAAAAAADAAAAAAAAAPD///////////////////////////////////////////////////////////////8/AAAAAAAAAwAAAAAAAADA////////////////////////////////////////////////////////////////DwAAAAAAAAMAAAAAAAAAwP///////////////////////////////////////////////////////////////w8AAAAAAAADAAAAAAAAAAD///////////////////////////////////////////////////////////////8AAAAAAAAAAwAAAAAAAAAA/P////////////////////////////////////////////////////////////8/AAAAAAAAwAMAAAAAAAAAAPz/////////////////////////////////////////////////////////////DwAAAAAAAMADAAAAAAAAAADw/////////////////////////////////////////////////////////////wMAAAAAAADAAwAAAAAAAAAAwP////////////////////////////////////////////////////////////8AAAAAAAAAwAMAAAAAAAAAAMD///////////////////////////////////////////////////////////8/AAAAAAAAAMADAAAAAAAAAAAA////////////////////////////////////////////////////////////DwAAAAAAAADAAAAAAAAAAAAAAP///////////////////////////////////////////////////////////wMAAAAAAAAAwAAAAAAAAAAAAAD8//////////////////////////////////////////////////////////8AAAAAAAAAAMAAAAAAAAAAAAAA/P////////////////////////////////////////////////////////8/AAAAAAAAAADAAAAAAAAAAAAAAPD/////////////////////////////////////////////////////////AwAAAAAAAAAAwAAAAAAAAAAAAADw////////////////////////////////////////////////////////PwAAAAAAAAAAAMAAAAAAAAAAAAAAwP//////////////////////////////////////////////////////PwAAAAAAAAAAAADAAAAAAAAAAAAAAMD//////////////////////////////////////////////////////z8AAAAAAAAAAAAAwAAAAAAAAAAAAAAA//////////////////////////////////////////////////////8PAAAAAAAAAAAAAMAAAAAwAAAAAAAAAP//////////////////////////////////////////////////////DwAAAAAAAAADAADAAAAAMAAAAAAAAAD//////////////////////////////////////////////////////wMAAAAAAAAAAwAAwAAAAPAAAAAAAAAA/P////////////////////////////////////////////////////8DAAAAAAAAwAMAAMAAAADwAAAAAAAAAPz/////////////////////////////////////////////////////AwAAAAAAAMADAADAAAAA8AAAAAAAAAD8/////////////////////////////////////////////////////wAAAAAAAADAAwAAwAAAAPADAAAAAAAA8P////////////////////////////////////////////////////8AAAAAAAAA8AMAAMAAAADwAwAAAAAAAPD/////////////////////////////////////////////////////AAAAAAAAAPADAADAAAAA/AMAAAAAAADw////////////////////////////////////////////////////PwAAAAAAAAD8AwAAwAAAAPwPMAAAAAAA8P///////////////////////////////////////////////////z8AAAAAAAAA/AMAAMAAAAD8DzAAAAAAAMD///////////////////////////////////////////////////8/AAAAAAAAAPwDAADAAAAA/A8wAAAAAADA////////////////////////////////////////////////////PwAAAAAAAAD/AwAAwAAAAPw/8AAAAAAAwP///////////////////////////////////////////////////z8AAAAAAMAA/wMAAMAAAAD/P/AAAAAAAMD///////////////////////////////////////////////////8PAAAAAADAAP8PAADAAAAA/z/wAAAAAADA////////////////////////////////////////////////////D8AAAAAAwMD/DwAAwAAAAP8/8AMAAAAAAP///////////////////////////////////////////////////w8AAAAAAPDA/w8AAMAAAAD/P/ADAAAAAAD///////////////////////////////////////////////////8PAAAAAADwwP8/AADAAADA/z/wAwAAAAAA////////////////////////////////////////////////////DzAAAAAA8MD/P8AAwADAwP//8A8AAAAAAP///////////////////////////////////////////////////w8wAAAAAPzw/z/AAMAAAPD///wPAAAAAAD///////////////////////////////////////////////////8PAAAAAAD88///wAPAAADw///8DwwAAAAA/P//////////////////////////////////////////////////DwwAAAAA/PP//8ADwAAw/P///D8MAAAAAPz//////////////////////////////////////////////////w8MAAAAAP/z///DD8ADMPz///w/DAAAAAD8//////////////////////////////////////////////////8DAAAAAAD/8///ww8AAzz/////PwwAAAAA/P//////////////////////////////////////////////////AwAAAAAA/////88/AAMM//////8MAAAAAPz//////////////////////////////////////////////////8MAAAAAAP////8P/wADz///////AAAAAADw//////////////////////////////////////////////////8DAAwAAAD/////P/8Aw////////wMAADAA8P//////////////////////////////////////////////////AwAPAAAA////////A8P///////8DAADwAPD//////////////////////////////////////////////////wPADwAAAP///////z/z////////AAAA8A/A//////////////////////////////////////////////////8D/A8AAAD//////////////////wAAAPD/wP//////////////////////////////////////////////////w/8PAAAA/P///////////////z8AAADw/8D//////////////////////////////////////////////////wD/DwAAAPz///////////////8/AAAA8D8A//////////////////////////////////////////////////8A/A8AAAD8////////////////DwAAAPwDAP//////////////////////////////////////////////////AMAPAAAA8P///////////////w8AAAD8AAD8////////////////////////////////////////////////PwAADwAAAPD///////////////8DAAAADAAA/P///////////////////////////////////////////////z8AAAwAAADw////////////////AAAAAAAAAPD///////////////////////////////////////////////8PAAAAAAAwwP///////////////wADAAAAwADA////////////////////////////////////////////////AwAAAAAAwMD//////////////z/wAAAAAMAPAP///////////////////////////////////////////////wMAAAAAAAAD//////////////8PPAAAAADAPwD8//////////////////////////////////////////////8AMAAAAAAAD///////////////8z8AAAAAwP8P8P////////////////////////////////////////////8/APwAAAAAAPz8//////////////8PAAAAAMD/////////////////////////////////////////////////D8D/AAAAAADw////////////////AwAAAADA/////////////////////////////////////////////////wP//wAAAAAA8P///////////////wAAAAAAwP////////////////////////////////////////////////////8AAAAAAPD//////////////z8MAAAAAPD/////////////////////////////////////////////////////AAAAAADA////////////////DwAAAADw/////////////////////////////////////////////////////wDAAAAAAP///////////////wMAAAAA8P////////////////////////////////////////////////////8DwAAAAAD8//////////////8AAADAAPz/////////////////////////////////////////////////////A8AAAAAA8P//////////////AAAAwAD8/////////////////////////////////////////////////////w/AAwAAAAD/////////////PwAAAMAA//////////////////////////////////////////////////////8PwAMAAAAA/P///////////w8AAADwAP//////////////////////////////////////////////////////P8ADAAAAAMD///////////8DAAAA8MD////////////////////////////////////////////////////////ADwAAAAAA/P//////////AAAADDzA////////////////////////////////////////////////////////wA8AAAAAAAD/////////DwAAAAA88P///////////////////////////////////////////////////////w8PMAAAwAAA8P///////wMAAAADD/z///////////////////////////////////////////////////////8/P/AAAAAAAAD8/////z8AAAAAAw///////////////////////////////////////////////////////////z/wAAAAAwAA/P////8AAAAAwMDz////////////////////////////////////////////////////////////wAMAAA8AAPz/////AAAAAMDw/////////////////////////////////////////////////////////////8MPAAw8MAD8////PwDAAAAA8P/////////////////////////////////////////////////////////////DPwA8/MAA/P///z8M8AAAAPz/////////////////////////////////////////////////////////////D/8A8PPDw/////8/DzwAAAP//////////////////////////////////////////////////////////////z//A/D//////////8M/A8Dz/////////////////////////////////////////////////////////////////w/A/////////////wPw/P//////////////////////////////////////////////////////////////////wP////////////8A/////////////////////////////////////////////////////////////////////wP/////////////wP///////////////////////////////////////////////////////////////////////P//////////P/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////X1/////7++6v///////////////////////////////////////////////////////////////////////1dVVf////+rqqr+//////////////////////////////////////////////////////////////////////9VVVX///+vqqqq6v////////////////////////////////////////////////////////////////////9f1VVVVf//q6qqqur/////////////////////////////////////////////////////////////////1f//f/1fdVf9/6qqqqqq//+r+v///////////////////////////////////////////////////////////1X3/1VXVX1V/7+qqquqqv7/r/7///////////////////////////////////////////////////////////9VVf91VVVVV9Wvqqqqqqr+q6r+////////////////////////////////////////////////////////////VdVVXVVVVfVVq6qqqqqq/qqq/v///////////////////////////////////////////////////////////1VVVVVVVVXVVauqqqqqqquqqv7///////////////////////////////////////////////////////////9VVVVVVVVV/92q/qqqquqqqur6//////////////////////////////////////////////////////////9fVVVVVVVV1dXfu+urqqqqqqquqv//////////////////////////////////////////////////////////V1VVVVVVVdVV/a+qq6qqqqvqqqr//////////////////////////////////////////////////////////1dVVVVVVVXVVf2vqquqqqqrrqqq//////////////////////////////////////////////////////////9fVVXVVVVV1Vf9v+qrqqqq6qqq6v//////////////////////////////////////////////////////////X19VVVVVVVVX96vrqqqqqqqqquv///////////////////////////////////////////////////////////9fVVVVVVVVd12r/qqqqqqqqur7/////////////////////////////////////////////////////////////1VVVVVVVVVfq6qqqqqqqqr6////////////////////////////////////////////////////////////////VVVVVVXVV+uqqqqqqqv6/////////////////////////////////////////////////////////////////1VVVVVVVVevqqqqqqqq/v/////////////////////////////////////////////////////////////////fV1VVVV1Xr6qqqqrqrv///////////////////////////////////////////////////////////////////19VVdVdVa+rqqqq6v////////////////////////////////////////////////////////////////////9fVVVd1dWvq6qqqvr/////////////////////////////////////////////////////////////////////f1V1VdX1r6qqqqr+/////////////////////////////////////////////////////////////////////39VVVVV9a+qqqqq+///////////////////////////////////////////////////////////////////////VVVVVfWvqqqqqv7//////////////////////////////////////////////////////////////////////1VVVVX9r66qqqr+//////////////////////////////////////////////////////////////////////9VV1VX/a+uqqqq/v//////////////////////////////////////////////////////////////////////V1X9df2/vqqqqv7//////////////////////////////////////////////////////////////////////13VVXX9v67q/7/+/////////////////////////////////////////////////////////////////////3/VXVVV/b+uqqqq/v////////////////////////////////////////////////////////////////////9fVVVVVf2/qqqqqvr/////////////////////////////////////////////////////////////////////X1VVdVX9v6qqqqrq/////////////////////////////////////////////////////////////////////39dXdVf/b+qq666+v////////////////////////////////////////////////////////////////////////3/X/2/+v///////////////////////////////////////////////////////////////////////////////1/9v/r///////////////////////////////////////////////////////////////////////////////9//b/6//////////////////////////////////////////////////////////////////////////////////2//v////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9/Vf////////////////////////////////////+v+v//////////////////////////////////////////X1XV////////////////////////////////////q+r//////////////////////////////////////////19VVf///////////////////////////////////6qq//////////////////////////////////////////9XVVX1///////f////////////////+////////6qqqv//////////////////////////////////////////V1VV1f//////X///////////////v+r//////6+qqqrq////////////////////////////////////////f1VVVVX//////1f1/////////////6uq//////+rqqqqqv///////////////////////////////////////19VVVVV/f////9XVf///////////7+qqv//////q6qqqqr///////////////////////////////////////9fVVVVVfX/////VVXV//////////+qqqr+/////6uqqqqq////////////////////////////////////////V1VVVVXV////f1VVVfX///////+rqqqq+v///7+qqqqqqv///////////////////////////////////////1dVVVVVVf///39VVVVV9f////+rqqqqqqr///+vqqqqqqr///////////////////////////////////////9VVVVVVVX///9fdVVVVVVV9auqqqqqqquq/v//q6qqqqrq////////////////////////////////////////V1VVVVVV////VVVXVVVVVdWqqqqqqrqqqvr//6uqqqqq6v///////////////////////////////////////1dVVVVVVf//f1VVf1VVVVXVqqqqqqqqqqqq//+rqqqq+vv////////////////////////////////////////fV1VVVVX//19VVVddVVVV1aqqqqquqqqqqv7/q6qqrv7//////////////////////////////////////////39VVVXV//9XVdVV1VdVVdWqqqq6qqqqqqr6/6uqqv7/////////////////////////////////////////////VVVV9f//VVV1VVXXX1XVqqq6qqqrqqqq6v+vqqr+/////////////////////////////////////////////1dVVf3/X1VVXVXVVVX9/6uuqqqqqqqqqqr//6qq/v////////////////////////////////////////////9/VVX9/1VVVVdVVVVVXdWqqqqqqqqqqqqq/v+rqv///////////////////////////////////////////////1VV//9VVdVVVXVVVV3Vqqqqqqqqqqqqqv7/q6r///////////////////////////////////////////////9X1f//X1V1VVVVVVVVtaqqqqqqqqqqqvr6/6uq////////////////////////////////////////////////VdX//39VVVVVXVVVV7Wqqqqqqqqqqqqqqv+/+v///////////////////////////////////////////////1f1////VV1VVVVVVVf1qqqqqqqqqqqqqqr+////////////////////////////////////////////////////////1VdXVVVXVVVV1a+qqqqqqqqqqqqq+v//////////////////////////////////////////////////////V1Vff1VVVVVVVdW7qqqqqqqqqqqqqur//////////////////////////////////////////////////////1fVdf9V1VVV1VXVqqqqqqqqqqqqqqr6//////////////////////////////////////////////////////9VddV9X3VVVdVV1aqqqqqqqqqqquqq+v////////////////////////////////////////////////////9fVV1VXX11VVVVVdWqqqqqqqqqqqqqqv7/////////////////////////////////////////////////////V1VXVdX19V9VVVXVqqqqq6qqrqqqqqr+/////////////////////////////////////////////////////1XVVVV1Vd//VXVV1aqqqquqqqqqq6qr+v///////////////////////////////////////////////////39VdVVVXVX1XV/1f9Wqrqqqqqq6uqq6qqr///////////////////////////////////////////////////9/VV1VVVVVVV191d/fqq6qquqququqqqqq/v///////////////////////////////////////////////////1dXVVVVVVVXVf9f/aqqqqqrq6qqqqqqrvr////////////////////////////////////////////////////fVVXVVVVVV1VVXbWqqqqqqqqqqqqqqqrq////////////////////////////////////////////////////9V9VdVVV1VVVVV2Vqqqqqqqqqqqqqqqqqv//////////////////////////////////////////////////f9V/VVVVVdVVVVVVlaqqrqqqrqqquqqqqqv+/////////////////////////////////////////////////1/V31VVVVVVVVVVVZWqqq6qqqqqqqqqqqqu/v////////////////////////////////////////////////9XVVVXV1VVdVVVVVeVqqqqqqqqqqqqqqqqqvr/////////////////////////////////////////////////VXVVXX9VVVVVVVVXtaqqqqqquqqqqqqqqqr+/////////////////////////////////////////////////1VdVVX/VVVdVVVVV7Wqqqqqqqqqqqqqqqqq6v////////////////////////////////////////////////9VV1XVfV1VXVVVVVW1qqqqqqqqqqqqrqqqqur/////////////////////////////////////////////////V1VVVV3VVVdVVdVVpaqqqqqq6qqqqqqqqqr6/////////////////////////////////////////////////19VVVVVVV9XVVXVVaWqqqqqqqqqqqqqqqqq/v////////////////////////////////////////////////9/VVXVVVV/VVVV1VWlqqq6qqqqqqqqqqqqqv////////////////////////////////////////////////////dVdVVVV/9XVdVV9a+quqqqqquqqqrqqu7/////////////////////////////////////////////////////X1VVVV1/9VV1VbWqqrqqqqqqqqq6qur//////////////////////////////////////////////////////99VVVXVf1VddVVVqqqqqqqqqqrqqqrq//////////////////////////////////////////////////////9f1XVVVVVV9XVVVauqqqqqqqqqqqqq6v//////////////////////////////////////////////////////X3XXV1VdVfX3/1Wrqqqqqqquqqqqqvr//////////////////////////////////////////////////////39V1V9VVVV19V99q6qqqqqqqqq/qqr/////////////////////////////////////////////////////////V9X/VVVVVf9f/auqqqqqqq76v6r+/////////////////////////////////////////////////////////3/V/1dVVVVVVdWrqqqqqqqq6r+q+v//////////////////////////////////////////////////////////3/9/1V9VVVVV/7+qquqrqvq/qv7/////////////////////////////////////////////////////////////////VVVVVf2/qur/q6r/r+r//////////////////////////////////////////////////////////////////1VVVVX1/6r6/6///6////////////////////////////////////////////////////////////////////9fVfVV1f///////////////////////////////////////////////////////////////////////////////1f9VdX//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9X/////f9X//////////////////////////////////////////////////////////////////////////39VVX3VV1XV////////////////////////////////////////////////////////////////////////////VVVVVVVV1f///////////////////////////////////////////////////////////////////////////1dVVVVVVfX///////////////////////////////////////////////////////////////////////////9XVVVVVVX9////////////////////////////////////////////////////////////////////////////X1VVVVVV/////////////////////////////////////////////////////////////////////////////19VVVVVVf3///////////////////////////////////////////////////////////////////////////9Xf1VVVVX1////////////////////////////////////////////////////////////////////////////13VVVVVV9f///////////////////////////////////////////////////////////////////////////1d/VVVVVff///////////////////////////////////////////////////////////////////////////9f33/1V///////////////////////////////////////////////////////////////////////////////X3X9/////////////////////////////////////////////////////////////////////////////////9dV/f////////////////////////////////////////////////////////////////////////////////9f3f3/////////////////////////////////////////////////////////////////////////////////f13//////////////////////////////////////////////////////////////////////////////////39d//////////////////////////////////////////////////////////////////////////////////9ff/3/////////////////////////////////////////////////////////////////////////////////X3/9/////////////////////////////////////////////////////////////////////////////////19//f////////////////////////////////////////////////////////////////////////////////9ff/3/////////////////////////////////////////////////////////////////////////////////X3/9//////////////////////////////////////////////////////////////////////////////////9//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+r//////////////////////////////////////////////////////////////////////////////////7/q/////////////////////////////////////////////////////////9f///////////////////////+v6v////////////////////////////////////////////////////////9X9f9/Vf3/////////////////q+r/////////////////////////////////////////////////////////V/VVVVX9////////////q6qqqqrq/////////////////////////////////////////////////////////1ddVVVV/f///////////6uqqqqq6v////////////////////////////////////////////////////////9XX1VVVf3///////////+rqqqqqur/////////////////////////////////////////////////////////X11VVVX9////////////q6qqqqrq/////////////////////////////////////////////////////////1ddVVX1/////////////6uqqqqq6v////////////////////////////////////////////////////////9XVf/1//////////////+rqqqqqur/////////////////////////////////////////////////////////V9X//////////////////////6rq/////////////////////////////////////////////////////////1/1//////////////////////+qqv////////////////////////////////////////////////////////9f1f//////////////////////qqr/////////////////////////////////////////////////////////f93//////////////////////6qq/////////////////////////////////////////////////////////1f1//////////////////////+q6v////////////////////////////////////////////////////////9V9///////////////////////qur/////////////////////////////////////////////////////////Vdf//////////////////////6rq////////////////////////////////////////////////////////f1XV//9V9f////////////////+qqv///////////////////////////////////////////////////////39V1f9XVVX///////////+qqv7/qqr+////////////////////////////////////////////////////////VdX/VVVV//////////+vqqrq/6qq/v////////////////////////////////////////////////////////VVV1VVVf3/////////r6qqqv7qqv///////////////////////////////////////////////////////3/VVVVV1V/9/////////6+qqqq66ur///////////////////////////////////////////////////////9/1dVd1f////////////+rqqqqqurq////////////////////////////////////////////////////////f9VVVf3/////////////6/+vqqrq6v/////////////////////////////////////////////////////////XdXX9/////////////////6uq6ur/////////////////////////////////////////////////////////19fV//////////////////+/qurq/////////////////////////////////////////////////////////9dX3////////////////////6rq+v/////////////////////////////////////////////////////////fddX///9//////////////7+q6vr//////////////////////////////////////////////////////////91V////f/3//////+////+vqur+//////////////////////////////////////////////////////////91Vf///1/9//////+v////q6rq/v//////////////////////////////////////////////////////////VVX1//9V9f//////q/7//6qq6v///////////////////////////////////////////////////////////1VVVVVVVdX//////6qq/6uqqur////////////////////////////////////////////////////////////VVVVVVVXV/////7+qqqqqqqrq////////////////////////////////////////////////////////////1VVVVVVVVf////+/qqqqqqq66v///////////////////////////////////////////////////////////9VVVVVVVVX/////r6qqqqqqqur///////////////////////////////////////////////////////////9VV1VVVVVV/f///6+qqqqqqqrq////////////////////////////////////////////////////////////VVVVVVVVVf3///+rqqqqqqqq6v///////////////////////////////////////////////////////////1VVVVVVVVX9////q6qqqqqqqur///////////////////////////////////////////////////////////9VX1VVVVVV/f///6uqqqqqqqrq////////////////////////////////////////////////////////////VXdVVVVVVf3///+rqqqqqqqq6v///////////////////////////////////////////////////////////1VXVVVVVVX/////q6qqqqqqqur///////////////////////////////////////////////////////////9VVVdVVVVV/f///6+qqqqqqqrq////////////////////////////////////////////////////////////VVVdVVVVdf3///+7qqqqqqqu6v///////////////////////////////////////////////////////////1VV1VVVVV/9////q6qqqrqqrur///////////////////////////////////////////////////////////9VVVX1/39V/f///6u6quqqqq7q////////////////////////////////////////////////////////////VVVVVVVVVf3///+rqqqqqqqu6v///////////////////////////////////////////////////////////1VVVVVVVVX9////qqqqqqqqrvr///////////////////////////////////////////////////////////9fV1VVVVVV/f///6qqqqqqqq7+/////////////////////////////////////////////////////////////1dVVVVVVf3///+qqqqqqqr+//////////////////////////////////////////////////////////////9fVVVVVVX9////qqqqqqqq/v//////////////////////////////////////////////////////////////X1VVVVVV/f///6qqqqqqqv7//////////////////////////////////////////////////////////////19VVVVVVf3///+qqqqqqqr+//////////////////////////////////////////////////////////////9fVVVVVVX9////qqqqqqqq/v//////////////////////////////////////////////////////////////X1VVVVVV/f///6qqqqqqqv///////////////////////////////////////////////////////////////39VVVVVVf////+rqqqqqur/////////////////////////////////////////////////////////////////V1VVVdX/////r6qqqqr6/////////////////////////////////////////////////////////////////39VVVX9/////7+qqqqq////////////////////////////////////////////////////////////////////fVX9////////q6qq+v//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////";
let _pandoraExactRegionBytes = null;
const _getPandoraExactRegion = (nx, ny) => {
  if (!_pandoraExactRegionBytes) {
    const raw = atob(PANDORA_EXACT_REGION_2BIT);
    _pandoraExactRegionBytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  const [w, h] = PANDORA_EXACT_REGION_SIZE;
  const x = Math.min(w - 1, Math.max(0, Math.floor(nx * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor(ny * h)));
  const i = y * w + x;
  const region = (_pandoraExactRegionBytes[i >> 2] >> ((i & 3) * 2)) & 3;
  return region < 3 ? region : -1;
};
const MIA_EXACT_REGION_SIZE = [256, 384];
const MIA_EXACT_REGION_2BIT = "/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////z8AAPD//////////////////////////////////////////////////////////////////////////////w8AAAAAwP///////////////////////////////////////////////////////////////////////////w8AAAAAAADA//////////////////////////////////////////////////////////////////////////8AAAAAAAAAAPD///////////////////////////////////////////////////////////////////////8PAAAAAAAAAAAA////////////////////////////////////////////////////////////////////////AAAAAAAAAAAAAPD/////////////////////////////////////////////////////////////////////DwAAAAAAAAAAAADA/////////////////////////////////////////////////////////////////////wAAAAAAAAAAAAAAAPz//////////////////////////////////////////////////////////////////z8AAAAAAAAAAAAAAADw//////////////////////////////////////////////////////////////////8DAAAAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAD8////////////////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAA8P///////////////////////////////////////////////////////////////w8AAAAAAAAAAAAAAAAAAPz///////////////////////////////////////////////////////////////8DAAAAAAAAAAAAAAAAAAD8//////////////////////////////////////////////////////////////8/AAAAAAAAAAAAAAAAAAAA/P//////////////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAAAPz//////////////////////////////////////////////////////////////w8AAAAAAAAAAAAAAAAAAAD///////////////////////////////////////////////////////////////8DAAAAAAAAAAAAAAAAAAAA////////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAAAAD//////////////////////////////////////////////////////////////z8AAAAAAAAAAAAAAAAAAAAA//////////////////////////////////////////////////////////////8PAAAAAAAAAAAAAAAAAAAAwP//////////////////////////////////////////////////////////////AwAAAAAAAAAAAAAAAAAAAMD//////////////////////////////////////////////////////////////wMAAAAAAAAAAAAAAAAAAADA//////////////////////////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAwP//8P//////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAMD/P/D/////////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAAAADA/w/A/////////////////////////////////////////////////////////z8AAAAAAAAAAAAAAAAAAAAAwP8DAP////////////////////////////////////////////////////////8PAAAAAAAAAAAAAAAAAAAAAMD/AwD/////////////////////////////////////////////////////////DwAAAAAAAAAAAAAAAAAAAADA/wAA/P///////////////////////////////////////////////////////wMAAAAAAAAAAAAAAAAAAAAAwD8AAPz///////////////////////////////////////////////////////8DAAAAAAAAAAAAAAAAAAAAAMAPAADw////////////////////////////////////////////////////////AwAAAAAAAAAAAAAAAAAAAADAAwAA8P///////////////////////////////////////////////////////wAAAAAAAAAAAAAAAAAAAAAAwAMAAPD///////////////////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAMAAAADA////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAwP//////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAAAAAAAAAAAMD//////////////////////////////////////////////////////z8AAAAAAAAAAAAAAAAAAAAAAAAAAAAA//////////////////////////////////////////////////////8/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//////////////////////////////////////////////////////w8AAAAAAAAAAAAAAAAAAAAAAAAAAAAA//////////////////////////////////////////////////////8PAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPz/////////////////////////////////////////////////////DwAAAAAAAAAAAAAAAAAAAAADAAAAAAD8/////////////////////////////////////////////////////w8AAAAAADwAAAAAAAAAAAAAAwAAAAAA/P////////////////////////////////////////////////////8PAAAAAAA8AAAAAwAAAAAAAAMAAAAAAPz/////////////////////////////////////////////////////DwAAAAAAPAAAAAMAAAAAAAAPAAAAAAD8/////////////////////////////////////////////////////w8AAAAAADwAAAADAAAAAAwADwAAAAAA/P////////////////////////////////////////////////////8PAAAAAAA/AAwADwAAAAAMAD8AAAAAAPz/////////////////////////////////////////////////////DwAAAAAA/wAMAA8AAAAAPwA/AAAAAAD8/////////////////////////////////////////////////////w8AAAAAAP8APAAPAAAAwD8APwAAAAAA/P////////////////////////////////////////////////////8PAAAAwAD/Az8APwAAwPD/AP8AAAAAAPz/////////////////////////////////////////////////////DwAAAMDD/wP/wD8AAPD8/wP/AAAAAAD8/////////////////////////////////////////////////////w8AAADAw/8P/8M/AAD8//8//wMAAAAA/P////////////////////////////////////////////////////8PAAAAwM//P//PPwww//////8DAAAAAPz/////////////////////////////////////////////////////DwAAAMD///////8//P//////DwAAAAD8/////////////////////////////////////////////////////w8AAADA////////P////////w8AAAAA/P////////////////////////////////////////////////////8PAAAAwPz///////////////8/AAAAAPz/////////////////////////////////////////////////////DwAAAMD8////////////////PwAAAAD8/////////////////////////////////////////////////////z8AAADA/P///////////////w8AAAAA//////////////////////////////////////////////////////8/AAAAAPz///////////////8PAAAAAP//////////////////////////////////////////////////////PwAAAAD8////////////////DwAAAAD//////////////////////////////////////////////////////z8AAAAA8P///////////////w8AAAAA////////////////////////////////////////////////////////AAAAAPD///////////////8PAAAAAP///////////////////////////////////////////////////////wAAAADw////////////////DwAAAMD///////////////////////////////////////////////////////8AAAAA8P///////////////w8AAADA////////////////////////////////////////////////////////AwAAAMD///////////////8DAAAA8P///////////////////////////////////////////////////////wMAAADA////////////////AwAAAPD///////////////////////////////////////////////////////8DAAAAwP///////////////wMAAAD8////////////////////////////////////////////////////////DwAAAMD///////////////8DAAAA/P///////////////////////////////////////////////////////w8AAAAA////////////////AAAAAPz///////////////////////////////////////////////////////8/AAAAAP///////////////wAAAAD/////////////////////////////////////////////////////////PwAAAAD///////////////8AAAAA//////////////////////////////////////////////////////////8AMAAA/P////////////8/AAAAAP//////////////////////////////////////////////////////////ADAAAPz/////////////PwAAAMD//////////////////////////////////////////////////////////wMwAADw/////////////w8AAADA//////////////////////////////////////////////////////////8D8AAMwP////////////8PPAAA8P//////////////////////////////////////////////////////////D/AAPMD/////////////AzwADPD//////////////////////////////////////////////////////////z/wAD/A/////////////wA/AAz8//////////////////////////////////////////////////////////8/8AP/wP/////////////APwAP/P////////////////////////////////////////////////////////////AD/8P/////////////wD/AD//////////////////////////////////////////////////////////////zA//P//////////////A/8A//////////////////////////////////////////////////////////////8w//P//////////////8P/zP//////////////////////////////////////////////////////////////8//////////////////z///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////f//////////////////////////////////////////////////////////////////////////////////X/X//3/V/////////////////////////////////////////////////////////////////////////////1XV//9fVf///////////////////////////////////////////////////////////////////////////39VVf//VVX9//////////////////////////////////////////////////////////////////////////9fVVX1f1VV9f//////////////////////////////////////////////////////////////////////////V1VVVVdVVdX//////////////////////////////////////////////////////////////////////////1VVVVVXVVVV/////////////////////////////////////////////////////////////////////////39VVVXVV1VVVf3///////////////////////////////////////////////////////////////////////9/VVVV9V9VVVX9////////////////////////////////////////////////////////////////////////X1VVVf1/VVVV9f///////////////////////////////////////////////////////////////////////1dVVVX//1VVVdX///////////////////////////////////////////////////////////////////////9VVVVV//9VVVXV////////////////////////////////////////////////////////////////////////VVVVVf9/VVVVVf//////////////////////////////////////////////////////////////////////f1VVVamqqmpVVVX9/////////////////////////////////////////////////////////////////////39VVVWpqqpqVVVV/f////////////////////////////////////////////////////////////////////9fVVVVqaqqalVVVfX/////////////////////////////////////////////////////////////////////V1VVVamqqmpVVVXV/////////////////////////////////////////////////////////////////////1dVVVWpqqrqVVVV1f////////////////////////////////////////////////////////////////////9VVVVVqaqq6lVVVVX/////////////////////////////////////////////////////////////////////VVVVVamqqupVVVVV////////////////////////////////////////////////////////////////////f1VVVVWpqqrqVVVVVf3//////////////////////////////////////////////////////////////////39VVVVVqaqq6lVVVVX9//////////////////////////////////////////////////////////////////9fVVVVVamqqupVVVVV9f//////////////////////////////////////////////////////////////////V1VVVVWrqqqqVVVVVfX//////////////////////////////////////////////////////////////////1dVVVVVq6qqqlVVVVXV//////////////////////////////////////////////////////////////////9VVVVVVf3///9VVVVVVf//////////////////////////////////////////////////////////////////VVVVVVX/////VVVVVVX/////////////////////////////////////////////////////////////////f1VVVVVV/////1VVVVVV/f///////////////////////////////////////////////////////////////39VVVVVVf////9VVVVVVf3///////////////////////////////////////////////////////////////9fVVVVVVX/////VVVVVVX1////////////////////////////////////////////////////////////////X1VVVVVV/////1VVVVVV9f///////////////////////////////////////////////////////////////1dVVVVVVf////9VVVVVVdX///////////////////////////////////////////////////////////////9XVVVVVVX/////VVVVVVXV////////////////////////////////////////////////////////////////VVVVVVVV/////1VVVVVVVf///////////////////////////////////////////////////////////////1VVVVVVVf////9VVVVVVVX//////////////////////////////////////////////////////////////39VVVVVVVX/////VVVVVVVV/f////////////////////////////////////////////////////////////9/VVVV1f//////////V1VVVfX/////////////////////////////////////////////////////////////X1VVVdX//////////1dVVVX1/////////////////////////////////////////////////////////////19VVVXV//////////9XVVVV1f////////////////////////////////////////////////////////////9XVVVV1f//////////X1VVVdX/////////////////////////////////////////////////////////////V1VVVfX//////////19VVVVV/////////////////////////////////////////////////////////////1VVVVX1//////////9fVVVVVf////////////////////////////////////////////////////////////9VVVVV9f//////////f1VVVVX9//////////////////////////////////////////////////////////9/VVVVVf3//////////39VVVVV/f//////////////////////////////////////////////////////////f1VVVVX9////////////VVVVVfX//////////////////////////////////////////////////////////19VVVVV/////////////1VVVVX1//////////////////////////////////////////////////////////9XVVVVVf////////////9XVVVV1f//////////////////////////////////////////////////////////V1VVVdX/////////////V1VVVdX//////////////////////////////////////////////////////////1VVVVXV/////////////19VVVVV//////////////////////////////////////////////////////////9VVVVV9f////////////9fVVVVVf3///////////////////////////////////////////////////////9/VVVVVfX/////////////f1VVVVX9////////////////////////////////////////////////////////X1VVVVX9/////////////39VVVVV9f///////////////////////////////////////////////////////19VVVVV/f//////////////VVVVVdX///////////////////////////////////////////////////////9XVVVVVf///////////////1VVVVXV////////////////////////////////////////////////////////VVVVVdX///////////////9XVVVVVf///////////////////////////////////////////////////////1VVVVXV////////////////V1VVVVX9/////////////////////////////////////////////////////39VVVVV9f///////////////19VVVVV/f////////////////////////////////////////////////////9/VVVVVfX///////////////9fVVVVVfX/////////////////////////////////////////////////////X1VVVVX9////////////////f1VVVVXV/////////////////////////////////////////////////////1dVVVVV/f///////////////39VVVVV1f////////////////////////////////////////////////////9XVVVVVf//////////////////VVVVVVX/////////////////////////////////////////////////////VVVVVVX//////////////////1dVVVVV/f///////////////////////////////////////////////////1VVVVXV//////////////////9XVVVVVf3//////////////////////////////////////////////////39VVVVV1f//////////////////X1VVVVX1//////////////////////////////////////////////////9/VVVVVfX//////////////////19VVVVV7f//////////////////////////////////////////////////r1VVVVX1/////////////////+9/VVVVVer//////////////////////////////////////////////////6t6VVVV/av6/////////////6/qf1VVVa2u///////////////////////////////////////////////////7q1pVVf+rqvr//////////6uqqv9VVaWqr////////////////////////////////////////////////////vqqqqr/qqqqqvr/////r6qquqr/qqqqrr/+////////////////////////////////////////////////v/7++quq/6quqqqqqqqqqqqqqvqq/6u6rr7+/v///////////////////////////////////////////////9+6/vrr7/+qrqqqqquqqqqqqqr6qv7r+rr+rvf///////////////////////////////////////////////9fqb/+++v/qq+qq6qrqqrqquqq+qv+7/v6/mrV////////////////////////////////////////////////V5Wq//77v6qvqq+qq6qq6qrqqvqr/u/7+6pW1f///////////////////////////////////////////////1VVrar++7/qr+qv6qvqq+qr6qv6r/q//6tqVVX///////////////////////////////////////////////9VVVWtqv6/+q/qr+qv6qvqq/qr+q/6v6p6VVVV/f//////////////////////////////////////////////VVVVVVX9r/qv+q/qr+qr+q/6r/q/+v9VVVVVVf///////////////////////////////////////////////1dVVVVV/a/+r/qv+q/6r/qv+q/6//r/VVVVVdX///////////////////////////////////////////////9/VVVVVf+v/6/+r/qv+q/6r/q/+v/q/1dVVVX1/////////////////////////////////////////////////1VVVVX/r+q//q/+r/qv+r/6v/qr+v9XVVVV//////////////////////////////////////////////////9/VVVV/1eqqv+v/r/+v/6//v+q6tX/V1VV/f///////////////////////////////////////////////////39V9f9XVauqqv6//r/+v66qqlXV/19V/f//////////////////////////////////////////////////////////V1VVraqqqqqqqqqq6lVVVf///////////////////////////////////////////////////////////////1VVVVVVvaqqqqr6VVVVVVX///////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVVVVVVVV////////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVVVVVf3//////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVVVVVX9/////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVVVVVVV/f////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVVVVVVVf3/////////////////////////////////////////////////////////////f1VVVVVVVVVVVVVVVVVVVVX1/////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVVVVVVV9f////////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVVVVVVVfX/////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVVVVVVX1/////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVVVVVV1f////////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVVVVVVVdX/////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVVVVVVXV/////////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVVVVVVVV1f////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVVVVVVVVVX/////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVVVVVVVV/////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVVVVVVVVf////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVVVVVVVVVVX/////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVVVVVVVV/f///////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVVVVVVVVf3//////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVVVVVVVVVX9//////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVVVVVVVVVV/f//////////////////////////////////////////////////////////f1VVVVVVVVVVVVVVVVVVVVVVVfX//////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVVVVVVVVVX1//////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVVVVVVVVVV9f//////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVVVVVVVVVfX//////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVVVVVVVVXV//////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVVVVVVVVVV1f//////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVVVVVVVVVdX//////////////////////////////////////////////////////////1dfVVVVVVVVVVVVVVVVVVVVVdXV//////////////////////////////////////////////////////////9XX1VVVVVVVVVVVVVVVVVVVVXVVf//////////////////////////////////////////////////////////11dfVVVVVVVVVVVVVVVVVVV11Vf//////////////////////////////////////////////////////////99XX31VVVVVVVVVVVVVVVVf9dX3////////////////////////////////////////////////////////////V1999VVVVVVVVVVVVfVVX/XV//////////////////////////////////////////////////////////////9XffVVX31VVVVVV1/1VX/19f//////////////////////////////////////////////////////////////X3/1VV991Vf11Vd/9VV/9f////////////////////////////////////////////////////////////////9/9dVffdVX9dVXf/VX/f/////////////////////////////////////////////////////////////////////VX33VV/3VV3/V9////////////////////////////////////////////////////////////////////////3991Vf91Vf/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////v/////+/+v///////////////////////////////////////////////////////////////////////////7+qqqqqqvr/////r/7///+r/v////////////////////////////////////////////////////////////+/qqqqqqr6/////6+qqqqqqvr/////////////////////////////////////////////////////////////r6qqqqqq+v////+vqqqqqqr6/////////////////////////////////////////////////////////////6+qqqqqqvr/////r6qqqqqq+v////////////////////////////////////////////////////////////+vqqqqqqr6/////6+qqqqqqvr/////////////////////////////////////////////////////////////r6qqqqqq+v////+vqqqqqqr6/////////////////////////////////////////////////////////////6+qqqqqqvr/////r6qqqqqq+v////////////////////////////////////////////////////////////+vqqqqqqr6/////6+qqqqqqur/////////////////////////////////////////////////////////////q6qqqqqq+v////+vqqqqqqrq/////////////////////////////////////////////////////////////6uqqqqqqv7/////r6qqqqqq6v////////////////////////////////////////////////////////////+rqqqqqqr+/////6+qqqqqqur/////////////////////////////////////////////////////////////q6qqqqqq/v////+/qqqqqqrq/////////////////////////////////////////////////////////////6uqqqqqqv7/////v6qqqqqq6v////////////////////////////////////////////////////////////+rqqqqqqr+/////7+qqqqqqur/////////////////////////////////////////////////////////////qqqqqqqq/v////+/qqqqqqqq/////////////////////////////////////////////////////////////6qqqqqqqv7/////v6qqqqqq6v3//////////////////////////////////////////////////////////1+qqqqqqqrW/////5eqqqqqqqrV//////////////////////////////////////////////////////////9VqqqqqqqqVv3//3+VqqqqqqqqVf3///////////////////////////////////////////////////////9fVaqqqqqqqlb9//9/laqqqqqqqlX1////////////////////////////////////////////////////////X1WqqqqqqqpW/f//f5WqqqqqqqpV9f///////////////////////////////////////////////////////19VqqqqqqqqVv3//1+VqqqqqqqqVf3///////////////////////////////////////////////////////9/VamqqqqqqlX9//9fVaqqqqqqelX9////////////////////////////////////////////////////////f1WVqqqqqnpV/f//f1WtqqqqqldV/f///////////////////////////////////////////////////////39VVamqqqpWVf3//39VlaqqqmpVVf3/////////////////////////////////////////////////////////VVXVqqrqVVX9//9/VVWrqqpVVVX//////////////////////////////////////////////////////////1VVVVWrWlVV/f//f1VVpepVVVVV//////////////////////////////////////////////////////////9VVVVVVVVVVf3//39VVVVVVVVVVf//////////////////////////////////////////////////////////VVVVVVVVfVX9//9/VX1VVVVVVdX//////////////////////////////////////////////////////////1dVVVV/1X9V/f//f1X/V/1VVVXV//////////////////////////////////////////////////////////9XVVXV1f91Vf3//39VV/3XV1VV1f//////////////////////////////////////////////////////////V1VV1VV/dVX///9/VVf9VVdVVfX//////////////////////////////////////////////////////////19VVdXV/3VV////f1Vd/VdXVVX1//////////////////////////////////////////////////////////9fVVXVff93Vf////9V3d3dVVVV9f//////////////////////////////////////////////////////////X1VVVd93XVX/////VX3d9VVVVfX//////////////////////////////////////////////////////////19VVVXVdVVV/////1VV31dVVVX9//////////////////////////////////////////////////////////9/VVVV1fVVVf////9VVVdXVVVV/f//////////////////////////////////////////////////////////f1VVVfXVVVX/////VdVXX1VVVf3//////////////////////////////////////////////////////////39VVVV11VXV/////1XVV19VVVX9//////////////////////////////////////////////////////////9/VVVVXdVX1f////9VVVVVVVVV/////////////////////////////////////////////////////////////1VVVf31VdX/////V1VdV1VVVf////////////////////////////////////////////////////////////9VVVXVX1XV/////1dV9VVVVVX/////////////////////////////////////////////////////////////VVVV1X9V1f////9XVf9XVVVV/////////////////////////////////////////////////////////////1VVVXXVVfX/////V9VXX1VVVf////////////////////////////////////////////////////////////9VVVX99VX1/////1dVX19VVdX/////////////////////////////////////////////////////////////V1VV1X9V9f////9fVf1XVVXV/////////////////////////////////////////////////////////////1dVVVV/VfX/////X1X9VVVV1f////////////////////////////////////////////////////////////9XVVXV9VX1/////19VV1dVVdX/////////////////////////////////////////////////////////////V1VVdfVV9f////9fVV9fVVXV/////////////////////////////////////////////////////////////1dVVdV/VfX/////X1X9V1VV1f////////////////////////////////////////////////////////////9XVVVVf1X1/////19V/VVVVdX/////////////////////////////////////////////////////////////V1VV1fVV9f////9fVVdXVVXV/////////////////////////////////////////////////////////////1dVVfX/V/X/////X9X/X1VV1f////////////////////////////////////////////////////////////9VVVVVVVX1/////1dVVVVVVdX/////////////////////////////////////////////////////////////VVVVVVVV1f////9XVVVVVVVV/////////////////////////////////////////////////////////////1VVVVVVVdX/////V1VVVVVVVf////////////////////////////////////////////////////////////9VVVVVVVXV/////1VVVVVVVVX/////////////////////////////////////////////////////////////VVVVVVVVVf////9VVVVVVVVV/////////////////////////////////////////////////////////////1VVVVVVVVX/////VVVVVVVVVf////////////////////////////////////////////////////////////9VVVVVVVVV/////1VVVVVVVVX/////////////////////////////////////////////////////////////VVVVVVVVVf///39VVVVVVVVV/////////////////////////////////////////////////////////////1VVVVVVVVX9//9/VVVVVVVVVf////////////////////////////////////////////////////////////9VVVVVVVVV/f//f1VVVVVVVVX/////////////////////////////////////////////////////////////VVVVVVVVVf3//39VVVVVVVXV/////////////////////////////////////////////////////////////1dVVVVVVVX9//9/VVVVVVVV1f////////////////////////////////////////////////////////////9XVVVVVVVV/f//f1VVVVVVVfX/////////////////////////////////////////////////////////////X1VVVVVVVf3//39VVVVVVVX1/////////////////////////////////////////////////////////////19VVVVVVVX9//9/VVVVVVVV/f////////////////////////////////////////////////////////////9/VVVVVVVV/f//f1VVVVVVVf3/////////////////////////////////////////////////////////////f1VVVVVVVf///39VVVVVVVX///////////////////////////////////////////////////////////////9VVVVVVVX/////VVVVVVXV////////////////////////////////////////////////////////////////V1VVVVVV/////1VVVVVV1f///////////////////////////////////////////////////////////////19VVVVVVf////9VVVVVVfX///////////////////////////////////////////////////////////////9/VVVVVdX/////V1VVVVX9/////////////////////////////////////////////////////////////////1VVVVX1/////19VVVXV//////////////////////////////////////////////////////////////////9fVVVV//////9/VVVV9f///////////////////////////////////////////////////////////////////1dV/f///////19V1f//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////";
let _miaExactRegionBytes = null;
const _getMiaExactRegion = (nx, ny) => {
  if (!_miaExactRegionBytes) {
    const raw = atob(MIA_EXACT_REGION_2BIT);
    _miaExactRegionBytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  const [w, h] = MIA_EXACT_REGION_SIZE;
  const x = Math.min(w - 1, Math.max(0, Math.floor(nx * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor(ny * h)));
  const i = y * w + x;
  const region = (_miaExactRegionBytes[i >> 2] >> ((i & 3) * 2)) & 3;
  return region < 3 ? region : -1;
};
const UNDINE_EXACT_REGION_SIZE = [256, 384];
const UNDINE_EXACT_REGION_2BIT = "//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8/AMD/////////////////////////////////////////////////////////////////////////////////AAAA8P//////////////////////////////////////////////////////////////////////////////AAAAAADw////////////////////////////////////////////////////////////////////////////AwAAAAAAAPD/////////////////////////////////////////////////////////////////////////DwAAAAAAAAAA/////////////////////////////////////////////////////////////////////////wAAAAAAAAAAAMD//////////////////////////////////////////////////////////////////////w8AAAAAAAAAAAAA//////////////////////////////////////////////////////////////////////8AAAAAAAAAAAAAAPD///////////////////////////////////////////////////////////////////8/AAAAAAAAAAAAAAAA////////////////////////////////////////////////////////////////////AwAAAAAAAAAAAAAAAPz//////////////////////////////////////////////////////////////////wAAAAAAAAAAAAAAAADw/////////////////////////////////////////////////////////////////w8AAAAAAAAAAAAAAAAAwP////////////////////////////////////////////////////////////////8DAAAAAAAAAAAAAAAAAAD/////////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAA8P//////////////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAAAPD//////////////////////////////////////////////////////////////w8AAAAAAAAAAAAAAAAAAADA//////////////////////////////////////////////////////////////8DAAAAAAAAAAAAAAAAAAAAAP//////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAD8////////////////////////////////////////////////////////////PwAAAAAAAAAAAAAAAAAAAAAA8P///////////////////////////////////////////////////////////w8AAAAAAAAAAAAAAAAAAAAAAMD///////////////////////////////////////////////////////////8PAAAAAAAAAAAAAAAAAAAAAADA////////////////////////////////////////////////////////////AwAAAAAAAAAAAAAAAAAAAAAAAP///////////////////////////////////////////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAD8/////////////////////////////////////////////////////////z8AAAAAAAAAAAAAAAAAAAAAAAAA/P////////////////////////////////////////////////////////8/AAAAAAAAAAAAAAAAAAAAAAAAAPD/////////////////////////////////////////////////////////DwAAAAAAAAAAAAAAAAAAAAAAAADw/////////////////////////////////////////////////////////w8AAAAAAAAAAAAAAAAAAAAAAAAAwP////////////////////////////////////////////////////////8DAAAAAAAAAAAAAAAAAAAAAAAAAMD/////////////////////////////////////////////////////////AwAAAAAAAAAAAAAAAAAAAAAAAAAA/////////////////////////////////////////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAP////////////////////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAD8//////////////////////////////////////////////////////8/AAAAAAAAAAAAABAAAAAAAAAAAAAA/P//////////////////////////////////////////////////////PwAAAAAAAAAAAFVVFQAAAAAAAAAAAPz//////////////////////////////////////////////////////w8AAAAAAAAAAMBVVRUAAAAAAAAAAADw//////////////////////////////////////////////////////8PAAAAAAAAwABAVVUVAAAAAAAAAAAA8P//////////////////////////////////////////////////////DwAAAAAAAEAAQFVVFQAMAAAAAAAAAPD//////////////////////////////////////////////////////wMAAAAAAABQAFBVVdUANAAAAAAAAADw//////////////////////////////////////////////////////8DAAAAAAAAUABQVVVVABQAAAAAAAAAwP//////////////////////////////////////////////////////AwAAAAAAAFQAUFVVVQDUAAAAAAAAAMD//////////////////////////////////////////////////////wAAAAAAAABUAFBVVVUAVAAAAAAAAADA//////////////////////////////////////////////////////8AAAAAAAAAVQBcVVVVAFQDAAAAAAAAwP//////////////////////////////////////////////////////AAAAAAAAAFUAVFVVVQBXAQAAAAAAAMD//////////////////////////////////////////////////////wAAAAAAAEBVA1RVVVUAVQEAAAAAAADA//////////////////////////////////////////////////////8AAAAAAABAVQFUVVVVAFUFAAAAAAAAAP//////////////////////////////////////////////////////AAAAAAAAUFUBVFVVVUBVBQAAAAAAAAD/////////////////////////////////////////////////////PwAAAAAAEFBVDVRVVVVAVTUwAAAAAAAA/////////////////////////////////////////////////////z8AAAAAABBcVQVUVVXVUFUVEAAAAAAAAP////////////////////////////////////////////////////8/AAAAAAAUVFU1VFVV1VBVFdAAAAAAAAD/////////////////////////////////////////////////////PwAAAAAAFFRVFVRVVRVUVdVQAAAAAAAA/////////////////////////////////////////////////////z8AAAAAABVUVVVUVVUVV1VVUAMAAAAAAP////////////////////////////////////////////////////8/AAAAAAAVV1VVX1VV1VVVVVQBAAAAAMD/////////////////////////////////////////////////////PwAAAABAFVVVVV1VVVVVVVVUDQAAAADA/////////////////////////////////////////////////////z8AAAAAQNVVVVVVVVVVVVVVVAUAAAAAwP////////////////////////////////////////////////////8/AAAAAHBVVVVVVVVVVVVVVVUFAAAAAMD/////////////////////////////////////////////////////PwAAAABQVVVVVVVVVVVVVVVVNQAAAADA/////////////////////////////////////////////////////z8AAAAAUFVVVVVVVVVVVVVVVRUAAAAAwP///////////////////////////////////////////////////181AAAAAFBVVVVVVVVVVVVVVVUVAAAAAHBV/f///////////////////////////////////////////////39VVVUNAABQVVV/VVVVVVVV/VdVFQAAAFdVVdX///////////////////////////////////////////////9/VVVVFQAAUFX//19VVVVV9f//VxUAAEBVVVX1/////////////////////////////////////////////////1VVVRUAAFDV//9/VVVVVfX//18VAABAVVVV/f////////////////////////////////////////////////9VVVUVAABQ/f//f1VVVVX1////FQAAQFVVVf//////////////////////////////////////////////////V1VVFQAAUP3//39VVVVV/f///xcAAEBVVdX//////////////////////////////////////////////////19VVRUAAFD9//9/VVVVVf3///8VAABAVVX1//////////////////////////////////////////////////9/VVUVAABQ/f//f1VVVVX9////NQAAwFVV/f///////////////////////////////////////////////////1dVFQAAUP3//39VVVVV/f//fwUAAEBVVf////////////////////////////////////////////////////9fVRUAAHD1//9/VVVVVfX//38FAABAVdX/////////////////////////////////////////////////////f1UVAABA9f//f1VVVVX1//9fBQAAQFX1//////////////////////////////////////////////////////9UFQAAQNX//19VVVVV9f//Vw0AAEBV/P//////////////////////////////////////////////////////cBUAAMBV//9fVVVVVdX//1cBAABAFfz//////////////////////////////////////////////////////wAVAAAAVf3/V1VVVVXV/39VAQAAQAH8/////////////////////////////////////////////////////z8AEAAAEFfV/1VVVVVVVf1XVRAAAMAA/P////////////////////////////////////////////////////8/AAAAAFBXVVVVVVVVVVVVVdUVAAAAAPz/////////////////////////////////////////////////////PwAAAABwVVVVVVVVVVVVVVVVFQAAAAD8/////////////////////////////////////////////////////z8AAAAAQFVVVVVVVVVVVVVVVQUAAAAA/P////////////////////////////////////////////////////8/AAAAAEBVVVVVVVVVVVVVVVUFAAAAAPz/////////////////////////////////////////////////////PwAAAAAAVVVVVVVVVVVVVVVVDQAAAAD8/////////////////////////////////////////////////////z8AAAAAAFVVVVVVVVVVVVVVVQEAAAAA/P////////////////////////////////////////////////////8/AAAAAABUVVVVVVVVVVVVVVUDAAAAAPz/////////////////////////////////////////////////////PwAAAAAAVFVVVVVVVVVVVVVVAAAAAAD8/////////////////////////////////////////////////////z8AAAAAAFBVVVVVVVVVVVVVFQAAAAAA8P////////////////////////////////////////////////////8/AAAAAABAVVVVVVVVVVVVVQUAAAAAAPD/////////////////////////////////////////////////////PwAAAAAAAFdVVVVVVVVVVVUDAAAAAADw/////////////////////////////////////////////////////z8AAAAAAABQVVVVVVVVVVUVAAAAAAAA8P////////////////////////////////////////////////////8/AAAAAAAAAFVVVVVVVVVVAQAAAAAAAPD/////////////////////////////////////////////////////PwAAAAAAAABQVVVVVVVVFQAAAAAAAADw/////////////////////////////////////////////////////z8AAAAAAAAAAFRVVVVVVQAAAAAAAAAA8P////////////////////////////////////////////////////8/AAAAAAAAAAAAVFVVVQMAAAAAAAAAAMD/////////////////////////////////////////////////////DwAAAAAAAAAAAFBVVdUAAAAAAAAAAADA/////////////////////////////////////////////////////w8AAAAAAAAAAABQVVXVAAAAAAAAAAAAwP////////////////////////////////////////////////////8PAAAAAAAAAAAAUFVV1QAAAAAAAAAAAMD/////////////////////////////////////////////////////DwAAAAAAAAAAAFBVVdUAAAAAAAAAAAAA/////////////////////////////////////////////////////w8AAAAAAAAAAABQVVXVAAAAAAAAAAAAAP////////////////////////////////////////////////////8PAAAAAAAAAAAAWFVVVQMAAAAAAAAAAAD/////////////////////////////////////////////////////DwAAAAAAAAAAwFZVVVULAAAAAAAAAAAA/////////////////////////////////////////////////////wMAAAAAAAAAALBWVVVVKwAAAAAAAAAAAPz///////////////////////////////////////////////////8DAAAAAAAAAACsVlVVVasAAAAAAAAAAAD8////////////////////////////////////////////////////AwAAAAAAAADAqVZVVVWqBwAAAAAAAAAA/P///////////////////////////////////////////////////wMAAAAAAAAAVapWVVVVqlYBAAAAAAAAAPD///////////////////////////////////////////////////8AAAAAAAAAVJWqVlVVVapaVQAAAAAAAADw////////////////////////////////////////////////////AAAAAAAAQFW1qlZVVdWqelUFAAAAAAAA8P///////////////////////////////////////////////////wAAAAAAAFxVpapWVVWVqmpV1QAAAAAAAMD///////////////////////////////////////////////////8AAAAAAABUVamqVlVVtaqqVVUAAAAAAADA//////////////////////////////////////////////////8/AAAAAAAAUFWpql5VVaWqqldVAAAAAAAAAP//////////////////////////////////////////////////PwAAAAAAAFBVqqpaVVWtqqpWVQAAAAAAAAD//////////////////////////////////////////////////z8AAAAAAABQVaqqWlVVqaqqXtUAAAAAAAAA//////////////////////////////////////////////////8/AAAAAAAAUJWqqnpVVaqqqloVAAAAAAAAAPz/////////////////////////////////////////////////DwAAAAAAQECVqqpqVdWqqqpaFQwAAAAAAAD8/////////////////////////////////////////////////w8AAAAAAEBBpaqqalWVqqqqajUHAAAAAAAA8P////////////////////////////////////////////////8PAAAAAADA9aWqqqpVpaqqqmpFBQAAAAAAAPD/////////////////////////////////////////////////AwAAAAAAAFWtqqqqVa2qqqrqXQUAAAAAAADA/////////////////////////////////////////////////wMAAAAAAABVqaqqqlepqqqqqlUFAAAAAAAAwP////////////////////////////////////////////////8DAAAAAAAAVamqqqpWqqqqqqpVDQAAAAAAAAD/////////////////////////////////////////////////AAAAAAAAAFWpqqqqnqqqqqqqVQEAAAAAAAAA/////////////////////////////////////////////////wAAAAAAAABXqaqqqrqqqqqqqlUBAAAAAAAAAPz//////////////////////////////////////////////z8AAAAAAAAAVKmqqqqqqqqqqqpVAQAAAAAAAAD8//////////////////////////////////////////////8/AAAAAAAQAFSpqqqqqqqqqqqqVQAQAAAAAAAA8P//////////////////////////////////////////////PwAAAAAAUABUqaqqqqqqqqqqqlUAFAAAAAAAAMD//////////////////////////////////////////////w8AAAAAAFABUKmqqqqqqqqqqqrVABUAAAAAAADA//////////////////////////////////////////////8PAAAAAABUBVCpqqqqqqqqqqqqFUBVAAAAAAAAAP//////////////////////////////////////////////AwAAAAAAVBVwqaqqqqqqqqqqqjVQVQAAAAAAAAD//////////////////////////////////////////////wMAAAAAAFRVQK2qqqqqqqqqqqoFVFUAAAAAAAAA/P////////////////////////////////////////////8AAAAAAABVVcWlqqqqqqqqqqrqTVVVAwAAAAAAAPD/////////////////////////////////////////////AAAAAAAAVVXVpaqqqqqqqqqqalVVVQEAAAAAAADw////////////////////////////////////////////PwAAAAAAAFVVVaWqqqqqqqqqqmpVVVUBAAAAAAAAwP///////////////////////////////////////////z8AAAAAAEBVVVWlqqqqqqqqqqrqVVVVAQAAAAAAAAD///////////////////////////////////////////8PAAAAAABAVVVVtaqqqqqqqqqqOlVVVQUAAAAAAAAA////////////////////////////////////////////DwAAAAAAQFVVVbGqqqqqqqqqqgpVVVUFAAAAAAAAAPz//////////////////////////////////////////wMAAAAAAFBVVVWhqqqqqqqqqqoKVFVVBQAAAAAAAADw//////////////////////////////////////////8AAAAAAABQVVVVoKqqqqqqqqqqClRVVTUAAAAAAAAA8P//////////////////////////////////////////AAAAAAAAUFVVVaCqqqqqqqqqqgpUVVUVAAAAAAAAAMD/////////////////////////////////////////PwAAAAAAAFRVVdWwqqqqqqqqqqo6UFVVFQAAAAAAAAAA/////////////////////////////////////////z8AAAAAAABUVVUVgKqqqqqqqqqqClBVVdUAAAAAAAAAAP////////////////////////////////////////8PAAAAAAAAVFVVFYCqqqqqqqqqqgpAVVVVAAAAAAAAAAD8////////////////////////////////////////DwAAAAAAAFVVVQWAqqqqqqqqqqoKQFVVVQAAAAAAAAAA8P///////////////////////////////////////wMAAAAAAABVVVUFgKqqqqqqqqqqDkBVVVUBAAAAAAAAAMD///////////////////////////////////////8AAAAAAABAVVVVDbCqqqqqqqqqqgoAVVVVAQAAAAAAAADA////////////////////////////////////////AAAAAAAAQFVVVQGgqqqqqqqqqqoqAFVVVQUAAAAAAAAAAP//////////////////////////////////////PwAAAAAAAFBVVVUBoKqqqqqqqqqqOgBXVVUFAAAAAAAAAAD8/////////////////////////////////////z8AAAAAAABUVVVVAKCqqqqqqqqqqgoAVFVVFQAAAAAAAAAA/P////////////////////////////////////8PAAAAAAAAVFVVVQCgqqqqqqqqqqo6AFRVVdUAAAAAAAAAAPD/////////////////////////////////////DwAAAAAAAFVVVdUAoKqqqqqqqqqqKgBQVVVVAAAAAAAAAADA/////////////////////////////////////wMAAAAAAMBVVVUVAKiqqqqqqqqqqqoAUFVVVQEAAAAAMAAAAP////////////////////////////////////8AAAAAAABAVVVVFQCoqqqqqqqqqqqqAFBVVVUBAAAAAMAAAAD/////////////////////////////////////AAAMAAAAUFVVVTUAqqqqqqqqqqqqqgJAVVVVBQAAAADAAwAA/P//////////////////////////////////PwAAAAAAAFxVVVUFAKqqqqqqqqqqqqoOQFVVVTUAAAAAAA8AAPD//////////////////////////////////z8AAAMAAABUVVVVBYCqqqqqqqqqqqqqCkBVVVUVAAAAAAAPAADw//////////////////////////////////8PAMAAAAAAV1VVVQGAqqqqqqqqqqqqqirAVVVV1QAAAAAAPwAAwP//////////////////////////////////DwDAAAAAAFVVVVUBoKqqqqqqqqqqqqoqAFVVVVUAAAAAAPwAAAD//////////////////////////////////wMA8AAAAEBVVVVVA6CqqqqqqqqqqqqqqgBVVVVVAwAAAAD8AwAA/P////////////////////////////////8DADwAAABAVVVVVQCoqqqqqqqqqqqqqqoDVFVVVQEAAAAA8A8AAPz/////////////////////////////////AAA8AAAAUFVVVVUAq6qqqqqqqqqqqqqqAFRVVVUNAAAAAPA/AADw/////////////////////////////////wAAPwAAAFBVVVUVAKqqqqqqqqqqqqqqqgBcVVVVBQAAAADwPwAAwP///////////////////////////////z8AwA8AAABUVVVVNQCqqqqqqqqqqqqqqqoAUFVVVTUAAAAAwP8AAMD///////////////////////////////8/AMAPAAAAVFVVVQWAqqqqqqqqqqqqqqqqAnBVVVUVAAAAAMD/AwAA////////////////////////////////DwDwDwAAAFVVVVUNgKqqqqqqqqqqqqqqqg5AVVVVFQAAAAAA/w8AAPz//////////////////////////////w8A8AMAAABVVVVVAaCqqqqqqqqqqqqqqqoKAFVVVVUAAAAAAP8/AAD8//////////////////////////////8DAPwDAABAVVVVVQCgqqqqqqqqqqqqqqqqOgBVVVVVAAAAAAD8PwAA8P//////////////////////////////AwD/AwAAQFVVVVUAqKqqqqqqqqqqqqqqqioAVFVVVQEAAAAA/P8AAPD//////////////////////////////wAA/wAAAHBVVVUVAKiqqqqqqqqqqqqqqqrqAFxVVVUBAAAAAPz/AwDA//////////////////////////////8AwP8AAABQVVVVNQCoqqqqqqqqqqqqqqqqqgBQVVVVDQAAAADw/w8AAP//////////////////////////////AMD/AAAAXFVVVQUAqKqqqqqqqqqqqqqqqqoCQFVVVQUAAAAA8P8PAAD//////////////////////////////wDw/wAAAFRVVVUBAKiqqqqqqqqqqqqqqqqqAkBVVVUFAAAAAMD/PwAA/P///////////////////////////z8A8D8AAABUVVVVAwCqqqqqqqqqqqqqqqqqqg4AVVVVFQAAAADA//8AAPz///////////////////////////8/APw/AAAAVVVVVQAAqqqqqqqqqqqqqqqqqqoKAFRVVRUAAAAAwP//AADw////////////////////////////PwD8PwAAAFVVVRUAgKqqqqqqqqqqqqqqqqqqOgBUVVXVAAAAAAD//wMA8P///////////////////////////w8A/D8AAEBVVVUFAICqqqqqqqqqqqqqqqqqqioAUFVVVQAAAAAA//8PAMD///////////////////////////8PAP8/AABAVVVVBQCwqqqqqqqqqqqqqqqqqqoqAEBVVVUDAAAAAP//DwDA////////////////////////////DwD/PwAAUFVVVQEAoKqqqqq6qqqqqqqqqqqqqgBAVVVVAQAAAAD8/z8AwP///////////////////////////w/A/z8AAFRVVVUAAKyqqqqq16qqqqqqqqqqqqoAAFVVVQUAAAAA/P//AAD///////////////////////////8PwP8/AABVVVVVAACoqqqqalWpqqqqqqqqqqqqAgBUVVUVAAAAAPz//wAA////////////////////////////D8D/PwBAVVVVFQAAqKqqql5VtaqqqqqqqqqqqgIAVFVVVQAAAADw//8DAPz//////////////////////////w/w/z8AUFVVVQUAAKqqqqpVVVWqqqqqqqqqqqoOAFBVVVUBAAAA8P//AwD8//////////////////////////8P8P8/AFxVVVUFAACqqqpaVVVVraqqqqqqqqqqCgBQVVVVDQAAAPD//w8A/P//////////////////////////D/D/PwBXVVVVBQDAqqqqV1VVVdWqqqqqqqqqqgoAUFVVVTUAAADA//8PAPD//////////////////////////w/w/z8AVVVVVQUAgKqqalVVVVVVqaqqqqqqqqoqAFBVVVXVAAAAwP//PwDw//////////////////////////8P8P8/QFVVVVUFAICqqlZVVVVVVdWqqqqqqqqqKgBQVVVVVQAAAMD//z8A8P//////////////////////////D/D/P1BVVVVVBQCgqupVVVVVVVVVraqqqqqqqioAcFVVVVUBAADA//8/APD//////////////////////////w/8//9UVVVVVQUAoKpeVVVVVVVVVVWqqqqqqqqqAEBVVVVVBQAAwP///wDw//////////////////////////8P/P//VFVVVVUBAKCqV1VVVVVVVVVVlaqqqqqqqgBAVVVVVTUAAMD///8AwP//////////////////////////P/z//1VVVVVVAQCoqlVVVVVVVVVVVVW1qqqqqqoAQFVVVVUVAAAA////A8D//////////////////////////z/8/39VVVVVVQMAqKpVVVVVVVVVVVVVVfWqqqqqAwBVVVVV1QAAAP///wPA//////////////////////////8//P9/VVVVVVUAAKiqVVVVVVVVVVVVVVVVVa+qqgIAVVVVVVUAAAD///8DwP////////////////////////////D/X1VVVVXVAACr6lVVVVVVVVVVVVVVVVVVraoCAFRVVVVVAwAA////D8D////////////////////////////w/19VVVVVFQAAqmpVVVVVVVVVVVVVVVVVVa2qAgBUVVVVVQEAAP///w/A////////////////////////////8/9XVVVVVwUAAKpqVVVVVVVVVVVVVVVVVVWlqg4AUFVVVVUNAAD///8PwP//////////////////////////////V1VVVVcFAACqalVVVVVVVVVVVVVVVVVVpaoKAFAVVVVVBQAA////D8D//////////////////////////////1VVVdVVAQAAq2pVVVVVVVVVVVVVVVVVVaWqDgBAFVVVVQUAAP///z/A//////////////////////////////9VVVUVVQMAAKh6VVVVVVVVVVVVVVVVVVWlqgIAwNVUVVU1AMD///8/wP//////////////////////////////VVVVNVUAAACgWlVVVVVVVVVVVVVVVVVVpaoCAABVVFVVFQDA////P8D//////////////////////////////1VVVQUVAAAAgFpVVVVVVVVVVVVVVVVVVaWqAAAAVFBVVRUAwP///z/A/////////////////////////////39VVVUNBQAAAABaVVVVVVVVVVVVVVVVVVW1KgAAABBQVVUVAMD///8/wP////////////////////////////9/VVVVAQAADAAAWFVVVVVVVVVVVVVVVVVVtQoAAAAAcFVVFQDA////P8D/////////////////////////////f1VVVQMAAAwAAFBVVVVVVVVVVVVVVVVVVbUCAAAAAEBVVTQA8P///z/A//////////////////////////////9f1VUAAAAPAABcVVVVVVVVVVVVVVVVVVWVAAAAAADAFVUAAPD///8/wP//////////////////////////////X1XVAAAADwAAVFVVVVVVVVVVVVVVVVVVFQAAAAAAANVUAAD8////P8D//////////////////////////////1919QAAAA8AAFRVVVVVVVVVVVVVVVVVVRUAAAAAAAAUUAAA/P///z/w//////////////////////////////9///0AAAAPAABUVVVVVVVVVVVVVVVVVVUVAAAAAAAAAAAAAP////8/8P//////////////////////////////////AAAAPwAAVFVVVVVVVVVVVVVVVVVVFQAAAAAAAAwAAAD/////P/D//////////////////////////////////wAAwD8AAFRVVVVVVVVVVVVVVVVVVRUAAAAAAAAMAADA/////z/8//////////////////////////////////8AAMA/AABUVVVVVVVVVVVVVVVVVVUVAAAAAAAADAAA8P////8//P//////////////////////////////////AADA/wAAVFVVVVVVVVVVVVVVVVVVFQAAAAAAAA8AAPz/////D/z//////////////////////////////////wMAwP8AAFRVVVVVVVVVVVVVVVVVVRUAAAAAAAAPAAD//////w////////////////////////////////////8DAMD/AABUVVVVVVVVVVVVVVVVVVUVAAAAAAAADwAA///////P////////////////////////////////////AwDA/wMAVFVVVVVVVVVVVVVVVVVVFQAAAAAAwA8AAP//////w////////////////////////////////////w8AwP8DAFRVVVVVVVVVVVVVVVVVVRUAAAAAAMAPAMD///////P///////////////////////////////////8PAMD/DwBXVVVVVVVVVVVVVVVVVVU1AAAAAADwDwDA///////8////////////////////////////////////DwDA/w8AV1VVVVVVVVVVVVVVVVVVNQAAAAAA/A8A8P///////////////////////////////////////////z8AwP8/AFdVVVVVVVVVVVVVVVVVVQUAAAAAAPwPAPz///////////////////////////////////////////8/AAD/PwBXVVVVVVVVVVVVVVVVVVUFAAAAAAD/AwD8/////////////////////////////////////////////wAA//8AV1VVVVVVVVVVVVVVVVVVBQAAAADA/wMA//////////////////////////////////////////////8AAP//A1dVVVVVVVVVVVVVVVVVVQUAAAAA8P8DwP//////////////////////////////////////////////AwD//w9XVVVVVVVVVVVVVVVVVVUFAAAAAPD/AMD//////////////////////////////////////////////w8A//8PVFVVVVVVVVVVVVVVVVVVBQAAAAD8/wDw//////////////////////////////////////////////8PAPz/P1RVVVVVVVVVVVVVVVVVVQUAAAAA//8A/P//////////////////////////////////////////////PwD8//9XVVVVVVVVVVVVVVVVVVUNAAAAwP8/AP////////////////////////////////////////////////8A/P//V1VVVVVVVVVVVVVVVVVVAQAAAPD/P8D/////////////////////////////////////////////////A/D//1dVVVVVVVVVVVVVVVVVVQEAAADw/w/w/////////////////////////////////////////////////w/A//9XVVVVVVVVVVVVVVVVVVUBAAAA/P8D//////////////////////////////////////////////////8/wP//V1VVVVVVVVVVVVVVVVVVAQAAAP//w////////////////////////////////////////////////////wD//1dVVVVVVVVVVVVVVVVVVQMAAAD///z///////////////////////////////////////////////////8P/P9XVVVVVVVVVVVVVVVVVVUAAADA////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVVVVAAADwP///////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVVVVVQAAA8D///////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVVVVVUAAAPw////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVVVVAMAD8P///////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVVVV1QDAA/D///////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVVVRUAwAPw////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVVUVAPAP8P///////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVVFQDwD/D///////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVVVRUA/A/w////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVVUVAPwP8P///////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVVFQD/P/D///////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVVVTXA/z/w////////////////////////////////////////////////////////////f1VVVVVVVVVVVVVVVVU1wP//8P///////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVVVNfD///D///////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVVVQX8///D/////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVUF////z/////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVVVVxf///z//////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVfX//////////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVX1//////////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVVV9f//////////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVfX//////////////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVVXV//////////////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVV1f//////////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVdX//////////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVXV//////////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVV1f//////////////////////////////////////////////////////////////////f1VVVVVVVVVVVVVVVdX//////////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVVV////////////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVf///////////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVX///////////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVVV////////////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVf3//////////////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVVX9//////////////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVV/f//////////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVfX//////////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVX1//////////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVV9f///////////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVdX///////////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVVXV////////////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVVVf///////////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVX///////////////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVVV/f//////////////////////////////////////////////////////////////////f1VVVVVVVVVVVVVVVf3//////////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVX1////////////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVV9f///////////////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVdX///////////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVXV////////////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVf///////////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVX9//////////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVV/f///////////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVfX///////////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVX1////////////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVV1f///////////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVX///////////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVV/////////////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVf3///////////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVX1////////////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVV9f///////////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVdX/////////////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVV/////////////////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVf////////////////////////////////////////////////////////////////////9fVVVVVVVVVVVVVVX9////////////////////////////////////////////////////////////////////f1VVVVVVVVVVVVVV9f////////////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVdX/////////////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVV/////////////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVf3///////////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVX9/////////////////////////////////////////////////////////////////////1VVVVVVVVVVVVVV9f////////////////////////////////////////////////////////////////////9fVVVVVVVVVVVVVdX/////////////////////////////////////////////////////////////////////f1VVVVVVVVVVVVVV//////////////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVfX/////////////////////////////////////////////////////////////////////X1VVVVVVVVVVVVXV/////////////////////////////////////////////////////////////////////39VVVVVVVVVVVVVVfX/////////////////////////////////////////////////////////////////////V1VVVVVVVVVVVVVV/f///////////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVV9f//////////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVVVVVVX9/////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVVVVVVVfX/////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVVVVVVVV/////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVVVVVVVdX/////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVVVVVVVV/f///////////////////////////////////////////////////////////39VVVVVVVVVVVVVVVVVVVVVVdX/////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVVVVVVVV//////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVVVVVVVVf3//////////////////////////////////////////////////////////////1dVVVVVVVVVVVVVVVVVVVXV//////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVVVVVVVf///////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVVVVVX9//////////////////////////////////////////////////////////////9XVVVVVVVVVVVVVVVVVVVV9f//////////////////////////////////////////////////////////////X1VVVVVVVVVVVVVVVVVVVdX//////////////////////////////////////////////////////////////19VVVVVVVVVVVVVVVVVVVVV//////////////////////////////////////////////////////////////9/VVVVVVVVVVVVVVVVVVVVVf3/////////////////////////////////////////////////////////////f1VVVVVVVVVVVVVVVVVVVVX1//////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVVVVVVVV9f//////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVVVVVdX//////////////////////////////////////////////////////////////1VVVVVVVVVVVVVVVVVVVVVV//////////////////////////////////////////////////////////////9VVVVVVVVVVVVVVVVVVVVVVf//////////////////////////////////////////////////////////////VVVVVVVVVVVVVVVVVVVVVVX9/////////////////////////////////////////////////////////////1dVVVVVVV1VVVVVVVVVVVVV/f////////////////////////////////////////////////////////////9XVVVVVVX1VVVVVVVVVVVVVfX/////////////////////////////////////////////////////////////V1VVVVVV1V9VVVVVVVVVVVX1/////////////////////////////////////////////////////////////1dVVVVVVVX/VVVVVVVVVVVV1f////////////////////////////////////////////////////////////9XVVVVVVVV/V9VVVVVVVVVVdX/////////////////////////////////////////////////////////////V1VVVVVVVf3/V1VVVVVVVVXV/////////////////////////////////////////////////////////////1dVVVVVVVX1//9XVVX1//9VVf////////////////////////////////////////////////////////////9XVVVVVVVV9f//////////f1X/////////////////////////////////////////////////////////////V1VVVVVVVdX///////////9X/////////////////////////////////////////////////////////////1dVVVVVVVVV////////////X/3///////////////////////////////////////////////////////////9XVVVVVVVVVf/////////////9////////////////////////////////////////////////////////////V1VVVVVVVVX9/////////////////////////////////////////////////////////////////////////1dVVVVVVVVV/f////////////////////////////////////////////////////////////////////////9XVVVVVVVVVf3/////////////////////////////////////////////////////////////////////////V1VVVVVVVVX1/////////////////////////////////////////////////////////////////////////1dVVVVVVVVV9f////////////////////////////////////////////////////////////////////////9XVVVVVVVVVfX/////////////////////////////////////////////////////////////////////////V1VVVVVVVVXV/////////////////////////////////////////////////////////////////////////1dVVVVVVVVV1f////////////////////////////////////////////////////////////////////////9XVVVVVVVVVdX/////////////////////////////////////////////////////////////////////////X1VVVVVVVVXV/////////////////////////////////////////////////////////////////////////19VVVVVVVVVVf////////////////////////////////////////////////////////////////////////9fVVVVVVVVVVX/////////////////////////////////////////////////////////////////////////X1VVVVVVVVVV/////////////////////////////////////////////////////////////////////////19VVVVVVVVVVf////////////////////////////////////////////////////////////////////////9/VVVVVVVVVVX/////////////////////////////////////////////////////////////////////////f1VVVVVVVVVV/////////////////////////////////////////////////////////////////////////39VVVVVVVVVVf//////////////////////////////////////////////////////////////////////////VVVVVVVVVVX//////////////////////////////////////////////////////////////////////////1VVVVVVVVVV//////////////////////////////////////////////////////////////////////////9VVVVVVVVVVf//////////////////////////////////////////////////////////////////////////V1VVVVVVVVX//////////////////////////////////////////////////////////////////////////1dVVVVVVVXV//////////////////////////////////////////////////////////////////////////9fVVVVVVVV1f//////////////////////////////////////////////////////////////////////////X1VVVVVVVdX//////////////////////////////////////////////////////////////////////////39VVVVVVVXV//////////////////////////////////////////////////////////////////////////9/VVVVVVVV1f///////////////////////////////////////////////////////////////////////////1VVVVVVVdX///////////////////////////////////////////////////////////////////////////9XVVVVVVX1////////////////////////////////////////////////////////////////////////////V1VVVVVV9f///////////////////////////////////////////////////////////////////////////19VVVVVVfX///////////////////////////////////////////////////////////////////////////9/VVVVVVX1/////////////////////////////////////////////////////////////////////////////1VVVVVV9f////////////////////////////////////////////////////////////////////////////9VVVVVVdX/////////////////////////////////////////////////////////////////////////////V1VVVVXV/////////////////////////////////////////////////////////////////////////////19VVVVV1f////////////////////////////////////////////////////////////////////////////9/VVVVVdX//////////////////////////////////////////////////////////////////////////////1dVVVXV//////////////////////////////////////////////////////////////////////////////9fVVVVVf//////////////////////////////////////////////////////////////////////////////f1VVVVX///////////////////////////////////////////////////////////////////////////////9VVVVV////////////////////////////////////////////////////////////////////////////////X1VVVf3///////////////////////////////////////////////////////////////////////////////9VVVX9////////////////////////////////////////////////////////////////////////////////X1VV9f////////////////////////////////////////////////////////////////////////////////9VVfX/////////////////////////////////////////////////////////////////////////////////X1XV//////////////////////////////////////////////////////////////////////////////////9VVf//////////////////////////////////////////////////////////////////////////////////f1X///////////////////////////////////////////////////////////////////////////////////9f/f//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////";
let _undineExactRegionBytes = null;
const _getUndineExactRegion = (nx, ny) => {
  if (!_undineExactRegionBytes) {
    const raw = atob(UNDINE_EXACT_REGION_2BIT);
    _undineExactRegionBytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  const [w, h] = UNDINE_EXACT_REGION_SIZE;
  const x = Math.min(w - 1, Math.max(0, Math.floor(nx * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor(ny * h)));
  const i = y * w + x;
  const region = (_undineExactRegionBytes[i >> 2] >> ((i & 3) * 2)) & 3;
  return region < 3 ? region : -1;
};
// 保存済みの正式RGBマスクは本体画像と同じ座標で作成されている。
// 本番、エディタの「合成」、「ゲームで試す」のすべてがこの対応表を通る。
const EXACT_DYE_MASKS = Object.freeze({ Mocchi:MOCCHI_DYE_MASK, Yaobikuni:YAOBIKUNI_DYE_MASK, Plant:PLANT_DYE_MASK, Eiki:EIKI_DYE_MASK, Pandora:PANDORA_DYE_MASK });
const EXACT_DYE_MASK_PLACEMENT = Object.freeze({ scaleX: 1, scaleY: 1, x: 0, y: 0 });
// タッチ式マスクエディタの対象は ALL_PLAYER_MONSTERS から実行時に生成する。
// モンスター名・画像URLをDebug用に複製せず、新規ベースモンも自動的に候補へ加わる。
// パンドラは正式な5色マスクを使う。赤=①、緑=②、青=③、黄=④、マゼンタ=⑤。
MASU_COLOR_REGION_HUES.Pandora = [
  { hue:0, noAAGuard:true, noEdgeGuard:true },
  { hue:120, noAAGuard:true, noEdgeGuard:true },
  { hue:240, noAAGuard:true, noEdgeGuard:true },
  { hue:60, noAAGuard:true, noEdgeGuard:true },
  { hue:300, noAAGuard:true, noEdgeGuard:true },
];
const makeDyeMaskEditorTargets = () => Object.values(ALL_PLAYER_MONSTERS).map(monster => ({
  id:String(monster.id).toLowerCase(), baseId:monster.id, name:monster.name, imageUrl:monster.imgUrl,
  maskUrl:EXACT_DYE_MASKS[monster.id] || null,
  hasMask:Array.isArray(MASU_COLOR_REGION_HUES[monster.id]) && MASU_COLOR_REGION_HUES[monster.id].length > 0,
}));
// Debug専用。画像全体の透明余白を除外し、実際に描かれた輪郭同士が重なる初期調整値を求める。
// 戻り値は256x384の調整プレビュー基準のpxと倍率で、本番補正やセーブデータには書き込まない。
const DYE_MASK_DEBUG_PREVIEW_SIZE = Object.freeze({ width:256, height:384 });
const _getImageAlphaBounds = (url) => new Promise((resolve, reject) => {
  const image = new window.Image();
  image.onload = () => {
    try {
      const width=image.naturalWidth||image.width, height=image.naturalHeight||image.height;
      const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
      const context=canvas.getContext('2d', { willReadFrequently:true });
      if(!context)throw new Error('Canvasを利用できません');
      context.drawImage(image,0,0,width,height);
      const pixels=context.getImageData(0,0,width,height).data;
      let left=width,top=height,right=-1,bottom=-1;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      if(right<left||bottom<top)throw new Error('非透明部分がありません');
      resolve({left:left/width,top:top/height,right:(right+1)/width,bottom:(bottom+1)/height});
    }catch(error){reject(error);}
  };
  image.onerror=()=>reject(new Error('画像を読み込めません'));
  image.src=url;
});
const _calculateDyeMaskAutoFit = async (bodyUrl, maskUrl) => {
  const [body,mask]=await Promise.all([_getImageAlphaBounds(bodyUrl),_getImageAlphaBounds(maskUrl)]);
  const scaleX=(body.right-body.left)/(mask.right-mask.left), scaleY=(body.bottom-body.top)/(mask.bottom-mask.top);
  const bodyCenterX=(body.left+body.right)/2, bodyCenterY=(body.top+body.bottom)/2;
  const maskCenterX=(mask.left+mask.right)/2, maskCenterY=(mask.top+mask.bottom)/2;
  return {
    x:+((bodyCenterX-(.5+scaleX*(maskCenterX-.5)))*DYE_MASK_DEBUG_PREVIEW_SIZE.width).toFixed(2),
    y:+((bodyCenterY-(.5+scaleY*(maskCenterY-.5)))*DYE_MASK_DEBUG_PREVIEW_SIZE.height).toFixed(2),
    scaleX:+(scaleX*100).toFixed(2), scaleY:+(scaleY*100).toFixed(2),
  };
};
const _loadExactDyeMask = (url, width, height, placement = null) => new Promise((resolve) => {
  try {
    const image = new window.Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) { resolve(null); return; }
        context.imageSmoothingEnabled = false;
        const uniformScale = placement?.scalePercent ? placement.scalePercent / 100 : 1;
        const scaleX = placement?.scaleX || uniformScale, scaleY = placement?.scaleY || uniformScale;
        const drawWidth = width * scaleX, drawHeight = height * scaleY;
        const drawX = (width - drawWidth) / 2 + width * (placement?.x || 0) + (placement?.xPx || 0);
        const drawY = (height - drawHeight) / 2 + height * (placement?.y || 0) + (placement?.yPx || 0);
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        resolve(context.getImageData(0, 0, width, height).data);
      } catch (_) { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  } catch (_) { resolve(null); }
});
const _exactDyeMaskRegion = (pixels, offset) => {
  if (!pixels || pixels[offset + 3] < 20) return -1;
  const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
  if (r > 200 && g < 80 && b < 80) return 0;
  if (g > 200 && r < 80 && b < 80) return 1;
  if (b > 200 && r < 80 && g < 80) return 2;
  if (r > 200 && g > 200 && b < 80) return 3;
  if (r > 200 && g < 80 && b > 200) return 4;
  return -1;
};
const _dyeRegionMaskCache = {};
// タッチ式エディタから試す間だけ使うBlob URL。保存領域や正式な画像参照は変更しない。
const _temporaryDyeMasks = Object.create(null);
const getDyeRegionMasks = (baseId, imgUrl, debugPlacement = null) => {
  debugPlacement = debugPlacement || (_temporaryDyeMasks[baseId] ? { maskUrl:_temporaryDyeMasks[baseId] } : null);
  const hues = MASU_COLOR_REGION_HUES[baseId];
  if (!hues || hues.length === 0) return null;
  const cacheKey = baseId + '::' + imgUrl + (debugPlacement ? `::debug:${debugPlacement.maskUrl||''}:${debugPlacement.xPx}:${debugPlacement.yPx}:${debugPlacement.scaleX}:${debugPlacement.scaleY}` : '');
  if (_dyeRegionMaskCache[cacheKey]) return _dyeRegionMaskCache[cacheKey];
  const promise = new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.onload = async () => {
        try {
          const natW = img.naturalWidth || img.width, natH = img.naturalHeight || img.height;
          // 解析は元の解像度ではなく縮小した画像で行う。
          // マスクはCSSのmask-imageとして表示サイズへ引き伸ばして使うため、立ち絵の表示は
          // せいぜい250px程度。1000px超の元絵をそのまま1画素ずつ判定すると1体あたり
          // 数秒かかり(実測3〜7秒)、起動時の読み込みが毎回長くなっていた。
          // 判定は正規化座標で行っており、平滑化の半径も画像幅に比例させているため、
          // 縮小しても部位の分かれ方は変わらない。
          // 正式マスクがあるモンスターは、保存済みPNGの色を染色部位として使う。
          // マスクの透明／無彩色部分は対象外のままにし、色相推定による目や境界への誤染色を防ぐ。
          // 正式登録前のパンドラだけはDEBUG定義の保存済みマスクを直接選ぶ。
          // どの経路を通るかで解析サイズが変わるので、縮小率を決める前に確定させる。
          const exactMaskUrl = debugPlacement?.maskUrl || EXACT_DYE_MASKS[baseId] || null;
          // 正式マスクは平滑化も色相の境界除外も通らない(「マスクの色を読むだけ」)ため、
          // 解析サイズを上げても重くならない。境目のズレを減らすためこちらだけ高解像度にする
          const analysisMax = exactMaskUrl ? MASK_EXACT_ANALYSIS_MAX_SIZE : MASK_ANALYSIS_MAX_SIZE;
          const scale = Math.min(1, analysisMax / Math.max(natW, natH));
          const w = Math.max(1, Math.round(natW * scale)), h = Math.max(1, Math.round(natH * scale));
          const regionDefs = _resolveRegionDefsForSize(baseId, hues, natW);
          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = w; srcCanvas.height = h;
          const srcCtx = srcCanvas.getContext('2d');
          if (!srcCtx) { resolve(null); return; }
          srcCtx.imageSmoothingEnabled = true;
          srcCtx.imageSmoothingQuality = 'high';
          srcCtx.drawImage(img, 0, 0, w, h);
          const src = srcCtx.getImageData(0, 0, w, h).data;
          const exactMask = exactMaskUrl
            ? await _loadExactDyeMask(exactMaskUrl, w, h, debugPlacement || EXACT_DYE_MASK_PLACEMENT)
            : null;
          const aaAlphaThreshold = baseId === 'Mocchi' ? 96 : 200;
          const maskCanvases = regionDefs.map(() => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
          const maskCtxs = maskCanvases.map(c => c.getContext('2d'));
          if (maskCtxs.some(c => !c)) { resolve(null); return; }
          const maskDatas = maskCtxs.map(ctx => ctx.createImageData(w, h));
          // 塗り分けの境目(色が隣接するピクセルとの間でにじむ部分)も誤判定しやすいため、
          // 先に全ピクセルの色相を計算しておき、隣接ピクセルと色相が大きく違う場所も除外する。
          // 正式マスクのときは下の色相判定を丸ごと通らないので、この表も作らない
          // (高解像度で解析するぶん、作ると無駄に時間だけかかる)
          const hueMap = new Float32Array(w*h).fill(NaN);
          if (!exactMask) for (let i = 0; i < w*h; i++) {
            const o = i*4;
            if (src[o+3] < 20) continue;
            hueMap[i] = _rgbToHsv(src[o], src[o+1], src[o+2])[0];
          }
          const hueAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? NaN : hueMap[y*w+x];
          // 1パス目: 画素ごとに所属部位を判定してグリッド化する(-1=無染色のまま)
          const grid = new Int8Array(w*h).fill(-1);
          for (let i = 0; i < w*h; i++) {
            const o = i*4;
            const r = src[o], g = src[o+1], b = src[o+2], a = src[o+3];
            if (a < 20) continue;
            const x = i % w, y = (i / w) | 0;
            const [hh, ss, vv] = _rgbToHsv(r, g, b);
            // 背景の飾りなど、そもそも染色対象にしない画素はここで除外する
            if (!exactMask && _isExcludedDyePixel(baseId, hh, ss, vv, x / w, y / h)) continue;
            // 保存済みの正解見本がある2体は、その輪郭座標を色相推定より優先する。
            const region = exactMask
              ? _exactDyeMaskRegion(exactMask, o)
              : baseId === 'Pandora'
                ? _getPandoraExactRegion((x + 0.5) / w, (y + 0.5) / h)
                : baseId === 'Mia'
                  ? _getMiaExactRegion((x + 0.5) / w, (y + 0.5) / h)
                : baseId === 'Undine'
                  ? _getUndineExactRegion((x + 0.5) / w, (y + 0.5) / h)
                  : _classifyDyePixel(hh, ss, vv, x / w, y / h, regionDefs);
            if (region < 0) continue;
            const def = regionDefs[region];
            // 輪郭線のうち実際に半透明でにじんでいる1px(自分自身の不透明度が低いピクセル)は
            // 色が正確でなく誤判定しやすいため、染色対象から除外し常に元の絵のまま残す。
            // 以前は「隣が透明に近いか」で判定していたため、体の輪郭を縁取る不透明な線画
            // (太さがあり色も正確)まで巻き込んで無染色のまま残ってしまい、染色後にモンスター
            // 元々の縁取り色だけが浮いて見える不具合があった。自分自身の不透明度で判定する
            // ことで、本当ににじんでいる最外周のみを除外し、輪郭線本体は正しく染色されるようにする。
            // ただし尻尾の先や小さな翼のように1〜2px幅しかない細い付属物は、全域が薄い不透明度に
            // なって丸ごと消えてしまうため、部位定義でnoAAGuard:trueを指定すればこの除外もスキップできる
            // (posBboxで位置を絞っているぶん、色のにじみを気にする理由がそもそも無い部位向け)
            const skipAAGuard = !!(def && typeof def === 'object' && def.noAAGuard);
            if (!exactMask && !skipAAGuard && a < aaAlphaThreshold) continue;
            // 塗り分けの境目(色が隣接するピクセルとの間でにじむ部分)も誤判定しやすいため、
            // 隣接ピクセルと色相が大きく違う場所は既定で除外する。ただし目のように細い部位は
            // 全域が境目になってしまい丸ごと消えるため、部位定義でnoEdgeGuard:trueを指定すれば
            // この除外をスキップできる。band/posBboxは色を見ずに位置だけで判定する部位なので、
            // 石材のようなノイズ質感がある絵だと隣接色相差の誤爆でごま塩状に穴が空きやすい。
            // 位置だけで確定している以上そもそも色境界を気にする必要がないため、既定で除外をスキップする。
            // 白バケツ(white:true)判定はそもそも彩度・明度だけで確定しており色相を見ていないため、
            // 白に近いピクセル同士でもRGBのわずかなノイズで色相が大きく暴れる(例:彩度0.13の
            // ほぼ白いピクセルが隣接ピクセルと色相が100°以上ズレる)性質があり、この色相差ベースの
            // 境界除外をそのまま当てはめると白い毛並みのテクスチャ線が無差別にごま塩状に無染色化されて
            // しまう(イブリースの羊毛でガビガビに見えていた主因)。白バケツ判定は自己のS/Vで既に
            // 確定しているため、こちらも既定で除外をスキップする
            const wantsEdgeGuard = !(def && typeof def === 'object' && (def.noEdgeGuard || def.posBbox || def.band || def.white));
            if (!exactMask && wantsEdgeGuard && ss >= 0.1 && vv >= 0.12) {
              let isColorEdge = false;
              for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
                const nh = hueAt(nx, ny);
                if (!Number.isNaN(nh) && _hueDist(hh, nh) > 35) { isColorEdge = true; break; }
              }
              if (isColorEdge) continue;
            }
            grid[i] = region;
          }
          // 2パス目: 毛並みなど細かい濃淡で判定がごま塩状に入れ替わる箇所を、
          // 周囲の多数決で均して滑らかな塊にする(境界のジグザグ自体は保つ)。
          // 強さ(半径・回数)はモンスターごとにMASU_COLOR_SMOOTHで調整
          const { radius, iterations } = _getSmoothParams(baseId, w);
          let smoothed = grid;
          // 正式RGBマスクはエディタで確定した境界そのものが正本なので、自動平滑化しない。
          for (let iter = 0; !exactMask && iter < iterations; iter++) {
            const next = new Int8Array(smoothed);
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = y*w + x;
                if (smoothed[i] < 0) continue;
                const counts = {};
                for (let dy = -radius; dy <= radius; dy++) {
                  for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x+dx, ny = y+dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    const nv = smoothed[ny*w+nx];
                    if (nv < 0) continue;
                    counts[nv] = (counts[nv] || 0) + 1;
                  }
                }
                let bestK = smoothed[i], bestC = -1;
                for (const k in counts) { if (counts[k] > bestC) { bestC = counts[k]; bestK = +k; } }
                next[i] = bestK;
              }
            }
            smoothed = next;
          }
          // 目のように面積が小さい部位(noEdgeGuardまたはposBboxで指定)は、周囲を広い部位(体など)に
          // 囲まれているため多数決の平滑化で塗り潰されて消えてしまうことがある。
          // そのため元の判定(1パス目の結果)を平滑化後に上書き復元し、確実に残す
          for (let i = 0; i < w*h; i++) {
            const orig = grid[i];
            if (orig < 0) continue;
            const def = regionDefs[orig];
            if (def && typeof def === 'object' && (def.noEdgeGuard || def.posBbox)) smoothed[i] = orig;
          }
          // 元絵が解析サイズより大幅に大きいモンスターは、マスクだけ高解像度で書き出す
          // 正式RGBマスクには自動生成マスク用の輪郭拡張も適用しない（透明領域を染めないため）。
          const hiRes = !exactMask && MASK_HIRES_BASE_IDS[baseId] ? _buildHiResMaskUrls(smoothed, regionDefs, src, w, h, natW, natH) : null;
          if (hiRes) { resolve(hiRes); return; }
          for (let i = 0; i < w*h; i++) {
            const best = smoothed[i];
            if (best < 0) continue;
            maskDatas[best].data[i*4+3] = src[i*4+3]; // マスクはアルファのみ使う(CSS maskとして重ねる)
          }
          const urls = maskCtxs.map((ctx, idx) => { ctx.putImageData(maskDatas[idx], 0, 0); return maskCanvases[idx].toDataURL(); });
          resolve(urls);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = imgUrl;
    } catch (e) { resolve(null); }
  });
  _dyeRegionMaskCache[cacheKey] = promise;
  return promise;
};
// 部位ごとの染まり方の調整。書かなければ「選んだ色の彩度でそのまま塗る」(既定)。
//   gloss … 元のイラストの彩度に比例させるときの基準彩度。
//           true なら画像全体の最大彩度、数値ならその値を基準にする。
//           光沢のあるグラデーション塗り(彩度の低いハイライト〜彩度の高い陰の帯で立体感を
//           出している絵)を、彩度を一律に固定して塗り潰してしまわないための設定。
//           淡い絵は最大彩度が一部の濃い箇所(モッチーなら口ばし)に引っぱられて全体が
//           白っぽくなるため、体の彩度に合わせた基準を数値で直接指定する。
//   sat   … 選んだ色の彩度に掛ける倍率。1未満にすると淡く仕上がる。
//           絵によっては同じ色でも色が乗りすぎて重く見えるので、その調整に使う。
// 値はモンスターごとに1つ書けば全部位に、配列で書けば部位ごとに効く(並びは MASU_COLOR_REGION_HUES と同じ)。
//
// 部位ごとに書き分けられるようにしているのは、白い部分にまったく色が入らなくなるため。
// 元の彩度に比例させる塗りは「元が白い＝染めても白い」になるので、白を基準色にした部位
// (アークの染色②は元の彩度が0.008しかない)は明度しか変わらず、暗い色を選んだときだけ
// 変化して見える＝「黒しか入らない」状態になっていた。白い部位は比例させず狙った彩度で塗る。
const MASU_COLOR_REGION_DYE = {
  // アークは3部位とも色が乗りすぎて重く見えたため、sat で全体を控えめにしている。
  // とくに染色①は面積がいちばん広く、少し色が乗るだけで重く見えるので大きく下げてある
  // (染め上がりの彩度で 0.75 → 0.48 → 0.25 と二段階で薄くした)。
  // 染色②は白い部分なので比例させず(gloss なし)、そのぶん sat を強めに下げる。
  Ark: [{ gloss: 1.0, sat: 0.45 }, { sat: 0.72 }, { gloss: 0.45, sat: 0.85 }],
  Tiger: { gloss: true },
  Mocchi: { gloss: 0.22 },
};
const _NO_REGION_DYE = { gloss: false, sat: 1 };
// 指定した部位に効く染め方の設定を返す(配列でなければ全部位に同じ設定が効く)
const _regionDyeSettingFor = (baseId, regionIdx) => {
  const v = MASU_COLOR_REGION_DYE[baseId];
  if (!v) return _NO_REGION_DYE;
  const one = Array.isArray(v) ? v[regionIdx || 0] : v;
  if (!one) return _NO_REGION_DYE;
  return { gloss: one.gloss || false, sat: Number.isFinite(one.sat) ? one.sat : 1 };
};
// ImageDataのピクセル配列(RGBA)を、指定した染色色idの狙った色相・彩度に置き換える(明度は元の陰影を保つ)
const _recolorImageData = (data, colorId, baseId, regionIdx) => {
  const t = _resolveColorTarget(colorId);
  if (!t) return;
  const { gloss, sat } = _regionDyeSettingFor(baseId, regionIdx);
  const targetS = Math.max(0, Math.min(1, t.s * sat));
  let satRef = 1;
  if (typeof gloss === 'number') {
    satRef = Math.max(0.05, gloss);
  } else if (gloss) {
    // 光沢グラデーションを保つ部位は、画像全体の最大彩度を基準に各ピクセルの彩度を正規化する
    // (元絵の彩度が高い部分ほど狙った彩度に近づき、低いハイライト部分はより白っぽく残る)
    let maxS = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] < 10) continue;
      const s = _rgbToHsv(data[i], data[i+1], data[i+2])[1];
      if (s > maxS) maxS = s;
    }
    satRef = Math.max(maxS, 0.3);
  }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] < 10) continue;
    const [, ss, vv] = _rgbToHsv(data[i], data[i+1], data[i+2]);
    const newV = t.vMin + (t.vMax - t.vMin) * vv;
    const newS = gloss ? targetS * Math.min(1, ss / satRef) : targetS;
    const [r, g, b] = _hsvToRgb(t.h, newS, newV);
    data[i] = r; data[i+1] = g; data[i+2] = b;
  }
};
// imgUrlの画像全体を指定色に染め直した画像をCanvasで生成し、dataURLで返す(色ごとにキャッシュ)
const _dyeRecolorCache = {};
const getRecoloredImage = (imgUrl, rawColorId, baseId, regionIdx) => {
  // 濃さ(@NN)は重ねるときの透明度で表現するので、染め直した画像そのものには影響しない。
  // ここで外しておかないと、濃さを変えるたびに同じ絵をもう一度作ってしまう
  const colorId = splitColorAlpha(rawColorId).base;
  if (!_resolveColorTarget(colorId)) return null;
  // 同じ画像・色でも、光沢保持などbaseId固有の染色規則が異なり得るため、
  // 通常表示とすべての呼び出し元で同じ条件のキャッシュだけを共有する。
  // 染め方は部位ごとに変えられるので、その設定もキーへ入れる。部位が違っても
  // 設定が同じなら同じ画像を使い回すので、書き分けていないモンスターの負荷は変わらない。
  const dye = _regionDyeSettingFor(baseId, regionIdx);
  const cacheKey = baseId + '::' + dye.gloss + '/' + dye.sat + '::' + imgUrl + '::' + colorId;
  if (_dyeRecolorCache[cacheKey]) return _dyeRecolorCache[cacheKey];
  const promise = new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.onload = () => {
        try {
          const natW = img.naturalWidth || img.width;
          const natH = img.naturalHeight || img.height;
          const scale = baseId === 'Mocchi'
            ? Math.min(1, MASK_ANALYSIS_MAX_SIZE / Math.max(natW, natH))
            : 1;
          const w = Math.max(1, Math.round(natW * scale));
          const h = Math.max(1, Math.round(natH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          _recolorImageData(imgData.data, colorId, baseId, regionIdx);
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL());
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = imgUrl;
    } catch (e) { resolve(null); }
  });
  _dyeRecolorCache[cacheKey] = promise;
  return promise;
};
// 部位間の既定色フォールバック: 指定した部位が「元の色」(未設定)のとき、別の部位の色をそのまま
// 引き継いで表示する。ライガーは耳・尻尾の先端(染色③)が未設定なら本体(染色①)の色に自動で
// 追従するようにし、「染色①だけで耳まで含めた全身が染まる」→染色③は耳・尻尾だけを別の
// アクセント色にしたいときだけ使う任意スロット、という運用にする
const MASU_COLOR_FALLBACK_REGION = { Tiger: { 2: 0 } };
// 染め直した絵の置き場所の名前。濃さ(@NN)は絵に影響しないので名前へ含めない
const _recoloredKey = (idx, colorId) => idx + '|' + splitColorAlpha(colorId).base;
// 立ち絵が縦長(2:3)のモンスター。一覧やアイコンの丸枠は正方形なので、既定の object-cover だと
// 上下が25%ずつ切られ、頭のてっぺんと尾びれが欠ける。画像は加工せず、ここに入れたモンスターだけ
// object-contain で全身を収める(横長・正方形の絵はこれまでどおり object-cover のまま)
const MONSTER_ART_CONTAIN_IDS = Object.freeze(['Undine', 'Yaobikuni', 'Mia', 'Pandora', 'Eiki']);
const monsterArtFitStyle = (baseId, style) => (MONSTER_ART_CONTAIN_IDS.includes(baseId) ? { ...style, objectFit: 'contain' } : style);
// 技カードのアイコンのように、絵は出すのに baseId を持ち回れない場所がある。
// そこだけ収め方が抜けていて、ウンディーネ・ヤオビクニの固有技カードで頭が切れていた。
// 表を二重に持つと片方だけ直して食い違うので、上の MONSTER_ART_CONTAIN_IDS から
// そのモンスターが使う画像URLを集めておき、URLからも同じ判断ができるようにする。
// ALL_PLAYER_MONSTERS は data/ally-monsters.js にあり、読み込み順の都合で最初に
// 呼ばれたときに作る(モジュール読み込み時点ではまだ無い場合がある)
let _monsterArtContainUrls = null;
const monsterArtUrlNeedsContain = (url) => {
  if (typeof url !== 'string' || !url) return false;
  if (!_monsterArtContainUrls) {
    const urls = new Set();
    const all = typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS ? ALL_PLAYER_MONSTERS : {};
    for (const baseId of MONSTER_ART_CONTAIN_IDS) {
      const monster = all[baseId];
      if (!monster) continue;
      for (const each of [monster.imgUrl, monster.iconUrl, monster.faceIconUrl, monster.unique && monster.unique.icon]) {
        if (each) urls.add(each);
      }
    }
    _monsterArtContainUrls = urls;
  }
  return _monsterArtContainUrls.has(url);
};
// 部位マスクは絵にぴったり重ねる必要がある。絵は object-fit(cover/contain)で枠へ収めるのに、
// マスクだけ既定の mask-size:100% 100%(枠いっぱいへ引き伸ばす)にすると、絵とマスクで縮尺が
// 変わって位置がずれる。正方形の絵を正方形の枠へ入れているあいだは cover も contain も
// 100% 100% も同じ結果になるので長く気付けなかったが、プラント(1536x1024)のように
// 正方形でない絵では大きくずれ、花のマスクが葉や花びらの途中に掛かってしまっていた。
// baseIdごとの表で持つと正方形でない絵が増えるたびに書き足す必要があり、書き忘れると
// また同じずれが出るため、絵の収め方そのものをマスクへ写す。
// 収め方は style.objectFit(MONSTER_ART_CONTAIN_IDSの指定)か、呼び出し側のTailwindクラスで決まる。
const monsterArtMaskSize = (className, style) => {
  const fit = style?.objectFit
    || (/(^|\s)object-contain(\s|$)/.test(className || '') ? 'contain' : '')
    || (/(^|\s)object-cover(\s|$)/.test(className || '') ? 'cover' : '');
  return (fit === 'contain' || fit === 'cover') ? fit : '100% 100%';
};
// マスモンの画像を、部位別の染色(masuColors配列)を反映して表示するコンポーネント。
// 部位分割データが無いモンスターは画像全体を染め直した1枚を表示する。
const DyedMonsterImage = ({ baseId, src, masuColors, alt, className, style: rawStyle, draggable, debugMaskPlacement = null }) => {
  const style = monsterArtFitStyle(baseId, rawStyle);
  const maskSize = monsterArtMaskSize(className, style);
  const hues = MASU_COLOR_REGION_HUES[baseId];
  const [masks, setMasks] = useState(null);
  const [recolored, setRecolored] = useState({});
  const rawColors = masuColors || [];
  const fallbackMap = MASU_COLOR_FALLBACK_REGION[baseId];
  const colors = (fallbackMap && hues) ? hues.map((_, idx) => rawColors[idx] || (fallbackMap[idx] !== undefined ? rawColors[fallbackMap[idx]] : rawColors[idx])) : rawColors;
  const colorKey = colors.join('|');
  useEffect(() => {
    if (!hues || hues.length === 0 || !colors.some(Boolean)) { setMasks(null); return; }
    let cancelled = false;
    Promise.resolve(getDyeRegionMasks(baseId, src, debugMaskPlacement)).then(urls => { if (!cancelled) setMasks(urls); });
    return () => { cancelled = true; };
  }, [baseId, src, colorKey, debugMaskPlacement?.maskUrl, debugMaskPlacement?.xPx, debugMaskPlacement?.yPx, debugMaskPlacement?.scaleX, debugMaskPlacement?.scaleY]);
  // 染め直した画像は部位ごとに作る(光沢保持の設定を部位ごとに変えられるため)。
  // 設定が同じ部位はgetRecoloredImage側のキャッシュで同じ画像を共有するので、
  // 書き分けていないモンスターでは作る枚数はこれまでと変わらない
  useEffect(() => {
    const wanted = colors.map((c, idx) => [idx, c]).filter(([, c]) => c);
    if (wanted.length === 0) { setRecolored({}); return; }
    let cancelled = false;
    // 濃さ(@NN)は重ねる透明度で出すので、作る絵は濃さ抜きの色で1枚。
    // 置き場所の名前も濃さ抜きにしておくと、スライダーを動かしている間に絵を作り直さない
    Promise.all(wanted.map(([idx, c]) => Promise.resolve(getRecoloredImage(src, c, baseId, idx)).then((url) => [_recoloredKey(idx, c), url])))
      .then((entries) => { if (!cancelled) setRecolored(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [baseId, src, colorKey]);
  if (!hues || hues.length === 0) {
    const recoloredSrc = colors[0] && recolored[_recoloredKey(0, colors[0])];
    const alpha = colorAlphaOf(colors[0]);
    // 濃さを下げているときだけ、元の絵の上に染めた絵を薄く重ねる。
    // 100%(既定)のときは今までどおり画像1枚だけを出す
    if (recoloredSrc && alpha < MASU_COLOR_ALPHA_MAX) {
      return (
        <div className={className} style={{...style, position:'relative', overflow:'hidden'}}>
          <img src={src} alt={alt} draggable={draggable} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'inherit'}}/>
          <img src={recoloredSrc} alt="" draggable={false} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'inherit', opacity:alpha/100}}/>
        </div>
      );
    }
    return <img src={recoloredSrc || src} alt={alt} draggable={draggable} className={className} style={style}/>;
  }
  if (!masks || !colors.some(Boolean)) {
    return <img src={src} alt={alt} draggable={draggable} className={className} style={style}/>;
  }
  return (
    <div className={className} style={{...style, position:'relative', overflow:'hidden'}}>
      <img src={src} alt={alt} draggable={draggable} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'inherit'}}/>
      {hues.map((_, idx) => (colors[idx] && masks[idx] && recolored[_recoloredKey(idx, colors[idx])]) ? (
        <img key={idx} src={recolored[_recoloredKey(idx, colors[idx])]} alt="" draggable={false} style={{
          position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'inherit',
          WebkitMaskImage:`url(${masks[idx]})`, maskImage:`url(${masks[idx]})`,
          WebkitMaskSize:maskSize, maskSize:maskSize,
          WebkitMaskPosition:'center', maskPosition:'center',
          WebkitMaskRepeat:'no-repeat', maskRepeat:'no-repeat',
          opacity:colorAlphaOf(colors[idx])/100,
        }}/>
      ) : null)}
    </div>
  );
};
// 種族チャレンジの全カードが使う、共通のモンスター絵の枠。
//
// 【なぜ共通部品にするか】
// これまでは MONSTER_ART_CONTAIN_IDS へモンスターIDを1体ずつ手で足す方式だったので、
// 新しいモンスターを追加するたびに書き忘れて頭や足が切れていた。
// ここでは baseId に関係なく必ず
//   ・固定サイズの枠
//   ・object-fit: contain（縦横比を変えず、枠へ全体を収める）
//   ・中央配置
// にするので、どのモンスターが増えても切れない。Base の <img> と
// マスモンの DyedMonsterImage のどちらも同じ規則で描く。
const MonsterArtFrame = ({ baseId, src, alt='', masuColors=null, className='', frameStyle=null, children=null }) => {
  // contain は inline style で指定する。className 側に object-cover が混ざっても
  // inline style が必ず勝つので、枠ごとに崩れることがない
  const fit = { width:'100%', height:'100%', objectFit:'contain', objectPosition:'center' };
  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ ...(frameStyle||{}) }}
    >
      {Array.isArray(masuColors)
        ? <DyedMonsterImage baseId={baseId} src={src} alt={alt} masuColors={masuColors} draggable={false} style={fit}/>
        : <img src={src} alt={alt} draggable={false} style={fit}/>}
      {children}
    </span>
  );
};
// 本番の染色モーダルとDebugで共有する色選択UI。色ID（元色=null、プリセット、カスタム）を
// そのまま受け渡し、表示側も共通のDyedMonsterImageへ渡すため、Debug専用の色変換を持たない。
const DyeRegionColorControls = ({ baseId, colors, onChange, onCustom }) => {
  const regionCount = dyeRegionCount(baseId);
  const regionLabels = ['①','②','③','④','⑤'];
  return <div className="space-y-2">{Array.from({length:regionCount}).map((_,idx)=>(
    <div key={idx} className="bg-black/30 rounded-xl p-2 border border-white/5">
      <div className="text-[8px] text-fuchsia-300 font-black uppercase mb-1">{regionCount>1?`染色${regionLabels[idx]||idx+1}`:'染色'}</div>
      <div className="grid grid-cols-6 gap-0.5">
        <button onClick={()=>onChange(idx,null)} className={`flex flex-col items-center gap-0.5 bg-black/40 border rounded-lg py-1 active:scale-95 ${!colors[idx]?'border-fuchsia-400 ring-2 ring-fuchsia-400':'border-white/10'}`}><span className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center" style={{background:'conic-gradient(#ef4444,#eab308,#22c55e,#3b82f6,#ef4444)'}}><RotateCcw size={7}/></span><span className="text-[5.5px] font-black">元の色</span></button>
        {/* 色を選び直しても濃さは引き継ぐ(色だけ変えたいときに毎回つまみを直さなくてよいように) */}
        {Object.keys(MASU_COLOR_TARGET).map(colorId=><button key={colorId} onClick={()=>onChange(idx,withColorAlpha(colorId,colorAlphaOf(colors[idx])))} className={`flex flex-col items-center gap-0.5 bg-black/40 border rounded-lg py-1 active:scale-95 ${splitColorAlpha(colors[idx]).base===colorId?'border-fuchsia-400 ring-2 ring-fuchsia-400':'border-white/10'}`}><span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{backgroundColor:MASU_COLOR_SWATCH[colorId]}}/><span className="text-[5.5px] font-black">{MASU_COLOR_LABELS[colorId]}</span></button>)}
        <button onClick={()=>onCustom(idx)} className={`flex flex-col items-center gap-0.5 bg-black/40 border rounded-lg py-1 active:scale-95 ${_parseCustomColorId(colors[idx])?'border-fuchsia-400 ring-2 ring-fuchsia-400':'border-white/10'}`}><span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{background:_parseCustomColorId(colors[idx])?getColorSwatchHex(colors[idx]):'conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#d946ef,#ef4444)'}}/><span className="text-[5.5px] font-black">カスタム</span></button>
      </div>
      {/* 濃さ(透過率)。色を選んでいる部位にだけ出す。「元の色」には濃さの意味が無いため */}
      {colors[idx]&&<div className="mt-1.5 flex items-center gap-2">
        <span className="text-[8px] font-black text-slate-300 shrink-0">濃さ</span>
        <input type="range" min={MASU_COLOR_ALPHA_MIN} max={MASU_COLOR_ALPHA_MAX} step={5} value={colorAlphaOf(colors[idx])}
          onChange={e=>onChange(idx,withColorAlpha(colors[idx],e.target.value))}
          aria-label={`染色${regionLabels[idx]||idx+1}の濃さ`} className="flex-1 min-w-0 min-h-[32px] accent-fuchsia-500 touch-none"/>
        <span className="text-[8px] font-black text-fuchsia-200 w-8 text-right shrink-0">{colorAlphaOf(colors[idx])}%</span>
      </div>}
    </div>
  ))}</div>;
};
// マスモンの全身表示は画面ごとにiconUrlへ切り替えず、通常表示と同じ立ち絵を使う。
// iconUrlしか持たない旧データも従来どおり表示できるようフォールバックは残す。
const masuDisplayImageUrl = (base) => base?.imgUrl || base?.iconUrl || '';
// 位置・大きさ・間隔は元画像全体を基準にした0〜1の正規化値だけを持つ。
// 表示先のCanvas寸法へ換算するのは描画時だけなので、透明余白を含む立ち絵でも各プレビューの同じ部位に重なる。
const makePatternLayer = (patch={}) => ({ pattern:'stripe', target:'all', color:'#38bdf8', opacity:55, size:0.08, spacing:0.16, rotation:0, x:0.5, y:0.5, placed:true, visible:true, ...patch });
const makePatternSettings = () => ({
  mode:'all',
  // デバッグ画面へ入った直後と初期化後は、素の立ち絵から始める。
  // レイヤー自体は残すことで、模様を選んだ瞬間から各方式を編集できるようにする。
  fullPattern:makePatternLayer({pattern:'none'}),
  regionPatterns:{0:makePatternLayer({pattern:'none',target:'1'}),1:makePatternLayer({pattern:'none',target:'2'}),2:makePatternLayer({pattern:'none',target:'3'}),3:makePatternLayer({pattern:'none',target:'4'}),4:makePatternLayer({pattern:'none',target:'5'})},
  decals:[],
  selectedLayer:'full',
});
const MASU_PATTERN_REPEAT_OPTIONS = [['stripe','縞模様'],['dot','水玉'],['leopard','ヒョウ柄'],['camouflage','迷彩'],['check','チェック柄'],['scale','鱗'],['honeycomb','ハニカム'],['lightning_repeat','雷模様'],['flame_repeat','炎模様'],['wave','波模様'],['crack','ひび割れ'],['star_repeat','星柄'],['heart_repeat','ハート柄'],['paw_repeat','肉球柄'],['rune_repeat','魔法文字'],['digital','デジタル柄']];
const MASU_PATTERN_POINT_OPTIONS = [['star','星'],['heart','ハート'],['scar','傷跡'],['paw','肉球'],['crown','王冠'],['flame','炎'],['lightning','雷'],['moon','月'],['sun','太陽'],['magic_circle','魔法陣'],['skull','ドクロ'],['wing','羽'],['number','数字'],['alphabet','アルファベット']];
const MASU_PATTERN_PRESET_COLORS = ['#38bdf8','#ef4444','#f59e0b','#22c55e','#a855f7','#ec4899','#f8fafc','#1f2937'];
// デバッグ画面だけで使う模様レイヤー。Canvasへ描き、保存データや元画像には触れない。
const MasuPatternLayer = ({ baseId, src, settings }) => {
  const canvasRef = useRef(null);
  const [displaySize,setDisplaySize]=useState({width:0,height:0});
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const update=()=>{const rect=canvas.getBoundingClientRect();const next={width:Math.max(1,rect.width),height:Math.max(1,rect.height)};setDisplaySize(prev=>Math.abs(prev.width-next.width)<.5&&Math.abs(prev.height-next.height)<.5?prev:next);};
    update();
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;
    observer?.observe(canvas);
    window.addEventListener('resize',update);
    return()=>{observer?.disconnect();window.removeEventListener('resize',update);};
  },[]);
  useEffect(() => {
    const canvas=canvasRef.current;
    if (!canvas || !src || settings.pattern==='none') { const ctx=canvas?.getContext('2d'); if(ctx)ctx.clearRect(0,0,canvas.width,canvas.height); return; }
    let cancelled=false;
    const loadImage=url=>new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=url;});
    (async()=>{
      const body=await loadImage(src);
      const masks=settings.target==='all'?null:await Promise.resolve(getDyeRegionMasks(baseId,src));
      const maskUrl=masks?.[Math.max(0,Number(settings.target)-1)];
      const mask=maskUrl?await loadImage(maskUrl):body;
      if(cancelled||!body||!mask)return;
      // CSS表示寸法とは別にDPR込みの内部解像度を持つ。元画像寸法固定のCanvasを
      // 横長プレビューへCSSで変形していた旧経路と違い、各表示先で一度だけ最終解像度へ縮小する。
      const dpr=Math.max(1,window.devicePixelRatio||1);
      const w=Math.max(1,Math.round(displaySize.width*dpr)),h=Math.max(1,Math.round(displaySize.height*dpr));
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');if(!ctx)return;
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.clearRect(0,0,w,h);ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,settings.opacity/100));ctx.fillStyle=settings.color;ctx.strokeStyle=settings.color;
      // object-fit:containの立ち絵と同じ矩形へ座標・寸法をDPR単位で合わせる。
      const bodyW=body.naturalWidth||body.width,bodyH=body.naturalHeight||body.height,fit=Math.min(w/bodyW,h/bodyH);
      const drawW=bodyW*fit,drawH=bodyH*fit,offsetX=(w-drawW)/2,offsetY=(h-drawH)/2;
      const point=settings.mode==='point';ctx.translate(offsetX+settings.x*drawW,offsetY+settings.y*drawH);ctx.rotate(settings.rotation*Math.PI/180);
      const basis=Math.min(drawW,drawH),unit=Math.max(1,basis*settings.spacing),motif=Math.max(1,basis*settings.size),extent=Math.hypot(drawW,drawH)*1.5;
      const star=(x,y,r)=>{ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r,px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();};
      const heart=(x,y,r)=>{ctx.beginPath();ctx.moveTo(x,y+r*.8);ctx.bezierCurveTo(x-r*1.4,y-r*.1,x-r*.8,y-r,x,y-r*.35);ctx.bezierCurveTo(x+r*.8,y-r,x+r*1.4,y-r*.1,x,y+r*.8);ctx.fill();};
      const paw=(x,y,r)=>{ctx.beginPath();ctx.ellipse(x,y+r*.25,r*.65,r*.52,0,0,Math.PI*2);ctx.fill();for(let i=-1.5;i<=1.5;i++){ctx.beginPath();ctx.arc(x+i*r*.38,y-r*.48-Math.abs(i)*r*.05,r*.22,0,Math.PI*2);ctx.fill();}};
      const tile=(draw)=>{for(let yy=-extent;yy<=extent;yy+=unit)for(let xx=-extent;xx<=extent;xx+=unit)draw(xx+((Math.round(yy/unit)&1)*unit*.5),yy);};
      if(point){
        if(!settings.placed){ctx.restore();return;}
        const r=motif*2.2,p=settings.pattern;ctx.lineWidth=Math.max(1,r*.12);ctx.lineCap='round';ctx.lineJoin='round';
        if(p==='star')star(0,0,r);else if(p==='heart')heart(0,0,r);else if(p==='paw')paw(0,0,r);else if(p==='number'||p==='alphabet'){ctx.font=`900 ${r*2}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p==='number'?'7':'M',0,0);}else if(p==='moon'){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(r*.45,-r*.2,r*.85,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';}else if(p==='sun'){ctx.beginPath();ctx.arc(0,0,r*.55,0,Math.PI*2);ctx.fill();for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.75,Math.sin(a)*r*.75);ctx.lineTo(Math.cos(a)*r*1.2,Math.sin(a)*r*1.2);ctx.stroke();}}else if(p==='magic_circle'){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();star(0,0,r*.72);}else if(p==='crown'){ctx.beginPath();ctx.moveTo(-r,r*.65);ctx.lineTo(-r,-r*.55);ctx.lineTo(-r*.35,0);ctx.lineTo(0,-r*.8);ctx.lineTo(r*.35,0);ctx.lineTo(r,-r*.55);ctx.lineTo(r,r*.65);ctx.closePath();ctx.fill();}else if(p==='skull'){ctx.beginPath();ctx.arc(0,-r*.15,r*.75,0,Math.PI*2);ctx.fill();ctx.fillRect(-r*.45,r*.35,r*.9,r*.55);}else if(p==='lightning'){ctx.beginPath();ctx.moveTo(r*.15,-r);ctx.lineTo(-r*.65,r*.1);ctx.lineTo(-r*.05,r*.05);ctx.lineTo(-r*.25,r);ctx.lineTo(r*.7,-r*.25);ctx.lineTo(r*.1,-r*.15);ctx.closePath();ctx.fill();}else if(p==='flame'){ctx.beginPath();ctx.moveTo(0,r);ctx.bezierCurveTo(-r*1.1,r*.3,-r*.35,-r*.25,0,-r);ctx.bezierCurveTo(r*.15,-r*.2,r*1.1,r*.25,0,r);ctx.fill();}else {ctx.beginPath();ctx.moveTo(-r,-r*.65);ctx.quadraticCurveTo(0,-r*.15,r,-r*.7);ctx.quadraticCurveTo(r*.15,0,r,r*.75);ctx.quadraticCurveTo(0,r*.2,-r,r*.65);ctx.stroke();}
      }else if(settings.pattern==='stripe'){
        ctx.lineWidth=motif;for(let x=-extent;x<=extent;x+=unit){ctx.beginPath();ctx.moveTo(x,-extent);ctx.lineTo(x,extent);ctx.stroke();}
      }else if(settings.pattern==='dot'||settings.pattern==='leopard'){
        for(let y=-extent;y<=extent;y+=unit)for(let x=-extent;x<=extent;x+=unit){const offset=(Math.round(y/unit)&1)*unit*.5,r=motif*(settings.pattern==='dot'?0.5:0.65);ctx.lineWidth=Math.max(1,motif*.18);ctx.beginPath();ctx.arc(x+offset,y,r,0,Math.PI*2);settings.pattern==='dot'?ctx.fill():ctx.stroke();if(settings.pattern==='leopard'){ctx.beginPath();ctx.arc(x+offset+r*.25,y-r*.1,r*.48,0,Math.PI*2);ctx.stroke();}}
      }else if(settings.pattern==='star_repeat'){tile((x,y)=>star(x,y,motif*.5));
      }else if(settings.pattern==='heart_repeat'){tile((x,y)=>heart(x,y,motif*.5));
      }else if(settings.pattern==='paw_repeat'){tile((x,y)=>paw(x,y,motif*.5));
      }else if(settings.pattern==='crack'){
        ctx.lineWidth=Math.max(1,motif*.18);for(let y=-extent;y<=extent;y+=unit)for(let x=-extent;x<=extent;x+=unit){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+motif*.45,y+motif*.65);ctx.lineTo(x-motif*.25,y+motif*1.2);ctx.lineTo(x+motif*.6,y+motif*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+motif*.45,y+motif*.65);ctx.lineTo(x+motif*1.1,y+motif);ctx.stroke();}
      }else if(settings.pattern==='check'||settings.pattern==='digital'){tile((x,y)=>ctx.fillRect(x-motif*.45,y-motif*.45,motif*(settings.pattern==='digital'?.9:1.6),motif*(settings.pattern==='digital'?.45:1.6)));}
      else if(settings.pattern==='wave'||settings.pattern==='scale'){ctx.lineWidth=Math.max(1,motif*.16);tile((x,y)=>{ctx.beginPath();ctx.arc(x,y,motif*.65,0,Math.PI);ctx.stroke();});}
      else if(settings.pattern==='honeycomb'){ctx.lineWidth=Math.max(1,motif*.14);tile((x,y)=>{ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3,px=x+Math.cos(a)*motif*.55,py=y+Math.sin(a)*motif*.55;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();});}
      else if(settings.pattern==='rune_repeat'){ctx.font=`900 ${motif}px serif`;ctx.textAlign='center';tile((x,y)=>ctx.fillText('ᚱ',x,y));}
      else if(settings.pattern==='camouflage'){tile((x,y)=>{ctx.beginPath();ctx.ellipse(x,y,motif*.75,motif*.4,(x+y)%2,0,Math.PI*2);ctx.fill();});}
      else if(settings.pattern==='lightning_repeat'||settings.pattern==='flame_repeat'){ctx.lineWidth=Math.max(1,motif*.25);tile((x,y)=>{ctx.beginPath();ctx.moveTo(x-motif*.4,y-motif*.5);ctx.lineTo(x+motif*.15,y);ctx.lineTo(x-motif*.1,y+motif*.55);ctx.stroke();});}
      ctx.restore();ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,offsetX,offsetY,drawW,drawH);ctx.globalCompositeOperation='source-over';
    })();
    return()=>{cancelled=true;};
  },[baseId,src,displaySize.width,displaySize.height,settings.mode,settings.pattern,settings.target,settings.color,settings.opacity,settings.size,settings.spacing,settings.rotation,settings.x,settings.y,settings.placed]);
  return <canvas ref={canvasRef} aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'}}/>;
};
const patternLayers = settings => [settings.fullPattern&&{...settings.fullPattern,_key:'full'},...Object.entries(settings.regionPatterns||{}).map(([key,value])=>value&&({...value,_key:`region:${key}`})),...(settings.decals||[]).map(value=>({...value,mode:'point',target:'all',placed:true,_key:`decal:${value.id}`}))].filter(layer=>layer&&layer.visible!==false);
const PatternedMasuImage = ({ masu, base, colors, settings, className='' }) => <div className={className} style={{position:'relative',overflow:'hidden'}}><DyedMonsterImage baseId={masu.baseId} src={masuDisplayImageUrl(base)} alt={masu.name} masuColors={colors} className="w-full h-full object-contain"/>{patternLayers(settings).map(layer=><MasuPatternLayer key={layer._key} baseId={masu.baseId} src={masuDisplayImageUrl(base)} settings={layer}/>)}</div>;
const PatternPlacementPreview = ({ masu, base, colors, settings, selectedDecal, onSelectDecal, onChangeDecal, onAddDecal, className='' }) => {
  const pointers=useRef(new Map()),gesture=useRef(null);
  const point=e=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
  const down=e=>{if(settings.mode!=='point')return;e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);pointers.current.set(e.pointerId,p);const ps=[...pointers.current.values()];if(ps.length===1){const hit=[...(settings.decals||[])].reverse().find(d=>d.visible!==false&&Math.hypot(d.x-p.x,d.y-p.y)<Math.max(.055,d.size*2.8));const decal=hit||selectedDecal;if(hit)onSelectDecal(hit.id);if(!decal){onAddDecal(p);return;}if(!hit)onChangeDecal(decal.id,{x:p.x,y:p.y});gesture.current={id:decal.id,x:hit?decal.x:p.x,y:hit?decal.y:p.y,start:p,moved:false};}else if(ps.length===2&&selectedDecal){gesture.current={id:selectedDecal.id,size:selectedDecal.size,rotation:selectedDecal.rotation,distance:Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y),angle:Math.atan2(ps[1].y-ps[0].y,ps[1].x-ps[0].x)};}};
  const move=e=>{if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,point(e));const ps=[...pointers.current.values()],g=gesture.current;if(!g)return;if(ps.length===1&&g.start){const dx=ps[0].x-g.start.x,dy=ps[0].y-g.start.y;g.moved=g.moved||Math.hypot(dx,dy)>.005;onChangeDecal(g.id,{x:Math.max(0,Math.min(1,g.x+dx)),y:Math.max(0,Math.min(1,g.y+dy))});}else if(ps.length===2&&g.distance){const distance=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y),angle=Math.atan2(ps[1].y-ps[0].y,ps[1].x-ps[0].x);onChangeDecal(g.id,{size:Math.max(.02,Math.min(.25,g.size*distance/g.distance)),rotation:g.rotation+(angle-g.angle)*180/Math.PI});}};
  const up=e=>{pointers.current.delete(e.pointerId);gesture.current=null;};
  return <div className={className} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{position:'relative',overflow:'hidden',touchAction:settings.mode==='point'?'none':'auto',cursor:settings.mode==='point'?'crosshair':'default'}}><PatternedMasuImage masu={masu} base={base} colors={colors} settings={settings} className="w-full h-full"/>{selectedDecal&&settings.mode==='point'&&<span aria-hidden="true" style={{position:'absolute',left:`${selectedDecal.x*100}%`,top:`${selectedDecal.y*100}%`,width:`${Math.max(24,selectedDecal.size*520)}px`,height:`${Math.max(24,selectedDecal.size*520)}px`,transform:'translate(-50%,-50%)',border:'2px dashed #67e8f9',borderRadius:'50%',pointerEvents:'none'}}/>}</div>;
};
// カードやアイテムの icon 欄には「絵文字1文字」と「画像」が混在している。
// 2026年8月に画像を base64 の埋め込みから images/ 以下のPNGファイルへ移したため、
// 「data: で始まるかどうか」では画像だと判定できなくなり、アシストカードや
// ブリーダーの教えのアイコンがパスの文字列のまま画面に出る不具合を出した。
// 判定はこの1か所に集約し、以後どちらの形でも画像として扱えるようにする。
const isImageIconValue = (v) => typeof v === 'string' && (v.startsWith('images/') || v.startsWith('data:') || /^https?:\/\//.test(v));
// ききの元画像は全身を含むため、アシストカードで使う丸アイコンだけ顔へ寄せる。
// 同じ画像を使うプロフィール用アイコンは別IDなので、従来のプロフィール構図を維持する。
const KIKI_FACE_ICON_ADJUSTMENT = Object.freeze({ scale:2.37, x:0, y:19 });
const iconAdjustmentTransformStyle = ({ scale=1, x=0, y=0 }={}) => ({ transform:`translate(${x}%, ${y}%) scale(${scale})`, transformOrigin:'center center' });
const ASSIST_CARD_ICON_STYLES = Object.freeze({
  kiki: KIKI_FACE_ICON_ADJUSTMENT,
});
const AssistCardIcon = ({ icon, cardId, className='', style }) => (
  <span aria-hidden="true" style={style} className={`relative overflow-hidden rounded-full inline-block shrink-0 align-middle ${className}`}><img src={icon} alt="" draggable={false} style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none',...iconAdjustmentTransformStyle(ASSIST_CARD_ICON_STYLES[cardId])}} className="absolute inset-0 w-full h-full object-contain"/></span>
);
// icon欄が画像なら<img>、絵文字ならそのまま返す。sizePxは画像のときの表示サイズ
const cardIconNode = (icon, sizePx, cardId) => isImageIconValue(icon)
  ? (ASSIST_CARD_ICON_STYLES[cardId]
    ? <AssistCardIcon icon={icon} cardId={cardId} style={{width:sizePx,height:sizePx}}/>
    : <img src={icon} alt="" draggable={false} style={{width:sizePx,height:sizePx,WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',pointerEvents:'none'}} className={`rounded-full ${monsterArtUrlNeedsContain(icon)?'object-contain':'object-cover'} inline-block shrink-0`}/>)
  : icon;
// ランキングの記録に載せる部位別の色を作る。
// colors は「何番目の部位か」を位置で表す配列なので、空きを詰めてはいけない。
// 詰めると ["青", 未設定, "青"] が ["青","青"] になり、2番目の部位まで染まって
// 3番目が元の色のまま残る(実際の染色と違う色でランキングに出る)。
// 部位数ぶんの長さに揃え、未設定は null で埋めて位置を保つ。
const rankingPartyColors = (baseId, colors) => {
  const raw = Array.isArray(colors) ? colors : [];
  return Array.from({ length: dyeRegionCount(baseId) }, (_, i) => raw[i] || null);
};
// ランキングの記録に載せる「マスモンの詳細」。編成の詳細から1体ずつ、育て方まで見られるようにする。
// 記録が重くならないよう、表示に必要な最小限だけを送る。技の中身はどの端末も同じデータを
// 持っているので、継承した固有技も元のモンスターIDとレベルだけ送り、見る側で組み立て直す
// (1体あたり数百バイト。以前ここへ画像を入れて読み込みが終わらなくなったことがあるため、
//  「同梱してあるもの(絵・技のデータ)は送らない」という方針を守る)。
// ===== 合体履歴 =====
// 実際に保存されているのは executeMasuFusion が積む
//   { subName, subBaseId, subBondLevel, xpGained, inherited, timestamp }
// の6項目だけ。ここではそれを表示できる形へそろえるだけで、無い項目は null のままにする
// (推測で埋めると「実際には残っていない履歴」を作ってしまう)。
// 継承した固有技そのものは履歴に持っていないが、継承したのは必ず相手の種の固有技なので、
// 主が持っている inheritedUniques から同じ種のものを探し、無ければ種の固有技を出す。
const normalizeFusionHistory = (masu) => {
  const raw = Array.isArray(masu?.fusionHistory) ? masu.fusionHistory : [];
  const inheritedList = Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : [];
  const posNum = (v) => (Number.isFinite(Number(v)) && Number(v) > 0) ? Math.floor(Number(v)) : null;
  return raw.map((entry, index) => {
    const e = (entry && typeof entry === 'object') ? entry : {};
    const subBaseId = (typeof e.subBaseId === 'string' && ALL_PLAYER_MONSTERS[e.subBaseId]) ? e.subBaseId : null;
    const subName = (typeof e.subName === 'string' && e.subName.trim()) ? e.subName.trim() : null;
    const inherited = e.inherited === true;
    let inheritedUnique = null;
    if (inherited && subBaseId) {
      // 主が今も持っている継承技のうち、同じ種から来たもの。見つかればそのときの名前・Lvが分かる
      const owned = inheritedList.find(u => u && u.monId === subBaseId && (!subName || !u.sourceMasuName || u.sourceMasuName === subName))
        || inheritedList.find(u => u && u.monId === subBaseId);
      inheritedUnique = owned || ALL_PLAYER_MONSTERS[subBaseId]?.unique || null;
    }
    const subBondLevel = posNum(e.subBondLevel);
    const xpGained = posNum(e.xpGained);
    const timestamp = posNum(e.timestamp);
    return {
      order: index + 1,                 // 何回目の合体か(古いほうが1)
      subName, subBaseId,
      subBaseName: subBaseId ? ALL_PLAYER_MONSTERS[subBaseId].name : null,
      subBondLevel, xpGained, inherited, inheritedUnique, timestamp,
      // 中身のある履歴かどうか。合体回数しか残っていない古いランキング記録は
      // 「{}」が回数ぶん並ぶだけなので、それを架空の履歴として描かないための目印
      hasDetail: !!(subBaseId || subName || subBondLevel != null || xpGained != null || timestamp != null),
    };
  });
};
const fusionHistoryHasDetail = (list) => Array.isArray(list) && list.some(h => h && h.hasDetail);
// 記録に載せる合体履歴の上限。1件60バイト前後なので、ここを外すと4体ぶんで記録が一気に重くなる。
// 実際の合体回数は fusionCount にそのまま残すので、上限を超えても回数は正しく出せる
const RANKING_FUSION_MAX = 12;
// v1: 育て方(ステータス・間合い適性・固有技Lv)＋合体回数だけ
// v2: 記録時点の総合力(power)と、合体履歴の中身(fusion)を追加。v1の項目はそのまま残す
// v3: 転生回数、v4: 保存済みの転生育成ボーナスと合体継承回数を追加
// v5: 超越(transcended とその強化ぶん)を追加。
//     ここが抜けていたため、ランキング一覧は絆Lv.410なのに「詳細」を開くと
//     Lv.400/400 MAX になる、という食い違いが出ていた。レベル上限は
//     masuLevelCapLimit() が「超越済みなら500、未超越なら400」で決めるので、
//     記録から組み立て直した個体に超越の印が無いと未超越として400へ丸められる。
//     同じ理由で超越強化で振ったぶんのステータスも詳細に出ていなかった。
const RANKING_DETAIL_VERSION = 5;
const rankingMasuDetail = (masu) => {
  if (!masu) return null;
  const sp = masu.statPoints || {};
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const inherited = (Array.isArray(masu.inheritedUniques) ? masu.inheritedUniques : []).map((unique, index) => {
    const monId = unique && unique.monId;
    if (!monId) return null;
    return { monId, level: resolveInheritedUniqueLevel(masu, unique, index) };
  }).filter(Boolean);
  return {
    v: RANKING_DETAIL_VERSION,
    name: typeof masu.name === 'string' ? masu.name.slice(0, 24) : null,
    bondXp: num(masu.bondXp),
    rebirthCount: num(masu.rebirthCount),
    // 転生回数。詳細の上部サマリーで「転生 +N」を出すのに要る
    reincarnateCount: num(masu.reincarnateCount),
    reincarnateBonusPoints: ownReincarnateBonusPoints(masu),
    inheritedReincarnateBonusPoints: inheritedReincarnateBonusPointsOf(masu),
    inheritedReincarnateCount: inheritedReincarnateCountOf(masu),
    levelCap: num(masu.levelCap) || null,
    // 超越(v5)。levelCap だけでは足りない。超越済みかどうかでレベル上限そのものが
    // 400/500 と変わるため、印が無いと Lv.400 へ丸められてしまう
    transcended: isTranscended(masu),
    transcendPoints: num(masu.transcendPoints),
    transcendStatPoints: normalizeTranscendStatPoints(masu.transcendStatPoints),
    transcendAptBoosts: normalizeTranscendAptBoosts(masu.transcendAptBoosts),
    statPoints: { hp: num(sp.hp), atk: num(sp.atk), def: num(sp.def), guts: num(sp.guts) },
    // 間合い適性は「グレードの文字」の配列(['C','M','C','C'] など)。数値ではないので
    // 数に直そうとすると全部0になり、ランキング側だけ全距離Cに見えてしまう
    distApt: Array.isArray(masu.distApt) ? masu.distApt.slice(0, 4).map(g => DIST_APTITUDE_GRADES.includes(g) ? g : 'C') : null,
    distAptPoints: num(masu.distAptPoints),
    uniqueLevel: num(masu.uniqueSkillLevels?.own),
    inherited,
    fusionCount: Array.isArray(masu.fusionHistory) ? masu.fusionHistory.length : 0,
    // 記録した時点の総合力。あとで種のバランスを変えても、過去の記録の数字が動かないようにする。
    // 計算は必ず共通の monsterPowerOf を通す(ランキング専用の式は作らない)
    power: (() => { const p = monsterPowerOf(mergeMasuIntoMon(masu)); return Number.isFinite(p) && p > 0 ? p : null; })(),
    // 合体履歴。技の中身・絵はどの端末も持っているので、相手の種のIDだけ送って見る側で組み立てる。
    // 空の項目は入れない(1件でも小さくするため)。新しいほうを残したいので後ろから切り出す
    fusion: normalizeFusionHistory(masu).filter(h => h.hasDetail).slice(-RANKING_FUSION_MAX).map(h => {
      const out = {};
      if (h.subBaseId) out.b = h.subBaseId;
      if (h.subName) out.n = h.subName.slice(0, 12);
      if (h.subBondLevel != null) out.l = h.subBondLevel;
      if (h.xpGained != null) out.x = h.xpGained;
      if (h.inherited) out.i = 1;
      if (h.timestamp != null) out.t = Math.floor(h.timestamp / 1000); // 秒で持つ(ミリ秒は要らない)
      return out;
    }),
  };
};
// 記録の詳細を、モンスター詳細の表示に使う「マスモン相当」の形へ戻す。
// 壊れた記録・知らないモンスターが入っていても落ちないよう、すべて既定値へ倒す。
const rankingDetailToMasu = (baseId, detail, colors) => {
  if (!detail || typeof detail !== 'object' || !baseId) return null;
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const sp = detail.statPoints || {};
  const uniqueSkillLevels = { own: num(detail.uniqueLevel) };
  const inheritedUniques = [];
  (Array.isArray(detail.inherited) ? detail.inherited : []).forEach((entry) => {
    const source = ALL_PLAYER_MONSTERS[entry && entry.monId]?.unique;
    if (!source) return; // 知らないモンスターの技は出せないので飛ばす(位置は詰めて数え直す)
    uniqueSkillLevels[`inh:${inheritedUniques.length}`] = num(entry.level);
    inheritedUniques.push({ ...source, monId: entry.monId, evoLevel: num(entry.level) });
  });
  return {
    id: null,
    baseId,
    name: (typeof detail.name === 'string' && detail.name.trim()) ? detail.name : (ALL_PLAYER_MONSTERS[baseId]?.name || 'マスモン'),
    bondXp: num(detail.bondXp),
    rebirthCount: num(detail.rebirthCount),
    // 転生回数はv3から。持っていない古い記録は0になる(転生していない扱い)
    reincarnateCount: num(detail.reincarnateCount),
    reincarnateBonusPoints: Number.isFinite(Number(detail.reincarnateBonusPoints)) ? num(detail.reincarnateBonusPoints) : totalReincarnatePoints(detail.reincarnateCount),
    inheritedReincarnateBonusPoints: num(detail.inheritedReincarnateBonusPoints),
    inheritedReincarnateCount: num(detail.inheritedReincarnateCount),
    levelCap: num(detail.levelCap) || INITIAL_MASU_LEVEL_CAP,
    // 超越はv5から。持っていない古い記録は未超越として読む(これまでと同じ見え方のまま)
    transcended: detail.transcended === true,
    transcendPoints: num(detail.transcendPoints),
    transcendStatPoints: normalizeTranscendStatPoints(detail.transcendStatPoints),
    transcendAptBoosts: normalizeTranscendAptBoosts(detail.transcendAptBoosts),
    statPoints: { hp: num(sp.hp), atk: num(sp.atk), def: num(sp.def), guts: num(sp.guts) },
    // グレード以外(数値へ潰してしまった古い記録など)が入っていたら、その記録には
    // 間合い適性が残っていないものとして扱う。nullにしておけば血統本来の適性が出るので、
    // 「全距離C」という実際には存在しない姿を作り出さずに済む
    distApt: (Array.isArray(detail.distApt) && detail.distApt.length === 4 && detail.distApt.every(g => DIST_APTITUDE_GRADES.includes(g))) ? [...detail.distApt] : null,
    distAptPoints: num(detail.distAptPoints),
    uniqueSkillLevels,
    inheritedUniques,
    // 合体履歴。v2の記録には中身(fusion)が入っている。
    // 中身が無いv1の記録では「回数ぶんの空の項目」だけを置き、履歴の中身は作らない。
    // ここで適当な相手や日時を作ってしまうと、実際には残っていない履歴を見せることになる
    fusionHistory: (() => {
      const raw = Array.isArray(detail.fusion) ? detail.fusion : [];
      const restored = raw.map((e) => {
        if (!e || typeof e !== 'object') return {};
        const t = num(e.t);
        return {
          subName: typeof e.n === 'string' ? e.n : undefined,
          subBaseId: typeof e.b === 'string' ? e.b : undefined,
          subBondLevel: num(e.l) || undefined,
          xpGained: num(e.x) || undefined,
          inherited: e.i === 1 || e.i === true,
          timestamp: t ? t * 1000 : undefined,
        };
      });
      if (restored.length > 0) return restored;
      return Array.from({ length: num(detail.fusionCount) }, () => ({}));
    })(),
    // 記録に残っている合体回数。上限で切った記録でも「全何回か」はこちらで分かる
    fusionRecordedCount: num(detail.fusionCount),
    // 記録した時点の総合力。無い(v1)なら null。0は「総合力0」ではなく「記録が無い」なので入れない
    powerSnapshot: (Number.isFinite(Number(detail.power)) && Number(detail.power) > 0) ? Math.round(Number(detail.power)) : null,
    colors: Array.isArray(colors) ? colors : [],
  };
};
// 限界突破の★。並びと色は breakthroughStars が保存値(rebirthCount)から組み立てる
const renderBreakthroughStar = (star, key, props = {}) => star.image
  ? <img key={key} src={star.image} alt="" className="mh-rainbow-breakthrough-star" {...props}/>
  : <span key={key} style={breakthroughStarStyle(star)} {...props}>★</span>;
const RebirthStars = ({ count = 0, className = '' }) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  const stars = breakthroughStars(value);
  if (!stars.length) return null;
  const final = isFinalBreakthroughCount(value);
  return <span className={`mh-rebirth-stars ${className}`} aria-label={final ? `最終限界突破(${value}回)` : `限界突破${value}回`}>{stars.map((s,i)=>renderBreakthroughStar(s,i))}</span>;
};
const breakthroughDebugInfo = (count) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  const levelCap = breakthroughLevelCap(value);
  if (!value) return { levelCap, label:'★なし' };
  if (value > BREAKTHROUGH_MAX_COUNT) return { levelCap, label:`虹${value-BREAKTHROUGH_MAX_COUNT}+金${FINAL_BREAKTHROUGH_COUNT-value}`, multiplier:levelUpPointMultiplier(value) };
  return { levelCap, label:BREAKTHROUGH_STAR_TIERS[Math.floor((value - 1) / BREAKTHROUGH_STARS_PER_TIER)].label };
};
const BreakthroughStarDebugCard = ({ count, compact = false }) => {
  const info = breakthroughDebugInfo(count);
  return <article className={`min-w-0 rounded-xl border bg-slate-900/90 text-center ${compact?'border-amber-400/50 p-2':'border-white/10 p-3'}`} data-breakthrough-star-debug-count={count}>
    <b className="block text-[11px] text-white">{count}凸</b>
    <span className="block text-[8px] text-slate-400">上限Lv{info.levelCap}</span>
    {info.multiplier>1&&<span className="block text-[8px] font-black text-amber-300">LvUPボーナス×{info.multiplier}</span>}
    <span className="block text-[9px] font-black text-amber-200">{info.label}</span>
    <div className="mt-2 min-h-[12px] flex items-center justify-center"><RebirthStars count={count}/>{count===0&&<span className="text-[8px] text-slate-600">★なし</span>}</div>
  </article>;
};
// 転生の回数プレート。詳細画面など、回数を確認する場所だけで使う。
// モーション軽減設定。CSS側は @media(prefers-reduced-motion:reduce) で止めるが、
// JS側の演出の長さもここで短くする(読み取れない環境では通常どおり)。
const prefersReducedMotion = () => {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
};
// 超越済みであることを示す共通マーク。モンスターの絵(まるく切り抜いてある)に重ならないよう、
// 丸の外側になる右上の角へ置く。角は丸の外なので、染色した絵をマークが隠さない。
// 虹★・転生バッジは絵の下なので、そちらとも重ならない。
// 画像は増やさず、CSSのグラデーションと「超」の文字だけで作る。
const TranscendenceBadge = ({ transcended = false, className = '', small = false }) => {
  if (!transcended) return null;
  return <span className={`mh-transcend-badge${small ? ' is-small' : ''} ${className}`} aria-label="超越済み"><b aria-hidden="true">超</b></span>;
};
const ReincarnateBadge = ({ count = 0, className = '' }) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (!value) return null;
  return <div className={`mh-reincarnate-badge ${className}`} aria-label={`転生${value}回`}>転生 ×{value}</div>;
};
// 一覧・詳細・HOME・演出で共有する転生オーラ。同じ画像を別周期で重ね、背面だけで燃焼感を作る。
const REINCARNATE_AURA_IMAGES = {
  blue: 'images/effects/reincarnate-aura-blue.PNG',
  yellow: 'images/effects/reincarnate-aura-yellow.PNG',
  red: 'images/effects/reincarnate-aura-red.PNG',
};
const ReincarnateAura = ({ count = 0, className = '' }) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (!value) return null;
  const stage = value >= 3 ? 'red' : value === 2 ? 'yellow' : 'blue';
  const src = REINCARNATE_AURA_IMAGES[stage];
  return <span className={`mh-reincarnate-aura is-${stage} ${className}`} aria-hidden="true">
    <span className="mh-reincarnate-flame is-back"><img src={src} alt=""/></span>
    <span className="mh-reincarnate-flame is-main"><img src={src} alt=""/></span>
    <span className="mh-reincarnate-flame is-foot"><img src={src} alt=""/></span>
    <span className="mh-reincarnate-sparks"/>
  </span>;
};
// HOME中央の安全領域だけを歩くマスモン。HOMEから外れるとコンポーネントごと破棄され、
// visibilitychangeでもタイマーを止めるため、画面遷移やバックグラウンド復帰で処理が重複しない。
const HomeWalkingMasumon = ({ masu, base, masuColors, index = 0, count = 1 }) => {
  // 個体ごとに開始位置と速度係数を固定し、再描画で動き方が跳ねないようにする。
  const laneCenter = count <= 1 ? 50 : 12 + (76 * index / Math.max(1, count - 1));
  const speedFactor = 0.9 + ((index * 17) % 5) * 0.045;
  const [motion, setMotion] = useState({ x: laneCenter, y: 24 + (index % 3) * 22, facing: index % 2 ? -1 : 1, walking: false, duration: 0 });
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const motionRef = useRef(motion);
  useEffect(() => {
    mountedRef.current = true;
    const clearMotionTimer = () => { if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; } };
    const scheduleWalk = (delay = 550 + Math.random() * 1050 + index * 90) => {
      clearMotionTimer();
      timerRef.current = setTimeout(() => {
        if (!mountedRef.current || document.visibilityState === 'hidden') return;
        const current = motionRef.current;
        // 横方向は個体ごとの緩いレーンを持たせ、5体が同じ場所に居続けるのを避ける。
        const laneWidth = count <= 1 ? 84 : 30;
        const x = Math.max(6, Math.min(94, laneCenter + (Math.random() - 0.5) * laneWidth));
        const y = 10 + Math.random() * 80;
        const distance = Math.hypot(x - current.x, y - current.y);
        const duration = Math.max(2100, Math.min(4800, (1850 + distance * 32) * speedFactor));
        const next = { x, y, facing: x < current.x ? -1 : 1, walking: true, duration };
        motionRef.current = next;
        setMotion(next);
        timerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          const stopped = { ...motionRef.current, walking: false };
          motionRef.current = stopped;
          setMotion(stopped);
          scheduleWalk(750 + Math.random() * 1750 + index * 110);
        }, duration);
      }, delay);
    };
    const onVisibilityChange = () => {
      clearMotionTimer();
      if (document.visibilityState === 'hidden') {
        const stopped = { ...motionRef.current, walking: false };
        motionRef.current = stopped;
        setMotion(stopped);
      } else scheduleWalk(350);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (document.visibilityState !== 'hidden') scheduleWalk();
    return () => { mountedRef.current = false; clearMotionTimer(); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [masu.id, index, count]);
  return <div className={`mh-home-masumon ${motion.walking ? 'is-walking' : ''}`} style={{left:`${motion.x}%`,top:`${motion.y}%`,zIndex:Math.round(motion.y),transitionDuration:`${motion.duration}ms`}}>
    <div className="mh-home-masumon-bob" style={{transform:`scaleX(${motion.facing})`,isolation:'isolate'}}>
      <DyedMonsterImage baseId={masu.baseId} src={base.imgUrl || base.iconUrl} alt="" masuColors={masuColors} draggable={false}/>
      <ReincarnateAura count={masu.reincarnateCount} className="is-home"/>
      <RebirthStars count={masu.rebirthCount} className="mh-home-masumon-stars"/>
    </div>
  </div>;
};
// 染色もどきの「カスタム」色選択: 色相バー(1本)+彩度・明度パッド(正方形)で任意の色を選べる
// 自前のスペクトラムピッカー。端末のOS標準カラーピッカー(<input type="color">)はiOS/Android/PCで
// 見た目も操作感もバラバラで、アプリのテーマにも合わせられず自動テストもできないため使わず、
// 既存のVolumeSliderと同じくpointerdown/move/upでドラッグを自前実装している
const CustomColorPicker = ({ h, s, v, onChange }) => {
  const squareRef = useRef(null);
  const hueRef = useRef(null);
  const [dragTarget, setDragTarget] = useState(null); // 'square'|'hue'|null
  const updateFromSquare = (clientX, clientY) => {
    const el = squareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ns = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nv = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    onChange(h, ns, nv);
  };
  const updateFromHue = (clientX) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nh = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    onChange(nh, s, v);
  };
  useEffect(() => {
    if (!dragTarget) return;
    const onMove = (e) => { if (dragTarget === 'square') updateFromSquare(e.clientX, e.clientY); else updateFromHue(e.clientX); };
    const onUp = () => setDragTarget(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragTarget, h, s, v]);
  const [pr, pg, pb] = _hsvToRgb(h, s, v);
  const previewColor = `rgb(${pr},${pg},${pb})`;
  const [hr, hg, hb] = _hsvToRgb(h, 1, 1);
  const pureHueColor = `rgb(${hr},${hg},${hb})`;
  return (
    <div className="flex flex-col gap-3">
      <div
        ref={squareRef}
        onPointerDown={(e) => { setDragTarget('square'); updateFromSquare(e.clientX, e.clientY); }}
        className="relative w-full aspect-square rounded-2xl cursor-pointer touch-none overflow-hidden border border-white/10"
        style={{ backgroundColor: pureHueColor, backgroundImage: 'linear-gradient(to right, #fff, rgba(255,255,255,0)), linear-gradient(to top, #000, rgba(0,0,0,0))' }}
      >
        <div
          className="absolute rounded-full border-2 border-white shadow-[0_0_6px_rgba(0,0,0,0.8)]"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, width: '20px', height: '20px', transform: 'translate(-50%,-50%)', backgroundColor: previewColor }}
        ></div>
      </div>
      <div
        ref={hueRef}
        onPointerDown={(e) => { setDragTarget('hue'); updateFromHue(e.clientX); }}
        className="relative w-full h-6 rounded-full cursor-pointer touch-none"
        style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
      >
        <div
          className="absolute top-1/2 rounded-full bg-white border-2 border-slate-900 shadow-[0_0_6px_rgba(0,0,0,0.8)]"
          style={{ left: `${(h / 360) * 100}%`, width: '18px', height: '18px', transform: 'translate(-50%,-50%)' }}
        ></div>
      </div>
    </div>
  );
};
// SE/BGM音量調整用スライダー(0〜100、ドラッグ操作+微調整用の±ボタン)
const VolumeSlider = ({ label, icon, value, onChange, onInteractStart, gradient, thumbRing }) => {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const valueFromClientX = (clientX) => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return value;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => onChange(valueFromClientX(e.clientX));
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);
  const startDrag = (e) => {
    onInteractStart && onInteractStart();
    setDragging(true);
    onChange(valueFromClientX(e.clientX));
  };
  const step = (delta) => { onInteractStart && onInteractStart(); onChange(Math.max(0, Math.min(100, value + delta))); };
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-9 shrink-0 flex flex-col items-center gap-0.5">
        <span className="text-xs leading-none">{icon}</span>
        <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider leading-none">{label}</span>
      </div>
      <button onClick={()=>step(-1)} className="shrink-0 w-6 h-6 rounded-lg bg-slate-800 border border-white/10 text-slate-300 font-black text-xs active:scale-90 active:bg-slate-700 flex items-center justify-center select-none">−</button>
      <div ref={trackRef} onPointerDown={startDrag} className="relative flex-1 h-2 rounded-full bg-slate-800 border border-white/10 cursor-pointer touch-none">
        <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradient}`} style={{width:`${value}%`}}></div>
        <div className={`absolute top-1/2 rounded-full bg-white border-2 ${thumbRing} shadow-[0_0_6px_rgba(255,255,255,0.7)] transition-transform ${dragging?'scale-125':''}`} style={{left:`${value}%`, width:'14px', height:'14px', transform:'translate(-50%,-50%)'}}></div>
      </div>
      <button onClick={()=>step(1)} className="shrink-0 w-6 h-6 rounded-lg bg-slate-800 border border-white/10 text-slate-300 font-black text-xs active:scale-90 active:bg-slate-700 flex items-center justify-center select-none">＋</button>
      <span className="w-6 shrink-0 text-right text-[9px] font-mono font-black text-slate-300">{value}</span>
    </div>
  );
};
const DIST_APTITUDE_MULT = { G: 0.8, F: 0.85, E: 0.9, D: 0.95, C: 1.0, B: 1.05, A: 1.1, S: 1.15, 'S+': 1.175, SS: 1.2, 'SS+': 1.225, M: 1.25 };
const DIST_APTITUDE_COLOR = { S: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'S+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", SS: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'SS+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", M: "text-fuchsia-300 bg-gradient-to-br from-purple-950/70 to-pink-950/70 border-fuchsia-400/60", A: "text-red-400 bg-red-950/60 border-red-400/50", B: "text-pink-300 bg-pink-950/60 border-pink-400/50", C: "text-green-300 bg-green-950/60 border-green-400/50", D: "text-teal-300 bg-teal-950/60 border-teal-400/50", E: "text-cyan-300 bg-cyan-950/60 border-cyan-400/50", F: "text-purple-300 bg-purple-950/60 border-purple-400/50", G: "text-slate-400 bg-slate-800/60 border-slate-500/50" };
// 強化ポイント1つあたりのステータス上昇量。ライフだけ他より大きく上がる(バランス調整中の暫定値)
// 公開前の機能は、ヘルプの項目も更新履歴のお知らせも書き上げたうえで隠しておく。
// data/*.js は game-system.jsx より先に読み込まれるので公開フラグを見られない。
// そこで data 側には releaseFlag という名札だけを書き、出す・出さないの判断はここでまとめて行う。
// 公開するときは SPECIES_CHALLENGE_PUBLIC_RELEASE を true にするだけで、
// ヘルプ・更新履歴・助手の告知が同時に出る(片方だけ先に出てしまうことがない)
// モンヒロビートは2026-09-05のプレオープンで公開した(ユーザー指示)。
// これを true にしたことで、HOMEの「準備中」がプレオープンの導線に変わり、
// ヘルプの項目・更新履歴・助手の告知も同時に出るようになっている
const RHYTHM_MODE_PUBLIC_RELEASE = true;
const RELEASE_FLAGS = { speciesChallenge: SPECIES_CHALLENGE_PUBLIC_RELEASE, rhythmMode:RHYTHM_MODE_PUBLIC_RELEASE };
const releasedForPlayers = (item) => !item || !item.releaseFlag || RELEASE_FLAGS[item.releaseFlag] === true;
const CHANGELOG_TYPES = ['update', 'issue'];
// 日付やBUILD_DATEではなく、内容から作った安定IDでお知らせを識別する。同じID・同じ本文は
// ビルドし直しても未読へ戻らず、本文を変更した場合だけ新しい項目として扱う。
const changelogEntryId = entry => {
  const source = entry.id || [entry.type, entry.title, ...(entry.items || [])].join('\u001f');
  let hash = 2166136261;
  for (let i=0;i<source.length;i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `${entry.type || 'notice'}-${(hash >>> 0).toString(36)}`;
};
// 開発中の作業メモ(dev:true)は、どちらのタブにも出さない。
// releaseFlag だけで隠していたころは、公開フラグを true にした瞬間に公開前の作業メモが
// まとめて更新情報へ並んでしまい、プレイヤーには「見たこともない画面の不具合が直った話」が
// 延々と続いて見えていた(2026-09-05・ユーザー指摘でモンヒロビートの80件を dev:true にした)。
// 記録自体は data/changelog.js に残し、出す・出さないだけをここで決める。
const changelogForPlayers = (entry) => !!entry && entry.dev !== true && releasedForPlayers(entry);
const CHANGELOG_ENTRIES = (typeof CHANGELOG !== 'undefined' ? CHANGELOG : []).filter(changelogForPlayers).map(entry => Object.freeze({...entry,id:changelogEntryId(entry)}));
// 更新履歴から作る助手の告知も、隠している項目のぶんは出さない
// (data/assistants.js は公開フラグも dev も見られないため、ここで落とす)
const HIDDEN_UPDATE_NOTICE_IDS = new Set((typeof CHANGELOG !== 'undefined' ? CHANGELOG : [])
  .filter(entry => !changelogForPlayers(entry) && typeof entry?.assistantNotice?.id === 'string')
  .map(entry => entry.assistantNotice.id.trim()));
// どのタブへ出すかを決める。
// 「不具合情報」は不具合の話をまとめる場所なので、調査中(issue)だけでなく
// 直したもの(fix)もここへ出す。「更新情報」は新機能・改善・マーケットだけになる
// (2026-09-05・ユーザー指摘「上にタブがあるから不具合修正とかは右にして」)。
// 以前は type がタブ名と完全一致するものだけを出していたため、fix / feature / market と
// 書いた項目がどちらのタブにも出ず、更新履歴に載せたつもりで載っていなかった。
// 種別を新しく足しても消えないよう、下の CHANGELOG_ISSUE_TAB_TYPES 以外は必ず更新情報へ拾う
const CHANGELOG_ISSUE_TAB_TYPES = Object.freeze(['issue', 'fix']);
const changelogEntriesOfTab = (tab) => CHANGELOG_ENTRIES.filter(entry => CHANGELOG_ISSUE_TAB_TYPES.includes(entry.type) === (tab === 'issue'));
// 既読の判定に使う「いま存在するすべてのID」。
// タブの振り分けを変えると、既読にしたIDが別のタブへ移る。タブごとのID一覧で
// ふるいにかけると移った先で未読へ戻ってしまうため、こちらで残す・捨てるを決める
const CHANGELOG_ALL_IDS = new Set(CHANGELOG_ENTRIES.map(entry => entry.id));
// 更新情報の「種類」の見せ方。データには前から type があったのに画面へ出しておらず、
// 不具合を直したのか新しく何かが増えたのかが読んでも分からなかった
// (2026-09-05・ユーザー指摘「直近の更新情報が不具合修正との区別がついてない」)。
// 文字とセットの色で、一覧を流し読みしても種類が分かるようにする。
const CHANGELOG_TYPE_LABELS = Object.freeze({
  fix:     { label:'不具合修正', tone:'fix' },
  feature: { label:'新機能',     tone:'feature' },
  update:  { label:'改善',       tone:'update' },
  market:  { label:'マーケット', tone:'market' },
  issue:   { label:'調査中',     tone:'issue' },
});
const changelogTypeOf = (entry) => CHANGELOG_TYPE_LABELS[entry?.type] || CHANGELOG_TYPE_LABELS.update;
const CHANGELOG_IDS_BY_TYPE = Object.fromEntries(CHANGELOG_TYPES.map(type => [type, changelogEntriesOfTab(type).map(entry => entry.id)]));
// 一覧の並べかえに使えるキー。画面の選択肢(MONSTER_SORT_OPTIONS)と必ず同じ顔ぶれにする。
// 片方にだけ足すと、画面では選べるのに保存だけ弾かれて、開き直すと元に戻る
// (実際に「総合力」がここへ足されておらず、選んでも次に開くと血統順へ戻っていた)。
// tools/monster/monster-list-filter-check.js が両者の一致を見張る。
const MONSTER_LIST_SORT_KEYS = ['base', 'masu', 'lineage', 'bond', 'power', 'name', 'active', 'fused', 'reborn'];
const DEFAULT_MONSTER_LIST_SETTINGS = { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', lineage: 'all', display: { base: true, masu: true, fused: true, active: true, reborn: true } };
const DEFAULT_FUSION_SORT_SETTINGS = { version: 1, sortKey: 'bond', sortDir: 'desc' };
const DEFAULT_DONATION_SORT_SETTINGS = { version: 1, sortKey: 'bondXp', sortDir: 'desc' };
const normalizeMonsterListSettings = (value) => {
  const displayKeys = ['base', 'masu', 'fused', 'active', 'reborn'];
  if (!value || value.version !== 1 || !MONSTER_LIST_SORT_KEYS.includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir) || !['sort', 'lineage', 'display'].includes(value.modalTab) || !value.display) return DEFAULT_MONSTER_LIST_SETTINGS;
  // 種族(主血統)のしぼりこみは後から足した項目。持っていない既存の保存値は「すべて」で補う。
  // 版を上げると保存ごと既定へ戻って並べかえ・表示設定まで失われるので、版は1のままにする
  const lineage = typeof value.lineage === 'string' && (value.lineage === 'all' || (typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES[value.lineage]))
    ? value.lineage : 'all';
  return { version: 1, modalTab: value.modalTab, sortKey: value.sortKey, sortDir: value.sortDir, lineage, display: Object.fromEntries(displayKeys.map(key => [key, typeof value.display[key] === 'boolean' ? value.display[key] : DEFAULT_MONSTER_LIST_SETTINGS.display[key]])) };
};
const normalizeFusionSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bond', 'lineage', 'name', 'fused'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_FUSION_SORT_SETTINGS;
  return { version: 1, sortKey: value.sortKey, sortDir: value.sortDir };
};
const normalizeDonationSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bondXp', 'bond', 'power', 'name', 'lineage', 'newest', 'active'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_DONATION_SORT_SETTINGS;
  return value;
};
// 不具合情報タブに出す状態バッジの見た目
const CHANGELOG_STATUS = {
  fixed:         { label: '修正済み', cls: 'bg-emerald-900/70 text-emerald-300 border-emerald-500/50' },
  investigating: { label: '調査中',   cls: 'bg-amber-900/70 text-amber-300 border-amber-500/50' },
  known:         { label: '判明済み', cls: 'bg-slate-800 text-slate-300 border-slate-500/50' },
};
// 音量の既定値。初期状態は「音がオン」で、いきなり大きな音が鳴らないよう最小の1から始める
// (ミュートを解除したときの音量もこの値に合わせている)
const DEFAULT_VOLUME = 1;
// ログインボーナスは毎日、既存の報酬に加えてスキップチケット・序を1枚配る。
// 4日目の「100」はもともとブリーダー経験値のつもりだったが、
// 報酬の種類をブリーダーポイント(pt)にしていたため、使い道のないptが大量に配られていた。
// ptはマーケットのアイコン(1個1pt・全部で20種ほど)にしか使わないので、まとめて配らない
const LOGIN_BONUS_REWARDS = [
  [{ type:'diamond', amount:500 },             { type:'skipTicketJo', amount:1 }],
  [{ type:'dyeMock', amount:1 },               { type:'skipTicketJo', amount:1 }],
  [{ type:'trainingTicket', amount:5 },        { type:'skipTicketJo', amount:1 }],
  [{ type:'breederXp', amount:200 },           { type:'skipTicketJo', amount:1 }],
  [{ type:'uniqueSkillResetTicket', amount:1 },{ type:'skipTicketJo', amount:1 }],
  [{ type:'diamond', amount:2000 }, { type:'rainbowPsyche', amount:10 }, { type:'skipTicketJo', amount:1 }],
  [{ type:'bondPointReset', amount:1 }, { type:'trainingTicketLarge', amount:1 }, { type:'skipTicketJo', amount:1 }],
];
const GIFT_REWARD_LABELS = { diamond:'ダイヤ', breederPoint:'ブリーダーポイント', breederXp:'ブリーダー経験値', dyeMock:'染色もどき', bondPointReset:'絆ポイントリセットの書', uniqueSkillResetTicket:'スキルポイントリセット券', rainbowPsyche:'虹のプシュケー', rainbowTranscendFruit:'虹の超越の実', trainingTicket:'トレーニングチケット', trainingTicketLarge:'重トレーニングチケット', skipTicketJo:'スキップチケット・序', skipTicketHa:'スキップチケット・破', skipTicketKyu:'スキップチケット・急' };
const LOGIN_BONUS_DEFAULT = { currentDay:1, lastGrantedPeriod:null, totalLoginDays:0 };
// 日本時間へ直した後に4時間戻した暦日を期間キーにする。03:59と04:00は別の日、
// 04:00から翌03:59までは同じ日として扱える、比較・保存しやすい YYYY-MM-DD 形式。
const loginBonusPeriodKey = (now=Date.now()) => new Date(Number(now) + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
// ---------- どの助手と一緒に遊ぶか ----------
// 助手は「みゅあ」「きき」から選ぶ。どちらも最初から解放されていて、解放条件は無い。
//
// 【既存プレイヤーの互換】★重要
// この保存キーが無い人は、これまでどおり「みゅあ」を選んでいる扱いにする。
// 助手選択の画面も出さない(いままで遊んできた人に選び直しを迫らない)。
const ASSISTANT_SELECTED_KEY = 'mh_assistant_selected_v1';
// ききが増える前から遊んでいた人へ、1回だけ見せる加入の会話。
// 「フラグが無い人＝既存プレイヤー」ではない(新しく始めた人も持っていない)ので、
// 既にオンボーディングを終えている(mh_onboarded)ことと合わせて判定する。
// 新しく始めた人は助手選択を通った時点で見たことにして、あとから誤って流れないようにする。
const KIKI_INTRO_SEEN_KEY = 'mh_kiki_intro_seen_v1';
// ももすけ登場の会話。ききのときと同じ考え方で、
//   ・すでに遊んでいた人 … アップデート後の初回HOMEで1回だけ流す。見終わるとももすけを選べるようになる
//   ・新しく始めた人     … 最初の助手選択でももすけを選べるので、この会話は流さない(その場で見たことにする)
// 本編を待たずにプロフィールの回想から見た場合も、最後まで見たらこのキーを立てる
// (＝解放され、あとから本編で重ねて流れない)。
const MOMOSUKE_INTRO_SEEN_KEY = 'mh_momosuke_intro_seen_v1';
const normalizeAssistantId = (value) => (typeof assistantIdOrDefault === 'function')
  ? assistantIdOrDefault(typeof value === 'string' ? value : null)
  : ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua');

// ---------- 助手との仲良し度(親密度) ----------
// 遊ぶほど助手と打ち解けていく。段階と呼び方・セリフは data/assistants.js が持ち、
// ここは「どれだけ貯まったか」を数えて端末に残すだけ。
//
// 既存の保存キーには一切触れず、新しいキーへ分けて持つ。読み込みは必ず normalize を
// 通すので、値が無い・壊れている場合もLv1から始まるだけで、ほかのデータには影響しない。
// 放置しても減らない(久しぶりに開いた人が冷たくされないようにするため)。
//
// 【助手ごとに完全に分ける】★重要
// みゅあとききの仲良し度は別のキーへ保存し、片方を進めてももう片方は変わらない。
// みゅあのぶんは今までのキーをそのまま使い続ける(既存プレイヤーの進捗を守るため)。
// 助手を増やしたときは mh_assistant_bond_<id>_v1 が自動で割り当たる。
const ASSISTANT_BOND_KEY = 'mh_assistant_bond_v1';
const assistantBondKeyFor = (assistantId) => {
  const id = normalizeAssistantId(assistantId);
  return id === ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua')
    ? ASSISTANT_BOND_KEY : `mh_assistant_bond_${id}_v1`;
};
// そのアシストカードが助手本人のカードなら、その助手のIDを返す(違えばnull)。★重要
// アシストカードのIDと助手のIDは同じ綴り('mua'/'kiki')なので、そのまま本人へ結び付く。
// カード名の文字列で見ると、進化で名前が変わったとき(みゅあの愛→深愛→慈愛)に外れるため、
// 必ずIDで判定する。助手を増やしてもカードIDを合わせておけば、ここは書き換え不要
const assistantIdOfAssistCard = (cardId) => {
  const id = String(cardId == null ? '' : cardId);
  const list = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];
  return list.some(a => a && a.id === id) ? id : null;
};
// 呼び方の上書きも助手ごとに分ける。みゅあのぶんは今までのキーのまま
const ASSISTANT_CALL_STYLE_KEY = 'mh_assistant_call_style';
const assistantCallStyleKeyFor = (assistantId) => {
  const id = normalizeAssistantId(assistantId);
  return id === ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua')
    ? ASSISTANT_CALL_STYLE_KEY : `mh_assistant_call_style_${id}`;
};
const ASSISTANT_BOND_EMPTY = { points: 0, day: null, daily: {}, dailyTotal: 0 };
const normalizeAssistantBond = (value) => {
  const raw = (value && typeof value === 'object') ? value : {};
  const daily = {};
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [k, v] of Object.entries(raw.daily)) {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n > 0) daily[k] = n;
    }
  }
  return {
    points: Math.max(0, Math.floor(Number(raw.points) || 0)),
    day: typeof raw.day === 'string' ? raw.day : null,
    daily,
    dailyTotal: Math.max(0, Math.floor(Number(raw.dailyTotal) || 0)),
  };
};
// 行動に応じて仲良し度を増やした結果を返す(渡された値は変えない)。
// 日付が変わっていれば、その日の集計だけをリセットする(貯まった量はそのまま)
const gainAssistantBond = (state, actionKey, now = Date.now()) => {
  const cur = normalizeAssistantBond(state);
  const actions = (typeof ASSISTANT_BOND_ACTIONS !== 'undefined' && ASSISTANT_BOND_ACTIONS) || {};
  const action = actions[actionKey];
  const day = loginBonusPeriodKey(now);
  const sameDay = cur.day === day;
  const daily = sameDay ? { ...cur.daily } : {};
  const dailyTotal = sameDay ? cur.dailyTotal : 0;
  if (!action) return { changed: false, state: { ...cur, day, daily, dailyTotal }, gained: 0 };
  const used = Math.max(0, Math.floor(Number(daily[actionKey]) || 0));
  const totalMax = (typeof ASSISTANT_BOND_DAILY_MAX !== 'undefined' && ASSISTANT_BOND_DAILY_MAX) || 30;
  // 「1回ぶん」「その行動の1日ぶん」「1日の合計」の3つのうち、いちばん小さいところで止める
  const gain = Math.min(
    Math.max(0, Math.floor(Number(action.amount) || 0)),
    Math.max(0, Math.floor(Number(action.dailyMax) || 0) - used),
    Math.max(0, totalMax - dailyTotal),
  );
  if (gain <= 0) return { changed: !sameDay, state: { ...cur, day, daily, dailyTotal }, gained: 0 };
  daily[actionKey] = used + gain;
  return { changed: true, state: { points: cur.points + gain, day, daily, dailyTotal: dailyTotal + gain }, gained: gain };
};
const assistantBondLevelOf = (points) => (typeof assistantBondLevel === 'function') ? assistantBondLevel(points) : 1;

const normalizeLoginBonus = (value) => ({
  currentDay: Number.isInteger(value?.currentDay) && value.currentDay >= 1 && value.currentDay <= 7 ? value.currentDay : 1,
  lastGrantedPeriod: typeof value?.lastGrantedPeriod === 'string' ? value.lastGrantedPeriod : null,
  totalLoginDays: Math.max(0, Math.floor(Number(value?.totalLoginDays) || 0)),
});
const grantLoginBonus = (loginBonus, gifts, now=Date.now()) => {
  const state = normalizeLoginBonus(loginBonus);
  const period = loginBonusPeriodKey(now);
  // 同一期間に加え、端末時計が前回より過去へ戻った場合も配布しない。
  if (state.lastGrantedPeriod && period <= state.lastGrantedPeriod) return { granted:false, loginBonus:state, gifts:Array.isArray(gifts)?gifts:[] };
  const day = state.currentDay;
  const createdAt = new Date(now).toISOString();
  const gift = { id:`gift_login_${period}`, source:'loginBonus', title:`ログインボーナス ${day}日目`, description:'ログインボーナスです。', rewards:LOGIN_BONUS_REWARDS[day-1].map(r=>({...r})), createdAt, expiresAt:new Date(Number(now)+30*24*60*60*1000).toISOString(), claimedAt:null };
  const list = Array.isArray(gifts) ? gifts : [];
  // 期間由来の固定IDでも重複を防ぐ。既に存在する場合は進捗だけを勝手に進めない。
  if (list.some(item=>item?.id===gift.id)) return { granted:false, loginBonus:{...state,lastGrantedPeriod:period}, gifts:list };
  return { granted:true, day, gift, gifts:[gift,...list], loginBonus:{ currentDay:day===7?1:day+1, lastGrantedPeriod:period, totalLoginDays:state.totalLoginDays+1 } };
};
// 不具合のお詫びとして、起動時に1度だけギフトボックスへ送る配布物。
// 受け取り方は通常のギフトと同じ(期限内に「受け取る」を押す)。
// idが既にギフト一覧にあれば配らないので、受取済み・未受取のどちらでも二重には届かない。
// 追加するときは新しいidで足す。過去の項目は消さない(消すと再配布されてしまうため)。
const COMPENSATION_GIFTS = [
  {
    id: 'gift_compensation_20260731_battle',
    title: 'お詫びのしるし',
    description: 'バトルが進行できなくなる不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'diamond', amount:1000 },
      { type:'skipTicketJo', amount:1 },
      { type:'skipTicketHa', amount:1 },
      { type:'skipTicketKyu', amount:1 },
    ],
  },
  {
    id: 'gift_compensation_20260801_points',
    title: 'お詫びのしるし',
    description: 'ログインボーナスの報酬が、ブリーダー経験値ではなくブリーダーポイントになっていた不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'skipTicketJo', amount:1 },
      { type:'skipTicketHa', amount:1 },
      { type:'skipTicketKyu', amount:1 },
    ],
  },
  {
    id: 'gift_compensation_20260823_skip',
    title: 'お詫びのしるし',
    description: 'クイックモードの報酬方針を「プシュケー優先」「ダイヤ優先」にしたままスキップすると、経験値も絆経験値も入らないままチケットだけ減っていた不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'skipTicketKyu', amount:5 },
    ],
  },
  {
    id: 'gift_compensation_20260807_dye',
    title: 'お詫びのしるし',
    description: 'アークの染色で、色が入らなかったり濃く出すぎたりしていた不具合のお詫びです。染めなおしにお使いください。ご迷惑をおかけしました。',
    rewards: [
      { type:'dyeMock', amount:5 },
    ],
  },
];
// 【一度きりの付け替え】ログインボーナス4日目の「100」は、もともとブリーダー経験値の
// つもりだったのに、報酬の種類をブリーダーポイント(pt)にしていたため使い道のないptが
// 大量に配られていた。すでに受け取ってしまったぶんを「経験値が入っていた」形へ寄せる。
//
//   ・受け取り済みのログインボーナスのギフトから、ptで配ってしまった量を数える
//   ・その量だけptを減らし(持っている以上には減らさない)、同じ量の経験値を足す
//   ・専用のフラグ(mh_login_pt_to_xp_v1)を持たせ、二度は行わない
const LOGIN_PT_TO_XP_KEY = 'mh_login_pt_to_xp_v1';
const MISTAKEN_LOGIN_PT = 100;   // ログインボーナス4日目で配ってしまっていた量
const mistakenLoginPoints = (gifts) => (Array.isArray(gifts) ? gifts : [])
  .filter(g => g?.source === 'loginBonus' && g.claimedAt && Array.isArray(g.rewards))
  .reduce((sum, g) => sum + g.rewards
    .filter(r => r?.type === 'breederPoint' && Math.floor(Number(r.amount)) === MISTAKEN_LOGIN_PT)
    .reduce((a, r) => a + Math.floor(Number(r.amount)), 0), 0);
// 付け替えた結果を返す(渡された値は変えない)。
// ptは持っている以上には減らさず、経験値は配られるはずだった量をそのまま足す
const applyLoginPointFix = (points, xp, gifts) => {
  const wrong = mistakenLoginPoints(gifts);
  const nowPoints = Math.max(0, Math.floor(Number(points) || 0));
  const nowXp = Math.max(0, Math.floor(Number(xp) || 0));
  if (wrong <= 0) return { changed:false, points:nowPoints, xp:nowXp, moved:0 };
  const moved = Math.min(wrong, nowPoints);
  return { changed:true, points:nowPoints - moved, xp:nowXp + wrong, moved, granted:wrong };
};

const grantCompensationGifts = (gifts, now=Date.now()) => {
  const list = Array.isArray(gifts) ? gifts : [];
  const missing = COMPENSATION_GIFTS.filter(def => !list.some(item => item?.id === def.id));
  if (missing.length === 0) return { granted:false, gifts:list };
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(Number(now) + 30*24*60*60*1000).toISOString();
  const added = missing.map(def => ({ ...def, source:'compensation', rewards:def.rewards.map(r=>({...r})), createdAt, expiresAt, claimedAt:null }));
  return { granted:true, gifts:[...added, ...list] };
};
// ---------- モンヒロビート プレオープン記念 新規プレイヤーキャンペーン ----------
// 今回のアップデート以降にはじめてMonster Heroを始めた人へ、1回だけ配る。
// すでに遊んでいた人には配らない(これが最重要。ここを間違えると全員へ配ってしまう)。
//
// 【新規かどうかの見分け方】
// 「キャンペーンの保存キーを持っていない」だけで決めてはいけない。新しく始めた人も
// 既存の人も、アップデート直後はどちらも持っていないため。既存の判定(mh_onboarded)で
// 「はじめての設定をこれから通る人」だけを対象にする。実際の発行は、その設定を
// 終えた瞬間(finishOnboarding)にだけ行う。
//
// 【二重に配らないための決まり】
// 配布済みフラグ(CAMPAIGN_KEY)だけに頼らず、ギフト側に同じidが無いかも必ず見る。
// ギフトを足したあとフラグを保存する前に閉じられても、次に開いたときidで気づける。
// idは固定。ランダムに作らないこと(作ると毎回「まだ無い」と判断してしまう)。
//
// 【受取期限】
// ユーザーからの指定が無いので付けない(expiresAtを書かない＝期限なし)。
const NEW_PLAYER_CAMPAIGN_ENABLED = true;   // 後からOFFにできるようにしておく
const NEW_PLAYER_CAMPAIGN_KEY = 'mh_monhiro_beat_preopen_new_player_campaign_v1';
const NEW_PLAYER_CAMPAIGN_GIFT = Object.freeze({
  id: 'monhiro_beat_preopen_new_player_v1',
  title: 'モンヒロビート プレオープン記念',
  description: '新規プレイヤーキャンペーンのプレゼントです。モンヒロビートのプレオープンを記念して、はじめた方へお贈りします。',
  rewards: [
    { type:'diamond', amount:100000 },
    { type:'rainbowPsyche', amount:100 },
  ],
});
// ギフト一覧へ1件足す。すでに同じidがあれば何もしない(何度呼んでも増えない)
const grantNewPlayerCampaignGift = (gifts, now=Date.now()) => {
  const list = Array.isArray(gifts) ? gifts : [];
  if (!NEW_PLAYER_CAMPAIGN_ENABLED) return { granted:false, gifts:list };
  if (list.some(item => item?.id === NEW_PLAYER_CAMPAIGN_GIFT.id)) return { granted:false, gifts:list };
  const gift = {
    ...NEW_PLAYER_CAMPAIGN_GIFT,
    source: 'campaign',
    rewards: NEW_PLAYER_CAMPAIGN_GIFT.rewards.map(r=>({...r})),
    createdAt: new Date(now).toISOString(),
    claimedAt: null,
  };
  return { granted:true, gifts:[gift, ...list] };
};

const normalizeGiftRewards = (gift) => {
  if (!gift || !Array.isArray(gift.rewards) || gift.rewards.length === 0) return null;
  const supported = Object.keys(GIFT_REWARD_LABELS);
  const rewards = gift.rewards.map(r=>({ type:r?.type, amount:Math.floor(Number(r?.amount)) }));
  return rewards.every(r=>supported.includes(r.type) && Number.isFinite(r.amount) && r.amount > 0) ? rewards : null;
};
// 受取期限。expiresAt を書いていないギフトは「期限なし(ずっと受け取れる)」として扱う。
// ログインボーナス・お詫び・ミッションの3つは必ず30日の期限を入れているので、
// ここを通る既存のギフトの扱いは何も変わらない。
// 値が入っていて読めない(壊れている)ときは、これまでどおり期限切れのままにする
const giftIsExpired = (gift, now=Date.now()) => {
  if (!gift) return true;
  if (gift.expiresAt == null) return false;
  const at = Date.parse(gift.expiresAt);
  return !Number.isFinite(at) || at <= Number(now);
};
// 「今すぐ受け取れるギフト」。未受取・期限内・報酬が有効、の3つを満たすもの。
// HOMEの通知バッジ・ギフト画面のバッジ・「すべて受け取る」が同じ判定を使う
const giftIsClaimable = (gift, now=Date.now()) => !!gift && !gift.claimedAt && !giftIsExpired(gift, now) && !!normalizeGiftRewards(gift);
const giftClaimableCount = (gifts, now=Date.now()) => (Array.isArray(gifts) ? gifts : []).filter(g => giftIsClaimable(g, now)).length;
const buildGiftClaim = (gift, balances, now=Date.now()) => {
  if (!gift || gift.claimedAt || giftIsExpired(gift, now)) return { ok:false, reason:gift?.claimedAt?'claimed':'expired' };
  const rewards = normalizeGiftRewards(gift);
  if (!rewards) return { ok:false, reason:'invalidReward' };
  const next = { gold:Math.max(0,Number(balances?.gold)||0), breederPoints:Math.max(0,Number(balances?.breederPoints)||0), breederXp:Math.max(0,Number(balances?.breederXp)||0), ownedItems:{...(balances?.ownedItems||{})} };
  // 虹の超越の実は既存の RAINBOW_TRANSCEND_FRUIT_ITEM_ID と同じ保存ID。
  const itemIds = { dyeMock:'dye_mock', bondPointReset:'bond_reset_scroll', uniqueSkillResetTicket:'unique_skill_reset_ticket', rainbowPsyche:'rainbow_psyche', rainbowTranscendFruit:'transcend_fruit_rainbow', trainingTicket:'training_ticket', trainingTicketLarge:'training_ticket_l', skipTicketJo:'skip_ticket_jo', skipTicketHa:'skip_ticket_ha', skipTicketKyu:'skip_ticket_kyu' };
  rewards.forEach(({type,amount})=>{ if(type==='diamond') next.gold+=amount; else if(type==='breederPoint') next.breederPoints+=amount; else if(type==='breederXp') next.breederXp+=amount; else { const id=itemIds[type]; next.ownedItems[id]=(next.ownedItems[id]||0)+amount; } });
  return { ok:true, balances:next, gift:{...gift,claimedAt:new Date(now).toISOString()} };
};
const giftRewardText = (reward) => `${GIFT_REWARD_LABELS[reward.type] || reward.type} ×${Number(reward.amount).toLocaleString()}`;
const giftTitleDisplay = (gift) => {
  const fallback = '名称なしギフト';
  const title = typeof gift?.title === 'string' && gift.title.trim() ? gift.title.trim() : fallback;
  if (gift?.source === 'compensation') return { label:'お詫び', title };
  if (gift?.source === 'campaign') return { label:'キャンペーン', title };
  if (gift?.source !== 'mission') return { label:null, title };
  const missionTitle = title.replace(/^ミッション報酬[「『]?/, '').replace(/[」』]$/, '').trim();
  return { label:'ミッション', title:missionTitle || title };
};
const missionDailyPeriod = loginBonusPeriodKey;
// --- 遊んだ時間 ---
// 新しい保存キーへ足すだけで、既存の保存(mh_*)には一切触らない。
// 画面が見えているあいだだけ数える(裏に回している時間・端末を置いている時間は遊んでいないため)。
// 数え始めた日(since)も一緒に持つ。既存プレイヤーは0から始まるので、
// 「いつからの記録か」が分からないと短すぎると誤解されてしまう。
const PLAYTIME_KEY = 'mh_playtime_v1';
const PLAYTIME_TICK_MS = 15000;        // 数える間隔
const PLAYTIME_SAVE_MS = 60000;        // 保存する間隔(数えるたびに保存すると書き込みが多すぎる)
const PLAYTIME_MAX_STEP_MS = 60000;    // 1回で足してよい上限。スリープ復帰などで飛んだぶんは数えない
const playtimeDayKey = (now=Date.now()) => new Date(Number(now)+9*60*60*1000).toISOString().slice(0,10);
const PLAYTIME_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const playtimeDayValue = (value) => typeof value === 'string' && PLAYTIME_DAY_PATTERN.test(value) ? value : null;
const playtimeSpan = (value) => {
  const ms = Number(value?.ms);
  return { day: playtimeDayValue(value?.day), ms: Number.isFinite(ms) && ms >= 0 ? ms : 0 };
};
// 保存値が無い・壊れている場合も必ず既定へ落とす(型を確かめてから使う)。
// days / today / longest は後から足した項目なので、それらを持たない古い保存を読んでも
// 既定で埋まり、それまでの合計(totalMs)と数え始めた日(since)はそのまま引き継がれる。
const normalizePlaytime = (value) => {
  const totalMs = Number(value?.totalMs);
  const days = Number(value?.days);
  return {
    totalMs: Number.isFinite(totalMs) && totalMs >= 0 ? totalMs : 0,
    since: playtimeDayValue(value?.since),
    days: Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0,
    today: playtimeSpan(value?.today),      // 今日のぶん
    longest: playtimeSpan(value?.longest),  // いちばん長く遊んだ日
  };
};
// 経過したぶんを足す。日をまたいだら「今日」を0へ戻して遊んだ日数を1増やす。
// 純粋な関数にしてあるので、日またぎの動きを検査でそのまま確かめられる。
const advancePlaytime = (current, deltaMs, now=Date.now()) => {
  const base = normalizePlaytime(current);
  const delta = Number(deltaMs);
  if (!(Number.isFinite(delta) && delta > 0)) return base;
  const day = playtimeDayKey(now);
  const sameDay = base.today.day === day;
  const todayMs = (sameDay ? base.today.ms : 0) + delta;
  return {
    totalMs: base.totalMs + delta,
    since: base.since || day,
    // 同じ日のあいだは増やさない。初日(dayが無い状態)は1日目として数える
    days: sameDay ? Math.max(1, base.days) : base.days + 1,
    today: { day, ms: todayMs },
    longest: todayMs > base.longest.ms ? { day, ms: todayMs } : base.longest,
  };
};
// 表示用。前に遊んだのが昨日以前なら、今日はまだ0分として出す
// (プロフィールを開いた時点ではまだ加算が走っていないことがあるため)
const playtimeTodayMs = (value, now=Date.now()) => {
  const base = normalizePlaytime(value);
  return base.today.day === playtimeDayKey(now) ? base.today.ms : 0;
};
const formatPlaytime = (ms) => {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}時間${String(minutes).padStart(2, '0')}分`;
  if (minutes > 0) return `${minutes}分`;
  return '1分未満';
};
const missionWeeklyPeriod = (now=Date.now()) => { const d=new Date(Number(now)+5*60*60*1000); const day=d.getUTCDay(); d.setUTCDate(d.getUTCDate()-((day+6)%7)); return d.toISOString().slice(0,10); };
const missionMonthlyPeriod = (now=Date.now()) => new Date(Number(now)+5*60*60*1000).toISOString().slice(0,7);
const MISSION_WEEK_ROTATION_EPOCH = '2026-08-24';
const missionPeriodWeekday = (now=Date.now()) => new Date(`${missionDailyPeriod(now)}T00:00:00Z`).getUTCDay();
const missionWeekRotationIndex = (now=Date.now()) => {
  const periodMs=Date.parse(`${missionWeeklyPeriod(now)}T00:00:00Z`), epochMs=Date.parse(`${MISSION_WEEK_ROTATION_EPOCH}T00:00:00Z`);
  const index=Math.floor((periodMs-epochMs)/(7*24*60*60*1000));
  return ((index%4)+4)%4;
};
const DAILY_ROTATION_MISSIONS = Object.freeze({
  1:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'diamond',amount:200}]},
  2:{id:'daily_rotation',name:'本日のミッション',condition:'アイテムを1個使用する',key:'itemUses',target:1,rewards:[{type:'trainingTicket',amount:3}]},
  3:{id:'daily_rotation',name:'本日のミッション',condition:'プロモードを1回クリアする',key:'proClears',target:1,rewards:[{type:'trainingTicketLarge',amount:1}]},
  4:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'rainbowPsyche',amount:5}]},
  5:{id:'daily_rotation',name:'本日のミッション',condition:'アイテムを1個使用する',key:'itemUses',target:1,rewards:[{type:'dyeMock',amount:1}]},
  6:{id:'daily_rotation',name:'本日のミッション',condition:'プロモードを1回クリアする',key:'proClears',target:1,rewards:[{type:'diamond',amount:300}]},
  0:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'trainingTicketLarge',amount:1}]},
});
const WEEKLY_ROTATION_MISSIONS = Object.freeze([
  {id:'weekly_rotation',name:'今週のミッション',condition:'プロモードを3回クリアする',key:'proClears',target:3,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'極限チャレンジを1回クリアする（未解放ならクイックモードを10回クリア）',key:'extremeOrQuick',target:1,rewards:[{type:'rainbowPsyche',amount:30}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'クイックモードを10回クリアする',key:'quickClears',target:10,rewards:[{type:'trainingTicketLarge',amount:2}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'アイテムを10個使用する',key:'itemUses',target:10,rewards:[{type:'bondPointReset',amount:1}]},
]);
const missionDailyDefinitions = (now=Date.now()) => [
  {id:'daily_login',name:'今日もMonster Hero！',condition:'その期間中にログインする',key:'login',target:1,rewards:[{type:'diamond',amount:100}]},
  {id:'daily_battles',name:'バトルに挑戦',condition:'バトルを3回行う',key:'battles',target:3,rewards:[{type:'trainingTicket',amount:3}]},
  // 旧 daily_wins のIDは受取履歴互換のため維持。条件は通常チャレンジのクリアへ置き換える。
  {id:'daily_wins',name:'デイリーチャレンジ',condition:'チャレンジモードを1回クリアする',key:'challengeClears',target:1,rewards:[{type:'rainbowPsyche',amount:5}]},
  {id:'daily_enhance',name:'モンスター育成',condition:'モンスターを1回強化する',key:'enhances',target:1,rewards:[{type:'diamond',amount:200}]},
  {...DAILY_ROTATION_MISSIONS[missionPeriodWeekday(now)]},
  {id:'daily_complete',name:'デイリーコンプリート',condition:'通常デイリー5個のうち4個を達成する',key:'complete',target:4,rewards:[{type:'diamond',amount:500},{type:'skipTicketHa',amount:1}],complete:true},
];
const missionWeeklyDefinitions = (now=Date.now()) => [
  {id:'weekly_logins',name:'継続は力なり',condition:'異なる5日分のログインを行う',key:'loginDays',target:5,rewards:[{type:'diamond',amount:500}]},
  {id:'weekly_battles',name:'バトル週間',condition:'バトルを20回行う',key:'battles',target:20,rewards:[{type:'diamond',amount:500}]},
  {id:'weekly_enhance',name:'育成週間',condition:'モンスターを10回強化する',key:'enhances',target:10,rewards:[{type:'trainingTicketLarge',amount:2}]},
  // 旧 weekly_wins のIDをクイック枠へ再利用し、同期間の二重受取を防ぐ。
  {id:'weekly_wins',name:'クイック育成',condition:'クイックモードを5回クリアする',key:'quickClears',target:5,rewards:[{type:'rainbowPsyche',amount:20}]},
  // 旧IDは受取履歴互換のため維持。旧「プレイ」から通常チャレンジのクリアへ変更する。
  {id:'weekly_donations',name:'チャレンジャー',condition:'チャレンジモードを3回クリアする',key:'challengeClears',target:3,rewards:[{type:'breederXp',amount:300}]},
  {id:'weekly_market',name:'マーケット常連',condition:'マーケットで3回購入する',key:'marketTrades',target:3,rewards:[{type:'dyeMock',amount:2}]},
  // 旧 weekly_daily_claims のIDをアイテム使用枠へ再利用する。
  {id:'weekly_daily_claims',name:'アイテム活用',condition:'アイテムを5個使用する',key:'itemUses',target:5,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
  {...WEEKLY_ROTATION_MISSIONS[missionWeekRotationIndex(now)]},
  {id:'weekly_complete',name:'ウィークリーコンプリート',condition:'通常ウィークリー8個のうち6個を達成する',key:'complete',target:6,rewards:[{type:'diamond',amount:2000},{type:'skipTicketKyu',amount:1},{type:'rainbowPsyche',amount:30}],complete:true},
];
const missionMonthlyDefinitions = () => [
  {id:'monthly_logins',name:'月間ログイン',condition:'異なる20日分のログインを行う',key:'loginDays',target:20,rewards:[{type:'diamond',amount:3000}]},
  {id:'monthly_battles',name:'月間バトル',condition:'バトルを100回行う',key:'battles',target:100,rewards:[{type:'rainbowPsyche',amount:50}]},
  {id:'monthly_wins',name:'月間勝利',condition:'バトルで200回勝利する',key:'wins',target:200,rewards:[{type:'trainingTicketLarge',amount:5}]},
  {id:'monthly_daily_completes',name:'デイリーマスター',condition:'デイリーコンプリートを20回達成する',key:'dailyCompletes',target:20,rewards:[{type:'diamond',amount:5000}]},
  {id:'monthly_weekly_completes',name:'ウィークリーマスター',condition:'ウィークリーコンプリートを3回達成する',key:'weeklyCompletes',target:3,rewards:[{type:'rainbowPsyche',amount:100}]},
  {id:'monthly_quick_runs',name:'クイック月間',condition:'クイックモードを20回プレイする',key:'quickRuns',target:20,rewards:[{type:'skipTicketKyu',amount:2}]},
  {id:'monthly_challenge_runs',name:'チャレンジ月間',condition:'チャレンジモードを10回プレイする',key:'challengeRuns',target:10,rewards:[{type:'rainbowPsyche',amount:50}]},
  {id:'monthly_enhances',name:'育成月間',condition:'モンスターを30回強化する',key:'enhances',target:30,rewards:[{type:'uniqueSkillResetTicket',amount:2}]},
  {id:'monthly_market',name:'マーケット月間',condition:'マーケットで10回取引する',key:'marketTrades',target:10,rewards:[{type:'dyeMock',amount:5}]},
  {id:'monthly_mode_runs',name:'モードプレイヤー',condition:'各種モードを合計30回プレイする',key:'modeRuns',target:30,rewards:[{type:'bondPointReset',amount:2}]},
  {id:'monthly_complete',name:'マンスリーコンプリート',condition:'通常マンスリー10個のうち8個を達成する',key:'complete',target:8,rewards:[{type:'diamond',amount:10000},{type:'rainbowPsyche',amount:200},{type:'rainbowTranscendFruit',amount:1}],complete:true},
];
// 日次・週次はJST期間に応じてローテーションするため、参照時に現在の定義を返す。
const MISSION_DEFS = {
  get daily(){ return missionDailyDefinitions(); },
  get weekly(){ return missionWeeklyDefinitions(); },
  get monthly(){ return missionMonthlyDefinitions(); },
};
const emptyMissionCounts = () => ({login:0,battles:0,wins:0,enhances:0,dailyClaims:0,dailyCompletes:0,weeklyCompletes:0,marketTrades:0,donations:0,challengeRuns:0,quickRuns:0,modeRuns:0,challengeClears:0,quickClears:0,proClears:0,extremeClears:0,itemUses:0});
const normalizeMissions = (value,now=Date.now()) => {
  const dailyPeriod=missionDailyPeriod(now), weeklyPeriod=missionWeeklyPeriod(now), monthlyPeriod=missionMonthlyPeriod(now), old=value&&typeof value==='object'?value:{};
  const dailySame=old.dailyPeriod===dailyPeriod, weeklySame=old.weeklyPeriod===weeklyPeriod, monthlySame=old.monthlyPeriod===monthlyPeriod;
  const state={version:2,dailyPeriod,weeklyPeriod,monthlyPeriod,daily:dailySame?{...emptyMissionCounts(),...(old.daily||{})}:emptyMissionCounts(),weekly:weeklySame?{...emptyMissionCounts(),...(old.weekly||{})}:emptyMissionCounts(),monthly:monthlySame?{...emptyMissionCounts(),...(old.monthly||{})}:emptyMissionCounts(),sentDaily:dailySame&&Array.isArray(old.sentDaily)?old.sentDaily:[],sentWeekly:weeklySame&&Array.isArray(old.sentWeekly)?old.sentWeekly:[],sentMonthly:monthlySame&&Array.isArray(old.sentMonthly)?old.sentMonthly:[],weeklyLoginDays:weeklySame&&Array.isArray(old.weeklyLoginDays)?old.weeklyLoginDays:[],monthlyLoginDays:monthlySame&&Array.isArray(old.monthlyLoginDays)?old.monthlyLoginDays:[],monthlyDailyCompletePeriods:monthlySame&&Array.isArray(old.monthlyDailyCompletePeriods)?old.monthlyDailyCompletePeriods:[],monthlyWeeklyCompletePeriods:monthlySame&&Array.isArray(old.monthlyWeeklyCompletePeriods)?old.monthlyWeeklyCompletePeriods:[]};
  // 月途中の初導入や月替わりでは、導入前・前月中に既に終わっていた現在期間の
  // コンプリートを遡及加算しない。期間IDだけ記録し、次の新しい期間から数える。
  if(!monthlySame){
    const completed=(type)=>{
      const defs=MISSION_DEFS[type], normal=defs.filter(m=>!m.complete), target=defs.find(m=>m.complete)?.target||Infinity;
      const sent=type==='daily'?state.sentDaily:state.sentWeekly;
      return normal.filter(m=>{
        if(sent.includes(m.id))return true;
        if(m.key==='loginDays')return state.weeklyLoginDays.length>=m.target;
        if(type==='weekly'&&m.key==='extremeOrQuick')return state.weekly.extremeClears>=1||state.weekly.quickClears>=10;
        return (Number(state[type]?.[m.key])||0)>=m.target;
      }).length>=target;
    };
    if(dailySame&&completed('daily'))state.monthlyDailyCompletePeriods=[dailyPeriod];
    if(weeklySame&&completed('weekly'))state.monthlyWeeklyCompletePeriods=[weeklyPeriod];
  }
  return state;
};
const missionValue = (state,type,mission) => {
  if(mission.complete){ const normal=MISSION_DEFS[type].filter(m=>!m.complete); return normal.filter(m=>missionValue(state,type,m)>=m.target).length; }
  if(mission.key==='loginDays') return type==='monthly'?state.monthlyLoginDays.length:state.weeklyLoginDays.length;
  // 旧仕様で同じIDの報酬を受取済みなら、新条件へ変わった同じ期間でも達成済みとして扱う。
  const sent=type==='daily'?state.sentDaily:type==='weekly'?state.sentWeekly:state.sentMonthly;
  if(Array.isArray(sent)&&sent.includes(mission.id)) return mission.target;
  if(type==='weekly'&&mission.key==='extremeOrQuick') return ((Number(state.weekly?.extremeClears)||0)>=1||(Number(state.weekly?.quickClears)||0)>=10)?1:0;
  return Number(state[type]?.[mission.key])||0;
};
// 「達成済みかつ未受取(ギフト未送付)」のミッション。HOMEの通知バッジ・タブのバッジ・一括受取が
// すべてこの判定を共有するので、どこか1か所だけ数え方がずれることがない
const missionClaimableList = (state,type) => { const sent=type==='daily'?state.sentDaily:type==='weekly'?state.sentWeekly:state.sentMonthly; return MISSION_DEFS[type].filter(m=>missionValue(state,type,m)>=m.target && !sent.includes(m.id)); };
const missionClaimableCount = state => ['daily','weekly','monthly'].reduce((sum,type)=>sum+missionClaimableList(state,type).length,0);
const missionNextReset = (type,now=Date.now()) => { const shifted=new Date(Number(now)+5*60*60*1000); shifted.setUTCHours(0,0,0,0); if(type==='monthly')shifted.setUTCMonth(shifted.getUTCMonth()+1,1);else shifted.setUTCDate(shifted.getUTCDate()+(type==='daily'?1:7-((shifted.getUTCDay()+6)%7))); return shifted.getTime()-5*60*60*1000; };
const reconcileMonthlyMissionCompletions = (value,now=Date.now()) => {
  const state=normalizeMissions(value,now), dailyComplete=MISSION_DEFS.daily.find(m=>m.complete), weeklyComplete=MISSION_DEFS.weekly.find(m=>m.complete);
  if(dailyComplete&&missionValue(state,'daily',dailyComplete)>=dailyComplete.target&&!state.monthlyDailyCompletePeriods.includes(state.dailyPeriod)){
    state.monthlyDailyCompletePeriods=[...state.monthlyDailyCompletePeriods,state.dailyPeriod];
    state.monthly.dailyCompletes=(Number(state.monthly.dailyCompletes)||0)+1;
  }
  if(weeklyComplete&&missionValue(state,'weekly',weeklyComplete)>=weeklyComplete.target&&!state.monthlyWeeklyCompletePeriods.includes(state.weeklyPeriod)){
    state.monthlyWeeklyCompletePeriods=[...state.monthlyWeeklyCompletePeriods,state.weeklyPeriod];
    state.monthly.weeklyCompletes=(Number(state.monthly.weeklyCompletes)||0)+1;
  }
  return state;
};
const STAT_POINT_GAIN = { hp: 10, atk: 3, def: 3, guts: 3 };
// 強化ポイントで伸ばせる能力の表示名。強化の下書き適用(applyEnhancePlanToMasu)からも見るのでモジュール直下に置く
const STAT_POINT_KEYS = { hp: 'ライフ', atk: 'ちから', def: '丈夫さ', guts: 'ガッツ' };
// 間合い適性は「距離ごとの与ダメージ補正(%)」として扱う。
// Cが±0、Mなら+25%、Gなら-20%。編成した勇者モン・供モンの補正は、そのモンスターを
// どの距離に置いたかに関係なく、4距離すべての補正値へ加算されていく。
// 例) 零距離の補正が+6%のところへ、零距離M(+25%)のモンスターが合流すると+31%になる。
const aptGradeToPct = (grade) => (DIST_APTITUDE_MULT[grade] ?? 1.0) - 1.0;
// モンスター(素の種・マスモン反映後のどちらでも可)の4距離分の補正値(小数)を返す
const getMonsterAptPct = (mon, nightmare=false, waveNumber=1) => {
  const apt = (mon && mon.distAptitude) || ['C','C','C','C'];
  return [0,1,2,3].map(i => applyNightmareSignedModifier(aptGradeToPct(apt[i] || 'C'), nightmare,waveNumber));
};
// 補正値の表示用文字列(小数第1位まで。整数のときは小数を出さない)
const formatAptPct = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.round(Math.abs(v) * 1000) / 10}%`;
// 合流ボーナス欄に出す間合い適性の加算表示(例: 「零+25% 中-5%」)。加算が無ければ空文字
const formatAptBonus = (mon) => getMonsterAptPct(mon)
  .map((d, i) => d !== 0 ? `${RANGE_LABELS[i]}${formatAptPct(d)}` : null)
  .filter(Boolean).join(' ');
// マスモンが「これまでに得たはずの強化ポイント総数」は絆レベル-1で決まる。
// 使用済み(間合い適性・ステータス強化に振った分)と未使用の合計がこれを下回っていたら、
// 不足分を未使用ポイントとして補填したマスモンを返す。
const ENHANCE_POINT_BAND_REPAIR_VERSION = 1;
const normalEnhanceSpentPoints = (masu, base) => {
  const aptSpent = Array.isArray(masu?.distAptBoosts)
    ? masu.distAptBoosts.reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0)
    : (Array.isArray(masu?.distApt) && base?.distAptitude
      ? masu.distApt.reduce((sum, grade, index) => {
          const from = DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]);
          const to = DIST_APTITUDE_GRADES.indexOf(grade);
          return sum + (from >= 0 && to >= 0 ? Math.max(0, to - from) : 0);
        }, 0)
      : 0);
  const statSpent = Object.keys(STAT_POINT_GAIN).reduce((sum, key) => {
    const gain = Math.max(1, Number(STAT_POINT_GAIN[key]) || 1);
    const value = Math.max(0, Number(masu?.statPoints?.[key]) || 0);
    return sum + Math.ceil(value / gain);
  }, 0);
  return { aptSpent, statSpent, total:aptSpent + statSpent };
};
const earnedEnhancePointTotal = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  return levelBasedEnhancePoints(masuBondLevelInfo(normalized).level)
    + totalBreakthroughPoints(normalized.rebirthCount)
    + ownReincarnateBonusPoints(normalized)
    + inheritedReincarnateBonusPointsOf(normalized);
};
const repairEnhancePointBandOvergrant = (masu) => {
  if (!masu || Math.floor(Number(masu.enhancePointBandRepairVersion) || 0) >= ENHANCE_POINT_BAND_REPAIR_VERSION) return masu;
  // 旧形式ゴーレムは、過去のベース適性変更(A/C/E/G → A/E/G/G)により distApt だけでは
  // 実際に使った適性Pを一意に戻せない。reconcileMasuPoints と同じく、distAptBoosts を持つ
  // 新形式へ安全に移行済みになるまでは推測でポイントを減らしたり通常強化を白紙化しない。
  if (masu.baseId === 'Golem' && !Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts')) return masu;
  const normalized = normalizeMasuProgression(masu);
  if (normalized.rebirthCount < 34) return masu;
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[normalized.baseId] : null;
  if (!base) return masu;
  const level = masuBondLevelInfo(normalized).level;
  const correctLevelPoints = levelBasedEnhancePoints(level);
  const badLevelPoints = legacyRetroactiveLevelBasedEnhancePoints(level, normalized.rebirthCount);
  const knownOvergrant = Math.max(0, badLevelPoints - correctLevelPoints);
  if (knownOvergrant <= 0) return masu;
  const bonusPoints = totalBreakthroughPoints(normalized.rebirthCount)
    + ownReincarnateBonusPoints(normalized)
    + inheritedReincarnateBonusPointsOf(normalized);
  const badTotal = badLevelPoints + bonusPoints;
  const spent = normalEnhanceSpentPoints(normalized, base);
  const unused = Math.max(0, Math.floor(Number(normalized.distAptPoints) || 0));
  const currentTotal = spent.total + unused;
  // 不具合版を通った個体なら、少なくとも誤式の総数まで補填されている。
  // そこに届いていない個体は「不具合による増加」と断定できないので減らさない。
  if (currentTotal < badTotal) return masu;
  const targetTotal = Math.max(0, currentTotal - knownOvergrant); // 不具合以前からの余剰があればそのまま保持
  if (unused >= knownOvergrant) {
    return {
      ...masu,
      distAptPoints: unused - knownOvergrant,
      enhancePointBandRepairVersion: ENHANCE_POINT_BAND_REPAIR_VERSION,
    };
  }
  // 過剰分が能力・適性へ既に振られている場合、「どの振り分けが過剰分だったか」は保存履歴から判別不能。
  // 任意の能力だけ削るより、通常強化だけを白紙にして正しい総数を未使用Pへ戻す。
  // 超越強化・個体基礎値・固有技・限界突破・転生・合体履歴などは一切触らない。
  return {
    ...masu,
    distAptPoints: targetTotal,
    statPoints: { hp:0, atk:0, def:0, guts:0 },
    distAptBoosts: [0,0,0,0],
    distApt: [...base.distAptitude],
    enhancePointBandRepairVersion: ENHANCE_POINT_BAND_REPAIR_VERSION,
  };
};
//
// 必要経験値の緩和(BOND_XP_DISCOUNTの引き下げ)を行うと、同じ絆経験値のまま絆レベルだけが
// 上がるため、レベルアップ時に配っている強化ポイントが後追いで配られず
// 「絆レベル8なのにポイントが4しかない」という食い違いが起きていた。
// 読み込み時にここを通すことで、過去の緩和分も今後の調整分も自動的に辻褄が合う。
const reconcileMasuPoints = (masu) => {
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  if (!base) return masu;
  // 旧ゴーレムはベース適性が A/C/E/G から A/E/G/G へ変わっており、完成値の distApt だけでは
  // 実際に何段階強化したかを一意に戻せない。現在ベースとの差を使用済みポイントとして推測すると
  // 不足補填を誤るため、新形式になるまでは既存の能力・適性・ポイントを丸ごと保留する。
  if (masu.baseId === 'Golem' && !Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts')) return masu;
  const baseApt = base.distAptitude || ['C','C','C','C'];
  const aptSpent = Array.isArray(masu.distAptBoosts)
    ? masu.distAptBoosts.reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0)
    : (masu.distApt || baseApt).reduce((sum, g, i) => sum + Math.max(0, DIST_APTITUDE_GRADES.indexOf(g) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])), 0);
  const statSpent = Object.entries(masu.statPoints || {}).reduce((sum, [key, val]) => sum + Math.ceil((val || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
  // 合体で上がったレベルも「絆レベルが上がった」ことに変わりはないので、強化ポイントの
  // 付与対象に含める(合体の確認画面も「強化ポイント +N」と出しており、実際に増えていなかった)。
  // 過去に合体でレベルを上げた分も、ここの不足補填でまとめて受け取れる。
  // 限界突破・転生でもらえるぶんも「得たはずの総数」に含める。ここに入れておかないと、
  // 限界突破の直後にレベルが1つ上がったとき「レベルぶんの不足」として相殺されてしまい、
  // せっかく足したポイントが消えたように見える。
  // ここを新しい方式で数え直すことが、そのまま既存のマスモンの調整にもなる
  // (読み込みのたびに不足分だけを補うので、二重に配られることはない)。
  // 通常強化ポイントの「レベル由来ぶん」は levelBasedEnhancePoints が正本。
  // Lv1→270は1P、270→330は2P、330→400は3Pで、現在の凸数を過去レベルへ遡及しない。
  // Lv401以降で得られるのは通常Pではなく超越P。
  const earned = levelBasedEnhancePoints(masuBondLevelInfo(masu).level)
    + totalBreakthroughPoints(masu.rebirthCount)
    + ownReincarnateBonusPoints(masu)
    + inheritedReincarnateBonusPointsOf(masu);
  const missing = earned - (aptSpent + statSpent + (masu.distAptPoints || 0));
  return missing > 0 ? { ...masu, distAptPoints: (masu.distAptPoints || 0) + missing } : masu;
};
const RANGE_STYLES = {
  0: { bg: "bg-red-950/90", border: "border-red-500", text: "text-red-400", shadow: "shadow-red-500/50", glow: "drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]", slotBg: "bg-red-900/50", labelBg: "bg-red-600 text-white" },
  1: { bg: "bg-yellow-950/90", border: "border-yellow-500", text: "text-yellow-400", shadow: "shadow-yellow-500/50", glow: "drop-shadow-[0_0_15px_rgba(234,179,8,0.9)]", slotBg: "bg-yellow-900/50", labelBg: "bg-yellow-600 text-black" },
  2: { bg: "bg-emerald-950/90", border: "border-emerald-500", text: "text-emerald-400", shadow: "shadow-emerald-500/50", glow: "drop-shadow-[0_0_15px_rgba(16,185,129,0.9)]", slotBg: "bg-emerald-900/50", labelBg: "bg-emerald-600 text-white" },
  3: { bg: "bg-blue-950/90", border: "border-blue-500", text: "text-blue-400", shadow: "shadow-blue-500/50", glow: "drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]", slotBg: "bg-blue-900/50", labelBg: "bg-blue-600 text-white" }
};

const AUTO_SETTINGS_KEY = 'mh_auto_settings_v1';
const AUTO_STRATEGIES = ['random','offense','defense','guts'];
const DEFAULT_AUTO_SETTINGS = Object.freeze({
  strategy:'random',
  allies:[
    { rosterEntry:null, slot:null },
    { rosterEntry:null, slot:null },
    { rosterEntry:null, slot:null },
  ],
});
// roster entry が正本。候補外・重複・壊れた距離は、安全な未指定/自動へ落とす。
const normalizeAutoSettings = (value, validRosterEntries = null) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const valid = validRosterEntries == null ? null : new Set(Array.isArray(validRosterEntries) ? validRosterEntries : []);
  const seen = new Set();
  const allies = Array.from({length:3}, (_, index) => {
    const raw = Array.isArray(source.allies) && source.allies[index] && typeof source.allies[index] === 'object' ? source.allies[index] : {};
    const entry = typeof raw.rosterEntry === 'string' && raw.rosterEntry.length > 0 ? raw.rosterEntry : null;
    const rosterEntry = entry && (!valid || valid.has(entry)) && !seen.has(entry) ? entry : null;
    if (rosterEntry) seen.add(rosterEntry);
    const slot = raw.slot === null || raw.slot === undefined ? null : Number(raw.slot);
    return { rosterEntry, slot:Number.isInteger(slot) && slot >= 0 && slot <= 3 ? slot : null };
  });
  return { strategy:AUTO_STRATEGIES.includes(source.strategy) ? source.strategy : 'random', allies };
};

// AUTOの1ターンぶんの選択だけを組み立てる。実際の選択stateや戦闘進行には触れず、
// 手動操作と同じ判定関数を呼び出し側から受け取ることで、カードルールを二重管理しない。
const chooseAutoTurn = ({
  hand = [], slots = [], guts = 0, cardLimit = 0, strategy = 'random',
  getCardGuts, cardNeedsMonster, slotMaxUses,
}, rng = Math.random) => {
  if (!Array.isArray(hand) || !Array.isArray(slots) || typeof getCardGuts !== 'function'
      || typeof cardNeedsMonster !== 'function' || typeof slotMaxUses !== 'function') return [];
  const limit = Math.max(0, Math.floor(Number(cardLimit) || 0));
  const availableGuts = Math.max(0, Number(guts) || 0);
  const picked = [];
  const usedHandIndexes = new Set();
  const slotUseCounts = Array(slots.length).fill(0);
  let usedGuts = 0;

  const legalActions = () => {
    const actions = [];
    hand.forEach((card, handIndex) => {
      if (!card || usedHandIndexes.has(handIndex)) return;
      const cost = Math.max(0, Number(getCardGuts(card)) || 0);
      if (usedGuts + cost > availableGuts) return;
      if (!cardNeedsMonster(card)) {
        actions.push({ handIndex, card, slotIdx:null, cost });
        return;
      }
      slots.forEach((monster, slotIdx) => {
        if (!monster) return;
        if (card.type === 'unique' && card.ownerSlotIdx !== slotIdx) return;
        const maxUses = Math.max(0, Math.floor(Number(slotMaxUses(monster)) || 0));
        if (slotUseCounts[slotIdx] >= maxUses) return;
        actions.push({ handIndex, card, slotIdx, cost });
      });
    });
    return actions;
  };
  const attackCard = card => !!card && cardNeedsMonster(card);
  const priorityOf = card => {
    if (strategy === 'offense') {
      if (card.type === 'unique') return 0;
      if (attackCard(card)) return 1;
      if (card.type === 'guard' || card.type === 'heal') return 3;
      return 2;
    }
    if (strategy === 'defense') {
      if (card.type === 'heal') return 0;
      if (card.type === 'guard') return 1;
      return attackCard(card) ? 3 : 2;
    }
    return 0;
  };
  const randomIndex = length => Math.min(length - 1, Math.max(0, Math.floor((Number(rng()) || 0) * length)));

  while (picked.length < limit) {
    let actions = legalActions();
    // ★重要: どの方針でも「敵のライフが1も減らないターン」を作らない。
    // 耐久重視はガードが常に手札にあり、ガードの優先度が攻撃より高かったため、
    // 毎ターン守りだけを選び続けて敵のライフが1も減らず、20ターン切れでそのまま負けていた
    // (イブリースのAUTOで実際に発生。固有技が高ガッツで撃てず、残りが通常技とガードだった)。
    // そのターンの最後の1枠まで来ても攻撃を1枚も選んでいないときは、
    // 攻撃できるならその中から選ぶ。攻撃が1つも使えないときは、これまでどおり守りを選ぶ。
    const needsAttack = picked.length === limit - 1 && !picked.some(entry => attackCard(entry.card));
    if (needsAttack) {
      const attacks = actions.filter(action => attackCard(action.card));
      if (attacks.length > 0) actions = attacks;
    }
    if (strategy === 'guts') {
      const attacks = actions.filter(action => attackCard(action.card));
      actions = attacks.length ? attacks : actions;
      if (!actions.length) break;
      const lowestCost = Math.min(...actions.map(action => action.cost));
      actions = actions.filter(action => action.cost === lowestCost);
    } else if (strategy !== 'random') {
      if (!actions.length) break;
      const bestPriority = Math.min(...actions.map(action => priorityOf(action.card)));
      actions = actions.filter(action => priorityOf(action.card) === bestPriority);
    }
    if (!actions.length) break;
    const action = actions[randomIndex(actions.length)];
    picked.push({ handIndex:action.handIndex, card:action.card, slotIdx:action.slotIdx });
    usedHandIndexes.add(action.handIndex);
    usedGuts += action.cost;
    if (action.slotIdx != null) slotUseCounts[action.slotIdx]++;
    if (strategy === 'guts') break;
  }
  return picked;
};

// 現在の配置・手札では合法だが、ガッツだけが足りない行動があるかを確認する。
// 方針や合法判定はchooseAutoTurnへ一本化し、存在確認なので固定rngを使う。
const hasAutoTurnWithEnoughGuts = options => chooseAutoTurn({
  ...options,
  guts:Number.MAX_SAFE_INTEGER,
}, () => 0).length > 0;

// 難易度。keyはランキングの記録やハイスコアの保存にも使うので、既存のものは変更しない。
// bg=選んだときの背景色 / text=選んでいないときの文字色(難易度の雰囲気に合わせた色)。
// Tailwindの動的なクラス生成は稀に失敗して色が出ないことがあるため、実際の色はinline styleで指定する
// data/breeder.js が古いキャッシュのまま読み込まれると、後から足した定義が未定義になり
// 画面全体が真っ暗になってしまう。参照側で必ず既定値に落として、機能が出ないだけで済むようにする。
// (キャッシュキー自体は tools/stamp-version.js が data/*.js の中身のハッシュへ揃えている)
const SKIP_TICKETS = (typeof SKIP_TICKET_BY_DIFFICULTY !== 'undefined' && SKIP_TICKET_BY_DIFFICULTY) || {};
// ヘルプの中身(data/help.js)も同じ理由で必ず既定値に落とす。
// 読めなかった場合はヘルプが空になるだけで、ゲーム自体は動く
// 公開前の機能を説明する項目(releaseFlag つき)は、その機能が本番へ出るまで一覧に出さない。
// 本文と HELP_SCREEN_COVERAGE は先に書き上げておき、公開フラグ1つで同時に出るようにしてある
// 隠す単位はカテゴリ・項目・本文のかたまり(blocks)の3つ。
// 既存の項目へ「公開後だけ出したい1段落」を足せるよう、blocksも同じ名札で絞り込む
const releasedHelpTopic = (topic) => (Array.isArray(topic.blocks) && topic.blocks.some(block => !releasedForPlayers(block)))
  ? { ...topic, blocks: topic.blocks.filter(releasedForPlayers) }
  : topic;
const HELP_GUIDE = ((typeof HELP_CATEGORIES !== 'undefined' && Array.isArray(HELP_CATEGORIES)) ? HELP_CATEGORIES : [])
  .filter(releasedForPlayers)
  .map(category => (Array.isArray(category.topics)
    ? { ...category, topics: category.topics.filter(releasedForPlayers).map(releasedHelpTopic) }
    : category))
  .filter(category => !Array.isArray(category.topics) || category.topics.length > 0);
const HELP_GUIDE_INTRO = (typeof HELP_INTRO !== 'undefined' && HELP_INTRO) || '';
const helpCategoryById = (id) => HELP_GUIDE.find(c => c.id === id) || null;
const helpTopicById = (categoryId, topicId) => ((helpCategoryById(categoryId) || {}).topics || []).find(t => t.id === topicId) || null;
const DIFFICULTY_SETTINGS = {
  Beginner:    { label: "Beginner",     power: 0.25, score: 0.25, gold: 0.25, bg: '#0891b2', text: '#67e8f9', color: "bg-cyan-600", shadow: "shadow-cyan-600/50" },
  Easy:        { label: "Easy",         power: 0.5,  score: 0.5,  gold: 0.5,  bg: '#059669', text: '#6ee7b7', color: "bg-emerald-600", shadow: "shadow-emerald-600/50" },
  Normal:      { label: "Normal",       power: 1.0,  score: 1.0,  gold: 1.0,  bg: '#4f46e5', text: '#a5b4fc', color: "bg-indigo-600", shadow: "shadow-indigo-600/50" },
  Hard:        { label: "Hard",         power: 1.5,  score: 2.0,  gold: 1.2,  bg: '#dc2626', text: '#fca5a5', color: "bg-red-600", shadow: "shadow-red-600/50" },
  Expert:      { label: "Expert",       power: 3.0,  score: 3.0,  gold: 1.5,  bg: '#9333ea', text: '#d8b4fe', color: "bg-purple-600", shadow: "shadow-purple-600/50" },
  Master:      { label: "Master",       power: 5.0,  score: 5.0,  gold: 2.0,  bg: '#e2e8f0', text: '#cbd5e1', color: "bg-slate-200 text-black", shadow: "shadow-white/50", darkText: true },
  GrandMaster: { label: "Grand Master", power: 6.5,  score: 8.0,  gold: 2.5,  bg: '#d97706', text: '#fcd34d', color: "bg-amber-600", shadow: "shadow-amber-500/50" },
  Hell:        { label: "Hell",         power: 8.0,  score: 12.0, gold: 3.0,  bg: '#7f1d1d', text: '#f87171', color: "bg-red-900", shadow: "shadow-red-900/60" },
  Legend:      { label: "Legend",       power: 10.0, score: 18.0, gold: 4.0,  bg: '#be185d', text: '#f9a8d4', color: "bg-pink-700", shadow: "shadow-pink-600/60" },
};
// 極限チャレンジ。チャレンジモードの上位高難易度版で、DIFFICULTY_SETTINGS(通常の難易度)とは
// 別の表にしてある。通常の難易度・全国ランキング・既存の保存キーへは混ぜない。
// INFINITYまで正式に実戦可能。難易度を足すときは、ここへ1行足して specialRules を書けば
// バトル側は「そのルールを持っているか」で判定するので、難易度名の分岐を増やさなくてよい。
const EXTREME_DIFFICULTIES = Object.freeze([
  { id:'EXTREME', label:'EXTREME', japanese:'エクストリーム', available:true, power:13, score:20, xp:25, gold:7.5, psyche:30, description:'通常チャレンジを超える敵に、育てたモンスターで限界まで挑む最高難易度。', specialRules:Object.freeze({ assistCardEffect:0.5 }) },
  { id:'NIGHTMARE', label:'NIGHTMARE', japanese:'ナイトメア', available:true, power:15, score:20, xp:30, gold:10, psyche:40, description:'有利な補正は弱まり、不利な補正は重くなる。距離適性とWAVEごとの立ち回りが重要な高難易度。', specialRules:Object.freeze({ waveEnhancement:0.5, positiveModifier:0.5, negativeModifier:2.0 }) },
  { id:'CHAOS', label:'CHAOS', japanese:'カオス', available:true, power:20, score:20, xp:35, gold:15, psyche:50, unlockRequirement:'NIGHTMARE', description:'力と報酬がさらに跳ね上がり、与えるダメージと供モン加入ボーナスが半減し、消費ガッツが増加する極限難易度。', specialRules:Object.freeze({ damageDealt:0.5, allyJoinBonus:0.5, gutsCost:1.5 }) },
  { id:'ULTIMATE', label:'ULTIMATE', available:true, power:35, score:20, xp:40, gold:20, psyche:60, unlockRequirement:'CHAOS', description:'累計ターンで敵が強化され、供モン加入ボーナス・トレーニング・与ダメージが低下し、35ターンごとに3距離のBREAKレベルが上がる最高難易度。', cardDescription:'累計ターンで敵が強化され、味方側の各効果が低下。35TごとにDISTANCE BREAKが進行する最高難度。', specialRules:Object.freeze({ enemyTurnRate:0.0075, allyJoinPenaltyRate:0.0075, damageTurnRate:0.0075, minimumDamageDealt:0.25, awakeningPenaltyRate:0.0075, awakeningZeroTurns:20, awakeningPenaltyExcludes:Object.freeze(['distance']), distanceBreak:Object.freeze({ interval:35, damageDealtPerLevel:0.5, safeDistanceCount:1, persistsForRun:true }) }) },
  // INFINITYは既存4難易度の特徴を統合した10WAVEの最終難易度。ただし役割が重なるルールは
  // 重ねない(CHAOSの与ダメ50%・加入B50%はULTIMATE系のターン低下と重複するため入れない。
  // NIGHTMAREのwaveEnhancementも、トレーニングまで50%になってターン低下と重なるため入れず、
  // 距離強化だけを下げる distanceEnhancement を使う)。
  { id:'INFINITY', label:'INFINITY', japanese:'インフィニティ', available:true, power:50, score:20, xp:45, gold:30, psyche:80, unlockRequirement:'ULTIMATE', description:'これまでの極限ルールを統合し、ターン経過による圧力がさらに強化された10WAVE最終難易度。', cardDescription:'極限ルールを統合。与ダメ低下とDISTANCE BREAKがさらに苛烈になる最上位10WAVE。', specialRules:Object.freeze({ assistCardEffect:0.5, positiveModifier:0.5, negativeModifier:2.0, distanceEnhancement:0.5, gutsCost:1.5, enemyTurnRate:0.0075, allyJoinPenaltyRate:0.0075, minimumAllyJoinBonus:0.10, damageTurnRate:0.01, minimumDamageDealt:0.30, awakeningPenaltyRate:0.0075, awakeningZeroTurns:20, awakeningPenaltyExcludes:Object.freeze(['distance']), distanceBreak:Object.freeze({ interval:25, damageDealtPerLevel:0.5, safeDistanceCount:1, persistsForRun:true }) }) },
]);
// 種族チャレンジは既存の通常・極限難易度定義を複製せず、IDの順序だけを参照する。
const SPECIES_CHALLENGE_DIFFICULTY_IDS = Object.freeze([
  ...Object.keys(DIFFICULTY_SETTINGS),
  ...EXTREME_DIFFICULTIES.map(setting=>setting.id),
]);
const SPECIES_CHALLENGE_PROGRESS_KEY = 'mh_species_challenge_progress_v1';
const emptySpeciesChallengeProgress = () => ({ version:1, species:{}, pendingRewards:{} });
const validSpeciesChallengeId = (speciesId) => typeof speciesId === 'string' && speciesId.length > 0;
const normalizeSpeciesChallengeDifficultyFlags = (value) => Object.fromEntries(
  SPECIES_CHALLENGE_DIFFICULTY_IDS
    .filter(difficultyId=>value && typeof value === 'object' && value[difficultyId] === true)
    .map(difficultyId=>[difficultyId,true])
);
// 自己記録は「種族 × 難易度」ごとに独立させる。既存の progress キーへ足すだけなので、
// records を持たない既存セーブは空の記録として読める(新しい mh_* キーは作らない)。
const emptySpeciesChallengeRecord = () => ({ bestScore:0, bestTurns:null, clears:0 });
const normalizeSpeciesChallengeRecord = (value) => {
  const record=emptySpeciesChallengeRecord();
  if(!value || typeof value!=='object' || Array.isArray(value))return record;
  const bestScore=Math.floor(Number(value.bestScore));
  if(Number.isFinite(bestScore) && bestScore>0)record.bestScore=bestScore;
  const bestTurns=Math.floor(Number(value.bestTurns));
  if(Number.isFinite(bestTurns) && bestTurns>0)record.bestTurns=bestTurns;
  const clears=Math.floor(Number(value.clears));
  if(Number.isFinite(clears) && clears>0)record.clears=clears;
  return record;
};
const normalizeSpeciesChallengeRecords = (value) => Object.fromEntries(
  SPECIES_CHALLENGE_DIFFICULTY_IDS
    .filter(difficultyId=>value && typeof value === 'object' && !Array.isArray(value) && value[difficultyId])
    .map(difficultyId=>[difficultyId,normalizeSpeciesChallengeRecord(value[difficultyId])])
    .filter(([,record])=>record.bestScore>0 || record.bestTurns!==null || record.clears>0)
);
const normalizeSpeciesChallengeProgress = (value) => {
  const normalized=emptySpeciesChallengeProgress();
  const savedSpecies=value && typeof value === 'object' && !Array.isArray(value)
    && value.species && typeof value.species === 'object' && !Array.isArray(value.species)
    ? value.species : {};
  for(const [speciesId,saved] of Object.entries(savedSpecies)){
    if(!validSpeciesChallengeId(speciesId))continue;
    const entry=saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    normalized.species[speciesId]={
      cleared:normalizeSpeciesChallengeDifficultyFlags(entry.cleared),
      firstRewardClaimed:normalizeSpeciesChallengeDifficultyFlags(entry.firstRewardClaimed),
      records:normalizeSpeciesChallengeRecords(entry.records),
    };
  }
  const savedPending=value && typeof value === 'object' && !Array.isArray(value)
    && value.pendingRewards && typeof value.pendingRewards === 'object' && !Array.isArray(value.pendingRewards)
    ? value.pendingRewards : {};
  for(const [key,pending] of Object.entries(savedPending)){
    if(!pending || typeof pending!=='object' || Array.isArray(pending))continue;
    const speciesId=typeof pending.speciesId==='string'?pending.speciesId:'';
    const difficultyId=pending.difficultyId;
    const itemId=speciesTranscendFruitItemId(speciesId);
    const rewardAmount=Math.floor(Number(pending.rewardAmount));
    const targetCount=Math.floor(Number(pending.targetCount));
    if(key!==`${speciesId}:${difficultyId}` || !itemId || pending.itemId!==itemId
      || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
      || !Number.isFinite(rewardAmount) || rewardAmount<=0
      || !Number.isFinite(targetCount) || targetCount<rewardAmount)continue;
    normalized.pendingRewards[key]={ speciesId,difficultyId,itemId,rewardAmount,targetCount };
  }
  return normalized;
};
const isSpeciesChallengeCleared = (progress,speciesId,difficultyId) =>
  validSpeciesChallengeId(speciesId) && SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    && normalizeSpeciesChallengeProgress(progress).species[speciesId]?.cleared[difficultyId] === true;
const isSpeciesChallengeFirstRewardClaimed = (progress,speciesId,difficultyId) =>
  validSpeciesChallengeId(speciesId) && SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    && normalizeSpeciesChallengeProgress(progress).species[speciesId]?.firstRewardClaimed[difficultyId] === true;
const speciesChallengeClearedDifficultyIds = (progress,speciesId) => validSpeciesChallengeId(speciesId)
  ? SPECIES_CHALLENGE_DIFFICULTY_IDS.filter(difficultyId=>isSpeciesChallengeCleared(progress,speciesId,difficultyId))
  : [];
const emptySpeciesChallengeSpeciesEntry = () => ({ cleared:{}, firstRewardClaimed:{}, records:{} });
const updateSpeciesChallengeProgressFlag = (progress,speciesId,difficultyId,field) => {
  const normalized=normalizeSpeciesChallengeProgress(progress);
  if(!validSpeciesChallengeId(speciesId) || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId))return normalized;
  const current=normalized.species[speciesId] || emptySpeciesChallengeSpeciesEntry();
  normalized.species[speciesId]={ ...current, [field]:{ ...current[field], [difficultyId]:true } };
  return normalized;
};
// 画面へ出す種族の呼び名。種族は主血統なので「モッチー種」のように出す
const speciesChallengeSpeciesName = (speciesId) => (validSpeciesChallengeId(speciesId) ? `${lineageById(speciesId).name}種` : '種族');
// 種族×難易度の自己記録を読む。記録が無い組み合わせでも既定値へ落ちる
const speciesChallengeRecord = (progress,speciesId,difficultyId) => normalizeSpeciesChallengeRecord(
  validSpeciesChallengeId(speciesId) && SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    ? normalizeSpeciesChallengeProgress(progress).species[speciesId]?.records?.[difficultyId]
    : null
);
// クリアしたときだけ呼ぶ。スコアとターン数は「良くなったときだけ」更新し、クリア回数は必ず1増やす
const updateSpeciesChallengeRecord = (progress,speciesId,difficultyId,{ score=0,turns=null }={}) => {
  const normalized=normalizeSpeciesChallengeProgress(progress);
  if(!validSpeciesChallengeId(speciesId) || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId))return normalized;
  const current=normalized.species[speciesId] || emptySpeciesChallengeSpeciesEntry();
  const before=normalizeSpeciesChallengeRecord(current.records?.[difficultyId]);
  const nextScore=Math.floor(Number(score));
  const nextTurns=Math.floor(Number(turns));
  const record={
    bestScore:Number.isFinite(nextScore)&&nextScore>before.bestScore?nextScore:before.bestScore,
    bestTurns:Number.isFinite(nextTurns)&&nextTurns>0&&(before.bestTurns===null||nextTurns<before.bestTurns)?nextTurns:before.bestTurns,
    clears:before.clears+1,
  };
  normalized.species[speciesId]={ ...current, records:{ ...current.records, [difficultyId]:record } };
  return normalized;
};
// モードカードへ出す「いくつクリアしたか」。種族をまたいだ合計だけを数える
const speciesChallengeTotalClearedCount = (progress) => Object.values(normalizeSpeciesChallengeProgress(progress).species)
  .reduce((total,entry)=>total+SPECIES_CHALLENGE_DIFFICULTY_IDS.filter(id=>entry.cleared[id]===true).length,0);
// プロフィールでは154組を直接並べず、正本の主血統順×難易度順を1回ずつ走査して要約する。
// 同点は先に現れた組を維持するため、表示が再描画のたびに変わらない。
const speciesChallengeProfileSummary = (progress) => {
  const normalized=normalizeSpeciesChallengeProgress(progress);
  const lineages=speciesChallengeLineages();
  let bestScore=0,bestSpeciesId=null,bestDifficultyId=null,clearedCount=0;
  for(const lineage of lineages){
    const entry=normalized.species[lineage.id];
    for(const difficultyId of SPECIES_CHALLENGE_DIFFICULTY_IDS){
      if(entry?.cleared?.[difficultyId]===true)clearedCount+=1;
      const score=normalizeSpeciesChallengeRecord(entry?.records?.[difficultyId]).bestScore;
      if(score>bestScore){bestScore=score;bestSpeciesId=lineage.id;bestDifficultyId=difficultyId;}
    }
  }
  return {
    bestScore,bestSpeciesId,bestDifficultyId,clearedCount,
    totalCount:lineages.length*SPECIES_CHALLENGE_DIFFICULTY_IDS.length,
  };
};
const markSpeciesChallengeCleared = (progress,speciesId,difficultyId) =>
  updateSpeciesChallengeProgressFlag(progress,speciesId,difficultyId,'cleared');
const markSpeciesChallengeFirstRewardClaimed = (progress,speciesId,difficultyId) =>
  updateSpeciesChallengeProgressFlag(progress,speciesId,difficultyId,'firstRewardClaimed');
// 種族チャレンジの供モン選択と加入状況は、バトルへ接続するまで保存しない一時ラン状態として扱う。
// entryId は既存編成と同じく、ベースモンなら baseId、マスモンなら "masu:<個体ID>" を使う。
const speciesChallengeEntryBaseId = (entryId,masuMons=[]) => {
  if(typeof entryId!=='string' || !entryId)return null;
  if(!entryId.startsWith('masu:'))return entryId;
  const masuId=entryId.slice(5);
  if(!masuId)return null;
  const masu=(Array.isArray(masuMons)?masuMons:[]).find(mon=>mon && String(mon.id)===masuId);
  return typeof masu?.baseId==='string' && masu.baseId ? masu.baseId : null;
};
// 「種族」は主血統。ピクシー種ならピクシー・ミーア・パンドラがまとめて候補になる。
// 血統はモンスターの種(baseId)から引くので、個体側には何も保存しない
const speciesChallengeEntryLineageId = (entryId,masuMons=[]) => {
  const baseId=speciesChallengeEntryBaseId(entryId,masuMons);
  return baseId ? monsterLineageOf(baseId).main.id : null;
};
const speciesChallengeAvailableAllyIds = (speciesId,unlockedBaseIds=[],masuMons=[]) => [
  ...(Array.isArray(unlockedBaseIds)?unlockedBaseIds:[]).filter(id=>monsterLineageOf(id).main.id===speciesId),
  ...(Array.isArray(masuMons)?masuMons:[])
    .filter(mon=>mon && mon.id!==null && mon.id!==undefined && monsterLineageOf(mon.baseId).main.id===speciesId)
    .map(mon=>`masu:${String(mon.id)}`),
];
const validateSpeciesChallengeAllySelection = ({speciesId,heroId,allyIds,unlockedBaseIds=[],masuMons=[]}={}) => {
  if(!Array.isArray(allyIds))return { valid:false,reason:'invalid-selection' };
  if(allyIds.length>3)return { valid:false,reason:'too-many-allies' };
  const heroLineageId=speciesChallengeEntryLineageId(heroId,masuMons);
  if(!speciesId || heroLineageId!==speciesId)return { valid:false,reason:'invalid-hero' };
  const available=new Set(speciesChallengeAvailableAllyIds(speciesId,unlockedBaseIds,masuMons));
  const usedEntryIds=new Set([heroId]);
  // 同じモンスター(baseId)は勇者と供モンを通して1体まで。既存の編成画面と同じ決まりで、
  // ベースモンのモッチーを勇者にしたらマスモンのモッチーは連れていけない
  // (ミタラシのように同じ種族でも別のモンスターなら一緒に出せる)
  const usedBaseIds=new Set([speciesChallengeEntryBaseId(heroId,masuMons)].filter(Boolean));
  for(const entryId of allyIds){
    if(!available.has(entryId))return { valid:false,reason:'unavailable-ally',entryId };
    if(usedEntryIds.has(entryId))return { valid:false,reason:entryId===heroId?'same-entry-as-hero':'duplicate-ally',entryId };
    if(speciesChallengeEntryLineageId(entryId,masuMons)!==speciesId)return { valid:false,reason:'different-species',entryId };
    const baseId=speciesChallengeEntryBaseId(entryId,masuMons);
    if(baseId && usedBaseIds.has(baseId))return { valid:false,reason:'same-monster',entryId };
    usedEntryIds.add(entryId);
    if(baseId)usedBaseIds.add(baseId);
  }
  return { valid:true,reason:null };
};
const createSpeciesChallengeRunState = ({speciesId,difficultyId,heroId,allyIds,unlockedBaseIds=[],masuMons=[]}={}) => {
  const validation=validateSpeciesChallengeAllySelection({speciesId,heroId,allyIds,unlockedBaseIds,masuMons});
  if(!validation.valid)return null;
  const run={ speciesId,difficultyId,heroId,allyIds:[...allyIds],joinedAllyIds:[] };
  return run;
};
const speciesChallengeSelectedAllies = (runState) => Array.isArray(runState?.allyIds) ? [...runState.allyIds] : [];
const speciesChallengeUnjoinedAllies = (runState) => {
  const joined=new Set(Array.isArray(runState?.joinedAllyIds)?runState.joinedAllyIds:[]);
  return speciesChallengeSelectedAllies(runState).filter(entryId=>!joined.has(entryId));
};
const joinSpeciesChallengeAlly = (runState,entryId) => {
  const remaining=speciesChallengeUnjoinedAllies(runState);
  if(!remaining.includes(entryId))return { state:runState,joinedAllyId:null };
  return {
    state:{ ...runState,allyIds:speciesChallengeSelectedAllies(runState),joinedAllyIds:[...(runState.joinedAllyIds||[]),entryId] },
    joinedAllyId:entryId,
  };
};
// WAVEクリア時の回復対象判定は供モン加入の成否から独立させる。
// STEP2Cでは実バトルへ接続せず、この結果をデバッグ画面にだけ表示する。
const simulateSpeciesChallengeJoinWave = (runState,entryId=null) => {
  const remaining=speciesChallengeUnjoinedAllies(runState);
  const result=entryId===null
    ? { state:runState,joinedAllyId:null }
    : joinSpeciesChallengeAlly(runState,entryId);
  return { ...result,hadJoinCandidates:remaining.length>0,gutsRecoveryRequired:true };
};
const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT = 5;
const isSpeciesChallengeDifficultyUnlocked = (difficultyId, clearedDifficultyIds=[]) => {
  const index=SPECIES_CHALLENGE_DIFFICULTY_IDS.indexOf(difficultyId);
  if(index<0)return false;
  if(index<SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT)return true;
  const cleared=new Set(Array.isArray(clearedDifficultyIds)?clearedDifficultyIds:[]);
  return cleared.has(SPECIES_CHALLENGE_DIFFICULTY_IDS[index-1]);
};
const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS = Object.freeze({
  Beginner:1, Easy:2, Normal:3, Hard:4, Expert:5, Master:6, GrandMaster:8,
  Hell:10, Legend:12, EXTREME:15, NIGHTMARE:20, CHAOS:25, ULTIMATE:30, INFINITY:40,
});
const speciesChallengeFirstClearReward = (difficultyId) =>
  Object.prototype.hasOwnProperty.call(SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS,difficultyId)
    ? SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS[difficultyId]
    : 0;
const speciesChallengeRewardPendingKey = (speciesId,difficultyId) => `${speciesId}:${difficultyId}`;
// クリアと初回報酬の最終形を作る純粋処理。pendingのtargetCountは「加算値」ではなく
// 絶対所持数なので、保存途中から何度やり直しても同じ所持数へ収束する。
const finalizeSpeciesChallengeClearReward = ({ progress,ownedItems,speciesId,difficultyId }={}) => {
  const currentProgress=normalizeSpeciesChallengeProgress(progress);
  const currentItems=ownedItems && typeof ownedItems==='object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const rewardAmount=speciesChallengeFirstClearReward(difficultyId);
  const itemId=speciesTranscendFruitItemId(speciesId);
  if(!itemId || rewardAmount<=0){
    // 報酬が無い組み合わせでも「クリアした」ことは必ず残す(次の難易度の解放に使うため)
    return { nextProgress:markSpeciesChallengeCleared(currentProgress,speciesId,difficultyId),nextOwnedItems:currentItems,rewardGranted:false,rewardAmount:0 };
  }
  const clearedProgress=markSpeciesChallengeCleared(currentProgress,speciesId,difficultyId);
  const pendingKey=speciesChallengeRewardPendingKey(speciesId,difficultyId);
  if(isSpeciesChallengeFirstRewardClaimed(clearedProgress,speciesId,difficultyId)){
    delete clearedProgress.pendingRewards[pendingKey];
    return { nextProgress:clearedProgress,nextOwnedItems:currentItems,rewardGranted:false,rewardAmount:0 };
  }
  const savedPending=clearedProgress.pendingRewards[pendingKey];
  const pending=savedPending && savedPending.itemId===itemId && savedPending.rewardAmount===rewardAmount
    ? savedPending
    : { speciesId,difficultyId,itemId,rewardAmount,targetCount:ownedItemCount(currentItems,itemId)+rewardAmount };
  const nextOwnedItems={ ...currentItems,[itemId]:Math.max(ownedItemCount(currentItems,itemId),pending.targetCount) };
  const nextProgress=markSpeciesChallengeFirstRewardClaimed(clearedProgress,speciesId,difficultyId);
  delete nextProgress.pendingRewards[pendingKey];
  return { nextProgress,nextOwnedItems,rewardGranted:true,rewardAmount };
};
// 2キーを一括保存できないlocal storageでも安全にする4段階確定。
// pendingを先に残し、実はtargetCountまで、claimed後にpendingを消す。
const persistSpeciesChallengeClearRewardTransaction = async ({ progress,ownedItems,speciesId,difficultyId,storeSet,storeGet,record=null }={}) => {
  const savedProgress=await storeGet(SPECIES_CHALLENGE_PROGRESS_KEY,progress,false);
  const savedItems=await storeGet('mh_owned_items',ownedItems,false);
  let currentProgress=normalizeSpeciesChallengeProgress(savedProgress);
  const currentItems=savedItems && typeof savedItems==='object' && !Array.isArray(savedItems) ? savedItems : {};
  // 自己記録(種族×難易度)は初回かどうかに関係なくクリアのたびに更新する。
  // 報酬の確定より先へ置き、報酬が無い難易度でも記録だけは必ず残す。
  // clears を二重に増やさないよう、呼び出し側は1ランにつき1回だけ呼ぶこと。
  if(record){
    currentProgress=updateSpeciesChallengeRecord(currentProgress,speciesId,difficultyId,record);
    await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,currentProgress,false);
  }
  const rewardAmount=speciesChallengeFirstClearReward(difficultyId);
  const itemId=speciesTranscendFruitItemId(speciesId);
  if(!itemId || rewardAmount<=0){
    // 報酬が無くてもクリア済みは保存する。ここを保存し忘れると次の難易度が解放されない
    const result=finalizeSpeciesChallengeClearReward({progress:currentProgress,ownedItems:currentItems,speciesId,difficultyId});
    await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,result.nextProgress,false);
    return result;
  }
  const pendingKey=speciesChallengeRewardPendingKey(speciesId,difficultyId);
  if(isSpeciesChallengeFirstRewardClaimed(currentProgress,speciesId,difficultyId)){
    const result=finalizeSpeciesChallengeClearReward({progress:currentProgress,ownedItems:currentItems,speciesId,difficultyId});
    if(currentProgress.pendingRewards[pendingKey])await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,result.nextProgress,false);
    return result;
  }
  const savedPending=currentProgress.pendingRewards[pendingKey];
  const pending=savedPending && savedPending.itemId===itemId && savedPending.rewardAmount===rewardAmount
    ? savedPending
    : { speciesId,difficultyId,itemId,rewardAmount,targetCount:ownedItemCount(currentItems,itemId)+rewardAmount };
  const pendingProgress=markSpeciesChallengeCleared(currentProgress,speciesId,difficultyId);
  pendingProgress.pendingRewards[pendingKey]=pending;
  await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,pendingProgress,false);
  const latestItems=await storeGet('mh_owned_items',currentItems,false);
  const safeLatestItems=latestItems && typeof latestItems==='object' && !Array.isArray(latestItems)?latestItems:currentItems;
  const nextOwnedItems={ ...safeLatestItems,[itemId]:Math.max(ownedItemCount(safeLatestItems,itemId),pending.targetCount) };
  await storeSet('mh_owned_items',nextOwnedItems,false);
  const claimedProgress=markSpeciesChallengeFirstRewardClaimed(pendingProgress,speciesId,difficultyId);
  await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,claimedProgress,false);
  const nextProgress=normalizeSpeciesChallengeProgress(claimedProgress);
  delete nextProgress.pendingRewards[pendingKey];
  await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,nextProgress,false);
  return { nextProgress,nextOwnedItems,rewardGranted:true,rewardAmount };
};
// 同一タブ内の別クリアが同時に走ってprogressを上書きし合わないよう、保存処理は直列化する。
// 1件が保存エラーになっても後続の復旧処理を止めない。
let speciesChallengeRewardPersistenceQueue=Promise.resolve();
const persistSpeciesChallengeClearReward = (args={}) => {
  const task=speciesChallengeRewardPersistenceQueue.then(()=>persistSpeciesChallengeClearRewardTransaction(args));
  speciesChallengeRewardPersistenceQueue=task.catch(()=>{});
  return task;
};
const EXTREME_SETTING = EXTREME_DIFFICULTIES[0];
const NIGHTMARE_SETTING = EXTREME_DIFFICULTIES[1];
const CHAOS_SETTING = EXTREME_DIFFICULTIES[2];
// 正式プレイとデバッグ戦で同じ定義を参照し、数値と特殊ルールを二重管理しない。
const ULTIMATE_SETTING = EXTREME_DIFFICULTIES[3];
const INFINITY_SETTING = EXTREME_DIFFICULTIES[4];
// GODは極限チャレンジの正式な最上位難易度。バトルデバッグも同じ定義を参照する。
const GOD_SETTING = Object.freeze({ id:'GOD', label:'GOD', japanese:'ゴッド', available:true, debugAvailable:true, power:100, score:20, xp:60, gold:40, psyche:100, waveCount:10, unlockRequirement:'INFINITY', rankingId:'ExtremeGOD', recordId:'GOD', description:'神威が2WAVEごとに上昇し、既存の極限統合ルールが段階的に苛烈になる最上位難易度。', cardDescription:'2WAVEごとに神威が上昇。累計ターン圧と20TごとのDISTANCE BREAKを受ける。', specialRules:Object.freeze({ assistCardEffect:0.5, positiveModifier:0.5, negativeModifier:2.0, distanceEnhancement:0.5, gutsCost:1.5, enemyTurnRate:0.0075, allyJoinPenaltyRate:0.0075, minimumAllyJoinBonus:0.10, damageTurnRate:0.0125, minimumDamageDealt:0.25, awakeningPenaltyRate:0.0075, awakeningZeroTurns:20, awakeningPenaltyExcludes:Object.freeze(['distance']), distanceBreak:Object.freeze({ interval:20, damageDealtPerLevel:0.5, safeDistanceCount:1, persistsForRun:true }) }) });
const ALL_EXTREME_DIFFICULTIES = Object.freeze([...EXTREME_DIFFICULTIES,GOD_SETTING]);
// 極限チャレンジの難易度カラー。カード構造は共通のまま、上位ほど発光を少しずつ強める。
// 常時アニメーションは使わず、iPhone縦画面でも視認性と軽さを優先する。
const EXTREME_DIFFICULTY_THEMES = Object.freeze({
  EXTREME:Object.freeze({accent:'#f0abfc',rgb:'232,121,249',background:'linear-gradient(180deg,#34133f,#160d2b)',action:'linear-gradient(135deg,#a21caf,#d946ef)',actionText:'#ffffff',glow:0.26,titleGlow:0.40,actionGlow:0.24,shadowBlur:28}),
  NIGHTMARE:Object.freeze({accent:'#c4b5fd',rgb:'139,92,246',background:'linear-gradient(180deg,#25143f,#110b26)',action:'linear-gradient(135deg,#6d28d9,#8b5cf6)',actionText:'#ffffff',glow:0.30,titleGlow:0.44,actionGlow:0.28,shadowBlur:30}),
  CHAOS:Object.freeze({accent:'#fda4af',rgb:'244,63,94',background:'linear-gradient(180deg,#3d111f,#1d0a13)',action:'linear-gradient(135deg,#be123c,#f43f5e)',actionText:'#ffffff',glow:0.34,titleGlow:0.48,actionGlow:0.32,shadowBlur:32}),
  ULTIMATE:Object.freeze({accent:'#fdba74',rgb:'249,115,22',background:'linear-gradient(180deg,#3b1a0a,#1e0d08)',action:'linear-gradient(135deg,#c2410c,#f97316)',actionText:'#ffffff',glow:0.38,titleGlow:0.52,actionGlow:0.36,shadowBlur:34}),
  INFINITY:Object.freeze({accent:'#93c5fd',rgb:'59,130,246',background:'linear-gradient(180deg,#11224d,#09112c)',action:'linear-gradient(135deg,#1d4ed8,#3b82f6)',actionText:'#ffffff',glow:0.42,titleGlow:0.56,actionGlow:0.40,shadowBlur:36}),
  GOD:Object.freeze({accent:'#fde68a',rgb:'245,158,11',background:'linear-gradient(180deg,#3b2b08,#181106)',action:'linear-gradient(135deg,#a16207,#f59e0b)',actionText:'#1c1917',glow:0.48,titleGlow:0.66,actionGlow:0.48,shadowBlur:40}),
});
const extremeDifficultyTheme = (difficultyId) => EXTREME_DIFFICULTY_THEMES[difficultyId] || EXTREME_DIFFICULTY_THEMES.EXTREME;
const PUBLIC_EXTREME_DIFFICULTIES = Object.freeze(ALL_EXTREME_DIFFICULTIES.filter(setting=>setting.available));
const godDivinityLevel = (waveNumber) => Math.max(1,Math.min(5,Math.floor((Math.max(1,Number(waveNumber)||1)-1)/2)+1));
const godDivinityRules = (waveNumber) => {
  const level=godDivinityLevel(waveNumber);
  return Object.freeze({
    level,
    enemyMultiplier:1+level*0.15,
    gutsCost:level>=2?1.75:1.5,
    distanceEnhancement:level>=3?0.35:0.5,
    positiveModifier:level>=4?0.35:0.5,
    negativeModifier:level>=4?2.5:2.0,
    damageTurnRate:level>=5?0.015:0.0125,
    minimumDamageDealt:level>=5?0.20:0.25,
    safeDistanceCount:level>=5?0:1,
  });
};
const extremeRuleSetting = (difficultyId) => ALL_EXTREME_DIFFICULTIES.find(setting=>setting.id===difficultyId)||null;
// クイックの極限難易度は極限チャレンジ本体の報酬を変更せず、依頼された基準倍率だけを
// クイック用に持つ。敵強度と表示色は既存の難易度定義を再利用する。
const QUICK_ULTIMATE_SETTING = Object.freeze({
  label:'ULTIMATE', power:ULTIMATE_SETTING.power, xp:35, gold:12, psyche:60, bg:'#3f0d5e', text:'#f5d0fe',
});
const QUICK_EXTREME_SETTINGS = Object.freeze({
  EXTREME: { label:'EXTREME', power:EXTREME_SETTING.power, xp:20, gold:4.5, psyche:30, bg:'#a21caf', text:'#f0abfc' },
  NIGHTMARE: { label:'NIGHTMARE', power:NIGHTMARE_SETTING.power, xp:25, gold:6, psyche:40, bg:'#6b21a8', text:'#e9d5ff' },
  CHAOS: { label:'CHAOS', power:CHAOS_SETTING.power, xp:30, gold:9, psyche:50, bg:'#581c87', text:'#f5d0fe' },
  ULTIMATE: QUICK_ULTIMATE_SETTING,
});
const QUICK_DIFFICULTY_SETTINGS = Object.freeze({
  ...DIFFICULTY_SETTINGS,
  ...QUICK_EXTREME_SETTINGS,
});
const quickDifficultySetting = (difficultyId) => difficultyId===ULTIMATE_SETTING.id
  ? QUICK_ULTIMATE_SETTING : QUICK_DIFFICULTY_SETTINGS[difficultyId];
const extremeDifficultySetting = (difficultyId) => extremeRuleSetting(difficultyId);
const extremeSpecialRule = (difficultyId, rule) =>
  extremeDifficultySetting(difficultyId)?.specialRules?.[rule] ?? 1;
const effectiveExtremeSpecialRule = (difficultyId, rule, waveNumber=1) => {
  if(difficultyId===GOD_SETTING.id && Object.prototype.hasOwnProperty.call(godDivinityRules(waveNumber),rule))return godDivinityRules(waveNumber)[rule];
  return extremeSpecialRule(difficultyId,rule);
};
const hasExtremeSpecialRules = (difficultyId) => {
  const rules=extremeDifficultySetting(difficultyId)?.specialRules;
  return !!rules && Object.keys(rules).length > 0;
};
// 「その難易度がそのルールを持っているか」で効かせるための取り出し口。
// 難易度名でハードコードすると、難易度を足すたびに同じ判定を書き足すことになるため、
// ターン系ルール(敵強化・加入B低下・与ダメ低下・トレーニング低下・DISTANCE BREAK)は
// すべてここを通す。持っていない難易度では null が返り、既存の挙動は変わらない。
const extremeRuleNumber = (difficultyId, rule) => {
  const value=extremeDifficultySetting(difficultyId)?.specialRules?.[rule];
  return Number.isFinite(value) ? value : null;
};
const extremeDistanceBreakRule = (difficultyId) => {
  const rule=extremeDifficultySetting(difficultyId)?.specialRules?.distanceBreak;
  return rule && Number.isFinite(rule.interval) && rule.interval>0 ? rule : null;
};
const effectiveExtremeDistanceBreakRule = (difficultyId,waveNumber=1) => {
  const rule=extremeDistanceBreakRule(difficultyId);
  return rule&&difficultyId===GOD_SETTING.id?{...rule,safeDistanceCount:godDivinityRules(waveNumber).safeDistanceCount}:rule;
};
// 極限本体だけでなく、同名のクイック極限難易度も同じspecialRulesを参照する。
// これにより今後の難易度もEXTREME_DIFFICULTIESへ定義を足すだけでクイックへ引き継がれる。
const specialRuleDifficultyForRun = (runMode, difficultyId, extremeRun=false, extremeDifficultyId=null) => {
  const candidate=extremeRun ? extremeDifficultyId : (isQuickMode(runMode) ? difficultyId : null);
  return hasExtremeSpecialRules(candidate) ? candidate : null;
};
// クイックULTIMATEだけ、通常10%から同じWAVEのターン数に応じたULTIMATE覚醒低下率を引く。
// 低下率はULTIMATE本体のspecialRulesを参照し、クイック側には数値を重複定義しない。
const quickGrowthRateForRun = (runMode, difficultyId, waveTurnCount) => {
  const specialDifficulty=specialRuleDifficultyForRun(runMode,difficultyId);
  const penaltyRate=extremeRuleNumber(specialDifficulty,'awakeningPenaltyRate');
  if(penaltyRate==null) return QUICK_GROWTH_MULT-1;
  return Math.max(0,(QUICK_GROWTH_MULT-1)-Math.max(0,Number(waveTurnCount)||0)*penaltyRate);
};
const specialRulePercent = (value) => `${Math.round((Number(value)||0)*100)}%`;
const compactPercent = (value) => `${Number(((Number(value)||0)*100).toFixed(1))}%`;
const precisePercent = (value) => `${Number(((Number(value)||0)*100).toFixed(2))}%`;
// バトル中の細い帯に並べる短い1行表記。静的な倍率だけを持つ難易度で使う。
// ターンで動く難易度(ULTIMATE / INFINITY)はこの帯を使わず、現在値を出す専用表示と
// 「ルール詳細」(extremeRuleDetailGroups)を使うので、ここに数値を書き写さない。
const extremeSpecialRuleLines = (difficultyId) => {
  if (difficultyId===NIGHTMARE_SETTING.id) return [
    ['強化',specialRulePercent(extremeSpecialRule(difficultyId,'waveEnhancement'))],
    ['＋補正',specialRulePercent(extremeSpecialRule(difficultyId,'positiveModifier'))],
    ['－補正',specialRulePercent(extremeSpecialRule(difficultyId,'negativeModifier'))],
  ];
  if (difficultyId===CHAOS_SETTING.id) return [
    ['与ダメ',specialRulePercent(extremeSpecialRule(difficultyId,'damageDealt'))],
    ['消費ガッツ',specialRulePercent(extremeSpecialRule(difficultyId,'gutsCost'))],
    ['加入B',specialRulePercent(extremeSpecialRule(difficultyId,'allyJoinBonus'))],
  ];
  const rules=extremeDifficultySetting(difficultyId)?.specialRules || {};
  const lines=[];
  if (rules.assistCardEffect != null) lines.push(['アシストカード効果',specialRulePercent(rules.assistCardEffect)]);
  if (rules.waveEnhancement != null) lines.push(['WAVE後強化',specialRulePercent(rules.waveEnhancement)]);
  if (rules.positiveModifier != null || rules.negativeModifier != null) {
    const signed=`＋${specialRulePercent(rules.positiveModifier ?? 1)} / −${specialRulePercent(rules.negativeModifier ?? 1)}`;
    lines.push(['自動回復補正',signed],['距離適性補正',signed]);
  }
  if (rules.damageDealt != null) lines.push(['与ダメージ',specialRulePercent(rules.damageDealt)]);
  if (rules.allyJoinBonus != null) lines.push(['供モン加入ボーナス',specialRulePercent(rules.allyJoinBonus)]);
  if (rules.gutsCost != null) lines.push(['消費ガッツ',specialRulePercent(rules.gutsCost)]);
  const known=new Set(['assistCardEffect','waveEnhancement','positiveModifier','negativeModifier','damageDealt','allyJoinBonus','gutsCost']);
  // 倍率以外(ターン率・DISTANCE BREAKの設定など)はこの1行表記では表せないので、ここへ混ぜない
  Object.entries(rules).filter(([rule,value])=>!known.has(rule)&&Number.isFinite(value))
    .forEach(([rule,value])=>lines.push([rule,specialRulePercent(value)]));
  return lines;
};
// 「1Tごと-0.75pt」のような表記。0.0075→0.75pt、0.01→1.0pt。
const turnPointText = (rate) => {
  const point=Number(((Number(rate)||0)*100).toFixed(2));
  return `${Number.isInteger(point)?point.toFixed(1):point}pt`;
};
// ルール詳細・バトル開始案内・ヘルプが同じ本文を使うための正本。
// 難易度カードは「特殊ルールがある」ことだけを出し、中身はここから作った詳細で読ませる。
// 値はすべて specialRules から組み立てるので、数値を別の場所へ書き写さない。
const extremeRuleDetailGroups = (difficultyId, quick=false) => {
  const rules=extremeDifficultySetting(difficultyId)?.specialRules || {};
  const groups=[];
  const push=(title,lines)=>{const kept=lines.filter(Boolean);if(kept.length)groups.push({title,lines:kept});};
  if(difficultyId===GOD_SETTING.id)push('神威',[
    ['進行','2WAVEごとにLv上昇（W1-2:Lv1 ～ W9-10:Lv5）'],
    ['敵HP/攻撃','神威Lvごと +15% / +30% / +45% / +60% / +75%'],
    ['Lv5','与ダメ低下 -1.5pt/T・最低20%、次のBREAKから安全距離なし'],
  ]);
  push('カード',[
    rules.assistCardEffect!=null&&['アシストカード効果',specialRulePercent(rules.assistCardEffect)],
  ]);
  push('補正',[
    rules.waveEnhancement!=null&&['WAVE後強化',specialRulePercent(rules.waveEnhancement)],
    rules.positiveModifier!=null&&['＋補正',specialRulePercent(rules.positiveModifier)],
    rules.negativeModifier!=null&&['－補正',specialRulePercent(rules.negativeModifier)],
    rules.distanceEnhancement!=null&&['距離強化',specialRulePercent(rules.distanceEnhancement)],
  ]);
  push('ダメージ・ガッツ',[
    rules.damageDealt!=null&&['与ダメージ',specialRulePercent(rules.damageDealt)],
    rules.allyJoinBonus!=null&&['供モン加入ボーナス',specialRulePercent(rules.allyJoinBonus)],
    rules.gutsCost!=null&&['消費ガッツ',specialRulePercent(rules.gutsCost)],
  ]);
  push('累計ターン',[
    rules.enemyTurnRate!=null&&['敵HP/攻撃',`累計Tごと+${precisePercent(rules.enemyTurnRate)}`],
    rules.allyJoinPenaltyRate!=null&&['加入B倍率',`累計Tごと-${turnPointText(rules.allyJoinPenaltyRate)}${rules.minimumAllyJoinBonus!=null?`（最低${specialRulePercent(rules.minimumAllyJoinBonus)}）`:''}`],
    rules.damageTurnRate!=null&&['与ダメ倍率',`経過Tごと-${turnPointText(rules.damageTurnRate)}（${specialRulePercent(rules.minimumDamageDealt??0)}で停止）`],
  ]);
  push('WAVEターン',[
    // クイックの自動成長は成長率そのものから引く(10%→…)ので「pt」、
    // トレーニングは増える量へ掛かるので「%」。掛かり方が違うので言い方も分ける
    quick
      ? (rules.awakeningPenaltyRate!=null&&['自動成長',`WAVE Tごと-${turnPointText(rules.awakeningPenaltyRate)}`])
      : (rules.awakeningZeroTurns>0&&['トレーニング',`強化量が WAVE Tごと-${precisePercent(1/rules.awakeningZeroTurns)}（${rules.awakeningZeroTurns}Tで0%）`]),
    (quick?rules.awakeningPenaltyRate!=null:rules.awakeningZeroTurns>0)&&Array.isArray(rules.awakeningPenaltyExcludes)&&rules.awakeningPenaltyExcludes.includes('distance')&&['対象外','距離強化は下がらない'],
  ]);
  const breakRule=extremeDistanceBreakRule(difficultyId);
  if(breakRule)push('DISTANCE BREAK',[
    ['進行',`累計${breakRule.interval}Tごと1距離の弱体Lv上昇`],
    ['弱体倍率',`Lv1 ${specialRulePercent(breakRule.damageDealtPerLevel)} / Lv2 ${specialRulePercent(breakRule.damageDealtPerLevel**2)} / Lv3 ${compactPercent(breakRule.damageDealtPerLevel**3)}（以降も半減）`],
    ['安全距離',`${breakRule.safeDistanceCount}距離は最後まで弱体化しない`],
  ]);
  return groups;
};
// カードには中身を並べず、特殊ルールがあることだけを出す(INFINITYは種類が多いので複合と書く)
const extremeRuleSummaryText = (difficultyId) =>
  extremeRuleDetailGroups(difficultyId).length>=4 ? '複合特殊ルールあり' : '特殊ルールあり';
// 特殊倍率は、既存式が出した最終的な獲得量・補正値へだけ掛ける。
const applyNightmareSignedModifier = (value, specialDifficulty=null, waveNumber=1) => value * (specialDifficulty
  ? effectiveExtremeSpecialRule(specialDifficulty, value >= 0 ? 'positiveModifier' : 'negativeModifier',waveNumber) : 1);
const applyNightmareWaveEnhancement = (value, specialDifficulty=null) => value * (specialDifficulty
  ? extremeSpecialRule(specialDifficulty, 'waveEnhancement') : 1);
const applyNightmareStatGain = (before, normalAfter, specialDifficulty=null) => before
  + Math.floor(applyNightmareWaveEnhancement(normalAfter - before, specialDifficulty));
// WAVE後に増える「距離強化」だけへ掛ける倍率。
// NIGHTMAREは waveEnhancement でWAVE後強化そのものが50%になるのでそれをそのまま使う。
// INFINITYは距離強化だけを50%にし、通常トレーニングへは重ねないので専用ルールを持つ
// (ここで分けておかないと、ULTIMATE由来のトレーニング低下と50%が二重に掛かってしまう)。
const applyDistanceEnhancement = (value, specialDifficulty=null, waveNumber=1) => {
  const distanceRate=specialDifficulty===GOD_SETTING.id?effectiveExtremeSpecialRule(specialDifficulty,'distanceEnhancement',waveNumber):extremeRuleNumber(specialDifficulty,'distanceEnhancement');
  return distanceRate!=null ? value*distanceRate : applyNightmareWaveEnhancement(value,specialDifficulty);
};
const ultimateEnemyTurnMultiplier = (turns, specialDifficulty=ULTIMATE_SETTING.id) => {
  const rate=extremeRuleNumber(specialDifficulty,'enemyTurnRate');
  return rate==null ? 1 : 1 + Math.max(0,Number(turns)||0)*rate;
};
const pendingUltimateDistanceBreak = (totalTurns, breakLevels, waveNumber, specialDifficulty=null) => {
  const breakRule=extremeDistanceBreakRule(specialDifficulty);
  if(!breakRule||Number(waveNumber)>=10)return null;
  const appliedCount=Array.isArray(breakLevels)?breakLevels.reduce((sum,level)=>sum+(Number(level)||0),0):0;
  const threshold=(appliedCount+1)*breakRule.interval;
  return (Number(totalTurns)||0)>=threshold?threshold:null;
};
const drawUltimateDistanceBreak = (breakLevels, random=Math.random, safeDistanceCount=1) => {
  const levels=RANGE_LABELS.map((_,index)=>Math.max(0,Number(breakLevels?.[index])||0));
  const activeCount=levels.filter(level=>level>0).length;
  const minimumActiveLevel=activeCount?Math.min(...levels.filter(level=>level>0)):0;
  const maxActive=Math.max(0,RANGE_LABELS.length-Math.max(0,Number(safeDistanceCount)||0));
  const candidates=RANGE_LABELS.map((_,index)=>index).filter(index=>activeCount<maxActive?levels[index]===0:levels[index]===minimumActiveLevel);
  if(!candidates.length)return null;
  const roll=Math.max(0,Math.min(0.999999999999,Number(random())||0));
  return candidates[Math.floor(roll*candidates.length)];
};
const applyUltimateDistanceBreak = (damage, slotIndex, breakLevels, specialDifficulty=null, cardType=null) => {
  const breakRule=extremeDistanceBreakRule(specialDifficulty);
  const isMonsterAttack=['atk','range_atk','unique'].includes(cardType);
  const level=Math.max(0,Number(breakLevels?.[slotIndex])||0);
  return breakRule&&isMonsterAttack&&level>0
    ? Math.floor((Number(damage)||0)*(breakRule.damageDealtPerLevel**level)) : damage;
};
// 与ダメ低下・加入B低下はどちらも「1 - 経過T×率」で、下限だけ難易度ごとに違う。
// 下限を書いていない難易度(ULTIMATE の加入B)は0止まりで、これまでどおりの挙動になる。
const ultimateDamageTurnMultiplier = (turns, specialDifficulty=null) => {
  const rate=extremeRuleNumber(specialDifficulty,'damageTurnRate');
  if(rate==null)return 1;
  return Math.max(extremeRuleNumber(specialDifficulty,'minimumDamageDealt')??0,1-Math.max(0,Number(turns)||0)*rate);
};
const godDamageTurnMultiplier = (turns,waveNumber) => Math.max(
  godDivinityRules(waveNumber).minimumDamageDealt,
  1-Math.max(0,Number(turns)||0)*godDivinityRules(waveNumber).damageTurnRate
);
const extremeDamageTurnMultiplier = (turns,specialDifficulty=null,waveNumber=1) => specialDifficulty===GOD_SETTING.id
  ? godDamageTurnMultiplier(turns,waveNumber) : ultimateDamageTurnMultiplier(turns,specialDifficulty);
const extremeSpecialDamageMultiplier = (turns,slotIndex,breakLevels,specialDifficulty=null,waveNumber=1,cardType=null) => {
  const turnMultiplier=extremeDamageTurnMultiplier(turns,specialDifficulty,waveNumber);
  const breakRule=effectiveExtremeDistanceBreakRule(specialDifficulty,waveNumber);
  const level=Math.max(0,Number(breakLevels?.[slotIndex])||0);
  const isMonsterAttack=['atk','range_atk','unique'].includes(cardType);
  const breakMultiplier=breakRule&&isMonsterAttack&&level>0?breakRule.damageDealtPerLevel**level:1;
  return turnMultiplier*breakMultiplier;
};
const applyGodSpecialDamage = (damage,turns,slotIndex,breakLevels,waveNumber,cardType=null) =>
  Math.floor((Number(damage)||0)*extremeSpecialDamageMultiplier(turns,slotIndex,breakLevels,GOD_SETTING.id,waveNumber,cardType));
const ultimateAllyJoinMultiplier = (turns, specialDifficulty=ULTIMATE_SETTING.id) => {
  const rate=extremeRuleNumber(specialDifficulty,'allyJoinPenaltyRate');
  if(rate==null)return 1;
  return Math.max(extremeRuleNumber(specialDifficulty,'minimumAllyJoinBonus')??0,1-Math.max(0,Number(turns)||0)*rate);
};
// トレーニングで「上がる量」へ掛かる倍率。awakeningZeroTurns ターンでちょうど0になる
// (ULTIMATE / INFINITYは20T)。1ターンあたりの下がり幅は 1 / awakeningZeroTurns。
// **率から引くのではなく、増加量へ掛ける。** 率から引くと、ちから+5%・ガッツ+5%のように
// 元の率が小さい項目だけが先に増加0になり、ライフ・丈夫さ(+20%)との差が開きすぎる。
// クイックの自動成長は成長率そのものから引く別の計算(awakeningPenaltyRate)なので、
// ここと同じ数字を使い回さない。
const trainingGainRate = (turns, specialDifficulty=null) => {
  const zeroTurns=extremeRuleNumber(specialDifficulty,'awakeningZeroTurns');
  if(zeroTurns==null||zeroTurns<=0)return 1;
  return Math.max(0,1-Math.max(0,Number(turns)||0)/zeroTurns);
};
// ===== トレーニング(WAVEクリアごとの強化。旧「能力覚醒」) =====
// 4種類から2回選ぶ。同じ項目を2回選んでもよく、その場合は1回目を適用した結果へ
// 2回目をかける(2回分をまとめて足す別計算にはしない)。
// クイックモードはこの画面を通らず自動成長するため、ここは影響しない。
const TRAINING_PICK_COUNT = 2;
const TRAINING_OPTIONS = Object.freeze([
  Object.freeze({ id:'hp',   name:'走り込み',   stat:'hp',   flat:0, rate:0.20, statLabel:'ライフ',  effect:'ライフ +20%' }),
  Object.freeze({ id:'atk',  name:'ドミノ倒し', stat:'atk',  flat:0, rate:0.05, statLabel:'ちから',  effect:'ちから +5%' }),
  Object.freeze({ id:'def',  name:'丸太うけ',   stat:'def',  flat:0, rate:0.20, statLabel:'丈夫さ',  effect:'丈夫さ +20%' }),
  Object.freeze({ id:'guts', name:'猛勉強',     stat:'guts', flat:5, rate:0.05, statLabel:'ガッツ',  effect:'ガッツ +5 ＆ +5%' }),
]);
const chooseAutoTrainingPicks = (strategy, rng=Math.random) => {
  const fixed={offense:['atk','guts'],defense:['hp','def'],guts:['guts','guts']}[strategy];
  if(fixed)return [...fixed];
  return Array.from({length:TRAINING_PICK_COUNT},()=>{
    const roll=Math.max(0,Math.min(0.999999999999,Number(rng())||0));
    return TRAINING_OPTIONS[Math.floor(roll*TRAINING_OPTIONS.length)].id;
  });
};

// 手動画面へ実際に提示された合法候補だけから選ぶ。ラン開始時は全候補、
// WAVE後は所持済みかつLv2未満の候補を優先し、同条件内はランダムにする。
const chooseAutoTeachingCard = (candidates, owned, isInitial, rng=Math.random) => {
  if (!Array.isArray(candidates) || candidates.length===0) return null;
  const preferred=isInitial?[]:candidates.filter(card=>owned.some(item=>item.id===card.id&&item.evoLevel<2));
  const choices=preferred.length>0?preferred:candidates;
  return choices[Math.floor(rng()*choices.length)]||choices[0]||null;
};
// AUTO∞の周回で、ラン開始時の最初のアシストカードをそろえるための解決。
// 1周目で実際に確定したカードのID(手動でもAUTOでもよい)を repeatRunTemplate が覚えており、
// 2周目以降の最初の PICK_TEACHING でそのカードを選び直す。
// 覚えたIDが今の候補から見つからないときは null を返し、呼び出し側は
// これまでどおり chooseAutoTeachingCard のランダム選択へ落とす(AUTOを止めない)。
const resolveRepeatInitialTeaching = (candidates, teachingId) => {
  if (!Array.isArray(candidates) || !teachingId) return null;
  return candidates.find(card => card && card.id === teachingId) || null;
};
const trainingOptionOf = (id) => TRAINING_OPTIONS.find(option=>option.id===id) || null;
// トレーニング1回ぶんを適用する。掛かり方は次の順:
//   ・まず通常どおりの増加後の値を出す(固定値を足してから割合を掛け、Math.floor)
//   ・ULTIMATE / INFINITYは、その増加量へ trainingGainRate を掛ける
//     (率から引かない。4種すべてが同じ割合で目減りする)
//   ・NIGHTMAREは増えたぶんだけをapplyNightmareStatGainで調整する
const resolveTrainingStep = (stats, optionId, turns, specialDifficulty=null) => {
  const before={atk:Number(stats?.atk)||0,def:Number(stats?.def)||0,hp:Number(stats?.hp)||0,guts:Number(stats?.guts)||0};
  const option=trainingOptionOf(optionId);
  if(!option)return before;
  const base=before[option.stat];
  // 通常の増加量を先に出してから、低下ぶんを「増加量へ掛ける」。
  // 以前は率から引いていた(max(0, 効果率 - T×0.75%))ため、ちから+5%・ガッツ+5%のように
  // 元の率が小さい項目だけが7ターンで増加0になり、ライフ・丈夫さ(+20%)との差が開きすぎていた。
  const normalAfter=Math.floor((base+option.flat)*(1+option.rate));
  const after=base+Math.floor((normalAfter-base)*trainingGainRate(turns,specialDifficulty));
  return {...before,[option.stat]:applyNightmareStatGain(base,after,specialDifficulty)};
};
// 選んだ順に1回ずつ重ねてかける。同じ項目を2回選んだときも、この積み重ねで自然に複利になる
const resolveTrainingStats = (stats, picks, turns, specialDifficulty=null) =>
  (Array.isArray(picks)?picks:[]).reduce((acc,id)=>resolveTrainingStep(acc,id,turns,specialDifficulty),
    {atk:Number(stats?.atk)||0,def:Number(stats?.def)||0,hp:Number(stats?.hp)||0,guts:Number(stats?.guts)||0});
// 整数で扱うバトル値の特殊ルール倍率はここでだけ丸める。対象ルールがない難易度は
// extremeSpecialRule が1を返すため、EXTREME / NIGHTMAREを含む既存値は変化しない。
const applyExtremeIntegerRule = (value, specialDifficulty=null, rule) => Math.floor(
  (Number(value)||0) * (specialDifficulty ? extremeSpecialRule(specialDifficulty,rule) : 1));
// 供モン加入時のステータス加算だけを難易度別に丸める。ULTIMATEは加入直前の
// WAVE結果に確定済みの累計ターンを使い、CHAOSの固定50%とは重ねない。
const applyAllyJoinBonus = (value, specialDifficulty=null, totalTurns=0) => {
  if(extremeRuleNumber(specialDifficulty,'allyJoinPenaltyRate')!=null){
    return Math.floor((Number(value)||0)*ultimateAllyJoinMultiplier(totalTurns,specialDifficulty));
  }
  return applyExtremeIntegerRule(value,specialDifficulty,'allyJoinBonus');
};
// 極限チャレンジの説明にはモード全体に共通する特徴を十分に載せる。EXTREME固有の倍率や
// アシストカード50%は、ここではなく難易度カード側で案内する
const EXTREME_MODE = Object.freeze({
  id:'extreme', label:'極限チャレンジ', short:'極限', emoji:'🔥', color:'#e879f9',
  tagline:'育てたモンスターで限界へ挑む、上級者向け高難度モード',
  highlights:[['⚔️','通常チャレンジを超える高難易度'],['🔥','EXTREMEから始まる、さらなる強敵への挑戦'],['✨','高難易度に見合った高い報酬']],
  points:[
    ['⚔️','モード概要','通常チャレンジのさらに上に位置する、上級者向けの高難易度モードです。育てたモンスターで限界に挑みます。'],
    ['🔥','難易度','EXTREMEから始まり、さらに上位の難易度が並びます。難易度が上がるほど、より強力な敵との戦いになります。'],
    ['✨','報酬','強敵を乗り越えた先で、高難易度に見合った高い報酬を狙えます。'],
    ['🎯','こんな人におすすめ','通常チャレンジを攻略し、育成したモンスターの実力をさらに試したい人におすすめです。'],
  ],
});
// 解放条件。チャレンジモードで Grand Master / Hell / Legend のどれかを1回以上クリアしていること。
// 判定には既存の mh_clears_<難易度> をそのまま読む(新しい解放フラグは作らない)ので、
// 旧セーブのプレイヤーもログインした時点で解放済みとして扱われる
const EXTREME_UNLOCK_DIFFICULTIES = Object.freeze(['GrandMaster', 'Hell', 'Legend']);
const EXTREME_UNLOCK_TEXT = 'チャレンジ Grand Master以上クリアで解放';
const isExtremeUnlocked = (clearCounts) => EXTREME_UNLOCK_DIFFICULTIES
  .some(key => (Number(clearCounts?.[key]) || 0) > 0);
// 極限チャレンジの記録。チャレンジ・クイック・プロと同じく専用の接頭辞へ分けて保存し、
// 既存の mh_hs_* / mh_clears_* は一切書き換えない(全国ランキングへも送らない)
const extremeBestScoreKey = (id) => `mh_extreme_hs_${id}`;
const extremeClearCountKey = (id) => `mh_extreme_clears_${id}`;
const EXTREME_BEST_SCORE_KEY = extremeBestScoreKey('EXTREME');
const EXTREME_CLEAR_COUNT_KEY = extremeClearCountKey('EXTREME');
const NIGHTMARE_BEST_SCORE_KEY = extremeBestScoreKey('NIGHTMARE');
const NIGHTMARE_CLEAR_COUNT_KEY = extremeClearCountKey('NIGHTMARE');
const CHAOS_BEST_SCORE_KEY = extremeBestScoreKey('CHAOS');
const CHAOS_CLEAR_COUNT_KEY = extremeClearCountKey('CHAOS');
const ULTIMATE_BEST_SCORE_KEY = extremeBestScoreKey('ULTIMATE');
const ULTIMATE_CLEAR_COUNT_KEY = extremeClearCountKey('ULTIMATE');
// INFINITYも同じ動的キー方式(mh_extreme_hs_INFINITY / mh_extreme_clears_INFINITY)。
// 旧セーブにこのキーは無いが、読み込みは既定値0を通すので移行処理はいらない。
const INFINITY_BEST_SCORE_KEY = extremeBestScoreKey('INFINITY');
const INFINITY_CLEAR_COUNT_KEY = extremeClearCountKey('INFINITY');
const normalizeExtremeRecordValue = (value) => Math.max(0, Math.floor(Number(value) || 0));
// NIGHTMAREの解放には既存のEXTREMEクリア回数を再利用する。
const isNightmareUnlocked = (extremeClearCount) => (Number(extremeClearCount) || 0) > 0;
const isChaosUnlocked = (nightmareClearCount) => (Number(nightmareClearCount) || 0) > 0;
const isUltimateUnlocked = (chaosClearCount) => (Number(chaosClearCount) || 0) > 0;
const isInfinityUnlocked = (ultimateClearCount) => (Number(ultimateClearCount) || 0) > 0;
const isGodUnlocked = (infinityClearCount) => (Number(infinityClearCount) || 0) > 0;
const normalizeBattleDifficulty = (value) => quickDifficultySetting(value) ? value : 'Normal';
// 難易度選択を開いたときの既定位置。前に遊んだ難易度を引きずらず、いつでもノーマルから始める
const BATTLE_DEFAULT_DIFFICULTY = 'Normal';
// クリアするともらえる虹のプシュケー。難易度が高いほど多い。
// 難易度のキーは DIFFICULTY_SETTINGS が正本なので、増減したらここも合わせる
// (ずれていないかは tools/breakthrough-item-check.js が見る)。
// もらえるのは「クリアしたとき」だけ。敗北・リタイア・スキップチケットでは配らない
const CLEAR_PSYCHE_REWARD = Object.freeze({
  Beginner: 1, Easy: 2, Normal: 3, Hard: 5, Expert: 7,
  Master: 10, GrandMaster: 15, Hell: 20, Legend: 25,
  EXTREME: 30, NIGHTMARE: 40, CHAOS: 50,
  ULTIMATE: QUICK_ULTIMATE_SETTING.psyche,
});
const clearPsycheReward = (difficulty) => Math.max(0, Math.floor(Number(CLEAR_PSYCHE_REWARD[normalizeBattleDifficulty(difficulty)]) || 0));
// ヘルプの中に出す「実データから作る表」。data/help.js の { t:'data', id } がこれを呼ぶ。
// 難易度の倍率やアイテムの値段をヘルプへ手で書き写すと、値を変えたときに片方だけ古くなる。
// (実際「難易度が3つしか載っていない」状態になっていた)。ここを通せば取りこぼしが起きない。
// 表を1つ足したいときは、ここに case を足して data/help.js から呼ぶ。
// ダイヤで買う商品のうち、いちばん安いものの値段。助手が「ダイヤが心もとない」と
// 声をかけるかどうかの判定にだけ使う(購入の可否は各商品ごとに別途見ている)。
// マーケットの画面から参照するので、必ず一番外側に置くこと
const CHEAPEST_GOLD_ITEM_COST = ((typeof BREEDER_MARKET_ITEMS !== 'undefined' && BREEDER_MARKET_ITEMS) || [])
  .filter(i => i.type === 'disc' || i.type === 'assist' || i.type === 'item')
  .reduce((min, i) => Math.min(min, Number(i.cost) || Infinity), Infinity);

// マーケットは1行に4商品ずつ並べる。カードが細くなるので中身も小さくそろえる
const MARKET_GRID_CLASS = 'grid grid-cols-4 gap-2 pb-4';
// 商品アイコンの大きさ。円盤石は絵を見せたいのでいちばん大きく、
// ブリーダーアイコンやカード・アイテムは名前のほうが大事なので小さくする
const MARKET_ICON_SIZE = { disc: 'w-12 h-12', assist: 'w-10 h-10', icon: 'w-10 h-10', item: 'w-9 h-9' };
// 全身画像を使う一部のアイコンは、画像自体には手を加えず表示時だけ顔まわりへ寄せる。
// 帽子を残したまま顔が円の中央で大きく見えるよう、対象IDごとに拡大率と位置を固定する。
const MARKET_PROFILE_ICON_STYLES = {
  Tiger: { scale: 2.31, x: 3, y: 38 },
  // アーク。元PNGは顔そのものが右へ寄っている(目の中心が画像の58.3%＝右へ8.3%)。
  // 倍率だけを上げていたので「右に寄っている」と見えていた(2026-09-05・ユーザー指摘)。
  // x でそのぶんを打ち消す。元PNGは左右端まで描画が続くため、寄せたぶんを覆えるだけの
  // 倍率が要る(x=-8.3 なら s>=1.166。それ未満だと画像端の直線が枠内へ露出する)。
  // y は冠と光輪が上で切れないところまで下げた。
  ark_icon: { scale: 1.17, x: -8.3, y: 4 },
  kiki_icon: KIKI_FACE_ICON_ADJUSTMENT,
  snegurochka_icon: { scale: 4.28, x: 11, y: 111 },
  snegurochka_awakened_icon: { scale: 4.28, x: 9, y: 100 },
  // イブリース。1.42は「頭上のボールを枠の外へ出す」ために選んだ倍率だったが、
  // 顔に寄りすぎて角も上下も切れていた(2026-09-05・ユーザー指摘「近すぎる」)。
  // 角と光輪が丸ごと入るところまで引いた。ボールは元絵の一部なので出してよい。
  iblis_icon: { scale: 1.30, x: 0, y: -11 },
  // 人魚2体。本人アイコンは顔が丸の中央で大きく見える位置、円盤石アイコンは
  // 円盤が丸へぴったり収まる位置。どちらも画像は加工せず、ここの倍率と位置だけで合わせる。
  // 立ち絵が縦長(1024x1536)で顔が小さく写っているため、スネグーラチカ(正方形)と
  // 同じ「顔の高さが丸の約4割」になるよう倍率を上げ、顔の中心が絵の中央より左にある分を横へ寄せている
  undine_icon: { scale: 3.67, x: 7.7, y: 118 },
  yaobikuni_icon: { scale: 3.70, x: 6.8, y: 122 },
  mia_icon: { scale: 3.2, x: 0, y: 94 },
  // パンドラ。1.8では顔が小さく、ほかのアイコンより引いて見えた
  // (2026-09-05・ユーザー指摘「少し遠い」)。角と光輪が切れない範囲で寄せた。
  pandora_icon: { scale: 2.4, x: 0, y: 72 },
  // プラント。ほかのアイコンが枠の8〜10割を埋めているのに、ここだけ7割ほどしか
  // 埋まっておらず、1つだけ引いて見えた(2026-09-05・ユーザー指摘「全部見直して統一して」)。
  // 花の先が切れない範囲で寄せた。
  plant_icon: { scale: 1.25, x: 0, y: -3 },
  // みゅあ(アシストカードのアイコン)。顔が枠の中央より左に寄っていた。
  // 寄せたぶんを覆えるよう倍率も少しだけ上げている(x=2 なら s>=1.04)。
  mua: { scale: 1.06, x: 2, y: 4 },
  // --- 円盤石 ---
  // 円盤石は「円盤そのものを、どれも同じ大きさで真ん中に」出す。
  // 画像ごとに余白がまったく違い(正方形の絵は中身が97%、1536x1024の絵は幅の64%しかない)、
  // そのままだと同じ画面に大小の円盤が並ぶ。さらに「◯◯の円盤石」と
  // 「◯◯の円盤石アイコン」は同じ画像なのに調整が片方にしか無く、別物に見えていた。
  // ミーア・パンドラの円盤石には顔用の拡大値(s3.2 / s2.4)が付いており、
  // 円盤が枠からはみ出して顔だけが写っていた(2026-09-05・ユーザー指摘)。
  //
  // 下の値は tools/image/disc-icon-values.js が元画像から計算したもの。
  // 円盤の直径が枠の95%になり、円盤の中心が枠の中心へ来る。
  // 画像を差し替えたら、その道具を流し直してここへ貼り直す。
  Zan: { scale: 0.981, x: -0.4, y: -0.4 },
  Mitarashi: { scale: 1.022, x: 0, y: 0 },
  Ark: { scale: 0.957, x: 0, y: 0 },
  Iblis: { scale: 0.957, x: 0, y: 0 },
  Snegurochka: { scale: 1.487, x: 0.1, y: 1.4 },
  undine_disc_icon: { scale: 1.489, x: 0, y: 2.1 },
  Undine: { scale: 1.489, x: 0, y: 2.1 },
  yaobikuni_disc_icon: { scale: 1.518, x: 0, y: 2.3 },
  Yaobikuni: { scale: 1.518, x: 0, y: 2.3 },
  plant_disc_icon: { scale: 0.966, x: 0, y: 0.8 },
  Plant: { scale: 0.966, x: 0, y: 0.8 },
  mia_disc_icon: { scale: 0.993, x: 0.2, y: 1.6 },
  Mia: { scale: 0.993, x: 0.2, y: 1.6 },
  pandora_disc_icon: { scale: 0.955, x: 0.2, y: 0.8 },
  Pandora: { scale: 0.955, x: 0.2, y: 0.8 },
  eiki_disc_icon: { scale: 0.95, x: 0, y: 0.9 },
  Eiki: { scale: 0.95, x: 0, y: 0.9 },
};
const DEFAULT_PROFILE_ICON_STYLE = Object.freeze({ scale:1, x:0, y:0 });
// 実際のプロフィール選択と調整Debugが共有するアイコン一覧。Debugだけの一覧は持たない。
// 同じid、またはキャッシュキーだけが異なる同じ画像は先に現れた1件へまとめる。
const breederIconOptions = ({ includeUnowned=false, ownedMarketIconIds=[] }={}) => {
  const owned = new Set(ownedMarketIconIds);
  const candidates = [
    ...STARTER_MONSTER_IDS.map(id=>{const monster=ALL_PLAYER_MONSTERS[id];return monster&&{id:monster.id,name:monster.name,src:monster.faceIconUrl||monster.iconUrl,source:'starter'};}),
    ...BREEDER_MARKET_ITEMS.filter(item=>item.type==='icon'&&(includeUnowned||owned.has(item.id))).map(item=>({id:item.id,name:item.name,src:item.icon,source:'market'})),
  ].filter(Boolean);
  const ids = new Set(), images = new Set();
  return candidates.filter(item=>{const image=String(item.src||'').split('?')[0];if(ids.has(item.id)||images.has(image))return false;ids.add(item.id);images.add(image);return true;});
};
const profileIconTransformStyle = iconAdjustmentTransformStyle;
const marketProfileIconStyle = (id) => profileIconTransformStyle(MARKET_PROFILE_ICON_STYLES[id]);
// 枠と画像を全画面で共有し、元画像全体を基準に同じ構図を再現する。
// object-cover で先に中央切り抜きせず、移動量が拡大率に影響されない順序で変形する。
const BreederIcon = ({ src, id, alt='', className='', roundedClass='rounded-full', adjustment }) => (
  <span className={`relative block overflow-hidden ${roundedClass} ${className}`}>
    <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain" style={adjustment?profileIconTransformStyle(adjustment):marketProfileIconStyle(id)}/>
  </span>
);
// HOME本番と調整Debugで、丸枠・余白・画像の有無による代替表示まで同じ部品を使う。
const HomeProfileIcon = ({ src, id, adjustment }) => (
  <div className="mh-home-avatar">{src?<BreederIcon src={src} id={id} adjustment={adjustment} alt="プロフィール画像" className="w-full h-full"/>:<User size={24}/>}</div>
);

// 図鑑一覧・血統チップ・立ち絵は本番とDEBUGで同じ収め方を使う。
const DexMonsterIcon = ({ src, alt='', hidden=false, lineage=false }) => (
  <span className={`${lineage?'w-7 h-7':'w-14 h-14'} rounded-full overflow-hidden border ${lineage?'border-amber-300/40':'border-amber-400/30'} shrink-0 bg-black/40 flex items-center justify-center`}>
    {src?<img src={src} alt={alt} draggable={false} data-dex-entry-icon={!lineage||undefined} data-dex-lineage-icon={lineage||undefined} className="w-full h-full object-contain" style={{padding:'10%',...(hidden?{filter:'brightness(0)',opacity:0.6}:{})}}/>:<span className="text-2xl">？</span>}
  </span>
);
const DexLineageChip = ({ lineage, iconUrl }) => (
  <span data-dex-lineage className="flex w-full items-center justify-center gap-1.5 min-w-0 rounded-full border border-amber-400/40 bg-black/40 pl-1 pr-2.5 py-1">
    {iconUrl?<DexMonsterIcon src={iconUrl} lineage/>:<span className="w-7 h-7 rounded-full bg-amber-900/60 border border-amber-300/30 flex items-center justify-center text-[9px] font-black text-amber-200 shrink-0">血</span>}
    <span className="text-[11px] font-black text-amber-100 truncate">{lineage.name}</span>
  </span>
);
const DexMonsterArt = ({ mon, alt, hidden=false }) => mon.imgUrl
  ? <DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt={alt} masuColors={[]} draggable={false} className="w-full h-full object-contain" style={hidden?{filter:'brightness(0)',opacity:0.65}:undefined}/>
  : <div className="text-6xl">{hidden?'？':mon.emoji}</div>;
const MarketProductIcon = ({ item, onZoom, disabled=false }) => {
  const content=item.icon?(item.type==='icon'?<BreederIcon src={item.icon} id={item.id} alt={item.name} className="w-full h-full"/>:item.type==='assist'&&ASSIST_CARD_ICON_STYLES[item.id]?<AssistCardIcon icon={item.icon} cardId={item.id} className="w-full h-full"/>:<img src={item.icon} alt={item.name} className="w-full h-full object-cover"/>):<span className="text-xl">{item.emoji}</span>;
  const cls=`${MARKET_ICON_SIZE[item.type]||'w-10 h-10'} rounded-full overflow-hidden border-2 border-white/10 shrink-0 flex items-center justify-center bg-black/30 ${disabled?'':'active:scale-90'}`;
  return onZoom?<button type="button" onClick={onZoom} aria-label={`${item.name}を大きく見る`} className={cls}>{content}</button>:<div className={cls}>{content}</div>;
};
const MarketProductCard = ({ item, owned=false, comingSoon=false, detail=null, middle=null, onDetail, onZoom, onBuy, canBuy=false, disabled=false }) => {
  const usesGold=item.type==='disc'||item.type==='assist'||item.type==='item';
  const usesPsyche=item.currency==='psyche';
  return <div className={`rounded-xl border-2 p-1.5 flex flex-col items-center gap-1 ${owned?'bg-emerald-900/30 border-emerald-500/50':comingSoon?'bg-slate-900/60 border-slate-800/60':'bg-slate-900 border-slate-800'}`}>
    <MarketProductIcon item={item} onZoom={onZoom} disabled={disabled}/>
    <div className={`w-full flex items-center justify-center text-center text-[9px] font-black leading-[1.15] ${comingSoon?'text-slate-500':'text-white'}`} style={{minHeight:'36px'}}>{item.name}</div>
    <div className="w-full flex items-center justify-center gap-1" style={{height:'22px'}}>{middle||detail&&!comingSoon?<>{middle}{!middle&&<button onClick={onDetail} aria-label={`${item.name}の詳細を見る`} className="text-[8px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-1 py-0.5 rounded-full active:scale-95 flex items-center gap-0.5 whitespace-nowrap"><BookOpen size={8}/>詳細</button>}</>:null}</div>
    <div className="w-full flex items-center justify-center mt-auto pt-2">{comingSoon?<div className="text-[8px] font-black text-slate-500 bg-slate-800/60 px-2 py-1 rounded-full whitespace-nowrap">近日追加</div>:owned?<div className="text-[8px] font-black text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded-full whitespace-nowrap">所持済み</div>:<button onClick={onBuy} disabled={disabled||!canBuy} aria-label={`${item.name}${disabled?'（デバッグのため購入不可）':`を${item.cost}${usesPsyche?'プシュケー':usesGold?'ダイヤ':'pt'}で購入`}`} className={`text-[10px] font-black px-1.5 min-h-[30px] max-w-full rounded-xl flex items-center justify-center gap-1 whitespace-nowrap ${disabled||!canBuy?'bg-slate-800 text-slate-500':usesPsyche?'bg-fuchsia-600 text-white active:scale-95':'bg-amber-500 text-black active:scale-95'}`}>{usesPsyche?<><span aria-hidden="true">🌈</span><span>{item.cost.toLocaleString()}</span></>:<>{usesGold?<Gem size={9}/>:<Coins size={9}/>}<span>{item.cost.toLocaleString()}</span></>}</button>}</div>
  </div>;
};

// 表示を待たせず、ブラウザキャッシュとデコードだけを少しずつ先へ進める画像キュー。
// URLそのものをキーにして、Reactの再描画や複数の優先グループに同じ画像が含まれても1回だけ取得する。
const imagePreloadQueue = (() => {
  const queued = new Set();
  const pending = [];
  let active = 0;
  let scheduled = false;
  const MAX_CONCURRENT = 2;
  const scheduleIdle = (callback) => {
    if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(callback, { timeout: 500 });
    return window.setTimeout(() => callback({ didTimeout:true, timeRemaining:()=>0 }), 32);
  };
  const run = () => {
    scheduled = false;
    while (active < MAX_CONCURRENT && pending.length) {
      const url = pending.shift();
      active += 1;
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        active -= 1;
        requestRun();
      };
      image.onload = () => {
        if (typeof image.decode === 'function') image.decode().catch(()=>{}).then(finish);
        else finish();
      };
      image.onerror = finish;
      image.src = url;
      if (image.complete) image.onload();
    }
  };
  const requestRun = () => {
    if (scheduled || active >= MAX_CONCURRENT || !pending.length) return;
    scheduled = true;
    scheduleIdle(run);
  };
  return {
    add(urls, { urgent=false }={}) {
      const additions = [];
      (Array.isArray(urls) ? urls : [urls]).forEach(url => {
        if (typeof url !== 'string' || !url || queued.has(url)) return;
        queued.add(url);
        additions.push(url);
      });
      if (urgent) pending.unshift(...additions);
      else pending.push(...additions);
      requestRun();
    },
  };
})();

// 初回チュートリアルを見たかどうか。既存の保存キーには触らず、新しいキーへ分けて持つ
const TUTORIAL_SEEN_KEY = 'mh_tutorial_seen_v1';
// バトルの練習を完了した状態と、初回案内を一度表示した状態は別々に保存する。
// 未定義の既存セーブはどちらも false として扱うため、後方互換性を保てる。
const BATTLE_TUTORIAL_SEEN_KEY = 'mh_battle_tutorial_seen_v1';
const BATTLE_TUTORIAL_GUIDE_SHOWN_KEY = 'mh_battle_tutorial_guide_shown_v1';
// モンビー(モンヒロビート)のチュートリアルを見たかどうか。既存のキーには触らず新しく足す。
// 値が無い既存セーブは「まだ見ていない」として扱うので、後方互換のまま初回案内が出る。
const RHYTHM_TUTORIAL_SEEN_KEY = 'mh_rhythm_tutorial_seen_v1';
// マスモンが少ないプレイヤー向けの日次案内。端末の暦日を値として保存し、
// 既存セーブにキーが無い場合は未表示として安全に扱う。
const DAILY_MASU_ADVICE_KEY = 'mh_daily_masu_advice_date_v1';
const UPDATE_NOTICE_SEEN_KEY = 'mh_seen_update_notices_v1';
// 案内の「行き先」。更新の案内と解放の案内が同じ言葉(market / battle …)を使えるよう、
// 対応表はここ1か所だけに置く
// 「新しく増えたよ」の更新の案内と、「あなたはもう遊べるよ」の解放の案内は、
// 公開した日にどちらも条件を満たすことがある。同じ内容を2回続けて出さないよう、
// 更新の案内を読み終えた時点で解放条件を満たしていれば、解放の案内は読んだことにする。
// (公開したあとに条件を満たした人へは、これまでどおり解放の案内が出る)
const UPDATE_NOTICE_COVERS_UNLOCK = Object.freeze({ update_notice_species_challenge_v1:'unlock_species_challenge_v1' });
const NOTICE_DESTINATIONS = { market:'BREEDER_MARKET', battle:'BATTLE_MODE_SELECT', training:'TRAINING_INFO' };
const noticeDestinationState = (destination) => NOTICE_DESTINATIONS[destination]
  || (typeof destination === 'string' && /^[A-Z][A-Z0-9_]*$/.test(destination) ? destination : null);
const UPDATE_NOTICE_LOGIN_LIMIT = 3;
const normalizeSeenUpdateNoticeIds = value => [...new Set((Array.isArray(value) ? value : [])
  .filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))];
const availableUpdateNotices = ({ debug=false }={}) =>
  (((typeof ASSISTANT_UPDATE_NOTICES !== 'undefined' && ASSISTANT_UPDATE_NOTICES) || [])
    .filter(notice => notice && notice.enabled === true && typeof notice.id === 'string'
      && !HIDDEN_UPDATE_NOTICE_IDS.has(notice.id)
      && (debug ? notice.debugOnly === true : notice.debugOnly !== true)));
const planUpdateNoticesForLogin = (notices, seenIds) => {
  const seen = normalizeSeenUpdateNoticeIds(seenIds);
  const unseen = (Array.isArray(notices) ? notices : []).filter(notice => !seen.includes(notice.id));
  return {
    queue: unseen.slice(0, UPDATE_NOTICE_LOGIN_LIMIT),
    seen: normalizeSeenUpdateNoticeIds([...seen, ...unseen.slice(UPDATE_NOTICE_LOGIN_LIMIT).map(notice => notice.id)]),
  };
};
const localCalendarDate = (now = new Date()) => {
  const d = now instanceof Date ? now : new Date(now);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

// 画面へ出す曲名。副題(subtitle)まで入れて1つの名前にする。
// displayName だけを出していたため、曲えらびもプレイ中も副題が落ちていた
// (「Stay With Me」「綺季一閃」だけが出て ～Locked Fate～ ～花雪に舞う詠姫～ が消えていた)。
// ヘルプの曲一覧は前から副題まで出していたので、画面とヘルプで名前が食い違っていた
const rhythmSongFullName = song => (song && song.subtitle)
  ? `${song.displayName} ${song.subtitle}`
  : (song ? song.displayName : '');
// マスモンの能力は主血統で決まる(§4.5)。画面とヘルプで使う「効果の一文」を実データから作る。
// ここへ効果を手で書き写すと、値を変えたときに文章だけ古いまま残る。
// ヘルプの表(helpDataRows の rhythmMonsterAbilities)より前に置く。
// あとに置くと、ヘルプを開いた瞬間に「初期化前の変数を参照した」で真っ白になる
// (2026-09-05・rhythmSongFullName で同じことをやってしまった)。
const rhythmAbilityEffectText=ability=>{
  if(!ability)return '';
  if(ability.id==='GENKI')return `取るとライフが +${ability.lifeGain}`;
  if(ability.id==='MUTEKI')return `${Math.round(ability.durationMs/1000)}秒のあいだライフが減らない`;
  if(ability.id==='GAMAN')return `${Math.round(ability.durationMs/1000)}秒のあいだライフの減りが${Math.round((1-ability.reduceRate)*100)}%小さくなる`;
  if(ability.id==='KONJO')return `倒れたときに一度だけライフ${ability.reviveLife}で復活（持っているときにもう一度取るとライフ +${ability.stockLifeGain}）`;
  return '';
};
const helpDataRows = (id) => {
  const marketItems = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && BREEDER_MARKET_ITEMS) || [];
  const skipIds = new Set(Object.values(SKIP_TICKETS));
  switch (id) {
    case 'difficulties':
      return Object.values(DIFFICULTY_SETTINGS).map(s => [s.label, `敵×${s.power} ／ スコア×${s.score} ／ ダイヤ×${s.gold}`]);
    // モンスターの血統一覧。ヘルプへ手で書き写すと、モンスターを足したときに古いままになる
    case 'monsterLineages':
      return dexMonsterList().map(mon => {
        const { main, sub } = monsterLineageOf(mon.id);
        return [mon.name, `${main.name} × ${sub.name}（${monsterCategoryName(monsterCategoryOf(mon.id))}）`];
      });
    // 極限チャレンジの難易度。閲覧可能な準備中難易度も倍率は実データから出す
    case 'extremeDifficulties':
      return PUBLIC_EXTREME_DIFFICULTIES.map(s => [s.label, s.available
        ? `敵×${s.power} ／ スコア×${s.score} ／ 経験値×${s.xp} ／ ダイヤ×${s.gold} ／ 虹のプシュケー ${s.psyche}個`
        : '？？？（未実装）']);
    // 種族チャレンジで選べる種族と、その種族で連れていけるモンスターの数。
    // モンスターを足すと自動で増えるので、ヘルプへ手で書き写さない
    case 'speciesChallengeLineages':
      return speciesChallengeLineages().map(lineage => {
        const members = dexMonsterList().filter(mon => monsterLineageOf(mon.id).main.id === lineage.id);
        const allyMax = Math.max(0, members.length - 1);
        return [`${lineage.name}種`, `${members.map(mon => mon.name).join('・')}（勇者モン1体＋供モン最大${allyMax}体）`];
      });
    // 種族チャレンジの難易度と、その難易度をはじめてクリアしたときにもらえる超越の実の数
    case 'speciesChallengeRewards':
      return SPECIES_CHALLENGE_DIFFICULTY_IDS.map(id => {
        const setting = DIFFICULTY_SETTINGS[id] || EXTREME_DIFFICULTIES.find(s => s.id === id);
        return [setting?.label || id, `初回クリアで 超越の実 ×${speciesChallengeFirstClearReward(id)}`];
      });
    // 限界突破の回数で変わる「レベルアップ1回ぶんの強化ポイント」。
    // 段の数や倍率を変えてもヘルプが古くならないよう、実データから作る
    case 'levelUpPointMultipliers': {
      return [
        [`Lv.1 → ${ENHANCE_POINT_DOUBLE_LEVEL}`, 'レベルアップ1回につき 強化ポイント 1'],
        [`Lv.${ENHANCE_POINT_DOUBLE_LEVEL} → ${ENHANCE_POINT_TRIPLE_LEVEL}（虹★4）`, 'レベルアップ1回につき 強化ポイント 2'],
        [`Lv.${ENHANCE_POINT_TRIPLE_LEVEL} → ${MAX_MASU_LEVEL_CAP}（虹★5）`, 'レベルアップ1回につき 強化ポイント 3'],
      ];
    }
    case 'teachings':
      return ((typeof TEACHING_CARDS !== 'undefined' && TEACHING_CARDS) || []).map(card => [card.baseName, `${card.desc}（消費ガッツ ${card.guts}）`]);
    case 'skipTickets':
      return marketItems.filter(item => skipIds.has(item.id))
        .map(item => [item.name, `${DIFFICULTY_SETTINGS[item.skipDifficulty]?.label || item.skipDifficulty} で使える ／ マーケット ${item.cost.toLocaleString()}ダイヤ`]);
    case 'items':
      // マーケットで売らないアイテム(虹のプシュケー)は値段の代わりに入手方法を出す
      return marketItems.filter(item => item.type === 'item' && !skipIds.has(item.id))
        .map(item => [item.name, `${item.shop === false ? 'マーケットでは買えない' : `${item.cost.toLocaleString()}ダイヤ`} ／ ${item.desc || ''}`]);
    // クリアでもらえる虹のプシュケー。難易度と個数は実データからそのまま作る
    case 'psycheRewards':
      return Object.entries(DIFFICULTY_SETTINGS)
        .map(([key, setting]) => [setting.label, `クリアで ${clearPsycheReward(key)} 個`]);
    case 'loginBonus':
      return ((typeof LOGIN_BONUS_REWARDS !== 'undefined' && LOGIN_BONUS_REWARDS) || [])
        .map((rewards, i) => [`${i + 1}日目`, rewards.map(giftRewardText).join(' ／ ')]);
    // 合体・転生の消費ダイヤ。単価を変えたときにヘルプだけ古くなることがないよう、
    // 実際に使っている定数からそのまま表を作る
    case 'masuCosts':
      return [
        ['再生', `初回無料・2回目以降 ${REGENERATION_COST} ダイヤ`],
        ['合体（技継承なし）', '0 ダイヤ'],
        ['合体（技継承あり）', `${FUSION_INHERIT_COST} ダイヤ`],
        ['限界突破', `絆Lv × ${REBIRTH_COST_PER_LEVEL} ダイヤ`],
        ['転生', `絆Lv × ${REBIRTH_COST_PER_LEVEL} ダイヤ`],
        ['寄付', 'かからない（逆に累計絆経験値と同じ数のダイヤを受け取れる）'],
      ];
    // みゅあとの仲良し度。段階も増える行動も data/assistants.js の実データから作るので、
    // 値を変えたときにヘルプだけ古くなることがない
    // 助手ごとに段階の名前も呼び方も違うので、両方を同じ表へ並べる。
    // 必要な仲良し度(need)はどの助手も同じなので、Lvを1行にまとめられる
    case 'assistantBond': {
      const callUnlockLv = (typeof ASSISTANT_CALL_STYLE_UNLOCK_LEVEL !== 'undefined' && ASSISTANT_CALL_STYLE_UNLOCK_LEVEL) || 6;
      const list = (typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.length) ? ASSISTANT_LIST : [];
      const base = (typeof ASSISTANT_BOND_LEVELS !== 'undefined' && ASSISTANT_BOND_LEVELS) || [];
      return base.map(s => {
        const per = list.map(who => {
          const stage = (typeof assistantBondStageByLevel === 'function') ? assistantBondStageByLevel(s.level, who.id) : s;
          const call = s.level >= callUnlockLv ? '自由に設定' : String(stage.call).replace('{name}', 'あなたの名前');
          return `${who.name}「${stage.title}」呼び方 ${call}`;
        }).join(' ／ ');
        return [`Lv.${s.level}`, `${s.need} から ／ ${per}`];
      });
    }
    // 助手の一覧。名前と性格の違いを実データから出す
    case 'assistants':
      return ((typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST) || [])
        .map(who => [who.name, `${who.tagline || ''}${who.intro ? ` ／ ${who.intro}` : ''}`]);
    case 'monsterPower':
      // 総合力の内訳は、実際の計算に使っている定数から作る(ヘルプへ数字を手で書き写さない)
      return [
        ['ライフ 1', `+${MONSTER_POWER_STAT_WEIGHT.hp}`],
        ['ちから 1', `+${Math.round(MONSTER_POWER_STAT_WEIGHT.atk * 100) / 100}（強化P1つ=ちから+${STAT_POINT_GAIN.atk} で +10）`],
        ['丈夫さ 1', `+${Math.round(MONSTER_POWER_STAT_WEIGHT.def * 100) / 100}（強化P1つ=丈夫さ+${STAT_POINT_GAIN.def} で +10）`],
        ['ガッツ 1', `+${Math.round(MONSTER_POWER_STAT_WEIGHT.guts * 100) / 100}（強化P1つ=ガッツ+${STAT_POINT_GAIN.guts} で +10）`],
        ['間合い適性', DIST_APTITUDE_GRADES.slice().reverse().map(g => `${g} ${MONSTER_POWER_APTITUDE[g] > 0 ? '+' : ''}${MONSTER_POWER_APTITUDE[g]}`).join(' ／ ') + '（4距離すべてを合計）'],
        ['固有技を1つ持つ', `+${MONSTER_POWER_UNIQUE_OWNED}（Lv0でも付く。継承した固有技も同じ）`],
        ['固有技の強化Lv 1段階', `+${Math.round(MONSTER_POWER_UNIQUE_PER_LEVEL * 100) / 100}（3段階でちょうど+200）`],
      ];
    case 'assistantBondActions':
      return Object.values((typeof ASSISTANT_BOND_ACTIONS !== 'undefined' && ASSISTANT_BOND_ACTIONS) || {})
        .map(x => [x.label, `1回 +${x.amount} ／ 1日 ${x.dailyMax} まで`]);
    // 音ゲーの難易度ごとの満点と、その満点で届く上限ランク。ランクのしきい値(RHYTHM_RANKS)を
    // 直接ヘルプへ手で書き写すと、しきい値を調整するたびヘルプだけ古くなるため、
    // rhythmRankForScoreへ各難易度のmaxScoreをそのまま渡して実データから表を作る
    case 'rhythmDifficultyRanks':
      return (typeof RHYTHM_DIFFICULTIES !== 'undefined' ? RHYTHM_DIFFICULTIES : []).map(d =>
        [d.id, `満点 ${d.maxScore.toLocaleString()}点 → 上限ランク ${rhythmRankForScore(d.maxScore)}`]);
    // 体験版で遊べる難易度と、そのレベル・ノーツ数。ヘルプへ手で書き写すと、
    // 譜面を作り直すたびに数字だけ古くなるため、実データからそのまま表にする
    case 'rhythmDemoSongLevels': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const song = typeof rhythmDemoSong !== 'undefined' ? rhythmDemoSong(songs) : null;
      if (!song) return [];
      const ids = typeof RHYTHM_DEMO_DIFFICULTY_IDS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_IDS : [];
      const labels = typeof RHYTHM_DEMO_DIFFICULTY_LABELS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_LABELS : {};
      return ids.map(id => {
        const chart = song.difficulties[id];
        if (!chart) return null;
        const note = (labels[id] && labels[id].note) || '';
        return [(labels[id] && labels[id].name) || id,
          `Lv.${chart.level} ／ ${chart.totalNotes}ノーツ${note ? ` ／ ${note}` : ''}`];
      }).filter(Boolean);
    }
    // 先行公開の曲(RHYTHM_DEMO_SONG_IDS)。手で書き写すと曲を足したときに古くなるので、
    // 実データから曲名・難易度の数・レベルの幅・長さを作る。
    case 'rhythmDemoSongList': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const list = typeof rhythmDemoSongs !== 'undefined' ? rhythmDemoSongs(songs) : [];
      const ids = typeof RHYTHM_DEMO_DIFFICULTY_IDS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_IDS : [];
      return list.map(song => {
        const charts = ids.map(id => song.difficulties[id]).filter(chart => chart && chart.notes && chart.notes.length > 0);
        if (!charts.length) return null;
        const levels = charts.map(chart => Number(chart.level) || 0);
        const length = typeof rhythmSongLengthLabel !== 'undefined' ? rhythmSongLengthLabel(song, charts[0]) : '';
        const name = rhythmSongFullName(song);
        return [name,
          `Lv.${Math.min(...levels)}〜${Math.max(...levels)} ／ ${charts.length}難易度${length ? ` ／ ${length}` : ''}`];
      }).filter(Boolean);
    }
    // 難易度ごとに「いちばんやさしい曲」と「いちばん難しい曲」がどれだけ離れているか。
    // 「同じEASYでもLv.5〜8」のようにヘルプへ手で書くと、曲を足すたびにヘルプだけ古くなる
    // (実際にそうなった)。実データのレベル表から幅を作る
    case 'rhythmDifficultySpread': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const list = typeof rhythmDemoSongs !== 'undefined' ? rhythmDemoSongs(songs) : [];
      const ids = typeof RHYTHM_DEMO_DIFFICULTY_IDS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_IDS : [];
      return ids.map(id => {
        const entries = list.map(song => ({ song, chart: song.difficulties[id] }))
          .filter(entry => entry.chart && entry.chart.notes && entry.chart.notes.length > 0
            && Number.isFinite(Number(entry.chart.level)) && Number(entry.chart.level) > 0);
        if (!entries.length) return null;
        const levels = entries.map(entry => Number(entry.chart.level));
        const low = entries[levels.indexOf(Math.min(...levels))];
        const high = entries[levels.indexOf(Math.max(...levels))];
        return [id, `Lv.${Math.min(...levels)}〜${Math.max(...levels)}`
          + `（やさしい順の先頭: ${rhythmSongFullName(low.song)} ／ いちばん重い: ${rhythmSongFullName(high.song)}）`];
      }).filter(Boolean);
    }
    // 曲えらびの四角い枠に絵が出るかどうか。ヘルプへ「いまはこの4曲」と手で書くと、
    // 絵を1つ足すたびにヘルプだけ古くなる(実際にそうなった)。実データの artwork から表にする
    case 'rhythmSongArtwork': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const list = typeof rhythmDemoSongs !== 'undefined' ? rhythmDemoSongs(songs) : [];
      const artOf = song => typeof rhythmSongArtSrc !== 'undefined' ? rhythmSongArtSrc(song)
        : (song && typeof song.artwork === 'string' ? song.artwork : '');
      // 同じ絵を2曲以上で使っているときは、その旨も出す(いまは風がそよぐ場所とClose To Your Heart)
      const uses = new Map();
      list.forEach(song => { const src = artOf(song); if (src) uses.set(src, (uses.get(src) || 0) + 1); });
      return list.map(song => {
        const src = artOf(song);
        return [rhythmSongFullName(song),
          src ? (uses.get(src) > 1 ? '絵あり（ほかの曲と同じ絵）' : '絵あり') : '色タイルに曲名の頭文字'];
      });
    }
    // モンスターノーツの能力。効果の数値(ライフ+500・6秒・15秒…)をヘルプへ書き写すと、
    // 値を変えたときにヘルプだけ古いまま残るため、実データから表にする
    case 'rhythmMonsterAbilities': {
      const abilities = typeof RHYTHM_MONSTER_ABILITIES !== 'undefined' ? RHYTHM_MONSTER_ABILITIES : {};
      const byLineage = typeof RHYTHM_MONSTER_ABILITY_BY_LINEAGE !== 'undefined' ? RHYTHM_MONSTER_ABILITY_BY_LINEAGE : {};
      return Object.values(abilities).map(ability => {
        const lineages = Object.entries(byLineage).filter(([, id]) => id === ability.id)
          .map(([lineageId]) => lineageById(lineageId).name);
        return [ability.name, `${rhythmAbilityEffectText(ability)}（主血統: ${lineages.join(' / ')}）`];
      });
    }
    case 'missionsDaily':
    case 'missionsWeekly':
    case 'missionsMonthly': {
      const type = id === 'missionsDaily' ? 'daily' : id === 'missionsWeekly' ? 'weekly' : 'monthly';
      const defs = ((typeof MISSION_DEFS !== 'undefined' && MISSION_DEFS) || {})[type] || [];
      return defs.map(m => [m.name, `${m.condition} → ${m.rewards.map(giftRewardText).join(' ／ ')}`]);
    }
    default:
      return [];
  }
};
// 表の上に出す見出し(何の表かを分かるようにする)
const HELP_DATA_TITLES = {
  difficulties: '難易度と倍率',
  extremeDifficulties: '極限チャレンジの難易度',
  levelUpPointMultipliers: 'レベルアップでもらえる強化ポイント',
  speciesChallengeLineages: '種族チャレンジで選べる種族',
  speciesChallengeRewards: '種族チャレンジの難易度と初回クリア報酬',
  teachings: 'ブリーダーの教え',
  skipTickets: 'スキップチケットの種類',
  items: 'アイテム一覧',
  loginBonus: '7日間のログインボーナス',
  missionsDaily: 'デイリーミッション',
  missionsWeekly: 'ウィークリーミッション',
  missionsMonthly: 'マンスリーミッション',
  masuCosts: '神殿でかかるダイヤ',
  assistants: '助手の種類',
  assistantBond: '仲良し度の段階と呼び方',
  assistantBondActions: '仲良し度が増える行動',
  monsterPower: '総合力の内訳',
  monsterLineages: 'モンスターの血統一覧',
  psycheRewards: '難易度ごとにもらえる虹のプシュケー',
  rhythmDifficultyRanks: '音ゲーの難易度ごとの満点と上限ランク',
  rhythmDemoSongLevels: '体験版で遊べる難易度とレベル',
  rhythmDemoSongList: '先行公開している曲',
  rhythmDifficultySpread: '同じ難易度でも曲でどれだけ違うか',
  rhythmSongArtwork: '曲えらびに絵が出る曲',
  rhythmMonsterAbilities: 'モンスターノーツで出る能力',
};
// ===== 助手(ナビゲーター) ここから =====
// 助手の名前・画像・セリフは data/assistants.js が持つ。ここは表示だけを受け持つ。
// どの画面でも <AssistantBubble scene="キー"/> の1行で同じ見た目の吹き出しを出せる。
// (今後 HOME・神殿・マーケット・M/B管理・バトル・設定・ランキング・イベント案内・
//  ギフト・ミッション・チュートリアルへ広げる想定)
const ASSISTANT_LIST = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];
const ASSISTANT_SCENE_MAP = (typeof ASSISTANT_SCENES !== 'undefined' && ASSISTANT_SCENES) || {};
const ASSISTANT_FALLBACK = { id:'', name:'助手', image:null, emoji:'💬', accent:'#f472b6', greeting:'' };
const assistantById = (id) => ASSISTANT_LIST.find(a => a.id === id)
  || ASSISTANT_LIST.find(a => a.id === (typeof DEFAULT_ASSISTANT_ID !== 'undefined' ? DEFAULT_ASSISTANT_ID : ''))
  || ASSISTANT_LIST[0] || ASSISTANT_FALLBACK;
const assistantSceneById = (key) => (key && ASSISTANT_SCENE_MAP[key]) || null;
// ---- 親密度(みゅあとの仲良し度)を各画面へ配る ----
// 吹き出しはどの画面にも置くので、画面ごとに props を渡さずに済むよう Context で配る。
// 画面側はこれまでどおり <AssistantBubble scene="…"/> の1行だけでよい。
//   level  … いまの親密度Lv(呼び方と、出るセリフが変わる)
//   name   … プレイヤー名。セリフの中の {name} が呼び方に置き換わる
//   onTalk … 顔をタップして話しかけたときに呼ぶ(仲良し度が少し増える)
const ASSISTANT_BOND_FALLBACK = { points: 0, level: 1, name: '', callStyle: null, onTalk: null };
const AssistantBondContext = React.createContext(ASSISTANT_BOND_FALLBACK);
const useAssistantBond = () => useContext(AssistantBondContext) || ASSISTANT_BOND_FALLBACK;
// セリフの中の {name} を、そのときの呼び方へ置き換える。
// data/assistants.js が読めなかった場合でも、文が壊れないように {name} だけは消す
// callStyleId … 絆Lv6から選べる呼び方の上書き(省略時は絆Lvの既定のまま)
const assistantSpeakText = (text, name, level, callStyleId) => (typeof assistantSpeak === 'function')
  ? assistantSpeak(text, name, level, callStyleId)
  : String(text == null ? '' : text).replace(/\{name\}/g, String(name || 'キミ'));
// 表情ごとの顔画像のパスを決める。用意されていない表情は data/assistants.js 側で
// 既定の表情(normal)へ落ちる。この関数が無い(古いデータの)ときは画像なし扱いにする
const assistantFaceSrc = (who, expression) => (typeof assistantFaceImage === 'function')
  ? (assistantFaceImage(who, expression) || who.image || null)
  : (who.image || null);
// 助手の顔。表情の画像が読めなかったときは既定の表情へ、それも駄目なら絵文字で代用する。
// size は px
const AssistantFace = ({ who, size = 88, accent, expression = null }) => {
  const wanted = assistantFaceSrc(who, expression);
  const fallback = assistantFaceSrc(who, null);
  const [src, setSrc] = useState(wanted);
  // 場面が変わって表情が切り替わったら読み直す
  useEffect(() => { setSrc(assistantFaceSrc(who, expression)); }, [who.id, expression]);
  return (
    <div className="shrink-0 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-black/50"
         style={{ width:`${size}px`, height:`${size}px`, borderColor:accent, boxShadow:`0 0 12px ${accent}55` }}>
      {src
        ? <img src={src} alt={who.name} className="w-full h-full object-cover"
               onError={()=>setSrc(src === fallback ? null : fallback)}/>
        : <span style={{ fontSize:`${Math.round(size * 0.5)}px`, lineHeight:1 }}>{who.emoji}</span>}
    </div>
  );
};
// ヘルプ本文のブロックを描く。ヘルプ画面と助手の詳細で同じ見た目にするため1か所にまとめる
const renderHelpBlocks = (blocks, accent) => (blocks || []).map((b, i) => {
  if(b.t==='note') return <div key={i} className="rounded-2xl p-4 border" style={{borderColor:`${accent}55`,backgroundColor:'rgba(0,0,0,0.5)'}}>{b.title&&<div className="text-[11px] font-black text-white mb-1">{b.title}</div>}<div className="text-[12px] text-slate-300 leading-relaxed">{b.text}</div></div>;
  if(b.t==='list') return <ul key={i} className="text-[12px] text-slate-300 leading-relaxed space-y-2 list-disc pl-5">{b.items.map((x,j)=><li key={j}>{x}</li>)}</ul>;
  if(b.t==='steps') return <div key={i} className="space-y-2.5">{b.items.map((x,j)=>(<div key={j} className="flex items-start gap-3"><span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-black" style={{backgroundColor:accent}}>{j+1}</span><span className="text-[12px] text-slate-300 leading-relaxed pt-0.5">{x}</span></div>))}</div>;
  if(b.t==='kv') return <div key={i} className="rounded-2xl bg-black/50 border border-white/5 overflow-hidden">{b.rows.map((r,j)=>(<div key={j} className={`flex gap-3 px-4 py-2.5 ${j>0?'border-t border-white/5':''}`}><span className="shrink-0 w-24 text-[11px] font-black text-slate-400 leading-tight">{r[0]}</span><span className="flex-1 text-[11px] text-white leading-relaxed">{r[1]}</span></div>))}</div>;
  // 実データから作る表。難易度・アイテム・ログボ・ミッションはここで全件出るので取りこぼさない
  if(b.t==='data'){const rows=helpDataRows(b.id);if(rows.length===0)return null;return(<div key={i}><div className="text-[10px] font-black mb-1 tracking-wider" style={{color:accent}}>{HELP_DATA_TITLES[b.id]||''}</div><div className="rounded-2xl bg-black/50 border border-white/5 overflow-hidden">{rows.map((r,j)=>(<div key={j} className={`flex gap-3 px-4 py-2.5 ${j>0?'border-t border-white/5':''}`}><span className="shrink-0 w-24 text-[11px] font-black text-slate-400 leading-tight">{r[0]}</span><span className="flex-1 text-[11px] text-white leading-relaxed">{r[1]}</span></div>))}</div></div>);}
  return <p key={i} className="text-[12px] text-slate-200 leading-relaxed">{b.text}</p>;
});
// 助手の吹き出し。どの画面でもこれ1つ置けばよい。
//   scene       … data/assistants.js の ASSISTANT_SCENES のキー(これだけで完結する)
//   line/detail … sceneを使わず直接セリフと詳細を渡したいとき
//   helpRef     … 'カテゴリid/項目id'。詳細としてヘルプ本文をそのまま開く
//   accent      … 画面のテーマ色に合わせたいとき(省略すると助手ごとの色)
//   compact     … 縦の場所が取れない画面(選択画面・リザルト)向けの小さい表示
//   defaultOpen … 最初から詳細を開いた状態にする(チュートリアルなどで使う)
const AssistantBubble = ({ scene=null, assistantId=null, line=null, detail=null, helpRef=null, condition=null, expression=null, accent=null, faceSize=null, compact=false, defaultOpen=false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const sceneDef = assistantSceneById(scene);
  // 親密度。呼び方と、候補に入るセリフがこれで変わる
  const bond = useAssistantBond();
  // だれが話すか。画面から指定が無ければ、いま選んでいる助手がそのまま話す
  const activeId = assistantId || sceneDef?.assistantId || bond.assistantId || null;
  const who = assistantById(activeId);
  const color = accent || who.accent || ASSISTANT_FALLBACK.accent;
  // 場面ごとに用意した複数のセリフから1つ選ぶ。同じ画面でも毎回ちがうことを話す。
  // 選び直すのは「場面」「条件」「親密度Lv」「助手」が変わったときだけ。ほかの理由で再描画
  // されるたびにセリフが入れ替わると、読んでいる途中で文が変わってしまう
  const pickedRef = useRef(null);
  const pickKey = `${who.id}|${scene || ''}|${condition || ''}|${bond.level}`;
  if (pickedRef.current?.key !== pickKey) {
    pickedRef.current = { key: pickKey, value: (typeof pickAssistantLine === 'function') ? pickAssistantLine(scene, condition, bond.level, who.id) : null };
  }
  // 顔をタップすると次のセリフへ送る。短い間に何度も押されたら連打リアクションに入る。
  // spam は { step, recovering } で、null のときは通常のセリフを話している
  const [tapped, setTapped] = useState(null);   // 顔タップで差し替えたセリフ
  const [spam, setSpam] = useState(null);
  const tapTimesRef = useRef([]);
  const spamTimerRef = useRef(null);
  useEffect(() => () => { if (spamTimerRef.current) clearTimeout(spamTimerRef.current); }, []);
  // 場面が変われば、送ったセリフも連打の状態もリセットする
  useEffect(() => { setTapped(null); setSpam(null); tapTimesRef.current = []; }, [pickKey]);
  const spamLines = (typeof ASSISTANT_SPAM_LINES !== 'undefined' && ASSISTANT_SPAM_LINES) || [];
  const spamRecover = (typeof ASSISTANT_SPAM_RECOVER !== 'undefined' && ASSISTANT_SPAM_RECOVER) || null;
  const onFaceTap = () => {
    // 話しかけると少しだけ仲良くなる(1日に増える量は data/assistants.js 側で頭打ち)
    if (typeof bond.onTalk === 'function') bond.onTalk();
    const now = Date.now();
    const windowMs = (typeof ASSISTANT_SPAM_WINDOW_MS !== 'undefined' && ASSISTANT_SPAM_WINDOW_MS) || 1200;
    const threshold = (typeof ASSISTANT_SPAM_THRESHOLD !== 'undefined' && ASSISTANT_SPAM_THRESHOLD) || 3;
    tapTimesRef.current = [...tapTimesRef.current, now].filter(t => now - t <= windowMs);
    if (spamTimerRef.current) { clearTimeout(spamTimerRef.current); spamTimerRef.current = null; }
    // 連打中: 次の段階へ。最後まで行ったら少し黙ってから笑って戻る
    if (spam || (spamLines.length > 0 && tapTimesRef.current.length >= threshold)) {
      const step = spam ? Math.min(spam.step + 1, spamLines.length - 1) : 0;
      setSpam({ step, recovering: false });
      if (spamLines[step]?.last) {
        const wait = (typeof ASSISTANT_SPAM_RECOVER_MS !== 'undefined' && ASSISTANT_SPAM_RECOVER_MS) || 2600;
        spamTimerRef.current = setTimeout(() => {
          setSpam({ step, recovering: true });
          spamTimerRef.current = setTimeout(() => { setSpam(null); tapTimesRef.current = []; }, 2600);
        }, wait);
      }
      return;
    }
    // ふつうのタップ: 次のセリフへ切り替える(表情も変わる)
    if (typeof pickAssistantLine === 'function') setTapped(pickAssistantLine(scene, condition, bond.level, who.id));
  };
  const spamLine = spam ? (spam.recovering ? spamRecover : spamLines[spam.step]) : null;
  const shown = spamLine || tapped || pickedRef.current.value;
  const picked = pickedRef.current.value;
  // セリフの中の {name} は、そのときの呼び方(さん付け・呼び捨て・ちん付けなど)になる
  const text = assistantSpeakText(line || shown?.t || who.greeting || '', bond.name, bond.level, bond.callStyle, who.id);
  const face = expression || shown?.e || null;
  const paragraphs = detail || sceneDef?.detail || null;
  const ref = helpRef || sceneDef?.help || null;
  const topic = ref && ref.includes('/') ? helpTopicById(ref.split('/')[0], ref.split('/')[1]) : null;
  const hasDetail = !!((paragraphs && paragraphs.length) || topic);
  const Wrapper = hasDetail ? 'button' : 'div';
  const size = faceSize != null ? faceSize : (compact ? 48 : 88);
  return (
    <>
      <div className="w-full flex items-end gap-2">
        {/* 顔をタップすると次のセリフへ。詳細は吹き出し側をタップする(操作を分けている) */}
        <button type="button" onClick={onFaceTap} aria-label={`${who.name}にはなしかける`} className="shrink-0 active:scale-90 transition-transform">
          <AssistantFace who={who} size={size} accent={color} expression={face}/>
        </button>
        <Wrapper
          {...(hasDetail ? { onClick:()=>setOpen(true), 'aria-label':`${who.name}の説明を開く` } : {})}
          className={`relative flex-1 min-w-0 text-left rounded-2xl border-2 ${compact?'px-2.5 py-1.5':'px-3 py-2'} ${hasDetail?'active:scale-[.99]':''}`}
          style={{ borderColor:color, backgroundColor:'rgba(15,23,42,0.92)' }}>
          {/* 吹き出しのしっぽ(左向き) */}
          <span className="absolute" style={{ left:'-9px', bottom:'14px', width:0, height:0, borderTop:'7px solid transparent', borderBottom:'7px solid transparent', borderRight:`9px solid ${color}` }}/>
          <span className="absolute" style={{ left:'-6px', bottom:'14px', width:0, height:0, borderTop:'7px solid transparent', borderBottom:'7px solid transparent', borderRight:'9px solid rgba(15,23,42,0.92)' }}/>
          <span className={`block font-black tracking-widest ${compact?'text-[9px]':'text-[10px]'}`} style={{ color }}>{who.name}</span>
          <span className={`block text-white leading-relaxed ${compact?'text-[10px]':'text-[12px]'}`}>{text}</span>
          {hasDetail&&<span className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] font-black" style={{ color }}>タップで詳しく<ChevronRight size={11}/></span>}
        </Wrapper>
      </div>
      {open&&(
        <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.94)',zIndex:70000}} role="dialog" aria-modal="true" aria-label={`${who.name}の説明`}>
          <div className="w-full max-w-md rounded-t-3xl border-t-2 border-x-2 bg-slate-950 flex flex-col" style={{ borderColor:color, maxHeight:'88vh' }}>
            <div className="shrink-0 flex items-center gap-3 p-4 border-b border-white/10">
              <AssistantFace who={who} size={68} accent={color} expression={face}/>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black tracking-widest" style={{ color }}>{who.name}</div>
                <div className="text-[12px] text-white leading-relaxed">{text}</div>
              </div>
              <button onClick={()=>setOpen(false)} aria-label="説明を閉じる" className="shrink-0 p-2 bg-white/10 rounded-full active:scale-90"><X size={18}/></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll p-4 space-y-3.5">
              {topic
                ? renderHelpBlocks(topic.blocks, color)
                : (paragraphs || []).map((x,i)=><p key={i} className="text-[12px] text-slate-200 leading-relaxed">{x}</p>)}
            </div>
            <div className="shrink-0 p-4 pt-2" style={{ paddingBottom:'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={()=>setOpen(false)} className="w-full min-h-[48px] rounded-2xl font-black text-sm text-black active:scale-[.98]" style={{ backgroundColor:color }}>とじる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
// クイックモードの短い演出画面。プレイヤーがタップするまで待つ(自動では進めない)。
// 連打しても onDone は1回しか呼ばない
const QuickStepScreen = ({ onDone, accent = '#2dd4bf', label = 'タップして次へ', children }) => {
  const doneRef = useRef(false);
  const finish = () => { if (doneRef.current) return; doneRef.current = true; onDone(); };
  return (
    <div onClick={finish} role="button" tabIndex={0} aria-label={label}
         className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
         style={{ position:'absolute', inset:0, backgroundColor:'#020617', zIndex:30000 }}>
      <div className="w-full max-w-sm flex flex-col items-center">{children}</div>
      <div className="mt-5 text-[11px] font-black tracking-widest animate-pulse" style={{ color:accent }}>{label}</div>
    </div>
  );
};
// ===== 助手(ナビゲーター) ここまで =====
// 難易度の色をそのまま反映するためのinline style。選択中は背景色、未選択は文字色だけを難易度の色にする
const difficultyStyle = (setting, selected) => (selected
  ? { backgroundColor: setting.bg, color: setting.darkText ? '#0f172a' : '#ffffff' }
  : { backgroundColor: 'rgba(15,23,42,0.9)', color: setting.text });

// 透明余白を含む画像キャンバスではなく、画面ごとの見た目を基準に調整する。
// contextを必須にすることで、SCANの調整が全WAVE詳細へ波及しないようにする。
const ENEMY_ART_LAYOUT = {
  default: { scanScale:1, waveDetailScale:1, objectPosition:'center' },
  Moo: { scanScale:2.75, waveDetailScale:2, objectPosition:'center 48%' },
};
const enemyArtStyle = (enemyId, context='scan') => {
  const layout=ENEMY_ART_LAYOUT[enemyId]||ENEMY_ART_LAYOUT.default;
  const scale=context==='waveDetail'?layout.waveDetailScale:layout.scanScale;
  return {transform:`scale(${scale})`,transformOrigin:layout.objectPosition,objectPosition:layout.objectPosition};
};

// 実戦の抽選とSCANは同じ定義・使用可否評価を参照する。SCAN側は候補を評価するだけで乱数を使わない。
//
// 必殺技は「ためる(CHARGE)」→「発動(SPECIAL)」の2ターンに分かれている。
// CHARGE のターンはオーラを溜めるだけでダメージが無く、その次のターンは必ず SPECIAL になる
// (再抽選せず、移動などほかの行動でも上書きしない)。SPECIAL は抽選には出てこないので重みは0。
//
// 移動は「移動した次のターンには選ばない」。同じ間合いを行ったり来たりして
// 手が出せないまま終わる、という状態を避けるため。
const ENEMY_ACTION_DEFINITIONS = [
  {id:'normal',type:'ATTACK',category:'通常攻撃',weight:50,multiplier:1,hits:1,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'charge',type:'CHARGE',category:'ためる',weight:15,multiplier:0,hits:0,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'special',type:'SPECIAL',category:'必殺技',weight:0,multiplier:2.5,hits:1,range:'全間合い',condition:'ためた次のターンに必ず発動',cooldown:0,useLimit:null},
  {id:'wait',type:'WAIT',category:'特殊行動',weight:20,multiplier:0,hits:0,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'move',type:'MOVE',category:'移動',weight:15,multiplier:0,hits:0,range:'現在以外の3間合い',condition:'移動先がある・移動した次のターンは選ばない',cooldown:0,useLimit:null},
];
// 直前の行動から、次に選べる行動を決めるための状態を作る
const enemyActionStateFrom = (lastIntent) => ({
  charging: lastIntent?.type === 'CHARGE',
  movedLast: lastIntent?.type === 'MOVE',
});
const evaluateEnemyActions = (ent,currentDist,state={}) => {
  const charging=!!state.charging, movedLast=!!state.movedLast;
  return ENEMY_ACTION_DEFINITIONS.map(def => {
    let available=!!ent, reason=ent?'':'敵情報がありません';
    if (available) {
      if (charging) {
        // ためた次のターンは必殺技で確定。ほかの行動では上書きしない
        available = def.type==='SPECIAL';
        if (!available) reason='ためているため、次は必殺技で確定しています';
      } else if (def.type==='SPECIAL') {
        available=false; reason='ためた次のターンにだけ発動します';
      } else if (def.type==='MOVE') {
        // 移動は必ず前のターンに吹き出しで予告してから行う。
        // 予告を出す機会が無かったターンの直後は、そもそも移動を選ばない。
        //   ・戦闘が始まった1ターン目
        //   ・必殺技の準備をスタンで止めるなどして、予約していた行動を引き直したとき
        if (state.unannounced) { available=false; reason='移動は前のターンの吹き出しで予告してから行うため、予告を出していないこの場面では選ばれません'; }
        else if (movedLast) { available=false; reason='移動した次のターンは移動しません'; }
        else if (!RANGE_LABELS.some((_,i)=>i!==currentDist)) { available=false; reason='移動先がありません'; }
      }
    }
    return {...def,weight:charging?(def.type==='SPECIAL'?1:0):def.weight,available,unavailableReason:available?'':reason};
  });
};
const enemyActionProbabilities = (ent,currentDist,state={}) => {
  const actions=evaluateEnemyActions(ent,currentDist,state),total=actions.reduce((sum,a)=>sum+(a.available?a.weight:0),0);
  return actions.map(a=>({...a,probability:a.available&&total>0?a.weight/total:0}));
};
// 行動の見出しとアイコン。抽選と台本(練習モード)の両方から使う
const enemyActionLabel = (ent,type) => type==='ATTACK' ? (ent?.normal||'通常攻撃')
  : type==='CHARGE' ? '必殺技の準備をしている'
  : type==='SPECIAL' ? (ent?.special||'必殺技！')
  : '様子を見ている';
const ENEMY_ACTION_ICONS = {ATTACK:'👊',CHARGE:'✨',SPECIAL:'🔥',WAIT:'⏳',MOVE:'🏃'};
const chooseEnemyAction = (ent,currentDist,random=Math.random,state={}) => {
  const actions=enemyActionProbabilities(ent,currentDist,state),roll=random(),available=actions.filter(a=>a.available);
  let cursor=roll;
  const selected=available.find(a=>{cursor-=a.probability;return cursor<0;})||available[available.length-1];
  if(!selected)return null;
  if(selected.type==='MOVE'){
    const targets=RANGE_LABELS.map((_,i)=>i).filter(i=>i!==currentDist);
    const targetDist=targets[Math.min(targets.length-1,Math.floor(random()*targets.length))];
    // 予告に出した移動先をそのまま持ち歩く。実行時はこの値だけを見るので、
    // 予告と実際の移動先が食い違うことはない
    return {type:selected.type,value:0,label:`移動: ${RANGE_LABELS[targetDist]}`,targetDist,icon:ENEMY_ACTION_ICONS.MOVE,actionId:selected.id};
  }
  return {type:selected.type,value:Math.floor(ent.atk*selected.multiplier),label:enemyActionLabel(ent,selected.type),icon:ENEMY_ACTION_ICONS[selected.type]||'⏳',actionId:selected.id};
};

// 難易度選択プレビューと本番の敵生成が必ず同じ値になるための唯一の生成ヘルパー。
// 絶氷の楔(固有効果)と氷海の支配者(勇者特性)を持つ人魚たち。
// 固有効果と勇者特性は別の処理だが、対象種の一覧だけを共有する。
const ICE_LOCK_MONSTER_IDS = Object.freeze(['Snegurochka', 'Undine', 'Yaobikuni']);
const isIceLockMonster = (id) => ICE_LOCK_MONSTER_IDS.includes(id);
const applyIceRulerAutoGutsRecovery = (currentRate, heroId, iceLockActive, heroDist, enemyDist) => isIceLockMonster(heroId)
  && iceLockActive
  && heroDist===enemyDist
  ? Math.min(1, currentRate + 0.5)
  : currentRate;
const createBattleEnemy = (wave, difficulty, forcedEnemyKey=null, powerOverride=null, enemyTurnMultiplier=1) => {
  const enemyKey = forcedEnemyKey || ENEMY_SEQUENCE[wave - 1];
  const base = ENEMY_DATA[enemyKey];
  const safeDifficulty = normalizeBattleDifficulty(difficulty);
  const hasPowerOverride = powerOverride !== null && powerOverride !== undefined && Number.isFinite(Number(powerOverride));
  const mod = hasPowerOverride ? Number(powerOverride) : QUICK_DIFFICULTY_SETTINGS[safeDifficulty].power;
  const baseHp = Number.isFinite(Number(base?.baseHp)) ? Math.max(1, Number(base.baseHp)) : 1;
  const baseAtk = Number.isFinite(Number(base?.baseAtk)) ? Math.max(0, Number(base.baseAtk)) : 0;
  return {
    ...(base || {}),
    id:enemyKey || `missing-wave-${wave}`,
    name:base?.name || '敵データ未設定',
    imgUrl:base?.imgUrl || '',
    emoji:base?.emoji || '❓',
    hp:Math.floor(baseHp*mod*enemyTurnMultiplier),
    maxHp:Math.floor(baseHp*mod*enemyTurnMultiplier),
    atk:Math.floor(baseAtk*mod*enemyTurnMultiplier),
  };
};

const collectBondRankingEntries = (rankingPool) => {
  const byIndividual=new Map();
  Object.values(rankingPool||{}).forEach(rows=>(rows||[]).forEach(record=>{
    const userName=record?.userName||'名無しのブリーダー';
    (Array.isArray(record?.party)?record.party:[]).forEach(member=>{
      const bondLevel=Number(member?.bondLevel);
      if(!member||!Number.isFinite(bondLevel)||bondLevel<=0)return;
      const recordedMonsterId=member.baseId||member.monsterId||member.id||null;
      const monsterId=recordedMonsterId||Object.keys(ALL_PLAYER_MONSTERS).find(id=>ALL_PLAYER_MONSTERS[id]?.name===member.name)||null;
      const monName=ALL_PLAYER_MONSTERS[monsterId]?.name||member.name||null;
      if(!monName)return;
      const individualId=member.masuId!=null&&String(member.masuId)!==''
        ? `masu:${String(member.masuId)}`
        : `legacy:${monsterId||monName}`;
      const key=`${userName}\u0000${individualId}`;
      // detail / colors は「詳細 ›」で1体ぶんの中身を開くために持ち回る。
      // 育て方を記録するようになる前の古い記録には入っていないので、その場合はnullのまま。
      const entry={userName,icon:record.icon,monName,bondLevel,imgUrl:ALL_PLAYER_MONSTERS[monsterId]?.iconUrl||member.imgUrl||null,emoji:member.emoji||ALL_PLAYER_MONSTERS[monsterId]?.emoji||null,masuId:member.masuId??null,monsterId,detail:member.detail??null,colors:Array.isArray(member.colors)?member.colors:[]};
      const current=byIndividual.get(key);
      if(!current)byIndividual.set(key,entry);
      else byIndividual.set(key,{...(bondLevel>current.bondLevel?entry:current),bondLevel:Math.max(current.bondLevel,bondLevel)});
    });
  }));
  // 同じ人・同じ種類で「個体ID(masuId)付きの記録」と「個体IDの無い古い記録」が両方あると、
  // 同じマスモンが2件に分かれて並んでしまう。古い記録はどの個体かを特定できないので、
  // 個体ID付きの記録がある種類では古い記録を出さない。
  // ただし古い記録の方が高い絆Lvを持っている場合は、その値だけ個体側へ引き継ぐ。
  const entries=[...byIndividual.values()];
  const speciesKey=e=>`${e.userName}\u0000${e.monsterId||e.monName}`;
  const bestMasuOfSpecies=new Map();
  entries.forEach(e=>{
    if(e.masuId==null||String(e.masuId)==='')return;
    const key=speciesKey(e);
    const current=bestMasuOfSpecies.get(key);
    if(!current||e.bondLevel>current.bondLevel)bestMasuOfSpecies.set(key,e);
  });
  const deduped=entries.filter(e=>{
    if(e.masuId!=null&&String(e.masuId)!=='')return true;
    const owner=bestMasuOfSpecies.get(speciesKey(e));
    if(!owner)return true; // 個体IDの記録が無ければ、古い記録をそのまま出す
    if(e.bondLevel>owner.bondLevel)owner.bondLevel=e.bondLevel;
    return false;
  });
  return deduped.sort((a,b)=>b.bondLevel-a.bondLevel||a.userName.localeCompare(b.userName,'ja'));
};

// ランキングに出すモンスターの絵。記録にはIDだけが入っているので、同梱の絵を引いて使う。
// 画像を埋め込んでいた頃の古い記録は、そのimgUrlをそのまま使って表示できるようにしておく。
const rankingMonsterIdOf = (member) => {
  if (!member) return null;
  const recorded = member.baseId||member.monsterId||member.id;
  if (recorded && ALL_PLAYER_MONSTERS[recorded]) return recorded;
  // 古い記録は種類のIDを持たず名前しか無いことがあるので、名前からも引く
  return Object.keys(ALL_PLAYER_MONSTERS).find(id=>ALL_PLAYER_MONSTERS[id]?.name===member.name) || null;
};
// 編成の各モンスターに、そのプレイ時点の絆Lvを添える。
// bondLevel は記録にもとから入っているので、表示するだけで通信は増えない。
// マスモンでない(絆Lvを持たない)モンスターは何も出さない。
const rankingMemberLevel = (member) => {
  const level = Number(member?.bondLevel);
  return Number.isFinite(level) && level > 0 ? level : null;
};
const rankingMemberImage = (member) => {
  if (!member) return null;
  const base = ALL_PLAYER_MONSTERS[rankingMonsterIdOf(member)];
  return base?.iconUrl || member.imgUrl || null;
};

const splitRankingParty = (entry) => {
  if (!Array.isArray(entry?.party)) return {hero:null,allies:null};
  const members = entry.party.filter(Boolean);
  const roleHeroIndex = members.findIndex(member=>member?.role==='hero');
  if (roleHeroIndex >= 0) return {hero:members[roleHeroIndex],allies:members.filter((_,i)=>i!==roleHeroIndex && members[i]?.role!=='hero')};
  // 旧記録は個体IDを優先し、無ければ表示名一致の最初の1体だけを勇者として分離する。
  let heroIndex = entry?.heroMasuId != null ? members.findIndex(m=>m?.masuId!=null&&String(m.masuId)===String(entry.heroMasuId)) : -1;
  if (heroIndex < 0) heroIndex = members.findIndex(member=>member?.name===entry?.hero);
  if (heroIndex < 0) return {hero:null,allies:null};
  return {hero:members[heroIndex],allies:members.filter((_,i)=>i!==heroIndex)};
};

// ブリーダー教えカード使用時の専用演出(色・アイコン・掛け声)
const TEACHING_FX_STYLE = {
  oryo:    { icon:"🌸", label:"闘気上昇!",   text:"text-red-300",     ring:"border-red-300",     rgb:"239,68,68" },
  dra:     { icon:"🐉", label:"鉄壁化!",     text:"text-emerald-300", ring:"border-emerald-300", rgb:"16,185,129" },
  cadmium: { icon:"🧪", label:"計算完了!",   text:"text-cyan-300",    ring:"border-cyan-300",    rgb:"6,182,212" },
  mua:     { icon:"💖", label:"祝福!",       text:"text-pink-300",    ring:"border-pink-300",    rgb:"236,72,153" },
  atsu:    { icon:"🔥", label:"挑発!",       text:"text-orange-300",  ring:"border-orange-300",  rgb:"234,88,12" },
  myaru:   { icon:"🐈", label:"怪薬投与!",   text:"text-purple-300",  ring:"border-purple-300",  rgb:"168,85,247" },
  kiki:    { icon:"📣", label:"全力応援!",   text:"text-sky-300",     ring:"border-sky-300",     rgb:"56,189,248" },
  poltz:   { icon:"🍱", label:"弁当を構える!", text:"text-lime-300",    ring:"border-lime-300",    rgb:"163,230,53" },
};


// ==================== ダンジョンRPG戦闘テスト(デバッグ専用) ====================
// 将来つくる「独立型ダンジョンRPG／ハクスラ」の戦闘そのものが面白いか、
// ステータスの数値感が妥当かを実機で確かめるための試作。まだ正式コンテンツではない。
//
// ★このブロックの決めごと
//   ・入口はデバッグ設定(DEBUG_SETTINGS)だけ。通常のHOME・バトル・マスモン管理へは出さない
//   ・保存・報酬・ランキング・ミッション・絆経験値へ一切触れない(メモリ上だけの状態)
//   ・使うのはベースモン(ALL_PLAYER_MONSTERS)だけ。マスモン(個体)は使わない
//   ・通常バトルの計算式には触れない。RPGの式はここに閉じている
//
// 数値はすべてこの定数群が正本で、画面側で式を書き直さないこと。
const RPG_MAX_LEVEL = 50;              // デバッグで指定できるLvの上限(味方・敵とも)
const RPG_MAX_PARTY = 4;               // 味方の最大人数。6体編成は今回作らない
const RPG_MAX_ENEMIES = 4;             // 敵の最大数
const RPG_STAT_DIVISOR = 10;           // 現在のベース能力 → RPGのLv1能力(約1/10)
const RPG_POINTS_PER_LEVEL = 1;        // Lvが1上がるごとにもらえる配分ポイント(暫定)
// 配分ポイント1点ぶんの上昇量(暫定)。ライフだけ伸びが大きい
const RPG_GAIN_PER_POINT = Object.freeze({ hp:6, atk:2, def:2, guts:2, speed:2, luck:2 });
const RPG_STAT_KEYS = Object.freeze(['hp','atk','def','guts','speed','luck']);
const RPG_STAT_LABELS = Object.freeze({ hp:'ライフ', atk:'ちから', def:'丈夫さ', guts:'ガッツ', speed:'素早さ', luck:'運' });
// 素早さ・運は本編(ALL_PLAYER_MONSTERS)にまだ正式な基礎能力が無い。
// 本編データへ baseSpeed / baseLuck を足して通常ゲームへ影響させたくないので、
// この試作の中だけで「全モンスター共通で10から」と決め打ちする。
// 実機で触ってからモンスターごとの値を決める予定。
const RPG_BASE_SPEED = 10;
const RPG_BASE_LUCK = 10;
const RPG_NORMAL_ATTACK_MULT = 1.0;    // 「こうげき」の技倍率
const RPG_DEF_COEFF = 4;               // ダメージ式で丈夫さに掛ける係数
const RPG_GUARD_MULT = 0.5;            // 「防御」を選んだターンの被ダメージ倍率
const RPG_START_GUTS_RATE = 0.5;       // 戦闘開始時のガッツ(最大値に対する割合)
const RPG_TURN_GUTS_RATE = 0.2;        // ターン開始時に回復するガッツ(最大値に対する割合)
const RPG_SKILL_GUTS_DIVISOR = 10;     // 固有技の消費ガッツ(本編の baseGuts を割る)
const RPG_ENEMY_SKILL_CHANCE = 0.35;   // 敵が固有技を撃てるときに実際に撃つ確率
const RPG_DAMAGE_VARIANCE = 0.05;      // ダメージ乱数をONにしたときの振れ幅(±)
// 行動値 = 素早さ × (0.9〜1.1)。素早い者ほど先に動きやすいが、
// 素早さが1違うだけで永久に先手、という状態にはならない
const RPG_ACTION_VARIANCE = 0.1;
// 回避率(%) = 3 + (防御側の素早さ - 攻撃側の素早さ) × 0.3。1%〜20%に収める
const RPG_EVADE_BASE = 3;
const RPG_EVADE_PER_SPEED = 0.3;
const RPG_EVADE_MIN = 1;
const RPG_EVADE_MAX = 20;
// クリティカル率(%) = 3 + (攻撃側の運 - 防御側の運) × 0.2。1%〜15%に収める
const RPG_CRIT_BASE = 3;
const RPG_CRIT_PER_LUCK = 0.2;
const RPG_CRIT_MIN = 1;
const RPG_CRIT_MAX = 15;
const RPG_CRIT_MULT = 1.5;             // クリティカル時の最終ダメージ倍率

// 敵の色違いタイプ。画像は正式ベースモンのものをそのまま使い、見た目はCSSフィルタだけで変える
// (画像ファイルの加工・複製・base64化はしない)。補正値と配分の周期はここだけを直せばよい。
//   cycle : 配分ポイントを上から順に振っていく周期。同じLv・同じ種なら必ず同じ能力になる
//   mult  : 配分後に掛ける軽い補正。低Lvでも見た目の性格差が出るようにするためのデバッグ用
const RPG_ENEMY_TYPES = Object.freeze([
  { id:'normal', label:'通常種', short:'通常', accent:'#94a3b8', filter:'none',
    cycle:Object.freeze(['hp','atk','def','guts','speed','luck']),
    mult:Object.freeze({ hp:1, atk:1, def:1, guts:1, speed:1, luck:1 }) },
  { id:'red', label:'赤（攻撃型）', short:'赤', accent:'#f87171',
    filter:'sepia(1) saturate(6) hue-rotate(-25deg) brightness(0.95)',
    cycle:Object.freeze(['atk','atk','hp','guts','speed','def','luck']),
    mult:Object.freeze({ hp:0.95, atk:1.15, def:0.90, guts:1, speed:1, luck:1 }) },
  { id:'blue', label:'青（耐久型）', short:'青', accent:'#60a5fa',
    filter:'sepia(1) saturate(5) hue-rotate(175deg) brightness(1.02)',
    cycle:Object.freeze(['def','hp','def','hp','atk','speed','guts','luck']),
    mult:Object.freeze({ hp:1.15, atk:0.90, def:1.15, guts:1, speed:1, luck:1 }) },
]);
const rpgEnemyType = (id) => RPG_ENEMY_TYPES.find(t => t.id === id) || RPG_ENEMY_TYPES[0];

const rpgClampLevel = (level) => {
  const n = Math.floor(Number(level));
  return Number.isFinite(n) ? Math.max(1, Math.min(RPG_MAX_LEVEL, n)) : 1;
};
// 現在のベース能力をRPG向けの小さな数値へ落とす。最低1は必ず残す
const rpgScaleStat = (value) => Math.max(1, Math.round((Number(value) || 0) / RPG_STAT_DIVISOR));
// ベースモン定義(ALL_PLAYER_MONSTERS の1件)から、そのままRPGのLv1能力を作る。
// RPG用に同じ数値を別表として書き写さないための唯一の入口。
const rpgBaseStatsOf = (mon) => ({
  hp: rpgScaleStat(mon?.baseHp), atk: rpgScaleStat(mon?.baseAtk),
  def: rpgScaleStat(mon?.baseDef), guts: rpgScaleStat(mon?.baseGuts),
  // 素早さ・運は本編に基礎値が無いので、この試作の共通初期値を使う
  speed: RPG_BASE_SPEED, luck: RPG_BASE_LUCK,
});
// そのLvで使える配分ポイント(Lv1は0P、Lv50は49P)
const rpgPointsForLevel = (level) => Math.max(0, rpgClampLevel(level) - 1) * RPG_POINTS_PER_LEVEL;
const rpgEmptyAlloc = () => RPG_STAT_KEYS.reduce((out, key) => { out[key] = 0; return out; }, {});
const rpgAllocTotal = (alloc) => RPG_STAT_KEYS.reduce((sum, key) => sum + Math.max(0, Math.floor(Number(alloc?.[key]) || 0)), 0);
// Lvを下げたときなど、使用可能ポイントを超えた配分を上から順に切り詰める
const rpgNormalizeAlloc = (alloc, level) => {
  const limit = rpgPointsForLevel(level);
  const next = rpgEmptyAlloc();
  let used = 0;
  for (const key of RPG_STAT_KEYS) {
    const want = Math.max(0, Math.floor(Number(alloc?.[key]) || 0));
    const give = Math.max(0, Math.min(want, limit - used));
    next[key] = give; used += give;
  }
  return next;
};
// 基礎能力 + 配分ポイント → 実際に戦う能力
const rpgApplyAlloc = (base, alloc) => RPG_STAT_KEYS.reduce((out, key) => {
  out[key] = Math.max(1, Math.round((base?.[key] || 0) + (Math.max(0, Math.floor(Number(alloc?.[key]) || 0)) * RPG_GAIN_PER_POINT[key])));
  return out;
}, {});
// 敵の自動配分。乱数を使わないので、同じLv・同じ色タイプなら毎回まったく同じ能力になる
const rpgEnemyAlloc = (typeId, level) => {
  const cycle = rpgEnemyType(typeId).cycle;
  const alloc = rpgEmptyAlloc();
  const points = rpgPointsForLevel(level);
  for (let i = 0; i < points; i++) alloc[cycle[i % cycle.length]] += 1;
  return alloc;
};
const rpgEnemyStats = (mon, typeId, level) => {
  const type = rpgEnemyType(typeId);
  const grown = rpgApplyAlloc(rpgBaseStatsOf(mon), rpgEnemyAlloc(typeId, level));
  return RPG_STAT_KEYS.reduce((out, key) => { out[key] = Math.max(1, Math.round(grown[key] * type.mult[key])); return out; }, {});
};
// 固有技のRPG用消費ガッツ。本編の baseGuts をそのまま持ってきて1/10にする
const rpgSkillCost = (unique) => Math.max(1, Math.round((Number(unique?.baseGuts) || 0) / RPG_SKILL_GUTS_DIVISOR));
// そのモンスターの固有技(名前・倍率・消費)を本編定義から取り出す。無ければ null
const rpgSkillOf = (mon) => {
  const unique = mon?.unique;
  if (!unique || !Number.isFinite(Number(unique.baseMult))) return null;
  return { name: unique.name, mult: Number(unique.baseMult), cost: rpgSkillCost(unique) };
};

// ★RPG専用のダメージ計算。味方→敵も敵→味方もここだけを通す(画面ごとに式を複製しない)。
// 通常バトル(getDmg / getIncomingDamageBeforeTurnReduction)とは完全に別物で、互いに影響しない。
//
//   基本ダメージ = ちから × 技倍率 × 100 ÷ (100 + 丈夫さ × 4)
//
// 乱数(variance)は0.95〜1.05の範囲で、デバッグ設定でOFFにすると必ず1.0になる。
// 防御中は0.5、クリティカルなら1.5を掛け、最後に四捨五入して最低1ダメージにする
// (先に丸めてから半分にすると「最低1」が0.5になってしまうため、丸めは最後に1回だけ行う)。
const rpgDamage = ({ atk, mult = RPG_NORMAL_ATTACK_MULT, def, guarding = false, variance = 1, critical = false }) => {
  const power = Math.max(0, Number(atk) || 0) * (Number(mult) || 0);
  const resist = 100 + Math.max(0, Number(def) || 0) * RPG_DEF_COEFF;
  let raw = power * 100 / resist;
  raw *= Number.isFinite(variance) && variance > 0 ? variance : 1;
  if (guarding) raw *= RPG_GUARD_MULT;
  if (critical) raw *= RPG_CRIT_MULT;
  return Math.max(1, Math.round(raw));
};
// ★乱数はすべて外から差し込めるようにしてある(rng)。既定は Math.random で、
// 検査ツールは決まった値を返す関数を渡して「たまたま当たった／外れた」を無くす。
const rpgDefaultRng = () => Math.random();
// 乱数ONのときだけ0.95〜1.05を返す。OFFなら必ず1.0(バランス確認をしやすくするため既定はOFF)
const rpgVarianceRoll = (enabled, rng = rpgDefaultRng) => enabled ? 1 - RPG_DAMAGE_VARIANCE + rng() * RPG_DAMAGE_VARIANCE * 2 : 1;
const rpgStartGuts = (maxGuts) => Math.min(maxGuts, Math.ceil(Math.max(0, maxGuts) * RPG_START_GUTS_RATE));
const rpgTurnGutsRegen = (maxGuts) => Math.max(1, Math.round(Math.max(0, maxGuts) * RPG_TURN_GUTS_RATE));

const rpgClamp = (value, min, max) => Math.min(max, Math.max(min, value));
// 行動値。素早さが高い者ほど大きくなるが、毎ターン0.9〜1.1の幅で少しだけ前後する
const rpgActionValue = (speed, roll = rpgDefaultRng()) =>
  Math.max(0, Number(speed) || 0) * (1 - RPG_ACTION_VARIANCE + rpgClamp(Number(roll) || 0, 0, 1) * RPG_ACTION_VARIANCE * 2);
// 回避率(%)。防御側が速いほど上がる。攻撃側が大幅に速くても最低1%は残る
const rpgEvadeRate = (attacker, defender) => rpgClamp(
  RPG_EVADE_BASE + ((Number(defender?.speed) || 0) - (Number(attacker?.speed) || 0)) * RPG_EVADE_PER_SPEED,
  RPG_EVADE_MIN, RPG_EVADE_MAX);
// クリティカル率(%)。攻撃側の運が高いほど上がる
const rpgCritRate = (attacker, defender) => rpgClamp(
  RPG_CRIT_BASE + ((Number(attacker?.luck) || 0) - (Number(defender?.luck) || 0)) * RPG_CRIT_PER_LUCK,
  RPG_CRIT_MIN, RPG_CRIT_MAX);
// 「率(%)」の抽選。roll は 0以上1未満。味方も敵もこの1つを通す
const rpgRollPercent = (ratePercent, roll) => (Number(roll) || 0) * 100 < (Number(ratePercent) || 0);

// ---------- RPG戦闘の進行(コマンド式ターン制) ----------
// 1ターンの流れ:
//   ① 生存している味方全員のコマンド(と対象)を順番に入力する
//   ② 敵の行動内容と対象を決める
//   ③ 味方・敵をまとめて行動値(素早さ×0.9〜1.1)で並べ、行動順を確定する
//   ④ 行動順に1体ずつ処理する
//   ⑤ 全員終わったら次のターンへ(防御解除・ガッツ回復)
// 味方だけ・敵だけをまとめて動かす固定順ではないので、素早い敵が味方より先に動くこともある。
// 状態はすべてこのオブジェクトの中だけにあり、保存も送信も一切しない。
//
// 使えるベースモンの一覧。正式にプレイできる種だけを自動で拾うので、
// モンスターを追加してもRPGデバッグ側の更新漏れが起きない。
// デバッグ専用個体(debugOnly)とマスモン(個体)は入らない。
const rpgMonsterList = () => Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon && mon.id && !mon.debugOnly);
const rpgMonsterById = (id) => rpgMonsterList().find(mon => mon.id === id) || rpgMonsterList()[0] || null;

const rpgEmptyRecord = () => ({ dealt:0, taken:0, attacks:0, skills:0, gutsSpent:0, crits:0, evaded:0 });
const rpgMakeUnit = (mon, level, stats, extra = {}) => ({
  monId: mon.id, name: mon.name, emoji: mon.emoji,
  imgUrl: mon.imgUrl, iconUrl: mon.iconUrl,
  level: rpgClampLevel(level),
  maxHp: stats.hp, maxGuts: stats.guts, atk: stats.atk, def: stats.def,
  speed: stats.speed, luck: stats.luck,
  hp: stats.hp, guts: rpgStartGuts(stats.guts),
  guarding: false, alive: true,
  skill: rpgSkillOf(mon),
  record: rpgEmptyRecord(),
  ...extra,
});
// セットアップ画面の1枠 → 実際に戦うユニット。ここが味方・敵で共通の入口になる
const rpgBuildAlly = (slot) => {
  const mon = rpgMonsterById(slot?.monId);
  if (!mon) return null;
  const level = rpgClampLevel(slot?.level);
  const stats = rpgApplyAlloc(rpgBaseStatsOf(mon), rpgNormalizeAlloc(slot?.alloc, level));
  return rpgMakeUnit(mon, level, stats, { side:'ally' });
};
const rpgBuildEnemy = (slot) => {
  const mon = rpgMonsterById(slot?.monId);
  if (!mon) return null;
  const type = rpgEnemyType(slot?.typeId);
  const level = rpgClampLevel(slot?.level);
  return rpgMakeUnit(mon, level, rpgEnemyStats(mon, type.id, level), {
    side:'enemy', typeId:type.id,
    name: type.id === 'normal' ? mon.name : `${type.short}${mon.name}`,
  });
};
// ログは最新から積む。画面では先頭数件だけ出すのでスマホでも溢れない
const rpgPushLog = (battle, text) => { battle.log = [text, ...battle.log].slice(0, 40); };
const rpgAliveIndexes = (units) => units.map((u, i) => (u.alive ? i : -1)).filter(i => i >= 0);
const rpgSideUnits = (battle, side) => (side === 'ally' ? battle.allies : battle.enemies);
// 対象を選ばずに撃ったときの相手。生きている敵のうちライフがいちばん低い1体を狙う。
// 同じライフなら並び順が早いほう。乱数を使わないので、同じ盤面なら毎回同じ相手になる
const rpgLowestHpEnemy = (battle) => {
  let pick = -1;
  (battle.enemies || []).forEach((unit, index) => {
    if (!unit || !unit.alive) return;
    if (pick < 0 || unit.hp < battle.enemies[pick].hp) pick = index;
  });
  return pick;
};
const rpgUnitAt = (battle, side, index) => rpgSideUnits(battle, side)[index];
// 行動順のタイブレーク。行動値が同じでも結果がぶれないよう、
// 素早さ → 味方が先 → 並び順 の順で必ず同じ答えになるようにする
const rpgOrderTieBreak = (battle, a, b) =>
  (rpgUnitAt(battle, b.side, b.index)?.speed || 0) - (rpgUnitAt(battle, a.side, a.index)?.speed || 0)
  || (a.side === b.side ? a.index - b.index : (a.side === 'ally' ? -1 : 1));
// コマンド入力中に見せる「素早さ順の予測」。乱数を使わないので毎回同じ並びになる
const rpgSpeedOrder = (battle) => {
  const entries = [];
  battle.allies.forEach((u, index) => { if (u.alive) entries.push({ side:'ally', index }); });
  battle.enemies.forEach((u, index) => { if (u.alive) entries.push({ side:'enemy', index }); });
  return entries.sort((a, b) => rpgOrderTieBreak(battle, a, b));
};
const rpgCheckOutcome = (battle) => {
  if (!battle.enemies.some(u => u.alive)) { battle.outcome = 'win'; battle.phase = 'result'; rpgPushLog(battle, '敵を全滅させた！'); return true; }
  if (!battle.allies.some(u => u.alive)) { battle.outcome = 'lose'; battle.phase = 'result'; rpgPushLog(battle, 'パーティは全滅した…'); return true; }
  return false;
};
// コマンド入力の受け皿を作り直して、最初に入力する味方へ進める
const rpgBeginInput = (battle) => {
  battle.inputs = {};
  battle.plan = [];
  battle.planStep = 0;
  battle.pendingCommand = null;
  const alive = rpgAliveIndexes(battle.allies);
  battle.inputIndex = alive.length ? alive[0] : -1;
  battle.phase = alive.length ? 'command' : 'result';
};
// 決めたコマンドをやり直す。コマンド入力中に、すでに決めた味方まで戻る。
// その味方の入力だけを消し、ほかの味方が決めた内容・ライフ・ガッツには触らない。
// 行動の実行が始まったあと(resolve)は戻せない
const rpgUndoCommand = (battle, index) => {
  const next = JSON.parse(JSON.stringify(battle));
  if (next.phase !== 'command') return next;
  const unit = next.allies[index];
  if (!unit || !unit.alive) return next;
  if (!next.inputs || !next.inputs[index]) return next;
  delete next.inputs[index];
  next.inputIndex = index;
  next.pendingCommand = null;
  return next;
};
// やり直せる味方かどうか(画面のボタンを押せるかの判定にも使う)
const rpgCanUndo = (battle, index) => !!(battle && battle.phase === 'command'
  && battle.allies[index] && battle.allies[index].alive
  && battle.inputs && battle.inputs[index]);
const RPG_COMMAND_LABELS = Object.freeze({ attack:'こうげき', skill:'技', guard:'防御' });

const rpgCreateBattle = (partySlots, enemySlots) => {
  const allies = (partySlots || []).map(rpgBuildAlly).filter(Boolean);
  const enemies = (enemySlots || []).map(rpgBuildEnemy).filter(Boolean);
  const battle = {
    turn: 1, phase: 'command', inputIndex: 0, pendingCommand: null,
    inputs: {}, plan: [], planStep: 0,
    allies, enemies, log: ['戦闘開始！'], outcome: null,
  };
  if (!allies.length || !enemies.length) { battle.phase = 'result'; battle.outcome = 'lose'; return battle; }
  rpgBeginInput(battle);
  return battle;
};

// ★1回の攻撃を解決する。味方→敵も敵→味方もここだけを通る。
// 回避判定 → クリティカル判定 → ダメージ の順で、回避したらクリティカル判定は行わない。
const rpgResolveAttack = (battle, attacker, defender, mult, label, varianceOn, rng) => {
  rpgPushLog(battle, `${attacker.name}の${label}！`);
  if (rpgRollPercent(rpgEvadeRate(attacker, defender), rng())) {
    defender.record.evaded += 1;
    rpgPushLog(battle, `${defender.name}は攻撃をかわした！`);
    return 0;
  }
  const critical = rpgRollPercent(rpgCritRate(attacker, defender), rng());
  const damage = rpgDamage({
    atk: attacker.atk, mult, def: defender.def,
    guarding: defender.guarding, variance: rpgVarianceRoll(varianceOn, rng), critical,
  });
  defender.hp = Math.max(0, defender.hp - damage);
  attacker.record.dealt += damage;
  defender.record.taken += damage;
  if (critical) { attacker.record.crits += 1; rpgPushLog(battle, '会心の一撃！'); }
  rpgPushLog(battle, `${defender.name}に${damage}ダメージ`);
  if (defender.hp <= 0 && defender.alive) { defender.alive = false; rpgPushLog(battle, `${defender.name}は戦闘不能！`); }
  return damage;
};

// 敵1体の行動内容と対象を決める。AIは「撃てるなら一定確率で固有技、それ以外は通常攻撃」だけ
const rpgDecideEnemyAction = (battle, enemy, rng) => {
  const targets = rpgAliveIndexes(battle.allies);
  if (!targets.length) return null;
  // 乱数は必ず同じ回数だけ引く(条件で引いたり引かなかったりすると、
  // 乱数を差し込んだ検査で結果が再現できなくなる)
  const targetRoll = rng();
  const skillRoll = rng();
  const targetIndex = targets[Math.min(targets.length - 1, Math.floor(targetRoll * targets.length))];
  const canSkill = !!enemy.skill && enemy.guts >= enemy.skill.cost;
  return { command: canSkill && skillRoll < RPG_ENEMY_SKILL_CHANCE ? 'skill' : 'attack', targetSide:'ally', targetIndex };
};
// 味方全員の入力がそろったら、敵の行動を決めて行動順を確定する
const rpgBuildTurn = (battle, rng) => {
  const entries = [];
  battle.allies.forEach((unit, index) => {
    if (!unit.alive) return;
    const input = battle.inputs[index];
    if (input) entries.push({ side:'ally', index, ...input });
  });
  battle.enemies.forEach((unit, index) => {
    if (!unit.alive) return;
    const decided = rpgDecideEnemyAction(battle, unit, rng);
    if (decided) entries.push({ side:'enemy', index, ...decided });
  });
  entries.forEach(entry => { entry.value = rpgActionValue(rpgUnitAt(battle, entry.side, entry.index)?.speed, rng()); });
  entries.sort((a, b) => b.value - a.value || rpgOrderTieBreak(battle, a, b));
  battle.plan = entries;
  battle.planStep = 0;
  battle.phase = 'resolve';
};
// 味方1体ぶんのコマンドを記録する。全員そろったら行動順を確定して実行フェーズへ移る
const rpgSetCommand = (battle, command, targetIndex, rng = rpgDefaultRng) => {
  const next = JSON.parse(JSON.stringify(battle));
  if (next.phase !== 'command' && next.phase !== 'target') return next;
  const index = next.inputIndex;
  const actor = next.allies[index];
  if (!actor || !actor.alive) return next;
  if (command === 'skill' && (!actor.skill || actor.guts < actor.skill.cost)) return next;
  if (command === 'guard') next.inputs[index] = { command:'guard', targetSide:null, targetIndex:-1 };
  else {
    const target = next.enemies[targetIndex];
    if (!target || !target.alive) return next;
    next.inputs[index] = { command, targetSide:'enemy', targetIndex };
  }
  next.pendingCommand = null;
  const remaining = next.allies.findIndex((unit, i) => unit.alive && i > index && !next.inputs[i]);
  if (remaining >= 0) { next.inputIndex = remaining; next.phase = 'command'; return next; }
  rpgBuildTurn(next, rng);
  return next;
};
// ターンの終わり。防御を解除し、生存者のガッツを1ターンにつき1回だけ回復する
const rpgEndTurn = (battle) => {
  battle.allies.forEach(u => { u.guarding = false; });
  battle.enemies.forEach(u => { u.guarding = false; });
  battle.turn += 1;
  [...battle.allies, ...battle.enemies].forEach(u => {
    if (u.alive) u.guts = Math.min(u.maxGuts, u.guts + rpgTurnGutsRegen(u.maxGuts));
  });
  rpgPushLog(battle, `--- TURN ${battle.turn} ---`);
  rpgBeginInput(battle);
};
// 行動順の1体ぶんを処理する。画面はこれを間隔をあけて呼ぶ
const rpgResolveStep = (battle, varianceOn, rng = rpgDefaultRng) => {
  const next = JSON.parse(JSON.stringify(battle));
  if (next.phase !== 'resolve') return next;
  const entry = next.plan[next.planStep];
  next.planStep += 1;
  const actor = entry ? rpgUnitAt(next, entry.side, entry.index) : null;
  // 倒されたモンスターは、入力済みでも行動しない
  if (entry && actor && actor.alive) {
    if (entry.command === 'guard') {
      actor.guarding = true;
      rpgPushLog(next, `${actor.name}は身を守っている`);
    } else {
      const targets = rpgSideUnits(next, entry.targetSide);
      let targetIndex = entry.targetIndex;
      // 自分より前の行動で対象が倒れていたら、生きている相手へ狙いを移す
      if (!targets[targetIndex] || !targets[targetIndex].alive) {
        const alive = rpgAliveIndexes(targets);
        targetIndex = alive.length ? alive[0] : -1;
        if (targetIndex >= 0) rpgPushLog(next, `${actor.name}は${targets[targetIndex].name}へ狙いを変えた`);
      }
      if (targetIndex >= 0) {
        const target = targets[targetIndex];
        const useSkill = entry.command === 'skill' && actor.skill && actor.guts >= actor.skill.cost;
        if (useSkill) {
          // 消費ガッツは撃つ前に払う。回避されて外れても戻さない
          actor.guts -= actor.skill.cost;
          actor.record.gutsSpent += actor.skill.cost;
          actor.record.skills += 1;
          rpgResolveAttack(next, actor, target, actor.skill.mult, actor.skill.name, varianceOn, rng);
        } else {
          actor.record.attacks += 1;
          rpgResolveAttack(next, actor, target, RPG_NORMAL_ATTACK_MULT, 'こうげき', varianceOn, rng);
        }
      }
    }
  }
  if (rpgCheckOutcome(next)) return next;
  if (next.planStep >= next.plan.length) rpgEndTurn(next);
  return next;
};

// ---------- RPG戦闘の攻撃モーション(表示だけ) ----------
// 通常バトルのモーションは素のCSS @keyframes なので、そのまま流用できる。
// ただし通常バトルは大きな立ち絵向けに作られていて移動量が大きい(味方-180px・敵+90px)。
// RPGデバッグ画面は味方が38pxの顔アイコン・敵が80〜210pxの丸枠なので、
// 同じ動きを小さくした専用の keyframes を当てる(動きの種類は通常バトルと同じ考え方)。
//
// どのモーションを使うかは、通常バトルとまったく同じ ALL_PLAYER_MONSTERS[].atkMotion で決める。
// RPG用にモーションのデータを別に持たないので、モンスターを足しても更新漏れが起きない。
const RPG_MOTION_BY_ATK = Object.freeze({ default:'Attack', floatStab:'Float', waterBurst:'Water', zanCombo:'Dash', eikiSakuraCombo:'Dash', pandoraDualThunder:'Thunder' });
// DEBUGと本番バトルが同じatkMotion名・同じkeyframesを通るための共通入口。
const attackMotionAnimation = (anim) => {
  if (!anim) return undefined;
  // パンドラは枠全体を動かさず、PandoraDualThunder 内の実画像2枚を動かす。
  if (anim.motion==='pandoraDualThunder') return undefined;
  // エイキはザンと同じ高速斬撃の動き(zanComboDash)をそのまま使う。
  // 桜の花びらは枠を動かすのではなく、下の SakuraPetals を攻撃中だけ重ねて出す
  if (anim.zanCombo) return 'zanComboDash 320ms ease-out forwards';
  if (anim.charge) return 'specialCharge 650ms ease-out forwards';
  if (anim.charge===false) return anim.motion==='floatStab'?'floatStabLunge 700ms ease-in forwards':(anim.motion==='waterBurst'?'waterBurstLunge 520ms ease-out forwards':'specialLunge 500ms ease-in forwards');
  return anim.motion==='floatStab'?'floatStabAttack 650ms ease-in forwards':(anim.motion==='waterBurst'?'waterBurstAttack 520ms ease-out forwards':'attackFly 450ms ease-in forwards');
};
const rpgMotionName = (side, monId, isSkill) => {
  const prefix = side === 'ally' ? 'rpgAlly' : 'rpgFoe';
  if (isSkill) return `${prefix}Special`;
  const kind = RPG_MOTION_BY_ATK[ALL_PLAYER_MONSTERS[monId]?.atkMotion] || 'Attack';
  return `${prefix}${kind}`;
};
// 固有技は少し長め。連撃(ザン)は短く刻む
const rpgMotionMs = (name) => name.endsWith('Special') ? 460 : (name.endsWith('Dash') ? 360 : 420);

// 画面側で「1体ぶん処理が進んだ」を見分けるための判定(表示だけに使う)。
// rpgResolveStep() の出口は3つあり、抜け方によって phase と planStep の変わり方が違う。
//   ・まだ続く          → phase:'resolve'、planStep が1つ進む
//   ・決着がついた      → phase:'result'、planStep はそのまま
//   ・そのターンの最後  → phase:'command'、planStep は0へ戻り turn が1つ進む
// 以前は1つめしか見ていなかったため、ターンの最後の行動と決着の一撃だけ
// 技名の帯・ダメージの数字・攻撃モーションが丸ごと出ていなかった。
const rpgSteppedOnce = (prev, next) => {
  if (!prev || !next || prev.phase !== 'resolve') return false;
  if (next.phase === 'resolve') return next.planStep === prev.planStep + 1;
  if (next.phase === 'result') return next.turn === prev.turn;
  if (next.phase === 'command') return next.turn === prev.turn + 1;
  return false;
};

// ---------- RPG戦闘の技の演出(表示だけ) ----------
// 技は通常こうげきより重い行動なので、技名の帯・画面の閃光・軽い揺れ・対象への衝撃波を出す。
// 演出が出ている間は次の行動を少し待つ(戦闘の計算・順番・ダメージには一切関係しない)。
const RPG_SPECIAL_MS = 940;   // 技の演出が出ている長さ
const RPG_STEP_MS = 620;      // ふだんの「1体ぶん処理する」間隔
const RPG_SPECIAL_STEP_MS = 1000; // 技を撃った直後だけ、演出を見せるために長くとる間隔
// 決着がついた瞬間に結果画面へ飛ばすと、最後の一撃のダメージも技の演出も見えないまま終わる。
// いちばん長い演出(技の帯940ms・ダメージの数字900ms)より少しだけ長く待ってから移る
const RPG_FINISH_MS = 1100;
// 直前に処理した行動が技だったかどうかだけを見る。plan は読むだけで書き換えない
const rpgStepDelay = (battle) => {
  const last = battle && Array.isArray(battle.plan) ? battle.plan[battle.planStep - 1] : null;
  return last && last.command === 'skill' ? RPG_SPECIAL_STEP_MS : RPG_STEP_MS;
};

// Storage helpers — window.storage は元々の別プラットフォーム向けAPIで、
// GitHub Pages上には存在しない。実ブラウザのlocalStorageを使い、
// それも使えない場合のみメモリ内フォールバック(リロードで消える)にする。
// 本番バトルとDEBUGで共用するパンドラの分身描画。中央像と左右2枚は同じ画像要素を
// 複製し、雷も各分身体の内側に置くことで発射位置が中央1点にならないようにする。
// エイキの攻撃中だけ重ねる桜の花びら。
// 常時アニメーションにはせず、攻撃モーションが出ているあいだ(isAnimating)だけ描く。
// スマホの負荷を増やしすぎないよう、要素は固定12枚・CSSアニメーション1本だけにして、
// 画像は使わずCSSの小片を transform / opacity だけで流す。枠の高速斬撃はザンと同じ
// zanComboDash が担当し、花びらだけ斬撃方向へ遅れて散らして短い余韻を作る。
const EIKI_SAKURA_PETALS = Object.freeze([
  { left:'2%',  top:'66%', delay:'0ms',  flowX:'68px', flowY:'-38px', burstX:'86px',  burstY:'-54px', trailX:'112px', trailY:'-68px', spin:'310deg',  size:'7px'  },
  { left:'8%',  top:'54%', delay:'18ms', flowX:'62px', flowY:'-24px', burstX:'76px',  burstY:'-42px', trailX:'104px', trailY:'-52px', spin:'-280deg', size:'9px'  },
  { left:'14%', top:'74%', delay:'36ms', flowX:'74px', flowY:'-44px', burstX:'96px',  burstY:'-30px', trailX:'122px', trailY:'-42px', spin:'360deg',  size:'6px'  },
  { left:'22%', top:'42%', delay:'8ms',  flowX:'70px', flowY:'-18px', burstX:'92px',  burstY:'-34px', trailX:'118px', trailY:'-48px', spin:'-330deg', size:'8px'  },
  { left:'30%', top:'64%', delay:'54ms', flowX:'64px', flowY:'-34px', burstX:'82px',  burstY:'-60px', trailX:'108px', trailY:'-76px', spin:'390deg',  size:'10px' },
  { left:'38%', top:'36%', delay:'26ms', flowX:'72px', flowY:'-20px', burstX:'98px',  burstY:'-10px', trailX:'124px', trailY:'-24px', spin:'-300deg', size:'7px'  },
  { left:'46%', top:'70%', delay:'70ms', flowX:'66px', flowY:'-42px', burstX:'88px',  burstY:'-66px', trailX:'116px', trailY:'-80px', spin:'340deg',  size:'8px'  },
  { left:'54%', top:'48%', delay:'12ms', flowX:'58px', flowY:'-26px', burstX:'80px',  burstY:'-12px', trailX:'106px', trailY:'-28px', spin:'-370deg', size:'9px'  },
  { left:'62%', top:'62%', delay:'44ms', flowX:'70px', flowY:'-36px', burstX:'94px',  burstY:'-48px', trailX:'120px', trailY:'-62px', spin:'320deg',  size:'6px'  },
  { left:'70%', top:'34%', delay:'62ms', flowX:'60px', flowY:'-16px', burstX:'78px',  burstY:'-38px', trailX:'102px', trailY:'-50px', spin:'-350deg', size:'8px'  },
  { left:'78%', top:'72%', delay:'22ms', flowX:'66px', flowY:'-40px', burstX:'92px',  burstY:'-22px', trailX:'116px', trailY:'-38px', spin:'380deg',  size:'9px'  },
  { left:'86%', top:'50%', delay:'48ms', flowX:'56px', flowY:'-28px', burstX:'74px',  burstY:'-50px', trailX:'98px',  trailY:'-64px', spin:'-320deg', size:'7px'  },
]);
const EikiSakuraPetals = () => (
  <span className="eiki-sakura" aria-hidden="true">
    {EIKI_SAKURA_PETALS.map((petal, index) => (
      <span key={index} className="eiki-sakura__petal"
        style={{ left:petal.left, top:petal.top, width:petal.size, height:`${parseFloat(petal.size)*1.45}px`, animationDelay:petal.delay,
          '--eiki-petal-flow-x':petal.flowX, '--eiki-petal-flow-y':petal.flowY,
          '--eiki-petal-burst-x':petal.burstX, '--eiki-petal-burst-y':petal.burstY,
          '--eiki-petal-trail-x':petal.trailX, '--eiki-petal-trail-y':petal.trailY,
          '--eiki-petal-spin-mid':`${parseFloat(petal.spin)*.55}deg`,
          '--eiki-petal-spin-burst':`${parseFloat(petal.spin)*.8}deg`,
          '--eiki-petal-spin':petal.spin }}/>
    ))}
  </span>
);
const PandoraDualThunder = ({image, compact=false}) => (
  <span className={`pandora-dual-thunder${compact?' pandora-dual-thunder--compact':''}`} aria-hidden="true">
    <span className="pandora-dual-center">{React.cloneElement(image,{alt:''})}</span>
    {['left','right'].map(side=><span key={side} className={`pandora-dual-clone pandora-dual-clone--${side}`}>
      {React.cloneElement(image,{alt:''})}
      <i className="pandora-dual-bolt"/>
    </span>)}
  </span>
);

const _memStore = {};
const hasWinStorage = () => typeof window !== 'undefined' && !!window.storage;
const hasLocalStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const k = '__mh_ls_test__'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k);
    return true;
  } catch { return false; }
};

const storeGet = async (key, def, shared=false) => {
  try {
    if (hasWinStorage()) {
      const r = await window.storage.get(key, shared);
      return r && r.value !== undefined && r.value !== null ? JSON.parse(r.value) : def;
    }
  } catch { /* fall through */ }
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : def;
    }
  } catch { /* fall through to memory */ }
  return key in _memStore ? _memStore[key] : def;
};
// 初回プレイのプレビュー中だけ、保存を丸ごと止めるための鍵。★重要
// 画面ごとに「プレビューなら保存しない」を書き分ける方式だと、必ず書き忘れが出る
// (助手の選択・きき加入フラグ・村案内の既読・名前・アイコンは、それぞれ別の場所で保存している)。
// 保存の入口は storeSet ひとつなので、ここで止めれば経路を問わず取りこぼしがない。
// 読み込み(storeGet)は止めない。プレビュー中も本物のデータを見て画面を組み立てる。
let _storageWriteBlocked = false;
const setStorageWriteBlocked = (blocked) => { _storageWriteBlocked = !!blocked; };
const isStorageWriteBlocked = () => _storageWriteBlocked;
const storeSet = async (key, val, shared=false) => {
  // メモリの控えにも書かない。ここへ残すと、プレビューを終えたあとも古い値が読めてしまう
  if (_storageWriteBlocked) return;
  _memStore[key] = val;
  try {
    if (hasWinStorage()) { await window.storage.set(key, JSON.stringify(val), shared); return; }
  } catch {}
  try {
    if (hasLocalStorage()) { window.localStorage.setItem(key, JSON.stringify(val)); }
  } catch {}
};
const saveRhythmSettings = async value => {
  const normalized=normalizeRhythmSettings(value); await storeSet(RHYTHM_SETTINGS_KEY,normalized,false); return normalized;
};
// モンスターノーツ用のマスモン設定は既存の音ゲー設定・BESTへ混ぜず、専用キーへ分けて保存する。
// 保存するのは「マスモンの個体IDの並び」だけで、手元にいるかどうかの確認はここでは行わない
// (マスモン一覧を読む前に保存し直しても、設定が消えないようにするため)。
const saveRhythmMonsterSlots = async value => {
  const normalized=sanitizeRhythmMonsterSlotIds(value); await storeSet(RHYTHM_MONSTER_SLOT_KEY,normalized,false); return normalized;
};
const saveRhythmBestRecord = async (records,songId,difficultyId,value) => {
  if(!RHYTHM_SONGS.some(song=>song.songId===songId)||!RHYTHM_DIFFICULTIES.some(item=>item.id===difficultyId)) return normalizeRhythmBestRecords(records);
  const normalized=normalizeRhythmBestRecords(records);
  normalized[songId][difficultyId]=normalizeRhythmBestRecord(value);
  await storeSet(RHYTHM_BEST_RECORDS_KEY,normalized,false); return normalized;
};
const storeList = async (prefix, shared=false) => {
  try {
    if (hasWinStorage()) {
      const r = await window.storage.list(prefix, shared);
      return (r && r.keys) ? r.keys : [];
    }
  } catch {}
  try {
    if (hasLocalStorage()) {
      const keys = [];
      for (let i=0;i<window.localStorage.length;i++){ const k=window.localStorage.key(i); if(k&&k.startsWith(prefix)) keys.push(k); }
      return keys;
    }
  } catch {}
  return Object.keys(_memStore).filter(k => k.startsWith(prefix));
};

// ===== Supabase shared ranking (REST API via fetch) =====
const SUPABASE_URL = 'https://zrzevudkbgtxlbvmuziy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_D4WJBXJ1xE97amndZarEPw_0M4LAwOp';
// sb_publishable_* は Data API の apikey 用であり、JWT ではない。Bearer にも設定すると
// PostgREST が publishable key を JWT として検証して 401 (Invalid JWT) にするため送らない。
// ログには秘密値そのものを出さず、公開設定を読み込めたことだけを記録する。
const SB_HEADERS = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };

// 画面表示名とDB識別子を分離し、ランキング通信では必ず既存の難易度keyへ正規化する。
// プロのランキングはチャレンジと混ざらないよう、難易度キーの先頭へ Pro を付けて別枠にする。
// 既存のチャレンジの記録(difficulty='Hard' など)はそのままで、行の書き換えも変換も行わない。
// Supabaseの列(スキーマ)は変えず、difficulty へ入れる値だけで分ける
const PRO_RANKING_PREFIX = 'Pro';
// 極限チャレンジも同じやり方。難易度の並びが通常と別なので、極限の段階IDへ接頭辞を付ける
// (例: ExtremeEXTREME)。チャレンジ・プロの行は読みも書きもしない
const EXTREME_RANKING_PREFIX = 'Extreme';
const RANKING_DIFFICULTY_KEYS = Object.freeze([
  ...Object.keys(DIFFICULTY_SETTINGS),
  ...Object.keys(DIFFICULTY_SETTINGS).map(key => `${PRO_RANKING_PREFIX}${key}`),
  ...EXTREME_DIFFICULTIES.map(setting => `${EXTREME_RANKING_PREFIX}${setting.id}`),
  `${EXTREME_RANKING_PREFIX}${GOD_SETTING.id}`,
]);
// 種族チャレンジは「種族(主血統) × 難易度」ごとに独立したランキングになる。
// 既存 rankings テーブルの difficulty 列(自由文字列)へ Species-<血統id>-<難易度id> の形で入れるだけなので、
// 新しいテーブルも列も要らない。区切りの「-」は既存キー(Normal / ProNormal / ExtremeEXTREME)に
// 一切現れないため、チャレンジ・プロ・極限の行と混ざることが構造上起きない。
const SPECIES_RANKING_PREFIX = 'Species';
const SPECIES_RANKING_SEPARATOR = '-';
const speciesChallengeRankingDifficulty = (speciesId, difficultyId) => {
  const lineage = speciesChallengeLineages().find(item => item.id === speciesId);
  if (!lineage || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)) return null;
  return `${SPECIES_RANKING_PREFIX}${SPECIES_RANKING_SEPARATOR}${lineage.id}${SPECIES_RANKING_SEPARATOR}${difficultyId}`;
};
// ランキングキーから種族と難易度へ戻す。知らない組み合わせはnull(既存キーとして扱う)
const parseSpeciesChallengeRankingDifficulty = (key) => {
  const parts = String(key ?? '').trim().split(SPECIES_RANKING_SEPARATOR);
  if (parts.length !== 3 || parts[0].toLowerCase() !== SPECIES_RANKING_PREFIX.toLowerCase()) return null;
  const lineage = speciesChallengeLineages().find(item => item.id.toLowerCase() === parts[1].toLowerCase());
  const difficultyId = SPECIES_CHALLENGE_DIFFICULTY_IDS.find(id => id.toLowerCase() === parts[2].toLowerCase());
  return lineage && difficultyId ? { speciesId:lineage.id, difficultyId } : null;
};
// 種族をまたいだ「全種族」の全国ランキング。
//
// ★これは読み取り専用の合成キーで、この値をdifficultyへ保存することは一切ない。
//   実体は Species-<各血統>-<難易度> の行そのままで、取りにいくときだけ
//   その難易度の全種族ぶんのキーへ展開して1回のリクエストにまとめる(sbFetchRankings)。
//   新しい行も列も増やさないので、これまでに送られた記録がそのまま並ぶ。
//   別キーを新設して二重送信する方法もあるが、それだと過去の記録が1件も出ないうえ、
//   1周回につき送信が2回に増えて失敗する場所も増えるため採らない。
// 血統idに 'all' は存在しない(data/lineages.js)。実在する種族のキーと重ならないよう、
// 先に parseSpeciesChallengeRankingDifficulty を通してからこちらを見る。
const SPECIES_RANKING_ALL_ID = 'all';
// ランキング画面の種族タブのid。血統idとぶつからない名前にする
const SPECIES_RANK_TAB_ALL = 'allSpecies';
const SPECIES_RANK_TAB_SELF_BEST = 'selfBest';
const speciesChallengeAllRankingDifficulty = (difficultyId) =>
  (SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    ? `${SPECIES_RANKING_PREFIX}${SPECIES_RANKING_SEPARATOR}${SPECIES_RANKING_ALL_ID}${SPECIES_RANKING_SEPARATOR}${difficultyId}`
    : null);
const parseSpeciesChallengeAllRankingDifficulty = (key) => {
  const parts = String(key ?? '').trim().split(SPECIES_RANKING_SEPARATOR);
  if (parts.length !== 3 || parts[0].toLowerCase() !== SPECIES_RANKING_PREFIX.toLowerCase()) return null;
  if (parts[1].toLowerCase() !== SPECIES_RANKING_ALL_ID) return null;
  // 実在する血統と同じidなら、そちらの解釈を優先する(取り違えを構造的に防ぐ)
  if (speciesChallengeLineages().some(item => item.id.toLowerCase() === SPECIES_RANKING_ALL_ID)) return null;
  const difficultyId = SPECIES_CHALLENGE_DIFFICULTY_IDS.find(id => id.toLowerCase() === parts[2].toLowerCase());
  return difficultyId ? { difficultyId } : null;
};
// 「全種族」を、実際にDBへ入っている種族別キーの一覧へ展開する
const speciesChallengeAllRankingMembers = (difficultyId) => speciesChallengeLineages()
  .map(lineage => speciesChallengeRankingDifficulty(lineage.id, difficultyId))
  .filter(Boolean);
// 「全種族」の一覧で、1件ごとの記録がどの種族のものかを表示するための短いラベル。
// difficulty列(Species-<血統id>-<難易度id>)から血統名を戻すだけで、既存キーの意味は変えない。
// 知らないキーや列が来ていない古い記録ではnullを返し、呼び出し側でバッジごと出さない
const speciesRankingLabel = (difficultyKey) => {
  const parsed = parseSpeciesChallengeRankingDifficulty(difficultyKey);
  if (!parsed) return null;
  const lineage = speciesChallengeLineages().find(item => item.id === parsed.speciesId);
  return lineage ? `${lineage.name}種` : null;
};
// 極限の段階ID。知らない値が来ても実装済みの段階へ落として、ランキングのキーを壊さない
// 内部難易度も将来用の記録・ランキングIDへ正規化できる。通常UIへの公開可否はavailableで別管理し、
// デバッグ戦は送信入口で遮断するため、ここで未公開IDを別難易度へ混ぜない。
const normalizeExtremeDifficulty = (value) => (ALL_EXTREME_DIFFICULTIES
  .find(setting => setting.id === value) ? value : EXTREME_SETTING.id);
// そのモード・難易度の記録を置く難易度キー。チャレンジは従来どおりの値をそのまま使う。
// 極限チャレンジは diff に極限の段階ID(EXTREMEなど)を渡す
// 種族チャレンジだけは種族(主血統)も要るので、第3引数で受け取る
const rankingDifficultyForMode = (mode, diff, speciesId=null) => {
  if (mode === BATTLE_MODE_SPECIES_CHALLENGE) {
    const key = speciesChallengeRankingDifficulty(speciesId, diff);
    if (!key) throw new Error(`unknown species challenge ranking: ${String(speciesId)}/${String(diff)}`);
    return key;
  }
  if (typeof EXTREME_MODE !== 'undefined' && EXTREME_MODE && mode === EXTREME_MODE.id) {
    return `${EXTREME_RANKING_PREFIX}${normalizeExtremeDifficulty(diff)}`;
  }
  return isProMode(mode) ? `${PRO_RANKING_PREFIX}${normalizeBattleDifficulty(diff)}` : normalizeBattleDifficulty(diff);
};
// ランキングの難易度キーから、表示に使う素の難易度へ戻す
const rankingDifficultyBase = (key) => {
  const text = String(key || '');
  const species = parseSpeciesChallengeRankingDifficulty(text);
  if (species) return species.difficultyId;
  if (text.startsWith(EXTREME_RANKING_PREFIX)) return text.slice(EXTREME_RANKING_PREFIX.length);
  return text.startsWith(PRO_RANKING_PREFIX) ? text.slice(PRO_RANKING_PREFIX.length) : text;
};
const normalizeRankingDifficulty = (value) => {
  // 種族チャレンジのキーは種族×難易度の組で決まるので、固定リストではなく組み合わせで確かめる
  const species = parseSpeciesChallengeRankingDifficulty(value);
  if (species) return speciesChallengeRankingDifficulty(species.speciesId, species.difficultyId);
  // 「全種族」は保存には使わない読み取り専用の合成キー。取得のときだけ種族別キーへ展開する
  const speciesAll = parseSpeciesChallengeAllRankingDifficulty(value);
  if (speciesAll) return speciesChallengeAllRankingDifficulty(speciesAll.difficultyId);
  const compact = String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
  const canonical = RANKING_DIFFICULTY_KEYS.find(key => key.toLowerCase() === compact);
  if (!canonical) throw new Error(`unknown ranking difficulty: ${String(value)}`);
  return canonical;
};
// 通信、state、リクエスト管理、画面参照で共有する唯一のランキング内部キー。
// 表示ラベルや大文字小文字の異なる入力を、そのままオブジェクトキーにしない。
const rankingDifficultyKey = (value) => normalizeRankingDifficulty(value);

// 難易度ごとの記録を取得する。order を変えることで「スコア上位」と「レベル上位」を出し分ける
// 表示件数。rankingsテーブルにdifficulty+scoreの索引が無く、取得のたびに全行を走査して
// 並べ替えているため、件数を増やすとそのまま待ち時間になる。索引を追加するまでは20件にする。
// 一覧に見せる件数(難易度タブを選んだときは、その1難易度だけを取りにいく)。
// 20件→50件にしても、通信は1難易度ぶんで +24KB、描画は +14ms しか増えない
// (実測 tools/ranking-dye-cost-check.js)
const RANKING_SCORE_LIMIT = 50;
// 難易度を指定せずにまとめて取りにいくとき(いまは呼ぶ場所が無い)の1難易度あたりの件数。
// ここで50件にすると9難易度ぶん=450行(約367KB)になるので、控えめにしておく。
// ブリーダーLv・絆Lvは難易度で絞らない専用の取得(絆Lvは RANKING_LEVEL_FETCH_LIMIT の1回、
// ブリーダーLvは sbFetchAllBreederRows のページ送り)なので、この値の影響は受けない
const RANKING_BULK_LIMIT = 20;
// 取得ごとの詳細ログは切り分け用。常時出すと件数ぶんの文字列生成が毎回走るので、
// 必要なときだけ localStorage の mh_ranking_debug='1' で有効にする(エラーは常に出す)。
const rankingDebugEnabled = () => { try { return window.localStorage.getItem('mh_ranking_debug') === '1'; } catch { return false; } };
const rankingLog = (requestId, event, detail={}) => { if (rankingDebugEnabled()) console.info('[ranking][diagnostic]', { requestId, event, at: new Date().toISOString(), ...detail }); };
// レベル系ランキングは難易度で絞らず1回で取る。件数が多いほど並べ替えと転送に時間がかかるため、
// 表示に必要な範囲にとどめる。
// 絆Lvは編成(party)ごと取るので1行が重い。ただし60件では取得枠が狭すぎて、
// プレイ直後の自分の記録すら入らないことがあったため広げた
const RANKING_LEVEL_FETCH_LIMIT = 120;
// 絆Lvは「新しい記録」から取りたい。以前は order=id.desc だけを使っていたが、
// rankings.id が uuid の場合 id.desc は作成順にならず、毎回ばらばらの記録を拾ってしまう
// (スコアは score.desc、ブリーダーLvは level.desc なので影響が無く、絆Lvだけが
//  「プレイしても更新されない」ように見えていた)。
// 記録した時刻で並べ、その列が使えない環境では従来どおり id.desc へ落とす。
const BOND_RANKING_ORDERS = ['created_at.desc.nullslast', 'id.desc'];
// ブリーダーLvは「1人1行」ではなく、プレイのたびに増える記録(1プレイ=1行)から
// 名前ごとにまとめて出す。そのため「上位N行」を取る作りだと、よく遊ぶ人の過去の記録が
// 枠を食いつぶし、Lvの低い人は1行も取れずに一覧から丸ごと消えてしまう。
// (60行では7人いても3人しか出ず、400行へ増やしたあとも記録が貯まって再発した)
// 行数を増やして誤魔化すのではなく、行が尽きるまでページ送りして全員を必ず集計する。
// 取るのは name/level/icon の3列だけなので1行は数十バイトで、1万行でも数百KBに収まる。
const RANKING_BREEDER_PAGE_SIZE = 2000;
// 万一記録が想定以上に増えても通信が止まらないようにする上限。
// ここに達したときはLvの高い側から読めたぶんだけで集計する
const RANKING_BREEDER_MAX_ROWS = 24000;
const RANKING_BREEDER_MAX_PAGES = 12;
// ブリーダーLvは編成(party)を使わない。partyはJSONで1行あたりが大きいため、
// 使わない場面では取得しないだけで転送量と待ち時間がはっきり減る
const RANKING_SELECT_FULL = 'user_name,hero,party,score,level,icon';
const RANKING_SELECT_NO_PARTY = 'user_name,hero,score,level,icon';
// ブリーダーLvの一覧は名前・レベル・アイコンしか出さない。全件をページ送りで読むので、
// 使わない列(hero/score)まで運ばない
const RANKING_SELECT_BREEDER = 'user_name,level,icon';

// ==================== 周回の結果(ターン数・到達WAVE) ====================
// 「クリアしたときの累計ターン数」と「どのWAVEで終わったか」をスコアランキングに出すための列。
// rankings へ後から足す列なので、SQLをまだ適用していない環境が必ず存在する。
//
// 【なぜ気を付けるか】
// PostgRESTは知らない列を送る/選ぶと400を返す。ここを素通しにすると、列が無い環境では
// スコアの保存そのものが失敗し、ランキングも開けなくなる(既存の記録を壊しはしないが、
// 新しい記録が1件も残らなくなる)。そこで、一度400で気付いたらその後は列を外して動く。
// SQLを適用すればアプリ側は何もしなくても自動的に載りはじめる。
const RANKING_RUN_STATS_COLUMNS = 'turns,reached_wave';
let _rankingRunStatsUnavailable = false;
const rankingRunStatsUnavailable = () => _rankingRunStatsUnavailable;
// 「その列は無い」という応答かどうか。通信の失敗や権限の失敗と取り違えない
//   選ぶとき  … 400 + 42703 (column rankings.turns does not exist)
//   送るとき  … 400 + PGRST204 (Could not find the 'turns' column of 'rankings')
const _isMissingColumnError = (status, body) => {
  if (status !== 400) return false;
  const text = String(body || '');
  if (!/turns|reached_wave/i.test(text)) return false;
  return /PGRST204|PGRST100|42703|does not exist|Could not find the/i.test(text);
};
// 取得する列。ターン数を使う一覧(スコア)にだけ足す。ブリーダーLvの一覧は
// 全件をページ送りで読むので、使わない列を運ばせない
const rankingSelectWithRunStats = (base) =>
  (_rankingRunStatsUnavailable || !base || !base.includes('score')) ? base : `${base},${RANKING_RUN_STATS_COLUMNS}`;
// bond_levels の1行を、rankings から集計したものと同じ形のエントリへ直す。
// 表示側(renderBondRankingEntry)はどちらから来た行かを知らなくてよい
const bondLevelRowToEntry = (row) => {
  const monsterId = row?.monster_id || null;
  const monName = ALL_PLAYER_MONSTERS[monsterId]?.name || row?.mon_name || null;
  const bondLevel = Number(row?.bond_level);
  if (!monName || !Number.isFinite(bondLevel) || bondLevel <= 0) return null;
  const individualId = String(row?.individual_id || '');
  return {
    userName: row?.user_name || '名無しのブリーダー',
    icon: row?.icon ?? null,
    monName, bondLevel, monsterId,
    imgUrl: ALL_PLAYER_MONSTERS[monsterId]?.iconUrl || null,
    emoji: ALL_PLAYER_MONSTERS[monsterId]?.emoji || null,
    masuId: individualId.startsWith('legacy:') ? null : (individualId || null),
    // 詳細表示に使う育成スナップショット(古い記録には無い)
    detail: row?.detail ?? null,
    colors: Array.isArray(row?.colors) ? row.colors : [],
    individualId,
  };
};
// 正本テーブルの結果と、rankings から集計した結果を1つに束ねる。
// 同じ「人 × 個体」は正本テーブル側を採用し、正本にまだ載っていない人だけ
// 従来どおり rankings の集計で補う(テーブルを作った直後から一覧が欠けないようにするため)
const mergeBondRankingEntries = (primaryEntries, legacyEntries) => {
  const keyOf = (e) => `${e?.userName}\u0000${e?.individualId || (e?.masuId != null && String(e.masuId) !== '' ? String(e.masuId) : `legacy:${e?.monsterId || e?.monName}`)}`;
  const merged = new Map();
  (primaryEntries || []).forEach(e => { if (e) merged.set(keyOf(e), e); });
  (legacyEntries || []).forEach(e => { if (e && !merged.has(keyOf(e))) merged.set(keyOf(e), e); });
  return [...merged.values()].sort((a, b) => b.bondLevel - a.bondLevel);
};
// ==================== 絆Lvの正本テーブル(bond_levels) ====================
// 絆Lvは編成(party)のJSONの中にあるため、rankings からはDB側で「絆Lvの高い順」に
// 並べられない。そのため新着順に RANKING_LEVEL_FETCH_LIMIT 行だけ取ってアプリ側で
// 集計しており、よく遊ぶ人の記録で枠が埋まると、しばらく遊んでいない人が一覧から
// 丸ごと消える(ブリーダーLvで2度起きたのと同じ構造の問題)。
// そこで「1人 × 1個体で必ず1行」の専用テーブルへ、プレイ終了時に上書き保存する。
//
// テーブルがまだ無い環境でも動くようにしてある(適用前・適用中でも壊れない)。
// 1度でも「テーブルが無い」と分かったら、そのセッションでは以後アクセスしない。
const BOND_LEVELS_TABLE = 'bond_levels';
const BOND_LEVELS_SELECT = 'user_name,individual_id,monster_id,mon_name,bond_level,icon,detail,colors';
// 1行が数百バイトなので、種類別タブぶんまで含めて1回で取り切れる余裕を持たせる
const BOND_LEVELS_FETCH_LIMIT = 1000;
// 「テーブルが無い」と分かったあとは、毎回404を出しにいかない
let _bondLevelsUnavailable = false;
const bondLevelsUnavailable = () => _bondLevelsUnavailable;
// PostgRESTはテーブルが無いとき404 + PGRST205 を返す。権限や通信の失敗と取り違えない
const _isMissingTableError = (status, body) => {
  if (status !== 404) return false;
  return /PGRST205|Could not find the table|does not exist/i.test(String(body || ''));
};
// 絆Lvの正本を読む。テーブルが無ければ null を返し、呼び出し側は今までどおり
// rankings から集計する(新旧併用)
const sbFetchBondLevels = async (requestId='untracked') => {
  if (_bondLevelsUnavailable) return null;
  const url = `${SUPABASE_URL}/rest/v1/${BOND_LEVELS_TABLE}?select=${BOND_LEVELS_SELECT}`
    + `&order=bond_level.desc.nullslast&limit=${BOND_LEVELS_FETCH_LIMIT}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      if (_isMissingTableError(res.status, body)) {
        _bondLevelsUnavailable = true;
        rankingLog(requestId, 'bond-levels-missing', { status: res.status });
        return null;
      }
      throw new Error(`bond_levels ${res.status}: ${body || res.statusText}`);
    }
    const rows = JSON.parse(body || '[]');
    rankingLog(requestId, 'bond-levels-fetched', { received: Array.isArray(rows) ? rows.length : 0 });
    return Array.isArray(rows) ? rows : [];
  } finally {
    clearTimeout(timer);
  }
};
// 絆Lvの正本を書く。同じ個体は何度書いても1行のまま、最新の絆Lvで上書きされる
// (転生で下がった場合もそのまま反映する。いまの状態を映すのが正しいため)。
// ランキング送信の付随処理なので、失敗しても周回の進行は止めない。
const sbUpsertBondLevels = async (rows) => {
  if (_bondLevelsUnavailable || !Array.isArray(rows) || rows.length === 0) return false;
  const url = `${SUPABASE_URL}/rest/v1/${BOND_LEVELS_TABLE}?on_conflict=user_name,individual_id`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows), signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      if (_isMissingTableError(res.status, body)) { _bondLevelsUnavailable = true; return false; }
      throw new Error(`bond_levels upsert ${res.status}: ${body || res.statusText}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
};
// ランキングへ送る編成から、絆Lvの正本へ入れる行を作る。
// 個体が特定できる記録は masuId、できない古い形は legacy:種ID でまとめる
// (どちらも rankings 側の集計と同じ考え方)。
const bondLevelRowsFromParty = (userName, icon, party) => {
  const byIndividual = new Map();
  (Array.isArray(party) ? party : []).forEach(member => {
    const bondLevel = Number(member?.bondLevel);
    if (!member || !Number.isFinite(bondLevel) || bondLevel <= 0) return;
    const monsterId = member.baseId || member.monsterId || member.id || null;
    const monName = ALL_PLAYER_MONSTERS[monsterId]?.name || member.name || null;
    if (!monName) return;
    const individualId = (member.masuId != null && String(member.masuId) !== '')
      ? String(member.masuId) : `legacy:${monsterId || monName}`;
    // 同じ周回に同じ個体が2枠入ることは無いが、万一重なったら高い方を残す
    const current = byIndividual.get(individualId);
    if (current && current.bond_level >= bondLevel) return;
    byIndividual.set(individualId, {
      user_name: userName || '名無しのブリーダー',
      individual_id: individualId,
      monster_id: monsterId, mon_name: monName,
      bond_level: Math.floor(bondLevel),
      icon: icon ?? null,
      detail: member.detail ?? null,
      colors: Array.isArray(member.colors) ? member.colors : null,
    });
  });
  return [...byIndividual.values()];
};
const sbFetchRankings = async (diff, limit=RANKING_SCORE_LIMIT, order='score.desc.nullslast', offset=0, requestId='untracked', selectColumns=RANKING_SELECT_FULL) => {
  // diff を省略(null)すると難易度で絞らず、全難易度をまとめて取る
  const normalizedDifficulty = diff == null ? null : normalizeRankingDifficulty(diff);
  // 必要な列だけを受け取り、過去記録が多い難易度でもレスポンスを不用意に大きくしない。
  // ターン数・到達WAVEはSQLをまだ適用していない環境では選べないので、そのときは外れる。
  const baseSelect = selectColumns || RANKING_SELECT_FULL;
  const select = rankingSelectWithRunStats(baseSelect);
  // DBに保存する正規keyと同じ値をeqで取得する。ilikeによる別系統の
  // 取得条件を残さず、NormalもHardと完全に同じSELECT経路にする。
  //
  // 種族チャレンジの「全種族」だけは、その難易度の種族別キーをすべて並べた in.(...) にする。
  // これも前方一致(ilike)ではなく実在するキーの完全一致の並びなので、
  // 他モードの行(Normal / ProNormal / ExtremeEXTREME)が紛れ込むことは構造上ない。
  // 並べ替えと件数の絞り込みはDB側で効くので、通信は他のタブと同じ1回で済む。
  const speciesAllDifficulty = normalizedDifficulty == null ? null : parseSpeciesChallengeAllRankingDifficulty(normalizedDifficulty);
  const speciesAllMembers = speciesAllDifficulty ? speciesChallengeAllRankingMembers(speciesAllDifficulty.difficultyId) : [];
  const difficultyFilter = normalizedDifficulty == null
    ? ''
    : speciesAllDifficulty
      // 値ごとに符号化し、区切りのカンマだけを生のまま残す(値に「-」以外の記号は入らない)
      ? `&difficulty=in.(${speciesAllMembers.map(key => encodeURIComponent(`"${key}"`)).join(',')})`
      : `&difficulty=eq.${encodeURIComponent(normalizedDifficulty)}`;
  // 展開先が1件も無いときに in.() を送るとDB側の構文エラーになるので、その前に空で返す
  if (speciesAllDifficulty && speciesAllMembers.length === 0) return [];
  // 「全種族」だけは difficulty 列(Species-<血統id>-<難易度id>)も一緒に受け取る。
  // 展開した種族別キーがまとめて返るので、この列が無いとどの行がどの種族のものか
  // 一覧側で区別できない。他の難易度は元々1本のキーしか要求しないので不要
  const selectWithDifficulty = speciesAllDifficulty ? `${select},difficulty` : select;
  const url = `${SUPABASE_URL}/rest/v1/rankings?select=${selectWithDifficulty}${difficultyFilter}&order=${order}&limit=${limit}&offset=${offset}`;
  const startedAt = Date.now();
  rankingLog(requestId, 'request-start', {
    difficulty: normalizedDifficulty, requestedDifficulty: diff, category: 'ranking', rankingType: order, table: 'rankings',
    columns: select, limit, offset, url, supabaseUrl: SUPABASE_URL,
    keyLoaded: Boolean(SUPABASE_KEY), keyType: SUPABASE_KEY.startsWith('sb_publishable_') ? 'publishable' : 'legacy'
  });
  // モバイル回線などで接続だけが残り続けても、ランキング画面を永久に待機させない。
  const controller = new AbortController();
  // 8秒では「遅いだけで成功する取得」まで失敗扱いになり、そのたびに端末内の復旧表示へ
  // 落ちていた。回線が細くても待てる範囲まで伸ばす(それでも返らなければ打ち切る)
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, signal: controller.signal });
    const body = await res.text();
    rankingLog(requestId, 'supabase-response', { difficulty: normalizedDifficulty, endedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt, status: res.status, statusText: res.statusText, ok: res.ok, dataCount: res.ok ? (() => { try { const parsed = JSON.parse(body); return Array.isArray(parsed) ? parsed.length : null; } catch { return null; } })() : null, error: res.ok ? null : body });
    if (!res.ok) {
      // ターン数・到達WAVEの列がまだ無い環境。列を外して取り直せば今までどおり表示できる。
      // 一度気付いたら以後は最初から外して送るので、この寄り道は多くても1回きり
      if (select !== baseSelect && _isMissingColumnError(res.status, body)) {
        _rankingRunStatsUnavailable = true;
        rankingLog(requestId, 'run-stats-columns-missing', { status: res.status });
        return sbFetchRankings(diff, limit, order, offset, requestId, baseSelect);
      }
      throw new Error(`fetch ${res.status} ${res.statusText}; url=${url}; response=${body || '(empty)'}`);
    }
    try {
      return JSON.parse(body);
    } catch (e) {
      throw new Error(`invalid JSON; url=${url}; response=${body || '(empty)'}; error=${e.message}`);
    }
  } catch (error) {
    const normalized = error?.name === 'AbortError'
      ? new Error(`ranking request timed out after 8000ms; url=${url}`)
      : error;
    rankingLog(requestId, 'supabase-error', { difficulty: normalizedDifficulty, endedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt, timeout: error?.name === 'AbortError', networkError: error instanceof TypeError, name: normalized?.name, message: normalized?.message, stack: normalized?.stack });
    throw normalized;
  } finally {
    clearTimeout(timer);
  }
};
// ブリーダーLvの記録を名前ごとに1件へまとめ、最も高いレベルを採用する。
// 1プレイ=1行なので同じ人が何行も持つ。取得直後にここでまとめておくと、
// 端末へ残すキャッシュも人数ぶんの大きさで収まる
const aggregateBreederLevels = (rows) => {
  const byName = new Map();
  (rows || []).forEach(r => {
    const name = r?.userName || '名無しのブリーダー';
    const lv = Number(r?.level) || 0;
    const cur = byName.get(name);
    if (!cur || lv > cur.level) byName.set(name, { ...r, userName: name, level: lv });
  });
  return [...byName.values()].filter(x => x.level > 0).sort((a, b) => b.level - a.level);
};
// ブリーダーLv用に、rankingsの全行をページ送りで読む。
// 1プレイ=1行なので同じ人が何行も持つ。「上位N行」では下位の人が消えるため、
// 行が尽きる(空のページが返る)まで読み進めてから名前ごとにまとめる。
const sbFetchAllBreederRows = async (requestId='untracked') => {
  const all = [];
  // 1ページの実際の件数はサーバー側の上限で要求より少なくなることがある。
  // 1ページ目の件数を「そのサーバーでの1ページ分」とみなし、それより少なくなったら最後のページとする
  let pageSize = RANKING_BREEDER_PAGE_SIZE;
  let offset = 0;
  for (let page = 0; page < RANKING_BREEDER_MAX_PAGES && offset < RANKING_BREEDER_MAX_ROWS; page++) {
    const got = await sbFetchRankings(null, pageSize, 'level.desc.nullslast', offset, requestId, RANKING_SELECT_BREEDER);
    const rows = Array.isArray(got) ? got : [];
    all.push(...rows);
    rankingLog(requestId, 'breeder-page', { page, offset, pageSize, received: rows.length, total: all.length });
    if (rows.length === 0) break;
    if (page === 0 && rows.length < pageSize) pageSize = rows.length;
    if (rows.length < pageSize) break;
    offset += rows.length;
  }
  return all;
};
// 記録を1件挿入する(1プレイ=1件)
const sbInsertScore = async (row) => {
  // 全国ランキングの書き込みは常にclear_id必須とする。呼び出し側の指定漏れで通常POSTへ
  // 戻る経路を残すと、タイムアウト後の再送などが同じクリアを別行として保存してしまう。
  if (typeof row?.clear_id !== 'string' || !row.clear_id.trim()) {
    throw new Error('ranking clear_id is required; unsafe insert skipped');
  }
  const normalizedRow = { ...row, difficulty: normalizeRankingDifficulty(row?.difficulty) };
  // ターン数・到達WAVEの列がまだ無い環境では、その2つを送ると400になり
  // 記録そのものが保存できない。無いと分かっている間は最初から外して送る
  if (_rankingRunStatsUnavailable) { delete normalizedRow.turns; delete normalizedRow.reached_wave; }
  const requestId = `insert-${normalizedRow.difficulty}-${Date.now()}`;
  const query = '?on_conflict=clear_id';
  const prefer = 'resolution=ignore-duplicates,return=minimal';
  // 結果画面はこのPOSTが確定するまで入力をロックするため、通信が切れかけた端末でも
  // 永久に「処理中」にならないようGETと同じ上限を設ける。タイムアウト後はclear_id付きの
  // ローカル記録へ退避し、同じクリアを非冪等なPOSTで再送しない。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    rankingLog(requestId, 'insert-start', {
      difficulty: normalizedRow.difficulty, table: 'rankings', clearId: normalizedRow.clear_id,
      score: normalizedRow.score, userName: normalizedRow.user_name, level: normalizedRow.level,
      hasIcon: Boolean(normalizedRow.icon), columns: Object.keys(normalizedRow), payload: normalizedRow
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rankings${query}`, { method:'POST', headers:{...SB_HEADERS, 'Prefer':prefer}, body: JSON.stringify(normalizedRow), signal: controller.signal });
    const body = await res.text();
    let errorCode = null;
    if (body) {
      try { errorCode = JSON.parse(body)?.code || null; } catch {}
    }
    const isUniqueViolation = res.status === 409 && errorCode === '23505';
    rankingLog(requestId, 'insert-response', {
      difficulty: normalizedRow.difficulty, clearId: normalizedRow.clear_id,
      status: res.status, statusText: res.statusText, ok: res.ok,
      errorCode, isUniqueViolation, error: res.ok ? null : (body || res.statusText)
    });
    if (!res.ok) {
      // ターン数・到達WAVEの列がまだ無い環境。ここで諦めるとスコアが1件も残らなくなるので、
      // その2つを外して必ず送り直す(記録を落とさないことを最優先にする)。
      // 一度気付けば以後は最初から外して送るので、この寄り道は多くても1回きり
      if (!_rankingRunStatsUnavailable
          && (normalizedRow.turns !== undefined || normalizedRow.reached_wave !== undefined)
          && _isMissingColumnError(res.status, body)) {
        _rankingRunStatsUnavailable = true;
        rankingLog(requestId, 'run-stats-columns-missing', { status: res.status });
        const { turns, reached_wave, ...withoutRunStats } = normalizedRow;
        return sbInsertScore(withoutRunStats);
      }
      const error = new Error(`insert ${res.status}: ${body || res.statusText}`);
      error.status = res.status;
      error.body = body;
      error.code = errorCode;
      error.isUniqueViolation = isUniqueViolation;
      throw error;
    }
    return { saved: true, status: res.status, body, row: normalizedRow };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('ranking insert timed out after 8000ms');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// 検査(tools/ranking-run-stats-check.js)からスコア送信だけを呼べるようにしておく。
// 「turns/reached_wave の列がまだ無い環境でもスコアが保存できること」は、
// 実際に1周遊ばないと通らない経路だと確かめるのに何分もかかるうえ、
// 落ちたときの被害(記録が1件も残らない)が大きいので、ここだけ直接叩けるようにする。
// 読み出し専用の参照を1つ足すだけで、ゲーム側の動きは何も変わらない。
try { if (typeof window !== 'undefined') window.__mhTestHooks = { ...(window.__mhTestHooks || {}), sbInsertScore, rankingRunStatsUnavailable }; } catch {}

// 全国保存と端末内フォールバックの成否を混同しない共通送信経路。
// insertが失敗しても診断情報を端末側の行へ残すが、全国保存成功としては返さない。
const persistRankingScore = async ({ row, insertScore=sbInsertScore, saveLocal }) => {
  try {
    const response = await insertScore(row);
    return { nationalSaved: response?.saved === true, localSaved: false, response, error: null };
  } catch (error) {
    let localSaved = false;
    try {
      await saveLocal(error);
      localSaved = true;
    } catch (localError) {
      console.error('[ranking] local fallback also failed:', localError && localError.message ? localError.message : localError);
    }
    return { nationalSaved: false, localSaved, response: null, error };
  }
};

const createRunId = () => globalThis.crypto?.randomUUID?.() || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

// モンビー(音ゲー)の全国ランキング専用の送受信(2026-09-04)。
//
// 既存の sbInsertScore / sbFetchRankings は、difficulty列の値を必ず
// normalizeRankingDifficulty で検証しており、そこで認めているのは通常バトル・プロ・極限・
// 種族チャレンジの固定パターンだけ。Rhythm-<songId>-<難易度id> をそのまま渡すと
// 「unknown ranking difficulty」で例外になる。normalizeRankingDifficultyやその一覧
// (RANKING_DIFFICULTY_KEYS)は全モードの送受信が経由する共通処理なので、モンビーのために
// そこを緩めると他モードの検証まで一緒に緩んでしまう。そのため触らず、モンビー専用の
// 送受信をここへ分けて持つ。テーブル・列は既存の rankings をそのまま使う
// (difficulty列の値だけで区別する、種族チャレンジと同じ考え方)。
const RHYTHM_RANKING_SELECT = 'user_name,hero,party,score,level,icon,difficulty';
const sbInsertRhythmScore = async (row) => {
  if (typeof row?.clear_id !== 'string' || !row.clear_id.trim()) {
    throw new Error('rhythm ranking clear_id is required; unsafe insert skipped');
  }
  if (!String(row?.difficulty ?? '').startsWith(`${RHYTHM_RANKING_PREFIX}${RHYTHM_RANKING_SEPARATOR}`)) {
    throw new Error(`invalid rhythm ranking difficulty key: ${String(row?.difficulty)}`);
  }
  const query = '?on_conflict=clear_id';
  const prefer = 'resolution=ignore-duplicates,return=minimal';
  const requestId = `rhythm-insert-${row.difficulty}-${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    rankingLog(requestId, 'rhythm-insert-start', { difficulty: row.difficulty, clearId: row.clear_id, score: row.score, userName: row.user_name });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rankings${query}`, { method:'POST', headers:{...SB_HEADERS,'Prefer':prefer}, body: JSON.stringify(row), signal: controller.signal });
    const body = await res.text();
    rankingLog(requestId, 'rhythm-insert-response', { status: res.status, ok: res.ok, error: res.ok ? null : (body || res.statusText) });
    if (!res.ok) {
      const error = new Error(`rhythm ranking insert ${res.status}: ${body || res.statusText}`);
      error.status = res.status; error.body = body;
      throw error;
    }
    return { saved: true, status: res.status, body };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('rhythm ranking insert timed out after 8000ms');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
// 難易度合算表示のため、複数のdifficultyキーをin.(...)でまとめて1回のリクエストにする
// (種族チャレンジの「全種族」がsbFetchRankings内で行っているのと同じ考え方だが、
// あちらは既存モードの検証を経由するため触らず、こちらは完全に独立させる)
const sbFetchRhythmRankings = async (difficultyKeys, limit=RHYTHM_RANKING_FETCH_LIMIT, offset=0, requestId='untracked') => {
  const keys = (Array.isArray(difficultyKeys) ? difficultyKeys : [difficultyKeys]).filter(Boolean);
  if (keys.length === 0) return [];
  const url = `${SUPABASE_URL}/rest/v1/rankings?select=${RHYTHM_RANKING_SELECT}&difficulty=in.(${keys.map(k=>encodeURIComponent(`"${k}"`)).join(',')})&order=score.desc.nullslast&limit=${limit}&offset=${offset}`;
  rankingLog(requestId, 'rhythm-request-start', { keys, limit, offset, url, table: 'rankings' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) throw new Error(`rhythm ranking fetch ${res.status} ${res.statusText}; url=${url}; response=${body || '(empty)'}`);
    try {
      return JSON.parse(body);
    } catch (e) {
      throw new Error(`invalid JSON; url=${url}; response=${body || '(empty)'}; error=${e.message}`);
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('rhythm ranking fetch timed out after 15000ms');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// 難易度に依存しない周回開始処理。Normalだけ前周のclear_idや送信ロックを引き継ぐ
// 分岐が生まれないよう、タイトル復帰と再挑戦の両方からこの1か所を呼ぶ。
const beginNewRankingRun = ({ runIdRef, scoreSubmittedRef, runFinalizingRef, rewardsAwardedRef, clearRecordedRef }) => {
  runFinalizingRef.current = false;
  scoreSubmittedRef.current = false;
  rewardsAwardedRef.current = false;
  clearRecordedRef.current = false;
  runIdRef.current = createRunId();
  return runIdRef.current;
};

// 最終リザルト画面(CHAMPION/敗北)共通: レベルの経験値バーが直前の進捗から今回の獲得分まで伸びる演出。
// レベルを跨ぐ場合は満タンまで伸ばしてからLEVEL UPを見せ、次レベルの進捗へ切り替える
const LevelGrowthBar = ({ levelBefore, levelAfter, onComplete }) => {
  const leveledUp = levelAfter.level > levelBefore.level;
  // 累計経験値。levelInfo/bondLevelInfoが返すtotalXpをそのまま出すだけなので計算は増えない
  const totalBefore = Number(levelBefore?.totalXp);
  const totalAfter = Number(levelAfter?.totalXp);
  const hasTotals = Number.isFinite(totalBefore) && Number.isFinite(totalAfter);
  const gainedXp = hasTotals ? Math.max(0, totalAfter - totalBefore) : 0;
  const [curLevel, setCurLevel] = useState(levelBefore.level);
  const [pct, setPct] = useState(Math.max(0, Math.min(100, (levelBefore.xpIntoLevel / Math.max(1, levelBefore.xpForNext)) * 100)));
  // 次のレベルまで残り何XPかの表示。バーの伸び(pct)と同じタイミングで切り替える
  const [remain, setRemain] = useState(Math.max(0, levelBefore.xpForNext - levelBefore.xpIntoLevel));
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const timers = [];
    if (leveledUp) {
      timers.push(setTimeout(() => setPct(100), 200));
      timers.push(setTimeout(() => { Audio_.se.levelUp(); setFlash(true); }, 900));
      timers.push(setTimeout(() => { setFlash(false); setCurLevel(levelAfter.level); setPct(0); setRemain(levelAfter.xpForNext); }, 2000));
      timers.push(setTimeout(() => { setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))); setRemain(Math.max(0, levelAfter.xpForNext - levelAfter.xpIntoLevel)); }, 2100));
      timers.push(setTimeout(() => onComplete?.(), 2800));
    } else {
      timers.push(setTimeout(() => { setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))); setRemain(Math.max(0, levelAfter.xpForNext - levelAfter.xpIntoLevel)); }, 200));
      timers.push(setTimeout(() => onComplete?.(), 900));
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] mb-0.5">
        <span className="font-mono text-slate-300 font-bold">LV.{curLevel}</span>
        {flash ? <span className="text-amber-400 font-black animate-pulse">LEVEL UP!</span> : <span className="text-slate-500 font-mono">次Lvまで{remain.toLocaleString()}</span>}
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-700 ease-out" style={{width:`${pct}%`}}></div>
      </div>
      <div className="flex items-center justify-between text-[8px] font-mono mt-0.5 gap-2">
        <span className={leveledUp?'text-amber-300 font-black shrink-0':'text-slate-500 shrink-0'}>Lv.{levelBefore.level} → Lv.{levelAfter.level}</span>
        {hasTotals&&<span className="text-slate-500 truncate">累計 {totalBefore.toLocaleString()} → {totalAfter.toLocaleString()}{gainedXp>0?` (+${gainedXp.toLocaleString()})`:''}</span>}
      </div>
    </div>
  );
};

// 数値がfrom→toへカウントアップする演出(ダイヤ表示用、バー無し)
const CountUpNumber = ({ from, to, onComplete }) => {
  const [val, setVal] = useState(from);
  useEffect(() => {
    const duration = 700, start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else onComplete?.();
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, 200);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, []);
  return <span>{val.toLocaleString()}</span>;
};

// 最終リザルト画面(CHAMPION/敗北)共通: 今回の周回で獲得したブリーダー経験値・ダイヤ・
// 勇者モンの絆経験値をまとめて表示するカード
const RewardSummaryCard = ({ summary, onPresentationComplete }) => {
  const completedPartsRef = useRef(new Set());
  const expectedParts = 2 + (summary.heroBondGain ? 1 : 0) + (summary.allyBondGains?.length || 0);
  const markPresented = (part) => {
    completedPartsRef.current.add(part);
    if (completedPartsRef.current.size >= expectedParts) onPresentationComplete?.();
  };
  return (
  <div className="w-full max-w-xs bg-black/30 border border-white/10 rounded-2xl p-3 mb-2 text-left shrink-0 flex flex-col min-h-0">
    <div className="space-y-3 shrink-0">
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-indigo-300 font-black flex items-center gap-1"><Crown size={12}/>ブリーダー経験値</span>
          <span className="text-white font-mono font-bold">+{summary.breederXpGain.toLocaleString()}</span>
        </div>
        <LevelGrowthBar levelBefore={summary.breederLevelBefore} levelAfter={summary.breederLevelAfter} onComplete={()=>markPresented('breeder')}/>
      </div>
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
        <span className="text-amber-300 font-black flex items-center gap-1"><Gem size={12}/>ダイヤ</span>
        <span className="text-white font-mono font-bold flex items-baseline gap-1"><span className="text-slate-500 text-[10px]">{summary.goldBefore.toLocaleString()} →</span><CountUpNumber from={summary.goldBefore} to={summary.goldAfter} onComplete={()=>markPresented('gold')}/>{summary.goldAfter>summary.goldBefore&&<span className="text-amber-300 text-[10px]">(+{(summary.goldAfter-summary.goldBefore).toLocaleString()})</span>}</span>
      </div>
      {/* クリアしたときだけ入る限界突破アイテム。1行だけ足して、リザルトの高さを崩さない */}
      {summary.psycheGain > 0 && (
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-fuchsia-300 font-black flex items-center gap-1"><span aria-hidden="true">🌈</span>虹のプシュケー</span>
          <span className="text-white font-mono font-bold">×{summary.psycheGain.toLocaleString()}</span>
        </div>
      )}
      {summary.heroBondGain && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-pink-300 font-black flex items-center gap-1 truncate"><Heart size={12}/>絆レベル：{summary.heroBondGain.name}</span>
            <span className="text-white font-mono font-bold shrink-0">+{summary.heroBondGain.xpGain.toLocaleString()}</span>
          </div>
          <LevelGrowthBar levelBefore={summary.heroBondGain.levelBefore} levelAfter={summary.heroBondGain.levelAfter} onComplete={()=>markPresented('hero')}/>
          {summary.heroBondGain.levelAfter.level > summary.heroBondGain.levelBefore.level && (
            <div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>強化ポイント +{summary.heroBondGain.levelAfter.level - summary.heroBondGain.levelBefore.level}</div>
          )}
        </div>
      )}
      {summary.allyBondGains && summary.allyBondGains.length > 0 && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="text-[10px] text-pink-300 font-black flex items-center gap-1"><Heart size={10}/>仲間の絆経験値</div>
          {summary.allyBondGains.map((a, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-slate-300 font-bold truncate">{a.name}</span>
                <span className="text-white font-mono font-bold shrink-0">+{a.xpGain.toLocaleString()}</span>
              </div>
              <LevelGrowthBar levelBefore={a.levelBefore} levelAfter={a.levelAfter} onComplete={()=>markPresented(`ally-${i}`)}/>
              {a.levelAfter.level > a.levelBefore.level && (
                <div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>強化ポイント +{a.levelAfter.level - a.levelBefore.level}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    {summary.waveHistory && summary.waveHistory.length > 0 && (
      <div className="pt-2 mt-3 border-t border-white/10 shrink-0 flex flex-col min-h-0">
        <div className="text-[10px] text-cyan-300 font-black flex items-center gap-1 mb-1 shrink-0"><Trophy size={11}/>WAVE別ログ</div>
        <div className="space-y-0.5 overflow-y-auto mh-scroll max-h-[18vh]">
          {summary.waveHistory.map(w => (
            <div key={w.wave} className="flex items-center justify-between gap-1 text-[9px] bg-white/5 rounded-lg px-2 py-1">
              <span className="text-slate-400 font-bold shrink-0">WAVE {w.wave}</span>
              {!summary.quickMode&&<span className="text-white font-mono font-bold truncate">スコア +{w.roundScore.toLocaleString()}</span>}
              <span className="text-indigo-300 font-mono font-bold shrink-0">XP+{w.xpGain.toLocaleString()}</span>
              <span className="text-amber-300 font-mono font-bold shrink-0">💎+{w.goldGain.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  );
};

// ---- 起動ローディングのゲージ ----
// 進み具合そのものは index.html の __mhBoot が持っている。静的なローディング画面と
// Reactのブート画面で同じ値を使うため、React側は数えなおさずここから読むだけにする。
// __mhBoot が無い環境(検証用に compiled.js だけを読み込む道具など)でも落ちないよう、
// そのときは「読み込み済み」として扱う。
const bootLoadRatio = () => { try { return window.__mhBoot ? window.__mhBoot.ratio() : 1; } catch (e) { return 1; } };
const bootProgressNow = (label) => ({ done: Math.round(bootLoadRatio() * 1000), total: 1000, label });
const bootLoadDone = (name) => { try { if (window.__mhBoot) window.__mhBoot.done(name); } catch (e) {} };
// 数え漏れが残っていてもゲージの右端まで伸ばす(終わったのに98%で止まって見えないように)
const bootLoadFinish = () => { try { if (window.__mhBoot) window.__mhBoot.finish(); } catch (e) {} };
const bootLoadWatch = (fn) => { try { return window.__mhBoot ? window.__mhBoot.watch(fn) : null; } catch (e) { return null; } };

// 開発用。全ベースモンの本体ピクセルを唯一の座標系にする汎用タッチ式マスクエディタ。
const DyeMaskTouchEditor=({onClose,onTryInGame,onReleaseTemporary,onReleaseAllTemporary,temporaryMasks,active=true})=>{
 const targets=useMemo(makeDyeMaskEditorTargets,[]),[targetIndex,setTargetIndex]=useState(0),target=targets[targetIndex];
 const bodyRef=useRef(null),maskRef=useRef(null),originalRef=useRef(null),bodyDataRef=useRef(null),outsideRef=useRef(null),outlineRef=useRef(null),warningRef=useRef(null),loupeRef=useRef(null),historyRef=useRef({undo:[],redo:[]}),pointersRef=useRef(new Map()),gestureRef=useRef(null),lastTapRef=useRef(0),previewFrameRef=useRef(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[view,setView]=useState('composite'),[opacity,setOpacity]=useState(50),[dirty,setDirty]=useState(false),[search,setSearch]=useState('');
 const [previewMaskUrl,setPreviewMaskUrl]=useState(null),[previewRevision,setPreviewRevision]=useState(0),[previewColors,setPreviewColors]=useState(['red','green','blue']);
 const [color,setColor]=useState('red'),[tool,setTool]=useState('brush'),[size,setSize]=useState(18),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[historyTick,setHistoryTick]=useState(0),[details,setDetails]=useState(false),[imageSize,setImageSize]=useState({width:2,height:3});
 const [pointerDistance,setPointerDistance]=useState(50),[pointerDirection,setPointerDirection]=useState('up'),[pointer,setPointer]=useState(null),[loupe,setLoupe]=useState(true);
 const colors={red:[255,0,0,255],green:[0,255,0,255],blue:[0,0,255,255],eraser:[0,0,0,0]},colorCss={red:'#ff0000',green:'#00ff00',blue:'#0000ff',eraser:'#ffffff'};
 const context=()=>maskRef.current?.getContext('2d',{willReadFrequently:true}),snap=()=>{const c=maskRef.current;return c&&context()?.getImageData(0,0,c.width,c.height);},restore=image=>{if(image)context()?.putImageData(image,0,0);};
 const requestCompositePreview=()=>{if(view!=='composite'||previewFrameRef.current!==null)return;previewFrameRef.current=requestAnimationFrame(()=>{previewFrameRef.current=null;setPreviewRevision(v=>v+1);});};
 const flushCompositePreview=()=>{if(previewFrameRef.current!==null){cancelAnimationFrame(previewFrameRef.current);previewFrameRef.current=null;}if(view==='composite')setPreviewRevision(v=>v+1);};
 const checkpoint=()=>{const image=snap();if(!image)return;const h=historyRef.current;h.undo.push(image);if(h.undo.length>12)h.undo.shift();h.redo=[];setHistoryTick(v=>v+1);};
 const undo=()=>{const h=historyRef.current;if(!h.undo.length)return;h.redo.push(snap());restore(h.undo.pop());setDirty(true);setHistoryTick(v=>v+1);},redo=()=>{const h=historyRef.current;if(!h.redo.length)return;h.undo.push(snap());restore(h.redo.pop());setDirty(true);setHistoryTick(v=>v+1);};
 const findOutside=(body,w,h)=>{const outside=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;const add=i=>{if(i<0||i>=outside.length||outside[i]||body[i*4+3])return;outside[i]=1;queue[tail++]=i;};for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}while(head<tail){const i=queue[head++],x=i%w;if(x)add(i-1);if(x<w-1)add(i+1);add(i-w);add(i+w);}return outside;};
 // Canvas端から本体の透明画素だけを辿った「外部」だけを除去する。目など輪郭内の透明な穴は保持する。
 const normalizeMask=(image,outside)=>{const data=image.data;for(let i=0,p=0;i<data.length;i+=4,p++){if(outside[p]||!data[i+3]){data[i]=data[i+1]=data[i+2]=data[i+3]=0;continue;}const r=data[i],g=data[i+1],b=data[i+2];data[i]=r>=g&&r>=b?255:0;data[i+1]=g>r&&g>=b?255:0;data[i+2]=b>r&&b>g?255:0;data[i+3]=255;}return image;};
 const updateWarning=()=>{const c=maskRef.current,wc=warningRef.current,outside=outsideRef.current;if(!c||!wc||!outside)return;const source=context().getImageData(0,0,c.width,c.height).data,ctx=wc.getContext('2d'),warning=ctx.createImageData(c.width,c.height);for(let p=0;p<outside.length;p++){const i=p*4;if(outside[p]&&source[i+3]){warning.data[i]=255;warning.data[i+1]=0;warning.data[i+2]=255;warning.data[i+3]=255;}}ctx.putImageData(warning,0,0);};
 const loadTarget=useCallback(async()=>{let cancelled=false;setReady(false);setError('');historyRef.current={undo:[],redo:[]};setHistoryTick(v=>v+1);try{const load=url=>new Promise((resolve,reject)=>{const image=new window.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('画像を読み込めません'));image.src=url;});const body=await load(target.imageUrl);if(cancelled)return()=>{};const w=body.naturalWidth||body.width,h=body.naturalHeight||body.height,b=bodyRef.current,m=maskRef.current,wc=warningRef.current;b.width=m.width=wc.width=w;b.height=m.height=wc.height=h;setImageSize({width:w,height:h});const bc=b.getContext('2d',{willReadFrequently:true});bc.drawImage(body,0,0,w,h);bodyDataRef.current=bc.getImageData(0,0,w,h).data;outsideRef.current=findOutside(bodyDataRef.current,w,h);
   const mc=context();mc.clearRect(0,0,w,h);if(target.maskUrl){const rawMask=await load(target.maskUrl);mc.imageSmoothingEnabled=false;mc.drawImage(rawMask,0,0,w,h);}else if(target.hasMask){const urls=await getDyeRegionMasks(target.baseId,target.imageUrl);if(urls){const layers=await Promise.all(urls.slice(0,3).map(load));layers.forEach((layer,index)=>{const temp=document.createElement('canvas');temp.width=w;temp.height=h;const tc=temp.getContext('2d');tc.drawImage(layer,0,0,w,h);tc.globalCompositeOperation='source-in';tc.fillStyle=['#f00','#0f0','#00f'][index];tc.fillRect(0,0,w,h);mc.drawImage(temp,0,0);});}}const original=mc.createImageData(w,h);original.data.set(mc.getImageData(0,0,w,h).data);originalRef.current=original;updateWarning();
   const outline=document.createElement('canvas');outline.width=w;outline.height=h;const oc=outline.getContext('2d'),alpha=bodyDataRef.current,od=oc.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(!alpha[i+3])continue;const edge=x===0||y===0||x===w-1||y===h-1||!alpha[i-4+3]||!alpha[i+4+3]||!alpha[i-w*4+3]||!alpha[i+w*4+3];if(edge){od.data[i]=255;od.data[i+1]=255;od.data[i+3]=255;}}oc.putImageData(od,0,0);outlineRef.current=outline;setDirty(false);setZoom(1);setPan({x:0,y:0});setReady(true);}catch(e){setError(e.message);}return()=>{cancelled=true;};},[target]);
 useEffect(()=>{let cleanup;loadTarget().then(fn=>cleanup=fn);return()=>cleanup?.();},[loadTarget]);
 useEffect(()=>{if(ready)updateWarning();},[ready,historyTick]);
 // 「合成」は編集補助Canvasを重ねず、編集中のPNGをBlob URLとして本番コンポーネントへ渡す。
 // これにより座標、縦横比、半透明輪郭、色変換、部位別透明度、特殊処理がゲーム内確認と同じになる。
 useEffect(()=>{if(!ready||view!=='composite')return;const c=maskRef.current,ctx=context();if(!c||!ctx)return;let cancelled=false;const source=ctx.getImageData(0,0,c.width,c.height),image=ctx.createImageData(c.width,c.height);image.data.set(source.data);normalizeMask(image,outsideRef.current);const temp=document.createElement('canvas');temp.width=c.width;temp.height=c.height;temp.getContext('2d').putImageData(image,0,0);temp.toBlob(blob=>{if(cancelled||!blob)return;const nextUrl=URL.createObjectURL(blob);setPreviewMaskUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return nextUrl;});},'image/png');return()=>{cancelled=true;};},[ready,view,historyTick,previewRevision,target.baseId]);
 useEffect(()=>()=>{if(previewFrameRef.current!==null)cancelAnimationFrame(previewFrameRef.current);setPreviewMaskUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return null;});},[]);
 const confirmDiscard=()=>!dirty||window.confirm('未書き出しの編集があります。破棄してモンスターを切り替えますか？');
 const selectTarget=index=>{if(index===targetIndex||!confirmDiscard())return;setTargetIndex(index);};
 const offsetClient=e=>{const side=pointerDistance/Math.sqrt(2);return pointerDirection==='left'?{x:e.clientX-side,y:e.clientY-side}:pointerDirection==='right'?{x:e.clientX+side,y:e.clientY-side}:{x:e.clientX,y:e.clientY-pointerDistance};};
 const pointFromClient=client=>{const c=maskRef.current,r=c.getBoundingClientRect();return{x:(client.x-r.left)*c.width/r.width,y:(client.y-r.top)*c.height/r.height};};
 const paint=(from,to)=>{const c=maskRef.current,ctx=context(),body=bodyDataRef.current,rgba=colors[color],distance=Math.hypot(to.x-from.x,to.y-from.y),count=Math.max(1,Math.ceil(distance/Math.max(1,size*.22))),radius=size/2,left=Math.max(0,Math.floor(Math.min(from.x,to.x)-radius)),top=Math.max(0,Math.floor(Math.min(from.y,to.y)-radius)),right=Math.min(c.width,Math.ceil(Math.max(from.x,to.x)+radius+1)),bottom=Math.min(c.height,Math.ceil(Math.max(from.y,to.y)+radius+1)),width=right-left,height=bottom-top;if(!width||!height)return;const image=ctx.getImageData(left,top,width,height),data=image.data;for(let n=0;n<=count;n++){const cx=from.x+(to.x-from.x)*n/count,cy=from.y+(to.y-from.y)*n/count;for(let y=Math.max(top,Math.floor(cy-radius));y<Math.min(bottom,Math.ceil(cy+radius+1));y++)for(let x=Math.max(left,Math.floor(cx-radius));x<Math.min(right,Math.ceil(cx+radius+1));x++){if((x-cx)**2+(y-cy)**2>radius**2)continue;const local=((y-top)*width+x-left)*4,global=(y*c.width+x)*4;if(color!=='eraser'&&!body[global+3])continue;data.set(rgba,local);}}ctx.putImageData(image,left,top);setDirty(true);requestCompositePreview();};
 const fill=p=>{const c=maskRef.current,ctx=context(),image=ctx.getImageData(0,0,c.width,c.height),data=image.data,body=bodyDataRef.current,rgba=colors[color],x=Math.max(0,Math.min(c.width-1,Math.floor(p.x))),y=Math.max(0,Math.min(c.height-1,Math.floor(p.y))),start=y*c.width+x,o=start*4,targetColor=[data[o],data[o+1],data[o+2],data[o+3]];if((color!=='eraser'&&!body[o+3])||targetColor.every((v,i)=>v===rgba[i]))return;checkpoint();const q=[start],seen=new Uint8Array(c.width*c.height);while(q.length){const i=q.pop();if(seen[i])continue;seen[i]=1;const d=i*4;if((color!=='eraser'&&!body[d+3])||!targetColor.every((v,j)=>data[d+j]===v))continue;data.set(rgba,d);const x=i%c.width,y=(i/c.width)|0;if(x)q.push(i-1);if(x<c.width-1)q.push(i+1);if(y)q.push(i-c.width);if(y<c.height-1)q.push(i+c.width);}ctx.putImageData(image,0,0);setDirty(true);setHistoryTick(v=>v+1);};
 const drawLoupe=p=>{if(!loupe||!p)return;const c=loupeRef.current;if(!c)return;const ctx=c.getContext('2d'),span=Math.max(12,size*3),sx=p.x-span/2,sy=p.y-span/2;ctx.clearRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(bodyRef.current,sx,sy,span,span,0,0,c.width,c.height);ctx.globalAlpha=opacity/100;ctx.drawImage(maskRef.current,sx,sy,span,span,0,0,c.width,c.height);ctx.globalAlpha=1;ctx.strokeStyle=colorCss[color];ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.width/2,c.height/2,Math.max(4,size/span*c.width/2),0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(c.width/2-7,c.height/2);ctx.lineTo(c.width/2+7,c.height/2);ctx.moveTo(c.width/2,c.height/2-7);ctx.lineTo(c.width/2,c.height/2+7);ctx.stroke();};
 useEffect(()=>{if(pointer?.p)drawLoupe(pointer.p);},[pointer,loupe,opacity,size,color]);
 const beginPan=()=>{const ps=[...pointersRef.current.values()];if(ps.length<2)return;const a=ps[0],b=ps[1];gestureRef.current={kind:'pan',mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(a.x-b.x,a.y-b.y),pan,zoom};setPointer(null);};
 const down=e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);pointersRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointersRef.current.size>=2){beginPan();return;}const now=Date.now();if(now-lastTapRef.current<300){setZoom(1);setPan({x:0,y:0});lastTapRef.current=0;return;}lastTapRef.current=now;const client=offsetClient(e),p=pointFromClient(client);setPointer({...client,p});drawLoupe(p);if(tool==='fill'){fill(p);return;}checkpoint();gestureRef.current={kind:'draw',pointerId:e.pointerId,point:p};paint(p,p);};
 const move=e=>{if(!pointersRef.current.has(e.pointerId))return;e.preventDefault();pointersRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gestureRef.current;if(pointersRef.current.size>=2){if(g?.kind!=='pan')beginPan();const pg=gestureRef.current,ps=[...pointersRef.current.values()],a=ps[0],b=ps[1],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance=Math.hypot(a.x-b.x,a.y-b.y),nextZoom=Math.max(.5,Math.min(8,pg.zoom*distance/Math.max(1,pg.distance)));setZoom(nextZoom);setPan({x:pg.pan.x+mid.x-pg.mid.x,y:pg.pan.y+mid.y-pg.mid.y});return;}if(!g||g.kind!=='draw'||g.pointerId!==e.pointerId)return;const client=offsetClient(e),p=pointFromClient(client);setPointer({...client,p});drawLoupe(p);paint(g.point,p);g.point=p;};
 const up=e=>{pointersRef.current.delete(e.pointerId);if(pointersRef.current.size<2&&gestureRef.current?.kind==='pan')gestureRef.current=null;if(!pointersRef.current.size){gestureRef.current=null;setPointer(null);}setHistoryTick(v=>v+1);flushCompositePreview();};
 const resetOriginal=()=>{if(!dirty||window.confirm('編集中の内容を破棄して元マスクを再読込しますか？')){restore(originalRef.current);historyRef.current={undo:[],redo:[]};setDirty(false);setHistoryTick(v=>v+1);}},clearAll=()=>{if(window.confirm('現在のマスクを全消去しますか？')){checkpoint();context().clearRect(0,0,maskRef.current.width,maskRef.current.height);setDirty(true);setHistoryTick(v=>v+1);}},cleanOutside=()=>{const c=maskRef.current,image=context().getImageData(0,0,c.width,c.height),outside=outsideRef.current;let changed=false;for(let p=0;p<outside.length;p++){const i=p*4;if(outside[p]&&image.data[i+3]){image.data[i]=image.data[i+1]=image.data[i+2]=image.data[i+3]=0;changed=true;}}if(!changed)return;checkpoint();context().putImageData(image,0,0);setDirty(true);setHistoryTick(v=>v+1);};
 const exportPng=()=>{const c=maskRef.current,image=normalizeMask(context().getImageData(0,0,c.width,c.height),outsideRef.current);context().putImageData(image,0,0);c.toBlob(blob=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`${target.id}-dye-mask.PNG`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setDirty(false);},'image/png');};
 const tryInGame=()=>{const c=maskRef.current;if(!c||!ready)return;const image=normalizeMask(context().getImageData(0,0,c.width,c.height),outsideRef.current);context().putImageData(image,0,0);c.toBlob(blob=>{if(blob)onTryInGame(target,blob,previewColors);},'image/png');};
 const close=()=>{if(confirmDiscard())onClose();},colorButton=(id,label,bg)=><button onClick={()=>setColor(id)} aria-pressed={color===id} className={`min-h-[42px] rounded-xl border-2 text-[9px] font-black ${color===id?'border-white':'border-transparent'}`} style={{backgroundColor:bg}}>{label}</button>,history=historyRef.current,filtered=targets.map((t,i)=>({t,i})).filter(({t})=>t.name.includes(search)||t.baseId.toLowerCase().includes(search.toLowerCase()));
 return <main className={`${active?'flex':'hidden'} fixed inset-0 z-50 flex-col overflow-hidden bg-slate-950`} style={{paddingTop:'max(.25rem,env(safe-area-inset-top))'}}><header className="flex h-10 shrink-0 items-center px-1"><button onClick={close} className="min-h-[40px] min-w-[40px]"><ArrowLeft size={20}/></button><div className="min-w-0"><small className="block text-[7px] font-black text-cyan-400">DEBUG・メモリ上だけ／再読込で消去</small><h2 className="truncate text-[11px] font-black">汎用染色マスクエディタ</h2></div><button onClick={exportPng} disabled={!ready} className="ml-auto min-h-[36px] rounded-xl bg-cyan-600 px-2 text-[8px] font-black disabled:opacity-40">PNG書出</button></header>
 <section className="shrink-0 px-2 pb-1"><div className="grid grid-cols-[38px_1fr_38px] gap-1"><button onClick={()=>selectTarget((targetIndex-1+targets.length)%targets.length)} className="rounded-lg bg-slate-800" aria-label="前のモンスター">←</button><select aria-label="モンスター選択" value={targetIndex} onChange={e=>selectTarget(+e.target.value)} className="min-h-[34px] min-w-0 rounded-lg bg-slate-800 px-2 text-[9px] font-black">{targets.map((t,i)=><option key={t.baseId} value={i}>{t.name}／{t.hasMask?'染色マスクあり':'染色マスクなし'}</option>)}</select><button onClick={()=>selectTarget((targetIndex+1)%targets.length)} className="rounded-lg bg-slate-800" aria-label="次のモンスター">→</button></div><input value={search} onChange={e=>setSearch(e.target.value)} list="dye-mask-monsters" placeholder="名前検索" className="mt-1 min-h-[30px] w-full rounded-lg bg-slate-800 px-2 text-[9px]"/><datalist id="dye-mask-monsters">{filtered.map(({t})=><option key={t.baseId} value={t.name}/>)}</datalist>{search&&filtered.length>0&&<button onClick={()=>{selectTarget(filtered[0].i);setSearch('');}} className="mt-1 w-full rounded bg-cyan-900 py-1 text-[8px]">「{filtered[0].t.name}」を選択</button>}<p className={`text-center text-[8px] font-black ${target.hasMask?'text-emerald-300':'text-amber-300'}`}>{target.name}・{target.hasMask?'既存の染色マスクを読込':'染色マスクなし（完全透明から開始）'}{dirty?'・未書き出し':''}</p></section>
 <div className="grid shrink-0 grid-cols-4 gap-1 px-2">{[['composite','合成'],['body','本体のみ'],['mask','マスクのみ'],['boundary','境界確認']].map(([id,label])=><button key={id} onClick={()=>setView(id)} className={`min-h-[30px] rounded-lg text-[8px] font-black ${view===id?'bg-cyan-700':'bg-slate-800'}`}>{label}</button>)}</div>
 <section className="relative m-2 min-h-0 flex-1 overflow-hidden rounded-xl bg-slate-600" style={{touchAction:'none'}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{error?<p className="p-4 text-center text-red-200">{error}</p>:!ready&&<p className="p-4 text-center">画像を読み込み中…</p>}<div className="absolute inset-0 flex items-center justify-center" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,pointerEvents:ready?'auto':'none'}}><div className="relative max-h-full max-w-full" style={{height:'100%',aspectRatio:`${imageSize.width} / ${imageSize.height}`}}>{view==='composite'&&previewMaskUrl&&<DyedMonsterImage baseId={target.baseId} src={target.imageUrl} alt={`${target.name}合成`} masuColors={previewColors} debugMaskPlacement={{maskUrl:previewMaskUrl}} className="absolute inset-0 h-full w-full object-contain"/>}<canvas ref={bodyRef} aria-label={`${target.name}本体レイヤー`} className="absolute inset-0 h-full w-full" style={{display:view==='mask'||view==='composite'?'none':'block'}}/><canvas ref={maskRef} aria-label="染色マスク編集レイヤー" className="absolute inset-0 h-full w-full" style={{display:view==='body'?'none':'block',opacity:view==='composite'?0:view==='boundary'?opacity/100:1}}/>{view==='boundary'&&outlineRef.current&&<img src={outlineRef.current.toDataURL()} alt="本体の外周" className="pointer-events-none absolute inset-0 h-full w-full"/>}<canvas ref={warningRef} aria-label="本体範囲外のマスク警告" className="pointer-events-none absolute inset-0 h-full w-full" style={{display:view==='boundary'?'block':'none'}}/></div></div>{loupe&&pointer&&<canvas ref={loupeRef} width="120" height="120" aria-label="拡大鏡" className="pointer-events-none absolute left-2 top-2 rounded-full border-2 border-white bg-slate-950 shadow-xl"/>}{pointer&&<div className="pointer-events-none fixed z-10 rounded-full border-2" style={{left:pointer.x-size*zoom/2,top:pointer.y-size*zoom/2,width:size*zoom,height:size*zoom,borderColor:colorCss[color],background:color==='eraser'?'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,.7) 3px,rgba(255,255,255,.7) 5px)':'transparent'}}><span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 bg-white"/><span className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-white"/></div>}</section>
 <section className="shrink-0 rounded-t-2xl border-t-2 border-cyan-400 bg-slate-900 px-2 pt-1" style={{paddingBottom:'max(.4rem,env(safe-area-inset-bottom))'}}><div className="grid grid-cols-8 gap-1">{colorButton('red','赤','#f00')}{colorButton('green','緑','#080')}{colorButton('blue','青','#00f')}{colorButton('eraser','消す','#475569')}<button onClick={undo} disabled={!history.undo.length} className="rounded-xl bg-slate-700 text-[7px] disabled:opacity-30">Undo</button><button onClick={redo} disabled={!history.redo.length} className="rounded-xl bg-slate-700 text-[7px] disabled:opacity-30">Redo</button><button onClick={()=>setTool('brush')} className={`rounded-xl text-[7px] ${tool==='brush'?'bg-violet-700':'bg-slate-700'}`}>ブラシ</button><button onClick={()=>setTool('fill')} className={`rounded-xl text-[7px] ${tool==='fill'?'bg-violet-700':'bg-slate-700'}`}>塗りつぶし</button></div><div className="mt-1 grid grid-cols-3 gap-1"><button onClick={tryInGame} disabled={!ready} className="min-h-[38px] rounded-lg bg-fuchsia-700 text-[8px] font-black disabled:opacity-40">ゲームで試す</button><button onClick={()=>onReleaseTemporary(target.baseId)} disabled={!temporaryMasks[target.baseId]} className="rounded-lg bg-amber-800 text-[7px] font-black disabled:opacity-30">一時反映を解除</button><button onClick={onReleaseAllTemporary} disabled={!Object.keys(temporaryMasks).length} className="rounded-lg bg-red-900 text-[8px] font-black disabled:opacity-30">すべて解除</button></div>{temporaryMasks[target.baseId]&&<p className="pt-0.5 text-center text-[8px] font-black text-fuchsia-300">● 一時反映中</p>}<button onClick={()=>setDetails(v=>!v)} className="mt-1 min-h-[28px] w-full rounded-lg bg-slate-700 text-[8px]">詳細 {details?'▲':'▼'}</button>{details&&<div className="mt-1 grid grid-cols-2 gap-2 rounded-xl bg-slate-800 p-2 text-[8px]"><div className="col-span-2 grid grid-cols-3 gap-1">{Array.from({length:dyeRegionCount(target.baseId)},(_,idx)=><label key={idx} className="text-[7px] text-fuchsia-200">染色{'①②③④⑤'[idx]}<select value={previewColors[idx]||''} onChange={e=>setPreviewColors(current=>{const next=[...current];next[idx]=e.target.value||null;return next;})} className="block min-h-[28px] w-full rounded bg-slate-700 text-[8px]"><option value="">元の色</option>{Object.keys(MASU_COLOR_TARGET).map(id=><option key={id} value={id}>{MASU_COLOR_LABELS[id]}</option>)}</select></label>)}</div><label>ブラシ {size}px<input className="block w-full" type="range" min="2" max="100" step="2" value={size} onChange={e=>setSize(+e.target.value)}/></label><label>透明度 {opacity}%<input className="block w-full" type="range" min="25" max="100" step="25" value={opacity} onChange={e=>setOpacity(+e.target.value)}/></label><label>ポインター距離<select value={pointerDistance} onChange={e=>setPointerDistance(+e.target.value)} className="block w-full bg-slate-700">{[0,30,50,70].map(n=><option key={n} value={n}>{n}px</option>)}</select></label><label>方向<select value={pointerDirection} onChange={e=>setPointerDirection(e.target.value)} className="block w-full bg-slate-700"><option value="up">真上</option><option value="left">左上</option><option value="right">右上</option></select></label><button onClick={()=>setLoupe(v=>!v)} className="rounded bg-slate-700">拡大鏡 {loupe?'ON':'OFF'}</button><button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} className="rounded bg-slate-700">全体表示</button><button onClick={cleanOutside} className="rounded bg-fuchsia-900">範囲外を掃除</button><button onClick={clearAll} className="rounded bg-red-900">全消去</button><button onClick={resetOriginal} className="rounded bg-amber-900">元マスク再読込</button></div>}<p className="pt-1 text-center text-[7px] text-slate-400">1本指：描画・2本指：パン/ピンチ・ダブルタップ：全体表示・{Math.round(zoom*100)}%</p></section></main>;
};

// タップは1回、長押しは一定間隔で繰り返す。Pointer Eventsを使ってタッチを優先し、
// 指が外れた時と画面破棄時のどちらでもタイマーを残さない。
function PressRepeatButton({ onPress, disabled, className, children, ...props }) {
  const delayRef = useRef(null), repeatRef = useRef(null), longPressedRef = useRef(false);
  const clearPress = useCallback(() => {
    if (delayRef.current !== null) clearTimeout(delayRef.current);
    if (repeatRef.current !== null) clearInterval(repeatRef.current);
    delayRef.current = repeatRef.current = null;
  }, []);
  useEffect(() => clearPress, [clearPress]);
  const startPress = event => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    clearPress(); longPressedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    delayRef.current = setTimeout(() => {
      longPressedRef.current = true; onPress();
      repeatRef.current = setInterval(onPress, 110);
    }, 420);
  };
  const clickPress = event => {
    if (longPressedRef.current) { longPressedRef.current = false; event.preventDefault(); return; }
    onPress();
  };
  return <button type="button" disabled={disabled} onPointerDown={startPress} onPointerUp={clearPress} onPointerCancel={clearPress} onLostPointerCapture={clearPress} onClick={clickPress} className={className} style={{touchAction:'manipulation',WebkitTouchCallout:'none'}} {...props}>{children}</button>;
}

// 終わり際に離す猶予(RHYTHM_HOLD_RELEASE_GRACE_MS)と、
// 途中で指を持ち替える猶予(RHYTHM_HOLD_HANDOVER_GRACE_MS)は data/rhythm-mode.js が持つ。
// 持ち替えは「指を離す側(ここ)」と「置き直した指をノーツへ結びつける側(rhythm-mode.js)」の
// 両方が同じ数字を見ないと成立しないので、先に読み込まれるほうへ1つだけ置いてある。
// 最後まで取れたHOLD / SLIDE / FLICKを、消える前に光らせておく時間(CSSのアニメーションと同じ長さ)
const RHYTHM_CLEAR_FLASH_MS=260;
const RHYTHM_JUDGMENT_DISPLAY_MS=450;
// 能力の発動表示(「ミーア　元気！」)。判定表示より少し長く出して、何が起きたか読めるようにする
const RHYTHM_MONSTER_ABILITY_DISPLAY_MS=1400;
const rhythmInputKey=(kind,id)=>`${kind}:${id}`;
// 6.0はSTEP1以前の見た目(2150ms)を厳密に維持しつつ、1.0(約7000ms)〜12.0(約500ms)まで
// 音ゲーとして意味のある幅へ広げる。整数速度を基準点として0.1刻みで線形補間する。
// 低速側は等差で「ゆっくり見える」幅を確保し、高速側は約1.27倍ずつの等比で詰めるため、
// どの帯域でも0.1動かせば見た目が変わる。
// authored note time・BPM・beatZero・判定窓・入力時刻・スコアには使わず、描画travelだけに使用する。
// 譜面より音源が長い曲を途中で終わらせるときの、音の落とし方。
// FADE=消していく時間 / MARGIN=「音源のほうが長い」と見なす差
// (これより短い差なら曲が自然に終わるところなので、何もしない)。
const RHYTHM_END_FADE_MS=1400;
const RHYTHM_END_FADE_MARGIN_MS=1500;
const RHYTHM_NOTE_TRAVEL_BASE_MS=2150;
const RHYTHM_NOTE_TRAVEL_MS_POINTS=Object.freeze([7000,6000,5000,4000,3000,RHYTHM_NOTE_TRAVEL_BASE_MS,1680,1300,1020,800,630,500]);
// 横画面で「見た目の飛行時間(travelMs)をプレイエリアの高さに応じて伸ばす」対応を一度入れたが、
// 実機フィードバックで「落下速度が遅くなるのはおかしい、縦画面と同じにしてほしい」と指摘され
// 取り消した(2026-09-03)。travelMsは向きに関係なく常にrhythmTravelMsForSpeedの値のみを使う。
const rhythmTravelMsForSpeed=value=>{
  // null / undefined / 空文字は「値なし」として既定へ落とす(Number()では0になってしまう)。
  const raw=value==null||value===''?NaN:Number(value),fallback=DEFAULT_RHYTHM_SETTINGS.noteSpeed;
  const speed=Math.max(RHYTHM_NOTE_SPEED_MIN,Math.min(RHYTHM_NOTE_SPEED_MAX,Number.isFinite(raw)?raw:fallback));
  const offset=speed-RHYTHM_NOTE_SPEED_MIN;
  const index=Math.max(0,Math.min(RHYTHM_NOTE_TRAVEL_MS_POINTS.length-2,Math.floor(offset)));
  const from=RHYTHM_NOTE_TRAVEL_MS_POINTS[index],to=RHYTHM_NOTE_TRAVEL_MS_POINTS[index+1];
  return Math.round(from+(to-from)*(offset-index));
};
const rhythmStepOptionValue=(value,min,max,step,direction)=>Math.max(min,Math.min(max,Number((Number(value)+direction*step).toFixed(6))));
// スライダーでつまんだ値を、その項目の目盛り(step)に合わせて丸める。
// 範囲外・数値でない値は必ず範囲の中へ収める(壊れた値を設定へ入れない)。
const rhythmSnapOptionValue=(value,min,max,step)=>{
  const raw=Number(value);
  if(!Number.isFinite(raw))return min;
  const snapped=min+Math.round((raw-min)/step)*step;
  return Math.max(min,Math.min(max,Number(snapped.toFixed(6))));
};
// 縦画面のときだけ出す「横画面にも対応している」案内(2026-09-05・ユーザー指示)。
// 音ゲー中(RHYTHM_PLAY)には置かない。プレイ中に文字が増えると譜面が読みにくくなるため。
// 出し分けはCSS(portrait:)だけで行う。JSで向きを見張ると、回すたびに再描画が走って重くなる。
const RhythmLandscapeHint=({className=''})=>
  <p data-rhythm-landscape-hint className={`hidden portrait:block rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[9px] font-bold leading-relaxed text-cyan-100 ${className}`}>
    📱 横画面にも対応しています。端末を横にすると、曲の一覧と選んだ曲を左右に並べて見られます。曲えらびの「🔄 横」ボタンからも切り替えられます。
  </p>;
// ============================================================================
// 縦画面 ⇄ 横画面の切り替え
// ============================================================================
// 【2026-09-05・ユーザー指示】
// 「モンビーのホーム画面に縦画面横画面切り替えボタンを作って／縦なら横に横なら縦に変わるボタン」。
//
// 【なぜ要るか】
// 端末側の画面回転ロックを入れていると、本体を横にしても画面は縦のままになる。
// モンビーは横画面のほうが曲の一覧と選んだ曲を同時に見られるのに、
// 回転ロックを解除しに設定アプリまで行かないと横にできなかった。
//
// 【どうやるか】
// ブラウザの screen.orientation.lock() で向きを指定する。多くのブラウザは
// 「全画面表示のあいだだけ」向きの固定を許すので、必要なら先に全画面へ入る。
// iOSのSafariのように lock() 自体が無い環境もあるため、できなかったときは
// 黙って何も起きないのではなく「端末を回してください」と案内へ切り替える。
const screenOrientationApi=()=>{
  if(typeof window==='undefined')return null;
  const o=window.screen&&window.screen.orientation;
  return (o&&typeof o.lock==='function')?o:null;
};
// いま横向きかどうか。screen.orientation が無い端末では画面の比率で見る
const orientationIsLandscape=()=>{
  if(typeof window==='undefined')return false;
  const o=window.screen&&window.screen.orientation;
  if(o&&typeof o.type==='string')return o.type.indexOf('landscape')===0;
  if(typeof window.matchMedia==='function')return window.matchMedia('(orientation: landscape)').matches;
  return window.innerWidth>window.innerHeight;
};
// ボタンで向きを固定したかどうか。モンビーを離れるときに戻すために覚えておく
// (プレイ画面へ移るだけで戻してしまうと、演奏の途中で向きが変わってしまう)
let screenOrientationLockedByUs=false;
// 全画面を抜けると、ブラウザが向きの固定も一緒に外す。
// こちらが知らないうちに外れることがある(端末の「戻る」ボタン・スワイプなど)ので、
// 外れたことに気づいて控えも合わせておく。合っていないと、モンビーを離れるときに
// 「もう外れている固定」を外そうとしたり、逆に外し忘れたりする。
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  document.addEventListener('fullscreenchange',()=>{
    if(!document.fullscreenElement)screenOrientationLockedByUs=false;
  });
}
// 向きが**実際に変わる**のを待つ。
// lock() は「受け付けた」だけで解決することがあり、画面が回るのはそのあと。
// ここを待たずに次へ進むと、回っていないのに「できた」と扱ってしまい、
// 押しても何も起きないのに案内も出ない、という状態になる。
const waitForScreenOrientation=(want,timeoutMs=900)=>{
  const wantLandscape=want==='landscape';
  if(orientationIsLandscape()===wantLandscape)return Promise.resolve(true);
  if(typeof window==='undefined')return Promise.resolve(false);
  return new Promise(resolve=>{
    let settled=false;
    const orientation=window.screen&&window.screen.orientation;
    const mql=typeof window.matchMedia==='function'?window.matchMedia('(orientation: landscape)'):null;
    const cleanup=()=>{
      clearTimeout(timer);
      if(orientation&&orientation.removeEventListener)orientation.removeEventListener('change',onChange);
      if(mql){
        if(mql.removeEventListener)mql.removeEventListener('change',onChange);
        else if(mql.removeListener)mql.removeListener(onChange);
      }
      if(typeof window.removeEventListener==='function')window.removeEventListener('resize',onChange);
    };
    const finish=value=>{if(settled)return;settled=true;cleanup();resolve(value);};
    const onChange=()=>{if(orientationIsLandscape()===wantLandscape)finish(true);};
    const timer=setTimeout(()=>finish(orientationIsLandscape()===wantLandscape),timeoutMs);
    if(orientation&&orientation.addEventListener)orientation.addEventListener('change',onChange);
    if(mql){
      if(mql.addEventListener)mql.addEventListener('change',onChange);
      else if(mql.addListener)mql.addListener(onChange);
    }
    if(typeof window.addEventListener==='function')window.addEventListener('resize',onChange);
  });
};
// target: 'landscape' | 'portrait'。**実際にその向きになったら** true を返す
// (ならなければ案内を出す側で使う)。
//
// 【2026-09-06・Androidの利用者からの報告「横にはできるけど縦にはできないときがある」】
// 縦へ戻す側だけ作りが違っていたのが原因だった。前は
//   ① portrait で固定する → ② 全画面を抜ける → ③ 抜けたら「できた」とみなす
// という順で、②で**固定が自動的に外れる**。Androidのブラウザは全画面のあいだしか
// 向きの固定を許さないので、全画面を抜けた瞬間に端末のセンサーの向きへ戻る。
// 本体を横に持っていれば、そのまま横へ戻ってしまう。しかも③で「できた」と返すので、
// 画面は横のままなのに案内も出ない＝「押しても何も起きない」になっていた。
// 本体を縦に持っている人だけたまたま成功するので、「ときがある」という出方になる。
//
// いまは縦も横も**同じ道**を通す。全画面へ入り、固定し、実際に向きが変わるまで待つ。
// 全画面は抜けない(抜けると固定が外れるため)。モンビーを離れるときにまとめて戻す。
const applyScreenOrientation=async(target)=>{
  const orientation=screenOrientationApi();
  const root=(typeof document!=='undefined')?document.documentElement:null;
  if(!orientation||!root)return false;
  // 向きの固定は「全画面のあいだだけ」許すブラウザが多い。縦へ戻すときも同じ。
  // ここで入れなくても lock だけ通ることがあるので、失敗しても先へ進む。
  if(!document.fullscreenElement&&typeof root.requestFullscreen==='function'){
    try{await root.requestFullscreen({navigationUI:'hide'});}catch(_){}
  }
  try{await orientation.lock(target);}catch(_){return false;}
  // 受け付けられても、実際に回るまでは「できた」と言わない
  if(!await waitForScreenOrientation(target))return false;
  // 縦でも横でも、固定を持っているあいだは覚えておく(離れるときに戻すため)
  screenOrientationLockedByUs=true;
  return true;
};
// モンビーを離れるときの後始末。ボタンで固定したときだけ戻す。
// これが無いと、横のままHOMEへ戻ったときにゲーム全体が横＋全画面のままになり、
// 縦向きで作ってあるHOMEやバトルの画面が崩れる。
// 自分で固定していないとき(端末を横向きに持っているだけ)には何もしない。
const releaseScreenOrientation=()=>{
  if(!screenOrientationLockedByUs)return false;
  screenOrientationLockedByUs=false;
  const orientation=screenOrientationApi();
  if(orientation&&typeof orientation.unlock==='function'){try{orientation.unlock();}catch(_){}}
  if(typeof document!=='undefined'&&document.fullscreenElement&&typeof document.exitFullscreen==='function'){
    try{document.exitFullscreen();}catch(_){}
  }
  return true;
};
// ============================================================================
// 演奏中は通知を出さない
// ============================================================================
// 【2026-09-05・ユーザーからの相談】
// 「演奏中のみ物理的に端末の通知を出さないようにすることは可能？ オプションでオンオフできて」
// 「演奏中に通知来ると上が見えなくなって無理になる」
//
// 【できること・できないこと】
// ブラウザのページから**端末の通知そのものを止めるしくみは無い**。ここは正直に書いておく。
// ページ側からできるのは次の2つだけ。
//   ① 全画面表示へ入る … Androidのブラウザでは、全画面のあいだ画面いちばん上の通知バーが
//      隠れる。通知が上から降りてくる表示も出にくくなる(端末と設定によっては出る)
//   ② 画面を消させない(Screen Wake Lock) … 演奏の途中で画面が暗くなる・ロックされるのを防ぐ
// iPhoneのSafariには、ページからの全画面もWake Lockも無い
// (ホーム画面へ追加して開いた場合はWake Lockが使えることがある)。
// 通知そのものを止めたいときは、端末側の「集中モード」を使ってもらうしかない。
//
// できないのに「ONにすれば止まる」と見せるのがいちばん困るので、
// オプションにはこの端末で実際に何ができるかを必ず添える(rhythmQuietModeSupportText)。
const rhythmQuietModeCan=()=>({
  fullscreen:typeof document!=='undefined'&&typeof document.documentElement?.requestFullscreen==='function',
  wakeLock:typeof navigator!=='undefined'&&!!navigator.wakeLock&&typeof navigator.wakeLock.request==='function',
});
const rhythmQuietModeSupportText=()=>{
  const can=rhythmQuietModeCan();
  const tail='通知そのものを止めることはブラウザからはできないので、確実に止めたいときは端末の「集中モード」もお使いください。';
  if(can.fullscreen&&can.wakeLock)
    return `この端末では、演奏のあいだだけ全画面にして、画面が消えないようにできます。全画面のあいだは画面いちばん上の通知バーが隠れるので、通知が降りてくる表示も出にくくなります。${tail}`;
  if(can.fullscreen)
    return `この端末では、演奏のあいだだけ全画面にできます。全画面のあいだは画面いちばん上の通知バーが隠れます。画面が消えないようにする機能はこのブラウザにはありません。${tail}`;
  if(can.wakeLock)
    return `この端末では、演奏のあいだ画面が消えないようにできます。全画面にする機能がこのブラウザには無いため、通知バーは隠せません。${tail}`;
  return `この端末のブラウザでは、全画面にすることも画面が消えないようにすることもできません。ONにしても何も起きないので、通知を止めたいときは端末の「集中モード」をお使いください。`;
};
const RHYTHM_QUIET_MODE=(()=>{
  let fullscreenByUs=false,wakeLock=null,watching=false;
  // 画面を伏せる・別のアプリへ行くと、Wake Lockはブラウザが勝手に外す。
  // 戻ってきたときに取り直さないと、そこから先は画面が消えるようになってしまう
  const reacquire=async()=>{
    if(!wakeLock&&!watching)return;
    if(typeof document==='undefined'||document.visibilityState!=='visible')return;
    if(wakeLock)return;
    try{wakeLock=await navigator.wakeLock.request('screen');}catch(_){}
  };
  const onVisibility=()=>{reacquire();};
  const enter=async()=>{
    const can=rhythmQuietModeCan();
    if(can.fullscreen&&!document.fullscreenElement){
      try{await document.documentElement.requestFullscreen({navigationUI:'hide'});fullscreenByUs=true;}catch(_){}
    }
    if(can.wakeLock&&!wakeLock){
      try{
        wakeLock=await navigator.wakeLock.request('screen');
        if(!watching){watching=true;document.addEventListener('visibilitychange',onVisibility);}
      }catch(_){}
    }
    return fullscreenByUs||!!wakeLock;
  };
  const exit=async()=>{
    if(wakeLock){try{await wakeLock.release();}catch(_){}wakeLock=null;}
    if(watching){watching=false;document.removeEventListener('visibilitychange',onVisibility);}
    // 自分で入った全画面だけ抜ける。縦横の切り替えで入っているぶんまで抜くと、
    // 演奏が終わった瞬間に画面が縦へ戻ってしまう
    if(fullscreenByUs){
      fullscreenByUs=false;
      if(typeof document!=='undefined'&&document.fullscreenElement&&typeof document.exitFullscreen==='function'){
        try{await document.exitFullscreen();}catch(_){}
      }
    }
  };
  return {enter,exit,can:rhythmQuietModeCan};
})();
// 切り替えボタン本体。向きの見張りをこの中だけで持つのは、
// 画面全体の状態にすると回すたびにアプリ全部が描き直されるため
// (プレイ中の描き直しはカクつきに直結する)。
const RhythmOrientationButton=({className=''})=>{
  const [landscape,setLandscape]=useState(()=>orientationIsLandscape());
  const [note,setNote]=useState('');
  useEffect(()=>{
    if(typeof window==='undefined'||typeof window.matchMedia!=='function')return undefined;
    const mql=window.matchMedia('(orientation: landscape)');
    const onChange=()=>setLandscape(orientationIsLandscape());
    onChange();
    if(mql.addEventListener)mql.addEventListener('change',onChange);
    else if(mql.addListener)mql.addListener(onChange);
    return ()=>{
      if(mql.removeEventListener)mql.removeEventListener('change',onChange);
      else if(mql.removeListener)mql.removeListener(onChange);
    };
  },[]);
  useEffect(()=>{
    if(!note)return undefined;
    const timer=setTimeout(()=>setNote(''),8000);
    return ()=>clearTimeout(timer);
  },[note]);
  // 回している最中にもう一度押されると、固定の指示が二重に飛んで
  // 端末側が混乱する(片方だけ効いて向きと表示が食い違う)。押している間は受け付けない。
  const [busy,setBusy]=useState(false);
  const target=landscape?'portrait':'landscape';
  const label=landscape?'縦画面にする':'横画面にする';
  const wanted=landscape?'縦':'横';
  const toggle=async()=>{
    if(busy)return;
    setBusy(true);
    setNote('');
    try{
      const ok=await applyScreenOrientation(target);
      setLandscape(orientationIsLandscape());
      if(ok)return;
      // できなかった理由で案内を書き分ける。
      // 「回す機能そのものが無い」ブラウザ(iPhoneのSafariなど)と、
      // 「機能はあるが断られた」場合とで、やってもらうことが違う。
      setNote(screenOrientationApi()
        ?`画面を${wanted}にできませんでした。全画面にできないブラウザでは向きを変えられないことがあります。お手数ですが本体を${wanted}向きにしてお使いください。`
        :`このブラウザには画面を回す機能がありません。端末の「画面の自動回転」をオンにして、本体を${wanted}向きにしてください。`);
    }finally{setBusy(false);}
  };
  return <div className={`relative shrink-0 ${className}`}>
    <button data-rhythm-orientation-toggle data-orientation={landscape?'landscape':'portrait'}
      aria-label={label} title={label} onClick={toggle} disabled={busy} aria-busy={busy?'true':undefined}
      className="flex min-h-[44px] min-w-[40px] flex-col items-center justify-center gap-0.5 rounded-xl border border-emerald-400/50 bg-emerald-950/40 leading-none text-emerald-100 disabled:opacity-60">
      <span aria-hidden="true" className="text-base leading-none">🔄</span>
      <span className="text-[7px] font-black leading-none">{landscape?'縦':'横'}</span>
    </button>
    {note!==''&&<p data-rhythm-orientation-note onClick={()=>setNote('')}
      className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-amber-300/50 bg-slate-900/95 px-2 py-1.5 text-[9px] font-bold leading-relaxed text-amber-100 shadow-lg">{note}</p>}
  </div>;
};
// ============================================================================
// タップのタイミング合わせ
// ============================================================================
// 【2026-09-05・ユーザー指示】
// 「レーンとノーツに合わせて何回かタップして調整するみたいなやつ」。
// 音ゲーによくある形で、一定の間隔で流れてくる目印に合わせて叩き、
// そのずれの平均から「判定タイミング調整」の値を決める。
//
// 【なぜ要るか】
// 画面に見えてから指が触れて、端末がそれを知らせるまでの遅れは端末ごとに違う。
// 20〜40msほどあり、いちばん良い判定(±55ms)の半分を食う。
// 目分量で合わせるのは難しいので、実際に叩いた結果から決める。
//
// 【測り方】
//   ・一定の間隔(RHYTHM_CALIBRATION_BEAT_MS)で目印が判定ラインへ来る
//   ・そのときのタップの時刻とのずれを集める
//   ・外れ値(いちばん大きいものといちばん小さいもの)を落として平均を取る
//     …1回の押し間違いで全部が狂わないようにするため
//   ・平均を5ms刻みへ丸めて、-100〜+100の範囲に収める(設定と同じ刻み・範囲)
//
// 時刻は音と同じ AudioContext ではなく performance.now() を使う。
// ここでは音を鳴らさず、目印の動きだけに合わせてもらうため。
const RHYTHM_CALIBRATION_BEAT_MS=1000;      // 目印が来る間隔。1秒ちょうどで数えやすくする
const RHYTHM_CALIBRATION_TAPS=8;            // 何回叩いてもらうか
const RHYTHM_CALIBRATION_DROP_EACH_END=1;   // 外れ値として上下いくつずつ落とすか
const RHYTHM_CALIBRATION_MAX_MS=100;        // 設定の範囲と同じ
const RHYTHM_CALIBRATION_STEP_MS=5;         // 設定の刻みと同じ
// 集めたずれから、設定へ入れる値を出す。ここだけ切り出してあるので検査から直接動かせる。
const rhythmCalibrationOffsetFromTaps=(deltas)=>{
  const list=(Array.isArray(deltas)?deltas:[]).filter(value=>Number.isFinite(Number(value))).map(Number).sort((a,b)=>a-b);
  if(!list.length)return null;
  // 上下を落とす。落としたあとに何も残らないなら落とさない
  const drop=list.length>RHYTHM_CALIBRATION_DROP_EACH_END*2?RHYTHM_CALIBRATION_DROP_EACH_END:0;
  const used=drop?list.slice(drop,list.length-drop):list;
  const mean=used.reduce((sum,value)=>sum+value,0)/used.length;
  const stepped=Math.round(mean/RHYTHM_CALIBRATION_STEP_MS)*RHYTHM_CALIBRATION_STEP_MS;
  return {offsetMs:Math.max(-RHYTHM_CALIBRATION_MAX_MS,Math.min(RHYTHM_CALIBRATION_MAX_MS,stepped)),
    usedCount:used.length,droppedCount:list.length-used.length,rawMeanMs:Math.round(mean)};
};

// 実際に叩いてもらう部品。オプションの中へ置く。
// レーンを1本だけ出し、ノーツが上から降りてきて判定ラインへ来る。それに合わせて叩く。
// 判定・スコア・譜面には一切関わらない(ここで測るのは「ずれ」だけ)。
const RhythmTimingCalibrator=({onApply,onClose,currentOffsetMs=0})=>{
  const [taps,setTaps]=useState([]);
  const [running,setRunning]=useState(false);
  const startRef=useRef(0);
  const frameRef=useRef(null);
  const noteRef=useRef(null);
  const areaRef=useRef(null);
  const tapsRef=useRef([]);
  const result=rhythmCalibrationOffsetFromTaps(taps);

  const stop=useCallback(()=>{
    if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);
    frameRef.current=null;setRunning(false);
  },[]);
  useEffect(()=>()=>{if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);},[]);

  const start=()=>{
    setTaps([]);tapsRef.current=[];
    startRef.current=performance.now();
    setRunning(true);
    const tick=()=>{
      const area=areaRef.current,note=noteRef.current;
      if(!area||!note){frameRef.current=requestAnimationFrame(tick);return;}
      const elapsed=performance.now()-startRef.current;
      // 1拍ぶんを上から判定ラインまで動かし、着いたら次の拍へ回す
      const phase=(elapsed%RHYTHM_CALIBRATION_BEAT_MS)/RHYTHM_CALIBRATION_BEAT_MS;
      const height=area.clientHeight||120;
      note.style.transform=`translate3d(0,${Math.round(phase*(height-18))}px,0)`;
      if(tapsRef.current.length>=RHYTHM_CALIBRATION_TAPS){stop();return;}
      frameRef.current=requestAnimationFrame(tick);
    };
    frameRef.current=requestAnimationFrame(tick);
  };

  const tap=()=>{
    if(!running)return;
    const elapsed=performance.now()-startRef.current;
    // いちばん近い拍からのずれ。早ければマイナス、遅ければプラス
    const nearest=Math.round(elapsed/RHYTHM_CALIBRATION_BEAT_MS)*RHYTHM_CALIBRATION_BEAT_MS;
    const delta=elapsed-nearest;
    // 最初の1拍は目印がまだ降りきっていないので数えない
    if(elapsed<RHYTHM_CALIBRATION_BEAT_MS)return;
    const next=[...tapsRef.current,delta];
    tapsRef.current=next;setTaps(next);
    RHYTHM_NOTE_SE_RUNTIME.playEmpty();
  };

  // 【2026-09-05・ユーザー指示】「タップ調整が窮屈で見にくい／専用画面に飛ばしたほうがいい」
  // オプションの中の小さな枠(高さ112px)ではなく、画面いっぱいで開く。
  // 叩く場所が広いほど、実際のプレイに近い姿勢で測れる。
  return <main data-rhythm-calibrator className="flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-950 text-white" style={{paddingTop:'env(safe-area-inset-top)'}}>
    <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-2">
      <button aria-label="オプションへ戻る" data-rhythm-calibrator-close onClick={()=>{stop();onClose();}} className="min-h-[44px] min-w-[44px] text-slate-300"><ArrowLeft size={20}/></button>
      <div className="min-w-0 flex-1">
        <small className="block text-[8px] font-black tracking-[0.2em] text-cyan-300">MONBEAT</small>
        <h2 className="text-base font-black">🎯 タップのタイミングを合わせる</h2>
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
      <p className="text-[12px] leading-relaxed text-slate-300">
        下の線へノーツが重なった瞬間に、リズムよく{RHYTHM_CALIBRATION_TAPS}回叩いてください。
        画面に見えてから指が触れるまでの遅れは端末ごとに違うので、実際に叩いて測ります。
      </p>
      {/* 叩く場所は画面の残りいっぱい。実際のプレイと同じように、指を置く姿勢で測れるようにする */}
      <div ref={areaRef} data-rhythm-calibrator-area onPointerDown={e=>{e.preventDefault();tap();}}
        className="relative mt-3 min-h-0 flex-1 w-full overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-900"
        style={{touchAction:'none',WebkitUserSelect:'none',userSelect:'none'}}>
        <i ref={noteRef} data-rhythm-calibrator-note aria-hidden="true"
          className="absolute left-1/2 top-0 h-6 w-40 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-200 to-fuchsia-500"/>
        <i aria-hidden="true" className="absolute inset-x-0 bottom-8 h-[4px] bg-gradient-to-r from-fuchsia-300 via-cyan-100 to-fuchsia-300"/>
        {!running&&<span className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] font-black leading-relaxed text-slate-300">
          {taps.length?'もう一度やるなら「はじめる」':'「はじめる」を押して、線に重なったら叩いてね'}</span>}
        {running&&<span className="absolute inset-x-0 bottom-2 text-center text-[11px] font-black text-cyan-200">ここを叩く</span>}
      </div>
      <p data-rhythm-calibrator-count className="mt-3 text-center text-[14px] font-black tabular-nums text-cyan-200">
        {taps.length} / {RHYTHM_CALIBRATION_TAPS} 回
      </p>
      {result&&taps.length>=RHYTHM_CALIBRATION_TAPS&&(
        <p data-rhythm-calibrator-result className="mt-2 text-center text-[12px] font-bold leading-relaxed text-amber-200">
          平均{result.rawMeanMs>0?'+':''}{result.rawMeanMs}ms（{result.droppedCount}回は外れ値として除外）<br/>→ 判定タイミング調整 {result.offsetMs>0?'+':''}{result.offsetMs}ms
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-slate-500">いまの値: {currentOffsetMs>0?'+':''}{currentOffsetMs}ms（「この値にする」を押しても、保存するまでは変わりません）</p>
    </div>
    <footer className="z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-4 pt-2" style={{paddingBottom:'calc(.5rem + env(safe-area-inset-bottom))'}}>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" data-rhythm-calibrator-start onClick={start} disabled={running}
          className="min-h-[54px] rounded-xl bg-cyan-700 text-[13px] font-black text-white disabled:opacity-40">はじめる</button>
        <button type="button" data-rhythm-calibrator-apply
          disabled={!result||taps.length<RHYTHM_CALIBRATION_TAPS}
          onClick={()=>{if(result){onApply(result.offsetMs);stop();onClose();}}}
          className="min-h-[54px] rounded-xl bg-amber-400 text-[13px] font-black text-slate-950 disabled:opacity-40">この値にする</button>
      </div>
    </footer>
  </main>;
};

const RhythmOptions=({value,onSave,onBack})=>{
  const [draft,setDraft]=useState(()=>normalizeRhythmSettings(value));
  const [message,setMessage]=useState('');
  // 「叩いて合わせる」を開いているか。設定そのものではないので保存には入れない
  const [calibrating,setCalibrating]=useState(false);
  const previewRef=useRef(null);
  useEffect(()=>()=>{previewRef.current?.stop();previewRef.current=null;},[]);
  const savedValue=normalizeRhythmSettings(value),dirty=JSON.stringify(draft)!==JSON.stringify(savedValue);
  const set=(key,next)=>{setDraft(current=>normalizeRhythmSettings({...current,[key]:next}));setMessage('');};
  const stepper=(key,min,max,step,suffix='',decimals=0)=>{
    const value=Number(draft[key]),percent=Math.max(0,Math.min(100,((value-min)/(max-min))*100));
    const change=direction=>set(key,rhythmStepOptionValue(value,min,max,step,direction));
    const display=`${decimals>0?value.toFixed(decimals):value}${suffix}`;
    return <div data-rhythm-option-stepper={key} className="grid grid-cols-[48px_minmax(54px,1fr)_48px_minmax(54px,auto)] items-center gap-2">
      <button type="button" aria-label={`${key}を下げる`} disabled={value<=min} onClick={()=>change(-1)} className="min-h-[48px] min-w-[48px] rounded-xl border border-white/15 bg-slate-800 text-xl font-black text-slate-100 active:scale-95 disabled:opacity-35">−</button>
      {/* つまんで動かせるスライダー。±ボタンだけだと、音量(0〜100)やノーツ速度のように
          幅の広い項目で何十回も押すことになるため(実機で「めんどう」という報告があった)。
          細かく合わせたいときは左右の±で1目盛りずつ動かす。 */}
      <input type="range" data-rhythm-option-slider={key} aria-label={`${key}を変える`}
        min={min} max={max} step={step} value={value}
        onChange={e=>set(key,rhythmSnapOptionValue(e.target.value,min,max,step))}
        className="mh-rhythm-range h-3 min-w-0 w-full cursor-pointer appearance-none rounded-full border border-white/15 bg-slate-950"
        style={{background:`linear-gradient(90deg,#d946ef 0%,#22d3ee ${percent}%,#020617 ${percent}%,#020617 100%)`}}/>
      <button type="button" aria-label={`${key}を上げる`} disabled={value>=max} onClick={()=>change(1)} className="min-h-[48px] min-w-[48px] rounded-xl border border-white/15 bg-slate-800 text-xl font-black text-slate-100 active:scale-95 disabled:opacity-35">＋</button>
      <output aria-live="polite" className="min-w-[54px] rounded-lg border border-cyan-400/30 bg-slate-950 px-1 py-2 text-center text-xs font-black tabular-nums whitespace-nowrap">{display}</output>
    </div>;
  };
  const toggle=(key,label)=><button type="button" aria-pressed={draft[key]} onClick={()=>set(key,!draft[key])} className={`min-h-[44px] min-w-[88px] rounded-xl border px-4 text-xs font-black ${draft[key]?'border-cyan-200 bg-cyan-600 text-white':'border-white/20 bg-slate-900 text-slate-300'}`}>{label} {draft[key]?'ON':'OFF'}</button>;
  const segments=(key,items)=><div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/20">{items.map(([id,label])=><button type="button" key={id} aria-pressed={draft[key]===id} onClick={()=>set(key,id)} className={`min-h-[44px] border-r border-white/10 px-1 text-[10px] font-black last:border-r-0 ${draft[key]===id?'bg-cyan-600 text-white':'bg-slate-900 text-slate-300'}`}>{label}</button>)}</div>;
  // 【2026-09-05・ユーザー指示】「オプション画面が窮屈すぎる／サイズ感に余裕を持たして」
  // 余白(p-4)・項目の間(py-3)・説明文(10px)をひとまわり広げてある。
  // 数値だけを小さくしていくと、指で押す場所と読む場所がどちらも減っていくので、
  // 「入る量」ではなく「押せる・読める」ほうを優先する。
  const card='rounded-2xl border border-cyan-400/35 bg-slate-900/85 p-4 shadow-[0_0_18px_rgba(34,211,238,.08)]';
  const row='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-3 last:border-b-0';
  const head='text-[15px] font-black text-cyan-200';
  const label='text-[13px] font-bold';
  const note='text-[10px] leading-relaxed text-slate-400';
  // 数値の項目。見出し → スライダー → 説明、の順で必ず間を空ける
  const field=(title,control,description=null)=><div className="border-b border-white/10 py-3 last:border-b-0">
    <p className={`mb-2 ${label}`}>{title}</p>
    {control}
    {description&&<p className={`mt-2 ${note}`}>{description}</p>}
  </div>;
  const previewBgm=async()=>{previewRef.current?.stop();previewRef.current=null;const audio=await Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume);previewRef.current=audio;if(!audio)setMessage('BGMを再生できませんでした');};
  const resetDraft=()=>{setDraft(normalizeRhythmSettings(DEFAULT_RHYTHM_SETTINGS));setMessage('画面上の値を戻しました（未保存）');};
  const saveDraft=async()=>{const saved=await onSave(draft);setDraft(saved);setMessage('保存しました');};
  // 「叩いて合わせる」は画面いっぱいで開く(2026-09-05・ユーザー指示
  // 「タップ調整が窮屈で見にくい／専用画面に飛ばしたほうがいい」)。
  // gameStateを増やさずここへ重ねるのは、編集中の値(draft)を持ったままにするため。
  // 別の画面へ飛ばすと、この画面がいったん消えて未保存の変更が全部消える。
  if(calibrating)return <RhythmTimingCalibrator
    currentOffsetMs={draft.judgmentTimingOffsetMs}
    onApply={ms=>{set('judgmentTimingOffsetMs',ms);setMessage(`判定タイミング調整を ${ms>0?'+':''}${ms}ms にしました（未保存）`);}}
    onClose={()=>setCalibrating(false)}/>;
  return <main data-rhythm-options className="flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-950 text-white" style={{paddingTop:'env(safe-area-inset-top)'}}>
    <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-2"><button aria-label="戻る" onClick={onBack} className="min-h-[44px] min-w-[44px] text-slate-300"><ArrowLeft size={20}/></button><div><small className="block text-[8px] font-black tracking-[0.2em] text-cyan-300">MONBEAT</small><h2 className="text-base font-black">⚙️ オプション</h2></div></header>
    <div data-rhythm-options-scroll className="flex-1 min-h-0 overflow-y-auto px-3 pb-5 pt-3 mh-scroll">
      <div className="space-y-4">
        <RhythmLandscapeHint/>
        <section className={card}>
          <h3 className={head}>🔊 音量</h3>
          {field('BGM音量',stepper('bgmVolume',0,100,1))}
          {field('タップ音量',stepper('noteSeVolume',0,100,1))}
          <div className={row}><span className={label}>タップ音</span>{toggle('noteSeEnabled','')}</div>
          <div className="mt-3 grid grid-cols-2 gap-3"><button type="button" onClick={previewBgm} className="min-h-[48px] rounded-xl bg-indigo-700 text-[12px] font-black">♪ BGM試聴</button><button type="button" onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)} className="min-h-[48px] rounded-xl bg-fuchsia-700 text-[12px] font-black">タップ音試聴</button></div>
          <p className={`mt-3 ${note}`}>この音量はメインゲームの音量設定と別に、音ゲーだけで使います。タイトル画面の全体ミュートのみ共通です。</p>
        </section>
        <section className={card}>
          <h3 className={head}>🎯 プレイ</h3>
          {field('ノーツ速度',stepper('noteSpeed',RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP,'',1),
            `1.0〜12.0を0.1刻みで調整できます。変わるのはノーツが流れてくる見た目の速さだけで、譜面のタイミング・判定窓・スコアは変わりません（現在 約${rhythmTravelMsForSpeed(draft.noteSpeed).toLocaleString()}ms）。`)}
          {field('ノーツサイズ',stepper('noteSize',80,120,5,'%'),
            'ノーツの見た目の大きさだけを変えます。入力判定の範囲・HOLD/SLIDE帯・ENDバーの位置は変わりません。')}
          {/* 【2026-09-05・ユーザー指示】「ノーツの開始位置（奥行き）もオプションで調整できるようにしたい」
              値そのものは前からあったが、変える場所が画面に無かった。 */}
          {field('ノーツの出る位置（奥行き）',stepper('noteStartPosition',-100,100,5),
            'ノーツが画面のどのあたりから出てくるかを変えます。マイナスにすると奥（画面の上の外側）から、プラスにすると手前寄りから出てきます。判定ラインの位置・判定のタイミング・判定窓・スコアは変わりません。ノーツが流れてくる時間も変わらないので、手前から出すほど見えているあいだの動きは速く見えます。')}
          {field('判定タイミング調整',stepper('judgmentTimingOffsetMs',-100,100,5,'ms'),
            '判定窓の幅は変えず、表示と入力の基準を同じ量だけ補正します。数字で決めにくいときは、下の「叩いて合わせる」で実際に叩いて測れます。')}
          <button type="button" data-rhythm-calibrator-open onClick={()=>setCalibrating(true)} className="mt-3 min-h-[52px] w-full rounded-xl border border-cyan-300/60 bg-cyan-950/50 text-[13px] font-black text-cyan-100">🎯 叩いて合わせる</button>
          <p className={`mt-2 ${note}`}>画面いっぱいで開きます。合わせ終わってから戻ると、ここの数字に入ります（保存はまだされません）。</p>
        </section>
        <section className={card}>
          <h3 className={head}>👁 表示</h3>
          <div className={row}><span className={label}>FAST / SLOW表示</span>{toggle('fastSlowDisplay','')}</div>
          <div className={row}><span className={label}>判定文字表示</span>{toggle('judgmentTextDisplay','')}</div>
          {field('レーン発光',segments('laneGlow',[['NORMAL','標準'],['LOW','控えめ'],['NONE','なし']]))}
        </section>
        <section className={card}>
          <h3 className={head}>🐾 両サイドのマスモン</h3>
          <p className={`mt-2 ${note}`}>レーンの外側の空いたところへ、設定したマスモンが出て拍に合わせて跳ねます。ノーツが見づらいときや、端末が熱くなりやすいときは薄くするか止めてください。</p>
          {field('濃さ',segments('sideMonsterOpacity',[['NORMAL','はっきり'],['SOFT','ふつう'],['FAINT','うっすら'],['OFF','出さない']]))}
          {field('動き',segments('sideMonsterMotion',[['NORMAL','跳ねる'],['SMALL','小さく跳ねる'],['NONE','動かない']]))}
          <div className={row}><span className={label}>能力中に光らせる</span>{toggle('sideMonsterAbilityHighlight','')}</div>
        </section>
        <section className={card}>
          <h3 className={head}>✨ 演出・端末</h3>
          {field('演出量',segments('effectAmount',[['NORMAL','標準'],['LOW','少なめ'],['MINIMAL','最小']]))}
          <div className={row}><span className={label}>振動</span><div className="flex items-center gap-2">
            {/* この端末で振動できるかを出す。iPhoneのSafariには振動のしくみが無い時期が長く、
                「設定はあるのに何も起きない」状態になっていたため(2026-09-05の指摘) */}
            <button type="button" data-rhythm-vibration-test disabled={!RHYTHM_HAPTICS.supported()}
              onClick={()=>RHYTHM_HAPTICS.tap(26)}
              className="min-h-[44px] rounded-xl border border-white/20 bg-slate-900 px-3 text-[11px] font-black text-slate-200 disabled:opacity-40">試す</button>
            {toggle('vibrationEnabled','')}
          </div></div>
          {!RHYTHM_HAPTICS.supported()&&<p data-rhythm-vibration-unsupported className="pb-2 text-[10px] font-bold leading-relaxed text-amber-200">この端末は振動に対応していないため、ONにしても振動しません（音とエフェクトはそのまま出ます）。</p>}
          <div className={row}><span className={label}>軽量モード</span>{toggle('lightweightMode','')}</div>
          <div className={row}><span className={label}>曲えらびで試聴する</span>{toggle('songPreviewEnabled','')}</div>
          {/* 【2026-09-05・ユーザー相談】「演奏中のみ物理的に端末の通知を出さないようにすることは可能？
              オプションでオンオフできて」。できる範囲は端末とブラウザで違うので、
              何が起きるかを必ず添える(黙って効かないのがいちばん困る)。 */}
          <div className={row}><span className={label}>演奏中は通知を出さない</span>{toggle('quietDuringPlay','')}</div>
          <p className={`pb-1 ${note}`}>{rhythmQuietModeSupportText()}</p>
        </section>
        <section className="rounded-2xl border border-cyan-400/30 bg-cyan-950/25 p-4 text-[11px] leading-relaxed text-cyan-100">判定を甘くする設定ではありません。端末ごとの見え方・音量・タイミングを調整する項目です。</section>
      </div>
    </div>
    <footer data-rhythm-options-actions className="z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-3 pt-2 shadow-[0_-8px_24px_rgba(2,6,23,.72)]" style={{paddingBottom:'calc(.5rem + env(safe-area-inset-bottom))'}}>
      {message&&<p role="status" className="mb-1 text-center text-[11px] font-black text-amber-300">{message}</p>}
      <div className="grid grid-cols-[.9fr_1.1fr] gap-3"><button type="button" onClick={resetDraft} className="min-h-[52px] rounded-xl border border-white/20 bg-slate-800 px-2 text-[12px] font-black">デフォルトに戻す</button><button type="button" onClick={saveDraft} data-rhythm-options-save data-dirty={dirty?'true':'false'} className={`min-h-[52px] rounded-xl px-3 font-black ${dirty?'bg-amber-400 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,.35)]':'bg-amber-600 text-slate-950'}`}>{dirty?'変更を保存':'保存'}</button></div>
    </footer>
  </main>;
};

// モンスターノーツ用のマスモン設定。音ゲーデバッグ画面と体験版ホームの両方から使うため、
// 画面の中へ直接書かずにここで1つにまとめてある。中身と操作はどちらから開いても同じ。
// ============================================================================
// 曲えらび(曲選択画面)
// ============================================================================
// 2026-09-05・ユーザーが示した音ゲーの曲選択画面を参考にした構成。
//   ・真ん中に曲の一覧。1行に「楽曲Lv.」「絵」「曲名」「遊べる難易度」
//   ・選んだ曲の大きな絵と、難易度ボタン、ランダム、決定
//   ・左の「ジャンルタブ」は曲が増えてから足す(いまは曲が少ないので置かない)
//   ・オプション(音ゲー設定)とマスモン設定へはヘッダーから入る
//   ・全国ランキングは曲ごとなので、選んだ曲の欄に置く
// 縦画面では一覧が上・選んだ曲が下、横画面では左右に並ぶ(landscape:)。

// 難易度の色。EASY=緑 / NORMAL=青 / HARD=橙 / EXPERT=赤 / MASTER=紫。
// 一覧のひし形も難易度ボタンも同じ色を使い、画面のどこでも同じ意味になるようにする。
const RHYTHM_DIFFICULTY_TONE=Object.freeze({
  EASY:  Object.freeze({dot:'bg-emerald-400', on:'border-emerald-300 bg-emerald-600 text-white', off:'border-emerald-400/40 text-emerald-200'}),
  NORMAL:Object.freeze({dot:'bg-sky-400',     on:'border-sky-300 bg-sky-600 text-white',         off:'border-sky-400/40 text-sky-200'}),
  HARD:  Object.freeze({dot:'bg-amber-400',   on:'border-amber-300 bg-amber-600 text-white',     off:'border-amber-400/40 text-amber-200'}),
  EXPERT:Object.freeze({dot:'bg-rose-400',    on:'border-rose-300 bg-rose-600 text-white',       off:'border-rose-400/40 text-rose-200'}),
  MASTER:Object.freeze({dot:'bg-fuchsia-400', on:'border-fuchsia-300 bg-fuchsia-700 text-white', off:'border-fuchsia-400/40 text-fuchsia-200'}),
});
const rhythmDifficultyTone=id=>RHYTHM_DIFFICULTY_TONE[id]||RHYTHM_DIFFICULTY_TONE.EASY;

// 一覧に並ぶひし形の色。
// 【2026-09-05・ユーザー指示】
// 「難易度毎にひし形に色分かれてるけどこれは全部同じ色にして、クリアとフルコンボと
//   オールエクセレントとオールマーベラスで色が変わる感じで（どんどん派手な色合い）」
// 難易度そのものでは色を変えない。**どこまで極めたか**だけで色が変わる。
// 上へ行くほど派手になるので、一覧を見ただけで「どの曲をどこまでやったか」が分かる。
const RHYTHM_ACHIEVEMENT_MARKS=Object.freeze({
  NONE:      Object.freeze({label:'譜面なし',
    style:Object.freeze({background:'rgba(255,255,255,.14)'})}),
  UNPLAYED:  Object.freeze({label:'まだ遊んでいない',
    style:Object.freeze({background:'rgba(203,213,225,.55)'})}),
  CLEAR:     Object.freeze({label:'クリア',
    style:Object.freeze({background:'linear-gradient(135deg,#7dd3fc,#22d3ee)'})}),
  FULL_COMBO:Object.freeze({label:'フルコンボ',
    style:Object.freeze({background:'linear-gradient(135deg,#fde68a,#f59e0b)',
      boxShadow:'0 0 4px rgba(251,191,36,.8)'})}),
  ALL_EXCELLENT:Object.freeze({label:'オールエクセレント',
    style:Object.freeze({background:'linear-gradient(135deg,#f0abfc,#a855f7)',
      boxShadow:'0 0 6px rgba(232,121,249,.85)'})}),
  ALL_MARVELOUS:Object.freeze({label:'オールマーベラス',
    style:Object.freeze({background:'linear-gradient(135deg,#fde68a,#f0abfc,#67e8f9,#fde68a)',
      boxShadow:'0 0 8px rgba(240,171,252,.95),0 0 14px rgba(103,232,249,.6)'})}),
});
// 上の段から順に見て、いちばん上の達成を返す。
const rhythmAchievementMarkId=(playable,record)=>{
  if(!playable)return 'NONE';
  if(!record||!record.clear)return 'UNPLAYED';
  if(record.allMarvelous)return 'ALL_MARVELOUS';
  if(record.allExcellent)return 'ALL_EXCELLENT';
  if(record.fullCombo)return 'FULL_COMBO';
  return 'CLEAR';
};

// 曲の絵(ジャケット)の下地の色。曲idから決めるので、同じ曲はいつも同じ色になる。
// 絵(artwork)を持たない曲はこの色のタイルに曲名の頭文字が出る。絵を持つ曲でも、
// 絵が届くまでの数フレームと、data/rhythm-mode.js が読めなかったときの受け皿になる。
const rhythmSongArtHue=songId=>{
  const text=String(songId||'');
  let hash=0;
  for(let i=0;i<text.length;i++)hash=(hash*31+text.charCodeAt(i))%360;
  return hash;
};
// 横スワイプのカルーセルで、えらんだカードを中央へ寄せる。
//
// 【なぜ scrollIntoView を使わないか】
// 以前は scrollIntoView({inline:'center',block:'nearest'}) を使っていた。
// block:'nearest' は「縦は必要な分だけ」という意味で、**動かさない**ではない。
// 画面の低い端末ではカードが縦に収まりきらず、そのぶん外側まで縦スクロールしてしまい、
// 画面いちばん上の「← バトル」が上へ追い出されて、指でスクロールしないと戻れなかった
// (2026-09-05・ユーザー指摘、Galaxy Z Fold6)。
// ここでは横の位置だけを自分で計算して動かすので、縦は一切動かない。
const centerCarouselChild = (root, index, behavior = 'auto') => {
  const el = root && root.children && root.children[index];
  if (!root || !el) return;
  const rootBox = root.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const left = root.scrollLeft + (box.left - rootBox.left) - (rootBox.width - box.width) / 2;
  if (typeof root.scrollTo === 'function') root.scrollTo({ left, behavior });
  else root.scrollLeft = left;   // 古いブラウザでも位置だけは合わせる
};

// marked=false は「輪にするために置いた影の行」で使う。同じ目印が3つに増えると、
// 画面を数えて確かめている検査が本物の3倍を見てしまうため、影には目印を付けない。
const RhythmSongArt=({song,large=false,marked=true})=>{
  const hue=rhythmSongArtHue(song&&song.songId);
  const src=typeof rhythmSongArtSrc!=='undefined'?rhythmSongArtSrc(song):(song&&typeof song.artwork==='string'?song.artwork:'');
  const initial=String((song&&song.displayName)||'♪').trim().charAt(0)||'♪';
  return <span {...(marked?{'data-rhythm-song-art':''}:{})} className={`relative block shrink-0 overflow-hidden rounded-lg border border-white/20 ${large?'w-full':'w-12'}`}
    style={{aspectRatio:'1 / 1',background:`linear-gradient(135deg,hsl(${hue},66%,28%),hsl(${(hue+50)%360},72%,48%))`}}>
    {src
      ?<img src={src} alt="" className="absolute inset-0 h-full w-full object-cover"/>
      :<b aria-hidden="true" className={`absolute inset-0 flex items-center justify-center font-black text-white/90 ${large?'text-5xl':'text-xl'}`}
        style={{textShadow:'0 2px 8px rgba(2,6,23,.55)'}}>{initial}</b>}
  </span>;
};

// 曲の長さ。譜面の終わりか、曲の再生時間の指定から出す。
const rhythmSongLengthLabel=(song,chart)=>{
  const ms=Number((song&&song.playDurationMs)||(chart&&chart.durationMs)||0);
  if(!Number.isFinite(ms)||ms<=0)return '';
  const total=Math.round(ms/1000);
  return `${Math.floor(total/60)}分${String(total%60).padStart(2,'0')}秒`;
};
// 曲の長さ(ミリ秒)。並び替えの「長さ順」で使う。譜面が無い曲は 0 ではなく
// Infinity を返して**いちばん後ろ**へ回す(長さの分からない曲を先頭に集めない)。
const rhythmSongDurationMs=(song,difficulties)=>{
  const own=Number(song&&song.playDurationMs);
  if(Number.isFinite(own)&&own>0)return own;
  for(const item of (difficulties||[])){
    const chart=song&&song.difficulties&&song.difficulties[item.id];
    const ms=Number(chart&&chart.durationMs);
    if(Number.isFinite(ms)&&ms>0)return ms;
  }
  return Infinity;
};
// 曲の並び替え。**元の配列は書き換えない**(渡されたのは Object.freeze された曲データで、
// 並びそのものが「入手順」という意味を持っているため)。
// 同じ値のときは必ず入手順で決着させる。そうしないと、同じLv.の曲どうしが
// 描き直しのたびに入れ替わって見える。
const rhythmSortSongs=(songs,{sort='added',desc=false,levelOf=null,difficulties=null}={})=>{
  const list=(songs||[]).map((song,index)=>({song,index}));
  const compare=(a,b)=>{
    if(sort==='level'){
      const av=typeof levelOf==='function'?Number(levelOf(a.song))||0:0;
      const bv=typeof levelOf==='function'?Number(levelOf(b.song))||0:0;
      if(av!==bv)return av-bv;
    }else if(sort==='name'){
      const an=rhythmSongFullName(a.song),bn=rhythmSongFullName(b.song);
      // 日本語も並べたいので localeCompare を使う。使えない環境では素の比較へ落ちる
      let diff=0;
      try{diff=an.localeCompare(bn,'ja');}catch(e){diff=an<bn?-1:an>bn?1:0;}
      if(diff!==0)return diff;
    }else if(sort==='length'){
      const av=rhythmSongDurationMs(a.song,difficulties),bv=rhythmSongDurationMs(b.song,difficulties);
      if(av!==bv)return av<bv?-1:1;
    }
    return 0;
  };
  list.sort((a,b)=>{
    const diff=compare(a,b);
    if(diff!==0)return desc?-diff:diff;
    return a.index-b.index;   // 決着がつかないときは入手順(降順でもここは崩さない)
  });
  return list.map(entry=>entry.song);
};

// 譜面が入っている難易度だけを「遊べる」とみなす(押せるのに始まらない状態を作らないため)。
const rhythmChartPlayable=(song,difficultyId)=>{
  const chart=song&&song.difficulties&&song.difficulties[difficultyId];
  return !!chart&&Array.isArray(chart.notes)&&chart.notes.length>0;
};

// footer は「選んでいる曲」を受け取れる。全国ランキングのように**曲ごとに違うもの**を
// 置くため。ただの要素を渡してもよい。
// 曲えらびで曲を鳴らし始めるまでの間。一覧をなぞって選び替えているあいだに
// 曲を読み込み直すと、そのたびに引っかかるので、少し止まってから鳴らす。
const RHYTHM_PREVIEW_DELAY_MS=350;
// 選んでいる曲を鳴らし続ける画面。ここに無い画面へ移ると音は止まる。
//   ・オプション(RHYTHM_OPTIONS) … 「♪ BGM試聴」と重なるので無音のまま(ユーザー指示)
//   ・演奏中(RHYTHM_PLAY)         … 自分で曲を鳴らす
//   ・モンビーの外               … HOMEなどへ戻るので止める
const RHYTHM_PREVIEW_SCREENS=Object.freeze(['RHYTHM_DEMO_HOME','RHYTHM_DEMO_HELP','RHYTHM_DEMO_MONSTERS','RHYTHM_RANKING']);
// spotClass … チュートリアルで光らせる場所に付けるクラスを返す関数(省略時は光らせない)。
// 画面側が知っているキー: songList / songLevel / achievement / difficulty
// 選んでいる曲・難易度は**画面の外(App本体)**で持つ。
// 中で持っていたころは、ランキングやマスモン設定を開いてこの画面が消えるたびに選択が消え、
// 戻ってくると先頭の曲へ戻っていた。選んでいた曲を鳴らし続けるのにも、外から見える必要がある
// (2026-09-05・ユーザー指示「選んでいた音楽が鳴り続けるようにして」)。
const RhythmSongSelect=({songs,difficulties,bestRecords,onPlay,notice=null,footer=null,emptyText='遊べる譜面がまだありません。',spotClass=null,
  songId='',difficultyId='',onSongId=null,onDifficultyId=null,view=null,onView=null})=>{
  const spot=name=>(typeof spotClass==='function'?spotClass(name):'');
  const setView=next=>{if(typeof onView==='function')onView(next);};
  const state=normalizeRhythmSelectView(view);
  const [sortOpen,setSortOpen]=React.useState(false);
  const playable=(songs||[]).filter(song=>(difficulties||[]).some(difficulty=>rhythmChartPlayable(song,difficulty.id)));
  const setSongId=id=>{if(typeof onSongId==='function')onSongId(id);};
  const setDifficultyId=id=>{if(typeof onDifficultyId==='function')onDifficultyId(id);};
  // 選んでいる曲・難易度が無くなっても落ちないよう、毎回その場で選び直す
  // (曲を変えたときに「前の曲にしかない難易度」が残らない)。
  // 並び替えても**選んでいる曲は変わらない**(並びは見え方だけの話なので)。
  const song=playable.find(entry=>entry.songId===songId)||playable[0]||null;
  const available=song?(difficulties||[]).filter(difficulty=>rhythmChartPlayable(song,difficulty.id)):[];
  // EXPERT以上は1つ下の難易度をクリアするまで選べない(2026-09-05・ユーザー指示)。
  // 一覧からは消さずに鍵つきで見せる。「先に何をクリアすればよいか」が分かるようにするため。
  const unlocked=item=>!song||rhythmDifficultyUnlocked(song.songId,item.id,bestRecords);
  const openList=available.filter(unlocked);
  const picked=available.find(entry=>entry.id===difficultyId);
  const difficulty=(picked&&unlocked(picked)?picked:null)||openList[0]||null;
  const chart=song&&difficulty?song.difficulties[difficulty.id]:null;
  const best=song&&difficulty?rhythmBestRecord(bestRecords,song.songId,difficulty.id):null;
  // 一覧の「楽曲Lv.」は、いま選んでいる難易度のレベル。その曲に無ければいちばん上の難易度。
  const rowLevel=entry=>{
    const ids=(difficulties||[]).filter(item=>rhythmChartPlayable(entry,item.id)).map(item=>item.id);
    if(!ids.length)return 0;
    const id=difficulty&&ids.includes(difficulty.id)?difficulty.id:ids[ids.length-1];
    return Number(entry.difficulties[id].level)||0;
  };
  // 画面に並べる順。並び替えは**見え方だけ**で、遊べる曲も選んでいる曲も変えない。
  const list=rhythmSortSongs(playable,{sort:state.sort,desc:state.desc,levelOf:rowLevel,difficulties});
  const sortLabel=(RHYTHM_SORT_ORDERS.find(item=>item.id===state.sort)||RHYTHM_SORT_ORDERS[0]).label;
  // 選んでいる曲を鳴らすのは App本体(rhythmPreviewTrackId)。ここでは鳴らさない。
  // この画面の中で鳴らしていたころは、ランキングやマスモン設定を開いた瞬間に
  // 画面ごと消えて音が止まっていた。
  // 外へ「いまこの曲を選んでいる」と伝えるだけにする(保存値が空・曲が入れ替わったときの保険)。
  React.useEffect(()=>{
    if(song&&song.songId!==songId)setSongId(song.songId);
  },[song?song.songId:'',songId]);

  const pickRandom=()=>{
    if(!list.length)return;
    const nextSong=list[Math.floor(Math.random()*list.length)];
    const ids=(difficulties||[]).filter(item=>rhythmChartPlayable(nextSong,item.id));
    setSongId(nextSong.songId);
    if(ids.length)setDifficultyId(ids[Math.floor(Math.random()*ids.length)].id);
  };

  // ---- 一覧を輪にする(2026-09-05・ユーザー指示
  //      「1番下にいったら止まるんじゃなくて上に戻ってくるループ式にして」) ----
  //
  // 同じ並びを前・本体・後ろの3つぶん置き、指を止めたときに**本体の同じ位置へ**
  // そっと戻す。見た目は途切れずに繋がり、実際に動いているのは常にまん中になる。
  //
  // 端まで来た瞬間に反対側へ飛ばす作りにしなかったのは、指で送っている最中に
  // 位置が跳ぶと勢い(慣性)が切れて、輪ではなく「引っかかり」に感じるため。
  // 戻すのは指が離れてスクロールが止まってからにする。
  //
  // 曲が1曲しかないときは輪にしない(同じ行が3つ並ぶだけで、かえって分かりにくい)。
  const loopEnabled=list.length>=2;
  const listRef=React.useRef(null);
  const loopReadyRef=React.useRef(false);
  const settleRef=React.useRef(null);
  // 3つぶんのうち、まん中の先頭がどこから始まるか
  const blockHeight=el=>Math.max(1,Math.round(el.scrollHeight/3));
  React.useEffect(()=>{
    const el=listRef.current;
    if(!el)return;
    if(!loopEnabled){loopReadyRef.current=false;return;}
    // 開いた直後は「まん中の先頭」に立たせる。ここが 0 のままだと、
    // 上へ送ったときに輪ではなく行き止まりになる
    const put=()=>{
      const node=listRef.current;
      if(!node)return;
      if(node.scrollHeight<=node.clientHeight){loopReadyRef.current=false;return;}   // 全部見えているなら輪は要らない
      if(loopReadyRef.current)return;                  // もう立っているなら動かさない
      node.scrollTop=blockHeight(node);
      loopReadyRef.current=true;
    };
    put();
    // 一覧の高さは外部CDNのTailwindが届いてから決まる。最初に測った時点ではまだ
    // 画面いっぱいに伸びていて「スクロールできない=輪は要らない」と見えてしまい、
    // 遅れてCSSが届いても輪が始まらないままだった。大きさが決まったら置き直す。
    let observer=null;
    if(typeof ResizeObserver==='function'){
      try{observer=new ResizeObserver(()=>put());observer.observe(el);}catch(e){observer=null;}
    }
    return ()=>{if(observer)observer.disconnect();loopReadyRef.current=false;};
  },[loopEnabled,list.length,state.sort,state.desc]);
  const handleListScroll=()=>{
    const el=listRef.current;
    if(!el||!loopEnabled)return;
    // ResizeObserver が無い端末でも、動かし始めた時点で輪に入れるようにしておく
    if(!loopReadyRef.current){
      if(el.scrollHeight<=el.clientHeight)return;
      loopReadyRef.current=true;
    }
    if(settleRef.current)clearTimeout(settleRef.current);
    // 指が離れて動きが止まってから、まん中へ戻す
    settleRef.current=setTimeout(()=>{
      const node=listRef.current;
      if(!node||!loopReadyRef.current)return;
      const block=blockHeight(node);
      if(block<=0)return;
      const top=node.scrollTop;
      if(top<block*0.5)node.scrollTop=top+block;
      else if(top>block*1.5)node.scrollTop=top-block;
    },140);
  };
  React.useEffect(()=>()=>{if(settleRef.current)clearTimeout(settleRef.current);},[]);
  // 前・本体・後ろの3つぶん。本体(copy===1)だけが検査やクリックの目印になる
  // data-rhythm-song-row を持つ。上下のぶんは「同じものの影」なので別の名前にする。
  const blocks=loopEnabled?[0,1,2]:[1];

  return <div data-rhythm-song-select className="flex min-h-0 flex-1 flex-col landscape:flex-row">
    {/* 曲の一覧。案内(notice)はスクロールの**外**へ置き、動くのは曲の並びだけにする。
        中に入れていたときは、曲を探して指を動かすと案内も一緒に流れて場所を食っていた
        (2026-09-05・ユーザー指示「固定タブを利用して音楽だけ動かせるようにしたい」)。 */}
    <div className="flex min-h-0 flex-1 flex-col landscape:border-r landscape:border-white/10">
      {/* 助手のひとことは畳める。曲を探すのに使える高さがそのぶん増える
          (2026-09-05・ユーザー指摘「縦画面の楽曲選択が2曲までしか出ないのがやりづらい」)。
          畳んだかどうかは覚えるので、毎回たたみ直さなくてよい。 */}
      {/* 横画面では助手のひとことを右の欄(aside)へ移す。左は縦がそのまま曲の並びに使えるので、
          同じ画面でも1〜2行ぶん多く見える。出す中身は同じで、置く場所だけがCSSで入れ替わる。 */}
      {notice&&state.noticeOpen&&<div data-rhythm-song-notice className="shrink-0 px-2 pt-2 landscape:hidden">{notice}</div>}
      {/* 並び替えと、助手の開け閉め。1本の行にまとめて、一覧から取る高さを最小にする */}
      <div data-rhythm-song-toolbar className="flex shrink-0 items-center gap-1.5 px-2 pt-2">
        <button type="button" data-rhythm-song-sort onClick={()=>setSortOpen(true)}
          className="flex min-h-[44px] flex-1 items-center justify-between gap-1 rounded-xl border border-white/15 bg-slate-900/80 px-3 text-[11px] font-black text-slate-200">
          <span className="truncate">並び替え：{sortLabel}{state.desc?'（逆）':''}</span>
          <span aria-hidden="true" className="shrink-0 text-slate-400">▾</span>
        </button>
        {notice&&<button type="button" data-rhythm-song-notice-toggle aria-pressed={state.noticeOpen}
          onClick={()=>setView({...state,noticeOpen:!state.noticeOpen})}
          title={state.noticeOpen?'助手のひとことを畳む':'助手のひとことを出す'}
          className={`flex h-[44px] w-[52px] shrink-0 items-center justify-center gap-0.5 rounded-xl border text-[11px] font-black ${state.noticeOpen?'border-fuchsia-300/60 bg-fuchsia-900/40 text-fuchsia-100':'border-white/15 bg-slate-900/80 text-slate-300'}`}>
          <span aria-hidden="true">💬</span><span aria-hidden="true">{state.noticeOpen?'▲':'▼'}</span>
        </button>}
      </div>
    <div ref={listRef} onScroll={handleListScroll}
      data-rhythm-song-list data-rhythm-song-loop={loopEnabled?'1':'0'}
      className={`min-h-0 flex-1 overflow-y-auto mh-scroll px-2 py-2${spot('songList')}`}>
      {list.length===0
        ?<p className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs text-slate-300">{emptyText}</p>
        :<ul className="space-y-1.5">{blocks.map(copy=>list.map(entry=>{
          const main=copy===1;
          const selected=!!song&&entry.songId===song.songId;
          return <li key={`${copy}-${entry.songId}`} aria-hidden={main?undefined:'true'}>
            <button type="button" {...(main?{'data-rhythm-song-row':entry.songId}:{'data-rhythm-song-row-loop':entry.songId})}
              tabIndex={main?undefined:-1} aria-pressed={selected}
              onClick={()=>setSongId(entry.songId)}
              className={`flex w-full min-h-[64px] items-center gap-2 rounded-xl border px-2 py-1.5 text-left ${selected?'border-fuchsia-300 bg-fuchsia-900/50':'border-white/10 bg-slate-900/70'}`}>
              <span className="w-10 shrink-0 text-center">
                <small className="block text-[7px] font-black leading-none text-slate-400">楽曲Lv.</small>
                <b {...(main?{'data-rhythm-song-row-level':''}:{})} className={`mt-0.5 block text-xl font-black leading-none tabular-nums text-white${spot('songLevel')}`}>{rowLevel(entry)}</b>
              </span>
              <RhythmSongArt song={entry} marked={main}/>
              {/* 曲名は**必ず2行分**の場所を取る(行の高さ1.25×2行=2.5em で高さを固定)。
                  1行の曲と2行の曲で行の高さが変わり、一覧の枠がガタガタになっていたため
                  (2026-09-05・ユーザー指摘「文字数で枠がずれるのがださい」)。
                  2行を超える曲は省略する。行そのものにも min-h を置いて下限をそろえる。 */}
              <span className="min-w-0 flex-1">
                <b {...(main?{'data-rhythm-song-row-title':''}:{})} className="block text-[13px] font-black leading-tight text-white"
                  style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.25,height:'2.5em'}}>{rhythmSongFullName(entry)}</b>
                <span className={`mt-1 flex items-center gap-1${spot('achievement')}`}>
                  {(difficulties||[]).map(item=>{
                    const playable=rhythmChartPlayable(entry,item.id);
                    const markId=rhythmAchievementMarkId(playable,playable?rhythmBestRecord(bestRecords,entry.songId,item.id):null);
                    const mark=RHYTHM_ACHIEVEMENT_MARKS[markId];
                    return <i key={item.id} {...(main?{'data-rhythm-achievement':markId}:{})} title={`${item.id}: ${mark.label}`}
                      className="block h-2 w-2 rotate-45 rounded-[1px]" style={mark.style}/>;
                  })}
                  <small className="ml-1 text-[9px] font-bold text-slate-400">
                    {(difficulties||[]).filter(item=>rhythmChartPlayable(entry,item.id)).length}難易度
                  </small>
                </span>
              </span>
            </button>
          </li>;
        }))}</ul>}
    </div>
    </div>

    {/* 選んでいる曲 */}
    <aside data-rhythm-song-detail
      className="shrink-0 border-t border-white/10 bg-slate-950/90 px-3 py-2 landscape:w-[42%] landscape:max-w-[420px] landscape:overflow-y-auto landscape:border-l landscape:border-t-0 landscape:py-3"
      style={{paddingBottom:'calc(0.5rem + env(safe-area-inset-bottom))'}}>
      {notice&&state.noticeOpen&&<div data-rhythm-song-notice-landscape className="mb-2 hidden landscape:block">{notice}</div>}
      {!song||!difficulty
        ?<p className="text-xs font-bold text-slate-400">遊べる曲がありません。</p>
        :<>
        <div className="flex items-center gap-3 landscape:block">
          <div className="w-16 shrink-0 landscape:mx-auto landscape:w-36"><RhythmSongArt song={song} large/></div>
          {/* ここも一覧と同じ理由で2行分を確保する。曲名が1行か2行かで
              「長さ」「難易度ボタン」「ノーツ数」まで丸ごと上下に動いていた。 */}
          <div className="min-w-0 flex-1 landscape:mt-2 landscape:text-center">
            <b data-rhythm-song-title className="block text-sm font-black leading-tight text-white"
              style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.25,height:'2.5em'}}>{rhythmSongFullName(song)}</b>
            <small className="mt-0.5 block text-[10px] font-bold text-slate-400">{rhythmSongLengthLabel(song,chart)}</small>
          </div>
        </div>

        {/* 難易度をえらぶ */}
        <div data-rhythm-difficulty-row className={`mt-1.5 flex flex-wrap gap-1${spot('difficulty')}`}>
          {available.map(item=>{
            const tone=rhythmDifficultyTone(item.id);
            const open=unlocked(item);
            const on=!!difficulty&&item.id===difficulty.id;
            const need=rhythmDifficultyUnlockRequirement(item.id);
            // 高さは固定(h-[66px])。ロック中だけ「◯◯で解放」が2行になり、
            // その曲だけボタンが高くなって下の行までずれていた。
            return <button key={item.id} type="button" data-rhythm-difficulty={item.id} aria-pressed={on}
              data-rhythm-difficulty-locked={open?'0':'1'} disabled={!open}
              title={open?undefined:`${need}をクリアすると挑めます`}
              onClick={()=>{if(open)setDifficultyId(item.id);}}
              className={`flex h-[60px] flex-1 flex-col justify-center rounded-xl border-2 px-1 text-[10px] font-black leading-tight ${open?(on?tone.on:`${tone.off} bg-slate-900/70`):'border-white/10 bg-slate-900/70 text-slate-500'}`}>
              <span className="block">{open?item.id:`🔒 ${item.id}`}</span>
              <span className="block text-[9px] font-black tabular-nums opacity-90">Lv.{song.difficulties[item.id].level}</span>
              {/* 自己ベストは**難易度ごと**に出す。全国ランキングは難易度をまたいだ
                  合算なので、そちらとは別のものだと分かるように、ここへ並べて置く */}
              <span data-rhythm-difficulty-best={item.id} className="mt-0.5 block text-[9px] font-black tabular-nums opacity-80">
                {open
                  ?(()=>{const record=rhythmBestRecord(bestRecords,song.songId,item.id);
                    return record&&record.clear?record.bestScore.toLocaleString():'—';})()
                  :`${need}で解放`}
              </span>
            </button>;
          })}
        </div>

        {/* 「Lv./ノーツ」と自己ベストは同じ1本の行に置く。別々の段に分けていたころは
            そのぶん一覧の高さを取っていた。狭い画面では折り返して2行になる。 */}
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] font-bold">
          <span data-rhythm-demo-level className="text-slate-300">Lv.{chart.level} / {chart.totalNotes}ノーツ</span>
          <span data-rhythm-demo-best className="text-amber-200">
            {best&&best.clear
              ?<>{difficulty.id}の自己ベスト {best.bestScore.toLocaleString()}（ランク {rhythmRankForScore(best.bestScore)}） / 最大コンボ {best.maxCombo}</>
              :<>まだ遊んでいません</>}
          </span>
        </p>

        <div className="mt-1.5 flex gap-2">
          <button type="button" data-rhythm-song-random onClick={pickRandom}
            className="min-h-[48px] w-[38%] rounded-xl border border-white/20 bg-slate-900 text-xs font-black text-slate-200">ランダム</button>
          <button type="button" data-rhythm-demo-start={difficulty.id}
            onClick={()=>onPlay(song,difficulty)}
            className="min-h-[48px] flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-base font-black text-white">決定</button>
        </div>
        {typeof footer==='function'?footer(song,difficulty):footer}
        </>}
    </aside>

    {/* 並び替えのシート。行を1本増やさずに済むよう、選ぶところは下から出す。
        並びを変えても、選んでいる曲・難易度・自己ベスト・全国ランキングは何も変わらない。 */}
    {sortOpen&&<div data-rhythm-sort-sheet className="fixed inset-0 z-[9000] flex items-end justify-center"
      style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.72)',zIndex:9000}}
      onClick={()=>setSortOpen(false)}>
      <section onClick={e=>e.stopPropagation()}
        className="max-h-[80%] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-fuchsia-400/60 bg-slate-900 p-4"
        style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <h3 className="text-sm font-black text-white">曲の並び替え</h3>
        <p className="mt-1 text-[10px] font-bold text-slate-400">並びを変えても、遊べる曲・自己ベスト・全国ランキングは変わりません。</p>
        <div className="mt-3 space-y-1.5">
          {RHYTHM_SORT_ORDERS.map(item=>{
            const on=item.id===state.sort;
            return <button key={item.id} type="button" data-rhythm-sort-option={item.id} aria-pressed={on}
              onClick={()=>{setView({...state,sort:item.id});setSortOpen(false);}}
              className={`flex min-h-[52px] w-full flex-col justify-center rounded-xl border-2 px-3 text-left ${on?'border-fuchsia-300 bg-fuchsia-900/50':'border-white/15 bg-slate-950/60'}`}>
              <b className="text-xs font-black text-white">{on?'● ':''}{item.label}</b>
              <small className="text-[10px] font-bold text-slate-400">{item.note}</small>
            </button>;
          })}
        </div>
        <button type="button" data-rhythm-sort-desc aria-pressed={state.desc}
          onClick={()=>setView({...state,desc:!state.desc})}
          className={`mt-3 flex min-h-[52px] w-full items-center justify-between rounded-xl border-2 px-3 text-xs font-black ${state.desc?'border-cyan-300 bg-cyan-900/40 text-cyan-100':'border-white/15 bg-slate-950/60 text-slate-200'}`}>
          <span>逆から並べる</span><span>{state.desc?'ON':'OFF'}</span>
        </button>
        <button type="button" data-rhythm-sort-close onClick={()=>setSortOpen(false)}
          className="mt-3 min-h-[52px] w-full rounded-xl bg-slate-700 text-sm font-black text-white">とじる</button>
      </section>
    </div>}
  </div>;
};

// ============================================================================
// 振動(ハプティクス)
// ============================================================================
// 【2026-09-05・「オプションにある振動が機能してない」という指摘で作り直した】
// それまでは navigator.vibrate(8) を呼ぶだけだった。これには2つ問題があった。
//   1. iPhone(Safari)には Vibration API そのものが無い。呼んでも何も起きない
//   2. 8msは短すぎて、対応している端末でも無視されることがある
// そこで、
//   ・使える端末では navigator.vibrate を少し長め(12ms)で呼ぶ
//   ・iOSでは、17.4から入った「スイッチ型チェックボックス」を切り替えると端末が
//     コツンと鳴る仕組みを借りる。画面の外へ置いた見えないスイッチを押して代用する
//   ・どちらも無い端末では何も起きない(音とエフェクトはこれまでどおり出る)。
//     オプション画面には「この端末では振動できません」と出して、
//     「設定はあるのに効かない」状態にしない
const RHYTHM_HAPTICS=(()=>{
  let holder=null,built=false,toggled=false;
  const canVibrate=()=>typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
  // iOSのスイッチを1つだけ作って使い回す(押すたびに作ると、そのぶん引っかかる)
  const iosSwitch=()=>{
    if(built)return holder;
    built=true;
    if(typeof document==='undefined'||!document.body)return null;
    try{
      const input=document.createElement('input');
      input.type='checkbox';
      // スイッチ表示に対応していない端末では、この仕組みそのものが無い
      if(!('switch' in input))return null;
      input.setAttribute('switch','');
      input.setAttribute('aria-hidden','true');
      input.tabIndex=-1;
      const label=document.createElement('label');
      label.setAttribute('aria-hidden','true');
      label.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      label.appendChild(input);
      document.body.appendChild(label);
      holder={label,input};
    }catch{holder=null;}
    return holder;
  };
  return {
    // この端末で振動できるか(オプション画面の案内に使う)
    supported:()=>canVibrate()||!!iosSwitch(),
    // 標準のAPIが無く、iOSのスイッチで代用しているか
    fallback:()=>!canVibrate()&&!!iosSwitch(),
    tap:(ms=12)=>{
      if(canVibrate()){try{navigator.vibrate(ms);}catch{}return;}
      const entry=iosSwitch();
      if(!entry)return;
      try{toggled=!toggled;entry.input.checked=toggled;entry.label.click();}catch{}
    },
  };
})();

// 歓声(mhRhythmSideCheer)の長さ。CSS側と同じ値をここに持つ。
// 終わったら data-rhythm-side-hit を外して、待機の動きへ戻すために使う。
const RHYTHM_SIDE_CHEER_MS=700;
const rhythmAbilityEmoji=abilityId=>abilityId==='GENKI'?'💚':abilityId==='MUTEKI'?'🛡️':abilityId==='GAMAN'?'🧱':abilityId==='KONJO'?'🔥':'✨';
const rhythmAbilityTone=abilityId=>abilityId==='GENKI'?'border-emerald-300/50 bg-emerald-950/40 text-emerald-100'
  :abilityId==='MUTEKI'?'border-cyan-300/50 bg-cyan-950/40 text-cyan-100'
  :abilityId==='GAMAN'?'border-amber-300/50 bg-amber-950/40 text-amber-100'
  :abilityId==='KONJO'?'border-rose-300/50 bg-rose-950/40 text-rose-100'
  :'border-white/20 bg-slate-900/60 text-slate-300';
// 能力ごとに「その能力になる血統」をまとめる。並びは RHYTHM_MONSTER_ABILITIES の順。
const rhythmAbilityRows=()=>Object.values(RHYTHM_MONSTER_ABILITIES).map(ability=>({
  ability,
  lineages:Object.entries(RHYTHM_MONSTER_ABILITY_BY_LINEAGE)
    .filter(([,id])=>id===ability.id)
    .map(([lineageId])=>lineageById(lineageId).name),
}));
const rhythmSlotAbility=masu=>(masu&&masu.baseId)
  ?rhythmMonsterAbilityForLineage(monsterLineageOf(masu.baseId).main.id):null;

// モンスターノーツの説明。マスモン設定の画面へ置く「詳細」。
// 【2026-09-05・ユーザー指示】「マスモン設定のとこをUIやレイアウトを整えて。
//   モンスターノーツが何がつくかとか説明とかその辺の詳細を追加して」
// 能力の一覧は実データ(RHYTHM_MONSTER_ABILITIES / RHYTHM_MONSTER_ABILITY_BY_LINEAGE)から作る。
// 手で書き写すと、値を変えたときにここだけ古いまま残るため。
const RhythmMonsterNoteGuide=()=>{
  const ratios=rhythmMonsterNoteBaseRatios(RHYTHM_MONSTER_SLOT_MAX).map(ratio=>`${Math.round(ratio*100)}%`);
  return <section data-rhythm-monster-guide className="space-y-3">
    <article className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
      <h3 className="text-sm font-black text-amber-100">モンスターノーツとは</h3>
      <p className="mt-2 text-[11px] font-bold leading-relaxed text-amber-50/90">
        ここで設定したマスモンは、曲の途中で金色の「モンスターノーツ」になって流れてきます。
        ノーツの真ん中には、そのマスモンの染色を反映した絵が出ます。
      </p>
      <ul className="mt-2 space-y-1 text-[11px] font-bold leading-relaxed text-amber-50/90">
        <li>・設定した順に、<b>1体につき1回・最大{RHYTHM_MONSTER_SLOT_MAX}回</b>出てきます。</li>
        <li>・出てくるのは曲のだいたい {ratios.join(' / ')} あたりです（曲の切れ目に合わせるので前後します）。</li>
        <li>・<b>{RHYTHM_MONSTER_ABILITY_JUDGMENTS.join('・')}</b> で取ると、そのマスモンの能力が出ます。GOOD・BAD・MISSでは出ません。</li>
        <li>・判定の幅・スコアの計算・コンボの数え方は、ふつうのノーツとまったく同じです。</li>
        <li>・いまはTAPのノーツだけがモンスターノーツになります。</li>
      </ul>
    </article>
    <article className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
      <h3 className="text-sm font-black text-white">どの能力が付くか</h3>
      <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">
        能力は<b className="text-slate-200">主血統</b>で決まります。副血統では変わりません。育成・染色でも変わりません。
      </p>
      <ul data-rhythm-ability-table className="mt-2 space-y-2">
        {rhythmAbilityRows().map(({ability,lineages})=>(
          <li key={ability.id} data-rhythm-ability={ability.id}
            className={`rounded-xl border p-2.5 ${rhythmAbilityTone(ability.id)}`}>
            <div className="flex items-baseline gap-1.5">
              <span aria-hidden="true" className="text-sm leading-none">{rhythmAbilityEmoji(ability.id)}</span>
              <b className="text-[12px] font-black leading-none">{ability.name}</b>
            </div>
            <p className="mt-1.5 text-[11px] font-bold leading-relaxed">{rhythmAbilityEffectText(ability)}</p>
            <p className="mt-1 text-[10px] font-bold leading-relaxed opacity-80">主血統: {lineages.join(' / ')}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] font-bold leading-relaxed text-slate-400">
        無敵と我慢は効果の長さが違うので、それぞれの残り時間で別々に動きます。
        両方効いているあいだは無敵が勝ち、無敵が切れたら我慢の軽減に変わります。
        残り時間と根性を持っているかは、演奏中の画面の右上に出ます。
      </p>
    </article>
  </section>;
};

// マスモン設定の本体。枠の並び順がそのままモンスターノーツの登場順(§3.3)。
// 枠には「何番目に出るか」と「その子で何の能力が出るか」まで出す。
// 名前だけを並べていたころは、設定してもプレイ中に何が起きるのか画面から分からなかった。
const RhythmMonsterSlotsPanel=({rhythmMonsterSlots,rhythmMonsterSlotIdsInUse,rhythmMonsterPickerOpen,setRhythmMonsterPickerOpen,rhythmMonsterMessage,setRhythmMonsterMessage,applyRhythmMonsterSlots,masuMons})=>(
  <section data-rhythm-monster-slots className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-950/20 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-fuchsia-200">モンスターノーツ用マスモン</h3><span data-rhythm-monster-count className="shrink-0 rounded-full border border-fuchsia-300/50 px-2 py-0.5 text-[10px] font-black text-fuchsia-200">{rhythmMonsterSlots.length} / {RHYTHM_MONSTER_SLOT_MAX}体</span></div>
              <p className="mt-2 text-[10px] font-bold leading-relaxed text-fuchsia-100/80">上から順に登場します。同じモンスターは別の個体でも重ねて設定できません。{RHYTHM_MONSTER_SLOT_MAX}体そろえる必要はなく、1〜3体でも遊べます。</p>
              <ol className="mt-3 space-y-2">{Array.from({length:RHYTHM_MONSTER_SLOT_MAX},(_,index)=>{
                const masu=rhythmMonsterSlots[index]||null,base=masu?ALL_PLAYER_MONSTERS[masu.baseId]:null;
                const lineage=masu?monsterLineageOf(masu.baseId).main:null;
                const ability=rhythmSlotAbility(masu);
                return <li key={index} data-rhythm-monster-slot={index+1} className="rounded-xl border border-white/10 bg-slate-900/80 p-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 shrink-0 rounded-lg border border-fuchsia-300/40 py-0.5 text-center text-[9px] font-black leading-tight text-fuchsia-200">{index+1}<br/>番目</span>
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-950">{masu&&base&&<DyedMonsterImage baseId={masu.baseId} src={masuDisplayImageUrl(base)} alt={masu.name} masuColors={getMasuColors(masu)} draggable={false} className="h-full w-full object-contain"/>}</div>
                    <div className="min-w-0 flex-1">{masu?<React.Fragment><b className="block truncate text-[12px] font-black">{masu.name}</b><small className="block truncate text-[10px] text-slate-400">{base?.name||masu.baseId}{lineage?` / ${lineage.name}血統`:''}</small></React.Fragment>:<small className="text-[11px] font-bold text-slate-500">未設定</small>}</div>
                    {masu&&<div className="flex shrink-0 gap-1">
                      <button type="button" aria-label={`${index+1}枠目を前へ`} disabled={index===0} onClick={()=>applyRhythmMonsterSlots(moveRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,index,-1),'登場順を入れ替えました')} className="min-h-[40px] min-w-[40px] rounded-lg border border-white/20 text-[12px] font-black text-slate-200 disabled:opacity-30">↑</button>
                      <button type="button" aria-label={`${index+1}枠目を後ろへ`} disabled={index>=rhythmMonsterSlots.length-1} onClick={()=>applyRhythmMonsterSlots(moveRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,index,1),'登場順を入れ替えました')} className="min-h-[40px] min-w-[40px] rounded-lg border border-white/20 text-[12px] font-black text-slate-200 disabled:opacity-30">↓</button>
                      <button type="button" data-rhythm-monster-remove aria-label={`${masu.name}を外す`} onClick={()=>applyRhythmMonsterSlots(removeRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,masu.id),`${masu.name}を外しました`)} className="min-h-[40px] rounded-lg border border-rose-300/50 px-2 text-[11px] font-black text-rose-200">外す</button>
                    </div>}
                  </div>
                  {/* 設定した子で「何が起きるか」まで枠の中に出す。
                      名前だけでは、プレイ中に何が起きるのかここから分からなかった */}
                  {masu&&<p data-rhythm-monster-slot-ability={ability?ability.id:'none'}
                    className={`mt-2 rounded-lg border px-2 py-1.5 text-[10px] font-bold leading-relaxed ${rhythmAbilityTone(ability?ability.id:'')}`}>
                    {ability
                      ?<>{rhythmAbilityEmoji(ability.id)} {ability.name} — {rhythmAbilityEffectText(ability)}</>
                      :<>この血統の能力はまだ決まっていません。モンスターノーツにはなりますが、能力は出ません。</>}
                  </p>}
                </li>;})}</ol>
              <button type="button" data-rhythm-monster-picker-toggle aria-expanded={rhythmMonsterPickerOpen} onClick={()=>{setRhythmMonsterPickerOpen(!rhythmMonsterPickerOpen);setRhythmMonsterMessage('');}} className="mt-3 min-h-[48px] w-full rounded-xl border border-fuchsia-300/60 bg-fuchsia-900/40 text-[12px] font-black text-fuchsia-100">{rhythmMonsterPickerOpen?'マスモン一覧を閉じる':'マスモンから設定する'}</button>
              {rhythmMonsterMessage&&<p data-rhythm-monster-message role="status" className="mt-2 text-[11px] font-bold text-amber-200">{rhythmMonsterMessage}</p>}
              {rhythmMonsterPickerOpen&&<ul data-rhythm-monster-picker className="mh-scroll mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                {masuMons.filter(masu=>masu&&ALL_PLAYER_MONSTERS[masu.baseId]).map(masu=>{
                  const base=ALL_PLAYER_MONSTERS[masu.baseId],issue=rhythmMonsterSlotAddIssue(rhythmMonsterSlotIdsInUse,masu.id,masuMons);
                  const ability=rhythmSlotAbility(masu);
                  return <li key={masu.id}><button type="button" disabled={!!issue} onClick={()=>applyRhythmMonsterSlots(addRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,masu.id,masuMons),`${masu.name}を${rhythmMonsterSlots.length+1}枠目に設定しました`)} className={`flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border p-2 text-left ${issue?'border-white/10 bg-slate-900/40 opacity-50':'border-white/20 bg-slate-900/80'}`}>
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-950"><DyedMonsterImage baseId={masu.baseId} src={masuDisplayImageUrl(base)} alt="" masuColors={getMasuColors(masu)} draggable={false} className="h-full w-full object-contain"/></div>
                    <div className="min-w-0 flex-1"><b className="block truncate text-[12px] font-black">{masu.name}</b><small className="block truncate text-[10px] text-slate-400">{base.name}{ability?` / ${rhythmAbilityEmoji(ability.id)}${ability.name}`:''}</small></div>
                    {issue&&<small className="shrink-0 text-[10px] font-bold text-rose-300">{RHYTHM_MONSTER_SLOT_ISSUE_TEXT[issue]}</small>}
                  </button></li>;})}
                {masuMons.filter(masu=>masu&&ALL_PLAYER_MONSTERS[masu.baseId]).length===0&&<li className="rounded-xl border border-white/10 p-4 text-center text-[11px] font-bold text-slate-500">設定できるマスモンがいません</li>}
              </ul>}
            </section>
);

// debugPlay … 音ゲーデバッグ画面から始めたプレイかどうか。
// デバッグ専用の表示(HOLD TEST / 中断して音ゲーデバッグへ戻る / 座標校正)は、
// ここが true のときだけ出す。体験版から入ったプレイヤーの画面へ出してはいけない
// (2026-09-05・実機の指摘「ここがデバッグのままになってる」)。
// tutorial … 「あそびかた練習」で開いたかどうか。
// 演奏画面をそのまま使って各ノーツの操作を1つずつ覚える(2026-09-05・ユーザー指示)。
// 練習なのでライフは減らさず、スコアも記録も残さない。
const RhythmTapTest=({song,difficulty,settings,bestRecord,monsterEntries,onComplete,onExit,debugPlay=false,tutorial=false})=>{
  const chart=song.difficulties[difficulty.id],laneRefs=useRef([]),runRef=useRef(null),frameRef=useRef(null),playAreaRef=useRef(null),judgmentLineRef=useRef(null),judgmentBandRef=useRef(null),judgmentTimerRef=useRef(null),judgmentRevisionRef=useRef(0),startLockRef=useRef(false),generationRef=useRef(0),mountedRef=useRef(false),glowNodesRef=useRef(null);
  const tutorialBannerRef=useRef(null),tutorialStepRef=useRef(null);
  const hasHold=chart.notes.some(note=>note.type==='HOLD');
  // デバッグ画面で譜面の中身をひと目で見るための表記。プレイヤーの画面には出さない。
  // 以前は data/rhythm-mode.js が DOM を直接 'MIX TEST' へ書き換えていて、
  // 体験版から入ったプレイヤーの画面にも出ていた(2026-09-05・実機の指摘)
  const debugChartLabel=chart.notes.some(note=>note.type==='FLICK'||note.type==='SLIDE')?'MIX TEST':hasHold?'HOLD TEST':'TAP TEST';
  // モンスターノーツで使うマスモン。枠の順(1〜4)がそのまま登場順(§3.3)。
  // useCallbackの依存を毎回変えないようrefで持つ
  const monsters=Array.isArray(monsterEntries)?monsterEntries:[];
  const monstersRef=useRef(monsters);monstersRef.current=monsters;
  // 親(App本体)は rhythmMonsterNoteEntries を描画のたびに map で作り直すため、配列の同一性では
  // 判定できない。ノーツの見た目に効く項目だけを文字列にして、中身が同じあいだはメモを保つ。
  const monsterSignature=monsters.map(m=>m?`${m.baseId}|${m.imageUrl}|${JSON.stringify(m.colors||null)}`:'-').join(',');
  // ノーツのDOMは譜面が変わらないかぎり同じものでよい。ここをuseMemoで固定しないと、
  // ノーツを1つ判定して setView するたびに全ノーツ(最大300要素)をReactが作り直し、
  // ref も付け直すため、タップのたびに一瞬止まって見える(2026-09-04の実機報告)。
  const noteElements=useMemo(()=>chart.notes.map((note,index)=>{const monsterSlot=rhythmNoteMonsterSlot(note),monster=monsterSlot?monsters[monsterSlot-1]||null:null;return <div key={index} ref={el=>laneRefs.current[index]=el} data-rhythm-note data-note-type={note.type} data-rhythm-note-wide={rhythmNoteIsWide(note)?'1':undefined} data-rhythm-monster-note={monster?monsterSlot:undefined} className="absolute top-0 h-5" style={{left:`calc(${note.lane*20}% + 5px)`,width:'calc(20% - 10px)',pointerEvents:'none'}}>{note.type==='HOLD'&&<span data-rhythm-hold-body className="absolute left-[18%] right-[18%] bottom-1/2 rounded-t-lg bg-gradient-to-t from-emerald-400/90 to-cyan-300/70" style={{height:'var(--rhythm-hold-body, 0px)'}}/>}{(note.type==='HOLD'||note.type==='SLIDE')&&<span data-rhythm-end-bar data-rhythm-end-flick={note.endFlick===true?'1':undefined} aria-hidden="true" className="absolute z-[2] h-2 rounded-full border border-white/80 bg-gradient-to-r from-fuchsia-400 via-cyan-100 to-fuchsia-400 shadow-[0_0_10px_#67e8f9,0_0_18px_#d946ef]" style={{pointerEvents:'none',transform:'scaleY(var(--rhythm-end-depth-scale, 1))',boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 0 7px #67e8f9':'0 0 10px #67e8f9,0 0 18px #d946ef'}}/>}<span data-rhythm-note-head className={`absolute inset-0 rounded-full ${monster?'bg-gradient-to-b from-amber-100 to-amber-500 ring-2 ring-amber-200':note.type==='HOLD'?'border-2 border-white/90 bg-gradient-to-b from-cyan-50 to-cyan-400':'bg-gradient-to-b from-amber-200 to-fuchsia-500'}`} style={{boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 2px 6px rgba(15,23,42,.45)':'0 10px 15px -3px rgba(0,0,0,.24)'}}>{/* 長押しの押し始めは、帯と同じ色の丸が帯の下でわずかに太るだけで、
                「どこを押せばよいか」が読み取れなかった(2026-09-05・実機の指摘)。
                終わりには光るバーがあるのに、始まりには目印が無かった。
                白いふちと1本の線で「叩く粒」だと分かるようにする。線はspanではないので、
                幅広ノーツの両端バーが使う >span:last-child::before/::after とはぶつからない。
                判定・当たり判定・幅・速さは一切変えていない(見た目だけ) */}
                {!monster&&note.type==='HOLD'&&<i data-rhythm-hold-head-mark aria-hidden="true" className="pointer-events-none absolute left-[24%] right-[24%] top-1/2 block h-[2px] -translate-y-1/2 rounded-full bg-sky-950/55"/>}</span>{/* 設定したマスモンの染色済みの絵をノーツ中央へ出す(§3.5)。
                奥行きはレーンと同じ --rhythm-note-depth-scale へ乗せるので、毎フレームJSで書き換えない。
                絵はプレイ開始時に一度だけ組み立て、そのまま使い回す */}
                {monster&&<span data-rhythm-monster-face aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-[42px] w-[42px] items-center justify-center" style={{transform:'translate(-50%,-50%) scale(var(--rhythm-note-depth-scale, 1))'}}>{monster.imageUrl&&<DyedMonsterImage baseId={monster.baseId} src={monster.imageUrl} alt="" masuColors={monster.colors} draggable={false} className="h-full w-full object-contain"/>}</span>}</div>;}),[chart.notes,monsterSignature,settings.lightweightMode,settings.effectAmount]);
  // レーン枠・サブレーン境界・サブレーン発光も、遊んでいるあいだは中身が変わらない。
  // 発光の ON/OFF は setPressedLanes が直接DOMへ書くので、Reactが作り直す必要はない。
  const laneElements=useMemo(()=><><div className="pointer-events-none absolute inset-0 grid grid-cols-5">{Array.from({length:5},(_,lane)=><div key={lane} data-rhythm-lane={lane} data-pressed="false" aria-hidden="true" className="relative border-r border-white/20 bg-slate-900/40" style={{transition:settings.lightweightMode?'none':'background-color 60ms linear, box-shadow 60ms linear, filter 60ms linear, border-color 60ms linear',borderBottom:'3px solid transparent',boxSizing:'border-box'}}></div>)}</div><div className="pointer-events-none absolute inset-0" aria-hidden="true">{Array.from({length:5},(_,index)=><i key={index} data-rhythm-sublane-boundary="" />)}</div><div className="pointer-events-none absolute inset-0" aria-hidden="true">{Array.from({length:10},(_,subLane)=><i key={subLane} data-rhythm-sublane-feedback={subLane} data-pressed="false" className="absolute inset-0 opacity-0" style={{clipPath:rhythmSubLanePolygon(subLane),background:'linear-gradient(to bottom,rgba(34,211,238,.12) 0%,rgba(34,211,238,.2) 48%,rgba(103,232,249,.5) 76%,rgba(236,254,255,.94) 88%,rgba(103,232,249,.58) 94%,rgba(34,211,238,.28) 100%)',boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'inset 0 -18px 18px rgba(207,250,254,.38),0 0 8px rgba(103,232,249,.38)':'inset 0 -52px 42px rgba(207,250,254,.72),inset 0 -10px 16px rgba(255,255,255,.82),0 0 20px rgba(103,232,249,.72)',filter:settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'brightness(1.08)':'brightness(1.22)',transition:settings.lightweightMode?'none':'opacity 45ms linear',willChange:settings.lightweightMode?'auto':'opacity'}}/>)}</div></>,[settings.lightweightMode,settings.effectAmount]);
  const monsterForNote=note=>{const slot=rhythmNoteMonsterSlot(note);return slot?monstersRef.current[slot-1]||null:null;};
  // --- 両サイドのマスモン ---
  // レーンの外側に空いている三角形へ、設定したマスモンを置いて拍に合わせて跳ねさせる。
  // 跳ねるのはCSSアニメーションなので毎フレームのJSは走らない。置き場所と大きさは
  // rhythmLayoutSideMonsters が、プレイエリアの大きさが変わったときだけ測り直す。
  const sideMonsterRefs=useRef([]),screenFlashRef=useRef(null),judgmentTextRef=useRef(null),comboRef=useRef(null);
  const sideMonsterElements=useMemo(()=>{
    if(settings.sideMonsterOpacity==='OFF')return null;
    const opacity=rhythmSideMonsterOpacityValue(settings.sideMonsterOpacity);
    return <div data-rhythm-side-monsters aria-hidden="true" className="pointer-events-none absolute inset-0">
      {monsters.map((monster,index)=>{
        if(!monster||!monster.imageUrl)return null;
        const slot=index+1;
        return <span key={slot} ref={el=>{sideMonsterRefs.current[index]=el;}}
          data-rhythm-side-monster={slot}
          data-rhythm-side-motion={settings.lightweightMode||settings.effectAmount==='MINIMAL'?'NONE':settings.sideMonsterMotion}
          data-rhythm-side-active="0"
          data-rhythm-side-phase="intro"
          style={{'--rhythm-side-opacity':opacity,'--rhythm-side-delay':`${index%2===0?0:-250}ms`}}>
          {/* 絵の入れ物を1枚はさむ。跳ねる動き(transform)は外のspanが使っているので、
              能力中の「さらに大きく見せる」はこちらのtransformで出す(重ねて書けないため)。
              DyedMonsterImage は染色ありのとき<div>で返るので、
              **className で大きさを渡さないと中身が0pxになって何も見えない**(実機で発生) */}
          <span data-rhythm-side-monster-art>
            <DyedMonsterImage baseId={monster.baseId} src={monster.imageUrl} alt="" masuColors={monster.colors} draggable={false} className="h-full w-full object-contain"/>
          </span>
        </span>;
      })}
    </div>;
  },[monsterSignature,settings.sideMonsterOpacity,settings.sideMonsterMotion,settings.lightweightMode,settings.effectAmount]);
  const abilityTimerRef=useRef(null),abilityRevisionRef=useRef(0),abilityBadgeRef=useRef(null);
  const emptyCounts=()=>Object.fromEntries(RHYTHM_JUDGMENT_IDS.map(id=>[id,0]));
  const makeRuntimeNotes=()=>chart.notes.map((note,index)=>({...note,index,done:false,activePointerId:null,holdJudgment:null,holdDeltaMs:0,...(note.type==='SLIDE'?{_rhythmSlideRenderPoints:rhythmSlidePoints(note)}:{})}));
  const initialView=()=>({status:'loading',score:0,combo:0,maxCombo:0,last:'',fastSlow:'',counts:emptyCounts(),fast:0,slow:0,life:RHYTHM_LIFE_MAX,ability:null,result:null});
  const [view,setView]=useState(initialView);
  /* 演奏を始める前のカウントダウン(READY→3→2→1)。
     null のあいだは出さない。曲と毎フレームの処理はこれが終わってから動かす */
  const [countdownStep,setCountdownStep]=useState(null);
  const countdownTimerRef=useRef(null);
  const countdownResolveRef=useRef(null);
  // 100コンボごとの演出。
  // 「段階(tier)が変わったときだけ」effectを動かすのが肝心で、以前は view.combo(=ノーツを取るたび
  // 毎回変わる値)を依存にしていたため、100→101など非節目の増加でも毎回effectが再実行され、
  // その"後片付け"がまだ生きていた表示タイマー(setTimeoutで1.1秒後にcomboMilestoneを0へ戻す処理)を
  // 節目の直後に即座に解除してしまっていた。結果、100コンボの表示だけがopacity:0のまま固まって
  // 二度と動かず、200・300では何も起きないように見えるバグになっていた。
  // tierを先に計算してそれをeffectの依存にすることで、実際に100の位が変わったときだけ動く。
  // 演出量MINIMAL・軽量モードでは出さない(端末を重くしないため)。
  const [comboMilestone,setComboMilestone]=useState(0);
  const comboMilestoneTier=Math.floor((Number(view.combo)||0)/RHYTHM_COMBO_MILESTONE_STEP);
  useEffect(()=>{
    if(settings.lightweightMode||settings.effectAmount==='MINIMAL'||comboMilestoneTier<=0){
      setComboMilestone(0);
      return;
    }
    setComboMilestone(comboMilestoneTier*RHYTHM_COMBO_MILESTONE_STEP);
    const timer=setTimeout(()=>setComboMilestone(0),1100);
    return ()=>clearTimeout(timer);
  },[comboMilestoneTier,settings.lightweightMode,settings.effectAmount]);
  // 100→1段階目のように、コンボが伸びるほど演出を派手にする。ただしどこまでも大きくはせず
  // 500コンボ(5段階目)で頭打ちにする(数字自体はそのまま表示する)。
  const comboMilestoneStage=Math.min(5,comboMilestoneTier);
  // ランクゲージ横の「次のランクはここまで」の表示(2026-09-04)。
  // ランクの判定・しきい値そのものは増やさず、既存のrhythmRankForScore/rhythmRankProgressが
  // 使っているのと同じRHYTHM_RANKSから素直に導く値。最上位(M)に届いたら「★MAX」を出す。
  // 難易度のmaxScore(満点)も渡し、EASYで「→S」のようなその難易度では絶対に届かない
  // 次ランクを出さないようにする(2026-09-04、Codexレビューで指摘された不具合の修正)。
  const rankNextId=rhythmNextRankId(view.score,difficulty.maxScore);
  const rankNextLabel=rankNextId?`→${rankNextId}`:'★MAX';
  // 横画面向けHUD配置(§6.2)で使う。曲名の折り返し行数(WebkitLineClamp)はインラインstyleで
  // 決めるためTailwindのlandscape:だけでは切り替えられず、ここだけJSの向き判定を使う。
  // ほかのHUDレイアウトの出し分けはTailwindのlandscape:バリアントで完結させ、判定・スコア・
  // runには一切触らない(§6.1)。
  const [isLandscape,setIsLandscape]=useState(()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(orientation: landscape)').matches);
  useEffect(()=>{
    if(typeof window==='undefined'||typeof window.matchMedia!=='function')return;
    const mql=window.matchMedia('(orientation: landscape)');
    const onChange=()=>setIsLandscape(mql.matches);
    onChange();
    if(mql.addEventListener)mql.addEventListener('change',onChange);else mql.addListener?.(onChange);
    return()=>{if(mql.removeEventListener)mql.removeEventListener('change',onChange);else mql.removeListener?.(onChange);};
  },[]);
  const stopFrame=useCallback(()=>{if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);frameRef.current=null;},[]);
  const clearJudgmentTimer=useCallback(()=>{if(judgmentTimerRef.current!==null)clearTimeout(judgmentTimerRef.current);judgmentTimerRef.current=null;++judgmentRevisionRef.current;},[]);
  const scheduleJudgmentClear=useCallback(()=>{if(judgmentTimerRef.current!==null)clearTimeout(judgmentTimerRef.current);const revision=++judgmentRevisionRef.current;judgmentTimerRef.current=setTimeout(()=>{if(revision!==judgmentRevisionRef.current)return;judgmentTimerRef.current=null;setView(v=>({...v,last:'',fastSlow:''}));},RHYTHM_JUDGMENT_DISPLAY_MS);},[]);
  // 能力の発動表示(「ミーア　元気！」)は短時間で消す。判定表示とは別のタイマーで持つ
  const clearAbilityTimer=useCallback(()=>{if(abilityTimerRef.current!==null)clearTimeout(abilityTimerRef.current);abilityTimerRef.current=null;++abilityRevisionRef.current;},[]);
  /* カウントダウンの後始末。disposeRun がこれを呼ぶので、必ず disposeRun より前で定義する。
     const は「使う場所より後ろ」に書くと初期化前アクセスで画面が真っ白になる */
  const clearCountdown=useCallback(()=>{
    if(countdownTimerRef.current){clearTimeout(countdownTimerRef.current);countdownTimerRef.current=null;}
    /* 待っている側(beginRun の await)へも必ず答えを返す。
       タイマーを消すだけだと次の step が走らず、Promise が解決されないまま残り、
       そのプレイぶんの beginRun がずっと止まったままになる(リスタートのたびに1つ増える) */
    if(countdownResolveRef.current){const resolve=countdownResolveRef.current;countdownResolveRef.current=null;resolve(false);}
    setCountdownStep(null);
  },[]);
  const scheduleAbilityClear=useCallback(()=>{if(abilityTimerRef.current!==null)clearTimeout(abilityTimerRef.current);const revision=++abilityRevisionRef.current;abilityTimerRef.current=setTimeout(()=>{if(revision!==abilityRevisionRef.current)return;abilityTimerRef.current=null;setView(v=>({...v,ability:null}));},RHYTHM_MONSTER_ABILITY_DISPLAY_MS);},[]);
  // プレイエリア・判定ライン・ノーツの箱の大きさは、画面が回転・リサイズされない限り変わらない。
// (ノーツは absolute の固定高さで、奥行きの拡大は子要素のtransformなので外側の高さに響かない)
// それなのに毎フレーム getBoundingClientRect を3回呼んでいたため、直前のフレームで数百個の
// ノーツへ書き込んだスタイルを、毎フレーム強制的に計算し直させていた。ノーツが増える譜面ほど重く、
// これが実機のカクつきの主因だった。測った結果を覚えておき、変わりうるときだけ測り直す。
const travelCacheRef=useRef(null);
// 測った寸法が「遊べる形」になっているか。
// 高さが0でないことだけを見ていたため、まだ組み上がっていない最中の値
// (Tailwindが効く前・絵の読み込み前・画面の回転中など)をそのまま覚えてしまい、
// ノーツが画面の外に置かれたまま固定されて、判定(MISS)だけが進む状態になっていた
// (2026-09-05・実機の指摘「初回起動時はよくこの状態になる」)。
// リスタートで直っていたのは、そのとき覚えた値を捨てていたからにすぎない。
const rhythmTravelLooksReady=(areaRect,lineRect)=>{
  if(!(areaRect.height>0&&areaRect.width>0))return false;
  // 画面より大きいプレイエリアは、まだ中身が積み上がっている最中。
  // (実測: レイアウトが効く前は 844pxの画面で 3352px になっていた)
  const viewportHeight=typeof window!=='undefined'&&window.innerHeight>0?window.innerHeight:0;
  if(viewportHeight>0&&areaRect.height>viewportHeight*1.5)return false;
  // 判定ラインに厚みが無いなら、まだ形が決まっていない。
  // 以前は「中心がエリアの中にあること」しか見ておらず、線が高さ0のまま
  // エリアの先頭に居る状態(スタイルが効く前)をそのまま通していた
  if(!(lineRect.height>0))return false;
  const lineCenter=lineRect.top+lineRect.height/2;
  if(!(lineCenter>=areaRect.top&&lineCenter<=areaRect.bottom))return false;
  // 判定ラインは下から12%の位置に置く。エリアの上半分に居るなら、
  // まだ置き場所が決まっていない(高さ0でなくても、位置だけ未確定のことがある)
  if(!(lineCenter>areaRect.top+areaRect.height*0.5))return false;
  return true;
};
const measureTravel=useCallback(()=>{
  const cached=travelCacheRef.current;
  if(cached)return cached;
  const area=playAreaRef.current,line=judgmentLineRef.current;
  if(!area||!line)return null;
  RHYTHM_PERF.layoutRead();RHYTHM_PERF.layoutRead();RHYTHM_PERF.layoutRead();
  const areaRect=area.getBoundingClientRect(),lineRect=line.getBoundingClientRect(),noteHeight=laneRefs.current.find(Boolean)?.getBoundingClientRect().height||20;
  const spawnY=-noteHeight+(settings.noteStartPosition/100)*areaRect.height*.2;
  const judgmentY=lineRect.top-areaRect.top+lineRect.height/2-noteHeight/2;
  // ready:false は「まだノーツを正しい場所へ置けない」。判定を進めてよいかの目印にも使う
  const ready=rhythmTravelLooksReady(areaRect,lineRect);
  const result={spawnY,judgmentY,travelPx:judgmentY-spawnY,playAreaHeight:areaRect.height,rect:areaRect,noteHeight,ready};
  // 組み上がっていると確かめられたときだけ覚える。そうでなければ毎フレーム測り直し、
  // 整った瞬間から正しい位置で流れ始める(遊べない状態のまま固定されない)
  if(ready)travelCacheRef.current=result;
  return result;
},[settings.noteStartPosition]);
// --- 判定ラインの「幅」を描く ---
// 上下のふちがGOOD(前後0.2秒)の端、内側の明るいところがMARVELOUS(前後0.055秒)。
// 何ピクセルになるかはノーツ速度(travelMs)と画面の高さで変わるので、実測から毎回出す。
// 書き込むのは「前と違うときだけ」。位置が変わらないフレームでは何もしないので、
// 毎フレームの塗り直しは増えない。判定・スコアには一切関与しない見た目だけの処理。
const updateJudgmentBand=useCallback((travel,travelMs)=>{
  const el=judgmentBandRef.current;
  if(!el)return;
  const layout=travel&&travel.ready?rhythmJudgmentBandLayout(travel,travelMs):null;
  if(!layout){
    if(el._rhythmBandKey!=='off'){el.style.opacity='0';el._rhythmBandKey='off';}
    return;
  }
  const top=Math.round(layout.top),height=Math.round(layout.height);
  const centerPercent=Math.max(4,Math.min(96,layout.centerRatio*100));
  const key=`${top}/${height}/${centerPercent.toFixed(1)}`;
  if(el._rhythmBandKey===key)return;
  el._rhythmBandKey=key;
  const near=(centerPercent*.55).toFixed(1),far=(centerPercent+(100-centerPercent)*.45).toFixed(1);
  el.style.top=`${top}px`;
  el.style.height=`${height}px`;
  el.style.opacity='1';
  el.style.background='linear-gradient(180deg,rgba(103,232,249,0) 0%,'
    +`rgba(103,232,249,.10) ${near}%,`
    +`rgba(217,70,239,.17) ${centerPercent.toFixed(1)}%,`
    +`rgba(103,232,249,.10) ${far}%,`
    +'rgba(103,232,249,0) 100%)';
  const core=el.querySelector('[data-rhythm-judgment-core]');
  if(core){
    core.style.top=`${Math.round(layout.marvelousTop-layout.top)}px`;
    core.style.height=`${Math.max(2,Math.round(layout.marvelousBottom-layout.marvelousTop))}px`;
  }
},[]);
// 覚えている寸法が今も正しいか。プレイエリアの大きさが変わったら捨てて測り直す。
// 絵の読み込みが終わった・画面が回った・セーフエリアが確定した、はどれも resize を
// 起こさないことがあるので、window の resize だけでは取りこぼす。
useEffect(()=>{
  const area=playAreaRef.current;
  if(!area||typeof ResizeObserver==='undefined')return;
  // 監視するだけでDOMは書き換えないので、自分の変化で自分がまた呼ばれる心配はない
  const observer=new ResizeObserver(()=>{travelCacheRef.current=null;});
  observer.observe(area);
  return ()=>observer.disconnect();
},[]);
// 画面の大きさが変わったら測り直す。設定(開始位置・ノーツサイズ)を変えたときと、
// プレイの状態が切り替わった直後も、いったん捨てて測り直す。
useEffect(()=>{
  travelCacheRef.current=null;
  if(typeof window==='undefined')return;
  const invalidate=()=>{travelCacheRef.current=null;};
  window.addEventListener('resize',invalidate);
  window.addEventListener('orientationchange',invalidate);
  return ()=>{window.removeEventListener('resize',invalidate);window.removeEventListener('orientationchange',invalidate);};
},[settings.noteStartPosition,settings.noteSize,view.status]);
  const applyJudgment=useCallback((note,judgment,deltaMs)=>{const run=runRef.current;if(!run||run.finished||run.paused||note.done)return;if(note.activePointerId!==null){if(note.activePointerId!==-1)run.activePointers.delete(note.activePointerId);note.activePointerId=null;}note.releasedAtMs=null;rhythmFloatingNoteRemove(note);note.done=true;note._rhythmFinalJudgment=judgment;
// HOLD / SLIDE を最後まで取れた・FLICKが成立したときは、そこで音と光を返す。
// TAPは指を置いた時点で音が鳴っているので対象にしない。
// (実機で「フリックが成功したのか分かりづらい」「取れた手ごたえがほしい」という報告があった)
const clearedGesture=judgment!=='MISS'&&(note.type==='HOLD'||rhythmNoteIsSlide(note)||note._rhythmOriginalType==='FLICK');
if(clearedGesture){
  RHYTHM_NOTE_SE_RUNTIME.playClear();
  // 光は演出量の設定に従う(MINIMAL・軽量モードでは出さない)。音は設定に関わらず鳴らす
  if(!settings.lightweightMode&&settings.effectAmount!=='MINIMAL')note._rhythmClearAt=run.audio?.songTimeMs?.()??0;
}
// --- 取れたノーツを判定ラインで弾けさせる(2026-09-05「画面演出はあまりかわってない」への対応) ---
// 要素は使い回すので、押すたびにDOMは増えない。動くのは transform と opacity だけ。
// モンスターノーツは1曲に最大4回しか来ないので、光を大きく長くして特別扱いにする。
if(judgment!=='MISS'){
  const monsterHit=!!monsterForNote(note);
  if(monsterHit)RHYTHM_NOTE_SE_RUNTIME.playMonster();
  if(!settings.lightweightMode&&settings.effectAmount!=='MINIMAL'){
    const area=playAreaRef.current;
    // 光の位置と幅はノーツと同じ投影から出す(判定ラインの高さ=1)。
    const span=rhythmNoteIsSlide(note)
      ?rhythmProjectSlideSpan(rhythmReleaseLane(note),note,1,run.audio?.songTimeMs?.()??note.timeMs)
      :rhythmNoteVisualSpan(note,note.lane,1,run.audio?.songTimeMs?.()??note.timeMs);
    rhythmSpawnHitEffect(area,{centerRatio:span.center,widthRatio:span.width,judgment,monster:monsterHit});
    if(monsterHit&&screenFlashRef.current){
      const flash=screenFlashRef.current;
      flash.dataset.rhythmFlash='';
      void flash.offsetWidth;
      flash.dataset.rhythmFlash='1';
    }
    // そのマスモンが両サイドで大きく跳ねる(どのマスモンの番だったかが分かるように)
    if(monsterHit){
      // モンスターノーツだけは振動も強くする(ふつうのノーツとの違いを指でも分かるように)
      if(settings.vibrationEnabled)RHYTHM_HAPTICS.tap(26);
      const slot=rhythmNoteMonsterSlot(note),el=slot?sideMonsterRefs.current[slot-1]:null;
      if(el){
        el.dataset.rhythmSideHit='';void el.offsetWidth;el.dataset.rhythmSideHit='1';
        // 出番が済んだので、このあとの待機は最初のぴょんぴょんとは別の動き(ゆらゆら)にする
        el.dataset.rhythmSidePhase='done';
        // 歓声(700ms)が終わったら印を外す。外さないと !important の指定が残り続けて
        // そのマスモンが曲の終わりまで止まったままになる(2026-09-05に出した不具合)
        setTimeout(()=>{if(el.dataset.rhythmSideHit==='1')el.dataset.rhythmSideHit='0';},RHYTHM_SIDE_CHEER_MS);
      }
    }
    // 判定文字を一度だけ弾ませる
    const judgmentText=judgmentTextRef.current;
    if(judgmentText){judgmentText.dataset.rhythmJudgmentPop='';void judgmentText.offsetWidth;judgmentText.dataset.rhythmJudgmentPop='1';}
    // コンボ数も1つ増えるたびに弾ませる(プロセカのように数字が跳ねる)
    const comboText=comboRef.current;
    if(comboText){comboText.dataset.rhythmComboPop='';void comboText.offsetWidth;comboText.dataset.rhythmComboPop='1';}
  }
}
if(settings.vibrationEnabled&&judgment!=='MISS')RHYTHM_HAPTICS.tap();const nextCombo=rhythmComboAfter(run.combo,judgment);run.combo=nextCombo;run.maxCombo=Math.max(run.maxCombo,nextCombo);run.counts[judgment]++;const side=judgment==='MISS'?null:rhythmFastSlow(deltaMs);if(side)run[side.toLowerCase()]++;const songTimeMs=run.audio?.songTimeMs?.()??0;
// ライフ変化は能力(無敵・我慢)を通してから反映する。判定・コンボ・スコアそのものは変えない(§4.2)
// 練習ではライフを減らさない。途中で倒れると、まだ習っていないノーツまで届かなくなる
run.life=tutorial?RHYTHM_LIFE_MAX:rhythmLifeAfterWithMonsterAbilities(run.life,judgment,run.abilities,songTimeMs);
let revived=false,abilityFlash=null;
// 根性ストックを持ったままライフが0になったら、その場で自動的にライフ50へ復活する(§4.4)
const stockRevive=rhythmConsumeKonjoStock(run.abilities,run.life);
if(stockRevive.revived){run.life=stockRevive.life;run.abilities=stockRevive.state;revived=true;abilityFlash={monster:run.konjoOwnerName||'',ability:RHYTHM_MONSTER_ABILITIES.KONJO.name};}
// モンスターノーツはGREAT以上で能力が出る(§3.4)。判定窓は専用に甘くしない
const monster=monsterForNote(note);
if(monster&&monster.ability&&rhythmMonsterAbilityTriggers(judgment)){
  const activated=rhythmActivateMonsterAbility({ability:monster.ability,state:run.abilities,life:run.life,songTimeMs});
  run.abilities=activated.state;run.life=activated.life;
  if(activated.revived)revived=true;
  if(monster.ability.id==='KONJO'&&Number(activated.state?.konjoStock)>0)run.konjoOwnerName=monster.name;
  if(activated.applied){
    abilityFlash={monster:monster.name,ability:monster.ability.name};
    // どのマスモンの能力が効いているかを覚えておく(両サイドの表示で光らせるため)。
    // 判定・スコア・ライフには一切関係しない、見た目だけの控え。
    const slot=rhythmNoteMonsterSlot(note);
    run.abilityOwners=run.abilityOwners||{};
    if(monster.ability.id==='MUTEKI'||monster.ability.id==='GAMAN')run.abilityOwners[monster.ability.id]=slot;
    if(monster.ability.id==='KONJO'&&Number(activated.state?.konjoStock)>0)run.abilityOwners.KONJO=slot;
    // 元気のように一瞬で終わる能力は、少しのあいだだけ光らせる
    run.abilityFlashSlot=slot;
    run.abilityFlashUntilMs=songTimeMs+RHYTHM_SIDE_MONSTER_FLASH_MS;
  }
}
const calculatedScore=rhythmCalculateScore({judgments:run.counts,maxCombo:run.maxCombo,totalNotes:chart.totalNotes,maxScore:difficulty.maxScore});if(!run.lifeDepleted)run.score=calculatedScore-run.scoreOffset;if(!run.lifeDepleted&&run.life===0){run.lifeDepleted=true;run.lockedScore=run.score;}
// DOWN中に根性で蘇生したら、**その蘇生ノーツ自身は加算せず次のノーツから** 加算を再開する。
// DOWN中に止まっていたぶんを遡って足さないよう、そのぶんを差し引く量として持つ(§4.4)
if(revived&&run.lifeDepleted&&run.life>0){run.scoreOffset=rhythmScoreOffsetAfterRevive(calculatedScore,run.lockedScore);run.score=run.lockedScore;run.lifeDepleted=false;}
const score=run.lifeDepleted?run.lockedScore:run.score;setView(v=>({...v,score,combo:run.combo,maxCombo:run.maxCombo,last:judgment,fastSlow:side||'',counts:{...run.counts},fast:run.fast,slow:run.slow,life:run.life,...(abilityFlash?{ability:abilityFlash}:{})}));scheduleJudgmentClear();if(abilityFlash)scheduleAbilityClear();},[chart.totalNotes,difficulty.maxScore,scheduleAbilityClear,scheduleJudgmentClear,settings.vibrationEnabled,tutorial]);
  const finish=useCallback(()=>{const run=runRef.current;if(!run||run.finished||run.paused)return;run.finished=true;stopFrame();RHYTHM_GESTURE_RUNTIME.clear();run.activePointers.clear();run.activeTouchInputs?.clear();run.audio?.stop();const score=run.lifeDepleted?run.lockedScore:run.score;const achievements=rhythmResultAchievements(run.counts,chart.totalNotes);const result={score,judgments:{...run.counts},maxCombo:run.maxCombo,fast:run.fast,slow:run.slow,...achievements};const isNewRecord=score>run.startBestScore;const merged=mergeRhythmBestRecord(run.startBest,result);
    // フルコンボ等を達成していれば、リザルトの数字を出す前に一度「FULL COMBO!」等を
    // 大きく見せる(2026-09-04、ユーザーからの要望)。演出量MINIMAL・軽量モードでは
    // 従来どおりそのままリザルトへ進む(演出だけの分岐で、判定・保存には関わらない)。
    const celebrateTitle=achievements.allMarvelous?'ALL MARVELOUS!!':achievements.allExcellent?'ALL EXCELLENT!!':achievements.fullCombo?'FULL COMBO!':null;
    const showCelebrate=!!celebrateTitle&&!settings.lightweightMode&&settings.effectAmount!=='MINIMAL';
    setView(v=>({...v,status:showCelebrate?'celebrate':'result',score,combo:run.combo,maxCombo:run.maxCombo,counts:{...run.counts},fast:run.fast,slow:run.slow,result:{...result,isNewRecord,bestScore:merged.bestScore}}));
    onComplete(result,merged);
  },[chart.totalNotes,difficulty.maxScore,onComplete,settings.effectAmount,settings.lightweightMode,stopFrame]);
  // celebrate画面: 出た瞬間に合成SEを1回鳴らし、既定の時間で自動的にresultへ進む。
  // 依存はview.statusだけにしてある。もしview.comboなど毎ノーツ変わる値を依存に入れると、
  // (かつてコンボ演出で実際に踏んだ通り)途中でeffectが再実行されるたびcleanupが走り、
  // 「あと少しで消す」という予約タイマーが節目と無関係に解除されてしまう。
  const celebrateTimerRef=useRef(null);
  useEffect(()=>{
    if(view.status!=='celebrate')return;
    RHYTHM_NOTE_SE_RUNTIME.playFullCombo();
    celebrateTimerRef.current=setTimeout(()=>{setView(v=>v.status==='celebrate'?{...v,status:'result'}:v);},1300);
    return ()=>{if(celebrateTimerRef.current){clearTimeout(celebrateTimerRef.current);celebrateTimerRef.current=null;}};
  },[view.status]);
  const skipCelebrate=()=>{if(celebrateTimerRef.current){clearTimeout(celebrateTimerRef.current);celebrateTimerRef.current=null;}setView(v=>v.status==='celebrate'?{...v,status:'result'}:v);};
  const scheduleTick=useCallback(()=>{stopFrame();const tick=(frameNowMs)=>{RHYTHM_PERF.frame(frameNowMs);RHYTHM_GESTURE_RUNTIME.invalidateAreaRect();const run=runRef.current;if(!run||run.finished||run.paused)return;const perfTickStart=RHYTHM_PERF.enabled?performance.now():0;const songTimeMs=run.audio.songTimeMs(),travel=measureTravel(),visualTime=songTimeMs-settings.judgmentTimingOffsetMs,travelMs=rhythmTravelMsForSpeed(settings.noteSpeed);let perfScanned=0,perfDrawn=0;updateJudgmentBand(travel,travelMs);
// このフレームでノーツを正しい場所へ置けるか。置けないなら判定も進めない(下のvisitNoteを参照)
const placeable=!!travel&&travel.ready!==false;
// 練習の説明。曲の時刻で切り替わる。変わったときだけDOMへ書く(毎フレームReactを動かさない)
if(tutorial){const step=rhythmTutorialStepAt(songTimeMs);if(step!==tutorialStepRef.current){tutorialStepRef.current=step;const banner=tutorialBannerRef.current;if(banner){const title=banner.querySelector('[data-rhythm-tutorial-title]'),body=banner.querySelector('[data-rhythm-tutorial-text]');if(title)title.textContent=step.title;if(body)body.textContent=step.text;}}}
const visitNote=note=>{if(note.type==='HOLD'&&note.activePointerId!==null&&songTimeMs>=note.endTimeMs+settings.judgmentTimingOffsetMs)applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);
// 指を離したまま戻ってこなかったHOLD/SLIDE。持ち替えの猶予を過ぎた時点で失敗にする。
// 終わりまで来ていたら、離していても成立させる(終わり際に離すぶんは元から許している)
if(!note.done&&note.activePointerId===null&&note.releasedAtMs!=null){
  const holdEndMs=note.endTimeMs+settings.judgmentTimingOffsetMs;
  if(songTimeMs>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS){note.releasedAtMs=null;rhythmFloatingNoteRemove(note);applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);}
  else if(songTimeMs-note.releasedAtMs>=RHYTHM_HOLD_HANDOVER_GRACE_MS){const releasedAt=note.releasedAtMs;note.releasedAtMs=null;rhythmFloatingNoteRemove(note);applyJudgment(note,'MISS',releasedAt-holdEndMs);}
}
// ノーツを画面へ置けない状態(レイアウトがまだ組み上がっていない)のあいだに
// 過ぎてしまったぶんは、見えていないのだから取りようがない。
// MISSにしてライフとコンボを削るのは理不尽なので、スコアにも数にも入れずに取り除く。
// (2026-09-05・実機の指摘「初回起動時はよくこの状態になる」。
//  以前はここで見えないノーツを次々MISSにしていて、開幕から立て直せなかった)
if(!note.done&&note.activePointerId===null&&!placeable&&songTimeMs-(note.timeMs+settings.judgmentTimingOffsetMs)>RHYTHM_INPUT_MATCH_WINDOW_MS){note.done=true;note._rhythmUnplaceable=true;return;}
if(!note.done&&note.activePointerId===null&&songTimeMs-(note.timeMs+settings.judgmentTimingOffsetMs)>RHYTHM_INPUT_MATCH_WINDOW_MS)applyJudgment(note,'MISS',songTimeMs-note.timeMs);const el=laneRefs.current[note.index];if(!el)return;
// 失敗したHOLD/SLIDEはその場で消さず、譜面上の終端まで薄いグレーで流し続ける。
// 「もう取れない」ことが見えるようにするための表示だけの扱いで、判定・スコアには関与しない。
const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&(note.type==='HOLD'||rhythmNoteIsSlide(note))&&songTimeMs<rhythmReleaseTargetMs(note);
// 終わったノーツは毎フレーム display を書き直さない。曲が進むほど終わったノーツが増え、
// そのぶん無駄な書き込みが積み上がって「遊んでいるうちにカクつく」原因になっていた。
// 一度隠したら覚えておき、値が変わるときだけ書く(見た目・判定は変わらない)。
// 取れた直後の短いあいだだけ、判定ラインに置いたまま光らせてから消す
const clearFlash=note.done&&Number.isFinite(note._rhythmClearAt)&&songTimeMs-note._rhythmClearAt<RHYTHM_CLEAR_FLASH_MS;
if(clearFlash){if(el._rhythmClearFlag!==true){el.dataset.rhythmClear='1';el._rhythmClearFlag=true;}}
else if(el._rhythmClearFlag===true){delete el.dataset.rhythmClear;el._rhythmClearFlag=false;}
if(note.done&&!failedTrail&&!clearFlash){if(el._rhythmHidden!==true){el.style.display='none';el._rhythmHidden=true;}return;}
if(el._rhythmHidden===true){el.style.display='';el._rhythmHidden=false;}
const failedFlag=failedTrail?'true':'false';if(el._rhythmFailedFlag!==failedFlag){el.dataset.rhythmFailed=failedFlag;el._rhythmFailedFlag=failedFlag;}
const progress=1-(note.timeMs-visualTime)/travelMs,visible=failedTrail||note.activePointerId!==null||(progress>=-.1&&progress<=1.18);const nextOpacity=failedTrail?'.34':(visible?'1':'0');if(el._rhythmOpacity!==nextOpacity){el.style.opacity=nextOpacity;el._rhythmOpacity=nextOpacity;}const nextWillChange=visible?'transform, opacity':'';if(el._rhythmWillChange!==nextWillChange){el.style.willChange=nextWillChange;el._rhythmWillChange=nextWillChange;}
if(!visible||!travel)return;
perfDrawn++;let yPx=travel.spawnY+rhythmProjectTravelProgress(progress)*travel.travelPx;if(note.type==='HOLD'&&note.activePointerId!==null)yPx=travel.judgmentY;if(clearFlash)yPx=travel.judgmentY;yPx=Math.round(yPx);/* 縦位置は1px刻みへ丸めてある。丸めた値が前のフレームと同じなら書き直さない。   見た目は1pxも変わらないのに、書けばそのノーツは合成のやり直し対象になる。   ノーツが奥にいるあいだ(遠近の効きで1フレームの移動が1px未満)はここで止まる */const nextTransform=`translate3d(0,${yPx}px,0)`;if(el._rhythmTransform!==nextTransform){el.style.transform=nextTransform;el._rhythmTransform=nextTransform;}const releaseTargetMs=rhythmReleaseTargetMs(note),releaseProgress=1-(releaseTargetMs-visualTime)/travelMs,releaseYpx=Math.round(travel.spawnY+rhythmProjectTravelProgress(releaseProgress)*travel.travelPx),bodyPx=Math.max(0,yPx-releaseYpx);if(note.type==='HOLD'){/* 帯の長さもfilterも「変わったときだけ」書く。とくにfilterを毎フレーム書くと、押していない間もそのノーツが毎フレーム塗り直しになり、画面の広い端末ほど重くなる */const holdBody=`${Math.round(bodyPx)}px`;if(el._rhythmHoldBody!==holdBody){el.style.setProperty('--rhythm-hold-body',holdBody);el._rhythmHoldBody=holdBody;}const holdFilter=note.activePointerId!==null?'brightness(1.3)':'';if(el._rhythmHoldFilter!==holdFilter){el.style.filter=holdFilter;el._rhythmHoldFilter=holdFilter;}}if(note.type==='SLIDE'||note._rhythmOriginalType==='SLIDE'){/* HOLDの帯と同じで、SLIDEの帯の高さも変わったときだけ書く。   毎フレーム書くと、押していないSLIDEまで毎フレーム塗り直しの対象になる */const slideBody=`${Math.round(bodyPx)}px`;if(el._rhythmSlideBody!==slideBody){el.style.setProperty('--rhythm-slide-height',slideBody);el.style.setProperty('--rhythm-slide-visible-height',slideBody);el._rhythmSlideBody=slideBody;}}const activeSlideLane=RHYTHM_GESTURE_RUNTIME.slideVisualLaneForIndex(note.index),visualLane=activeSlideLane===null?note.lane:activeSlideLane;rhythmLayoutNoteVisual(el,note,yPx,visualLane,playAreaRef.current,releaseYpx,{chartNowMs:songTimeMs-settings.judgmentTimingOffsetMs,visualTime,travelMs,spawnY:travel.spawnY,travelPx:travel.travelPx},{rect:travel.rect,noteHeight:travel.noteHeight,bodyHeight:bodyPx});};
const notes=run.notes;
// 末尾の打ち切りは「ノーツが時刻の昇順に並んでいる」ことが前提。譜面エディタなどから
// 並び順が崩れた譜面が来た場合は絞り込まず、従来どおり全ノーツを見る(取りこぼさないため)。
if(run.notesAscending===undefined)run.notesAscending=notes.every((n,i)=>i===0||n.timeMs>=notes[i-1].timeMs);
let scanFrom=run.scanFrom||0;
while(scanFrom<notes.length){
  const head=notes[scanFrom],headEl=laneRefs.current[head.index];
  // 判定が終わっていることが先頭を進める条件。表示の後始末(非表示)が残っているあいだは進めない。
  // 要素そのものが無いノーツは隠す対象が無いので、判定さえ終わっていれば進めてよい
  // (要素が無いと永久に先頭が止まり、絞り込みがまるごと効かなくなっていた)。
  if(!(head.done&&(headEl?headEl._rhythmHidden===true:true)))break;
  scanFrom++;
}
run.scanFrom=scanFrom;
const scanHorizonMs=visualTime+travelMs*1.2;
for(let i=scanFrom;i<notes.length;i++){
  const note=notes[i];
  if(run.notesReady&&run.notesAscending&&note.timeMs>scanHorizonMs)break;
  perfScanned++;
  visitNote(note);
}
run.notesReady=true;
RHYTHM_PERF.notes(perfScanned,perfDrawn,scanFrom,run.notesAscending);
// 無敵・我慢の残り時間と根性ストックは、毎フレームsetStateせずDOMへ直接書く。
// スコアやコンボと同じ頻度でReactを走らせると、そのぶんノーツの描画が遅れるため。
const badge=abilityBadgeRef.current;
// 能力が1つも動いていないあいだは、文字列を組み立てること自体をやめる。
// 曲の大半は何も出ていないので、毎フレームの文字列生成と小数計算をまるごと省ける。
const hasAbilityBadge=badge&&(rhythmMonsterAbilityRemainingMs(run.abilities,'MUTEKI',songTimeMs)>0
  ||rhythmMonsterAbilityRemainingMs(run.abilities,'GAMAN',songTimeMs)>0
  ||Number(run.abilities?.konjoStock)>0);
if(badge&&!hasAbilityBadge){
  if(badge._rhythmBadgeText!==''){badge.textContent='';badge._rhythmBadgeText='';}
  if(!badge.hidden)badge.hidden=true;
}
if(hasAbilityBadge){
  const mutekiMs=rhythmMonsterAbilityRemainingMs(run.abilities,'MUTEKI',songTimeMs),gamanMs=rhythmMonsterAbilityRemainingMs(run.abilities,'GAMAN',songTimeMs);
  const text=[mutekiMs>0?`無敵 ${(mutekiMs/1000).toFixed(1)}s`:'',gamanMs>0?`我慢 ${(gamanMs/1000).toFixed(1)}s`:'',Number(run.abilities?.konjoStock)>0?'根性 ストック':''].filter(Boolean).join(' / ');
  if(badge._rhythmBadgeText!==text){badge.textContent=text;badge._rhythmBadgeText=text;}
  if(badge.hidden!==(text===''))badge.hidden=text==='';
}
// 両サイドのマスモン: 能力が効いている枠だけを光らせる。
// 毎フレーム属性を書くと、そのぶん塗り直しが増える。**変わった瞬間だけ**書く。
if(settings.sideMonsterAbilityHighlight&&sideMonsterRefs.current.length){
  const owners=run.abilityOwners||{};
  const active=new Set();
  if(rhythmMonsterAbilityRemainingMs(run.abilities,'MUTEKI',songTimeMs)>0&&owners.MUTEKI)active.add(owners.MUTEKI);
  if(rhythmMonsterAbilityRemainingMs(run.abilities,'GAMAN',songTimeMs)>0&&owners.GAMAN)active.add(owners.GAMAN);
  if(Number(run.abilities?.konjoStock)>0&&owners.KONJO)active.add(owners.KONJO);
  if(run.abilityFlashSlot&&songTimeMs<Number(run.abilityFlashUntilMs))active.add(run.abilityFlashSlot);
  const signature=[...active].sort().join(',');
  if(run.sideMonsterActiveSignature!==signature){
    run.sideMonsterActiveSignature=signature;
    sideMonsterRefs.current.forEach((el,index)=>{
      if(!el)return;
      const want=active.has(index+1)?'1':'0';
      if(el.dataset.rhythmSideActive!==want)el.dataset.rhythmSideActive=want;
    });
  }
}
const playEndTimeMs=Number.isFinite(Number(song.playDurationMs))?Number(song.playDurationMs):chart.durationMs;
/* 譜面より音源のほうが長い曲(デュラハンの2曲は音源をバトルと共用しているので切れない)は、
   終わりの手前から音量をなめらかに落とす。何もしないと曲の途中でぶつっと止まる。
   音源が譜面とほぼ同時に終わる曲では何もしない(自然な終わりをいじらない)。 */
const audioDurationMs=Number(run.audio.durationMs)||0;
if(!run.fadedOut&&audioDurationMs>playEndTimeMs+RHYTHM_END_FADE_MARGIN_MS
  &&songTimeMs>=playEndTimeMs-RHYTHM_END_FADE_MS){
  run.fadedOut=true;
  run.audio.fadeOut?.(RHYTHM_END_FADE_MS);
}
if(RHYTHM_PERF.enabled)RHYTHM_PERF.tick(performance.now()-perfTickStart,perfTickStart-frameNowMs);if(songTimeMs>=playEndTimeMs||run.audio.ended())finish();else frameRef.current=requestAnimationFrame(tick);};frameRef.current=requestAnimationFrame(tick);},[applyJudgment,chart.durationMs,finish,measureTravel,settings.judgmentTimingOffsetMs,settings.noteSpeed,song.playDurationMs,stopFrame,tutorial,updateJudgmentBand]);
  const disposeRun=useCallback(()=>{stopFrame();clearJudgmentTimer();clearAbilityTimer();clearCountdown();RHYTHM_GESTURE_RUNTIME.clear();rhythmFloatingNotesClear();const run=runRef.current;if(run){run.finished=true;run.paused=true;run.activePointers.clear();run.standbyPointers?.clear();run.activeTouchInputs?.clear();run.inputFeedbackState?.clear();run.audio?.stop();}runRef.current=null;setPressedLanes([]);},[clearAbilityTimer,clearCountdown,clearJudgmentTimer,stopFrame]);
  /* プレイエリアが「遊べる大きさ」になるまで待つ。
     毎フレーム測り直し、整ったらすぐ返す。整わないまま上限に達したら、
     待ち続けて遊べなくなるより始めたほうがましなので諦めて返す。 */
  /* READY→3→2→1 と数えてから返す。
     途中で画面を離れた・作り直された(generationが変わった)ら false を返して、
     呼び出し側が曲を鳴らさずに終われるようにする */
  const runCountdown=generation=>new Promise(resolve=>{
    countdownResolveRef.current=resolve;
    const done=value=>{if(countdownResolveRef.current===resolve)countdownResolveRef.current=null;resolve(value);};
    let index=0;
    const step=()=>{
      if(!mountedRef.current||generation!==generationRef.current){countdownResolveRef.current=null;clearCountdown();done(false);return;}
      if(index>=RHYTHM_COUNTDOWN_STEPS.length){setCountdownStep(null);countdownTimerRef.current=null;done(true);return;}
      setCountdownStep(RHYTHM_COUNTDOWN_STEPS[index]);
      index++;
      countdownTimerRef.current=setTimeout(step,RHYTHM_COUNTDOWN_STEP_MS);
    };
    step();
  });
  const waitUntilPlayable=generation=>new Promise(resolve=>{
    const deadline=(typeof performance!=='undefined'?performance.now():Date.now())+RHYTHM_LAYOUT_WAIT_MAX_MS;
    const step=()=>{
      if(!mountedRef.current||generation!==generationRef.current){resolve(false);return;}
      const area=playAreaRef.current,line=judgmentLineRef.current;
      if(area&&line&&rhythmTravelLooksReady(area.getBoundingClientRect(),line.getBoundingClientRect())){
        // 測り直させる。待っているあいだに覚えた値があれば、それは整う前のもの
        travelCacheRef.current=null;resolve(true);return;
      }
      if((typeof performance!=='undefined'?performance.now():Date.now())>=deadline){travelCacheRef.current=null;resolve(false);return;}
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(step);else setTimeout(step,16);
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(step);else setTimeout(step,16);
  });
  const beginRun=async startBestValue=>{if(startLockRef.current)return;startLockRef.current=true;const generation=++generationRef.current;disposeRun();setView({...initialView(),status:'loading'});const audio=await Audio_.startRhythmTrack(song.bgmTrackId,settings.bgmVolume,{autoStart:false});if(!mountedRef.current||generation!==generationRef.current){audio?.stop();return;}if(!audio){startLockRef.current=false;setView(v=>({...v,status:'error'}));return;}const startBest=normalizeRhythmBestRecord(startBestValue);rhythmFloatingNotesClear();runRef.current={audio,notes:makeRuntimeNotes(),activePointers:new Map(),standbyPointers:new Map(),activeTouchInputs:new Set(),combo:0,maxCombo:0,counts:emptyCounts(),fast:0,slow:0,life:RHYTHM_LIFE_MAX,lifeDepleted:false,score:0,lockedScore:0,scoreOffset:0,abilities:createRhythmMonsterAbilityState(),konjoOwnerName:'',finished:false,paused:false,generation,startBest,startBestScore:startBest.bestScore};laneRefs.current.forEach(el=>{if(el){el.style.display='block';el.style.opacity='0';el.style.filter='';/* styleを直接書き戻したら、「前に何を書いたか」の控えも一緒に捨てる。   控えだけ古いまま残ると、値が同じだと判断して書き込みを飛ばし、   実際の見た目とズレたまま固まる(例: 透明のまま出てこない)ため */el._rhythmHidden=false;el._rhythmOpacity=undefined;el._rhythmWillChange=undefined;el._rhythmFailedFlag=undefined;el._rhythmClearFlag=undefined;delete el.dataset.rhythmClear;el._rhythmHoldBody=undefined;el._rhythmHoldFilter=undefined;el._rhythmDepthScale=undefined;el._rhythmDepthBrightness=undefined;el._rhythmTransform=undefined;el._rhythmSlideBody=undefined;}});rhythmLayoutPlayArea(playAreaRef.current);updateJudgmentBand(measureTravel(),rhythmTravelMsForSpeed(settings.noteSpeed));
/* 使い回すヒットエフェクトを先に作っておく。曲の途中で10個まとめて作ると、そこで一瞬引っかかる */
rhythmEnsureHitEffects(playAreaRef.current);
/* 両サイドのマスモンが跳ねる速さを曲の1拍へ合わせる。   プレイ開始時に一度書くだけで、あとはCSSアニメーションが回すので毎フレームのJSは走らない */
const sideBeatMs=rhythmSideMonsterBeatMs(song.bgmTrackId);
sideMonsterRefs.current.forEach(el=>{if(el){el.style.setProperty('--rhythm-side-beat',`${sideBeatMs}ms`);el.dataset.rhythmSideActive='0';el.dataset.rhythmSideHit='0';el.dataset.rhythmSidePhase='intro';}});
/* 判定ラインも同じ1拍で脈打たせる。ここで一度書くだけで、あとはCSSが回す。
   変わるのは厚み(scaleY)と濃さ(opacity)だけなので、判定の位置は動かない */
if(judgmentLineRef.current)judgmentLineRef.current.style.setProperty('--rhythm-beat',`${sideBeatMs}ms`);
startLockRef.current=false;setView({...initialView(),status:'playing'});
/* ここまでで画面の中身はそろっているが、実際に置かれる大きさが決まるのは次の描画のあと。
   絵の読み込み・レイアウトの反映が終わる前に曲を鳴らし始めると、ノーツを正しい場所へ
   置けないまま曲だけ進み、MISSが積み上がる(2026-09-05・実機の指摘)。
   遊べる形になるまで待ってから鳴らす。待てない端末のために上限も置く */
await waitUntilPlayable(generation);
if(!mountedRef.current||generation!==generationRef.current){audio.stop();return;}
/* 画面がそろってから READY→3→2→1 と数え、そのあとで曲を鳴らす。
   選んだ瞬間に曲が始まると構える間が無い(2026-09-05・ユーザー指摘)。
   ここで数えているあいだにレイアウトも完全に固まる */
if(!await runCountdown(generation)){audio.stop();return;}
if(!mountedRef.current||generation!==generationRef.current){audio.stop();return;}
audio.start();
scheduleTick();};
  useEffect(()=>{mountedRef.current=true;beginRun(bestRecord);return()=>{mountedRef.current=false;++generationRef.current;startLockRef.current=false;disposeRun();};},[]);
  const pause=()=>{const run=runRef.current;
    /* カウントダウン中は止められない。まだ曲が鳴っていないので、止めても再開できない。
       ボタンに disabled を付けるのではなくここで弾くのは、HUDの見た目を測る検査
       (rhythm-hud-wedge-check など)がHUDのJSXをそのまま写して使うため、
       式や disabled: 変種を持ち込むと測れなくなるから */
    if(countdownStep!==null)return;
    if(!run||run.finished||run.paused)return;run.activePointers.clear();run.standbyPointers?.clear();run.activeTouchInputs?.clear();run.inputFeedbackState?.clear();run.activePointerFeedback?.clear();setPressedLanes([]);run.notes.forEach(note=>{if(note.type==='HOLD'&&note.activePointerId!==null)note.activePointerId=-1;});run.paused=true;stopFrame();run.audio.pause();setView(v=>({...v,status:'paused'}));};
  const resume=async()=>{const run=runRef.current;if(!run||run.finished||!run.paused)return;const resumed=await run.audio.resume();if(!resumed)return;run.paused=false;setView(v=>({...v,status:'playing'}));scheduleTick();};
  const restart=()=>{const startBest=runRef.current?.startBest;if(startBest)beginRun(startBest);};
  const abort=()=>{++generationRef.current;startLockRef.current=false;disposeRun();onExit();};
  const inputStarts=inputs=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();run.inputFeedbackState=run.inputFeedbackState||new Map();rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs).forEach(({input,target,deltaMs,standby})=>{run.inputFeedbackState.set(input.inputKey,{subLane:Math.max(0,Math.min(9,Math.floor(input.subLaneCoordinate))),empty:!target||target.type==='TAP'});
      // いま押さえている帯へ、持ち替えのために置いた2本目の指。
      // まだ何も取らないが、1本目が離れたらこの指へそのまま渡す(inputEndsを参照)。
      // 空打ちの音は鳴らさない(押し損ねたわけではないので)
      if(!target&&standby){
        run.standbyPointers.set(input.inputKey,standby.index);
        if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}
        return;
      }
      if(!target){RHYTHM_NOTE_SE_RUNTIME.playEmpty();if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}return;}const judgment=rhythmJudgeTap(deltaMs);if(target.type==='HOLD'){
      // 持ち替えの途中(離したばかりで浮いている)なら、続きとして引き継ぐ。
      // 始点の判定は最初に押さえたときのものを保つ(持ち替えで良くも悪くもならない)
      const handover=target.releasedAtMs!=null;
      target.activePointerId=input.inputKey;
      if(handover){target.releasedAtMs=null;rhythmFloatingNoteRemove(target);}
      else{target.holdJudgment=judgment;target.holdDeltaMs=deltaMs;}
      run.activePointers.set(input.inputKey,target.index);if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}const side=rhythmFastSlow(deltaMs);setView(v=>({...v,last:'HOLD',fastSlow:side||''}));scheduleJudgmentClear();return;}applyJudgment(target,judgment,deltaMs);});};
  const inputMoves=(inputKey,subLaneCoordinate)=>{const run=runRef.current,state=run?.inputFeedbackState?.get(inputKey);if(!state||!Number.isFinite(subLaneCoordinate))return;const subLane=Math.max(0,Math.min(9,Math.floor(subLaneCoordinate)));if(subLane===state.subLane)return;state.subLane=subLane;if(state.empty)inputStarts([{lane:Math.floor(subLane/2),subLaneCoordinate,inputKey}]);};
  // 押さえている帯へ先に置いてあった「控えの指」を探す。
  // 親指で遊ぶ人は「2本目を置いてから1本目を離す」ので、離した瞬間に渡せないと必ずMISSになる
  const standbyFingerFor=(run,noteIndex,exceptKey)=>{
    for(const [key,index] of run.standbyPointers){
      if(index!==noteIndex||key===exceptKey)continue;
      return key;
    }
    return null;
  };
  const inputEnds=inputs=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();inputs.forEach(input=>{run.inputFeedbackState?.delete(input.inputKey);run.standbyPointers.delete(input.inputKey);const noteIndex=run.activePointers.get(input.inputKey);if(noteIndex===undefined)return;run.activePointers.delete(input.inputKey);const note=run.notes[noteIndex];if(!note||note.done)return;note.activePointerId=null;const holdEndMs=note.endTimeMs+settings.judgmentTimingOffsetMs;
    // 先に置いてある指があれば、離したその場でそこへ渡す。
    // 浮いている状態を経由しないので、猶予の時間切れに巻き込まれない
    const takeover=standbyFingerFor(run,noteIndex,input.inputKey);
    if(takeover&&!note.done&&now<holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS){
      note.activePointerId=takeover;
      note.releasedAtMs=null;rhythmFloatingNoteRemove(note);
      run.activePointers.set(takeover,noteIndex);
      run.standbyPointers.delete(takeover);
      // 経路の追従を続けるため、元の種類で結び直す(SLIDEがただのHOLDへ化けない)
      RHYTHM_GESTURE_RUNTIME.bind(takeover,note,note._rhythmOriginalType||note.type,now,settings.judgmentTimingOffsetMs);
      if(input.releaseTarget&&input.pointerId!==undefined){try{if(input.releaseTarget.hasPointerCapture?.(input.pointerId))input.releaseTarget.releasePointerCapture(input.pointerId);}catch{}}
      return;
    }
    // 終わり際まで来ていれば、そのまま成立させる
    if(now>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS){applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);}
    // まだ途中なら、すぐには失敗にしない。指を入れ替えている途中かもしれないので、
    // 猶予のあいだは「浮いている」ことだけ覚えておく(rAFのvisitNoteが時間切れを見る)
    else{note.releasedAtMs=now;rhythmFloatingNoteAdd(note);}if(input.releaseTarget&&input.pointerId!==undefined){try{if(input.releaseTarget.hasPointerCapture?.(input.pointerId))input.releaseTarget.releasePointerCapture(input.pointerId);}catch{}}});};
  // 入力のたびに getBoundingClientRect() を呼ぶと、そのフレームで書き込み待ちだった
  // ノーツの位置をすべて確定させられる(強制レイアウト)。指の数ぶん・touchmoveの数ぶん
  // これが起きるため、タップのたびに一瞬止まって見える原因になる。FLICK/SLIDE側と
  // 同じ「1フレームに1回だけ測る」キャッシュを共有する(フレームごと・画面サイズ変化ごとに捨てる)。
  const inputAreaRect=area=>RHYTHM_GESTURE_RUNTIME.areaRect(area)||area.getBoundingClientRect();
  // 指を置くたびに10要素を querySelectorAll で引き直し、押していないサブレーンまで
  // 毎回書き込んでいた。要素は覚えておき、状態が変わったサブレーンだけ書き換える
  // (dataset/styleへの書き込みはそのたびにstyle再計算を誘発するため)。
  const setPressedLanes=coordinates=>{const area=playAreaRef.current;if(!area)return;const active=new Set(Array.from(coordinates||[]).map(value=>Math.max(0,Math.min(9,Math.floor(Number(value))))).filter(Number.isFinite)),glowOpacity=settings.laneGlow==='NONE'?'0':settings.laneGlow==='LOW'?'.35':'1';let nodes=glowNodesRef.current;if(!nodes||!nodes.length||!nodes[0].isConnected)nodes=glowNodesRef.current=Array.from(area.querySelectorAll('[data-rhythm-sublane-feedback]'));nodes.forEach((el,index)=>{const pressed=active.has(index);const want=pressed?'true':'false';if(el.dataset.pressed===want&&(!pressed||el.style.opacity===glowOpacity))return;el.dataset.pressed=want;el.style.opacity=pressed?glowOpacity:'0';});};
  const pointerDown=e=>{if(e.pointerType==='touch')return;e.preventDefault();const area=playAreaRef.current;if(!area)return;const rect=inputAreaRect(area),lane=rhythmLaneAtPoint(e.clientX,e.clientY,rect),subLaneCoordinate=rhythmSubLaneCoordinateAtPoint(e.clientX,e.clientY,rect);if(lane===null||subLaneCoordinate===null)return;const run=runRef.current;if(run){run.activePointerFeedback=run.activePointerFeedback||new Map();run.activePointerFeedback.set(e.pointerId,subLaneCoordinate);setPressedLanes(run.activePointerFeedback.values());}inputStarts([{lane,subLaneCoordinate,inputKey:rhythmInputKey('pointer',e.pointerId),captureTarget:e.currentTarget,pointerId:e.pointerId}]);};
  const pointerMove=e=>{if(e.pointerType==='touch')return;const run=runRef.current;if(!run?.activePointerFeedback?.has(e.pointerId))return;e.preventDefault();const area=playAreaRef.current;if(!area)return;const subLaneCoordinate=rhythmSubLaneCoordinateAtPoint(e.clientX,e.clientY,inputAreaRect(area));if(subLaneCoordinate===null)return;run.activePointerFeedback.set(e.pointerId,subLaneCoordinate);setPressedLanes(run.activePointerFeedback.values());inputMoves(rhythmInputKey('pointer',e.pointerId),subLaneCoordinate);};
  const pointerEnd=e=>{if(e.pointerType==='touch')return;const run=runRef.current;if(run?.activePointerFeedback){run.activePointerFeedback.delete(e.pointerId);setPressedLanes(run.activePointerFeedback.values());}else setPressedLanes([]);inputEnds([{inputKey:rhythmInputKey('pointer',e.pointerId),releaseTarget:e.currentTarget,pointerId:e.pointerId}]);};
  useEffect(()=>{const area=playAreaRef.current;if(!area||view.status==='result'||view.status==='celebrate')return;const syncTouches=e=>{if(e.cancelable)e.preventDefault();const current=runRef.current;if(!current||current.finished||current.paused)return;current.activeTouchInputs=current.activeTouchInputs||new Set();const rect=inputAreaRect(area),live=new Set(),liveSubLanes=[],starts=[];Array.from(e.touches||[]).forEach(touch=>{const inputKey=rhythmInputKey('touch',touch.identifier);live.add(inputKey);const lane=rhythmLaneAtPoint(touch.clientX,touch.clientY,rect),subLaneCoordinate=rhythmSubLaneCoordinateAtPoint(touch.clientX,touch.clientY,rect);if(subLaneCoordinate!==null)liveSubLanes.push(subLaneCoordinate);if(current.activeTouchInputs.has(inputKey)){if(subLaneCoordinate!==null)inputMoves(inputKey,subLaneCoordinate);return;}current.activeTouchInputs.add(inputKey);if(lane!==null&&subLaneCoordinate!==null)starts.push({lane,subLaneCoordinate,inputKey});});setPressedLanes(liveSubLanes);if(starts.length)inputStarts(starts);const ended=[];Array.from(current.activeTouchInputs).forEach(inputKey=>{if(!live.has(inputKey)){current.activeTouchInputs.delete(inputKey);ended.push({inputKey});}});if(ended.length)inputEnds(ended);};RHYTHM_GESTURE_RUNTIME.invalidateAreaRect();area.addEventListener('touchstart',syncTouches,{passive:false});area.addEventListener('touchmove',syncTouches,{passive:false});area.addEventListener('touchend',syncTouches,{passive:false});area.addEventListener('touchcancel',syncTouches,{passive:false});return()=>{area.removeEventListener('touchstart',syncTouches);area.removeEventListener('touchmove',syncTouches);area.removeEventListener('touchend',syncTouches);area.removeEventListener('touchcancel',syncTouches);setPressedLanes([]);};},[view.status]);
  if(view.status==='celebrate'){const celebrateResult=view.result,celebrateTitle=celebrateResult?.allMarvelous?'ALL MARVELOUS!!':celebrateResult?.allExcellent?'ALL EXCELLENT!!':'FULL COMBO!';return <main data-rhythm-celebrate className="flex flex-1 items-center justify-center bg-slate-950 text-white" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}} onClick={skipCelebrate}><div className="px-6 text-center"><b data-rhythm-celebrate-slam className="block text-6xl font-black leading-tight">{celebrateTitle}</b><small className="mt-3 block text-sm font-black tracking-[0.3em] text-slate-300">MAX COMBO {view.maxCombo}</small></div></main>;}
  if(view.status==='result'){const result=view.result,rank=rhythmRankForScore(view.score);return <main data-rhythm-result className="flex-1 overflow-y-auto bg-slate-950 p-4 text-white" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}><p className="text-center text-xs text-cyan-300">{rhythmSongFullName(song)}・{difficulty.id}</p><h2 className="text-center font-black">RHYTHM RESULT</h2><div data-rhythm-result-rank className={`mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-full border-4 border-current text-4xl font-black ${RHYTHM_RANK_COLORS[rank]}`}>{rank}</div><div className="my-3 text-center text-3xl font-black">{view.score.toLocaleString()}</div><p className="text-center text-sm">BEST SCORE {result.bestScore.toLocaleString()}</p>{result.isNewRecord&&<p data-rhythm-new-record className="text-center text-xl font-black text-amber-300">NEW RECORD</p>}{/* 達成をひと目で分かるように、いちばん上の称号だけを大きく出す(2026-09-03)。
    ALL MARVELOUS > ALL EXCELLENT > FULL COMBO の順に上位。残りは下に小さく並べる。 */}
{(result.fullCombo||result.allExcellent||result.allMarvelous)&&<div data-rhythm-result-celebrate className="my-3 text-center">
  <b className="block text-3xl font-black leading-tight">{result.allMarvelous?'ALL MARVELOUS!!':result.allExcellent?'ALL EXCELLENT!!':'FULL COMBO!'}</b>
  <small className="mt-1 block text-[10px] font-black text-amber-200">{result.allMarvelous?'すべてMARVELOUS。文句なしの完璧です':result.allExcellent?'すべてEXCELLENT以上。ほぼ完璧です':'一度もコンボを切らずに完走しました'}</small>
</div>}
<div className="my-3 flex flex-wrap justify-center gap-2 text-xs font-black text-slate-300">{result.fullCombo&&<span>FULL COMBO</span>}{result.allExcellent&&<span>ALL EXCELLENT</span>}{result.allMarvelous&&<span>ALL MARVELOUS</span>}</div><dl className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-900 p-4">{RHYTHM_JUDGMENT_IDS.map(id=><React.Fragment key={id}><dt>{id}</dt><dd className="text-right font-mono">{view.counts[id]}</dd></React.Fragment>)}<dt>MAX COMBO</dt><dd className="text-right">{view.maxCombo}</dd><dt>FAST</dt><dd className="text-right">{view.fast}</dd><dt>SLOW</dt><dd className="text-right">{view.slow}</dd></dl><div className="mt-5 grid grid-cols-1 gap-2"><button className="min-h-[48px] rounded-xl bg-fuchsia-700 font-black" disabled={startLockRef.current} onClick={()=>beginRun(mergeRhythmBestRecord(runRef.current?.startBest,result))}>もう一度プレイ</button><button className="min-h-[48px] rounded-xl bg-indigo-700 font-black" onClick={abort}>{debugPlay?'音ゲーデバッグへ戻る':'曲えらびへ戻る'}</button></div></main>}
  return <main data-rhythm-tap-test className="relative flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-950 text-white landscape:pl-[env(safe-area-inset-left)] landscape:pr-[env(safe-area-inset-right)]" style={{touchAction:'none'}}><header data-rhythm-hud className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-1.5"><div data-rhythm-hud-left className="min-w-0 max-w-[35vw] text-left landscape:max-w-[28vw]"><div className="landscape:flex landscape:items-center landscape:gap-2"><div className="flex items-center gap-1.5"><div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current bg-slate-950/85 landscape:h-7 landscape:w-7 ${RHYTHM_RANK_COLORS[rhythmRankForScore(view.score)]}`} style={{boxShadow:'0 0 8px rgba(103,232,249,.35)'}}><b data-rhythm-rank className="text-sm font-black leading-none" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>{rhythmRankForScore(view.score)}</b></div><div className="min-w-0 landscape:min-w-0"><div className="flex items-center gap-0.5 landscape:hidden"><div data-rhythm-rank-gauge className="relative h-1.5 w-14 overflow-hidden rounded-full border border-white/25 bg-slate-950/80"><i aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300" style={{width:`${rhythmRankProgress(view.score)}%`}}/></div><b data-rhythm-rank-next className="shrink-0 text-[9px] font-black leading-none text-slate-300">{rankNextLabel}</b></div><b data-rhythm-score className="mt-0.5 block font-black leading-none tabular-nums landscape:mt-0" style={{fontSize:'min(18px,4.6vw)',textShadow:'0 1px 6px rgba(2,6,23,.96)'}}>{view.score.toLocaleString()}</b><small className="mt-0.5 block text-[9px] font-bold leading-none text-slate-300 landscape:hidden" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>BEST {Number(bestRecord?.bestScore||0).toLocaleString()}</small></div></div><div className="mt-1.5 flex max-w-[34vw] flex-wrap items-center gap-1 landscape:mt-0 landscape:min-w-0 landscape:shrink"><span className="shrink-0 rounded bg-fuchsia-700/85 px-1.5 py-0.5 text-[9px] font-black leading-none">{difficulty.id}</span><small data-rhythm-mode-label className="text-[9px] font-bold leading-none tracking-[0.14em] text-cyan-300 landscape:hidden" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>{tutorial?'れんしゅう':debugPlay?debugChartLabel:`Lv.${chart.level}`}</small></div></div><div data-rhythm-hud-song className="mt-1 max-w-[31vw] text-[10px] font-black text-slate-100 landscape:mt-0.5 landscape:max-w-none landscape:min-w-0" style={{display:'-webkit-box',WebkitLineClamp:isLandscape?'1':'3',WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:'1.25',textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>♪ {rhythmSongFullName(song)}</div></div><div data-rhythm-hud-right className="flex w-[33vw] max-w-[33vw] flex-col items-end gap-1.5"><div className="landscape:flex landscape:items-center landscape:gap-2"><div className="flex items-center justify-end gap-1"><span aria-hidden="true" className="text-sm leading-none text-rose-400" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>♥</span><div className="relative h-1.5 w-12 overflow-hidden rounded-full border border-white/25 bg-slate-950/80 landscape:w-14"><i data-rhythm-life-bar aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full" style={{width:`${(rhythmLifeRatio(view.life)*100).toFixed(1)}%`,background:rhythmLifeRatio(view.life)>.5?'linear-gradient(90deg,#34d399,#22d3ee)':rhythmLifeRatio(view.life)>.25?'linear-gradient(90deg,#fbbf24,#fb923c)':'linear-gradient(90deg,#fb7185,#ef4444)',transition:settings.lightweightMode?'none':'width 140ms linear'}}/></div><b data-rhythm-life-value className="text-[9px] font-black leading-none tabular-nums text-slate-200" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>{view.life}</b></div><button data-rhythm-pause aria-label="ポーズ" className="pointer-events-auto mt-1 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-slate-900/90 text-2xl font-black text-white shadow-[0_0_12px_rgba(103,232,249,0.18)] landscape:mt-0" onClick={pause}>Ⅱ</button></div><b ref={abilityBadgeRef} data-rhythm-ability-badge hidden className="mt-1 block text-right text-[9px] font-black leading-none tracking-[0.06em] text-amber-200 landscape:inline-block landscape:mt-0.5" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}/><div className="mt-1 text-right landscape:flex landscape:items-baseline landscape:gap-1.5 landscape:mt-0.5"><span className="block text-[9px] font-black leading-none tracking-[0.18em] text-fuchsia-300" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>COMBO</span><b ref={comboRef} data-rhythm-combo data-combo-tier={view.combo>=300?'3':view.combo>=200?'2':view.combo>=100?'1':'0'} className="mt-0.5 block text-3xl font-black leading-none tabular-nums text-white landscape:mt-0 landscape:text-base">{view.combo}</b></div></div></header><div ref={playAreaRef} data-rhythm-play-area data-rhythm-lightweight={settings.lightweightMode?'true':'false'} data-rhythm-effect={settings.effectAmount} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className="relative mx-2 mb-2 flex-1 min-h-0 overflow-hidden border-x border-cyan-400/50" style={{/* position と overflow はここにも直接書く。ノーツも判定ラインもこの箱を基準に
    置いているので、Tailwindの relative が効く前だと基準が別の要素へ移り、
    判定ラインが画面の変なところへ出る(2026-09-05)。中身の置き場所に関わるものは
    外部CSSに任せない */position:'relative',overflow:'hidden',touchAction:'none',WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none','--rhythm-note-size-scale':settings.noteSize/100,filter:settings.effectAmount==='MINIMAL'?'saturate(.78)':settings.effectAmount==='LOW'?'saturate(.92)':'none'}}>{laneElements}{sideMonsterElements}<div ref={screenFlashRef} data-rhythm-screen-flash aria-hidden="true"/>{/* 判定ラインはTailwindのクラスを使わず、位置・高さ・色をすべてここへ直接書く。
    Tailwindは外部CDNのJITが後からCSSを作るため、間に合わないあいだ
    bottom-[12%] も h-[3px] も bg-gradient-to-r も効かず、
    「高さ0・背景なし＝見えない線」になる。実機で「演奏を始めたときに
    下部の判定ラインがないときがある」と報告された(2026-09-05)。
    判定ラインは音ゲーでいちばん大事な目印なので、外部CSSに依存させない */}
{/* 判定ラインの「幅」。上下のふちがGOOD(前後0.2秒)の端、内側の明るいところがMARVELOUS(前後0.055秒)で、
    その真ん中に下の判定ラインがちょうど乗る。位置と高さはノーツ速度と画面の高さで変わるので、
    実測から updateJudgmentBand が書き込む。見た目だけの要素で、判定・スコアには関与しない。
    判定ラインと同じ理由でTailwindに頼らず直接書く(CDNのCSSが間に合わなくても必ず出す) */}
<div ref={judgmentBandRef} data-rhythm-judgment-band aria-hidden="true" style={{position:'absolute',left:0,right:0,top:0,height:0,opacity:0,pointerEvents:'none',
  /* z-index を必ず持たせる(2026-09-06)。DOMの順番では判定ラインの直前に置いてあるのに、
     レーンのSVG([data-rhythm-lane-svg])が z-index:1 を持っているため、
     z-index:auto(=0)のままだと**レーンの下に隠れて色がまったく出なかった**。
     実測でも、帯をまっ赤に塗りつぶしても画面の色は rgb(14,20,36) のまま変わらなかった。
     レーン(1)より上、ノーツ(4)・判定ライン(6)より下に置く。 */
  zIndex:2,transition:settings.lightweightMode?'none':'opacity 220ms ease-out'}}>
  <i data-rhythm-judgment-core aria-hidden="true" style={{position:'absolute',left:0,right:0,top:0,height:0,background:'linear-gradient(180deg,rgba(250,232,255,0),rgba(250,232,255,.26),rgba(250,232,255,0))'}}/>
  <i data-rhythm-judgment-edge data-edge="top" aria-hidden="true" style={{position:'absolute',left:0,right:0,top:0,height:'1px',background:'linear-gradient(90deg,rgba(103,232,249,0),rgba(103,232,249,.55),rgba(103,232,249,0))'}}/>
  <i data-rhythm-judgment-edge data-edge="bottom" aria-hidden="true" style={{position:'absolute',left:0,right:0,bottom:0,height:'1px',background:'linear-gradient(90deg,rgba(103,232,249,0),rgba(103,232,249,.55),rgba(103,232,249,0))'}}/>
</div>
<div ref={judgmentLineRef} data-rhythm-judgment-line style={{position:'absolute',left:0,right:0,bottom:'12%',height:'3px',background:'linear-gradient(90deg,#f0abfc,#cffafe,#f0abfc)',boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 0 8px #67e8f9':'0 0 18px #67e8f9,0 0 30px #c084fc'}}/>{/* 演奏を始める前のカウントダウン。Tailwindに頼らず直接書くのは判定ラインと同じ理由で、
    CDNのCSSが間に合わなくても必ず読める大きさで出るようにするため */}
{countdownStep!==null&&<div data-rhythm-countdown aria-live="assertive" style={{position:'absolute',inset:0,zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',pointerEvents:'none',background:'rgba(2,6,23,.35)'}}><b data-rhythm-countdown-step style={{fontSize:countdownStep==='READY'?'44px':'88px',fontWeight:900,lineHeight:1,color:'#fff',letterSpacing:countdownStep==='READY'?'.12em':'0',textShadow:'0 0 18px rgba(103,232,249,.85),0 2px 10px rgba(2,6,23,.95)'}}>{countdownStep}</b><small style={{fontSize:'12px',fontWeight:900,color:'#a5f3fc',textShadow:'0 1px 6px rgba(2,6,23,.95)'}}>まもなく はじまります</small></div>}
<div data-rhythm-judgment-display className="pointer-events-none absolute left-1/2 z-10 w-[88%] -translate-x-1/2 text-center" style={{bottom:'calc(12% + 38px)'}}><b ref={judgmentTextRef} data-rhythm-judgment-text className={`block text-[26px] font-black leading-none tracking-wide ${view.last==='MARVELOUS'?'text-fuchsia-100':view.last==='EXCELLENT'?'text-cyan-100':view.last==='GREAT'?'text-amber-200':view.last==='GOOD'?'text-lime-300':view.last==='BAD'?'text-rose-300':'text-white'}`} style={{textShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 0 7px rgba(255,255,255,.45)':'0 0 10px rgba(255,255,255,.75),0 0 22px rgba(217,70,239,.35)'}}>{view.status==='error'?'音源を再生できません':view.status==='loading'?'LOADING…':settings.judgmentTextDisplay?view.last:''}</b><small className={`mt-1 block min-h-[16px] text-xs font-black tracking-[0.24em] ${!settings.fastSlowDisplay?'text-transparent':view.fastSlow==='FAST'?'text-cyan-300':view.fastSlow==='SLOW'?'text-fuchsia-300':'text-transparent'}`}>{settings.fastSlowDisplay?(view.fastSlow||'—'):'—'}</small></div>{/* 能力が出たら、どのマスモンの何が出たかを短時間だけ見せる(§3.5) */}
{comboMilestone>0&&<div data-rhythm-combo-milestone data-milestone-stage={comboMilestoneStage} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 whitespace-nowrap text-center"><b className={`block font-black leading-none tabular-nums landscape:text-4xl ${comboMilestoneStage>=3?'text-6xl':'text-5xl'}`}>{comboMilestone}</b><small className="mt-1 block text-sm font-black tracking-[0.3em]">COMBO</small></div>}
                {view.ability&&<div data-rhythm-ability-flash className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-amber-200 bg-slate-950/90 px-4 py-1.5 text-lg font-black text-amber-100" style={{bottom:'calc(12% + 78px)',textShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':'0 0 10px rgba(251,191,36,.8)'}}>{view.ability.ability}！</div>}{noteElements}{tutorial&&<div ref={tutorialBannerRef} data-rhythm-tutorial-banner className="pointer-events-none absolute inset-x-3 top-[14%] z-20 rounded-2xl border border-cyan-300/50 bg-slate-950/92 px-3 py-2.5 text-center shadow-[0_0_18px_rgba(34,211,238,.18)]"><b data-rhythm-tutorial-title className="block text-[14px] font-black text-cyan-100">{RHYTHM_TUTORIAL_STEPS[0].title}</b><span data-rhythm-tutorial-text className="mt-1 block text-[11px] font-bold leading-relaxed text-slate-200">{RHYTHM_TUTORIAL_STEPS[0].text}</span></div>}{view.status==='paused'&&<div data-rhythm-pause-menu data-rhythm-debug-play={debugPlay?'1':undefined} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-5"><h3 className="text-2xl font-black">PAUSE</h3><button data-rhythm-pause-resume className="min-h-[48px] w-full rounded-xl bg-cyan-700 font-black" onClick={resume}>再開</button><button data-rhythm-pause-restart className="min-h-[48px] w-full rounded-xl bg-fuchsia-700 font-black" onClick={restart}>リスタート</button><button data-rhythm-pause-exit className="min-h-[48px] w-full rounded-xl bg-rose-800 font-black" onClick={abort}>{tutorial?'練習をやめて曲えらびへ戻る':debugPlay?'中断して音ゲーデバッグへ戻る':'中断して曲えらびへ戻る'}</button></div>}</div></main>;
};
