#!/usr/bin/env node
// 育成ノート(56-assistant-life-masmon-plan.jsx・助手のマスモンを計画して育てる)を、画面なしで確かめる。2026-11-12 キズナ
//   node tools/assistant/assistant-masmon-note-check.js          検査
//   node tools/assistant/assistant-masmon-note-sim.js 相当の試算は  --sim [日数...](30・90 日の計画あり/なしの差・けがなどの回数)
//   ① 印が偽なら育成の結果は今と全く同じ ② 保存の正規化(壊れた値・知らない予定は「まかせる」・計画の子は5体まで)
//   ③ 段 7・21・42・70 日 ④ 計画の子の数は段まで・外しても予定は消さない ⑤ 計画の回は 1.3倍・失敗半分・1日20まで・自動で休まない
//   ⑥ 同じ種なら同じ結果 ⑦ けが・病気・家出・サボりが起き、その間は伸びない・能力は下がらない ⑧ 看病・さがす・病院(1回ずつ)
//   ⑨ 指定の引き継ぎは1度だけ・育成のキーは書き換えない ⑩ 次の回だけ変える ⑪ 読み込む前は書かない
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
  const r = [0, 6, 7, 20, 21, 41, 42, 69, 70, 999].map(d => T.amgpStageOf(d).cap).join(',');
  check('③ 段の区切りは 7・21・42・70 日(1体→5体)', r === '1,1,2,2,3,3,4,4,5,5', r);
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
