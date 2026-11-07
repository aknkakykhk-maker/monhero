#!/usr/bin/env node
// 助手どうしの台詞の「重なり」と「口調のくせの割合」を数える(2026-11-07 社長「バリエーションがかなり少なそう」・コトバ)。
// ブラウザは使わない。data/assistants.js の ASSISTANT_PEER_* / ASSISTANT_LIFE_* にある { who, t } の行を全部集めて数える。
//
// 見ること(数字は docs/progress/assistant-peer/LIFE-PLAN.md「5. 台詞」・lines/FEELINGS.md のとおり)
//   ① 「{c}、」で始まる行は3割まで
//   ② 特別なお話の締め(最後の行)に「これからも」を使うのは半分まで
//   ③ まったく同じ台詞(7字以上)を2本より多くの台本で使わない
//   ④ 助手ごとのくせの割合: ソラシドの「ぜ・・・」3割まで/みゅあの「ｗ」1割以上/えるびんの「ふふ」は使わない/
//      ききの「でつ・まつ」3〜7割/ドラの「えへへ」「くさ」それぞれ4割まで
//   (参考)よく出る言い回しの上位
//
// 止めるのは「新しい形」の台本(状況の鍵 keys を持つもの)だけ。今ある台詞は作り直しで直すので、数字を(参考)で出す。
// 全部を止めるときは --all。
//   node tools/assistant/peer-lines-variety-check.js [--all]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const strictAll = process.argv.includes('--all');
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, Set, Map });
vm.runInContext(fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistants.js'), 'utf8'), ctx);
const names = vm.runInContext('Object.keys(this)', ctx).filter(n => /^ASSISTANT_(PEER|LIFE)_/.test(n));
// const で宣言したものは this に乗らないので、名前を直接たずねる
const src = fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistants.js'), 'utf8');
for (const m of src.matchAll(/^const (ASSISTANT_(?:PEER|LIFE)_[A-Z0-9_]+)\s*=/gm)) if (!names.includes(m[1])) names.push(m[1]);

// 台本(lines を持つもの)ごとに行を集める。keys を持つ台本(とその中の行)は「新しい形」
const talks = [];
const seen = new Set();
const walk = (v, src, inherited) => {
  if (!v || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  const isTalk = Array.isArray(v.lines);
  const fresh = inherited || !!(v.keys && typeof v.keys === 'object');
  if (isTalk) {
    const rows = [];
    const take = (x) => { if (x && typeof x === 'object' && typeof x.who === 'string' && typeof x.t === 'string') rows.push(x); };
    v.lines.forEach(take);
    for (const k of ['reply', 'makeup', 'after']) if (Array.isArray(v[k])) v[k].forEach(take);
    if (Array.isArray(v.choice)) v.choice.forEach(c => c && Array.isArray(c.reply) && c.reply.forEach(take));
    talks.push({ id: String(v.id || src), special: !!v.special, fresh, rows, last: v.lines[v.lines.length - 1] });
    return;
  }
  for (const k of Object.keys(v)) walk(v[k], `${src}.${k}`, fresh);
};
for (const n of names) {
  let val;
  try { val = vm.runInContext(n, ctx); } catch (e) { continue; }
  walk(val, n, false);
}

let ng = 0;
const out = (ok, label, detail, enforce) => {
  const mark = ok ? 'OK' : (enforce ? 'NG' : '(参考)×');
  if (!ok && enforce) ng += 1;
  console.log(`${mark}: ${label}${detail ? ' — ' + detail : ''}`);
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const measure = (set, label, enforce) => {
  const rows = set.flatMap(t => t.rows.map(r => ({ ...r, id: t.id })));
  console.log(`\n== ${label}: 台本 ${set.length} 本・行 ${rows.length}`);
  if (!rows.length) { console.log('   (まだ無い)'); return; }
  // ①
  const opens = rows.filter(r => /^\{c(?::[a-z]+)?\}、/.test(r.t)).length;
  out(opens <= rows.length * 0.3, '①「{c}、」で始まる行は3割まで', `${opens}/${rows.length}(${pct(opens, rows.length)}%)`, enforce);
  // ②
  const sp = set.filter(t => t.special && t.last && typeof t.last.t === 'string');
  const spEnd = sp.filter(t => /これからも/.test(t.last.t)).length;
  out(spEnd <= sp.length * 0.5, '② 特別なお話の締めの「これからも」は半分まで', `${spEnd}/${sp.length}`, enforce);
  // ③
  const same = new Map();
  for (const t of set) for (const r of t.rows) {
    const k = r.t.replace(/\{c(?::[a-z]+)?\}/g, '◯').replace(/\s+/g, '');
    if (k.length < 7) continue;
    if (!same.has(k)) same.set(k, new Set());
    same.get(k).add(t.id);
  }
  const dup = [...same.entries()].filter(([, ids]) => ids.size > 2);
  out(dup.length === 0, '③ 同じ台詞(7字以上)を3本以上の台本で使わない', dup.slice(0, 5).map(([k, ids]) => `「${k}」×${ids.size}`).join(' / '), enforce);
  // ④
  const ratio = (who, re) => {
    const a = rows.filter(r => r.who === who);
    return { n: a.filter(r => re.test(r.t)).length, all: a.length };
  };
  const rule = (who, name, re, lo, hi) => {
    const { n, all } = ratio(who, re);
    if (all < 20) { console.log(`   ④ ${name}: 行が少ないので数えない(${all}行)`); return; }
    const p = n / all;
    const ok = (lo == null || p >= lo) && (hi == null || p <= hi);
    const range = `${lo != null ? Math.round(lo * 100) + '%以上' : ''}${lo != null && hi != null ? '・' : ''}${hi != null ? Math.round(hi * 100) + '%まで' : ''}`;
    out(ok, `④ ${name}は${range}`, `${n}/${all}(${pct(n, all)}%)`, enforce);
  };
  rule('sorashido', 'ソラシドの「ぜ・・・」', /ぜ・・・/, null, 0.3);
  rule('mua', 'みゅあの「ｗ」', /ｗ/, 0.1, null);
  rule('kiki', 'ききの「でつ・まつ」', /でつ|まつ/, 0.3, 0.7);
  rule('dra', 'ドラの「えへへ」', /えへへ/, null, 0.4);
  rule('dra', 'ドラの「くさ」', /くさ(?![いかきくけこっ])/, null, 0.4);
  const fufu = ratio('erubin', /ふふ/);
  out(fufu.n === 0, '④ えるびんは「ふふ」を使わない(ききと区別がつかなくなる)', `${fufu.n}/${fufu.all}`, enforce);
  // (参考)
  const ng6 = new Map();
  for (const r of rows) {
    const x = r.t.replace(/\{c(?::[a-z]+)?\}/g, '').replace(/ブリーダー(さん)?/g, '');
    const local = new Set();
    for (let p = 0; p + 6 <= x.length; p += 1) {
      const g = x.slice(p, p + 6);
      if (/^[、。！？!?…\s]/.test(g) || /ぜ・・・/.test(g)) continue;
      local.add(g);
    }
    for (const g of local) ng6.set(g, (ng6.get(g) || 0) + 1);
  }
  const top = [...ng6.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`).join(' / ');
  console.log(`   (参考)よく出る言い回し: ${top}`);
};

measure(talks.filter(t => t.fresh), '新しい形(状況の鍵つき)', true);
measure(talks, '全部の台本', strictAll);

console.log('');
if (ng) { console.log(`${ng}件 NG`); process.exit(1); }
console.log(strictAll ? 'すべてOK' : 'すべてOK(全部の台本の数字は参考。--all で止める)');
