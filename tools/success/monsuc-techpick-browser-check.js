// モンヒロサクセスの「被った升で覚える技を選ぶ」を本物のブラウザで確かめる(2026-11-14 社長 r1114-128・131)
//   育てる子(スネグーラチカ)の詳細 → 被った升の ⇄ → 選ぶ窓 → 選ぶ。新しいキー mh_monsuc_techpick_v1 に入り、開き直しても升に出る。
//   既存のキー(mh_monsuc_run_v1・mh_monsuc_box_v1)は、選んだだけでは書き換わらない
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
const PORT = Number(process.env.SHOT_PORT) || 8977;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml' };
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    await page.addInitScript(() => { try { localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Snegurochka'])); localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
    const open = async () => {
      await page.evaluate(() => { if (window.__msxRoot) { window.__msxRoot.unmount(); window.__msxRoot = null; } const el = document.getElementById('msx-shot') || Object.assign(document.createElement('div'), { id: 'msx-shot' }); document.body.appendChild(el); window.__msxRoot = ReactDOM.createRoot(el); window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false })); });
      await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
      const go = async (fn, arg) => { const ok = await page.evaluate(fn, arg); await page.waitForTimeout(350); return ok; };
      await go(() => { const b = [...document.querySelectorAll('.msx button')].find((x) => /新しく育成を(?:始|はじ)める/.test(x.innerText)); if (b) b.click(); return !!b; });
      await go(() => { const b = [...document.querySelectorAll('.msx button')].find((x) => /▶$/.test(x.innerText)); if (b) b.click(); return !!b; });
      await go(() => { const d = [...document.querySelectorAll('.v-grid6 button')].find((b) => { const i = b.querySelector('img'); return i && i.alt === msxMonName('Snegurochka'); }); if (d) d.click(); return !!d; });
      return go(() => { const d = document.querySelector('[data-msx-detail-open]'); if (d) d.click(); return !!d; });
    };
    check('育てる子の詳細が開く', await open());
    const cellOf = () => page.evaluate(() => { const c = document.querySelector('[data-msx-cell="2-1"]'); return c ? c.getAttribute('data-msx-tech') : null; });
    check('被った升の既定は並びの1つ目(プレゼントキッス)', (await cellOf()) === 'sk-0742', String(await cellOf()));
    check('被った升に ⇄ が付く', await page.evaluate(() => !!document.querySelector('[data-msx-alt="2-1"]')));
    await page.evaluate(() => document.querySelector('[data-msx-alt="2-1"]').click()); await page.waitForTimeout(300);
    check('選ぶ窓が開き、候補が2つ並ぶ', await page.evaluate(() => document.querySelectorAll('[data-msx-techpick-opt]').length === 2));
    const runBefore = await page.evaluate(() => localStorage.getItem('mh_monsuc_run_v1')); const boxBefore = await page.evaluate(() => localStorage.getItem('mh_monsuc_box_v1'));
    await page.evaluate(() => document.querySelector('[data-msx-techpick-opt="sk-0480"]').click()); await page.waitForTimeout(500);
    check('選ぶと窓が閉じて升の技が替わる', (await cellOf()) === 'sk-0480', String(await cellOf()));
    const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_monsuc_techpick_v1')); } catch (e) { return null; } });
    check('新しいキー mh_monsuc_techpick_v1 に入る', !!saved && saved.v === 1 && saved.base && saved.base.Snegurochka && saved.base.Snegurochka['2-1'] === 'sk-0480', JSON.stringify(saved));
    check('既存のキー(育成・マスモンボックス)は書き換わらない', runBefore === (await page.evaluate(() => localStorage.getItem('mh_monsuc_run_v1'))) && boxBefore === (await page.evaluate(() => localStorage.getItem('mh_monsuc_box_v1'))));
    await open(); // 開き直し
    check('開き直しても選んだ技が升に出る', (await cellOf()) === 'sk-0480', String(await cellOf()));
    // 壊れた値でも落ちない(既定の1つ目に戻る)
    await page.evaluate(() => localStorage.setItem('mh_monsuc_techpick_v1', JSON.stringify({ v: 1, base: { Snegurochka: { '2-1': 'zzz', '9-9': 'q' } }, mon: 5 })));
    await open(); check('壊れた保存でも既定の1つ目で開く', (await cellOf()) === 'sk-0742', String(await cellOf()));
    check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
  console.log('\nすべてOK');
})();
