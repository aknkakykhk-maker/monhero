// ===== イベント・レイドボス「ジャック」の定義(純粋な計算とデータ) =====
// 設計の正本: docs/spec/RAID_BOSS_JACK.md
//
// 決めごと:
//  ・A(ベースモン協力戦)は難易度ごとに別の共有HP(全員で削る)。前の段階を倒すと次が開く。
//  ・B(マスモン)は共有HPを削らず、期間中の累計ダメージで競う。5段階で、ランキングは共有。
//  ・ライフ = ムーの基礎35,000 × 段階の倍率(power) × 10。
//  ・技は「再生」なし。段階3(A)/段階3(B)で全5本。低い段階ほど減らす(3/4/5/5/5)。
//  ・既存の保存キー(mh_*)・ランキングには触らない。保存は新しいキー mh_raid_jack_v1 だけ。
//  ・開催中かどうかは、モジュール定数にせず、見るたびに raidJackWindowAt(Date.now()) で数え直す。
//  ・公開フラグ RELEASE_FLAGS.raidJack が偽のあいだは、入口もヘルプ・更新履歴も出さない。

// 期間。開始は公開日時(2026-10-05 4:00・ユーザー指示)。RELEASE_FLAGS.raidJack もこの時刻まで偽を返す。終わりは週の区切り(月曜5:00)ではなく、
// ハロウィン・ナイトの終了(11/1 4:00)に合わせる。
const RAID_JACK_EVENT = Object.freeze({
  id: 'raid_jack_2026',
  name: 'カボチャの大王ジャック',
  startAt: '2026-10-05T04:00:00+09:00',   // 17-release-changelog-login-missions.jsx の RAID_JACK_START_AT と同じ値(更新履歴の公開判定が先に読むため、そちらにも置いてある。食い違いは raid-jack-check.js が見る)
  endAt: '2026-11-01T04:00:00+09:00',
});

const RAID_JACK_BASE = Object.freeze({ hp: 35000, atk: 700 });
const RAID_JACK_LIFE_MULTIPLIER = 10;
const RAID_JACK_TURNS = 20;   // 1回の戦闘のターン数(2026-10-04・ユーザー指示でレイドバトルもグランドスラムも20ターン)
const RAID_JACK_FREE_PER_DAY = 3;
// レイドバトル(A)の専用ルール。数字はここだけに置き、戦闘(60-app.jsx)・画面・ヘルプ・検査はここを読む
//   EXスキルは、EXを持つ味方ごとに2回まで(2026-10-04・ユーザー指示で1回から変更)。グランドスラム(B)と通常戦は今までどおり
const RAID_JACK_A_EX_MAX_USES = 2;
//   アシカは、レイドバトルもグランドスラムも3枚まで(2026-10-04・ユーザー指示)
const RAID_JACK_TEACHING_MAX = 3;
//   編成: 勇者モン1体 + 供モン最大3体
const RAID_JACK_ALLY_MAX = 3;
const RAID_JACK_EXTRA_COST_BEAT_P = 100;
const RAID_JACK_STORAGE_KEY = 'mh_raid_jack_v1';
// ぱんぷきん×ジャックのストーリー(台本は docs/spec/RAID_JACK_STORY.md、データは data/assistants.js の EVENT_REPLAYS)。
// 第1.5部=レイド開始 / 第2〜6部=段階(男爵〜大王)を倒したあと / 終章=期間終了後(大王まで倒せたかで2本)。
// 見たかどうかは、既存のイベント会話と同じ配列(rhythmEventStorySeen)へこの id を入れて持つ。新しい保存キーは作らない。
const RAID_JACK_STORY_START_ID = 'raid_jack_story_1b';
// 段階を倒したあとのストーリー。段階 a1(男爵)を倒すと第2部、a5(大王)を倒すと第6部
const RAID_JACK_STORY_AFTER_TIER = Object.freeze({
  a1: 'raid_jack_story_2', a2: 'raid_jack_story_3', a3: 'raid_jack_story_4', a4: 'raid_jack_story_5', a5: 'raid_jack_story_6',
});
const RAID_JACK_ENDING_CLEARED_ID = 'raid_jack_ending_cleared';
const RAID_JACK_ENDING_NOTCLEARED_ID = 'raid_jack_ending_notcleared';
const RAID_JACK_STORY_IDS = Object.freeze([
  RAID_JACK_STORY_START_ID, ...Object.values(RAID_JACK_STORY_AFTER_TIER), RAID_JACK_ENDING_CLEARED_ID, RAID_JACK_ENDING_NOTCLEARED_ID,
]);
// EVENT_REPLAYS の unlockedKey(例: raid_jack_story_2 → raidJackStory2Seen / raid_jack_ending_cleared → raidJackEndingClearedSeen)
const raidJackStoryUnlockKey = (id) => `${String(id).replace(/^raid_jack_/, 'raidJack_').replace(/_([a-z0-9])/g, (m, c) => c.toUpperCase()).replace(/^raidJack(\w)/, (m, c) => 'raidJack' + c.toUpperCase())}Seen`;
// イベント中のBGM(2026-10-04・ユーザー指示)。ジャック戦・レイド画面・段階えらび・編成は、この曲に固定する。
// HOMEの曲は、ユーザーが自分で選んでいない(既定のまま)あいだだけ、期間中にこの曲へ替わる。終わると元に戻る
const RAID_JACK_BGM_TRACK = 'melo_crazy_party_night_full';   // Crazy Party Night ～ぱんぷきんの逆襲～ の全編版(2026-10-04・ユーザー指示「ハロウィンイベント関連はこの曲をデフォルトに」。1分34秒の版から替えた)
const RAID_JACK_BGM_STATES = Object.freeze(['RAID_JACK', 'RAID_JACK_PREP']);
// 絵の大きさ合わせ(2026-10-04・ユーザー指示「本体を2枚目(両腕ポーズ)ぐらいのサイズ感に」)。
// 両腕ポーズの絵は腕が左右へ広がるので、同じ枠に収めると本体は幅の約49%。通常絵は本体が幅の約99%。
// ポーズ絵は枠いっぱい(1倍)、通常絵は半分(0.5倍)で描くと、切り替わっても本体の大きさがそろう。
const RAID_JACK_NORMAL_ART_SCALE = 0.5;
// Aは、このターンになった時に、編成の全員の固有技と選んだアシカが1段階ずつ上がる(Bは成長しない)
const RAID_JACK_LEVEL_UP_TURNS = Object.freeze([3, 5, 8]);
// レイドバトル(A)のターンごとの強化。2ターン目から、1ターン進むごとに味方全員の全ステータスが5%ずつ(掛け算で)上がり、
// ライフ・ガッツの自動回復の割合が1.5%ずつ上がる(ライフの初期値10%・ガッツはそれより5%低い)。
// 戦闘の中身(60-app.jsx の raidJackTurnGrowth)と、画面の「強化」の表示(71-screen-battle.jsx)が同じ数字を見る
const RAID_JACK_TURN_GROWTH = 1.05;
const RAID_JACK_TURN_REGEN_STEP = 0.015;
// turn ターン目にいるときの強化の状況。turn は 1 始まり。次の固有技・アシカの強化が無ければ nextLevelUpTurn は null
const raidJackGrowthAt = (turn) => {
  const t = Math.max(1, Math.floor(Number(turn) || 1));
  const steps = t - 1;
  const lifeRate = Math.round((0.1 + RAID_JACK_TURN_REGEN_STEP * steps) * 1000) / 10;
  const levelUps = RAID_JACK_LEVEL_UP_TURNS.filter((n) => n <= t).length;
  const next = RAID_JACK_LEVEL_UP_TURNS.find((n) => n > t);
  return {
    turn: t, steps,
    statPct: Math.round((Math.pow(RAID_JACK_TURN_GROWTH, steps) - 1) * 1000) / 10,   // ここまでの全ステータスの上がり(合計%)
    stepPct: Math.round((RAID_JACK_TURN_GROWTH - 1) * 1000) / 10,                      // 1ターンぶん(%)
    lifeRate, gutsRate: Math.round((lifeRate - 5) * 10) / 10,
    levelUps, levelUpMax: RAID_JACK_LEVEL_UP_TURNS.length,
    nextLevelUpTurn: next === undefined ? null : next,
    levelUpNow: RAID_JACK_LEVEL_UP_TURNS.includes(t),
  };
};

// 技の種類(再生なし)。増やす順は既存の TACTICS_EXTRA_ACTION_ORDER に合わせ、
// 減らすときは攻撃力アップ(roar)から先に落とす。
const RAID_JACK_ACTION_IDS = Object.freeze(['rush', 'sweep', 'roar', 'pierce', 'allout']);
const RAID_JACK_SKILL_NAMES = Object.freeze({
  normal: 'カボチャ張り手',
  special: 'めいどのトリート',
  sweep: 'おばけキッス',
  rush: 'ジャックラッシュ',
  pierce: 'かぼちゃ延髄斬り',
  roar: 'ハロウィンナイト',
  allout: 'おばけパレード',
});

// atkPower を渡したときは、攻撃力だけこの倍率で決める(ライフは power のまま)。渡さなければ power と同じ(グランドスラム)。
const raidJackTier = (id, name, power, actionCount, atkPower = power) => Object.freeze({
  id, name, power, actionCount, atkPower,
  hp: Math.round(RAID_JACK_BASE.hp * power * RAID_JACK_LIFE_MULTIPLIER),
  atk: Math.round(RAID_JACK_BASE.atk * atkPower),
});
// レイドバトル(A)の攻撃力の倍率(2026-10-04・ユーザー指示)。通常バトルの難易度 Easy / Normal / Hard / Expert / Master の
// 攻撃倍率(DIFFICULTY_SETTINGS の power: 0.5 / 1.0 / 1.5 / 3.0 / 5.0)と同じにする。ライフは変えない。
// 数字がずれていないかは tools/mode/raid-jack-check.js が DIFFICULTY_SETTINGS と突き合わせる
const RAID_JACK_A_ATK_POWERS = Object.freeze([0.5, 1.0, 1.5, 3.0, 5.0]);

// A: ベースモン協力戦。段階ごとの共有HP。
const RAID_JACK_A_TIERS = Object.freeze([
  raidJackTier('a1', 'ジャック男爵', 5.0, 3, RAID_JACK_A_ATK_POWERS[0]),    // 攻撃力は Easy
  raidJackTier('a2', 'ジャック子爵', 6.5, 4, RAID_JACK_A_ATK_POWERS[1]),    // Normal
  raidJackTier('a3', 'ジャック伯爵', 8.0, 5, RAID_JACK_A_ATK_POWERS[2]),    // Hard
  raidJackTier('a4', 'ジャック公爵', 10.0, 5, RAID_JACK_A_ATK_POWERS[3]),   // Expert
  raidJackTier('a5', 'ジャック大王', 13.0, 5, RAID_JACK_A_ATK_POWERS[4]),   // Master
]);
// B: マスモンの累計ダメージ。5段階(ランキングは共有)。
const RAID_JACK_B_TIERS = Object.freeze([
  raidJackTier('b1', '初級ジャック', 0.2, 3),
  raidJackTier('b2', '中級ジャック', 2, 4),
  raidJackTier('b3', '上級ジャック', 10, 5),
  raidJackTier('b4', '超級ジャック', 40, 5),
  raidJackTier('b5', '極級ジャック', 100, 5),
]);

const raidJackTiers = (kind) => (kind === 'b' ? RAID_JACK_B_TIERS : RAID_JACK_A_TIERS);
const raidJackTierAt = (kind, index) => {
  const list = raidJackTiers(kind);
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  return list[Math.min(Math.max(i, 0), list.length - 1)];
};

// 期間。見るたびに数え直す(読み込み時に1回だけ決まる値にしない)。
const raidJackWindowAt = (nowMs) => {
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  const start = Date.parse(RAID_JACK_EVENT.startAt);
  const end = Date.parse(RAID_JACK_EVENT.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'before';
  if (now < start) return 'before';
  if (now >= end) return 'after';
  return 'open';
};

// 段階を倒したあと・期間が終わったあとに、みんなへ1回ずつ流すストーリーの候補(古い順)。
// totals は sbFetchRaidJackTierTotals の返り値({ a:{1:{total},...} })。取れていない(null)ときは段階の話を出さない。
// 段階を倒した = その段階の共有ライフ(hp)ぶん以上のダメージが集まった。
// 終章は期間が終わってから。大王(a5)まで倒せていれば「倒せた」、倒せていなければ「倒せなかった」。
// 見たかどうかの判定は呼ぶ側(まだ見ていない最初の1本を選ぶ)。読み込み時に決めず、見るたびに数え直す
const raidJackStoryCandidates = (totals, nowMs) => {
  const out = [];
  const a = totals && totals.a ? totals.a : null;
  const defeatedAt = (i) => !!a && !!a[i + 1] && (Number(a[i + 1].total) || 0) >= RAID_JACK_A_TIERS[i].hp;
  if (a) {
    RAID_JACK_A_TIERS.forEach((t, i) => { if (defeatedAt(i)) out.push(RAID_JACK_STORY_AFTER_TIER[t.id]); });
  }
  if (raidJackWindowAt(nowMs) === 'after' && a) {
    out.push(defeatedAt(RAID_JACK_A_TIERS.length - 1) ? RAID_JACK_ENDING_CLEARED_ID : RAID_JACK_ENDING_NOTCLEARED_ID);
  }
  return out.filter(Boolean);
};

// 毎日5:00(JST)で回数が戻る。日付キー = 5時間引いたJSTの日付。
const raidJackDayKey = (nowMs) => {
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  const jst = new Date(now + 9 * 3600 * 1000 - 5 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
};

// 保存データの正規化(新キーだけ。無い・壊れているときは既定値)
const raidJackDefaultState = () => ({
  a: { day: '', used: 0, extra: 0, defeated: [] },
  b: { day: '', used: 0, extra: 0, defeated: [], total: 0 },
  claimed: [],
  pending: [],
  repaired: false,   // デバッグで付いた「倒した」印をサーバーの記録と突き合わせて直したか(1回だけ・raidJackRepairState)
});
const raidJackNormalizeSide = (raw, withTotal) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {
    day: typeof src.day === 'string' ? src.day : '',
    used: Number.isFinite(src.used) && src.used >= 0 ? Math.floor(src.used) : 0,
    extra: Number.isFinite(src.extra) && src.extra >= 0 ? Math.floor(src.extra) : 0,
    defeated: Array.isArray(src.defeated) ? src.defeated.filter((v) => typeof v === 'string').slice(0, 16) : [],
  };
  if (withTotal) out.total = Number.isFinite(src.total) && src.total >= 0 ? Math.floor(src.total) : 0;
  return out;
};
// 送れなかった与ダメージ(再送待ち)。同じ hit_id で何度送っても二重に数えられない(サーバー側が1行にする)
const raidJackNormalizePending = (raw) => (Array.isArray(raw) ? raw : []).map((h) => {
  const x = h && typeof h === 'object' ? h : {};
  const tier = Number.isFinite(x.tier) ? Math.floor(x.tier) : 0;
  const damage = Number.isFinite(x.damage) ? Math.floor(x.damage) : -1;
  if (typeof x.hitId !== 'string' || !/^[0-9A-Za-z_-]{8,64}$/.test(x.hitId)) return null;
  if (x.kind !== 'a' && x.kind !== 'b') return null;
  if (tier < 1 || tier > 5 || damage < 0 || damage > 100000000) return null;
  return { hitId: x.hitId, kind: x.kind, tier, damage, defeated: x.defeated === true };
}).filter(Boolean).slice(0, 30);
const raidJackNormalizeState = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    a: raidJackNormalizeSide(src.a, false),
    b: raidJackNormalizeSide(src.b, true),
    claimed: Array.isArray(src.claimed) ? src.claimed.filter((v) => typeof v === 'string').slice(0, 64) : [],
    pending: raidJackNormalizePending(src.pending),
    repaired: src.repaired === true,
  };
};

// 今日の残りの無料回数(日が変わっていたら used は 0 扱い)。extra はビートPで買った分(その日のうち)。
const raidJackRemaining = (side, nowMs) => {
  const s = raidJackNormalizeSide(side, false);
  const today = raidJackDayKey(nowMs);
  const used = s.day === today ? s.used : 0;
  const extra = s.day === today ? s.extra : 0;
  return Math.max(0, RAID_JACK_FREE_PER_DAY + extra - used);
};

// B: 前の段階を倒すと次が開く(初級は最初から)。A は共有HPが0になった段階までが開く。
const raidJackUnlockedCount = (kind, defeatedIds) => {
  const list = raidJackTiers(kind);
  const defeated = Array.isArray(defeatedIds) ? defeatedIds : [];
  let n = 1;
  for (let i = 0; i < list.length - 1; i += 1) {
    if (defeated.includes(list[i].id)) n = i + 2;
    else break;
  }
  return n;
};

// 戦闘に出すジャック本体。ライフ・攻撃は段階の値をそのまま使う(35,000×倍率×10 の端数ずれを避けるため上書きする)。
// 技の本数は actionCount で直接指定する(再生なし。3/4/5/5/5)。createBattleEnemy は 22-enemy-and-bond-entries.jsx
const raidJackMakeEnemy = (kind, tierIndex, mode) => {
  const tier = raidJackTierAt(kind, tierIndex);
  const enemy = createBattleEnemy(1, 'Normal', 'Jack', tier.power, 1, { mode, actionCount: tier.actionCount });
  if (!enemy) return null;
  // 名前は段階の名前(ジャック男爵・初級ジャックなど)。バトル画面のボスバーやログにそのまま出る
  return { ...enemy, name: tier.name, maxHp: tier.hp, hp: tier.hp, atk: tier.atk, raidJackTier: tier.id };
};

// ===== 報酬の表(2026-10-04・ユーザーが1つずつ決めた。設計書「報酬の表」と同じ数字) =====
// 中身は 5 つ: diamond=ダイヤ / psyche=虹のプシュケー / crystal=魂格の結晶 / fruit=虹の超越の実 / proof=勇者の証。
// 勇者の証片・限定アイコン・称号は使わない。届け方はギフト(raidJackRewardGiftItems)。
// 配りすぎていないかは公開後に見て、表をここで直せる形にしてある(受け取り済みIDは数字に依らない)。
const raidJackReward = ({ diamond = 0, psyche = 0, crystal = 0, fruit = 0, proof = 0 } = {}) =>
  Object.freeze({ diamond, psyche, crystal, fruit, proof });
const RAID_JACK_REWARDS = Object.freeze({
  // A・Bそれぞれ、1回でも挑戦した全員へ1回
  participation: raidJackReward({ diamond: 30000, psyche: 50 }),
  // A 討伐: その段階が倒れたとき、その段階に1回でも与えた全員へ(男爵→大王)
  aClear: Object.freeze([
    raidJackReward({ diamond: 100000, psyche: 50 }),
    raidJackReward({ diamond: 200000, psyche: 60 }),
    raidJackReward({ diamond: 300000, psyche: 70 }),
    raidJackReward({ diamond: 400000, psyche: 80 }),
    raidJackReward({ diamond: 1000000, psyche: 100, proof: 5 }),
  ]),
  // A 順位: 段階ごとの貢献1〜5位(男爵〜公爵は倒れたとき・大王は期間終了のとき)
  aRank: Object.freeze([
    Object.freeze([
      raidJackReward({ diamond: 1000000, psyche: 3000, crystal: 3, fruit: 50 }),
      raidJackReward({ diamond: 800000, psyche: 2500, crystal: 2, fruit: 40 }),
      raidJackReward({ diamond: 600000, psyche: 2000, crystal: 2, fruit: 30 }),
      raidJackReward({ diamond: 400000, psyche: 1500, crystal: 1, fruit: 20 }),
      raidJackReward({ diamond: 200000, psyche: 1000, crystal: 1, fruit: 10 }),
    ]),
    Object.freeze([
      raidJackReward({ diamond: 2000000, psyche: 6000, crystal: 6, fruit: 100 }),
      raidJackReward({ diamond: 1600000, psyche: 5000, crystal: 4, fruit: 80 }),
      raidJackReward({ diamond: 1200000, psyche: 4000, crystal: 4, fruit: 60 }),
      raidJackReward({ diamond: 800000, psyche: 3000, crystal: 2, fruit: 40 }),
      raidJackReward({ diamond: 400000, psyche: 2000, crystal: 2, fruit: 20 }),
    ]),
    Object.freeze([
      raidJackReward({ diamond: 3000000, psyche: 8000, crystal: 8, fruit: 150, proof: 5 }),
      raidJackReward({ diamond: 2400000, psyche: 6500, crystal: 6, fruit: 120, proof: 4 }),
      raidJackReward({ diamond: 1800000, psyche: 5000, crystal: 5, fruit: 100, proof: 3 }),
      raidJackReward({ diamond: 1200000, psyche: 4000, crystal: 3, fruit: 80, proof: 2 }),
      raidJackReward({ diamond: 600000, psyche: 3000, crystal: 2, fruit: 60, proof: 1 }),
    ]),
    Object.freeze([
      raidJackReward({ diamond: 5000000, psyche: 12000, crystal: 12, fruit: 250, proof: 10 }),
      raidJackReward({ diamond: 4000000, psyche: 10000, crystal: 10, fruit: 200, proof: 8 }),
      raidJackReward({ diamond: 3000000, psyche: 8000, crystal: 8, fruit: 150, proof: 6 }),
      raidJackReward({ diamond: 2000000, psyche: 6000, crystal: 6, fruit: 100, proof: 4 }),
      raidJackReward({ diamond: 1000000, psyche: 4000, crystal: 4, fruit: 50, proof: 2 }),
    ]),
    Object.freeze([
      raidJackReward({ diamond: 6000000, psyche: 14000, crystal: 15, fruit: 300, proof: 15 }),
      raidJackReward({ diamond: 5000000, psyche: 12000, crystal: 12, fruit: 250, proof: 12 }),
      raidJackReward({ diamond: 4000000, psyche: 10000, crystal: 10, fruit: 200, proof: 9 }),
      raidJackReward({ diamond: 3000000, psyche: 8000, crystal: 8, fruit: 150, proof: 6 }),
      raidJackReward({ diamond: 2000000, psyche: 6000, crystal: 6, fruit: 100, proof: 3 }),
    ]),
  ]),
  // B 討伐: 各難易度を初めて倒したとき1回(初級→極級)
  bClear: Object.freeze([
    raidJackReward({ diamond: 1000000, psyche: 5000, crystal: 1, fruit: 20 }),
    raidJackReward({ diamond: 2000000, psyche: 7000, crystal: 2, fruit: 40, proof: 5 }),
    raidJackReward({ diamond: 3000000, psyche: 9000, crystal: 3, fruit: 60, proof: 10 }),
    raidJackReward({ diamond: 4000000, psyche: 11000, crystal: 4, fruit: 80, proof: 15 }),
    raidJackReward({ diamond: 5000000, psyche: 13000, crystal: 5, fruit: 100, proof: 20 }),
  ]),
  // B 順位: 期間中の累計ダメージ(5難易度の合算)の最終1〜5位。期間終了のときに確定
  bFinal: Object.freeze([
    raidJackReward({ crystal: 25, fruit: 100, proof: 10 }),
    raidJackReward({ crystal: 20, fruit: 90, proof: 8 }),
    raidJackReward({ crystal: 15, fruit: 80, proof: 6 }),
    raidJackReward({ crystal: 10, fruit: 70, proof: 4 }),
    raidJackReward({ crystal: 5, fruit: 60, proof: 2 }),
  ]),
});
const RAID_JACK_REWARD_RANKS = 5;

// 報酬1つぶんの中身を、表示用の行にする(ダイヤ・プシュケー・結晶・虹の超越の実・勇者の証。0は出さない)
const raidJackRewardParts = (reward) => {
  const r = reward && typeof reward === 'object' ? reward : {};
  const defs = [
    ['diamond', '💎', 'ダイヤ'],
    ['psyche', '💗', '虹のプシュケー'],
    ['crystal', '🔮', '魂格の結晶'],
    ['fruit', '🌈', '虹の超越の実'],
    ['proof', '🏅', '勇者の証'],
  ];
  return defs.map(([key, emoji, label]) => ({ key, emoji, label, amount: Math.max(0, Math.floor(Number(r[key]) || 0)) })).filter((p) => p.amount > 0);
};
const raidJackRewardText = (reward) => raidJackRewardParts(reward).map((p) => `${p.emoji} ${p.label}×${p.amount.toLocaleString()}`).join(' ／ ');
// ギフト1件ぶんの中身(既存の diamond / rainbowPsyche と、アイテムidそのままの gameItem)
const raidJackRewardGiftItems = (reward) => {
  const r = reward && typeof reward === 'object' ? reward : {};
  const out = [];
  const add = (item) => { if (item.amount > 0) out.push(item); };
  add({ type: 'diamond', amount: Math.max(0, Math.floor(Number(r.diamond) || 0)) });
  add({ type: 'rainbowPsyche', amount: Math.max(0, Math.floor(Number(r.psyche) || 0)) });
  add({ type: 'gameItem', itemId: SOUL_CRYSTAL_ITEM_ID, amount: Math.max(0, Math.floor(Number(r.crystal) || 0)) });
  add({ type: 'gameItem', itemId: RAINBOW_TRANSCEND_FRUIT_ITEM_ID, amount: Math.max(0, Math.floor(Number(r.fruit) || 0)) });
  add({ type: 'gameItem', itemId: HERO_PROOF_ITEM_ID, amount: Math.max(0, Math.floor(Number(r.proof) || 0)) });
  return out;
};
// 受け取り済みの印(mh_raid_jack_v1 の claimed)に入れるid。1つの報酬に1つ。数字を変えても変わらない
const raidJackClaimId = (kind, tierIndex, rank) => {
  const n = Math.floor(Number(tierIndex)) + 1;
  if (kind === 'part_a' || kind === 'part_b') return kind;
  if (kind === 'final_b') return 'final_b';
  return `${kind}${n}`;   // clear_a1 / rank_a1 / clear_b1
};
// 受け取り済みの印のうち、「順位に入っていなかった」ことを覚えておく印(毎回サーバーへ問い合わせ直さないため)
const raidJackNoneId = (id) => `${id}_none`;
// 1つの報酬の題名(ギフトの見出し)
const raidJackRewardTitle = (kind, tierIndex, rank) => {
  const aName = RAID_JACK_A_TIERS[Math.min(Math.max(tierIndex || 0, 0), 4)].name;
  const bName = RAID_JACK_B_TIERS[Math.min(Math.max(tierIndex || 0, 0), 4)].name;
  if (kind === 'part_a') return 'ジャック レイドバトル 参加賞';
  if (kind === 'part_b') return 'ジャック グランドスラム 参加賞';
  if (kind === 'clear_a') return `${aName} 討伐報酬`;
  if (kind === 'rank_a') return `${aName} 貢献${rank}位の報酬`;
  if (kind === 'clear_b') return `${bName} 初討伐報酬`;
  return `グランドスラム 累計ダメージ${rank}位の報酬`;
};
