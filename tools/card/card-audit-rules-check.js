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
const BLK = find((c) => c.user === 'any' && c.kind === 'blk' && (c.effects || []).some((e) => e.t === 'reduce' && e.kinds.includes('pow')) && c.effects.length === 1, '誰でも使える防御(減らす)。混血は防御・回避をサブの種族の札だけ使う(#3865)ので、誰でもの札にする');
const DGE = find((c) => ['golem', 'any'].includes(c.user) && c.kind === 'dge' && (c.effects || []).some((e) => e.t === 'evade' && e.kinds.includes('pow')), '回避(ゴーレムか誰でも)');
const PRAY = '280';
const F = { draw: 'F115', fight: 'F116', crucible: 'F117', holly: 'F118', duel: 'F119', chaos: 'F120', pride: 'F255', master: 'F256', bind: 'F257', seal: 'F258', ground: 'F259', burn: 'F260', spark: 'F261', air: 'F262', long: 'F263' };
const startMain = () => { const st = newGame(); return st; }; // 先攻 A のターン1・攻撃の段

// ================= A. 全体カード =================
{
  // 置く: ブリーダーの1枚に数える・前の全体カードは出した人の捨て札へ
  let st = startMain(); setHand(st, 0, [F.draw, F.fight]); setGuts(st, 0, 5);
  const handBefore = 2, deckBefore = st.players[0].deck.length;
  // 相手(B)は手札があるのでおいのりの窓が開く。B は出さない
  let s = act(st, opts(st).find((o) => o.type === 'breeder' && o.hand[0] === 0));
  check('おいのりの窓: 相手が全体カードを出した瞬間に、相手の決める番になる', s && s.pendingPray && E.cardDecider(s) === 1);
  s = act(s, { type: 'pray' });
  check('F115 冷静な判断: 出した時に1枚引く・場に残る・ガッツ1を払う', s && s.field && s.field.no === F.draw && s.players[0].hand.length === handBefore - 1 + 1 && s.players[0].deck.length === deckBefore - 1 && s.players[0].guts.length === 4);
  check('全体カードはブリーダーのカード1枚に数える(同じ番に2枚目の全体カードは出せない)', !opts(s).some((o) => o.type === 'breeder'));
  // 次の番(B)で別の全体カード → 前の札(A が出した)は A の捨て札へ
  let t = field(newGame(), F.draw, 0); setHand(t, 0, [F.fight]); setGuts(t, 0, 5); t.players[1].hand = [];
  const dA = t.players[0].discard.length;
  t = act(t, opts(t).find((o) => o.type === 'breeder'));
  check('入れ替わり: 新しい全体カードが出ると、前の札は出した人の捨て札へ行き、場は新しい札だけ', t && t.field.no === F.fight && t.players[0].discard.includes(F.draw) && t.players[0].discard.length === dA + 1 + 2);
}
{
  // 壮絶な戦い +1(ちから・かしこさ)・守りで0になったら足さない
  let st = field(startMain(), F.fight); setHand(st, 0, [POW3]); setGuts(st, 0, 5);
  const a = opts(st).find((o) => o.type === 'attack' && o.hand[0] === 0 && o.target && o.target.m === 0);
  const r = hitFor(st, a);
  check('F116 壮絶な戦い: ちから3が当たると4', r && r.dmg === 4, r && r.dmg);
  // 守りで0(回避)→ +1 しない
  let s = act(st, a); s.players[1].hand = [DGE]; s.players[1].guts = setGuts(E.cardClone(s), 1, 5).players[1].guts;
  const g = E.cardGuardOptions(db, s).find((o) => o.hand === 0);
  s = g ? act(s, g) : null; while (s && s.pending) s = act(s, { type: 'pass' });
  check('F116 壮絶な戦い: 回避して0のときは +1 しない(ダメージ0のときは足さない)', s && s.players[1].mons[0].life === s.players[1].mons[0].max, g ? '' : '回避の候補が無い');
}
{
  const i3 = db.cards[INT3].damage, i1 = db.cards[INT1].damage;
  let st = field(startMain(), F.crucible); setHand(st, 0, [INT3]); setGuts(st, 0, 9);
  const r = hitFor(st, opts(st).find((o) => o.type === 'attack' && o.hand[0] === 0 && o.target && o.target.m === 0));
  check(`F117 興奮のるつぼ: かしこさ${i3}が当たると${i3 - 2}`, r && r.dmg === i3 - 2, r && r.dmg);
  const st2 = field(newGame({ sp0: spFor(INT1) }), F.crucible); setHand(st2, 0, [INT1]); setGuts(st2, 0, 9);
  const o1 = opts(st2).find((o) => o.type === 'attack' && o.hand[0] === 0 && o.target && o.target.m === 0);
  const r1 = o1 && hitFor(st2, o1);
  check('F117 興奮のるつぼ: かしこさ1・2は0になり、ライフは増えない(0より下にしない)', r1 && r1.dmg === 0, r1 && r1.dmg);
  let st3 = field(startMain(), F.crucible); setHand(st3, 0, [POW3]); setGuts(st3, 0, 5);
  const r3 = hitFor(st3, opts(st3).find((o) => o.type === 'attack' && o.hand[0] === 0 && o.target && o.target.m === 0));
  check('F117 興奮のるつぼ: ちから技には効かない', r3 && r3.dmg === db.cards[POW3].damage);
  let st4 = field(startMain(), F.spark); setHand(st4, 0, [INT3]); setGuts(st4, 0, 9);
  const r4 = hitFor(st4, opts(st4).find((o) => o.type === 'attack' && o.hand[0] === 0 && o.target && o.target.m === 0));
  check(`F261 飛び散る火花: かしこさ${i3}が当たると${i3 + 1}`, r4 && r4.dmg === i3 + 1, r4 && r4.dmg);
}
{
  const c2 = db.cards[POW3];
  const st = field(startMain(), F.holly);
  check('F118 ホリィの声援: 要るガッツ -1(攻撃も守りも)・0より下にしない', E.cardActionCost(db, st, 0, [POW3], [0]) === Math.max(0, c2.guts - 1) && E.cardGuardCost(st, { guts: 0 }) === 0 && E.cardGuardCost(st, { guts: 2 }) === 1);
  const sm = field(startMain(), F.master);
  check('F256 師匠のまなざし: 要るガッツ +1(ガッツ0の札も1)', E.cardActionCost(db, sm, 0, [POW3], [0]) === c2.guts + 1 && E.cardGuardCost(sm, { guts: 0 }) === 1);
  // 足りないと出せない
  setHand(sm, 0, [POW3]); setGuts(sm, 0, c2.guts);
  check('F256 師匠のまなざし: 書いてあるガッツちょうどでは、もう出せない', !opts(sm).some((o) => o.type === 'attack'));
}
{
  // 必殺技の応酬(3以下は出せない)・封印(4以上は出せない)
  let st = field(startMain(), F.duel); setHand(st, 0, [POW3, POW4]); setGuts(st, 0, 9);
  const o = opts(st);
  check('F119 必殺技の応酬: ちから3は出せない・4以上は出せる', !o.some((x) => x.type === 'attack' && x.hand[0] === 0) && o.some((x) => x.type === 'attack' && x.hand[0] === 1));
  let st2 = field(startMain(), F.seal); setHand(st2, 0, [POW3, POW4]); setGuts(st2, 0, 9);
  const o2 = opts(st2);
  check('F258 必殺技の封印: ちから4以上は出せない・3は出せる', o2.some((x) => x.type === 'attack' && x.hand[0] === 0) && !o2.some((x) => x.type === 'attack' && x.hand[0] === 1));
  // 壮絶な戦いとは同時に場に出ないが、+1 の札(飛び散る火花)が無くても、組(付ける札)で4になるなら出せる、は card-rules-check が見ている
}
{
  // カード投げ(169・かしこさ0・捨てた枚数を足す): 応酬では捨てて4以上のときだけ・封印では3枚以下のときだけ
  const toss = '169';
  const ghost = monNo('ghost');
  if (ghost && db.cards[toss] && db.cards[toss].ready) {
    const mk = (fno) => { const s = newGame({ sp0: ['ghost', 'suezo', 'pixie'] }); field(s, fno); setHand(s, 0, [toss, POW3, POW3, POW3, POW3]); setGuts(s, 0, 9); return s; };
    const dl = opts(mk(F.duel)).filter((x) => x.type === 'attack' && x.hand[0] === 0);
    check('カード投げ×必殺技の応酬: 捨てる枚数が3以下の手は出せない(最終的なダメージ3以下)', dl.length > 0 && dl.every((x) => (x.toss || []).length >= 4), `${dl.length}手・捨てる枚数 ${[...new Set(dl.map((x) => (x.toss || []).length))].join(',')}`);
    const sl = opts(mk(F.seal)).filter((x) => x.type === 'attack' && x.hand[0] === 0);
    check('カード投げ×必殺技の封印: 4枚捨てる手は出せない(最終的なダメージ4以上)', sl.length > 0 && sl.every((x) => (x.toss || []).length <= 3), `${sl.length}手`);
  } else check('カード投げ(169)がある', false);
}
{
  // ボンバ(空中に2倍): 封印のとき、空中の子へは4で出せない・地上の子へは2で出せる。応酬のときは逆
  const bomba = '191';
  const mk = (fno) => { const s = newGame({ sp0: ['mew', 'suezo', 'pixie'] }); field(s, fno); setHand(s, 0, [bomba]); setGuts(s, 0, 9); return s; };
  const tg = (o) => o.filter((x) => x.type === 'attack' && x.hand[0] === 0).map((x) => x.target.m).sort().join(',');
  const s0 = mk(F.seal);
  const airIdx = s0.players[1].mons.map((m, i) => (E.cardMonType(m, s0.turn) === 'air' ? i : -1)).filter((i) => i >= 0).join(',');
  check('ボンバ×必殺技の封印: 空中の子へ(2倍で4)は出せず、地上の子へは出せる', tg(opts(s0)) === [0, 1, 2].filter((i) => !airIdx.split(',').includes(String(i))).join(','), `狙える ${tg(opts(s0))}・空中 ${airIdx}`);
  check('ボンバ×必殺技の応酬: 空中の子へ(2倍で4)だけ出せる', tg(opts(mk(F.duel))) === airIdx, `狙える ${tg(opts(mk(F.duel)))}`);
}
{
  // 大混乱: ドローの前に、その番の人の山札の上から2枚を捨てる(先攻の1ターン目は引かないので捨てない)
  let st = field(startMain(), F.chaos); setHand(st, 0, []); st.players[1].hand = [POW3, POW3];
  const d1 = st.players[1].deck.length, dis1 = st.players[1].discard.length;
  let s = act(st, { type: 'endAttacks' }); s = act(s, { type: 'guts', hand: [] });
  check('F120 大混乱: 相手の番のはじめに、相手の山札の上から2枚が捨て札へ・そのあと5枚まで引く', s && s.players[1].discard.length === dis1 + 2 && s.players[1].deck.length === d1 - 2 - 3 && s.players[1].hand.length === 5);
  let st2 = field(startMain(), F.chaos); st2.players[1].deck = st2.players[1].deck.slice(0, 2); st2.players[1].hand = [POW3];
  let s2 = act(act(st2, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  check('F120 大混乱: 捨てて山札が無くなり、引けなければ負け(山札切れ)', s2 && s2.winner === 0 && /山札切れ/.test(s2.reason || ''));
}
{
  // 純血のプライド: 純血の子の攻撃に、派生の子は回避を出せない(防御は出せる)
  const hy = Object.values(db.monsters).find((m) => m.main === 'golem' && m.ready !== false && !m.variant);
  if (hy) {
    const s = newGame({ sp1: ['golem', 'hare', 'gali'] });
    s.players[1].mons[0] = { ...s.players[1].mons[0], no: hy.no, species: hy.species, main: hy.main, sub: hy.sub || null, name: hy.name };
    field(s, F.pride); setHand(s, 0, [POW3]); setGuts(s, 0, 9);
    let a = act(s, opts(s).find((o) => o.type === 'attack' && o.target && o.target.m === 0));
    a.players[1].hand = [DGE, BLK]; a.players[1].guts = setGuts(E.cardClone(a), 1, 9).players[1].guts;
    const g = E.cardGuardOptions(db, a);
    check('F255 純血のプライド: 純血の子の攻撃に、派生の子は回避を出せない・防御は出せる', !g.some((o) => o.hand === 0) && g.some((o) => o.hand === 1), JSON.stringify(g));
    const s2 = E.cardClone(s); s2.field = null;
    let a2 = act(s2, opts(s2).find((o) => o.type === 'attack' && o.target && o.target.m === 0));
    a2.players[1].hand = [DGE]; a2.players[1].guts = a.players[1].guts;
    check('F255 純血のプライド: 場に無ければ、派生の子も回避を出せる', E.cardGuardOptions(db, a2).some((o) => o.hand === 0));
  } else check('ゴーレムがメインの派生の子がいる', false);
}
{
  const st = field(startMain(), F.bind); setHand(st, 0, [SPE]); setGuts(st, 0, 9);
  check('F257 がんじがらめ: モンスターは特殊技を出せない', !opts(st).some((o) => o.type === 'attack'));
  const BSPE = find((c) => c.user === 'breeder' && c.kind === 'spe' && !eff(c, 'fuse') && !eff(c, 'attach'), 'ブリーダーの特殊');
  const st2 = field(startMain(), F.bind); setHand(st2, 0, [BSPE]); setGuts(st2, 0, 9);
  const can = opts(st2).some((o) => o.type === 'breeder');
  check('F257 がんじがらめ: ブリーダーの特殊は出せる(設計書のとおり)', can || !E.cardLegalActions(db, (() => { const x = E.cardClone(st2); x.field = null; return x; })()).some((o) => o.type === 'breeder'), db.cards[BSPE].name);
}
{
  // 悪天候・空間のひずみ: 全員の持ちょうを変える。場から無くなると元に戻る。ジャンプなどの空中より先
  const st = startMain(); setHand(st, 0, [F.ground]); setGuts(st, 0, 9); st.players[1].hand = [];
  st.players[1].mons[0].airUntil = 99;
  let s = act(st, opts(st).find((o) => o.type === 'breeder'));
  const types = (x) => x.players.flatMap((pl) => pl.mons.map((m) => E.cardMonType(m, x.turn))).join(',');
  check('F259 悪天候: 全員が地上(空中の子も・ジャンプで空中の子も)', s && types(s).split(',').every((t) => t === 'ground'), types(s));
  // 次に空間のひずみ(B が出す)→ 全員空中。さらに冷静な判断で消える → 元に戻る
  s = act(act(s, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  s.players[1].hand = [F.air]; s.players[1].guts = setGuts(E.cardClone(s), 1, 9).players[1].guts; s.players[0].hand = [];
  s = act(s, opts(s).find((o) => o.type === 'breeder'));
  check('F262 空間のひずみ: 悪天候と入れ替わると、全員が空中', s && types(s).split(',').every((t) => t === 'air'), types(s));
  s = act(act(s, { type: 'endAttacks' }), { type: 'guts', hand: [] });
  s.players[0].hand = [F.draw]; s.players[1].hand = [];
  s = act(s, opts(s).find((o) => o.type === 'breeder'));
  // B の先頭の子は、ジャンプで空中のまま(airUntil)。ほかは本来の持ちょう
  const orig = s.players.flatMap((pl, p) => pl.mons.map((m, i) => (p === 1 && i === 0 ? 'air' : m.type))).join(',');
  check('持ちょうの全体カードが場から無くなると、本来の持ちょうに戻る(ジャンプの空中は残る)', s && types(s) === orig, `${types(s)} / 本来 ${orig}`);
}
{
  // 灼熱の地: 攻撃おわりに、攻撃した側の全員に1ダメージ。最後の1体が倒れたら相手の勝ち
  const st = field(startMain(), F.burn); setHand(st, 0, []);
  const before = st.players[0].mons.map((m) => m.life);
  const s = act(st, { type: 'endAttacks' });
  check('F260 灼熱の地: 攻撃おわりに、攻撃した側の全員が1ダメージ・相手は減らない', s && s.players[0].mons.every((m, i) => m.life === before[i] - 1) && s.players[1].mons.every((m) => m.life === m.max));
  const st2 = field(startMain(), F.burn); st2.players[0].mons.forEach((m, i) => { if (i) { m.ko = true; m.life = 0; } else m.life = 1; });
  const s2 = act(st2, { type: 'endAttacks' });
  check('F260 灼熱の地: 最後の1体が倒れたら相手の勝ち', s2 && s2.winner === 1);
}
{
  // 長期戦の予感: ガッツの段で2枚まで
  const st = field(startMain(), F.long); setHand(st, 0, [POW3, POW3, POW3]);
  const s = act(st, { type: 'endAttacks' });
  check('F263 長期戦の予感: ガッツの段で3枚はだめ・2枚はよい', act(s, { type: 'guts', hand: [0, 1, 2] }) === null && !!act(s, { type: 'guts', hand: [0, 1] }));
  check('F263 長期戦の予感: 同じ番号を重ねて3枚に見せても2枚より多くはならない', (() => { const x = act(s, { type: 'guts', hand: [0, 0, 1] }); return x === null || x.players[0].guts.length <= s.players[0].guts.length + 2; })());
}
{
  // おいのり: 出すと、出た全体カードは効かずに出した人の捨て札へ・前から場にあった全体カードは残る・ガッツ0
  let st = field(startMain(), F.spark, 1); setHand(st, 0, [F.draw]); setGuts(st, 0, 5); st.players[1].hand = [PRAY, POW3]; st.players[1].guts = [];
  const handA = st.players[0].hand.length;
  let s = act(st, opts(st).find((o) => o.type === 'breeder'));
  const p = opts(s).find((o) => o.hand);
  s = p ? act(s, p) : null;
  check('おいのり: 出た全体カードは効かず(引かない)出した人の捨て札へ・前の全体カードは場に残る', s && s.field && s.field.no === F.spark && s.players[0].discard.includes(F.draw) && s.players[0].hand.length === handA - 1 && s.players[1].discard.includes(PRAY));
  check('おいのり: 相手の番に出すので、相手のブリーダーの1枚には数えない', s && !s.players[1].breederUsed);
  // 師匠のまなざしが場にあると、おいのりもガッツ1。ガッツ0なら窓は開かない
  let st2 = field(startMain(), F.master, 1); setHand(st2, 0, [F.draw]); setGuts(st2, 0, 5); st2.players[1].hand = [PRAY]; st2.players[1].guts = [];
  const s2 = act(st2, opts(st2).find((o) => o.type === 'breeder'));
  check('おいのり×師匠のまなざし: ガッツが足りなければ窓は開かない(全体カードはそのまま置かれる)', s2 && !s2.pendingPray && s2.field.no === F.draw);
}

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
