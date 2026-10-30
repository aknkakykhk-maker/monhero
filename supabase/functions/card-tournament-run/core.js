// MFバトルカード大会: サーバで試合を回す中身(2026-10-30 ルールくん)。仕様は docs/progress/card-tournament/plan/README.md
// index.ts(Deno の入口)が、表の読み書き(db)・Claude(ai)・回数の数え方(take)を渡して runAll を呼ぶ。
// 検査(tools/card/card-tournament-run-check.js)は偽物を渡して、本番の表と API に触らずに確かめる。
//
// 1回の呼び出しでやること(毎日 0:30、失敗したら 1:30・2:30 にも呼ばれる。何度呼ばれても同じになるように書く)
//   1. 受付が終わった大会: 登録デッキの写しを取り、組分けと総当たりの日程を作る
//   2. その日までの試合を回す(勝ち負け・倒した数・手の並び・ルールの版)+ その日の担当の助手の実況と解説
//   3. 組の総当たりが終わったら、頂上決戦の日程を作る(組が2つ以上のとき)
//   4. 全部終わったら、順位とごほうびを書く
// ★実況・解説の本文はログに書かない。書くのは件数・エラーの種類・トークン数だけ

export const MODEL = 'claude-haiku-5-5';            // 助手のおしゃべり(card-assistant-talk)と同じ
export const LIVE_BUCKET = 'talk';                  // 回数は card_assistant_talk_take で数える(助手のおしゃべりと同じ数え方)
export const LIVE_BREEDER = 'card-tournament';      // 大会の分の名前(1日の上限は LIVE_DAILY_LIMIT)
export const LIVE_DAILY_LIMIT = 200;
export const LIVE_TOTAL_LIMIT = 2000;               // 全員の合計(card-assistant-talk と同じ)
export const LIVE_MAX_TOKENS = 500;
export const LIVE_TIMEOUT_MS = 15000;
export const LIVE_PLAY_MAX = 120;                   // 実況の字数の上限
export const LIVE_REVIEW_MAX = 160;                 // 解説の字数の上限
export const RESULT_HOUR_JST = 4;                   // 結果を見せる時刻
// 実況の担当(日ごとに順番)。公開ずみの助手
export const LIVE_ASSISTANTS = Object.freeze(['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu', 'sorashido']);
const PERSONA = Object.freeze({
  mua: { name: 'みゅあ', style: '明るく元気なムードメーカー。テンション高めで、感嘆符が多い。一人称は「みゅあ」' },
  momosuke: { name: 'ももすけ', style: '生意気かわいい小悪魔系アイドル。からかったり煽ったりする。一人称は「ももすけ」' },
  kiki: { name: 'きき', style: 'おとなしいお姉さん。落ち着いた丁寧な口調で、そっと支える。一人称は「わたし」' },
  kyuko: { name: 'きゅうこ', style: 'ゆるくて頭のいい育成上手。ふだんはゆるいが、組み方の話はくわしい。一人称は「あたし」' },
  dra: { name: 'ドラ', style: '冗談好きのおじさん。軽口をはさむが、仕組みの説明は分かりやすい。下品な冗談は書かない。一人称は「わし」' },
  atsu: { name: 'あつ', style: '上を目指す勇者で、人をよく見ているリーダー。熱く励ます。一人称は「おれ」' },
  sorashido: { name: 'ソラシド', style: 'すぐ計算したがる、熱くて陽気な攻略班のエンジニア。負けても「なんくるないさ〜」。一人称は「ぼく」' },
});
// 実況が作れなかったときの台詞(担当の助手の名前を入れる)
export const FALLBACK = Object.freeze({
  play: (name, w, l) => `${name}の実況です。${w}さんが${l}さんに勝ちました!`,
  review: () => '最後まで見ごたえのある試合でした。見返して、勝負を分けた場面を探してみてください。',
});

const DAY_MS = 86400000;
// 日本時間の日付(YYYY-MM-DD)と、その日の結果を見せる時刻
export const jstDate = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
export const addDays = (ymd, n) => jstDate(Date.parse(`${ymd}T00:00:00+09:00`) + n * DAY_MS);
export const visibleAt = (ymd) => new Date(Date.parse(`${ymd}T${String(RESULT_HOUR_JST).padStart(2, '0')}:00:00+09:00`)).toISOString();

// ---- 1. 受付の締め切り ----
export const closeEntries = async ({ db, game, tour, log }) => {
  const entries = (await db.listEntries(tour.id)).filter((e) => !e.is_assist && !e.dropped).sort((a, b) => String(a.entered_at).localeCompare(String(b.entered_at)));
  const decks = await db.decksOf(entries.map((e) => e.owner_id));
  const ok = [];
  for (const e of entries) {
    const d = decks[e.owner_id];
    if (!d || !d.deck || game.cardDeckProblems(game.CARD_BATTLE_DATA, d.deck).length) { await db.updateEntry(tour.id, e.seat_id, { dropped: true }); continue; }
    ok.push({ e, d });
  }
  const groups = game.cardTourGroups(ok.map((x) => x.e.seat_id), tour.id);
  let assistN = 0;
  const seatRows = [];
  groups.forEach((g, gi) => g.forEach((id, si) => {
    if (typeof id === 'string') {
      const { d } = ok.find((x) => x.e.seat_id === id);
      seatRows.push({ seat_id: id, patch: { grp: gi, seat: si, deck: d.deck, tactics: d.tactics || {}, deck_version: d.version || 1, user_name: d.user_name || '', icon: d.icon || null, profile_frame: d.profile_frame || null } });
    } else {
      const who = LIVE_ASSISTANTS[(game.cardTourHash(`${tour.id}|assist|${assistN}`) + assistN) % LIVE_ASSISTANTS.length];
      seatRows.push({ seat_id: `assist-${gi}-${si}`, insert: true, patch: { grp: gi, seat: si, is_assist: true, assist_id: who, user_name: (PERSONA[who] || {}).name || who } });
      assistN += 1;
    }
  }));
  for (const r of seatRows) { if (r.insert) await db.insertEntry(tour.id, r.seat_id, r.patch); else await db.updateEntry(tour.id, r.seat_id, r.patch); }
  const firstDay = jstDate(Date.parse(tour.entry_until) + 1000); // 締め切りの日(D+2)が1試合目の日
  await db.insertMatches(tour.id, game.cardTourSchedule(tour.id, groups, 'group', 0).map((m) => ({ ...m, play_on: addDays(firstDay, m.day), visible_at: visibleAt(addDays(firstDay, m.day)) })));
  await db.updateTour(tour.id, { status: 'group', first_day: firstDay, groups: groups.length });
  log({ step: 'close', tour: tour.id, players: ok.length, groups: groups.length, assists: assistN });
};

// ---- 2. 試合を回す ----
const sideOf = (e) => (e.is_assist ? { assist: e.assist_id } : { deck: e.deck, tactics: e.tactics || {} });
// 試合の要約(実況の材料)。名前・3体・倒れた順・番の数・勝ち方。手札や鍵などは入れない
export const summaryOf = (game, ea, eb, m, res) => {
  const db = game.CARD_BATTLE_DATA;
  let st = game.cardCreateGame(db, { decks: [ea.deck || null, eb.deck || null].map((d, i) => d || res.decks[i]), names: [ea.user_name, eb.user_name], seed: m.seed, first: m.first });
  const downs = [];
  for (const [, act] of res.acts) {
    const before = st.players.map((p) => p.mons.map((x) => !!x.ko));
    const n = game.cardApplyAction(db, st, act);
    if (!n) break;
    n.players.forEach((p, pi) => p.mons.forEach((x, mi) => { if (x.ko && !before[pi][mi]) downs.push({ side: pi, name: x.name, turn: n.turn }); }));
    st = n;
  }
  const monsOf = (p) => st.players[p].mons.map((x) => x.name);
  return { a: { name: ea.user_name, mons: monsOf(0) }, b: { name: eb.user_name, mons: monsOf(1) }, winner: res.winner === 0 ? 'a' : 'b', kos: res.kos, turns: st.turn, decided: res.decided, downs };
};
const livePrompt = (who, s, stage) => {
  const p = PERSONA[who] || PERSONA.kiki;
  const side = (x) => `${x.name}(${x.mons.join('・')})`;
  const downs = s.downs.map((d) => `${d.turn}番目の番に${d.side === 0 ? s.a.name : s.b.name}の${d.name}がダウン`).join('、') || 'ダウンなし';
  return {
    system: `あなたはモンスターバトルカードの大会の実況と解説をする「${p.name}」です。性格: ${p.style}。`
      + `必ず JSON だけを返す: {"play":"実況(${LIVE_PLAY_MAX}字まで)","review":"解説(${LIVE_REVIEW_MAX}字まで)"}。`
      + '実況は試合の流れを盛り上げて伝え、解説は勝負を分けたところを短く言う。数字は与えた物だけ使う。ほかの人の悪口・下品な言葉は書かない。',
    user: `${stage === 'final' ? '頂上決戦' : '総当たり'}の試合。${side(s.a)} 対 ${side(s.b)}。`
      + `勝ったのは${s.winner === 'a' ? s.a.name : s.b.name}。倒した数 ${s.a.name} ${s.kos[0]}・${s.b.name} ${s.kos[1]}。`
      + `${s.turns}番目の番で決着(${s.decided === 'deck' ? '山札切れ' : s.decided === 'limit' ? '時間切れの判定' : '全員ダウン'})。流れ: ${downs}。`,
  };
};
const clip = (t, n) => [...String(t || '').replace(/\s+/g, ' ').trim()].slice(0, n).join('');
export const makeLive = async ({ ai, take, refund, log, who, summary, stage }) => {
  const p = PERSONA[who] || PERSONA.kiki;
  const fallback = { who, play: FALLBACK.play(p.name, summary.winner === 'a' ? summary.a.name : summary.b.name, summary.winner === 'a' ? summary.b.name : summary.a.name), review: FALLBACK.review(), ai: false };
  if (!ai || !take) return fallback;
  let got = null;
  try { got = await take(LIVE_BREEDER, LIVE_BUCKET, LIVE_DAILY_LIMIT, LIVE_TOTAL_LIMIT); } catch (_) { log({ step: 'live', error: 'take' }); return fallback; }
  if (!got || !got.ok) { log({ step: 'live', error: 'limit' }); return fallback; }
  try {
    const q = livePrompt(who, summary, stage);
    const r = await ai({ model: MODEL, max_tokens: LIVE_MAX_TOKENS, system: q.system, messages: [{ role: 'user', content: q.user }], timeout: LIVE_TIMEOUT_MS });
    const text = (r && Array.isArray(r.content) ? r.content.filter((c) => c.type === 'text').map((c) => c.text).join('') : '') || '';
    const m = text.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : null;
    if (!j || typeof j.play !== 'string' || typeof j.review !== 'string' || !j.play.trim() || !j.review.trim()) throw new Error('shape');
    log({ step: 'live', ok: true, in: r.usage && r.usage.input_tokens, out: r.usage && r.usage.output_tokens });
    return { who, play: clip(j.play, LIVE_PLAY_MAX), review: clip(j.review, LIVE_REVIEW_MAX), ai: true };
  } catch (e) {
    log({ step: 'live', error: String((e && e.message) || 'ai').slice(0, 40) });
    try { if (refund) await refund(LIVE_BREEDER, LIVE_BUCKET); } catch (_) { /* 戻せなくても続ける */ }
    return fallback;
  }
};
export const playDue = async ({ db, game, tour, today, ai, take, refund, log }) => {
  const entries = await db.listEntries(tour.id);
  const seatOf = (stage, grp, seat) => entries.find((e) => (stage === 'final' ? e.final_seat === seat : e.grp === grp && e.seat === seat) && !e.dropped);
  const due = (await db.listMatches(tour.id)).filter((m) => m.winner === null && m.play_on <= today).sort((x, y) => (x.day - y.day) || (x.id - y.id));
  let n = 0;
  for (const m of due) {
    const ea = seatOf(m.stage, m.grp, m.a_seat), eb = seatOf(m.stage, m.grp, m.b_seat);
    if (!ea || !eb) { log({ step: 'play', tour: tour.id, match: m.id, error: 'seat' }); continue; }
    const res = game.cardTourPlay(game.CARD_BATTLE_DATA, sideOf(ea), sideOf(eb), { seed: m.seed, first: m.first, key: `${tour.id}|${m.stage}|${m.grp}|${m.day}` });
    // 助手の席のデッキは試合ごとに種から作るので、見返しのために試合の行へ残す
    const decks = [ea.is_assist ? res.decks && res.decks[0] : null, eb.is_assist ? res.decks && res.decks[1] : null];
    const who = LIVE_ASSISTANTS[(m.day + game.cardTourHash(tour.id)) % LIVE_ASSISTANTS.length];
    const live = await makeLive({ ai, take, refund, log, who, stage: m.stage, summary: summaryOf(game, ea, eb, m, res) });
    await db.updateMatch(m.id, { winner: res.winner, kos: res.kos, acts: res.acts, decided: res.decided, rules: res.rules, assist_decks: decks, live, done_at: new Date().toISOString() });
    m.winner = res.winner; m.kos = res.kos;
    n += 1;
  }
  if (n) log({ step: 'play', tour: tour.id, played: n });
  return n;
};

// ---- 3・4. 段の終わり ----
const stageRank = (game, entries, matches, stage, grp) => {
  const seats = entries.filter((e) => (stage === 'final' ? Number.isInteger(e.final_seat) : e.grp === grp && Number.isInteger(e.seat)) && !e.dropped);
  const size = seats.length;
  const key = (e) => (stage === 'final' ? e.final_seat : e.seat);
  const order = Array.from({ length: size }, (_, i) => { const e = seats.find((x) => key(x) === i); return e ? Date.parse(e.entered_at || 0) || i : i; });
  const ms = matches.filter((m) => m.stage === stage && (stage === 'final' || m.grp === grp)).map((m) => ({ a: m.a_seat, b: m.b_seat, winner: m.winner, kos: m.kos }));
  return game.cardTourStandings(size, ms, order).rank.map((s) => seats.find((e) => key(e) === s));
};
export const advance = async ({ db, game, tour, log }) => {
  const matches = await db.listMatches(tour.id);
  const stage = tour.status === 'final' ? 'final' : 'group';
  if (matches.some((m) => m.stage === stage && m.winner === null)) return false;
  const entries = await db.listEntries(tour.id);
  if (stage === 'group' && (tour.groups || 1) > 1) {
    const ranks = Array.from({ length: tour.groups }, (_, g) => stageRank(game, entries, matches, 'group', g).map((e) => e.seat));
    const fin = game.cardTourFinalists(ranks);
    const finalSeats = fin.map((f) => entries.find((e) => e.grp === f.group && e.seat === f.seat));
    for (let i = 0; i < finalSeats.length; i++) await db.updateEntry(tour.id, finalSeats[i].seat_id, { final_seat: i });
    const from = Math.max(...matches.map((m) => m.day)) + 1;
    const sched = game.cardTourSchedule(tour.id, [finalSeats.map((e) => e.seat_id)], 'final', from);
    await db.insertMatches(tour.id, sched.map((m) => ({ ...m, play_on: addDays(tour.first_day, m.day), visible_at: visibleAt(addDays(tour.first_day, m.day)) })));
    await db.updateTour(tour.id, { status: 'final' });
    log({ step: 'final', tour: tour.id, players: finalSeats.length });
    return true;
  }
  // 大会の終わり: 順位(頂上決戦があればその順位・無ければ1つの組の順位)と、全部の試合の勝ち数
  const ranked = stageRank(game, entries, matches, stage, 0);
  const winsOf = (e) => matches.filter((m) => m.winner !== null && ((m.stage === 'final' ? e.final_seat === (m.winner === 0 ? m.a_seat : m.b_seat) : e.grp === m.grp && e.seat === (m.winner === 0 ? m.a_seat : m.b_seat)))).length;
  const last = Math.max(...matches.map((m) => m.day));
  const rewards = [];
  for (const e of entries.filter((x) => !x.dropped)) {
    const place = ranked.indexOf(e) >= 0 ? ranked.indexOf(e) + 1 : null;
    const wins = winsOf(e);
    await db.updateEntry(tour.id, e.seat_id, { place, wins });
    if (!e.is_assist && e.owner_id) rewards.push({ owner_id: e.owner_id, ...game.cardTourRewardOf(tour.rewards, place, wins), place });
  }
  await db.insertRewards(tour.id, rewards);
  await db.updateTour(tour.id, { status: 'done', done_day: addDays(tour.first_day, last) });
  log({ step: 'done', tour: tour.id, rewards: rewards.length });
  return true;
};

// ---- 1回の呼び出し ----
export const runAll = async ({ db, game, nowMs, ai = null, take = null, refund = null, log = () => {} }) => {
  const today = jstDate(nowMs);
  const out = { closed: 0, played: 0, advanced: 0 };
  for (const tour of await db.listActive()) {
    try {
      if (tour.status === 'entry' && Date.parse(tour.entry_until) <= nowMs) { await closeEntries({ db, game, tour, log }); out.closed += 1; tour.status = 'group'; Object.assign(tour, await db.getTour(tour.id)); }
      if (tour.status === 'group' || tour.status === 'final') {
        out.played += await playDue({ db, game, tour, today, ai, take, refund, log });
        // 段が終わったら次の段へ。頂上決戦の1日目がもう来ていれば、続けて回す
        for (let k = 0; k < 2; k++) {
          if (!(await advance({ db, game, tour, log }))) break;
          out.advanced += 1;
          Object.assign(tour, await db.getTour(tour.id));
          if (tour.status !== 'final') break;
          out.played += await playDue({ db, game, tour, today, ai, take, refund, log });
        }
      }
    } catch (e) {
      log({ step: 'error', tour: tour.id, error: String((e && e.message) || e).slice(0, 80) });
    }
  }
  return out;
};
