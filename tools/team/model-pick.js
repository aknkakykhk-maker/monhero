#!/usr/bin/env node
// 仕事の文から、その仕事に合うモデルを表(tools/team/routing.json)で引く。新しい会話を作る前に打つ。
//
//   node tools/ctx.js model "<仕事の文>"          … 種類・モデル・理由を1行ずつ
//   node tools/ctx.js model "<仕事の文>" --failed 2 … 同じ不具合を直した回数(2回直して直らないなら要所のモデルへ)
//   node tools/ctx.js model --kind design          … 種類を自分で決めて引く(watch / small / run / build / design / final / tool)
//   node tools/ctx.js model --table                … 表の全体
//
// 【なぜあるか】
// どの仕事も同じ高いモデルで動かしていた(文言の直しも原因不明の不具合も)。仕事の種類で分ける決まりを、
// 覚えておくのではなく引けるようにする(2026-11-11 社長「トークンを無駄に使わない仕組み」案B・C)。
// 迷ったら上のモデルではなく「既定」(小さな直し)に落ちる。壊すと戻せない所の語は必ず design 以上へ上げる。
'use strict';
const { loadRouting } = require('./lib');

// この語が入っていたら、ほかの語が何であっても design 以上(保存データ・ランキングは壊すと戻せない)
const ALWAYS_DESIGN = ['保存データ', 'セーブ', '移行', 'ランキング', 'Supabase', 'SQL', 'mh_'];

function pick(text, { failed = 0, kind } = {}) {
  const R = loadRouting();
  const byId = Object.fromEntries(R['種類'].map(k => [k.id, k]));
  const t = String(text || '');
  if (kind) {
    if (!byId[kind]) throw new Error(`知らない種類「${kind}」(${Object.keys(byId).join(' / ')})`);
    return { kind: byId[kind], why: '種類を指定' };
  }
  if (failed >= 2) return { kind: byId.final, why: `同じ不具合を ${failed} 回直して直っていない` };
  const score = R['種類'].map(k => ({ k, hits: k['語'].filter(w => t.includes(w)) }));
  const fin = score.find(s => s.k.id === 'final');
  if (fin.hits.length) return { kind: byId.final, why: `語: ${fin.hits.join('・')}` };
  // 道具を作る・強化する1回は最新モデル。できた道具を回すだけの点検(run)とは分ける
  const tool = score.find(s => s.k.id === 'tool');
  if (tool && tool.hits.length) return { kind: byId.tool, why: `語: ${tool.hits.join('・')}` };
  const guard = ALWAYS_DESIGN.filter(w => t.includes(w));
  if (guard.length) return { kind: byId.design, why: `壊すと戻せない所の語: ${guard.join('・')}` };
  // 上のモデルほど「語が多く当たったとき」だけ選ぶ。同点なら安いほう(表の並びが安い順)
  const best = score.filter(s => !['final', 'tool'].includes(s.k.id)).sort((a, b) => b.hits.length - a.hits.length)[0];
  if (!best.hits.length) return { kind: byId[R['既定']], why: '当たる語が無いので既定' };
  return { kind: best.k, why: `語: ${best.hits.join('・')}` };
}

function table() {
  const R = loadRouting();
  const L = ['| 種類 | モデル | いつ |', '| --- | --- | --- |'];
  for (const k of R['種類']) L.push(`| ${k['名前']}(\`${k.id}\`) | \`${k.model}\` | ${k['いつ']} |`);
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--table')) { console.log(table()); return; }
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const text = argv.filter((a, i) => !a.startsWith('--') && !['--failed', '--kind'].includes(argv[i - 1])).join(' ');
  if (!text && !opt('--kind')) { console.error('NG: 仕事の文を渡してください(node tools/ctx.js model "<仕事の文>")。表は --table'); process.exit(1); }
  let r;
  try { r = pick(text, { failed: Number(opt('--failed')) || 0, kind: opt('--kind') }); } catch (e) { console.error('NG: ' + e.message); process.exit(1); }
  console.log(`種類: ${r.kind['名前']}(${r.kind.id})`);
  console.log(`モデル: ${r.kind.model}`);
  console.log(`理由: ${r.why} / ${r.kind['いつ']}`);
  if (!['final', 'tool'].includes(r.kind.id)) console.log('上げる条件: 同じ不具合を2回直して直らない → --failed 2(claude-fable-5-2)。新機能の公開前の最終確認 → --kind final');
}

if (require.main === module) main();
module.exports = { pick, table };
