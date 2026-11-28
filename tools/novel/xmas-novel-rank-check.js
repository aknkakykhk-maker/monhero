#!/usr/bin/env node
// 事件簿のランキング(r1126-107)の端末側を確かめる。サーバ(Supabase)には触れない(fetch をこの中で作り物にする)。
//   ① 保存 mh_xmas_novel_rank_v1 の正規化(壊れた値・ためる上限50件・変な出来事は捨てる)
//   ② 送る中身: 数は送らず、出来事(end / first / seed)だけ。seed は前の記録(mh_xmas_novel_v1)から1回だけ
//   ③ 混みあい(busy)・届かないときは、ためたまま消さない。送れた物だけ消す
//   ④ デバッグ・検査で開いたとき(off)は、ためない・送らない
//   ⑤ mh_xmas_novel_v1・mh_xmas_novel_route_v1 には書かない
// 使い方: node tools/novel/xmas-novel-rank-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/79-xmas-novel-rank.jsx'), 'utf8');
// JSX の部分(画面)は外し、送る処理だけを動かす
const logic = src.slice(0, src.indexOf('// 見たエンドの内訳の点'));

const ng = [];
const ok = (cond, msg) => { if (!cond) ng.push(msg); else console.log(`OK: ${msg}`); };

const makeEnv = (opts = {}) => {
  const store = { mh_xmas_novel_v1: opts.save || null, ...(opts.store || {}) };
  const writes = [];
  const sent = [];
  let replies = opts.replies || [];
  const ctx = vm.createContext({
    console, JSON, Promise, Array, Object, Math, Number, String, Date,
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout: () => {},
    SUPABASE_URL: 'https://example.invalid', SB_HEADERS: {},
    storeGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    storeSet: async (k, v) => { writes.push(k); store[k] = JSON.parse(JSON.stringify(v)); return true; },
    masmonPvpSelf: async () => (opts.noSelf ? null : { owner: 'owner_1', key: 'k'.repeat(48) }),
    xmasNovelLoad: async () => opts.save || { endings: [], endAt: {}, first: {} },
    XMAS_NOVEL_SCRIPT: {},
    fetch: async (url, init) => {
      const body = init && init.body ? JSON.parse(init.body) : null;
      sent.push({ url, body });
      const r = replies.length ? replies.shift() : { ok: true, ends: 1 };
      if (r === 'down') throw new Error('network');
      return { ok: true, status: 200, text: async () => JSON.stringify(r) };
    },
  });
  vm.runInContext(`${logic}\nthis.R = { xmasNovelRankNormalize, xmasNovelRankFlush, xmasNovelRankNote, xmasNovelRankLoad, XMAS_NOVEL_RANK_KEY };`, ctx);
  return { R: ctx.R, store, writes, sent, setReplies: (r) => { replies = r; } };
};
const settle = () => new Promise((r) => setImmediate(r));

(async () => {
  // ① 正規化
  {
    const { R } = makeEnv();
    const n0 = R.xmasNovelRankNormalize(null);
    ok(n0.v === 1 && n0.seeded === 0 && Array.isArray(n0.pending) && n0.pending.length === 0, '① 保存が無いときは空(seeded 0・ためる物なし)');
    const many = Array.from({ length: 80 }, (_, i) => ({ k: 'end', id: `END-X${i % 9}` }));
    const n1 = R.xmasNovelRankNormalize({ seeded: 1, pending: [...many, { k: 'end', id: 'bad' }, { k: 'first', id: 'Q9z', ok: true }, { k: 'first', id: 'Q2a', ok: 'yes' }, { k: 'count', n: 99 }, null, 7] });
    ok(n1.seeded === 1 && n1.pending.length === 50, '① ためるのは50件まで');
    ok(n1.pending.every((p) => p.k === 'end' && /^END-/.test(p.id)), '① 変なエンドの名前・知らない問い・数の出来事は捨てる');
    ok(R.xmasNovelRankNormalize({ seeded: 'yes' }).seeded === 0, '① seeded は 1 以外なら 0');
  }
  // ② 前の記録(seed)を1回だけ送り、そのあとにためた出来事を送る。数は送らない
  {
    const save = { endings: ['END-G', 'END-X1', 'weird'], endAt: { 'END-G': '2026-11-28T03:00:00.000Z' }, first: { Q2a: { f: true }, Q3a: { f: false }, Qzz: { f: true } } };
    const env = makeEnv({ save, store: { mh_xmas_novel_rank_v1: { v: 1, seeded: 0, pending: [{ k: 'end', id: 'END-N' }, { k: 'first', id: 'Q4a', ok: true }] } },
      replies: [{ ok: true }, { ok: true }, { ok: true }] });
    await env.R.xmasNovelRankFlush();
    const kinds = env.sent.map((s) => s.body && s.body.p_row && s.body.p_row.kind);
    ok(JSON.stringify(kinds) === JSON.stringify(['seed', 'end', 'first']), `② 送る順は seed → ためた出来事(${kinds.join(',')})`);
    const seed = env.sent[0].body.p_row;
    ok(seed.ends.length === 2 && seed.ends[0].id === 'END-G' && seed.ends[0].at === '2026-11-28T03:00:00.000Z' && seed.ends[1].at === null, '② seed は見たエンドと、はじめて見た日時(無ければ null)。変な名前は送らない');
    ok(seed.firsts.Q2a === true && seed.firsts.Q3a === false && !('Qzz' in seed.firsts), '② seed の一発正解は決まった8問だけ');
    const flat = JSON.stringify(env.sent.map((s) => s.body));
    ok(!/"(ends_total|plays|perfect|count|score)"\s*:/.test(flat), '② 数(見たエンドの数・回数・一発正解の数)は送らない');
    ok(env.store.mh_xmas_novel_rank_v1.seeded === 1 && env.store.mh_xmas_novel_rank_v1.pending.length === 0, '② 送れたら seeded=1・ためた物は空');
    env.sent.length = 0; env.setReplies([{ ok: true }]);
    await env.R.xmasNovelRankFlush();
    ok(env.sent.length === 0, '② 2回目は seed を送らない(ためた物が無ければ何も送らない)');
    ok(env.writes.every((k) => k === 'mh_xmas_novel_rank_v1'), '⑤ 書くのは mh_xmas_novel_rank_v1 だけ(mh_xmas_novel_v1・mh_xmas_novel_route_v1 に書かない)');
  }
  // ③ 届かない・混みあい
  {
    const env = makeEnv({ store: { mh_xmas_novel_rank_v1: { v: 1, seeded: 1, pending: [{ k: 'end', id: 'END-A' }, { k: 'end', id: 'END-B' }] } }, replies: ['down'] });
    await env.R.xmasNovelRankFlush();
    ok(env.store.mh_xmas_novel_rank_v1.pending.length === 2, '③ 届かないときは、ためたまま消さない');
    env.setReplies([{ ok: false, reason: 'busy' }, { ok: true }, { ok: true }]);
    await env.R.xmasNovelRankFlush();
    ok(env.store.mh_xmas_novel_rank_v1.pending.length === 0 && env.sent.filter((s) => s.body.p_row.end_id === 'END-A').length >= 2, '③ 混みあい(busy)は間を空けて送り直し、送れた物だけ消す');
    const env2 = makeEnv({ store: { mh_xmas_novel_rank_v1: { v: 1, seeded: 1, pending: [{ k: 'end', id: 'END-A' }, { k: 'end', id: 'END-B' }] } }, replies: [{ ok: false, reason: 'closed' }] });
    await env2.R.xmasNovelRankFlush();
    ok(env2.sent.length === 1, '③ 期間外(closed)と返ったら、それ以上は送らない');
    const env3 = makeEnv({ noSelf: true, store: { mh_xmas_novel_rank_v1: { v: 1, seeded: 1, pending: [{ k: 'end', id: 'END-A' }] } } });
    await env3.R.xmasNovelRankFlush();
    ok(env3.sent.length === 0 && env3.store.mh_xmas_novel_rank_v1.pending.length === 1, '③ 持ち主の鍵が作れないときは送らず、ためたまま');
  }
  // ④ デバッグ・検査で開いたとき
  {
    const env = makeEnv({ store: { mh_xmas_novel_rank_v1: { v: 1, seeded: 1, pending: [] } } });
    env.R.xmasNovelRankNote({ k: 'end', id: 'END-G' }, { off: true });
    await settle(); await settle();
    ok(env.sent.length === 0 && env.writes.length === 0, '④ off のときは、ためない・送らない');
    env.R.xmasNovelRankNote({ k: 'end', id: 'END-G' });
    for (let i = 0; i < 20; i += 1) await settle();
    ok(env.sent.length === 1 && env.sent[0].body.p_row.kind === 'end' && env.sent[0].body.p_row.end_id === 'END-G', '④ ふだんは、エンドに着いたら1件送る');
  }
  // 画面のつなぎ: 一番はじめの答えだけ・見返しでは送らない・force では送らない
  {
    const scr = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/79-screen-xmas-novel.jsx'), 'utf8');
    ok(/if \(!\(s\.first && s\.first\[q\.id\]\) && typeof xmasNovelRankNote/.test(scr), '画面: 一発正解は一番はじめに答えたときだけ送る');
    ok(/if \(replayRef\.current\) \{[^\n]*return; \}\n[^\n]*\n[^\n]*xmasNovelRecordEnding[^\n]*\n[^\n]*xmasNovelRankNote\(\{ k: 'end'/.test(scr), '画面: エンドの記録と同じ所で送る(見返すときは通らない)');
    ok(/rankOff=\{!!opts\.force\}/.test(scr), '画面: デバッグ・検査の強制表示(force)では送らない');
  }
  if (ng.length) { console.log(`NG ${ng.length} 件`); ng.forEach((s) => console.log(`  - ${s}`)); process.exit(1); }
  console.log('OK: 事件簿のランキングの送り方と保存');
})();
