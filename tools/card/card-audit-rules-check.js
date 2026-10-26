#!/usr/bin/env node
// MFバトルカードの総点検 E「全体カードとルールの本体」(2026-10-27・カード部ナガメくん。部長デッキくんの割り振り)
//
//   node tools/card/card-audit-rules-check.js
//
// カードの文と設計書(docs/spec/CARD_BATTLE.md 1-3・全体カードの節)の決まりが、82 の処理でそのとおりに動くかを、
// 小さな対戦の場面を作って1つずつ確かめる。card-rules-check.js は広げず、ここに書く(部長の決め)。
//   A. 全体カード15枚とおいのり: 出した時・効き目・入れ替わる時機(前の札は出した人の捨て札へ・持ちょうが戻る)・ダメージ0のときは足し引きしない
//   B. ルールの本体: 番の流れ(ドロー・先攻の1ターン目・手札5枚のときのガッツ)・後攻の始める前のガッツ・ガッツの払い方・1体1枚・ブリーダー1枚・
//      守りの重ね方・特殊技は守れない・山札切れ・全員KO・同時KO・投了の数え方
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\nthis.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardLegalActions, cardAttackOptions, cardGuardOptions,
  cardActionCost, cardGuardCost, cardMonType, cardDecider, cardClone, cardCpuReward, CARD_BATTLE_SETUP_GUTS_MAX };`, ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0, total = 0;
const check = (name, ok, detail = '') => { total++; console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const cards = Object.values(db.cards).filter((c) => c.ready);
const find = (pred, label) => { const c = cards.filter(pred).sort((a, b) => (a.no < b.no ? -1 : 1))[0]; if (!c) throw new Error(`見本の札が無い: ${label}`); return c.no; };
const eff = (c, t) => (c.effects || []).some((e) => e.t === t);
const plain = (c) => !(c.effects || []).length;
const monNo = (sp) => Object.values(db.monsters).filter((m) => m.species === sp && !m.main && !m.variant).map((m) => m.no).sort()[0];

// ---- 場面づくり: 2人とも決まった3体。手札・ガッツ・山札はあとから書きかえる ----
// 0 の3体: モッチー・スエゾー・ピクシー(空中)/ 1 の3体: ゴーレム・ハム・ガリ(空中)
const SP0 = ['mocchi', 'suezo', 'pixie'], SP1 = ['golem', 'hare', 'gali'];
const filler = (sp) => cards.filter((c) => c.user === sp && plain(c)).map((c) => c.no);
const newGame = ({ first = 0, sp0 = SP0, sp1 = SP1 } = {}) => {
  const deck = (sps) => { const pool = sps.flatMap(filler); return { monsters: sps.map(monNo), cards: Array.from({ length: 50 }, (_, i) => pool[i % pool.length]) }; };
  let st = E.cardCreateGame(db, { decks: [deck(sp0), deck(sp1)], names: ['A', 'B'], seed: 7, first });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  return st;
};
// いまの番の人(active)の手札・ガッツを決める。guts は数(中身は山札の札)
const setHand = (st, p, list) => { st.players[p].hand = list.slice(); return st; };
const setGuts = (st, p, n) => { st.players[p].guts = Array.from({ length: n }, () => filler(SP0[0])[0]); return st; };
const field = (st, no, p = 0) => { const c = db.cards[no]; st.field = { no, p, effects: (c.effects || []).map((e) => ({ ...e })) }; if (eff(c, 'fieldType')) st.players.forEach((pl) => pl.mons.forEach((m) => { m.fieldType = c.effects[0].type; })); return st; };
const act = (st, a) => E.cardApplyAction(db, st, a);
const opts = (st) => E.cardLegalActions(db, st);
const attackOf = (st, hand0, mon, tm) => opts(st).find((o) => o.type === 'attack' && o.hand[0] === hand0 && o.hand.length === 1 && o.mon === mon && o.target && o.target.m === tm);
// 攻撃して、相手は守らない。当たったダメージ(相手のライフの減り)を返す
const hitFor = (st, a) => { const before = st.players[1].mons.map((m) => m.life); let s = act(st, a); if (!s) return null; while (s.pending) s = act(s, { type: 'pass' }); return { st: s, dmg: before.reduce((x, l, i) => x + (l - s.players[1].mons[i].life), 0) }; };

// 見本の札
const POW3 = find((c) => c.user === 'mocchi' && c.kind === 'pow' && c.damage === 3 && plain(c), 'モッチーのちから3');
const POW4 = find((c) => c.user === 'suezo' && c.kind === 'pow' && c.damage >= 4 && plain(c), 'スエゾーのちから4以上');
const INT3 = find((c) => c.user === 'suezo' && c.kind === 'int' && c.damage >= 3 && plain(c), 'スエゾーのかしこさ3以上');
const INT1 = find((c) => c.user !== 'breeder' && c.user !== 'any' && c.kind === 'int' && c.damage <= 2 && c.damage >= 1 && plain(c), 'かしこさ1か2');
// その札の持ち主の種族を先頭にした3体(モッチー・スエゾー・ピクシーで埋める)
const spFor = (no) => { const u = db.cards[no].user; return [...new Set([u, ...SP0])].filter((x) => x !== 'any' && x !== 'breeder').slice(0, 3); };
const SPE = find((c) => c.user === 'mocchi' && c.kind === 'spe', 'モッチーの特殊');
const BLK = find((c) => ['golem', 'any'].includes(c.user) && c.kind === 'blk' && (c.effects || []).some((e) => e.t === 'reduce' && e.kinds.includes('pow')) && c.effects.length === 1, '防御(減らす)');
const DGE = find((c) => ['golem', 'any'].includes(c.user) && c.kind === 'dge' && (c.effects || []).some((e) => e.t === 'evade' && e.kinds.includes('pow')), '回避(ゴーレムか誰でも)');
const PRAY = '280';
const F = { draw: 'F115', fight: 'F116', crucible: 'F117', holly: 'F118', duel: 'F119', chaos: 'F120', pride: 'F255', master: 'F256', bind: 'F257', seal: 'F258', ground: 'F259', burn: 'F260', spark: 'F261', air: 'F262', long: 'F263' };
const startMain = () => { const st = newGame(); return st; }; // 先攻 A のターン1・攻撃の段

// ================= A. 全体カード(次の区切りで足す) =================

// ================= B. ルールの本体 =================
{
  // 先攻の1ターン目は引かない・2ターン目から5枚まで引く・5枚なら山札の上をガッツへ
  const st = E.cardCreateGame(db, { decks: [newGame().players[0], newGame().players[1]].map((pl, i) => ({ monsters: (i ? SP1 : SP0).map(monNo), cards: Array.from({ length: 50 }, () => filler((i ? SP1 : SP0)[0])[0]) })), seed: 3, first: 0 });
  const s = act(st, { type: 'setupGuts', hand: [0, 1] });
  check('後攻は始める前に2枚までガッツにできる・先攻の1ターン目は引かない', s && s.players[1].guts.length === 2 && s.players[1].hand.length === 3 && s.players[0].hand.length === 5 && s.turn === 1);
  check('後攻の始める前のガッツ: 3枚目は入らない', (() => { const x = act(st, { type: 'setupGuts', hand: [0, 1, 2] }); return x && x.players[1].guts.length === E.CARD_BATTLE_SETUP_GUTS_MAX; })());
  check('後攻の始める前のガッツ: 手札に無い番号では、ガッツは増えない', (() => { const x = act(st, { type: 'setupGuts', hand: [7, 9] }); return x === null || x.players[1].guts.length === 0; })());
  let t = act(act(s, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  check('2ターン目(後攻): 5枚になるまで引く', t && t.players[1].hand.length === 5);
  let u = act(act(t, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  const g0 = u && u.players[0].guts.length;
  check('手札がもう5枚なら、引かずに山札の上をガッツにする', u && u.players[0].hand.length === 5 && g0 === 1);
}
{
  const st = startMain(); setHand(st, 0, [POW3, POW3]);
  const s = act(st, { type: 'endAttacks' });
  check('ガッツの段: 手札に無い番号では、ガッツは増えない', (() => { const x = act(s, { type: 'guts', hand: [5, 6] }); return x === null || x.players[0].guts.length === s.players[0].guts.length; })());
  check('ガッツの段: 同じ番号を重ねても1枚だけ', (() => { const x = act(s, { type: 'guts', hand: [0, 0] }); return x === null || x.players[0].guts.length === s.players[0].guts.length + 1; })());
}
{
  // ガッツの払い方: 新しく置いたガッツから捨て札へ
  const st = startMain(); setHand(st, 0, [POW3]); st.players[0].guts = ['g1', 'g2', 'g3', 'g4'].map((_, i) => filler(SP0[i % 3])[i]);
  const want = st.players[0].guts.slice(-db.cards[POW3].guts).reverse();
  const s = act(st, opts(st).find((o) => o.type === 'attack'));
  check('ガッツは新しく置いたものから払う', s && JSON.stringify(s.players[0].discard.slice(0, want.length)) === JSON.stringify(want));
}
{
  // 1体は1ターンに攻撃の技1枚まで / ブリーダーのカードは1ターン1枚
  let st = startMain(); setHand(st, 0, [POW3, POW3]); setGuts(st, 0, 9);
  let s = hitFor(st, opts(st).find((o) => o.type === 'attack' && o.mon === 0)).st;
  check('1体1枚: 攻撃した子は、同じ番にもう攻撃の技を出せない', !opts(s).some((o) => o.type === 'attack' && o.mon === 0));
  const B1 = find((c) => c.user === 'breeder' && c.kind === 'pow' && !eff(c, 'attach') && !eff(c, 'rush'), 'ブリーダーのちから');
  let t = startMain(); setHand(t, 0, [B1, B1]); setGuts(t, 0, 9);
  t = hitFor(t, opts(t).find((o) => o.type === 'breeder')).st;
  check('ブリーダーのカードは1ターンに1枚まで', !opts(t).some((o) => o.type === 'breeder'));
}
{
  // 守りの重ね方: 防御を2枚重ねると、減らす数を足す。特殊技は守れない
  let st = startMain(); setHand(st, 0, [POW4]); setGuts(st, 0, 9);
  let s = act(st, opts(st).find((o) => o.type === 'attack' && o.target && o.target.m === 0 && o.hand.length === 1));
  s.players[1].hand = [BLK, BLK]; s.players[1].guts = setGuts(E.cardClone(s), 1, 9).players[1].guts;
  const dmg = db.cards[POW4].damage, red = db.cards[BLK].effects[0].n;
  s = act(s, E.cardGuardOptions(db, s).find((o) => o.hand === 0));
  s = s && act(s, E.cardGuardOptions(db, s).find((o) => o.hand === 0));
  s = s && act(s, { type: 'pass' });
  check('守りの重ね方: 防御の札は何枚でも重ねられ、減らす数を足す(0より下にしない)', s && s.players[1].mons[0].max - s.players[1].mons[0].life === Math.max(0, dmg - 2 * red));
  const sp = startMain(); setHand(sp, 0, [SPE]); setGuts(sp, 0, 9);
  const o = opts(sp).find((x) => x.type === 'attack');
  const after = o && act(sp, o);
  check('特殊技は守れない(守りの段にならず、その場で効く)', after && !after.pending);
}
{
  // 全員KO・同時KO(攻撃した側の勝ち)
  let st = startMain(); setHand(st, 0, [POW4]); setGuts(st, 0, 9);
  st.players[1].mons.forEach((m, i) => { if (i) { m.ko = true; m.life = 0; } else m.life = 1; });
  const r = hitFor(st, opts(st).find((o) => o.type === 'attack'));
  check('全員KO: 相手の最後の1体を倒したら勝ち', r && r.st.winner === 0);
  const SELF = find((c) => c.user !== 'breeder' && ['pow', 'int'].includes(c.kind) && c.damage > 0 && (c.effects || []).length === 1 && ['selfDamage', 'selfDamageIfHit'].includes(c.effects[0].t), '自分もダメージを受ける技');
  let t = newGame({ sp0: spFor(SELF) }); setHand(t, 0, [SELF]); setGuts(t, 0, 9);
  t.players[1].mons.forEach((m, i) => { if (i) { m.ko = true; m.life = 0; } else m.life = 1; });
  const user = opts(t).find((o) => o.type === 'attack');
  t.players[0].mons.forEach((m, i) => { if (i !== user.mon) { m.ko = true; m.life = 0; } else m.life = 1; });
  const r2 = hitFor(t, user);
  check('同時KO: 両方の最後の1体が同時に倒れたら、攻撃した側の勝ち', r2 && r2.st.winner === 0 && /同時/.test(r2.st.reason || ''), r2 && r2.st.reason);
}
{
  // 投了は対戦の画面(84)が負けにする。82 では数え方: 倒した数で決まる(倒していなければ0)
  const daily = { cpuPoint: 0, firstWin: false };
  const a = E.cardCpuReward(daily, 'normal', 'surrender', { ownTurns: 10, kos: 0 });
  const b = E.cardCpuReward(daily, 'normal', 'surrender', { ownTurns: 10, kos: 2 });
  const l = E.cardCpuReward(daily, 'normal', 'lose', { ownTurns: 10, kos: 2 });
  check('投了: 倒した数が0ならビートPは0・倒していれば増え、負けより多くはならない', a.total === 0 && b.total > 0 && b.total <= l.total, `${a.total} / ${b.total} / 負け ${l.total}`);
}
console.log(`\n確かめた場面: ${total}`);
console.log(failed ? `NG が ${failed} 件あります` : 'すべてOK');
process.exit(failed ? 1 : 0);
