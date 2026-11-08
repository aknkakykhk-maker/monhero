#!/usr/bin/env node
// 「ビートPで買う曲」を実際のブラウザで買って、遊べるようになるまでを通す(2026-11-08)。
//
//   node tools/boot/rhythm-song-purchase-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、縦・横・🔄横で、鍵の曲・買う確認・買ったあと・交換所の棚を撮る
//
// 本物の表(RHYTHM_PAID_SONGS)は空でも確かめられるよう、配る data/rhythm-event.js をこの検査の中だけ書き換えて、
// 「ヒューマノイド」を 500 ビートPの買う曲にする(リポジトリのファイルは変えない)。
//   ① 曲えらびで、その曲の行に「🔒 500P」、決定ボタンが「500 ビートPで買う」になる
//   ② ビートPが足りないと「買う」を押せない(減らない)
//   ③ 足りれば買える。「買う」を素早く2回押してもビートPは 500 だけ減る。持っている曲に1つ入り、決定ボタンに戻る
//   ④ 読み込み直しても持ったまま(鍵は戻らない)・ほかの曲は最初から鍵なし・画面のエラーが無い
//   ⑤ ビートP交換所に「新曲」の棚があり、買った曲は「所持済み」
const http = require('http'), path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, 'quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8961;
const SHOT_DIR = process.env.SHOT_DIR || '';
const SONG = 'humanoid';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.PNG': 'image/png' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const eventSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-event.js'), 'utf8')
  .replace(/const RHYTHM_PAID_SONGS = Object\.freeze\(\{/, `const RHYTHM_PAID_SONGS = Object.freeze({\n  ${SONG}: {},`);

(async () => {
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async (vp, points, rot = false) => {
    const page = await browser.newPage({ viewport: vp });
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    await page.route('**/data/rhythm-event.js*', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: eventSrc }));
    await page.addInitScript(({ points }) => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true);
      put('mh_rhythm_event_points_v1', points);
    }, { points });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForTimeout(2500);
    return page;
  };
  const clickText = (page, re) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && rx.test((e.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, re);
  const tap = (page, sel) => page.evaluate((q) => { const b = document.querySelector(q); if (b && b.offsetParent && !b.disabled) { b.click(); return true; } return false; }, sel);
  const toSongSelect = async (page) => {
    for (let i = 0; i < 12; i++) { await clickText(page, '^スキップ$|^受け取る$|^閉じる$|^OK$'); await page.waitForTimeout(300); }
    await clickText(page, 'モンヒロビート');
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await tap(page, '[data-rhythm-mode-solo]');
    await page.waitForSelector('[data-rhythm-demo-start],[data-rhythm-song-buy]', { timeout: 30000 });
    // ヒューマノイドの行を押す
    await page.evaluate(() => { const b = [...document.querySelectorAll('li button')].find((e) => /ヒューマノイド/.test(e.innerText || '')); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } });
    await page.waitForTimeout(800);
  };
  const store = (page, k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }, k);
  const shot = async (page, name) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) }); } };
  try {
    // ② 足りない
    let page = await open({ width: 390, height: 844 }, 300);
    await toSongSelect(page);
    check('曲えらび: 買う曲の行に「🔒 500P」が出る', await page.evaluate((id) => { const x = document.querySelector(`[data-rhythm-song-locked="${id}"]`); return !!x && /🔒\s*500P/.test(x.innerText); }, SONG));
    check('曲えらび: 決定ボタンが「500 ビートPで買う」になる', await page.evaluate((id) => { const b = document.querySelector(`[data-rhythm-song-buy="${id}"]`); return !!b && /500 ビートPで買う/.test(b.innerText.replace(/\s+/g, ' ')) && !document.querySelector('[data-rhythm-demo-start]'); }, SONG));
    await tap(page, '[data-rhythm-song-buy]'); await page.waitForTimeout(500);
    check('ビートPが足りないと「買う」を押せない', await page.evaluate(() => { const ok = document.querySelector('[data-rhythm-song-buy-ok]'); return !!ok && ok.disabled && /足りません/.test((document.querySelector('[data-rhythm-song-buy-error]') || {}).innerText || ''); }));
    check('足りないときは何も減らない', (await store(page, 'mh_rhythm_event_points_v1')) === 300 && !(await store(page, 'mh_rhythm_owned_songs_v1')));
    await page.close();

    // ③ 買える
    page = await open({ width: 390, height: 844 }, 1200);
    await toSongSelect(page);
    await shot(page, 'locked-tate');
    await tap(page, '[data-rhythm-song-buy]'); await page.waitForTimeout(500);
    await shot(page, 'confirm-tate');
    check('買う確認に値段と持っているビートPが出る', await page.evaluate(() => /500P/.test(document.querySelector('[data-rhythm-song-buy-price]')?.innerText || '') && /1,200P/.test(document.querySelector('[data-rhythm-song-buy-have]')?.innerText || '')));
    await page.evaluate(() => { const b = document.querySelector('[data-rhythm-song-buy-ok]'); b.click(); b.click(); });
    await page.waitForFunction(() => !document.querySelector('[data-rhythm-song-buy-confirm]'), undefined, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    check('「買う」を素早く2回押しても、ビートPは 500 だけ減る', (await store(page, 'mh_rhythm_event_points_v1')) === 700, String(await store(page, 'mh_rhythm_event_points_v1')));
    check('持っている曲に1つ入る', JSON.stringify(await store(page, 'mh_rhythm_owned_songs_v1')) === JSON.stringify([SONG]), JSON.stringify(await store(page, 'mh_rhythm_owned_songs_v1')));
    check('買ったあとは決定ボタンに戻る(鍵の札も消える)', await page.evaluate((id) => !!document.querySelector('[data-rhythm-demo-start]') && !document.querySelector('[data-rhythm-song-buy]') && !document.querySelector(`[data-rhythm-song-locked="${id}"]`), SONG));
    check('買ったあと、曲えらびの上の所持ビートPも減る', await page.evaluate(() => /700/.test(document.querySelector('[data-rhythm-beat-point-balance]')?.innerText || '')), await page.evaluate(() => document.querySelector('[data-rhythm-beat-point-balance]')?.innerText || '(無し)'));
    await shot(page, 'bought-tate');
    // ④ 読み込み直し
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await toSongSelect(page);
    check('読み込み直しても持ったまま(鍵は戻らない)', await page.evaluate(() => !!document.querySelector('[data-rhythm-demo-start]') && !document.querySelector('[data-rhythm-song-buy]')));
    check('ほかの曲は鍵なし(買う曲は1曲だけ)', await page.evaluate(() => document.querySelectorAll('[data-rhythm-song-locked]').length === 0));
    // ⑤ 交換所の棚
    await tap(page, '[data-rhythm-song-select-back]'); await page.waitForTimeout(1200);
    await page.close();
    page = await open({ width: 390, height: 844 }, 900);
    await page.evaluate((id) => localStorage.setItem('mh_rhythm_owned_songs_v1', JSON.stringify([])), SONG);
    for (let i = 0; i < 12; i++) { await clickText(page, '^スキップ$|^受け取る$|^閉じる$|^OK$'); await page.waitForTimeout(300); }
    await clickText(page, 'マーケット'); await page.waitForTimeout(1500);
    await tap(page, '[data-market-section="event"]'); await page.waitForTimeout(1200);
    const hasTab = await clickText(page, '^新曲');
    await page.waitForTimeout(900);
    check('ビートP交換所に「新曲」の棚があり、買う曲が並ぶ', hasTab && await page.evaluate((id) => !!document.querySelector(`[data-event-point-song="${id}"]`), SONG));
    await shot(page, 'shop-tate');
    // 棚から買う(曲えらびと同じ取引)
    await page.evaluate((id) => { const card = document.querySelector(`[data-event-point-song="${id}"]`); const b = card && [...card.querySelectorAll('button')].find((x) => /500/.test(x.innerText || '')); if (b) b.click(); }, SONG);
    await page.waitForTimeout(700);
    await shot(page, 'shop-confirm-tate');
    const confirmed = await clickText(page, '交換|購入|買う');
    await page.waitForTimeout(1500);
    check('交換所の棚からも買える(ビートPが 500 減り、持っている曲に入る)', confirmed && (await store(page, 'mh_rhythm_event_points_v1')) === 400 && JSON.stringify(await store(page, 'mh_rhythm_owned_songs_v1')) === JSON.stringify([SONG]),
      JSON.stringify({ confirmed, p: await store(page, 'mh_rhythm_event_points_v1'), s: await store(page, 'mh_rhythm_owned_songs_v1') }));
    check('買った曲は棚で「所持済み」', await page.evaluate((id) => /所持済み/.test(document.querySelector(`[data-event-point-song="${id}"]`)?.innerText || ''), SONG));
    await page.close();

    // 横・🔄横の写真
    if (SHOT_DIR) {
      for (const [vp, name, rot] of [[{ width: 844, height: 390 }, 'yoko', false], [{ width: 390, height: 844 }, 'rot', true]]) {
        page = await open(vp, 1200);
        if (rot) await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} });
        await toSongSelect(page);
        await shot(page, `locked-${name}`);
        await tap(page, '[data-rhythm-song-buy]'); await page.waitForTimeout(500);
        await shot(page, `confirm-${name}`);
        await page.close();
      }
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('最後まで通る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    await browser.close(); server.close();
  }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
