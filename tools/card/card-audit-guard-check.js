// MFバトルカードの総点検 B「守り」(2026-10-27 社長の急ぎ・カード部の割り当て)。
// 回避・防御などの守りの効果を、「カードの文 → データ(effects)→ 82 の処理」の順に確かめる。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-audit-guard-check.js [--verbose]
//
// 見るもの
//   A. 文とデータ: 守りのカード1枚ずつ、文に書いてある「ちから技/かしこさ技」「−N」「N以上のガッツ」「半分」「0にする」が effects と合う
//   B. 1枚ずつ実際に効かせる: 回避・防御の全カードを、そのカードを使える子が狙われた場面で出し、
//      ・文の技の種類(ちから/かしこさ)には出せて、ほかの種類・特殊技には出せない
//      ・「N以上のガッツ」は、それより安い技には出せない
//      ・出したあとのダメージが文のとおり(回避0・−N・半分(切り捨て)をマイナス・0・はね返し)
//   C. 取りこぼしやすい場面: 回避されても半分の技(切り上げ)・回避できない技・特殊技・全員に当たる技・2枚重ね・
//      ダメージ0の技・はね返しで攻撃した子が倒れる・ぬいぐるみ・根性・かばう・盾になる・隠れる・みんな下がれ・
//      我慢・精神集中・空中や水中になる守り・持ちょうを選ぶ
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardLegalActions, cardOf, cardEff, cardHasEff, cardUsableBy, cardMonType, cardCanTarget };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let failed = 0;
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else { failed++; fails.push(`${name}${detail ? ` — ${detail}` : ''}`); } };

const GUARD_EFFS = ['evade', 'evadeAll', 'reduce', 'reduceHalf', 'reduceAll', 'reflect', 'redirect', 'cover', 'shield', 'endure', 'safe', 'gutsGuard', 'noGutsLoss', 'becomeAir', 'liftAllies', 'waterAll', 'liftTarget', 'form'];
const cards = Object.values(db.cards);
const guardCards = cards.filter((c) => (c.effects || []).some((e) => GUARD_EFFS.includes(e.t)));
const text = (c) => String(c.text || '').replace(/\s+/g, '');

// ---- 種族 → その種族のふつうのモンスター(混血でない最初の1体) ----
const monOf = {};
Object.values(db.monsters).forEach((m) => { if (!m.main && !monOf[m.species]) monOf[m.species] = m.no; });
const anyMon = 'C-003'; // ゴーレム(地上・ライフ9)

// ---- 攻撃に使う、効果の無い素の技(種類・ガッツの数ごと) ----
const plainAttack = (kind, { minGuts = 0, maxGuts = 99, minDmg = 3 } = {}) => cards.find((c) => c.ready && c.kind === kind && (!c.effects || c.effects.length === 0)
  && (c.damage || 0) >= minDmg && c.guts >= minGuts && c.guts <= maxGuts && c.user !== 'any' && c.user !== 'breeder' && monOf[c.user]);

// ---- 場面: 0 が攻める側・1 が守る側。手札とガッツを決める ----
const scene = ({ mons, hands, guts = [10, 10] }) => {
  const decks = mons.map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(guts[i]).fill('100'); });
  st.active = 0; st.phase = 'main';
  return st;
};
const act = (st, a) => { const n = E.cardApplyAction(db, st, a); if (!n) throw new Error(`だめな操作: ${JSON.stringify(a)}`); return n; };
// 攻撃して、守る側の手札の handNo を出す(出せなければ null)。返す: { st, offered }
const attackThenGuard = (st, { target = 0, guardHand = 0, guardMon = null, guardTo = null } = {}) => {
  const o = E.cardAttackOptions(db, st).find((x) => x.target && x.target.p === 1 && x.target.m === target) || E.cardAttackOptions(db, st).find((x) => !x.target || x.target.p === 1);
  if (!o) return { st, offered: false, noAttack: true };
  st = act(st, o);
  if (!st.pending) return { st, offered: false, noPending: true };
  const g = E.cardGuardOptions(db, st).filter((x) => x.hand === guardHand && (guardMon === null || x.mon === guardMon) && (guardTo === null || x.to === guardTo));
  if (!g.length) return { st, offered: false };
  st = act(st, g[0]);
  return { st, offered: true };
};
const passAll = (st) => { for (let i = 0; i < 10 && st.pending; i++) st = act(st, { type: 'pass' }); return st; };
const lifeOf = (st, p, m) => st.players[p].mons[m].life;
const maxOf = (st, p, m) => st.players[p].mons[m].max;

// ================= A. 文とデータ =================
const kindsFromText = (t) => {
  const pow = /ちから技/.test(t); const int = /かしこさ技/.test(t);
  return [pow ? 'pow' : null, int ? 'int' : null].filter(Boolean);
};
guardCards.forEach((c) => {
  const t = text(c);
  (c.effects || []).forEach((e) => {
    if (['evade', 'reduce', 'reduceHalf', 'reduceAll', 'reflect', 'endure'].includes(e.t) && Array.isArray(e.kinds)) {
      // 文の最初の文(効果の本体)に出てくる技の種類と合う。飛び上がる・ジャンプ・舞い上がるは、2文目の「次のターンの…」を見ない
      const first = t.split('。')[0];
      const want = kindsFromText(first);
      check(`A ${c.no} ${c.name}: ${e.t} の技の種類が文と合う`, JSON.stringify(e.kinds.slice().sort()) === JSON.stringify(want.slice().sort()), `データ ${e.kinds} / 文 ${want}`);
    }
    if (e.t === 'reduce') { const m = t.match(/[−-](\d+)する/); check(`A ${c.no} ${c.name}: 減らす数が文と合う`, !!m && Number(m[1]) === e.n, `データ ${e.n} / 文 ${m && m[1]}`); }
    if (e.t === 'evade') {
      const m = t.match(/(\d)以上のガッツを消費する/);
      check(`A ${c.no} ${c.name}: 「N以上のガッツ」が文と合う`, (m ? Number(m[1]) : undefined) === e.minGuts, `データ ${e.minGuts} / 文 ${m && m[1]}`);
    }
    if (e.t === 'reduceHalf') check(`A ${c.no} ${c.name}: 半分(切り捨て)をマイナスと書いてある`, /半分\(切り捨て\)をマイナス/.test(t));
    if (e.t === 'reduceAll') check(`A ${c.no} ${c.name}: 0にすると書いてある`, /ダメージを0にする/.test(t));
    if (e.t === 'reflect') {
      const half = /半分/.test(t);
      check(`A ${c.no} ${c.name}: はね返す割合が文と合う`, half ? e.frac === 0.5 : e.frac === 1, `frac ${e.frac}`);
    }
  });
  check(`A ${c.no} ${c.name}: 守りのカードは、使えるカードになっている(準備中でない)`, c.ready === true);
});

// ================= B. 1枚ずつ実際に効かせる(回避・防御・はね返し) =================
const powA = plainAttack('pow', { minGuts: 2, minDmg: 4 });
const intA = plainAttack('int', { minGuts: 2, minDmg: 4 });
const powCheap = plainAttack('pow', { maxGuts: 1, minDmg: 2 });
const intCheap = plainAttack('int', { maxGuts: 1, minDmg: 2 });
check('B の材料: 効果の無い ちから技・かしこさ技(ガッツ2以上と1以下)が見つかる', !!(powA && intA && powCheap && intCheap), [powA, intA, powCheap, intCheap].map((c) => c && c.no).join(','));
// 特殊技は通常の守りで防げない(台帳)。いまはダメージを与える特殊技が1枚も無いので、守りの窓そのものが開かない。増えたらここで気づく
check('B 特殊技にダメージの数字が付いたカードは無い(付いたら守りの決まりを見直す)', !cards.some((c) => c.ready && c.kind === 'spe' && (c.damage || 0) > 0));

const userMon = (c) => (c.user === 'any' ? anyMon : monOf[c.user]);
// 守る側の1体目にカードの持ち主、攻める側の1体目に攻撃の技の持ち主
const tryGuard = (guard, atk, extra = {}) => {
  const st0 = scene({ mons: [[monOf[atk.user], 'C-003', 'C-006'], [userMon(guard), 'C-003', 'C-006']], hands: [[atk.no], [guard.no]], ...extra });
  const life0 = lifeOf(st0, 1, 0);
  const atkLife0 = lifeOf(st0, 0, 0);
  const r = attackThenGuard(st0);
  if (r.noAttack || r.noPending) return { skip: true };
  if (!r.offered) return { offered: false };
  const st = passAll(r.st);
  return { offered: true, dmg: life0 - lifeOf(st, 1, 0), back: atkLife0 - lifeOf(st, 0, 0) };
};
const effDmg = (atk) => (atk.damage || 0);
if (powA && intA && powCheap && intCheap) {
  guardCards.forEach((g) => {
    const ev = E.cardEff(g, 'evade'); const re = E.cardEff(g, 'reduce'); const rh = E.cardEff(g, 'reduceHalf'); const ra = E.cardEff(g, 'reduceAll'); const rf = E.cardEff(g, 'reflect');
    const main = ev || re || rh || ra || rf;
    if (!main || E.cardHasEff(g, 'selfGutsAll') && false) return;
    ['pow', 'int'].forEach((kind) => {
      const atk = kind === 'pow' ? powA : intA;
      const r = tryGuard(g, atk);
      if (r.skip) { check(`B ${g.no} ${g.name}: ${kind} の場面が作れる`, false); return; }
      const should = main.kinds.includes(kind);
      check(`B ${g.no} ${g.name}: ${kind === 'pow' ? 'ちから技' : 'かしこさ技'}に${should ? '出せる' : '出せない'}`, r.offered === should, `出せた ${r.offered}`);
      if (!r.offered || !should) return;
      const d = effDmg(atk);
      let want = d; let wantBack = 0;
      if (ev) want = 0;
      if (re) want = Math.max(0, d - re.n);
      if (rh) want = d - Math.floor(d / 2);
      if (ra) want = 0;
      if (rf) { if (rf.keep) { wantBack = Math.floor(d * rf.frac); want = d - wantBack; } else { want = 0; wantBack = d; } }
      check(`B ${g.no} ${g.name}: ${kind === 'pow' ? 'ちから技' : 'かしこさ技'}(${d})のダメージが ${want}${wantBack ? `・はね返し ${wantBack}` : ''}`, r.dmg === want && r.back === wantBack, `受けた ${r.dmg}・はね返し ${r.back}`);
    });
    // N以上のガッツ: 安い技には出せない
    if (ev && ev.minGuts) {
      const cheap = ev.kinds.includes('pow') ? powCheap : intCheap;
      const r = tryGuard(g, cheap);
      if (!r.skip) check(`B ${g.no} ${g.name}: ガッツ${cheap.guts}の技には出せない(${ev.minGuts}以上だけ)`, r.offered === (cheap.guts >= ev.minGuts), `出せた ${r.offered}`);
    }
  });
}

// ================= C. 取りこぼしやすい場面 =================
const C = (name, fn) => { try { fn(); } catch (e) { check(`C ${name}`, false, String(e && e.message || e).slice(0, 200)); } };
const byNo = (no) => db.cards[no];
const withEff = (t, pred = () => true) => cards.find((c) => c.ready && E.cardHasEff(c, t) && !E.cardHasEff(c, 'requires') && pred(c) && (c.user === 'any' || monOf[c.user]));

C('回避されても半分の技は、回避で切り上げの半分になる', () => {
  const atk = withEff('halfOnEvade', (c) => c.kind === 'pow' && (c.damage || 0) >= 3);
  if (!atk) return check('C 回避されても半分の技がある', false);
  const g = byNo('108'); // 転がる(モッチー)
  const r = tryGuard(g, atk);
  check(`C 回避されても半分(${atk.name} ${atk.damage}) → ${Math.ceil(atk.damage / 2)}`, r.offered && r.dmg === Math.ceil(atk.damage / 2), JSON.stringify(r));
});
C('回避できない技には、回避を出せない(防御は出せる)', () => {
  const atk = withEff('noEvade', (c) => c.kind === 'pow' && (c.damage || 0) >= 3 && !E.cardHasEff(c, 'area'));
  if (!atk) return check('C 回避できない技がある', false);
  check(`C 回避できない技(${atk.name})に回避は出せない`, tryGuard(byNo('108'), atk).offered === false);
  check(`C 回避できない技(${atk.name})に防御は出せる`, tryGuard(byNo('106'), atk).offered === true);
});
C('防御で減らせない技には、防御が効かない', () => {
  const atk = withEff('noBlockReduce', (c) => ['pow', 'int'].includes(c.kind) && (c.damage || 0) >= 3 && !E.cardHasEff(c, 'area'));
  if (!atk) return; // 無ければ見ない
  const g = atk.kind === 'pow' ? byNo('035') : byNo('247');
  const r = tryGuard(g, atk);
  if (r.offered) check(`C 防御で減らせない技(${atk.name})は、出しても減らない`, r.dmg === atk.damage, JSON.stringify(r));
});
C('防御を2枚重ねると、両方の数だけ減る', () => {
  const atk = powA; // ダメージ4以上
  let st = scene({ mons: [[monOf[atk.user], 'C-003', 'C-006'], [monOf.mocchi, 'C-003', 'C-006']], hands: [[atk.no], ['106', '350']] }); // まるまる −3・光の盾 −1
  const life0 = lifeOf(st, 1, 0);
  const o = E.cardAttackOptions(db, st).find((x) => x.target && x.target.p === 1 && x.target.m === 0);
  st = act(st, o);
  st = act(st, E.cardGuardOptions(db, st).find((x) => x.hand === 0));
  const g2 = E.cardGuardOptions(db, st).find((x) => st.players[1].hand[x.hand] === '350');
  check('C 1枚出したあとも、2枚目の防御を出せる', !!g2);
  if (g2) st = act(st, g2);
  st = passAll(st);
  check(`C 2枚重ね(${atk.damage} −3 −1)`, life0 - lifeOf(st, 1, 0) === Math.max(0, atk.damage - 4), `受けた ${life0 - lifeOf(st, 1, 0)}`);
});
C('全員に当たる技: 狙われた1体ずつ守るか選べる・みんな下がれで全員回避', () => {
  const atk = withEff('area', (c) => c.kind === 'pow' && (c.damage || 0) >= 2 && !E.cardEff(c, 'area').only && !E.cardHasEff(c, 'noEvade'));
  if (!atk) return check('C 全員に当たる技がある', false);
  let st = scene({ mons: [[monOf[atk.user], 'C-003', 'C-006'], [monOf.mocchi, 'C-003', 'C-006']], hands: [[atk.no], ['123']] });
  const before = [0, 1, 2].map((m) => lifeOf(st, 1, m));
  const o = E.cardAttackOptions(db, st)[0];
  st = act(st, o);
  const g = E.cardGuardOptions(db, st).find((x) => st.players[1].hand[x.hand] === '123');
  check(`C 全員に当たる技(${atk.name})に、みんな下がれを出せる`, !!g);
  if (!g) return;
  st = passAll(act(st, g));
  const after = [0, 1, 2].map((m) => lifeOf(st, 1, m));
  check('C みんな下がれで、3体とも回避する', before.every((v, i) => v === after[i]), `${before} → ${after}`);
  // 1体狙いの技には出せない
  check('C みんな下がれは、1体狙いの技には出せない', tryGuard(byNo('123'), powA).offered === false);
});
C('はね返しで、攻撃した子のライフが0になったら倒れる', () => {
  const atk = powA;
  let st = scene({ mons: [[monOf[atk.user], 'C-003', 'C-006'], [monOf.zilla, 'C-003', 'C-006']], hands: [[atk.no], ['272']] });
  st.players[0].mons[0].life = 1;
  const r = attackThenGuard(st);
  check('C はねかえすを出せる', r.offered);
  if (!r.offered) return;
  st = passAll(r.st);
  check('C はね返しでライフ0になった攻撃側は KO', st.players[0].mons[0].ko === true && lifeOf(st, 0, 0) === 0);
});
C('カウンター(半分はね返す)の読み方: 半分(切り捨て)を返し、残りだけ受ける(2026-10-27 社長)', () => {
  const r = tryGuard(byNo('084'), powA);
  check(`C カウンター: 受ける ${powA.damage - Math.floor(powA.damage / 2)}・返す ${Math.floor(powA.damage / 2)}`, r.offered && r.dmg === powA.damage - Math.floor(powA.damage / 2) && r.back === Math.floor(powA.damage / 2), JSON.stringify(r));
  // 社長の例: 5ダメージなら2を返して3を受ける(奇数の切り捨て)
  const pow5 = cards.find((c) => c.ready && c.kind === 'pow' && c.damage === 5 && !(c.effects || []).length);
  const r5 = pow5 ? tryGuard(byNo('084'), pow5) : null;
  check('C カウンター: 5ダメージなら3を受け、2を返す', !!r5 && r5.dmg === 3 && r5.back === 2, JSON.stringify(r5));
});
C('根性: 残りのライフ以上のダメージでも、ライフ1で残る', () => {
  let st = scene({ mons: [[monOf[powA.user], 'C-003', 'C-006'], [anyMon, 'C-003', 'C-006']], hands: [[powA.no], ['111']] });
  st.players[1].mons[0].life = 2;
  const r = attackThenGuard(st);
  check('C 根性を出せる', r.offered);
  if (!r.offered) return;
  st = passAll(r.st);
  check('C 根性: ライフ1で残る(KO しない)', lifeOf(st, 1, 0) === 1 && !st.players[1].mons[0].ko, `ライフ ${lifeOf(st, 1, 0)}`);
});
C('友をかばう: 狙われた味方のかわりに、ゴーレムが受ける', () => {
  let st = scene({ mons: [[monOf[powA.user], 'C-003', 'C-006'], ['C-006', monOf.golem, 'C-008']], hands: [[powA.no], ['036']] });
  const r = attackThenGuard(st, { guardMon: 1 });
  check('C 友をかばうを、狙われていないゴーレムが出せる', r.offered);
  if (!r.offered) return;
  st = passAll(r.st);
  check('C かばった子が受け、狙われた子は無傷', lifeOf(st, 1, 0) === maxOf(st, 1, 0) && lifeOf(st, 1, 1) === maxOf(st, 1, 1) - powA.damage, `${lifeOf(st, 1, 0)} / ${lifeOf(st, 1, 1)}`);
  // 狙われた本人(ゴーレム)だけが友をかばうを使える場面では、出せない(ほかの2体はゴーレムでない)
  let st2 = scene({ mons: [[monOf[powA.user], 'C-003', 'C-006'], [monOf.golem, 'C-006', 'C-008']], hands: [[powA.no], ['036']] });
  check('C 友をかばうは、狙われた本人は出せない', attackThenGuard(st2).offered === false);
});
C('盾になる: 全員に当たる技の味方の分を、全部モノリスが受ける', () => {
  const atk = withEff('area', (c) => c.kind === 'pow' && (c.damage || 0) >= 1 && !E.cardEff(c, 'area').only);
  let st = scene({ mons: [[monOf[atk.user], 'C-003', 'C-006'], ['C-006', monOf.monol, 'C-008']], hands: [[atk.no], ['163']] });
  st.players[1].mons[1].life = 30; st.players[1].mons[1].max = 30;
  st = act(st, E.cardAttackOptions(db, st)[0]);
  const g = E.cardGuardOptions(db, st).find((x) => st.players[1].hand[x.hand] === '163' && x.mon === 1);
  check('C 盾になるを、モノリスが出せる', !!g);
  if (!g) return;
  st = passAll(act(st, g));
  const d = atk.damage;
  check('C 盾になる: ほかの2体は無傷・モノリスが3体ぶん受ける', lifeOf(st, 1, 0) === maxOf(st, 1, 0) && lifeOf(st, 1, 2) === maxOf(st, 1, 2) && lifeOf(st, 1, 1) === 30 - d * 3, `${[0, 1, 2].map((m) => lifeOf(st, 1, m))}`);
});
C('隠れる: 目標をほかの味方へ移す(移した先の子はもう守れない)', () => {
  let st = scene({ mons: [[monOf[powA.user], 'C-003', 'C-006'], [monOf.mocchi, 'C-003', 'C-006']], hands: [[powA.no], ['107', '350']] });
  const r = attackThenGuard(st, { guardTo: 1 });
  check('C 隠れるを出して、ゴーレムへ移せる', r.offered);
  if (!r.offered) return;
  st = r.st;
  check('C 移した先の子は、もう守れない(光の盾が出せない)', E.cardGuardOptions(db, st).length === 0, JSON.stringify(E.cardGuardOptions(db, st)));
  st = passAll(st);
  check('C 隠れた子は無傷・移した先が受ける', lifeOf(st, 1, 0) === maxOf(st, 1, 0) && lifeOf(st, 1, 1) === maxOf(st, 1, 1) - powA.damage);
});
C('ぬいぐるみ: 次の自分の番まで、相手の技のダメージが0', () => {
  let st = scene({ mons: [[monOf.mew, 'C-003', 'C-006'], [monOf[powA.user], 'C-003', 'C-006']], hands: [['198'], []], guts: [10, 10] });
  const o = E.cardAttackOptions(db, st).find((x) => st.players[0].hand[x.hand[0]] === '198');
  check('C ぬいぐるみを使える', !!o);
  if (!o) return;
  st = passAll(act(st, o));
  check('C ぬいぐるみの印が付く', st.players[0].mons[0].safeUntil >= st.turn + 1);
  // 相手の番にする
  st = act(st, { type: 'endAttacks' }); st = act(st, { type: 'guts', hand: [] });
  st.players[1].hand = [powA.no]; st.players[1].guts = Array(10).fill('100'); st.phase = 'main';
  const life0 = lifeOf(st, 0, 0);
  const a = E.cardAttackOptions(db, st).find((x) => x.target && x.target.p === 0 && x.target.m === 0);
  if (!a) return check('C 相手の番に、ぬいぐるみの子を狙える', false);
  st = passAll(act(st, a));
  check('C ぬいぐるみの子はダメージ0', lifeOf(st, 0, 0) === life0, `${life0} → ${lifeOf(st, 0, 0)}`);
});
C('我慢: ガッツを減らす技のガッツ減少を無効にする', () => {
  const atk = withEff('gutsLossOnHit', (c) => c.kind === 'pow' && !E.cardHasEff(c, 'area'));
  let st = scene({ mons: [[monOf[atk.user], 'C-003', 'C-006'], [anyMon, 'C-003', 'C-006']], hands: [[atk.no], ['275']] });
  const r = attackThenGuard(st);
  check(`C 我慢を、ガッツを減らす技(${atk.name})に出せる`, r.offered);
  if (!r.offered) return;
  const g0 = r.st.players[1].guts.length;
  st = passAll(r.st);
  check('C 我慢: ダメージは受けるが、ガッツは減らない', st.players[1].guts.length === g0 && lifeOf(st, 1, 0) < maxOf(st, 1, 0), `ガッツ ${g0} → ${st.players[1].guts.length}`);
  check('C 我慢は、ガッツを減らさない技には出せない', tryGuard(byNo('275'), powA).offered === false);
});
C('精神集中: 次のターンまで、相手にガッツを減らされない', () => {
  const atk = withEff('gutsLossOnHit', (c) => c.kind === 'pow' && !E.cardHasEff(c, 'area'));
  let st = scene({ mons: [[monOf.durahan, 'C-003', 'C-006'], [monOf[atk.user], 'C-003', 'C-006']], hands: [['245'], []] });
  const o = E.cardAttackOptions(db, st).find((x) => st.players[0].hand[x.hand[0]] === '245');
  check('C 精神集中を使える', !!o);
  if (!o) return;
  st = passAll(act(st, o));
  st = act(st, { type: 'endAttacks' }); st = act(st, { type: 'guts', hand: [] });
  st.players[1].hand = [atk.no]; st.players[1].guts = Array(10).fill('100'); st.phase = 'main';
  const g0 = st.players[0].guts.length;
  const a = E.cardAttackOptions(db, st).find((x) => x.target && x.target.p === 0);
  st = passAll(act(st, a));
  check('C 精神集中: 相手の番にガッツを減らす技を受けても、ガッツは減らない', st.players[0].guts.length === g0, `${g0} → ${st.players[0].guts.length}`);
});
C('ジャンプ: 回避して、次の自分の番まで空中・次の番のちから技が2倍', () => {
  const g = byNo('012');
  let st = scene({ mons: [[monOf[powA.user], 'C-003', 'C-006'], [monOf.tiger, 'C-003', 'C-006']], hands: [[powA.no], ['012']] });
  const r = attackThenGuard(st);
  check('C ジャンプを出せる', r.offered);
  if (!r.offered) return;
  st = passAll(r.st);
  const mon = st.players[1].mons[0];
  check('C ジャンプ: 回避した(無傷)', mon.life === mon.max);
  check('C ジャンプ: 次のターンの終わりまで空中', E.cardMonType(mon, st.turn + 1) === 'air' && E.cardMonType(mon, st.turn + 2) !== 'air', `${E.cardMonType(mon, st.turn + 1)} / ${E.cardMonType(mon, st.turn + 2)}`);
  check('C ジャンプ: 次のターンのちから技が2倍の印', !!mon.mult && mon.mult.turn === st.turn + 1 && mon.mult.n === 2 && mon.mult.kinds.includes('pow'), JSON.stringify(mon.mult));
  check('C ジャンプのデータ: 文どおり、次のターンはちから技だけ2倍', JSON.stringify(E.cardEff(g, 'nextTurnMult').kinds) === '["pow"]');
});
C('吹き上げる: 狙われていない持ち主が出し、自分以外の味方が空中になる', () => {
  const atk = cards.find((c) => c.ready && c.kind === 'pow' && E.cardEff(c, 'cannotHit') && E.cardEff(c, 'cannotHit').type === 'air' && !E.cardHasEff(c, 'area') && monOf[c.user]);
  if (!atk) return; // 空中に当たらない技が無ければ見ない
  let st = scene({ mons: [[monOf[atk.user], 'C-003', 'C-006'], ['C-006', monOf.zilla, 'C-008']], hands: [[atk.no], ['270']] });
  const r = attackThenGuard(st, { guardMon: 1 });
  check('C 吹き上げるを、狙われていないグジラが出せる', r.offered);
  if (!r.offered) return;
  st = passAll(r.st);
  check(`C 吹き上げる: 空中になった味方には、空中に当たらない技(${atk.name})が当たらない`, lifeOf(st, 1, 0) === maxOf(st, 1, 0), `${lifeOf(st, 1, 0)}/${maxOf(st, 1, 0)}`);
  check('C 吹き上げる: 出した本人(グジラ)は空中にならない', E.cardMonType(st.players[1].mons[1], st.turn) !== 'air');
});
C('ひきずりこむ: このターン、味方が全員水中になる', () => {
  const atk = cards.find((c) => c.ready && c.kind === 'pow' && E.cardEff(c, 'cannotHit') && E.cardEff(c, 'cannotHit').type === 'water' && !E.cardHasEff(c, 'area') && monOf[c.user]);
  let st = scene({ mons: [[monOf[(atk || powA).user], 'C-003', 'C-006'], ['C-006', monOf.arrowhead, 'C-008']], hands: [[(atk || powA).no], ['318']] });
  const r = attackThenGuard(st, { guardMon: 1 });
  check('C ひきずりこむを、狙われていないアローヘッドが出せる', r.offered);
  if (!r.offered) return;
  check('C ひきずりこむ: このターン、味方が全員水中', r.st.players[1].mons.every((m) => E.cardMonType(m, r.st.turn) === 'water'));
  check('C ひきずりこむ: 次のターンには戻る', r.st.players[1].mons.every((m) => m.waterUntil < r.st.turn + 1));
  if (atk) { st = passAll(r.st); check(`C ひきずりこむ: 水中に当たらない技(${atk.name})は当たらない`, lifeOf(st, 1, 0) === maxOf(st, 1, 0)); }
});
C('ほうり上げる: 相手1体をターン終わりまで空中にし、もう1回攻撃できる', () => {
  let st = scene({ mons: [[monOf.dragon, 'C-003', 'C-006'], ['C-006', 'C-003', 'C-008']], hands: [['234'], []] });
  const o = E.cardAttackOptions(db, st).find((x) => st.players[0].hand[x.hand[0]] === '234' && x.target && x.target.p === 1);
  check('C ほうり上げるで相手を選べる', !!o);
  if (!o) return;
  st = passAll(act(st, o));
  check('C ほうり上げる: 相手がこのターン空中', E.cardMonType(st.players[1].mons[o.target.m], st.turn) === 'air');
  check('C ほうり上げる: 次のターンには戻る', E.cardMonType(st.players[1].mons[o.target.m], st.turn + 1) !== 'air');
});
C('変形: 空中か地上かを選べて、次に変わるまで続く', () => {
  let st = scene({ mons: [[monOf.henger, 'C-003', 'C-006'], ['C-006', 'C-003', 'C-008']], hands: [['185'], []] });
  const opts = E.cardAttackOptions(db, st).filter((x) => st.players[0].hand[x.hand[0]] === '185');
  const air = opts.find((x) => x.form === 'air');
  check('C 変形で「空中」を選べる', !!air && opts.some((x) => x.form === 'ground'));
  if (!air) return;
  const deck0 = st.players[0].deck.length;
  st = passAll(act(st, air));
  check('C 変形: 空中になり、数ターンたっても空中のまま', E.cardMonType(st.players[0].mons[0], st.turn) === 'air' && E.cardMonType(st.players[0].mons[0], st.turn + 4) === 'air');
  check('C 変形: 山札から1枚引く', st.players[0].deck.length === deck0 - 1);
});
C('ダメージ0の技に、防御を出しても困らない(出せる・0のまま)', () => {
  const atk = cards.find((c) => c.ready && c.kind === 'pow' && (c.damage || 0) === 0 && !E.cardHasEff(c, 'area') && monOf[c.user] && E.cardAttackOptions);
  if (!atk) return;
  const r = tryGuard(byNo('350'), atk);
  if (r.offered) check(`C ダメージ0の技(${atk.name})に防御を出しても、受けるダメージは0`, r.dmg === 0, JSON.stringify(r));
});

console.log(`守りのカード ${guardCards.length}枚・確かめた ${passed + failed}項目`);
if (fails.length) { console.log(`✗ 守りの総点検: ${fails.length} 件`); fails.forEach((f) => console.log(`  ${f}`)); process.exit(1); }
console.log('✓ 守りの総点検: すべてOK');
