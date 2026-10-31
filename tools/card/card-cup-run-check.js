// MFバトルカード 個人杯: オート杯を回すサーバの中身(supabase/functions/card-tournament-run/cup.js)を、偽物の表と偽物の Claude で回す(2026-10-31 ルールくん)
//
//   node tools/card/card-cup-run-check.js [--verbose]
//
// 見るもの
//   A. 締め切り: 受付の終わりより前は何もしない・終わったら写しと席と試合・デッキの壊れた人と抜けた人は外す・2人に足りなければ中止
//   B. 試合: 発表の2時間前より前は回さない・回し始めたら最後まで・時間の上限で分けて回しても同じ結果・何度呼んでも二重に回さない
//   C. 総当たり: 全員が1回ずつ当たる・順位と勝ち数
//   D. トーナメント: 回戦が終わるごとに次の回戦・不戦勝・順位(1・2・3・5)・優勝が決まる試合だけ実況
//   E. リアルタイム杯はサーバで回さない
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'supabase', 'functions', 'card-tournament-run');
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (v) => JSON.stringify(v);
const clone = (v) => JSON.parse(J(v));

const fakeDb = (decks) => {
  const s = { cups: [], entries: [], matches: [], nextId: 1 };
  const ent = (cid, o) => s.entries.find((e) => e.cup_id === cid && e.owner_id === o);
  return {
    s,
    listOpenCups: async () => clone(s.cups.filter((c) => (c.status === 'entry' || c.status === 'running') && c.mode === 'auto')),
    getCup: async (id) => clone(s.cups.find((c) => c.id === id)),
    cupEntries: async (id) => clone(s.entries.filter((e) => e.cup_id === id)),
    decksOf: async (owners) => Object.fromEntries(owners.filter((o) => decks[o]).map((o) => [o, clone(decks[o])])),
    updateCupEntry: async (id, o, patch) => { Object.assign(ent(id, o), clone(patch)); },
    insertCupMatches: async (id, rows) => {
      for (const m of rows) {
        if (s.matches.some((x) => x.cup_id === id && x.round === m.round && x.slot === m.slot)) continue;
        s.matches.push({ id: s.nextId++, cup_id: id, round: m.round, slot: m.slot, a_seat: m.a, b_seat: m.b, seed: m.seed, first: m.first, winner: null, kos: null });
      }
    },
    cupMatches: async (id) => clone(s.matches.filter((m) => m.cup_id === id)),
    updateCupMatch: async (mid, patch) => { const m = s.matches.find((x) => x.id === mid); if (m.winner === null) Object.assign(m, clone(patch)); },
    updateCup: async (id, patch) => { Object.assign(s.cups.find((c) => c.id === id), clone(patch)); },
  };
};

(async () => {
  const game = await import(path.join(DIR, 'game.js'));
  const cupMod = await import(path.join(DIR, 'cup.js'));
  const db0 = game.CARD_BATTLE_DATA;
  const ALL = ['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu'];
  const deckOf = (i) => game.cardTourPlay(db0, { assist: ALL[i % 6] }, { assist: ALL[(i + 1) % 6] }, { seed: 2000 + i, first: 0, key: `c${i}` }).decks[0];
  const makeDecks = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { deck: deckOf(i), tactics: { habit: ALL[i % 6] }, version: 1 }]));
  const ms = (ymd, hm) => Date.parse(`${ymd}T${hm}:00+09:00`);
  const mkCup = (db, id, format, n, extra = {}) => {
    db.s.cups.push({ id, mode: 'auto', format, status: 'entry', entry_until: '2026-11-05T20:00:00+09:00', start_at: '2026-11-05T22:00:00+09:00', bracket: null, ...extra });
    for (let i = 0; i < n; i++) db.s.entries.push({ cup_id: id, owner_id: `p${i}`, dropped: false, entered_at: `2026-11-05T1${i % 10}:0${i % 6}:00+09:00` });
  };
  const run = (db, at, opts = {}) => cupMod.runCups({ db, game, nowMs: at, log: opts.log || (() => {}), budget: { left: opts.budget ?? 1e9 }, ai: opts.ai || null, take: opts.take || null, refund: null });

  // ---- 総当たり(5人+デッキの壊れた人+抜けた人) ----
  {
    const decks = makeDecks(5);
    decks.bad = { deck: { monsters: ['x'] } };
    const db = fakeDb(decks);
    mkCup(db, 'crr', 'rr', 5, { start_at: '2026-11-05T23:00:00+09:00' });
    db.s.entries.push({ cup_id: 'crr', owner_id: 'bad', dropped: false, entered_at: '2026-11-05T12:00:00+09:00' });
    db.s.entries.push({ cup_id: 'crr', owner_id: 'gone', dropped: true, entered_at: '2026-11-05T12:00:00+09:00' });
    let out = await run(db, ms('2026-11-05', '19:59'));
    check('A 受付の終わりより前は何もしない', out.closed === 0 && db.s.cups[0].status === 'entry');
    out = await run(db, ms('2026-11-05', '20:00'));
    const seats = db.s.entries.filter((e) => Number.isInteger(e.seat));
    check('A 締め切ると席(5人)と試合(10試合)・写しを取る・発表の2時間前までは回さない', out.closed === 1 && db.s.cups[0].status === 'running' && seats.length === 5 && seats.every((e) => e.deck && e.deck.monsters) && db.s.matches.length === 10 && db.s.matches.every((m) => m.winner === null), J(out));
    check('A デッキの壊れた人は外す・抜けた人は席に入れない', db.s.entries.find((e) => e.owner_id === 'bad').dropped === true && !Number.isInteger(db.s.entries.find((e) => e.owner_id === 'gone').seat));
    // 発表 23:00 の2時間前 = 21:00 から、時間の上限で1試合ずつ分けて回す
    let counts = [];
    for (let k = 0; k < 12 && db.s.cups[0].status !== 'done'; k++) counts.push((await run(db, ms('2026-11-05', '21:00') + k * 600000, { budget: 1 })).played);
    check('B 時間の上限で1試合ずつ分けて回し、10回目で終わる', db.s.cups[0].status === 'done' && J(counts) === J([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), J(counts));
    const pairs = new Set(db.s.matches.map((m) => [m.a_seat, m.b_seat].sort().join('-')));
    check('C 全員が1回ずつ当たる(10組)', pairs.size === 10);
    const places = seats.map((e) => db.s.entries.find((x) => x.owner_id === e.owner_id).place).sort();
    const wins = db.s.entries.filter((e) => Number.isInteger(e.seat)).reduce((a, e) => a + e.wins, 0);
    check('C 順位は 1〜5・勝ち数の合計は試合の数', J(places) === J([1, 2, 3, 4, 5]) && wins === 10, J(places));
    check('D 実況は優勝が決まる1試合だけ(Claude なしなら用意した台詞)', db.s.matches.filter((m) => m.live).length === 1);
    const snap = J(db.s.matches);
    out = await run(db, ms('2026-11-05', '23:00'));
    check('B 終わった杯はもう回さない', out.played === 0 && J(db.s.matches) === snap);
    // 分けずに回したときと同じ結果
    const db2 = fakeDb(decks);
    mkCup(db2, 'crr', 'rr', 5, { start_at: '2026-11-05T23:00:00+09:00' });
    db2.s.entries.push({ cup_id: 'crr', owner_id: 'bad', dropped: false, entered_at: '2026-11-05T12:00:00+09:00' });
    await run(db2, ms('2026-11-05', '20:00'));
    await run(db2, ms('2026-11-05', '21:00'));
    const strip = (d) => J(d.s.matches.map(({ done_at, live, ...m }) => m));
    check('B 分けて回しても、まとめて回したのと同じ結果', strip(db) === strip(db2));
  }
  // ---- 発表の2時間前より前は回さない ----
  {
    const db = fakeDb(makeDecks(4));
    mkCup(db, 'cwait', 'rr', 4, { start_at: '2026-11-06T22:00:00+09:00' });
    await run(db, ms('2026-11-05', '20:00'));
    const out = await run(db, ms('2026-11-06', '19:50'));
    check('B 発表の2時間前より前は回さない', out.played === 0 && db.s.matches.every((m) => m.winner === null) && db.s.cups[0].status === 'running');
  }
  // ---- 2人に足りない ----
  {
    const db = fakeDb(makeDecks(1));
    mkCup(db, 'cfew', 'ko', 1);
    await run(db, ms('2026-11-05', '20:00'));
    check('A 2人に足りなければ中止(closed・few)', db.s.cups[0].status === 'closed' && db.s.cups[0].closed_reason === 'few' && db.s.matches.length === 0);
  }
  // ---- トーナメント(6人 → 8の山・不戦勝2) ----
  {
    const db = fakeDb(makeDecks(6));
    mkCup(db, 'cko', 'ko', 6);
    let calls = 0;
    const ai = async () => { calls += 1; return { content: [{ type: 'text', text: '{"play":"決勝の実況","review":"決勝の解説"}' }] }; };
    const take = async () => ({ ok: true });
    const logs = [];
    await run(db, ms('2026-11-05', '20:00'), { ai, take, log: (x) => logs.push(J(x)) });
    const c = db.s.cups[0];
    check('D 締め切りの呼び出しで最後まで回る(1回戦4枠のうち不戦勝2・2試合 → 準決勝2 → 決勝1)', c.status === 'done' && c.bracket.rounds.length === 3 && db.s.matches.length === 5 && c.bracket.rounds[0].filter(([, b]) => b === null).length === 2, J(c.bracket));
    const places = db.s.entries.map((e) => e.place).sort((a, b) => a - b);
    check('D 順位は 1・2・3・3・5・5', J(places) === J([1, 2, 3, 3, 5, 5]), J(places));
    const fin = db.s.matches.find((m) => m.round === 2);
    check('D 実況は決勝だけ・AI の文', calls === 1 && fin.live && fin.live.play === '決勝の実況' && db.s.matches.filter((m) => m.live).length === 1);
    check('D 優勝した人の勝ち数は3つ以下(不戦勝は数えない)', db.s.entries.find((e) => e.place === 1).wins <= 3);
    check('D ログに本文が出ない', !logs.some((l) => /決勝の実況|決勝の解説/.test(l)));
  }
  // ---- リアルタイム杯 ----
  {
    const db = fakeDb(makeDecks(4));
    mkCup(db, 'clive', 'ko', 4, { mode: 'live' });
    await run(db, ms('2026-11-05', '23:00'));
    check('E リアルタイム杯はサーバで回さない', db.s.cups[0].status === 'entry' && db.s.matches.length === 0);
  }
  // ---- リアルタイム杯の止まった試合(runLiveCups・2026-10-31 社長「30分」) ----
  {
    const decks = makeDecks(2);
    const row = { id: 77, cup_id: 'clive', round: 0, slot: 1, seed: 4242, first: 1, a: decks.p0, b: decks.p1 };
    const asked = [], decided = [];
    const db = { ...fakeDb(decks), liveDue: async (min) => { asked.push(min); return [row, { id: 78, cup_id: 'clive', round: 0, slot: 2, seed: 1, first: 0, a: null, b: decks.p1 }]; },
      liveDecide: async (id, winner, kos, acts, rules) => { decided.push({ id, winner, kos, acts, rules }); return true; } };
    const out = await run(db, ms('2026-11-05', '23:00'));
    const want = game.cardTourPlay(db0, { deck: decks.p0.deck, tactics: decks.p0.tactics }, { deck: decks.p1.deck, tactics: decks.p1.tactics }, { seed: 4242, first: 1, key: 'clive|0|1' });
    check('F 待ち時間は30分(サーバの関数の1か所)を SQL へ渡す', J(asked) === J([30]) && cupMod.CUP_LIVE_IDLE_MS === 30 * 60000, J(asked));
    check('F 止まった試合を、写しどうし・試合の種・「杯|回戦|枠」の key で回して決める(端末の auto と同じ結果)', decided.length === 1 && decided[0].id === 77 && decided[0].winner === want.winner && J(decided[0].kos) === J(want.kos) && J(decided[0].acts) === J(want.acts) && out.live === 1, J(decided.map((d) => d.id)));
    check('F 写しの無い試合は回さない', !decided.some((d) => d.id === 78));
    const db2 = { ...fakeDb(decks), liveDue: async () => [row], liveDecide: async () => { throw new Error('呼ばれない'); } };
    const out2 = await run(db2, ms('2026-11-05', '23:00'), { budget: 0 });
    check('F 時間の上限が残っていなければ回さない', out2.live === 0);
    const db3 = { ...fakeDb(decks), liveDue: async () => { throw new Error('関数が無い'); }, liveDecide: async () => true };
    const out3 = await run(db3, ms('2026-11-05', '23:00'));
    check('F 関数がまだ無い(SQL を流す前)ときも止まらない', out3 && out3.live === 0);
  }

  if (fails.length) {
    console.error(`個人杯のオート杯の検査: NG ${fails.length}件(OK ${passed}件)`);
    fails.forEach((f) => console.error(`  NG: ${f}`));
    process.exit(1);
  }
  console.log(`個人杯のオート杯の検査: OK ${passed}件`);
})().catch((e) => { console.error(e); process.exit(1); });
