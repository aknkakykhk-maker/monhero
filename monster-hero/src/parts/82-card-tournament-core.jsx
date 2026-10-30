// ===== MFバトルカード: 大会の計算(画面と保存を触らない) =====
// 2026-10-30 社長「作り始めて」。仕様は docs/progress/card-tournament/plan/README.md
//   ・組分け … 9人まで全員で1つの総当たり(4人に足りなければ助手)。10人以上は4〜5人の組 → 各組の優勝・準優勝で頂上決戦
//   ・総当たりの日程 … 輪の回し方(奇数は毎日1人お休み)。1日1試合
//   ・1試合 … 同じデッキ・戦術カード・種なら、どこで回しても同じ結果。手の並びを残す(見返しは手を当て直すだけ)
//   ・順位 … 勝ち数 → 倒したモンスターの数 → 2人の対戦の勝ち負け → エントリーが早い人
//   ・ごほうび … 大会ごとの表(順位ごと・参加賞・1勝ごと)
// サーバの上の関数(Edge Function card-tournament-run)も、この部品をそのまま使う(ビルドで写す)。だから画面・保存・時計(Date.now)を使わない

const CARD_TOUR_SINGLE_MAX = 9;   // 9人までは全員で1つの総当たり
const CARD_TOUR_GROUP_SIZE = 5;   // 10人以上は5人ずつを目安に組を作る
const CARD_TOUR_MIN_SEATS = 4;    // 総当たりは4人から(足りない席は助手)
const CARD_TOUR_FINAL_TOP = 2;    // 各組から頂上決戦へ進む人数(優勝・準優勝)
const CARD_TOUR_ASSIST_LEVEL = 'expert'; // 助手の席の強さ
const CARD_TOUR_MAX_STEPS = 4000;

// 文字から32ビットの数(FNV-1a)。種と、組への振り分けの混ぜ方に使う
const cardTourHash = (text) => {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
const cardTourRand = (key) => { let s = cardTourHash(key) || 1; return () => { const n = cardRngNext(s); s = n.s; return n.v; }; };
// 試合の種(大会の番号・段・組・日・2人の席から)。0 にはしない
const cardTourMatchSeed = (tourId, stage, group, day, a, b) => (cardTourHash(`${tourId}|${stage}|${group}|${day}|${a}|${b}`) % 2147483646) + 1;

// ---- 組分け ----
// ids … エントリーの番号(エントリーが早い順)。key … 締め切りで決める混ぜ方の種(大会の番号など)
// 返り値: [[席の番号…]…](組ごと)。助手の席は { assist: 何番目の助手 } で入る
const cardTourGroups = (ids, key) => {
  const list = Array.isArray(ids) ? ids.slice() : [];
  const fill = (g) => { const out = g.slice(); let k = 0; while (out.length < CARD_TOUR_MIN_SEATS) out.push({ assist: k++ }); return out; };
  if (list.length <= CARD_TOUR_SINGLE_MAX) return [fill(list)];
  // 10人以上: 締め切りの種で混ぜて、組へ順に配る(組の数 = 人数 ÷ 5 の切り上げ。4〜5人ずつになる)
  const rand = cardTourRand(`groups|${key}`);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const n = Math.ceil(list.length / CARD_TOUR_GROUP_SIZE);
  const groups = Array.from({ length: n }, () => []);
  list.forEach((id, i) => groups[i % n].push(id));
  return groups.map(fill);
};

// ---- 総当たりの日程(輪の回し方) ----
// size 人の総当たりを、1日1試合ずつの日に分ける。[[[a, b]…](その日の試合)…]。奇数は毎日1人お休み
const cardTourRoundRobin = (size) => {
  const n = Math.max(0, Math.floor(size));
  if (n < 2) return [];
  const seats = Array.from({ length: n % 2 ? n + 1 : n }, (_, i) => i); // 奇数は「お休み」の席を1つ足す
  const m = seats.length;
  const days = [];
  for (let d = 0; d < m - 1; d++) {
    const day = [];
    for (let i = 0; i < m / 2; i++) {
      const a = seats[i], b = seats[m - 1 - i];
      if (a < n && b < n) day.push(d % 2 ? [b, a] : [a, b]);
    }
    days.push(day);
    seats.splice(1, 0, seats.pop()); // 0 番は動かさず、残りを1つずつ回す
  }
  return days;
};

// 組の試合を並べる。stage … 'group' | 'final'。dayFrom … その段の1日目が大会の何日目か(0 から)
// 返り値: [{ stage, group, day, a, b, seed, first }](a・b は組の中の席の番号)
const cardTourSchedule = (tourId, groups, stage = 'group', dayFrom = 0) => {
  const out = [];
  (groups || []).forEach((g, gi) => {
    cardTourRoundRobin(g.length).forEach((pairs, d) => pairs.forEach(([a, b]) => {
      const day = dayFrom + d;
      const seed = cardTourMatchSeed(tourId, stage, gi, day, a, b);
      out.push({ stage, group: gi, day, a, b, seed, first: seed % 2 });
    }));
  });
  return out;
};
// その段の日数(いちばん人数の多い組で決まる)
const cardTourStageDays = (groups) => Math.max(0, ...(groups || []).map((g) => cardTourRoundRobin(g.length).length));

// ---- 順位 ----
// seats … 組の席の数。matches … その組の試合({ a, b, winner: 0=a・1=b・null=まだ, kos: [aが倒した数, bが倒した数] })。order … 席ごとのエントリーの早さ(小さいほど早い)
// 返り値: 席の番号を順位の順に並べたもの、と席ごとの成績
const cardTourStandings = (seats, matches, order = null) => {
  const rec = Array.from({ length: seats }, (_, i) => ({ seat: i, wins: 0, losses: 0, kos: 0 }));
  const beat = new Set();
  (matches || []).forEach((m) => {
    if (m.winner !== 0 && m.winner !== 1) return;
    const w = m.winner === 0 ? m.a : m.b, l = m.winner === 0 ? m.b : m.a;
    if (!rec[w] || !rec[l]) return;
    rec[w].wins += 1; rec[l].losses += 1;
    const k = Array.isArray(m.kos) ? m.kos : [0, 0];
    if (rec[m.a]) rec[m.a].kos += Number(k[0]) || 0;
    if (rec[m.b]) rec[m.b].kos += Number(k[1]) || 0;
    beat.add(`${w}>${l}`);
  });
  const early = (i) => (Array.isArray(order) && Number.isFinite(order[i]) ? order[i] : i);
  // 2人の対戦の勝ち負けは、勝ち数と倒した数がちょうど2人だけ並んだときに使う(3人以上が並ぶと勝ち負けが回って決まらないので、エントリーの早さ)
  const tie = (r) => `${r.wins}|${r.kos}`;
  const tied = {};
  rec.forEach((r) => { tied[tie(r)] = (tied[tie(r)] || 0) + 1; });
  const rank = rec.slice().sort((x, y) => (y.wins - x.wins) || (y.kos - x.kos)
    || (tied[tie(x)] === 2 ? (beat.has(`${x.seat}>${y.seat}`) ? -1 : beat.has(`${y.seat}>${x.seat}`) ? 1 : 0) : 0)
    || (early(x.seat) - early(y.seat))).map((r) => r.seat);
  return { rank, rec };
};
// 頂上決戦に進む席(組ごとの順位から、上から CARD_TOUR_FINAL_TOP 人)。組が1つなら頂上決戦は無い(null)
const cardTourFinalists = (groupRanks) => (Array.isArray(groupRanks) && groupRanks.length > 1
  ? groupRanks.flatMap((rank, gi) => rank.slice(0, CARD_TOUR_FINAL_TOP).map((seat) => ({ group: gi, seat })))
  : null);

// ---- トーナメント(勝ち抜き。2026-10-30 個人杯で使う。公式杯の頂上決戦にも切りかえられるように、組分けの部品とは分けておく) ----
//   席の番号(0 から)を締め切りの種で混ぜた順を「種順」とし、種順の上位どうしが早く当たらない並び(1-16・8-9 …)にする。
//   人数が2のべき乗でないときは、足りない分が上位の種の「不戦勝」(1回戦の相手が null)
const CARD_TOUR_KO_MAX = 16;
const cardTourKoSize = (n) => { let s = 2; while (s < n) s *= 2; return s; };
// 山の並び(位置 → 種順)。size=8 なら [0,7,3,4,1,6,2,5]
const cardTourKoOrder = (size) => {
  let o = [0];
  while (o.length < size) { const m = o.length * 2; o = o.flatMap((x) => [x, m - 1 - x]); }
  return o;
};
// 1回戦の組み合わせ。n … 人数(2〜CARD_TOUR_KO_MAX)/ key … 締め切りの種。返り値: [[a, b]…](b が null なら a の不戦勝)
const cardTourKoFirst = (n, key) => {
  const size = cardTourKoSize(n);
  const r = cardTourRand(`${key}|ko`);
  const seeds = Array.from({ length: n }, (_, i) => ({ i, w: r() })).sort((x, y) => x.w - y.w).map((x) => x.i);
  const slot = cardTourKoOrder(size).map((rank) => (rank < n ? seeds[rank] : null));
  return Array.from({ length: size / 2 }, (_, k) => (slot[2 * k] === null ? [slot[2 * k + 1], null] : [slot[2 * k], slot[2 * k + 1]]));
};
// その回戦の勝ち上がり(不戦勝は a)。まだ決まっていない試合があれば null
const cardTourKoWinners = (pairs, results) => {
  const out = [];
  for (let k = 0; k < pairs.length; k++) {
    const [a, b] = pairs[k];
    if (b === null) { out.push(a); continue; }
    const w = results[k];
    if (w !== 0 && w !== 1) return null;
    out.push(w === 0 ? a : b);
  }
  return out;
};
// 次の回戦の組み合わせ(勝ち上がりを隣どうしで)。優勝が決まったら []
const cardTourKoNextPairs = (winners) => (winners.length < 2 ? [] : Array.from({ length: winners.length / 2 }, (_, k) => [winners[2 * k], winners[2 * k + 1]]));
// その回戦の試合を並べる(不戦勝は試合にしない)。round … 何回戦か(0 から)
// 返り値: [{ stage, group: 0, day: dayFrom + round, round, slot, a, b, seed, first }]
const cardTourKoMatches = (tourId, pairs, round, stage = 'ko', dayFrom = 0) => pairs.flatMap(([a, b], slot) => {
  if (b === null) return [];
  const seed = cardTourMatchSeed(tourId, stage, round, slot, a, b);
  return [{ stage, group: 0, day: dayFrom + round, round, slot, a, b, seed, first: seed % 2 }];
});
// 順位: 優勝 1・準優勝 2・準決勝で負け 3・その前の回戦で負け 5・9 …(同じ回戦で負けた人は同じ順位)
//   rounds … [{ pairs, results }](1回戦から)。返り値: { [席]: 順位 }。まだ決まっていない人は入らない
const cardTourKoPlaces = (rounds) => {
  const out = {};
  const total = rounds.length ? Math.log2(rounds[0].pairs.length * 2) : 0;
  rounds.forEach(({ pairs, results }, r) => {
    const left = total - r; // この回戦に残っている山の段(決勝は 1)
    pairs.forEach(([a, b], k) => {
      if (b === null) return;
      const w = results[k];
      if (w !== 0 && w !== 1) return;
      out[w === 0 ? b : a] = 2 ** (left - 1) + 1;
      if (left === 1) out[w === 0 ? a : b] = 1;
    });
  });
  return out;
};

// ---- 1試合 ----
// side … { deck, tactics }(エントリーの写し)か { assist: 助手の id }(助手の席)。key … 助手のデッキを決める種の名前
// 返り値: { winner: 0|1, kos: [0側が倒した数, 1側が倒した数], acts: [[打った人, 手]…], steps, decided: 'ko'|'deck'|'limit', rules, decks: [0側, 1側] }
//   decks … 使ったデッキ(助手の席は種から作るので、見返しのために返す)
const cardTourSidePolicy = (db, side, key) => {
  if (side && side.assist) {
    const deck = cardAiBuildDeck(db, side.assist, CARD_TOUR_ASSIST_LEVEL, cardAiSeededRand(`tour|${key}|${side.assist}`));
    return { deck, policy: cardAiPolicy(side.assist, CARD_TOUR_ASSIST_LEVEL, { sameBlood: !!deck.sameBlood }) };
  }
  return { deck: side.deck, policy: cardSharePolicy(side.tactics, 'normal') };
};
const cardTourPlay = (db, sideA, sideB, { seed, first = 0, key = '' }) => {
  const A = cardTourSidePolicy(db, sideA, `${key}|a`), B = cardTourSidePolicy(db, sideB, `${key}|b`);
  let st = cardCreateGame(db, { decks: [A.deck, B.deck], names: ['A', 'B'], seed, first });
  // 打ち方の気まぐれも種から決める(サーバで何度回しても同じ手になる)
  let r = (seed * 7919) >>> 0 || 1;
  const rand = () => { const n = cardRngNext(r); r = n.s; return n.v; };
  const pol = [A.policy, B.policy];
  const acts = [];
  let steps = 0;
  for (; steps < CARD_TOUR_MAX_STEPS && st.winner === null; steps++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? cardOther(st.first) : cardDecider(st);
    let act = cardAiChooseAction(db, st, pol[who], rand);
    let next = act && cardApplyAction(db, st, act);
    if (!next) {
      // 出せない手を選んだときは、どの端末でも通る手に替える(見返しでも同じ手を当てるので、替えた手を残す)
      act = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null;
      next = act && cardApplyAction(db, st, act);
      if (!next) break;
    }
    acts.push([who, act]);
    st = next;
  }
  const kos = [cardKoCount(st, 0), cardKoCount(st, 1)];
  const decks = [A.deck, B.deck];
  if (st.winner === 0 || st.winner === 1) return { winner: st.winner, kos, acts, steps, decided: /山札/.test(String(st.reason || '')) ? 'deck' : 'ko', rules: typeof CARD_REPLAY_RULES !== 'undefined' ? CARD_REPLAY_RULES : null, decks };
  // 手の数の上限まで決着しなかった(まず起きない): 倒した数 → 残りのライフの合計 → 後攻の勝ち
  const life = (p) => st.players[p].mons.reduce((a, m) => a + Math.max(0, m.ko ? 0 : m.life), 0);
  const winner = kos[0] !== kos[1] ? (kos[0] > kos[1] ? 0 : 1) : life(0) !== life(1) ? (life(0) > life(1) ? 0 : 1) : cardOther(first);
  return { winner, kos, acts, steps, decided: 'limit', rules: typeof CARD_REPLAY_RULES !== 'undefined' ? CARD_REPLAY_RULES : null, decks };
};

// ---- ごほうびの表(大会ごと。表の1行に持たせる) ----
// { ranks: [{ point }…](1位から), participation: { point }, perWin: 1勝ごとのビートP }。ごほうびはビートPだけ(2026-10-30 社長。称号・プロフィール枠は出さない)
const cardTourNormalizeRewards = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100000, Math.floor(Number(v)))) : 0);
  const ranks = (Array.isArray(r.ranks) ? r.ranks : []).slice(0, 16).map((x) => ({ point: num(x && x.point) }));
  return { ranks, participation: { point: num(r.participation && r.participation.point) }, perWin: num(r.perWin) };
};
// その人のごほうび。place … 大会の順位(1 から。頂上決戦に出なかった人は null)・wins … 全部の試合で勝った数
const cardTourRewardOf = (rewards, place, wins) => {
  const t = cardTourNormalizeRewards(rewards);
  const r = Number.isInteger(place) && place >= 1 ? t.ranks[place - 1] : null;
  const base = r ? r.point : t.participation.point;
  return { point: base + t.perWin * (Math.max(0, Math.floor(Number(wins) || 0))) };
};
