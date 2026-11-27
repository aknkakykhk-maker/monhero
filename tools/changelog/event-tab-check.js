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
//   ④ まだ開いていない札に「NEW」が付き、イベントタブの印の数と必ず合う。札を開いたらその札の「NEW」が消え、印が1つ減る(開き直しても)。
//      タブを見ただけでは消えない(2026-11-27 r1126-068 社長「イベントにびっくりついてるけどどれかわからない」)
//   ⑤ 札の題は1行。期間のある札は期間と残り(「あと◯日」「開幕まであと◯分」)を出す。開催中は終わりが近い順(r1126-068)
//   姿勢: 縦 390×844 / 横 844×390 / 小さい横 568×320 / 切り欠きあり(縦の上47・横の左右47)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'), PORT = 8961;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : '';
// NOW=2026-11-28T09:55:00+09:00 のように渡すと、その時刻の画面で確かめる(Date.now をずらす)
const FAKE_NOW = process.env.NOW ? Date.parse(process.env.NOW) : NaN;
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
  catch { try { ({ chromium } = require('playwright')); } catch {} }
  if (!chromium) { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [name, w, h, inset] of POSTURES) {
      if (process.env.ONLY && process.env.ONLY !== name) continue;
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
      if (Number.isFinite(FAKE_NOW)) await page.addInitScript((now) => { const real = Date.now.bind(Date); const off = now - real(); Date.now = () => real() + off; }, FAKE_NOW);
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
      const cards = () => page.evaluate(() => {
        const tab = [...document.querySelectorAll('.mh-changelog-tabs button')][1]?.querySelector('[data-changelog-event-unread]');
        return { tabCount: tab ? Number(tab.getAttribute('data-changelog-event-unread')) : 0, tabText: tab ? tab.textContent.trim() : '',
          list: [...document.querySelectorAll('[data-changelog-list] [data-changelog-pinned]')].map(d => {
            const t = d.querySelector('[data-changelog-pinned-title]');
            return { title: t?.textContent.trim() || '', oneLine: t ? t.scrollHeight <= t.clientHeight + 2 && getComputedStyle(t).whiteSpace === 'nowrap' : false,
              isNew: d.getAttribute('data-changelog-event-new') === '1', mark: !!d.querySelector('[data-changelog-event-new-mark]'),
              period: d.querySelector('[data-changelog-event-period]')?.textContent.trim() || '', remain: d.querySelector('[data-changelog-event-remain]')?.textContent.trim() || '',
              banner: !!d.querySelector('[data-changelog-pinned-banner]') };
          }) };
      });
      if (ev.length > 0) {
        const c0 = await cards();
        const marks = c0.list.filter(x => x.mark).length;
        console.log(`  [${name}] 札: ${c0.list.map(x => `${x.isNew ? '[NEW]' : ''}${x.title}｜${x.period}｜${x.remain}`).join(' / ')}`);
        ok(`[${name}] ④ タブの印の数と札の「NEW」の数が合う`, c0.tabCount === marks && (marks === 0 || c0.tabText === String(marks)), `タブ${c0.tabCount}・札${marks}`);
        ok(`[${name}] ④ まだ開いていない札があるときはイベントタブに印`, hadBadge === (marks > 0));
        ok(`[${name}] ⑤ 札の題は1行`, c0.list.every(x => x.oneLine), c0.list.filter(x => !x.oneLine).map(x => x.title).join(' / '));
        ok(`[${name}] ⑤ 題に「がはじまりました」「を開催します」を出さない`, c0.list.every(x => !/(はじまりました|始まりました|開催します)/.test(x.title)));
        ok(`[${name}] ⑤ 期間の書式「11/28(土) 10:00 〜 12/31(木) 3:59」`, c0.list.every(x => !x.period || /^\d{1,2}\/\d{1,2}\(.\) \d{1,2}:\d{2} 〜 \d{1,2}\/\d{1,2}\(.\) \d{1,2}:\d{2}$/.test(x.period)));
        ok(`[${name}] ⑤ 残りは「あと◯日/時間/分」「開幕まであと◯…」`, c0.list.every(x => !x.remain || /^(開幕まで)?あと\d+(日|時間|分)$/.test(x.remain)));
        // 1枚目を開く → その札の NEW が消え、タブの数が1つ減る
        if (c0.list[0]?.isNew) {
          await page.evaluate(() => { const s = document.querySelector('[data-changelog-list] [data-changelog-pinned] summary'); s && s.click(); });
          await page.waitForTimeout(400);
          const c1 = await cards();
          ok(`[${name}] ④ 札を開いたらその札の「NEW」が消え、タブの数が1つ減る`, !c1.list[0].isNew && c1.tabCount === c0.tabCount - 1 && c1.list.filter(x => x.mark).length === c1.tabCount, `${c0.tabCount}→${c1.tabCount}`);
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-3-opened.png`) });
        }
        await page.evaluate(() => { const b = [...document.querySelectorAll('.mh-title-dialog--changelog button')].find(x => /閉じる/.test(x.innerText || '')); b && b.click(); });
        await page.waitForTimeout(400);
        await openLog();
        await page.waitForSelector('.mh-changelog-tabs button', { timeout: 15000 });
        await page.waitForTimeout(300);
        await page.evaluate(() => [...document.querySelectorAll('.mh-changelog-tabs button')][1].click());
        await page.waitForTimeout(400);
        const c2 = await cards();
        ok(`[${name}] ④ 開き直しても、開いた札は既読のまま・ほかは未読のまま`, c2.tabCount === Math.max(0, c0.tabCount - (c0.list[0]?.isNew ? 1 : 0)) && c2.list.filter(x => x.mark).length === c2.tabCount, `${c2.tabCount}`);
      }
      await page.close();
    }
  } catch (error) {
    ok('確認を最後まで進められる', false, String(error).split('\n')[0]);
  } finally { await browser.close(); server.close(); }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
