// MFバトルカードの総点検 A「攻撃の当たり方」の前半(2026-10-26 社長の急ぎ・カード部の割り当て。後半はパックくんの card-audit-hit2-check.js)。
// 攻撃の技の効果8種類を、「カードの文 → データ(effects)→ 82 の処理」の順に確かめる。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-audit-hit-check.js [--verbose]
//
// 見る効果: halfOnEvade(回避されても半分)・noEvade(回避されない)・gutsLossOnHit(ダメージを与えたら相手のガッツを減らす)・
//   stunOnHit(ダメージを受けた子は次のターン攻撃できない)・selfDamageIfHit(回避されなかったら自分もダメージ)・
//   selfDamage(使ったら自分もダメージ)・selfDamageIfEvaded(回避されたら自分もダメージ)・noBlockReduce(防御でマイナスされない)
// 見るもの
//   A. 文とデータ: 文に書いてある効果と数(ガッツを3減らす・自分は2ダメージ)が effects と合う。逆に、文にあるのにデータが無いカードも無い
//   B. 1枚ずつ実際に効かせる(その技を使える子が、相手の子を狙う場面):
//      ・ふつうに当てる / 回避される / 防御でダメージ0にされる、の3つで、文のとおりに効く・効かない
//      ・「ダメージを与えた場合」「ダメージを受けた」の効果(ガッツを減らす・攻撃できない)は、回避や防御でダメージ0のときは効かない
//      ・「攻撃できない」は、受けた子の持ち主の次のターンに、その子で攻撃できない(その次のターンは攻撃できる)
//   C. 守りを選ぶ画面(cardGuardOptions)と CPU の手(cardAiChooseAction)で、効き目が外れていない
//      ・回避されない技には、回避の札が出せない(画面に出ない)
//      ・回避されても半分の技・防御でマイナスされない技でも、CPU が考えたまま止まらない(手が返る)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardLegalActions, cardOf, cardEff, cardHasEff, cardUsableBy, cardAiChooseAction, cardAiPolicy };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let failed = 0;
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else { failed++; fails.push(`${name}${detail ? ` — ${detail}` : ''}`); } };

const EFFS = ['halfOnEvade', 'noEvade', 'gutsLossOnHit', 'stunOnHit', 'selfDamageIfHit', 'selfDamage', 'selfDamageIfEvaded', 'noBlockReduce'];
const cards = Object.values(db.cards);
const text = (c) => String(c.text || '').replace(/\s+/g, '');
const eff = (c, t) => (c.effects || []).find((e) => e.t === t) || null;
// 技と同時に使う札(付ける札・attach)は、同じ効き目を attach〜 の形で持つ(捨て身・渾身)
const ATTACH_OF = { selfDamageIfHit: 'attachSelfIfHit', noBlockReduce: 'attachNoBlockReduce', noEvade: 'attachNoEvade' };
const effOrAttach = (c, t) => eff(c, t) || (eff(c, 'attach') && ATTACH_OF[t] ? eff(c, ATTACH_OF[t]) : null);

// ================= A. 文とデータ =================
// 文の言い方 → 効果。n を持つものは数(「全て」は 'all')も合わせる
const PHRASES = [
  ['halfOnEvade', /回避されても、?半分のダメージ/],
  ['noEvade', /(?:この技|その(?:ちから|かしこさ)?技)は回避されない/],
  ['gutsLossOnHit', /ダメージを与えた場合、?相手ブリーダーはガッツを(\d+)減らす|ダメージを与えた場合、?相手ブリーダーはガッツを(全て)失う/],
  ['stunOnHit', /この技でダメージを受けたモンスターは、?次のターン攻撃できない/],
  ['selfDamageIfHit', /回避されなかった場合、?自分は(\d+)ダメージ/],
  ['selfDamage', /使用した場合、?自分は(\d+)ダメージ/],
  ['selfDamageIfEvaded', /回避された場合、?自分は(\d+)ダメージ/],
  ['noBlockReduce', /防御によってダメージをマイナスされない/],
];
let countA = 0;
cards.forEach((c) => {
  const t = text(c);
  PHRASES.forEach(([k, re]) => {
    const m = t.match(re);
    const e = effOrAttach(c, k);
    if (!m && !e) return;
    countA++;
    check(`A ${c.no} ${c.name}: 文に「${k}」があればデータにもある(逆も)`, !!m === !!e, `文${m ? 'あり' : 'なし'}・データ${e ? 'あり' : 'なし'}`);
    if (m && e && e.n !== undefined) {
      const want = (m[1] || m[2]) === '全て' ? 'all' : Number(m[1] || m[2]);
      check(`A ${c.no} ${c.name}: ${k} の数が文と同じ`, e.n === want, `データ ${e.n} / 文 ${want}`);
    }
  });
});

// ================= B. 1枚ずつ実際に効かせる =================
// 種族 → その種族のふつうのモンスター(混血でない最初の1体)
const monOf = {};
Object.values(db.monsters).forEach((m) => { if (!m.main && !monOf[m.species]) monOf[m.species] = m.no; });
const DEF_MON = 'C-003'; // ゴーレム(地上)。ライフは場面でたっぷりにする
// 守る側の札: どの子でも使える回避・ダメージを0にする防御のうち、その技の種類に効くもの
const guardFor = (kind, t) => cards.find((c) => c.ready && c.user === 'any' && (c.effects || []).some((e) => e.t === t && Array.isArray(e.kinds) && e.kinds.includes(kind)) && (c.effects || []).length === 1);
const scene = ({ atkMon, hands, guts = [10, 10], defMon = DEF_MON }) => {
  const decks = [[atkMon, 'C-001', 'C-005'], [defMon, 'C-001', 'C-005']].map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 11, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(guts[i]).fill('100'); pl.mons.forEach((m) => { m.max = 40; m.life = 40; }); });
  st.active = 0; st.phase = 'main';
  return st;
};
const act = (st, a) => { const n = E.cardApplyAction(db, st, a); if (!n) throw new Error(`だめな操作: ${JSON.stringify(a)}`); return n; };
const passAll = (st) => { for (let i = 0; i < 10 && st.pending; i++) st = act(st, { type: 'pass' }); return st; };
// 技 c で相手の 0 番を狙う。guard: null(守らない)/ 'evade' / 'reduceAll'。返す: { st, offered(守りを出せたか), before }
const attack = (c, guard) => {
  const g = guard ? guardFor(c.kind, guard) : null;
  let st = scene({ atkMon: monOf[c.user], hands: [[c.no], g ? [g.no] : []] });
  const before = { life: st.players[1].mons[0].life, guts: st.players[1].guts.length, self: st.players[0].mons[0].life };
  const opts = E.cardAttackOptions(db, st).filter((o) => [].concat(o.hand)[0] === 0 && o.mon === 0);
  const o = opts.find((x) => x.target && x.target.p === 1 && x.target.m === 0) || opts[0];
  if (!o) return { st, noAttack: true, before };
  st = act(st, o);
  let offered = false;
  if (st.pending && g) {
    const go = E.cardGuardOptions(db, st).find((x) => x.hand === 0 && x.mon === 0);
    if (go) { st = act(st, go); offered = true; }
  }
  st = passAll(st);
  return { st, offered, before, guardCard: g };
};
const after = (r) => ({ dmg: r.before.life - r.st.players[1].mons[0].life, gutsLost: r.before.guts - r.st.players[1].guts.length - (r.offered ? (r.guardCard.guts || 0) : 0), self: r.before.self - r.st.players[0].mons[0].life, stun: r.st.players[1].mons[0].stunTurn });

const targets = cards.filter((c) => c.ready && EFFS.some((k) => eff(c, k)) && monOf[c.user]);
let countB = 0;
targets.forEach((c) => {
  const plain = attack(c, null);
  if (plain.noAttack) { check(`B ${c.no} ${c.name}: その技を使える子で攻撃できる`, false); return; }
  countB++;
  const hit = after(plain);
  const ev = attack(c, 'evade');
  const ra = attack(c, 'reduceAll');
  const evd = after(ev);
  const rad = after(ra);
  const name = `B ${c.no} ${c.name}`;
  const hasArea = !!eff(c, 'area');
  check(`${name}: ふつうに当てるとダメージが出る`, hit.dmg > 0 || (c.damage || 0) === 0, JSON.stringify(hit));
  // 回避されない
  if (eff(c, 'noEvade')) check(`${name}: 回避されない技に、回避の札が出せない`, !ev.offered && evd.dmg === hit.dmg, JSON.stringify({ offered: ev.offered, evd }));
  else if (ev.guardCard && !hasArea) check(`${name}: 回避の札が出せる`, ev.offered);
  // 回避されても半分(切り上げ)
  if (eff(c, 'halfOnEvade') && ev.offered) check(`${name}: 回避されても半分(切り上げ)`, evd.dmg === Math.ceil(hit.dmg / 2), `回避で ${evd.dmg} / ふつう ${hit.dmg}`);
  // 防御でマイナスされない
  if (eff(c, 'noBlockReduce') && ra.offered) check(`${name}: 防御でダメージ0にされない`, rad.dmg === hit.dmg, `防御で ${rad.dmg} / ふつう ${hit.dmg}`);
  // ダメージを与えたらガッツを減らす
  const gl = eff(c, 'gutsLossOnHit');
  if (gl) {
    check(`${name}: 当たるとガッツを減らす(${gl.n})`, hit.gutsLost === (gl.n === 'all' ? 10 : gl.n), JSON.stringify(hit));
    if (ev.offered && !eff(c, 'halfOnEvade')) check(`${name}: 回避されたらガッツは減らない`, evd.gutsLost === 0, JSON.stringify(evd));
    if (ra.offered && !eff(c, 'noBlockReduce')) check(`${name}: 防御でダメージ0ならガッツは減らない`, rad.gutsLost === 0, JSON.stringify(rad));
  }
  // ダメージを受けた子は次のターン攻撃できない
  if (eff(c, 'stunOnHit')) {
    const t1 = plain.st.turn;
    check(`${name}: 当たると次のターン攻撃できない印が付く`, hit.stun === t1 + 1, `stunTurn ${hit.stun} / turn ${t1}`);
    if (ev.offered) check(`${name}: 回避されたら印は付かない`, !(evd.stun > t1), JSON.stringify(evd));
    if (ra.offered) check(`${name}: 防御でダメージ0なら印は付かない`, !(rad.stun > t1), JSON.stringify(rad));
    // 相手の番: その子では攻撃できない。もう1つ先の自分の番が回ってきたら攻撃できる
    let st = plain.st;
    st = act(st, { type: 'endAttacks' }); st = act(st, { type: 'guts', hand: [] });
    if (st.active === 1 && st.phase === 'main') {
      st.players[1].hand = [cards.find((x) => x.ready && x.user === db.monsters[DEF_MON].species && (x.effects || []).length === 0 && x.damage > 0).no];
      st.players[1].guts = Array(10).fill('100');
      const canStunned = E.cardAttackOptions(db, st).some((o) => o.mon === 0);
      check(`${name}: 受けた子は、持ち主の次のターンに攻撃できない`, !canStunned);
    }
  }
  // 自分もダメージ
  const sh = eff(c, 'selfDamageIfHit');
  if (sh) {
    check(`${name}: 回避されなかったら自分も ${sh.n}`, hit.self === sh.n, JSON.stringify(hit));
    if (ev.offered && !eff(c, 'halfOnEvade')) check(`${name}: 回避されたら自分は受けない`, evd.self === 0, JSON.stringify(evd));
    if (ra.offered) check(`${name}: 防御でダメージ0でも、回避ではないので自分も受ける`, rad.self === sh.n, JSON.stringify(rad));
  }
  const sa = eff(c, 'selfDamage');
  if (sa) {
    check(`${name}: 使ったら自分も ${sa.n}`, hit.self === sa.n, JSON.stringify(hit));
    if (ev.offered) check(`${name}: 回避されても自分も ${sa.n}`, evd.self === sa.n, JSON.stringify(evd));
  }
  const se = eff(c, 'selfDamageIfEvaded');
  if (se) {
    check(`${name}: 当たったら自分は受けない`, hit.self === 0, JSON.stringify(hit));
    if (ev.offered) check(`${name}: 回避されたら自分も ${se.n}`, evd.self === se.n, JSON.stringify(evd));
  }
});

// ================= B2. 付ける札(技と同時に使う)で、同じ効き目を持つもの =================
// 例: 渾身(防御でマイナスされない)・捨て身(2倍・回避されなかったら自分も2)。そのちから技といっしょに出して確かめる
const attachCards = cards.filter((c) => c.ready && eff(c, 'attach') && Object.values(ATTACH_OF).some((t) => eff(c, t)) && monOf[c.user]);
let countB2 = 0;
attachCards.forEach((ac) => {
  const kinds = (eff(ac, 'attach').when || {}).kinds || ['pow'];
  const base = cards.find((x) => x.ready && x.user === ac.user && kinds.includes(x.kind) && (x.effects || []).length === 0 && x.damage > 0);
  if (!base) { check(`B2 ${ac.no} ${ac.name}: いっしょに使える素の技がある`, false); return; }
  const run = (withAttach, guard) => {
    const g = guard ? guardFor(base.kind, guard) : null;
    let st = scene({ atkMon: monOf[ac.user], hands: [withAttach ? [base.no, ac.no] : [base.no], g ? [g.no] : []] });
    const before = { life: st.players[1].mons[0].life, self: st.players[0].mons[0].life };
    const want = withAttach ? 2 : 1;
    const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && [].concat(x.hand).length === want && x.target && x.target.p === 1 && x.target.m === 0);
    if (!o) return null;
    st = act(st, o);
    let offered = false;
    if (st.pending && g) { const go = E.cardGuardOptions(db, st).find((x) => x.hand === 0 && x.mon === 0); if (go) { st = act(st, go); offered = true; } }
    st = passAll(st);
    return { dmg: before.life - st.players[1].mons[0].life, self: before.self - st.players[0].mons[0].life, offered };
  };
  const plain = run(false, null); const att = run(true, null);
  if (!plain || !att) { check(`B2 ${ac.no} ${ac.name}: ${base.name} といっしょに出せる`, false, JSON.stringify({ plain, att })); return; }
  countB2++;
  const name = `B2 ${ac.no} ${ac.name}(${base.name}と)`;
  const mult = eff(ac, 'attachMult');
  check(`${name}: ダメージが文のとおり`, att.dmg === plain.dmg * (mult ? mult.n : 1), JSON.stringify({ plain, att }));
  const si = eff(ac, 'attachSelfIfHit');
  if (si) {
    check(`${name}: 回避されなかったら自分も ${si.n}`, att.self === si.n, JSON.stringify(att));
    const ev = run(true, 'evade');
    if (ev && ev.offered) check(`${name}: 回避されたら自分は受けない`, ev.self === 0, JSON.stringify(ev));
  }
  if (eff(ac, 'attachNoEvade')) {
    const ev = run(true, 'evade');
    check(`${name}: 回避の札が出せない`, ev && !ev.offered && ev.dmg === att.dmg, JSON.stringify({ ev, att }));
  }
  if (eff(ac, 'attachNoBlockReduce')) {
    const ra = run(true, 'reduceAll');
    if (ra && ra.offered) check(`${name}: 防御でダメージ0にされない`, ra.dmg === att.dmg, JSON.stringify({ ra, att }));
  }
});

// ================= C. 守りの画面と CPU の手 =================
// 回避されない技・防御でマイナスされない技を受ける側の CPU が、手を返す(止まらない)
['noEvade', 'noBlockReduce', 'halfOnEvade'].forEach((k) => {
  const c = targets.find((x) => eff(x, k));
  if (!c) return;
  const g = guardFor(c.kind, k === 'noBlockReduce' ? 'reduceAll' : 'evade');
  let st = scene({ atkMon: monOf[c.user], hands: [[c.no], g ? [g.no] : []] });
  const o = E.cardAttackOptions(db, st).find((x) => [].concat(x.hand)[0] === 0 && x.mon === 0);
  st = act(st, o);
  let ok = true; let detail = '';
  ['easy', 'master'].forEach((lv) => {
    try { const a = E.cardAiChooseAction(db, st, E.cardAiPolicy('kiki', lv)); if (!a) { ok = false; detail += `${lv}: 手が無い `; } } catch (e) { ok = false; detail += `${lv}: ${e.message} `; }
  });
  check(`C ${k}(${c.no} ${c.name})を受けた CPU が守りの手を返す`, ok, detail);
});

// 防御でマイナスされない攻撃(渾身を付けたちから技)を受けた CPU は、効かない防御(−N・半分・0)を出さずに見送る(2026-10-26 直した)
attachCards.filter((ac) => eff(ac, 'attachNoBlockReduce')).forEach((ac) => {
  const base = cards.find((x) => x.ready && x.user === ac.user && x.kind === 'pow' && (x.effects || []).length === 0 && x.damage > 0);
  ['reduce', 'reduceHalf', 'reduceAll'].forEach((t) => {
    // その防御の札を使える種族を、受ける側にする(どの子でも使える札ならゴーレム)
    const g = cards.find((c) => c.ready && (c.user === 'any' || monOf[c.user]) && (c.effects || []).length === 1 && (c.effects || []).some((e) => e.t === t && Array.isArray(e.kinds) && e.kinds.includes('pow')));
    if (!base || !g) return;
    let st = scene({ atkMon: monOf[ac.user], hands: [[base.no, ac.no], [g.no]], defMon: g.user === 'any' ? DEF_MON : monOf[g.user] });
    const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && [].concat(x.hand).length === 2 && x.target && x.target.p === 1 && x.target.m === 0);
    st = act(st, o);
    if (!E.cardGuardOptions(db, st).length) return;
    const picks = ['normal', 'master'].map((lv) => (E.cardAiChooseAction(db, st, E.cardAiPolicy('kiki', lv)) || {}).type);
    check(`C ${ac.no} ${ac.name}つきの攻撃に、CPU が効かない防御(${g.name}・${t})を出さない`, picks.every((x) => x === 'pass'), picks.join(','));
  });
});

console.log(`MFバトルカード 総点検A前半(攻撃の当たり方8種類): 文とデータ ${countA} 件・実際に効かせたカード ${countB} 枚・付ける札 ${countB2} 枚・確かめ ${passed + failed} 件`);
if (failed) { fails.forEach((f) => console.log(`NG: ${f}`)); console.log(`\nNG ${failed} 件`); process.exit(1); }
console.log('\nすべてOK');
