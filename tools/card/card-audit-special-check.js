// MFバトルカードの総点検 D「特殊技・手札・山札」(2026-10-27 社長「バトルカードのルールやカードの効果、全部ちゃんと確かめて」・カード部の割り当て)。
// きっかけは 277「意味不明」: ダメージの無い特殊技に「当たったら効く」効果が付いていて、出しても何も起きなかった。
// 特殊技の全カードを、「カードの文 → データ(effects)→ 82 の処理」の順に確かめる。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-audit-special-check.js [--verbose]
//
// 見るもの
//   A. 文とデータ(全カード)
//      ・ダメージの無いカードに、ダメージが1以上の時だけ効く効果(当たったら・回避されたら・防御で減らない など)が付いていない
//      ・文があるのに効果が空のカードが無い
//      ・特殊技の効果が、82 の特殊技の処理(cardApplySpecial)か、付ける札の処理のどちらかで扱われている(ready なのに処理が無い、を止める)
//      ・特殊技の文のことば(引く・回復・攻撃できない・2倍 など)に合う効果が付いている
//   B. 1枚ずつ実際に効かせる: 特殊技の全カードを、使える子の場面で出し、文に書いてあることが場に起きる
//      ・付ける札は、付けた技のダメージ・払うガッツ・守りの縛りで見る
//      ・特殊技は守れない(攻撃中にならない)。モンスターの特殊技は1ターン1枚(もう1回攻撃できる札のほか)
//   C. 手札・山札の決まり: 初めの手札5枚・後攻の始める前のガッツ2枚まで・先攻の1ターン目は引かない・5枚まで引く・
//      5枚以上なら山札の上をガッツへ・引けなければ山札切れで負け・ガッツの段
//      ・コンピューターどうしの対戦で、どの場面でもカードが消えない・増えない(手札+山札+ガッツ+捨て札+場=50)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const CORE_SRC = fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${CORE_SRC}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_BATTLE_HAND_MAX, CARD_BATTLE_SETUP_GUTS_MAX, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardOf, cardEff, cardHasEff, cardUsableBy, cardMonType, cardDecider, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardRngNext };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const cards = Object.values(db.cards);
const speCards = cards.filter((c) => c.kind === 'spe');
const text = (c) => String(c.text || '').replace(/\s+/g, '');
const effTs = (c) => (c.effects || []).map((e) => e.t);

// ==== A. 文とデータ ====
// ダメージが1以上の時だけ効く効果(82 の cardResolveTarget の dmg > 0 の所・回避/防御の所・当てた結果を見る所)
const HIT_ONLY = ['stunOnHit', 'gutsLossOnHit', 'drain', 'returnOnHit', 'selfDamageIfHit', 'selfDamageIfEvaded', 'halfOnEvade', 'noEvade', 'noBlockReduce', 'multVs', 'nonLethal'];
// 書いてあるダメージが0でも、ほかからダメージが付く技(カード投げ・魔神ファイナルなど)
const DMG_SOURCE = ['tossBonus', 'bonusDiscard', 'bonusLost', 'pair', 'split', 'combo'];
cards.forEach((c) => {
  const ts = effTs(c);
  if (!((c.damage || 0) > 0) && !ts.some((t) => DMG_SOURCE.includes(t))) {
    const bad = ts.filter((t) => HIT_ONLY.includes(t));
    check(`A ${c.no}「${c.name}」: ダメージの無いカードに当たったら効く効果が無い`, !bad.length, bad.join('・'));
  }
  if (text(c)) check(`A ${c.no}「${c.name}」: 文があるのに効果が空でない`, ts.length > 0);
});

// 82 の特殊技の処理で扱う名前(cardApplySpecial の e.t === '…')と、付ける札の名前(cardAttachMods・cardAttachOk・攻撃の候補が見るもの)
const fnBody = (name) => { const i = CORE_SRC.indexOf(`const ${name} = `); const j = CORE_SRC.indexOf('\n};\n', i); return i < 0 ? '' : CORE_SRC.slice(i, j); };
const SPECIAL_HANDLED = new Set([...fnBody('cardApplySpecial').matchAll(/e\.t === '(\w+)'/g)].map((m) => m[1]));
const ATTACH_SRC = fnBody('cardAttachMods') + fnBody('cardAttachOk') + fnBody('cardActionCost') + fnBody('cardAttackOptions') + fnBody('cardGuardOptions') + fnBody('cardStartAttack') + fnBody('cardFinishAttack') + fnBody('cardResolveTarget') + fnBody('cardApplyAction');
check('A 82 の特殊技の処理から名前が読める', SPECIAL_HANDLED.size >= 40, `${SPECIAL_HANDLED.size}種`);
// 出せる条件だけの名前(cardSpeTargets が見る)
const CONDITION = ['useWhenAllies'];
speCards.filter((c) => c.ready).forEach((c) => {
  const isAttach = effTs(c).includes('attach');
  effTs(c).forEach((t) => {
    if (t === 'attach' || CONDITION.includes(t)) return;
    const handled = isAttach ? ATTACH_SRC.includes(`'${t}'`) || ATTACH_SRC.includes(`.${t}`) : SPECIAL_HANDLED.has(t);
    check(`A ${c.no}「${c.name}」: 効果 ${t} に 82 の処理がある`, handled, isAttach ? '付ける札の処理に名前が無い' : '特殊技の処理(cardApplySpecial)に名前が無い');
  });
});

// 文のことば → そのとき付いているはずの効果(どれか1つ)
const WORDS = [
  [/引く|ドロー/, ['draw', 'oppDraw', 'refresh', 'choose']],
  [/回復/, ['heal', 'emerge']],
  [/攻撃できない/, ['stunTarget', 'stunAllEnemies', 'revive', 'possess', 'fuse', 'unstunTarget']],
  [/攻撃できる/, ['extraAttack', 'extraAttackTarget', 'unstunTarget']],
  [/2倍|3倍/, ['attachMult', 'charge', 'rage']],
  [/\+2/, ['attachAdd']],
  [/回避されない/, ['attachNoEvade', 'attachNoEvadeHybrid']],
  [/捨て札の中から/, ['choose']],
  [/手札を1枚捨てさせる/, ['discardOpp']],
  [/ガッツを0/, ['gutsZeroBoth']],
  [/好きなだけ技カード/, ['unlimitedAttacks']],
  [/好きなだけ「ブリーダーカード」/, ['breederUnlimited']],
  [/ダメージを受けない/, ['safe']],
  [/空中または地上/, ['form']],
  [/持ちょうを空中にする/, ['liftTarget']],
  [/ターンを1回飛ばす/, ['skipTurn']],
  [/回避技を使用できない|防御技を使用できない/, ['forbidThisTurn']],
  [/山札を3枚、捨て札/, ['millOpp']],
  [/お互いの手札を全部捨てる/, ['discardBothHands']],
  [/ガッツを減らされる効果を無効/, ['gutsGuard']],
  [/復活/, ['revive', 'possess']],
  [/KOする/, ['lastWish', 'fuse']],
];
speCards.forEach((c) => {
  const t = text(c);
  WORDS.forEach(([re, want]) => { if (re.test(t)) check(`A ${c.no}「${c.name}」: 文「${String(re).slice(1, -1)}」に合う効果`, want.some((w) => effTs(c).includes(w)), `effects: ${effTs(c).join('・')}`); });
});

// ==== B. 1枚ずつ実際に効かせる ====
const monOf = {};
Object.values(db.monsters).filter((m) => m.ready !== false).sort((a, b) => (a.no < b.no ? -1 : 1)).forEach((m) => { if (!m.main && !monOf[m.species]) monOf[m.species] = m.no; });
const GOLEM = 'C-003';
const plainOf = (sp, kind = 'pow') => cards.filter((c) => c.ready && c.user === sp && c.kind === kind && !(c.effects || []).length && (c.damage || 0) > 0 && c.guts > 0)
  .sort((a, b) => a.guts - b.guts || (a.no < b.no ? -1 : 1))[0];
const scene = ({ mons, hands, guts = [10, 10] }) => {
  const decks = mons.map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 11, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(guts[i]).fill('100'); pl.mons.forEach((m) => { m.life = 20; m.max = 20; }); });
  st.active = 0; st.phase = 'main';
  return st;
};
const act = (st, a) => { const n = E.cardApplyAction(db, st, a); if (!n) throw new Error(`だめな操作: ${JSON.stringify(a)}`); return n; };
const usesCard = (st, o, no) => o.hand.some((i) => st.players[st.active].hand[i] === no);
const clone = (s) => JSON.parse(JSON.stringify(s));

// その特殊技を出す子(種族の札はその種族の子・誰でもの札はゴーレム・ブリーダーの札もゴーレムを並べる)
const userMon = (c) => (c.user === 'any' || c.user === 'breeder' ? GOLEM : monOf[c.user]);
// 出す前の場の用意(その札の「使える時」を満たす)
const PREP = {
  useWhenAllies: (st) => { st.players[0].mons[1].ko = true; st.players[0].mons[2].ko = true; },
  heal: (st) => { st.players[0].mons[0].life = 10; },
  extraAttackTarget: (st) => { st.players[0].mons[0].attacks = 1; },
  unstunTarget: (st) => { st.players[0].mons[1].stunTurn = st.turn; },
  possess: (st) => { st.players[0].mons[1].ko = true; st.players[0].mons[1].life = 0; },
  emerge: (st) => { st.players[0].mons[0].cocoon = true; },
  choose: (st, c) => { st.players[0].discard = ['100', '108', plainOf('golem').no, ...(c.user !== 'breeder' && c.user !== 'any' ? cards.filter((x) => x.ready && x.user === c.user && x.kind !== 'spe').map((x) => x.no) : [])]; st.players[0].hand.push('100', '100'); },
  peekPick: (st) => { st.players[1].hand = ['100', '108', '026']; },
  discardOpp: (st) => { st.players[1].hand = ['100', '108']; },
  oppHandToDeckBottom: (st) => { st.players[1].hand = ['108', '026']; },
  lastWish: (st) => { st.players[0].mons[0].life = 3; st.players[0].discard = ['100', '100', '100', '100', '100']; },
  selfHurt: () => {},
};
const reviveMon = Object.values(db.monsters).find((m) => m.species === 'phoenix' && !m.main);
// 合体: メインとサブが合う純血の2体
const fusePair = (() => { const h = Object.values(db.monsters).filter((m) => m.main && m.sub && m.ready !== false && monOf[m.main] && monOf[m.sub]).sort((a, b) => (a.no < b.no ? -1 : 1))[0]; return h ? [monOf[h.main], monOf[h.sub], h.no] : null; })();

// 札ごとに場を作って出す。返す: { st0(出す前), st(出したあと), o(出した手) }
const playSpe = (c, { extraPrep = null, pick = null } = {}) => {
  let mons0 = [userMon(c), 'C-001', 'C-005'];
  if (effTs(c).includes('revive')) mons0 = [GOLEM, reviveMon.no, 'C-005'];
  if (effTs(c).includes('fuse') && fusePair) mons0 = [fusePair[0], fusePair[1], GOLEM];
  if (mons0[1] === mons0[0]) mons0[1] = 'C-009';
  const st = scene({ mons: [mons0, ['C-001', GOLEM, 'C-005']], hands: [[c.no], ['100', '100']] });
  st.players[1].deck = Array(20).fill('100');
  effTs(c).forEach((t) => { if (PREP[t]) PREP[t](st, c); });
  if (effTs(c).includes('revive')) { st.players[0].mons[1].ko = true; st.players[0].mons[1].life = 0; }
  if (extraPrep) extraPrep(st);
  const opts = E.cardAttackOptions(db, st).filter((o) => usesCard(st, o, c.no));
  const o = pick ? opts.find(pick) : opts[0];
  if (!o) return { st0: st, st: null, o: null, opts };
  return { st0: st, st: act(st, o), o, opts };
};

// 効果ごとに、出したあとに起きているはずのこと
const P = 0, Q = 1;
const EXPECT = {
  draw: (e, a, b) => a.players[P].deck.length - b.players[P].deck.length >= e.n || `山札が${e.n}枚減らない`,
  peekHand: (e, a, b) => b.events.some((v) => v.t === 'peek' && v.p === P) || '相手の手札を見る知らせが無い',
  discardOpp: (e, a, b) => (b.pendingDiscard && b.pendingDiscard.p === Q && b.pendingDiscard.n === e.n) || '相手が捨てる段にならない',
  heal: (e, a, b, o) => b.players[P].mons[o.target.m].life - a.players[P].mons[o.target.m].life === e.n || `ライフが${e.n}回復しない`,
  gutsGuard: (e, a, b) => b.players[P].gutsGuardUntil === b.turn + 1 || '次のターンまでの印が付かない',
  charge: (e, a, b) => (b.players[P].mons[0].charge && b.players[P].mons[0].charge.n === e.n) || '次の技n倍の印が付かない',
  extraAttack: (e, a, b) => (b.players[P].mons[0].bonus && b.players[P].mons[0].bonus.n === e.n) || 'もう1回の印が付かない',
  extraAttackTarget: (e, a, b, o) => (b.players[P].mons[o.target.m].bonus && b.players[P].mons[o.target.m].bonus.n === e.n) || 'もう1回の印が付かない',
  unstunTarget: (e, a, b, o) => b.players[P].mons[o.target.m].stunTurn !== b.turn || '攻撃できないままになっている',
  liftTarget: (e, a, b, o) => E.cardMonType(b.players[Q].mons[o.target.m], b.turn) === 'air' || '相手が空中にならない',
  unlimitedAttacks: (e, a, b) => b.players[P].mons[0].unlimited === b.turn || '何枚でもの印が付かない',
  breederUnlimited: (e, a, b) => (b.breederFree && b.breederFree.p === P) || 'ブリーダーのカード何枚でもの印が付かない',
  taunt: (e, a, b) => (b.taunts || []).some((t) => t.by === P && t.m === 0 && t.mode === e.mode && t.turn === b.turn + 1) || '相手の次の番の縛りが付かない',
  stunAllEnemies: (e, a, b) => b.players[Q].mons.every((m) => m.ko || m.stunTurn === b.turn + 1) || '相手の全員が次のターン攻撃できない形にならない',
  stunTarget: (e, a, b, o) => (o.target && o.target.p === Q && b.players[Q].mons[o.target.m].stunTurn === b.turn + 1) || '選んだ相手が次のターン攻撃できない形にならない',
  skipTurn: (e, a, b) => b.skip === Q || '相手の番を飛ばす印が付かない',
  rage: (e, a, b) => (b.players[P].mons[0].noGuardUntil === b.turn + 1 && b.players[P].mons[0].mult && b.players[P].mons[0].mult.n === 2) || '守れない・次の番2倍の印が付かない',
  revive: (e, a, b, o) => (!b.players[P].mons[o.target.m].ko && b.players[P].mons[o.target.m].life === e.life && b.players[P].mons[o.target.m].stunTurn === b.turn) || `ライフ${e.life}で戻らない(または攻撃できてしまう)`,
  possess: (e, a, b, o) => (b.players[P].mons[0].ko && !b.players[P].mons[o.target.m].ko && b.players[P].mons[o.target.m].life === Math.min(a.players[P].mons[0].life, b.players[P].mons[o.target.m].max)) || 'のりうつりの形にならない',
  cocoon: (e, a, b) => b.players[P].mons[0].cocoon === true || 'まゆにならない',
  emerge: (e, a, b) => (b.players[P].mons[0].no === e.to && b.players[P].mons[0].life === b.players[P].mons[0].max) || `${e.to} に取りかわらない`,
  fuse: (e, a, b, o) => (o.fuse && b.players[P].mons[o.fuse.a].no === o.fuse.no && b.players[P].mons[o.fuse.b].ko) || '合体の形にならない',
  safe: (e, a, b) => b.players[P].mons[0].safeUntil === b.turn + 1 || '次の番までダメージ0の印が付かない',
  form: (e, a, b, o) => b.players[P].mons[0].type === o.form || '選んだ持ちょうにならない',
  choose: (e, a, b) => (b.pendingChoice && b.pendingChoice.p === P && b.pendingChoice.then === e.then) || '選ぶ段にならない',
  peekPick: (e, a, b) => (b.pendingReveal && b.pendingReveal.p === Q) || '相手が見せる段にならない',
  rush: (e, a, b) => (b.players[P].guts.length - a.players[P].guts.length === e.n - (db.cards['114'].guts || 0) + 0 || b.players[P].guts.length >= e.n) || `ガッツが${e.n}枚増えない`,
  lastWish: (e, a, b) => (b.players[P].mons[0].ko && b.players[P].guts.length === a.players[P].guts.length + 3) || 'KOして残りライフ3枚がガッツにならない',
  gutsZeroBoth: (e, a, b) => (b.players[P].guts.length === 0 && b.players[Q].guts.length === 0) || 'お互いのガッツが0にならない',
  deckToGuts: (e, a, b) => (b.players[P].deck.length === 0 && b.players[P].guts.length >= a.players[P].deck.length) || '山札が全部ガッツにならない',
  oppHandToDeckBottom: (e, a, b) => JSON.stringify(b.players[Q].deck.slice(0, 2)) === JSON.stringify(a.players[Q].hand) || '相手の手札が山札の一番下に行かない',
  oppDraw: (e, a, b) => b.players[Q].hand.length === e.n || `相手が${e.n}枚引かない`,
  gutsToDeckShuffle: (e, a, b) => (b.players[P].guts.length === 0 && b.players[P].deck.length === a.players[P].deck.length + a.players[P].guts.length) || 'ガッツが山札に戻らない',
  selfHurt: (e, a, b, o) => a.players[P].mons[o.target.m].life - b.players[P].mons[o.target.m].life === e.n || `味方のライフが${e.n}減らない`,
  oppGutsLoss: (e, a, b) => a.players[Q].guts.length - b.players[Q].guts.length === e.n || `相手のガッツが${e.n}減らない`,
  refresh: (e, a, b) => b.players[P].hand.length === a.players[P].hand.length - 1 || '捨てた枚数だけ引かない',
  millOpp: (e, a, b) => (a.players[Q].deck.length - b.players[Q].deck.length === e.n && b.players[Q].discard.length - a.players[Q].discard.length === e.n) || `相手の山札が${e.n}枚捨て札にならない`,
  discardBothHands: (e, a, b) => (b.players[P].hand.length === 0 && b.players[Q].hand.length === 0) || 'お互いの手札が0にならない',
  freeSpeThisTurn: (e, a, b) => (b.freeSpe && b.freeSpe.p === P) || '特殊技0ガッツの印が付かない',
  forbidThisTurn: (e, a, b) => e.kinds.every((k) => (b.forbid[Q] || []).includes(k)) || '相手の守りの禁止が付かない',
};

const nonAttach = speCards.filter((c) => c.ready && !effTs(c).includes('attach'));
nonAttach.forEach((c) => {
  const r = playSpe(c);
  check(`B ${c.no}「${c.name}」: 場面で出せる`, !!r.st, `候補 ${r.opts.length}`);
  if (!r.st) return;
  check(`B ${c.no}「${c.name}」: 特殊技は守れない(攻撃中にならない)`, !r.st.pending);
  check(`B ${c.no}「${c.name}」: 出した札は捨て札へ`, r.st.players[P].discard.includes(c.no) || r.st.players[P].mons.some((m) => m.ko), '捨て札に無い');
  check(`B ${c.no}「${c.name}」: 払うガッツが文の数`, r.st0.players[P].guts.length - r.st.players[P].guts.length === c.guts || effTs(c).some((t) => ['rush', 'gutsZeroBoth', 'deckToGuts', 'gutsToDeckShuffle', 'lastWish'].includes(t)),
    `${r.st0.players[P].guts.length - r.st.players[P].guts.length}`);
  (c.effects || []).forEach((e) => {
    if (CONDITION.includes(e.t)) return;
    const f = EXPECT[e.t];
    check(`B ${c.no}「${c.name}」: 効果 ${e.t} の確かめ方がある`, !!f);
    if (!f) return;
    const res = f(e, r.st0, r.st, r.o);
    check(`B ${c.no}「${c.name}」: ${e.t} が文のとおり効く`, res === true, typeof res === 'string' ? res : '');
  });
  // 使える時(useWhenAllies)は、満たさないと出せない
  const ua = (c.effects || []).find((e) => e.t === 'useWhenAllies');
  if (ua) {
    const st = scene({ mons: [[userMon(c), 'C-001', 'C-005'], ['C-001', GOLEM, 'C-005']], hands: [[c.no], []] });
    check(`B ${c.no}「${c.name}」: 味方が${ua.n}体でないときは出せない`, !E.cardAttackOptions(db, st).some((o) => usesCard(st, o, c.no)));
  }
  // モンスターの特殊技は1ターン1枚(もう1回攻撃できる札・何枚でもの札・その子が倒れる札のほか)
  if (c.user !== 'breeder' && !effTs(c).some((t) => ['extraAttack', 'unlimitedAttacks', 'lastWish', 'possess', 'emerge', 'cocoon', 'form'].includes(t))) {
    const pw = plainOf('golem');
    const s2 = clone(r.st); s2.pendingChoice = null; s2.pendingReveal = null; s2.pendingDiscard = null; s2.players[P].hand = [pw.no]; s2.players[P].guts = Array(9).fill('100');
    if (!s2.players[P].mons[0].ko && s2.players[P].mons[0].species === 'golem') check(`B ${c.no}「${c.name}」: その子は同じターンにもう技を出せない`, !E.cardAttackOptions(db, s2).some((o) => o.mon === 0));
  }
});

// 選ぶ段・見せる段・捨てる段の続き(選んだ札が文の行き先へ行く)
{
  const go = (no, pickFn, then) => {
    const r = playSpe(db.cards[no]); if (!r.st || !r.st.pendingChoice) return check(`B ${no}: 選ぶ段の続きを確かめられる`, false);
    const ch = r.st.pendingChoice; const pick = ch.cands[0];
    const me0 = r.st.players[P]; const card = ch.src === 'hand' ? me0.hand[pick] : me0.discard[pick];
    const s2 = act(r.st, { type: 'choose', pick });
    const res = then(s2, card, r.st);
    check(`B ${no}「${db.cards[no].name}」: 選んだ札が文の行き先へ`, res === true, typeof res === 'string' ? res : '');
    if (pickFn) pickFn(ch, r.st);
  };
  go('022', null, (s, card, a) => (s.players[P].hand.includes(card) && s.players[P].discard.length === a.players[P].discard.length - 1) || '捨て札から手札へ来ない');
  go('137', null, (s, card) => s.players[P].deck[0] === card || '山札の一番下へ行かない');
  go('186', (ch, a) => check('B 186「回避プログラム」: 候補は、この子が使える回避カードだけ', ch.cands.every((i) => { const x = db.cards[a.players[P].discard[i]]; return x && x.kind === 'dge' && E.cardUsableBy(x, a.players[P].mons[0]); })), (s, card) => s.players[P].hand.includes(card) || '手札へ来ない');
  go('303', (ch, a) => check('B 303「悪夢」: 候補は、この子が使える攻撃用カードだけ', ch.cands.every((i) => { const x = db.cards[a.players[P].discard[i]]; return x && ['pow', 'int', 'spe'].includes(x.kind) && E.cardUsableBy(x, a.players[P].mons[0]); })), (s, card) => s.players[P].hand.includes(card) || '手札へ来ない');
  go('122', null, (s, card, a) => (s.players[P].hand.length === a.players[P].hand.length && s.players[P].deck.length === a.players[P].deck.length) || '1枚戻して1枚引く形にならない');
  go('094', null, (s, card, a) => (s.players[P].hand.length === a.players[P].hand.length + 1 && s.players[P].discard.includes(card)) || '1枚捨てて2枚引く形にならない');
  // 死神の力: 相手が見せる → こちらが選ぶ → 相手の手札から捨て札へ
  const r = playSpe(db.cards['304']);
  if (r.st) {
    let s = act(r.st, { type: 'reveal' });
    check('B 304「死神の力」: 見せたあと、使った人が選ぶ', s.pendingChoice && s.pendingChoice.p === P && s.pendingChoice.cands.length === 3);
    const no = s.players[Q].hand[1]; s = act(s, { type: 'choose', pick: 1 });
    check('B 304「死神の力」: 選んだ札を相手が捨てる', s.players[Q].hand.length === 2 && s.players[Q].discard.includes(no));
  }
  // 大声: 捨てる側(相手)が選ぶ
  const r2 = playSpe(db.cards['095']);
  if (r2.st) { const s = act(r2.st, { type: 'discard', hand: [1] }); check('B 095「大声」: 相手が選んだ1枚を捨てる', s.players[Q].hand.length === 1 && s.players[Q].hand[0] === '100' && s.players[Q].discard.includes('108')); }
  // 偵察: 見るだけ。相手の手札は変わらない
  const r3 = playSpe(db.cards['045']);
  if (r3.st) check('B 045「偵察」: 相手の手札はそのまま', JSON.stringify(r3.st.players[Q].hand) === JSON.stringify(r3.st0.players[Q].hand));
  // 精神集中: 次のターンまで、相手の泣き真似(ガッツ-1)が効かない
  const r4 = playSpe(db.cards['245']);
  if (r4.st) {
    const s = clone(r4.st); s.active = Q; s.turn += 1; s.players[Q].hand = ['278']; s.players[Q].guts = Array(3).fill('100'); s.players[Q].breederUsed = false; s.players[P].guts = Array(4).fill('100');
    const o = E.cardAttackOptions(db, s).find((x) => x.type === 'breeder');
    if (o) { const s2 = act(s, o); check('B 245「精神集中」: 相手の番のガッツ減らしが効かない', s2.players[P].guts.length === 4, `残り ${s2.players[P].guts.length}`); } else check('B 245: 泣き真似の場面が作れない', false);
  }
  // にらむ・恐怖: このターン、相手は回避(防御)を出せない
  const anyGuard = (kind) => cards.find((c) => c.ready && c.kind === kind && c.user === 'any' && (c.effects || []).some((e) => ['evade', 'reduce'].includes(e.t) && (!e.kinds || e.kinds.includes('pow')) && !e.minGuts));
  [['082', 'dge'], ['305', 'blk']].forEach(([no, kind]) => {
    const g = anyGuard(kind); if (!g) return check(`B ${no}: 誰でも使える${kind}の見本がある`, false);
    const r5 = playSpe(db.cards[no]); if (!r5.st) return;
    const pw = plainOf('tiger');
    const setUp = (s0) => { const s = clone(s0); s.players[P].hand = [pw.no]; s.players[P].guts = Array(9).fill('100'); s.players[Q].hand = [g.no]; s.players[Q].guts = Array(9).fill('100'); return s; };
    const guardKinds = (s) => { const o = E.cardAttackOptions(db, s).find((x) => x.mon === 1 && x.target && x.target.p === Q); if (!o) return null; const s2 = act(s, o); return E.cardGuardOptions(db, s2).map((x) => db.cards[s2.players[Q].hand[x.hand]].kind); };
    const before = guardKinds(setUp(r5.st0)); const after = guardKinds(setUp(r5.st));
    if (!before || !after) return check(`B ${no}: 攻撃の場面が作れない`, false);
    check(`B ${no}「${db.cards[no].name}」: 見本: 使う前は「${g.name}」を出せる`, before.includes(kind));
    check(`B ${no}「${db.cards[no].name}」: このターン、相手は${kind === 'dge' ? '回避' : '防御'}を出せない`, !after.includes(kind));
  });
}

// 意味不明(277): 選んだ相手1体が次のターン攻撃できなくなる(2026-10-27 社長。前は当たったら効く形で、何も起きなかった)
{
  const r = playSpe(db.cards['277'], { pick: (o) => o.target && o.target.p === Q && o.target.m === 2 });
  check('B 277「意味不明」: 相手1体を選んで出せる', !!r.st);
  if (r.st) {
    check('B 277「意味不明」: 選んだ子は次のターン攻撃できない', r.st.players[Q].mons[2].stunTurn === r.st.turn + 1);
    check('B 277「意味不明」: ほかの子には効かない', r.st.players[Q].mons[0].stunTurn !== r.st.turn + 1 && r.st.players[Q].mons[1].stunTurn !== r.st.turn + 1);
    const s = clone(r.st); s.active = Q; s.turn += 1; s.phase = 'main'; s.players[Q].hand = [plainOf('golem').no, plainOf('golem').no]; s.players[Q].guts = Array(9).fill('100');
    s.players[Q].mons = [{ ...s.players[Q].mons[0], no: GOLEM, species: 'golem' }, s.players[Q].mons[1], { ...s.players[Q].mons[2], no: GOLEM, species: 'golem' }];
    const o = E.cardAttackOptions(db, s);
    check('B 277「意味不明」: 次の相手の番、その子は技を出せず、ほかの子は出せる', !o.some((x) => x.mon === 2) && o.some((x) => x.mon === 0 || x.mon === 1));
  }
}

// 引く札: 山札が足りないときは、引けた枚数だけ引き、記録にもその枚数を書く
{
  const r = playSpe(db.cards['045'], { extraPrep: (st) => { st.players[P].deck = []; } });
  if (r.st) check('B 045「偵察」: 山札が0なら0枚引いたと書く', r.st.log.some((l) => /0枚引いた/.test(l.text || l)) && r.st.players[P].hand.length === 0, JSON.stringify(r.st.log.slice(-2)));
}

// 力をためる・根を張る・静の構え: 「ダメージを受けると終了」は、灼熱の地(全体カード)のダメージでも終わる
{
  const r = playSpe(db.cards['034']);
  if (r.st) {
    const s = clone(r.st); s.field = { no: 'F260', p: Q, effects: db.cards.F260.effects.map((e) => ({ ...e })) };
    const s2 = act(s, { type: 'endAttacks' });
    check('B 034「力をためる」: 灼熱の地のダメージで、次の技2倍の印が消える', s2.players[P].mons[0].charge === null, JSON.stringify(s2.players[P].mons[0].charge));
  }
}

// 挑発・レロレロ: 相手は次の番、この子に当たらない技は出せない。全員に当たる技でも、この子に当たらないもの(空中だけ・地上だけ)は出せない
{
  const airOnly = cards.find((c) => c.ready && (c.effects || []).some((e) => e.t === 'area' && e.who === 'enemies' && e.only === 'air') && monOf[c.user]);
  const areaAll = cards.find((c) => c.ready && c.effects.length === 1 && c.effects[0].t === 'area' && c.effects[0].who === 'enemies' && !c.effects[0].only && monOf[c.user] && c.kind === 'pow');
  [['046', 'suezo'], ['365', 'mocchi']].forEach(([no, sp]) => {
    const st = scene({ mons: [[monOf[sp], 'C-005', 'C-001'], [monOf[airOnly.user], monOf[areaAll.user] === monOf[airOnly.user] ? GOLEM : monOf[areaAll.user], 'C-005']], hands: [[no], [airOnly.no, areaAll.no]] });
    const o = E.cardAttackOptions(db, st).find((x) => usesCard(st, x, no));
    if (!o) return check(`B ${no}: 出せない`, false);
    const s = clone(act(st, o)); s.active = Q; s.turn += 1; s.players[Q].mons.forEach((m) => { m.attacks = 0; });
    const air = s.players[P].mons.some((m, j) => E.cardMonType(m, s.turn) === 'air' && j !== 0);
    const taunterGround = E.cardMonType(s.players[P].mons[0], s.turn) !== 'air';
    if (air && taunterGround) check(`B ${no}「${db.cards[no].name}」: この子に当たらない全員攻撃(${airOnly.name})は出せない`, !E.cardAttackOptions(db, s).some((x) => usesCard(s, x, airOnly.no)));
    check(`B ${no}「${db.cards[no].name}」: この子にも当たる全員攻撃(${areaAll.name})は出せる`, E.cardAttackOptions(db, s).some((x) => usesCard(s, x, areaAll.no)));
  });
}

// 付ける札: 付けた技のダメージ・払うガッツ・守りの縛り
const attachCards = speCards.filter((c) => c.ready && effTs(c).includes('attach'));
const ATTACH_SCENE = {
  // 札 → { mon(付ける子), main(付ける技), prep }
  '110': { prep: (st) => { st.players[P].mons[0].life = 2; } },
  '124': { prep: (st) => { st.players[P].deck = []; } },
  '345': { prep: (st) => { st.players[P].mons[0].life = 2; } },
};
attachCards.forEach((c) => {
  const w = (cardWhen) => (c.effects.find((e) => e.t === 'attach') || {}).when || {};
  const when = w();
  let mon = userMon(c); let main = null;
  if (when.breederMaxGuts !== undefined) main = cards.find((x) => x.ready && x.user === 'breeder' && ['pow', 'int'].includes(x.kind) && x.guts <= when.breederMaxGuts);
  else if (when.area) { main = cards.find((x) => x.ready && x.user === 'golem' && (x.effects || []).some((e) => e.t === 'area' && !e.only)); mon = GOLEM; }
  else if (when.subSpe) {
    const h = Object.values(db.monsters).find((m) => m.main && m.sub && m.sub !== 'unknown' && m.ready !== false && cards.some((x) => x.ready && x.kind === 'spe' && x.user === m.sub && effTs(x).includes('draw')));
    if (h) { mon = h.no; main = cards.find((x) => x.ready && x.kind === 'spe' && x.user === h.sub && effTs(x).includes('draw')); }
  } else if (when.mimic) { main = plainOf('golem'); }
  else { const sp = db.monsters[mon].species; const kinds = when.kinds || ['pow', 'int']; main = kinds.map((k) => plainOf(sp, k)).find(Boolean); }
  if (!main) return check(`B ${c.no}「${c.name}」: 付ける技の見本がある`, false);
  const st = scene({ mons: [[mon, 'C-005', 'C-001'], ['C-001', GOLEM, 'C-005']], hands: [[main.no, c.no], ['100']] });
  if (ATTACH_SCENE[c.no] && ATTACH_SCENE[c.no].prep) ATTACH_SCENE[c.no].prep(st);
  const opts = E.cardAttackOptions(db, st);
  const withC = opts.filter((o) => o.hand.length === 2 && usesCard(st, o, c.no));
  check(`B ${c.no}「${c.name}」: 「${main.name}」に付けて出せる`, withC.length > 0);
  check(`B ${c.no}「${c.name}」: 単独では出せない`, !opts.some((o) => o.hand.length === 1 && usesCard(st, o, c.no)));
  if (!withC.length) return;
  const o = withC.find((x) => x.target && x.target.p === Q) || withC[0];
  const a = c.effects.some((e) => e.t === 'attachBind') ? { ...o, bind: 'フットワーク' } : o;
  const g0 = st.players[P].guts.length;
  let s = act(st, a);
  const paid = g0 - s.players[P].guts.length;
  const cost = (() => { let m = main.guts; const half = effTs(c).includes('attachCostHalf'); const ac = c.effects.find((e) => e.t === 'attachCost'); if (half) m = Math.ceil(m / 2); if (ac) m -= ac.n; if (effTs(c).includes('attachFree')) m = 0; return Math.max(0, m) + c.guts; })();
  check(`B ${c.no}「${c.name}」: 払うガッツ(技${main.guts}+この札${c.guts}の文どおり)`, paid === cost, `${paid}(はず ${cost})`);
  if (main.kind === 'spe') { check(`B ${c.no}「${c.name}」: 付けた特殊技が効く`, s.players[P].deck.length < st.players[P].deck.length); return; }
  if (!s.pending) return check(`B ${c.no}「${c.name}」: 攻撃中になる`, false);
  const flags = s.pending.flags || {};
  ['attachNoEvade', 'attachNoGuard', 'attachNoBlockReduce', 'attachNoZeroGuard', 'attachNoGuardIfGuarded', 'attachNoEvadeHybrid'].forEach((t) => { if (effTs(c).includes(t)) check(`B ${c.no}「${c.name}」: ${t} の縛りが攻撃に付く`, !!flags[t]); });
  if (effTs(c).includes('attachBind')) check(`B ${c.no}「${c.name}」: 名指しが攻撃に付く`, flags.bind === 'フットワーク');
  const t = s.pending.targets[0];
  const life0 = s.players[t.p].mons[t.m].life; const self0 = s.players[P].mons[0].life;
  while (s.pending) s = act(s, { type: 'pass' });
  const dmg = life0 - s.players[t.p].mons[t.m].life;
  let want = main.damage; const add = c.effects.find((e) => e.t === 'attachAdd'); const mult = c.effects.find((e) => e.t === 'attachMult');
  if (add) want += add.n; if (mult) want *= mult.n;
  check(`B ${c.no}「${c.name}」: ダメージが文のとおり`, dmg === want, `${dmg}(はず ${want})`);
  const si = c.effects.find((e) => e.t === 'attachSelfIfHit');
  if (si && main.user !== 'breeder') check(`B ${c.no}「${c.name}」: 回避されなかったら自分も${si.n}ダメージ`, self0 - s.players[P].mons[0].life === si.n);
});

// ==== C. 手札・山札の決まり ====
{
  const deck = (n = 50) => Array.from({ length: n }, (_, i) => (i % 3 ? '100' : '026'));
  let st = E.cardCreateGame(db, { decks: [{ monsters: [GOLEM, 'C-005', 'C-001'], cards: deck() }, { monsters: [GOLEM, 'C-005', 'C-001'], cards: deck() }], seed: 21, first: 0 });
  check('C 初めの手札は両方5枚・山札45枚', st.players.every((pl) => pl.hand.length === E.CARD_BATTLE_HAND_MAX && pl.deck.length === 45));
  check('C 始める前にガッツにできるのは後攻', st.phase === 'setup' && st.active === 1);
  const s3 = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [0, 1, 2] });
  check(`C 後攻の始める前のガッツは${E.CARD_BATTLE_SETUP_GUTS_MAX}枚まで`, s3.players[1].guts.length === E.CARD_BATTLE_SETUP_GUTS_MAX && s3.players[1].hand.length === 3);
  check('C 先攻の1ターン目は引かない', s3.active === 0 && s3.turn === 1 && s3.players[0].hand.length === 5 && s3.players[0].deck.length === 45);
  let s = act(s3, { type: 'endAttacks' });
  s = act(s, { type: 'guts', hand: [0, 1] });
  check('C ガッツの段: 選んだ枚数がガッツへ', s.players[0].guts.length === 2 && s.players[0].hand.length === 3);
  check('C 後攻の番: 手札が5枚になるまで引く', s.active === 1 && s.players[1].hand.length === 5 && s.players[1].deck.length === 43);
  s = act(act(s, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  check('C 先攻の2ターン目: 3枚から5枚まで引く', s.players[0].hand.length === 5 && s.players[0].deck.length === 43);
  s = act(act(s, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  check('C 手札が5枚のときは、山札の上を1枚ガッツへ', s.players[1].hand.length === 5 && s.players[1].guts.length === 3 && s.players[1].deck.length === 42);
  // 手札が5枚より多いとき(引く効果で増えた)も、引かずに山札の上を1枚ガッツへ
  let s6 = clone(s); s6.players[0].hand.push('100', '100'); s6 = act(act(s6, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  check('C 手札が5枚より多いときも、山札の上を1枚ガッツへ', s6.players[0].hand.length === 7 && s6.players[0].guts.length === 3);
  // 引けなければ山札切れで負け(足りない枚数があるとき・5枚で山札が0のとき)
  let s4 = clone(s); s4.players[0].hand = ['100', '100']; s4.players[0].deck = ['100', '100'];
  s4 = act(act(s4, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  check('C 5枚まで引けなければ山札切れで負け', s4.winner === 1 && s4.reason === '山札切れ');
  let s5 = clone(s); s5.players[0].deck = [];
  s5 = act(act(s5, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  check('C 手札5枚で山札が0なら山札切れで負け', s5.winner === 1 && s5.reason === '山札切れ');
}

// コンピューターどうしの対戦で、カードが消えない・増えない(どの場面でも、手札+山札+ガッツ+捨て札+場+使っている途中=50)
{
  const owned = (st, i) => {
    const pl = st.players[i];
    let n = pl.hand.length + pl.deck.length + pl.guts.length + pl.discard.length;
    if (st.field && st.field.p === i) n += 1;
    if (st.pending && st.pending.attacker === i) n += st.pending.used.length;
    if (st.pendingPray && st.pendingPray.by === i) n += 1;
    return n;
  };
  const kits = Object.keys(db.starters);
  const levels = ['easy', 'normal', 'master'];
  const habits = ['mua', 'kiki', 'momosuke', 'kyuko', 'dra', 'atsu'];
  let games = 0, bad = null, speUsed = 0, steps = 0;
  const seen = new Set();
  for (let g = 0; g < 60 && !bad; g++) {
    const who = [habits[g % 6], habits[(g + 3) % 6]];
    const decks = [E.cardAiBuildDeck(db, kits[g % kits.length]), E.cardAiBuildDeck(db, who[1], levels[g % 3], (() => { let x = 1000 + g; return () => { const r = E.cardRngNext(x); x = r.s; return r.v; }; })())];
    const pol = [E.cardAiPolicy(who[0], levels[g % 3]), E.cardAiPolicy(who[1], levels[(g + 1) % 3])];
    let st = E.cardCreateGame(db, { decks, seed: 300 + g, first: g % 2 });
    let x = 77 + g; const rand = () => { const r = E.cardRngNext(x); x = r.s; return r.v; };
    for (let i = 0; i < 3000 && st.winner === null; i++) {
      const p = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? 1 - st.first : E.cardDecider(st);
      const a = E.cardAiChooseAction(db, st, pol[p], rand);
      let n = E.cardApplyAction(db, st, a);
      if (!n) n = E.cardApplyAction(db, st, st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : { type: 'guts', hand: [] });
      if (!n) break;
      if (a && (a.type === 'attack' || a.type === 'breeder')) { const c = E.cardOf(db, st.players[st.active].hand[a.hand[0]]); if (c && c.kind === 'spe') { speUsed++; seen.add(c.no); } }
      st = n; steps++;
      for (let k = 0; k < 2; k++) if (owned(st, k) !== 50) { bad = `対戦${g} 手${i}: ${k === 0 ? '先' : '後'}の持ち札が${owned(st, k)}枚(${JSON.stringify(a)})`; break; }
      if (bad) break;
      if (st.players.some((pl) => pl.hand.length > 30 || pl.guts.some((no) => !db.cards[no]) || pl.hand.some((no) => !db.cards[no]))) { bad = `対戦${g} 手${i}: 手札・ガッツにおかしな札`; break; }
    }
    games++;
  }
  check(`C 対戦${games}戦(${steps}手・特殊技${speUsed}回・${seen.size}種): カードが消えない・増えない`, !bad, bad || '');
}

console.log(`カードの総点検 D「特殊技・手札・山札」: 特殊技 ${speCards.length}枚(付ける札 ${attachCards.length}・そのほか ${nonAttach.length})/ 確かめ ${passed + fails.length}件`);
if (fails.length) { fails.forEach((f) => console.log(`NG: ${f}`)); console.log(`失敗 ${fails.length}件`); process.exit(1); }
console.log('すべて通過');
