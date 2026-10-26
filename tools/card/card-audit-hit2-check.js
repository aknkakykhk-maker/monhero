// MFバトルカードの総点検 A「攻撃の当たり方」の後半(2026-10-27 カード部の割り当て・カード追加部パックくん)。
// 前半(halfOnEvade・noEvade・gutsLossOnHit・stunOnHit・selfDamage*・noBlockReduce)は前のカード部長の受け持ち。
// ここは multVs・cannotHit・onlyHit・drain・returnOnHit・nonLethal・area・split・combo・pair・chain・requires・
// bonusDiscard・bonusLost・takeMult・nextTurnMult の16種類を、「カードの文 → データ(effects)→ 82 の処理」の順に確かめる。
//
//   node tools/card/card-audit-hit2-check.js [--verbose]
//
// 見るもの
//   A. 文とデータ: その部品を持つカード1枚ずつ、文に書いてある数・特徴・名前が effects と合う。文があるのに部品が無いカードも無い
//   B. 1枚ずつ実際に効かせる: 小さな対戦の場面で使い、ダメージ・回復・手札・狙える相手が文のとおり
//   C. 取りこぼしやすい場面: ダメージ0・回避された・防御で0・全員に当たる・2枚同時・割り振り・倒しきる・自分の味方に当たる
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardOf, cardEff, cardHasEff, cardMonType, cardCanTarget };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let failed = 0;
let passed = 0;
const fails = [];
const notes = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else { failed++; fails.push(`${name}${detail ? ` — ${detail}` : ''}`); } };

const cards = Object.values(db.cards);
const withEff = (t) => cards.filter((c) => (c.effects || []).some((e) => e.t === t));
const eff = (c, t) => (c.effects || []).find((e) => e.t === t);
const text = (c) => String(c.text || '').replace(/\s+/g, '');
const monOf = {};
Object.values(db.monsters).forEach((m) => { if (!m.main && !m.variant && !monOf[m.species]) monOf[m.species] = m.no; });
const AIR = monOf.pixie;    // ピクシー(空中)
const AIR2 = monOf.gali;    // ガリ(空中)
const GROUND = monOf.golem; // ゴーレム(地上)
const GROUND2 = monOf.tiger;
// その技を使える子(種族の子・全モンスターならゴーレム)
const userMon = (c) => (c.user === 'any' || c.user === 'breeder' ? GROUND : monOf[c.user]);
// 効果の無い素の技(ガッツの少ない順)
const plain = (sp, kind) => cards.filter((c) => c.ready && c.user === sp && c.kind === kind && !(c.effects || []).length && c.guts > 0 && (c.damage || 0) > 0)
  .sort((a, b) => a.guts - b.guts || (a.no < b.no ? -1 : 1))[0];

// ---- 場面: 0 が攻める側・1 が守る側。相手のライフは big で 40 にできる ----
const scene = ({ mons, hands, guts = [20, 20], big = true, life = null }) => {
  const decks = mons.map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 11, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(guts[i]).fill('100'); pl.discard = []; });
  if (big) st.players.forEach((pl) => pl.mons.forEach((m) => { m.life = 40; m.max = 40; }));
  if (life) life.forEach(([p, m, v]) => { st.players[p].mons[m].life = v; });
  st.active = 0; st.phase = 'main';
  return st;
};
const act = (st, a) => { const n = E.cardApplyAction(db, st, a); if (!n) throw new Error(`だめな操作: ${JSON.stringify(a)}`); return n; };
const passAll = (st) => { for (let i = 0; i < 12 && st.pending; i++) st = act(st, { type: 'pass' }); return st; };
const handNos = (st, o) => o.hand.map((i) => st.players[st.active].hand[i]).sort();
// 手札の番号の組(nos)の手。target … 相手の何体目(null は狙わない手)
const optWith = (st, nos, target, pred = () => true) => E.cardAttackOptions(db, st).find((x) => JSON.stringify(handNos(st, x)) === JSON.stringify(nos.slice().sort())
  && (target === undefined || (target === null ? !x.target : x.target && x.target.p === 1 && x.target.m === target)) && pred(x));
const lives = (st, p) => st.players[p].mons.map((m) => m.life);
const dmgOf = (before, after) => before.map((v, i) => v - after[i]);
// 打って、守りは出さずに終える。返す: { st, dmg:[相手3体の減り], own:[自分3体の減り] }
const hit = (st, a, guard = null) => {
  const l1 = lives(st, 1), l0 = lives(st, 0);
  let s = act(st, a);
  if (guard && s.pending) { const g = E.cardGuardOptions(db, s).find(guard); if (g) s = act(s, g); else return { st: s, noGuard: true }; }
  s = passAll(s);
  return { st: s, dmg: dmgOf(l1, lives(s, 1)), own: dmgOf(l0, lives(s, 0)) };
};
// 守る側の手札 no の回避・防御
const guardBy = (no) => (s) => (g) => s.players[1].hand[g.hand] === no;

// ================= A. 文とデータ =================
const textRules = [
  ['multVs', /この技は(空中|地上)にいるモンスターには(\d+)倍のダメージを与える。/, (c, m, e) => e.type === (m[1] === '空中' ? 'air' : 'ground') && e.n === +m[2]],
  ['cannotHit', /この技は空中にいるモンスターには、?ダメージを与えられない。/, (c, m, e) => e.type === 'air'],
  ['onlyHit', /この技は地上にいるモンスターにしかダメージを与えられない。/, (c, m, e) => e.type === 'ground'],
  ['drain', /この技で与えたダメージ分、自分のライフを回復する。/, () => true],
  ['returnOnHit', /ダメージを与えた場合、このカードは捨て札にならずに手札に戻る。/, () => true],
  ['nonLethal', /ライフを0にしてはならない。/, () => true],
  ['split', /複数の相手モンスターに割り振れる。/, () => true],
  ['pair', /「(.+?)」は2枚同時に使用できる。2枚なら(\d+)のダメージ/, (c, m, e) => m[1] === c.name && e.dmg === +m[2]],
  ['bonusDiscard', /捨て札の中にある、「(.+?)」の技カード枚数だけ/, (c, m, e) => db.monsters[monOf[e.user]] && db.monsters[monOf[e.user]].name === m[1]],
  ['bonusLost', /ライフの減少分だけ、この技のダメージにプラスする。/, () => true],
];
textRules.forEach(([t, re, ok]) => {
  const list = withEff(t);
  check(`A ${t}: 部品を持つカードがある`, list.length > 0);
  list.forEach((c) => { const m = text(c).match(re); check(`A ${t} ${c.no} ${c.name}: 文と部品が合う`, !!m && ok(c, m, eff(c, t)), text(c)); });
});
// area: 文の「相手」「自分以外」「地上/空中」が who・only と合う
withEff('area').forEach((c) => {
  const e = eff(c, 'area'); const s = text(c);
  if (c.no === '227') { check('A area 227: コンビネーションは相手全員', e.who === 'enemies' && !e.only); return; }
  const only = /地上にいる/.test(s) ? 'ground' : /空中にいる/.test(s) ? 'air' : undefined;
  const who = /自分以外の全ての/.test(s) ? 'others' : /全ての相手モンスター/.test(s) ? 'enemies' : null;
  check(`A area ${c.no} ${c.name}: 文と部品(だれに・特徴)が合う`, e.who === who && e.only === only, `${JSON.stringify(e)} / ${s}`);
});
// combo: 名前と表が文のとおり
withEff('combo').forEach((c) => {
  const e = eff(c, 'combo'); const s = text(c);
  const names = [...s.matchAll(/「(.+?)」/g)].map((m) => m[1]);
  const t2 = s.match(/2種類なら(\d+)/); const t3 = s.match(/3種類なら(\d+)/);
  check(`A combo ${c.no} ${c.name}: 名前と表が文のとおり`, names.every((n) => e.names.includes(n)) && e.names.includes(c.name) && e.names.length === names.length + 1
    && (!t2 || e.table[2] === +t2[1]) && (!t3 || e.table[3] === +t3[1]) && Object.keys(e.table).length === [t2, t3].filter(Boolean).length, JSON.stringify(e));
});
// chain: 名前が文のとおり
withEff('chain').forEach((c) => {
  const e = eff(c, 'chain'); const names = [...text(c).matchAll(/「(.+?)」/g)].map((m) => m[1]);
  check(`A chain ${c.no} ${c.name}: 名前が文のとおり`, JSON.stringify(e.names.slice().sort()) === JSON.stringify(names.slice().sort()) && names.includes(c.name), JSON.stringify(e));
});
// requires: 名前が文のとおり
withEff('requires').forEach((c) => {
  const e = eff(c, 'requires'); const names = [...text(c).matchAll(/「(.+?)」/g)].map((m) => m[1]);
  check(`A requires ${c.no}: 名前が文のとおり`, e.names.every((n) => names.includes(n)) && e.names.length === 2);
});
// takeMult・nextTurnMult: 倍の数と技の種類
withEff('takeMult').forEach((c) => { const e = eff(c, 'takeMult'); const m = text(c).match(/受けるダメージは(\d+)倍/); check(`A takeMult ${c.no}: 倍の数`, m && e.n === +m[1] && JSON.stringify(e.kinds) === JSON.stringify(['pow'])); });
withEff('nextTurnMult').forEach((c) => {
  const e = eff(c, 'nextTurnMult'); const s = text(c);
  const m = s.match(/次のターン[^。]*?(\d+)倍/);
  const kinds = /ちから技か、かしこさ技/.test(s) ? ['pow', 'int'] : ['pow'];
  check(`A nextTurnMult ${c.no} ${c.name}: 倍の数と種類`, m && e.n === +m[1] && JSON.stringify(e.kinds) === JSON.stringify(kinds), `${JSON.stringify(e)} / ${s}`);
});
// 文に「〜倍」「割り振れる」などがあるのに、部品が付いていないカード(取りこぼし)
cards.filter((c) => c.ready).forEach((c) => {
  const s = text(c);
  if (/にいるモンスターには\d+倍/.test(s)) check(`A ${c.no} ${c.name}: 「〜倍」の文に multVs がある`, !!eff(c, 'multVs'));
  if (/ダメージを与えられない/.test(s)) check(`A ${c.no} ${c.name}: 「与えられない」の文に cannotHit/onlyHit がある`, !!(eff(c, 'cannotHit') || eff(c, 'onlyHit')));
  if (/全ての(相手)?モンスターにダメージ|全ての(地上|空中)にいる|にいる全ての相手/.test(s)) check(`A ${c.no} ${c.name}: 全員に当たる文に area がある`, !!eff(c, 'area'));
  if (/同一ターンに連続して/.test(s)) check(`A ${c.no} ${c.name}: 連続の文に chain がある`, !!eff(c, 'chain'));
});

// ================= B・C. 実際に効かせる =================
const atkScene = (c, { oppMons = [GROUND, AIR, GROUND2], myMons = null, hand = null, guts = 20, oppHand = [], big = true, life = null } = {}) => {
  const me = userMon(c);
  return scene({ mons: [myMons || [me, me === GROUND ? GROUND2 : GROUND, AIR2], oppMons], hands: [hand || [c.no], oppHand], guts: [guts, 20], big, life });
};

// multVs: その特徴の子には n 倍、ほかの子にはふつう。回避されたら0・防御で減らすのは倍のあと
withEff('multVs').forEach((c) => {
  const e = eff(c, 'multVs');
  const ty = e.type === 'air' ? AIR : GROUND, other = e.type === 'air' ? GROUND : AIR;
  const st = atkScene(c, { oppMons: [ty, other, GROUND2] });
  const a0 = optWith(st, [c.no], 0), a1 = optWith(st, [c.no], 1);
  check(`B multVs ${c.no}: 両方の特徴の子を狙える`, !!a0 && !!a1);
  if (a0) { const r = hit(st, a0); check(`B multVs ${c.no}: ${e.type} の子に ${c.damage}×${e.n}`, r.dmg[0] === c.damage * e.n, `${r.dmg}`); }
  if (a1) { const r = hit(st, a1); check(`B multVs ${c.no}: ほかの特徴の子にはふつう`, r.dmg[1] === c.damage, `${r.dmg}`); }
  // 防御で −N(踏ん張るなど、−1 の防御)は倍のあとに引く
  const red = cards.find((x) => x.ready && x.kind === 'blk' && x.user === 'any' && eff(x, 'reduce') && eff(x, 'reduce').kinds.includes(c.kind));
  if (red && a0) {
    const st2 = atkScene(c, { oppMons: [ty, other, GROUND2], oppHand: [red.no] });
    const r = hit(st2, optWith(st2, [c.no], 0), guardBy(red.no)(st2));
    if (!r.noGuard) check(`C multVs ${c.no}: 防御の −${eff(red, 'reduce').n} は倍のあと`, r.dmg[0] === Math.max(0, c.damage * e.n - eff(red, 'reduce').n), `${r.dmg}`);
  }
});

// cannotHit・onlyHit: 当たらない子は狙えない。ジャンプなどで当たらない特徴になったら0
[['cannotHit', (e) => (e.type === 'air' ? AIR : GROUND), (e) => (e.type === 'air' ? GROUND : AIR)],
  ['onlyHit', (e) => (e.type === 'ground' ? AIR : GROUND), (e) => (e.type === 'ground' ? GROUND : AIR)]].forEach(([t, bad, good]) => {
  withEff(t).forEach((c) => {
    const e = eff(c, t);
    const st = atkScene(c, { oppMons: [bad(e), good(e), GROUND2] });
    check(`B ${t} ${c.no}: 当たらない特徴の子は狙えない`, !optWith(st, [c.no], 0));
    const a = optWith(st, [c.no], 1);
    check(`B ${t} ${c.no}: 当たる子は狙える`, !!a);
    if (a) { const r = hit(st, a); check(`B ${t} ${c.no}: 当たる子に ${c.damage}`, r.dmg[1] === c.damage && r.dmg[0] === 0, `${r.dmg}`); }
    // 守りで空中になった(ジャンプ: ちから技を回避して空中)場合は回避が先なので0。空中になるだけの守り(吹き上げる)で当たらなくなる
    const lift = cards.find((x) => x.ready && eff(x, 'liftAllies'));
    if (lift && t === 'cannotHit') {
      const lm = monOf[lift.user];
      const st2 = atkScene(c, { oppMons: [GROUND, lm, GROUND2], oppHand: [lift.no] });
      const a2 = optWith(st2, [c.no], 0);
      if (a2) { const r = hit(st2, a2, (g) => st2.players[1].hand[g.hand] === lift.no); if (!r.noGuard) check(`C ${t} ${c.no}: 吹き上げるで空中になった子には0`, r.dmg[0] === 0, `${r.dmg}`); }
    }
  });
});

// drain: 与えたぶん回復(最大まで)。回避されて0・防御で0なら回復しない
withEff('drain').forEach((c) => {
  const st = atkScene(c, { life: [[0, 0, 30]] });
  const a = optWith(st, [c.no], 0);
  check(`B drain ${c.no}: 出せる`, !!a);
  if (!a) return;
  const r = hit(st, a);
  check(`B drain ${c.no}: 与えた ${c.damage} だけ回復`, r.dmg[0] === c.damage && r.st.players[0].mons[0].life === 30 + c.damage, `${r.dmg} / ${r.st.players[0].mons[0].life}`);
  const st2 = atkScene(c, { life: [[0, 0, 39]] });
  const r2 = hit(st2, optWith(st2, [c.no], 0));
  check(`C drain ${c.no}: 最大を超えて回復しない`, r2.st.players[0].mons[0].life === 40);
  const ev = cards.find((x) => x.ready && x.kind === 'dge' && x.user === 'any' && eff(x, 'evade') && eff(x, 'evade').kinds.includes(c.kind) && !eff(x, 'evade').minGuts);
  if (ev) {
    const st3 = atkScene(c, { life: [[0, 0, 30]], oppHand: [ev.no] });
    const r3 = hit(st3, optWith(st3, [c.no], 0), guardBy(ev.no)(st3));
    if (!r3.noGuard) check(`C drain ${c.no}: 回避されたら回復しない`, r3.dmg[0] === 0 && r3.st.players[0].mons[0].life === 30);
  }
  // 倒しきったとき: いまの作りは、相手の残りライフにかかわらず書いてある数ぶん回復する(「与えたダメージ分」を、減ったライフと読むなら1)。
  // 読み方を部長に聞いている(2026-10-27)。決まるまでは注記だけ出す
  const st4 = atkScene(c, { life: [[0, 0, 30], [1, 0, 1]] });
  const r4 = hit(st4, optWith(st4, [c.no], 0));
  notes.push(`drain ${c.no} ${c.name}: 残りライフ1の子を倒したときの回復は ${r4.st.players[0].mons[0].life - 30}(減ったライフで数えるなら1)`);
});

// returnOnHit: 当てたら手札へ。回避されて0なら捨て札へ
withEff('returnOnHit').forEach((c) => {
  const st = atkScene(c);
  const a = optWith(st, [c.no], 0);
  check(`B returnOnHit ${c.no}: 出せる`, !!a);
  if (!a) return;
  const r = hit(st, a);
  check(`B returnOnHit ${c.no}: 当てたら手札に戻る`, r.dmg[0] === c.damage && r.st.players[0].hand.includes(c.no) && !r.st.players[0].discard.includes(c.no));
  const ev = cards.find((x) => x.ready && x.kind === 'dge' && x.user === 'any' && eff(x, 'evade') && eff(x, 'evade').kinds.includes(c.kind) && !eff(x, 'evade').minGuts);
  if (ev) {
    const st2 = atkScene(c, { oppHand: [ev.no] });
    const r2 = hit(st2, optWith(st2, [c.no], 0), guardBy(ev.no)(st2));
    if (!r2.noGuard) check(`C returnOnHit ${c.no}: 回避されたら捨て札へ`, !r2.st.players[0].hand.includes(c.no) && r2.st.players[0].discard.includes(c.no));
  }
});

// nonLethal(加勢): ライフ1までしか減らさない。ライフ1の子には0
withEff('nonLethal').forEach((c) => {
  const st = atkScene(c, { big: false, life: [[1, 0, c.damage]] });
  const a = E.cardAttackOptions(db, st).find((x) => st.players[0].hand[x.hand[0]] === c.no && x.target && x.target.p === 1 && x.target.m === 0);
  check(`B nonLethal ${c.no}: 出せる`, !!a);
  if (!a) return;
  const r = hit(st, a);
  check(`B nonLethal ${c.no}: 倒せるダメージでもライフ1で残る`, r.st.players[1].mons[0].life === 1 && !r.st.players[1].mons[0].ko, `${r.st.players[1].mons[0].life}`);
  const st2 = atkScene(c, { big: false, life: [[1, 0, 1]] });
  const a2 = E.cardAttackOptions(db, st2).find((x) => st2.players[0].hand[x.hand[0]] === c.no && x.target && x.target.m === 0);
  if (a2) { const r2 = hit(st2, a2); check(`C nonLethal ${c.no}: ライフ1の子は1のまま`, r2.st.players[1].mons[0].life === 1 && !r2.st.players[1].mons[0].ko); }
});

// area: だれに当たるか(相手全員/自分以外の全員/地上・空中だけ)。1体ずつ守れる。全員倒したら勝ち
withEff('area').filter((c) => !eff(c, 'requires')).forEach((c) => {
  const e = eff(c, 'area');
  const me = userMon(c);
  const myMons = [me, me === GROUND ? GROUND2 : GROUND, AIR2];
  const oppMons = [GROUND, AIR, GROUND2];
  const st = atkScene(c, { myMons, oppMons });
  const a = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === c.no);
  check(`B area ${c.no} ${c.name}: 出せる`, !!a);
  if (!a) return;
  const r = hit(st, a);
  const hits = (p, m) => {
    const mon = st.players[p].mons[m];
    if (p === 0 && m === 0) return false;           // 自分は当たらない
    if (p === 0 && e.who === 'enemies') return false; // 味方に当たるのは「自分以外の全て」だけ
    const ty = E.cardMonType(mon, st.turn);
    if (e.only && ty !== e.only) return false;
    if (E.cardEff(c, 'cannotHit') && ty === E.cardEff(c, 'cannotHit').type) return false;
    return true;
  };
  const want1 = [0, 1, 2].map((m) => (hits(1, m) ? c.damage : 0));
  const want0 = [0, 1, 2].map((m) => (hits(0, m) ? c.damage : 0));
  check(`B area ${c.no} ${c.name}: 相手に当たる子と数が文のとおり`, JSON.stringify(r.dmg) === JSON.stringify(want1), `相手 ${r.dmg} / 見込み ${want1}`);
  check(`B area ${c.no} ${c.name}: 味方に当たる子が文のとおり`, JSON.stringify(r.own) === JSON.stringify(want0), `味方 ${r.own} / 見込み ${want0}`);
  // 1体ずつ守れる: 当たる最初の子だけ回避すると、その子だけ0
  const first = [0, 1, 2].find((m) => hits(1, m));
  const ev = cards.find((x) => x.ready && x.kind === 'dge' && x.user === 'any' && eff(x, 'evade') && eff(x, 'evade').kinds.includes(c.kind) && !eff(x, 'evade').minGuts);
  if (ev && first !== undefined) {
    const st2 = atkScene(c, { myMons, oppMons, oppHand: [ev.no] });
    let s = act(st2, E.cardAttackOptions(db, st2).find((x) => x.mon === 0 && st2.players[0].hand[x.hand[0]] === c.no));
    const l1 = lives(st2, 1);
    const g = s.pending && E.cardGuardOptions(db, s).find((x) => s.players[1].hand[x.hand] === ev.no);
    if (g && s.pending.targets[s.pending.ti].m === first) {
      s = passAll(act(s, g));
      const d = dmgOf(l1, lives(s, 1));
      const half = eff(c, 'halfOnEvade') ? Math.ceil(c.damage / 2) : 0;
      check(`C area ${c.no}: 回避した子だけ減らない(ほかの子には当たる)`, d[first] === half && d.every((v, m) => m === first || v === want1[m]), `${d}`);
    }
  }
  // 全員を倒しきると勝ち(相手のライフを技のダメージ以下にして、当たる子しかいない場面)
  if (!e.only && e.who === 'enemies') {
    const st3 = atkScene(c, { myMons, oppMons: [GROUND, GROUND2, monOf.mocchi], big: false, life: [[1, 0, 1], [1, 1, 1], [1, 2, 1]] });
    const a3 = E.cardAttackOptions(db, st3).find((x) => x.mon === 0 && st3.players[0].hand[x.hand[0]] === c.no);
    if (a3) { const r3 = hit(st3, a3); check(`C area ${c.no}: 全員倒したら勝ち`, r3.st.winner === 0, `勝ち ${r3.st.winner}`); }
  }
});

// split(ショットガン): 割り振りの合計が書いてある数。1体ずつ守れる。倒した子の分は無駄になる
withEff('split').forEach((c) => {
  const st = atkScene(c);
  const os = E.cardAttackOptions(db, st).filter((x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === c.no);
  check(`B split ${c.no}: 割り振りの手がある`, os.length > 1 && os.every((x) => Array.isArray(x.split) && x.split.reduce((s, v) => s + v, 0) === c.damage), `${os.length}`);
  const spread = os.find((x) => x.split.filter((v) => v > 0).length === Math.min(3, c.damage));
  if (spread) { const r = hit(st, spread); check(`B split ${c.no}: 割り振ったとおりに当たる`, JSON.stringify(r.dmg) === JSON.stringify(spread.split), `${r.dmg} / ${spread.split}`); }
  // 空中にいるだけの子にも割り振れる(特徴の縛りは無い)・KO の子には割り振れない
  const st2 = atkScene(c); st2.players[1].mons[1].ko = true; st2.players[1].mons[1].life = 0;
  const os2 = E.cardAttackOptions(db, st2).filter((x) => x.mon === 0 && st2.players[0].hand[x.hand[0]] === c.no);
  check(`C split ${c.no}: KO の子には割り振らない`, os2.length > 0 && os2.every((x) => x.split[1] === 0));
  // 1体だけ回避: その子の分だけ0
  const ev = cards.find((x) => x.ready && x.kind === 'dge' && x.user === 'any' && eff(x, 'evade') && eff(x, 'evade').kinds.includes(c.kind) && !eff(x, 'evade').minGuts);
  if (ev && spread) {
    const st3 = atkScene(c, { oppHand: [ev.no] });
    const sp = E.cardAttackOptions(db, st3).find((x) => JSON.stringify(x.split) === JSON.stringify(spread.split));
    let s = act(st3, sp); const l1 = lives(st3, 1);
    const firstM = s.pending.targets[s.pending.ti].m;
    const g = E.cardGuardOptions(db, s).find((x) => s.players[1].hand[x.hand] === ev.no);
    if (g) { s = passAll(act(s, g)); const d = dmgOf(l1, lives(s, 1)); check(`C split ${c.no}: 回避した子の分だけ0`, d[firstM] === 0 && d.every((v, m) => m === firstM || v === spread.split[m]), `${d}`); }
  }
});

// combo: 1枚なら書いてある数・2種類・3種類なら表の数。同じ名前を2枚は組にならない
withEff('combo').forEach((c) => {
  const e = eff(c, 'combo');
  const others = e.names.filter((n) => n !== c.name).map((n) => cards.find((x) => x.user === c.user && x.name === n));
  const st1 = atkScene(c);
  const a1 = optWith(st1, [c.no], 0);
  if (a1) { const r = hit(st1, a1); check(`B combo ${c.no}: 1枚なら ${c.damage}`, r.dmg[0] === c.damage, `${r.dmg}`); }
  if (others[0]) {
    const st2 = atkScene(c, { hand: [c.no, others[0].no] });
    const a2 = optWith(st2, [c.no, others[0].no], 0);
    check(`B combo ${c.no}+${others[0].no}: 2種類の手がある`, !!a2);
    if (a2) { const r = hit(st2, a2); check(`B combo ${c.no}: 2種類で ${e.table[2]}`, r.dmg[0] === e.table[2], `${r.dmg}`); }
  }
  if (others.length >= 2 && e.table[3]) {
    const st3 = atkScene(c, { hand: [c.no, others[0].no, others[1].no] });
    const a3 = optWith(st3, [c.no, others[0].no, others[1].no], 0);
    check(`B combo ${c.no}: 3種類の手がある`, !!a3);
    if (a3) { const r = hit(st3, a3); check(`B combo ${c.no}: 3種類で ${e.table[3]}`, r.dmg[0] === e.table[3], `${r.dmg}`); }
  }
  const st4 = atkScene(c, { hand: [c.no, c.no] });
  check(`C combo ${c.no}: 同じ名前の2枚は組にならない`, !optWith(st4, [c.no, c.no], 0));
});

// pair: 1枚ならふつう・2枚同時なら決まった数。払うガッツは2枚分
withEff('pair').forEach((c) => {
  const e = eff(c, 'pair');
  const st = atkScene(c, { hand: [c.no, c.no], guts: c.guts * 2 });
  const a2 = optWith(st, [c.no, c.no], 0);
  check(`B pair ${c.no}: 2枚同時の手がある(ガッツ ${c.guts * 2} ちょうど)`, !!a2);
  if (a2) { const r = hit(st, a2); check(`B pair ${c.no}: 2枚で ${e.dmg}`, r.dmg[0] === e.dmg && r.st.players[0].guts.length === 0, `${r.dmg}`); }
  const st1 = atkScene(c, { hand: [c.no, c.no], guts: c.guts * 2 - 1 });
  check(`C pair ${c.no}: ガッツが2枚分ないと2枚同時は出せない`, !optWith(st1, [c.no, c.no], 0));
  // 2枚同時を回避されたら0(半分の文は無い)
  const ev = cards.find((x) => x.ready && x.kind === 'dge' && x.user === 'any' && eff(x, 'evade') && eff(x, 'evade').kinds.includes(c.kind) && !eff(x, 'evade').minGuts);
  if (ev && a2) {
    const st3 = atkScene(c, { hand: [c.no, c.no], guts: c.guts * 2, oppHand: [ev.no] });
    const r = hit(st3, optWith(st3, [c.no, c.no], 0), guardBy(ev.no)(st3));
    if (!r.noGuard) check(`C pair ${c.no}: 2枚同時を回避されたら0`, r.dmg[0] === 0);
  }
});

// chain: 同じターンに続けて出せる(名前の札どうし)。ほかの技は続けて出せない
withEff('chain').forEach((c) => {
  const e = eff(c, 'chain');
  const next = e.names.map((n) => cards.find((x) => x.user === c.user && x.name === n));
  const pl = plain(c.user, c.kind === 'int' ? 'pow' : 'int') || plain(c.user, 'pow');
  next.forEach((n) => {
    if (!n) return;
    const hand = n.no === c.no ? [c.no, c.no] : [c.no, n.no];
    let st = atkScene(c, { hand: pl ? [...hand, pl.no] : hand });
    const a = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && x.hand.length === 1 && st.players[0].hand[x.hand[0]] === c.no && x.target && x.target.m === 0);
    if (!a) { check(`B chain ${c.no}: 出せない`, false); return; }
    st = hit(st, a).st;
    const b = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === n.no);
    check(`B chain ${c.no}→${n.no} ${n.name}: 続けて出せる`, !!b);
    if (pl && pl.name !== c.name && !e.names.includes(pl.name)) check(`C chain ${c.no}: ほかの技(${pl.name})は続けて出せない`, !E.cardAttackOptions(db, st).some((x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === pl.no));
  });
});

// requires(コンビネーション): 決まった札がそろうときだけ。払うのは主の札のガッツだけ。相手全員に書いてある数
withEff('requires').forEach((c) => {
  const e = eff(c, 'requires');
  const parts = e.names.map((n) => cards.find((x) => x.user === c.user && x.name === n));
  check(`B requires ${c.no}: 決まった札がある`, parts.every(Boolean));
  if (!parts.every(Boolean)) return;
  const st = atkScene(c, { hand: [c.no, ...parts.map((x) => x.no)], guts: c.guts });
  const a = E.cardAttackOptions(db, st).find((x) => st.players[0].hand[x.hand[0]] === c.no);
  check(`B requires ${c.no}: そろえば主のガッツ ${c.guts} だけで出せる`, !!a && a.hand.length === 3);
  if (a) { const r = hit(st, a); check(`B requires ${c.no}: 相手全員に ${c.damage}`, r.dmg.every((v) => v === c.damage) && r.st.players[0].guts.length === 0, `${r.dmg}`); }
  const st2 = atkScene(c, { hand: [c.no, parts[0].no] });
  check(`C requires ${c.no}: 1枚欠けたら出せない`, !E.cardAttackOptions(db, st2).some((x) => st2.players[0].hand[x.hand[0]] === c.no));
});

// bonusDiscard(魔神ファイナル): 捨て札にあるその種族の攻撃の技の数を足す(使う前の捨て札・払ったガッツは数えない)
withEff('bonusDiscard').forEach((c) => {
  const e = eff(c, 'bonusDiscard');
  const atk = cards.filter((x) => x.user === e.user && ['pow', 'int', 'spe'].includes(x.kind) && x.no !== c.no).slice(0, 3).map((x) => x.no);
  const grd = cards.find((x) => x.user === e.user && ['dge', 'blk'].includes(x.kind));
  const other = plain('golem', 'pow');
  const st = atkScene(c);
  st.players[0].discard = [...atk, grd ? grd.no : '100', other.no];
  st.players[0].guts = Array(c.guts).fill(atk[0]); // 払うガッツがその種族の技でも、使う前の捨て札には入らない
  const a = optWith(st, [c.no], 0);
  check(`B bonusDiscard ${c.no}: 出せる`, !!a);
  if (a) { const r = hit(st, a); check(`B bonusDiscard ${c.no}: 捨て札の ${e.user} の攻撃の技 ${atk.length} 枚を足す`, r.dmg[0] === (c.damage || 0) + atk.length, `${r.dmg}`); }
  const st0 = atkScene(c);
  const a0 = optWith(st0, [c.no], 0);
  if (a0) { const r = hit(st0, a0); check(`C bonusDiscard ${c.no}: 捨て札が無ければ ${c.damage || 0}`, r.dmg[0] === (c.damage || 0)); }
});

// bonusLost(ビッグバン): 減ったライフのぶん足す
withEff('bonusLost').forEach((c) => {
  const st = atkScene(c, { life: [[0, 0, 33]] });
  const a = optWith(st, [c.no], 0);
  check(`B bonusLost ${c.no}: 出せる`, !!a);
  if (a) { const r = hit(st, a); check(`B bonusLost ${c.no}: 減ったライフ 7 を足す`, r.dmg[0] === c.damage + 7, `${r.dmg}`); }
});

// takeMult・nextTurnMult(肉を切らせて): ちから技を2倍で受ける。次の自分の番のちから技だけ3倍(かしこさ技は倍にならない)
withEff('takeMult').forEach((c) => {
  const pow = plain('golem', 'pow');
  const st = scene({ mons: [[GROUND, GROUND2, AIR2], [GROUND, GROUND2, AIR]], hands: [[pow.no], [c.no]] });
  let s = act(st, optWith(st, [pow.no], 0));
  const g = E.cardGuardOptions(db, s).find((x) => s.players[1].hand[x.hand] === c.no);
  check(`B takeMult ${c.no}: ちから技に出せる`, !!g);
  if (!g) return;
  s = passAll(act(s, g));
  check(`B takeMult ${c.no}: 2倍で受ける`, s.players[1].mons[0].life === 40 - pow.damage * 2, `${40 - s.players[1].mons[0].life}`);
  const intc = cards.find((x) => x.ready && x.kind === 'int' && !(x.effects || []).length && x.damage > 0 && x.guts > 0 && monOf[x.user]);
  const st2 = scene({ mons: [[monOf[intc.user], GROUND2, AIR2], [GROUND, GROUND2, AIR]], hands: [[intc.no], [c.no]] });
  const s2 = act(st2, optWith(st2, [intc.no], 0));
  check(`C takeMult ${c.no}: かしこさ技には出せない`, !E.cardGuardOptions(db, s2).some((x) => s2.players[1].hand[x.hand] === c.no));
});
// nextTurnMult: 守った子の次の自分の番だけ、文の種類の技が n 倍(1回まで)。ほかの種類はそのまま
withEff('nextTurnMult').forEach((c) => {
  const e = eff(c, 'nextTurnMult');
  const me = userMon(c);
  const pow = plain('golem', 'pow');
  const st = scene({ mons: [[GROUND, GROUND2, AIR2], [me, GROUND2, AIR]], hands: [[pow.no], [c.no]] });
  let s = act(st, optWith(st, [pow.no], 0));
  const g = E.cardGuardOptions(db, s).find((x) => s.players[1].hand[x.hand] === c.no);
  check(`B nextTurnMult ${c.no} ${c.name}: ちから技に出せる`, !!g);
  if (!g) return;
  s = passAll(act(s, g));
  // 相手(1)の番へ: ガッツの段を終えて番を渡す
  s = act(s, { type: 'endAttacks' }); s = act(s, { type: 'guts', hand: [] });
  check(`B nextTurnMult ${c.no}: 番が替わる`, s.active === 1 && s.phase === 'main', `${s.active} ${s.phase}`);
  if (s.active !== 1 || s.phase !== 'main') return;
  const mine = (kind) => cards.filter((x) => x.ready && x.user === s.players[1].mons[0].species && x.kind === kind && !(x.effects || []).length && x.guts > 0 && x.damage > 0)[0];
  const testKinds = ['pow', 'int'];
  testKinds.forEach((kind) => {
    const k = mine(kind);
    if (!k) return;
    const s2 = JSON.parse(JSON.stringify(s));
    s2.players[1].hand = [k.no, k.no]; s2.players[1].guts = Array(20).fill('100');
    s2.players[0].mons.forEach((m) => { m.life = 40; m.max = 40; });
    const opts = E.cardAttackOptions(db, s2).filter((x) => x.mon === 0 && x.hand.length === 1 && x.target && x.target.p === 0 && x.target.m === 0);
    if (!opts.length) { check(`B nextTurnMult ${c.no}: ${kind} の技を出せない`, false); return; }
    let s3 = passAll(act(s2, opts[0]));
    const d1 = 40 - s3.players[0].mons[0].life;
    const want = e.kinds.includes(kind) ? k.damage * e.n : k.damage;
    check(`B nextTurnMult ${c.no}: 次の番の ${kind} の技は ${e.kinds.includes(kind) ? `${e.n}倍` : 'そのまま'}`, d1 === want, `${d1} / ${want}`);
  });
});

// ---- まとめ ----
if (VERBOSE || failed) fails.forEach((f) => console.log(`NG: ${f}`));
notes.forEach((n) => console.log(`注記: ${n}`));
if (failed) { console.log(`✗ 総点検A(当たり方・後半): ${failed} 件(確かめた ${passed + failed} 件)`); process.exit(1); }
console.log(`✓ 総点検A(当たり方・後半): ${passed} 件すべて OK`);
