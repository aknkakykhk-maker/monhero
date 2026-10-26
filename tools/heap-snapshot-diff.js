#!/usr/bin/env node
// ページのメモリの写し(heap snapshot)を2枚比べて、増えた部品の種類と、それをつかんでいるものを出す
// (2026-10-16 社長「AUTO∞ で1時間ずっと増え続ける blink_gc の正体を突き止める」・案A)。
//
//   node tools/heap-snapshot-diff.js <前.heapsnapshot> <後.heapsnapshot>             増えた種類の上位(数と大きさ)
//   node tools/heap-snapshot-diff.js <前> <後> --retainers "Detached HTMLDivElement"  その種類のうち、後で増えた部品が何につかまれているか
//   node tools/heap-snapshot-diff.js <前> <後> --top 40 --paths 5                      上位の数・つかまれ方を出す数
//
// 写しは tools/memory-soak.js --snapshot-at 10,40 --snapshot-dir <フォルダ> で取る。
// 部品(ノード)は「種類(type)+名前(name)」で数える。Blink の部品(HTML の要素・CSS など)は native、
// 画面から外れたのに残っている要素は "Detached 〜" の名前になる。後で新しく現れた部品(id が前の写しに無いもの)だけを
// 「増えた」として、そこから根(ウィンドウ・タイマー・リスナーなど)へ向かってつかんでいる鎖をたどる。
'use strict';
const fs = require('fs');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (files.length < 2) { console.log('使い方: node tools/heap-snapshot-diff.js <前.heapsnapshot> <後.heapsnapshot> [--retainers <名前>] [--top 30] [--paths 5]'); process.exit(2); }
const TOP = Number(opt('--top', 30)) || 30, PATHS = Number(opt('--paths', 5)) || 5, WANT = opt('--retainers', null);

const load = (file) => {
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  const meta = snap.snapshot.meta;
  const nf = meta.node_fields, ef = meta.edge_fields;
  const N = nf.length, E = ef.length;
  const nodeTypes = meta.node_types[nf.indexOf('type')], edgeTypes = meta.edge_types[ef.indexOf('type')];
  const iType = nf.indexOf('type'), iName = nf.indexOf('name'), iId = nf.indexOf('id'), iSelf = nf.indexOf('self_size'), iEdges = nf.indexOf('edge_count'), iDet = nf.indexOf('detachedness');
  const eType = ef.indexOf('type'), eName = ef.indexOf('name_or_index'), eTo = ef.indexOf('to_node');
  const nodes = snap.nodes, edges = snap.edges, strings = snap.strings;
  const count = nodes.length / N;
  const firstEdge = new Uint32Array(count + 1);
  for (let i = 0, e = 0; i < count; i++) { firstEdge[i] = e; e += nodes[i * N + iEdges] * E; firstEdge[i + 1] = e; }
  const name = (i) => {
    const t = nodeTypes[nodes[i * N + iType]];
    let n = strings[nodes[i * N + iName]];
    if (iDet >= 0 && nodes[i * N + iDet] === 2 && !/^Detached /.test(n)) n = `Detached ${n}`;
    if (t === 'string' || t === 'concatenated string' || t === 'sliced string') return `(${t})`;
    if (t === 'code') return '(code)';
    if (t === 'array') return `(array) ${n.slice(0, 40)}`;
    if (t === 'closure') return `(closure) ${n.slice(0, 60)}`;
    return `${t === 'native' ? '[native] ' : t === 'object' ? '' : `(${t}) `}${n.slice(0, 80)}`;
  };
  return { nodes, edges, strings, N, E, count, firstEdge, nodeTypes, edgeTypes, iId, iSelf, eType, eName, eTo, name };
};

console.log(`読み込み中: ${files[0]}`);
const A = load(files[0]);
console.log(`読み込み中: ${files[1]}`);
const B = load(files[1]);

const tally = (S) => { const m = new Map(); for (let i = 0; i < S.count; i++) { const k = S.name(i); const v = m.get(k) || { n: 0, size: 0 }; v.n++; v.size += S.nodes[i * S.N + S.iSelf]; m.set(k, v); } return m; };
const ta = tally(A), tb = tally(B);
const rows = [];
for (const [k, v] of tb) { const a = ta.get(k) || { n: 0, size: 0 }; if (v.n - a.n > 0 || v.size - a.size > 0) rows.push({ k, dn: v.n - a.n, ds: v.size - a.size, n: v.n }); }
const sumA = [...ta.values()].reduce((s, v) => s + v.size, 0), sumB = [...tb.values()].reduce((s, v) => s + v.size, 0);
console.log(`\n全体: 部品 ${A.count} → ${B.count}(${B.count - A.count >= 0 ? '+' : ''}${B.count - A.count}) / 大きさ ${(sumA / 1048576).toFixed(1)} → ${(sumB / 1048576).toFixed(1)}MB`);
console.log(`\n増えた大きさの上位(種類・増えた数・増えた大きさ・後の数):`);
rows.sort((x, y) => y.ds - x.ds).slice(0, TOP).forEach((r) => console.log(`  ${(r.ds / 1024).toFixed(0).padStart(8)}KB  +${String(r.dn).padStart(6)}個  (後 ${r.n})  ${r.k}`));
console.log(`\n増えた数の上位:`);
rows.sort((x, y) => y.dn - x.dn).slice(0, TOP).forEach((r) => console.log(`  +${String(r.dn).padStart(6)}個  ${(r.ds / 1024).toFixed(0).padStart(8)}KB  (後 ${r.n})  ${r.k}`));

// ---- つかまれ方: 後の写しで新しく現れた(前に無い id の)その種類の部品から、根へ向かってたどる ----
const target = WANT || rows.filter((r) => /^Detached |^\[native\]/.test(r.k)).sort((x, y) => y.dn - x.dn)[0]?.k;
if (target) {
  const idsA = new Set(); for (let i = 0; i < A.count; i++) idsA.add(A.nodes[i * A.N + A.iId]);
  // 逆向きの辺(誰につかまれているか)
  const S = B;
  const revStart = new Uint32Array(S.count + 1), revCount = new Uint32Array(S.count);
  const weakIdx = S.edgeTypes.indexOf('weak');
  for (let i = 0; i < S.count; i++) for (let e = S.firstEdge[i]; e < S.firstEdge[i + 1]; e += S.E) { if (S.edges[e + S.eType] === weakIdx) continue; revCount[S.edges[e + S.eTo] / S.N]++; }
  for (let i = 0, acc = 0; i < S.count; i++) { revStart[i] = acc; acc += revCount[i]; revStart[i + 1] = acc; }
  const revFrom = new Uint32Array(revStart[S.count]), revEdge = new Uint32Array(revStart[S.count]), fill = new Uint32Array(S.count);
  for (let i = 0; i < S.count; i++) for (let e = S.firstEdge[i]; e < S.firstEdge[i + 1]; e += S.E) { if (S.edges[e + S.eType] === weakIdx) continue; const to = S.edges[e + S.eTo] / S.N; const at = revStart[to] + fill[to]++; revFrom[at] = i; revEdge[at] = e; }
  const edgeLabel = (e) => { const t = S.edgeTypes[S.edges[e + S.eType]]; const nm = S.edges[e + S.eName]; return t === 'element' || t === 'hidden' ? `[${nm}]` : `.${S.strings[nm]}`; };
  const fresh = [];
  for (let i = 0; i < S.count && fresh.length < 2000; i++) if (S.name(i) === target && !idsA.has(S.nodes[i * S.N + S.iId])) fresh.push(i);
  console.log(`\nつかまれ方: 「${target}」のうち後で新しく現れたもの ${fresh.length}個から、根へ向かって(最短の鎖・最大 ${PATHS} 本・同じ鎖はまとめる)`);
  const seenPaths = new Map();
  for (const start of fresh.slice(0, 300)) {
    // 幅優先で根(synthetic・Window など)へ
    const prev = new Map([[start, null]]); const q = [start]; let found = null;
    while (q.length && !found) {
      const cur = q.shift();
      for (let r = revStart[cur]; r < revStart[cur + 1]; r++) {
        const from = revFrom[r]; if (prev.has(from)) continue;
        prev.set(from, { node: cur, edge: revEdge[r] });
        const t = S.nodeTypes[S.nodes[from * S.N]];
        if (t === 'synthetic' || /^Window|^system \/ NativeContext/.test(S.strings[S.nodes[from * S.N + 1]])) { found = from; break; }
        if (prev.size < 200000) q.push(from);
      }
    }
    if (found == null) continue;
    const chain = [];
    for (let n = found; n !== start;) { const p = prev.get(n); chain.push(`${S.name(n).slice(0, 50)} ${edgeLabel(p.edge)}`); n = p.node; }
    chain.push(target);
    const key = chain.map((c) => c.replace(/@\d+/g, '')).join(' → ');
    seenPaths.set(key, (seenPaths.get(key) || 0) + 1);
  }
  [...seenPaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, PATHS).forEach(([k, n]) => console.log(`\n  ${n}個:\n    ${k.split(' → ').join('\n      → ')}`));
}
