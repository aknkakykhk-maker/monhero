#!/usr/bin/env node
// モンサクの技の熟練の表示(2026-11-15 社長 r1115-082「技の熟練度ってそもそもどこにあるの？」)を本物のブラウザで確かめる。
//   node tools/success/msx-mastery-detail-check.js            確かめる
//   SHOT=<フォルダ> node tools/success/msx-mastery-detail-check.js   縦390 の止め絵(熟練 0・途中・100)も置く
// ① モンスターの詳細で覚えた技を押すと、右の欄に「熟練 ◯/100」と効き目(威力+◯%・命中+◯%。芯の techBoostOf と同じ数)が出る。熟練0は「まだ無し」
// ② 技の升目のアイコンに小さな熟練のゲージ(覚えた技だけ・幅=熟練%)。覚えていない技には付かない
// ③ 熟練を渡さない詳細(ベースモンを選ぶ画面など)には出ない
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = Number(process.env.SHOT_PORT) || 8979;
const SHOT = process.env.SHOT || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml' };
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => typeof MsxMonDetail === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
    // 芯(SUC)を読み込んでから、詳細だけを描く(見た目は本物の MSX_CSS)
    const render = (m, withMastery = true) => page.evaluate(async ({ m, withMastery }) => {
      const L = await msxLoad(); const SUC = L && L.SUC; window.__SUC = SUC;
      if (!document.getElementById('msx-ms-css')) { const st = document.createElement('style'); st.id = 'msx-ms-css'; st.textContent = MSX_CSS + (typeof MSX_R3_CSS === 'string' ? MSX_R3_CSS : ''); document.head.appendChild(st); }
      if (window.__mroot) { window.__mroot.unmount(); window.__mroot = null; }
      const el = document.getElementById('msx-ms') || Object.assign(document.createElement('div'), { id: 'msx-ms', className: 'msx' }); el.style.cssText = 'position:fixed;inset:0;z-index:99999'; document.body.appendChild(el);
      const known = SUC.techsOf('Mocchi').slice(0, 4).map((t) => t.id);
      window.__known = known;
      window.__mroot = ReactDOM.createRoot(el);
      window.__mroot.render(React.createElement(MsxMonDetail, { species: 'Mocchi', name: 'モッチー', st: { life: 300, pow: 300, wise: 300, hit: 300, eva: 300, tough: 300 }, apt: ['C', 'C', 'C', 'C', 'C', 'C'], type: 2, peak: '', grades: ['C', 'C', 'C', 'C'], known, ...(withMastery ? { mastery: Object.fromEntries(known.map((id) => [id, m])) } : {}), power: 5000, rank: 'C', SUC, onClose() {} }));
      await new Promise((r) => setTimeout(r, 300));
      const b = document.querySelector(`[data-msx-tech="${known[0]}"]`); if (b) b.click(); await new Promise((r) => setTimeout(r, 200));
      const row = document.querySelector('[data-msx-detail-ms]'); const eff = [...document.querySelectorAll('.msx-md-kv')].find((x) => /熟練の効き目/.test(x.innerText)) || null;
      const g = document.querySelector(`[data-msx-tech="${known[0]}"] .tg-ms i`);
      const notGot = [...document.querySelectorAll('[data-msx-tech]')].filter((x) => !known.includes(x.getAttribute('data-msx-tech')));
      return { row: row ? row.innerText.replace(/\s+/g, ' ') : null, eff: eff ? eff.innerText.replace(/\s+/g, ' ') : null, gw: g ? g.style.width : null,
        gaugeN: document.querySelectorAll('.tg-ms').length, notGotGauge: notGot.filter((x) => x.querySelector('.tg-ms')).length,
        boost: (SUC.techBoostOf({ techs: [known[0]], mastery: { [known[0]]: m } })[known[0]] || null) };
    }, { m, withMastery });
    for (const m of [0, 40, 100]) {
      const r = await render(m);
      check(`熟練 ${m}: 右の欄に「熟練 ${m}/100」`, r.row && r.row.includes(`熟練`) && r.row.includes(`${m}`) && r.row.includes('/100'), String(r.row));
      const want = r.boost ? `威力+${Math.round(r.boost.pow * 1000) / 10}%・命中+${Math.round(r.boost.hit * 1000) / 10}%` : 'まだ無し';
      check(`熟練 ${m}: 効き目が芯と同じ(${want})`, r.eff && r.eff.replace(/[\s・]/g, '').includes(want.replace(/・/g, '')), String(r.eff));
      check(`熟練 ${m}: 升のゲージの幅 ${m}%`, r.gw === `${m}%`, String(r.gw));
      check(`熟練 ${m}: ゲージは覚えた4技だけ(覚えていない技には付かない)`, r.gaugeN === 4 && r.notGotGauge === 0, `${r.gaugeN}・${r.notGotGauge}`);
      if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `detail-mastery-${m}.png`) }); }
    }
    const r0 = await render(40, false);
    check('熟練を渡さない詳細には出ない', r0.row === null && r0.gaugeN === 0, `${r0.row}・${r0.gaugeN}`);
    check('ページのエラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) { console.log('NG:', e.message); failed++; }
  await browser.close(); server.close();
  if (failed) { console.log(`NG ${failed}件`); process.exit(1); }
  console.log('すべてOK');
})();
