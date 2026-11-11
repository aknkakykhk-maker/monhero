#!/usr/bin/env node
// 助手のマスモンの育成基盤(56-assistant-life-masmon-grow.jsx・社長の仕様書の第①段階)を、画面なしで確かめる。
//   同じ種なら同じ結果/初めの値は一度だけ/閉じていた分は2日分(6回)まで/1日の伸びの上限/能力は下がらない・999まで/疲れたら休む/相談/保存の正規化
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const masmon = read('monster-hero/src/parts/56-assistant-life-masmon.jsx');
const grow = read('monster-hero/src/parts/56-assistant-life-masmon-grow.jsx');
const line = (name) => { const m = masmon.match(new RegExp(`^const ${name} = .*$`, 'm')); if (!m) throw new Error(`${name} が見つからない`); return m[0]; };
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const ctx = { console, RELEASE_FLAGS: { assistantMasmonGrow: true } };
vm.createContext(ctx);
vm.runInContext([
  line('assistantMasmonRng'),
  "const assistantMasmonGrowKind = (g) => String(g || '').split('(')[0];",
  "const assistantMasmonStats = (t) => ({ hp: 0.4, atk: 0.5, def: 0.3, guts: 0.4 });",
  grow,
  'this.T = { normalizeAssistantMasmonGrow, amgCatchUp, amgSlotOf, amgAdvise, AMG_STORE, AMG_KEYS, AMG_APT, AMG_DAY_CAP, amgActName, amgEntryOf, amgAptOf };',
].join('\n'), ctx);
const T = ctx.T;
const rows = [{ slot: 1, monster: 'Golem', nick: 'ごろべえ', lv: 25, grow: '攻撃型(ちからに振る)' }, { slot: 2, monster: 'Pixie', nick: 'ぴく', lv: 12, grow: 'すばやさ型' }];
const start = T.amgSlotOf(Date.UTC(2026, 10, 11, 0, 0)); // 9:00 JST = 朝
const fresh = () => T.normalizeAssistantMasmonGrow(null);

// ① 初めて開いたとき: 初めの値を作り、今の回だけ育てる(さかのぼらない)
const s1 = T.amgCatchUp(fresh(), 'kiki', rows, 'seed-1', start);
const e1 = s1.mons.kiki['1:Golem'];
check('① 初めの値を作る(6能力・0〜600・印 init_v1)', e1 && T.AMG_KEYS.every(k => e1.st[k] >= 1 && e1.st[k] <= 600) && e1.src === 'init_v1', JSON.stringify(e1 && e1.st));
check('① 初めては今の回だけ育てる', e1.log.length === 1 && e1.log[0].s === start && s1.done.kiki === start, `${e1.log.length}回`);
check('① ライフ・ちから・丈夫さは、いまのゲージ×600', s1.mons.kiki['2:Pixie'].log.length === 1);

// ② 同じ種なら同じ結果・違う種なら違う結果
const s1b = T.amgCatchUp(fresh(), 'kiki', rows, 'seed-1', start);
const s1c = T.amgCatchUp(fresh(), 'kiki', rows, 'seed-2', start);
check('② 同じ種なら同じ結果', JSON.stringify(s1b) === JSON.stringify(s1));
check('② 違う種(プレイヤー)なら違う結果', JSON.stringify(s1c.mons) !== JSON.stringify(s1.mons));

// ③ 初めの値は一度だけ(もう一度呼んでも作り直さない)
const s2 = T.amgCatchUp(s1, 'kiki', rows, 'seed-1', start);
check('③ 同じ回でもう一度呼んでも、何も変わらない', s2 === s1 || JSON.stringify(s2) === JSON.stringify(s1));

// ④ 10日閉じていても、まとめて育つのは6回まで
const s3 = T.amgCatchUp(s1, 'kiki', rows, 'seed-1', start + 30);
const e3 = s3.mons.kiki['1:Golem'];
check('④ 閉じていた分は6回(2日分)まで', e3.log.length === 7 && s3.done.kiki === start + 30, `${e3.log.length - 1}回`);

// ⑤ 長く育てても: 下がらない・999まで・1日の上限・疲れたら休む
let st = s1; const hist = [];
for (let s = start + 1; s <= start + 3 * 120; s++) { st = T.amgCatchUp(st, 'kiki', rows, 'seed-1', s); hist.push(JSON.parse(JSON.stringify(st.mons.kiki['1:Golem']))); }
const down = hist.some((e, i) => i > 0 && T.AMG_KEYS.some(k => e.st[k] < hist[i - 1].st[k]));
check('⑤ 能力は下がらない', !down);
check('⑤ 999 を超えない', hist.every(e => T.AMG_KEYS.every(k => e.st[k] <= 999)));
const perDay = {}; for (const e of hist) { const x = e.log[e.log.length - 1]; const d = Math.floor(x.s / 3); perDay[d] = (perDay[d] || 0) + Object.values(x.g).reduce((a, b) => a + b, 0); }
check(`⑤ 1体1日の伸びは ${T.AMG_DAY_CAP} まで`, Object.values(perDay).every(n => n <= T.AMG_DAY_CAP), `最大 ${Math.max(...Object.values(perDay))}`);
check('⑤ 疲労・ストレスは 0〜100', hist.every(e => e.fat >= 0 && e.fat <= 100 && e.str >= 0 && e.str <= 100));
const acts = hist.map(e => e.log[e.log.length - 1].a);
check('⑤ 休養・遊び・軽トレ・重トレ・特殊訓練が出る', ['rest', 'light', 'heavy'].every(a => acts.includes(a)) && acts.some(a => ['real', 'focus', 'weak', 'joint'].includes(a)), [...new Set(acts)].join(','));
check('⑤ 疲労が高い回のあとは休む(休ませる目安で)', hist.every((e, i) => i === 0 || hist[i - 1].fat < 60 || ['rest'].includes(e.log[e.log.length - 1].a)));
const g = hist[hist.length - 1].st; const p0 = hist[0].st;
check('⑤ 攻撃型(ちから)・ゴーレムの適性 A(ちから)はよく伸びる', g.pow - p0.pow > g.wise - p0.wise, `ちから +${g.pow - p0.pow} / かしこさ +${g.wise - p0.wise}`);
check('⑤ 行動の名前が仕様書の表の名前', T.amgActName({ a: 'heavy', k: 'pow' }) === '重量上げ' && T.amgActName({ a: 'light', k: 'hit' }) === '的当て' && T.amgActName({ a: 'weak', k: 'eva' }) === '弱点克服');

// ⑥ 相談: 「命中を鍛えて」→ その能力を選ぶ/「休ませて」→ 次の回は休む
T.AMG_STORE.set(s1);
T.amgAdvise('kiki', 1, 'hit', Date.UTC(2026, 10, 11, 0, 0));
const sF = T.amgCatchUp(T.AMG_STORE.state, 'kiki', rows, 'seed-1', start + 3);
const fl = sF.mons.kiki['1:Golem'].log.slice(-3);
check('⑥ 「命中を鍛えて」のあと、休み以外は命中を鍛える', fl.filter(x => !['rest', 'play'].includes(x.a)).every(x => x.k === 'hit' || x.a === 'weak'), fl.map(x => `${x.a}:${x.k}`).join(' '));
T.AMG_STORE.set(s1); T.amgAdvise('kiki', 2, 'rest');
const sR = T.amgCatchUp(T.AMG_STORE.state, 'kiki', rows, 'seed-1', start + 1);
check('⑥ 「休ませて」のあと、次の回は休む(1回だけ)', sR.mons.kiki['2:Pixie'].log.slice(-1)[0].a === 'rest' && !sR.rest.kiki[2]);

// ⑦ 保存の正規化: 壊れた値・知らない項目は既定に・数字は範囲に
const n = T.normalizeAssistantMasmonGrow({ mons: { kiki: { '1:Golem': { st: { life: 5000, pow: 'x', wise: -3 }, fat: 400, ind: { life: 9 } }, 'bad key': { st: {} } }, 'BAD!': {} }, done: { kiki: 'x' }, focus: { kiki: { 1: { k: 'nope', until: 3 } } } });
const ne = n.mons.kiki['1:Golem'];
check('⑦ 正規化: 範囲に収め、知らないものは捨てる', ne.st.life === 999 && ne.st.pow === 0 && ne.st.wise === 0 && ne.fat === 100 && ne.ind.life === 1 && !n.mons.kiki['bad key'] && !n.mons['BAD!'] && !n.done.kiki && !n.focus.kiki[1]);
check('⑦ 正規化して保存し直しても同じ', JSON.stringify(T.normalizeAssistantMasmonGrow(JSON.parse(JSON.stringify(st)))) === JSON.stringify(T.normalizeAssistantMasmonGrow(st)));
check('⑦ 30種族すべてに適性がある', Object.keys(T.AMG_APT).length === 30 && Object.values(T.AMG_APT).every(s => /^[A-E]{6}$/.test(s)));

// ⑧ 回の区切り: 朝4:00・昼12:00・夜18:00(日本時間)
const at = (h, m = 0) => Date.UTC(2026, 10, 11, h - 9, m);
check('⑧ 朝・昼・夜の区切り', T.amgSlotOf(at(4)) % 3 === 0 && T.amgSlotOf(at(11, 59)) % 3 === 0 && T.amgSlotOf(at(12)) % 3 === 1 && T.amgSlotOf(at(18)) % 3 === 2 && T.amgSlotOf(at(27, 59)) === T.amgSlotOf(at(18)) && T.amgSlotOf(at(28)) === T.amgSlotOf(at(4)) + 3);

// ⑨ 保存キーは新しいものだけ・いまのキーを書かない
check('⑨ 書くのは mh_assistant_masmon_grow_v1 だけ', /storeSet\(ASSISTANT_MASMON_GROW_KEY/.test(grow) && !/storeSet\(ASSISTANT_MASMON_KEY/.test(grow) && /'mh_assistant_masmon_grow_v1'/.test(grow));
check('⑨ 公開の印が偽のあいだは動かない', /if \(!amgOn\(\)/.test(grow));
console.log(ng ? `${ng}件 NG` : 'すべてOK');
process.exit(ng ? 1 : 0);
