// ジャックの通信層(36-raid-jack-api.jsx)を、偽の fetch で動かして確かめる(通信はしない)。
//
// 見るもの
//   ① 1戦の与ダメージを、決まった形で1行だけ送る(hit_id・on_conflict・ignore-duplicates)
//   ② 表が無い(404)ときは「準備中」で止まり、以後送らない。形が違う(400)ものは捨てる。通信エラーは再送待ちへ
//   ③ 再送待ちを送り直せる(同じ hit_id)。送れたものだけが消える
//   ④ 取得の問い合わせ先(ビュー・並び順・件数)が設計どおり。壊れた返事は null
//   ⑤ 既存の保存キー・ランキングの表に書かない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const defs = read('monster-hero/src/parts/35-raid-jack.jsx');
const api = read('monster-hero/src/parts/36-raid-jack-api.jsx');

const make = () => {
  const calls = [];
  const store = {};
  let responder = () => ({ ok: true, status: 201, body: '' });
  const ctx = {
    console, Object, Number, Math, Array, JSON, String, Boolean, Date, isNaN, Promise, encodeURIComponent, setTimeout: (f) => { f(); return 0; }, clearTimeout,   // 再試行の待ち時間を飛ばして、検査を速くする
   ensureBreederId: async () => 'breeder-aaaa1111',
    AbortController, RegExp, Error,
    SUPABASE_URL: 'https://example.supabase.co', SB_HEADERS: { apikey: 'k', 'Content-Type': 'application/json' },
    BUILD_DATE: '2026-10-04 12:00',
    _isMissingTableError: (status, body) => status === 404 && /PGRST205|does not exist/i.test(String(body || '')),
    storeGet: async (k, d) => (k in store ? store[k] : d),
    storeSet: async (k, v) => { store[k] = v; return true; },
    fetch: async (url, init) => {
      calls.push({ url, init });
      const r = responder(url, init);
      if (r === 'throw') throw new Error('network');
      return { ok: r.ok, status: r.status, text: async () => r.body, headers: { get: (h) => (r.headers || {})[h.toLowerCase()] || null } };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(`${defs}\n${api}\nthis.o={sbFetchRaidJackSourceRanking,sbFetchRaidJackSourceSelf,sbCountRaidJackSourceAhead,raidJackNormalizePending,RAID_JACK_EVENT,raidJackMakeHitId,sbSendRaidJackHit,raidJackSubmitHit,raidJackFlushPending,raidJackLoadState,raidJackSaveState,raidJackUnavailable,raidJackDefaultState,raidJackNormalizeState,sbFetchRaidJackTierTotals,sbFetchRaidJackContributions,sbFetchRaidJackBRanking,sbFetchRaidJackARanking,sbFetchRaidJackSelf,sbCountRaidJackAhead,raidJackFlushStoredPending,sbFetchRaidJackMaxHitRanking,sbFetchRaidJackMaxHitSelf,sbCountRaidJackMaxHitAhead};`, ctx);
  return { o: ctx.o, calls, store, setResponder: (f) => { responder = f; } };
};

(async () => {
  const BID = 'breeder-aaaa1111';
  // ① 送る形
  {
    const t = make();
    const id = t.o.raidJackMakeHitId(Date.now());
    check('hit_id は 8〜64文字の英数字と - _', /^[0-9A-Za-z_-]{8,64}$/.test(id), id);
    check('hit_id は毎回違う', t.o.raidJackMakeHitId(1) !== t.o.raidJackMakeHitId(1));
    const out = await t.o.sbSendRaidJackHit({ hitId: id, kind: 'a', tier: 2, damage: 12345, defeated: true }, BID);
    const c = t.calls[0];
    const row = JSON.parse(c.init.body);
    check('送れたら sent', out === 'sent');
    check('raid_jack_hits へ on_conflict=hit_id で POST', /\/rest\/v1\/raid_jack_hits\?on_conflict=hit_id$/.test(c.url) && c.init.method === 'POST', c.url);
    check('同じ hit_id は無視する(ignore-duplicates)', /resolution=ignore-duplicates/.test(c.init.headers.Prefer));
    check('行の中身', row.hit_id === id && row.kind === 'a' && row.tier === 2 && row.damage === 12345 && row.defeated === true && row.breeder_id === BID && row.event_id === 'raid_jack_2026', JSON.stringify(row));
    check('ほかの表へは送らない', t.calls.every((x) => /raid_jack_/.test(x.url) && !/rankings|breeder_profiles|bond_levels/.test(x.url)));
    check('形が違うものは送らない(段階7)', (await t.o.sbSendRaidJackHit({ hitId: id, kind: 'a', tier: 7, damage: 1, defeated: false }, BID)) === 'invalid' && t.calls.length === 1);
    check('ブリーダーIDが無ければ送らない', (await t.o.sbSendRaidJackHit({ hitId: id, kind: 'a', tier: 1, damage: 1, defeated: false }, '')) === 'invalid' && t.calls.length === 1);
  }
  // ①-2 与ダメージの種類(source: battle / rhythm)。2026-10-06・ユーザー指示「モンビーのダメージとバトルのダメージに分ける」
  {
    const t = make();
    const out = await t.o.sbSendRaidJackHit({ hitId: 'srcrhythm01', kind: 'a', tier: 1, damage: 500, defeated: false, source: 'rhythm' }, BID);
    check('モンヒロビートの与ダメージは source:rhythm を付けて送る', out === 'sent' && JSON.parse(t.calls[0].init.body).source === 'rhythm');
    await t.o.sbSendRaidJackHit({ hitId: 'srcbattle01', kind: 'a', tier: 1, damage: 500, defeated: false }, BID);
    check('種類のない(従来の)与ダメージはバトル扱い(source:battle)', JSON.parse(t.calls[1].init.body).source === 'battle');
    check('再送待ちを通しても種類が残る(rhythm のまま・不正な値は battle)', t.o.raidJackNormalizePending([{ hitId: 'srcrhythm02', kind: 'a', tier: 1, damage: 5, source: 'rhythm' }, { hitId: 'srcrhythm03', kind: 'a', tier: 1, damage: 5, source: 'x' }]).map((h) => h.source).join() === 'rhythm,battle');
  }
  {
    // 表に source 列がまだ無い(SQL未適用): 400 で「列が無い」と返る → 列なしで送り直して、与ダメージを捨てない。以後は最初から列なしで送る
    const t = make();
    t.setResponder((url, init) => (JSON.parse(init.body).source ? { ok: false, status: 400, body: '{"code":"PGRST204","message":"Could not find the \'source\' column of \'raid_jack_hits\'"}' } : { ok: true, status: 201, body: '' }));
    const out = await t.o.sbSendRaidJackHit({ hitId: 'nosrccol01', kind: 'a', tier: 1, damage: 500, defeated: false, source: 'rhythm' }, BID);
    check('source 列が無い表でも与ダメージは送れる(列なしで送り直す)', out === 'sent' && t.calls.length === 2 && !('source' in JSON.parse(t.calls[1].init.body)));
    await t.o.sbSendRaidJackHit({ hitId: 'nosrccol02', kind: 'a', tier: 1, damage: 500, defeated: false, source: 'battle' }, BID);
    check('列が無いと分かったあとは、最初から列なしで1回だけ送る', t.calls.length === 3 && !('source' in JSON.parse(t.calls[2].init.body)));
  }
  {
    const t = make();
    t.setResponder(() => ({ ok: true, status: 200, body: JSON.stringify([{ breeder_id: 'breeder-bbbb2222', total_damage: 900, max_damage: 400, last_hit_at: 'x' }]) }));
    const tot = await t.o.sbFetchRaidJackSourceRanking('rhythm', 0, 'total', 100, 'raid_jack_2026');
    const mx = await t.o.sbFetchRaidJackSourceRanking('battle', 3, 'max', 100, 'raid_jack_2026');
    check('種類別の合計(全段階)は raid_jack_source_ranking・kind=a・source を絞り、合計の多い順', /raid_jack_source_ranking\?event_id=eq\.raid_jack_2026&kind=eq\.a&source=eq\.rhythm&select=breeder_id,total_damage,last_hit_at&order=total_damage\.desc/.test(t.calls[0].url) && tot[0].total === 900, t.calls[0].url);
    check('種類別の最大(難易度つき)は raid_jack_source_by_tier・tier を絞り、最大の多い順', /raid_jack_source_by_tier\?event_id=eq\.raid_jack_2026&kind=eq\.a&source=eq\.battle&tier=eq\.3&select=breeder_id,max_damage,last_hit_at&order=max_damage\.desc/.test(t.calls[1].url) && mx[0].total === 400, t.calls[1].url);
    t.setResponder(() => ({ ok: true, status: 200, body: '[]' }));
    check('自分の種類別の数字は、記録がなければ 0', await t.o.sbFetchRaidJackSourceSelf(BID, 'rhythm', 0, 'max', 'raid_jack_2026') === 0);
    t.setResponder(() => ({ ok: true, status: 206, body: '[]', headers: { 'content-range': '0-0/7' } }));
    check('自分より上の人数は Content-Range の総数', await t.o.sbCountRaidJackSourceAhead('rhythm', 0, 'max', 400, 'raid_jack_2026') === 7);
  }
  // ② 失敗の扱い
  {
    const t = make();
    const hit = { hitId: t.o.raidJackMakeHitId(), kind: 'b', tier: 1, damage: 500, defeated: false };
    t.setResponder(() => ({ ok: false, status: 400, body: 'check violation' }));
    check('形が違う(400)は invalid(捨てる)', (await t.o.sbSendRaidJackHit(hit, BID)) === 'invalid');
    t.setResponder(() => 'throw');
    check('通信エラーは error(再送する)', (await t.o.sbSendRaidJackHit(hit, BID)) === 'error');
    t.setResponder(() => ({ ok: false, status: 500, body: 'oops' }));
    check('500 は error(再送する)', (await t.o.sbSendRaidJackHit(hit, BID)) === 'error');
    t.setResponder(() => ({ ok: false, status: 404, body: '{"code":"PGRST205","message":"Could not find the table"}' }));
    check('表が無い(404)は notready', (await t.o.sbSendRaidJackHit(hit, BID)) === 'notready');
    const n = t.calls.length;
    check('準備中と分かったら以後は通信しない', (await t.o.sbSendRaidJackHit(hit, BID)) === 'notready' && t.calls.length === n && t.o.raidJackUnavailable());
  }
  // ③ 再送待ち
  {
    const t = make();
    let fail = true;
    t.setResponder(() => (fail ? { ok: false, status: 500, body: '' } : { ok: true, status: 201, body: '' }));
    const h1 = { hitId: t.o.raidJackMakeHitId(), kind: 'a', tier: 1, damage: 10, defeated: false };
    const h2 = { hitId: t.o.raidJackMakeHitId(), kind: 'b', tier: 3, damage: 20, defeated: false };
    let { state } = await t.o.raidJackSubmitHit(t.o.raidJackDefaultState(), h1, BID);
    ({ state } = await t.o.raidJackSubmitHit(state, h2, BID));
    check('送れなかった2件が再送待ちに残る', state.pending.length === 2);
    ({ state } = await t.o.raidJackSubmitHit(state, h1, BID));
    check('同じ hit_id は再送待ちへ二重に入らない', state.pending.length === 2);
    // 失敗したときは、その場で2回まで再試行する(合計3回)。ここまでの送信は3回(h1・h2・h1)なので 3×3=9回
    check('送れないときは、その場で合計3回まで再試行する(送信3回ぶんで 3×3=9回)', t.calls.filter((c) => c.init.method === 'POST').length === 9, String(t.calls.filter((c) => c.init.method === 'POST').length));
    await t.o.raidJackSaveState(state);
    const loaded = await t.o.raidJackLoadState();
    check('再送待ちは新しい保存キーに残る', loaded.pending.length === 2 && 'mh_raid_jack_v1' in t.store && Object.keys(t.store).every((k) => k === 'mh_raid_jack_v1'));
    fail = false;
    const flushed = await t.o.raidJackFlushPending(loaded, BID);
    check('通信が戻ったら送り直せて空になる', flushed.pending.length === 0);
    const sentIds = t.calls.filter((c) => c.init.method === 'POST').map((c) => JSON.parse(c.init.body).hit_id);
    check('送り直しは元と同じ hit_id', sentIds.includes(h1.hitId) && sentIds.includes(h2.hitId));
  }
  // ③-2 通信が弱くて1回目だけ失敗 → その場の再試行で届く。長く待つ設定になっている
  {
    const t = make();
    let n = 0;
    t.setResponder(() => (++n === 1 ? 'throw' : { ok: true, status: 201, body: '' }));
    const h = { hitId: t.o.raidJackMakeHitId(), kind: 'a', tier: 3, damage: 700000, defeated: false };
    const r = await t.o.raidJackSubmitHit(t.o.raidJackDefaultState(), h, BID);
    check('1回目だけ失敗しても、再試行で届いて再送待ちに残らない', r.outcome === 'sent' && r.state.pending.length === 0 && n === 2, `outcome=${r.outcome} n=${n}`);
    check('与ダメージを送る通信は、ランキングの読み出し(8秒)より長く待つ', /RAID_JACK_SEND_TIMEOUT_MS = 20000/.test(api) && /timeoutMs: RAID_JACK_SEND_TIMEOUT_MS/.test(api));
  }
  // ③-3 端末に残った再送待ちを、保存から読んで送り直す(HOMEとレイド画面を開いたとき。2026-10-06・ユーザー指摘「70万出したのに反映されてない」)
  {
    const t = make();
    t.setResponder(() => ({ ok: false, status: 500, body: '' }));
    const h = { hitId: t.o.raidJackMakeHitId(), kind: 'a', tier: 3, damage: 700000, defeated: false };
    const first = await t.o.raidJackSubmitHit(t.o.raidJackDefaultState(), h, BID);
    await t.o.raidJackSaveState(first.state);
    check('送れなかった700,000は端末に残る', (await t.o.raidJackLoadState()).pending.length === 1);
    const callsBefore = t.calls.length;
    t.setResponder(() => ({ ok: false, status: 500, body: '' }));
    check('まだ通信できないあいだは、0件で再送待ちが残る', (await t.o.raidJackFlushStoredPending(BID, 'raid_jack_2026')) === 0 && (await t.o.raidJackLoadState()).pending.length === 1);
    t.setResponder(() => ({ ok: true, status: 201, body: '' }));
    check('通信が戻ってHOME・レイド画面を開くと、保存から読んで1件送れて、再送待ちが空になる', (await t.o.raidJackFlushStoredPending(BID, 'raid_jack_2026')) === 1 && (await t.o.raidJackLoadState()).pending.length === 0);
    const posts = t.calls.slice(callsBefore).filter((c) => c.init.method === 'POST').map((c) => JSON.parse(c.init.body));
    check('送り直しは元と同じ hit_id・同じダメージ', posts.some((b) => b.hit_id === h.hitId && b.damage === 700000));
    const n2 = t.calls.length;
    check('再送待ちが空のときは通信しない', (await t.o.raidJackFlushStoredPending(BID, 'raid_jack_2026')) === 0 && t.calls.length === n2);
  }
  // ④ 取得
  {
    const t = make();
    t.setResponder(() => ({ ok: true, status: 200, body: JSON.stringify([{ kind: 'a', tier: 1, total_damage: '2200', player_count: 2, any_defeated: true }, { kind: 'b', tier: 2, total_damage: 5, player_count: 1, any_defeated: false }]) }));
    const totals = await t.o.sbFetchRaidJackTierTotals();
    check('段階ごとの合計を読む', totals && totals.a[1].total === 2200 && totals.a[1].defeated === true && totals.b[2].players === 1);
    check('合計は raid_jack_tier_totals をイベントで絞る', /raid_jack_tier_totals\?event_id=eq\.raid_jack_2026/.test(t.calls[0].url));
    t.setResponder(() => ({ ok: true, status: 200, body: JSON.stringify([{ breeder_id: 'x1', total_damage: 9 }]) }));
    const rank = await t.o.sbFetchRaidJackBRanking();
    check('Bの上位は100件・累計の多い順', /raid_jack_b_ranking/.test(t.calls[1].url) && /limit=100/.test(t.calls[1].url) && /order=total_damage\.desc,last_hit_at\.asc/.test(t.calls[1].url) && rank[0].total === 9);
    await t.o.sbFetchRaidJackContributions(3, 100);
    check('Aの貢献は段階を指定して絞る', /kind=eq\.a&tier=eq\.3/.test(t.calls[2].url));
    t.setResponder(() => ({ ok: true, status: 200, body: JSON.stringify([{ kind: 'a', tier: 1, total_damage: 100 }, { kind: 'b', tier: 1, total_damage: 40 }, { kind: 'b', tier: 2, total_damage: 60 }]) }));
    const self = await t.o.sbFetchRaidJackSelf(BID);
    check('自分の貢献(A段階別・B累計)', self && self.a[1] === 100 && self.bTotal === 100);
    t.setResponder(() => ({ ok: true, status: 206, body: '[]', headers: { 'content-range': '0-0/17' } }));
    check('自分より多い人数を Content-Range から読む', (await t.o.sbCountRaidJackAhead('b', 1, 500)) === 17);
    // 大王を倒したあとの累計ダメージ(全段階の合計)。kind と tier では絞らず、専用のビューを読む
    t.setResponder(() => ({ ok: true, status: 200, body: JSON.stringify([{ breeder_id: 'y1', total_damage: 777 }]) }));
    const callsBefore = t.calls.length;
    const allRank = await t.o.sbFetchRaidJackARanking();
    check('A累計は raid_jack_a_ranking を累計の多い順に100件', /raid_jack_a_ranking\?event_id=eq\.raid_jack_2026/.test(t.calls[callsBefore].url) && /limit=100/.test(t.calls[callsBefore].url) && /order=total_damage\.desc,last_hit_at\.asc/.test(t.calls[callsBefore].url) && allRank[0].total === 777 && allRank[0].breederId === 'y1');
    t.setResponder(() => ({ ok: true, status: 206, body: '[]', headers: { 'content-range': '0-0/4' } }));
    const callsBefore2 = t.calls.length;
    check('A累計の自分より多い人数も、専用のビューで数える(段階では絞らない)', (await t.o.sbCountRaidJackAhead('a_all', 3, 500)) === 4 && /raid_jack_a_ranking\?/.test(t.calls[callsBefore2].url) && !/tier=eq/.test(t.calls[callsBefore2].url));
    // 1戦あたりの最大ダメージ(A・B共通のビュー raid_jack_max_hit_ranking。報酬には使わない)
    t.setResponder(() => ({ ok: true, status: 200, body: JSON.stringify([{ breeder_id: 'm1', max_damage: 900 }, { breeder_id: 'm2', max_damage: 500 }]) }));
    const callsMax = t.calls.length;
    const maxRank = await t.o.sbFetchRaidJackMaxHitRanking('b');
    check('最大ダメージは raid_jack_max_hit_ranking を kind で絞り、大きい順に100件', /raid_jack_max_hit_ranking\?event_id=eq\.raid_jack_2026&kind=eq\.b/.test(t.calls[callsMax].url) && /order=max_damage\.desc/.test(t.calls[callsMax].url) && /limit=100/.test(t.calls[callsMax].url) && maxRank.length === 2 && maxRank[0].total === 900);
    // 難易度で絞るときは、難易度別のビュー raid_jack_max_hit_by_tier を読む(0 や未指定は全難易度のビュー)
    t.setResponder(() => ({ ok: true, status: 200, body: JSON.stringify([{ breeder_id: 'm3', max_damage: 700 }]) }));
    const callsTier = t.calls.length;
    const tierRank = await t.o.sbFetchRaidJackMaxHitRanking('a', 100, undefined, 3);
    check('難易度を選ぶと raid_jack_max_hit_by_tier を kind と tier で絞って読む', /raid_jack_max_hit_by_tier\?event_id=eq\.raid_jack_2026&kind=eq\.a&tier=eq\.3&select=/.test(t.calls[callsTier].url) && tierRank.length === 1 && tierRank[0].total === 700);
    const callsTier2 = t.calls.length;
    await t.o.sbFetchRaidJackMaxHitSelf(BID, 'b', undefined, 5);
    await t.o.sbCountRaidJackMaxHitAhead('b', 10, undefined, 5);
    check('自分の最大ダメージと上の人数も、同じ難易度別のビューを見る', /raid_jack_max_hit_by_tier\?.*kind=eq\.b&tier=eq\.5&breeder_id=/.test(t.calls[callsTier2].url) && /raid_jack_max_hit_by_tier\?.*tier=eq\.5&max_damage=gt\.10/.test(t.calls[callsTier2 + 1].url));
    const callsTier3 = t.calls.length;
    await t.o.sbFetchRaidJackMaxHitRanking('a', 100, undefined, 0);
    check('難易度0(全難易度)は難易度別ではなく全体のビューを読む', /raid_jack_max_hit_ranking\?/.test(t.calls[callsTier3].url) && !/tier=eq/.test(t.calls[callsTier3].url));
    t.setResponder(() => ({ ok: true, status: 200, body: '[{"max_damage":321}]' }));
    check('自分の最大ダメージを読む(無ければ0)', (await t.o.sbFetchRaidJackMaxHitSelf(BID, 'a')) === 321);
    t.setResponder(() => ({ ok: true, status: 200, body: '[]' }));
    check('記録が無い人の最大ダメージは0', (await t.o.sbFetchRaidJackMaxHitSelf(BID, 'a')) === 0);
    t.setResponder(() => ({ ok: true, status: 206, body: '[]', headers: { 'content-range': '0-0/6' } }));
    check('最大ダメージで自分より上の人数を Content-Range から読む', (await t.o.sbCountRaidJackMaxHitAhead('a', 100)) === 6);
    t.setResponder(() => ({ ok: true, status: 404, body: '' }));
    check('最大ダメージのビューがまだ無い(404)ときは null(画面は準備中)', (await t.o.sbFetchRaidJackMaxHitRanking('a')) === null);
    t.setResponder(() => ({ ok: true, status: 404, body: '' }));
    check('ビューがまだ無い(404)ときは null(画面は準備中)', (await t.o.sbFetchRaidJackARanking()) === null);
    // 後から足したビュー(raid_jack_a_ranking)だけが無いとき、与ダメージの送信・段階の合計・報酬は止めない(2026-10-05)
    {
      const u = make();
      u.setResponder((url) => (/raid_jack_a_ranking/.test(url)
        ? { ok: false, status: 404, body: '{"code":"PGRST205","message":"Could not find the table public.raid_jack_a_ranking"}' }
        : /raid_jack_tier_totals/.test(url)
          ? { ok: true, status: 200, body: '[{"kind":"a","tier":1,"total_damage":5,"player_count":1,"any_defeated":false}]' }
          : { ok: true, status: 201, body: '' }));
      const none = await u.o.sbFetchRaidJackARanking();
      const totals = await u.o.sbFetchRaidJackTierTotals();
      const sent = await u.o.sbSendRaidJackHit({ hitId: 'abcdefgh12', kind: 'a', tier: 1, damage: 10, defeated: false }, 'breeder-aaaa1111');
      check('累計ランキングのビューだけ無くても、通信全体は止まらない', none === null && !!totals && sent === 'sent' && !u.o.raidJackUnavailable(),
        `累計=${none} 合計=${totals ? 'ok' : 'null'} 送信=${sent} 全体停止=${u.o.raidJackUnavailable()}`);
      const callsBefore3 = u.calls.length;
      await u.o.sbFetchRaidJackARanking();
      check('無いと分かったビューには、以後は問い合わせない', u.calls.length === callsBefore3);
    }
    t.setResponder(() => ({ ok: true, status: 200, body: 'こわれた' }));
    check('壊れた返事は null(画面は準備中)', (await t.o.sbFetchRaidJackTierTotals()) === null && (await t.o.sbFetchRaidJackBRanking()) === null);
    t.setResponder(() => 'throw');
    check('通信エラーも null', (await t.o.sbFetchRaidJackTierTotals()) === null);
  }
  // ⑤ 書き込み先
  check('このファイルは rankings などへ書き込まない', !/rankings|breeder_profiles|bond_levels/.test(api.replace(/\/\/.*$/gm, '')));
  check('端末の保存は新しいキーだけ', (api.match(/storeSet\(([^,)]+)/g) || []).every((s) => /RAID_JACK_STORAGE_KEY/.test(s)));

  if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
  console.log('\nすべて OK');
})();
