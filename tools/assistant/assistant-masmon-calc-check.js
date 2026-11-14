#!/usr/bin/env node
// マスモンの育成の「計算だけの部品」(56-assistant-life-masmon-calc.jsx)を確かめる。2026-11-12 キズナ
//   node tools/assistant/assistant-masmon-calc-check.js
//   案 docs/progress/assistant-peer/masmon-plan/POWER.md 第3版の数字(当てはまる子・ランク・忠誠・人気・方針・寿命・成長の型・結果)と、
//   部品が助手・保存・乱数・日時に結びついていないこと
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-masmon-calc.jsx'), 'utf8');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const code = src.replace(/\/\/[^\n]*/g, '');
check('部品は助手・保存・乱数・日時・画面に結びつかない', !/storeGet|storeSet|localStorage|Math\.random|Date\.now|new Date|React|RELEASE_FLAGS|ASSISTANT_|AMG_|amg[A-Z]/.test(code));
const ctx = { console }; vm.createContext(ctx); vm.runInContext(src + '\nthis.C = MASMON_CALC;', ctx);
const C = ctx.C;
const st = (sum) => { const v = sum / 6; return { life: v, pow: v, wise: v, hit: v, eva: v, tough: v }; };
const P = (sum, n, m, lv, loyal, pop) => C.power({ stats: st(sum), masteries: Array(n).fill(m), lv, loyal, pop });
const kids = [
  ['モッチー Lv1', P(750, 1, 0, 1, 50, 0), 'F'],
  ['強い2体の合体 Lv1', P(1900, 2, 45, 1, 72, 32), 'C'],
  ['1世代(30日)', P(2450, 4, 50, 28, 70, 40), 'B'],
  ['合体3回ほど', P(4600, 6, 80, 45, 85, 70), 'M'],   // 2026-11-14 能力の重みを直線に(高い能力ほど1あたりが大きい)したので上がる
  ['とても強い', P(5600, 8, 100, 70, 100, 100), 'M'],
  ['全部最大', P(5994, 8, 100, 99, 100, 100), 'M'],
];
for (const [name, p, rk] of kids) check(`総合力とランク: ${name} は ${rk}`, C.rankOf(p).key === rk, `${p} → ${C.rankOf(p).key}`);
check('ランクは11段・M は 20,000 から・S は 14,000 から', C.RANKS.length === 11 && C.rankOf(20000).key === 'M' && C.rankOf(19999).key === 'SSS' && C.rankOf(14000).key === 'S' && C.rankOf(13999).key === 'A');
check('M より上の名前は500ごと(合体3回ほど M5・とても強い MF・全部最大 MF6)', C.rankOf(P(4600, 6, 80, 45, 85, 70)).label === 'M5' && C.rankOf(P(5600, 8, 100, 70, 100, 100)).label === 'MF' && C.rankOf(P(5994, 8, 100, 99, 100, 100)).label === 'MF6' && C.rankOf(20000).label === 'M' && C.rankOf(25000).label === 'MG');
check('総合力は壊れた値でも数になる', Number.isFinite(C.power({ stats: { life: 'x' }, masteries: null, lv: NaN })));
check('合体の上乗せ: 平均999で+200・片方だけ強いと小さい', C.fuseBonus(999, 999) === 200 && C.fuseBonus(999, 100) * 4 <= C.fuseBonus(500, 500));
const f = C.fuseStats({ life: 110, pow: 100, wise: 120, hit: 140, eva: 150, tough: 130 }, st(5994), st(5994));
check('合体: 初期値 + 上乗せ(モッチーのライフ 110 → 310)', f.st.life === 310 && f.add.pow === 200);
check('忠誠度の動かない番: 100で0%・50で12.5%・0で25%', C.noActChance(100) === 0 && C.noActChance(50) === 0.125 && C.noActChance(0) === 0.25);
check('人気のクリティカル: 100で+20%・上限は技の30%+人気の分', Math.abs(C.critBonus(100) - 0.2) < 1e-9 && Math.abs(C.critOf(0.4, 100) - 0.5) < 1e-9 && Math.abs(C.critOf(0.05, 0) - 0.05) < 1e-9);
check('人気は対戦で上がる(フレンド対戦の勝ち+2・負け+0.5)・100まで', C.popAfterBattle(10, 'pvp', true) === 12 && C.popAfterBattle(10, 'pvp', false) === 10.5 && C.popAfterBattle(99.5, 'pvp', true) === 100);
check('方針: 普通の寿命30・超溺愛40・超スパルタ20', C.policyOf(0).life === 30 && C.policyOf(-3).life === 40 && C.policyOf(3).life === 20 && C.lifeLen(0) === 30);
check('方針: プレイヤー側(ターン)でも使える(普通の寿命を48ターンとすると超溺愛は64ターン)', Math.round(C.lifeLen(-3, 48)) === 64 && Math.abs(C.lifeStep(0, 48) - 1 / 48) < 1e-12);
let pp = { pol: 0, pp: 0 }; for (let i = 0; i < 10; i++) pp = C.policyMove(pp.pol, pp.pp, 1);
const back = C.policyMove(0, 5, -1);
let top = { pol: 3, pp: 9 }; top = C.policyMove(top.pol, top.pp, 1);
check('方針: 叱る10回で1段厳しく・逆へ押すと点が戻る・超スパルタより先へは行かない', pp.pol === 1 && pp.pp === 0 && back.pol === 0 && back.pp === 4 && top.pol === 3);
check('年齢: 1日=1か月(30日で2歳6か月)', C.ageLabel(30) === '2歳6か月' && C.ageLabel(0) === '0歳0か月');
check('成長の型: 6つ・ピークは ×1.5〜1.7・持続は ×1.15', C.GROW_TYPES.length === 6 && C.GROW_TYPES.slice(0, 5).every((t, i) => { const m = C.peakOf(i).mult; return m >= 1.5 && m <= 1.7; }) && C.peakOf(5).mult === 1.15);
const avg = C.GROW_TYPES.map(t => t.c.reduce((a, b) => a + b, 0) / 10);
check('成長の型: どの型も寿命を通した伸びはほぼ同じ(平均 ×1.08〜1.12)', avg.every(a => a >= 1.08 && a <= 1.12), avg.map(a => a.toFixed(2)).join('/'));
check('成長の型: 寿命の割合で伸びが変わり、寿命(1以上)で止まる', C.ageMult(0, 0.15) === 1.7 && C.ageMult(4, 0.85) === 1.6 && C.ageMult(2, 1) === 0 && C.ageMult(2, -1) === 0.9);
const cnt = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 1000; i++) cnt[C.typeFromApt('CCCBBB', i / 1000)]++;
const cntHi = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 1000; i++) cntHi[C.typeFromApt('AABCCC', i / 1000)]++;
check('成長の型の出やすさ: どの型も出る・A が多い種類は早熟寄り', cnt.every(n => n > 0) && cntHi[1] > cnt[1], `${cnt.join(',')} / ${cntHi.join(',')}`);
const R = (o) => { const c = {}; for (let i = 0; i < 1000; i++) { const k = C.resultOf({ ...o, r: i / 1000 }); c[k] = (c[k] || 0) + 1; } return c; };
const hiL = R({ loyal: 90, sab: 0.1, fail: 0.1 }); const loL = R({ loyal: 10, sab: 0.1, fail: 0.1 });
check('結果: 忠誠が低いとサボり・ズルが増え、高いと大成功が増える', (loL.skip || 0) > (hiL.skip || 0) && (loL.cheat || 0) > 0 && !hiL.cheat && hiL.great > (loL.great || 0), JSON.stringify({ hiL, loL }));
const sp = R({ loyal: 50, pol: 3, sab: 0.2 }); const sw = R({ loyal: 50, pol: -3, sab: 0.2 });
check('結果: 甘い方針ほどサボりやすい', (sw.skip || 0) > (sp.skip || 0));
check('叱る・褒める: ズルを叱ると忠誠+4・厳しい側/成功を褒めると+3・甘い側/成功を叱ると−5', C.reactOf('cheat', 'scold').loyal === 4 && C.reactOf('cheat', 'scold').dir === 1 && C.reactOf('ok', 'praise').loyal === 3 && C.reactOf('ok', 'praise').dir === -1 && C.reactOf('great', 'scold').loyal === -5);
const lens = (load) => { const c = {}; for (let i = 0; i < 100; i++) { const n = C.condLen(load, i / 100); c[n] = (c[n] || 0) + 1; } return c; };
const l70 = lens(70); const l95 = lens(95);
check('けが等の長さ: 軽い1回〜重い6回(2日)・たまっているほど重い', Object.keys(l70).every(k => ['1', '3', '6'].includes(k)) && (l95[6] || 0) > (l70[6] || 0), `${JSON.stringify(l70)} / ${JSON.stringify(l95)}`);
check('育ちの速さは ×3(社長)', C.PACE === 3);
check('壊れた値でも止まらない: power(null)・power({stats:null})・resultOf(null)(ミハリ5)', (() => { try { return Number.isFinite(C.power(null)) && Number.isFinite(C.power({ stats: null })) && typeof C.resultOf(null) === 'string'; } catch (_) { return false; } })());
check('null・空の文字は既定値: lifeStep(0, null) = 1/30・lifeLen(0, \'\') = 30(ミハリ5)', Math.abs(C.lifeStep(0, null) - 1 / 30) < 1e-9 && C.lifeLen(0, '') === 30);
check('合体の上乗せは入力も 999 で切る(1e9 でも 999 と同じ・ミハリ5)', C.fuseBonus(1e9, 1e9) === C.fuseBonus(999, 999));
console.log(ng ? `\n${ng}件のNGがあります` : '\nすべて OK');
process.exit(ng ? 1 : 0);
