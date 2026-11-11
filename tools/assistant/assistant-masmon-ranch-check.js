#!/usr/bin/env node
// M/B管理にいる助手のマスモンにチケットを使ってあげる(56-assistant-life-masmon-ranch.jsx・ボクジョウ 2026-11-11)を、画面なしで確かめる。
//   印が偽なら何もしない/M/B管理にいないと使えない/時間帯ごとに1人1枚/同じマスモンは1日1枚/チケットが無いと使えず印も残さない/
//   トレーニング=選んだ能力だけ上がる/重トレ=大きく上がる・少し上がる・下がる・疲れ/1日の上限(dg)を使わない/999で止まる/保存の正規化/旧 1.2倍 は止まる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const masmon = read('monster-hero/src/parts/56-assistant-life-masmon.jsx');
const growAll = read('monster-hero/src/parts/56-assistant-life-masmon-grow.jsx');
const grow = growAll.slice(0, growAll.indexOf('// ---------- 画面'));
const ranchAll = read('monster-hero/src/parts/56-assistant-life-masmon-ranch.jsx');
const ranch = ranchAll.slice(0, ranchAll.indexOf('// ---------- 画面'));
const line = (name) => { const m = masmon.match(new RegExp(`^const ${name} = .*$`, 'm')); if (!m) throw new Error(`${name} が見つからない`); return m[0]; };
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const tickets = { training_ticket: 2, training_ticket_l: 1 };
const where = { kiki: 'ranch', mua: 'plaza' };
const ctx = {
  console, setTimeout: () => 0,
  RELEASE_FLAGS: { assistantMasmonGrow: true, assistantMasmonRanchTicket: true },
  ASSISTANT_LIFE_STORE: { state: { life: { abs: 500 } } },
  ASSISTANT_LIFE_LINKS: { ticketCount: (id) => tickets[id] || 0, ticketSpend: (id) => { if (!(tickets[id] > 0)) return false; tickets[id] -= 1; return true; } },
  assistantLifeWhereOf: (life, id) => ({ place: where[id] || 'home' }),
  ALL_PLAYER_MONSTERS: { Golem: { name: 'ゴーレム' }, Pixie: { name: 'ピクシー' } },
};
vm.createContext(ctx);
vm.runInContext([
  line('assistantMasmonRng'),
  "const assistantMasmonGrowKind = (g) => String(g || '').split('(')[0];",
  "const assistantMasmonStats = (t) => ({ hp: 0.4, atk: 0.5, def: 0.3, guts: 0.4 });",
  "const ASSISTANT_MASMON_STORE = { state: { seed: 'seed-r' } };",
  "const ROWS = [{ slot: 1, monster: 'Golem', nick: 'ごろべえ', lv: 25, grow: '攻撃型(ちからに振る)' }, { slot: 2, monster: 'Pixie', nick: 'ぴく', lv: 12, grow: 'すばやさ型' }];",
  "const assistantMasmonRowsOf = (st, aid) => (aid === 'kiki' || aid === 'mua' ? ROWS : []);",
  grow, ranch,
  'this.T = { AMG_STORE, AMGR_STORE, amgCatchUp, amgSlotOf, normalizeAssistantMasmonGrow, normalizeAssistantMasmonRanch, assistantMasmonRanchRowInfo, assistantMasmonRanchUse, assistantMasmonTrainBoost, amgActName, AMG_HEAVY, AMG_SUB, AMGR_DOWN, AMG_MAX };',
].join('\n'), ctx);
const T = ctx.T;
const now = Date.UTC(2026, 10, 12, 1, 0); // 10:00 JST
const writes = [];
ctx.storeSet = (k, v) => writes.push(k);
// 読み込む前は書かない
{
  const r = T.assistantMasmonRanchUse('kiki', '1:Golem', 'light', 'pow', now);
  check('⓪ 読み込む前は使えない(書かない)', !r.ok && writes.length === 0 && tickets.training_ticket === 2, JSON.stringify(r));
}
T.AMG_STORE.loaded = true; T.AMGR_STORE.loaded = true;
T.AMG_STORE.state = T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), 'kiki', [{ slot: 1, monster: 'Golem', nick: 'ごろべえ', lv: 25, grow: '攻撃型(ちからに振る)' }, { slot: 2, monster: 'Pixie', nick: 'ぴく', lv: 12, grow: 'すばやさ型' }], 'seed-r', T.amgSlotOf(now));
const st = (key) => ({ ...T.AMG_STORE.state.mons.kiki[key].st });
const dg0 = JSON.stringify(T.AMG_STORE.state.mons.kiki['1:Golem'].dg);
// ① 地図の行
{
  const a = T.assistantMasmonRanchRowInfo('kiki', now); const b = T.assistantMasmonRanchRowInfo('mua', now);
  check('① M/B管理にいる助手には頼みが出る・いない助手は null', a && a.ask && a.ask.stat && !a.used && b === null, JSON.stringify(a && a.ask));
  const a2 = T.assistantMasmonRanchRowInfo('kiki', now);
  check('① 同じ時間帯なら同じ頼み', JSON.stringify(a.ask) === JSON.stringify(a2.ask));
  const r = T.assistantMasmonRanchUse('mua', '1:Golem', 'light', 'pow', now);
  check('① M/B管理にいない助手には使えない', !r.ok && /M\/B管理/.test(r.why), r.why);
}
// ② トレーニング
{
  const before = st('1:Golem');
  const r = T.assistantMasmonRanchUse('kiki', '1:Golem', 'light', 'pow', now);
  const after = st('1:Golem');
  const changed = Object.keys(after).filter(k => after[k] !== before[k]);
  check('② トレーニング: 選んだ能力だけが上がる(+3〜6 × 伸びやすさ)', r.ok && changed.length === 1 && changed[0] === 'pow' && after.pow - before.pow >= 2 && after.pow - before.pow <= 8, JSON.stringify(r.rows));
  check('② チケットが1枚減る', tickets.training_ticket === 1);
  check('② 1日の伸びの上限(dg)は使わない', JSON.stringify(T.AMG_STORE.state.mons.kiki['1:Golem'].dg) === dg0);
  const e = T.AMG_STORE.state.mons.kiki['1:Golem']; const lg = e.log[e.log.length - 1];
  check('② 育成の記録に1行(あなたのトレーニングチケット)', lg.a === 'tkt' && /トレーニングチケット/.test(T.amgActName(lg)), T.amgActName(lg));
  check('② 関わって伸びた分(ranch)に入る', (e.cg.ranch || 0) >= 2);
  const r2 = T.assistantMasmonRanchUse('kiki', '2:Pixie', 'light', 'eva', now);
  check('② 同じ時間帯に2枚目は使えない', !r2.ok && /この時間帯/.test(r2.why) && tickets.training_ticket === 1, r2.why);
  const info = T.assistantMasmonRanchRowInfo('kiki', now);
  check('② 使ったあとは used と結果(いくつ→いくつ)が出る', info.used && info.last && info.last.rows[0].k === 'pow');
}
// ③ 次の時間帯: 同じマスモンは1日1枚・別のマスモンには重トレ
{
  ctx.ASSISTANT_LIFE_STORE.state.life.abs = 501;
  const r = T.assistantMasmonRanchUse('kiki', '1:Golem', 'heavy', 'pow', now);
  check('③ 同じマスモンには1日1枚', !r.ok && /今日もう/.test(r.why) && tickets.training_ticket_l === 1, r.why);
  const before = st('2:Pixie');
  const fat0 = T.AMG_STORE.state.mons.kiki['2:Pixie'].fat;
  const h = T.assistantMasmonRanchUse('kiki', '2:Pixie', 'heavy', 'pow', now);
  const after = st('2:Pixie');
  const d = (k) => after[k] - before[k];
  check('③ 重トレ: 大きく上がる・少し上がる・下がる が決まった能力', h.ok && d('pow') >= 5 && d(T.AMG_SUB.pow) >= 1 && d(T.AMGR_DOWN.pow) <= -2 && d(T.AMGR_DOWN.pow) >= -4,
    `ちから ${d('pow')} / ${T.AMG_SUB.pow} ${d(T.AMG_SUB.pow)} / ${T.AMGR_DOWN.pow} ${d(T.AMGR_DOWN.pow)}`);
  check('③ 重トレ: 疲れ +10・重トレーニングチケットが1枚減る', T.AMG_STORE.state.mons.kiki['2:Pixie'].fat === Math.min(100, fat0 + 10) && tickets.training_ticket_l === 0);
  check('③ 名前は自主育成の重い訓練と同じ', h.name === T.AMG_HEAVY.pow);
}
// ④ チケットが無い: 使えず、時間帯の印も残さない
{
  ctx.ASSISTANT_LIFE_STORE.state.life.abs = 502;
  const r = T.assistantMasmonRanchUse('kiki', '1:Golem', 'heavy', 'life', now + 86400000);
  check('④ 重トレーニングチケットが無いと使えない', !r.ok && /足りません/.test(r.why), r.why);
  check('④ そのとき時間帯の印を残さない', !(T.AMGR_STORE.state.used.kiki || []).includes(502));
}
// ⑤ 999 で止まる
{
  ctx.ASSISTANT_LIFE_STORE.state.life.abs = 503;
  const S = T.AMG_STORE.state; S.mons.kiki['1:Golem'].st.life = 998;
  tickets.training_ticket = 1;
  const r = T.assistantMasmonRanchUse('kiki', '1:Golem', 'light', 'life', now + 86400000);
  check('⑤ 上限 999 で止まる', r.ok && st('1:Golem').life === T.AMG_MAX, JSON.stringify(r.rows));
}
// ⑥ 保存の正規化
{
  const n = T.normalizeAssistantMasmonRanch({ used: { kiki: [1, 'x', 2, 2], BAD: [1] }, mon: { kiki: { '1:Golem': 3, 'zz': 4 } }, last: { kiki: { a: 5, nick: 'ごろべえ', kind: 'heavy', rows: [{ k: 'pow', from: 1, to: 2000 }, { k: 'nope', from: 1, to: 2 }] } } });
  check('⑥ 正規化: 変な値を落とし、形をそろえる', JSON.stringify(n.used) === '{"kiki":[1,2]}' && JSON.stringify(n.mon) === '{"kiki":{"1:Golem":3}}' && n.last.kiki.rows.length === 1 && n.last.kiki.rows[0].to === 999);
  check('⑥ 正規化: 無い・壊れた保存は既定値', JSON.stringify(T.normalizeAssistantMasmonRanch('x')) === '{"v":1,"used":{},"mon":{},"last":{}}');
}
// ⑦ 印が真なら旧 1.2倍 は受けない・印が偽なら何もしない
{
  check('⑦ 印が真なら旧の 1.2倍(assistantMasmonTrainBoost)は受けない', T.assistantMasmonTrainBoost('kiki', { source: 'ranch' }, now) === false);
  ctx.RELEASE_FLAGS.assistantMasmonRanchTicket = false;
  check('⑦ 印が偽なら行は null・使えない', T.assistantMasmonRanchRowInfo('kiki', now) === null && T.assistantMasmonRanchUse('kiki', '2:Pixie', 'light', 'pow', now).ok === false);
  check('⑦ 印が偽なら旧の 1.2倍 はいまのまま受ける', T.assistantMasmonTrainBoost('kiki', { source: 'ranch' }, now) === true);
}
console.log(ng ? `NG ${ng}件` : 'すべてOK');
process.exit(ng ? 1 : 0);
