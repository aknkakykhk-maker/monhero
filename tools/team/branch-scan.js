#!/usr/bin/env node
// 「本体を変えたのに本番(main)に入っていない枝」を探す共通の部品。
//   handoff.js(その会話の枝を引き継ぎメモへ)と stale-branches(窓口の見回り)が使う。
//
// 【なぜあるか】2026-11-15 ドラの寝顔: 社長が止め絵で OK を出したのに、枝 claude/dra-sleep-glasses-off が PR も作られず放置され、
// 本番に入らなかった(会話を替えたとき途中の枝が引き継ぎから抜けた)。人の注意に頼らず道具で止める。
//
// squash マージなので git cherry / git branch --merged は使えない。
// 「枝の追加行のうち、いま main にもある行の割合」で入ったかを判定する(gh api が使えれば、マージ済み PR の枝は先に除く)。
'use strict';
const { spawnSync } = require('child_process');
const { ROOT, git } = require('./lib');

const BODY = ['monster-hero/src/parts/', 'monster-hero/data/', 'monster-hero/images/']; // 「本体」
const IN_MAIN = 0.8;      // 追加行がこの割合以上 main にあれば「入っている」
const KEEP_LABEL = /【保留】|【β公開の日にマージ】/;

const ok = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).status === 0;

// gh api(REST)。使えなければ null(ネットに出られない・gh が無い)
function gh(route) {
  const r = spawnSync('gh', ['api', route], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 30000 });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch (e) { return null; }
}
function repoSlug() {
  const m = /github\.com[:/]([^/]+\/[^/.\s]+)/.exec(git(['remote', 'get-url', 'origin']));
  return m ? m[1] : '';
}

// 開いている PR(番号・枝・題)。取れなければ null
function openPRs() {
  const slug = repoSlug(); if (!slug) return null;
  const a = gh(`repos/${slug}/pulls?state=open&per_page=100`);
  return a ? a.map(p => ({ number: p.number, head: p.head.ref, title: p.title })) : null;
}
// マージ済み PR の枝の名前(直近の分)。取れなければ null
function mergedHeads() {
  const slug = repoSlug(); if (!slug) return null;
  const set = new Set();
  for (const page of [1, 2, 3]) {
    const a = gh(`repos/${slug}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`);
    if (!a) return page === 1 ? null : set;
    for (const p of a) if (p.merged_at) set.add(p.head.ref);
  }
  return set;
}

const lineOk = (l) => l.trim().length >= 8; // 短い行(括弧だけ等)は数えない

// 枝 ref が main に対して持つ「本体の変更」: { files, added, inMain, ratio }。本体を変えていなければ files=0
function scan(ref, base = 'origin/main') {
  const mb = git(['merge-base', base, ref]).trim();
  if (!mb) return { files: 0, added: 0, inMain: 0, ratio: 1, nobase: true };
  const names = git(['diff', '--numstat', mb, ref, '--', ...BODY]).split('\n').filter(Boolean).map(l => l.split('\t'));
  let added = 0, inMain = 0;
  for (const [a, , f] of names) {
    if (a === '-') { // 絵・音: 同じ中身が main の同じ場所にあるか
      added++; if (git(['rev-parse', `${ref}:${f}`]).trim() === git(['rev-parse', `${base}:${f}`]).trim()) inMain++;
      continue;
    }
    if (a === '0') continue;
    const mainText = new Set(git(['show', `${base}:${f}`]).split('\n').filter(lineOk).map(l => l.trim()));
    const d = git(['diff', '--unified=0', mb, ref, '--', f]).split('\n');
    for (const l of d) { if (l.startsWith('+') && !l.startsWith('+++') && lineOk(l.slice(1))) { added++; if (mainText.has(l.slice(1).trim())) inMain++; } }
  }
  return { files: names.length, added, inMain, ratio: added ? inMain / added : 1 };
}
const landed = (s) => s.files === 0 || s.ratio >= IN_MAIN;

// 直近 days 日に動いた origin の枝: [{ name, unix, subject }] 新しい順
function recentRemote(days) {
  const since = Date.now() / 1000 - days * 86400;
  return git(['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)\t%(committerdate:unix)\t%(subject)', 'refs/remotes/origin'])
    .split('\n').filter(Boolean).map(l => l.split('\t')).filter(([n, t]) => n !== 'origin' && n !== 'origin/main' && n !== 'origin/HEAD' && Number(t) >= since)
    .map(([n, t, s]) => ({ name: n.replace(/^origin\//, ''), unix: Number(t), subject: s }));
}

// この会話が作った枝の名前: 作業中の枝・ローカルの枝・reflog に出た枝(checkout の行き来)
function ownNames() {
  const names = new Set();
  const cur = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(); if (cur && cur !== 'HEAD') names.add(cur);
  for (const n of git(['for-each-ref', '--format=%(refname:short)', 'refs/heads']).split('\n').filter(Boolean)) names.add(n);
  for (const l of git(['reflog', '-n', '300', '--format=%gs']).split('\n')) {
    const m = /^checkout: moving from (\S+) to (\S+)/.exec(l); if (m) { names.add(m[1]); names.add(m[2]); }
    const b = /^branch: Created from/.exec(l); void b;
  }
  return [...names].filter(n => n && n !== 'main' && !/^[0-9a-f]{7,40}$/.test(n) && n !== 'HEAD');
}

module.exports = { BODY, IN_MAIN, KEEP_LABEL, ok, gh, openPRs, mergedHeads, scan, landed, recentRemote, ownNames };
