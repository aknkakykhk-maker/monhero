// MFバトルカード: キュービ(新しい血統・2026-11-04)の確かめ。ブラウザなしで 82 を動かす。
//   node tools/card/card-kyubi-check.js [--verbose]
// 見るもの(設計書 tools/art-sources/card-battle/kyubi/kyubi.md と依頼書の「確かめること」)
//   A. データ: 専用技13枚とモンスター2体が、設計書の数値・効果・画面の番号(◆001・C-◆01)のまま
//   B. ひのこ・火炎車: 当たったらガッツへ / 回避されたら捨て札へ
//   C. 九重神眼: 使ったらガッツへ(捨て札に行かない)。同じ相手ターンのうちに、そのガッツで次の守りを払える
//   D. なめろう: 当てたら相手のガッツ −1 のあと、自分の捨て札から1枚ガッツへ。相手が減少を無効にしても回収する。捨て札0枚でも止まらない
//   E. 天河天翔: 当てた子の次のかしこさ技 −2。2回当てても −2 のまま。使ったら終わり。ほかの味方には効かない。KO で消える
//   F. 陽炎: 当てた子は次の自分のターンまでダメージ0。回避されたら付かない
//   G. 霊魂操作: 捨て札からランダムに2枚をガッツへ(足りなければある分だけ)
//   H. オリヒメ: キュービの専用技(攻め・守りとも)を使える。デッキに入れられる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardActionCost, cardUsableBy, cardOf, cardMonsterOf, cardAttackOptions, cardDiscardToGuts };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (v) => JSON.stringify(v);

// ---- A ----
{
  const design = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'art-sources', 'card-battle', 'kyubi', 'kyubi.cards.json'), 'utf8'));
  design.cards.forEach((d, i) => {
    const no = String(901 + i);
    const c = db.cards[no];
    check(`A ${no} ${d.name}: 設計書の数値・効果のまま`, !!c && c.ready && c.name === d.name && c.kind === d.kind && c.damage === d.damage && c.guts === d.guts && c.text === d.text && J(c.effects) === J(d.effects) && c.user === 'kyubi', J(c));
    check(`A ${no}: 画面の番号は ◆${String(i + 1).padStart(3, '0')}`, !!c && c.dispNo === `◆${String(i + 1).padStart(3, '0')}`);
  });
  const k = db.monsters['C-901'], o = db.monsters['C-951'];
  check('A キュービ: ライフ7・空中・番号の表示 C-◆01・絵 C-K01', !!k && k.life === 7 && k.type === 'air' && k.species === 'kyubi' && k.dispNo === 'C-◆01' && k.img === 'C-K01', J(k));
  check('A オリヒメ: ライフ7・空中・混血(メイン キュービ・サブ ？？？)・番号の表示 C-◆02(2026-11-11 社長がウンディーネと通し番号に振り直した)・絵 C-K02', !!o && o.life === 7 && o.type === 'air' && o.main === 'kyubi' && o.sub === 'unknown' && o.dispNo === 'C-◆02' && o.img === 'C-K02' && o.ready, J(o));
}

// 場を作る: 自分(0)= キュービ・オリヒメ・ゴースト / 相手(1)= ゴースト3体(ライフ5・空中)。ガッツは10ずつ。自分の攻める段
const scene = (hand0, hand1 = []) => {
  let st = E.cardCreateGame(db, { decks: [{ monsters: ['C-901', 'C-951', 'C-024'], cards: Array(50).fill('901') }, { monsters: ['C-024', 'C-024', 'C-024'], cards: Array(50).fill('165') }], seed: 11, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.phase = 'main'; st.pending = null; st.active = 0; st.turn = 2; st.first = 0;
  st.players.forEach((pl) => { pl.guts = Array(10).fill('165'); pl.discard = []; pl.mons.forEach((m) => { m.max = 9; m.life = 9; }); });
  st.players[0].hand = hand0.slice();
  st.players[1].hand = hand1.slice();
  return st;
};
// 攻撃して、相手の守りを決める(guard: 守りの札の手札の番号 / null なら受ける)
const attack = (st, cardNo, { mon = 0, target = 0, guard = null, gmon = target } = {}) => {
  const hi = st.players[0].hand.indexOf(cardNo);
  let s = E.cardApplyAction(db, st, { type: 'attack', mon, hand: [hi], target: { p: 1, m: target } });
  if (!s) return null;
  let n = 0;
  while (s && s.pending && n++ < 5) {
    const a = guard === null || s.pending.defender !== 1 ? { type: 'pass' } : { type: 'guard', mon: gmon, hand: guard };
    const nx = E.cardApplyAction(db, s, a);
    if (!nx) { if (process.env.DEBUG) console.log('出せない手', J(a), J(s.pending)); return null; }
    s = nx; guard = null;
  }
  return s;
};

// ---- B ----
{
  for (const no of ['904', '907']) {
    const st = attack(scene([no]), no);
    check(`B ${no} 当たったらガッツへ(捨て札に行かない)`, !!st && st.players[0].guts.includes(no) && !st.players[0].discard.includes(no), J(st && { guts: st.players[0].guts.slice(-2), discard: st.players[0].discard }));
    const ev = attack(scene([no], ['167']), no, { guard: null });
    // 回避の札(ゴーストに回避の札が無いので、相手の手札に「神域移動」を入れて回避させる)
    let s2 = scene([no], ['913']);
    s2.players[1].mons.forEach((m) => { m.species = 'kyubi'; });
    s2 = attack(s2, no, { guard: 0 });
    check(`B ${no} 回避されたら捨て札へ`, !!s2 && s2.players[0].discard.includes(no) && !s2.players[0].guts.includes(no), J(s2 && { guts: s2.players[0].guts.slice(-2), discard: s2.players[0].discard }));
  }
}

// ---- C ----
{
  // 相手(1)が九重神眼で守る: 相手の子をキュービにして、九重神眼を2枚持たせる。こちらは2体で続けて攻める
  let st = scene(['903', '903'], ['911', '911']);
  st.players[1].mons.forEach((m) => { m.species = 'kyubi'; });
  st.players[1].guts = Array(2).fill('165'); // ガッツ2: 1回守るとガッツ0。九重神眼がガッツに戻るので1枚ある
  st = attack(st, '903', { mon: 0, guard: 0 });
  const g1 = st && st.players[1].guts;
  check('C 九重神眼: 使ったらガッツへ(捨て札に行かない)', !!st && g1.includes('911') && !st.players[1].discard.includes('911'), J(st && { guts: g1, discard: st.players[1].discard }));
  check('C 九重神眼: ダメージを −3(狐火 2 → 0)', !!st && st.players[1].mons[0].life === 9, J(st && st.players[1].mons[0].life));
  // 同じ相手ターンのうちに、戻ったガッツ1つ+…で次の守りを払えるか(ガッツ2が要る。戻った1枚だけでは足りないので、ガッツを1つ足して確かめる)
  st.players[1].guts.push('165');
  const s2 = attack(st, '903', { mon: 1, target: 0, guard: 0 });
  check('C 九重神眼: 戻ったガッツを使って、同じ相手ターンにまた守れる', !!s2 && s2.players[1].mons[0].life === 9 && s2.players[1].guts.filter((x) => x === '911').length >= 1, J(s2 && { life: s2.players[1].mons[0].life, guts: s2.players[1].guts }));
}

// ---- D ----
{
  let st = scene(['906']);
  st.players[0].discard = ['165', '166', '167'];
  st = attack(st, '906');
  check('D なめろう: 相手のガッツ −1', !!st && st.players[1].guts.length === 9, J(st && st.players[1].guts.length));
  // 払ったガッツ3枚は捨て札へ行くので、捨て札は 3+3-1(回収)+1(なめろう)= 6 枚
  check('D なめろう: 自分の捨て札から1枚ガッツへ', !!st && st.players[0].guts.length === 10 - 3 + 1 && st.players[0].discard.length === 6, J(st && { guts: st.players[0].guts.length, discard: st.players[0].discard }));
  // 相手が「我慢」(ガッツを減らされない)で守っても、自分の回収は行う
  let s2 = scene(['906'], ['275']);
  s2.players[0].discard = ['165', '166'];
  s2.players[1].mons.forEach((m) => { m.species = 'mocchi'; });
  const hasNoLoss = (db.cards['275'].effects || []).some((e) => e.t === 'noGutsLoss');
  s2 = attack(s2, '906', { guard: 0 });
  check('D なめろう: 相手が減少を無効にしても、自分の回収は行う', hasNoLoss && !!s2 && s2.players[1].guts.length >= 9 && s2.players[0].guts.length === 10 - 3 + 1, J(s2 && { opp: s2.players[1].guts.length, me: s2.players[0].guts.length, card: db.cards['275'].effects }));
  // 捨て札0枚: 回収の部品が0枚を返して止まらない(攻撃のときは払ったガッツが捨て札に入るので、部品を直に呼んで確かめる)
  const s3 = scene([]);
  let k0 = -1; try { k0 = E.cardDiscardToGuts(s3, 0, 1); } catch (e) { k0 = String(e); }
  check('D なめろう: 捨て札0枚でも止まらない(回収は0枚)', k0 === 0 && s3.players[0].guts.length === 10, J({ k0, guts: s3.players[0].guts.length }));
}

// ---- E ----
{
  let st = scene(['908', '909', '909']);
  const before = E.cardActionCost(db, st, 0, st.players[0].hand, [1], 0);
  st = attack(st, '908', { mon: 0 });
  const me = st.players[0];
  check('E 天河天翔: 当てた子の次のかしこさ技 −2(神狐蒼火 4 → 2)', before === 4 && E.cardActionCost(db, st, 0, me.hand, [me.hand.indexOf('909')], 0) === 2, J({ before, cd: me.mons[0].costDown }));
  check('E 天河天翔: ほかの味方には効かない', E.cardActionCost(db, st, 0, me.hand, [me.hand.indexOf('909')], 1) === 4);
  st.players[0].hand.push('908'); st.players[0].mons[0].attacks = 0;
  // 2回目: もう一度当てても −2 のまま(割引の付いた天河天翔 5 → 3 で撃つ)
  const c2 = E.cardActionCost(db, st, 0, st.players[0].hand, [st.players[0].hand.indexOf('908')], 0);
  st = attack(st, '908', { mon: 0, target: 1 });
  check('E 天河天翔: 2回当てても −2 のまま(重ねがけしない)', c2 === 3 && !!st && st.players[0].mons[0].costDown && st.players[0].mons[0].costDown.n === 2, J({ c2, cd: st && st.players[0].mons[0].costDown }));
  st.players[0].mons[0].attacks = 0;
  st = attack(st, '909', { mon: 0, target: 2 });
  check('E 天河天翔: かしこさ技を1回使ったら割引は終わる', !!st && !st.players[0].mons[0].costDown, J(st && st.players[0].mons[0].costDown));
  // KO で消える
  let s4 = attack(scene(['908']), '908', { mon: 0 });
  s4.players[0].mons[0].life = 1;
  s4.active = 1; s4.players[1].hand = ['166']; s4.players[1].mons.forEach((m) => { m.attacks = 0; });
  let s5 = E.cardApplyAction(db, s4, { type: 'attack', mon: 0, hand: [0], target: { p: 0, m: 0 } });
  while (s5 && s5.pending) s5 = E.cardApplyAction(db, s5, { type: 'pass' });
  check('E 天河天翔: その子が KO されたら割引は消える', !!s5 && s5.players[0].mons[0].ko && !s5.players[0].mons[0].costDown, J(s5 && s5.players[0].mons[0]));
}

// ---- F ----
{
  let st = attack(scene(['902']), '902', { mon: 0 });
  const k = st && st.players[0].mons[0];
  check('F 陽炎: 当てた子は次の自分のターンまでダメージを受けない(印が付く)', !!k && k.safeUntil === st.turn + 1, J(k && { safeUntil: k.safeUntil, turn: st.turn }));
  // 相手のターンに攻撃されても0
  st.active = 1; st.turn += 1; st.players[1].hand = ['166']; st.players[1].mons.forEach((m) => { m.attacks = 0; });
  let s2 = E.cardApplyAction(db, st, { type: 'attack', mon: 0, hand: [0], target: { p: 0, m: 0 } });
  while (s2 && s2.pending) s2 = E.cardApplyAction(db, s2, { type: 'pass' });
  check('F 陽炎: 次の相手ターンの攻撃は0ダメージ', !!s2 && s2.players[0].mons[0].life === 9, J(s2 && s2.players[0].mons[0].life));
  let s3 = scene(['902'], ['913']);
  s3.players[1].mons.forEach((m) => { m.species = 'kyubi'; });
  s3 = attack(s3, '902', { guard: 0 });
  check('F 陽炎: 回避されたら印は付かない', !!s3 && !(s3.players[0].mons[0].safeUntil >= s3.turn + 1), J(s3 && s3.players[0].mons[0].safeUntil));
}

// ---- G ----
{
  let st = scene(['912']);
  st.players[0].discard = ['165', '166', '167'];
  const hi = 0;
  let s = E.cardApplyAction(db, st, { type: 'attack', mon: 0, hand: [hi], target: null });
  if (!s) { const o = E.cardAttackOptions(db, st).find((x) => x.hand && x.hand[0] === 0); s = o && E.cardApplyAction(db, st, o); }
  check('G 霊魂操作: 捨て札からランダムに2枚をガッツへ', !!s && s.players[0].guts.length === 12 && s.players[0].discard.length === 2 && s.players[0].discard.includes('912'), J(s && { guts: s.players[0].guts.length, discard: s.players[0].discard }));
  let t = scene(['912']);
  t.players[0].discard = ['165'];
  const o2 = E.cardAttackOptions(db, t).find((x) => x.hand && x.hand[0] === 0);
  const s2 = o2 && E.cardApplyAction(db, t, o2);
  check('G 霊魂操作: 捨て札が足りなければある分だけ', !!s2 && s2.players[0].guts.length === 11, J(s2 && s2.players[0].guts.length));
}

// ---- H ----
{
  const o = db.monsters['C-951'];
  const all = Array.from({ length: 13 }, (_, i) => db.cards[String(901 + i)]);
  check('H オリヒメ: キュービの専用技を13枚とも使える(攻め・守りとも)', all.every((c) => E.cardUsableBy(c, { ...o, ko: false })), J(all.filter((c) => !E.cardUsableBy(c, { ...o, ko: false })).map((c) => c.no)));
}

console.log(`card-kyubi-check: ${passed} OK / ${fails.length} NG`);
if (fails.length) { fails.forEach((f) => console.log(`NG: ${f}`)); process.exit(1); }
