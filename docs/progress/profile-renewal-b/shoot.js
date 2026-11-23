// プロフィール 案B の止め絵(縦 390×844・横 844×390・小さい機種 320×568)。見るだけ
// node docs/progress/profile-renewal-b/shoot.js [出力先(既定 docs/progress/profile-renewal-b/shots)]
// SHOT_LONG=1 で名前・ひとことを長くして撮る(文字の切れの確かめ)
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
require(path.join(ROOT, 'tools/shared-serve'));
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'shots'));
const LONG = process.env.SHOT_LONG === '1';
const URL = 'http://127.0.0.1:8899/monster-hero/';
const seed = (long) => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', long ? 'ながいなまえのブリーダー' : 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
  if (long) localStorage.setItem('mh_profile_message_v1', JSON.stringify('モンヒロビートを毎日たのしく遊んでいます！よろしくね'));
  // 称号の確かめ: 助手とのセッションを Lv.100 にした状態(撮影だけ)
  localStorage.setItem('mh_rhythm_assistant_session_v1', JSON.stringify({ mons: { mua: { exp: 99999999 } } }));
};
const SIZES = [['tate', 390, 844], ['yoko', 844, 390], ['small', 320, 568]];
async function shoot(browser, [tag, w, h]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seed, LONG);
  await page.addInitScript(require(path.join(ROOT, 'tools/boot/quiet-boot-seed')).quietBootSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 503, body: '{}' }));
  await page.route('**/rest/v1/**', r => r.request().method() !== 'GET' ? r.fulfill({ status: 201, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const down = (f) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, f);
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await down({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await down({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) {
    const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|あとで|スキップ|次へ|OK)$/.test(x.textContent.trim())); if (b) b.click(); return !!b; });
    await page.waitForTimeout(600); if (!c) break;
  }
  const snap = (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
  const click = async (sel, wait = 800) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await page.waitForTimeout(wait); };
  await click('button[aria-label="プロフィールを開く"]', 1500);
  await snap('1-top');
  await page.evaluate(() => { const el = document.querySelector('[data-profile-page]'); if (el) el.scrollTop = 99999; }); await page.waitForTimeout(300);
  await snap('1-top-end');
  for (const [door, name] of [['records', '2-records'], ['assistant', '3-assistant'], ['looks', '4-looks']]) {
    await click(`[data-profile-door="${door}"]`);
    await snap(name);
    await click('button[aria-label="プロフィールへ戻る"]', 500);
  }
  await click('[data-profile-door="memories"]');
  await snap('5-genres');
  for (const g of ['event', 'assistant', 'song', 'play']) {
    await click(`[data-event-replay-genre="${g}"]`, 600);
    await snap(`6-genre-${g}`);
    if (g === 'event') { await click('[data-event-replay-group="pandora_wings"]', 600); await snap('7-series'); await click('[data-event-replay-back]', 400); }
    await click('[data-event-replay-genre-back]', 400);
  }
  await page.close();
  return errors;
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const s of SIZES) { const e = await shoot(browser, s); console.log(s[0], e.length ? `エラー ${e.slice(0, 3).join(' / ')}` : 'エラーなし'); }
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
