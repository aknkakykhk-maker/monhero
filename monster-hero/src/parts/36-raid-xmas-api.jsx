// ===== クリスマスのレイドの回数・与ダメージ(3つの入口で共通の口) =====
// つなぎ目の正本: docs/progress/event-xmas-2026/BUILD.md(§2 回数・§3 ダメージを足す関数)
//
// 決めごと:
//  ・サーバーへ送るのはジャックの通信(sbSendRaidJackHit・raidJackSubmitHit)を、イベントid raid_xmas_2026 で使う。
//  ・端末の保存は mh_raid_xmas_v1 だけ。ジャックの mh_raid_jack_v1 には読みも書きもしない。
//  ・各部(バトル・ビート・カード)は表へ直接送らず、raidXmasUseTry → 遊ぶ → raidXmasAddDamage の順に呼ぶ。
//  ・デバッグの強制表示中(raidXmasSetDebug)は、端末の記録に書かず・デバッグ用のイベントidで送るだけ(回数は realRules のときだけ数える)。

const raidXmasLoadState = async () => {
  try { return raidJackNormalizeState(await storeGet(RAID_XMAS_STORAGE_KEY, null, false)); } catch (e) { return raidJackDefaultState(); }
};
const raidXmasSaveState = async (state) => {
  try { await storeSet(RAID_XMAS_STORAGE_KEY, raidJackNormalizeState(state), false); return true; } catch (e) { return false; }
};

// デバッグの強制表示(レイドの確認画面から入れる)。realRules が真なら回数・端末の記録は本番どおり数える(送り先はデバッグのid)
let _raidXmasDebug = { force: false, realRules: false };
const raidXmasSetDebug = (opts) => {
  const o = opts && typeof opts === 'object' ? opts : {};
  _raidXmasDebug = { force: o.force === true, realRules: o.realRules === true };
};
const raidXmasEventId = () => (_raidXmasDebug.force ? RAID_XMAS_EVENT.debugId : RAID_XMAS_EVENT.id);
const raidXmasSafeEventId = (id) => (id === RAID_XMAS_EVENT.id || id === RAID_XMAS_EVENT.debugId ? id : raidXmasEventId());

// 段階の合計を取る(取れなければ null)。待つのは長くて waitMs まで
const raidXmasFetchTotals = async (eventId, waitMs = 4000) => {
  try {
    return await Promise.race([sbFetchRaidJackTierTotals(raidXmasSafeEventId(eventId)), new Promise((resolve) => setTimeout(() => resolve(null), waitMs))]);
  } catch (e) { return null; }
};

// 1回挑む前に呼ぶ。レイドバトル(A)の回数を1つ使う(3つの入口で共通)。返り値 { ok, hitId, eventId, remaining }
//   ok が false: 期間外・残りが無い・保存に失敗(始めない)。kind 'b' はグランドスラム(バトルだけ)
const raidXmasUseTry = async (kind = 'a', nowMs = Date.now()) => {
  const k = kind === 'b' ? 'b' : 'a';
  const eventId = raidXmasEventId();
  const hitId = raidJackMakeHitId(nowMs);
  if (_raidXmasDebug.force && !_raidXmasDebug.realRules) return { ok: true, hitId, eventId, remaining: null };
  if (!_raidXmasDebug.force && raidXmasWindowAt(nowMs) !== 'open') return { ok: false, hitId: '', eventId, remaining: 0 };
  const state = await raidXmasLoadState();
  const side = state[k];
  const today = raidJackDayKey(nowMs);
  if (side.day !== today) { side.day = today; side.used = 0; side.extra = 0; }
  const left = raidXmasRemaining(side, nowMs);
  if (left <= 0) return { ok: false, hitId: '', eventId, remaining: 0 };
  side.used += 1;
  if (!(await raidXmasSaveState(state))) return { ok: false, hitId: '', eventId, remaining: left };   // 回数だけ減る事故を作らない
  return { ok: true, hitId, eventId, remaining: left - 1 };
};

// 1回の挑戦が終わったら1度だけ呼ぶ。input = { source, kind, tierIndex, damage, hitId, eventId, defeated?, detail?, log? }
//   defeated: バトルは自分で分かる(敵を倒した)ので渡す。渡さなければ、いまの共有ライフの残りと比べて決める(ビート・カード)
//   log: バトルの記録に送る物 { party, units, turns, score }(バトルだけ。ビートは score だけ。カードは送らない)
// 返り値 { way, outcome('sent'|'pending'|'invalid'), damage, defeated, opened, kind, tierIndex, tierName, lifeBefore, lifeLeft, lifeMax, afterBoss, eventId, hitId, detail }
const raidXmasAddDamage = async (input) => {
  const i = input && typeof input === 'object' ? input : {};
  const source = RAID_XMAS_SOURCES.includes(i.source) ? i.source : '';
  const kind = i.kind === 'b' ? 'b' : 'a';
  const list = raidXmasTiers(kind);
  const tierIndex = Math.min(Math.max(Math.floor(Number(i.tierIndex) || 0), 0), list.length - 1);
  const tier = list[tierIndex];
  const damage = Math.max(0, Math.min(100000000, Math.floor(Number(i.damage) || 0)));
  const eventId = raidXmasSafeEventId(i.eventId);
  const hitId = raidJackSafeId(i.hitId) && i.hitId.length <= 64 ? i.hitId : raidJackMakeHitId();
  const res = { way: source, outcome: 'sent', damage, defeated: false, opened: false, kind, tierIndex, tierName: tier.name,
    lifeBefore: null, lifeLeft: null, lifeMax: tier.hp, afterBoss: false, eventId, hitId, detail: i.detail && typeof i.detail === 'object' ? i.detail : null };
  if (!source || (kind === 'b' && source !== 'battle')) return { ...res, outcome: 'invalid' };
  // いまの共有ライフ(A だけ)。最後の段階を倒したあとは共有ライフが無限なので、倒した扱いにしない
  if (kind === 'a') {
    const totals = await raidXmasFetchTotals(eventId);
    if (totals) {
      const done = totals.a && totals.a[tierIndex + 1] ? Number(totals.a[tierIndex + 1].total) || 0 : 0;
      res.afterBoss = tierIndex === list.length - 1 && raidXmasBossDown(totals);
      res.lifeBefore = res.afterBoss ? RAID_XMAS_AFTER_BOSS.hp : Math.max(0, tier.hp - done);
      if (res.afterBoss) { res.tierName = RAID_XMAS_AFTER_BOSS.name; res.lifeMax = RAID_XMAS_AFTER_BOSS.hp; }
    }
  }
  if (typeof i.defeated === 'boolean') res.defeated = i.defeated && !res.afterBoss;
  else res.defeated = kind === 'a' && !res.afterBoss && damage > 0 && res.lifeBefore !== null && res.lifeBefore > 0 && damage >= res.lifeBefore;
  res.lifeLeft = res.lifeBefore === null ? null : Math.max(0, res.lifeBefore - damage);
  if (damage <= 0) return res;   // 送るものが無い(アシストモード・途中でやめた)
  const hit = { hitId, kind, tier: tierIndex + 1, damage, defeated: res.defeated, source };
  const isDebugRun = eventId !== RAID_XMAS_EVENT.id;
  let outcome = 'error';
  try {
    if (isDebugRun) {   // デバッグの回は本番の端末記録(倒した段階・累計・再送待ち)に書かない(ジャックと同じ)
      outcome = await sbSendRaidJackHit(hit, await ensureBreederId(), eventId);
    } else {
      let next = await raidXmasLoadState();
      const side = next[kind];
      const before = raidJackUnlockedCount(kind, side.defeated);
      if (res.defeated && !side.defeated.includes(tier.id)) side.defeated = [...side.defeated, tier.id];
      if (kind === 'b') side.total = (side.total || 0) + damage;
      res.opened = raidJackUnlockedCount(kind, side.defeated) > before;
      const sent = await raidJackSubmitHit(next, hit, await ensureBreederId(), eventId);
      next = sent.state; outcome = sent.outcome;
      await raidXmasSaveState(next);
    }
  } catch (e) { outcome = 'error'; }
  res.outcome = outcome === 'sent' ? 'sent' : outcome === 'invalid' ? 'invalid' : 'pending';
  // バトルの記録(印が偽のあいだ・デバッグ・カードは送らない。待たない)
  if (typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.battleLog === true && !isDebugRun && source !== 'card') {
    try {
      const log = i.log && typeof i.log === 'object' ? i.log : {};
      void sbSendRaidBattleLog(buildRaidBattleLogRow({ party: log.party, units: log.units, score: log.score,
        raid: { event: eventId, kind, tier: tierIndex + 1, source, damage, defeated: res.defeated, turns: log.turns } }));
    } catch (e) {}
  }
  return res;
};

// 端末に残っている再送待ちを送り直す(HOME とレイド画面を開いたとき)。返り値は送れた件数
const raidXmasFlushStoredPending = async (breederId) => {
  try {
    const state = await raidXmasLoadState();
    if (!state.pending.length || !raidJackSafeId(breederId)) return 0;
    const before = state.pending.length;
    const next = await raidJackFlushPending(state, breederId, RAID_XMAS_EVENT.id);
    if (next.pending.length !== before) {
      const latest = await raidXmasLoadState();
      const left = new Set(next.pending.map((p) => p.hitId));
      latest.pending = latest.pending.filter((p) => left.has(p.hitId));
      await raidXmasSaveState(latest);
    }
    return before - next.pending.length;
  } catch (e) { return 0; }
};

// ---- 報酬の受け取り(表はジャックと同じ・社長決定。判定は raidJackCollectDueRewards にこの規則を渡して使う) ----
//  ・段階のライフ・期間・題名だけクリスマスのもの。受け取り済みの印は mh_raid_xmas_v1 の claimed(ジャックの記録とは別)
//  ・ギフトの id はイベント id から作る(raid_xmas_2026_part_a など)。ジャックのギフト(raid_jack_2026_…)とぶつからない
const raidXmasRewardTitle = (kind, tierIndex, rank) => {
  const at = (list) => list[Math.min(Math.max(tierIndex || 0, 0), list.length - 1)].name;
  if (kind === 'part_a') return `${RAID_XMAS_EVENT.name} レイドバトル 参加賞`;
  if (kind === 'part_b') return `${RAID_XMAS_EVENT.name} グランドスラム 参加賞`;
  if (kind === 'clear_a') return `${at(RAID_XMAS_A_TIERS)} 討伐報酬`;
  if (kind === 'rank_a') return `${at(RAID_XMAS_A_TIERS)} 貢献${rank}位の報酬`;
  if (kind === 'clear_b') return `${at(RAID_XMAS_B_TIERS)} 初討伐報酬`;
  return `${RAID_XMAS_EVENT.name} グランドスラム 累計ダメージ${rank}位の報酬`;
};
const raidXmasRewardRules = () => ({
  aTiers: RAID_XMAS_A_TIERS,
  bTiers: RAID_XMAS_B_TIERS,
  rewards: RAID_XMAS_REWARDS,
  windowAt: raidXmasWindowAt,
  rewardTitle: raidXmasRewardTitle,
});
const raidXmasGiftId = (claimId) => `${RAID_XMAS_EVENT.id}_${claimId}`;

// ===== レイドの定義(def)。レイド画面(79-screen-raid-jack.jsx)と本体(60-app.jsx)は、ここを読んでジャックとクリスマスを同じ流れで動かす =====
//  ・ジャックの定義は、これまで画面・本体に直接書いていた値を集めただけ(ジャックの見え方・動きは変えない)。
//  ・クリスマスの数字・名前は 35-raid-xmas.jsx。ここは並べ替えるだけ(数字を書き写さない)。
//  ・関数(絵・状態の読み書き)は呼んだときに読む。絵の定数は data/images/images-enemy.js。
const raidEventShortName = (bossWord, name) => String(name || '').replace(`${bossWord}・`, '').replace(bossWord, '').trim();
const RAID_EVENT_JACK = Object.freeze({
  key: 'jack',
  id: RAID_JACK_EVENT.id,
  debugId: RAID_JACK_DEBUG_EVENT_ID,
  title: 'カボチャの大王ジャック',
  icon: '🎃',
  note: '全員でジャックを倒そう',
  bossWord: 'ジャック',
  aTiers: RAID_JACK_A_TIERS,
  bTiers: RAID_JACK_B_TIERS,
  tiers: raidJackTiers,
  tierAt: raidJackTierAt,
  afterBoss: RAID_JACK_PUMPKIN,
  afterBossBadge: 'あそびに来た',
  afterBossNote: '共有ライフは無限です。毎回ぜんかいのライフから戦い、与えたダメージが累計に足されます',
  lockedNote: '前の段階のジャックを倒すと姿をあらわします',
  lastTierWord: '大王',
  rankNote: '男爵〜公爵は倒れた時点、大王は期間の終わりに順位が決まります',
  endLabel: '11/1 4:00',
  rewards: RAID_JACK_REWARDS,
  freePerDay: RAID_JACK_FREE_PER_DAY,
  extraCost: RAID_JACK_EXTRA_COST_BEAT_P,
  turns: RAID_JACK_TURNS,
  storageKey: RAID_JACK_STORAGE_KEY,
  sources: Object.freeze([['all', '合計'], ['battle', 'バトル'], ['rhythm', 'モンヒロビート']]),
  windowAt: raidJackWindowAt,
  remaining: raidJackRemaining,
  bossDown: raidJackBossDown,
  loadState: raidJackLoadState,
  saveState: raidJackSaveState,
  flushPending: (meId) => raidJackFlushStoredPending(meId, RAID_JACK_EVENT.id),
  bossImg: () => JACK_IMG,
  afterBossImg: () => PUMPKIN_ICON_IMG,
  aura: true,
});
const RAID_EVENT_XMAS = Object.freeze({
  key: 'xmas',
  id: RAID_XMAS_EVENT.id,
  debugId: RAID_XMAS_EVENT.debugId,
  title: RAID_XMAS_EVENT.name,
  icon: '🎅',
  note: `全員で${RAID_XMAS_EVENT.name}を止めよう`,
  bossWord: RAID_XMAS_EVENT.name,
  aTiers: RAID_XMAS_A_TIERS,
  bTiers: RAID_XMAS_B_TIERS,
  tiers: raidXmasTiers,
  tierAt: raidXmasTierAt,
  afterBoss: RAID_XMAS_AFTER_BOSS,
  afterBossBadge: 'あそびに来た',     // 最後の段階のあとは正気に戻った普通のサンタ(ぱんぷきんと同じ形・社長決定 r1126-024)
  afterBossNote: '共有ライフは無限です。毎回いっぱいのライフから戦い、与えたダメージが累計に足されます',
  lockedNote: `前の段階の${RAID_XMAS_EVENT.name}を止めると姿を現します`,
  lastTierWord: '最後の段階',
  rankNote: '段階1〜4は倒れた時点、最後の段階は期間の終わりに順位が決まります',
  endLabel: '12/31 4:00',
  rewards: RAID_XMAS_REWARDS,
  freePerDay: RAID_XMAS_FREE_PER_DAY,
  extraCost: RAID_XMAS_EXTRA_COST_BEAT_P,
  turns: RAID_XMAS_TURNS,
  storageKey: RAID_XMAS_STORAGE_KEY,
  sources: Object.freeze([['all', '合計'], ['battle', 'バトル'], ['rhythm', 'モンヒロビート'], ['card', 'バトルカード']]),
  windowAt: raidXmasWindowAt,
  remaining: raidXmasRemaining,
  bossDown: raidXmasBossDown,
  loadState: raidXmasLoadState,
  saveState: raidXmasSaveState,
  flushPending: (meId) => raidXmasFlushStoredPending(meId),
  bossImg: () => RAID_XMAS_BOSS_IMG,
  afterBossImg: () => RAID_XMAS_SANTA_IMG,
  aura: false,
});
const raidEventDef = (key) => (key === 'xmas' ? RAID_EVENT_XMAS : RAID_EVENT_JACK);
const raidEventTierShort = (ev, tier) => raidEventShortName((ev || RAID_EVENT_JACK).bossWord, tier && tier.name);

// ---- ひとりで進める物語の進み具合(新しいキー mh_xmas_story_v1・台帳 r1126-006) ----
//  レイドの記録(mh_raid_xmas_v1)とは別のキー。ほかのキーには書かない(⑦)
const xmasStoryLoad = async () => {
  try { return xmasStoryNormalize(await storeGet(XMAS_STORY_STORAGE_KEY, null, false)); } catch (e) { return xmasStoryNormalize(null); }
};
const xmasStorySave = async (progress) => {
  try { await storeSet(XMAS_STORY_STORAGE_KEY, xmasStoryNormalize(progress), false); return true; } catch (e) { return false; }
};
// 開いた印(NEW を消す)。すでに付いていれば書かない
const xmasStoryMarkSeen = async (chapterId) => {
  const p = await xmasStoryLoad();
  if (p.seen.includes(chapterId) || !XMAS_STORY_CHAPTERS.some((c) => c.id === chapterId)) return p;
  const next = { ...p, seen: [...p.seen, chapterId] };
  await xmasStorySave(next);
  return next;
};
// 読んだ(戦う話は勝った)印。負けたときは何も書かない(何度でも挑める)
const xmasStoryMarkCleared = async (chapterId) => {
  const p = await xmasStoryLoad();
  if (!XMAS_STORY_CHAPTERS.some((c) => c.id === chapterId)) return { ok: false, progress: p };
  if (p.cleared.includes(chapterId)) return { ok: true, progress: p, already: true };
  const next = { ...p, cleared: [...p.cleared, chapterId], seen: p.seen.includes(chapterId) ? p.seen : [...p.seen, chapterId] };
  const ok = await xmasStorySave(next);
  return { ok, progress: ok ? next : p };
};
