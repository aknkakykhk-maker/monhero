#!/usr/bin/env node
// 社長が実機で見つけた見た目の件を、直す前の版で撮り、点検(測る検査 + API)が全部拾えるかを確かめる道具(2026-11-20 ミハリ)。
// 件の一覧(試験): docs/progress/kensa/president-eye/cases.json。新しい指摘が来たら1件足して回す。
//
//   node tools/browser/president-eye-calibrate.js --out <置き場> --shoot            … 撮る(古い版は SHOT_REV で git から配る。作業ツリーは作らない)
//   node tools/browser/president-eye-calibrate.js --out <置き場>                    … 測る検査で拾えたかの表(API の結果があれば、それも)
//   node tools/browser/president-eye-calibrate.js --out <置き場> --api              … API に送る見積りだけ
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/president-eye-calibrate.js --out <置き場> --api --send    バッチで送る(半額)
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/president-eye-calibrate.js --out <置き場> --fetch         結果を受け取って表にする
//   --only M1,B1  件を絞る / --max-usd 3  見積りがこれを超えたら送らない / --remeasure 撮り直さず測り直す(撮影の道具の止め絵は残る)
//
// 撮影はどれもページの中だけ(偽のデータ・本番のサーバーへは送らない・デバッグの合言葉は使わない)。
// 結果: <置き場>/<件>/(止め絵と _measure.jsonl)・<置き場>/calibration.json・calibration.md
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const uiMeasure = require('./ui-measure');

const argv = process.argv.slice(2);
const opt = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const OUT = path.resolve(opt('--out', ''));
if (!opt('--out')) { console.log('使い方はこのファイルの先頭を見てください(--out は必ず要る)'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const CASES_FILE = path.join(ROOT, 'docs', 'progress', 'kensa', 'president-eye', 'cases.json');
const only = opt('--only').split(',').filter(Boolean);
const CASES = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8')).cases.filter((c) => !only.length || only.includes(c.id));
const PROMPT = { モンサク: 'monsuc-ui-check.md', 助手ライフ: 'life-ui-check.md', モンビー: 'beat-ui-check.md' };
const SIZE_NAME = { tate: '縦390×844', pc: 'PC1280×800' };
// 止め絵の道。"repo:<道>" は社長の実機の止め絵など、リポジトリにある絵(測る検査は無し・API だけ)
const shotPath = (c, f) => (f.startsWith('repo:') ? path.join(ROOT, f.slice(5)) : path.join(OUT, c.id, f));
const sizeOfShot = (f) => (/(-pc\.png$|^pc-|\/pc\/)/.test(f) ? 'pc' : 'tate');

// ---- 撮る ----
const shoot = (c) => {
  if (!c.shoot) { console.log(`  ${c.id} ${c.title}: 撮らない(社長の実機の止め絵を使う)`); return; }
  const dir = path.join(OUT, c.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const env = { ...process.env, UI_MEASURE: '1' };
  if (c.rev && c.rev !== 'HEAD') env.SHOT_REV = c.rev;
  let cmd;
  const s = c.shoot;
  if (s.tool === 'msx') cmd = ['tools/success/success-shoot.js', [], { SHOT_SIZES: s.sizes, SHOT_ONLY: s.only, SHOT_DIR: dir }];
  else if (s.tool === 'r3') cmd = ['tools/success/success-r3-shoot.js', [], { SHOT_SIZES: s.sizes, ONLY: s.only, SHOT_DIR: dir }];
  else if (s.tool === 'arc') cmd = ['tools/success/success-arc-shoot.js', [], { SHOT_SIZES: s.sizes, ONLY: s.only, SHOT_DIR: dir }];
  else if (s.tool === 'home') cmd = ['tools/browser/visual-shoot.js', ['--only', s.only, '--sizes', s.sizes, '--out', dir], {}];
  else if (s.tool === 'life') cmd = ['tools/browser/visual-life-shoot.js', ['--only', s.only, '--sizes', s.sizes, '--out', dir], {}];
  else throw new Error(`撮影の道具が分からない: ${s.tool}`);
  const t0 = Date.now();
  const r = spawnSync('node', [cmd[0], ...cmd[1]], { cwd: ROOT, env: { ...env, ...cmd[2] }, encoding: 'utf8', timeout: 15 * 60e3, maxBuffer: 64 << 20 });
  fs.writeFileSync(path.join(dir, '_shoot.log'), `${r.stdout || ''}\n${r.stderr || ''}`);
  const got = c.shots.filter((f) => fs.existsSync(shotPath(c, f)));
  console.log(`  ${c.id} ${c.title}: 止め絵 ${got.length}/${c.shots.length}(${((Date.now() - t0) / 1000).toFixed(0)}秒・版 ${c.rev})`);
};

// ---- 測る検査の結果を読む ----
const measured = (c) => {
  const dir = path.join(OUT, c.id);
  const kinds = new Map(); // 種類 → [止め絵: 中身]
  const missing = [];
  for (const f of c.shots) {
    const full = shotPath(c, f);
    if (!fs.existsSync(full)) { missing.push(f); continue; }
    const rec = uiMeasure.load(path.dirname(full)).get(path.basename(full));
    for (const x of (rec && rec.findings) || []) { const v = kinds.get(x.kind) || kinds.set(x.kind, []).get(x.kind); v.push(`${sizeOfShot(f)}: ${x.detail}`); }
  }
  const want = c.expect.measure || [];
  const hit = want.filter((k) => kinds.has(k));
  return { kinds, missing, want, hit, ok: want.length ? hit.length === want.length : null };
};

// ---- API ----
const buildRequests = () => {
  const common = fs.readFileSync(path.join(__dirname, 'prompts', 'common-balance.md'), 'utf8');
  const reqs = [];
  for (const c of CASES) {
    const content = [{ type: 'text', text: `${c.game}の画面「${c.screen}」。止め絵の前に名札を置きます。` }];
    for (const f of c.shots) {
      const full = shotPath(c, f);
      if (!fs.existsSync(full)) continue;
      const z = sizeOfShot(f);
      const lines = uiMeasure.lines(uiMeasure.load(path.dirname(full)).get(path.basename(full)));
      content.push({ type: 'text', text: `【${c.screen}@${z}】${SIZE_NAME[z]}${lines.length ? ` / 機械の見つけ物(machine): ${lines.join(' ・ ')}` : ''}` });
      content.push({ type: 'image', media_type: /\.jpe?g$/i.test(full) ? 'image/jpeg' : 'image/png', data: fs.readFileSync(full).toString('base64') });
    }
    if (content.length < 3) continue;
    content.push({ type: 'text', text: '上の止め絵を点検し、決めた形の JSON の配列だけを返してください。' });
    const system = `${fs.readFileSync(path.join(__dirname, 'prompts', PROMPT[c.game]), 'utf8')}\n${common}`;
    reqs.push({ custom_id: c.id, request: { system, cache_system: true, messages: [{ role: 'user', content }], max_tokens: Number(opt('--max-tokens', '8000')), effort: opt('--effort', 'medium') } });
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
const apiOf = (c, api) => {
  if (!api) return { ok: null, hits: [] };
  const list = api.byCase[c.id];
  if (!list) return { ok: null, hits: [] };
  const re = new RegExp(c.expect.api);
  const hits = list.filter((f) => re.test(`${f.what || ''} ${f.fix || ''}`));
  return { ok: hits.length > 0, hits, n: list.length };
};

// ---- 表 ----
const report = () => {
  const apiFile = path.join(OUT, 'api', 'api-findings.json');
  const api = fs.existsSync(apiFile) ? JSON.parse(fs.readFileSync(apiFile, 'utf8')) : null;
  const rows = CASES.map((c) => ({ c, m: measured(c), a: apiOf(c, api) }));
  const mark = (v) => (v === true ? '○' : v === false ? '×' : '—');
  const md = ['| 件 | ゲーム | 社長の件 | 版 | 測る | API | 拾った物 |', '|---|---|---|---|---|---|---|'];
  for (const { c, m, a } of rows) {
    const got = [];
    for (const k of m.hit) got.push(`測る「${k}」${m.kinds.get(k)[0].slice(0, 70)}`);
    if (a.hits.length) got.push(`API「${String(a.hits[0].what).slice(0, 70)}」`);
    if (m.missing.length) got.push(`撮れなかった: ${m.missing.join('・')}`);
    md.push(`| ${c.id} | ${c.game} | ${c.title} | ${c.rev}${c.pr ? ` ${c.pr}` : ''} | ${mark(m.ok)}${m.want.length ? `(${m.hit.length}/${m.want.length})` : ''} | ${mark(a.ok)} | ${got.join('<br>').replace(/\|/g, '／') || '—'} |`);
  }
  // どちらかで拾えたら「拾えた」。期待が無い(測る物が無い)件は API だけで決める
  const caught = (r) => r.m.ok === true || r.a.ok === true;
  const byGame = {};
  for (const r of rows) { const g = byGame[r.c.game] || (byGame[r.c.game] = { n: 0, caught: 0, m: 0, a: 0 }); g.n++; if (caught(r)) g.caught++; if (r.m.ok) g.m++; if (r.a.ok) g.a++; }
  md.push('', '| ゲーム | 件 | 拾えた | 測るで | API で |', '|---|---|---|---|---|');
  for (const [g, v] of Object.entries(byGame)) md.push(`| ${g} | ${v.n} | ${v.caught} | ${v.m} | ${v.a} |`);
  const tot = rows.length, tc = rows.filter(caught).length;
  md.push('', `全体: ${tot}件中 ${tc}件を拾えた(測る ${rows.filter((r) => r.m.ok).length}・API ${rows.filter((r) => r.a.ok).length})${api ? ` / API の額 $${api.usd}` : '(API はまだ)'}`);
  fs.writeFileSync(path.join(OUT, 'calibration.md'), md.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'calibration.json'), JSON.stringify(rows.map(({ c, m, a }) => ({ id: c.id, game: c.game, measure: { ok: m.ok, hit: m.hit, want: m.want, kinds: Object.fromEntries(m.kinds) }, api: { ok: a.ok, n: a.n, hits: a.hits.map((h) => h.what) } })), null, 1));
  console.log(md.join('\n'));
};

(async () => {
  if (has('--shoot')) { console.log(`撮る: ${CASES.length}件`); for (const c of CASES) shoot(c); }
  if (has('--api') || has('--fetch')) {
    const gw = require('../analysis/gateway-client');
    const AD = path.join(OUT, 'api');
    fs.mkdirSync(AD, { recursive: true });
    if ((has('--send') || has('--fetch')) && gw.ensureProxyEnv()) return;
    if (has('--fetch')) {
      const b = JSON.parse(fs.readFileSync(path.join(AD, 'batch.json'), 'utf8'));
      const r = await gw.send({ action: 'batch_get', batch_id: b.batch_id });
      if (r.status !== 200 || !r.json?.ok) { console.log(`受け取れない: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); process.exit(1); }
      if (!r.json.results) { console.log(`まだ: ${r.json.processing_status} ${JSON.stringify(r.json.request_counts || {})}`); process.exit(3); }
      const byCase = {}, bad = [];
      for (const x of r.json.results) { const l = x.type === 'succeeded' ? parseJson(x.text) : null; if (!l) bad.push(x.custom_id); else byCase[x.custom_id] = l; }
      fs.writeFileSync(path.join(AD, 'api-findings.json'), JSON.stringify({ usd: Math.round((Number(r.json.usd) || 0) * 10000) / 10000, byCase, unreadable: bad }, null, 1));
      console.log(`受け取った(額 $${r.json.usd}${bad.length ? `・読めない ${bad.join(',')}` : ''})`);
    } else {
      const reqs = buildRequests();
      let usd = 0;
      for (const q of reqs) { const e = await gw.estimate(q.request, { batch: true }); if (!e.ok) { console.log(`${q.custom_id} の形が断られる: ${e.error}`); process.exit(1); } usd += e.usd_est; }
      console.log(`頼み ${reqs.length}本 / 多めの見積り $${usd.toFixed(2)}(バッチ・半額)`);
      if (usd > Number(opt('--max-usd', '3'))) { console.log('見積りが上限を超えるので送らない'); process.exit(2); }
      if (!has('--send')) return;
      const r = await gw.send({ action: 'batch_submit', kind: 'ui-check', label: 'president-eye-calibrate', requests: reqs });
      if (r.status !== 200 || !r.json?.ok) { console.log(`断られた・失敗: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); process.exit(1); }
      fs.writeFileSync(path.join(AD, 'batch.json'), JSON.stringify({ batch_id: r.json.batch_id, usd_est: r.json.usd_est, ids: reqs.map((q) => q.custom_id) }, null, 1));
      console.log(`バッチを頼んだ(見積り $${r.json.usd_est})。--fetch で受け取る`);
      return;
    }
  }
  report();
})().catch((e) => { console.error(e.message); process.exit(1); });
