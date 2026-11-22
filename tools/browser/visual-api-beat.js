#!/usr/bin/env node
// モンヒロビートの見た目を、分析の入り口(analysis-gateway・kind ui-check)経由で Claude API に点検してもらう道具(API 総点検② 2026-11-23)。
// 作りは visual-api-life.js を写した物(撮影は tools/browser/visual-shoot.js の beat-* 場面。結果の置き場 <shoot>/shots/<大きさ>/<場面>.png)。
//   node tools/browser/visual-api-beat.js --shots <shoot の置き場> [--shots2 <切り欠きありの置き場>] --out <置き場>   見積りだけ
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/visual-api-beat.js ... --send     バッチで送る(半額)
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/visual-api-beat.js --out <置き場> --fetch   結果を受け取り、表にする
//   --only <場面の名前の一部を ,> / --max-usd 10(見積りがこれを超えたら送らない)
// 頼みの文は tools/browser/prompts/beat-ui-check.md + common-balance.md。合言葉は環境のネットワークの秘密で自動で付く。値はどこにも書かない。
'use strict';
const fs = require('fs');
const path = require('path');
const gw = require('../analysis/gateway-client');
const uiMeasure = require('./ui-measure');

const argv = process.argv.slice(2);
const opt = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const OUT = opt('--out');
if (!OUT) { console.log('使い方はこのファイルの先頭を見てください(--out は必ず要る)'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const PROMPT_FILE = path.join(__dirname, 'prompts', 'beat-ui-check.md');
const MAX_SCENES = 6;
const MAX_TOKENS = Math.min(Number(opt('--max-tokens', '20000')) || 20000, 32000);
const MAX_USD = Number(opt('--max-usd', '4'));
const SIZES = ['tate', 'yoko', 'yoko-s'];
const SIZE_NAME = { tate: '縦390×844', yoko: '横844×390', 'yoko-s': '小さい横568×320' };

// 場面の名札 → 日本語
const LABEL = [
  [/^beat-top$/, 'モンヒロビートのトップ'], [/^beat-songs$/, '曲えらび'], [/^beat-songs-rot$/, '曲えらび(🔄横)'], [/^beat-songs-versions$/, '曲えらび(版がある曲)'],
  [/^beat-songs-versions-rot$/, '曲えらび(版がある曲・🔄横)'], [/^beat-diff$/, '曲と難易度を選んだ所'], [/^beat-play$/, '演奏中'], [/^beat-ranking$/, 'この曲の全国ランキング'],
  [/^beat-event$/, '曲えらび(イベント開催中の時計)'], [/^beat-result$/, '結果(ランクアップの演出)'], [/^beat-result-close$/, '結果(演出を閉じたあと)'],
];
const labelOf = (code) => { for (const [re, l] of LABEL) { if (re.test(code)) return l; } return code; };
const AREAS = [
  { key: 'songs', re: /^beat-(top|songs)/, name: 'トップ・曲えらび(版・🔄横を含む)' },
  { key: 'play', re: /^beat-(diff|play|ranking|event)$/, name: '難易度・演奏中・ランキング・イベント' },
  { key: 'result', re: /^beat-result/, name: '結果' },
];
const areaOf = (k) => AREAS.find((a) => a.re.test(k)) || { key: 'etc', name: 'その他' };

const collect = (dirs) => {
  const scenes = new Map();
  dirs.forEach(({ dir, tag }) => {
    for (const size of SIZES) {
      const sd = path.join(dir, 'shots', size);
      if (!fs.existsSync(sd)) continue;
      const meas = uiMeasure.load(sd);
      for (const f of fs.readdirSync(sd).sort()) {
        const m = /^(beat-.+)\.png$/.exec(f);
        if (!m) continue;
        const key = `${tag}${m[1]}`;
        const sc = scenes.get(key) || scenes.set(key, { key: m[1], label: `${tag ? '切り欠きあり ' : ''}${labelOf(m[1])}〔${m[1]}〕`, shots: {}, machine: {}, metrics: {} }).get(key);
        sc.shots[size] = path.join(sd, f);
        sc.machine[size] = uiMeasure.lines(meas.get(f));
      }
    }
  });
  return [...scenes.values()];
};

const img = (file) => ({ type: 'image', media_type: 'image/png', data: fs.readFileSync(file).toString('base64') });
const buildRequests = (scenes) => {
  // 共通の「大きさの釣り合い」と「測った数字の扱い」を続けて渡す(モンサク・助手ライフ・モンビーで同じ)
  const system = `${fs.readFileSync(PROMPT_FILE, 'utf8')}\n${fs.readFileSync(path.join(__dirname, 'prompts', 'common-balance.md'), 'utf8')}`;
  const reqs = [];
  for (const a of [...AREAS, { key: 'etc', name: 'その他' }]) {
    const list = scenes.filter((s) => areaOf(s.key).key === a.key);
    for (let i = 0; i < list.length; i += MAX_SCENES) {
      const part = list.slice(i, i + MAX_SCENES);
      const content = [{ type: 'text', text: `まとまり: ${a.name}(${part.length}場面)。止め絵の前に名札を置きます。` }];
      for (const sc of part) for (const z of SIZES) if (sc.shots[z]) {
        const mt = sc.metrics && sc.metrics[z];
        const ng = mt && Array.isArray(mt.ng) && mt.ng.length ? ` / 機械の測った数字(machine): ${mt.ng.join(' ・ ')}` : '';
        const mm = (sc.machine || {})[z] || []; // ui-measure.js の測った指摘(高・中)
        content.push({ type: 'text', text: `【${sc.label}@${z}】${SIZE_NAME[z]}${ng}${mm.length ? ` / 機械の見つけ物(machine): ${mm.join(' ・ ')}` : ''}` }); content.push(img(sc.shots[z]));
      }
      content.push({ type: 'text', text: '上の止め絵を点検し、決めた形の JSON の配列だけを返してください。' });
      reqs.push({ custom_id: `l${String(reqs.length + 1).padStart(3, '0')}`, area: a.name, scenes: part.map((s) => s.label),
        machine: part.flatMap((sc) => SIZES.flatMap((z) => ((sc.metrics && sc.metrics[z] && sc.metrics[z].ng) || []).map((t) => ({ scene: sc.label, size: z, text: t })))),
        request: { system, cache_system: true, messages: [{ role: 'user', content }], max_tokens: MAX_TOKENS, effort: 'high' } });
    }
  }
  return reqs;
};

const parseJson = (text) => {
  const t = String(text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : []; } catch (e) {}
  const s = t.indexOf('[');
  for (let k = t.lastIndexOf(']'); s >= 0 && k > s; k = t.lastIndexOf(']', k - 1)) { try { const j = JSON.parse(t.slice(s, k + 1)); if (Array.isArray(j)) return j; } catch (e) {} }
  for (let k = t.lastIndexOf('}'); s >= 0 && k > s; k = t.lastIndexOf('}', k - 1)) { try { const j = JSON.parse(t.slice(s, k + 1) + ']'); if (Array.isArray(j)) return j; } catch (e) {} }
  return null;
};

const writeFindings = (results, usd) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
  const all = [], bad = [];
  for (const r of results) {
    const g = manifest.requests.find((x) => x.custom_id === r.custom_id) || {};
    const list = r.type === 'succeeded' ? parseJson(r.text) : null;
    if (!list) { bad.push(`${r.custom_id}(${r.type || '?'}・${r.stop_reason || ''})`); continue; }
    list.forEach((f) => all.push({ group: r.custom_id, area: g.area, ...f }));
  }
  const order = { 高: 0, 中: 1, 低: 2 };
  all.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3) || String(a.area).localeCompare(String(b.area)));
  fs.writeFileSync(path.join(OUT, 'api-findings.json'), JSON.stringify({ usd, findings: all, unreadable: bad }, null, 1));
  const cnt = (p) => all.filter((f) => f.priority === p).length;
  const cell = (s) => String(s ?? '').replace(/\|/g, '／').replace(/\n/g, ' ');
  const md = [`# モンヒロビートの見た目 API 点検の結果(${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} JST)`, '',
    `- 件数 ${all.length}(高 ${cnt('高')}・中 ${cnt('中')}・低 ${cnt('低')})/ 使った額 $${usd}${bad.length ? ` / 読めなかった返事 ${bad.join('、')}` : ''}`, '',
    '| 優先度 | まとまり | 場面 | 大きさ | 何が悪いか | 直し方 | 観点 | 受け持ちの手がかり | 機械 |', '|---|---|---|---|---|---|---|---|---|',
    ...all.map((f) => `| ${cell(f.priority)} | ${cell(f.area)} | ${cell(f.scene)} | ${cell((f.sizes || []).join('・'))} | ${cell(f.what)} | ${cell(f.fix)} | ${cell(f.viewpoint)} | ${cell(f.owner_hint)} | ${cell(f.machine_verdict || '')} |`)];
  // 基準を外れた測った数字は必ず指摘にする: API が「本物」「空振り」のどちらとも書かなかった場面の物は、機械の指摘として足す
  const judged = new Set(all.filter((f) => f.machine_verdict).map((f) => `${f.group}|${String(f.scene).replace(/〔.*〕/, '').trim()}`));
  const left = [];
  for (const g of manifest.requests) for (const m of g.machine || []) { const sc = m.scene.replace(/〔.*〕/, '').trim(); if (![...judged].some((k) => k.startsWith(`${g.custom_id}|`) && (k.endsWith(sc) || sc.endsWith(k.split('|')[1])))) left.push({ ...m, area: g.area }); }
  md.push('', `## 機械の測った数字で基準を外れ、API が判定を書かなかった物(${left.length}件。機械の指摘としてそのまま数える)`, '', '| 場面 | 大きさ | 基準を外れた物 |', '|---|---|---|', ...left.map((m) => `| ${cell(m.scene)} | ${m.size} | ${cell(m.text)} |`));
  fs.writeFileSync(path.join(OUT, 'machine-left.json'), JSON.stringify(left, null, 1));
  fs.writeFileSync(path.join(OUT, 'api-findings.md'), md.join('\n') + '\n');
  console.log(`API の見つけ物 ${all.length}件(高 ${cnt('高')}・中 ${cnt('中')}・低 ${cnt('低')})/ 使った額 $${usd}${bad.length ? ` / 読めず ${bad.join(',')}` : ''}`);
};

(async () => {
  if ((has('--send') || has('--fetch')) && gw.ensureProxyEnv()) return;
  if (has('--fetch')) {
    const b = JSON.parse(fs.readFileSync(path.join(OUT, 'batch.json'), 'utf8'));
    const results = []; let usd = 0, waiting = 0;
    for (const x of b.batches) {
      const r = await gw.send({ action: 'batch_get', batch_id: x.batch_id });
      if (r.status !== 200 || !r.json?.ok) { console.log(`受け取れない: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); process.exit(1); }
      if (!r.json.results) { waiting++; console.log(`  まだ: ${x.custom_ids.join(',')} ${r.json.processing_status}`); continue; }
      results.push(...r.json.results); usd += Number(r.json.usd) || 0;
    }
    if (waiting) { console.log(`まだ終わっていないバッチ ${waiting}本`); process.exit(3); }
    fs.writeFileSync(path.join(OUT, 'batch-results.json'), JSON.stringify({ results }, null, 1));
    writeFindings(results, Math.round(usd * 10000) / 10000);
    return;
  }
  const dir = opt('--shots');
  if (!dir || !fs.existsSync(dir)) { console.log('--shots <撮った置き場> が要る'); process.exit(1); }
  let scenes = collect([{ dir, tag: '' }, ...(opt('--shots2') ? [{ dir: opt('--shots2'), tag: '切' }] : [])]);
  const only = opt('--only').split(',').filter(Boolean);
  if (only.length) scenes = scenes.filter((s) => only.some((o) => s.key.includes(o) || s.label.includes(o)));
  const reqs = buildRequests(scenes);
  let usd = 0;
  for (const q of reqs) {
    const e = await gw.estimate(q.request, { batch: true });
    if (!e.ok) { console.log(`${q.custom_id} の形が入り口に断られる: ${e.error}`); process.exit(1); }
    q.usd_est = e.usd_est; usd += e.usd_est;
  }
  const imgs = reqs.reduce((n, q) => n + q.request.messages[0].content.filter((c) => c.type === 'image').length, 0);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), usd_est: Math.round(usd * 100) / 100, requests: reqs.map(({ request, ...rest }) => rest) }, null, 1));
  console.log(`場面 ${scenes.length} / 止め絵 ${imgs}枚 / 頼み ${reqs.length}本 / 多めの見積り $${usd.toFixed(2)}(バッチ・半額・出力は max_tokens を全部使った額)`);
  if (usd > MAX_USD) { console.log(`見積りが $${MAX_USD} を超えるので送らない`); process.exit(2); }
  if (!has('--send')) return;
  const PER = Number(opt('--per-batch', '3'));
  const sent = [];
  for (let i = 0; i < reqs.length; i += PER) {
    const part = reqs.slice(i, i + PER);
    const r = await gw.send({ action: 'batch_submit', kind: 'ui-check', label: `beat-visual-${part[0].custom_id}`, requests: part.map((q) => ({ custom_id: q.custom_id, request: q.request })) });
    if (r.status !== 200 || !r.json?.ok) { console.log(`${part[0].custom_id} から断られた・失敗: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); break; }
    sent.push({ batch_id: r.json.batch_id, usd_est: r.json.usd_est, custom_ids: part.map((q) => q.custom_id) });
    fs.writeFileSync(path.join(OUT, 'batch.json'), JSON.stringify({ batches: sent }, null, 1));
    console.log(`  ${part.map((q) => q.custom_id).join(',')} を頼んだ(見積り $${r.json.usd_est})`);
  }
  console.log(`バッチを ${sent.length}本 頼んだ。結果は --fetch で受け取る`);
})().catch((e) => { console.error(e.message); process.exit(1); });
