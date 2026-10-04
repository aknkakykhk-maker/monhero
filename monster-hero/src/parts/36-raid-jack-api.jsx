// ===== イベント・レイドボス「ジャック」の通信層(Supabase の raid_jack_hits とビュー3つ) =====
// 設計の正本: docs/spec/RAID_BOSS_JACK.md / SQL: docs/sql/raid/
//
// 決めごと:
//  ・既存の保存データ(mh_*)・ランキング(rankings 等)・breeder_profiles には一度も書き込まない。
//    書くのは新設の raid_jack_hits(1戦の与ダメージを1行)だけ。端末の保存も新しいキー mh_raid_jack_v1 だけ。
//  ・同じ hit_id を2回送っても1行しか入らない(on_conflict=hit_id・ignore-duplicates)。だから再送してよい。
//  ・送れなかった与ダメージは mh_raid_jack_v1 の pending に残し、あとで送り直す(最大30件)。
//  ・表がまだ無い環境(SQL未適用)は「準備中」として扱う。エラー扱いにして画面を壊さない。
//  ・このファイルは公開フラグ(RELEASE_FLAGS.raidJack)を見ない。呼ぶ側が見る。
const RAID_JACK_TIMEOUT_MS = 8000;
let _raidJackUnavailable = false;                  // 土台の表(raid_jack_hits)・段階の合計が無いと分かったら、ページを閉じるまで全部使わない
const raidJackUnavailable = () => _raidJackUnavailable;
// 後から足した「ランキングのビュー」だけが無いときは、そのビューだけを「準備中」にして、与ダメージの送信・段階の合計・報酬の受け取りは止めない。
// (以前は、どれか1つでも無いと全部が止まった。大王のあとの累計ダメージのビュー raid_jack_a_ranking が未適用のとき、一覧を開いただけで通信が全部止まる)
const _raidJackUnavailableScopes = new Set();
const RAID_JACK_ESSENTIAL_SCOPES = Object.freeze(['raid_jack_hits', 'raid_jack_tier_totals']);
const raidJackScopeOf = (pathAndQuery) => String(pathAndQuery || '').split('?')[0];

const raidJackSafeId = (value) => (typeof value === 'string' && /^[0-9A-Za-z_-]{8,100}$/.test(value)) ? value : '';
// 端末が作る一意のID(8〜64文字の英数字と - _)。同じ1戦の再送には同じIDを使い回す
const raidJackMakeHitId = (nowMs = Date.now()) => {
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `rj${Math.floor(nowMs).toString(36)}${rand}`.slice(0, 64);
};
// デバッグ画面は別のイベントID(RAID_JACK_DEBUG_EVENT_ID)で送り、本番の集計(raid_jack_2026)を汚さない
const RAID_JACK_DEBUG_EVENT_ID = 'raid_jack_debug';
const raidJackSafeEventId = (id) => (typeof id === 'string' && /^[0-9A-Za-z_-]{1,40}$/.test(id)) ? id : RAID_JACK_EVENT.id;
const raidJackEventParam = (eventId) => `event_id=eq.${encodeURIComponent(raidJackSafeEventId(eventId))}`;

// 通信の共通部分。返り値 { ok, status, body, notReady, error }
const raidJackRequest = async (pathAndQuery, init = {}) => {
  const scope = raidJackScopeOf(pathAndQuery);
  if (_raidJackUnavailable || _raidJackUnavailableScopes.has(scope)) return { ok: false, status: 0, body: '', notReady: true, error: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAID_JACK_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      cache: 'no-store', ...init, headers: { ...SB_HEADERS, ...(init.headers || {}) }, signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok && (_isMissingTableError(res.status, body) || res.status === 404)) {
      if (RAID_JACK_ESSENTIAL_SCOPES.includes(scope)) _raidJackUnavailable = true; else _raidJackUnavailableScopes.add(scope);
      return { ok: false, status: res.status, body, notReady: true, error: null };
    }
    return { ok: res.ok, status: res.status, body, notReady: false, error: null, headers: res.headers };
  } catch (error) {
    return { ok: false, status: 0, body: '', notReady: false, error };
  } finally {
    clearTimeout(timer);
  }
};
const raidJackParseRows = (result) => {
  if (!result || !result.ok) return null;
  try { const rows = JSON.parse(result.body); return Array.isArray(rows) ? rows : null; } catch (e) { return null; }
};

// 1戦の与ダメージを送る。hit = { hitId, kind, tier, damage, defeated }
// 返り値: 'sent' / 'notready'(表が無い) / 'invalid'(形が違う・送らない) / 'error'(あとで送り直す)
const sbSendRaidJackHit = async (hit, breederId, eventId) => {
  const id = raidJackSafeId(breederId);
  const [clean] = raidJackNormalizePending([hit]);
  if (!id || !clean) return 'invalid';
  const row = {
    hit_id: clean.hitId, event_id: raidJackSafeEventId(eventId), kind: clean.kind, tier: clean.tier,
    breeder_id: id, damage: clean.damage, defeated: clean.defeated,
    app_build: typeof BUILD_DATE === 'string' ? BUILD_DATE.replace(/[^0-9]/g, '').slice(0, 12) : '',
  };
  const result = await raidJackRequest('raid_jack_hits?on_conflict=hit_id', {
    method: 'POST', headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(row),
  });
  if (result.ok) return 'sent';
  if (result.notReady) return 'notready';
  // 形がサーバーの決まりに合わない(400・409・422)は、何度送っても通らないので捨てる
  if ([400, 409, 422].includes(result.status)) return 'invalid';
  return 'error';
};

const raidJackLoadState = async () => {
  try { return raidJackNormalizeState(await storeGet(RAID_JACK_STORAGE_KEY, null, false)); } catch (e) { return raidJackDefaultState(); }
};
const raidJackSaveState = async (state) => {
  try { await storeSet(RAID_JACK_STORAGE_KEY, raidJackNormalizeState(state), false); return true; } catch (e) { return false; }
};

// 送る。送れなければ pending に残す(戻り値は送れたかどうか)。state は呼び出し側が持つ最新を渡し、更新後を返す
const raidJackSubmitHit = async (state, hit, breederId, eventId) => {
  const next = raidJackNormalizeState(state);
  const outcome = await sbSendRaidJackHit(hit, breederId, eventId);
  if (outcome === 'error' || outcome === 'notready') {
    const [clean] = raidJackNormalizePending([hit]);
    if (clean && !next.pending.some((p) => p.hitId === clean.hitId)) next.pending = [...next.pending, clean].slice(-30);
  }
  return { state: next, outcome };
};
// 再送待ちを送り直す。送れた・捨てるべきものを取り除いた状態を返す
const raidJackFlushPending = async (state, breederId, eventId) => {
  const next = raidJackNormalizeState(state);
  if (!next.pending.length || !raidJackSafeId(breederId)) return next;
  const keep = [];
  for (const hit of next.pending) {
    const outcome = await sbSendRaidJackHit(hit, breederId, eventId);
    if (outcome === 'error' || outcome === 'notready') keep.push(hit);
  }
  next.pending = keep;
  return next;
};

// ---- 読み出し(失敗は null を返し、画面は「準備中」にする) ----
// 段階ごとの合計。返り値 { a: { 1: {total, players, defeated}, ... }, b: {...} } か null
const sbFetchRaidJackTierTotals = async (eventId) => {
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_tier_totals?${raidJackEventParam(eventId)}&select=kind,tier,total_damage,player_count,any_defeated`));
  if (!rows) return null;
  const out = { a: {}, b: {} };
  rows.forEach((r) => {
    if ((r.kind !== 'a' && r.kind !== 'b') || !Number.isFinite(Number(r.tier))) return;
    out[r.kind][Number(r.tier)] = { total: Number(r.total_damage) || 0, players: Number(r.player_count) || 0, defeated: r.any_defeated === true };
  });
  return out;
};
// A: 段階ごとの貢献ランキング(上位 limit)
const sbFetchRaidJackContributions = async (tier, limit = 100, eventId) => {
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 200);
  const t = Math.min(Math.max(Math.floor(Number(tier)) || 1, 1), 5);
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_contributions?${raidJackEventParam(eventId)}&kind=eq.a&tier=eq.${t}&select=breeder_id,total_damage,last_hit_at&order=total_damage.desc,last_hit_at.asc&limit=${n}`));
  return rows ? rows.map((r) => ({ breederId: String(r.breeder_id), total: Number(r.total_damage) || 0 })) : null;
};
// B: 累計ダメージのランキング(上位 limit。既定100)
const sbFetchRaidJackBRanking = async (limit = 100, eventId) => {
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 200);
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_b_ranking?${raidJackEventParam(eventId)}&select=breeder_id,total_damage,last_hit_at&order=total_damage.desc,last_hit_at.asc&limit=${n}`));
  return rows ? rows.map((r) => ({ breederId: String(r.breeder_id), total: Number(r.total_damage) || 0 })) : null;
};
// A: 大王を倒したあとの「累計ダメージ」ランキング(全段階の与ダメージの合計・上位 limit)。
// サーバーのビュー raid_jack_a_ranking(docs/sql/raid/RAID_JACK_A_RANKING.sql)。まだ無い間は null を返し、画面は「準備中」にする
const sbFetchRaidJackARanking = async (limit = 100, eventId) => {
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 200);
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_a_ranking?${raidJackEventParam(eventId)}&select=breeder_id,total_damage,last_hit_at&order=total_damage.desc,last_hit_at.asc&limit=${n}`));
  return rows ? rows.map((r) => ({ breederId: String(r.breeder_id), total: Number(r.total_damage) || 0 })) : null;
};
// 自分の貢献(A: 段階ごと / B: 累計)。圏外でも自分の数字と順位(=自分より多い人数+1)が出せる
const sbFetchRaidJackSelf = async (breederId, eventId) => {
  const id = raidJackSafeId(breederId);
  if (!id) return null;
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_contributions?${raidJackEventParam(eventId)}&breeder_id=eq.${id}&select=kind,tier,total_damage`));
  if (!rows) return null;
  const out = { a: {}, bTotal: 0 };
  rows.forEach((r) => {
    const total = Number(r.total_damage) || 0;
    if (r.kind === 'a') out.a[Number(r.tier)] = total; else if (r.kind === 'b') out.bTotal += total;
  });
  return out;
};
// 自分より多い人数(順位 = これ + 1)。Content-Range の総数を使う
const sbCountRaidJackAhead = async (kind, tier, myTotal, eventId) => {
  const mine = Math.max(0, Math.floor(Number(myTotal)) || 0);
  const view = kind === 'b' ? 'raid_jack_b_ranking' : kind === 'a_all' ? 'raid_jack_a_ranking' : 'raid_jack_contributions';
  const extra = (kind === 'b' || kind === 'a_all') ? '' : `&kind=eq.a&tier=eq.${Math.min(Math.max(Math.floor(Number(tier)) || 1, 1), 5)}`;
  const result = await raidJackRequest(`${view}?${raidJackEventParam(eventId)}${extra}&total_damage=gt.${mine}&select=breeder_id&limit=1`, { headers: { 'Prefer': 'count=exact' } });
  if (!result.ok) return null;
  const range = result.headers && result.headers.get ? result.headers.get('content-range') : '';
  const m = /\/(\d+)$/.exec(String(range || ''));
  return m ? Number(m[1]) : null;
};

// ---- 報酬の受け取り判定(2026-10-04) ----
// いま受け取れる報酬を集める。サーバーの合計・自分の貢献・上位5人を読み、受け取り済みの印(state.claimed)にないものだけを返す。
//   ・参加賞: A・Bそれぞれ、自分の与ダメージが1回でも記録されていれば。
//   ・A 討伐: その段階が倒れていて(合計 >= ライフ)、自分がその段階へ与えていれば。
//   ・A 順位: 男爵〜公爵は倒れたとき、大王は期間が終わったとき、貢献の上位5人に自分が入っていれば。
//   ・B 討伐: 端末の記録で、その難易度を倒していれば(初めて倒したときの1回だけ)。
//   ・B 順位: 期間が終わったとき、累計ダメージの上位5人に自分が入っていれば。
// 上位5人に入っていなかった人は「入っていなかった」印(_none)を残し、毎回問い合わせ直さない。
// 返り値 { ok, due:[{id,title,reward}], noneIds:[...] }。通信できないとき ok:false(何も配らない)
const raidJackCollectDueRewards = async (state, breederId, eventId, nowMs) => {
  const none = { ok: false, due: [], noneIds: [] };
  const id = raidJackSafeId(breederId);
  if (!id) return none;
  const windowState = raidJackWindowAt(nowMs);
  if (windowState === 'before') return { ok: true, due: [], noneIds: [] };
  const norm = raidJackNormalizeState(state);
  const claimed = new Set(norm.claimed);
  const [totals, self] = await Promise.all([sbFetchRaidJackTierTotals(eventId), sbFetchRaidJackSelf(id, eventId)]);
  if (!totals || !self) return none;
  const due = [];
  const noneIds = [];
  const add = (claimId, title, reward) => { if (!claimed.has(claimId)) due.push({ id: claimId, title, reward }); };
  const mineA = (i) => self.a[i + 1] || 0;
  if (Object.values(self.a).some((v) => v > 0)) add(raidJackClaimId('part_a'), raidJackRewardTitle('part_a'), RAID_JACK_REWARDS.participation);
  if (self.bTotal > 0) add(raidJackClaimId('part_b'), raidJackRewardTitle('part_b'), RAID_JACK_REWARDS.participation);
  for (let i = 0; i < RAID_JACK_A_TIERS.length; i += 1) {
    const total = totals.a[i + 1] ? totals.a[i + 1].total : 0;
    const defeated = total >= RAID_JACK_A_TIERS[i].hp;
    if (!defeated || mineA(i) <= 0) continue;
    add(raidJackClaimId('clear_a', i), raidJackRewardTitle('clear_a', i), RAID_JACK_REWARDS.aClear[i]);
    // 順位は、男爵〜公爵=倒れたとき / 大王=期間が終わったとき(大王は倒れたあとも貢献が続く)
    const rankId = raidJackClaimId('rank_a', i);
    if ((i < RAID_JACK_A_TIERS.length - 1 || windowState === 'after') && !claimed.has(rankId) && !claimed.has(raidJackNoneId(rankId))) {
      const top = await sbFetchRaidJackContributions(i + 1, RAID_JACK_REWARD_RANKS, eventId);
      if (!top) continue;
      const place = top.findIndex((r) => r.breederId === id);
      if (place >= 0) add(rankId, raidJackRewardTitle('rank_a', i, place + 1), RAID_JACK_REWARDS.aRank[i][place]);
      else noneIds.push(raidJackNoneId(rankId));
    }
  }
  RAID_JACK_B_TIERS.forEach((tier, i) => {
    if (norm.b.defeated.includes(tier.id)) add(raidJackClaimId('clear_b', i), raidJackRewardTitle('clear_b', i), RAID_JACK_REWARDS.bClear[i]);
  });
  const finalId = raidJackClaimId('final_b');
  if (windowState === 'after' && self.bTotal > 0 && !claimed.has(finalId) && !claimed.has(raidJackNoneId(finalId))) {
    const top = await sbFetchRaidJackBRanking(RAID_JACK_REWARD_RANKS, eventId);
    if (top) {
      const place = top.findIndex((r) => r.breederId === id);
      if (place >= 0) add(finalId, raidJackRewardTitle('final_b', 0, place + 1), RAID_JACK_REWARDS.bFinal[place]);
      else noneIds.push(raidJackNoneId(finalId));
    }
  }
  return { ok: true, due, noneIds };
};

// ---- 端末の「倒した」印の修復(2026-10-05) ----
// デバッグの強制表示(別のイベントID)で戦った結果が、本番の端末記録(mh_raid_jack_v1)の「倒した段階」「累計」にも書かれていた。
// グランドスラムが倒していないのに「討伐済み」になり、初討伐の報酬の判定にも使われてしまう(ユーザー指摘)。
// 端末の印を、サーバーの本番のイベントの記録(自分の defeated=true の行)と突き合わせ、裏付けのない印を外す。
//   ・送れていない再送待ち(pending)の中の「倒した」は、まだ送れていないだけなので残す
//   ・通信できない・読めないときは何も変えない(直しは次の機会へ)。直せたら repaired を立てて、以後は走らない
//   ・受け取り済みの印(claimed)・ギフトには触らない
const sbFetchRaidJackMyDefeats = async (breederId, eventId) => {
  const id = raidJackSafeId(breederId);
  if (!id) return null;
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_hits?${raidJackEventParam(eventId)}&breeder_id=eq.${id}&defeated=eq.true&select=kind,tier&limit=200`));
  return rows ? rows.filter((r) => (r.kind === 'a' || r.kind === 'b') && Number.isFinite(Number(r.tier))).map((r) => `${r.kind}${Number(r.tier)}`) : null;
};
const raidJackRepairState = async (state, breederId, eventId) => {
  const norm = raidJackNormalizeState(state);
  if (norm.repaired) return { state: norm, changed: false };
  const id = raidJackSafeId(breederId);
  if (!id) return { state: norm, changed: false };
  const [mine, self] = await Promise.all([sbFetchRaidJackMyDefeats(id, eventId), sbFetchRaidJackSelf(id, eventId)]);
  if (!mine || !self) return { state: norm, changed: false };
  const valid = new Set(mine);
  norm.pending.filter((p) => p.defeated).forEach((p) => valid.add(`${p.kind}${p.tier}`));
  const next = raidJackNormalizeState(norm);
  const before = JSON.stringify([next.a.defeated, next.b.defeated, next.b.total]);
  next.a.defeated = next.a.defeated.filter((v) => valid.has(v));
  next.b.defeated = next.b.defeated.filter((v) => valid.has(v));
  next.b.total = (Number(self.bTotal) || 0) + norm.pending.filter((p) => p.kind === 'b').reduce((sum, p) => sum + p.damage, 0);
  next.repaired = true;
  return { state: next, changed: JSON.stringify([next.a.defeated, next.b.defeated, next.b.total]) !== before };
};

// ---- 倒していない段階の初討伐報酬の取り下げ(2026-10-05) ----
// 上の修復で「倒した」印は直せるが、それまでに印が使われて作られたグランドスラムの初討伐報酬(ギフト・受け取り済みの印 clear_bN)が残る。
// サーバーに本番で倒した記録(defeated=true)が無い難易度のぶんだけ、次のように直す(1回だけ・giftsChecked)。
//   ・ギフトが「まだ受け取られていない」→ ギフトを取り下げ、受け取り済みの印も外す(本当に倒したときに、改めて届く)
//   ・ギフトを「もう受け取った」→ 中身は戻せないので、ギフトも印もそのまま残す(あとで本当に倒しても二重には届かない)
//   ・ギフトが見つからない → 印だけ外す
//   ・本番で本当に倒した難易度・ほかの報酬(A・順位・参加賞)・ほかのギフトには触れない。通信できないときは何も変えない
// gifts は mh_gifts の配列。返り値 { ok, state, gifts, changed, removed }(removed=取り下げたギフトの数)
const raidJackRevokeUnearned = async (state, gifts, breederId, eventId) => {
  const norm = raidJackNormalizeState(state);
  const list = Array.isArray(gifts) ? gifts : [];
  if (norm.giftsChecked) return { ok: true, state: norm, gifts: list, changed: false, removed: 0 };
  const id = raidJackSafeId(breederId);
  const mine = id ? await sbFetchRaidJackMyDefeats(id, eventId) : null;
  if (!mine) return { ok: false, state: norm, gifts: list, changed: false, removed: 0 };
  const earned = new Set(mine);
  norm.pending.filter((p) => p.defeated).forEach((p) => earned.add(`${p.kind}${p.tier}`));
  let nextGifts = list;
  let nextClaimed = norm.claimed;
  let removed = 0;
  RAID_JACK_B_TIERS.forEach((tier, i) => {
    const claimId = raidJackClaimId('clear_b', i);
    if (earned.has(tier.id) || !nextClaimed.includes(claimId)) return;
    const giftId = `${eventId}_${claimId}`;
    const gift = nextGifts.find((g) => g && g.id === giftId);
    if (gift && gift.claimedAt) return;   // もう受け取った: 戻せないので残す
    if (gift) { nextGifts = nextGifts.filter((g) => g !== gift); removed += 1; }
    nextClaimed = nextClaimed.filter((v) => v !== claimId);
  });
  const next = raidJackNormalizeState({ ...norm, claimed: nextClaimed, giftsChecked: true });
  return { ok: true, state: next, gifts: nextGifts, changed: removed > 0 || nextClaimed.length !== norm.claimed.length, removed };
};
