#!/usr/bin/env node
// 助手ライフのできごとの台詞(docs/progress/assistant-life/top-scene/daily-lines.txt・daily-scenes.txt)を
// data/assistants.js の ASSISTANT_LIFE_DAILY_TALKS へ取り込む(ナカヨシ20・2026-11-11。形は LINES-SPEC.md)。
//   node tools/assistant/life-daily-import.js          … 書き直す
//   node tools/assistant/life-daily-import.js --check  … 書き直さずに、今のデータがテキストと同じかだけ見る
// 印の行のあいだだけを毎回まるごと書き直す。ファイルが無いときは空の形を書く(公開の印 assistantLifeDailyScene は台詞が入るまで偽)
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const dir = path.join(root, 'docs', 'progress', 'assistant-life', 'top-scene');
const dataFile = path.join(root, 'monster-hero', 'data', 'assistants.js');
const BEGIN = '// ===== ASSISTANT_LIFE_DAILY_TALKS ここから(tools/assistant/life-daily-import.js で生成・手で直さない) =====';
const END = '// ===== ASSISTANT_LIFE_DAILY_TALKS ここまで =====';
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const SLOTS = ['late', 'morning', 'noon', 'afternoon', 'evening', 'night'];
const MOODS = ['normal', 'happy', 'excited', 'wink', 'surprise', 'troubled', 'angry', 'crying'];
const ROLES = ['open', 'back', 'r1', 'r2'];
const errs = [];
const read = (f) => { const p = path.join(dir, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : []; };
const rows = (f) => read(f).map((l, i) => ({ l: l.trim(), n: i + 1, f })).filter(x => x.l && !x.l.startsWith('#') && !x.l.startsWith('```'));
const line = (x, mood, t) => {
  if (!MOODS.includes(mood)) errs.push(`${x.f}:${x.n} 表情「${mood}」が無い`);
  if (!t) errs.push(`${x.f}:${x.n} 台詞が空`);
  return { e: mood, t };
};

const lines = {};
for (const x of rows('daily-lines.txt')) {
  const m = x.l.match(/^(\S+) (\S+) (\S+) (.+)$/);
  if (!m) { errs.push(`${x.f}:${x.n} 形がおかしい`); continue; }
  const [, who, slot, mood, t] = m;
  if (!IDS.includes(who)) errs.push(`${x.f}:${x.n} 助手id「${who}」が無い`);
  if (!SLOTS.includes(slot)) errs.push(`${x.f}:${x.n} 時間帯「${slot}」が無い`);
  ((lines[who] = lines[who] || {})[slot] = lines[who][slot] || []).push(line(x, mood, t));
}

const scenes = [], rares = [], byId = {};
for (const x of rows('daily-scenes.txt')) {
  let m = x.l.match(/^scene (\S+) (.+)$/);
  if (m) {
    const [title, c1, c2] = m[2].split('|').map(v => v.trim());
    const slot = m[1].replace(/-\d+$/, '');
    if (!SLOTS.includes(slot)) errs.push(`${x.f}:${x.n} 場面id「${m[1]}」の時間帯が無い(late-1 などの形)`);
    if (!title || !c1 || !c2) errs.push(`${x.f}:${x.n} 「題 | 返事1 | 返事2」の形にする`);
    byId[m[1]] = { id: m[1], slot, title, choices: [c1, c2], parts: {} };
    scenes.push(byId[m[1]]);
    continue;
  }
  m = x.l.match(/^rare (\S+) (\S+) (.+)$/);
  if (m) {
    const slots = m[2].split(/[・,]/).filter(Boolean);
    for (const s of slots) if (!SLOTS.includes(s)) errs.push(`${x.f}:${x.n} 時間帯「${s}」が無い`);
    byId[m[1]] = { id: m[1], slots, title: m[3].trim(), parts: {}, rare: true };
    rares.push(byId[m[1]]);
    continue;
  }
  m = x.l.match(/^(\S+) (\S+) (\S+) (\S+) (.+)$/);
  if (!m || !byId[m[1]]) { errs.push(`${x.f}:${x.n} 形がおかしい(先に scene / rare の行が要る)`); continue; }
  const [, sid, role, who, mood, t] = m;
  const sc = byId[sid];
  if (!(sc.rare ? ['open', 'back'] : ROLES).includes(role)) errs.push(`${x.f}:${x.n} 役「${role}」が無い`);
  if (!IDS.includes(who)) errs.push(`${x.f}:${x.n} 助手id「${who}」が無い`);
  if (sc.parts[who] && sc.parts[who][role]) errs.push(`${x.f}:${x.n} ${sid} ${role} ${who} が2回ある`);
  (sc.parts[who] = sc.parts[who] || {})[role] = line(x, mood, t);
}
for (const r of rares) delete r.rare;
// 抜けの数(場面に出られない助手を知らせる。止めはしない)
const missing = [];
for (const sc of scenes) for (const id of IDS) for (const r of ROLES) if (!(sc.parts[id] && sc.parts[id][r])) missing.push(`${sc.id} ${r} ${id}`);

if (errs.length) { console.error(`NG: 台詞の形 ${errs.length}件\n  ${errs.slice(0, 20).join('\n  ')}`); process.exit(1); }
const body = `const ASSISTANT_LIFE_DAILY_TALKS = ${JSON.stringify({ lines, scenes, rares })};`;
const src = fs.readFileSync(dataFile, 'utf8');
const a = src.indexOf(BEGIN), b = src.indexOf(END);
if (a < 0 || b < a) { console.error('NG: assistants.js に印の行が無い'); process.exit(1); }
const next = `${src.slice(0, a + BEGIN.length)}\n${body}\n${src.slice(b)}`;
const count = Object.values(lines).reduce((n, o) => n + Object.values(o).reduce((m, l) => m + l.length, 0), 0);
const sum = `ひとこと ${count}本・場面 ${scenes.length}・珍しい ${rares.length}${missing.length ? `(場面の抜け ${missing.length}件。抜けた助手はその場面に出ない)` : ''}`;
if (process.argv.includes('--check')) {
  if (next !== src) { console.error(`NG: assistants.js がテキストと違う。node tools/assistant/life-daily-import.js を打つ(${sum})`); process.exit(1); }
  console.log(`OK: できごとの台詞はテキストと同じ(${sum})`);
} else {
  fs.writeFileSync(dataFile, next);
  console.log(`OK: 書いた(${sum})`);
}
