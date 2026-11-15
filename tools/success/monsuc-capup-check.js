#!/usr/bin/env node
// モンサクの能力の上限アップ(r1115-103/105)の見張り。
//   上限 = 999 + 編成の子ごとに(500 を超える能力の上位3つなら、その能力 × 割合 の切り捨て)。割合 = 20% + 🔓上限アップブースト(いるだけ型)
//   古い育成(保存に cap が無い)は 999 のまま / 総合力は 999 を超えた分が 1点 3.5 / 試合の芯は statMax を渡したときだけ 999 を超えて読む
'use strict';
const path = require('path');
const fs = require('fs');
const { CORE, loadDeps, depsFor } = require('./load');
const S = require(CORE).create(depsFor(loadDeps()));
const E = require('../../monster-hero/data/assistant-masmon-battle.js');
const { catalog } = require('../masmon-battle/load.js').load();

let bad = 0;
const ok = (c, m) => { if (!c) { bad += 1; console.log('NG', m); } };
const st = (o) => Object.assign({ life: 300, pow: 300, wise: 300, hit: 300, eva: 300, tough: 300 }, o);
const m = (sp, s, as) => ({ kind: 'raised', species: sp, name: 'x', stats: s, lv: 30, loy: 80, pop: 50, techs: [], assists: as || [] });

// 社長の例: 命中800が2体 → 999 + 160 + 160 = 1319
const a = S.newRun({ id: 'cap-a', species: 'Mocchi', team: [m('Golem', st({ hit: 800 })), m('Tiger', st({ hit: 800 }))] });
ok(a.cap && a.cap.hit === 1319, `命中800×2体で上限1319: ${a.cap && a.cap.hit}`);
ok(a.cap.life === 999, '足されない能力は 999');
// 500 ちょうどは数えない・上位3つまで
const b = S.newRun({ id: 'cap-b', species: 'Mocchi', team: [m('Pixie', st({ hit: 500, eva: 600, wise: 700, pow: 650, tough: 620 }))] });
ok(b.cap.hit === 999 && b.cap.wise === 999 + 140 && b.cap.pow === 999 + 130 && b.cap.tough === 999 + 124 && b.cap.eva === 999, `500ちょうど不可・上位3つ: ${JSON.stringify(b.cap)}`);
// ベースモンは足さない
const c = S.newRun({ id: 'cap-c', species: 'Mocchi', team: [] });
ok(Object.values(c.cap).every((v) => v === 999), 'ベースモンだけの編成は 999');
// 上限アップブースト(いるだけ型): 満タン10目盛りで 30%(編成でいちばん高い1つ)
ok(S.ASSISTS.genkai && S.ASSISTS.genkai.type === 'stay', '上限アップブーストはいるだけ型');
const d = S.newRun({ id: 'cap-d', species: 'Mocchi', team: [m('Golem', st({ hit: 800 }), [{ id: 'genkai', lv: 10, n: 10 }]), m('Tiger', st({ hit: 800 }), [{ id: 'genkai', lv: 3, n: 3 }])] });
ok(d.cap.hit === 999 + 240 + 240, `ブースト満タン: ${d.cap.hit}`);
// 上限まで伸びる・上限で止まる
const e = S.restore(JSON.parse(JSON.stringify({ ...a, stats: { ...a.stats, hit: 5000 } })));
ok(e && e.stats.hit === 1319, `保存の能力は上限で止める: ${e && e.stats.hit}`);
const e2 = S.restore(JSON.parse(JSON.stringify({ ...a, stats: { ...a.stats, hit: 1200 } })));
ok(e2 && e2.stats.hit === 1200 && e2.cap.hit === 1319, '上限のある育成は 999 を超えて読む');
// 古い育成(cap が無い)は 999 のまま
const old = JSON.parse(JSON.stringify(a)); delete old.cap; old.stats.hit = 1200;
const o2 = S.restore(old);
ok(o2 && !o2.cap && o2.stats.hit === 999, '古い育成は上限 999 のまま');
// 能力ポイントは上限で止まる
const p = S.spendPts({ ...e2, stats: { ...e2.stats, hit: 1319 }, pts: 10 }, 'hit', 5);
ok(!p.out.ok, '上限に届いた能力にはポイントを振れない');
// 総合力: 999 を超えた分は 1点 3.5
const base = S.evaluate({ ...e2, stats: { ...e2.stats, hit: 999 } }).power; const over = S.evaluate(e2).power;
ok(Math.abs(over - base - 201 * 3.5) <= 1, `999 を超えた201点で総合力 +${over - base}(703か704)`);
ok(S.powerOverOf(st({})) === 0, '999 までの子は総合力が変わらない');
// 試合の芯: 渡さなければ 999 で切る・statMax を渡すと読む
const sp = Object.keys(catalog.species)[0];
const U = (s) => ({ species: sp, name: sp, lv: 1, stats: s, techs: catalog.species[sp].techs.slice(0, 2).map((t) => t.id), mastery: {} });
const run = (x) => E.simulate({ seed: 'cap', catalog, teamA: { assistantId: 'mua', tactics: 40, members: [U(st({ life: 2000 }))] }, teamB: { assistantId: 'kiki', tactics: 40, members: [U(st({}))] }, ...x });
const hp = (r) => (r.log[0].aHp || [])[0];
ok(hp(run({})) === 100 + Math.round(999 * 1.5), `statMax なしはライフ999で切る: ${hp(run({}))}`);
ok(hp(run({ statMax: 99999 })) === 100 + Math.round(2000 * 1.5), `statMax ありはライフ2000で読む: ${hp(run({ statMax: 99999 }))}`);
// 店の読み込み: 古い版が 999 に丸めても stOver から戻す(56-monhero-success-store.jsx の msxNormBoxMon)
const store = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '56-monhero-success-store.jsx'), 'utf8');
ok(/stOver/.test(store) && /mh_monsuc_run_over_v1/.test(store), 'ボックスの子の stOver と途中の育成の控えのキーがある');

if (bad) { console.log(`NG ${bad} 件`); process.exit(1); }
console.log('OK monsuc-capup-check: 上限の決め方・ブースト・古い育成・ポイント・総合力・試合の芯');
