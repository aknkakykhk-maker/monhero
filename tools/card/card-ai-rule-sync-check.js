// MFバトルカード: 助手(CPU)の見込みが、いまのルールの結果と合っているか(2026-10-27 ソランド部長の割り振り・カード部ルールくん)。
// ルールを直しても、助手の点の付け方が古いままだと損な手を選ぶ。場面を作り、助手の見込みと、実際にルールで動かした結果を突き合わせる。
// ブラウザなしで 82 を動かす。
//
//   node tools/card/card-ai-rule-sync-check.js [--verbose]
//
// 見るもの
//   G. 守りの札1枚ずつ: 助手の見込み(cardAiGuardEstimate)の「受けるダメージ」「はね返すダメージ」が、出して動かした結果と同じ
//      (回避・−N・半分・0・カウンター(半分返して残りを受ける)・根性。防御でマイナスされない技・全体カードの足し引きのときも)
//   P. みんな下がれ: 一緒に回避できると見込んだ味方の数が、実際に回避した数と同じ(純血のプライド・純血のスピードのときも)
//   E. 回避の見込み(手札が見える強さ): 回避されると見込むのは、相手が本当に回避の札を出せるときだけ
//      (純血のプライド・集中・全体カードで変わる「そのとき払うガッツ」)
//   D. ドレイン: 回復の見込みは、減っている自分のライフまで(満タンなら点が上がらない)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardOf, cardEff, cardHasEff, cardIsHybridMon, cardAiGuardEstimate, cardAiIncomingDamage, cardAiEvadeAllCovers, cardAiEvadeChance, cardAiScoreAttack, cardAiPolicy, cardAttachMods };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const cards = Object.values(db.cards).filter((c) => c.ready);
const mons = Object.values(db.monsters);
const pureOf = (sp) => (mons.find((m) => m.species === sp && !m.main && !m.variant) || {}).no;
const hybridWith = (f) => mons.find((m) => m.main && m.sub && m.sub !== 'unknown' && !m.variant && f(m));
const userMon = (c) => (c.user === 'any' ? pureOf('golem') : pureOf(c.user));
const field = (no) => ({ no, p: 0, effects: db.cards[no].effects });

// 場面: 攻める側(0)の1体目が atk を、守る側(1)は guard を手札に持つ。field … 場の全体カード
const scene = ({ atkMons, defMons, atkHand, defHand, fieldNo = null, life = null }) => {
  const decks = [{ monsters: atkMons, cards: Array(50).fill('100') }, { monsters: defMons, cards: Array(50).fill('100') }];
  let st = E.cardCreateGame(db, { decks, seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players[0].hand = atkHand.slice(); st.players[1].hand = defHand.slice();
  st.players.forEach((pl) => { pl.guts = Array(10).fill('100'); });
  if (life) life.forEach(([p, m, v]) => { st.players[p].mons[m].life = v; });
  st.active = 0; st.phase = 'main';
  if (fieldNo) st.field = field(fieldNo);
  return st;
};
const attack = (st, pick = (o) => o.mon === 0 && o.hand.length === 1) => { const o = E.cardAttackOptions(db, st).find(pick); return o ? E.cardApplyAction(db, st, o) : null; };
// いま狙われている子の結果が決まるまで進める(守る側はそれ以上出さない)
const resolveThis = (st) => { const ti = st.pending ? st.pending.ti : -1; let n = st; for (let i = 0; n && n.pending && n.pending.ti === ti && i < 20; i++) n = E.cardApplyAction(db, n, { type: 'pass' }); return n; };

// ---- G. 守りの札1枚ずつ ----
const plain = (kind) => cards.find((c) => c.kind === kind && c.user !== 'any' && c.user !== 'breeder' && (c.damage || 0) >= 4 && c.guts >= 2 && !(c.effects || []).length && userMon(c));
const GUARD_T = ['evade', 'reduce', 'reduceHalf', 'reduceAll', 'reflect', 'endure'];
const guards = cards.filter((c) => (c.effects || []).some((e) => GUARD_T.includes(e.t)) && userMon(c) && c.user !== 'breeder');
const attacks = [['ちから技', plain('pow')], ['かしこさ技', plain('int')], ['防御でマイナスされない技', cards.find((c) => c.no === '325')]];
const fieldsG = [null, 'F116', 'F117'];
let gCount = 0;
attacks.forEach(([aname, atk]) => {
  if (!atk) { check(`G 材料: ${aname}`, false); return; }
  guards.forEach((g) => fieldsG.forEach((fno) => {
    const lifeLow = g.effects.some((e) => e.t === 'endure');
    let st = scene({ atkMons: [userMon(atk), pureOf('dino'), pureOf('hare')], defMons: [userMon(g), pureOf('dino'), pureOf('hare')], atkHand: [atk.no], defHand: [g.no], fieldNo: fno, life: lifeLow ? [[1, 0, 2]] : null });
    st = attack(st, (o) => o.mon === 0 && o.hand.length === 1 && (!o.target || o.target.m === 0));
    if (!st || !st.pending) return;
    const o = E.cardGuardOptions(db, st).find((x) => st.players[1].hand[x.hand] === g.no && x.mon === 0);
    if (!o) return; // その技には出せない守り
    const life0 = st.players[1].mons[0].life; const atkLife0 = st.players[0].mons[0].life;
    const inc = E.cardAiIncomingDamage(db, st);
    const est = E.cardAiGuardEstimate(db, st, o, inc);
    const after = resolveThis(E.cardApplyAction(db, st, o));
    const real = { dmg: life0 - after.players[1].mons[0].life, back: atkLife0 - after.players[0].mons[0].life };
    const passed0 = resolveThis(E.cardApplyAction(db, st, { type: 'pass' }));
    const realPass = life0 - passed0.players[1].mons[0].life;
    gCount++;
    const tag = `${aname} ${atk.no}${fno ? `・${db.cards[fno].name}` : ''} → ${g.no} ${g.name}`;
    // 実際に減るのは残りライフまで(点の付け方も Math.min(…, target.life) で使う)
    const cap = (v) => Math.min(v, life0);
    check(`G ${tag}: 受けるダメージの見込み`, cap(est.after) === real.dmg, `見込み ${est.after}・実際 ${real.dmg}`);
    check(`G ${tag}: はね返すダメージの見込み`, est.back === real.back, `見込み ${est.back}・実際 ${real.back}`);
    check(`G ${tag}: 守らないときの見込み`, cap(inc) === realPass, `見込み ${inc}・実際 ${realPass}`);
  }));
});
check('G 突き合わせた場面がある', gCount >= 30, `${gCount} 場面`);

// ---- P. みんな下がれ ----
const AREA = '104'; const EVADE_ALL = '123'; const SPEED = cards.find((c) => (c.effects || []).some((e) => e.t === 'attachNoEvadeHybrid'));
const hyA = hybridWith((m) => m.main !== 'mocchi'); const hyB = hybridWith((m) => m.main !== 'mocchi' && m.species !== hyA.species);
const hyMocchi = hybridWith((m) => m.main === 'mocchi');
[
  ['プライドあり・純血が攻める', [pureOf('mocchi'), pureOf('dino'), pureOf('hare')], 'F255', false],
  ['プライドなし', [pureOf('mocchi'), pureOf('dino'), pureOf('hare')], null, false],
  ['プライドあり・派生が攻める', [hyMocchi.no, pureOf('dino'), pureOf('hare')], 'F255', false],
  ['純血のスピード', [pureOf('mocchi'), pureOf('dino'), pureOf('hare')], null, true],
].forEach(([name, atkMons, fno, speed]) => {
  [[pureOf('golem'), hyA.no, hyB.no], [hyA.no, pureOf('golem'), hyB.no]].forEach((defMons, k) => {
    let st = scene({ atkMons, defMons, atkHand: speed ? [AREA, SPEED.no] : [AREA], defHand: [EVADE_ALL], fieldNo: fno });
    st = attack(st, (o) => o.mon === 0 && o.hand.length === (speed ? 2 : 1));
    for (let i = 0; st && st.pending && i < 10; i++) {
      const o = E.cardGuardOptions(db, st).find((x) => st.players[1].hand[x.hand] === EVADE_ALL);
      if (!o) { st = resolveThis(E.cardApplyAction(db, st, { type: 'pass' })); continue; }
      const pd = st.pending;
      const covers = E.cardAiEvadeAllCovers(st, pd);
      const rest = pd.targets.slice(pd.ti + 1).map((t) => t.m);
      const life0 = st.players[1].mons.map((m) => m.life);
      let n = E.cardApplyAction(db, st, o);
      for (let j = 0; n && n.pending && j < 20; j++) n = E.cardApplyAction(db, n, { type: 'pass' });
      const realCovers = rest.filter((m) => life0[m] - n.players[1].mons[m].life === 0).length;
      check(`P ${name}・並び${k + 1}: 一緒に回避できる味方の数の見込み`, covers === realCovers, `見込み ${covers}・実際 ${realCovers}`);
      break;
    }
  });
});

// ---- E. 回避の見込み ----
const level = { readHand: true };
const evadePow = cards.find((c) => c.kind === 'dge' && (c.effects || []).some((e) => e.t === 'evade' && e.kinds.includes('pow') && !e.minGuts) && c.user === 'any');
const evade0 = cards.find((c) => c.kind === 'dge' && c.guts === 0 && (c.effects || []).some((e) => e.t === 'evade' && e.kinds.includes('pow') && !e.minGuts) && c.user !== 'breeder');
const powM = cards.find((c) => c.kind === 'pow' && c.user === 'mocchi' && !(c.effects || []).length && (c.damage || 0) >= 2);
check('E 材料がそろう', !!(evadePow && evade0 && powM), JSON.stringify([evadePow && evadePow.no, evade0 && evade0.no, powM && powM.no]));
const evadeCase = (name, { atkMons, defMons, defHand, atkHand = [powM.no], fieldNo = null, pickLen = 1, guts = 10 }) => {
  let st = scene({ atkMons, defMons, atkHand, defHand, fieldNo });
  st.players[1].guts = Array(guts).fill('100');
  const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && x.hand.length === pickLen && x.target && x.target.m === 0);
  if (!o) { check(`E ${name}: 場面が作れる`, false); return; }
  const handCards = o.hand.map((i) => E.cardOf(db, st.players[0].hand[i]));
  const mods = E.cardAttachMods(handCards);
  const chance = E.cardAiEvadeChance(db, st, 0, handCards[0], o.target, level, mods.flags, st.players[0].mons[0]);
  const n = E.cardApplyAction(db, st, o);
  const can = !!n && !!n.pending && E.cardGuardOptions(db, n).some((x) => (E.cardOf(db, n.players[1].hand[x.hand]) || {}).kind === 'dge' && E.cardHasEff(E.cardOf(db, n.players[1].hand[x.hand]), 'evade'));
  check(`E ${name}: 回避の見込み(${chance > 0 ? 'あり' : 'なし'})が、実際に出せるか(${can ? '出せる' : '出せない'})と合う`, (chance > 0) === can);
};
if (evadePow && evade0 && powM) {
  const pm = [pureOf('mocchi'), pureOf('dino'), pureOf('hare')];
  const hm = [hyMocchi.no, pureOf('dino'), pureOf('hare')];
  const evadeUserMon = (c) => (c.user === 'any' ? pureOf('golem') : pureOf(c.user));
  const hyOf = (c) => (c.user === 'any' ? hyA.no : (hybridWith((m) => m.sub === c.user) || {}).no);
  evadeCase('ふつう', { atkMons: pm, defMons: [evadeUserMon(evadePow), pureOf('dino'), pureOf('hare')], defHand: [evadePow.no] });
  evadeCase('プライド・純血が派生を狙う', { atkMons: pm, defMons: [hyA.no, pureOf('dino'), pureOf('hare')], defHand: [evadePow.no], fieldNo: 'F255' });
  evadeCase('プライド・純血が純血を狙う', { atkMons: pm, defMons: [evadeUserMon(evadePow), pureOf('dino'), pureOf('hare')], defHand: [evadePow.no], fieldNo: 'F255' });
  evadeCase('プライド・派生が派生を狙う', { atkMons: hm, defMons: [hyA.no, pureOf('dino'), pureOf('hare')], defHand: [evadePow.no], fieldNo: 'F255' });
  if (hyOf(evade0)) evadeCase('サブの種族の回避(混血)', { atkMons: pm, defMons: [hyOf(evade0), pureOf('dino'), pureOf('hare')], defHand: [evade0.no] });
  evadeCase('集中を付けた技に、払うガッツ0の回避', { atkMons: pm, defMons: [evadeUserMon(evade0), pureOf('dino'), pureOf('hare')], defHand: [evade0.no], atkHand: [powM.no, '274'], pickLen: 2 });
  evadeCase('師匠のまなざしで払えなくなった回避', { atkMons: pm, defMons: [evadeUserMon(evadePow), pureOf('dino'), pureOf('hare')], defHand: [evadePow.no], fieldNo: 'F256', guts: evadePow.guts });
}

// ---- D. ドレイン ----
const drain = cards.find((c) => c.no === '080');
if (drain) {
  const policy = E.cardAiPolicy('kyuko', 'normal');
  const score = (lifeSelf) => {
    const st = scene({ atkMons: [pureOf('naga'), pureOf('dino'), pureOf('hare')], defMons: [pureOf('golem'), pureOf('dino'), pureOf('hare')], atkHand: [drain.no], defHand: [], life: lifeSelf === null ? null : [[0, 0, lifeSelf]] });
    const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && x.hand.length === 1 && x.target && x.target.m === 0);
    return o ? E.cardAiScoreAttack(db, st, o, policy) : null;
  };
  const full = score(null); const hurt = score(1);
  check('D ドレイン: 自分のライフが減っているほうが点が高い', full !== null && hurt !== null && hurt > full, `満タン ${full}・減っている ${hurt}`);
}

if (fails.length) {
  console.error(`助手の見込みとルールの突き合わせ: NG ${fails.length}件(OK ${passed}件)`);
  fails.slice(0, 40).forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`助手の見込みとルールの突き合わせ: OK ${passed}件`);
