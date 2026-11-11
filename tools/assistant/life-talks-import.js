#!/usr/bin/env node
// 助手たちの今の台本(テキスト)を data/assistants.js の ASSISTANT_LIFE_TALKS へ取り込む(コトバ 2026-11-07)。
// 読むもの: docs/progress/assistant-peer/lines/ の kotoba-life.txt・tsumugi.txt(SAMPLE.txt はお手本なので読まない)。
// 形は lines/SAMPLE.txt の頭の説明のとおり。データの形はナカヨシ(3)の案(2026-11-07):
//   solo    { id, kind:'solo', who, keys, line, lines }
//   invite  { id, kind:'invite', who(誘われる人), from(声をかける人), keys, lines }
//   pair    { id, kind:'pair', pair:[a,b], keys, lines }
//   trio    { id, kind:'trio', trio:[a,b,c], keys, lines }。どの3人でも(テキスト trio A B any)は { trio:null, pair:[A,B], any:true }
//   quarrel { id, kind:'quarrel', pair, keys, lines(言い合い), distance(距離), makeup(仲直り) }
//   breeder { id, kind:'breeder', who, keys, lines }
// id は「kind-人-通し番号」(テキストの並び順)。{c}・{c:id}・{place}・{doing}・{doing_te} は文字のまま残す。
// assistants.js の印の行のあいだだけを、毎回まるごと書き直す(手で書いた所は触らない)。
//   node tools/assistant/life-talks-import.js          … 書き直す
//   node tools/assistant/life-talks-import.js --check  … 書き直さずに、今のデータがテキストと同じかだけ見る
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const linesDir = path.join(root, 'docs', 'progress', 'assistant-peer', 'lines');
const dataFile = path.join(root, 'monster-hero', 'data', 'assistants.js');
// tsumugi-rewrite.txt は今の台本を id のまま直す一覧(edit/tag)なので、ここでは読まない(当てるのはナカヨシ(3)の道具)
const SOURCES = ['kotoba-life.txt', 'tsumugi.txt', 'kotoba-battle.txt'];
const BEGIN = '// ===== ASSISTANT_LIFE_TALKS ここから(tools で生成・手で直さない) =====';
const END = '// ===== ASSISTANT_LIFE_TALKS ここまで =====';
const KINDS = { solo: 1, invite: 2, pair: 2, trio: 3, quarrel: 2, breeder: 1 };

const parseRow = (p) => {
  const m = p.trim().match(/^(\S+) (\S+) (.+)$/);
  if (!m) throw new Error(`行の形がおかしい「${p}」`);
  return { who: m[1], e: m[2], t: m[3].trim() };
};

const talks = [];
const counter = new Map();
const problems = [];
for (const f of SOURCES) {
  const file = path.join(linesDir, f);
  if (!fs.existsSync(file)) continue;
  fs.readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
    const l = raw.trim();
    const kind = l.split(/\s+/)[0];
    if (!KINDS[kind]) return;
    try {
      const [headPart, ...rest] = l.split(/\s+\|\s+/);
      const words = headPart.split(/\s+/).slice(1);
      const anyTrio = kind === 'trio' && words.includes('any');
      const people = words.filter(w => !w.includes('=') && w !== 'any');
      const keys = Object.fromEntries(words.filter(w => w.includes('=')).map(w => w.split('=')));
      const body = rest.join(' | ');
      const blocks = body.split(/\s+\|\|\s+/).map(b => b.split(/\s+\|\s+/).filter(Boolean).map(parseRow));
      const t = { id: '', kind };
      const who = people[0];
      const n = (counter.get(`${kind}-${who}`) || 0) + 1;
      counter.set(`${kind}-${who}`, n);
      t.id = `life-${kind}-${people.join('-')}${anyTrio ? '-any' : ''}-${String(n).padStart(3, '0')}`;
      if (kind === 'solo' || kind === 'breeder') t.who = people[0];
      if (kind === 'invite') { t.who = people[0]; t.from = people[1]; }
      if (kind === 'pair' || kind === 'quarrel') t.pair = people.slice(0, 2);
      if (kind === 'trio') { t.trio = anyTrio ? null : people.slice(0, 3); if (anyTrio) { t.pair = people.slice(0, 2); t.any = true; } }
      const line = keys.line; delete keys.line;
      t.keys = keys;
      if (kind === 'solo') t.line = line || 'scene';
      t.lines = blocks[0] || [];
      if (kind === 'quarrel') { t.distance = blocks[1] || []; t.makeup = blocks[2] || []; }
      talks.push(t);
    } catch (e) {
      problems.push(`${f}:${i + 1} ${e.message}`);
    }
  });
}
if (problems.length) { console.log(problems.join('\n')); console.log(`${problems.length}件 読めない行`); process.exit(1); }

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const obj = (o) => `{ ${Object.entries(o).map(([k, v]) => `${k}:${q(v)}`).join(', ')} }`;
const rows = (a) => `[\n${a.map(r => `    { who:${q(r.who)}, e:${q(r.e)}, t:${q(r.t)} },`).join('\n')}\n  ]`;
const gen = talks.map(t => {
  const head = [`id:${q(t.id)}`, `kind:${q(t.kind)}`];
  if (t.who) head.push(`who:${q(t.who)}`);
  if (t.from) head.push(`from:${q(t.from)}`);
  if (t.pair) head.push(`pair:[${t.pair.map(q).join(', ')}]`);
  if ('trio' in t) head.push(`trio:${t.trio ? `[${t.trio.map(q).join(', ')}]` : 'null'}`);
  if (t.any) head.push('any:true');
  head.push(`keys:${obj(t.keys)}`);
  if (t.line) head.push(`line:${q(t.line)}`);
  let s = `  { ${head.join(', ')}, lines:${rows(t.lines)}`;
  if (t.kind === 'quarrel') s += `, distance:${rows(t.distance)}, makeup:${rows(t.makeup)}`;
  return `${s} },`;
}).join('\n');
const block = `${BEGIN}\n// 元: docs/progress/assistant-peer/lines/(${SOURCES.join('・')})。取り込み: node tools/assistant/life-talks-import.js\nconst ASSISTANT_LIFE_TALKS = Object.freeze([\n${gen}\n]);\n${END}`;

const src = fs.readFileSync(dataFile, 'utf8');
const a = src.indexOf(BEGIN);
const b = src.indexOf(END);
const next = a >= 0 && b > a ? src.slice(0, a) + block + src.slice(b + END.length) : `${src.replace(/\s*$/, '')}\n\n${block}\n`;
const count = talks.reduce((m, t) => ({ ...m, [t.kind]: (m[t.kind] || 0) + 1 }), {});
const summary = Object.entries(count).map(([k, v]) => `${k} ${v}`).join('・');
if (process.argv.includes('--check')) {
  if (next !== src) { console.log(`NG: assistants.js の ASSISTANT_LIFE_TALKS がテキストと違う(取り込み直す: node tools/assistant/life-talks-import.js)— ${summary}`); process.exit(1); }
  console.log(`OK: ASSISTANT_LIFE_TALKS はテキストと同じ — ${talks.length}本(${summary})`);
  process.exit(0);
}
fs.writeFileSync(dataFile, next);
console.log(`書き直した: ASSISTANT_LIFE_TALKS ${talks.length}本(${summary})`);
