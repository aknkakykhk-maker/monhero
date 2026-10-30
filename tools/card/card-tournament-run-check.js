// MFバトルカード大会: サーバの上の関数の中身(supabase/functions/card-tournament-run/core.js)を、偽物の表と偽物の Claude で回す(2026-10-30 ルールくん)
//
//   node tools/card/card-tournament-run-check.js [--verbose]
//
// 見るもの
//   A. 締め切り: 受付の終わりより前は何もしない・終わったら写しと組分けと日程・デッキの壊れた人は外す・4人に足りなければ助手
//   B. 試合: その日までの試合だけ回す・結果を見せる時刻は日本時間 4:00・同じ日に何度呼んでも同じ(二重に回さない)
//   C. 頂上決戦: 10人以上は組の総当たりのあと各組の上から2人で総当たり・終わったら順位とごほうび
//   D. 実況: Claude が答えたら使う・失敗したら用意した台詞で回数を戻す・上限なら Claude を呼ばない・本文をログに出さない
//   E. ルールの写し(game.js)が、いまの部品と合っている
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
  const s = { tours: [], entries: [], matches: [], rewards: [], nextId: 1 };
  const ent = (tid, seat) => s.entries.find((e) => e.tournament_id === tid && e.seat_id === seat);
  return {
    s,
    listActive: async () => clone(s.tours.filter((t) => t.status !== 'done')),
    getTour: async (id) => clone(s.tours.find((t) => t.id === id)),
    listEntries: async (id) => clone(s.entries.filter((e) => e.tournament_id === id)),
    decksOf: async (owners) => Object.fromEntries(owners.filter((o) => decks[o]).map((o) => [o, clone(decks[o])])),
    updateEntry: async (id, seat, patch) => { Object.assign(ent(id, seat), clone(patch)); },
    insertEntry: async (id, seat, patch) => { const e = ent(id, seat); if (e) Object.assign(e, clone(patch)); else s.entries.push({ tournament_id: id, seat_id: seat, dropped: false, is_assist: false, entered_at: new Date().toISOString(), ...clone(patch) }); },
    insertMatches: async (id, rows) => {
      for (const m of rows) {
        if (s.matches.some((x) => x.tournament_id === id && x.stage === m.stage && x.grp === m.group && x.a_seat === m.a && x.b_seat === m.b)) continue;
        s.matches.push({ id: s.nextId++, tournament_id: id, stage: m.stage, grp: m.group, day: m.day, a_seat: m.a, b_seat: m.b, seed: m.seed, first: m.first, play_on: m.play_on, visible_at: m.visible_at, winner: null, kos: null });
      }
    },
    listMatches: async (id) => clone(s.matches.filter((m) => m.tournament_id === id)),
    updateMatch: async (mid, patch) => { const m = s.matches.find((x) => x.id === mid); if (m.winner === null) Object.assign(m, clone(patch)); },
    updateTour: async (id, patch) => { Object.assign(s.tours.find((t) => t.id === id), clone(patch)); },
    insertRewards: async (id, rows) => { for (const r of rows) if (!s.rewards.some((x) => x.tournament_id === id && x.owner_id === r.owner_id)) s.rewards.push({ tournament_id: id, ...clone(r) }); },
  };
};

(async () => {
  const bundle = require(path.join(ROOT, 'tools', 'build-card-tournament-bundle.js'));
  const fresh = bundle.run({ check: true });
  check('E ルールの写し(game.js)が、いまの部品と合っている(node tools/build.js で作り直す)', fresh.ok, fresh.reason);
  const game = await import(path.join(DIR, 'game.js'));
  const core = await import(path.join(DIR, 'core.js'));
  const db0 = game.CARD_BATTLE_DATA;

  // 登録デッキ(助手の作り方で作った、正しいデッキ)
  const ALL = ['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu'];
  const deckOf = (i) => {
    const r = game.cardTourPlay(db0, { assist: ALL[i % 6] }, { assist: ALL[(i + 1) % 6] }, { seed: 1000 + i, first: 0, key: `d${i}` });
    return r.decks[0];
  };
  const makeDecks = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { deck: deckOf(i), tactics: { habit: ALL[i % 6] }, version: 1, user_name: `人${i}`, icon: null }]));
  const ms = (ymd, hm) => Date.parse(`${ymd}T${hm}:00+09:00`);

  // ---- 小さい大会(3人+デッキの壊れた1人 → 助手1人) ----
  {
    const decks = makeDecks(3);
    decks.bad = { deck: { monsters: ['nope'] }, tactics: {}, user_name: 'こわれ' };
    const db = fakeDb(decks);
    db.s.tours.push({ id: 'cup1', name: '第1回', open_on: '2026-11-01', entry_until: '2026-11-03T00:00:00+09:00', status: 'entry', rewards: { ranks: [{ point: 3000, title: '優勝' }], participation: { point: 500 }, perWin: 100 } });
    ['p0', 'p1', 'p2', 'bad'].forEach((o, i) => db.s.entries.push({ tournament_id: 'cup1', seat_id: o, owner_id: o, is_assist: false, dropped: false, entered_at: `2026-11-01T0${i}:00:00+09:00` }));
    const logs = [];
    const log = (x) => logs.push(J(x));

    let out = await core.runAll({ db, game, nowMs: ms('2026-11-02', '23:59'), log });
    check('A 受付の終わりより前は何もしない', out.closed === 0 && db.s.matches.length === 0 && db.s.tours[0].status === 'entry', J(out));
    out = await core.runAll({ db, game, nowMs: ms('2026-11-03', '00:30'), log });
    const t = db.s.tours[0];
    const live = db.s.entries.filter((e) => !e.dropped);
    check('A 締め切ると組分けと日程(4席・6試合)・1試合目は締め切りの日', out.closed === 1 && t.status === 'group' && t.first_day === '2026-11-03' && t.groups === 1 && live.length === 4 && db.s.matches.length === 6, `${J(out)} ${t.status} ${t.first_day} 席${live.length} 試合${db.s.matches.length}`);
    check('A デッキの壊れた人は外す', db.s.entries.find((e) => e.seat_id === 'bad').dropped === true);
    check('A 足りない席は助手(ごほうびなし)・デッキの写しを取る', live.filter((e) => e.is_assist).length === 1 && live.filter((e) => !e.is_assist).every((e) => e.deck && Array.isArray(e.deck.monsters)));
    check('B 結果を見せるのはその日の日本時間 4:00', db.s.matches.every((m) => new Date(m.visible_at).getTime() === ms(m.play_on, '04:00')));
    const day1 = db.s.matches.filter((m) => m.day === 0).length;
    check('B 締め切りの呼び出しで、その日の試合だけ回す', out.played === day1 && db.s.matches.filter((m) => m.winner !== null).length === day1, `${out.played}/${day1}`);
    const snap = J(db.s.matches);
    out = await core.runAll({ db, game, nowMs: ms('2026-11-03', '01:30'), log });
    check('B 同じ日にもう一度呼んでも、何も変わらない', out.played === 0 && J(db.s.matches) === snap, J(out));
    for (const d of ['2026-11-04', '2026-11-05']) out = await core.runAll({ db, game, nowMs: ms(d, '00:30'), log });
    check('C 9人までは総当たりのあと、そのまま終わる(順位とごほうび)', db.s.tours[0].status === 'done' && db.s.tours[0].done_day === '2026-11-05' && db.s.matches.every((m) => m.winner !== null), `${db.s.tours[0].status} ${db.s.tours[0].done_day}`);
    const places = live.map((e) => db.s.entries.find((x) => x.seat_id === e.seat_id).place).sort();
    check('C 全員に 1〜4 位', J(places) === J([1, 2, 3, 4]), J(places));
    check('C ごほうびは人だけ(助手には無い)・表のとおり', db.s.rewards.length === 3 && db.s.rewards.every((r) => {
      const e = db.s.entries.find((x) => x.owner_id === r.owner_id);
      return r.point === (e.place === 1 ? 3000 : 500) + 100 * e.wins && r.place === e.place;
    }), J(db.s.rewards));
    check('D Claude を渡さなければ、用意した台詞(本文あり)', db.s.matches.every((m) => m.live && m.live.ai === false && m.live.play && m.live.review));
    check('D 見返しの材料(手・ルールの版)と、助手の席のデッキを残す', db.s.matches.every((m) => Array.isArray(m.acts) && m.acts.length && m.rules === game.CARD_REPLAY_RULES)
      && db.s.matches.filter((m) => { const a = live.find((e) => e.grp === m.grp && e.seat === m.a_seat); const b = live.find((e) => e.grp === m.grp && e.seat === m.b_seat); return a.is_assist || b.is_assist; }).every((m) => m.assist_decks.some((d) => d && d.monsters)));
    out = await core.runAll({ db, game, nowMs: ms('2026-11-06', '00:30'), log });
    check('B 終わった大会は回さない', out.played === 0 && out.advanced === 0);
    check('D ログに名前・本文が出ない', !logs.some((l) => /人\d|こわれ|"play":|"review":/.test(l)), logs.find((l) => /人\d|こわれ|"play":|"review":/.test(l)));
  }

  // ---- 大きい大会(12人 → 3組 → 頂上決戦6人) ----
  {
    const decks = makeDecks(12);
    const db = fakeDb(decks);
    db.s.tours.push({ id: 'cup2', name: '第2回', open_on: '2026-11-10', entry_until: '2026-11-12T00:00:00+09:00', status: 'entry', rewards: {} });
    Object.keys(decks).forEach((o, i) => db.s.entries.push({ tournament_id: 'cup2', seat_id: o, owner_id: o, is_assist: false, dropped: false, entered_at: `2026-11-10T${String(i).padStart(2, '0')}:00:00+09:00` }));
    let calls = 0;
    const counts = { took: 0, refunded: 0 };
    const ai = async (q) => { calls += 1; if (calls % 3 === 0) throw new Error('boom'); return { content: [{ type: 'text', text: `{"play":"実況${calls}です","review":"解説${calls}です"}` }], usage: { input_tokens: 10, output_tokens: 20 }, q }; };
    const take = async () => { counts.took += 1; return { ok: counts.took <= 20 }; };
    const refund = async () => { counts.refunded += 1; };
    const logs = [];
    const log = (x) => logs.push(J(x));
    let day = Date.parse('2026-11-12T00:30:00+09:00');
    for (let i = 0; i < 20 && db.s.tours[0].status !== 'done'; i++, day += 86400000) await core.runAll({ db, game, nowMs: day, ai, take, refund, log });
    const t = db.s.tours[0];
    const finals = db.s.matches.filter((m) => m.stage === 'final');
    check('C 12人は3組・各組の上から2人(6人)で頂上決戦', t.groups === 3 && db.s.entries.filter((e) => Number.isInteger(e.final_seat)).length === 6 && finals.length === 15, `組${t.groups} 決戦${finals.length}`);
    const groupLast = Math.max(...db.s.matches.filter((m) => m.stage === 'group').map((m) => m.day));
    check('C 頂上決戦は組の総当たりの次の日から', Math.min(...finals.map((m) => m.day)) === groupLast + 1);
    check('C 終わると全員に順位(頂上決戦の6人は 1〜6 位・ほかは順位なし)', t.status === 'done' && J(db.s.entries.map((e) => e.place).filter((p) => p).sort((a, b) => a - b)) === J([1, 2, 3, 4, 5, 6]) && db.s.rewards.length === 12, J(db.s.entries.map((e) => e.place)));
    const ai3 = db.s.matches.filter((m) => m.live.ai).length;
    check('D 答えた分だけ Claude の文・失敗は回数を戻す・上限からは呼ばない', calls === 20 && counts.refunded === 6 && ai3 === 14 && db.s.matches.filter((m) => m.live.ai).every((m) => /^実況\d+です$/.test(m.live.play)), `呼んだ${calls} 戻した${counts.refunded} 文${ai3}`);
    check('D ログに名前・本文が出ない', !logs.some((l) => /人\d|実況\d|解説\d/.test(l)));
  }

  if (fails.length) {
    console.error(`大会のサーバの関数の検査: NG ${fails.length}件(OK ${passed}件)`);
    fails.forEach((f) => console.error(`  NG: ${f}`));
    process.exit(1);
  }
  console.log(`大会のサーバの関数の検査: OK ${passed}件`);
})().catch((e) => { console.error(e); process.exit(1); });
