#!/usr/bin/env node
// 助手ライフの見た目を、分析の入り口(analysis-gateway・kind ui-check)経由で Claude API に点検してもらう道具(2026-11-20 ミハリ・助手ライフの総点検)。
// 作りは visual-api-monsuc.js を縮めて写した物(場面の名前・まとまり・頼みの文だけが違う)。
//
//   node tools/browser/visual-life-shoot.js --out <撮った置き場>                                  … 撮る(偽のデータ・ページの中だけ)
//   node tools/browser/visual-api-life.js --shots <撮った置き場> --out <置き場>                   見積りだけ(送らない)
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/visual-api-life.js --shots <撮った置き場> --out <置き場> --send   バッチで送る(半額)
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/visual-api-life.js --out <置き場> --fetch     結果を受け取り、表にする
//   --only <場面の名前の一部を , で> / --max-usd 4(見積りがこれを超えたら送らない)
// 頼みの文は tools/browser/prompts/life-ui-check.md。合言葉は環境のネットワークの秘密で自動で付く。値はどこにも書かない。
'use strict';
const fs = require('fs');
const path = require('path');
const gw = require('../analysis/gateway-client');

const argv = process.argv.slice(2);
const opt = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const OUT = opt('--out');
if (!OUT) { console.log('使い方はこのファイルの先頭を見てください(--out は必ず要る)'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const PROMPT_FILE = path.join(__dirname, 'prompts', 'life-ui-check.md');
const MAX_SCENES = 6;
const MAX_TOKENS = Math.min(Number(opt('--max-tokens', '20000')) || 20000, 32000);
const MAX_USD = Number(opt('--max-usd', '4'));
const SIZES = ['tate', 'pc'];
const SIZE_NAME = { tate: '縦390×844', pc: 'PC 1280×800' };

// 場面の名札 → 日本語(visual-life-shoot.js の名札)
const LABEL = [
  [/^00-home$/, 'HOME(助手ライフを開く前)'], [/^01-house-open$/, '家(開いてすぐ)'], [/^02-house-after-guide$/, '家(初めての案内を閉じたあと)'],
  [/^02-house-scroll-mid$/, '家(下へ半分)'], [/^03-house-scroll-end$/, '家(いちばん下)'], [/^03-town$/, '町'], [/^04-kizuna$/, 'きずな'], [/^05-friend-tab$/, 'フレンド'],
  [/^05-tier-help$/, 'にぎわいの説明'], [/^06-diary$/, '今日あったこと'], [/^07-watch$/, '見守る(掛け合いの場面)'], [/^08-call$/, '声をかける(選ぶ)'],
  [/^09-give$/, '贈る(選ぶ)'], [/^10-give-items$/, '贈る → 道具の一覧'], [/^11-room-alone$/, '部屋(家にひとり・あつ)'], [/^12-room-alone-scroll$/, '部屋(下へ・できること)'],
  [/^13-room-chat$/, '部屋 → おしゃべり'], [/^14-room-solo-gift$/, '部屋 → 1人に贈る'], [/^14b-room-masmon-battle$/, '部屋 → マスモンで対戦(β)'],
  [/^15-room-furn$/, '部屋 → 家具'], [/^16-room-plan$/, '部屋 → 予定表'], [/^17-room-masmon$/, '部屋 → 助手のマスモン'], [/^17b-house-note$/, '家 → 育成ノート'],
  [/^17c-house-note-scroll$/, '育成ノート(下へ)'], [/^18-masmon-tab-(.+)$/, '助手のマスモン(タブ $1)'], [/^21-room-away$/, '部屋(出かけている・ドラ)'],
  [/^22-room-pair$/, '部屋(みゅあ)'], [/^30-town$/, '町'], [/^30-town-(.+)$/, '町 → 場所の窓($1)'], [/^33-place-battle-scroll$/, '町 → モンヒロバトルの窓(下へ)'],
  [/^34-watch-train$/, '修行を見る'], [/^40-kizuna$/, 'きずな'], [/^41-kizuna-mid$/, 'きずな(関係図)'], [/^42-kizuna-end$/, 'きずな(ペアの一覧)'],
  [/^43-album$/, '思い出アルバム'], [/^50-profile-list$/, '紹介(一覧)'], [/^51-profile-detail$/, '紹介(みゅあ)'], [/^52-profile-detail-scroll$/, '紹介(みゅあ・下へ)'],
  [/^60-friend-tab$/, 'フレンド'], [/^61-friend-tab-scroll$/, 'フレンド(下へ)'], [/^62-friend-house$/, 'フレンドの家'], [/^64-friend-vtabs$/, 'フレンドの家(タブ)'],
  [/^night-house$/, '家(夜23時)'], [/^night-room-sleep$/, '部屋(夜・寝ている)'], [/^night-room-awake$/, '部屋(夜・起きている)'], [/^night-town$/, '町(夜)'],
];
const labelOf = (code) => { for (const [re, l] of LABEL) { const m = re.exec(code); if (m) return l.replace('$1', m[1] || ''); } return code; };
// まとまり(1本の頼みは同じまとまりの場面だけ)
const AREAS = [
  { key: 'first', re: /^first:/, name: '初めての人(HOME・家・町・きずな・フレンド)' },
  { key: 'house', re: /^:(0[0-9]|10)/, name: '家・見守る・声かけ・贈る' },
  { key: 'room', re: /^:(1[1-6]|14b|21|22)/, name: '部屋・家具・予定表・対戦' },
  { key: 'masmon', re: /^:(17|18)/, name: '助手のマスモン・育成ノート' },
  { key: 'town', re: /^:3/, name: '町・場所の窓・修行を見る' },
  { key: 'kizuna', re: /^:(4|5)/, name: 'きずな・アルバム・紹介' },
  { key: 'friend', re: /^:6/, name: 'フレンド' },
  { key: 'night', re: /^night:/, name: '夜(23時)' },
];
const areaOf = (k) => AREAS.find((a) => a.re.test(k)) || { key: 'etc', name: 'その他' };

const collect = (dir) => {
  const scenes = new Map();
  for (const f of fs.readdirSync(dir).sort()) {
    const m = /^(tate|pc)(?:-(first|night))?-(.+)\.png$/.exec(f);
    if (!m) continue;
    const code = m[3].replace(/^night-/, '');
    if (m[2] === 'night' && !/^night-/.test(m[3])) continue; // 夜の回の HOME・家を開いた所は昼と同じなので送らない
    const key = `${m[2] || ''}:${m[2] === 'night' ? 'night-' : ''}${code}`;
    const sc = scenes.get(key) || scenes.set(key, { key, label: `${m[2] === 'first' ? '初めての人 ' : ''}${labelOf(m[2] === 'night' ? `night-${code}` : code)}〔${m[3]}〕`, shots: {} }).get(key);
    sc.shots[m[1]] = path.join(dir, f);
  }
  return [...scenes.values()];
};

const img = (file) => ({ type: 'image', media_type: 'image/png', data: fs.readFileSync(file).toString('base64') });
const buildRequests = (scenes) => {
  const system = fs.readFileSync(PROMPT_FILE, 'utf8');
  const reqs = [];
  for (const a of [...AREAS, { key: 'etc', name: 'その他' }]) {
    const list = scenes.filter((s) => areaOf(s.key).key === a.key);
    for (let i = 0; i < list.length; i += MAX_SCENES) {
      const part = list.slice(i, i + MAX_SCENES);
      const content = [{ type: 'text', text: `まとまり: ${a.name}(${part.length}場面)。止め絵の前に名札を置きます。` }];
      for (const sc of part) for (const z of SIZES) if (sc.shots[z]) { content.push({ type: 'text', text: `【${sc.label}@${z}】${SIZE_NAME[z]}` }); content.push(img(sc.shots[z])); }
      content.push({ type: 'text', text: '上の止め絵を点検し、決めた形の JSON の配列だけを返してください。' });
      reqs.push({ custom_id: `l${String(reqs.length + 1).padStart(3, '0')}`, area: a.name, scenes: part.map((s) => s.label),
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
  const md = [`# 助手ライフの見た目 API 点検の結果(${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} JST)`, '',
    `- 件数 ${all.length}(高 ${cnt('高')}・中 ${cnt('中')}・低 ${cnt('低')})/ 使った額 $${usd}${bad.length ? ` / 読めなかった返事 ${bad.join('、')}` : ''}`, '',
    '| 優先度 | まとまり | 場面 | 大きさ | 何が悪いか | 直し方 | 観点 | 受け持ちの手がかり |', '|---|---|---|---|---|---|---|---|',
    ...all.map((f) => `| ${cell(f.priority)} | ${cell(f.area)} | ${cell(f.scene)} | ${cell((f.sizes || []).join('・'))} | ${cell(f.what)} | ${cell(f.fix)} | ${cell(f.viewpoint)} | ${cell(f.owner_hint)} |`)];
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
  let scenes = collect(dir);
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
    const r = await gw.send({ action: 'batch_submit', kind: 'ui-check', label: `life-visual-${part[0].custom_id}`, requests: part.map((q) => ({ custom_id: q.custom_id, request: q.request })) });
    if (r.status !== 200 || !r.json?.ok) { console.log(`${part[0].custom_id} から断られた・失敗: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); break; }
    sent.push({ batch_id: r.json.batch_id, usd_est: r.json.usd_est, custom_ids: part.map((q) => q.custom_id) });
    fs.writeFileSync(path.join(OUT, 'batch.json'), JSON.stringify({ batches: sent }, null, 1));
    console.log(`  ${part.map((q) => q.custom_id).join(',')} を頼んだ(見積り $${r.json.usd_est})`);
  }
  console.log(`バッチを ${sent.length}本 頼んだ。結果は --fetch で受け取る`);
})().catch((e) => { console.error(e.message); process.exit(1); });
