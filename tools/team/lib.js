// 部の一覧(depts.json)・モデルの表(routing.json)を読む共通の部品。tools/team/ の道具が使う。
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = 'monster-hero/src/parts/';
const DATA = 'monster-hero/data/';
// 生成物(差分・判定から外す)
const GENERATED = /(^|\/)(game-system\.jsx|game-system\.compiled\.js|tailwind\.css|[^/]*\.compiled\.js)$/;

const loadDepts = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'depts.json'), 'utf8')).depts;
const loadRouting = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'routing.json'), 'utf8'));

// 'P/30-rhythm-*' → 'monster-hero/src/parts/30-rhythm-*'
const expand = (pat) => pat.replace(/^P\//, PARTS).replace(/^D\//, DATA);
const toRegex = (pat) => new RegExp('^' + expand(pat).split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (pat.endsWith('*') ? '' : '$'));

// 名前・id・部長の名前のどれでも引ける
function findDept(word) {
  const depts = loadDepts();
  if (!word) return null;
  const w = String(word).toLowerCase();
  return depts.find(d => d.id === w)
    || depts.find(d => d['部'].toLowerCase().includes(w) || d['部長'].toLowerCase().includes(w) || d['語'].some(k => k.toLowerCase() === w))
    || null;
}

// そのファイルを受け持つ部(複数ありうる)。files の並びが細かい部を先に返す
function deptsOfFile(file) {
  const hits = [];
  for (const d of loadDepts()) {
    const pats = d.files.filter(p => toRegex(p).test(file));
    if (pats.length) hits.push({ d, len: Math.max(...pats.map(p => expand(p).replace(/\*/g, '').length)) });
  }
  return hits.sort((a, b) => b.len - a.len).map(h => h.d);
}

function git(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return r.status === 0 ? (r.stdout || '') : '';
}

// git に渡すパスの並び(* は git の pathspec がそのまま読む)
const pathspecs = (d) => d.files.map(expand).map(p => `:(glob)${p.endsWith('/*') ? p.slice(0, -1) + '**' : p}`);

const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const cut = (s, n) => { const t = String(s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

function deptList() {
  return loadDepts().map(d => `  ${d.id.padEnd(15)} ${d['部']}`).join('\n');
}

module.exports = { ROOT, PARTS, DATA, GENERATED, loadDepts, loadRouting, expand, toRegex, findDept, deptsOfFile, git, pathspecs, today, cut, deptList };
