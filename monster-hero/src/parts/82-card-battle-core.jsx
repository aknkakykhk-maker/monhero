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
//         when … kinds(付けられる技の種類。無ければちから・かしこさ)/ lifeMax / deckEmpty(山札0)/ area(全員に当たる技)/
//                pure(純血の子)/ breederMaxGuts(n)(そのガッツ以下のブリーダーのカードに付ける)
//         attachAdd(n) +n / attachCost(n) 払うガッツ-n / attachCostHalf 半分(切り上げ)/ attachFree 0 /
//         attachNoEvade 回避されない / attachNoGuard 回避も防御もされない / attachNoBlockReduce 防御で減らない /
//         attachNoZeroGuard 0ガッツの守りは出せない / attachNoGuardIfGuarded このターンもう守った子は守れない /
//         attachNoEvadeHybrid 混血(派生)の子は回避できない / attachBind 守りの札を1つ名前で名指し(act.bind)/ attachSelfIfHit(n)
//         付ける札は1回の攻撃に2枚まで(ブリーダーのカードは1枚)
//   特殊: draw(n) / peekHand / discardOpp(n) 相手が選んで捨てる / heal(n) 味方1体 / forbidThisTurn(kinds) このターン相手は回避(防御)を使えない
//         gutsGuard 次のターンまでガッツを減らされない / charge(kinds,n) 次のその種類の技1回をn倍(ダメージを受けると消える)
//         freeSpeThisTurn このターン、味方の特殊技(モンスターの)は0ガッツ(友情の証)
//         extraAttack(n) この子はこのターンもうn回攻撃できる / extraAttackTarget(n) もう攻撃した味方1体に / useWhenAllies(n) 味方がn体のときだけ /
//         unstunTarget 味方1体の「攻撃できない」を消す / liftTarget 相手1体をこのターンだけ空中に / unlimitedAttacks この子はこのターン何枚でも /
//         breederUnlimited このターン、ブリーダーのカードを何枚でも / taunt(mode:'only'|'not', noArea) 相手の次の番に狙える相手を縛る /
//         stunAllEnemies・stunTarget 相手(1体)は次のターン攻撃できない / skipTurn 相手の次の番を飛ばす /
//         rage 次の自分の番まで、この子は守れない。次の自分の番の技は2倍
//         ---- 区切り4: 山札・手札・捨て札・ガッツ ----
//         choose(src:'discard'|'hand', filter:{kind,attack,usable}, then) 1枚選ぶ段(st.pendingChoice)。then … toHand / toDeckBottom /
//                toDeckShuffleDraw(山札へ戻して切り、1枚引く)/ discardDraw2(捨てて2枚引く)/ oppDiscard(相手の手札から捨てさせる)
//         peekPick 相手が手札を見せる段(st.pendingReveal)→ こちらが1枚選んで捨てさせる / rush(n) 山札の上からnをガッツ。そのターンはもう出せない /
//         lastWish 自分をKO、残りライフの枚数を捨て札の新しいほうからガッツへ / gutsZeroBoth / deckToGuts / oppHandToDeckBottom・oppDraw(n) /
//         gutsToDeckShuffle / selfHurt(n) 味方1体 / oppGutsLoss(n) / refresh 手札を全部捨てて同じ数引く / millOpp(n) / discardBothHands
//         ★山札を切り直すのは、その山札の持ち主の種(players[i].rng)。マルチで相手の端末と同じ順になる(場の種 st.seed は使わない)
//         ---- 区切り5: 守りの新しい形・持ちょう ----
//         守り: redirect 目標を自分から他の味方へ(act.to。移した先はもう守れない)/ endure(kinds) ライフ1で残る / evadeAll 全員に当たる技を全員が回避 /
//               shield 1回の攻撃で味方が受けるダメージを全部この子が / noGutsLoss / takeMult(kinds,n) 受けるダメージn倍 /
//               liftAllies・waterAll 狙われていなくても出せる(自分以外の味方を空中に・味方を全員このターン水中に)
//         特殊: safe 次の自分の番まで、どこからのダメージも0 / form 空中か地上かを選ぶ(act.form)
//         ★守りで持ちょうが変わったら、当てる直前に「当たるか」を見直す(当たらなければ0)
//         ---- 区切り6: 同時に2枚・ダメージの数え方 ----
//         pair(dmg) 同じ名前を2枚同時に出したらdmg / requires(names) その札を全部一緒に出すときだけ(払うのはこの札のガッツだけ)/
//         returnOnHit ダメージを与えたら手札へ戻る / split ダメージを相手に割り振る(act.split … 相手の3体ぶんの点)/
//         bonusDiscard(user) 捨て札のその種族の攻撃の技の枚数を足す / bonusLost 減ったライフのぶんを足す / mimic(attach) どの種族のちから技でもこの子が出せる
//   使える時: useWhen(lifeMax) 自分のライフがその数以下のときだけ出せる
//   守り: evade(kinds,minGuts) / reduce(kinds,n) / reduceHalf(kinds) 半分(切り捨て)減らす / reduceAll(kinds) / reflect(kinds,frac,keep) はね返す /
//         cover 味方への1回分を自分が受ける / nextTurnMult(kinds,n) 次の自分のターンの技n倍 / becomeAir 次のターン終わりまで空中 /
//         selfGutsAll 使った人が自分のガッツを全て失う(緊急回避)
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
const cardMonType = (mon, turn) => (mon.waterUntil >= turn ? 'water' : mon.airUntil >= turn ? 'air' : mon.type); // ひきずりこむ(水中)は空中より先

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
    // rng … この山札を試合の中で切り直すときの種(自分の山札の切り方から決まる。マルチでも、山札の持ち主の端末と同じ数になる)
    return { name: names[i] || `P${i + 1}`, mons, deck, hand, guts: [], discard: [], breederUsed: false, gutsGuardUntil: -1, rng: (sh.seed ^ 0x9E3779B9) >>> 0 };
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
// 山札を切り直す(持ち主の種で。古い保存で種が無ければ場の種)
const cardReshuffle = (st, p) => {
  const me = st.players[p];
  const sh = cardShuffle(me.deck, Number.isFinite(me.rng) ? me.rng : st.seed);
  me.deck = sh.list; me.rng = sh.seed;
};
const cardDrawN = (st, p, n) => { const me = st.players[p]; let k = 0; for (let i = 0; i < n; i++) { if (!me.deck.length) break; me.hand.push(me.deck.pop()); k += 1; } return k; };
// 選ぶ段の候補(手札・捨て札の番号)。discardLen … 選ぶ段を作ったときの捨て札の数(いま使った札は選べない)
const cardChoiceCands = (db, st, p, mi, e, discardLen) => {
  const me = st.players[p];
  const list = e.src === 'hand' ? me.hand : me.discard.slice(0, discardLen === undefined ? me.discard.length : discardLen);
  const mon = mi >= 0 ? me.mons[mi] : null;
  const f = e.filter || {};
  // 絞り込みの無い選び方なら、中身の分からない札(マルチで相手の手札は仮の札)も候補に数える。数がずれると、相手の手が当てられない
  const any = !f.kind && !f.attack && !f.usable;
  return list.map((no, i) => ({ i, c: cardOf(db, no) })).filter(({ c }) => (c ? (!f.kind || c.kind === f.kind) && (!f.attack || cardIsAttackKind(c.kind)) && (!f.usable || (mon && cardUsableBy(c, mon))) : any)).map((x) => x.i);
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

// 攻撃の総ガッツ(付ける札も含む)。技のぶん(組の札も)に、付けた札の「ガッツ-n・半分・0」と友情の証を効かせてから、付けた札のぶんを足す
const cardActionCost = (db, st, p, hand, idxs) => {
  const cards = idxs.map((i) => cardOf(db, hand[i])).filter(Boolean);
  const att = cards.filter((c) => cardHasEff(c, 'attach'));
  const core = cards.filter((c) => !cardHasEff(c, 'attach'));
  let main = core.reduce((s, c) => s + (c.guts || 0), 0);
  if (core[0] && cardHasEff(core[0], 'requires')) main = core[0].guts || 0; // コンビネーション: 一緒に出す2枚のガッツは無視
  const fs = st && st.freeSpe;
  if (core[0] && core[0].kind === 'spe' && core[0].user !== 'breeder' && fs && fs.p === p && fs.turn === st.turn) main = 0;
  if (att.some((c) => cardHasEff(c, 'attachCostHalf'))) main = Math.ceil(main / 2);
  att.forEach((c) => { const e = cardEff(c, 'attachCost'); if (e) main -= e.n; });
  if (att.some((c) => cardHasEff(c, 'attachFree'))) main = 0;
  return Math.max(0, main) + att.reduce((s, c) => s + (c.guts || 0), 0);
};
// 付けた札の効き目をまとめる(ダメージ +n・×n と、守りの縛り)。攻撃を出すときとコンピューターの見積もりで同じものを使う
const CARD_ATTACH_FLAGS = ['attachNoEvade', 'attachNoGuard', 'attachNoBlockReduce', 'attachNoZeroGuard', 'attachNoGuardIfGuarded', 'attachNoEvadeHybrid'];
const cardAttachMods = (cards) => {
  const m = { add: 0, mult: 1, flags: {} };
  cards.forEach((c) => {
    if (!cardHasEff(c, 'attach')) return;
    (c.effects || []).forEach((e) => {
      if (e.t === 'attachAdd') m.add += e.n;
      if (e.t === 'attachMult') m.mult *= e.n;
      if (e.t === 'attachSelfIfHit') m.flags.selfIfHit = (m.flags.selfIfHit || 0) + e.n;
      if (CARD_ATTACH_FLAGS.includes(e.t)) m.flags[e.t] = true;
    });
  });
  return m;
};
// その札を、その技に付けられるか(main … 付ける先の技。mon … 技を出す子。ブリーダーのカードに付ける札は mon が無くてよい)
const cardAttachOk = (db, st, p, mon, main, c) => {
  const w = (cardEff(c, 'attach') || {}).when || {};
  const me = st.players[p];
  if (w.breederMaxGuts !== undefined) return main.user === 'breeder' && !cardHasEff(main, 'attach') && (main.guts || 0) <= w.breederMaxGuts;
  if (!mon || main.user === 'breeder') return false;
  if (!(w.kinds || ['pow', 'int']).includes(main.kind)) return false;
  if (w.area && !cardHasEff(main, 'area')) return false;
  if (w.lifeMax !== undefined && mon.life > w.lifeMax) return false;
  if (w.deckEmpty && me.deck.length) return false;
  if (w.pure && (mon.main || mon.sub)) return false;
  return c.user === 'breeder' ? (!me.breederUsed || cardBreederFree(st, p)) : cardUsableBy(c, mon);
};
// 付ける札の組み合わせ(0〜2枚。ブリーダーのカードは1枚まで)
const cardAttachSets = (db, st, p, mon, main, exclude) => {
  const me = st.players[p];
  const idx = me.hand.map((no, j) => ({ j, c: cardOf(db, no) })).filter(({ j, c }) => !exclude.includes(j) && c && c.ready && cardHasEff(c, 'attach') && cardAttachOk(db, st, p, mon, main, c));
  const out = [[]];
  idx.forEach((a) => out.push([a.j]));
  idx.forEach((a, k) => idx.slice(k + 1).forEach((b) => { if (a.c.name !== b.c.name && !(a.c.user === 'breeder' && b.c.user === 'breeder')) out.push([a.j, b.j]); }));
  return out;
};
// 影縛りで名指しできる名前(回避・防御の札の名前)
const cardBindNames = (db) => [...new Set(Object.values(db.cards).filter((c) => c.ready && cardIsGuardKind(c.kind)).map((c) => c.name))].sort();

// その子が、いまもう一度攻撃できるか(1ターン1枚。chain の続きだけはもう一度)
const cardMonCanAttack = (db, st, p, mi, card) => {
  const mon = st.players[p].mons[mi];
  if (!mon || mon.ko) return false;
  if (mon.stunTurn === st.turn) return false;
  if (mon.attacks === 0) return true;
  if (mon.unlimited === st.turn) return true; // 死亡遊戯・タイムディレイ
  if (mon.bonus && mon.bonus.turn === st.turn && mon.attacks < 1 + mon.bonus.n) return true; // 孤軍奮闘・オイリーオイル・ほうり上げる
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

// このターン、ブリーダーのカードを何枚でも出せるか(うたうニャ)
const cardBreederFree = (st, p) => !!(st.breederFree && st.breederFree.p === p && st.breederFree.turn === st.turn);
// 挑発・魅了などの縛り(相手の次の番に効く)。いま攻撃する p に効いているもの(縛った子が倒れていたら効かない)
const cardTauntsOn = (st, p) => (st.taunts || []).filter((t) => t.turn === st.turn && t.by === cardOther(p) && !st.players[t.by].mons[t.m].ko);
// 狙う相手の組(1体を狙う技は [その子]、全員に当たる技は当たる子の全部)が、縛りに合うか
const cardTauntOk = (st, p, targets, area) => cardTauntsOn(st, p).every((t) => {
  const hits = targets.filter((x) => x.p === t.by);
  if (t.mode === 'not') return !hits.some((x) => x.m === t.m);
  if (area) return !t.noArea || !hits.some((x) => x.m !== t.m);
  return hits.every((x) => x.m === t.m);
});
// 特殊技の狙い(null は狙わない技)。使えない場面なら空
const cardSpeTargets = (db, st, p, mi, card) => {
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  const ua = cardEff(card, 'useWhenAllies'); if (ua && me.mons.filter((m) => !m.ko).length !== ua.n) return [];
  if (cardHasEff(card, 'heal')) return me.mons.map((m, j) => (!m.ko && m.life < m.max ? { p, m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'extraAttackTarget')) return me.mons.map((m, j) => (!m.ko && m.attacks > 0 && m.stunTurn !== st.turn ? { p, m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'unstunTarget')) return me.mons.map((m, j) => (!m.ko && m.stunTurn === st.turn ? { p, m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'stunTarget') || cardHasEff(card, 'liftTarget')) return opp.mons.map((m, j) => (!m.ko ? { p: cardOther(p), m: j } : null)).filter(Boolean);
  if (cardHasEff(card, 'selfHurt')) return me.mons.map((m, j) => (!m.ko ? { p, m: j } : null)).filter(Boolean);
  // 選ぶ札が1枚も無いときは出さない(手札から選ぶ札は、このカードのほかに手札が要る)
  const ch = cardEff(card, 'choose');
  if (ch) { const n = cardChoiceCands(db, st, p, mi, ch).length - (ch.src === 'hand' ? 1 : 0); if (n <= 0) return []; }
  if (cardHasEff(card, 'peekPick') && !opp.hand.length) return [];
  return [null];
};

// ---- いまできる操作 ----
// 攻撃の候補を全部並べる(コンピューターと画面の「使えるカード」の両方に使う)
const cardAttackOptions = (db, st) => {
  if (st.phase !== 'main' || st.pending || st.pendingChoice || st.pendingReveal || st.winner !== null) return [];
  const p = st.active;
  if (st.lock && st.lock.p === p && st.lock.turn === st.turn) return []; // 突進のあと: そのターンはもう出せない
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  const guts = me.guts.length;
  const out = [];
  me.hand.forEach((no, hi) => {
    const card = cardOf(db, no);
    if (!card || !card.ready || !cardIsAttackKind(card.kind)) return;
    if (cardHasEff(card, 'attach')) return; // 付ける札は単独では出さない(下で技に付ける)
    if (card.user === 'breeder') {
      if (me.breederUsed && !cardBreederFree(st, p)) return;
      if (cardHasEff(card, 'rush') && me.playedTurn === st.turn) return; // 突進は、そのターンの最初のカード
      // ジョイのサポートなど、ブリーダーのカードに付ける札も一緒に(付けると払うガッツが変わる)
      cardAttachSets(db, st, p, null, card, [hi]).forEach((att) => {
        const hand = [hi, ...att];
        if (cardActionCost(db, st, p, me.hand, hand) > guts) return;
        if (card.kind === 'spe') {
          cardSpeTargets(db, st, p, -1, card).forEach((target) => out.push({ type: 'breeder', hand, target }));
        } else {
          me.mons.forEach((m, mi) => { if (m.ko) return; opp.mons.forEach((t, j) => { if (cardCanTarget(card, t, st.turn)) out.push({ type: 'breeder', hand, mon: mi, target: { p: cardOther(p), m: j } }); }); });
        }
      });
      return;
    }
    me.mons.forEach((mon, mi) => {
      // ものまね: その子が使えないちから技でも、ものまねを付ければ出せる
      const mimicIdx = me.hand.map((n2, j) => ({ j, c: cardOf(db, n2) })).filter(({ j, c }) => j !== hi && c && c.ready && cardHasEff(c, 'mimic') && cardUsableBy(c, mon)).map((x) => x.j);
      const byMimic = !cardUsableBy(card, mon) && card.kind === 'pow' && card.user !== 'breeder' && mimicIdx.length > 0 && !mon.ko;
      if ((!cardUsableBy(card, mon) && !byMimic) || !cardMonCanAttack(db, st, p, mi, card)) return;
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
      // キック・しっぽキック: 同じ名前の札を2枚同時に(主は手札の番号の小さいほう)
      if (cardHasEff(card, 'pair')) { const j = me.hand.findIndex((n2, k) => k > hi && cardOf(db, n2) && cardOf(db, n2).name === card.name); if (j >= 0) sets.push([hi, j]); }
      // コンビネーション: 決まった札を全部一緒に出すときだけ
      const req = cardEff(card, 'requires');
      if (req) {
        const pick = req.names.map((nm) => me.hand.findIndex((n2, k) => k !== hi && cardOf(db, n2) && cardOf(db, n2).name === nm && cardUsableBy(cardOf(db, n2), mon)));
        sets.splice(0, sets.length);
        if (pick.every((k) => k >= 0)) sets.push([hi, ...pick]);
      }
      // 付ける札(底力・クリティカルなど。0〜2枚)
      const withAttach = [];
      sets.forEach((s) => { cardAttachSets(db, st, p, mon, card, s).forEach((att) => { if (!byMimic || att.some((a) => mimicIdx.includes(a))) withAttach.push([...s, ...att]); }); });
      withAttach.forEach((idxs) => {
        const cost = cardActionCost(db, st, p, me.hand, idxs);
        if (cost > guts) return;
        if (card.kind === 'spe') {
          // 変形・トランスフォーム: 空中か地上かを選ぶ(手に form を持たせる)
          const forms = cardHasEff(card, 'form') ? ['air', 'ground'] : [undefined];
          cardSpeTargets(db, st, p, mi, card).forEach((target) => forms.forEach((form) => out.push(form ? { type: 'attack', mon: mi, hand: idxs, target, form } : { type: 'attack', mon: mi, hand: idxs, target })));
          return;
        }
        if (cardHasEff(card, 'area')) {
          const at = cardAreaTargets(st, p, mi, card);
          if (at.some((t) => t.p !== p) && cardTauntOk(st, p, at, true)) out.push({ type: 'attack', mon: mi, hand: idxs, target: null });
          return;
        }
        if (cardHasEff(card, 'split')) {
          // ショットガン: 割り振りごとに1つの手(target は無し・split に相手の3体ぶんの点)
          const alive = opp.mons.map((t) => cardCanTarget(card, t, st.turn));
          cardSplits(card.damage || 0, alive).forEach((sp) => { const ts = sp.map((x, j) => (x > 0 ? { p: cardOther(p), m: j } : null)).filter(Boolean); if (cardTauntOk(st, p, ts, false)) out.push({ type: 'attack', mon: mi, hand: idxs, target: null, split: sp }); });
          return;
        }
        opp.mons.forEach((t, j) => { if (cardCanTarget(card, t, st.turn) && cardTauntOk(st, p, [{ p: cardOther(p), m: j }], false)) out.push({ type: 'attack', mon: mi, hand: idxs, target: { p: cardOther(p), m: j } }); });
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
  const fl = pd.flags || {};
  if (fl.attachNoGuard) return []; // 瞬殺: 回避も防御も出せない
  if (pd.redirected) return []; // 隠れるで目標を移したら、移した先の子はもう守れない
  const isArea = cardHasEff(atkCard, 'area');
  const evadeBlocked = cardHasEff(atkCard, 'noEvade') || pd.noEvade || fl.attachNoEvade;
  const guts = me.guts.length;
  const out = [];
  // 挟み撃ち: このターンもう守りを出した子は、守れない
  const guardedNow = (m) => (fl.attachNoGuardIfGuarded && m.guardTurn === st.turn) || m.noGuardUntil >= st.turn; // 挟み撃ち・怒り
  me.hand.forEach((no, hi) => {
    const c = cardOf(db, no);
    if (!c || !c.ready || !cardIsGuardKind(c.kind)) return;
    if (forbid.includes(c.kind)) return;
    if (c.guts > guts) return;
    if (fl.attachNoZeroGuard && !c.guts) return; // 集中
    if (fl.bind && c.name === fl.bind) return; // 影縛りで名指しされた札
    // ---- 区切り5 ----
    // 狙われていなくても出せる守り(吹き上げる・ひきずりこむ): 味方のだれかが狙われているとき、カードの持ち主が出す
    if (cardHasEff(c, 'liftAllies') || cardHasEff(c, 'waterAll')) {
      if (tgt.p === q) me.mons.forEach((m, mi) => { if (cardUsableBy(c, m) && !guardedNow(m)) out.push({ type: 'guard', hand: hi, mon: mi }); });
      return;
    }
    // 盾になる: かばう(cover)と同じく、狙われた味方の代わりの子が出す。全員に当たる技なら、そのあとの味方のぶんも全部
    if (cardHasEff(c, 'shield')) {
      if (pd.shield !== null && pd.shield !== undefined) return;
      me.mons.forEach((m, mi) => { if (mi !== tgt.m && tgt.p === q && cardUsableBy(c, m) && !guardedNow(m)) out.push({ type: 'guard', hand: hi, mon: mi }); });
      return;
    }
    if (cardHasEff(c, 'redirect')) {
      if (tgt.p !== q || isArea || !['pow', 'int'].includes(atkCard.kind) || !cardUsableBy(c, target) || guardedNow(target)) return;
      me.mons.forEach((m, j) => { if (j !== tgt.m && !m.ko) out.push({ type: 'guard', hand: hi, mon: tgt.m, to: j }); });
      return;
    }
    if (cardHasEff(c, 'evadeAll')) {
      if (tgt.p === q && isArea && !pd.evadeAll && !evadeBlocked && !(fl.attachNoEvadeHybrid && (target.main || target.sub)) && cardUsableBy(c, target) && !guardedNow(target)) out.push({ type: 'guard', hand: hi, mon: tgt.m });
      return;
    }
    const en = cardEff(c, 'endure') || cardEff(c, 'takeMult');
    if (en) { if (tgt.p === q && en.kinds.includes(atkCard.kind) && cardUsableBy(c, target) && !guardedNow(target)) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
    if (cardHasEff(c, 'noGutsLoss')) { if (tgt.p === q && cardHasEff(atkCard, 'gutsLossOnHit') && !pd.noGutsLoss && cardUsableBy(c, target) && !guardedNow(target)) out.push({ type: 'guard', hand: hi, mon: tgt.m }); return; }
    if (cardHasEff(c, 'cover')) {
      // 味方への1回分を自分が受ける: 狙われたのが味方で、カードの持ち主(生きている別の子)が使う
      if (pd.cover !== null && pd.cover !== undefined) return;
      me.mons.forEach((m, mi) => { if (mi !== tgt.m && tgt.p === q && cardUsableBy(c, m) && !guardedNow(m)) out.push({ type: 'guard', hand: hi, mon: mi }); });
      return;
    }
    if (tgt.p !== q || !cardUsableBy(c, target) || guardedNow(target)) return;
    const ev = cardEff(c, 'evade');
    if (ev) {
      if (pd.evaded) return;
      if (cardHasEff(atkCard, 'noEvade') || pd.noEvade || fl.attachNoEvade) return;
      if (fl.attachNoEvadeHybrid && (target.main || target.sub)) return; // 純血のスピード
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
  if (st.pendingReveal) return [{ type: 'reveal' }];
  if (st.pendingChoice) return st.pendingChoice.cands.map((i) => ({ type: 'choose', pick: i }));
  if (st.pending) return [...cardGuardOptions(db, st), { type: 'pass' }];
  if (st.phase === 'main') return [...cardAttackOptions(db, st), { type: 'endAttacks' }];
  if (st.phase === 'guts') return [{ type: 'guts', hand: [] }];
  return [];
};
// いま決める番の人(守りの途中なら守る側)
const cardDecider = (st) => (st.pendingReveal ? st.pendingReveal.p : st.pendingChoice ? st.pendingChoice.p : st.pending ? st.pending.defender : st.active);

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
// 技のダメージの元(書いてある数・組・2枚同時・捨て札やライフで増える分)。付けた札・倍は別(攻撃を出すときとコンピューターの見積もりで同じ)
// discard … 技を出す前の捨て札(払ったガッツは入れない。マルチで相手の端末では、払ったガッツは仮の札のため)
const cardBaseDamage = (db, st, p, mi, main, cards, discard = st.players[p].discard) => {
  let dmg = main.damage || 0;
  const combo = cardEff(main, 'combo');
  if (combo) {
    const kinds = new Set(cards.filter((c) => combo.names.includes(c.name)).map((c) => c.name)).size;
    if (combo.table[kinds]) dmg = combo.table[kinds];
  }
  const pair = cardEff(main, 'pair'); if (pair && cards.filter((c) => c.name === main.name).length >= 2) dmg = pair.dmg;
  const me = st.players[p];
  const bd = cardEff(main, 'bonusDiscard'); if (bd) dmg += discard.map((no) => cardOf(db, no)).filter((c) => c && c.user === bd.user && cardIsAttackKind(c.kind)).length;
  const mon = mi >= 0 ? me.mons[mi] : null;
  if (cardHasEff(main, 'bonusLost') && mon) dmg += mon.max - mon.life;
  return dmg;
};
// ショットガン: ダメージの点を、生きている相手に割り振る全部の分け方(1体に全部も入る)
const cardSplits = (total, alive) => {
  const out = [];
  const rec = (i, left, cur) => {
    if (i === 3) { if (left === 0) out.push(cur.slice()); return; }
    if (!alive[i]) { cur.push(0); rec(i + 1, left, cur); cur.pop(); return; }
    for (let k = left; k >= 0; k--) { cur.push(k); rec(i + 1, left - k, cur); cur.pop(); }
  };
  rec(0, total, []);
  return out.filter((sp) => sp.some((x) => x > 0));
};
const cardStartAttack = (db, st, act) => {
  const p = st.active;
  const me = st.players[p];
  const isBreeder = act.type === 'breeder';
  const mainNo = me.hand[act.hand[0]];
  const main = cardOf(db, mainNo);
  const cost = cardActionCost(db, st, p, me.hand, act.hand);
  const used = cardTakeFromHand(st, p, act.hand);
  const discardBefore = me.discard.slice(); // 魔神ファイナルが数える(払うガッツより前)
  cardPayGuts(st, p, cost);
  me.playedTurn = st.turn; // 突進(そのターンの最初のカード)が見る
  const mi = isBreeder ? (act.mon !== undefined ? act.mon : -1) : act.mon;
  const mon = mi >= 0 ? me.mons[mi] : null;
  if (isBreeder || used.some((n) => { const c = cardOf(db, n); return c && c.user === 'breeder'; })) me.breederUsed = true; // 影縛りなどブリーダーの札を付けたときも1枚に数える
  if (!isBreeder) { mon.attacks += 1; mon.lastCard = mainNo; }
  cardLog(st, cardUseText(db, st, p, mi, used), { kind: 'use', p, cards: used });
  cardEvent(st, { t: 'use', p, mon: mi, cards: used, target: act.target || null });
  // 特殊技: 守れない。その場で効く
  if (main.kind === 'spe') {
    cardApplySpecial(db, st, p, mi, main, act.target, act);
    me.discard.push(...used);
    return;
  }
  // ダメージの元: 書いてある数・同時に使う組・付けた札・次のターンn倍
  let dmg = cardBaseDamage(db, st, p, mi, main, used.map((n) => cardOf(db, n)).filter(Boolean), discardBefore);
  const mods = cardAttachMods(used.map((n) => cardOf(db, n)).filter(Boolean));
  dmg += mods.add;
  let mult = mods.mult;
  if (mon && mon.mult && mon.mult.turn === st.turn && mon.mult.kinds.includes(main.kind)) { mult *= mon.mult.n; mon.mult = null; }
  if (mon && mon.charge && mon.charge.kinds.includes(main.kind)) { mult *= mon.charge.n; mon.charge = null; } // 静の構え
  // ショットガン: 割り振った点のある子だけが目標。付けた札の +n は、いちばん前の子のぶんに足す
  const split = cardHasEff(main, 'split') && Array.isArray(act.split) ? act.split.slice() : null;
  if (split && mods.add) { const k = split.findIndex((x) => x > 0); split[k] += mods.add; }
  const targets = split ? split.map((x, j) => (x > 0 ? { p: cardOther(p), m: j } : null)).filter(Boolean) : cardHasEff(main, 'area') ? cardAreaTargets(st, p, mi, main) : [act.target];
  st.pending = { attacker: p, defender: cardOther(p), mon: mi, main: mainNo, used, cost, base: dmg, mult, targets, ti: 0, shares: split,
    evaded: false, reduce: 0, reduceHalf: false, reduceAll: false, reflect: null, cover: null, hitAny: false, evadedAny: false, results: [],
    flags: { ...mods.flags, bind: act.bind || null } };
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
  if (pd.shield !== null && pd.shield !== undefined && t.p === pd.defender && !st.players[t.p].mons[pd.shield].ko) t = { p: t.p, m: pd.shield }; // 盾になる
  const target = st.players[t.p].mons[t.m];
  let dmg = (pd.shares ? pd.shares[pd.targets[pd.ti].m] : pd.base) * pd.mult; // ショットガンは、その子に割り振った点
  const mv = cardEff(main, 'multVs');
  if (mv && cardMonType(target, st.turn) === mv.type) dmg *= mv.n;
  if (pd.takeMult) dmg *= pd.takeMult; // 肉を切らせて
  // 守りで持ちょうが変わった(吹き上げる・ひきずりこむ)ときは、当てる直前に当たるかを見直す
  const ar = cardEff(main, 'area');
  const missed = t.p !== pd.attacker && (!cardCanTarget(main, target, st.turn) || (ar && ar.only && cardMonType(target, st.turn) !== ar.only));
  if (missed) dmg = 0;
  const evaded = pd.evaded || (pd.evadeAll && t.p !== pd.attacker); // みんな下がれ
  if (evaded) dmg = cardHasEff(main, 'halfOnEvade') ? Math.ceil(dmg / 2) : 0;
  if (!cardHasEff(main, 'noBlockReduce') && !(pd.flags || {}).attachNoBlockReduce) {
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
  if (pd.endure && dmg >= target.life && target.life > 0) dmg = target.life - 1; // 根性: ライフ1で残る
  if (target.safeUntil >= st.turn) dmg = 0; // ぬいぐるみ
  target.life = Math.max(0, target.life - dmg);
  if (dmg > 0) target.charge = null; // 静の構えはダメージを受けると終わる
  const guarded = pd.reduce > 0 || pd.reduceHalf || pd.reduceAll || !!pd.reflect || pd.cover !== null;
  const res = { p: t.p, m: t.m, dmg, evaded, reflected };
  pd.results.push(res);
  cardEvent(st, { t: 'hit', p: t.p, m: t.m, dmg, evaded, guarded, card: pd.main });
  cardLog(st, missed ? `${target.name}には当たらなかった` : evaded && dmg === 0 ? `${target.name}は回避した` : `${target.name}に${dmg}ダメージ${evaded ? '(回避されても半分)' : ''}`, { kind: 'hit' });
  const atkMon = pd.mon >= 0 ? st.players[pd.attacker].mons[pd.mon] : null;
  if (dmg > 0) {
    pd.hitAny = true;
    const gl = cardEff(main, 'gutsLossOnHit');
    if (gl && t.p !== pd.attacker && !pd.noGutsLoss) { const k = cardLoseGuts(st, t.p, gl.n); if (k) cardLog(st, `${st.players[t.p].name}はガッツを${k}失った`); }
    if (cardHasEff(main, 'stunOnHit')) { target.stunTurn = st.turn + 1; cardLog(st, `${target.name}は次のターン攻撃できない`); }
    if (cardHasEff(main, 'drain') && atkMon && !atkMon.ko) { const h = Math.min(dmg, atkMon.max - atkMon.life); atkMon.life += h; if (h) cardLog(st, `${atkMon.name}はライフを${h}回復`); }
  }
  if (!evaded || cardHasEff(main, 'halfOnEvade')) { if (!evaded) pd.hitAnyNotEvaded = true; }
  if (evaded) pd.evadedAny = true;
  if (atkMon && atkMon.safeUntil >= st.turn) reflected = 0; // ぬいぐるみ: はね返しも0
  if (reflected > 0 && atkMon && !atkMon.ko) {
    atkMon.life = Math.max(0, atkMon.life - reflected);
    atkMon.charge = null;
    cardEvent(st, { t: 'hit', p: pd.attacker, m: pd.mon, dmg: reflected, reflect: true });
    cardLog(st, `${reflected}ダメージをはね返した`);
    // はね返されてライフが0になったら、攻撃した子も倒れる(2026-10-24 までここが抜けていて、ライフ0のまま場に残っていた)
    if (atkMon.life <= 0) cardKo(st, pd.attacker, pd.mon);
  }
  if (target.life <= 0 && !target.ko) cardKo(st, t.p, t.m);
  // 次の相手へ(守りの状態は1体ごとに戻す)
  pd.ti += 1; pd.evaded = false; pd.reduce = 0; pd.reduceHalf = false; pd.reduceAll = false; pd.reflect = null; pd.cover = null; pd.noEvade = false;
  pd.redirected = false; pd.endure = false; pd.takeMult = 0; // 隠れる・根性・肉を切らせては1体ぶん(盾になる・みんな下がれ・我慢は1回の攻撃ぶん)
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
  if (pd.flags && pd.flags.selfIfHit && pd.results.some((r) => !r.evaded)) self += pd.flags.selfIfHit; // 捨て身
  if (atkMon && atkMon.safeUntil >= st.turn) self = 0; // ぬいぐるみ: 自分の技の反動も0
  if (self > 0 && atkMon && !atkMon.ko) {
    atkMon.life = Math.max(0, atkMon.life - self);
    atkMon.charge = null;
    cardEvent(st, { t: 'hit', p: pd.attacker, m: pd.mon, dmg: self, self: true });
    cardLog(st, `${atkMon.name}も${self}ダメージを受けた`);
    if (atkMon.life <= 0) cardKo(st, pd.attacker, pd.mon);
  }
  // ポン拳: ダメージを与えたら、この札は捨て札にならず手札へ戻る
  if (cardHasEff(main, 'returnOnHit') && pd.results.some((r) => r.dmg > 0 && r.p !== pd.attacker)) {
    const k = pd.used.indexOf(pd.main);
    me.discard.push(...pd.used.filter((_, i) => i !== k));
    me.hand.push(pd.main);
    cardLog(st, `「${main.name}」は手札に戻った`);
  } else me.discard.push(...pd.used);
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
const cardApplySpecial = (db, st, p, mi, card, target, act = {}) => {
  const me = st.players[p];
  const opp = st.players[cardOther(p)];
  (card.effects || []).forEach((e) => {
    if (e.t === 'draw') { for (let i = 0; i < e.n; i++) { if (!me.deck.length) break; me.hand.push(me.deck.pop()); } cardLog(st, `${me.name}は${e.n}枚引いた`); }
    if (e.t === 'peekHand') { cardEvent(st, { t: 'peek', p, hand: opp.hand.slice() }); cardLog(st, `${me.name}は相手の手札を見た`); }
    if (e.t === 'discardOpp') { st.pendingDiscard = { p: cardOther(p), n: Math.min(e.n, opp.hand.length) }; if (!st.pendingDiscard.n) st.pendingDiscard = null; }
    if (e.t === 'heal' && target) { const m = me.mons[target.m]; const h = Math.min(e.n, m.max - m.life); m.life += h; cardEvent(st, { t: 'heal', p, m: target.m, n: h }); cardLog(st, `${m.name}のライフが${h}回復`); }
    if (e.t === 'gutsGuard') { me.gutsGuardUntil = st.turn + 1; cardLog(st, `${me.name}は次のターンまでガッツを減らされない`); }
    if (e.t === 'charge' && mi >= 0) { me.mons[mi].charge = { kinds: e.kinds, n: e.n }; cardLog(st, `${me.mons[mi].name}は次の${e.kinds.includes('pow') ? 'ちから' : 'かしこさ'}技のダメージが${e.n}倍`); }
    const self = mi >= 0 ? me.mons[mi] : null;
    const tm = target ? st.players[target.p].mons[target.m] : null;
    const addBonus = (m, n) => { m.bonus = { turn: st.turn, n: (m.bonus && m.bonus.turn === st.turn ? m.bonus.n : 0) + n }; };
    if (e.t === 'extraAttack' && self) { addBonus(self, e.n); cardLog(st, `${self.name}はこのターン、もう${e.n}回攻撃できる`); }
    if (e.t === 'extraAttackTarget' && tm) { addBonus(tm, e.n); cardLog(st, `${tm.name}はもう${e.n}回攻撃できる`); }
    if (e.t === 'unstunTarget' && tm) { tm.stunTurn = -1; cardLog(st, `${tm.name}は攻撃できるようになった`); }
    if (e.t === 'liftTarget' && tm) { tm.airUntil = Math.max(tm.airUntil, st.turn); cardLog(st, `${tm.name}はこのターン空中になった`); }
    if (e.t === 'unlimitedAttacks' && self) { self.unlimited = st.turn; cardLog(st, `${self.name}はこのターン、技を何枚でも出せる`); }
    if (e.t === 'breederUnlimited') { st.breederFree = { p, turn: st.turn }; cardLog(st, `このターン、${me.name}はブリーダーのカードを何枚でも出せる`); }
    if (e.t === 'taunt' && self) { st.taunts = [...(st.taunts || []).filter((t) => t.turn >= st.turn), { by: p, m: mi, mode: e.mode, noArea: !!e.noArea, turn: st.turn + 1 }]; cardLog(st, e.mode === 'not' ? `相手は次の番、${self.name}に当たる技を出せない` : `相手は次の番、${self.name}を狙う技しか出せない`); }
    if (e.t === 'stunAllEnemies') { opp.mons.forEach((m) => { if (!m.ko) m.stunTurn = st.turn + 1; }); cardLog(st, '相手のモンスターは全員、次のターン攻撃できない'); }
    if (e.t === 'stunTarget' && tm) { tm.stunTurn = st.turn + 1; cardLog(st, `${tm.name}は次のターン攻撃できない`); }
    if (e.t === 'skipTurn') { st.skip = cardOther(p); cardLog(st, `${opp.name}の次の番を飛ばす`); }
    if (e.t === 'rage' && self) { self.noGuardUntil = st.turn + 1; self.mult = { turn: st.turn + 2, kinds: ['pow', 'int'], n: 2 }; cardLog(st, `${self.name}は次の番まで守れない。次の番の技は2倍`); }
    // ---- 区切り5 ----
    if (e.t === 'safe' && self) { self.safeUntil = st.turn + 1; cardLog(st, `${self.name}は次の番までダメージを受けない`); }
    if (e.t === 'form' && self && (act.form === 'air' || act.form === 'ground')) { self.type = act.form; cardLog(st, `${self.name}は${act.form === 'air' ? '空中' : '地上'}になった`); }
    // ---- 区切り4 ----
    if (e.t === 'choose') {
      const cands = cardChoiceCands(db, st, p, mi, e);
      if (cands.length) st.pendingChoice = { p, src: e.src, then: e.then, cands, card: card.no };
      else cardLog(st, '選べるカードが無かった');
    }
    if (e.t === 'peekPick') {
      if (opp.hand.length) { st.pendingReveal = { p: cardOther(p), next: { p, src: 'oppHand', then: 'oppDiscard', card: card.no } }; cardLog(st, `${opp.name}は手札を見せる`); }
    }
    if (e.t === 'rush') { let k = 0; for (let i = 0; i < e.n && me.deck.length; i++) { me.guts.push(me.deck.pop()); k += 1; } st.lock = { p, turn: st.turn }; cardLog(st, `${me.name}は山札の上から${k}枚をガッツにした。このターンはもう出せない`); }
    if (e.t === 'lastWish' && self) {
      const n = self.life;
      cardKo(st, p, mi);
      const k = Math.min(n, me.discard.length);
      me.guts.push(...me.discard.splice(me.discard.length - k, k));
      cardLog(st, `捨て札から${k}枚をガッツにした`);
      cardCheckWin(st, p);
    }
    if (e.t === 'gutsZeroBoth') { me.discard.push(...me.guts.splice(0)); const k = cardLoseGuts(st, cardOther(p), 'all'); cardLog(st, `お互いのガッツが0になった${k === 0 && opp.guts.length ? '(相手は精神集中で減らない)' : ''}`); }
    if (e.t === 'deckToGuts') { const k = me.deck.length; me.guts.push(...me.deck.splice(0)); cardLog(st, `山札の${k}枚を全部ガッツにした`); }
    if (e.t === 'oppHandToDeckBottom') { const k = opp.hand.length; opp.deck.unshift(...opp.hand.splice(0)); cardLog(st, `${opp.name}の手札${k}枚を山札の一番下へ`); }
    if (e.t === 'oppDraw') { const k = cardDrawN(st, cardOther(p), e.n); cardLog(st, `${opp.name}は${k}枚引いた`); }
    if (e.t === 'gutsToDeckShuffle') { const k = me.guts.length; me.deck.push(...me.guts.splice(0)); cardReshuffle(st, p); cardLog(st, `${me.name}はガッツ${k}枚を山札に戻して切った`); }
    if (e.t === 'selfHurt' && tm && tm.safeUntil >= st.turn) cardLog(st, `${tm.name}はダメージを受けない(ぬいぐるみ)`);
    else if (e.t === 'selfHurt' && tm) { tm.life = Math.max(0, tm.life - e.n); cardEvent(st, { t: 'hit', p: target.p, m: target.m, dmg: e.n, self: true }); cardLog(st, `${tm.name}のライフが${e.n}減った`); if (tm.life <= 0) { cardKo(st, target.p, target.m); cardCheckWin(st, p); } }
    if (e.t === 'oppGutsLoss') { const k = cardLoseGuts(st, cardOther(p), e.n); cardLog(st, `${opp.name}はガッツを${k}失った`); }
    if (e.t === 'refresh') { const k = me.hand.length; me.discard.push(...me.hand.splice(0)); cardDrawN(st, p, k); cardLog(st, `${me.name}は手札を${k}枚捨てて、引き直した`); }
    if (e.t === 'millOpp') { let k = 0; for (let i = 0; i < e.n && opp.deck.length; i++) { opp.discard.push(opp.deck.pop()); k += 1; } cardLog(st, `${opp.name}の山札を${k}枚捨て札にした`); }
    if (e.t === 'discardBothHands') { me.discard.push(...me.hand.splice(0)); opp.discard.push(...opp.hand.splice(0)); cardLog(st, 'お互いの手札を全部捨てた'); }
    if (e.t === 'freeSpeThisTurn') { st.freeSpe = { p, turn: st.turn }; cardLog(st, `このターン、${me.name}の味方の特殊技は0ガッツ`); }
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
  user.guardTurn = st.turn; // 挟み撃ちが見る
  cardLog(st, `${user.name}の「${c.name}」`, { kind: 'guard', p: q, cards: [no] });
  cardEvent(st, { t: 'guard', p: q, mon: act.mon, card: no });
  (c.effects || []).forEach((e) => {
    if (e.t === 'evade') pd.evaded = true;
    if (e.t === 'reduce') pd.reduce += e.n;
    if (e.t === 'reduceHalf') pd.reduceHalf = true;
    if (e.t === 'reduceAll') pd.reduceAll = true;
    if (e.t === 'reflect') pd.reflect = { frac: e.frac, keep: !!e.keep };
    if (e.t === 'cover') pd.cover = act.mon;
    if (e.t === 'redirect') { pd.targets[pd.ti] = { p: q, m: act.to }; pd.redirected = true; cardLog(st, `目標が${me.mons[act.to].name}に変わった`); }
    if (e.t === 'endure') pd.endure = true;
    if (e.t === 'evadeAll') { pd.evadeAll = true; pd.evaded = true; }
    if (e.t === 'shield') pd.shield = act.mon;
    if (e.t === 'noGutsLoss') pd.noGutsLoss = true;
    if (e.t === 'takeMult') pd.takeMult = e.n;
    if (e.t === 'liftAllies') { me.mons.forEach((m, j) => { if (j !== act.mon && !m.ko) m.airUntil = Math.max(m.airUntil, st.turn + 1); }); cardLog(st, `${user.name}以外の味方が空中になった`); }
    if (e.t === 'waterAll') { me.mons.forEach((m) => { if (!m.ko) m.waterUntil = st.turn; }); cardLog(st, '味方が全員水中になった'); }
    if (e.t === 'nextTurnMult') user.mult = { turn: st.turn + 1, kinds: e.kinds, n: e.n };
    if (e.t === 'becomeAir') user.airUntil = st.turn + 1;
    // 自分で捨てるガッツなので、精神集中(相手に減らされない)でも止まらない
    if (e.t === 'selfGutsAll' && me.guts.length) { const k = me.guts.length; me.discard.push(...me.guts.splice(0)); cardLog(st, `${me.name}はガッツを${k}失った`); }
  });
};

// ---- 操作を1つ進める(作り直した状態を返す。だめな操作は null) ----
const cardApplyAction = (db, st0, act) => {
  if (!act || st0.winner !== null) return null;
  const st = cardClone(st0);
  st.events = [];
  const p = st.active;
  // 見せる段(死神の力): 手札の持ち主が見せる。そのあと、使った人が1枚選ぶ
  if (st.pendingReveal) {
    if (act.type !== 'reveal') return null;
    const nx = st.pendingReveal.next;
    const q = st.pendingReveal.p;
    st.pendingReveal = null;
    cardEvent(st, { t: 'peek', p: nx.p, hand: st.players[q].hand.slice() });
    const cands = st.players[q].hand.map((_, i) => i);
    if (cands.length) st.pendingChoice = { ...nx, cands };
    return st;
  }
  // 選ぶ段: 候補の中から1枚
  if (st.pendingChoice) {
    const ch = st.pendingChoice;
    if (act.type !== 'choose' || !ch.cands.includes(act.pick)) return null;
    const me = st.players[ch.p];
    const opp = st.players[cardOther(ch.p)];
    const take = (list) => list.splice(act.pick, 1)[0];
    st.pendingChoice = null;
    if (ch.then === 'toHand') { const no = take(me.discard); me.hand.push(no); cardLog(st, `${me.name}は捨て札から「${(cardOf(db, no) || {}).name || ''}」を手札に加えた`); }
    if (ch.then === 'toDeckBottom') { const no = take(me.discard); me.deck.unshift(no); cardLog(st, `${me.name}は捨て札から「${(cardOf(db, no) || {}).name || ''}」を山札の一番下へ戻した`); }
    if (ch.then === 'toDeckShuffleDraw') { me.deck.push(take(me.hand)); cardReshuffle(st, ch.p); cardDrawN(st, ch.p, 1); cardLog(st, `${me.name}は手札を1枚山札に戻して切り、1枚引いた`); }
    if (ch.then === 'discardDraw2') { me.discard.push(take(me.hand)); const k = cardDrawN(st, ch.p, 2); cardLog(st, `${me.name}は手札を1枚捨てて、${k}枚引いた`); }
    if (ch.then === 'oppDiscard') { const no = take(opp.hand); opp.discard.push(no); cardLog(st, `${opp.name}は「${(cardOf(db, no) || {}).name || ''}」を捨てた`); }
    return st;
  }
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
    const ok = cardGuardOptions(db, st0).some((o) => o.hand === act.hand && o.mon === act.mon && o.to === act.to); // 隠れるは移す先(to)も合わせる
    if (!ok) return null;
    cardApplyGuard(db, st, act);
    return st;
  }
  if (st.phase === 'main') {
    if (act.type === 'endAttacks') { st.phase = 'guts'; return st; }
    if (act.type !== 'attack' && act.type !== 'breeder') return null;
    const ok = cardAttackOptions(db, st0).some((o) => o.type === act.type && o.mon === act.mon && JSON.stringify(o.hand) === JSON.stringify(act.hand) && JSON.stringify(o.target) === JSON.stringify(act.target || null) && o.form === act.form && JSON.stringify(o.split) === JSON.stringify(act.split));
    if (!ok) return null;
    // 影縛り: 名指しが要る札を付けたら、回避・防御の札の名前が1つ要る(付けていなければ名指しは持たない)
    const needBind = act.hand.some((i) => cardHasEff(cardOf(db, st0.players[p].hand[i]), 'attachBind'));
    if (needBind ? !(typeof act.bind === 'string' && cardBindNames(db).includes(act.bind)) : act.bind !== undefined && act.bind !== null) return null;
    cardStartAttack(db, st, act);
    return st;
  }
  if (st.phase === 'guts') {
    if (act.type !== 'guts') return null;
    const taken = cardTakeFromHand(st, p, act.hand || []);
    st.players[p].guts.push(...taken);
    if (taken.length) cardLog(st, `${st.players[p].name}は${taken.length}枚をガッツにした`);
    st.active = cardOther(p);
    // 歌う: 相手の番を飛ばす(引く・攻撃・ガッツ置きが無い。その番の数だけ進めて、こちらの番へ)
    if (st.skip === st.active) { st.skip = null; st.turn += 1; cardLog(st, `ターン${st.turn}: ${st.players[st.active].name}の番は飛ばされた`, { kind: 'turn' }); st.active = p; }
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
const cardAiEvadeChance = (db, st, p, card, target, level, flags = {}) => {
  if (cardHasEff(card, 'noEvade') || card.kind === 'spe') return 0;
  if (flags.attachNoEvade || flags.attachNoGuard) return 0; // 電光石火・瞬殺など
  const q = cardOther(p);
  const opp = st.players[q];
  const tmon = opp.mons[target.m];
  if (flags.attachNoEvadeHybrid && (tmon.main || tmon.sub)) return 0; // 純血のスピード
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
      // 区切り5
      if (e.t === 'safe') { const m0 = opt.mon >= 0 ? me.mons[opt.mon] : null; score += m0 && m0.life <= Math.ceil(m0.max / 2) ? 1.4 : 0.4; }
      if (e.t === 'form') score += 0.2;
      // 区切り4: 山札・手札・捨て札・ガッツ
      const oppP = st.players[cardOther(p)];
      if (e.t === 'choose') score += e.then === 'toHand' ? 1.3 : e.then === 'discardDraw2' ? 0.9 : 0.3;
      if (e.t === 'peekPick') score += 1.4 * habit.disrupt;
      if (e.t === 'rush') score += me.guts.length < 4 ? 1.6 : 0.2;
      if (e.t === 'lastWish') { const m0 = opt.mon >= 0 ? me.mons[opt.mon] : null; score += m0 ? Math.min(m0.life, me.discard.length) * 0.6 - 2.5 - (me.mons.filter((m) => !m.ko).length <= 1 ? 99 : 0) : -9; }
      if (e.t === 'gutsZeroBoth') score += (oppP.guts.length - me.guts.length) * 0.6;
      if (e.t === 'deckToGuts') score += me.deck.length <= 3 ? 1 : -3;
      if (e.t === 'oppHandToDeckBottom') score += 0.5 * habit.disrupt;
      if (e.t === 'gutsToDeckShuffle') score += me.deck.length < 6 ? me.guts.length * 0.5 : -1;
      if (e.t === 'selfHurt') { const t0 = opt.target ? me.mons[opt.target.m] : null; score += t0 && t0.life >= 3 ? 0.3 : -5; }
      if (e.t === 'oppGutsLoss') score += Math.min(e.n, oppP.guts.length) * 0.8 * habit.disrupt;
      if (e.t === 'refresh') score += me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && c.user !== 'breeder' && c.user !== 'any' && !me.mons.some((m) => !m.ko && cardUsableBy(c, m))).length * 0.6 - 0.4;
      if (e.t === 'millOpp') score += oppP.deck.length <= e.n ? 3 : 0.5;
      if (e.t === 'discardBothHands') score += (oppP.hand.length - (me.hand.length - opt.hand.length)) * 0.6;
      // 区切り3: もう1回・何枚でも・攻撃できない・縛り・番を飛ばす
      const mine = opt.mon >= 0 ? me.mons[opt.mon] : null;
      const tmon = opt.target ? st.players[opt.target.p].mons[opt.target.m] : null;
      const attacksFor = (m) => (m ? me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && cardIsAttackKind(c.kind) && c.kind !== 'spe' && cardUsableBy(c, m) && c.guts <= me.guts.length - cost).length : 0);
      if (e.t === 'extraAttack') score += Math.min(1, attacksFor(mine)) * 1.6;
      if (e.t === 'extraAttackTarget' || e.t === 'unstunTarget') score += Math.min(1, attacksFor(tmon)) * 1.6;
      if (e.t === 'unlimitedAttacks') score += Math.min(3, attacksFor(mine)) * 0.9 - 0.4;
      if (e.t === 'breederUnlimited') score += me.hand.filter((n) => (cardOf(db, n) || {}).user === 'breeder').length * 0.7 - 0.3;
      if (e.t === 'liftTarget') score += 0.3;
      if (e.t === 'taunt') score += 0.9 * habit.disrupt;
      if (e.t === 'stunAllEnemies') score += st.players[cardOther(p)].mons.filter((m) => !m.ko).length * 1.0;
      if (e.t === 'stunTarget' && tmon) score += 0.8 + (tmon.life / Math.max(1, tmon.max)) * 0.6;
      if (e.t === 'skipTurn') score += 3;
      if (e.t === 'rage' && mine) score += Math.max(0, ...me.hand.map((n) => cardOf(db, n)).filter((c) => c && (c.kind === 'pow' || c.kind === 'int') && cardUsableBy(c, mine)).map((c) => c.damage || 0)) * 0.35 - 0.6;
      // 友情の証: このターン、手札のほかの特殊技を0ガッツで出せる
      if (e.t === 'freeSpeThisTurn') score += me.hand.filter((_, i) => !opt.hand.includes(i)).map((n) => cardOf(db, n)).filter((c) => c && c.kind === 'spe' && c.user !== 'breeder' && !cardHasEff(c, 'attach')).reduce((s2, c) => s2 + (c.guts || 0) * 0.4, 0);
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
    let dmg = cardBaseDamage(db, st, p, opt.mon, main, opt.hand.map((i) => cardOf(db, me.hand[i])).filter(Boolean));
    const mods = cardAttachMods(opt.hand.map((i) => cardOf(db, me.hand[i])).filter(Boolean));
    dmg = (dmg + mods.add) * mods.mult;
    const mon = opt.mon >= 0 ? me.mons[opt.mon] : null;
    if (mon && mon.mult && mon.mult.turn === st.turn && mon.mult.kinds.includes(main.kind)) dmg *= mon.mult.n;
    if (mon && mon.charge && mon.charge.kinds.includes(main.kind)) dmg *= mon.charge.n;
    const targets = opt.split ? opt.split.map((x, j) => (x > 0 ? { p: cardOther(p), m: j } : null)).filter(Boolean) : cardHasEff(main, 'area') ? cardAreaTargets(st, p, opt.mon, main) : [opt.target];
    const per = dmg / Math.max(1, main.damage || 1); // ショットガン: 割り振った点に、付けた札・倍の割合を掛ける
    targets.forEach((t) => {
      const tm = st.players[t.p].mons[t.m];
      let d = opt.split ? Math.round(opt.split[t.m] * per) : dmg;
      const mv = cardEff(main, 'multVs'); if (mv && cardMonType(tm, st.turn) === mv.type) d *= mv.n;
      if (cardHasEff(main, 'nonLethal')) d = Math.min(d, tm.life - 1);
      // 影縛り: 名指しで当たりやすくなる見込み(半分)
      const ev = cardAiEvadeChance(db, st, p, main, t, level, mods.flags) * (opt.hand.some((i) => cardHasEff(cardOf(db, me.hand[i]), 'attachBind')) ? 0.5 : 1);
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
    const si = mods.flags.selfIfHit; if (si && mon) score -= si * (mon.life <= si ? 3 : 0.6); // 捨て身
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
    if (cardHasEff(c, 'cover') || cardHasEff(c, 'shield')) {
      const cm = me.mons[o.mon];
      after = target.life <= dmg && cm.life > dmg ? 0 : dmg; // 倒れそうな味方を、硬い子がかばう
    }
    // 区切り5
    let extra = 0;
    if (cardHasEff(c, 'redirect')) { const am = me.mons[o.to]; after = 0; extra -= Math.min(dmg, am.life) * 0.9 + (am.life <= dmg ? 5 : 0); }
    if (cardHasEff(c, 'endure')) after = dmg >= target.life ? target.life - 1 : dmg;
    if (cardHasEff(c, 'evadeAll')) { after = cardHasEff(main, 'halfOnEvade') ? Math.ceil(dmg / 2) : 0; extra += (pd.targets.length - pd.ti - 1) * Math.min(3, dmg) * 0.6; }
    if (cardHasEff(c, 'noGutsLoss')) { const gl = cardEff(main, 'gutsLossOnHit'); extra += (gl ? (gl.n === 'all' ? me.guts.length : Math.min(gl.n, me.guts.length)) : 0) * 0.6; }
    if (cardHasEff(c, 'takeMult')) { after = dmg * 2; extra += 1.2; }
    if (cardHasEff(c, 'liftAllies') || cardHasEff(c, 'waterAll')) {
      const tmp = JSON.parse(JSON.stringify(target));
      if (cardHasEff(c, 'waterAll')) tmp.waterUntil = st.turn; else if (o.mon !== tgt.m) tmp.airUntil = st.turn + 1;
      const ar = cardEff(main, 'area');
      after = !cardCanTarget(main, tmp, st.turn) || (ar && ar.only && cardMonType(tmp, st.turn) !== ar.only) ? 0 : dmg;
    }
    const saved = Math.min(dmg, target.life) - Math.min(after, target.life);
    const ko = target.life <= dmg && target.life > after ? 5 : 0;
    const lostAll = cardHasEff(c, 'selfGutsAll') ? me.guts.length - c.guts : 0; // 緊急回避: 残りのガッツも全部なくなる
    const v = extra + saved * (0.6 + 0.4 * habit.keepGuard) + ko - (c.guts + lostAll) * 0.35 * habit.saveGuts + (rf ? (rf.keep ? Math.floor(dmg * rf.frac) : dmg) * 0.6 : 0);
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

// 影縛りを付けた手に、名指しする守りの名前を入れる。手札を読む難易度は相手の手札の守り、
//   ほかは相手の捨て札でいちばん多い守り(見えている札だけ)、無ければ狙う子が使える回避の札
const cardAiFillBind = (db, st, o, policy) => {
  if (!o || !Array.isArray(o.hand)) return o;
  const me = st.players[st.active];
  if (!o.hand.some((i) => cardHasEff(cardOf(db, me.hand[i]), 'attachBind'))) return o;
  const opp = st.players[cardOther(st.active)];
  const tmon = o.target && o.target.p !== st.active ? opp.mons[o.target.m] : opp.mons.find((m) => !m.ko);
  const guardName = (no) => { const c = cardOf(db, no); return c && c.ready && cardIsGuardKind(c.kind) && (!tmon || c.user === 'any' || cardUsableBy(c, tmon)) ? c.name : null; };
  const seen = (policy.level.readHand ? opp.hand : opp.discard).map(guardName).filter(Boolean);
  const count = {}; seen.forEach((n) => { count[n] = (count[n] || 0) + 1; });
  let name = Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1))[0];
  if (!name) name = Object.values(db.cards).filter((c) => c.ready && cardHasEff(c, 'evade') && (!tmon || cardUsableBy(c, tmon))).map((c) => c.name).sort()[0] || cardBindNames(db)[0];
  return { ...o, bind: name };
};

// 次の1手を選ぶ(★差し替えられる口。別の考え方を差すときは、同じ形 (db, st, policy, rand) → 操作 で渡す)
const cardAiChooseAction = (db, st, policy, rand = Math.random) => {
  if (st.pendingReveal) return { type: 'reveal' };
  if (st.pendingChoice) {
    // 選ぶ段: 手に入れる・山札へ戻すなら強い札、手札から出すなら要らない札、相手に捨てさせるなら相手の強い札
    const ch = st.pendingChoice;
    const me = st.players[ch.p];
    const list = ch.then === 'oppDiscard' ? st.players[cardOther(ch.p)].hand : ch.src === 'hand' ? me.hand : me.discard;
    const worth = (no) => { const c = cardOf(db, no); if (!c) return -9; const usable = c.user === 'breeder' || c.user === 'any' || me.mons.some((m) => !m.ko && cardUsableBy(c, m)); return (usable ? 1 : -3) + (c.damage || 0) * 0.5 + (cardIsGuardKind(c.kind) ? 1.5 : 0) - Math.max(0, c.guts - me.guts.length) * 0.3; };
    const best = ch.cands.slice().sort((a, b) => (ch.then === 'toDeckShuffleDraw' || ch.then === 'discardDraw2' ? worth(list[a]) - worth(list[b]) : worth(list[b]) - worth(list[a])) || a - b)[0];
    return { type: 'choose', pick: best };
  }
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
  if (sloppy) return rand() < 0.25 ? { type: 'endAttacks' } : cardAiFillBind(db, st, opts[Math.floor(rand() * opts.length)], policy);
  const scored = opts.map((o) => ({ o, s: cardAiScoreAttack(db, st, o, policy) })).sort((a, b) => b.s - a.s);
  if (scored[0].s <= 0.3) return { type: 'endAttacks' };
  if (rand() < policy.level.whim) {
    const pool = scored.filter((x) => x.s > 0.3).slice(0, 3);
    return cardAiFillBind(db, st, pool[Math.floor(rand() * pool.length)].o, policy);
  }
  return cardAiFillBind(db, st, scored[0].o, policy);
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
const CARD_AI_ATTACH_MAX = 6;

// カード1枚の「入れたい度」(くせの重みを掛ける)
const cardAiCardValue = (card, habit) => {
  const eff = (t) => cardHasEff(card, t);
  // 技に付ける札(区切り2): 1枚では何もしないので控えめ。条件つきのものはさらに下げる
  if (eff('attach')) {
    let v = 0.3;
    (card.effects || []).forEach((e) => {
      if (e.t === 'attachAdd') v += e.n * 0.35;
      if (e.t === 'attachMult') v += (e.n - 1) * 0.7;
      if (e.t === 'attachCost') v += e.n * 0.3;
      if (e.t === 'attachCostHalf' || e.t === 'attachFree') v += 0.6;
      if (e.t === 'attachNoEvade' || e.t === 'attachNoGuard') v += 0.7;
      if (e.t === 'mimic') v += 0.4;
      if (e.t === 'attachBind' || e.t === 'attachNoEvadeHybrid' || e.t === 'attachNoBlockReduce' || e.t === 'attachNoZeroGuard' || e.t === 'attachNoGuardIfGuarded') v += 0.35;
      if (e.t === 'attachSelfIfHit') v -= e.n * 0.3;
    });
    const w = cardEff(card, 'attach').when || {};
    if (w.deckEmpty) v *= 0.2;
    if (w.lifeMax !== undefined) v *= 0.5;
    if (w.area) v *= 0.6 * habit.area;
    return v - card.guts * 0.3;
  }
  if (cardIsGuardKind(card.kind)) {
    let v = eff('evade') ? 2.2 : eff('reduceAll') ? 2.4 : eff('reflect') ? 2.3 : eff('cover') ? 1.4 : eff('endure') ? 1.1 : eff('redirect') ? 1.0 : eff('shield') ? 1.0
      : eff('evadeAll') ? 1.2 : eff('noGutsLoss') ? 0.8 : eff('takeMult') ? 0.5 : (eff('liftAllies') || eff('waterAll')) ? 0.6 : 1.6;
    const re = cardEff(card, 'reduce'); if (re) v = 1 + re.n * 0.4;
    if (eff('selfGutsAll')) v -= 1.4; // 緊急回避: 守れても、ためたガッツを全部なくす
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
      if (e.t === 'extraAttack') v += 0.8;
      if (e.t === 'extraAttackTarget') v += 0.6;
      if (e.t === 'unstunTarget') v += 0.2;
      if (e.t === 'liftTarget') v += 0.2;
      if (e.t === 'unlimitedAttacks') v += 1.0;
      if (e.t === 'breederUnlimited') v += 0.4;
      if (e.t === 'taunt') v += 0.6 * habit.disrupt;
      if (e.t === 'stunAllEnemies') v += 1.2;
      if (e.t === 'stunTarget') v += 0.8;
      if (e.t === 'skipTurn') v += 1.5;
      if (e.t === 'rage') v += 0.6;
      if (e.t === 'choose') v += e.then === 'toHand' ? 0.8 : 0.3;
      if (e.t === 'safe') v += 0.8;
      if (e.t === 'form') v += 0.1;
      if (e.t === 'peekPick') v += 0.8 * habit.disrupt;
      if (e.t === 'rush' || e.t === 'gutsZeroBoth' || e.t === 'oppHandToDeckBottom' || e.t === 'oppGutsLoss' || e.t === 'millOpp' || e.t === 'discardBothHands' || e.t === 'refresh') v += 0.3;
      if (e.t === 'lastWish' || e.t === 'deckToGuts' || e.t === 'gutsToDeckShuffle' || e.t === 'selfHurt') v -= 0.3;
    });
    if (cardHasEff(card, 'useWhenAllies')) v *= 0.4;
    return v - card.guts * 0.3;
  }
  let dmg = card.damage || 0;
  if (eff('combo')) dmg = 3;
  const pr = cardEff(card, 'pair'); if (pr) dmg = pr.dmg * 0.45; // 2枚そろったときだけ
  if (eff('requires')) dmg *= 0.3; // 決まった札がそろわないと出せない
  if (eff('bonusDiscard') || eff('bonusLost')) dmg += 3;
  if (eff('returnOnHit')) dmg += 0.8;
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
  const pool = Object.values(db.cards).filter((c) => c.ready && c.wave <= maxWave
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
  // 技に付ける札は、1枚では何もしないので6枚まで(多いと手札が腐る。区切り2で足した)
  let attached = 0;
  const add = (c, n) => {
    for (let i = 0; i < n && cards.length < CARD_BATTLE_DECK_SIZE; i++) {
      const isHeavy = !cardIsGuardKind(c.kind) && c.guts >= 5;
      if (isHeavy && heavy >= heavyMax) return;
      if (cardHasEff(c, 'attach') && attached >= CARD_AI_ATTACH_MAX) return;
      if (cardHasEff(c, 'attach')) attached += 1;
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
  pitySplit: 'mh_card_pack_pity_split_v1', // 以前の4弾の天井の数を新しい8弾へ写した印(1回だけ。89 の cardSplitPity)
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
  const pick = (val, list, def) => (list.includes(val) ? val : def);
  const onOff = (val, def) => (val === 'ON' || val === 'OFF' ? val : def);
  // 前の「対戦の進む速さ」(speed: 'fast')は、相手が考える時間「はやい」と結果までの間「短め」の2つに分けた。前の値はここで引き継ぐ
  const oldFast = r.speed === 'fast';
  const think = pick(r.think, CARD_THINK_IDS, oldFast ? 'FAST' : 'NORMAL');
  return {
    speed: think === 'FAST' || think === 'FAST2' ? 'fast' : 'normal', // 前の作りが読む名前(残しておく)
    autoPass: r.autoPass !== false,
    // quickAutoStart … MFバトルカードを開いたら裏のクイック∞周回を自動で始める・負けたら数秒おいて始め直す(社長 2026-10-25。モンヒロビートの「開いたら自動で始める」と同じ中身。最初は OFF)
    quickAutoStart: r.quickAutoStart === true,
    // ここから下は、対戦中の設定(社長 2026-10-25「オプションでバトル中の設定関係を各種作って」)。既定はどれも、足す前の動きと同じ
    think,
    resultWait: pick(r.resultWait, ['NORMAL', 'SHORT', 'QUICK'], oldFast ? 'SHORT' : 'NORMAL'),
    motion: pick(r.motion, ['FULL', 'SHORT', 'OFF'], 'FULL'),
    shake: onOff(r.shake, 'ON'),
    damageNum: onOff(r.damageNum, 'ON'),
    bubble: pick(r.bubble, ['MANY', 'NORMAL', 'FEW', 'OFF'], 'NORMAL'),
    confirmUse: onOff(r.confirmUse, 'OFF'),
    confirmEnd: onOff(r.confirmEnd, 'OFF'),
    press: pick(r.press, ['SHORT', 'NORMAL', 'LONG'], 'NORMAL'),
    drag: onOff(r.drag, 'ON'),
    gutsPick: onOff(r.gutsPick, 'OFF'),
    handText: pick(r.handText, ['NORMAL', 'LARGE'], 'NORMAL'),
    handSort: pick(r.handSort, ['DRAW', 'KIND'], 'DRAW'),
  };
};
// 相手が考える時間の倍率(1 が足す前の「ふつう」、0.5 が前の「はやい」)
const CARD_THINK_IDS = ['SLOW2', 'SLOW', 'NORMAL', 'FAST', 'FAST2'];
const CARD_THINK_PACE = Object.freeze({ SLOW2: 2, SLOW: 1.5, NORMAL: 1, FAST: 0.5, FAST2: 0.25 });
// 勝ち負けが決まってから結果の画面までの間(ms)。NORMAL・SHORT は足す前の「ふつう」「はやい」と同じ
const CARD_RESULT_WAIT_MS = Object.freeze({ NORMAL: 2200, SHORT: 1200, QUICK: 500 });
// 長押しで詳しい画面が出るまで(ms)。NORMAL は足す前と同じ
const CARD_PRESS_MS = Object.freeze({ SHORT: 300, NORMAL: 450, LONG: 700 });
// 助手のひとこと: 1ターンにしゃべる数(NORMAL は足す前の CARD_LINE_PER_TURN と同じ 2)。OFF は勝ち負けも含めて出さない
const CARD_BUBBLE_PER_TURN = Object.freeze({ MANY: 3, NORMAL: 2, FEW: 1, OFF: 0 });
// オプションに並べる対戦中の設定(モンヒロバトルの BATTLE_FX_SETTING_ITEMS と同じ形: 題・説明・選択肢の名前と一言)。
// bool … 保存は true/false(自動パス)。only … 'cpu' は助手と対戦だけに効く(マルチ対戦では相手が人なので効かない)
const CARD_SETTING_GROUPS = Object.freeze([
  { title: '演出', items: [
    { key: 'motion', title: '技の動き', desc: '技を出したときに、モンスターが相手へ向かって動く演出です。「短め」は攻める側の動きを省き、受けた・よけた・防いだ動きだけ出します。',
      options: [{ id: 'FULL', label: 'ふつう', note: '全部の動き' }, { id: 'SHORT', label: '短め', note: '受ける側だけ' }, { id: 'OFF', label: '出さない', note: 'すぐ次へ' }] },
    { key: 'shake', title: '画面の揺れ', desc: '攻撃を受けたモンスターが揺れる演出です。止めても光や数字は出ます。',
      options: [{ id: 'ON', label: '揺らす', note: 'いつもの見た目' }, { id: 'OFF', label: '揺らさない', note: '酔いやすい人向け' }] },
    { key: 'damageNum', title: 'ダメージの数字', desc: '攻撃を受けたモンスターの上に出る「−3」などの大きな数字です。出さなくても、ライフの数字とバーは減ります。',
      options: [{ id: 'ON', label: '出す', note: '大きな数字' }, { id: 'OFF', label: '出さない', note: 'ライフだけ' }] },
  ] },
  { title: '速さ', items: [
    { key: 'think', title: '相手が考える時間', only: 'cpu', desc: '助手と対戦で、相手の助手が技や守りを決めるまでの間です。マルチ対戦では相手が人なので変わりません。',
      options: [{ id: 'SLOW2', label: 'とても\nゆっくり', note: '×2' }, { id: 'SLOW', label: 'ゆっくり', note: '×1.5' }, { id: 'NORMAL', label: 'ふつう', note: '×1' }, { id: 'FAST', label: 'はやい', note: '×0.5' }, { id: 'FAST2', label: 'とても\nはやい', note: '×0.25' }] },
    { key: 'resultWait', title: '結果までの間', only: 'cpu', desc: '助手と対戦で、勝ち負けが決まってから結果の画面に移るまでの間です。',
      options: [{ id: 'NORMAL', label: 'ふつう', note: '約2秒' }, { id: 'SHORT', label: '短め', note: '約1秒' }, { id: 'QUICK', label: 'すぐ', note: '約0.5秒' }] },
  ] },
  { title: '助手', items: [
    { key: 'bubble', title: '対戦中のひとこと', only: 'cpu', desc: '助手と対戦で、相手の助手がしゃべる吹き出しの多さです。「出さない」は、勝ち負けのときも出しません。',
      options: [{ id: 'MANY', label: '多め', note: '1ターン3回まで' }, { id: 'NORMAL', label: 'ふつう', note: '1ターン2回まで' }, { id: 'FEW', label: '少なめ', note: '1ターン1回まで' }, { id: 'OFF', label: '出さない', note: 'しゃべらない' }] },
  ] },
  { title: '操作', items: [
    { key: 'confirmUse', title: '技を使う前の確認', desc: '技を選んで相手をタップ(か運んで置く)したときに、「使いますか？」と1回確かめます。押しまちがいを防げます。',
      options: [{ id: 'OFF', label: '確かめない', note: 'すぐ使う' }, { id: 'ON', label: '確かめる', note: '「使う」で決める' }] },
    { key: 'confirmEnd', title: 'ターン終了の確認', desc: 'ガッツの番に「ターン終了」を押したときに、1回確かめます。',
      options: [{ id: 'OFF', label: '確かめない', note: 'すぐ終わる' }, { id: 'ON', label: '確かめる', note: '「終わる」で決める' }] },
    { key: 'press', title: '長押しで詳しく出るまで', desc: 'カードを長押ししたときに、大きな絵と文の画面が出るまでの時間です。',
      options: [{ id: 'SHORT', label: '短め', note: '約0.3秒' }, { id: 'NORMAL', label: 'ふつう', note: '約0.45秒' }, { id: 'LONG', label: '長め', note: '約0.7秒' }] },
    { key: 'drag', title: '手札を運ぶ操作', desc: '手札を指で持って、狙うモンスターやガッツの置き場へ運ぶ操作です。使わないときは、タップだけで遊びます。',
      options: [{ id: 'ON', label: '使う', note: '運んでもタップでも' }, { id: 'OFF', label: '使わない', note: 'タップだけ' }] },
  ] },
  { title: '自動', items: [
    { key: 'autoPass', bool: true, title: '守れないときは自動で「守らない」', desc: '攻撃されたときに、使える回避・防御のカードが1枚も無ければ、理由を少し見せてから自動で「守らない」にします。',
      options: [{ id: 'ON', label: 'する', note: '自動で進む' }, { id: 'OFF', label: 'しない', note: '自分で押す' }] },
    { key: 'gutsPick', title: 'ガッツにするカードのおすすめ', desc: 'ガッツの番になったときに、おすすめのカードを先に選んでおきます。選び直してから「ターン終了」を押せます。',
      options: [{ id: 'OFF', label: '選ばない', note: '自分で選ぶ' }, { id: 'ON', label: '選んでおく', note: '直してもOK' }] },
  ] },
  { title: '表示', items: [
    { key: 'handText', title: '手札の下の字', desc: '手札の下に出す名前・ガッツ・ダメージの字の大きさです。狭い画面では、ふつうのままになります。',
      options: [{ id: 'NORMAL', label: 'ふつう', note: 'いつもの大きさ' }, { id: 'LARGE', label: '大きめ', note: '読みやすく' }] },
    { key: 'handSort', title: '手札の並べ方', desc: '手札を並べる順番です。並べ方を変えても、出すカードは変わりません。',
      options: [{ id: 'DRAW', label: '引いた順', note: 'いつもの並び' }, { id: 'KIND', label: '種類順', note: 'ちから→かしこさ→特殊→回避→防御' }] },
  ] },
]);
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
