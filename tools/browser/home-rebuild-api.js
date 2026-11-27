#!/usr/bin/env node
// HOME の作り直し(r1126-073)を分析の API で点検する(Batch・claude-opus-5-5・effort xhigh・出力上限 32000)。
//   1) node tools/browser/home-rebuild-api.js --shots <止め絵の置き場> [--send]   … 見積り(--send で頼む)
//   2) node tools/browser/home-rebuild-api.js --fetch                              … 結果を受け取って api-answer.md へ書く
// 送る物: docs/progress/home-rebuild-2026-11/api-system.md・api-prompt.md と、止め絵(下の PICK の順・20枚まで)
// 合言葉は環境変数 ANALYSIS_GATEWAY_TOKEN(クラウドでは proxy)。値はどこにも書かない
const fs = require('fs'), path = require('path');
const gw = require(path.resolve(__dirname, '..', 'analysis', 'gateway-client.js'));
const ROOT = path.resolve(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs/progress/home-rebuild-2026-11');
const MAX_USD = 20;
const args = process.argv.slice(2);
const opt = (n, d = '') => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
// 選ぶ止め絵(20枚まで)。時刻 × 大きさ × 形
const PICK = [
  't1-1127-1907-phone-tate-fold', 't2-1128-1005-phone-tate-fold', 't2-1128-1005-phone-tate-menu', 't2-1128-1005-phone-tate-peer', 't2-1128-1005-phone-tate-say',
  't3-1130-0005-phone-tate-fold', 't1-1127-1907-phone-yoko-fold', 't2-1128-1005-phone-yoko-fold', 't2-1128-1005-phone-yoko-menu', 't3-1130-0005-phone-yoko-fold',
  't2-1128-1005-tablet-tate-fold', 't2-1128-1005-tablet-tate-menu', 't2-1128-1005-tablet-tate-say', 't3-1130-0005-tablet-tate-fold',
  't2-1128-1005-tablet-yoko-fold', 't2-1128-1005-tablet-yoko-menu', 't2-1128-1005-tablet-yoko-peer', 't3-1130-0005-tablet-yoko-fold',
  't1-1127-1907-tablet-yoko-fold', 't2-1128-1005-phone-yoko-peer',
];
(async () => {
  gw.ensureProxyEnv && gw.ensureProxyEnv();
  if (args.includes('--fetch')) {
    const b = JSON.parse(fs.readFileSync(path.join(DOC, 'api-batch.json'), 'utf8'));
    const r = await gw.send({ action: 'batch_get', batch_id: b.batch_id });
    fs.writeFileSync(path.join(DOC, 'api-batch-result.json'), JSON.stringify(r.json, null, 1));
    const res = (r.json && r.json.results) || [];
    if (!res.length) { console.log('まだ返っていない', JSON.stringify(r.json).slice(0, 300)); return; }
    const text = res.map((x) => (x.text || (x.message && x.message.content && x.message.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')) || JSON.stringify(x).slice(0, 2000))).join('\n\n');
    fs.writeFileSync(path.join(DOC, 'api-answer.md'), text + '\n');
    console.log('受け取った', path.join(DOC, 'api-answer.md'), '使った額', JSON.stringify(r.json.usage || r.json.usd || r.json.cost || '').slice(0, 200));
    return;
  }
  const dir = opt('--shots');
  if (!dir || !fs.existsSync(dir)) { console.log('--shots <止め絵の置き場> が要る'); process.exit(1); }
  const system = fs.readFileSync(path.join(DOC, 'api-system.md'), 'utf8');
  const prompt = fs.readFileSync(path.join(DOC, 'api-prompt.md'), 'utf8');
  const files = PICK.map((n) => path.join(dir, `${n}.jpg`)).filter((f) => fs.existsSync(f)).slice(0, 20);
  const content = [{ type: 'text', text: prompt }];
  files.forEach((f, i) => { content.push({ type: 'text', text: `${i + 1}枚目: ${path.basename(f, '.jpg')}` }); content.push({ type: 'image', media_type: 'image/jpeg', data: fs.readFileSync(f).toString('base64') }); });
  const request = { system, cache_system: false, messages: [{ role: 'user', content }], max_tokens: 32000, effort: 'xhigh' };
  const e = await gw.estimate(request, { batch: true });
  if (!e.ok) { console.log('入り口に断られる形', e.error); process.exit(1); }
  console.log(`止め絵 ${files.length}枚 / 多めの見積り $${e.usd_est}(上限 $${MAX_USD})`);
  if (e.usd_est > MAX_USD) { console.log('上限を超えるので送らない'); process.exit(2); }
  if (!args.includes('--send')) return;
  const r = await gw.send({ action: 'batch_submit', kind: 'ui-check', label: 'home-rebuild-r1126-073', requests: [{ custom_id: 'home_rebuild', request }] });
  if (r.status !== 200 || !r.json || !r.json.ok) { console.log('断られた・失敗', r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); }
  fs.writeFileSync(path.join(DOC, 'api-batch.json'), JSON.stringify({ batch_id: r.json.batch_id, usd_est: r.json.usd_est, at: new Date().toISOString() }, null, 1));
  console.log('頼んだ', r.json.batch_id, `見積り $${r.json.usd_est}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
