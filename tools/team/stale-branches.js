#!/usr/bin/env node
// 見回り: 本体(monster-hero/src/parts・data・images)を変えたのに、本番(main)に入っていない枝を数える。
//
//   node tools/ctx.js stale-branches            … 直近7日に動いた origin の枝から、件数と新しい順の上位10件
//   node tools/ctx.js stale-branches --days 14 --top 20
//
// 【なぜあるか】2026-11-15 ドラの寝顔: 社長が OK を出した枝が PR も作られず放置され、本番に入らなかった。窓口の見回りで毎回打つ。
// 判定: ①マージ済み PR の枝は除く(gh api が使えるとき) ②本体を変えていない枝は除く
//      ③枝の追加行が main に8割以上あれば「入っている」(squash マージなので git cherry は使えない)
//      ④開いている PR の題に【保留】【β公開の日にマージ】があるものは除く(わざと置いてある)。
// origin の枝が少ない環境(浅い複製)では、最近 push された枝(events)と開いている PR の枝を gh api の compare で見る。
'use strict';
const { git, cut } = require('./lib');
const B = require('./branch-scan');

const argv = process.argv.slice(2);
const num = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? Number(argv[i + 1]) || d : d; };
const days = num('--days', 7), top = num('--top', 10);

// origin の枝が少ない浅い複製では、枝を取らず gh api の compare で見る。対象は最近 push された枝(events)と開いている PR の枝
function apiCandidates(prs) {
  const slug = B.repoSlug(); const names = new Map();
  const since = Date.now() - days * 86400000;
  for (const page of [1, 2, 3]) {
    const ev = slug && B.gh(`repos/${slug}/events?per_page=100&page=${page}`); if (!ev) break;
    for (const e of ev) if (e.type === 'PushEvent' && Date.parse(e.created_at) >= since && /^refs\/heads\//.test(e.payload.ref)) names.set(e.payload.ref.slice(11), 1);
  }
  for (const p of prs || []) names.set(p.head, 1);
  names.delete('main');
  return { slug, names: [...names.keys()].slice(0, 80) };
}

const prs = B.openPRs();
const shallow = git(['for-each-ref', 'refs/remotes/origin']).split('\n').filter(Boolean).length < 50;

const merged = B.mergedHeads();
const keep = new Set((prs || []).filter(p => B.KEEP_LABEL.test(p.title)).map(p => p.head));
const prOf = new Map((prs || []).map(p => [p.head, p]));
const api = shallow ? apiCandidates(prs) : null;
const cands = api ? api.names.map(name => ({ name })) : B.recentRemote(days);
const hit = []; let skipMerged = 0, skipKeep = 0, unknown = 0;
for (const c of cands) {
  if (merged && merged.has(c.name)) { skipMerged++; continue; }
  if (keep.has(c.name)) { skipKeep++; continue; }
  let s;
  if (api) { s = B.scanApi(api.slug, c.name); if (!s) continue; if (!s.ahead) continue; Object.assign(c, { unix: s.unix, subject: s.subject }); if (s.unix < Date.now() / 1000 - days * 86400) continue; }
  else {
    if (B.ok(['merge-base', '--is-ancestor', `origin/${c.name}`, 'origin/main'])) continue;
    s = B.scan(`origin/${c.name}`);
    if (s.nobase) { unknown++; continue; }
  }
  if (B.landed(s)) continue;
  hit.push({ ...c, s, pr: prOf.get(c.name) });
}
hit.sort((a, b) => b.unix - a.unix);
console.log(`# 本体を変えたのに main に入っていない枝(直近 ${days} 日に動いた ${cands.length} 枝を見て): ${hit.length} 件${prs ? '' : '(PR 一覧は取れず・追加行だけで判定)'}`);
for (const h of hit.slice(0, top)) {
  const d = Math.floor((Date.now() / 1000 - h.unix) / 86400);
  console.log(`- ${h.name}(${d}日前) ${h.pr ? `PR #${h.pr.number}開` : 'PRなし★'} / 本体 ${h.s.files} ファイル・追加 ${h.s.added} 行のうち main に ${Math.round(h.s.ratio * 100)}% / ${cut(h.subject, 50)}`);
}
if (hit.length > top) console.log(`- … ほか ${hit.length - top} 件(--top ${hit.length})`);
if (skipKeep || skipMerged || unknown) console.log(`(除いた: マージ済み PR の枝 ${skipMerged}・保留の PR ${skipKeep}${unknown ? `・基点が取れず判定できず ${unknown}` : ''})`);
console.log(hit.length ? '\n→ PRなし★は、社長が OK を出した物かを todo で確かめ、いまの main に合わせて入れ直して公開するか、捨てると決める(追跡表の OK済み に入れる)。' : '\n→ 落ちている枝は無し。');
