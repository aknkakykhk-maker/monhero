// モンヒロサクセスのライバル(r1116-002): 個体の印で引く・元が強いほど手強く(上げるだけ)・技は強さに合った技。
//   芯(data/monhero-success.js)を load.js で読み、同名の別の子・古いセーブ・強さ3段・技の4場面を確かめる
'use strict';
const { load } = require('./load.js');
const { SUC } = load();

let ng = 0;
const ok = (cond, msg) => { if (!cond) { ng += 1; console.log('NG:', msg); } };
const STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const st = (sum) => { const v = Math.floor(sum / 6); const o = {}; STAT_KEYS.forEach((k, i) => { o[k] = v + (i === 0 ? sum - v * 6 : 0); }); return o; };
// ジュニア期(10ターン目)の実在の大会から、ライバル付きの試合を作る
const cupBattle = (s, rival, star) => {
  const c = (SUC.cupsOf(s) || [])[0];
  if (!c) return null;
  return { kind: 'cup', id: c.id, sys: c.sys, name: c.name || null, star: star != null ? star : c.star, rival, round: 0 };
};

// ---- 1. 同名の別の子: 札・実戦・restore のあと・ファイナルが同じ個体になる ----
{
  const rivals = [
    { name: 'モッチー', breeder: 'みゅあ', kind: 'aid', species: 'Mocchi', id: 'aid:mua:1:Mocchi', stats: st(1800), rawSum: 1800 },
    { name: 'モッチー', breeder: 'フレンド', kind: 'friend', species: 'Tiger', id: 'friend:fr-1:0:Tiger', stats: st(1800), rawSum: 1800 },
  ];
  const s = { ...SUC.newRun({ id: 'rival-id', species: 'Mocchi', aid: 'kiki', rivals }), turn: 10 };
  ok(s.rivals.length === 2 && s.rivals[0].id === 'aid:mua:1:Mocchi' && s.rivals[1].id === 'friend:fr-1:0:Tiger', '候補に個体の印が残らない');
  ok(s.rivals[1].rawSum === 1800, '元の能力の合計が残らない');
  // 大会の札はフレンドの Tiger。そのまま実戦へ
  const card = { name: 'モッチー', kind: 'friend', species: 'Tiger', id: 'friend:fr-1:0:Tiger' };
  const b = cupBattle(s, card, 3);
  ok(!!b, 'ジュニア期の大会が取れない');
  const s2 = { ...s, battle: b };
  const opp = SUC.opponents(s2)[0];
  ok(opp && opp.rival && opp.species === 'Tiger', `実戦の相手が札と違う(同名の助手の子になっている): ${opp && opp.species}`);
  // 勝つと「会ったライバル」に印ごと残る
  const settled = SUC.settle(s2, [true]).state;
  ok(settled.rivalMet === 'モッチー' && settled.rivalMetId === 'friend:fr-1:0:Tiger', `会ったライバルの印が残らない: ${settled.rivalMetId}`);
  // ファイナル(mua の頂への道 round 1 はライバル指名): 印から Tiger が選ばれる
  const s3 = { ...settled, aid: 'mua', battle: { kind: 'summit', round: 1 } };
  const pick = SUC.summitPick(s3, 1);
  ok(pick && pick.rival && pick.rival.species === 'Tiger', 'ファイナルで選ばれるライバルが印と違う');
  const oppF = SUC.opponents(s3)[0];
  ok(oppF && oppF.rival && oppF.species === 'Tiger', 'ファイナルの実戦の相手が印と違う');
  // 中断再開(restore)のあとも同じ個体・元の合計も落ちない
  const re = SUC.restore(JSON.parse(JSON.stringify(settled)));
  ok(re && re.rivalMetId === 'friend:fr-1:0:Tiger' && re.rivals[1].id === 'friend:fr-1:0:Tiger' && re.rivals[1].rawSum === 1800, 'restore で印・元の合計が落ちる');
  const reOpp = SUC.opponents({ ...re, aid: 'mua', battle: { kind: 'summit', round: 1 } })[0];
  ok(reOpp && reOpp.species === 'Tiger', 'restore 後のファイナルの相手が違う');
}

// ---- 2. 古いセーブ(印なし)が読める: 名前・種・種類で引く ----
{
  const rivals = [
    { name: 'モッチー', breeder: 'みゅあ', kind: 'aid', species: 'Mocchi', stats: st(1500) },
    { name: 'モッチー', breeder: 'フレンド', kind: 'friend', species: 'Tiger', stats: st(1500) },
  ];
  const s = { ...SUC.newRun({ id: 'rival-old', species: 'Mocchi', aid: 'kiki', rivals }), turn: 10 };
  ok(s.rivals.every((r) => r.id === null && r.rawSum === null), '印の無い古い候補に印・元の合計が付いてしまう');
  const b = cupBattle(s, { name: 'モッチー', kind: 'friend', species: 'Tiger' }, 2);
  const opp = SUC.opponents({ ...s, battle: b })[0];
  ok(opp && opp.rival && opp.species === 'Tiger', '印なしでも名前・種・種類で引けない');
  // rivalMet(名前だけ)でもファイナルで引ける
  const ro = SUC.restore({ ...JSON.parse(JSON.stringify(s)), rivalMet: 'モッチー' });
  const pick = SUC.summitPick({ ...ro, aid: 'mua' }, 1);
  ok(pick && pick.rival && pick.rival.species === 'Mocchi', '古いセーブのファイナルが名前で引けない');
}

// ---- 3. 強さ: 元の合計 600・2000 は今と同じ、4000 は上がる(ジュニア★1 は +5% 以内) ----
{
  const mk = (sum) => ({ ...SUC.newRun({ id: 'rival-str', species: 'Mocchi', aid: 'kiki', rivals: [{ name: 'つよい', breeder: 'フレンド', kind: 'friend', species: 'Tiger', id: 'friend:fr-9:0:Tiger', stats: st(sum), rawSum: sum }] }), turn: 10 });
  const card = { name: 'つよい', kind: 'friend', species: 'Tiger', id: 'friend:fr-9:0:Tiger' };
  const sumOf = (sum) => { const s = mk(sum); return SUC.opponents({ ...s, battle: cupBattle(s, card, 1) })[0].sum; };
  const a600 = sumOf(600); const a2000 = sumOf(2000); const a4000 = sumOf(4000);
  ok(Math.abs(a600 - a2000) <= a2000 * 0.03, `元の合計 2000 以下で強さが変わる: 600→${a600} / 2000→${a2000}`);
  ok(a4000 > a2000 * 1.02 && a4000 <= a2000 * 1.07, `元の合計 4000 で上がらない・上がりすぎ: 2000→${a2000} / 4000→${a4000}(ジュニア★1 は +5% が上限)`);
}

// ---- 4. 技: 種の表の中にあり、数が期の個数になる。助手は覚えた技を読み替えて熟練順 ----
{
  const table = (sp) => (SUC.techsOf(sp) || []).map((t) => t.id);
  // 助手の子: v1 の id(mocchi_03→sk-0404・mocchi_05→sk-0409)混じり。熟練は mocchi_05 が一番高い
  const aidRival = { name: 'モッチー', breeder: 'みゅあ', kind: 'aid', species: 'Mocchi', id: 'aid:mua:1:Mocchi', stats: st(1800), rawSum: 1800,
    techs: ['mocchi_03', 'mocchi_05', 'sk-0414'], mastery: { mocchi_03: 10, mocchi_05: 90, 'sk-0414': 50 } };
  const sa = { ...SUC.newRun({ id: 'rival-tech', species: 'Tiger', aid: 'kiki', rivals: [aidRival] }), turn: 10 };
  const oppa = SUC.opponents({ ...sa, battle: cupBattle(sa, { name: 'モッチー', kind: 'aid', species: 'Mocchi', id: 'aid:mua:1:Mocchi' }, 3) })[0];
  ok(oppa && Array.isArray(oppa.techIds), '助手のライバルに技の指定が付かない');
  ok(oppa.techIds.length === 2, `技の数が期の個数(ジュニア2)にならない: ${oppa.techIds && oppa.techIds.length}`);
  ok(oppa.techIds.every((id) => table('Mocchi').includes(id)), '技がその種の表の外にある');
  ok(oppa.techIds.join() === 'sk-0409,sk-0414', `覚えた技の読み替え・熟練順が違う: ${oppa.techIds.join()}`);
  // フレンドの子: 技は届いていないので、種の表から強さに合った技で埋める
  const frRival = { name: 'タイガー', breeder: 'フレンド', kind: 'friend', species: 'Tiger', id: 'friend:fr-2:0:Tiger', stats: st(1800), rawSum: 1800 };
  const sf = { ...SUC.newRun({ id: 'rival-tech2', species: 'Mocchi', aid: 'kiki', rivals: [frRival] }), turn: 10 };
  const oppf = SUC.opponents({ ...sf, battle: cupBattle(sf, { name: 'タイガー', kind: 'friend', species: 'Tiger', id: 'friend:fr-2:0:Tiger' }, 3) })[0];
  ok(oppf && Array.isArray(oppf.techIds) && oppf.techIds.length === 2, 'フレンドのライバルの技が埋まらない');
  ok(oppf.techIds.every((id) => table('Tiger').includes(id)), 'フレンドの技がその種の表の外にある');
  const rankOf = (sp, id) => { const r = (SUC.techsOf(sp) || []).find((t) => t.id === id); return r ? r.rank : 99; };
  ok(oppf.techIds.every((id) => rankOf('Tiger', id) <= 2), 'ジュニアの大会で上位すぎる技が出る');
  // ライバルでない相手には技の指定を付けない(今までどおり)
  const plain = SUC.opponents({ ...sf, battle: cupBattle(sf, null, 3) })[0];
  ok(plain && !plain.techIds, 'ライバルでない相手にまで技の指定が付く');
}

// ---- 5. 大一番の決勝ライバル確定(2026-11-16): ダービーと四大大会は候補がいれば必ずライバル、
//        いなければ今までどおり。札・実戦・restore で同じ個体。予想にもライバルの倍率が入る ----
{
  const rivals = [
    { name: 'モッチー', breeder: 'みゅあ', kind: 'aid', species: 'Mocchi', id: 'aid:mua:1:Mocchi', stats: st(2400), rawSum: 2400 },
    { name: 'タイガー', breeder: 'フレンド', kind: 'friend', species: 'Tiger', id: 'friend:fr-9:0:Tiger', stats: st(2400), rawSum: 2400 },
  ];
  const FINAL_CUPS = [[14, 'derby'], [20, 'four1'], [26, 'four2'], [32, 'four3'], [38, 'four4']];
  for (const [turn, sys] of FINAL_CUPS) {
    const s = { ...SUC.newRun({ id: `rival-final-${sys}`, species: 'Mocchi', aid: 'kiki', rivals }), turn };
    const card = (SUC.cupsOf(s) || []).find((c) => c.sys === sys);
    ok(!!card, `${sys}: 大会の札が無い(turn ${turn})`);
    if (!card) continue;
    ok(!!card.rival, `${sys}: 候補がいるのに決勝ライバルが付かない`);
    if (!card.rival) continue;
    ok(rivals.some((r) => r.id === card.rival.id), `${sys}: 付いたライバルが候補の外: ${card.rival.id}`);
    // 札は決まった乱数なので、もう一度作っても同じ個体
    const card2 = (SUC.cupsOf(s) || []).find((c) => c.sys === sys);
    ok(card2 && card2.rival && card2.rival.id === card.rival.id, `${sys}: 札を作り直すとライバルが変わる`);
    // 実戦の相手が札の個体と一致する
    const b = { kind: 'cup', id: card.id, sys: card.sys, name: card.name || null, star: card.star, rival: card.rival, round: 0 };
    const opp = SUC.opponents({ ...s, battle: b })[0];
    ok(opp && opp.rival && opp.species === card.rival.species && opp.name === card.rival.name, `${sys}: 実戦の相手が札のライバルと違う`);
    ok(opp && opp.rivalId === card.rival.id, `${sys}: 実戦の相手に個体の印が付かない`);
    // 中断再開(restore)のあとも同じ個体
    const re = SUC.restore(JSON.parse(JSON.stringify({ ...s, battle: b })));
    const reOpp = SUC.opponents(re)[0];
    ok(reOpp && reOpp.rival && reOpp.species === card.rival.species, `${sys}: restore 後の相手が変わる`);
    // 予想: ライバルが付くと、付いていない同じ札より楽にはならない(倍率が予想にも入っている)
    const order = ['easy', 'good', 'even', 'hard', 'none'];
    const withR = SUC.forecastOf(s, card);
    const withoutR = SUC.forecastOf(s, { ...card, rival: null });
    ok(withR && withoutR && order.indexOf(withR.key) >= order.indexOf(withoutR.key), `${sys}: 予想にライバルの倍率が入っていない(${withoutR && withoutR.key} → ${withR && withR.key})`);
  }
  // 候補がいなければ、今までどおりライバルは付かない(相手は大会の常連)
  for (const [turn, sys] of FINAL_CUPS) {
    const s = { ...SUC.newRun({ id: `rival-final-none-${sys}`, species: 'Mocchi', aid: 'kiki', rivals: [] }), turn };
    const card = (SUC.cupsOf(s) || []).find((c) => c.sys === sys);
    ok(!!card && !card.rival, `${sys}: 候補がいないのにライバルが付く`);
    if (!card) continue;
    const b = { kind: 'cup', id: card.id, sys: card.sys, name: card.name || null, star: card.star, rival: null, round: 0 };
    const opp = SUC.opponents({ ...s, battle: b })[0];
    ok(opp && !opp.rival, `${sys}: 候補がいないのに実戦の相手がライバルになる`);
  }
}

if (ng) { console.log(`monsuc-rival-check: NG ${ng} 件`); process.exit(1); }
console.log('monsuc-rival-check: OK');
