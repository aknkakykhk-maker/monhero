#!/usr/bin/env node
// モンヒロサクセスの育成イベントで「選んだあとに結果が出る」見張り(2026-11-14 社長「選択のあと何も起きなかったけど、起きないやつもあるの?」)。画面は開かない(数秒)。
//   ・全部の出来事・全部の選択肢を芯の SUC.events.pick に通し、動いた数字(能力・体力・人気・忠誠…)が札(msxEvDeltaChips)かゲージに出ること
//   ・何も動かない選択肢は、下の NO_EFFECT に書いた物だけ(増えたら止まる。減ったら一覧から消す)
//   ・確率の選択肢(p)は成功・失敗の両方を、何度か手を変えて通す
//   ・画面(56-monhero-success-main.jsx)が、選んだあとに MsxEvResult を出していること
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, ROOT, sliceConst } = require('./load');

const { SUC } = load();
const EV = SUC.events;
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
// 何も動かないと分かっている選択肢。ev.goal.miss は目標を逃した知らせ(2026-11-14 ほかの5つには小さな効果を足した)
const NO_EFFECT = new Set(['ev.goal.miss']);

const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
const res = fs.readFileSync(path.join(PARTS, '56-monsuc-evres.jsx'), 'utf8');
const ctx = vm.createContext({ msxSuc: { SUC } });
vm.runInContext([sliceConst(res, 'msxEvSigned'), sliceConst(res, 'msxEvDeltaChips'), 'globalThis.__c = msxEvDeltaChips;'].join('\n'), ctx);
const chipsOf = ctx.__c;
const main = fs.readFileSync(path.join(PARTS, '56-monhero-success-main.jsx'), 'utf8');
ok(/<MsxEvResult delta=\{picked\.delta\}/.test(main), '選んだあとの段に MsxEvResult が無い(56-monhero-success-main.jsx)');
ok(/delta: r\.out\.delta/.test(main), '選んだときに芯の out.delta を picked に残していない');
// どのイベントにも出る仮の1行(2026-11-14 社長が見た「いい時間になった。」)を画面に置かない
ok(!main.includes('いい時間になった'), '選んだあとの仮の1行「いい時間になった。」が画面に残っている');
ok(/r\.out\.next \|\| \(view && view\.id \? `\$\{view\.id\}\.res`/.test(main), '見るだけの出来事の結果の場面(<出来事>.res)を引いていない');
// 台本(生成物)で台詞のある場面(地の文か、おみくじのように助手のひとこと)
const narrScenes = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'monster-hero', 'data')).filter((x) => /^monhero-success-script-(?!engine).*\.js$/.test(x))) {
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', f), 'utf8');
  for (const m of src.matchAll(/\{"id":"([^"]+)\.[a-z]+\d+[a-z]?","who":"(?!choice)/g)) narrScenes.add(m[1]);
}

const base = EV.open(SUC.newRun({ id: 'evres', species: SUC.speciesList[0], aid: SUC.AIDS[0] }), 'start').state;
let n = 0; const none = []; const noLine = new Set();
for (const e of EV.LIST) {
  if (e.slot === 'none') continue; // おみくじの結果の置き場(じかには起きない)
  const hasCh = e.ch && (e.ch.a || e.ch.b);
  const keys = hasCh ? Object.keys(e.ch) : [null];
  for (const c of keys) {
    const id = c ? `${e.id}.${c}` : e.id; const ch = c ? e.ch[c] : e.ch;
    let seen = false; let moved = false;
    for (let t = 0; t < (ch && (ch.p != null || ch.lottery) ? 12 : 1); t++) {
      const s = JSON.parse(JSON.stringify(base)); s.turn = 6 + t; s.fame = 99999; s.pop = 70; s.hp = Math.round(s.hpMax * 0.6); s.stress = 50;
      s.bond = (s.team || []).map(() => 70); s.ev.pend = null;
      s.ev.pend = { id: e.id, slot: e.slot === 'fixed' ? 'start' : e.slot, turn: s.turn, cheer: 0, cheer2: 1 };
      if (e.id === 'ev.goal.done' || e.id === 'ev.goal.miss') s.ev.pend.goal = 'star';
      const r = EV.pick(s, c);
      if (!r.out || !r.out.ok) { ok(false, `${id}: 選べなかった(${r.out && r.out.why})`); break; }
      seen = true; n += 1;
      const d = r.out.delta || {}; const st = Object.values(d.stats || {}).some((x) => x);
      if (st || chipsOf(d).length || d.apt || 'fav' in d) moved = true;
      // 選んだ選択肢に合った結果の文(画面と同じ引き方: 選んだ側の場面 → 確率・おみくじの結果の場面)
      const scenes = [r.out.next || `${e.id}.res`, r.out.scene].filter(Boolean);
      if (!scenes.some((sc) => narrScenes.has(sc))) noLine.add(`${id}${r.out.res ? `(${r.out.res})` : ''}`); // fav: 好きなトレーニングの候補は育成のようすしだい(起きるときは必ずある)
    }
    if (seen && !moved) none.push(id);
  }
}
for (const id of none) ok(NO_EFFECT.has(id), `${id}: 選んでも何も動かない(結果の札が出ない)。効果を付けるか、NO_EFFECT に足して窓口へ`);
for (const id of NO_EFFECT) ok(none.includes(id), `NO_EFFECT の ${id} は、いまは何か動く。一覧から消す`);
ok(n >= 99, `通した選択肢が少ない: ${n}`);
ok(noLine.size === 0, `選んだあとの結果の文が台本に無い: ${[...noLine].slice(0, 8).join(' ')}${noLine.size > 8 ? ` …ほか ${noLine.size - 8}` : ''}`);

if (errors.length) { console.error('NG monsuc-event-result-check'); errors.slice(0, 30).forEach((x) => console.error('  - ' + x)); process.exit(1); }
console.log(`OK monsuc-event-result-check: 出来事 ${EV.LIST.length} 種・選択肢を ${n} 回通して、何も動かないのは一覧の ${NO_EFFECT.size} つだけ・どの選択肢にも結果の文がある・選んだあとに結果の札を出す`);
