
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
const BUILD_DATE = "2026-09-10 12:15"; // 更新のたびに手動で書き換える(日付+時刻、JST) ※version.jsonのbuildも同じ値に合わせること

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
const RHYTHM_PLAY_RUN_LOOP_MIN = 2;
// ※「演奏で ◯周ぶん入りました」を曲えらびの帯へ出していたころは、時間で消すための
//   RHYTHM_PLAY_RUN_AWARD_SHOW_MS を置いていた。いまは曲リザルトで出すので不要
//   (2026-09-07・ユーザー提案「曲リザルトの画面で出すほうがいい。
//    そうしたら帯にわざわざ何周分追加とか表示する必要もない」)。
const rhythmPlayRunLoops = (durationMs) => {
  const ms = Number(durationMs);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(RHYTHM_PLAY_RUN_LOOP_MIN, Math.floor(ms / 60000));
};
// 演奏を「周回クリア扱い」にしてよいか。
// ★過去にその難易度をクイックで1回でもクリアしていること(2026-09-07・ユーザー指示)。
//   これが無いと、勝てないほど高い難易度でも演奏さえすればクリア扱いになってしまう。
//   判定には既存の mh_quick_clears_<難易度> をそのまま読む(新しい保存キーは作らない)。
const rhythmPlayRunLoopsAllowed = (difficulty, quickClears) =>
  (Number(quickClears?.[difficulty]) || 0) > 0;

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
