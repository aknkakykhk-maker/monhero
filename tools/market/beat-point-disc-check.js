// ビートP交換所の円盤石(ユグドラシル・メルホイップ)を、実ブラウザで交換まで確かめる(2026-09-29)。
//
//   node tools/market/beat-point-disc-check.js
//
// 2026-09-28 に予告カードとして並べ(ユーザー指摘「押してもアップにならない」「詳細ボタンがない」「他のショップとあわせて」)、
// 2026-09-29 ユーザー指示「進めて」で本体が入ったので、交換できる円盤石へ移した。
//   ① ビートP交換所: 円盤石が2枚ある / 絵を押すと大きく見られる / 「詳細」でモンスターの詳細(能力・技)が開く
//   ② 交換: ビートPを1,500払うとモンスターが解放され(mh_unlocked_monsters)、カードが「所持済み」になる。
//      ビートPが足りない円盤石は交換できない。すでに持っている子は交換できない
//   ③ ダイヤショップ: 近日追加の円盤石も「詳細」でモンスターの詳細が開く
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
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_event_points_v1', 2000); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true); });
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

    const monsterDetail = () => page.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => /の詳細$/.test(d.getAttribute('aria-label') || '') && /ちから|ライフ/.test(d.innerText)); return d ? d.getAttribute('aria-label') : null; });
    const closeDialog = () => page.evaluate(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds[ds.length - 1]; const b = d && [...d.querySelectorAll('button')].reverse().find(b => /^(閉じる|とじる|✕|×)$/.test(b.innerText.trim()) || /閉じる/.test(b.getAttribute('aria-label') || '')); if (b) b.click(); });

    // ① ビートP交換所
    const intoEvent = await page.evaluate(() => { const b = document.querySelector('[data-market-section="event"]'); if (!b) return false; b.click(); return true; });
    await page.waitForTimeout(500);
    const cards = await page.$$eval('[data-event-point-disc]', els => els.map(e => e.getAttribute('data-event-point-disc')));
    ok('ビートP交換所に円盤石が2枚ある(予告カードは残っていない)', intoEvent && cards.join() === 'disc_yggdrasil,disc_mel_whip'
      && (await page.$$('[data-event-point-coming-soon]')).length === 0, cards.join('・'));
    for (const id of cards) {
      const zoomed = await page.evaluate(id => { const c = document.querySelector(`[data-event-point-disc="${id}"]`); const b = c && c.querySelector('button[aria-label$="を大きく見る"]'); if (!b) return null; b.click(); return b.getAttribute('aria-label'); }, id);
      await page.waitForTimeout(250);
      const zoomOpen = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some(d => /の拡大|を大きく/.test(d.getAttribute('aria-label') || '')));
      ok(`${id}: 絵を押すと大きく見られる`, !!zoomed && zoomOpen, zoomed || '絵のボタンが無い');
      await closeDialog(); await page.waitForTimeout(200);
      const hasChip = await page.evaluate(id => { const c = document.querySelector(`[data-event-point-disc="${id}"]`); const b = c && c.querySelector('button[aria-label$="の詳細を見る"]'); if (!b) return false; b.click(); return true; }, id);
      await page.waitForTimeout(300);
      const d = await monsterDetail();
      ok(`${id}: 「詳細」でモンスターの詳細(能力)が開く`, hasChip && !!d, d || '開かない');
      await closeDialog(); await page.waitForTimeout(250);
    }
    // ② 交換(2,000Pあるので1枚だけ交換でき、2枚目は足りない)
    const buy = async (id) => {
      const pressed = await page.evaluate(id => { const c = document.querySelector(`[data-event-point-disc="${id}"]`); const b = c && [...c.querySelectorAll('button')].find(b => /交換/.test(b.getAttribute('aria-label') || '')); if (!b || b.disabled) return false; b.click(); return true; }, id);
      if (!pressed) return false;
      await page.waitForTimeout(300);
      const confirmed = await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(b => /交換する$/.test(b.innerText.trim())); if (!b || b.disabled) return false; b.click(); return true; });
      await page.waitForTimeout(800);
      return confirmed;
    };
    const bought = await buy('disc_yggdrasil');
    const store = await page.evaluate(() => ({ unlocked: JSON.parse(localStorage.getItem('mh_unlocked_monsters') || 'null'), points: JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || 'null') }));
    ok('ユグドラシルの円盤石を1,500Pで交換すると解放され、ビートPが500になる', bought && Array.isArray(store.unlocked) && store.unlocked.includes('Yggdrasil') && store.points === 500, JSON.stringify(store));
    const ownedLabel = await page.evaluate(() => (document.querySelector('[data-event-point-disc="disc_yggdrasil"]')?.innerText || '').includes('所持済み'));
    ok('交換したカードは「所持済み」になる(もう交換できない)', ownedLabel);
    ok('ビートPが足りない円盤石(メルホイップ)は交換ボタンが押せない', !(await buy('disc_mel_whip')));

    // ③ ダイヤショップ(円盤石のタブ)
    const intoDiamond = await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (!b) return false; b.click(); return true; });
    await page.waitForTimeout(500);
    const diamondOk = await page.evaluate(() => { const b = document.querySelector('[data-market-section="diamond"]'); if (!b) return false; b.click(); return true; });
    await page.waitForTimeout(500);
    ok('ダイヤショップへ入れる', intoDiamond && diamondOk);
    for (const name of ['ユグドラシルの円盤石', 'メルホイップの円盤石']) {
      const clicked = await page.evaluate(n => { const b = document.querySelector(`button[aria-label="${n}の詳細を見る"]`); if (!b) return false; b.scrollIntoView(); b.click(); return true; }, name);
      await page.waitForTimeout(300);
      const d = await monsterDetail();
      ok(`ダイヤショップ: ${name}(近日追加)に「詳細」があり、モンスターの詳細が開く`, clicked && !!d, d || (clicked ? '開かない' : 'ボタンが無い'));
      await closeDialog(); await page.waitForTimeout(250);
    }
    ok('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
