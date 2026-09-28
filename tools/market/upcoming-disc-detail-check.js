// 近日公開予定の新モンスターの円盤石を、ほかのショップと同じように見られるかを実ブラウザで確かめる(2026-09-28)。
//
//   node tools/market/upcoming-disc-detail-check.js
//
// 2026-09-28 ユーザー指摘「ビートポイントでモンスターの円盤石を押してもアップにならない」「詳細ボタンがない」
// 「他のショップとあわせて」。ビートP交換所の予告カードだけ手作りで、絵を押しても大きくならず、詳細も無かった。
// ダイヤショップの近日追加の円盤石も、詳細は「近日追加」では出さない作りだった。
//   ① ビートP交換所: 予告カードの絵を押すと大きく見られる / 「詳細」で中身が開く
//   ② ダイヤショップ: 近日追加の円盤石にも「詳細」があり、同じ中身が開く
//   ③ 詳細の中身: 名前・「近日公開予定」・血統・図鑑の説明・予定の値段(ダイヤとビートP)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8961;
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise(r => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true); });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
    const dismiss = async () => { for (let i = 0; i < 14; i++) {
      const did = await page.evaluate(() => { const inOverlay = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || (s.position === 'absolute' && Number(s.zIndex) >= 40)) return true; } return false; };
        const l = [...document.querySelectorAll('button')].filter(b => inOverlay(b) && /^(確認|閉じる|とじる|OK|受け取る|つぎへ|次へ|わかった|はい|スキップ)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!l.length) return false; l[0].click(); return true; });
      if (!did) return; await page.waitForTimeout(300); } };
    await dismiss();
    const intoMarket = await page.evaluate(() => { const b = [...document.querySelectorAll('.mh-home-facility')].find(b => (b.innerText || '').replace(/\s+/g, ' ').trim().startsWith('マーケット')); if (!b) return false; b.click(); return true; });
    ok('HOMEからマーケットへ入れる', intoMarket);
    await page.waitForTimeout(600); await dismiss();

    const detailText = () => page.evaluate(() => { const d = document.querySelector('[data-upcoming-monster-detail]'); return d ? { id: d.getAttribute('data-upcoming-monster-detail'), text: d.innerText } : null; });
    const closeDetail = () => page.evaluate(() => { const d = document.querySelector('[data-upcoming-monster-detail]'); const b = d && [...d.querySelectorAll('button')].find(b => b.innerText.trim() === 'とじる'); if (b) b.click(); });

    // ① ビートP交換所
    const intoEvent = await page.evaluate(() => { const b = document.querySelector('[data-market-section="event"]'); if (!b) return false; b.click(); return true; });
    await page.waitForTimeout(500);
    const cards = await page.$$eval('[data-event-point-coming-soon]', els => els.map(e => e.getAttribute('data-event-point-coming-soon')));
    ok('ビートP交換所に予告カードが2枚ある', intoEvent && cards.length === 2, cards.join('・'));
    for (const id of cards) {
      const zoomed = await page.evaluate(id => { const c = document.querySelector(`[data-event-point-coming-soon="${id}"]`); const b = c && c.querySelector('button[aria-label$="を大きく見る"]'); if (!b) return null; b.click(); return b.getAttribute('aria-label'); }, id);
      await page.waitForTimeout(250);
      const zoomOpen = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some(d => /の拡大|を大きく/.test(d.getAttribute('aria-label') || '') || d.innerText.includes('とじる')));
      ok(`${id}: 絵を押すと大きく見られる`, !!zoomed && zoomOpen, zoomed || '絵のボタンが無い');
      await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(b => b.innerText.trim() === 'とじる'); if (b) b.click(); });
      await page.waitForTimeout(200);
      const hasChip = await page.evaluate(id => { const c = document.querySelector(`[data-event-point-coming-soon="${id}"]`); const b = c && c.querySelector('button[aria-label$="の詳細を見る"]'); if (!b) return false; b.click(); return true; }, id);
      await page.waitForTimeout(250);
      const d = await detailText();
      ok(`${id}: 「詳細」があり、中身が開く`, hasChip && !!d, d ? d.id : '開かない');
      if (d) {
        ok(`${id}: 詳細に「近日公開予定」・血統・図鑑の説明・予定の値段が出る`,
          d.text.includes('近日公開予定') && d.text.includes('血統') && d.text.includes('ユグドラシル') && /ダイヤショップ：150,000ダイヤ/.test(d.text) && /ビートP交換所：[\d,]+P/.test(d.text) && d.text.includes('公開のときにお知らせ'),
          d.text.replace(/\s+/g, ' ').slice(0, 90));
      }
      await closeDetail(); await page.waitForTimeout(200);
      ok(`${id}: 詳細を「とじる」で閉じられる`, !(await detailText()));
    }
    // ② ダイヤショップ(円盤石のタブ)
    // 見出しの「戻る」で入口へ戻る
    const intoDiamond = await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (!b) return false; b.click(); return true; });
    await page.waitForTimeout(500);
    const diamondOk = await page.evaluate(() => { const b = document.querySelector('[data-market-section="diamond"]'); if (!b) return false; b.click(); return true; });
    await page.waitForTimeout(500);
    ok('ダイヤショップへ入れる', intoDiamond && diamondOk);
    for (const name of ['ユグドラシルの円盤石', 'メルホイップの円盤石']) {
      const clicked = await page.evaluate(n => { const b = document.querySelector(`button[aria-label="${n}の詳細を見る"]`); if (!b) return false; b.scrollIntoView(); b.click(); return true; }, name);
      await page.waitForTimeout(250);
      const d = await detailText();
      ok(`ダイヤショップ: ${name}(近日追加)に「詳細」があり、同じ中身が開く`, clicked && !!d, d ? d.id : clicked ? '開かない' : 'ボタンが無い');
      await closeDetail(); await page.waitForTimeout(200);
    }
    ok('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
