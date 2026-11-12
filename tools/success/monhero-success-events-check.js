#!/usr/bin/env node
// モンヒロサクセスのランダムイベント(monster-hero/data/monhero-success-events.js)の見張り。画面は開かない(数秒)。
//   ・表の形: id が重ならない・台本 random.js に場面がある・選択肢の記号が台本の札と同じ・結果の場面(ok/ng・おみくじ)がある
//   ・1つの選択肢で動くのは3項目まで・能力は下がらない(EVENTS §3)・知らない項目を使わない
//   ・決まった乱数: 同じ手なら同じ出来事・同じ結果。選ぶ前に保存して戻しても、同じ出来事・同じ結果(引き直せない)
//   ・保存から戻す: 壊れた s.ev は「出来事なし・状態なし」に直る
//   ・ひとときの状態は同時に2つまで・残りターンで消える・効き(🔥 大成功 +10% など)が芯に届く
//   ・46ターン通しで、1回の育成の出来事が 約20回(15〜28)・決まって起きる季節と期の目標が出る
//   ・Math.random・Date・window・localStorage を使わない
'use strict';
const fs = require('fs');
const path = require('path');
const { load, ROOT } = require('./load');

const { SUC } = load();
const EV = SUC.events;
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
if (!EV) { console.error('NG monhero-success-events-check: 芯に SUC.events が無い'); process.exit(1); }

// ---- 中身の決まり ----
const FILE = path.join(ROOT, 'monster-hero', 'data', 'monhero-success-events.js');
const src = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
for (const bad of ['Math.random', 'Date.now', 'new Date', 'window.', 'localStorage']) ok(!src.includes(bad), `出来事の部品が ${bad} を使っている`);
const html = fs.readFileSync(path.join(ROOT, 'monster-hero', 'index.html'), 'utf8');
ok(!html.includes('monhero-success-events.js') || html.includes('monhero-success.js'), 'monhero-success-events.js だけが index.html から読まれている');

// ---- 表の形と台本 ----
const { MONSUC_SCRIPT_RANDOM } = require(path.join(ROOT, 'docs', 'progress', 'player-raise', 'script', 'random.js'));
const scenes = new Set(); const choiceRows = {};
for (const r of MONSUC_SCRIPT_RANDOM) {
  const parts = r.id.split('.');
  const scene = parts.slice(0, -1).join('.');
  scenes.add(scene); scenes.add(parts.slice(0, 3).join('.'));
  if (r.who === 'choice') (choiceRows[parts.slice(0, 3).join('.')] = choiceRows[parts.slice(0, 3).join('.')] || []).push(r.c);
}
const OPS = ['st', 'loy', 'fear', 'pop', 'popHi', 'hp', 'str', 'bond', 'buff', 'fame', 'pts', 'mas', 'flag', 'goal'];
const ids = new Set();
const checkFx = (id, fx, where) => {
  if (!Array.isArray(fx)) { errors.push(`${id} ${where}: 結果が並びでない`); return; }
  ok(fx.length <= 3, `${id} ${where}: 動く項目が3つを超えた(${fx.length})`);
  for (const f of fx) {
    ok(OPS.includes(f[0]), `${id} ${where}: 知らない項目 ${f[0]}`);
    if (f[0] === 'st') { ok(Number(f[2]) > 0, `${id} ${where}: 能力が下がる(出来事では下げない)`); ok(SUC.KEYS.includes(f[1]) || EV.STAT_TARGETS.includes(f[1]), `${id} ${where}: 能力の対象 ${f[1]} が分からない`); }
    if (f[0] === 'buff') ok(Boolean(EV.BUFFS[f[1]]), `${id} ${where}: 知らない状態 ${f[1]}`);
  }
};
for (const e of EV.LIST) {
  ok(!ids.has(e.id), `id が重なっている: ${e.id}`); ids.add(e.id);
  ok(/^ev\.(daily|team|self|goal|season|small|body|cup)\.[a-z0-9]+$/.test(e.id) && e.id.split('.')[1] === e.kind, `id と種類が合わない: ${e.id}`);
  ok(scenes.has(e.id), `台本 random.js に場面が無い: ${e.id}`);
  const hasCh = e.ch && (e.ch.a || e.ch.b);
  const letters = hasCh ? Object.keys(e.ch).sort() : [];
  const script = (choiceRows[e.id] || []).slice().sort();
  if (e.id !== 'ev.season.jan1') ok(JSON.stringify(letters) === JSON.stringify(script), `${e.id}: 選択肢 ${letters.join('') || 'なし'} と台本の札 ${script.join('') || 'なし'} が合わない`);
  if (hasCh) for (const [c, v] of Object.entries(e.ch)) {
    if (v.lottery) continue;
    if (v.p) { ok(v.p > 0 && v.p < 1, `${e.id} ${c}: 確率が0〜1でない`); checkFx(e.id, v.ok, `${c}.ok`); checkFx(e.id, v.ng, `${c}.ng`); if (v.scene) Object.values(v.scene).forEach(sc => ok(scenes.has(sc), `${e.id}: 結果の場面 ${sc} が台本に無い`)); }
    else checkFx(e.id, v.fx, c);
  } else if (e.ch) checkFx(e.id, e.ch.fx || [], '見るだけ');
}
for (const o of EV.OMIKUJI) { ok(scenes.has(`ev.small.omikuji.${o.key}`), `おみくじ ${o.key} の場面が台本に無い`); checkFx('omikuji', o.fx, o.key); }
ok(Math.abs(EV.OMIKUJI.reduce((a, o) => a + o.p, 0) - 1) < 1e-9, 'おみくじの確率の合計が1でない');
// 台本にある出来事は表にもある(台詞だけあって起きない、を防ぐ)
for (const sc of scenes) if (/^ev\.[a-z]+\.[a-z0-9]+$/.test(sc)) ok(ids.has(sc), `台本にある出来事が表に無い: ${sc}`);
ok(EV.LIST.length >= 50, `出来事が50種より少ない: ${EV.LIST.length}`);

// ---- 46ターン通し(大会は勝ち負けを決まった乱数で) ----
const pickOf = (s, ev) => (ev.watch ? null : (ev.choices.find(c => c.ok) || ev.choices[0]).c);
const play = (id, withRestore) => {
  let s = SUC.newRun({ id, species: SUC.speciesList[id.length % SUC.speciesList.length], aid: SUC.AIDS[id.length % SUC.AIDS.length] });
  const log = []; let g = 0;
  const step = (slot, o) => {
    let r = EV.open(s, slot, o); s = r.state; if (!r.out.ev) return;
    if (withRestore) { s = SUC.restore(JSON.parse(JSON.stringify(s))); const again = EV.open(s, slot, o); ok(again.out.ev && again.out.ev.id === r.out.ev.id, `保存して戻したら出来事が変わった: ${r.out.ev.id}`); s = again.state; }
    const p = EV.pick(s, pickOf(s, r.out.ev)); ok(p.out.ok, `選べなかった: ${r.out.ev.id} ${p.out.why}`); s = p.state;
    log.push(`${s.turn}:${p.out.id}:${p.out.c || '-'}:${p.out.res || ''}:${JSON.stringify(p.out.delta.stats)}`);
  };
  while (!s.over && g++ < 200) {
    if (s.battle) { const k = s.battle.kind; const won = SUC.rngOf(id, s.turn, k, 'won')() < 0.75; const r = SUC.settle(s, [won]); s = r.state; step('cup', { won: r.out.won, kind: k }); continue; }
    step('start');
    const v = SUC.peek(s);
    const a = v.can.includes('cond') ? { kind: 'cond' } : v.can.includes('retry') ? { kind: 'retry' } : s.hp < s.hpMax * 0.4 ? { kind: 'rest' } : s.stress >= 60 ? { kind: 'play' } : { kind: 'train', stat: SUC.KEYS[s.turn % 6] };
    s = SUC.act(s, a).state;
    if (s.last && s.last.kind === 'train') { s = SUC.react(s, 'praise').state; step('after'); }
    s = SUC.endTurn(s).state;
  }
  return { s, log };
};
const A = play('ev-check-1', false); const B = play('ev-check-1', false); const R = play('ev-check-1', true);
ok(JSON.stringify(A.log) === JSON.stringify(B.log), '同じ手なのに出来事が変わった(決まった乱数でない)');
ok(JSON.stringify(A.log) === JSON.stringify(R.log), '途中で保存して戻すと出来事や結果が変わった(引き直せてしまう)');
ok(JSON.stringify(A.s.stats) === JSON.stringify(R.s.stats), '途中で保存して戻すと能力が変わった');

const counts = []; const kinds = {}; let seasonRuns = 0; let goalRuns = 0;
for (let i = 0; i < 60; i++) {
  const { log } = play(`ev-count-${i}`, false); counts.push(log.length);
  log.forEach(l => { const k = l.split(':')[1].split('.')[1]; kinds[k] = (kinds[k] || 0) + 1; });
  if (log.filter(l => l.includes('ev.season.')).length >= 6) seasonRuns += 1;
  if (log.filter(l => l.includes('ev.goal.pick')).length === 3) goalRuns += 1;
}
const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
ok(avg >= 15 && avg <= 28, `1回の育成の出来事が 約20回(15〜28)でない: ${avg.toFixed(1)}`);
ok(seasonRuns >= 50, `季節の行事が6つ以上出た育成が少ない: ${seasonRuns}/60`);
ok(goalRuns >= 55, `期の目標(ジュニア・ミドル・プロ)の3回がそろわない育成が多い: ${goalRuns}/60`);
for (const k of ['daily', 'team', 'self', 'season', 'goal']) ok((kinds[k] || 0) > 0, `${k} の出来事が1回も出ない`);

// ---- 保存から戻す(壊れた値) ----
let s0 = SUC.newRun({ id: 'ev-norm', species: SUC.speciesList[0] });
const bad = SUC.restore({ ...JSON.parse(JSON.stringify(s0)), ev: { v: 'x', seen: 'abc', buff: [{ k: 'nope', left: 3 }, { k: 'yaruki', left: 'zz' }], pend: { id: 'ev.nope', slot: 'start' }, gap: -5, goal: { junior: 'xx' } } });
ok(bad && bad.ev && Array.isArray(bad.ev.seen) && bad.ev.seen.length === 0 && bad.ev.pend === null && bad.ev.gap === 0 && !bad.ev.goal.junior, '壊れた s.ev が既定に直らない');
ok(bad.ev.buff.length === 1 && bad.ev.buff[0].k === 'yaruki' && bad.ev.buff[0].left === 3, '壊れた状態の残りターンが既定に直らない');
const noEv = SUC.restore(JSON.parse(JSON.stringify(s0))); ok(noEv && noEv.ev && noEv.ev.buff.length === 0, 's.ev が無い保存(前の版)から戻せない');

// ---- ひとときの状態(2つまで・消える・効き) ----
let s = SUC.restore({ ...JSON.parse(JSON.stringify(s0)), ev: { v: 1, buff: [{ k: 'yaruki', left: 3 }] } });
const card = Object.values(SUC.peek(s).cards)[0];
const g0 = SUC.greatRateOf(SUC.newRun({ id: 'ev-norm', species: SUC.speciesList[0] }), card);
ok(Math.abs(SUC.greatRateOf(s, card) - g0 - EV.EFFECT.great) < 1e-9, '🔥やる気満々で大成功が +10% にならない');
s.ev.buff = [{ k: 'neboke', left: 2 }]; ok(SUC.sabRateOf(s) >= EV.EFFECT.sab - 1e-9, '💤ねぼけでサボりが +10% にならない');
s.ev.buff = [{ k: 'yaruki', left: 1 }]; s = SUC.act(s, { kind: 'rest' }).state; s = SUC.endTurn(s).state;
ok(s.ev.buff.length === 0, '残り1ターンの状態がターンの終わりに消えない');
// 3つ目が来たら古いほうが消える(芯の外から部品の pick を通す)
s.ev.buff = [{ k: 'yaruki', left: 3 }, { k: 'gokigen', left: 3 }];
s.ev.pend = { id: 'ev.season.dec3', slot: 'start', turn: s.turn };
s = EV.pick(s, null).state;
ok(s.ev.buff.length === 2 && s.ev.buff[0].k === 'gokigen' && s.ev.buff[1].k === 'yaruki', '状態が2つを超えた・古いほうが消えない');
ok(EV.buffs(s).every(b => b.icon && b.name), '画面の印(buffs)に絵文字と名前が無い');

if (errors.length) { console.error('NG monhero-success-events-check'); errors.slice(0, 30).forEach(e => console.error('  - ' + e)); if (errors.length > 30) console.error(`  …ほか ${errors.length - 30} 件`); process.exit(1); }
console.log(`OK monhero-success-events-check: 出来事 ${EV.LIST.length}種・台本と同じ選択肢・決まった乱数(保存して戻しても同じ)・1回の育成で平均 ${avg.toFixed(1)}回(${Object.entries(kinds).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}`).join('・')})`);
