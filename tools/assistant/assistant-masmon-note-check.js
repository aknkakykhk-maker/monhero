#!/usr/bin/env node
// 育成ノート(56-assistant-life-masmon-plan.jsx・助手のマスモンを計画して育てる)を、画面なしで確かめる。2026-11-12 キズナ
//   node tools/assistant/assistant-masmon-note-check.js          検査
//   node tools/assistant/assistant-masmon-note-sim.js 相当の試算は  --sim [日数...](30・90 日の計画あり/なしの差・けがなどの回数)
//   ① 印が偽なら育成の結果は今と全く同じ ② 保存の正規化(壊れた値・知らない予定は「まかせる」・計画の子は5体まで)
//   ③ 段 5・12・20・30 日 ④ 計画の子の数は段まで・外しても予定は消さない ⑤ 計画の回は 1.3倍・失敗半分・1日20まで・自動で休まない
//   ⑥ 同じ種なら同じ結果 ⑦ けが・病気・家出・サボりが起き、その間は伸びない・能力は下がらない ⑧ 看病・さがす・病院(1回ずつ)
//   ⑨ 指定の引き継ぎは1度だけ・育成のキーは書き換えない ⑩ 次の回だけ変える ⑪ 読み込む前は書かない ⑫ 冬眠 ⑬ 合体
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const masmon = read('monster-hero/src/parts/56-assistant-life-masmon.jsx');
const cut = (src) => src.slice(0, src.indexOf('// ---------- 画面'));
const grow = cut(read('monster-hero/src/parts/56-assistant-life-masmon-grow.jsx'));
const plan = cut(read('monster-hero/src/parts/56-assistant-life-masmon-plan.jsx'));
const rngLine = masmon.match(/^const assistantMasmonRng = .*$/m)[0];
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const make = (flags, withPlan = true) => {
  const ctx = { console, RELEASE_FLAGS: flags, Promise };
  vm.createContext(ctx);
  vm.runInContext([rngLine, "const assistantMasmonGrowKind = (g) => String(g || '').split('(')[0];", grow, withPlan ? plan : '',
    `this.T = { normalizeAssistantMasmonGrow, amgCatchUp, amgSlotOf, amgSlotDay, AMG_STORE, AMG_KEYS, AMG_CARE, amgEntryOf, amgMonKey${withPlan ? ', normalizeAssistantMasmonPlan, normalizeAssistantMasmonCond, AMGP_STORE, AMGP_CSTORE, amgpStageOf, amgpSetPick, amgpSetCells, amgpCopyDay, amgpSetOnce, amgpCare, amgpFind, amgpMigrate, amgpKey, amgpCellOf, amgpCondAt, amgpForecastWeek, amgpActAt, AMGP_NUM' : ''} };`].join('\n'), ctx);
  return ctx;
};
const ROW = { slot: 1, monster: 'Golem', lv: 20, grow: '攻撃型', nick: 'ゴロンタ' };
const ROW2 = { slot: 2, monster: 'Pixie', lv: 15, grow: 'すばやさ型', nick: 'ピピ' };
const SEED = 'note-check';
const slotAt = (s) => (Math.floor(s / 3) * 86400000) - 5 * 3600000 + [0, 8, 14][s % 3] * 3600000 + 60000; // その回が始まった時刻
const S0 = Math.floor((Date.UTC(2026, 10, 16, 0, 0) + 5 * 3600000) / 86400000) * 3; // 月曜の朝
// 育成を回す。plan(ctx) はその回の前に呼ぶ(予定を組む・看病など)
const run = (ctx, rows, slots, each = null) => {
  const T = ctx.T; T.AMG_STORE.loaded = true;
  if (T.AMGP_STORE) { T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true; }
  let st = T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), 'kiki', rows, SEED, S0);
  T.AMG_STORE.set(st);
  for (let s = S0 + 1; s <= S0 + slots; s++) {
    if (each) each(s, T);
    st = T.amgCatchUp(T.AMG_STORE.state, 'kiki', rows, SEED, s); T.AMG_STORE.set(st);
  }
  return st;
};
const entry = (st, row) => st.mons.kiki[`${row.slot}:${row.monster}`];

// ① 印が偽なら、育成の結果は部品が無いときと全く同じ
{
  const a = run(make({ assistantMasmonGrow: true, assistantMasmonPlan: false }), [ROW, ROW2], 60);
  const b = run(make({ assistantMasmonGrow: true }, false), [ROW, ROW2], 60);
  check('① 印が偽なら、育成の結果は今と全く同じ(60回)', JSON.stringify(a) === JSON.stringify(b));
}
const ON = { assistantMasmonGrow: true, assistantMasmonPlan: true };
// ② 保存の正規化
{
  const T = make(ON).T;
  const p = T.normalizeAssistantMasmonPlan({ picks: [1, 2, 3, 4, 5, 6].map(i => ({ aid: 'kiki', slot: i, monster: 'Golem' })).concat([{ aid: 'BAD', slot: 1, monster: 'x' }]), week: { 'kiki:1:Golem': Array(21).fill('H:pow').map((c, i) => (i === 3 ? 'H:magic' : c)), 'kiki:2:Pixie': [1, 2] }, once: { 'kiki:1:Golem': { s: 5, c: 'Z' } }, days: -4, done: { pickMoved_v1: 'yes' } });
  check('② 計画の子は5体まで・おかしな子は捨てる', p.picks.length === 5);
  check('② 知らない予定は「まかせる」に・長さの違う週は捨てる', p.week['kiki:1:Golem'][3] === 'A' && p.week['kiki:1:Golem'][0] === 'H:pow' && !p.week['kiki:2:Pixie']);
  check('② おかしな「次の回だけ」・日数・印は既定値', !p.once['kiki:1:Golem'] && p.days === 0 && !p.done.pickMoved_v1);
  const c = T.normalizeAssistantMasmonCond({ mons: { 'kiki:1:Golem': { k: 'hurt', from: 3, until: 9 }, 'kiki:2:Pixie': { k: 'flu', from: 1, until: 2 } }, log: [{ s: 1, key: 'kiki:1:Golem', k: 'hurt', t: 'start' }, { x: 1 }] });
  check('② けが・病気の保存: 知らない種類は捨てる', !!c.mons['kiki:1:Golem'] && !c.mons['kiki:2:Pixie'] && c.log.length === 1);
  check('② 何も無い・壊れているときは空', JSON.stringify(T.normalizeAssistantMasmonPlan('x').picks) === '[]' && JSON.stringify(T.normalizeAssistantMasmonCond(null).mons) === '{}');
}
// ③ 段
{
  const T = make(ON).T;
  const r = [0, 4, 5, 11, 12, 19, 20, 29, 30, 999].map(d => T.amgpStageOf(d).cap).join(',');
  check('③ 段の区切りは 5・12・20・30 日(1体→5体)', r === '1,1,2,2,3,3,4,4,5,5', r);
}
// ④ 計画の子の数・外しても予定は残る
{
  const ctx = make(ON); const T = ctx.T; T.AMGP_STORE.loaded = true;
  const a = T.amgpSetPick('kiki', ROW, true); const b = T.amgpSetPick('kiki', ROW2, true);
  check('④ 段1では1体だけ選べる', a === true && b === false && T.AMGP_STORE.state.picks.length === 1);
  T.amgpSetCells('kiki:1:Golem', { 0: 'H:pow' }); T.amgpSetPick('kiki', ROW, false);
  check('④ 外しても予定は消さない', T.AMGP_STORE.state.picks.length === 0 && T.AMGP_STORE.state.week['kiki:1:Golem'][0] === 'H:pow');
  T.amgpCopyDay('kiki:1:Golem', 0, 'weekday');
  const w = T.AMGP_STORE.state.week['kiki:1:Golem'];
  check('④ かんたん設定: 月を平日ぜんぶへ写す(土日はそのまま)', w[12] === 'H:pow' && w[15] === 'A');
}
// ⑤⑥⑦ 計画の回
const planned = (codes, slots, seed = SEED, extra = null) => {
  const ctx = make(ON); const T = ctx.T; T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true;
  T.AMGP_STORE.set({ ...T.AMGP_STORE.state, picks: [{ aid: 'kiki', slot: 1, monster: 'Golem', at: S0 }], week: { 'kiki:1:Golem': codes } });
  const st = run(ctx, [ROW, ROW2], slots, extra);
  return { ctx, T, st };
};
{
  const { T, st } = planned(Array(21).fill('L:pow'), 9);
  const e = entry(st, ROW); const pl = e.log.filter(l => l.p);
  check('⑤ 計画の子は予定どおり(軽い訓練・計画の印)', pl.length >= 6 && pl.every(l => l.a === 'light' && l.k === 'pow'), `${pl.length}回`);
  const other = entry(st, ROW2);
  check('⑤ 計画していない子は今までどおり(計画の印なし)', other.log.every(l => !l.p));
  check('⑤ 計画で育てた日が数えられる(1体・9回は4日にまたがる)', T.AMGP_STORE.state.days === 4, String(T.AMGP_STORE.state.days));
}
{
  const { st, T } = planned(Array(21).fill('H:pow'), 60);
  const e = entry(st, ROW);
  const byDay = {}; for (const l of e.log) { const d = Math.floor(l.s / 3); byDay[d] = (byDay[d] || 0) + Object.values(l.g).reduce((a, b) => a + b, 0); }
  check('⑤ 1日の伸びは20まで', Object.values(byDay).every(n => n <= 20), JSON.stringify(byDay));
  check('⑤ 疲れても自動で休まない(休養が入らない)', e.log.every(l => l.a !== 'rest'));
  const evs = T.AMGP_CSTORE.state.log.filter(l => l.t === 'start');
  const idle = e.log.filter(l => ['saboru', 'hurt', 'sick', 'away'].includes(l.a));
  check('⑦ 重い訓練ばかりだと、サボり・けがなどが起きる', idle.length > 0 && (evs.length > 0 || idle.some(l => l.a === 'saboru')), `休み${idle.length}回・できごと${evs.map(x => x.k).join('/')}`);
  check('⑦ サボり・けがの回は伸びない', idle.every(l => Object.keys(l.g).length === 0));
  const again = planned(Array(21).fill('H:pow'), 60).st;
  check('⑥ 同じ種なら同じ結果', JSON.stringify(again) === JSON.stringify(st));
}
// ⑧ 看病・さがす・病院
{
  const ctx = make(ON); const T = ctx.T; T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true; T.AMG_STORE.loaded = true;
  T.AMG_STORE.set(T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), 'kiki', [ROW], SEED, S0));
  const key = 'kiki:1:Golem';
  T.AMG_STORE.set({ ...T.AMG_STORE.state, mons: { kiki: { '1:Golem': { ...entry(T.AMG_STORE.state, ROW), str: 50 } } } });
  T.AMGP_CSTORE.set({ ...T.AMGP_CSTORE.state, mons: { [key]: { k: 'sick', from: S0, until: S0 + 9, care: -1, find: -1, hosp: [] } } });
  const now = slotAt(S0 + 1);
  const a = T.amgpCare(key, now); const b = T.amgpCare(key, now);
  check('⑧ 看病は1日1回・残り1日短く+ストレス−10', a === true && b === false && T.AMGP_CSTORE.state.mons[key].until === S0 + 6 && entry(T.AMG_STORE.state, ROW).str === 40);
  T.AMGP_CSTORE.set({ ...T.AMGP_CSTORE.state, mons: { [key]: { k: 'away', from: S0, until: S0 + 6, care: -1, find: -1, hosp: [] } } });
  check('⑧ 家出は看病できない', T.amgpCare(key, now) === false);
  check('⑧ さがしに行くとその回で戻る・ストレス−40', T.amgpFind(key, now) === true && T.AMGP_CSTORE.state.mons[key].until === S0 + 1 && entry(T.AMG_STORE.state, ROW).str === 0);
  // 病院: 口が返す回は1度だけ効く
  ctx.amgtLifeSlotsToGrow = (abs) => [abs];
  vm.runInContext('var assistantLifeHospitalSlotsOf = (aid) => [this.H, this.H];', ctx); ctx.H = S0 + 2;
  T.AMGP_CSTORE.set({ ...T.AMGP_CSTORE.state, mons: { [key]: { k: 'hurt', from: S0, until: S0 + 6, care: -1, find: -1, hosp: [] } } });
  const e = { ...entry(T.AMG_STORE.state, ROW), str: 30 };
  T.amgpActAt('kiki', ROW, S0 + 3, e, SEED); T.amgpActAt('kiki', ROW, S0 + 4, e, SEED);
  check('⑧ 病院は1回だけ効く(残り1日短く+ストレス−10)', T.AMGP_CSTORE.state.mons[key].until === S0 + 3 && e.str === 20 && T.AMGP_CSTORE.state.mons[key].hosp.length === 1);
  T.AMGP_CSTORE.set({ ...T.AMGP_CSTORE.state, mons: { [key]: { k: 'away', from: S0, until: S0 + 6, care: -1, find: -1, hosp: [] } } });
  T.amgpActAt('kiki', ROW, S0 + 3, e, SEED);
  check('⑧ 家出は病院では戻らない', T.AMGP_CSTORE.state.mons[key].until === S0 + 6);
  // 特別な治療(記録が 'cure' の回): その回でけが・病気の残りが0になる。ふつうの病院の回は今のまま(上の1日短く)
  vm.runInContext('var assistantLifeHospitalCureSlotsOf = (aid) => [this.H];', ctx); ctx.H = S0 + 2;
  T.AMGP_CSTORE.set({ ...T.AMGP_CSTORE.state, mons: { [key]: { k: 'sick', from: S0, until: S0 + 9, care: -1, find: -1, hosp: [] } } });
  const r0 = T.amgpActAt('kiki', ROW, S0 + 3, { ...e }, SEED);
  check('⑧ 特別な治療の回でけが・病気の残りが0(その回から訓練に戻る)', T.AMGP_CSTORE.state.mons[key].until <= S0 + 2 && !T.amgpCondAt(key, S0 + 2) && !(r0 && r0.idle) && T.AMGP_CSTORE.state.log.some(l => l.t === 'cure'));
}
// ⑨ 指定の引き継ぎ
{
  const ctx = make(ON); const T = ctx.T; T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true; T.AMG_STORE.loaded = true;
  ctx.ASSISTANT_MASMON_STORE = { loaded: true, state: {} }; ctx.assistantMasmonRowsOf = () => [ROW, ROW2];
  const g = { ...T.normalizeAssistantMasmonGrow(null), plan: { kiki: { 2: { s: S0 + 1, a: 'heavy', k: 'eva' } } } };
  T.AMG_STORE.set(g); const before = JSON.stringify(T.AMG_STORE.state);
  const a = T.amgpMigrate(slotAt(S0)); const b = T.amgpMigrate(slotAt(S0));
  const p = T.AMGP_STORE.state;
  check('⑨ 指定は1度だけ写す(印 pickMoved_v1)', a === true && b === false && p.done.pickMoved_v1 === true);
  check('⑨ 指定した子が計画の子になり、その回だけ写る', p.picks.length === 1 && p.picks[0].slot === 2 && p.once['kiki:2:Pixie'] && p.once['kiki:2:Pixie'].c === 'H:eva');
  check('⑨ 育成のキー(指定)は書き換えない', JSON.stringify(T.AMG_STORE.state) === before);
}
// ⑩ 次の回だけ変える
{
  const { st } = planned(Array(21).fill('L:pow'), 3, SEED, (s, T) => { if (s === S0 + 2) T.amgpSetOnce('kiki:1:Golem', 'R', slotAt(s - 1)); });
  const l = entry(st, ROW).log.filter(x => x.s >= S0 + 1);
  check('⑩ 次の回だけ変えた回は休み・次はもとの予定', l.find(x => x.s === S0 + 2).a === 'rest' && l.find(x => x.s === S0 + 3).a === 'light', l.map(x => x.a).join(','));
}
// ⑪ 読み込む前は書かない
{
  const ctx = make(ON); const T = ctx.T; const writes = []; ctx.storeSet = (k) => writes.push(k);
  const r = [T.amgpSetPick('kiki', ROW, true), T.amgpSetCells('kiki:1:Golem', { 0: 'R' }), T.amgpSetOnce('kiki:1:Golem', 'R'), T.amgpCare('kiki:1:Golem'), T.amgpMigrate()];
  check('⑪ 読み込む前は、どの操作も書かない', r.every(x => x === false) && writes.length === 0, String(r));
}
// 見通し
{
  const { T, st } = planned(Array(21).fill('H:pow'), 1);
  const fw = T.amgpForecastWeek('kiki', ROW, entry(st, ROW), 'kiki:1:Golem', slotAt(S0 + 1));
  check('見通し: 7日ぶん・重い訓練ばかりなら疲れが70を超える日がある', fw.days.length === 7 && fw.days.some(d => d.fat >= 70) && fw.total.pow && fw.total.pow[0] > 0);
  // fable の指摘(11-12): ① 過ぎた回は数えない(まかせるで計算しない) ③ 1日の上の値も上限20まで・その日にもう伸びた分を引く ② けが等の回は訓練しない
  const e = entry(st, ROW); const d0 = T.amgSlotDay(S0 + 1);
  check('見通し: 今日の過ぎた回(朝・いまの昼)は数えず、夜の疲れは今の疲れから続ける', fw.days[0].f[0] === null && fw.days[0].f[1] === null && fw.days[0].f[2] && fw.days[0].f[2].fat === Math.min(100, e.fat + 14), `${e.fat}→${fw.days[0].f[2] && fw.days[0].f[2].fat}`);
  const hiSum = (d) => d.f.reduce((a, f) => a + (f ? Object.values(f.g).reduce((x, [, b]) => x + b, 0) : 0), 0);
  check('見通し: 1日の伸びの上の値は20まで', fw.days.every(d => hiSum(d) <= 20), fw.days.map(hiSum).join(','));
  const fw2 = T.amgpForecastWeek('kiki', ROW, { ...e, dg: { d: d0, n: 15 } }, 'kiki:1:Golem', slotAt(S0 + 1));
  check('見通し: 今日もう15伸びていたら、今日の見通しは残り5まで', hiSum(fw2.days[0]) <= 5 && hiSum(fw2.days[1]) > 5, `${hiSum(fw2.days[0])}/${hiSum(fw2.days[1])}`);
  T.AMGP_CSTORE.set({ ...T.AMGP_CSTORE.state, mons: { 'kiki:1:Golem': { k: 'hurt', from: S0 + 1, until: S0 + 6, care: -1, find: -1, hosp: [] } } });
  const fw3 = T.amgpForecastWeek('kiki', ROW, e, 'kiki:1:Golem', slotAt(S0 + 1));
  const f3 = fw3.days[1].f[0];
  check('見通し: けがの回は訓練しない(灰色・伸びなし・休みと同じ疲れの減り)', f3 && f3.cond === 'hurt' && Object.keys(f3.g).length === 0 && fw3.days[1].f.every(f => f && f.cond === 'hurt') && hiSum(fw3.days[2]) > 0);
}

// ⑫ 冬眠(56-assistant-life-masmon-sleep.jsx)
{
  const sleep = read('monster-hero/src/parts/56-assistant-life-masmon-calc.jsx') + '\n' + cut(read('monster-hero/src/parts/56-assistant-life-masmon-sleep.jsx'));
  const ctx = make({ ...ON, assistantMasmonSleep: true });
  vm.runInContext(['var ALL_PLAYER_MONSTERS = { Golem: {}, Pixie: {}, Tiger: {} };', 'var MS = { seed: "x", mine: { kiki: { former: { 2: [{ monster: "Tiger", nick: "トラ", lv: 28, colors: ["blue"], at: "2026-11-02" }] } } } };',
    'var ASSISTANT_MASMON_STORE = { loaded: true, state: MS };', 'var ROWS = [{ slot: 1, monster: "Golem", nick: "ゴロ", lv: 20, grow: "攻撃型" }, { slot: 2, monster: "Pixie", nick: "ピピ", lv: 15 }];',
    'var assistantMasmonRowsOf = () => ROWS;', 'var SW = []; var assistantMasmonSleepSwap = (aid, slot, back, ff) => { SW.push([aid, slot, back.monster, ff]); const r = ROWS.find(x => x.slot === slot); const out = { ...r }; ROWS = ROWS.map(x => (x.slot === slot ? { ...back, slot } : x)); return out; };',
    sleep, 'this.S = { normalizeAssistantMasmonSleep, AMGS_STORE, amgsSyncFormer, amgsSwap, amgsCapOf };'].join('\n'), ctx);
  const S = ctx.S; const T = ctx.T;
  const n = S.normalizeAssistantMasmonSleep({ beds: [{ id: 'b1', aid: 'kiki', slot: 2, row: { monster: 'Tiger', nick: 'x' } }, { id: 'b1', aid: 'kiki', slot: 2, row: { monster: 'Tiger' } }, { id: 'b2', aid: 'kiki', slot: 9, row: { monster: 'Tiger' } }, { id: 'b3', aid: 'kiki', slot: 1, row: { monster: 'Nope' } }] });
  check('⑫ 冬眠の保存: 同じ id・おかしな枠・知らない種類は捨てる', n.beds.length === 1 && n.seq === 1);
  check('⑫ しまえる数は はじめ10・段ごとに+5・最大30', [0, 5, 12, 20, 30].map(S.amgsCapOf).join(',') === '10,15,20,25,30');
  T.AMG_STORE.loaded = true; T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true; S.AMGS_STORE.loaded = true;
  T.AMG_STORE.set(T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), 'kiki', [ROW, ROW2], SEED, S0));
  const a = S.amgsSyncFormer(); const b = S.amgsSyncFormer();
  check('⑫ 前にいたマスモンは1度だけ冬眠の一覧に並ぶ(元の保存はそのまま)', a === true && b === false && S.AMGS_STORE.state.beds.length === 1 && ctx.MS.mine.kiki.former[2].length === 1);
  const pow = entry(T.AMG_STORE.state, ROW2).st.pow;
  const id = S.AMGS_STORE.state.beds[0].id;
  const r = S.amgsSwap(id, 2, slotAt(S0)); if (r !== true) console.log('  理由:', r);
  const bed = S.AMGS_STORE.state.beds.find(x => x.row.monster === 'Pixie');
  check('⑫ 入れ替えると、出た子の6能力をそのまま写して眠らせる', r === true && bed && bed.g && bed.g.st.pow === pow && ctx.SW[0][3] && ctx.SW[0][3].at === '2026-11-02');
  ctx.ROWS = ctx.ROWS; const r2 = S.amgsSwap(bed.id, 2, slotAt(S0));
  check('⑫ 起こすと、眠らせたときの6能力に戻る', r2 === true && entry(T.AMG_STORE.state, ROW2).st.pow === pow);
  check('⑫ もういない冬眠の子は起こせない', S.amgsSwap(id, 2) !== true);
}

// ⑬ 合体(56-assistant-life-masmon-sleep.jsx・FUSE.md 第2版)
{
  const sleep = read('monster-hero/src/parts/56-assistant-life-masmon-calc.jsx') + '\n' + cut(read('monster-hero/src/parts/56-assistant-life-masmon-sleep.jsx'));
  const ctx = make({ ...ON, assistantMasmonSleep: true, assistantMasmonFuse: true });
  vm.runInContext(['var ALL_PLAYER_MONSTERS = { Golem: {}, Pixie: {}, Tiger: {}, Mocchi: {} };', 'var MS = { seed: "x", mine: { kiki: { former: { 2: [{ monster: "Tiger", nick: "トラ", lv: 28, at: "2026-11-02" }] } } } };',
    'var ASSISTANT_MASMON_STORE = { loaded: true, state: MS };', 'var DROP = []; var assistantMasmonFormerDrop = (aid, slot, mo, at) => { DROP.push([aid, slot, mo, at]); return true; };',
    'var AMGT_SENSE_KEYS = ["guard"]; var amgtTechsOf = (mo) => (mo === "Mocchi" ? [{ id: "mocchi_01", name: "たいあたり" }, { id: "mocchi_02", name: "ころがる" }] : [{ id: "tiger_01", name: "たいあたり" }, { id: "tiger_02", name: "かみつく" }]);',
    'var normalizeAssistantMasmonTrain = (raw) => raw;',
    sleep, 'this.S = { normalizeAssistantMasmonFuse, AMGS_STORE, AMGS_FSTORE, amgsFuse, amgsFuseBonus, amgsFusePlan };'].join('\n'), ctx);
  const S = ctx.S;
  const b = (v) => S.amgsFuseBonus(v, v);
  check('⑬ 上乗せ: 平均999で+200・強いほど割合が大きい', b(999) === 200 && b(100) / 100 < b(500) / 500 && b(500) / 500 < b(999) / 999, `${b(100)}/${b(500)}/${b(999)}`);
  check('⑬ 上乗せ: 片方だけ強い(999と100)は、中くらい2体(500)の4分の1以下', S.amgsFuseBonus(999, 100) * 4 <= b(500), `${S.amgsFuseBonus(999, 100)}`);
  const st = (v) => ({ life: v, pow: v, wise: v, hit: v, eva: v, tough: v });
  const g = (v, lv) => ({ st: st(v), fat: 40, str: 30, ind: { life: 1, pow: 0, wise: 0, hit: 0, eva: 0, tough: -1 }, log: [{ s: 1, a: 'light', k: 'pow', g: {} }], src: 'init_v1', dg: { d: 9, n: 3 }, lv, xp: 5 });
  const beds = [
    { id: 'b1', aid: 'kiki', slot: 3, src: 'sleep', at: '2026-11-10', fat: '', row: { monster: 'Mocchi', nick: 'もち', lv: 30, grow: '攻撃型', colors: ['red'] }, g: g(999, 40), t: { m: { guard: 80, mocchi_01: 60 }, learn: ['mocchi_01'], day: { d: 3, n: 1 }, log: [], src: 'init_v1' }, c: null },
    { id: 'b2', aid: 'kiki', slot: 2, src: 'former', at: '2026-11-02', fat: '2026-11-02', row: { monster: 'Tiger', nick: 'トラ', lv: 28 }, g: g(999, 35), t: { m: { guard: 20, tiger_01: 90, tiger_02: 50 }, learn: ['tiger_01', 'tiger_02'], day: { d: 3, n: 1 }, log: [], src: 'init_v1' }, c: null },
    { id: 'b3', aid: 'momo', slot: 2, src: 'sleep', at: '2026-11-02', fat: '', row: { monster: 'Golem', nick: 'ゴロ', lv: 10 }, g: g(300, 10), t: null, c: null },
  ];
  S.AMGS_STORE.loaded = true; S.AMGS_FSTORE.loaded = true; S.AMGS_STORE.set({ v: 1, beds, seen: {}, seq: 3 });
  check('⑬ ほかの助手のマスモンとは合体できない', S.amgsFuse('b1', 'b3') !== true && S.AMGS_STORE.state.beds.length === 3);
  check('⑬ 同じマスモンどうしでは合体できない', S.amgsFuse('b1', 'b1') !== true);
  const r = S.amgsFuse('b1', 'b2'); if (r !== true) console.log('  理由:', r);
  const nb = S.AMGS_STORE.state.beds; const out = nb.find(x => x.row.monster === 'Mocchi');
  check('⑬ 素材はいなくなり、主は1体として残る', r === true && nb.length === 2 && !nb.some(x => x.id === 'b1' || x.id === 'b2') && !!out);
  check('⑬ 6能力は 主の種類の初期値 + 上乗せ(モッチーのライフ 110+200)', out && out.g.st.life === 310 && out.g.st.pow === 300, out ? JSON.stringify(out.g.st) : '');
  check('⑬ Lv・育成Lv は1、疲れ・ストレスは0、型・名前・色・個体差は主のまま', out && out.row.lv === 1 && out.g.lv === 1 && out.g.xp === 0 && out.g.fat === 0 && out.g.str === 0 && out.row.grow === '攻撃型' && out.row.nick === 'もち' && out.row.colors[0] === 'red' && out.g.ind.life === 1);
  check('⑬ 技: 主の技は残り、素材の技は主の種類でも覚えられる物だけ・熟練は高い方の半分', out && out.t && out.t.learn.join() === 'mocchi_01' && out.t.m.mocchi_01 === 45 && out.t.m.guard === 40 && !out.t.learn.includes('tiger_02'), out && out.t ? JSON.stringify(out.t) : '');
  check('⑬ 合体の記録を書き、前にいた子は元の記録からも外す', S.AMGS_FSTORE.state.log.length === 1 && S.AMGS_FSTORE.state.log[0].mat.monster === 'Tiger' && ctx.DROP.length === 1 && ctx.DROP[0][3] === '2026-11-02');
  check('⑬ 二度押しても、いなくなった素材ではもう合体できない', S.amgsFuse('b1', 'b2') !== true && S.AMGS_STORE.state.beds.length === 2 && S.AMGS_FSTORE.state.log.length === 1);
  const n = S.normalizeAssistantMasmonFuse({ log: [{ aid: 'kiki', main: { monster: 'Mocchi', st: { life: 5000 } }, mat: { monster: 'Nope' } }, { aid: 'kiki', main: { monster: 'Mocchi' }, mat: { monster: 'Tiger', st: { pow: 'x' } } }], seq: 'x' });
  check('⑬ 合体の記録の保存: 知らない種類は捨て、壊れた値は既定へ', n.log.length === 1 && n.log[0].mat.st.pow === 0 && n.seq === 1);
}

// 試算(--sim): 計画なし/休みを入れた計画/重い訓練ばかり の 30・90 日
if (process.argv.includes('--sim')) {
  const DAYS = process.argv.slice(process.argv.indexOf('--sim') + 1).map(Number).filter(n => n > 0);
  const days = DAYS.length ? DAYS : [30, 90];
  const W = (f) => Array.from({ length: 21 }, (_, i) => f(Math.floor(i / 3), i % 3));
  const STY = [
    ['計画なし(助手まかせ)', null],
    ['休みを入れた計画(重・軽・夜休み/日曜休み)', W((d, p) => (d === 6 ? 'R' : p === 0 ? 'H:pow' : p === 1 ? 'L:pow' : 'R'))],
    ['重い訓練を週3日続ける(ほか軽・夜休み)', W((d, p) => (d <= 2 ? 'H:pow' : p === 2 ? 'R' : 'L:pow'))],
    ['重い訓練ばかり', W(() => 'H:pow')],
  ];
  for (const n of days) for (const [name, codes] of STY) {
    const rs = [1, 2, 3, 4, 5].map(i => {
      const seed = `sim-${i}`; const ctx = make(ON); const T = ctx.T; T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true;
      if (codes) T.AMGP_STORE.set({ ...T.AMGP_STORE.state, picks: [{ aid: 'kiki', slot: 1, monster: 'Golem', at: S0 }], week: { 'kiki:1:Golem': codes } });
      T.AMG_STORE.loaded = true; let st = T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), 'kiki', [ROW], seed, S0); const s0 = { ...entry(st, ROW).st };
      for (let s = S0 + 1; s <= S0 + n * 3; s++) { T.AMG_STORE.set(st); st = T.amgCatchUp(st, 'kiki', [ROW], seed, s); }
      const e = entry(st, ROW); const ev = T.AMGP_CSTORE.state.log.filter(l => l.t === 'start');
      return { sum: AMGsum(e.st) - AMGsum(s0), pow: e.st.pow - s0.pow, hurt: ev.filter(x => x.k === 'hurt').length, sick: ev.filter(x => x.k === 'sick').length, away: ev.filter(x => x.k === 'away').length, sab: e.log.length ? 0 : 0, days: T.AMGP_STORE.state.days };
    });
    const avg = (f) => Math.round(rs.reduce((a, r) => a + f(r), 0) / rs.length * 10) / 10;
    console.log(`${n}日 ${name}: 合計 +${avg(r => r.sum)} ・ ちから +${avg(r => r.pow)} ・ けが ${avg(r => r.hurt)} ・ 病気 ${avg(r => r.sick)} ・ 家出 ${avg(r => r.away)} ・ 計画した日 ${avg(r => r.days)}`);
  }
}
function AMGsum(st) { return Object.values(st).reduce((a, b) => a + b, 0); }
console.log(ng ? `\n${ng}件のNGがあります` : '\nすべて OK');
process.exit(ng ? 1 : 0);
