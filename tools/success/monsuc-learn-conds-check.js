#!/usr/bin/env node
// モンヒロサクセスの修行「覚える率が上がる条件」(2026-11-15 社長が案A・r1113-034)の見張り。画面は開かない(数秒)。
//   ・技のランク(1〜5)ごとに条件の数が決まっている(R1=1つ … R4・R5=4つ・最大4つ)
//   ・条件は門ではない: 満たさなくても canLearn は変わらない。満たした条件1つにつき、率が +5%(上限 99%)
//   ・選んだ技の段の合計は、いま選んでいる技の組み合わせで数える(1つだけならその技のランク)
//   ・率の画面表示と、修行の実際の抽選は同じ式(act の rates と techRate)
'use strict';
const { load } = require('./load');
const { SUC } = load();
const errors = []; const ok = (c, m) => { if (!c) errors.push(m); };
const SH = SUC.SHUGYO;
ok(SH.cond && SH.cond.add === 5, '条件1つにつき +5(SHUGYO.cond.add)');
const nOf = [1, 2, 3, 4, 4];
SH.cond.byRank.forEach((l, i) => ok(l.length === nOf[i], `R${i + 1} の条件の数が ${nOf[i]} つ(いま ${l.length})`));
const s = SUC.newRun({ id: 'cond-1', species: 'Mocchi', aid: 'mua' });
const techs = SUC.techsOf(s.species);
const t5 = techs.find((t) => (t.rank || 0) === 5) || techs[techs.length - 1];
const t1 = techs.find((t) => SUC.SHUGYO.roleRank[t.role] === 1 && !t.rank) || techs[0];
const base = (st, t, picks) => SUC.techRate(st, t, { picks });
// 門ではない: 条件を満たさなくても canLearn の結果は条件で変わらない(人気・技の数だけを動かしても同じ)
const cl0 = techs.map((t) => SUC.canLearn ? SUC.canLearn(s, t) : null);
const s2 = { ...s, pop: 100, techs: [...s.techs] };
const cl1 = techs.map((t) => SUC.canLearn ? SUC.canLearn(s2, t) : null);
ok(JSON.stringify(cl0) === JSON.stringify(cl1) || !SUC.canLearn, '人気を変えても canLearn は変わらない(条件は門ではない)');
// 加点: 人気を 0 → 100 にすると、人気の条件を満たした分だけ率が上がる(人気は仕上がり q にも効くので、条件の分は techBoostConds で数える)
const cs0 = SUC.techBoostConds({ ...s, pop: 0 }, t5, [t5.id]);
const cs1 = SUC.techBoostConds({ ...s, pop: 100 }, t5, [t5.id]);
ok(cs0.length === 4 && cs1.length === 4, 'ランク5の技は条件4つ');
ok(cs1.filter((c) => c.type === 'pop').every((c) => c.ok) && cs0.filter((c) => c.type === 'pop').every((c) => !c.ok), '人気の条件は人気で決まる');
// 満たした条件1つにつき +5%: 状態を変えずに、選ぶ技の組み合わせだけを変えて確かめる(人気・技の数は仕上がり q にも効くので使わない)
const cond = (st, t, picks) => SUC.techBoostConds(st, t, picks).filter((c) => c.ok).length;
const rOne = SUC.techRate(s, t5, { picks: [t5.id] }); const rTwo = SUC.techRate(s, t5, { picks: [t5.id, t5.id] });
const dc = cond(s, t5, [t5.id, t5.id]) - cond(s, t5, [t5.id]);
ok(dc === 1, `ランク5の技を2つ選ぶと、段の合計の条件が1つ増える(いま +${dc})`);
ok(Math.round((rTwo - rOne) * 100) === 5 * dc, `満たした条件1つにつき率 +5%(いま +${Math.round((rTwo - rOne) * 100)}%)`);
// 覚えた技の数の条件は覚えた技の数で決まる
const many = { ...s, techs: Array.from({ length: 12 }, (_, i) => `x${i}`) };
ok(cond(many, t5, [t5.id]) > cond(s, t5, [t5.id]), '覚えた技の数の条件を満たすと、満たした条件が増える');
// 選んだ技の段の合計
const two = SUC.techBoostConds(s, t5, [t5.id, t5.id]).find((c) => c.type === 'sum');
const one = SUC.techBoostConds(s, t5, [t5.id]).find((c) => c.type === 'sum');
ok(two && one && two.now === 2 * one.now, '選んだ技の段の合計は、選んだ技の組み合わせで数える');
if (errors.length) { errors.forEach((e) => console.error('NG: ' + e)); process.exit(1); }
console.log('OK: 修行の覚える率が上がる条件(R1=1つ〜R5=4つ・満たした1つにつき +5%・門ではない)');
