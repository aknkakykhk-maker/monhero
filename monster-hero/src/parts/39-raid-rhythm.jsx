// ===== レイドバトルのモンヒロビート挑戦: イベントに縛られない作り(2026-11-25・台帳 r1119-172・ビート部) =====
// ジャック(ハロウィン)のとき 60-app.jsx に直書きしていた「回数を使う → 演奏 → ダメージの演出 → 送る → 結果」を、
// イベントごとの「つなぎ口(アダプタ)」を受け取る形にした。ジャックの動きは前と同じ(下の raidJackRhythmAdapter)。
// 新しいイベント(クリスマス raid_xmas_2026 の案)は、バトル部の定義(docs/progress/event-xmas-2026/BUILD.md)に合わせて
// アダプタを1つ足すだけで、曲えらびの帯・演出・送信・結果が動く。
//
// アダプタの形(ここで読むものだけ):
//   key            'jack' など。曲えらびの状態(raidRhythm.eventKey)に入れる
//   eventId        送る先のイベントid(デバッグで強制表示しているあいだは本番と別の id)
//   liveEventId    本番のイベントid(eventId がこれと違えば「デバッグの記録」)
//   screen         演奏を出ていったあとに戻る画面(gameState)
//   icon           曲えらびの帯の頭の絵文字
//   bossImg        演出に出すボスの絵(null ならジャックの絵とオーラ。37-raid-jack-aura.jsx の RaidJackDamageFx)
//   tierCount      段階の数
//   tierAt(i)      → { id, name, hp }
//   infiniteName   最後の段階を倒したあとの相手(共有ライフが無限)の名前
//   fetchTotals()  → 段階ごとの合計(取れないとき null)
//   doneOf(totals, i)      その段階へ与えたダメージの合計
//   infiniteAt(totals, i)  その段階が「倒したあとの無限の相手」か
//   useCount(nowMs)        → 'ok'(1回使った・デバッグで数えないときも ok) / 'none'(回数が無い) / 'saveFailed'(保存できない)
//   submit(run, hit, tier, defeated) → { outcome, opened }(本番の送信。デバッグの記録は別の id で送るだけ)
//   damageOf(result, difficulty)     省略するとジャックの式(35-raid-jack.jsx の raidJackRhythmDamageOf)
//   ── BUILD.md の形(クリスマスから。バトル部が App の中に作る3つの関数を受け取る)。あれば上の useCount / submit より先に使う ──
//   begin()                → { ok, hitId, eventId }(= raidXmasUseTry。回数を1回使う。デバッグ中は数えない・送る id も向こうが決める)
//   addDamage(input)       → 結果画面の中身(= raidXmasAddDamage。送る・倒した印・再送待ち・バトルの記録は全部向こう)
//   openResult(r)          (= openRaidXmasResult。レイドの結果画面を出す)
// ★保存データ(CLAUDE.md ⑦): ここは保存キーを持たない。回数・倒した印は各イベントのアダプタが自分のキーへ書く
//   (ジャックは mh_raid_jack_v1 のまま。新しいイベントは新しいキー)

const raidRhythmClampTier = (adapter, tierIndex) =>
  Math.min(Math.max(Math.floor(Number(tierIndex) || 0), 0), Math.max(0, (adapter && adapter.tierCount || 1) - 1));

// 1回の演奏のダメージ。イベントが式を持っていなければジャックの式
const raidRhythmDamageOf = (adapter, result, difficulty) =>
  adapter && typeof adapter.damageOf === 'function' ? adapter.damageOf(result, difficulty) : raidJackRhythmDamageOf(result, difficulty);

// 曲えらびの帯に出すもの
const raidRhythmBannerOf = (adapter, tierIndex) => adapter ? {
  icon: adapter.icon || '🎃',
  tierName: adapter.tierAt(raidRhythmClampTier(adapter, tierIndex)).name,
} : null;

// 演出で見せる「いまのボスのライフ」。演奏が始まる前から裏で取っておく(取れなくても演出は出す)
const raidRhythmLifeInfo = async (adapter, tierIndex, eventId) => {
  try {
    const totals = await Promise.race([adapter.fetchTotals(eventId), new Promise((resolve) => setTimeout(() => resolve(null), 4000))]);
    const tierDef = adapter.tierAt(tierIndex);
    const done = totals ? adapter.doneOf(totals, tierIndex) : 0;
    const pumpkin = adapter.infiniteAt(totals, tierIndex);
    return { lifeBefore: totals ? (pumpkin ? tierDef.hp : Math.max(0, tierDef.hp - done)) : null, pumpkin };
  } catch (e) { return null; }
};

// 1回の挑戦を始める(回数を使う)。使えたら run を返す。null のときは始めない(reason: 'none' / 'saveFailed')
const raidRhythmBeginRun = async (adapter, tierIndex, nowMs = Date.now()) => {
  let hitId = null;
  let eventId = adapter.eventId;
  if (typeof adapter.begin === 'function') {
    // BUILD.md の形: 回数を使えなかった(残りが無い・保存に失敗)ときは ok が偽。どちらか分からないので曲えらびへ戻す
    let t = null;
    try { t = await adapter.begin(); } catch (e) { t = null; }
    if (!t || t.ok !== true || typeof t.hitId !== 'string' || !t.hitId) return { run: null, reason: 'none' };
    hitId = t.hitId;
    if (typeof t.eventId === 'string' && t.eventId) eventId = t.eventId;
  } else {
    const used = await adapter.useCount(nowMs);
    if (used !== 'ok') return { run: null, reason: used === 'none' ? 'none' : 'saveFailed' };
    hitId = raidJackMakeHitId();
  }
  const run = { adapter, tierIndex: raidRhythmClampTier(adapter, tierIndex), hitId, eventId,
    finished: false, completing: false, promise: null, lifePromise: null };
  run.lifePromise = raidRhythmLifeInfo(adapter, run.tierIndex, eventId);
  return { run, reason: 'ok' };
};

// 演奏が終わった直後の演出(RaidJackDamageFx)に渡す中身
const raidRhythmFxOf = (run, info, result, difficulty) => {
  const adapter = run.adapter;
  const tier = adapter.tierAt(run.tierIndex);
  return { key: `${run.hitId}`, tierIndex: run.tierIndex, tierName: info && info.pumpkin ? adapter.infiniteName : tier.name,
    score: Math.max(0, Math.floor(Number(result && result.score) || 0)), damage: raidRhythmDamageOf(adapter, result, difficulty),
    assist: !!(result && result.assist === true),
    lifeBefore: info && Number.isFinite(info.lifeBefore) ? info.lifeBefore : null, max: tier.hp, pumpkin: !!(info && info.pumpkin),
    // 最後の段階を倒したあと(pumpkin)は、あとの姿の絵(クリスマスは普通のサンタ・r1126-024)。ジャックは null のまま(演出側でぱんぷきん)
    bossImg: (info && info.pumpkin && adapter.afterBossImg) ? adapter.afterBossImg : (adapter.bossImg || null) };
};

// 演奏が最後まで終わった: スコアをダメージに換えて、バトルと同じ表へ送る。戻り値は結果画面の中身
const raidRhythmFinish = async (run, result, song, difficulty) => {
  if (!run || run.finished) return null;
  run.finished = true;
  const adapter = run.adapter;
  const tier = adapter.tierAt(run.tierIndex);
  const score = Math.max(0, Math.floor(Number(result && result.score) || 0));
  const assist = !!(result && result.assist === true);
  const damage = raidRhythmDamageOf(adapter, result, difficulty);
  if (typeof adapter.addDamage === 'function') {
    // BUILD.md の形: 送る・倒した印・次の段階・再送待ち・バトルの記録は、バトル部の raidXmasAddDamage が全部やる
    const detail = { songName: song && song.displayName || '', difficultyName: difficulty && difficulty.id || '', score, assist };
    let res = null;
    try {
      // log: バトルの記録に送る物(ビートは編成が無いので score だけ・BUILD.md §3)
      res = await adapter.addDamage({ source: 'rhythm', kind: 'a', tierIndex: run.tierIndex, damage, hitId: run.hitId, eventId: run.eventId, detail, log: { score } });
    } catch (e) { res = null; }
    return { tierIndex: run.tierIndex, tierName: tier.name, damage, defeated: false, outcome: 'error', detail, ...(res || {}),
      way: 'rhythm', songName: detail.songName, difficultyName: detail.difficultyName, score, assist, eventId: run.eventId, eventKey: adapter.key };
  }
  // 倒しきったか: いまの共有ライフの残りと比べる。最後の段階を倒したあとの相手は共有ライフが無限なので、倒した扱いにしない
  let startLife = null;
  let pumpkin = false;
  try {
    const totals = await Promise.race([adapter.fetchTotals(run.eventId), new Promise((resolve) => setTimeout(() => resolve(null), 4000))]);
    const done = totals ? adapter.doneOf(totals, run.tierIndex) : 0;
    if (totals && tier.hp - done > 0) startLife = tier.hp - done;
    pumpkin = adapter.infiniteAt(totals, run.tierIndex);
  } catch (e) { startLife = null; }
  const defeated = !pumpkin && damage > 0 && startLife !== null && damage >= startLife;
  const hit = { hitId: run.hitId, kind: 'a', tier: run.tierIndex + 1, damage, defeated, source: 'rhythm' };
  let outcome = 'error';
  let opened = false;
  const isDebugRun = run.eventId !== adapter.liveEventId;
  try {
    if (damage <= 0) outcome = 'sent';   // 送るものが無い(アシストモードなど)
    else if (isDebugRun) {
      const breederId = await ensureBreederId();
      outcome = await sbSendRaidJackHit(hit, breederId, run.eventId);
    } else {
      const sent = await adapter.submit(run, hit, tier, defeated);
      outcome = sent.outcome; opened = !!sent.opened;
    }
    // バトルの1回ごとの記録(2026-10-21・下準備)。モンヒロビート挑戦は編成が無いので、段階と与ダメージだけ。印が偽のあいだは送らない
    if (RELEASE_FLAGS.battleLog === true && !isDebugRun && damage > 0) {
      try { void sbSendRaidBattleLog(buildRaidBattleLogRow({ score, raid: { event: run.eventId, kind: 'a', tier: run.tierIndex + 1, source: 'rhythm', damage, defeated } })); } catch {}
    }
  } catch (error) { outcome = 'error'; }
  return { way: 'rhythm', songName: song && song.displayName || '', difficultyName: difficulty && difficulty.id || '', score, assist,
    kind: 'a', tierIndex: run.tierIndex, tierName: pumpkin ? adapter.infiniteName : tier.name, reason: defeated ? 'defeated' : 'rhythm',
    damage, defeated, turns: 0, levelUps: 0, growths: 0, outcome, opened, eventId: run.eventId, quickAward: null,
    lifeLeft: Math.max(0, (startLife !== null ? startLife : tier.hp) - damage),
    // 結果画面の体力のバー(演奏前 → いま)。演奏前の体力が取れなかったときは出さない
    lifeBefore: startLife, lifeMax: tier.hp, pumpkin, eventKey: adapter.key };
};

// 最後まで遊ばなかった: 回数は使ったまま、ダメージは0(送らない)
const raidRhythmGiveUpResult = (run, adapter, tierIndex) => {
  const tier = adapter.tierAt(tierIndex);
  if (typeof adapter.openResult === 'function') {
    // BUILD.md の形(§3 の最後): 途中でやめた結果は { way, damage: 0, tierIndex, outcome: 'sent', detail }
    return { way: 'rhythm', damage: 0, tierIndex, tierName: tier.name, outcome: 'sent', reason: 'giveup', defeated: false,
      detail: { songName: '', difficultyName: '', score: 0, assist: false }, eventId: run ? run.eventId : adapter.eventId, eventKey: adapter.key };
  }
  return { way: 'rhythm', songName: '', difficultyName: '', score: 0, assist: false, kind: 'a', tierIndex, tierName: tier.name, reason: 'giveup', damage: 0, defeated: false,
    turns: 0, levelUps: 0, growths: 0, outcome: 'sent', opened: false, eventId: run ? run.eventId : adapter.eventId, quickAward: null, lifeLeft: tier.hp, eventKey: adapter.key };
};

// ---- ジャック(ハロウィン 2026)のつなぎ口。前に 60-app.jsx に直書きしていた処理をそのまま移した ----
// ctx = { eventId(本番 or デバッグの id), debugForce, realRules }
const raidJackRhythmAdapter = (ctx) => ({
  key: 'jack',
  eventId: raidJackSafeEventId(ctx.eventId),
  liveEventId: RAID_JACK_EVENT.id,
  screen: 'RAID_JACK',
  icon: '🎃',
  bossImg: null,
  tierCount: RAID_JACK_A_TIERS.length,
  tierAt: (i) => raidJackTierAt('a', i),
  infiniteName: RAID_JACK_PUMPKIN.name,
  fetchTotals: () => sbFetchRaidJackTierTotals(ctx.eventId),   // 前と同じく App の raidJackEventId で引く
  doneOf: (totals, i) => totals && totals.a && totals.a[i + 1] ? Number(totals.a[i + 1].total) || 0 : 0,
  infiniteAt: (totals, i) => i === RAID_JACK_A_TIERS.length - 1 && raidJackBossDown(totals),
  // 回数はバトルと同じもの。デバッグの強制表示中は数えない(startRaidJackFromPrep と同じ)
  useCount: async (nowMs) => {
    if (ctx.debugForce && !ctx.realRules) return 'ok';
    const state = await raidJackLoadState();
    const side = state.a;
    const today = raidJackDayKey(nowMs);
    if (side.day !== today) { side.day = today; side.used = 0; side.extra = 0; }
    if (raidJackRemaining(side, nowMs) <= 0) return 'none';
    side.used += 1;
    if (!(await raidJackSaveState(state))) return 'saveFailed';   // 保存できないときは始めない(回数だけ減る事故を作らない)
    return 'ok';
  },
  submit: async (run, hit, tier, defeated) => {
    let next = await raidJackLoadState();
    const side = next.a;
    const before = raidJackUnlockedCount('a', side.defeated);
    if (defeated && !side.defeated.includes(tier.id)) side.defeated = [...side.defeated, tier.id];
    const opened = raidJackUnlockedCount('a', side.defeated) > before;
    const breederId = await ensureBreederId();
    const sent = await raidJackSubmitHit(next, hit, breederId, run.eventId);
    next = sent.state;
    await raidJackSaveState(next);
    return { outcome: sent.outcome, opened };
  },
});

// ---- クリスマス(2026)のつなぎ口。docs/progress/event-xmas-2026/BUILD.md §1〜§4 の名前と形 ----
// バトル部の定義(35-raid-xmas.jsx)と App の中の関数は、App から ctx で渡してもらう(ここからは直接さわらない):
// ctx = { event: RAID_XMAS_EVENT, tiers: RAID_XMAS_A_TIERS, tierAt: (i) => raidXmasTierAt('a', i), bossImg: RAID_XMAS_BOSS_IMG, afterBossImg: RAID_XMAS_SANTA_IMG,
//         damageOf: raidXmasRhythmDamageOf, useTry: raidXmasUseTry, addDamage: raidXmasAddDamage, openResult: openRaidXmasResult,
//         bossDown: raidXmasBossDown, screen: 'RAID_JACK'(ジャックと同じ画面), infiniteName: RAID_XMAS_AFTER_BOSS.name }
// 演出のライフは、ジャックと同じ表(raid_jack_hits)を event_id で引く(BUILD.md §7)
const raidXmasRhythmAdapter = (ctx) => {
  const ev = ctx.event || {};
  const tiers = Array.isArray(ctx.tiers) ? ctx.tiers : [];
  const last = Math.max(0, tiers.length - 1);
  return {
    key: 'xmas',
    eventId: typeof ev.id === 'string' ? ev.id : '',
    liveEventId: typeof ev.id === 'string' ? ev.id : '',
    screen: ctx.screen || 'RAID_JACK',
    icon: '🎄',
    bossImg: ctx.bossImg || null,
    afterBossImg: ctx.afterBossImg || null,
    tierCount: tiers.length || 1,
    tierAt: (i) => (typeof ctx.tierAt === 'function' ? ctx.tierAt(i) : tiers[i]) || { id: '', name: '', hp: 0 },
    infiniteName: ctx.infiniteName || '',
    fetchTotals: (eventId) => sbFetchRaidJackTierTotals(eventId || ev.id),
    doneOf: (totals, i) => totals && totals.a && totals.a[i + 1] ? Number(totals.a[i + 1].total) || 0 : 0,
    // 最後の段階を倒したか(raidXmasBossDown)。無ければ、最後の段階の合計が体力に届いたか
    infiniteAt: (totals, i) => i === last && !!totals && (typeof ctx.bossDown === 'function' ? !!ctx.bossDown(totals)
      : (!!ctx.infiniteName && !!totals.a && !!totals.a[last + 1] && (Number(totals.a[last + 1].total) || 0) >= (Number((tiers[last] || {}).hp) || Infinity))),
    damageOf: typeof ctx.damageOf === 'function' ? ctx.damageOf : undefined,
    begin: ctx.useTry,
    addDamage: ctx.addDamage,
    openResult: ctx.openResult,
  };
};

// イベントの鍵 → つなぎ口
const RAID_RHYTHM_ADAPTERS = Object.freeze({
  jack: raidJackRhythmAdapter,
  xmas: raidXmasRhythmAdapter,
});
const raidRhythmAdapter = (key, ctx) => {
  const make = RAID_RHYTHM_ADAPTERS[key] || RAID_RHYTHM_ADAPTERS.jack;
  return make(ctx || {});
};
