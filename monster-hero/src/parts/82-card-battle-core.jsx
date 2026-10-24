// ===== MFバトルカード: ルールの本体とコンピューターの考え方(純粋な計算) =====
// 紙の『モンスターファームバトルカード』のルールを、カードの文のとおりに動かす。
// 設計: docs/spec/CARD_BATTLE.md(1-3 ルール本文・2-3 効果の部品・5-5 コンピューター戦)。元のルールの正本は docs/spec/card-battle/RULES_SOURCE.md
// ★この部品は pure(React・画面・保存・タイマーを触らない)。カードの表(CARD_BATTLE_DATA)は引数で受け取る。
//   同じ式を検査(tools/card/card-rules-check.js)とコンピューターどうしの対戦(勝率を出す)でもそのまま使う。
//
// 状態はただのオブジェクトで、操作のたびに作り直して返す(画面はそれを描くだけ)。
//   players[0/1] … mons(場の3体)・deck(山札・上が末尾)・hand(手札)・guts(ガッツ・新しく置いたものが末尾)・discard(捨て札)
//   phase … 'setup'(後攻が始める前に2枚までガッツ)/ 'main'(攻撃)/ 'guts'(手札をガッツへ)/ 'over'
//   pending … 攻撃を受けている途中(守る側が回避・防御を出せる)
//
// 効果の部品(tools/card/card-data-build.js がカードの文から作る。名前はここが正本)
//   攻撃: noEvade 回避されない / halfOnEvade 回避されても半分(切り上げ) / stunOnHit 当てた子は次のターン攻撃できない /
//         selfDamageIfHit(n) 回避されなかったら自分もnダメージ / selfDamageIfEvaded(n) / selfDamage(n) 使ったら自分もn /
//         gutsLossOnHit(n|'all') 当てたら相手のガッツを減らす / noBlockReduce 防御で減らされない /
//         area(who:'enemies'|'others', only:'ground'|'air') 全員に / cannotHit(type) その特徴の子には当たらない /
//         onlyHit(type) その特徴の子にしか当たらない / multVs(type,n) その特徴の子にはn倍 / drain 与えたぶん回復 /
//         chain(names) 同じターンに続けて使える / combo(names,table) 同時に使う種類の数でダメージが変わる / nonLethal とどめにならない
//   付ける: attach(when) 技に付けて使う(攻撃の回数に数えない) / attachMult(n) 付けた技のダメージn倍
//   特殊: draw(n) / peekHand / discardOpp(n) 相手が選んで捨てる / heal(n) 味方1体 / forbidThisTurn(kinds) このターン相手は回避(防御)を使えない
//         gutsGuard 次のターンまでガッツを減らされない / charge(kinds,n) 次のその種類の技1回をn倍(ダメージを受けると消える)
//   使える時: useWhen(lifeMax) 自分のライフがその数以下のときだけ出せる
//   守り: evade(kinds,minGuts) / reduce(kinds,n) / reduceHalf(kinds) 半分(切り捨て)減らす / reduceAll(kinds) / reflect(kinds,frac,keep) はね返す /
//         cover 味方への1回分を自分が受ける / nextTurnMult(kinds,n) 次の自分のターンの技n倍 / becomeAir 次のターン終わりまで空中
//
// 決まり(社長が決めたもの。台帳 2026-10-24)
//   ・各モンスターは1ターンに攻撃用の技(ちから・かしこさ・特殊)1枚まで。ただしカードの文が先(chain・combo・attach)
//   ・ブリーダーカードは1ターン1枚。モンスターの攻撃とは別(加勢はその子が攻撃したあとにも使える)
//   ・特殊技はふつうの回避・防御で守れない
//   ・回避されても半分は切り上げ(文に「切り捨て」とあるカードは文のとおり)
//   ・最後の1体どうしが同時に倒れたら攻撃した側の勝ち
//   ・全員に当たる技は、狙われた1体ずつ守るかどうかを選べる
//   ・相手の手札を捨てさせるのは、捨てる側が選ぶ
const CARD_BATTLE_HAND_MAX = 5;
const CARD_BATTLE_DECK_SIZE = 50;
const CARD_BATTLE_SETUP_GUTS_MAX = 2;
const CARD_BATTLE_LOG_MAX = 80;

// ---- 乱数(種から決まる。対人戦で両方の端末が同じ山札になるように) ----
const cardRngNext = (s) => {
  let t = (s + 0x6D2B79F5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { s: t, v: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
};
const cardShuffle = (arr, seed) => {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    const n = cardRngNext(s); s = n.s;
    const j = Math.floor(n.v * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { list: a, seed: s };
};

const cardEff = (card, t) => (card && Array.isArray(card.effects) ? card.effects.find((e) => e && e.t === t) : null);
const cardHasEff = (card, t) => !!cardEff(card, t);
const cardOf = (db, no) => (db && db.cards && db.cards[no]) || null;
const cardMonsterOf = (db, no) => (db && db.monsters && db.monsters[no]) || null;
const cardIsAttackKind = (k) => k === 'pow' || k === 'int' || k === 'spe';
const cardIsGuardKind = (k) => k === 'dge' || k === 'blk';
const cardClone = (st) => JSON.parse(JSON.stringify(st));
const cardOther = (p) => 1 - p;

// その子が、そのカードを使えるか(専用の技は書いてある種族だけ。全モンスターは誰でも。混血はメイン=攻撃・特殊/サブ=防御・回避も)
const cardUsableBy = (card, mon) => {
  if (!card || !mon || mon.ko) return false;
  if (card.user === 'any') return true;
  if (card.user === 'breeder') return false;
  if (card.user === mon.species) return true;
  if (mon.main && card.user === mon.main) return true;
  if (mon.sub && card.user === mon.sub && cardIsGuardKind(card.kind)) return true;
  return false;
};
// いまの特徴(空中・地上・水中)。ジャンプなどで期限つきで空中になる
const cardMonType = (mon, turn) => (mon.airUntil >= turn ? 'air' : mon.type);

const cardLog = (st, text, extra) => {
  st.log.push({ turn: st.turn, text, ...(extra || {}) });
  if (st.log.length > CARD_BATTLE_LOG_MAX) st.log.splice(0, st.log.length - CARD_BATTLE_LOG_MAX);
};
const cardEvent = (st, ev) => { st.events.push(ev); };

// ---- ゲームを始める ----
// decks: [{ monsters:[3つの番号], cards:[50枚の番号] }, …]。first: 先攻(0/1)
const cardCreateGame = (db, { decks, names = ['あなた', 'あいて'], seed = 1, first = 0 }) => {
  let s = seed >>> 0;
  const players = decks.map((d, i) => {
    const sh = cardShuffle(d.cards, s); s = sh.seed;
    const mons = d.monsters.map((no) => {
      const m = cardMonsterOf(db, no);
      return { no, species: m.species, name: m.name, main: m.main || null, sub: m.sub || null, type: m.type, life: m.life, max: m.life,
        ko: false, attacks: 0, lastCard: null, stunTurn: -1, airUntil: -1, mult: null, charge: null };
    });
    const deck = sh.list;
    const hand = deck.splice(deck.length - CARD_BATTLE_HAND_MAX, CARD_BATTLE_HAND_MAX).reverse();
    return { name: names[i] || `P${i + 1}`, mons, deck, hand, guts: [], discard: [], breederUsed: false, gutsGuardUntil: -1 };
  });
  const st = { v: 1, seed: s, turn: 0, first, active: cardOther(first), phase: 'setup', players, pending: null, forbid: {}, winner: null, reason: null, log: [], events: [] };
  cardLog(st, `${players[first].name}が先攻、${players[cardOther(first)].name}が後攻`);
  return st;
};

const cardGameOver = (st, winner, reason) => {
  if (st.winner !== null) return;
  st.winner = winner; st.reason = reason; st.phase = 'over'; st.pending = null;
  cardLog(st, `${st.players[winner].name}の勝ち(${reason})`, { kind: 'over' });
  cardEvent(st, { t: 'over', winner, reason });
};

// ターンのはじめ: ドロー(手札5枚まで。5枚なら山札の上をガッツへ)。引けなければ負け
const cardBeginTurn = (st) => {
  st.turn += 1;
  const p = st.active;
  const me = st.players[p];
  me.breederUsed = false;
  st.forbid = {};
  me.mons.forEach((m) => { m.attacks = 0; m.lastCard = null; });
  st.phase = 'main';
  cardLog(st, `ターン${st.turn}: ${me.name}の番`, { kind: 'turn' });
  cardEvent(st, { t: 'turn', p, turn: st.turn });
  if (st.turn === 1) return; // 先攻の1ターン目は引かない
  if (me.hand.length >= CARD_BATTLE_HAND_MAX) {
    if (!me.deck.length) { cardGameOver(st, cardOther(p), '山札切れ'); return; }
    me.guts.push(me.deck.pop());
    cardLog(st, `${me.name}の手札は5枚なので、山札の上をガッツにした`);
    return;
  }
  while (me.hand.length < CARD_BATTLE_HAND_MAX) {
    if (!me.deck.length) { cardGameOver(st, cardOther(p), '山札切れ'); return; }
    me.hand.push(me.deck.pop());
  }
};

const cardPayGuts = (st, p, n) => {
  const me = st.players[p];
  for (let i = 0; i < n; i++) me.discard.push(me.guts.pop());
};
const cardLoseGuts = (st, p, n) => {
  const me = st.players[p];
  if (me.gutsGuardUntil >= st.turn) { cardLog(st, `${me.name}のガッツは減らされなかった(精神集中)`); return 0; }
  const k = n === 'all' ? me.guts.length : Math.min(n, me.guts.length);
  for (let i = 0; i < k; i++) me.discard.push(me.guts.pop());
  return k;
};
const cardTakeFromHand = (st, p, idxs) => {
  const me = st.players[p];
  const sorted = [...new Set(idxs)].sort((a, b) => b - a);
  const taken = sorted.map((i) => me.hand[i]);
  sorted.forEach((i) => me.hand.splice(i, 1));
  return taken;
};

// 攻撃の総ガッツ(付ける札も含む)
const cardActionCost = (db, st, p, hand, idxs) => idxs.reduce((s, i) => s + ((cardOf(db, hand[i]) || {}).guts || 0), 0);

// その子が、いまもう一度攻撃できるか(1ターン1枚。chain の続きだけはもう一度)
const cardMonCanAttack = (db, st, p, mi, card) => {
  const mon = st.players[p].mons[mi];
  if (!mon || mon.ko) return false;
  if (mon.stunTurn === st.turn) return false;
  if (mon.attacks === 0) return true;
  const prev = cardOf(db, mon.lastCard);
  const chainNow = cardEff(card, 'chain');
  const chainPrev = cardEff(prev, 'chain');
  if (chainNow && chainPrev && chainNow.names.includes(prev.name) && chainPrev.names.includes(card.name)) return true;
  return false;
};

// 狙える相手か(cannotHit・onlyHit)
const cardCanTarget = (card, target, turn) => {
  if (!target || target.ko) return false;
  const ty = cardMonType(target, turn);
  const ch = cardEff(card, 'cannotHit'); if (ch && ch.type === ty) return false;
  const oh = cardEff(card, 'onlyHit'); if (oh && oh.type !== ty) return false;
  return true;
};

// 全員に当たる技の相手(自分以外の地上の全員、なら味方も入る)
const cardAreaTargets = (st, p, mi, card) => {
  const ar = cardEff(card, 'area');
  const out = [];
  const pushIf = (q, j) => {
    const t = st.players[q].mons[j];
    if (t.ko) return;
    if (ar.only && cardMonType(t, st.turn) !== ar.only) return;
    out.push({ p: q, m: j });
  };
  st.players[cardOther(p)].mons.forEach((_, j) => pushIf(cardOther(p), j));
  if (ar.who === 'others') st.players[p].mons.forEach((_, j) => { if (j !== mi) pushIf(p, j); });
  return out;
};

// ---- いまできる操作 ----
// 攻撃の候補を全部並べる(コンピューターと画面の「使えるカード」の両方に使う)
const cardAttackOptions = (db, st) => {
  if (st.phase !== 'main' || st.pending || st.winner !== null) return [];
  const p = st.active;
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  const guts = me.guts.length;
  const out = [];
  me.hand.forEach((no, hi) => {
    const card = cardOf(db, no);
    if (!card || !card.ready || !cardIsAttackKind(card.kind)) return;
    if (cardHasEff(card, 'attach')) return; // 付ける札は単独では出さない(下で技に付ける)
    if (card.user === 'breeder') {
      if (me.breederUsed) return;
      if (card.guts > guts) return;
      if (card.kind === 'spe') {
        if (cardHasEff(card, 'heal')) me.mons.forEach((m, j) => { if (!m.ko && m.life < m.max) out.push({ type: 'breeder', hand: [hi], target: { p, m: j } }); });
        else out.push({ type: 'breeder', hand: [hi], target: null });
      } else {
        me.mons.forEach((m, mi) => { if (m.ko) return; opp.mons.forEach((t, j) => { if (cardCanTarget(card, t, st.turn)) out.push({ type: 'breeder', hand: [hi], mon: mi, target: { p: cardOther(p), m: j } }); }); });
      }
      return;
    }
    me.mons.forEach((mon, mi) => {
      if (!cardUsableBy(card, mon) || !cardMonCanAttack(db, st, p, mi, card)) return;
      const uw = cardEff(card, 'useWhen'); if (uw && uw.lifeMax !== undefined && mon.life > uw.lifeMax) return; // 最終奥義など: ライフが少ないときだけ
      const combo = cardEff(card, 'combo');
      // 同時に使う札の組(右爪・左爪・ツノ)。いちばん小さい手札の番号の札を主にして、ほかを足す
      const sets = [[hi]];
      if (combo) {
        const others = me.hand.map((n2, j) => ({ j, c: cardOf(db, n2) })).filter(({ j, c }) => j !== hi && c && combo.names.includes(c.name) && c.name !== card.name && cardUsableBy(c, mon));
        const byName = {};
        others.forEach((o) => { if (!(o.c.name in byName)) byName[o.c.name] = o.j; });
        const names = Object.keys(byName);
        if (names.length >= 1) { names.forEach((n) => sets.push([hi, byName[n]])); }
        if (names.length >= 2) sets.push([hi, byName[names[0]], byName[names[1]]]);
        // 同じ組を別の主の札で二重に数えない(主は組の中でいちばん小さい手札の番号)
        for (let k = sets.length - 1; k >= 0; k--) if (Math.min(...sets[k]) !== hi) sets.splice(k, 1);
      }
      // 付ける札(底力など)
      const attachIdx = me.hand.map((n2, j) => ({ j, c: cardOf(db, n2) })).filter(({ j, c }) => j !== hi && c && c.ready && cardHasEff(c, 'attach') && cardUsableBy(c, mon) && (() => {
        const w = cardEff(c, 'attach').when || {};
        if (w.lifeMax !== undefined && mon.life > w.lifeMax) return false;
        return card.kind === 'pow' || card.kind === 'int';
      })()).map((o) => o.j);
      const withAttach = [];
      sets.forEach((s) => { withAttach.push(s); attachIdx.forEach((a) => withAttach.push([...s, a])); });
      withAttach.forEach((idxs) => {
        const cost = cardActionCost(db, st, p, me.hand, idxs);
        if (cost > guts) return;
        if (card.kind === 'spe') {
          if (cardHasEff(card, 'heal')) me.mons.forEach((m, j) => { if (!m.ko && m.life < m.max) out.push({ type: 'attack', mon: mi, hand: idxs, target: { p, m: j } }); });
          else out.push({ type: 'attack', mon: mi, hand: idxs, target: null });
          return;
        }
        if (cardHasEff(card, 'area')) {
          if (cardAreaTargets(st, p, mi, card).some((t) => t.p !== p)) out.push({ type: 'attack', mon: mi, hand: idxs, target: null });
          return;
        }
        opp.mons.forEach((t, j) => { if (cardCanTarget(card, t, st.turn)) out.push({ type: 'attack', mon: mi, hand: idxs, target: { p: cardOther(p), m: j } }); });
      });
    });
  });
  return out;
};

// 守りの候補(攻撃を受けている途中だけ)。狙われた子が使えるカード・誰でも使える守り・味方をかばう札
const cardGuardOptions = (db, st) => {
  const pd = st.pending;
  if (!pd || st.winner !== null) return [];
  const q = pd.defender;
  const me = st.players[q];
  const tgt = pd.targets[pd.ti];
  if (!tgt) return [];
  const target = st.players[tgt.p].mons[tgt.m];
  const atkCard = cardOf(db, pd.main);
  const forbid = st.forbid[q] || [];
  const guts = me.guts.length;
  const out = [];
  me.hand.forEach((no, hi) => {
    const c = cardOf(db, no);
    if (!c || !c.ready || !cardIsGuardKind(c.kind)) return;
    if (forbid.includes(c.kind)) return;
    if (c.guts > guts) return;
    if (cardHasEff(c, 'cover')) {
      // 味方への1回分を自分が受ける: 狙われたのが味方で、カードの持ち主(生きている別の子)が使う
      if (pd.cover !== null && pd.cover !== undefined) return;
      me.mons.forEach((m, mi) => { if (mi !== tgt.m && tgt.p === q && cardUsableBy(c, m)) out.push({ type: 'guard', hand: hi, mon: mi }); });
      return;
    }
    if (tgt.p !== q || !cardUsableBy(c, target)) return;
    const ev = cardEff(c, 'evade');
    if (ev) {
      if (pd.evaded) return;
      if (cardHasEff(atkCard, 'noEvade') || pd.noEvade) return;
      if (!ev.kinds.includes(atkCard.kind)) return;
      if (ev.minGuts && pd.cost < ev.minGuts) return;
      out.push({ type: 'guard', hand: hi, mon: tgt.m });
      return;
    }
    const re = cardEff(c, 'reduce') || cardEff(c, 'reduceHalf') || cardEff(c, 'reduceAll');
    if (re) { if (re.kinds.includes(atkCard.kind)) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
    const rf = cardEff(c, 'reflect');
    if (rf) { if (rf.kinds.includes(atkCard.kind) && !pd.reflect) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
  });
  return out;
};

const cardLegalActions = (db, st) => {
  if (st.winner !== null) return [];
  if (st.phase === 'setup') return [{ type: 'setupGuts', hand: [] }];
  if (st.pending) return [...cardGuardOptions(db, st), { type: 'pass' }];
  if (st.phase === 'main') return [...cardAttackOptions(db, st), { type: 'endAttacks' }];
  if (st.phase === 'guts') return [{ type: 'guts', hand: [] }];
  return [];
};
// いま決める番の人(守りの途中なら守る側)
const cardDecider = (st) => (st.pending ? st.pending.defender : st.active);

// ---- 攻撃を出す ----
// 技を使った人の書き方(2026-10-24 窓口・カゲあつくん: 記録・まんなかの「いま使った技」・守りの番の文を1つの形にそろえる)。
//   モンスターの技 … 「モッチーの「ローリン」」 / ブリーダーのカード … 「検査ブリーダーの「加勢」(モッチーで)」(子を選ばないカードは「(…で)」なし)
const cardUseWho = (db, st, p, mi, cardNo) => {
  const c = cardOf(db, cardNo);
  const pl = st.players[p];
  const mon = mi >= 0 ? pl.mons[mi] : null;
  if (c && c.user === 'breeder') return { who: pl.name, by: mon ? mon.name : '' };
  return { who: mon ? mon.name : pl.name, by: '' };
};
const cardUseText = (db, st, p, mi, cards) => {
  const l = cardUseWho(db, st, p, mi, cards[0]);
  return `${l.who}の「${cards.map((n) => (cardOf(db, n) || {}).name || '').join('＋')}」${l.by ? `(${l.by}で)` : ''}`;
};
const cardStartAttack = (db, st, act) => {
  const p = st.active;
  const me = st.players[p];
  const isBreeder = act.type === 'breeder';
  const mainNo = me.hand[act.hand[0]];
  const main = cardOf(db, mainNo);
  const cost = cardActionCost(db, st, p, me.hand, act.hand);
  const used = cardTakeFromHand(st, p, act.hand);
  cardPayGuts(st, p, cost);
  const mi = isBreeder ? (act.mon !== undefined ? act.mon : -1) : act.mon;
  const mon = mi >= 0 ? me.mons[mi] : null;
  if (isBreeder) me.breederUsed = true;
  else { mon.attacks += 1; mon.lastCard = mainNo; }
  cardLog(st, cardUseText(db, st, p, mi, used), { kind: 'use', p, cards: used });
  cardEvent(st, { t: 'use', p, mon: mi, cards: used, target: act.target || null });
  // 特殊技: 守れない。その場で効く
  if (main.kind === 'spe') {
    cardApplySpecial(db, st, p, mi, main, act.target);
    me.discard.push(...used);
    return;
  }
  // ダメージの元: 書いてある数・同時に使う組・付けた札・次のターンn倍
  let dmg = main.damage || 0;
  const combo = cardEff(main, 'combo');
  if (combo) {
    const kinds = new Set(used.map((n) => cardOf(db, n)).filter((c) => combo.names.includes(c.name)).map((c) => c.name)).size;
    if (combo.table[kinds]) dmg = combo.table[kinds];
  }
  let mult = 1;
  used.forEach((n) => { const am = cardEff(cardOf(db, n), 'attachMult'); if (am) mult *= am.n; });
  if (mon && mon.mult && mon.mult.turn === st.turn && mon.mult.kinds.includes(main.kind)) { mult *= mon.mult.n; mon.mult = null; }
  if (mon && mon.charge && mon.charge.kinds.includes(main.kind)) { mult *= mon.charge.n; mon.charge = null; } // 静の構え
  const targets = cardHasEff(main, 'area') ? cardAreaTargets(st, p, mi, main) : [act.target];
  st.pending = { attacker: p, defender: cardOther(p), mon: mi, main: mainNo, used, cost, base: dmg, mult, targets, ti: 0,
    evaded: false, reduce: 0, reduceHalf: false, reduceAll: false, reflect: null, cover: null, hitAny: false, evadedAny: false, results: [] };
  cardAdvancePending(db, st);
};

// 守る番を、次に守れる相手へ進める(自分の味方に当たる分=地震など は守りを聞かない)
const cardAdvancePending = (db, st) => {
  const pd = st.pending;
  while (pd && pd.ti < pd.targets.length) {
    const t = pd.targets[pd.ti];
    pd.defender = t.p;
    // 味方(攻撃した側)に当たる分は守らずにそのまま当てる
    if (t.p === pd.attacker) { cardResolveTarget(db, st); continue; }
    return;
  }
  if (pd) cardFinishAttack(db, st);
};

// 1体ぶんの結果を出す
const cardResolveTarget = (db, st) => {
  const pd = st.pending;
  const main = cardOf(db, pd.main);
  let t = pd.targets[pd.ti];
  if (pd.cover !== null && pd.cover !== undefined) t = { p: t.p, m: pd.cover };
  const target = st.players[t.p].mons[t.m];
  let dmg = pd.base * pd.mult;
  const mv = cardEff(main, 'multVs');
  if (mv && cardMonType(target, st.turn) === mv.type) dmg *= mv.n;
  const evaded = pd.evaded;
  if (evaded) dmg = cardHasEff(main, 'halfOnEvade') ? Math.ceil(dmg / 2) : 0;
  if (!cardHasEff(main, 'noBlockReduce')) {
    if (pd.reduceAll) dmg = 0;
    if (pd.reduceHalf) dmg -= Math.floor(dmg / 2);
    dmg = Math.max(0, dmg - pd.reduce);
  }
  let reflected = 0;
  if (pd.reflect) {
    if (pd.reflect.keep) reflected = Math.floor(dmg * pd.reflect.frac);
    else { reflected = dmg; dmg = 0; }
  }
  if (cardHasEff(main, 'nonLethal')) dmg = Math.max(0, Math.min(dmg, target.life - 1));
  target.life = Math.max(0, target.life - dmg);
  if (dmg > 0) target.charge = null; // 静の構えはダメージを受けると終わる
  const guarded = pd.reduce > 0 || pd.reduceHalf || pd.reduceAll || !!pd.reflect || pd.cover !== null;
  const res = { p: t.p, m: t.m, dmg, evaded, reflected };
  pd.results.push(res);
  cardEvent(st, { t: 'hit', p: t.p, m: t.m, dmg, evaded, guarded, card: pd.main });
  cardLog(st, evaded && dmg === 0 ? `${target.name}は回避した` : `${target.name}に${dmg}ダメージ${evaded ? '(回避されても半分)' : ''}`, { kind: 'hit' });
  const atkMon = pd.mon >= 0 ? st.players[pd.attacker].mons[pd.mon] : null;
  if (dmg > 0) {
    pd.hitAny = true;
    const gl = cardEff(main, 'gutsLossOnHit');
    if (gl && t.p !== pd.attacker) { const k = cardLoseGuts(st, t.p, gl.n); if (k) cardLog(st, `${st.players[t.p].name}はガッツを${k}失った`); }
    if (cardHasEff(main, 'stunOnHit')) { target.stunTurn = st.turn + 1; cardLog(st, `${target.name}は次のターン攻撃できない`); }
    if (cardHasEff(main, 'drain') && atkMon && !atkMon.ko) { const h = Math.min(dmg, atkMon.max - atkMon.life); atkMon.life += h; if (h) cardLog(st, `${atkMon.name}はライフを${h}回復`); }
  }
  if (!evaded || cardHasEff(main, 'halfOnEvade')) { if (!evaded) pd.hitAnyNotEvaded = true; }
  if (evaded) pd.evadedAny = true;
  if (reflected > 0 && atkMon && !atkMon.ko) {
    atkMon.life = Math.max(0, atkMon.life - reflected);
    atkMon.charge = null;
    cardEvent(st, { t: 'hit', p: pd.attacker, m: pd.mon, dmg: reflected, reflect: true });
    cardLog(st, `${reflected}ダメージをはね返した`);
  }
  if (target.life <= 0 && !target.ko) cardKo(st, t.p, t.m);
  // 次の相手へ(守りの状態は1体ごとに戻す)
  pd.ti += 1; pd.evaded = false; pd.reduce = 0; pd.reduceHalf = false; pd.reduceAll = false; pd.reflect = null; pd.cover = null; pd.noEvade = false;
};

const cardKo = (st, p, m) => {
  const mon = st.players[p].mons[m];
  mon.ko = true; mon.life = 0;
  cardLog(st, `${mon.name}はKOされた`, { kind: 'ko' });
  cardEvent(st, { t: 'ko', p, m });
};

const cardFinishAttack = (db, st) => {
  const pd = st.pending;
  const main = cardOf(db, pd.main);
  const me = st.players[pd.attacker];
  const atkMon = pd.mon >= 0 ? me.mons[pd.mon] : null;
  // 使った子が自分もダメージを受ける(回避されなかった・回避された・いつでも)
  let self = 0;
  const sh = cardEff(main, 'selfDamageIfHit'); if (sh && pd.results.some((r) => !r.evaded)) self += sh.n;
  const se = cardEff(main, 'selfDamageIfEvaded'); if (se && pd.results.some((r) => r.evaded)) self += se.n;
  const sa = cardEff(main, 'selfDamage'); if (sa) self += sa.n;
  if (self > 0 && atkMon && !atkMon.ko) {
    atkMon.life = Math.max(0, atkMon.life - self);
    atkMon.charge = null;
    cardEvent(st, { t: 'hit', p: pd.attacker, m: pd.mon, dmg: self, self: true });
    cardLog(st, `${atkMon.name}も${self}ダメージを受けた`);
    if (atkMon.life <= 0) cardKo(st, pd.attacker, pd.mon);
  }
  me.discard.push(...pd.used);
  st.pending = null;
  cardCheckWin(st, pd.attacker);
};

// 勝ち負け: 3体とも KO。同時なら攻撃した側の勝ち
const cardCheckWin = (st, attacker) => {
  const dead = st.players.map((pl) => pl.mons.every((m) => m.ko));
  if (dead[0] && dead[1]) cardGameOver(st, attacker, '同時にKO(攻撃した側の勝ち)');
  else if (dead[0]) cardGameOver(st, 1, '全員KO');
  else if (dead[1]) cardGameOver(st, 0, '全員KO');
};

// 特殊技・ブリーダーの特殊
const cardApplySpecial = (db, st, p, mi, card, target) => {
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  (card.effects || []).forEach((e) => {
    if (e.t === 'draw') { for (let i = 0; i < e.n; i++) { if (!me.deck.length) break; me.hand.push(me.deck.pop()); } cardLog(st, `${me.name}は${e.n}枚引いた`); }
    if (e.t === 'peekHand') { cardEvent(st, { t: 'peek', p, hand: opp.hand.slice() }); cardLog(st, `${me.name}は相手の手札を見た`); }
    if (e.t === 'discardOpp') { st.pendingDiscard = { p: cardOther(p), n: Math.min(e.n, opp.hand.length) }; if (!st.pendingDiscard.n) st.pendingDiscard = null; }
    if (e.t === 'heal' && target) { const m = me.mons[target.m]; const h = Math.min(e.n, m.max - m.life); m.life += h; cardEvent(st, { t: 'heal', p, m: target.m, n: h }); cardLog(st, `${m.name}のライフが${h}回復`); }
    if (e.t === 'gutsGuard') { me.gutsGuardUntil = st.turn + 1; cardLog(st, `${me.name}は次のターンまでガッツを減らされない`); }
    if (e.t === 'charge' && mi >= 0) { me.mons[mi].charge = { kinds: e.kinds, n: e.n }; cardLog(st, `${me.mons[mi].name}は次のかしこさ技のダメージが${e.n}倍`); }
    if (e.t === 'forbidThisTurn') { st.forbid[cardOther(p)] = [...(st.forbid[cardOther(p)] || []), ...e.kinds]; cardLog(st, `このターン、相手は${e.kinds.includes('dge') ? '回避' : '防御'}を使えない`); }
  });
};

// 守りのカードを1枚出す
const cardApplyGuard = (db, st, act) => {
  const pd = st.pending;
  const q = pd.defender;
  const me = st.players[q];
  const no = me.hand[act.hand];
  const c = cardOf(db, no);
  cardTakeFromHand(st, q, [act.hand]);
  cardPayGuts(st, q, c.guts);
  me.discard.push(no);
  const user = me.mons[act.mon];
  cardLog(st, `${user.name}の「${c.name}」`, { kind: 'guard', p: q, cards: [no] });
  cardEvent(st, { t: 'guard', p: q, mon: act.mon, card: no });
  (c.effects || []).forEach((e) => {
    if (e.t === 'evade') pd.evaded = true;
    if (e.t === 'reduce') pd.reduce += e.n;
    if (e.t === 'reduceHalf') pd.reduceHalf = true;
    if (e.t === 'reduceAll') pd.reduceAll = true;
    if (e.t === 'reflect') pd.reflect = { frac: e.frac, keep: !!e.keep };
    if (e.t === 'cover') pd.cover = act.mon;
    if (e.t === 'nextTurnMult') user.mult = { turn: st.turn + 1, kinds: e.kinds, n: e.n };
    if (e.t === 'becomeAir') user.airUntil = st.turn + 1;
  });
};

// ---- 操作を1つ進める(作り直した状態を返す。だめな操作は null) ----
const cardApplyAction = (db, st0, act) => {
  if (!act || st0.winner !== null) return null;
  const st = cardClone(st0);
  st.events = [];
  const p = st.active;
  if (st.pendingDiscard) {
    // 相手の手札を捨てさせる: 捨てる側が選ぶ
    if (act.type !== 'discard') return null;
    const q = st.pendingDiscard.p;
    const idxs = (act.hand || []).slice(0, st.pendingDiscard.n);
    if (idxs.length !== st.pendingDiscard.n || idxs.some((i) => i < 0 || i >= st.players[q].hand.length)) return null;
    const taken = cardTakeFromHand(st, q, idxs);
    st.players[q].discard.push(...taken);
    cardLog(st, `${st.players[q].name}は手札を${taken.length}枚捨てた`);
    st.pendingDiscard = null;
    return st;
  }
  if (st.phase === 'setup') {
    if (act.type !== 'setupGuts') return null;
    const idxs = (act.hand || []).slice(0, CARD_BATTLE_SETUP_GUTS_MAX);
    const q = cardOther(st.first);
    const taken = cardTakeFromHand(st, q, idxs);
    st.players[q].guts.push(...taken);
    if (taken.length) cardLog(st, `${st.players[q].name}は始める前に${taken.length}枚をガッツにした`);
    cardLog(st, 'モンスターを表にした');
    st.active = st.first;
    cardBeginTurn(st);
    return st;
  }
  if (st.pending) {
    if (act.type === 'pass') { cardResolveTarget(db, st); cardAdvancePending(db, st); return st; }
    if (act.type !== 'guard') return null;
    const ok = cardGuardOptions(db, st0).some((o) => o.hand === act.hand && o.mon === act.mon);
    if (!ok) return null;
    cardApplyGuard(db, st, act);
    return st;
  }
  if (st.phase === 'main') {
    if (act.type === 'endAttacks') { st.phase = 'guts'; return st; }
    if (act.type !== 'attack' && act.type !== 'breeder') return null;
    const ok = cardAttackOptions(db, st0).some((o) => o.type === act.type && o.mon === act.mon && JSON.stringify(o.hand) === JSON.stringify(act.hand) && JSON.stringify(o.target) === JSON.stringify(act.target || null));
    if (!ok) return null;
    cardStartAttack(db, st, act);
    return st;
  }
  if (st.phase === 'guts') {
    if (act.type !== 'guts') return null;
    const taken = cardTakeFromHand(st, p, act.hand || []);
    st.players[p].guts.push(...taken);
    if (taken.length) cardLog(st, `${st.players[p].name}は${taken.length}枚をガッツにした`);
    st.active = cardOther(p);
    cardBeginTurn(st);
    return st;
  }
  return null;
};

// ===== コンピューターの考え方 =====
// 外のAIは入れない(社長)。いまの手を並べて点を付け、助手ごとの「くせの重み」を掛けて選ぶ。
// 先読みの深さと気まぐれは難易度で決まる(5-5)。★次の1手を選ぶ所・デッキを組む所は差し替えられる口にしておく
// sloppy … その場の1手を、考えずに選ぶ割合(守りを出し忘れる・手札を適当にガッツへ回す・適当な相手を狙う)
const CARD_AI_LEVELS = Object.freeze({
  // point … 勝ったときのカードポイント / loops … 勝ったときのクイック周回(◯周ぶん)。社長が案Aに決めた(台帳 #3484)
  easy:   { depth: 0, whim: 0.30, sloppy: 0.55, point: 80, loops: 14 },
  normal: { depth: 1, whim: 0.15, sloppy: 0.30, point: 110, loops: 16 },
  hard:   { depth: 2, whim: 0.08, sloppy: 0.15, point: 140, loops: 18 },
  expert: { depth: 3, whim: 0.04, sloppy: 0.06, point: 170, loops: 20 },
  master: { depth: 3, whim: 0.01, sloppy: 0, point: 200, loops: 22, readHand: true },
});
// くせの重み(設計書 5-5 の表と同じ数)
const CARD_AI_HABITS = Object.freeze({
  mua:      { attack: 1.5, keepGuard: 0.2, saveGuts: 0.2, big: 0.8, disrupt: 0.5, area: 0.8, finish: 0.5 },
  momosuke: { attack: 1.0, keepGuard: 0.6, saveGuts: 0.8, big: 0.6, disrupt: 1.8, area: 0.8, finish: 0.8 },
  kiki:     { attack: 0.9, keepGuard: 0.7, saveGuts: 1.6, big: 1.8, disrupt: 0.5, area: 1.0, finish: 1.0 },
  kyuko:    { attack: 1.0, keepGuard: 1.0, saveGuts: 1.0, big: 1.0, disrupt: 1.0, area: 1.0, finish: 1.2 },
  dra:      { attack: 0.7, keepGuard: 1.5, saveGuts: 1.0, big: 0.6, disrupt: 0.8, area: 0.8, finish: 0.8 },
  atsu:     { attack: 1.2, keepGuard: 0.6, saveGuts: 0.8, big: 1.0, disrupt: 0.8, area: 1.8, finish: 1.5 },
});
// 助手どうしの強さをそろえる数(雑な手の割合に掛ける)。くせとデッキの違いで、同じ難易度でも勝率に差が出るため。
// tools/card/card-rules-check.js の試算で、どの助手もスターター相手に同じくらいの勝率になるように決めた
const CARD_AI_TUNE = Object.freeze({ mua: 0.6, momosuke: 0.5, kiki: 1.3, kyuko: 1, dra: 1.15, atsu: 1 });
// 深く読む難易度で、くせの重みを「真ん中(1.0)」へ寄せる割合(1 = そのまま・0.5 = 半分だけ寄せる)。くせの向きは変えない。
//   みゅあ(攻める 1.5・守りを残す 0.2・ガッツをためる 0.2)は、深く読む相手には極端なくせが裏目に出て、
//   EXPERT・MASTER でプレイヤー役に 29〜32% しか勝てなかった(公開の条件。tools/card/card-ai-balance.js で測る)
const CARD_AI_HABIT_BLEND = Object.freeze({ expert: { mua: 0.6 }, master: { mua: 0.6, momosuke: 0.5 } });
const cardAiPolicy = (habitId, levelId) => {
  const level = CARD_AI_LEVELS[levelId] || CARD_AI_LEVELS.normal;
  const tune = CARD_AI_TUNE[habitId] === undefined ? 1 : CARD_AI_TUNE[habitId];
  const base = CARD_AI_HABITS[habitId] || CARD_AI_HABITS.kyuko;
  const blend = (CARD_AI_HABIT_BLEND[levelId] || {})[habitId];
  const habit = blend === undefined ? base : Object.fromEntries(Object.entries(base).map(([k, v]) => [k, 1 + (v - 1) * blend]));
  return { habit, level: { ...level, sloppy: Math.min(0.9, (level.sloppy || 0) * tune) } };
};

// 相手が回避できそうな見込み(見えない手札は、残りの山札＋手札から平均で見積もる)
const cardAiEvadeChance = (db, st, p, card, target, level) => {
  if (cardHasEff(card, 'noEvade') || card.kind === 'spe') return 0;
  const q = cardOther(p);
  const opp = st.players[q];
  const tmon = opp.mons[target.m];
  const fits = (no) => { const c = cardOf(db, no); const ev = cardEff(c, 'evade'); return c && ev && ev.kinds.includes(card.kind) && cardUsableBy(c, tmon) && c.guts <= opp.guts.length && (!ev.minGuts || card.guts >= ev.minGuts); };
  if ((st.forbid[q] || []).includes('dge')) return 0;
  if (level.readHand) return opp.hand.some(fits) ? 0.85 : 0;
  const unseen = [...opp.hand, ...opp.deck];
  if (!unseen.length) return 0;
  const frac = unseen.filter(fits).length / unseen.length;
  return Math.min(0.8, 1 - Math.pow(1 - frac, opp.hand.length));
};

// 攻撃の1手に点を付ける
const cardAiScoreAttack = (db, st, opt, policy) => {
  const p = st.active;
  const me = st.players[p];
  const { habit, level } = policy;
  const main = cardOf(db, me.hand[opt.hand[0]]);
  const cost = cardActionCost(db, st, p, me.hand, opt.hand);
  let score = 0;
  if (main.kind === 'spe') {
    (main.effects || []).forEach((e) => {
      if (e.t === 'heal' && opt.target) { const m = me.mons[opt.target.m]; score += Math.min(e.n, m.max - m.life) * 1.1; }
      if (e.t === 'draw') score += e.n * 0.9;
      if (e.t === 'peekHand') score += 0.4 * habit.disrupt;
      if (e.t === 'discardOpp') score += 1.4 * habit.disrupt;
      if (e.t === 'gutsGuard') score += st.players[cardOther(p)].hand.length >= 3 ? 0.4 : 0.1;
      if (e.t === 'charge') {
        const m = opt.mon >= 0 ? me.mons[opt.mon] : null;
        const big = m && !m.charge ? Math.max(0, ...me.hand.map((n) => cardOf(db, n)).filter((c) => c && e.kinds.includes(c.kind) && cardUsableBy(c, m)).map((c) => c.damage || 0)) : 0;
        score += big * 0.5;
      }
      if (e.t === 'forbidThisTurn') {
        const followUp = cardAttackOptions(db, st).filter((o) => o.type === 'attack' && cardOf(db, me.hand[o.hand[0]]).kind !== 'spe').length;
        score += followUp ? 1.5 * habit.disrupt : 0;
      }
    });
  } else {
    let dmg = main.damage || 0;
    const combo = cardEff(main, 'combo');
    if (combo) { const kinds = new Set(opt.hand.map((i) => cardOf(db, me.hand[i]).name).filter((n) => combo.names.includes(n))).size; dmg = combo.table[kinds] || dmg; }
    opt.hand.forEach((i) => { const am = cardEff(cardOf(db, me.hand[i]), 'attachMult'); if (am) dmg *= am.n; });
    const mon = opt.mon >= 0 ? me.mons[opt.mon] : null;
    if (mon && mon.mult && mon.mult.turn === st.turn && mon.mult.kinds.includes(main.kind)) dmg *= mon.mult.n;
    if (mon && mon.charge && mon.charge.kinds.includes(main.kind)) dmg *= mon.charge.n;
    const targets = cardHasEff(main, 'area') ? cardAreaTargets(st, p, opt.mon, main) : [opt.target];
    targets.forEach((t) => {
      const tm = st.players[t.p].mons[t.m];
      let d = dmg;
      const mv = cardEff(main, 'multVs'); if (mv && cardMonType(tm, st.turn) === mv.type) d *= mv.n;
      if (cardHasEff(main, 'nonLethal')) d = Math.min(d, tm.life - 1);
      const ev = cardAiEvadeChance(db, st, p, main, t, level);
      const half = cardHasEff(main, 'halfOnEvade') ? Math.ceil(d / 2) : 0;
      const exp = d * (1 - ev) + half * ev;
      const sign = t.p === p ? -1.3 : 1;
      score += sign * Math.min(exp, tm.life) * habit.attack;
      if (t.p !== p && d >= tm.life) score += (1 - ev) * 4 * habit.finish;
      const gl = cardEff(main, 'gutsLossOnHit');
      if (gl && t.p !== p) score += (1 - ev) * (gl.n === 'all' ? st.players[t.p].guts.length : Math.min(gl.n, st.players[t.p].guts.length)) * 0.8 * habit.disrupt;
      if (cardHasEff(main, 'stunOnHit') && t.p !== p) score += (1 - ev) * 1.2;
    });
    if (targets.length > 1) score *= 1 + 0.15 * (habit.area - 1);
    if (cost >= 5) score *= 1 + 0.12 * (habit.big - 1);
    const sh = cardEff(main, 'selfDamageIfHit'); if (sh && mon) score -= sh.n * (mon.life <= sh.n ? 3 : 0.6);
    const sa = cardEff(main, 'selfDamage'); if (sa && mon) score -= sa.n * (mon.life <= sa.n ? 3 : 0.6);
  }
  // ガッツを使いすぎると、相手の番に守れない(先読み1以上・くせ「守りを残す」「ガッツをためる」)
  const left = me.guts.length - cost;
  const cheapGuard = Math.min(9, ...me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && cardIsGuardKind(c.kind)).map((c) => c.guts));
  if (level.depth >= 1 && cheapGuard < 9 && left < cheapGuard) score -= 1.2 * habit.keepGuard;
  score -= cost * 0.12 * habit.saveGuts * (level.depth >= 2 ? 1.2 : 1);
  // 先読み2以上: 相手のいちばん強い子(残りライフあたりの火力)を先に落とす
  if (level.depth >= 2 && opt.target && opt.target.p !== p) {
    const tm = st.players[opt.target.p].mons[opt.target.m];
    score += (tm.max - tm.life) * 0.15 + (tm.life <= 3 ? 0.8 : 0);
  }
  return score;
};

// 守りの1枚に点を付ける(出さないなら pass)
const cardAiChooseGuard = (db, st, policy, rand) => {
  const pd = st.pending;
  const q = pd.defender;
  const me = st.players[q];
  const { habit } = policy;
  const opts = cardGuardOptions(db, st);
  if (!opts.length) return { type: 'pass' };
  const main = cardOf(db, pd.main);
  const tgt = pd.targets[pd.ti];
  const target = st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m];
  let dmg = pd.base * pd.mult;
  const mv = cardEff(main, 'multVs'); if (mv && cardMonType(target, st.turn) === mv.type) dmg *= mv.n;
  if (pd.evaded) dmg = cardHasEff(main, 'halfOnEvade') ? Math.ceil(dmg / 2) : 0;
  dmg = Math.max(0, dmg - pd.reduce);
  if (dmg <= 0) return { type: 'pass' };
  let best = null;
  opts.forEach((o) => {
    const c = cardOf(db, me.hand[o.hand]);
    let after = dmg;
    if (cardHasEff(c, 'evade')) after = cardHasEff(main, 'halfOnEvade') ? Math.ceil(dmg / 2) : 0;
    const re = cardEff(c, 'reduce'); if (re && !cardHasEff(main, 'noBlockReduce')) after = Math.max(0, dmg - re.n);
    if (cardHasEff(c, 'reduceHalf') && !cardHasEff(main, 'noBlockReduce')) after = dmg - Math.floor(dmg / 2);
    const rf = cardEff(c, 'reflect'); if (rf) after = rf.keep ? dmg : 0;
    if (cardHasEff(c, 'cover')) {
      const cm = me.mons[o.mon];
      after = target.life <= dmg && cm.life > dmg ? 0 : dmg; // 倒れそうな味方を、硬い子がかばう
    }
    const saved = Math.min(dmg, target.life) - Math.min(after, target.life);
    const ko = target.life <= dmg && target.life > after ? 5 : 0;
    const v = saved * (0.6 + 0.4 * habit.keepGuard) + ko - c.guts * 0.35 * habit.saveGuts + (rf ? (rf.keep ? Math.floor(dmg * rf.frac) : dmg) * 0.6 : 0);
    if (!best || v > best.v) best = { v, o };
  });
  if (!best || best.v < 0.8 + rand() * 0.3) return { type: 'pass' };
  return best.o;
};

// 手札をガッツへ: 使えない札(持ち主が KO)・使えそうにない重い札から。くせ「ガッツをためる」でためる量が増える
const cardAiChooseGuts = (db, st, policy) => {
  const p = st.active;
  const me = st.players[p];
  const { habit } = policy;
  const target = Math.round(3 + 1.6 * habit.saveGuts);
  const need = Math.max(0, target - me.guts.length);
  const keep = (no) => {
    const c = cardOf(db, no);
    if (!c) return -9;
    const usable = c.user === 'breeder' || me.mons.some((m) => cardUsableBy(c, m));
    if (!usable) return -10;
    if (cardIsGuardKind(c.kind)) return 2 * habit.keepGuard - c.guts * 0.2;
    return (c.damage || 1) * 0.5 - Math.max(0, c.guts - (me.guts.length + 2)) * 0.8;
  };
  const order = me.hand.map((no, i) => ({ i, k: keep(no) })).sort((a, b) => a.k - b.k);
  const pick = [];
  order.forEach((o) => { if (o.k <= -9) pick.push(o.i); });
  for (const o of order) { if (pick.length >= Math.max(need, pick.length) || me.hand.length - pick.length <= 1) break; if (!pick.includes(o.i)) pick.push(o.i); }
  return { type: 'guts', hand: pick };
};

// 次の1手を選ぶ(★差し替えられる口。別の考え方を差すときは、同じ形 (db, st, policy, rand) → 操作 で渡す)
const cardAiChooseAction = (db, st, policy, rand = Math.random) => {
  if (st.pendingDiscard) {
    const q = st.pendingDiscard.p;
    const hand = st.players[q].hand;
    // 捨てる側が選ぶ: いちばん要らない札から
    const order = hand.map((no, i) => ({ i, g: (cardOf(db, no) || {}).guts || 0 })).sort((a, b) => b.g - a.g).map((o) => o.i);
    return { type: 'discard', hand: order.slice(0, st.pendingDiscard.n) };
  }
  if (st.phase === 'setup') {
    const q = cardOther(st.first);
    const hand = st.players[q].hand;
    const order = hand.map((no, i) => ({ i, g: (cardOf(db, no) || {}).guts || 0 })).sort((a, b) => b.g - a.g).map((o) => o.i);
    return { type: 'setupGuts', hand: order.slice(0, CARD_BATTLE_SETUP_GUTS_MAX) };
  }
  const sloppy = rand() < (policy.level.sloppy || 0);
  if (st.pending) return sloppy ? { type: 'pass' } : cardAiChooseGuard(db, st, policy, rand);
  if (st.phase === 'guts') {
    if (!sloppy) return cardAiChooseGuts(db, st, policy);
    const hand = st.players[st.active].hand;
    return { type: 'guts', hand: hand.map((_, i) => i).filter(() => rand() < 0.4) };
  }
  const opts = cardAttackOptions(db, st);
  if (!opts.length) return { type: 'endAttacks' };
  if (sloppy) return rand() < 0.25 ? { type: 'endAttacks' } : opts[Math.floor(rand() * opts.length)];
  const scored = opts.map((o) => ({ o, s: cardAiScoreAttack(db, st, o, policy) })).sort((a, b) => b.s - a.s);
  if (scored[0].s <= 0.3) return { type: 'endAttacks' };
  if (rand() < policy.level.whim) {
    const pool = scored.filter((x) => x.s > 0.3).slice(0, 3);
    return pool[Math.floor(rand() * pool.length)].o;
  }
  return scored[0].o;
};

// ---- 助手のデッキ(5-5) ----
// kit … 元のスターターをそのまま使う / build … 3体を決めて、くせに合わせてカードを選ぶ
// HARD より上は、同じ3体で組み直す(HARD は第1弾のカードだけ・EXPERT と MASTER は全部の弾)
const CARD_AI_DECKS = Object.freeze({
  mua:      { kit: 'speed' },
  momosuke: { kit: 'miracle' },
  kiki:     { kit: 'powerful' },
  dra:      { kit: 'powerful' },
  kyuko:    { monsters: ['C-007', 'C-005', 'C-009'] },  // ナーガ・ピクシー・モッチー
  atsu:     { monsters: ['C-003', 'C-001', 'C-002'], prefer: ['竜巻アタック', '地震', '炎のカベ', 'ブリザード'] },  // ゴーレム・ライガー・ガリ。全体攻撃を集める
});
// 組み直すデッキで、順番の枠に入れてよい「入れたい度」の下限(cardAiCardValue の値)。助手ごとの違いは、
//   EXPERT・MASTER でプレイヤー役との勝率がそろうように tools/card/card-ai-balance.js で決めた
const CARD_AI_LANE_MIN_DEFAULT = 0.8;
const CARD_AI_LANE_MIN = Object.freeze({ momosuke: 1.5, dra: 0.3 });
const CARD_DECK_COPY_MAX = 3; // 同じ名前の技・全体・ブリーダーカードは3枚まで

// カード1枚の「入れたい度」(くせの重みを掛ける)
const cardAiCardValue = (card, habit) => {
  const eff = (t) => cardHasEff(card, t);
  if (cardIsGuardKind(card.kind)) {
    let v = eff('evade') ? 2.2 : eff('reduceAll') ? 2.4 : eff('reflect') ? 2.3 : eff('cover') ? 1.4 : 1.6;
    const re = cardEff(card, 'reduce'); if (re) v = 1 + re.n * 0.4;
    return (v - card.guts * 0.35) * habit.keepGuard;
  }
  if (card.kind === 'spe') {
    let v = 0.6;
    (card.effects || []).forEach((e) => {
      if (e.t === 'draw') v += e.n * 0.5;
      if (e.t === 'heal') v += e.n * 0.35;
      if (e.t === 'discardOpp') v += e.n * 0.8 * habit.disrupt;
      if (e.t === 'peekHand') v += 0.2 * habit.disrupt;
      if (e.t === 'forbidThisTurn') v += 0.8 * habit.disrupt;
      if (e.t === 'gutsGuard') v += 0.3;
      if (e.t === 'charge') v += 1.2;
    });
    return v - card.guts * 0.3;
  }
  let dmg = card.damage || 0;
  if (eff('combo')) dmg = 3;
  if (eff('halfOnEvade') || eff('noEvade')) dmg *= 1.3;
  if (eff('area')) dmg *= 1.6 * habit.area;
  const gl = cardEff(card, 'gutsLossOnHit'); if (gl) dmg += (gl.n === 'all' ? 2 : gl.n) * 0.7 * habit.disrupt;
  if (eff('stunOnHit')) dmg += 1;
  const sh = cardEff(card, 'selfDamageIfHit') || cardEff(card, 'selfDamage'); if (sh) dmg -= sh.n * 0.8;
  const cost = card.guts + 1.5;
  const big = card.guts >= 4 ? habit.big : 1;
  return (dmg / cost) * 2 * habit.attack * big;
};

// ★デッキを組む口(差し替えられる。形は (db, 助手id, 難易度id) → { monsters:[3], cards:[50] })
const cardAiBuildDeck = (db, who, levelId = 'normal') => {
  if (db.starters[who]) return { monsters: db.starters[who].monsters.slice(), cards: db.starters[who].cards.slice() }; // スターターの id をそのまま渡したとき
  const recipe = CARD_AI_DECKS[who] || CARD_AI_DECKS.mua;
  const upper = levelId === 'hard' || levelId === 'expert' || levelId === 'master';
  if (recipe.kit && !upper) return cardAiBuildDeck(db, recipe.kit);
  const monsters = recipe.monsters || db.starters[recipe.kit].monsters;
  const maxWave = levelId === 'expert' || levelId === 'master' ? 4 : 1;
  const habit = CARD_AI_HABITS[who] || CARD_AI_HABITS.kyuko;
  const mons = monsters.map((no) => cardMonsterOf(db, no));
  const pool = Object.values(db.cards).filter((c) => c.ready && c.wave <= maxWave && !cardHasEff(c, 'attach')
    && (c.user === 'any' || c.user === 'breeder' || mons.some((m) => cardUsableBy(c, { ...m, ko: false }))));
  // 名前ごとに1つ(同じ名前の別番号は、入れたい度の高いほう)
  const byName = {};
  pool.forEach((c) => { const v = cardAiCardValue(c, habit); if (!byName[c.name] || byName[c.name].v < v) byName[c.name] = { c, v }; });
  const ranked = Object.values(byName).sort((a, b) => b.v - a.v || (a.c.no < b.c.no ? -1 : 1));
  // 守りの枚数の目安(くせ「守りを残す」で増える)。3体それぞれの攻撃が入るよう、攻撃は子ごとに順番に足す
  const guardTarget = Math.round(12 + 6 * Math.min(1.5, habit.keepGuard));
  const cards = [];
  // 重い技(ガッツ5以上)は、くせ「大技」に合わせて枚数を絞る(重い技ばかりだと、ガッツが足りず手札が腐る)
  const heavyMax = Math.round(8 * habit.big);
  let heavy = 0;
  const add = (c, n) => {
    for (let i = 0; i < n && cards.length < CARD_BATTLE_DECK_SIZE; i++) {
      const isHeavy = !cardIsGuardKind(c.kind) && c.guts >= 5;
      if (isHeavy && heavy >= heavyMax) return;
      if (isHeavy) heavy += 1;
      cards.push(c.no);
    }
  };
  const guards = ranked.filter((x) => cardIsGuardKind(x.c.kind));
  let g = 0;
  for (const x of guards) { if (g >= guardTarget) break; const n = Math.min(CARD_DECK_COPY_MAX, guardTarget - g); add(x.c, n); g += n; }
  const attacks = ranked.filter((x) => !cardIsGuardKind(x.c.kind));
  const lanes = mons.map((m) => attacks.filter((x) => x.c.user !== 'any' && x.c.user !== 'breeder' && cardUsableBy(x.c, { ...m, ko: false })));
  const shared = attacks.filter((x) => x.c.user === 'any' || x.c.user === 'breeder');
  const used = new Set();
  // 助手らしさの札(あつの全体攻撃など)を先に入れる
  (recipe.prefer || []).forEach((name) => { const x = byName[name]; if (x && !used.has(name)) { used.add(name); add(x.c, CARD_DECK_COPY_MAX); } });
  let li = 0, guard = 0;
  while (cards.length < CARD_BATTLE_DECK_SIZE && guard++ < 400) {
    const lane = li < lanes.length ? lanes[li] : shared;
    li = (li + 1) % (lanes.length + 1);
    // ★入れたい度が低い札は、順番の枠では入れない(足りないときだけ最後に入れる)。
    //   第3弾のブリーダー「意味不明」(ダメージの無い特殊技)が全モンスター・ブリーダーの枠で3枚入り、
    //   みゅあの EXPERT の勝率を17点下げていた。しきい値は助手ごとに試算で決めた(CARD_AI_LANE_MIN)
    const x = lane.find((y) => !used.has(y.c.name) && y.v >= (CARD_AI_LANE_MIN[who] ?? CARD_AI_LANE_MIN_DEFAULT));
    if (!x) continue;
    used.add(x.c.name);
    add(x.c, CARD_DECK_COPY_MAX);
  }
  // 足りなければ、残りの候補から入れる(どの子も使える札が少ないとき)
  for (const x of ranked) { if (cards.length >= CARD_BATTLE_DECK_SIZE) break; const have = cards.filter((n) => cardOf(db, n).name === x.c.name).length; add(x.c, CARD_DECK_COPY_MAX - have); }
  heavy = -99; // それでも50枚に届かなければ、重い技の上限を外して埋める
  for (const x of ranked) { if (cards.length >= CARD_BATTLE_DECK_SIZE) break; const have = cards.filter((n) => cardOf(db, n).name === x.c.name).length; add(x.c, CARD_DECK_COPY_MAX - have); }
  return { monsters: monsters.slice(), cards };
};

// デッキが決まりどおりか(3体・別々のモンスター・50枚・同じ名前は3枚まで・使えないカードが無い)。だめなら理由の文の配列
const cardDeckProblems = (db, deck) => {
  const out = [];
  if (!deck || !Array.isArray(deck.monsters) || !Array.isArray(deck.cards)) return ['デッキがありません'];
  if (deck.monsters.length !== 3) out.push(`モンスターが${deck.monsters.length}体です(3体にしてください)`);
  const ms = deck.monsters.map((no) => cardMonsterOf(db, no));
  if (ms.some((m) => !m)) out.push('知らないモンスターカードが入っています');
  const species = ms.filter(Boolean).map((m) => m.species);
  if (new Set(species).size !== species.length) out.push('同じモンスターが2体入っています');
  if (deck.cards.length !== CARD_BATTLE_DECK_SIZE) out.push(`カードが${deck.cards.length}枚です(あと${CARD_BATTLE_DECK_SIZE - deck.cards.length}枚)`);
  const names = {};
  deck.cards.forEach((no) => { const c = cardOf(db, no); if (!c) { out.push(`知らないカード(${no})が入っています`); return; } names[c.name] = (names[c.name] || 0) + 1; });
  Object.entries(names).forEach(([n, k]) => { if (k > CARD_DECK_COPY_MAX) out.push(`「${n}」が${k}枚です(3枚まで)`); });
  return [...new Set(out)];
};

// ===== デッキ編成(区切り2) =====
// 持っている枚数を超えていないか・準備中のカードが入っていないか(デッキの決まり cardDeckProblems とは別に、編成の画面で出す)
const cardDeckOwnProblems = (db, deck, collection) => {
  const out = [];
  if (!deck) return out;
  const col = collection || {};
  const n = {};
  [...(deck.monsters || []), ...(deck.cards || [])].forEach((no) => { n[no] = (n[no] || 0) + 1; });
  Object.entries(n).forEach(([no, k]) => {
    const c = cardOf(db, no); const m = cardMonsterOf(db, no);
    const name = c ? c.name : m ? m.name : no;
    if ((col[no] || 0) < k) out.push(`「${name}」が足りません(持っているのは${col[no] || 0}枚)`);
    if (c && !c.ready) out.push(`「${name}」は準備中です`);
  });
  return out;
};
// デッキの対戦に使えるか(決まり・持っている枚数・準備中)
const cardDeckReady = (db, deck, collection) => cardDeckProblems(db, deck).length === 0 && cardDeckOwnProblems(db, deck, collection).length === 0;
// そのカードを1枚足せるか。足せないときはその理由(画面に出す)。足せるときは ''
const cardDeckAddReason = (db, deck, no, collection) => {
  const col = collection || {};
  const m = cardMonsterOf(db, no);
  if (m) {
    if (deck.monsters.includes(no)) return 'もう入っています';
    if (deck.monsters.length >= 3) return 'モンスターは3体までです';
    if (deck.monsters.some((x) => (cardMonsterOf(db, x) || {}).species === m.species)) return '同じモンスターは1体までです(キラも同じモンスター)';
    if ((col[no] || 0) < 1) return '持っていません';
    return '';
  }
  const c = cardOf(db, no);
  if (!c) return '知らないカードです';
  if (!c.ready) return '準備中のカードです';
  if (deck.cards.length >= CARD_BATTLE_DECK_SIZE) return `カードは${CARD_BATTLE_DECK_SIZE}枚までです`;
  const same = deck.cards.filter((x) => (cardOf(db, x) || {}).name === c.name).length;
  if (same >= CARD_DECK_COPY_MAX) return `同じ名前のカードは${CARD_DECK_COPY_MAX}枚までです`;
  const mine = deck.cards.filter((x) => x === no).length;
  if (mine >= (col[no] || 0)) return `持っているのは${col[no] || 0}枚です`;
  return '';
};
// 新しいデッキの id(いまのデッキと重ならないもの)
const cardNewDeckId = (decks, now) => {
  let id = `deck_${Math.floor(Number(now) || 0).toString(36)}`;
  let k = 1;
  while (decks.some((d) => d.id === id)) { id = `deck_${Math.floor(Number(now) || 0).toString(36)}_${k}`; k += 1; }
  return id;
};
// デッキを1つ入れかえ(無ければ足す・5つまで)。active はそのまま(無いときは最初のデッキ)
const cardDecksPut = (decks, deck) => {
  const list = decks.decks.some((d) => d.id === deck.id) ? decks.decks.map((d) => (d.id === deck.id ? deck : d)) : [...decks.decks, deck].slice(0, CARD_DECK_MAX);
  return { active: list.some((d) => d.id === decks.active) ? decks.active : (list[0] ? list[0].id : null), decks: list };
};
const cardDecksRemove = (decks, id) => {
  const list = decks.decks.filter((d) => d.id !== id);
  return { active: list.some((d) => d.id === decks.active) ? decks.active : (list[0] ? list[0].id : null), decks: list };
};
// 並べる順(モンスター → 種類 → 番号)
const CARD_KIND_ORDER = Object.freeze({ pow: 0, int: 1, spe: 2, dge: 3, blk: 4 });
const cardSortKey = (db, no) => {
  const c = cardOf(db, no);
  if (!c) return `0-${no}`;
  return `1-${c.user === 'any' ? 'y' : c.user === 'breeder' ? 'z' : 'a'}-${CARD_KIND_ORDER[c.kind] ?? 9}-${no}`;
};

// ===== 保存の形(6-1)。読むときは必ずここを通す(無い・壊れているときは既定値) =====
const CARD_SAVE_KEYS = Object.freeze({
  collection: 'mh_card_collection_v1', decks: 'mh_card_decks_v1', point: 'mh_card_point_v1', starter: 'mh_card_starter_v1',
  daily: 'mh_card_daily_v1', record: 'mh_card_record_v1', cpuUnlocked: 'mh_card_cpu_unlocked_v1',
  tutorial: 'mh_card_tutorial_v1', // 練習試合(チュートリアル)を終えた・飛ばした・100 を渡した印(86-card-tutorial.jsx)
  pity: 'mh_card_pack_pity_v1', // パックの天井(弾ごとに、キラなしで開けた数。89-card-pack.jsx)
  shop: 'mh_card_shop_v1',       // マーケットで買ったスターターキットの印(89-card-pack.jsx)
  topAssist: 'mh_card_top_assist_v1', // トップの助手の「立ち絵/コメント」の出し入れ(84。無ければ両方ON)
  rankSync: 'mh_card_rank_sync_v1',   // ランキングへ最後に送った行の中身(同じなら送り直さない。90-card-rank.jsx)
  bgm: 'mh_card_bgm_v1',              // 対戦の BGM { cpu: 'auto' か 曲id, pvp: 曲id }(設計書 5-3。いまの mh_bgm_arrangement は触らない)
  settings: 'mh_card_settings_v1',    // 演出の速さ・守れないときの自動パス(normalizeCardSettings)
});
const cardIsPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const cardNormalizeCollection = (v) => {
  const out = {};
  if (!cardIsPlainObject(v)) return out;
  // 知らない番号も残す(あとから届くカード・弾のため。消さない)
  Object.entries(v).forEach(([k, n]) => { const x = Number(n); if (Number.isFinite(x) && x > 0) out[k] = Math.min(99, Math.floor(x)); });
  return out;
};
const cardNormalizePoint = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0; };
const cardNormalizeStarter = (v) => (cardIsPlainObject(v) && typeof v.kit === 'string' && v.kit ? { kit: v.kit, at: Number.isFinite(Number(v.at)) ? Number(v.at) : 0 } : null);
const CARD_DECK_MAX = 5;
const cardNormalizeDecks = (v) => {
  const decks = (cardIsPlainObject(v) && Array.isArray(v.decks) ? v.decks : []).filter(cardIsPlainObject).slice(0, CARD_DECK_MAX).map((d, i) => ({
    id: typeof d.id === 'string' && d.id ? d.id : `deck${i + 1}`,
    name: typeof d.name === 'string' && d.name ? d.name.slice(0, 20) : `デッキ${i + 1}`,
    monsters: Array.isArray(d.monsters) ? d.monsters.filter((x) => typeof x === 'string').slice(0, 3) : [],
    cards: Array.isArray(d.cards) ? d.cards.filter((x) => typeof x === 'string').slice(0, CARD_BATTLE_DECK_SIZE) : [],
  }));
  const active = cardIsPlainObject(v) && decks.some((d) => d.id === v.active) ? v.active : (decks[0] ? decks[0].id : null);
  return { active, decks };
};
const cardNormalizeDaily = (v, today) => {
  const base = { day: today, cpuPoint: 0, pvpPoint: 0, firstWin: false, foes: {} };
  if (!cardIsPlainObject(v) || v.day !== today) return base;
  return { day: today, cpuPoint: cardNormalizePoint(v.cpuPoint), pvpPoint: cardNormalizePoint(v.pvpPoint), firstWin: v.firstWin === true, foes: cardIsPlainObject(v.foes) ? { ...v.foes } : {} };
};
const CARD_LEVEL_ORDER = Object.freeze(['easy', 'normal', 'hard', 'expert', 'master']);
// 対戦の BGM。cpu は 'auto'(相手の助手に合わせる)か曲id、pvp は曲id。無い・知らない曲idは既定へ戻す(isTrack: 曲idか確かめる関数)
const CARD_BGM_DEFAULT = Object.freeze({ cpu: 'auto', pvp: 'ichika_battle' });
const normalizeCardBgm = (v, isTrack = () => true) => {
  const r = cardIsPlainObject(v) ? v : {};
  return {
    cpu: r.cpu === 'auto' || (typeof r.cpu === 'string' && isTrack(r.cpu)) ? r.cpu : CARD_BGM_DEFAULT.cpu,
    pvp: typeof r.pvp === 'string' && isTrack(r.pvp) ? r.pvp : CARD_BGM_DEFAULT.pvp,
  };
};
// 演出の設定。speed … 'normal' / 'fast'(相手の考える間と、決着から結果までを短くする)
//   autoPass … 守れるカードが1枚も無いとき、自動で「守らない」にする(既定は ON。理由の一言は少し見せてから進む)
const CARD_SETTINGS_DEFAULT = Object.freeze({ speed: 'normal', autoPass: true });
const normalizeCardSettings = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  return { speed: r.speed === 'fast' ? 'fast' : 'normal', autoPass: r.autoPass !== false };
};
// 難易度ごとの数 { easy: n, … }。知らない難易度は捨てる
const cardNormalizeLevelCounts = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  return Object.fromEntries(CARD_LEVEL_ORDER.map((lv) => [lv, cardNormalizePoint(r[lv])]));
};
// 週の区切り: モンヒロビートの週間ランキングと同じ、日本時間の月曜 5:00 から(カゲあつくん)。週の鍵はその月曜の日付(YYYY-MM-DD)
//   日本時間から5時間戻した日付で数える(月曜 4:59 は前の週・5:00 から新しい週)
const CARD_WEEK_START_HOUR_JST = 5;
const cardWeekKeyJst = (now) => {
  const d = new Date(Number(now) + (9 - CARD_WEEK_START_HOUR_JST) * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
// ランキングの元にする数(台帳 #3513)。本当に対戦した勝ちだけを数える(デバッグから・公開前は数えない)。
//   total … 難易度ごとの勝ち数(通算) / week … その週の難易度ごとの勝ち数 / streak … いまの連勝と、いちばん長い連勝
const cardNormalizeRank = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  const week = cardIsPlainObject(r.week) ? r.week : {};
  const streak = cardIsPlainObject(r.streak) ? r.streak : {};
  const now = cardNormalizePoint(streak.now);
  return {
    total: cardNormalizeLevelCounts(r.total),
    week: { key: typeof week.key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week.key) ? week.key : '', wins: cardNormalizeLevelCounts(week.wins) },
    streak: { now, best: Math.max(now, cardNormalizePoint(streak.best)) },
  };
};
const cardNormalizeRecord = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  const cpu = cardIsPlainObject(r.cpu) ? r.cpu : {};
  const pvp = cardIsPlainObject(r.pvp) ? r.pvp : {};
  const beaten = cardIsPlainObject(r.beaten) ? r.beaten : {};
  const byLevel = cardIsPlainObject(r.byLevel) ? r.byLevel : {};
  return {
    cpu: { win: cardNormalizePoint(cpu.win), lose: cardNormalizePoint(cpu.lose), surrender: cardNormalizePoint(cpu.surrender) },
    pvp: { win: cardNormalizePoint(pvp.win), lose: cardNormalizePoint(pvp.lose) },
    beaten: Object.fromEntries(Object.entries(beaten).filter(([, x]) => x === true)), // 1回でも勝った助手(印だけ)
    recent: Array.isArray(r.recent) ? r.recent.filter(cardIsPlainObject).slice(0, 30) : [],
    // 2026-10-24 足した項目(前からの人は 0 で補う)。難易度ごとの勝ち・負け(投了も負け)。記録の画面に出す
    byLevel: { win: cardNormalizeLevelCounts(byLevel.win), lose: cardNormalizeLevelCounts(byLevel.lose) },
    rank: cardNormalizeRank(r.rank),
  };
};
// 1戦の結果を記録へ足す。rankable … ランキングに数えてよい対戦か(公開後・デバッグでない人・デバッグの入口でない)
const cardRecordAfter = (record, { who, level, outcome, at, rankable }) => {
  const rec = cardNormalizeRecord(record);
  const win = outcome === 'win';
  const lv = CARD_LEVEL_ORDER.includes(level) ? level : null;
  const side = win ? 'win' : 'lose';
  const next = {
    ...rec,
    cpu: { ...rec.cpu, [outcome]: (rec.cpu[outcome] || 0) + 1 },
    beaten: win ? { ...rec.beaten, [who]: true } : rec.beaten,
    recent: [{ at, who, level, outcome }, ...rec.recent].slice(0, 30),
    byLevel: lv ? { ...rec.byLevel, [side]: { ...rec.byLevel[side], [lv]: rec.byLevel[side][lv] + 1 } } : rec.byLevel,
  };
  if (!rankable || !lv) return next;
  const key = cardWeekKeyJst(at);
  const weekWins = rec.rank.week.key === key ? rec.rank.week.wins : cardNormalizeLevelCounts(null);
  const streakNow = win ? rec.rank.streak.now + 1 : 0;
  next.rank = {
    total: win ? { ...rec.rank.total, [lv]: rec.rank.total[lv] + 1 } : rec.rank.total,
    week: { key, wins: win ? { ...weekWins, [lv]: weekWins[lv] + 1 } : weekWins },
    streak: { now: streakNow, best: Math.max(rec.rank.streak.best, streakNow) },
  };
  return next;
};
// ランキングの表 card_battle_ranks へ送る1行(1人1行・上書き)。週が変わっていたら、その週の数は 0 にして送る
const cardRankRow = (record, { dexCount, dexTotal, userName, icon, profileFrame, breederId, now }) => {
  const rank = cardNormalizeRecord(record).rank;
  const key = cardWeekKeyJst(now);
  const weekWins = rank.week.key === key ? rank.week.wins : cardNormalizeLevelCounts(null);
  const row = {
    user_name: String(userName || '名無しのブリーダー').slice(0, 40),
    ...(typeof breederId === 'string' && breederId ? { breeder_id: breederId } : {}),
    icon: icon ?? null,
    ...(profileFrame ? { profile_frame: profileFrame } : {}),
    week_key: key,
    best_streak: rank.streak.best,
    current_streak: rank.streak.now,
    dex_count: cardNormalizePoint(dexCount),
    dex_total: cardNormalizePoint(dexTotal),
  };
  CARD_LEVEL_ORDER.forEach((lv) => { row[`wins_${lv}`] = rank.total[lv]; row[`week_wins_${lv}`] = weekWins[lv]; });
  return row;
};
const cardNormalizeCpuUnlocked = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  return { hard: r.hard === true, expert: r.expert === true, master: r.master === true };
};
const cardLevelOpen = (unlocked, levelId) => levelId === 'easy' || levelId === 'normal' || (unlocked && unlocked[levelId] === true);

// スターターを配る(一度きり。印がある人には二度と配らない)。300 カードポイントもいっしょに
const CARD_STARTER_POINT = 300;
const cardGrantStarter = (db, { collection, decks, point, starter }, kitId, now) => {
  if (starter) return null;
  const kit = db.starters[kitId];
  if (!kit) return null;
  const nextCol = { ...collection };
  [...kit.monsters, ...kit.cards].forEach((no) => { nextCol[no] = Math.min(99, (nextCol[no] || 0) + 1); });
  const deck = { id: `starter_${kitId}`, name: kit.name, monsters: kit.monsters.slice(), cards: kit.cards.slice() };
  const nextDecks = { active: deck.id, decks: [deck, ...decks.decks.filter((d) => d.id !== deck.id)].slice(0, CARD_DECK_MAX) };
  return { collection: nextCol, decks: nextDecks, point: point + CARD_STARTER_POINT, starter: { kit: kitId, at: now } };
};

// コンピューター戦の結果(4-1・社長が案Aに決めた 台帳 #3484)
//   カードポイント: 勝ち … 難易度の点 / 負け(最後まで)… どの難易度も 25 / 降参 … 倒した相手のモンスター × 10(25まで。0体なら0)
//   クイック周回: 勝ち … 難易度の周 / 負け … 勝ちの半分 × (自分の番の数 ÷ 10。10回で満額)/ 降参 … 倒した数 × 負けの3分の1(0体なら0)
//   ★かかった時間は見ない(止めて放っておいても増えない)。自分の番を3回やる前に終わった試合は、どちらも0(すぐ降参・すぐ負けで回せないように)
//   ★負けのポイントを難易度で増やさないのは、MASTER でわざと早く負けるのがいちばん得にならないようにするため
//   1日の上限は設けない(社長 2026-10-24。#3531 で取り消し)。その日はじめての勝ちの +50 だけは1日1回
const CARD_CPU_LOSE_POINT = 25;
const CARD_SURRENDER_POINT_PER_KO = 10;
const CARD_FIRST_WIN_BONUS = 50;
const CARD_MIN_OWN_TURNS = 3;
const CARD_LOSE_FULL_TURNS = 10;
// 対人戦(区切り4で使う。数は案A): 勝ち・負け(最後まで)・途中で抜けた で分かれる。同じ相手からは1日3戦まで
const CARD_PVP_REWARD = Object.freeze({ win: { point: 200, loops: 24 }, lose: { point: 50, loops: 12 }, left: { point: 0, loops: 0 }, dailyMax: 2200, sameFoePerDay: 3 });
// その人が自分の番を何回やったか(1ターン目は先攻の番)
const cardOwnTurns = (st, p) => {
  const t = Math.max(0, Number(st && st.turn) || 0);
  return st && st.first === p ? Math.ceil(t / 2) : Math.floor(t / 2);
};
// 倒した相手のモンスターの数
const cardKoCount = (st, p) => ((st && st.players && st.players[cardOther(p)]) ? st.players[cardOther(p)].mons.filter((m) => m.ko).length : 0);
// 1戦の結果のもと(自分の番の数・倒した数)。st が無いとき(古い呼び方)は満額あつかい
const cardResultFacts = (st, p = CARD_ME) => (st ? { ownTurns: cardOwnTurns(st, p), kos: cardKoCount(st, p) } : { ownTurns: CARD_LOSE_FULL_TURNS, kos: 0 });
const cardCpuBasePoint = (levelId, outcome, facts) => {
  const level = CARD_AI_LEVELS[levelId] || CARD_AI_LEVELS.normal;
  if (facts.ownTurns < CARD_MIN_OWN_TURNS) return 0;
  if (outcome === 'win') return level.point;
  if (outcome === 'lose') return CARD_CPU_LOSE_POINT;
  if (outcome === 'surrender') return Math.min(CARD_CPU_LOSE_POINT, facts.kos * CARD_SURRENDER_POINT_PER_KO);
  return 0;
};
// コンピューター戦のクイック周回(◯周ぶん)。周回クリア扱いにするかどうか(クイックで通したことがあるか)は、配る側(60-app)が決める
const cardCpuLoops = (levelId, outcome, facts = cardResultFacts(null)) => {
  const level = CARD_AI_LEVELS[levelId] || CARD_AI_LEVELS.normal;
  if (facts.ownTurns < CARD_MIN_OWN_TURNS) return 0;
  const loseFull = Math.floor(level.loops / 2);
  if (outcome === 'win') return level.loops;
  if (outcome === 'lose') return Math.floor(loseFull * Math.min(1, facts.ownTurns / CARD_LOSE_FULL_TURNS));
  if (outcome === 'surrender') return Math.min(loseFull, Math.round((facts.kos * loseFull) / 3));
  return 0;
};
const cardCpuReward = (daily, levelId, outcome, facts = cardResultFacts(null)) => {
  const base = cardCpuBasePoint(levelId, outcome, facts);
  // 上限なし(何戦してももらえる)。daily.cpuPoint は前のまま数えるだけで、もらえる数には使わない(保存の形は変えない・決まり⑦)
  const got = base;
  const bonus = outcome === 'win' && base > 0 && !daily.firstWin ? CARD_FIRST_WIN_BONUS : 0;
  return { base, got, capped: false, bonus, total: got + bonus, short: facts.ownTurns < CARD_MIN_OWN_TURNS, daily: { ...daily, cpuPoint: daily.cpuPoint + got, firstWin: daily.firstWin || bonus > 0 } };
};
// 勝ったら次の難易度を開く(NORMAL→HARD→EXPERT→MASTER)
const cardUnlockAfterWin = (unlocked, levelId) => {
  const i = CARD_LEVEL_ORDER.indexOf(levelId);
  const next = CARD_LEVEL_ORDER[i + 1];
  if (i < 1 || !next || unlocked[next]) return unlocked;
  return { ...unlocked, [next]: true };
};

// コンピューターどうしを最後まで戦わせる(検査と勝率の試算用)
const cardSimulate = (db, { decks, policies, seed = 1, first = 0, maxSteps = 4000 }) => {
  let st = cardCreateGame(db, { decks, seed, first });
  let s = (seed * 7919) >>> 0;
  const rand = () => { const n = cardRngNext(s); s = n.s; return n.v; };
  for (let i = 0; i < maxSteps && st.winner === null; i++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? cardOther(st.first) : cardDecider(st);
    const act = cardAiChooseAction(db, st, policies[who], rand);
    const next = cardApplyAction(db, st, act);
    if (!next) { const fb = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; st = cardApplyAction(db, st, fb) || st; if (!fb) break; }
    else st = next;
  }
  return st;
};
