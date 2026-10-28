// MFバトルカードの総点検「パックとお金」(2026-10-27 カード部ソランドくんの割り振り)。
// 遊ぶ人がいちばん気にするビートPとパックの中身が、社長の決めごと(台帳)どおりかを、数で突き合わせる。ブラウザなし・保存もランキングも触らない。
//
//   node tools/card/card-audit-pack-check.js [--packs 8000] [--verbose]
//
// 見るもの
//   A. パックの決まり(台帳 #136・#137・#146・#147・ゴースト #204・剣士モッチー・パンドラ・混血 #143)
//      値段 300・まとめ買い 5パック 1,350・8枚(技など7・モンスター1)・天井7・レア度 第1〜3・5弾 85/12/3・第4・6〜8弾 85/15
//      弾ごとの種族・混血はメインの種族の弾・使えるカードとモンスターはどれか1つの弾に入る(C-060C と図鑑だけの子は出ない)
//   B. 何万回か開けて割合を出す: レア度の割合・同じレア度の中は同じ確率(？？？の子もふつう・持っていない子を出やすくしない)・技の枠も同じ確率・
//      天井(キラなしで7パック開けたら8パック目はキラ以上)・だぶり(技は4枚目から5・モンスター 50/100/200)・売り場の「提供割合」の表が実際と合う
//   C. お金(台帳 #120・#34・#35・#131): 助手と対戦の勝ち 80/110/140/170/200・負けは勝ちの 3/4(切り捨て)を自分の番10回で満額・
//      自分の番が3回より前は0・降参は倒した数・その日はじめての勝ち +50 は1日1回(マルチと合わせて)・マルチは勝ち400/負け150/抜けた0
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const multi = read('src/parts/91-card-battle-multi.jsx').split('// ---- 部屋と通信')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n${read('src/parts/89-card-pack.jsx')}\n;\n`
  + 'const rhythmMultiText = (v, max) => String(v == null ? "" : v).slice(0, max);\n'
  + `${multi}\n;\nthis.E = { CARD_BATTLE_DATA, CARD_PACKS, CARD_PACK_PITY_AT, CARD_TECH_KEEP_MAX, CARD_DUP_POINT, CARD_STARTER_SHOP_PRICE, cardPackOf, cardPackIdOf, cardPackTechPool, cardPackMonPool,
    cardOpenPack, cardBuyPacks, cardPackCardRates, cardMonRarity, CARD_AI_LEVELS, cardCpuReward, cardCpuLoops, cardPvpReward, cardNormalizeDaily, CARD_FIRST_WIN_BONUS, cardRngNext };`, ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const args = process.argv.slice(2);
const N = Number(args[args.indexOf('--packs') + 1]) > 0 && args.includes('--packs') ? Number(args[args.indexOf('--packs') + 1]) : 8000;
const VERBOSE = args.includes('--verbose');
let passed = 0;
const fails = [];
const notes = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}${detail ? ` — ${detail}` : ''}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const rng = (seed) => { let s = seed >>> 0; return () => { const r = E.cardRngNext(s); s = r.s; return r.v; }; };
const pct = (x) => `${(x * 100).toFixed(2)}%`;

// ==== A. パックの決まり ====
const WANT_SPECIES = {
  p1: ['dino', 'hare', 'mocchi'], p2: ['golem', 'pixie', 'naga'], p3: ['suezo', 'gali', 'tiger'], p4: ['phoenix', 'monol', 'henger', 'ghost'],
  p5: ['plant', 'dragon', 'jell'], p6: ['mew', 'worm', 'durahan'], p7: ['zilla', 'metalner', 'joker'], p8: ['arrowhead', 'centaur', 'colorpandora'],
};
check('A 弾は8つ(第1〜8弾)', E.CARD_PACKS.length === 8 && E.CARD_PACKS.every((p, i) => p.no === i + 1));
E.CARD_PACKS.forEach((p) => {
  check(`A ${p.name}: 1パック 300・5パックまとめ 1,350`, p.price === 300 && p.bundle && p.bundle.n === 5 && p.bundle.price === 1350, `${p.price}・${JSON.stringify(p.bundle)}`);
  check(`A ${p.name}: 8枚(技など7・モンスター1)`, p.tech === 7 && p.mon === 1);
  const want = (p.no <= 3 || p.no === 5) ? { normal: 85, kira: 12, alt: 3 } : { normal: 85, kira: 15, alt: 0 };
  check(`A ${p.name}: レア度 ${want.normal}/${want.kira}/${want.alt}`, JSON.stringify(p.rarity) === JSON.stringify(want), JSON.stringify(p.rarity));
  check(`A ${p.name}: 天井あり`, p.pity === true);
  check(`A ${p.name}: 種族が台帳どおり(${WANT_SPECIES[p.id].join('・')})`, JSON.stringify(p.species) === JSON.stringify(WANT_SPECIES[p.id]), p.species.join('・'));
  if (p.no > 3 && p.no !== 5) check(`A ${p.name}: 別絵キラは出ない(第1〜3・5弾だけ)`, E.cardPackMonPool(db, p, 'alt').length === 0);
  const techN = E.cardPackTechPool(db, p).length;
  const monN = ['normal', 'kira', 'alt'].reduce((a, k) => a + E.cardPackMonPool(db, p, k).length, 0);
  notes.push(`${p.name}: 技など ${techN}種・モンスター ${monN}枚(通常 ${E.cardPackMonPool(db, p, 'normal').length}・キラ ${E.cardPackMonPool(db, p, 'kira').length}・別絵キラ ${E.cardPackMonPool(db, p, 'alt').length})`);
  check(`A ${p.name}: 技などは40〜70種(どの弾も50種前後)`, techN >= 40 && techN <= 70, `${techN}種`);
});
check('A 天井は7パック', E.CARD_PACK_PITY_AT === 7);
check('A スターターキットの値段は1,500', E.CARD_STARTER_SHOP_PRICE === 1500);
check('A だぶり: 技は3枚まで持ち4枚目から5・モンスター 50/100/200', E.CARD_TECH_KEEP_MAX === 3 && JSON.stringify(E.CARD_DUP_POINT) === JSON.stringify({ tech: 5, normal: 50, kira: 100, alt: 200 }));

// 使えるカード・モンスターは、どれか1つの弾に入る(出ないのは C-060C と図鑑だけの子)
const packOf = (no) => E.cardPackIdOf(db, no);
const readyCards = Object.values(db.cards).filter((c) => c.ready);
const noPack = readyCards.filter((c) => !packOf(c.no)).map((c) => c.no);
check('A 使える技・全モンスター・ブリーダー・全体カードは、どれか1つの弾から出る', !noPack.length, noPack.join(','));
const mons = Object.values(db.monsters).filter((m) => m.ready !== false);
const monNoPack = mons.filter((m) => !m.dexOnly && !packOf(m.no)).map((m) => m.no);
check('A モンスター(図鑑だけの子のほか)は、どれか1つの弾から出る', !monNoPack.length, monNoPack.join(','));
check('A ファンの描いた C-060C は出ない', !db.monsters['C-060C'] || !E.CARD_PACKS.some((p) => ['normal', 'kira', 'alt'].some((k) => E.cardPackMonPool(db, p, k).includes('C-060C'))));
// 混血はメインの種族の弾(キラの無い通常のモンスター)
const hybrids = mons.filter((m) => String(m.wave) === 'hybrid');
// 剣士モッチー・パンドラ(C-066・C-067)は、台帳でキラ・別絵キラも作った子。それ以外の混血はキラの無い通常
const WITH_KIRA = ['C-066', 'C-067', 'C-208'];
hybrids.forEach((m) => check(`A 混血 ${m.no} ${m.name}: メイン(${m.main})の弾${WITH_KIRA.some((k) => m.no.startsWith(k)) ? '' : '・通常'}`, packOf(m.no) === (E.CARD_PACKS.find((p) => p.species.includes(m.main)) || {}).id && (WITH_KIRA.some((k) => m.no.startsWith(k)) || E.cardMonRarity(m) === 'normal'), `${packOf(m.no)}・${E.cardMonRarity(m)}`));
notes.push(`混血 ${hybrids.length}体`);
// 剣士モッチー(C-066)は第1弾・パンドラ(C-067)は第2弾・ゴーストは第4弾(台帳)
[['C-066', 'p1'], ['C-067', 'p2'], ['C-208', 'p5']].forEach(([no, id]) => check(`A ${no} ${(db.monsters[no] || {}).name}: ${id} から出る(キラ・別絵キラも)`, !!db.monsters[no] && [no, `${no}S`, `${no}V`].every((x) => !db.monsters[x] || packOf(x) === id)));
check('A ゴーストの技とモンスターは第4弾', Object.values(db.cards).filter((c) => c.user === 'ghost').every((c) => packOf(c.no) === 'p4') && mons.filter((m) => m.species === 'ghost').every((m) => packOf(m.no) === 'p4'));

// ==== B. 何万回か開けて割合を出す ====
E.CARD_PACKS.forEach((p, pi) => {
  const rand = rng(1000 + pi);
  const techPool = E.cardPackTechPool(db, p);
  const pools = Object.fromEntries(['normal', 'kira', 'alt'].map((k) => [k, E.cardPackMonPool(db, p, k)]));
  const techCount = {}; const monCount = {}; const rar = { normal: 0, kira: 0, alt: 0 };
  let bad = '';
  for (let i = 0; i < N; i++) {
    // 天井を入れずに、ふつうに開けたときの割合を見る(持ち物も空で、だぶりの影響を受けないように)
    const r = E.cardOpenPack(db, p.id, { collection: {}, pity: {} }, rand);
    if (r.cards.length !== 8 || r.cards.filter((c) => c.slot === 'tech').length !== 7 || r.cards[7].slot !== 'mon') { bad = `中身の形 ${JSON.stringify(r.cards.map((c) => c.slot))}`; break; }
    r.cards.forEach((c) => { if (c.slot === 'tech') techCount[c.no] = (techCount[c.no] || 0) + 1; else { monCount[c.no] = (monCount[c.no] || 0) + 1; rar[c.rarity] += 1; } });
  }
  check(`B ${p.name}: 8枚(技など7・最後にモンスター1)`, !bad, bad);
  const want = p.rarity; const tot = want.normal + want.kira + want.alt;
  ['normal', 'kira', 'alt'].forEach((k) => {
    const got = rar[k] / N, exp = want[k] / tot;
    // 二項分布の 4σ まで(たまたまの揺れでは落ちない幅)
    const tol = 4 * Math.sqrt(exp * (1 - exp) / N) + 1e-9;
    check(`B ${p.name}: ${k} の割合 ${pct(exp)}`, Math.abs(got - exp) <= tol, `出た ${pct(got)}`);
  });
  // 同じレア度の中は同じ確率・技の枠も同じ確率(どの札も、平均から 5σ 以内)
  const evenCheck = (label, list, counts, total) => {
    if (!list.length) return;
    const e = total / list.length; const sd = Math.sqrt(e * (1 - 1 / list.length));
    const worst = list.map((no) => ({ no, d: Math.abs((counts[no] || 0) - e) / (sd || 1) })).sort((a, b) => b.d - a.d)[0];
    check(`B ${p.name}: ${label}(${list.length}種)はどれも同じ確率`, worst.d <= 5, `いちばん離れた ${worst.no} ${counts[worst.no] || 0}回(平均 ${e.toFixed(1)})`);
  };
  evenCheck('技などの枠', techPool, techCount, N * 7);
  ['normal', 'kira', 'alt'].forEach((k) => evenCheck(`モンスターの${k}`, pools[k], monCount, rar[k]));
  // ？？？(サブが unknown)の子も、ふつうの子と同じ確率
  const unk = pools.normal.filter((no) => db.monsters[no].sub === 'unknown');
  if (unk.length) check(`B ${p.name}: サブ？？？の子(${unk.join('・')})もふつうの子と同じ枠・同じ確率`, unk.every((no) => Math.abs((monCount[no] || 0) - rar.normal / pools.normal.length) <= 5 * Math.sqrt(rar.normal / pools.normal.length)));
  // 売り場の「提供割合」の表が、実際の割合と合う(合計1・レア度・1枚ずつ)
  const rates = E.cardPackCardRates(db, p.id);
  const sumMon = rates.mon.reduce((a, x) => a + x.p, 0); const sumTech = rates.tech.reduce((a, x) => a + x.p, 0);
  check(`B ${p.name}: 提供割合の表の合計が1(技の枠・モンスターの枠)`, Math.abs(sumMon - 1) < 1e-9 && Math.abs(sumTech - 1) < 1e-9);
  check(`B ${p.name}: 提供割合の表のレア度が、決まりの割合と同じ`, ['normal', 'kira', 'alt'].every((k) => Math.abs((rates.rarity[k] || 0) - want[k] / tot) < 1e-9));
  check(`B ${p.name}: 提供割合の表に、出るモンスターが全部ある`, rates.mon.length === pools.normal.length + pools.kira.length + pools.alt.length);
  // 持っている子でも出やすさは変わらない(「持っていない子を出やすく」は無し・台帳 #146)
  const half = Object.fromEntries(pools.normal.slice(0, Math.ceil(pools.normal.length / 2)).map((no) => [no, 1]));
  const r2 = rng(5000 + pi); const owned = { yes: 0, no: 0 }; let nn = 0;
  for (let i = 0; i < N; i++) { const r = E.cardOpenPack(db, p.id, { collection: half, pity: {} }, r2); const c = r.cards[7]; if (c.rarity !== 'normal') continue; nn++; owned[half[c.no] ? 'yes' : 'no'] += 1; }
  const expYes = nn * (Object.keys(half).length / pools.normal.length);
  check(`B ${p.name}: 持っている子も持っていない子も同じ出やすさ`, Math.abs(owned.yes - expYes) <= 5 * Math.sqrt(expYes), `持っている子 ${owned.yes}回(平均 ${expYes.toFixed(0)})`);
});

// 天井: キラなしで7パック開けたら、8パック目はキラ以上。弾ごとに数える
{
  const p = E.cardPackOf('p4');
  let pity = {}; let streak = 0; let maxStreak = 0; let forcedOk = true;
  const rand = rng(77);
  for (let i = 0; i < N; i++) {
    const before = pity[p.id] || 0;
    const r = E.cardOpenPack(db, p.id, { collection: {}, pity }, rand);
    if (before >= E.CARD_PACK_PITY_AT && !r.hit) forcedOk = false;
    streak = r.hit ? 0 : streak + 1; maxStreak = Math.max(maxStreak, streak);
    pity = r.pity;
  }
  check('B 天井: キラなしが7パック続いたら、8パック目のモンスターはキラ以上', forcedOk && maxStreak <= 7, `いちばん長いキラなし ${maxStreak}パック`);
  const r1 = E.cardOpenPack(db, 'p1', { collection: {}, pity: { p1: 7, p2: 0 } }, rng(3));
  const r2 = E.cardOpenPack(db, 'p2', { collection: {}, pity: { p1: 7, p2: 0 } }, rng(3));
  check('B 天井は弾ごと(第1弾の数は第2弾に効かない)', r1.hit && r2.pity.p1 === 7);
  // 天井で出たときの割合: キラ:別絵キラ = 12:3(第1〜3弾)
  let kira = 0, alt = 0; const r3 = rng(9);
  for (let i = 0; i < N; i++) { const r = E.cardOpenPack(db, 'p2', { collection: {}, pity: { p2: 7 } }, r3); if (r.cards[7].rarity === 'kira') kira++; else if (r.cards[7].rarity === 'alt') alt++; }
  check('B 天井のとき(第1〜3弾)はキラ 80%・別絵キラ 20%(12:3)', kira + alt === N && Math.abs(alt / N - 0.2) <= 4 * Math.sqrt(0.16 / N), `別絵キラ ${pct(alt / N)}`);
}

// だぶり: 技は4枚目から1枚5・モンスターは2枚目から 50/100/200(混血 50)
{
  const p = E.cardPackOf('p1');
  const pool = E.cardPackTechPool(db, p);
  const col = Object.fromEntries(pool.map((no) => [no, 3]));
  E.cardPackMonPool(db, p, 'normal').forEach((no) => { col[no] = 1; }); E.cardPackMonPool(db, p, 'kira').forEach((no) => { col[no] = 1; }); E.cardPackMonPool(db, p, 'alt').forEach((no) => { col[no] = 1; });
  const rand = rng(11); let okAll = true; const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const r = E.cardOpenPack(db, 'p1', { collection: col, pity: {} }, rand);
    const want = 7 * 5 + E.CARD_DUP_POINT[r.cards[7].rarity];
    seen.add(r.cards[7].rarity);
    if (r.point !== want || r.cards.some((c) => !c.dup) || JSON.stringify(r.collection) !== JSON.stringify(col)) { okAll = false; break; }
  }
  check(`B だぶり: 全部持っているとき、技7枚は1枚5・モンスターはレア度の数(${[...seen].join('・')})。持っている数は減らない`, okAll);
  const r = E.cardOpenPack(db, 'p1', { collection: { [pool[0]]: 2 }, pity: {} }, () => 0);
  check('B だぶり: 技の3枚目はビートPにせず持つ', r.cards[0].no === pool[0] && !r.cards[0].dup && r.collection[pool[0]] === 3);
  const hy = hybrids.find((m) => packOf(m.no));
  if (hy) {
    const hp = packOf(hy.no); const hPool = E.cardPackMonPool(db, E.cardPackOf(hp), 'normal');
    const r4 = E.cardOpenPack(db, hp, { collection: { [hy.no]: 1 }, pity: {} }, (() => { let k = 0; const seq = [...Array(7).fill(0), 0, (hPool.indexOf(hy.no) + 0.5) / hPool.length]; return () => seq[k++ % seq.length]; })());
    check(`B だぶり: 混血(${hy.name})の2枚目は50`, r4.cards[7].no === hy.no && r4.cards[7].point === 50, JSON.stringify(r4.cards[7]));
  }
}

// まとめ買い: 1つ300・5つ1,350・足りなければ買えない・残りは「持ち − 値段 + だぶり」
{
  const one = E.cardBuyPacks(db, 'p3', 1, { collection: {}, pity: {}, point: 300 }, rng(1));
  check('B 1パック買うと300減る(だぶり無し)', one && one.cost === 300 && one.point === 0 && one.packs.length === 1);
  const five = E.cardBuyPacks(db, 'p3', 5, { collection: {}, pity: {}, point: 2000 }, rng(2));
  check('B 5パックまとめは1,350・5パックぶん開く', five && five.cost === 1350 && five.packs.length === 5 && five.point === 2000 - 1350 + five.dupPoint);
  check('B ビートPが足りなければ買えない(1,349で5パック・299で1パック)', E.cardBuyPacks(db, 'p3', 5, { collection: {}, pity: {}, point: 1349 }, rng(3)) === null && E.cardBuyPacks(db, 'p3', 1, { collection: {}, pity: {}, point: 299 }, rng(3)) === null);
}

// ==== C. お金 ====
{
  const L = E.CARD_AI_LEVELS;
  const WIN = { easy: 80, normal: 110, hard: 140, expert: 170, master: 200 };
  const LOSE = { easy: 60, normal: 82, hard: 105, expert: 127, master: 150 }; // 勝ちの 3/4(切り捨て)・台帳 #35
  const LOOPS = { easy: 14, normal: 16, hard: 18, expert: 20, master: 22 };
  const day = E.cardNormalizeDaily(null, '2026-10-27');
  Object.keys(WIN).forEach((lv) => {
    check(`C ${lv}: 勝ち ${WIN[lv]}・クイック ${LOOPS[lv]}周`, L[lv].point === WIN[lv] && L[lv].loops === LOOPS[lv] && E.cardCpuReward(day, lv, 'win', { ownTurns: 10, kos: 3 }).base === WIN[lv] && E.cardCpuLoops(lv, 'win', { ownTurns: 10, kos: 3 }) === LOOPS[lv]);
    const full = E.cardCpuReward(day, lv, 'lose', { ownTurns: 10, kos: 0 });
    check(`C ${lv}: 負け(自分の番10回)は ${LOSE[lv]}・周回は勝ちの3/4(切り捨て)`, full.base === LOSE[lv] && E.cardCpuLoops(lv, 'lose', { ownTurns: 10, kos: 0 }) === Math.floor(LOOPS[lv] * 3 / 4), `${full.base}・${E.cardCpuLoops(lv, 'lose', { ownTurns: 10, kos: 0 })}周`);
    const t5 = E.cardCpuReward(day, lv, 'lose', { ownTurns: 5, kos: 0 });
    check(`C ${lv}: 負け(自分の番5回)は半分(切り捨て)`, t5.base === Math.floor(LOSE[lv] * 5 / 10) && E.cardCpuLoops(lv, 'lose', { ownTurns: 5, kos: 0 }) === Math.floor(Math.floor(LOOPS[lv] * 3 / 4) * 0.5));
    check(`C ${lv}: 自分の番15回でも満額のまま`, E.cardCpuReward(day, lv, 'lose', { ownTurns: 15, kos: 0 }).base === LOSE[lv]);
    ['win', 'lose', 'surrender'].forEach((o) => check(`C ${lv}: 自分の番が2回で終わった試合(${o})は0`, E.cardCpuReward(day, lv, o, { ownTurns: 2, kos: 3 }).total === 0 && E.cardCpuLoops(lv, o, { ownTurns: 2, kos: 3 }) === 0));
    [0, 1, 2, 3].forEach((k) => {
      const s = E.cardCpuReward(day, lv, 'surrender', { ownTurns: 10, kos: k });
      check(`C ${lv}: 降参(倒した${k}体)は ${Math.min(LOSE[lv], k * 10)}(負けの数まで)`, s.base === Math.min(LOSE[lv], k * 10) && s.bonus === 0, `${s.base}`);
    });
  });
  // その日はじめての勝ち +50 は1日1回。負け・降参・0の試合には付かない
  const w1 = E.cardCpuReward(day, 'easy', 'win', { ownTurns: 6, kos: 3 });
  check('C その日はじめての勝ちは +50', w1.bonus === E.CARD_FIRST_WIN_BONUS && E.CARD_FIRST_WIN_BONUS === 50 && w1.total === 80 + 50 && w1.daily.firstWin === true);
  const w2 = E.cardCpuReward(w1.daily, 'master', 'win', { ownTurns: 6, kos: 3 });
  check('C 2回目の勝ちには +50 が付かない', w2.bonus === 0 && w2.total === 200);
  check('C 負け・降参・自分の番2回の勝ちには +50 が付かない', E.cardCpuReward(day, 'easy', 'lose', { ownTurns: 10, kos: 0 }).bonus === 0 && E.cardCpuReward(day, 'easy', 'surrender', { ownTurns: 10, kos: 3 }).bonus === 0 && E.cardCpuReward(day, 'easy', 'win', { ownTurns: 2, kos: 3 }).bonus === 0);
  check('C 日が変わると +50 がまたもらえる(その日の数を読み直す)', E.cardNormalizeDaily({ ...w1.daily, day: '2026-10-26' }, '2026-10-27').firstWin === false);
  // マルチ: 勝ち800・88周/負け300・32周(自分の番10回)/抜けた0/自分の番が3回より前は0(2026-10-27 社長がマルチだけ2倍)
  const pw = E.cardPvpReward('win', { ownTurns: 4, kos: 3 }); const pl = E.cardPvpReward('lose', { ownTurns: 10, kos: 1 });
  check('C マルチ: 勝ち 800・88周(MASTER の2倍をさらに2倍)', pw.point === 800 && pw.loops === 88);
  check('C マルチ: 負け(自分の番10回)300・32周(MASTER の負けの2倍)', pl.point === 300 && pl.loops === 32, `${pl.point}・${pl.loops}`);
  check('C マルチ: 負け(自分の番5回)は半分', E.cardPvpReward('lose', { ownTurns: 5, kos: 0 }).point === 150);
  check('C マルチ: 抜けたら0・自分の番2回なら0', E.cardPvpReward('left', { ownTurns: 10, kos: 3 }).point === 0 && E.cardPvpReward('win', { ownTurns: 2, kos: 3 }).point === 0);
  check('C マルチ: 降参(倒した2体)は40', E.cardPvpReward('surrender', { ownTurns: 10, kos: 2 }).point === 40);
  // マルチの結果の保存(84 の pvpReward): +50 の印をクイック周回のあとの書き直しでも残す(印が消えると1日に何度も +50 になる)
  const p84 = read('src/parts/84-screen-card-battle.jsx');
  const i = p84.indexOf('const pvpReward = async');
  const body = p84.slice(i, p84.indexOf('\n    };', i));
  const writes = body.split('await persist(').slice(1).map((s) => s.slice(0, s.indexOf(', {') > 0 && s.indexOf('}, ') > 0 ? s.indexOf('}, ') : s.length));
  // 場面: マルチで勝って裏の周回が入る → そのあと助手と対戦で勝つ。2回目の書き直し(周回)のあとも印が残り、+50 は付かない
  {
    const dailyAfterPvp = { ...day, pvpPoint: 400 + 50, firstWin: true }; // 1回目の保存(+50 を付けた)
    const dailyAfterQuick = { ...dailyAfterPvp, pvpPoint: dailyAfterPvp.pvpPoint, firstWin: dailyAfterPvp.firstWin || true, quickLoops: 44 }; // 2回目(周回)の保存の形
    const cpu = E.cardCpuReward(E.cardNormalizeDaily(dailyAfterQuick, '2026-10-27'), 'master', 'win', { ownTurns: 8, kos: 3 });
    check('C 場面: マルチで勝って周回が入ったあと、助手と対戦で勝っても +50 は付かない', cpu.bonus === 0 && cpu.total === 200);
    const pvp2 = !E.cardNormalizeDaily(dailyAfterQuick, '2026-10-27').firstWin;
    check('C 場面: マルチで勝って周回が入ったあと、もう一度マルチで勝っても +50 は付かない', pvp2 === false);
  }
  check('C マルチの結果: その日の数を書くどの保存にも、はじめての勝ちの印(firstWin)が入っている', writes.length >= 2 && writes.every((w) => !/daily:/.test(w) || /firstWin/.test(w)), `保存 ${writes.length}か所`);
}

notes.forEach((n) => { if (VERBOSE) console.log(`  ${n}`); });
console.log(`MFバトルカードの総点検「パックとお金」: 8弾を${N.toLocaleString()}パックずつ開けた / 確かめ ${passed + fails.length}件`);
if (VERBOSE || fails.length) notes.forEach((n) => console.log(`  ${n}`));
if (fails.length) { fails.forEach((f) => console.log(`NG: ${f}`)); console.log(`失敗 ${fails.length}件`); process.exit(1); }
console.log('すべて通過');
