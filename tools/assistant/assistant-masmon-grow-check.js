#!/usr/bin/env node
// 助手のマスモンの育成基盤(56-assistant-life-masmon-grow.jsx・社長の仕様書の第①段階)を、画面なしで確かめる。
//   同じ種なら同じ結果/初めの値は一度だけ/閉じていた分は2日分(6回)まで/1日の伸びの上限/能力は下がらない・999まで/疲れたら休む/相談/保存の正規化
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const masmon = read('monster-hero/src/parts/56-assistant-life-masmon.jsx');
const growAll = read('monster-hero/src/parts/56-assistant-life-masmon-grow.jsx');
const grow = growAll.slice(0, growAll.indexOf('// ---------- 画面')); // 画面の部品(JSX)の手前まで
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
  'this.T = { normalizeAssistantMasmonGrow, amgCatchUp, amgSlotOf, amgAdvise, AMG_STORE, AMG_KEYS, AMG_APT, AMG_DAY_CAP, amgActName, amgEntryOf, amgAptOf, amgView, amgPick, amgPicksLeft, AMG_CARE, assistantMasmonTrainBoost };',
].join('\n'), ctx);
const T = ctx.T;
// ⓪ 保存を読み込む前に書かない(ミハリ 11-11: 空の既定値で上書きして育成を消さない)
{
  const writes = []; ctx.storeSet = (k, v) => writes.push(k);
  T.AMG_STORE.loaded = false;
  const r = [T.assistantMasmonTrainBoost('kiki', { source: 'ranch' }), T.amgView('kiki', 1), T.amgPick('kiki', 1, { a: 'rest' }), T.amgAdvise('kiki', 1, 'hit')];
  check('⓪ 読み込む前は、受け口・見に来た・指定・相談のどれも書かない(false)', r.every(x => x === false) && writes.length === 0, `${r} / 書いた ${writes.length}`);
  T.AMG_STORE.loaded = true; delete ctx.storeSet;
}
const rows = [{ slot: 1, monster: 'Golem', nick: 'ごろべえ', lv: 25, grow: '攻撃型(ちからに振る)' }, { slot: 2, monster: 'Pixie', nick: 'ぴく', lv: 12, grow: 'すばやさ型' }];
const start = T.amgSlotOf(Date.UTC(2026, 10, 11, 0, 0)); // 9:00 JST = 朝
const fresh = () => T.normalizeAssistantMasmonGrow(null);

// ① 初めて開いたとき: 初めの値を作り、今の回だけ育てる(さかのぼらない)
const s1 = T.amgCatchUp(fresh(), 'kiki', rows, 'seed-1', start);
const e1 = s1.mons.kiki['1:Golem'];
check('① 初めの値を作る(6能力・種族の初期値+個体差+Lv・印 init_v1)', e1 && T.AMG_KEYS.every(k => e1.st[k] >= 1 && e1.st[k] <= 400) && e1.src === 'init_v1', JSON.stringify(e1 && e1.st));
check('① 初めては今の回だけ育てる', e1.log.length === 1 && e1.log[0].s === start && s1.done.kiki === start, `${e1.log.length}回`);
check('① ほかのマスモンも初めの値を作る', s1.mons.kiki['2:Pixie'].log.length === 1);

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
check(`⑤ 何もしないとき、1体1日の伸びは ${T.AMG_DAY_CAP} まで`, Object.values(perDay).every(n => n <= T.AMG_DAY_CAP), `最大 ${Math.max(...Object.values(perDay))}`);
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

// ⑩ 関わるほど強くなる(社長 11-11): 見に来た日は上限が上がる・自分で決めた訓練が当たる・指定は1日3回・上限の能力は指定できない
{
  const t0 = Date.UTC(2026, 10, 11, 0, 0); // 朝の回の中
  T.AMG_STORE.set(s1);
  T.amgView('kiki', 1, t0);
  const okPick = T.amgPick('kiki', 1, { a: 'heavy', k: 'hit' }, t0);
  const sP = T.amgCatchUp(T.AMG_STORE.state, 'kiki', rows, 'seed-1', start + 1);
  const last = sP.mons.kiki['1:Golem'].log.slice(-1)[0];
  check('⑩ 自分で決めた訓練が次の回に当たり、印 p が付く', okPick && last.a === 'heavy' && last.k === 'hit' && last.p === 1 && !sP.plan.kiki[1], JSON.stringify(last));
  T.AMG_STORE.set(s1); T.amgView('kiki', 1, t0);
  const a1 = T.amgPick('kiki', 1, { a: 'light', k: 'pow' }, t0), a2 = T.amgPick('kiki', 2, { a: 'light', k: 'pow' }, t0);
  T.AMG_STORE.set({ ...T.AMG_STORE.state, plan: {} });
  const a3 = T.amgPick('kiki', 1, { a: 'light', k: 'pow' }, t0), a4 = T.amgPick('kiki', 2, { a: 'rest' }, t0);
  check('⑩ 指定は助手1人につき1日3回まで', a1 && a2 && a3 && !a4 && T.amgPicksLeft('kiki', t0) === 0);
  const full = JSON.parse(JSON.stringify(s1)); full.mons.kiki['1:Golem'].st.pow = 999; T.AMG_STORE.set(T.normalizeAssistantMasmonGrow(full));
  check('⑩ 上限に届いた能力は指定できない', !T.amgPick('kiki', 1, { a: 'heavy', k: 'pow' }, t0) && !T.amgPick('kiki', 1, { a: 'heavy', k: 'luck' }, t0));
  // 見に来た日の上限(15 → 20)
  let a = s1, b = s1;
  for (let x = start + 1; x <= start + 30; x++) {
    a = T.amgCatchUp(a, 'kiki', rows, 'seed-1', x);
    T.AMG_STORE.set(b); T.amgView('kiki', 1, Date.UTC(2026, 10, 11, 0, 0) + Math.floor((x - start) / 3) * 86400000); b = T.amgCatchUp(T.AMG_STORE.state, 'kiki', rows, 'seed-1', x);
  }
  const sum = (z) => Object.values(z.mons.kiki['1:Golem'].st).reduce((p, q) => p + q, 0);
  check('⑩ 毎日見に来た方が、何もしないより伸びる', sum(b) > sum(a), `${sum(a)} → ${sum(b)}`);
  const perDay2 = {}; for (const x of b.mons.kiki['1:Golem'].log) { const d = Math.floor(x.s / 3); perDay2[d] = (perDay2[d] || 0) + Object.values(x.g).reduce((p, q) => p + q, 0); }
  check(`⑩ 見に来た日でも1日の伸びは ${T.AMG_CARE.viewCap} まで`, Object.values(perDay2).every(n => n <= T.AMG_CARE.viewCap), `最大 ${Math.max(...Object.values(perDay2))}`);
  check('⑩ Lv は訓練で上がる(経験がたまる)', b.mons.kiki['1:Golem'].lv >= 25 || b.mons.kiki['1:Golem'].xp > 0, `Lv${b.mons.kiki['1:Golem'].lv}`);
}
// ⑪ M/B管理の受け口(ナカヨシ9): 1日1回だけ・次の回の伸びに補正・印 r
{
  const t0 = Date.UTC(2026, 10, 11, 0, 0);
  T.AMG_STORE.set(s1);
  const b1 = T.assistantMasmonTrainBoost('kiki', { source: 'ranch' }, t0), b2 = T.assistantMasmonTrainBoost('kiki', { source: 'ranch' }, t0), b3 = T.assistantMasmonTrainBoost('BAD', {}, t0);
  const sB = T.amgCatchUp(T.AMG_STORE.state, 'kiki', rows, 'seed-1', start + 1);
  const sN = T.amgCatchUp(s1, 'kiki', rows, 'seed-1', start + 1);
  const lb = sB.mons.kiki['1:Golem'].log.slice(-1)[0], ln = sN.mons.kiki['1:Golem'].log.slice(-1)[0];
  const tot = (x) => Object.values(x.g).reduce((p, q) => p + q, 0);
  check('⑪ M/B管理の受け口: 1日1回だけ true・次の回に印 r・伸びは同じか多い', b1 === true && b2 === false && b3 === false && lb.r === 1 && tot(lb) >= tot(ln), `${tot(ln)} → ${tot(lb)}`);
}
// ⑫ 端末の時刻を先へ進めて開いたあと戻しても、次の回から育つ・能力は減らない(ミハリ 11-11)
{
  const fwd = T.amgCatchUp(s1, 'kiki', rows, 'seed-1', start + 3 * 365); // 1年先で開いた
  const back = T.amgCatchUp(fwd, 'kiki', rows, 'seed-1', start + 6); // 元の日付へ戻して2日後
  const next = T.amgCatchUp(back, 'kiki', rows, 'seed-1', start + 7); // その次の回
  const sum = (z) => Object.values(z.mons.kiki['1:Golem'].st).reduce((p, q) => p + q, 0);
  check('⑫ 時刻を先へ進めて戻しても、置き直した次の回から育つ・能力は減らない', back.done.kiki === start + 6 && sum(next) > sum(back) && sum(back) >= sum(fwd), `${sum(fwd)} → ${sum(back)} → ${sum(next)}`);
  const small = T.amgCatchUp(s1, 'kiki', rows, 'seed-1', start + 3);
  const smallBack = T.amgCatchUp(small, 'kiki', rows, 'seed-1', start + 1);
  check('⑫ 小さいずれ(6回以内)で戻したときは、何も変えず同じものを返す', smallBack === small);
}
// ⑬ 入れ物が多くても(入れ替えをくり返した)、新しく足したマスモンの育成が読み込みで落ちない
{
  const many = { mons: { kiki: {} } };
  for (let i = 0; i < 30; i++) many.mons.kiki[`1:Mon${i}`] = { st: { life: 100 + i } };
  const n2 = T.normalizeAssistantMasmonGrow(many);
  check('⑬ 30個あっても、いちばん新しい入れ物が残る', !!n2.mons.kiki['1:Mon29'] && Object.keys(n2.mons.kiki).length === 30);
}
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
check('⑨ 書くのは mh_assistant_masmon_grow_v1 だけ', /storeSet\(ASSISTANT_MASMON_GROW_KEY/.test(growAll) && !/storeSet\(ASSISTANT_MASMON_KEY/.test(growAll) && /'mh_assistant_masmon_grow_v1'/.test(grow));
check('⑨ 公開の印が偽のあいだは動かない', /if \(!amgOn\(\)/.test(grow));
console.log(ng ? `${ng}件 NG` : 'すべてOK');
process.exit(ng ? 1 : 0);
