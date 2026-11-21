#!/usr/bin/env node
// ゲーム全体(モンサク・モンビー・助手ライフ以外)の見た目を analysis-gateway(ui-check)へ送る、この点検だけの台本(r1119-046)。
//   node api-all.js <撮影の結果> <置き場> [--send] [--fetch]
// 指示書は tools/browser/prompts/monsuc-ui-check.md を全画面向けに言い換えた物 + common-balance.md。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = '/home/user/monhero';
const gw = require(path.join(ROOT, 'tools/analysis/gateway-client'));
const [SHOOT, OUT] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const has = (n) => process.argv.includes(n);
fs.mkdirSync(OUT, { recursive: true });
const SIZES = ['tate', 'yoko', 'pc'];
const SIZE_NAME = { tate: '縦390×844', yoko: '横844×390', pc: 'PC1280×800' };

const buildSystem = () => {
  let p = fs.readFileSync(path.join(ROOT, 'tools/browser/prompts/monsuc-ui-check.md'), 'utf8');
  p = p.replace(/^あなたは[\s\S]*?見てください。「壊れていないから良し」とはしません。/m,
    'あなたはスマホ向けブラウザゲーム「モンスターヒーロー」の画面(HOME・マーケット・カードバトル・タクティクス・図鑑・設定・ヘルプなど。育成モードのモンサク・音ゲーのモンヒロビート・助手ライフは今回は対象外)を、\n社長の代わりに厳しく点検するUIデザイナーです。社長は「俺ですら気付いてるのに機械で確認して気付かないなら意味がない」と言っています。\n**全部作り直すくらいの目線**で見てください。「壊れていないから良し」とはしません。');
  p = p.replace(/^モンサクは横向きを非対応にした[^\n]*\n/m, 'この画面たちは縦(390×844)・横(844×390)・PC(1280×800)の3つで遊ばれる。横で起きる件も挙げる。\n');
  p = p.replace(/^参考として、手本にしている[\s\S]*?挙げてください。\n/m, '');
  p = p.replace(/tate=縦390×844・yoko=横844×390・yoko-s=小さい横568×320/, 'tate=縦390×844・yoko=横844×390・pc=PC1280×800');
  p = p.replace(/"owner_hint": "[^}]*?"その他",/, '"owner_hint": "HOME"|"マーケット"|"カードバトル"|"タクティクス"|"図鑑・M/B管理"|"設定"|"ヘルプ・更新履歴"|"助手(HOME)"|"窓・閉じる"|"言葉"|"その他",');
  p = p.replace(/1回の頼みで最大 25 件。/, '1回の頼みで最大 30 件。場面ごとに漏れなく(1場面に問題が無ければ挙げなくてよい)。');
  p += '\n\n## HOME の見やすさ(社長 r1119-050。HOME の場面が渡されたら必ず見る)\n- ひと目で「次に何を押すか」が分かるか。押せる所の数が多すぎてごちゃついていないか\n- 助手の「💬 おしゃべり」と「タップで詳しく」のような、同じ相手への押し所が2つ以上に分かれていないか(1つにまとめる案を出す)\n- 助手の吹き出しが、ほかのボタン・バナー・数字に重なったり、読ませたい物を隠していないか\n- 入口(モード)のボタンの大きさ・並びが、遊ぶ頻度や大事さと合っているか。バッジ・赤い点が多すぎて意味が薄れていないか\n';
  p += `\n${fs.readFileSync(path.join(ROOT, 'tools/browser/prompts/common-balance.md'), 'utf8')}`;
  return p;
};

const AREA_ORDER = ['HOME', 'マーケット', 'カードバトル', 'タクティクス', '図鑑', '設定', 'ヘルプ'];
const collect = () => {
  const res = JSON.parse(fs.readFileSync(path.join(SHOOT, 'results.json'), 'utf8'));
  const out = [];
  for (const sc of res.scenes) {
    const shots = {}, machine = {};
    for (const z of SIZES) {
      const rel = path.join('shots', z, `${sc.id}.png`);
      if (!fs.existsSync(path.join(SHOOT, rel))) continue;
      shots[z] = path.join(SHOOT, rel);
      machine[z] = res.findings.filter((f) => f.shot === rel && f.priority !== '低').slice(0, 8)
        .map((x) => (/^測る:/.test(x.kind) ? `[測る・${x.priority}] ${x.kind.slice(3)}: ${x.detail}` : `[${x.priority}] ${x.kind}: ${x.detail}`).slice(0, 220));
    }
    out.push({ id: sc.id, area: sc.area, label: `${sc.area} / ${sc.name}〔${sc.id}〕`, shots, machine });
  }
  return out;
};

const buildRequests = (scenes) => {
  const system = buildSystem();
  fs.writeFileSync(path.join(OUT, 'system-prompt.md'), system);
  const groups = [];
  for (const a of AREA_ORDER) {
    const list = scenes.filter((s) => s.area === a);
    for (let i = 0; i < list.length; i += 6) groups.push({ area: a, scenes: list.slice(i, i + 6) });
  }
  return groups.map((g, n) => {
    const content = [{ type: 'text', text: `まとまり: ${g.area}(${g.scenes.length}場面)。止め絵の前に名札を置きます。` }];
    for (const sc of g.scenes) for (const z of SIZES) {
      if (!sc.shots[z]) continue;
      const m = sc.machine[z] || [];
      content.push({ type: 'text', text: `【${sc.label}@${z}】${SIZE_NAME[z]}${m.length ? ` / 機械の見つけ物(machine): ${m.join(' ・ ')}` : ''}` });
      content.push(gw.imageBlock(sc.shots[z]));
    }
    content.push({ type: 'text', text: '上の止め絵を点検し、決めた形の JSON の配列だけを返してください。scene には名札の「〔〕」の中の id も残してください。' });
    return { custom_id: `a${String(n + 1).padStart(3, '0')}`, area: g.area, scenes: g.scenes.map((s) => s.label),
      request: { system, cache_system: true, messages: [{ role: 'user', content }], max_tokens: 24000, effort: 'high' } };
  });
};

const parseJson = (text) => {
  const t = String(text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { const j = JSON.parse(t); if (Array.isArray(j)) return j; } catch (e) {}
  const s = t.indexOf('[');
  for (let k = t.lastIndexOf(']'); s >= 0 && k > s; k = t.lastIndexOf(']', k - 1)) { try { const j = JSON.parse(t.slice(s, k + 1)); if (Array.isArray(j)) return j; } catch (e) {} }
  for (let k = t.lastIndexOf('}'); s >= 0 && k > s; k = t.lastIndexOf('}', k - 1)) { try { const j = JSON.parse(t.slice(s, k + 1) + ']'); if (Array.isArray(j)) return j; } catch (e) {} }
  return null;
};

(async () => {
  if ((has('--send') || has('--fetch')) && gw.ensureProxyEnv()) return;
  if (has('--fetch')) {
    const b = JSON.parse(fs.readFileSync(path.join(OUT, 'batch.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
    const results = []; let usd = 0, waiting = 0;
    for (const x of b.batches) {
      const r = await gw.send({ action: 'batch_get', batch_id: x.batch_id });
      if (r.status !== 200 || !r.json?.ok) { console.log(`受け取れない: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); process.exit(1); }
      if (!r.json.results) { waiting++; console.log(`  まだ: ${x.custom_ids.join(',')} ${r.json.processing_status}`); continue; }
      results.push(...r.json.results); usd += Number(r.json.usd) || 0;
    }
    if (waiting) { console.log(`まだ ${waiting}本`); process.exit(3); }
    fs.writeFileSync(path.join(OUT, 'batch-results.json'), JSON.stringify({ results }, null, 1));
    const all = [], bad = [];
    for (const r of results) {
      const g = manifest.requests.find((q) => q.custom_id === r.custom_id) || {};
      const list = r.type === 'succeeded' ? parseJson(r.text) : null;
      if (!list) { bad.push(`${r.custom_id}(${r.type}・${r.stop_reason || ''})`); continue; }
      list.forEach((f) => all.push({ group: r.custom_id, area: g.area, ...f }));
    }
    fs.writeFileSync(path.join(OUT, 'api-findings.json'), JSON.stringify({ usd: Math.round(usd * 10000) / 10000, findings: all, unreadable: bad }, null, 1));
    const c = (p) => all.filter((f) => f.priority === p).length;
    console.log(`件数 ${all.length}(高 ${c('高')}・中 ${c('中')}・低 ${c('低')})/ $${usd.toFixed(4)} / 読めない ${bad.join(',') || 'なし'}`);
    return;
  }
  const reqs = buildRequests(collect());
  let usd = 0;
  for (const q of reqs) { const e = await gw.estimate(q.request, { batch: true }); if (!e.ok) { console.log(`${q.custom_id}: ${e.error}`); process.exit(1); } q.usd_est = e.usd_est; usd += e.usd_est; }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), usd_est: Math.round(usd * 100) / 100, requests: reqs.map(({ request, ...r }) => r) }, null, 1));
  const imgs = reqs.reduce((n, q) => n + q.request.messages[0].content.filter((c) => c.type === 'image').length, 0);
  console.log(`頼み ${reqs.length}本 / 止め絵 ${imgs}枚 / 多めの見積り $${usd.toFixed(2)}`);
  if (usd > 15) { console.log('$15 超え。送らない'); process.exit(2); }
  if (!has('--send')) return;
  const sent = [];
  for (let i = 0; i < reqs.length; i += 3) {
    const part = reqs.slice(i, i + 3);
    const r = await gw.send({ action: 'batch_submit', kind: 'ui-check', label: `all-visual-${part[0].custom_id}`, requests: part.map((q) => ({ custom_id: q.custom_id, request: q.request })) });
    if (r.status !== 200 || !r.json?.ok) { console.log(`${part[0].custom_id} 断られた: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); break; }
    sent.push({ batch_id: r.json.batch_id, usd_est: r.json.usd_est, custom_ids: part.map((q) => q.custom_id) });
    fs.writeFileSync(path.join(OUT, 'batch.json'), JSON.stringify({ batches: sent }, null, 1));
    console.log(`  ${part.map((q) => q.custom_id).join(',')} 頼んだ(見積り $${r.json.usd_est})`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
