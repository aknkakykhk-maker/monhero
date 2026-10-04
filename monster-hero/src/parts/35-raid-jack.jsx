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

// 期間(★仮)。公開日時は「準備ができてから決める」。終わりは週の区切り(月曜5:00)ではなく、
// ハロウィン・ナイトの終了(11/1 4:00)に合わせる。
const RAID_JACK_EVENT = Object.freeze({
  id: 'raid_jack_2026',
  name: 'カボチャの大王ジャック',
  startAt: '2026-10-11T08:00:00+09:00',
  endAt: '2026-11-01T04:00:00+09:00',
});

const RAID_JACK_BASE = Object.freeze({ hp: 35000, atk: 700 });
const RAID_JACK_LIFE_MULTIPLIER = 10;
const RAID_JACK_TURNS = 10;
const RAID_JACK_FREE_PER_DAY = 3;
const RAID_JACK_EXTRA_COST_BEAT_P = 100;
const RAID_JACK_STORAGE_KEY = 'mh_raid_jack_v1';
// Aは、このターンになった時に、編成の全員の固有技と選んだアシカが1段階ずつ上がる(Bは成長しない)
const RAID_JACK_LEVEL_UP_TURNS = Object.freeze([3, 5, 8]);

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

const raidJackTier = (id, name, power, actionCount) => Object.freeze({
  id, name, power, actionCount,
  hp: Math.round(RAID_JACK_BASE.hp * power * RAID_JACK_LIFE_MULTIPLIER),
  atk: Math.round(RAID_JACK_BASE.atk * power),
});

// A: ベースモン協力戦。段階ごとの共有HP。
const RAID_JACK_A_TIERS = Object.freeze([
  raidJackTier('a1', 'ジャック男爵', 5.0, 3),
  raidJackTier('a2', 'ジャック子爵', 6.5, 4),
  raidJackTier('a3', 'ジャック伯爵', 8.0, 5),
  raidJackTier('a4', 'ジャック公爵', 10.0, 5),
  raidJackTier('a5', 'ジャック大王', 13.0, 5),
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
  return { ...enemy, maxHp: tier.hp, hp: tier.hp, atk: tier.atk, raidJackTier: tier.id };
};
