// MFバトルカード 個人杯のオート杯を回す(2026-10-31 ルールくん)。card-tournament-run の中身の一部。仕様は docs/spec/CARD_CUP.md
// 何度呼ばれても同じになるように書く(10分おきに呼ばれる)。1回に回す試合は、公式杯と分け合う budget の残りまで
//   1. 締め切り(entry_until)を過ぎた杯: 登録デッキの写しを取り、席を決め、1回戦(総当たりは全部)の試合を作る。2人に足りなければ中止
//   2. 発表(start_at)の2時間前から: 試合を回す。トーナメントは回戦が終わるごとに次の回戦を作る
//   3. 全部終わったら: 順位・勝ち数を書いて 'done'(画面に出るのは発表の時刻から。SQL の card_cup_view が見る)
// 実況・解説は優勝が決まった1試合だけ AI(回数を抑える)。ほかの試合は書かない
import { makeLive, summaryOf, LIVE_ASSISTANTS } from './core.js';

export const CUP_PLAY_LEAD_MS = 2 * 3600000; // 発表の何時間前から回し始めるか
export const CUP_MIN_PLAYERS = 2;

const sideOf = (e) => ({ deck: e.deck, tactics: e.tactics || {} });

// 1. 締め切り
export const cupClose = async ({ db, game, cup, log }) => {
  const entries = (await db.cupEntries(cup.id)).filter((e) => !e.dropped).sort((a, b) => String(a.entered_at).localeCompare(String(b.entered_at)));
  const decks = await db.decksOf(entries.map((e) => e.owner_id));
  const ok = [];
  for (const e of entries) {
    const d = decks[e.owner_id];
    if (!d || !d.deck || game.cardDeckProblems(game.CARD_BATTLE_DATA, d.deck).length) { await db.updateCupEntry(cup.id, e.owner_id, { dropped: true }); continue; }
    ok.push({ e, d });
  }
  if (ok.length < CUP_MIN_PLAYERS) {
    await db.updateCup(cup.id, { status: 'closed', closed_reason: 'few' });
    log({ step: 'cup-close', cup: cup.id, players: ok.length, closed: true });
    return;
  }
  for (let i = 0; i < ok.length; i++) {
    const { e, d } = ok[i];
    await db.updateCupEntry(cup.id, e.owner_id, { seat: i, deck: d.deck, tactics: d.tactics || {}, deck_version: d.version || 1 });
  }
  const n = ok.length;
  let bracket = null;
  let rows;
  if (cup.format === 'ko') {
    const first = game.cardTourKoFirst(n, cup.id);
    bracket = { rounds: [first] };
    rows = game.cardTourKoMatches(cup.id, first, 0, 'ko');
  } else {
    rows = game.cardTourSchedule(cup.id, [Array.from({ length: n }, (_, i) => i)], 'rr', 0).map((m, k) => ({ ...m, round: m.day, slot: k }));
  }
  await db.insertCupMatches(cup.id, rows);
  await db.updateCup(cup.id, { status: 'running', ...(bracket ? { bracket } : {}) });
  log({ step: 'cup-close', cup: cup.id, players: n, matches: rows.length });
};

// トーナメントの回戦ごとの結果([{ pairs, results }])
const koRounds = (cup, matches) => (cup.bracket && Array.isArray(cup.bracket.rounds) ? cup.bracket.rounds : []).map((pairs, r) => ({
  pairs, results: pairs.map((_, k) => { const m = matches.find((x) => x.round === r && x.slot === k); return m ? m.winner : null; }),
}));
// この試合で優勝が決まるか(トーナメントは決勝・総当たりは最後の試合)
const isFinal = (cup, matches, m) => (cup.format === 'ko'
  ? (cup.bracket.rounds[m.round] || []).length === 1
  : m.id === Math.max(...matches.map((x) => x.id)));

// 2. 試合を回す
export const cupPlay = async ({ db, game, cup, ai, take, refund, log, budget }) => {
  const entries = (await db.cupEntries(cup.id)).filter((e) => !e.dropped && Number.isInteger(e.seat));
  const bySeat = (s) => entries.find((e) => e.seat === s);
  let played = 0;
  for (let guard = 0; guard < 8; guard++) {
    const matches = await db.cupMatches(cup.id);
    const due = matches.filter((m) => m.winner === null).sort((x, y) => (x.round - y.round) || (x.slot - y.slot));
    for (const m of due) {
      if (budget.left <= 0) { log({ step: 'cup-play', cup: cup.id, more: true }); return played; }
      const ea = bySeat(m.a_seat), eb = bySeat(m.b_seat);
      if (!ea || !eb) { log({ step: 'cup-play', cup: cup.id, match: m.id, error: 'seat' }); continue; }
      const t0 = Date.now();
      const res = game.cardTourPlay(game.CARD_BATTLE_DATA, sideOf(ea), sideOf(eb), { seed: m.seed, first: m.first, key: `${cup.id}|${m.round}|${m.slot}` });
      let live = null;
      if (isFinal(cup, matches, m)) {
        const summary = summaryOf(game, ea, eb, m, res);
        budget.left -= Date.now() - t0;
        const who = LIVE_ASSISTANTS[game.cardTourHash(cup.id) % LIVE_ASSISTANTS.length];
        live = await makeLive({ ai, take, refund, log, who, stage: 'final', summary });
      } else budget.left -= Date.now() - t0;
      await db.updateCupMatch(m.id, { winner: res.winner, kos: res.kos, acts: res.acts, decided: res.decided, rules: res.rules, live, done_at: new Date().toISOString() });
      m.winner = res.winner; m.kos = res.kos;
      played += 1;
    }
    if (cup.format !== 'ko') return played;
    // トーナメント: 回戦が終わったら次の回戦を作る
    const rounds = koRounds(cup, matches);
    const last = rounds[rounds.length - 1];
    const winners = last ? game.cardTourKoWinners(last.pairs, last.results) : null;
    if (!winners || winners.length < 2) return played;
    const next = game.cardTourKoNextPairs(winners);
    const r = rounds.length;
    cup.bracket = { rounds: [...cup.bracket.rounds, next] };
    await db.insertCupMatches(cup.id, game.cardTourKoMatches(cup.id, next, r, 'ko'));
    await db.updateCup(cup.id, { bracket: cup.bracket });
  }
  return played;
};

// 3. 終わり(全部の試合に勝ち負けが付いた・トーナメントは優勝が決まった)
export const cupFinish = async ({ db, game, cup, log }) => {
  const matches = await db.cupMatches(cup.id);
  if (!matches.length || matches.some((m) => m.winner === null)) return false;
  const entries = (await db.cupEntries(cup.id)).filter((e) => !e.dropped && Number.isInteger(e.seat));
  const n = entries.length;
  let placeOf;
  if (cup.format === 'ko') {
    const rounds = koRounds(cup, matches);
    const last = rounds[rounds.length - 1];
    const w = last && game.cardTourKoWinners(last.pairs, last.results);
    if (!w || w.length !== 1) return false;
    const places = game.cardTourKoPlaces(rounds);
    placeOf = (s) => places[s] || null;
  } else {
    const order = Array.from({ length: n }, (_, i) => i);
    const rank = game.cardTourStandings(n, matches.map((m) => ({ a: m.a_seat, b: m.b_seat, winner: m.winner, kos: m.kos })), order).rank;
    placeOf = (s) => rank.indexOf(s) + 1;
  }
  for (const e of entries) {
    const wins = matches.filter((m) => (m.winner === 0 ? m.a_seat : m.b_seat) === e.seat).length;
    await db.updateCupEntry(cup.id, e.owner_id, { place: placeOf(e.seat), wins });
  }
  await db.updateCup(cup.id, { status: 'done', done_at: new Date().toISOString() });
  log({ step: 'cup-done', cup: cup.id, players: n });
  return true;
};

// 1回の呼び出しでオート杯を回す(公式杯のあと。budget は公式杯と分け合う)
export const runCups = async ({ db, game, nowMs, ai = null, take = null, refund = null, log = () => {}, budget }) => {
  const out = { closed: 0, played: 0, done: 0 };
  for (const cup of await db.listOpenCups()) {
    if (cup.mode !== 'auto') continue;
    try {
      if (cup.status === 'entry' && Date.parse(cup.entry_until) <= nowMs) {
        await cupClose({ db, game, cup, log }); out.closed += 1;
        Object.assign(cup, await db.getCup(cup.id));
      }
      if (cup.status !== 'running' || nowMs < Date.parse(cup.start_at) - CUP_PLAY_LEAD_MS) continue;
      out.played += await cupPlay({ db, game, cup, ai, take, refund, log, budget });
      if (await cupFinish({ db, game, cup, log })) out.done += 1;
    } catch (e) {
      log({ step: 'cup-error', cup: cup.id, error: String((e && e.message) || e).slice(0, 80) });
    }
  }
  return out;
};
