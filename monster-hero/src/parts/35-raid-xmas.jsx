// ===== クリスマスのレイド(r1119-172)の定義(純粋な計算とデータ) =====
// つなぎ目の正本: docs/progress/event-xmas-2026/BUILD.md / 企画: docs/progress/event-xmas-2026/PLAN.md
//
// 決めごと:
//  ・土台はジャック(35-raid-jack.jsx)。ジャックのデータ・キー・関数の動きは変えない。段階の形・報酬の表・ビートの換算はジャックの物を使い回す。
//  ・サーバーはジャックと同じ表 raid_jack_hits を、イベントid raid_xmas_2026 で使う(デバッグは raid_xmas_debug)。
//  ・端末の保存は新しいキー mh_raid_xmas_v1(形は mh_raid_jack_v1 と同じ)。ジャックのキーには触らない。
//  ・与ダメージの入口は battle / rhythm / card の3つ。レイドバトル(A)の回数は3つで共通。グランドスラム(B)はバトルだけ。
//  ・ボスの名前・絵は仮(社長が後で渡す)。画面は RAID_XMAS_EVENT.name と段階の name を読み、直書きしない。
//  ・数字は仮(ジャックの最後の数字と同じ)。社長が決めたら、この下の表だけ差し替える。
//  ・開催中かどうかは、見るたびに raidXmasWindowAt(Date.now()) で数え直す。
//  ・公開フラグ RELEASE_FLAGS.raidXmas(開始時刻を過ぎたら真)が偽のあいだは、入口もヘルプ・更新履歴も出さない。

// 開始は 17-release-changelog-login-missions.jsx の RAID_XMAS_START_AT と同じ値(更新履歴の公開判定が先に読むため、そちらにも置く。食い違いは raid-xmas-check.js が見る)
const RAID_XMAS_EVENT = Object.freeze({
  id: 'raid_xmas_2026',
  debugId: 'raid_xmas_debug',
  name: '黒いサンタ(仮)',
  startAt: '2026-11-30T10:00:00+09:00',
  endAt: '2026-12-31T04:00:00+09:00',
  storageKey: 'mh_raid_xmas_v1',
});
const RAID_XMAS_STORAGE_KEY = RAID_XMAS_EVENT.storageKey;
const RAID_XMAS_SOURCES = Object.freeze(['battle', 'rhythm', 'card']);
const RAID_XMAS_FREE_PER_DAY = 3;
const RAID_XMAS_EXTRA_COST_BEAT_P = 300;
const RAID_XMAS_TURNS = 20;

// ---- 段階(仮。ジャックの最後の数字と同じ) ----
// A: レイドバトル(協力・共有ライフ)。ライフ 175万 / 320万 / 800万 / 3,500万 / 8,000万・攻撃力 350 / 500 / 600 / 800 / 1,000
const RAID_XMAS_A_HPS = Object.freeze([1750000, 3200000, 8000000, 35000000, 80000000]);
const RAID_XMAS_A_ATKS = Object.freeze([350, 500, 600, 800, 1000]);
const RAID_XMAS_A_NAMES = Object.freeze(['黒いサンタ(仮)・一', '黒いサンタ(仮)・二', '黒いサンタ(仮)・三', '黒いサンタ(仮)・四', '黒いサンタ(仮)・五']);
const RAID_XMAS_A_TIERS = Object.freeze(RAID_XMAS_A_NAMES.map((name, i) =>
  raidJackTier(`a${i + 1}`, name, [5.0, 6.5, 8.0, 10.0, 13.0][i], [3, 4, 5, 5, 5][i], RAID_XMAS_A_ATKS[i] / RAID_JACK_BASE.atk, RAID_XMAS_A_HPS[i])));
// 最後の段階を倒したあと: 共有ライフは無限(倒した扱いにしない)・1戦のライフ 455万・攻撃力 700。サーバーへ送る段階は 5 のまま
const RAID_XMAS_AFTER_BOSS = raidJackTier('a6', '黒いサンタ(仮)・聖夜', 13.0, 5, 1.0, 4550000);
// B: グランドスラム(個人・累計)。倍率 0.2 / 2 / 10 / 40 / 100
const RAID_XMAS_B_TIERS = Object.freeze([
  raidJackTier('b1', '初級 黒いサンタ(仮)', 0.2, 3),
  raidJackTier('b2', '中級 黒いサンタ(仮)', 2, 4),
  raidJackTier('b3', '上級 黒いサンタ(仮)', 10, 5),
  raidJackTier('b4', '超級 黒いサンタ(仮)', 40, 5),
  raidJackTier('b5', '極級 黒いサンタ(仮)', 100, 5),
]);
const raidXmasTiers = (kind) => (kind === 'b' ? RAID_XMAS_B_TIERS : RAID_XMAS_A_TIERS);
const raidXmasTierAt = (kind, index) => {
  const list = raidXmasTiers(kind);
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  return list[Math.min(Math.max(i, 0), list.length - 1)];
};

// 報酬はジャックと同じ表(社長決定 2026-11-25)
const RAID_XMAS_REWARDS = RAID_JACK_REWARDS;

// 期間。見るたびに数え直す
const raidXmasWindowAt = (nowMs) => {
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  const start = Date.parse(RAID_XMAS_EVENT.startAt);
  const end = Date.parse(RAID_XMAS_EVENT.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'before';
  if (now < start) return 'before';
  if (now >= end) return 'after';
  return 'open';
};

// 最後の段階が倒されたか(totals は sbFetchRaidJackTierTotals の返り値)
const raidXmasBossDown = (totals) => !!totals && !!totals.a && !!totals.a[RAID_XMAS_A_TIERS.length]
  && (Number(totals.a[RAID_XMAS_A_TIERS.length].total) || 0) >= RAID_XMAS_A_TIERS[RAID_XMAS_A_TIERS.length - 1].hp;

// 今日の残りの回数(日付の区切りはジャックと同じ 4:00)。extra はビートPで買った分(その日のうち)
const raidXmasRemaining = (side, nowMs) => {
  const s = raidJackNormalizeSide(side, false);
  const today = raidJackDayKey(nowMs);
  const used = s.day === today ? s.used : 0;
  const extra = s.day === today ? s.extra : 0;
  return Math.max(0, RAID_XMAS_FREE_PER_DAY + extra - used);
};

// モンヒロビートの換算。はじめはジャックの式そのまま(数字を変えるときはここだけ直す)
const raidXmasRhythmDamageOf = (result, difficulty) => raidJackRhythmDamageOf(result, difficulty);

// ---- 段階を倒すたびのお話(台本は docs/progress/event-xmas-2026/SCRIPT.md。データは data/assistants.js の EVENT_REPLAYS に足す) ----
const RAID_XMAS_STORY_START_ID = 'raid_xmas_story_1b';
const RAID_XMAS_STORY_AFTER_TIER = Object.freeze({
  a1: 'raid_xmas_story_2', a2: 'raid_xmas_story_3', a3: 'raid_xmas_story_4', a4: 'raid_xmas_story_5', a5: 'raid_xmas_story_6',
});
const RAID_XMAS_ENDING_CLEARED_ID = 'raid_xmas_ending_cleared';
const RAID_XMAS_ENDING_NOTCLEARED_ID = 'raid_xmas_ending_notcleared';
const RAID_XMAS_STORY_IDS = Object.freeze([
  RAID_XMAS_STORY_START_ID, ...Object.values(RAID_XMAS_STORY_AFTER_TIER), RAID_XMAS_ENDING_CLEARED_ID, RAID_XMAS_ENDING_NOTCLEARED_ID,
]);
// 段階を倒したあと・期間が終わったあとに流すお話の候補(古い順)。totals が取れていないときは段階の話を出さない
const raidXmasStoryCandidates = (totals, nowMs) => {
  const out = [];
  const a = totals && totals.a ? totals.a : null;
  const defeatedAt = (i) => !!a && !!a[i + 1] && (Number(a[i + 1].total) || 0) >= RAID_XMAS_A_TIERS[i].hp;
  if (a) RAID_XMAS_A_TIERS.forEach((t, i) => { if (defeatedAt(i)) out.push(RAID_XMAS_STORY_AFTER_TIER[t.id]); });
  if (raidXmasWindowAt(nowMs) === 'after' && a) {
    out.push(defeatedAt(RAID_XMAS_A_TIERS.length - 1) ? RAID_XMAS_ENDING_CLEARED_ID : RAID_XMAS_ENDING_NOTCLEARED_ID);
  }
  return out.filter(Boolean);
};
