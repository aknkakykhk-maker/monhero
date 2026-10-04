// ジャックの報酬(35-raid-jack.jsx の表・36-raid-jack-api.jsx の受け取り判定)と魂格の結晶を、実際に動かして確かめる。
//
// 見るもの
//   ① 報酬の表が設計書(docs/spec/RAID_BOSS_JACK.md「報酬の表」)と同じ数字・同じ形(A討伐5・A順位5×5・B討伐5・B最終5・参加賞)
//   ② 順位は上の人ほど多い(減っていく)。ギフトの中身(ダイヤ・プシュケー・アイテムid)と受け取り済みのidが決まりどおり
//   ③ 受け取り判定: 参加賞・A討伐・A順位(男爵〜公爵は倒れたとき/大王は期間終了)・B討伐・B最終(期間終了)。受け取り済みと「入っていなかった」印は再び出さない
//   ④ 魂格の結晶: 使うとボーナス魂格Pが増え、所持が減る。0のときは保存しない・旧セーブは0・転生で維持・再編の書では消えない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const defs = read('monster-hero/src/parts/35-raid-jack.jsx');
const api = read('monster-hero/src/parts/36-raid-jack-api.jsx');
const BID = 'breeder-aaaa1111';

const make = () => {
  const store = {};
  const live = { totals: { a: {}, b: {} }, self: { a: {}, bTotal: 0 }, tops: {}, defeats: [], offline: false };
  const url2rows = (url) => {
    const u = decodeURIComponent(url);
    if (/raid_jack_tier_totals/.test(u)) {
      const rows = [];
      ['a', 'b'].forEach((k) => Object.entries(live.totals[k]).forEach(([tier, v]) => rows.push({ kind: k, tier: Number(tier), total_damage: v.total, player_count: v.players || 1, any_defeated: !!v.defeated })));
      return rows;
    }
    if (/raid_jack_contributions\?.*breeder_id=eq\./.test(u)) {
      const rows = Object.entries(live.self.a).map(([tier, total]) => ({ kind: 'a', tier: Number(tier), total_damage: total }));
      if (live.self.bTotal > 0) rows.push({ kind: 'b', tier: 1, total_damage: live.self.bTotal });
      return rows;
    }
    if (/raid_jack_hits\?.*defeated=eq\.true/.test(u)) return (live.defeats || []).map((x) => ({ kind: x[0], tier: Number(x.slice(1)) }));
    const mt = /raid_jack_contributions\?.*kind=eq\.a&tier=eq\.(\d)/.exec(u);
    if (mt) return (live.tops['a' + mt[1]] || []).map((b) => ({ breeder_id: b, total_damage: 1 }));
    if (/raid_jack_b_ranking/.test(u)) return (live.tops.b || []).map((b) => ({ breeder_id: b, total_damage: 1 }));
    return [];
  };
  const ctx = {
    console, Object, Number, Math, Array, JSON, String, Boolean, Date, isNaN, Promise, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout,
    AbortController, RegExp, Error, Set,
    SUPABASE_URL: 'https://example.supabase.co', SB_HEADERS: {}, BUILD_DATE: '2026-10-04 12:00',
    _isMissingTableError: () => false,
    SOUL_CRYSTAL_ITEM_ID: 'soul_crystal', RAINBOW_TRANSCEND_FRUIT_ITEM_ID: 'transcend_fruit_rainbow', HERO_PROOF_ITEM_ID: 'hero_proof',
    storeGet: async (k, d) => (k in store ? store[k] : d), storeSet: async (k, v) => { store[k] = v; return true; },
    fetch: async (url) => live.offline ? ({ ok: false, status: 500, text: async () => '', headers: { get: () => null } }) : ({ ok: true, status: 200, text: async () => JSON.stringify(url2rows(url)), headers: { get: () => null } }),
  };
  vm.createContext(ctx);
  vm.runInContext(`${defs}\n${api}
    this.o={RAID_JACK_EVENT,RAID_JACK_REWARDS,RAID_JACK_A_TIERS,RAID_JACK_B_TIERS,raidJackRewardParts,raidJackRewardText,raidJackRewardGiftItems,raidJackClaimId,raidJackNoneId,raidJackRewardTitle,raidJackCollectDueRewards,raidJackRepairState,raidJackDefaultState,raidJackNormalizeState};`, ctx);
  return { ctx, o: ctx.o, live };
};

(async () => {
  const t = make();
  const R = t.o.RAID_JACK_REWARDS;

  // ① 表の形と数字(設計書と同じ)
  const rows = (arr) => arr.map((r) => `${r.diamond}/${r.psyche}/${r.crystal}/${r.fruit}/${r.proof}`).join(' ');
  check('参加賞は ダイヤ30,000・プシュケー50', R.participation.diamond === 30000 && R.participation.psyche === 50 && R.participation.crystal === 0);
  check('A討伐は5段階', R.aClear.length === 5);
  check('A討伐の数字(設計書)', rows(R.aClear) === '100000/50/0/0/0 200000/60/0/0/0 300000/70/0/0/0 400000/80/0/0/0 1000000/100/0/0/5');
  check('A順位は 5段階×5位', R.aRank.length === 5 && R.aRank.every((tier) => tier.length === 5));
  check('A順位 男爵', rows(R.aRank[0]) === '1000000/3000/3/50/0 800000/2500/2/40/0 600000/2000/2/30/0 400000/1500/1/20/0 200000/1000/1/10/0');
  check('A順位 子爵', rows(R.aRank[1]) === '2000000/6000/6/100/0 1600000/5000/4/80/0 1200000/4000/4/60/0 800000/3000/2/40/0 400000/2000/2/20/0');
  check('A順位 伯爵', rows(R.aRank[2]) === '3000000/8000/8/150/5 2400000/6500/6/120/4 1800000/5000/5/100/3 1200000/4000/3/80/2 600000/3000/2/60/1');
  check('A順位 公爵', rows(R.aRank[3]) === '5000000/12000/12/250/10 4000000/10000/10/200/8 3000000/8000/8/150/6 2000000/6000/6/100/4 1000000/4000/4/50/2');
  check('A順位 大王', rows(R.aRank[4]) === '6000000/14000/15/300/15 5000000/12000/12/250/12 4000000/10000/10/200/9 3000000/8000/8/150/6 2000000/6000/6/100/3');
  check('B討伐は5難易度', rows(R.bClear) === '1000000/5000/1/20/0 2000000/7000/2/40/5 3000000/9000/3/60/10 4000000/11000/4/80/15 5000000/13000/5/100/20');
  check('B最終順位は1〜5位・ダイヤとプシュケーなし', rows(R.bFinal) === '0/0/25/100/10 0/0/20/90/8 0/0/15/80/6 0/0/10/70/4 0/0/5/60/2');
  // ② 順位が下がると報酬が減る(同点なし・増えない)
  const nonIncreasing = (arr) => arr.every((r, i) => i === 0 || ['diamond', 'psyche', 'crystal', 'fruit', 'proof'].every((k) => r[k] <= arr[i - 1][k]));
  check('順位が下がると報酬は増えない(A順位・B最終)', R.aRank.every(nonIncreasing) && nonIncreasing(R.bFinal));
  check('段階が上がると討伐報酬は増えない向きにならない(A討伐・B討伐は増える)', R.aClear.every((r, i) => i === 0 || r.diamond > R.aClear[i - 1].diamond) && R.bClear.every((r, i) => i === 0 || r.diamond > R.bClear[i - 1].diamond));
  check('表は凍結されている', Object.isFrozen(R) && Object.isFrozen(R.aRank[0][0]));
  const gift = t.o.raidJackRewardGiftItems(R.aRank[4][0]);
  check('ギフトの中身(大王1位)', JSON.stringify(gift) === JSON.stringify([
    { type: 'diamond', amount: 6000000 }, { type: 'rainbowPsyche', amount: 14000 },
    { type: 'gameItem', itemId: 'soul_crystal', amount: 15 }, { type: 'gameItem', itemId: 'transcend_fruit_rainbow', amount: 300 }, { type: 'gameItem', itemId: 'hero_proof', amount: 15 },
  ]), JSON.stringify(gift));
  check('0は出さない(B最終はダイヤ・プシュケーなし)', t.o.raidJackRewardGiftItems(R.bFinal[0]).every((g) => g.type === 'gameItem'));
  check('表示の文', /💎 ダイヤ×30,000 ／ 💗 虹のプシュケー×50/.test(t.o.raidJackRewardText(R.participation)), t.o.raidJackRewardText(R.participation));
  check('受け取り済みの印のid', t.o.raidJackClaimId('clear_a', 0) === 'clear_a1' && t.o.raidJackClaimId('rank_a', 4) === 'rank_a5' && t.o.raidJackClaimId('clear_b', 2) === 'clear_b3' && t.o.raidJackClaimId('final_b') === 'final_b' && t.o.raidJackClaimId('part_a') === 'part_a');
  const allIds = new Set([...[0, 1, 2, 3, 4].flatMap((i) => [t.o.raidJackClaimId('clear_a', i), t.o.raidJackClaimId('rank_a', i), t.o.raidJackClaimId('clear_b', i), t.o.raidJackNoneId(t.o.raidJackClaimId('rank_a', i))]), 'part_a', 'part_b', 'final_b', 'final_b_none']);
  check('印の数は保存の上限(64)に収まる', allIds.size <= 64, String(allIds.size));

  // ③ 受け取り判定(通信は差し替える)
  const run = async (opts) => {
    const m = make();
    const hpA = m.o.RAID_JACK_A_TIERS.map((x) => x.hp);
    (opts.defeatedA || []).forEach((i) => { m.live.totals.a[i + 1] = { total: hpA[i], players: 3, defeated: true }; });
    m.live.self = { a: opts.selfA || {}, bTotal: opts.selfB || 0 };
    m.live.tops = opts.tops || {};
    const state = m.o.raidJackNormalizeState({ a: {}, b: { defeated: opts.bDefeated || [] }, claimed: opts.claimed || [] });
    return m.o.raidJackCollectDueRewards(state, BID, 'raid_jack_2026', opts.now);
  };
  const open = Date.parse('2026-10-20T12:00:00+09:00');
  const after = Date.parse('2026-11-01T05:00:00+09:00');
  const before = Date.parse('2026-10-01T12:00:00+09:00');
  const ids = (r) => r.due.map((d) => d.id).sort().join(',');

  let r = await run({ now: before, selfA: { 1: 100 } });
  check('始まる前は何も出さない', r.ok && r.due.length === 0);
  r = await run({ now: open, selfA: { 1: 100 }, selfB: 0 });
  check('Aに1回でも与えたら参加賞(A)だけ', ids(r) === 'part_a', ids(r));
  r = await run({ now: open, selfA: {}, selfB: 5 });
  check('Bに1回でも与えたら参加賞(B)だけ', ids(r) === 'part_b', ids(r));
  r = await run({ now: open, selfA: { 1: 100 }, defeatedA: [0], tops: { a1: ['x', BID] } });
  check('男爵が倒れていて自分が与えていれば 討伐報酬+順位(2位)', ids(r) === 'clear_a1,part_a,rank_a1', ids(r));
  const rank = r.due.find((d) => d.id === 'rank_a1');
  check('順位は上位5人の並びどおり(2位の報酬)', rank && JSON.stringify(rank.reward) === JSON.stringify(R.aRank[0][1]) && /貢献2位/.test(rank.title), rank && rank.title);
  r = await run({ now: open, selfA: { 2: 100 }, defeatedA: [0], tops: { a1: ['x'] } });
  check('倒れた段階に与えていない人には討伐報酬を出さない', ids(r) === 'part_a', ids(r));
  r = await run({ now: open, selfA: { 1: 100 }, defeatedA: [0], tops: { a1: ['x', 'y', 'z', 'w', 'v'] } });
  check('上位5人にいなければ順位報酬は出ず「入っていなかった」印だけ', ids(r) === 'clear_a1,part_a' && r.noneIds.join() === 'rank_a1_none', `${ids(r)} / ${r.noneIds}`);
  r = await run({ now: open, selfA: { 1: 100 }, defeatedA: [0], tops: { a1: [BID] }, claimed: ['part_a', 'clear_a1', 'rank_a1'] });
  check('受け取り済みは出さない', r.due.length === 0 && r.noneIds.length === 0);
  r = await run({ now: open, selfA: { 1: 100 }, defeatedA: [0], tops: { a1: ['x'] }, claimed: ['part_a', 'clear_a1', 'rank_a1_none'] });
  check('「入っていなかった」印があれば問い合わせ直さない', r.due.length === 0 && r.noneIds.length === 0);
  r = await run({ now: open, selfA: { 5: 100 }, defeatedA: [4], tops: { a5: [BID] } });
  check('大王は倒れても期間中は順位報酬を出さない(討伐・参加賞だけ)', ids(r) === 'clear_a5,part_a', ids(r));
  r = await run({ now: after, selfA: { 5: 100 }, defeatedA: [4], tops: { a5: ['x', 'y', BID] } });
  check('大王は期間終了のあと、順位報酬(3位)', ids(r) === 'clear_a5,part_a,rank_a5' && JSON.stringify(r.due.find((d) => d.id === 'rank_a5').reward) === JSON.stringify(R.aRank[4][2]), ids(r));
  r = await run({ now: open, selfA: {}, selfB: 9, bDefeated: ['b1', 'b3'] });
  check('Bは倒した難易度の初討伐報酬', ids(r) === 'clear_b1,clear_b3,part_b', ids(r));
  r = await run({ now: open, selfB: 9, tops: { b: [BID] } });
  check('B最終順位は期間中は出さない', !ids(r).includes('final_b'));
  r = await run({ now: after, selfB: 9, tops: { b: [BID] } });
  check('B最終順位は期間終了のあと(1位)', ids(r) === 'final_b,part_b' && JSON.stringify(r.due.find((d) => d.id === 'final_b').reward) === JSON.stringify(R.bFinal[0]), ids(r));
  r = await run({ now: after, selfB: 9, tops: { b: ['x', 'y', 'z', 'w', 'v'] } });
  check('B最終順位に入っていなければ印だけ', ids(r) === 'part_b' && r.noneIds.join() === 'final_b_none');
  r = await run({ now: after, selfB: 0, tops: { b: [BID] } });
  check('Bに与えていなければ最終順位の報酬は出ない', ids(r) === '');

  // ⑤ 端末の「倒した」印の修復(デバッグで付いた印を、サーバーの本番の記録と突き合わせる)
  {
    const polluted = (m) => m.o.raidJackNormalizeState({ a: { defeated: ['a1'] }, b: { defeated: ['b1', 'b2', 'b3'], total: 5000 }, claimed: [] });
    let m = make();
    m.live.self = { a: {}, bTotal: 0 };
    let r = await m.o.raidJackRepairState(polluted(m), BID, 'raid_jack_2026');
    check('サーバーに本番の「倒した」が無ければ、デバッグで付いた印(a1・b1〜b3)を全部外し、累計も0へ戻す', JSON.stringify(r.state.a.defeated) === '[]' && JSON.stringify(r.state.b.defeated) === '[]' && r.state.b.total === 0 && r.state.repaired === true && r.changed === true, JSON.stringify(r.state));
    m = make(); m.live.defeats = ['b1', 'a1']; m.live.self = { a: { 1: 10 }, bTotal: 777 };
    r = await m.o.raidJackRepairState(polluted(m), BID, 'raid_jack_2026');
    check('本番で本当に倒した段階(サーバーに記録あり)は残し、累計はサーバーの値にそろえる', JSON.stringify(r.state.b.defeated) === '["b1"]' && JSON.stringify(r.state.a.defeated) === '["a1"]' && r.state.b.total === 777, JSON.stringify(r.state.b));
    m = make(); m.live.self = { a: {}, bTotal: 0 };
    const withPending = m.o.raidJackNormalizeState({ a: {}, b: { defeated: ['b2'], total: 0 }, claimed: [], pending: [{ hitId: 'pending-aaaa01', kind: 'b', tier: 2, damage: 500, defeated: true }] });
    r = await m.o.raidJackRepairState(withPending, BID, 'raid_jack_2026');
    check('まだ送れていない再送待ちの「倒した」は、残す(累計にも足す)', JSON.stringify(r.state.b.defeated) === '["b2"]' && r.state.b.total === 500, JSON.stringify(r.state.b));
    m = make(); m.live.offline = true;
    r = await m.o.raidJackRepairState(polluted(m), BID, 'raid_jack_2026');
    check('通信できないときは何も変えない(直しは次の機会へ・repaired も立てない)', r.changed === false && r.state.repaired === false && r.state.b.defeated.length === 3);
    m = make(); m.live.self = { a: {}, bTotal: 0 };
    const done = m.o.raidJackNormalizeState({ a: {}, b: { defeated: ['b1'], total: 9 }, claimed: [], repaired: true });
    r = await m.o.raidJackRepairState(done, BID, 'raid_jack_2026');
    check('直し済み(repaired)なら、もう走らない(本番で倒した印を消さない)', r.changed === false && r.state.b.defeated.length === 1);
    const claimedKept = await (async () => { const mm = make(); mm.live.self = { a: {}, bTotal: 0 }; const rr = await mm.o.raidJackRepairState(mm.o.raidJackNormalizeState({ a: {}, b: { defeated: ['b1'] }, claimed: ['clear_b1', 'part_b'] }), BID, 'raid_jack_2026'); return rr.state.claimed.join(); })();
    check('修復しても claimed はそのまま', claimedKept === 'clear_b1,part_b', claimedKept);
  }

  // ④ 魂格の結晶(本物の関数を動かす)
  const { loadDyeModule } = require('../harness');
  const h = loadDyeModule();
  const base = h.normalizeMasuProgression({ id: 'm1', baseId: 'Snegurochka', name: 'テスト', transcended: true, soulRankStage: 1, levelCap: 600, soulPointMaxReachedLevel: 600, soulTraitLevels: {}, bondXp: h.totalBondXpForLevel(600), rebirthCount: 35, distAptPoints: 0, distAptBoosts: [0, 0, 0, 0], statPoints: { hp: 0, atk: 0, def: 0, guts: 0 } });
  check('旧セーブ(項目なし)はボーナス0・保存しない', h.normalizeSoulBonusPoints(undefined) === 0 && !('soulBonusPoints' in base) && h.soulPointEarned(base) === 100);
  check('壊れた値は0(負・文字・NaN・小数)', [-5, 'x', NaN, null, {}, 0.4].every((v) => h.normalizeSoulBonusPoints(v) === 0) && h.normalizeSoulBonusPoints(7.9) === 7);
  const items = { soul_crystal: 25, keep: 3 };
  const used = h.buildSoulCrystalUse(base, items, 10);
  check('10個使うと ボーナス+10・所持25→15・ほかは変えない', used.ok && used.nextMasu.soulBonusPoints === 10 && used.ownedItems.soul_crystal === 15 && used.ownedItems.keep === 3);
  check('入力は壊さない', items.soul_crystal === 25 && !('soulBonusPoints' in base));
  check('獲得済み魂格Pは 導出分+ボーナス分(100+10)', h.soulPointEarned(used.nextMasu) === 110);
  check('正規化を通しても保存される・0のときは出ない', h.normalizeMasuProgression(used.nextMasu).soulBonusPoints === 10 && !('soulBonusPoints' in h.normalizeMasuProgression({ ...used.nextMasu, soulBonusPoints: 0 })));
  check('所持を超える個数は所持まで(25個で100個指定)', h.buildSoulCrystalUse(base, items, 100).quantity === 25 && h.buildSoulCrystalUse(base, items, 100).nextMasu.soulBonusPoints === 25);
  check('所持0なら使えず、何にも触れない', !h.buildSoulCrystalUse(base, { soul_crystal: 0 }, 1).ok && !h.buildSoulCrystalUse(null, items, 1).ok);
  check('上限なし(何度使っても足される)', h.buildSoulCrystalUse(h.buildSoulCrystalUse(base, { soul_crystal: 500 }, 500).nextMasu, { soul_crystal: 500 }, 500).nextMasu.soulBonusPoints === 1000);
  const reborn = h.resetMasuForRebirth(used.nextMasu);
  check('転生でボーナス分は残る', reborn && reborn.soulBonusPoints === 10, JSON.stringify(reborn && reborn.soulBonusPoints));
  const spentMasu = h.normalizeMasuProgression({ ...used.nextMasu, soulTraitLevels: { attack_power: 3 } });
  const reset = h.buildMasuSoulTraitReset(spentMasu);
  check('魂格再編の書でも、ボーナス分は消えない', !reset || reset.nextMasu.soulBonusPoints === 10);
  check('結晶のアイテム定義(名前・使う場所)', h.SOUL_CRYSTAL_ITEM.name === '魂格の結晶' && h.SOUL_CRYSTAL_ITEM.usage === 'soulCrystal' && h.SOUL_CRYSTAL_ITEM_ID === 'soul_crystal');

  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
