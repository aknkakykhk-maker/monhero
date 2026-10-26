// MFバトルカード: 助手(CPU)の「不自然な手」を数える見回りの道具(2026-10-27 カード部の割り当て・遊ぶ人の目)
//   ソラシドさん「自爆」・あつさん「山札切れ」のあと、その次の段(効き目の無い手・明らかに損な手・同じ手のくり返し)を数で見る。
//   数を出すだけで、NG にはしない(直すのは案が決まってから)。
//
//   node tools/card/card-ai-odd-moves.js [--clean] [--games 36] [--levels easy,normal,hard,expert,master] [--examples 3] [--json <出力>]
//
// 数えるもの(助手6人の総当たりを、難易度ごとに --games 試合ずつ。先攻・後攻を入れかえる)
//   ① 盤面が何も変わらない手 … 札とガッツを払ったのに、ライフ・持ちょう・印・場の全体カード・相手の手札/ガッツ/山札・自分の山札が
//      どれも変わらない(相手が守りの札を使った場合は数えない。守らせたのは効き目なので)
//   ② 無駄な守り … 守りの札を出したのに、見送った場合より受けるダメージが減らない(回避・防御だけの札。はね返す・次のターン何倍などは見ない)
//   ③ 勝てる番に攻撃を終える … 攻撃を終えた時点で、守られなければ相手の最後の子を倒せる手があった
//   ④ 最後の1体で守らない … 最後の1体で、見送ると倒れるのに、倒れずに済む守りの札があった
//   ⑤ ガッツを抱えたまま負け … 負けた側が最後に持っていたガッツ(平均と、8以上の試合の数)
//   ⑥ 同じ手のくり返し … 1つの番に同じ名前の札を3回以上・決着がつかない試合(手数の上限)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardLegalActions, cardAttackOptions, cardGuardOptions, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardDecider, cardOther, cardRngNext, CARD_AI_HABITS, CARD_AI_LEVELS };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LEVELS = opt('--levels', Object.keys(E.CARD_AI_LEVELS).join(',')).split(',');
const GAMES = Math.max(2, Number(opt('--games', 36)) || 36);
const EXAMPLES = Number(opt('--examples', 3));
const jsonOut = opt('--json', null);
// --clean … わざと雑な手・気まぐれな手を0にして回す(点の付け方そのものから出る変な手だけを見る)
const CLEAN = args.includes('--clean');
const HABITS = Object.keys(E.CARD_AI_HABITS);
const NAME = { mua: 'みゅあ', momosuke: 'ももすけ', kiki: 'きき', kyuko: 'きゅうこ', dra: 'ドラ', atsu: 'あつ' };
const cardOf = (no) => db.cards[no];
const hasEff = (c, t) => !!c && (c.effects || []).some((e) => e.t === t);
const alive = (pl) => pl.mons.filter((m) => !m.ko).length;
const lifeSum = (pl) => pl.mons.reduce((s, m) => s + (m.ko ? 0 : m.life), 0);
const busy = (st) => st.pending || st.pendingChoice || st.pendingReveal || st.pendingPray || st.pendingDiscard;

// 守り・選ぶ段などを、だれも札を使わずに進める(見送る・いちばん上を選ぶ)
const settle = (st) => {
  for (let i = 0; i < 40 && st && st.winner === null && busy(st); i++) {
    const acts = E.cardLegalActions(db, st);
    const a = acts.find((x) => x.type === 'pass') || acts.find((x) => x.type === 'pray' && !x.hand) || acts[0];
    const n = a && E.cardApplyAction(db, st, a);
    if (!n) break;
    st = n;
  }
  return st;
};

// 「盤面が変わったか」を見る指紋。手を打った人 p のガッツ・捨て札と、攻撃の回数の数えは入れない(払ったぶんなので)
const MON_SKIP = new Set(['attacks', 'lastCard']);
// p の手札は、使った札を除いた残りの中身で見る(最後の切札のように入れかえる札は、入れかわれば変化)
const finger = (st, p, used = []) => JSON.stringify({
  myHand: (() => { const h = st.players[p].hand.slice(); used.forEach((n) => { const k = h.indexOf(n); if (k >= 0) h.splice(k, 1); }); return h.sort(); })(),
  players: st.players.map((pl, i) => ({
    mons: pl.mons.map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !MON_SKIP.has(k)))),
    deck: pl.deck.length,
    ...(i === p ? {} : { hand: pl.hand.length, guts: pl.guts.length, discard: pl.discard.length }),
    gg: pl.gutsGuardUntil, pray: pl.prayTurn,
    ...Object.fromEntries(Object.entries(pl).filter(([k]) => !['mons', 'deck', 'hand', 'guts', 'discard', 'gutsGuardUntil', 'prayTurn', 'rng', 'playedTurn', 'breederUsed', 'name'].includes(k))),
  })),
  field: st.field, forbid: st.forbid, winner: st.winner,
  rest: Object.fromEntries(Object.entries(st).filter(([k]) => !['v', 'seed', 'turn', 'first', 'active', 'phase', 'players', 'pending', 'field', 'forbid', 'winner', 'reason', 'events', 'log', 'pendingChoice', 'pendingReveal', 'pendingPray', 'pendingDiscard'].includes(k))),
});

const cardsOfAct = (st, p, a) => [].concat(a.hand === undefined || a.hand === null ? [] : a.hand).map((i) => st.players[p].hand[i]).filter(Boolean);
const label = (nos) => nos.map((n) => `${n} ${(cardOf(n) || {}).name || '?'}`).join('+');

const stat = {};
const bump = (lv, key, card, ex) => {
  const s = stat[lv][key];
  s.n++;
  if (card) s.cards[card] = (s.cards[card] || 0) + 1;
  if (ex && s.ex.length < EXAMPLES) s.ex.push(ex);
};
const KEYS = ['noop', 'wasteGuard', 'missWinSure', 'missWin', 'noLastGuard', 'repeat', 'stuck'];
const TITLE = {
  noop: '① 盤面が何も変わらない手',
  wasteGuard: '② 無駄な守り(見送ったときよりダメージが減らない)',
  missWinSure: '③ 確実に勝てる番に攻撃を終える(相手は守りの札を出せない)',
  missWin: '③ 守られなければ勝てる番に攻撃を終える',
  noLastGuard: '④ 最後の1体で守らない(守れば残れた)',
  repeat: '⑥ 1つの番に同じ札を3回以上',
  stuck: '⑥ 決着がつかない試合',
};

// 守りだけの札(回避・防御)か。はね返す・次のターン何倍・空中になる などは、ダメージのほかに意味があるので②では見ない
const GUARD_ONLY = new Set(['evade', 'reduce', 'reduceHalf', 'reduceAll', 'evadeAll', 'endure']);
const pureGuard = (c) => !!c && (c.effects || []).length > 0 && (c.effects || []).every((e) => GUARD_ONLY.has(e.t));

const playGame = (lv, w0, w1, g, seed) => {
  const rnd = E.cardAiSeededRand(`odd:${lv}:${w0}:${w1}:${g}`);
  const decks = [w0, w1].map((w) => E.cardAiBuildDeck(db, w, lv, rnd));
  const pol = [w0, w1].map((w, i) => { const po = E.cardAiPolicy(w, lv, { sameBlood: !!decks[i].sameBlood }); return CLEAN ? { ...po, level: { ...po.level, sloppy: 0, whim: 0 } } : po; });
  let st = E.cardCreateGame(db, { decks, seed, first: g % 2 });
  let s = (seed * 7919) >>> 0;
  const rand = () => { const n = E.cardRngNext(s); s = n.s; return n.v; };
  let open = null; // いま見ている「手」(打ってから、守りなどが片付くまで)
  const perTurn = {};
  let steps = 0;
  const where = () => `${NAME[w0]}対${NAME[w1]} 試合${g} ${st.turn}ターン目`;
  for (; steps < 4000 && st.winner === null; steps++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? E.cardOther(st.first) : E.cardDecider(st);
    const a = E.cardAiChooseAction(db, st, pol[who], rand);
    // ---- 打つ前に見る ----
    if (a && st.phase === 'main' && !busy(st) && a.type === 'endAttacks') {
      // ③ 守られなければ勝てる手があったのに終えた
      const wins = E.cardAttackOptions(db, st).filter((o) => { const n = E.cardApplyAction(db, st, o); return n && settle(n).winner === who; });
      // 相手が守りの札を出せない手があれば「確実に勝てた」
      const sure = wins.find((o) => { const n = E.cardApplyAction(db, st, o); return !n.pending || !E.cardGuardOptions(db, n).length; });
      const win = sure || wins[0];
      if (win) bump(lv, sure ? 'missWinSure' : 'missWin', label(cardsOfAct(st, who, win)), `${where()}: ${NAME[[w0, w1][who]]}が「${label(cardsOfAct(st, who, win))}」で勝てた(ガッツ ${st.players[who].guts.length})`);
    }
    if (a && st.pending && st.pending.defender === who) {
      const me = st.players[who];
      const lifeAfter = (x) => { const n = x && E.cardApplyAction(db, st, x); return n ? settle(n) : null; };
      if (a.type === 'pass' && alive(me) === 1) {
        // ④ 見送ると倒れる(負け)のに、倒れずに済む守りがあった
        const r = lifeAfter({ type: 'pass' });
        if (r && r.winner !== null && r.winner !== who) {
          const save = E.cardGuardOptions(db, st).find((o) => { const n = lifeAfter(o); return n && n.winner !== E.cardOther(who) && alive(n.players[who]) >= 1; });
          if (save) bump(lv, 'noLastGuard', label(cardsOfAct(st, who, save)), `${where()}: ${NAME[[w0, w1][who]]}は「${label(cardsOfAct(st, who, save))}」で残れた`);
        }
      }
      if (a.type === 'guard') {
        const gc = cardOf(me.hand[a.hand]);
        if (pureGuard(gc)) {
          const ra = lifeAfter(a); const rp = lifeAfter({ type: 'pass' });
          if (ra && rp && lifeSum(ra.players[who]) <= lifeSum(rp.players[who]) && alive(ra.players[who]) <= alive(rp.players[who])) {
            const atk = cardOf(st.pending.main);
            const tg = st.pending.targets[st.pending.ti]; const tm = tg && st.players[tg.p].mons[tg.m];
            bump(lv, 'wasteGuard', `${me.hand[a.hand]} ${gc.name}`, `${where()}: 「${atk ? atk.name : '?'}」に「${gc.name}」(受ける子のライフ ${tm ? tm.life : '?'}・見送っても守っても残りライフ合計 ${lifeSum(rp.players[who])})`);
          }
        }
      }
    }
    // ① の始まり: 札を使う手
    if (a && !busy(st) && st.phase === 'main' && (a.type === 'attack' || a.type === 'breeder')) {
      const nos = cardsOfAct(st, who, a);
      const tg = a.target && st.players[a.target.p] && st.players[a.target.p].mons[a.target.m];
      const tinfo = tg ? `→${tg.name}(ライフ${tg.life}${tg.stunTurn > st.turn ? '・もう攻撃できない印' : ''}${tg.stunTurn === st.turn ? '・この番に印' : ''}${tg.ko ? '・倒れている' : ''})` : '';
      open = { p: who, nos, tinfo, before: finger(st, who, nos), oppHand: st.players[E.cardOther(who)].hand.length, oppGuts: st.players[E.cardOther(who)].guts.length, guarded: false, at: where() };
      const k = `${st.turn}:${(cardOf(nos[0]) || {}).name}`;
      perTurn[k] = (perTurn[k] || 0) + 1;
      if (perTurn[k] === 3) bump(lv, 'repeat', label(nos.slice(0, 1)), `${where()}: 「${(cardOf(nos[0]) || {}).name}」を3回`);
    }
    if (open && a && a.type === 'guard' && st.pending && st.pending.defender !== open.p) open.guarded = true;
    const next = E.cardApplyAction(db, st, a);
    if (!next) { const fb = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; st = E.cardApplyAction(db, st, fb) || st; } else st = next;
    // ① の終わり: 守りなどが片付いたら比べる
    if (open && (!busy(st) || st.winner !== null)) {
      if (!open.guarded && finger(st, open.p) === open.before) bump(lv, 'noop', label(open.nos), `${open.at}: 「${label(open.nos)}」${open.tinfo}`);
      open = null;
    }
  }
  if (st.winner === null) bump(lv, 'stuck', null, `${NAME[w0]}対${NAME[w1]} 試合${g}`);
  return { st, steps };
};

const report = {};
LEVELS.forEach((lv) => {
  stat[lv] = Object.fromEntries(KEYS.map((k) => [k, { n: 0, cards: {}, ex: [] }]));
  let games = 0, moves = 0, loserGuts = 0, loserGuts8 = 0, finished = 0, seed = 1;
  for (let i = 0; i < HABITS.length; i++) for (let j = 0; j < HABITS.length; j++) {
    if (i === j) continue;
    for (let g = 0; g < Math.max(1, Math.round(GAMES / 30)); g++) {
      const { st, steps } = playGame(lv, HABITS[i], HABITS[j], g, 9000 + seed++);
      games++; moves += steps;
      if (st.winner !== null) { finished++; const lg = st.players[E.cardOther(st.winner)].guts.length; loserGuts += lg; if (lg >= 8) loserGuts8++; }
    }
  }
  report[lv] = { games, moves, loserGutsAvg: finished ? loserGuts / finished : 0, loserGuts8, stat: stat[lv] };
  console.log(`\n==== ${lv.toUpperCase()}: ${games} 試合・${moves} 手 ====`);
  KEYS.forEach((k) => {
    const s = stat[lv][k];
    const top = Object.entries(s.cards).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, n]) => `${c}×${n}`).join(' / ');
    console.log(`${TITLE[k]}: ${s.n} 回${s.n ? `(1000手あたり ${(s.n / moves * 1000).toFixed(1)})` : ''}${top ? `  多い札: ${top}` : ''}`);
    s.ex.forEach((e) => console.log(`    例 ${e}`));
  });
  console.log(`⑤ 負けた側が最後に持っていたガッツ: 平均 ${report[lv].loserGutsAvg.toFixed(1)}・8以上 ${loserGuts8} 試合 / ${finished}`);
});
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
