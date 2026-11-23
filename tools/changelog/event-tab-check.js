#!/usr/bin/env node
// 更新履歴の「イベント」タブを実ブラウザで確かめ、止め絵を撮る(2026-11-23 r1119-113)。
//
//   node tools/changelog/event-tab-check.js            確かめるだけ
//   SHOTS=<出力先フォルダ> node tools/changelog/event-tab-check.js   止め絵も撮る
//
// 社長「(固定のイベントの札で)更新内容が見づらくなる」→「イベントのタブへ」。見張るのは:
//   ① 上のタブが 更新情報・イベント・不具合情報 の3つで、どれも切れず(はみ出さず)高さ44px以上
//   ② 「更新情報」タブに開催中の札が出ず、一番上が日付ごとの更新内容
//   ③ 「イベント」タブに札が並び、開催中が上・開催予定が下
//   ④ まだ見ていない札があるあいだはイベントタブに「!」が付き、イベントタブを見たら消える(開き直しても消えたまま)
//   姿勢: 縦 390×844 / 横 844×390 / 小さい横 568×320 / 切り欠きあり(縦の上47・横の左右47)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'), PORT = 8961;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : '';
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4' };
const serve = () => new Promise(r => { const s = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const POSTURES = [
  ['縦', 390, 844, { top: 0, bottom: 0, left: 0, right: 0 }],
  ['横', 844, 390, { top: 0, bottom: 0, left: 0, right: 0 }],
  ['小さい横', 568, 320, { top: 0, bottom: 0, left: 0, right: 0 }],
  ['切り欠き縦', 390, 844, { top: 47, bottom: 34, left: 0, right: 0 }],
  ['切り欠き横', 844, 390, { top: 0, bottom: 21, left: 47, right: 47 }],
];
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [name, w, h, inset] of POSTURES) {
      if (process.env.ONLY && process.env.ONLY !== name) continue;
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
      await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.waitForTimeout(800);
      const openLog = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /更新履歴|お知らせ/.test(x.innerText || x.getAttribute("aria-label") || "")); if (!b) return false; b.click(); return true; });
      ok(`[${name}] 更新履歴を開ける`, await openLog());
      await page.waitForSelector('.mh-changelog-tabs button', { timeout: 15000 });
      await page.waitForTimeout(300);
      const tabs = await page.evaluate(() => [...document.querySelectorAll('.mh-changelog-tabs button')].map(b => {
        const r = b.getBoundingClientRect();
        return { label: (b.childNodes[0]?.textContent || '').trim(), h: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          clipped: b.scrollWidth > b.clientWidth + 1, badge: !!b.querySelector('.mh-unread-badge') };
      }));
      ok(`[${name}] ① タブは 更新情報・イベント・不具合情報 の3つ`, tabs.map(t => t.label).join('/') === '更新情報/イベント/不具合情報', tabs.map(t => t.label).join('/'));
      ok(`[${name}] ① タブの高さ44px以上`, tabs.every(t => t.h >= 44), tabs.map(t => Math.round(t.h)).join(','));
      ok(`[${name}] ① タブの文字が切れていない`, tabs.every(t => !t.clipped));
      ok(`[${name}] ① タブが画面と切り欠きの内側`, tabs.every(t => t.left >= inset.left - 0.5 && t.right <= w - inset.right + 0.5 && t.top >= inset.top - 0.5 && t.bottom <= h - inset.bottom + 0.5));
      const top = await page.evaluate(() => { const list = document.querySelector('[data-changelog-list]'); const first = list?.firstElementChild;
        return { pinned: list ? list.querySelectorAll('[data-changelog-pinned]').length : -1, first: first ? (first.matches('h4[data-changelog-day]') ? 'day' : first.tagName) : '' }; });
      ok(`[${name}] ② 更新情報タブに札が出ない`, top.pinned === 0, `${top.pinned}件`);
      ok(`[${name}] ② 更新情報タブの一番上は日付ごとの更新内容`, top.first === 'day', top.first);
      const eventTab = tabs.find(t => t.label === 'イベント');
      const hadBadge = !!eventTab?.badge;
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-1-update.png`) });
      await page.evaluate(() => [...document.querySelectorAll('.mh-changelog-tabs button')][1].click());
      await page.waitForTimeout(400);
      const ev = await page.evaluate(() => [...document.querySelectorAll('[data-changelog-list] [data-changelog-pinned-badge]')].map(b => b.textContent.trim()));
      const firstUpcoming = ev.findIndex(t => /開催予定/.test(t));
      const lastLive = ev.map(t => /開催中/.test(t)).lastIndexOf(true);
      const empty = await page.evaluate(() => !!document.querySelector('[data-changelog-event-empty]'));
      ok(`[${name}] ③ イベントタブに札が並ぶ(無いときは「ありません」)`, ev.length > 0 || empty, ev.join(' / '));
      ok(`[${name}] ③ 開催中が上・開催予定が下`, firstUpcoming < 0 || lastLive < firstUpcoming, ev.join(' / '));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-2-event.png`) });
      if (ev.length > 0) {
        ok(`[${name}] ④ まだ見ていない札があるときはイベントタブに「!」`, hadBadge);
        // 閉じてから開き直す
        await page.evaluate(() => { const b = [...document.querySelectorAll('.mh-title-dialog--changelog button')].find(x => /閉じる/.test(x.innerText || '')); b && b.click(); });
        await page.waitForTimeout(400);
        await openLog();
        await page.waitForSelector('.mh-changelog-tabs button', { timeout: 15000 });
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => !![...document.querySelectorAll('.mh-changelog-tabs button')][1]?.querySelector('.mh-unread-badge'));
        ok(`[${name}] ④ イベントタブを見たら「!」が消える(開き直しても)`, !after);
      }
      await page.close();
    }
  } catch (error) {
    ok('確認を最後まで進められる', false, String(error).split('\n')[0]);
  } finally { await browser.close(); server.close(); }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
