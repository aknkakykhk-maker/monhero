#!/usr/bin/env node
// 今の助手どうしの台本の「書き直しの表」ASSISTANT_PEER_REWRITES を data/assistants.js へ作る(ナカヨシ4 2026-11-07)。
// 今の台本は公開中で、思い出アルバムが id で覚えている。だから今の文(ASSISTANT_PEER_TALKS など)は消さず・書きかえず、
// 公開の印 RELEASE_FLAGS.assistantLife が真のときだけ、この表の文で出す(56-assistant-peer.jsx の assistantPeerRewrite)。
// 元: docs/progress/assistant-peer/lines/tsumugi-rewrite.txt(ツムギ)
//   edit … 当て方は peer-rewrite-apply.js の applyEdits と同じ(話す人がちがう行は止める)。当てた結果と今の文を比べて、変わった段を丸ごと表へ
//   tag  … doing・lv(新しい選び方の鍵)・similar(新しい台本とほぼ同じ。新しい選び方で出さない。アルバムには残る)
//   add  … けんかの「距離をおく」の行(distance)
// 表の形: { [id]: { lines?, makeup?, reply?:{ [返事の番号]: 行 }, distance?, doing?, lv?, similar? } }
//         ASSISTANT_PEER_REACTION_REWRITES { [助手]: { gift|token|play: { e, t } } }
//   node tools/assistant/peer-rewrite-table.js          … 書き直す
//   node tools/assistant/peer-rewrite-table.js --check  … 書き直さずに、今の表が一覧と同じかだけ見る
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { applyEdits, readEdits, defaultList } = require('./peer-rewrite-apply.js');

const root = path.join(__dirname, '..', '..');
const dataFile = path.join(root, 'monster-hero', 'data', 'assistants.js');
const BEGIN = '// ===== ASSISTANT_PEER_REWRITES ここから(tools で生成・手で直さない) =====';
const END = '// ===== ASSISTANT_PEER_REWRITES ここまで =====';
const LIST = defaultList;

const src0 = fs.readFileSync(dataFile, 'utf8');
const a0 = src0.indexOf(BEGIN);
const b0 = src0.indexOf(END);
// 表そのものは当てる元に入れない(id や行の形が重なるため)
const base = a0 >= 0 && b0 > a0 ? src0.slice(0, a0).replace(/\s*$/, '\n') + src0.slice(b0 + END.length).replace(/^\s*/, '\n') : src0;

const load = (s) => vm.runInNewContext(`${s}\n;({ T: ASSISTANT_PEER_TALKS, E: ASSISTANT_PEER_EVENTS, Q: ASSISTANT_PEER_QUARRELS, TR: ASSISTANT_PEER_TRIO_TALKS, R: ASSISTANT_PEER_REACTIONS })`, { window: {}, console });
const edits = readEdits(LIST);
const applied = applyEdits(base, edits);
if (applied.ng.length) { console.log(applied.ng.join('\n')); console.log(`NG: 当てられない行が ${applied.ng.length} 件`); process.exit(1); }
const before = load(base);
const after = load(applied.s);

const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const table = {};
const put = (id, k, v) => { (table[id] = table[id] || {})[k] = v; };
const allOf = (d) => [...d.T, ...d.E, ...d.Q, ...d.TR];
const byId = new Map(allOf(before).map(t => [t.id, t]));
for (const t of allOf(after)) {
  const o = byId.get(t.id);
  if (!o) { console.log(`NG: 当てたあとに増えた id ${t.id}`); process.exit(1); }
  if (!same(o.lines, t.lines)) put(t.id, 'lines', t.lines);
  if (Array.isArray(t.makeup) && !same(o.makeup, t.makeup)) put(t.id, 'makeup', t.makeup);
  if (Array.isArray(t.choice)) t.choice.forEach((c, i) => { if (!same(o.choice[i].reply, c.reply)) { const r = (table[t.id] && table[t.id].reply) || {}; r[i] = c.reply; put(t.id, 'reply', r); } });
}
const reactions = {};
for (const [who, r] of Object.entries(after.R)) for (const [k, v] of Object.entries(r)) {
  if (!same(before.R[who][k], v)) (reactions[who] = reactions[who] || {})[k] = v;
}

// tag と add
const problems = [];
const lv3 = new Set(['1-3', '4-6', '7-10']);
const DOINGS = new Set(['snack', 'practice', 'training', 'cards', 'walk']);
const distance = {};
fs.readFileSync(LIST, 'utf8').split('\n').forEach((l, i) => {
  let m = l.match(/^tag (\S+) (.+)$/);
  if (m) {
    const [, id, rest] = m;
    if (!byId.has(id)) { problems.push(`${i + 1}: tag の id が無い ${id}`); return; }
    const sim = rest.indexOf('similar=');
    const head = sim >= 0 ? rest.slice(0, sim) : rest;
    if (sim >= 0) put(id, 'similar', rest.slice(sim + 8).trim());
    for (const w of head.trim().split(/\s+/).filter(Boolean)) {
      const [k, v] = w.split('=');
      if (k === 'doing' && DOINGS.has(v)) put(id, 'doing', v);
      else if (k === 'lv' && lv3.has(v)) put(id, 'lv', v);
      else problems.push(`${i + 1}: tag の鍵がおかしい ${w}`);
    }
    return;
  }
  m = l.match(/^add (\S+) distance(\d+) \| (\S+) (\S+) (.*)$/);
  if (m) {
    const [, id, n, who, e, t] = m;
    const q = before.Q.find(x => x.id === id);
    if (!q) { problems.push(`${i + 1}: add の id がけんかに無い ${id}`); return; }
    if (!q.pair.includes(who)) { problems.push(`${i + 1}: add の話す人が2人のどちらでもない ${who}`); return; }
    (distance[id] = distance[id] || [])[Number(n) - 1] = { who, e, t: t.trim() };
    return;
  }
  if (/^(edit|tag|add) /.test(l) && !/^edit /.test(l)) problems.push(`${i + 1}: 読めない行 ${l.slice(0, 40)}`);
});
for (const [id, list] of Object.entries(distance)) {
  if (list.some(x => !x)) problems.push(`距離の行の番号が飛んでいる ${id}`);
  put(id, 'distance', list.filter(Boolean));
}
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const rows = (a, pad) => `[\n${a.map(r => `${pad}  { who:${q(r.who)}, e:${q(r.e)}, t:${q(r.t)} },`).join('\n')}\n${pad}]`;
const ids = Object.keys(table);
const gen = ids.map(id => {
  const x = table[id];
  const parts = [];
  if (x.doing) parts.push(`doing:${q(x.doing)}`);
  if (x.lv) parts.push(`lv:${q(x.lv)}`);
  if (x.similar) parts.push(`similar:${q(x.similar)}`);
  if (x.lines) parts.push(`lines:${rows(x.lines, '    ')}`);
  if (x.makeup) parts.push(`makeup:${rows(x.makeup, '    ')}`);
  if (x.distance) parts.push(`distance:${rows(x.distance, '    ')}`);
  if (x.reply) parts.push(`reply:{ ${Object.entries(x.reply).map(([i, r]) => `${i}:${rows(r, '    ')}`).join(', ')} }`);
  return `  ${q(id)}: { ${parts.join(', ')} },`;
}).join('\n');
const genR = Object.entries(reactions).map(([who, r]) => `  ${who}: { ${Object.entries(r).map(([k, v]) => `${k}:{ e:${q(v.e)}, t:${q(v.t)} }`).join(', ')} },`).join('\n');
const block = `${BEGIN}
// 元: docs/progress/assistant-peer/lines/tsumugi-rewrite.txt。作り直し: node tools/assistant/peer-rewrite-table.js
// 公開の印 assistantLife が真のときだけ使う(今の文は上の ASSISTANT_PEER_TALKS などに残したまま。id は変えない)
const ASSISTANT_PEER_REWRITES = Object.freeze({
${gen}
});
const ASSISTANT_PEER_REACTION_REWRITES = Object.freeze({
${genR}
});
${END}`;
const next = `${base.replace(/\s*$/, '')}\n\n${block}\n`;
const count = { lines: 0, makeup: 0, reply: 0, distance: 0, doing: 0, lv: 0, similar: 0 };
for (const x of Object.values(table)) for (const k of Object.keys(count)) if (x[k]) count[k] += 1;
const summary = `${ids.length}本(${Object.entries(count).map(([k, v]) => `${k} ${v}`).join('・')})・ひとこと ${Object.values(reactions).reduce((s, r) => s + Object.keys(r).length, 0)}`;
if (process.argv.includes('--check')) {
  if (next !== src0) { console.log(`NG: assistants.js の ASSISTANT_PEER_REWRITES が一覧と違う(作り直す: node tools/assistant/peer-rewrite-table.js)— ${summary}`); process.exit(1); }
  console.log(`OK: ASSISTANT_PEER_REWRITES は一覧と同じ — ${summary}・edit ${applied.ok}行`);
  process.exit(0);
}
fs.writeFileSync(dataFile, next);
console.log(`書き直した: ASSISTANT_PEER_REWRITES ${summary}・edit ${applied.ok}行`);
